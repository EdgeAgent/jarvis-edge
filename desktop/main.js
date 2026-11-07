// Jarvis-Edge desktop shell — Electron main process.
// Loads the built console (console/dist) into a native window. The console
// talks to Ollama at http://localhost:11434 exactly as in the browser; if
// Ollama is not running, the console itself shows the one-line fix
// (OLLAMA_ORIGINS=* ollama serve). Nothing here phones home.

const { app, BrowserWindow, shell, Tray, Menu, nativeImage } = require("electron");
const path = require("path");

const isDev = process.argv.includes("--dev");
const DEV_URL = "http://127.0.0.1:5173";

/* --------------------------- system tray icon ------------------------------
   Jarvis lives in the Windows toolbar tray (down by the Wi-Fi / volume /
   clock icons) like he should: always on duty even when the window is
   closed. Click the tray icon to summon him; right-click for the menu. */

let tray = null;
let mainWin = null;
let isQuitting = false;
let trayHintShown = false;

function trayIconPath() {
  const fs = require("fs");
  const packaged = path.join(process.resourcesPath || "", "icon.png");
  if (fs.existsSync(packaged)) return packaged;
  return path.join(__dirname, "..", "docs", "assets", "icon.png");
}

async function ollamaStatusLine() {
  try {
    const res = await fetch("http://127.0.0.1:11434/api/tags");
    if (!res.ok) return "Ollama: offline — start it with OLLAMA_ORIGINS=* ollama serve";
    const data = await res.json();
    const names = (data.models || []).map((m) => m.name);
    return names.length ? `Ollama: ONLINE · ${names.join(", ")}` : "Ollama: ONLINE · no models pulled yet";
  } catch {
    return "Ollama: offline — start it with OLLAMA_ORIGINS=* ollama serve";
  }
}

function showWindow(view) {
  if (!mainWin) mainWin = createWindow();
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.show();
  mainWin.focus();
  if (view) {
    mainWin.webContents.executeJavaScript(
      `document.querySelector('[data-nav="${view}"]')?.click()`
    ).catch(() => {});
  }
}

async function refreshTrayMenu() {
  if (!tray) return;
  const status = await ollamaStatusLine();
  tray.setToolTip(`Jarvis-Edge — the boss is on duty\n${status}`);
  const menu = Menu.buildFromTemplate([
    { label: "Jarvis-Edge", enabled: false },
    { label: status, enabled: false },
    { type: "separator" },
    { label: "Open Command Center", click: () => showWindow("command") },
    { label: "Open Dev Team", click: () => showWindow("agents") },
    { label: "Open Approval Queue", click: () => showWindow("command") },
    { type: "separator" },
    { label: "Quit Jarvis-Edge", click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
}

function createTray() {
  try {
    const img = nativeImage.createFromPath(trayIconPath());
    if (img.isEmpty()) return;
    tray = new Tray(img.resize({ width: 16, height: 16 }));
    tray.setToolTip("Jarvis-Edge — the boss is on duty");
    tray.on("click", () => showWindow());
    tray.on("double-click", () => showWindow());
    void refreshTrayMenu();
    setInterval(() => { void refreshTrayMenu(); }, 30000);
  } catch {
    // No system tray on this platform/session (e.g. headless Linux).
    // The app runs fine without it; Windows gets the full tray.
    tray = null;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1460,
    height: 960,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: "#04070f",
    title: "Jarvis-Edge",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // External links (the GitHub repo, docs) open in the user's browser,
  // never inside the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://127.0.0.1") || url.startsWith("file://")) return { action: "allow" };
    void shell.openExternal(url);
    return { action: "deny" };
  });

  // Closing the window parks Jarvis in the tray instead of killing him.
  win.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win.hide();
      if (tray && !trayHintShown) {
        trayHintShown = true;
        if (process.platform === "win32") {
          tray.displayBalloon({
            title: "Jarvis-Edge is still on duty",
            content: "The window is parked — click my icon in the toolbar tray (by the Wi-Fi and volume icons) to bring me back.",
          });
        }
      }
    }
  });

  if (isDev) {
    void win.loadURL(DEV_URL);
  } else {
    // Packaged builds carry the console at ./console (electron-builder maps
    // console/dist there). Running unpackaged, fall back to the sibling
    // console/dist so `electron .` just works in the repo.
    const fs = require("fs");
    const packaged = path.join(__dirname, "console", "index.html");
    const sibling = path.join(__dirname, "..", "console", "dist", "index.html");
    void win.loadFile(fs.existsSync(packaged) ? packaged : sibling);
  }
  return win;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => { showWindow(); });
  app.whenReady().then(() => {
    mainWin = createWindow();
    createTray();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
