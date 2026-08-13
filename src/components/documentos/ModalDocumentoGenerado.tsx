'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Eye, Loader2, Mail, MessageCircle } from 'lucide-react'
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
  /**
   * Falso cuando el paciente no tiene correo en su ficha. El botón se apaga y lo
   * dice: apagarlo sin explicación deja al médico buscando qué le falta.
   *
   * Opcional porque hay puntos de montaje que no conocen la ficha; sin él se
   * intenta el envío y es el servidor quien responde que no hay correo.
   */
  pacienteTieneCorreo?: boolean
}

type EstadoEnvio = 'listo' | 'enviando' | 'enviado' | 'error'

export default function ModalDocumentoGenerado({
  open,
  onClose,
  blob,
  titulo,
  guardadoEnExpediente,
  documentoId = null,
  pacienteTieneCorreo,
}: Props) {
  const [envio, setEnvio] = useState<EstadoEnvio>('listo')
  const [errorEnvio, setErrorEnvio] = useState('')
  const [enviadoA, setEnviadoA] = useState('')

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
    setEnvio('listo')
    setErrorEnvio('')
    setEnviadoA('')
  }

  /**
   * ⚠️ AL SERVIDOR SOLO VIAJA EL ID. Ni el blob que este modal tiene en memoria,
   * ni el correo del paciente. El PDF que se adjunta es el que quedó GUARDADO al
   * emitir —el mismo que el paciente tiene en papel y que `/r/[folio]`
   * respalda— y el destinatario sale de la ficha. Subir el blob desde aquí
   * parecería un atajo y abriría la puerta a que se mande un archivo distinto
   * del emitido.
   */
  async function enviarPorCorreo(): Promise<void> {
    if (documentoId === null || envio === 'enviando' || envio === 'enviado') return
    setEnvio('enviando')
    setErrorEnvio('')
    try {
      const res = await fetch('/api/email/enviar-documento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentoId }),
      })
      const data: { error?: string; enviadoA?: string } = await res.json()
      if (!res.ok) {
        setErrorEnvio(data.error ?? 'No se pudo enviar el documento.')
        setEnvio('error')
        return
      }
      setEnviadoA(data.enviadoA ?? '')
      setEnvio('enviado')
    } catch {
      setErrorEnvio('No se pudo conectar. Revisa tu conexión e intenta de nuevo.')
      setEnvio('error')
    }
  }
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

  /* Las dos razones por las que el correo no puede salir, en el orden en que
     importan: sin fila no hay nada que enviar; con fila pero sin correo en la
     ficha, hay documento y no hay a quién. */
  const motivoSinCorreo = documentoId === null
    ? 'No quedó en el expediente'
    : pacienteTieneCorreo === false ? 'Sin correo en la ficha' : null
  const puedeEnviarCorreo = motivoSinCorreo === null

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

      {/* WhatsApp sigue diferido; el correo ya envía. Ambos mandan el ARCHIVO —
          por eso el mensaje y el adjunto viven en `lib/documentos/`, fuera de la
          ruta de correo: cuando WhatsApp entre, reusa los dos y no los copia.

          A OPACIDAD PLENA, igual que el botón de Google en /login: lo
          deshabilitado se comunica con el estado del control, el relleno y el
          cursor — nunca apagando el texto, porque entonces el médico no puede
          leer QUÉ es lo que todavía no puede usar.
          justifyContent en línea y no `justify-between`: globals.css importa
          tailwindcss ANTES que spinus-tokens.css, así que el
          `justify-content:center` de .sp-btn le gana a la utilidad. */}
      <div className="sp-grid-actions mt-2 pt-3 border-t border-[var(--sp-line-divider)]">
        <button
          type="button"
          onClick={() => void enviarPorCorreo()}
          disabled={!puedeEnviarCorreo || envio === 'enviando' || envio === 'enviado'}
          aria-disabled={!puedeEnviarCorreo || undefined}
          className={`sp-btn sp-btn--tertiary${puedeEnviarCorreo ? '' : ' cursor-not-allowed'}`}
          style={{ flexDirection: 'column', gap: '7px' }}
        >
          <span className="inline-flex items-center gap-2">
            {envio === 'enviando'
              ? <Loader2 size={17} className="animate-spin" />
              : envio === 'enviado' ? <Check size={17} /> : <Mail size={17} />}
            {envio === 'enviando' ? 'Enviando…' : envio === 'enviado' ? 'Enviado' : 'Enviar por correo'}
          </span>
          {/* El motivo, siempre a la vista: un botón apagado sin explicación deja
              al médico buscando qué le falta. */}
          {motivoSinCorreo !== null && (
            <span className="sp-badge sp-badge--deferred">{motivoSinCorreo}</span>
          )}
        </button>

        <button
          type="button"
          disabled
          aria-disabled="true"
          className="sp-btn sp-btn--tertiary cursor-not-allowed"
          style={{ flexDirection: 'column', gap: '7px' }}
        >
          <span className="inline-flex items-center gap-2">
            <MessageCircle size={17} /> WhatsApp
          </span>
          <span className="sp-badge sp-badge--deferred">Próximamente</span>
        </button>
      </div>

      {errorEnvio !== '' && (
        <p className="sp-banner sp-banner--danger" role="alert">
          <AlertTriangle size={17} />
          <span>{errorEnvio}</span>
        </p>
      )}

      {envio === 'enviado' && (
        <p className="sp-body text-center" style={{ fontSize: '12px' }} aria-live="polite">
          Enviado{enviadoA !== '' ? ` a ${enviadoA}` : ''} con el PDF adjunto. Si no aparece, pídele
          que revise su carpeta de <strong>spam o correo no deseado</strong>.
        </p>
      )}

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
