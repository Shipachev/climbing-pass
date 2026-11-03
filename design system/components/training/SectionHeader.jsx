import React from 'react';

export function SectionHeader({ title, count, action, style }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-muted)',
      padding: action ? '4px 4px 4px 16px' : '10px 16px', font: 'var(--text-overline)',
      letterSpacing: 'var(--type-overline-track)', textTransform: 'uppercase', color: 'var(--text-primary)', ...style,
    }}>
      <span>{title}</span>
      {action || (count != null ? <span style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{count}</span> : null)}
    </div>
  );
}
