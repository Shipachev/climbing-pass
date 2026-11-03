import * as React from 'react';

/** Round 48×48 icon-only button — back, close, edit step, overflow. */
export interface IconButtonProps {
  icon: string;
  /** Accessible label (required — no visible text) */
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  size?: number;
  iconSize?: number;
  color?: string;
  style?: React.CSSProperties;
}

export declare function IconButton(props: IconButtonProps): JSX.Element | null;
