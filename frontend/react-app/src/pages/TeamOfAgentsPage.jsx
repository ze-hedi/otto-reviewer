import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './TeamOfAgentsPage.css';
import '../pages/AgentsPage.css';

const DEFAULT_SYSTEM_PROMPTS = {
  'Router': `You are a routing agent. Your sole responsibility is to analyze the user's request and forward it to the most appropriate specialist agent.

Available agents: {{agents}}

Rules:
- Read the user message carefully and identify the intent.
- Select exactly one agent whose expertise best matches the request.
- Forward the request to that agent without modifying it.
- If no agent matches, respond with a clear explanation of what is available.
- Never answer the user's request yourself.`,

  'Subagents as tool': `You are an orchestrator agent. You have access to a set of specialist agents exposed as tools. Break down the user's request into subtasks, delegate each subtask to the appropriate agent-tool, and synthesize their outputs into a single coherent response.

Rules:
- Decompose complex requests into smaller, focused subtasks.
- Call the right agent-tool for each subtask.
- Wait for each result before proceeding when there are dependencies.
- Combine all results into a clear, unified answer for the user.
- Do not perform tasks yourself if a specialist agent-tool exists for them.`,
};

function TeamOfAgentsPage() {
  const navigate = useNavigate();
  const [pattern, setPattern] = useState('');
  const [patterns, setPatterns] = useState([]);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [availableAgents, setAvailableAgents] = useState([]);

  useEffect(() => {
    fetch('/api/multi-agent-patterns')
      .then((r) => r.json())
      .then(setPatterns)
      .catch(console.error);
  }, []);

  function openAgentPicker() {
    fetch('/api/agents')
      .then((r) => r.json())
      .then((agents) => {
        setAvailableAgents(agents);
        setShowAgentPicker(true);
      })
      .catch(console.error);
  }

  function handlePatternChange(e) {
    const selectedId = e.target.value;
    setPattern(selectedId);
    const selected = patterns.find((p) => p._id === selectedId);
    setSystemPrompt(selected ? (DEFAULT_SYSTEM_PROMPTS[selected.name] ?? '') : '');
  }

  return (
    <div className="team-page-container">
      <div className="team-page-content">
        <div className="team-header-row">
          <h1>Create a team of agent</h1>
          <button className="team-back-btn" onClick={() => navigate('/')}>
            Back
          </button>
        </div>
        <form className="team-form">
          <div className="form-group">
            <label htmlFor="multi-agent-pattern">Multi agent pattern</label>
            <select
              id="multi-agent-pattern"
              value={pattern}
              onChange={handlePatternChange}
            >
              <option value="" disabled>Select a pattern</option>
              {patterns.map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="system-prompt">System prompt</label>
            <textarea
              id="system-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Select a pattern to load a default system prompt, or write your own…"
            />
          </div>
          <div className="form-group">
            {!showAgentPicker && (
              <button type="button" className="add-agent-btn team-add-agent-btn" onClick={openAgentPicker}>
                + Add agent
              </button>
            )}
            {showAgentPicker && (
              <div className="agent-picker-inline">
                <div className="agent-picker-inline-header">
                  <span>Select an agent</span>
                  <button type="button" className="team-back-btn" onClick={() => setShowAgentPicker(false)}>Close</button>
                </div>
                <div className="agents-grid">
                  {availableAgents.map((agent) => (
                    <div key={agent._id} className="agent-card">
                      <div className="agent-header">
                        <h3 className="agent-name">{agent.icon} {agent.name}</h3>
                        <span className={`agent-status ${agent.status?.toLowerCase()}`}>{agent.status}</span>
                      </div>
                      <p className="agent-description">{agent.description}</p>
                      <div className="agent-actions">
                        <button type="button" className="agent-action-btn edit-btn">Add</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default TeamOfAgentsPage;
