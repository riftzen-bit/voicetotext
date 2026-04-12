# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for VoiceToText backend server.
Creates a single-folder distribution for the Python backend.
"""

import os
import sys
from pathlib import Path

block_cipher = None

# Get the backend directory
backend_dir = Path(SPECPATH)
venv_site_packages = backend_dir / ".venv" / "Lib" / "site-packages"

# Collect all hidden imports needed by faster-whisper and dependencies
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

# Data files to include
datas = []

# CUDA runtime DLLs - include from nvidia packages
nvidia_packages = [
    'nvidia/cublas/bin',
    'nvidia/cudnn/bin',
    'nvidia/cuda_runtime/bin',
    'nvidia/cuda_nvrtc/bin',
]

for pkg_path in nvidia_packages:
    full_path = venv_site_packages / pkg_path
    if full_path.exists():
        for dll_file in full_path.glob('*.dll'):
            datas.append((str(dll_file), '.'))

# Include ctranslate2 libraries
ct2_path = venv_site_packages / 'ctranslate2'
if ct2_path.exists():
    for dll_file in ct2_path.glob('*.dll'):
        datas.append((str(dll_file), 'ctranslate2'))

a = Analysis(
    ['server.py'],
    pathex=[str(backend_dir)],
    binaries=[],
    datas=datas,
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
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

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
