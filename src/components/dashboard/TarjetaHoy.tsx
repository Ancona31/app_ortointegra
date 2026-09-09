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
        /* Dos letras (`EEEEEE`: lu, ma, mi, ju, vi, sá, do) y no la inicial de
           una sola que pedía el anexo. En español la inicial deja DOS «m»
           seguidas —martes y miércoles—, que en una tira de siete columnas se
           lee como un defecto. Las dos letras salen del mismo locale. */
        inicial: renderEnTZ(mediodia(fecha), 'EEEEEE', tz),
        numero: renderEnTZ(mediodia(fecha), 'd', tz),
        esHoy: fecha === hoy,
      }
    }),
  }
}

function Banda() {
  return (
    <div className="h-[26px] flex items-end justify-center gap-[30px] pb-[5px]" style={{ background: 'var(--cp)' }}>
      <span className="w-2 h-3 rounded-[var(--sp-r-pill)]" style={{ background: COLOR_ARGOLLA }} />
      <span className="w-2 h-3 rounded-[var(--sp-r-pill)]" style={{ background: COLOR_ARGOLLA }} />
      <span className="w-2 h-3 rounded-[var(--sp-r-pill)]" style={{ background: COLOR_ARGOLLA }} />
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
      <div className="flex flex-col items-center gap-[var(--sp-1-5)] pt-[var(--sp-3)] px-[var(--sp-4-5)] pb-[var(--sp-3-5)]">
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
      <div className="skeleton h-2.5 w-14 rounded-md" />
      <div className="skeleton h-3.5 w-24 rounded-md" />
      <div className={`skeleton ${MEDALLON} rounded-full my-[var(--sp-1)]`} />
      <div className="skeleton h-3 w-32 rounded-md" />
      <div className="w-full border-t border-dashed border-[color:var(--sp-line-card)] mt-[var(--sp-2-5)] pt-[var(--sp-2-5)]">
        <div className="grid grid-cols-7 gap-[2px]">
          {[1, 2, 3, 4, 5, 6, 7].map(i => (
            <div key={i} className="flex flex-col items-center gap-[3px]">
              <div className="skeleton h-2 w-4 rounded-sm" />
              <div className="skeleton w-[27px] h-[27px] rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <BotonAgenda />
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

  if (loadingProfile || !dia) return <TarjetaHoyCargando />

  return (
    <Chasis>
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

      <p className="text-center text-[length:var(--sp-fs-meta)] font-bold capitalize text-[var(--sp-ink-700)]">
        {dia.mesAno}
        {conteo && (
          <>
            <span className="text-[var(--sp-ink-250)]"> · </span>
            <span className="text-[var(--sp-primary)] normal-case tabular-nums">
              {conteo.citas} {conteo.citas === 1 ? 'cita' : 'citas'} · {conteo.eventos} {conteo.eventos === 1 ? 'evento' : 'eventos'}
            </span>
          </>
        )}
      </p>

      {/* ── Tira de la semana ────────────────────────────────────────────────
          ⚠️ SIN PUNTOS Y SIN LEYENDA, y no es que falten: el spec pedía tres
          indicadores por día —citas, eventos y Google— y esa parte quedó
          derogada. Su único propósito es situar el día de hoy. No le añadas
          indicadores «ya que está la tira»: traerían de vuelta la petición a
          `/api/google/events` que este bloque existe para no hacer.

          ⚠️ Y LOS NÚMEROS NO SON CLICABLES. El spec pedía abrir la agenda
          posicionada en ese día y la agenda no acepta parámetro de fecha; el
          enlace profundo llega en el bloque 6. Un `<span>` que no navega es
          honesto; un enlace que ignora el día no lo es. */}
      <div className="w-full border-t border-dashed border-[color:var(--sp-line-card)] mt-[var(--sp-2-5)] pt-[var(--sp-2-5)]">
        <div className="grid grid-cols-7 gap-[2px]">
          {dia.semana.map(d => (
            <div key={d.fecha} className="flex flex-col items-center gap-[3px]">
              <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--sp-ink-350)]">{d.inicial}</span>
              {d.esHoy ? (
                /* La pastilla de hoy toma el relleno y la tinta de
                   `.sp-chip--selected`, por el mismo motivo que el botón: es el
                   acento relleno con blanco encima, y ese blanco vive dentro de
                   la clase. La geometría, en `style`, que gana a la clase. */
                <span
                  className="sp-chip sp-chip--selected tabular-nums"
                  /* `justifyContent` NO sobra: `.sp-chip` centra en vertical
                     pero no en horizontal —da por hecho un chip con texto y
                     relleno lateral—, y aquí el contenido es un número dentro
                     de un círculo de 27 px. Sin esto, los días de una cifra se
                     pegan al borde izquierdo. */
                  style={{ width: '27px', height: '27px', minHeight: '27px', padding: 0, justifyContent: 'center', borderRadius: 'var(--sp-r-pill)', fontSize: '12.5px', fontWeight: 'var(--sp-fw-bold)', cursor: 'default' }}
                >
                  {d.numero}
                </span>
              ) : (
                <span className="w-[27px] h-[27px] flex items-center justify-center text-[12.5px] text-[var(--sp-ink-600)] tabular-nums">
                  {d.numero}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <BotonAgenda />
    </Chasis>
  )
}
