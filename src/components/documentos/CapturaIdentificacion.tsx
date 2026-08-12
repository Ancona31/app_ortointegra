'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Cropper, { type Area, type Point } from 'react-easy-crop'
import { Camera, Images } from 'lucide-react'
import {
  ANCHO_MINIMO_NITIDO,
  PROPORCION,
  cargarImagen,
  prepararFoto,
} from '@/lib/documentos/identificacionFoto'

/**
 * Foto de identificación de un firmante — GUIA_FORMULARIOS_05 §6, con la
 * actualización de captura nativa (2026-08-12, anotada en la guía).
 *
 * Llega DESPUÉS de confirmar la firma, nunca antes, y solo a quien firmó:
 * quien no firmó no está, así que no hay identificación que capturar.
 *
 * ── CAPTURA NATIVA, NO getUserMedia. NO VUELVAS A getUserMedia ──────────────
 * La primera versión de esta pantalla montaba un visor con `getUserMedia`,
 * marco guía en vivo y selector de cámaras. En iPad y Android `getUserMedia`
 * rechazaba con `NotAllowedError` SIN llegar a enseñar el diálogo de permiso,
 * a través de cinco intentos de corrección de la política de permisos. La
 * sustituyó esto, auditado y verificado en dispositivo (paso 0):
 *
 *   · «Tomar foto» — campo de archivo con `capture="environment"`: abre la
 *     aplicación de cámara del SISTEMA, que no pasa por `getUserMedia` ni por
 *     `Permissions-Policy` — el permiso lo administra el sistema operativo a
 *     su propia app de cámara, no el navegador a esta página. Verificado: no
 *     deja copia en la galería del dispositivo (iOS y Android probados).
 *   · «Elegir archivo» — el mismo campo SIN `capture`: selector de fotos.
 *     Son dos entradas y no una porque `capture` fuerza la cámara y suprime la
 *     galería del selector nativo, y la guía declara que subir desde galería
 *     es aceptable (§6.3): la foto es cotejo, no prueba de presencia.
 *   · El recorte vive DESPUÉS, sobre la imagen quieta, con la proporción de la
 *     caja del anexo. Lo que se sube es SOLO lo de dentro del rectángulo: la
 *     mesa y los dedos no salen del dispositivo.
 *
 * Consecuencia aceptada y anotada en la guía: la cámara en vivo de ESCRITORIO
 * se pierde —`capture` se ignora ahí y los dos botones abren el selector—. Una
 * cámara web apuntando a la mesa nunca fue buen instrumento para una
 * credencial.
 *
 * ── ⚠ LA FOTO NO BLOQUEA EN NINGUNA DE SUS RAMAS ────────────────────────────
 * Ni si la rechaza, ni si cancela la cámara del sistema, ni si el archivo no se
 * puede leer, ni si la subida falla. TODAS desembocan en `onListo` —con ruta o
 * con `null`, que es «sin foto» y es una respuesta válida—. Si añades una rama
 * nueva, tiene que terminar en `onListo`: una que se quede quieta deja el
 * firmado parado con el dispositivo en manos del paciente.
 *
 * ── EL ORDEN, QUE LO IMPONE LA MIGRACIÓN ────────────────────────────────────
 * La foto se sube AQUÍ y la fila de la firma se inserta después, al sellar: la
 * fila es inmutable y lleva la ruta dentro, así que insertarla primero y fallar
 * la subida dejaría una ruta muerta imposible de corregir. Está escrito en
 * `20260813_firmas_documento.sql`, junto a
 * `firmas_documento_identificacion_check`.
 */

type Fase = 'pregunta' | 'recortar' | 'subiendo'

interface Props {
  /** El borrador al que cuelga la foto. La ruta sale `{documentoId}/{rol}.jpg`. */
  documentoId: string
  /** `paciente` · `familiar` · `testigo_1` · `testigo_2`. El médico no entra. */
  rol: string
  /**
   * La ruta dentro del bucket, o `null` si se sigue sin foto. La recoge el modo
   * de firmado y viaja hasta `firmas_documento.identificacion_path`.
   */
  onListo: (path: string | null) => void
}

export default function CapturaIdentificacion({ documentoId, rol, onListo }: Props) {
  const [fase, setFase] = useState<Fase>('pregunta')
  const [aviso, setAviso] = useState('')
  /** La imagen elegida, ya decodificada, con su object-URL para el recortador. */
  const [fuente, setFuente] = useState<{ url: string; img: HTMLImageElement } | null>(null)

  // El estado del recortador. `areaPixels` es el rectángulo EN PÍXELES DE LA
  // FUENTE que react-easy-crop entrega en onCropComplete: exactamente el
  // `Recorte` que `prepararFoto` acepta, con otros nombres de campo.
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [areaPixels, setAreaPixels] = useState<Area | null>(null)

  const inputCamaraRef = useRef<HTMLInputElement>(null)
  const inputArchivoRef = useRef<HTMLInputElement>(null)
  /**
   * Espejo del object-URL para la limpieza de desmontaje, que corre UNA vez y
   * no ve el estado. Sin revocarlo, cada foto descartada queda retenida
   * mientras el modo de firmado siga abierto.
   */
  const urlRef = useRef<string | null>(null)

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
  }, [])

  /** Suelta la imagen actual y revoca su URL. */
  const soltarFuente = useCallback((): void => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
    setFuente(null)
    setAreaPixels(null)
  }, [])

  /**
   * El archivo elegido —da igual por cuál de las dos entradas— pasa al
   * recortador. Si el navegador no lo sabe decodificar, aviso y se sigue en la
   * pregunta: no bloquea.
   */
  async function elegir(archivo: File | undefined): Promise<void> {
    if (!archivo) return
    setAviso('')
    try {
      const img = await cargarImagen(archivo)
      soltarFuente()
      // `cargarImagen` revoca su URL interna; para el recortador hace falta una
      // viva mientras dure la fase, así que se crea otra sobre el mismo archivo.
      const url = URL.createObjectURL(archivo)
      urlRef.current = url
      setFuente({ url, img })
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setFase('recortar')
    } catch {
      setAviso('No se pudo leer esa imagen. Elige otro archivo o sigue sin foto.')
    }
  }

  /** Recorta a lo que encierra el rectángulo, reduce y sube. Si falla, sin foto. */
  async function confirmar(): Promise<void> {
    if (!fuente || !areaPixels) return
    setFase('subiendo')
    try {
      const blob = await prepararFoto(fuente.img, {
        x: areaPixels.x,
        y: areaPixels.y,
        ancho: areaPixels.width,
        alto: areaPixels.height,
      })
      if (!blob) throw new Error('SIN_BLOB')

      const cuerpo = new FormData()
      cuerpo.append('foto', blob, `${rol}.jpg`)
      cuerpo.append('rol', rol)
      const res = await fetch(`/api/documentos/${documentoId}/identificacion`, {
        method: 'POST', body: cuerpo,
      })
      if (!res.ok) throw new Error(`POST ${res.status}`)
      const { path } = (await res.json()) as { path?: string }
      onListo(path ?? null)
    } catch (err) {
      console.error('[CapturaIdentificacion] confirmar falló:', err)
      onListo(null)
    }
  }

  /**
   * §6 punto 3 · el recorte corto se avisa EN PANTALLA, no se descubre en el
   * papel. `prepararFoto` no escala hacia arriba —correcto: inventar píxeles no
   * mejora una credencial— así que un recorte por debajo del mínimo sale tal
   * cual y se imprime menos nítido. Es aviso y no bloqueo, como todo aquí.
   */
  const corto = areaPixels !== null && areaPixels.width < ANCHO_MINIMO_NITIDO

  return (
    <div className="sp-idfoto">
      {aviso && <p className="sp-banner sp-banner--warn">{aviso}</p>}

      {/* Las dos entradas al mismo campo. Ocultas: los botones visibles de abajo
          las disparan. El `value` se vacía tras leerlo para que repetir con el
          MISMO archivo vuelva a disparar el `change`. */}
      <input ref={inputCamaraRef} type="file" accept="image/jpeg,image/png"
        capture="environment" hidden
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; void elegir(f) }} />
      <input ref={inputArchivoRef} type="file" accept="image/jpeg,image/png" hidden
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; void elegir(f) }} />

      {fase === 'pregunta' && (
        <div className="sp-card sp-idfoto-card">
          <span className="sp-icobox"><Camera aria-hidden="true" /></span>
          <div className="sp-idfoto-card-txt">
            <p className="sp-body">
              Firma capturada. ¿Se anexa una foto de la identificación?
            </p>
            <div className="sp-idfoto-controles">
              {/* `Sin foto` es una RESPUESTA, no una cancelación: por eso es un
                  botón del mismo peso y no una X. */}
              <button type="button" className="sp-btn sp-btn--secondary"
                onClick={() => onListo(null)}>
                Sin foto
              </button>
              <button type="button" className="sp-btn sp-btn--primary"
                onClick={() => inputCamaraRef.current?.click()}>
                <Camera size={18} aria-hidden="true" /> Tomar foto
              </button>
              <button type="button" className="sp-btn sp-btn--ghost"
                onClick={() => inputArchivoRef.current?.click()}>
                <Images size={18} aria-hidden="true" /> Elegir archivo
              </button>
            </div>
          </div>
        </div>
      )}

      {(fase === 'recortar' || fase === 'subiendo') && fuente && (
        <>
          {/* El recortador. La proporción es la de la caja del anexo y es FIJA:
              lo que encierra el rectángulo es lo que se imprime, sin más
              recortes después. Arrastrar mueve, pellizco o rueda acercan. */}
          <div className="sp-idfoto-cropper">
            <Cropper
              image={fuente.url}
              crop={crop}
              zoom={zoom}
              aspect={PROPORCION}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_area, pixeles) => setAreaPixels(pixeles)}
            />
          </div>
          <p className="sp-hint sp-idfoto-pie">
            Ajusta la identificación al rectángulo. Solo se guarda lo de dentro.
          </p>

          {corto && (
            <p className="sp-banner sp-banner--warn">
              El recorte queda por debajo de la resolución recomendada para imprimirse
              nítido. Acerca menos la imagen, o toma la foto desde más cerca.
            </p>
          )}

          <div className="sp-idfoto-controles">
            <button type="button" className="sp-btn sp-btn--secondary"
              disabled={fase === 'subiendo'}
              onClick={() => { soltarFuente(); setAviso(''); setFase('pregunta') }}>
              Volver
            </button>
            <button type="button" className="sp-btn sp-btn--primary" style={{ flex: 1 }}
              disabled={fase === 'subiendo' || areaPixels === null}
              onClick={() => void confirmar()}>
              {fase === 'subiendo'
                ? <><span className="sp-spinner" /> Guardando…</>
                : 'Usar esta foto'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
