import * as React from 'react';

/** Global bottom navigation: Главная, Программы, История, Настройки. Hidden on the workout screen. */
export interface TabBarProps {
  active?: 'home' | 'programs' | 'history' | 'settings' | string;
  onChange?: (id: string) => void;
  items?: Array<{ id: string; icon: string; label: string }>;
  safeBottom?: number;
  position?: 'absolute' | 'fixed' | 'static';
  style?: React.CSSProperties;
}

export declare function TabBar(props: TabBarProps): JSX.Element | null;
