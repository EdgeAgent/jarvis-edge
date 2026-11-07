// Sandbox Preview — render apps, HTML artifacts and generated pages
// inside a genuinely isolated frame. The iframe runs with
// sandbox="allow-scripts" and NO allow-same-origin: previewed code gets
// an opaque origin, so it cannot touch the console, its localStorage,
// or the operator's data. It can run its own scripts and nothing else.
//
// Sources: paste HTML, open a file, load the built-in sample app, or
// send any HTML artifact here from the Artifacts view ("Preview" button
// → window event "je-preview" { detail: string }).

import { extractHtml, looksHtml } from "./execute";
import { emitFeed, switchView } from "./views";

interface ArtifactLike { id: string; title: string; kind: string; body: string; ts: number }

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const SAMPLE_APP = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Mission Control — sample app</title>
<style>
  body { margin:0; font-family: system-ui, sans-serif; background:#0a0e14; color:#e8ecf1; display:grid; place-items:center; min-height:100vh; }
  .card { background:#101722; border:1px solid #22304a; border-radius:16px; padding:28px 32px; text-align:center; width:min(420px, 88vw); }
  h1 { font-size:20px; margin:0 0 6px; }
  p { color:#8fa3bf; margin:0 0 18px; font-size:14px; }
  .big { font-size:56px; font-weight:700; color:#6fd8e7; margin:8px 0 16px; }
  button { background:#e9e4d8; border:0; color:#0a0c0f; font-weight:700; padding:12px 22px; border-radius:10px; cursor:pointer; font-size:15px; }
  button:active { transform: scale(.97); }
  .bar { height:10px; background:#1a2436; border-radius:99px; overflow:hidden; margin-top:20px; }
  .bar i { display:block; height:100%; width:0%; background:linear-gradient(90deg,#6fd8e7,#e9e4d8); transition:width .4s; }
</style>
</head>
<body>
  <div class="card">
    <h1>🚀 Mission Control</h1>
    <p>A tiny app running inside the Jarvis sandbox. It can run scripts — it cannot touch the console.</p>
    <div class="big" id="count">0</div>
    <button id="go" type="button">Launch +1</button>
    <div class="bar"><i id="fill"></i></div>
  </div>
<script>
  let n = 0;
  document.getElementById("go").addEventListener("click", () => {
    n++;
    document.getElementById("count").textContent = n;
    document.getElementById("fill").style.width = Math.min(100, n * 5) + "%";
  });
</script>
</body>
</html>`;

function artifactsFromStore(): ArtifactLike[] {
  try {
    const raw = localStorage.getItem("je-artifacts");
    return raw ? (JSON.parse(raw) as ArtifactLike[]) : [];
  } catch { return []; }
}

export function initPreview() {
  const frame = $<HTMLIFrameElement>("preview-frame");
  const source = $<HTMLTextAreaElement>("preview-source");
  const picker = $<HTMLSelectElement>("preview-picker");
  const titleEl = $("preview-title");

  function render(html: string, label: string) {
    frame.srcdoc = html;
    titleEl.textContent = label;
  }

  function refreshPicker() {
    const arts = artifactsFromStore().filter((a) => looksHtml(a.body));
    picker.innerHTML = "";
    const none = document.createElement("option");
    none.value = "";
    none.textContent = arts.length ? "Open an HTML artifact…" : "No HTML artifacts yet";
    picker.appendChild(none);
    for (const a of arts) {
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = `${a.title} · ${new Date(a.ts).toLocaleDateString()}`;
      picker.appendChild(opt);
    }
  }

  $("btn-preview-run").addEventListener("click", () => {
    const html = source.value.trim();
    if (!html) return;
    render(html, "Custom HTML — pasted source");
    emitFeed("system", "Sandbox preview rendered pasted HTML.");
  });

  $("btn-preview-sample").addEventListener("click", () => {
    source.value = SAMPLE_APP;
    render(SAMPLE_APP, "Sample app — Mission Control");
    emitFeed("system", "Sandbox preview loaded the sample app.");
  });

  picker.addEventListener("change", () => {
    const art = artifactsFromStore().find((a) => a.id === picker.value);
    if (!art) return;
    const html = extractHtml(art.body);
    source.value = html;
    render(html, art.title);
    emitFeed("system", `Sandbox preview opened artifact “${art.title}”.`);
  });

  const fileInput = $<HTMLInputElement>("preview-file");
  $("btn-preview-file").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const html = String(reader.result ?? "");
      source.value = html;
      render(html, file.name);
      emitFeed("system", `Sandbox preview opened ${file.name}.`);
    };
    reader.readAsText(file);
  });

  window.addEventListener("je-preview", (e) => {
    const body = (e as CustomEvent<string>).detail ?? "";
    if (!body) return;
    const html = extractHtml(body);
    source.value = html;
    render(html, "Artifact preview");
    refreshPicker();
    switchView("preview");
  });
  window.addEventListener("je-artifacts-changed", refreshPicker);

  refreshPicker();
  source.value = SAMPLE_APP;
  render(SAMPLE_APP, "Sample app — Mission Control");
}
