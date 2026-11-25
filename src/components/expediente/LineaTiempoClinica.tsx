'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { parseISO, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronRight, Stethoscope, Activity } from 'lucide-react'
import type { Consulta, Documento } from '@/types'
import { TIPOS_DOCUMENTO, type TipoDocumento } from '@/components/documentos/SelectorTipoDocumento'
import { useAnalitosRastreados, type MedicionResuelta } from '@/hooks/useAnalitosRastreados'
import { statusOf, type Sexo } from '@/lib/labs/utils'
import SelectorSegmentado from '@/components/ui/SelectorSegmentado'
import IconoTipoDocumento from '@/components/ui/IconoTipoDocumento'
import EstadoVacio from '@/components/ui/EstadoVacio'
import EstadoError from '@/components/ui/EstadoError'
import type { ClavePestana } from './PestanasExpediente'

/**
 * Región 3.1 del spec — la línea de tiempo de actividad clínica del Resumen.
 *
 * ⚠️ NO CONSULTA CONSULTAS NI DOCUMENTOS: los recibe por prop, ya acotados a 50
 * por el expediente. Las mediciones sí las lee con `useAnalitosRastreados`, pero
 * ESO TAMPOCO ES UNA CONSULTA NUEVA: la ficha clínica de al lado usa el mismo
 * hook con la misma clave de SWR, así que las dos columnas comparten una única
 * petición. No le añadas un `select` propio.
 *
 * ⚠️ SIN «CARGAR ACTIVIDAD ANTERIOR». El spec lo pide al pie, y no está aquí
 * porque el tope de 50 por origen se conserva en este bloque: un enlace que
 * pidiera más necesitaría paginar los tres orígenes a la vez. Vuelve cuando se
 * levante el tope, no antes — un botón que no trae nada es peor que ninguno.
 *
 * ⚠️ NINGÚN HITO DE CONSULTA LISTA LOS DOCUMENTOS QUE GENERÓ. El mockup lo
 * dibuja, pero el vínculo consulta↔documento se retiró: la columna existe y
 * ningún formulario la escribe, así que la fila saldría siempre vacía. No la
 * reintroduzcas sin que antes haya un productor de ese dato.
 */

/* ⚠️ COPIA DELIBERADA DE LA TABLA DE `DocumentosRecientes.tsx`. `documentos.tipo`
   (lo que admite `documentos_tipo_check`) y la `key` de `TIPOS_DOCUMENTO` (lo que
   viaja en la URL del selector) sólo coinciden en «receta», y la traducción entre
   las dos no vive en ningún módulo compartido. Se duplica en vez de extraerse
   porque son dos pantallas con dos listas distintas; si aparece una tercera,
   entonces sí toca sacarla a `src/lib`. Los tipos sin entrada —las SUBIDAS
   `resultado_laboratorio` y `estudio_imagen`, y los heredados `informe_clinico`
   y `denegacion_consentimiento`— caen al chip neutro de abajo en vez de
   ocultarse: un estudio recién subido es actividad clínica igual. */
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

/** El mismo tope que traen consultas y documentos, aplicado al tercer origen. */
const TOPE_POR_ORIGEN = 50

type Filtro = 'todo' | 'consulta' | 'documento' | 'medicion'

const FILTROS: readonly { clave: Filtro; rotulo: string }[] = [
  { clave: 'todo',       rotulo: 'Todo' },
  { clave: 'consulta',   rotulo: 'Consultas' },
  { clave: 'documento',  rotulo: 'Documentos' },
  { clave: 'medicion',   rotulo: 'Mediciones' },
] as const

/* Cada origen trae su propio campo de fecha —`fecha`, `created_at`, `medido_en`—
   y la unión los normaliza a uno solo para poder ordenarlos entre sí. */
type Hito =
  | { tipo: 'consulta';  id: string; cuando: string; consulta: Consulta }
  | { tipo: 'documento'; id: string; cuando: string; documento: Documento }
  | { tipo: 'medicion';  id: string; cuando: string; medicion: MedicionResuelta }

/** Referencia legible de un documento: folio, si no diagnóstico, si no título. */
function referenciaDocumento(doc: Documento): string | null {
  const c = doc.contenido ?? {}
  const candidatos = [c.folio, c.diagnostico, c.titulo, doc.nombre_original]
  return candidatos.find(v => typeof v === 'string' && v.trim()) ?? null
}

/** Título del hito de consulta: el primer diagnóstico con descripción. */
function tituloConsulta(c: Consulta): string {
  const dx = c.diagnosticos?.find(d => d.descripcion?.trim())
  if (!dx) return c.motivo_consulta?.trim() || 'Consulta'
  return dx.codigo_cie10 ? `${dx.codigo_cie10} · ${dx.descripcion}` : dx.descripcion
}

/* ── Una fila (rediseño B7, CALMA §2, §9, §11) ─────────────────────────────
   La fila ENTERA es el botón y termina en «›»: sin «Leer nota» ni «Ver»
   sueltos. Icono a la izquierda —el del tipo con su color en los documentos
   (§9), el estetoscopio en las consultas, el pulso en las mediciones—, título
   15/600, la línea secundaria con la fecha y, como mucho, una etiqueta de
   estado («Borrador», «Urgente», «Fuera de rango»). */

function cuandoCorto(cuando: string): string {
  return format(parseISO(cuando), 'd MMM', { locale: es })
}

function FilaHito({ icono, titulo, secundaria, etiqueta, onPulsar, etiquetaAccesible }: {
  icono: React.ReactNode
  titulo: React.ReactNode
  secundaria: string
  etiqueta?: React.ReactNode
  onPulsar: () => void
  etiquetaAccesible?: string
}) {
  return (
    <li>
      <button type="button" onClick={onPulsar} aria-label={etiquetaAccesible} className="k-fila">
        <span className="flex w-6 shrink-0 justify-center self-start pt-0.5">{icono}</span>
        <span className="k-fila-t">
          <span className="k-fila-n">{titulo}</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="k-fila-s k-num">{secundaria}</span>
            {etiqueta}
          </span>
        </span>
        <ChevronRight className="k-fila-chev" aria-hidden="true" />
      </button>
    </li>
  )
}

function FilaConsulta({ consulta, onIrAPestana }: { consulta: Consulta; onIrAPestana: (clave: ClavePestana, consultaId?: string) => void }) {
  const titulo = tituloConsulta(consulta)
  return (
    <FilaHito
      icono={<Stethoscope size={20} aria-hidden="true" className="text-tinta2" />}
      titulo={titulo}
      secundaria={`${cuandoCorto(consulta.fecha)} · ${format(parseISO(consulta.fecha), 'HH:mm')}`}
      /* ⚠️ PASA EL ID, NO SÓLO LA PESTAÑA: viaja por `?consulta=` y abre ESA
         nota, no la más reciente. El nombre accesible conserva «Leer nota». */
      onPulsar={() => onIrAPestana('consultas', consulta.id)}
      etiquetaAccesible={`Leer nota: ${titulo}`}
    />
  )
}

function FilaDocumento({ documento, onIrAPestana }: { documento: Documento; onIrAPestana: (clave: ClavePestana) => void }) {
  const key = TIPO_BD_A_KEY[documento.tipo]
  const meta = key ? TIPOS_DOCUMENTO.find(t => t.key === key) : undefined
  const referencia = referenciaDocumento(documento)
  const urgente = documento.contenido?.urgente === true
  return (
    <FilaHito
      icono={<IconoTipoDocumento tipo={documento.tipo} />}
      titulo={meta?.label ?? 'Documento'}
      secundaria={[cuandoCorto(documento.created_at ?? ''), referencia].filter(Boolean).join(' · ')}
      etiqueta={documento.estado === 'borrador'
        ? <span className="k-etq k-etq-aviso">Borrador</span>
        : urgente ? <span className="k-etq k-etq-mal">Urgente</span> : undefined}
      onPulsar={() => onIrAPestana('documentos')}
    />
  )
}

function FilaMedicion({ medicion, sexo, onIrAPestana }: { medicion: MedicionResuelta; sexo: Sexo; onIrAPestana: (clave: ClavePestana) => void }) {
  const fuera = statusOf(medicion.valor, medicion.catalogo, sexo) === 'bad'
  return (
    <FilaHito
      icono={<Activity size={20} aria-hidden="true" className="text-tinta2" />}
      titulo={<>{medicion.nombre} <span className="k-num font-normal">{medicion.valor}{medicion.unidad ? ` ${medicion.unidad}` : ''}</span></>}
      secundaria={cuandoCorto(medicion.medidoEn)}
      etiqueta={fuera ? <span className="k-etq k-etq-mal">Fuera de rango</span> : undefined}
      onPulsar={() => onIrAPestana('mediciones')}
    />
  )
}

/* ── Estados ────────────────────────────────────────────────────────────── */

function TimelineCargando() {
  return (
    <div className="flex flex-col gap-3 py-4" aria-busy="true">
      {[1, 2, 3].map(i => <div key={i} className="skeleton h-[44px] rounded-[8px]" />)}
    </div>
  )
}

function TimelineVacio({ pacienteId, isDoctor }: { pacienteId: string; isDoctor: boolean }) {
  return (
    <div className="flex flex-col items-center px-2 py-6 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-tonal text-tonal-tinta">
        <Stethoscope size={24} aria-hidden="true" />
      </span>
      <h3 className="k-t-tarjeta">Expediente recién creado</h3>
      <p lang="es" className="mt-1 max-w-[42ch] text-[14px] leading-5 text-tinta2 [hyphens:auto] [text-align:justify]">
        Aquí se irá formando la historia clínica del paciente: cada consulta, cada
        documento y cada medición aparecerán en esta línea, de la más reciente a la
        más antigua.
      </p>
      {/* Tonal: el relleno de la pantalla ya es «Nueva consulta» de la cabecera. */}
      {isDoctor && (
        <Link href={`/expediente/${pacienteId}/nueva-nota`} prefetch={false} className="k-b k-b-tonal mt-3">
          Iniciar primera consulta
        </Link>
      )}
    </div>
  )
}

/* ── Componente ─────────────────────────────────────────────────────────── */

type PropsLinea = {
  pacienteId: string
  sexo: Sexo
  isDoctor: boolean
  consultas: Consulta[]
  documentos: Documento[]
  cargandoActividad: boolean
  errorActividad: boolean
  onReintentarActividad: () => void
  /** El segundo argumento abre una nota concreta; sin él, sólo cambia de pestaña. */
  onIrAPestana: (clave: ClavePestana, consultaId?: string) => void
}

function CuerpoLinea({ hitos, visibles, cargando, error, reintentar, sexo, ...p }: PropsLinea & {
  hitos: Hito[]; visibles: Hito[]; cargando: boolean; error: boolean; reintentar: () => void
}) {
  if (error) return <EstadoError variante="tarjeta" mensaje="No se pudo cargar la actividad clínica." alReintentar={reintentar} />
  if (cargando) return <TimelineCargando />
  if (hitos.length === 0) return <TimelineVacio pacienteId={p.pacienteId} isDoctor={p.isDoctor} />
  if (visibles.length === 0) return <EstadoVacio variante="seccion" icono={Activity} titulo="No hay actividad de este tipo en el expediente." />
  return (
    <ul className="k-lista">
      {visibles.map(h => (
        h.tipo === 'consulta' ? <FilaConsulta key={`c-${h.id}`} consulta={h.consulta} onIrAPestana={p.onIrAPestana} />
        : h.tipo === 'documento' ? <FilaDocumento key={`d-${h.id}`} documento={h.documento} onIrAPestana={p.onIrAPestana} />
        : <FilaMedicion key={`m-${h.id}`} medicion={h.medicion} sexo={sexo} onIrAPestana={p.onIrAPestana} />
      ))}
    </ul>
  )
}

export default function LineaTiempoClinica(props: PropsLinea) {
  const { consultas, documentos, cargandoActividad, errorActividad, onReintentarActividad } = props
  const [filtro, setFiltro] = useState<Filtro>('todo')
  const { mediciones, isLoading: cargandoMediciones, error: errorMediciones, mutate } =
    useAnalitosRastreados(props.pacienteId)

  const hitos = useMemo<Hito[]>(() => {
    const todos: Hito[] = [
      ...consultas.map((c): Hito => ({ tipo: 'consulta', id: c.id, cuando: c.fecha, consulta: c })),
      ...documentos.map((d): Hito => ({ tipo: 'documento', id: d.id, cuando: d.created_at ?? '', documento: d })),
      ...mediciones.slice(0, TOPE_POR_ORIGEN)
        .map((m): Hito => ({ tipo: 'medicion', id: m.id, cuando: m.medidoEn, medicion: m })),
    ]
    return todos
      .filter(h => h.cuando)
      .sort((a, b) => b.cuando.localeCompare(a.cuando))
  }, [consultas, documentos, mediciones])

  const visibles = filtro === 'todo' ? hitos : hitos.filter(h => h.tipo === filtro)

  const reintentar = () => {
    onReintentarActividad()
    void mutate()
  }

  return (
    /* ⚠️ ALTO TOPE Y DESPLAZAMIENTO PROPIO, COMO ANTES (decisión tomada a
       propósito): sin tope, un expediente con cincuenta hitos convierte la
       pestaña en un desplazamiento sin fondo y lo que va debajo deja de ser
       alcanzable. 640 en computadora, 520 en el resto. La cabecera (título y
       filtro) va FUERA de la tarjeta que desplaza. */
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby="titulo-actividad">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 id="titulo-actividad" className="k-t-tarjeta">Actividad clínica</h2>
        {/* Filtra en cliente sobre lo ya cargado: no vuelve a consultar. En ext,
            ih e iv (columna estrecha), a 12 px y con menos relleno para que quepan las cuatro. */}
        <SelectorSegmentado
          opciones={FILTROS.map(f => ({ valor: f.clave, rotulo: f.rotulo }))}
          valor={filtro}
          onChange={setFiltro}
          etiqueta="Filtrar actividad por tipo"
          className="ext:[&_.k-seg-op]:px-2 ext:[&_.k-seg-op]:text-[12px] ih:[&_.k-seg-op]:px-2 ih:[&_.k-seg-op]:text-[12px] iv:[&_.k-seg-op]:px-2 iv:[&_.k-seg-op]:text-[12px] tel:[&_.k-seg-op]:px-2.5"
        />
      </div>
      <div className="k-tarjeta k-lista max-h-[520px] overflow-y-auto esc:max-h-[640px]">
        <CuerpoLinea {...props} hitos={hitos} visibles={visibles} cargando={cargandoActividad || cargandoMediciones}
          error={errorActividad || !!errorMediciones} reintentar={reintentar} />
      </div>
    </section>
  )
}
