'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Loader2, UserRound, Phone, Ruler, ClipboardList, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { validarEmail, validarTelefono, formatearTelefono } from '@/lib/validaciones'

type Campo = {
  label: string
  key: string
  type?: string
  placeholder?: string
  options?: { value: string; label: string }[]
  required?: boolean
  hint?: string
  section: string
}

const campos: Campo[] = [
  { section: 'personal', label: 'Nombre(s)', key: 'nombre', required: true, placeholder: 'Ej: Juan Carlos' },
  { section: 'personal', label: 'Apellidos', key: 'apellidos', required: true, placeholder: 'Ej: García López' },
  { section: 'personal', label: 'Fecha de nacimiento', key: 'fecha_nacimiento', type: 'date', hint: 'Recomendable para que la edad aparezca en recetas y documentos. Si se deja vacío, el campo edad quedará en blanco.' },
  { section: 'personal', label: 'Sexo', key: 'sexo', options: [{ value: 'M', label: 'Masculino' }, { value: 'F', label: 'Femenino' }, { value: 'Otro', label: 'Otro' }], required: true },
  { section: 'personal', label: 'N° Expediente', key: 'numero_expediente', placeholder: 'Ej: OI-2025-001' },
  { section: 'antro', label: 'Peso (kg)', key: 'peso_kg', type: 'number', placeholder: '70' },
  { section: 'antro', label: 'Talla (cm o m)', key: 'talla_cm', type: 'number', placeholder: '170 ó 1.70' },
  { section: 'contacto', label: 'Teléfono', key: 'telefono', type: 'tel', placeholder: 'Ej: 999 123 4567' },
  { section: 'contacto', label: 'Email', key: 'email', type: 'email', placeholder: 'paciente@email.com' },
  { section: 'contacto', label: 'Dirección', key: 'direccion', placeholder: 'Calle, colonia, ciudad' },
  { section: 'antecedentes', label: 'Antecedentes personales no patológicos', key: 'ant_no_patologicos', placeholder: 'Tabaquismo, alcoholismo, actividad física, alimentación...' },
  { section: 'antecedentes', label: 'Antecedentes patológicos', key: 'ant_patologicos', placeholder: 'DM2, HTA, hipotiroidismo...' },
  { section: 'antecedentes', label: 'Antecedentes quirúrgicos', key: 'ant_quirurgicos', placeholder: 'Cirugías previas...' },
  { section: 'antecedentes', label: 'Antecedentes familiares', key: 'ant_familiares', placeholder: 'Enfermedades relevantes en familia...' },
  { section: 'antecedentes', label: 'Alergias', key: 'alergias', placeholder: 'Medicamentos, alimentos...' },
  { section: 'antecedentes', label: 'Medicamentos actuales', key: 'medicamentos_actuales', placeholder: 'Lista de medicamentos...' },
]

// Rediseño B6: el orden de las secciones es el de la maqueta `final-form`
// (Contacto antes que Antropometría, como en «Nuevo paciente»).
const secciones: { key: string; label: string; icono: LucideIcon }[] = [
  { key: 'personal',     label: 'Datos personales', icono: UserRound },
  { key: 'contacto',     label: 'Contacto',         icono: Phone },
  { key: 'antro',        label: 'Antropometría',    icono: Ruler },
  { key: 'antecedentes', label: 'Antecedentes',     icono: ClipboardList },
]

/* ═══ Rediseño B6 (maqueta `final-form`, vista «editar») ════════════════════
   La MISMA pieza que `pacientes/nuevo/page.tsx` (grupo con rótulo + tarjeta-
   lista de filas «rótulo — campo»), copiada a propósito (P4). Rótulo encima
   en `ext`/`tel`, a la izquierda en `ih`/`iv`/`esc`; columna centrada. */
const campoCls = 'block w-full min-w-0 border-0 bg-transparent [html.dark_&&]:bg-transparent! p-0 text-[16px] leading-6 text-tinta outline-none placeholder:text-tinta3 ih:text-[15px] esc:text-[15px]'

const FILA = [
  'grid gap-1 py-2.5',
  'ih:grid-cols-[180px_minmax(0,1fr)] iv:grid-cols-[180px_minmax(0,1fr)] esc:grid-cols-[196px_minmax(0,1fr)]',
  'ih:items-center iv:items-center esc:items-center ih:gap-x-4 iv:gap-x-4 esc:gap-x-4 ih:min-h-12 iv:min-h-12 esc:min-h-12',
  'focus-within:rounded-[12px] focus-within:outline-2 focus-within:outline-solid focus-within:outline-offset-[6px] focus-within:outline-enlace',
].join(' ')

const ROTULO = 'text-[13px] leading-[18px] text-tinta2 ih:text-[15px] iv:text-[15px] esc:text-[15px] ih:leading-5 iv:leading-5 esc:leading-5'

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

function Rotulo({ campo, id }: { campo: Campo; id?: string }) {
  return (
    <span id={id} className={ROTULO}>
      {campo.label}{campo.required && <span className="text-mal-tinta"> *</span>}
    </span>
  )
}

/* Sexo: el `<select>` de antes como segmentado (maqueta). Radios de verdad con
   `required`: el navegador sigue exigiéndolo al guardar. */
function FilaOpciones({ campo, valor, onCambio }: { campo: Campo; valor: string; onCambio: (v: string) => void }) {
  const id = `${campo.key}-etiqueta`
  return (
    <div role="radiogroup" aria-labelledby={id} className={FILA}>
      <Rotulo campo={campo} id={id} />
      <span className="k-seg w-full max-w-[300px]">
        {(campo.options ?? []).map(o => (
          <label key={o.value} className="k-seg-op flex-1 cursor-pointer has-[:checked]:bg-sup has-[:checked]:font-semibold has-[:checked]:text-tinta has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-enlace">
            <input type="radio" name={campo.key} value={o.value} checked={valor === o.value}
              onChange={() => onCambio(o.value)} required={campo.required} className="sr-only" />
            {o.label}
          </label>
        ))}
      </span>
    </div>
  )
}

/* Un campo de texto, fecha, número o área, con su error en línea y su nota. */
function FilaCampo({ campo, valor, onCambio }: { campo: Campo; valor: string; onCambio: (v: string) => void }) {
  const esArea = campo.key.includes('ant_') || campo.key === 'medicamentos_actuales'
  const error = campo.key === 'telefono' && valor ? validarTelefono(valor)
    : campo.key === 'email' && valor ? validarEmail(valor) : null
  return (
    <label className={FILA}>
      <Rotulo campo={campo} />
      <span className="flex min-w-0 flex-col gap-1">
        {esArea ? (
          <textarea value={valor} onChange={e => onCambio(e.target.value)} placeholder={campo.placeholder}
            rows={2} className={`${campoCls} resize-none`} />
        ) : (
          <input
            type={campo.type || 'text'}
            inputMode={campo.type === 'tel' ? 'numeric' : undefined}
            maxLength={campo.type === 'tel' ? 12 : undefined}
            value={valor}
            onChange={e => onCambio(campo.key === 'telefono' ? formatearTelefono(e.target.value) : e.target.value)}
            placeholder={campo.placeholder}
            required={campo.required}
            className={campoCls}
          />
        )}
        {error && <span className="k-campo-error">{error}</span>}
        {campo.hint && <span className="k-campo-ayuda">{campo.hint}</span>}
      </span>
    </label>
  )
}

export default function EditarPacientePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [form, setForm] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.from('pacientes').select('*').eq('id', id).single().then((res: { data: Record<string, string | null> | null }) => { const data = res.data;
      if (data) {
        const formData: Record<string, string> = {}
        campos.forEach(c => {
          if (data[c.key] !== null && data[c.key] !== undefined) {
            formData[c.key] = String(data[c.key])
          }
        })
        setForm(formData)
      }
      setLoading(false)
    })
  }, [id])

  function parseTallaCm(val: string): number | null {
    const n = parseFloat(val)
    if (!n || n <= 0) return null
    return n <= 3 ? Math.round(n * 100 * 10) / 10 : Math.round(n * 10) / 10
  }

  function calcularIMC() {
    const peso = parseFloat(form.peso_kg || '0')
    const tallaCm = parseTallaCm(form.talla_cm || '0')
    if (!peso || !tallaCm) return null
    const tallaM = tallaCm / 100
    return (peso / (tallaM * tallaM)).toFixed(1)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errTel = validarTelefono(form.telefono || '')
    const errEmail = validarEmail(form.email || '')
    if (errTel || errEmail) {
      setError(errTel || errEmail || 'Revisa los campos')
      return
    }
    setGuardando(true)
    setError('')
    const imc = calcularIMC()
    const tallaCm = parseTallaCm(form.talla_cm || '')
    const formLimpio = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''))
    const res = await fetch(`/api/pacientes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formLimpio,
        peso_kg: form.peso_kg ? Math.round(parseFloat(form.peso_kg) * 10) / 10 : null,
        talla_cm: tallaCm,
        imc: imc ? parseFloat(imc) : null,
      }),
    })
    setGuardando(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Error desconocido' }))
      setError(data.message || data.error || 'No se pudo guardar.')
    } else { router.push(`/expediente/${id}`) }
  }

  if (loading) return (
    <div className="flex h-64 items-center justify-center" role="status" aria-label="Cargando">
      <Loader2 size={20} className="animate-spin text-tinta3" aria-hidden="true" />
    </div>
  )

  const imc = calcularIMC()

  return (
    <div className="mx-auto w-full max-w-[680px] iv:max-w-[600px] animate-slide-up">

      {/* Cabecera compacta (CALMA §6, §20: «‹ Expediente») */}
      <Link href={`/expediente/${id}`} className="k-b k-b-texto -ml-1 text-[13px] leading-[18px]">
        <ChevronLeft size={16} strokeWidth={2.5} aria-hidden="true" />
        <span>Expediente</span>
      </Link>
      <h1 className="k-t-pantalla mt-0.5">Editar paciente</h1>

      <form onSubmit={handleSubmit} className="mt-5 space-y-6">
        {secciones.map(sec => (
          <Grupo key={sec.key} icono={sec.icono} titulo={sec.label}>
            {campos.filter(c => c.section === sec.key).map(campo => (
              campo.options ? (
                <FilaOpciones key={campo.key} campo={campo} valor={form[campo.key] || ''}
                  onCambio={v => setForm({ ...form, [campo.key]: v })} />
              ) : (
                <FilaCampo key={campo.key} campo={campo} valor={form[campo.key] || ''}
                  onCambio={v => setForm({ ...form, [campo.key]: v })} />
              )
            ))}
            {sec.key === 'antro' && imc && (
              <div className={FILA}>
                <span className={ROTULO}>IMC calculado</span>
                <span className="k-etq k-etq-tonal k-num justify-self-start">{imc} kg/m²</span>
              </div>
            )}
          </Grupo>
        ))}

        {/* Acciones: fijas al pie en `ext`/`tel` (sticky, no `fixed`: no toca
            la franja); en ancho, el par a la derecha; en `iv`, centrado (§23.1). */}
        <div className="flex flex-wrap gap-2.5 pt-1 pb-8 ih:justify-end esc:justify-end iv:justify-center ext:sticky tel:sticky ext:bottom-0 tel:bottom-0 ext:z-10 tel:z-10 ext:-mx-4 tel:-mx-4 ext:bg-fondo tel:bg-fondo ext:px-4 tel:px-4 ext:py-3 tel:py-3 ext:pb-[calc(var(--ib)+12px)] tel:pb-[calc(var(--ib)+12px)]">
          {/* El error va DENTRO del pie: en `ext`/`tel` el pie queda fijo abajo
              y el aviso se ve sin desplazar. */}
          {error && (
            <div role="alert" className="basis-full rounded-[12px] bg-mal-fondo px-4 py-3 text-[14px] leading-5 text-mal-tinta">{error}</div>
          )}
          <Link href={`/expediente/${id}`} className="k-b k-b-quieto">
            Cancelar
          </Link>
          <button type="submit" disabled={guardando} className="k-b k-b-prim ext:flex-1 tel:flex-1">
            {guardando
              ? <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Guardando...</>
              : 'Guardar cambios'
            }
          </button>
        </div>
      </form>
    </div>
  )
}
