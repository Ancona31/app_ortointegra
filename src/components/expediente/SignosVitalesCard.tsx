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

// valor de texto / accent de la barra-indicador, por estado
const COLORS: Record<EstadoVital, { valor: string; accent: string }> = {
  vacio: { valor: '#8298ae', accent: '#d6e0ea' },
  normal: { valor: '#17976a', accent: '#2fb488' },
  vigilar: { valor: '#c07d10', accent: '#e6a521' },
  fuera: { valor: '#c62f3b', accent: '#e5484d' },
}

const ESTADO_LABEL: Record<EstadoVital, string> = {
  vacio: 'Sin capturar',
  normal: 'Normal',
  vigilar: 'A vigilar',
  fuera: 'Fuera de rango',
}

const SINGLES = [
  { key: 'fc', label: 'FREC. CARDÍACA', unit: 'lpm', aria: 'Frecuencia cardíaca', width: 46, inputMode: 'numeric' },
  { key: 'fr', label: 'FREC. RESP.', unit: 'rpm', aria: 'Frecuencia respiratoria', width: 42, inputMode: 'numeric' },
  { key: 'temp', label: 'TEMPERATURA', unit: '°C', aria: 'Temperatura', width: 52, inputMode: 'decimal', step: '0.1' },
  { key: 'spo2', label: 'SpO₂', unit: '%', aria: 'Saturación de oxígeno', width: 46, inputMode: 'numeric' },
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
.sv-card .sv-header { display:flex; align-items:center; gap:10px; padding:10px 18px; border-bottom:1px solid #eef2f7; }
.sv-card .sv-chip { width:26px; height:26px; border-radius:8px; background:#eaf4ef; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.sv-card .sv-titles { display:flex; align-items:baseline; gap:6px; min-width:0; flex-wrap:wrap; }
.sv-card .sv-title { font-size:15px; font-weight:800; color:#16324c; line-height:1.1; }
.sv-card .sv-sub { font-size:12px; color:#9fb1c2; }
.sv-card .sv-badge { margin-left:auto; border-radius:20px; font-size:12px; font-weight:700; padding:6px 13px; white-space:nowrap; flex-shrink:0; }
.sv-card .sv-grid { display:grid; grid-template-columns:1.9fr 1fr 1fr 1fr 1fr; gap:12px; padding:12px 18px; }
.sv-card .sv-tile { position:relative; background:#fbfdff; border:1px solid #e6edf4; border-radius:14px; overflow:hidden; min-width:0; }
.sv-card .sv-tile--error { box-shadow: inset 0 0 0 1px #e5484d; border-color:#e5484d; }
.sv-card .sv-bar { height:3px; width:100%; }
.sv-card .sv-body { padding:7px 13px 9px; }
.sv-card .sv-label-row { display:flex; align-items:center; gap:5px; margin-bottom:3px; }
.sv-card .sv-dot { width:9px; height:9px; border-radius:9999px; flex-shrink:0; }
.sv-card .sv-label { font-size:11px; font-weight:700; letter-spacing:.04em; color:#6b8299; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sv-card .sv-value-row { display:flex; align-items:baseline; gap:4px; }
.sv-card .sv-sep { font-size:22px; font-weight:700; color:#c2cfdb; }
.sv-card .sv-unit { font-size:12px; font-weight:600; color:#9fb1c2; }
.sv-card .sv-input { border:none; outline:none; background:transparent; font-weight:800; font-size:19px; padding:0; max-width:100%; -moz-appearance:textfield; }
.sv-card .sv-input::-webkit-outer-spin-button,
.sv-card .sv-input::-webkit-inner-spin-button { -webkit-appearance:none; margin:0; }
.sv-card .sv-input::placeholder { color:#9fb1c2; font-weight:800; }
@media (max-width:767px) {
  .sv-card { flex-shrink:0; }
  .sv-card .sv-grid { grid-template-columns:1.45fr 1fr 1fr 1fr 1fr; gap:0; padding:0; }
  .sv-card .sv-tile { background:transparent; border:none; border-right:1px solid #eef2f7; border-radius:0; }
  .sv-card .sv-tile:last-child { border-right:none; }
  .sv-card .sv-body { padding:8px 3px 10px; }
  .sv-card .sv-dot { display:none; }
  .sv-card .sv-input { font-size:15px; }
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
    badgeStyle = { color: '#c62f3b', background: '#fdeded' }
  } else if (vigilarCount > 0) {
    badgeText = `${vigilarCount} a vigilar`
    badgeStyle = { color: '#c07d10', background: '#fdf7ec' }
  } else {
    badgeText = 'Todo en rango'
    badgeStyle = { color: '#17976a', background: '#e7f6ef' }
  }

  const paError = err.has('ta_sistolica') || err.has('ta_diastolica')

  return (
    <div
      className="sv-card"
      style={{
        background: '#fff',
        border: '1px solid #e2ebf3',
        borderRadius: 16,
        boxShadow: '0 1px 2px rgba(16,42,67,.04), 0 12px 30px -22px rgba(16,42,67,.35)',
        overflow: 'hidden',
      }}
    >
      <style>{CSS}</style>

      <div className="sv-header">
        <span className="sv-chip">
          <Activity size={16} stroke="#17976a" />
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
          <div className="sv-bar" style={{ background: COLORS[estadoPA].accent }} />
          <div className="sv-body">
            <div className="sv-label-row">
              <span
                className="sv-dot"
                style={{ background: COLORS[estadoPA].accent }}
                role="img"
                aria-label={ESTADO_LABEL[estadoPA]}
                title={ESTADO_LABEL[estadoPA]}
              />
              <span className="sv-label">Presión arterial</span>
            </div>
            <div className="sv-value-row">
              <input
                className="sv-input"
                type="number"
                inputMode="numeric"
                aria-label="Presión arterial sistólica"
                placeholder="—"
                style={{ width: 34, color: COLORS[estadoPA].valor }}
                value={value.ta_sistolica ?? ''}
                onChange={(e) => setField('ta_sistolica', e.target.value)}
              />
              <span className="sv-sep">/</span>
              <input
                className="sv-input"
                type="number"
                inputMode="numeric"
                aria-label="Presión arterial diastólica"
                placeholder="—"
                style={{ width: 30, color: COLORS[estadoPA].valor }}
                value={value.ta_diastolica ?? ''}
                onChange={(e) => setField('ta_diastolica', e.target.value)}
              />
              <span className="sv-unit">mmHg</span>
            </div>
          </div>
        </div>

        {/* Resto de signos (un input cada uno) */}
        {singles.map(({ cfg, estado }) => {
          const tileError = err.has(cfg.key)
          return (
            <div key={cfg.key} className={`sv-tile${tileError ? ' sv-tile--error' : ''}`}>
              <div className="sv-bar" style={{ background: COLORS[estado].accent }} />
              <div className="sv-body">
                <div className="sv-label-row">
                  <span
                    className="sv-dot"
                    style={{ background: COLORS[estado].accent }}
                    role="img"
                    aria-label={ESTADO_LABEL[estado]}
                    title={ESTADO_LABEL[estado]}
                  />
                  <span className="sv-label">{cfg.label}</span>
                </div>
                <div className="sv-value-row">
                  <input
                    className="sv-input"
                    type="number"
                    inputMode={cfg.inputMode}
                    step={'step' in cfg ? cfg.step : undefined}
                    aria-label={cfg.aria}
                    placeholder="—"
                    style={{ width: cfg.width, color: COLORS[estado].valor }}
                    value={value[cfg.key] ?? ''}
                    onChange={(e) => setField(cfg.key, e.target.value)}
                  />
                  <span className="sv-unit">{cfg.unit}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
