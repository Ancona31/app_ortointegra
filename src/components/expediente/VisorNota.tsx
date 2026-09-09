'use client'

import { Printer, Loader2, FileDown, MessageSquarePlus } from 'lucide-react'
import Link from 'next/link'
import type { NotaRenderData } from '@/lib/notaRenderData'
import CuerpoNota from './CuerpoNota'

/**
 * El CHASIS del visor de nota dentro de la pestaña Consultas (§1-§3 de la
 * adenda). El contenido lo pone `CuerpoNota`, que es el mismo que consume la
 * página `/expediente/[id]/consulta/[consultaId]`.
 *
 * ⚠️ ES UN CONTENEDOR CON SU PROPIO DESPLAZAMIENTO, NO UNA PÁGINA QUE FLUYE.
 * La nota se recorre sin mover la página, ni la cabecera del paciente, ni las
 * pestañas del expediente. Alto tope 640 px en escritorio; si la nota es más
 * corta, el contenedor se ajusta a su contenido y no deja aire al pie —de ahí
 * `max-h` y no `h`.
 *
 * ⚠️ SÓLO EN ESCRITORIO. En móvil el contenido fluye, que es la decisión de la
 * vista entera: una caja con scroll dentro de una página con scroll atrapa el
 * gesto del dedo. El tope de 560 px que da el §11 para móvil se descarta por
 * esa regla, que es posterior y manda.
 *
 * ⚠️ DENTRO NO HAY MÁS TARJETAS. Ni la franja de datos, ni las secciones, ni el
 * bloque del médico, ni las aclaratorias llevan contenedor propio: ésta es la
 * superficie que sostiene la lectura y anidar otra la rompe.
 */

/** §11: la medida de lectura, ~72 caracteres. El contenedor ocupa su columna; el texto no. */
const MEDIDA_LECTURA = 'mx-auto w-full max-w-[620px]'

function Insignia({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 whitespace-nowrap rounded-[var(--sp-r-pill)] bg-[var(--sp-surface-muted)] px-[8px] py-[3px] text-[length:var(--sp-fs-legal)] font-bold text-[var(--sp-ink-500)]">
      {children}
    </span>
  )
}

export default function VisorNota({
  data, imprimiendo, pdfUrl, onImprimir, hrefNotaCompleta, puedeAclarar,
}: {
  data: NotaRenderData
  imprimiendo: boolean
  pdfUrl: string | null
  onImprimir: () => void
  /** La página completa: destino de «Abrir nota completa» y de aclarar. */
  hrefNotaCompleta: string
  /** Sólo el firmante puede aclarar; para el resto la acción no existe. */
  puedeAclarar: boolean
}) {
  return (
    <div className="overflow-hidden rounded-[var(--sp-r-card)] border border-[color:var(--sp-line-card)] bg-[var(--sp-surface)] shadow-[var(--sp-shadow-flat)] lg:max-h-[640px] lg:overflow-y-auto">

      {/* ── Cabecera fija, UNA SOLA FILA ────────────────────────────────
          ⚠️ OPACA, Y NO ES UN DETALLE. `sticky` sobre superficie sólida y por
          encima del contenido en apilamiento: una cabecera fija translúcida
          deja ver el texto pasando por debajo, y eso es un defecto, no un
          efecto. La sombra al pie es lo que anuncia que el texto pasa por
          debajo.
          ⚠️ `sticky` SÓLO TIENE EFECTO EN ESCRITORIO porque es ahí donde el
          contenedor desplaza; en móvil el elemento existe igual y se queda
          donde está, sin necesidad de apagarlo.
          ⚠️ SIN ANTE-TÍTULO «EXPEDIENTE CLÍNICO» NI TÍTULO A TAMAÑO DISPLAY:
          eran el 40 % del espacio previo a la primera línea de texto. */}
      <div className="sticky top-0 z-10 border-b border-[color:var(--sp-line-divider)] bg-[var(--sp-surface)] px-[var(--sp-4)] py-[var(--sp-3-5)] shadow-[var(--sp-shadow-flat)] lg:px-[26px]">
        <div className="flex flex-wrap items-center gap-x-[var(--sp-2-5)] gap-y-[var(--sp-2)]">
          <h2 className="text-[length:var(--sp-fs-vitals)] font-extrabold leading-tight text-[var(--sp-ink-800)]">
            Nota de Evolución Médica
          </h2>
          <p className="text-[length:var(--sp-fs-hint)] text-[var(--sp-ink-500)]">
            {data.fechaCorta} · {data.horaFormateada}
          </p>

          {/* ⚠️ EL BOTÓN SE MANTIENE JUNTO AL TÍTULO Y SON LAS INSIGNIAS LAS QUE
              BAJAN DE LÍNEA (§3). De ahí el orden: en móvil manda el orden del
              código —título, fecha, botón, insignias— y el `flex-wrap` parte
              donde toca; en escritorio el botón se va al final con `order-last`
              y son las insignias las que empujan con `ml-auto`, que es el orden
              que el §3 enumera.
              ⚠️ EL BOTÓN SE DESMONTA, NO SE OCULTA CON `hidden`. Lo tenía y no
              funcionaba: `[hidden]` es del agente de usuario y `.sp-btn` le gana
              con su `display: inline-flex`, así que salían los dos a la vez. */}
          {pdfUrl ? (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener"
              className="ml-auto shrink-0 sp-btn sp-btn--compact whitespace-nowrap lg:ml-0 lg:order-last"
            >
              <FileDown size={13} /> Abrir PDF
            </a>
          ) : (
            <button
              type="button"
              onClick={onImprimir}
              disabled={imprimiendo}
              className="ml-auto shrink-0 sp-btn sp-btn--compact whitespace-nowrap disabled:opacity-60 lg:ml-0 lg:order-last"
            >
              {imprimiendo
                ? <><Loader2 size={13} className="animate-spin" /> Generando…</>
                : <><Printer size={13} /> Imprimir</>}
            </button>
          )}

          <div className="flex shrink-0 items-center gap-[var(--sp-1-5)] lg:ml-auto">
            {data.notaOrigen && <Insignia>{data.notaOrigen === 'ia' ? 'Nota IA' : 'Nota manual'}</Insignia>}
            <Insignia>Nota sellada</Insignia>
          </div>
        </div>
      </div>

      {/* ── Cuerpo, acotado a la medida de lectura ──────────────────────
          El relleno del contenedor va a los lados; la medida se centra dentro.
          Se respeta AUNQUE SOBRE ESPACIO: una línea larga cansa más que una
          columna estrecha. */}
      <div className="px-[var(--sp-4)] py-[var(--sp-4)] lg:px-[26px] lg:py-[var(--sp-5)]">
        <div className={MEDIDA_LECTURA}>
          <CuerpoNota data={data} />

          <div className="mt-[var(--sp-7)] flex flex-wrap items-center gap-[var(--sp-4)] border-t border-[color:var(--sp-line-divider)] pt-[var(--sp-3)]">
            <Link
              href={hrefNotaCompleta}
              prefetch={false}
              className="text-[length:var(--sp-fs-hint)] font-semibold text-[var(--sp-primary)] hover:underline"
            >
              Abrir nota completa
            </Link>
            {/* ⚠️ AQUÍ SÓLO SE ENLAZA A AÑADIR ACLARATORIA, NO SE AÑADE. La
                escritura vive en la página completa, en un solo sitio: validar
                al firmante, hacer el POST y manejar el fallo por duplicado en
                dos chasis distintos es cómo divergen. Y la acción NO EXISTE
                para quien no firmó la nota — ni siquiera un administrador
                puede aclarar la nota de otro. */}
            {puedeAclarar && (
              <Link
                href={hrefNotaCompleta}
                prefetch={false}
                className="inline-flex items-center gap-[var(--sp-1-5)] text-[length:var(--sp-fs-hint)] font-semibold text-[var(--sp-primary)] hover:underline"
              >
                <MessageSquarePlus size={13} /> Añadir nota aclaratoria
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
