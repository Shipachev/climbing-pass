import * as React from 'react';

/** Compact 56px row for a collapsed step; tap to expand into StepCard. */
export interface StepRowProps {
  /** 1-based, rendered as 01, 02… */
  index: number;
  title: string;
  meta?: string;
  status?: 'done' | 'skipped' | 'todo';
  onClick?: () => void;
  style?: React.CSSProperties;
}

export declare function StepRow(props: StepRowProps): JSX.Element | null;
