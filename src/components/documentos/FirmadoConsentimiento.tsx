'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, Minus, X } from 'lucide-react'
import ModalShell from '@/components/ui/ModalShell'
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
  )
}

/* ------------------------------------------------------------------ */
/*  El lienzo                                                          */
/* ------------------------------------------------------------------ */

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
  const ultimo = useRef<{ x: number; y: number } | null>(null)

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

  useEffect(() => { preparar() }, [preparar])

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
   * ⚠ El área SOLO se rehace mientras esté VACÍA. Con tinta dentro, girar no
   * rehace nada: se conserva el mapa de bits y su proporción. Es consecuencia
   * directa de guardar imagen y no puntos —sin los puntos no hay nada que
   * volver a dibujar en una caja de otra proporción—, así que rehacer con tinta
   * dentro solo podría deformar la firma o perderla.
   */
  useEffect(() => {
    if (hayTinta) return
    const alRedimensionar = () => preparar()
    window.addEventListener('resize', alRedimensionar)
    window.addEventListener('orientationchange', alRedimensionar)
    return () => {
      window.removeEventListener('resize', alRedimensionar)
      window.removeEventListener('orientationchange', alRedimensionar)
    }
  }, [hayTinta, preparar])

  /** Coordenadas del puntero multiplicadas por `1024 ÷ ancho_css` (§5.5.2). */
  function posicion(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const c = lienzoRef.current
    if (!c) return { x: 0, y: 0 }
    const caja = c.getBoundingClientRect()
    return {
      x: (e.clientX - caja.left) * (c.width / caja.width),
      y: (e.clientY - caja.top) * (c.height / caja.height),
    }
  }

  function iniciar(e: React.PointerEvent<HTMLCanvasElement>): void {
    if (apagado) return
    const ctx = lienzoRef.current?.getContext('2d')
    if (!ctx) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = posicion(e)
    dibujando.current = true
    ultimo.current = p
    // Un toque sin arrastre también deja tinta: sin esto, un punto sobre la i
    // no se dibujaría.
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    if (!hayTinta) onTinta()
  }

  function seguir(e: React.PointerEvent<HTMLCanvasElement>): void {
    if (!dibujando.current || !ultimo.current) return
    const ctx = lienzoRef.current?.getContext('2d')
    if (!ctx) return
    const p = posicion(e)
    const medio = { x: (ultimo.current.x + p.x) / 2, y: (ultimo.current.y + p.y) / 2 }
    ctx.quadraticCurveTo(ultimo.current.x, ultimo.current.y, medio.x, medio.y)
    ctx.stroke()
    ultimo.current = p
  }

  function terminar(): void {
    dibujando.current = false
    ultimo.current = null
  }

  return (
    <div className="sp-firma-lienzo-wrap">
      {avisoGirar && (
        <p className="sp-hint sp-firma-girar">
          Gira el dispositivo para tener más espacio. Puedes firmar así igualmente.
        </p>
      )}
      <div className="sp-firma-lienzo" style={apagado ? { opacity: 0.45 } : undefined}>
        <canvas ref={lienzoRef} className="sp-firma-canvas"
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
