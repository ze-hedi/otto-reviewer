import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AgentForm from '../components/AgentForm';
import './AgentsPage.css';

function AgentsPage() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);

  // Identity
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');

  // Model
  const [model, setModel] = useState('');
  const [thinkingLevel, setThinkingLevel] = useState('medium');

  // Session
  const [sessionMode, setSessionMode] = useState('memory');
  const [workingDir, setWorkingDir] = useState('');

  // Prompt & Skills
  const [systemPromptMode, setSystemPromptMode] = useState('write');
  const [systemPromptText, setSystemPromptText] = useState('');
  const [systemPromptFile, setSystemPromptFile] = useState(null);
  const [skills, setSkills] = useState([]);
  const [skillsDragOver, setSkillsDragOver] = useState(false);

  // Icon
  const [icon, setIcon] = useState('🤖');

  // Tools
  const [availableTools, setAvailableTools] = useState([]);
  const [selectedTools, setSelectedTools] = useState([]);

  // Advanced
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const resetForm = () => {
    setShowForm(false);
    setEditingAgent(null);
    setFormName('');
    setFormDescription('');
    setModel('');
    setThinkingLevel('medium');
    setSessionMode('memory');
    setWorkingDir('');
    setSystemPromptMode('write');
    setSystemPromptText('');
    setSystemPromptFile(null);
    setSkills([]);
    setIcon('🤖');
    setSelectedTools([]);
    setApiKey('');
    setShowApiKey(false);
  };

  const getSystemPrompt = () => {
    if (systemPromptMode === 'write') {
      return systemPromptText.trim()
        ? { name: 'system_prompt.md', content: systemPromptText.trim() }
        : null;
    }
    return systemPromptFile || null;
  };

  const apiCall = async (url, options) => {
    const res = await fetch(url, options);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Server returned unexpected response (status ${res.status}): ${text.slice(0, 200)}`);
    }
    if (!res.ok) throw new Error(data.error || 'Unknown error');
    return data;
  };

  const buildPayload = () => ({
    name: formName,
    description: formDescription,
    model,
    thinkingLevel,
    sessionMode,
    ...(sessionMode === 'disk' || sessionMode === 'continue' ? { workingDir } : {}),
    systemPrompt: getSystemPrompt(),
    skills,
    icon,
    tools: selectedTools,
    ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
  });

  const handleCreate = async () => {
    if (!formName.trim() || !formDescription.trim() || !model) return;
    try {
      const agent = await apiCall('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      setAgents((prev) => [...prev, agent]);
      resetForm();
    } catch (err) {
      alert(`Failed to create agent: ${err.message}`);
    }
  };

  const openEditForm = async (agent) => {
    setFormName(agent.name);
    setFormDescription(agent.description);
    setModel(agent.model || '');
    setThinkingLevel(agent.thinkingLevel || 'medium');
    setSessionMode(agent.sessionMode || 'memory');
    setWorkingDir(agent.workingDir || '');
    setSystemPromptMode('write');
    setSystemPromptText('');
    setSystemPromptFile(null);
    setSkills([]);
    setIcon(agent.icon || '🤖');
    setSelectedTools(agent.tools ? agent.tools.map((t) => (typeof t === 'object' ? t._id : t)) : []);
    setApiKey('');
    setShowApiKey(false);
    setEditingAgent(agent);
    setShowForm(true);

    try {
      const files = await apiCall(`/api/agents/${agent._id}/files`);
      const soul = files.find((f) => f.type === 'soul');
      const skillsFile = files.find((f) => f.type === 'skills');
      if (soul) {
        setSystemPromptMode('upload');
        setSystemPromptFile({ name: 'system_prompt.md', content: soul.content });
      }
      if (skillsFile) {
        setSkills([{ name: 'skills.md', content: skillsFile.content, preloaded: true }]);
      }
    } catch {}
  };

  const handleUpdate = async () => {
    if (!formName.trim() || !formDescription.trim() || !model) return;
    try {
      const agent = await apiCall(`/api/agents/${editingAgent._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      setAgents((prev) => prev.map((a) => (a._id === agent._id ? agent : a)));
      resetForm();
    } catch (err) {
      alert(`Failed to update agent: ${err.message}`);
    }
  };

  const handleRun = async (agent) => {
    try {
      const files = await apiCall(`/api/agents/${agent._id}/files`);
      const res = await fetch('http://localhost:5000/runtime/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent, files }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Runtime server error');
      navigate(`/chat/${agent._id}`, { state: { agent } });
    } catch (err) {
      alert(`Failed to start agent: ${err.message}`);
    }
  };

  const readFiles = (files) => {
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setSkills((prev) => [...prev, { name: file.name, content: ev.target.result }]);
      };
      reader.readAsText(file);
    });
  };

  const handleSkillsLoad = (e) => {
    readFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const handleSkillsDrop = (e) => {
    e.preventDefault();
    setSkillsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.name.endsWith('.md'));
    readFiles(files);
  };

  const handleSystemPromptLoad = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSystemPromptFile({ name: file.name, content: ev.target.result });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  useEffect(() => {
    fetch('/api/agents')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load agents');
        return res.json();
      })
      .then((data) => {
        setAgents(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetch('/api/tools')
      .then((res) => res.json())
      .then(setAvailableTools)
      .catch(() => {});
  }, []);

  const isFormValid = formName.trim() && formDescription.trim() && model;

  if (loading) return <div className="agents-container"><div className="agents-content"><p className="agents-subtitle">Loading agents...</p></div></div>;
  if (error) return <div className="agents-container"><div className="agents-content"><p className="agents-subtitle" style={{ color: '#f87171' }}>Error: {error}</p></div></div>;

  return (
    <div className="agents-container">
      <div className="agents-content">
        <div className={`agents-header-row${showForm ? ' agents-header-row--centered' : ''}`}>
          <div>
            <h1>Agents</h1>
            <p className="agents-subtitle">Manage your AI agents</p>
          </div>
          {!showForm && (
            <button className="add-agent-btn" onClick={() => setShowForm(true)}>+ Add Agent</button>
          )}
        </div>

        {showForm ? (
          <AgentForm
            editingAgent={editingAgent}
            formName={formName}
            setFormName={setFormName}
            formDescription={formDescription}
            setFormDescription={setFormDescription}
            icon={icon}
            setIcon={setIcon}
            availableTools={availableTools}
            selectedTools={selectedTools}
            setSelectedTools={setSelectedTools}
            model={model}
            setModel={setModel}
            thinkingLevel={thinkingLevel}
            setThinkingLevel={setThinkingLevel}
            sessionMode={sessionMode}
            setSessionMode={setSessionMode}
            workingDir={workingDir}
            setWorkingDir={setWorkingDir}
            systemPromptMode={systemPromptMode}
            setSystemPromptMode={setSystemPromptMode}
            systemPromptText={systemPromptText}
            setSystemPromptText={setSystemPromptText}
            systemPromptFile={systemPromptFile}
            setSystemPromptFile={setSystemPromptFile}
            skills={skills}
            setSkills={setSkills}
            skillsDragOver={skillsDragOver}
            setSkillsDragOver={setSkillsDragOver}
            apiKey={apiKey}
            setApiKey={setApiKey}
            showApiKey={showApiKey}
            setShowApiKey={setShowApiKey}
            handleSystemPromptLoad={handleSystemPromptLoad}
            handleSkillsLoad={handleSkillsLoad}
            handleSkillsDrop={handleSkillsDrop}
            onCancel={resetForm}
            onSubmit={editingAgent ? handleUpdate : handleCreate}
            isFormValid={isFormValid}
          />
        ) : (
          <div className="agents-grid">
            {agents.map((agent) => (
              <div key={agent._id} className="agent-card">
                <div className="agent-header">
                  <h3 className="agent-name">{agent.name}</h3>
                  <span className={`agent-status ${agent.status.toLowerCase()}`}>
                    {agent.status}
                  </span>
                </div>
                <div className="agent-type">{agent.type}</div>
                <p className="agent-description">{agent.description}</p>
                <div className="agent-actions">
                  <button className="agent-action-btn view-btn" onClick={() => handleRun(agent)}>Run</button>
                  <button className="agent-action-btn edit-btn" onClick={() => openEditForm(agent)}>Edit</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AgentsPage;
