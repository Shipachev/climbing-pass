import React from 'react';

export function ActionBar({ children, keyboardOffset = 0, safeBottom = 34, position = 'absolute', onMouseDown, style }) {
  return (
    <div onMouseDown={onMouseDown || ((e) => { if (e.target.closest('button')) e.preventDefault(); })}
      style={{
        position, left: 0, right: 0, bottom: keyboardOffset, background: 'var(--surface-raised)', borderTop: '1px solid var(--border-default)',
        padding: '10px 12px ' + (keyboardOffset ? 10 : 12 + safeBottom) + 'px', display: 'flex', gap: 8, alignItems: 'center', boxSizing: 'border-box', ...style,
      }}>
      {children}
    </div>
  );
}
