import * as React from 'react';

/** Single-line input with uppercase overline label — program name, planned minutes, dates. */
export interface TextFieldProps {
  label?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  readOnly?: boolean;
  inputMode?: 'text' | 'numeric';
  /** Black 2px border (primary field on the screen) */
  emphasis?: boolean;
  style?: React.CSSProperties;
}

export declare function TextField(props: TextFieldProps): JSX.Element | null;
