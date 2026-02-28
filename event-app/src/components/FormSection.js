import React from 'react';

export default function FormSection({ icon, title, subtitle, children }) {
  return (
    <div className="form-section">
      <div className="form-section-header">
        {icon && <span className="form-section-icon">{icon}</span>}
        <div>
          <h3 className="form-section-title">{title}</h3>
          {subtitle && <p className="form-section-subtitle">{subtitle}</p>}
        </div>
      </div>
      <div className="form-section-body">{children}</div>
    </div>
  );
}
