'use client'

/**
 * La duración de la consulta y los tipos de cita (P5) en la pantalla de
 * configuración (B4): lista, alta, edición y archivo, con
 * `/api/agenda/tipos-cita`. Los edita y archiva quien administra la clínica
 * (`tipos_cita_update`); los demás ven los activos que la RLS les deja ver (el
 * invitado no ve los personales de otros médicos). No se borran: se archivan.
 *
 * G2 (puntos 7 y 9 de Angel): arriba, la duración de la consulta del médico
 * que mira (su tipo principal; si no la tiene, se le pregunta aquí). Cualquier
 * médico CREA tipos suyos («Quien quiera ofrecer más de una duración, las
 * agrega después»); cambiarlos sigue siendo del administrador.
 *
 * La lista sale del servidor (`page.tsx`) y, tras cada escritura, se vuelve a
 * pedir con `router.refresh()` en vez de mantener una copia aquí: así lo que
 * se ve es siempre lo que la RLS devuelve, sin reconstruir filas a mano.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import FilaTipoCita from '@/components/agenda/configuracion/FilaTipoCita'
import FormTipoCita, { type DatosTipoCita } from '@/components/agenda/configuracion/FormTipoCita'
import { leerMotivoError } from '@/components/agenda/configuracion/leerMotivoError'
import TarjetaSeccion from '@/components/agenda/configuracion/TarjetaSeccion'
import DuracionConsulta from '@/components/agenda/configuracion/DuracionConsulta'
import { BOTON_FILA, TEXTO_SUAVE } from '@/components/agenda/configuracion/clasesConfig'
import { CrearTipoCitaSchema, EditarTipoCitaSchema, type TipoCita } from '@/lib/agenda/tiposCita'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import { useToast } from '@/components/ui/Toast'
import type { MedicoConfig } from '@/lib/configApp'
import type { Consultorio } from '@/types'

const VACIO: DatosTipoCita = { nombre: '', duracion: '30', color: '', medicoId: '' }

const datosDe = (t: TipoCita): DatosTipoCita => ({ nombre: t.nombre, duracion: String(t.duracion_min), color: t.color ?? '', medicoId: t.medico_id ?? '' })

/** Envía un alta o una edición ya validada. Devuelve el motivo del fallo, o `null`. */
async function enviarTipo(url: string, method: 'POST' | 'PATCH', cuerpo: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
    return res.ok ? null : await leerMotivoError(res, 'No se pudo guardar el tipo de cita')
  } catch {
    return 'No se pudo guardar el tipo de cita'
  }
}

function crearTipo(d: DatosTipoCita): Promise<string | null> {
  const r = CrearTipoCitaSchema.safeParse({
    nombre: d.nombre, duracion_min: Number(d.duracion), color: d.color || null, medico_id: d.medicoId || null,
  })
  if (!r.success) return Promise.resolve(r.error.issues[0]?.message ?? 'Datos inválidos')
  return enviarTipo('/api/agenda/tipos-cita', 'POST', r.data)
}

function editarTipo(id: string, cambios: Record<string, unknown>): Promise<string | null> {
  const r = EditarTipoCitaSchema.safeParse(cambios)
  if (!r.success) return Promise.resolve(r.error.issues[0]?.message ?? 'Datos inválidos')
  return enviarTipo(`/api/agenda/tipos-cita/${id}`, 'PATCH', r.data)
}

/** G2 · La duración de la consulta de quien mira: la suya, para cambiarla (quien administra) o para contestarla. */
/** Sin duración propia: si ya le vale algún tipo (de la clínica), la pregunta es
 *  opcional y discreta; si no, se pregunta aquí sólo cuando «Primeros pasos» no
 *  la está preguntando ya (una pregunta, no tres). */
function SinDuracionPropia(p: { tipos: readonly TipoCita[]; usuarioId: string; preguntar: boolean; alGuardar: (texto: string) => void }) {
  const [abierta, setAbierta] = useState(false)
  const conTipos = p.tipos.some(t => t.activo && !t.consultorio_id && (t.medico_id === null || t.medico_id === p.usuarioId))
  if (!abierta && (conTipos || !p.preguntar)) {
    return conTipos
      ? <button type="button" className={`${BOTON_FILA} w-fit`} onClick={() => setAbierta(true)}>Poner tu propia duración de consulta</button>
      : null
  }
  return (
    <div className="rounded-[var(--ag-r-btn)] border border-[var(--ag-border-card)] p-[var(--ag-3)]">
      <DuracionConsulta medicoId={p.usuarioId} pregunta="¿Cuánto dura tu consulta?" onCancelar={conTipos ? () => setAbierta(false) : undefined}
        onHecho={() => { setAbierta(false); p.alGuardar('Duración de la consulta guardada') }} />
    </div>
  )
}

function MiDuracion(p: { tipos: readonly TipoCita[]; usuarioId: string; puedeEditar: boolean; preguntar: boolean; alGuardar: (texto: string) => void }) {
  const [cambiando, setCambiando] = useState(false)
  const mia = p.tipos.find(t => t.activo && t.principal && t.medico_id === p.usuarioId && !t.consultorio_id)
  if (!mia) return <SinDuracionPropia tipos={p.tipos} usuarioId={p.usuarioId} preguntar={p.preguntar} alGuardar={p.alGuardar} />
  if (cambiando) {
    return (
      <div className="rounded-[var(--ag-r-btn)] border border-[var(--ag-border-card)] p-[var(--ag-3)]">
        <DuracionConsulta medicoId={p.usuarioId} editarId={mia.id} actual={mia.duracion_min} pregunta="¿Cuánto dura tu consulta?"
          onHecho={() => { setCambiando(false); p.alGuardar('Duración de la consulta guardada') }} onCancelar={() => setCambiando(false)} />
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-x-[var(--ag-3)] gap-y-[var(--ag-1)]">
      <p className="text-sm text-[var(--ag-text)]">Tu consulta dura <strong className="tabular-nums">{mia.duracion_min} min</strong>, en todos tus consultorios.</p>
      {p.puedeEditar
        ? <button type="button" className={BOTON_FILA} onClick={() => setCambiando(true)}>Cambiar duración</button>
        : <span className={TEXTO_SUAVE}>Para cambiarla, pídele a quien administra la clínica.</span>}
    </div>
  )
}

interface Props {
  tipos: TipoCita[] | null
  puedeEditar: boolean
  medicos: readonly MedicoConfig[]
  /** Tras cualquier cambio: «Primeros pasos» y los avisos de los enlaces se recalculan. */
  alCambiar?: () => void
  /** G2: quien mira y si es médico (crea los suyos y contesta su duración). */
  usuarioId: string
  esMedico: boolean
  /** Para nombrar el consultorio de una duración distinta. */
  consultorios: readonly Consultorio[] | null
  /** `false` mientras «Primeros pasos» ya pregunta la duración. */
  preguntarDuracion: boolean
}

/** El alta de un tipo. G2: quien no administra crea sólo los suyos (sin selector «Para»). */
function AltaTipo(p: { puedeEditar: boolean; medicos: readonly MedicoConfig[]; usuarioId: string; crear: (d: DatosTipoCita) => Promise<string | null> }) {
  return (
    <div className="flex flex-col gap-[var(--ag-2)] border-t border-[var(--ag-border-card)] pt-[var(--ag-4)]">
      <h4 className="text-sm font-semibold text-[var(--ag-text)]">Nuevo tipo de cita</h4>
      <FormTipoCita inicial={p.puedeEditar ? VACIO : { ...VACIO, medicoId: p.usuarioId }}
        medicos={p.puedeEditar ? p.medicos : null} textoBoton="Crear tipo" onGuardar={p.crear} />
      {!p.puedeEditar && <p className={TEXTO_SUAVE}>Los que crees son sólo tuyos. Para cambiarlos o archivarlos, pídeselo a quien administra la clínica.</p>}
    </div>
  )
}

/** «Toda la clínica», el médico, y si es su duración (general o de un consultorio). */
function ambitoDe(t: TipoCita, medicos: readonly MedicoConfig[], consultorios: readonly Consultorio[] | null): string {
  const m = t.medico_id ? medicos.find(x => x.id === t.medico_id) : null
  const quien = !t.medico_id ? 'Toda la clínica' : m ? componerNombreMedicoCompleto(m) : 'Un médico'
  if (!t.principal) return quien
  if (!t.consultorio_id) return `Duración de la consulta · ${quien}`
  const c = consultorios?.find(x => x.id === t.consultorio_id)
  return `Duración en ${c?.nombre ?? 'un consultorio'} · ${quien}`
}

export default function SeccionTiposCita({ tipos, puedeEditar, medicos, alCambiar, usuarioId, esMedico, consultorios, preguntarDuracion }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [, startTransition] = useTransition()
  const [editando, setEditando] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [altaKey, setAltaKey] = useState(0)
  /* Tras guardar: el aviso, y se relee la lista del servidor. */
  const guardado = (hecho: string) => {
    toast.success(hecho)
    startTransition(() => router.refresh())
    alCambiar?.()
  }
  async function editar(t: TipoCita, d: DatosTipoCita): Promise<string | null> {
    const motivo = await editarTipo(t.id, { nombre: d.nombre, duracion_min: Number(d.duracion), color: d.color || null })
    if (!motivo) { setEditando(null); guardado('Tipo de cita actualizado') }
    return motivo
  }
  async function crear(d: DatosTipoCita): Promise<string | null> {
    const motivo = await crearTipo(d)
    if (!motivo) { setAltaKey(k => k + 1); guardado('Tipo de cita creado') }
    return motivo
  }
  async function cambiarActivo(t: TipoCita, activo: boolean): Promise<void> {
    setOcupado(t.id)
    const motivo = await editarTipo(t.id, { activo })
    setOcupado(null)
    if (motivo) toast.error(motivo)
    else guardado(activo ? 'Tipo de cita reactivado' : 'Tipo de cita archivado')
  }
  const visibles = (tipos ?? []).filter(t => puedeEditar || t.activo)
  const puedeCrear = puedeEditar || esMedico

  return (
    <TarjetaSeccion id="config-tipos" titulo="Duración y tipos de cita"
      ayuda="Con la duración de la consulta se cuentan los horarios del enlace de reserva. Si ofreces más de una, agrega otro tipo.">
      {tipos && esMedico && <MiDuracion tipos={tipos} usuarioId={usuarioId} puedeEditar={puedeEditar} preguntar={preguntarDuracion} alGuardar={guardado} />}
      {!tipos ? <p className={TEXTO_SUAVE}>No se pudieron leer los tipos de cita. Recarga la página.</p>
        : visibles.length === 0 ? <p className={TEXTO_SUAVE}>Aún no hay tipos de cita.</p>
        : (
          <ul className="divide-y divide-[var(--ag-border-card)]">
            {visibles.map(t => editando === t.id ? (
              <li key={t.id} className="py-2">
                <FormTipoCita inicial={datosDe(t)} medicos={null} textoBoton="Guardar" onCancelar={() => setEditando(null)}
                  onGuardar={d => editar(t, d)} />
              </li>
            ) : (
              <FilaTipoCita key={t.id} tipo={t} ambito={ambitoDe(t, medicos, consultorios)} acciones={puedeEditar
                ? { onEditar: () => setEditando(t.id), onActivo: a => void cambiarActivo(t, a), ocupado: ocupado === t.id } : null} />
            ))}
          </ul>
        )}
      {puedeCrear && tipos && <AltaTipo key={altaKey} puedeEditar={puedeEditar} medicos={medicos} usuarioId={usuarioId} crear={crear} />}
    </TarjetaSeccion>
  )
}
