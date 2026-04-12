import { useCallback, useRef, useState } from "react";
import { getWorkletUrl } from "../lib/audio-worklet";

export interface AudioCaptureState {
  isCapturing: boolean;
  audioLevel: number;
  error: string | null;
}

export function useAudioCapture() {
  const [state, setState] = useState<AudioCaptureState>({
    isCapturing: false,
    audioLevel: 0,
    error: null,
  });

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nodeRef = useRef<AudioWorkletNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);

  const startCapture = useCallback(async (onChunk?: (chunk: ArrayBuffer) => void, deviceId?: string) => {
    try {
      const audioConstraints: MediaTrackConstraints = {
        channelCount: 1,
        sampleRate: { ideal: 16000 },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

      if (deviceId && deviceId !== "default") {
        audioConstraints.deviceId = { exact: deviceId };
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });
      streamRef.current = stream;

      const ctx = new AudioContext();
      ctxRef.current = ctx;

      await ctx.audioWorklet.addModule(getWorkletUrl());

      const source = ctx.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(ctx, "vtt-capture-processor");
      nodeRef.current = workletNode;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      source.connect(workletNode);
      source.connect(analyser);

      workletNode.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        if (onChunk) onChunk(e.data);
      };

      const levelBuf = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        analyser.getByteFrequencyData(levelBuf);
        let sum = 0;
        for (let i = 0; i < levelBuf.length; i++) sum += levelBuf[i];
        // Boost the visual audio level by 2.5x to make the waveform very responsive to quiet speech
        const avg = Math.min(1, (sum / levelBuf.length / 255) * 2.5);
        setState((s) => ({ ...s, audioLevel: avg }));
        rafRef.current = requestAnimationFrame(updateLevel);
      };
      rafRef.current = requestAnimationFrame(updateLevel);

      setState({ isCapturing: true, audioLevel: 0, error: null });
    } catch (err: any) {
      setState({ isCapturing: false, audioLevel: 0, error: err.message });
    }
  }, []);

  const stopCapture = useCallback(() => {
    cancelAnimationFrame(rafRef.current);

    nodeRef.current?.disconnect();
    nodeRef.current = null;

    analyserRef.current?.disconnect();
    analyserRef.current = null;

    ctxRef.current?.close();
    ctxRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    setState({ isCapturing: false, audioLevel: 0, error: null });
  }, []);

  return { ...state, startCapture, stopCapture };
}
