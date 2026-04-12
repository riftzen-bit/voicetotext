from __future__ import annotations

import logging
import threading
from dataclasses import dataclass, field
from typing import Any, List

import numpy as np
from faster_whisper import WhisperModel

from config import (
    DEFAULT_LANGUAGE_HINT,
    DEFAULT_TRANSCRIPTION_PROFILE,
    WHISPER_COMPUTE_TYPE,
    SAMPLE_RATE,
    MIN_AUDIO_LENGTH,
    get_runtime_diagnostics,
    resolve_device,
)
from model_manager import check_model_downloaded, get_model_path_if_cached

log = logging.getLogger(__name__)

_CUDA_RUNTIME_ERROR_MARKERS = (
    "cublas",
    "cudnn",
    "cuda driver",
    "cuda failed",
    "cannot be loaded",
    "failed to load library",
)

# Common Whisper hallucination patterns - these appear when model hallucinates on silence/noise
_HALLUCINATION_PATTERNS = (
    # English hallucinations
    "thank you for watching",
    "thanks for watching",
    "please subscribe",
    "like and subscribe",
    "see you next time",
    "see you in the next",
    "bye bye",
    "goodbye",
    "subtitles by",
    "captions by",
    "transcribed by",
    "translated by",
    "music",
    "♪",
    "applause",
    "[music]",
    "[applause]",
    # Vietnamese hallucinations
    "cảm ơn bạn đã xem",
    "đăng ký kênh",
    "nhấn like",
    "hẹn gặp lại",
    # Chinese hallucinations
    "感谢观看",
    "请订阅",
    "谢谢",
    # Japanese hallucinations
    "ご視聴ありがとう",
    "チャンネル登録",
    # Korean hallucinations
    "시청해 주셔서 감사합니다",
    "구독",
)

def _is_hallucination(text: str) -> bool:
    """
    Detect if transcription is likely a hallucination.
    Whisper tends to hallucinate common phrases when given silence or noise.
    """
    if not text:
        return False

    lower_text = text.lower().strip()

    # Check for common hallucination patterns
    for pattern in _HALLUCINATION_PATTERNS:
        if pattern.lower() in lower_text:
            return True

    # Check for repetitive text (same phrase repeated)
    words = lower_text.split()
    if len(words) >= 4:
        # Check if entire text is just repetition of first few words
        first_part = " ".join(words[:2])
        if lower_text.count(first_part) >= 3:
            return True

    # Check for text that's mostly punctuation or symbols
    alpha_chars = sum(1 for c in text if c.isalpha())
    if len(text) > 0 and alpha_chars / len(text) < 0.3:
        return True

    return False

# Transcription profiles - VAD DISABLED for all profiles to ensure complete transcription
_TRANSCRIPTION_PROFILES: dict[str, dict[str, Any]] = {
    "fast": {
        "beam_size": 1,
        "condition_on_previous_text": False,
    },
    "balanced": {
        "beam_size": 3,
        "condition_on_previous_text": False,
    },
    "accurate": {
        "beam_size": 5,
        "condition_on_previous_text": True,
    },
}


@dataclass
class Segment:
    start: float
    end: float
    text: str


@dataclass
class TranscriptionResult:
    text: str
    language: str
    language_probability: float
    segments: List[Segment] = field(default_factory=list)
    duration: float = 0.0


@dataclass(frozen=True)
class TranscriptionSettings:
    profile: str
    language: str | None
    beam_size: int
    condition_on_previous_text: bool

    def to_public_dict(self) -> dict[str, object]:
        return {
            "profile": self.profile,
            "language": self.language or "auto",
            "beam_size": self.beam_size,
            "vad_filter": False,  # Always false - VAD disabled
            "condition_on_previous_text": self.condition_on_previous_text,
        }


class Transcriber:
    def __init__(self) -> None:
        self._model: WhisperModel | None = None
        self._model_name = ""
        self._loading = False
        self._device = resolve_device()
        self._lock = threading.RLock()
        self._runtime = get_runtime_diagnostics()
        self._profile = DEFAULT_TRANSCRIPTION_PROFILE
        self._language_hint = None if DEFAULT_LANGUAGE_HINT == "auto" else DEFAULT_LANGUAGE_HINT

    @property
    def device(self) -> str:
        return self._device

    @property
    def is_ready(self) -> bool:
        return self._model is not None

    @property
    def is_loading(self) -> bool:
        return self._loading

    @property
    def loaded_model_name(self) -> str:
        return self._model_name

    @property
    def runtime(self):
        return self._runtime

    def get_transcription_settings(self) -> TranscriptionSettings:
        profile_settings = _TRANSCRIPTION_PROFILES[self._profile]
        return TranscriptionSettings(
            profile=self._profile,
            language=self._language_hint,
            beam_size=int(profile_settings["beam_size"]),
            condition_on_previous_text=bool(profile_settings["condition_on_previous_text"]),
        )

    def configure(self, profile: str | None = None, language_hint: str | None = None) -> None:
        with self._lock:
            if profile:
                normalized_profile = profile.strip().lower()
                if normalized_profile in _TRANSCRIPTION_PROFILES:
                    self._profile = normalized_profile
                else:
                    log.warning("Unknown transcription profile %s. Keeping %s.", profile, self._profile)

            if language_hint is not None:
                normalized_language = language_hint.strip().lower()
                self._language_hint = None if normalized_language in {"", "auto"} else normalized_language

    def model_status(self, model_name: str) -> str:
        if self._model is not None and self._model_name == model_name:
            return "loaded"
        if self._loading:
            return "loading"
        if check_model_downloaded(model_name):
            return "downloaded"
        return "not_downloaded"

    def _is_cuda_runtime_error(self, exc: BaseException) -> bool:
        if self._device != "cuda":
            return False

        error_message = str(exc).lower()
        return any(marker in error_message for marker in _CUDA_RUNTIME_ERROR_MARKERS)

    def _load_model_locked(self, model_name: str, device: str) -> None:
        cached_path = get_model_path_if_cached(model_name)
        model_id = cached_path if cached_path else model_name

        log.info(
            "Loading model %s on %s (%s)...",
            model_name,
            device,
            WHISPER_COMPUTE_TYPE,
        )

        model = WhisperModel(
            model_id,
            device=device,
            compute_type=WHISPER_COMPUTE_TYPE,
            local_files_only=cached_path is not None,
        )

        self._model = model
        self._model_name = model_name
        self._device = device
        log.info("Model %s loaded on %s.", model_name, device)

    def _fallback_to_cpu_locked(self, model_name: str, exc: BaseException) -> None:
        log.warning(
            "CUDA runtime failed for model %s: %s. Falling back to CPU.",
            model_name,
            exc,
        )
        self._model = None
        self._model_name = ""
        self._load_model_locked(model_name, "cpu")

    def _transcribe_with_model_locked(
        self,
        audio: np.ndarray,
        duration: float,
    ) -> TranscriptionResult | None:
        if self._model is None:
            raise RuntimeError("Model not loaded")

        settings = self.get_transcription_settings()

        log.info(
            "Starting transcription: duration=%.2fs, samples=%d, beam_size=%d, language=%s",
            duration,
            len(audio),
            settings.beam_size,
            settings.language or "auto",
        )

        # VAD is ALWAYS disabled to ensure complete transcription
        # The user reported that VAD was cutting off speech even with tuned parameters
        segments_gen, info = self._model.transcribe(
            audio,
            beam_size=settings.beam_size,
            language=settings.language,
            vad_filter=False,  # DISABLED - VAD was causing partial transcriptions
            condition_on_previous_text=settings.condition_on_previous_text,
            word_timestamps=False,  # Disable for speed
            without_timestamps=False,  # Keep segment timestamps
        )

        segments: list[Segment] = []
        full_text_parts: list[str] = []

        try:
            for seg in segments_gen:
                text = seg.text.strip()
                if text:  # Only add non-empty segments
                    segments.append(Segment(start=seg.start, end=seg.end, text=text))
                    full_text_parts.append(text)
                    log.debug("Segment [%.2f-%.2f]: %s", seg.start, seg.end, text[:50])
        except Exception as e:
            log.error("Segment iteration error: %s (collected %d segments)", e, len(segments))
            # Continue with whatever segments we have

        full_text = " ".join(full_text_parts).strip()

        log.info(
            "Transcription complete: %d segments, %d chars, %d words, language=%s (%.2f%%)",
            len(segments),
            len(full_text),
            len(full_text.split()) if full_text else 0,
            info.language,
            info.language_probability * 100,
        )

        if not full_text:
            log.warning("Transcription produced no text for %.2fs audio", duration)
            return None

        # Filter out hallucinations - Whisper sometimes generates fake text on silence/noise
        if _is_hallucination(full_text):
            log.warning(
                "Hallucination detected and filtered: '%s' (%.2fs audio)",
                full_text[:100],
                duration,
            )
            return None

        # Additional check: if language probability is very low, text might be hallucinated
        if info.language_probability < 0.5 and len(full_text.split()) < 5:
            log.warning(
                "Low confidence transcription filtered: '%s' (prob=%.2f%%)",
                full_text[:50],
                info.language_probability * 100,
            )
            return None

        return TranscriptionResult(
            text=full_text,
            language=info.language,
            language_probability=round(info.language_probability, 4),
            segments=segments,
            duration=round(duration, 3),
        )

    def load_into_memory(self, model_name: str) -> None:
        with self._lock:
            if self._model is not None and self._model_name == model_name:
                return
            if self._loading:
                return

            self._loading = True
            try:
                try:
                    self._load_model_locked(model_name, self._device)
                except RuntimeError as exc:
                    if not self._is_cuda_runtime_error(exc):
                        raise
                    self._fallback_to_cpu_locked(model_name, exc)
            finally:
                self._loading = False

    def unload(self) -> None:
        with self._lock:
            self._model = None
            self._model_name = ""

    def transcribe(self, audio: np.ndarray) -> TranscriptionResult | None:
        duration = len(audio) / SAMPLE_RATE

        log.info("Received audio: %.2fs (%d samples)", duration, len(audio))

        if duration < MIN_AUDIO_LENGTH:
            log.debug("Audio too short (%.2fs < %.2fs), skipping", duration, MIN_AUDIO_LENGTH)
            return None

        # Convert to float32 if needed
        audio = audio.astype(np.float32)

        # Simple normalization - only clip protection, no aggressive processing
        # The audio enhancement was potentially removing speech as "noise"
        peak = np.abs(audio).max()
        if peak > 0:
            # Normalize to -3dB peak (0.707) to avoid clipping while preserving dynamics
            target_peak = 0.707
            if peak > 1.0:
                # Clip protection - normalize if over 1.0
                audio = audio / peak * target_peak
                log.debug("Audio normalized: peak %.3f -> %.3f", peak, target_peak)
            elif peak < 0.01:
                # Very quiet audio - boost it
                audio = audio / peak * target_peak
                log.debug("Quiet audio boosted: peak %.5f -> %.3f", peak, target_peak)

        with self._lock:
            if self._model is None:
                raise RuntimeError("Model not loaded")

            try:
                return self._transcribe_with_model_locked(audio, duration)
            except RuntimeError as exc:
                if not self._is_cuda_runtime_error(exc) or not self._model_name:
                    raise

                failed_model_name = self._model_name
                self._fallback_to_cpu_locked(failed_model_name, exc)
                return self._transcribe_with_model_locked(audio, duration)
