'use client'

import Link from 'next/link'
import { MapPin } from 'lucide-react'
import { Consultorio } from '@/types'
import { ZONAS_MEXICO } from '@/lib/consultorios/zonas-mexico'
import { EncabezadoColumna } from '@/components/dashboard/piezasBanda2'

/**
 * Las piezas nuevas de la pestaña Datos: las que NO existían antes del
 * rediseño. Lo que ya existía —datos profesionales, firma, logo, paleta— vive
 * en `perfil/page.tsx`, porque cuelga del estado del formulario.
 *
 * Van juntas en un archivo, como `dashboard/piezasBanda2.tsx`, porque son
 * cuatro trozos pequeños de la MISMA región y ninguno tiene vida propia fuera
 * de ella. Sacar cuatro archivos de esto sería inventariar, no organizar.
 */

/** El tope de consultorios activos por médico. NO es un número de interfaz:
 *  lo impone el trigger `enforce_cap_10_consultorios_activos`
 *  (supabase/migrations/20260615_consultorios_02_triggers.sql). Si cambia allí,
 *  cambia aquí — hasta entonces, enseñarlo es enseñar la regla real. */
export const MAX_CONSULTORIOS = 10

/** Cuántos consultorios se listan en el resumen antes de mandar a la pestaña. */
const RESUMEN_MAX = 3

/** La pestaña de gestión, como enlace: sobrevive a una recarga y se puede
 *  copiar, que es justo lo que el `?tab=` del chasis compra. */
const HREF_CONSULTORIOS = '/perfil?tab=consultorios'
const HREF_GOOGLE = '/perfil?tab=google'

/**
 * Logotipo oficial «G» de Google (4 colores), SVG en línea.
 *
 * ⚠️ ES UNA COPIA DELIBERADA de `GoogleGIcon` en `(app)/agenda/page.tsx:3143`,
 * no un descuido. Aquél es una función PRIVADA dentro de un archivo de cliente
 * de más de nueve mil líneas; importarlo obligaría a exportarlo y a tocar la
 * agenda, que no es de este encargo. Son los mismos cuatro `path` oficiales.
 * Si algún día se unifican, el sitio es un componente de `ui/` y se cambian los
 * dos consumidores a la vez.
 */
export function GoogleGIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  )
}

/**
 * Cabecera de card de la pestaña: título y, opcionalmente, la línea que explica
 * dónde acaba saliendo ese dato.
 *
 * ⚠️ EL NIVEL TIPOGRÁFICO ES EL DE `EncabezadoColumna`, y a propósito:
 * `--sp-fs-vitals`, negrita, `--sp-ink-800`. La pestaña mezcla cards con esta
 * cabecera y una (el resumen de consultorios) que usa aquel componente porque
 * necesita enlace; si los dos niveles no coincidieran, la columna se leería
 * como dos jerarquías distintas alternándose.
 */
export function CabeceraCard({ titulo, apoyo }: { titulo: string; apoyo?: string }) {
  return (
    <div>
      <h2 className="text-[length:var(--sp-fs-vitals)] font-bold text-[var(--sp-ink-800)]">{titulo}</h2>
      {apoyo && <p className="sp-hint mt-[var(--sp-gap-title-sub)]">{apoyo}</p>}
    </div>
  )
}

/* La abreviatura UTC de una zona. COPIA de `offsetDeTimezone` en
   `perfil/page.tsx`, que lo usa para la pestaña Consultorios. Son cinco líneas
   y el proyecto prefiere duplicar a abstraer con dos consumidores; si aparece
   un tercero, ése ya es el momento de sacarlo a `lib/consultorios/`. */
function offsetDeTimezone(tz: string): string {
  const zona = ZONAS_MEXICO.find(z => z.value === tz)
  if (!zona) return ''
  const match = zona.label.match(/UTC[+-]\d+/)
  return match ? match[0] : ''
}

/**
 * Una muestra de color. El aro claro no es decorativo: sin él, un primario muy
 * oscuro y el borde de la card se funden y la muestra deja de leerse como tal.
 */
export function MuestraColor({ color }: { color: string }) {
  return (
    <span
      className="block h-[18px] w-[18px] rounded-[var(--sp-r-btn-sm)]"
      style={{ background: color, boxShadow: '0 0 0 1px var(--sp-line-card)' }}
    />
  )
}

/**
 * §3.4 — Los tres primeros consultorios, en lectura.
 *
 * ⚠️ SIN ACCIONES, Y NO ES UN OLVIDO. Editar, eliminar y predeterminar viven en
 * la pestaña Consultorios; repetirlos aquí duplicaría tres caminos destructivos
 * en dos sitios de la misma pantalla.
 */
export function ResumenConsultorios({ consultorios, cargando }: {
  consultorios: Consultorio[]
  cargando: boolean
}) {
  const total = consultorios.length
  const visibles = consultorios.slice(0, RESUMEN_MAX)
  const restantes = total - visibles.length

  return (
    <section className="sp-card flex flex-col gap-[var(--sp-3)]">
      <div>
        <EncabezadoColumna
          titulo="Mis consultorios"
          enlace={total > 0 ? { href: HREF_CONSULTORIOS, texto: `Gestionar los ${total}` } : undefined}
        />
        <p className="sp-hint">{total} de {MAX_CONSULTORIOS} activos</p>
      </div>

      {cargando ? (
        <div className="flex flex-col gap-[var(--sp-2)]">
          <div className="skeleton h-[58px] rounded-[var(--sp-r-field)]" />
          <div className="skeleton h-[58px] rounded-[var(--sp-r-field)]" />
        </div>
      ) : total === 0 ? (
        <p className="sp-secondary">
          No tienes consultorios activos.{' '}
          <Link href={HREF_CONSULTORIOS} prefetch={false} className="font-semibold text-[var(--sp-primary)] hover:underline">
            Agrega el primero
          </Link>
          .
        </p>
      ) : (
        <div className="flex flex-col">
          {visibles.map((c, i) => (
            <div
              key={c.id}
              className="flex items-center gap-[var(--sp-3)] py-[var(--sp-3)]"
              style={i > 0 ? { borderTop: 'var(--sp-bw-hair) solid var(--sp-line-divider)' } : undefined}
            >
              <span className="w-[34px] h-[34px] shrink-0 flex items-center justify-center rounded-[var(--sp-r-icon-md)] bg-[var(--sp-primary-bg)] text-[var(--sp-primary-text)]">
                <MapPin size={16} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-[var(--sp-2)] min-w-0">
                  <p className="min-w-0 truncate text-[length:var(--sp-fs-body-sm)] font-bold text-[var(--sp-ink-800)]">
                    {c.nombre}
                  </p>
                  {c.es_default && (
                    <span className="shrink-0 rounded-[var(--sp-r-pill)] bg-[var(--sp-primary-bg)] px-[8px] py-[3px] text-[length:var(--sp-fs-tile)] font-bold uppercase tracking-[var(--sp-ls-label-w)] text-[var(--sp-primary-ink)]">
                      Predeterminado
                    </span>
                  )}
                </div>
                <p className="truncate text-[length:var(--sp-fs-hint)] text-[var(--sp-ink-500)]">
                  {[c.direccion, c.telefono, offsetDeTimezone(c.timezone)].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {restantes > 0 && (
        <Link href={HREF_CONSULTORIOS} prefetch={false} className="text-[length:var(--sp-fs-meta)] font-semibold text-[var(--sp-primary)] hover:underline">
          Ver {restantes} consultorio{restantes > 1 ? 's' : ''} más
        </Link>
      )}
    </section>
  )
}

/**
 * §3.5 — Sólo el ESTADO de Google Calendar. Ninguna acción de conectar,
 * recrear ni desconectar: viven en su pestaña.
 */
export function EstadoGoogleCalendar({ esAdmin, estado }: {
  esAdmin: boolean
  estado: 'conectado' | 'sin_token' | 'error_google' | null
}) {
  return (
    <section className="sp-card flex items-center gap-[var(--sp-3)]">
      <span className="w-[42px] h-[42px] shrink-0 flex items-center justify-center rounded-[var(--sp-r-icon-md)] bg-[var(--sp-surface-muted)]">
        <GoogleGIcon size={20} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[length:var(--sp-fs-body)] font-bold text-[var(--sp-ink-800)]">Google Calendar</p>
        <p className="sp-hint">
          {esAdmin
            ? 'Tus citas se sincronizan a un calendario que Spinus crea en tu cuenta.'
            : 'La gestiona quien administra la clínica: es una para todo el equipo.'}
        </p>
      </div>

      <div className="shrink-0 flex items-center gap-[var(--sp-3)]">
        <ChipEstado esAdmin={esAdmin} estado={estado} />
        <Link href={HREF_GOOGLE} prefetch={false} className="text-[length:var(--sp-fs-meta)] font-semibold text-[var(--sp-primary)] hover:underline max-sm:hidden">
          Abrir
        </Link>
      </div>
    </section>
  )
}

/**
 * ⚠️ EL INVITADO SE RESUELVE ANTES DE MIRAR `estado`, Y EL ORDEN NO ES
 * COSMÉTICO. `/api/google/calendar` está entero tras `canManageClinica`, así
 * que a quien no administra le contesta 403; ese 403 no trae campo `estado` y
 * el `?? 'error_google'` de quien llama lo deja en el casillero de fallo. Leído
 * de ahí, a un médico invitado se le anunciaría una avería de Google que no ha
 * ocurrido y una conexión suya que no existe. No se le enseña chip porque no
 * hay estado que él pueda consultar. Es la misma precaución que ya tomaba la
 * tarjeta de Integraciones antes del rediseño; si reordenas estas ramas, vuelve.
 */
function ChipEstado({ esAdmin, estado }: {
  esAdmin: boolean
  estado: 'conectado' | 'sin_token' | 'error_google' | null
}) {
  if (!esAdmin) return null
  if (estado === null) return <span className="skeleton h-[26px] w-[104px] rounded-[var(--sp-r-pill)]" />

  /* «Sin conectar» va en tinta SECUNDARIA sobre superficie neutra, nunca en
     terciaria: sobre ese gris no llega al contraste mínimo (spec §5). */
  const pinta = estado === 'conectado'
    ? { fondo: 'var(--sp-success-bg)', tinta: 'var(--sp-success)', punto: 'var(--sp-success-dot)', texto: 'Conectado' }
    : estado === 'error_google'
      /* NO dice «no conectado»: aquí HAY token; lo que no hubo es respuesta de
         Google. Ofrecerle reconectar sería mandarle a rehacer algo que no está
         roto — y de todos modos la acción no vive en esta pestaña. */
      ? { fondo: 'var(--sp-warn-bg)', tinta: 'var(--sp-warn)', punto: 'var(--sp-warn-dot)', texto: 'Sin respuesta' }
      : { fondo: 'var(--sp-surface-muted)', tinta: 'var(--sp-ink-500)', punto: 'var(--sp-ink-350)', texto: 'Sin conectar' }

  return (
    <span
      className="inline-flex items-center gap-[var(--sp-1-5)] rounded-[var(--sp-r-pill)] px-[12px] py-[5px] text-[length:var(--sp-fs-hint)] font-bold whitespace-nowrap"
      style={{ background: pinta.fondo, color: pinta.tinta }}
    >
      <span className="w-[7px] h-[7px] rounded-[var(--sp-r-pill)]" style={{ background: pinta.punto }} />
      {pinta.texto}
    </span>
  )
}

/**
 * §3.3 — Vista previa del encabezado de los PDFs.
 *
 * ⚠️ ES LO QUE EL PDF HACE DE VERDAD, Y ANTES NO LO ERA. Esta previsualización
 * pintaba una banda con degradado de 135° y texto blanco encima. Ningún PDF del
 * sistema se ve así: `src/lib/pdf/PdfHeader.tsx` compone sobre fondo BLANCO
 * —logo a la izquierda, nombre en el color primario, especialidad en el
 * secundario, cédulas en gris con viñeta del secundario— y cierra con dos
 * filetes, uno grueso del primario y uno fino del secundario. Eso es lo que se
 * replica aquí.
 *
 * NO LE DEVUELVAS EL DEGRADADO. Una vista previa que enseña algo que el papel
 * no imprime es peor que no tener vista previa: el médico elige sus colores
 * mirando un resultado falso.
 */
export function VistaPreviaEncabezado({ nombre, especialidad, cedulaProfesional, cedulaEspecialidad, logoUrl, colorPrimario, colorSecundario }: {
  nombre: string
  especialidad: string
  cedulaProfesional: string
  cedulaEspecialidad: string
  logoUrl: string | null
  colorPrimario: string
  colorSecundario: string
}) {
  const cedulas = [
    cedulaProfesional ? `Céd. Prof. ${cedulaProfesional}` : '',
    cedulaEspecialidad ? `Céd. Esp. ${cedulaEspecialidad}` : '',
  ].filter(Boolean)

  return (
    /* ⚠️ BLANCO LITERAL, Y ES LA ÚNICA EXCEPCIÓN DE COLOR DE LA PANTALLA.
       Esto representa una HOJA IMPRESA, que es blanca en los dos temas: si
       siguiera al modo oscuro, el médico elegiría sus colores mirándolos sobre
       un fondo que el papel nunca va a tener. Es la misma excepción que el spec
       §5 concede a las piezas que representan el PDF.
       ⚠️ NO LO ESCRIBAS COMO `bg-white`. `ThemeProvider` lleva una regla
       `html.dark .bg-white { background-color: #1E1E1E !important }` que barre
       esa clase en toda la app, así que la hoja se volvería gris oscuro en modo
       oscuro — justo lo contrario de lo que hace falta. Va en línea para
       esquivarla.
       Cuando el sistema tenga un token de «papel» (no redefinido en oscuro),
       éste es su primer consumidor. */
    <div
      className="rounded-[var(--sp-r-field)] px-[var(--sp-4-5)] pt-[var(--sp-4)] pb-[var(--sp-3)]"
      style={{ background: 'white', border: 'var(--sp-bw-hair) solid var(--sp-line-card)' }}
    >
      <div className="flex items-center gap-[var(--sp-3-5)]">
        {logoUrl && (
          <img src={logoUrl} alt="" className="w-[64px] h-[32px] shrink-0 object-contain" />
        )}
        <div className="min-w-0 flex-1">
          {/* ⚠️ ENVUELVE, NO TRUNCA, PORQUE ES LO QUE HACE EL PAPEL. Medido con
              Roboto-Bold a 16 pt, que es lo que compone `@react-pdf/renderer`:
              un nombre extremo (título + cuatro nombres + dos apellidos) mide
              471 pt y el encabezado real dispone de 419 pt con logo, 315 con
              folio — así que en el PDF sale en DOS LÍNEAS COMPLETAS en todas
              las variantes salvo la que no lleva logo ni folio.
              Con `truncate` esta previsualización enseñaba ese mismo nombre en
              UNA línea cortada con «…»: un nombre mutilado que el papel imprime
              entero. Es el mismo defecto que el degradado que se retiró de aquí,
              con el signo cambiado.
              El tope de dos líneas no es arbitrario: `PdfHeader` no pasó de dos
              en ninguna de las cuatro anchuras medidas, y
              `Font.registerHyphenationCallback(word => [word])` garantiza que el
              PDF nunca parte palabras, sólo envuelve en espacios. */}
          <p className="line-clamp-2 text-[length:var(--sp-fs-body)] font-bold tracking-[0.3px]" style={{ color: colorPrimario }}>
            {nombre || 'Médico'}
          </p>
          {/* Mismo motivo que el nombre de arriba: en el PDF esta línea es un
              `<Text>` que ENVUELVE, así que truncarla aquí enseñaría una
              especialidad cortada que el papel imprime entera. Medido, hoy no
              se dispara —«Cirugía de Columna · Ortopedia y Traumatología» ocupa
              248-280 px de los 450 disponibles—, pero una lista de
              especialidades más larga sí llegaría, y entonces el fallo sería
              del mismo tipo. Se corrige antes de que aparezca. */}
          {especialidad && (
            <p className="line-clamp-2 text-[length:var(--sp-fs-legal)] font-medium tracking-[0.3px]" style={{ color: colorSecundario }}>
              {especialidad}
            </p>
          )}
          {cedulas.length > 0 && (
            <div className="mt-[var(--sp-1)] flex flex-wrap gap-x-[var(--sp-2-5)] gap-y-[2px]">
              {cedulas.map(c => (
                <span key={c} className="inline-flex items-center gap-[3px] text-[length:var(--sp-fs-tile)] text-[var(--sp-ink-500)]">
                  <span className="w-[3px] h-[3px] rounded-[var(--sp-r-pill)]" style={{ background: colorSecundario }} />
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Los dos filetes de cierre: grueso del primario, fino del secundario. */}
      <div className="mt-[var(--sp-2-5)] h-[2px] w-full" style={{ background: colorPrimario }} />
      <div className="mt-[1.5px] h-[1px] w-full" style={{ background: colorSecundario }} />
    </div>
  )
}
