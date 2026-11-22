'use client'

import Link from 'next/link'
import { Calculator, ChevronDown, ChevronRight } from 'lucide-react'
import type { Paciente, Consulta } from '@/types'
import { useAnalitosRastreados } from '@/hooks/useAnalitosRastreados'
import { useDocumentosLabs } from '@/hooks/useDocumentosLabs'
import { statusOf, formatFechaCorta, type Sexo, type AnalitoStatus } from '@/lib/labs/utils'
import { ultimaConsultaFechaCompacta, formatFechaRelativaFutura } from '@/lib/expedienteUtils'
import EstadoError from '@/components/ui/EstadoError'
import { paresDatosPaciente } from './CabeceraPaciente'
import type { ClavePestana } from './PestanasExpediente'

/**
 * Región 3.2 del spec — la ficha clínica del Resumen.
 *
 * REDISEÑO B7 (maqueta `final-expediente`, CALMA §30.4): una tarjeta con el
 * último diagnóstico y sus tres datos, y otra de PLEGABLES con resumen a la
 * derecha —«Datos del paciente», «Antecedentes» (N apartados), «Antropometría»
 * (kg · cm), «Últimos analitos» (N analitos)— y la fila «Archivos clínicos»,
 * que salta a la pestaña de mediciones. En `esc` los tres primeros viven en la
 * columna izquierda de la página (`PlegablesFicha` con `enColumna`), así que
 * aquí se esconden con CSS. La banda de alergias se mudó a la cabecera
 * (`CabeceraPaciente`): etiqueta visible en las cuatro pestañas.
 * Sustituye a `PanelEstado`, que era el contenido de la ruta `/estado` mudado
 * de sitio: sus dos tarjetas se disuelven aquí, en el orden ESTRICTO por
 * prioridad que fija el spec.
 *
 * ⚠️ EL IMC SE CALCULA A PARTIR DE PESO Y TALLA; NO SE LEE DE `paciente.imc`.
 * La columna existe en la base y hoy nadie la escribe de forma fiable, así que
 * leerla enseñaría un valor viejo junto a un peso nuevo. La escritura llega con
 * la captura rápida de antropometría (§6.4 del spec); mientras tanto lo que se
 * pinta es siempre derivado de lo que hay en pantalla. No lo cambies a
 * `paciente.imc` «para no recalcular»: es justo la incoherencia que evita.
 *
 * ⚠️ EL BLOQUE SUPERIOR Y EL RESTO SON DOS HIJOS SUELTOS, Y `display: contents`
 * EN MÓVIL NO ES UN TRUCO DE ESTILO. El §3.2 pide que por debajo de `lg` el
 * orden sea diagnóstico+alergias, línea de tiempo, y luego el resto de la
 * ficha: o sea, la línea de tiempo va EN MEDIO de esta card. Con la card como
 * un solo hijo del grid eso no se puede expresar; con `contents` sus dos
 * secciones entran en el grid del Resumen y `order` las reparte. En `lg` el
 * envoltorio vuelve a ser una card normal y los `order` quedan inertes.
 */

export type ProximaCita = {
  id: string
  start_time: string
  end_time: string
  title: string
  status: string
}

const ANTECEDENTES = [
  { key: 'ant_no_patologicos',    label: 'No patológicos' },
  { key: 'ant_patologicos',       label: 'Patológicos' },
  { key: 'ant_quirurgicos',       label: 'Quirúrgicos' },
  { key: 'ant_familiares',        label: 'Familiares' },
  { key: 'medicamentos_actuales', label: 'Medicamentos' },
] as const

/**
 * Clasificación de la OMS, con su estado semántico.
 *
 * Reutiliza `AnalitoStatus` —el mismo semáforo que los analitos— en vez de
 * estrenar una escala propia: normal es «en rango», sobrepeso es «a vigilar» y
 * el resto es «fuera de rango», que es exactamente la lectura que el mockup le
 * da al chip (verde el peso normal, rojo lo que se sale).
 */
function clasificarImc(imc: number): { etiqueta: string; estado: AnalitoStatus } {
  if (imc < 18.5) return { etiqueta: 'Bajo peso',    estado: 'bad'  }
  if (imc < 25)   return { etiqueta: 'Normal',       estado: 'ok'   }
  if (imc < 30)   return { etiqueta: 'Sobrepeso',    estado: 'warn' }
  if (imc < 35)   return { etiqueta: 'Obesidad I',   estado: 'bad'  }
  if (imc < 40)   return { etiqueta: 'Obesidad II',  estado: 'bad'  }
  return            { etiqueta: 'Obesidad III', estado: 'bad'  }
}

/** Tinta del valor suelto, sin fondo: los pares del kit (CALMA §11). */
function tintaEstado(estado: AnalitoStatus): string {
  if (estado === 'ok')   return 'text-ok-tinta'
  if (estado === 'warn') return 'text-aviso-tinta'
  if (estado === 'bad')  return 'text-mal-tinta'
  return 'text-tinta'
}

/** La etiqueta del IMC: estado suave del kit (verde, ámbar, rojo). */
function etiquetaEstado(estado: AnalitoStatus): string {
  if (estado === 'ok')   return 'k-etq k-etq-ok'
  if (estado === 'warn') return 'k-etq k-etq-aviso'
  if (estado === 'bad')  return 'k-etq k-etq-mal'
  return 'k-etq'
}

/* ── Piezas ─────────────────────────────────────────────────────────────── */

/**
 * Una plegable de la ficha: título 15/600, el resumen a la derecha en
 * `--tinta2` y el cheurón que gira al abrir (sólo `transform`; quieto con
 * movimiento reducido). `<details>` nativo: teclado y lector sin JS.
 */
function Plegable({ titulo, resumen, children }: {
  titulo: string
  resumen?: string
  children: React.ReactNode
}) {
  return (
    <details className="group">
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-3 py-2 [&::-webkit-details-marker]:hidden ih:min-h-[48px] esc:min-h-[48px]">
        <span className="k-t-fila flex-1">{titulo}</span>
        {resumen && <span className="k-fila-der">{resumen}</span>}
        <ChevronDown size={16} aria-hidden="true" className="shrink-0 text-tinta3 transition-transform duration-[var(--dur-toque)] group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="pb-4">{children}</div>
    </details>
  )
}

/** Enlace tonal con la captura que falta. */
function Capturar({ href, texto }: { href: string; texto: string }) {
  return <Link href={href} prefetch={false} className="k-b k-b-tonal">{texto}</Link>
}

/** Pares «rótulo — valor» separados por una línea fina (CALMA §3). */
function Pares({ pares }: { pares: { r: React.ReactNode; v: React.ReactNode; k: string }[] }) {
  return (
    <dl className="k-lista">
      {pares.map(p => (
        <div key={p.k} className="flex items-baseline justify-between gap-4 py-2">
          <dt className="shrink-0 text-[13px] leading-[18px] text-tinta2">{p.r}</dt>
          <dd className="min-w-0 text-right text-[14px] leading-5 text-tinta [overflow-wrap:anywhere]">{p.v}</dd>
        </div>
      ))}
    </dl>
  )
}

function PlegableDatos({ paciente }: { paciente: Paciente }) {
  const pares = paresDatosPaciente(paciente)
  if (pares.length === 0) return null
  return (
    <Plegable titulo="Datos del paciente">
      <Pares pares={pares.map(p => ({ k: p.r, r: p.r, v: <span className="k-num">{p.v}</span> }))} />
    </Plegable>
  )
}

function PlegableAntecedentes({ paciente }: { paciente: Paciente }) {
  const antecedentes = ANTECEDENTES
    .map(a => ({ ...a, valor: paciente[a.key]?.trim() }))
    .filter(a => !!a.valor)
  const n = antecedentes.length
  return (
    <Plegable titulo="Antecedentes" resumen={n ? `${n} ${n === 1 ? 'apartado' : 'apartados'}` : undefined}>
      {n === 0 && !paciente.alergias?.trim() ? (
        <Capturar href={`/expediente/${paciente.id}/editar`} texto="Capturar antecedentes" />
      ) : n === 0 ? (
        <p className="k-t-sec">Sin antecedentes registrados.</p>
      ) : (
        /* Prosa libre de varias líneas: el valor va DEBAJO de su rótulo, a la
           izquierda, y no enfrente (no son cifras). */
        <dl className="k-lista">
          {antecedentes.map(a => (
            <div key={a.key} className="py-2">
              <dt className="text-[13px] leading-[18px] text-tinta2">{a.label}</dt>
              <dd className="mt-0.5 text-[14px] leading-5 text-tinta">{a.valor}</dd>
            </div>
          ))}
        </dl>
      )}
    </Plegable>
  )
}

/** ⚠️ LA EXPLICACIÓN DE QUE EL IMC ES CALCULADO VIVE EN EL `title` DEL ICONO. */
const ROTULO_IMC = (
  <span className="inline-flex items-center gap-1">
    IMC
    <span className="inline-flex text-enlace" title="Se calcula a partir del peso y la talla; no se captura.">
      <Calculator size={14} aria-label="Campo calculado" />
    </span>
  </span>
)

function PlegableAntropometria({ paciente }: { paciente: Paciente }) {
  const peso = paciente.peso_kg
  const talla = paciente.talla_cm
  const imc = peso != null && talla != null && talla > 0
    ? Math.round((peso / (talla / 100) ** 2) * 10) / 10
    : null
  const clasificacion = imc != null ? clasificarImc(imc) : null
  const resumen = [peso != null ? `${peso} kg` : null, talla != null ? `${talla} cm` : null].filter(Boolean).join(' · ')
  return (
    <Plegable titulo="Antropometría" resumen={resumen || undefined}>
      {peso == null && talla == null ? (
        <Capturar href={`/expediente/${paciente.id}/editar`} texto="Capturar peso y talla" />
      ) : (
        <Pares pares={[
          { k: 'peso', r: 'Peso', v: <span className="k-num">{peso != null ? `${peso} kg` : '—'}</span> },
          { k: 'talla', r: 'Talla', v: <span className="k-num">{talla != null ? `${talla} cm` : '—'}</span> },
          { k: 'imc', r: ROTULO_IMC, v: (
            <span className="inline-flex flex-wrap items-center justify-end gap-2">
              <span className="k-num">{imc != null ? `${imc} kg/m²` : '—'}</span>
              {clasificacion && <span className={etiquetaEstado(clasificacion.estado)}>{clasificacion.etiqueta}</span>}
            </span>
          ) },
        ]} />
      )}
    </Plegable>
  )
}

/**
 * Los tres plegables que salen del paciente (sin consultas). En `esc` viven
 * en la columna izquierda de la página (`enColumna`); en el resto, dentro de
 * la tarjeta de plegables del Resumen. Son marcado puro: dibujarlos en los
 * dos sitios no repite ninguna consulta.
 */
export function PlegablesFicha({ paciente, enColumna = false }: { paciente: Paciente; enColumna?: boolean }) {
  return (
    <div className={enColumna ? 'k-lista hidden border-b border-linea esc:block' : 'k-lista esc:hidden'}>
      {!enColumna && <PlegableDatos paciente={paciente} />}
      <PlegableAntecedentes paciente={paciente} />
      <PlegableAntropometria paciente={paciente} />
    </div>
  )
}

/* ── Componente ─────────────────────────────────────────────────────────── */

type PropsFicha = {
  paciente: Paciente
  consultas: Consulta[]
  /** El conteo REAL, no `consultas.length`: la lista viene acotada a 50. */
  totalConsultas: number | undefined
  proximaCita: ProximaCita | null
  cargandoActividad: boolean
  errorActividad: boolean
  onReintentarActividad: () => void
  onIrAPestana: (clave: ClavePestana) => void
}

/** Uno de los tres datos: renglón en teléfono; en `esc`, cifra sobre rótulo. */
function Dato({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5 esc:flex-col-reverse esc:items-start esc:justify-end esc:gap-0.5 esc:border-0 esc:py-0">
      <dt className="text-[14px] leading-5 text-tinta2 esc:text-[13px] esc:leading-[18px]">{rotulo}</dt>
      <dd className="k-num min-w-0 text-right text-[15px] leading-5 text-tinta esc:text-left">{children}</dd>
    </div>
  )
}

/** 1 · Último diagnóstico con la última consulta, la próxima cita y el conteo. */
function TarjetaDiagnostico({ consultas, totalConsultas, proximaCita, cargandoActividad, errorActividad, onReintentarActividad }: PropsFicha) {
  const dx = consultas
    .find(c => c.diagnosticos?.some(d => d.descripcion?.trim()))
    ?.diagnosticos?.find(d => d.descripcion?.trim())
  const ubicacion = 'order-1 ih:col-start-1 ih:row-start-1 iv:col-start-1 iv:row-start-1'
  if (errorActividad) {
    return <section className={`k-tarjeta ${ubicacion}`}><EstadoError variante="tarjeta" mensaje="No se pudo cargar el diagnóstico." alReintentar={onReintentarActividad} /></section>
  }
  if (cargandoActividad) {
    return (
      <section className={`k-tarjeta ${ubicacion}`} aria-busy="true">
        <div className="skeleton h-[18px] w-1/3 rounded-[6px]" />
        <div className="skeleton mt-2 h-[22px] w-2/3 rounded-[6px]" />
        <div className="skeleton mt-4 h-[40px] rounded-[8px]" />
      </section>
    )
  }
  return (
    <section className={`k-tarjeta ${ubicacion} esc:grid esc:grid-cols-[minmax(0,1fr)_auto_auto_auto] esc:items-center esc:gap-x-8`}>
      <div className="min-w-0">
        <p className="k-t-sec">Último diagnóstico{dx?.codigo_cie10 ? <> · <span className="k-num">CIE-10 {dx.codigo_cie10}</span></> : null}</p>
        <p className="k-t-tarjeta mt-0.5">{dx?.descripcion ?? 'Sin diagnóstico registrado'}</p>
      </div>
      <dl className="k-lista mt-2 esc:contents">
        {/* Fecha compacta —«8 sep 26»—: la larga no cabe en la columna estrecha. */}
        <Dato rotulo="Última consulta">{ultimaConsultaFechaCompacta(consultas) ?? '—'}</Dato>
        <Dato rotulo="Próxima cita">
          {proximaCita
            ? formatFechaRelativaFutura(proximaCita.start_time)
            : <Link href="/agenda" prefetch={false} className="font-semibold text-enlace hover:underline">Agendar</Link>}
        </Dato>
        <Dato rotulo="Consultas">{totalConsultas ?? '—'}</Dato>
      </dl>
    </section>
  )
}

/** «Últimos analitos»: los dos más recientes y el salto a la pestaña. Sin analitos, no se dibuja (§3.2). */
function PlegableAnalitos({ paciente, onIrAPestana }: { paciente: Paciente; onIrAPestana: (c: ClavePestana) => void }) {
  const sexo: Sexo = paciente.sexo
  const { analitos, mediciones, isLoading, error } = useAnalitosRastreados(paciente.id)
  /* Los DOS más recientes POR FECHA DE MEDICIÓN, de `mediciones` —las filas
     sueltas, ya en orden descendente—, que es lo que lleva la entrada de
     catálogo que `statusOf` necesita. */
  const ultimos: typeof mediciones = []
  for (const m of mediciones) {
    if (ultimos.length === 2) break
    if (!ultimos.some(u => u.clave === m.clave)) ultimos.push(m)
  }
  if (!isLoading && !error && ultimos.length === 0) return null
  return (
    <Plegable titulo="Últimos analitos" resumen={!isLoading && !error ? `${analitos.length} ${analitos.length === 1 ? 'analito' : 'analitos'}` : undefined}>
      {error ? (
        <p className="k-t-sec">No se pudieron cargar los analitos.</p>
      ) : isLoading ? (
        <div className="flex flex-col gap-2" aria-busy="true">{[1, 2].map(i => <div key={i} className="skeleton h-[36px] rounded-[8px]" />)}</div>
      ) : (
        <>
          <ul className="k-lista">
            {ultimos.map(a => (
              <li key={a.clave} className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold leading-5 text-tinta">{a.nombre}</span>
                  <span className="block text-[13px] leading-[18px] text-tinta2">{formatFechaCorta(a.medidoEn)}</span>
                </span>
                <span className={`k-num shrink-0 text-[15px] font-semibold ${tintaEstado(statusOf(a.valor, a.catalogo, sexo))}`}>
                  {a.valor}{a.unidad && <span className="text-[13px] font-normal text-tinta2"> {a.unidad}</span>}
                </span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => onIrAPestana('mediciones')} className="k-b k-b-texto mt-1">
            Ver {analitos.length} analitos
          </button>
        </>
      )}
    </Plegable>
  )
}

/** «Archivos clínicos»: una fila que salta a la pestaña de mediciones y archivos. */
function FilaArchivos({ pacienteId, onIrAPestana }: { pacienteId: string; onIrAPestana: (c: ClavePestana) => void }) {
  const { documentos: archivos, isLoading } = useDocumentosLabs(pacienteId)
  if (isLoading) return <div className="py-3"><div className="skeleton h-[28px] rounded-[8px]" aria-hidden="true" /></div>
  if (archivos.length === 0) {
    return (
      <div className="k-fila">
        <span className="k-fila-t"><span className="k-fila-n">Archivos clínicos</span></span>
        <span className="k-fila-der">Sin archivos clínicos.</span>
      </div>
    )
  }
  return (
    <button type="button" onClick={() => onIrAPestana('mediciones')} className="k-fila" aria-label={`Ver los ${archivos.length} archivos clínicos`}>
      <span className="k-fila-t"><span className="k-fila-n">Archivos clínicos</span></span>
      <span className="k-fila-der">{archivos.length} {archivos.length === 1 ? 'archivo' : 'archivos'}</span>
      <ChevronRight className="k-fila-chev" aria-hidden="true" />
    </button>
  )
}

/**
 * ⚠️ LAS DOS TARJETAS SON HIJOS SUELTOS DEL GRID DEL RESUMEN (`display:
 * contents`): en teléfono la línea de tiempo va EN MEDIO —diagnóstico,
 * actividad, plegables— y en ih/iv la columna izquierda es diagnóstico +
 * plegables y la derecha, la actividad. Lo coloca la página con `order` y
 * `col-start`, sin depender del orden del código.
 */
export default function FichaClinica(props: PropsFicha) {
  const { paciente, onIrAPestana } = props
  return (
    <div className="contents">
      <TarjetaDiagnostico {...props} />
      <section aria-label="Ficha del paciente" className="k-tarjeta k-lista order-3 ih:col-start-1 ih:row-start-2 iv:col-start-1 iv:row-start-2">
        <PlegablesFicha paciente={paciente} />
        <div className="k-lista esc:border-t-0">
          <PlegableAnalitos paciente={paciente} onIrAPestana={onIrAPestana} />
          <FilaArchivos pacienteId={paciente.id} onIrAPestana={onIrAPestana} />
        </div>
      </section>
    </div>
  )
}
