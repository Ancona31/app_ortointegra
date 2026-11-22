'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import {
  tzDispositivo, hoyEnTZ, desplazarFecha, fechaHoraLocalAInstante, renderEnTZ,
} from '@/lib/dates'


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

function mayusculaInicial(t: string): string {
  return `${t.charAt(0).toUpperCase()}${t.slice(1)}`
}

function calcularDia(): { fechaLarga: string; semana: Dia[] } {
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
    /* Día de la semana, número, mes y año en una línea; mayúscula sólo en la
       primera letra (no `capitalize`: daría «De Noviembre»). */
    fechaLarga: mayusculaInicial(renderEnTZ(mediodia(hoy), "EEEE d 'de' MMMM 'de' yyyy", tz)),
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

/* ── LA TARJETA «HOY», FUNDIDA EN LA CABECERA (rediseño B5) ────────────────
   La maqueta `dashboard-final` quita la tarjeta con banda de argollas: el día,
   el conteo, la tira de la semana y «Abrir agenda» van en la cabecera del
   dashboard, sin caja propia (en `iv`, la tira sí va en tarjeta, CALMA §23.13).
   Las mismas cuatro piezas de antes; «Hoy es» queda para el lector de
   pantalla, delante de la fecha. */

/** «Abrir agenda», idéntico en carga y en reposo: no depende de ningún dato. */
function BotonAgenda() {
  return (
    /* Sin precarga, como el resto de enlaces nuevos del rediseño: 2 peticiones
       RSC y 2 lambdas por carga del dashboard, se pulse o no. */
    <Link href="/agenda" prefetch={false} className="k-b k-b-texto shrink-0 justify-self-end text-[14px] [grid-area:agenda]">
      Abrir agenda <ChevronRight aria-hidden="true" className="size-4" />
    </Link>
  )
}

/* Las piezas se colocan por áreas. En una columna (ext/tel/iv): la fecha, luego
   el conteo con «Abrir agenda» a su derecha, y la tira debajo. En `ih` y `esc`,
   fecha y conteo a la izquierda, la tira en medio y «Abrir agenda» al final. */
const AREAS = '[grid-template-areas:"fecha_fecha"_"conteo_agenda"_"semana_semana"] grid-cols-[minmax(0,1fr)_auto] ' +
  'ih:[grid-template-areas:"fecha_semana_agenda"_"conteo_semana_agenda"] ih:grid-cols-[auto_auto_auto] ih:justify-between ' +
  'esc:[grid-template-areas:"fecha_semana_agenda"_"conteo_semana_agenda"] esc:grid-cols-[auto_auto_auto]'

function Chasis({ children }: { children: React.ReactNode }) {
  return (
    <section aria-label="Hoy" className={`grid items-center gap-x-4 gap-y-0.5 ${AREAS} esc:gap-x-6`}>
      {children}
    </section>
  )
}

/** La tira, en tarjeta sólo en `iv` (CALMA §23.13). */
const TIRA = '[grid-area:semana] mt-2 grid grid-cols-7 gap-0.5 iv:mt-3 iv:rounded-[16px] iv:bg-sup iv:px-2 iv:py-3 ' +
  'ih:mt-0 ih:grid-cols-[repeat(7,28px)] ih:gap-0.5 esc:mt-0 esc:grid-cols-[repeat(7,32px)] esc:gap-1'

/**
 * La tarjeta en carga: fecha y tira en hueso. La usan esta misma región
 * mientras resuelve y `DashboardSkeleton`, que se monta antes de que exista el
 * perfil.
 */
export function TarjetaHoyCargando() {
  return (
    <Chasis>
      <div className="skeleton h-4 w-48 max-w-full rounded-md [grid-area:fecha]" aria-hidden="true" />
      <div className="skeleton mt-1 h-3 w-24 rounded-md [grid-area:conteo]" aria-hidden="true" />
      <BotonAgenda />
      <ol className={TIRA} aria-hidden="true">
        {[1, 2, 3, 4, 5, 6, 7].map(i => (
          <li key={i} className="flex flex-col items-center gap-1">
            <div className="skeleton h-3 w-3 rounded-sm" />
            <div className="skeleton size-8 rounded-full" />
          </li>
        ))}
      </ol>
    </Chasis>
  )
}
export default function TarjetaHoy({ medicoId }: {
  /* A quién cuenta la tarjeta. Un id = sólo las de ese médico (dashboard del
     médico). `null` = las de toda la clínica, que es lo que necesita la
     secretaria: ella no tiene citas propias.
     Es un prop y no `profile.id` leído aquí dentro justamente para que el
     llamador tenga que decidirlo: leerlo por su cuenta daba por hecho que quien
     mira es el dueño de las citas, y para la secretaria eso es falso. */
  medicoId: string | null
}) {
  const { profile, loading: loadingProfile } = useProfile()

  const esCliente = useSyncExternalStore(SIN_SUSCRIPCION, EN_CLIENTE, EN_SERVIDOR)
  const dia = esCliente ? calcularDia() : null

  const [conteo, setConteo] = useState<Conteo | null>(null)

  const clinicaId = profile?.clinica_id ?? null

  useEffect(() => {
    if (!clinicaId) return
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

    const base = () => {
      const q = supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('clinica_id', clinicaId)
        .in('status', ['scheduled', 'confirmed'])
        .gte('start_time', inicioHoy)
        .lt('start_time', inicioManana)
      /* El filtro por médico es lo único que separa las dos vistas. Sin él
         cuenta la clínica entera, que es lo que la secretaria necesita. */
      return medicoId === null ? q : q.eq('medico_id', medicoId)
    }

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
  }, [clinicaId, medicoId])

  /* Un solo sitio donde se compone el texto del conteo. */
  const textoConteo = conteo
    ? `${conteo.citas} ${conteo.citas === 1 ? 'cita' : 'citas'} · ${conteo.eventos} ${conteo.eventos === 1 ? 'evento' : 'eventos'}`
    : ''

  if (loadingProfile || !dia) return <TarjetaHoyCargando />

  return (
    <Chasis>
      {/* «Jueves 19 de noviembre de 2026»: día de la semana, número, mes y año. */}
      <p className="min-w-0 text-[15px] font-semibold leading-5 text-tinta [grid-area:fecha] ih:whitespace-nowrap iv:text-[17px] iv:leading-[22px] esc:whitespace-nowrap">
        <span className="sr-only">Hoy es </span>{dia.fechaLarga}
      </p>
      {/* Se omite el conteo si falló, sin mensaje: es una cifra de apoyo. */}
      <p className="k-num min-h-[18px] text-[13px] leading-[18px] text-tinta2 [grid-area:conteo]">{textoConteo}</p>

      <BotonAgenda />

      {/* ── Tira de la semana ─────────────────────────────────────
          ⚠️ SIN PUNTOS Y SIN LEYENDA: su único propósito es situar el día de
          hoy. No le añadas indicadores: traerían de vuelta la petición a
          `/api/google/events` que este bloque existe para no hacer.
          ⚠️ Y LOS NÚMEROS NO SON CLICABLES: la agenda no acepta parámetro de
          fecha. Un elemento que no navega es honesto; un enlace que ignora el
          día no lo es.
          ⚠️ QUE MARTES Y MIÉRCOLES COMPARTAN «M» NO ES UN DEFECTO: la posición
          desambigua (siempre de lunes a domingo). */}
      <ol className={TIRA}>
        {dia.semana.map(d => (
          <li key={d.fecha} aria-current={d.esHoy ? 'date' : undefined} className="flex flex-col items-center gap-0.5">
            <span className={`text-[12px] font-semibold uppercase leading-4 ${d.esHoy ? 'text-tinta' : 'text-tinta3'}`}>{d.inicial}</span>
            <span className={`k-num flex size-8 items-center justify-center rounded-full text-[15px] ih:size-7 ${d.esHoy ? 'bg-tonal font-bold text-tonal-tinta' : 'text-tinta2'}`}>
              {d.numero}
            </span>
          </li>
        ))}
      </ol>
    </Chasis>
  )
}
