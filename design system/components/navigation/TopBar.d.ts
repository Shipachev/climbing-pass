import * as React from 'react';

/** Back button row for pushed screens, with an optional right action. */
export interface TopBarProps {
  /** Pass null to hide the back button */
  onBack?: (() => void) | null;
  backIcon?: string;
  backLabel?: string;
  title?: string;
  /** Right-side control, e.g. outline «Завершить» */
  action?: React.ReactNode;
  style?: React.CSSProperties;
}

export declare function TopBar(props: TopBarProps): JSX.Element | null;
