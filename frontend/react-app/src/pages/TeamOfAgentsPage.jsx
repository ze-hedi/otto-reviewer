import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PiAgentFormContainer from '../components/agents/PiAgentFormContainer';
import ModelSelect from '../components/ModelSelect';
import './TeamOfAgentsPage.css';
import '../pages/AgentsPage.css';


function TeamOfAgentsPage() {
  const navigate = useNavigate();
  const [patternId, setPatternId] = useState(null);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [availableAgents, setAvailableAgents] = useState([]);
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [playground, setPlayground] = useState('');
  const [model, setModel] = useState('anthropic/claude-sonnet-4-6');
  const [orchestratorName, setOrchestratorName] = useState('');
  const [orchestratorDescription, setOrchestratorDescription] = useState('');
  const [popup, setPopup] = useState(null);

  useEffect(() => {
    fetch('/api/multi-agent-patterns')
      .then((r) => r.json())
      .then((patterns) => {
        const subagentPattern = patterns.find((p) => p.name === 'Subagents as tool');
        if (subagentPattern) {
          setPatternId(subagentPattern._id);
          setSystemPrompt(subagentPattern.systemPrompt ?? '');
        }
      })
      .catch(console.error);
  }, []);

  async function handleRun() {
    if (!orchestratorName.trim()) {
      setPopup('Please provide a name for the orchestrator.');
      return;
    }
    if (selectedAgents.length === 0) {
      setPopup('Add at least one agent before running.');
      return;
    }

    try {
      // Step 1: Save orchestrator to database
      const saveRes = await fetch('/api/orchestrators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: orchestratorName.trim(),
          description: orchestratorDescription.trim() || `Orchestrator with ${selectedAgents.length} sub-agent(s)`,
          model,
          playground,
          systemPrompt,
          subAgents: selectedAgents.map((e) => ({ agentId: e.agent._id, stateful: e.stateful })),
        }),
      });
      const savedAgent = await saveRes.json();
      if (!saveRes.ok) {
        setPopup(savedAgent.error || 'Failed to save orchestrator');
        return;
      }

      const orchestratorId = savedAgent._id;

      // Step 2: Send to runtime
      const res = await fetch('http://localhost:5000/runtime/orchestrator/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orchestratorId,
          systemPrompt,
          model,
          playground,
          agents: selectedAgents.map((e) => ({ ...e.agent, stateful: e.stateful })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPopup(data.error || 'Failed to start orchestrator');
        return;
      }
      navigate(`/chat/${orchestratorId}`, {
        state: {
          agent: {
            _id: orchestratorId,
            name: orchestratorName.trim(),
            description: `Orchestrator with ${selectedAgents.length} sub-agent(s)`,
            model: data.model,
            type: 'orchestrator',
          },
        },
      });
    } catch (err) {
      setPopup(`Error: ${err.message}`);
    }
  }

  function openAgentPicker() {
    fetch('/api/agents')
      .then((r) => r.json())
      .then((agents) => {
        setAvailableAgents(agents);
        setShowAgentPicker(true);
      })
      .catch(console.error);
  }

return (
    <div className="team-page-container">
      {popup && (
        <div className="agent-error-popup">
          <div className="agent-error-popup__box">
            <p className="agent-error-popup__title">Cannot start orchestrator</p>
            <p className="agent-error-popup__message">{popup}</p>
            <button className="agent-error-popup__close" onClick={() => setPopup(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}
      <div className="team-page-content">
        <div className="team-header-row">
          <h1>Build your orchestrator</h1>
          <button className="team-back-btn" onClick={() => navigate('/')}>
            Back
          </button>
        </div>
        <form className="team-form">
              <div className="form-group">
                <label htmlFor="orchestrator-name">Name</label>
                <input
                  id="orchestrator-name"
                  className="form-input"
                  type="text"
                  placeholder="My orchestrator"
                  value={orchestratorName}
                  onChange={(e) => setOrchestratorName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="orchestrator-description">Description</label>
                <textarea
                  id="orchestrator-description"
                  placeholder="Describe what this orchestrator does…"
                  value={orchestratorDescription}
                  onChange={(e) => setOrchestratorDescription(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="system-prompt">System prompt</label>
                <textarea
                  id="system-prompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Loading system prompt…"
                />
              </div>
              <div className="form-group">
                <label htmlFor="orchestrator-model">Model</label>
                <ModelSelect id="orchestrator-model" value={model} onChange={(e) => setModel(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="playground">Playground</label>
                <input
                  id="playground"
                  className="form-input"
                  type="text"
                  placeholder="/path/to/your/repo"
                  value={playground}
                  onChange={(e) => setPlayground(e.target.value)}
                />
              </div>
              <div className="form-group">
                {selectedAgents.length > 0 && (
                  <div className="selected-agents-list">
                    <label className="selected-agents-label">Spawned agents</label>
                    <div className="selected-agents-chips">
                      {selectedAgents.map((entry) => (
                        <div key={entry.agent._id} className="selected-agent-chip">
                          <span>{entry.agent.icon} {entry.agent.name}</span>
                          <div className="stateful-toggle">
                            <button
                              type="button"
                              className={!entry.stateful ? 'active' : ''}
                              onClick={() => setSelectedAgents((prev) => prev.map((e) => e.agent._id === entry.agent._id ? { ...e, stateful: false } : e))}
                            >Stateless</button>
                            <button
                              type="button"
                              className={entry.stateful ? 'active' : ''}
                              onClick={() => setSelectedAgents((prev) => prev.map((e) => e.agent._id === entry.agent._id ? { ...e, stateful: true } : e))}
                            >Stateful</button>
                          </div>
                          <button
                            type="button"
                            className="selected-agent-remove"
                            onClick={() => setSelectedAgents((prev) => prev.filter((e) => e.agent._id !== entry.agent._id))}
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
                                if (!selectedAgents.find((e) => e.agent._id === agent._id)) {
                                  setSelectedAgents((prev) => [...prev, { agent, stateful: false }]);
                                }
                              }}
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              className="agent-action-btn edit-btn"
                              onClick={() => setEditingAgent(agent)}
                            >
                              Edit
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
              <button type="button" className="team-run-btn" onClick={handleRun}>
                Run
              </button>
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
      {editingAgent && (
        <>
          <div className="create-agent-overlay" onClick={() => setEditingAgent(null)} />
          <div className="create-agent-drawer">
            <PiAgentFormContainer
              editingAgent={editingAgent}
              onUpdated={(updated) => {
                setAvailableAgents((prev) => prev.map((a) => a._id === updated._id ? updated : a));
                setSelectedAgents((prev) => prev.map((a) => a._id === updated._id ? updated : a));
                setEditingAgent(null);
              }}
              onCancel={() => setEditingAgent(null)}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default TeamOfAgentsPage;
