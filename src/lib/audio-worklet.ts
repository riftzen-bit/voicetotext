/**
 * AudioWorklet processor that captures PCM samples at the native sample rate,
 * resamples to 16 kHz mono float32, and posts chunks to the main thread.
 *
 * Registered as "vtt-capture-processor".
 */
const WORKLET_CODE = `
class VttCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._inputRate = sampleRate;
    this._outputRate = 16000;
    this._resampleRatio = this._outputRate / this._inputRate;
    // Use typed array for better performance
    this._inputBuffer = new Float32Array(8192);
    this._inputLen = 0;
    // Smaller chunks for lower latency (was 1024, now 512)
    this._minChunkSize = 512;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) return true;

    const samples = input[0];
    const samplesLen = samples.length;

    // Ensure buffer capacity
    if (this._inputLen + samplesLen > this._inputBuffer.length) {
      const newSize = Math.max(this._inputBuffer.length * 2, this._inputLen + samplesLen + 1024);
      const newBuffer = new Float32Array(newSize);
      newBuffer.set(this._inputBuffer.subarray(0, this._inputLen));
      this._inputBuffer = newBuffer;
    }

    // Copy samples directly (faster than push)
    this._inputBuffer.set(samples, this._inputLen);
    this._inputLen += samplesLen;

    // Calculate output samples
    const possibleOutputSamples = Math.floor((this._inputLen - 1) * this._resampleRatio);

    // Only process if we have enough for a meaningful chunk
    if (possibleOutputSamples < this._minChunkSize) return true;

    // Create output buffer for this batch
    const resampled = new Float32Array(possibleOutputSamples);

    // Resample using linear interpolation (optimized loop)
    for (let i = 0; i < possibleOutputSamples; i++) {
      const inputPos = i / this._resampleRatio;
      const idx = inputPos | 0; // Fast floor
      const frac = inputPos - idx;
      const s0 = this._inputBuffer[idx];
      const s1 = this._inputBuffer[idx + 1] || s0;
      resampled[i] = s0 + (s1 - s0) * frac;
    }

    // Send the resampled data (transfer ownership for zero-copy)
    this.port.postMessage(resampled.buffer, [resampled.buffer]);

    // Shift consumed samples efficiently
    const consumed = Math.floor(possibleOutputSamples / this._resampleRatio);
    if (consumed > 0) {
      const remaining = this._inputLen - consumed;
      if (remaining > 0) {
        this._inputBuffer.copyWithin(0, consumed, this._inputLen);
      }
      this._inputLen = remaining;
    }

    return true;
  }
}

registerProcessor("vtt-capture-processor", VttCaptureProcessor);
`;

let workletBlobUrl: string | null = null;

export function getWorkletUrl(): string {
  if (!workletBlobUrl) {
    const blob = new Blob([WORKLET_CODE], { type: "application/javascript" });
    workletBlobUrl = URL.createObjectURL(blob);
  }
  return workletBlobUrl;
}
