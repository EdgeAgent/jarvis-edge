// Reactor Core visual — canvas-rendered concentric reactor rings.
// State-driven: standby / listening / thinking / speaking, plus a level
// value (0..1) that swells the core while Jarvis listens or speaks.

export type CoreMode = "standby" | "listening" | "thinking" | "speaking";

export interface Reactor {
  setMode(mode: CoreMode): void;
  setLevel(level: number): void;
}

interface Particle {
  angle: number;
  radius: number;
  speed: number;
  size: number;
}

export function createReactor(canvas: HTMLCanvasElement): Reactor {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { setMode() {}, setLevel() {} };

  let mode: CoreMode = "standby";
  let level = 0;
  let levelShown = 0;
  let t = 0;

  const particles: Particle[] = Array.from({ length: 64 }, (_, i) => ({
    angle: (i / 64) * Math.PI * 2 + Math.random() * 0.3,
    radius: 0.62 + Math.random() * 0.3,
    speed: (Math.random() * 0.5 + 0.2) * (i % 2 === 0 ? 1 : -1),
    size: Math.random() * 1.8 + 0.6,
  }));

  const COLORS = {
    standby: { main: "57,213,232", hot: "174,238,255", accent: "232,179,75" },
    listening: { main: "232,179,75", hot: "255,231,170", accent: "57,213,232" },
    thinking: { main: "120,140,255", hot: "205,214,255", accent: "57,213,232" },
    speaking: { main: "45,212,191", hot: "178,255,240", accent: "232,179,75" },
  } as const;

  function ring(cx: number, cy: number, r: number, width: number, color: string, alpha: number) {
    ctx!.beginPath();
    ctx!.arc(cx, cy, r, 0, Math.PI * 2);
    ctx!.strokeStyle = `rgba(${color},${alpha})`;
    ctx!.lineWidth = width;
    ctx!.stroke();
  }

  function arc(
    cx: number, cy: number, r: number, width: number, color: string, alpha: number,
    start: number, sweep: number,
  ) {
    ctx!.beginPath();
    ctx!.arc(cx, cy, r, start, start + sweep);
    ctx!.strokeStyle = `rgba(${color},${alpha})`;
    ctx!.lineWidth = width;
    ctx!.lineCap = "round";
    ctx!.stroke();
  }

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) / 2 - 14;
    const c = COLORS[mode];
    t += mode === "thinking" ? 0.022 : 0.011;
    levelShown += (level - levelShown) * 0.12;
    const breathe = 1 + Math.sin(t * 1.6) * 0.012 + levelShown * 0.05;

    ctx!.clearRect(0, 0, w, h);

    // outer halo
    const halo = ctx!.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.02);
    halo.addColorStop(0, `rgba(${c.main},${0.16 + levelShown * 0.12})`);
    halo.addColorStop(0.55, `rgba(${c.main},0.05)`);
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx!.fillStyle = halo;
    ctx!.beginPath();
    ctx!.arc(cx, cy, R * 1.02, 0, Math.PI * 2);
    ctx!.fill();

    // tick ring
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2 + t * 0.15;
      const long = i % 5 === 0;
      const r1 = R * 0.965;
      const r2 = R * (long ? 0.915 : 0.94);
      ctx!.beginPath();
      ctx!.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx!.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx!.strokeStyle = `rgba(${c.main},${long ? 0.65 : 0.28})`;
      ctx!.lineWidth = long ? 2 : 1.2;
      ctx!.stroke();
    }

    // structural rings
    ring(cx, cy, R * 0.88, 1.4, c.main, 0.35);
    ring(cx, cy, R * 0.74, 10, c.main, 0.10);
    ring(cx, cy, R * 0.60, 1.2, c.main, 0.4);

    // rotating segmented arcs
    const spin = mode === "thinking" ? 2.6 : 1;
    arc(cx, cy, R * 0.80, 5, c.main, 0.85, t * 1.3 * spin, Math.PI * 0.62);
    arc(cx, cy, R * 0.80, 5, c.main, 0.5, t * 1.3 * spin + Math.PI, Math.PI * 0.3);
    arc(cx, cy, R * 0.68, 3.4, c.accent, 0.75, -t * 0.9 * spin, Math.PI * 0.45);
    arc(cx, cy, R * 0.68, 3.4, c.accent, 0.4, -t * 0.9 * spin + Math.PI * 1.1, Math.PI * 0.8);
    arc(cx, cy, R * 0.52, 2.4, c.main, 0.6, t * 0.6 * spin, Math.PI * 1.2);

    // orbiting particles
    for (const p of particles) {
      p.angle += p.speed * 0.0035 * (mode === "standby" ? 1 : 2.1);
      const r = R * p.radius * breathe;
      const x = cx + Math.cos(p.angle) * r;
      const y = cy + Math.sin(p.angle) * r;
      ctx!.beginPath();
      ctx!.arc(x, y, p.size, 0, Math.PI * 2);
      ctx!.fillStyle = `rgba(${c.hot},${0.5 + levelShown * 0.4})`;
      ctx!.fill();
    }

    // core
    const coreR = R * 0.34 * breathe * (1 + levelShown * 0.16);
    const core = ctx!.createRadialGradient(cx, cy, 0, cx, cy, coreR);
    core.addColorStop(0, "rgba(255,255,255,0.98)");
    core.addColorStop(0.35, `rgba(${c.hot},0.95)`);
    core.addColorStop(0.75, `rgba(${c.main},0.55)`);
    core.addColorStop(1, `rgba(${c.main},0)`);
    ctx!.fillStyle = core;
    ctx!.beginPath();
    ctx!.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx!.fill();

    // core triangle mark (reactor signature)
    ctx!.beginPath();
    const tr = coreR * 0.42;
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3 + t * 0.25;
      const x = cx + Math.cos(a) * tr;
      const y = cy + Math.sin(a) * tr;
      if (i === 0) ctx!.moveTo(x, y); else ctx!.lineTo(x, y);
    }
    ctx!.closePath();
    ctx!.strokeStyle = "rgba(4,20,28,0.55)";
    ctx!.lineWidth = 2.4;
    ctx!.stroke();

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);

  return {
    setMode(m: CoreMode) {
      mode = m;
      if (m === "standby") level = 0;
    },
    setLevel(x: number) {
      level = Math.max(0, Math.min(1, x));
    },
  };
}
