'use client'

/**
 * src/components/agenda/BotonWhatsAppCita.tsx — el botón del WhatsApp MANUAL
 * de una cita (agenda E7). Lo usan el modal de la cita (`tipo:'enlace'`) y la
 * lista «citas de mañana por confirmar» (`tipo:'recordatorio'`).
 *
 * Al montarse pide, en tiempo ocioso, el enlace ya escrito
 * (`POST /api/agenda/whatsapp`, `paso:'preparar'`) y pinta un `<a>` real con
 * `target="_blank"`: un enlace de verdad no lo bloquea el navegador como
 * ventana emergente (abrirlo tras un `await` sí). Al pulsarlo, avisa
 * `paso:'abierto'` con `keepalive` (la pestaña puede irse a WhatsApp) y enseña
 * «Abierto en WhatsApp hh:mm»: se ABRIÓ, no se envió (eso no se sabe).
 *
 * Sólo se monta con la agenda v2 encendida (quien lo usa lo decide).
 */
import { useEffect, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { enOcioso, cancelarOcioso } from '@/lib/agenda/ocioso'

type Estado = { tipo: 'preparando' } | { tipo: 'listo'; url: string } | { tipo: 'error'; motivo: string }

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

export function BotonWhatsAppCita({ citaId, tipo, marcadoEn, etiqueta = 'Enviar por WhatsApp', compacto = false }: Props) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'preparando' })
  const [abierto, setAbierto] = useState<string | null>(marcadoEn)

  useEffect(() => {
    let vigente = true
    const pedir = (): void => {
      void prepararWhatsApp(citaId, tipo).then((e) => { if (vigente) setEstado(e) })
    }
    const idle = enOcioso(pedir)
    return () => { vigente = false; cancelarOcioso(idle) }
  }, [citaId, tipo])

  function alAbrir(): void {
    setAbierto(new Date().toISOString())
    void fetch('/api/agenda/whatsapp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ cita_id: citaId, paso: 'abierto', tipo }),
    }).catch(() => undefined)
  }

  const clase = `${compacto ? 'px-2.5 py-1.5 text-[12px]' : 'w-full px-3 py-2.5 text-sm'} flex items-center justify-center gap-1.5 rounded-xl font-bold border transition-colors`
  const estilo = { color: 'var(--ag-text)', borderColor: 'var(--ag-input-border)' }
  return (
    <div data-whatsapp-cita={citaId}>
      {estado.tipo === 'listo' ? (
        <a href={estado.url} target="_blank" rel="noopener noreferrer" onClick={alAbrir}
          className={`${clase} hover:bg-[var(--ag-btn-ghost-hover)]`} style={estilo}>
          <MessageCircle size={15} /> {etiqueta}
        </a>
      ) : (
        <button type="button" disabled className={`${clase} opacity-60 cursor-not-allowed`} style={estilo}>
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
