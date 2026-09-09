'use client'

import { Plus, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import type { AnalitoRastreado } from '@/hooks/useAnalitosRastreados'
import type { AnalitoCatalogo, CategoriaAnalito } from '@/types'
import { statusOf, type Sexo, type AnalitoStatus } from '@/lib/labs/utils'

/**
 * La lista PERMANENTE de analitos. Sustituye a `DropdownSelectorAnalito`.
 *
 * ⚠️ PROHIBIDO VOLVER AL DESPLEGABLE, y el §6.2 del spec lo dice con esa
 * palabra. El menú obligaba a cambiar de selección para ver qué analitos había
 * —o sea, a perder el que estabas mirando para enterarte de que existía otro— y
 * además se leía como un catálogo de analitos POR AGREGAR, que es justo lo que
 * no es: aquí solo salen los que el paciente ya tiene medidos. En una pestaña
 * dedicada a mediciones, verlos todos de un vistazo es el trabajo.
 *
 * ⚠️ ALTO TOPE Y DESPLAZAMIENTO EN LOS DOS ANCHOS. Es la misma excepción
 * deliberada a «scroll interno solo en escritorio» que la línea de tiempo del
 * Resumen, y por el mismo motivo: un paciente con treinta analitos convierte la
 * pestaña en un desplazamiento sin fondo y deja el detalle fuera de alcance. La
 * banda del encabezado va FUERA del área que desplaza, así que no se tapa.
 */

/* Copiado de `DropdownSelectorAnalito`, que queda sin uso con este componente.
   Se duplica en vez de extraerse porque el original está a un paso de borrarse:
   cuando eso pase, esta será la única copia y no habrá nada que compartir. */
const CATEGORIA_LABEL: Record<string, string> = {
  antropometria: 'Antropometría',
  signos_vitales: 'Signos vitales',
  hematologia: 'Hematología',
  quimica: 'Química',
  hueso: 'Hueso',
  endocrino: 'Endocrino',
  inmunologia: 'Inmunología',
  coagulacion: 'Coagulación',
  cardiaco: 'Cardíaco',
  marcador_tumoral: 'Marcadores tumorales',
  vitaminas_minerales: 'Vitaminas y minerales',
  otros: 'Otros',
}

function labelCategoria(c: CategoriaAnalito | string): string {
  return CATEGORIA_LABEL[c] ?? String(c)
}

function formatValor(v: number, unidad: string): string {
  return `${Number.isInteger(v) ? v : v.toFixed(2)} ${unidad}`.trim()
}

/**
 * La variación respecto a la medición ANTERIOR, con su tinta.
 *
 * ⚠️ SUBIR NO ES MALO NI BUENO POR SÍ MISMO: depende del analito. Un colesterol
 * que sube es peor y una hemoglobina que sube es mejor, así que la dirección
 * sola no puede elegir color. Lo decide `bands_type` del catálogo —`high-bad` o
 * `low-bad`—, y cuando el analito no declara ninguno (o es custom) la variación
 * sale NEUTRA: la flecha informa del movimiento y nadie afirma si es bueno.
 */
function variacionDe(
  actual: number,
  anterior: number | null,
  cat: AnalitoCatalogo | null,
): { Icono: typeof ArrowUp; texto: string; color: string } | null {
  if (anterior === null) return null
  const delta = actual - anterior
  const pct = anterior !== 0 ? (delta / anterior) * 100 : 0
  const Icono = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus

  let color = 'var(--sp-ink-350)'
  if (delta !== 0) {
    const bands = cat?.bands_type
    if (bands === 'high-bad') color = delta > 0 ? 'var(--sp-danger)' : 'var(--sp-success-strong)'
    else if (bands === 'low-bad') color = delta > 0 ? 'var(--sp-success-strong)' : 'var(--sp-danger)'
  }

  const signo = delta > 0 ? '+' : delta < 0 ? '−' : ''
  const texto = delta === 0
    ? 'sin cambio'
    : `${signo}${Math.abs(pct) >= 0.05 ? Math.abs(pct).toFixed(1) : '0'}%`
  return { Icono, texto, color }
}

/** El punto de semáforo. Sin rango de referencia no hay color que dar. */
function colorSemaforo(estado: AnalitoStatus): string {
  if (estado === 'ok') return 'var(--sp-success-dot)'
  if (estado === 'warn') return 'var(--sp-warn-dot)'
  if (estado === 'bad') return 'var(--sp-danger)'
  return 'var(--sp-ink-150)'
}

export default function ListaAnalitos({
  analitos, catalogo, sexoPaciente, claveSeleccionada, onSeleccionar, onAgregar,
}: {
  analitos: AnalitoRastreado[]
  catalogo: AnalitoCatalogo[]
  sexoPaciente: Sexo
  claveSeleccionada: string | null
  onSeleccionar: (clave: string) => void
  onAgregar: () => void
}) {
  return (
    <div className="flex max-h-[440px] flex-col overflow-hidden rounded-[var(--sp-r-card)] border border-[color:var(--sp-line-card)] bg-[var(--sp-surface)] lg:max-h-[660px] lg:w-[300px] lg:shrink-0">
      {/* Banda fija: va `shrink-0` fuera del contenedor que desplaza, así que
          el conteo y la acción no se pierden al recorrer la lista. */}
      <div className="flex shrink-0 items-center justify-between gap-[var(--sp-2)] border-b border-[color:var(--sp-line-divider)] px-[var(--sp-4)] py-[var(--sp-2-5)]">
        <p className="text-[10.5px] font-bold uppercase tracking-[var(--sp-ls-label)] text-[var(--sp-ink-350)]">
          Analitos rastreados · <span className="tabular-nums">{analitos.length}</span>
        </p>
        <button
          type="button"
          onClick={onAgregar}
          className="sp-btn sp-btn--compact whitespace-nowrap"
        >
          <Plus size={14} /> Medición
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {analitos.map(a => {
          const activo = a.clave === claveSeleccionada
          const cat = a.analitoId ? catalogo.find(c => c.id === a.analitoId) ?? null : null
          const estado = statusOf(a.ultimoValor, cat, sexoPaciente)
          const variacion = variacionDe(a.ultimoValor, a.valorAnterior, cat)
          return (
            <button
              key={a.clave}
              type="button"
              onClick={() => onSeleccionar(a.clave)}
              aria-current={activo ? 'true' : undefined}
              className="flex w-full items-center gap-[var(--sp-2-5)] border-l-[var(--sp-bw-bar)] px-[var(--sp-3)] py-[13px] text-left transition-colors"
              style={activo
                ? { borderLeftColor: 'var(--sp-primary)', background: 'var(--sp-primary-bg-faint)' }
                : { borderLeftColor: 'transparent' }}
            >
              <span
                aria-hidden
                className="h-[9px] w-[9px] shrink-0 rounded-[var(--sp-r-pill)]"
                style={{ background: colorSemaforo(estado) }}
              />
              <span className="min-w-0 flex-1">
                <span
                  className="block truncate text-[length:var(--sp-fs-body-sm)] font-semibold"
                  style={{ color: activo ? 'var(--sp-ink-800)' : 'var(--sp-ink-700)' }}
                >
                  {a.nombre}
                </span>
                <span className="block truncate text-[11.5px] text-[var(--sp-ink-350)]">
                  {labelCategoria(a.categoria)}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-[length:var(--sp-fs-body-sm)] font-bold tabular-nums text-[var(--sp-ink-800)]">
                  {formatValor(a.ultimoValor, a.unidad)}
                </span>
                {/* La variación contra la medición anterior. Con una sola
                    medición no hay contra qué compararla y se dice así. */}
                {variacion ? (
                  <span
                    className="flex items-center justify-end gap-[2px] text-[11.5px] font-semibold tabular-nums"
                    style={{ color: variacion.color }}
                  >
                    <variacion.Icono size={11} />{variacion.texto}
                  </span>
                ) : (
                  <span className="block text-[11.5px] text-[var(--sp-ink-350)]">primera</span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
