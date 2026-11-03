import * as React from 'react';

/** Multi-line note field — «Моя заметка» on main-part steps. */
export interface TextAreaProps {
  label?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  onFocus?: (e: React.FocusEvent) => void;
  onBlur?: (e: React.FocusEvent) => void;
  style?: React.CSSProperties;
}

export declare function TextArea(props: TextAreaProps): JSX.Element | null;
