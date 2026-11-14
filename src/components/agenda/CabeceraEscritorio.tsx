/**
 * src/components/agenda/CabeceraEscritorio.tsx
 *
 * El encabezado de escritorio de la agenda: título, subtítulo con el
 * conteo, segmentado de vistas, «Compactar», filtro de médico, «Horario» y
 * el botón «Agendar». Movido tal cual desde `AgendaCliente.tsx` (A2.5.9,
 * movimiento puro, con sus comentarios); sólo cambiaron los nombres que
 * eran estado o manejadores del padre, que ahora llegan por props.
 *
 * ⚠️ DESDE F1.1 LA RAÍZ ES `.ag-controles`, un ítem de la rejilla de la
 * tarjeta `.agenda-fc` (ver la nota de abajo y globals.css). La condición
 * `!isMobile` que decide si se monta se queda en el padre — por debajo de
 * `ANCHO_MOVIL` lo sustituye `BandaMovil`, que es otra cosa y no una versión
 * estrecha de esto.
 */

import { useEffect, useRef, type ReactNode } from 'react'
import { teclasDeAccion, type AccionAtajo } from '@/lib/agenda/atajosAgenda'
import { ChevronDown, Settings, Plus, ChevronsDownUp, Rows4 } from 'lucide-react'
import { VIEWS } from '@/components/agenda/BandaMovil'
import { OPCION_TODOS } from '@/components/agenda/FiltrosBandaMovil'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import type { MedicoConfig } from '@/lib/configApp'
import { vistaEnElOtroFormato, etiquetaCompactar, vistaAdmiteCompactar } from '@/lib/agenda/vistasAgenda'

interface Props {
  resumenConteo: string
  currentView: string
  isMobile: boolean
  onVista: (tipo: string) => void
  compactar: boolean
  onCompactar: () => void
  isSingleDoctor: boolean
  filtroEfectivo: string | null
  mesSinTodos: boolean
  medicos: readonly MedicoConfig[]
  onFiltroMedico: (id: string) => void
  canEditHorario: boolean
  onHorario: () => void
  /** T3 · Con la agenda v2 el engrane lleva a la configuración de la agenda
      (no al modal de horario): sólo icono, y su nombre lo dice. Apagada, el de
      siempre («Horario»). Lo decide el padre con el interruptor. */
  engraneConfiguracion?: boolean
  onAgendar: () => void
  onIntencionAgendar: () => void
  /** E7: «Por confirmar (N)», sólo con la agenda v2 encendida (lo decide el padre). */
  porConfirmar?: ReactNode
  /** F1.3 · Densidad compacta (franja de 24 px), preferencia del navegador. */
  densidadCompacta: boolean
  onDensidad: () => void
  /** F3 (contrato de interacciones): el minicalendario, junto a la fecha. */
  selectorFecha?: ReactNode
  /** F3: el botón de búsqueda por paciente. */
  buscar?: ReactNode
  /** F3: con los atajos de una tecla activos, `aria-keyshortcuts` en ‹ › Hoy
      y en las vistas. Lo decide quien gestiona los atajos; sin él, nada. */
  atajos?: boolean
}

/* La acción de atajo de cada segmento de vista (por su tipo ancho). */
const ATAJO_DE_VISTA: Record<string, AccionAtajo> = {
  dayGridMonth: 'vista-mes', timeGridWeek: 'vista-semana', timeGridDay: 'vista-dia',
}
/* Los botones nativos de FullCalendar y su acción. No aceptan atributos propios
   desde las opciones, así que se ponen sobre el DOM (ver el efecto). */
const ATAJO_NATIVO: ReadonlyArray<[string, AccionAtajo]> = [
  ['.fc-today-button', 'hoy'], ['.fc-prev-button', 'anterior'], ['.fc-next-button', 'siguiente'],
]

export function CabeceraEscritorio({
  resumenConteo, currentView, isMobile, onVista, compactar, onCompactar, isSingleDoctor,
  filtroEfectivo, mesSinTodos, medicos, onFiltroMedico, canEditHorario, onHorario, onAgendar,
  onIntencionAgendar, porConfirmar, densidadCompacta, onDensidad, selectorFecha, buscar, atajos = false,
  engraneConfiguracion = false,
}: Props) {
  const rotuloEngrane = engraneConfiguracion ? 'Configuración de la agenda' : 'Configurar horario de consulta'
  /* F3 · `aria-keyshortcuts` en los tres botones de la barra nativa. Va sobre el
     DOM porque FullCalendar no deja poner atributos en sus botones; se repite al
     cambiar de vista por si su barra se volvió a montar, y en el cuadro
     siguiente porque `<FullCalendar>` monta su DOM después de este efecto. */
  const raizRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const tarjeta = raizRef.current?.closest('.agenda-fc')
      for (const [sel, accion] of ATAJO_NATIVO) {
        const boton = tarjeta?.querySelector(sel)
        if (!boton) continue
        if (atajos) boton.setAttribute('aria-keyshortcuts', teclasDeAccion(accion))
        else boton.removeAttribute('aria-keyshortcuts')
      }
    })
    return () => cancelAnimationFrame(id)
  }, [atajos, currentView])
  return (
    /* ═══ F1.1 · UNA SOLA BARRA ════════════════════════════════════════════
       Desde F1.1 esto NO es un encabezado encima de la tarjeta: es un ítem más
       de la rejilla de `.agenda-fc` (`grid-area: controles`), en la misma fila
       que la barra nativa de FullCalendar (‹ › Hoy y la fecha). El padre lo
       monta DENTRO de la tarjeta; dónde va y cuándo baja a una segunda fila lo
       decide `globals.css`, junto a `.agenda-fc`.
       ⚠️ El `<h1>Agenda</h1>` sigue existiendo, `sr-only`: la pantalla la nombra
       la fecha y el lector de pantalla necesita el título.
       ⚠️ El CONTEO va el primero, en gris, con elipsis, y es lo PRIMERO que cede
       ancho: los demás controles no encogen. Se fue «Gestión de citas clínicas»,
       que era decorativa (lo decía el título, que ya no se ve). */
    <div className="ag-controles" ref={raizRef}>
      <h1 className="sr-only">Agenda</h1>
      {/* F3 · La ranura del minicalendario va la PRIMERA: la fecha de
          FullCalendar queda justo a su izquierda, al final de la barra nativa. */}
      {selectorFecha}
      <p className="ag-controles-conteo" title={resumenConteo || undefined}>{resumenConteo}</p>
      {/* Segmented control de vistas. Sincronizado con la vista real vía
          `datesSet`.

          ⚠️ YA NO LLEVA `!isMobile`, Y ERA LO QUE DEJABA AL TELÉFONO CON UNA
          SOLA VISTA. El control se escondía en móvil porque el efecto del
          ancho forzaba Día y no había nada que elegir; retirada esa
          imposición, esconderlo dejaba al médico encerrado en el periodo con
          el que hubiera entrado, sin ninguna puerta. Ahora las tres se
          alcanzan desde el teléfono.

          ⚠️ SE APRIETA EN ANCHOS DE MÓVIL, Y ES ESPERADO. Este control vive
          en el header de escritorio, que en móvil sustituye la banda azul de
          un bloque posterior. Hasta entonces comparte fila con el resto y la
          fila envuelve. No lo escondas otra vez «mientras tanto»: eso es
          volver a la vista única. */}
      <div
        role="tablist"
        aria-label="Vista del calendario"
        className="inline-flex h-9 flex-none"
        /* El radio de la pista SALE del de la pastilla: radio exterior =
           interior + padding es la regla geométrica que evita que las
           esquinas se vean pellizcadas. Derivado, no un número nuevo.
           F1.1: 36 px de pista, como el resto de controles de la barra. */
        style={{ background: 'var(--ag-segment-bg)', borderRadius: 'calc(var(--ag-r-btn) + 3px)', padding: 3, gap: 2 }}
      >
        {VIEWS.map(v => {
          /* ⚠️ EL SEGMENTO NOMBRA UN PERIODO, NO UNA VISTA, Y POR ESO
             TRADUCE. `VIEWS` guarda el tipo ANCHO de cada uno —es la lista
             del segmentado desde el bloque 4 y no se toca—, así que en un
             teléfono «Semana» tiene que apuntar a `listWeek` y no a
             `timeGridWeek`. Sin esta línea pasaban las dos cosas a la vez:
             ningún segmento se veía activo, porque `currentView` valía
             `listWeek` y aquí se comparaba contra `timeGridWeek`; y pulsarlo
             metía la rejilla de siete columnas en 390 px, que es justo lo
             que las listas vienen a evitar.
             Es el mismo `vistaEnElOtroFormato` del efecto del ancho, y tiene
             que serlo: dos tablas de parejas divergen. */
          const tipo = vistaEnElOtroFormato(v.type, isMobile)
          const active = currentView === tipo
          return (
            <button
              key={v.type}
              role="tab"
              aria-selected={active}
              aria-keyshortcuts={atajos ? teclasDeAccion(ATAJO_DE_VISTA[v.type]) : undefined}
              onClick={() => onVista(tipo)}
              className={`inline-flex items-center ${active ? '' : 'bg-transparent hover:bg-[var(--ag-btn-ghost-hover)]'}`}
              style={{
                border: 'none', cursor: 'pointer', borderRadius: 'var(--ag-r-btn)', padding: '0 13px',
                fontSize: 12.5, fontWeight: active ? 700 : 600,
                ...(active
                  ? { background: 'var(--ag-segment-active-bg)', color: 'var(--ag-segment-active-text)', boxShadow: 'var(--ag-segment-active-shadow)' }
                  /* Sin `background` en línea: lo pone la clase, para que el
                     hover (fondo, en micro) pueda cambiarlo. Era `opacity` y
                     `transition-all`, fuera de CONTRASTE §5. */
                  : { color: 'var(--ag-segment-text)' }),
              }}
            >
              {v.label}
            </button>
          )
        })}
      </div>
      {/* ⚠️ EL RADIO DE ESTOS CINCO CONTROLES SALE DE `--ag-r-btn` (10 px) Y NO
          DE LA ESCALA DE TAILWIND. Eran `rounded-xl`, que son 12. El token
          lo fija el spec del rediseño (§1.3) y su familia está declarada en
          globals.css con lo que significa cada peldaño; si necesitas un
          radio aquí, elige el papel del elemento y no el número.
          Los que quedan en `rounded-xl` en este archivo son los del MODAL,
          que están fuera de este alcance. */}
      {/* ── COMPACTAR ─────────────────────────────────────────────────
          ⚠️ ESTA NOTA DECÍA «en móvil la vista es de un solo día», Y CADUCÓ
          CON EL BLOQUE 6. El teléfono ya no impone Día: conserva el periodo
          y cambia de formato, así que en móvil se puede estar en Mes. El
          control existe también allí — lo pinta la banda azul, no esta fila.
          Lo que decide hoy es la VISTA y sólo la vista: rejilla (los dos
          ejes) o Mes (sólo columnas). Ver `vistaAdmiteCompactar`. */}
      {!isMobile && vistaAdmiteCompactar(currentView) && (
        <button
          type="button"
          onClick={onCompactar}
          aria-pressed={compactar}
          /* ⚠️ EL RÓTULO DEPENDE DE LA VISTA. En Mes no hay rejilla ni
             horario que nombrar: lo único que se pliega son las columnas de
             los días sin nada dentro. Decirlo igual que en Semana prometería
             un recorte de horas que esa vista no puede hacer. */
          aria-label={etiquetaCompactar(currentView)}
          title={etiquetaCompactar(currentView)}
          className="flex flex-none items-center gap-2 h-9 px-3 rounded-[var(--ag-r-btn)] text-sm font-medium"
          /* ENCENDIDO SE MARCA CON EL BORDE, NO CON RELLENO. Compartía los
             tokens del segmentado activo, o sea que se pintaba como un
             segmento seleccionado: dos controles distintos con el mismo
             tratamiento, y el ojo leía «Compactar» como una cuarta vista.
             Ahora el relleno sólido es del segmentado y sólo de él; esto es
             un interruptor, y un interruptor encendido se dice con el marco.
             Sin sombra: la superficie no se levanta, se enmarca. */
          style={compactar
            ? {
                background: 'var(--ag-surface)',
                /* `--ag-brand-legible` y NO `--ag-brand-secondary`: la marca
                   cruda sobre la superficie oscura da 2.24:1. Ver su nota. */
                color: 'var(--ag-brand-legible)',
                border: '1px solid var(--ag-brand-legible)',
              }
            : {
                background: 'var(--ag-surface)',
                color: 'var(--ag-text)',
                border: '1px solid var(--ag-border-card)',
              }}
        >
          <ChevronsDownUp size={15} />
          {/* ⚠️  `2xl`, NO `xl` NI `sm`. Y el peldaño NO se elige por cómo
              se ve el botón suelto: se elige por si la FILA ENTERA cabe en
              una línea, que es lo que se rompía.

              El desfase que hay que tener en la cabeza: la barra lateral es
              fija y se lleva 256 px, así que un portátil maximizado (1280 de
              viewport, o sea `xl`) le deja a la agenda 1024 útiles. Con `xl`
              la etiqueta aparecía justo ahí, que es el ancho donde no cabe.
              `2xl` (1536 de viewport) son 1280 útiles, y ahí sí.

              Por debajo manda el icono, que es lo que este botón tiene de
              suyo: `aria-label` y `title` dicen lo mismo que la etiqueta y
              no dependen del ancho. Hermanos de peldaño: la etiqueta de
              «Horario» y la frase del subtítulo. Los tres se mueven a la
              vez o el header vuelve a envolver. */}
          <span className="hidden 2xl:inline">Compactar</span>
        </button>
      )}
      {/* F1.3 · DENSIDAD COMPACTA: la franja de media hora baja a 24 px (48 por
          hora) para ver la jornada entera sin desplazar. Sólo en la rejilla de
          horas: en Mes no hay franjas. Misma pinta de interruptor que
          «Compactar» (encendido = marco). Preferencia del navegador. */}
      {!isMobile && currentView.startsWith('timeGrid') && (
        <button type="button" onClick={onDensidad} aria-pressed={densidadCompacta}
          aria-label="Densidad compacta" title="Densidad compacta: 48 px por hora"
          className="flex flex-none items-center gap-2 h-9 px-3 rounded-[var(--ag-r-btn)] text-sm font-medium"
          style={densidadCompacta
            ? { background: 'var(--ag-surface)', color: 'var(--ag-brand-legible)', border: '1px solid var(--ag-brand-legible)' }
            : { background: 'var(--ag-surface)', color: 'var(--ag-text)', border: '1px solid var(--ag-border-card)' }}>
          <Rows4 size={15} />
          <span className="hidden 2xl:inline">Densidad</span>
        </button>
      )}
      {/* Filtro por médico — solo en modo multi-doctor */}
      {!isSingleDoctor && (
        <div className="relative ag-controles-filtro">
          {/* ⚠️ F1.1 · DESDE LA BARRA ÚNICA EL ANCHO YA NO LO DECIDE LA OPCIÓN
              MÁS ANCHA: el envoltorio (`.ag-controles-filtro` en globals.css)
              va de 140 a 240 px y el `<select>` lo llena (`w-full`), así que
              cede ancho antes que la fila envuelva. El 240 de abajo sigue
              siendo el tope. Lo que sigue es la historia de ese tope. */}
          {/* ── ⚠️ EL TOPE DE 240 px ES LO QUE IMPIDE QUE ESTE CONTROL VUELVA A
              TIRAR LA FILA A DOS LÍNEAS, Y EL NÚMERO ESTÁ MEDIDO ──────────
              Un `<select>` se dimensiona por su OPCIÓN MÁS ANCHA, no por la
              seleccionada. O sea que es el único control del header cuyo
              ancho lo decide el contenido de la clínica y no el diseño: una
              clínica con «Dra. María Guadalupe Hernández Villaseñor» en la
              lista arrastra la fila entera aunque el filtro esté en «Todos
              los médicos».

              El caso peor NO es el ancho más estrecho, que es lo que
              engaña: es `2xl` (1280 px útiles), donde las etiquetas de
              «Compactar» y «Horario» vuelven y el subtítulo recupera su
              frase. Medido ahí, con el subtítulo largo («128 citas · 34
              eventos · 12 de Google»), la fila tenía 85 px de holgura sobre
              un `<select>` de 226. Es decir: envuelve pasando de 311 px.
              A 1024 útiles la holgura es de 135, así que ese ancho NO es el
              que manda. Si vuelves a medir, mide a `2xl`.

              240 se eligió por encima de los 226 de hoy —así que con los
              datos actuales no recorta nada— y 71 px por debajo del punto de
              ruptura, que es el margen que se le deja al día que cambie la
              tipografía, el padding o el texto del subtítulo.

              ⚠️ NO LO SUBAS PARA QUE «QUEPA UN NOMBRE LARGO». Ese es el
              trabajo del desplegable: el `<option>` no está capado y enseña
              el nombre completo, así que la elipsis no esconde información,
              sólo la aplaza un clic. */}
          {/* ⚠️ `filtroEfectivo` Y NO `filtroMedico`: el desplegable tiene
              que ENSEÑAR el filtro que salió en la petición, incluido el que
              puso la semilla del rol. Con `filtroMedico` diría «Todos los
              médicos» sobre una agenda filtrada — la mentira exacta que los
              bloques anteriores persiguen, y aquí encima con el arreglo al
              lado. El `?? ''` es porque un `<select>` con `value={null}`
              deja de ser controlado. */}
          <select
            value={filtroEfectivo ?? ''}
            /* Por `onFiltroMedico` y no por un `setFiltroMedico` directo:
               además del estado hay que mover el espejo síncrono y, sobre
               todo, BORRAR la marca de forzado — esto es una elección de una
               persona, y desde aquí el médico deja de ser reversible. Lo
               resuelve `aplicarFiltro(id, false)` en el padre. */
            onChange={e => onFiltroMedico(e.target.value)}
            className="appearance-none w-full truncate h-9 pl-3 pr-9 rounded-[var(--ag-r-btn)] text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-[var(--ag-surface)] border border-[var(--ag-border-card)] text-[var(--ag-text)] hover:bg-[var(--ag-bg-app)]"
          >
            <option value="" disabled={mesSinTodos}>{OPCION_TODOS(mesSinTodos)}</option>
            {medicos.map(m => (
              <option key={m.id} value={m.id}>{componerNombreMedicoCompleto(m)}</option>
            ))}
          </select>
          <ChevronDown
            size={15}
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--ag-muted)]"
          />
        </div>
      )}
      {canEditHorario && (
        <button
          onClick={onHorario}
          className="flex flex-none items-center gap-2 h-9 px-3 rounded-[var(--ag-r-btn)] text-sm font-medium bg-[var(--ag-surface)] border border-[var(--ag-border-card)] text-[var(--ag-text)] hover:bg-[var(--ag-bg-app)]"
          /* El `aria-label` se añadió AL ESCONDER LA ETIQUETA: por debajo de
             `2xl` este botón es sólo un engranaje, y sin él su nombre
             accesible dependía del `title`, que es el último recurso del
             algoritmo de nombre y no todos los lectores lo anuncian igual. */
          aria-label={rotuloEngrane}
          title={rotuloEngrane}
        >
          <Settings size={15} aria-hidden="true" />
          {/* `2xl` por lo mismo que «Compactar» —ver su nota—: `sm` mostraba
              la etiqueta desde 640 px, o sea prácticamente siempre, y estos
              ~60 px eran parte de lo que tiraba la fila a la línea de
              abajo. El `title` de arriba es lo que queda diciéndolo.
              T3 · Con la v2 no hay etiqueta a ningún ancho: el engrane abre la
              configuración entera, no el horario (petición de Angel). */}
          {!engraneConfiguracion && <span className="hidden 2xl:inline">Horario</span>}
        </button>
      )}
      {/* ── UNA PUERTA, Y EL TIPO SE ELIGE DENTRO ──────────────────────
          Aquí hubo DOS botones —«Nuevo evento» y «Nueva cita»—, cada uno
          abriendo el modal con su tipo. El comentario que los defendía decía
          que «el tipo se elige al entrar y ya no se cambia, así que la
          puerta ES la elección». Eso era verdad mientras el alta no tuvo
          ningún control de tipo, y dejó de serlo el 2026-08-22, cuando se le
          puso arriba uno de dos posiciones (`TIPOS_ALTA`) porque quien entra
          pulsando un hueco —la vía más usada— no tenía forma de cambiar de
          idea sin cerrar y volver por la otra puerta.

          Desde entonces las dos puertas llevaban al mismo sitio y la de
          «Nuevo evento» sólo preseleccionaba lo que el conmutador ya hace en
          un clic. Se retira: costaba ~134 px de una fila que a 1024 px
          útiles envolvía a tres líneas y se comía un tercio del alto de la
          rejilla. Lo que se pierde es un atajo; lo que se gana es la agenda.

          ⚠️ NO LA REPONGAS «PARA QUE SE VEA QUE SE PUEDEN CREAR EVENTOS».
          Si eso no se ve, el sitio donde arreglarlo es el conmutador del
          modal, no el header.

          LO QUE DE AQUEL COMENTARIO SIGUE SIENDO CIERTO:

          · **En EDICIÓN el tipo no se puede cambiar, y no es un olvido.**
            Convertir una cita en evento sería quitarle el paciente por una
            puerta lateral, y eso se parece demasiado a un borrado (§12.18,
            y la nota larga de `TipoFila`). Ese motivo presupone UNA FILA QUE
            YA EXISTE; en el alta no la hay, así que el conmutador no
            convierte nada: elige qué se va a crear. Por eso hay control en
            el alta y no en la edición.

          · **Pulsar un hueco y arrastrar sobre el calendario siguen
            abriendo CITA**, que es lo que espera quien hace ese gesto. Este
            botón hace lo mismo, por lo mismo: agendar es lo que la agenda
            hace todo el día.

          ⚠️ EL TEXTO NO PUEDE DECIR «NUEVA CITA», que es lo que decía. Ya no
          describe lo que abre —un modal que también crea eventos— y sería la
          única pista de que el conmutador existe apuntando en la dirección
          contraria. «Agendar» es el verbo que cubre las dos cosas y de paso
          ocupa menos. El `title` dice el resto. */}
      {buscar}
      {porConfirmar}
      <button
        onClick={onAgendar}
        /* A2.6: red de seguridad de la precarga en ocioso — si el puntero
           pasa por aquí o el teclado llega por Tab antes de que el
           ocioso dispare, el chunk del modal ya va en camino al pulsar. */
        onMouseEnter={onIntencionAgendar}
        onFocus={onIntencionAgendar}
        data-onboard="nueva-cita"
        title="Nueva cita o evento — el tipo se elige arriba del modal"
        className="flex flex-none items-center gap-2 h-9 px-4 rounded-[var(--ag-r-btn)] text-sm font-semibold text-white shadow-sm hover:brightness-95 bg-[linear-gradient(135deg,var(--ag-brand-primary),var(--ag-brand-secondary))]"
      >
        <Plus size={15} />
        Agendar
      </button>
    </div>
  )
}
