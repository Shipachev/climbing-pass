import * as React from 'react';

/** Icon + short word for step state, so status is never colour-only. */
export interface StatusLabelProps {
  status?: 'done' | 'skipped' | 'todo';
  /** Override text (e.g. step meta for todo) */
  text?: string;
  style?: React.CSSProperties;
}

export declare function StatusLabel(props: StatusLabelProps): JSX.Element | null;
