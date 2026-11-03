import React from 'react';
import { Icon } from './Icon.jsx';

const VARIANTS = {
  primary:   { bg: 'var(--action-primary)', hover: 'var(--action-primary-hover)', fg: 'var(--text-on-accent)', border: 'transparent' },
  secondary: { bg: 'var(--action-secondary)', hover: 'var(--action-secondary-hover)', fg: 'var(--text-primary)', border: 'transparent' },
  strong:    { bg: 'var(--action-strong)', hover: '#262626', fg: 'var(--text-on-inverse)', border: 'transparent' },
  outline:   { bg: 'transparent', hover: 'var(--surface-muted)', fg: 'var(--text-primary)', border: 'var(--border-strong)' },
  ghost:     { bg: 'transparent', hover: 'var(--surface-muted)', fg: 'var(--text-primary)', border: 'transparent' },
  danger:    { bg: 'transparent', hover: 'var(--surface-subtle)', fg: 'var(--text-danger)', border: 'var(--border-card)' },
};
const SIZES = {
  sm: { h: 48, font: 15, icon: 20, pad: 14 },
  md: { h: 56, font: 16, icon: 22, pad: 16 },
  lg: { h: 60, font: 18, icon: 24, pad: 18 },
};

export function Button({ variant = 'primary', size = 'md', icon, iconFill = false, fullWidth = false, disabled = false, onClick, children, style, type = 'button', ...rest }) {
  const [hover, setHover] = React.useState(false);
  const v = VARIANTS[variant] || VARIANTS.primary;
  const s = SIZES[size] || SIZES.md;
  const bg = disabled ? 'var(--action-secondary)' : hover ? v.hover : v.bg;
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        boxSizing: 'border-box', minHeight: s.h, padding: '0 ' + s.pad + 'px', width: fullWidth ? '100%' : undefined,
        flex: fullWidth ? 1 : undefined, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        borderRadius: 'var(--radius-control)', border: '1.5px solid ' + (disabled ? 'transparent' : v.border), background: bg,
        color: disabled ? 'var(--text-disabled)' : v.fg, font: 'var(--weight-heavy) ' + s.font + 'px/1.2 var(--font-sans)',
        textAlign: 'center', cursor: disabled ? 'not-allowed' : 'pointer', transition: 'background var(--dur-fast) var(--ease-standard)',
        WebkitTapHighlightColor: 'transparent', ...style,
      }}
      {...rest}
    >
      {icon ? <Icon name={icon} size={s.icon} fill={iconFill} /> : null}
      {children}
    </button>
  );
}
