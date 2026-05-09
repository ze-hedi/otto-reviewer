// runtime/server.ts
// Instantiates PiAgent sessions from agent data sent by the React frontend.

// IMPORTANT: load-env must be first so API keys are in process.env before the
// SDK modules initialize (pi-ai reads env vars at module-load time).
import './load-env.js';

import express from 'express';
import cors from 'cors';
import { PiAgent, PiAgentConfig } from '../pi-agent.js';
import { PiOrchestrator } from '../pi-orchestrator.js';
import { agentLogger } from './agent-logger.js';
import { handleEvent, handleEventWithClient } from '../pi-agent-utils.js';


const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentData {
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
}

interface AgentFile {
  type: 'soul' | 'skills';
  content: string;
}

interface RunRequest {
  agent: AgentData;
  files?: AgentFile[];
}

interface OrchestratorRunRequest {
  orchestratorId: string;
  systemPrompt: string;
  model?: string;
  playground?: string;
  agents: AgentData[];
}

// ─── Global state ─────────────────────────────────────────────────────────────

// Map of agentId → PiAgent instance
const activeAgents = new Map<string, PiAgent>();

// Map of orchestratorId → PiOrchestrator instance
const activeOrchestrators = new Map<string, PiOrchestrator>();

// Map of orchestratorId → sub-agent metadata (for the UI)
const orchestratorSubAgents = new Map<string, AgentData[]>();

// Convenience pointer to the last agent that was run
let currentAgentId: string | null = null;

// Also exposed on global so other modules/scripts can access it directly
declare global {
  var activeAgent: PiAgent | null;
  var activeAgentId: string | null;
}
global.activeAgent = null;
global.activeAgentId = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Maps a bare model name (e.g. "claude-sonnet-4-6") to the
 * "provider/model-name" format that PiAgent expects.
 * If the model already contains "/" it is returned as-is.
 */
function resolveModel(model: string): string {
  if (model.includes('/')) return model;
  if (model.startsWith('claude-')) return `anthropic/${model}`;
  if (model.startsWith('gpt-'))    return `openai/${model}`;
  // fallback
  return `anthropic/${model}`;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /runtime/run
 *
 * Body: { agent: AgentData, files?: AgentFile[] }
 *
 * Instantiates a new PiAgent for the given agent, registers it in
 * `activeAgents`, and sets it as the global `activeAgent`.
 */
app.post('/runtime/run', async (req, res) => {
  const { agent, files = [] }: RunRequest = req.body;

  if (!agent?._id || !agent?.model) {
    res.status(400).json({ error: 'Request body must include agent._id and agent.model' });
    return;
  }

  // Validate session mode requirements
  if (agent.sessionMode === 'disk' || agent.sessionMode === 'continue') {
    if (!agent.workingDir || agent.workingDir.trim() === '') {
      res.status(400).json({ 
        error: `workingDir is required when sessionMode is "${agent.sessionMode}"` 
      });
      return;
    }
  }

  // Build config from DB files
  const soulFile   = files.find((f) => f.type === 'soul');
  const skillsFile = files.find((f) => f.type === 'skills');

  // Skills are passed as individual SkillInput objects so PiAgent can register
  // them properly via the resource loader (not just appended to the system prompt)
  const skills = skillsFile
    ? [{ name: 'agent-skills', content: skillsFile.content }]
    : [];

  const config: PiAgentConfig = {
    model: resolveModel(agent.model),
    systemPromptSuffix: soulFile?.content?.trim() || undefined,
    skills,
    sessionMode: agent.sessionMode || 'memory',
    thinkingLevel: agent.thinkingLevel || 'medium',
    workingDir: agent.workingDir?.trim() || undefined,
    playground: agent.playground?.trim() || undefined,
    apiKey: agent.apiKey || process.env.ANTHROPIC_API_KEY || undefined,
  };

  try {
    const piAgent = new PiAgent(config);

    if (!piAgent.isApiReady()) {
      console.warn(`[runtime] Agent "${agent.name}" blocked: Anthropic model with no API key`);
      res.status(400).json({ error: 'api_key_required', message: 'This agent uses an Anthropic model but no API key is configured.' });
      return;
    }

    console.log("[runtime] PiAgent created successfully");


    // Store in map and as globals
    activeAgents.set(agent._id, piAgent);
    currentAgentId        = agent._id;
    global.activeAgent    = piAgent;
    global.activeAgentId  = agent._id;

    console.log(`[runtime] Agent "${agent.name}" (${agent._id}) started`);
    console.log(`[runtime]   model          : ${config.model}`);
    console.log(`[runtime]   description    : ${agent.description}`);
    console.log(`[runtime]   sessionMode    : ${config.sessionMode}`);
    console.log(`[runtime]   thinkingLevel  : ${config.thinkingLevel}`);
    
    // Prominently display working directory
    const workDir = config.workingDir || process.cwd();
    console.log(`[runtime]   ──────────────────────────────────────────────────────`);
    console.log(`[runtime]   📁 Working Directory (files will be written here):`);
    console.log(`[runtime]   ${workDir}`);
    console.log(`[runtime]   ──────────────────────────────────────────────────────`);
    
    if (config.apiKey) {
      const masked = config.apiKey.length > 12 
        ? config.apiKey.slice(0, 8) + '...' + config.apiKey.slice(-4)
        : '***';
      console.log(`[runtime]   apiKey         : ${masked}`);
    }
    
    if (soulFile) {
      console.log(`[runtime]   system prompt  :`);
      console.log(`[runtime]   ──────────────────────────────────`);
      console.log(soulFile.content.trim().split('\n').map(l => `[runtime]   ${l}`).join('\n'));
      console.log(`[runtime]   ──────────────────────────────────`);
    } else {
      console.log(`[runtime]   system prompt  : (none)`);
    }
    console.log(`[runtime]   apiKey set     : ${piAgent.getConfig().hasApiKey}`);

    res.json({ 
      success: true, 
      agentId: agent._id,
      name: agent.name,
      model: config.model,
      sessionMode: config.sessionMode,
      thinkingLevel: config.thinkingLevel,
      workingDir: config.workingDir || null,
      hasCustomApiKey: !!config.apiKey,
    });
  } catch (err: any) {
    console.error(`[runtime] Failed to instantiate agent: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /runtime/orchestrator/run
 *
 * Body: { orchestratorId, systemPrompt, model?, agents: AgentData[] }
 *
 * Creates a PiOrchestrator with the given sub-agents. Each sub-agent gets its
 * own PiAgent stored in activeAgents. The orchestrator's underlying PiAgent is
 * also stored in activeAgents so existing chat/abort/stats endpoints work.
 */
app.post('/runtime/orchestrator/run', async (req, res) => {
  const { orchestratorId, systemPrompt, model, playground, agents }: OrchestratorRunRequest = req.body;

  if (!orchestratorId) {
    res.status(400).json({ error: 'orchestratorId is required' });
    return;
  }
  if (!agents?.length) {
    res.status(400).json({ error: 'At least one agent is required' });
    return;
  }

  try {
    // Create PiAgent for each sub-agent
    const subAgentEntries: { agentData: AgentData; piAgent: PiAgent }[] = [];

    for (const agent of agents) {
      if (!agent._id || !agent.model) {
        res.status(400).json({ error: `Each agent must have _id and model. Missing for: ${agent.name || 'unknown'}` });
        return;
      }

      // Fetch agent files from DB
      let files: AgentFile[] = [];
      try {
        const filesRes = await fetch(`http://localhost:4000/api/agents/${agent._id}/files`);
        if (filesRes.ok) files = await filesRes.json();
      } catch {
        console.warn(`[runtime] Could not fetch files for agent "${agent.name}"`);
      }

      const soulFile = files.find((f) => f.type === 'soul');
      const skillsFile = files.find((f) => f.type === 'skills');
      const skills = skillsFile ? [{ name: 'agent-skills', content: skillsFile.content }] : [];

      const config: PiAgentConfig = {
        model: resolveModel(agent.model),
        systemPromptSuffix: soulFile?.content?.trim() || undefined,
        skills,
        sessionMode: agent.sessionMode || 'memory',
        thinkingLevel: agent.thinkingLevel || 'medium',
        workingDir: agent.workingDir?.trim() || undefined,
        playground: agent.playground?.trim() || undefined,
        apiKey: agent.apiKey || process.env.ANTHROPIC_API_KEY || undefined,
      };

      const piAgent = new PiAgent(config);
      activeAgents.set(agent._id, piAgent);
      subAgentEntries.push({ agentData: agent, piAgent });

      console.log(`[runtime] Sub-agent "${agent.name}" (${agent._id}) created`);
    }

    // Create orchestrator
    const orchestrator = new PiOrchestrator({
      model: resolveModel(model || 'claude-sonnet-4-6'),
      systemPromptSuffix: systemPrompt?.trim() || undefined,
      sessionMode: 'memory',
      thinkingLevel: 'medium',
      playground: playground?.trim() || undefined,
      apiKey: process.env.ANTHROPIC_API_KEY || undefined,
    });

    for (const { agentData, piAgent } of subAgentEntries) {
      orchestrator.addSubAgent({
        name: agentData.name,
        description: agentData.description,
        agent: piAgent,
      });
    }

    orchestrator.initialize();

    // Store orchestrator and its underlying PiAgent
    activeOrchestrators.set(orchestratorId, orchestrator);
    orchestratorSubAgents.set(orchestratorId, agents);
    activeAgents.set(orchestratorId, orchestrator.getOrchestrator());
    currentAgentId = orchestratorId;
    global.activeAgent = orchestrator.getOrchestrator();
    global.activeAgentId = orchestratorId;

    console.log(`[runtime] Orchestrator "${orchestratorId}" created with ${agents.length} sub-agent(s)`);
    console.log(`[runtime]   model: ${resolveModel(model || 'claude-sonnet-4-6')}`);
    console.log(`[runtime]   sub-agents: ${agents.map((a) => a.name).join(', ')}`);

    res.json({
      success: true,
      orchestratorId,
      model: resolveModel(model || 'claude-sonnet-4-6'),
      subAgents: agents.map((a) => a.name),
    });
  } catch (err: any) {
    console.error(`[runtime] Failed to create orchestrator: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /runtime/orchestrator/:id/subagents
 *
 * Returns the list of sub-agents for an orchestrator.
 */
app.get('/runtime/orchestrator/:id/subagents', (req, res) => {
  const { id } = req.params;
  const agents = orchestratorSubAgents.get(id);
  if (!agents) {
    res.status(404).json({ error: 'Orchestrator not found or not an orchestrator' });
    return;
  }
  res.json(agents);
});

/**
 * POST /runtime/chat/:id
 *
 * Body: { message: string }
 *
 * Sends a message to an already-initialized PiAgent session and streams the
 * response back as Server-Sent Events (SSE).
 *
 * SSE event shapes:
 *   data: {"type":"delta","text":"..."}        — streamed text chunk
 *   data: {"type":"tool_start","name":"..."}   — tool execution began
 *   data: {"type":"tool_end","name":"...","result":"...","isError":false}
 *   data: {"type":"done"}                      — assistant turn finished
 *   data: {"type":"error","message":"..."}     — something went wrong
 */
app.post('/runtime/chat/:id', async (req, res) => {
  const { id } = req.params;
  const { message } = req.body as { message?: string };

  const piAgent = activeAgents.get(id);
  if (!piAgent) {
    res.status(404).json({ error: 'Agent not found in runtime. Call /runtime/run first.' });
    return;
  }
  if (!message?.trim()) {
    res.status(400).json({ error: 'Request body must include a non-empty message' });
    return;
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let closed = false;
  res.on('close', () => { closed = true; });

  const send = (payload: object) => {
    if (!closed) res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  console.log(`[runtime] chat → agent ${id}: "${message.trim().slice(0, 80)}"`);

  try {
    await piAgent.chat(message.trim(), (event) => {
      handleEvent(event) ; 
      handleEventWithClient(event, send);
    });
  } catch (err: any) {
    send({ type: 'error', message: err?.message ?? String(err) });
  } finally {
    res.end();
  }
});

/**
 * POST /runtime/agents/:id/abort
 *
 * Interrupts the currently running agent loop for a Pi agent.
 */
app.post('/runtime/agents/:id/abort', async (req, res) => {
  const { id } = req.params;
  const piAgent = activeAgents.get(id);

  if (!piAgent) {
    res.status(404).json({ error: 'Agent not found in runtime.' });
    return;
  }

  const session = piAgent.getCurrentSession();
  if (!session) {
    res.status(409).json({ error: 'No active session to abort.' });
    return;
  }

  await session.abort();
  res.json({ success: true });
});

/**
 * GET /runtime/agents/:id/config
 *
 * Returns the resolved configuration and registered tools for a Pi agent.
 */
app.get('/runtime/agents/:id/config', (req, res) => {
  const { id } = req.params;
  const piAgent = activeAgents.get(id);

  if (!piAgent) {
    res.status(404).json({ error: 'Agent not found in runtime.' });
    return;
  }

  const config = piAgent.getConfig();
  const tools = piAgent.getRegisteredTools();
  res.json({ config, tools });
});

/**
 * GET /runtime/agents/:id/stats
 *
 * Returns context usage and session statistics for an active Pi agent.
 */
app.get('/runtime/agents/:id/stats', (req, res) => {
  const { id } = req.params;
  const piAgent = activeAgents.get(id);

  if (!piAgent) {
    res.status(404).json({ error: 'Agent not found in runtime.' });
    return;
  }

  try {
    console.log("get the satas") ; 
    const contextUsage = piAgent.getContextUsage();
    console.log("contextUsage") ; 
    console.log(contextUsage) ; 
    const sessionStats = piAgent.getSessionStats();
    console.log("sessionStats") ; 
    console.log(sessionStats) ; 
    res.json({ contextUsage, sessionStats });
  } catch (err: any) {
    res.status(503).json({
      error: err?.message ?? 'No active session. Send a message to the agent first.',
    });
  }
});

/**
 * GET /runtime/status
 *
 * Returns the list of active agent IDs and the current (last-run) agent ID.
 */
app.get('/runtime/status', (_req, res) => {
  res.json({
    activeAgents: Array.from(activeAgents.keys()),
    currentAgentId,
  });
});

/**
 * DELETE /runtime/agents/:id
 *
 * Removes an agent instance from memory.
 */
app.delete('/runtime/agents/:id', (req, res) => {
  const { id } = req.params;
  if (!activeAgents.has(id)) {
    res.status(404).json({ error: 'Agent not found in runtime' });
    return;
  }
  activeAgents.delete(id);
  if (activeOrchestrators.has(id)) {
    activeOrchestrators.delete(id);
    orchestratorSubAgents.delete(id);
    console.log(`[runtime] Orchestrator ${id} removed`);
  }
  if (currentAgentId === id) {
    currentAgentId       = null;
    global.activeAgent   = null;
    global.activeAgentId = null;
  }
  agentLogger.clearLogs(id);
  console.log(`[runtime] Agent ${id} removed from runtime`);
  res.json({ success: true });
});

/**
 * GET /runtime/logs/:id
 *
 * Retrieves and prints the logs for a specific agent.
 * Returns formatted logs as JSON and prints them to console.
 */
app.get('/runtime/logs/:id', (req, res) => {
  const { id } = req.params;
  const logs = agentLogger.getLogs(id);
  
  if (logs.length === 0) {
    res.json({ 
      success: true, 
      agentId: id, 
      message: 'No logs found',
      logs: [] 
    });
    return;
  }

  // Print logs to console
  console.log(agentLogger.formatLogs(id));

  // Return logs as JSON
  res.json({
    success: true,
    agentId: id,
    count: logs.length,
    logs: logs
  });
});

/**
 * GET /runtime/logs
 *
 * Retrieves and prints logs for all agents.
 * Returns formatted logs as JSON and prints them to console.
 */
app.get('/runtime/logs', (_req, res) => {
  const allLogs = agentLogger.getAllLogs();
  
  if (allLogs.size === 0) {
    res.json({ 
      success: true, 
      message: 'No logs found',
      agents: {} 
    });
    return;
  }

  // Print all logs to console
  console.log(agentLogger.formatAllLogs());

  // Convert Map to object for JSON response
  const logsObject: Record<string, any[]> = {};
  allLogs.forEach((logs, agentId) => {
    logsObject[agentId] = logs;
  });

  res.json({
    success: true,
    count: allLogs.size,
    agents: logsObject
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Runtime server running on http://localhost:${PORT}`);
});
