'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { parseISO, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { RotateCw, Stethoscope, Activity } from 'lucide-react'
import type { Consulta, Documento } from '@/types'
import { TIPOS_DOCUMENTO, type TipoDocumento } from '@/components/documentos/SelectorTipoDocumento'
import { useAnalitosRastreados, type MedicionResuelta } from '@/hooks/useAnalitosRastreados'
import { statusOf, type Sexo } from '@/lib/labs/utils'
import { AvisoColumna } from '@/components/dashboard/piezasBanda2'
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

/* ── Piezas de un hito ──────────────────────────────────────────────────── */

function ColumnaFecha({ cuando }: { cuando: string }) {
  const d = parseISO(cuando)
  return (
    <div className="pt-px text-right">
      <p className="text-[length:var(--sp-fs-meta)] font-bold leading-tight text-[var(--sp-ink-700)]">
        {format(d, 'd MMM', { locale: es })}
      </p>
      <p className="text-[11.5px] leading-tight text-[var(--sp-ink-350)] tabular-nums">
        {format(d, 'HH:mm')}
      </p>
    </div>
  )
}

function Marca({ color, ultimo, hueco = false }: { color: string; ultimo: boolean; hueco?: boolean }) {
  return (
    <>
      {/* El filete vertical del último hito no baja hasta el pie de la lista:
          se corta a la altura de su punto, para que la línea no quede colgando. */}
      <span
        aria-hidden
        className={`absolute left-0 top-0 w-[2px] ${ultimo ? 'h-[10px]' : 'h-full'}`}
        style={hueco
          ? { backgroundImage: 'repeating-linear-gradient(to bottom, var(--sp-line-dash) 0 4px, transparent 4px 8px)' }
          : { background: 'var(--sp-line-card)' }}
      />
      <span
        aria-hidden
        className="absolute -left-[4px] top-[3px] h-[10px] w-[10px] rounded-[var(--sp-r-pill)] border-2 border-[color:var(--sp-surface)] lg:-left-[5px] lg:h-[12px] lg:w-[12px]"
        style={hueco
          ? { background: 'var(--sp-surface)', boxShadow: `inset 0 0 0 2px ${color}` }
          : { background: color }}
      />
    </>
  )
}

/* ── Contenido por tipo de hito ─────────────────────────────────────────── */

function ContenidoConsulta({ consulta, onIrAPestana }: {
  consulta: Consulta
  onIrAPestana: (clave: ClavePestana, consultaId?: string) => void
}) {
  const plan = consulta.plan_tratamiento?.trim()
  return (
    <>
      <p className="text-[15.5px] font-bold leading-snug text-[var(--sp-ink-800)]">
        {tituloConsulta(consulta)}
      </p>
      {/* El resumen del plan sale en móvil, por el §3.1 del spec. */}
      {plan && (
        <p className="mt-[var(--sp-1)] hidden text-[length:var(--sp-fs-meta)] leading-[var(--sp-lh-body)] text-[var(--sp-ink-500)] lg:line-clamp-2">
          {plan}
        </p>
      )}
      <button
        type="button"
        /* ⚠️ PASA EL ID, NO SÓLO LA PESTAÑA. Antes sólo cambiaba de pestaña y
           el panel abría la más reciente, así que «Leer nota» sobre una consulta
           de hace un año abría otra. El id viaja por la url —`?consulta=`, el
           mismo mecanismo que `?tab`—, así que el destino es compartible y
           sobrevive a una recarga. */
        onClick={() => onIrAPestana('consultas', consulta.id)}
        className="mt-[var(--sp-2)] text-[length:var(--sp-fs-hint)] font-semibold text-[var(--sp-primary)] hover:underline"
      >
        Leer nota
      </button>
    </>
  )
}

function ContenidoDocumento({ documento, onIrAPestana }: {
  documento: Documento
  onIrAPestana: (clave: ClavePestana) => void
}) {
  const key = TIPO_BD_A_KEY[documento.tipo]
  const meta = key ? TIPOS_DOCUMENTO.find(t => t.key === key) : undefined
  const color = meta ? `var(--sp-doc-${meta.token})` : 'var(--sp-ink-350)'
  const referencia = referenciaDocumento(documento)

  return (
    <>
      <div className="flex flex-wrap items-center gap-[var(--sp-2)]">
        <span
          className="inline-flex items-center rounded-[9px] px-[11px] py-[5px] text-[12.5px] font-bold"
          style={{ color, background: `color-mix(in srgb, ${color} 12%, var(--sp-surface))` }}
        >
          {meta?.label ?? 'Documento'}
        </span>
        <button
          type="button"
          onClick={() => onIrAPestana('documentos')}
          className="text-[length:var(--sp-fs-hint)] font-semibold text-[var(--sp-primary)] hover:underline"
        >
          Ver
        </button>
      </div>
      {referencia && (
        <p className="mt-[var(--sp-1-5)] truncate text-[length:var(--sp-fs-meta)] text-[var(--sp-ink-600)]">
          {referencia}
        </p>
      )}
    </>
  )
}

function ContenidoMedicion({ medicion, sexo, onIrAPestana }: {
  medicion: MedicionResuelta
  sexo: Sexo
  onIrAPestana: (clave: ClavePestana) => void
}) {
  const estado = statusOf(medicion.valor, medicion.catalogo, sexo)
  const tintaValor =
    estado === 'bad' ? 'var(--sp-danger)'
    : estado === 'warn' ? 'var(--sp-warn-strong)'
    : 'var(--sp-ink-800)'

  return (
    <>
      <div className="flex flex-wrap items-center gap-[var(--sp-2)]">
        <span
          className="inline-flex items-center rounded-[9px] px-[11px] py-[5px] text-[12.5px] font-bold"
          style={{
            color: 'var(--sp-hito-medicion)',
            background: 'color-mix(in srgb, var(--sp-hito-medicion) 12%, var(--sp-surface))',
          }}
        >
          Medición
        </span>
        <button
          type="button"
          onClick={() => onIrAPestana('mediciones')}
          className="text-[length:var(--sp-fs-hint)] font-semibold text-[var(--sp-primary)] hover:underline"
        >
          Ver
        </button>
      </div>
      <p className="mt-[var(--sp-1-5)] text-[15.5px] font-bold leading-snug text-[var(--sp-ink-800)]">
        <span className="font-semibold text-[var(--sp-ink-600)]">{medicion.nombre}</span>{' '}
        <span className="tabular-nums" style={{ color: tintaValor }}>
          {medicion.valor}
          {medicion.unidad && <span className="text-[length:var(--sp-fs-meta)] font-semibold"> {medicion.unidad}</span>}
        </span>
      </p>
    </>
  )
}

/* ── Estados ────────────────────────────────────────────────────────────── */

function TimelineCargando() {
  return (
    <div className="flex flex-col gap-[var(--sp-5)]">
      {[1, 2, 3].map(i => (
        <div key={i} className="grid grid-cols-[58px_minmax(0,1fr)] gap-[var(--sp-4)] lg:grid-cols-[88px_minmax(0,1fr)]">
          <div className="skeleton h-[30px] rounded-[8px]" />
          <div className="skeleton h-[52px] rounded-[10px]" />
        </div>
      ))}
    </div>
  )
}

function TimelineVacio({ pacienteId, isDoctor }: { pacienteId: string; isDoctor: boolean }) {
  return (
    <div className="grid grid-cols-[58px_minmax(0,1fr)] gap-[var(--sp-4)] lg:grid-cols-[88px_minmax(0,1fr)]">
      <div className="pt-px text-right text-[length:var(--sp-fs-meta)] font-bold text-[var(--sp-ink-300)]">Hoy</div>
      <div className="relative pl-[14px] lg:pl-[20px]">
        <Marca color="var(--sp-line-dash)" ultimo={false} hueco />
        <p className="text-[15.5px] font-bold leading-snug text-[var(--sp-ink-800)]">
          Expediente recién creado
        </p>
        <p className="mt-[var(--sp-1)] text-[length:var(--sp-fs-meta)] leading-[var(--sp-lh-body)] text-[var(--sp-ink-500)]">
          Aquí se irá formando la historia clínica del paciente: cada consulta, cada
          documento y cada medición aparecerán en esta línea, de la más reciente a la
          más antigua.
        </p>
        {isDoctor && (
          <Link
            href={`/expediente/${pacienteId}/nueva-nota`}
            /* Sin precarga, como todo enlace nuevo del rediseño. */
            prefetch={false}
            className="sp-btn sp-btn--primary mt-[var(--sp-4)]"
            style={{ minHeight: '42px', height: '42px', padding: '0 20px', borderRadius: 'var(--sp-r-btn)', fontSize: 'var(--sp-fs-body-sm)' }}
          >
            <Stethoscope size={15} /> Iniciar primera consulta
          </Link>
        )}
      </div>
    </div>
  )
}

/* ── Componente ─────────────────────────────────────────────────────────── */

export default function LineaTiempoClinica({
  pacienteId, sexo, isDoctor, consultas, documentos,
  cargandoActividad, errorActividad, onReintentarActividad, onIrAPestana,
}: {
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
}) {
  const [filtro, setFiltro] = useState<Filtro>('todo')
  const { mediciones, isLoading: cargandoMediciones, error: errorMediciones, mutate } =
    useAnalitosRastreados(pacienteId)

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

  const cargando = cargandoActividad || cargandoMediciones
  const error = errorActividad || !!errorMediciones

  const reintentar = () => {
    onReintentarActividad()
    void mutate()
  }

  return (
    /* ⚠️ ALTO TOPE Y DESPLAZAMIENTO PROPIO EN LOS DOS TAMAÑOS. Con un paciente
       de mucha actividad la lista es interminable y hacía crecer la página
       entera; ahora se recorre dentro de la card, igual que la ficha de al lado.

       ⚠️⚠️ EL TOPE DE MÓVIL ES UNA EXCEPCIÓN DELIBERADA A «SCROLL INTERNO SÓLO
       EN ESCRITORIO», Y NO UN DESCUIDO QUE HAYA QUE CORREGIR. Esa regla vale
       para el resto de la vista —la ficha clínica, sin ir más lejos, sigue
       fluyendo en móvil— y existe porque una caja con scroll dentro de una
       página con scroll atrapa el gesto del dedo. Aquí ese coste se acepta a
       cambio de algo peor: sin tope, un expediente con cincuenta hitos
       convierte la pestaña entera en un desplazamiento sin fondo, y la ficha
       que va debajo deja de ser alcanzable en la práctica. El atrapamiento es
       además acotado: al llegar al final de la lista el navegador encadena el
       desplazamiento a la página. DECISIÓN TOMADA A PROPÓSITO; si vas a
       revertirla, que sea con ese caso en la mano, no por la regla general.

       Los dos valores:
       · 640 px en escritorio — EL MISMO tope de la ficha, y ése es el punto:
         las dos columnas de la banda 1 tienen que cortar a la misma altura o la
         banda queda despareja. Es además el que el anexo §10 da al historial de
         Consultas y el que usa el visor de nota, así que todas las columnas
         desplazables del expediente miden lo mismo.
       · 440 px en móvil — caben unos cuatro hitos más la banda, y ocupa cerca
         del 60 % de un viewport de 390×844. Deja ver el borde de lo que sigue,
         que es lo que avisa de que la pestaña continúa. No se iguala al de
         escritorio porque 640 px se comería la pantalla entera. */
    <section className="flex max-h-[440px] flex-col overflow-hidden rounded-[var(--sp-r-card)] border border-[color:var(--sp-line-card)] bg-[var(--sp-surface)] lg:max-h-[640px]">
      {/* ── Banda fija ───────────────────────────────────────────────────
          ⚠️ NO ES `sticky`, Y ES MEJOR QUE SERLO. Va FUERA del contenedor que
          desplaza —`shrink-0` en una columna flex— así que el texto no puede
          pasar por debajo ni hace falta pelearse con la opacidad ni con el
          apilamiento: la banda es una franja opaca de la card y punto. Es el
          mismo mecanismo que sostiene la cabecera de la ficha. El filete y la
          sombra al pie son lo que anuncia que la lista sigue por debajo.
          ⚠️ EL RELLENO SE REPARTE ENTRE BANDA Y LISTA. Estaba en la `section`,
          y ahí el relleno inferior habría quedado FUERA del área que desplaza:
          el último hito tocaría el borde de la card. */}
      <div className="shrink-0 border-b border-[color:var(--sp-line-divider)] bg-[var(--sp-surface)] px-[22px] py-[var(--sp-4)] shadow-[var(--sp-shadow-flat)]">
      <div className="flex flex-wrap items-center justify-between gap-[var(--sp-3)]">
        <h2 className="text-[length:var(--sp-fs-vitals)] font-bold text-[var(--sp-ink-800)]">
          Actividad clínica
        </h2>
        {/* Filtra en cliente sobre lo ya cargado: no vuelve a consultar. */}
        <div
          role="group"
          aria-label="Filtrar actividad por tipo"
          className="inline-flex rounded-[var(--sp-r-pill)] bg-[var(--sp-surface-muted)] p-[3px]"
        >
          {FILTROS.map(f => {
            const activo = f.clave === filtro
            return (
              <button
                key={f.clave}
                type="button"
                aria-pressed={activo}
                onClick={() => setFiltro(f.clave)}
                className="rounded-[var(--sp-r-pill)] px-[12px] py-[6px] text-[12.5px] transition-colors"
                style={activo
                  ? { background: 'var(--sp-surface)', color: 'var(--sp-ink-800)', fontWeight: 'var(--sp-fw-bold)', boxShadow: 'var(--sp-shadow-flat)' }
                  : { color: 'var(--sp-ink-500)', fontWeight: 'var(--sp-fw-semi)' }}
              >
                {f.rotulo}
              </button>
            )
          })}
        </div>
      </div>

      </div>

      {/* ── Lista de hitos: lo único que se desplaza ───────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto px-[22px] py-[var(--sp-4)]">
        {error ? (
          <AvisoColumna
            icono={RotateCw}
            mensaje="No se pudo cargar la actividad clínica."
            onReintentar={reintentar}
          />
        ) : cargando ? (
          <TimelineCargando />
        ) : hitos.length === 0 ? (
          <TimelineVacio pacienteId={pacienteId} isDoctor={isDoctor} />
        ) : visibles.length === 0 ? (
          <AvisoColumna icono={Activity} mensaje="No hay actividad de este tipo en el expediente." />
        ) : (
          <ul>
            {visibles.map((h, i) => {
              const ultimo = i === visibles.length - 1
              let color = 'var(--sp-primary)'
              if (h.tipo === 'documento') color = 'var(--sp-ink-350)'
              if (h.tipo === 'medicion') {
                color = statusOf(h.medicion.valor, h.medicion.catalogo, sexo) === 'bad'
                  ? 'var(--sp-danger)'
                  : 'var(--sp-hito-medicion)'
              }
              return (
                <li
                  key={`${h.tipo}-${h.id}`}
                  className="grid grid-cols-[58px_minmax(0,1fr)] gap-[var(--sp-4)] lg:grid-cols-[88px_minmax(0,1fr)]"
                >
                  <ColumnaFecha cuando={h.cuando} />
                  <div className={`relative pl-[14px] lg:pl-[20px] ${ultimo ? '' : 'pb-[var(--sp-5)]'}`}>
                    <Marca color={color} ultimo={ultimo} />
                    {h.tipo === 'consulta' && <ContenidoConsulta consulta={h.consulta} onIrAPestana={onIrAPestana} />}
                    {h.tipo === 'documento' && <ContenidoDocumento documento={h.documento} onIrAPestana={onIrAPestana} />}
                    {h.tipo === 'medicion' && <ContenidoMedicion medicion={h.medicion} sexo={sexo} onIrAPestana={onIrAPestana} />}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
