# 🛡️ Jarvis-Edge: Testing & Security Guide

This guide explains how to safely operate the **God-mode** system control capabilities and verify the swarm architecture locally.

---

## 1. Configuring Safety Guardrails

The `worker-system` has direct access to your OS. To prevent accidental or malicious execution, we implement three layers of security:

### Layer 1: Command Whitelisting
The **Reactor Core** maintains a whitelist of allowed shell commands. 
- **Default allowed**: `ls`, `pwd`, `docker ps`, `echo`.
- **How to update**: Call the `core__configure_guardrails` tool to add new patterns (e.g., `git`, `npm`).

### Layer 2: Strict Approval Mode
By default, Jarvis-Edge runs in **Strict Mode**. Any command not on the whitelist will be blocked by the Reactor Core with a `SECURITY ALERT`.
- **Environment Variable**: Set `STRICT_MODE=true` in your `docker-compose.yml`.

### Layer 3: OS-Level Scoping (Recommended)
Run the `worker-system` container with a non-root user and limit its volume mounts.
- **Example**: Only mount `~/Downloads` instead of the entire `$HOME` directory.

---

## 2. Testing the Swarm Locally

Once you have ignited the swarm (`docker-compose up --build`), you can test the end-to-end flow using `curl` or by connecting it to an MCP client like Claude Desktop.

### Sample Test Prompt: "Open my browser and audit the current page"

**Step 1: System Control (Open App)**
```bash
curl -X POST http://localhost:8004/execute \
     -H "Content-Type: application/json" \
     -d '{"action": "shell", "command": "open -a \"Google Chrome\""}'
```

**Step 2: Browser Observer (Audit Sandbox)**
```bash
curl -X POST http://localhost:8005/audit \
     -H "Content-Type: application/json" \
     -d '{"url": "https://github.com/EdgeAgent", "extract_dom": true}'
```

---

## 3. Capabilities: Can it do anything?

Yes. The `worker-system` uses `PyAutoGUI` and `subprocess` to bridge the gap between AI and the OS.

| Capability | Method | Example Use Case |
| :--- | :--- | :--- |
| **Open Apps** | `shell` -> `open` / `start` | "Jarvis, open Slack and check for mentions." |
| **Type & Click** | `pyautogui` | "Jarvis, fill out this form in the active window." |
| **Monitor Web** | `playwright` | "Jarvis, watch this stock price and alert me if it drops." |
| **System Admin** | `shell` | "Jarvis, restart the Docker swarm if memory exceeds 80%." |

---

> **⚠️ WARNING**: God-mode grants the AI agent the same permissions as the user running the container. Always review the `Reactor Core` logs during execution.
