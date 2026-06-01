/* Interactive agenda views — Week / Day / Resource / Month — with
   drag-to-reschedule, quick-create and a detail panel. Uses the variant-A
   EventCard from calendar-week.jsx and the atoms from calendar-ui.jsx. */

const AV = React;
const GH = 58;            // hour height (px)
const GUT = 64;           // gutter width

// ---------- Toolbar ----------
function AgendaToolbar({ view, setView, activeDocs, toggleDoc, label, onPrev, onNext, onToday, onNew, extra }) {
  const C = window.CAL;
  const T = window.SURF();
  const B = window.brand();
  const iconBtn = { border: `1px solid ${T.iconBtnBorder}`, background: T.iconBtnBg, borderRadius: 11, width: 38, height: 38,
    display: 'grid', placeItems: 'center', cursor: 'pointer', color: T.iconBtnText, font: 'inherit', fontSize: 13.5, fontWeight: 700 };
  const views = [
    { k: 'Mes', ic: 'grid' }, { k: 'Semana', ic: 'columns' },
    { k: 'Día', ic: 'calendar' }, { k: 'Recurso', ic: 'users' },
  ];
  return (
    <div style={{ padding: '16px 30px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onPrev} style={iconBtn}><Icon name="chevL" size={18} /></button>
          <button onClick={onNext} style={iconBtn}><Icon name="chevR" size={18} /></button>
          <button onClick={onToday} style={{ ...iconBtn, width: 'auto', padding: '0 16px', background: B.primary, color: '#fff', border: `1px solid ${B.primary}` }}>Hoy</button>
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: T.ink, letterSpacing: '-.01em', whiteSpace: 'nowrap' }}>{label}</div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {extra}
          <div style={{ display: 'flex', background: T.segBg, borderRadius: 12, padding: 3, gap: 2 }}>
            {views.map(v => (
              <button key={v.k} onClick={() => setView(v.k)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer', font: 'inherit',
                borderRadius: 9, padding: '7px 13px', fontSize: 13, fontWeight: 700,
                background: view === v.k ? T.segActive : 'transparent',
                color: view === v.k ? B.activeText : T.segText,
                boxShadow: view === v.k ? '0 1px 3px rgba(0,0,0,.18)' : 'none',
              }}><Icon name={v.ic} size={15} />{v.k}</button>
            ))}
          </div>
          <button onClick={() => onNew()} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', cursor: 'pointer',
            font: 'inherit', borderRadius: 12, padding: '10px 17px', fontSize: 13.5, fontWeight: 700,
            background: B.btn, color: '#fff', boxShadow: '0 2px 9px rgba(10,22,44,.32)' }}>
            <Icon name="plus" size={16} /> Nueva cita
          </button>
        </div>
      </div>
      {/* doctor filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
        {Object.values(C.doctors).map(d => {
          const on = activeDocs.includes(d.id);
          const dt = window.docTok(d);
          return (
            <button key={d.id} onClick={() => toggleDoc(d.id)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', font: 'inherit',
              border: `1px solid ${on ? dt.color : T.chipBorder}`, background: on ? dt.soft : T.chipBg,
              borderRadius: 999, padding: '6px 13px 6px 9px', opacity: on ? 1 : .5,
            }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: dt.color }} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>{d.short}</span>
            </button>
          );
        })}
        <span style={{ fontSize: 12, color: T.faint, fontWeight: 500, marginLeft: 4 }}>· clic en un hueco para crear · arrastra una cita para reagendar</span>
      </div>
    </div>
  );
}

// ---------- Time grid (shared by Week / Day / Resource) ----------
function TimeGrid({ columns, appts, onSelect, onQuickCreate, onReschedule }) {
  const C = window.CAL;
  const T = window.SURF();
  const B = window.brand();
  const bodyH = (C.dayEnd - C.dayStart) * GH;
  const hours = [];
  for (let h = C.dayStart; h <= C.dayEnd; h++) hours.push(h);
  const wrapRef = AV.useRef(null);
  const colRefs = AV.useRef({});
  const [drag, setDrag] = AV.useState(null);

  function startDrag(e, a, col) {
    if (a.source === 'gcal') return;        // external = read-only
    if (e.button != null && e.button !== 0) return;
    const startX = e.clientX, startY = e.clientY;
    setDrag({ id: a.id, a, origStart: C.toMin(a.start), curStart: C.toMin(a.start), col, curCol: col, moved: false, startX, startY });
  }
  AV.useEffect(() => {
    if (!drag) return;
    function move(e) {
      const dy = e.clientY - drag.startY;
      const dx = e.clientX - drag.startX;
      const moved = drag.moved || Math.abs(dy) > 4 || Math.abs(dx) > 4;
      let curStart = drag.origStart + Math.round((dy / GH) * 60 / 15) * 15;
      curStart = Math.max(C.dayStart * 60, Math.min(curStart, C.dayEnd * 60 - drag.a.dur));
      // which column is pointer over
      let curCol = drag.curCol;
      for (const c of columns) {
        const el = colRefs.current[c.key];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right) { curCol = c; break; }
      }
      setDrag(d => d && ({ ...d, curStart, curCol, moved }));
    }
    function up() {
      if (drag) {
        if (!drag.moved) onSelect(drag.a);
        else onReschedule(drag.a, drag.curStart, drag.curCol);
      }
      setDrag(null);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [drag, columns]);

  function cellClick(e, col) {
    if (drag) return;
    const r = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - r.top;
    let min = C.dayStart * 60 + Math.round((y / GH) * 60 / 15) * 15;
    min = Math.max(C.dayStart * 60, Math.min(min, C.dayEnd * 60 - 30));
    onQuickCreate(col, min);
  }

  return (
    <div ref={wrapRef} style={{ display: 'flex', padding: '0 30px 26px', userSelect: drag ? 'none' : 'auto' }}>
      <div style={{ width: GUT, flex: '0 0 auto', position: 'relative', height: bodyH, marginTop: 2 }}>
        {hours.map((h, i) => (
          <div key={h} style={{ position: 'absolute', top: i * GH - 7, right: 12, fontSize: 11.5, fontWeight: 600, color: T.faint }}>
            {String(h).padStart(2, '0')}:00
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flex: 1, gap: 7, position: 'relative' }}>
        {columns.map(col => {
          const items = C.layoutDay(appts.filter(col.filter));
          return (
            <div key={col.key} ref={el => (colRefs.current[col.key] = el)}
              className="ag-col" onClick={(e) => cellClick(e, col)} style={{
                flex: 1, position: 'relative', height: bodyH, cursor: 'copy', borderRadius: 12,
                background: col.today ? B.todayBg : (col.weekend ? T.weekendBg : T.card),
                backgroundImage: [
                  col.weekend ? `repeating-linear-gradient(135deg, ${T.weekendHatch}, ${T.weekendHatch} 6px, transparent 6px, transparent 12px)` : '',
                  `repeating-linear-gradient(to bottom, transparent 0, transparent ${GH - 1}px, ${T.line} ${GH - 1}px, ${T.line} ${GH}px)`,
                ].filter(Boolean).join(','),
                boxShadow: col.today ? `inset 0 0 0 1.5px ${B.ring}` : `inset 0 0 0 1px ${T.colLine}`,
              }}>
              {col.today && (
                <div style={{ position: 'absolute', left: 0, right: 0, zIndex: 40, top: (C.nowMinutes - C.dayStart * 60) / 60 * GH }}>
                  <div style={{ position: 'absolute', left: -4, top: -4, width: 8, height: 8, borderRadius: '50%', background: T.now }} />
                  <div style={{ height: 2, background: T.now, opacity: .85 }} />
                </div>
              )}
              {items.map(a => {
                const isDragged = drag && drag.id === a.id;
                const startMin = isDragged && drag.curCol.key === col.key ? drag.curStart : (isDragged ? null : C.toMin(a.start));
                if (isDragged && drag.curCol.key !== col.key) return null; // moved to another column
                const top = (startMin - C.dayStart * 60) / 60 * GH;
                const height = Math.max(a.dur / 60 * GH, 24);
                const w = 100 / a.cols;
                return (
                  <div key={a.id} onPointerDown={(e) => startDrag(e, a, col)} style={{
                    position: 'absolute', top: top + 1.5, height: height - 3,
                    left: `calc(${a.col * w}% + ${a.col ? 3 : 1.5}px)`, width: `calc(${w}% - ${a.cols > 1 ? 4 : 3}px)`,
                    zIndex: isDragged ? 80 : 10, cursor: a.source === 'gcal' ? 'pointer' : 'grab',
                    filter: isDragged ? 'drop-shadow(0 12px 26px rgba(16,32,64,.28))' : 'none',
                    transform: isDragged ? 'scale(1.015)' : 'none', transition: isDragged ? 'none' : 'top .12s',
                  }}>
                    <EventCard a={a} variant="clean" h={height - 3} onClick={() => {}} />
                  </div>
                );
              })}
            </div>
          );
        })}
        {/* live drag time tooltip */}
        {drag && drag.moved && (
          <div style={{ position: 'fixed', left: drag.startX + 16, top: drag.startY, zIndex: 200,
            background: '#15243e', color: '#fff', padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            pointerEvents: 'none', boxShadow: '0 6px 18px rgba(0,0,0,.3)' }}>
            {C.fmt(drag.curStart)} – {C.fmt(drag.curStart + drag.a.dur)}{drag.curCol.dropLabel ? ' · ' + drag.curCol.dropLabel : ''}
          </div>
        )}
      </div>
    </div>
  );
}

// column header strip (days or doctors)
function ColHeaders({ columns, kind }) {
  return (
    <div style={{ display: 'flex', padding: '14px 30px 0' }}>
      <div style={{ width: GUT, flex: '0 0 auto' }} />
      <div style={{ display: 'flex', flex: 1, gap: 7 }}>
        {columns.map(col => col.header)}
      </div>
    </div>
  );
}

function dayHeader(d) {
  const T = window.SURF();
  const B = window.brand();
  return (
    <div key={d.idx} style={{ flex: 1, textAlign: 'center', padding: '8px 0 10px', borderRadius: '11px 11px 0 0',
      background: d.today ? B.todayHead : 'transparent' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
        color: d.today ? 'rgba(255,255,255,.72)' : (d.weekend ? T.faint : T.muted) }}>{d.dow}</div>
      <div style={{ fontSize: 18, fontWeight: 800, marginTop: 1, color: d.today ? '#fff' : (d.weekend ? T.muted2 : T.text) }}>{d.date}</div>
    </div>
  );
}

Object.assign(window, { AgendaToolbar, TimeGrid, ColHeaders, dayHeader, GH, GUT });
