import React from 'react';

export function MembershipStrip({ left, total, validUntil, style }) {
  const cap = { font: 'var(--text-caption)', color: 'var(--text-secondary)' };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-card)', ...style }}>
      <div style={{ padding: '14px 16px' }}>
        <div style={cap}>Осталось</div>
        <div style={{ marginTop: 2, display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' }}>
          <span style={{ font: 'var(--weight-heavy) 26px/1 var(--font-sans)', fontVariantNumeric: 'tabular-nums' }}>{left}</span>
          <span style={{ font: 'var(--weight-bold) 15px/1.2 var(--font-sans)' }}>из {total} посещений</span>
        </div>
      </div>
      <div style={{ padding: '14px 16px', borderLeft: '1px solid var(--border-card)' }}>
        <div style={cap}>Действует до</div>
        <div style={{ marginTop: 4, font: 'var(--weight-heavy) 20px/1.1 var(--font-sans)' }}>{validUntil}</div>
      </div>
    </div>
  );
}
