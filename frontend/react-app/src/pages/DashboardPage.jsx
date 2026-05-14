import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './DashboardPage.css';

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
    <div className="dash-stat-row">
      <span className="dash-stat-label">{label}</span>
      <span className="dash-stat-value">{value ?? '--'}</span>
    </div>
  );
}

function ContextBar({ contextUsage }) {
  if (!contextUsage) return null;
  const pct = contextUsage.percent || 0;
  const color = pct > 80 ? '#f87171' : pct > 50 ? '#fbbf24' : '#22c55e';
  return (
    <div className="dash-context-bar-wrapper">
      <div className="dash-context-bar">
        <div className="dash-context-bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <span className="dash-context-bar-label">{formatPct(pct)}</span>
    </div>
  );
}

function StatsCard({ title, contextUsage, sessionStats, badge }) {
  const sess = sessionStats;
  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <span className="dash-card-title">{title}</span>
        {badge && <span className="dash-card-badge">{badge}</span>}
      </div>
      {!sess && !contextUsage && (
        <div className="dash-card-empty">No session data yet</div>
      )}
      {contextUsage && (
        <div className="dash-card-section">
          <div className="dash-card-section-title">Context Window</div>
          <ContextBar contextUsage={contextUsage} />
          <StatRow label="Tokens" value={contextUsage.tokens?.toLocaleString()} />
          <StatRow label="Window" value={contextUsage.contextWindow?.toLocaleString()} />
        </div>
      )}
      {sess && (
        <div className="dash-card-section">
          <div className="dash-card-section-title">Session</div>
          <StatRow label="Messages" value={`${sess.userMessages ?? 0} / ${sess.assistantMessages ?? 0}`} />
          <StatRow label="Tool calls" value={sess.toolCalls?.toLocaleString()} />
          <StatRow label="Input tokens" value={sess.tokens?.input?.toLocaleString()} />
          <StatRow label="Output tokens" value={sess.tokens?.output?.toLocaleString()} />
          <StatRow label="Cache read" value={sess.tokens?.cacheRead?.toLocaleString()} />
          <StatRow label="Cache write" value={sess.tokens?.cacheWrite?.toLocaleString()} />
          <StatRow label="Total tokens" value={sess.tokens?.total?.toLocaleString()} />
          <StatRow label="Cost" value={formatCost(sess.cost)} />
        </div>
      )}
    </div>
  );
}

function AgentNameCard({ name }) {
  return (
    <div className="dash-card dash-card-inactive">
      <div className="dash-card-header">
        <span className="dash-card-title">{name}</span>
        <span className="dash-card-badge stateless">stateless</span>
      </div>
    </div>
  );
}

function DashboardPage() {
  const { orchestratorId, sessionId } = useParams();
  const statsKey = sessionId || orchestratorId;
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [polling, setPolling] = useState(true);
  const intervalRef = useRef(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`http://localhost:5000/runtime/orchestrator/${statsKey}/stats`);
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
  }, [statsKey]);

  // Initial fetch
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Polling
  useEffect(() => {
    if (polling) {
      intervalRef.current = setInterval(fetchStats, POLL_INTERVAL);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [polling, fetchStats]);

  const totals = data?.totals;
  const statefulAgents = data?.subAgents?.filter((a) => a.stateful) || [];
  const statelessAgents = data?.subAgents?.filter((a) => !a.stateful) || [];

  return (
    <div className="dash-page">
      {/* Header */}
      <div className="dash-header">
        <button className="dash-back-btn" onClick={() => navigate(sessionId ? `/chat/${orchestratorId}/${sessionId}` : `/chat/${orchestratorId}`)}>
          ← Chat
        </button>
        <span className="dash-title">Dashboard</span>
        <div className="dash-header-actions">
          <button
            className={`dash-poll-btn${polling ? ' active' : ''}`}
            onClick={() => setPolling((p) => !p)}
            title={polling ? 'Disable auto-refresh' : 'Enable auto-refresh'}
          >
            {polling ? '● Live' : '○ Paused'}
          </button>
          <button className="dash-refresh-btn" onClick={fetchStats} disabled={loading} title="Refresh now">
            {loading ? '...' : '↻'}
          </button>
        </div>
      </div>

      <div className="dash-body">
        {error && (
          <div className="dash-error">
            <span className="dash-error-icon">!</span>
            {error}
          </div>
        )}

        {!error && !data && !loading && (
          <div className="dash-empty">No data available.</div>
        )}

        {data && (
          <>
            {/* Totals banner */}
            {totals && (
              <div className="dash-totals">
                <div className="dash-totals-title">Aggregated Totals</div>
                <div className="dash-totals-grid">
                  <div className="dash-total-item">
                    <span className="dash-total-value">{totals.totalTokens?.toLocaleString()}</span>
                    <span className="dash-total-label">Total Tokens</span>
                  </div>
                  <div className="dash-total-item">
                    <span className="dash-total-value">{totals.inputTokens?.toLocaleString()}</span>
                    <span className="dash-total-label">Input</span>
                  </div>
                  <div className="dash-total-item">
                    <span className="dash-total-value">{totals.outputTokens?.toLocaleString()}</span>
                    <span className="dash-total-label">Output</span>
                  </div>
                  <div className="dash-total-item">
                    <span className="dash-total-value">{totals.totalToolCalls?.toLocaleString()}</span>
                    <span className="dash-total-label">Tool Calls</span>
                  </div>
                  <div className="dash-total-item">
                    <span className="dash-total-value">{formatCost(totals.totalCost)}</span>
                    <span className="dash-total-label">Total Cost</span>
                  </div>
                </div>
              </div>
            )}

            {/* Orchestrator card */}
            <div className="dash-section">
              <div className="dash-section-title">Orchestrator</div>
              <div className="dash-cards-grid">
                <StatsCard
                  title={data.orchestrator.name}
                  contextUsage={data.orchestrator.contextUsage}
                  sessionStats={data.orchestrator.sessionStats}
                  badge="orchestrator"
                />
              </div>
            </div>

            {/* Stateful sub-agents */}
            {statefulAgents.length > 0 && (
              <div className="dash-section">
                <div className="dash-section-title">Stateful Sub-agents</div>
                <div className="dash-cards-grid">
                  {statefulAgents.map((agent) => (
                    <StatsCard
                      key={agent.id}
                      title={agent.name}
                      contextUsage={agent.contextUsage}
                      sessionStats={agent.sessionStats}
                      badge="stateful"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Stateless sub-agents */}
            {statelessAgents.length > 0 && (
              <div className="dash-section">
                <div className="dash-section-title">Stateless Sub-agents</div>
                <div className="dash-cards-grid">
                  {statelessAgents.map((agent) => (
                    <AgentNameCard key={agent.id} name={agent.name} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default DashboardPage;
