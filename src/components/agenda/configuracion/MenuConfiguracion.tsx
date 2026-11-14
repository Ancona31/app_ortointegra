/**
 * El menú de secciones de la configuración de la agenda (G2, punto 5 de
 * Angel; la maqueta `docs/spec/rediseno-paginas-agenda.html`, pestaña
 * «Configuración»): en escritorio, una columna a la izquierda que se queda a
 * la vista; en el teléfono, apilado arriba como fichas que se envuelven (sin
 * desplazamiento lateral). Son enlaces a las secciones de la misma página
 * (`#id` del título de cada `TarjetaSeccion`), no pestañas: todo sigue en una
 * página y el lector de pantalla la recorre igual.
 *
 * «Primeros pasos» lleva cuántos faltan, en ámbar, mientras falte alguno.
 */
export interface EntradaMenu { destino: string; texto: string; nota?: string }

export default function MenuConfiguracion({ entradas }: { entradas: readonly EntradaMenu[] }) {
  return (
    <nav aria-label="Secciones de la configuración" className="lg:sticky lg:top-[var(--ag-4)]">
      <ul className="flex flex-wrap gap-[var(--ag-2)] lg:flex-col lg:gap-px">
        {entradas.map(e => (
          <li key={e.destino}>
            <a href={`#${e.destino}`}
              className="flex min-h-9 items-center justify-between gap-[var(--ag-2)] rounded-[var(--ag-r-btn)] border border-[var(--ag-border-card)] bg-[var(--ag-surface)] px-[var(--ag-3)] text-sm font-medium text-[var(--ag-text)] hover:bg-[var(--ag-bg-app)] lg:border-transparent lg:bg-transparent">
              <span>{e.texto}</span>
              {e.nota && <small className="text-xs font-bold text-[var(--ag-aviso-text)]">{e.nota}</small>}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
