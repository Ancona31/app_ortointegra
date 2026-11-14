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
import { useState, type ReactElement } from 'react'
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
  /** Etiqueta del botón. */
  etiqueta?: string
  compacto?: boolean
  /** T1: con la pinta de los botones de las capas (`.ag-capa-boton`), a todo el ancho de su celda. */
  enCapa?: boolean
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

export function BotonWhatsAppCita({ citaId, tipo, marcadoEn, etiqueta = 'Enviar por WhatsApp', compacto = false, enCapa = false }: Props) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'inicial' })
  const [abierto, setAbierto] = useState<string | null>(marcadoEn)

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

  const clase = enCapa
    ? 'ag-capa-boton w-full'
    : `${compacto ? 'px-2.5 py-1.5 text-[12px]' : 'w-full px-3 py-2.5 text-sm'} flex items-center justify-center gap-1.5 rounded-xl font-bold border transition-colors`
  const estilo = enCapa ? undefined : { color: 'var(--ag-text)', borderColor: 'var(--ag-input-border)' }
  const hover = enCapa ? '' : 'hover:bg-[var(--ag-btn-ghost-hover)]'
  return (
    <div data-whatsapp-cita={citaId}>
      {estado.tipo === 'listo' ? (
        <a href={estado.url} target="_blank" rel="noopener noreferrer" onClick={() => { marcar(); setEstado({ tipo: 'inicial' }) }}
          className={`${clase} ${hover}`} style={estilo}>
          <LogoWhatsApp /> Abrir WhatsApp
        </a>
      ) : (
        <button type="button" disabled={estado.tipo === 'preparando'} onClick={() => { void alPulsar() }}
          className={`${clase} ${estado.tipo === 'preparando' ? 'opacity-60 cursor-wait' : hover}`} style={estilo}>
          <LogoWhatsApp /> {estado.tipo === 'preparando' ? 'Preparando…' : etiqueta}
        </button>
      )}
      {estado.tipo === 'error' && (
        <p role="alert" className="text-[12px] mt-1 leading-relaxed" style={{ color: 'var(--ag-muted)' }}>{estado.motivo}</p>
      )}
      {abierto && (
        <p className="text-[12px] mt-1" style={{ color: 'var(--ag-muted)' }}>Abierto en WhatsApp {horaCorta(abierto)}</p>
      )}
    </div>
  )
}
