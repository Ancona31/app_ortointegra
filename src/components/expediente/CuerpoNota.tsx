'use client'

import { Fragment } from 'react'
import type { NotaRenderData } from '@/lib/notaRenderData'
import type { BloqueNota, SeccionNota } from '@/lib/notaParser'
import {
  SUBTITULO_SECCION, ordenarSecciones, tituloDe, numeroDe,
  fusionarEncabezadoItem, fraseDeRelleno,
} from '@/lib/notaSecciones'
import { renderEnTZ, TZ_CLINICA } from '@/lib/dates'

/**
 * El CONTENIDO de una nota clínica. Escrito una sola vez.
 *
 * Lo consumen los dos sitios donde se lee una nota: el panel de la pestaña
 * Consultas y la página `/expediente/[id]/consulta/[consultaId]`, que se
 * conserva para imprimir y para enlaces directos. Lo que cambia entre los dos
 * es el CHASIS —contenedor, cabecera, navegación—, nunca esto.
 *
 * ⚠️ LA FUENTE ES EL CUERPO, NO LOS CAMPOS. `motivo_consulta`,
 * `exploracion_fisica` y `plan_tratamiento` existen además como columnas
 * propias y AQUÍ NO SE LEEN: su contenido ya viaja dentro del cuerpo como
 * secciones, y leerlo por los dos caminos daría dos versiones del mismo texto.
 * El visor enseña lo que se imprimió. Decisión tomada; no la revuelvas.
 *
 * ⚠️ EL NÚMERO DE SECCIONES NO ESTÁ FIJADO EN NINGÚN SITIO. No hay N bloques
 * predeterminados: se recorre lo que el parser encontró en el texto. Pueden ser
 * cinco, siete o ninguna, y puede venir una que la app no reconoce, con título
 * arbitrario o sin él. Si alguna vez ves aquí una lista de secciones cableada,
 * es un bug.
 */

/* El único formato de fecha propio de la pantalla: el impreso usa la fecha
   larga y este es el de la atribución de una aclaratoria, `03/08/2026 14:15`.
   Zona de la clínica, como todo lo que fecha un documento clínico. */
function fechaAddendumPantalla(creadoEn: string | null): string {
  if (!creadoEn) return '—'
  const parsed = new Date(creadoEn)
  if (Number.isNaN(parsed.getTime())) return '—'
  try {
    return renderEnTZ(creadoEn, 'dd/MM/yyyy HH:mm', TZ_CLINICA)
  } catch {
    return '—'
  }
}

/* ── Bloques ────────────────────────────────────────────────────────────── */

function Spans({ bloque }: { bloque: BloqueNota }) {
  return (
    <>
      {bloque.spans.map((sp, i) =>
        sp.bold
          ? <strong key={i} className="font-bold text-[var(--sp-ink-800)]">{sp.texto}</strong>
          : <Fragment key={i}>{sp.texto}</Fragment>,
      )}
    </>
  )
}

/**
 * Los párrafos y los ítems de una sección.
 *
 * ⚠️ SOLO HAY DOS FORMAS DE CONTENIDO, párrafo e ítem, y dentro fragmentos en
 * negrita. Ni tablas, ni imágenes, ni encabezados de segundo nivel, ni enlaces:
 * el parser no los produce. Un párrafo en negrita terminado en dos puntos
 * («Farmacológico:») hace de subtítulo, y por eso lleva más aire encima. */
function Bloques({ bloques }: { bloques: BloqueNota[] }) {
  const lista = fusionarEncabezadoItem(bloques)
  return (
    <>
      {lista.map((b, i) => {
        const previo = lista[i - 1]
        const esSubtitulo =
          b.tipo === 'parrafo' && b.spans.length === 1 && b.spans[0].bold &&
          b.spans[0].texto.trimEnd().endsWith(':')
        /* Ritmo del §6: 3u entre párrafos, 3.5u antes de un subtítulo, nada
           antes del primero. */
        const separacion = i === 0 ? '' : esSubtitulo ? 'mt-[var(--sp-3-5)]' : 'mt-[var(--sp-3)]'

        if (b.tipo === 'item') {
          const primeroDeLista = previo?.tipo !== 'item'
          return (
            <p
              key={i}
              className={`${primeroDeLista ? separacion : 'mt-[var(--sp-1-5)]'} flex gap-[var(--sp-2)] text-[length:var(--sp-fs-body)] leading-[var(--sp-lh-note)] text-[var(--sp-ink-700)]`}
            >
              <span aria-hidden className="shrink-0 text-[var(--sp-ink-300)]">—</span>
              <span className="min-w-0"><Spans bloque={b} /></span>
            </p>
          )
        }
        return (
          <p
            key={i}
            className={`${separacion} text-[length:var(--sp-fs-body)] leading-[var(--sp-lh-note)] text-[var(--sp-ink-700)]`}
          >
            <Spans bloque={b} />
          </p>
        )
      })}
    </>
  )
}

/* ── Sección ────────────────────────────────────────────────────────────── */

function Seccion({ seccion, indice, primera }: {
  seccion: SeccionNota
  indice: number
  primera: boolean
}) {
  const relleno = fraseDeRelleno(seccion)
  const subtitulo = SUBTITULO_SECCION[seccion.tipo]

  /* Atenuada: la sección existe y no aporta información. NUNCA se oculta —que
     un campo se dejara vacío es un dato del expediente— pero baja de intensidad
     y su frase va en la misma línea del encabezado, con 3.5u encima en vez
     de 7u (§6). */
  const separacion = primera ? '' : relleno ? 'mt-[var(--sp-3-5)]' : 'mt-[var(--sp-7)]'

  if (relleno) {
    return (
      <div className={`${separacion} flex flex-wrap items-baseline gap-x-[var(--sp-2)] gap-y-[2px]`}>
        <span className="text-[length:var(--sp-fs-body-sm)] font-extrabold tabular-nums text-[var(--sp-ink-300)]">
          {numeroDe(indice)}
        </span>
        <h3 className="text-[length:var(--sp-fs-body-sm)] font-extrabold text-[var(--sp-ink-350)]">
          {tituloDe(seccion)}
        </h3>
        <p className="text-[length:var(--sp-fs-meta)] text-[var(--sp-ink-300)]">{relleno}</p>
      </div>
    )
  }

  return (
    <section className={separacion}>
      <div className="flex items-baseline gap-[var(--sp-2)]">
        <span className="text-[length:var(--sp-fs-body-sm)] font-extrabold tabular-nums text-[var(--sp-primary-text)]">
          {numeroDe(indice)}
        </span>
        <h3 className="text-[length:var(--sp-fs-body-sm)] font-extrabold text-[var(--sp-ink-800)]">
          {tituloDe(seccion)}
        </h3>
        {/* Las no reconocidas no llevan subtítulo: no hay ninguno que darles. */}
        {subtitulo && (
          <span className="text-[length:var(--sp-fs-hint)] text-[var(--sp-ink-350)]">{subtitulo}</span>
        )}
      </div>
      <div className="mt-[var(--sp-2)]">
        <Bloques bloques={seccion.bloques} />
      </div>
    </section>
  )
}

/* ── Franja de datos clínicos ───────────────────────────────────────────── */

const VITALES: readonly { clave: keyof NonNullable<NotaRenderData['signosVitales']>; rotulo: string; unidad: string }[] = [
  { clave: 'fc',   rotulo: 'FC',    unidad: 'lpm' },
  { clave: 'fr',   rotulo: 'FR',    unidad: 'rpm' },
  { clave: 'temp', rotulo: 'TEMP',  unidad: '°C' },
  { clave: 'spo2', rotulo: 'SPO₂',  unidad: '%' },
] as const

function Dato({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-[var(--sp-1-5)]">
      <span className="text-[length:var(--sp-fs-legal)] font-bold uppercase tracking-[var(--sp-ls-label)] text-[var(--sp-ink-350)]">
        {rotulo}
      </span>
      <span className="text-[length:var(--sp-fs-meta)] font-semibold tabular-nums text-[var(--sp-ink-700)]">
        {children}
      </span>
    </span>
  )
}

function FranjaDatos({ data }: { data: NotaRenderData }) {
  const { diagnosticos, motivoConsulta, signosVitales: sv, proximaCita, consultorio } = data

  /* La presión son DOS números y se presentan juntos; si sólo se capturó uno,
     el que falta va como guion DENTRO del par. Por eso no entra en la tabla
     de arriba, que es un valor por rótulo. */
  const ta = sv && (sv.ta_sistolica != null || sv.ta_diastolica != null)
    ? `${sv.ta_sistolica ?? '—'}/${sv.ta_diastolica ?? '—'}`
    : null

  const medidas = sv
    ? VITALES.filter(v => sv[v.clave] != null).map(v => ({ ...v, valor: String(sv[v.clave]) }))
    : []

  /* Sin ninguna medida, la franja de vitales entera desaparece. No existe el
     estado «sin signos vitales». */
  const hayVitales = !!ta || medidas.length > 0

  const dxTexto = diagnosticos.length > 0
    ? diagnosticos
        .filter(d => d.descripcion?.trim())
        .map(d => (d.codigo_cie10 ? `${d.codigo_cie10} · ${d.descripcion}` : d.descripcion))
    : motivoConsulta.trim()
      ? [motivoConsulta.trim()]
      : []

  return (
    <div className="border-b border-[color:var(--sp-line-divider)] pb-[var(--sp-4)]">
      {dxTexto.length > 0 && (
        <div className="flex flex-col gap-[var(--sp-1)]">
          {dxTexto.map((d, i) => (
            <p key={i} className="text-[length:var(--sp-fs-body-sm)] font-bold leading-snug text-[var(--sp-ink-800)]">
              {/* Con varios se numeran; con uno no. */}
              {dxTexto.length > 1 && <span className="tabular-nums text-[var(--sp-ink-350)]">{i + 1}. </span>}
              {d}
            </p>
          ))}
        </div>
      )}

      {(hayVitales || proximaCita) && (
        <div className="mt-[var(--sp-2-5)] flex flex-wrap items-baseline gap-x-[var(--sp-4)] gap-y-[var(--sp-1-5)]">
          {hayVitales && (
            <>
              <span className="text-[length:var(--sp-fs-legal)] font-bold uppercase tracking-[var(--sp-ls-label)] text-[var(--sp-ink-350)]">
                Signos <span className="text-[var(--sp-ink-600)]">VITALES</span>
              </span>
              {ta && <Dato rotulo="TA">{ta} <span className="font-normal text-[var(--sp-ink-350)]">mmHg</span></Dato>}
              {medidas.map(m => (
                <Dato key={m.clave} rotulo={m.rotulo}>
                  {m.valor} <span className="font-normal text-[var(--sp-ink-350)]">{m.unidad}</span>
                </Dato>
              ))}
            </>
          )}
          {/* Texto LIBRE, no una fecha: puede decir «en 15 días». No se formatea
              ni se presenta como si fuera una fecha estructurada. */}
          {proximaCita && <Dato rotulo="Próxima cita">{proximaCita}</Dato>}
        </div>
      )}

      {/* Las notas antiguas no traen consultorio: entonces no hay renglón. */}
      {consultorio.nombreCorto && (
        <p className="mt-[var(--sp-2)] text-[length:var(--sp-fs-legal)] text-[var(--sp-ink-350)]">
          Atendido en: <span className="font-semibold text-[var(--sp-ink-600)]">{consultorio.nombreCorto}</span>
        </p>
      )}
    </div>
  )
}

/* ── Bloque del médico ──────────────────────────────────────────────────── */

/**
 * ⚠️ SIN ESPACIO DE FIRMA NI LÍNEA DE FIRMA (§5 de la adenda). Ese hueco es una
 * necesidad del impreso, donde alguien puede firmar de puño; el visor es sólo
 * de lectura y reservarlo dejaba un rectángulo vacío sin función.
 */
function BloqueMedico({ medico }: { medico: NotaRenderData['medico'] }) {
  const cedulas = [
    medico.cedulaProfesional ? `Cédula Prof. ${medico.cedulaProfesional}` : '',
    medico.cedulaEspecialidad ? `Cédula Esp. ${medico.cedulaEspecialidad}` : '',
  ].filter(Boolean).join(' · ')

  if (!medico.nombre && !medico.especialidad && !cedulas) return null

  return (
    <div className="mt-[var(--sp-8)] max-w-[56%] border-t border-[color:var(--sp-line-divider)] pt-[var(--sp-3)]">
      {medico.nombre && (
        <p className="text-[length:var(--sp-fs-body-sm)] font-bold text-[var(--sp-ink-800)]">{medico.nombre}</p>
      )}
      {medico.especialidad && (
        <p className="text-[length:var(--sp-fs-meta)] text-[var(--sp-ink-500)]">{medico.especialidad}</p>
      )}
      {cedulas && (
        <p className="text-[length:var(--sp-fs-legal)] text-[var(--sp-ink-350)]">{cedulas}</p>
      )}
    </div>
  )
}

/* ── Notas aclaratorias ─────────────────────────────────────────────────── */

/**
 * ⚠️ EL TEXTO DE UNA ACLARATORIA NO SE INTERPRETA. El cuerpo de la nota se
 * parte en secciones y admite negritas; esto NO: se respetan los saltos de
 * línea y nada más, aunque el texto traiga `**` o encabezados. Es una
 * corrección firmada, no un documento con estructura.
 */
function Aclaratorias({ addendums }: { addendums: NotaRenderData['addendums'] }) {
  if (addendums.length === 0) return null

  return (
    <div className="mt-[var(--sp-7)]">
      <h3 className="text-[length:var(--sp-fs-body-sm)] font-extrabold text-[var(--sp-ink-800)]">
        Notas aclaratorias ({addendums.length})
      </h3>
      <div className="mt-[var(--sp-3)] flex flex-col gap-[var(--sp-4)]">
        {/* Orden cronológico ASCENDENTE — el único sitio del documento que lo
            lleva. Llegan así desde el servidor; no se reordena aquí. */}
        {addendums.map((a, i) => (
          <div key={i} className="border-l-2 border-[color:var(--sp-primary-border)] pl-[var(--sp-3)]">
            <div className="flex flex-wrap items-baseline justify-between gap-[var(--sp-2)]">
              <p className="text-[length:var(--sp-fs-meta)] font-semibold text-[var(--sp-ink-700)]">
                {a.medicoNombre || '—'}
                <span className="ml-[var(--sp-2)] font-normal tabular-nums text-[var(--sp-ink-350)]">
                  {fechaAddendumPantalla(a.creadoEn)}
                </span>
              </p>
              <span className="shrink-0 rounded-[var(--sp-r-pill)] bg-[var(--sp-surface-muted)] px-[8px] py-[2px] text-[length:var(--sp-fs-legal)] font-bold text-[var(--sp-ink-500)]">
                Sellado
              </span>
            </div>
            <p className="mt-[var(--sp-1-5)] whitespace-pre-line text-[length:var(--sp-fs-body)] leading-[var(--sp-lh-note)] text-[var(--sp-ink-700)]">
              {a.parseado.secciones
                .flatMap(s => s.bloques.map(b => b.spans.map(sp => sp.texto).join('')))
                .join('\n')}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Componente ─────────────────────────────────────────────────────────── */

export default function CuerpoNota({ data }: { data: NotaRenderData }) {
  const secciones = ordenarSecciones(data.notaParseada.secciones)

  return (
    <>
      <FranjaDatos data={data} />

      <div className="mt-[var(--sp-7)]">
        {secciones.length === 0 ? (
          <p className="text-[length:var(--sp-fs-body)] text-[var(--sp-ink-350)]">
            Sin nota de evolución registrada
          </p>
        ) : (
          secciones.map((sec, i) => (
            <Seccion key={`${sec.tipo}-${i}`} seccion={sec} indice={i} primera={i === 0} />
          ))
        )}
      </div>

      <BloqueMedico medico={data.medico} />
      <Aclaratorias addendums={data.addendums} />
    </>
  )
}
