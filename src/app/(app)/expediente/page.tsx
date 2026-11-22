'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, Stethoscope, ArrowUp, ArrowDown, SlidersHorizontal, SearchX,
  ArrowDownAZ, UserRound, Hash, Clock, CalendarDays,
} from 'lucide-react'
import Link from 'next/link'
import { calcularEdad } from '@/lib/patientUtils'
import { renderEnTZ, TZ_CLINICA } from '@/lib/dates'
import { KebabAccionesPaciente } from '@/components/expediente/KebabAccionesPaciente'
import { useSubscriptionGate } from '@/components/billing/SubscriptionGateProvider'
import { fetchPacientesExpediente, type PacienteExpediente, type OrdenColumna, type OrdenDireccion, type MedicoOpcion } from '@/lib/expediente/fetchPacientes'
import { ListaChipsMedicos } from '@/components/expediente/ChipMedico'
import { TablaPacientesExpediente } from '@/components/expediente/TablaPacientesExpediente'
import { SheetFiltrosExpediente } from '@/components/expediente/SheetFiltrosExpediente'
import CapaMenu, { type OpcionMenu } from '@/components/ui/CapaMenu'
import ModalShell from '@/components/ui/ModalShell'
import EstadoVacio from '@/components/ui/EstadoVacio'
import EstadoError from '@/components/ui/EstadoError'
import { Skeleton } from '@/components/ui/Skeleton'
import { useProfile } from '@/hooks/useProfile'
import { isMedicoInvitado } from '@/lib/permissions'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import { leerFormato } from '@/lib/formatoPantalla'

/* ═══ /expediente — rediseño B6 (maqueta `final-lista`; CALMA §15, §17, §23.5,
   §30.3) ═══════════════════════════════════════════════════════════════════
   Todo por formato con CSS (`ext:` … `esc:`), nada en el primer render:
     ext / tel      lista en una tarjeta; «+ Paciente» en `ext` (§17)
     ih / iv / esc  tabla (`TablaPacientesExpediente`)
   La barra es buscador + «Ordenado por» (menú del catálogo con los 6 criterios
   y la flecha de dirección aparte) + «Filtros». «Filtros» abre, según el
   formato que se LEE AL PULSAR, la hoja de `ext`/`tel` (borrador + «Ver
   resultados», como siempre) o la capa de `ih`/`iv`/`esc` (aplicación
   inmediata, como los filtros de escritorio de antes). Ninguna función cambia
   de lógica: sólo de sitio. */

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-blue-100 text-blue-700',
  'bg-teal-100 text-teal-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
]

const ETIQUETA_ORDEN: Record<OrdenColumna, string> = {
  apellidos: 'Apellido',
  nombre: 'Nombre',
  numero_expediente: 'Expediente',
  fecha_nacimiento: 'Edad',
  created_at: 'Fecha de ingreso',
  medico: 'Médico',
}

const ICONO_ORDEN: Record<OrdenColumna, React.ReactNode> = {
  apellidos: <ArrowDownAZ aria-hidden="true" />,
  nombre: <UserRound aria-hidden="true" />,
  numero_expediente: <Hash aria-hidden="true" />,
  fecha_nacimiento: <Clock aria-hidden="true" />,
  created_at: <CalendarDays aria-hidden="true" />,
  medico: <Stethoscope aria-hidden="true" />,
}

const COLUMNAS_ORDEN: OrdenColumna[] = ['apellidos', 'nombre', 'numero_expediente', 'fecha_nacimiento', 'created_at', 'medico']

function PacienteSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3">
      <Skeleton className="h-9 w-9 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
      <Skeleton className="h-3 w-16" />
    </div>
  )
}

function CabeceraLista({ total, mostrarSuplementacion, interceptIfBlocked }: {
  total: number | null
  mostrarSuplementacion: boolean
  interceptIfBlocked: (e: React.MouseEvent) => void
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="k-t-pantalla">Expediente</h1>
        {total !== null && (
          <p className="k-t-sec mt-0.5">
            {total} paciente{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''}
          </p>
        )}
        {/* B4 del rediseño: la entrada a Suplementación. Colgaba del grupo
            «Pacientes» de la barra lateral, que la navegación plana quitó
            (CALMA §28: «Suplementación sigue dentro de Expediente»). Sólo
            médicos, como en la barra de antes. Va bajo el título y no junto
            al botón: en `ext` (322 de ancho) empujaba el botón bajo el riel. */}
        {mostrarSuplementacion && (
          <Link href="/suplementacion" prefetch={false} className="k-b k-b-texto -ml-1 mt-1">
            Suplementación
          </Link>
        )}
      </div>
      {/* Único botón relleno de la pantalla. En `ext`, «+ Paciente» (CALMA
          §17); el nombre accesible es el rótulo completo de hoy. */}
      <Link
        href="/pacientes/nuevo"
        data-onboard="nuevo-paciente-exp"
        onClick={interceptIfBlocked}
        aria-label="Nuevo paciente"
        className="k-b k-b-prim mt-0.5"
      >
        <Plus size={16} strokeWidth={2.5} aria-hidden="true" className="hidden ext:block" />
        <span className="hidden ext:inline">Paciente</span>
        <span className="ext:hidden">Nuevo paciente</span>
      </Link>
    </div>
  )
}

interface BarraProps {
  busqueda: string
  onBusqueda: (v: string) => void
  orden: OrdenColumna
  direccion: OrdenDireccion
  onOrden: (col: OrdenColumna) => void
  onDireccion: () => void
  hayFiltrosActivos: boolean
  onFiltros: () => void
}

function BarraLista({ busqueda, onBusqueda, orden, direccion, onOrden, onDireccion, hayFiltrosActivos, onFiltros }: BarraProps) {
  return (
    <div className="flex flex-col gap-2 ih:flex-row iv:flex-row esc:flex-row ih:items-center iv:items-center esc:items-center ih:gap-4 iv:gap-4 esc:gap-4">
      <div className="relative min-w-0 flex-1 ih:max-w-[300px] iv:max-w-[300px] esc:max-w-[340px]">
        <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta2" />
        <input
          type="text"
          placeholder="Buscar por nombre o apellido..."
          aria-label="Buscar por nombre o apellido"
          value={busqueda}
          onChange={e => onBusqueda(e.target.value)}
          className="k-campo pl-10"
        />
      </div>
      <div className="flex min-w-0 items-center justify-between gap-3 ih:ml-auto iv:ml-auto esc:ml-auto ih:justify-end iv:justify-end esc:justify-end">
        <SelectorOrden orden={orden} direccion={direccion} onOrden={onOrden} onDireccion={onDireccion} />
        <button type="button" onClick={onFiltros} className="k-b k-b-texto ih:-order-1 iv:-order-1 esc:-order-1">
          <SlidersHorizontal size={16} aria-hidden="true" />
          Filtros
          {hayFiltrosActivos && (
            <>
              <span aria-hidden="true" className="absolute -right-1 top-1 h-2 w-2 rounded-full bg-accion ring-2 ring-fondo" />
              <span className="sr-only"> (activos)</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

/* «Ordenado por X» abre el menú de los 6 criterios (el select de escritorio de
   antes). La flecha, aparte, alterna la dirección (el botón ↑/↓ de antes).
   Elegir el criterio vigente no hace nada, como el select. */
function SelectorOrden({ orden, direccion, onOrden, onDireccion }: {
  orden: OrdenColumna
  direccion: OrdenDireccion
  onOrden: (col: OrdenColumna) => void
  onDireccion: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const ancla = useRef<HTMLButtonElement>(null)
  const opciones: OpcionMenu[] = COLUMNAS_ORDEN.map(col => ({
    id: col,
    texto: ETIQUETA_ORDEN[col],
    icono: ICONO_ORDEN[col],
    marcada: col === orden,
    alElegir: () => { if (col !== orden) onOrden(col) },
  }))
  const asc = direccion === 'asc'
  return (
    <div className="flex min-w-0 items-center text-[14px] leading-5">
      <span className="mr-1 whitespace-nowrap text-tinta2 ext:hidden ih:hidden iv:hidden">Ordenado por</span>
      <button
        ref={ancla}
        type="button"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={`Ordenar por: ${ETIQUETA_ORDEN[orden]}`}
        onClick={() => setAbierto(a => !a)}
        className="k-b k-b-texto min-w-0 text-[14px]"
      >
        <span className="truncate">{ETIQUETA_ORDEN[orden]}</span>
      </button>
      <button
        type="button"
        onClick={onDireccion}
        aria-label={asc ? 'Orden ascendente' : 'Orden descendente'}
        title={asc ? 'Ascendente' : 'Descendente'}
        className="k-b k-b-texto w-7 px-0"
      >
        {asc ? <ArrowUp size={16} aria-hidden="true" /> : <ArrowDown size={16} aria-hidden="true" />}
      </button>
      <CapaMenu abierto={abierto} alCerrar={() => setAbierto(false)} ancla={ancla} titulo="Ordenar por" opciones={opciones} seleccion />
    </div>
  )
}

interface PanelFiltrosProps {
  open: boolean
  onClose: () => void
  medicoId: string
  fechaDesde: string
  fechaHasta: string
  medicos: MedicoOpcion[]
  ocultarTodosMedicos: boolean
  onMedico: (id: string) => void
  onDesde: (v: string) => void
  onHasta: (v: string) => void
}

/* Los filtros de escritorio de antes (aplicación inmediata), en una capa del
   catálogo para `ih`, `iv` y `esc` (maqueta: «Filtros», CALMA §30.3). */
function PanelFiltros({ open, onClose, medicoId, fechaDesde, fechaHasta, medicos, ocultarTodosMedicos, onMedico, onDesde, onHasta }: PanelFiltrosProps) {
  return (
    <ModalShell open={open} onClose={onClose} title="Filtros" maxWidth="max-w-[360px]">
      <div className="space-y-4 px-5 pt-1 pb-5">
        <label className="k-campo-g">
          <span className="k-etiqueta">Médico</span>
          <select value={medicoId} onChange={e => onMedico(e.target.value)} className="k-campo">
            {!ocultarTodosMedicos && <option value="">Todos los médicos</option>}
            {medicos.map(m => <option key={m.id} value={m.id}>{componerNombreMedicoCompleto(m)}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="k-campo-g">
            <span className="k-etiqueta">Ingreso desde</span>
            <input type="date" value={fechaDesde} onChange={e => onDesde(e.target.value)} className="k-campo" />
          </label>
          <label className="k-campo-g">
            <span className="k-etiqueta">hasta</span>
            <input type="date" value={fechaHasta} onChange={e => onHasta(e.target.value)} className="k-campo" />
          </label>
        </div>
      </div>
    </ModalShell>
  )
}

/* Fila de la lista de `ext`/`tel`. Mismo enlace-que-cubre-la-fila que la
   tarjeta de antes: el ::after se estira sobre la fila (de ahí su `relative`)
   para que Next precargue el expediente. Los médicos siguen a la vista (la
   maqueta los pasaba a la hoja de acciones, que es de `KebabAccionesPaciente`
   y no existe para la secretaria). */
function FilaMovil({ p, i, orden, mostrarAcciones }: { p: PacienteExpediente; i: number; orden: OrdenColumna; mostrarAcciones: boolean }) {
  const edad = p.fecha_nacimiento ? calcularEdad(p.fecha_nacimiento) : null
  const sexoLabel = p.sexo === 'M' ? 'Masculino' : p.sexo === 'F' ? 'Femenino' : 'Otro'
  const nombre = 'block truncate text-[15px] leading-5 font-semibold text-tinta'
  const fuerte = (activa: boolean) => (activa ? 'font-semibold text-tinta' : '')
  return (
    <li className={`relative flex items-start gap-3 py-3 ext:gap-2.5 ${mostrarAcciones ? 'pr-5' : ''}`}>
      <div className={`k-avatar mt-0.5 ext:h-8 ext:w-8 ext:text-[12px] ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`} aria-hidden="true">
        {p.nombre.charAt(0)}{p.apellidos.charAt(0)}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        {mostrarAcciones ? (
          <Link href={`/expediente/${p.id}`}
            className={`${nombre} after:absolute after:inset-0 after:rounded-[var(--r-control)] after:content-[''] focus-visible:outline-none focus-visible:after:outline-[3px] focus-visible:after:outline-solid focus-visible:after:outline-enlace`}>
            {p.nombre} {p.apellidos}
          </Link>
        ) : (
          <p className={nombre}>{p.nombre} {p.apellidos}</p>
        )}
        <p className="text-[13px] leading-[18px] text-tinta2">
          {edad !== null ? `${edad.textoElegante} · ` : ''}
          {/* En `ext` (166 px de texto) el sexo va en inicial, como en la
              maqueta; el lector de pantalla sigue oyendo la palabra entera. */}
          {p.sexo === 'M' || p.sexo === 'F' ? (
            <><span aria-hidden="true" className="hidden ext:inline">{p.sexo}</span><span className="ext:sr-only">{sexoLabel}</span></>
          ) : sexoLabel}
          {' · '}<span className={`k-num whitespace-nowrap ${fuerte(orden === 'numero_expediente')}`}>{p.numero_expediente || '—'}</span>
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-[18px] text-tinta2">
          {/* `TZ_CLINICA`, no el huso del dispositivo: el ingreso es un dato de
              expediente —hermano de la fecha de apertura de la hoja frontal—,
              no una hora de cita. Ver LA REGLA en `@/lib/dates`. */}
          <span className={fuerte(orden === 'created_at')}>
            Ingreso {p.created_at ? renderEnTZ(p.created_at, 'd MMM yyyy', TZ_CLINICA) : '—'}
          </span>
          <ListaChipsMedicos medicos={p.medicos} />
        </div>
      </div>
      {mostrarAcciones && (
        /* Sobre la capa del enlace: el kebab no debe navegar. Área de 44, que
           sobresale al relleno de la tarjeta para no robar ancho al texto. */
        <div className="absolute -right-3 top-1.5 z-10 [&_button]:inline-flex [&_button]:min-h-11 [&_button]:min-w-11 [&_button]:items-center [&_button]:justify-center">
          <KebabAccionesPaciente pacienteId={p.id} />
        </div>
      )}
    </li>
  )
}

export default function ExpedientePage() {
  const [pacientes, setPacientes] = useState<PacienteExpediente[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [pagina, setPagina] = useState(0)
  const [hayMas, setHayMas] = useState(false)
  const [total, setTotal] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [orden, setOrden] = useState<OrdenColumna>('created_at')
  const [direccion, setDireccion] = useState<OrdenDireccion>('desc')
  const [medicoId, setMedicoId] = useState<string>('')
  const [fechaDesde, setFechaDesde] = useState<string>('')
  const [fechaHasta, setFechaHasta] = useState<string>('')
  const [medicos, setMedicos] = useState<MedicoOpcion[]>([])
  const [sheetAbierto, setSheetAbierto] = useState(false)
  const [panelAbierto, setPanelAbierto] = useState(false)
  const router = useRouter()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { state: subState, openBloqueoModal } = useSubscriptionGate()
  const { profile, isSecretary } = useProfile()
  const mostrarAcciones = !isSecretary && !!profile
  const ocultarTodosMedicos = isMedicoInvitado(profile)
  const medicoPorDefecto = isMedicoInvitado(profile) && profile?.id ? profile.id : ''
  const hayFiltrosActivos = (medicoId !== medicoPorDefecto) || fechaDesde !== '' || fechaHasta !== ''

  // Fase 8.2: handler reutilizable para intercept de creación
  function interceptIfBlocked(e: React.MouseEvent) {
    if (subState.isBlocked) {
      e.preventDefault()
      openBloqueoModal()
    }
  }

  // El enlace del estado vacío es un botón del catálogo (`EstadoVacio`): hace
  // lo mismo que el <Link> de antes con su intercept.
  function irANuevoPaciente() {
    if (subState.isBlocked) openBloqueoModal()
    else router.push('/pacientes/nuevo')
  }

  // «Filtros»: la hoja con borrador en `ext`/`tel`; la capa de aplicación
  // inmediata en el resto. El formato se lee al pulsar, nunca al pintar.
  function abrirFiltros() {
    const f = leerFormato()
    if (f === 'ext' || f === 'tel' || f === 'desconocido') setSheetAbierto(true)
    else setPanelAbierto(true)
  }

  async function cargar(
    busq: string,
    pag: number,
    acumular: boolean,
    ordenArg: OrdenColumna = orden,
    dirArg: OrdenDireccion = direccion,
    medicoArg: string = medicoId,
    desdeArg: string = fechaDesde,
    hastaArg: string = fechaHasta,
  ) {
    setLoading(true)
    setError(null)

    try {
      const resp = await fetchPacientesExpediente({
        q: busq, pag, orden: ordenArg, direccion: dirArg,
        medicoId: medicoArg || null,
        fechaDesde: desdeArg || null,
        fechaHasta: hastaArg || null,
      })

      // El route solo devuelve total en la carga inicial sin búsqueda; en el
      // resto de cargas total=null y se conserva el contador previo.
      if (resp.total !== null) setTotal(resp.total)
      setHayMas(resp.hayMas)
      setPacientes(prev => acumular ? [...prev, ...resp.pacientes] : resp.pacientes)
    } catch (e) {
      // No borramos los pacientes ya mostrados (caso "Cargar más"); solo
      // registramos el error para que el render decida cómo mostrarlo.
      setError(e instanceof Error ? e.message : 'No se pudo cargar la lista de pacientes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPagina(0)
      cargar(busqueda, 0, false)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [busqueda])

  function cargarMas() {
    const siguiente = pagina + 1
    setPagina(siguiente)
    cargar(busqueda, siguiente, true, orden, direccion, medicoId, fechaDesde, fechaHasta)
  }

  // Clic en columna (header o dropdown): misma columna alterna dirección; otra
  // columna salta a 'asc'. Resetea a pág 0 y recarga con los valores nuevos
  // EXPLÍCITOS (anti-stale-closure: setState es async, no se confía en el estado).
  function cambiarOrden(col: OrdenColumna) {
    const nuevaDir: OrdenDireccion = col === orden ? (direccion === 'asc' ? 'desc' : 'asc') : 'asc'
    setOrden(col)
    setDireccion(nuevaDir)
    setPagina(0)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    cargar(busqueda, 0, false, col, nuevaDir, medicoId, fechaDesde, fechaHasta)
  }

  // Botón de dirección: alterna asc/desc sobre la columna vigente.
  function cambiarDireccion() {
    const nuevaDir: OrdenDireccion = direccion === 'asc' ? 'desc' : 'asc'
    setDireccion(nuevaDir)
    setPagina(0)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    cargar(busqueda, 0, false, orden, nuevaDir, medicoId, fechaDesde, fechaHasta)
  }

  // Filtros (aplicación instantánea): cada cambio resetea a pág 0, limpia el
  // debounce pendiente y recarga pasando el valor nuevo EXPLÍCITO (anti-stale).
  function cambiarMedico(id: string) {
    setMedicoId(id); setPagina(0)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    cargar(busqueda, 0, false, orden, direccion, id, fechaDesde, fechaHasta)
  }
  function cambiarFechaDesde(v: string) {
    setFechaDesde(v); setPagina(0)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    cargar(busqueda, 0, false, orden, direccion, medicoId, v, fechaHasta)
  }
  function cambiarFechaHasta(v: string) {
    setFechaHasta(v); setPagina(0)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    cargar(busqueda, 0, false, orden, direccion, medicoId, fechaDesde, v)
  }

  // Aplicación del bottom-sheet de filtros (móvil): promueve el borrador del
  // sheet al estado real en UNA sola recarga, con valores EXPLÍCITOS (anti-stale).
  function aplicarFiltrosSheet(f: { medicoId: string; fechaDesde: string; fechaHasta: string; orden: OrdenColumna; direccion: OrdenDireccion }) {
    setMedicoId(f.medicoId)
    setFechaDesde(f.fechaDesde)
    setFechaHasta(f.fechaHasta)
    setOrden(f.orden)
    setDireccion(f.direccion)
    setPagina(0)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    cargar(busqueda, 0, false, f.orden, f.direccion, f.medicoId, f.fechaDesde, f.fechaHasta)
  }

  // Carga la lista de médicos para el dropdown, recortada por rol: el médico
  // invitado solo se ve a sí mismo (UX, no seguridad — la RLS ya limita).
  useEffect(() => {
    let cancelado = false
    async function cargarMedicos() {
      try {
        const r = await fetch('/api/clinica/medicos')
        if (!r.ok) return
        const { medicos: lista } = await r.json() as { medicos: MedicoOpcion[] }
        if (cancelado) return
        if (isMedicoInvitado(profile) && profile?.id) {
          const soloEl = (lista || []).filter(m => m.id === profile.id)
          setMedicos(soloEl)
          setMedicoId(profile.id)
          cargar(busqueda, 0, false, orden, direccion, profile.id, fechaDesde, fechaHasta)
        } else {
          setMedicos(lista || [])
        }
      } catch {
        // dropdown queda vacío (solo "Todos"); no rompe la página.
      }
    }
    cargarMedicos()
    return () => { cancelado = true }
  }, [profile])

  const filtrosProps = { medicoId, fechaDesde, fechaHasta, medicos, ocultarTodosMedicos: isMedicoInvitado(profile) }
  const pieLista = (
    <>
      {hayMas && (
        <div className="flex justify-center border-t border-linea py-2">
          <button onClick={cargarMas} disabled={loading} className="k-b k-b-texto">
            {loading ? 'Cargando...' : 'Cargar más pacientes'}
          </button>
        </div>
      )}
      {error && pacientes.length > 0 && (
        <p role="alert" className="pb-3 text-center text-[13px] leading-[18px] text-mal-tinta">{error}</p>
      )}
    </>
  )

  return (
    <div className="mx-auto max-w-6xl space-y-5 animate-slide-up">
      <CabeceraLista total={total} mostrarSuplementacion={!isSecretary} interceptIfBlocked={interceptIfBlocked} />

      <BarraLista
        busqueda={busqueda} onBusqueda={setBusqueda}
        orden={orden} direccion={direccion} onOrden={cambiarOrden} onDireccion={cambiarDireccion}
        hayFiltrosActivos={hayFiltrosActivos} onFiltros={abrirFiltros}
      />

      {/* Lista */}
      {loading && pacientes.length === 0 ? (
        <div className="k-tarjeta k-lista" aria-busy="true">
          <div className="k-lista">
            {[1,2,3,4,5].map(i => <PacienteSkeleton key={i} />)}
          </div>
        </div>
      ) : error && pacientes.length === 0 ? (
        <div className="k-tarjeta">
          <EstadoError titulo="No se pudo cargar la lista" mensaje={error} alReintentar={() => cargar(busqueda, pagina, false)} />
        </div>
      ) : pacientes.length === 0 ? (
        <EstadoVacio
          icono={busqueda ? SearchX : Stethoscope}
          titulo="No se encontraron pacientes"
          descripcion={busqueda ? 'Intenta con otro nombre' : 'Registra tu primer paciente'}
          accion={busqueda ? undefined : { etiqueta: '+ Nuevo paciente', alPulsar: irANuevoPaciente }}
        />
      ) : (
        <>
          {/* `ih`, `iv`, `esc`: tabla. `ext`, `tel` (y sin formato): lista. Sólo CSS. */}
          <div className="hidden k-tarjeta k-lista ih:block iv:block esc:block ih:px-4">
            <TablaPacientesExpediente pacientes={pacientes} orden={orden} direccion={direccion} onOrden={cambiarOrden} mostrarAcciones={mostrarAcciones} />
            {pieLista}
          </div>
          <div className="k-tarjeta k-lista ih:hidden iv:hidden esc:hidden">
            <ul className="k-lista">
              {pacientes.map((p, i) => (
                <FilaMovil key={p.id} p={p} i={i} orden={orden} mostrarAcciones={mostrarAcciones} />
              ))}
            </ul>
            {pieLista}
          </div>
        </>
      )}

      <SheetFiltrosExpediente
        open={sheetAbierto}
        onClose={() => setSheetAbierto(false)}
        medicoId={medicoId}
        fechaDesde={fechaDesde}
        fechaHasta={fechaHasta}
        orden={orden}
        direccion={direccion}
        medicos={medicos}
        ocultarTodosMedicos={ocultarTodosMedicos}
        medicoPorDefecto={medicoPorDefecto}
        onAplicar={aplicarFiltrosSheet}
      />
      <PanelFiltros
        open={panelAbierto} onClose={() => setPanelAbierto(false)} {...filtrosProps}
        onMedico={cambiarMedico} onDesde={cambiarFechaDesde} onHasta={cambiarFechaHasta}
      />
    </div>
  )
}
