'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, Check, Download, Eye, Loader2, Mail, Share2 } from 'lucide-react'
import ModalShell from '@/components/ui/ModalShell'

/**
 * Modal posterior a la generación de un documento — igual en los 8 formatos.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 * Antes, `generarPdf` abría el PDF él mismo al terminar (Fase 6 de
 * mobileShare.ts). Esa apertura ocurría después de varios segundos de trabajo
 * asíncrono — fetch del logo, imports dinámicos, render, subida a Storage — así
 * que para cuando llegaba, la activación transitoria del gesto que la había
 * originado ya se había consumido y Safari la bloqueaba: en escritorio con
 * aviso de ventana bloqueada, en iOS y en la PWA en SILENCIO. El médico veía
 * solo el toast de guardado y tenía que ir a buscar el documento a la lista.
 * Chrome no aplica esa restricción, por eso ahí sí funcionaba.
 *
 * La apertura automática no se parcheó: se eliminó. Los formularios llaman a
 * `generarPdf({ entregar: false })` y montan este modal. El médico pulsa
 * "Visualizar" cuando el trabajo YA terminó, así que el gesto está intacto y no
 * hay nada que ningún navegador pueda bloquear. De paso deja de abrirse una
 * ventana que nadie pidió, que es frágil en todos los navegadores aunque hoy
 * funcione en Chrome.
 *
 * ── POR QUÉ "Visualizar" ES UN <a href> Y NO UN onClick ─────────────────────
 * Mismo criterio que el botón de descarga de ModalDocumentos: entre el toque y
 * la navegación no puede quedar NINGUNA asincronía. El object URL se resuelve
 * en el efecto de abajo, al abrirse el modal; cuando el médico pulsa, el href
 * ya está puesto. Un onClick que creara la URL en el handler también serviría
 * hoy, pero invita a que un cambio futuro meta un await en medio y reintroduzca
 * exactamente el bug que este modal viene a cerrar.
 *
 * Sin botón de imprimir a propósito: el visor de PDF ya lo trae en las cuatro
 * plataformas y duplicarlo obligaría a mantener una segunda ruta de impresión.
 */

interface Props {
  open: boolean
  onClose: () => void
  /** PDF ya generado, en memoria. */
  blob: Blob | null
  /**
   * La frase ENTERA del encabezado, participio incluido: "Receta generada",
   * "Recibo generado". No es el sustantivo suelto.
   *
   * El modal no añade nada, y no es por gusto: los nueve documentos no comparten
   * género —receta, solicitud, carta y denegación son femeninos; consentimiento,
   * escrito, plan y recibo, masculinos— así que cualquier participio compuesto
   * aquí saldría mal concordado en la mitad de ellos. Quien emite decide su
   * propia frase; este componente solo la imprime.
   */
  titulo: string
  /**
   * Falso cuando el documento NO quedó en el expediente: falló la subida a
   * Storage o falló el insert. Visualizar sigue funcionando — el PDF está en
   * memoria y poder imprimirlo es lo urgente con el paciente enfrente — pero el
   * modal tiene que decirlo.
   */
  guardadoEnExpediente: boolean
  /**
   * La fila del documento recién emitido. Sin ella no se puede enviar: es lo
   * único que la ruta de correo necesita —resuelve destinatario, adjunto y texto
   * a partir del id— y es también lo que garantiza que se manda el PDF GUARDADO
   * y no el blob que este modal tiene en memoria.
   *
   * Llega `null` cuando la fila no se escribió (fallo de persistencia) o cuando
   * el formato no inserta ninguna. Entonces el botón se queda apagado con su
   * motivo a la vista, porque no hay nada que enviar.
   */
  documentoId?: string | null
}

/**
 * Los pasos del envío. El destinatario NO llega por props: lo pregunta el modal
 * al servidor con el id del documento, así que ningún formulario tiene que
 * conocer la ficha del paciente para que esto funcione.
 *
 *   consultando → el estado de PARTIDA: el GET que dice qué hay en la ficha, que
 *                 sale en cuanto el modal se abre
 *   listo       → resuelto y con correo en la ficha: se ve cuál y el botón manda
 *                 en un solo toque
 *   pidiendo    → no hay correo en la ficha —y entonces se entra aquí solo, al
 *                 abrir—, o el médico eligió otro: se teclea aquí mismo
 *   confirmando → la dirección tecleada, grande, para leerla letra por letra
 *   enviando / enviado / error
 */
type Paso = 'consultando' | 'listo' | 'pidiendo' | 'confirmando' | 'enviando' | 'enviado' | 'error'

export default function ModalDocumentoGenerado({
  open,
  onClose,
  blob,
  titulo,
  guardadoEnExpediente,
  documentoId = null,
}: Props) {
  const [paso, setPaso] = useState<Paso>('listo')
  const [correoFicha, setCorreoFicha] = useState<string | null>(null)
  const [pacienteId, setPacienteId] = useState<string | null>(null)
  const [escrito, setEscrito] = useState('')
  const [errorEnvio, setErrorEnvio] = useState('')
  const [enviadoA, setEnviadoA] = useState('')
  /* Solo se ofrece guardar cuando la ficha estaba VACÍA. Ver `guardarEnFicha`. */
  const [ofrecerGuardar, setOfrecerGuardar] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [avisoGuardado, setAvisoGuardado] = useState('')

  /* Cada apertura empieza limpia: el modal se reutiliza entre documentos y un
     «Enviado» heredado del anterior haría creer que este ya salió.

     El reajuste va EN EL RENDER y no en un efecto —patrón «adjusting state when
     props change» de React—: un efecto que llame a setState dispara un render en
     cascada, y el lint del proyecto lo rechaza. Así el primer render tras abrir
     ya sale con el estado limpio, sin un frame intermedio que enseñe el acuse
     del documento anterior. */
  const [aperturaVista, setAperturaVista] = useState(open)
  if (open !== aperturaVista) {
    setAperturaVista(open)
    /* Arranca CONSULTANDO cuando hay fila que enviar: el efecto de abajo sale a
       preguntar el destinatario en cuanto se abre. Se fija aquí y no en el
       efecto para que éste no llame a `setState` de forma síncrona en su cuerpo
       —el lint del proyecto lo rechaza (`react-hooks/set-state-in-effect`)— y
       para que el primer render ya salga con el estado que le toca. */
    setPaso(open && documentoId !== null ? 'consultando' : 'listo')
    setCorreoFicha(null)
    setPacienteId(null)
    setEscrito('')
    setErrorEnvio('')
    setEnviadoA('')
    setOfrecerGuardar(false)
    setAvisoGuardado('')
  }

  /**
   * Qué dirección propone el envío. Se pregunta al servidor con el id del
   * documento y NO se recibe por props: así ningún formulario tiene que conocer
   * la ficha del paciente, y los nueve puntos de montaje siguen pasando un dato
   * y no dos.
   *
   * ⚠️⚠️ SE LLAMA AL ABRIRSE EL MODAL, Y ESTO ESTUVO AL REVÉS. Aquí decía «al
   * pulsar Enviar por correo, NUNCA al abrirse», con dos motivos: no desplegar
   * el campo en la cara de quien solo quería mirar el PDF, y no gastar una
   * petición por documento emitido cuando el correo se manda en pocos casos.
   *
   * El primer motivo se cayó solo: resolver aquí no despliega ningún campo, solo
   * escribe una línea de texto que dice a dónde iría. Lo que sí costaba era el
   * precio de la duda — el botón decía «Enviar por correo» y no enviaba, sino
   * que preguntaba, y hacían falta DOS toques para una acción.
   *
   * El segundo es real y se paga a sabiendas: una petición por documento
   * emitido, se envíe o no. Se acota a lo que ya era: la ruta es la misma, solo
   * la lee quien acaba de emitir un documento de ESE paciente —o sea, quien ya
   * tiene su expediente abierto delante— y devuelve un correo, no la ficha.
   * Lo que se compra es que el botón haga lo que su rótulo promete.
   */
  async function resolverDestinatario(): Promise<void> {
    if (documentoId === null) return
    /* ⚠️ NI UN `setState` ANTES DEL PRIMER `await`. Esta función la arranca un
       efecto, y todo lo que corra de forma síncrona en él cuenta como cuerpo del
       efecto para `react-hooks/set-state-in-effect`. El estado de partida
       —`consultando`— lo deja puesto el reajuste de apertura de arriba. */
    try {
      const res = await fetch(
        `/api/email/enviar-documento?documentoId=${encodeURIComponent(documentoId)}`,
      )
      const datos = await res.json() as Record<string, unknown>
      if (!res.ok) {
        setErrorEnvio(typeof datos.error === 'string'
          ? datos.error
          : 'No se pudo comprobar el correo del paciente.')
        setPaso('error')
        return
      }
      const ficha = typeof datos.correoFicha === 'string' ? datos.correoFicha : null
      setCorreoFicha(ficha)
      setPacienteId(typeof datos.pacienteId === 'string' ? datos.pacienteId : null)
      /* Sin correo en la ficha se entra DIRECTO a pedirlo: es el caso común
         —la mayoría de las fichas no lo tienen— y un paso intermedio que solo
         diga «no hay correo» sobra. Con correo, se enseña cuál antes de mandar
         nada; el envío es el segundo toque. */
      setPaso(ficha === null ? 'pidiendo' : 'listo')
    } catch {
      setErrorEnvio('No se pudo comprobar el correo del paciente. Revisa tu conexión.')
      setPaso('error')
    }
  }

  /* Resolver el destinatario al abrir. `documentoId` en las dependencias y no
     solo `open`: los formularios montan este modal con la fila ya escrita, pero
     si algún día llegara después, la consulta se haría igual en cuanto llegue. */
  useEffect(() => {
    if (!open || documentoId === null) return
    void resolverDestinatario()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, documentoId])

  /**
   * ⚠️ AL SERVIDOR SOLO VIAJA EL ID. Ni el blob que este modal tiene en memoria,
   * ni el correo del paciente. El PDF que se adjunta es el que quedó GUARDADO al
   * emitir —el mismo que el paciente tiene en papel y que `/r/[folio]`
   * respalda— y el destinatario sale de la ficha. Subir el blob desde aquí
   * parecería un atajo y abriría la puerta a que se mande un archivo distinto
   * del emitido.
   */
  async function enviarPorCorreo(destino: string | null): Promise<void> {
    if (documentoId === null || paso === 'enviando') return
    setPaso('enviando')
    setErrorEnvio('')
    /* `confirmarEmailAlterno` solo cuando la dirección se tecleó aquí. Con la de
       la ficha no hay nada que confirmar: no es una dirección nueva. */
    const aMano = destino !== null
    try {
      const res = await fetch('/api/email/enviar-documento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          aMano
            ? { documentoId, pacienteEmail: destino, confirmarEmailAlterno: true }
            : { documentoId },
        ),
      })
      const data: { error?: string; enviadoA?: string } = await res.json()
      if (!res.ok) {
        setErrorEnvio(data.error ?? 'No se pudo enviar el documento.')
        setPaso('error')
        return
      }
      setEnviadoA(data.enviadoA ?? destino ?? correoFicha ?? '')
      /* ⚠️ SOLO SE PREGUNTA SI GUARDAR CUANDO LA FICHA ESTABA VACÍA.
         Si ya había correo y este envío fue a otra dirección —el familiar, el
         que dictó ese día—, ofrecer guardarla invitaría a sustituir en silencio
         una dirección buena por una puntual, y nadie lo notaría hasta que un
         envío futuro fuera a parar a quien no debe. Esa alterna es «solo para
         este envío» y así se queda. El servidor lo impide además por su cuenta. */
      setOfrecerGuardar(aMano && correoFicha === null && pacienteId !== null)
      setPaso('enviado')
    } catch {
      setErrorEnvio('No se pudo conectar. Revisa tu conexión e intenta de nuevo.')
      setPaso('error')
    }
  }

  /**
   * Guarda en la ficha el correo que se acaba de usar. El envío YA ocurrió: esto
   * es solo para la próxima vez, así que un fallo aquí se cuenta y no se
   * dramatiza — el documento salió igual.
   */
  async function guardarEnFicha(): Promise<void> {
    if (pacienteId === null || enviadoA === '' || guardando) return
    setGuardando(true)
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}/correo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: enviadoA }),
      })
      const data: { error?: string } = await res.json()
      setAvisoGuardado(res.ok ? 'Guardado en la ficha del paciente.' : (data.error ?? 'No se pudo guardar en la ficha.'))
    } catch {
      setAvisoGuardado('No se pudo guardar en la ficha.')
    } finally {
      setGuardando(false)
      setOfrecerGuardar(false)
    }
  }

  const [compartiendo, setCompartiendo] = useState(false)
  const [avisoCompartir, setAvisoCompartir] = useState('')

  /**
   * Deja constancia de que el documento salió de la app.
   *
   * A diferencia del correo —que audita el SERVIDOR dentro de su propia ruta,
   * con destinatario y folio— aquí no hay destino que registrar: lo elige el
   * usuario en la hoja del sistema y el navegador no lo cuenta. Justamente por
   * eso interesa registrar que salió.
   *
   * Va por `/api/audit`, que ya existía para esto y valida la sesión en el
   * servidor; el cliente solo puede pedir acciones de su lista cerrada.
   * Fire-and-forget: el documento ya se compartió y un fallo de registro no se
   * le cuenta al médico, que no puede hacer nada al respecto.
   */
  function auditar(accion: 'compartir_documento' | 'descargar_documento'): void {
    if (documentoId === null) return
    void fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tabla: 'documentos', registroId: documentoId, accion }),
    }).catch(() => {})
  }

  /** Nombre del archivo, para compartir y para descargar. `titulo` ya nombra el
   *  documento; se memoriza para que el `File` de abajo no se reconstruya en
   *  cada render y la detección no cambie de respuesta sola. */
  const nombreArchivo = useMemo(() => {
    const base = titulo.trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    return `${base || 'documento'}.pdf`
  }, [titulo])

  /**
   * El PDF como `File`, listo desde que hay blob.
   *
   * ⚠️ SE CONSTRUYE EN EL RENDER Y NO EN EL HANDLER, Y ES LO QUE HACE POSIBLE LA
   * DETECCIÓN DE ABAJO. `canShare` solo dice la verdad si se le enseña el
   * archivo REAL, así que hasta que el `File` no existe no se puede saber si
   * este navegador lo aceptaría — y esa respuesta hace falta al PINTAR, para
   * elegir entre «Compartir» y «Descargar».
   *
   * No cuesta lo que parece: `new File([blob], …)` envuelve el blob, no copia
   * sus bytes.
   */
  const archivo = useMemo(
    () => (blob ? new File([blob], nombreArchivo, { type: 'application/pdf' }) : null),
    [blob, nombreArchivo],
  )

  /**
   * Si este navegador puede compartir ESTE archivo con la hoja del sistema.
   *
   * ⚠️ SE PREGUNTA CON EL ARCHIVO, Y NO BASTA CON QUE `share` EXISTA. Aquí se
   * miraba solo que las dos funciones estuvieran definidas, y eso deja fuera el
   * caso que más duele: navegadores donde `share` existe pero RECHAZA archivos
   * —Chrome de escritorio en varias configuraciones—. Ahí el botón decía
   * «Compartir», el médico lo pulsaba y se encontraba un aviso en vez de su
   * documento, sin ninguna vía alterna a mano. Con la pregunta hecha al pintar,
   * ese navegador enseña «Descargar» desde el principio.
   *
   * Y es EL MISMO objeto que se comparte después, no una copia equivalente: lo
   * que se probó es exactamente lo que se manda.
   *
   * Se calcula en el render y no en un efecto: un efecto que llame a `setState`
   * lo rechaza el lint del proyecto y además pintaría un fotograma con el botón
   * equivocado. Los ocho formularios montan este modal con `ssr: false`, así que
   * no hay render de servidor con el que desincronizarse; aun así el `typeof` de
   * guarda va, porque `navigator` no existe en Node y una importación futura sin
   * `ssr: false` reventaría en el render en vez de degradar.
   */
  const puedeCompartir = useMemo(
    () => archivo !== null
      && typeof navigator !== 'undefined'
      && typeof navigator.share === 'function'
      && typeof navigator.canShare === 'function'
      && navigator.canShare({ files: [archivo] }),
    [archivo],
  )

  /**
   * ⚠️ `navigator.share` ES LA PRIMERA INSTRUCCIÓN TRAS LA GUARDA, Y ESE ORDEN NO
   * ES ESTÉTICO. La llamada exige activación transitoria del gesto: cualquier
   * `await` por delante la consume y el navegador rechaza con `NotAllowedError`
   * sin que nada explique por qué. El `File` ya viene hecho del render —no hay
   * nada que construir ni que volver a pedir— y los `setState` van DESPUÉS de
   * capturar la promesa, para que ni un cambio futuro pueda colar una espera en
   * medio. La auditoría va más atrás todavía, en el `then`.
   *
   * Exige además contexto seguro: en `localhost` y en producción (https) lo
   * hay; por http plano `navigator.share` ni siquiera está definido, así que
   * ese caso ya cayó en la rama de descarga al detectar.
   *
   * Sin comprobación de `canShare` aquí: la hizo `puedeCompartir` sobre ESTE
   * mismo archivo, y si hubiera dicho que no, este botón no se habría pintado.
   */
  function compartir(): void {
    if (!archivo || compartiendo) return
    const compartido = navigator.share({ files: [archivo], title: titulo })
    setAvisoCompartir('')
    setCompartiendo(true)
    compartido
      /* ⚠️ LA AUDITORÍA VA AQUÍ Y EN NINGÚN OTRO SITIO. `share` solo resuelve
         cuando el documento se entregó de verdad a otra aplicación; registrarlo
         antes de llamar, o en el `finally`, escribiría en el `audit_log` un
         compartir que no ocurrió — y un registro que miente es peor que no
         tenerlo. */
      .then(() => auditar('compartir_documento'))
      .catch((e: unknown) => {
        /* ⚠️ CANCELAR NO ES UN FALLO. Cerrar la hoja del sistema sin elegir
           rechaza con `AbortError`, y es una decisión del médico, no un error:
           ni aviso, ni caída a descarga, ni entrada en el `audit_log`. Los demás
           motivos sí se cuentan.

           El nombre se lee de la propiedad y no con `instanceof Error`: quien
           rechaza es un `DOMException`, que en Safari antiguo NO heredaba de
           `Error` — allí `instanceof` daba falso, el nombre salía vacío y una
           cancelación se pintaba como fallo. */
        const nombre = typeof e === 'object' && e !== null && 'name' in e
          ? String((e as { name: unknown }).name)
          : ''
        if (nombre !== 'AbortError') {
          setAvisoCompartir('No se pudo compartir el documento.')
        }
      })
      .finally(() => setCompartiendo(false))
  }

  /** Suficiente para atajar el dedo torcido; la validación de verdad es el servidor. */
  const escritoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(escrito.trim())
  /**
   * useMemo y NO un efecto que haga setState: así el href existe ya en el
   * PRIMER render del modal. Con setState habría un frame con el botón inerte
   * — imperceptible, pero es justo el estado que este componente viene a
   * eliminar, y además el lint lo rechaza (cascading renders).
   *
   * Crear el object URL en el render es un efecto secundario: si React
   * descartara el memo, se filtraría una URL hasta que se cierre la pestaña.
   * Es un puñado de bytes por documento generado y no afecta a lo ya entregado
   * al médico — barato comparado con el frame inerte.
   */
  const pdfUrl = useMemo(
    () => (open && blob ? URL.createObjectURL(blob) : null),
    [open, blob],
  )

  useEffect(() => {
    if (!pdfUrl) return
    return () => {
      // 60s de gracia, mismo criterio que abrirBlobEnPestana en mobileShare.ts:
      // si el médico ya pulsó Visualizar, el visor tiene su copia interna del
      // PDF y revocar es seguro; el retraso cubre la pestaña que todavía está
      // cargando en el momento en que se cierra el modal.
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000)
    }
  }, [pdfUrl])

  const cuerpo = (
    <div className="px-4 md:px-6 pt-8 pb-6 flex flex-col items-center text-center gap-4">
      {guardadoEnExpediente ? (
        <div className="sp-medal">
          {/* Check y NO CheckCircle2 — ver la nota en nueva-nota/page.tsx:1342:
              el segundo renderiza dos paths y el arco queda partido bajo el
              stroke-dasharray con que .sp-medal__core dibuja el trazo. */}
          <div className="sp-medal__core"><Check /></div>
        </div>
      ) : (
        <div
          className="w-[70px] h-[70px] rounded-full flex items-center justify-center"
          style={{ background: 'var(--sp-warn-bg-badge)' }}
        >
          <AlertTriangle size={32} style={{ color: 'var(--sp-warn)' }} />
        </div>
      )}

      {/* Verbatim: el participio viene ya en `titulo`. Ver su prop. */}
      <h3 className="sp-title-state">{titulo}</h3>

      {/* La confirmación NO afirma "quedó en el expediente": PlanSuplementacion
          no inserta fila cuando no hay pacienteId, y ahí la frase sería falsa.
          El toast del formulario ya distingue "guardado" de "generado". Aquí la
          única afirmación sobre el expediente es la negativa, que es la que el
          médico necesita ver. */}
      {guardadoEnExpediente ? (
        <p className="sp-body max-w-xs">
          Ya puedes abrirlo para revisarlo o imprimirlo.
        </p>
      ) : (
        <div className="sp-banner sp-banner--warn w-full text-left">
          <AlertTriangle size={18} />
          <span>
            El documento está listo y puedes abrirlo e imprimirlo ahora, pero no
            se pudo guardar en el expediente: no va a aparecer en la lista de
            documentos del paciente.
          </span>
        </div>
      )}
    </div>
  )

  /* Sin fila no hay nada que enviar: el PDF existe en memoria pero no en
     Storage, y lo que se adjunta es el de Storage. */
  const sinDocumento = documentoId === null

  /**
     El bloque del destinatario. Va como función y no como componente para que
     no se recree en cada render (`react-hooks/static-components`).

     ⚠️ LA CONFIRMACIÓN DOBLE NO ES UN «¿ESTÁS SEGURO?». Enseña la dirección
     TECLEADA, grande y sola, y dice qué sale por ella. Un correo mal escrito
     manda un documento con datos clínicos a un desconocido y eso no se deshace
     —no hay «cancelar envío»—, así que el paso existe para que se lea letra por
     letra, no para añadir un clic.

     Y se exige EN LOS DOS CASOS que la dirección venga del teclado: tanto la
     alterna como la primera de un paciente sin correo en la ficha. La API solo
     la reclama para la alterna, porque sin correo registrado no hay discrepancia
     que detectar — pero el riesgo es el mismo dedo sobre el mismo teclado. */
  function panelDestinatario(): ReactNode {
    if (sinDocumento) return null

    /* La espera se cuenta en el propio botón, no aquí: repetirla en dos sitios
       parte la atención justo en el segundo en que no hay nada que decidir. */
    if (paso === 'consultando') return null

    if (paso === 'pidiendo') {
      return (
        <div className="sp-banner w-full text-left" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
          <label htmlFor="mdg-correo" className="sp-label-field">
            {correoFicha === null
              ? 'Este paciente no tiene correo en su ficha. Escríbelo aquí:'
              : 'Correo solo para este envío (la ficha no se toca):'}
          </label>
          <input
            id="mdg-correo"
            type="email"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={escrito}
            onChange={e => setEscrito(e.target.value)}
            placeholder="nombre@correo.com"
            className="sp-input"
          />
          <div className="sp-grid-actions">
            <button
              type="button"
              onClick={() => setPaso('confirmando')}
              disabled={!escritoValido}
              className="sp-btn sp-btn--primary"
            >
              Enviar por correo
            </button>
            <button
              type="button"
              onClick={() => {
                setEscrito('')
                setErrorEnvio('')
                /* Siempre a `listo`, haya correo en la ficha o no. Sin él, ese
                   estado no pinta línea de destinatario y el botón de correo
                   vuelve a abrir esta captura: cancelar devuelve al punto de
                   partida, no a un estado de fallo. */
                setPaso('listo')
              }}
              className="sp-btn sp-btn--ghost"
            >
              Cancelar
            </button>
          </div>
        </div>
      )
    }

    if (paso === 'confirmando') {
      return (
        <div className="sp-banner sp-banner--warn w-full text-left" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '10px' }}>
          <span className="sp-label-field">Va a enviar el documento a esta dirección escrita a mano:</span>
          <span
            style={{
              fontSize: '17px', fontWeight: 700, color: 'var(--sp-text-strong)',
              wordBreak: 'break-all', userSelect: 'all', lineHeight: 1.3,
            }}
          >
            {escrito.trim()}
          </span>
          <span style={{ fontSize: '12px', lineHeight: 1.5 }}>
            Compruébala letra por letra. El archivo lleva datos clínicos dentro y un correo
            enviado no se puede recuperar.
          </span>
          <div className="sp-grid-actions">
            <button
              type="button"
              onClick={() => void enviarPorCorreo(escrito.trim())}
              className="sp-btn sp-btn--primary"
            >
              Sí, enviar ahí
            </button>
            <button type="button" onClick={() => setPaso('pidiendo')} className="sp-btn sp-btn--ghost">
              Corregir
            </button>
          </div>
        </div>
      )
    }

    if (paso === 'enviado') {
      return (
        <div className="w-full space-y-2">
          <p className="sp-body text-center" style={{ fontSize: '12px' }} aria-live="polite">
            Enviado{enviadoA !== '' ? ` a ${enviadoA}` : ''} con el PDF adjunto. Si no aparece,
            pídele que revise su carpeta de <strong>spam o correo no deseado</strong>.
          </p>

          {/* El envío YA ocurrió; esto es solo para la próxima vez. Por eso se
              pregunta DESPUÉS y no antes: nada de lo que se conteste aquí
              cambia lo que acaba de salir. */}
          {ofrecerGuardar && (
            <div className="sp-banner w-full text-left" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
              <span style={{ fontSize: '13px' }}>
                ¿Guardas <strong>{enviadoA}</strong> en la ficha del paciente para la próxima vez?
              </span>
              <div className="sp-grid-actions">
                <button
                  type="button"
                  onClick={() => void guardarEnFicha()}
                  disabled={guardando}
                  className="sp-btn sp-btn--primary"
                >
                  {guardando ? <><Loader2 size={15} className="animate-spin" /> Guardando…</> : 'Guardar en la ficha'}
                </button>
                <button
                  type="button"
                  onClick={() => setOfrecerGuardar(false)}
                  className="sp-btn sp-btn--ghost"
                >
                  No, gracias
                </button>
              </div>
            </div>
          )}

          {avisoGuardado !== '' && (
            <p className="sp-hint text-center" aria-live="polite">{avisoGuardado}</p>
          )}
        </div>
      )
    }

    /* `listo`, `enviando` y `error`: la línea que dice a dónde va, con la
       escotilla para usar otra dirección sin tocar la ficha. */
    if (correoFicha === null) return null
    return (
      <div className="w-full text-left" style={{ fontSize: '12px', lineHeight: 1.5 }}>
        <span style={{ color: 'var(--sp-text-muted)' }}>Se enviará a </span>
        <strong style={{ color: 'var(--sp-text-strong)', wordBreak: 'break-all' }}>{correoFicha}</strong>
        <button
          type="button"
          onClick={() => { setEscrito(''); setErrorEnvio(''); setPaso('pidiendo') }}
          className="sp-link-alt"
          style={{ display: 'block', marginTop: '2px' }}
        >
          Usar otro correo solo para este envío
        </button>
      </div>
    )
  }

  const enFlujoDeCaptura = paso === 'pidiendo' || paso === 'confirmando'

  const pie = (
    <div className="p-4 md:px-6 space-y-2.5">
      {pdfUrl ? (
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener"
          className="sp-btn sp-btn--primary sp-btn--primary-block sp-btn--reward"
        >
          <Eye size={17} /> Visualizar
        </a>
      ) : (
        <button
          type="button"
          disabled
          className="sp-btn sp-btn--primary sp-btn--primary-block"
        >
          <Eye size={17} /> Visualizar
        </button>
      )}

      <div className="mt-2 pt-3 border-t border-[var(--sp-line-divider)] space-y-2.5">
        {panelDestinatario()}

        {/* Durante la captura y la confirmación se retira el botón de CORREO —el
            panel trae el suyo y dos rótulos iguales harían dudar de cuál manda—
            pero «Compartir» se queda: no compite con nada y, sin correo en la
            ficha, el modal abre ya con la captura desplegada, así que esconder
            la rejilla entera lo dejaría inalcanzable. */}
        {/* Las dos salidas del documento que no son «Visualizar». El correo manda
            el PDF GUARDADO —lo resuelve el servidor por id— y compartir manda el
            que este modal tiene en memoria, que es el mismo archivo.

            A OPACIDAD PLENA cuando alguno esté apagado, igual que el botón de
            Google en /login: lo deshabilitado se comunica con el estado del
            control, el relleno y el cursor — nunca apagando el texto, porque
            entonces el médico no puede leer QUÉ es lo que no puede usar. */}
        <div className="sp-grid-actions">
            {!enFlujoDeCaptura && (
            <button
              type="button"
              /* ⚠️ ENVÍA. No pregunta, no despliega: el destinatario ya está
                 resuelto y a la vista desde que se abrió el modal, así que un
                 toque en un botón que dice «Enviar por correo» tiene que
                 enviar. Aquí hubo un primer toque que solo resolvía, y eran dos
                 toques para una acción.
                 Sin correo en la ficha no se llega a pulsar esto: el modal ya
                 abrió con la captura desplegada. La rama queda por si la
                 consulta falló y no se sabe qué hay. */
              onClick={() => {
                if (correoFicha !== null) void enviarPorCorreo(null)
                else { setEscrito(''); setErrorEnvio(''); setPaso('pidiendo') }
              }}
              disabled={sinDocumento || paso === 'consultando' || paso === 'enviando' || paso === 'enviado'}
              aria-disabled={sinDocumento || undefined}
              aria-busy={paso === 'consultando' || paso === 'enviando'}
              className={`sp-btn sp-btn--tertiary${sinDocumento ? ' cursor-not-allowed' : ''}`}
              style={{ flexDirection: 'column', gap: '7px' }}
            >
              {/* La espera se cuenta EN EL BOTÓN, que es donde está mirando quien
                  acaba de pulsarlo, y con el control ya deshabilitado: entre el
                  toque y saber si hay correo hay un viaje al servidor, y sin
                  esto el modal parece no haberse enterado. */}
              <span className="inline-flex items-center gap-2">
                {paso === 'consultando' || paso === 'enviando'
                  ? <Loader2 size={17} className="animate-spin" />
                  : paso === 'enviado' ? <Check size={17} /> : <Mail size={17} />}
                {paso === 'consultando'
                  ? 'Comprobando correo…'
                  : paso === 'enviando'
                    ? 'Enviando…'
                    : paso === 'enviado' ? 'Enviado' : 'Enviar por correo'}
              </span>
              {/* El motivo, siempre a la vista: un botón apagado sin explicación
                  deja al médico buscando qué le falta. */}
              {sinDocumento && (
                <span className="sp-badge sp-badge--deferred">No quedó en el expediente</span>
              )}
            </button>
            )}

            {/* ⚠️ AQUÍ ESTUVO EL BOTÓN DE WHATSAPP CON SU «PRÓXIMAMENTE», que
                esperaba a una integración con su API. Lo sustituye la hoja de
                compartir del sistema, que en un teléfono lista WhatsApp entre
                las opciones y de paso Signal, Telegram, AirDrop o lo que el
                médico tenga — sin integrar ninguna.

                DOS BOTONES Y NO UNO CON DOS COMPORTAMIENTOS: el rótulo dice
                exactamente lo que va a pasar. Donde no hay hoja de compartir
                —Firefox de escritorio es el caso vivo— se descarga el PDF, que
                es lo que ese usuario haría después de todas formas. Esconderlo
                dejaría un hueco en la rejilla y una acción menos sin explicar.
                El `gridColumn` cubre el caso en que es el único de la fila. */}
            {puedeCompartir ? (
              <button
                type="button"
                onClick={compartir}
                disabled={!archivo || compartiendo}
                aria-busy={compartiendo}
                className="sp-btn sp-btn--tertiary"
                style={{ gridColumn: enFlujoDeCaptura ? '1 / -1' : undefined }}
              >
                {compartiendo ? <Loader2 size={17} className="animate-spin" /> : <Share2 size={17} />}
                {compartiendo ? 'Compartiendo…' : 'Compartir'}
              </button>
            ) : (
              /* ⚠️ UN ANCLA CON `download`, NO UN BOTÓN CON `onClick`: entre el
                 toque y la descarga no puede quedar ninguna asincronía, igual
                 que en «Visualizar». El `href` ya está resuelto desde el primer
                 render (ver `pdfUrl`). Y va como HERMANO del botón de correo,
                 nunca dentro de él: un ancla dentro de un `button` es marcado
                 inválido y el navegador la desanida por su cuenta. */
              <a
                href={pdfUrl ?? undefined}
                download={nombreArchivo}
                onClick={() => auditar('descargar_documento')}
                className="sp-btn sp-btn--tertiary"
                style={{ gridColumn: enFlujoDeCaptura ? '1 / -1' : undefined }}
              >
                <Download size={17} /> Descargar
              </a>
            )}
        </div>

        {avisoCompartir !== '' && (
          <p className="sp-hint text-center" aria-live="polite">{avisoCompartir}</p>
        )}

        {errorEnvio !== '' && (
          <p className="sp-banner sp-banner--danger" role="alert">
            <AlertTriangle size={17} />
            <span>{errorEnvio}</span>
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="sp-btn sp-btn--ghost"
        style={{ width: '100%' }}
      >
        Cerrar
      </button>
    </div>
  )

  return (
    // elevated → z-[60]. Los formularios se montan dentro del overlay de
    // documentos de nueva-nota, que desde el 2026-08-06 vive en z-50 (la capa
    // base de ModalShell), así que esta es exactamente la capa que documenta la
    // prop: "para apilarse sobre otro ModalShell".
    // title vacío + spinusGeometry="done" → ModalShell omite el header entero
    // (headerVacio, :107). La salida es el botón Cerrar, el backdrop y Escape.
    <ModalShell
      open={open}
      onClose={onClose}
      elevated
      spinusGeometry="done"
      title=""
      footer={pie}
    >
      {cuerpo}
    </ModalShell>
  )
}
