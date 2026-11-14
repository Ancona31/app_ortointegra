'use client'

/**
 * Los tipos de cita (P5) en la pantalla de configuración (B4): lista, alta,
 * edición y archivo, con `/api/agenda/tipos-cita`. Sólo los edita quien
 * administra la clínica; los demás ven los activos que la RLS les deja ver (el
 * invitado no ve los personales de otros médicos). No se borran: se archivan.
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
import { TIPO_POR_DEFECTO } from '@/components/agenda/configuracion/FaltaParaEnlace'
import { BOTON_SECUNDARIO, TEXTO_SUAVE } from '@/components/agenda/configuracion/clasesConfig'
import { CrearTipoCitaSchema, EditarTipoCitaSchema, type TipoCita } from '@/lib/agenda/tiposCita'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import { useToast } from '@/components/ui/Toast'
import type { MedicoConfig } from '@/lib/configApp'

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

/** Estado vacío con su acción (tanda T2, punto 12): el mismo tipo por defecto que ofrece el enlace. */
function VacioTipos({ puedeEditar, ocupado, onCrear }: { puedeEditar: boolean; ocupado: boolean; onCrear: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-[var(--ag-3)]">
      <p className={TEXTO_SUAVE}>
        {puedeEditar ? 'Aún no hay tipos de cita. Con uno basta para empezar.' : 'Aún no hay tipos de cita; los crea quien administra la clínica.'}
      </p>
      {puedeEditar && (
        <button type="button" className={BOTON_SECUNDARIO} disabled={ocupado} onClick={onCrear}>Crear «Consulta», 30 min</button>
      )}
    </div>
  )
}

interface Props {
  tipos: TipoCita[] | null
  puedeEditar: boolean
  medicos: readonly MedicoConfig[]
  /** Tras cualquier cambio: «Para empezar» y los avisos de los enlaces se recalculan. */
  alCambiar?: () => void
}

export default function SeccionTiposCita({ tipos, puedeEditar, medicos, alCambiar }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [, startTransition] = useTransition()
  const [editando, setEditando] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [altaKey, setAltaKey] = useState(0)
  const ambito = (t: TipoCita) => {
    if (!t.medico_id) return 'Toda la clínica'
    const m = medicos.find(x => x.id === t.medico_id)
    return m ? componerNombreMedicoCompleto(m) : 'Un médico'
  }
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
  const crearPorDefecto = (): void => {
    setOcupado('por-defecto')
    void crear({ nombre: TIPO_POR_DEFECTO.nombre, duracion: String(TIPO_POR_DEFECTO.duracion_min), color: '', medicoId: '' })
      .then(m => { setOcupado(null); if (m) toast.error(m) })
  }

  return (
    <TarjetaSeccion id="config-tipos" titulo="Tipos de cita"
      ayuda="Al elegir uno en una cita con paciente, su duración fija la hora de fin. La reserva por enlace necesita al menos uno.">
      {!tipos ? <p className={TEXTO_SUAVE}>No se pudieron leer los tipos de cita. Recarga la página.</p>
        : visibles.length === 0 ? <VacioTipos puedeEditar={puedeEditar} ocupado={ocupado !== null} onCrear={crearPorDefecto} />
        : (
          <ul className="divide-y divide-[var(--ag-border-card)]">
            {visibles.map(t => editando === t.id ? (
              <li key={t.id} className="py-2">
                <FormTipoCita inicial={datosDe(t)} medicos={null} textoBoton="Guardar" onCancelar={() => setEditando(null)}
                  onGuardar={d => editar(t, d)} />
              </li>
            ) : (
              <FilaTipoCita key={t.id} tipo={t} ambito={ambito(t)} acciones={puedeEditar
                ? { onEditar: () => setEditando(t.id), onActivo: a => void cambiarActivo(t, a), ocupado: ocupado === t.id } : null} />
            ))}
          </ul>
        )}
      {puedeEditar && tipos && (
        <div className="flex flex-col gap-[var(--ag-2)] border-t border-[var(--ag-border-card)] pt-[var(--ag-4)]">
          <h4 className="text-sm font-semibold text-[var(--ag-text)]">Nuevo tipo de cita</h4>
          <FormTipoCita key={altaKey} inicial={VACIO} medicos={medicos} textoBoton="Crear tipo"
            onGuardar={crear} />
        </div>
      )}
    </TarjetaSeccion>
  )
}
