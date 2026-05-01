import React from 'react';
import './FormSection.css';

function FormSection({ title, children }) {
  return (
    <div className="form-section">
      <div className="form-section-title">{title}</div>
      {children}
    </div>
  );
}

export default FormSection;
