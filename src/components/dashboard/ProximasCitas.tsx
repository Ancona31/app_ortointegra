'use client'

import { useState, useEffect, useCallback, useRef, type ReactElement, type ReactNode } from 'react'
import Link from 'next/link'
import { CalendarDays, RotateCw } from 'lucide-react'
import type { createClient as ClienteNavegador } from '@/lib/supabase/client'
import { esPorAsignar } from '@/lib/agenda/tarjetasAgenda'
import BotonNoEsCita from '@/components/agenda/BotonNoEsCita'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { BotonEstados, FilaCita, FilaCitaClinica, HojaCita, PiezaPrincipal, TARJETA } from './PiezasCita'

/* ⚠️ SE PIDEN 6 Y SE PINTAN 4, Y LA ASIMETRÍA ES DELIBERADA — no la «arregles»
   igualando los números. El temporizador de abajo retira filas vencidas SIN
   volver a consultar; sin colchón, la primera cita que termina deja un hueco
   que nadie rellena hasta el siguiente refetch. Es el mismo patrón que
   `AsistenteDashboard.tsx:72` («pide 8 y pinta 4»), por un motivo distinto:
   allí el colchón alimenta un filtro en cliente, aquí alimenta el vencimiento. */
const LIMITE_CONSULTA = 6
const FILAS_VISIBLES = 4

/* Un minuto. Es la resolución de la hora que se pinta: por debajo no se vería
   nada distinto y por encima una cita podría seguir «en curso» ya terminada. */
const TIC_MS = 60_000

/* Dos minutos: antigüedad mínima de la última traída para que volver a la
   pestaña pida otra vez. Es el MISMO criterio y la misma cifra que
   `UMBRAL_REFETCH_FOCO_MS` de `agenda/useTiempoRealAgenda.ts`; allí no se
   exporta y vive en un gancho de la agenda, así que se repite aquí en vez de
   importar el dashboard desde la agenda. Si cambia una, cambia la otra. */
const UMBRAL_REFETCH_FOCO_MS = 120_000

export type Cita = {
  id: string
  title: string
  start_time: string
  end_time: string
  created_at: string
  status: string
  paciente_id: string | null
  consultorio_id: string | null
  pacientes: { nombre: string; apellidos: string } | null
  /* I3 (punto 8 y 10) · Sólo con la agenda v2 encendida (las columnas pueden no
     existir): una cita POR LIGAR (reserva por enlace) o un evento de Google
     «por asignar», sin paciente todavía. */
  reserva_canal?: string | null
  reserva_nombre?: string | null
  google_asignacion?: string | null
  /* Sólo llega cuando `medicoId` es null, o sea cuando la lista es de toda la
     clínica: ahí el nombre del paciente no dice de quién es la cita. */
  medico?: { id: string; titulo: string | null; nombres: string | null; apellido_paterno: string | null; apellido_materno: string | null } | null
}

type Supabase = ReturnType<typeof ClienteNavegador>

const COLUMNAS = 'id, title, start_time, end_time, created_at, status, paciente_id, consultorio_id, pacientes(nombre, apellidos)'
const COLUMNAS_MEDICO = ', medico:profiles!appointments_medico_id_fkey(id, titulo, nombres, apellido_paterno, apellido_materno)'
/* I3 · Con la v2: las columnas de la marca y el nombre de quien reservó. */
const COLUMNAS_V2 = ', reserva_canal, reserva_nombre, google_asignacion'
/* I3 · Con la v2 entran también las POR LIGAR y las «por asignar» de Google;
   un evento (sin paciente, sin reserva, que no está por asignar) sigue fuera. */
const CON_PACIENTE_O_POR_LIGAR = 'paciente_id.not.is.null,reserva_canal.not.is.null,google_asignacion.eq.por_asignar'

/**
 * I3 (punto 8) · El interruptor de la agenda v2 de la clínica, con la sesión
 * (la RLS de `agenda_ajustes` deja leer a sus miembros). FALLA CERRADO, como
 * `agendaV2Encendida`: sin tabla, sin fila o con error, apagado. `null` = no se
 * pudo leer (no se recuerda: se vuelve a preguntar en la próxima traída).
 */
async function leerAgendaV2(supabase: Supabase, clinicaId: string): Promise<boolean | null> {
  try {
    const { data, error } = await supabase.from('agenda_ajustes').select('agenda_v2_encendida').eq('clinica_id', clinicaId).maybeSingle()
    if (error) return error.code === '42P01' || error.code === 'PGRST205' ? false : null
    return data?.agenda_v2_encendida === true
  } catch {
    return null
  }
}

/* VELOCIDAD · El interruptor ya leído, por clínica, mientras viva la pestaña.
   Antes se recordaba por MONTAJE (`v2Ref`), así que cada regreso al dashboard
   pagaba `agenda_ajustes` → `appointments` EN SERIE: dos idas y vueltas al
   otro lado del continente donde basta una. Sólo se recuerda una lectura
   buena (`true`/`false`); `null` (no se pudo leer) se vuelve a preguntar, como
   antes. Un cambio del interruptor se ve al recargar la pestaña. */
const v2PorClinica = new Map<string, boolean>()

/** El interruptor de la clínica: de memoria si ya se leyó en esta pestaña; si no, se lee y se recuerda. */
export async function agendaV2DeClinica(supabase: Supabase, clinicaId: string): Promise<boolean> {
  const recordado = v2PorClinica.get(clinicaId)
  if (recordado !== undefined) return recordado
  const leido = await leerAgendaV2(supabase, clinicaId)
  if (leido !== null) v2PorClinica.set(clinicaId, leido)
  return leido === true
}

/** La consulta de la región (ver los filtros en `cargar`). `v2` añade las citas por ligar y por asignar. */
function consultaProximas(supabase: Supabase, o: { clinicaId: string; medicoId: string | null; v2: boolean }) {
  let consulta = supabase
    .from('appointments')
    .select(`${COLUMNAS}${o.medicoId === null ? COLUMNAS_MEDICO : ''}${o.v2 ? COLUMNAS_V2 : ''}`)
    .eq('clinica_id', o.clinicaId)
  consulta = o.v2 ? consulta.or(CON_PACIENTE_O_POR_LIGAR) : consulta.not('paciente_id', 'is', null)
  consulta = consulta
    .gt('end_time', new Date().toISOString())
    .in('status', ['scheduled', 'confirmed'])
    .order('start_time', { ascending: true })
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(LIMITE_CONSULTA)
  return o.medicoId !== null ? consulta.eq('medico_id', o.medicoId) : consulta
}

/** La columna aún no existe (la v2 encendida sin la migración de I3): se cae a la consulta de siempre. */
function sinColumna(code: string | undefined): boolean {
  return code === '42703' || code === 'PGRST204' || code === 'PGRST100'
}

/** Dónde se pinta una acción: en la pieza principal (a la vista) o en la hoja de la cita. */
export type Donde = 'principal' | 'hoja'

/** Las filas en hueso de una lista: chip de fecha y dos barras (maqueta `dashboard-final`). */
function FilasEsqueleto({ n }: { n: number }): ReactElement {
  return (
    <div aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex min-h-[64px] items-center gap-3 border-t border-linea py-3 first:border-t-0">
          <div className="skeleton h-[50px] w-[52px] shrink-0 rounded-[12px]" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="skeleton h-3 w-[55%] rounded-md" />
            <div className="skeleton h-3 w-[35%] rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * La tarjeta de la lista: título, «Estados» (la leyenda) y «Ver agenda →».
 * El título es «Próximas citas» en la vista de toda la clínica y «Después» en
 * la del médico, donde la primera cita sube a la pieza principal (maqueta
 * `dashboard-final`).
 */
function Chasis({ titulo, className = '', children }: { titulo: string; className?: string; children: ReactNode }): ReactElement {
  return (
    <section className={`${TARJETA} ext:px-3 iv:px-4 ${className}`}>
      {/* En las columnas estrechas (ext, iv) los dos enlaces bajan a 13 para
          caber en la fila del título, como en la maqueta. */}
      <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 ext:gap-x-2 iv:gap-x-2">
        <h2 className="mr-auto text-[17px] font-bold leading-[22px] text-tinta">{titulo}</h2>
        <BotonEstados />
        <Link href="/agenda" prefetch={false} className="k-b k-b-texto text-[14px] ext:text-[13px] iv:text-[13px]">Ver agenda →</Link>
      </div>
      <div className="border-t border-linea">{children}</div>
    </section>
  )
}

/** Error y vacío: un bloque centrado dentro de la tarjeta. */
function AvisoLista({ error, alReintentar }: { error: boolean; alReintentar: () => void }): ReactElement {
  if (error) return (
    <div className="flex flex-col items-center gap-3 py-6">
      <p className="text-center text-[14px] text-tinta2">No se pudieron cargar las citas.</p>
      <button type="button" onClick={alReintentar} className="k-b k-b-tonal"><RotateCw aria-hidden="true" className="size-4" /> Reintentar</button>
    </div>
  )
  return (
    <div className="flex flex-col items-center gap-2 py-6">
      <CalendarDays aria-hidden="true" className="size-[22px] text-tinta3" />
      <p className="text-center text-[14px] text-tinta2">No hay citas agendadas.</p>
      <Link href="/agenda" prefetch={false} className="k-b k-b-texto text-[14px]">Abrir agenda →</Link>
    </div>
  )
}

/** Tanda J (punto 6) · La acción de «Ligar e iniciar consulta» de una fila sin paciente, si el llamador la da. */
type AccionLigar = (cita: Cita, enCurso: boolean, alQuitar: () => void, donde: Donde) => ReactNode

/** Las acciones de una cita con paciente, que pinta el llamador. */
type AccionesCita = (cita: Cita, enCurso: boolean, donde: Donde) => ReactNode

/**
 * I3 (puntos 8 y 10) · Las acciones de una cita SIN paciente: «Ver en la
 * agenda» (allí se liga al iniciar la consulta) y, en un evento de Google «por
 * asignar», «¿No es una cita?», que la quita de la lista en el momento. Viven
 * aquí y no en el llamador porque no llevan a ninguna URL clínica.
 * Tanda J (punto 6) · Si el llamador pasa `ligar` (el dashboard del médico) y
 * devuelve un botón, ése sustituye a «Ver en la agenda»: la ventana de ligar,
 * que sí lleva a la nota, la monta el llamador, nunca este archivo.
 * Rediseño B5: la explicación de «¿No es una cita?», que sólo vivía en su
 * `title`, se ve debajo (CALMA §29.7).
 */
function AccionesSinPaciente({ cita, enCurso, alQuitar, ligar, donde }: {
  cita: Cita; enCurso: boolean; alQuitar: () => void; ligar?: AccionLigar; donde: Donde
}): ReactElement {
  const boton = ligar?.(cita, enCurso, alQuitar, donde) ?? null
  const ancho = donde === 'hoja' ? 'w-full k-b-capa' : 'flex-1 ih:flex-none iv:flex-none esc:flex-none'
  /* En la pieza principal, «¿No es una cita?» va SIEMPRE debajo del botón (una
     columna): al lado, saltaba de línea o no según el ancho que quedara. */
  const enColumna = donde === 'principal' && esPorAsignar(cita)
  const contenido = (
    <>
      {boton ?? (
        <Link href="/agenda" prefetch={enCurso ? undefined : false} aria-label={`Ver «${cita.reserva_nombre ?? cita.title}» en la agenda`}
          className={`k-b k-b-prim ${ancho}`}>
          Ver en la agenda
        </Link>
      )}
      {esPorAsignar(cita) && (
        <span data-no-cierra className={`flex flex-col items-center ${donde === 'hoja' ? 'mt-3 w-full' : ''}`}>
          <BotonNoEsCita citaId={cita.id} alHecho={alQuitar} className="k-b k-b-texto" />
          {donde === 'hoja' && <span className="mt-1 text-center text-[13px] leading-[18px] text-tinta2">Dejarlo como evento sin paciente: deja de pedir que se ligue</span>}
        </span>
      )}
    </>
  )
  return enColumna
    ? <span className="flex w-full flex-col items-stretch gap-1 ih:w-auto iv:w-auto esc:w-auto">{contenido}</span>
    : contenido
}

/**
 * La lista en su estado de carga, entera. La pintan esta misma región mientras
 * consulta y `DashboardSkeleton` —que se monta antes de que exista el perfil y
 * de saber el rol—, así que lleva el título neutro de la región.
 */
export function ProximasCitasCargando(): ReactElement {
  return <Chasis titulo="Próximas citas"><FilasEsqueleto n={3} /></Chasis>
}

/** La pieza principal mientras carga: mismo hueco, chip y barras en `--sup2` (maqueta). */
function PrincipalCargando({ className }: { className: string }): ReactElement {
  return (
    <section aria-label="Lo que sigue" className={`${TARJETA} ${className}`}>
      <div className="flex items-center gap-3" aria-hidden="true">
        <div className="skeleton h-[50px] w-[52px] shrink-0 rounded-[12px]" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="skeleton h-3 w-[60%] rounded-md" />
          <div className="skeleton h-3 w-[40%] rounded-md" />
        </div>
      </div>
      <div className="skeleton mt-4 h-11 rounded-[12px]" aria-hidden="true" />
    </section>
  )
}

/**
 * ⚠️ ESTE COMPONENTE NO CONOCE NINGUNA URL CLÍNICA, Y NO DEBE VOLVER A
 * CONOCERLA. Las acciones del renglón las pinta QUIEN LO LLAMA, con el prop
 * `acciones`. Es lo que hace estructuralmente cierto que la vista de la
 * secretaria no tenga expediente ni nota: no están apagados por una bandera —
 * es que no existen en este archivo. Un `grep` de `expediente` aquí debe dar
 * cero. Si algún día vuelves a meter los botones dentro con un
 * `variante === 'medico'`, esa garantía se pierde entera.
 */
/**
 * ⚠️ NO HAY FILTRO DE MÉDICO, Y NO ES UN OLVIDO: SE DECIDIÓ NO PONERLO.
 *
 * El spec del dashboard de la secretaria pide un selector para filtrar estas
 * citas por médico. Se descartó por dos razones, y las dos siguen vigentes:
 *
 *   · En la vista de la secretaria (`medicoId === null`) CADA RENGLÓN YA DICE
 *     de qué médico es la cita — se pinta abajo, junto al consultorio. Un
 *     filtro sobre cuatro filas que ya vienen etiquetadas añade un control que
 *     hay que aprender para esconder información que cabía entera.
 *   · Para filtrar de verdad está LA AGENDA, que es la pantalla de la jornada
 *     completa y ya tiene su selector de médico. Este panel es un vistazo a lo
 *     que viene ahora, no una herramienta de consulta.
 *
 * Si vuelves aquí desde el spec creyendo que falta algo, esto es lo que falta:
 * nada. Añadirlo es una decisión de producto, no la corrección de un defecto.
 */
export default function ProximasCitas({ medicoId, acciones, ligar, claseHero = '', claseLista = '' }: {
  /* `null` = todas las citas de la clínica (vista de la secretaria). Un id =
     sólo las de ese médico. Cuando es `null` la consulta trae además el médico
     de cada fila y el renglón lo pinta: sin filtro, el nombre del paciente no
     dice a quién pasa. Las dos cosas van juntas a propósito.
     Rediseño B5: `null` pinta UNA lista («Próximas citas») cuyas filas son
     «Ver cita» enteras; un id pinta la pieza principal y «Después». */
  medicoId: string | null
  /* Las acciones de una cita CON paciente, que pinta el llamador (sólo el
     médico; la vista de toda la clínica no las pasa).
     ⚠️ RECIBE `enCurso` PORQUE DE ÉL DEPENDE LA PRECARGA:
     `prefetch={enCurso ? undefined : false}`. Cuatro filas por dos enlaces
     serían ocho precargas donde antes había dos, y eso revierte entero el
     ahorro medido de `fcb2169`. En la hoja siempre llega `false`.
     `donde`: «principal» (a la vista, en la pieza principal) u «hoja» (la hoja
     de acciones de la cita, CALMA §24.2). */
  acciones?: AccionesCita
  /* Tanda J (punto 6) · Sólo el dashboard del médico: en una fila por ligar o
     por asignar, el botón de «Ligar paciente e iniciar consulta» (o `null`, y
     queda «Ver en la agenda»). La vista de la secretaria no lo pasa. */
  ligar?: AccionLigar
  /* Clases de colocación en la retícula de la página (rediseño B5): la pieza
     principal y la lista son dos hijos de esa retícula. */
  claseHero?: string
  claseLista?: string
}): ReactElement {
  const { profile, loading: loadingProfile } = useProfile()

  const [citas, setCitas] = useState<Cita[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)

  /* El reloj de la región. Cambia cada minuto y sólo re-renderiza ESTE
     componente: por eso la región vive en su propio archivo y no dentro de
     `dashboard/page.tsx`, donde el tic habría re-renderizado la cabecera, la
     banda 2 y las cuatro tarjetas de módulos cada sesenta segundos. */
  const [ahora, setAhora] = useState(() => Date.now())

  const clinicaId = profile?.clinica_id ?? null

  /* Gana la última petición LANZADA, no la última en responder. Mismo criterio
     que tenía el efecto en la página, con contador en vez de bandera porque
     aquí hay tres disparadores —montaje, volver a la pestaña y reintentar— y
     dos pueden solaparse. */
  const peticionRef = useRef(0)

  /* Cuándo salió la última petición. Se estampa al SALIR, no al volver, como en
     la agenda: así dos señales seguidas no piden dos veces. Una petición que
     FALLA también cuenta, igual que allí: con la red caída, cambiar de pestaña
     no debe martillear. Para eso está «Reintentar», que no pasa por el tope. */
  const ultimaTraidaRef = useRef(0)

  const cargar = useCallback(async () => {
    if (!clinicaId) return
    const mia = ++peticionRef.current
    ultimaTraidaRef.current = Date.now()
    setError(false)
    try {
      const supabase = createClient()
      /* SÓLO CITAS DE PACIENTE, NUNCA EVENTOS GENÉRICOS: la fila sin paciente
         es un evento (§12.14) y gastaría uno de los cuatro sitios. Se filtra en
         la consulta y no al pintar, que es donde de verdad recorta. (I3: con la
         v2, una por ligar o «por asignar» es una cita sin paciente todavía, y
         entra; un evento sigue fuera.)

         SÓLO LAS DEL MÉDICO QUE MIRA. Su dashboard es su resumen; la clínica
         entera está en /agenda. Ese `.eq('medico_id')` es lo que garantiza que
         toda fila que llega es suya, y por eso el renglón ya no comprueba el
         dueño antes de ofrecer «Iniciar consulta»: la comprobación vivía en un
         `join` a `profiles` que se ha retirado con él.

         ⚠️ EL FILTRO ES POR `end_time`, NO POR `start_time`. Es lo que deja la
         cita EN CURSO dentro de la lista hasta que termina, en vez de hacerla
         desaparecer en el instante en que empieza —justo cuando el médico la
         necesita—. Si vuelves a `.gt('start_time', ...)`, el realce de fila en
         curso de abajo se queda sin filas que realzar.

         ⚠️ Y EL ORDEN LLEVA DESEMPATE. Con sólo `start_time`, dos citas a la
         misma hora salen en orden arbitrario y el temporizador puede
         reordenarlas solas entre dos tics. `created_at` y luego `id` lo fijan. */
      /* El filtro por médico es lo ÚNICO que separa las dos vistas en la
         consulta (`consultaProximas`). Sin él manda la RLS, que ya recorta a la
         clínica de quien mira; con él, el dashboard del médico sigue siendo su
         resumen.
         I3 (punto 8) · Con la agenda v2 encendida entran también las citas POR
         LIGAR y las «por asignar» de Google (`CON_PACIENTE_O_POR_LIGAR`); el
         interruptor se lee una vez por pestaña (`agendaV2DeClinica`). Apagada,
         la consulta es la de siempre, byte a byte. */
      const v2 = await agendaV2DeClinica(supabase, clinicaId)
      let { data, error: errConsulta } = await consultaProximas(supabase, { clinicaId, medicoId, v2 })
      if (v2 && errConsulta && sinColumna(errConsulta.code)) {
        ({ data, error: errConsulta } = await consultaProximas(supabase, { clinicaId, medicoId, v2: false }))
      }

      if (mia !== peticionRef.current) return
      if (errConsulta) throw errConsulta
      setCitas((data as Cita[] | null) ?? [])
    } catch {
      /* ⚠️ EL FALLO SE ENSEÑA, NO SE TRAGA. Antes este `catch` era silencioso y
         dejaba la sección vacía, indistinguible de «no tienes citas»: el médico
         leía que su tarde estaba libre cuando lo que había caído era la red. */
      if (mia !== peticionRef.current) return
      setError(true)
    } finally {
      if (mia === peticionRef.current) setCargando(false)
    }
  }, [clinicaId, medicoId])

  useEffect(() => { void cargar() }, [cargar])

  /* Al volver a la pestaña, refetch. Mismo patrón que `lib/auth-context.tsx:219`
     —`visibilityState === 'visible'`, listener en `document`, limpieza en el
     retorno—; y `cargar` va memoizada sobre los dos ids justamente para que
     este efecto no se remonte en cada render.
     ⚠️ CON TOPE DE 2 MINUTOS desde la última traída, el de la agenda: cambiar
     de pestaña diez veces en un minuto eran diez consultas iguales. Lo que
     vence entre medias lo retira el tic de abajo, sin red. */
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - ultimaTraidaRef.current < UMBRAL_REFETCH_FOCO_MS) return
      void cargar()
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [cargar])

  /* ⚠️ ESTE TEMPORIZADOR NO CONSULTA LA BASE, Y NO DEBE HACERLO. Sólo mueve el
     reloj; quién está en curso y quién ha vencido se derivan abajo de los datos
     que ya están en memoria. Ponerle un `cargar()` dentro serían 1.440
     peticiones por pestaña abierta y por día. El dato fresco lo trae el efecto
     de visibilidad de aquí arriba, que dispara cuando hay alguien mirando. */
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), TIC_MS)
    return () => clearInterval(t)
  }, [])

  /* Derivado del reloj, sin estado: una cita vence cuando pasa su `end_time`, y
     está en curso cuando el ahora cae dentro de su intervalo. Como mucho hay
     una en curso, y es siempre la primera de las vigentes. */
  const vigentes = citas.filter(c => new Date(c.end_time).getTime() > ahora)
  const visibles = vigentes.slice(0, FILAS_VISIBLES)
  const idEnCurso = visibles.find(c =>
    new Date(c.start_time).getTime() <= ahora && ahora < new Date(c.end_time).getTime()
  )?.id ?? null

  /* ⚠️ EL PIE SÓLO SE PINTA CUANDO DE VERDAD SABEMOS QUE NO HAY MÁS, y por eso
     la condición mira `citas` y no `visibles`. Si la consulta devolvió el
     colchón completo, hay más citas detrás aunque el vencimiento haya dejado
     menos de cuatro a la vista: decir ahí «no hay más» sería mentir con un
     enlace al lado que lo desmiente. Sólo cuando volvieron MENOS de las que se
     pidieron hemos visto el final de la lista. */
  const listaCompleta = citas.length < LIMITE_CONSULTA
  const mostrarPie = listaCompleta && visibles.length > 0 && visibles.length < FILAS_VISIBLES

  const recargar = (): void => { setCargando(true); void cargar() }
  const quitar = (id: string): void => { setCitas(cs => cs.filter(c => c.id !== id)); void cargar() }
  const pie = mostrarPie && (
    /* Pie informativo, NO un estado vacío: el vacío es el bloque centrado y sólo
       sale cuando no hay ninguna cita. Es una nota al pie de una lista con
       contenido, para que el hueco de las filas que faltan se lea como «no hay
       más» y no como «se cortó la carga». */
    <p className="flex flex-wrap items-center justify-center gap-x-1.5 border-t border-linea pt-3 text-[13px] text-tinta2 first:border-t-0">
      No hay más citas próximas.
      <Link href="/agenda" prefetch={false} className="k-b k-b-texto text-[13px]">Ver agenda →</Link>
    </p>
  )

  if (medicoId === null) return (
    <div data-proximas-citas className="contents">
      <Chasis titulo="Próximas citas" className={claseLista}>
        {loadingProfile || cargando ? <FilasEsqueleto n={3} />
          : error || visibles.length === 0 ? <AvisoLista error={error} alReintentar={recargar} />
          : (
            <>
              <ul className="k-lista">
                {visibles.map(cita => (
                  <FilaCitaClinica key={cita.id} cita={cita} enCurso={cita.id === idEnCurso}
                    extra={esPorAsignar(cita) ? <BotonNoEsCita citaId={cita.id} alHecho={() => quitar(cita.id)} className="k-b k-b-texto text-[14px]" /> : undefined} />
                ))}
              </ul>
              {pie}
            </>
          )}
      </Chasis>
    </div>
  )

  return (
    <VistaMedico
      estado={loadingProfile || cargando ? 'cargando' : error ? 'error' : 'listo'}
      visibles={visibles} idEnCurso={idEnCurso} pie={pie} alReintentar={recargar} quitar={quitar}
      acciones={acciones} ligar={ligar} claseHero={claseHero} claseLista={claseLista}
    />
  )
}

interface PropsVistaMedico {
  estado: 'cargando' | 'error' | 'listo'
  visibles: Cita[]
  idEnCurso: string | null
  pie: ReactNode
  alReintentar: () => void
  quitar: (id: string) => void
  acciones?: AccionesCita
  ligar?: AccionLigar
  claseHero: string
  claseLista: string
}

/**
 * La vista del médico (rediseño B5, CALMA §24): la primera cita sube a la
 * pieza principal con su acción directa; el resto va en «Después», filas que se
 * tocan enteras y abren la hoja de acciones de la cita.
 */
function VistaMedico(p: PropsVistaMedico): ReactElement {
  const [hoja, setHoja] = useState<{ cita: Cita | null; abierta: boolean }>({ cita: null, abierta: false })
  const cerrar = (): void => setHoja(h => ({ ...h, abierta: false }))
  const accionesDe = (cita: Cita, enCurso: boolean, donde: Donde): ReactNode => cita.paciente_id
    ? p.acciones?.(cita, enCurso, donde)
    : <AccionesSinPaciente cita={cita} enCurso={enCurso} ligar={p.ligar} donde={donde}
        alQuitar={() => { cerrar(); p.quitar(cita.id) }} />

  if (p.estado === 'cargando') return (
    <div data-proximas-citas className="contents">
      <PrincipalCargando className={p.claseHero} />
      <Chasis titulo="Después" className={p.claseLista}><FilasEsqueleto n={3} /></Chasis>
    </div>
  )
  const [primera, ...resto] = p.visibles
  if (p.estado === 'error' || !primera) return (
    <div data-proximas-citas className="contents">
      <section aria-label="Lo que sigue" className={`${TARJETA} ${p.claseHero}`}>
        <AvisoLista error={p.estado === 'error'} alReintentar={p.alReintentar} />
      </section>
    </div>
  )
  const enCurso = primera.id === p.idEnCurso
  return (
    <div data-proximas-citas className="contents">
      <PiezaPrincipal cita={primera} enCurso={enCurso} acciones={accionesDe(primera, enCurso, 'principal')} className={p.claseHero} />
      {(resto.length > 0 || p.pie) && (
        <Chasis titulo="Después" className={p.claseLista}>
          {resto.length > 0 && (
            <ul className="k-lista">
              {resto.map(cita => <FilaCita key={cita.id} cita={cita} alAbrir={c => setHoja({ cita: c, abierta: true })} />)}
            </ul>
          )}
          {p.pie}
        </Chasis>
      )}
      <HojaCita cita={hoja.cita} abierta={hoja.abierta} alCerrar={cerrar}>
        {hoja.cita && accionesDe(hoja.cita, false, 'hoja')}
      </HojaCita>
    </div>
  )
}
