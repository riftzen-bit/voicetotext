from __future__ import annotations

import logging
import re
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
from audio_enhancer import apply_high_pass_filter

log = logging.getLogger(__name__)

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
    "bye-bye",
    "bye-bye.",
    "goodbye",
    "see you later",
    "thanks for listening",
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

def _strip_trailing_repeats(text: str) -> str:
    """
    Collapse a trailing decoder loop (e.g. "Bye-bye. Bye-bye. Bye-bye.") to one
    instance. Whisper sometimes enters a repeat state on silent tails and emits
    the same short phrase many times. We scan for the largest window (up to 10
    words) whose last-N tokens repeat >=3 times consecutively at the end of the
    transcript, then keep everything before the loop plus one instance.
    Comparison is punctuation-insensitive and case-insensitive so "Bye-bye."
    and "bye bye" count as the same phrase.
    """
    if not text:
        return text
    words = text.split()
    n_words = len(words)
    if n_words < 6:
        return text

    def _norm(w: str) -> str:
        return re.sub(r"[^\w]", "", w).lower()

    normed = [_norm(w) for w in words]

    # Search every window size and pick the candidate that removes the most
    # text (earliest start index). Tie-break on the smaller window so a pure
    # word-level loop ("bye bye bye...") collapses to one instance rather
    # than a pair, while a multi-word loop ("see you later ...") still wins
    # when its pattern reaches further back than any single-word match.
    max_window = min(10, n_words // 3)
    best: tuple[int, int] | None = None  # (start_idx, window)
    for window in range(1, max_window + 1):
        tail = normed[-window:]
        if not any(tail):
            continue
        repeats = 1
        idx = n_words - window
        while idx - window >= 0 and normed[idx - window:idx] == tail:
            repeats += 1
            idx -= window
        if repeats >= 3:
            if best is None or idx < best[0] or (idx == best[0] and window < best[1]):
                best = (idx, window)

    if best is None:
        return text
    start_idx, window = best
    kept = words[:start_idx] + words[n_words - window:]
    return " ".join(kept).strip()


def _is_hallucination(text: str, duration: float = 0.0) -> bool:
    """
    Detect if transcription is likely a hallucination.
    Whisper tends to hallucinate common phrases on silence/noise, but ONLY
    on short clips. On longer dictations the same phrases ("thank you",
    "music", "bye") routinely appear in real speech and must not be filtered.
    """
    if not text:
        return False

    lower_text = text.lower().strip()

    # Pattern-based check: only credible on short audio. Above 5 seconds
    # a substring match is almost certainly legitimate speech, not a
    # hallucination, so skip the list entirely.
    if duration <= 5.0:
        for pattern in _HALLUCINATION_PATTERNS:
            if pattern.lower() in lower_text:
                return True
    else:
        # On long audio, only flag when the ENTIRE transcript equals
        # one of the patterns (e.g. the whole 30s returned just "music").
        for pattern in _HALLUCINATION_PATTERNS:
            if lower_text == pattern.lower():
                return True

    # Repetition check works at any duration — Whisper stuck in a loop
    # is a real failure mode for long audio too.
    words = lower_text.split()
    if len(words) >= 4:
        first_part = " ".join(words[:2])
        if lower_text.count(first_part) >= 3:
            return True

    # Mostly-symbols check is only meaningful on short outputs. Skip on
    # longer transcripts where punctuation-heavy content is normal.
    if duration <= 5.0:
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


@dataclass
class FilteredResult:
    """
    Emitted when Whisper produced text but the post-filters rejected it
    (hallucination, low confidence, etc). The raw text is preserved so the
    UI can show the user exactly what was suppressed instead of a vague
    "no speech detected" message.
    """
    reason: str
    text: str
    duration: float = 0.0
    language_probability: float = 0.0


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

    def _transcribe_with_model_locked(
        self,
        audio: np.ndarray,
        duration: float,
    ) -> TranscriptionResult | FilteredResult | None:
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
        #
        # Tuning for shy / soft / fast speakers:
        # - no_speech_threshold=0.4 (default 0.6) makes Whisper less likely to discard
        #   quiet or hesitant speech as "no speech".
        # - temperature fallback list lets Whisper retry with higher randomness when
        #   beam search produces low-confidence output (helps fast/slurred speech).
        # - compression_ratio_threshold=2.4 (default) prevents runaway repetition.
        segments_gen, info = self._model.transcribe(
            audio,
            beam_size=settings.beam_size,
            language=settings.language,
            vad_filter=False,  # DISABLED - VAD was causing partial transcriptions
            condition_on_previous_text=settings.condition_on_previous_text,
            word_timestamps=False,  # Disable for speed
            without_timestamps=False,  # Keep segment timestamps
            no_speech_threshold=0.4,
            temperature=(0.0, 0.2, 0.4, 0.6, 0.8),
            compression_ratio_threshold=2.4,
            # Kill decoder loops at the source: penalize tokens the model has
            # already emitted, and forbid repeating any 3-gram. Prevents the
            # "Bye-bye. Bye-bye. Bye-bye." cascade on silent tails without
            # weakening the model's quality on real speech.
            repetition_penalty=1.15,
            no_repeat_ngram_size=3,
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

        # Post-process: if the decoder still managed to loop (repetition_penalty
        # + no_repeat_ngram_size catch most cases but not all), strip any
        # trailing repeated phrase while preserving real content before it.
        stripped = _strip_trailing_repeats(full_text)
        if stripped != full_text:
            log.warning(
                "Trailing repeat collapsed: %d chars -> %d chars",
                len(full_text),
                len(stripped),
            )
            full_text = stripped

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
        if _is_hallucination(full_text, duration):
            log.warning(
                "Hallucination detected and filtered: '%s' (%.2fs audio)",
                full_text[:100],
                duration,
            )
            return FilteredResult(
                reason="hallucination",
                text=full_text,
                duration=round(duration, 3),
                language_probability=round(info.language_probability, 4),
            )

        # Filter only when confidence is extremely low AND text is a single word.
        # Previous cutoff (prob<0.3, words<3) discarded legitimate short utterances
        # from shy / quiet speakers where language detection is less certain.
        if info.language_probability < 0.2 and len(full_text.split()) < 2:
            log.warning(
                "Low confidence transcription filtered: '%s' (prob=%.2f%%)",
                full_text[:50],
                info.language_probability * 100,
            )
            return FilteredResult(
                reason="low_confidence",
                text=full_text,
                duration=round(duration, 3),
                language_probability=round(info.language_probability, 4),
            )

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
                # No CPU fallback by design — GPU is mandatory. A CUDA load
                # failure must propagate so the UI surfaces the real error
                # instead of silently degrading to a 30x slower CPU run.
                self._load_model_locked(model_name, self._device)
            finally:
                self._loading = False

    def unload(self) -> None:
        with self._lock:
            self._model = None
            self._model_name = ""

    def transcribe(self, audio: np.ndarray) -> TranscriptionResult | FilteredResult | None:
        duration = len(audio) / SAMPLE_RATE

        log.info("Received audio: %.2fs (%d samples)", duration, len(audio))

        if duration < MIN_AUDIO_LENGTH:
            log.debug("Audio too short (%.2fs < %.2fs), skipping", duration, MIN_AUDIO_LENGTH)
            return FilteredResult(
                reason="too_short",
                text="",
                duration=round(duration, 3),
            )

        # Convert to float32 if needed
        audio = audio.astype(np.float32)

        # High-pass filter removes low-frequency rumble (HVAC, electronics hum)
        # that degrades Whisper accuracy — safe for speech (80Hz cutoff)
        audio = apply_high_pass_filter(audio, cutoff_hz=80.0)

        # Always normalize to consistent peak level for Whisper
        peak = np.abs(audio).max()
        if peak > 0:
            target_peak = 0.707
            audio = audio / peak * target_peak
            log.debug("Audio normalized: peak %.5f -> %.3f", peak, target_peak)

        with self._lock:
            if self._model is None:
                raise RuntimeError("Model not loaded")

            # Same policy as load: do not catch CUDA runtime errors and
            # silently retry on CPU. Let the failure surface.
            return self._transcribe_with_model_locked(audio, duration)
