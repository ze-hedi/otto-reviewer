import React, { useEffect, useState, useCallback } from 'react';
import './SubAgentsPanel.css';

function SubAgentsPanel({ agentId, orchestratorId, onClose, onViewSubAgent }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSubAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`http://localhost:5000/runtime/orchestrator/${agentId}/subagents`);
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { throw new Error(`Invalid response from server: ${text.slice(0, 100)}`); }
      if (!res.ok) {
        setError(json.error || `Server error ${res.status}`);
        setAgents([]);
      } else {
        setAgents(json);
      }
    } catch (err) {
      setError(err.message);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchSubAgents();
  }, [fetchSubAgents]);

  return (
    <div className="sap-panel">
      <div className="sap-header">
        <span className="sap-title">Sub-agents</span>
        <div className="sap-header-actions">
          <button className="sap-refresh-btn" onClick={fetchSubAgents} disabled={loading} title="Refresh">
            ↻
          </button>
          <button className="sap-close-btn" onClick={onClose} title="Close">
            ×
          </button>
        </div>
      </div>
      <div className="sap-body">
        {error && (
          <div className="sap-error">
            <span className="sap-error-icon">⚠</span>
            <span>{error}</span>
          </div>
        )}
        {!error && agents.length === 0 && !loading && (
          <p className="sap-empty">No sub-agents found.</p>
        )}
        {agents.map((agent) => (
          <div
            key={agent._id}
            className={`sap-agent-card${agent.stateful ? ' sap-clickable' : ''}`}
            onClick={async () => {
              if (!agent.stateful) return;
              try {
                const res = await fetch(`http://localhost:5000/runtime/orchestrator/${orchestratorId}/subagent/${agent._id}/messages`);
                const msgs = await res.json();
                console.log(`[${agent.name}] messages:`, msgs);
                if (onViewSubAgent) onViewSubAgent({ agentId: agent._id, name: agent.name, messages: msgs });
              } catch (err) {
                console.error(`Failed to fetch messages for ${agent.name}:`, err);
              }
            }}
          >
            <div className="sap-agent-header">
              <span className="sap-agent-icon">{agent.icon || '🤖'}</span>
              <span className="sap-agent-name">{agent.name}</span>
              <span className={`sap-agent-tag ${agent.stateful ? 'sap-tag-stateful' : 'sap-tag-stateless'}`}>
                {agent.stateful ? 'Stateful' : 'Stateless'}
              </span>
            </div>
            <p className="sap-agent-description">{agent.description}</p>
            <div className="sap-agent-meta">
              <span className="sap-agent-tag">{agent.model}</span>
              {agent.playground && <span className="sap-agent-tag">{agent.playground}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SubAgentsPanel;
