import * as React from 'react';

/** Date block + title + status + big score — Главная «Последние тренировки» and История. */
export interface HistoryRowProps {
  day: string;
  month: string;
  title: string;
  /** e.g. "8/9"; omit for visit-only */
  score?: string;
  status?: 'finished' | 'unfinished' | 'active' | 'visit';
  onClick?: () => void;
  style?: React.CSSProperties;
}

export declare function HistoryRow(props: HistoryRowProps): JSX.Element | null;
