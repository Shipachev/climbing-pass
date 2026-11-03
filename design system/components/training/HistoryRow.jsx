import React from 'react';
import { Icon } from '../core/Icon.jsx';

const ST = {
  finished:   { icon: 'check_circle', text: 'Завершена', color: 'var(--text-secondary)' },
  unfinished: { icon: 'timelapse', text: 'Незавершена', color: 'var(--text-secondary)' },
  active:     { icon: 'play_circle', text: 'Идёт', color: 'var(--text-accent)' },
  visit:      { icon: 'how_to_reg', text: 'Посещение без тренировки', color: 'var(--text-secondary)' },
};

export function HistoryRow({ day, month, title, score, status = 'finished', onClick, style }) {
  const s = ST[status] || ST.finished;
  return (
    <div onClick={onClick} role={onClick ? 'button' : undefined}
      style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 'var(--row-h-lg)', padding: '10px 0', borderBottom: '1px solid var(--cp-gray-175)', cursor: onClick ? 'pointer' : 'default', ...style }}>
      <div style={{ width: 40, flex: 'none', textAlign: 'center' }}>
        <div style={{ font: 'var(--weight-heavy) 22px/1 var(--font-sans)' }}>{day}</div>
        <div style={{ font: 'var(--weight-bold) 12px/1.2 var(--font-sans)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginTop: 2 }}>{month}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: 'var(--weight-bold) 16px/1.3 var(--font-sans)', color: status === 'visit' ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, font: 'var(--text-caption)', color: s.color }}>
          <Icon name={s.icon} size={16} fill />{s.text}
        </div>
      </div>
      {score ? <span style={{ font: 'var(--weight-heavy) 22px var(--font-sans)', fontVariantNumeric: 'tabular-nums' }}>{score}</span> : null}
    </div>
  );
}
