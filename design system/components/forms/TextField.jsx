import React from 'react';

export function TextField({ label, value, onChange, placeholder, readOnly, inputMode, emphasis = false, style }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <label style={{ display: 'block', ...style }}>
      {label ? <span style={{ display: 'block', font: 'var(--text-overline)', letterSpacing: 'var(--type-overline-track)', textTransform: 'uppercase', marginBottom: 6 }}>{label}</span> : null}
      <input
        value={value} onChange={onChange} placeholder={placeholder} readOnly={readOnly} inputMode={inputMode}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{
          display: 'block', width: '100%', boxSizing: 'border-box', minHeight: 52, padding: '0 14px',
          font: 'var(--weight-semibold) 16px var(--font-sans)', color: 'var(--text-primary)', background: 'var(--surface-raised)',
          border: '2px solid ' + (focus ? 'var(--focus-ring)' : emphasis ? 'var(--border-strong)' : 'var(--cp-gray-275)'),
          borderRadius: 'var(--radius-input)', outline: 'none',
        }}
      />
    </label>
  );
}
