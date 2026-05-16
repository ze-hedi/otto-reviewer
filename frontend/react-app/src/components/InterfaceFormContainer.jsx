import React, { useState } from 'react';

const INTERFACE_ICONS = [
  { value: '🖥️', label: 'Desktop' },
  { value: '📱', label: 'Mobile' },
  { value: '🌐', label: 'Web' },
  { value: '📊', label: 'Dashboard' },
  { value: '💬', label: 'Chat' },
  { value: '🎨', label: 'Canvas' },
  { value: '📋', label: 'List' },
  { value: '🔌', label: 'Plugin' },
];

function InterfaceFormContainer({ editingInterface, readOnly, onCreated, onCancel }) {
  const [name, setName] = useState(editingInterface?.name || '');
  const [icon, setIcon] = useState(editingInterface?.icon || '🖥️');
  const [executionFunction, setExecutionFunction] = useState(editingInterface?.executionFunction || '');
  const [syntaxError, setSyntaxError] = useState('');

  const validateFunction = (code) => {
    try {
      new Function(code);
      setSyntaxError('');
      return true;
    } catch (e) {
      setSyntaxError(e.message);
      return false;
    }
  };

  const isFormValid = name.trim() && icon.trim() && executionFunction.trim() && !syntaxError;

  const handleSubmit = async () => {
    if (!isFormValid) return;
    if (!validateFunction(executionFunction)) return;

    try {
      const res = await fetch('http://localhost:4000/api/interfaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, icon, executionFunction }),
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Unexpected response: ${text.slice(0, 200)}`);
      }
      if (!res.ok) throw new Error(data.error || 'Unknown error');
      onCreated(data);
    } catch (err) {
      alert(`Failed to create interface: ${err.message}`);
    }
  };

  return (
    <div className="create-agent-form">
      <h2 className="create-agent-title">{readOnly ? name : 'New Interface'}</h2>

      {/* ── Identity ───────────────────────────────────────── */}
      <div className="form-section">
        <div className="form-section-title">Identity</div>

        <div className="form-group">
          <label className="form-label" htmlFor="interface-name">Name</label>
          <input
            id="interface-name"
            className={`form-input${!name.trim() ? ' form-input--error' : ''}`}
            type="text"
            placeholder="e.g. Chat Interface"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={readOnly}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Icon</label>
          <div className="agent-icon-picker">
            {INTERFACE_ICONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`agent-icon-btn${icon === opt.value ? ' active' : ''}`}
                onClick={() => !readOnly && setIcon(opt.value)}
                title={opt.label}
                disabled={readOnly}
              >
                <span className="agent-icon-emoji">{opt.value}</span>
                <span className="agent-icon-label">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Execution Function ─────────────────────────────── */}
      <div className="form-section">
        <div className="form-section-title">Execution Function</div>
        <div className="form-group">
          <label className="form-label" htmlFor="exec-fn">JavaScript Code</label>
          <textarea
            id="exec-fn"
            className={`form-input form-textarea${syntaxError ? ' form-input--error' : ''}`}
            rows={10}
            placeholder="// Write the function body here..."
            value={executionFunction}
            onChange={(e) => {
              setExecutionFunction(e.target.value);
              if (e.target.value.trim()) validateFunction(e.target.value);
              else setSyntaxError('');
            }}
            style={{ fontFamily: 'monospace', resize: 'vertical' }}
            disabled={readOnly}
          />
          {syntaxError && (
            <small className="form-error">{syntaxError}</small>
          )}
        </div>
      </div>

      {/* ── Actions ────────────────────────────────────────── */}
      {!readOnly && (
        <div className="form-actions">
          <button className="btn btn--secondary" onClick={onCancel}>Cancel</button>
          <button
            className="btn btn--primary"
            disabled={!isFormValid}
            onClick={handleSubmit}
          >
            Create Interface
          </button>
        </div>
      )}
    </div>
  );
}

export default InterfaceFormContainer;
