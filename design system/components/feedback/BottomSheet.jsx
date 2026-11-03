import React from 'react';

export function BottomSheet({ open, title, description, children, onClose, position = 'absolute', style }) {
  if (!open) return null;
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
      style={{ position, inset: 0, background: 'var(--surface-scrim)', display: 'flex', alignItems: 'flex-end', zIndex: 10 }}>
      <div role="dialog" aria-modal="true" aria-label={title}
        style={{ width: '100%', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sheet) var(--radius-sheet) 0 0', padding: '24px 16px 46px', boxSizing: 'border-box', ...style }}>
        {title ? <h3 style={{ margin: 0, font: 'var(--text-title-m)', letterSpacing: 'var(--type-title-track)' }}>{title}</h3> : null}
        {description ? <p style={{ margin: '8px 0 20px', font: 'var(--text-body)', color: 'var(--text-tertiary)' }}>{description}</p> : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
      </div>
    </div>
  );
}
