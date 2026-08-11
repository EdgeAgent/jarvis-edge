<div align="center">

# ⚡ Jarvis-Edge: The Executive AI Command Center

### *Distributed Multi-Agent Orchestration for the Elite Executive Stack.*

[![GitHub stars](https://img.shields.io/github/stars/EdgeAgent/jarvis-edge?style=social)](https://github.com/EdgeAgent/jarvis-edge)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Tech Stack](https://img.shields.io/badge/Stack-TypeScript%20%7C%20Python%20%7C%20Docker-orange)](https://github.com/EdgeAgent/jarvis-edge)

</div>

---

## 🌌 The Vision
**Jarvis-Edge** is a high-velocity, distributed AI agent framework designed to replace the traditional Executive Assistant. It breaks the monolithic agent bottleneck by deploying a decentralized swarm of specialized workers—**Trading, Email, Acquisition, Meetings, and Voice**—all governed by a ultra-lightweight **Minimal Reactor Core**.

---

## 🏗️ Architecture: The Hub-and-Spoke Swarm

Jarvis-Edge uses a **Minimal Reactor Core** as the central brain, routing high-stakes executive tasks to specialized edge workers.

| Component | Role | Tech Stack |
| :--- | :--- | :--- |
| **Reactor Core** | The Brain: Routing, Aggregation, & Security | Node.js, TypeScript, MCP |
| **Trading Worker** | The Alpha: Market Intel & Sentiment | Python, yfinance, FastMCP |
| **Executive Worker** | The Muscle: Email, CRM, & Appointments | Python, FastAPI, GHL API |
| **Voice Worker** | The Interface: Real-time Hands-free Control | WebRTC, TTS/STT |

---

## 🚀 Key Features

### 📈 Autonomous Trading Intelligence
Directly inspired by top-tier frameworks like `TradingAgents`, this worker provides real-time market sentiment, institutional accumulation tracking, and automated trade execution.

### 📧 High-Velocity Acquisition
Automated multi-agent email management. Categorizes your inbox, identifies high-value acquisition leads, and syncs directly with **GoHighLevel (GHL)**.

### 📅 Seamless Executive Scheduling
Autonomous meeting booking and calendar conflict resolution. Generates pre-meeting executive briefings so you are always prepared.

### 🎙️ Voice-First Control
Hands-free executive management via a low-latency voice pipeline. Control your entire business swarm with natural language.

---

## 🏁 Quick Start

### 1. Ignite the Swarm
```bash
git clone https://github.com/EdgeAgent/jarvis-edge.git
cd jarvis-edge
docker-compose up --build
```

### 2. Connect Your Brain
Add the Reactor Core to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "jarvis-edge": {
      "command": "node",
      "args": ["/path/to/jarvis-edge/reactor-core/dist/index.js"]
    }
  }
}
```

---

## 🤝 Contributing
Join the elite circle of AI developers building the future of autonomous executive systems. 

1. **Fork** the repo.
2. **Build** a specialized worker.
3. **Submit** a PR.

Built with ⚡ by **Edge Agency**
*"The best way to predict the future is to automate it."*
