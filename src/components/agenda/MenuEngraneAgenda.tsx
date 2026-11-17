'use client'

/**
 * src/components/agenda/MenuEngraneAgenda.tsx — el engrane de la barra de la
 * agenda v2 (tanda I, punto 15 de Angel): un menú con «Configuración de la
 * agenda», «Compactar la rejilla», «Densidad», «Atajos de teclado» y «Leyenda
 * de estados». Los botones de Compactar, Densidad y atajos, y la fila de la
 * leyenda, salen de la barra y viven aquí; ninguna función se pierde.
 *
 * Patrón APG «Menu Button»: el botón lleva `aria-haspopup="menu"` y
 * `aria-expanded`; abrir (clic, Intro, Espacio o ↓) enfoca la primera opción
 * y ↑ la última; dentro, ↑/↓ recorren en bucle, Inicio/Fin van a los
 * extremos, Escape cierra y devuelve el foco al botón, Tab cierra (y lo devuelve también). Las dos
 * preferencias son `menuitemcheckbox` (`aria-checked`) y NO cierran el menú al
 * pulsarse (se ve el estado cambiar); las otras tres lo cierran.
 *
 * La leyenda se abre en su propia capa, colgada del mismo engrane (diálogo,
 * `useDialogoModal`).
 */
import { useCallback, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react'
import { ChevronsDownUp, Keyboard, Rows4, Settings, X } from 'lucide-react'
import { useDialogoModal } from '@/hooks/useDialogoModal'
import { CapaBarra } from '@/components/agenda/CapaBarra'
import { LeyendaEstados } from '@/components/agenda/LeyendaEstados'
import { teclasDeAccion } from '@/lib/agenda/atajosAgenda'

export interface PreferenciaMenu {
  encendida: boolean
  alternar: () => void
}

interface Props {
  /** Abre la configuración de la agenda; null = quien mira no puede editarla. */
  onConfiguracion: (() => void) | null
  /** Null = la vista no admite compactar. `etiqueta`: el nombre accesible largo (`etiquetaCompactar`). */
  compactar: (PreferenciaMenu & { etiqueta: string; corta: string }) | null
  /** Null = no aplica (Mes, o el teléfono). */
  densidad: PreferenciaMenu | null
  /** Abre la ayuda de atajos; null = no aplica (teléfono). `listos`: el chunk de la capa v2 ya montó.
      `encendidos`: los atajos de una tecla funcionan; entonces la opción anuncia su tecla (`?`),
      como el botón que sustituye. */
  atajos: { abrir: () => void; listos: boolean; encendidos: boolean } | null
  enBanda?: boolean
}

const SELECTOR_OPCION = '[role^="menuitem"]:not([aria-disabled="true"])'

function opciones(menu: HTMLElement): HTMLElement[] {
  return Array.from(menu.querySelectorAll<HTMLElement>(SELECTOR_OPCION))
}

function moverFoco(menu: HTMLElement, clave: string): boolean {
  const lista = opciones(menu)
  const i = lista.findIndex(el => el === document.activeElement)
  const destino = clave === 'ArrowDown' ? lista[(i + 1) % lista.length]
    : clave === 'ArrowUp' ? lista[(i - 1 + lista.length) % lista.length]
    : clave === 'Home' ? lista[0] : clave === 'End' ? lista[lista.length - 1] : null
  destino?.focus()
  return destino !== null && destino !== undefined
}

export function MenuEngraneAgenda({ onConfiguracion, compactar, densidad, atajos, enBanda = false }: Props): ReactElement {
  const [abierto, setAbierto] = useState<{ boton: HTMLElement; foco: 'primera' | 'ultima' } | null>(null)
  const [leyenda, setLeyenda] = useState<HTMLElement | null>(null)
  const botonRef = useRef<HTMLButtonElement | null>(null)
  const cerrar = useCallback((devolverFoco = true) => {
    setAbierto(null)
    if (devolverFoco) botonRef.current?.focus()
  }, [])
  const abrir = (foco: 'primera' | 'ultima'): void => { if (botonRef.current) setAbierto({ boton: botonRef.current, foco }) }
  /** Una opción que cierra: el foco vuelve al engrane ANTES de la acción, así un diálogo que abra se lo devuelve a él. */
  const ejecutar = (accion: () => void) => (): void => { cerrar(); accion() }
  return (
    <>
      <button type="button" ref={botonRef} data-engrane-agenda=""
        className={enBanda ? 'ag-banda-movil-ctrl ag-banda-movil-ctrl--marco' : 'ag-herramienta'}
        aria-label="Opciones de la agenda" title="Opciones de la agenda" aria-haspopup="menu" aria-expanded={abierto !== null}
        onClick={() => { setLeyenda(null); if (abierto) cerrar(); else abrir('primera') }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); abrir(e.key === 'ArrowUp' ? 'ultima' : 'primera') }
        }}>
        <Settings size={enBanda ? 18 : 16} aria-hidden="true" />
      </button>
      {abierto && (
        <MenuAbierto boton={abierto.boton} foco={abierto.foco} cerrar={cerrar}>
          {onConfiguracion && <Opcion icono={<Settings size={16} />} texto="Configuración de la agenda" id="configuracion" alPulsar={ejecutar(onConfiguracion)} />}
          {onConfiguracion && <hr className="ag-menu-sep" />}
          {compactar && (
            <Opcion icono={<ChevronsDownUp size={16} />} texto={compactar.corta} etiqueta={compactar.etiqueta} id="compactar"
              marcada={compactar.encendida} estado={compactar.encendida ? 'Encendido' : 'Apagado'} alPulsar={compactar.alternar} />
          )}
          {densidad && (
            <Opcion icono={<Rows4 size={16} />} texto="Densidad" etiqueta="Densidad compacta" id="densidad"
              marcada={densidad.encendida} estado={densidad.encendida ? 'Compacta' : 'Normal'} alPulsar={densidad.alternar} />
          )}
          {atajos && <Opcion icono={<Keyboard size={16} />} texto="Atajos de teclado" id="atajos" desactivada={!atajos.listos}
            teclas={atajos.encendidos ? teclasDeAccion('ayuda') : undefined} alPulsar={ejecutar(atajos.abrir)} />}
          {(compactar || densidad || atajos) && <hr className="ag-menu-sep" />}
          <Opcion texto="Leyenda de estados" id="leyenda" alPulsar={ejecutar(() => setLeyenda(abierto.boton))} />
        </MenuAbierto>
      )}
      {leyenda && <CapaLeyenda boton={leyenda} alCerrar={() => setLeyenda(null)} />}
    </>
  )
}

function MenuAbierto({ boton, foco, cerrar, children }: {
  boton: HTMLElement; foco: 'primera' | 'ultima'; cerrar: (devolverFoco?: boolean) => void; children: ReactNode
}): ReactElement {
  const alMontar = useCallback((nodo: HTMLDivElement | null) => {
    if (!nodo) return
    const lista = opciones(nodo)
    ;(foco === 'ultima' ? lista[lista.length - 1] : lista[0])?.focus({ preventScroll: true })
  }, [foco])
  const alTecla = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar(); return }
    // Tab también cierra, pero el menú vive en un Portal al final del <body>: sin
    // devolver el foco al engrane, el Tab natural seguiría desde allí, fuera de la barra.
    if (e.key === 'Tab') { e.preventDefault(); cerrar(); return }
    if (moverFoco(e.currentTarget, e.key)) e.preventDefault()
  }
  return (
    <CapaBarra boton={boton} rol="menu" etiqueta="Opciones de la agenda" clase="ag-capa--menu"
      alCerrar={() => cerrar(false)} alMontar={alMontar} alPulsarTecla={alTecla} datos={{ 'data-menu-engrane': '' }}>
      {children}
    </CapaBarra>
  )
}

function Opcion({ icono, texto, etiqueta, id, marcada, estado, desactivada = false, teclas, alPulsar }: {
  icono?: ReactNode; texto: string; etiqueta?: string; id: string; teclas?: string
  /** Definida = `menuitemcheckbox`. */
  marcada?: boolean; estado?: string; desactivada?: boolean; alPulsar: () => void
}): ReactElement {
  return (
    <button type="button" tabIndex={-1} className="ag-menu-opcion" data-opcion={id}
      role={marcada === undefined ? 'menuitem' : 'menuitemcheckbox'} aria-checked={marcada}
      aria-label={etiqueta} aria-disabled={desactivada || undefined} aria-keyshortcuts={teclas}
      onClick={() => { if (!desactivada) alPulsar() }}>
      {icono && <span className="ag-menu-icono" aria-hidden="true">{icono}</span>}
      <span>{texto}</span>
      {estado && <small className="ag-menu-estado" aria-hidden="true">{estado}</small>}
    </button>
  )
}

function CapaLeyenda({ boton, alCerrar }: { boton: HTMLElement; alCerrar: () => void }): ReactElement {
  const { montarPanel, alPulsarTecla } = useDialogoModal(alCerrar)
  return (
    <CapaBarra boton={boton} rol="dialog" etiqueta="Leyenda de estados" clase="ag-capa--leyenda"
      alCerrar={alCerrar} alMontar={montarPanel} alPulsarTecla={alPulsarTecla} datos={{ 'data-capa-leyenda': '' }}>
      <div className="ag-capa-cab">
        <p className="ag-capa-titulo">Leyenda de estados</p>
        <button type="button" className="ag-capa-cerrar" onClick={alCerrar} aria-label="Cerrar"><X size={16} aria-hidden="true" /></button>
      </div>
      <LeyendaEstados />
    </CapaBarra>
  )
}
