'use client'

import { Menu } from 'lucide-react'
import type { Medico } from '@/components/agenda/AppointmentModal'
import { vistaEnElOtroFormato } from '@/lib/agenda/vistasAgenda'
import { NavegacionBandaMovil } from '@/components/agenda/NavegacionBandaMovil'
import { FiltrosBandaMovil } from '@/components/agenda/FiltrosBandaMovil'
import type { ReactNode } from 'react'
import { teclasDeAccion, type AccionAtajo } from '@/lib/agenda/atajosAgenda'

const ATAJO_DE_VISTA: Record<string, AccionAtajo> = {
  dayGridMonth: 'vista-mes', timeGridWeek: 'vista-semana', timeGridDay: 'vista-dia',
}

/* ═══ BANDA AZUL DEL ENCABEZADO MÓVIL (bloque 6 · paso 8a) ══════════════════
   Sustituye al encabezado blanco de escritorio por debajo de `ANCHO_MOVIL`, y
   sólo ahí: el de escritorio no se toca por dentro, se envuelve.

   ⚠️ EL COLOR SALE DEL TOKEN `--ag-navy` DE globals.css, el mismo que pintan el
   menú lateral y la franja del sistema, para que las tres superficies de cromo
   no puedan divergir. Aquí estuvo escrita la fórmula
   —`hsl(from var(--cp) h s 20%)`, «la misma que Sidebar.tsx:248»— y ya no vale
   por dos motivos: el menú dejó de tenerla en línea y la consume del token, y
   el token TIENE DOS FÓRMULAS, una por tema (en oscuro se aclara con OKLCH para
   separarse de la página). Esta banda hereda las dos sin saberlo, que es
   justamente lo que se buscaba.
   ⚠️ PLANA, SIN DEGRADADO. El mockup dibuja un `linear-gradient` y AFIRMA que es
   «el mismo del sidebar de escritorio»; eso es falso hoy —el sidebar es plano— y
   un degradado que el original no tiene SEPARA las dos superficies en vez de
   unirlas, que era justo lo que la decisión buscaba. Y los tokens
   `--sp-nav-from/mid/to` de `spinus-tokens.css` NO se tocan: están comentados
   con un «no usar» explícito.

   ⚠️ EL SUBTÍTULO ES SÓLO EL CONTEO. Ni el nombre del consultorio —que el mockup
   escribe («Umán») y que esta página no tiene como concepto— ni el lema
   «Gestión de citas clínicas», que en 390 px no cabe con nada más.

   ⚠️ EL HAMBURGUESA ABRE EL MENÚ DE VERDAD, vía `MenuMovilContext`. El botón
   flotante del `Sidebar` se esconde en esta ruta para que no salgan dos.

   ⚠️⚠️ TRES FILAS, Y LA CUARTA SE FUNDIÓ EN LA PRIMERA (paso 8c). La navegación
   de fecha tenía fila propia y la banda medía 240 px — que son EXACTAMENTE los
   del mockup, no un crecimiento nuestro: su `.appbar` suma 20 de relleno + 184
   de cuatro filas + 36 de huecos. En un Android real eso dejaba tres o cuatro
   citas a la vista, así que hubo que bajar por debajo de lo dibujado.
   Lo que se hizo, sin perder un control ni bajar un objetivo táctil de 44:
     · las dos flechas suben a la fila del título, pegadas al subtítulo;
     · la ETIQUETA DE FECHA baja a ese subtítulo, junto al conteo — son las dos
       cosas que dicen «qué estás mirando», y juntas se leen incluso mejor;
     · la pista del conmutador pierde sus 4+4 de relleno (52 → 44);
     · relleno y huecos bajan de 20/12 a 18/8.
   Resultado: 114 px sin fila de filtro y 166 con ella, contra 184 y 240.
   ⚠️ LAS FLECHAS VAN JUNTO AL SUBTÍTULO Y NO JUNTO AL CONMUTADOR, y no es
   estética: pegadas a las tres pestañas se leerían como «cambia de vista», que
   es lo que NO hacen. Al lado de la fecha se lee lo que son. */

/* Segmentos del control de vistas. SÓLO TEXTO desde el bloque 4: llevaban un
   icono lucide cada uno (LayoutGrid / Columns3 / Square) y se retiraron. Tres
   palabras de una sílaba y media no necesitan pictograma, y los tres iconos
   —una rejilla, unas columnas, un cuadrado— nombraban la FORMA de la vista, no
   su periodo, que es lo que el médico elige. Ensanchaban la fila unos 60 px en
   una zona que ya envuelve a dos líneas en anchos de portátil. */
export const VIEWS = [
  { type: 'dayGridMonth', label: 'Mes'    },
  { type: 'timeGridWeek', label: 'Semana' },
  { type: 'timeGridDay',  label: 'Día'    },
] as const

/* ═══ F1.15 · DOS FILAS (eran cuatro y la banda medía ~195 px de 844) ═══════
   Fila 1: ☰ · fecha (15 px, negrita) con el conteo debajo (12 px) · ‹ · Hoy · ›.
   Fila 2: segmentado Mes/Semana/Día de ancho fijo · filtro (cede ancho) · los
   botones de «Compactar» y del engrane cuando los hay.
   ⚠️ «Agenda» SIGUE SIENDO EL `<h1>`, sólo que `sr-only`: la fecha es lo que
   nombra la pantalla a la vista, y el título se lo dice al lector de pantalla.
   ⚠️ LAS FLECHAS SIGUEN JUNTO A LA FECHA y no junto al conmutador (la nota de
   arriba del paso 8c): pegadas a las pestañas se leerían como «cambia de vista».
   Todos los controles miden 44 × 44 o más. */
export function BandaMovil(
  { conteo, vistaActual, onVista, titulo, onPrev, onNext, onHoy, hoyDeshabilitado, onMenu,
    medicos, filtroMedico, onFiltroMedico, onHorario, onCompactar, compactado,
    mesSinTodos, selectorFecha, buscar, atajos = false }: {
    conteo: string; vistaActual: string; onVista: (tipo: string) => void
    titulo: string; onPrev: () => void; onNext: () => void
    /** F1.10 · «Hoy» del teléfono; deshabilitado (aria) si el rango ya lo contiene. */
    onHoy: () => void; hoyDeshabilitado: boolean
    onMenu: () => void
    medicos: readonly Medico[]; filtroMedico: string
    onFiltroMedico: (id: string) => void; onHorario: (() => void) | null
    onCompactar: (() => void) | null; compactado: boolean
    mesSinTodos: boolean
    /** F3 (contrato de interacciones): ranuras opcionales. El minicalendario no
        va en el teléfono (decisión 21); la ranura existe para que el contrato
        encaje. `atajos`: `aria-keyshortcuts` en ‹ › Hoy y en las vistas. */
    selectorFecha?: ReactNode
    buscar?: ReactNode
    atajos?: boolean
  },
) {
  return (
    <header className="ag-banda-movil">
      <h1 className="sr-only">Agenda</h1>
      <div className="ag-banda-movil-fila">
        <button type="button" className="ag-banda-movil-ctrl" onClick={onMenu} aria-label="Abrir menú">
          <Menu size={19} />
        </button>
        <span className="ag-banda-movil-titulo">
          <span className="ag-banda-movil-fecha">{titulo}</span>
          <span className="ag-banda-movil-sub">{conteo}</span>
        </span>
        {selectorFecha}
        <NavegacionBandaMovil onPrev={onPrev} onNext={onNext} onHoy={onHoy} hoyDeshabilitado={hoyDeshabilitado} atajos={atajos} />
      </div>
      <div className="ag-banda-movil-filtros">
        <div className="ag-banda-movil-vistas" role="tablist" aria-label="Vista del calendario">
          {VIEWS.map(v => {
            /* El mismo traductor que el segmentado de escritorio y que el efecto
               del ancho: aquí `isMobile` es true por construcción —esta banda sólo
               se monta en móvil—, así que «Semana» apunta a `listWeek`. */
            const tipo = vistaEnElOtroFormato(v.type, true)
            return (
              <button key={v.type} type="button" role="tab" aria-selected={vistaActual === tipo}
                aria-keyshortcuts={atajos ? teclasDeAccion(ATAJO_DE_VISTA[v.type]) : undefined}
                onClick={() => onVista(tipo)}>{v.label}</button>
            )
          })}
        </div>
        {buscar}
        <FiltrosBandaMovil
          medicos={medicos} filtroMedico={filtroMedico}
          onFiltroMedico={onFiltroMedico} onHorario={onHorario}
          onCompactar={onCompactar} compactado={compactado}
          mesSinTodos={mesSinTodos}
        />
      </div>
    </header>
  )
}
