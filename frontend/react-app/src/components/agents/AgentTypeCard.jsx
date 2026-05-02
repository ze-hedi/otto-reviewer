import React from 'react';

/**
 * Generic selectable card primitive.
 * Used by AgentTypeSelector and anywhere a visual single-choice picker is needed.
 */
function AgentTypeCard({ icon, title, description, badge, selected, onClick }) {
  return (
    <div
      className={`agent-type-card${selected ? ' selected' : ''}`}
      onClick={onClick}
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      {badge && <span className="agent-type-badge">{badge}</span>}
      <span className="agent-type-icon">{icon}</span>
      <span className="agent-type-title">{title}</span>
      <span className="agent-type-desc">{description}</span>
    </div>
  );
}

export default AgentTypeCard;
