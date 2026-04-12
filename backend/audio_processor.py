from __future__ import annotations

import logging
import struct

import numpy as np

from config import SAMPLE_RATE, MAX_AUDIO_LENGTH

log = logging.getLogger(__name__)


class AudioBuffer:
    """Accumulates raw PCM float32 chunks into a single numpy array."""

    def __init__(self) -> None:
        self._chunks: list[np.ndarray] = []
        self._total_samples = 0
        self._max_samples = int(MAX_AUDIO_LENGTH * SAMPLE_RATE)

    def append(self, raw: bytes) -> None:
        n_samples = len(raw) // 4  # float32 = 4 bytes
        if n_samples == 0:
            return
        chunk = np.frombuffer(raw, dtype=np.float32).copy()
        space_left = self._max_samples - self._total_samples
        if space_left <= 0:
            log.warning("Audio buffer full, dropping chunk")
            return
        if len(chunk) > space_left:
            chunk = chunk[:space_left]
        self._chunks.append(chunk)
        self._total_samples += len(chunk)

    def get_audio(self) -> np.ndarray:
        if not self._chunks:
            return np.array([], dtype=np.float32)
        return np.concatenate(self._chunks)

    @property
    def duration(self) -> float:
        return self._total_samples / SAMPLE_RATE

    @property
    def sample_count(self) -> int:
        return self._total_samples

    def clear(self) -> None:
        self._chunks.clear()
        self._total_samples = 0

    def compute_rms_energy(self) -> float:
        """Compute RMS energy of the audio buffer."""
        if not self._chunks:
            return 0.0
        audio = self.get_audio()
        if len(audio) == 0:
            return 0.0
        return float(np.sqrt(np.mean(audio ** 2)))

    def is_silence(self, threshold: float = 0.01) -> bool:
        """
        Check if the audio buffer contains only silence.

        Args:
            threshold: RMS threshold below which audio is considered silence.
                       Default 0.01 works well for normalized float32 audio.

        Returns:
            True if audio is silent, False if speech is detected.
        """
        rms = self.compute_rms_energy()
        is_silent = rms < threshold
        if is_silent:
            log.debug("Audio detected as silence (RMS=%.6f < threshold=%.4f)", rms, threshold)
        return is_silent
