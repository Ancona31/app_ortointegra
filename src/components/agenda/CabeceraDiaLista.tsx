'use client'

/* ─── Cabecera de día de las vistas de LISTA ────────────────────────────
   La caja la pinta `globals.css`; aquí sólo se decide qué texto va en cada
   lado. Fecha a la izquierda, día de la semana a la derecha.

   ⚠️ LOS DOS TEXTOS SE COMPONEN AQUÍ Y NO SALEN DE `listDayFormat` /
   `listDaySideFormat`, QUE ES LA VÍA QUE PARECE. Tres motivos, y el primero
   basta:

     1. LOS DEFAULTS DEL PLUGIN VIENEN AL REVÉS. `listDay` trae
        `listDayFormat: { weekday: 'long' }` y NINGÚN formato lateral
        (`@fullcalendar/list/index.js:31`), o sea la izquierda con «miércoles» y
        la derecha vacía; `listWeek` trae el día de la semana a la izquierda y
        la fecha a la derecha (`:35-37`). El mockup pide justo lo contrario en
        las dos. Corregirlo por formatos obliga a escribir opciones en
        `VISTAS_FC` para vistas que TODAVÍA NO SE MONTAN, que es el bloque
        siguiente.
     2. `arg.sideText` NO ESTÁ TIPADO. `DayHeaderContentArg` declara `date`,
        `view`, `text` y un índice `[otherProp: string]: any`
        (`core/internal-common.d.ts:1741-1746`), así que leer el lateral entra
        como `any` — prohibido en este proyecto.
     3. La fecha quiere DOS formas y el formato es por vista: en la lista de un
        día ésta es la única fecha completa de la pantalla y lleva año; en la de
        una semana el año ya lo dice la barra de arriba y repetirlo en cada una
        de las siete cabeceras es ruido.

   ⚠️ Y NO LLEVA ENLACE, aunque el mockup dibuje un `<a>`. El destino natural
   sería el `navLinkAttrs` que el plugin ya calcula y pasa en los renderProps,
   pero entra por el mismo índice `any` del punto 2. Queda como decisión
   pendiente del bloque siguiente, no como olvido: hoy la fecha es texto. */
const FORMATO_DIA_LISTA_CON_ANIO = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric', month: 'long', year: 'numeric',
})
const FORMATO_DIA_LISTA = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric', month: 'long',
})
const FORMATO_DIA_SEMANA = new Intl.DateTimeFormat('es-MX', { weekday: 'long' })

export function CabeceraDiaLista({ date, esHoy, conAnio }: {
  date: Date; esHoy: boolean; conAnio: boolean
}) {
  const fecha = conAnio
    ? FORMATO_DIA_LISTA_CON_ANIO.format(date)
    : FORMATO_DIA_LISTA.format(date)
  return (
    <span className="ag-listahead">
      {/* El « · hoy» va DENTRO del mismo span que la fecha y sin marcador
          propio, que es como lo escribe el mockup: ahí es texto corriente
          dentro del enlace, no una etiqueta aparte. La cabecera de la REJILLA
          sí envuelve su «· HOY» en `.ag-dayhead-hoy`, y la diferencia no es
          incoherencia: allí el rótulo cuelga de una abreviatura en gris y
          necesita su propio color para verse; aquí la línea entera ya va en la
          tinta de marca, así que un span sin regla que lo lea sería un marcador
          muerto. */}
      <span className="ag-listahead-fecha">{fecha}{esHoy && ' · hoy'}</span>
      <span className="ag-listahead-dow">{FORMATO_DIA_SEMANA.format(date)}</span>
    </span>
  )
}
