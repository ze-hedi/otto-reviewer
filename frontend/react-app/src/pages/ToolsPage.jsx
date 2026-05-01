import React, { useEffect, useState } from 'react';
import ToolForm from '../components/ToolForm';
import Card from '../components/Card';
import './ToolsPage.css';

function ToolsPage() {
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTool, setEditingTool] = useState(null);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIcon, setFormIcon] = useState('🔧');
  const [formSchema, setFormSchema] = useState('');
  const [formExecutionFunction, setFormExecutionFunction] = useState('');

  const resetForm = () => {
    setShowForm(false);
    setEditingTool(null);
    setFormName('');
    setFormDescription('');
    setFormIcon('🔧');
    setFormSchema('');
    setFormExecutionFunction('');
  };

  const validateJSON = (jsonString) => {
    try {
      JSON.parse(jsonString);
      return true;
    } catch {
      return false;
    }
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

  const validateExecutionFunction = (functionString) => {
    try {
      new Function('params', functionString);
      return true;
    } catch {
      return false;
    }
  };

  const handleCreate = async () => {
    if (!formName.trim() || !formDescription.trim() || !formSchema.trim() || !formExecutionFunction.trim()) {
      alert('All fields are required');
      return;
    }

    if (!validateJSON(formSchema)) {
      alert('Schema must be valid JSON');
      return;
    }

    if (!validateExecutionFunction(formExecutionFunction)) {
      alert('Execution function has invalid JavaScript syntax');
      return;
    }

    try {
      const schema = JSON.parse(formSchema);
      const tool = await apiCall('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          description: formDescription,
          icon: formIcon || '🔧',
          schema,
          executionFunction: formExecutionFunction,
        }),
      });
      setTools((prev) => [...prev, tool]);
      resetForm();
    } catch (err) {
      alert(`Failed to create tool: ${err.message}`);
    }
  };

  const openEditForm = (tool) => {
    setFormName(tool.name);
    setFormDescription(tool.description);
    setFormIcon(tool.icon || '🔧');
    setFormSchema(JSON.stringify(tool.schema, null, 2));
    setFormExecutionFunction(tool.executionFunction || '');
    setEditingTool(tool);
    setShowForm(true);
  };

  const handleUpdate = async () => {
    if (!formName.trim() || !formDescription.trim() || !formSchema.trim() || !formExecutionFunction.trim()) {
      alert('All fields are required');
      return;
    }

    if (!validateJSON(formSchema)) {
      alert('Schema must be valid JSON');
      return;
    }

    if (!validateExecutionFunction(formExecutionFunction)) {
      alert('Execution function has invalid JavaScript syntax');
      return;
    }

    try {
      const schema = JSON.parse(formSchema);
      const tool = await apiCall(`/api/tools/${editingTool._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          description: formDescription,
          icon: formIcon || '🔧',
          schema,
          executionFunction: formExecutionFunction,
        }),
      });
      setTools((prev) => prev.map((t) => (t._id === tool._id ? tool : t)));
      resetForm();
    } catch (err) {
      alert(`Failed to update tool: ${err.message}`);
    }
  };

  const handleDelete = async (toolId) => {
    if (!window.confirm('Are you sure you want to delete this tool?')) {
      return;
    }

    try {
      await apiCall(`/api/tools/${toolId}`, {
        method: 'DELETE',
      });
      setTools((prev) => prev.filter((t) => t._id !== toolId));
    } catch (err) {
      alert(`Failed to delete tool: ${err.message}`);
    }
  };

  useEffect(() => {
    fetch('/api/tools')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load tools');
        return res.json();
      })
      .then((data) => {
        setTools(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const isFormValid =
    formName.trim() &&
    formDescription.trim() &&
    formSchema.trim() &&
    formExecutionFunction.trim() &&
    validateJSON(formSchema) &&
    validateExecutionFunction(formExecutionFunction);

  if (loading)
    return (
      <div className="tools-container">
        <div className="tools-content">
          <p className="tools-subtitle">Loading tools...</p>
        </div>
      </div>
    );

  if (error)
    return (
      <div className="tools-container">
        <div className="tools-content">
          <p className="tools-subtitle" style={{ color: '#f87171' }}>
            Error: {error}
          </p>
        </div>
      </div>
    );

  return (
    <div className="tools-container">
      <div className="tools-content">
        <div className={`tools-header-row${showForm ? ' tools-header-row--centered' : ''}`}>
          <div>
            <h1>Tools</h1>
            <p className="tools-subtitle">Manage your tool schemas</p>
          </div>
          {!showForm && (
            <button className="add-tool-btn" onClick={() => setShowForm(true)}>
              + Add Tool
            </button>
          )}
        </div>

        {showForm ? (
          <ToolForm
            editingTool={editingTool}
            formName={formName}
            setFormName={setFormName}
            formDescription={formDescription}
            setFormDescription={setFormDescription}
            formIcon={formIcon}
            setFormIcon={setFormIcon}
            formSchema={formSchema}
            setFormSchema={setFormSchema}
            formExecutionFunction={formExecutionFunction}
            setFormExecutionFunction={setFormExecutionFunction}
            onCancel={resetForm}
            onSubmit={editingTool ? handleUpdate : handleCreate}
            isFormValid={isFormValid}
          />
        ) : (
          <>
            {tools.length === 0 ? (
              <div className="tools-empty">
                <p className="tools-empty-message">No tools yet. Create your first tool!</p>
              </div>
            ) : (
              <div className="tools-grid">
                {tools.map((tool) => (
                  <Card
                    key={tool._id}
                    title={tool.name}
                    actions={[
                      {
                        label: 'Edit',
                        onClick: () => openEditForm(tool),
                        variant: 'edit',
                      },
                      {
                        label: 'Delete',
                        onClick: () => handleDelete(tool._id),
                        variant: 'delete',
                      },
                    ]}
                  >
                    <p className="tool-description">{tool.description}</p>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ToolsPage;
