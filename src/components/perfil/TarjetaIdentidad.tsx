'use client'

import { Image as IconoImagen } from 'lucide-react'

/**
 * La columna fija de Mi perfil (región 2 del spec): quién eres, cómo firmas y
 * qué dos colores usa tu marca. Sólo LECTURA — las acciones viven en la
 * pestaña Datos.
 *
 * ⚠️ NO ES UNA VISTA PREVIA DEL PDF, Y EL SPEC SE CORRIGIÓ EN ESTE PUNTO.
 * El mockup la describía como «espejo del encabezado real de los PDFs» y la
 * pintaba con un degradado de marca. Ese degradado NO EXISTE en ningún PDF del
 * sistema: `src/lib/pdf/PdfHeader.tsx` compone el encabezado sobre fondo
 * blanco —nombre en el color primario, especialidad en el secundario y dos
 * filetes al pie— y el adaptador v2 (`pdf/v2/adaptadores/comun.tsx`) deriva un
 * único acento del color primario. Prometer aquí un espejo era prometer algo
 * que el papel no cumple.
 *
 * Por eso esta tarjeta es lo que dice ser: una muestra de los datos y los
 * colores. NO LE DEVUELVAS EL DEGRADADO ni el texto de «así saldrá impreso»
 * sin arreglar antes el PDF de verdad.
 *
 * ⚠️ CERO COLORES CABLEADOS. Los únicos valores de color que aparecen son
 * `colorPrimario` y `colorSecundario`, que son DATOS del médico y llegan por
 * props; todo lo demás sale de los tokens `--sp-*`.
 */
export default function TarjetaIdentidad({
  nombre, especialidad, cedulaProfesional, cedulaEspecialidad,
  logoUrl, firmaUrl, colorPrimario, colorSecundario, nombrePaleta,
}: {
  nombre: string
  especialidad: string
  cedulaProfesional: string
  cedulaEspecialidad: string
  logoUrl: string | null
  firmaUrl: string | null
  colorPrimario: string
  colorSecundario: string
  /** El nombre de la paleta elegida, o null si los colores son a medida. */
  nombrePaleta: string | null
}) {
  const hayCedulas = Boolean(cedulaProfesional || cedulaEspecialidad)

  return (
    <div className="flex flex-col gap-[var(--sp-gap-block)]">

      {/* ── Identidad + firma ─────────────────────────────── */}
      <div className="sp-card flex flex-col gap-[var(--sp-4)]">

        <div className="flex flex-col items-center gap-[var(--sp-3)] text-center">
          <div
            className="w-[74px] h-[74px] shrink-0 flex items-center justify-center overflow-hidden rounded-[var(--sp-r-card)] bg-[var(--sp-surface-sunken)]"
            style={logoUrl
              ? { border: 'var(--sp-bw-hair) solid var(--sp-line-card)' }
              : { border: 'var(--sp-bw-dash) dashed var(--sp-line-dash)' }}
          >
            {logoUrl
              ? <img src={logoUrl} alt="Logo del consultorio" className="w-full h-full object-contain p-[var(--sp-1)]" />
              : <IconoImagen size={20} className="text-[var(--sp-ink-150)]" />}
          </div>

          <div className="min-w-0 w-full">
            <p className="sp-title-card break-words">{nombre || 'Sin nombre'}</p>
            {/* ⚠️ DOS LÍNEAS, NO `truncate`, Y ESTÁ MEDIDO. Con `truncate` esta
                línea se cortaba en el caso más común de todos: a los 288 px
                útiles de la columna, «Cirugía de Columna · Ortopedia y
                Traumatología» mide 299-338 px según la fuente del sistema, o sea
                que perdía «y Traumatología» en las CUATRO fuentes probadas
                (Liberation, Cantarell, Open Sans, DejaVu). No era un borde: era
                cualquier médico con dos especialidades.
                El recorte a dos líneas sí es un tope real —a 288 px caben unos
                580 px de texto— y de paso iguala el comportamiento del nombre,
                que envuelve en vez de cortarse. */}
            {especialidad && (
              <p className="sp-secondary mt-[var(--sp-gap-title-sub)] line-clamp-2">{especialidad}</p>
            )}
          </div>
        </div>

        {hayCedulas && (
          <div
            className="flex flex-wrap gap-x-[var(--sp-4-5)] gap-y-[var(--sp-2)] pt-[var(--sp-3)]"
            style={{ borderTop: 'var(--sp-bw-hair) solid var(--sp-line-divider)' }}
          >
            {cedulaProfesional && <Cedula rotulo="Céd. profesional" valor={cedulaProfesional} />}
            {cedulaEspecialidad && <Cedula rotulo="Céd. especialidad" valor={cedulaEspecialidad} />}
          </div>
        )}

        <div
          className="flex flex-col gap-[var(--sp-2-5)] pt-[var(--sp-3)]"
          style={{ borderTop: 'var(--sp-bw-hair) solid var(--sp-line-divider)' }}
        >
          <p className="sp-label">Firma en documentos</p>
          <div
            className="h-[74px] flex items-center justify-center rounded-[var(--sp-r-field)] bg-[var(--sp-surface-sunken)]"
            style={{ border: 'var(--sp-bw-dash) dashed var(--sp-line-dash)' }}
          >
            {firmaUrl
              ? <img src={firmaUrl} alt="Firma guardada" className="max-h-[58px] max-w-full object-contain" />
              : <span className="sp-hint">Sin firma</span>}
          </div>
          <p className="sp-hint">Se imprime sobre la línea punteada de cada PDF.</p>
        </div>
      </div>

      {/* ── Colores ───────────────────────────────────────── */}
      <div className="sp-card flex flex-col gap-[var(--sp-2-5)]">
        <p className="sp-label">Colores</p>
        <div className="flex items-center gap-[var(--sp-2-5)] min-w-0">
          <div className="flex gap-[var(--sp-1-5)] shrink-0">
            <Muestra color={colorPrimario} rotulo="Color primario" />
            <Muestra color={colorSecundario} rotulo="Color secundario" />
          </div>
          <p className="min-w-0 truncate text-[length:var(--sp-fs-meta)] font-semibold text-[var(--sp-ink-700)]">
            {nombrePaleta ?? 'Colores a medida'}
          </p>
        </div>
        <p className="sp-hint">Son el acento de la app y de los documentos que emites.</p>
      </div>
    </div>
  )
}

function Cedula({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[length:var(--sp-fs-legal)] font-bold uppercase tracking-[var(--sp-ls-label-w)] text-[var(--sp-ink-350)]">
        {rotulo}
      </p>
      <p className="truncate text-[length:var(--sp-fs-body-sm)] font-bold text-[var(--sp-ink-700)] tabular-nums">
        {valor}
      </p>
    </div>
  )
}

/* El aro claro no es decorativo: sin él, un primario muy oscuro y el borde de
   la card se funden y la muestra deja de leerse como muestra. */
function Muestra({ color, rotulo }: { color: string; rotulo: string }) {
  return (
    <span
      title={`${rotulo}: ${color}`}
      className="w-[26px] h-[26px] block rounded-[var(--sp-r-btn-sm)]"
      style={{ background: color, boxShadow: '0 0 0 1px var(--sp-line-card)' }}
    />
  )
}
