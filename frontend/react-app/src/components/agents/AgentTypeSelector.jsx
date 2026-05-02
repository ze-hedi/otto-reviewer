import React from 'react';
import AgentTypeCard from './AgentTypeCard';

const AGENT_TYPES = [
  {
    value: 'pi',
    icon: '🤖',
    title: 'Pi Agent',
    description: 'Full-featured coding agent with tools, skills, and multi-provider model support.',
  },
  {
    value: 'claude-code',
    icon: '🖥️',
    title: 'Claude Code Agent',
    description: 'Uses the Claude CLI with your Pro/Max subscription. No API key required.',
    badge: 'Pro / Max',
  },
];

/**
 * Step-1 screen of the agent creation wizard.
 * Clicking a card immediately proceeds to that form.
 */
function AgentTypeSelector({ onSelect, onCancel }) {
  return (
    <div className="agent-type-selector">
      <h2 className="create-agent-title">Choose agent type</h2>
      <p className="agent-type-selector-hint">Select a type to configure your new agent</p>
      <div className="agent-type-grid">
        {AGENT_TYPES.map((t) => (
          <AgentTypeCard
            key={t.value}
            icon={t.icon}
            title={t.title}
            description={t.description}
            badge={t.badge}
            selected={false}
            onClick={() => onSelect(t.value)}
          />
        ))}
      </div>
      <div className="form-actions">
        <button className="agent-action-btn view-btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default AgentTypeSelector;
