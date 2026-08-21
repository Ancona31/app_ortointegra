'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, Check, Loader2, Mail, Send, Stethoscope, User, X } from 'lucide-react'
import Portal from '@/components/ui/Portal'

/**
 * Confirmación del botón «Enviar invitación» del modal de la cita.
 *
 * ── QUÉ ES Y QUÉ NO ES ──────────────────────────────────────────────────────
 * Un solo botón abre esto, y aquí se elige a quién: al médico asignado, al
 * paciente, o a los dos. Se resuelve con UN SOLO `patch` contra Google, no con
 * uno por destinatario — el motivo está en la ruta, y es que `sendUpdates: 'all'`
 * notifica a TODOS los asistentes en cada patch.
 *
 * NADA DE ESTO BLOQUEA NADA. Ni crear la cita ni editarla dependen del correo:
 * sin correo, con uno mal escrito o con uno que rebota, la cita se guarda igual.
 * La invitación es una acción deliberada y aparte, y es completamente opcional.
 *
 * ── LO QUE SE HEREDA DE `ModalDocumentoGenerado.tsx` Y POR QUÉ ──────────────
 * · Confirmación letra por letra cuando la dirección viene DEL TECLADO, tenga
 *   la ficha correo o no. No existe «cancelar invitación»: una vez que Google
 *   manda el correo, el título con el nombre del paciente ya está en el buzón de
 *   un desconocido. La dirección de la ficha no pasa por ese paso, porque ese
 *   dato ya lo validó alguien al guardarlo.
 * · La pregunta de guardar en la ficha va DESPUÉS de enviar y en petición
 *   aparte: un fallo ahí no ensucia la operación principal, que ya ocurrió.
 * · Y sólo se ofrece si la ficha estaba VACÍA. Con correo ya guardado,
 *   `PATCH /api/pacientes/[id]/correo` responde 409 por diseño —no sustituye
 *   nunca—, así que ofrecerlo prometería algo que el servidor va a negar.
 *
 * ── LO QUE NO SE HEREDA ─────────────────────────────────────────────────────
 * ⚠️ EL ACUSE NO PUEDE DECIR «ENVIADO», Y NO ES PRUDENCIA: ES QUE NO SE SABE.
 * Google responde 200 al `patch` y no dice ni una palabra sobre si el correo
 * salió, ni sobre si llegó. Lo que sí se sabe es que quedaron añadidos a la cita
 * y que Google se encarga de avisarles. Eso es lo que dice el texto.
 *
 * Tampoco se hereda la advertencia de «lleva datos clínicos dentro»: aquí no
 * viaja ningún PDF. Lo que sale es el título del evento, que lleva el nombre
 * completo del paciente y nada más.
 */

/** Suficiente para atajar el dedo torcido; la validación de verdad es el servidor. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Paso = 'eligiendo' | 'confirmando' | 'enviando' | 'enviado'

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
  readonly yaEstaban?: { readonly medico?: boolean; readonly paciente?: boolean }
}

export default function ModalInvitacionCita({
  citaId, medicoNombre, paciente, onClose,
}: {
  citaId: string
  /** Nombre compuesto del médico asignado. Null si la cita no tiene ninguno. */
  medicoNombre: string | null
  paciente: PacienteDeLaCita | null
  onClose: () => void
}) {
  const [paso, setPaso] = useState<Paso>('eligiendo')
  const [invitarMedico,   setInvitarMedico]   = useState(false)
  const [invitarPaciente, setInvitarPaciente] = useState(false)
  /* Vacío = se usa el de la ficha. Con algo dentro, esa dirección manda y exige
     el paso de confirmación. */
  const [correoEscrito, setCorreoEscrito] = useState('')
  const [editandoCorreo, setEditandoCorreo] = useState(paciente?.correoFicha === null)
  const [error, setError] = useState('')
  const [yaEstaban, setYaEstaban] = useState<{ medico: boolean; paciente: boolean }>({ medico: false, paciente: false })
  /* Qué se invitó DE VERDAD en el último envío, para que el acuse no describa
     lo que hay marcado ahora si alguien toca las casillas después. */
  const [ultimoEnvio, setUltimoEnvio] = useState<{ medico: boolean; paciente: boolean }>({ medico: false, paciente: false })
  const [ofrecerGuardar, setOfrecerGuardar] = useState(false)
  const [correoGuardable, setCorreoGuardable] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [avisoGuardado, setAvisoGuardado] = useState('')

  const hayMedico = medicoNombre !== null
  const correoTecleado = correoEscrito.trim().toLowerCase()
  /* La dirección que se usaría ahora mismo: la tecleada si hay, si no la ficha. */
  const correoEfectivo = correoTecleado !== '' ? correoTecleado : (paciente?.correoFicha ?? '')
  /* ⚠️ SIN CORREO NO SE PUEDE MARCAR LA CASILLA. Es la regla de producto: si un
     destinatario no tiene dirección y no se teclea una, no hay a quién invitar. */
  const puedeInvitarPaciente = paciente !== null && EMAIL_REGEX.test(correoEfectivo)

  const medicoMarcado   = invitarMedico   && hayMedico
  const pacienteMarcado = invitarPaciente && puedeInvitarPaciente
  const hayDestinatario = medicoMarcado || pacienteMarcado

  async function enviar(): Promise<void> {
    if (paso === 'enviando' || !hayDestinatario) return
    setPaso('enviando')
    setError('')
    /* La dirección tecleada viaja SOLO si es el paciente quien la va a usar.
       Con el correo de la ficha no se manda nada: que lo lea el servidor de la
       fila, que es la fuente. */
    const usaTecleado = pacienteMarcado && correoTecleado !== ''
    try {
      const res = await fetch(`/api/appointments/${citaId}/invitacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medico:   medicoMarcado,
          paciente: pacienteMarcado,
          ...(usaTecleado ? { pacienteEmail: correoTecleado, confirmarCorreoTecleado: true } : {}),
        }),
      })
      const datos = await res.json() as Respuesta
      if (!res.ok) {
        setError(datos.message ?? datos.error ?? 'No se pudo enviar la invitación.')
        setPaso('eligiendo')
        return
      }
      setYaEstaban({
        medico:   datos.yaEstaban?.medico   === true,
        paciente: datos.yaEstaban?.paciente === true,
      })
      setUltimoEnvio({ medico: medicoMarcado, paciente: pacienteMarcado })
      /* Sólo cuando la ficha estaba VACÍA y la dirección se tecleó aquí. Ver la
         cabecera: con correo ya guardado el servidor responde 409 por diseño. */
      setOfrecerGuardar(usaTecleado && paciente !== null && paciente.correoFicha === null)
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

  /** Una casilla con su nombre, su renglón de detalle y su motivo si está apagada. */
  function casilla(opciones: {
    id: string
    icono: ReactNode
    titulo: string
    detalle: ReactNode
    marcada: boolean
    apagada: boolean
    motivo: string
    onChange: (v: boolean) => void
  }) {
    return (
      <label
        htmlFor={opciones.id}
        className="flex items-start gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors"
        style={{
          background: opciones.marcada ? 'var(--ag-patient-card-bg)' : 'var(--ag-input-bg)',
          borderColor: opciones.marcada ? 'var(--ag-patient-card-border)' : 'var(--ag-input-border)',
          cursor: opciones.apagada ? 'not-allowed' : 'pointer',
          opacity: opciones.apagada ? 0.7 : 1,
        }}
      >
        <input
          id={opciones.id}
          type="checkbox"
          checked={opciones.marcada}
          disabled={opciones.apagada}
          onChange={e => opciones.onChange(e.target.checked)}
          className="mt-0.5 w-4 h-4 flex-shrink-0 accent-[var(--ag-brand-secondary)]"
        />
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--ag-ink)' }}>
            {opciones.icono}
            {opciones.titulo}
          </span>
          <span className="block text-[12px] mt-0.5" style={{ color: 'var(--ag-muted)' }}>
            {opciones.detalle}
          </span>
          {/* El motivo, siempre a la vista: una casilla apagada sin explicación
              deja a quien agenda buscando qué le falta. */}
          {opciones.apagada && opciones.motivo !== '' && (
            <span className="block text-[12px] mt-1 font-semibold" style={{ color: 'var(--ag-status-no_show-text)' }}>
              {opciones.motivo}
            </span>
          )}
        </span>
      </label>
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
          {/* Header */}
          <div className="flex items-center gap-3 px-[22px] py-[18px] border-b" style={{ borderColor: 'var(--ag-hairline)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--ag-modal-icon-bg)' }}>
              <Mail size={20} style={{ color: 'var(--ag-brand-primary)' }} />
            </div>
            <h2 className="text-[18px] font-extrabold" style={{ color: 'var(--ag-ink)' }}>
              Enviar invitación
            </h2>
            <button onClick={onClose} className="ml-auto p-1 transition-opacity hover:opacity-70" style={{ color: 'var(--ag-muted2)' }} aria-label="Cerrar">
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="px-[22px] py-5 space-y-3 flex-1 min-h-0 overflow-y-auto">

            {paso === 'confirmando' ? (
              /* ⚠️ ESTO NO ES UN «¿ESTÁS SEGURO?». Enseña la dirección tecleada
                 grande y sola para que se lea LETRA POR LETRA. No hay «cancelar
                 invitación»: en cuanto Google la manda, el nombre del paciente
                 está en un buzón ajeno y no se recupera. */
              <div className="rounded-xl border px-3 py-3 space-y-2.5" style={{ background: 'var(--ag-status-no_show-bg)', borderColor: 'var(--ag-status-no_show-border)' }}>
                <p className="text-[12px] font-bold uppercase tracking-[.06em]" style={{ color: 'var(--ag-muted2)' }}>
                  Vas a invitar a esta dirección escrita a mano
                </p>
                <p className="text-[17px] font-bold leading-tight break-all select-all" style={{ color: 'var(--ag-ink)' }}>
                  {correoTecleado}
                </p>
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ag-text)' }}>
                  Compruébala letra por letra. La invitación lleva el nombre completo del
                  paciente en el título de la cita, y un correo enviado no se puede recuperar.
                </p>
              </div>
            ) : paso === 'enviado' ? (
              <div className="space-y-3">
                <div className="rounded-xl border px-3 py-3" style={{ background: 'var(--ag-status-confirmed-bg)', borderColor: 'var(--ag-status-confirmed-border)' }}>
                  <p className="flex items-start gap-2 text-[13px] leading-relaxed" style={{ color: 'var(--ag-status-confirmed-text)' }} aria-live="polite">
                    <Check size={16} className="mt-0.5 flex-shrink-0" />
                    {/* ⚠️ NO DICE «ENVIADO». Google contesta 200 al patch y no
                        informa de si el correo salió. Se afirma lo que consta. */}
                    <span>
                      {textoAcuse(ultimoEnvio, yaEstaban)}
                    </span>
                  </p>
                </div>
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ag-muted)' }}>
                  Google no confirma la entrega. Si alguien no la ve, pídele que revise su
                  carpeta de <strong>spam o correo no deseado</strong>; puedes volver a pulsar
                  el botón las veces que haga falta, no se duplica la cita.
                </p>

                {/* La invitación YA salió; esto es sólo para la próxima vez. Por
                    eso se pregunta DESPUÉS: nada de lo que se conteste aquí
                    cambia lo que acaba de ocurrir. */}
                {ofrecerGuardar && paciente !== null && (
                  <div className="rounded-xl border px-3 py-3 space-y-2" style={{ background: 'var(--ag-input-bg)', borderColor: 'var(--ag-input-border)' }}>
                    <p className="text-[13px]" style={{ color: 'var(--ag-text)' }}>
                      ¿Guardas <strong style={{ color: 'var(--ag-ink)' }}>{correoGuardable}</strong> en la ficha de {paciente.nombre} para la próxima vez?
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
            ) : (
              <>
                <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--ag-muted)' }}>
                  Quien marques queda añadido como invitado del evento de esta cita en Google, y
                  Google le manda la invitación por correo. No se ven el correo entre ellos, no
                  pueden modificar la cita y rechazarla no cambia nada aquí.
                </p>

                {casilla({
                  id: 'inv-medico',
                  icono: <Stethoscope size={14} style={{ color: 'var(--ag-brand-secondary)' }} />,
                  titulo: 'Médico asignado',
                  detalle: medicoNombre ?? 'Sin médico asignado',
                  marcada: medicoMarcado,
                  apagada: !hayMedico,
                  motivo: 'Esta cita no tiene médico asignado.',
                  onChange: setInvitarMedico,
                })}

                {/* Los eventos genéricos no tienen paciente ligado: ahí esta
                    casilla no existe, no se enseña apagada. */}
                {paciente !== null && casilla({
                  id: 'inv-paciente',
                  icono: <User size={14} style={{ color: 'var(--ag-brand-secondary)' }} />,
                  titulo: 'Paciente',
                  detalle: (
                    <>
                      {paciente.nombre}
                      {correoEfectivo !== '' && <> · <span className="break-all">{correoEfectivo}</span></>}
                    </>
                  ),
                  marcada: pacienteMarcado,
                  apagada: !puedeInvitarPaciente,
                  motivo: correoEfectivo === ''
                    ? 'Sin correo. Escribe uno abajo para poder invitarlo.'
                    : 'Ese correo no tiene forma válida.',
                  onChange: setInvitarPaciente,
                })}

                {/* ⚠️ EL CORREO DEL PACIENTE ES EDITABLE SIEMPRE, tenga ficha o
                    no. El caso real es la hija que llama para agendar la cita de
                    su padre. Lo que se teclee aquí vale SÓLO para esta
                    invitación: la ficha no se toca hasta que se conteste que sí
                    a la pregunta de después. */}
                {paciente !== null && (editandoCorreo ? (
                  <div className="space-y-1.5">
                    <label htmlFor="inv-correo" className="block text-[11px] font-bold uppercase tracking-[.06em]" style={{ color: 'var(--ag-muted2)' }}>
                      {paciente.correoFicha === null
                        ? 'Este paciente no tiene correo en su ficha'
                        : 'Correo sólo para esta invitación (la ficha no se toca)'}
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
                    {paciente.correoFicha !== null && (
                      <button
                        type="button"
                        onClick={() => { setCorreoEscrito(''); setEditandoCorreo(false) }}
                        className="text-[12px] font-semibold underline underline-offset-2"
                        style={{ color: 'var(--ag-brand-secondary)' }}
                      >
                        Usar el de la ficha ({paciente.correoFicha})
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditandoCorreo(true)}
                    className="text-[12px] font-semibold underline underline-offset-2"
                    style={{ color: 'var(--ag-brand-secondary)' }}
                  >
                    Usar otro correo sólo para esta invitación
                  </button>
                ))}
              </>
            )}

            {error !== '' && (
              <p className="flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[13px] leading-relaxed" role="alert"
                style={{ background: 'var(--ag-status-cancelled-bg)', borderColor: 'var(--ag-status-cancelled-border)', color: 'var(--ag-status-cancelled-text)' }}>
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="px-[22px] py-3.5 border-t flex items-center justify-end gap-2" style={{ borderColor: 'var(--ag-hairline)' }}>
            {paso === 'confirmando' ? (
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
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-sm font-bold transition-colors hover:bg-[var(--ag-btn-ghost-hover)]"
                  style={{ color: 'var(--ag-muted)' }}
                >
                  {paso === 'enviado' ? 'Cerrar' : 'Cancelar'}
                </button>
                {/* ⚠️ NO SE APAGA DESPUÉS DE ENVIAR, y es decisión: Google no
                    duplica al asistente, sólo reenvía el correo — que es
                    exactamente lo que hace falta para quien lo perdió. */}
                <button
                  onClick={() => {
                    /* Toda dirección que venga del teclado pasa por la
                       confirmación, tenga la ficha correo o no. */
                    if (pacienteMarcado && correoTecleado !== '') setPaso('confirmando')
                    else void enviar()
                  }}
                  disabled={!hayDestinatario || paso === 'enviando'}
                  aria-busy={paso === 'enviando'}
                  title={hayDestinatario ? undefined : 'Marca al menos un destinatario'}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all hover:brightness-95 shadow-sm bg-[linear-gradient(135deg,var(--ag-brand-primary),var(--ag-brand-secondary))]"
                >
                  {paso === 'enviando'
                    ? <><Loader2 size={15} className="animate-spin" /> Enviando…</>
                    : <><Send size={15} /> Enviar invitación</>}
                </button>
              </>
            )}
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
  enviado: { medico: boolean; paciente: boolean },
  yaEstaban: { medico: boolean; paciente: boolean },
): string {
  const nuevos: string[] = []
  const repetidos: string[] = []
  if (enviado.medico)   (yaEstaban.medico   ? repetidos : nuevos).push('el médico')
  if (enviado.paciente) (yaEstaban.paciente ? repetidos : nuevos).push('el paciente')

  const frases: string[] = []
  if (nuevos.length > 0) {
    frases.push(`${unirY(nuevos)} ${nuevos.length > 1 ? 'quedaron añadidos' : 'quedó añadido'} a la cita y Google ${nuevos.length > 1 ? 'les' : 'le'} mandó la invitación por correo.`)
  }
  if (repetidos.length > 0) {
    frases.push(`${unirY(repetidos)} ya ${repetidos.length > 1 ? 'estaban' : 'estaba'} en la cita, así que Google ${repetidos.length > 1 ? 'les' : 'le'} reenvió el correo.`)
  }
  /* Mayúscula inicial sin tocar el resto: las frases se componen en minúscula
     porque empiezan por «el médico» / «el paciente». */
  const texto = frases.join(' ')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** «a», «a y b». Sin coma de Oxford: son dos elementos como máximo. */
function unirY(partes: readonly string[]): string {
  return partes.length > 1 ? `${partes[0]} y ${partes[1]}` : partes[0]
}
