'use client'

/**
 * Pestaña «Más opciones» (tanda J, J5, punto 14; maqueta
 * `Configuracion.dc.html`): SÓLO «Personas bloqueadas» y «Empezar de nuevo».
 * «Esta computadora» no existe (punto 18: la preferencia se va al engrane).
 *
 *   · «Personas bloqueadas»: la lista de contactos bloqueados de la reserva por
 *     enlace con «Desbloquear» (`/api/agenda/reservas/contactos`, la ruta de
 *     siempre; el servidor decide de quién ve cada uno). En la maqueta es una
 *     fila que lleva a otra parte; aquí despliega la lista en su sitio.
 *     Copia de la lectura y del desbloqueo de `SeccionContactosBloqueados`,
 *     que se queda en la pantalla vieja.
 *   · «Empezar de nuevo» (punto 17): es «Restablecer» de la tanda H, con el
 *     MISMO diálogo (`ConfirmacionRestablecer`) y sólo para quien administra
 *     la clínica. Al terminar, `alEmpezarDeNuevo` lleva al funnel.
 */
import { useCallback, useEffect, useId, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import ConfirmacionRestablecer from '@/components/agenda/configuracion/ConfirmacionRestablecer'
import { leerMotivoError } from '@/components/agenda/configuracion/leerMotivoError'
import type { Avisar } from '@/components/agenda/configuracion/estadoAvisos'
import { AYUDA, BOTON_TEXTO, PANEL } from '@/components/agenda/configuracion/estilosConfig'
import { frasearHistorial, type ContactoBloqueado } from '@/lib/reserva/gestionReserva'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import type { MedicoConfig } from '@/lib/configApp'

const FECHA = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' })

function motivo(c: ContactoBloqueado): string {
  const historial = frasearHistorial(c.cancelaciones, c.no_shows)
  if (c.manual) return historial ? `Bloqueado a mano · ${historial}` : 'Bloqueado a mano'
  return `${historial ?? 'Incidencias'}${c.hasta ? ` · se levanta solo el ${FECHA.format(new Date(c.hasta))}` : ''}`
}

async function leerContactos(): Promise<ContactoBloqueado[] | null> {
  try {
    const res = await fetch('/api/agenda/reservas/contactos', { cache: 'no-store' })
    if (!res.ok) return null
    const json: unknown = await res.json()
    return json && typeof json === 'object' && 'contactos' in json && Array.isArray(json.contactos) ? json.contactos : null
  } catch {
    return null
  }
}

async function desbloquear(c: ContactoBloqueado): Promise<{ ok: true } | { ok: false; motivo: string }> {
  try {
    const res = await fetch('/api/agenda/reservas/contactos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cita_id: c.cita_id, accion: 'desbloquear' }),
    })
    return res.ok ? { ok: true } : { ok: false, motivo: await leerMotivoError(res, 'No se pudo desbloquear') }
  } catch {
    return { ok: false, motivo: 'No se pudo desbloquear' }
  }
}

interface Props {
  conEnlaces: boolean
  medicos: readonly MedicoConfig[]
  gestionaTodos: boolean
  puedeAdministrar: boolean
  avisar: Avisar
  alEmpezarDeNuevo: () => void
}

const FILA = 'flex w-full min-h-[44px] sm:min-h-[40px] cursor-pointer items-center justify-between gap-[16px] sm:gap-[14px] border-0 border-b border-[var(--ag-hairline)] bg-transparent py-[18px] sm:py-[16px] text-left text-[var(--ag-ink)]'

function TextoFila({ titulo, ayuda }: { titulo: string; ayuda: string }) {
  return (
    <span className="flex flex-[1_1_360px] flex-col gap-[4px]">
      <span className="text-[15px] sm:text-[14px] font-semibold">{titulo}</span>
      <span className={AYUDA}>{ayuda}</span>
    </span>
  )
}

function Bloqueados({ p }: { p: Props }) {
  const id = useId()
  const [abierto, setAbierto] = useState(false)
  const [contactos, setContactos] = useState<ContactoBloqueado[] | 'error' | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const recargar = useCallback(async () => { setContactos((await leerContactos()) ?? 'error') }, [])
  useEffect(() => {
    let vivo = true
    void leerContactos().then(l => { if (vivo) setContactos(l ?? 'error') })
    return () => { vivo = false }
  }, [])
  const ahora = contactos === null ? '…' : contactos === 'error' ? 'no se pudo leer' : contactos.length === 0 ? 'ninguno' : String(contactos.length)
  const nombreMedico = (mid: string) => { const m = p.medicos.find(x => x.id === mid); return m ? componerNombreMedicoCompleto(m) : 'Un médico' }
  async function quitar(c: ContactoBloqueado): Promise<void> {
    setOcupado(true)
    p.avisar(await desbloquear(c))
    setOcupado(false)
    await recargar()
  }
  return (
    <div>
      <button type="button" className={FILA} aria-expanded={abierto} aria-controls={id} onClick={() => setAbierto(a => !a)}>
        <TextoFila titulo="Personas bloqueadas" ayuda={`Teléfonos o correos que no pueden apartar cita con tu enlace. Ahora: ${ahora}.`} />
        <ChevronRight size={20} aria-hidden="true" className={`flex-none text-[var(--ag-ink-600)] transition-transform duration-[var(--ag-dur-micro)] motion-reduce:transition-none ${abierto ? 'rotate-90' : ''}`} />
      </button>
      <div id={id} hidden={!abierto} className="flex flex-col gap-[8px] py-[12px]">
        {contactos === 'error' && <p className={AYUDA}>No se pudo leer la lista. Recarga la página.</p>}
        {Array.isArray(contactos) && contactos.length === 0 && <p className={AYUDA}>Nadie está bloqueado.</p>}
        {Array.isArray(contactos) && contactos.map(c => (
          <div key={`${c.medico_id}:${c.cita_id}`} className="flex flex-wrap items-center justify-between gap-[12px] rounded-[10px] bg-[var(--ag-surface-sunken)] px-[16px] sm:px-[14px] py-[12px]">
            <span className="flex flex-col gap-[2px] text-[14px] text-[var(--ag-ink)]">
              <strong>{c.nombre ?? 'Sin nombre'}</strong>
              <span className="text-[13.5px] sm:text-[13px] text-[var(--ag-ink-600)]">{[c.telefono, c.correo, p.gestionaTodos ? nombreMedico(c.medico_id) : null].filter(Boolean).join(' · ')}</span>
              <span className="text-[13.5px] sm:text-[13px] text-[var(--ag-ink-600)]">{motivo(c)}</span>
            </span>
            <button type="button" className={BOTON_TEXTO} disabled={ocupado} onClick={() => void quitar(c)} aria-label={`Desbloquear a ${c.nombre ?? 'este contacto'}`}>Desbloquear</button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PestanaMasOpciones(p: Props) {
  const [confirmando, setConfirmando] = useState(false)
  return (
    <div className={`${PANEL} gap-0 py-[8px] sm:py-[8px]`}>
      {p.conEnlaces && <Bloqueados p={p} />}
      {p.puedeAdministrar && (
        <button type="button" className={`${FILA} border-b-0`} onClick={() => setConfirmando(true)}>
          <TextoFila titulo="Empezar de nuevo" ayuda="Regresa todo a como venía y vuelve a hacer las 3 preguntas. Tus citas no se borran." />
          <ChevronRight size={20} aria-hidden="true" className="flex-none text-[var(--ag-ink-600)]" />
        </button>
      )}
      {!p.conEnlaces && !p.puedeAdministrar && <p className={`${AYUDA} py-[18px] sm:py-[16px]`}>No hay más opciones para tu cuenta.</p>}
      {confirmando && <ConfirmacionRestablecer onCancelar={() => setConfirmando(false)} onHecho={() => { setConfirmando(false); p.alEmpezarDeNuevo() }} />}
    </div>
  )
}
