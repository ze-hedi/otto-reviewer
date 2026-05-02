import React, { useState } from 'react';
import AgentTypeSelector from './AgentTypeSelector';
import PiAgentFormContainer from './PiAgentFormContainer';
import ClaudeCodeAgentForm from './ClaudeCodeAgentForm';
import '../AgentForm.css';
import './agents.css';

/**
 * Orchestrates the agent creation / editing wizard.
 *
 * Create flow:  AgentTypeSelector → PiAgentFormContainer | ClaudeCodeAgentForm
 * Edit flow:    skips type selection, goes directly to the correct form
 */
function AgentCreationFlow({ editingAgent, onCreated, onUpdated, onCancel }) {
  const initialType = editingAgent
    ? (editingAgent.agentType === 'claude-code' ? 'claude-code' : 'pi')
    : null;

  const [selectedType, setSelectedType] = useState(initialType);

  if (!selectedType) {
    return <AgentTypeSelector onSelect={setSelectedType} onCancel={onCancel} />;
  }

  if (selectedType === 'claude-code') {
    return (
      <ClaudeCodeAgentForm
        editingAgent={editingAgent}
        onCreated={onCreated}
        onUpdated={onUpdated}
        onCancel={onCancel}
      />
    );
  }

  return (
    <PiAgentFormContainer
      editingAgent={editingAgent}
      onCreated={onCreated}
      onUpdated={onUpdated}
      onCancel={onCancel}
    />
  );
}

export default AgentCreationFlow;
