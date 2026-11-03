import * as React from 'react';

/** Full-bleed grey band naming a workout section — Разминка, Основная часть, Заминка. */
export interface SectionHeaderProps {
  title: string;
  /** e.g. "3/3" */
  count?: string;
  /** Replaces count with an inline control */
  action?: React.ReactNode;
  style?: React.CSSProperties;
}

export declare function SectionHeader(props: SectionHeaderProps): JSX.Element | null;
