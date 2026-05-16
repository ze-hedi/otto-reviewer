import React, { useEffect, useRef } from 'react';

const Terminal = ({ logs, onClose }) => {
  const logsEndRef = useRef(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="wf-terminal">
      <div className="wf-terminal-header">
        <span className="wf-terminal-title">Runtime</span>
        <button className="wf-terminal-close" onClick={onClose}>×</button>
      </div>
      <div className="wf-terminal-body">
        {logs.map((entry, i) => (
          <div key={i} className={`wf-terminal-line wf-terminal-line--${entry.type}`}>
            <span className="wf-terminal-time">{entry.timestamp}</span>
            <span className="wf-terminal-msg">{entry.message}</span>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};

export default Terminal;
