import * as React from 'react';

/** Segmented progress bar — one segment per step; done orange, skipped grey, todo light. */
export interface ProgressSegmentsProps {
  /** One entry per step */
  statuses: Array<'done' | 'skipped' | 'todo'>;
  /** On black surfaces (ActiveTrainingCard) */
  inverse?: boolean;
  height?: number;
  gap?: number;
  style?: React.CSSProperties;
}

export declare function ProgressSegments(props: ProgressSegmentsProps): JSX.Element | null;
