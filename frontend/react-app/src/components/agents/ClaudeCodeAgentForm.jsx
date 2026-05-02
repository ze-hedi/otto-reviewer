import React, { useState } from 'react';
import IdentitySection from './shared/IdentitySection';
import ClaudeCodePermissionSelector from './shared/ClaudeCodePermissionSelector';
import ClaudeCodeToolsAllowlist from './shared/ClaudeCodeToolsAllowlist';
import McpServersEditor from './shared/McpServersEditor';
import '../AgentForm.css';

const CLAUDE_MODELS = [
  { value: 'claude-haiku-4-5',   label: 'Claude Haiku 4.5' },
  { value: 'claude-sonnet-4-5',  label: 'Claude Sonnet 4.5' },
  { value: 'claude-sonnet-4-6',  label: 'Claude Sonnet 4.6' },
  { value: 'claude-opus-4-6',    label: 'Claude Opus 4.6' },
];

/**
 * Form for creating / editing a Claude Code agent.
 * Self-contained: owns all state and calls onCreated / onUpdated on success.
 */
function ClaudeCodeAgentForm({ editingAgent, onCreated, onUpdated, onCancel }) {
  const [name, setName]               = useState(editingAgent?.name            || '');
  const [description, setDescription] = useState(editingAgent?.description     || '');
  const [icon, setIcon]               = useState(editingAgent?.icon            || '🖥️');
  const [systemPrompt, setSystemPrompt] = useState(editingAgent?.systemPrompt  || '');
  const [model, setModel]             = useState(editingAgent?.model           || 'claude-sonnet-4-6');
  const [maxTurns, setMaxTurns]       = useState(
    editingAgent?.maxTurns != null ? String(editingAgent.maxTurns) : ''
  );
  const [permissionMode, setPermissionMode] = useState(editingAgent?.permissionMode || 'default');
  const [allowedTools, setAllowedTools]     = useState(editingAgent?.allowedTools   || []);
  const [mcpServers, setMcpServers]         = useState(editingAgent?.mcpServers     || {});

  const apiCall = async (url, options) => {
    const res  = await fetch(url, options);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch {
      throw new Error(`Unexpected response (${res.status}): ${text.slice(0, 200)}`);
    }
    if (!res.ok) throw new Error(data.error || 'Unknown error');
    return data;
  };

  const buildPayload = () => ({
    name,
    description,
    icon,
    systemPrompt: systemPrompt.trim() || '',
    model,
    maxTurns: maxTurns !== '' ? Number(maxTurns) : null,
    permissionMode,
    allowedTools,
    mcpServers,
  });

  const handleSubmit = async () => {
    if (!name.trim() || !description.trim()) return;
    try {
      if (editingAgent) {
        const agent = await apiCall(`/api/claude-code-agents/${editingAgent._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload()),
        });
        onUpdated({ ...agent, agentType: 'claude-code' });
      } else {
        const agent = await apiCall('/api/claude-code-agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload()),
        });
        onCreated({ ...agent, agentType: 'claude-code' });
      }
    } catch (err) {
      alert(`Failed to save agent: ${err.message}`);
    }
  };

  const isFormValid = name.trim() && description.trim();

  return (
    <div className="create-agent-form">
      <h2 className="create-agent-title">
        {editingAgent ? 'Edit Claude Code Agent' : 'New Claude Code Agent'}
      </h2>

      <IdentitySection
        name={name}               setName={setName}
        description={description} setDescription={setDescription}
        icon={icon}               setIcon={setIcon}
      />

      {/* ── Model ─────────────────────────────────────────── */}
      <div className="form-section">
        <div className="form-section-title">Model</div>
        <div className="form-group">
          <label className="form-label" htmlFor="cc-model">Claude Model</label>
          <select
            id="cc-model"
            className="form-input form-select"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            {CLAUDE_MODELS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="cc-max-turns">Max Turns</label>
          <p className="form-hint">Cap the agentic loop iteration count. Leave empty for no limit.</p>
          <input
            id="cc-max-turns"
            className="form-input"
            type="number"
            min={1}
            placeholder="e.g. 10"
            value={maxTurns}
            onChange={(e) => setMaxTurns(e.target.value)}
          />
        </div>
      </div>

      {/* ── System Prompt ─────────────────────────────────── */}
      <div className="form-section">
        <div className="form-section-title">System Prompt</div>
        <div className="form-group">
          <p className="form-hint">
            Replaces Claude Code's default system prompt entirely. Leave empty to use the default.
          </p>
          <textarea
            className="form-textarea"
            placeholder="You are an expert software engineer..."
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={5}
          />
        </div>
      </div>

      <ClaudeCodePermissionSelector value={permissionMode} onChange={setPermissionMode} />

      <ClaudeCodeToolsAllowlist tools={allowedTools} onChange={setAllowedTools} />

      <McpServersEditor servers={mcpServers} onChange={setMcpServers} />

      {/* ── Actions ───────────────────────────────────────── */}
      <div className="form-actions">
        <button className="agent-action-btn view-btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="agent-action-btn edit-btn create-agent-submit-btn"
          onClick={handleSubmit}
          disabled={!isFormValid}
        >
          {editingAgent ? 'Update Agent' : 'Create Agent'}
        </button>
      </div>
    </div>
  );
}

export default ClaudeCodeAgentForm;
