// runtime/routes/orchestrator.ts
// Orchestrator lifecycle, sub-agent queries, and orchestrator stats.

import { Router } from 'express';
import { PiAgent, PiAgentConfig } from '../../pi-agent.js';
import { PiOrchestrator } from '../../pi-orchestrator.js';
import {
  activeAgents,
  activeOrchestrators,
  orchestratorSubAgents,
  sessionAgentMap,
  setCurrentAgentId,
  resolveModel,
} from '../state.js';
import type { AgentData, AgentFile, OrchestratorRunRequest } from '../types.js';

const router = Router();

/**
 * POST /runtime/orchestrator/run
 *
 * Body: { orchestratorId, systemPrompt, model?, agents: AgentData[] }
 *
 * Creates a PiOrchestrator with the given sub-agents. Each sub-agent gets its
 * own PiAgent stored in activeAgents. The orchestrator's underlying PiAgent is
 * also stored in activeAgents so existing chat/abort/stats endpoints work.
 */
router.post('/runtime/orchestrator/run', async (req, res) => {
  const { orchestratorId, sessionId: clientSessionId, systemPrompt, model, playground, agents }: OrchestratorRunRequest = req.body;
  const sessionId = clientSessionId || orchestratorId;

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
        ...(agent.compaction ? { compaction: agent.compaction } : {}),
      };

      const piAgent = new PiAgent(config);
      activeAgents.set(`${sessionId}::${agent._id}`, piAgent);
      subAgentEntries.push({ agentData: agent, piAgent });

      console.log(`[runtime] Sub-agent "${agent.name}" (${sessionId}::${agent._id}) created`);
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
        stateful: agentData.stateful ?? false,
      });
    }

    orchestrator.initialize();

    // Store orchestrator and its underlying PiAgent (keyed by sessionId)
    activeOrchestrators.set(sessionId, orchestrator);
    orchestratorSubAgents.set(sessionId, agents);
    activeAgents.set(sessionId, orchestrator.getOrchestrator());
    sessionAgentMap.set(sessionId, orchestratorId);
    setCurrentAgentId(sessionId);
    global.activeAgent = orchestrator.getOrchestrator();
    global.activeAgentId = sessionId;

    console.log(`[runtime] Orchestrator session ${sessionId} (def ${orchestratorId}) created with ${agents.length} sub-agent(s)`);
    console.log(`[runtime]   model: ${resolveModel(model || 'claude-sonnet-4-6')}`);
    console.log(`[runtime]   sub-agents: ${agents.map((a) => a.name).join(', ')}`);

    res.json({
      success: true,
      orchestratorId,
      sessionId,
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
router.get('/runtime/orchestrator/:id/subagents', (req, res) => {
  const { id } = req.params;
  const agents = orchestratorSubAgents.get(id);
  if (!agents) {
    res.status(404).json({ error: 'Orchestrator not found or not an orchestrator' });
    return;
  }
  res.json(agents);
});

/**
 * GET /runtime/orchestrator/:orchId/subagent/:agentId/messages
 *
 * Returns the full conversation history for a sub-agent.
 */
router.get('/runtime/orchestrator/:orchId/subagent/:agentId/messages', async (req, res) => {
  const { orchId, agentId } = req.params;
  const orchestrator = activeOrchestrators.get(orchId);
  if (!orchestrator) {
    res.status(404).json({ error: 'Orchestrator not found' });
    return;
  }
  const agent = activeAgents.get(`${orchId}::${agentId}`);
  if (!agent) {
    res.status(404).json({ error: 'Sub-agent not found' });
    return;
  }
  try {
    const messages = await agent.getMessages();
    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /runtime/orchestrator/:id/stats
 *
 * Returns stats for the orchestrator and all its stateful sub-agents,
 * plus aggregated totals across all agents.
 */
router.get('/runtime/orchestrator/:id/stats', async (req, res) => {
  const { id } = req.params;

  const orchestratorAgent = activeAgents.get(id);
  if (!orchestratorAgent) {
    res.status(404).json({ error: 'Orchestrator not found in runtime.' });
    return;
  }

  const subAgentsData = orchestratorSubAgents.get(id);
  if (!subAgentsData) {
    res.status(404).json({ error: 'Not an orchestrator or no sub-agents registered.' });
    return;
  }

  // Orchestrator stats
  let orchestratorStats: any = { name: 'Orchestrator', contextUsage: null, sessionStats: null };
  try {
    orchestratorStats.contextUsage = orchestratorAgent.getContextUsage();
    orchestratorStats.sessionStats = orchestratorAgent.getSessionStats();
  } catch {
    // No active session yet
  }

  // Sub-agent stats
  const subAgents: any[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheRead = 0;
  let totalCacheWrite = 0;
  let totalTokens = 0;
  let totalCost = 0;
  let totalToolCalls = 0;

  // Include orchestrator in totals
  if (orchestratorStats.sessionStats) {
    const s = orchestratorStats.sessionStats;
    totalInputTokens += s.tokens?.input || 0;
    totalOutputTokens += s.tokens?.output || 0;
    totalCacheRead += s.tokens?.cacheRead || 0;
    totalCacheWrite += s.tokens?.cacheWrite || 0;
    totalTokens += s.tokens?.total || 0;
    totalCost += s.cost || 0;
    totalToolCalls += s.toolCalls || 0;
  }

  for (const agentData of subAgentsData) {
    const entry: any = {
      id: agentData._id,
      name: agentData.name,
      stateful: agentData.stateful ?? false,
      contextUsage: null,
      sessionStats: null,
      toolCallCounts: {},
    };

    if (agentData.stateful) {
      const piAgent = activeAgents.get(`${id}::${agentData._id}`);
      if (piAgent) {
        try {
          entry.contextUsage = piAgent.getContextUsage();
          entry.sessionStats = piAgent.getSessionStats();

          const s = entry.sessionStats;
          if (s) {
            totalInputTokens += s.tokens?.input || 0;
            totalOutputTokens += s.tokens?.output || 0;
            totalCacheRead += s.tokens?.cacheRead || 0;
            totalCacheWrite += s.tokens?.cacheWrite || 0;
            totalTokens += s.tokens?.total || 0;
            totalCost += s.cost || 0;
            totalToolCalls += s.toolCalls || 0;
          }
        } catch {
          // No active session yet for this sub-agent
        }

        // Extract per-tool call counts from message history
        try {
          const messages = await piAgent.getMessages();
          const counts: Record<string, number> = {};
          for (const msg of messages) {
            if (msg.role === 'assistant' && Array.isArray(msg.content)) {
              for (const block of msg.content) {
                if ((block.type === 'tool_use' || block.type === 'toolCall') && block.name) {
                  counts[block.name] = (counts[block.name] || 0) + 1;
                }
              }
            }
          }
          entry.toolCallCounts = counts;
        } catch {
          // No messages yet
        }
      }
    }

    subAgents.push(entry);
  }

  res.json({
    orchestrator: orchestratorStats,
    subAgents,
    totals: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      cacheRead: totalCacheRead,
      cacheWrite: totalCacheWrite,
      totalTokens,
      totalCost,
      totalToolCalls,
    },
  });
});

export default router;
