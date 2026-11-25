'use client'

/**
 * src/components/agenda/MenuEngraneAgenda.tsx — el engrane de la barra de la
 * agenda v2 (tanda I, punto 15 de Angel): un menú con «Configuración de la
 * agenda», «Compactar la rejilla», «Densidad compacta», «Pop-up de eventos»,
 * «Atajos de teclado» y «Leyenda de estados». Los botones de Compactar,
 * Densidad y atajos, y la fila de la leyenda, salen de la barra y viven aquí;
 * ninguna función se pierde. «Pop-up de eventos» (tanda J, punto 18) es la
 * preferencia «Abrir la tarjeta al pasar el ratón», que salió de la
 * configuración: sigue guardándose en ESTE dispositivo (`tarjetaAlPasar.ts`,
 * `localStorage`) y la lee el vigía al disparar, así que no hay estado de más.
 *
 * Patrón APG «Menu Button»: el botón lleva `aria-haspopup="menu"` y
 * `aria-expanded`; abrir (clic, Intro, Espacio o ↓) enfoca la primera opción
 * y ↑ la última; dentro, ↑/↓ recorren en bucle, Inicio/Fin van a los
 * extremos, Escape cierra y devuelve el foco al botón, Tab cierra (y lo devuelve también). Las tres
 * preferencias son `menuitemcheckbox` (`aria-checked`) y NO cierran el menú al
 * pulsarse (se ve el estado cambiar); las otras tres lo cierran. Tanda J
 * (punto 19): cada preferencia lleva a la derecha un INTERRUPTOR que dice cómo
 * está (sólo dibujo, `aria-hidden`: el estado lo anuncia `aria-checked`); lo
 * que abre algo es una fila normal. Densidad tiene dos valores (normal y
 * compacta): es interruptor y su fila dice «Densidad compacta».
 *
 * La leyenda se abre en su propia capa, colgada del mismo engrane (diálogo,
 * `useDialogoModal`). B13 (§28): es su ÚNICA puerta; el botón de la barra de
 * computadora (tanda L, punto 11) se retiró.
 */
import { useCallback, useRef, useState, type KeyboardEvent, type ReactElement, type RefObject, type ReactNode } from 'react'
import { CalendarPlus, ChevronDown, ChevronsDownUp, Info, Keyboard, Lock, MoreHorizontal, MousePointer2, Rows4, Search, Settings, User, X } from 'lucide-react'
import { useDialogoModal } from '@/hooks/useDialogoModal'
import { CapaBarra } from '@/components/agenda/CapaBarra'
import { LeyendaEstados } from '@/components/agenda/LeyendaEstados'
import { teclasDeAccion } from '@/lib/agenda/atajosAgenda'
import { guardarTarjetaAlPasar, leerTarjetaAlPasar } from '@/lib/agenda/tarjetaAlPasar'

/* Integración L · el candado de L1 viaja en ESTE chunk (el de la barra v2): importado en
   estático desde `AgendaCliente` bajaba también con la v2 apagada (regla de J1, AG-DT-136). */
export { default as BotonBloquearHorario } from '@/components/agenda/BotonBloquearHorario'

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
  /** B13 · La barra por formato (PIEZAS §4): lo que fuera de la computadora sale de la barra y vive en
      este menú. Sin ella (computadora), el menú de siempre. */
  banda?: OpcionesDeBanda
}

/** B13 · Lo que la banda (`ext`/`tel`/`ih`/`iv`) pasa al menú: cada opción, o null si no aplica ahí. */
export interface OpcionesDeBanda {
  /** «Buscar citas de un paciente» (en `ext`/`tel`; en `ih`/`iv` la lupa sigue en la barra). */
  buscar: (() => void) | null
  /** El filtro de médico (sólo con varios médicos). */
  medico: MedicoDelMenu | null
  /** «Huecos disponibles» (`ih`/`iv`, Día, un médico): el contenido de su capa; `cerrar` la cierra. */
  huecos: ((cerrar: () => void) => ReactNode) | null
  /** «Bloquear horario» (el candado de la barra de computadora). */
  bloquear: (() => void) | null
}

export interface MedicoDelMenu {
  opciones: readonly { id: string; nombre: string }[]
  /** '' = todos los médicos. */
  elegido: string
  /** El rótulo de «Todos los médicos» (`OPCION_TODOS`) y si se puede elegir (en Mes, no). */
  todos: string
  todosDesactivado: boolean
  elegir: (id: string) => void
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

/** El botón que abre el menú: «···» en la banda (PIEZAS §4), el engrane en computadora. Flecha abajo o
    arriba lo abre con el foco en la primera o la última opción. Auditoría B13 · 7: sale de
    `MenuEngraneAgenda` para dejarla en el tope de 50 líneas. */
function BotonOpciones({ boton, enBanda, banda, abierto, abrir, alPulsar }: {
  boton: RefObject<HTMLButtonElement | null>; enBanda: boolean; banda: boolean; abierto: boolean
  abrir: (foco: 'primera' | 'ultima') => void; alPulsar: () => void
}): ReactElement {
  return (
    <button type="button" ref={boton} data-engrane-agenda=""
      className={enBanda ? 'ag-banda-movil-ctrl ag-banda-movil-ctrl--marco' : 'ag-herramienta'}
      aria-label="Opciones de la agenda" title="Opciones de la agenda" aria-haspopup="menu" aria-expanded={abierto}
      onClick={alPulsar}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); abrir(e.key === 'ArrowUp' ? 'ultima' : 'primera') }
      }}>
      {banda ? <MoreHorizontal size={20} aria-hidden="true" /> : <Settings size={enBanda ? 18 : 16} aria-hidden="true" />}
    </button>
  )
}

export function MenuEngraneAgenda({ onConfiguracion, compactar, densidad, atajos, enBanda = false, banda }: Props): ReactElement {
  const [abierto, setAbierto] = useState<{ boton: HTMLElement; foco: 'primera' | 'ultima' } | null>(null)
  const [leyenda, setLeyenda] = useState<HTMLElement | null>(null)
  const [huecos, setHuecos] = useState<HTMLElement | null>(null)
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
      <BotonOpciones boton={botonRef} enBanda={enBanda} banda={banda !== undefined} abierto={abierto !== null} abrir={abrir}
        alPulsar={() => { setLeyenda(null); setHuecos(null); if (abierto) cerrar(); else abrir('primera') }} />
      {abierto && (
        <MenuAbierto boton={abierto.boton} foco={abierto.foco} cerrar={cerrar}>
          {banda && <OpcionesDeLaBanda banda={banda} ejecutar={ejecutar} abrirHuecos={() => setHuecos(abierto.boton)} />}
          {onConfiguracion && <Opcion icono={<Settings size={16} />} texto="Configuración de la agenda" id="configuracion" alPulsar={ejecutar(onConfiguracion)} />}
          {onConfiguracion && <hr className="ag-menu-sep" />}
          {compactar && (
            <Opcion icono={<ChevronsDownUp size={16} />} texto={compactar.corta} etiqueta={compactar.etiqueta} id="compactar"
              marcada={compactar.encendida} alPulsar={compactar.alternar} />
          )}
          {densidad && (
            <Opcion icono={<Rows4 size={16} />} texto="Densidad compacta" id="densidad"
              marcada={densidad.encendida} alPulsar={densidad.alternar} />
          )}
          <OpcionPopUp />
          {atajos && <Opcion icono={<Keyboard size={16} />} texto="Atajos de teclado" id="atajos" desactivada={!atajos.listos}
            teclas={atajos.encendidos ? teclasDeAccion('ayuda') : undefined} alPulsar={ejecutar(atajos.abrir)} />}
          <hr className="ag-menu-sep" />
          {/* B13 · AG8: todas las filas llevan su icono (maqueta `ag-herr`). La leyenda se abre desde aquí: si el
              botón de la barra se retira (§28), no se pierde. */}
          <Opcion icono={<Info size={16} />} texto="Leyenda de estados" id="leyenda" alPulsar={ejecutar(() => setLeyenda(abierto.boton))} />
        </MenuAbierto>
      )}
      {leyenda && <CapaLeyenda boton={leyenda} alCerrar={() => setLeyenda(null)} />}
      {huecos && banda?.huecos && <CapaHuecos boton={huecos} contenido={banda.huecos} alCerrar={() => setHuecos(null)} />}
    </>
  )
}

/** B13 · Las opciones que la banda trae a la cabeza del menú (maqueta `ag-herr`, «Opciones de la agenda»). */
function OpcionesDeLaBanda({ banda, ejecutar, abrirHuecos }: {
  banda: OpcionesDeBanda; ejecutar: (accion: () => void) => () => void; abrirHuecos: () => void
}): ReactElement | null {
  const { buscar, medico, huecos, bloquear } = banda
  if (!buscar && !medico && !huecos && !bloquear) return null
  return (
    <>
      {buscar && <Opcion icono={<Search size={16} />} texto="Buscar citas de un paciente" id="buscar" alPulsar={ejecutar(buscar)} />}
      {medico && <OpcionMedico medico={medico} ejecutar={ejecutar} />}
      {huecos && <Opcion icono={<CalendarPlus size={16} />} texto="Huecos disponibles" id="huecos" alPulsar={ejecutar(abrirHuecos)} />}
      {bloquear && <Opcion icono={<Lock size={16} />} texto="Bloquear horario" id="bloquear" alPulsar={ejecutar(bloquear)} />}
      <hr className="ag-menu-sep" />
    </>
  )
}

/** «Médico» con el elegido debajo; se despliega en el sitio con una opción por médico (`menuitemradio`). */
function OpcionMedico({ medico, ejecutar }: { medico: MedicoDelMenu; ejecutar: (accion: () => void) => () => void }): ReactElement {
  const [desplegado, setDesplegado] = useState(false)
  const nombreElegido = medico.opciones.find(m => m.id === medico.elegido)?.nombre ?? medico.todos
  const filas = [{ id: '', nombre: medico.todos }, ...medico.opciones]
  return (
    <>
      <button type="button" tabIndex={-1} className="ag-menu-opcion ag-menu-opcion--medico" data-opcion="medico"
        role="menuitem" aria-haspopup="true" aria-expanded={desplegado} onClick={() => setDesplegado(d => !d)}>
        <span className="ag-menu-icono" aria-hidden="true"><User size={16} /></span>
        <span className="ag-menu-dos-lineas"><span>Médico</span><span className="ag-menu-detalle">{nombreElegido}</span></span>
        <ChevronDown size={16} aria-hidden="true" className="ag-menu-chevron" />
      </button>
      {desplegado && (
        <div role="group" aria-label="Médico" className="ag-menu-sub">
          {filas.map(f => {
            const desactivada = f.id === '' && medico.todosDesactivado
            return (
              <button key={f.id || 'todos'} type="button" tabIndex={-1} className="ag-menu-opcion ag-menu-radio"
                role="menuitemradio" aria-checked={f.id === medico.elegido} aria-disabled={desactivada || undefined}
                data-opcion-medico={f.id} onClick={() => { if (!desactivada) ejecutar(() => medico.elegir(f.id))() }}>
                <span>{f.nombre}</span>
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}

/** B13 · «Huecos disponibles» en `ih`/`iv` (§28): la tarjeta de huecos del panel del Día, en su capa. */
function CapaHuecos({ boton, contenido, alCerrar }: {
  boton: HTMLElement; contenido: (cerrar: () => void) => ReactNode; alCerrar: () => void
}): ReactElement {
  const { montarPanel, alPulsarTecla } = useDialogoModal(alCerrar)
  return (
    <CapaBarra boton={boton} rol="dialog" etiqueta="Huecos disponibles" clase="ag-capa--huecos"
      alCerrar={alCerrar} alMontar={montarPanel} alPulsarTecla={alPulsarTecla} datos={{ 'data-capa-huecos': '' }}>
      <div className="ag-capa-cab">
        <p className="ag-capa-titulo">Huecos disponibles</p>
        <button type="button" className="ag-capa-cerrar" onClick={alCerrar} aria-label="Cerrar"><X size={16} aria-hidden="true" /></button>
      </div>
      {contenido(alCerrar)}
    </CapaBarra>
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

function Opcion({ icono, texto, etiqueta, id, marcada, desactivada = false, teclas, alPulsar }: {
  icono?: ReactNode; texto: string; etiqueta?: string; id: string; teclas?: string
  /** Definida = `menuitemcheckbox`, con su interruptor a la derecha. */
  marcada?: boolean; desactivada?: boolean; alPulsar: () => void
}): ReactElement {
  return (
    <button type="button" tabIndex={-1} className="ag-menu-opcion" data-opcion={id}
      role={marcada === undefined ? 'menuitem' : 'menuitemcheckbox'} aria-checked={marcada}
      aria-label={etiqueta} aria-disabled={desactivada || undefined} aria-keyshortcuts={teclas}
      onClick={() => { if (!desactivada) alPulsar() }}>
      {icono && <span className="ag-menu-icono" aria-hidden="true">{icono}</span>}
      <span>{texto}</span>
      {marcada !== undefined && <Interruptor encendido={marcada} />}
    </button>
  )
}

/** El dibujo del interruptor: el mismo de «Todo el día» del formulario (pista de 40 × 24, perilla blanca de 20). */
function Interruptor({ encendido }: { encendido: boolean }): ReactElement {
  return (
    <span aria-hidden="true" data-interruptor="" data-encendido={String(encendido)}
      className="relative ml-auto w-10 h-6 flex-none rounded-full transition-colors motion-reduce:transition-none"
      style={{ background: encendido ? 'var(--ag-brand-primary)' : 'var(--ag-input-border)' }}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 motion-reduce:transition-none ${encendido ? 'translate-x-4' : 'translate-x-0'}`} />
    </span>
  )
}

function almacen(): Storage | null {
  try { return window.localStorage } catch { return null }
}

/**
 * Tanda J (punto 18) · «Pop-up de eventos»: la tarjeta de la cita al dejar el
 * ratón quieto encima. Se lee al abrir el menú (sólo se monta abierto, y el
 * menú sólo existe en el navegador) y se guarda donde siempre; el vigía
 * (`useTarjetaAlPasar`) la vuelve a leer en cada disparo. En pantallas táctiles
 * no cambia nada (ahí la tarjeta sigue al toque), como decía la configuración.
 */
function OpcionPopUp(): ReactElement {
  const [encendida, setEncendida] = useState(() => leerTarjetaAlPasar(almacen()))
  const alternar = (): void => {
    guardarTarjetaAlPasar(almacen(), !encendida)
    setEncendida(!encendida)
  }
  return <Opcion icono={<MousePointer2 size={16} />} texto="Pop-up de eventos" id="tarjeta-al-pasar" marcada={encendida} alPulsar={alternar} />
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
