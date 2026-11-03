import React from 'react';

export function TextArea({ label, value, onChange, placeholder = 'Как прошёл этап?', rows = 3, onFocus, onBlur, style }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <label style={{ display: 'block', ...style }}>
      {label ? <span style={{ display: 'block', font: 'var(--text-overline)', letterSpacing: 'var(--type-overline-track)', textTransform: 'uppercase', marginBottom: 6 }}>{label}</span> : null}
      <textarea
        value={value} onChange={onChange} placeholder={placeholder} rows={rows}
        onFocus={(e) => { setFocus(true); onFocus && onFocus(e); }}
        onBlur={(e) => { setFocus(false); onBlur && onBlur(e); }}
        style={{
          display: 'block', width: '100%', boxSizing: 'border-box', minHeight: 80, padding: '12px 14px',
          font: 'var(--text-body-s)', fontSize: 16, color: 'var(--text-primary)', background: 'var(--surface-raised)',
          border: '2px solid ' + (focus ? 'var(--focus-ring)' : 'var(--border-strong)'), borderRadius: 'var(--radius-input)',
          resize: 'none', outline: 'none',
        }}
      />
    </label>
  );
}
