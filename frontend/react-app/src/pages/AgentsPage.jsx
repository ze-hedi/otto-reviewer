import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgentSessions, createSession, removeSession, abortAgent } from '../AgentChatContext';
import PiAgentFormContainer from '../components/agents/PiAgentFormContainer';
import './AgentsPage.css';
import '../components/AgentForm.css';

// Small wrapper so we can call useAgentSessions per agent card
function OpenChatsButton({ agent, onNavigate, onDeleteSession }) {
  const sessions = useAgentSessions(agent._id);
  const [showPopup, setShowPopup] = useState(false);

  if (sessions.length === 0) return null;

  return (
    <>
      <button
        className="agent-action-btn view-btn"
        onClick={() => setShowPopup(true)}
      >
        Chats ({sessions.length})
      </button>
      {showPopup && (
        <div className="agent-error-popup" onClick={() => setShowPopup(false)}>
          <div className="chats-popup__box" onClick={(e) => e.stopPropagation()}>
            <p className="chats-popup__title">Active Chats — {agent.name}</p>
            <div className="chats-popup__list">
              {sessions.map((s, idx) => (
                <div key={s.sessionId} className="chats-popup__item-row">
                  <button
                    className="chats-popup__item"
                    onClick={() => {
                      setShowPopup(false);
                      onNavigate(agent, s.sessionId);
                    }}
                  >
                    <span className="chats-popup__item-name">Chat {idx + 1}</span>
                    <span className="chats-popup__item-meta">
                      {s.messageCount} messages
                      {s.streaming && <span className="chats-popup__streaming-dot" />}
                    </span>
                  </button>
                  <button
                    className="chats-popup__delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(s.sessionId);
                    }}
                    title="Close this session"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
            <button className="chats-popup__close" onClick={() => setShowPopup(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function AgentsPage() {
  const navigate = useNavigate();
  const [agents, setAgents]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [sessionMap, setSessionMap] = useState({}); // sessionId → agentId
  const [showFlow, setShowFlow]           = useState(false);
  const [editingAgent, setEditingAgent]   = useState(null);
  const [popup, setPopup]                 = useState(null); // { message, code, agent }
  const [apiKeyInput, setApiKeyInput]     = useState('');
  const [savingKey, setSavingKey]         = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/agents').then((r) => r.json()),
      fetch('http://localhost:5000/runtime/status').then((r) => r.json()).catch(() => ({ activeAgents: [] })),
    ])
      .then(([piAgents, runtimeStatus]) => {
        setAgents(piAgents);
        setSessionMap(runtimeStatus.sessionAgentMap ?? {});
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const resetFlow = () => {
    setShowFlow(false);
    setEditingAgent(null);
  };

  const handleCreated = (agent) => {
    setAgents((prev) => [...prev, agent]);
    resetFlow();
  };

  const handleUpdated = (agent) => {
    setAgents((prev) => prev.map((a) => (a._id === agent._id ? agent : a)));
    resetFlow();
  };

  const openEdit = (agent) => {
    setEditingAgent(agent);
    setShowFlow(true);
  };

  const handleDelete = async (agent) => {
    if (!window.confirm(`Delete agent "${agent.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/agents/${agent._id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete agent');
      }
      setAgents((prev) => prev.filter((a) => a._id !== agent._id));
    } catch (err) {
      alert(`Failed to delete agent: ${err.message}`);
    }
  };

  const handleDeactivate = async (agent) => {
    // Find all sessionIds belonging to this agent
    const sids = Object.entries(sessionMap)
      .filter(([, aid]) => aid === agent._id)
      .map(([sid]) => sid);

    try {
      for (const sid of sids) {
        const res = await fetch(`http://localhost:5000/runtime/agents/${sid}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Failed to deactivate agent');
        }
        removeSession(sid);
      }
      setSessionMap((prev) => {
        const next = { ...prev };
        for (const sid of sids) delete next[sid];
        return next;
      });
    } catch (err) {
      alert(`Failed to deactivate agent: ${err.message}`);
    }
  };

  const handleRun = async (agent) => {
    const sessionId = crypto.randomUUID();
    try {
      const filesRes = await fetch(`/api/agents/${agent._id}/files`);
      const files = await filesRes.json();
      const res = await fetch('http://localhost:5000/runtime/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent, files, sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPopup({ message: data.message || data.error || 'Runtime server error', code: data.error, agent });
        return;
      }
      // Register in the context store
      createSession(agent._id, sessionId, agent.name);

      setSessionMap((prev) => ({ ...prev, [sessionId]: agent._id }));
      navigate(`/chat/${agent._id}/${sessionId}`, { state: { agent } });
    } catch (err) {
      setPopup({ message: `Failed to start agent: ${err.message}`, code: 'unknown', agent });
    }
  };

  const handleOpenChat = (agent, sessionId) => {
    navigate(`/chat/${agent._id}/${sessionId}`, { state: { agent } });
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      await abortAgent(sessionId);
      const res = await fetch(`http://localhost:5000/runtime/agents/${sessionId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to close session');
      }
      removeSession(sessionId);
      setSessionMap((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
    } catch (err) {
      alert(`Failed to close session: ${err.message}`);
    }
  };

  const dismissPopup = () => {
    setPopup(null);
    setApiKeyInput('');
    setSavingKey(false);
  };

  const handleSaveAndRun = async () => {
    if (!apiKeyInput.trim() || !popup?.agent) return;
    setSavingKey(true);
    try {
      const res = await fetch(`/api/agents/${popup.agent._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...popup.agent, apiKey: apiKeyInput.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save API key');
      }
      const updatedAgent = { ...popup.agent, apiKey: apiKeyInput.trim() };
      setAgents((prev) => prev.map((a) => (a._id === updatedAgent._id ? updatedAgent : a)));
      dismissPopup();
      await handleRun(updatedAgent);
    } catch (err) {
      setPopup((prev) => ({ ...prev, message: err.message }));
      setSavingKey(false);
    }
  };

  if (loading) return (
    <div className="agents-container">
      <div className="agents-content">
        <p className="agents-subtitle">Loading agents...</p>
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
            <p className="agent-error-popup__title">Cannot start agent</p>
            <p className="agent-error-popup__message">{popup.message}</p>
            {popup.code === 'api_key_required' && (
              <>
                <input
                  className="agent-error-popup__input"
                  type="password"
                  placeholder="sk-ant-..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  disabled={savingKey}
                />
                <button
                  className="agent-error-popup__save"
                  onClick={handleSaveAndRun}
                  disabled={!apiKeyInput.trim() || savingKey}
                >
                  {savingKey ? 'Saving...' : 'Save & Run'}
                </button>
              </>
            )}
            <button className="agent-error-popup__close" onClick={dismissPopup}>
              Dismiss
            </button>
          </div>
        </div>
      )}
      <div className="agents-content">
        <div className={`agents-header-row${showFlow ? ' agents-header-row--centered' : ''}`}>
          <div>
            <h1>Agents</h1>
            <p className="agents-subtitle">Manage your AI agents</p>
          </div>
          {!showFlow && (
            <button className="add-agent-btn" onClick={() => setShowFlow(true)}>
              + Add Agent
            </button>
          )}
        </div>

        {showFlow ? (
          <PiAgentFormContainer
            editingAgent={editingAgent}
            onCreated={handleCreated}
            onUpdated={handleUpdated}
            onCancel={resetFlow}
          />
        ) : (
          <div className="agents-grid">
            {agents.map((agent) => {
              const isRunning = Object.values(sessionMap).includes(agent._id);
              return (
              <div key={agent._id} className="agent-card">
                <div className="agent-header">
                  <h3 className="agent-name">{agent.icon} {agent.name}</h3>
                  {isRunning ? (
                    <button
                      className="agent-status active clickable"
                      onClick={() => handleDeactivate(agent)}
                    >
                      Active
                    </button>
                  ) : (
                    <span className={`agent-status ${agent.status?.toLowerCase()}`}>
                      Inactive
                    </span>
                  )}
                </div>
                <p className="agent-description">{agent.description}</p>
                <div className="agent-actions">
                  <button className="agent-action-btn view-btn" onClick={() => handleRun(agent)}>
                    Run
                  </button>
                  <OpenChatsButton agent={agent} onNavigate={handleOpenChat} onDeleteSession={handleDeleteSession} />
                  <button className="agent-action-btn edit-btn" onClick={() => openEdit(agent)}>
                    Edit
                  </button>
                  <button className="agent-action-btn delete-btn" onClick={() => handleDelete(agent)}>
                    Delete
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default AgentsPage;
