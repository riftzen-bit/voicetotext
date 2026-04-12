"""
Audio Enhancement Pipeline for VoiceToText
Provides noise gate and audio normalization to improve transcription quality.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

import numpy as np

from config import SAMPLE_RATE

log = logging.getLogger(__name__)


@dataclass
class AudioEnhancementConfig:
    """Configuration for audio enhancement pipeline."""
    noise_gate_enabled: bool = True
    noise_gate_threshold_db: float = -40.0
    noise_gate_attack_ms: float = 5.0
    noise_gate_release_ms: float = 50.0
    normalize_enabled: bool = True
    normalize_target_db: float = -3.0
    high_pass_enabled: bool = True
    high_pass_cutoff_hz: float = 80.0


# Default configuration
_default_config = AudioEnhancementConfig()


def set_enhancement_config(config: AudioEnhancementConfig) -> None:
    """Update the global enhancement configuration."""
    global _default_config
    _default_config = config
    log.info(
        "Audio enhancement config updated: noise_gate=%s (%.1f dB), normalize=%s (%.1f dB)",
        config.noise_gate_enabled,
        config.noise_gate_threshold_db,
        config.normalize_enabled,
        config.normalize_target_db,
    )


def get_enhancement_config() -> AudioEnhancementConfig:
    """Get the current enhancement configuration."""
    return _default_config


def db_to_linear(db: float) -> float:
    """Convert decibels to linear amplitude."""
    return 10 ** (db / 20.0)


def linear_to_db(linear: float) -> float:
    """Convert linear amplitude to decibels."""
    if linear <= 0:
        return -120.0
    return 20.0 * np.log10(linear)


def compute_rms(audio: np.ndarray, frame_size: int = 512) -> np.ndarray:
    """
    Compute RMS energy envelope of audio using a sliding window.

    Args:
        audio: Input audio samples
        frame_size: Window size for RMS computation

    Returns:
        RMS envelope with same length as input
    """
    if len(audio) == 0:
        return np.array([], dtype=np.float32)

    # Pad audio for windowing
    pad_size = frame_size // 2
    padded = np.pad(audio, (pad_size, pad_size), mode='reflect')

    # Compute RMS using cumulative sum for efficiency
    squared = padded ** 2
    cumsum = np.cumsum(squared)

    # Sliding window mean
    cumsum = np.insert(cumsum, 0, 0)
    rms_squared = (cumsum[frame_size:] - cumsum[:-frame_size]) / frame_size

    # Trim to original length
    rms = np.sqrt(np.maximum(rms_squared[:len(audio)], 1e-10))

    return rms.astype(np.float32)


def apply_noise_gate(
    audio: np.ndarray,
    threshold_db: float = -40.0,
    attack_ms: float = 5.0,
    release_ms: float = 50.0,
) -> np.ndarray:
    """
    Apply noise gate to reduce background noise.

    Samples below the threshold are attenuated. Uses vectorized smoothing
    for fast processing.

    Args:
        audio: Input audio (float32, normalized to [-1, 1])
        threshold_db: Gate threshold in decibels
        attack_ms: Attack time in milliseconds
        release_ms: Release time in milliseconds

    Returns:
        Gated audio
    """
    if len(audio) == 0:
        return audio

    threshold_linear = db_to_linear(threshold_db)

    # Compute RMS envelope
    rms = compute_rms(audio)

    # Create gate mask (1 = pass, 0 = gate)
    gate = (rms >= threshold_linear).astype(np.float32)

    # Use simple moving average for smoothing (fully vectorized)
    # This is faster than IIR filter and avoids Python loops
    smooth_samples = max(1, int((attack_ms + release_ms) / 2 * SAMPLE_RATE / 1000))

    # Uniform smoothing using cumsum trick (O(n) vectorized)
    if smooth_samples > 1 and len(gate) > smooth_samples:
        # Pad for edge handling
        padded = np.pad(gate, (smooth_samples // 2, smooth_samples - smooth_samples // 2), mode='edge')
        cumsum = np.cumsum(padded)
        smoothed_gate = (cumsum[smooth_samples:] - cumsum[:-smooth_samples]) / smooth_samples
        smoothed_gate = smoothed_gate[:len(gate)]
    else:
        smoothed_gate = gate

    # Clip to [0, 1] range
    smoothed_gate = np.clip(smoothed_gate, 0.0, 1.0).astype(np.float32)

    # Apply gate
    gated_audio = audio * smoothed_gate

    return gated_audio.astype(np.float32)


def apply_high_pass_filter(
    audio: np.ndarray,
    cutoff_hz: float = 80.0,
) -> np.ndarray:
    """
    Apply simple high-pass filter to remove low-frequency rumble.

    Uses DC-blocking differentiator approach (fully vectorized).

    Args:
        audio: Input audio
        cutoff_hz: Cutoff frequency in Hz

    Returns:
        Filtered audio
    """
    if len(audio) == 0 or cutoff_hz <= 0:
        return audio

    # Use scipy.signal for efficient filtering if available
    try:
        from scipy.signal import butter, sosfilt

        # Design 2nd order Butterworth high-pass filter
        nyquist = SAMPLE_RATE / 2
        normalized_cutoff = cutoff_hz / nyquist
        if normalized_cutoff >= 1.0:
            return audio
        sos = butter(2, normalized_cutoff, btype='high', output='sos')
        filtered = sosfilt(sos, audio)
        return filtered.astype(np.float32)

    except ImportError:
        # Fallback: simple DC blocking using diff (vectorized)
        # High-pass approximation: y = x - lowpass(x)
        # Use simple exponential moving average for lowpass
        rc = 1.0 / (2.0 * np.pi * cutoff_hz)
        dt = 1.0 / SAMPLE_RATE
        alpha = dt / (rc + dt)

        # Compute lowpass using cumsum approximation (faster than loop)
        # This is an approximation but much faster
        window_size = max(1, int(SAMPLE_RATE / cutoff_hz / 4))
        if window_size > 1 and len(audio) > window_size:
            padded = np.pad(audio, (window_size, 0), mode='edge')
            cumsum = np.cumsum(padded)
            lowpass = (cumsum[window_size:] - cumsum[:-window_size]) / window_size
            lowpass = lowpass[:len(audio)]
            filtered = audio - lowpass
        else:
            # Very short audio, just subtract mean
            filtered = audio - np.mean(audio)

        return filtered.astype(np.float32)


def normalize_audio(
    audio: np.ndarray,
    target_db: float = -3.0,
    min_rms_threshold: float = 0.001,
) -> np.ndarray:
    """
    Normalize audio to target RMS level.

    Only normalizes if the audio contains meaningful signal (above noise floor).
    Prevents amplifying pure silence or very quiet noise.

    Args:
        audio: Input audio
        target_db: Target RMS level in decibels
        min_rms_threshold: Minimum RMS to consider as signal (vs noise)

    Returns:
        Normalized audio
    """
    if len(audio) == 0:
        return audio

    # Compute current RMS
    rms = np.sqrt(np.mean(audio ** 2))

    # Skip normalization if audio is too quiet (likely silence or noise)
    if rms < min_rms_threshold:
        log.debug("Audio RMS %.6f below threshold %.6f, skipping normalization", rms, min_rms_threshold)
        return audio

    # Calculate required gain
    target_rms = db_to_linear(target_db)
    gain = target_rms / rms

    # Limit gain to prevent excessive amplification
    max_gain = 10.0  # +20 dB max
    gain = min(gain, max_gain)

    # Apply gain with clipping protection
    normalized = audio * gain
    normalized = np.clip(normalized, -1.0, 1.0)

    log.debug("Normalized audio: RMS %.4f -> %.4f, gain %.2fx", rms, rms * gain, gain)

    return normalized.astype(np.float32)


def enhance_audio(
    audio: np.ndarray,
    config: Optional[AudioEnhancementConfig] = None,
) -> np.ndarray:
    """
    Apply full audio enhancement pipeline.

    Pipeline order:
    1. High-pass filter (remove rumble)
    2. Noise gate (reduce background noise)
    3. Normalization (boost signal level)

    Args:
        audio: Input audio (float32, normalized to [-1, 1])
        config: Enhancement configuration (uses default if None)

    Returns:
        Enhanced audio
    """
    if config is None:
        config = _default_config

    if len(audio) == 0:
        return audio

    result = audio.astype(np.float32)

    # Step 1: High-pass filter
    if config.high_pass_enabled:
        result = apply_high_pass_filter(result, config.high_pass_cutoff_hz)

    # Step 2: Noise gate
    if config.noise_gate_enabled:
        result = apply_noise_gate(
            result,
            threshold_db=config.noise_gate_threshold_db,
            attack_ms=config.noise_gate_attack_ms,
            release_ms=config.noise_gate_release_ms,
        )

    # Step 3: Normalization
    if config.normalize_enabled:
        result = normalize_audio(result, target_db=config.normalize_target_db)

    return result


def get_audio_stats(audio: np.ndarray) -> dict:
    """
    Get statistics about audio signal for debugging/display.

    Args:
        audio: Input audio

    Returns:
        Dictionary with audio statistics
    """
    if len(audio) == 0:
        return {
            "duration_sec": 0,
            "rms": 0,
            "rms_db": -120,
            "peak": 0,
            "peak_db": -120,
            "crest_factor_db": 0,
        }

    rms = np.sqrt(np.mean(audio ** 2))
    peak = np.max(np.abs(audio))

    return {
        "duration_sec": len(audio) / SAMPLE_RATE,
        "rms": float(rms),
        "rms_db": linear_to_db(rms),
        "peak": float(peak),
        "peak_db": linear_to_db(peak),
        "crest_factor_db": linear_to_db(peak) - linear_to_db(rms) if rms > 0 else 0,
    }
