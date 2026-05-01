import React from 'react';
import './Card.css';

function Card({ title, subtitle, status, actions, children }) {
  return (
    <div className="card">
      <div className="card__header">
        <div>
          <h3 className="card__title">{title}</h3>
          {subtitle && <div className="card__subtitle">{subtitle}</div>}
        </div>
        {status && (
          <span className={`card__status card__status--${status.type}`}>
            {status.label}
          </span>
        )}
      </div>
      {children && <div className="card__content">{children}</div>}
      {actions && actions.length > 0 && (
        <div className="card__actions">
          {actions.map((action, idx) => (
            <button
              key={idx}
              className={`card__action-btn card__action-btn--${action.variant || 'default'}`}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default Card;
