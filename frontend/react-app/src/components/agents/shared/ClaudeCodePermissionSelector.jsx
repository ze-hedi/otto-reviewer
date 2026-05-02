import React from 'react';

const PERMISSION_MODES = [
  {
    value: 'default',
    icon: '🛡️',
    title: 'Default',
    desc: 'Standard permission checks',
  },
  {
    value: 'auto',
    icon: '⚡',
    title: 'Auto',
    desc: 'Approve safe ops automatically',
  },
  {
    value: 'acceptEdits',
    icon: '✏️',
    title: 'Accept Edits',
    desc: 'Auto-approve file edits',
  },
  {
    value: 'bypassPermissions',
    icon: '🔓',
    title: 'Bypass',
    desc: 'Skip all permission checks',
  },
];

/**
 * Card-based permission mode selector for Claude Code agents.
 * Reuses session-mode-card styling from AgentForm.css.
 */
function ClaudeCodePermissionSelector({ value, onChange }) {
  return (
    <div className="form-section">
      <div className="form-section-title">Permission Mode</div>
      <div className="form-group">
        <div className="session-mode-cards permission-mode-cards">
          {PERMISSION_MODES.map((mode) => (
            <div
              key={mode.value}
              className={`session-mode-card${value === mode.value ? ' active' : ''}`}
              onClick={() => onChange(mode.value)}
              role="radio"
              aria-checked={value === mode.value}
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onChange(mode.value)}
            >
              <span className="session-mode-icon">{mode.icon}</span>
              <span className="session-mode-title">{mode.title}</span>
              <span className="session-mode-desc">{mode.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ClaudeCodePermissionSelector;
