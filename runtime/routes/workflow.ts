// runtime/routes/workflow.ts
// Workflow execution — translates the visual graph into runtime agents/orchestrators.

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
import type { AgentData, AgentFile } from '../types.js';
import { buildExecutionQueue } from '../workflow-scheduler.js';

const router = Router();

interface WorkflowNode {
  id: string;
  type: 'agent' | 'tool' | 'artefact';
  name: string;
  icon?: string;
  agentId?: string;
  toolId?: string;
  artefactType?: string;
}

interface WorkflowConnection {
  from: string;
  fromSide: string;
  to: string;
  toSide: string;
  linkType?: string;
}

interface WorkflowRunRequest {
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
}

/**
 * POST /runtime/workflow/run
 *
 * Receives the workflow graph (nodes + connections) and spins up
 * the corresponding agents/orchestrator in the runtime.
 */
router.post('/runtime/workflow/run', async (req, res) => {
  const { nodes, connections }: WorkflowRunRequest = req.body;

  if (!nodes?.length) {
    res.status(400).json({ error: 'Workflow must contain at least one node' });
    return;
  }

  const agentNodes = nodes.filter((n) => n.type === 'agent');
  if (agentNodes.length === 0) {
    res.status(400).json({ error: 'Workflow must contain at least one agent' });
    return;
  }

  try {
    // Build execution queue (Kahn's topological sort)
    const executionQueue = buildExecutionQueue(nodes, connections);
    console.log(`[runtime] Workflow execution queue (${executionQueue.length} levels):`);
    executionQueue.forEach((level, i) => {
      console.log(`[runtime]   Level ${i}: ${level.map((n) => `${n.name || n.id} (${n.type})`).join(', ')}`);
    });

    // Fetch full agent data from the DB for each agent node
    const agentDataMap = new Map<string, AgentData>();

    for (const node of agentNodes) {
      if (!node.agentId) continue;
      const agentRes = await fetch(`http://localhost:4000/api/agents/${node.agentId}`);
      if (!agentRes.ok) {
        res.status(400).json({ error: `Could not fetch agent "${node.name}" from database` });
        return;
      }
      const agent: AgentData = await agentRes.json();
      agentDataMap.set(node.id, agent);
    }

    // Determine tool links from connections
    const toolLinksPerAgent = new Map<string, string[]>();
    for (const conn of connections) {
      if (conn.linkType === 'tool-link') {
        const fromNode = nodes.find((n) => n.id === conn.from);
        const toNode = nodes.find((n) => n.id === conn.to);
        const agentNodeId = fromNode?.type === 'agent' ? conn.from : toNode?.type === 'agent' ? conn.to : null;
        const toolNode = fromNode?.type === 'tool' ? fromNode : toNode?.type === 'tool' ? toNode : null;
        if (agentNodeId && toolNode?.toolId) {
          const existing = toolLinksPerAgent.get(agentNodeId) || [];
          existing.push(toolNode.toolId);
          toolLinksPerAgent.set(agentNodeId, existing);
        }
      }
    }

    const sessionId = `workflow-${Date.now()}`;

    // Single agent — run directly
    if (agentNodes.length === 1) {
      const node = agentNodes[0];
      const agent = agentDataMap.get(node.id)!;

      // Fetch agent files
      let files: AgentFile[] = [];
      try {
        const filesRes = await fetch(`http://localhost:4000/api/agents/${agent._id}/files`);
        if (filesRes.ok) files = await filesRes.json();
      } catch {}

      const soulFile = files.find((f) => f.type === 'soul');
      const skillsFile = files.find((f) => f.type === 'skills');
      const skills = skillsFile ? [{ name: 'agent-skills', content: skillsFile.content }] : [];

      const config: PiAgentConfig = {
        name: agent.name,
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
      activeAgents.set(sessionId, piAgent);
      sessionAgentMap.set(sessionId, agent._id);
      setCurrentAgentId(sessionId);
      global.activeAgent = piAgent;
      global.activeAgentId = sessionId;

      console.log(`[runtime] Workflow single-agent session ${sessionId} started: "${agent.name}"`);

      res.json({
        success: true,
        mode: 'single-agent',
        sessionId,
        agent: agent.name,
        executionQueue: executionQueue.map((level) => level.map((n) => ({ id: n.id, type: n.type, name: n.name }))),
      });
      return;
    }

    // Multiple agents — create orchestrator
    const subAgentEntries: { agentData: AgentData; piAgent: PiAgent }[] = [];
    const agentsForState: AgentData[] = [];

    for (const node of agentNodes) {
      const agent = agentDataMap.get(node.id)!;
      agentsForState.push(agent);

      let files: AgentFile[] = [];
      try {
        const filesRes = await fetch(`http://localhost:4000/api/agents/${agent._id}/files`);
        if (filesRes.ok) files = await filesRes.json();
      } catch {}

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

      console.log(`[runtime] Workflow sub-agent "${agent.name}" (${sessionId}::${agent._id}) created`);
    }

    // Create orchestrator
    const orchestrator = new PiOrchestrator({
      model: resolveModel('claude-sonnet-4-6'),
      sessionMode: 'memory',
      thinkingLevel: 'medium',
      apiKey: process.env.ANTHROPIC_API_KEY || undefined,
    });

    for (const { agentData, piAgent } of subAgentEntries) {
      orchestrator.addSubAgent({
        name: agentData.name,
        description: agentData.description,
        agent: piAgent,
        stateful: false,
      });
    }

    orchestrator.initialize();

    activeOrchestrators.set(sessionId, orchestrator);
    orchestratorSubAgents.set(sessionId, agentsForState);
    activeAgents.set(sessionId, orchestrator.getOrchestrator());
    sessionAgentMap.set(sessionId, sessionId);
    setCurrentAgentId(sessionId);
    global.activeAgent = orchestrator.getOrchestrator();
    global.activeAgentId = sessionId;

    console.log(`[runtime] Workflow orchestrator session ${sessionId} created with ${agentNodes.length} agents`);
    console.log(`[runtime]   agents: ${agentsForState.map((a) => a.name).join(', ')}`);

    res.json({
      success: true,
      mode: 'orchestrator',
      sessionId,
      agents: agentsForState.map((a) => a.name),
      executionQueue: executionQueue.map((level) => level.map((n) => ({ id: n.id, type: n.type, name: n.name }))),
    });
  } catch (err: any) {
    console.error(`[runtime] Workflow run failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

export default router;
