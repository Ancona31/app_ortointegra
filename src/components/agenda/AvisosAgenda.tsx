/**
 * src/components/agenda/AvisosAgenda.tsx
 *
 * Las cuatro bandas de `.ag-avisos`, en su orden de prioridad: la barra de
 * carga, el error de traída, la traída incompleta, el fallo de Google, el
 * vacío y la vista compacta. Movido tal cual desde `AgendaCliente.tsx`
 * (A2.5.10, movimiento puro, con sus comentarios); sólo cambiaron los
 * nombres que eran estado o manejadores del padre, que ahora llegan por
 * props.
 *
 * ⚠️ MISMO ELEMENTO RAÍZ, SIN NODOS DE MÁS: el `<div className="ag-avisos">`
 * de abajo es exactamente el que pintaba `AgendaCliente.tsx` — es un área de
 * rejilla de `.agenda-fc` en `globals.css`, y se monta SIEMPRE, también sin
 * ninguna banda (le sirve de ancla a la barra de carga).
 *
 * ⚠️ `onAgendar` NO SE FUNDE con el de `CabeceraEscritorio` ni con el de
 * `BarraAgendarMovil`, aunque el cuerpo que arma el padre sea idéntico: el
 * plan A2.5 deja los 3 onClick de «Agendar» como cierres separados a
 * propósito.
 */

import Link from 'next/link'
import { Calendar, ChevronsDownUp, TriangleAlert } from 'lucide-react'
import { Banda } from '@/components/agenda/Banda'
import { GoogleGIcon } from '@/components/agenda/GoogleGIcon'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import type { MedicoConfig } from '@/lib/configApp'

interface Props {
  cargaVisible: boolean
  errorCitas: boolean
  onReintentar: () => void
  citasIncompletas: boolean
  currentView: string
  onVerPorSemana: () => void
  googleFallo: boolean
  vacioReal: boolean
  vacioFiltrado: boolean
  medicoFiltrado: MedicoConfig | undefined
  periodoVacio: string
  mesSinTodos: boolean
  onVerTodos: () => void
  onAgendar: () => void
  avisoRecorte: string | null
  compactaElMes: boolean
  onSalirCompacta: () => void
}

export function AvisosAgenda({
  cargaVisible, errorCitas, onReintentar, citasIncompletas, currentView, onVerPorSemana,
  googleFallo, vacioReal, vacioFiltrado, medicoFiltrado, periodoVacio, mesSinTodos, onVerTodos,
  onAgendar, avisoRecorte, compactaElMes, onSalirCompacta,
}: Props) {
  return (
    <div className="ag-avisos">
      {/* La barra de 2 px de §11. Cae justo ENCIMA de la rejilla y no pegada
          al toolbar, y es consecuencia de dónde vive el envoltorio: entre
          medias está la fila de la leyenda, que es cromo de la tarjeta desde
          el bloque 8. Marca el borde de lo que está cargando, que es lo que
          se quería decir.
          `aria-hidden` porque una raya no se lee; lo que declara el estado a
          las ayudas técnicas es el `aria-busy` de la tarjeta. */}
      {cargaVisible && <span className="ag-barra-carga" aria-hidden />}

      {/* 1 · Error de carga. «Reintentar» llama al MISMO `refetch()` que usan
          el cambio de filtro, la reconexión y la vuelta a la pestaña: una
          sola puerta de recarga, y con el candado de arrastre incluido. */}
      {errorCitas && (
        <Banda tono="error" urgente>
          <TriangleAlert size={14} className="ag-aviso-icono" aria-hidden />
          <p className="ag-aviso-texto">
            <strong>No se pudo cargar la agenda.</strong> Lo que se ve puede estar incompleto o desactualizado.
          </p>
          <button type="button" className="ag-aviso-accion" onClick={onReintentar}>
            Reintentar
          </button>
        </Banda>
      )}

      {/* 1 bis · La traída llegó ENTERA de forma y RECORTADA de fondo.
          ⚠️ COMPARTE EL TONO ROJO CON LA DE ARRIBA Y NO ES PEREZA. Sólo hay
          tres tonos (`ag-aviso--error|gcal|vacio`) y estrenar un cuarto
          pediría un par de tokens nuevos en las DOS paletas de globals.css
          para una distinción que el ojo no necesita: las dos bandas dicen
          «lo que ves no es la agenda», y no pueden coincidir en pantalla
          —una se escribe en el éxito y la otra en el catch—, así que el rojo
          nunca significa dos cosas a la vez. Lo que las separa es el TEXTO,
          que es donde estaba la diferencia de verdad: aquélla dice que no se
          pudo cargar; ésta, que sí se cargó y aun así falta.
          `urgente` (role="alert") por la misma razón que la otra, y aquí
          todavía más literal: los huecos que faltan se ven LIBRES, y sobre
          un hueco libre se agenda encima de una cita que existe.
          SIN «Reintentar»: la misma consulta devolvería las mismas mil
          filas. La salida es pedir MENOS RANGO, y eso es lo que ofrece el
          botón — sólo desde Mes, que es de donde se sale; ya en Semana no
          hay a dónde acortar y la banda se queda sin acción, que es más
          honesto que un botón que no cambia nada. */}
      {citasIncompletas && (
        <Banda tono="error" urgente>
          <TriangleAlert size={14} className="ag-aviso-icono" aria-hidden />
          <p className="ag-aviso-texto">
            <strong>Faltan citas por mostrar.</strong> Este periodo tiene más citas de las que caben en una carga; lo que ves está incompleto.
          </p>
          {/* `dayGridMonth` a secas y sin helper: el Mes es la ÚNICA vista
              que vale lo mismo ancha que estrecha (`FORMATOS_DE_VISTA`), así
              que aquí no hay pareja que resolver. */}
          {currentView === 'dayGridMonth' && (
            <button type="button" className="ag-aviso-accion" onClick={onVerPorSemana}>
              Ver por semana
            </button>
          )}
        </Banda>
      )}

      {/* 2 · Fallo de Google. SIN «Reintentar» a propósito: reintentar no
          arregla una credencial ni una cuota, y un botón que casi siempre
          falla enseña a ignorarlo. La salida es /perfil, que es donde se
          reconecta de verdad. */}
      {googleFallo && (
        <Banda tono="gcal">
          <GoogleGIcon size={14} />
          <p className="ag-aviso-texto">
            <strong>No se pudo sincronizar con Google Calendar.</strong> Tus citas se muestran normal; faltan los eventos del calendario.
          </p>
          <Link href="/perfil" className="ag-aviso-accion">Revisar conexión</Link>
        </Banda>
      )}

      {/* 3 · Vacío. Las dos frases salen del mismo cero; ver `vacioReal`. */}
      {vacioReal && (
        <Banda tono="vacio">
          <Calendar size={14} className="ag-aviso-icono" aria-hidden />
          <p className="ag-aviso-texto">
            {vacioFiltrado && medicoFiltrado
              ? `Ningún evento de ${componerNombreMedicoCompleto(medicoFiltrado)} ${periodoVacio}`
              : `Sin citas ${periodoVacio}`}
          </p>
          {/* «Ver todos» pasa por `aplicarFiltro`, como el desplegable: un
              `setFiltroMedico('')` a secas dejaba `filtroSincronoRef` en el
              médico anterior y la traída seguía filtrada (defecto hallado
              por la red de A0). En Mes no hay «Todos» (`mesSinTodos`): ahí
              la banda sólo informa. */}
          {vacioFiltrado ? (mesSinTodos ? null : (
            <button type="button" className="ag-aviso-accion" onClick={onVerTodos}>
              Ver todos los médicos
            </button>
          )) : (
            /* ⚠️ DICE «AGENDAR» Y NO «NUEVA CITA», que es lo que pedía §11.
               El botón del header se renombró a «Agendar» al montarle el
               conmutador «Cita | Evento»: el modal ya no crea sólo citas.
               Dos nombres para la misma puerta es peor que apartarse del
               spec en una palabra. Y hace lo mismo que aquel botón, bloqueo
               por suscripción incluido. */
            <button type="button" className="ag-aviso-accion" onClick={onAgendar}>
              Agendar
            </button>
          )}
        </Banda>
      )}

      {/* 4 · Vista compacta. Se queda EXACTAMENTE como estaba, sólo que ahora
          dentro del envoltorio: no se migra a `Banda` porque su caja lleva su
          propia geometría y sus propias clases desde el bloque 6, y
          reescribirla para ganar tres líneas es arriesgar una que funciona. */}
      {avisoRecorte && (
        <div className="ag-banda-compacta" role="status">
          <ChevronsDownUp size={14} className="ag-banda-compacta-icono" aria-hidden />
          <p className="ag-banda-compacta-texto">
            <strong>Vista compacta:</strong> {avisoRecorte}
          </p>
          {/* SEGUNDA salida, no la única: el botón del header sigue siendo por
              donde se enciende y también apaga. Existe porque el efecto que
              apaga «Compactar» al salir de time-grid ya dice el principio —un
              calendario que oculta información sin dar salida es peor que uno
              que no la oculta— y hasta ahora la única salida estaba en la otra
              punta de la pantalla, lejos de la frase que confiesa el recorte. */}
          <button type="button" className="ag-banda-compacta-salida" onClick={onSalirCompacta}>
            {compactaElMes ? 'Mostrar todos los días' : 'Mostrar rejilla completa'}
          </button>
        </div>
      )}
    </div>
  )
}
