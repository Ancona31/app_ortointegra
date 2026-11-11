'use client'

import { ChevronsDownUp, Settings } from 'lucide-react'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
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

/* La tercera fila de la banda: filtro de médico y engrane de horario.

   ⚠️ ES UN COMPONENTE APARTE POR TAMAÑO, NO POR REUTILIZACIÓN — sólo lo usa la
   banda. `BandaMovil` con esta fila dentro medía 63 líneas y el proyecto tiene
   el tope en 50; la fila de los filtros es el trozo más autocontenido y el único
   con condiciones propias, así que es el que sale.

   ⚠️ SE PARTIÓ EN DOS EN EL PASO 9b, y sigue siendo por tamaño y no por
   reutilización: la fila entera —flechas incluidas— pasaba de las 50 líneas de
   tope. `NavegacionBandaMovil` es la fila; esto es lo que va en su centro.

   ⚠️ Y YA NO DEVUELVE `null` PARA AHORRAR LA FILA. Devolvía `null` en una clínica
   de un solo médico sin permiso de horario, y con ello se ahorraban 56 px. Hoy
   la fila lleva además las DOS FLECHAS DE NAVEGACIÓN, que no son opcionales en
   ninguna clínica —sin ellas no hay forma de cambiar de día, de semana ni de
   mes—, así que la fila se pinta siempre y este centro puede quedarse vacío. La
   caja sigue existiendo aunque no tenga hijos: es el muelle que empuja la flecha
   derecha contra el borde. Ver su nota en globals.css. */
export function FiltrosBandaMovil(
  { medicos, filtroMedico, onFiltroMedico, onHorario, onCompactar, compactado, mesSinTodos }: {
    medicos: readonly Medico[]; filtroMedico: string
    onFiltroMedico: (id: string) => void; onHorario: (() => void) | null
    onCompactar: (() => void) | null; compactado: boolean
    /** En Mes, «Todos» se apaga. Ver `OPCION_TODOS` y la nota del desplegable
        de escritorio, que es el mismo control con otra caja. */
    mesSinTodos: boolean
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
          aria-label="Ocultar los días de la semana sin actividad">
          <ChevronsDownUp size={18} />
        </button>
      )}
      {onHorario && (
        <button type="button" className="ag-banda-movil-ctrl ag-banda-movil-ctrl--marco"
          onClick={onHorario} aria-label="Configurar horario de consulta">
          <Settings size={18} />
        </button>
      )}
    </div>
  )
}
