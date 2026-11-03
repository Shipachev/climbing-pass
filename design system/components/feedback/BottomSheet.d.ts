import * as React from 'react';

/** Modal sheet from the bottom on a 50% black scrim — confirmations and short forms. */
export interface BottomSheetProps {
  open: boolean;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  onClose?: () => void;
  position?: 'absolute' | 'fixed';
  style?: React.CSSProperties;
}

export declare function BottomSheet(props: BottomSheetProps): JSX.Element | null;
