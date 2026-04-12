"""
VoiceToText – Python backend
FastAPI server with WebSocket endpoint for real-time Whisper transcription
and model download management.
"""
from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
import json
import logging
import threading
from contextlib import asynccontextmanager
from dataclasses import asdict

from fastapi import Body, FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
import uvicorn

from config import (
    DEFAULT_LANGUAGE_HINT,
    DEFAULT_TRANSCRIPTION_PROFILE,
    SERVER_HOST,
    SERVER_PORT,
    TRANSCRIBE_EXECUTOR_WORKERS,
    WHISPER_MODEL,
)
from transcriber import Transcriber, TranscriptionResult
from audio_processor import AudioBuffer
from model_manager import (
    check_model_downloaded,
    download_model_with_progress,
    get_model_size_mb,
    list_available_models,
)
from audio_enhancer import (
    AudioEnhancementConfig,
    set_enhancement_config,
    get_enhancement_config,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("vtt.server")

import os
_muted_sessions = {}

def set_other_apps_mute(mute: bool):
    try:
        from pycaw.pycaw import AudioUtilities
        sessions = AudioUtilities.GetAllSessions()
        current_pid = os.getpid()
        allowed_names = ["electron.exe", "voicetotext.exe"]
        
        for session in sessions:
            if session.Process is None:
                continue
            proc_name = session.Process.name().lower()
            if proc_name in allowed_names or session.Process.pid == current_pid:
                continue
                
            volume = session.SimpleAudioVolume
            if mute:
                if volume.GetMute() == 0:
                    _muted_sessions[session.Process.pid] = True
                    volume.SetMute(1, None)
            else:
                if session.Process.pid in _muted_sessions:
                    volume.SetMute(0, None)
                    
        if not mute:
            _muted_sessions.clear()
            
    except Exception as e:
        log.error("Failed to set audio mute state: %s", e)

transcriber = Transcriber()
_download_in_progress = False
_transcribe_executor = ThreadPoolExecutor(
    max_workers=TRANSCRIBE_EXECUTOR_WORKERS,
    thread_name_prefix="vtt-transcribe",
)


def _runtime_payload() -> dict[str, object]:
    runtime = transcriber.runtime.to_public_dict()
    runtime.update(
        {
            "profile": transcriber.get_transcription_settings().profile,
            "language_hint": transcriber.get_transcription_settings().language or "auto",
        }
    )
    return runtime


def _model_status_payload(model_name: str, status: str) -> dict[str, object]:
    return {
        "status": status,
        "model": model_name,
        "loaded_model": transcriber.loaded_model_name or None,
        "size_mb": get_model_size_mb(model_name),
        "device": transcriber.device,
        "runtime": _runtime_payload(),
        "transcription": transcriber.get_transcription_settings().to_public_dict(),
    }


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info(
        "Server started. Waiting for model commands from UI. Default model=%s, profile=%s, language_hint=%s",
        WHISPER_MODEL,
        DEFAULT_TRANSCRIPTION_PROFILE,
        DEFAULT_LANGUAGE_HINT,
    )

    if check_model_downloaded(WHISPER_MODEL):
        def _warm_load() -> None:
            try:
                transcriber.load_into_memory(WHISPER_MODEL)
            except Exception:
                log.exception("Warm load failed for default model %s", WHISPER_MODEL)

        thread = threading.Thread(target=_warm_load, daemon=True, name="vtt-warm-load")
        thread.start()

    yield
    _transcribe_executor.shutdown(wait=False, cancel_futures=False)
    log.info("Shutting down.")


app = FastAPI(title="VoiceToText Backend", lifespan=lifespan)


@app.get("/health")
async def health():
    if transcriber.is_ready:
        return JSONResponse(
            {
                "status": "ready",
                "model": transcriber.loaded_model_name,
                "device": transcriber.device,
                "runtime": _runtime_payload(),
                "transcription": transcriber.get_transcription_settings().to_public_dict(),
            }
        )
    if transcriber.is_loading:
        return JSONResponse(
            {
                "status": "loading",
                "device": transcriber.device,
                "runtime": _runtime_payload(),
                "transcription": transcriber.get_transcription_settings().to_public_dict(),
            }
        )
    return JSONResponse(
        {
            "status": "no_model",
            "device": transcriber.device,
            "runtime": _runtime_payload(),
            "transcription": transcriber.get_transcription_settings().to_public_dict(),
        }
    )


@app.get("/models")
async def list_models():
    return JSONResponse(
        {
            "default_model": WHISPER_MODEL,
            "models": list_available_models(),
        }
    )


@app.post("/api/mute")
async def api_mute():
    """Mute all other applications' audio while recording."""
    set_other_apps_mute(True)
    return JSONResponse({"status": "muted"})


@app.post("/api/unmute")
async def api_unmute():
    """Unmute all previously muted applications."""
    set_other_apps_mute(False)
    return JSONResponse({"status": "unmuted"})


@app.post("/transcription/config")
async def transcription_config(payload: dict = Body(default={})):
    profile = payload.get("profile")
    language_hint = payload.get("language_hint")

    transcriber.configure(
        profile=profile if isinstance(profile, str) else None,
        language_hint=language_hint if isinstance(language_hint, str) else None,
    )
    return JSONResponse(
        {
            "status": "ok",
            "runtime": _runtime_payload(),
            "transcription": transcriber.get_transcription_settings().to_public_dict(),
        }
    )


@app.get("/audio/enhancement-config")
async def get_audio_enhancement_config():
    """Get current audio enhancement configuration."""
    config = get_enhancement_config()
    return JSONResponse({
        "noise_gate_enabled": config.noise_gate_enabled,
        "noise_gate_threshold_db": config.noise_gate_threshold_db,
        "noise_gate_attack_ms": config.noise_gate_attack_ms,
        "noise_gate_release_ms": config.noise_gate_release_ms,
        "normalize_enabled": config.normalize_enabled,
        "normalize_target_db": config.normalize_target_db,
        "high_pass_enabled": config.high_pass_enabled,
        "high_pass_cutoff_hz": config.high_pass_cutoff_hz,
    })


@app.post("/audio/enhancement-config")
async def update_audio_enhancement_config(payload: dict = Body(default={})):
    """Update audio enhancement configuration."""
    current = get_enhancement_config()

    new_config = AudioEnhancementConfig(
        noise_gate_enabled=payload.get("noise_gate_enabled", current.noise_gate_enabled),
        noise_gate_threshold_db=float(payload.get("noise_gate_threshold_db", current.noise_gate_threshold_db)),
        noise_gate_attack_ms=float(payload.get("noise_gate_attack_ms", current.noise_gate_attack_ms)),
        noise_gate_release_ms=float(payload.get("noise_gate_release_ms", current.noise_gate_release_ms)),
        normalize_enabled=payload.get("normalize_enabled", current.normalize_enabled),
        normalize_target_db=float(payload.get("normalize_target_db", current.normalize_target_db)),
        high_pass_enabled=payload.get("high_pass_enabled", current.high_pass_enabled),
        high_pass_cutoff_hz=float(payload.get("high_pass_cutoff_hz", current.high_pass_cutoff_hz)),
    )

    set_enhancement_config(new_config)

    return JSONResponse({
        "status": "ok",
        "config": {
            "noise_gate_enabled": new_config.noise_gate_enabled,
            "noise_gate_threshold_db": new_config.noise_gate_threshold_db,
            "noise_gate_attack_ms": new_config.noise_gate_attack_ms,
            "noise_gate_release_ms": new_config.noise_gate_release_ms,
            "normalize_enabled": new_config.normalize_enabled,
            "normalize_target_db": new_config.normalize_target_db,
            "high_pass_enabled": new_config.high_pass_enabled,
            "high_pass_cutoff_hz": new_config.high_pass_cutoff_hz,
        },
    })


@app.get("/model/status")
async def model_status(model: str = WHISPER_MODEL):
    global _download_in_progress
    is_downloaded = check_model_downloaded(model)

    if transcriber.is_ready and transcriber.loaded_model_name == model:
        status = "loaded"
    elif transcriber.is_loading:
        status = "loading"
    elif _download_in_progress:
        status = "downloading"
    elif is_downloaded:
        status = "downloaded"
    else:
        status = "not_downloaded"

    return JSONResponse(_model_status_payload(model, status))


@app.post("/model/load")
async def model_load(model: str = WHISPER_MODEL):
    if transcriber.is_ready and transcriber.loaded_model_name == model:
        return JSONResponse({"status": "loaded", "model": model})

    if transcriber.is_loading:
        return JSONResponse({"status": "already_loading"}, status_code=409)

    if not check_model_downloaded(model):
        return JSONResponse(
            {"status": "error", "message": "Model not downloaded yet"},
            status_code=400,
        )

    def _load():
        transcriber.load_into_memory(model)

    thread = threading.Thread(target=_load, daemon=True)
    thread.start()

    return JSONResponse({"status": "loading", "model": model})


@app.websocket("/ws/model")
async def ws_model(ws: WebSocket):
    await ws.accept()
    log.info("Model WS client connected")

    try:
        while True:
            msg = await ws.receive_text()
            try:
                payload = json.loads(msg)
            except json.JSONDecodeError:
                payload = {"action": msg}

            action = payload.get("action", "")

            if action == "download":
                model_name = payload.get("model", WHISPER_MODEL)
                await _handle_download(ws, model_name)

            elif action == "status":
                model_name = payload.get("model", WHISPER_MODEL)
                await _send_model_status(ws, model_name)

            elif action == "load":
                model_name = payload.get("model", WHISPER_MODEL)
                await _handle_load(ws, model_name)

            elif action == "ping":
                await ws.send_json({"type": "pong"})

    except WebSocketDisconnect:
        log.info("Model WS client disconnected")
    except Exception:
        log.exception("Model WS error")


async def _send_model_status(ws: WebSocket, model_name: str):
    global _download_in_progress
    is_downloaded = check_model_downloaded(model_name)

    if transcriber.is_ready and transcriber.loaded_model_name == model_name:
        status = "loaded"
    elif transcriber.is_loading:
        status = "loading"
    elif _download_in_progress:
        status = "downloading"
    elif is_downloaded:
        status = "downloaded"
    else:
        status = "not_downloaded"

    payload = _model_status_payload(model_name, status)
    payload["type"] = "model_status"
    await ws.send_json(payload)


async def _handle_download(ws: WebSocket, model_name: str):
    global _download_in_progress

    if _download_in_progress:
        await ws.send_json({"type": "error", "message": "Download already in progress"})
        return

    if check_model_downloaded(model_name):
        await ws.send_json({"type": "download_complete", "model": model_name})
        return

    _download_in_progress = True
    loop = asyncio.get_running_loop()
    progress_queue: asyncio.Queue = asyncio.Queue()

    def on_progress(downloaded: float, total: float, rate: float, desc: str):
        try:
            loop.call_soon_threadsafe(
                progress_queue.put_nowait,
                {
                    "type": "download_progress",
                    "downloaded": downloaded,
                    "total": total,
                    "progress": round(downloaded / total, 4) if total > 0 else 0,
                    "downloaded_mb": round(downloaded / 1024 / 1024, 1),
                    "total_mb": round(total / 1024 / 1024, 1),
                    "speed_mbps": round(rate / 1024 / 1024, 1) if rate else 0,
                    "file": desc,
                },
            )
        except Exception:
            pass

    def do_download():
        global _download_in_progress
        try:
            download_model_with_progress(model_name, callback=on_progress)
            loop.call_soon_threadsafe(
                progress_queue.put_nowait,
                {"type": "download_complete", "model": model_name},
            )
        except Exception as e:
            loop.call_soon_threadsafe(
                progress_queue.put_nowait,
                {"type": "download_error", "message": str(e)},
            )
        finally:
            _download_in_progress = False

    thread = threading.Thread(target=do_download, daemon=True)
    thread.start()

    await ws.send_json({"type": "download_started", "model": model_name})

    while True:
        try:
            msg = await asyncio.wait_for(progress_queue.get(), timeout=0.3)
            await ws.send_json(msg)
            if msg["type"] in ("download_complete", "download_error"):
                break
        except asyncio.TimeoutError:
            continue
        except Exception:
            break


async def _handle_load(ws: WebSocket, model_name: str):
    if transcriber.is_ready and transcriber.loaded_model_name == model_name:
        await ws.send_json({"type": "load_complete", "model": model_name})
        return

    if transcriber.is_loading:
        await ws.send_json({"type": "error", "message": "Already loading"})
        return

    loop = asyncio.get_running_loop()
    done_event = asyncio.Event()
    result_holder: list = []

    def do_load():
        try:
            transcriber.load_into_memory(model_name)
            result_holder.append({
                "type": "load_complete",
                "model": model_name,
                "runtime": _runtime_payload(),
                "transcription": transcriber.get_transcription_settings().to_public_dict(),
            })
        except Exception as e:
            result_holder.append({"type": "load_error", "message": str(e)})
        finally:
            loop.call_soon_threadsafe(done_event.set)

    thread = threading.Thread(target=do_load, daemon=True)
    thread.start()

    await ws.send_json({
        "type": "load_started",
        "model": model_name,
        "runtime": _runtime_payload(),
        "transcription": transcriber.get_transcription_settings().to_public_dict(),
    })

    await done_event.wait()
    if result_holder:
        await ws.send_json(result_holder[0])


@app.websocket("/ws/transcribe")
async def ws_transcribe(ws: WebSocket):
    await ws.accept()
    log.info("WebSocket client connected")
    buf = AudioBuffer()

    try:
        while True:
            msg = await ws.receive()

            if msg.get("type") == "websocket.disconnect":
                break

            if "bytes" in msg and msg["bytes"]:
                buf.append(msg["bytes"])
                continue

            if "text" in msg and msg["text"]:
                try:
                    payload = json.loads(msg["text"])
                except json.JSONDecodeError:
                    payload = {"action": msg["text"]}

                action = payload.get("action", "")

                if action == "end":
                    # Check for silence before processing - use higher threshold to catch more silence
                    # 0.015 RMS threshold catches quiet recordings that would hallucinate
                    if buf.is_silence(threshold=0.015):
                        buf.clear()
                        await ws.send_json({"type": "empty", "message": "No speech detected (silence)"})
                        continue

                    audio = buf.get_audio()
                    buf.clear()

                    if len(audio) == 0:
                        await ws.send_json({"type": "error", "message": "No audio received"})
                        continue

                    if not transcriber.is_ready:
                        await ws.send_json({"type": "error", "message": "Model not loaded"})
                        continue

                    await ws.send_json({"type": "transcribing"})

                    loop = asyncio.get_running_loop()
                    try:
                        result: TranscriptionResult | None = await loop.run_in_executor(
                            _transcribe_executor, transcriber.transcribe, audio
                        )
                    except Exception:
                        log.exception("Transcription failed")
                        await ws.send_json({
                            "type": "error",
                            "message": "Transcription failed. See backend logs for details.",
                        })
                        continue

                    if result is None:
                        await ws.send_json({"type": "empty", "message": "No speech detected"})
                    else:
                        await ws.send_json({"type": "result", **asdict(result)})

                elif action == "cancel":
                    buf.clear()
                    await ws.send_json({"type": "cancelled"})

                elif action == "ping":
                    await ws.send_json({"type": "pong"})

    except WebSocketDisconnect:
        log.info("WebSocket client disconnected")
    except Exception:
        log.exception("WebSocket error")
    finally:
        buf.clear()
        log.info("WebSocket session cleaned up")


def _check_port_available(port: int) -> bool:
    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind(("127.0.0.1", port))
        sock.close()
        return True
    except OSError:
        sock.close()
        return False


if __name__ == "__main__":
    if not _check_port_available(SERVER_PORT):
        log.error(
            "Port %d is already in use. Another VTT backend may be running. "
            "Stop it first or use VTT_PORT env var to pick a different port.",
            SERVER_PORT,
        )
        raise SystemExit(1)

    uvicorn.run(
        "server:app",
        host=SERVER_HOST,
        port=SERVER_PORT,
        log_level="info",
        ws_ping_interval=30,
        ws_ping_timeout=60,
    )
