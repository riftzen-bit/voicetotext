import ctypes
import logging
import os
import sys
from dataclasses import dataclass
from pathlib import Path

log = logging.getLogger(__name__)

TRANSCRIPTION_PROFILES = ("fast", "balanced", "accurate")

_CUDA_RUNTIME_LIBRARIES = {
    "nt": ("cublas64_12.dll", "cudnn64_9.dll"),
    "posix": ("libcublas.so.12", "libcudnn.so.9"),
}

WHISPER_MODEL = os.environ.get("VTT_MODEL", "base")
# GPU is MANDATORY. Default device is cuda; compute defaults to float16
# (Tensor Core path on Ada/Ampere). CPU fallback is intentionally removed —
# loading on CPU silently turned a 2s transcription into 30-60s.
WHISPER_DEVICE = os.environ.get("VTT_DEVICE", "cuda").strip().lower() or "cuda"
_compute_env = os.environ.get("VTT_COMPUTE_TYPE", "").strip().lower()
WHISPER_COMPUTE_TYPE = _compute_env or ("float16" if WHISPER_DEVICE != "cpu" else "int8")

DEFAULT_TRANSCRIPTION_PROFILE = (
    os.environ.get("VTT_TRANSCRIPTION_PROFILE", "balanced").strip().lower() or "balanced"
)
if DEFAULT_TRANSCRIPTION_PROFILE not in TRANSCRIPTION_PROFILES:
    log.warning(
        "Unknown transcription profile %s. Falling back to balanced.",
        DEFAULT_TRANSCRIPTION_PROFILE,
    )
    DEFAULT_TRANSCRIPTION_PROFILE = "balanced"

DEFAULT_LANGUAGE_HINT = os.environ.get("VTT_LANGUAGE_HINT", "auto").strip().lower() or "auto"
TRANSCRIBE_EXECUTOR_WORKERS = max(1, int(os.environ.get("VTT_TRANSCRIBE_WORKERS", "1")))

SERVER_HOST = os.environ.get("VTT_HOST", "127.0.0.1")
SERVER_PORT = int(os.environ.get("VTT_PORT", "8769"))

SAMPLE_RATE = 16000
CHANNELS = 1

MIN_AUDIO_LENGTH = 0.3  # seconds – ignore very short bursts
# Default 2 h cap; override with VTT_MAX_AUDIO_LENGTH (seconds).
# Short caps silently drop late chunks in AudioBuffer and lose user context.
MAX_AUDIO_LENGTH = max(60, int(os.environ.get("VTT_MAX_AUDIO_LENGTH", "7200")))


def _register_windows_cuda_runtime_dirs() -> None:
    if os.name != "nt" or not hasattr(os, "add_dll_directory"):
        return

    candidate_dirs: list[Path] = []

    # PyInstaller bundle: DLLs live under _MEIPASS / _internal
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        internal = Path(meipass)
        candidate_dirs.append(internal)
        candidate_dirs.append(internal / "nvidia" / "cublas" / "bin")
        candidate_dirs.append(internal / "nvidia" / "cudnn" / "bin")
        candidate_dirs.append(internal / "nvidia" / "cuda_runtime" / "bin")
        candidate_dirs.append(internal / "nvidia" / "cuda_nvrtc" / "bin")
        candidate_dirs.append(internal / "ctranslate2")

    # Dev mode: DLLs in .venv site-packages
    site_packages_dir = Path(__file__).resolve().parent / ".venv" / "Lib" / "site-packages"
    candidate_dirs.extend([
        site_packages_dir / "nvidia" / "cublas" / "bin",
        site_packages_dir / "nvidia" / "cudnn" / "bin",
        site_packages_dir / "nvidia" / "cuda_runtime" / "bin",
        site_packages_dir / "nvidia" / "cuda_nvrtc" / "bin",
    ])

    for runtime_dir in candidate_dirs:
        if runtime_dir.is_dir():
            try:
                os.add_dll_directory(str(runtime_dir))
            except OSError:
                pass


_register_windows_cuda_runtime_dirs()


@dataclass(frozen=True)
class RuntimeDiagnostics:
    requested_device: str
    resolved_device: str
    compute_type: str
    has_cuda_driver: bool
    gpu_ready: bool
    missing_runtime_libraries: tuple[str, ...]
    runtime_issue: str | None

    def to_public_dict(self) -> dict[str, object]:
        return {
            "requested_device": self.requested_device,
            "resolved_device": self.resolved_device,
            "compute_type": self.compute_type,
            "has_cuda_driver": self.has_cuda_driver,
            "gpu_ready": self.gpu_ready,
            "missing_runtime_libraries": list(self.missing_runtime_libraries),
            "runtime_issue": self.runtime_issue,
        }


def _library_available(name: str) -> bool:
    try:
        if os.name == "nt":
            ctypes.WinDLL(name)
        else:
            ctypes.CDLL(name)
        return True
    except OSError:
        return False


def _cuda_available() -> bool:
    driver_name = "nvcuda.dll" if os.name == "nt" else "libcuda.so.1"
    return _library_available(driver_name)


def _missing_cuda_runtime_libraries() -> tuple[str, ...]:
    runtime_libraries = _CUDA_RUNTIME_LIBRARIES.get(os.name, ())
    return tuple(name for name in runtime_libraries if not _library_available(name))


def _detect_runtime() -> RuntimeDiagnostics:
    requested_device = WHISPER_DEVICE

    # Explicit CPU override is the only path that resolves to CPU. Default
    # behaviour for "cuda" or anything non-cpu is to commit to CUDA so a
    # missing driver / DLL surfaces as a hard load error instead of a
    # silent CPU degrade.
    if requested_device == "cpu":
        log.warning("VTT_DEVICE=cpu requested. GPU acceleration disabled.")
        return RuntimeDiagnostics(
            requested_device="cpu",
            resolved_device="cpu",
            compute_type=WHISPER_COMPUTE_TYPE,
            has_cuda_driver=False,
            gpu_ready=False,
            missing_runtime_libraries=(),
            runtime_issue=None,
        )

    has_cuda_driver = _cuda_available()
    missing_runtime_libraries = _missing_cuda_runtime_libraries() if has_cuda_driver else ()

    if not has_cuda_driver or missing_runtime_libraries:
        # Build a precise diagnostic so the failure is debuggable, but DO
        # NOT fall back to CPU. The user mandates GPU-only; resolving cuda
        # here lets WhisperModel raise the real CUDA error at load time.
        reason_parts = []
        if not has_cuda_driver:
            reason_parts.append("NVIDIA driver (nvcuda) not loadable")
        if missing_runtime_libraries:
            reason_parts.append(
                "missing CUDA runtime libraries: " + ", ".join(missing_runtime_libraries)
            )
        issue = (
            "GPU REQUIRED but CUDA not ready (" + "; ".join(reason_parts) + "). "
            "Install CUDA Toolkit 12.x and cuDNN 9.x, or set VTT_DEVICE=cpu to "
            "explicitly opt out of GPU acceleration."
        )
        log.error(issue)
        return RuntimeDiagnostics(
            requested_device=requested_device,
            resolved_device="cuda",
            compute_type=WHISPER_COMPUTE_TYPE,
            has_cuda_driver=has_cuda_driver,
            gpu_ready=False,
            missing_runtime_libraries=missing_runtime_libraries,
            runtime_issue=issue,
        )

    log.info("CUDA available: True (compute_type=%s)", WHISPER_COMPUTE_TYPE)
    return RuntimeDiagnostics(
        requested_device=requested_device,
        resolved_device="cuda",
        compute_type=WHISPER_COMPUTE_TYPE,
        has_cuda_driver=True,
        gpu_ready=True,
        missing_runtime_libraries=(),
        runtime_issue=None,
    )


_RUNTIME_DIAGNOSTICS = _detect_runtime()


def get_runtime_diagnostics() -> RuntimeDiagnostics:
    return _RUNTIME_DIAGNOSTICS


def resolve_device() -> str:
    return _RUNTIME_DIAGNOSTICS.resolved_device
