// mem0.ts
// Self-contained wrapper for mem0ai OSS in-process memory
// LLM: Anthropic claude-sonnet-4-6 | Embedder: Ollama all-minilm (local, 384 dims)

import { Memory } from "mem0ai/oss";
import type {
  Message,
  MemoryItem,
  SearchResult,
} from "mem0ai/oss";

export type { Message, MemoryItem, SearchResult };

export interface Mem0Config {
  /** Anthropic API key (defaults to process.env.ANTHROPIC_API_KEY) */
  anthropicApiKey?: string;
  /** Claude model to use for memory extraction (default: "claude-sonnet-4-6") */
  llmModel?: string;
  /** Ollama embedding model (default: "all-minilm") */
  embedModel?: string;
  /** Ollama base URL (default: "http://localhost:11434") */
  ollamaBaseUrl?: string;
  /** SQLite history db path (default: "memory.db") */
  historyDbPath?: string;
  /** Qdrant collection name (default: "memories") */
  collectionName?: string;
  /** Qdrant URL (default: process.env.QDRANT_URL ?? "http://localhost:6333") */
  qdrantUrl?: string;
  /** Qdrant API key for managed/cloud deployments (default: process.env.QDRANT_API_KEY) */
  qdrantApiKey?: string;
  /** Custom instructions injected into the memory extraction prompt */
  customInstructions?: string;
}

export interface AddOptions {
  /** Scope memories to a specific user */
  userId?: string;
  /** Scope memories to a specific agent */
  agentId?: string;
  /** Scope memories to a specific run/session */
  runId?: string;
  /** Additional metadata stored alongside the memory */
  metadata?: Record<string, any>;
  /**
   * When false, stores the raw content without LLM extraction.
   * Useful for explicit memory facts you want to inject directly.
   * Default: true
   */
  infer?: boolean;
}

export interface SearchOptions {
  /** Scope the search to a specific user */
  userId?: string;
  /** Scope the search to a specific agent */
  agentId?: string;
  /** Scope the search to a specific run/session */
  runId?: string;
  /** Maximum number of results (default: 10) */
  topK?: number;
  /** Minimum similarity threshold 0–1 (default: 0) */
  threshold?: number;
}

export interface GetAllOptions {
  /** Scope to a specific user */
  userId?: string;
  /** Scope to a specific agent */
  agentId?: string;
  /** Scope to a specific run/session */
  runId?: string;
  /** Maximum number of results */
  topK?: number;
}

export class Mem0 {
  private memory: Memory;

  constructor(config: Mem0Config = {}) {
    const anthropicApiKey = config.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      throw new Error(
        "Anthropic API key required. Pass anthropicApiKey in config or set ANTHROPIC_API_KEY."
      );
    }

    const ollamaBaseUrl = config.ollamaBaseUrl ?? "http://localhost:11434";

    this.memory = new Memory({
      llm: {
        provider: "anthropic",
        config: {
          apiKey: anthropicApiKey,
          model: config.llmModel ?? "claude-sonnet-4-6",
        },
      },
      embedder: {
        provider: "ollama",
        config: {
          model: config.embedModel ?? "all-minilm",
          baseURL: ollamaBaseUrl,
          embeddingDims: 384,
        },
      },
      vectorStore: {
        provider: "qdrant",
        config: {
          url: config.qdrantUrl ?? process.env.QDRANT_URL ,
          ...(config.qdrantApiKey ?? process.env.QDRANT_API_KEY
            ? { apiKey: config.qdrantApiKey ?? process.env.QDRANT_API_KEY }
            : {}),
          collectionName: config.collectionName ?? "memories",
          embeddingModelDims: 384,
          dimension: 384,
        },
      },
      historyDbPath: config.historyDbPath ?? "memory.db",
      ...(config.customInstructions
        ? { customInstructions: config.customInstructions }
        : {}),
    });
  }

  /**
   * Extract and store memories from a conversation or plain text.
   *
   * @param messages - Array of {role, content} turns, or a plain string
   * @param options  - Scoping (userId/agentId/runId) and optional metadata
   */
  async add(
    messages: Message[] | string,
    options: AddOptions = {}
  ): Promise<SearchResult> {
    const { userId, agentId, runId, metadata, infer } = options;
    return this.memory.add(messages, {
      ...(userId !== undefined && { userId }),
      ...(agentId !== undefined && { agentId }),
      ...(runId !== undefined && { runId }),
      ...(metadata !== undefined && { metadata }),
      ...(infer !== undefined && { infer }),
    });
  }

  /**
   * Semantic search over stored memories.
   *
   * @param query   - Natural language question or topic
   * @param options - Scoping and result controls
   */
  async search(query: string, options: SearchOptions = {}): Promise<MemoryItem[]> {
    const { userId, agentId, runId, topK, threshold } = options;
    const result = await this.memory.search(query, {
      filters: {
        ...(userId !== undefined && { user_id: userId }),
        ...(agentId !== undefined && { agent_id: agentId }),
        ...(runId !== undefined && { run_id: runId }),
      },
      ...(topK !== undefined && { topK }),
      ...(threshold !== undefined && { threshold }),
    });
    return result.results;
  }

  /**
   * Retrieve all stored memories, optionally scoped.
   */
  async getAll(options: GetAllOptions = {}): Promise<MemoryItem[]> {
    const { userId, agentId, runId, topK } = options;
    const result = await this.memory.getAll({
      filters: {
        ...(userId !== undefined && { user_id: userId }),
        ...(agentId !== undefined && { agent_id: agentId }),
        ...(runId !== undefined && { run_id: runId }),
      },
      ...(topK !== undefined && { topK }),
    });
    return result.results;
  }

  /**
   * Fetch a single memory by its ID.
   */
  async get(memoryId: string): Promise<MemoryItem | null> {
    return this.memory.get(memoryId);
  }

  /**
   * Update the text of an existing memory.
   */
  async update(memoryId: string, data: string): Promise<{ message: string }> {
    return this.memory.update(memoryId, data);
  }

  /**
   * Delete a single memory by ID.
   */
  async delete(memoryId: string): Promise<{ message: string }> {
    return this.memory.delete(memoryId);
  }

  /**
   * Delete all memories in a scope (userId / agentId / runId).
   * At least one scope field is required to avoid accidental wipes.
   */
  async deleteAll(
    options: Required<Pick<GetAllOptions, "userId" | "agentId" | "runId">> &
      Partial<GetAllOptions>
  ): Promise<{ message: string }> {
    const { userId, agentId, runId } = options;
    return this.memory.deleteAll({
      ...(userId !== undefined && { userId }),
      ...(agentId !== undefined && { agentId }),
      ...(runId !== undefined && { runId }),
    });
  }

  /**
   * Get the edit history of a specific memory.
   */
  async history(memoryId: string): Promise<any[]> {
    return this.memory.history(memoryId);
  }

  /**
   * Expose the raw Memory instance for advanced use-cases.
   */
  getRaw(): Memory {
    return this.memory;
  }
}
