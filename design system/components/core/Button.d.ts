import * as React from 'react';

/**
 * Main action button. One orange primary per screen region; grey secondary for its sibling; black strong for "next" flows.
 * @startingPoint section="Core" subtitle="Primary, secondary, strong, outline buttons" viewport="700x260"
 */
export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'strong' | 'outline' | 'ghost' | 'danger';
  /** sm 48px · md 56px · lg 60px */
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  iconFill?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export declare function Button(props: ButtonProps): JSX.Element | null;
