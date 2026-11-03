import React from 'react';
import { Icon } from '../core/Icon.jsx';

const DEFAULT_ITEMS = [
  { id: 'home', icon: 'home', label: 'Главная' },
  { id: 'programs', icon: 'list_alt', label: 'Программы' },
  { id: 'history', icon: 'history', label: 'История' },
  { id: 'settings', icon: 'settings', label: 'Настройки' },
];

export function TabBar({ active = 'home', onChange, items = DEFAULT_ITEMS, safeBottom = 34, position = 'absolute', style }) {
  return (
    <nav style={{ position, left: 0, right: 0, bottom: 0, background: 'var(--surface-raised)', borderTop: '1px solid var(--border-default)', padding: '4px 8px ' + safeBottom + 'px', display: 'grid', gridTemplateColumns: 'repeat(' + items.length + ',1fr)', ...style }}>
      {items.map((it) => {
        const on = it.id === active;
        return (
          <button key={it.id} type="button" aria-current={on ? 'page' : undefined} onClick={() => onChange && onChange(it.id)}
            style={{ minHeight: 56, border: 0, background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'pointer', color: on ? 'var(--text-accent)' : 'var(--text-tertiary)', font: 'var(--weight-bold) var(--type-tab-size) var(--font-sans)' }}>
            <Icon name={it.icon} size={26} fill={on} color={on ? 'var(--action-primary)' : 'var(--text-tertiary)'} />{it.label}
          </button>
        );
      })}
    </nav>
  );
}
