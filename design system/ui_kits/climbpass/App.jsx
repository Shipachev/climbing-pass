function App() {
  const fresh = () => ({ st: ['done', 'done', 'done', 'done', 'todo', 'todo', 'todo', 'todo', 'todo'], open: 4, notes: { 4: 'Все серии выполнены, работа ног стала точнее' }, finished: false, sheet: false, idle: false, visited: false, visits: 5 });
  const [s, setS] = React.useState(fresh);
  const [route, setRoute] = React.useState('tabs');
  const [tab, setTab] = React.useState('home');
  const set = (p) => setS((o) => ({ ...o, ...p }));
  const app = {
    ...s, set, go: setRoute, tab: (t) => { setTab(t); setRoute('tabs'); },
    mark: (k) => setS((o) => { if (o.open < 0) return o; const st = o.st.slice(); st[o.open] = k; let n = st.indexOf('todo', o.open + 1); if (n < 0) n = st.indexOf('todo'); return { ...o, st, open: n }; }),
    unmark: () => setS((o) => { const st = o.st.slice(); st[o.open] = 'todo'; return { ...o, st }; }),
    note: (i, v) => setS((o) => ({ ...o, notes: { ...o.notes, [i]: v } })),
    markVisit: () => setS((o) => (o.visited ? o : { ...o, visited: true, visits: o.visits - 1 })),
    restart: () => { setS(fresh()); setRoute('tabs'); setTab('home'); },
  };
  let screen;
  if (route === 'workout') screen = <WorkoutScreen app={app} />;
  else if (route === 'editor') screen = <EditorScreen app={app} />;
  else if (tab === 'programs') screen = <ProgramsScreen app={app} />;
  else if (tab === 'history') screen = <HistoryScreen app={app} />;
  else if (tab === 'settings') screen = <SettingsScreen app={app} />;
  else screen = <HomeScreen app={app} />;
  return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, boxSizing: 'border-box', background: '#ECEAE5' }}><Device>{screen}</Device></div>;
}
window.App = App;
