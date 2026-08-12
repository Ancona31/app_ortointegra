'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Images, Upload } from 'lucide-react'
import { cargarImagen, prepararFoto, recorteDelMarco } from '@/lib/documentos/identificacionFoto'

/**
 * Foto de identificación de un firmante — GUIA_FORMULARIOS_05 §6.
 *
 * Llega DESPUÉS de confirmar la firma, nunca antes: preguntar por la
 * identificación de quien aún no ha firmado es preguntar dos veces. Y se le
 * pregunta solo a quien firmó — quien no firmó no está, así que no hay
 * identificación que capturar.
 *
 * ── ⚠ LA FOTO NO BLOQUEA EN NINGUNA DE SUS RAMAS ────────────────────────────
 * Ni si la rechaza, ni si el permiso de cámara se deniega, ni si el archivo no
 * se puede leer, ni si la subida falla. TODAS desembocan en `onListo(null)`, que
 * es «sin foto» y es una respuesta válida del flujo. Es cotejo, no prueba de
 * presencia: la prueba de presencia es la firma que se acaba de capturar.
 *
 * Si añades una rama nueva, tiene que terminar en `onListo`. Una que se quede
 * quieta deja el firmado parado con el dispositivo en manos del paciente.
 *
 * ── EL ORDEN, QUE LO IMPONE LA MIGRACIÓN ────────────────────────────────────
 * La foto se sube AQUÍ, y la fila de la firma se inserta después, al sellar. No
 * es casual: la fila es inmutable y lleva la ruta dentro, así que insertarla
 * primero y fallar la subida dejaría una ruta muerta que ya no se puede
 * corregir. Está escrito en `20260813_firmas_documento.sql`, junto a
 * `firmas_documento_identificacion_check`.
 */

/** Dónde se eligió la foto, para que «Repetir» vuelva al mismo sitio. */
type Origen = 'camara' | 'archivo'

/* ============================================================================
 * ⚠ ANDAMIO DE DEPURACIÓN — SE QUITA ENTERO CUANDO LA CÁMARA MÓVIL FUNCIONE
 * ============================================================================
 *
 * Esto NO es una función del producto: es un panel que enseña en la propia
 * pantalla lo que en un iPad no hay forma de leer de otra manera. iPadOS no
 * tiene consola en el dispositivo —el Web Inspector de Safari exige un Mac, y el
 * emparejamiento inicial va por cable—, y en Android `chrome://inspect` también
 * sale de un ordenador. Sin esto, un `console.error` en el dispositivo donde
 * ocurre el fallo es un mensaje que nadie puede leer.
 *
 * Se quita en un solo tirón: esta constante, `recogerDiagnostico`, los dos
 * estados `diagnostico`/`copiado`, sus tres asignaciones y el `<details>` del
 * final del render. Nada más depende de ello.
 *
 * ── LO QUE RECOGE, Y POR QUÉ CADA COSA ──────────────────────────────────────
 * · `excepcion` — el nombre es el dato que decide. `NotAllowedError` y
 *   `SecurityError` se ven igual desde la interfaz y tienen causas distintas.
 * · `Permissions-Policy` — LA CABECERA TAL COMO LLEGA A ESTE DISPOSITIVO Y EN
 *   ESTA URL, pedida con un HEAD a la propia página. Es lo único que zanja si lo
 *   que se sirve en el despliegue es lo mismo que se sirve en local: si el móvil
 *   entra por otra dirección, o si algo por delante añade su propia política,
 *   aquí se ve. Medirlo en local no lo demuestra.
 * · `origen` y `ruta` — para ver si el móvil está entrando por una dirección que
 *   la regla de `next.config.ts` no cubre.
 * · `seguro` — `getUserMedia` no existe fuera de contexto seguro.
 * · el estado del vídeo — solo sirve si la cámara llegó a abrirse.
 * ========================================================================== */

/** Una línea del panel. Se compone a mano para que se lea en una pantalla de móvil. */
function linea(clave: string, valor: string): string {
  return `${clave.padEnd(14)}${valor}`
}

async function recogerDiagnostico(err: Error | null, video: HTMLVideoElement | null): Promise<string> {
  const lineas: string[] = []
  if (err) lineas.push(linea('excepcion', `${err.name}: ${err.message}`))
  lineas.push(linea('origen', window.location.origin))
  lineas.push(linea('ruta', window.location.pathname))
  lineas.push(linea('seguro', String(window.isSecureContext)))
  lineas.push(linea('mediaDevices', navigator.mediaDevices === undefined ? 'no' : 'sí'))

  // El HEAD va a la propia página, no a una ruta cualquiera: lo que interesa es
  // la política que rige ESTE documento.
  try {
    const res = await fetch(window.location.href, { method: 'HEAD', cache: 'no-store' })
    lineas.push(linea('policy', res.headers.get('permissions-policy') ?? '(ninguna)'))
  } catch (e) {
    lineas.push(linea('policy', `(no se pudo leer: ${e instanceof Error ? e.message : String(e)})`))
  }

  if (video) {
    lineas.push(linea('video', `readyState=${video.readyState} paused=${video.paused} `
      + `${video.videoWidth}x${video.videoHeight} playsinline=${video.hasAttribute('playsinline')}`))
  }
  lineas.push(linea('ua', navigator.userAgent))
  return lineas.join('\n')
}

/**
 * Qué decirle al médico cuando la cámara no arranca.
 *
 * ── ⚠ POR QUÉ `NotAllowedError` NO SE PUEDE PARTIR EN DOS ───────────────────
 * Ese nombre cubre DOS cosas muy distintas, y la excepción no las distingue:
 *
 *   · El usuario rechazó el permiso — se le preguntó y dijo que no. Se arregla
 *     volviéndolo a conceder desde los ajustes del navegador.
 *   · La POLÍTICA DE PERMISOS del documento no incluye la cámara — el navegador
 *     deniega SIN PREGUNTAR. No hay ningún permiso que conceder: se arregla en
 *     la cabecera `Permissions-Policy` de `next.config.ts`, y hasta que alguien
 *     la toque, el médico puede intentarlo mil veces sin que cambie nada.
 *
 * Blink mete «permissions policy» en el texto del mensaje y WebKit devuelve una
 * frase genérica, así que mirar la cadena solo funcionaría en la mitad de los
 * dispositivos —y esta pantalla se usa sobre todo en iPad—. No se adivina: se
 * nombran los dos casos y se da al médico el ÚNICO dato que sí los separa desde
 * fuera, que es si llegó a salir el diálogo de permiso.
 *
 * El nombre exacto va a la consola, no aquí: aquí estorba.
 */
function mensajeDeCamara(err: Error): string {
  switch (err.name) {
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'Este dispositivo no tiene cámara. Elige la foto desde un archivo o sigue sin ella.'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'La cámara está ocupada por otra aplicación. Ciérrala e inténtalo, '
        + 'o elige la foto desde un archivo.'
    case 'OverconstrainedError':
      return 'Esa cámara ya no está disponible. Elige otra, usa un archivo o sigue sin foto.'
    case 'NotAllowedError':
    case 'SecurityError':
      return 'El navegador no autorizó la cámara. Si NO te pidió permiso, no hay nada que '
        + 'conceder: la aplicación no la tiene habilitada en esta pantalla y hay que avisar a '
        + 'soporte. Si sí te lo pidió y lo rechazaste, concédelo en los ajustes del navegador. '
        + 'Mientras tanto, elige la foto desde un archivo o sigue sin ella.'
    default:
      return 'No se pudo abrir la cámara. Elige la foto desde un archivo o sigue sin ella.'
  }
}

type Fase = 'pregunta' | 'camara' | 'revisar' | 'archivo' | 'subiendo'

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
  const [origen, setOrigen] = useState<Origen>('camara')
  const [previa, setPrevia] = useState<{ url: string; blob: Blob } | null>(null)
  const [camaras, setCamaras] = useState<MediaDeviceInfo[]>([])
  const [camaraId, setCamaraId] = useState<string>('')
  const [aviso, setAviso] = useState('')
  /** Ver `ANDAMIO DE DEPURACIÓN`. Vacío mientras no falle nada. */
  const [diagnostico, setDiagnostico] = useState('')
  const [copiado, setCopiado] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const flujoRef = useRef<MediaStream | null>(null)
  const archivoRef = useRef<HTMLInputElement>(null)
  /** El visor y el marco: de sus rectángulos REALES sale el recorte. Ver `disparar`. */
  const visorRef = useRef<HTMLDivElement>(null)
  const marcoRef = useRef<HTMLSpanElement>(null)
  /**
   * Espejo del object-URL de la previa. Vive en un ref y no solo en el estado
   * porque quien lo revoca al desmontar es una limpieza que corre UNA vez: con
   * `previa` en las dependencias, cada repetición revocaría la imagen recién
   * creada y apagaría la cámara que se acaba de encender.
   */
  const urlRef = useRef<string | null>(null)

  /**
   * En escritorio se ofrecen las dos: cámara si hay, y subir archivo. En móvil y
   * tablet, cámara. `pointer: fine` es el discriminante: un ratón o un lápiz de
   * precisión, no un dedo.
   *
   * Los dos se resuelven en un efecto y no durante el render: `navigator` y
   * `matchMedia` no existen en el servidor, y leerlos al componer daría un
   * primer render distinto del de la hidratación.
   */
  const [escritorio, setEscritorio] = useState(false)
  const [hayCamara, setHayCamara] = useState(false)
  useEffect(() => {
    setEscritorio(window.matchMedia('(pointer: fine)').matches)
    // `mediaDevices` no existe fuera de un contexto seguro: en https y en
    // localhost está, y abriendo el servidor de desarrollo por IP de red local
    // —que es como se prueba en el iPad— NO. Por eso el aviso de `abrirCamara`
    // nombra las dos salidas en vez de culpar al permiso.
    setHayCamara(navigator.mediaDevices?.getUserMedia !== undefined)
  }, [])

  /** Apaga la cámara. Un `<video>` sin pistas vivas es una luz encendida de más. */
  const apagar = useCallback((): void => {
    flujoRef.current?.getTracks().forEach(t => t.stop())
    flujoRef.current = null
  }, [])

  /** Sustituye la previa revocando la anterior: un ráster retenido por repetición. */
  const ponerPrevia = useCallback((blob: Blob | null): void => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    if (!blob) { urlRef.current = null; setPrevia(null); return }
    const url = URL.createObjectURL(blob)
    urlRef.current = url
    setPrevia({ url, blob })
  }, [])

  // Limpieza de desmontaje, y SOLO de desmontaje: las dos dependencias son
  // estables. Salir del firmado con la cámara encendida deja una luz viva.
  useEffect(() => () => {
    apagar()
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
  }, [apagar])

  /**
   * ⚠ EL FLUJO SE ENGANCHA AQUÍ, NO EN `abrirCamara`. El `<video>` solo está en
   * el árbol cuando la fase ya es `camara`, así que asignar `srcObject` dentro
   * de la función que pide el permiso lo asignaría sobre un ref todavía nulo y
   * el visor se quedaría en negro sin ningún error.
   */
  useEffect(() => {
    if (fase !== 'camara') return
    const video = videoRef.current
    if (!video || !flujoRef.current) return
    video.srcObject = flujoRef.current
    // ⚠ `autoPlay` NO BASTA, Y `play()` NO SOBRA. Asignar `srcObject` DESPUÉS del
    // montaje no siempre vuelve a evaluar el arranque automático: en escritorio
    // suele arrancar igual, y en iOS y Android el elemento se queda pausado, con
    // el visor negro y `videoWidth` en 0. Es un fallo sin excepción, así que sin
    // esta llamada —y sin su registro— no deja ningún rastro.
    void video.play().catch((err: unknown) => {
      const fallo = err instanceof Error ? err : new Error(String(err))
      console.error('[CapturaIdentificacion] play() falló:', fallo.name, '·', fallo.message)
      void recogerDiagnostico(fallo, video).then(setDiagnostico)
    })
  }, [fase])

  /**
   * Enciende la cámara. Los permisos se piden AQUÍ, con el contexto delante, no
   * al abrir el flujo de firmado. Denegado o sin cámara: cae al selector de
   * archivo con el mismo marco de recorte, que es la otra rama de §6.3.
   */
  async function abrirCamara(id?: string): Promise<void> {
    setAviso('')
    apagar()
    let flujo: MediaStream
    try {
      // ⚠ SOLO LO NEGOCIABLE. `facingMode` e `ideal` los ajusta el dispositivo si
      // no puede darlos; lo único exacto es el `deviceId`, y solo cuando el
      // médico ha elegido una cámara concreta de la lista. Pedir una resolución
      // o una cámara EXACTAS hace que la petición se rechace entera en vez de
      // negociar, y entonces la cámara no arranca en el dispositivo que no las
      // tenga.
      const video: MediaTrackConstraints = id
        ? { deviceId: { exact: id } }
        // `environment` y no `user`: se fotografía un documento sobre la mesa,
        // no una cara. En un portátil con una sola cámara se ignora solo.
        : { facingMode: 'environment' }
      video.width = { ideal: 1920 }
      flujo = await navigator.mediaDevices.getUserMedia({ video })
    } catch (err) {
      // ⚠ LA EXCEPCIÓN SE LIGA Y SE REGISTRA. NO LA VUELVAS A DESCARTAR.
      // Este `catch` estuvo sin ligar, y por eso la denegación por política de
      // permisos —que fallaba idéntico en iPad y en Android— no dejaba ni un
      // rastro con el que diagnosticarla: solo se veía el texto de la interfaz,
      // que además mandaba a conceder un permiso que nadie iba a pedir. El
      // nombre es el dato fiable; el mensaje cambia según la máquina.
      const fallo = err instanceof Error ? err : new Error(String(err))
      console.error('[CapturaIdentificacion] getUserMedia falló:', fallo.name, '·', fallo.message)
      // Andamio: en el iPad la consola de arriba no la lee nadie.
      void recogerDiagnostico(fallo, null).then(setDiagnostico)
      setAviso(mensajeDeCamara(fallo))
      setFase('archivo')
      setOrigen('archivo')
      return
    }

    flujoRef.current = flujo
    // Cambiar de cámara no cambia de fase, así que el efecto de arriba no se
    // vuelve a disparar: aquí el `<video>` ya está montado y se engancha solo.
    if (videoRef.current) videoRef.current.srcObject = flujo
    setFase('camara')
    setOrigen('camara')
    setCamaraId(id ?? '')

    // ⚠ FUERA DEL `try` DE ARRIBA, Y A PROPÓSITO. La lista de cámaras es un lujo
    // —sirve para elegir entre la del portátil y una de documentos—, no una
    // condición para firmar. Compartiendo el `catch` con `getUserMedia`, un
    // fallo aquí apagaba una cámara YA ABIERTA y enseñaba el mensaje de error.
    //
    // Y va DESPUÉS de `getUserMedia` porque enumerar antes del permiso devuelve
    // una lista sin etiquetas ni identificadores útiles —en iOS, sobre todo—, y
    // un selector construido con eso no sirve para elegir nada.
    try {
      const todos = await navigator.mediaDevices.enumerateDevices()
      setCamaras(todos.filter(d => d.kind === 'videoinput'))
    } catch (err) {
      console.error('[CapturaIdentificacion] enumerateDevices falló:', err)
    }
  }

  /**
   * El disparador: guarda LO QUE EL MARCO ENCIERRA, no el fotograma entero.
   *
   * Los dos rectángulos se miden aquí, en el momento del disparo, y no se
   * deducen del CSS: el visor cambia de proporción con el alto de la ventana
   * —`max-height: 60vh` gana a su `aspect-ratio`— y el marco depende del ancho
   * del contenedor. Medirlos al disparar es lo que hace que girar el dispositivo
   * entre abrir la cámara y apretar el botón no descuadre nada.
   */
  async function disparar(): Promise<void> {
    const video = videoRef.current
    if (!video) return
    const caja = visorRef.current?.getBoundingClientRect()
    const marco = marcoRef.current?.getBoundingClientRect()
    const recorte = caja && marco
      ? recorteDelMarco(video.videoWidth, video.videoHeight, caja, marco)
      : undefined
    const blob = await prepararFoto(video, recorte)
    if (!blob) {
      setAviso('La cámara todavía no entrega imagen. Inténtalo otra vez.')
      // Sin excepción no hay más rastro que este: es la forma de fallo que no
      // deja error, solo un visor negro.
      void recogerDiagnostico(null, video).then(setDiagnostico)
      return
    }
    apagar()
    ponerPrevia(blob)
    setFase('revisar')
  }

  /** El archivo elegido, recortado con el mismo marco que el visor. */
  async function elegirArchivo(archivo: File | undefined): Promise<void> {
    if (!archivo) return
    setAviso('')
    try {
      const blob = await prepararFoto(await cargarImagen(archivo))
      if (!blob) throw new Error('SIN_BLOB')
      ponerPrevia(blob)
      setOrigen('archivo')
      setFase('revisar')
    } catch {
      setAviso('No se pudo leer esa imagen. Elige otro archivo o sigue sin foto.')
    }
  }

  /** Sube la foto. Si falla, se sigue SIN foto: no bloquea. */
  async function subir(): Promise<void> {
    if (!previa) return
    setFase('subiendo')
    try {
      const cuerpo = new FormData()
      cuerpo.append('foto', previa.blob, `${rol}.jpg`)
      cuerpo.append('rol', rol)
      const res = await fetch(`/api/documentos/${documentoId}/identificacion`, {
        method: 'POST', body: cuerpo,
      })
      if (!res.ok) throw new Error(`POST ${res.status}`)
      const { path } = (await res.json()) as { path?: string }
      onListo(path ?? null)
    } catch (err) {
      console.error('[CapturaIdentificacion] subir falló:', err)
      setAviso('No se pudo guardar la foto. El firmado sigue sin ella.')
      onListo(null)
    }
  }

  return (
    <div className="sp-idfoto">
      {aviso && <p className="sp-banner sp-banner--warn">{aviso}</p>}

      {fase === 'pregunta' && (
        <Pregunta
          escritorio={escritorio}
          hayCamara={hayCamara}
          onCamara={() => void abrirCamara()}
          onArchivo={() => { setFase('archivo'); setOrigen('archivo') }}
          onSinFoto={() => onListo(null)}
        />
      )}

      {fase === 'camara' && (
        <>
          <div ref={visorRef} className="sp-idfoto-visor">
            <video ref={videoRef} autoPlay playsInline muted className="sp-idfoto-video" />
            {/* ⚠ ESTE MARCO GOBIERNA EL RECORTE, no es un adorno: su rectángulo
                real se mide al disparar y de ahí sale lo que se guarda. Lo fue
                —solo dibujo— y la foto salía con el fotograma entero. Si le
                cambias el tamaño o la posición, cambia lo capturado. */}
            <span ref={marcoRef} className="sp-idfoto-marco" aria-hidden="true">
              <i /><i /><i /><i />
            </span>
          </div>
          <p className="sp-hint sp-idfoto-pie">
            Encuadra la identificación dentro del marco · 228 × 144
          </p>

          {/* Con la del portátil y una de documentos conectadas, poder elegir. */}
          {camaras.length > 1 && (
            <select className="sp-input" value={camaraId}
              onChange={e => void abrirCamara(e.target.value)}
              aria-label="Elegir cámara">
              <option value="">Cámara predeterminada</option>
              {camaras.map((c, i) => (
                <option key={c.deviceId} value={c.deviceId}>
                  {c.label || `Cámara ${i + 1}`}
                </option>
              ))}
            </select>
          )}

          <div className="sp-idfoto-controles">
            <button type="button" className="sp-btn sp-btn--ghost"
              onClick={() => { apagar(); onListo(null) }}>Cancelar</button>
            <button type="button" className="sp-idfoto-disparador"
              onClick={() => void disparar()} aria-label="Tomar la foto" />
            <button type="button" className="sp-btn sp-btn--ghost"
              onClick={() => { apagar(); setFase('archivo'); setOrigen('archivo') }}>
              Galería
            </button>
          </div>
        </>
      )}

      {fase === 'archivo' && (
        <div className="sp-idfoto-zona">
          <span className="sp-idfoto-recorte" aria-hidden="true" />
          <p className="sp-body">
            Arrastra la foto de la identificación o elige un archivo. Se recorta a la
            proporción del anexo del PDF.
          </p>
          {/* El `value` se vacía tras leerlo: sin eso, repetir y volver a elegir
              EL MISMO archivo no dispara ningún `change` y el botón se queda
              mudo, que desde fuera se lee como que la aplicación se colgó. */}
          <input ref={archivoRef} type="file" accept="image/jpeg,image/png" hidden
            onChange={e => {
              const archivo = e.target.files?.[0]
              e.target.value = ''
              void elegirArchivo(archivo)
            }} />
          <div className="sp-idfoto-controles">
            <button type="button" className="sp-btn sp-btn--primary"
              onClick={() => archivoRef.current?.click()}>Elegir archivo</button>
            <button type="button" className="sp-btn sp-btn--ghost"
              onClick={() => onListo(null)}>Sin foto</button>
          </div>
        </div>
      )}

      {(fase === 'revisar' || fase === 'subiendo') && previa && (
        <>
          <div className="sp-idfoto-previa">
            {/* eslint-disable-next-line @next/next/no-img-element -- ráster local
                de un object-URL: no hay nada que optimizar ni ninguna URL remota. */}
            <img src={previa.url} alt="Identificación capturada" />
          </div>
          <div className="sp-idfoto-controles">
            <button type="button" className="sp-btn sp-btn--secondary"
              disabled={fase === 'subiendo'}
              onClick={() => {
                ponerPrevia(null)
                if (origen === 'camara') void abrirCamara(camaraId || undefined)
                else setFase('archivo')
              }}>
              Repetir
            </button>
            <button type="button" className="sp-btn sp-btn--primary" style={{ flex: 1 }}
              disabled={fase === 'subiendo'} onClick={() => void subir()}>
              {fase === 'subiendo'
                ? <><span className="sp-spinner" /> Guardando…</>
                : 'Usar esta foto'}
            </button>
          </div>
        </>
      )}

      {/* ⚠ ANDAMIO DE DEPURACIÓN — se quita entero, ver la nota de arriba.
          Plegado por defecto: el paciente puede tener el dispositivo delante y
          esto no es para él. Solo aparece cuando algo ha fallado. */}
      {diagnostico !== '' && (
        <details className="sp-idfoto-diag">
          <summary>Detalle técnico del fallo</summary>
          <pre>{diagnostico}</pre>
          <button type="button" className="sp-btn sp-btn--compact"
            onClick={() => {
              void navigator.clipboard?.writeText(diagnostico)
                .then(() => setCopiado(true))
                .catch(() => setCopiado(false))
            }}>
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
        </details>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  §6.1 · la pregunta                                                 */
/* ------------------------------------------------------------------ */

interface PreguntaProps {
  escritorio: boolean
  hayCamara: boolean
  onCamara: () => void
  onArchivo: () => void
  onSinFoto: () => void
}

/** `Sin foto` es una RESPUESTA, no una cancelación: por eso es un secundario y no una X. */
function Pregunta({ escritorio, hayCamara, onCamara, onArchivo, onSinFoto }: PreguntaProps) {
  return (
    <div className="sp-card sp-idfoto-card">
      <span className="sp-icobox"><Camera aria-hidden="true" /></span>
      <div className="sp-idfoto-card-txt">
        <p className="sp-body">
          Firma capturada. ¿Se anexa una foto de la identificación?
        </p>
        <div className="sp-idfoto-controles">
          <button type="button" className="sp-btn sp-btn--secondary" onClick={onSinFoto}>
            Sin foto
          </button>
          {hayCamara && (
            <button type="button" className="sp-btn sp-btn--primary" onClick={onCamara}>
              <Camera size={18} aria-hidden="true" /> Tomar foto
            </button>
          )}
          {/* En escritorio las dos: la cámara puede ser la del portátil, que
              enfoca la cara y no la mesa. Sin cámara, esta es la única. */}
          {(escritorio || !hayCamara) && (
            <button type="button"
              className={`sp-btn ${hayCamara ? 'sp-btn--ghost' : 'sp-btn--primary'}`}
              onClick={onArchivo}>
              {hayCamara ? <Images size={18} aria-hidden="true" /> : <Upload size={18} aria-hidden="true" />}
              {' '}Subir foto
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
