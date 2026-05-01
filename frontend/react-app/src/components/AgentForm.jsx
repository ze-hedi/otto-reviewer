import React, { useRef } from 'react';
import './AgentForm.css';

const MODELS = [
  {
    group: 'Anthropic',
    options: [
      { value: 'anthropic/claude-haiku-4-5', label: 'Claude Haiku 4.5' },
      { value: 'anthropic/claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
      { value: 'anthropic/claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
      { value: 'anthropic/claude-opus-4-6', label: 'Claude Opus 4.6' },
    ],
  },
  {
    group: 'OpenAI',
    options: [
      { value: 'openai/gpt-4o', label: 'GPT-4o' },
      { value: 'openai/gpt-4o-mini', label: 'GPT-4o mini' },
    ],
  },
  {
    group: 'Ollama',
    options: [
      { value: 'ollama/llama3', label: 'Llama 3' },
      { value: 'ollama/mistral', label: 'Mistral' },
    ],
  },
];

const THINKING_LEVELS = ['off', 'low', 'medium', 'high', 'xhigh'];

const SESSION_MODES = [
  { value: 'memory', icon: '⚡', title: 'Memory', desc: 'Volatile — resets each run' },
  { value: 'disk', icon: '💾', title: 'Disk', desc: 'Persist sessions to disk' },
  { value: 'continue', icon: '↩', title: 'Continue', desc: 'Resume the most recent session' },
];

function AgentForm({
  editingAgent,
  formName,
  setFormName,
  formDescription,
  setFormDescription,
  model,
  setModel,
  thinkingLevel,
  setThinkingLevel,
  sessionMode,
  setSessionMode,
  workingDir,
  setWorkingDir,
  systemPromptMode,
  setSystemPromptMode,
  systemPromptText,
  setSystemPromptText,
  systemPromptFile,
  setSystemPromptFile,
  skills,
  setSkills,
  skillsDragOver,
  setSkillsDragOver,
  apiKey,
  setApiKey,
  showApiKey,
  setShowApiKey,
  handleSystemPromptLoad,
  handleSkillsLoad,
  handleSkillsDrop,
  onCancel,
  onSubmit,
  isFormValid,
}) {
  const skillsInputRef = useRef(null);

  return (
    <div className="create-agent-form">
      <h2 className="create-agent-title">{editingAgent ? 'Edit Agent' : 'New Agent'}</h2>

      {/* ── Identity ───────────────────────────────────────── */}
      <div className="form-section">
        <div className="form-section-title">Identity</div>
        <div className="form-group">
          <label className="form-label" htmlFor="agent-name">Name</label>
          <input
            id="agent-name"
            className="form-input"
            type="text"
            placeholder="e.g. my-coding-agent"
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
            rows={3}
          />
        </div>
      </div>

      {/* ── Model ─────────────────────────────────────────── */}
      <div className="form-section">
        <div className="form-section-title">Model</div>
        <div className="form-group">
          <label className="form-label" htmlFor="agent-model">Provider / Model</label>
          <select
            id="agent-model"
            className="form-input form-select"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            <option value="" disabled>Select a model...</option>
            {MODELS.map((group) => (
              <optgroup key={group.group} label={group.group}>
                {group.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Thinking Level</label>
          <div className="thinking-level-group">
            {THINKING_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                className={`thinking-level-btn${thinkingLevel === level ? ' active' : ''}`}
                onClick={() => setThinkingLevel(level)}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Session ───────────────────────────────────────── */}
      <div className="form-section">
        <div className="form-section-title">Session</div>
        <div className="form-group">
          <label className="form-label">Session Mode</label>
          <div className="session-mode-cards">
            {SESSION_MODES.map((mode) => (
              <div
                key={mode.value}
                className={`session-mode-card${sessionMode === mode.value ? ' active' : ''}`}
                onClick={() => setSessionMode(mode.value)}
                role="radio"
                aria-checked={sessionMode === mode.value}
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setSessionMode(mode.value)}
              >
                <span className="session-mode-icon">{mode.icon}</span>
                <span className="session-mode-title">{mode.title}</span>
                <span className="session-mode-desc">{mode.desc}</span>
              </div>
            ))}
          </div>
        </div>
        {(sessionMode === 'disk' || sessionMode === 'continue') && (
          <div className="form-group form-group--slide-in">
            <label className="form-label" htmlFor="working-dir">Working Directory</label>
            <input
              id="working-dir"
              className="form-input"
              type="text"
              placeholder="/path/to/working/directory"
              value={workingDir}
              onChange={(e) => setWorkingDir(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* ── Prompt & Skills ───────────────────────────────── */}
      <div className="form-section">
        <div className="form-section-title">Prompt &amp; Skills</div>
        <div className="form-group">
          <div className="form-label-row">
            <label className="form-label">System Prompt Suffix</label>
            <div className="tab-toggle">
              <button
                type="button"
                className={`tab-btn${systemPromptMode === 'write' ? ' active' : ''}`}
                onClick={() => setSystemPromptMode('write')}
              >
                Write
              </button>
              <button
                type="button"
                className={`tab-btn${systemPromptMode === 'upload' ? ' active' : ''}`}
                onClick={() => setSystemPromptMode('upload')}
              >
                Upload
              </button>
            </div>
          </div>
          {systemPromptMode === 'write' ? (
            <textarea
              className="form-textarea"
              placeholder="Additional instructions appended to Pi's default system prompt..."
              value={systemPromptText}
              onChange={(e) => setSystemPromptText(e.target.value)}
              rows={4}
            />
          ) : systemPromptFile ? (
            <div className="skills-list">
              <div className="skill-item">
                <div className="skill-item-header">
                  <span className="skill-icon">⌗</span>
                  <span className="skill-name">{systemPromptFile.name}</span>
                  <button className="skill-remove-btn" onClick={() => setSystemPromptFile(null)}>✕</button>
                </div>
              </div>
            </div>
          ) : (
            <label className="skills-upload-btn">
              + Load .md file
              <input
                type="file"
                accept=".md"
                style={{ display: 'none' }}
                onChange={handleSystemPromptLoad}
              />
            </label>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">Skills</label>
          <div
            className={`skills-drop-zone${skillsDragOver ? ' drag-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setSkillsDragOver(true); }}
            onDragLeave={() => setSkillsDragOver(false)}
            onDrop={handleSkillsDrop}
            onClick={() => skillsInputRef.current?.click()}
          >
            <span className="skills-drop-icon">⌗</span>
            <span className="skills-drop-text">
              Drop .md files here or <span className="skills-drop-link">browse</span>
            </span>
            <input
              ref={skillsInputRef}
              type="file"
              accept=".md"
              multiple
              style={{ display: 'none' }}
              onChange={handleSkillsLoad}
            />
          </div>
          {skills.length > 0 && (
            <div className="skills-list">
              {skills.map((skill, i) => (
                <div key={i} className="skill-item">
                  <div className="skill-item-header">
                    <span className="skill-icon">⌗</span>
                    <span className="skill-name">{skill.name}</span>
                    <button
                      className="skill-remove-btn"
                      onClick={() => setSkills((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Advanced ──────────────────────────────────────── */}
      <details className="form-advanced">
        <summary className="form-advanced-summary">
          <span>Advanced</span>
          <span className="form-advanced-arrow">›</span>
        </summary>
        <div className="form-advanced-body">
          <div className="form-group">
            <label className="form-label" htmlFor="api-key">API Key Override</label>
            <p className="form-hint">Leave blank to use the environment variable.</p>
            <div className="password-field">
              <input
                id="api-key"
                className="form-input"
                type={showApiKey ? 'text' : 'password'}
                placeholder="sk-ant-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowApiKey((v) => !v)}
              >
                {showApiKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
        </div>
      </details>

      {/* ── Actions ───────────────────────────────────────── */}
      <div className="form-actions">
        <button className="agent-action-btn view-btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="agent-action-btn edit-btn create-agent-submit-btn"
          onClick={onSubmit}
          disabled={!isFormValid}
        >
          {editingAgent ? 'Update Agent' : 'Create Agent'}
        </button>
      </div>
    </div>
  );
}

export default AgentForm;
