// runtime/routes/logs.ts
// Agent log retrieval endpoints.

import { Router } from 'express';
import { agentLogger } from '../agent-logger.js';

const router = Router();

/**
 * GET /runtime/logs/:id
 *
 * Retrieves and prints the logs for a specific agent.
 * Returns formatted logs as JSON and prints them to console.
 */
router.get('/runtime/logs/:id', (req, res) => {
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
router.get('/runtime/logs', (_req, res) => {
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

export default router;
