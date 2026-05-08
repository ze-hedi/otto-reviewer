import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PiAgentFormContainer from '../components/agents/PiAgentFormContainer';
import './TeamOfAgentsPage.css';
import '../pages/AgentsPage.css';


function TeamOfAgentsPage() {
  const navigate = useNavigate();
  const [pattern, setPattern] = useState('');
  const [patterns, setPatterns] = useState([]);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [editedPrompts, setEditedPrompts] = useState({});
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [availableAgents, setAvailableAgents] = useState([]);
  const [selectedAgents, setSelectedAgents] = useState([]);

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
    if (pattern) {
      setEditedPrompts((prev) => ({ ...prev, [pattern]: systemPrompt }));
    }
    setPattern(selectedId);
    const selected = patterns.find((p) => p._id === selectedId);
    const cached = editedPrompts[selectedId];
    setSystemPrompt(cached !== undefined ? cached : (selected?.systemPrompt ?? ''));
    setSelectedAgents([]);
    setShowAgentPicker(false);
  }

return (
    <div className="team-page-container">
      <div className="team-page-content">
        <div className="team-header-row">
          <h1>Build your orchestrator</h1>
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
          {pattern && (
            <>
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
                {selectedAgents.length > 0 && (
                  <div className="selected-agents-list">
                    <label className="selected-agents-label">Spawned agents</label>
                    <div className="selected-agents-chips">
                      {selectedAgents.map((agent) => (
                        <div key={agent._id} className="selected-agent-chip">
                          <span>{agent.icon} {agent.name}</span>
                          <button
                            type="button"
                            className="selected-agent-remove"
                            onClick={() => setSelectedAgents((prev) => prev.filter((a) => a._id !== agent._id))}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                            <button
                              type="button"
                              className="agent-action-btn edit-btn"
                              onClick={() => {
                                if (!selectedAgents.find((a) => a._id === agent._id)) {
                                  setSelectedAgents((prev) => [...prev, agent]);
                                }
                              }}
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button type="button" className="add-agent-btn team-add-agent-btn" onClick={() => setShowCreateAgent(true)}>
                      + Create an agent
                    </button>
                  </div>
                )}
              </div>
              <button type="button" className="team-run-btn">
                Run
              </button>
            </>
          )}
        </form>
      </div>
      {showCreateAgent && (
        <>
          <div className="create-agent-overlay" onClick={() => setShowCreateAgent(false)} />
          <div className="create-agent-drawer">
            <PiAgentFormContainer
              onCreated={(agent) => {
                setAvailableAgents((prev) => [...prev, agent]);
                setShowCreateAgent(false);
              }}
              onCancel={() => setShowCreateAgent(false)}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default TeamOfAgentsPage;
