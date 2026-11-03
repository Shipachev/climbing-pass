import React from 'react';
import { StatusLabel } from './StatusLabel.jsx';

export function StepRow({ index, title, meta, status = 'todo', onClick, style }) {
  const [hover, setHover] = React.useState(false);
  const label = status === 'done' ? 'Выполнен' : status === 'skipped' ? 'Пропущен' : meta;
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        boxSizing: 'border-box', width: '100%', minHeight: 'var(--row-h)', display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 16px', border: 0, borderBottom: '1px solid var(--border-row)', background: hover ? 'var(--surface-hover)' : 'transparent',
        cursor: 'pointer', textAlign: 'left', ...style,
      }}>
      <span style={{ width: 22, flex: 'none', font: 'var(--weight-heavy) 14px var(--font-sans)', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
        {String(index).padStart(2, '0')}
      </span>
      <span style={{ flex: 1, minWidth: 0, font: 'var(--text-row)', color: status === 'todo' ? 'var(--text-primary)' : 'var(--text-secondary)', textWrap: 'pretty' }}>{title}</span>
      <StatusLabel status={status} text={label} style={{ maxWidth: '44%' }} />
    </button>
  );
}
