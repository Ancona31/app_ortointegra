/* Sample data + helpers for the medical agenda prototype.
   Plain JS — runs before the Babel scripts and exposes window.CAL.
   Context: Dr. Ángel M. Ancona Pérez — Cirugía de Columna · Ortopedia y Traumatología.
   Two event sources: clinic appointments (rich) and Google Calendar synced
   events (external, title-only, locked). */
(function () {
  // ---- Doctors --------------------------------------------------------
  const doctors = {
    ancona: {
      id: 'ancona',
      name: 'Dr. Ángel M. Ancona Pérez',
      short: 'Dr. Ancona',
      specialty: 'Cirugía de Columna',
      code: 'AN',
      color: '#2f6fed',          // blue
      soft: '#eaf1fe',
      softer: '#f4f8ff',
    },
    mendez: {
      id: 'mendez',
      name: 'Dra. Sofía Méndez',
      short: 'Dra. Méndez',
      specialty: 'Traumatología',
      code: 'SM',
      color: '#13a06a',          // green
      soft: '#e6f6ee',
      softer: '#f2fbf6',
    },
  };

  // ---- Appointment statuses (clinic) ---------------------------------
  // Aligned to the app's "Editar cita" modal (Agendada / Confirmada /
  // Cancelada / No asistió) + the extra states requested (En sala de espera,
  // Atendida) for the full clinical workflow.
  const statuses = {
    agendada: {
      id: 'agendada', label: 'Agendada', short: 'Agendada',
      dot: '#2f6fed', text: '#1d4ed8', bg: '#e9f0fe', border: '#c9dcfb',
      icon: 'calendar',
    },
    confirmada: {
      id: 'confirmada', label: 'Confirmada', short: 'Confirmada',
      dot: '#16a34a', text: '#15803d', bg: '#e7f6ec', border: '#bfe6cb',
      icon: 'check',
    },
    en_espera: {
      id: 'en_espera', label: 'En sala de espera', short: 'En espera',
      dot: '#ea8c0b', text: '#b45309', bg: '#fef3e0', border: '#f5d9a8',
      icon: 'wait', pulse: true,
    },
    atendida: {
      id: 'atendida', label: 'Atendida', short: 'Atendida',
      dot: '#0d9488', text: '#0f766e', bg: '#e2f5f2', border: '#b7e6df',
      icon: 'done',
    },
    no_asistio: {
      id: 'no_asistio', label: 'No asistió', short: 'No asistió',
      dot: '#64748b', text: '#475569', bg: '#eef1f6', border: '#d4dbe5',
      icon: 'noshow',
    },
    cancelada: {
      id: 'cancelada', label: 'Cancelada', short: 'Cancelada',
      dot: '#dc2626', text: '#b91c1c', bg: '#fbecec', border: '#f1c9c9',
      icon: 'x', strike: true,
    },
  };

  // External (Google Calendar) styling token
  const external = {
    label: 'Google Calendar', text: '#6d4ec0', bg: '#f3eefc',
    border: '#ddd0f5', dot: '#7c5cdb',
  };

  // ---- Consult types (orthopedics / spine) ---------------------------
  const types = {
    primera:      { id: 'primera',      label: 'Primera vez',     icon: 'star' },
    seguimiento:  { id: 'seguimiento',  label: 'Seguimiento',     icon: 'repeat' },
    postquirurgico:{ id: 'postquirurgico', label: 'Postquirúrgico', icon: 'bandage' },
    control:      { id: 'control',      label: 'Control',         icon: 'pulse' },
    infiltracion: { id: 'infiltracion', label: 'Infiltración',    icon: 'syringe' },
    urgencia:     { id: 'urgencia',     label: 'Urgencia',        icon: 'alert' },
  };

  // ---- Week scaffold --------------------------------------------------
  // Mon 25 – Sun 31 May 2026.  "Today" = Wed 27 for a lively mid-week demo.
  const days = [
    { idx: 0, dow: 'Lun', date: 25 },
    { idx: 1, dow: 'Mar', date: 26 },
    { idx: 2, dow: 'Mié', date: 27, today: true },
    { idx: 3, dow: 'Jue', date: 28 },
    { idx: 4, dow: 'Vie', date: 29 },
    { idx: 5, dow: 'Sáb', date: 30, weekend: true },
    { idx: 6, dow: 'Dom', date: 31, weekend: true },
  ];
  const monthLabel = 'May 2026';
  const rangeLabel = '25 – 31 May 2026';
  const dayStart = 7;   // 07:00
  const dayEnd = 20;    // 20:00
  const nowMinutes = 11 * 60 + 22; // 11:22 — for the "now" line on today

  // ---- Appointments ---------------------------------------------------
  // source: 'clinic' (full data) | 'gcal' (external, title only)
  const appts = [
    { id: 1,  source: 'clinic', day: 0, start: '09:00', dur: 60, patient: 'María Fernanda Uc',   doctor: 'ancona', type: 'primera',       status: 'confirmada', phone: '999 214 5530' },
    { id: 2,  source: 'clinic', day: 0, start: '10:30', dur: 30, patient: 'Roberto Cauich',       doctor: 'mendez', type: 'seguimiento',   status: 'atendida',   phone: '999 118 7742' },
    { id: 3,  source: 'clinic', day: 0, start: '12:00', dur: 45, patient: 'Diego Pérez Solís',    doctor: 'ancona', type: 'postquirurgico',status: 'atendida',   phone: '999 552 1180' },
    { id: 4,  source: 'clinic', day: 0, start: '16:00', dur: 30, patient: 'Gabriela Tun',         doctor: 'mendez', type: 'urgencia',      status: 'cancelada',  phone: '999 410 9921' },

    { id: 5,  source: 'clinic', day: 1, start: '08:30', dur: 60, patient: 'Ana Sofía Burgos',     doctor: 'mendez', type: 'primera',       status: 'confirmada', phone: '999 730 2214' },
    { id: 6,  source: 'clinic', day: 1, start: '11:00', dur: 30, patient: 'Luis Ek Balam',        doctor: 'ancona', type: 'seguimiento',   status: 'confirmada', phone: '999 661 4480' },
    { id: 7,  source: 'clinic', day: 1, start: '13:00', dur: 45, patient: 'Carmen Dzul',          doctor: 'ancona', type: 'infiltracion',  status: 'agendada',   phone: '999 205 8831' },
    { id: 20, source: 'gcal',   day: 1, start: '18:00', dur: 45, title: 'TyO Dr. Ancona — Luis Santa María Chi', phone: '999 418 1559' },

    { id: 8,  source: 'clinic', day: 2, start: '09:00', dur: 45, patient: 'José Manuel Chan',     doctor: 'ancona', type: 'seguimiento',   status: 'atendida',   phone: '999 318 7012' },
    { id: 9,  source: 'clinic', day: 2, start: '10:00', dur: 30, patient: 'Fernando May',         doctor: 'mendez', type: 'control',       status: 'atendida',   phone: '999 884 3320' },
    { id: 10, source: 'clinic', day: 2, start: '11:00', dur: 60, patient: 'Leydi Poot Canul',     doctor: 'ancona', type: 'primera',       status: 'en_espera',  phone: '999 527 8794' },
    { id: 11, source: 'clinic', day: 2, start: '12:30', dur: 30, patient: 'Gabriela Tun',         doctor: 'mendez', type: 'seguimiento',   status: 'confirmada', phone: '999 410 9921' },
    { id: 12, source: 'clinic', day: 2, start: '16:00', dur: 30, patient: 'Roberto Cauich',       doctor: 'ancona', type: 'control',       status: 'agendada',   phone: '999 118 7742' },
    { id: 13, source: 'clinic', day: 2, start: '17:00', dur: 60, patient: 'Ana Sofía Burgos',     doctor: 'mendez', type: 'urgencia',      status: 'confirmada', phone: '999 730 2214' },

    { id: 14, source: 'clinic', day: 3, start: '09:30', dur: 30, patient: 'Carmen Dzul',          doctor: 'ancona', type: 'seguimiento',   status: 'confirmada', phone: '999 205 8831' },
    { id: 15, source: 'clinic', day: 3, start: '09:45', dur: 45, patient: 'Diego Pérez Solís',    doctor: 'mendez', type: 'control',       status: 'confirmada', phone: '999 552 1180' },
    { id: 16, source: 'clinic', day: 3, start: '12:00', dur: 60, patient: 'Luis Ek Balam',        doctor: 'ancona', type: 'postquirurgico',status: 'agendada',   phone: '999 661 4480' },
    { id: 21, source: 'gcal',   day: 3, start: '15:00', dur: 30, title: 'Junta médica — Hospital Star', phone: '' },

    { id: 17, source: 'clinic', day: 4, start: '08:00', dur: 30, patient: 'María Fernanda Uc',    doctor: 'mendez', type: 'seguimiento',   status: 'confirmada', phone: '999 214 5530' },
    { id: 18, source: 'clinic', day: 4, start: '11:00', dur: 45, patient: 'Fernando May',         doctor: 'ancona', type: 'primera',       status: 'confirmada', phone: '999 884 3320' },
    { id: 19, source: 'clinic', day: 4, start: '15:30', dur: 30, patient: 'José Manuel Chan',     doctor: 'mendez', type: 'control',       status: 'no_asistio', phone: '999 318 7012' },
  ];

  // ---- Helpers --------------------------------------------------------
  function toMin(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }
  function fmt(min) {
    const h = Math.floor(min / 60), m = min % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
  function endLabel(a) { return fmt(toMin(a.start) + a.dur); }
  function initials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }
  // Simple per-day overlap layout: assigns {col,cols} so overlapping
  // events sit side by side.
  function layoutDay(list) {
    const items = list
      .map(a => ({ ...a, s: toMin(a.start), e: toMin(a.start) + a.dur }))
      .sort((x, y) => x.s - y.s || x.e - y.e);
    const groups = [];
    let cur = [];
    let curEnd = -1;
    for (const it of items) {
      if (it.s >= curEnd && cur.length) { groups.push(cur); cur = []; curEnd = -1; }
      cur.push(it); curEnd = Math.max(curEnd, it.e);
    }
    if (cur.length) groups.push(cur);
    const out = [];
    for (const g of groups) {
      const cols = [];
      for (const it of g) {
        let placed = false;
        for (let c = 0; c < cols.length; c++) {
          if (cols[c] <= it.s) { it.col = c; cols[c] = it.e; placed = true; break; }
        }
        if (!placed) { it.col = cols.length; cols.push(it.e); }
      }
      const total = cols.length;
      g.forEach(it => { it.cols = total; out.push(it); });
    }
    return out;
  }

  window.CAL = {
    doctors, statuses, types, external, days,
    monthLabel, rangeLabel, dayStart, dayEnd, nowMinutes,
    appts,
    toMin, fmt, endLabel, initials, layoutDay,
  };
})();
