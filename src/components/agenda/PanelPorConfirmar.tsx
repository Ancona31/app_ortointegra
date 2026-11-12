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
 */
import { useCallback, useEffect, useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { enOcioso, cancelarOcioso } from '@/lib/agenda/ocioso'
import type { FilaPorConfirmar } from '@/lib/agenda/whatsappCita'
import type { FilaCancelada } from '@/lib/agenda/avisoCancelacion'
import { BotonWhatsAppCita } from '@/components/agenda/BotonWhatsAppCita'

function esFila(x: unknown): x is FilaPorConfirmar {
  return typeof x === 'object' && x !== null
    && 'id' in x && typeof x.id === 'string' && 'inicio' in x && typeof x.inicio === 'string'
    && 'zona' in x && typeof x.zona === 'string' && 'titulo' in x && typeof x.titulo === 'string'
    && 'tiene_telefono' in x && typeof x.tiene_telefono === 'boolean'
    && 'whatsapp_reminder_sent_at' in x && (x.whatsapp_reminder_sent_at === null || typeof x.whatsapp_reminder_sent_at === 'string')
}

function esCancelada(x: unknown): x is FilaCancelada {
  return typeof x === 'object' && x !== null
    && 'id' in x && typeof x.id === 'string' && 'inicio' in x && typeof x.inicio === 'string'
    && 'zona' in x && typeof x.zona === 'string' && 'titulo' in x && typeof x.titulo === 'string'
    && 'respondido_en' in x && typeof x.respondido_en === 'string'
}

interface Listas { citas: FilaPorConfirmar[]; canceladas: FilaCancelada[] }

async function pedirPorConfirmar(): Promise<Listas | null> {
  try {
    const res = await fetch('/api/agenda/por-confirmar')
    if (!res.ok) return null
    const datos: unknown = await res.json()
    if (typeof datos !== 'object' || datos === null || !('citas' in datos) || !Array.isArray(datos.citas)) return null
    const canceladas = 'canceladas' in datos && Array.isArray(datos.canceladas) ? datos.canceladas.filter(esCancelada) : []
    return { citas: datos.citas.filter(esFila), canceladas }
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

/** Las filas de mañana, cada una con su botón de WhatsApp (`tipo:'recordatorio'`). */
function ListaPorConfirmar({ citas }: { citas: FilaPorConfirmar[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {citas.map((c) => (
        <li key={c.id} data-fila-por-confirmar={c.id} className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--ag-text)' }}>{c.titulo || 'Cita'}</p>
            <p className="text-[12px]" style={{ color: 'var(--ag-muted)' }}>{horaEnZona(c.inicio, c.zona)}</p>
          </div>
          {c.tiene_telefono
            ? <BotonWhatsAppCita citaId={c.id} tipo="recordatorio" marcadoEn={c.whatsapp_reminder_sent_at} etiqueta="WhatsApp" compacto />
            : <span className="text-[12px]" style={{ color: 'var(--ag-muted)' }}>Sin teléfono</span>}
        </li>
      ))}
    </ul>
  )
}

/** `recarga`: cambia cuando la agenda se entera de una cancelación por el enlace (E8). */
export function PanelPorConfirmar({ recarga = 0 }: { recarga?: number }) {
  const [listas, setListas] = useState<Listas | null>(null)
  const [abierto, setAbierto] = useState(false)

  const recargar = useCallback((): void => {
    void pedirPorConfirmar().then((l) => { if (l) setListas(l) })
  }, [])

  useEffect(() => {
    const idle = enOcioso(recargar)
    return () => cancelarOcioso(idle)
  }, [recargar, recarga])

  const citas = listas?.citas ?? null
  const n = citas?.length ?? null
  const m = listas?.canceladas.length ?? 0
  return (
    <div className="relative">
      <button type="button" data-por-confirmar
        onClick={() => { setAbierto((v) => !v); if (!abierto) recargar() }}
        className="flex items-center gap-1.5 px-3 py-2.5 rounded-[var(--ag-r-btn)] text-sm font-semibold border transition-colors hover:bg-[var(--ag-btn-ghost-hover)] whitespace-nowrap"
        style={{ color: 'var(--ag-text)', borderColor: 'var(--ag-input-border)' }}
        aria-expanded={abierto}>
        <MessageCircle size={15} /> Por confirmar{n !== null ? ` (${n})` : ''}
        {m > 0 && <span className="ml-1 px-1.5 rounded-full text-[11px] font-bold text-white" style={{ background: 'var(--ag-status-cancelled-dot)' }}
          title="Canceladas por el paciente en las últimas 48 h">{m}</span>}
      </button>
      {abierto && (
        <div role="dialog" aria-label="Citas de mañana por confirmar"
          className="absolute right-0 top-full mt-2 z-40 w-[360px] max-h-[60vh] overflow-y-auto rounded-2xl border shadow-lg p-4"
          style={{ background: 'var(--ag-modal-bg)', borderColor: 'var(--ag-hairline)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-bold" style={{ color: 'var(--ag-text)' }}>Citas de mañana por confirmar</p>
            <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar"><X size={16} /></button>
          </div>
          {citas === null && <p className="text-[12px]" style={{ color: 'var(--ag-muted)' }}>Cargando…</p>}
          {citas?.length === 0 && <p className="text-[12px]" style={{ color: 'var(--ag-muted)' }}>No hay citas de mañana sin confirmar.</p>}
          <ListaPorConfirmar citas={citas ?? []} />
          <SeccionCanceladas canceladas={listas?.canceladas ?? []} />
        </div>
      )}
    </div>
  )
}
