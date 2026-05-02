import React from 'react';
import ClaudeCodeAgentForm from './agents/ClaudeCodeAgentForm';

/**
 * Right-side panel for editing a Claude Code agent from the workflow canvas.
 * Mirrors AgentDetailPanel structure but renders ClaudeCodeAgentForm.
 */
function ClaudeCodeDetailPanel({ agent, onClose, onAgentUpdated }) {
  if (!agent) return null;

  return (
    <div className="wf-detail-panel">
      <div className="wf-detail-panel-header">
        <span className="wf-detail-panel-title">Claude Code Agent</span>
        <button className="wf-detail-panel-close" onClick={onClose}>×</button>
      </div>
      <div className="wf-detail-panel-body">
        <ClaudeCodeAgentForm
          editingAgent={agent}
          onCreated={() => {}}
          onUpdated={(updated) => {
            onAgentUpdated(updated);
            onClose();
          }}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}

export default ClaudeCodeDetailPanel;
