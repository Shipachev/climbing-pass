import * as React from 'react';

/**
 * Expanded current step: task, volume chip, instructions, last-session note, personal note, swipe right = done / left = skip.
 * @startingPoint section="Training" subtitle="Expanded current step with notes and swipe" viewport="700x620"
 */
export interface StepCardProps {
  index?: number;
  total?: number;
  title: string;
  /** Volume, e.g. "3 серии по 4 трассы" */
  meta?: string;
  description?: string;
  status?: 'done' | 'skipped' | 'todo';
  /** First unmarked step → chip «Сейчас» */
  current?: boolean;
  prevNote?: { date: string; text: string };
  note?: string;
  onNoteChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onNoteFocus?: (e: React.FocusEvent) => void;
  onNoteBlur?: (e: React.FocusEvent) => void;
  /** Main-part steps only */
  showNote?: boolean;
  onSwipeDone?: () => void;
  onSwipeSkip?: () => void;
  swipeHint?: boolean;
  style?: React.CSSProperties;
}

export declare function StepCard(props: StepCardProps): JSX.Element | null;
