/* WeekCalendar — the agenda week view, parametrised by `variant`:
   'clean' | 'soft' | 'pro'.  Renders header toolbar, doctor/status legend,
   time grid, clinic appointment cards + Google-synced events, a "now" line,
   click-to-open detail panel and click-empty quick-create hint. */

const { useState, useRef } = React;

const HOUR = 58;          // px per hour row
const GUTTER = 58;        // time gutter width

// one-time keyframes / helpers
if (!document.getElementById('cal-anim')) {
  const s = document.createElement('style');
  s.id = 'cal-anim';
  s.textContent = `
    @keyframes calPulse{0%{box-shadow:0 0 0 0 rgba(234,140,11,.55)}70%{box-shadow:0 0 0 6px rgba(234,140,11,0)}100%{box-shadow:0 0 0 0 rgba(234,140,11,0)}}
    @keyframes calPanelIn{from{transform:translateX(14px);opacity:0}to{transform:translateX(0);opacity:1}}
    @keyframes calFade{from{opacity:0}to{opacity:1}}
    .cal-ev{transition:box-shadow .15s,transform .12s,filter .15s}
    .cal-ev:hover{transform:translateY(-1px);z-index:30 !important}
    .cal-cell-hit:hover .cal-plus{opacity:1}
  `;
  document.head.appendChild(s);
}

// ---- Event card -------------------------------------------------------
function EventCard({ a, variant, onClick, h }) {
  const C = window.CAL;
  const px = h != null ? h : (a.dur / 60 * HOUR);
  const tiny = px < 38;          // name only
  const compact = px < 56;       // single row, no meta
  const isExt = a.source === 'gcal';
  const doc = C.doctors[a.doctor];
  const st = C.statuses[a.status];
  const ty = C.types[a.type];
  const timeStr = `${a.start} – ${C.endLabel(a)}`;
  const T = window.SURF ? window.SURF() : { card: '#fff', cardBorder: '#e7ecf3', cardShadow: '0 1px 2px rgba(16,32,64,.05)', ink: '#16243d', muted: '#7c8aa0', muted2: '#9aa6b8' };
  const dt = (!isExt && doc) ? (window.docTok ? window.docTok(doc) : { color: doc.color, soft: doc.soft }) : null;
  const sk = (!isExt && st) ? (window.stTok ? window.stTok(a.status) : { dot: st.dot, text: st.text, bg: st.bg, border: st.border }) : null;

  // ----- Google Calendar synced event (all variants share this) -----
  if (isExt) {
    const x = window.extTok ? window.extTok() : C.external;
    const stripe = window.__dark ? 'rgba(255,255,255,.04)' : '#efe9fb';
    return (
      <button onClick={onClick} className="cal-ev" style={{
        position: 'absolute', inset: 0, textAlign: 'left', cursor: 'pointer',
        background: `repeating-linear-gradient(135deg, ${x.bg}, ${x.bg} 8px, ${stripe} 8px, ${stripe} 9px)`,
        border: `1px dashed ${x.border}`, borderLeft: `3px solid ${x.dot}`,
        borderRadius: 9, padding: tiny ? '3px 8px' : '5px 9px',
        display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden',
        font: 'inherit', color: x.text, justifyContent: tiny ? 'center' : 'flex-start',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <GoogleMark size={12} />
          <Icon name="lock" size={11} />
          <span style={{ fontSize: 10.5, fontWeight: 600, opacity: .85 }}>{a.start}</span>
        </div>
        {!tiny && (
          <div style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.2, overflow: 'hidden',
            display: '-webkit-box', WebkitLineClamp: compact ? 1 : 2, WebkitBoxOrient: 'vertical' }}>
            {a.title}
          </div>
        )}
      </button>
    );
  }

  const ink = '#16243d';

  // ----- Variant A · Clínico limpio -----
  if (variant === 'clean') {
    return (
      <button onClick={onClick} className="cal-ev" style={{
        position: 'absolute', inset: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit',
        background: T.card, border: `1px solid ${T.cardBorder}`, borderLeft: `3.5px solid ${dt.color}`,
        borderRadius: 9, padding: tiny ? '2px 8px' : '5px 9px', overflow: 'hidden',
        boxShadow: T.cardShadow,
        display: 'flex', flexDirection: 'column', gap: tiny ? 0 : 2, justifyContent: tiny ? 'center' : 'flex-start',
        opacity: a.status === 'cancelada' ? .62 : 1,
      }}>
        {!tiny && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: T.muted }}>{compact ? a.start : timeStr}</span>
            <span style={{ fontSize: 9, fontWeight: 800, color: dt.color, background: dt.soft,
              borderRadius: 5, padding: '1px 5px', letterSpacing: '.02em' }}>{doc.code}</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {tiny && <span style={{ width: 6, height: 6, borderRadius: '50%', background: sk.dot, flex: '0 0 auto' }} />}
          <span style={{ fontSize: 12, fontWeight: 700, color: T.ink, lineHeight: 1.2,
            textDecoration: st.strike ? 'line-through' : 'none', whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.patient}</span>
        </div>
        {!compact && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 'auto' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: sk.dot, flex: '0 0 auto' }} />
            <span style={{ fontSize: 10.5, fontWeight: 600, color: sk.text }}>{st.short}</span>
            <span style={{ fontSize: 10.5, color: T.muted2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>· {ty.label}</span>
          </div>
        )}
      </button>
    );
  }

  // ----- Variant B · Suave moderno -----
  if (variant === 'soft') {
    return (
      <button onClick={onClick} className="cal-ev" style={{
        position: 'absolute', inset: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit',
        background: st.bg, border: `1px solid ${st.border}`,
        borderRadius: 12, padding: tiny ? '3px 8px' : '6px 9px', overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(16,32,64,.04)',
        display: 'flex', flexDirection: 'column', gap: 3, justifyContent: tiny ? 'center' : 'flex-start',
        opacity: a.status === 'cancelada' ? .66 : 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Avatar name={a.patient} color={doc.color} size={tiny ? 17 : 22} ring />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: ink, lineHeight: 1.15,
              textDecoration: st.strike ? 'line-through' : 'none', whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.patient}</div>
            {!compact && <div style={{ fontSize: 10.5, fontWeight: 600, color: st.text, marginTop: 1 }}>{timeStr}</div>}
          </div>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: st.dot, flex: '0 0 auto',
            animation: st.pulse ? 'calPulse 1.8s infinite' : 'none' }} />
        </div>
        {!compact && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: st.text, marginTop: 'auto' }}>
            <Icon name={typeIconMap[a.type]} size={12} />
            <span style={{ fontSize: 10.5, fontWeight: 600 }}>{ty.label}</span>
          </div>
        )}
      </button>
    );
  }

  // ----- Variant C · Agenda pro (dense) -----
  return (
    <button onClick={onClick} className="cal-ev" style={{
      position: 'absolute', inset: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit',
      background: '#fff', border: '1px solid #e7ecf3', borderLeft: `4px solid ${st.dot}`,
      borderRadius: 10, padding: tiny ? '2px 8px' : '4px 9px 4px 10px', overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(16,32,64,.07)',
      display: 'flex', flexDirection: 'column', gap: tiny ? 0 : 3, justifyContent: tiny ? 'center' : 'flex-start',
      opacity: a.status === 'cancelada' ? .6 : 1,
    }}>
      {!tiny && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#56627a' }}>{a.start}</span>
          <span style={{ fontSize: 9.5, color: '#9aa6b8', fontWeight: 600 }}>· {a.dur}m</span>
          <span style={{ marginLeft: 'auto', flex: '0 0 auto' }}><StatusBadge status={a.status} compact /></span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <Avatar name={a.patient} color={doc.color} size={tiny ? 16 : 20} />
        {!tiny && <Icon name={typeIconMap[a.type]} size={12} style={{ color: '#9aa6b8', flex: '0 0 auto' }} />}
        <span style={{ fontSize: 12, fontWeight: 700, color: ink, lineHeight: 1.15, minWidth: 0,
          textDecoration: st.strike ? 'line-through' : 'none', whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.patient}</span>
        {tiny
          ? <span style={{ marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%', background: st.dot, flex: '0 0 auto' }} />
          : <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 800, color: doc.color, background: doc.soft,
              borderRadius: 5, padding: '1px 5px', flex: '0 0 auto' }}>{doc.code}</span>}
      </div>
    </button>
  );
}

// ---- Detail panel -----------------------------------------------------
function DetailPanel({ a, onClose }) {
  const C = window.CAL;
  const isExt = a.source === 'gcal';
  const doc = !isExt && C.doctors[a.doctor];
  const st = !isExt && C.statuses[a.status];
  const ty = !isExt && C.types[a.type];
  const x = C.external;

  return (
    <>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(16,28,50,.18)',
        backdropFilter: 'blur(1.5px)', zIndex: 60, animation: 'calFade .15s ease' }} />
      <div style={{ position: 'absolute', top: 10, right: 10, bottom: 10, width: 330, zIndex: 61,
        background: '#fff', borderRadius: 18, boxShadow: '0 18px 50px rgba(16,32,64,.26)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'calPanelIn .22s cubic-bezier(.2,.7,.3,1)' }}>
        {/* header band */}
        <div style={{ padding: '16px 18px 14px', background: isExt ? x.bg : (st ? st.bg : '#f4f6fa'),
          borderBottom: `1px solid ${isExt ? x.border : (st ? st.border : '#e7ecf3')}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            {isExt
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: x.text }}><GoogleMark size={14} /> Google Calendar · <Icon name="lock" size={12} /></span>
              : <StatusBadge status={a.status} />}
            <button onClick={onClose} style={{ border: 'none', background: 'rgba(255,255,255,.6)', borderRadius: 9,
              width: 28, height: 28, display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#56627a' }}>
              <Icon name="x" size={16} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 13 }}>
            {!isExt && <Avatar name={a.patient} color={doc.color} size={42} ring />}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#15243e', lineHeight: 1.15 }}>
                {isExt ? a.title : a.patient}
              </div>
              {!isExt && <div style={{ fontSize: 12.5, color: '#6b7689', marginTop: 2, fontWeight: 500 }}>{ty.label}</div>}
            </div>
          </div>
        </div>
        {/* body rows */}
        <div style={{ padding: '6px 18px 14px', overflowY: 'auto', flex: 1 }}>
          <Row icon="clock" label="Horario" value={`${a.start} – ${C.endLabel(a)} · ${a.dur} min`} />
          {!isExt && <Row icon="users" label="Médico" value={doc.name} accent={doc.color} />}
          {!isExt && <Row icon={typeIconMap[a.type]} label="Tipo de consulta" value={ty.label} />}
          {a.phone && <Row icon="phone" label="Teléfono" value={a.phone} />}
          {isExt && <Row icon="lock" label="Origen" value="Sincronizado desde Google Calendar (solo lectura)" muted />}
        </div>
        {/* actions */}
        <div style={{ padding: 14, borderTop: '1px solid #eef1f6', display: 'flex', gap: 8 }}>
          {isExt ? (
            <button style={btnGhost}>Abrir en Google</button>
          ) : (
            <>
              <button style={btnGhost}><Icon name="user" size={14} /> Expediente</button>
              <button style={btnPrimary}><Icon name="edit" size={14} /> Editar cita</button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
function Row({ icon, label, value, accent, muted }) {
  return (
    <div style={{ display: 'flex', gap: 11, padding: '11px 0', borderBottom: '1px solid #f1f4f8' }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, flex: '0 0 auto', display: 'grid', placeItems: 'center',
        background: '#f3f6fb', color: accent || '#7c8aa0' }}><Icon name={icon} size={15} /></div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: '#9aa6b8' }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: muted ? '#7c8aa0' : '#27364f', marginTop: 2, lineHeight: 1.3 }}>{value}</div>
      </div>
    </div>
  );
}
const btnGhost = { flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  border: '1px solid #d9e0ea', background: '#fff', color: '#3a4863', borderRadius: 11, padding: '10px 12px',
  fontSize: 12.5, fontWeight: 700, cursor: 'pointer', font: 'inherit' };
const btnPrimary = { ...btnGhost, border: 'none', background: '#1b3a66', color: '#fff' };

// ---- Toolbar / legend -------------------------------------------------
function Toolbar({ variant, activeDocs, toggleDoc }) {
  const C = window.CAL;
  const [view, setView] = useState('Semana');
  return (
    <div style={{ padding: '14px 18px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <NavBtn icon="chevL" /><NavBtn icon="chevR" />
          <button style={{ ...segBtn, width: 'auto', padding: '0 14px', background: '#1b3a66', color: '#fff', border: '1px solid #1b3a66', fontWeight: 700 }}>Hoy</button>
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#15243e', letterSpacing: '-.01em', whiteSpace: 'nowrap' }}>{C.rangeLabel}</div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', background: '#eef1f6', borderRadius: 11, padding: 3, gap: 2 }}>
            {['Mes', 'Semana', 'Día'].map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                border: 'none', cursor: 'pointer', font: 'inherit', borderRadius: 8, padding: '6px 13px',
                fontSize: 12.5, fontWeight: 700,
                background: view === v ? '#fff' : 'transparent',
                color: view === v ? '#1b3a66' : '#7c8aa0',
                boxShadow: view === v ? '0 1px 3px rgba(16,32,64,.12)' : 'none',
              }}>{v}</button>
            ))}
          </div>
          <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer',
            font: 'inherit', borderRadius: 11, padding: '9px 15px', fontSize: 13, fontWeight: 700,
            background: 'linear-gradient(180deg,#2a59a0,#1b3a66)', color: '#fff',
            boxShadow: '0 2px 8px rgba(27,58,102,.3)' }}>
            <Icon name="plus" size={15} /> Nueva cita
          </button>
        </div>
      </div>
      {/* legend row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 13, flexWrap: 'wrap' }}>
        {Object.values(C.doctors).map(d => {
          const on = activeDocs.includes(d.id);
          return (
            <button key={d.id} onClick={() => toggleDoc(d.id)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', font: 'inherit',
              border: `1px solid ${on ? d.color : '#e2e7ef'}`, background: on ? d.softer : '#fff',
              borderRadius: 999, padding: '5px 11px 5px 8px', opacity: on ? 1 : .55,
            }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flex: '0 0 auto' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#27364f' }}>{d.short}</span>
            </button>
          );
        })}
        <div style={{ width: 1, height: 18, background: '#e2e7ef', margin: '0 2px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {Object.values(C.statuses).map(s => (
            <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7689' }}>{s.label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
const segBtn = { border: '1px solid #d9e0ea', background: '#fff', borderRadius: 10, width: 34, height: 34,
  display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#3a4863', font: 'inherit', fontSize: 13, fontWeight: 700, padding: '0 12px' };
function NavBtn({ icon }) {
  return <button style={{ ...segBtn, width: 34 }}><Icon name={icon} size={17} /></button>;
}

// ---- The grid ---------------------------------------------------------
function WeekCalendar({ variant = 'soft' }) {
  const C = window.CAL;
  const [sel, setSel] = useState(null);
  const [activeDocs, setActiveDocs] = useState(['ancona', 'mendez']);
  const [ghost, setGhost] = useState(null); // {day, min}
  const bodyH = (C.dayEnd - C.dayStart) * HOUR;
  const hours = [];
  for (let h = C.dayStart; h <= C.dayEnd; h++) hours.push(h);

  const toggleDoc = (id) => setActiveDocs(d => d.includes(id) ? (d.length === 1 ? d : d.filter(x => x !== id)) : [...d, id]);

  const visible = C.appts.filter(a => a.source === 'gcal' || activeDocs.includes(a.doctor));

  function cellClick(e, day) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    let min = C.dayStart * 60 + Math.round((y / HOUR) * 60 / 15) * 15;
    setGhost({ day, min });
    setTimeout(() => setGhost(g => (g && g.day === day && g.min === min) ? null : g), 2600);
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#fff',
      borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column',
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', color: '#15243e' }}>
      <Toolbar variant={variant} activeDocs={activeDocs} toggleDoc={toggleDoc} />

      {/* day header */}
      <div style={{ display: 'flex', padding: '12px 18px 0' }}>
        <div style={{ width: GUTTER, flex: '0 0 auto' }} />
        <div style={{ display: 'flex', flex: 1, gap: 6 }}>
          {C.days.map(d => (
            <div key={d.idx} style={{ flex: 1, textAlign: 'center', padding: '7px 0 9px',
              borderRadius: '10px 10px 0 0',
              background: d.today ? 'linear-gradient(180deg,#1b3a66,#24487d)' : 'transparent' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
                color: d.today ? 'rgba(255,255,255,.7)' : (d.weekend ? '#aab4c4' : '#8a96a9') }}>{d.dow}</div>
              <div style={{ fontSize: 17, fontWeight: 800, marginTop: 1,
                color: d.today ? '#fff' : (d.weekend ? '#9aa6b8' : '#27364f') }}>{d.date}</div>
            </div>
          ))}
        </div>
      </div>

      {/* body */}
      <div style={{ display: 'flex', padding: '0 18px 16px', flex: 1, minHeight: 0 }}>
        {/* gutter */}
        <div style={{ width: GUTTER, flex: '0 0 auto', position: 'relative', height: bodyH }}>
          {hours.map((h, i) => (
            <div key={h} style={{ position: 'absolute', top: i * HOUR - 7, right: 10,
              fontSize: 11, fontWeight: 600, color: '#aab4c4' }}>
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>
        {/* day columns */}
        <div style={{ display: 'flex', flex: 1, gap: 6, position: 'relative' }}>
          {C.days.map(d => {
            const dayItems = C.layoutDay(visible.filter(a => a.day === d.idx));
            return (
              <div key={d.idx} className="cal-cell-hit" onClick={(e) => cellClick(e, d.idx)} style={{
                flex: 1, position: 'relative', height: bodyH, cursor: 'pointer',
                borderRadius: '0 0 10px 10px',
                background: d.today ? '#f7faff' : (d.weekend ? '#fafbfc' : '#fff'),
                backgroundImage: [
                  d.weekend ? 'repeating-linear-gradient(135deg, rgba(120,134,158,.05), rgba(120,134,158,.05) 6px, transparent 6px, transparent 12px)' : '',
                  `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR - 1}px, #eef1f6 ${HOUR - 1}px, #eef1f6 ${HOUR}px)`,
                ].filter(Boolean).join(','),
                boxShadow: d.today ? 'inset 0 0 0 1.5px rgba(27,58,102,.12)' : 'inset 0 0 0 1px #f1f4f8',
              }}>
                {/* now line */}
                {d.today && (
                  <div style={{ position: 'absolute', left: 0, right: 0, zIndex: 40,
                    top: (C.nowMinutes - C.dayStart * 60) / 60 * HOUR }}>
                    <div style={{ position: 'absolute', left: -4, top: -4, width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                    <div style={{ height: 2, background: '#ef4444', opacity: .85 }} />
                  </div>
                )}
                {/* quick-create ghost */}
                {ghost && ghost.day === d.idx && (
                  <div style={{ position: 'absolute', left: 3, right: 3,
                    top: (ghost.min - C.dayStart * 60) / 60 * HOUR, height: 30 / 60 * HOUR,
                    border: '1.5px dashed #2a59a0', background: 'rgba(42,89,160,.08)', borderRadius: 9,
                    display: 'flex', alignItems: 'center', gap: 5, padding: '0 9px', color: '#2a59a0',
                    fontSize: 11.5, fontWeight: 700, zIndex: 35, animation: 'calFade .15s ease' }}>
                    <Icon name="plus" size={13} /> Nueva cita · {C.fmt(ghost.min)}
                  </div>
                )}
                {/* events */}
                {dayItems.map(a => {
                  const top = (C.toMin(a.start) - C.dayStart * 60) / 60 * HOUR;
                  const height = Math.max(a.dur / 60 * HOUR, 22);
                  const w = 100 / a.cols;
                  return (
                    <div key={a.id} style={{ position: 'absolute', top: top + 1.5, height: height - 3,
                      left: `calc(${a.col * w}% + ${a.col ? 3 : 1.5}px)`, width: `calc(${w}% - ${a.cols > 1 ? 4 : 3}px)`, zIndex: 10 }}>
                      <EventCard a={a} variant={variant} h={height - 3} onClick={(e) => { e.stopPropagation(); setSel(a); }} />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {sel && <DetailPanel a={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

Object.assign(window, { WeekCalendar, EventCard, DetailPanel });
