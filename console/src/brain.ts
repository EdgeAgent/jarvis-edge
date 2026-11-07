// Second Brain — the map. An Obsidian-style node graph of everything Jarvis
// knows locally: brain documents, ideas, and goals, linked by shared
// keywords. When a chat answer pulls from the second brain, main.ts fires
// "je-brain-used" and the nodes that contributed light up gold.
//
// Everything is computed and stored on this machine. No graph library,
// no network — one canvas, a small force layout, and the operator's data.

interface GNode {
  key: string;
  kind: "doc" | "idea" | "goal";
  label: string;
  meta: string;
  body: string;
  weight: number;
  keywords: Set<string>;
  x: number; y: number; vx: number; vy: number;
  r: number;
}
interface GEdge { a: number; b: number; w: number }

const STOP = new Set(["the", "and", "for", "with", "that", "this", "from", "your", "you", "are", "was", "will", "have", "has", "not", "but", "all", "can", "per", "into", "over", "than", "then", "them", "they", "about", "every", "never", "only", "more", "most", "what", "when", "says", "said"]);

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function keywords(text: string): Set<string> {
  const out = new Set<string>();
  for (const w of text.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []) {
    if (!STOP.has(w)) out.add(w);
  }
  return out;
}

interface BrainDocShape { id: string; name: string; chunks: string[] }
interface IdeaShape { title: string; note: string }
interface GoalShape { title: string; steps: Array<{ text: string }> }

function buildGraph(): { nodes: GNode[]; edges: GEdge[] } {
  const nodes: GNode[] = [];
  const docs = readJSON<BrainDocShape[]>("je-brain", []);
  for (const doc of docs) {
    const text = doc.chunks.join("\n\n");
    nodes.push({
      key: `doc:${doc.id}`, kind: "doc", label: doc.name,
      meta: `Document · ${doc.chunks.length} chunk${doc.chunks.length === 1 ? "" : "s"}`,
      body: text.slice(0, 900),
      weight: 6 + Math.min(14, doc.chunks.length * 3),
      keywords: keywords(`${doc.name} ${text}`),
      x: 0, y: 0, vx: 0, vy: 0, r: 0,
    });
  }
  for (const idea of readJSON<IdeaShape[]>("je-ideas", [])) {
    nodes.push({
      key: `idea:${idea.title}`, kind: "idea", label: idea.title,
      meta: "Idea", body: idea.note || idea.title,
      weight: 7, keywords: keywords(`${idea.title} ${idea.note}`),
      x: 0, y: 0, vx: 0, vy: 0, r: 0,
    });
  }
  for (const goal of readJSON<GoalShape[]>("je-goals", [])) {
    nodes.push({
      key: `goal:${goal.title}`, kind: "goal", label: goal.title,
      meta: `Goal · ${goal.steps.length} steps`,
      body: goal.steps.map((s) => `• ${s.text}`).join("\n") || goal.title,
      weight: 8, keywords: keywords(`${goal.title} ${goal.steps.map((s) => s.text).join(" ")}`),
      x: 0, y: 0, vx: 0, vy: 0, r: 0,
    });
  }
  const edges: GEdge[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      let shared = 0;
      for (const k of nodes[i].keywords) if (nodes[j].keywords.has(k)) shared++;
      if (shared >= 2) edges.push({ a: i, b: j, w: shared });
    }
  }
  // keep each node's strongest links so the map stays readable
  const degree = new Map<number, number>();
  edges.sort((x, y) => y.w - x.w);
  const kept = edges.filter((e) => {
    const da = degree.get(e.a) ?? 0, db = degree.get(e.b) ?? 0;
    if (da >= 6 || db >= 6) return false;
    degree.set(e.a, da + 1); degree.set(e.b, db + 1);
    return true;
  });
  for (const n of nodes) n.r = 7 + n.weight * 0.55;
  return { nodes, edges: kept };
}

const COLORS: Record<GNode["kind"], string> = { doc: "#39d5e8", idea: "#e8b34b", goal: "#2ee6a8" };

export function initBrain() {
  const canvas = document.getElementById("brain-canvas") as HTMLCanvasElement | null;
  const detail = document.getElementById("brain-detail") as HTMLDivElement | null;
  const section = document.getElementById("view-brain");
  if (!canvas || !detail || !section) return;
  const cv: HTMLCanvasElement = canvas;
  const ctx = cv.getContext("2d")!;
  const W = canvas.width, H = canvas.height;

  let graph = buildGraph();
  let positions = new Map<string, { x: number; y: number }>();
  const litUntil = new Map<string, number>();
  let hover: GNode | null = null;
  let drag: GNode | null = null;
  let needsLayout = true;

  function place() {
    const cx = W / 2, cy = H / 2;
    graph.nodes.forEach((n, i) => {
      const prev = positions.get(n.key);
      if (prev) { n.x = prev.x; n.y = prev.y; }
      else {
        // golden-angle spiral: even spread, no two nodes start on top of each other
        const a = i * 2.39996;
        const rad = 46 * Math.sqrt(i + 0.6);
        n.x = cx + Math.cos(a) * rad * 1.5;
        n.y = cy + Math.sin(a) * rad * 0.92;
      }
      n.vx = 0; n.vy = 0;
    });
    // pre-settle so the first visible frame already looks like a graph
    for (let s = 0; s < 110; s++) step();
  }

  function rebuild() {
    positions = new Map(graph.nodes.map((n) => [n.key, { x: n.x, y: n.y }]));
    graph = buildGraph();
    place();
    needsLayout = true;
  }

  function step() {
    const { nodes, edges } = graph;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d = Math.hypot(dx, dy);
        if (d < 4) { dx = 3; dy = 2; d = 4; }
        // gentle coulomb-style repulsion, capped so close nodes never explode
        const force = Math.min(2.6, 1500 / (d * d)) * 0.9;
        const fx = (dx / d) * force, fy = (dy / d) * force;
        if (a !== drag) { a.vx += fx; a.vy += fy; }
        if (b !== drag) { b.vx -= fx; b.vy -= fy; }
      }
    }
    for (const e of edges) {
      const a = nodes[e.a], b = nodes[e.b];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      const target = 185;
      const f = (d - target) * 0.0035;
      if (a !== drag) { a.vx += dx * f; a.vy += dy * f; }
      if (b !== drag) { b.vx -= dx * f; b.vy -= dy * f; }
    }
    for (const n of nodes) {
      if (n === drag) continue;
      n.vx += (W / 2 - n.x) * 0.0016;
      n.vy += (H / 2 - n.y) * 0.0016;
      n.vx *= 0.86; n.vy *= 0.86;
      n.vx = Math.max(-5, Math.min(5, n.vx));
      n.vy = Math.max(-5, Math.min(5, n.vy));
      n.x += n.vx; n.y += n.vy;
      n.x = Math.max(n.r + 10, Math.min(W - n.r - 10, n.x));
      n.y = Math.max(n.r + 14, Math.min(H - n.r - 22, n.y));
    }
  }

  function draw(now: number) {
    ctx.clearRect(0, 0, W, H);
    const { nodes, edges } = graph;
    if (!nodes.length) {
      ctx.fillStyle = "rgba(148,184,214,0.75)";
      ctx.font = "15px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Your brain is empty — add files in the Command view and the map grows.", W / 2, H / 2);
      return;
    }
    for (const e of edges) {
      const a = nodes[e.a], b = nodes[e.b];
      const lit = (litUntil.get(a.label) ?? 0) > now && (litUntil.get(b.label) ?? 0) > now;
      ctx.strokeStyle = lit ? "rgba(255,217,122,0.75)" : "rgba(94,205,240,0.20)";
      ctx.lineWidth = lit ? 2 : Math.min(2.4, 0.5 + e.w * 0.3);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (const n of nodes) {
      const lit = (litUntil.get(n.label) ?? 0) > now;
      const color = lit ? "#ffd97a" : COLORS[n.kind];
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = lit ? 30 : 13;
      ctx.fillStyle = "rgba(6,13,26,0.95)";
      ctx.strokeStyle = color;
      ctx.lineWidth = n === hover ? 2.6 : 1.6;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(n.x, n.y, Math.max(2.5, n.r * 0.3), 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = "rgba(214,236,248,0.92)";
      ctx.font = "10.5px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      const label = n.label.length > 26 ? n.label.slice(0, 25) + "…" : n.label;
      ctx.fillText(label, n.x, n.y + n.r + 15);
    }
  }

  let lastRebuild = 0;
  function loop(now: number) {
    requestAnimationFrame(loop);
    if (section!.hidden) return;
    if (needsLayout || now - lastRebuild > 5000) {
      // pick up new docs/ideas/goals while the view is open
      if (now - lastRebuild > 5000) { lastRebuild = now; rebuild(); }
      needsLayout = false;
    }
    step();
    draw(now);
  }
  requestAnimationFrame(loop);

  function toLocal(e: PointerEvent) {
    const rect = cv.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
  }
  function pick(e: PointerEvent): GNode | null {
    const { x, y } = toLocal(e);
    let best: GNode | null = null, bestD = 1e9;
    for (const n of graph.nodes) {
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < n.r + 10 && d < bestD) { best = n; bestD = d; }
    }
    return best;
  }
  cv.addEventListener("pointermove", (e) => {
    if (drag) {
      const { x, y } = toLocal(e);
      drag.x = x; drag.y = y; drag.vx = 0; drag.vy = 0;
      return;
    }
    hover = pick(e);
    cv.style.cursor = hover ? "pointer" : "grab";
  });
  cv.addEventListener("pointerdown", (e) => {
    const n = pick(e);
    if (n) {
      drag = n;
      detail.innerHTML = "";
      const title = document.createElement("strong");
      title.textContent = n.label;
      const meta = document.createElement("div");
      meta.className = "bd-meta";
      meta.textContent = n.meta;
      const body = document.createElement("div");
      body.className = "bd-body";
      body.textContent = n.body || "(no content)";
      detail.append(title, meta, body);
    }
  });
  window.addEventListener("pointerup", () => { drag = null; });

  window.addEventListener("je-brain-used", (e) => {
    const names = (e as CustomEvent<string[]>).detail ?? [];
    for (const name of names) litUntil.set(name, performance.now() + 600000); // stays lit until the next answer, per the legend
  });
  document.querySelectorAll<HTMLButtonElement>(".nav-btn").forEach((b) => {
    b.addEventListener("click", () => { if (b.dataset.nav === "brain") rebuild(); });
  });
}
