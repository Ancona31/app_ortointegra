'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronDown, Hash, Mail, Loader2, UserPlus, UserRound, Phone, Ruler,
  ClipboardList, ShieldCheck, AlertTriangle, type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import ModalShell from '@/components/ui/ModalShell'
import { useProfile } from '@/hooks/useProfile'
import { validarEmail, validarTelefono, formatearTelefono } from '@/lib/validaciones'
import { secureStorage } from '@/lib/secureStorage'
import { toTitleCase, fechaHoyISO, FECHA_MIN_NACIMIENTO, edadAFechaFicticia } from '@/lib/patientUtils'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import type { DuplicatePatientResponse } from '@/types'

type Medico = {
  id: string
  titulo: string | null
  nombres: string | null
  apellido_paterno: string | null
  apellido_materno: string | null
  especialidad: string | null
}

const MEDICOS_CACHE_KEY = 'cache_medicos_clinica'

/* ═══ Rediseño B6 (maqueta `final-form`, vista «nuevo»; CALMA §6, §12, §14,
   §20, §23) ═══════════════════════════════════════════════════════════════
   Grupos con rótulo en `--enlace` y una tarjeta-lista de filas «rótulo —
   campo»: rótulo encima en `ext`/`tel`, a la izquierda en `ih`/`iv`/`esc`.
   El campo no lleva caja: la fila entera se marca al enfocar. Columna
   centrada de 680 (600 en `iv`). La MISMA pieza vive copiada en
   `expediente/[id]/editar/page.tsx` (duplicar antes que abstraer, P4). */
const campoCls = 'block w-full min-w-0 border-0 bg-transparent k-campo-sin-caja p-0 text-[16px] leading-6 text-tinta outline-none placeholder:text-tinta3 ih:text-[15px] esc:text-[15px]'

function Grupo({ icono: Icono, titulo, children }: { icono: LucideIcon; titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 px-5 text-[13px] leading-[18px] font-bold uppercase tracking-[.4px] text-enlace">
        <Icono size={16} aria-hidden="true" />
        {titulo}
      </h2>
      <div className="k-tarjeta k-lista">
        <div className="k-lista">{children}</div>
      </div>
    </section>
  )
}

interface FilaProps {
  etiqueta: string
  requerido?: boolean
  ayuda?: string
  error?: string | null
  /** `label` asocia el rótulo con su campo; `div` para una fila sin campo. */
  como?: 'label' | 'div'
  children: React.ReactNode
}

const FILA = [
  'grid gap-1 py-2.5',
  'ih:grid-cols-[180px_minmax(0,1fr)] iv:grid-cols-[180px_minmax(0,1fr)] esc:grid-cols-[196px_minmax(0,1fr)]',
  'ih:items-center iv:items-center esc:items-center ih:gap-x-4 iv:gap-x-4 esc:gap-x-4 ih:min-h-12 iv:min-h-12 esc:min-h-12',
  'focus-within:rounded-[12px] focus-within:outline-2 focus-within:outline-solid focus-within:outline-offset-[6px] focus-within:outline-enlace',
].join(' ')

function Fila({ etiqueta, requerido, ayuda, error, como = 'label', children }: FilaProps) {
  const Elemento = como
  return (
    <Elemento className={FILA}>
      <span className="text-[13px] leading-[18px] text-tinta2 ih:text-[15px] iv:text-[15px] esc:text-[15px] ih:leading-5 iv:leading-5 esc:leading-5">
        {etiqueta}{requerido && <span className="text-mal-tinta"> *</span>}
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        {children}
        {error && <span className="k-campo-error">{error}</span>}
        {ayuda && <span className="k-campo-ayuda">{ayuda}</span>}
      </span>
    </Elemento>
  )
}

const SEXOS = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
  { value: 'Otro', label: 'Otro' },
] as const

/* Sexo: el `<select>` de antes como segmentado (maqueta). Son radios de
   verdad con `required`: el navegador sigue exigiéndolo al guardar. */
function FilaSexo({ valor, onCambio }: { valor: string; onCambio: (v: string) => void }) {
  return (
    <div role="radiogroup" aria-labelledby="sexo-etiqueta" className={FILA}>
      <span id="sexo-etiqueta" className="text-[13px] leading-[18px] text-tinta2 ih:text-[15px] iv:text-[15px] esc:text-[15px] ih:leading-5 iv:leading-5 esc:leading-5">
        Sexo<span className="text-mal-tinta"> *</span>
      </span>
      <span className="k-seg w-full max-w-[300px]">
        {SEXOS.map(s => (
          <label key={s.value} className="k-seg-op flex-1 cursor-pointer has-[:checked]:bg-sup has-[:checked]:font-semibold has-[:checked]:text-tinta has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-enlace">
            <input type="radio" name="sexo" value={s.value} checked={valor === s.value}
              onChange={() => onCambio(s.value)} required className="sr-only" />
            {s.label}
          </label>
        ))}
      </span>
    </div>
  )
}

type AvisoDuplicado = { id: string; nombre: string; apellidos: string; numero_expediente: string | null; existingPatientIsMine: boolean }

/* El mensaje de la alerta «Paciente duplicado»: los tres textos de siempre,
   sin el «⚠️» del principio (el icono de la alerta ya lo dice). */
function MensajeDuplicado({ d, esMedicoInvitado }: { d: AvisoDuplicado; esMedicoInvitado: boolean }) {
  const exp = d.numero_expediente ? ` (Exp. #${d.numero_expediente})` : ''
  if (d.existingPatientIsMine) {
    return <p>Este paciente ya está en tu lista de pacientes: {d.nombre} {d.apellidos}{exp}</p>
  }
  if (esMedicoInvitado) {
    return <p>Este paciente ya está registrado en tu clínica, pero no aparece en tu lista porque aún no es tu paciente: {d.nombre} {d.apellidos}{exp}. ¿Deseas vincularlo a tus pacientes?</p>
  }
  return <p>Ya existe un paciente con los mismos datos: {d.nombre} {d.apellidos}{exp}. ¿Es el mismo paciente o una persona distinta?</p>
}

export default function NuevoPacientePage() {
  const router = useRouter()
  const { profile } = useProfile()
  const [form, setForm] = useState<Record<string, string>>({})
  const [edad, setEdad] = useState('')
  const [medicoSeleccionado, setMedicoSeleccionado] = useState('')
  const [medicos, setMedicos] = useState<Medico[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandido, setExpandido] = useState(false)
  const [consentimiento, setConsentimiento] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<{ id: string; nombre: string; apellidos: string; numero_expediente: string | null; existingPatientIsMine: boolean } | null>(null)
  const [vincularError, setVincularError] = useState<string | null>(null)
  const [vinculando, setVinculando] = useState(false)
  const forceCreateRef = useRef(false)

  const isSecretaria = profile?.role === 'secretaria'
  const esMedicoInvitado = profile?.role === 'medico' && profile?.es_admin_de_clinica !== true

  // Cargar lista de médicos (secretaria) — red primero, cache como fallback
  useEffect(() => {
    if (!isSecretaria) return

    let cancelled = false

    async function cargarMedicos() {
      // Intento online
      try {
        const r = await fetch('/api/clinica/medicos')
        if (!r.ok) throw new Error('fetch failed')
        const { medicos: lista } = await r.json() as { medicos: Medico[] }
        if (cancelled) return
        const rows = lista || []
        setMedicos(rows)
        // Cachear para futuros accesos offline
        secureStorage.set(MEDICOS_CACHE_KEY, rows).catch(() => {})
      } catch {
        // Fallback offline: leer del cache
        try {
          const cached = await secureStorage.get<Medico[]>(MEDICOS_CACHE_KEY)
          if (!cancelled && Array.isArray(cached)) setMedicos(cached)
        } catch {
          // silencioso
        }
      }
    }

    cargarMedicos()
    return () => { cancelled = true }
  }, [isSecretaria])

  function set(key: string, val: string) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  function parseTallaCm(val: string): number | null {
    const n = parseFloat(val)
    if (!n || n <= 0) return null
    return n <= 3 ? Math.round(n * 100 * 10) / 10 : Math.round(n * 10) / 10
  }

  function calcularIMC() {
    const peso = parseFloat(form.peso_kg || '0')
    const tallaCm = parseTallaCm(form.talla_cm || '0')
    if (!peso || !tallaCm) return null
    return (peso / Math.pow(tallaCm / 100, 2)).toFixed(1)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isSecretaria && !medicoSeleccionado) {
      setError('Debes seleccionar un médico para asignar el paciente')
      return
    }
    if (!consentimiento) {
      setError('Debes marcar el consentimiento del aviso de privacidad')
      return
    }
    const errTel = validarTelefono(form.telefono || '')
    const errEmail = validarEmail(form.email || '')
    if (errTel || errEmail) {
      setError(errTel || errEmail || 'Revisa los campos')
      return
    }
    setLoading(true)
    setError('')

    const tallaCm = parseTallaCm(form.talla_cm || '')
    const imc = calcularIMC()

    // Resolver fecha_nacimiento priorizando fecha explícita sobre edad
    let fecha_nacimiento: string | null = null
    if (form.fecha_nacimiento) {
      fecha_nacimiento = form.fecha_nacimiento
    } else if (edad.trim()) {
      const edadNum = parseInt(edad, 10)
      if (!isNaN(edadNum) && edadNum >= 0 && edadNum <= 120) {
        fecha_nacimiento = edadAFechaFicticia(edadNum)
      }
    }

    const payload = {
      ...form,
      nombre: toTitleCase(form.nombre ?? ''),
      apellidos: toTitleCase(form.apellidos ?? ''),
      fecha_nacimiento,
      peso_kg: form.peso_kg ? Math.round(parseFloat(form.peso_kg) * 10) / 10 : null,
      talla_cm: tallaCm,
      imc: imc ? parseFloat(imc) : null,
      medico_id: isSecretaria ? medicoSeleccionado : undefined,
      consentimiento_otorgado: true,
      ...(forceCreateRef.current ? { forceCreate: true } : {}),
    }

    // Intento online con try/catch
    try {
      const res = await fetch('/api/pacientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))

      if (res.status === 409 && (data as DuplicatePatientResponse).error === 'DUPLICATE_PATIENT') {
        const dupData = data as DuplicatePatientResponse
        setDuplicateWarning({
          id: dupData.existingPatient.id,
          nombre: dupData.existingPatient.nombre,
          apellidos: dupData.existingPatient.apellidos,
          numero_expediente: dupData.existingPatient.numero_expediente,
          existingPatientIsMine: (dupData.existingPatientIsMine ?? false),
        })
        setLoading(false)
        return
      }

      if (!res.ok) {
        setError('Error al guardar: ' + (data.message || data.error || 'Error desconocido'))
        setLoading(false)
        return
      }
      router.push(isSecretaria ? '/expediente' : `/expediente/${data.id}`)
    } catch {
      setError("Error de conexion. Verifica tu internet e intenta de nuevo.")
      setLoading(false)
    }
  }

  async function handleVincular() {
    if (!duplicateWarning) return
    setVinculando(true)
    setVincularError(null)
    try {
      const res = await fetch(`/api/pacientes/${duplicateWarning.id}/vincular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isSecretaria ? { medico_id: medicoSeleccionado } : {}),
      })
      if (!res.ok) {
        setVincularError('No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.')
        setVinculando(false)
        return
      }
      // Éxito: el médico queda vinculado al paciente existente → ir a su expediente
      router.push(isSecretaria ? '/expediente' : `/expediente/${duplicateWarning.id}`)
    } catch {
      setVincularError('No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.')
      setVinculando(false)
    }
  }

  function cancelarDuplicado() {
    setDuplicateWarning(null)
    setVincularError(null)
  }

  const imc = calcularIMC()

  return (
    <div className="mx-auto w-full max-w-[680px] iv:max-w-[600px] animate-slide-up">

      {/* Cabecera compacta (CALMA §6, §20: «‹ Expediente»), la misma que las
          demás pantallas del paciente: alto de toque del formato y título a 4 px. */}
      <Link href="/expediente" className="k-b k-b-texto -ml-1 h-[var(--k-toque)] text-[13px]">
        <ChevronLeft size={16} aria-hidden="true" />
        <span>Expediente</span>
      </Link>
      <h1 className="k-t-pantalla mt-1">Nuevo paciente</h1>

      <form onSubmit={handleSubmit} className="mt-5 space-y-6">

        {/* Asignación — solo secretaria */}
        {isSecretaria && (
          <Grupo icono={UserPlus} titulo="Asignación">
            <Fila etiqueta="Médico responsable" requerido>
              <select value={medicoSeleccionado} onChange={e => setMedicoSeleccionado(e.target.value)} required className={campoCls}>
                <option value="">Seleccionar médico...</option>
                {medicos.map(m => (
                  <option key={m.id} value={m.id}>
                    {componerNombreMedicoCompleto(m)}{m.especialidad ? ` — ${m.especialidad}` : ''}
                  </option>
                ))}
              </select>
              {medicos.length === 0 && (
                <span className="text-[13px] leading-[18px] text-aviso-tinta">
                  No hay médicos disponibles. Si estás sin conexión, conéctate al menos una vez para sincronizar la lista.
                </span>
              )}
            </Fila>
          </Grupo>
        )}

        {/* Datos esenciales */}
        <Grupo icono={UserRound} titulo="Datos del paciente">
          <Fila etiqueta="Nombre(s)" requerido>
            <input type="text" value={form.nombre || ''} onChange={e => set('nombre', e.target.value)}
              placeholder="Juan Carlos" required className={campoCls} />
          </Fila>
          <Fila etiqueta="Apellidos" requerido>
            <input type="text" value={form.apellidos || ''} onChange={e => set('apellidos', e.target.value)}
              placeholder="García López" required className={campoCls} />
          </Fila>
          <Fila etiqueta="Fecha de nacimiento">
            <input type="date" value={form.fecha_nacimiento || ''} onChange={e => set('fecha_nacimiento', e.target.value)}
              min={FECHA_MIN_NACIMIENTO} max={fechaHoyISO()} className={campoCls} />
          </Fila>
          <Fila etiqueta="Edad (opcional)" ayuda="Si no conoces la fecha exacta, ingresa solo la edad">
            <input
              type="number"
              min={0}
              max={120}
              value={edad}
              onChange={e => setEdad(e.target.value)}
              placeholder="Ej. 35"
              className={campoCls}
            />
          </Fila>
          <FilaSexo valor={form.sexo || ''} onCambio={v => set('sexo', v)} />
          <p className="flex items-center gap-2 py-3 text-[14px] leading-5 text-tinta2">
            <Hash size={16} aria-hidden="true" className="flex-none text-enlace" />
            El número de expediente se genera automáticamente al guardar
          </p>
        </Grupo>

        {/* Datos adicionales — colapsados */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setExpandido(e => !e)}
            aria-expanded={expandido}
            className="k-tarjeta flex w-full items-center justify-between gap-3 py-3.5 text-left transition-opacity active:opacity-70"
          >
            <span className="min-w-0">
              <span className="block text-[15px] leading-5 font-semibold text-tinta">Datos adicionales</span>
              <span className="mt-0.5 block text-[13px] leading-[18px] text-tinta2">Contacto, antropometría y antecedentes — puedes completarlos después</span>
            </span>
            <ChevronDown size={18} aria-hidden="true" className={`flex-none text-tinta2 transition-transform duration-200 motion-reduce:transition-none ${expandido ? 'rotate-180' : ''}`} />
          </button>
          {/* El aviso del email (antes, caja ámbar arriba del formulario). */}
          <p className="flex items-start gap-2 px-5 text-[13px] leading-[18px] text-tinta2">
            <Mail size={14} aria-hidden="true" className="mt-0.5 flex-none text-aviso-tinta" />
            <span>Para poder enviarle documentos al paciente, agrega su <strong className="font-semibold text-tinta">email</strong> en los datos adicionales</span>
          </p>
        </div>

        {expandido && (
          <>
            {/* Contacto */}
            <Grupo icono={Phone} titulo="Contacto">
              <Fila etiqueta="Teléfono" error={form.telefono ? validarTelefono(form.telefono) : null}>
                <input type="tel" inputMode="numeric" value={form.telefono || ''} onChange={e => set('telefono', formatearTelefono(e.target.value))}
                  placeholder="999 123 4567" maxLength={12} className={campoCls} />
              </Fila>
              <Fila etiqueta="Email" ayuda="Necesario para enviar documentos" error={form.email ? validarEmail(form.email) : null}>
                <input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)}
                  placeholder="paciente@email.com" className={campoCls} />
              </Fila>
              <Fila etiqueta="Dirección">
                <input type="text" value={form.direccion || ''} onChange={e => set('direccion', e.target.value)}
                  placeholder="Calle, colonia, ciudad" className={campoCls} />
              </Fila>
            </Grupo>

            {/* Antropometría */}
            <Grupo icono={Ruler} titulo="Antropometría">
              <Fila etiqueta="Peso (kg)">
                <input type="number" value={form.peso_kg || ''} onChange={e => set('peso_kg', e.target.value)}
                  placeholder="70" className={campoCls} />
              </Fila>
              <Fila etiqueta="Talla (cm o m)">
                <input type="number" value={form.talla_cm || ''} onChange={e => set('talla_cm', e.target.value)}
                  placeholder="170 ó 1.70" className={campoCls} />
              </Fila>
              {imc && (
                <Fila etiqueta="IMC calculado" como="div">
                  <span className="k-etq k-etq-tonal self-start k-num">{imc} kg/m²</span>
                </Fila>
              )}
            </Grupo>

            {/* Antecedentes */}
            <Grupo icono={ClipboardList} titulo="Antecedentes">
              {[
                { key: 'alergias',             label: 'Alergias',                    placeholder: 'Medicamentos, alimentos...' },
                { key: 'ant_no_patologicos',    label: 'Antecedentes personales no patológicos', placeholder: 'Tabaquismo, alcoholismo, actividad física, alimentación...' },
                { key: 'ant_patologicos',       label: 'Antecedentes patológicos',    placeholder: 'DM2, HTA, hipotiroidismo...' },
                { key: 'ant_quirurgicos',       label: 'Antecedentes quirúrgicos',    placeholder: 'Cirugías previas...' },
                { key: 'ant_familiares',        label: 'Antecedentes familiares',     placeholder: 'Enfermedades relevantes en familia...' },
                { key: 'medicamentos_actuales', label: 'Medicamentos actuales',       placeholder: 'Lista de medicamentos...' },
              ].map(({ key, label, placeholder }) => (
                <Fila key={key} etiqueta={label}>
                  <textarea value={form[key] || ''} onChange={e => set(key, e.target.value)}
                    placeholder={placeholder} rows={2}
                    className={`${campoCls} resize-none`} />
                </Fila>
              ))}
            </Grupo>
          </>
        )}

        {/* Paciente duplicado (CALMA §20, §23.7): alerta del catálogo, tres
            botones apilados con el principal arriba. Mismos textos y acciones. */}
        <ModalShell
          open={!!duplicateWarning}
          onClose={() => { if (!vinculando) cancelarDuplicado() }}
          title="Paciente duplicado"
          variante="alerta"
          tono="avisar"
          apilada
          icon={<AlertTriangle aria-hidden="true" />}
          footer={duplicateWarning && (
            <>
              {duplicateWarning.existingPatientIsMine ? (
                <button
                  type="button"
                  data-principal
                  autoFocus
                  onClick={() => router.push(isSecretaria ? '/expediente' : `/expediente/${duplicateWarning.id}`)}
                  className="k-b k-b-capa k-b-prim"
                >
                  Ir a su expediente
                </button>
              ) : (
                <button
                  type="button"
                  data-principal
                  autoFocus
                  onClick={handleVincular}
                  disabled={vinculando}
                  className="k-b k-b-capa k-b-prim"
                >
                  {vinculando ? <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Vinculando...</> : 'Es el mismo paciente'}
                </button>
              )}
              <button
                type="button"
                disabled={vinculando}
                onClick={() => {
                  setDuplicateWarning(null)
                  setVincularError(null)
                  forceCreateRef.current = true
                  // Re-submit programmatically
                  const formEl = document.querySelector('form')
                  if (formEl) formEl.requestSubmit()
                }}
                className="k-b k-b-capa k-b-tonal"
              >
                Es otra persona, crear de todos modos
              </button>
              <button
                type="button"
                disabled={vinculando}
                onClick={cancelarDuplicado}
                className="k-b k-b-capa k-b-quieto"
              >
                Cancelar
              </button>
            </>
          )}
        >
          {duplicateWarning && <MensajeDuplicado d={duplicateWarning} esMedicoInvitado={esMedicoInvitado} />}
          {vincularError && <p className="font-semibold text-mal-tinta">{vincularError}</p>}
        </ModalShell>

        {/* Consentimiento de privacidad — LFPDPPP. Obligatorio antes de crear
            (la comprobación vive en `handleSubmit`). Casilla a la derecha de
            su texto (CALMA §20). */}
        <label className="k-tarjeta flex cursor-pointer items-center gap-3 py-3.5">
          <span aria-hidden="true" className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] bg-tonal text-tonal-tinta">
            <ShieldCheck size={16} />
          </span>
          <span className="min-w-0 flex-1 text-[15px] leading-5 text-tinta">
            {/* Privacidad 2026-12: un solo texto en las cuatro altas, y SIN enlace:
                `/privacidad` es ahora el aviso de Spinus para sus usuarios, no
                el del consultorio para sus pacientes. */}
            Informé al paciente del aviso de privacidad del consultorio
            <span aria-hidden="true" className="text-mal-tinta"> *</span>
          </span>
          <input
            type="checkbox"
            checked={consentimiento}
            onChange={e => setConsentimiento(e.target.checked)}
            className="h-[22px] w-[22px] flex-none cursor-pointer accent-[var(--accion)]"
          />
        </label>

        {/* Acciones: fijas al pie en `ext`/`tel` (sticky, no `fixed`: no toca
            la franja); en ancho, el par a la derecha; en `iv`, centrado (§23.1). */}
        <div className="flex flex-wrap gap-2.5 pt-1 pb-8 ih:justify-end esc:justify-end iv:justify-center ext:sticky tel:sticky ext:bottom-0 tel:bottom-0 ext:z-10 tel:z-10 ext:-mx-4 tel:-mx-4 ext:bg-fondo tel:bg-fondo ext:px-4 tel:px-4 ext:py-3 tel:py-3 ext:pb-[calc(var(--ib)+12px)] tel:pb-[calc(var(--ib)+12px)]">
          {/* El error va DENTRO del pie: en `ext`/`tel` el pie queda fijo abajo
              y el aviso se ve sin desplazar. */}
          {error && (
            <div role="alert" className="basis-full rounded-[12px] bg-mal-fondo px-4 py-3 text-[14px] leading-5 text-mal-tinta">{error}</div>
          )}
          <Link href="/expediente" className="k-b k-b-quieto ext:px-3">
            Cancelar
          </Link>
          <button type="submit" disabled={loading || vinculando} className="k-b k-b-prim min-w-0 ext:flex-1 tel:flex-1 ext:h-auto ext:min-h-10 ext:whitespace-normal ext:px-2.5 ext:py-2 ext:text-[14px] ext:leading-[18px]">
            {loading ? <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Guardando...</> : 'Registrar e ir al expediente'}
          </button>
        </div>

      </form>
    </div>
  )
}
