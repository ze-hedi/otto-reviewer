import React, { useState } from 'react';

const EMPTY_DRAFT = { name: '', command: '', args: '', env: '' };

/**
 * Add / remove MCP server configurations.
 * Each server: name → { command, args: string[], env: Record<string,string> }
 *
 * Args are entered as a space-separated string (e.g. "-y @mcp/server /path").
 * Env vars as comma-separated KEY=value pairs (e.g. "TOKEN=abc,DEBUG=true").
 */
function McpServersEditor({ servers, onChange }) {
  const serverList = Object.entries(servers || {});
  const [adding, setAdding] = useState(false);
  const [draft, setDraft]   = useState(EMPTY_DRAFT);

  const commitDraft = () => {
    if (!draft.name.trim() || !draft.command.trim()) return;

    const args = draft.args.trim()
      ? draft.args.trim().split(/\s+/)
      : [];

    const env = draft.env.trim()
      ? Object.fromEntries(
          draft.env
            .split(',')
            .map((s) => s.trim().split('=').map((v) => v.trim()))
            .filter(([k]) => k)
        )
      : {};

    onChange({ ...servers, [draft.name.trim()]: { command: draft.command.trim(), args, env } });
    setDraft(EMPTY_DRAFT);
    setAdding(false);
  };

  const removeServer = (name) => {
    const updated = { ...servers };
    delete updated[name];
    onChange(updated);
  };

  return (
    <div className="form-section">
      <div className="form-section-title">MCP Servers</div>
      <div className="form-group">
        <p className="form-hint">
          Extend Claude Code with Model Context Protocol servers.
        </p>

        {serverList.length > 0 && (
          <div className="mcp-server-list">
            {serverList.map(([name, cfg]) => (
              <div key={name} className="mcp-server-item">
                <div className="mcp-server-header">
                  <span className="mcp-server-name">{name}</span>
                  <span className="mcp-server-command">{cfg.command}</span>
                  <button
                    type="button"
                    className="skill-remove-btn"
                    onClick={() => removeServer(name)}
                  >
                    ✕
                  </button>
                </div>
                {cfg.args?.length > 0 && (
                  <div className="mcp-server-meta">args: {cfg.args.join(' ')}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {adding ? (
          <div className="mcp-server-draft">
            <input
              className="form-input"
              placeholder="Server name (e.g. filesystem)"
              value={draft.name}
              onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
            />
            <input
              className="form-input"
              placeholder="Command (e.g. npx)"
              value={draft.command}
              onChange={(e) => setDraft((p) => ({ ...p, command: e.target.value }))}
            />
            <input
              className="form-input"
              placeholder="Args — space-separated (e.g. -y @modelcontextprotocol/server-filesystem /path)"
              value={draft.args}
              onChange={(e) => setDraft((p) => ({ ...p, args: e.target.value }))}
            />
            <input
              className="form-input"
              placeholder="Env vars — comma-separated (e.g. TOKEN=abc,DEBUG=true)"
              value={draft.env}
              onChange={(e) => setDraft((p) => ({ ...p, env: e.target.value }))}
            />
            <div className="mcp-draft-actions">
              <button
                type="button"
                className="agent-action-btn view-btn"
                onClick={() => { setAdding(false); setDraft(EMPTY_DRAFT); }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="agent-action-btn edit-btn"
                onClick={commitDraft}
                disabled={!draft.name.trim() || !draft.command.trim()}
              >
                Add Server
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="skills-upload-btn"
            onClick={() => setAdding(true)}
          >
            + Add MCP Server
          </button>
        )}
      </div>
    </div>
  );
}

export default McpServersEditor;
