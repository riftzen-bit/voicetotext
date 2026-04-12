"""
Unit tests for audio_enhancer.py
Tests vectorized audio processing functions.
"""
import unittest
import numpy as np
from audio_enhancer import (
    AudioEnhancementConfig,
    db_to_linear,
    linear_to_db,
    compute_rms,
    apply_noise_gate,
    apply_high_pass_filter,
    normalize_audio,
    enhance_audio,
    get_audio_stats,
)
from config import SAMPLE_RATE


class TestAudioEnhancer(unittest.TestCase):
    """Test suite for audio enhancement functions."""

    def test_db_to_linear(self):
        """Test dB to linear conversion."""
        self.assertAlmostEqual(db_to_linear(0), 1.0, places=5)
        self.assertAlmostEqual(db_to_linear(-6), 0.5011872, places=5)
        self.assertAlmostEqual(db_to_linear(-20), 0.1, places=5)

    def test_linear_to_db(self):
        """Test linear to dB conversion."""
        self.assertAlmostEqual(linear_to_db(1.0), 0.0, places=5)
        self.assertAlmostEqual(linear_to_db(0.5), -6.0206, places=3)
        self.assertEqual(linear_to_db(0), -120.0)

    def test_compute_rms_empty(self):
        """Test RMS with empty array."""
        result = compute_rms(np.array([], dtype=np.float32))
        self.assertEqual(len(result), 0)

    def test_compute_rms_sine_wave(self):
        """Test RMS with known sine wave."""
        # 1 second of 440Hz sine at amplitude 1
        t = np.linspace(0, 1, SAMPLE_RATE, dtype=np.float32)
        audio = np.sin(2 * np.pi * 440 * t).astype(np.float32)
        rms = compute_rms(audio)

        # RMS of sine wave with amplitude 1 should be ~0.707
        mean_rms = np.mean(rms)
        self.assertGreater(mean_rms, 0.5)
        self.assertLess(mean_rms, 0.9)

    def test_apply_noise_gate_silence(self):
        """Test noise gate removes silence."""
        # Very quiet noise
        audio = np.random.randn(SAMPLE_RATE).astype(np.float32) * 0.001
        gated = apply_noise_gate(audio, threshold_db=-40)

        # Should be mostly attenuated
        self.assertLess(np.max(np.abs(gated)), np.max(np.abs(audio)))

    def test_apply_noise_gate_signal(self):
        """Test noise gate passes signal."""
        # Loud sine wave
        t = np.linspace(0, 0.5, SAMPLE_RATE // 2, dtype=np.float32)
        audio = (np.sin(2 * np.pi * 440 * t) * 0.5).astype(np.float32)
        gated = apply_noise_gate(audio, threshold_db=-40)

        # Signal should mostly pass
        ratio = np.max(np.abs(gated)) / np.max(np.abs(audio))
        self.assertGreater(ratio, 0.5)

    def test_apply_high_pass_filter_empty(self):
        """Test high pass with empty array."""
        result = apply_high_pass_filter(np.array([], dtype=np.float32))
        self.assertEqual(len(result), 0)

    def test_apply_high_pass_filter_dc(self):
        """Test high pass removes DC offset."""
        # Audio with DC offset
        audio = np.ones(SAMPLE_RATE, dtype=np.float32) * 0.5
        filtered = apply_high_pass_filter(audio, cutoff_hz=80)

        # DC should be removed
        self.assertLess(np.abs(np.mean(filtered)), np.abs(np.mean(audio)))

    def test_normalize_audio_empty(self):
        """Test normalize with empty array."""
        result = normalize_audio(np.array([], dtype=np.float32))
        self.assertEqual(len(result), 0)

    def test_normalize_audio_quiet(self):
        """Test normalize boosts quiet audio."""
        # Quiet audio
        t = np.linspace(0, 0.5, SAMPLE_RATE // 2, dtype=np.float32)
        audio = (np.sin(2 * np.pi * 440 * t) * 0.01).astype(np.float32)
        normalized = normalize_audio(audio, target_db=-3)

        # Should be louder
        self.assertGreater(np.max(np.abs(normalized)), np.max(np.abs(audio)))

    def test_normalize_audio_silence(self):
        """Test normalize skips silence."""
        # Very quiet noise (below threshold)
        audio = np.random.randn(SAMPLE_RATE).astype(np.float32) * 0.0001
        normalized = normalize_audio(audio, target_db=-3, min_rms_threshold=0.001)

        # Should not be amplified (same as input)
        np.testing.assert_array_almost_equal(audio, normalized)

    def test_enhance_audio_pipeline(self):
        """Test full enhancement pipeline."""
        # Mix of signal and noise
        t = np.linspace(0, 1, SAMPLE_RATE, dtype=np.float32)
        signal = (np.sin(2 * np.pi * 440 * t) * 0.1).astype(np.float32)
        noise = (np.random.randn(SAMPLE_RATE) * 0.005).astype(np.float32)
        audio = signal + noise

        config = AudioEnhancementConfig(
            noise_gate_enabled=True,
            noise_gate_threshold_db=-40,
            normalize_enabled=True,
            normalize_target_db=-3,
            high_pass_enabled=True,
            high_pass_cutoff_hz=80,
        )

        enhanced = enhance_audio(audio, config)

        # Should still have audio
        self.assertEqual(len(enhanced), len(audio))
        # Should be louder (normalized)
        self.assertGreater(np.max(np.abs(enhanced)), np.max(np.abs(audio)) * 0.5)

    def test_get_audio_stats_empty(self):
        """Test stats with empty array."""
        stats = get_audio_stats(np.array([], dtype=np.float32))
        self.assertEqual(stats["duration_sec"], 0)
        self.assertEqual(stats["rms"], 0)

    def test_get_audio_stats_sine(self):
        """Test stats with sine wave."""
        t = np.linspace(0, 1, SAMPLE_RATE, dtype=np.float32)
        audio = (np.sin(2 * np.pi * 440 * t) * 0.5).astype(np.float32)
        stats = get_audio_stats(audio)

        self.assertAlmostEqual(stats["duration_sec"], 1.0, places=2)
        self.assertAlmostEqual(stats["peak"], 0.5, places=2)
        self.assertGreater(stats["rms"], 0.3)
        self.assertLess(stats["rms"], 0.4)


class TestTextClassification(unittest.TestCase):
    """Test text classification function."""

    def test_import_classification(self):
        """Test that classification can be imported from TypeScript-generated module."""
        # This is a placeholder - actual testing would require running the app
        pass


if __name__ == "__main__":
    unittest.main()
