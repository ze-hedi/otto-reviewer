import React, { useState } from 'react';

const SUGGESTED_TOOLS = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'WebSearch', 'WebFetch'];

/**
 * Tag-input component for the allowedTools string array.
 * Enter / comma to add a tool. Backspace on empty input removes the last tag.
 * Suggestions for common Claude Code built-in tools shown below.
 */
function ClaudeCodeToolsAllowlist({ tools, onChange }) {
  const [inputValue, setInputValue] = useState('');

  const addTool = (tool) => {
    const trimmed = tool.trim();
    if (!trimmed || tools.includes(trimmed)) return;
    onChange([...tools, trimmed]);
    setInputValue('');
  };

  const removeTool = (tool) => onChange(tools.filter((t) => t !== tool));

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTool(inputValue);
    }
    if (e.key === 'Backspace' && !inputValue && tools.length > 0) {
      removeTool(tools[tools.length - 1]);
    }
  };

  return (
    <div className="form-section">
      <div className="form-section-title">Allowed Tools</div>
      <div className="form-group">
        <p className="form-hint">
          Whitelist specific Claude Code built-in tools. Leave empty to allow all tools.
        </p>
        <div className="tools-allowlist">
          {tools.map((t) => (
            <span key={t} className="tools-allowlist-tag">
              {t}
              <button
                type="button"
                className="tools-allowlist-remove"
                onClick={() => removeTool(t)}
              >
                ✕
              </button>
            </span>
          ))}
          <input
            className="tools-allowlist-input"
            type="text"
            placeholder={tools.length === 0 ? 'Add a tool name...' : ''}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => inputValue.trim() && addTool(inputValue)}
          />
        </div>
        {SUGGESTED_TOOLS.filter((t) => !tools.includes(t)).length > 0 && (
          <div className="tools-allowlist-suggestions">
            {SUGGESTED_TOOLS.filter((t) => !tools.includes(t)).map((t) => (
              <button
                key={t}
                type="button"
                className="tools-allowlist-suggestion"
                onClick={() => addTool(t)}
              >
                + {t}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ClaudeCodeToolsAllowlist;
