import React from 'react';

export function ProgressSegments({ statuses, inverse = false, height, gap, style }) {
  const h = height || (inverse ? 10 : 8);
  const color = (s) => s === 'done' ? 'var(--progress-done)'
    : s === 'skipped' ? (inverse ? 'var(--progress-skipped-inverse)' : 'var(--progress-skipped)')
    : (inverse ? 'var(--progress-todo-inverse)' : 'var(--progress-todo)');
  const done = statuses.filter((s) => s === 'done').length;
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={statuses.length} aria-valuenow={done}
      style={{ display: 'flex', gap: gap != null ? gap : (inverse ? 4 : 3), ...style }}>
      {statuses.map((s, i) => (
        <span key={i} style={{ flex: 1, height: h, borderRadius: 'var(--radius-segment)', background: color(s), transition: 'background var(--dur-base)' }} />
      ))}
    </div>
  );
}
