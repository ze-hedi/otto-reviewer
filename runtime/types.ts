// runtime/types.ts
// Shared type definitions for the runtime server.

export interface AgentData {
  _id: string;
  name: string;
  model: string;
  description: string;
  type?: string;
  status?: string;
  thinkingLevel?: 'off' | 'low' | 'medium' | 'high' | 'xhigh';
  sessionMode?: 'memory' | 'disk' | 'continue';
  workingDir?: string;
  playground?: string;
  apiKey?: string;
  stateful?: boolean;
}

export interface AgentFile {
  type: 'soul' | 'skills';
  content: string;
}

export interface RunRequest {
  agent: AgentData;
  files?: AgentFile[];
  sessionId?: string;
}

export interface OrchestratorRunRequest {
  orchestratorId: string;
  sessionId?: string;
  systemPrompt: string;
  model?: string;
  playground?: string;
  agents: AgentData[];
}

export interface FileEntry {
  path: string;
  name: string;
  type: 'file' | 'directory';
}
