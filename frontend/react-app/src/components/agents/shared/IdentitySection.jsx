import React from 'react';

const AGENT_ICONS = [
  { value: '🤖', label: 'Robot' },
  { value: '🧠', label: 'Brain' },
  { value: '🔍', label: 'Researcher' },
  { value: '⚡', label: 'Fast' },
  { value: '🛠️', label: 'Builder' },
  { value: '🖥️', label: 'Terminal' },
];

/**
 * Identity section for the Pi agent form: name, icon picker, description.
 * Relies on AgentForm.css for all class styles.
 */
function IdentitySection({ name, setName, description, setDescription, icon, setIcon }) {
  return (
    <div className="form-section">
      <div className="form-section-title">Identity</div>
      <div className="form-group">
        <label className="form-label" htmlFor="agent-name">Name</label>
        <input
          id="agent-name"
          className="form-input"
          type="text"
          placeholder="e.g. my-coding-agent"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label className="form-label">Icon</label>
        <div className="agent-icon-picker">
          {AGENT_ICONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`agent-icon-btn${icon === opt.value ? ' active' : ''}`}
              onClick={() => setIcon(opt.value)}
              title={opt.label}
            >
              <span className="agent-icon-emoji">{opt.value}</span>
              <span className="agent-icon-label">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="agent-description">Description</label>
        <textarea
          id="agent-description"
          className="form-textarea"
          placeholder="Describe what this agent does..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}

export default IdentitySection;
