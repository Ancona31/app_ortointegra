'use client'

/**
 * T3 · La preferencia «Abrir la tarjeta al pasar el ratón» (punto 15 de la
 * tanda tras las pruebas a mano de Angel). Es de ESTE DISPOSITIVO, como la de
 * los atajos: vive en `localStorage` (`tarjetaAlPasar.ts`, lectura y escritura
 * en try/catch) y no viaja a la base. Encendida por omisión.
 *
 * Una fila: va dentro de la tarjeta «Tarjeta de la cita» del grupo «Preferencias de
 * este dispositivo» de la configuración (`ConfiguracionCalendario`).
 *
 * `useSyncExternalStore` y no `useState`: en el servidor no hay `localStorage`
 * y la casilla saldría encendida aunque el dispositivo la tenga apagada; así el
 * primer pintado usa la de omisión y la hidratación lee la real sin avisos.
 */
import { useId, useSyncExternalStore, type ReactElement } from 'react'
import { CLAVE_TARJETA_AL_PASAR, guardarTarjetaAlPasar, leerTarjetaAlPasar } from '@/lib/agenda/tarjetaAlPasar'

const oyentes = new Set<() => void>()

function almacen(): Storage | null {
  try { return window.localStorage } catch { return null }
}

function suscribir(avisar: () => void): () => void {
  const alGuardarEnOtraPestana = (e: StorageEvent): void => { if (e.key === CLAVE_TARJETA_AL_PASAR) avisar() }
  oyentes.add(avisar)
  window.addEventListener('storage', alGuardarEnOtraPestana)
  return () => {
    oyentes.delete(avisar)
    window.removeEventListener('storage', alGuardarEnOtraPestana)
  }
}

export default function PreferenciaTarjetaAlPasar(): ReactElement {
  const encendida = useSyncExternalStore(suscribir, () => leerTarjetaAlPasar(almacen()), () => true)
  const idAyuda = useId()
  function cambiar(valor: boolean): void {
    guardarTarjetaAlPasar(almacen(), valor)
    oyentes.forEach(avisar => avisar())
  }
  return (
    <label className="flex items-start gap-3 py-1 cursor-pointer">
      <input type="checkbox" className="mt-0.5 h-4 w-4 flex-none" checked={encendida}
        aria-describedby={idAyuda} onChange={e => cambiar(e.target.checked)} />
      <span>
        <span className="block text-sm font-medium text-[var(--ag-text)]">Abrir la tarjeta al pasar el ratón</span>
        <span id={idAyuda} className="block text-sm text-[var(--ag-muted)]">
          Al dejar el ratón quieto sobre una cita más de un segundo se abre su tarjeta. Sólo en este dispositivo y con ratón; en pantallas táctiles se abre al tocarla.
        </span>
      </span>
    </label>
  )
}
