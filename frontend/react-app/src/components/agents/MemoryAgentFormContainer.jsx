import React, { useState } from 'react';
import MemoryAgentForm from './MemoryAgentForm';

function MemoryAgentFormContainer({ editingAgent, onCreated, onUpdated, onCancel }) {
  const [formName, setFormName]               = useState(editingAgent?.name || '');
  const [formDescription, setFormDescription] = useState(editingAgent?.description || '');
  const [icon, setIcon]                       = useState(editingAgent?.icon || '🧠');
  const [model, setModel]                     = useState(editingAgent?.model || '');
  const [embedModel, setEmbedModel]           = useState(editingAgent?.embedModel || 'all-minilm');
  const [ollamaBaseUrl, setOllamaBaseUrl]     = useState(editingAgent?.ollamaBaseUrl || 'http://localhost:11434');
  const [collectionName, setCollectionName]   = useState(editingAgent?.collectionName || 'memories');
  const [qdrantUrl, setQdrantUrl]             = useState(editingAgent?.qdrantUrl || '');
  const [qdrantApiKey, setQdrantApiKey]       = useState('');
  const [showQdrantApiKey, setShowQdrantApiKey] = useState(false);
  const [customInstructions, setCustomInstructions] = useState(editingAgent?.customInstructions || '');
  const [apiKey, setApiKey]                   = useState('');
  const [showApiKey, setShowApiKey]           = useState(false);

  const buildPayload = () => ({
    name: formName,
    description: formDescription,
    icon,
    model,
    embedModel,
    ollamaBaseUrl,
    collectionName,
    qdrantUrl,
    ...(qdrantApiKey.trim() ? { qdrantApiKey: qdrantApiKey.trim() } : {}),
    customInstructions,
    ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
  });

  const apiCall = async (url, options) => {
    const res  = await fetch(url, options);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch {
      throw new Error(`Unexpected response (${res.status}): ${text.slice(0, 200)}`);
    }
    if (!res.ok) throw new Error(data.error || 'Unknown error');
    return data;
  };

  const handleSubmit = async () => {
    if (!formName.trim() || !formDescription.trim() || !model) return;
    try {
      if (editingAgent) {
        const agent = await apiCall(`/api/memory-agents/${editingAgent._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload()),
        });
        onUpdated(agent);
      } else {
        const agent = await apiCall('/api/memory-agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload()),
        });
        onCreated(agent);
      }
    } catch (err) {
      alert(`Failed to save memory agent: ${err.message}`);
    }
  };

  const isFormValid = formName.trim() && formDescription.trim() && model;

  return (
    <MemoryAgentForm
      editingAgent={editingAgent}
      formName={formName}               setFormName={setFormName}
      formDescription={formDescription} setFormDescription={setFormDescription}
      icon={icon}                       setIcon={setIcon}
      model={model}                     setModel={setModel}
      embedModel={embedModel}           setEmbedModel={setEmbedModel}
      ollamaBaseUrl={ollamaBaseUrl}     setOllamaBaseUrl={setOllamaBaseUrl}
      collectionName={collectionName}   setCollectionName={setCollectionName}
      qdrantUrl={qdrantUrl}             setQdrantUrl={setQdrantUrl}
      qdrantApiKey={qdrantApiKey}       setQdrantApiKey={setQdrantApiKey}
      showQdrantApiKey={showQdrantApiKey} setShowQdrantApiKey={setShowQdrantApiKey}
      customInstructions={customInstructions} setCustomInstructions={setCustomInstructions}
      apiKey={apiKey}                   setApiKey={setApiKey}
      showApiKey={showApiKey}           setShowApiKey={setShowApiKey}
      onCancel={onCancel}
      onSubmit={handleSubmit}
      isFormValid={isFormValid}
    />
  );
}

export default MemoryAgentFormContainer;
