import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './AgentsPage.css';

function OrchestratorPage() {
  const navigate = useNavigate();
  const [orchestrators, setOrchestrators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [popup, setPopup] = useState(null);

  useEffect(() => {
    fetch('/api/orchestrators')
      .then((r) => r.json())
      .then((data) => {
        setOrchestrators(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleRun = async (orch) => {
    try {
      const res = await fetch('http://localhost:5000/runtime/orchestrator/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orchestratorId: orch._id,
          systemPrompt: '',
          model: orch.model,
          playground: orch.playground,
          agents: (orch.subAgents || []).map((s) => ({ ...s.agent, stateful: s.stateful })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPopup(data.error || 'Failed to start orchestrator');
        return;
      }
      navigate(`/chat/${orch._id}`, {
        state: {
          agent: {
            _id: orch._id,
            name: orch.name,
            description: orch.description,
            model: data.model,
            type: 'orchestrator',
          },
        },
      });
    } catch (err) {
      setPopup(`Failed to start orchestrator: ${err.message}`);
    }
  };

  const handleDelete = async (orch) => {
    if (!window.confirm(`Delete orchestrator "${orch.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/orchestrators/${orch._id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete orchestrator');
      }
      setOrchestrators((prev) => prev.filter((o) => o._id !== orch._id));
    } catch (err) {
      alert(`Failed to delete orchestrator: ${err.message}`);
    }
  };

  if (loading) return (
    <div className="agents-container">
      <div className="agents-content">
        <p className="agents-subtitle">Loading orchestrators...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="agents-container">
      <div className="agents-content">
        <p className="agents-subtitle" style={{ color: '#f87171' }}>Error: {error}</p>
      </div>
    </div>
  );

  return (
    <div className="agents-container">
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
      <div className="agents-content">
        <div className="agents-header-row">
          <div>
            <h1>Orchestrators</h1>
            <p className="agents-subtitle">Manage your orchestrators</p>
          </div>
          <button className="add-agent-btn" onClick={() => navigate('/team-of-agents')}>
            + Create Orchestrator
          </button>
        </div>
        <div className="agents-grid">
          {orchestrators.map((orch) => (
            <div key={orch._id} className="agent-card">
              <div className="agent-header">
                <h3 className="agent-name">{orch.name}</h3>
                <span className="agent-status">
                  {orch.subAgents?.length || 0} sub-agent{(orch.subAgents?.length || 0) !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="agent-description">{orch.description}</p>
              <div className="agent-actions">
                <button className="agent-action-btn view-btn" onClick={() => handleRun(orch)}>
                  Run
                </button>
                <button className="agent-action-btn delete-btn" onClick={() => handleDelete(orch)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default OrchestratorPage;
