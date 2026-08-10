'use client'

/**
 * Sistema de plantillas de documento — GUIA_FORMULARIOS_02_PLANTILLAS.md.
 *
 * Tres piezas en tres sitios distintos del formulario, así que el sistema no
 * puede ser un componente que lo envuelva: el hook devuelve los nodos y cada
 * formulario los coloca donde manda la spec —selector arriba, «Guardar como
 * plantilla» en la barra de acciones, panel en el hueco del formulario—.
 *
 * Común a los ocho formatos. Hoy lo consumen Laboratorio e Imagenología; los
 * otros seis lo heredan cuando se toquen en su paso.
 *
 * Lo que el formulario aporta: su `tipo`, su predicado de «vacío», y las dos
 * funciones que leen y escriben SU estado plantillable. El nombre de la
 * plantilla NUNCA entra ahí: es etiqueta privada del médico y no viaja al
 * formato.
 */

import {
  useCallback, useEffect, useLayoutEffect, useRef, useState,
  type ReactNode,
} from 'react'
import {
  ArrowLeft, Check, FileText, Pencil, RefreshCw, Save, Settings2, Trash2, X,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import ModalShell from '@/components/ui/ModalShell'
import { useToast } from '@/components/ui/Toast'
import { scrollerDe } from '@/lib/scrollDoc'
import {
  colisionDeNombre, crearPlantilla, eliminarPlantilla, esErrorDeNombreDuplicado,
  esErrorDeTope, ETIQUETA_TIPO, listarPlantillas, MAX_NOMBRE, recortarNombre,
  renombrarPlantilla, sobrescribirPlantilla, TOPE_PLANTILLAS,
  type PlantillaDocumento, type TipoPlantilla,
} from '@/lib/documentos/plantillas'

/** Lo que se guarda y lo que se aplica: JSON plano, sin datos de paciente. */
export type ContenidoPlantilla = Record<string, unknown>

/**
 * «Vaciar formulario» es aplicar ESTO, y no una operación aparte: es la misma
 * decisión que elegir plantilla —con qué contenido arranco— con una respuesta
 * más, así que va por el mismo camino y hereda el mismo Deshacer.
 *
 * Funciona porque `aplicar` ya repone sus valores iniciales para las claves
 * ausentes: sin ninguna clave, repone todas. Los campos de contexto —paciente y
 * diagnóstico— quedan intactos por construcción, porque nunca estuvieron aquí.
 */
const CONTENIDO_VACIO: ContenidoPlantilla = Object.freeze({})

/** Valor centinela de la opción de vaciar. No es un id: ninguna fila lo tiene. */
const OPCION_VACIAR = '__vaciar__'

export interface OpcionesPlantillas {
  tipo: TipoPlantilla
  /** Predicado único de «formulario vacío» del formulario. Sin segunda versión. */
  vacio: boolean
  /** Estado plantillable del formulario, con `_v` en la raíz. */
  leer: () => ContenidoPlantilla
  /**
   * Escribe el contenido guardado. Aplica solo las claves que existan hoy, y
   * **repone su valor inicial para las que falten**: de eso depende «Vaciar
   * formulario», que aplica un contenido sin ninguna clave.
   */
  aplicar: (contenido: ContenidoPlantilla) => void
  /** Búnker offline: sin red ni sesión de Supabase. El sistema no se monta. */
  desactivado?: boolean
  /** El panel oculta el selector de tipo del host mientras está abierto (§3.1). */
  onPanelChange?: (abierto: boolean) => void
}

export interface PiezasPlantillas {
  /** Card «PLANTILLA», primer bloque del formulario. */
  selector: ReactNode
  /** Secundario de la barra de acciones, a la izquierda del primario. */
  botonGuardar: ReactNode
  /** Con el panel abierto el formulario va a `display:none`, no se desmonta. */
  panelAbierto: boolean
  panel: ReactNode
  /** Diálogos de nombre y de tope. Van fuera del cuerpo que el panel apaga. */
  dialogos: ReactNode
}

export function usePlantillasDocumento(op: OpcionesPlantillas): PiezasPlantillas {
  const { tipo, vacio, leer, aplicar, desactivado = false, onPanelChange } = op
  const toast = useToast()

  const [lista, setLista] = useState<PlantillaDocumento[]>([])
  const [cargando, setCargando] = useState(!desactivado)
  const [errorCarga, setErrorCarga] = useState(false)
  const [seleccion, setSeleccion] = useState('')
  const [panelAbierto, setPanelAbierto] = useState(false)
  const [dialogo, setDialogo] = useState<'guardar' | 'tope' | null>(null)
  // `nombre: null` es el aviso de vaciado. `seleccionPrevia` devuelve el
  // desplegable a donde estaba: encadenar A → B → Deshacer tiene que dejar A
  // aplicada Y seleccionada, o el selector miente sobre lo que hay debajo.
  const [aviso, setAviso] = useState<
    { nombre: string | null; previo: ContenidoPlantilla; seleccionPrevia: string } | null
  >(null)

  /**
   * Elemento desde el que se localiza el scroller de la página al abrir el
   * panel. Lo deja el propio click —«Gestionar» o «Guardar como plantilla»—, y
   * no un ref pasado como prop: la card es un componente aparte y meterle el
   * ref del padre convierte todas sus props en valores de ref para el
   * compilador de React.
   */
  const origenRef = useRef<HTMLElement | null>(null)
  const scrollRef = useRef<{ el: HTMLElement; top: number } | null>(null)
  /** Huella del formulario en el momento de aplicar. Retira el aviso al editar. */
  const huellaRef = useRef<string | null>(null)

  const cargar = useCallback(async (): Promise<void> => {
    if (desactivado) return
    setCargando(true)
    setErrorCarga(false)
    try {
      const filas = await listarPlantillas(tipo)
      setLista(filas)
      setSeleccion(sel => (filas.some(p => p.id === sel) ? sel : ''))
    } catch (err) {
      setErrorCarga(true)
      console.error('[plantillas] carga falló:', err)
    } finally {
      setCargando(false)
    }
  }, [tipo, desactivado])

  useEffect(() => { void cargar() }, [cargar])

  // Sin lista de dependencias a propósito: corre tras CADA render, que es
  // exactamente la granularidad del criterio —«al primer cambio manual en
  // cualquier campo»—. Comparar la huella evita cablear el aviso a los treinta
  // manejadores de cambio del formulario. No encadena actualizaciones: el único
  // setState que hace apaga la condición que lo dispara.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!aviso) return
    const huella = JSON.stringify(leer())
    if (huellaRef.current === null) { huellaRef.current = huella; return }
    if (huellaRef.current !== huella) setAviso(null)
  })

  useLayoutEffect(() => {
    onPanelChange?.(panelAbierto)
    if (panelAbierto) return
    const guardado = scrollRef.current
    scrollRef.current = null
    if (guardado) guardado.el.scrollTop = guardado.top
  }, [panelAbierto, onPanelChange])

  function abrirPanel(): void {
    const origen = origenRef.current
    if (origen?.isConnected) {
      const el = scrollerDe(origen)
      scrollRef.current = { el, top: el.scrollTop }
      el.scrollTop = 0
    }
    setDialogo(null)
    setPanelAbierto(true)
  }

  function alSeleccionar(id: string): void {
    // Snapshot ANTES de pisar nada: el Deshacer es de un solo paso, no una pila.
    const previo = leer()
    const seleccionPrevia = seleccion

    if (id === OPCION_VACIAR) {
      // Vaciar no deja el desplegable «en vaciado»: es una acción, no un estado.
      // Lo que queda debajo es un formulario sin plantilla.
      setSeleccion('')
      aplicar(CONTENIDO_VACIO)
      huellaRef.current = null
      setAviso({ nombre: null, previo, seleccionPrevia })
      return
    }

    setSeleccion(id)
    if (!id) { setAviso(null); return }
    const p = lista.find(x => x.id === id)
    if (!p) return
    aplicar(p.contenido)
    huellaRef.current = null
    setAviso({ nombre: p.nombre, previo, seleccionPrevia })
  }

  function deshacer(): void {
    if (!aviso) return
    aplicar(aviso.previo)
    setSeleccion(aviso.seleccionPrevia)
    setAviso(null)
  }

  async function guardar(nombre: string): Promise<PlantillaDocumento> {
    const creada = await crearPlantilla(tipo, nombre, leer())
    await cargar()
    setSeleccion(creada.id)
    setAviso(null)
    toast.success(`Plantilla «${creada.nombre}» guardada`)
    return creada
  }

  const etiqueta = ETIQUETA_TIPO[tipo]
  const vacioParaGuardar = desactivado || errorCarga || vacio

  return {
    panelAbierto,
    selector: desactivado ? null : (
      <CardSelector
        etiqueta={etiqueta}
        lista={lista}
        cargando={cargando}
        errorCarga={errorCarga}
        vacio={vacio}
        seleccion={seleccion}
        aviso={aviso}
        onSeleccionar={alSeleccionar}
        onDeshacer={deshacer}
        onGestionar={origen => { origenRef.current = origen; abrirPanel() }}
        onReintentar={() => void cargar()}
      />
    ),
    botonGuardar: desactivado ? null : (
      <button
        type="button"
        onClick={e => {
          origenRef.current = e.currentTarget
          setDialogo(lista.length >= TOPE_PLANTILLAS ? 'tope' : 'guardar')
        }}
        disabled={vacioParaGuardar}
        title={vacio ? 'Llena el formulario para poder guardarlo como plantilla.' : undefined}
        className="sp-btn sp-btn--secondary"
        style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}
      >
        <Save size={17} /> Guardar como plantilla
      </button>
    ),
    panel: panelAbierto ? (
      <PanelPlantillas
        etiqueta={etiqueta}
        lista={lista}
        cargando={cargando}
        errorCarga={errorCarga}
        vacio={vacio}
        leer={leer}
        onRecargar={cargar}
        onVolver={() => setPanelAbierto(false)}
      />
    ) : null,
    dialogos: (
      <>
        <DialogoGuardar
          open={dialogo === 'guardar'}
          lista={lista}
          onCerrar={() => setDialogo(null)}
          onGuardar={guardar}
          onTope={() => setDialogo('tope')}
        />
        <ModalShell
          open={dialogo === 'tope'}
          onClose={() => setDialogo(null)}
          spinusGeometry="decide"
          title={`Ya tienes ${TOPE_PLANTILLAS} plantillas de ${etiqueta}`}
          footer={
            <div className="flex items-center gap-2 p-4 md:px-6">
              <button onClick={() => setDialogo(null)} className="sp-btn sp-btn--ghost">Cancelar</button>
              <div className="flex-1" />
              <button onClick={abrirPanel} className="sp-btn sp-btn--primary">Gestionar plantillas</button>
            </div>
          }
        >
          {/* El formulario se conserva íntegro: el panel lo apaga, no lo tira. */}
          <p className="sp-body p-4 md:p-6">
            Es el máximo. Para guardar esta, borra o sobrescribe una de las que ya tienes.
          </p>
        </ModalShell>
      </>
    ),
  }
}

// ── Card del selector (§1) ──────────────────────────────────────────────────

interface PropsSelector {
  etiqueta: string
  lista: PlantillaDocumento[]
  cargando: boolean
  errorCarga: boolean
  /** Apaga «Vaciar formulario»: vaciar lo vacío no hace nada. */
  vacio: boolean
  seleccion: string
  aviso: { nombre: string | null; previo: ContenidoPlantilla; seleccionPrevia: string } | null
  onSeleccionar: (id: string) => void
  onDeshacer: () => void
  onGestionar: (origen: HTMLElement) => void
  onReintentar: () => void
}

function CardSelector(p: PropsSelector) {
  const n = p.lista.length

  return (
    <section className="sp-card">
      {n === 0 && !p.cargando && !p.errorCarga ? (
        <div className="sp-tpl-empty">
          <div className="sp-icobox sp-icobox--sm"><FileText /></div>
          <div style={{ minWidth: 0 }}>
            <h2 className="sp-title-sec">Sin plantillas de {p.etiqueta}</h2>
            <p className="sp-hint" style={{ marginTop: 2 }}>
              Guarda este formulario como plantilla y la próxima vez lo llenas de un toque.
            </p>
          </div>
        </div>
      ) : (
        <>
          <h2 className="sp-label" style={{ display: 'block', marginBottom: 'var(--sp-gap-label)' }}>
            Plantilla
          </h2>
          {p.errorCarga ? (
            <p className="sp-banner sp-banner--warn">
              <span style={{ flex: 1 }}>No se pudieron cargar tus plantillas.</span>
              <button type="button" onClick={p.onReintentar} className="sp-btn sp-btn--ghost">
                Reintentar
              </button>
            </p>
          ) : p.cargando ? (
            <div className="sp-tpl-skeleton" aria-hidden="true" />
          ) : (
            <div className="sp-tpl-row">
              {/* Nativo a propósito: en el iPad abre la rueda del sistema, que
                  se maneja con el pulgar. La lista desplegada la dibuja el SO. */}
              <select
                aria-label="Plantilla"
                value={p.seleccion}
                onChange={e => p.onSeleccionar(e.target.value)}
                className="sp-input"
              >
                {/* Arriba del todo y dentro del desplegable, no como botón: es
                    la misma decisión —con qué contenido arranco— con una
                    respuesta más, y abrir y elegir no se hace por accidente.
                    Apagada con el formulario ya vacío: sería una operación sin
                    efecto, y la posición de las demás opciones no se mueve. */}
                <option value={OPCION_VACIAR} disabled={p.vacio}>Vaciar formulario</option>
                <option value="">— Sin plantilla —</option>
                {p.lista.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
              <button
                type="button"
                onClick={e => p.onGestionar(e.currentTarget)}
                className="sp-btn sp-btn--compact sp-tpl-manage"
              >
                <Settings2 />
                <span className="sp-doc-long">Gestionar</span>
                <span className="sp-doc-short">Gestionar plantillas</span>
              </button>
            </div>
          )}
          {!p.errorCarga && !p.cargando && n > 0 && (
            <p
              className="sp-hint"
              style={{ marginTop: 'var(--sp-1)', color: n >= TOPE_PLANTILLAS ? 'var(--sp-warn)' : undefined }}
            >
              {n >= TOPE_PLANTILLAS
                ? `${TOPE_PLANTILLAS} de ${TOPE_PLANTILLAS} · el máximo`
                : `${n} de ${TOPE_PLANTILLAS} guardadas`}
            </p>
          )}
        </>
      )}

      {p.aviso && (
        <p className="sp-banner sp-banner--info sp-tpl-aviso" aria-live="polite">
          <span>
            {p.aviso.nombre === null
              ? 'Se vació el formulario. Los datos del paciente no cambiaron.'
              : `Se aplicó «${p.aviso.nombre}». Se reemplazaron los campos del formulario; los datos del paciente no cambiaron.`}
          </span>
          <button type="button" onClick={p.onDeshacer} className="sp-btn sp-btn--ghost sp-tpl-deshacer">
            Deshacer
          </button>
        </p>
      )}
    </section>
  )
}

// ── Diálogo de nombre (§2.1) ────────────────────────────────────────────────

interface PropsGuardar {
  open: boolean
  lista: PlantillaDocumento[]
  onCerrar: () => void
  onGuardar: (nombre: string) => Promise<PlantillaDocumento>
  onTope: () => void
}

function DialogoGuardar(p: PropsGuardar) {
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorRed, setErrorRed] = useState('')

  useEffect(() => {
    if (p.open) { setNombre(''); setErrorRed('') }
  }, [p.open])

  const limpio = recortarNombre(nombre)
  // En cliente y mientras se escribe: las plantillas ya están cargadas para
  // pintar el select, así que avisar antes de guardar es más barato que después.
  const duplicado = colisionDeNombre(p.lista, nombre) !== null

  async function confirmar(): Promise<void> {
    if (!limpio || duplicado || guardando) return
    setGuardando(true)
    setErrorRed('')
    try {
      await p.onGuardar(limpio)
      p.onCerrar()
    } catch (err) {
      if (esErrorDeTope(err)) { p.onTope(); return }
      setErrorRed(esErrorDeNombreDuplicado(err)
        ? 'Ya tienes una plantilla con ese nombre. Usa otro, o sobrescríbela desde Gestionar.'
        : 'No se pudo guardar la plantilla. Revisa tu conexión e inténtalo de nuevo.')
      console.error('[plantillas] guardar falló:', err)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <ModalShell
      open={p.open}
      onClose={p.onCerrar}
      spinusGeometry="wait"
      title="Guardar como plantilla"
      subtitle="Se guarda todo menos los datos del paciente."
      footer={
        <div className="flex items-center gap-2 p-4 md:px-6">
          <button onClick={p.onCerrar} disabled={guardando} className="sp-btn sp-btn--ghost">Cancelar</button>
          <div className="flex-1" />
          <button
            onClick={() => void confirmar()}
            disabled={!limpio || duplicado || guardando}
            className="sp-btn sp-btn--primary"
          >
            {guardando ? <><span className="sp-spinner" /> Guardando…</> : 'Guardar'}
          </button>
        </div>
      }
    >
      <div className="p-4 md:p-6 flex flex-col gap-[var(--sp-gap-label)]">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="plantilla-nombre" className="sp-label-field">Nombre</label>
          {nombre.length >= 30 && <span className="sp-hint">{nombre.length}/{MAX_NOMBRE}</span>}
        </div>
        <input
          id="plantilla-nombre"
          type="text"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void confirmar() }}
          maxLength={MAX_NOMBRE}
          autoFocus
          placeholder="Prequirúrgico"
          aria-invalid={duplicado || undefined}
          className="sp-input"
          style={duplicado ? { borderColor: 'var(--sp-warn)', borderWidth: 'var(--sp-bw-accent)' } : undefined}
        />
        {duplicado && (
          <p className="sp-banner sp-banner--warn">
            Ya tienes una plantilla con ese nombre. Usa otro, o sobrescríbela desde Gestionar.
          </p>
        )}
        {errorRed && <p className="sp-banner sp-banner--danger">{errorRed}</p>}
      </div>
    </ModalShell>
  )
}

// ── Panel de gestión (§3) ───────────────────────────────────────────────────

type Confirmacion = { accion: 'sobrescribir' | 'eliminar'; plantilla: PlantillaDocumento }

interface PropsPanel {
  etiqueta: string
  lista: PlantillaDocumento[]
  cargando: boolean
  errorCarga: boolean
  vacio: boolean
  leer: () => ContenidoPlantilla
  onRecargar: () => Promise<void>
  onVolver: () => void
}

function PanelPlantillas(p: PropsPanel) {
  const [ocupada, setOcupada] = useState<string | null>(null)
  const [editando, setEditando] = useState<{ id: string; valor: string } | null>(null)
  const [confirmar, setConfirmar] = useState<Confirmacion | null>(null)
  const [errorOp, setErrorOp] = useState<{ texto: string; reintentar: () => void } | null>(null)
  const volverRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { volverRef.current?.focus({ preventScroll: true }) }, [])

  // El Escape del panel es de documento: el foco puede estar en cualquier fila.
  // Los ModalShell de confirmación se lo quedan antes por su propio listener,
  // así que aquí se ignora mientras haya uno abierto.
  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if (e.key === 'Escape' && !confirmar && !editando) p.onVolver()
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  })

  /** Una operación de fila: apaga la fila, y si falla NO recarga la lista. */
  async function operar(
    plantilla: PlantillaDocumento,
    verbo: 'renombrar' | 'sobrescribir' | 'eliminar',
    tarea: () => Promise<void>,
  ): Promise<void> {
    setOcupada(plantilla.id)
    setErrorOp(null)
    try {
      await tarea()
      await p.onRecargar()
    } catch (err) {
      setErrorOp({
        texto: `No se pudo ${verbo} «${plantilla.nombre}».`,
        reintentar: () => void operar(plantilla, verbo, tarea),
      })
      console.error(`[plantillas] ${verbo} falló:`, err)
    } finally {
      setOcupada(null)
    }
  }

  function guardarNombre(plantilla: PlantillaDocumento, valor: string): void {
    const limpio = recortarNombre(valor)
    if (!limpio || colisionDeNombre(p.lista, limpio, plantilla.id)) return
    setEditando(null)
    if (limpio === plantilla.nombre) return
    void operar(plantilla, 'renombrar', async () => { await renombrarPlantilla(plantilla.id, limpio) })
  }

  function ejecutarConfirmada(c: Confirmacion): void {
    setConfirmar(null)
    if (c.accion === 'eliminar') {
      void operar(c.plantilla, 'eliminar', async () => { await eliminarPlantilla(c.plantilla.id) })
      return
    }
    void operar(c.plantilla, 'sobrescribir', async () => {
      await sobrescribirPlantilla(c.plantilla.id, p.leer())
    })
  }

  const n = p.lista.length

  return (
    <div className="sp-push-forward">
      <header className="sp-tpl-panelhead">
        <button
          ref={volverRef}
          type="button"
          onClick={p.onVolver}
          aria-label="Volver al formulario"
          className="sp-tpl-back"
        >
          <ArrowLeft />
        </button>
        <h2 className="sp-title-card">Plantillas de {p.etiqueta}</h2>
        {!p.cargando && (
          <span className={`sp-badge${n >= TOPE_PLANTILLAS ? ' sp-badge--warn' : ''}`}>
            {n} / {TOPE_PLANTILLAS}
          </span>
        )}
      </header>

      {errorOp && (
        <p className="sp-banner sp-banner--danger" style={{ marginBottom: 'var(--sp-2-5)' }}>
          <span style={{ flex: 1 }}>{errorOp.texto}</span>
          <button type="button" onClick={errorOp.reintentar} className="sp-btn sp-btn--ghost">
            Reintentar
          </button>
        </p>
      )}

      {/* Global y no por fila: con diez filas apagadas, diez tooltips dicen lo
          mismo diez veces. */}
      {p.vacio && n > 0 && !p.cargando && (
        <p className="sp-banner sp-banner--info" style={{ marginBottom: 'var(--sp-2-5)' }}>
          El formulario está vacío: no hay nada con lo que sobrescribir.
        </p>
      )}

      {p.cargando ? (
        <div className="sp-tpl-list" aria-hidden="true">
          <div className="sp-tpl-ghost" /><div className="sp-tpl-ghost" /><div className="sp-tpl-ghost" />
        </div>
      ) : p.errorCarga ? (
        <p className="sp-banner sp-banner--warn">
          <span style={{ flex: 1 }}>No se pudieron cargar tus plantillas.</span>
          <button type="button" onClick={() => void p.onRecargar()} className="sp-btn sp-btn--ghost">
            Reintentar
          </button>
        </p>
      ) : n === 0 ? (
        <div className="sp-tpl-panelempty">
          <div className="sp-icobox sp-icobox--lg"><FileText /></div>
          <div>
            <h3 className="sp-title-sec">Todavía no tienes plantillas de {p.etiqueta}</h3>
            <p className="sp-hint" style={{ marginTop: 'var(--sp-1)' }}>
              Llena el formulario y usa «Guardar como plantilla», junto al botón de imprimir.
            </p>
          </div>
          <button type="button" onClick={p.onVolver} className="sp-btn sp-btn--secondary">
            Volver al formulario
          </button>
        </div>
      ) : (
        <ul className="sp-tpl-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {p.lista.map(t => (
            <li key={t.id}>
              <FilaPlantilla
                plantilla={t}
                ocupada={ocupada === t.id}
                sobrescribirApagado={p.vacio}
                editando={editando?.id === t.id ? editando.valor : null}
                duplicado={editando?.id === t.id && colisionDeNombre(p.lista, editando.valor, t.id) !== null}
                onEditar={valor => setEditando({ id: t.id, valor })}
                onCancelarEdicion={() => setEditando(null)}
                onGuardarNombre={valor => guardarNombre(t, valor)}
                onSobrescribir={() => setConfirmar({ accion: 'sobrescribir', plantilla: t })}
                onEliminar={() => setConfirmar({ accion: 'eliminar', plantilla: t })}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Las dos NOMBRAN la plantilla: sobrescribir la equivocada no se nota
          hasta la próxima vez que la usas. */}
      <ModalShell
        open={confirmar !== null}
        onClose={() => setConfirmar(null)}
        spinusGeometry="decide"
        title={confirmar
          ? `${confirmar.accion === 'eliminar' ? '¿Eliminar' : '¿Sobrescribir'} «${truncar(confirmar.plantilla.nombre)}»?`
          : ''}
        footer={
          <div className="flex items-center gap-2 p-4 md:px-6">
            <button onClick={() => setConfirmar(null)} className="sp-btn sp-btn--ghost">Cancelar</button>
            <div className="flex-1" />
            <button
              onClick={() => confirmar && ejecutarConfirmada(confirmar)}
              className="sp-btn sp-btn--primary"
            >
              {confirmar?.accion === 'eliminar' ? 'Eliminar' : 'Sobrescribir'}
            </button>
          </div>
        }
      >
        <div className="p-4 md:p-6">
          {confirmar?.accion === 'eliminar' ? (
            <p className="sp-body">
              Se borra esta plantilla. Los documentos ya emitidos con ella no cambian.
            </p>
          ) : (
            <p className="sp-banner sp-banner--danger">
              Se reemplaza el contenido guardado de «{confirmar ? truncar(confirmar.plantilla.nombre) : ''}» por
              lo que hay ahora en el formulario. El nombre y la fecha de creación no cambian.
              No se puede deshacer.
            </p>
          )}
        </div>
      </ModalShell>
    </div>
  )
}

// ── Fila del panel (§3.3 y §3.6) ────────────────────────────────────────────

interface PropsFila {
  plantilla: PlantillaDocumento
  ocupada: boolean
  sobrescribirApagado: boolean
  /** Valor en edición, o null si la fila está en reposo. */
  editando: string | null
  duplicado: boolean
  onEditar: (valor: string) => void
  onCancelarEdicion: () => void
  onGuardarNombre: (valor: string) => void
  onSobrescribir: () => void
  onEliminar: () => void
}

function FilaPlantilla(p: PropsFila) {
  const { plantilla: t } = p

  if (p.editando !== null) {
    const limpio = recortarNombre(p.editando)
    return (
      <div className="sp-row sp-tpl-item sp-tpl-item--editando">
        <div className="sp-tpl-rename">
          <input
            type="text"
            value={p.editando}
            onChange={e => p.onEditar(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') p.onGuardarNombre(p.editando ?? '')
              if (e.key === 'Escape') p.onCancelarEdicion()
            }}
            maxLength={MAX_NOMBRE}
            autoFocus
            aria-label={`Nuevo nombre de ${t.nombre}`}
            aria-invalid={p.duplicado || undefined}
            className="sp-input"
            style={p.duplicado ? { borderColor: 'var(--sp-warn)', borderWidth: 'var(--sp-bw-accent)' } : undefined}
          />
          <button
            type="button"
            onClick={p.onCancelarEdicion}
            aria-label="Cancelar"
            className="sp-tpl-accion"
          >
            <X />
          </button>
          <button
            type="button"
            onClick={() => p.onGuardarNombre(p.editando ?? '')}
            disabled={!limpio || p.duplicado}
            className="sp-btn sp-btn--compact"
          >
            <Check size={17} /> Guardar
          </button>
        </div>
        {p.duplicado && (
          <p className="sp-hint" style={{ color: 'var(--sp-warn)' }}>Ya tienes una con ese nombre.</p>
        )}
      </div>
    )
  }

  return (
    <div className={`sp-row sp-tpl-item${p.ocupada ? ' sp-tpl-item--ocupada' : ''}`}>
      <div className="sp-tpl-nombre">
        <span className="sp-title-sec" title={t.nombre}>{t.nombre}</span>
        <span className="sp-hint" style={{ display: 'block' }}>{fechaDe(t.updated_at)}</span>
      </div>
      <div className="sp-tpl-acciones">
        <button
          type="button"
          onClick={() => p.onEditar(t.nombre)}
          aria-label={`Renombrar ${t.nombre}`}
          className="sp-tpl-accion"
        >
          {p.ocupada ? <span className="sp-spinner" /> : <Pencil />}
          <span className="sp-tpl-accion__label">Renombrar</span>
        </button>
        <button
          type="button"
          onClick={p.onSobrescribir}
          disabled={p.sobrescribirApagado}
          aria-label={`Sobrescribir ${t.nombre} con el formulario actual`}
          className="sp-tpl-accion"
        >
          <RefreshCw />
          <span className="sp-tpl-accion__label">Sobrescribir</span>
        </button>
        <button
          type="button"
          onClick={p.onEliminar}
          aria-label={`Eliminar ${t.nombre}`}
          className="sp-tpl-accion sp-tpl-accion--danger"
        >
          <Trash2 />
          <span className="sp-tpl-accion__label">Eliminar</span>
        </button>
      </div>
    </div>
  )
}

/** Sin hora y sin año cuando es de este año. Locale es-MX vía date-fns. */
function fechaDe(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const patron = d.getFullYear() === new Date().getFullYear()
    ? "'Actualizada el' d 'de' MMMM"
    : "'Actualizada el' d 'de' MMMM 'de' yyyy"
  return format(d, patron, { locale: es })
}

/** El título del diálogo no crece con el nombre. */
function truncar(nombre: string): string {
  return nombre.length > MAX_NOMBRE ? `${nombre.slice(0, MAX_NOMBRE)}…` : nombre
}
