'use client'

import { Activity } from 'lucide-react'
import {
  evaluarEstado,
  evaluarPA,
  type EstadoVital,
  type SignoVitalKey,
} from '@/lib/signosVitalesRangos'

/**
 * Estado del formulario de vitales: strings tal como los teclea el input.
 * La conversión a number la hace el padre al armar el payload (no aquí).
 */
export interface SignosVitalesForm {
  ta_sistolica?: string
  ta_diastolica?: string
  fc?: string
  fr?: string
  temp?: string
  spo2?: string
}

interface SignosVitalesCardProps {
  value: SignosVitalesForm
  onChange: (next: SignosVitalesForm) => void
  /** Keys con error de validación dura (refuerzo visual; el mensaje va en el banner del padre). */
  errores?: Set<SignoVitalKey>
}

// Accent de la barra-indicador y del punto, por estado.
// Solo el ACCENT sigue yendo por style inline: son <div>/<span> y las reglas
// de ThemeProvider no los alcanzan. El color del VALOR se mudó a CSS (ver las
// reglas [data-estado] abajo): ThemeProvider inyecta
// html.dark input { color: … !important } sin capa, y una declaración
// !important de autor gana a un style inline normal — con el color en línea,
// en modo oscuro los seis valores salían del mismo blanco y el semáforo
// clínico desaparecía.
const ACCENT: Record<EstadoVital, string> = {
  vacio: 'var(--sp-line-input)',
  normal: 'var(--sp-vital-ok-accent)',
  vigilar: 'var(--sp-vital-watch-accent)',
  fuera: 'var(--sp-vital-out-accent)',
}

const ESTADO_LABEL: Record<EstadoVital, string> = {
  vacio: 'Sin capturar',
  normal: 'Normal',
  vigilar: 'A vigilar',
  fuera: 'Fuera de rango',
}

/** `label` se usa en md+; `short` (etiqueta corta con la unidad integrada) en <768px. */
const SINGLES = [
  { key: 'fc', label: 'FREC. CARDÍACA', short: 'FC · lpm', unit: 'lpm', aria: 'Frecuencia cardíaca', inputMode: 'numeric' },
  { key: 'fr', label: 'FREC. RESP.', short: 'FR · rpm', unit: 'rpm', aria: 'Frecuencia respiratoria', inputMode: 'numeric' },
  { key: 'temp', label: 'TEMPERATURA', short: 'T · °C', unit: '°C', aria: 'Temperatura', inputMode: 'decimal', step: '0.1' },
  { key: 'spo2', label: 'SpO₂', short: 'SpO₂ · %', unit: '%', aria: 'Saturación de oxígeno', inputMode: 'numeric' },
] as const

function parseNum(s: string | undefined): number | undefined {
  if (s == null) return undefined
  const t = s.trim()
  if (!t) return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

const CSS = `
.sv-card * { box-sizing: border-box; }
.sv-card .sv-header { display:flex; align-items:center; gap:10px; padding:10px 18px; border-bottom:1px solid var(--sp-line-divider); }
.sv-card .sv-chip { width:26px; height:26px; border-radius:8px; background:var(--sp-success-bg-alt); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.sv-card .sv-titles { display:flex; align-items:baseline; gap:6px; min-width:0; flex-wrap:wrap; }
.sv-card .sv-title { font-size:15px; font-weight:800; color:var(--sp-ink-800); line-height:1.1; }
.sv-card .sv-sub { font-size:12px; color:var(--sp-ink-300); }
.sv-card .sv-badge { margin-left:auto; border-radius:20px; font-size:12px; font-weight:700; padding:6px 13px; white-space:nowrap; flex-shrink:0; }
.sv-card .sv-grid { display:grid; grid-template-columns:1.9fr 1fr 1fr 1fr 1fr; gap:12px; padding:12px 18px; }
.sv-card .sv-tile { position:relative; background:var(--sp-surface-sunken); border:1px solid var(--sp-line-soft); border-radius:14px; overflow:hidden; min-width:0; }
.sv-card .sv-tile--error { box-shadow: inset 0 0 0 1px var(--sp-vital-out-accent); border-color:var(--sp-vital-out-accent); }
.sv-card .sv-bar { height:3px; width:100%; }
.sv-card .sv-body { display:block; cursor:text; padding:7px 13px 9px; }
.sv-card .sv-label-row { display:flex; align-items:center; gap:5px; margin-bottom:3px; }
.sv-card .sv-dot { width:9px; height:9px; border-radius:9999px; flex-shrink:0; }
.sv-card .sv-label { font-size:11px; font-weight:700; letter-spacing:.04em; color:var(--sp-ink-400); text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sv-card .sv-label--sm { display:none; }
.sv-card .sv-value-row { display:flex; align-items:baseline; gap:4px; }
.sv-card .sv-sep { font-size:22px; font-weight:700; color:var(--sp-ink-100); }
.sv-card .sv-unit { font-size:12px; font-weight:600; color:var(--sp-ink-300); }
.sv-card .sv-input { border:none; outline:none; background:transparent; font-weight:800; font-size:19px; padding:0; max-width:100%; -moz-appearance:textfield; }
.sv-card .sv-input[data-k="ta_sistolica"] { width:34px; }
.sv-card .sv-input[data-k="ta_diastolica"] { width:30px; }
.sv-card .sv-input[data-k="fc"] { width:46px; }
.sv-card .sv-input[data-k="fr"] { width:42px; }
.sv-card .sv-input[data-k="temp"] { width:52px; }
.sv-card .sv-input[data-k="spo2"] { width:46px; }
.sv-card .sv-input::-webkit-outer-spin-button,
.sv-card .sv-input::-webkit-inner-spin-button { -webkit-appearance:none; margin:0; }
/* ThemeProvider inyecta html.dark input {…!important} SIN capa, con
   especificidad (0,2,2), y pisaría el fondo transparente, el placeholder y el
   color del semáforo. Para ganarle basta subir la nuestra: [data-k] y
   [data-estado] la llevan a (0,3,0) y ambas son !important de autor sin capa,
   así que decide la especificidad — nada de trucos de orden de capas. */
.sv-card .sv-input[data-k] { background:transparent !important; }
.sv-card .sv-input[data-k]::placeholder { color:var(--sp-ink-200) !important; font-weight:800; }
.sv-card .sv-input[data-estado="vacio"]   { color:var(--sp-ink-350)     !important; }
.sv-card .sv-input[data-estado="normal"]  { color:var(--sp-vital-ok)    !important; }
.sv-card .sv-input[data-estado="vigilar"] { color:var(--sp-vital-watch) !important; }
.sv-card .sv-input[data-estado="fuera"]   { color:var(--sp-vital-out)   !important; }
@media (max-width:767px) {
  .sv-card { flex-shrink:0; }
  .sv-card .sv-grid { grid-template-columns:1.45fr 1fr 1fr 1fr 1fr; gap:0; padding:0; }
  .sv-card .sv-tile { background:transparent; border:none; border-right:1px solid var(--sp-line-divider); border-radius:0; }
  .sv-card .sv-tile:last-child { border-right:none; }
  .sv-card .sv-body { padding:8px 4px 10px; min-height:44px; }
  .sv-card .sv-dot { display:none; }
  /* etiqueta corta con unidad integrada arriba; abajo solo el valor */
  .sv-card .sv-label-row { justify-content:center; gap:0; margin-bottom:2px; }
  .sv-card .sv-label { font-size:10px; letter-spacing:.02em; text-align:center; }
  .sv-card .sv-label--lg { display:none; }
  .sv-card .sv-label--sm { display:inline; }
  .sv-card .sv-unit { display:none; }
  /* glifos centrados: el ancho fijo en px desbordaba la celda angosta */
  .sv-card .sv-value-row { justify-content:center; gap:2px; }
  .sv-card .sv-input { font-size:15px; text-align:center; }
  .sv-card .sv-input[data-k] { width:100%; }
  .sv-card .sv-input[data-k="ta_sistolica"],
  .sv-card .sv-input[data-k="ta_diastolica"] { width:2.6em; }
  .sv-card .sv-sep { font-size:16px; }
}
`

export default function SignosVitalesCard({ value, onChange, errores }: SignosVitalesCardProps) {
  const err = errores ?? new Set<SignoVitalKey>()
  const setField = (field: keyof SignosVitalesForm, val: string) => onChange({ ...value, [field]: val })

  const sys = parseNum(value.ta_sistolica)
  const dia = parseNum(value.ta_diastolica)
  const estadoPA = evaluarPA(sys, dia)

  const singles = SINGLES.map((cfg) => ({
    cfg,
    estado: evaluarEstado(cfg.key, parseNum(value[cfg.key])),
  }))

  const todos: EstadoVital[] = [estadoPA, ...singles.map((s) => s.estado)]
  const fueraCount = todos.filter((e) => e === 'fuera').length
  const vigilarCount = todos.filter((e) => e === 'vigilar').length

  let badgeText: string
  let badgeStyle: { color: string; background: string }
  if (fueraCount > 0) {
    badgeText = `${fueraCount} fuera de rango`
    badgeStyle = { color: 'var(--sp-vital-out)', background: 'var(--sp-danger-bg)' }
  } else if (vigilarCount > 0) {
    badgeText = `${vigilarCount} a vigilar`
    badgeStyle = { color: 'var(--sp-vital-watch)', background: 'var(--sp-warn-bg)' }
  } else {
    badgeText = 'Todo en rango'
    badgeStyle = { color: 'var(--sp-vital-ok)', background: 'var(--sp-success-bg)' }
  }

  const paError = err.has('ta_sistolica') || err.has('ta_diastolica')

  return (
    <div
      className="sv-card"
      style={{
        background: 'var(--sp-surface)',
        border: '1px solid var(--sp-line-card)',
        borderRadius: 16,
        // Sombra literal a propósito: C0 no tiene token de dos capas, y en
        // oscuro una sombra azul al 35% sobre #121212 es invisible — no hay
        // defecto que corregir, y tokenizarla cambiaría el modo claro.
        boxShadow: '0 1px 2px rgba(16,42,67,.04), 0 12px 30px -22px rgba(16,42,67,.35)',
        overflow: 'hidden',
      }}
    >
      <style>{CSS}</style>

      <div className="sv-header">
        <span className="sv-chip">
          <Activity size={16} stroke="var(--sp-vital-ok)" />
        </span>
        <span className="sv-titles">
          <span className="sv-title">Signos vitales</span>
          <span className="sv-sub">· alerta valores fuera de rango</span>
        </span>
        <span className="sv-badge" style={badgeStyle} aria-live="polite">
          {badgeText}
        </span>
      </div>

      <div className="sv-grid">
        {/* Presión arterial (tile combinado sys/dia) */}
        <div className={`sv-tile${paError ? ' sv-tile--error' : ''}`}>
          <div className="sv-bar" style={{ background: ACCENT[estadoPA] }} />
          <label className="sv-body">
            <div className="sv-label-row">
              <span
                className="sv-dot"
                style={{ background: ACCENT[estadoPA] }}
                role="img"
                aria-label={ESTADO_LABEL[estadoPA]}
                title={ESTADO_LABEL[estadoPA]}
              />
              <span className="sv-label sv-label--lg">Presión arterial</span>
              <span className="sv-label sv-label--sm">PA · mmHg</span>
            </div>
            <div className="sv-value-row">
              <input
                className="sv-input"
                data-k="ta_sistolica"
                data-estado={estadoPA}
                type="number"
                inputMode="numeric"
                aria-label="Presión arterial sistólica"
                placeholder="—"
                value={value.ta_sistolica ?? ''}
                onChange={(e) => setField('ta_sistolica', e.target.value)}
              />
              <span className="sv-sep">/</span>
              <input
                className="sv-input"
                data-k="ta_diastolica"
                data-estado={estadoPA}
                type="number"
                inputMode="numeric"
                aria-label="Presión arterial diastólica"
                placeholder="—"
                value={value.ta_diastolica ?? ''}
                onChange={(e) => setField('ta_diastolica', e.target.value)}
              />
              <span className="sv-unit">mmHg</span>
            </div>
          </label>
        </div>

        {/* Resto de signos (un input cada uno) */}
        {singles.map(({ cfg, estado }) => {
          const tileError = err.has(cfg.key)
          return (
            <div key={cfg.key} className={`sv-tile${tileError ? ' sv-tile--error' : ''}`}>
              <div className="sv-bar" style={{ background: ACCENT[estado] }} />
              <label className="sv-body">
                <div className="sv-label-row">
                  <span
                    className="sv-dot"
                    style={{ background: ACCENT[estado] }}
                    role="img"
                    aria-label={ESTADO_LABEL[estado]}
                    title={ESTADO_LABEL[estado]}
                  />
                  <span className="sv-label sv-label--lg">{cfg.label}</span>
                  <span className="sv-label sv-label--sm">{cfg.short}</span>
                </div>
                <div className="sv-value-row">
                  <input
                    className="sv-input"
                    data-k={cfg.key}
                    data-estado={estado}
                    type="number"
                    inputMode={cfg.inputMode}
                    step={'step' in cfg ? cfg.step : undefined}
                    aria-label={cfg.aria}
                    placeholder="—"
                    value={value[cfg.key] ?? ''}
                    onChange={(e) => setField(cfg.key, e.target.value)}
                  />
                  <span className="sv-unit">{cfg.unit}</span>
                </div>
              </label>
            </div>
          )
        })}
      </div>
    </div>
  )
}
