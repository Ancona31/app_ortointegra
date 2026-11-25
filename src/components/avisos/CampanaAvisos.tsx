'use client'

/**
 * src/components/avisos/CampanaAvisos.tsx — el cuerpo de `CampanaGlobal`: el
 * botón de la campana en la navegación, su lista de «Avisos» y la burbuja que
 * sale sola cuando llega uno con la página abierta.
 *
 * · EL BOTÓN va por portal a las ranuras `[data-ranura-campana]` de la
 *   navegación (pie de la barra, encabezado del teléfono y riel): una por
 *   formato, y CSS deja a la vista sólo la del formato vigente.
 * · LA LISTA se lee DIRECTO desde el navegador con la sesión, bajo la RLS de
 *   `avisos_clinica` (`leerAvisosClinica`, con `clinica_id` explícito): una
 *   consulta, o dos si hay avisos. NO pasa por `GET /api/avisos`, que cuesta
 *   `getUser()` + perfil + ajustes por llamada. Es una decisión de «dejar ver»,
 *   no un redirect: la barrera es la RLS («Autoridad de sesión», CLAUDE.md).
 * · SE ENTERA de lo nuevo releyendo cada `SONDEO_MS` con la pestaña a la vista
 *   y al volver a ella. Nunca en segundo plano.
 * · Pulsar un aviso lo marca revisado PARA MÍ (mi fila en `avisos_vistos`, M1;
 *   directo y bajo RLS, sin pasar por la ruta) y abre su cita en la agenda
 *   (`/agenda?cita=<id>`, `ListaAvisos` sin `alAbrir`).
 * · El médico administrador puede quedarse con «Solo mis avisos» (`InterruptorMisAvisos`).
 *
 * ⚠️ Nada clínico: lo que pinta sale de `textoAviso`/`textoEmergente`.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { Bell, X } from 'lucide-react'
import { CapaBarra } from '@/components/agenda/CapaBarra'
import { InterruptorMisAvisos, useSoloMisAvisos } from '@/components/avisos/InterruptorMisAvisos'
import { ListaAvisos } from '@/components/avisos/ListaAvisos'
import { useAvisosClinica, type EstadoAvisos } from '@/hooks/useAvisosClinica'
import { useDialogoModal } from '@/hooks/useDialogoModal'
import { useProfile } from '@/hooks/useProfile'
import { TIPOS_AVISO, type RespuestaAvisos } from '@/lib/avisos/avisosClinica'
import { leerAvisosClinica, marcarAvisosRevisados } from '@/lib/avisos/avisosServidor'
import { createClient } from '@/lib/supabase/client'

/** Cada cuánto se relee con la pestaña a la vista (2 min: la ventana de «recién llegado»). */
export const SONDEO_MS = 120_000

/** «Avisos», «Avisos (3 sin revisar)»: el número no puede vivir sólo en el dibujo. */
export function etiquetaCampanaGlobal(m: number | null): string {
  if (!m) return 'Avisos'
  return `Avisos (${m} sin revisar)`
}

/**
 * Las ranuras de la navegación. Se leen UNA vez, al montar: este componente sólo existe en el
 * navegador (`ssr: false`) y su chunk llega después de hidratar, con la navegación ya pintada
 * (vive en el mismo layout y no se desmonta).
 */
function leerRanuras(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-ranura-campana]')]
}

/** Relee cada `SONDEO_MS` y al volver a la pestaña; con la pestaña oculta, nada. */
function useSondeo(recargar: () => void): void {
  useEffect(() => {
    const siVisible = (): void => { if (document.visibilityState === 'visible') recargar() }
    const reloj = setInterval(siVisible, SONDEO_MS)
    document.addEventListener('visibilitychange', siVisible)
    return () => {
      clearInterval(reloj)
      document.removeEventListener('visibilitychange', siVisible)
    }
  }, [recargar])
}

export default function CampanaAvisos(): ReactElement | null {
  const { profile } = useProfile()
  const clinicaId = profile?.clinica_id ?? null
  const pedir = useCallback(async (): Promise<RespuestaAvisos | null> => {
    if (!clinicaId) return null
    return leerAvisosClinica(createClient(), clinicaId)
  }, [clinicaId])
  const usuarioId = profile?.id ?? null
  /* Revisar también va directo, bajo RLS: MI fila en `avisos_vistos` (M1). Sin viaje a la ruta ni a Auth. */
  const marcar = useCallback(async (ids: string[]): Promise<boolean> => {
    if (!clinicaId || !usuarioId) return false
    return (await marcarAvisosRevisados(createClient(), clinicaId, usuarioId, ids)).ok
  }, [clinicaId, usuarioId])
  const { soloDe } = useSoloMisAvisos()
  const avisos = useAvisosClinica({ emergentes: TIPOS_AVISO, pedir, marcar, soloDe })
  useSondeo(avisos.recargar)
  const [ranuras] = useState(leerRanuras)
  const [boton, setBoton] = useState<HTMLElement | null>(null)
  const cerrar = useCallback(() => setBoton(null), [])
  if (!avisos.disponible) return null
  const m = avisos.avisos?.length ?? 0
  return (
    <>
      {ranuras.map(r => createPortal(
        <button type="button" data-campana-global="" className={`${CLASE_BOTON[r.dataset.ranuraCampana ?? ''] ?? 'nav-icono'} nav-campana k-pulsable`}
          aria-label={etiquetaCampanaGlobal(m)} title="Avisos" aria-haspopup="dialog" aria-expanded={boton !== null}
          onClick={(e) => {
            const b = e.currentTarget
            setBoton(a => (a ? null : b))
            if (!boton) avisos.recargar()
          }}>
          <Bell size={20} aria-hidden="true" />
          {m > 0 && <span className="nav-distintivo nav-distintivo--avisos" data-avisos-pendientes={m} aria-hidden="true">{m > 9 ? '9+' : m}</span>}
        </button>, r, r.dataset.ranuraCampana,
      ))}
      {boton && <PanelAvisos boton={boton} alCerrar={cerrar} avisos={avisos} />}
    </>
  )
}

/* La pinta del botón es la de su vecino en cada ranura: nada de estética nueva. */
const CLASE_BOTON: Record<string, string> = {
  barra: 'nav-icono nav-icono--barra', encabezado: 'nav-icono', riel: 'nav-riel-boton',
}

function PanelAvisos({ boton, alCerrar, avisos }: { boton: HTMLElement; alCerrar: () => void; avisos: EstadoAvisos }): ReactElement {
  const { montarPanel, alPulsarTecla } = useDialogoModal(alCerrar)
  return (
    <CapaBarra boton={boton} rol="dialog" etiqueta="Avisos" clase="ag-capa--campana ag-capa--avisos-global"
      alCerrar={alCerrar} alMontar={montarPanel} alPulsarTecla={alPulsarTecla} datos={{ 'data-panel-avisos-global': '' }}>
      <div className="ag-campana-cab">
        <h2 className="flex-1 text-[15px] font-bold" style={{ color: 'var(--tinta)' }}>Avisos</h2>
        <button type="button" className="ag-capa-cerrar" onClick={alCerrar} aria-label="Cerrar"><X size={16} aria-hidden="true" /></button>
      </div>
      <InterruptorMisAvisos />
      {avisos.avisos === null
        ? <p className="text-[12px]" style={{ color: 'var(--tinta2)' }}>Cargando…</p>
        : <ListaAvisos avisos={avisos.avisos} revisar={avisos.revisar} revisarTodos={avisos.revisarTodos} />}
    </CapaBarra>
  )
}
