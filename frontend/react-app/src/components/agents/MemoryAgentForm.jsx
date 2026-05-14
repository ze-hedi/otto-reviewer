import React from 'react';
import ModelSelect from '../ModelSelect';
import '../AgentForm.css';

const AGENT_ICONS = [
  { value: '🧠', label: 'Brain' },
  { value: '💾', label: 'Memory' },
  { value: '🔍', label: 'Search' },
  { value: '📚', label: 'Knowledge' },
  { value: '🗄️', label: 'Archive' },
];

function MemoryAgentForm({
  editingAgent,
  formName, setFormName,
  formDescription, setFormDescription,
  icon, setIcon,
  model, setModel,
  embedModel, setEmbedModel,
  ollamaBaseUrl, setOllamaBaseUrl,
  collectionName, setCollectionName,
  qdrantUrl, setQdrantUrl,
  qdrantApiKey, setQdrantApiKey,
  showQdrantApiKey, setShowQdrantApiKey,
  customInstructions, setCustomInstructions,
  apiKey, setApiKey,
  showApiKey, setShowApiKey,
  onCancel,
  onSubmit,
  isFormValid,
}) {
  return (
    <div className="create-agent-form">
      <h2 className="create-agent-title">
        {editingAgent ? 'Edit Memory Agent' : 'New Memory Agent'}
      </h2>

      {/* Identity */}
      <div className="form-section">
        <div className="form-section-title">Identity</div>
        <div className="form-group">
          <label className="form-label" htmlFor="mem-agent-name">Name</label>
          <input
            id="mem-agent-name"
            className="form-input"
            type="text"
            placeholder="e.g. project-memory"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
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
          <label className="form-label" htmlFor="mem-agent-description">Description</label>
          <textarea
            id="mem-agent-description"
            className="form-textarea"
            placeholder="Describe what this memory agent stores..."
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            rows={3}
          />
        </div>
      </div>

      {/* LLM Model */}
      <div className="form-section">
        <div className="form-section-title">LLM (Memory Extraction)</div>
        <div className="form-group">
          <label className="form-label" htmlFor="mem-agent-model">Provider / Model</label>
          <p className="form-hint">The LLM used to extract and process memories.</p>
          <ModelSelect id="mem-agent-model" value={model} onChange={(e) => setModel(e.target.value)} />
        </div>
      </div>

      {/* Embedder */}
      <div className="form-section">
        <div className="form-section-title">Embedder (Ollama)</div>
        <div className="form-group">
          <label className="form-label" htmlFor="mem-embed-model">Embedding Model</label>
          <input
            id="mem-embed-model"
            className="form-input"
            type="text"
            placeholder="all-minilm"
            value={embedModel}
            onChange={(e) => setEmbedModel(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="mem-ollama-url">Ollama Base URL</label>
          <input
            id="mem-ollama-url"
            className="form-input"
            type="text"
            placeholder="http://localhost:11434"
            value={ollamaBaseUrl}
            onChange={(e) => setOllamaBaseUrl(e.target.value)}
          />
        </div>
      </div>

      {/* Vector Store */}
      <div className="form-section">
        <div className="form-section-title">Vector Store (Qdrant)</div>
        <div className="form-group">
          <label className="form-label" htmlFor="mem-collection">Collection Name</label>
          <input
            id="mem-collection"
            className="form-input"
            type="text"
            placeholder="memories"
            value={collectionName}
            onChange={(e) => setCollectionName(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="mem-qdrant-url">Qdrant URL</label>
          <input
            id="mem-qdrant-url"
            className="form-input"
            type="text"
            placeholder="http://localhost:6333"
            value={qdrantUrl}
            onChange={(e) => setQdrantUrl(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="mem-qdrant-key">Qdrant API Key</label>
          <p className="form-hint">Only needed for managed/cloud Qdrant deployments.</p>
          <div className="password-field">
            <input
              id="mem-qdrant-key"
              className="form-input"
              type={showQdrantApiKey ? 'text' : 'password'}
              placeholder="Optional"
              value={qdrantApiKey}
              onChange={(e) => setQdrantApiKey(e.target.value)}
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowQdrantApiKey((v) => !v)}
            >
              {showQdrantApiKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
      </div>

      {/* Custom Instructions */}
      <div className="form-section">
        <div className="form-section-title">Custom Instructions</div>
        <div className="form-group">
          <label className="form-label" htmlFor="mem-custom-instructions">
            Memory Extraction Prompt
          </label>
          <p className="form-hint">
            Additional instructions injected into the memory extraction prompt.
          </p>
          <textarea
            id="mem-custom-instructions"
            className="form-textarea"
            placeholder="e.g. Focus on extracting technical decisions and architecture choices..."
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            rows={4}
          />
        </div>
      </div>

      {/* Advanced */}
      <details className="form-advanced">
        <summary className="form-advanced-summary">
          <span>Advanced</span>
          <span className="form-advanced-arrow">></span>
        </summary>
        <div className="form-advanced-body">
          <div className="form-group">
            <label className="form-label" htmlFor="mem-api-key">API Key Override</label>
            <p className="form-hint">Leave blank to use the environment variable.</p>
            <div className="password-field">
              <input
                id="mem-api-key"
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

      {/* Actions */}
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

export default MemoryAgentForm;
