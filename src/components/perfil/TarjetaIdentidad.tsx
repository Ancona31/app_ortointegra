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
  /* Rediseño B10 (maqueta `perfil`): UNA tarjeta. Arriba quién eres (logo,
     nombre, especialidad y cédulas en una línea); debajo, firma y colores
     lado a lado, salvo en `esc`, donde la tarjeta es la columna derecha de 264
     y van apilados. Sin sombra ni borde (CALMA §3). */
  return (
    <div className="k-tarjeta flex flex-col gap-4 esc:p-5">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-dashed border-tinta3 bg-sup"
          style={logoUrl ? { borderStyle: 'solid', borderColor: 'var(--linea)' } : undefined}
        >
          {logoUrl
            ? <img src={logoUrl} alt="Logo del consultorio" className="h-full w-full object-contain p-1" />
            : <IconoImagen size={20} aria-hidden="true" className="text-tinta2" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="k-t-tarjeta break-words">{nombre || 'Sin nombre'}</p>
          {/* ⚠️ DOS LÍNEAS, NO `truncate`: con dos especialidades la línea se
              cortaba justo en la segunda (medido antes del rediseño). */}
          {especialidad && <p className="k-t-sec mt-0.5 line-clamp-2">{especialidad}</p>}
        </div>
      </div>

      {(cedulaProfesional || cedulaEspecialidad) && (
        <div className="-mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {cedulaProfesional && <Cedula rotulo="Céd. profesional" valor={cedulaProfesional} />}
          {cedulaEspecialidad && <Cedula rotulo="Céd. especialidad" valor={cedulaEspecialidad} />}
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-linea pt-4 max-[359px]:grid-cols-1 esc:grid-cols-1">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="k-t-rotulo">Firma en documentos</p>
          <div className="flex h-14 items-center justify-center rounded-[12px] border border-dashed border-tinta3">
            {firmaUrl
              /* La firma es tinta negra sobre transparente: va sobre blanco
                 también en oscuro, como en el papel. */
              ? <img src={firmaUrl} alt="Firma guardada" className="max-h-[46px] max-w-full rounded-[6px] object-contain p-1" style={{ background: 'white' }} />
              : <span className="text-[13px] text-tinta2">Sin firma</span>}
          </div>
          <p className="text-[13px] leading-[18px] text-tinta2">Se imprime sobre la línea punteada de cada PDF.</p>
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <p className="k-t-rotulo">Colores</p>
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex shrink-0 gap-1">
              <Muestra color={colorPrimario} rotulo="Color primario" />
              <Muestra color={colorSecundario} rotulo="Color secundario" />
            </div>
            <p className="min-w-0 text-[13px] font-semibold leading-[18px] text-tinta">
              {nombrePaleta ?? 'Colores a medida'}
            </p>
          </div>
          <p className="text-[13px] leading-[18px] text-tinta2">Son el acento de la app y de los documentos que emites.</p>
        </div>
      </div>
    </div>
  )
}

function Cedula({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <p className="min-w-0 text-[13px] leading-[18px] text-tinta2">
      {rotulo} <span className="k-num font-semibold text-tinta">{valor}</span>
    </p>
  )
}

/* El aro no es decorativo: sin él, un primario muy oscuro y la tarjeta se
   funden y la muestra deja de leerse como muestra. */
function Muestra({ color, rotulo }: { color: string; rotulo: string }) {
  return (
    <span
      title={`${rotulo}: ${color}`}
      className="block h-6 w-6 rounded-[7px]"
      style={{ background: color, boxShadow: '0 0 0 1px var(--borde)' }}
    />
  )
}
