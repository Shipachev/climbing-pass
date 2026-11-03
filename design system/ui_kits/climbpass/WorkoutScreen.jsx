function WorkoutScreen({ app }) {
  const { TopBar, Button, Stat, ProgressSegments, SectionHeader, StepRow, StepCard, ActionBar, BottomSheet } = window.CP;
  const D = window.CP_DATA;
  const [kb, setKb] = React.useState(false);
  const scRef = React.useRef(null);
  const st = app.st, open = app.open, os = open >= 0 ? st[open] : null, ft = st.indexOf('todo');
  const done = st.filter((s) => s === 'done').length, skip = st.filter((s) => s === 'skipped').length;
  const focus = (e) => { const el = e.target; setKb(true); setTimeout(() => { const sc = scRef.current; if (!sc) return; const r = el.getBoundingClientRect(), cr = sc.getBoundingClientRect(); const d = r.bottom - cr.bottom + 291 + 84 + 16; if (d > 0) sc.scrollBy({ top: d, behavior: 'smooth' }); }, 60); };
  return (
    <>
      <div style={{ flex: 'none', padding: '0 16px 14px' }}>
        <TopBar onBack={() => app.go('tabs')} action={app.finished ? null : <Button variant="outline" size="sm" icon="flag" onClick={() => app.set({ sheet: true })}>Завершить</Button>} />
        <h1 style={{ margin: '6px 0 0', font: 'var(--weight-heavy) var(--type-title-l-size)/var(--type-title-l-lh) var(--font-sans)', letterSpacing: '-0.025em', textWrap: 'pretty' }}>{D.program.title}</h1>
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><Stat label="План" value={D.program.plan} /><Stat label="Выполнено" value={done + ' из 9'} /></div>
        <ProgressSegments statuses={st} style={{ marginTop: 12 }} />
      </div>
      <div ref={scRef} style={{ flex: 1, overflowY: 'auto', paddingBottom: kb ? 420 : 150, borderTop: '1px solid var(--border-default)' }}>
        {D.program.sections.map((title, si) => {
          const idx = D.steps.map((x, i) => (x.s === si ? i : -1)).filter((i) => i >= 0);
          return (
            <div key={si}>
              <SectionHeader title={title} count={idx.filter((i) => st[i] === 'done').length + '/' + idx.length} />
              {idx.map((i) => {
                const x = D.steps[i];
                return i === open
                  ? <StepCard key={i} index={i + 1} total={9} title={x.t} meta={x.m} description={x.d} status={st[i]} current={i === ft}
                      prevNote={x.prev} showNote={x.s === 1} note={app.notes[i] || ''} onNoteChange={(e) => app.note(i, e.target.value)}
                      onNoteFocus={focus} onNoteBlur={() => setKb(false)} onSwipeDone={() => app.mark('done')} onSwipeSkip={() => app.mark('skipped')} />
                  : <StepRow key={i} index={i + 1} title={x.t} meta={x.m} status={st[i]} onClick={() => app.set({ open: i })} />;
              })}
            </div>
          );
        })}
      </div>
      <ActionBar keyboardOffset={kb ? 291 : 0}>
        {app.finished ? (<><span style={{ flex: 1, font: 'var(--weight-heavy) 15px/1.3 var(--font-sans)' }}>Тренировка завершена · {done} из 9</span><Button variant="secondary" size="sm" onClick={app.restart}>Сбросить демо</Button></>)
          : os === 'todo' ? (<><Button variant="secondary" size="lg" icon="skip_next" fullWidth onClick={() => app.mark('skipped')}>Пропустить</Button><Button size="lg" icon="check" fullWidth onClick={() => app.mark('done')}>Выполнено</Button></>)
          : os ? (<><Button variant="secondary" size="lg" icon="undo" fullWidth onClick={app.unmark}>Снять отметку</Button><Button variant="strong" size="lg" fullWidth onClick={() => (ft >= 0 ? app.set({ open: ft }) : app.set({ sheet: true }))}>{ft >= 0 ? 'Следующий этап' : 'Завершить тренировку'}</Button></>)
          : <Button size="lg" icon="flag" fullWidth onClick={() => app.set({ sheet: true })}>Завершить тренировку</Button>}
      </ActionBar>
      {kb ? <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 291, background: '#D1D3D9', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '12px var(--font-mono)', color: '#5d6068' }}>экранная клавиатура</div> : null}
      <BottomSheet open={app.sheet} title="Завершить тренировку?" onClose={() => app.set({ sheet: false })}
        description={'Выполнено ' + done + ' из 9' + (skip ? ', пропущено ' + skip : '') + '. Тренировка сохранится в истории.'}>
        <Button size="lg" fullWidth onClick={() => app.set({ finished: true, sheet: false })}>Завершить</Button>
        <Button variant="secondary" fullWidth onClick={() => app.set({ sheet: false })}>Вернуться к тренировке</Button>
      </BottomSheet>
    </>
  );
}
window.WorkoutScreen = WorkoutScreen;
