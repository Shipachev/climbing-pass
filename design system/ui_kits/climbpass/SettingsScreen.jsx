function SettingsScreen({ app }) {
  const { Button, TabBar, BottomSheet, TextField, Icon } = window.CP;
  const [sheet, setSheet] = React.useState(false);
  const [pick, setPick] = React.useState(8);
  const over = { padding: '24px 6px 6px', font: 'var(--text-overline)', letterSpacing: 'var(--type-overline-track)', textTransform: 'uppercase', color: 'var(--text-secondary)' };
  const row = { display: 'flex', alignItems: 'center', gap: 14, minHeight: 60, padding: '10px 16px', width: '100%', boxSizing: 'border-box', border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left', font: 'var(--weight-bold) 16px var(--font-sans)', color: 'var(--text-primary)' };
  return (
    <>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 120px' }}>
        <ScreenTitle>Настройки</ScreenTitle>
        <div style={{ ...over, paddingTop: 18 }}>Абонемент</div>
        <div style={{ border: '1px solid var(--border-card)', borderRadius: 'var(--radius-card)', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span style={{ font: 'var(--text-title-s)' }}>8 посещений</span><span style={{ font: 'var(--text-caption)', color: 'var(--text-secondary)' }}>с 1 ноября</span></div>
          <div style={{ display: 'flex', gap: 4, margin: '14px 0 10px' }}>{Array.from({ length: 8 }, (_, i) => <span key={i} style={{ flex: 1, height: 10, borderRadius: 2, background: i < 8 - app.visits ? 'var(--cp-gray-300)' : 'var(--cp-ink)' }} />)}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', font: 'var(--weight-semibold) 14px/1.3 var(--font-sans)' }}><span>Осталось {app.visits} из 8 посещений</span><span style={{ color: 'var(--text-secondary)' }}>до 30 ноября</span></div>
          <Button variant="secondary" icon="add_card" fullWidth onClick={() => setSheet(true)} style={{ marginTop: 14, minHeight: 52 }}>Новый абонемент</Button>
        </div>
        <div style={over}>Данные</div>
        <div style={{ border: '1px solid var(--border-card)', borderRadius: 'var(--radius-card)' }}>
          <div style={{ ...row, cursor: 'default', borderBottom: '1px solid var(--cp-gray-175)' }}><Icon name="cloud_off" color="var(--text-positive)" /><div><div>Работает офлайн</div><div style={{ font: 'var(--weight-medium) 13px/1.35 var(--font-sans)', color: 'var(--text-secondary)', marginTop: 2 }}>Все данные хранятся на этом устройстве</div></div></div>
          <button style={{ ...row, borderBottom: '1px solid var(--cp-gray-175)' }}><Icon name="download" /><span style={{ flex: 1 }}>Сохранить резервную копию</span><Icon name="chevron_right" color="var(--cp-gray-400)" /></button>
          <button style={row}><Icon name="upload" /><span style={{ flex: 1 }}>Восстановить из копии</span><Icon name="chevron_right" color="var(--cp-gray-400)" /></button>
        </div>
        <Button variant="danger" icon="delete" fullWidth style={{ marginTop: 24 }}>Удалить все данные</Button>
      </div>
      <TabBar active="settings" onChange={app.tab} />
      <BottomSheet open={sheet} title="Новый абонемент" description="Заменит текущий. Оставшиеся посещения текущего абонемента не переносятся." onClose={() => setSheet(false)}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {[1, 4, 8].map((n) => <button key={n} onClick={() => setPick(n)} style={{ minHeight: 64, borderRadius: 12, cursor: 'pointer', border: '2px solid ' + (n === pick ? 'var(--cp-ink)' : 'var(--cp-gray-275)'), background: n === pick ? 'var(--surface-current)' : '#fff', font: 'var(--weight-heavy) 26px var(--font-sans)' }}>{n}</button>)}
        </div>
        <TextField label="Действует до" value="2 декабря 2026" readOnly style={{ marginTop: 8 }} />
        <Button size="lg" fullWidth onClick={() => { app.set({ visits: pick }); setSheet(false); }} style={{ marginTop: 12 }}>Оформить</Button>
        <Button variant="secondary" fullWidth onClick={() => setSheet(false)}>Отмена</Button>
      </BottomSheet>
    </>
  );
}
window.SettingsScreen = SettingsScreen;
