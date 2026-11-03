function HistoryScreen({ app }) {
  const { SegmentedControl, HistoryRow, TabBar } = window.CP;
  const D = window.CP_DATA;
  const [f, setF] = React.useState('Все');
  const done = app.st.filter((s) => s === 'done').length;
  const groups = [{ month: 'Ноябрь 2026', items: [{ day: '2', month: 'ноя', title: D.program.title, score: done + '/9', status: app.finished ? 'finished' : 'active' }] }].concat(D.history);
  const keep = (r) => f === 'Все' || (f === 'Завершённые' && r.status === 'finished') || (f === 'Незавершённые' && (r.status === 'unfinished' || r.status === 'active'));
  return (
    <>
      <div style={{ flex: 'none', padding: '0 12px' }}><ScreenTitle>История</ScreenTitle><SegmentedControl options={['Все', 'Завершённые', 'Незавершённые']} value={f} onChange={setF} /></div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0 120px' }}>
        {groups.map((g) => ({ ...g, items: g.items.filter(keep) })).filter((g) => g.items.length).map((g) => (
          <div key={g.month}>
            <div style={{ padding: '18px 18px 6px', font: 'var(--text-overline)', letterSpacing: 'var(--type-overline-track)', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{g.month}</div>
            {g.items.map((r, i) => <HistoryRow key={i} {...r} style={{ padding: '10px 18px' }} onClick={r.status === 'active' ? () => app.go('workout') : undefined} />)}
          </div>
        ))}
      </div>
      <TabBar active="history" onChange={app.tab} />
    </>
  );
}
window.HistoryScreen = HistoryScreen;
