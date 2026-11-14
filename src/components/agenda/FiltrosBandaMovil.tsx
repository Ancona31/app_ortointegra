'use client'

import { ChevronsDownUp, Settings } from 'lucide-react'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import { etiquetaCompactar } from '@/lib/agenda/vistasAgenda'
import type { Medico } from '@/components/agenda/AppointmentModal'

/* El rótulo de «Todos los médicos», que en Mes lleva pegado su motivo.
 *
 * ⚠️ LA NOTA VA DENTRO DEL PROPIO `<option>` Y NO AL LADO, y no es una
 * preferencia: un `<option>` deshabilitado no admite texto de ayuda propio —no
 * hay dónde colgarlo— y el desplegable nativo no pinta nada que no sea una
 * opción. Fuera del `<select>` tampoco sirve: en escritorio la fila del header
 * ya envuelve a dos líneas en anchos de portátil (ver el tope de 240 px), y en
 * la banda móvil no hay ni sitio.
 *
 * ⚠️ Y LA OPCIÓN SE APAGA, NO SE ESCONDE. Esconderla cambiaría el CONTENIDO del
 * desplegable al cambiar de vista, y un control cuya lista se encoge sola
 * desorienta más que uno con un elemento en gris. Es la misma disciplina que el
 * resto de la agenda: se dice lo que pasa, no se retira.
 *
 * El registro es el de las bandas: una frase corta, en presente, sin disculpas. */
export const OPCION_TODOS = (enElMes: boolean): string =>
  enElMes ? 'Todos los médicos — el mes se ve por médico' : 'Todos los médicos'

/* La segunda fila de la banda, a la derecha del conmutador (F1.15): filtro de
   médico, «Compactar» y engrane de horario.

   ⚠️ ES UN COMPONENTE APARTE POR TAMAÑO, NO POR REUTILIZACIÓN — sólo lo usa la
   banda (tope de 50 líneas por función).

   ⚠️ EL FILTRO ES LO QUE CEDE ANCHO (`flex: 1 1 0; min-width: 0` en
   globals.css): el conmutador tiene ancho fijo y los botones 44 px. La caja
   existe aunque no tenga hijos —clínica de un médico sin engrane— y entonces
   sólo ocupa el hueco sobrante de la fila. */
export function FiltrosBandaMovil(
  { medicos, filtroMedico, onFiltroMedico, onHorario, onCompactar, compactado, mesSinTodos, vista, engraneConfiguracion = false }: {
    medicos: readonly Medico[]; filtroMedico: string
    onFiltroMedico: (id: string) => void; onHorario: (() => void) | null
    /** T3 · Con la v2 el engrane abre la configuración de la agenda y se nombra así. */
    engraneConfiguracion?: boolean
    onCompactar: (() => void) | null; compactado: boolean
    /** En Mes, «Todos» se apaga. Ver `OPCION_TODOS` y la nota del desplegable
        de escritorio, que es el mismo control con otra caja. */
    mesSinTodos: boolean
    /** F1.16 · La vista, para el rótulo de «Compactar»: en el teléfono sólo
        salía en Mes, y en la tableta también sale en la rejilla de horas. */
    vista: string
  },
) {
  /* Mismo criterio que el header de escritorio: el filtro sólo tiene sentido en
     modo multi-doctor, el engrane sólo si se puede editar el horario y
     «Compactar» sólo donde la vista lo admite. Los tres pueden faltar a la vez. */
  const hayFiltro = medicos.length > 1
  return (
    <div className="ag-banda-movil-medio">
      {hayFiltro && (
        <label>
          <span className="sr-only">Filtrar por médico</span>
          <select value={filtroMedico} onChange={e => onFiltroMedico(e.target.value)}>
            <option value="" disabled={mesSinTodos}>{OPCION_TODOS(mesSinTodos)}</option>
            {medicos.map(m => <option key={m.id} value={m.id}>{componerNombreMedicoCompleto(m)}</option>)}
          </select>
        </label>
      )}
      {onCompactar && (
        /* Mismo criterio de encendido que en escritorio: el estado se dice con el
           MARCO, no con relleno — el único relleno blanco de la banda es la
           pestaña activa del conmutador y no puede tener competencia. */
        <button type="button"
          className={`ag-banda-movil-ctrl ag-banda-movil-ctrl--marco${compactado ? ' ag-banda-movil-ctrl--on' : ''}`}
          onClick={onCompactar} aria-pressed={compactado}
          aria-label={etiquetaCompactar(vista)}>
          <ChevronsDownUp size={18} />
        </button>
      )}
      {onHorario && (
        <button type="button" className="ag-banda-movil-ctrl ag-banda-movil-ctrl--marco"
          onClick={onHorario}
          aria-label={engraneConfiguracion ? 'Configuración de la agenda' : 'Configurar horario de consulta'}
          title={engraneConfiguracion ? 'Configuración de la agenda' : undefined}>
          <Settings size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
