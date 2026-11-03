import * as React from 'react';

/** Material Symbols Rounded glyph — the only icon set in ClimbPass. */
export interface IconProps {
  /** Material Symbols Rounded ligature name, e.g. "check_circle" */
  name: string;
  size?: number;
  /** Filled variant — use for active/selected/status icons */
  fill?: boolean;
  weight?: 300 | 400 | 500 | 600;
  color?: string;
  style?: React.CSSProperties;
}

export declare function Icon(props: IconProps): JSX.Element | null;
