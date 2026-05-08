// raw-agent.ts
// Factory for a bare PiAgent — no tools, no project context files.

import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  SessionManager,
  type AgentSession,
} from "@mariozechner/pi-coding-agent";

import { PiAgent, type EventCallback, type PiAgentConfig } from "./pi-agent";

// ── Raw agent factory ──────────────────────────────────────────────────────────
//
// Creates a PiAgent stripped of:
//   - All tools (noTools: "all" suppresses builtin bash/read/edit/write)
//   - Skills, prompt templates, themes, and project context files
//
// The Pi SDK's base system prompt ("You are an expert coding assistant…") is
// built internally by buildSystemPrompt() and has no public override path through
// createAgentSession. It is left in place; callers can inject their own via
// systemPromptSuffix if needed.
//
// Achieved by patching _createSession after construction so pi-agent.ts stays
// untouched. The patch replicates the session-manager switch from the original
// and delegates auth, model, and registry to PiAgent's already-initialised
// private fields.

export function createRawAgent(
  config: Omit<PiAgentConfig, "skills" | "systemPromptSuffix"> & {
    systemPromptSuffix?: string;
  }
): PiAgent {
  const agent = new PiAgent({ ...config, skills: [] });

  (agent as any)._createSession = async function (): Promise<AgentSession> {
    let sessionManager: SessionManager;
    switch (this.config.sessionMode) {
      case "disk":
        sessionManager = SessionManager.create(this.config.workingDir);
        break;
      case "continue":
        sessionManager = SessionManager.continueRecent(this.config.workingDir);
        break;
      default:
        sessionManager = SessionManager.inMemory();
    }

    const resourceLoader = new DefaultResourceLoader({
      cwd: this.config.workingDir,
      agentDir: getAgentDir(),
      noSkills: true,
      noPromptTemplates: true,
      noThemes: true,
      noContextFiles: true,
      appendSystemPromptOverride: () =>
        this.config.systemPromptSuffix
          ? [this.config.systemPromptSuffix]
          : [],
    });
    await resourceLoader.reload();

    // Pass custom tools if any are registered (via addTool or config.tools)
    const customTools = this.toolDefinitions.size > 0
      ? Array.from(this.toolDefinitions.values())
      : undefined;

    const { session } = await createAgentSession({
      model: this.model,
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      thinkingLevel: this.config.thinkingLevel,
      sessionManager,
      resourceLoader,
      // "builtin" strips bash/read/edit/write but keeps custom tools visible.
      // "all" strips everything — used when no custom tools are registered.
      noTools: customTools ? "builtin" : "all",
      ...(customTools ? { customTools } : {}),
    });

    this.currentSession = session;
    return session;
  };

  return agent;
}

// ── Router ─────────────────────────────────────────────────────────────────────

const MODEL = "anthropic/claude-sonnet-4-5";

export async function route(
  query: string,
  onEvent?: EventCallback
): Promise<void> {
  const agent = createRawAgent({
    model: MODEL,
    sessionMode: "memory",
    thinkingLevel: "off",
  });

  await agent.execute(query, onEvent);
}
