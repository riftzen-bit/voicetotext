import { useCallback, useEffect, useRef, useState } from "react";

const WS_URL = "ws://127.0.0.1:8769/ws/transcribe";

export interface TranscriptionMessage {
  type: "result" | "transcribing" | "empty" | "error" | "cancelled" | "pong";
  text?: string;
  language?: string;
  language_probability?: number;
  duration?: number;
  segments?: Array<{ start: number; end: number; text: string }>;
  message?: string;
}

function teardownSocket(ws: WebSocket | null) {
  if (!ws) return;
  ws.onopen = null;
  ws.onclose = null;
  ws.onerror = null;
  ws.onmessage = null;
  if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
    ws.close();
  }
}

export function useWebSocket(autoConnect = true) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<TranscriptionMessage | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldConnect = useRef(autoConnect);

  const connect = useCallback(() => {
    if (!shouldConnect.current) return;

    const cur = wsRef.current;
    if (cur) {
      if (cur.readyState === WebSocket.OPEN || cur.readyState === WebSocket.CONNECTING) {
        return;
      }
      teardownSocket(cur);
      wsRef.current = null;
    }

    try {
      const ws = new WebSocket(WS_URL);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        if (wsRef.current === ws) setConnected(true);
      };

      ws.onmessage = (e) => {
        if (wsRef.current !== ws) return;
        if (typeof e.data === "string") {
          try {
            const msg: TranscriptionMessage = JSON.parse(e.data);
            setLastMessage(msg);
          } catch {}
        }
      };

      ws.onclose = () => {
        if (wsRef.current !== ws) return;
        wsRef.current = null;
        setConnected(false);
        if (shouldConnect.current) scheduleReconnect();
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      wsRef.current = null;
      if (shouldConnect.current) scheduleReconnect();
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimer.current) return;
    reconnectTimer.current = setTimeout(() => {
      reconnectTimer.current = null;
      connect();
    }, 3000);
  }, [connect]);

  useEffect(() => {
    shouldConnect.current = autoConnect;
    if (autoConnect) connect();
    return () => {
      shouldConnect.current = false;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      teardownSocket(wsRef.current);
      wsRef.current = null;
    };
  }, [autoConnect, connect]);

  const sendAudio = useCallback((chunk: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(chunk);
    }
  }, []);

  const sendEnd = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "end" }));
    }
  }, []);

  const sendCancel = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "cancel" }));
    }
  }, []);

  return { connected, lastMessage, sendAudio, sendEnd, sendCancel };
}
