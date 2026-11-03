import * as React from 'react';

/** Two-cell bordered strip: remaining visits and expiry date. */
export interface MembershipStripProps {
  left: number;
  total: 1 | 4 | 8 | number;
  /** e.g. "30 ноября" */
  validUntil: string;
  style?: React.CSSProperties;
}

export declare function MembershipStrip(props: MembershipStripProps): JSX.Element | null;
