import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { Button } from '../core/Button.jsx';
import { ProgressSegments } from './ProgressSegments.jsx';

export function ActiveTrainingCard({ variant = 'active', title, statuses = [], currentStep, onContinue, onMarkVisit, onStartTraining, visitMarked = false, style }) {
  const done = statuses.filter((s) => s === 'done').length;
  const box = { background: 'var(--surface-inverse)', color: 'var(--text-on-inverse)', borderRadius: 'var(--radius-card)', padding: 'var(--card-padding)', ...style };
  const over = { font: 'var(--text-overline)', letterSpacing: 'var(--type-overline-track)', textTransform: 'uppercase' };
  const h2 = { font: 'var(--text-title-xl)', letterSpacing: 'var(--type-title-track)', textWrap: 'pretty' };
  if (variant === 'idle') {
    return (
      <div style={box}>
        <div style={{ ...over, color: 'var(--text-on-inverse-muted)' }}>Нет активной тренировки</div>
        <h2 style={{ ...h2, margin: '12px 0 8px' }}>Вы на скалодроме?</h2>
        <p style={{ margin: 0, font: 'var(--text-body-s)', color: '#CFCFCF' }}>Отметка спишет один проход. Тренировку можно начать после — второй проход не спишется.</p>
        <Button size="lg" fullWidth icon={visitMarked ? 'check' : 'how_to_reg'} onClick={onMarkVisit} style={{ marginTop: 18 }}>{visitMarked ? 'Посещение отмечено' : 'Отметить посещение'}</Button>
        <Button variant="ghost" fullWidth size="sm" onClick={onStartTraining} style={{ marginTop: 6, color: 'var(--text-on-inverse)', background: 'transparent' }}>Начать тренировку</Button>
      </div>
    );
  }
  if (variant === 'finished') {
    return (
      <div style={box}>
        <div style={{ ...over, color: 'var(--text-on-inverse-muted)' }}>Тренировка завершена</div>
        <h2 style={{ ...h2, margin: '12px 0 6px' }}>{title}</h2>
        <p style={{ margin: 0, font: 'var(--weight-semibold) 16px/1.4 var(--font-sans)', color: '#CFCFCF' }}>Выполнено {done} из {statuses.length} этапов</p>
      </div>
    );
  }
  return (
    <div style={box}>
      <div style={{ ...over, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-on-inverse-accent)' }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--text-on-inverse-accent)' }} />Активная тренировка
      </div>
      <h2 style={{ ...h2, margin: '12px 0 18px' }}>{title}</h2>
      <div style={{ font: 'var(--weight-semibold) 14px/1 var(--font-sans)', color: 'var(--cp-gray-300)' }}>Выполнено</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
        <span style={{ font: 'var(--text-display)', letterSpacing: 'var(--type-display-track)', fontVariantNumeric: 'tabular-nums' }}>{done}</span>
        <span style={{ font: 'var(--weight-bold) 19px var(--font-sans)' }}>из {statuses.length} этапов</span>
      </div>
      <ProgressSegments statuses={statuses} inverse style={{ margin: '16px 0 18px' }} />
      <div style={{ borderTop: '1px solid var(--border-inverse)', paddingTop: 14 }}>
        <div style={{ font: 'var(--text-caption)', color: 'var(--text-on-inverse-muted)' }}>Текущий этап</div>
        <div style={{ marginTop: 3, font: 'var(--weight-bold) var(--type-step-size)/var(--type-step-lh) var(--font-sans)', textWrap: 'pretty' }}>{currentStep}</div>
      </div>
      <Button size="lg" fullWidth icon="play_arrow" iconFill onClick={onContinue} style={{ marginTop: 18, minHeight: 56 }}>Продолжить тренировку</Button>
    </div>
  );
}
