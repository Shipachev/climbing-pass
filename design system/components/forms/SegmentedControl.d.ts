import * as React from 'react';

/** Grey track with white selected pill — filters like История: Все / Завершённые / Незавершённые. */
export interface SegmentedControlProps {
  options: Array<string | { label: string; value: string }>;
  value: string;
  onChange?: (value: string) => void;
  style?: React.CSSProperties;
}

export declare function SegmentedControl(props: SegmentedControlProps): JSX.Element | null;
