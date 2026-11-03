import React from 'react';
import { IconButton } from '../core/IconButton.jsx';

export function TopBar({ onBack, backIcon = 'arrow_back', backLabel = 'Назад', title, action, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, minHeight: 48, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
        {onBack !== null ? <IconButton icon={backIcon} label={backLabel} onClick={onBack} style={{ marginLeft: -12 }} /> : null}
        {title ? <span style={{ font: 'var(--weight-heavy) 18px var(--font-sans)' }}>{title}</span> : null}
      </div>
      {action || null}
    </div>
  );
}
