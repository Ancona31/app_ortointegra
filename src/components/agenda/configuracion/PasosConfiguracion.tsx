/**
 * «Para empezar» (tanda T2, punto 7): tres pasos con su estado —horario y
 * disponibilidad, tipos de cita, enlace de reserva— para el médico que mira la
 * pantalla, cada uno con el enlace a su sección. No es un asistente: es una
 * lista que se ve mientras falte algo y desaparece sola al completarse.
 *
 * ⚠️ EL ESTADO SE CALCULA DE LOS DATOS, NO SE GUARDA. Los dos primeros pasos
 * salen de `preparacion` (la misma regla con la que la página pública decide
 * si un enlace abre: `motivosApertura`), y el tercero de la lista de enlaces
 * vigentes. «Retomarla si se deja a medias» es consecuencia de eso: al volver
 * se calcula otra vez. No hay marca de «ya la vi» que borrar ni que migrar.
 *
 * Sólo para médicos (dueño o invitado): la secretaria no tiene enlace propio.
 */
import { Check, Circle } from 'lucide-react'
import type { ListaEnlaces } from '@/components/agenda/configuracion/listaEnlaces'

interface Paso { titulo: string; hecho: boolean; ayuda: string; destino: string }

/** Los tres pasos de `medicoId`, o `null` si no hay datos para decidir. */
export function pasosDe(lista: ListaEnlaces, medicoId: string, puedeCrearTipos: boolean): Paso[] | null {
  const motivos = lista.preparacion?.[medicoId]
  if (!motivos) return null
  return [
    {
      titulo: 'Horario y disponibilidad',
      hecho: !motivos.includes('sin_consultorio') && !motivos.includes('sin_disponibilidad'),
      ayuda: motivos.includes('sin_consultorio') ? 'Da de alta un consultorio en tu perfil.' : 'Abre al menos un día en tu consultorio.',
      destino: motivos.includes('sin_consultorio') ? '/perfil' : '#config-disponibilidad',
    },
    {
      titulo: 'Tipos de cita',
      hecho: !motivos.includes('sin_tipos'),
      ayuda: puedeCrearTipos ? 'Crea al menos uno; «Consulta, 30 min» basta.' : 'Pídele a quien administra la clínica que cree uno.',
      destino: '#config-tipos',
    },
    {
      titulo: 'Enlace de reserva',
      hecho: lista.enlaces.some(e => e.medico_id === medicoId),
      ayuda: 'Crea tu enlace fijo para compartirlo con tus pacientes.',
      destino: '#config-enlaces',
    },
  ]
}

export default function PasosConfiguracion({ pasos }: { pasos: Paso[] }) {
  const hechos = pasos.filter(p => p.hecho).length
  return (
    <section aria-labelledby="config-pasos"
      className="rounded-[var(--ag-r-card)] border border-[var(--ag-border-card)] bg-[var(--ag-primary-bg-faint)] p-[var(--ag-5)] flex flex-col gap-[var(--ag-3)]">
      <div className="flex items-baseline justify-between gap-[var(--ag-3)]">
        <h2 id="config-pasos" className="text-base font-semibold text-[var(--ag-text)]">Para empezar</h2>
        <span className="text-sm text-[var(--ag-muted)] tabular-nums">{hechos} de {pasos.length}</span>
      </div>
      <ol className="flex flex-col gap-[var(--ag-2)]">
        {pasos.map(p => (
          <li key={p.titulo} className="flex items-start gap-[var(--ag-3)]" aria-label={`${p.titulo}: ${p.hecho ? 'hecho' : 'pendiente'}`}>
            <span aria-hidden="true" className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${p.hecho ? 'bg-[var(--ag-success-bg)] text-[var(--ag-success-text)]' : 'text-[var(--ag-muted)]'}`}>
              {p.hecho ? <Check size={14} strokeWidth={3} /> : <Circle size={16} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${p.hecho ? 'text-[var(--ag-muted)]' : 'text-[var(--ag-text)]'}`}>
                {p.titulo} <span className="font-normal text-[var(--ag-muted)]">· {p.hecho ? 'Hecho' : 'Pendiente'}</span>
              </p>
              {!p.hecho && (
                <p className="text-sm text-[var(--ag-muted)]">
                  {p.ayuda} <a href={p.destino} aria-label={`Ir a ${p.titulo}`} className="font-medium text-[var(--ag-text)] underline underline-offset-2">Ir</a>
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
