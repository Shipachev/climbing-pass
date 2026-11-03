import * as React from 'react';

/**
 * Black hero block on Главная — the highest-priority element. active: big done count + Продолжить; idle: Отметить посещение.
 * @startingPoint section="Home" subtitle="Black hero block: active / idle / finished" viewport="700x520"
 */
export interface ActiveTrainingCardProps {
  variant?: 'active' | 'idle' | 'finished';
  title?: string;
  statuses?: Array<'done' | 'skipped' | 'todo'>;
  currentStep?: string;
  onContinue?: () => void;
  onMarkVisit?: () => void;
  onStartTraining?: () => void;
  visitMarked?: boolean;
  style?: React.CSSProperties;
}

export declare function ActiveTrainingCard(props: ActiveTrainingCardProps): JSX.Element | null;
