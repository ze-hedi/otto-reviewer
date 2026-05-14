import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAgentChat } from '../AgentChatContext';
import './AgentDashboardPage.css';

const POLL_INTERVAL = 5000;

function formatCost(cost) {
  if (cost == null) return '--';
  return `$${Number(cost).toFixed(6)}`;
}

function formatPct(pct) {
  if (pct == null) return '--';
  return `${Number(pct).toFixed(1)}%`;
}

function StatRow({ label, value }) {
  return (
    <div className="adash-stat-row">
      <span className="adash-stat-label">{label}</span>
      <span className="adash-stat-value">{value ?? '--'}</span>
    </div>
  );
}

function ContextBar({ contextUsage }) {
  if (!contextUsage) return null;
  const pct = contextUsage.percent || 0;
  const color = pct > 80 ? '#f87171' : pct > 50 ? '#fbbf24' : '#22c55e';
  return (
    <div className="adash-context-bar-wrapper">
      <div className="adash-context-bar">
        <div className="adash-context-bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <span className="adash-context-bar-label">{formatPct(pct)}</span>
    </div>
  );
}

function AgentDashboardPage() {
  const { agentId, sessionId } = useParams();
  const navigate = useNavigate();

  const { toolCallCounts, hydrateFromServer } = useAgentChat(sessionId);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [polling, setPolling] = useState(true);
  const [allTools, setAllTools] = useState([]);
  const intervalRef = useRef(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`http://localhost:5000/runtime/agents/${sessionId}/stats`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || `Server error ${res.status}`);
        setData(null);
      } else {
        setData(json);
        setError(null);
      }
    } catch {
      setError('Could not reach the runtime server.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchStats();
    hydrateFromServer();
    // Fetch tool list
    fetch(`http://localhost:5000/runtime/agents/${sessionId}/config`)
      .then((r) => r.ok ? r.json() : null)
      .then((json) => { if (json?.tools) setAllTools(json.tools); })
      .catch(() => {});
  }, [fetchStats, sessionId, hydrateFromServer]);

  useEffect(() => {
    if (polling) {
      intervalRef.current = setInterval(fetchStats, POLL_INTERVAL);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [polling, fetchStats]);

  const ctx = data?.contextUsage;
  const sess = data?.sessionStats;

  return (
    <div className="adash-page">
      {/* Header */}
      <div className="adash-header">
        <button className="adash-back-btn" onClick={() => navigate(`/chat/${agentId}/${sessionId}`)}>
          ← Chat
        </button>
        <span className="adash-title">Session Dashboard</span>
        <div className="adash-header-actions">
          <button
            className={`adash-poll-btn${polling ? ' active' : ''}`}
            onClick={() => setPolling((p) => !p)}
            title={polling ? 'Disable auto-refresh' : 'Enable auto-refresh'}
          >
            {polling ? '● Live' : '○ Paused'}
          </button>
          <button className="adash-refresh-btn" onClick={fetchStats} disabled={loading} title="Refresh now">
            {loading ? '...' : '↻'}
          </button>
        </div>
      </div>

      <div className="adash-body">
        {error && (
          <div className="adash-error">
            <span className="adash-error-icon">!</span>
            {error}
          </div>
        )}

        {!error && !data && !loading && (
          <div className="adash-empty">No data available. Send a message to the agent first.</div>
        )}

        {data && (
          <>
            {/* Totals banner */}
            {sess && (
              <div className="adash-totals">
                <div className="adash-totals-title">Session Overview</div>
                <div className="adash-totals-grid">
                  <div className="adash-total-item">
                    <span className="adash-total-value">{sess.tokens?.total?.toLocaleString() ?? '--'}</span>
                    <span className="adash-total-label">Total Tokens</span>
                  </div>
                  <div className="adash-total-item">
                    <span className="adash-total-value">{sess.tokens?.input?.toLocaleString() ?? '--'}</span>
                    <span className="adash-total-label">Input</span>
                  </div>
                  <div className="adash-total-item">
                    <span className="adash-total-value">{sess.tokens?.output?.toLocaleString() ?? '--'}</span>
                    <span className="adash-total-label">Output</span>
                  </div>
                  <div className="adash-total-item">
                    <span className="adash-total-value">{sess.tokens?.cacheRead?.toLocaleString() ?? '--'}</span>
                    <span className="adash-total-label">Cache Read</span>
                  </div>
                  <div className="adash-total-item">
                    <span className="adash-total-value">{sess.tokens?.cacheWrite?.toLocaleString() ?? '--'}</span>
                    <span className="adash-total-label">Cache Write</span>
                  </div>
                  <div className="adash-total-item">
                    <span className="adash-total-value">{sess.toolCalls?.toLocaleString() ?? '--'}</span>
                    <span className="adash-total-label">Tool Calls</span>
                  </div>
                  <div className="adash-total-item">
                    <span className="adash-total-value">{formatCost(sess.cost)}</span>
                    <span className="adash-total-label">Total Cost</span>
                  </div>
                </div>
              </div>
            )}

            {/* Context window */}
            {ctx && (
              <div className="adash-section">
                <div className="adash-section-title">Context Window</div>
                <div className="adash-card">
                  <ContextBar contextUsage={ctx} />
                  <StatRow label="Tokens used" value={ctx.tokens?.toLocaleString()} />
                  <StatRow label="Context window size" value={ctx.contextWindow?.toLocaleString()} />
                  <StatRow label="Context used" value={formatPct(ctx.percent)} />
                </div>
              </div>
            )}

            {/* Session details */}
            {sess && (
              <div className="adash-section">
                <div className="adash-section-title">Session Details</div>
                <div className="adash-card">
                  <StatRow label="User messages" value={sess.userMessages?.toLocaleString()} />
                  <StatRow label="Assistant messages" value={sess.assistantMessages?.toLocaleString()} />
                  <StatRow label="Tool calls" value={sess.toolCalls?.toLocaleString()} />
                  <StatRow label="Input tokens" value={sess.tokens?.input?.toLocaleString()} />
                  <StatRow label="Output tokens" value={sess.tokens?.output?.toLocaleString()} />
                  <StatRow label="Cache read tokens" value={sess.tokens?.cacheRead?.toLocaleString()} />
                  <StatRow label="Cache write tokens" value={sess.tokens?.cacheWrite?.toLocaleString()} />
                  <StatRow label="Total tokens" value={sess.tokens?.total?.toLocaleString()} />
                  <StatRow label="Estimated cost" value={formatCost(sess.cost)} />
                </div>
              </div>
            )}
            {/* Tool usage breakdown */}
            {allTools.length > 0 && (
              <div className="adash-section">
                <div className="adash-section-title">Tool Usage</div>
                <div className="adash-card">
                  {[...allTools]
                    .sort((a, b) => (toolCallCounts[b] || 0) - (toolCallCounts[a] || 0))
                    .map((toolName) => {
                      const count = toolCallCounts[toolName] || 0;
                      return (
                        <div key={toolName} className={`adash-tool-row${count === 0 ? ' inactive' : ''}`}>
                          <span className="adash-tool-name">{toolName}</span>
                          <span className="adash-tool-count">{count}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default AgentDashboardPage;
