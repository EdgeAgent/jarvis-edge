// Views: Feed, Ideas, Goals, Artifacts, Preview — plus the main navigation.
// All state is local (localStorage). Other modules talk to this one through
// emitFeed()/addArtifact() and three window events:
//   "je-mission"     { detail: string }  -> hand text to the Dev Team
//   "je-queue-add"   { detail: {kind,title,body} } -> handled in main.ts
//   "je-preview"     { detail: string }  -> render HTML in the sandbox

import { looksHtml } from "./execute";
import { animateItemIn, animateViewIn } from "./motion";

export interface FeedItem { ts: number; kind: string; text: string }
export interface Idea { id: string; title: string; note: string; ts: number }
export interface GoalItem { id: string; title: string; steps: Array<{ text: string; done: boolean }>; ts: number }
export interface ArtifactItem { id: string; title: string; kind: string; body: string; ts: number }

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

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let feed: FeedItem[] = store.get("je-feed", []);
let ideas: Idea[] = store.get("je-ideas", []);
let goals: GoalItem[] = store.get("je-goals", []);
let artifacts: ArtifactItem[] = store.get("je-artifacts", []);

/* ---------------------------------- feed ---------------------------------- */

export function emitFeed(kind: string, text: string) {
  feed.push({ ts: Date.now(), kind, text });
  if (feed.length > 120) feed = feed.slice(-120);
  store.set("je-feed", feed);
  renderFeed();
  void animateItemIn(document.querySelector<HTMLElement>("#feed-list .feed-item"));
}

function renderFeed() {
  const list = $("feed-list");
  if (!list) return;
  list.innerHTML = "";
  if (!feed.length) {
    const li = document.createElement("li");
    li.className = "feed-empty";
    li.textContent = "Quiet so far. Give Jarvis a command and watch this fill up.";
    list.appendChild(li);
    return;
  }
  for (const item of [...feed].reverse()) {
    const li = document.createElement("li");
    li.className = "feed-item";
    const time = document.createElement("time");
    time.textContent = new Date(item.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const kind = document.createElement("span");
    kind.className = `feed-kind ${item.kind === "agent" ? "agent" : item.kind === "queue" ? "queue" : ""}`;
    kind.textContent = item.kind.toUpperCase();
    const text = document.createElement("span");
    text.className = "feed-text";
    text.textContent = item.text;
    li.append(time, kind, text);
    list.appendChild(li);
  }
}

/* -------------------------------- artifacts -------------------------------- */

export function addArtifact(title: string, kind: string, body: string) {
  artifacts.unshift({ id: uid(), title, kind, body, ts: Date.now() });
  store.set("je-artifacts", artifacts);
  renderArtifacts();
  window.dispatchEvent(new CustomEvent("je-artifacts-changed"));
}

function download(name: string, body: string) {
  const blob = new Blob([body], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function renderArtifacts() {
  const wrap = $("artifact-list");
  if (!wrap) return;
  wrap.innerHTML = "";
  if (!artifacts.length) {
    const div = document.createElement("div");
    div.className = "empty-note";
    div.textContent = "Nothing filed yet. Mission reports, approved drafts saved from the queue, and exports land here.";
    wrap.appendChild(div);
    return;
  }
  for (const art of artifacts) {
    const div = document.createElement("div");
    div.className = "artifact";
    const head = document.createElement("div");
    head.className = "artifact-head";
    const title = document.createElement("strong");
    title.textContent = art.title;
    const meta = document.createElement("span");
    meta.className = "artifact-meta";
    meta.textContent = `${art.kind} · ${new Date(art.ts).toLocaleString()}`;
    const dl = document.createElement("button");
    dl.type = "button";
    dl.className = "mini-btn";
    dl.textContent = "Download .md";
    dl.addEventListener("click", () => download(`${art.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "artifact"}.md`, art.body));
    head.append(title, meta, dl);
    if (looksHtml(art.body)) {
      const pv = document.createElement("button");
      pv.type = "button";
      pv.className = "mini-btn";
      pv.textContent = "▶ Preview in sandbox";
      pv.addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent<string>("je-preview", { detail: art.body }));
      });
      head.appendChild(pv);
    }
    const body = document.createElement("div");
    body.className = "artifact-body";
    body.textContent = art.body;
    div.append(head, body);
    wrap.appendChild(div);
  }
}

/* ---------------------------------- ideas ---------------------------------- */

function handToTeam(text: string) {
  window.dispatchEvent(new CustomEvent<string>("je-mission", { detail: text }));
}

function renderIdeas() {
  const grid = $("idea-grid");
  if (!grid) return;
  grid.innerHTML = "";
  if (!ideas.length) {
    const div = document.createElement("div");
    div.className = "empty-note";
    div.textContent = "No ideas banked yet. The next shower thought goes here — or type “idea …” in Command.";
    grid.appendChild(div);
    return;
  }
  for (const idea of [...ideas].reverse()) {
    const card = document.createElement("div");
    card.className = "card";
    const h = document.createElement("h3");
    h.textContent = idea.title;
    card.appendChild(h);
    if (idea.note) {
      const note = document.createElement("p");
      note.className = "card-note";
      note.textContent = idea.note;
      card.appendChild(note);
    }
    const actions = document.createElement("div");
    actions.className = "card-actions";
    const toGoal = document.createElement("button");
    toGoal.type = "button";
    toGoal.textContent = "Promote to goal";
    toGoal.addEventListener("click", () => {
      goals.push({ id: uid(), title: idea.title, steps: [], ts: Date.now() });
      store.set("je-goals", goals);
      renderGoals();
      emitFeed("goal", `Idea promoted to a goal: “${idea.title}”`);
    });
    const toTeam = document.createElement("button");
    toTeam.type = "button";
    toTeam.className = "gold";
    toTeam.textContent = "⚒ Send to Dev Team";
    toTeam.addEventListener("click", () => handToTeam(idea.title + (idea.note ? ` — ${idea.note}` : "")));
    const del = document.createElement("button");
    del.type = "button";
    del.className = "danger";
    del.textContent = "Delete";
    del.addEventListener("click", () => {
      ideas = ideas.filter((i) => i.id !== idea.id);
      store.set("je-ideas", ideas);
      renderIdeas();
    });
    actions.append(toGoal, toTeam, del);
    card.appendChild(actions);
    grid.appendChild(card);
  }
}

export function addIdea(title: string, note = "") {
  ideas.push({ id: uid(), title, note, ts: Date.now() });
  store.set("je-ideas", ideas);
  renderIdeas();
  emitFeed("system", `Idea banked: “${title}”`);
}

/* ---------------------------------- goals ---------------------------------- */

function renderGoals() {
  const grid = $("goal-grid");
  if (!grid) return;
  grid.innerHTML = "";
  if (!goals.length) {
    const div = document.createElement("div");
    div.className = "empty-note";
    div.textContent = "No goals yet. Add one above, break it into steps, and tick them off — or promote an Idea.";
    grid.appendChild(div);
    return;
  }
  for (const goal of [...goals].reverse()) {
    const card = document.createElement("div");
    card.className = "card";
    const h = document.createElement("h3");
    h.textContent = goal.title;
    card.appendChild(h);

    const doneCount = goal.steps.filter((s) => s.done).length;
    const progress = document.createElement("div");
    progress.className = "progress";
    const bar = document.createElement("i");
    bar.style.width = goal.steps.length ? `${Math.round((doneCount / goal.steps.length) * 100)}%` : "0%";
    progress.appendChild(bar);
    card.appendChild(progress);
    const pct = document.createElement("p");
    pct.className = "card-note";
    pct.textContent = goal.steps.length ? `${doneCount}/${goal.steps.length} steps done` : "No steps yet — add the first one below.";
    card.appendChild(pct);

    const ul = document.createElement("ul");
    ul.className = "step-list";
    goal.steps.forEach((step, idx) => {
      const li = document.createElement("li");
      if (step.done) li.className = "done";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = step.done;
      box.addEventListener("change", () => {
        goal.steps[idx].done = box.checked;
        store.set("je-goals", goals);
        renderGoals();
      });
      const span = document.createElement("span");
      span.textContent = step.text;
      li.append(box, span);
      ul.appendChild(li);
    });
    card.appendChild(ul);

    const addRow = document.createElement("div");
    addRow.className = "step-add";
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Add a step…";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.textContent = "Add";
    const addStep = () => {
      const text = input.value.trim();
      if (!text) return;
      goal.steps.push({ text, done: false });
      store.set("je-goals", goals);
      renderGoals();
    };
    addBtn.addEventListener("click", addStep);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addStep(); } });
    addRow.append(input, addBtn);
    card.appendChild(addRow);

    const actions = document.createElement("div");
    actions.className = "card-actions";
    const toTeam = document.createElement("button");
    toTeam.type = "button";
    toTeam.className = "gold";
    toTeam.textContent = "⚒ Work it with the Dev Team";
    toTeam.addEventListener("click", () => {
      const stepsText = goal.steps.length ? ` Steps so far: ${goal.steps.map((s) => s.text).join("; ")}` : "";
      handToTeam(`Goal: ${goal.title}.${stepsText}`);
    });
    const del = document.createElement("button");
    del.type = "button";
    del.className = "danger";
    del.textContent = "Delete";
    del.addEventListener("click", () => {
      goals = goals.filter((g) => g.id !== goal.id);
      store.set("je-goals", goals);
      renderGoals();
    });
    actions.append(toTeam, del);
    card.appendChild(actions);
    grid.appendChild(card);
  }
}

export function addGoal(title: string) {
  goals.push({ id: uid(), title, steps: [], ts: Date.now() });
  store.set("je-goals", goals);
  renderGoals();
  emitFeed("goal", `Goal added: “${title}”`);
}

/* ---------------------------------- init ----------------------------------- */

export function switchView(name: string) {
  let shown: HTMLElement | null = null;
  document.querySelectorAll<HTMLElement>(".view").forEach((v) => {
    const active = v.id === `view-${name}`;
    v.classList.toggle("active", active);
    v.hidden = !active;
    if (active) shown = v;
  });
  document.querySelectorAll<HTMLButtonElement>(".nav-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.nav === name);
  });
  void animateViewIn(shown);
}

export function initViews(opts: { transcriptText: () => string }) {
  document.querySelectorAll<HTMLButtonElement>(".nav-btn").forEach((b) => {
    b.addEventListener("click", () => switchView(b.dataset.nav ?? "command"));
  });
  $("btn-feed-clear").addEventListener("click", () => {
    feed = [];
    store.set("je-feed", feed);
    renderFeed();
  });
  $<HTMLFormElement>("idea-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const title = $<HTMLInputElement>("idea-title").value.trim();
    const note = $<HTMLInputElement>("idea-note").value.trim();
    if (!title) return;
    $<HTMLInputElement>("idea-title").value = "";
    $<HTMLInputElement>("idea-note").value = "";
    addIdea(title, note);
  });
  $<HTMLFormElement>("goal-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const title = $<HTMLInputElement>("goal-title").value.trim();
    if (!title) return;
    $<HTMLInputElement>("goal-title").value = "";
    addGoal(title);
  });
  $("btn-export-transcript").addEventListener("click", () => {
    const text = opts.transcriptText().trim();
    if (!text) return;
    addArtifact(`Console transcript — ${new Date().toLocaleString()}`, "EXPORT", text);
    emitFeed("system", "Transcript exported to Artifacts.");
    switchView("artifacts");
  });
  renderFeed();
  renderIdeas();
  renderGoals();
  renderArtifacts();
}
