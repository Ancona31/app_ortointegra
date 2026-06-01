/* Detail panel (click a cita) + New/Edit appointment modal. Theme-aware. */
const MD = React;

// ---------- Detail panel ----------
function DetailPanelX({ a, onClose, onEdit }) {
  const C = window.CAL;
  const T = window.SURF();
  const B = window.brand();
  const isExt = a.source === 'gcal';
  const doc = !isExt && C.doctors[a.doctor];
  const dt = !isExt && window.docTok(doc);
  const st = !isExt && window.stTok(a.status);
  const ty = !isExt && C.types[a.type];
  const x = window.extTok();
  const Row = ({ icon, label, value, accent, muted }) => (
    <div style={{ display: 'flex', gap: 11, padding: '11px 0', borderBottom: `1px solid ${T.rowDivider}` }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, flex: '0 0 auto', display: 'grid', placeItems: 'center', background: T.rowIconBg, color: accent || T.muted }}><Icon name={icon} size={15} /></div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: T.muted2 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: muted ? T.muted : T.text, marginTop: 2, lineHeight: 1.3 }}>{value}</div>
      </div>
    </div>
  );
  const ghostBtn = { flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: `1px solid ${T.inputBorder}`, background: T.iconBtnBg, color: T.text, borderRadius: 12, padding: '11px', fontSize: 13, fontWeight: 700, cursor: 'pointer', font: 'inherit' };
  const primBtn = { ...ghostBtn, border: 'none', background: B.btn, color: '#fff' };
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: T.overlay, backdropFilter: 'blur(1.5px)', zIndex: 90, animation: 'calFade .15s ease' }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 360, zIndex: 91, background: T.panelBg,
        boxShadow: '-18px 0 50px rgba(0,0,0,.32)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'calPanelIn .24s cubic-bezier(.2,.7,.3,1)' }}>
        <div style={{ padding: '18px 20px 16px', background: isExt ? x.bg : st.bg, borderBottom: `1px solid ${isExt ? x.border : st.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            {isExt ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: x.text }}><GoogleMark size={15} /> Google Calendar · <Icon name="lock" size={12} /></span> : <StatusBadge status={a.status} />}
            <button onClick={onClose} style={{ border: 'none', background: window.__dark ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.6)', borderRadius: 9, width: 30, height: 30, display: 'grid', placeItems: 'center', cursor: 'pointer', color: isExt ? x.text : st.text }}><Icon name="x" size={17} /></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
            {!isExt && <Avatar name={a.patient} color={dt.color} size={46} ring />}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: window.__dark ? (isExt ? x.text : st.text) : '#15243e', lineHeight: 1.15 }}>{isExt ? a.title : a.patient}</div>
              {!isExt && <div style={{ fontSize: 13, color: window.__dark ? st.text : '#6b7689', opacity: window.__dark ? .85 : 1, marginTop: 2, fontWeight: 500 }}>{ty.label}</div>}
            </div>
          </div>
        </div>
        <div style={{ padding: '6px 20px 14px', overflowY: 'auto', flex: 1 }}>
          <Row icon="clock" label="Horario" value={`${a.start} – ${C.endLabel(a)} · ${a.dur} min`} />
          {!isExt && <Row icon="users" label="Médico" value={doc.name} accent={dt.color} />}
          {!isExt && <Row icon={typeIconMap[a.type]} label="Tipo de consulta" value={ty.label} />}
          {a.phone && <Row icon="phone" label="Teléfono" value={a.phone} />}
          {isExt && <Row icon="lock" label="Origen" value="Sincronizado desde Google Calendar · solo lectura" muted />}
        </div>
        <div style={{ padding: 16, borderTop: `1px solid ${T.hairline}`, display: 'flex', gap: 9 }}>
          {isExt ? <button style={ghostBtn}><GoogleMark size={14} /> Abrir en Google</button> : (
            <>
              <button style={ghostBtn}><Icon name="user" size={15} /> Expediente</button>
              <button onClick={() => onEdit(a)} style={primBtn}><Icon name="edit" size={15} /> Editar cita</button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ---------- New / Edit modal ----------
const DUR_OPTS = [{ m: 15, l: '15 min' }, { m: 30, l: '30 min' }, { m: 45, l: '45 min' }, { m: 60, l: '1 hora' }, { m: 90, l: '1:30 h' }, { m: 120, l: '2 horas' }];

function ApptModal({ draft, onClose, onSave, onDelete }) {
  const C = window.CAL;
  const T = window.SURF();
  const B = window.brand();
  const isNew = !draft.id;
  const [patient, setPatient] = MD.useState(draft.patient || '');
  const [phone, setPhone] = MD.useState(draft.phone || '');
  const [start, setStart] = MD.useState(draft.start || '09:00');
  const [dur, setDur] = MD.useState(draft.dur || 30);
  const [status, setStatus] = MD.useState(draft.status || 'agendada');
  const [doctor, setDoctor] = MD.useState(draft.doctor || 'ancona');
  const [type, setType] = MD.useState(draft.type || 'primera');
  const [notes, setNotes] = MD.useState(draft.notes || '');
  const endStr = C.fmt(C.toMin(start) + dur);
  const dayObj = C.days.find(d => d.idx === draft.day) || C.days[0];
  const dt = window.docTok(C.doctors[doctor]);
  const inp = { width: '100%', border: `1px solid ${T.inputBorder}`, borderRadius: 12, padding: '11px 13px', fontSize: 14, fontWeight: 500,
    color: T.text, font: 'inherit', outline: 'none', background: T.inputBg, boxSizing: 'border-box' };

  function save() { if (!patient.trim()) return; onSave({ ...draft, source: 'clinic', patient: patient.trim(), phone, start, dur, status, doctor, type, notes }); }
  const Lbl = ({ children, req }) => <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: T.muted2, margin: '0 0 8px' }}>{children}{req && <span style={{ color: '#e0566f' }}> *</span>}</div>;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 120, background: T.overlay, backdropFilter: 'blur(3px)',
      display: 'grid', placeItems: 'center', padding: 24, animation: 'calFade .15s ease' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 480, maxHeight: '92vh', background: T.panelBg, borderRadius: 22,
        boxShadow: '0 30px 80px rgba(0,0,0,.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'calPanelIn .22s cubic-bezier(.2,.7,.3,1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px', borderBottom: `1px solid ${T.hairline}` }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: dt.soft, color: dt.color, display: 'grid', placeItems: 'center' }}><Icon name="calendar" size={20} /></div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.ink }}>{isNew ? 'Nueva cita' : 'Editar cita'}</div>
          <button onClick={onClose} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', color: T.muted2, padding: 4 }}><Icon name="x" size={20} /></button>
        </div>
        <div style={{ padding: '18px 22px', overflowY: 'auto' }}>
          <Lbl req>Paciente</Lbl>
          {patient ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, background: dt.soft, border: `1px solid ${dt.color}55`, borderRadius: 13, padding: '10px 12px' }}>
              <Avatar name={patient} color={dt.color} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <input value={patient} onChange={e => setPatient(e.target.value)} style={{ border: 'none', background: 'transparent', font: 'inherit', fontSize: 15, fontWeight: 700, color: T.ink, width: '100%', outline: 'none' }} />
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Teléfono" style={{ border: 'none', background: 'transparent', font: 'inherit', fontSize: 12.5, color: dt.color, width: '100%', outline: 'none', marginTop: 1 }} />
              </div>
              <button onClick={() => { setPatient(''); setPhone(''); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.muted }}><Icon name="x" size={17} /></button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <input autoFocus value={patient} onChange={e => setPatient(e.target.value)} placeholder="Buscar o escribir nombre del paciente…" style={inp} />
              <span style={{ position: 'absolute', right: 13, top: 13, color: T.muted2 }}><Icon name="search" size={17} /></span>
            </div>
          )}

          <div style={{ height: 16 }} />
          <Lbl>Fecha y hora de inicio</Lbl>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ ...inp, display: 'flex', alignItems: 'center', gap: 8, flex: 1, cursor: 'default' }}>
              <Icon name="calendar" size={16} style={{ color: T.muted }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{dayObj.dow} {dayObj.date} {C.monthLabel}</span>
            </div>
            <input type="time" value={start} step="900" onChange={e => setStart(e.target.value)} style={{ ...inp, width: 120, flex: '0 0 auto', colorScheme: window.__dark ? 'dark' : 'light' }} />
          </div>

          <div style={{ height: 16 }} />
          <Lbl>Duración</Lbl>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {DUR_OPTS.map(o => (
              <button key={o.m} onClick={() => setDur(o.m)} style={{
                border: `1px solid ${dur === o.m ? B.primary : T.inputBorder}`, background: dur === o.m ? B.primary : T.iconBtnBg,
                color: dur === o.m ? '#fff' : T.text, borderRadius: 999, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', font: 'inherit',
              }}>{o.l}</button>
            ))}
          </div>
          <div style={{ fontSize: 12.5, color: T.muted, marginTop: 9 }}>Termina a las <b style={{ color: T.text }}>{endStr}</b></div>

          <div style={{ height: 16 }} />
          <Lbl>Estado</Lbl>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {Object.values(C.statuses).map(sDef => {
              const sk = window.stTok(sDef.id);
              const on = status === sDef.id;
              return (
                <button key={sDef.id} onClick={() => setStatus(sDef.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 7, border: `1.5px solid ${on ? sk.dot : T.inputBorder}`,
                  background: on ? sk.bg : T.iconBtnBg, borderRadius: 11, padding: '9px 10px', cursor: 'pointer', font: 'inherit', textAlign: 'left',
                }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: sk.dot, flex: '0 0 auto' }} />
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: on ? sk.text : T.text, lineHeight: 1.1 }}>{sDef.short}</span>
                </button>
              );
            })}
          </div>

          <div style={{ height: 16 }} />
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <Lbl req>Médico</Lbl>
              <div style={{ position: 'relative' }}>
                <select value={doctor} onChange={e => setDoctor(e.target.value)} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                  {Object.values(C.doctors).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <span style={{ position: 'absolute', right: 12, top: 14, color: T.muted, pointerEvents: 'none' }}><Icon name="chevDownSm" size={16} /></span>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <Lbl>Tipo de consulta</Lbl>
              <div style={{ position: 'relative' }}>
                <select value={type} onChange={e => setType(e.target.value)} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                  {Object.values(C.types).map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <span style={{ position: 'absolute', right: 12, top: 14, color: T.muted, pointerEvents: 'none' }}><Icon name="chevDownSm" size={16} /></span>
              </div>
            </div>
          </div>

          <div style={{ height: 16 }} />
          <Lbl>Notas</Lbl>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Instrucciones, observaciones…" rows={3} style={{ ...inp, resize: 'vertical', lineHeight: 1.45 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 22px', borderTop: `1px solid ${T.hairline}` }}>
          {!isNew && <button onClick={() => onDelete(draft)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', color: '#ef5a6f', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', font: 'inherit', padding: '8px 4px' }}><Icon name="trash" size={16} /> Eliminar</button>}
          <button onClick={onClose} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: T.muted, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', font: 'inherit', padding: '10px 16px' }}>Cancelar</button>
          <button onClick={save} style={{ border: 'none', background: B.btn, color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', font: 'inherit', borderRadius: 12, padding: '11px 20px', boxShadow: '0 2px 9px rgba(10,22,44,.32)' }}>{isNew ? 'Crear cita' : 'Guardar cambios'}</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DetailPanelX, ApptModal });
