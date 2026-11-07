// Execution engine — the approval gate is a trigger, not a vault.
// Nothing in this file runs until the operator approves a queue item.
// On approval, the item EXECUTES through a channel the operator controls:
//
//   1. Execution endpoint (Settings → "Execution endpoint"): the item is
//      POSTed as JSON to the operator's own webhook — n8n, Make,
//      GoHighLevel, Hermes — and THEIR stack does the sending with THEIR
//      credentials. The console never holds a mail password or API key.
//   2. No endpoint configured: email drafts open in the operator's own
//      mail app, composed and ready; reminders fire a system
//      notification; everything else is saved to disk as a file.
//
// Every execution reports its real outcome — delivered, opened, saved,
// or failed with the reason. It never claims a send that didn't happen.

export interface ExecutableItem {
  id: string;
  kind: string;
  title: string;
  body: string;
}

export interface ExecOutcome {
  ok: boolean;
  via: string;
  detail: string;
}

const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      try { return JSON.parse(raw) as T; } catch { return raw as unknown as T; }
    } catch { return fallback; }
  },
};

export function execEndpoint(): string {
  return store.get<string>("je-exec-url", "").trim();
}

export function looksHtml(text: string): boolean {
  const t = text.trim();
  return /^<!doctype html/i.test(t) || /^<html[\s>]/i.test(t) || /```html/i.test(text);
}

export function extractHtml(text: string): string {
  const fenced = text.match(/```html\s*\n([\s\S]*?)```/i);
  if (fenced) return fenced[1];
  const doc = text.match(/<!doctype html[\s\S]*?<\/html>/i);
  if (doc) return doc[0];
  return text;
}

/** Human-readable route an item will take if approved right now. */
export function routeLabel(item: ExecutableItem): string {
  const url = execEndpoint();
  if (url) {
    try { return `Executes via your endpoint · ${new URL(url).host}`; }
    catch { return "Executes via your endpoint"; }
  }
  if (/email/i.test(item.kind)) return "Executes via your mail app (compose opens ready to send)";
  if (/remind/i.test(item.kind)) return "Executes as a system notification";
  return "Executes as a file saved to this machine";
}

function saveFile(item: ExecutableItem): ExecOutcome {
  const html = looksHtml(item.body);
  const content = html ? extractHtml(item.body) : item.body;
  const ext = html ? "html" : "md";
  const name = `${item.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "jarvis-item"}.${ext}`;
  const blob = new Blob([content], { type: html ? "text/html;charset=utf-8" : "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { ok: true, via: "file", detail: `Saved as ${name} on this machine.` };
}

async function fireNotification(item: ExecutableItem): Promise<ExecOutcome> {
  try {
    if (!("Notification" in window)) return saveFile(item);
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm !== "granted") {
      return { ok: true, via: "feed", detail: "Notification permission not granted — reminder fired to the Feed instead." };
    }
    new Notification("Jarvis-Edge reminder", { body: item.title });
    return { ok: true, via: "notification", detail: "System notification fired." };
  } catch {
    return saveFile(item);
  }
}

function openMailCompose(item: ExecutableItem): ExecOutcome {
  const subject = encodeURIComponent(item.title);
  const body = encodeURIComponent(item.body);
  const a = document.createElement("a");
  a.href = `mailto:?subject=${subject}&body=${body}`;
  a.click();
  return { ok: true, via: "mail app", detail: "Opened composed in your mail app — one click there sends it. Connect an execution endpoint and approvals deliver straight to your stack instead." };
}

async function postToEndpoint(item: ExecutableItem, url: string): Promise<ExecOutcome> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "jarvis-edge",
        event: "queue.approved",
        kind: item.kind,
        title: item.title,
        body: item.body,
        approvedAt: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return { ok: false, via: "endpoint", detail: `Your endpoint answered HTTP ${res.status}. The item was NOT delivered — check the endpoint and re-run.` };
    return { ok: true, via: "endpoint", detail: `Delivered to your endpoint (${new URL(url).host}) — your stack takes it from there.` };
  } catch (err) {
    return { ok: false, via: "endpoint", detail: `Could not reach your endpoint (${err instanceof Error ? err.message : "network error"}). Nothing was delivered — re-run when it's back.` };
  }
}

/** Execute one approved item. Called ONLY from the operator's approve action. */
export async function executeItem(item: ExecutableItem): Promise<ExecOutcome> {
  const url = execEndpoint();
  if (url) return postToEndpoint(item, url);
  if (/email/i.test(item.kind)) return openMailCompose(item);
  if (/remind/i.test(item.kind)) return fireNotification(item);
  return saveFile(item);
}
