'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { FilePlus2, FileText, RotateCw } from 'lucide-react'
import { formatDistanceToNowStrict, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { TIPOS_DOCUMENTO, type TipoDocumento } from '@/components/documentos/SelectorTipoDocumento'
import { EncabezadoColumna, AvisoColumna } from './piezasBanda2'

/** Tres en escritorio, que es lo que iguala el alto de las dos columnas. */
const LIMITE = 3

/* ⚠️ `documentos.tipo` NO ES LA `key` DE `TIPOS_DOCUMENTO`, Y SÓLO COINCIDEN EN
   «receta». Ésta es la traducción entre las dos, y hay que escribirla porque no
   existía en ningún sitio:

     · La `key` de `TIPOS_DOCUMENTO` es lo que viaja en la URL del selector
       (`/documentos?tipo=lab`) — corta y sin prefijo.
     · `documentos.tipo` es lo que admite `documentos_tipo_check` en la base
       (`supabase/baseline/02_tables.sql:212`) — larga y con prefijo:
       `solicitud_lab`, `escrito_medico`, `nota_honorarios`…

   Sin esta tabla, siete de los ocho chips saldrían en blanco. NO «arregles» la
   divergencia renombrando una de las dos: la `key` está en URLs que el médico
   tiene guardadas y el `tipo` está escrito en cada fila de la base.

   ⚠️ Y HAY TIPOS DE BASE QUE NO TIENEN ENTRADA EN `TIPOS_DOCUMENTO`:
   `resultado_laboratorio` y `estudio_imagen` son SUBIDAS, no formatos que la
   app genere, y `informe_clinico` y `denegacion_consentimiento` son heredados.
   Son documentos recientes igual, así que se pintan con el chip neutro de
   abajo en vez de ocultarlos: esconder de la lista un estudio que el médico
   acaba de subir sería peor que no ponerle color. */
const TIPO_BD_A_KEY: Record<string, TipoDocumento> = {
  receta: 'receta',
  solicitud_lab: 'lab',
  solicitud_imagen: 'imagen',
  plan_suplementacion: 'suplementacion',
  solicitud_internamiento: 'internamiento',
  escrito_medico: 'escrito',
  consentimiento_informado: 'consentimiento',
  nota_honorarios: 'honorarios',
}

type Doc = {
  id: string
  tipo: string
  created_at: string
  paciente_id: string | null
  pacientes: { nombre: string; apellidos: string } | { nombre: string; apellidos: string }[] | null
}

/**
 * El «+ Nuevo documento» de la cabecera de esta columna.
 *
 * ⚠️ SÓLO SE PINTA EN `lg`, Y NO ES UNA DEGRADACIÓN: en móvil las dos columnas
 * de la banda se apilan y ésta cae al PIE de la página, a dos pantallas de la
 * cabecera, que es donde viven las demás acciones de creación. Así que en móvil
 * este botón no se esconde, se MUDA: hay uno gemelo a ancho completo en la
 * cabecera del dashboard (`(app)/dashboard/page.tsx`, marcado `lg:hidden`), y
 * los dos son el único par de la pantalla. Si tocas uno, mira el otro.
 *
 * El `lg:block` va en un envoltorio y no en el propio enlace a propósito:
 * `.sp-btn` declara `display: inline-flex` con la misma especificidad que la
 * utilidad `hidden`, así que quién gana lo decidiría el orden de la hoja. Con
 * el envoltorio no hay pelea. En móvil el envoltorio queda en `display: none`,
 * y un hijo así no participa del `flex` de la lista: no deja hueco suelto.
 */
function BotonNuevo({ onNuevo }: { onNuevo: () => void }) {
  return (
    <div className="hidden lg:block">
      {/* ⚠️ DEJÓ DE SER UN ENLACE (pulido de flujo, ítem 1). Iba a `/documentos`,
          la pantalla intermedia donde había que elegir paciente; ahora abre el
          buscador de paciente que vive en el dashboard —el mismo componente que
          «Nueva consulta»— y entra a `/expediente/[id]/documentos`.
          El manejador VIENE DE FUERA y el modal no se monta aquí: el gemelo
          móvil de la cabecera abre ESE MISMO, así que el estado tiene que vivir
          en el padre común de los dos. */}
      <button
        type="button"
        onClick={onNuevo}
        /* El relleno y la tinta salen de `.sp-btn--primary`; la geometría va en
           `style`, que gana a la clase, porque `.sp-btn` impone 44 px de alto.
           Mismo recurso que el resto del rediseño: es la única forma de que el
           blanco sobre acento entre sin cablear un hex. */
        className="sp-btn sp-btn--primary w-full"
        style={{ minHeight: '44px', height: '44px', padding: '0 16px', borderRadius: 'var(--sp-r-btn)', fontSize: 'var(--sp-fs-body-sm)' }}
      >
        <FilePlus2 size={16} /> Nuevo documento
      </button>
    </div>
  )
}

interface Props {
  /** Abre el buscador de paciente de «Nuevo documento», que monta el dashboard. */
  onNuevoDocumento: () => void
}

export function DocumentosCargando({ onNuevoDocumento }: Props) {
  return (
    <div>
      <EncabezadoColumna titulo="Documentos recientes" />
      <div className="mt-[var(--sp-gap-tiles)] flex flex-col gap-[var(--sp-gap-tiles)]">
        <BotonNuevo onNuevo={onNuevoDocumento} />
        {[1, 2, 3].map(i => <div key={i} className="skeleton h-[62px] rounded-[14px]" />)}
      </div>
    </div>
  )
}

export default function DocumentosRecientes({ onNuevoDocumento }: Props) {
  const { profile, loading: loadingProfile } = useProfile()
  const [docs, setDocs] = useState<Doc[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)
  const peticionRef = useRef(0)

  const medicoId = profile?.id ?? null

  const cargar = useCallback(async () => {
    if (!medicoId) return
    const mia = ++peticionRef.current
    setError(false)
    try {
      const supabase = createClient()
      /* SÓLO LOS SUYOS. `subido_por` lo escriben los ocho formularios y el modal
         de subida, así que es fiable. Mismo criterio que la lista de próximas
         citas: el dashboard es el resumen del médico que mira, no el de la
         clínica; para un administrador la RLS enseñaría los de todos y serían
         dos paneles contando cosas distintas en la misma pantalla. */
      const { data, error: errConsulta } = await supabase
        .from('documentos')
        .select('id, tipo, created_at, paciente_id, pacientes(nombre, apellidos)')
        .eq('subido_por', medicoId)
        .order('created_at', { ascending: false })
        .limit(LIMITE)

      if (mia !== peticionRef.current) return
      if (errConsulta) throw errConsulta
      setDocs((data as Doc[] | null) ?? [])
    } catch {
      if (mia !== peticionRef.current) return
      setError(true)
    } finally {
      if (mia === peticionRef.current) setCargando(false)
    }
  }, [medicoId])

  useEffect(() => { void cargar() }, [cargar])

  /* ⚠️ SIN ENLACE «VER TODOS», y no es un olvido: no hay listado global de
     documentos en la app. `/documentos` es el FLUJO DE CREACIÓN —el selector de
     tipo con el formulario dentro—, así que apuntarlo ahí mandaría al médico a
     crear uno nuevo cuando lo que pidió fue ver los que ya tiene. El listado por
     paciente vive dentro de su expediente. */
  const encabezado = <EncabezadoColumna titulo="Documentos recientes" />

  if (loadingProfile || cargando) return <DocumentosCargando onNuevoDocumento={onNuevoDocumento} />

  if (error) return (
    <div>
      {encabezado}
      <div className="mt-[var(--sp-gap-tiles)]"><BotonNuevo onNuevo={onNuevoDocumento} /></div>
      <AvisoColumna icono={RotateCw} mensaje="No se pudieron cargar los documentos." onReintentar={() => { setCargando(true); void cargar() }} />
    </div>
  )

  return (
    <div>
      {encabezado}
      <div className="mt-[var(--sp-gap-tiles)] flex flex-col gap-[var(--sp-gap-tiles)]">
        <BotonNuevo onNuevo={onNuevoDocumento} />

        {docs.length === 0 ? (
          <p className="rounded-[14px] border border-dashed border-[color:var(--sp-line-card)] px-[var(--sp-pad-row-x)] py-[var(--sp-5)] text-center text-[length:var(--sp-fs-body-sm)] text-[var(--sp-ink-500)]">
            Todavía no has generado documentos.
          </p>
        ) : docs.map(doc => {
          const key = TIPO_BD_A_KEY[doc.tipo]
          const meta = key ? TIPOS_DOCUMENTO.find(t => t.key === key) : undefined
          const pac = Array.isArray(doc.pacientes) ? doc.pacientes[0] : doc.pacientes
          const Icono = meta?.icon ?? FileText

          return (
            <Link
              key={doc.id}
              /* ⚠️ LLEVA A ESTE DOCUMENTO, NO SOLO AL EXPEDIENTE. Aquí iba
                 `/expediente/{id}` a secas, así que el expediente abría en
                 Resumen y el médico tenía que cambiar de pestaña y luego buscar
                 el documento entre las decenas que puede haber.
                 Los dos parámetros ya existían y esta columna era la única que
                 no los usaba: `tab` lo lee `expediente/[id]/page.tsx:47` y
                 `documento` su línea 58, que lo pasa al panel como
                 `documentoSolicitadoId`. Van en la URL —y no en un estado— para
                 que recargar y el botón de atrás funcionen, que es el criterio
                 de toda esta rama.
                 ⚠️ EL PARÁMETRO SE LLAMA `documento` Y NO `doc`: `doc` ya
                 significa otra cosa en `/expediente/[id]/documentos?doc=`, que
                 es el borrador que retoma el FORMULARIO. Son dos pantallas
                 distintas y conviene que no se parezcan.
                 Sin `paciente_id` no hay expediente al que ir y se mantiene el
                 destino de antes. */
              href={doc.paciente_id
                ? `/expediente/${doc.paciente_id}?tab=documentos&documento=${doc.id}`
                : '/documentos'}
              /* Sin precarga: misma cuenta que los doce de la columna vecina. */
              prefetch={false}
              /* Cada documento SÍ es una tarjeta individual con borde sutil; la
                 columna, no. Es la distinción de la adenda §4. */
              className="flex flex-col gap-[var(--sp-1-5)] rounded-[14px] border border-[color:var(--sp-line-card)] bg-[var(--sp-surface)] px-[var(--sp-pad-row-x)] py-[var(--sp-2-5)] transition-colors hover:bg-[var(--sp-surface-muted)]"
            >
              {/* ⚠️ AQUÍ LOS `--sp-doc-*` SALEN DE SU ALCANCE ORIGINAL, A
                  SABIENDAS. El comentario de `spinus-tokens.css:74` dice que la
                  identidad de color de cada formato se usa SÓLO en el selector
                  de tipo, nunca en un botón ni en un borde de card. Este chip es
                  una ampliación pequeña y deliberada: es la MISMA función
                  —nombrar el formato— en otra pantalla, y el color va sólo en el
                  punto y en la tinta del rótulo, nunca en el marco de la
                  tarjeta, que sigue siendo `--sp-line-card`. Si aparece un
                  tercer sitio, toca actualizar aquel comentario. */}
              {/* ⚠️ LA FECHA BAJÓ A LA SEGUNDA FILA, Y ES LA CORRECCIÓN DE UN
                  DESBORDE REAL. Antes esta fila era icono + rótulo + fecha con
                  los TRES en `shrink-0`: un hijo de flex que no puede encoger no
                  encoge, DESBORDA. Medido en la columna real —300 px menos 24 de
                  relleno y 1 de filete, o sea 245 de interior—, «HONORARIOS /
                  COTIZACIÓN» mide 164-182 px según la fuente y con una fecha
                  larga la fila pedía 301-344: se salía por 56-99 px y la fecha
                  acababa pintada fuera de la tarjeta.
                  ⚠️ Y NO ERA SÓLO HONORARIOS: el desborde depende del rótulo Y
                  de la cadena de fecha, así que rótulos medianos con «hace
                  alrededor de…» también se salían. Honorarios era el peor caso,
                  no el único.
                  Con el rótulo solo, la fila pide 178-201 de 245: entre 44 y 67
                  px de margen, y el tipo de documento —que es la identidad de la
                  tarjeta— nunca se corta. El `truncate` es el respaldo por si
                  algún día se añade un noveno tipo más largo: degradaría con
                  elipsis en vez de desbordar. */}
              <span className="flex items-center gap-[var(--sp-1-5)] min-w-0">
                <Icono size={13} className="shrink-0" style={meta ? { color: `var(--sp-doc-${meta.token})` } : { color: 'var(--sp-ink-350)' }} />
                <span
                  className="min-w-0 truncate text-[length:var(--sp-fs-legal)] font-bold uppercase tracking-[0.04em]"
                  style={meta ? { color: `var(--sp-doc-${meta.token})` } : { color: 'var(--sp-ink-350)' }}
                >
                  {meta?.label ?? 'Documento'}
                </span>
              </span>

              <span className="flex items-baseline gap-[var(--sp-2)] min-w-0">
                <span className="min-w-0 flex-1 truncate text-[length:var(--sp-fs-body-sm)] font-semibold text-[var(--sp-ink-800)]">
                  {pac ? `${pac.nombre} ${pac.apellidos}` : 'Sin paciente'}
                </span>
                {/* ⚠️ `formatDistanceToNowStrict`, NO `formatDistanceToNow`, y no
                    es cosmético: el segundo mete «alrededor de» y produce «hace
                    alrededor de 1 mes» (122-137 px) donde el estricto dice «hace
                    1 mes». Compartiendo línea con el nombre del paciente, esa
                    verbosidad le costaba la mitad del ancho. El estricto además
                    es más exacto: «hace 45 minutos» en vez de «hace alrededor de
                    1 hora». */}
                <span className="shrink-0 text-[length:var(--sp-fs-legal)] text-[var(--sp-ink-350)]">
                  {formatDistanceToNowStrict(parseISO(doc.created_at), { locale: es, addSuffix: true })}
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
