import React from 'react';
import './AgentTypeSelector.css';

const AGENT_TYPES = [
  {
    key: 'coding',
    icon: '🤖',
    title: 'Coding Agent',
    description: 'An AI agent that can read, write, and execute code in a workspace.',
  },
  {
    key: 'memory',
    icon: '🧠',
    title: 'Memory Agent',
    description: 'An AI agent backed by semantic memory (Mem0) for storing and retrieving knowledge.',
  },
];

function AgentTypeSelector({ onSelect, onCancel }) {
  return (
    <div className="type-selector">
      <h2 className="type-selector__title">Choose Agent Type</h2>
      <div className="type-selector__cards">
        {AGENT_TYPES.map((t) => (
          <button
            key={t.key}
            className="type-selector__card"
            onClick={() => onSelect(t.key)}
          >
            <span className="type-selector__icon">{t.icon}</span>
            <span className="type-selector__card-title">{t.title}</span>
            <span className="type-selector__card-desc">{t.description}</span>
          </button>
        ))}
      </div>
      <button className="agent-action-btn view-btn type-selector__back" onClick={onCancel}>
        Back
      </button>
    </div>
  );
}

export default AgentTypeSelector;
