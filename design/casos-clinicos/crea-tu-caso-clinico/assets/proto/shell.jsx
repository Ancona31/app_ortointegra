/* Spinus — App Shell (sidebar idéntico al dashboard de producción) */
(function () {
  const { useState } = React;
  const I = window.Icons;

  const NAV = [
    { id: "dashboard", label: "Dashboard", icon: "Home" },
    { id: "pacientes", label: "Pacientes", icon: "Stethoscope", chev: true },
    { id: "agenda", label: "Agenda", icon: "Calendar" },
    { id: "calculadoras", label: "Calculadoras", icon: "Calculator" },
    { id: "documentos", label: "Documentos", icon: "FileText", chev: true },
    { id: "casos", label: "Crea tu caso clínico", icon: "Layers", isNew: true },
    { id: "admin", label: "Administración", icon: "Chart", chev: true },
  ];
  const NAV2 = [
    { id: "perfil", label: "Mi perfil", icon: "UserCircle" },
    { id: "ayuda", label: "Ayuda", icon: "Help" },
    { id: "offline", label: "Modo Offline", icon: "WifiOff", dot: true },
  ];

  function SideItem({ item, active, onClick }) {
    const Ico = I[item.icon];
    return (
      <button className={"side-item" + (active ? " active" : "")} onClick={onClick}>
        <span className="side-ico"><Ico size={20} /></span>
        <span className="side-label">{item.label}</span>
        {item.isNew && <span className="side-new">NUEVO</span>}
        {item.dot && <span className="side-dot" />}
        {item.chev && <span className="side-chev"><I.ChevronRight size={16} /></span>}
      </button>
    );
  }

  function Sidebar({ active, go, onClose }) {
    const d = window.SpinusData.doctor;
    return (
      <aside className="sidebar">
        <div className="side-brand">
          <div className="side-logo">
            <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
              <defs><radialGradient id="lg" cx="50%" cy="35%" r="75%">
                <stop offset="0%" stopColor="#cfe0f2"/><stop offset="100%" stopColor="#1a3a5c"/>
              </radialGradient></defs>
              <circle cx="24" cy="24" r="23" fill="url(#lg)"/>
              <g stroke="#16365a" strokeWidth="2" strokeLinecap="round" fill="none">
                <path d="M24 9v30"/>
                <path d="M18 14h12M17 19h14M16.5 24h15M17 29h14M18 34h12"/>
              </g>
            </svg>
          </div>
          <div className="side-name">{d.name}</div>
          <div className="side-spec">{d.specialty}</div>
          {onClose && <button className="side-close" onClick={onClose}><I.ChevronLeft size={20}/></button>}
        </div>

        <nav className="side-nav">
          {NAV.map((it) => (
            <SideItem key={it.id} item={it} active={active === it.id}
              onClick={() => go(it.id)} />
          ))}
        </nav>

        <div className="side-divider" />
        <nav className="side-nav">
          {NAV2.map((it) => <SideItem key={it.id} item={it} active={false} onClick={() => {}} />)}
        </nav>

        <div className="side-foot">
          <button className="side-foot-item"><I.Moon size={18}/> Modo oscuro</button>
          <button className="side-foot-item"><I.LogOut size={18}/> Cerrar sesión</button>
          <div className="side-foot-legal"><I.Lock size={13}/> Aviso de Privacidad</div>
        </div>
      </aside>
    );
  }

  function Shell({ active = "casos", children, onNav }) {
    const [openMobile, setOpenMobile] = useState(false);
    const go = (id) => { setOpenMobile(false); onNav && onNav(id); };
    return (
      <div className="shell">
        <div className={"shell-side" + (openMobile ? " open" : "")}>
          <Sidebar active={active} go={go} onClose={openMobile ? () => setOpenMobile(false) : null} />
        </div>
        {openMobile && <div className="shell-scrim" onClick={() => setOpenMobile(false)} />}

        <main className="shell-main">
          <header className="mobile-bar">
            <button className="mb-menu" onClick={() => setOpenMobile(true)}>
              <span/><span/><span/>
            </button>
            <span className="mb-title"><I.Layers size={18}/> Crea tu caso clínico</span>
            <span className="mb-spacer" />
          </header>
          {children}
        </main>
      </div>
    );
  }

  window.Shell = Shell;
})();
