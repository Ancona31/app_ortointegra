'use client'

/**
 * src/components/agenda/BotonWhatsAppCita.tsx — el botón del WhatsApp MANUAL
 * de una cita (agenda E7). Lo usan el modal de la cita, la tarjeta de lectura
 * y la burbuja tras agendar (`tipo:'enlace'`) y la lista «citas de mañana por
 * confirmar» (`tipo:'recordatorio'`).
 *
 * T1 · QUIÉN LO PINTA DECIDE CON `motivoSinWhatsApp` (`whatsappCita.ts`), la
 * misma regla del servidor: no sale en una cita pasada, atendida, cancelada,
 * con inasistencia, de todo el día o sin teléfono válido. Si aun así el
 * servidor la rechaza (la cita pasó con la tarjeta abierta), el motivo se
 * dice en llano.
 *
 * ⚠️ MONTARLO NO ESCRIBE NADA. `paso:'preparar'` EMITE el enlace de
 * confirmación (una fila en `cita_confirmaciones` y su auditoría), así que
 * sólo se pide AL PULSAR, nunca al abrir el modal o la lista para mirar.
 *
 * Al pulsar, dentro del mismo gesto: `window.open('', '_blank')` abre una
 * pestaña EN BLANCO (un `window.open` después de un `await` lo bloquean los
 * navegadores como ventana emergente; síncrono dentro del clic, no), se le
 * corta el `opener`, se prepara el enlace y se le asigna la URL de `wa.me`;
 * luego se avisa `paso:'abierto'` con `keepalive` y se enseña «Abierto en
 * WhatsApp hh:mm»: se ABRIÓ, no se envió (eso no se sabe). Si la preparación
 * falla, la pestaña en blanco se cierra y sale el motivo. Si el navegador
 * bloqueó igual la pestaña, se enseña un enlace real «Abrir WhatsApp» (un
 * `<a target="_blank">` pulsado no lo bloquea) que marca al pulsarlo.
 *
 * Sólo se monta con la agenda v2 encendida (quien lo usa lo decide).
 */
import { useEffect, useState, type ReactElement } from 'react'
import { TEXTO_SIN_WHATSAPP, type MotivoSinWhatsApp } from '@/lib/agenda/whatsappCita'

type Estado = { tipo: 'inicial' } | { tipo: 'preparando' } | { tipo: 'listo'; url: string } | { tipo: 'error'; motivo: string }

/* T1: el 409 trae el MOTIVO (`motivoSinWhatsApp`) y se dice en llano; un
   servidor anterior a T1 manda sólo `no_aplica` y cae al texto genérico. */
const MOTIVOS: Record<string, string> = {
  ...TEXTO_SIN_WHATSAPP,
  no_aplica: 'A esta cita ya no se le puede mandar el mensaje: ya no está agendada ni confirmada, o ya pasó.',
  sin_enlace: 'No se pudo preparar el enlace de confirmación.',
}

function motivoDeRespuesta(datos: unknown): string {
  if (typeof datos !== 'object' || datos === null) return ''
  const motivo = 'motivo' in datos && typeof datos.motivo === 'string' ? datos.motivo : ''
  if (motivo in TEXTO_SIN_WHATSAPP) return TEXTO_SIN_WHATSAPP[motivo as MotivoSinWhatsApp]
  return 'error' in datos && typeof datos.error === 'string' ? (MOTIVOS[datos.error] ?? '') : ''
}

/**
 * T1 (punto 14 de Angel) · El logo de WhatsApp en su verde, DIBUJO PROPIO (sin
 * librería): un globo de diálogo redondo con su cola abajo a la izquierda y un
 * auricular blanco dentro. Decorativo (`aria-hidden`): el nombre del botón es su
 * texto, que va en `--ag-text` (AA). Un logotipo queda fuera del 3:1 de
 * WCAG 1.4.11 y el verde #25D366 es el de la marca.
 */
export function LogoWhatsApp({ size = 16 }: { size?: number }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="flex-none">
      <path fill="#25D366" d="M12 2.2a9.8 9.8 0 0 0-8.5 14.7L2.2 21.8l5-1.3A9.8 9.8 0 1 0 12 2.2z" />
      <path fill="#fff" d="M9.1 6.9c-.3-.6-.5-.6-.8-.6h-.6c-.2 0-.6.1-.9.4-.3.3-1.1 1.1-1.1 2.7s1.2 3.1 1.3 3.3c.2.2 2.3 3.6 5.6 4.9 2.8 1.1 3.3.9 3.9.8.6-.1 1.9-.8 2.2-1.5.3-.8.3-1.4.2-1.5-.1-.1-.3-.2-.6-.4l-2.1-1c-.3-.1-.5-.2-.7.1-.2.3-.8 1-1 1.2-.2.2-.4.2-.6.1-.3-.1-1.3-.5-2.5-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-1-2.3z" />
    </svg>
  )
}

function horaCorta(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
}

/** `paso:'preparar'`. Nunca lanza: un fallo es un estado de error con su motivo. */
async function prepararWhatsApp(citaId: string, tipo: 'enlace' | 'recordatorio'): Promise<Estado> {
  try {
    const res = await fetch('/api/agenda/whatsapp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cita_id: citaId, paso: 'preparar', tipo }),
    })
    const datos: unknown = await res.json().catch(() => null)
    const url = typeof datos === 'object' && datos !== null && 'url' in datos && typeof datos.url === 'string' ? datos.url : null
    if (res.ok && url?.startsWith('https://wa.me/')) return { tipo: 'listo', url }
    return { tipo: 'error', motivo: motivoDeRespuesta(datos) || 'No se pudo preparar el mensaje.' }
  } catch {
    return { tipo: 'error', motivo: 'No se pudo preparar el mensaje.' }
  }
}

interface Props {
  citaId: string
  tipo: 'enlace' | 'recordatorio'
  /** La marca que ya tenía la cita (`whatsapp_sent_at` o `whatsapp_reminder_sent_at`). */
  marcadoEn: string | null
  /** Etiqueta del botón. Sin ella (G3, punto 15): «Enviar confirmación», o
      «Enviar recordatorio» si la cita ya está confirmada. */
  etiqueta?: string
  /** G3 · La cita ya está confirmada: el aviso es un recordatorio. */
  confirmada?: boolean
  compacto?: boolean
  /** T1: con la pinta de los botones de las capas (`.ag-capa-boton`), a todo el ancho de su celda. */
  enCapa?: boolean
  /** G3 · Comparte fila con otra acción: «Enviar» arriba y la palabra abajo. A todo el ancho, en una. */
  dosLineas?: boolean
  /** G3 · La clase de su celda en la rejilla de la tarjeta o de la burbuja. */
  claseCelda?: string
  /** G3 · Foco itinerante de la barra de la tarjeta. */
  tabIndex?: number
  onFocus?: () => void
  /** G3 · Dónde dejar el mensaje («Abierto en WhatsApp hh:mm» o el motivo de un
      error) cuando el botón vive en una rejilla: así no queda nada suelto en
      ella. Sin esto, el mensaje va debajo del botón, como antes.
      I5 · `breve`: la forma corta del estado («WhatsApp abierto 00:35») para la
      línea única de la fila de «Por confirmar»; un error no la lleva. */
  alMensaje?: (m: { texto: string; alerta: boolean; breve?: string } | null) => void
  /** I5 · punto 17: un cuadrado con el logo (la fila de «Por confirmar»); el nombre accesible es el completo. */
  soloIcono?: boolean
}

/** `paso:'abierto'`: la marca de que se abrió WhatsApp. `keepalive`: la pestaña puede irse. */
function avisarAbierto(citaId: string, tipo: 'enlace' | 'recordatorio'): void {
  void fetch('/api/agenda/whatsapp', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
    body: JSON.stringify({ cita_id: citaId, paso: 'abierto', tipo }),
  }).catch(() => undefined)
}

/** Una pestaña en blanco, abierta DENTRO del gesto y sin `opener`; null si el navegador la bloqueó. */
function pestanaEnBlanco(): Window | null {
  const w = window.open('', '_blank')
  if (w) w.opener = null
  return w
}

/** G3 (punto 15) · El rótulo: «Enviar confirmación» / «Enviar recordatorio», en una o dos líneas. */
function Rotulo({ texto, dosLineas }: { texto: string; dosLineas: boolean }): ReactElement {
  const [primera, ...resto] = texto.split(' ')
  if (!dosLineas || resto.length === 0) return <span>{texto}</span>
  return <span className="ag-capa-dos-lineas"><span>{primera}</span> <span>{resto.join(' ')}</span></span>
}

/** G3 · El mensaje del botón: arriba (`alMensaje`) o debajo, como antes. */
function useMensaje(estado: Estado, abierto: string | null, alMensaje: Props['alMensaje']): { texto: string; alerta: boolean } | null {
  const mensaje = estado.tipo === 'error' ? { texto: estado.motivo, alerta: true }
    : abierto ? { texto: `Abierto en WhatsApp ${horaCorta(abierto)}`, alerta: false } : null
  const texto = mensaje?.texto ?? null
  const alerta = mensaje?.alerta ?? false
  const breve = !alerta && abierto ? `WhatsApp abierto ${horaCorta(abierto)}` : undefined
  useEffect(() => { alMensaje?.(texto === null ? null : { texto, alerta, breve }) }, [texto, alerta, breve, alMensaje])
  return alMensaje ? null : mensaje
}

export function BotonWhatsAppCita(props: Props) {
  const { citaId, tipo, marcadoEn, confirmada = false, compacto = false, enCapa = false, dosLineas = false } = props
  const etiqueta = props.etiqueta ?? (confirmada ? 'Enviar recordatorio' : 'Enviar confirmación')
  const [estado, setEstado] = useState<Estado>({ tipo: 'inicial' })
  const [abierto, setAbierto] = useState<string | null>(marcadoEn)
  const mensajeDebajo = useMensaje(estado, abierto, props.alMensaje)

  function marcar(): void {
    setAbierto(new Date().toISOString())
    avisarAbierto(citaId, tipo)
  }

  async function alPulsar(): Promise<void> {
    const pestana = pestanaEnBlanco()
    setEstado({ tipo: 'preparando' })
    const e = await prepararWhatsApp(citaId, tipo)
    if (e.tipo !== 'listo') { pestana?.close(); setEstado(e); return }
    if (!pestana) { setEstado(e); return } // bloqueada: queda el enlace real para pulsar
    pestana.location.href = e.url
    setEstado({ tipo: 'inicial' })
    marcar()
  }

  const soloIcono = props.soloIcono === true
  const clase = soloIcono ? 'ag-boton-icono'
    : enCapa
    ? 'ag-capa-boton w-full'
    : `${compacto ? 'px-2.5 py-1.5 text-[12px]' : 'w-full px-3 py-2.5 text-sm'} flex items-center justify-center gap-1.5 rounded-xl font-bold border transition-colors`
  const estilo = enCapa ? undefined : { color: 'var(--ag-text)', borderColor: 'var(--ag-input-border)' }
  const hover = enCapa ? '' : 'hover:bg-[var(--ag-btn-ghost-hover)]'
  const logo = <LogoWhatsApp size={enCapa || soloIcono ? 20 : 16} />
  const nombreIcono = tipo === 'recordatorio' ? 'Enviar recordatorio por WhatsApp' : 'Enviar confirmación por WhatsApp'
  const foco = { tabIndex: props.tabIndex, onFocus: props.onFocus }
  return (
    <div data-whatsapp-cita={citaId} className={props.claseCelda ? `ag-lectura-celda ${props.claseCelda}` : undefined}>
      {estado.tipo === 'listo' ? (
        <a href={estado.url} target="_blank" rel="noopener noreferrer" onClick={() => { marcar(); setEstado({ tipo: 'inicial' }) }}
          className={`${clase} ${hover}`} style={soloIcono ? undefined : estilo} {...foco}
          aria-label={soloIcono ? 'Abrir WhatsApp' : undefined} title={soloIcono ? 'Abrir WhatsApp' : undefined}>
          {logo}{soloIcono ? null : ' Abrir WhatsApp'}
        </a>
      ) : (
        <button type="button" disabled={estado.tipo === 'preparando'} onClick={() => { void alPulsar() }}
          className={`${clase} ${estado.tipo === 'preparando' ? 'opacity-60 cursor-wait' : hover}`} style={soloIcono ? undefined : estilo} {...foco}
          aria-label={soloIcono ? nombreIcono : undefined} title={soloIcono ? nombreIcono : undefined}
          aria-busy={soloIcono && estado.tipo === 'preparando' ? true : undefined}>
          {logo}{soloIcono ? null : <> {estado.tipo === 'preparando' ? 'Preparando…' : <Rotulo texto={etiqueta} dosLineas={dosLineas} />}</>}
        </button>
      )}
      {mensajeDebajo && (
        <p role={mensajeDebajo.alerta ? 'alert' : undefined} className="text-[12px] mt-1 leading-relaxed" style={{ color: 'var(--ag-muted)' }}>{mensajeDebajo.texto}</p>
      )}
    </div>
  )
}
