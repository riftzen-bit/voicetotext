import { useCallback, useEffect, useRef, useState } from "react";

const WS_URL = "ws://127.0.0.1:8769/ws/transcribe";
const RECONNECT_DELAY_MS = 1500;
const HEARTBEAT_INTERVAL_MS = 20_000;

export interface TranscriptionMessage {
  type:
    | "result"
    | "transcribing"
    | "empty"
    | "error"
    | "cancelled"
    | "pong"
    | "hello_ack";
  text?: string;
  language?: string;
  language_probability?: number;
  duration?: number;
  segments?: Array<{ start: number; end: number; text: string }>;
  message?: string;
  session_id?: string;
  last_seq?: number;
  state?: "recording" | "processing" | "done";
}

interface ChunkMeta {
  seq: number;
  packed: ArrayBuffer; // [u32 LE seq][float32 samples...]
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

function packChunk(seq: number, samples: ArrayBuffer): ArrayBuffer {
  const out = new ArrayBuffer(4 + samples.byteLength);
  const view = new DataView(out);
  view.setUint32(0, seq >>> 0, true);
  new Uint8Array(out, 4).set(new Uint8Array(samples));
  return out;
}

function newSessionId(): string {
  const c = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // Fallback: 128 bits of Math.random, good enough for process-unique IDs.
  let s = "";
  for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

export function useWebSocket(autoConnect = true) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<TranscriptionMessage | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const shouldConnect = useRef(autoConnect);

  // Durable session state — survives reconnects, cleared only on terminal delivery.
  const sessionId = useRef<string | null>(null);
  const sessionChunks = useRef<ChunkMeta[]>([]);
  const nextSeq = useRef(0);
  const serverLastSeq = useRef(-1);        // highest seq server has acknowledged
  const sessionState = useRef<"idle" | "recording" | "ended">("idle");
  const pendingEnd = useRef(false);        // true when stop was pressed but "end" action hasn't been ACK'd by a hello_ack cycle
  const helloInFlight = useRef(false);     // true between hello send and hello_ack (or terminal parked-result flush)

  const stopHeartbeat = () => {
    if (heartbeatTimer.current) {
      clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = null;
    }
  };

  const startHeartbeat = () => {
    stopHeartbeat();
    heartbeatTimer.current = setInterval(() => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN && sessionState.current !== "idle") {
        try {
          ws.send(JSON.stringify({ action: "ping" }));
        } catch {
          /* ignore — onclose will handle reconnect */
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
  };

  const sendHello = (ws: WebSocket) => {
    if (!sessionId.current) return;
    helloInFlight.current = true;
    try {
      ws.send(JSON.stringify({ action: "hello", session_id: sessionId.current }));
    } catch {
      helloInFlight.current = false;
    }
  };

  const replayFromServerState = (ws: WebSocket, serverLast: number) => {
    serverLastSeq.current = serverLast;
    // Resend every chunk strictly after what the server already has.
    for (const c of sessionChunks.current) {
      if (c.seq > serverLast) {
        try {
          ws.send(c.packed);
        } catch {
          return; // socket gone; onclose will retry
        }
      }
    }
    if (pendingEnd.current && sessionState.current === "ended") {
      try {
        ws.send(JSON.stringify({ action: "end" }));
        pendingEnd.current = false;
      } catch {
        /* ignore — retry on next reconnect */
      }
    }
  };

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
        if (wsRef.current !== ws) return;
        setConnected(true);
        startHeartbeat();
        // Only say hello if a session is live. Idle connections stay quiet.
        if (sessionId.current && sessionState.current !== "idle") {
          sendHello(ws);
        }
      };

      ws.onmessage = (e) => {
        if (wsRef.current !== ws) return;
        if (typeof e.data !== "string") return;
        let msg: TranscriptionMessage;
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }

        if (msg.type === "hello_ack") {
          helloInFlight.current = false;
          replayFromServerState(ws, typeof msg.last_seq === "number" ? msg.last_seq : -1);
          // hello_ack is not a user-facing message — don't surface it.
          return;
        }

        // A parked result flushed on hello counts as terminal delivery.
        if (msg.type === "result" || msg.type === "empty" || msg.type === "cancelled") {
          helloInFlight.current = false;
        }
        setLastMessage(msg);
      };

      ws.onclose = () => {
        if (wsRef.current !== ws) return;
        wsRef.current = null;
        setConnected(false);
        stopHeartbeat();
        helloInFlight.current = false;
        if (shouldConnect.current) scheduleReconnect();
      };

      ws.onerror = () => {
        // onclose will follow; let it drive the retry path.
        try { ws.close(); } catch { /* ignore */ }
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
    }, RECONNECT_DELAY_MS);
  }, [connect]);

  useEffect(() => {
    shouldConnect.current = autoConnect;
    if (autoConnect) connect();
    return () => {
      shouldConnect.current = false;
      stopHeartbeat();
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      teardownSocket(wsRef.current);
      wsRef.current = null;
    };
  }, [autoConnect, connect]);

  const startSession = useCallback(() => {
    sessionId.current = newSessionId();
    sessionChunks.current = [];
    nextSeq.current = 0;
    serverLastSeq.current = -1;
    sessionState.current = "recording";
    pendingEnd.current = false;
    helloInFlight.current = false;

    // Kick the handshake now so the server has a session record before the
    // first chunks arrive. If disconnected, force an immediate reconnect
    // rather than waiting out the backoff timer.
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      sendHello(ws);
    } else if (shouldConnect.current) {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      connect();
    }
  }, [connect]);

  const completeSession = useCallback(() => {
    sessionId.current = null;
    sessionChunks.current = [];
    nextSeq.current = 0;
    serverLastSeq.current = -1;
    sessionState.current = "idle";
    pendingEnd.current = false;
    helloInFlight.current = false;
  }, []);

  // Public alias preserved for existing callers. Terminal delivery clears state.
  const clearSession = completeSession;

  const sendAudio = useCallback((chunk: ArrayBuffer) => {
    if (sessionState.current !== "recording") return;
    if (!sessionId.current) return;

    const seq = nextSeq.current++;
    const packed = packChunk(seq, chunk);
    sessionChunks.current.push({ seq, packed });

    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN && !helloInFlight.current) {
      try {
        ws.send(packed);
      } catch {
        // Keep the buffered copy — replay on next reconnect will catch it up.
      }
    }
  }, []);

  const sendEnd = useCallback(() => {
    sessionState.current = "ended";
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN && !helloInFlight.current) {
      try {
        ws.send(JSON.stringify({ action: "end" }));
        pendingEnd.current = false;
        return;
      } catch {
        /* fall through to retry */
      }
    }
    pendingEnd.current = true;
  }, []);

  const sendCancel = useCallback(() => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ action: "cancel" }));
      } catch { /* ignore */ }
    }
    completeSession();
  }, [completeSession]);

  return {
    connected,
    lastMessage,
    sendAudio,
    sendEnd,
    sendCancel,
    startSession,
    clearSession,
  };
}
