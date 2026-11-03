import React from 'react';
import { Icon } from './Icon.jsx';

export function IconButton({ icon, label, onClick, size = 48, iconSize = 24, color = 'var(--text-primary)', style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        boxSizing: 'border-box', width: size, height: size, borderRadius: size / 2, border: 0, padding: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color,
        background: hover ? 'var(--surface-muted)' : 'transparent', ...style,
      }}
      {...rest}
    >
      <Icon name={icon} size={iconSize} />
    </button>
  );
}
