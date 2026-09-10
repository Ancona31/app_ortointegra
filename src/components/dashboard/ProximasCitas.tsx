'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { CalendarDays, RotateCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { partesCitaHora, fechaCitaCompacta } from '@/app/(app)/dashboard/utils'
import { StatusChip } from '@/app/(app)/dashboard/StatusChip'
import { PALETA_AVATAR, ARRANQUE_AVATAR } from './paletaAvatar'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'

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

type Cita = {
  id: string
  title: string
  start_time: string
  end_time: string
  created_at: string
  status: string
  paciente_id: string | null
  consultorio_id: string | null
  pacientes: { nombre: string; apellidos: string } | null
  /* Sólo llega cuando `medicoId` es null, o sea cuando la lista es de toda la
     clínica: ahí el nombre del paciente no dice de quién es la cita. */
  medico?: { id: string; titulo: string | null; nombres: string | null; apellido_paterno: string | null; apellido_materno: string | null } | null
}

/** El alto exacto del renglón, compartido con su esqueleto para que no salte. */
const ALTO_FILA = 'min-h-[57px]'

/* La geometría de las acciones del renglón, en un solo sitio.
   ⚠️ SE EXPORTA PORQUE LAS ACCIONES LAS PINTAN LOS LLAMADORES, y es lo que
   garantiza que las cuatro filas midan lo mismo — en las dos vistas y aunque
   una de ellas esté realzada. Si un llamador se inventa su propio alto, la
   uniformidad de la lista se rompe sin que nada avise.
   Las medidas son las de la adenda §2.1: alto 34, relleno lateral 11, texto
   12.5. */
export const GEOMETRIA_ACCION = {
  minHeight: '34px',
  height: '34px',
  padding: '0 11px',
  fontSize: 'var(--sp-fs-hint)',
  borderRadius: 'var(--sp-r-btn-sm)',
} as const

const ENTRADA_LEYENDA = 'flex items-center gap-[var(--sp-1-5)] text-[length:var(--sp-fs-legal)] text-[var(--sp-ink-350)]'
const PUNTO_LEYENDA = 'w-2 h-2 shrink-0 rounded-[var(--sp-r-pill)]'

/* ── Leyenda ───────────────────────────────────────────────────────────────
   LOS CINCO ESTADOS de `appointments_status_check`, no sólo los dos que esta
   lista puede enseñar hoy. Los rótulos son los que la app ya publica en
   `STATUS_CONFIG` (`agenda/page.tsx:243`) y se reutilizan tal cual: renombrar
   uno aquí sería la misma divergencia que se cerró al retirar `STATUS_STYLE`
   —la misma cita nombrada de dos formas en dos pantallas seguidas—.

   ⚠️ SIN `map` Y CON LOS NOMBRES DE TOKEN ESCRITOS ENTEROS, y ahora que son
   cinco la tentación es mayor. Es la garantía que explica `StatusChip.tsx:19`:
   un token interpolado que no exista no da error de compilación ni de runtime,
   deja el punto TRANSPARENTE y nadie se entera. Escritos enteros, un token
   fantasma se encuentra buscándolo en `globals.css`, y renombrar la familia
   rompe aquí de forma localizable. Las cinco familias `--ag-status-*-dot` viven
   en el `:root` de `globals.css` (líneas 351-373), no bajo `.agenda-fc`, así que
   resuelven en esta pantalla.

   ⚠️ ENVUELVE A PROPÓSITO. Las cinco entradas miden 444 px y la columna sólo
   tiene 640 en `xl`; por debajo baja a 384 y la leyenda pasa a dos líneas. Es
   contenido secundario: preferimos dos renglones a un recorte. */
function Leyenda() {
  return (
    /* ⚠️ FUERA POR DEBAJO DE `lg`. Las cinco entradas miden 444 px y la
       columna estrecha no llega: envolvían a dos líneas y ocupaban más alto del
       que aporta una leyenda. El chip de estado de cada renglón se queda, así
       que el color sigue teniendo dónde leerse; lo que se pierde es la clave, y
       en un teléfono eso cuesta menos que dos renglones de cromo. */
    <div className="hidden lg:flex flex-wrap items-center gap-x-[var(--sp-3-5)] gap-y-[var(--sp-1-5)] px-[var(--sp-pad-row-x)] pb-[var(--sp-3-5)]">
      <span className={ENTRADA_LEYENDA}>
        <span className={PUNTO_LEYENDA} style={{ background: 'var(--ag-status-scheduled-dot)' }} />
        Agendada
      </span>
      <span className={ENTRADA_LEYENDA}>
        <span className={PUNTO_LEYENDA} style={{ background: 'var(--ag-status-confirmed-dot)' }} />
        Confirmada
      </span>
      <span className={ENTRADA_LEYENDA}>
        <span className={PUNTO_LEYENDA} style={{ background: 'var(--ag-status-cancelled-dot)' }} />
        Cancelada
      </span>
      <span className={ENTRADA_LEYENDA}>
        <span className={PUNTO_LEYENDA} style={{ background: 'var(--ag-status-no_show-dot)' }} />
        No asistió
      </span>
      <span className={ENTRADA_LEYENDA}>
        <span className={PUNTO_LEYENDA} style={{ background: 'var(--ag-status-attended-dot)' }} />
        Atendida
      </span>
    </div>
  )
}

/** Los cuatro renglones en hueso. */
function FilasEsqueleto() {
  return (
    <div>
      {[1, 2, 3, 4].map(i => (
        <div key={i} className={`${ALTO_FILA} flex items-center gap-[var(--sp-2-5)] px-[var(--sp-pad-row-x)] py-[11px] border-t border-[color:var(--sp-line-card)]`}>
          <div className="skeleton h-8 w-[52px] xl:w-[60px] shrink-0 rounded-md" />
          <div className="skeleton w-[34px] h-[34px] shrink-0 rounded-full" />
          <div className="skeleton h-3 flex-1 min-w-0 rounded-md" />
          <div className="skeleton h-[34px] w-[100px] shrink-0 rounded-[var(--sp-r-btn-sm)]" />
        </div>
      ))}
    </div>
  )
}

function Chasis({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[color:var(--sp-line-card)] bg-[var(--sp-surface)] overflow-hidden">
      {/* ⚠️ LOS TRES EN UNA SOLA LÍNEA. El texto secundario iba debajo del título
          y apilaba tres bloques —título, subtítulo, leyenda— en una cabecera que
          el mockup resuelve en dos. Va a la derecha del título, y el enlace al
          extremo. `items-baseline` los asienta sobre la misma línea base pese a
          medir 18, 13.5 y 13.5 px; el `leading` explícito fija el alto de la
          fila en 24 px, que es lo que hace comparable el antes y el después.
          ⚠️ EN MÓVIL SON DOS, NO TRES: el de apoyo no cabe. Medido en la card
          real a 360 px —298 px de interior—, título y enlace ya piden 204-251
          según la fuente, así que al secundario le quedaban 47-94 px para 41
          caracteres y salía siempre cortado a la segunda palabra. Cortado no
          dice nada, así que en vez de encogerlo se retira; en `lg` sobra ancho
          y sigue entero. */}
      <div className="flex items-baseline gap-[var(--sp-2-5)] px-[var(--sp-pad-row-x)] pt-[var(--sp-4)] pb-[var(--sp-3-5)]">
        <h2 className="shrink-0 text-[length:var(--sp-fs-vitals)] leading-[24px] font-bold text-[var(--sp-ink-800)]">Próximas citas</h2>
        <p className="hidden flex-1 min-w-0 truncate text-[length:var(--sp-fs-meta)] leading-[24px] text-[var(--sp-ink-500)] lg:block">Las más cercanas. El resto, en la agenda.</p>
        <Link
          href="/agenda"
          /* Sin precarga: la regla de precarga de esta región deja encendida
             sólo la fila en curso. Ver el comentario del renglón. */
          prefetch={false}
          /* `ml-auto` es lo que manda el enlace al extremo cuando el secundario
             no está: sin él, con el `flex-1` fuera de juego, título y enlace se
             quedaban pegados a la izquierda. En `lg` vuelve a cero y el reparto
             lo hace otra vez el `flex-1` del secundario, como antes. */
          className="ml-auto shrink-0 whitespace-nowrap text-[length:var(--sp-fs-meta)] leading-[24px] font-semibold text-[var(--sp-primary-text)] hover:underline lg:ml-0"
        >
          Ver agenda →
        </Link>
      </div>
      {children}
    </section>
  )
}

/**
 * La card en su estado de carga, entera.
 *
 * La pintan los DOS momentos de espera de esta pantalla: esta misma región
 * mientras consulta, y `DashboardSkeleton` —que se monta antes de que exista el
 * perfil, cuando la región todavía no está montada—. Se exporta para que sea
 * una sola definición: si fueran dos, el paso de una espera a la otra daría un
 * salto en mitad de la carga.
 */
export function ProximasCitasCargando() {
  return <Chasis><FilasEsqueleto /></Chasis>
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
export default function ProximasCitas({ medicoId, acciones }: {
  /* `null` = todas las citas de la clínica (vista de la secretaria). Un id =
     sólo las de ese médico. Cuando es `null` la consulta trae además el médico
     de cada fila y el renglón lo pinta: sin filtro, el nombre del paciente no
     dice a quién pasa. Las dos cosas van juntas a propósito. */
  medicoId: string | null
  /* El grupo de acciones del renglón, que pinta el llamador.
     ⚠️ RECIBE `enCurso` PORQUE DE ÉL DEPENDEN DOS REGLAS DE ESTA REGIÓN, y las
     dos hay que respetarlas desde fuera:
       · el tratamiento PRIMARIO es sólo de la fila en curso; el resto va de
         contorno;
       · la PRECARGA también: `prefetch={enCurso ? undefined : false}`. Cuatro
         filas por dos enlaces serían ocho precargas donde antes había dos, y
         eso revierte entero el ahorro medido de `fcb2169`.
     Usa `GEOMETRIA_ACCION` para el tamaño; ver su nota. */
  acciones: (cita: Cita, enCurso: boolean) => React.ReactNode
}) {
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
  const conMedico = medicoId === null

  /* Gana la última petición LANZADA, no la última en responder. Mismo criterio
     que tenía el efecto en la página, con contador en vez de bandera porque
     aquí hay tres disparadores —montaje, volver a la pestaña y reintentar— y
     dos pueden solaparse. */
  const peticionRef = useRef(0)

  const cargar = useCallback(async () => {
    if (!clinicaId) return
    const mia = ++peticionRef.current
    setError(false)
    try {
      const supabase = createClient()
      /* SÓLO CITAS DE PACIENTE, NUNCA EVENTOS GENÉRICOS: la fila sin paciente
         es un evento (§12.14) y gastaría uno de los cuatro sitios. Se filtra en
         la consulta y no al pintar, que es donde de verdad recorta.

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
      let consulta = supabase
        .from('appointments')
        .select(conMedico
          ? 'id, title, start_time, end_time, created_at, status, paciente_id, consultorio_id, pacientes(nombre, apellidos), medico:profiles!appointments_medico_id_fkey(id, titulo, nombres, apellido_paterno, apellido_materno)'
          : 'id, title, start_time, end_time, created_at, status, paciente_id, consultorio_id, pacientes(nombre, apellidos)')
        .eq('clinica_id', clinicaId)
        .not('paciente_id', 'is', null)
        .gt('end_time', new Date().toISOString())
        .in('status', ['scheduled', 'confirmed'])
        .order('start_time', { ascending: true })
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(LIMITE_CONSULTA)
      /* El filtro por médico es lo ÚNICO que separa las dos vistas en la
         consulta. Sin él manda la RLS, que ya recorta a la clínica de quien
         mira; con él, el dashboard del médico sigue siendo su resumen. */
      if (medicoId !== null) consulta = consulta.eq('medico_id', medicoId)
      const { data, error: errConsulta } = await consulta

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
  }, [clinicaId, medicoId, conMedico])

  useEffect(() => { void cargar() }, [cargar])

  /* Al volver a la pestaña, refetch. Mismo patrón que `lib/auth-context.tsx:219`
     —`visibilityState === 'visible'`, listener en `document`, limpieza en el
     retorno—; y `cargar` va memoizada sobre los dos ids justamente para que
     este efecto no se remonte en cada render. */
  useEffect(() => {
    const alVolver = () => { if (document.visibilityState === 'visible') void cargar() }
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

  if (loadingProfile || cargando) return <ProximasCitasCargando />

  if (error) return (
    <Chasis>
      <div className="flex flex-col items-center gap-[var(--sp-3)] px-[var(--sp-pad-row-x)] py-[var(--sp-8)] border-t border-[color:var(--sp-line-card)]">
        <p className="text-[length:var(--sp-fs-body-sm)] text-[var(--sp-ink-500)] text-center">No se pudieron cargar las citas.</p>
        <button
          type="button"
          onClick={() => { setCargando(true); void cargar() }}
          className="inline-flex items-center gap-[var(--sp-2)] min-h-[var(--sp-tap)] px-5 rounded-[var(--sp-r-btn)] border border-[color:var(--sp-line-control)] bg-[var(--sp-surface)] text-[length:var(--sp-fs-btn-sm)] font-semibold text-[var(--sp-ink-700)] transition-colors hover:bg-[var(--sp-surface-muted)]"
        >
          <RotateCw size={16} /> Reintentar
        </button>
      </div>
    </Chasis>
  )

  /* Vacío: sin leyenda. Explicar dos colores que no hay debajo es ruido. */
  if (visibles.length === 0) return (
    <Chasis>
      <div className="flex flex-col items-center gap-[var(--sp-3)] px-[var(--sp-pad-row-x)] py-[var(--sp-8)] border-t border-[color:var(--sp-line-card)]">
        <CalendarDays size={22} className="text-[var(--sp-ink-150)]" />
        <p className="text-[length:var(--sp-fs-body-sm)] text-[var(--sp-ink-500)] text-center">No hay citas agendadas.</p>
        <Link href="/agenda" prefetch={false} className="text-[length:var(--sp-fs-meta)] font-semibold text-[var(--sp-primary-text)] hover:underline">
          Abrir agenda →
        </Link>
      </div>
    </Chasis>
  )

  return (
    <Chasis>
      <Leyenda />
      {visibles.map((cita, i) => {
        const enCurso = cita.id === idEnCurso
        /* ⚠️ DE AQUÍ SÓLO SE USA LA HORA, Y EL `dia` SE TIRA A PROPÓSITO. La
           primera línea de la columna la pone `fechaCitaCompacta`; ver por qué
           en el marcado, abajo. Y aun así la hora se sigue pidiendo AQUÍ y no
           en la otra: `partesCitaHora` es la única implementación del huso
           para la hora de una cita —lo dice su propia cabecera— y calcularla
           por segunda vez en la función compacta es exactamente cómo se
           volvería a perder la corrección de Sonora en uno de los dos sitios. */
        const { hora } = partesCitaHora(cita.start_time)
        const fecha = fechaCitaCompacta(cita.start_time)
        const nombre = cita.pacientes
          ? `${cita.pacientes.nombre} ${cita.pacientes.apellidos}`
          : cita.title
        /* ⚠️ LAS INICIALES CAEN SOBRE `nombre`, NUNCA A CADENA VACÍA. Sin este
           respaldo, una fila cuyo `join` de `pacientes` viniera vacío pintaba el
           círculo del avatar CON SU COLOR DE FONDO Y SIN NINGUNA LETRA: un punto
           de color sin rótulo, indistinguible de un defecto de la leyenda. El
           `join` puede venir vacío aunque `paciente_id` no sea nulo —lo dice la
           nota que la tarjeta vieja ya llevaba—, y en ese caso `nombre` cae al
           título de la fila, que es de donde sale aquí la letra. */
        const iniciales = (cita.pacientes
          ? `${cita.pacientes.nombre[0] ?? ''}${cita.pacientes.apellidos[0] ?? ''}`
          : nombre.trim()[0] ?? '?').toUpperCase()
        /* Por índice del renglón: las cuatro filas visibles salen de
           cuatro pares distintos. Ver la nota de `AtendidosRecientemente`. */
        const color = PALETA_AVATAR[(ARRANQUE_AVATAR.proximasCitas + i) % PALETA_AVATAR.length]

        /* ⚠️ LA PRECARGA SÓLO LA LLEVA LA FILA EN CURSO, Y COMO MUCHO HAY UNA.
           Cada `<Link>` con precarga cuesta 2 peticiones RSC y 2 lambdas por
           carga del dashboard, se pulse o no (medido en producción, 2026-09-07).
           Cuatro filas por dos enlaces serían OCHO precargas donde antes había
           dos, y eso devuelve entero el ahorro de `fcb2169`. Si ninguna cita
           está en curso no precarga ninguna: es el estado normal casi todo el
           día, y el destino se pide al pulsar con el esqueleto de
           `(app)/loading.tsx` de por medio. */

        return (
          <div
            key={cita.id}
            className={`${ALTO_FILA} flex items-center gap-[var(--sp-2-5)] px-[var(--sp-pad-row-x)] py-[11px] border-t border-[color:var(--sp-line-card)] transition-colors`}
            style={enCurso ? { background: 'var(--sp-primary-bg-soft)' } : undefined}
          >
            {/* Fecha y hora, dos líneas. La hora de la fila en curso va en
                acento; el chip conserva su color de estado y no compite. */}
            <div className="w-[52px] xl:w-[60px] shrink-0">
              {/* ⚠️ «HOY» O FECHA NUMÉRICA, EN LOS DOS ANCHOS. Aquí vivía el día
                  en palabra y NO CABÍA EN NINGUNO DE LOS DOS: la columna mide
                  52 px (60 en `xl`) y «MAÑANA» pide 49-58 según la fuente de
                  sistema, «MIÉ 3 SEP» 53-65. Se abreviaba —«MAÑA…»— en móvil y
                  también en `lg`. La numérica pide 43-54 y entra.
                  ⚠️ NO LO PARTAS OTRA VEZ POR ANCHO. Hubo una versión con dos
                  `<span>` y `lg:hidden`/`lg:inline` para conservar el rótulo
                  viejo en escritorio; se unificó a propósito, porque las dos
                  vistas tienen el mismo ancho de columna y el mismo problema, y
                  porque deben decir lo mismo.
                  ⚠️ EL ESPACIADO DE LETRA ES DE «HOY» Y NO DE LA FECHA. Ese
                  0.04em es la convención de los rótulos en mayúsculas, no de
                  las cifras, y además son los 3.5 px que meten la numérica
                  dentro (43-54 sin él, 46-57 con él). De ahí que el tratamiento
                  vaya por VARIANTE, y que `fechaCitaCompacta` devuelva
                  `numerica` en vez de dejar que esto lo deduzca comparando con
                  la cadena «Hoy». La numérica se lleva `tabular-nums`: iguala
                  el ancho de todas las fechas y las alinea con la hora de
                  abajo, que ya lo llevaba.
                  ⚠️ Y NO LLEVA RECORTE, QUE ES DELIBERADO. La elipsis era la
                  red del rótulo viejo, que era de largo desconocido; estos son
                  «HOY» u OCHO CARACTERES CLAVADOS. Con `truncate`, la fuente
                  más ancha del muestreo (DejaVu Sans, 53.9 de 52) cambiaba los
                  1.9 px que sobran por «20/09/2…», o sea perder el año. Sin él
                  sangra esos 2 px en el hueco de 10 que ya separa la columna
                  del avatar: invisible, y la caja no se mueve porque el
                  `w-[52px] shrink-0` no depende del contenido. El
                  `whitespace-nowrap` SÍ hace falta —sin él la fecha partiría
                  por las barras—. */}
              <p className={`whitespace-nowrap text-[length:var(--sp-fs-legal)] font-bold uppercase text-[var(--sp-ink-350)] ${fecha.numerica ? 'tabular-nums' : 'tracking-[0.04em]'}`}>
                {fecha.texto}
              </p>
              <p
                className="truncate text-[length:var(--sp-fs-meta)] font-extrabold tabular-nums"
                style={{ color: enCurso ? 'var(--sp-primary-text)' : 'var(--sp-ink-800)' }}
              >
                {hora}
              </p>
            </div>

            <div
              className="w-[34px] h-[34px] shrink-0 flex items-center justify-center rounded-[var(--sp-r-pill)] text-[length:var(--sp-fs-legal)] font-extrabold"
              style={{ background: color.bg, color: color.ink }}
            >
              {iniciales}
            </div>

            <div className="flex-1 min-w-0 xl:min-w-[150px]">
              <p className="truncate text-[length:var(--sp-fs-body-sm)] font-bold text-[var(--sp-ink-800)]">{nombre}</p>
              {/* Sólo en la vista sin filtro de médico. Trunca con elipsis, como
                  todo texto secundario de esta pantalla. */}
              {cita.medico && (
                <p className="truncate text-[length:var(--sp-fs-legal)] text-[var(--sp-ink-500)]">
                  {componerNombreMedicoCompleto(cita.medico)}
                </p>
              )}
              {/* Bajo `xl` el chip pasa aquí, debajo del nombre: en la columna
                  estrecha no cabe en el renglón sin partirlo en dos líneas. */}
              <div className="xl:hidden mt-0.5"><StatusChip status={cita.status} /></div>
            </div>

            <div className="hidden xl:flex shrink-0"><StatusChip status={cita.status} /></div>

            <div className="ml-auto flex items-center gap-[var(--sp-1-5)] shrink-0">
              {acciones(cita, enCurso)}
            </div>
          </div>
        )
      })}

      {/* Pie informativo, NO un estado vacío: el vacío es el bloque centrado de
          arriba y sólo sale cuando no hay ninguna cita. Esto es una nota al pie
          de una lista que sí tiene contenido, en tipografía secundaria, para
          que el hueco de las filas que faltan se lea como «no hay más» y no
          como «se cortó la carga». */}
      {mostrarPie && (
        <p className="flex flex-wrap items-center gap-x-[var(--sp-1-5)] px-[var(--sp-pad-row-x)] py-[var(--sp-2-5)] border-t border-[color:var(--sp-line-card)] text-[length:var(--sp-fs-hint)] text-[var(--sp-ink-500)]">
          No hay más citas próximas.
          <Link href="/agenda" prefetch={false} className="font-semibold text-[var(--sp-primary-text)] hover:underline">
            Ver agenda →
          </Link>
        </p>
      )}
    </Chasis>
  )
}
