/**
 * src/components/agenda/CabeceraEscritorio.tsx
 *
 * El encabezado de escritorio de la agenda: título, subtítulo con el
 * conteo, segmentado de vistas, «Compactar», filtro de médico, «Horario» y
 * el botón «Agendar». Movido tal cual desde `AgendaCliente.tsx` (A2.5.9,
 * movimiento puro, con sus comentarios); sólo cambiaron los nombres que
 * eran estado o manejadores del padre, que ahora llegan por props.
 *
 * ⚠️ MISMO ELEMENTO RAÍZ, SIN NODOS DE MÁS. El `<div className="flex
 * items-center justify-between gap-4 mb-6">` de abajo es exactamente el que
 * pintaba `AgendaCliente.tsx`; la condición `!isMobile` que decide si se
 * monta se queda en el padre, no aquí — por debajo de `ANCHO_MOVIL` lo
 * sustituye `BandaMovil`, que es otra cosa y no una versión estrecha de
 * esto.
 */

import { ChevronDown, Settings, Plus, ChevronsDownUp } from 'lucide-react'
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
  onAgendar: () => void
  onIntencionAgendar: () => void
}

export function CabeceraEscritorio({
  resumenConteo, currentView, isMobile, onVista, compactar, onCompactar, isSingleDoctor,
  filtroEfectivo, mesSinTodos, medicos, onFiltroMedico, canEditHorario, onHorario, onAgendar,
  onIntencionAgendar,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">Agenda</h1>
        {/* El conteo es de LO QUE LA VISTA PINTA, así que sale solo del rango
            activo y no hace falta condicionarlo por vista: en Mes cuenta el
            mes, en Semana la semana y en Día el día. Ver `contarVisibles`. */}
        {/* ── ⚠️ ESTE SUBTÍTULO NO PUEDE ENVOLVER, Y POR ESO LA FRASE SE VA ──
            La barra lateral es fija y se lleva 256 px, así que en un portátil
            con la ventana maximizada (1280 px) a la agenda le quedan 1024. A
            ese ancho «Gestión de citas clínicas · 1 cita · 1 evento» caía a
            dos líneas él solo y empujaba la fila entera a tres.

            De las dos mitades, la que se va es la frase: es decorativa y dice
            lo que el `<h1>` de arriba y la propia rejilla ya dicen. El conteo
            no, que es dato y cambia al navegar. Por eso la frase sólo aparece
            de `2xl` (1536 px de viewport = 1280 útiles) en adelante.

            ⚠️ EL `2xl` ES DE VIEWPORT Y EL ANCHO QUE IMPORTA ES EL ÚTIL: hay
            256 px de diferencia entre los dos y Tailwind no sabe de la barra
            lateral. Mismo desfase que en «Compactar» y «Horario», y por eso
            los tres usan el mismo peldaño: si se toca uno, se tocan los tres.

            Sin conteo (rango vacío) la frase se queda pase lo que pase: es
            eso o un subtítulo en blanco, que además encogería el bloque y
            haría saltar el alto del header al navegar. */}
        <p className="text-sm text-[#86868b] mt-0.5 whitespace-nowrap">
          <span className={resumenConteo ? 'hidden 2xl:inline' : undefined}>Gestión de citas clínicas</span>
          {resumenConteo && (
            <>
              <span className="hidden 2xl:inline"> · </span>
              {resumenConteo}
            </>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-end">
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
          className="inline-flex"
          /* El radio de la pista SALE del de la pastilla: radio exterior =
             interior + padding es la regla geométrica que evita que las
             esquinas se vean pellizcadas. Derivado, no un número nuevo. */
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
                onClick={() => onVista(tipo)}
                className={`inline-flex items-center transition-all ${active ? '' : 'hover:opacity-70'}`}
                style={{
                  border: 'none', cursor: 'pointer', borderRadius: 'var(--ag-r-btn)', padding: '6px 13px',
                  fontSize: 12.5, fontWeight: active ? 700 : 600,
                  ...(active
                    ? { background: 'var(--ag-segment-active-bg)', color: 'var(--ag-segment-active-text)', boxShadow: 'var(--ag-segment-active-shadow)' }
                    : { background: 'transparent', color: 'var(--ag-segment-text)' }),
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
            className="flex items-center gap-2 px-3 py-2.5 rounded-[var(--ag-r-btn)] text-sm font-medium transition-colors"
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
        {/* Filtro por médico — solo en modo multi-doctor */}
        {!isSingleDoctor && (
          <div className="relative">
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
              className="appearance-none max-w-[240px] truncate pl-3 pr-9 py-2.5 rounded-[var(--ag-r-btn)] text-sm font-medium cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-[var(--ag-surface)] border border-[var(--ag-border-card)] text-[var(--ag-text)] hover:bg-[var(--ag-bg-app)]"
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
            className="flex items-center gap-2 px-3 py-2.5 rounded-[var(--ag-r-btn)] text-sm font-medium transition-colors bg-[var(--ag-surface)] border border-[var(--ag-border-card)] text-[var(--ag-text)] hover:bg-[var(--ag-bg-app)]"
            /* El `aria-label` se añadió AL ESCONDER LA ETIQUETA: por debajo de
               `2xl` este botón es sólo un engranaje, y sin él su nombre
               accesible dependía del `title`, que es el último recurso del
               algoritmo de nombre y no todos los lectores lo anuncian igual. */
            aria-label="Configurar horario de consulta"
            title="Configurar horario de consulta"
          >
            <Settings size={15} />
            {/* `2xl` por lo mismo que «Compactar» —ver su nota—: `sm` mostraba
                la etiqueta desde 640 px, o sea prácticamente siempre, y estos
                ~60 px eran parte de lo que tiraba la fila a la línea de
                abajo. El `title` de arriba es lo que queda diciéndolo. */}
            <span className="hidden 2xl:inline">Horario</span>
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
        <button
          onClick={onAgendar}
          /* A2.6: red de seguridad de la precarga en ocioso — si el puntero
             pasa por aquí o el teclado llega por Tab antes de que el
             ocioso dispare, el chunk del modal ya va en camino al pulsar. */
          onMouseEnter={onIntencionAgendar}
          onFocus={onIntencionAgendar}
          data-onboard="nueva-cita"
          title="Nueva cita o evento — el tipo se elige arriba del modal"
          className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--ag-r-btn)] text-sm font-semibold text-white transition-all shadow-sm hover:brightness-95 bg-[linear-gradient(135deg,var(--ag-brand-primary),var(--ag-brand-secondary))]"
        >
          <Plus size={15} />
          Agendar
        </button>
      </div>
    </div>
  )
}
