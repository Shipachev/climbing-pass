function ProgramCard({ over, overAccent, title, minutes, primary, primaryDisabled, onPrimary, onEdit, note }) {
  const { Button } = window.CP;
  const big = { font: 'var(--weight-heavy) 20px/1 var(--font-sans)' }, cap = { font: 'var(--weight-semibold) 12px/1.3 var(--font-sans)', color: 'var(--text-secondary)', marginTop: 3 };
  return (
    <div style={{ border: '1px solid var(--border-card)', borderRadius: 'var(--radius-card)', overflow: 'hidden', marginTop: 12 }}>
      <div style={{ padding: '18px 16px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: 'var(--text-overline)', letterSpacing: 'var(--type-overline-track)', textTransform: 'uppercase', color: overAccent ? 'var(--text-accent-strong)' : 'var(--text-secondary)' }}>
          {overAccent ? <span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--action-primary)' }} /> : null}{over}</div>
        <h2 style={{ margin: '10px 0 0', font: 'var(--text-title-m)', letterSpacing: 'var(--type-title-track)' }}>{title}</h2>
        <div style={{ marginTop: 12, display: 'flex', gap: 20 }}>
          <div><div style={big}>{minutes}</div><div style={cap}>минут</div></div><div><div style={big}>3</div><div style={cap}>раздела</div></div><div><div style={big}>9</div><div style={cap}>этапов</div></div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '0 16px 16px' }}>
        <Button size="md" icon="play_arrow" iconFill={!primaryDisabled} fullWidth disabled={primaryDisabled} onClick={onPrimary} style={{ minHeight: 52 }}>{primary}</Button>
        <Button variant="secondary" icon="edit" onClick={onEdit} style={{ minHeight: 52 }}>Изменить</Button>
      </div>
      {note ? <div style={{ display: 'flex', gap: 8, padding: '12px 16px', background: 'var(--surface-subtle)', borderTop: '1px solid var(--cp-gray-175)', font: 'var(--weight-medium) 13px/1.4 var(--font-sans)', color: 'var(--text-secondary)' }}><span className="cp-icon" style={{ fontSize: 18 }}>info</span>{note}</div> : null}
    </div>
  );
}
function ProgramsScreen({ app }) {
  const { TabBar } = window.CP;
  const done = app.st.filter((s) => s === 'done').length;
  const active = !app.finished && !app.idle;
  return (
    <>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 120px' }}>
        <ScreenTitle>Программы</ScreenTitle>
        <p style={{ margin: '0 6px 4px', font: 'var(--text-body-s)', color: 'var(--text-secondary)' }}>Две программы. Изменения применяются к следующим тренировкам.</p>
        <ProgramCard over={active ? 'Идёт · ' + done + ' из 9' : 'Последняя · 2 ноября'} overAccent={active} title="Техника и выносливость" minutes="90" primary={active ? 'Продолжить' : 'Начать'} onPrimary={() => (active ? app.go('workout') : app.restart())} onEdit={() => app.go('editor')} />
        <ProgramCard over="Последняя · 31 октября" title="Сила и техника" minutes="80" primary="Начать" primaryDisabled={active} note={active ? 'Начать можно после завершения текущей тренировки.' : null} onEdit={() => app.go('editor')} />
      </div>
      <TabBar active="programs" onChange={app.tab} />
    </>
  );
}
function EditorScreen({ app }) {
  const { TopBar, TextField, SectionHeader, IconButton, Button, ActionBar, Icon } = window.CP;
  const D = window.CP_DATA;
  return (
    <>
      <div style={{ flex: 'none', padding: '0 16px', borderBottom: '1px solid var(--border-default)' }}><TopBar onBack={() => app.go('tabs')} backIcon="close" backLabel="Закрыть" title="Программа" /></div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0 130px' }}>
        <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 104px', gap: 10 }}>
          <TextField label="Название" value={D.program.title} readOnly emphasis /><TextField label="План, мин" value="90" readOnly inputMode="numeric" />
        </div>
        {D.program.sections.map((title, si) => (
          <div key={si} style={{ marginTop: 20 }}>
            <SectionHeader title={title} action={<IconButton icon="more_horiz" label="Действия с разделом" size={40} iconSize={20} />} />
            {D.steps.filter((x) => x.s === si).map((x, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 60, padding: '6px 4px 6px 8px', borderBottom: '1px solid var(--border-row)' }}>
                <Icon name="drag_indicator" color="var(--cp-gray-400)" style={{ width: 32, textAlign: 'center' }} />
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ font: 'var(--text-row)' }}>{x.t}</div><div style={{ font: 'var(--weight-medium) 13px/1.3 var(--font-sans)', color: 'var(--text-secondary)', marginTop: 2 }}>{x.m}</div></div>
                <IconButton icon="edit" label="Изменить этап" iconSize={20} />
              </div>
            ))}
            <Button variant="ghost" icon="add" style={{ color: 'var(--text-accent)', minHeight: 52, padding: '0 16px', fontSize: 15 }}>Добавить этап</Button>
          </div>
        ))}
      </div>
      <ActionBar><Button variant="secondary" fullWidth onClick={() => app.go('tabs')}>Отмена</Button><Button icon="check" fullWidth onClick={() => app.go('tabs')} style={{ flex: 1.4 }}>Сохранить</Button></ActionBar>
    </>
  );
}
window.ProgramsScreen = ProgramsScreen; window.EditorScreen = EditorScreen;
