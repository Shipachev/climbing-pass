import React from 'react';

export function Stat({ label, value, style }) {
  return (
    <div style={style}>
      <div style={{ font: 'var(--weight-bold) 12px/1.2 var(--font-sans)', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ font: 'var(--weight-heavy) 20px/1.2 var(--font-sans)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}
