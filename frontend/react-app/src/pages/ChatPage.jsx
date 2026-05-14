import React, { useEffect, useRef, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import SessionStatsPanel from '../components/SessionStatsPanel';
import AgentConfigPanel from '../components/AgentConfigPanel';
import SubAgentsPanel from '../components/SubAgentsPanel';
import SubAgentSessionView from '../components/SubAgentSessionView';
import ChatArea from '../components/ChatArea';
import './ChatPage.css';

function ChatPage() {
  const { agentId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();

  const [agent, setAgent] = useState(state?.agent || null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showSubAgents, setShowSubAgents] = useState(false);
  const [subAgentView, setSubAgentView] = useState(null);

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const agentLoggedRef = useRef(false);

  // Load agent info from DB if not passed via navigation state
  useEffect(() => {
    if (agent || !agentId) return;
    fetch(`/api/agents`)
      .then((r) => r.json())
      .then((all) => {
        const found = all.find((a) => a._id === agentId);
        if (found) {
          setAgent(found);
        } else {
          return fetch('/api/orchestrators')
            .then((r) => r.json())
            .then((orchs) => {
              const orch = orchs.find((o) => o._id === agentId);
              if (orch) setAgent({ ...orch, type: 'orchestrator' });
            });
        }
      })
      .catch(() => {});
  }, [agentId, agent]);

  // Log agent info when agent is loaded (once only)
  useEffect(() => {
    if (!agent || agentLoggedRef.current) return;
    agentLoggedRef.current = true;
  }, [agent]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const appendDelta = (text) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === 'assistant' && last.streaming) {
        return [...prev.slice(0, -1), { ...last, text: last.text + text }];
      }
      // First text delta after thinking — close any streaming thinking bubble.
      const closed = prev.map((m) =>
        m.role === 'thinking' && m.streaming ? { ...m, streaming: false } : m
      );
      return [...closed, { role: 'assistant', text, streaming: true, id: Date.now() }];
    });
  };

  const appendThinkingDelta = (text) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === 'thinking' && last.streaming) {
        return [...prev.slice(0, -1), { ...last, text: last.text + text }];
      }
      const id = Date.now() + Math.random();
      return [...prev, { role: 'thinking', text, streaming: true, id }];
    });
  };

  const finalizeAssistant = () => {
    setMessages((prev) =>
      prev.map((m) =>
        (m.role === 'assistant' || m.role === 'thinking') && m.streaming
          ? { ...m, streaming: false }
          : m
      )
    );
  };

  const appendToolStart = (event) => {
    setMessages((prev) => [
      ...prev,
      { role: 'tool', name: event.name, args: event.args, result: null, isError: false, done: false, id: Date.now() + Math.random() },
    ]);
  };

  const appendToolEnd = (event) => {
    setMessages((prev) => {
      const idx = prev.findLastIndex((m) => m.role === 'tool' && !m.done);
      if (idx === -1) return prev;
      const updated = [...prev];
      updated[idx] = { ...updated[idx], result: event.result, isError: event.isError, done: true };
      return updated;
    });
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    setInput('');
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', text, id: Date.now() }]);
    setStreaming(true);

    try {
      const res = await fetch(`http://localhost:5000/runtime/chat/${agentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const lines = buf.split('\n');
        buf = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          let evt;
          try { evt = JSON.parse(raw); } catch { continue; }

          if (evt.type === 'delta') appendDelta(evt.text);
          else if (evt.type === 'thinking') appendThinkingDelta(evt.text);
          else if (evt.type === 'tool_start') appendToolStart(evt);
          else if (evt.type === 'tool_end') appendToolEnd(evt);
          else if (evt.type === 'done') finalizeAssistant();
          else if (evt.type === 'error') throw new Error(evt.message);
        }
      }
      // Ensure cursor is removed even if the stream closed without a trailing
      // newline (leaving the 'done' event unprocessed in buf) or without
      // sending a 'done' event at all.
      finalizeAssistant();
    } catch (err) {
      setError(err.message);
      finalizeAssistant();
    } finally {
      setStreaming(false);
      textareaRef.current?.focus();
    }
  };

  const abortAgent = async () => {
    try {
      await fetch(`http://localhost:5000/runtime/agents/${agentId}/abort`, { method: 'POST' });
    } catch {
      // stream will close on its own or the error surface via SSE
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  return (
    <div className="chat-page">
      {/* Header */}
      <div className="chat-header">
        <button className="chat-back-btn" onClick={() => navigate('/agents')}>
          ← Agents
        </button>
        <div className="chat-agent-info">
          <span className="chat-agent-name">{agent?.name ?? 'Agent'}</span>
          {agent?.model && (
            <span className="chat-agent-model">{agent.model}</span>
          )}
        </div>
        <div className="chat-status-dot" title="Active" />
        <button
          className={`chat-stats-btn${showStats ? ' active' : ''}`}
          onClick={() => { const next = !showStats; setShowStats(next); if (next) { setShowConfig(false); setShowSubAgents(false); } }}
          title="Toggle session stats"
        >
          ◈ Stats
        </button>
        <button
          className={`chat-stats-btn${showConfig ? ' active' : ''}`}
          onClick={() => { const next = !showConfig; setShowConfig(next); if (next) { setShowStats(false); setShowSubAgents(false); } }}
          title="Toggle agent config"
        >
          ⬡ Agent
        </button>
        {agent?.type === 'orchestrator' && (
          <button
            className={`chat-stats-btn${showSubAgents ? ' active' : ''}`}
            onClick={() => { const next = !showSubAgents; setShowSubAgents(next); if (next) { setShowStats(false); setShowConfig(false); } }}
            title="Toggle sub-agents"
          >
            ⊞ Sub-agents
          </button>
        )}
        {agent?.type === 'orchestrator' && (
          <button
            className="chat-stats-btn"
            onClick={() => navigate(`/dashboard/${agentId}`)}
            title="Open dashboard"
          >
            ▦ Dashboard
          </button>
        )}
      </div>

      <div className="chat-body">
        {subAgentView && (
          <SubAgentSessionView
            subAgentView={subAgentView}
            onBack={() => setSubAgentView(null)}
          />
        )}
        {!subAgentView && (
          <ChatArea
            messages={messages}
            streaming={streaming}
            error={error}
            input={input}
            onInputChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onSend={sendMessage}
            onAbort={abortAgent}
            bottomRef={bottomRef}
            textareaRef={textareaRef}
          />
        )}

        {showStats && (
          <SessionStatsPanel
            agentId={agentId}
            onClose={() => setShowStats(false)}
          />
        )}
        {showConfig && (
          <AgentConfigPanel
            agentId={agentId}
            onClose={() => setShowConfig(false)}
          />
        )}
        {showSubAgents && (
          <SubAgentsPanel
            agentId={agentId}
            orchestratorId={agentId}
            onClose={() => setShowSubAgents(false)}
            onViewSubAgent={(view) => setSubAgentView(view)}
          />
        )}
      </div>
    </div>
  );
}

export default ChatPage;
