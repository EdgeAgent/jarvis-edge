# Jarvis-Edge Console — Setup & Operator Guide

The console is the operator's seat for Jarvis-Edge: a local-first command
center that talks to **Ollama** on your own machine. No paid AI APIs, no
accounts, no subscriptions. Your models, documents and voice never leave
the device (voice recognition uses the browser's speech stack — see the
honest notes below).

## 1. Install Ollama and pull a model

1. Install Ollama from <https://ollama.com>.
2. Pull at least one model:

   ```bash
   ollama pull llama3.1:8b
   ollama pull qwen2.5:7b
   ```

3. Start Ollama so the browser is allowed to reach it:

   ```bash
   OLLAMA_ORIGINS=* ollama serve
   ```

   Ollama listens on `http://localhost:11434` by default. If you run it
   somewhere else, change the endpoint in the console's left rail.

## 2. Run the console

```bash
cd console
npm install
npm run dev        # http://127.0.0.1:5173
```

Production build:

```bash
npm run build      # outputs console/dist — serve it with any static host
npm run preview    # http://127.0.0.1:4173
```

## 3. What works today

- **Model switching** — every model Ollama reports is listed; tap one to
  make it the active brain. Chat streams token-by-token.
- **Voice** — push-to-talk and an optional "Jarvis" wake word (Chrome /
  Edge). Replies are spoken with your choice of system voice.
- **Second brain** — add `.md`, `.txt`, `.json`, `.csv` or `.log` files.
  They are chunked and indexed in the browser (localStorage). When a
  question matches, the relevant excerpts ride along with the prompt.
- **Command router** — `help`, `status`, `time`, `switch to <model>`,
  `draft email to <name> about <topic>`, `note <text>`, `remind me
  <text>`, `clear`. Everything else goes to the active model.
- **Approval queue** — drafts and reminders wait here. Approving marks an
  item approved **inside the console only**; Jarvis never sends, posts,
  trades or books anything by itself. That gate is the product's core
  rule, not a setting.

## 4. Honest notes

- **Trading / Meetings workers** are framework panels in this release:
  no broker and no calendar are connected, and their cards say so.
- **Voice recognition** in Chrome uses Google's speech service under the
  hood of the Web Speech API; recognition *results* still land only in
  this page. For a fully offline voice stack, run the console beside a
  local Whisper/Vosk service and point a future build at it.
- **Second-brain storage** is browser localStorage — clearing site data
  clears the brain. Export anything precious.
- `server.py` at the repo root is an early browser-observer **stub** with
  simulated audit values; it is not wired to the console yet.
