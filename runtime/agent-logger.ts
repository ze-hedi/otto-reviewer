/**
 * Asynchronous logger for capturing agent step responses
 * Stores logs per agent session with timestamps and event details
 */

export interface AgentLogEntry {
  timestamp: Date;
  agentId: string;
  eventType: 'message_update' | 'tool_execution_start' | 'tool_execution_end' | 'message_end' | 'prompt_end' | 'error';
  data: any;
}

class AgentLogger {
  private logs: Map<string, AgentLogEntry[]> = new Map();
  private maxLogsPerAgent: number = 1000; // Prevent memory overflow

  /**
   * Log an agent event asynchronously
   */
  async log(agentId: string, eventType: AgentLogEntry['eventType'], data: any): Promise<void> {
    // Run asynchronously without blocking
    setImmediate(() => {
      if (!this.logs.has(agentId)) {
        this.logs.set(agentId, []);
      }

      const agentLogs = this.logs.get(agentId)!;
      
      // Add new log entry
      agentLogs.push({
        timestamp: new Date(),
        agentId,
        eventType,
        data
      });

      // Trim logs if exceeding max
      if (agentLogs.length > this.maxLogsPerAgent) {
        agentLogs.shift(); // Remove oldest entry
      }
    });
  }

  /**
   * Get all logs for a specific agent
   */
  getLogs(agentId: string): AgentLogEntry[] {
    return this.logs.get(agentId) || [];
  }

  /**
   * Get all logs for all agents
   */
  getAllLogs(): Map<string, AgentLogEntry[]> {
    return this.logs;
  }

  /**
   * Clear logs for a specific agent
   */
  clearLogs(agentId: string): void {
    this.logs.delete(agentId);
  }

  /**
   * Clear all logs
   */
  clearAllLogs(): void {
    this.logs.clear();
  }

  /**
   * Format logs as readable text
   */
  formatLogs(agentId: string): string {
    const logs = this.getLogs(agentId);
    
    if (logs.length === 0) {
      return `No logs found for agent: ${agentId}`;
    }

    let output = `\n${'='.repeat(80)}\n`;
    output += `Agent Logs for: ${agentId}\n`;
    output += `Total Entries: ${logs.length}\n`;
    output += `${'='.repeat(80)}\n\n`;

    logs.forEach((entry, index) => {
      output += `[${index + 1}] ${entry.timestamp.toISOString()}\n`;
      output += `Event: ${entry.eventType}\n`;
      output += `Data: ${JSON.stringify(entry.data, null, 2)}\n`;
      output += `${'-'.repeat(80)}\n`;
    });

    return output;
  }

  /**
   * Format all logs as readable text
   */
  formatAllLogs(): string {
    let output = '';
    
    this.logs.forEach((_logs, agentId) => {
      output += this.formatLogs(agentId);
      output += '\n\n';
    });

    return output || 'No logs available';
  }
}

// Singleton instance
export const agentLogger = new AgentLogger();
