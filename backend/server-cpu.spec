# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for VoiceToText backend server - CPU only version.
Creates a smaller distribution without CUDA dependencies.
"""

import os
import sys
from pathlib import Path

block_cipher = None

# Get the backend directory
backend_dir = Path(SPECPATH)

# Hidden imports - exclude CUDA-specific modules
hiddenimports = [
    'faster_whisper',
    'ctranslate2',
    'huggingface_hub',
    'tokenizers',
    'tqdm',
    'tqdm.auto',
    'uvicorn',
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'fastapi',
    'starlette',
    'anyio',
    'websockets',
    'pycaw',
    'pycaw.pycaw',
    'comtypes',
    'numpy',
    'av',
]

a = Analysis(
    ['server.py'],
    pathex=[str(backend_dir)],
    binaries=[],
    datas=[],
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'matplotlib',
        'PIL',
        'scipy',
        'pandas',
        'pytest',
        'sphinx',
        # Exclude CUDA/GPU packages
        'nvidia',
        'nvidia.cublas',
        'nvidia.cudnn',
        'nvidia.cuda_runtime',
        'nvidia.cuda_nvrtc',
        'torch',
        'tensorflow',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

# Remove CUDA binaries from collection
cuda_patterns = ['cublas', 'cudnn', 'nvrtc', 'cuda', 'nvidia']

def is_cuda_binary(name):
    name_lower = name.lower()
    return any(pattern in name_lower for pattern in cuda_patterns)

a.binaries = [(name, path, typ) for name, path, typ in a.binaries if not is_cuda_binary(name)]

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='vtt-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='vtt-backend',
)
