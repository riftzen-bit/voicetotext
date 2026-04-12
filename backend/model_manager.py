from __future__ import annotations

import logging
from typing import Callable, Optional

import huggingface_hub
from tqdm.auto import tqdm

log = logging.getLogger(__name__)

MODEL_SIZES_MB = {
    "tiny": 75,
    "tiny.en": 75,
    "base": 142,
    "base.en": 142,
    "small": 466,
    "small.en": 244,
    "medium": 1500,
    "medium.en": 769,
    "large-v3": 3100,
    "large-v2": 3100,
    "large-v1": 3100,
    "distil-large-v3": 1500,
    "distil-large-v2": 1500,
    "distil-medium.en": 800,
    "distil-small.en": 330,
}

_MODELS = {
    "tiny.en": "Systran/faster-whisper-tiny.en",
    "tiny": "Systran/faster-whisper-tiny",
    "base.en": "Systran/faster-whisper-base.en",
    "base": "Systran/faster-whisper-base",
    "small.en": "Systran/faster-whisper-small.en",
    "small": "Systran/faster-whisper-small",
    "medium.en": "Systran/faster-whisper-medium.en",
    "medium": "Systran/faster-whisper-medium",
    "large-v1": "Systran/faster-whisper-large-v1",
    "large-v2": "Systran/faster-whisper-large-v2",
    "large-v3": "Systran/faster-whisper-large-v3",
    "large": "Systran/faster-whisper-large-v3",
    "distil-large-v2": "Systran/faster-distil-whisper-large-v2",
    "distil-large-v3": "Systran/faster-distil-whisper-large-v3",
    "distil-medium.en": "Systran/faster-distil-whisper-medium.en",
    "distil-small.en": "Systran/faster-distil-whisper-small.en",
}

REQUIRED_FILES = [
    "config.json",
    "model.bin",
    "tokenizer.json",
    "vocabulary.*",
]

ProgressCallback = Callable[[float, float, float, str], None]

MODEL_CATALOG = [
    {
        "value": "large-v3",
        "label": "large-v3",
        "description": "Best accuracy, multilingual",
        "size_mb": MODEL_SIZES_MB["large-v3"],
        "recommended": True,
    },
    {
        "value": "distil-large-v3",
        "label": "distil-large-v3",
        "description": "Faster large multilingual model",
        "size_mb": MODEL_SIZES_MB["distil-large-v3"],
        "recommended": True,
    },
    {
        "value": "medium",
        "label": "medium",
        "description": "Balanced speed and quality",
        "size_mb": MODEL_SIZES_MB["medium"],
        "recommended": True,
    },
    {
        "value": "small",
        "label": "small",
        "description": "Fast multilingual model",
        "size_mb": MODEL_SIZES_MB["small"],
        "recommended": True,
    },
    {
        "value": "base",
        "label": "base",
        "description": "Very lightweight multilingual model",
        "size_mb": MODEL_SIZES_MB["base"],
        "recommended": False,
    },
    {
        "value": "tiny",
        "label": "tiny",
        "description": "Fastest multilingual option",
        "size_mb": MODEL_SIZES_MB["tiny"],
        "recommended": False,
    },
    {
        "value": "distil-medium.en",
        "label": "distil-medium.en",
        "description": "English-only speed-focused model",
        "size_mb": MODEL_SIZES_MB["distil-medium.en"],
        "recommended": False,
    },
    {
        "value": "distil-small.en",
        "label": "distil-small.en",
        "description": "Smallest English-only speed option",
        "size_mb": MODEL_SIZES_MB["distil-small.en"],
        "recommended": False,
    },
]


class _ProgressTqdm(tqdm):
    _callback: Optional[ProgressCallback] = None

    def __init__(self, *args, **kwargs):
        self._callback = kwargs.pop("callback", None)
        kwargs["disable"] = False
        super().__init__(*args, **kwargs)

    def update(self, n=1):
        super().update(n)
        if self._callback and self.total and self.total > 0:
            downloaded = self.n
            total = self.total
            rate = self.format_dict.get("rate", 0) or 0
            elapsed = self.format_dict.get("elapsed", 0) or 0
            desc = str(self.desc or "")
            self._callback(downloaded, total, rate, desc)


def _make_tqdm_class(callback: Optional[ProgressCallback]):
    if callback is None:
        return None

    class _Cls(_ProgressTqdm):
        def __init__(self, *args, **kwargs):
            kwargs["callback"] = callback
            super().__init__(*args, **kwargs)

    return _Cls


def get_repo_id(model_name: str) -> str:
    if "/" in model_name:
        return model_name
    repo = _MODELS.get(model_name)
    if repo is None:
        raise ValueError(f"Unknown model: {model_name}")
    return repo


def get_model_size_mb(model_name: str) -> int:
    return MODEL_SIZES_MB.get(model_name, 0)


def list_available_models() -> list[dict[str, object]]:
    return [dict(model) for model in MODEL_CATALOG]


def check_model_downloaded(model_name: str) -> bool:
    repo_id = get_repo_id(model_name)
    try:
        cache_info = huggingface_hub.scan_cache_dir()
        for repo in cache_info.repos:
            if repo.repo_id == repo_id:
                for rev in repo.revisions:
                    files = {f.file_name for f in rev.files}
                    if "model.bin" in files and "config.json" in files:
                        return True
        return False
    except Exception:
        return False


def get_model_path_if_cached(model_name: str) -> Optional[str]:
    repo_id = get_repo_id(model_name)
    try:
        cache_info = huggingface_hub.scan_cache_dir()
        for repo in cache_info.repos:
            if repo.repo_id == repo_id:
                for rev in repo.revisions:
                    files = {f.file_name for f in rev.files}
                    if "model.bin" in files and "config.json" in files:
                        return str(rev.snapshot_path)
        return None
    except Exception:
        return None


def download_model_with_progress(
    model_name: str,
    callback: Optional[ProgressCallback] = None,
) -> str:
    repo_id = get_repo_id(model_name)
    log.info("Downloading model %s (%s)…", model_name, repo_id)

    allow_patterns = [
        "config.json",
        "preprocessor_config.json",
        "model.bin",
        "tokenizer.json",
        "vocabulary.*",
    ]

    kwargs = {
        "allow_patterns": allow_patterns,
        "revision": None,
    }

    tqdm_cls = _make_tqdm_class(callback)
    if tqdm_cls is not None:
        kwargs["tqdm_class"] = tqdm_cls

    path = huggingface_hub.snapshot_download(repo_id, **kwargs)
    log.info("Model downloaded to %s", path)
    return path
