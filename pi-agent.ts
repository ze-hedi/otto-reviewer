// pi-agent.ts
// Clean class-based wrapper for Pi coding agent SDK

import fs from "fs";
import os from "os";
import path from "path";
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRegistry,
  SessionManager,
  AgentSession,
  AgentEvent,
} from "@mariozechner/pi-coding-agent";
import { getModel, Model } from "@mariozechner/pi-ai";
import type { Skill } from "@mariozechner/pi-coding-agent";

export interface SkillInput {
  /** Skill name (used as the file stem and skill identifier) */
  name: string;
  /** Raw markdown content of the skill file */
  content: string;
}

export interface PiAgentConfig {
  /** Model provider and name, e.g., "anthropic/claude-sonnet-4-5" */
  model: string;
  /** Additional system prompt appended to Pi's default */
  systemPromptSuffix?: string;
  /** Thinking level: "off" | "low" | "medium" | "high" | "xhigh" */
  thinkingLevel?: "off" | "low" | "medium" | "high" | "xhigh";
  /** Optional: override API key at runtime */
  apiKey?: string;
  /** Session persistence: "memory" | "disk" | "continue" */
  sessionMode?: "memory" | "disk" | "continue";
  /** Working directory for disk-based sessions */
  workingDir?: string;
  /** Skills to inject into the agent session */
  skills?: SkillInput[];
}

export type EventCallback = (event: AgentEvent) => void;

export class PiAgent {
  private authStorage: AuthStorage;
  private modelRegistry: ModelRegistry;
  private model: Model;
  private config: Required<
    Omit<PiAgentConfig, "apiKey" | "workingDir" | "model" | "skills">
  > & { workingDir: string; skills: SkillInput[] };
  private currentSession: AgentSession | null = null;
  /** Temp directory created for skill files; cleaned up after session creation */
  private skillsTmpDir: string | null = null;

  constructor(config: PiAgentConfig) {
    // Parse model string (format: "provider/model-name")
    const [provider, modelName] = config.model.split("/");
    if (!provider || !modelName) {
      throw new Error(
        `Invalid model format. Expected "provider/model-name", got: ${config.model}`
      );
    }

    // Initialize auth and model registry
    this.authStorage = AuthStorage.create();
    if (config.apiKey) {
      this.authStorage.setRuntimeApiKey(provider, config.apiKey);
    }
    this.modelRegistry = ModelRegistry.create(this.authStorage);

    // Get the model instance
    const model = getModel(provider, modelName);
    if (!model) {
      throw new Error(
        `Model not found: ${config.model}. Check provider and model name.`
      );
    }
    this.model = model;

    // Store config with defaults
    this.config = {
      systemPromptSuffix: config.systemPromptSuffix || "",
      thinkingLevel: config.thinkingLevel || "medium",
      sessionMode: config.sessionMode || "memory",
      workingDir: config.workingDir || process.cwd(),
      skills: config.skills || [],
    };
  }

  /**
   * Write skill content to a temp directory and return Skill objects pointing to those files.
   * The caller is responsible for cleaning up the temp dir.
   */
  private _writeSkillsToTmp(): { tmpDir: string; skills: Skill[] } {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-agent-skills-"));
    const skills: Skill[] = [];

    for (const input of this.config.skills) {
      // Sanitize name: lowercase, replace spaces/underscores with hyphens
      const safeName = input.name
        .toLowerCase()
        .replace(/[\s_]+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/^-+|-+$/g, "") || "skill";

      // Write the skill content as a .md file
      const filePath = path.join(tmpDir, `${safeName}.md`);
      fs.writeFileSync(filePath, input.content, "utf-8");

      // Extract description from frontmatter if present, otherwise use name
      const descMatch = input.content.match(/^description:\s*(.+)$/m);
      const description = descMatch ? descMatch[1].trim() : input.name;

      skills.push({
        name: safeName,
        description,
        filePath,
        baseDir: tmpDir,
        disableModelInvocation: false,
        sourceInfo: {
          path: filePath,
          source: "otto-agent",
          scope: "temporary",
          origin: "top-level",
          baseDir: tmpDir,
        },
      });
    }

    return { tmpDir, skills };
  }

  /**
   * Create a session (without sending a prompt yet)
   * @returns AgentSession that you can use to send prompts
   */
  private async createSession(): Promise<AgentSession> {
    // Create session manager based on config
    let sessionManager: SessionManager;
    switch (this.config.sessionMode) {
      case "memory":
        sessionManager = SessionManager.inMemory();
        break;
      case "disk":
        sessionManager = SessionManager.create(this.config.workingDir);
        break;
      case "continue":
        sessionManager = SessionManager.continueRecent(this.config.workingDir);
        break;
    }

    // Build resource loader to inject skills and/or system prompt suffix
    const needsResourceLoader =
      this.config.skills.length > 0 || this.config.systemPromptSuffix;

    let resourceLoader: DefaultResourceLoader | undefined;
    if (needsResourceLoader) {
      const agentDir = getAgentDir();
      const loaderOptions: ConstructorParameters<typeof DefaultResourceLoader>[0] = {
        cwd: this.config.workingDir,
        agentDir,
      };

      // Append system prompt suffix via the resource loader
      if (this.config.systemPromptSuffix) {
        loaderOptions.appendSystemPrompt = [this.config.systemPromptSuffix];
      }

      // Inject skills as file-backed Skill objects
      if (this.config.skills.length > 0) {
        const { tmpDir, skills: injectedSkills } = this._writeSkillsToTmp();
        this.skillsTmpDir = tmpDir;
        loaderOptions.skillsOverride = (base) => ({
          skills: [...base.skills, ...injectedSkills],
          diagnostics: base.diagnostics,
        });
      }

      resourceLoader = new DefaultResourceLoader(loaderOptions);
      await resourceLoader.reload();
    }

    // Create new session
    const { session } = await createAgentSession({
      model: this.model,
      sessionManager,
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      thinkingLevel: this.config.thinkingLevel,
      ...(resourceLoader ? { resourceLoader } : {}),
    });

    this.currentSession = session;
    return session;
  }

  /**
   * Get the current session, initializing it if it hasn't been created yet.
   * Subsequent calls reuse the same session (persistent conversation).
   */
  async getSession(): Promise<AgentSession> {
    if (!this.currentSession) {
      await this.createSession();
    }
    return this.currentSession!;
  }

  /**
   * Send a message to the persistent session and stream events back.
   * Creates the session on first call; reuses it on subsequent calls.
   * The event listener is automatically removed after the prompt resolves.
   */
  async chat(message: string, onEvent?: EventCallback): Promise<void> {
    const session = await this.getSession();
    let unsubscribe: (() => void) | undefined;
    if (onEvent) {
      unsubscribe = session.subscribe(onEvent as any);
    }
    try {
      await session.prompt(message);
    } finally {
      unsubscribe?.();
    }
  }

  /**
   * Execute a query and get back a session you can subscribe to.
   * Each call creates a fresh session.
   */
  async query(
    query: string,
    onEvent?: EventCallback
  ): Promise<AgentSession> {
    const session = await this.createSession();
    if (onEvent) {
      session.subscribe(onEvent);
    }
    session.prompt(query);
    return session;
  }

  /**
   * Execute a query and wait for completion.
   * Each call creates a fresh session.
   */
  async execute(query: string, onEvent?: EventCallback): Promise<void> {
    const session = await this.createSession();
    if (onEvent) {
      session.subscribe(onEvent);
    }
    await session.prompt(query);
  }

  /**
   * Get the currently active session (if any)
   */
  getCurrentSession(): AgentSession | null {
    return this.currentSession;
  }
}
