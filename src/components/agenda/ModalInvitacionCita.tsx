'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, Check, Loader2, Mail, Send, User, X } from 'lucide-react'
import Portal from '@/components/ui/Portal'

/**
 * Invitar a alguien a una cita: al paciente, o a un tercero.
 *
 * ── LO QUE ESTE MODAL YA NO HACE, Y ES EL CAMBIO MÁS IMPORTANTE ─────────────
 * NO invita al médico. Tenía su casilla y se la quitamos: el médico asignado
 * entra SOLO, como asistente del `events.insert` que crea el evento, y sale solo
 * cuando se reasigna la cita. Si tiene la cita, tiene que tenerla en su
 * calendario — no es una elección de nadie, y ofrecerla aquí sería fingir una
 * decisión que no existe.
 *
 * Lo que queda es lo que SÍ se elige: el paciente, que puede no tener correo en
 * la ficha o querer que se avise a otra persona, y cualquier invitado externo.
 *
 * ── POR QUÉ EL BOTÓN NO VUELVE A APARECER DESPUÉS DE ENVIAR ────────────────
 * §12.4 decidió lo contrario —«dice Enviar invitación siempre y se puede pulsar
 * las veces que haga falta»— con un motivo que SIGUE SIENDO CIERTO: Google no
 * duplica al asistente, sólo reenvía el correo, y eso es justo lo que necesita
 * quien lo perdió.
 *
 * Lo que cambió es dónde se paga ese reenvío. Este modal se abre solo al crear
 * la cita, así que ahora es lo último que ve quien acaba de agendar; dejar vivo
 * un botón de enviar en esa pantalla invita a pulsarlo otra vez «por si acaso» y
 * a mandar dos correos por cita. Reenviar sigue siendo posible: se entra de
 * nuevo a la cita y se usa «Agregar invitados».
 *
 * ── LO QUE SE HEREDA DE `ModalDocumentoGenerado.tsx` Y POR QUÉ ──────────────
 * · Confirmación letra por letra cuando la dirección viene DEL TECLADO. No
 *   existe «cancelar invitación»: una vez que Google manda el correo, el título
 *   con el nombre del paciente ya está en el buzón de un desconocido.
 * · La pregunta de guardar en la ficha va DESPUÉS de enviar y en petición
 *   aparte: un fallo ahí no ensucia la operación principal, que ya ocurrió.
 * · Y sólo se ofrece si la ficha estaba VACÍA. Con correo ya guardado,
 *   `PATCH /api/pacientes/[id]/correo` responde 409 por diseño —no sustituye
 *   nunca—, así que ofrecerlo prometería algo que el servidor va a negar.
 *
 * ── ⚠️ EL ACUSE NO PUEDE DECIR «ENVIADO», Y NO ES PRUDENCIA ────────────────
 * Google responde 200 al `patch` y no dice ni una palabra sobre si el correo
 * salió, ni sobre si llegó. Lo que sí consta es que quedaron añadidos a la cita
 * y que Google se encarga de avisarles. Eso es lo que dice el texto.
 */

/** Suficiente para atajar el dedo torcido; la validación de verdad es el servidor. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Cada cuánto se le pregunta al servidor si el evento ya existe. */
const SONDEO_MS = 1000
/** Cuánto se espera antes de rendirse. Ver `useEffect` del sondeo. */
const ESPERA_MAXIMA_MS = 20000

type Paso = 'esperando' | 'sin_evento' | 'eligiendo' | 'confirmando' | 'enviando' | 'enviado'

/** El paciente de la cita YA GUARDADA. Null en eventos genéricos sin paciente. */
interface PacienteDeLaCita {
  readonly id: string
  readonly nombre: string
  /** El de `pacientes.email`. Null si la ficha no tiene ninguno. */
  readonly correoFicha: string | null
}

interface Respuesta {
  readonly ok?: boolean
  readonly error?: string
  readonly message?: string
  readonly yaEstaban?: { readonly paciente?: boolean; readonly tecleado?: boolean }
}

export default function ModalInvitacionCita({
  citaId, paciente, esperandoEvento, onClose,
}: {
  citaId: string
  paciente: PacienteDeLaCita | null
  /**
   * true cuando la cita ACABA DE CREARSE y su evento de Google todavía no
   * existe. Ver el efecto del sondeo: el `after()` de la ruta de alta crea el
   * evento DESPUÉS de responder, así que este modal se abre antes de que haya
   * nada a lo que invitar.
   */
  esperandoEvento: boolean
  onClose: () => void
}) {
  const [paso, setPaso] = useState<Paso>(esperandoEvento ? 'esperando' : 'eligiendo')
  const [invitarPaciente, setInvitarPaciente] = useState(false)
  const [correoEscrito, setCorreoEscrito] = useState('')
  const [editandoCorreo, setEditandoCorreo] = useState(false)
  const [error, setError] = useState('')
  const [yaEstaban, setYaEstaban] = useState({ paciente: false, tecleado: false })
  /* Qué se invitó DE VERDAD en el último envío, para que el acuse no describa lo
     que hay marcado ahora si alguien toca las casillas después. */
  const [ultimoEnvio, setUltimoEnvio] = useState({ paciente: false, tecleado: false })
  const [ofrecerGuardar, setOfrecerGuardar] = useState(false)
  const [correoGuardable, setCorreoGuardable] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [avisoGuardado, setAvisoGuardado] = useState('')

  /**
   * ⚠️ LA ESPERA DEL EVENTO, y por qué hace falta sondear.
   *
   * El alta responde ANTES de escribir en Google: `events.insert` corre en el
   * `after()` de la ruta, o sea después de que la respuesta ya salió. Así que
   * cuando este modal se abre tras crear una cita, `google_event_id` es null y
   * no hay a qué invitar todavía.
   *
   * Se sondea `GET /api/appointments/[id]` —que existe exactamente para esto,
   * una cita con su forma canónica— en vez de escuchar Realtime. Tres motivos:
   * el socket puede estar caído (la agenda tiene camino de reconexión), no ata
   * este modal a los `extendedProps` de FullCalendar, y no depende del orden en
   * que lleguen el INSERT y el UPDATE.
   *
   * TRES CORTES, y el segundo es el que evita esperar en balde:
   *  · llega `google_event_id`  → listo, se puede invitar;
   *  · `gcal_sync_status` es 'failed' → NO va a haber evento. Es una señal
   *    definitiva, no un «todavía no», y por eso corta antes que el reloj;
   *  · 20 s → se ríe uno del reloj y se deja cerrar. El caso lento de verdad es
   *    la PRIMERA cita de una clínica, donde antes del evento hay que crear el
   *    calendario entero.
   */
  useEffect(() => {
    if (!esperandoEvento) return
    let vivo = true
    let temporizador: ReturnType<typeof setTimeout> | undefined
    const limite = Date.now() + ESPERA_MAXIMA_MS

    async function sondear(): Promise<void> {
      if (!vivo) return
      try {
        const res = await fetch(`/api/appointments/${citaId}`)
        if (!vivo) return
        if (res.ok) {
          const datos = await res.json() as { appointment?: { google_event_id?: string | null; gcal_sync_status?: string } }
          if (!vivo) return
          if (datos.appointment?.google_event_id) { setPaso('eligiendo'); return }
          if (datos.appointment?.gcal_sync_status === 'failed') { setPaso('sin_evento'); return }
        }
      } catch {
        /* Un sondeo que falla no es un veredicto: se reintenta hasta el tope. */
      }
      if (!vivo) return
      if (Date.now() >= limite) { setPaso('sin_evento'); return }
      temporizador = setTimeout(() => void sondear(), SONDEO_MS)
    }

    temporizador = setTimeout(() => void sondear(), SONDEO_MS)
    return () => { vivo = false; if (temporizador) clearTimeout(temporizador) }
  }, [esperandoEvento, citaId])

  const correoTecleado = correoEscrito.trim().toLowerCase()
  const hayTecleado = correoTecleado !== '' && EMAIL_REGEX.test(correoTecleado)
  const correoFicha = paciente?.correoFicha?.trim().toLowerCase() ?? ''
  /* ⚠️ SIN CORREO NO SE PUEDE MARCAR LA CASILLA. Regla de producto: si un
     destinatario no tiene dirección, no hay a quién invitar. */
  const puedeInvitarPaciente = paciente !== null && EMAIL_REGEX.test(correoFicha)

  const pacienteMarcado = invitarPaciente && puedeInvitarPaciente
  const hayDestinatario = pacienteMarcado || hayTecleado

  async function enviar(): Promise<void> {
    if (paso === 'enviando' || !hayDestinatario) return
    setPaso('enviando')
    setError('')
    try {
      const res = await fetch(`/api/appointments/${citaId}/invitacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          /* El de la ficha NO viaja: lo lee el servidor de la fila. Lo único que
             sube de aquí es lo que se acaba de teclear. */
          paciente: pacienteMarcado,
          ...(hayTecleado ? { correoTecleado, confirmarCorreoTecleado: true } : {}),
        }),
      })
      const datos = await res.json() as Respuesta
      if (!res.ok) {
        setError(datos.message ?? datos.error ?? 'No se pudo enviar la invitación.')
        setPaso('eligiendo')
        return
      }
      setYaEstaban({
        paciente: datos.yaEstaban?.paciente === true,
        tecleado: datos.yaEstaban?.tecleado === true,
      })
      setUltimoEnvio({ paciente: pacienteMarcado, tecleado: hayTecleado })
      /* Sólo cuando la ficha estaba VACÍA y la dirección se tecleó aquí. La
         pregunta nombra al paciente, para que se vea de quién sería la ficha:
         lo tecleado puede ser de un tercero y entonces la respuesta es que no. */
      setOfrecerGuardar(hayTecleado && paciente !== null && correoFicha === '')
      setCorreoGuardable(correoTecleado)
      setPaso('enviado')
    } catch {
      setError('No se pudo conectar. Revisa tu conexión e intenta de nuevo.')
      setPaso('eligiendo')
    }
  }

  /**
   * Guarda en la ficha el correo que se acaba de usar. La invitación YA salió:
   * esto es sólo para la próxima vez, así que un fallo aquí se cuenta y no se
   * dramatiza. `origen` no es decorativo — sin él, el `audit_log` diría que el
   * correo se guardó tras enviar un documento, que aquí sería falso.
   */
  async function guardarEnFicha(): Promise<void> {
    if (paciente === null || correoGuardable === '' || guardando) return
    setGuardando(true)
    try {
      const res = await fetch(`/api/pacientes/${paciente.id}/correo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: correoGuardable, origen: 'invitacion' }),
      })
      const datos = await res.json() as { error?: string }
      setAvisoGuardado(res.ok ? 'Guardado en la ficha del paciente.' : (datos.error ?? 'No se pudo guardar en la ficha.'))
    } catch {
      setAvisoGuardado('No se pudo guardar en la ficha.')
    } finally {
      setGuardando(false)
      setOfrecerGuardar(false)
    }
  }

  /* Va como función y no como componente para que no se recree en cada render
     (`react-hooks/static-components`). */
  function casillaPaciente(): ReactNode {
    if (paciente === null) return null
    const apagada = !puedeInvitarPaciente
    return (
      <label
        htmlFor="inv-paciente"
        className="flex items-start gap-3 px-3 py-2.5 rounded-xl border transition-colors"
        style={{
          background: pacienteMarcado ? 'var(--ag-patient-card-bg)' : 'var(--ag-input-bg)',
          borderColor: pacienteMarcado ? 'var(--ag-patient-card-border)' : 'var(--ag-input-border)',
          cursor: apagada ? 'not-allowed' : 'pointer',
          opacity: apagada ? 0.7 : 1,
        }}
      >
        <input
          id="inv-paciente"
          type="checkbox"
          checked={pacienteMarcado}
          disabled={apagada}
          onChange={e => setInvitarPaciente(e.target.checked)}
          className="mt-0.5 w-4 h-4 flex-shrink-0 accent-[var(--ag-brand-secondary)]"
        />
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--ag-ink)' }}>
            <User size={14} style={{ color: 'var(--ag-brand-secondary)' }} />
            {paciente.nombre}
          </span>
          <span className="block text-[12px] mt-0.5 break-all" style={{ color: 'var(--ag-muted)' }}>
            {correoFicha !== '' ? correoFicha : 'Sin correo en su ficha'}
          </span>
          {/* El motivo, siempre a la vista: una casilla apagada y muda deja a
              quien agenda buscando qué le falta. */}
          {apagada && (
            /* ⚠️ DEUDA DECLARADA: `no_show` se usa aquí como GRIS DE ADVERTENCIA,
               no porque nada esté en ese estado. Es el mismo acoplamiento
               accidental que tenía el acuse verde de más abajo y que se deshizo
               a `--ag-success-*`. Éste sobrevivió a la rotación de la paleta
               (bloque 2B) por suerte: «no asistió» fue uno de los dos estados
               que no cambiaron de color. Cuando se toque ese gris, esto se
               desengancha primero a `--ag-warning-*`. */
            <span className="block text-[12px] mt-1 font-semibold" style={{ color: 'var(--ag-status-no_show-text)' }}>
              Escribe una dirección abajo para invitarlo.
            </span>
          )}
        </span>
      </label>
    )
  }

  const cuerpo = (): ReactNode => {
    if (paso === 'esperando') {
      return (
        <div className="flex flex-col items-center text-center gap-3 py-4">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--ag-brand-secondary)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--ag-ink)' }}>
            Creando el evento en Google…
          </p>
          <p className="text-[12.5px] leading-relaxed max-w-xs" style={{ color: 'var(--ag-muted)' }}>
            {/* Neutro: este modal se abre igual tras crear una CITA que tras crear un
                EVENTO genérico (unas vacaciones), y «la cita» nombraba mal la mitad de
                los casos. «El evento» que sí se nombra aquí es el de GOOGLE, que es de
                lo que se está esperando. */}
            Ya está guardado en la agenda. Hay que esperar a que exista el evento en
            Google para poder invitar a alguien; suele tardar un par de segundos.
          </p>
        </div>
      )
    }

    if (paso === 'sin_evento') {
      return (
        /* Deuda declarada, la misma de arriba: `no_show` como gris de aviso. */
        <div className="rounded-xl border px-3 py-3" style={{ background: 'var(--ag-status-no_show-bg)', borderColor: 'var(--ag-status-no_show-border)' }}>
          <p className="flex items-start gap-2 text-[13px] leading-relaxed" style={{ color: 'var(--ag-text)' }}>
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <span>
              El evento en Google no llegó a crearse, así que todavía no hay a qué invitar.
              <strong> Lo agendado está guardado</strong> y no se ha perdido nada. Vuelve a abrirlo
              en un rato y usa «Agregar invitados».
            </span>
          </p>
        </div>
      )
    }

    if (paso === 'confirmando') {
      /* ⚠️ ESTO NO ES UN «¿ESTÁS SEGURO?». Enseña la dirección tecleada grande y
         sola para que se lea LETRA POR LETRA. No hay «cancelar invitación»: en
         cuanto Google la manda, el nombre del paciente está en un buzón ajeno. */
      return (
        /* Deuda declarada, la misma de arriba: `no_show` como gris de aviso. */
        <div className="rounded-xl border px-3 py-3 space-y-2.5" style={{ background: 'var(--ag-status-no_show-bg)', borderColor: 'var(--ag-status-no_show-border)' }}>
          <p className="text-[12px] font-bold uppercase tracking-[.06em]" style={{ color: 'var(--ag-muted2)' }}>
            Vas a invitar a esta dirección escrita a mano
          </p>
          <p className="text-[17px] font-bold leading-tight break-all select-all" style={{ color: 'var(--ag-ink)' }}>
            {correoTecleado}
          </p>
          {/* ⚠️ AQUÍ SÍ SE RAMIFICA, Y NO SE NEUTRALIZA. Esta frase no nombra la
              fila: nombra QUÉ VIAJA en el correo, y no es lo mismo en los dos
              casos. En una CITA es el nombre completo del paciente —lo compone
              `tituloParaGoogle` como «Cita médica: …»— y ése es el dato cuya fuga
              justifica todo este paso de confirmación. En un EVENTO genérico no
              hay paciente: el título es el texto libre que escribió el médico, y
              decir «el nombre del paciente» ahí sería avisar de una fuga que no
              ocurre y callar la que sí puede ocurrir. Una frase neutra perdería
              justo la advertencia. */}
          <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ag-text)' }}>
            Compruébala letra por letra. {paciente
              ? 'La invitación lleva el nombre completo del paciente en el título'
              : 'La invitación lleva el título tal como lo escribiste'}, y un correo
            enviado no se puede recuperar.
          </p>
        </div>
      )
    }

    if (paso === 'enviado') {
      return (
        <div className="space-y-3">
          {/* --ag-success-*, NO --ag-status-confirmed-*. Es el verde de «la
              operación salió», no el del estado «confirmada»: aquí no se está
              confirmando ninguna cita, y colgar de ese token hacía que retocar
              el color del estado le moviera el color a este acuse. Mismo valor
              pintado, distinto dueño. */}
          <div className="rounded-xl border px-3 py-3" style={{ background: 'var(--ag-success-bg)', borderColor: 'var(--ag-success-border)' }}>
            <p className="flex items-start gap-2 text-[13px] leading-relaxed" style={{ color: 'var(--ag-success-text)' }} aria-live="polite">
              <Check size={16} className="mt-0.5 flex-shrink-0" />
              {/* ⚠️ NO DICE «ENVIADO». Google contesta 200 al patch y no informa
                  de si el correo salió. Se afirma lo que consta. */}
              <span>{textoAcuse(ultimoEnvio, yaEstaban)}</span>
            </p>
          </div>
          <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ag-muted)' }}>
            Google no confirma la entrega. Si alguien no la ve, pídele que revise su carpeta
            de <strong>spam o correo no deseado</strong>; puedes volver a invitarlo entrando
            de nuevo, no se duplica nada.
          </p>

          {/* La invitación YA salió; esto es sólo para la próxima vez. Por eso se
              pregunta DESPUÉS: nada de lo que se conteste aquí lo cambia. */}
          {ofrecerGuardar && paciente !== null && (
            <div className="rounded-xl border px-3 py-3 space-y-2" style={{ background: 'var(--ag-input-bg)', borderColor: 'var(--ag-input-border)' }}>
              <p className="text-[13px]" style={{ color: 'var(--ag-text)' }}>
                ¿Guardas <strong style={{ color: 'var(--ag-ink)' }}>{correoGuardable}</strong> en la
                ficha de {paciente.nombre} para la próxima vez?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void guardarEnFicha()}
                  disabled={guardando}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-bold text-white disabled:opacity-50 transition-all hover:brightness-95 bg-[linear-gradient(135deg,var(--ag-brand-primary),var(--ag-brand-secondary))]"
                >
                  {guardando ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : 'Guardar en la ficha'}
                </button>
                <button
                  type="button"
                  onClick={() => setOfrecerGuardar(false)}
                  className="px-3 py-1.5 rounded-xl text-[13px] font-bold transition-colors hover:bg-[var(--ag-btn-ghost-hover)]"
                  style={{ color: 'var(--ag-muted)' }}
                >
                  No, gracias
                </button>
              </div>
            </div>
          )}

          {avisoGuardado !== '' && (
            <p className="text-[12px]" style={{ color: 'var(--ag-muted)' }} aria-live="polite">{avisoGuardado}</p>
          )}
        </div>
      )
    }

    // 'eligiendo' y 'enviando'
    return (
      <>
        <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--ag-muted)' }}>
          Quien invites queda añadido al evento en Google, y Google le manda la
          invitación por correo. No se ven el correo entre ellos, no pueden modificar nada
          y rechazar la invitación no cambia nada aquí.
          {/* El médico ya está dentro y no se ofrece: entró al crearse el evento. */}
          {' '}El médico asignado ya lo tiene en su calendario.
        </p>

        {casillaPaciente()}

        {/* ⚠️ EL CORREO ES EDITABLE SIEMPRE, tenga el paciente ficha o no, y lo
            que se escriba aquí NO tiene por qué ser suyo: el caso real es la
            hija que llama para agendar la cita de su padre. Vale SÓLO para esta
            invitación — la ficha no se toca hasta que se conteste que sí a la
            pregunta de después. */}
        {editandoCorreo || paciente === null || correoFicha === '' ? (
          <div className="space-y-1.5">
            <label htmlFor="inv-correo" className="block text-[11px] font-bold uppercase tracking-[.06em]" style={{ color: 'var(--ag-muted2)' }}>
              Invitar a otra dirección (sólo para esta invitación)
            </label>
            <input
              id="inv-correo"
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={correoEscrito}
              onChange={e => setCorreoEscrito(e.target.value)}
              placeholder="nombre@correo.com"
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-[var(--ag-input-border)] bg-[var(--ag-input-bg)] text-[var(--ag-text)] focus:outline-none focus:ring-2 focus:ring-[var(--ag-input-focus-ring)] focus:border-[var(--ag-input-focus-border)] transition-all"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditandoCorreo(true)}
            className="text-[12px] font-semibold underline underline-offset-2"
            style={{ color: 'var(--ag-brand-secondary)' }}
          >
            Invitar también a otra dirección
          </button>
        )}
      </>
    )
  }

  const pie = (): ReactNode => {
    if (paso === 'esperando' || paso === 'sin_evento') {
      return (
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-sm font-bold transition-colors hover:bg-[var(--ag-btn-ghost-hover)]"
          style={{ color: 'var(--ag-muted)' }}
        >
          {paso === 'esperando' ? 'No invitar a nadie' : 'Cerrar'}
        </button>
      )
    }

    if (paso === 'confirmando') {
      return (
        <>
          <button
            onClick={() => setPaso('eligiendo')}
            className="px-4 py-2 rounded-xl text-sm font-bold transition-colors hover:bg-[var(--ag-btn-ghost-hover)]"
            style={{ color: 'var(--ag-muted)' }}
          >
            Corregir
          </button>
          <button
            onClick={() => void enviar()}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:brightness-95 shadow-sm bg-[linear-gradient(135deg,var(--ag-brand-primary),var(--ag-brand-secondary))]"
          >
            <Send size={15} /> Sí, invitar ahí
          </button>
        </>
      )
    }

    /* Tras enviar sólo queda «Aceptar»: el botón de enviar desaparece. Ver la
       cabecera — reenviar sigue siendo posible entrando de nuevo a la cita. */
    if (paso === 'enviado') {
      return (
        <button
          onClick={onClose}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:brightness-95 shadow-sm bg-[linear-gradient(135deg,var(--ag-brand-primary),var(--ag-brand-secondary))]"
        >
          Aceptar
        </button>
      )
    }

    return (
      <>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-sm font-bold transition-colors hover:bg-[var(--ag-btn-ghost-hover)]"
          style={{ color: 'var(--ag-muted)' }}
        >
          No invitar a nadie
        </button>
        <button
          onClick={() => {
            /* Toda dirección que venga del teclado pasa por la confirmación. */
            if (hayTecleado) setPaso('confirmando')
            else void enviar()
          }}
          disabled={!hayDestinatario || paso === 'enviando'}
          aria-busy={paso === 'enviando'}
          title={hayDestinatario ? undefined : 'Marca un destinatario o escribe una dirección'}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all hover:brightness-95 shadow-sm bg-[linear-gradient(135deg,var(--ag-brand-primary),var(--ag-brand-secondary))]"
        >
          {paso === 'enviando'
            ? <><Loader2 size={15} className="animate-spin" /> Enviando…</>
            : <><Send size={15} /> Enviar invitación</>}
        </button>
      </>
    )
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 backdrop-blur-sm" style={{ background: 'var(--ag-modal-overlay)' }} onClick={onClose} />
        <div
          className="relative rounded-[22px] w-full max-w-[440px] max-h-[92vh] flex flex-col animate-modal-enter overflow-hidden"
          style={{ background: 'var(--ag-modal-bg)', boxShadow: '0 30px 80px rgba(16, 32, 64, .28)' }}
        >
          <div className="flex items-center gap-3 px-[22px] py-[18px] border-b" style={{ borderColor: 'var(--ag-hairline)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--ag-modal-icon-bg)' }}>
              <Mail size={20} style={{ color: 'var(--ag-brand-primary)' }} />
            </div>
            <h2 className="text-[18px] font-extrabold" style={{ color: 'var(--ag-ink)' }}>
              Invitar por correo
            </h2>
            <button onClick={onClose} className="ml-auto p-1 transition-opacity hover:opacity-70" style={{ color: 'var(--ag-muted2)' }} aria-label="Cerrar">
              <X size={20} />
            </button>
          </div>

          <div className="px-[22px] py-5 space-y-3 flex-1 min-h-0 overflow-y-auto">
            {cuerpo()}
            {error !== '' && (
              /* ⚠️ DEUDA DECLARADA: `cancelled` se usa aquí como ROJO DE ERROR,
                 no porque haya ninguna cita cancelada. Igual que el gris de
                 arriba, sobrevivió a la rotación del bloque 2B porque
                 «cancelada» fue el otro estado que no cambió de color. Cuando se
                 toque ese rojo, esto se desengancha primero a `--ag-danger-*`. */
              <p className="flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[13px] leading-relaxed" role="alert"
                style={{ background: 'var(--ag-status-cancelled-bg)', borderColor: 'var(--ag-status-cancelled-border)', color: 'var(--ag-status-cancelled-text)' }}>
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </p>
            )}
          </div>

          <div className="px-[22px] py-3.5 border-t flex items-center justify-end gap-2" style={{ borderColor: 'var(--ag-hairline)' }}>
            {pie()}
          </div>
        </div>
      </div>
    </Portal>
  )
}

/**
 * El acuse, y cada palabra está pesada.
 *
 * Dice DOS cosas, las dos comprobables: que quedaron añadidos a la cita (eso lo
 * devolvió Google) y que Google les mandó la invitación (eso es lo que hace
 * `sendUpdates: 'all'`). NO dice que el correo llegara, porque eso no consta en
 * ninguna respuesta de la API.
 *
 * A quien ya figuraba como invitado se le nombra aparte: para ése no hubo alta
 * ninguna, hubo un reenvío, y prometer un alta que no ocurrió es lo mismo que
 * mentir aunque el desenlace se parezca.
 */
function textoAcuse(
  enviado: { paciente: boolean; tecleado: boolean },
  yaEstaban: { paciente: boolean; tecleado: boolean },
): string {
  const nuevos: string[] = []
  const repetidos: string[] = []
  if (enviado.paciente) (yaEstaban.paciente ? repetidos : nuevos).push('el paciente')
  if (enviado.tecleado) (yaEstaban.tecleado ? repetidos : nuevos).push('la dirección que escribiste')

  const frases: string[] = []
  if (nuevos.length > 0) {
    frases.push(`${unirY(nuevos)} ${nuevos.length > 1 ? 'quedaron añadidos' : 'quedó añadido'} y Google ${nuevos.length > 1 ? 'les' : 'le'} mandó la invitación por correo.`)
  }
  if (repetidos.length > 0) {
    frases.push(`${unirY(repetidos)} ya ${repetidos.length > 1 ? 'estaban' : 'estaba'} en la lista de invitados, así que Google ${repetidos.length > 1 ? 'les' : 'le'} reenvió el correo.`)
  }
  const texto = frases.join(' ')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** «a», «a y b». Sin coma de Oxford: son dos elementos como máximo. */
function unirY(partes: readonly string[]): string {
  return partes.length > 1 ? `${partes[0]} y ${partes[1]}` : partes[0]
}
