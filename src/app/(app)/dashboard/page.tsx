'use client'

import { useState, useEffect } from 'react'
import { useProfile } from '@/hooks/useProfile'
import AsistenteDashboard from './AsistenteDashboard'
import { DashboardSkeleton } from '@/components/ui/Skeleton'
import { FileText, Stethoscope, Monitor, ArrowRight, Pill, ClipboardList, CalendarDays, FolderOpen, User, Menu, Plus } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'
import { useMenuMovil } from '@/contexts/MenuMovilContext'
/* El «+ Nueva consulta» de la cabecera. Vive en `components/launcher/` porque
   nació en `(launcher)/inicio`; aquí sólo se importa —esa página no se toca—.
   Es la ÚNICA pieza de la app que hace lo que pide la adenda §1: elegir
   paciente (o crearlo) y entrar a la nota SIN exigir cita previa. */
import ConsultaRapidaModal from '@/components/launcher/ConsultaRapidaModal'
import ProximasCitas from '@/components/dashboard/ProximasCitas'
import TarjetaHoy from '@/components/dashboard/TarjetaHoy'
import BuscadorPaciente, { ALTO_CONTROL } from '@/components/dashboard/BuscadorPaciente'

/* ─── Helpers ─────────────────────────────────────────────── */

function saludo() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

/* ─── Tipos ───────────────────────────────────────────────── */

type Reciente = {
  paciente_id: string
  nombre: string
  apellidos: string
  created_at: string
  motivo_consulta: string
}

/* ─── Config ──────────────────────────────────────────────── */

const ACCESOS: {
  href: string
  icon: React.ElementType
  label: string
  desc: string
  gradient: string
  ring: string
  /* ⚠️ APAGA LA PRECARGA DE ESTA TARJETA. Va en los datos y no en el JSX de
     abajo porque las cuatro tarjetas salen de UN SOLO `<Link>` dentro de un
     `map`: sin bandera no hay forma de distinguirlas ahí. Es la misma decisión
     —y el mismo nombre— que `sinPrefetch` en `NavLeaf` del menú lateral
     (`components/layout/Sidebar.tsx:78`), pero esta lista es suya y no tiene
     nada que ver con aquellos datos de navegación.
     Qué cuesta encenderla: LEE EL COMENTARIO DEL `prefetch={}` en el `map`. */
  sinPrefetch?: boolean
}[] = [
  {
    href: '/expediente',
    icon: Stethoscope,
    label: 'Expediente',
    desc: 'Historial clínico',
    gradient: 'from-violet-500 to-violet-600',
    ring: 'group-hover:ring-violet-200',
  },
  {
    href: '/agenda',
    icon: CalendarDays,
    label: 'Agenda',
    desc: 'Citas y horarios',
    gradient: 'from-blue-500 to-blue-600',
    ring: 'group-hover:ring-blue-200',
  },
  {
    href: '/documentos',
    icon: FileText,
    label: 'Documentos',
    desc: 'Recetas y solicitudes',
    gradient: 'from-amber-500 to-amber-600',
    ring: 'group-hover:ring-amber-200',
  },
  {
    href: '/dicom',
    icon: Monitor,
    label: 'DICOM',
    desc: 'Visor de imagen médica',
    gradient: 'from-teal-500 to-teal-600',
    ring: 'group-hover:ring-teal-200',
    /* La ÚNICA de las cuatro sin precarga: el visor DICOM casi no se abre, así
       que se pagaban dos peticiones RSC y dos arranques de lambda por carga
       para un destino que rara vez se pulsa. Las otras tres —Expediente,
       Agenda y Documentos— sí son destinos de la jornada y la conservan.
       La tarjeta sigue funcionando igual: al pulsarla se pide la ruta en ese
       momento y se ve el esqueleto de `(app)/loading.tsx`. */
    sinPrefetch: true,
  },
]

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-teal-100 text-teal-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-blue-100 text-blue-700',
]

/* ─── Componente ──────────────────────────────────────────── */

export default function DashboardPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const { consultorioActivo } = useConsultorioActivo()
  const { abrir: abrirMenu } = useMenuMovil()
  const [modalConsulta, setModalConsulta] = useState(false)
  const [recientes,      setRecientes]      = useState<Reciente[]>([])
  const [totalPacientes, setTotalPacientes] = useState<number | null>(null)


  useEffect(() => {
    if (loadingProfile || profile?.role === 'secretaria') return

    const supabase = createClient()

    /* ⚠️ LA MISMA GUARDA QUE `fetchCitas`, Y PUESTA DE ANTEMANO: HOY ESTE EFECTO
       CORRE UNA SOLA VEZ POR CARGA, ASÍ QUE NO PUEDE FALLAR TODAVÍA.
       Sus dependencias son `profile` y `loadingProfile`, que se asientan juntas
       y no vuelven a cambiar; con un solo disparo no hay dos peticiones que
       puedan cruzarse. Está aquí porque el día que alguien le dé un motivo para
       repetirse —un filtro, el selector de consultorio, un botón de recargar—
       vuelve exactamente la trampa que se cerró en el efecto de las citas: la
       respuesta TARDÍA pisa a la de la última petición pedida. Con esto, quien
       añada esa dependencia no tiene que acordarse de nada.
       Se lee igual que abajo a propósito: bandera apagada en la limpieza del
       efecto, comprobada antes de cada `setState`. No hay un segundo mecanismo
       ni una abstracción compartida — son dos usos, y duplicar sale más barato
       que abstraer. */
    let vigente = true

    // Total de expedientes — fetch remoto con fallback al mirror
    supabase
      .from('pacientes')
      .select('id', { count: 'exact', head: true })
      .neq('activo', false)
      .then(({ count }: { count: number | null }) => {
        // Petición vieja adelantada por otra más nueva: no escribe nada.
        if (!vigente) return
        setTotalPacientes(count ?? 0)
      })
      .catch(() => {
        // silent — el fallback al mirror abajo resuelve el contador
      })



    // Pacientes recientes — catch silencioso
    supabase
      .from('consultas')
      .select('paciente_id, created_at, motivo_consulta, pacientes!inner(nombre, apellidos, activo)')
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }: { data: { paciente_id: string; created_at: string; motivo_consulta: string | null; pacientes: { nombre: string; apellidos: string; activo?: boolean } | { nombre: string; apellidos: string; activo?: boolean }[] }[] | null }) => {
        // Petición vieja adelantada por otra más nueva: no escribe nada.
        if (!vigente) return
        if (!data) return
        const seen = new Set<string>()
        const unique: Reciente[] = []
        for (const c of data) {
          // Filtrar pacientes con soft delete
          const pac = (Array.isArray(c.pacientes) ? c.pacientes[0] : c.pacientes) as { nombre: string; apellidos: string; activo?: boolean } | null
          if (pac?.activo === false) continue

          if (!seen.has(c.paciente_id) && unique.length < 5) {
            seen.add(c.paciente_id)
            unique.push({
              paciente_id: c.paciente_id,
              nombre: pac?.nombre ?? '',
              apellidos: pac?.apellidos ?? '',
              created_at: c.created_at,
              motivo_consulta: c.motivo_consulta ?? '',
            })
          }
        }
        setRecientes(unique)
      })
      .catch(() => {
        // silent — si el fetch falla, recientes queda vacío y no se renderiza
      })

    return () => { vigente = false }
  }, [profile, loadingProfile])

  /* ⚠️ ESTA DECLARACIÓN VA ANTES DE LOS GUARDAS, y no es orden estético: el
     esqueleto de la línea de abajo la recibe como prop, y un `const` no se
     eleva. Bajarla otra vez rompe la carga con un error de zona muerta. */
  const abrirBusqueda = () =>
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))

  /* El esqueleto lleva búsqueda y hamburguesa VIVOS: ninguno de los dos depende
     del perfil, y son lo primero que se toca en esta pantalla. Los manejadores
     se le pasan en vez de que los fabrique, para que el Ctrl+K sintético siga
     definido en un solo sitio. El guarda de rol de la línea siguiente no se
     mueve: durante la carga el rol se desconoce, así que el esqueleto deja los
     tres botones en hueso y una secretaria no ve ni un fotograma de esta
     cabecera. */
  if (loadingProfile) return <DashboardSkeleton onBuscar={abrirBusqueda} onAbrirMenu={abrirMenu} />
  if (profile?.role === 'secretaria') return <AsistenteDashboard />

  const primerNombre = profile?.nombres ? profile.nombres.split(' ')[0] : ''
  /* Sin perfil —error de carga— el saludo cae a la fórmula neutra y el avatar
     al glifo genérico; la ceja de consultorio simplemente no se pinta. */
  const iniciales = `${profile?.nombres?.[0] ?? ''}${profile?.apellido_paterno?.[0] ?? ''}`.toUpperCase()

  return (
    <div className="max-w-[1044px] mx-auto pt-2 pb-6">

      {/* ── Región 1 · Cabecera de acción (adenda §1) ─────────── */}
      <div className="animate-slide-up pb-[var(--sp-5-5)] border-b border-[color:var(--sp-line-card)]" style={{ animationDelay: '0ms' }}>

        {/* ── Barra superior, SÓLO móvil ──────────────────────────
            ⚠️ `dash-barra-movil` NO PINTA NADA: es el asidero de dos reglas de
            `globals.css` —esconde el hamburguesa flotante del `Sidebar` para
            que no salgan dos, y recorta el `pt-16` que el layout reserva
            justamente para ese botón—. Mismo mecanismo, y mismo motivo, que
            `.ag-banda-movil` en la agenda. No la quites al reordenar clases.
            El hamburguesa de aquí y el flotante abren el MISMO menú
            (`MenuMovilContext`), así que esconder uno no deja a nadie sin
            acceso. */}
        <div className="dash-barra-movil lg:hidden flex items-center gap-[var(--sp-3)] mb-[var(--sp-gap-block)]">
          <button
            type="button"
            onClick={abrirMenu}
            aria-label="Abrir menú"
            className="w-11 h-11 shrink-0 flex items-center justify-center rounded-[var(--sp-r-icon-md)] bg-[var(--sp-surface-muted)] text-[var(--sp-ink-700)]"
          >
            <Menu size={20} />
          </button>
          <p className="flex-1 min-w-0 truncate text-[length:var(--sp-fs-vitals)] font-bold text-[var(--sp-ink-800)]">
            Dashboard
          </p>
          <div className="w-10 h-10 shrink-0 flex items-center justify-center rounded-[var(--sp-r-pill)] bg-[var(--sp-primary-bg)] text-[var(--sp-primary-ink)] text-[length:var(--sp-fs-label-sm)] font-extrabold">
            {iniciales || <User size={18} />}
          </div>
        </div>

        {/* ── Fila 1 · identidad ──────────────────────────────── */}
        {consultorioActivo && (
          <p className="sp-label truncate">{consultorioActivo.nombre_corto || consultorioActivo.nombre}</p>
        )}
        <h1 className="mt-[var(--sp-gap-title-sub)] text-[length:var(--sp-fs-page)] font-extrabold tracking-tight leading-tight text-[var(--sp-ink-900)]">
          {saludo()}{primerNombre ? `, ${primerNombre}` : ''}
        </h1>

        {/* ── Fila 2 · acción ─────────────────────────────────────
            ⚠️ UN SOLO JUEGO DE CONTROLES PARA LOS DOS TAMAÑOS, y es a
            propósito: duplicar el bloque para móvil pondría `data-onboard` en
            dos nodos y `OnboardingGuide` resuelve por `querySelector`, o sea
            por el PRIMERO que encuentre. El orden lo dan las utilidades
            `order-*`; el marcado es uno.
            En `lg` el grupo de tres botones es `shrink-0`, así que si no cabe
            baja de línea ENTERO y conserva su orden, en vez de descolgarse de
            uno en uno. */}
        <div className="mt-[var(--sp-gap-block)] flex flex-col gap-[var(--sp-gap-item)] lg:flex-row lg:flex-wrap lg:items-center">

          <BuscadorPaciente onAbrir={abrirBusqueda} />

          {/* Los tres botones. En móvil, retícula de dos columnas con el
              primario cruzándolas; en `lg`, fila que no encoge. */}
          <div className="order-2 grid grid-cols-2 gap-[var(--sp-gap-item)] lg:flex lg:shrink-0 lg:items-center">

            {/* + Nueva consulta — primario. `.sp-btn--primary` trae del sistema
                el fondo, la tinta y la sombra: aquí no hay ningún color. */}
            <button
              type="button"
              onClick={() => setModalConsulta(true)}
              className={`${ALTO_CONTROL} sp-btn sp-btn--primary col-span-2 order-1 whitespace-nowrap lg:order-3`}
            >
              <Plus size={17} /> Nueva consulta
            </button>

            {/* + Nuevo paciente — contorno de acento. No lleva `.sp-btn`
                porque ésa declara `border: none` y se comería el contorno. */}
            <Link
              href="/pacientes/nuevo"
              /* ⚠️ NO LO QUITES NI LO MUEVAS A OTRO NODO. `OnboardingGuide` lo
                 busca por `[data-onboard="nuevo-paciente"]` para señalar este
                 paso de la guía; sin él el paso queda mudo. */
              data-onboard="nuevo-paciente"
              /* Sin precarga, como el resto de enlaces nuevos de esta región:
                 2 peticiones RSC y 2 lambdas por carga del dashboard, se pulse
                 o no. El razonamiento largo está en la lista de recientes. */
              prefetch={false}
              className={`${ALTO_CONTROL} order-2 inline-flex items-center justify-center gap-[var(--sp-gap-item)] whitespace-nowrap rounded-[var(--sp-r-btn)] px-6 border border-[color:var(--sp-primary-border)] bg-[var(--sp-surface)] text-[length:var(--sp-fs-btn-sm)] font-semibold text-[var(--sp-primary)] transition-colors hover:bg-[var(--sp-primary-bg-faint)] lg:order-2`}
            >
              <Plus size={17} /> Nuevo paciente
            </Link>

            {/* Expedientes — contorno neutro, el visor global. */}
            <Link
              href="/expediente"
              /* Sin precarga, y con la misma salvedad que el «Ver todos →» de
                 la lista de recientes: apunta a `/expediente`, la MISMA url que
                 la tarjeta «Expediente» de `ACCESOS`, que sí conserva la suya.
                 Next deduplica por url, así que mientras esa tarjeta siga
                 encendida esto NO ahorra ninguna petición — se apaga porque la
                 región lo pide y para que el ahorro sea real el día que la
                 tarjeta se retire, no porque ahorre hoy. */
              prefetch={false}
              className={`${ALTO_CONTROL} sp-btn sp-btn--secondary order-3 whitespace-nowrap lg:order-1`}
            >
              <FolderOpen size={17} /> Expedientes
            </Link>

          </div>
        </div>
      </div>

      {/* Cuelga de «+ Nueva consulta» de la cabecera. Va fuera del bloque
          porque se pinta en `position: fixed` y devuelve `null` cerrado: no
          entra en el flujo de ninguna banda. */}
      <ConsultaRapidaModal open={modalConsulta} onClose={() => setModalConsulta(false)} />

      {/* ── Banda 1 · Próximas citas (flexible) · columna fija ── */}
      {/* ⚠️ `items-start`: LAS DOS COLUMNAS SE ALINEAN ARRIBA Y NINGUNA SE
          ESTIRA. Por defecto una retícula estira sus hijos al alto de la fila,
          así que con una sola cita la card de la izquierda crecía hasta igualar
          al calendario y dejaba un blanco grande DENTRO de una caja con borde.
          El sobrante tiene que ser aire de la retícula, no hueco enmarcado. */}
      <div className="grid grid-cols-1 items-start lg:grid-cols-[minmax(0,1fr)_300px] gap-[var(--sp-5)] mt-[var(--sp-gap-band)] animate-slide-up" style={{ animationDelay: '60ms' }}>

        {/* ── Región 2 · Próximas citas ─────────────────────── */}
        <ProximasCitas />

        {/* ── Región 3 · Calendario «Hoy es» ────────────────── */}
        <TarjetaHoy />

      </div>

      {/* Filete horizontal a TODO el ancho del área de contenido, no sólo
          a la columna izquierda (adenda §3). */}
      <div className="mt-[var(--sp-gap-band)] border-t border-[color:var(--sp-line-card)]" />

      {/* ── Banda 2 · Atendidos (flexible) · columna fija ──────── */}
      {/* ⚠️ EXACTAMENTE DOS HIJOS, y es criterio de aceptación de la adenda §3.
          Por eso el envoltorio de la columna flexible se pinta SIEMPRE y la
          condición de lista vive dentro: si el guarda envolviera al hijo, la
          retícula se quedaría con uno solo en cuenta nueva. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-[var(--sp-gap-band)] lg:gap-0 mt-[var(--sp-gap-band)]">
        {/* Columna flexible — contenido actual, sin rediseñar */}
        <div className="lg:pr-[var(--sp-pad-rule)]">
          {recientes.length > 0 && (
            <div className="animate-slide-up" style={{ animationDelay: '180ms' }}>
              <div className="flex h-8 items-center justify-between mb-[var(--sp-gap-tiles)]">
                <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">Consultas recientes</p>
                {/* CON precarga, y NO es un olvido de la poda de esta pantalla:
                    apunta a `/expediente`, la MISMA url que la tarjeta
                    «Expediente» de ACCESOS, que conserva la suya a propósito. Next
                    deduplica por url, así que apagar ésta no quitaría ni una
                    petición — sólo dejaría el enlace peor que su vecino. Se apaga
                    con aquélla o no se apaga. */}
                <Link href="/expediente" className="text-[11px] text-[#1e5fa8] hover:underline">
                  Ver todos →
                </Link>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {recientes.map((p, i) => {
                  const initials = `${p.nombre[0] ?? ''}${p.apellidos[0] ?? ''}`.toUpperCase()
                  return (
                    <div
                      key={p.paciente_id}
                      className={`flex items-center gap-3 px-4 py-3 group hover:bg-blue-50/50 transition-colors ${i < recientes.length - 1 ? 'border-b border-slate-50' : ''}`}
                    >
                      {/* ⚠️ LOS CUATRO `<Link>` DE ESTA FILA VAN SIN PRECARGA, Y SON
                          CUATRO AUNQUE PAREZCAN TRES: éste y el de la flecha del
                          final apuntan a la MISMA url, así que apagar uno y dejar
                          el otro no ahorra nada — Next precargaría igual.

                          EL PRECIO, MEDIDO EN PRODUCCIÓN (2026-09-07): cada `<Link>`
                          con precarga cuesta 2 peticiones RSC y 2 invocaciones de
                          lambda en Vercel POR CARGA DEL DASHBOARD, se pulse o no.
                          Esta lista pinta hasta 5 pacientes, o sea hasta 15 enlaces
                          distintos; en la traza medida esta fila sola ya ponía 7 de
                          las 23 precargas de la página, y arrancan justo cuando el
                          dashboard todavía está pidiendo sus propios datos.
                          Se pulsa como mucho uno.

                          EL AHORRO REAL ES MENOR QUE ESA CUENTA, y queda dicho para
                          que nadie lo apunte más alto: la tarjeta de próxima cita
                          tiene su propio «Ver expediente» a `/expediente/{id}` CON
                          precarga, y Next deduplica por url. Si el paciente de la
                          cita sale además en esta lista —que es el caso frecuente,
                          porque acaba de ser atendido—, sus DOS enlaces de
                          expediente de aquí no ahorran nada: la precarga la pide
                          igual la tarjeta, y de su fila sólo se ahorran «Receta» y
                          «Nota». Es exactamente el razonamiento que el `<Link>` de
                          la flecha aplica DENTRO de la fila, aplicado ahora ENTRE
                          tarjetas. Para los demás pacientes de la lista el ahorro
                          sí es entero.

                          LO QUE NO CAMBIA: los enlaces navegan exactamente igual.
                          Lo único que se pierde es la transición instantánea; al
                          pulsar se ve el esqueleto de `(app)/loading.tsx`, que
                          existe y está cuidado.

                          Si vuelves a encenderlos, multiplica por el número de
                          pacientes que pinta la lista antes de decidir. */}
                      <Link
                        href={`/expediente/${p.paciente_id}`}
                        prefetch={false}
                        className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity"
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#1d1d1f] truncate">
                            {p.nombre} {p.apellidos}
                          </p>
                          <p className="text-[11px] text-[#86868b] truncate">
                            Última atención: {formatDistanceToNow(parseISO(p.created_at), { locale: es, addSuffix: true })}
                            {p.motivo_consulta && ` · ${p.motivo_consulta}`}
                          </p>
                        </div>
                      </Link>

                      <div className="flex items-center gap-1 flex-shrink-0 flex items-center gap-1">
                        <Link
                          href={`/expediente/${p.paciente_id}/documentos?tipo=receta`}
                          /* Sin precarga: 2 peticiones RSC + 2 lambdas por carga y
                             por paciente pintado. Ver la nota larga del primer
                             `<Link>` de la fila. */
                          prefetch={false}
                          title="Receta express"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 transition-colors"
                        >
                          <Pill size={12} />
                          Receta
                        </Link>
                        <Link
                          href={`/expediente/${p.paciente_id}?tab=consultas`}
                          /* Sin precarga: 2 peticiones RSC + 2 lambdas por carga y
                             por paciente pintado. Ver la nota larga del primer
                             `<Link>` de la fila. */
                          prefetch={false}
                          title="Última nota"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-teal-600 bg-teal-50 hover:bg-teal-100 transition-colors"
                        >
                          <ClipboardList size={12} />
                          Nota
                        </Link>
                        <Link
                          href={`/expediente/${p.paciente_id}`}
                          /* Sin precarga, y es OBLIGATORIO que vaya junto con el
                             primer `<Link>` de la fila: los dos apuntan a la misma
                             url, así que dejar éste encendido reactivaría esa
                             precarga entera y el otro `prefetch={false}` no valdría
                             nada. Se apagan los dos o ninguno. */
                          prefetch={false}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors"
                        >
                          <ArrowRight size={13} />
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Columna fija. Aquí va Documentos (bloque 5); hasta entonces la
            ocupan los Módulos, tal cual están hoy. El filete vertical de la
            adenda §4 es el borde izquierdo de ESTE hijo, 24px a cada lado. */}
        <div className="lg:border-l lg:border-[color:var(--sp-line-card)] lg:pl-[var(--sp-pad-rule)]">
          <div className="animate-slide-up" style={{ animationDelay: '120ms' }}>
            <p className="flex h-8 items-center text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-[var(--sp-gap-tiles)]">Módulos</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-[var(--sp-gap-tiles)]">
              {ACCESOS.map(({ href, icon: Icon, label, desc, gradient, ring, sinPrefetch }) => (
                <Link
                  key={href}
                  href={href}
                  /* ⚠️ CADA `<Link>` CON PRECARGA CUESTA 2 PETICIONES RSC Y 2
                     INVOCACIONES DE LAMBDA POR CARGA DEL DASHBOARD, SE PULSE O NO.
                     Medido en producción (2026-09-07): las rutas de `(app)` son
                     dinámicas, así que la caché de segmentos pide el árbol y luego
                     el segmento, a la misma URL con distinto `?_rsc=`.
                     `undefined` NO es lo mismo que `true`: deja el valor por
                     defecto de Next (`auto`), que es lo que tenían las cuatro antes
                     de esto. Sólo se apaga la que lleva la bandera. */
                  prefetch={sinPrefetch ? false : undefined}
                  className={`group bg-white rounded-2xl border border-slate-100 p-5 shadow-sm
                    hover:shadow-[0_4px_20px_rgba(30,95,168,0.15)] hover:border-[#1e5fa8]/20 hover:-translate-y-1
                    active:scale-[0.97]
                    transition-all duration-200
                    ring-2 ring-transparent ${ring}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-200`}>
                      <Icon size={17} className="text-white" />
                    </div>
                    {href === '/expediente' && totalPacientes !== null && (
                      <span className="text-[11px] font-bold tabular-nums text-[#1e5fa8] bg-blue-50 px-2 py-0.5 rounded-full">
                        {totalPacientes}
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-sm text-[#1d1d1f]">{label}</p>
                  <p className="text-[11px] text-[#86868b] mt-0.5 leading-tight">{desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
