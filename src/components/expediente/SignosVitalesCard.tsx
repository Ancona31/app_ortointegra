'use client'

import { useState } from 'react'
import { ChevronRight, HeartPulse } from 'lucide-react'
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
     · en su tarjeta, encima de la captura, UN botón «Signos vitales ›» con
       una banda de cinco celdas (ajuste 2: el resumen en texto corrido no se
       leía): rótulo corto, valor grande en su color de semáforo, unidad, y en
       la celda fuera de rango o a vigilar, fondo tenue y punto; la etiqueta
       «n fuera de rango» / «n a vigilar» sigue en la cabecera;
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

/* Rótulo corto de cada celda de la banda; el nombre completo va en `title`. */
const CORTO: Record<'pa' | (typeof SINGLES)[number]['key'], string> = {
  pa: 'PA', fc: 'FC', fr: 'FR', temp: 'Temp', spo2: 'SpO₂',
}

interface CeldaProps { k: keyof typeof CORTO; nombre: string; valor: string; unidad: string; estado: EstadoVital }

/** Una celda de la banda: rótulo corto, valor grande y unidad. El estado se
    lee por color, por el fondo de la celda y por un punto (no sólo color). */
function Celda({ k, nombre, valor, unidad, estado }: CeldaProps) {
  const aviso = estado === 'fuera' || estado === 'vigilar'
  return (
    <span className={`sv-celda ${k === 'pa' ? 'sv-celda--pa' : ''}`} data-estado={estado}>
      <span className="flex min-w-0 items-center gap-1">
        <abbr title={nombre} className="sv-celda__rot no-underline">{CORTO[k]}</abbr>
        {aviso && <span className="sv-celda__punto" aria-hidden="true" />}
        {aviso && <span className="sr-only">{ESTADO_LABEL[estado]}</span>}
        <span className="sv-celda__u ml-auto">{unidad}</span>
      </span>
      <b className="sv-val sv-celda__v k-num" data-estado={estado}>{valor || '—'}</b>
    </span>
  )
}

/** La banda de cinco celdas (presión, FC, FR, temperatura, SpO₂). */
function Banda({ value, estados }: { value: SignosVitalesForm; estados: Estados }) {
  const sys = value.ta_sistolica?.trim()
  const dia = value.ta_diastolica?.trim()
  const pa = sys || dia ? `${sys || '—'}/${dia || '—'}` : ''
  return (
    <span className="sv-banda">
      <Celda k="pa" nombre="Presión arterial" valor={pa} unidad="mmHg" estado={estados.pa} />
      {SINGLES.map(cfg => (
        <Celda key={cfg.key} k={cfg.key} nombre={cfg.aria} valor={value[cfg.key]?.trim() ?? ''}
          unidad={cfg.unit} estado={estados.singles[cfg.key]} />
      ))}
    </span>
  )
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

  const vacio = estados.pa === 'vacio' && Object.values(estados.singles).every(e => e === 'vacio')
  return (
    <div className="sv-fila">
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-haspopup="dialog"
        className="sv-boton k-pulsable group block w-full text-left"
      >
        <span className="mb-2.5 flex min-h-[28px] items-center gap-2">
          <span className="inline-flex size-7 flex-none items-center justify-center rounded-full bg-tonal text-enlace" aria-hidden="true">
            <HeartPulse size={16} strokeWidth={2.2} />
          </span>
          <span className="text-[15px] font-semibold leading-5 text-tinta">Signos vitales</span>
          <Etiqueta estados={estados} conErrores={err.size > 0} />
          <span className="ml-auto flex flex-none items-center gap-0.5 text-[14px] font-semibold leading-5 text-enlace">
            {vacio && 'Capturar'}
            <ChevronRight size={16} aria-hidden="true" className="transition-transform duration-[var(--dur-toque)] group-hover:translate-x-0.5" />
          </span>
          {vacio && <span className="sr-only">Sin capturar</span>}
        </span>
        <Banda value={value} estados={estados} />
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
