import React from 'react';

export function Icon({ name, size = 24, fill = false, weight = 400, color, style, ...rest }) {
  return (
    <span
      aria-hidden="true"
      className="cp-icon"
      style={{
        fontFamily: 'var(--font-icon)', fontSize: size, lineHeight: 1, display: 'inline-block', flex: 'none',
        fontVariationSettings: "'FILL' " + (fill ? 1 : 0) + ", 'wght' " + weight,
        color: color, userSelect: 'none', whiteSpace: 'nowrap', fontFeatureSettings: "'liga'", ...style,
      }}
      {...rest}
    >{name}</span>
  );
}
