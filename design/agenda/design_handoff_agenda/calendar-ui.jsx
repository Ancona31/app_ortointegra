/* Shared UI atoms for the agenda prototype — icons, avatar, status badge,
   doctor chip. Exposed on window for the other Babel scripts. */

// Lucide-ish stroke icons. 1.7 stroke, currentColor.
function Icon({ name, size = 16, stroke = 1.7, style, className }) {
  const P = {
    chevL: <polyline points="15 18 9 12 15 6" />,
    chevR: <polyline points="9 18 15 12 9 6" />,
    chevDown: <polyline points="6 9 12 15 18 9" />,
    plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
    calendar: <><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="8" y1="2.5" x2="8" y2="6" /><line x1="16" y1="2.5" x2="16" y2="6" /></>,
    check: <polyline points="20 6 9 17 4 12" />,
    checkCircle: <><circle cx="12" cy="12" r="9" /><polyline points="16 9.5 11 14.5 8 11.5" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><polyline points="12 7.5 12 12 15 13.5" /></>,
    wait: <><circle cx="12" cy="12" r="9" /><polyline points="12 7.5 12 12 15 13.5" /></>,
    done: <><circle cx="12" cy="12" r="9" /><polyline points="16 9.5 11 14.5 8 11.5" /></>,
    noshow: <><circle cx="12" cy="12" r="9" /><line x1="8.5" y1="15.5" x2="15.5" y2="8.5" /></>,
    x: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
    star: <polygon points="12 3 14.5 8.7 20.5 9.3 16 13.4 17.4 19.3 12 16.1 6.6 19.3 8 13.4 3.5 9.3 9.5 8.7" />,
    repeat: <><polyline points="17 2 21 6 17 10" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 22 3 18 7 14" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></>,
    pulse: <polyline points="3 12 7 12 10 5 14 19 17 12 21 12" />,
    syringe: <><path d="m18 2 4 4" /><path d="m17 7 3-3" /><path d="M19 9 8.7 19.3c-1 1-2 1-3 0l-1-1c-1-1-1-2 0-3L15 5" /><path d="m9 11 4 4" /><path d="m5 19-3 3" /><path d="m14 4 6 6" /></>,
    bandage: <><rect x="2.5" y="7" width="19" height="10" rx="5" transform="rotate(-45 12 12)" /><circle cx="12" cy="12" r="0.6" /><circle cx="9.5" cy="9.5" r="0.6" /><circle cx="14.5" cy="14.5" r="0.6" /></>,
    alert: <><path d="M10.3 4.3 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" /><line x1="12" y1="9.5" x2="12" y2="13.5" /><line x1="12" y1="17" x2="12" y2="17" /></>,
    lock: <><rect x="4.5" y="11" width="15" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
    gear: <><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 7 2.6h.1A1.6 1.6 0 0 0 8.6 1V1a2 2 0 1 1 4 0v.1A1.6 1.6 0 0 0 15 2.6a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V7a1.6 1.6 0 0 0 1.5 1H23a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" transform="translate(0.5 0.5) scale(0.92)" /></>,
    phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.1-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2Z" />,
    search: <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></>,
    filter: <polygon points="22 3 2 3 10 12.5 10 19 14 21 14 12.5" />,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 20.5a8 8 0 0 1 16 0" /></>,
    users: <><circle cx="9" cy="8" r="3.6" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.6 3.6 0 0 1 0 7" /><path d="M18 20a6.5 6.5 0 0 0-3-5.5" /></>,
    ellipsis: <><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    columns: <><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="9" y1="4" x2="9" y2="20" /><line x1="15" y1="4" x2="15" y2="20" /></>,
    note: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="14 3 14 9 20 9" /></>,
    edit: <><path d="M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6" /><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z" /></>,
    drag: <><circle cx="9" cy="6" r="1.3" /><circle cx="9" cy="12" r="1.3" /><circle cx="9" cy="18" r="1.3" /><circle cx="15" cy="6" r="1.3" /><circle cx="15" cy="12" r="1.3" /><circle cx="15" cy="18" r="1.3" /></>,
    home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" /><path d="M9.5 21v-6h5v6" /></>,
    stethoscope: <><path d="M5 3v5a4 4 0 0 0 8 0V3" /><path d="M5 3H3.5M13 3h1.5" /><path d="M9 16v1a5 5 0 0 0 10 0v-2" /><circle cx="19" cy="13" r="2" /></>,
    calc: <><rect x="5" y="2.5" width="14" height="19" rx="2.5" /><line x1="8" y1="7" x2="16" y2="7" /><line x1="8.5" y1="12" x2="8.5" y2="12" /><line x1="12" y1="12" x2="12" y2="12" /><line x1="15.5" y1="12" x2="15.5" y2="12" /><line x1="8.5" y1="16" x2="8.5" y2="16" /><line x1="12" y1="16" x2="12" y2="16" /><line x1="15.5" y1="16" x2="15.5" y2="16" /></>,
    chart: <><line x1="4" y1="20" x2="20" y2="20" /><rect x="6" y="11" width="3" height="6" rx="1" /><rect x="11" y="7" width="3" height="10" rx="1" /><rect x="16" y="13" width="3" height="4" rx="1" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.2-2.5 3.9" /><line x1="12" y1="17" x2="12" y2="17" /></>,
    power: <><path d="M18.4 7A8 8 0 1 1 5.6 7" /><line x1="12" y1="3" x2="12" y2="11" /></>,
    moon: <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8Z" />,
    sun: <><circle cx="12" cy="12" r="4.2" /><line x1="12" y1="2.5" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="21.5" /><line x1="2.5" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="21.5" y2="12" /><line x1="5.2" y1="5.2" x2="6.9" y2="6.9" /><line x1="17.1" y1="17.1" x2="18.8" y2="18.8" /><line x1="5.2" y1="18.8" x2="6.9" y2="17.1" /><line x1="17.1" y1="6.9" x2="18.8" y2="5.2" /></>,
    wifiOff: <><line x1="2" y1="2" x2="22" y2="22" /><path d="M8.5 16.5a5 5 0 0 1 7 0" /><path d="M5 12.9a10 10 0 0 1 3.5-2.2M19 12.9a10 10 0 0 0-4-2.6" /><path d="M2 8.8a16 16 0 0 1 4.5-2.9M22 8.8a16 16 0 0 0-9.5-3.4" /><line x1="12" y1="20" x2="12" y2="20" /></>,
    spine: <><path d="M12 2.5c-1.6 0-1.6 2-3 2.6M12 2.5c1.6 0 1.6 2 3 2.6M12 7c-1.6 0-1.6 2-3 2.6M12 7c1.6 0 1.6 2 3 2.6M12 11.5c-1.6 0-1.6 2-3 2.6M12 11.5c1.6 0 1.6 2 3 2.6M12 16c-1.6 0-1.6 2-3 2.6M12 16c1.6 0 1.6 2 3 2.6" /><line x1="12" y1="2.5" x2="12" y2="21" /></>,
    chevDownSm: <polyline points="6 9 12 15 18 9" />,
    palette: <><path d="M12 3a9 9 0 1 0 0 18c1.4 0 2.2-1 2.2-2 0-.6-.3-1-.6-1.4-.3-.4-.5-.7-.5-1.1 0-.8.7-1.5 1.5-1.5H17a4 4 0 0 0 4-4c0-3.9-4-7-9-7Z" /><circle cx="7.5" cy="11.5" r="1" /><circle cx="11" cy="7.5" r="1" /><circle cx="16" cy="8.5" r="1" /></>,
    list: <><line x1="8" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="8" y1="18" x2="20" y2="18" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>,
    trash: <><polyline points="3 6 21 6" /><path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6" /><path d="M5.5 6 6.5 20a1.5 1.5 0 0 0 1.5 1.4h8a1.5 1.5 0 0 0 1.5-1.4L18.5 6" /></>,
  };
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={style} aria-hidden="true">
      {P[name] || null}
    </svg>
  );
}

// Google "G" mark (multicolor) for synced events
function GoogleMark({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block' }}>
      <path fill="#4285F4" d="M22.5 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2-1.9 3.3-4.7 3.3-7.9z" />
      <path fill="#34A853" d="M12 23c3 0 5.4-1 7.2-2.7l-3.5-2.7c-1 .6-2.2 1-3.7 1-2.8 0-5.2-1.9-6.1-4.5H2.3v2.8A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.9 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.3a11 11 0 0 0 0 9.8l3.6-2.8z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.1 1.6l3.1-3.1A11 11 0 0 0 2.3 7.1l3.6 2.8C6.8 7.3 9.2 5.4 12 5.4z" />
    </svg>
  );
}

// Patient avatar — soft tinted circle with initials.
function Avatar({ name, color = '#2f6fed', size = 26, ring = false }) {
  const init = window.CAL.initials(name || '?');
  const ringC = window.SURF ? window.SURF().card : '#fff';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flex: '0 0 auto',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: color, color: '#fff', fontWeight: 700,
      fontSize: size * 0.4, letterSpacing: '.01em',
      boxShadow: ring ? `0 0 0 2.5px ${ringC}, 0 1px 3px rgba(16,32,64,.18)` : 'none',
    }}>{init}</div>
  );
}

// Status dot + label badge
function StatusBadge({ status, compact = false }) {
  const sDef = window.CAL.statuses[status];
  if (!sDef) return null;
  const s = window.stTok ? window.stTok(status) : sDef;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
      borderRadius: 999, padding: compact ? '1px 7px 1px 6px' : '3px 9px 3px 7px',
      fontSize: compact ? 10.5 : 12, fontWeight: 600, lineHeight: 1.3, whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', background: s.dot,
        boxShadow: sDef.pulse ? `0 0 0 0 ${s.dot}` : 'none',
        animation: sDef.pulse ? 'calPulse 1.8s infinite' : 'none', flex: '0 0 auto',
      }} />
      {compact ? sDef.short : sDef.label}
    </span>
  );
}

const typeIconMap = {
  primera: 'star', seguimiento: 'repeat', postquirurgico: 'bandage',
  control: 'pulse', infiltracion: 'syringe', urgencia: 'alert',
};

Object.assign(window, { Icon, GoogleMark, Avatar, StatusBadge, typeIconMap });
