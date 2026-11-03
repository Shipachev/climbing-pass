function HomeScreen({ app }) {
  const { ActiveTrainingCard, MembershipStrip, HistoryRow, TabBar } = window.CP;
  const D = window.CP_DATA;
  const ft = app.st.indexOf('todo');
  const done = app.st.filter((s) => s === 'done').length;
  const recent = (app.finished ? [{ day: '2', month: 'ноя', title: D.program.title, score: done + '/9', status: 'finished' }] : []).concat(D.history[0].items.filter((r) => r.status === 'finished')).slice(0, 2);
  return (
    <>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 120px' }}>
        <ScreenTitle>ClimbPass</ScreenTitle>
        {app.finished || app.idle
          ? <ActiveTrainingCard variant="idle" visitMarked={app.visited} onMarkVisit={app.markVisit} onStartTraining={app.restart} style={{ marginTop: 4 }} />
          : <ActiveTrainingCard title={D.program.title} statuses={app.st} currentStep={ft >= 0 ? D.steps[ft].t : 'Все этапы отмечены'} onContinue={() => app.go('workout')} style={{ marginTop: 4 }} />}
        <MembershipStrip left={app.visits} total={8} validUntil="30 ноября" style={{ marginTop: 12 }} />
        <h3 style={{ margin: '26px 6px 4px', font: 'var(--text-title-s)', letterSpacing: '-0.01em' }}>Последние тренировки</h3>
        <div style={{ padding: '0 6px' }}>{recent.map((r, i) => <HistoryRow key={i} {...r} />)}</div>
      </div>
      <TabBar active="home" onChange={app.tab} />
    </>
  );
}
window.HomeScreen = HomeScreen;
