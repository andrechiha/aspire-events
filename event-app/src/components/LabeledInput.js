import React from 'react';

export default function LabeledInput({
  label,
  error,
  prefix,
  type = 'text',
  textarea = false,
  ...props
}) {
  const Tag = textarea ? 'textarea' : 'input';

  return (
    <div className={`labeled-input ${error ? 'labeled-input--error' : ''}`}>
      {label && <label className="labeled-input__label">{label}</label>}
      <div className="labeled-input__wrapper">
        {prefix && <span className="labeled-input__prefix">{prefix}</span>}
        <Tag
          className={`labeled-input__field ${prefix ? 'labeled-input__field--prefixed' : ''}`}
          type={textarea ? undefined : type}
          {...props}
        />
      </div>
      {error && <p className="labeled-input__error">{error}</p>}
    </div>
  );
}
