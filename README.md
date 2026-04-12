# VoiceToText

Local voice-to-text desktop application with real-time transcription. Runs entirely on your machine using Whisper Large-V3.

Hold a hotkey, speak, release. Your words appear wherever you're typing.

## Features

**Core**
- Local Whisper transcription (no cloud, no API keys required for basic use)
- Push-to-Talk or Toggle-to-Talk modes
- Auto-paste into any application
- 99 language support with automatic detection

**Transcription Quality**
- Multiple Whisper model sizes (tiny to large-v3)
- Configurable transcription profiles (fast/balanced/accurate)
- Smart text formatting (capitalization, punctuation)
- Keyword auto-correction dictionary
- Hallucination filtering for cleaner output

**AI Refinement (Optional)**
- Gemini API integration for grammar polish
- Context templates for domain-specific refinement
- Code mode to bypass AI processing
- Similarity checking to prevent over-correction

**Interface**
- Minimal overlay indicator
- Full settings panel with 12 configuration tabs
- Transcription history with search
- Analytics dashboard
- Custom accent colors and themes

**Developer Features**
- Voice commands for hands-free control
- Export to TXT, JSON, SRT formats
- Keyboard shortcut customization
- Cross-platform: Windows, macOS, Linux

## System Requirements

- Windows 10+, macOS 11+, or Linux (X11/Wayland)
- 8GB RAM minimum (16GB recommended for large models)
- NVIDIA GPU optional (CUDA acceleration, 4GB+ VRAM for large-v3)

## Installation

### From Release

Download the latest release for your platform from the [Releases](../../releases) page.

### From Source

**Prerequisites:**
- Node.js 20+
- Python 3.10+
- npm or yarn

**Setup:**

```bash
# Clone repository
git clone https://github.com/your-username/voicetotext.git
cd voicetotext

# Install frontend dependencies
npm install

# Setup Python backend
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
cd ..
```

**Run in development:**

```bash
npm run dev
```

This starts both the Python backend and Electron frontend. The overlay appears in the top-right corner.

**Build for production:**

```bash
npm run electron:build
```

Built packages appear in the `release/` directory.

## Usage

### Basic Operation

1. **First Launch**: Download a Whisper model from Settings > Engine
2. **Record**: Hold `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
3. **Release**: Text transcribes and pastes into your active window

### Hotkeys

| Action | Default | Notes |
|--------|---------|-------|
| Record | `Ctrl+Shift+R` | Hold for PTT, press for Toggle mode |
| Cancel | `Escape` | Cancels current recording |
| Code Mode | `Ctrl+Shift+C` | Toggle AI refinement bypass |

Customize in Settings > Shortcuts.

### Voice Commands

Prefix commands with "voice" or "vtt":
- "voice open settings"
- "vtt switch to push to talk"
- "voice clear history"

Full command list in Settings > Shortcuts.

### Language Selection

Settings > Engine > Language. Set to "Auto-detect" for automatic detection, or select a specific language for improved accuracy.

### AI Refinement

Optional. Requires a Gemini API key (free tier available).

1. Get a key at [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Paste in Settings > Engine > API Key
3. Enable "Cloud Refinement"

Refinement polishes grammar and punctuation while preserving your original meaning. Use Context Templates for specialized domains.

## Configuration

Settings are stored in:
- Windows: `%APPDATA%/voicetotext/settings.json`
- macOS: `~/Library/Application Support/voicetotext/settings.json`
- Linux: `~/.config/voicetotext/settings.json`

Transcription history is stored alongside settings.

## Architecture

| Layer | Technology |
|-------|------------|
| Speech-to-text | faster-whisper (CTranslate2) |
| Backend | FastAPI + WebSocket |
| Desktop | Electron 34 |
| Frontend | React 19, TypeScript |
| Audio | Web Audio API, 16kHz mono |

The Python backend runs locally and handles all transcription. Audio streams from the Electron frontend via WebSocket. No audio data leaves your machine unless AI refinement is enabled.

## Troubleshooting

**Model fails to load**
- Check available RAM (large-v3 needs ~6GB)
- Try a smaller model first
- On GPU: ensure CUDA toolkit is installed

**Transcription cuts off**
- VAD is disabled by design to capture complete speech
- Check microphone input levels
- Try the "accurate" profile for difficult audio

**Paste not working**
- Grant accessibility permissions (macOS)
- Check focus is on an editable field
- Try disabling auto-paste and copying manually

**High CPU usage**
- Normal during transcription
- Use smaller models on weaker hardware
- GPU acceleration significantly reduces CPU load

## Development

```bash
# Run tests
npm test

# Type check
npm run typecheck

# Watch mode tests
npm run test:watch
```

## License

MIT
