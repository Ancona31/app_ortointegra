'use client'

/**
 * src/components/agenda/PanelPorConfirmar.tsx — los DATOS y las LISTAS de
 * «Por confirmar» (agenda E7): las citas de MAÑANA aún agendadas (no
 * confirmadas), cada una con sus medios de aviso. Desde la tanda I los pinta
 * la campana de la barra (`CampanaAgenda`, punto 16 de Angel), en su pestaña
 * «Por confirmar»; la pestaña «Avisos» recibe de aquí los avisos de la clínica
 * (I5, punto 19), que viajan en la MISMA respuesta (ninguna petición de más).
 *
 * Sólo lo monta la agenda con la v2 encendida. Pide la lista en tiempo ocioso
 * al montarse y otra vez al abrir la campana. Un fallo deja la campana sin
 * número; no es un aviso.
 *
 * D11: también «Reservas por enlace empalmadas con Google», con aviso
 * emergente si la recarga trae uno detectado hace menos de 2 min y esta
 * pestaña aún no lo avisó.
 *
 * H4 (puntos 15 a 19 de Angel):
 *   · la leyenda «Estos pacientes están pendientes de confirmar su cita…»;
 *   · cada fila ofrece los medios que tiene (`con_whatsapp`, `con_correo`: las
 *     reglas de los botones, calculadas en la ruta); sin ninguno, lo dice y
 *     ofrece «Marcar como confirmada», que es `cambiarEstadoCita` —el mismo
 *     PUT, firma de eco y auditoría que «Confirmar» de la tarjeta—;
 *   · se actualiza con el canal ÚNICO de la agenda (`cambiosRef`, que alimenta
 *     `useTiempoRealAgenda`): no abre otro. Lo que sale, sale sin pedir nada;
 *     lo que entra recarga la lista una vez (`efectoEnPorConfirmar`). I5: lo
 *     que puede traer un aviso (`cambioPuedeAvisar`) también recarga una vez.
 *
 * I5 · punto 17: cada fila es una REJILLA de columnas fijas —nombre y hora,
 * WhatsApp, correo—: los dos botones quedan en el mismo sitio y del mismo
 * tamaño en todas las filas (una celda vacía si falta uno), y el estado de los
 * dos («WhatsApp abierto 00:35 · Correo enviado 00:35») va en UNA línea debajo
 * de la fila, no debajo de cada botón.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { Check } from 'lucide-react'
import { enOcioso, cancelarOcioso } from '@/lib/agenda/ocioso'
import type { FilaPorConfirmar } from '@/lib/agenda/whatsappCita'
import type { FilaCancelada } from '@/lib/agenda/avisoCancelacion'
import { cambioPuedeAvisar, efectoEnPorConfirmar, type CambioCita } from '@/lib/agenda/porConfirmarTiempoReal'
import { BotonWhatsAppCita } from '@/components/agenda/BotonWhatsAppCita'
import { BotonCorreoCita } from '@/components/agenda/BotonCorreoCita'
import { type FilaEmpalme } from '@/lib/agenda/avisoEmpalmeReserva'
import { leerRespuestaAvisos, type RespuestaAvisos } from '@/lib/avisos/avisosClinica'

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

export interface ListasPorConfirmar {
  citas: FilaPorConfirmar[]
  canceladas: FilaCancelada[]
  empalmes: FilaEmpalme[]
  /** I5 · Los avisos de la clínica; null si la ruta no los trajo (servidor anterior). */
  avisos: RespuestaAvisos | null
}

async function pedirPorConfirmar(): Promise<ListasPorConfirmar | null> {
  try {
    const res = await fetch('/api/agenda/por-confirmar')
    if (!res.ok) return null
    const datos: unknown = await res.json()
    if (typeof datos !== 'object' || datos === null || !('citas' in datos) || !Array.isArray(datos.citas)) return null
    const canceladas = 'canceladas' in datos && Array.isArray(datos.canceladas) ? datos.canceladas.filter(esCancelada) : []
    const empalmes = 'empalmes' in datos && Array.isArray(datos.empalmes) ? datos.empalmes.filter(esEmpalme) : []
    return { citas: datos.citas.filter(esFila), canceladas, empalmes, avisos: leerRespuestaAvisos(datos) }
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

/** E8 · «Canceladas por el paciente (48 h)»: sólo sin la tabla de avisos (base sin la migración de I5). */
export function SeccionCanceladas({ canceladas }: { canceladas: FilaCancelada[] }) {
  if (canceladas.length === 0) return null
  return (
    <div className="mt-4 pt-3 border-t first:mt-0 first:pt-0 first:border-t-0" style={{ borderColor: 'var(--ag-hairline)' }} data-canceladas-paciente>
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

/** D11 · «Reservas por enlace empalmadas con Google»: sólo sin la tabla de avisos. */
export function SeccionEmpalmes({ empalmes }: { empalmes: FilaEmpalme[] }) {
  if (empalmes.length === 0) return null
  return (
    <div className="mt-4 pt-3 border-t first:mt-0 first:pt-0 first:border-t-0" style={{ borderColor: 'var(--ag-hairline)' }} data-empalmes-reserva>
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

type Mensaje = { texto: string; alerta: boolean; breve?: string } | null

/** I5 · punto 17: la línea de estado de la fila, una sola, con lo de los dos botones. */
function LineaEstado({ whatsapp, correo }: { whatsapp: Mensaje; correo: Mensaje }) {
  const partes = [whatsapp, correo].filter((m): m is NonNullable<Mensaje> => m !== null)
  if (partes.length === 0) return null
  const alerta = partes.some(m => m.alerta)
  const texto = partes.map(m => m.breve ?? m.texto).join(' · ')
  return (
    <p data-estado-fila role={alerta ? 'alert' : undefined} title={texto}
      className={`ag-pc-estado text-[12px] ${alerta ? 'ag-pc-estado--alerta' : ''}`}>{texto}</p>
  )
}

/** Una fila de mañana: nombre, hora y consultorio; WhatsApp y correo en sus celdas fijas; el estado debajo. */
function FilaManana({ c, alConfirmar }: { c: FilaPorConfirmar; alConfirmar?: (id: string) => void }) {
  const [whatsapp, setWhatsapp] = useState<Mensaje>(null)
  const [correo, setCorreo] = useState<Mensaje>(null)
  const sinMedios = !c.con_whatsapp && !c.con_correo
  return (
    <li data-fila-por-confirmar={c.id} className="ag-pc-fila">
      <div className="ag-pc-datos min-w-0">
        <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--ag-text)' }}>{c.titulo || 'Cita'}</p>
        <p className="text-[12px] truncate" style={{ color: 'var(--ag-muted)' }}>
          {horaEnZona(c.inicio, c.zona)}{c.consultorio ? ` · ${c.consultorio}` : ''}
        </p>
      </div>
      <div className="ag-pc-celda ag-pc-celda--whatsapp">
        {c.con_whatsapp && <BotonWhatsAppCita citaId={c.id} tipo="recordatorio" marcadoEn={c.whatsapp_reminder_sent_at} soloIcono alMensaje={setWhatsapp} />}
      </div>
      <div className="ag-pc-celda ag-pc-celda--correo">
        {c.con_correo && <BotonCorreoCita citaId={c.id} soloIcono alMensaje={setCorreo} />}
      </div>
      <LineaEstado whatsapp={whatsapp} correo={correo} />
      {sinMedios && (
        <div className="ag-pc-sin-medios">
          <p className="text-[12px]" style={{ color: 'var(--ag-muted)' }} data-sin-medios>Sin teléfono válido ni correo.</p>
          {alConfirmar && (
            <button type="button" data-marcar-confirmada={c.id} onClick={() => alConfirmar(c.id)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] rounded-xl font-bold border transition-colors hover:bg-[var(--ag-btn-ghost-hover)]"
              style={{ color: 'var(--ag-text)', borderColor: 'var(--ag-input-border)' }}>
              <Check size={14} aria-hidden="true" /> Marcar como confirmada
            </button>
          )}
        </div>
      )}
    </li>
  )
}

/** Las filas de mañana, con la leyenda arriba cuando hay alguna. */
export function ListaPorConfirmar({ citas, alConfirmar }: { citas: FilaPorConfirmar[]; alConfirmar?: (id: string) => void }) {
  if (citas.length === 0) return null
  return (
    <>
      <p className="text-[12px] mb-3 leading-relaxed" style={{ color: 'var(--ag-muted)' }} data-leyenda-por-confirmar>{LEYENDA_POR_CONFIRMAR}</p>
      <ul className="flex flex-col">
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
export function usePorConfirmar(recarga: number, cambiosRef: RefObject<((c: CambioCita) => void) | null> | undefined) {
  const [listas, setListas] = useState<ListasPorConfirmar | null>(null)
  /* Avisos globales (2026-11-24): la burbuja del empalme (D11) ya no sale de aquí (iba sin nombre): la
     lanza la campana con el aviso `empalme_google`, que viaja en esta misma respuesta. */
  const vuelo = useRef({ enVuelo: false, otraVez: false })
  const listasRef = useRef<ListasPorConfirmar | null>(null)
  useEffect(() => { listasRef.current = listas }, [listas])

  const recargar = useCallback((): void => {
    const pedir = (): void => {
      if (vuelo.current.enVuelo) { vuelo.current.otraVez = true; return }
      vuelo.current.enVuelo = true
      void pedirPorConfirmar().then((l) => {
        if (!l) return
        setListas(l)
      }).finally(() => {
        vuelo.current.enVuelo = false
        if (vuelo.current.otraVez) { vuelo.current.otraVez = false; pedir() }
      })
    }
    pedir()
  }, [])

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

/** H4 (punto 18) · Se engancha al canal de la agenda por `cambiosRef` (no abre otro). */
function useCambiosEnVivo(
  cambiosRef: RefObject<((c: CambioCita) => void) | null> | undefined, listasRef: RefObject<ListasPorConfirmar | null>,
  quitar: (id: string) => void, recargar: () => void,
): void {
  useEffect(() => {
    if (!cambiosRef) return
    let espera: ReturnType<typeof setTimeout> | null = null
    const alCambio = (c: CambioCita): void => {
      const l = listasRef.current
      if (!l) return // la primera traída aún no llegó: traerá lo de ahora
      const listadas = new Map(l.citas.map((f) => [f.id, f.inicio]))
      const efecto = efectoEnPorConfirmar(listadas, c, Date.now())
      if (efecto === 'quitar' || efecto === 'quitar_y_recargar') quitar(c.tipo === 'DELETE' ? c.id : c.fila.id)
      const listada = c.tipo !== 'DELETE' && listadas.has(c.fila.id)
      if (efecto === 'recargar' || efecto === 'quitar_y_recargar' || cambioPuedeAvisar(c, listada)) {
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
