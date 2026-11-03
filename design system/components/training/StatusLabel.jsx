import React from 'react';
import { Icon } from '../core/Icon.jsx';

const MAP = {
  done:    { icon: 'check_circle', text: 'Выполнен', color: 'var(--status-done)', fill: true },
  skipped: { icon: 'do_not_disturb_on', text: 'Пропущен', color: 'var(--status-skipped)', fill: true },
  todo:    { icon: 'radio_button_unchecked', text: '', color: 'var(--status-todo)', fill: false },
};

export function StatusLabel({ status = 'todo', text, style }) {
  const m = MAP[status] || MAP.todo;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: 'var(--text-caption)', color: 'var(--text-secondary)', textAlign: 'right', ...style }}>
      <Icon name={m.icon} size={20} fill={m.fill} color={m.color} />
      {text != null ? text : m.text}
    </span>
  );
}
