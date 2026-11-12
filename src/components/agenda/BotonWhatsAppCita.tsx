'use client'

/**
 * src/components/agenda/BotonWhatsAppCita.tsx — el botón del WhatsApp MANUAL
 * de una cita (agenda E7). Lo usan el modal de la cita (`tipo:'enlace'`) y la
 * lista «citas de mañana por confirmar» (`tipo:'recordatorio'`).
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
import { useState } from 'react'
import { MessageCircle } from 'lucide-react'

type Estado = { tipo: 'inicial' } | { tipo: 'preparando' } | { tipo: 'listo'; url: string } | { tipo: 'error'; motivo: string }

const MOTIVOS: Record<string, string> = {
  sin_telefono: 'Sin teléfono registrado.',
  telefono_invalido: 'Teléfono sin formato válido.',
  no_aplica: 'Esta cita ya no admite el mensaje.',
  sin_enlace: 'No se pudo preparar el enlace de confirmación.',
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
    const error = typeof datos === 'object' && datos !== null && 'error' in datos && typeof datos.error === 'string' ? datos.error : ''
    if (res.ok && url?.startsWith('https://wa.me/')) return { tipo: 'listo', url }
    return { tipo: 'error', motivo: MOTIVOS[error] ?? 'No se pudo preparar el mensaje.' }
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

export function BotonWhatsAppCita({ citaId, tipo, marcadoEn, etiqueta = 'Enviar por WhatsApp', compacto = false }: Props) {
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

  const clase = `${compacto ? 'px-2.5 py-1.5 text-[12px]' : 'w-full px-3 py-2.5 text-sm'} flex items-center justify-center gap-1.5 rounded-xl font-bold border transition-colors`
  const estilo = { color: 'var(--ag-text)', borderColor: 'var(--ag-input-border)' }
  return (
    <div data-whatsapp-cita={citaId}>
      {estado.tipo === 'listo' ? (
        <a href={estado.url} target="_blank" rel="noopener noreferrer" onClick={() => { marcar(); setEstado({ tipo: 'inicial' }) }}
          className={`${clase} hover:bg-[var(--ag-btn-ghost-hover)]`} style={estilo}>
          <MessageCircle size={15} /> Abrir WhatsApp
        </a>
      ) : (
        <button type="button" disabled={estado.tipo === 'preparando'} onClick={() => { void alPulsar() }}
          className={`${clase} ${estado.tipo === 'preparando' ? 'opacity-60 cursor-wait' : 'hover:bg-[var(--ag-btn-ghost-hover)]'}`} style={estilo}>
          <MessageCircle size={15} /> {estado.tipo === 'preparando' ? 'Preparando…' : etiqueta}
        </button>
      )}
      {estado.tipo === 'error' && (
        <p className="text-[12px] mt-1 leading-relaxed" style={{ color: 'var(--ag-muted)' }}>{estado.motivo}</p>
      )}
      {abierto && (
        <p className="text-[12px] mt-1" style={{ color: 'var(--ag-muted)' }}>Abierto en WhatsApp {horaCorta(abierto)}</p>
      )}
    </div>
  )
}
