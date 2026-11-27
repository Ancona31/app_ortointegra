'use client'

import Link from 'next/link'
import { MapPin, ChevronRight, type LucideIcon } from 'lucide-react'
import { Consultorio } from '@/types'
import { ZONAS_MEXICO } from '@/lib/consultorios/zonas-mexico'
import { IconoGoogleCalendar } from '@/components/ui/MarcaOrigen'

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
 * Rótulo de una sección de la pestaña (rediseño B10, maqueta `perfil`; CALMA
 * §12): icono de 16 y título 13/700 en mayúsculas, en el color de acción
 * (`--enlace`, que en oscuro es el azul legible), FUERA de la tarjeta, que
 * queda para los datos. A la derecha, opcional, un enlace de texto.
 * Sustituye a la vieja `CabeceraCard` (título 700 dentro de la card).
 */
export function RotuloSeccion({ id, icono: Icono, titulo, enlace }: {
  id?: string
  icono: LucideIcon
  titulo: string
  enlace?: { href: string; texto: string }
}) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3 px-1 pb-1.5">
      <h2 id={id} className="flex min-w-0 items-center gap-2 text-[13px] font-bold uppercase leading-[18px] tracking-[.4px] text-enlace">
        <Icono size={16} aria-hidden="true" className="shrink-0" />
        {titulo}
      </h2>
      {enlace && (
        <Link href={enlace.href} prefetch={false} className="k-b k-b-texto shrink-0 text-[14px]">
          {enlace.texto} <ChevronRight size={16} aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}

/** La línea de ayuda bajo la tarjeta de una sección. */
export function AyudaSeccion({ children }: { children: React.ReactNode }) {
  return <p className="px-1 pt-2 text-[13px] leading-[18px] text-tinta2">{children}</p>
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
 * Una muestra de color: círculo de 22 con aro de la superficie, para que dos
 * muestras se monten una sobre otra (`-ml-1.5` en la segunda) como en la
 * maqueta. El aro es lo que mantiene leíble un primario muy oscuro.
 */
export function MuestraColor({ color, encima }: { color: string; encima?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`block h-[22px] w-[22px] rounded-full ${encima ? '-ml-1.5' : ''}`}
      style={{ background: color, boxShadow: '0 0 0 2px var(--sup)' }}
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
    <section aria-labelledby="perfil-sec-consultorios">
      <RotuloSeccion
        id="perfil-sec-consultorios"
        icono={MapPin}
        titulo="Mis consultorios"
        enlace={total > 0 ? { href: HREF_CONSULTORIOS, texto: `Gestionar los ${total}` } : undefined}
      />
      <div className="k-tarjeta py-1">
        {cargando ? (
          <div className="flex flex-col gap-2 py-2" aria-busy="true">
            <div className="skeleton h-[52px] rounded-[12px]" />
            <div className="skeleton h-[52px] rounded-[12px]" />
          </div>
        ) : total === 0 ? (
          <p className="py-3 text-[14px] leading-5 text-tinta2">
            No tienes consultorios activos.{' '}
            <Link href={HREF_CONSULTORIOS} prefetch={false} className="font-semibold text-enlace hover:underline">
              Agrega el primero
            </Link>
            .
          </p>
        ) : (
          <ul className="k-lista">
            {visibles.map(c => (
              <li key={c.id} className="flex items-center gap-3 py-3">
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-sup2 text-enlace">
                  <MapPin size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="k-t-fila min-w-0 truncate">{c.nombre}</p>
                    {c.es_default && <span className="k-etq k-etq-tonal shrink-0">Predeterminado</span>}
                  </div>
                  <p className="k-t-sec">
                    {[c.direccion, c.telefono, offsetDeTimezone(c.timezone)].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {restantes > 0 && (
          <div className="border-t border-linea py-1">
            <Link href={HREF_CONSULTORIOS} prefetch={false} className="k-b k-b-texto text-[14px]">
              Ver {restantes} consultorio{restantes > 1 ? 's' : ''} más
            </Link>
          </div>
        )}
      </div>
      <AyudaSeccion>{total} de {MAX_CONSULTORIOS} activos</AyudaSeccion>
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
    <section className="k-tarjeta flex flex-wrap items-center gap-x-3 gap-y-2" aria-label="Google Calendar">
      <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-sup2">
        <IconoGoogleCalendar size={22} />
      </span>
      <div className="min-w-0 flex-1 basis-[180px]">
        <p className="k-t-tarjeta">Google Calendar</p>
        <p className="k-t-sec">
          {esAdmin
            ? 'Tus citas se sincronizan a un calendario que Spinus crea en tu cuenta.'
            : 'La gestiona quien administra la clínica: es una para todo el equipo.'}
        </p>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <ChipEstado esAdmin={esAdmin} estado={estado} />
        <Link href={HREF_GOOGLE} prefetch={false} className="k-b k-b-texto text-[14px]">
          Abrir <ChevronRight size={16} aria-hidden="true" />
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
  if (estado === null) return <span className="skeleton h-6 w-[104px] rounded-full" />

  /* Etiquetas del kit (CALMA §11): «Conectado» en verde, «Sin respuesta» en
     ámbar y «Sin conectar» neutra con tinta SECUNDARIA (no terciaria: sobre
     ese gris no llega al contraste mínimo). */
  if (estado === 'conectado') return <span className="k-etq k-etq-ok">Conectado</span>
  /* NO dice «no conectado»: aquí HAY token; lo que no hubo es respuesta de
     Google. Ofrecerle reconectar sería mandarle a rehacer algo que no está roto. */
  if (estado === 'error_google') return <span className="k-etq k-etq-aviso">Sin respuesta</span>
  return <span className="k-etq bg-sup2 text-tinta2">Sin conectar</span>
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
    /* Rediseño B10: la hoja va dentro de un marco `--sup2` (la «mesa»), y
       debajo del encabezado tres renglones grises sugieren el cuerpo del
       documento (decorativos, `aria-hidden`). Las tintas de dentro son
       LITERALES, como el blanco: la hoja no cambia con el oscuro, y una tinta
       del tema se volvería clara sobre papel blanco. */
    <div className="overflow-hidden rounded-[12px] bg-sup2 px-3 pt-3">
      <div className="rounded-t-[8px] px-4 pt-3 pb-4" style={{ background: 'white' }}>
        <div className="flex items-center gap-3">
          {logoUrl && (
            <img src={logoUrl} alt="" className="h-8 w-16 shrink-0 object-contain" />
          )}
          <div className="min-w-0 flex-1">
            {/* ⚠️ ENVUELVE, NO TRUNCA, PORQUE ES LO QUE HACE EL PAPEL: el PDF
                compone nombres largos en dos líneas completas (medido con
                Roboto-Bold a 16 pt), así que aquí se enseñan enteros hasta dos. */}
            <p className="line-clamp-2 text-[15px] font-bold leading-5 tracking-[0.3px]" style={{ color: colorPrimario }}>
              {nombre || 'Médico'}
            </p>
            {especialidad && (
              <p className="line-clamp-2 text-[12px] font-medium leading-4 tracking-[0.3px]" style={{ color: colorSecundario }}>
                {especialidad}
              </p>
            )}
            {cedulas.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5">
                {cedulas.map(c => (
                  <span key={c} className="inline-flex items-center gap-1 text-[12px] leading-4" style={{ color: '#5B6478' }}>
                    <span className="h-[3px] w-[3px] rounded-full" style={{ background: colorSecundario }} />
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Los dos filetes de cierre: grueso del primario, fino del secundario. */}
        <div className="mt-2.5 h-[2px] w-full" style={{ background: colorPrimario }} />
        <div className="mt-[1.5px] h-px w-full" style={{ background: colorSecundario }} />
        <div aria-hidden="true" className="mt-3 flex flex-col gap-1.5">
          <span className="block h-1.5 w-full rounded-full" style={{ background: '#E6EAF1' }} />
          <span className="block h-1.5 w-[86%] rounded-full" style={{ background: '#E6EAF1' }} />
          <span className="block h-1.5 w-[52%] rounded-full" style={{ background: '#E6EAF1' }} />
        </div>
      </div>
    </div>
  )
}
