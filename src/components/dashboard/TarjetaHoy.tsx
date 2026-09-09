'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import {
  tzDispositivo, hoyEnTZ, desplazarFecha, fechaHoraLocalAInstante, renderEnTZ,
} from '@/lib/dates'

/* ── LA BANDA DE ARGOLLAS ───────────────────────────────────────────────────
   ⚠️ COLOR SÓLIDO, NO DEGRADADO. El anexo del spec pedía degradado de marca;
   quedó derogado. Va en `--cp`, que hereda del perfil del médico.

   ⚠️ Y `--cp` ES EL NAVY OSCURO, NO EL AZUL BRILLANTE. Está invertido respecto
   a lo intuitivo y `CLAUDE.md` lo marca como la trampa de nombres que más se
   equivoca: `--cs` es el azul brillante y `--sp-primary` apunta a `--cs`, no a
   `--cp`. Verifica el token antes de tocarlo; no deduzcas por el nombre.

   Las argollas son la hoja asomando por detrás de la banda, y por eso su color
   se mezcla con el de la superficie de la card en vez de ser un blanco cableado:
   en claro salen pálidas sobre el navy, y en oscuro bajan de contraste con el
   resto del tema. No hay ningún token de «tinta sobre marca» en el sistema. */
const COLOR_ARGOLLA = 'color-mix(in srgb, var(--cp) 25%, var(--sp-surface))'

/** Alto del medallón, compartido con su esqueleto para que no salte. */
const MEDALLON = 'w-[70px] h-[70px]'

type Conteo = { citas: number; eventos: number }

type Dia = { fecha: string; inicial: string; numero: string; esHoy: boolean }

/* ⚠️ EL DÍA SE CALCULA EN CLIENTE Y NUNCA EN EL SERVIDOR. Este componente es de
   cliente, pero Next lo prerrenderiza igual en el servidor, y allí
   `tzDispositivo()` devuelve el huso del SERVIDOR (UTC en Vercel): se pintaría
   un día y al hidratar otro, en el número más grande de la pantalla.

   Se resuelve con `useSyncExternalStore`, que es el mecanismo que React ofrece
   para leer un valor que sólo existe en el cliente: devuelve `false` en el
   servidor y en el primer render de hidratación, y `true` después. Un
   `useState` + `useEffect` haría lo mismo pero con un `setState` síncrono
   dentro del efecto, que es cascada de renders y lo prohíbe el lint del repo.
   Las tres funciones van a nivel de módulo para que su identidad sea estable y
   `useSyncExternalStore` no se resuscriba en cada render. */
const SIN_SUSCRIPCION = () => () => {}
const EN_CLIENTE = () => true
const EN_SERVIDOR = () => false

function calcularDia(): { diaSemana: string; numero: string; mesAno: string; semana: Dia[] } {
  /* LA REGLA de `lib/dates.ts`: la fecha de una cita se calcula en el huso del
     DISPOSITIVO de quien mira. El huso va explícito en todas las llamadas; no
     hay valor por defecto que heredar, y ponerlo «porque compila» sería
     reintroducir a mano el bug de Sonora. */
  const tz = tzDispositivo()
  const hoy = hoyEnTZ(tz)
  const mediodia = (f: string) => fechaHoraLocalAInstante(f, '12:00', tz)

  /* ⚠️ LA SEMANA EMPIEZA EN LUNES. El formato `i` de date-fns es el día ISO
     (1 = lunes … 7 = domingo), así que el lunes de esta semana es hoy menos
     `i - 1` días. No es una preferencia: la app va en locale español, el locale
     de FullCalendar trae `week: { dow: 1 }` y `lib/agenda/rangoQuePedir.ts`
     construye sus rangos de lunes a lunes. Cambiarlo a domingo dejaría la tira
     desalineada con la agenda que abre el botón de abajo. */
  const iso = Number(renderEnTZ(mediodia(hoy), 'i', tz))
  const lunes = desplazarFecha(hoy, { dias: -(iso - 1) })

  return {
    diaSemana: renderEnTZ(mediodia(hoy), 'EEEE', tz),
    numero: renderEnTZ(mediodia(hoy), 'd', tz),
    mesAno: renderEnTZ(mediodia(hoy), 'MMMM yyyy', tz),
    semana: Array.from({ length: 7 }, (_, k) => {
      const fecha = desplazarFecha(lunes, { dias: k })
      return {
        fecha,
        /* La inicial única (`EEEEE`: l, m, m, j, v, s, d), en mayúscula por CSS.
           ⚠️ QUE MARTES Y MIÉRCOLES COMPARTAN «M» —y sábado y domingo la «S»— NO
           ES UN DEFECTO QUE ARREGLAR. Es lo que hace cualquier calendario: la
           POSICIÓN en la tira desambigua, porque las siete columnas van siempre
           en el mismo orden desde el lunes. Hubo una versión con dos letras
           (`EEEEEE`: lu, ma, mi…) y se retiró a propósito. */
        inicial: renderEnTZ(mediodia(fecha), 'EEEEE', tz),
        numero: renderEnTZ(mediodia(fecha), 'd', tz),
        esHoy: fecha === hoy,
      }
    }),
  }
}

function Banda() {
  return (
    /* Se queda arriba en los dos tamaños, pero más baja en móvil: ahí la
       tarjeta es apaisada y una banda de 26 px le comía alto sin aportar. */
    <div className="h-[18px] lg:h-[26px] flex items-end justify-center gap-[22px] lg:gap-[30px] pb-[3px] lg:pb-[5px]" style={{ background: 'var(--cp)' }}>
      <span className="w-2 h-2 lg:h-3 rounded-[var(--sp-r-pill)]" style={{ background: COLOR_ARGOLLA }} />
      <span className="w-2 h-2 lg:h-3 rounded-[var(--sp-r-pill)]" style={{ background: COLOR_ARGOLLA }} />
      <span className="w-2 h-2 lg:h-3 rounded-[var(--sp-r-pill)]" style={{ background: COLOR_ARGOLLA }} />
    </div>
  )
}

function Chasis({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="rounded-[18px] overflow-hidden border border-[color:var(--sp-line-card)] bg-[var(--sp-surface)]"
      style={{ boxShadow: 'var(--sp-shadow-raised)' }}
    >
      <Banda />
      {/* ⚠️ APAISADA EN MÓVIL, VERTICAL EN `lg`. En una columna estrecha la
          tarjeta vertical medía casi el alto de la pantalla; en horizontal el
          medallón y los textos van a la izquierda y la tira con el botón a la
          derecha. Los dos bloques que llegan como `children` traen `lg:contents`
          para disolverse a partir de `lg`, de modo que allí los seis elementos
          vuelven a ser hijos directos de esta columna y el escritorio queda
          exactamente como estaba. */}
      <div className="flex items-center gap-[var(--sp-4)] pt-[var(--sp-3)] px-[var(--sp-4-5)] pb-[var(--sp-3-5)] lg:flex-col lg:gap-[var(--sp-1-5)]">
        {children}
      </div>
    </section>
  )
}

/** El botón, idéntico en carga y en reposo: no depende de ningún dato. */
function BotonAgenda() {
  return (
    <Link
      href="/agenda"
      /* Sin precarga, como el resto de enlaces nuevos del rediseño: 2 peticiones
         RSC y 2 lambdas por carga del dashboard, se pulse o no. */
      prefetch={false}
      /* El relleno y la tinta salen de `.sp-btn--primary`; la geometría va en
         `style`, que gana a la clase, porque `.sp-btn` impone 44 px de alto y
         aquí el botón mide 40. Mismo recurso que el renglón de próximas citas:
         es la única forma de que el blanco sobre acento —que el sistema fija
         dentro de esa clase y no expone como token— entre sin cablear un hex. */
      className="sp-btn sp-btn--primary w-full mt-[var(--sp-1)]"
      style={{ minHeight: '40px', height: '40px', padding: '0 16px', borderRadius: 'var(--sp-r-icon-md)', fontSize: 'var(--sp-fs-btn-sm)' }}
    >
      Abrir agenda
    </Link>
  )
}

/**
 * La tarjeta en carga: banda de color desde el primer fotograma, medallón y
 * tira en hueso. La usan esta misma región mientras resuelve y
 * `DashboardSkeleton`, que se monta antes de que exista el perfil.
 */
export function TarjetaHoyCargando() {
  return (
    <Chasis>
      {/* Los mismos dos bloques que la tarjeta real, para que el paso de la
          carga al dato no reacomode nada. Ver la nota del `Chasis`. */}
      <div className="flex min-w-0 flex-1 flex-col items-center gap-[var(--sp-1-5)] lg:contents">
        <div className="skeleton h-2.5 w-14 rounded-md" />
        <div className="skeleton h-3.5 w-24 rounded-md" />
        <div className={`skeleton ${MEDALLON} rounded-full my-[var(--sp-1)]`} />
        <div className="skeleton h-3 w-32 max-w-full rounded-md" />
      </div>

      <div className="flex shrink-0 flex-col gap-[var(--sp-2-5)] lg:contents">
        <div className="w-full lg:border-t lg:border-dashed lg:border-[color:var(--sp-line-card)] lg:mt-[var(--sp-2-5)] lg:pt-[var(--sp-2-5)]">
          <div className="grid grid-cols-7 gap-[2px] [--pastilla:22px] lg:[--pastilla:27px]">
            {[1, 2, 3, 4, 5, 6, 7].map(i => (
              <div key={i} className="flex flex-col items-center gap-[3px]">
                <div className="skeleton h-2 w-4 rounded-sm" />
                <div className="skeleton w-[var(--pastilla)] h-[var(--pastilla)] shrink-0 rounded-full" />
              </div>
            ))}
          </div>
        </div>
        <BotonAgenda />
      </div>
    </Chasis>
  )
}

export default function TarjetaHoy() {
  const { profile, loading: loadingProfile } = useProfile()

  const esCliente = useSyncExternalStore(SIN_SUSCRIPCION, EN_CLIENTE, EN_SERVIDOR)
  const dia = esCliente ? calcularDia() : null

  const [conteo, setConteo] = useState<Conteo | null>(null)

  const medicoId = profile?.id ?? null

  useEffect(() => {
    if (!medicoId) return
    let vigente = true
    const supabase = createClient()

    /* ⚠️ LOS MISMOS FILTROS Y LA MISMA VENTANA QUE `/inicio` (`inicio/page.tsx:139`),
       Y ES OBLIGATORIO QUE COINCIDAN. Las dos cifras se ven en pantallas que el
       médico abre seguidas; si una cuenta canceladas y la otra no, o una cuenta
       la clínica entera y la otra sólo lo suyo, son dos números distintos para
       la misma pregunta. El comentario largo con el porqué de cada filtro está
       allí; aquí se copian, no se reinventan:
         · `medico_id`  — sólo lo suyo, también para el administrador.
         · `status`     — agendadas y confirmadas. El número es «lo que queda
                          por hacer», no «cuántas hubo»: una mañana que se vacía
                          por cancelaciones tiene que bajar.
         · ventana      — de las 00:00 de hoy a las 00:00 de mañana, EN EL HUSO
                          DEL DISPOSITIVO.

       LA ÚNICA DIFERENCIA es el corte entre las dos consultas, que allí no
       existe porque allí sólo se cuentan citas: `paciente_id` no nulo es una
       cita y nulo es un evento genérico (§12.14). Es el mismo criterio que usa
       la lista de próximas citas para descartarlos.

       ⚠️ HEREDA AG-DT-7. La ventana filtra por `start_time`, así que un evento
       de varios días que empezó ayer y sigue hoy no entra en el conteo. Es la
       deuda ya registrada, y se hereda A PROPÓSITO: corregirla sólo aquí
       rompería la coincidencia con `/inicio`, que es lo que este bloque pide
       garantizar. Se arregla en los dos sitios o en ninguno. */
    const tz = tzDispositivo()
    const inicioHoy = fechaHoraLocalAInstante(hoyEnTZ(tz), '00:00', tz)
    const inicioManana = fechaHoraLocalAInstante(desplazarFecha(hoyEnTZ(tz), { dias: 1 }), '00:00', tz)

    const base = () => supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('medico_id', medicoId)
      .in('status', ['scheduled', 'confirmed'])
      .gte('start_time', inicioHoy)
      .lt('start_time', inicioManana)

    Promise.all([
      base().not('paciente_id', 'is', null),
      base().is('paciente_id', null),
    ])
      .then(([citas, eventos]: { count: number | null }[]) => {
        if (!vigente) return
        setConteo({ citas: citas.count ?? 0, eventos: eventos.count ?? 0 })
      })
      .catch(() => {
        /* Se conservan fecha y botón y se omite el conteo, sin mensaje: es una
           cifra de apoyo, no el contenido de la tarjeta. Un aviso de error aquí
           pesaría más que el dato que falta. */
        if (!vigente) return
        setConteo(null)
      })

    return () => { vigente = false }
  }, [medicoId])

  /* Un solo sitio donde se compone el texto del conteo: lo pintan la pastilla
     de móvil y el renglón del mes de escritorio. */
  const textoConteo = conteo
    ? `${conteo.citas} ${conteo.citas === 1 ? 'cita' : 'citas'} · ${conteo.eventos} ${conteo.eventos === 1 ? 'evento' : 'eventos'}`
    : ''

  if (loadingProfile || !dia) return <TarjetaHoyCargando />

  return (
    <Chasis>
      {/* Bloque izquierdo en móvil: identidad del día. */}
      <div className="flex min-w-0 flex-1 flex-col items-center gap-[var(--sp-1-5)] lg:contents">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--sp-ink-350)]">Hoy es</p>

      <p className="text-[length:var(--sp-fs-btn-sm)] font-bold capitalize text-[var(--sp-primary)]">{dia.diaSemana}</p>

      {/* El número más grande de la pantalla: ningún otro texto compite con él. */}
      <div
        className={`${MEDALLON} my-[var(--sp-1)] flex items-center justify-center rounded-[var(--sp-r-pill)] border-[1.5px] border-[color:var(--sp-primary-border)] bg-[var(--sp-primary-bg-faint)]`}
        style={{ boxShadow: 'inset 0 2px 6px color-mix(in srgb, var(--cs) 10%, transparent)' }}
      >
        <span className="text-[38px] leading-none font-extrabold tracking-[-0.04em] text-[var(--sp-ink-900)] tabular-nums">
          {dia.numero}
        </span>
      </div>

      {/* ⚠️ EL CONTEO SE PINTA EN DOS SITIOS, UNO POR TAMAÑO, y el texto sale de
          una sola variable para que no puedan divergir. En `lg` va en este mismo
          renglón, detrás del mes; en móvil ese renglón envolvía a dos líneas, así
          que allí sube como pastilla sobre la tira —columna derecha— y aquí abajo
          queda el mes y año solos. Es la disposición del mockup móvil. */}
      <p className="text-center text-[length:var(--sp-fs-meta)] font-bold capitalize text-[var(--sp-ink-700)]">
        {dia.mesAno}
        {conteo && (
          <span className="hidden lg:inline">
            <span className="text-[var(--sp-ink-250)]"> · </span>
            <span className="text-[var(--sp-primary)] normal-case tabular-nums">{textoConteo}</span>
          </span>
        )}
      </p>
      </div>

      {/* Bloque derecho en móvil: tira y botón. */}
      <div className="flex shrink-0 flex-col gap-[var(--sp-2-5)] lg:contents">

      {/* Pastilla de conteo, sólo móvil: fondo de acento suave sobre la tira. */}
      {conteo && (
        <span className="lg:hidden self-start max-w-full truncate rounded-[var(--sp-r-pill)] bg-[var(--sp-primary-bg-soft)] px-[10px] py-[3px] text-[length:var(--sp-fs-legal)] font-bold tabular-nums text-[var(--sp-primary)]">
          {textoConteo}
        </span>
      )}

      {/* ── Tira de la semana ─────────────────────────────────────
          ⚠️ SIN PUNTOS Y SIN LEYENDA, y no es que falten: el spec pedía tres
          indicadores por día —citas, eventos y Google— y esa parte quedó
          derogada. Su único propósito es situar el día de hoy. No le añadas
          indicadores «ya que está la tira»: traerían de vuelta la petición a
          `/api/google/events` que este bloque existe para no hacer.

          ⚠️ Y LOS NÚMEROS NO SON CLICABLES. El spec pedía abrir la agenda
          posicionada en ese día y la agenda no acepta parámetro de fecha; el
          enlace profundo llega en el bloque 6. Un `<span>` que no navega es
          honesto; un enlace que ignora el día no lo es. */}
      {/* El separador punteado sólo tiene sentido en la pila vertical; en
          apaisado la tira ya está separada por la propia columna. */}
      <div className="w-full lg:border-t lg:border-dashed lg:border-[color:var(--sp-line-card)] lg:mt-[var(--sp-2-5)] lg:pt-[var(--sp-2-5)]">
          {/* ⚠️ EL DISCO MIDE FIJO Y SE DIMENSIONA DESDE EL NÚMERO, no al revés,
            y NO usa porcentajes. Las dos versiones anteriores lo ataban a
            `width: 100%` dentro de esta columna, y la columna es `flex-col
            items-center`: su ancho es el de su contenido, o sea el de la letra
            de arriba. Un porcentaje del ancho del hermano es una definición
            circular, y se resolvía al ancho de la letra — por eso al pasar de
            dos letras a una el disco encogió todavía más y recortaba el dígito.
            Con `--pastilla` fijo (22 en móvil, 27 en `lg`, contra un número de
            12,5) el disco no depende de nadie.

            Y sin `justify-items-center`: con él la celda encogía a su contenido
            y volvía a meter al hermano en la ecuación. */}
        <div className="grid grid-cols-7 gap-[2px] [--pastilla:22px] lg:[--pastilla:27px]">
          {dia.semana.map(d => (
            <div key={d.fecha} className="flex flex-col items-center gap-[3px]">
              <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--sp-ink-350)]">{d.inicial}</span>
              {/* Las dos ramas comparten CLASE DE GEOMETRÍA y sólo difieren en la
                  piel: el disco de hoy va relleno de acento con tinta clara —los
                  dos de token, sin heredar nada de `.sp-chip`—, y el resto es el
                  mismo cuadrado sin fondo. */}
              <span
                className="w-[var(--pastilla)] h-[var(--pastilla)] shrink-0 flex items-center justify-center rounded-[var(--sp-r-pill)] text-[12.5px] tabular-nums"
                style={d.esHoy
                  ? { background: 'var(--sp-primary)', color: 'var(--sp-on-primary)', fontWeight: 'var(--sp-fw-bold)' }
                  : { color: 'var(--sp-ink-600)' }}
              >
                {d.numero}
              </span>
            </div>
          ))}
        </div>
      </div>

      <BotonAgenda />
      </div>
    </Chasis>
  )
}
