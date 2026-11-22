'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { ChevronRight, Plus, RotateCw } from 'lucide-react'
import { formatDistanceToNowStrict, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { TIPOS_DOCUMENTO, type TipoDocumento } from '@/components/documentos/SelectorTipoDocumento'
import { CabeceraTarjeta, AvisoTarjeta } from './piezasBanda2'
import IconoTipoDocumento from '@/components/ui/IconoTipoDocumento'
import { TARJETA } from './PiezasCita'

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
 * El «+ Nuevo» de la cabecera de esta tarjeta (rediseño B5, maqueta
 * `dashboard-final`): tonal, con el nombre accesible completo «Nuevo
 * documento». Abre el buscador de paciente que monta el dashboard —el mismo
 * componente que «Nueva consulta»— y entra a `/expediente/[id]/documentos`.
 * El manejador VIENE DE FUERA: el botón «Nuevo documento» de la cabecera de
 * acciones abre ESE MISMO modal, así que el estado vive en el padre común.
 */
function BotonNuevo({ onNuevo }: { onNuevo: () => void }) {
  return (
    <button type="button" onClick={onNuevo} aria-label="Nuevo documento" className="k-b k-b-tonal">
      <Plus aria-hidden="true" className="size-4" /> Nuevo
    </button>
  )
}

interface Props {
  /** Abre el buscador de paciente de «Nuevo documento», que monta el dashboard. */
  onNuevoDocumento: () => void
}

export function DocumentosCargando({ onNuevoDocumento }: Props) {
  return (
    <section className={TARJETA}>
      <CabeceraTarjeta titulo="Documentos recientes"><BotonNuevo onNuevo={onNuevoDocumento} /></CabeceraTarjeta>
      <div className="mt-2 flex flex-col" aria-hidden="true">
        {[1, 2, 3].map(i => <div key={i} className="skeleton my-2 h-10 rounded-[10px]" />)}
      </div>
    </section>
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
  const encabezado = (
    <CabeceraTarjeta titulo="Documentos recientes"><BotonNuevo onNuevo={onNuevoDocumento} /></CabeceraTarjeta>
  )

  if (loadingProfile || cargando) return <DocumentosCargando onNuevoDocumento={onNuevoDocumento} />

  if (error) return (
    <section className={TARJETA}>
      {encabezado}
      <AvisoTarjeta icono={RotateCw} mensaje="No se pudieron cargar los documentos." onReintentar={() => { setCargando(true); void cargar() }} />
    </section>
  )

  return (
    <section className={TARJETA}>
      {encabezado}
      {docs.length === 0 ? (
        <p className="py-6 text-center text-[14px] text-tinta2">Todavía no has generado documentos.</p>
      ) : (
      <ul className="k-lista mt-1">
        {docs.map(doc => {
          const key = TIPO_BD_A_KEY[doc.tipo]
          const meta = key ? TIPOS_DOCUMENTO.find(t => t.key === key) : undefined
          const pac = Array.isArray(doc.pacientes) ? doc.pacientes[0] : doc.pacientes

          return (
            <li key={doc.id}>
              <Link
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
                 ⚠️ EL PARÁMETRO SE LLAMA `documento` Y NO `doc`, y el motivo
                 de arriba estaba MAL CONTADO: decía que `doc` es «el borrador
                 que retoma el formulario», como si fuera un mecanismo vivo. No
                 lo es. `PanelDocumentos.tsx:450` navega con `&doc=…` pero la
                 página destino lee `borrador`
                 (`expediente/[id]/documentos/page.tsx:154`), así que «Seguir
                 editándolo» sobre un consentimiento en borrador abre el
                 formulario EN BLANCO. Es un defecto anterior a esta rama y
                 sigue abierto: no se arregla aquí, se deja señalado.
                 El nombre `documento` se mantiene igual —es el que la ficha ya
                 lee— y además no colisiona con ese `doc` averiado, sea cual sea
                 el nombre con el que acabe arreglándose.
                 Sin `paciente_id` no hay expediente al que ir y se mantiene el
                 destino de antes. */
              href={doc.paciente_id
                ? `/expediente/${doc.paciente_id}?tab=documentos&documento=${doc.id}`
                : '/documentos'}
              /* Sin precarga: misma cuenta que los doce de la columna vecina. */
              className="k-pulsable flex min-h-14 items-center gap-3 py-2.5"
            >
              {/* Icono del tipo en su color, sin fondo (CALMA §9, lista). Los tipos
                  sin entrada en el catálogo (subidas, heredados) salen en gris. */}
              <IconoTipoDocumento tipo={doc.tipo} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-semibold leading-5 text-tinta">{meta?.label ?? 'Documento'}</span>
                {/* ⚠️ `formatDistanceToNowStrict`, NO `formatDistanceToNow`: el
                    segundo mete «alrededor de» («hace alrededor de 1 mes»). */}
                <span className="truncate text-[13px] leading-[18px] text-tinta2">
                  {pac ? `${pac.nombre} ${pac.apellidos}` : 'Sin paciente'} · {formatDistanceToNowStrict(parseISO(doc.created_at), { locale: es, addSuffix: true })}
                </span>
              </span>
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-tinta3" />
            </Link>
            </li>
          )
        })}
      </ul>
      )}
    </section>
  )
}
