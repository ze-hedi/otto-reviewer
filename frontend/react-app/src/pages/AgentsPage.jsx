import React, { useEffect, useState } from 'react';
import './AgentsPage.css';

function AgentsPage() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');

  useEffect(() => {
    fetch('/api/agents')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load agents');
        return res.json();
      })
      .then((data) => {
        setAgents(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="agents-container"><div className="agents-content"><p className="agents-subtitle">Loading agents...</p></div></div>;
  if (error) return <div className="agents-container"><div className="agents-content"><p className="agents-subtitle" style={{ color: '#f87171' }}>Error: {error}</p></div></div>;

  return (
    <div className="agents-container">
      <div className="agents-content">
        <div className={`agents-header-row${showForm ? ' agents-header-row--centered' : ''}`}>
          <div>
            <h1>Agents</h1>
            <p className="agents-subtitle">Manage your AI agents</p>
          </div>
          {!showForm && (
            <button className="add-agent-btn" onClick={() => setShowForm(true)}>+ Add Agent</button>
          )}
        </div>

        {showForm ? (
          <div className="create-agent-form">
            <h2 className="create-agent-title">New Agent</h2>
            <div className="form-group">
              <label className="form-label" htmlFor="agent-name">Name</label>
              <input
                id="agent-name"
                className="form-input"
                type="text"
                placeholder="Agent name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="agent-description">Description</label>
              <textarea
                id="agent-description"
                className="form-textarea"
                placeholder="Describe what this agent does..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={4}
              />
            </div>
            <div className="form-actions">
              <button className="agent-action-btn view-btn" onClick={() => { setShowForm(false); setFormName(''); setFormDescription(''); }}>
                Cancel
              </button>
              <button className="agent-action-btn edit-btn create-agent-submit-btn">
                Create Agent
              </button>
            </div>
          </div>
        ) : (
          <div className="agents-grid">
            {agents.map((agent) => (
              <div key={agent._id} className="agent-card">
                <div className="agent-header">
                  <h3 className="agent-name">{agent.name}</h3>
                  <span className={`agent-status ${agent.status.toLowerCase()}`}>
                    {agent.status}
                  </span>
                </div>
                <div className="agent-type">{agent.type}</div>
                <p className="agent-description">{agent.description}</p>
                <div className="agent-actions">
                  <button className="agent-action-btn view-btn">View</button>
                  <button className="agent-action-btn edit-btn">Edit</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AgentsPage;
