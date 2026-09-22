<div align="center">

# 🤖 TEJA AI — Futuristic Personal Desktop AI Assistant

<img src="public/favicon.svg" width="120" alt="TEJA AI Logo" />

**A real, voice-controlled AI assistant that lives on your Windows PC and can control your computer.**

[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tauri](https://img.shields.io/badge/Tauri-2-FFC131?style=for-the-badge&logo=tauri&logoColor=black)](https://v2.tauri.app)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![Windows](https://img.shields.io/badge/Platform-Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white)](https://www.microsoft.com/windows)

> *"I have my own AI living on my PC."*

</div>

---

## ✨ What Makes This Different

Most "AI assistants" on GitHub are just chat wrappers. **TEJA AI actually controls your computer:**

- 🎙️ **Talk to it** → It listens using your microphone in real time
- 🧠 **It thinks** → Powered by Groq's ultra-fast LLM inference
- 🖥️ **It acts** → Opens apps, scrolls pages, types text, clicks, focuses windows
- 🔊 **It responds** → Speaks back with a natural voice

---

## 🎨 Futuristic UI

The interface is designed to feel like a sci-fi HUD:

| State | Look |
|-------|------|
| **IDLE** | Cyan/blue orb with slow breathing, rotating rings, orbital dots |
| **LISTENING** | Orb scales with your voice — live audio-reactive waveform |
| **THINKING** | Orbiting particles, purple glow |
| **SPEAKING** | Amber/gold animated waveform synced to voice |
| **ERROR** | Red alert with Retry/Dismiss |

Glassmorphism panels · Spring animations · Sci-fi HUD grid · Neon glow effects

---

## 🛠️ What TEJA Can Do

### Voice & Chat
- 🎙️ Click orb / mic button / **Ctrl+Space** to start talking
- 💬 Type if you prefer (full chat mode)
- 🔊 Speaks responses back in a natural voice
- 🔁 Continuous live conversation mode

### Web & Apps
| Command | What Happens |
|---------|-------------|
| *"Open YouTube"* | Opens YouTube in your browser |
| *"Search for lofi music on YouTube"* | Opens YouTube with search results |
| *"Google how to make pasta"* | Opens Google search |
| *"Open Calculator"* | Launches Windows Calculator |
| *"Open Notepad"* | Launches Notepad |
| *"Open Chrome"* | Launches Google Chrome |
| *"Open VS Code"* | Opens VS Code + File Explorer |

### Computer Control (Windows)
| Command | What Happens |
|---------|-------------|
| *"Scroll down"* | Scrolls the active window down |
| *"Scroll up 5 times"* | Scrolls up 5 clicks |
| *"Type hello world"* | Types text into the focused window |
| *"Press Enter"* | Presses the Enter key |
| *"Press Ctrl+C"* | Copies selected text |
| *"Focus Chrome"* | Brings Chrome to front |
| *"Minimize Notepad"* | Minimizes the window |
| *"Close Calculator"* | Closes the app |
| *"Click at 500 300"* | Clicks at screen coordinates |
| *"What apps are open?"* | Lists all running apps |

### Screen Vision (requires OpenRouter key)
| Command | What Happens |
|---------|-------------|
| *"What's on my screen?"* | AI analyzes and describes your screen |
| *"Click the search box"* | AI finds and clicks it using vision |
| *"Start live screen"* | Continuous live screen monitoring |

### Calculations
| Command | What Happens |
|---------|-------------|
| *"Calculate 98 plus 77"* | Opens Calculator and types the expression |
| *"What is 15% of 200?"* | Calculates and shows result |

---

## ⌨️ Keyboard Shortcuts

| Keys | Action |
|------|--------|
| **Ctrl+Space** | Start listening (or interrupt speech) |
| **Esc** | Cancel everything → return to idle |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **A Groq API Key** (free) — [console.groq.com/keys](https://console.groq.com/keys)
- **Windows 10/11** — for desktop control features
- **Chrome, Edge, or Brave** — for voice support

### Web Preview (Quickest)

```bash
# 1. Clone the repo
git clone https://github.com/TejaPriyan/Teja-Ai-Assistant.git
cd Teja-Ai-Assistant

# 2. Install dependencies
npm install

# 3. Set up your API key
cp .env.example .env
# Edit .env and add your Groq API key

# 4. Run
npm run dev

# 5. Open in Chromium-based browser (Chrome/Edge/Brave)
# Voice support requires Chromium
open http://localhost:1420
```

### Desktop App (Tauri — Windows .exe)

```bash
# Requires Rust: https://rustup.rs
# Requires Tauri prerequisites: https://v2.tauri.app/start/prerequisites/

npm run tauri:dev      # Development desktop app
npm run tauri:build    # Build production .exe / installer
```

Windows installer output: `src-tauri/target/release/bundle/`

---

## 🔑 API Key Setup

Create a `.env` file in the project root (see `.env.example`):

```env
# Required — get free at https://console.groq.com/keys
VITE_GROQ_API_KEY=gsk_your_key_here

# Optional — for screen vision features (analyze_and_click, capture_screen)
# Get free at https://openrouter.ai
VITE_OPENROUTER_API_KEY=sk-or-v1-your_key_here
```

> ⚠️ **Never commit your `.env` file to git.** It's already in `.gitignore`.

---

## 🤖 AI Models

Configure in the **Settings** panel (gear icon ⚙️):

| Model | Speed | Capability |
|-------|-------|-----------|
| `openai/gpt-oss-20b` | ⚡⚡⚡ Fast | **Default** — great for tools & commands |
| `openai/gpt-oss-120b` | ⚡⚡ Medium | More capable, better reasoning |
| `qwen/qwen3.8-27b` | ⚡⚡⚡ Fast | Good alternative |
| `groq/compound-mini` | ⚡⚡⚡⚡ Fastest | Quick responses |

---

## 🏗️ Architecture

```
TEJA-AI/
├── src/
│   ├── App.tsx                     # Main UI layout & state wiring
│   ├── components/
│   │   ├── AIOrb.tsx               # Animated central orb (requestAnimationFrame)
│   │   ├── ChatPanel.tsx           # Chat interface with typing indicator
│   │   ├── HistoryPanel.tsx        # Command history (last 50)
│   │   ├── LiveScreenMonitor.tsx   # Live screen stream overlay
│   │   ├── SettingsPanel.tsx       # Settings: AI / Voice / Appearance / Privacy
│   │   ├── StatusPanel.tsx         # Status badges: MIC/SPEAKER/AI/WEB/MEMORY
│   │   └── SystemPanel.tsx         # Live CPU/RAM/FPS stats
│   ├── hooks/
│   │   └── useAssistant.ts         # Core orchestrator: STT → AI → TTS → Tools
│   ├── services/
│   │   ├── ai.ts                   # Groq LLM + tool calling + fallback intent
│   │   ├── computerControl.ts      # Mouse/keyboard API wrapper
│   │   ├── screenCapture.ts        # Screen capture & vision analysis
│   │   ├── speechToText.ts         # Web Speech API + audio level monitoring
│   │   ├── textToSpeech.ts         # Web Speech Synthesis + voice selection
│   │   ├── tools.ts                # All 18 tool executors
│   │   └── wakeWord.ts             # Wake word detection
│   ├── store/
│   │   └── TejaContext.tsx         # React Context global state
│   └── types/
│       └── index.ts                # TypeScript type definitions
├── scripts/
│   └── desktopBridge.ps1           # PowerShell + C# bridge for Win32 APIs
├── src-tauri/                      # Rust/Tauri desktop backend
│   ├── capabilities/default.json   # Tauri permission config
│   └── src/lib.rs                  # Tauri entry point
├── public/                         # Static assets
├── .env.example                    # Environment variable template
├── vite.config.ts                  # Vite config + API middleware (system bridge)
└── package.json
```

### How It Works — The Full Loop

```
User speaks
    → Web Speech API (STT) → transcript text
    → Groq LLM (with 18 tool definitions) → tool call or text
    → Tool executor (tools.ts)
         → if web/app: window.open / process.spawn
         → if mouse/keyboard: fetch /api/system/mouse or /api/system/keyboard
              → Vite middleware → PowerShell → C# Win32 API
         → if vision: screen capture → OpenRouter vision model → coordinates → click
    → Text-to-Speech (Web Speech Synthesis) → voice response
    → Orb animates to match state
```

---

## ⚙️ Technical Details

### Desktop Control Bridge
Mouse scroll, clicks, keyboard input, and window control use a **PowerShell + C# bridge**:
- The Vite dev server exposes local REST endpoints (`/api/system/mouse`, `/api/system/keyboard`, etc.)
- These call `scripts/desktopBridge.ps1` which compiles C# code via `Add-Type` and calls Win32 APIs directly
- **Uses the same APIs** as professional computer-use frameworks: `mouse_event()`, `SendKeys()`, `SetCursorPos()`

### Voice
- **Speech-to-Text**: Browser Web Speech API (requires Chrome/Edge/Brave, no cloud, free)
- **Text-to-Speech**: Browser Speech Synthesis API (no cloud, free)
- **Wake Word**: Custom lightweight wake word detector

### AI
- **Primary**: Groq API (very fast inference, generous free tier)
- **Vision**: OpenRouter (free models: Gemma 4, Qwen 3)
- **Tool Calling**: Standard OpenAI-compatible function calling format

---

## 🔒 Privacy

- ✅ Voice processing stays in your browser (Web Speech API — no audio leaves your PC)
- ✅ TTS is generated locally in your browser
- ⚠️ Your text query is sent to Groq's servers for AI processing
- ⚠️ Screenshots are sent to OpenRouter only if you use screen vision features
- ✅ No data is stored on any server — no accounts, no tracking

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -m "Add: my feature"`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

### Ideas for Contributions
- 🍎 **macOS support** — replace PowerShell bridge with AppleScript/shell
- 🐧 **Linux support** — xdotool/wmctrl integration
- 🔗 **Multi-step agent loop** — chain multiple tool calls automatically
- 🧠 **Persistent memory** — remember things across sessions
- 🔌 **Plugin system** — add custom tools without editing source

---

## 📋 Troubleshooting

**Voice not working?**
→ Use Chrome, Edge, or Brave (not Firefox). Make sure microphone permission is granted.

**Computer control not working?**
→ Desktop control only works on Windows. The Vite dev server must be running (`npm run dev`).

**Popup blocked when opening websites?**
→ Click the "Open tab" banner that appears at the top of the TEJA UI.

**Groq error / rate limit?**
→ The free Groq tier has limits. Wait a few seconds and try again, or upgrade your plan.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

Free to use, modify, and distribute. Attribution appreciated.

---

<div align="center">

Built with ❤️ by [Teja Priyan](https://github.com/TejaPriyan)

⭐ **Star this repo** if you find it useful!

</div>
