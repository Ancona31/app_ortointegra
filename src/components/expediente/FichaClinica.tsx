'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { AlertTriangle, Calculator, FileText, Image as ImageIcon, File, RotateCw } from 'lucide-react'
import type { Paciente, Consulta } from '@/types'
import { useAnalitosRastreados } from '@/hooks/useAnalitosRastreados'
import { useDocumentosLabs } from '@/hooks/useDocumentosLabs'
import { statusOf, formatFechaCorta, type Sexo, type AnalitoStatus } from '@/lib/labs/utils'
import { ultimaConsultaFechaCompacta, formatFechaRelativaFutura } from '@/lib/expedienteUtils'
import { AvisoColumna } from '@/components/dashboard/piezasBanda2'
import type { ClavePestana } from './PestanasExpediente'

/**
 * Región 3.2 del spec — la ficha clínica de la columna derecha del Resumen.
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

/**
 * Tinta del valor suelto, SIN fondo, sobre la superficie de la card.
 *
 * ⚠️ NO USA `--sp-success` NI `--sp-warn-strong`, Y NO ES CAPRICHO. Los dos se
 * quedan cortos de contraste sobre `--sp-surface` en claro —3.30:1 y 3.19:1
 * medidos— y esto es texto de 15 px, o sea que le toca el 4.5:1 del §7 del
 * spec. Los sustitutos son tokens que YA existen y en su rol declarado:
 * `--sp-success-strong` es «marcadores verdes» (5.35:1 claro / 10.94 oscuro) y
 * `--sp-warn` es «texto de banner y badge ámbar» (5.02 / 11.56). `--sp-danger`
 * ya cumplía (5.44 / 6.03). No se estrenó ningún token para esto. */
function tintaEstado(estado: AnalitoStatus): string {
  if (estado === 'ok')   return 'var(--sp-success-strong)'
  if (estado === 'warn') return 'var(--sp-warn)'
  if (estado === 'bad')  return 'var(--sp-danger)'
  return 'var(--sp-ink-800)'
}

/**
 * Fondo y tinta del chip del IMC, que sí lleva superficie propia.
 * Medidos tinta sobre fondo: ok 4.84:1 claro / 8.74 oscuro · warn 4.67 / 7.5 ·
 * bad 4.96 / 5.23. Los tres por encima de 4.5:1.
 */
function chipEstado(estado: AnalitoStatus): { background: string; color: string } {
  if (estado === 'ok')   return { background: 'var(--sp-success-bg)', color: 'var(--sp-success-strong)' }
  if (estado === 'warn') return { background: 'var(--sp-warn-bg)',    color: 'var(--sp-warn)' }
  if (estado === 'bad')  return { background: 'var(--sp-danger-bg)',  color: 'var(--sp-danger)' }
  return { background: 'var(--sp-surface-muted)', color: 'var(--sp-ink-600)' }
}

function iconoArchivo(mime: string | null | undefined) {
  if (mime?.startsWith('image/')) return ImageIcon
  if (mime === 'application/pdf') return FileText
  return File
}

/* ── Piezas ─────────────────────────────────────────────────────────────── */

/**
 * ⚠️ LA ACCIÓN VA EN EL RENGLÓN DEL TÍTULO, NO DEBAJO DEL CONTENIDO. «Ver los N
 * analitos» ocupaba una línea propia más su margen —unos 30 px— para un enlace
 * de siete palabras; en la línea del rótulo, que ya está ahí y va medio vacía,
 * cuesta cero. Mismo patrón que `EncabezadoColumna` en el dashboard.
 */
function Seccion({ titulo, accion, children }: {
  titulo: string
  accion?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="border-t border-[color:var(--sp-line-card)] px-[20px] py-[var(--sp-3-5)] first:border-t-0 lg:first:border-t">
      <div className="flex items-baseline justify-between gap-[var(--sp-2)]">
        <h3 className="text-[11.5px] font-bold uppercase tracking-[var(--sp-ls-label)] text-[var(--sp-ink-350)]">
          {titulo}
        </h3>
        {accion}
      </div>
      <div className="mt-[var(--sp-2)]">{children}</div>
    </div>
  )
}

/** Bloque punteado con la acción que falta capturar. */
function Capturar({ href, texto }: { href: string; texto: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="flex items-center justify-center rounded-[12px] border border-dashed border-[color:var(--sp-line-dash)] px-[var(--sp-3)] py-[var(--sp-4)] text-[length:var(--sp-fs-hint)] font-semibold text-[var(--sp-primary-text)] transition-colors hover:bg-[var(--sp-primary-bg-faint)]"
    >
      {texto}
    </Link>
  )
}

/**
 * Uno de los tres datos del bloque de diagnóstico.
 *
 * ⚠️ ES UN RENGLÓN, NO UNA COLUMNA, Y ESO ES LO QUE ARREGLA EL RECORTE. Los
 * tres iban en `grid-cols-3` dentro de una columna de 330 px: a ~93 px por
 * celda, «ÚLTIMA CONSULTA» en versales con interletraje no cabe y salía como
 * «ÚLTIMA CONS…». Repartir el ancho en tres partes iguales sólo funciona si los
 * tres rótulos miden parecido, y aquí miden 9, 12 y 15 caracteres. En renglón
 * el rótulo dispone de todo el ancho que le sobre al valor, que es corto
 * siempre. El §3.2 pide los tres datos «en línea» dentro del bloque, no en tres
 * columnas: la disposición es cosa de la app.
 */
function RenglonDato({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-[var(--sp-3)]">
      <p className="shrink-0 text-[10.5px] font-bold uppercase tracking-[var(--sp-ls-label)] text-[var(--sp-ink-350)]">
        {rotulo}
      </p>
      <p className="min-w-0 truncate text-[length:var(--sp-fs-meta)] font-bold text-[var(--sp-ink-700)]">
        {children}
      </p>
    </div>
  )
}

function Tile({ rotulo, valor, unidad }: { rotulo: string; valor: string; unidad?: string }) {
  return (
    <div
      className="rounded-[10px] px-[10px] py-[9px]"
      style={{ background: 'var(--sp-surface-sunken)', border: '1px solid var(--sp-line-soft)' }}
    >
      <p className="text-[10.5px] font-bold uppercase tracking-[var(--sp-ls-label)] text-[var(--sp-ink-350)]">
        {rotulo}
      </p>
      <p className="mt-[2px] text-[length:var(--sp-fs-display-sm)] font-extrabold leading-tight tabular-nums text-[var(--sp-ink-800)]">
        {valor}
        {unidad && <span className="text-[length:var(--sp-fs-legal)] font-semibold text-[var(--sp-ink-350)]"> {unidad}</span>}
      </p>
    </div>
  )
}

/**
 * El IMC, en su propio renglón a ancho completo bajo peso y talla.
 *
 * ⚠️ NO ES UN TERCER TILE EN LA MISMA FILA, Y ES DELIBERADO. En la columna de
 * 330 px cada tile mide ~91 px, de los que 71 son útiles: ahí no cabe el chip
 * de clasificación junto a la cifra —«Obesidad III» pide ~74 px él solo— y por
 * eso el chip acababa colgado dos renglones más abajo, detrás de la nota. A
 * ancho completo caben rótulo, cifra y chip en UNA línea, y sale más corto que
 * lo que había: tres tiles + nota de dos líneas + chip suelto eran ~100 px;
 * esto son ~40. El §3.2 pide tres tiles; la disposición la manda la app.
 *
 * ⚠️ LA EXPLICACIÓN DE QUE ES CALCULADO VIVE EN EL `title` DEL ICONO. Estaba en
 * el cuerpo, en dos líneas, para decir lo que el icono ya dice. */
function RenglonImc({ valor, clasificacion }: {
  valor: string
  clasificacion: { etiqueta: string; estado: AnalitoStatus } | null
}) {
  return (
    <div
      className="mt-[var(--sp-2)] flex items-center justify-between gap-[var(--sp-2)] rounded-[10px] px-[10px] py-[9px]"
      style={{ background: 'var(--sp-primary-bg-soft)', border: '1px solid var(--sp-primary-border)' }}
    >
      <span className="flex items-center gap-[4px] text-[10.5px] font-bold uppercase tracking-[var(--sp-ls-label)] text-[var(--sp-ink-350)]">
        IMC
        <span
          className="inline-flex text-[var(--sp-primary-text)]"
          title="Se calcula a partir del peso y la talla; no se captura."
        >
          <Calculator size={11} aria-label="Campo calculado" />
        </span>
      </span>
      <span className="flex items-baseline gap-[var(--sp-2)]">
        <span className="text-[length:var(--sp-fs-display-sm)] font-extrabold leading-tight tabular-nums text-[var(--sp-ink-800)]">
          {valor}
          <span className="text-[length:var(--sp-fs-legal)] font-semibold text-[var(--sp-ink-350)]"> kg/m²</span>
        </span>
        {clasificacion && (
          <span
            className="shrink-0 whitespace-nowrap rounded-[var(--sp-r-pill)] px-[8px] py-[2px] text-[length:var(--sp-fs-legal)] font-bold"
            style={chipEstado(clasificacion.estado)}
          >
            {clasificacion.etiqueta}
          </span>
        )}
      </span>
    </div>
  )
}

/* ── Componente ─────────────────────────────────────────────────────────── */

export default function FichaClinica({
  paciente, consultas, totalConsultas, proximaCita,
  cargandoActividad, errorActividad, onReintentarActividad, onIrAPestana,
}: {
  paciente: Paciente
  consultas: Consulta[]
  /** El conteo REAL, no `consultas.length`: la lista viene acotada a 50. */
  totalConsultas: number | undefined
  proximaCita: ProximaCita | null
  cargandoActividad: boolean
  errorActividad: boolean
  onReintentarActividad: () => void
  onIrAPestana: (clave: ClavePestana) => void
}) {
  const sexo: Sexo = paciente.sexo
  const { analitos, mediciones, isLoading: cargandoAnalitos, error: errorAnalitos } = useAnalitosRastreados(paciente.id)
  const { documentos: archivos, isLoading: cargandoArchivos } = useDocumentosLabs(paciente.id)

  const dx = consultas
    .find(c => c.diagnosticos?.some(d => d.descripcion?.trim()))
    ?.diagnosticos?.find(d => d.descripcion?.trim())

  const antecedentes = ANTECEDENTES
    .map(a => ({ ...a, valor: paciente[a.key]?.trim() }))
    .filter(a => !!a.valor)

  const alergias = paciente.alergias?.trim()

  const peso = paciente.peso_kg
  const talla = paciente.talla_cm
  const imc = peso != null && talla != null && talla > 0
    ? Math.round((peso / (talla / 100) ** 2) * 10) / 10
    : null

  /* Los DOS más recientes POR FECHA DE MEDICIÓN, y salen de `mediciones` —las
     filas sueltas— y no de `analitos`. Dos motivos: `analitos` viene ordenado
     por categoría, que es lo que necesita la pestaña de mediciones y no esto;
     y sobre todo NO lleva la entrada de catálogo, que es justo lo que `statusOf`
     necesita para decidir si el valor está en rango. `mediciones` ya llega
     ordenado descendente, así que basta con quedarse con la primera aparición
     de cada analito. */
  const ultimos: typeof mediciones = []
  for (const m of mediciones) {
    if (ultimos.length === 2) break
    if (!ultimos.some(u => u.clave === m.clave)) ultimos.push(m)
  }

  const editar = `/expediente/${paciente.id}/editar`

  return (
    /* ⚠️ EL ALTO TOPE ES DE LA FICHA ENTERA, PERO EL SCROLL ES SÓLO DEL CUERPO, y
       esa distinción no es de estilo: el §3.2 dice, en negrita, que la banda de
       alergias «nunca se oculta tras un scroll interno». Con `overflow` en el
       envoltorio, un paciente con cinco antecedentes largos empujaría las
       alergias fuera de la vista, que es exactamente lo que la regla prohíbe.
       Por eso el envoltorio es una columna flex con `max-height`: la cabeza
       —diagnóstico y alergias— va `shrink-0` y se queda fija, y lo que se
       desplaza es lo de debajo.
       ⚠️ 640 px, Y EL NÚMERO NO ES A OJO. Es el mismo alto tope que el anexo
       §10 le da al historial de la pestaña Consultas, la otra columna estrecha
       desplazable del expediente: las dos se leen igual. Encaja además con lo
       que pide el encargo —que la ficha no pase a la línea de tiempo—: una
       cronología normal de 7-8 hitos mide ~700 px, así que la columna derecha
       queda por debajo de la izquierda, y con 5 hitos (~480 px) la ficha ni
       siquiera llega al tope y no aparece barra ninguna.
       ⚠️ SÓLO EN ESCRITORIO. En móvil el contenido fluye —decisión de la vista
       entera—, y además ahí el envoltorio es `contents` y no existe como caja. */
    <div className="contents lg:flex lg:max-h-[640px] lg:flex-col lg:overflow-hidden lg:rounded-[var(--sp-r-card)] lg:border lg:border-[color:var(--sp-line-card)] lg:bg-[var(--sp-surface)] lg:col-start-2 lg:row-start-1">

      {/* 1 y 2 · Diagnóstico activo y alergias. En móvil sube por encima de la
          línea de tiempo; la banda de alergias NUNCA queda tras un scroll. */}
      <section className="order-1 overflow-hidden rounded-[var(--sp-r-card)] border border-[color:var(--sp-line-card)] bg-[var(--sp-surface)] lg:order-none lg:shrink-0 lg:rounded-none lg:border-0">
        {errorActividad ? (
          <div className="px-[20px] pb-[var(--sp-4)]">
            <AvisoColumna
              icono={RotateCw}
              mensaje="No se pudo cargar el diagnóstico."
              onReintentar={onReintentarActividad}
            />
          </div>
        ) : cargandoActividad ? (
          <div className="bg-[var(--sp-surface-muted)] px-[20px] py-[18px]">
            <div className="skeleton h-[22px] w-1/2 rounded-[8px]" />
            <div className="skeleton mt-[9px] h-[36px] rounded-[8px]" />
          </div>
        ) : (
          <div className="flex flex-col gap-[9px] bg-[var(--sp-surface-muted)] px-[20px] py-[18px]">
            {dx?.codigo_cie10 && (
              <span
                className="self-start rounded-[var(--sp-r-btn-sm)] px-[9px] py-[4px] text-[length:var(--sp-fs-label)] font-extrabold"
                style={{ background: 'var(--sp-primary-bg)', color: 'var(--sp-primary-ink)' }}
              >
                {dx.codigo_cie10}
              </span>
            )}
            <p className="text-[17px] font-bold leading-snug text-[var(--sp-ink-800)]">
              {dx?.descripcion ?? 'Sin diagnóstico registrado'}
            </p>
            <div className="flex flex-col gap-[var(--sp-1-5)]">
              {/* Fecha compacta —«8 sep 26»— y no la larga: en 330 px de columna
                  «8 de septiembre 2026» salía recortada. */}
              <RenglonDato rotulo="Última consulta">
                {ultimaConsultaFechaCompacta(consultas) ?? '—'}
              </RenglonDato>
              <RenglonDato rotulo="Consultas">
                {totalConsultas ?? '—'}
              </RenglonDato>
              <RenglonDato rotulo="Próxima cita">
                {proximaCita
                  ? formatFechaRelativaFutura(proximaCita.start_time)
                  : <Link href="/agenda" prefetch={false} className="text-[var(--sp-primary-text)] hover:underline">Agendar</Link>}
              </RenglonDato>
            </div>
          </div>
        )}

        {alergias && (
          /* ⚠️ SUPERFICIE DE ERROR SATURADA CON TEXTO CLARO, y es la única
             pieza de la pantalla que NO baja de intensidad en oscuro (§5 del
             spec): su función es alarmar. No la conviertas en un banner suave
             como los de `--sp-danger-bg`. */
          <div
            className="mx-[20px] mb-[var(--sp-4)] mt-[var(--sp-4)] flex items-start gap-[var(--sp-2)] rounded-[12px] px-[15px] py-[11px]"
            style={{ background: 'var(--sp-alergia-bg)', color: 'var(--sp-alergia-ink)' }}
          >
            <AlertTriangle size={16} className="mt-[3px] shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[var(--sp-ls-label-w)] opacity-90">Alergias</p>
              <p className="text-[length:var(--sp-fs-body-lg)] font-bold leading-snug">{alergias}</p>
            </div>
          </div>
        )}
      </section>

      {/* 3 a 6 · El resto de la ficha. En móvil baja por debajo de la línea de
          tiempo; en escritorio es la continuación de la misma card. */}
      <div className="order-3 max-lg:overflow-hidden rounded-[var(--sp-r-card)] border border-[color:var(--sp-line-card)] bg-[var(--sp-surface)] lg:order-none lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:rounded-none lg:border-0">

        <Seccion titulo="Antecedentes">
          {antecedentes.length === 0 && !alergias ? (
            <Capturar href={editar} texto="Capturar antecedentes" />
          ) : antecedentes.length === 0 ? (
            <p className="text-[length:var(--sp-fs-hint)] text-[var(--sp-ink-350)]">Sin antecedentes registrados.</p>
          ) : (
            /* ⚠️ UNA SOLA RETÍCULA PARA LAS CINCO FILAS, y no una por fila. Con
               `grid` por renglón el ancho del rótulo se fijaba a ojo (92 px) y
               «No patológicos» y «Medicamentos» no cabían: el rótulo partía en
               dos líneas y el valor quedaba descolgado. Con la retícula
               compartida, `max-content` mide la columna por el rótulo MÁS LARGO
               —una vez, para las cinco— así que ninguno se parte, todos alinean
               y el valor se queda en la misma línea siempre que quepa.
               ⚠️ YA NO LLEVA SCROLL PROPIO. Lo tenía (`max-h-[330px]`) cuando
               era la única parte desplazable; ahora se desplaza el cuerpo
               entero de la ficha y anidar dos contenedores de scroll sólo sirve
               para atrapar la rueda del ratón. */
            <div className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-[var(--sp-3)]">
              {antecedentes.map((a, i) => {
                const filete = i > 0 ? 'border-t border-[color:var(--sp-line-divider)]' : ''
                return (
                  <Fragment key={a.key}>
                    <p className={`${filete} whitespace-nowrap py-[var(--sp-2)] text-[length:var(--sp-fs-legal)] font-bold uppercase tracking-[var(--sp-ls-label)] text-[var(--sp-ink-350)]`}>
                      {a.label}
                    </p>
                    {/* El anexo alinea el valor a la derecha; aquí NO, porque
                        estos valores son prosa libre de varias líneas y no
                        cifras. La app manda sobre el mockup. */}
                    <p className={`${filete} py-[var(--sp-2)] text-[length:var(--sp-fs-meta)] leading-[var(--sp-lh-snug)] text-[var(--sp-ink-700)]`}>
                      {a.valor}
                    </p>
                  </Fragment>
                )
              })}
            </div>
          )}
        </Seccion>

        <Seccion titulo="Antropometría">
          {peso == null && talla == null ? (
            <Capturar href={editar} texto="Capturar peso y talla" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-[var(--sp-2)]">
                <Tile rotulo="Peso"  valor={peso != null ? String(peso) : '—'}  unidad={peso != null ? 'kg' : undefined} />
                <Tile rotulo="Talla" valor={talla != null ? String(talla) : '—'} unidad={talla != null ? 'cm' : undefined} />
              </div>
              <RenglonImc
                valor={imc != null ? String(imc) : '—'}
                clasificacion={imc != null ? clasificarImc(imc) : null}
              />
            </>
          )}
        </Seccion>

        {/* Sin analitos, el bloque entero no se renderiza (§3.2). */}
        {(cargandoAnalitos || errorAnalitos || ultimos.length > 0) && (
          <Seccion
            titulo="Últimos analitos"
            accion={!cargandoAnalitos && !errorAnalitos && ultimos.length > 0 ? (
              <button
                type="button"
                onClick={() => onIrAPestana('mediciones')}
                className="shrink-0 whitespace-nowrap text-[length:var(--sp-fs-hint)] font-semibold text-[var(--sp-primary-text)] hover:underline"
              >
                Ver {analitos.length} analitos
              </button>
            ) : undefined}
          >
            {errorAnalitos ? (
              <p className="text-[length:var(--sp-fs-hint)] text-[var(--sp-ink-350)]">No se pudieron cargar los analitos.</p>
            ) : cargandoAnalitos ? (
              <div className="flex flex-col gap-[9px]">
                {[1, 2].map(i => <div key={i} className="skeleton h-[38px] rounded-[8px]" />)}
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-[9px]">
                  {ultimos.map(a => (
                    <div key={a.clave} className="flex items-baseline justify-between gap-[var(--sp-2)]">
                      <div className="min-w-0">
                        <p className="truncate text-[length:var(--sp-fs-meta)] font-semibold text-[var(--sp-ink-800)]">{a.nombre}</p>
                        <p className="text-[11.5px] text-[var(--sp-ink-350)]">{formatFechaCorta(a.medidoEn)}</p>
                      </div>
                      <p
                        className="shrink-0 text-[length:var(--sp-fs-display-sm)] font-extrabold tabular-nums"
                        style={{ color: tintaEstado(statusOf(a.valor, a.catalogo, sexo)) }}
                      >
                        {a.valor}
                        {a.unidad && <span className="text-[length:var(--sp-fs-legal)] font-semibold text-[var(--sp-ink-350)]"> {a.unidad}</span>}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Seccion>
        )}

        <Seccion titulo="Archivos clínicos">
          {cargandoArchivos ? (
            <div className="skeleton h-[28px] w-[100px] rounded-[7px]" />
          ) : archivos.length === 0 ? (
            <p className="text-[length:var(--sp-fs-hint)] text-[var(--sp-ink-350)]">Sin archivos clínicos.</p>
          ) : (
            <button
              type="button"
              onClick={() => onIrAPestana('mediciones')}
              className="flex items-center gap-[5px]"
              aria-label={`Ver los ${archivos.length} archivos clínicos`}
            >
              {/* ⚠️ GLIFO POR TIPO, NO MINIATURA REAL. La miniatura de imagen es
                  funcionalidad nueva (§6.6 del spec) y pedirla obligaría a
                  firmar una URL por archivo desde la ficha. */}
              {archivos.slice(0, 3).map(a => {
                const Icono = iconoArchivo(a.mime_type)
                return (
                  <span
                    key={a.id}
                    className="flex h-[28px] w-[28px] items-center justify-center rounded-[7px] border border-[color:var(--sp-line-soft)] bg-[var(--sp-surface-sunken)] text-[var(--sp-ink-400)]"
                  >
                    <Icono size={14} />
                  </span>
                )
              })}
              {archivos.length > 3 && (
                <span className="ml-[3px] text-[length:var(--sp-fs-hint)] font-semibold text-[var(--sp-ink-500)]">
                  +{archivos.length - 3}
                </span>
              )}
            </button>
          )}
        </Seccion>
      </div>
    </div>
  )
}
