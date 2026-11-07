<div align="center">

<img src="docs/assets/banner.png" alt="Jarvis-Edge — the local-first executive command center" width="100%" />

# ⚡ Jarvis-Edge

### A Jarvis that runs on *your* machine — Ollama models, voice control, a second brain, and a worker swarm that never acts without your approval.

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Stack](https://img.shields.io/badge/Stack-TypeScript%20%7C%20Python%20%7C%20Docker-orange)](https://github.com/EdgeAgent/jarvis-edge)
[![AI Cost](https://img.shields.io/badge/AI%20API%20cost-%240%20%2F%20month-3ddc97)](#)
[![Local First](https://img.shields.io/badge/Privacy-100%25%20local-39d5e8)](#)

</div>

---

## 🌌 Why Jarvis-Edge exists

Most "AI assistants" rent you your own intelligence — a monthly toll on every
thought. Jarvis-Edge takes the other road: **free local models via Ollama, a
voice interface in the browser, your documents as a second brain, and one
hard rule — nothing is ever sent, posted, traded, or booked without a human
approving it first.**

The result is an executive command center you can run tonight, on hardware
you already own, for **$0/month in AI API costs**.

## 🖥️ The Console

<img src="docs/assets/console-desktop-live.png" alt="Jarvis-Edge console — reactor core, worker swarm, approval queue" width="100%" />

| | |
| :--- | :--- |
| **Reactor Core visual** | A living canvas reactor that breathes with Jarvis — standby, listening, thinking, and speaking each carry their own state and colour. |
| **Local model rail** | Every model Ollama reports, listed with sizes. Tap to switch brains mid-conversation. Online/offline state is shown honestly, with the exact fix when Ollama is down. |
| **Voice control** | Push-to-talk plus an optional **"Jarvis" wake word**, and spoken replies in your choice of system voice (Chrome / Edge speech stack). |
| **Second brain** | Drop in `.md`, `.txt`, `.json`, `.csv`, `.log` files — chunked, indexed, and retrieved into answers on demand. Files never leave the device. |
| **Worker swarm** | Reactor Core router, Voice, Second Brain, Executive (email), Trading, and Meetings — each card reports its *real* state, including "not wired yet" where that's the truth. |
| **Approval queue** | Email drafts, reminders, and worker output wait here. Approve or dismiss — **the queue is the gate**, and approved items still stay local until you act on them. |
| **Command router** | `help` · `status` · `switch to <model>` · `draft email to … about …` · `note …` · `remind me …` — everything else streams from the active local model. |

<img src="docs/assets/console-mobile.png" alt="Jarvis-Edge console on mobile" width="300" />

## 🚀 Quick start

```bash
# 1 — install Ollama (ollama.com), pull a model, allow browser access
ollama pull llama3.1:8b
OLLAMA_ORIGINS=* ollama serve

# 2 — run the console
cd console
npm install
npm run dev        # http://127.0.0.1:5173
```

Full setup and operator notes: **[docs/CONSOLE.md](docs/CONSOLE.md)**.

## 🏗️ Architecture

```mermaid
flowchart LR
    U["Operator"] -->|voice / commands| C["Console<br/>Reactor UI · Router · Queue"]
    C -->|chat · model list| O["Ollama<br/>local models — $0 APIs"]
    C -->|retrieve| B["Second Brain<br/>local files, local index"]
    C -->|drafts wait for approval| Q["Approval Queue<br/>nothing sends itself"]
    C -.->|MCP tool registry| R["Reactor Core (index.ts)<br/>worker swarm routing"]
    R -.-> W["Workers<br/>Trading · Executive · Meetings · Voice"]
```

| Component | Role | Status |
| :--- | :--- | :--- |
| **Console** (`console/`) | The operator interface described above | ✅ Working — verified end-to-end (router, queue, streaming chat, voice stack detection) |
| **Reactor Core** (`index.ts`) | MCP server that aggregates worker tools behind one interface, with a command whitelist and strict-mode approval flag | ⚠️ Skeleton — registry and gating in place, workers attach over time |
| **Browser Observer** (`server.py`) | FastAPI worker intended to audit browser sandboxes | 🧪 Stub — returns simulated audit values; not yet wired to the console |

## 📍 Roadmap

- Wire the Reactor Core's MCP registry into the console (workers become live services, not panels)
- Google Calendar for the Meetings worker (briefings + scheduling drafts to the queue)
- Local Whisper/Vosk voice option for a fully offline speech stack
- Real browser-observer implementation behind `server.py`
- One-command Docker stack (`docker-compose.yml`) for console + core

## 🔒 The standing rules

1. **Local first.** Models and memory run on the operator's machine.
2. **Approval is immutable.** No send, post, trade, or booking happens without a human yes — in the queue, every time.
3. **Honest states.** A worker that isn't connected says so, on its own card, in plain language.

## 📄 License

Apache 2.0 — see [LICENSE](https://opensource.org/licenses/Apache-2.0).

<div align="center">

<img src="docs/assets/icon.png" alt="Jarvis-Edge reactor icon" width="72" />

**Built by Edge Agency — London, Ontario.**

</div>
