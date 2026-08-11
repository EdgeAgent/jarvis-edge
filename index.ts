import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";

/**
 * ⚡ Jarvis-Edge: Minimal Reactor Core
 * The central brain of the executive swarm — God-Mode enabled.
 */

interface Worker {
  id: string;
  url: string;
  tools: any[];
}

class ReactorCore {
  private server: Server;
  private workers: Map<string, Worker> = new Map();
  private commandWhitelist: string[] = ["ls", "pwd", "docker ps", "echo", "python --version"];
  private approvalRequired: boolean = process.env.STRICT_MODE === "true";

  constructor() {
    this.server = new Server(
      {
        name: "jarvis-reactor-core",
        version: "1.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    this.autoRegisterWorkers();
  }

  private async autoRegisterWorkers() {
    const defaultWorkers = [
      { id: "trading", url: process.env.TRADING_WORKER_URL || "http://worker-trading:8002" },
      { id: "executive", url: process.env.EXECUTIVE_WORKER_URL || "http://worker-executive:8003" },
      { id: "system", url: process.env.SYSTEM_WORKER_URL || "http://worker-system:8004" },
      { id: "observer", url: process.env.OBSERVER_WORKER_URL || "http://worker-observer:8005" },
    ];

    for (const w of defaultWorkers) {
      try {
        // Attempt registration but don't crash if worker is still booting
        this.registerWorker(w.id, w.url).catch(() => {});
      } catch (e) {}
    }
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const allTools = Array.from(this.workers.values()).flatMap(w =>
        w.tools.map(t => ({
          ...t,
          name: `${w.id}__${t.name}`
        }))
      );

      return {
        tools: [
          ...allTools,
          {
            name: "core__configure_guardrails",
            description: "Update safety whitelist and approval requirements for the God-mode swarm.",
            inputSchema: {
              type: "object",
              properties: {
                whitelist_add: { type: "array", items: { type: "string" } },
                strict_mode: { type: "boolean" },
              },
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === "core__configure_guardrails") {
        const { whitelist_add, strict_mode } = args as any;
        if (whitelist_add) this.commandWhitelist.push(...whitelist_add);
        if (strict_mode !== undefined) this.approvalRequired = strict_mode;
        return {
          content: [{ type: "text", text: `Guardrails updated. Strict mode: ${this.approvalRequired}` }],
        };
      }

      const separator = name.indexOf("__");
      if (separator === -1) throw new Error(`Invalid tool name: ${name}`);
      
      const workerId = name.substring(0, separator);
      const toolName = name.substring(separator + 2);
      const worker = this.workers.get(workerId);

      if (!worker) {
        throw new Error(`Worker ${workerId} is offline or not registered.`);
      }

      // --- SAFETY GUARDRAIL CHECK ---
      if (workerId === "system" && toolName === "execute_shell") {
        const { command } = args as any;
        const isWhitelisted = this.commandWhitelist.some(cmd => command.startsWith(cmd));
        if (!isWhitelisted && this.approvalRequired) {
          return {
            isError: true,
            content: [{ type: "text", text: `SECURITY ALERT: Command '${command}' requires manual approval.` }],
          };
        }
      }

      try {
        const response = await axios.post(`${worker.url}/execute`, {
          action: toolName,
          ...args,
        });
        return { content: [{ type: "text", text: JSON.stringify(response.data) }] };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Reactor Core Error [${workerId}]: ${error.message}` }],
        };
      }
    });
  }

  private async registerWorker(id: string, url: string) {
    try {
      // Mocking tool discovery for the demo, in production this hits the worker's /health or /tools
      this.workers.set(id, {
        id,
        url,
        tools: this.getMockTools(id),
      });
      console.error(`[ReactorCore] Registered executive worker: ${id} at ${url}`);
    } catch (error: any) {
      console.error(`[ReactorCore] Failed to register worker ${id}: ${error.message}`);
    }
  }

  private getMockTools(id: string) {
    if (id === "system") return [{ name: "execute_shell", description: "Run shell commands" }, { name: "click", description: "Click screen" }];
    if (id === "observer") return [{ name: "audit", description: "Monitor sandbox" }];
    return [];
  }

  async ignite() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("⚡ Jarvis-Edge Reactor Core Ignited with God-Mode Permissions");
  }
}

const core = new ReactorCore();
core.ignite().catch(console.error);
