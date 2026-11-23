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
 *
 * B13 · AG9 (rediseño, maqueta `ag-config`): dos filas de navegación en UNA superficie, con icono de 22 a la
 * izquierda (azul; rojo la de «Empezar de nuevo»), título 15/600, ayuda 13 y «›» tenue que gira al desplegar.
 * Quien no administra ve «Empezar de nuevo» en gris, sin flecha ni toque, con la nota encima.
 */
import { useCallback, useEffect, useId, useState } from 'react'
import { Ban, ChevronRight, RotateCcw } from 'lucide-react'
import ConfirmacionRestablecer from '@/components/agenda/configuracion/ConfirmacionRestablecer'
import { leerMotivoError } from '@/components/agenda/configuracion/leerMotivoError'
import type { Avisar } from '@/components/agenda/configuracion/estadoAvisos'
import { AVISO_EN_LISTA, AVISO_SOLO_ADMIN, AYUDA, BOTON_TEXTO, FILA_GRIS, LISTA, SOLO_ADMIN } from '@/components/agenda/configuracion/estilosConfig'
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

/** Fila de navegación: 64 en el teléfono, 60 en ancho. */
const FILA = 'flex min-h-[64px] w-full items-center gap-[14px] border-0 bg-transparent px-[16px] py-[12px] text-left text-tinta ih:min-h-[60px] iv:min-h-[60px] esc:min-h-[60px] ih:px-[20px] iv:px-[20px] esc:px-[20px]'
const CHEV = 'flex-none text-tinta3 transition-transform duration-[var(--dur-toque)] motion-reduce:transition-none'

function TextoFila({ titulo, ayuda, tono = 'text-tinta' }: { titulo: string; ayuda: string; tono?: string }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
      <span className={`text-[15px] font-semibold leading-[20px] ${tono}`}>{titulo}</span>
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
    <>
      <button type="button" className={`${FILA} cursor-pointer`} aria-expanded={abierto} aria-controls={id} onClick={() => setAbierto(a => !a)}>
        <Ban size={22} strokeWidth={2} aria-hidden="true" className="flex-none text-enlace" />
        <TextoFila titulo="Personas bloqueadas" ayuda={`Teléfonos o correos que no pueden apartar cita con tu enlace. Ahora: ${ahora}.`} />
        <ChevronRight size={18} aria-hidden="true" className={`${CHEV} ${abierto ? 'rotate-90' : ''}`} />
      </button>
      <div id={id} hidden={!abierto} className="flex flex-col pb-[4px] [&>*+*]:border-t [&>*+*]:border-linea">
        {contactos === 'error' && <p className={`${FILA_GRIS} m-0 ${AYUDA}`}>No se pudo leer la lista. Recarga la página.</p>}
        {Array.isArray(contactos) && contactos.length === 0 && <p className={`${FILA_GRIS} m-0 ${AYUDA}`}>Nadie está bloqueado.</p>}
        {Array.isArray(contactos) && contactos.map(c => (
          <div key={`${c.medico_id}:${c.cita_id}`} className={FILA_GRIS}>
            <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-[2px]">
              <strong className="text-[15px] font-semibold leading-[20px] text-tinta">{c.nombre ?? 'Sin nombre'}</strong>
              <span className={AYUDA}>{[c.telefono, c.correo, p.gestionaTodos ? nombreMedico(c.medico_id) : null].filter(Boolean).join(' · ')}</span>
              <span className={AYUDA}>{motivo(c)}</span>
            </span>
            <button type="button" className={BOTON_TEXTO} disabled={ocupado} onClick={() => void quitar(c)} aria-label={`Desbloquear a ${c.nombre ?? 'este contacto'}`}>Desbloquear</button>
          </div>
        ))}
      </div>
    </>
  )
}

export default function PestanaMasOpciones(p: Props) {
  const [confirmando, setConfirmando] = useState(false)
  return (
    <div className={LISTA}>
      {p.conEnlaces && <Bloqueados p={p} />}
      {p.puedeAdministrar && (
        <button type="button" className={`${FILA} cursor-pointer`} onClick={() => setConfirmando(true)}>
          <RotateCcw size={22} strokeWidth={2} aria-hidden="true" className="flex-none text-mal-tinta" />
          <TextoFila titulo="Empezar de nuevo" tono="text-mal-tinta" ayuda="Regresa todo a como venía y vuelve a hacer las 3 preguntas. Tus citas no se borran." />
          <ChevronRight size={18} aria-hidden="true" className={CHEV} />
        </button>
      )}
      {/* Tanda M (punto 15): quien no administra no puede «Empezar de nuevo» (`POST /api/agenda/restablecer`: 403). Lo ve sin
          botón y con el aviso encima; el aviso no va arriba de la pestaña porque «Personas bloqueadas» sí lo gestiona. */}
      {!p.puedeAdministrar && (
        <div data-empezar-sin-permiso className="flex flex-col">
          <p data-solo-admin className={`${AVISO_SOLO_ADMIN} ${AVISO_EN_LISTA}`}>{SOLO_ADMIN}</p>
          <div className={`${FILA} pt-0`}>
            <RotateCcw size={22} strokeWidth={2} aria-hidden="true" className="flex-none text-tinta3" />
            <TextoFila titulo="Empezar de nuevo" tono="text-tinta2" ayuda="Regresa todo a como venía y vuelve a hacer las 3 preguntas. Tus citas no se borran." />
          </div>
        </div>
      )}
      {confirmando && <ConfirmacionRestablecer onCancelar={() => setConfirmando(false)} onHecho={() => { setConfirmando(false); p.alEmpezarDeNuevo() }} />}
    </div>
  )
}
