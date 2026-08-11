'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, Minus, X } from 'lucide-react'
import ModalShell from '@/components/ui/ModalShell'
import Portal from '@/components/ui/Portal'
import {
  ANCHO_BITMAP,
  GROSOR_TRAZO,
  altoBitmap,
  exportarTrazo,
} from '@/lib/documentos/firmaTrazo'

/**
 * Captura de firmas del consentimiento — GUIA_FORMULARIOS_05 §2 a §7.
 *
 * ── DÓNDE VIVE ──────────────────────────────────────────────────────────────
 * Un modo a PANTALLA COMPLETA dentro de la misma ruta (§2). No es ruta nueva:
 * obligaría a traspasar un formulario que puede no estar guardado. Y no es
 * modal flotante: un modal invita a cerrarse tocando fuera, y con el
 * dispositivo en manos del paciente eso es perder firmas.
 *
 * Tapar el resto de la aplicación es una FUNCIÓN, no un efecto colateral: es el
 * único momento del sistema en que el dispositivo cambia de manos, y el
 * paciente no debe poder llegar al expediente ni al listado.
 *
 * ── LO QUE ESTE COMPONENTE NO HACE ──────────────────────────────────────────
 * No escribe en la base. Reúne los cuatro desenlaces y entrega las firmas
 * capturadas a `onSellar`; el orden de las tres operaciones —firmas, sellado,
 * PDF— lo impone el formulario, que es quien conoce la fila.
 *
 * Las fotos de identificación (§6) son el paso siguiente y no existen aquí. Por
 * eso el resumen dice `Firmó` a secas y no `Firmó · sin foto`: anunciar la
 * ausencia de algo que nunca se ofreció se lee como un fallo.
 */

/** Los cuatro del flujo. El médico no entra: su rúbrica sale del perfil (§4). */
export type RolFirmante = 'paciente' | 'familiar' | 'testigo_1' | 'testigo_2'

export interface FirmaCapturada {
  rol: RolFirmante
  /** Data-URL PNG ya recortado a la tinta. */
  trazo: string
  /** ISO del sello del DISPOSITIVO: el momento real del trazo. */
  firmadoEn: string
}

/** Cómo se resolvió un paso. Omitir resuelve un paso, no lo elimina. */
type Desenlace =
  | { tipo: 'firmo'; trazo: string; firmadoEn: string }
  | { tipo: 'omitido' }
  | { tipo: 'no_pudo' }

interface Paso {
  rol: RolFirmante
  /** Bajo la línea del lienzo, en mayúsculas (§5.1). */
  etiqueta: string
  titulo: string
}

const PASOS: readonly Paso[] = [
  { rol: 'paciente', etiqueta: 'PACIENTE', titulo: 'Paciente' },
  { rol: 'familiar', etiqueta: 'FAMILIAR RESPONSABLE', titulo: 'Familiar o responsable' },
  { rol: 'testigo_1', etiqueta: 'TESTIGO 1', titulo: 'Testigo 1' },
  { rol: 'testigo_2', etiqueta: 'TESTIGO 2', titulo: 'Testigo 2' },
]

/** Índice de la pantalla de revisión: va DESPUÉS de los cuatro firmantes. */
const RESUMEN = PASOS.length

/**
 * La tinta, como literal y NO como token.
 *
 * `--sp-ink-900` vale #14345c en claro y `rgba(255,255,255,.87)` en oscuro, y
 * este mapa de bits ES el que se imprime: leer el token dejaría al médico en
 * modo oscuro con una firma blanca sobre papel blanco. Por lo mismo el lienzo
 * lleva fondo claro literal en el CSS: lo que se ve al firmar es lo que sale en
 * el papel, en los dos temas.
 */
const TINTA = '#14345c'

interface Props {
  /** Los nombres escritos en el formulario, para encabezar cada paso. */
  nombres: Record<RolFirmante, string>
  onSalir: () => void
  onSellar: (firmas: FirmaCapturada[]) => void
  sellando: boolean
  /** Mensaje del formulario cuando alguna de las tres operaciones falló. */
  errorSellado: string
}

export default function FirmadoConsentimiento({
  nombres, onSalir, onSellar, sellando, errorSellado,
}: Props) {
  const [paso, setPaso] = useState(0)
  const [desenlaces, setDesenlaces] = useState<Partial<Record<RolFirmante, Desenlace>>>({})
  const [noPuedeFirmar, setNoPuedeFirmar] = useState(false)
  const [tieneTrazo, setTieneTrazo] = useState(false)
  const [limpiarSenal, setLimpiarSenal] = useState(0)
  const [errorTrazo, setErrorTrazo] = useState('')
  const [confirmarSellado, setConfirmarSellado] = useState(false)
  const [confirmarSalida, setConfirmarSalida] = useState(false)

  const lienzoRef = useRef<HTMLCanvasElement>(null)

  const enResumen = paso === RESUMEN
  const actual = enResumen ? null : PASOS[paso]
  const hayFirmas = Object.values(desenlaces).some(d => d.tipo === 'firmo')

  // El familiar deja de ser opcional cuando el paciente no pudo firmar: sin
  // firma del paciente, la del familiar es la que sostiene el documento.
  const familiarObligatorio = desenlaces.paciente?.tipo === 'no_pudo'
  const puedeOmitir = actual !== null
    && actual.rol !== 'paciente'
    && !(actual.rol === 'familiar' && familiarObligatorio)

  /** La X y `Escape` son lo mismo: salir con firmas capturadas pide confirmación. */
  const intentarSalir = useCallback((): void => {
    if (sellando) return
    if (hayFirmas) setConfirmarSalida(true)
    else onSalir()
  }, [sellando, hayFirmas, onSalir])

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') intentarSalir() }
    window.addEventListener('keydown', alTeclear)
    // El modo tapa la pantalla entera: el scroll de detrás no debe seguir vivo.
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', alTeclear)
      document.body.style.overflow = previo
    }
  }, [intentarSalir])

  /** Guarda el desenlace y salta al siguiente paso sin resolver, o al resumen. */
  function resolver(rol: RolFirmante, desenlace: Desenlace): void {
    const siguientes = { ...desenlaces, [rol]: desenlace }
    setDesenlaces(siguientes)
    setErrorTrazo('')
    setTieneTrazo(false)
    const pendiente = PASOS.findIndex(p => siguientes[p.rol] === undefined)
    setPaso(pendiente === -1 ? RESUMEN : pendiente)
  }

  function confirmarFirma(): void {
    if (!actual) return
    if (noPuedeFirmar) { resolver(actual.rol, { tipo: 'no_pudo' }); return }
    const lienzo = lienzoRef.current
    if (!lienzo) return
    const res = exportarTrazo(lienzo)
    if (!res.ok) {
      setErrorTrazo(res.motivo === 'presupuesto'
        ? 'La firma pesa demasiado para guardarse. Bórrala y hazla con menos trazos.'
        : 'El lienzo está vacío: no hay ningún trazo que guardar.')
      return
    }
    resolver(actual.rol, { tipo: 'firmo', trazo: res.trazo, firmadoEn: new Date().toISOString() })
  }

  /** Vuelve a ese firmante SIN deshacer los demás (§7.1). */
  function rehacer(rol: RolFirmante): void {
    const { [rol]: _quitado, ...resto } = desenlaces
    void _quitado
    setDesenlaces(resto)
    if (rol === 'paciente') setNoPuedeFirmar(false)
    setTieneTrazo(false)
    setErrorTrazo('')
    setPaso(PASOS.findIndex(p => p.rol === rol))
  }

  function sellar(): void {
    setConfirmarSellado(false)
    const firmas: FirmaCapturada[] = []
    for (const p of PASOS) {
      const d = desenlaces[p.rol]
      if (d?.tipo === 'firmo') firmas.push({ rol: p.rol, trazo: d.trazo, firmadoEn: d.firmadoEn })
    }
    onSellar(firmas)
  }

  const resueltos = PASOS.filter(p => desenlaces[p.rol] !== undefined).length

  return (
    /**
     * ⚠ EL PORTAL NO SOBRA. NO LO QUITES.
     *
     * El formulario vive dentro de `.sp-doc-form`, que lleva
     * `container-type: inline-size` para sus consultas de contenedor. Eso
     * arrastra CONTENCIÓN DE DISPOSICIÓN, y un elemento con contención de
     * disposición se convierte en MARCO DE REFERENCIA de sus descendientes
     * `position: fixed`: el `inset: 0` de `.sp-firma-modo` deja de medirse
     * contra el viewport y pasa a medirse contra la caja del formulario.
     *
     * Sin el portal ocurrían las dos cosas a la vez, y son la misma:
     *
     *  · El modo NO tapaba la barra lateral. No por apilamiento —el z-index
     *    nunca llegó a competir con nada— sino porque el modo quedaba
     *    confinado a la columna del formulario, que empieza a la derecha de la
     *    barra, así que geométricamente no la alcanzaba.
     *  · El área de captura no se veía. Con el cuerpo del formulario en
     *    `display:none`, a `.sp-doc-form` no le quedaba NINGÚN hijo en flujo
     *    —el panel de plantillas es null cerrado y los modales salen por este
     *    mismo portal—, así que su altura de contenido era 0. Contra una caja
     *    de 0, `top:0; bottom:0` da un modo de 0 de alto, y `.sp-firma-cuerpo`
     *    —`flex: 1 1 0%` con `overflow-y: auto`— se quedaba en 0 y recortaba el
     *    lienzo entero. La cabecera y el progreso son `flex: 0 0 auto` y por eso
     *    seguían viéndose, desbordando.
     *
     * Colgando del `<body>`, `fixed` vuelve a resolverse contra el viewport.
     * Los tokens `--sp-*` viven en `:root`, así que no se pierde ninguno.
     */
    <Portal>
      <div className="sp-firma-modo sp-push-forward" role="dialog" aria-modal="true"
        aria-label="Firmado electrónico">

        {/* ── Cabecera (§3.1) ───────────────────────────────────────── */}
        <header className="sp-firma-head">
          <button type="button" onClick={intentarSalir} disabled={sellando}
            className="sp-firma-salir" aria-label="Salir del firmado">
            <X size={20} />
          </button>
          <h2 className="sp-title-card sp-firma-titulo">
            {enResumen ? 'Revisión antes de sellar' : 'Firmado electrónico'}
          </h2>
          <span className="sp-badge">
            <span className="sp-firma-long">
              {enResumen ? `${resueltos} de ${PASOS.length} resueltos` : `Firmante ${paso + 1} de ${PASOS.length}`}
            </span>
            <span className="sp-firma-short">
              {enResumen ? `${resueltos}/${PASOS.length}` : `${paso + 1}/${PASOS.length}`}
            </span>
          </span>
        </header>

        {/* ── Progreso (§3.2) ───────────────────────────────────────────
            CUATRO SEGMENTOS SIEMPRE, aunque se omitan firmantes: omitir resuelve
            un paso, no lo elimina. Un progreso que encoge miente sobre cuánto
            queda. */}
        <div className="sp-progress sp-firma-progress">
          <span className="sp-progress__label">FIRMANTES</span>
          <div className="sp-progress__track">
            {PASOS.map((p, i) => (
              <span key={p.rol}
                className={`sp-progress__seg ${i <= paso ? 'sp-progress__seg--done' : ''}`} />
            ))}
          </div>
        </div>

        <div className="sp-firma-cuerpo">
          {actual !== null ? (
            <>
              {/* El rol y el nombre, a la vista: el paciente coge el dispositivo
                  sin ningún contexto de lo que está pasando. */}
              <div className="sp-firma-quien">
                <p className="sp-label">Firma de</p>
                <p className="sp-firma-nombre">{nombres[actual.rol].trim() || actual.titulo}</p>
                <p className="sp-hint">{actual.titulo}</p>
              </div>

              <LienzoFirma
                key={actual.rol}
                lienzoRef={lienzoRef}
                etiqueta={actual.etiqueta}
                apagado={noPuedeFirmar}
                hayTinta={tieneTrazo}
                limpiarSenal={limpiarSenal}
                onTinta={() => { setTieneTrazo(true); setErrorTrazo('') }}
              />

              {/* §5.3 · solo existe en el paso del paciente */}
              {actual.rol === 'paciente' && (
                <>
                  <label className="sp-check">
                    <input type="checkbox" className="sr-only" checked={noPuedeFirmar}
                      onChange={e => setNoPuedeFirmar(e.target.checked)} />
                    <span className="sp-check__box"><Check aria-hidden="true" /></span>
                    <span className="sp-check__label">El paciente no puede firmar</span>
                  </label>
                  {noPuedeFirmar && (
                    <p className="sp-banner sp-banner--warn">
                      <AlertTriangle size={17} />
                      <span>
                        Se pasa al familiar responsable, y ahí la firma deja de ser opcional:
                        sin firma del paciente, la del familiar es obligatoria.
                      </span>
                    </p>
                  )}
                </>
              )}

              {errorTrazo && <p className="sp-banner sp-banner--danger">{errorTrazo}</p>}

              {/* §5.2 · borrar limpia el lienzo entero: no hay deshacer parcial de
                  trazos, que en una firma no significa nada. */}
              <div className="sp-firma-acciones">
                <button type="button" disabled={!tieneTrazo || noPuedeFirmar}
                  onClick={() => { setLimpiarSenal(n => n + 1); setTieneTrazo(false); setErrorTrazo('') }}
                  className="sp-btn sp-btn--secondary"
                  style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}>
                  Borrar y repetir
                </button>
                <button type="button" disabled={!tieneTrazo && !noPuedeFirmar}
                  onClick={confirmarFirma} className="sp-btn sp-btn--primary" style={{ flex: 1 }}>
                  {noPuedeFirmar ? 'Continuar sin firma del paciente' : 'Confirmar firma'}
                </button>
              </div>

              {/* §5.4 · nunca a la altura del primario: es una salida legítima,
                  pero no es lo que se espera. */}
              {puedeOmitir && (
                <button type="button" onClick={() => resolver(actual.rol, { tipo: 'omitido' })}
                  className="sp-btn sp-btn--ghost"
                  style={{ alignSelf: 'flex-start', whiteSpace: 'nowrap' }}>
                  Omitir este firmante
                </button>
              )}
            </>
          ) : (
            <>
              <p className="sp-hint">Revisa antes de imprimir. Puedes rehacer cualquier firma.</p>

              <div className="sp-firma-resumen">
                {PASOS.map(p => (
                  <FilaResumen key={p.rol} titulo={p.titulo} nombre={nombres[p.rol]}
                    desenlace={desenlaces[p.rol]} deshabilitado={sellando}
                    onRehacer={() => rehacer(p.rol)} />
                ))}
              </div>

              {errorSellado && <p className="sp-banner sp-banner--danger">{errorSellado}</p>}

              <button type="button" onClick={() => setConfirmarSellado(true)} disabled={sellando}
                className="sp-btn sp-btn--primary sp-btn--primary-block">
                {sellando
                  ? <><span className="sp-spinner" /> Sellando…</>
                  : 'Imprimir consentimiento'}
              </button>
            </>
          )}
        </div>

        {/* §7.2 · el punto de no retorno */}
        {/* `elevated` sube el modal a z-60: el modo entero vive en z-55 para
            taparle el paso al botón de menú del Sidebar, que es z-50. */}
        <ModalShell open={confirmarSellado} onClose={() => setConfirmarSellado(false)} elevated
          spinusGeometry="decide" title="¿Sellar y firmar el consentimiento?"
          footer={
            <div className="flex items-center gap-2 p-4 md:px-6">
              <button type="button" onClick={() => setConfirmarSellado(false)}
                className="sp-btn sp-btn--ghost">Revisar otra vez</button>
              <div className="flex-1" />
              {/* El primario dice SELLAR, que es el acto; imprimir es lo que
                  ocurre después. Un botón que dijera imprimir no comunicaría un
                  punto de no retorno. */}
              <button type="button" onClick={sellar} className="sp-btn sp-btn--primary">
                Sellar e imprimir
              </button>
            </div>
          }>
          <div className="p-4 md:p-6">
            <p className="sp-banner sp-banner--danger">
              <AlertTriangle size={17} />
              <span>
                Al sellar, el documento queda firmado, se guarda en el expediente y se registra
                su huella. Después ya no se puede editar: ni el texto, ni las firmas, ni las
                fotos. Si algo está mal, corrígelo ahora.
              </span>
            </p>
          </div>
        </ModalShell>

        <ModalShell open={confirmarSalida} onClose={() => setConfirmarSalida(false)} elevated
          spinusGeometry="decide" title="¿Salir del firmado?"
          footer={
            <div className="flex items-center gap-2 p-4 md:px-6">
              <button type="button" onClick={onSalir} className="sp-btn sp-btn--ghost">
                Salir y perder las firmas
              </button>
              <div className="flex-1" />
              <button type="button" onClick={() => setConfirmarSalida(false)}
                className="sp-btn sp-btn--primary">Seguir firmando</button>
            </div>
          }>
          <div className="p-4 md:p-6">
            <p className="sp-body">
              Ya hay firmas capturadas y todavía no se han guardado. Si sales ahora se pierden
              y habrá que volver a pedirlas.
            </p>
          </div>
        </ModalShell>
      </div>
    </Portal>
  )
}

/* ------------------------------------------------------------------ */
/*  El lienzo                                                          */
/* ------------------------------------------------------------------ */

/** Un punto YA en coordenadas del mapa de bits, nunca de pantalla. */
interface Punto { x: number; y: number }

/**
 * De coordenadas de ventana a coordenadas del mapa de bits: las del puntero
 * multiplicadas por `1024 ÷ ancho_css` (§5.5.2).
 *
 * Recibe el rectángulo en vez de leerlo: quien la llama procesa varias muestras
 * de un mismo evento y `getBoundingClientRect` fuerza recálculo de disposición
 * en cada llamada.
 */
function aBitmap(c: HTMLCanvasElement, caja: DOMRect, clientX: number, clientY: number): Punto {
  return {
    x: (clientX - caja.left) * (c.width / caja.width),
    y: (clientY - caja.top) * (c.height / caja.height),
  }
}

interface LienzoProps {
  lienzoRef: React.RefObject<HTMLCanvasElement | null>
  etiqueta: string
  /** «No puede firmar»: el lienzo se APAGA, no se borra — se ve que dejó de aplicar. */
  apagado: boolean
  /**
   * Si hay tinta. Vive ARRIBA y no aquí: el padre ya lo necesita para encender
   * sus dos botones, y duplicarlo obligaría a sincronizar los dos con un
   * `setState` dentro de un efecto —cascada de renders que el linter rechaza,
   * con razón—.
   */
  hayTinta: boolean
  limpiarSenal: number
  onTinta: () => void
}

function LienzoFirma({ lienzoRef, etiqueta, apagado, hayTinta, limpiarSenal, onTinta }: LienzoProps) {
  const [avisoGirar, setAvisoGirar] = useState(false)
  const dibujando = useRef(false)
  /**
   * Los DOS puntos que sostienen la continuidad del trazo: el último del
   * puntero y el último punto MEDIO. Ver `trazar`.
   */
  const ultimo = useRef<Punto | null>(null)
  const medio = useRef<Punto | null>(null)
  const observador = useRef<ResizeObserver | null>(null)
  /** Espejo de `hayTinta`: el observador no ve el estado de React. */
  const hayTintaRef = useRef(hayTinta)
  useEffect(() => { hayTintaRef.current = hayTinta }, [hayTinta])

  /**
   * Fija el mapa de bits a 1024 px de ancho y reajusta el contexto, que se
   * reinicia entero al asignar `width`. El lienzo se estira por CSS a su caja;
   * el mapa de bits no se entera.
   */
  const preparar = useCallback((): void => {
    const c = lienzoRef.current
    if (!c) return
    const caja = c.getBoundingClientRect()
    if (caja.width === 0) return
    c.width = ANCHO_BITMAP
    c.height = altoBitmap(caja.width, caja.height)
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.lineWidth = GROSOR_TRAZO
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = TINTA
  }, [lienzoRef])

  /**
   * ⚠ EL DIMENSIONADO VA EN UN `ref` DE FUNCIÓN Y EN UN `ResizeObserver`, NO EN
   * UN EFECTO DE MONTAJE. NO LO DEVUELVAS A UN `useEffect`.
   *
   * Un `<canvas>` sin atributos `width`/`height` nace con un mapa de bits de
   * 300×150 mientras el CSS lo estira a su caja. Si el dimensionado no llega a
   * ejecutarse —o se ejecuta cuando el elemento todavía no tiene caja, y
   * entonces no vuelve a intentarlo nunca—, el factor de escala queda en
   * 300 ÷ ancho_css y **la tinta aterriza a un tercio de donde está el dedo**.
   * Es un fallo silencioso: no hay error, solo un trazo que no sigue al cursor.
   *
   * El observador cierra esa clase entera de fallos: se dispara al empezar a
   * observar —así que prepara en cuanto el nodo TIENE caja, no cuando React
   * cree que la tiene— y otra vez cada vez que la caja cambia. De paso sustituye
   * a los oyentes de `resize` y `orientationchange`, que solo cubrían el cambio
   * de tamaño del viewport y no el del propio elemento.
   *
   * `preparar` es estable —depende solo de un objeto ref—, y eso importa: si
   * este callback cambiara en cada render, React lo llamaría con `null` y con el
   * nodo continuamente, y cada vuelta borraría el lienzo A MEDIA FIRMA.
   */
  const montarLienzo = useCallback((nodo: HTMLCanvasElement | null): void => {
    lienzoRef.current = nodo
    observador.current?.disconnect()
    observador.current = null
    if (nodo === null) return
    // Asignar `width` no cambia la caja CSS del elemento, así que preparar
    // dentro del observador no puede realimentarlo.
    const ro = new ResizeObserver(() => { if (!hayTintaRef.current) preparar() })
    ro.observe(nodo)
    observador.current = ro
  }, [lienzoRef, preparar])

  // Al limpiar: `width` se reasigna, que es la forma de vaciar un canvas sin
  // dejar rastro en el alfa —y `clearRect` bastaría, pero `preparar` ya deja el
  // contexto listo—.
  useEffect(() => {
    if (limpiarSenal === 0) return
    preparar()
  }, [limpiarSenal, preparar])

  /**
   * §5.6 · El aviso de girar NO BLOQUEA: el área está activa detrás y se puede
   * firmar igual. Un aviso que impide firmar convierte una molestia en una
   * firma perdida. En tablet no aparece nunca.
   */
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px) and (orientation: portrait)')
    const mirar = () => setAvisoGirar(mq.matches)
    mirar()
    mq.addEventListener('change', mirar)
    return () => mq.removeEventListener('change', mirar)
  }, [])

  /**
   * Un segmento, y SOLO ese segmento.
   *
   * ⚠ EL `beginPath()` NO SOBRA. Sin él, cada `stroke()` vuelve a rasterizar
   * TODO lo acumulado desde que empezó el gesto, así que el trabajo crece con el
   * cuadrado del número de puntos y la firma se frena dentro del propio trazo.
   * Lo sufre más el ratón que el dedo, porque muestrea mucho más.
   *
   * ── POR QUÉ NO SE VEN LAS UNIONES ──────────────────────────────────────────
   * Cada segmento va del punto MEDIO anterior al medio nuevo, con el punto real
   * como control de la cuadrática. Eso hace la tangente continua en las uniones:
   * al llegar al medio de `anterior`→`p` la tangente lleva la dirección
   * `anterior`→`p`, y el segmento siguiente arranca en ese mismo medio con
   * `p` de control, o sea con esa misma dirección. Sin los medios —uniendo punto
   * con punto— la tangente daría un salto en cada muestra y se verían los
   * vértices.
   */
  function trazar(ctx: CanvasRenderingContext2D, p: Punto): void {
    const anterior = ultimo.current
    const medioAnterior = medio.current
    if (!anterior || !medioAnterior) return
    const nuevoMedio = { x: (anterior.x + p.x) / 2, y: (anterior.y + p.y) / 2 }
    ctx.beginPath()
    ctx.moveTo(medioAnterior.x, medioAnterior.y)
    ctx.quadraticCurveTo(anterior.x, anterior.y, nuevoMedio.x, nuevoMedio.y)
    ctx.stroke()
    ultimo.current = p
    medio.current = nuevoMedio
  }

  function iniciar(e: React.PointerEvent<HTMLCanvasElement>): void {
    if (apagado) return
    const c = lienzoRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = aBitmap(c, c.getBoundingClientRect(), e.clientX, e.clientY)
    dibujando.current = true
    ultimo.current = p
    medio.current = p
    // Un toque sin arrastre también deja tinta: sin esto, un punto sobre la i
    // no se dibujaría.
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    if (!hayTinta) onTinta()
  }

  function seguir(e: React.PointerEvent<HTMLCanvasElement>): void {
    if (!dibujando.current) return
    const c = lienzoRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    // UNA sola lectura del rectángulo por evento, no una por muestra:
    // `getBoundingClientRect` fuerza recálculo de disposición, y abajo pueden
    // salir decenas de puntos de un mismo evento.
    const caja = c.getBoundingClientRect()
    // ⚠ LOS EVENTOS FUSIONADOS SON LA FIRMA DE VERDAD. El navegador entrega un
    // `pointermove` por cuadro, pero el digitalizador muestrea mucho más rápido
    // y guarda dentro las muestras intermedias. Leer solo el evento es tirarlas:
    // quedan rectas entre cuadro y cuadro en vez de una curva.
    const nativo = e.nativeEvent
    const fusionados = typeof nativo.getCoalescedEvents === 'function'
      ? nativo.getCoalescedEvents()
      : []
    const muestras = fusionados.length > 0 ? fusionados : [nativo]
    for (const m of muestras) trazar(ctx, aBitmap(c, caja, m.clientX, m.clientY))
  }

  function terminar(): void {
    if (dibujando.current) {
      // La cola: del último medio al último punto real. Sin esto la firma
      // termina media muestra antes de donde se levantó el dedo.
      const ctx = lienzoRef.current?.getContext('2d')
      if (ctx && ultimo.current && medio.current) {
        ctx.beginPath()
        ctx.moveTo(medio.current.x, medio.current.y)
        ctx.lineTo(ultimo.current.x, ultimo.current.y)
        ctx.stroke()
      }
    }
    dibujando.current = false
    ultimo.current = null
    medio.current = null
  }

  return (
    <div className="sp-firma-lienzo-wrap">
      {avisoGirar && (
        <p className="sp-hint sp-firma-girar">
          Gira el dispositivo para tener más espacio. Puedes firmar así igualmente.
        </p>
      )}
      <div className="sp-firma-lienzo" style={apagado ? { opacity: 0.45 } : undefined}>
        {/* ⚠ `touchAction` VA EN LÍNEA Y NO EN EL CSS, Y NO ES DESCUIDO.
            `globals.css` declara `* { touch-action: manipulation }` FUERA de
            toda `@layer`, y lo no encapado gana a cualquier regla dentro de
            `@layer components` por mucha especificidad que tenga. Ahí vivía
            `.sp-firma-canvas { touch-action: none }`, que por eso no hacía
            nada: en móvil el arrastre se lo llevaba el desplazamiento de la
            página y la firma se cortaba a la mitad. En línea gana siempre. */}
        <canvas ref={montarLienzo} className="sp-firma-canvas"
          style={{ touchAction: 'none' }}
          onPointerDown={iniciar} onPointerMove={seguir}
          onPointerUp={terminar} onPointerCancel={terminar} />
        {!hayTinta && !apagado && (
          <p className="sp-firma-placeholder">Firma aquí con el dedo</p>
        )}
        <span className="sp-firma-linea" aria-hidden="true" />
        <span className="sp-firma-rol">{etiqueta}</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Una fila del resumen                                               */
/* ------------------------------------------------------------------ */

interface FilaProps {
  titulo: string
  nombre: string
  desenlace: Desenlace | undefined
  deshabilitado: boolean
  onRehacer: () => void
}

function FilaResumen({ titulo, nombre, desenlace, deshabilitado, onRehacer }: FilaProps) {
  const firmo = desenlace?.tipo === 'firmo'
  const estado = desenlace === undefined ? 'Pendiente'
    : desenlace.tipo === 'firmo' ? 'Firmó'
    : desenlace.tipo === 'no_pudo' ? 'No pudo firmar'
    : 'Omitido'

  return (
    <div className="sp-row sp-firma-fila">
      <span className={`sp-icobox sp-icobox--sm ${firmo ? 'sp-icobox--success' : 'sp-firma-ico-vacio'}`}>
        {firmo ? <Check aria-hidden="true" /> : <Minus aria-hidden="true" />}
      </span>
      <span className="sp-firma-fila-txt">
        {/* Sin nombre capturado se muestra solo el rol (§7.1). */}
        <span className="sp-firma-fila-nombre">{nombre.trim() || titulo}</span>
        <span className="sp-hint">{estado}</span>
      </span>
      <button type="button" onClick={onRehacer} disabled={deshabilitado}
        className="sp-btn sp-btn--compact">Rehacer</button>
    </div>
  )
}
