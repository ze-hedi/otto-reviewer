// pi-orchestrator.ts
// Orchestrator that delegates tasks to sub-agents in parallel via a "delegate" tool.
// The orchestrator itself is a raw agent (no built-in tools) with only the delegate tool.

import { Type } from "typebox";
import { PiAgent, type PiAgentConfig, type EventCallback, type AgentMessage } from "./pi-agent";
import { createRawAgent } from "./raw-agent";

// ── Types ────────────────────────────────────────────────────────────────────────

export interface SubAgentDefinition {
  /** Unique ID — the LLM uses this in the delegate tool call */
  name: string;
  /** Short description — shown to the orchestrator LLM so it can pick the right agent */
  description: string;
  /** The PiAgent instance that handles execution */
  agent: PiAgent;
}

export interface OrchestratorConfig extends Omit<PiAgentConfig, "tools" | "onToolExecute" | "skills"> {}

interface DelegateParams {
  agents: Array<{ name: string; task: string }>;
}

// ── PiOrchestrator ───────────────────────────────────────────────────────────────

export class PiOrchestrator {
  private orchestratorConfig: OrchestratorConfig;
  private subAgents: Map<string, SubAgentDefinition> = new Map();
  private orchestrator: PiAgent | null = null;

  constructor(config: OrchestratorConfig) {
    this.orchestratorConfig = config;
  }

  // ── Sub-agent registration ─────────────────────────────────────────────────

  /**
   * Register a sub-agent. Call this before initialize().
   */
  addSubAgent(def: SubAgentDefinition): void {
    if (this.orchestrator) {
      throw new Error(
        "Cannot add sub-agents after initialize(). Add all sub-agents first."
      );
    }
    if (this.subAgents.has(def.name)) {
      throw new Error(`Sub-agent "${def.name}" is already registered`);
    }
    this.subAgents.set(def.name, def);
  }

  /**
   * Remove a sub-agent by name. Call this before initialize().
   */
  removeSubAgent(name: string): boolean {
    if (this.orchestrator) {
      throw new Error("Cannot remove sub-agents after initialize().");
    }
    return this.subAgents.delete(name);
  }

  /**
   * Get all registered sub-agent names.
   */
  getSubAgentNames(): string[] {
    return Array.from(this.subAgents.keys());
  }

  // ── Initialization ─────────────────────────────────────────────────────────

  /**
   * Build the delegate tool from registered sub-agents and create the orchestrator.
   * The orchestrator is a raw agent (no built-in tools) with only the delegate tool.
   * Must be called after all addSubAgent() calls and before chat()/execute().
   */
  initialize(): void {
    if (this.orchestrator) {
      throw new Error("Orchestrator already initialized");
    }
    if (this.subAgents.size === 0) {
      throw new Error("No sub-agents registered. Call addSubAgent() first.");
    }

    const agentList = Array.from(this.subAgents.values())
      .map((a) => `[${a.name}] ${a.description}`)
      .join("\n");

    const subAgentsRef = this.subAgents;
    const self = this;

    this.orchestrator = createRawAgent({
      ...this.orchestratorConfig,
      tools: [
        {
          name: "delegate",
          label: "Delegate",
          description:
            `Delegate tasks to one or more sub-agents. They run in parallel.\n\n` +
            `AVAILABLE AGENTS:\n${agentList}\n\n` +
            `Pass multiple agents to fan out work concurrently. Pass one for a focused task.\n` +
            `IMPORTANT: Call this tool ONCE with all agents needed. Do NOT call it again with the same agents. After receiving results, synthesize and respond.`,
          promptSnippet: "Delegate tasks to specialized sub-agents (parallel execution)",
          parameters: Type.Object({
            agents: Type.Array(
              Type.Object({
                name: Type.String({ description: "Agent ID to call" }),
                task: Type.String({ description: "Plain-English instruction for the agent" }),
              })
            ),
          }),
        },
      ],
      onToolExecute: async (_toolCallId, toolName, params: DelegateParams, signal) => {
        if (toolName !== "delegate") {
          throw new Error(`Unknown tool: ${toolName}`);
        }

        // Validate all agent names before spawning anything
        for (const entry of params.agents) {
          if (!subAgentsRef.has(entry.name)) {
            throw new Error(
              `Unknown agent "${entry.name}". Available: ${Array.from(subAgentsRef.keys()).join(", ")}`
            );
          }
        }
        console.log("from tool execution ")
        console.log(params.agents.length)
        // Spawn all sub-agents in parallel
        const results = await Promise.all(
          params.agents.map(async ({ name, task }) => {
            const def = subAgentsRef.get(name)!;
            try {
              const output = await self._runSubAgent(def, task, signal);
              return { agent: name, status: "ok" as const, result: output };
            } catch (err) {
              return {
                agent: name,
                status: "error" as const,
                result: err instanceof Error ? err.message : String(err),
              };
            }
          })
        );

        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      },
    });
  }

  // ── Sub-agent execution ────────────────────────────────────────────────────

  private async _runSubAgent(
    def: SubAgentDefinition,
    task: string,
    signal?: AbortSignal
  ): Promise<string> {
    let finalText = "";

    await def.agent.execute(task, (event) => {
      if (event.type === "agent_end") {
        // Extract text from the last assistant message
        const messages = (event as any).messages as AgentMessage[];
        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i];
          if (msg.role === "assistant" && Array.isArray(msg.content)) {
            const textBlocks = msg.content.filter(
              (b: any) => b.type === "text"
            );
            if (textBlocks.length > 0) {
              finalText = textBlocks.map((b: any) => b.text).join("\n");
              break;
            }
          }
        }
      }
    });

    return finalText || "(no output)";
  }

  // ── Public API (proxy to orchestrator PiAgent) ─────────────────────────────

  private requireOrchestrator(): PiAgent {
    if (!this.orchestrator) {
      throw new Error("Orchestrator not initialized. Call initialize() first.");
    }
    return this.orchestrator;
  }

  /**
   * Send a one-shot query. Creates a fresh session each time.
   */
  async execute(query: string, onEvent?: EventCallback): Promise<void> {
    await this.requireOrchestrator().execute(query, onEvent);
  }

  /**
   * Send a message on a persistent session. Preserves conversation history.
   */
  async chat(message: string, onEvent?: EventCallback): Promise<void> {
    await this.requireOrchestrator().chat(message, onEvent);
  }

  /**
   * Get the underlying orchestrator PiAgent (for advanced usage).
   */
  getOrchestrator(): PiAgent {
    return this.requireOrchestrator();
  }
}
