'use client'

/**
 * src/components/avisos/InterruptorMisAvisos.tsx — «Solo mis avisos» / «Toda la clínica»
 * (decisión de Angel, 2026-11-24): el médico ADMINISTRADOR elige si su campana trae los avisos
 * de toda la clínica o sólo los suyos, para que no se le llene con los de los médicos invitados.
 *
 * Sólo para él: el médico invitado ya ve sólo lo suyo (RLS) y la secretaria ve siempre todo.
 * Es una preferencia de ESTE navegador (`localStorage`, `CLAVE_SOLO_MIOS`), como «Pop-up de
 * eventos»: sin migración y sin datos de nadie. En otro equipo empieza en «Toda la clínica».
 * No cambia qué puede leer (eso es la RLS): filtra lo que ya llegó. Lo ajeno sigue pendiente.
 */
import { useSyncExternalStore, type ReactElement } from 'react'
import { useProfile } from '@/hooks/useProfile'
import { CLAVE_SOLO_MIOS } from '@/lib/avisos/avisosClinica'

const CAMBIO = 'spinus:avisos-solo-mios'

function leer(): boolean {
  try { return localStorage.getItem(CLAVE_SOLO_MIOS) === '1' } catch { return false }
}
function suscribir(aviso: () => void): () => void {
  window.addEventListener(CAMBIO, aviso)
  window.addEventListener('storage', aviso)
  return () => { window.removeEventListener(CAMBIO, aviso); window.removeEventListener('storage', aviso) }
}
function guardar(soloMios: boolean): void {
  try { localStorage.setItem(CLAVE_SOLO_MIOS, soloMios ? '1' : '0') } catch { /* sin almacén: vale para esta vista */ }
  window.dispatchEvent(new Event(CAMBIO))
}

/** El id de quien filtra «sólo los míos», o null (no es médico administrador, o eligió toda la clínica). */
export function useSoloMisAvisos(): { aplica: boolean; soloDe: string | null } {
  const { profile, isAdmin, isDoctor } = useProfile()
  const elegido = useSyncExternalStore(suscribir, leer, () => false)
  const aplica = isAdmin && isDoctor && !!profile?.id
  return { aplica, soloDe: aplica && elegido ? (profile?.id ?? null) : null }
}

export function InterruptorMisAvisos(): ReactElement | null {
  const { aplica, soloDe } = useSoloMisAvisos()
  if (!aplica) return null
  const opcion = (soloMios: boolean, etiqueta: string): ReactElement => (
    <button type="button" role="radio" aria-checked={(soloDe !== null) === soloMios} onClick={() => guardar(soloMios)}
      className="ag-campana-pestana" data-solo-mios={soloMios ? 'si' : 'no'}>
      {etiqueta}
    </button>
  )
  return (
    <div role="radiogroup" aria-label="Qué avisos ver" className="ag-campana-pestanas mb-2" data-interruptor-mis-avisos="">
      {opcion(false, 'Toda la clínica')}
      {opcion(true, 'Solo mis avisos')}
    </div>
  )
}
