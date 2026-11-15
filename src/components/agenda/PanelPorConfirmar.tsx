'use client'

/**
 * src/components/agenda/PanelPorConfirmar.tsx — «Por confirmar (N)» en la
 * cabecera de escritorio de la agenda (agenda E7): las citas de MAÑANA aún
 * agendadas (no confirmadas), cada una con su botón de WhatsApp manual
 * (`tipo:'recordatorio'`, marca `whatsapp_reminder_sent_at`).
 *
 * Sólo lo monta la agenda con la v2 encendida. Pide la lista en tiempo ocioso
 * al montarse y otra vez al abrir el panel (lo confirmado mientras tanto, por
 * el enlace del correo o por el personal, ya no sale). Un fallo deja el
 * botón sin número; no es un aviso.
 *
 * D11: también «Reservas por enlace empalmadas con Google» (el mismo canal
 * que E8), con aviso emergente si la recarga trae uno detectado hace menos
 * de 2 min y esta pestaña aún no lo avisó.
 *
 * H4 (puntos 15 a 19 de Angel):
 *   · la leyenda «Estos pacientes están pendientes de confirmar su cita…»;
 *   · cada fila ofrece los medios que tiene (`con_whatsapp`, `con_correo`: las
 *     reglas de los botones, calculadas en la ruta); sin ninguno, lo dice y
 *     ofrece «Marcar como confirmada», que es `cambiarEstadoCita` —el mismo
 *     PUT, firma de eco y auditoría que «Confirmar» de la tarjeta—;
 *   · se actualiza con el canal ÚNICO de la agenda (`cambiosRef`, que alimenta
 *     `useTiempoRealAgenda`): no abre otro. Lo que sale, sale sin pedir nada;
 *     lo que entra recarga la lista una vez (`efectoEnPorConfirmar`);
 *   · el punto rojo del botón se enciende también con pendientes de mañana
 *     (sin número: el número ya va en «Por confirmar (N)»); con canceladas o
 *     empalmes, el contador de siempre.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { Check, MessageCircle, X } from 'lucide-react'
import { enOcioso, cancelarOcioso } from '@/lib/agenda/ocioso'
import type { FilaPorConfirmar } from '@/lib/agenda/whatsappCita'
import type { FilaCancelada } from '@/lib/agenda/avisoCancelacion'
import type { CambiarEstadoCita } from '@/lib/agenda/contratosV2'
import { efectoEnPorConfirmar, type CambioCita } from '@/lib/agenda/porConfirmarTiempoReal'
import { BotonWhatsAppCita } from '@/components/agenda/BotonWhatsAppCita'
import { BotonCorreoCita } from '@/components/agenda/BotonCorreoCita'
import { useToast } from '@/components/ui/Toast'
import { esEmpalmeReciente, textoAvisoEmpalme, type FilaEmpalme } from '@/lib/agenda/avisoEmpalmeReserva'

function esFila(x: unknown): x is FilaPorConfirmar {
  return typeof x === 'object' && x !== null
    && 'id' in x && typeof x.id === 'string' && 'inicio' in x && typeof x.inicio === 'string'
    && 'zona' in x && typeof x.zona === 'string' && 'titulo' in x && typeof x.titulo === 'string'
    && 'consultorio' in x && typeof x.consultorio === 'string'
    && 'con_whatsapp' in x && typeof x.con_whatsapp === 'boolean' && 'con_correo' in x && typeof x.con_correo === 'boolean'
    && 'whatsapp_reminder_sent_at' in x && (x.whatsapp_reminder_sent_at === null || typeof x.whatsapp_reminder_sent_at === 'string')
}

function esCancelada(x: unknown): x is FilaCancelada {
  return typeof x === 'object' && x !== null
    && 'id' in x && typeof x.id === 'string' && 'inicio' in x && typeof x.inicio === 'string'
    && 'zona' in x && typeof x.zona === 'string' && 'titulo' in x && typeof x.titulo === 'string'
    && 'respondido_en' in x && typeof x.respondido_en === 'string'
}

function esEmpalme(x: unknown): x is FilaEmpalme {
  return typeof x === 'object' && x !== null
    && 'id' in x && typeof x.id === 'string' && 'inicio' in x && typeof x.inicio === 'string'
    && 'zona' in x && typeof x.zona === 'string' && 'titulo' in x && typeof x.titulo === 'string'
    && 'detectado_en' in x && typeof x.detectado_en === 'string'
}

interface Listas { citas: FilaPorConfirmar[]; canceladas: FilaCancelada[]; empalmes: FilaEmpalme[] }

async function pedirPorConfirmar(): Promise<Listas | null> {
  try {
    const res = await fetch('/api/agenda/por-confirmar')
    if (!res.ok) return null
    const datos: unknown = await res.json()
    if (typeof datos !== 'object' || datos === null || !('citas' in datos) || !Array.isArray(datos.citas)) return null
    const canceladas = 'canceladas' in datos && Array.isArray(datos.canceladas) ? datos.canceladas.filter(esCancelada) : []
    const empalmes = 'empalmes' in datos && Array.isArray(datos.empalmes) ? datos.empalmes.filter(esEmpalme) : []
    return { citas: datos.citas.filter(esFila), canceladas, empalmes }
  } catch {
    return null
  }
}

function horaEnZona(iso: string, zona: string, conDia = false): string {
  try {
    return new Intl.DateTimeFormat('es-MX', {
      ...(conDia ? { weekday: 'short', day: 'numeric', month: 'short' } : {}),
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: zona,
    }).format(new Date(iso))
  } catch {
    return ''
  }
}

/** E8 · «Canceladas por el paciente (48 h)»: el aviso que queda para quien no tenía la agenda abierta. */
function SeccionCanceladas({ canceladas }: { canceladas: FilaCancelada[] }) {
  if (canceladas.length === 0) return null
  return (
    <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--ag-hairline)' }} data-canceladas-paciente>
      <p className="text-[13px] font-bold mb-2" style={{ color: 'var(--ag-text)' }}>Canceladas por el paciente (48 h)</p>
      <ul className="flex flex-col gap-2">
        {canceladas.map((c) => (
          <li key={c.id} data-fila-cancelada={c.id}>
            <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--ag-text)' }}>{c.titulo || 'Cita'}</p>
            <p className="text-[12px]" style={{ color: 'var(--ag-muted)' }}>{horaEnZona(c.inicio, c.zona, true)}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** D11 · «Reservas por enlace empalmadas con Google»: siguen ahí mientras el empalme siga en pie. */
function SeccionEmpalmes({ empalmes }: { empalmes: FilaEmpalme[] }) {
  if (empalmes.length === 0) return null
  return (
    <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--ag-hairline)' }} data-empalmes-reserva>
      <p className="text-[13px] font-bold mb-2" style={{ color: 'var(--ag-text)' }}>Reservas por enlace empalmadas con Google</p>
      <ul className="flex flex-col gap-2">
        {empalmes.map((c) => (
          <li key={c.id} data-fila-empalme={c.id}>
            <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--ag-text)' }}>{c.titulo || 'Cita'}</p>
            <p className="text-[12px]" style={{ color: 'var(--ag-muted)' }}>{horaEnZona(c.inicio, c.zona, true)} · se empalma con un evento de Google</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** H4 · La leyenda del punto 16 (texto literal de Angel). */
export const LEYENDA_POR_CONFIRMAR = 'Estos pacientes están pendientes de confirmar su cita. Envía un recordatorio.'

/** Una fila de mañana: nombre, hora y consultorio; los avisos que tenga, o «Marcar como confirmada». */
function FilaManana({ c, alConfirmar }: { c: FilaPorConfirmar; alConfirmar?: (id: string) => void }) {
  const sinMedios = !c.con_whatsapp && !c.con_correo
  return (
    <li data-fila-por-confirmar={c.id} className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--ag-text)' }}>{c.titulo || 'Cita'}</p>
        <p className="text-[12px] truncate" style={{ color: 'var(--ag-muted)' }}>
          {horaEnZona(c.inicio, c.zona)}{c.consultorio ? ` · ${c.consultorio}` : ''}
        </p>
        {sinMedios && <p className="text-[12px]" style={{ color: 'var(--ag-muted)' }} data-sin-medios>Sin teléfono válido ni correo.</p>}
      </div>
      <div className="flex flex-wrap justify-end items-start gap-1.5 flex-none max-w-[60%]">
        {c.con_whatsapp && <BotonWhatsAppCita citaId={c.id} tipo="recordatorio" marcadoEn={c.whatsapp_reminder_sent_at} etiqueta="WhatsApp" compacto />}
        {c.con_correo && <BotonCorreoCita citaId={c.id} compacto />}
        {sinMedios && alConfirmar && (
          <button type="button" data-marcar-confirmada={c.id} onClick={() => alConfirmar(c.id)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] rounded-xl font-bold border transition-colors hover:bg-[var(--ag-btn-ghost-hover)]"
            style={{ color: 'var(--ag-text)', borderColor: 'var(--ag-input-border)' }}>
            <Check size={14} aria-hidden="true" /> Marcar como confirmada
          </button>
        )}
      </div>
    </li>
  )
}

/** Las filas de mañana, con la leyenda arriba cuando hay alguna. */
function ListaPorConfirmar({ citas, alConfirmar }: { citas: FilaPorConfirmar[]; alConfirmar?: (id: string) => void }) {
  if (citas.length === 0) return null
  return (
    <>
      <p className="text-[12px] mb-3 leading-relaxed" style={{ color: 'var(--ag-muted)' }} data-leyenda-por-confirmar>{LEYENDA_POR_CONFIRMAR}</p>
      <ul className="flex flex-col gap-3">
        {citas.map((c) => <FilaManana key={c.id} c={c} alConfirmar={alConfirmar} />)}
      </ul>
    </>
  )
}

/** Recarga coalescida: varios cambios seguidos (alta + su eco de Google) piden UNA vez. */
const ESPERA_RECARGA_MS = 250

/**
 * H4 · La lista y su recarga. Una recarga pedida mientras otra está en vuelo
 * se repite al terminar (la que estaba en vuelo puede traer una fila que el
 * canal ya quitó).
 */
function useListas(recarga: number, cambiosRef: Props['cambiosRef']) {
  const [listas, setListas] = useState<Listas | null>(null)
  const toast = useToast()
  /** D11: los empalmes ya avisados en esta pestaña (el aviso emergente sale una vez). */
  const avisados = useRef(new Set<string>())
  const vuelo = useRef({ enVuelo: false, otraVez: false })
  const listasRef = useRef<Listas | null>(null)
  useEffect(() => { listasRef.current = listas }, [listas])

  const recargar = useCallback((): void => {
    const pedir = (): void => {
      if (vuelo.current.enVuelo) { vuelo.current.otraVez = true; return }
      vuelo.current.enVuelo = true
      void pedirPorConfirmar().then((l) => {
        if (!l) return
        setListas(l)
        avisarEmpalmes(l.empalmes, avisados.current, (t) => toast.info(t))
      }).finally(() => {
        vuelo.current.enVuelo = false
        if (vuelo.current.otraVez) { vuelo.current.otraVez = false; pedir() }
      })
    }
    pedir()
  }, [toast])

  const quitar = useCallback((id: string): void => {
    if (vuelo.current.enVuelo) vuelo.current.otraVez = true
    setListas((l) => l && { ...l, citas: l.citas.filter((c) => c.id !== id) })
  }, [])

  useEffect(() => {
    const idle = enOcioso(recargar)
    return () => cancelarOcioso(idle)
  }, [recargar, recarga])

  useCambiosEnVivo(cambiosRef, listasRef, quitar, recargar)
  return { listas, recargar, quitar }
}

/** D11 · El aviso emergente de un empalme reciente, una vez por pestaña. */
function avisarEmpalmes(empalmes: FilaEmpalme[], avisados: Set<string>, avisar: (texto: string) => void): void {
  const ahora = Date.now()
  for (const e of empalmes) {
    const llave = `${e.id}@${e.detectado_en}`
    if (avisados.has(llave) || !esEmpalmeReciente(e.detectado_en, ahora)) continue
    avisados.add(llave)
    avisar(textoAvisoEmpalme(e.inicio, e.zona))
  }
}

/** H4 (punto 18) · Se engancha al canal de la agenda por `cambiosRef` (no abre otro). */
function useCambiosEnVivo(
  cambiosRef: Props['cambiosRef'], listasRef: RefObject<Listas | null>, quitar: (id: string) => void, recargar: () => void,
): void {
  useEffect(() => {
    if (!cambiosRef) return
    let espera: ReturnType<typeof setTimeout> | null = null
    const alCambio = (c: CambioCita): void => {
      const l = listasRef.current
      if (!l) return // la primera traída aún no llegó: traerá lo de ahora
      const efecto = efectoEnPorConfirmar(new Map(l.citas.map((f) => [f.id, f.inicio])), c, Date.now())
      if (efecto === 'quitar' || efecto === 'quitar_y_recargar') quitar(c.tipo === 'DELETE' ? c.id : c.fila.id)
      if (efecto === 'recargar' || efecto === 'quitar_y_recargar') {
        if (espera) clearTimeout(espera)
        espera = setTimeout(() => { espera = null; recargar() }, ESPERA_RECARGA_MS)
      }
    }
    cambiosRef.current = alCambio
    return () => {
      if (espera) clearTimeout(espera)
      if (cambiosRef.current === alCambio) cambiosRef.current = null
    }
  }, [cambiosRef, listasRef, quitar, recargar])
}

interface Props {
  /** `recarga`: cambia cuando la agenda se entera de una cancelación por el enlace (E8). */
  recarga?: number
  /** H4 · «Marcar como confirmada»: `cambiarEstadoCita` de la agenda (el camino de «Confirmar»). */
  confirmar?: CambiarEstadoCita
  /** H4 · Dónde dejar el oyente de los cambios del canal de tiempo real de la agenda. */
  cambiosRef?: RefObject<((c: CambioCita) => void) | null>
}

/** H4 (punto 19) · El aviso del botón: el contador de siempre (canceladas y empalmes) o, sin ellos, un punto si hay pendientes. */
function AlertaBoton({ pendientes, avisos }: { pendientes: number; avisos: number }) {
  if (avisos > 0) {
    return (
      <span data-alerta-por-confirmar="avisos" className="ml-1 px-1.5 rounded-full text-[11px] font-bold text-white"
        style={{ background: 'var(--ag-status-cancelled-dot)' }}
        title="Canceladas por el paciente (48 h) y reservas por enlace empalmadas con Google">{avisos}</span>
    )
  }
  if (pendientes === 0) return null
  return (
    <span data-alerta-por-confirmar="pendientes" aria-hidden="true" title="Pacientes pendientes de confirmar su cita de mañana"
      className="ml-0.5 inline-block w-2 h-2 rounded-full" style={{ background: 'var(--ag-status-cancelled-dot)' }} />
  )
}

export function PanelPorConfirmar({ recarga = 0, confirmar, cambiosRef }: Props) {
  const { listas, recargar, quitar } = useListas(recarga, cambiosRef)
  const [abierto, setAbierto] = useState(false)
  const alConfirmar = confirmar ? (id: string): void => {
    quitar(id)
    void confirmar(id, 'confirmed').then((ok) => { if (!ok) recargar() })
  } : undefined

  const citas = listas?.citas ?? null
  const n = citas?.length ?? null
  const m = (listas?.canceladas.length ?? 0) + (listas?.empalmes.length ?? 0)
  return (
    <div className="relative">
      <button type="button" data-por-confirmar
        onClick={() => { setAbierto((v) => !v); if (!abierto) recargar() }}
        className="flex items-center gap-1.5 px-3 py-2.5 rounded-[var(--ag-r-btn)] text-sm font-semibold border transition-colors hover:bg-[var(--ag-btn-ghost-hover)] whitespace-nowrap"
        style={{ color: 'var(--ag-text)', borderColor: 'var(--ag-input-border)' }}
        aria-expanded={abierto}>
        <MessageCircle size={15} /> Por confirmar{n !== null ? ` (${n})` : ''}
        <AlertaBoton pendientes={n ?? 0} avisos={m} />
      </button>
      {abierto && (
        <div role="dialog" aria-label="Citas de mañana por confirmar"
          className="absolute right-0 top-full mt-2 z-40 w-[380px] max-h-[60vh] overflow-y-auto rounded-2xl border shadow-lg p-4"
          style={{ background: 'var(--ag-modal-bg)', borderColor: 'var(--ag-hairline)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-bold" style={{ color: 'var(--ag-text)' }}>Citas de mañana por confirmar</p>
            <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar"><X size={16} /></button>
          </div>
          {citas === null && <p className="text-[12px]" style={{ color: 'var(--ag-muted)' }}>Cargando…</p>}
          {citas?.length === 0 && <p className="text-[12px]" style={{ color: 'var(--ag-muted)' }}>No hay citas de mañana sin confirmar.</p>}
          <ListaPorConfirmar citas={citas ?? []} alConfirmar={alConfirmar} />
          <SeccionCanceladas canceladas={listas?.canceladas ?? []} />
          <SeccionEmpalmes empalmes={listas?.empalmes ?? []} />
        </div>
      )}
    </div>
  )
}
