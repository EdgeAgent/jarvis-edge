// Jarvis-Edge Console — local-first operator console.
// Brains: Ollama chat (streaming), Web Speech voice, second-brain retrieval,
// a local command router, and an approval-gated queue. Nothing here sends,
// posts, or executes anything on its own — drafts wait for a human.

import { createReactor, type CoreMode } from "./reactor";

/* ---------------------------------- types --------------------------------- */

interface ModelInfo { name: string; size?: number }
interface BrainDoc { id: string; name: string; chunks: string[]; addedAt: number }
interface QueueItem {
  id: string; kind: string; title: string; body: string;
  status: "pending" | "approved"; createdAt: number;
}
interface ChatMsg { role: "system" | "user" | "assistant"; content: string }

interface SpeechRecognitionLike {
  continuous: boolean; interimResults: boolean; lang: string;
  start(): void; stop(): void;
  onresult: ((e: SpeechResultEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
interface SpeechResultEventLike {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

/* ---------------------------------- dom ----------------------------------- */

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const transcriptEl = $("transcript");
const cmdForm = $<HTMLFormElement>("cmd-form");
const cmdInput = $<HTMLInputElement>("cmd-input");
const connPill = $("conn-pill");
const connText = $("conn-text");
const modelListEl = $("model-list");
const modelStatusEl = $("model-status");
const ollamaUrlInput = $<HTMLInputElement>("ollama-url");
const brainListEl = $("brain-list");
const brainMetaEl = $("brain-meta");
const brainFileInput = $<HTMLInputElement>("brain-file-input");
const coreStateEl = $("core-state");
const coreModelEl = $("core-model");
const talkBtn = $("btn-talk");
const talkLabel = $("talk-label");
const voiceSelect = $<HTMLSelectElement>("voice-select");
const wakeToggle = $<HTMLInputElement>("wake-toggle");
const workerListEl = $("worker-list");
const queueListEl = $("queue-list");
const queueCountEl = $("queue-count");

const reactor = createReactor($<HTMLCanvasElement>("reactor"));

/* --------------------------------- state ---------------------------------- */

const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch { return fallback; }
  },
  set(key: string, value: unknown) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
  },
};

let ollamaBase = store.get("je-ollama-url", "http://localhost:11434");
let models: ModelInfo[] = [];
let activeModel = store.get<string>("je-active-model", "");
let ollamaOnline = false;
let brainDocs: BrainDoc[] = store.get("je-brain", []);
let queue: QueueItem[] = store.get("je-queue", []);
let history: ChatMsg[] = [];
let exchanges = 0;
let lastLatencyMs: number | null = null;
const sessionStart = Date.now();
let coreMode: CoreMode = "standby";
let levelTimer: number | null = null;

ollamaUrlInput.value = ollamaBase;

/* ------------------------------- reactor fx ------------------------------- */

function setCore(mode: CoreMode, label?: string) {
  coreMode = mode;
  reactor.setMode(mode);
  coreStateEl.textContent = label ?? mode.toUpperCase();
  if (levelTimer !== null) { window.clearInterval(levelTimer); levelTimer = null; }
  if (mode === "listening" || mode === "speaking") {
    levelTimer = window.setInterval(() => {
      reactor.setLevel(0.35 + Math.random() * 0.55);
    }, 130);
  } else {
    reactor.setLevel(mode === "thinking" ? 0.22 : 0);
  }
}

/* ------------------------------- transcript ------------------------------- */

function addMsg(who: "user" | "jarvis" | "system", text: string): HTMLDivElement {
  const div = document.createElement("div");
  div.className = `msg ${who}`;
  if (who !== "system") {
    const label = document.createElement("span");
    label.className = "who";
    label.textContent = who === "user" ? "YOU" : "JARVIS";
    div.appendChild(label);
  }
  const body = document.createElement("span");
  body.textContent = text;
  div.appendChild(body);
  transcriptEl.appendChild(div);
  transcriptEl.scrollTop = transcriptEl.scrollHeight;
  return div;
}

/* --------------------------------- speech --------------------------------- */

const synth = window.speechSynthesis ?? null;
let voices: SpeechSynthesisVoice[] = [];

function loadVoices() {
  if (!synth) return;
  voices = synth.getVoices();
  voiceSelect.innerHTML = "";
  if (!voices.length) {
    const opt = document.createElement("option");
    opt.textContent = "No voices available";
    voiceSelect.appendChild(opt);
    return;
  }
  const saved = store.get("je-voice", "");
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const pool = english.length ? english : voices;
  for (const v of pool) {
    const opt = document.createElement("option");
    opt.value = v.name;
    opt.textContent = `${v.name} · ${v.lang}`;
    if (v.name === saved) opt.selected = true;
    voiceSelect.appendChild(opt);
  }
  if (!voiceSelect.value && pool.length) {
    const male = pool.find((v) => /daniel|david|george|male|guy/i.test(v.name));
    voiceSelect.value = (male ?? pool[0]).name;
  }
}
if (synth) {
  loadVoices();
  synth.onvoiceschanged = loadVoices;
}
voiceSelect.addEventListener("change", () => store.set("je-voice", voiceSelect.value));

function speak(text: string) {
  if (!synth || !text.trim()) return;
  synth.cancel();
  const clean = text.replace(/[`*_#>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 600);
  const utter = new SpeechSynthesisUtterance(clean);
  const voice = voices.find((v) => v.name === voiceSelect.value);
  if (voice) utter.voice = voice;
  utter.rate = 1.02;
  utter.onstart = () => setCore("speaking", "SPEAKING");
  utter.onend = () => { if (coreMode === "speaking") setCore("standby"); };
  utter.onerror = () => { if (coreMode === "speaking") setCore("standby"); };
  synth.speak(utter);
}

const SR: (new () => SpeechRecognitionLike) | undefined =
  (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;

let recognition: SpeechRecognitionLike | null = null;
let listening = false;
let wakeMode = false;

function ensureRecognition(): SpeechRecognitionLike | null {
  if (!SR) return null;
  if (recognition) return recognition;
  recognition = new SR();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i];
      if (!result.isFinal) continue;
      const text = result[0].transcript.trim();
      if (!text) continue;
      if (wakeMode) {
        const m = text.match(/jarvis[,.\s]+(.+)/i);
        if (m) void handleCommand(m[1]);
        else if (/^jarvis[.!?\s]*$/i.test(text)) speak("Yes?");
      } else {
        void handleCommand(text);
      }
    }
  };
  recognition.onend = () => {
    if (wakeMode) {
      try { recognition?.start(); } catch { /* already running */ }
    } else if (listening) {
      listening = false;
      talkBtn.classList.remove("listening");
      talkLabel.textContent = "TALK TO JARVIS";
      if (coreMode === "listening") setCore("standby");
    }
  };
  recognition.onerror = (e) => {
    if (e.error === "not-allowed") {
      addMsg("system", "Microphone access was blocked. Allow the mic for this page, or just type your command.");
      wakeToggle.checked = false;
      wakeMode = false;
      listening = false;
      talkBtn.classList.remove("listening");
      talkLabel.textContent = "TALK TO JARVIS";
      setCore("standby");
    }
  };
  return recognition;
}

talkBtn.addEventListener("click", () => {
  const rec = ensureRecognition();
  if (!rec) {
    addMsg("system", "Voice input is not supported in this browser. Chrome and Edge offer the full voice stack — typing works everywhere.");
    return;
  }
  if (listening) {
    rec.stop();
    return;
  }
  if (synth) synth.cancel();
  rec.continuous = false;
  try {
    rec.start();
    listening = true;
    talkBtn.classList.add("listening");
    talkLabel.textContent = "LISTENING… TAP TO STOP";
    setCore("listening", "LISTENING");
  } catch { /* already started */ }
});

wakeToggle.addEventListener("change", () => {
  const rec = ensureRecognition();
  if (!rec) {
    wakeToggle.checked = false;
    addMsg("system", "Wake word needs a browser with speech recognition (Chrome or Edge).");
    return;
  }
  wakeMode = wakeToggle.checked;
  if (wakeMode) {
    rec.continuous = true;
    try { rec.start(); } catch { /* noop */ }
    addMsg("system", "Wake word armed. Say “Jarvis, …” and I will route it.");
    setCore("listening", "WAKE WORD ARMED");
  } else {
    try { rec.stop(); } catch { /* noop */ }
    setCore("standby");
  }
});

/* --------------------------------- ollama --------------------------------- */

function fmtSize(bytes?: number): string {
  if (!bytes) return "";
  const gb = bytes / 1e9;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`;
}

async function refreshModels() {
  ollamaBase = ollamaUrlInput.value.trim().replace(/\/$/, "") || "http://localhost:11434";
  store.set("je-ollama-url", ollamaBase);
  try {
    const res = await fetch(`${ollamaBase}/api/tags`, { signal: AbortSignal.timeout(3500) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { models?: Array<{ name: string; size?: number }> };
    models = (data.models ?? []).map((m) => ({ name: m.name, size: m.size }));
    ollamaOnline = true;
    connPill.dataset.state = "online";
    connText.textContent = "OLLAMA · ONLINE";
    if (!models.length) {
      modelStatusEl.textContent = "Ollama is running but no models are installed yet.";
      modelListEl.innerHTML = `<li class="model-empty">Pull one to get started, e.g.<br /><code>ollama pull llama3.1:8b</code><br /><code>ollama pull qwen2.5:7b</code></li>`;
      activeModel = "";
    } else {
      if (!models.some((m) => m.name === activeModel)) {
        activeModel = models[0].name;
        store.set("je-active-model", activeModel);
      }
      modelStatusEl.textContent = `${models.length} model${models.length === 1 ? "" : "s"} on this machine. Tap one to make it the active brain.`;
      renderModels();
    }
  } catch {
    ollamaOnline = false;
    models = [];
    connPill.dataset.state = "offline";
    connText.textContent = "OLLAMA · OFFLINE";
    modelStatusEl.textContent = "Ollama is not reachable. Commands, voice, the second brain and the queue still work.";
    modelListEl.innerHTML = `<li class="model-empty">Start Ollama, then hit Refresh.<br />Browser access needs:<br /><code>OLLAMA_ORIGINS=* ollama serve</code></li>`;
  }
  coreModelEl.textContent = activeModel || "no model selected";
  renderWorkers();
}

function renderModels() {
  modelListEl.innerHTML = "";
  for (const m of models) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `model-item${m.name === activeModel ? " active" : ""}`;
    const name = document.createElement("span");
    name.className = "m-name";
    name.textContent = m.name;
    const size = document.createElement("span");
    size.className = "m-size";
    size.textContent = fmtSize(m.size);
    btn.append(name, size);
    btn.addEventListener("click", () => setActiveModel(m.name, true));
    li.appendChild(btn);
    modelListEl.appendChild(li);
  }
}

function setActiveModel(name: string, announce: boolean) {
  activeModel = name;
  store.set("je-active-model", name);
  coreModelEl.textContent = name;
  renderModels();
  renderWorkers();
  if (announce) addMsg("system", `Active model switched to ${name}.`);
}

$("btn-refresh-models").addEventListener("click", () => void refreshModels());
ollamaUrlInput.addEventListener("change", () => void refreshModels());

/* ------------------------------- second brain ------------------------------ */

function chunkText(text: string): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  const chunks: string[] = [];
  let current = "";
  for (const para of clean.split(/\n{2,}/)) {
    const p = para.trim();
    if (!p) continue;
    if ((current + "\n\n" + p).length > 900 && current) {
      chunks.push(current);
      current = p;
    } else {
      current = current ? current + "\n\n" + p : p;
    }
    while (current.length > 1400) {
      chunks.push(current.slice(0, 1400));
      current = current.slice(1400);
    }
  }
  if (current) chunks.push(current);
  return chunks.slice(0, 400);
}

function brainChunkCount(): number {
  return brainDocs.reduce((n, d) => n + d.chunks.length, 0);
}

function renderBrain() {
  brainMetaEl.textContent = brainDocs.length
    ? `${brainDocs.length} document${brainDocs.length === 1 ? "" : "s"} · ${brainChunkCount()} chunks indexed locally.`
    : "No documents loaded.";
  brainListEl.innerHTML = "";
  for (const doc of brainDocs) {
    const li = document.createElement("li");
    li.className = "brain-item";
    const name = document.createElement("span");
    name.className = "b-name";
    name.textContent = doc.name;
    const meta = document.createElement("span");
    meta.className = "b-meta";
    meta.textContent = `${doc.chunks.length} chunks`;
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "×";
    del.title = `Remove ${doc.name}`;
    del.addEventListener("click", () => {
      brainDocs = brainDocs.filter((d) => d.id !== doc.id);
      store.set("je-brain", brainDocs);
      renderBrain();
      renderWorkers();
    });
    li.append(name, meta, del);
    brainListEl.appendChild(li);
  }
}

$("btn-brain-add").addEventListener("click", () => brainFileInput.click());
brainFileInput.addEventListener("change", () => {
  const files = Array.from(brainFileInput.files ?? []);
  brainFileInput.value = "";
  for (const file of files) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const chunks = chunkText(text);
      if (!chunks.length) return;
      brainDocs.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        chunks,
        addedAt: Date.now(),
      });
      store.set("je-brain", brainDocs);
      renderBrain();
      renderWorkers();
      addMsg("system", `Second brain: “${file.name}” indexed (${chunks.length} chunks). Ask me about it.`);
    };
    reader.readAsText(file);
  }
});

function retrieveBrain(query: string): string[] {
  const words = Array.from(new Set(query.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []));
  if (!words.length || !brainDocs.length) return [];
  const scored: Array<{ chunk: string; doc: string; score: number }> = [];
  for (const doc of brainDocs) {
    for (const chunk of doc.chunks) {
      const lower = chunk.toLowerCase();
      let score = 0;
      for (const w of words) {
        let idx = 0;
        while (true) {
          const found = lower.indexOf(w, idx);
          if (found === -1) break;
          score++;
          idx = found + w.length;
        }
      }
      if (score > 1) scored.push({ chunk, doc: doc.name, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((s) => `[from ${s.doc}]\n${s.chunk}`);
}

/* ---------------------------------- queue ---------------------------------- */

function renderQueue() {
  const pending = queue.filter((q) => q.status === "pending").length;
  queueCountEl.textContent = String(queue.length);
  queueListEl.innerHTML = "";
  if (!queue.length) {
    const li = document.createElement("li");
    li.className = "queue-empty";
    li.textContent = "Queue is clear. Drafts Jarvis prepares will wait here for your call.";
    queueListEl.appendChild(li);
    return;
  }
  for (const item of [...queue].reverse()) {
    const li = document.createElement("li");
    li.className = `queue-item${item.status === "approved" ? " approved" : ""}`;
    const tag = document.createElement("span");
    tag.className = "queue-tag";
    tag.textContent = item.status === "approved" ? `✓ APPROVED · ${item.kind}` : `AWAITING APPROVAL · ${item.kind}`;
    const title = document.createElement("div");
    title.className = "queue-title";
    title.textContent = item.title;
    const body = document.createElement("div");
    body.className = "queue-body";
    body.textContent = item.body;
    li.append(tag, title, body);
    if (item.status === "pending") {
      const actions = document.createElement("div");
      actions.className = "queue-actions";
      const approve = document.createElement("button");
      approve.type = "button";
      approve.textContent = "Approve";
      approve.addEventListener("click", () => {
        item.status = "approved";
        store.set("je-queue", queue);
        renderQueue();
        renderWorkers();
        addMsg("system", `Approved: “${item.title}”. It stays in this console — nothing was sent anywhere.`);
      });
      const dismiss = document.createElement("button");
      dismiss.type = "button";
      dismiss.className = "dismiss";
      dismiss.textContent = "Dismiss";
      dismiss.addEventListener("click", () => {
        queue = queue.filter((q) => q.id !== item.id);
        store.set("je-queue", queue);
        renderQueue();
        renderWorkers();
      });
      actions.append(approve, dismiss);
      li.appendChild(actions);
    }
    queueListEl.appendChild(li);
  }
}

function pushQueue(kind: string, title: string, body: string) {
  queue.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind, title, body, status: "pending", createdAt: Date.now(),
  });
  store.set("je-queue", queue);
  renderQueue();
  renderWorkers();
}

/* --------------------------------- workers --------------------------------- */

function renderWorkers() {
  const voiceOk = !!SR;
  const pendingDrafts = queue.filter((q) => q.status === "pending").length;
  const workers = [
    {
      icon: "◉", name: "Reactor Core · Router",
      detail: ollamaOnline ? `Routing to ${activeModel || "no model"} — local inference only.` : "Ollama offline — router is holding commands locally.",
      state: ollamaOnline ? "ONLINE" : "OFFLINE", cls: ollamaOnline ? "on" : "",
    },
    {
      icon: "🎙", name: "Voice Worker",
      detail: voiceOk ? "Browser speech stack live — talk button and wake word ready." : "Needs Chrome or Edge for the speech stack.",
      state: voiceOk ? "READY" : "UNAVAILABLE", cls: voiceOk ? "on" : "",
    },
    {
      icon: "🧠", name: "Second Brain",
      detail: brainDocs.length ? `${brainDocs.length} docs · ${brainChunkCount()} chunks — retrieved on demand, never uploaded.` : "Empty. Add files and Jarvis answers from your own material.",
      state: brainDocs.length ? "LOADED" : "EMPTY", cls: brainDocs.length ? "on" : "idle",
    },
    {
      icon: "✉", name: "Executive · Email",
      detail: pendingDrafts ? `${pendingDrafts} draft${pendingDrafts === 1 ? "" : "s"} waiting on your approval. Nothing sends itself.` : "Drafts land in the approval queue — Jarvis writes, you decide.",
      state: pendingDrafts ? "REVIEW" : "IDLE", cls: pendingDrafts ? "idle" : "",
    },
    {
      icon: "📈", name: "Trading Worker",
      detail: "No broker connected — by design. Research drafts only, straight to the approval queue.",
      state: "STANDBY", cls: "idle",
    },
    {
      icon: "📅", name: "Meetings Worker",
      detail: "Calendar not connected yet. Say the word and Google Calendar gets wired in.",
      state: "NOT WIRED", cls: "",
    },
  ];
  workerListEl.innerHTML = "";
  for (const w of workers) {
    const li = document.createElement("li");
    li.className = "worker-item";
    const ico = document.createElement("span");
    ico.className = "worker-ico";
    ico.textContent = w.icon;
    const bodyWrap = document.createElement("div");
    bodyWrap.className = "worker-body";
    const name = document.createElement("span");
    name.className = "worker-name";
    name.textContent = w.name;
    const detail = document.createElement("span");
    detail.className = "worker-detail";
    detail.textContent = w.detail;
    bodyWrap.append(name, detail);
    const state = document.createElement("span");
    state.className = `worker-state ${w.cls}`;
    state.textContent = w.state;
    li.append(ico, bodyWrap, state);
    workerListEl.appendChild(li);
  }
}

/* ----------------------------------- chat ---------------------------------- */

async function chatWithModel(userText: string) {
  if (!ollamaOnline || !activeModel) {
    addMsg("jarvis", "My local model link is down right now. Start Ollama (OLLAMA_ORIGINS=* ollama serve), pull a model, and hit Refresh — commands, the second brain and the queue keep working in the meantime.");
    return;
  }
  setCore("thinking", "THINKING");
  const bubble = addMsg("jarvis", "…");
  const bodyEl = bubble.querySelector("span:last-child") as HTMLSpanElement;
  const started = performance.now();
  let firstTokenAt = 0;
  let full = "";

  const messages: ChatMsg[] = [
    {
      role: "system",
      content:
        "You are Jarvis, the operator of Jarvis-Edge — a local-first executive command center. Be sharp, concise and practical. You run entirely on the user's own machine via Ollama. Never claim you sent an email, placed a trade, or booked anything: drafts go to the user's approval queue. If asked for facts from the user's documents, rely on the provided second-brain excerpts and say when they do not cover the answer.",
    },
  ];
  const brainHits = retrieveBrain(userText);
  if (brainHits.length) {
    messages.push({
      role: "system",
      content: `Relevant excerpts from the user's second brain:\n\n${brainHits.join("\n\n---\n\n")}`,
    });
  }
  messages.push(...history.slice(-8));
  messages.push({ role: "user", content: userText });

  try {
    const res = await fetch(`${ollamaBase}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: activeModel, messages, stream: true }),
    });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line) as { message?: { content?: string } };
          const piece = json.message?.content ?? "";
          if (piece) {
            if (!firstTokenAt) firstTokenAt = performance.now();
            full += piece;
            bodyEl.textContent = full;
            transcriptEl.scrollTop = transcriptEl.scrollHeight;
          }
        } catch { /* partial line */ }
      }
    }
    if (!full.trim()) full = "The model returned an empty response. Try again, or switch models in the left rail.";
    bodyEl.textContent = full;
    lastLatencyMs = Math.round(performance.now() - started);
    history.push({ role: "user", content: userText }, { role: "assistant", content: full });
    exchanges++;
    setCore("standby");
    speak(full);
  } catch {
    bodyEl.textContent = "I lost the model mid-reply. Check that Ollama is still running, then ask again.";
    setCore("standby");
  }
}

/* ------------------------------- command router ---------------------------- */

function helpText(): string {
  return [
    "At your service. What I can do from this console:",
    "· Ask anything — it routes to the active local model, with second-brain retrieval when your docs match.",
    "· “switch to <model>” — change the active brain.",
    "· “draft email to <name> about <topic>” — I write it into the approval queue. Nothing sends itself.",
    "· “note <text>” — pin something into the second brain.",
    "· “remind me <text>” — park a reminder in the queue.",
    "· “status” — a quick systems readout. “clear” — wipe this transcript.",
  ].join("\n");
}

async function handleCommand(raw: string) {
  const text = raw.trim();
  if (!text) return;
  addMsg("user", text);
  cmdInput.value = "";
  const lower = text.toLowerCase();

  if (lower === "help" || lower === "what can you do") {
    addMsg("jarvis", helpText());
    return;
  }
  if (lower === "clear") {
    transcriptEl.innerHTML = "";
    history = [];
    return;
  }
  if (lower === "status") {
    addMsg("jarvis", [
      `Reactor Core: ${ollamaOnline ? "online" : "offline"}.`,
      `Active model: ${activeModel || "none selected"}.`,
      `Second brain: ${brainDocs.length} documents, ${brainChunkCount()} chunks.`,
      `Approval queue: ${queue.filter((q) => q.status === "pending").length} pending, ${queue.filter((q) => q.status === "approved").length} approved.`,
      `Voice: ${SR ? "available" : "not supported in this browser"}. Exchanges this session: ${exchanges}.`,
    ].join("\n"));
    return;
  }
  if (/^(what time|time|date|what day)/.test(lower)) {
    const now = new Date();
    addMsg("jarvis", `It is ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} on ${now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.`);
    return;
  }
  const switchMatch = text.match(/^switch to (.+)$/i);
  if (switchMatch) {
    const want = switchMatch[1].trim().toLowerCase();
    const found = models.find((m) => m.name.toLowerCase() === want) ?? models.find((m) => m.name.toLowerCase().includes(want));
    if (found) {
      setActiveModel(found.name, false);
      addMsg("jarvis", `Done — ${found.name} is now the active brain.`);
    } else {
      addMsg("jarvis", models.length ? `I do not see “${switchMatch[1]}” among the installed models: ${models.map((m) => m.name).join(", ")}.` : "No models are installed yet — pull one with Ollama first.");
    }
    return;
  }
  const emailMatch = text.match(/^draft (?:an )?email to (.+?) about (.+)$/i);
  if (emailMatch) {
    const [, to, topic] = emailMatch;
    const body = `Hi ${to},\n\nReaching out about ${topic}. I would like to set up a short call this week to walk through the details and next steps.\n\nIf a time works on your end, send it over and I will lock it in.\n\n— Drafted by Jarvis-Edge. Review before sending; nothing has been sent.`;
    pushQueue("EMAIL DRAFT", `Email to ${to} — ${topic}`, body);
    addMsg("jarvis", `Draft written and parked in the approval queue: an email to ${to} about ${topic}. It has not been sent — review it on the right whenever you are ready.`);
    return;
  }
  const noteMatch = text.match(/^note (.+)$/i);
  if (noteMatch) {
    const noteText = noteMatch[1];
    brainDocs.push({
      id: `${Date.now()}-note`,
      name: `Quick note — ${new Date().toLocaleString()}`,
      chunks: [noteText],
      addedAt: Date.now(),
    });
    store.set("je-brain", brainDocs);
    renderBrain();
    renderWorkers();
    addMsg("jarvis", "Noted and filed in the second brain.");
    return;
  }
  const remindMatch = text.match(/^remind me (.+)$/i);
  if (remindMatch) {
    pushQueue("REMINDER", remindMatch[1], "Parked by voice/command. Jarvis does not chase you — it waits here until you clear it.");
    addMsg("jarvis", "Reminder parked in the approval queue.");
    return;
  }

  await chatWithModel(text);
}

cmdForm.addEventListener("submit", (e) => {
  e.preventDefault();
  void handleCommand(cmdInput.value);
});

/* ---------------------------------- vitals --------------------------------- */

function tickClock() {
  const now = new Date();
  $("clock").textContent = now.toLocaleTimeString("en-CA", { hour12: false });
  $("date-line").textContent = now.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const up = Math.floor((Date.now() - sessionStart) / 1000);
  const mm = String(Math.floor(up / 60)).padStart(2, "0");
  const ss = String(up % 60).padStart(2, "0");
  $("v-uptime").textContent = `${mm}:${ss}`;
  $("v-latency").textContent = lastLatencyMs ? `${(lastLatencyMs / 1000).toFixed(1)}s` : "—";
  $("v-messages").textContent = String(exchanges);
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  $("v-heap").textContent = mem ? `${Math.round(mem.usedJSHeapSize / 1048576)} MB` : "—";
}
window.setInterval(tickClock, 1000);
tickClock();

/* ----------------------------------- boot ---------------------------------- */

renderBrain();
renderQueue();
renderWorkers();
void refreshModels();
addMsg("system", "Reactor Core online · all processing stays on this machine");
addMsg("jarvis", "Jarvis-Edge at your service. My models, memory and voice run locally — no paid APIs, no subscriptions. Talk to me, type a command, or say “help” to see the playbook.");
setCore("standby");
