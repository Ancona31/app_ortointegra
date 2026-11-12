'use client'

/**
 * Los cuatro ajustes de la agenda por clínica (`mejora_agendaV2.md` §2) en la
 * pantalla de configuración (B4). Sólo los edita quien administra la clínica;
 * los demás los ven deshabilitados (P7). El candado no se muestra (§2).
 *
 * El formulario avisa antes de enviar con el MISMO esquema que la ruta
 * (`ajustesDesdeFormulario`), pero quien decide es `PUT /api/me/ajustes-agenda`.
 */
import { useState, type FormEvent } from 'react'
import CampoAjuste from '@/components/agenda/configuracion/CampoAjuste'
import { leerMotivoError } from '@/components/agenda/configuracion/leerMotivoError'
import { useToast } from '@/components/ui/Toast'
import {
  AjustesAgendaSchema, CAMPOS_AJUSTES_AGENDA, ajustesDesdeFormulario, type AjustesAgenda, type CampoAjusteAgenda,
} from '@/lib/agenda/ajustesAgenda'

type Valores = Record<CampoAjusteAgenda, string>

function aTexto(a: AjustesAgenda): Valores {
  return {
    recordatorio_horas: String(a.recordatorio_horas),
    anticipacion_min_horas: String(a.anticipacion_min_horas),
    horizonte_dias: String(a.horizonte_dias),
    vigencia_enlace_unico_dias: String(a.vigencia_enlace_unico_dias),
  }
}

/** Manda los ajustes. Devuelve los guardados, o el motivo del fallo. */
async function enviar(ajustes: AjustesAgenda): Promise<{ ok: true; ajustes: AjustesAgenda } | { ok: false; error: string }> {
  const porDefecto = 'No se pudieron guardar los ajustes'
  try {
    const res = await fetch('/api/me/ajustes-agenda', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ajustes),
    })
    if (!res.ok) return { ok: false, error: await leerMotivoError(res, porDefecto) }
    const cuerpo: unknown = await res.json().catch(() => null)
    const leidos = cuerpo && typeof cuerpo === 'object' && 'ajustes' in cuerpo
      ? AjustesAgendaSchema.safeParse(cuerpo.ajustes) : null
    return leidos?.success ? { ok: true, ajustes: leidos.data } : { ok: true, ajustes }
  } catch {
    return { ok: false, error: porDefecto }
  }
}

export default function SeccionAjustesReserva({ inicial, puedeEditar }: { inicial: AjustesAgenda | null; puedeEditar: boolean }) {
  const [valores, setValores] = useState<Valores | null>(() => (inicial ? aTexto(inicial) : null))
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const toast = useToast()

  async function guardar(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (!valores) return
    const r = ajustesDesdeFormulario(valores)
    if (!r.ok) { setError(r.error); return }
    setGuardando(true)
    const res = await enviar(r.ajustes)
    setGuardando(false)
    if (!res.ok) { setError(res.error); return }
    setError(null)
    setValores(aTexto(res.ajustes))
    toast.success('Ajustes guardados')
  }

  return (
    <section aria-labelledby="config-ajustes" className="rounded-2xl border border-[var(--ag-border-card)] bg-[var(--ag-surface)] p-5 space-y-4">
      <div>
        <h2 id="config-ajustes" className="text-base font-semibold text-[var(--ag-text)]">Reserva por enlace y recordatorios</h2>
        <p className="text-sm text-[var(--ag-muted)]">Valen hacia adelante: un enlace de un solo uso ya emitido conserva la vigencia con la que nació.</p>
      </div>
      {!valores ? (
        <p className="text-sm text-[var(--ag-muted)]">No se pudieron leer los ajustes. Recarga la página.</p>
      ) : (
        <form onSubmit={guardar} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {CAMPOS_AJUSTES_AGENDA.map(c => (
              <CampoAjuste key={c} campo={c} valor={valores[c]} deshabilitado={!puedeEditar || guardando}
                onCambio={v => setValores(prev => (prev ? { ...prev, [c]: v } : prev))} />
            ))}
          </div>
          {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
          {puedeEditar && (
            <button type="submit" disabled={guardando}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#1e5fa8] hover:bg-[#1a4f8c] disabled:opacity-50">
              {guardando ? 'Guardando…' : 'Guardar ajustes'}
            </button>
          )}
        </form>
      )}
    </section>
  )
}
