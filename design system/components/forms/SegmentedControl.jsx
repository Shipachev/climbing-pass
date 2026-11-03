import React from 'react';

export function SegmentedControl({ options, value, onChange, style }) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--surface-muted)', borderRadius: 'var(--radius-control)', ...style }}>
      {options.map((o) => {
        const label = typeof o === 'string' ? o : o.label;
        const val = typeof o === 'string' ? o : o.value;
        const on = val === value;
        return (
          <button key={val} type="button" role="tab" aria-selected={on} onClick={() => onChange && onChange(val)}
            style={{
              flex: 1, minHeight: 44, border: 0, borderRadius: 9, cursor: 'pointer', textAlign: 'center',
              font: 'var(--weight-bold) 14px var(--font-sans)', background: on ? 'var(--surface-raised)' : 'transparent',
              color: on ? 'var(--text-primary)' : 'var(--text-secondary)', boxShadow: on ? 'var(--shadow-selected)' : 'none',
            }}>{label}</button>
        );
      })}
    </div>
  );
}
