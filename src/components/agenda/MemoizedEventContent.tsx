'use client'

/**
 * src/components/agenda/MemoizedEventContent.tsx
 *
 * Movido tal cual desde `AgendaCliente.tsx` (A2.2, movimiento puro), con sus
 * comentarios; sólo cambiaron los `import`/`export` que hacían falta.
 */

import { memo, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { IconoEvento, ColorEvento } from '@/lib/appointments'
import type { Status } from '@/lib/agenda/tiposAgenda'
import { STATUS_CONFIG } from '@/lib/agenda/tarjetasAgenda'
import { IconoDelEvento } from './IconoDelEvento'

/* ─── Renderer de eventos (estilo Google) — memoizado ──── */

/* Umbrales de tier de la tarjeta, EN FRANJAS Y NO EN PÍXELES. El tier se decide
   midiendo el alto real del contenedor con ResizeObserver (ver abajo): es lo más
   fiable con FullCalendar, cuyo alto de evento depende de la duración y del alto
   de franja del grid, no calculable con certeza sólo desde datos.

   ⚠️ ERAN DOS CONSTANTES EN PÍXELES —40 y 56— CALIBRADAS A UNA FRANJA DE 34,56,
   Y DEJARON DE SERVIR cuando la franja pasó a variar con el alto de ventana
   (`--ag-slot-h` en globals.css: 36 / 42 / 48; la nota larga está junto a
   `.fc .fc-timegrid-slot`). Una cita mide siempre las mismas FRANJAS —30 min =
   1, 45 = 1,5, 60 = 2, 90 = 3—, así que con umbrales fijos la clasificación se
   descoloca en cuanto la franja se mueve, en la dirección que sea. Con los
   tramos que había entonces —24/28/32— se descolocaba HACIA ABAJO: a 24 px la
   de 45 min caía a `tiny` y perdía chip, huso y descriptor, y la de 60 caía a
   `compact` y perdía el descriptor. Con los de hoy se descolocaría hacia
   arriba —a 42 la de 30 min subiría a `compact`—, que es el mismo fallo por el
   otro lado.

   POR QUÉ 1,25 Y 1,75: son los PUNTOS MEDIOS entre las duraciones que separan
   —1,25 está entre 1 y 1,5 franjas; 1,75 entre 1,5 y 2—, así que dejan un cuarto
   de franja de margen a cada lado (9 px a 36, 12 a 48) y NINGÚN umbral cae sobre
   un alto alcanzable. El 56 de antes caía EXACTAMENTE sobre la cita de 60 min
   con la franja a 28 (2 × 28 = 56) y la comparación es `<`, así que un subpíxel
   a la baja la degradaba. Si tocas estos factores, comprueba que ninguno quede
   en 1, 1,5, 2 ni 3.

   ⚠️ SE DERIVAN DEL PISO, NO DEL ALTO YA RENDERIZADO, y esa distinción es la que
   mantiene vivo lo bueno de `expandRows`: cuando sobra alto las franjas se
   estiran, las tarjetas suben de tier y enseñan más, que es justo lo que se
   quiere. Derivarlos del alto estirado ataría el tier a la duración para
   siempre, y una cita de 30 min en una rejilla de cuatro horas se quedaría en
   una línea dentro de una tarjeta de 75 px. */
const TIER_TINY_FRANJAS = 1.25
const TIER_COMPACT_FRANJAS = 1.75

/* ⚠️ SUELOS FÍSICOS DE CADA TIER — HOY SON DOS GUARDAS INERTES, Y ASÍ HAY QUE
   LEERLAS. No actúan en ninguno de los tres tramos de `--ag-slot-h` (36/42/48).
   No se borran porque el día que la franja baje vuelven a hacer falta, y porque
   son lo único que documenta cuánto alto pide cada tier de verdad.

   QUÉ HACEN. Entran por el `Math.max` de abajo, una por umbral, y sólo mandan
   cuando la proporción se queda por debajo del suelo:

     · `Math.max(piso × 1,25, 42)` → el suelo gana con piso < 33,6.
     · `Math.max(piso × 1,75, 55)` → el suelo gana con piso < 31,43.

   O sea que el tramo bajo tendría que caer de 36 a menos de 33,6 para que la
   primera muerda. Mientras los tres tramos sean 36/42/48, la clasificación la
   decide ENTERA la proporción de arriba.

   DE DÓNDE SALEN LOS NÚMEROS. Medido el 2026-08-25 sobre citas reales en la
   rejilla:

     · `tiny` = 22 px. Es una fila: sus dos envoltorios pasan a `display:
       contents` y sólo queda el más alto (16 del icono, 15 del nombre) + 2+2 de
       relleno + 1+1 de borde.
     · `compact` = 41 px, 42 con icono. Dos filas: 15 (hora + chip) + 1 de hueco
       + 15 del nombre (16 si hay icono) + 4+4 + 1+1.
     · `full` = 55 px. Las dos de `compact` más la del descriptor: + 1 de hueco
       + 13 de línea.

   POR QUÉ EXISTEN, que es lo que las hace valer aunque hoy no disparen. Se
   escribieron con el tramo bajo en 24, donde la proporción sola clasificaba
   bien y RECORTABA:

     · Una cita de 45 min mide 1,5 franjas = 36 px a piso 24, caía en `compact`
       por proporción y le faltaban 5: se comía la fila del NOMBRE. Eso sí lo
       delataba el `scrollHeight`.
     · Una de 60 min mide 2 franjas = 48 px, caía en `full` y le faltaban 7.
       Pero `.ag-tarjeta-desc` NO lleva `flex-shrink: 0` —sus dos hermanas sí—,
       así que en vez de desbordar SE ENCOGÍA de 13 px a 6 y partía la palabra
       del estado por la mitad, en horizontal. La tarjeta no desbordaba y el
       `scrollHeight` daba 0: hay que mirarlo, o medir la fila del descriptor.

   Con el `Math.max`, a piso 24 la de 45 bajaba a `tiny` y la de 60 a `compact`:
   se perdía contenido a propósito —chip, huso, descriptor— porque perderlo es
   mejor que enseñarlo cortado. Al subir el tramo bajo a 36 ese régimen
   desapareció, no la razón de tenerlo cubierto.

   ⚠️ SI TOCAS EL RELLENO, EL HUECO O LA TIPOGRAFÍA DE `.ag-tarjeta`, ESTOS DOS
   NÚMEROS SE QUEDAN VIEJOS EN SILENCIO — y ahora encima sin síntoma, porque no
   disparan: el error se descubriría el día que baje la franja. Vuelve a medir
   la fila más alta de cada tier, y recalcula los dos puntos de corte de arriba
   (suelo ÷ 1,25 y suelo ÷ 1,75) para saber si has metido alguno dentro de los
   tramos vigentes. */
const ALTO_MINIMO_COMPACT = 42
const ALTO_MINIMO_FULL = 55

/* El tramo de ventana baja. Es el fallback porque es el único en el que el piso
   aprieta de verdad: si la lectura del token fallara, es el que menos daño hace
   —clasifica igual que hoy en cualquier ventana, sólo que sin margen extra en
   las altas—.
   ⚠️ TIENE QUE SEGUIR AL TRAMO BAJO DE `--ag-slot-h` (globals.css). Subió de 24
   a 36 con él. Desincronizarlos no rompe nada visible: sólo haría que, en el
   caso en que la lectura del token falla, los umbrales de tier se calculen sobre
   un piso que no es el que la rejilla está usando. */
const PISO_FRANJA_FALLBACK = 36

/** Piso de franja vigente, leído del token que fijan las media queries. */
function leerPisoFranja(): number {
  const crudo = getComputedStyle(document.documentElement).getPropertyValue('--ag-slot-h')
  const px = Number.parseFloat(crudo)
  return Number.isFinite(px) && px > 0 ? px : PISO_FRANJA_FALLBACK
}

/* La hora de INICIO sola, para el tier `tiny` fuera de Día (ver la nota de las
   dos horas en la tarjeta). Espeja el `eventTimeFormat` del <FullCalendar> —2
   dígitos, 24 h— para que las dos cadenas se lean igual; `hourCycle: 'h23'` y no
   `hour12: false` por lo mismo que en el indicador de hora: el segundo deja
   pasar «24:00» en algunas locales. A nivel de módulo para no reconstruir un
   Intl por tarjeta y por render. */
export const FORMATO_HORA_INICIO = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

/* ── DÓNDE VIVE CADA ESTILO DE ESTA TARJETA (bloque 3A) ────────────────
   El criterio de reparto, para que el siguiente no tenga que adivinarlo:

   · VA A globals.css (`.ag-tarjeta-*`, junto al harness de `.fc-event`) todo
     lo que es CAJA: layout, tipografía, huecos, y qué hijos se ven en cada
     vista y en cada tier. Es lo que permite que la vista Día se resuelva
     cambiando la dirección del flex desde `.fc-timeGridDay-view`, sin una rama
     nueva en `renderEventContent`.
   · SE QUEDA EN LÍNEA sólo lo que depende de un valor calculado en JS: los
     cuatro colores interpolados (`dot`, `txt`, `fondo`, `marco`), que salen del
     estado o del color elegido del evento, y el tachado de una cancelada. Nada
     de esto se puede escribir como regla estática sin volcar la paleta entera
     a CSS y duplicarla.
   · El TIER es la excepción interesante: se calcula en JS (ResizeObserver) pero
     viaja como CLASE, no como estilo. Tiene que ser así — ver la nota de
     `tier` abajo. */

export const MemoizedEventContent = memo(function MemoizedEventContent({
  timeText, horaInicio, title, pacNombre, status, doctorInitial, tzDiff, icono, color, descriptor,
  esEvento, enRejilla,
}: {
  /* True si la fila es un evento genérico y no una cita. Lo deriva el
     despachador con `esEventoGenerico`; aquí no se puede deducir de `icono` ni
     de `color`, que un evento puede no tener. Sólo decide la tinta de la hora. */
  esEvento: boolean
  /* LAS DOS CADENAS DE HORA VIAJAN JUNTAS Y ELIGE EL CSS, y no es adorno.
     `timeText` es lo que compone FullCalendar y en `timeGrid` es el RANGO
     —«10:30 – 11:00»—, porque `displayEventEnd` se resuelve a `true` cuando la
     vista no lo fija (core/internal-common.js:4402, y timegrid no lo fija). Ese
     rango mide ~78 px y no encoge; en una columna de Semana de ~135 px se come
     el nombre de la cita de 30 min, que es justo la que cae en el tier `tiny`.
     `horaInicio` es sólo la de arranque, que es lo que retrata `semana.png`.
     Se manda el par y `globals.css` enseña una u otra, porque quien decide es
     la VISTA —Día se queda con el rango— y la vista es lo único que este
     componente no sabe: el tier sí lo tiene, la vista no. */
  timeText: string; horaInicio: string; title: string; pacNombre: string | null
  status: Status; doctorInitial?: string; tzDiff?: string
  /* La pinta del evento genérico (§12.14). Null en una cita, y null también en
     un evento al que no le eligieron ninguna: ahí la tarjeta cae al estilo por
     estado, que es lo que hacía antes de que esto existiera. */
  icono: IconoEvento | null; color: ColorEvento | null
  /* Texto base de la tercera línea: `notes`, y NADA MÁS, en una cita y en un
     evento genérico por igual. Sin nota, la línea la ocupa el estado.

     ⚠️ HUBO UN RESPALDO A LA SEDE DEL CONSULTORIO cuando `notes` venía vacía en
     un evento genérico. Está revocado: salió de leer «Star Médica · quirófano
     2» en el mockup como si fuera un campo, y ahí es texto escrito a mano en
     `notes`, no una sede. No lo repongas. */
  descriptor: string | null
  /* INTERRUPTOR DEL SISTEMA DE TAMAÑOS. Viaja como prop porque la VISTA es lo
     único que esta tarjeta no sabe: la resuelve el despachador, que sí tiene el
     `arg.view`, con `esVistaDeRejilla`. En `false` ni se mide ni sale clase de
     tier — el porqué de cada una, en las dos notas de abajo. */
  enRejilla: boolean
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | null>(null)
  const [pisoFranja, setPisoFranja] = useState(PISO_FRANJA_FALLBACK)

  /* Mide el alto real asignado por FullCalendar (root con height:100%), y de
     paso relee el piso de franja.

     ⚠️ EL PISO SE RELEE AQUÍ Y NO EN UN LISTENER DE `resize` PROPIO, y no es
     pereza: cualquier cambio de alto de ventana redimensiona la rejilla —es
     `flex-1` dentro de una raíz en `dvh`— y con ella todas las tarjetas, así que
     este observer ya se dispara. Un segundo listener sería el mismo evento
     contado dos veces.

     Los dos `setState` van sueltos y con valores PRIMITIVOS a propósito: React
     los agrupa en el mismo tick y descarta el render si el valor no cambió. Un
     único `useState` con un objeto `{height, piso}` re-renderizaría en cada
     latido del observer, que es varias veces por arrastre y por tarjeta. */
  /* ⚠️ FUERA DE LA REJILLA EL OBSERVER NO SE MONTA, y es una decisión, no una
     omisión: montarlo y descartar el valor también «funcionaría».
     1. La medida no significaría lo mismo. En la rejilla el alto es el SITIO QUE
        FULLCALENDAR LE DA a la tarjeta —proporcional a su duración—, y de ahí
        sale el tier. En una fila de lista el alto lo pone el CONTENIDO, así que
        medirlo es preguntarle a la tarjeta por su propio tamaño y clasificarla
        con la respuesta.
     2. El coste es real y por fila. Es un ResizeObserver por evento y, sobre
        todo, DOS `setState` en el primer latido —que llega siempre: el observer
        dispara al observar—, o sea un segundo render de la lista entera para
        producir un dato que nadie va a leer.
     La dep es `enRejilla` y no `[]`: un cambio de vista sin desmontar la tarjeta
     tiene que poder encender y apagar la medición. */
  useEffect(() => {
    if (!enRejilla) return
    const el = rootRef.current
    if (!el) return
    const update = () => {
      setHeight(el.getBoundingClientRect().height)
      setPisoFranja(leerPisoFranja())
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [enRejilla])

  /* height null = aún sin medir → 'full' hasta el primer ResizeObserver.

     ⚠️ EL TIER SALE COMO CLASE Y NO COMO RAMA DE MARKUP, Y NO ES ESTILO: ES LO
     QUE HACE POSIBLE LA VISTA DÍA. Antes cada tier renderizaba hijos distintos
     —`tiny` no montaba la hora ni el descriptor—, así que una cita de 30 min,
     que mide UNA FRANJA y cae en `tiny` en CUALQUIER vista, llegaba a Día sin los
     elementos que su fila horizontal tiene que enseñar. En Día sobra ancho y no
     falta nada, pero un hijo que no existe no se puede volver a enseñar con
     CSS. Montando siempre los mismos hijos y escondiéndolos por clase, la regla
     de `.fc-timeGridDay-view` los recupera. Si vuelves a ramificar el markup por
     tier, la vista Día se rompe en silencio para las citas cortas. */
  /* Dos criterios por umbral y gana el mayor: la PROPORCIÓN conserva la escalera
     por duración cuando la franja da de sí, y el SUELO FÍSICO impide pintar un
     tier donde iba a salir cortado. Ver la nota de las cuatro constantes. */
  /* ⚠️ `null` FUERA DE LA REJILLA, Y ES LO QUE APAGA EL MECANISMO. Sin tier no
     se emite clase `ag-tarjeta--*`, y sin esa clase no hay una sola regla de
     tamaño que pueda aplicar: la tarjeta se queda en la base de `.ag-tarjeta`,
     que monta y enseña TODOS sus hijos. Es lo que quiere una fila de lista,
     donde el ancho sobra y el alto lo pone el contenido.

     ⚠️ Y NO ES «FORZAR `full`», aunque hoy se vea casi igual. `full` es una
     CLASIFICACIÓN —la de la tarjeta que tiene sitio de sobra— y en una lista no
     hay nada que clasificar; encima la vista Día ya cuelga una regla propia de
     `--full` (globals.css:2148, el cuadro del icono), y ese es exactamente el
     tipo de regla que una fila de lista no debe heredar por accidente.

     El resto del régimen —los tres tiers, los dos criterios por umbral y el
     `Math.max`— NO SE TOCA: en la rejilla `enRejilla` es `true` y esto es la
     escalera de siempre, letra por letra. */
  const umbralTiny = Math.max(pisoFranja * TIER_TINY_FRANJAS, ALTO_MINIMO_COMPACT)
  const umbralCompact = Math.max(pisoFranja * TIER_COMPACT_FRANJAS, ALTO_MINIMO_FULL)
  const tier: 'tiny' | 'compact' | 'full' | null =
    !enRejilla ? null
      : height == null ? 'full'
        : height < umbralTiny ? 'tiny'
          : height < umbralCompact ? 'compact'
            : 'full'

  /* El color elegido MANDA sobre el del estado cuando lo hay, y sólo lo hay en
     un evento genérico. Motivo: en un evento el estado dice poco —está agendado
     o cancelado y ya— mientras que el color es lo que su autor eligió para
     distinguirlo de un vistazo. En una cita no hay color y esto no cambia nada.
     El fondo y el borde salen del mismo token con `color-mix`, así que basta un
     token por color y la paleta sigue siendo barata de sustituir. */
  const dot = color ? `var(--ag-evento-${color})` : `var(--ag-status-${status}-dot)`
  const txt = color ? `var(--ag-evento-${color})` : `var(--ag-status-${status}-text)`
  const fondo  = color
    ? `color-mix(in srgb, var(--ag-evento-${color}) 10%, var(--ag-surface))`
    : `var(--ag-status-${status}-bg)`
  const marco = color
    ? `color-mix(in srgb, var(--ag-evento-${color}) 32%, transparent)`
    : `var(--ag-status-${status}-border)`
  const isCancelled = status === 'cancelled'
  const name = pacNombre ?? title
  const etiquetaEstado = STATUS_CONFIG[status].label

  /* SIN `opacity` EN LAS CANCELADAS. La tenía (0.7) y se retiró en el bloque
     3A: arrastraba el texto con el fondo y los ratios de la paleta de estado se
     midieron sin ella, así que al 70 % una cancelada bajaba de AA. El tachado
     del nombre y el fondo rojo ya dicen «cancelada» sin tocar el contraste. */
  const root: CSSProperties = {
    background: fondo,
    borderColor: marco,
    borderLeftColor: dot,
  }

  /* EL EMPUJE AL BORDE DERECHO DE LA FILA, y lo lleva UNO SOLO: el primero del
     grupo de la derecha. Dos márgenes `auto` se repartirían el hueco a partes
     iguales y el chip acabaría a media fila, que es justo lo que se arregló al
     sacarlo de entre el nombre y el descriptor.
     Casi siempre es inerte —mientras el descriptor esté y crezca, el espacio
     libre es cero— y sólo manda cuando el descriptor no se pinta: un evento
     genérico sin `notes` en la vista Día. Está en línea y no en `globals.css`
     porque quién lo lleva depende de si hay chip, que es un dato de aquí. En la
     disposición vertical no estorba: el chip ya iba a la derecha de su fila
     empujado por la hora, y la píldora está apagada. */
  const empujeChip: CSSProperties | undefined = doctorInitial ? { marginLeft: 'auto' } : undefined
  const estiloPildora: CSSProperties = doctorInitial ? { color: txt } : { color: txt, marginLeft: 'auto' }

  return (
    <div ref={rootRef} className={tier ? `ag-tarjeta ag-tarjeta--${tier}` : 'ag-tarjeta'} style={root}>
      <div className="ag-tarjeta-cab">
        {/* ⚠️ LA HORA DE UN EVENTO GENÉRICO VA EN NEUTRO, NUNCA EN EL COLOR DEL
            EVENTO. La de una cita sí toma el color de su estado.

            1. EL MOTIVO ES ESTRUCTURAL, no que estos seis colores concretos
               fallen. El fondo de la tarjeta es una MEZCLA DEL PROPIO COLOR
               (`fondo` = color al 10 % sobre la superficie), así que pintar el
               texto de ese mismo color acota el contraste a la distancia entre
               un color y una mezcla de sí mismo. Cuatro de los seis quedaban
               por debajo de AA —oliva 4.39:1 en claro; indigo 4.16, bronce 4.31
               y grafito 4.11 en oscuro— y los dos que pasaban lo hacían por
               suerte. Retiñir esos cuatro dejaría la trampa armada para el
               séptimo color que alguien añada.
            2. SUBIR EL PORCENTAJE DEL TINTE LO EMPEORA, en los dos modos: en
               claro el fondo se oscurece hacia el color y en oscuro se aclara
               hacia él. No lo intentes.
            3. LOS CINCO ESTADOS SÍ CONSERVAN SU COLOR, y la asimetría es
               deliberada: son cinco valores fijos que elige el sistema, se
               verifican una vez y se acabó. Los colores de evento son seis y
               creciendo, los elige un usuario, y no hay forma de verificar a
               futuro lo que todavía no existe.
            4. EFECTO SECUNDARIO, Y ES UNA MEJORA: la hora en color pasa a
               significar «esto es una cita con estado» y la hora en neutro
               «esto es un evento». Es un signo de tipo donde no había ninguno.
               Deliberado, no un descuido: no lo «unifiques».

            El color del evento sigue vivo donde no tiene este problema: la barra
            izquierda (gráfico, umbral 3:1), el icono, el punto del mes, la
            píldora —fondo opaco— y el tinte del fondo. */}
        <span className="ag-tarjeta-hora" style={{ color: esEvento ? 'var(--ag-ink-600)' : txt }}>
          <span className="ag-tarjeta-hora-rango">{timeText}</span>
          <span className="ag-tarjeta-hora-inicio">{horaInicio}</span>
        </span>
        {doctorInitial && <span className="ag-tarjeta-chip" style={empujeChip}>{doctorInitial}</span>}
      </div>
      <div className="ag-tarjeta-tit">
        {/* El icono del evento genérico va DELANTE DEL NOMBRE, no en el hueco
            del punto de estado: el punto murió con la fila de estado, que ahora
            es el descriptor. En una cita no hay icono y aquí no hay nada.

            EL ENVOLTORIO NO ES DECORATIVO NI ES CASO DE DÍA: es el item de flex
            que `order` coloca, y en Día crece hasta ser el cuadro con fondo y
            borde del mockup. El TAMAÑO del glifo tampoco se fija aquí —viaja en
            `--ag-tarjeta-icono-px`, que globals.css sube de 16 a 26 px en Día—
            porque un número en línea ganaría a cualquier regla por vista sin
            necesidad de `!important`, y entonces esto no se podría escalar. */}
        {icono && (
          <span className="ag-tarjeta-icono">
            <IconoDelEvento nombre={icono} size="var(--ag-tarjeta-icono-px)" color={dot} />
          </span>
        )}
        <span
          className="ag-tarjeta-nombre"
          style={isCancelled ? { textDecoration: 'line-through' } : undefined}
        >{name}</span>
      </div>
      {tzDiff && <span className="ag-tarjeta-tz">{tzDiff}</span>}
      {/* Tercera línea: «Consulta de seguimiento · atendida». El estado va en su
          propio span —con su separador— porque la vista Día lo esconde: allí lo
          dice la píldora, y repetirlo sería decir dos veces lo mismo en la misma
          fila. Sin `descriptor` queda sólo el estado, sin separador huérfano. */}
      <span className={descriptor ? 'ag-tarjeta-desc' : 'ag-tarjeta-desc ag-tarjeta-desc--solo-estado'}>
        {descriptor}
        {descriptor && <span className="ag-tarjeta-desc-sep"> · </span>}
        {/* ⚠️ EL ESTADO LLEVA SU COLOR, NO EL GRIS DEL DESCRIPTOR. Heredando
            `--ag-muted` los cinco estados caen a 3.07–3.26:1 en claro y `no_show`
            a 4.35:1 en oscuro — por debajo de AA, y en Semana esta línea es el
            ÚNICO sitio donde se escribe el estado, porque la píldora está
            apagada. Es el mismo motivo por el que arriba se retiró la `opacity`
            de las canceladas. El ` · ` y la nota se quedan en gris: ahí no hay
            información de estado que leer. */}
        <span className="ag-tarjeta-desc-estado" style={{ color: txt }}>{etiquetaEstado.toLowerCase()}</span>
      </span>
      {/* Píldora de estado: montada siempre, visible SÓLO en Día (globals.css), y
          en TODA fila con estado —cita o evento genérico—, que es lo que hace que
          la columna de Día se lea alineada. El borde y el punto salen de
          `currentColor`, así que basta fijar aquí el color una vez y las otras
          dos declaraciones lo heredan. Y como el color es `txt`, un evento con
          color elegido pinta su píldora con él, igual que ya hacen la barra
          izquierda, la hora y la etiqueta del descriptor. */}
      <span className="ag-tarjeta-pildora" style={estiloPildora}>{etiquetaEstado}</span>
    </div>
  )
})
