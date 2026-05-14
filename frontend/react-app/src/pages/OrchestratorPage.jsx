import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgentSessions, createSession, removeSession, abortAgent } from '../AgentChatContext';
import './AgentsPage.css';

// Mirrors OpenChatsButton from AgentsPage — shows active sessions per orchestrator
function OpenChatsButton({ orch, onNavigate, onDeleteSession }) {
  const sessions = useAgentSessions(orch._id);
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
            <p className="chats-popup__title">Active Chats — {orch.name}</p>
            <div className="chats-popup__list">
              {sessions.map((s, idx) => (
                <div key={s.sessionId} className="chats-popup__item-row">
                  <button
                    className="chats-popup__item"
                    onClick={() => {
                      setShowPopup(false);
                      onNavigate(orch, s.sessionId);
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

function OrchestratorPage() {
  const navigate = useNavigate();
  const [orchestrators, setOrchestrators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [popup, setPopup] = useState(null);
  const [sessionMap, setSessionMap] = useState({}); // sessionId → orchestratorId

  useEffect(() => {
    Promise.all([
      fetch('/api/orchestrators').then((r) => r.json()),
      fetch('http://localhost:5000/runtime/status').then((r) => r.json()).catch(() => ({ sessionAgentMap: {} })),
    ])
      .then(([data, runtimeStatus]) => {
        setOrchestrators(data);
        setSessionMap(runtimeStatus.sessionAgentMap ?? {});
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleRun = async (orch) => {
    try {
      const sessionId = crypto.randomUUID();
      const res = await fetch('http://localhost:5000/runtime/orchestrator/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orchestratorId: orch._id,
          sessionId,
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
      createSession(orch._id, sessionId, orch.name);
      setSessionMap((prev) => ({ ...prev, [sessionId]: orch._id }));
      navigate(`/chat/${orch._id}/${sessionId}`, {
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

  const handleOpenChat = (orch, sessionId) => {
    navigate(`/chat/${orch._id}/${sessionId}`, {
      state: {
        agent: {
          _id: orch._id,
          name: orch.name,
          description: orch.description,
          type: 'orchestrator',
        },
      },
    });
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

  const handleDeactivate = async (orch) => {
    const sids = Object.entries(sessionMap)
      .filter(([, orchId]) => orchId === orch._id)
      .map(([sid]) => sid);

    try {
      for (const sid of sids) {
        const res = await fetch(`http://localhost:5000/runtime/agents/${sid}`, { method: 'DELETE' });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Failed to deactivate orchestrator');
        }
        removeSession(sid);
      }
      setSessionMap((prev) => {
        const next = { ...prev };
        for (const sid of sids) delete next[sid];
        return next;
      });
    } catch (err) {
      alert(`Failed to deactivate orchestrator: ${err.message}`);
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
          {orchestrators.map((orch) => {
            const isRunning = Object.values(sessionMap).includes(orch._id);
            return (
            <div key={orch._id} className="agent-card">
              <div className="agent-header">
                <h3 className="agent-name">{orch.name}</h3>
                {isRunning ? (
                  <button
                    className="agent-status active clickable"
                    onClick={() => handleDeactivate(orch)}
                  >
                    Active
                  </button>
                ) : (
                  <span className="agent-status">
                    {orch.subAgents?.length || 0} sub-agent{(orch.subAgents?.length || 0) !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="agent-description">{orch.description}</p>
              <div className="agent-actions">
                <button className="agent-action-btn view-btn" onClick={() => handleRun(orch)}>
                  Run
                </button>
                <OpenChatsButton orch={orch} onNavigate={handleOpenChat} onDeleteSession={handleDeleteSession} />
                <button className="agent-action-btn delete-btn" onClick={() => handleDelete(orch)}>
                  Delete
                </button>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default OrchestratorPage;
