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
import { buildExecutionQueue, compileGraph } from '../workflow-scheduler.js';
import { briefingTool, planTool, reportTool, createDelegateTool } from '../../workflow_interfaces_tools.js';

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
 * POST /runtime/workflow/compile
 *
 * Receives the workflow graph (nodes + connections) and spins up
 * the corresponding agents/orchestrator in the runtime.
 */
router.post('/runtime/workflow/compile', async (req, res) => {
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
    // Build execution queue (Kahn's topological sort) and validate
    const queueResult = buildExecutionQueue(nodes, connections);
    const { levels: executionQueue, predecessors, successors } = compileGraph(queueResult);
    console.log(`[runtime] Workflow execution queue (${executionQueue.length} levels):`);
    executionQueue.forEach((level, i) => {
      console.log(`[runtime]   Level ${i}: ${level.map((n) => `${n.name || n.id} (${n.type})`).join(', ')}`);
    });

    // Agent data is now sent directly from the frontend — no DB fetch needed
    const buildAgent = (node: any): { agent: AgentData; piAgent: PiAgent } => {
      const files: AgentFile[] = node.files || [];
      const soulFile = files.find((f) => f.type === 'soul');
      const skillsFile = files.find((f) => f.type === 'skills');
      const skills = skillsFile ? [{ name: 'agent-skills', content: skillsFile.content }] : [];

      const config: PiAgentConfig = {
        name: node.name,
        model: resolveModel(node.model),
        systemPromptSuffix: soulFile?.content?.trim() || undefined,
        skills,
        sessionMode: node.sessionMode || 'memory',
        thinkingLevel: node.thinkingLevel || 'medium',
        workingDir: node.workingDir?.trim() || undefined,
        playground: node.playground?.trim() || undefined,
        apiKey: node.apiKey || process.env.ANTHROPIC_API_KEY || undefined,
        ...(node.compaction ? { compaction: node.compaction } : {}),
      };

      return { agent: node as AgentData, piAgent: new PiAgent(config) };
    };

    const sessionId = `workflow-${Date.now()}`;

    // Build all agents first
    const agentMap = new Map<string, { agent: AgentData; piAgent: PiAgent }>();
    for (const node of agentNodes) {
      agentMap.set(node.id, buildAgent(node));
    }

    // Assign interface tools to each agent based on outgoing interfaces
    const agentDetails: { name: string; model: string; sessionMode: string; thinkingLevel: string; tools: string[] }[] = [];

    for (const node of agentNodes) {
      const { agent: agentData, piAgent } = agentMap.get(node.id)!;
      const nodeSuccessors = successors.get(node.id) || [];
      const assignedTools: string[] = [];

      for (const succ of nodeSuccessors) {
        if (succ.type !== 'artefact') continue;
        const interfaceName = (succ.name || '').toLowerCase();

        if (interfaceName === 'briefing') {
          piAgent.addTool(briefingTool);
          assignedTools.push('briefing');
          console.log(`[runtime]   Assigned briefingTool to "${node.name}"`);
        } else if (interfaceName === 'plan') {
          piAgent.addTool(planTool);
          assignedTools.push('plan');
          console.log(`[runtime]   Assigned planTool to "${node.name}"`);
        } else if (interfaceName === 'report') {
          piAgent.addTool(reportTool);
          assignedTools.push('report');
          console.log(`[runtime]   Assigned reportTool to "${node.name}"`);
        } else if (interfaceName === 'delegate') {
          const delegateSuccessors = successors.get(succ.id) || [];
          const subAgents: Record<string, string> = {};
          for (const delegatedNode of delegateSuccessors) {
            if (delegatedNode.type === 'agent') {
              const delegatedAgent = agentMap.get(delegatedNode.id);
              if (delegatedAgent) {
                subAgents[delegatedAgent.agent.name] = delegatedAgent.agent.description;
              }
            }
          }
          piAgent.addTool(createDelegateTool(subAgents));
          assignedTools.push(`delegate → [${Object.keys(subAgents).join(', ')}]`);
          console.log(`[runtime]   Assigned delegateTool to "${node.name}" (delegates to: ${Object.keys(subAgents).join(', ')})`);
        }
      }

      agentDetails.push({
        name: agentData.name,
        model: agentData.model,
        sessionMode: agentData.sessionMode || 'memory',
        thinkingLevel: agentData.thinkingLevel || 'medium',
        tools: assignedTools,
      });
    }

    // Single agent — run directly
    if (agentNodes.length === 1) {
      const node = agentNodes[0];
      const { agent, piAgent } = agentMap.get(node.id)!;

      activeAgents.set(sessionId, piAgent);
      sessionAgentMap.set(sessionId, agent._id);
      setCurrentAgentId(sessionId);
      global.activeAgent = piAgent;
      global.activeAgentId = sessionId;

      console.log(`[runtime] Workflow single-agent session ${sessionId} started: "${agent.name}"`);

      res.json({
        success: true,
        compilationSuccess: true,
        mode: 'single-agent',
        sessionId,
        agent: agent.name,
        agentDetails,
        executionQueue: executionQueue.map((level) => level.map((n) => ({ id: n.id, type: n.type, name: n.name }))),
      });
      return;
    }

    // Multiple agents — create orchestrator
    const subAgentEntries: { agentData: AgentData; piAgent: PiAgent }[] = [];

    for (const node of agentNodes) {
      const { agent, piAgent } = agentMap.get(node.id)!;
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

    const agentsForState = subAgentEntries.map((e) => e.agentData);
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
      compilationSuccess: true,
      mode: 'orchestrator',
      sessionId,
      agents: agentsForState.map((a) => a.name),
      agentDetails,
      executionQueue: executionQueue.map((level) => level.map((n) => ({ id: n.id, type: n.type, name: n.name }))),
    });
  } catch (err: any) {
    console.error(`[runtime] Workflow run failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

export default router;
