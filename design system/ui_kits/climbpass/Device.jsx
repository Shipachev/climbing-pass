function Device({ children }) {
  return (
    <div style={{ width: 390, height: 844, position: 'relative', overflow: 'hidden', borderRadius: 46, background: 'var(--surface-page)', boxShadow: 'var(--shadow-device)', display: 'flex', flexDirection: 'column', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ height: 47, flex: 'none', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 28px 8px 34px', boxSizing: 'border-box' }}>
        <span style={{ font: '600 16px/1 system-ui' }}>9:41</span>
        <span style={{ display: 'flex', gap: 3 }}><span className="cp-icon" style={{ fontSize: 18 }}>signal_cellular_alt</span><span className="cp-icon" style={{ fontSize: 18 }}>wifi</span><span className="cp-icon" style={{ fontSize: 18 }}>battery_full</span></span>
      </div>
      {children}
      <span style={{ position: 'absolute', bottom: 8, left: '50%', marginLeft: -67, width: 134, height: 5, borderRadius: 3, background: 'var(--cp-ink)', zIndex: 20 }} />
    </div>
  );
}
function ScreenTitle({ children }) {
  return <div style={{ display: 'flex', alignItems: 'center', minHeight: 56, padding: '0 6px' }}><span style={{ font: 'var(--weight-heavy) var(--type-brand-size)/1 var(--font-sans)', letterSpacing: 'var(--type-brand-track)' }}>{children}</span></div>;
}
window.Device = Device; window.ScreenTitle = ScreenTitle;
