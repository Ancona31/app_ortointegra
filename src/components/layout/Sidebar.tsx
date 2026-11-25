'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home, Users, CalendarDays, FileText, BarChart2, UserCircle, HelpCircle,
  ChevronRight, X, LogOut, Moon, Sun, Settings, ExternalLink, ShieldCheck, Loader2,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import { useState, useEffect, useRef, useCallback, useSyncExternalStore, type MouseEvent, type PointerEvent } from 'react'
import useSWR, { mutate } from 'swr'
import AvisoPerfilSidebar from '@/components/sidebar/AvisoPerfilSidebar'
import { CLAVE_ESTADO_PERFIL } from '@/lib/perfil/claves'
import { useMenuMovil } from '@/contexts/MenuMovilContext'
import { useProfile, clearProfileCache, type Role } from '@/hooks/useProfile'
import { vaciarCacheGoogle } from '@/lib/agenda/cacheEventosGoogle'
import { vaciarCacheCitas } from '@/lib/agenda/cacheRangosCitas'
import { olvidarSemillas } from '@/lib/agenda/semillaCitas'
import ConsultorioActivoSelector from '@/components/sidebar/ConsultorioActivoSelector'
import ConsultaRapidaModal from '@/components/launcher/ConsultaRapidaModal'
import RielNavegacion, { type EntradaNav, type AccionRiel } from '@/components/layout/RielNavegacion'
import EncabezadoFundido from '@/components/layout/EncabezadoFundido'
import MenuMas from '@/components/layout/MenuMas'
import { canManageClinica } from '@/lib/permissions'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import { useClinica } from '@/hooks/useClinica'
import { CLAVE_CONFIG } from '@/lib/configApp'
import { useTheme } from '@/components/layout/ThemeProvider'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/ui/Toast'
import { useSubscriptionGate } from '@/components/billing/SubscriptionGateProvider'
import { leerFormato } from '@/lib/formatoPantalla'

/* ═══ LA NAVEGACIÓN DE `(app)` — B4 del rediseño estético ════════════════════
 *
 * Este componente CONSERVA los datos y la lógica de siempre —perfil, permisos
 * por rol, bloqueo por plan, cierre de sesión con su auditoría y la limpieza de
 * cachés— y pinta CUATRO presentaciones a la vez; CSS enseña la del formato
 * (`data-formato` en <html>, PLAN §2.5; reglas en `globals.css`, zona «B4»):
 *   · `ext`  (Duo cerrado): `RielNavegacion`, pegado a la franja;
 *   · `tel`  (teléfono):    `EncabezadoFundido` con el título de la sección;
 *   · `iv`   (Duo vertical): `EncabezadoFundido` con cinco píldoras;
 *   · `ih`   (Duo horizontal): esta `<aside>` como barra a la DERECHA (216);
 *   · `esc`  (computadora):  esta `<aside>` como barra a la izquierda (248).
 * En `tel`, `iv` y `ext` la misma `<aside>` es el CAJÓN que abre «Abrir menú».
 * «Más» (`ext`, `iv`) es `MenuMas`.
 *
 * ⚠️ NINGUNA PRESENTACIÓN SE ELIGE EN JS EN EL PRIMER RENDER: el formato no
 * existe en el servidor y la hidratación fallaría. Se pintan todas y CSS
 * esconde con `display: none` las que no tocan, que así salen también del
 * árbol de accesibilidad (y de los `getByRole` de las e2e).
 *
 * ⚠️ LA NAVEGACIÓN ES PLANA (aprobada): Inicio · Expediente · Agenda ·
 * Documentos · Administración. Lo que colgaba de los grupos quedó así:
 *   · Suplementación → enlace en la cabecera de `/expediente`;
 *   · los ocho documentos → «Documentos» (`/documentos`: paciente y rejilla de
 *     tipos) y «Nuevo documento» dentro de cada expediente;
 *   · Estadísticas / Usuarios / Facturación → pestañas de Administración
 *     (`components/admin/PestanasAdministracion.tsx`);
 *   · «Nuevo paciente» de la secretaria → su dashboard y `/expediente`, que ya
 *     interceptan el bloqueo por plan;
 *   · Calculadoras → sólo por URL hasta que se retiren (CALMA §31.2).
 */

/* ─── Las secciones ───────────────────────────────────────── */

type ClaveSeccion = 'inicio' | 'expediente' | 'agenda' | 'documentos' | 'admin' | 'perfil' | 'ayuda'

/** Qué sección es la ruta. `/expediente/[id]/documentos` es Expediente: el paciente manda. */
function seccionDeRuta(pathname: string): ClaveSeccion | null {
  const bajo = (base: string) => pathname === base || pathname.startsWith(base + '/')
  if (bajo('/dashboard')) return 'inicio'
  if (bajo('/expediente') || bajo('/suplementacion') || bajo('/pacientes')) return 'expediente'
  if (bajo('/agenda')) return 'agenda'
  if (bajo('/documentos')) return 'documentos'
  if (bajo('/estadisticas') || bajo('/admin') || bajo('/billing')) return 'admin'
  if (bajo('/perfil')) return 'perfil'
  if (bajo('/ayuda')) return 'ayuda'
  return null
}

/** El título del encabezado de `tel` (CALMA §20: la sección se llama «Expediente» en todas partes). */
const TITULOS: Record<ClaveSeccion, string> = {
  inicio: 'Inicio', expediente: 'Expediente', agenda: 'Agenda', documentos: 'Documentos',
  admin: 'Administración', perfil: 'Mi perfil', ayuda: 'Ayuda',
}

/**
 * Las entradas de la navegación, por rol.
 *
 * ⚠️ `sinPrefetch` ES UNA DECISIÓN DE PRODUCTO, Y VIVE AQUÍ Y NO EN EL JSX:
 * «¿esto lo va a pulsar de verdad quien está trabajando?». Los `<Link>` de la
 * barra están en el viewport desde el primer render en escritorio, así que se
 * precargan todos a la vez, en competencia con la página; y en Next 16 un
 * prefetch son de dos a cinco peticiones RSC. `/dashboard` y `/agenda` se
 * pulsan cada pocos minutos y conservan la precarga; el resto no. Expediente
 * tampoco: antes vivía dentro del grupo «Pacientes» y sólo se precargaba con el
 * grupo abierto, así que encenderla aquí sumaría peticiones a cada carga.
 *
 * ⚠️ «Documentos» ES DE PAGO ENTERO: con la suscripción bloqueada no navega y
 * abre el modal de bloqueo, como hacían los ocho formatos del grupo viejo.
 */
function entradasNav(secretaria: boolean, activa: ClaveSeccion | null, bloquear: ((e: MouseEvent<HTMLAnchorElement>) => void) | undefined): EntradaNav[] {
  const e = (clave: ClaveSeccion, etiqueta: string, href: string, Icono: EntradaNav['Icono'], extra: Partial<EntradaNav> = {}): EntradaNav =>
    ({ clave, etiqueta, href, Icono, activa: activa === clave, ...extra })
  const comunes = [
    e('inicio', 'Inicio', '/dashboard', Home),
    e('expediente', 'Expediente', '/expediente', Users, { sinPrefetch: true }),
    e('agenda', 'Agenda', '/agenda', CalendarDays),
  ]
  if (secretaria) return comunes
  return [
    ...comunes,
    e('documentos', 'Documentos', '/documentos', FileText, { sinPrefetch: true, alPulsar: bloquear }),
    e('admin', 'Administración', '/estadisticas', BarChart2, { sinPrefetch: true }),
  ]
}

/* ─── Datos ───────────────────────────────────────────────── */

/** Lo que este componente lee de `/api/me/estado-perfil`, y nada más. */
interface RespuestaEstadoPerfil {
  /* `gate` SE FUE DE AQUÍ en B5-bis y no es un olvido: este componente ya no
     lo lee. Decidía el aviso de perfil por `gate.exento === null`, y ese campo
     dejó de responder a la pregunta cuando la secretaria salió de la exención.
     Ahora decide el rol, que es lo que el aviso significaba desde el principio.
     El endpoint lo sigue devolviendo para `GateOnboarding`; declararlo aquí sin
     leerlo contradiría el rótulo de esta interfaz. */
  role: string
  /** Compuesto en servidor. Ver el porqué en `api/me/estado-perfil`. */
  nombre: string
  es_admin_de_clinica: boolean
  tieneFirma: boolean
  tieneLogo: boolean
  faltaCedulaEspecialidad: boolean
  /** El chip del plan, traído del lanzador (`/inicio`). */
  plan?: string
  planNombre?: string
}

/** Cuántos datos de perfil faltan. Sólo el médico: firma, cédula y logo son de quien ejerce. */
function contarPendientes(p: RespuestaEstadoPerfil | undefined): number {
  if (p?.role !== 'medico') return 0
  return [!p.tieneFirma, p.faltaCedulaEspecialidad, !p.tieneLogo].filter(Boolean).length
}

/* ═══ F1.2 · LA BARRA PLEGADA, SÓLO EN LA AGENDA ════════════════════════════
   Preferencia de interfaz por navegador (`localStorage`, sin datos de nadie,
   decisión 11). Se lee con `useSyncExternalStore` y no en un efecto: el servidor
   pinta siempre desplegada (`false`) y el cliente pasa a lo guardado sin
   desajuste de hidratación. El evento propio avisa a esta misma pestaña; el de
   `storage`, a las otras. Sólo cambia algo en `esc` (lo pone la hoja). */
const CLAVE_PLEGADA = 'spinus.barra.plegada'
const EVENTO_PLEGADA = 'spinus:barra-plegada'
function leerPlegada(): boolean {
  try { return localStorage.getItem(CLAVE_PLEGADA) === 'si' } catch { return false }
}
function suscribirPlegada(aviso: () => void): () => void {
  window.addEventListener('storage', aviso)
  window.addEventListener(EVENTO_PLEGADA, aviso)
  return () => { window.removeEventListener('storage', aviso); window.removeEventListener(EVENTO_PLEGADA, aviso) }
}
function guardarPlegada(plegada: boolean): void {
  try { localStorage.setItem(CLAVE_PLEGADA, plegada ? 'si' : 'no') } catch { /* modo privado: sólo esta vista */ }
  window.dispatchEvent(new Event(EVENTO_PLEGADA))
}

/* ─── El cajón: Esc y arrastre para cerrar ────────────────── */

/** ¿La `<aside>` es ahora el cajón? (en `esc` e `ih` es la barra fija). Se lee tras montar. */
function esCajon(): boolean {
  const f = leerFormato()
  return f === 'tel' || f === 'iv' || f === 'ext'
}

/**
 * Arrastrar el cajón hacia su borde lo cierra (CALMA §28, «con arrastre»).
 * Sigue al dedo 1:1 escribiendo el `transform` en el nodo, sin renders; al
 * soltar decide por distancia o por velocidad (proyección de inercia) y deja
 * que la transición de CSS termine el camino desde donde está. Hacia dentro
 * cede poco (rubber-band). Sólo táctil: con ratón se cierra con el velo o Esc.
 */
function useArrastreCajon(cerrar: () => void) {
  const inicio = useRef<{ x: number; y: number; t: number; activo: boolean } | null>(null)
  const soltar = (e: PointerEvent<HTMLElement>) => {
    const i = inicio.current
    inicio.current = null
    if (!i?.activo) return
    const el = e.currentTarget
    const dx = e.clientX - i.x
    const velocidad = dx / Math.max(1, e.timeStamp - i.t)
    el.style.transform = ''
    delete el.dataset.arrastre
    if (dx < -el.offsetWidth / 3 || velocidad < -0.5) cerrar()
  }
  const mover = (e: PointerEvent<HTMLElement>) => {
    const i = inicio.current
    if (!i) return
    const dx = e.clientX - i.x
    if (!i.activo) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(e.clientY - i.y)) return
      i.activo = true
      e.currentTarget.setPointerCapture(e.pointerId)
      e.currentTarget.dataset.arrastre = 'true'
    }
    const x = dx > 0 ? Math.sqrt(dx) * 2 : dx
    e.currentTarget.style.transform = `translateX(${x}px)`
  }
  const empezar = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse' || !esCajon()) return
    inicio.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, activo: false }
  }
  return { onPointerDown: empezar, onPointerMove: mover, onPointerUp: soltar, onPointerCancel: soltar }
}

/** Esc cierra el cajón, sólo cuando la `<aside>` ES el cajón y está abierta. */
function useEscCajon(abierto: boolean, cerrar: () => void) {
  useEffect(() => {
    if (!abierto) return
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape' && esCajon()) cerrar() }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [abierto, cerrar])
}

/* ─── Piezas de la barra ──────────────────────────────────── */

/** El glifo de Spinus (provisional, el de las maquetas) + el chip del plan, traído del lanzador. */
function CabeceraBarra({ plan, planNombre, medico, alCerrar }: { plan?: string; planNombre?: string; medico: boolean; alCerrar: () => void }) {
  return (
    <div className="nav-barra-cabeza">
      <span className="nav-marca">
        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9.5" /><path d="M12 5.5v13M9.6 8h4.8M9 11h6M9 14h6M9.6 17h4.8" />
        </svg>
        <span className="sb-etiqueta">Spinus</span>
      </span>
      {/* La campana de avisos de toda la app: `CampanaGlobal` (layout de (app)) pinta aquí su botón por
          portal. Sólo donde la `<aside>` es barra fija (`esc`, `ih`); en el cajón la esconde CSS. */}
      <span data-ranura-campana="barra" className="nav-ranura-campana" />
      {plan === 'free' && medico
        ? <Link href="/pricing" prefetch={false} className="nav-plan sb-etiqueta">Actualizar</Link>
        : planNombre && <span className="nav-plan sb-etiqueta">{planNombre}</span>}
      {/* Sólo en el cajón (`tel`, `iv`, `ext`); en la barra fija lo esconde CSS. */}
      <button type="button" onClick={alCerrar} aria-label="Cerrar menú" className="nav-solo-cajon nav-icono k-pulsable">
        <X size={20} aria-hidden="true" />
      </button>
    </div>
  )
}

function ListaNavegacion({ entradas, plegada, alNavegar }: { entradas: EntradaNav[]; plegada: boolean; alNavegar: () => void }) {
  return (
    <nav className="nav-barra-lista" aria-label="Navegación principal">
      {entradas.map(e => (
        /* ⚠️ `undefined` Y NO `true` EN LA RAMA QUE SÍ PRECARGA. El valor por
           defecto de `prefetch` es `auto`: una ruta estática se precarga entera
           y una dinámica sólo hasta su `loading.tsx`. `true` forzaría la ruta
           completa también en las dinámicas. Plegada, el rótulo se esconde y el
           nombre queda en `aria-label` y `title`. */
        <Link key={e.clave} href={e.href} prefetch={e.sinPrefetch ? false : undefined}
          onClick={ev => { alNavegar(); e.alPulsar?.(ev) }}
          aria-label={plegada ? e.etiqueta : undefined} title={plegada ? e.etiqueta : undefined}
          aria-current={e.activa ? 'page' : undefined} data-activa={e.activa ? 'true' : undefined}
          className="nav-barra-enlace k-pulsable">
          <e.Icono size={20} strokeWidth={1.8} aria-hidden="true" />
          <span className="sb-etiqueta">{e.etiqueta}</span>
        </Link>
      ))}
    </nav>
  )
}

interface Ajustes {
  dark: boolean
  alternarTema: () => void
  cerrarSesion: () => void
  cerrando: boolean
}

/**
 * Modo oscuro · Aviso de Privacidad · Cerrar sesión. Las mismas tres filas en el
 * menú de ajustes del pie de la barra y en «Más»: hoy son la ÚNICA vía a esas
 * tres funciones fuera de la barra, además del grupo «Ajustes» de Mi perfil.
 *
 * ⚠️ EL `prefetch={false}` DEL AVISO VA ATADO AL `target="_blank"`. Sin él este
 * enlace pedía `/privacidad` CINCO VECES en cada carga (es estática y se
 * precarga entera: árbol más segmentos, todos a la misma URL con distinto
 * `?_rsc=`), y con `target="_blank"` lo precargado no se consume nunca: la
 * pestaña nueva hace carga completa. Medido en local, 14 → 9 peticiones RSC.
 * ⚠️ `rel="noopener noreferrer"` ES OBLIGATORIO con `target="_blank"`: sin
 * `noopener` la pestaña abierta recibe `window.opener` sobre una pantalla de la
 * app con sesión abierta. Mismo criterio que el enlace gemelo de `/login`.
 *
 * ⚠️ «Cerrar sesión» NO PIDE CONFIRMACIÓN (CALMA §29.14). Mientras se registra
 * la auditoría y se revoca, la fila gira y no admite un segundo toque.
 */
function FilasAjustes({ a }: { a: Ajustes }) {
  return (
    <>
      <button type="button" onClick={a.alternarTema} className="nav-fila">
        {a.dark ? <Sun size={20} className="nav-fila-icono" aria-hidden="true" /> : <Moon size={20} className="nav-fila-icono" aria-hidden="true" />}
        <span className="flex-1">{a.dark ? 'Modo claro' : 'Modo oscuro'}</span>
      </button>
      <Link href="/privacidad" target="_blank" rel="noopener noreferrer" prefetch={false} className="nav-fila">
        <ShieldCheck size={20} className="nav-fila-icono" aria-hidden="true" />
        <span className="flex-1">Aviso de Privacidad</span>
        <ExternalLink size={16} className="nav-fila-flecha" aria-hidden="true" />
      </Link>
      <button type="button" onClick={a.cerrarSesion} disabled={a.cerrando} aria-busy={a.cerrando} className="nav-fila nav-fila--mal">
        {a.cerrando
          ? <Loader2 size={20} className="nav-fila-icono animate-spin" aria-hidden="true" />
          : <LogOut size={20} className="nav-fila-icono" aria-hidden="true" />}
        <span className="flex-1">Cerrar sesión</span>
      </button>
    </>
  )
}

/** El menú de ajustes del pie: nace de su botón, sin velo (CALMA §21). Esc y clic fuera lo cierran.
 *  ⚠️ A MANO Y NO CON `ui/CapaMenu.tsx`: el Aviso de Privacidad es un ENLACE a
 *  pestaña nueva (con su icono de salida) y «Cerrar sesión» se queda girando y
 *  sin segundo toque mientras se audita; CapaMenu cierra al elegir y sólo tiene
 *  opciones-botón. Ampliar su API queda fuera de la integración B1–B4. */
function MenuAjustes({ a, alCerrar, idMenu }: { a: Ajustes; alCerrar: () => void; idMenu: string }) {
  const caja = useRef<HTMLDivElement>(null)
  const cerrar = useRef(alCerrar)
  useEffect(() => { cerrar.current = alCerrar })
  useEffect(() => {
    const fuera = (e: globalThis.MouseEvent) => {
      const origen = document.querySelector(`[aria-controls="${idMenu}"]`)
      if (e.target instanceof Node && !caja.current?.contains(e.target) && !origen?.contains(e.target)) cerrar.current()
    }
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar.current() }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla) }
  }, [idMenu])
  return (
    <div ref={caja} id={idMenu} className="nav-ajustes">
      <p className="nav-capa-titulo">Ajustes</p>
      <FilasAjustes a={a} />
    </div>
  )
}

interface Persona { nombre: string; detalle: string; medico: boolean; perfilActivo: boolean; ayudaActiva: boolean }

/** El pie de la barra: la persona («Mi perfil · Ajustes» del médico, «Ajustes» de la secretaria) y Ayuda.
 *  El engrane del médico lleva al grupo «Ajustes» de Mi perfil (mismas tres
 *  filas, CALMA §23.11). La secretaria no tiene `/perfil`: conserva el menú. */
function PieBarra({ p, a, alNavegar }: { p: Persona; a: Ajustes; alNavegar: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const idMenu = 'nav-menu-ajustes'
  const boton = p.medico ? (
    <Link href="/perfil#perfil-sec-ajustes" prefetch={false} onClick={alNavegar} aria-label="Ajustes"
      className="nav-icono nav-icono--barra k-pulsable">
      <Settings size={20} aria-hidden="true" />
    </Link>
  ) : (
    <button type="button" onClick={() => setAbierto(v => !v)} aria-expanded={abierto} aria-controls={idMenu}
      aria-label="Ajustes" className="nav-persona k-pulsable">
      <PersonaTexto p={p} linea="Ajustes" icono={<Settings size={20} aria-hidden="true" />} />
    </button>
  )
  return (
    <div className="nav-pie">
      {abierto && <MenuAjustes a={a} alCerrar={() => setAbierto(false)} idMenu={idMenu} />}
      {p.medico && (
        <Link href="/perfil" prefetch={false} onClick={alNavegar} aria-current={p.perfilActivo ? 'page' : undefined}
          data-activa={p.perfilActivo ? 'true' : undefined} aria-label="Mi perfil" className="nav-persona k-pulsable">
          <PersonaTexto p={p} linea="Mi perfil · Ajustes" icono={<UserCircle size={20} aria-hidden="true" />} />
        </Link>
      )}
      {boton}
      {/* Ayuda: sólo el médico la tuvo nunca en el menú; la secretaria sigue sin ella. */}
      {p.medico && (
        <Link href="/ayuda" prefetch={false} onClick={alNavegar} aria-label="Ayuda" aria-current={p.ayudaActiva ? 'page' : undefined}
          data-activa={p.ayudaActiva ? 'true' : undefined} className="nav-icono nav-icono--barra k-pulsable">
          <HelpCircle size={20} aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}

function PersonaTexto({ p, linea, icono }: { p: Persona; linea: string; icono: React.ReactNode }) {
  return (
    <>
      <span className="flex-none">{icono}</span>
      <span className="nav-persona-texto sb-etiqueta">
        <span className="nav-persona-nombre">{p.nombre}</span>
        {p.detalle && <span className="nav-persona-detalle">{p.detalle}</span>}
        <span className="nav-persona-linea">{linea}</span>
      </span>
    </>
  )
}

/** Plegar / desplegar: sólo en la agenda y sólo en `esc` (en el cajón no se pinta: lo esconde CSS). */
function BotonPlegar({ plegada }: { plegada: boolean }) {
  return (
    <button type="button" onClick={() => guardarPlegada(!plegada)}
      aria-expanded={!plegada} aria-controls="barra-lateral"
      aria-label={plegada ? 'Desplegar menú' : 'Plegar menú'}
      className="nav-plegar k-pulsable">
      {plegada ? <PanelLeftOpen size={20} aria-hidden="true" /> : <PanelLeftClose size={20} aria-hidden="true" />}
      <span className="sb-etiqueta">{plegada ? 'Desplegar menú' : 'Plegar menú'}</span>
    </button>
  )
}

/* ─── Contenido de «Más» ──────────────────────────────────── */

interface ContenidoMasProps {
  medico: boolean
  pendientes: RespuestaEstadoPerfil | undefined
  logoUrl: string | null
  nombreClinica: string
  a: Ajustes
  alNavegar: () => void
}

/** Aviso · Consultorio activo · Administración · Mi perfil · Ayuda (médico), y los ajustes (todos). CALMA §28. */
function ContenidoMas({ medico, pendientes, logoUrl, nombreClinica, a, alNavegar }: ContenidoMasProps) {
  const fila = (href: string, etiqueta: string, Icono: EntradaNav['Icono']) => (
    <Link href={href} prefetch={false} onClick={alNavegar} className="nav-fila">
      <Icono size={20} className="nav-fila-icono" aria-hidden="true" />
      <span className="flex-1">{etiqueta}</span>
      <ChevronRight size={18} className="nav-fila-flecha" aria-hidden="true" />
    </Link>
  )
  return (
    <div className="nav-mas-cuerpo">
      {medico && pendientes?.role === 'medico' && (
        <AvisoPerfilSidebar faltaFirma={!pendientes.tieneFirma} faltaLogo={!pendientes.tieneLogo}
          faltaCedulaEspecialidad={pendientes.faltaCedulaEspecialidad} alNavegar={alNavegar} />
      )}
      {medico && (
        <div className="nav-grupo">
          <ConsultorioActivoSelector variante="fila" logoUrl={logoUrl} nombreClinica={nombreClinica} />
          {fila('/estadisticas', 'Administración', BarChart2)}
          {fila('/perfil', 'Mi perfil', UserCircle)}
          {fila('/ayuda', 'Ayuda', HelpCircle)}
        </div>
      )}
      <div className="nav-grupo"><FilasAjustes a={a} /></div>
    </div>
  )
}

/* ─── Componente ──────────────────────────────────────────── */

/** Todo lo que el componente sabe de quién mira, sacado del render para que quepa en 50 líneas. */
function useDatosNavegacion() {
  const pathname = usePathname()
  const { profile } = useProfile()
  const { nombreDisplay, subtitulo, logoUrl, clinica } = useClinica()
  /* Lo que le falta al médico después del gate (firma, cédula de especialidad,
     logo) y su plan. MISMA CLAVE que `GateOnboarding`, que ya la tiene montada
     en el layout de (app): SWR comparte la entrada de caché, así que esto NO
     añade ninguna petición. El `fetcher` va aquí porque el `SWRConfig` de (app)
     no define uno global. Sin respuesta —error, 401, carga— no se pinta aviso. */
  const { data: estadoPerfil } = useSWR<RespuestaEstadoPerfil>(
    CLAVE_ESTADO_PERFIL,
    (url: string) => fetch(url).then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status)))),
  )
  /* ⚠️ LA FUENTE ES `estadoPerfil` Y NO `profile`, Y NO ES INDIFERENTE.
     `useProfile` memoiza el perfil en una promesa a nivel de MÓDULO más una
     copia en `secureStorage`, y ninguna se invalida cuando el onboarding crea la
     clínica y el médico pasa a ser su dueño: al que entraba por Google le
     faltaba «Administración» con sus pestañas de Usuarios y Facturación toda la
     sesión. La clave de SWR se corrige sola en el `mutate()` de `onComplete`
     (`GateOnboarding.tsx`); revalidarla antes está PROHIBIDO (desmontaría el
     modal a media sesión). Las pantallas de detrás siguen comprobando
     `canManageClinica(profile)` y las salva el `clearProfileCache()` de
     `OnboardingModal.crearClinica`.
     ⚠️ `profile` SIGUE SIENDO EL SUPLENTE: sin respuesta, el menú del médico no
     se desmonta por estar sin cobertura. Lo mismo para el nombre: la asistente
     guardaba el suyo en el onboarding y aquí seguía el de antes. */
  const isAdmin = estadoPerfil
    ? canManageClinica({ role: estadoPerfil.role as Role, es_admin_de_clinica: estadoPerfil.es_admin_de_clinica })
    : canManageClinica(profile)
  /* Mientras el perfil no ha cargado se pinta el menú del médico, como siempre. */
  const secretaria = profile?.role === 'secretaria'
  const nombre = estadoPerfil?.nombre || componerNombreMedicoCompleto(profile ?? {}) || ''
  const iniciales = `${profile?.nombres?.[0] ?? ''}${profile?.apellido_paterno?.[0] ?? ''}`.toUpperCase()
  const nombreClinica = nombreDisplay ?? clinica?.nombre ?? ''
  const detalle = secretaria ? '' : (subtitulo ?? profile?.especialidad ?? '')
  return { pathname, estadoPerfil, isAdmin, secretaria, nombre, iniciales, nombreClinica, detalle, logoUrl }
}

/* ⚠ LA CACHÉ DE CONFIGURACIÓN SE VACÍA AL DESMONTARSE ESTE SIDEBAR, NO DENTRO
   DE `handleLogout`, Y NO ES UN CAPRICHO DE ESTILO.

   `CLAVE_CONFIG` no es solo la clave de `useClinica`: desde que los cuatro
   endpoints se consolidaron en /api/me/config es TAMBIÉN la de
   `useConsultorios`. Vaciarla dentro del handler la vaciaba mientras el árbol
   de (app) seguía montado —`router.push` no desmonta nada de forma síncrona—,
   y el gate de perfil (`GateOnboarding`) cuelga del layout de (app), o sea que
   estaba en pantalla justo en ese instante. `internalMutate` de SWR fija `data`
   y limpia `error`, pero NUNCA toca `isLoading`: el hook quedaba en
   `consultorios: []` con `isLoading: false` —un «no tienes ninguno» falso y
   estable— y el modal de configuración salía en CADA cierre de sesión.

   El desmontaje ES la señal de que la navegación ya sacó al usuario del árbol.
   El ref evita que un desmontaje ajeno al logout (StrictMode en desarrollo, por
   ejemplo) borre la caché de una sesión viva.
   Exportado para el grupo «Ajustes» de `/perfil` (CALMA §23.11): una sola
   lógica de cierre; quien la use se desmonta igual al llegar a `/login`. */
export function useCierreSesion() {
  const router = useRouter()
  const { signOut } = useAuth()
  const toast = useToast()
  const cerrandoSesionRef = useRef(false)
  const [cerrando, setCerrando] = useState(false)

  useEffect(() => {
    return () => {
      if (cerrandoSesionRef.current) {
        mutate(CLAVE_CONFIG, null, { revalidate: false })
      }
    }
  }, [])

  async function handleLogout() {
    if (cerrandoSesionRef.current) return
    setCerrando(true)
    /* NOM-024: registrar el logout antes de cerrar sesión, y CON await.
       ⚠️ EL `await` ES LA CORRECCIÓN, NO UN ADORNO. Esta ruta identifica al
       usuario por sus cookies sb-*, o sea por lo mismo que signOut() borra: sin
       esperar, las dos cosas competían y si el cierre ganaba la carrera el
       registro se perdía. Si el registro falla por su cuenta, el cierre sigue —
       quedarse dentro por no poder escribir en el log sería peor. */
    try {
      await fetch('/api/auth/audit-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      })
    } catch { /* silent */ }

    /* `signOut()` del AuthContext limpia SIEMPRE lo suyo —cookies sb-*,
       sessionStorage, meta— y lanza DESPUÉS si el servidor de Auth no confirmó
       la revocación (ver `lib/auth-context.tsx`). Cuando este `catch` corre, la
       sesión de ESTE navegador ya está destruida; lo que queda abierto es la de
       otros dispositivos.
       ⚠️ POR ESO LA LIMPIEZA DE ABAJO NO PUEDE VIVIR DENTRO DE LA RAMA FELIZ.
       Aquí estuvo el defecto: el `catch` hacía `return` y se saltaba
       `clearProfileCache()`, que borra `cache_user_profile` de secureStorage —el
       perfil del médico, CIFRADO PERO PERSISTIDO en esa máquina—. */
    let revocado = true
    try {
      await signOut()
    } catch {
      revocado = false
    }

    clearProfileCache()
    // Los eventos de Google y los rangos de citas que la agenda guardó en
    // memoria de la pestaña (A1.3 y A1.5a), y el registro de semillas ya
    // usadas (A1.4c): ése SÓLO se olvida aquí, ver `semillaCitas.ts`.
    vaciarCacheGoogle()
    vaciarCacheCitas()
    olvidarSemillas()
    // Marca para el cleanup de arriba; la caché del agregado se vacía cuando
    // este componente se desmonte, no ahora.
    cerrandoSesionRef.current = true

    /* ⚠️ EL AVISO NO DICE «inténtalo de nuevo», Y NO ES UN MATIZ DE REDACCIÓN.
       Un segundo clic encontraría este navegador ya sin `accessToken`, así que
       `_signOut` se saltaría la llamada al servidor y devolvería ÉXITO sin
       revocar nada. Lo que sí revoca de verdad en el servidor es el cambio de
       contraseña (`api/auth/reset-password/route.ts`).
       ⚠️ LIMITACIÓN CONOCIDA: el `ToastProvider` cuelga de `(app)/layout.tsx` y
       la navegación de abajo lo desmonta, así que este aviso puede verse sólo un
       instante. Sostenerlo exige pasarlo a `/login`, que es otro archivo. */
    if (!revocado) {
      toast.error('Sesión cerrada en este navegador, pero el servidor no confirmó la revocación: puede seguir abierta en otros dispositivos. Cambia la contraseña para cerrarlas todas.')
    }

    router.push('/login')
    router.refresh()
  }

  return { handleLogout, cerrando }
}

export default function Sidebar() {
  const d = useDatosNavegacion()
  const router = useRouter()
  /* ⚠️ EL ABIERTO/CERRADO DEL CAJÓN VIVE EN `MenuMovilContext` (bloque 6): lo
     abren también hermanos de este componente —la banda de la agenda—. */
  const { abierto: mobileOpen, abrir: abrirMenu, cerrar: cerrarMenu } = useMenuMovil()
  const { dark, toggle } = useTheme()
  const { state: subState, openBloqueoModal } = useSubscriptionGate()
  const { handleLogout, cerrando } = useCierreSesion()
  const [masAbierto, setMasAbierto] = useState(false)
  /* «+» del riel del médico: el mismo buscador que «Nueva consulta» del dashboard. */
  const [consultaAbierta, setConsultaAbierta] = useState(false)
  const enAgenda = d.pathname === '/agenda' || d.pathname.startsWith('/agenda/')
  const plegada = useSyncExternalStore(suscribirPlegada, leerPlegada, () => false) && enAgenda
  const cerrarMas = useCallback(() => setMasAbierto(false), [])
  const cerrarTodo = useCallback(() => { cerrarMenu(); setMasAbierto(false) }, [cerrarMenu])
  useEscCajon(mobileOpen, cerrarMenu)
  const arrastre = useArrastreCajon(cerrarMenu)

  const activa = seccionDeRuta(d.pathname)
  const bloquear = subState.isBlocked ? (e: MouseEvent<HTMLAnchorElement>) => { e.preventDefault(); cerrarTodo(); openBloqueoModal() } : undefined
  const entradas = entradasNav(d.secretaria, activa, bloquear)
  const deRiel = entradas.filter(e => e.clave !== 'admin')
  const enMas = !d.secretaria && (activa === 'admin' || activa === 'ayuda')
  const pendientes = contarPendientes(d.estadoPerfil)
  const ajustes: Ajustes = { dark, alternarTema: toggle, cerrarSesion: handleLogout, cerrando }
  const accion: AccionRiel = d.secretaria
    ? { etiqueta: 'Agendar cita', alPulsar: () => router.push('/agenda') }
    : { etiqueta: 'Nueva consulta', alPulsar: () => (subState.isBlocked ? openBloqueoModal() : setConsultaAbierta(true)) }
  const persona: Persona = { nombre: d.nombre, detalle: d.detalle, medico: !d.secretaria, perfilActivo: activa === 'perfil', ayudaActiva: activa === 'ayuda' }

  return (
    <>
      <EncabezadoFundido titulo={activa ? TITULOS[activa] : ''} entradas={deRiel} masActivo={enMas} masAbierto={masAbierto}
        pendientes={pendientes} alAbrirMas={() => setMasAbierto(true)} menuAbierto={mobileOpen} alAbrirMenu={abrirMenu}
        avatar={{ iniciales: d.iniciales, href: d.secretaria ? null : '/perfil', activo: activa === 'perfil' }} />
      <RielNavegacion entradas={deRiel} masActivo={enMas || (!d.secretaria && activa === 'perfil')} masAbierto={masAbierto}
        pendientes={pendientes} alAbrirMas={() => setMasAbierto(true)} accion={accion} />
      {/* El velo del cajón: sólo abierto, y sólo donde la `<aside>` es cajón (CSS). */}
      {mobileOpen && <div className="nav-cajon-velo" onClick={cerrarMenu} aria-hidden="true" />}
      <aside id="barra-lateral" data-plegada={plegada ? 'true' : 'false'} data-abierta={mobileOpen ? 'true' : 'false'}
        className="nav-barra" {...arrastre}>
        <CabeceraBarra plan={d.estadoPerfil?.plan} planNombre={d.estadoPerfil?.planNombre} medico={!d.secretaria} alCerrar={cerrarMenu} />
        <div className="sb-etiqueta"><ConsultorioActivoSelector variante="barra" logoUrl={d.logoUrl} nombreClinica={d.nombreClinica} /></div>
        {/* Secciones y aviso se desplazan juntos y el pie no: con 669 de alto
            (`ih`) el aviso desplegado no cabe, y el menú de ajustes del pie no
            puede vivir dentro de algo que recorta. */}
        <div className="nav-barra-medio">
          <ListaNavegacion entradas={entradas} plegada={plegada} alNavegar={cerrarMenu} />
          {/* El aviso de perfil, sólo médico: lo decide el ROL (B5-bis), no `gate.exento`. */}
          {d.estadoPerfil?.role === 'medico' && (
            <div className="sb-etiqueta nav-barra-aviso"><AvisoPerfilSidebar faltaFirma={!d.estadoPerfil.tieneFirma}
              faltaLogo={!d.estadoPerfil.tieneLogo} faltaCedulaEspecialidad={d.estadoPerfil.faltaCedulaEspecialidad} alNavegar={cerrarMenu} /></div>
          )}
        </div>
        {enAgenda && <BotonPlegar plegada={plegada} />}
        <PieBarra p={persona} a={ajustes} alNavegar={cerrarMenu} />
      </aside>
      <MenuMas abierto={masAbierto} alCerrar={cerrarMas} titulo="Más">
        <ContenidoMas medico={!d.secretaria} pendientes={d.estadoPerfil} logoUrl={d.logoUrl}
          nombreClinica={d.nombreClinica} a={ajustes} alNavegar={cerrarTodo} />
      </MenuMas>
      {/* Cerrado devuelve `null`: en las páginas donde nadie lo abre no cuesta un nodo. */}
      <ConsultaRapidaModal open={consultaAbierta} onClose={() => setConsultaAbierta(false)} />
    </>
  )
}
