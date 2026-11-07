# Jarvis-Edge — Desktop App

The Jarvis-Edge console as a real desktop application (Electron shell around
the exact same console build — no separate UI to drift out of sync).

## For the operator: one-click install

1. Install [Ollama](https://ollama.com) and pull a model
   (`ollama pull llama3.2` or any model you like), then start it with
   `OLLAMA_ORIGINS=* ollama serve` so the app can reach it.
2. Run the installer for your platform (see Releases):
   - **Windows:** `Jarvis-Edge-Setup-<version>.exe` — a true one-click
     NSIS installer (per-user, no admin prompt) that adds a desktop
     shortcut named **Jarvis-Edge**.
   - **macOS:** open the `.dmg` and drag Jarvis-Edge to Applications.
   - **Linux:** make the `.AppImage` executable and run it.
3. Launch Jarvis-Edge. If Ollama is running, the pill reads
   **OLLAMA · ONLINE** and your models are in the left rail. If not, the
   console shows the exact fix on screen — nothing is hidden.

Everything stays local: models, second brain, ideas, goals, artifacts and
the approval queue live on your machine. The desktop shell adds no network
calls of its own, exposes no Node bridge to the page (context isolation
on, sandbox on), and opens external links in your real browser.

## The tray icon (Windows toolbar)

Jarvis-Edge puts its icon in the Windows system tray — the little icon
row by the Wi-Fi, volume and clock icons. Closing the window parks
Jarvis there instead of quitting: he's still on duty. Click the tray
icon to summon the window; right-click for a menu with live Ollama
status (refreshed every 30 seconds), shortcuts to the Command Center
and the Dev Team, and Quit. The first time you park him, Windows shows
a balloon so you know where he went.

## For the developer: build the installers

```bash
cd console && npm install && npm run build   # the UI the app wraps
cd ../desktop && npm install
npm run dist:win     # Windows one-click NSIS installer (.exe)
npm run dist:mac     # macOS .dmg
npm run dist:linux   # Linux .AppImage
```

Run unpackaged during development with `npm start` (loads the sibling
`console/dist` automatically; `--dev` loads the Vite dev server instead).

Installers are unsigned until the project's Azure Artifact Signing setup
(the same path as Robot Orchestra) is applied — Windows SmartScreen will
show a "Run anyway" prompt on first install until then. That prompt is a
signing-certificate matter, not an app problem.
