import * as React from 'react';

/** Overline label + heavy value pair — «План / 90 минут», «Выполнено / 4 из 9». */
export interface StatProps {
  label: string;
  value: React.ReactNode;
  style?: React.CSSProperties;
}

export declare function Stat(props: StatProps): JSX.Element | null;
