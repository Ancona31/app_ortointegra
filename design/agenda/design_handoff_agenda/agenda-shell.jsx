/* App shell — navy sidebar + page header, matching the live app. */

function Sidebar({ dark, onToggleDark }) {
  const B = window.brand();
  const items = [
    { ic: 'home', label: 'Dashboard' },
    { ic: 'stethoscope', label: 'Pacientes', chev: true },
    { ic: 'calendar', label: 'Agenda', active: true },
    { ic: 'calc', label: 'Calculadoras' },
    { ic: 'note', label: 'Documentos', chev: true },
    { ic: 'chart', label: 'Administración', chev: true },
  ];
  const sub = [
    { ic: 'user', label: 'Mi perfil' },
    { ic: 'help', label: 'Ayuda' },
    { ic: 'wifiOff', label: 'Modo Offline', dot: true },
  ];
  const row = (it) => (
    <button key={it.label} style={{
      display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
      border: 'none', cursor: 'pointer', font: 'inherit', borderRadius: 12, padding: '11px 14px',
      background: it.active ? '#fff' : 'transparent',
      color: it.active ? B.primary : 'rgba(233,240,250,.82)',
      fontSize: 14, fontWeight: it.active ? 700 : 600,
      boxShadow: it.active ? '0 4px 14px rgba(5,18,40,.28)' : 'none',
    }}>
      <Icon name={it.ic} size={19} stroke={it.active ? 1.9 : 1.7} />
      <span style={{ flex: 1 }}>{it.label}</span>
      {it.dot && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399' }} />}
      {it.chev && <Icon name="chevR" size={15} style={{ opacity: .6 }} />}
    </button>
  );
  return (
    <aside style={{
      width: 264, flex: '0 0 auto', alignSelf: 'stretch', display: 'flex', flexDirection: 'column',
      background: window.brand().sidebar,
      color: '#fff', padding: '22px 16px 16px', gap: 4, borderRadius: '0 22px 22px 0',
    }}>
      {/* brand */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, padding: '4px 0 18px' }}>
        <div style={{ width: 78, height: 78, borderRadius: '50%', background: 'radial-gradient(circle at 50% 35%,#e9f1fb,#b9cbe4)',
          display: 'grid', placeItems: 'center', boxShadow: '0 6px 18px rgba(5,18,40,.35), inset 0 0 0 3px rgba(255,255,255,.5)', color: '#1c4a86' }}>
          <Icon name="spine" size={38} stroke={1.7} />
        </div>
        <div style={{ textAlign: 'center', maxWidth: 220 }}>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.01em', lineHeight: 1.2 }}>Angel M. Ancona Pérez</div>
          <div style={{ fontSize: 11.5, color: 'rgba(206,221,242,.72)', marginTop: 5, lineHeight: 1.4 }}>Cirugía de Columna · Ortopedia y Traumatología</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{items.map(row)}</div>
      <div style={{ height: 1, background: 'rgba(255,255,255,.12)', margin: '14px 6px' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{sub.map(row)}</div>
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 12 }}>
        <button onClick={onToggleDark} style={footBtn}><Icon name={dark ? 'sun' : 'moon'} size={18} /><span>{dark ? 'Modo claro' : 'Modo oscuro'}</span></button>
        <button style={footBtn}><Icon name="power" size={18} /><span>Cerrar sesión</span></button>
      </div>
    </aside>
  );
}
const footBtn = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
  border: 'none', cursor: 'pointer', font: 'inherit', borderRadius: 12, padding: '10px 14px',
  background: 'transparent', color: 'rgba(206,221,242,.65)', fontSize: 13.5, fontWeight: 600 };

function PageHeader() {
  const C = window.CAL;
  const T = window.SURF();
  return (
    <div style={{ padding: '22px 30px 0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: '-.02em', color: T.ink }}>Agenda</h1>
          <p style={{ margin: '3px 0 0', fontSize: 14, color: T.muted, fontWeight: 500 }}>Gestión de citas clínicas</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {Object.values(C.doctors).map(d => (
            <span key={d.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: `conic-gradient(${window.docTok(d).color} 0 60%, ${window.docTok(d).soft} 0)` }} />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: T.text }}>{d.short}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Sidebar, PageHeader });
