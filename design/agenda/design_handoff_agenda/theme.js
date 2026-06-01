/* Theme tokens for the agenda prototype (light / dark).
   Plain JS, runs after calendar-data.js. Components read window.SURF(),
   window.stTok(), window.docTok(), window.extTok() and re-render when the
   top-level `dark` state flips (window.__dark is kept in sync). */
(function () {
  window.__dark = false;

  const light = {
    appBg: '#eef1f5', mainBg: '#fbfcfe',
    ink: '#15243e', text: '#27364f', muted: '#7c8aa0', muted2: '#9aa6b8', faint: '#aab4c4',
    card: '#ffffff', cardBorder: '#e7ecf3', cardShadow: '0 1px 2px rgba(16,32,64,.05)',
    line: '#eef1f6', colLine: '#f1f4f8',
    todayBg: '#f7faff', todayRing: 'rgba(27,58,102,.12)',
    weekendBg: '#fafbfc', weekendHatch: 'rgba(120,134,158,.05)',
    now: '#ef4444',
    segBg: '#eef1f6', segActive: '#ffffff', segActiveText: '#1b3a66', segText: '#7c8aa0',
    iconBtnBg: '#ffffff', iconBtnBorder: '#d9e0ea', iconBtnText: '#3a4863',
    chipBg: '#ffffff', chipBorder: '#e2e7ef',
    panelBg: '#ffffff', overlay: 'rgba(16,28,50,.22)',
    inputBg: '#ffffff', inputBorder: '#d9e0ea',
    rowIconBg: '#f3f6fb', rowDivider: '#f1f4f8',
    monthCell: '#ffffff', monthWeekend: '#fafbfc', monthEmpty: '#f4f6f9', monthHead: '#f7f9fc', monthGap: '#e7ecf3',
    hairline: '#eef1f6',
  };

  const dark = {
    appBg: '#0c1420', mainBg: '#0f1828',
    ink: '#e8eef6', text: '#cdd8e6', muted: '#8b9bb0', muted2: '#6b7a90', faint: '#5d6b80',
    card: '#1b2a40', cardBorder: '#2a3b57', cardShadow: '0 1px 3px rgba(0,0,0,.45)',
    line: 'rgba(255,255,255,.07)', colLine: 'rgba(255,255,255,.05)',
    todayBg: 'rgba(47,111,237,.10)', todayRing: 'rgba(91,140,255,.30)',
    weekendBg: '#0b1320', weekendHatch: 'rgba(255,255,255,.03)',
    now: '#f87171',
    segBg: '#16233a', segActive: '#27395a', segActiveText: '#dbe7ff', segText: '#8b9bb0',
    iconBtnBg: '#16233a', iconBtnBorder: '#2a3b57', iconBtnText: '#cdd8e6',
    chipBg: '#16233a', chipBorder: '#2a3b57',
    panelBg: '#152135', overlay: 'rgba(2,6,14,.58)',
    inputBg: '#16233a', inputBorder: '#2a3b57',
    rowIconBg: '#1f2f48', rowDivider: 'rgba(255,255,255,.06)',
    monthCell: '#141f33', monthWeekend: '#0e1828', monthEmpty: '#0c1422', monthHead: '#101a2b', monthGap: '#22324c',
    hairline: 'rgba(255,255,255,.08)',
  };

  const statusDark = {
    agendada:   { dot: '#6b9bff', text: '#a9c8ff', bg: 'rgba(47,111,237,.18)',  border: 'rgba(91,140,255,.36)' },
    confirmada: { dot: '#34d399', text: '#7eecb4', bg: 'rgba(22,163,74,.18)',   border: 'rgba(52,211,153,.34)' },
    en_espera:  { dot: '#fbbf24', text: '#fcd66b', bg: 'rgba(234,140,11,.20)',  border: 'rgba(251,191,36,.38)' },
    atendida:   { dot: '#2dd4bf', text: '#84e6d6', bg: 'rgba(13,148,136,.20)',  border: 'rgba(45,212,191,.34)' },
    no_asistio: { dot: '#9fb0c4', text: '#c7d2e0', bg: 'rgba(120,134,158,.22)', border: 'rgba(148,163,184,.40)' },
    cancelada:  { dot: '#f87171', text: '#fca5a5', bg: 'rgba(220,38,38,.18)',   border: 'rgba(248,113,113,.34)' },
  };
  const docDark = {
    ancona: { color: '#6b9bff', soft: 'rgba(47,111,237,.20)' },
    mendez: { color: '#34d399', soft: 'rgba(19,160,106,.20)' },
  };
  const extDark = { text: '#c4b5fd', bg: 'rgba(124,92,219,.18)', border: 'rgba(167,139,250,.36)', dot: '#a78bfa' };

  // ----- Brand palette (inherited per-user: primary + secondary) -----
  window.PALETTES = [
    { id: 'spinus',  name: 'Spinus® (defecto)', primary: '#1a3a5c', secondary: '#1e5fa8' },
    { id: 'verde',   name: 'Verde médico',       primary: '#0f3a2c', secondary: '#12a070' },
    { id: 'morado',  name: 'Morado',             primary: '#3a1d5c', secondary: '#7c3aed' },
    { id: 'rojo',    name: 'Rojo burdeos',       primary: '#5c1a22', secondary: '#c0394a' },
    { id: 'cafe',    name: 'Café cálido',         primary: '#4a2f1a', secondary: '#b9712e' },
    { id: 'pizarra', name: 'Pizarra oscuro',     primary: '#1b2430', secondary: '#5b6b82' },
  ];
  window.BRAND = { primary: '#1a3a5c', secondary: '#1e5fa8' };
  function hx(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); }
  function toHex(a) { return '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
  function mix(a, b, t) { const A = hx(a), B = hx(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); }
  window.mix = mix;
  window.brand = () => {
    const p = window.BRAND.primary, s = window.BRAND.secondary, dk = window.__dark;
    return {
      primary: p, secondary: s,
      btn: `linear-gradient(180deg, ${mix(p, s, .55)}, ${p})`,
      sidebar: `linear-gradient(184deg, ${mix(p, '#000000', .45)} 0%, ${p} 46%, ${mix(s, p, .15)} 100%)`,
      todayHead: `linear-gradient(180deg, ${p}, ${mix(p, s, .5)})`,
      ring: dk ? mix(s, '#0f1828', .58) : mix(s, '#ffffff', .55),
      todayBg: dk ? mix(s, '#0f1828', .88) : mix(s, '#ffffff', .93),
      activeText: dk ? mix(s, '#ffffff', .58) : p,
      navActive: dk ? '#0c1f36' : mix(p, '#ffffff', .12),
    };
  };

  window.SURF = () => (window.__dark ? dark : light);
  window.stTok = (id) => {
    const s = window.CAL.statuses[id];
    return window.__dark ? statusDark[id] : { dot: s.dot, text: s.text, bg: s.bg, border: s.border };
  };
  window.docTok = (doc) => window.__dark ? docDark[doc.id] : { color: doc.color, soft: doc.soft };
  window.extTok = () => {
    const x = window.CAL.external;
    return window.__dark ? extDark : { text: x.text, bg: x.bg, border: x.border, dot: x.dot };
  };
})();
