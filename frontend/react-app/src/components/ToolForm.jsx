import React, { useState } from 'react';
import FormSection from './FormSection';
import './ToolForm.css';

function ToolForm({
  editingTool,
  formName,
  setFormName,
  formDescription,
  setFormDescription,
  formSchema,
  setFormSchema,
  onCancel,
  onSubmit,
  isFormValid,
}) {
  const [schemaError, setSchemaError] = useState('');

  const validateJSON = (value) => {
    if (!value.trim()) {
      setSchemaError('');
      return;
    }
    try {
      JSON.parse(value);
      setSchemaError('');
    } catch (err) {
      setSchemaError('Invalid JSON syntax');
    }
  };

  const handleSchemaChange = (e) => {
    const value = e.target.value;
    setFormSchema(value);
    validateJSON(value);
  };

  const formatJSON = () => {
    if (!formSchema.trim()) return;
    try {
      const parsed = JSON.parse(formSchema);
      const formatted = JSON.stringify(parsed, null, 2);
      setFormSchema(formatted);
      setSchemaError('');
    } catch (err) {
      setSchemaError('Cannot format invalid JSON');
    }
  };

  return (
    <div className="tool-form">
      <h2 className="tool-form-title">{editingTool ? 'Edit Tool' : 'New Tool'}</h2>

      {/* ── Identity ───────────────────────────────────────── */}
      <FormSection title="Identity">
        <div className="form-group">
          <label className="form-label" htmlFor="tool-name">Name</label>
          <input
            id="tool-name"
            className="form-input"
            type="text"
            placeholder="e.g. calculator"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
          <p className="form-hint">Unique identifier for this tool</p>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="tool-description">Description</label>
          <textarea
            id="tool-description"
            className="form-textarea"
            placeholder="Describe what this tool does..."
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            rows={3}
          />
          <p className="form-hint">Clear description of the tool's functionality</p>
        </div>
      </FormSection>

      {/* ── Schema Definition ──────────────────────────────── */}
      <FormSection title="Schema Definition">
        <div className="form-group">
          <div className="schema-header">
            <label className="form-label" htmlFor="tool-schema">JSON Schema</label>
            <button
              type="button"
              className="format-btn"
              onClick={formatJSON}
              disabled={!formSchema.trim() || !!schemaError}
            >
              Format JSON
            </button>
          </div>
          <textarea
            id="tool-schema"
            className={`form-textarea json-schema-input${schemaError ? ' error' : ''}`}
            placeholder={`{\n  "type": "object",\n  "properties": {\n    "param1": { "type": "string" }\n  }\n}`}
            value={formSchema}
            onChange={handleSchemaChange}
            rows={12}
          />
          {schemaError && <p className="form-error">{schemaError}</p>}
          <p className="form-hint">Enter a valid JSON schema defining the tool's parameters</p>
        </div>
      </FormSection>

      {/* ── Actions ────────────────────────────────────────── */}
      <div className="tool-form-actions">
        <button
          type="button"
          className="tool-form-btn tool-form-btn--cancel"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="tool-form-btn tool-form-btn--submit"
          onClick={onSubmit}
          disabled={!isFormValid}
        >
          {editingTool ? 'Update Tool' : 'Create Tool'}
        </button>
      </div>
    </div>
  );
}

export default ToolForm;
