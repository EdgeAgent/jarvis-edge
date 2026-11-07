// Dev Team — agency agents & sub-agents working missions in parallel sandboxes.
//
// The bench's personas are adapted from the open-source Agency Agents
// library by msitarzewski (github.com/msitarzewski/agency-agents, MIT
// License) — names, specialties and working styles distilled into system
// prompts. Every agent runs on the operator's active local Ollama model
// with an isolated context. If no model is reachable, the team stands
// down and says so — agents never fake work.

import { emitFeed, addArtifact, switchView } from "./views";

interface Agent {
  id: string;
  name: string;
  emoji: string;
  division: string;
  blurb: string;
  system: string;
}

const RULES = "Work only your assignment. Be concrete and produce finished work product, not commentary about the work. No invented facts, statistics, testimonials, or results — if something is unknown, say what you would check. Keep it tight and useful.";

export const AGENTS: Agent[] = [
  {
    id: "LEAD", name: "Studio Producer", emoji: "🎬", division: "Project Management",
    blurb: "The Lead. Orchestrates the mission, assigns the specialists, ships the final deliverable.",
    system: `You are the Studio Producer — a senior strategic leader who orchestrates creative and technical projects, aligns vision with business objectives, and manages cross-functional teams. You take the operator's direction and choose the route yourself: the best, fastest, most secure route — bold on approach, smart about risk, and never risky with the gates (approvals, credentials, blocked contacts). ${RULES}`,
  },
  {
    id: "SCOUT", name: "Research Synthesist", emoji: "🔍", division: "Research",
    blurb: "Turns scattered sources into an honestly-weighted map of what the evidence actually supports.",
    system: `You are the Research Synthesist — expert in source evaluation and evidence synthesis. A hundred citations pointing the same direction is still one piece of evidence if they trace to the same study. Weight claims by evidence quality and flag weak support. ${RULES}`,
  },
  {
    id: "FRONTEND", name: "Frontend Developer", emoji: "🖥️", division: "Engineering",
    blurb: "Modern web UI implementation — responsive, accessible, pixel-precise, performance-minded.",
    system: `You are an expert Frontend Developer specializing in modern web technologies, UI implementation, and performance optimization. You build responsive, accessible interfaces with pixel-perfect precision. When you write code, it is complete and runnable. ${RULES}`,
  },
  {
    id: "BACKEND", name: "Backend Architect", emoji: "🏗️", division: "Engineering",
    blurb: "Scalable system design, databases, APIs, cloud — the systems that hold everything up.",
    system: `You are a senior Backend Architect specializing in scalable system design, database architecture, API development, and cloud infrastructure. You design robust, secure, performant server-side systems and say plainly where the load-bearing risks are. ${RULES}`,
  },
  {
    id: "SENIOR", name: "Senior Developer", emoji: "💎", division: "Engineering",
    blurb: "Premium implementation craft — advanced CSS, rich interaction, the polish pass.",
    system: `You are a Senior Developer and premium implementation specialist — advanced CSS, rich interactive experiences, and refined full-stack craft. Your work is the difference between functional and exceptional. ${RULES}`,
  },
  {
    id: "UIDESIGN", name: "UI Designer", emoji: "🎨", division: "Design",
    blurb: "Visual design systems and component libraries — beautiful, consistent, accessible.",
    system: `You are an expert UI Designer specializing in visual design systems, component libraries, and pixel-perfect interface creation. You create beautiful, consistent, accessible interfaces that reflect brand identity and feel just right. ${RULES}`,
  },
  {
    id: "UX", name: "UX Architect", emoji: "📐", division: "Design",
    blurb: "Foundations developers love: CSS systems, layout logic, clear implementation guidance.",
    system: `You are a UX Architect — a technical architecture and UX specialist who gives developers solid foundations, CSS systems, and clear implementation guidance. You think in flows and failure states before pixels. ${RULES}`,
  },
  {
    id: "COPY", name: "Content Creator", emoji: "✍️", division: "Marketing",
    blurb: "Multi-platform copy and brand storytelling that earns attention honestly.",
    system: `You are an expert Content Creator and strategist for multi-platform campaigns. You craft compelling stories and copy optimized for each channel, in a human voice, with a clear call to action. ${RULES}`,
  },
  {
    id: "SEO", name: "SEO Specialist", emoji: "🔎", division: "Marketing",
    blurb: "Technical SEO and content strategy — sustainable organic growth, data-driven.",
    system: `You are an expert SEO Specialist — technical SEO, content optimization, and organic growth strategy. You work from search intent and evidence, not tricks, and you separate quick wins from long games. ${RULES}`,
  },
  {
    id: "OUTBOUND", name: "Outbound Strategist", emoji: "🎯", division: "Sales",
    blurb: "Signal-based outbound: ICPs and sequences built on research, not volume.",
    system: `You are an Outbound Strategist — a signal-based outbound specialist who designs multi-channel prospecting sequences, defines ICPs, and builds pipeline through research-driven personalization, not volume. Every message you draft could be approved by the prospect's own boss. ${RULES}`,
  },
  {
    id: "REVIEWER", name: "Code Reviewer", emoji: "👁️", division: "Engineering",
    blurb: "Reviews like a mentor: correctness, security, maintainability — every comment teaches.",
    system: `You are an expert Code Reviewer who gives constructive, actionable feedback focused on correctness, maintainability, security, and performance — not style preferences. You review like a mentor, not a gatekeeper, and you rank findings by severity. ${RULES}`,
  },
  {
    id: "QA", name: "Reality Checker", emoji: "🧐", division: "Testing",
    blurb: "Stops fantasy approvals. Defaults to NEEDS WORK — demands overwhelming proof.",
    system: `You are the Reality Checker. You stop fantasy approvals and evidence-free claims. Your default verdict is "NEEDS WORK" and production readiness requires overwhelming proof. You hunt overclaims, missing evidence, and gaps between what is said and what is shown. ${RULES}`,
  },
];

const byId = (id: string) => AGENTS.find((a) => a.id === id)!;

const FALLBACK_ROUTES: Array<{ match: RegExp; team: string[] }> = [
  { match: /landing|page|website|site|ui|design|app|interface/i, team: ["UX", "FRONTEND", "COPY"] },
  { match: /email|outreach|lead|prospect|sales|pitch|cold/i, team: ["OUTBOUND", "COPY", "SCOUT"] },
  { match: /seo|rank|google|search|traffic/i, team: ["SEO", "COPY", "SCOUT"] },
  { match: /api|backend|database|server|system|architect/i, team: ["BACKEND", "FRONTEND", "SCOUT"] },
  { match: /research|market|competitor|analyze|compare/i, team: ["SCOUT", "SEO", "OUTBOUND"] },
  { match: /video|content|post|social|brand/i, team: ["COPY", "UIDESIGN", "SEO"] },
];

function ollamaBase(): string {
  try { return (localStorage.getItem("je-ollama-url") ?? "http://localhost:11434").replace(/\/$/, ""); }
  catch { return "http://localhost:11434"; }
}
function activeModel(): string {
  try { return localStorage.getItem("je-active-model") ?? ""; } catch { return ""; }
}

/* ------------------------------ sandbox ui -------------------------------- */

interface Sandbox {
  box: HTMLDivElement;
  log: HTMLDivElement;
  setState(state: string, cls?: string): void;
  setTask(task: string): void;
  write(text: string): void;
}

function makeSandbox(agent: Agent): Sandbox {
  const grid = document.getElementById("sandbox-grid") as HTMLDivElement;
  const box = document.createElement("div");
  box.className = "sandbox";
  const head = document.createElement("div");
  head.className = "sandbox-head";
  const name = document.createElement("strong");
  name.textContent = `${agent.emoji} ${agent.name.toUpperCase()} · SANDBOX`;
  const state = document.createElement("span");
  state.className = "sb-state";
  state.textContent = "QUEUED";
  head.append(name, state);
  const task = document.createElement("div");
  task.className = "sandbox-task";
  const log = document.createElement("div");
  log.className = "sandbox-log";
  box.append(head, task, log);
  grid.prepend(box);
  return {
    box, log,
    setState(s, cls) { state.textContent = s; state.className = `sb-state ${cls ?? ""}`; },
    setTask(t) { task.textContent = t ? `Assignment: ${t}` : ""; },
    write(text) { log.textContent = text; log.scrollTop = log.scrollHeight; },
  };
}

function setAgentState(id: string, state: string, cls = "") {
  const el = document.getElementById(`agent-state-${id}`);
  if (el) { el.textContent = state; el.className = `a-state ${cls}`; }
}

/* ------------------------------- model call -------------------------------- */

async function agentCall(agent: Agent, user: string, sb: Sandbox): Promise<string> {
  const base = ollamaBase();
  const model = activeModel();
  sb.setState("WORKING", "working");
  setAgentState(agent.id, "WORKING", "working");
  let full = "";
  try {
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [
          { role: "system", content: agent.system },
          { role: "user", content: user },
        ],
      }),
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
          if (piece) { full += piece; sb.write(full); }
        } catch { /* partial */ }
      }
    }
    sb.setState("DONE", "done");
    setAgentState(agent.id, "DONE", "done");
    return full.trim();
  } catch {
    sb.setState("BLOCKED", "");
    sb.write("⚠ Could not reach the local model. This agent produced nothing rather than faking output.");
    setAgentState(agent.id, "BLOCKED", "blocked");
    return "";
  }
}

/* ------------------------------- mission run ------------------------------- */

let missionRunning = false;

async function runMission(mission: string) {
  if (missionRunning || !mission.trim()) return;
  const model = activeModel();
  const grid = document.getElementById("sandbox-grid") as HTMLDivElement;
  grid.innerHTML = "";

  if (!model) {
    const lead = byId("LEAD");
    const sb = makeSandbox(lead);
    sb.setTask(mission);
    sb.setState("STANDING DOWN", "");
    sb.write("The Dev Team needs a live local model. Ollama is offline or no model is selected in the Command view — the team will not fake work. Start Ollama, pull a model, then relaunch the mission.");
    emitFeed("agent", `Mission stood down (no model): “${mission}”`);
    return;
  }

  missionRunning = true;
  const btn = document.getElementById("btn-mission") as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = "Team working…";
  emitFeed("agent", `Mission launched: “${mission}” (model: ${model})`);

  try {
    /* 1 — Lead plans */
    const lead = byId("LEAD");
    const leadSb = makeSandbox(lead);
    leadSb.setTask("Plan the mission and assign the bench.");
    const roster = AGENTS.filter((a) => !["LEAD", "REVIEWER", "QA"].includes(a.id))
      .map((a) => `${a.id}: ${a.name} — ${a.blurb}`).join("\n");
    const planText = await agentCall(lead,
      `Mission: ${mission}\n\nYour bench:\n${roster}\n\nChoose exactly 3 specialists for this mission. Reply with exactly 3 lines and nothing else, in this format:\nID: the specific assignment for that agent`,
      leadSb);

    let chosen: Array<{ agent: Agent; task: string }> = [];
    if (planText) {
      for (const line of planText.split("\n")) {
        const m = line.match(/^([A-Z]+)\s*[:\-—]\s*(.+)$/);
        if (m && !["LEAD", "REVIEWER", "QA"].includes(m[1]) && byId(m[1]) && !chosen.some((c) => c.agent.id === m[1])) {
          chosen.push({ agent: byId(m[1]), task: m[2].trim() });
        }
        if (chosen.length >= 3) break;
      }
    }
    if (chosen.length < 3) {
      const route = FALLBACK_ROUTES.find((r) => r.match.test(mission)) ?? FALLBACK_ROUTES[0];
      for (const id of route.team) {
        if (!chosen.some((c) => c.agent.id === id)) {
          chosen.push({ agent: byId(id), task: `Apply your specialty to this mission: ${mission}` });
        }
        if (chosen.length >= 3) break;
      }
      leadSb.write(`${planText ? planText + "\n\n" : ""}[Producer's note: bench assignment completed by routing table — ${chosen.map((c) => c.agent.name).join(", ")}.]`);
    }
    leadSb.setState("PLAN SET", "done");
    emitFeed("agent", `Lead assigned: ${chosen.map((c) => c.agent.name).join(" · ")}`);

    /* 2 — specialists in parallel */
    const outputs = await Promise.all(chosen.map(async (c) => {
      const sb = makeSandbox(c.agent);
      sb.setTask(c.task);
      const out = await agentCall(c.agent, `Mission: ${mission}\n\nYour assignment from the Studio Producer: ${c.task}`, sb);
      emitFeed("agent", `${c.agent.name} finished their sandbox run.`);
      return { agent: c.agent, task: c.task, out };
    }));

    /* 3 — Reviewer + Reality Checker in parallel */
    const combined = outputs.map((o) => `## ${o.agent.name}\n${o.out || "(no output — model unreachable)"}`).join("\n\n");
    const reviewer = byId("REVIEWER");
    const qa = byId("QA");
    const revSb = makeSandbox(reviewer);
    revSb.setTask("Review the team's work product.");
    const qaSb = makeSandbox(qa);
    qaSb.setTask("Reality-check every claim in the work product.");
    const [review, reality] = await Promise.all([
      agentCall(reviewer, `Mission: ${mission}\n\nThe team's work product:\n\n${combined}\n\nReview it: correctness, gaps, risks, and the specific fixes that matter most. Rank by severity.`, revSb),
      agentCall(qa, `Mission: ${mission}\n\nThe team's work product:\n\n${combined}\n\nReality-check it: list every claim that lacks evidence, anything overstated, and your verdict — READY or NEEDS WORK — with the reasons.`, qaSb),
    ]);

    /* 4 — Lead ships the deliverable */
    const finalSb = makeSandbox(lead);
    finalSb.setTask("Assemble the final deliverable.");
    const deliverable = await agentCall(lead,
      `Mission: ${mission}\n\nSpecialist work:\n\n${combined}\n\nCode Reviewer:\n${review}\n\nReality Checker:\n${reality}\n\nWrite the final deliverable for the operator: the finished work product itself (fold in the fixes that matter), followed by a short "What to check before you use this" list drawn from the reviews. This goes to the operator's approval queue — do not claim anything was sent, published, or deployed.`,
      finalSb);

    const report = [
      `# Mission report — ${mission}`,
      ``,
      `Model: ${model} · Team: Lead + ${chosen.map((c) => c.agent.name).join(", ")} + Reviewer + Reality Checker`,
      ``,
      `## Final deliverable`,
      deliverable || "(The Lead produced no final text — see the sandbox logs.)",
      ``,
      `## Specialist work`,
      combined,
      ``,
      `## Code Reviewer`,
      review || "(no review produced)",
      ``,
      `## Reality Checker`,
      reality || "(no reality check produced)",
    ].join("\n");

    addArtifact(`Mission — ${mission.slice(0, 80)}`, "MISSION REPORT", report);
    window.dispatchEvent(new CustomEvent("je-queue-add", {
      detail: { kind: "MISSION REPORT", title: `Mission: ${mission.slice(0, 90)}`, body: report.slice(0, 1200) },
    }));
    emitFeed("agent", `Mission complete — report filed to Artifacts and the approval queue.`);
  } finally {
    missionRunning = false;
    btn.disabled = false;
    btn.textContent = "Launch mission";
  }
}

/* ---------------------------------- init ----------------------------------- */

export function initTeam() {
  const rosterEl = document.getElementById("team-roster") as HTMLDivElement;
  rosterEl.innerHTML = "";
  for (const agent of AGENTS) {
    const card = document.createElement("div");
    card.className = "agent-card";
    const name = document.createElement("div");
    name.className = "a-name";
    name.textContent = `${agent.emoji} ${agent.name}`;
    const role = document.createElement("div");
    role.className = "a-role";
    role.textContent = `${agent.division} — ${agent.blurb}`;
    const state = document.createElement("div");
    state.className = "a-state";
    state.id = `agent-state-${agent.id}`;
    state.textContent = "STANDING BY";
    card.append(name, role, state);
    rosterEl.appendChild(card);
  }

  const form = document.getElementById("mission-form") as HTMLFormElement;
  const input = document.getElementById("mission-input") as HTMLInputElement;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const mission = input.value.trim();
    if (!mission) return;
    input.value = "";
    void runMission(mission);
  });

  window.addEventListener("je-mission", (e) => {
    const text = (e as CustomEvent<string>).detail;
    switchView("agents");
    void runMission(text);
  });
}
