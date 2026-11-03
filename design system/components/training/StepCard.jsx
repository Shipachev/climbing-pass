import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { TextArea } from '../forms/TextArea.jsx';

export function StepCard({ index, total, title, meta, description, status = 'todo', current = true, prevNote, note, onNoteChange, onNoteFocus, onNoteBlur, showNote = true, onSwipeDone, onSwipeSkip, swipeHint = true, style }) {
  const [dx, setDx] = React.useState(0);
  const sw = React.useRef(null);
  const chip = status === 'done' ? 'Выполнен' : status === 'skipped' ? 'Пропущен' : current ? 'Сейчас' : 'Не отмечен';
  const chipIcon = status === 'done' ? 'check' : status === 'skipped' ? 'skip_next' : 'play_arrow';
  const down = (e) => { if (e.target.closest('textarea,button,input')) return; sw.current = { x: e.clientX, y: e.clientY, on: false, id: e.pointerId, el: e.currentTarget }; };
  const move = (e) => {
    const s = sw.current; if (!s) return;
    const mx = e.clientX - s.x, my = e.clientY - s.y;
    if (!s.on) {
      if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.3) { s.on = true; try { s.el.setPointerCapture(s.id); } catch (_) {} }
      else { if (Math.abs(my) > 10) sw.current = null; return; }
    }
    const k = s.el.getBoundingClientRect().width / (s.el.offsetWidth || 1) || 1;
    setDx(mx / k);
  };
  const up = () => {
    const s = sw.current; sw.current = null; if (!s || !s.on) return;
    const d = dx; setDx(0);
    if (status !== 'todo') return;
    if (d > 90 && onSwipeDone) onSwipeDone(); else if (d < -90 && onSwipeSkip) onSwipeSkip();
  };
  const op = (v) => Math.min(1, Math.max(0, v / 90));
  const overline = { font: 'var(--text-overline)', letterSpacing: '.06em', textTransform: 'uppercase' };
  return (
    <div style={{ position: 'relative', background: 'var(--surface-inverse)', ...style }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', font: 'var(--weight-heavy) 15px var(--font-sans)', color: 'var(--text-on-inverse)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: op(dx) }}><Icon name="check" />Выполнено</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: op(-dx) }}>Пропустить<Icon name="skip_next" /></span>
      </div>
      <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        style={{ position: 'relative', touchAction: 'pan-y', transform: 'translateX(' + dx + 'px)', transition: dx ? 'none' : 'transform var(--dur-fast) var(--ease-standard)', background: 'var(--surface-current)', padding: '18px 16px 20px', borderBottom: '1px solid var(--border-current)' }}>
        <div style={{ ...overline, letterSpacing: 'var(--type-overline-track)', color: 'var(--status-current)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name={chipIcon} size={16} fill />{chip}{index ? ' · Этап ' + index + ' из ' + total : ''}
        </div>
        <h3 style={{ margin: '8px 0 10px', font: 'var(--text-title-m)', letterSpacing: 'var(--type-title-track)', textWrap: 'pretty' }}>{title}</h3>
        {meta ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32, padding: '4px 12px', boxSizing: 'border-box', borderRadius: 'var(--radius-chip)', background: 'var(--surface-inverse)', color: 'var(--text-on-inverse)', font: 'var(--weight-bold) 15px/1.2 var(--font-sans)' }}>
            <Icon name="repeat" size={18} />{meta}
          </span>
        ) : null}
        {description ? <p style={{ margin: '12px 0 0', font: 'var(--text-body)', textWrap: 'pretty' }}>{description}</p> : null}
        {prevNote ? (
          <div style={{ marginTop: 16, background: 'var(--surface-raised)', border: '1px solid var(--cp-orange-150)', borderRadius: 'var(--radius-control)', padding: '12px 14px' }}>
            <div style={{ ...overline, color: 'var(--text-secondary)' }}>В прошлый раз · {prevNote.date}</div>
            <p style={{ margin: '4px 0 0', font: 'var(--text-body-s)' }}>{prevNote.text}</p>
          </div>
        ) : null}
        {showNote ? <TextArea label="Моя заметка" value={note} onChange={onNoteChange} onFocus={onNoteFocus} onBlur={onNoteBlur} style={{ marginTop: 16 }} /> : null}
        {swipeHint ? (
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, font: 'var(--text-caption)', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><Icon name="arrow_back" size={18} />Пропустить</span><span>·</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>Выполнено<Icon name="arrow_forward" size={18} /></span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
