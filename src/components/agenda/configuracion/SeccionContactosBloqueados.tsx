'use client'

/**
 * La lista de contactos bloqueados de la reserva por enlace (candado de §2; la
 * parte de D2 que quedó pendiente), con el desbloqueo manual. Un contacto
 * bloqueado no puede reservar por el enlace FIJO de ese médico (el de un solo
 * uso se salta el candado). Se levanta solo al pasar la ventana, o aquí.
 *
 * Cada médico ve los de sus citas; administrador y secretaria, los de todos
 * (lista A, punto 16): lo decide el servidor. Límite conocido de D2: un
 * bloqueo MANUAL de alguien sin citas recientes sigue bloqueando pero no sale
 * en esta lista.
 */
import { useCallback, useEffect, useState } from 'react'
import { leerMotivoError } from '@/components/agenda/configuracion/leerMotivoError'
import TarjetaSeccion from '@/components/agenda/configuracion/TarjetaSeccion'
import { BOTON_FILA, TEXTO_SUAVE } from '@/components/agenda/configuracion/clasesConfig'
import { frasearHistorial, type ContactoBloqueado } from '@/lib/reserva/gestionReserva'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import { useToast } from '@/components/ui/Toast'
import type { MedicoConfig } from '@/lib/configApp'

const FECHA = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' })
const BOTON = BOTON_FILA

/** Por qué está bloqueado, en una frase. */
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

interface Props { medicos: readonly MedicoConfig[]; gestionaTodos: boolean }

export default function SeccionContactosBloqueados({ medicos, gestionaTodos }: Props) {
  const toast = useToast()
  const [contactos, setContactos] = useState<ContactoBloqueado[] | 'error' | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const recargar = useCallback(async (): Promise<void> => { setContactos((await leerContactos()) ?? 'error') }, [])
  useEffect(() => {
    let vivo = true
    void leerContactos().then(l => { if (vivo) setContactos(l ?? 'error') })
    return () => { vivo = false }
  }, [])
  const nombreMedico = (id: string) => {
    const m = medicos.find(x => x.id === id)
    return m ? componerNombreMedicoCompleto(m) : 'Un médico'
  }
  async function desbloquear(c: ContactoBloqueado): Promise<void> {
    setOcupado(c.cita_id)
    try {
      const res = await fetch('/api/agenda/reservas/contactos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cita_id: c.cita_id, accion: 'desbloquear' }),
      })
      if (res.ok) toast.success('Contacto desbloqueado')
      else toast.error(await leerMotivoError(res, 'No se pudo desbloquear'))
    } catch {
      toast.error('No se pudo desbloquear')
    }
    setOcupado(null)
    await recargar()
  }
  return (
    <TarjetaSeccion id="config-bloqueados" titulo="Contactos bloqueados"
      ayuda="Quien cancela o falta seguido deja de poder reservar por el enlace fijo; tendrá que llamar al consultorio.">
      {contactos === null ? <p className={TEXTO_SUAVE}>Cargando…</p>
        : contactos === 'error' ? <p className={TEXTO_SUAVE}>No se pudo leer la lista. Recarga la página.</p>
        : contactos.length === 0 ? <p className={TEXTO_SUAVE}>No hay contactos bloqueados.</p>
        : (
          <ul className="divide-y divide-[var(--ag-border-card)]">
            {contactos.map(c => (
              <li key={`${c.medico_id}:${c.cita_id}`} className="flex flex-wrap items-center gap-x-[var(--ag-3)] gap-y-[var(--ag-1)] py-[var(--ag-2)]">
                <span className="text-sm font-medium text-[var(--ag-text)]">{c.nombre ?? 'Sin nombre'}</span>
                <span className="text-sm text-[var(--ag-muted)]">{[c.telefono, c.correo].filter(Boolean).join(' · ')}</span>
                {gestionaTodos && <span className="text-sm text-[var(--ag-muted)]">· {nombreMedico(c.medico_id)}</span>}
                <span className="text-sm text-[var(--ag-muted)] w-full">{motivo(c)}</span>
                <button type="button" className={`${BOTON} ml-auto`} disabled={ocupado !== null}
                  onClick={() => void desbloquear(c)} aria-label={`Desbloquear a ${c.nombre ?? 'este contacto'}`}>Desbloquear</button>
              </li>
            ))}
          </ul>
        )}
    </TarjetaSeccion>
  )
}
