// runtime/routes/agent.ts
// Agent lifecycle, chat, abort, config, messages, stats, and deletion.

import { Router } from 'express';
import { PiAgent, PiAgentConfig } from '../../pi-agent.js';
import { handleEvent, handleEventWithClient } from '../../pi-agent-utils.js';
import { agentLogger } from '../agent-logger.js';
import {
  activeAgents,
  activeOrchestrators,
  orchestratorSubAgents,
  sessionAgentMap,
  setCurrentAgentId,
  resolveModel,
} from '../state.js';
import type { RunRequest, AgentFile } from '../types.js';

const router = Router();

/**
 * POST /runtime/run
 *
 * Body: { agent: AgentData, files?: AgentFile[] }
 *
 * Instantiates a new PiAgent for the given agent, registers it in
 * `activeAgents`, and sets it as the global `activeAgent`.
 */
router.post('/runtime/run', async (req, res) => {
  const { agent, files = [], sessionId: clientSessionId }: RunRequest = req.body;
  const sessionId = clientSessionId || agent?._id;

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
    activeAgents.set(sessionId, piAgent);
    sessionAgentMap.set(sessionId, agent._id);
    setCurrentAgentId(sessionId);
    global.activeAgent    = piAgent;
    global.activeAgentId  = sessionId;

    console.log(`[runtime] Agent "${agent.name}" session ${sessionId} (agent ${agent._id}) started`);
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
      sessionId,
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
 * POST /runtime/chat/:id
 *
 * Body: { message: string }
 *
 * Sends a message to an already-initialized PiAgent session and streams the
 * response back as Server-Sent Events (SSE).
 */
router.post('/runtime/chat/:id', async (req, res) => {
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
router.post('/runtime/agents/:id/abort', async (req, res) => {
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
router.get('/runtime/agents/:id/config', (req, res) => {
  const { id } = req.params;
  const piAgent = activeAgents.get(id);

  if (!piAgent) {
    res.status(404).json({ error: 'Agent not found in runtime.' });
    return;
  }

  const config = piAgent.getConfig();
  const session = piAgent.getCurrentSession();
  const tools = session ? session.getActiveToolNames() : piAgent.getRegisteredTools();
  res.json({ config, tools });
});

/**
 * GET /runtime/agents/:id/messages
 *
 * Returns the full conversation history for an active Pi agent session.
 */
router.get('/runtime/agents/:id/messages', async (req, res) => {
  const { id } = req.params;
  const piAgent = activeAgents.get(id);

  if (!piAgent) {
    res.status(404).json({ error: 'Agent not found in runtime.' });
    return;
  }

  try {
    const messages = await piAgent.getMessages();
    res.json(messages);
  } catch (err: any) {
    res.status(503).json({
      error: err?.message ?? 'No active session. Send a message to the agent first.',
    });
  }
});

/**
 * GET /runtime/agents/:id/stats
 *
 * Returns context usage and session statistics for an active Pi agent.
 */
router.get('/runtime/agents/:id/stats', (req, res) => {
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
 * DELETE /runtime/agents/:id
 *
 * Removes an agent instance from memory.
 */
router.delete('/runtime/agents/:id', (req, res) => {
  const { id } = req.params;
  if (!activeAgents.has(id)) {
    res.status(404).json({ error: 'Agent not found in runtime' });
    return;
  }
  activeAgents.delete(id);
  sessionAgentMap.delete(id);
  if (activeOrchestrators.has(id)) {
    // Clean up sub-agent composite keys
    const subAgents = orchestratorSubAgents.get(id);
    if (subAgents) {
      for (const agent of subAgents) {
        activeAgents.delete(`${id}::${agent._id}`);
      }
    }
    activeOrchestrators.delete(id);
    orchestratorSubAgents.delete(id);
    console.log(`[runtime] Orchestrator session ${id} removed`);
  }
  if (id === global.activeAgentId) {
    setCurrentAgentId(null);
    global.activeAgent   = null;
    global.activeAgentId = null;
  }
  agentLogger.clearLogs(id);
  console.log(`[runtime] Agent ${id} removed from runtime`);
  res.json({ success: true });
});

export default router;
