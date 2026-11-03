import * as React from 'react';

/** Bottom bar holding the current step’s actions; follows the keyboard. */
export interface ActionBarProps {
  children: React.ReactNode;
  /** Height of on-screen keyboard; bar sits above it */
  keyboardOffset?: number;
  safeBottom?: number;
  position?: 'absolute' | 'fixed' | 'sticky' | 'static';
  onMouseDown?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

export declare function ActionBar(props: ActionBarProps): JSX.Element | null;
