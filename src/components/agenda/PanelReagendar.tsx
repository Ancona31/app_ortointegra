'use client'

/**
 * src/components/agenda/PanelReagendar.tsx — «Reagendar» de una cita
 * reservada por enlace (tanda I, punto 9 de Angel), dentro del formulario.
 *
 * En esa cita el paciente eligió médico, consultorio, día y hora: el
 * formulario los deja deshabilitados y el arrastre se rechaza. Esto es la
 * única forma de mover consultorio, día u hora, y en tres pasos:
 *   1. los datos nuevos (la DURACIÓN se conserva; el médico no se toca);
 *   2. la confirmación EXPLÍCITA, que dice cómo se avisará al paciente (si la
 *      hora nueva cae en un bloqueo pintado, no se llega aquí: el mensaje de
 *      L1, el mismo del alta, el modal y el arrastre; el servidor lo repite);
 *   3. `POST /api/appointments/[id]/reagendar` con `confirmado: true`. Si se
 *      empalma (B7, 409 con la lista) se pregunta y se reenvía aceptándolos.
 * Hecho: si la cita tiene correo, el servidor le manda el aviso de cambio con
 * su enlace de confirmar o cancelar; si no (enlace de un solo uso sin
 * correo), lo dice aquí y ofrece el WhatsApp manual.
 * Montarlo no escribe ni trae nada: sólo pulsar «Sí, reagendar y avisar».
 */
import { useState, type ReactElement } from 'react'
import { componerIso, partirFechaHora } from '@/lib/agenda/fechasAgenda'
import { esListaDeEmpalmes, mensajeEmpalme, type Empalme } from '@/lib/agenda/empalmesCita'
import { correoParaConfirmacion } from '@/lib/agenda/whatsappCita'
import { TEXTO_HORARIO_BLOQUEADO } from '@/lib/agenda/bloqueosAgenda'
import type { Appointment } from '@/lib/agenda/tiposAgenda'
import { BotonWhatsAppCita } from '@/components/agenda/BotonWhatsAppCita'

type Aviso = 'enviado' | 'sin_correo' | 'no_enviado'

type Fase =
  | { tipo: 'datos'; error: string | null }
  | { tipo: 'confirmar' }
  | { tipo: 'empalme'; lista: Empalme[]; aceptados: string[] }
  | { tipo: 'enviando' }
  | { tipo: 'hecho'; aviso: Aviso }

type Respuesta = { tipo: 'ok'; aviso: Aviso } | { tipo: 'empalme'; lista: Empalme[] } | { tipo: 'error'; mensaje: string }

export const TEXTO_REAGENDAR = {
  conCorreo: 'Le enviaremos al paciente un correo con los datos nuevos y su enlace para confirmar o cancelar.',
  sinCorreo: 'Esta cita no tiene correo: no se le avisará solo. Al terminar podrás mandarle un WhatsApp.',
  enviado: 'Listo: la cita se reagendó y le enviamos el correo con los datos nuevos.',
  sin_correo: 'La cita se reagendó. No tiene correo: avísale por WhatsApp.',
  no_enviado: 'La cita se reagendó, pero el correo no salió. Avísale por WhatsApp.',
} as const

/* B13 · AG5 · las piezas del catálogo (maqueta `ag-form`, vista 3 «Reagendar»): campo relleno `--sup2`
   sin borde (44/16 en táctil, 40/15 en computadora, contorno `--enlace` al enfocar), rótulo 13/600,
   botones `.k-b` (quieto y principal) y textos 13–14 con los tokens del kit. */
const CLASE_CAMPO = 'w-full h-11 esc:h-10 px-3 text-base esc:text-[15px] rounded-xl border-0 bg-sup2 text-tinta focus:outline-2 focus:outline-enlace ag-transicion-color'
const CLASE_ETIQUETA = 'block text-[13px] leading-[18px] font-semibold mb-1.5'
const CLASE_BOTON = 'k-b k-b-capa k-b-quieto'
/* La pinta de «Guardar» del formulario. */
const CLASE_PRIMARIO = 'k-b k-b-capa k-b-prim'

function leerTexto(d: unknown, k: string): string {
  if (typeof d !== 'object' || d === null) return ''
  const v: unknown = Reflect.get(d, k)
  return typeof v === 'string' ? v : ''
}

/** La llamada a la ruta, en una respuesta. Nunca lanza. */
async function pedirReagendar(citaId: string, cuerpo: Record<string, unknown>): Promise<Respuesta> {
  try {
    const res = await fetch(`/api/appointments/${citaId}/reagendar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...cuerpo, confirmado: true }),
    })
    const d: unknown = await res.json().catch(() => null)
    if (res.ok) {
      const aviso = leerTexto(d, 'correo')
      return { tipo: 'ok', aviso: aviso === 'enviado' || aviso === 'sin_correo' ? aviso : 'no_enviado' }
    }
    const lista: unknown = typeof d === 'object' && d !== null ? Reflect.get(d, 'empalmes') : null
    if (res.status === 409 && leerTexto(d, 'error') === 'empalme' && esListaDeEmpalmes(lista)) return { tipo: 'empalme', lista }
    return { tipo: 'error', mensaje: leerTexto(d, 'message') || 'No se pudo reagendar la cita.' }
  } catch {
    return { tipo: 'error', mensaje: 'No se pudo reagendar la cita. Revisa la conexión.' }
  }
}

interface Props {
  cita: Appointment
  /** Los consultorios del médico de la cita (los mismos del formulario). */
  consultorios: ReadonlyArray<{ id: string; nombre: string }>
  /** Reagendada y vista la respuesta: la página vuelve a traer la agenda y cierra. */
  alTerminar: () => void
  alVolver: () => void
  /** L1 · ¿El tramo nuevo toca un bloqueo pintado de ese médico? (el mismo `buscarBloqueo` del formulario; sólo con la v2). */
  buscarBloqueo?: (inicio: Date, fin: Date, medicoId: string) => boolean
}

export default function PanelReagendar({ cita, consultorios, alTerminar, alVolver, buscarBloqueo }: Props): ReactElement {
  const inicial = partirFechaHora(cita.start_time)
  const [consultorioId, setConsultorioId] = useState(cita.consultorio_id ?? '')
  const [fecha, setFecha] = useState(inicial.fecha)
  const [hora, setHora] = useState(inicial.hora)
  const [fase, setFase] = useState<Fase>({ tipo: 'datos', error: null })
  const conCorreo = correoParaConfirmacion(cita.pacientes?.email, cita.reserva_correo) !== null
  const duracion = new Date(cita.end_time).getTime() - new Date(cita.start_time).getTime()

  function revisar(): void {
    if (!consultorioId || !fecha || !hora) { setFase({ tipo: 'datos', error: 'Elige consultorio, día y hora.' }); return }
    const inicio = new Date(componerIso(fecha, hora)).getTime()
    if (inicio === new Date(cita.start_time).getTime() && consultorioId === cita.consultorio_id) {
      setFase({ tipo: 'datos', error: 'No cambiaste el consultorio, el día ni la hora.' }); return
    }
    if (inicio <= Date.now()) { setFase({ tipo: 'datos', error: 'La hora nueva ya pasó.' }); return }
    const enBloqueo = Boolean(cita.medico_id && buscarBloqueo?.(new Date(inicio), new Date(inicio + duracion), cita.medico_id))
    setFase(enBloqueo ? { tipo: 'datos', error: TEXTO_HORARIO_BLOQUEADO } : { tipo: 'confirmar' })
  }

  async function enviar(aceptados: string[]): Promise<void> {
    setFase({ tipo: 'enviando' })
    const inicio = componerIso(fecha, hora)
    const r = await pedirReagendar(cita.id, {
      consultorio_id: consultorioId, start_time: inicio, end_time: new Date(new Date(inicio).getTime() + duracion).toISOString(),
      updated_at: cita.updated_at ?? null, ...(aceptados.length ? { empalmes_aceptados: aceptados } : {}),
    })
    if (r.tipo === 'ok') setFase({ tipo: 'hecho', aviso: r.aviso })
    else if (r.tipo === 'empalme') setFase({ tipo: 'empalme', lista: r.lista, aceptados })
    else setFase({ tipo: 'datos', error: r.mensaje })
  }

  return (
    <div data-testid="panel-reagendar" className="rounded-2xl bg-fondo p-4 flex flex-col gap-3">
      {fase.tipo === 'hecho'
        ? <Hecho cita={cita} aviso={fase.aviso} alTerminar={alTerminar} />
        : <>
            <CamposReagendar consultorios={consultorios} consultorioId={consultorioId} fecha={fecha} hora={hora}
              bloqueado={fase.tipo !== 'datos'} setConsultorioId={setConsultorioId} setFecha={setFecha} setHora={setHora} />
            <p className="text-[13px] leading-[18px] text-tinta2">
              {conCorreo ? TEXTO_REAGENDAR.conCorreo : TEXTO_REAGENDAR.sinCorreo}
            </p>
            <Pasos fase={fase} revisar={revisar} alVolver={alVolver} confirmar={() => void enviar([])}
              aceptar={(lista, previos) => void enviar([...previos, ...lista.map(e => e.id)])} corregir={() => setFase({ tipo: 'datos', error: null })} />
          </>}
    </div>
  )
}

interface PropsCampos {
  consultorios: ReadonlyArray<{ id: string; nombre: string }>
  consultorioId: string; fecha: string; hora: string; bloqueado: boolean
  setConsultorioId: (v: string) => void; setFecha: (v: string) => void; setHora: (v: string) => void
}

function CamposReagendar(p: PropsCampos): ReactElement {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <label htmlFor="reagendar-consultorio" className={CLASE_ETIQUETA} style={{ color: 'var(--tinta2)' }}>Consultorio nuevo</label>
        <select id="reagendar-consultorio" value={p.consultorioId} disabled={p.bloqueado} onChange={e => p.setConsultorioId(e.target.value)} className={CLASE_CAMPO}>
          {p.consultorios.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="reagendar-fecha" className={CLASE_ETIQUETA} style={{ color: 'var(--tinta2)' }}>Día nuevo</label>
        <input id="reagendar-fecha" type="date" autoFocus value={p.fecha} disabled={p.bloqueado} onChange={e => p.setFecha(e.target.value)} className={CLASE_CAMPO} />
      </div>
      <div>
        <label htmlFor="reagendar-hora" className={CLASE_ETIQUETA} style={{ color: 'var(--tinta2)' }}>Hora nueva</label>
        <input id="reagendar-hora" type="time" step={900} value={p.hora} disabled={p.bloqueado} onChange={e => p.setHora(e.target.value)} className={CLASE_CAMPO} />
      </div>
    </div>
  )
}

interface PropsPasos {
  fase: Exclude<Fase, { tipo: 'hecho' }>
  revisar: () => void; alVolver: () => void; confirmar: () => void
  /** Los empalmes nuevos y los ya aceptados: viajan juntos, como el reintento del PUT. */
  aceptar: (lista: Empalme[], previos: string[]) => void; corregir: () => void
}

function Pasos({ fase, revisar, alVolver, confirmar, aceptar, corregir }: PropsPasos): ReactElement {
  if (fase.tipo === 'datos') {
    return (
      <>
        {fase.error && <p role="alert" className="text-[13px] leading-[18px] font-semibold text-mal-tinta">{fase.error}</p>}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={alVolver} className={CLASE_BOTON}>Volver</button>
          <button type="button" onClick={revisar} className={CLASE_PRIMARIO}>Revisar cambio</button>
        </div>
      </>
    )
  }
  const texto = fase.tipo === 'empalme' ? mensajeEmpalme(fase.lista).replace('¿Guardar de todos modos?', '¿Reagendar de todos modos?')
    : '¿Reagendar la cita con estos datos? El paciente eligió los anteriores al reservar.'
  return (
    <>
      <p role="alert" className="text-sm font-semibold text-tinta">{texto}</p>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={corregir} disabled={fase.tipo === 'enviando'} className={CLASE_BOTON}>Corregir</button>
        <button type="button" disabled={fase.tipo === 'enviando'} className={CLASE_PRIMARIO}
          onClick={() => (fase.tipo === 'empalme' ? aceptar(fase.lista, fase.aceptados) : confirmar())}>
          {fase.tipo === 'enviando' ? 'Reagendando…' : 'Sí, reagendar y avisar'}
        </button>
      </div>
    </>
  )
}

function Hecho({ cita, aviso, alTerminar }: { cita: Appointment; aviso: Aviso; alTerminar: () => void }): ReactElement {
  return (
    <>
      <p role="status" className="text-sm font-semibold text-tinta">{TEXTO_REAGENDAR[aviso]}</p>
      {aviso !== 'enviado' && (
        <BotonWhatsAppCita citaId={cita.id} tipo="enlace" marcadoEn={null} confirmada={cita.status === 'confirmed'} />
      )}
      <div className="flex justify-end">
        <button type="button" onClick={alTerminar} className={CLASE_BOTON}>Cerrar</button>
      </div>
    </>
  )
}
