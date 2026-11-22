'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import ModalShell from '@/components/ui/ModalShell'
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

/* ═══ SIGNOS VITALES PLEGADOS (rediseño, maqueta `final-nota` vistas 1, 4, 5 y 7) ═══
   Antes eran cinco mosaicos en una rejilla de cinco columnas: en `ext`/`tel`
   los rótulos se abreviaban, se cortaban y chocaban con los valores. Ahora:
     · en la tarjeta de captura, UNA fila «Signos vitales ›» con el resumen
       («Sin capturar», o los valores en su color de semáforo y la etiqueta
       «n fuera de rango» / «n a vigilar»);
     · al pulsarla, una capa del catálogo (hoja en `tel`, tarjeta en el resto)
       con una fila por signo: nombre completo, campo con área de toque propia
       y la unidad.
   Mismos seis campos, mismos `aria-label`, mismo semáforo y misma validación:
   si el padre marca errores (validación dura), la capa se abre sola para que
   el campo en rojo quede a la vista. El CSS del color del valor vive en
   `spinus-tokens.css` §14 (dentro de `@layer components`, para ganar a la hoja
   oscura de ThemeProvider). */

const SINGLES = [
  { key: 'fc', label: 'Frecuencia cardíaca', unit: 'lpm', aria: 'Frecuencia cardíaca', inputMode: 'numeric' },
  { key: 'fr', label: 'Frecuencia respiratoria', unit: 'rpm', aria: 'Frecuencia respiratoria', inputMode: 'numeric' },
  { key: 'temp', label: 'Temperatura', unit: '°C', aria: 'Temperatura', inputMode: 'decimal', step: '0.1' },
  { key: 'spo2', label: 'SpO₂', unit: '%', aria: 'Saturación de oxígeno', inputMode: 'numeric' },
] as const

const ESTADO_LABEL: Record<EstadoVital, string> = {
  vacio: 'Sin capturar',
  normal: 'Normal',
  vigilar: 'A vigilar',
  fuera: 'Fuera de rango',
}

function parseNum(s: string | undefined): number | undefined {
  if (s == null) return undefined
  const t = s.trim()
  if (!t) return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

interface Estados { pa: EstadoVital; singles: Record<(typeof SINGLES)[number]['key'], EstadoVital> }

function calcularEstados(value: SignosVitalesForm): Estados {
  return {
    pa: evaluarPA(parseNum(value.ta_sistolica), parseNum(value.ta_diastolica)),
    singles: {
      fc: evaluarEstado('fc', parseNum(value.fc)),
      fr: evaluarEstado('fr', parseNum(value.fr)),
      temp: evaluarEstado('temp', parseNum(value.temp)),
      spo2: evaluarEstado('spo2', parseNum(value.spo2)),
    },
  }
}

/** Etiqueta de la fila: «n fuera de rango», «n a vigilar», o nada si todo va en rango. */
function Etiqueta({ estados, conErrores }: { estados: Estados; conErrores: boolean }) {
  const todos = [estados.pa, ...Object.values(estados.singles)]
  const fuera = todos.filter(e => e === 'fuera').length
  const vigilar = todos.filter(e => e === 'vigilar').length
  const capturados = todos.filter(e => e !== 'vacio').length
  let texto = ''
  let clase = 'k-etq'
  if (fuera > 0) { texto = `${fuera} fuera de rango`; clase += ' k-etq-mal' }
  else if (conErrores) { texto = 'Revisar'; clase += ' k-etq-mal' }
  else if (vigilar > 0) { texto = `${vigilar} a vigilar`; clase += ' k-etq-aviso' }
  return (
    <>
      {texto && <span className={clase}>{texto}</span>}
      {/* El resumen de antes («Todo en rango») sigue para el lector de pantalla. */}
      <span className="sr-only" aria-live="polite">
        {texto || (capturados > 0 ? 'Todo en rango' : '')}
      </span>
    </>
  )
}

/** Un valor del resumen, en su color de semáforo. */
function Valor({ v, estado }: { v: string; estado: EstadoVital }) {
  return <b className="sv-val k-num" data-estado={estado}>{v}</b>
}

function Resumen({ value, estados }: { value: SignosVitalesForm; estados: Estados }) {
  const partes: React.ReactNode[] = []
  const sys = value.ta_sistolica?.trim()
  const dia = value.ta_diastolica?.trim()
  if (sys || dia) {
    partes.push(
      <span key="pa" className="whitespace-nowrap">
        <Valor v={sys || '—'} estado={estados.pa} />/<Valor v={dia || '—'} estado={estados.pa} />
      </span>,
    )
  }
  for (const cfg of SINGLES) {
    const v = value[cfg.key]?.trim()
    if (!v) continue
    partes.push(
      <span key={cfg.key} className="whitespace-nowrap">
        <Valor v={v} estado={estados.singles[cfg.key]} /> {cfg.unit}
      </span>,
    )
  }
  if (partes.length === 0) return <>Sin capturar</>
  return <>{partes.flatMap((p, i) => (i === 0 ? [p] : [' · ', p]))}</>
}

interface FilaProps {
  etiqueta: string
  unidad: string
  estado: EstadoVital
  children: React.ReactNode
}

/** Una fila de la capa: nombre (y su estado, si no es normal), campo(s) y unidad. */
function Fila({ etiqueta, unidad, estado, children }: FilaProps) {
  const aviso = estado === 'fuera' || estado === 'vigilar'
  return (
    <div className="flex min-h-[56px] items-center gap-3 py-1.5 ih:min-h-[52px] esc:min-h-[52px]">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-5 text-tinta">{etiqueta}</p>
        {aviso && (
          <p className="sv-val text-[12px] font-semibold leading-4" data-estado={estado}>{ESTADO_LABEL[estado]}</p>
        )}
      </div>
      <div className="flex flex-none items-center gap-1.5">{children}</div>
      <span className="w-10 flex-none text-[13px] leading-[18px] text-tinta2">{unidad}</span>
    </div>
  )
}

interface CampoProps {
  k: SignoVitalKey
  aria: string
  estado: EstadoVital
  valor: string | undefined
  error: boolean
  inputMode: 'numeric' | 'decimal'
  step?: string
  autoFocus?: boolean
  onChange: (v: string) => void
}

function Campo({ k, aria, estado, valor, error, inputMode, step, autoFocus, onChange }: CampoProps) {
  return (
    <input
      className="k-campo sv-in k-num w-[68px] px-2 text-center font-semibold"
      data-k={k}
      data-estado={estado}
      type="number"
      inputMode={inputMode}
      step={step}
      aria-label={aria}
      aria-invalid={error || undefined}
      autoFocus={autoFocus}
      placeholder="—"
      value={valor ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export default function SignosVitalesCard({ value, onChange, errores }: SignosVitalesCardProps) {
  const err = errores ?? new Set<SignoVitalKey>()
  const [abierto, setAbierto] = useState(false)
  const setField = (field: keyof SignosVitalesForm, val: string) => onChange({ ...value, [field]: val })
  const estados = calcularEstados(value)

  // Validación dura fallida: el campo en rojo tiene que quedar a la vista. Se
  // ajusta DURANTE el render al cambiar la prop (patrón de React), no en un efecto.
  const [erroresPrevios, setErroresPrevios] = useState(errores)
  if (erroresPrevios !== errores) {
    setErroresPrevios(errores)
    if (errores && errores.size > 0) setAbierto(true)
  }

  return (
    <div className="sv-fila border-b border-[var(--linea)] pb-2">
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-haspopup="dialog"
        className="k-pulsable flex min-h-[44px] w-full items-center gap-2 py-1 text-left"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 esc:flex-row esc:items-center esc:gap-3">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] leading-5 text-tinta">Signos vitales</span>
            <Etiqueta estados={estados} conErrores={err.size > 0} />
          </span>
          <span className="text-[13px] leading-[18px] text-tinta2 esc:ml-auto esc:text-right">
            <Resumen value={value} estados={estados} />
          </span>
        </span>
        <ChevronRight size={16} aria-hidden="true" className="flex-none text-tinta3" />
      </button>

      <ModalShell open={abierto} onClose={() => setAbierto(false)} title="Signos vitales" maxWidth="md:max-w-[440px]">
        <div className="sv-hoja k-lista px-5 pb-5 tel:pb-[calc(var(--ib)+12px)] ext:px-4">
          <Fila etiqueta="Presión arterial" unidad="mmHg" estado={estados.pa}>
            <Campo k="ta_sistolica" aria="Presión arterial sistólica" estado={estados.pa} valor={value.ta_sistolica}
              error={err.has('ta_sistolica')} inputMode="numeric" autoFocus onChange={v => setField('ta_sistolica', v)} />
            <span aria-hidden="true" className="text-tinta3">/</span>
            <Campo k="ta_diastolica" aria="Presión arterial diastólica" estado={estados.pa} valor={value.ta_diastolica}
              error={err.has('ta_diastolica')} inputMode="numeric" onChange={v => setField('ta_diastolica', v)} />
          </Fila>
          {SINGLES.map(cfg => (
            <Fila key={cfg.key} etiqueta={cfg.label} unidad={cfg.unit} estado={estados.singles[cfg.key]}>
              <Campo k={cfg.key} aria={cfg.aria} estado={estados.singles[cfg.key]} valor={value[cfg.key]}
                error={err.has(cfg.key)} inputMode={cfg.inputMode} step={'step' in cfg ? cfg.step : undefined}
                onChange={v => setField(cfg.key, v)} />
            </Fila>
          ))}
        </div>
      </ModalShell>
    </div>
  )
}
