'use client'

/**
 * El funnel de primera vez de la configuración de la agenda (tanda J, J5,
 * punto 13; maqueta `docs/spec/Main.dc.html`). Sustituye a «Primeros pasos»:
 * tres preguntas y el cierre.
 *
 * Cuándo sale lo decide `ConfiguracionAgenda` (`vistaInicial`): un médico con
 * consultorio activo al que le falta algo de lo que aquí se pregunta, o que
 * pulsó «Terminar después». Tras «Empezar de nuevo», también (lo deja todo
 * pendiente). No pregunta por las personas bloqueadas ni ofrece restablecer.
 *
 * GUARDA CADA PASO AL CONTINUAR, con las rutas de siempre: el horario de cada
 * consultorio (`PATCH /api/consultorios/[id]`), la duración (`tipos-cita`) y,
 * al terminar, el enlace fijo si no tenía (`POST /api/agenda/enlaces`). Los
 * avisos se guardan solos al cambiarlos (`estadoAvisos`). «Terminar después»
 * guarda el paso en que está si se puede y apunta ese paso (`guardarPaso`).
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import PasoHorario, { type EleccionHorario } from '@/components/agenda/configuracion/PasoHorario'
import PasoDuracion, { eleccionInicial, minutosDe, type EleccionDuracion } from '@/components/agenda/configuracion/PasoDuracion'
import BloquesAvisos from '@/components/agenda/configuracion/BloquesAvisos'
import CierrePrimeraVez, { type EnlaceCierre } from '@/components/agenda/configuracion/CierrePrimeraVez'
import { horarioGuardable } from '@/components/agenda/configuracion/EditorDias'
import { cargarListaEnlaces } from '@/components/agenda/configuracion/listaEnlaces'
import { emitirEnlace, guardarDuracion, guardarHorarioConsultorio, leerCodigo, urlReserva, type Resultado } from '@/components/agenda/configuracion/accionesConfig'
import type { EstadoAvisos } from '@/components/agenda/configuracion/estadoAvisos'
import { BOTON_AZUL, BOTON_BLANCO, ERROR, SUB_PASO, TITULO_PASO } from '@/components/agenda/configuracion/estilosConfig'
import { textoHorario } from '@/lib/agenda/gruposHorario'
import { cambiosPaso1, guardarPaso, modoInicial, olvidarPaso, recordatorioCorto, type PasoPrimeraVez } from '@/lib/agenda/primeraVez'
import { horarioEfectivo } from '@/lib/agenda/disponibilidad'
import { avisoDeEnlace, type MotivoApertura } from '@/lib/reserva/aperturaEnlace'
import type { TipoCita } from '@/lib/agenda/tiposCita'
import type { ConfigApp, Horario } from '@/lib/configApp'
import type { Consultorio } from '@/types'

type Paso = PasoPrimeraVez | 4

interface Props {
  usuarioId: string
  /** Los consultorios activos del médico. */
  consultorios: readonly Consultorio[]
  horarioClinica: Horario
  tipos: readonly TipoCita[] | null
  motivos: readonly MotivoApertura[]
  avisos: EstadoAvisos
  puedeAdministrar: boolean
  vigenciaDias: number
  pasoInicial: PasoPrimeraVez
  actualizarConfig: (cambio: (c: ConfigApp) => ConfigApp) => void
  /** Releer los tipos (del servidor) y la lista de enlaces. */
  alCambiarDatos: () => void
}

const ETAPAS = ['Horario', 'Consulta', 'Avisos'] as const

function eleccionesDe(consultorios: readonly Consultorio[], clinica: Horario): Record<string, EleccionHorario> {
  return Object.fromEntries(consultorios.map(c => {
    const modo = modoInicial({ ...c, horario: horarioEfectivo(c, clinica) }, clinica)
    return [c.id, { modo, propio: horarioEfectivo(c, clinica) }]
  }))
}

const principalDe = (tipos: readonly TipoCita[] | null, yo: string) =>
  tipos?.find(t => t.activo && t.principal && t.medico_id === yo && !t.consultorio_id) ?? null

/** El enlace fijo del médico: el vigente que ya tiene (su código) o uno nuevo. */
async function enlaceFijo(medicoId: string): Promise<EnlaceCierre> {
  const lista = await cargarListaEnlaces()
  /* Sin la lista no se sabe si ya hay uno: emitir regeneraría y mataría el que ya se compartió. */
  if (lista === 'error') return { estado: 'error', motivo: 'No se pudo leer tu enlace. Recarga la página.' }
  const fijo = lista.enlaces.find(e => e.medico_id === medicoId && e.clase === 'fijo') ?? null
  const r: Resultado<string | null> = fijo
    ? await leerCodigo(fijo.id)
    : await emitirEnlace(medicoId, 'fijo').then(x => (x.ok ? { ok: true as const, valor: x.valor.codigo } : x))
  if (!r.ok) return { estado: 'error', motivo: r.motivo }
  return r.valor ? { estado: 'listo', url: urlReserva(r.valor) } : { estado: 'error', motivo: 'No se pudo leer tu enlace' }
}

/** Barra «Paso N de 3» con sus tres etapas. */
function Avance({ paso }: { paso: PasoPrimeraVez }) {
  return (
    <div className="flex flex-col gap-[10px]">
      <div className="text-[14px] font-semibold text-[var(--ag-ink-600)]">Paso {paso} de 3 · menos de 2 minutos</div>
      <ol className="m-0 grid list-none grid-cols-3 gap-[8px] p-0">
        {ETAPAS.map((e, i) => (
          <li key={e} className="flex flex-col gap-[6px]" aria-current={i + 1 === paso ? 'step' : undefined}>
            <div aria-hidden="true" className={`h-[6px] rounded-[3px] ${i + 1 <= paso ? 'bg-[var(--ag-brand-secondary)]' : 'bg-[var(--ag-border-card)]'}`} />
            <div className={`text-[14px] ${i + 1 === paso ? 'font-bold text-[var(--ag-brand-legible)]' : 'text-[var(--ag-ink-600)]'}`}>{e}</div>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Lo elegido en cada paso y cómo se guarda. */
function useFunnel(p: Props) {
  const [elecciones, setElecciones] = useState(() => eleccionesDe(p.consultorios, p.horarioClinica))
  const [duracion, setDuracion] = useState<EleccionDuracion>(() => eleccionInicial(principalDe(p.tipos, p.usuarioId)?.duracion_min ?? null))
  const [miaId, setMiaId] = useState<string | null>(() => principalDe(p.tipos, p.usuarioId)?.id ?? null)
  const [guardadaDur, setGuardadaDur] = useState<number | null>(() => principalDe(p.tipos, p.usuarioId)?.duracion_min ?? null)

  async function guardarHorario(): Promise<string | null> {
    for (const c of p.consultorios) {
      const e = elecciones[c.id]
      /* La columna tal cual (normalizada), no la efectiva: `cambiosPaso1` mira si nació cerrada. */
      const columna = horarioEfectivo({ horario_propio: true, horario: c.horario }, null)
      const cambios = e ? cambiosPaso1({ ...c, horario: columna }, e.modo, e.propio, p.horarioClinica) : null
      if (!cambios) continue
      const r = await guardarHorarioConsultorio(c.id, cambios)
      if (!r.ok) return `${c.nombre}: ${r.motivo}`
      const columnas = 'horario_revisado' in cambios ? {} : cambios
      p.actualizarConfig(cfg => ({ ...cfg, consultorios: cfg.consultorios.map(x => (x.id === c.id
        ? { ...x, ...columnas, ...(r.valor !== undefined ? { horario_revisado_en: r.valor } : {}) } : x)) }))
    }
    return null
  }
  async function guardarConsulta(): Promise<string | null> {
    const minutos = minutosDe(duracion)
    if (miaId && guardadaDur === minutos) return null
    const r = await guardarDuracion({ medicoId: p.usuarioId, editarId: miaId ?? undefined, minutos })
    if (!r.ok) return r.motivo
    setMiaId(r.valor)
    setGuardadaDur(minutos)
    return null
  }
  return { elecciones, setElecciones, duracion, setDuracion, guardarHorario, guardarConsulta }
}

function textoAvisos(a: EstadoAvisos): string {
  const h = a.guardados?.recordatorio_horas
  const partes = [a.recordatorio === true && h ? `Recordatorio al paciente ${recordatorioCorto(h)} antes` : 'Sin recordatorio al paciente']
  if (a.correoClinica === true) partes.push('te avisamos de cada cita nueva')
  return partes.join(' · ')
}

/** ¿Se puede seguir desde este paso? */
function pasoValido(paso: Paso, f: ReturnType<typeof useFunnel>, a: EstadoAvisos): boolean {
  if (paso === 1) return Object.values(f.elecciones).every(e => e.modo === 'clinica' || horarioGuardable(e.propio))
  if (paso === 2) return minutosDe(f.duracion) >= 5
  return paso === 3 ? a.invalido === null : true
}

function Cabecera({ paso, guardando, alTerminarDespues }: { paso: Paso; guardando: boolean; alTerminarDespues: () => void }) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-[16px]">
        <Link href="/agenda" className="inline-flex min-h-[44px] items-center gap-[6px] text-[15px] text-[var(--ag-ink-600)] no-underline">
          <ChevronLeft size={18} aria-hidden="true" /> Agenda
        </Link>
        {paso < 4 && (
          <button type="button" disabled={guardando} onClick={alTerminarDespues}
            className="min-h-[44px] cursor-pointer border-0 bg-transparent px-[4px] text-[15px] text-[var(--ag-ink-600)] underline">Terminar después</button>
        )}
      </div>
      {paso !== 4 && <Avance paso={paso} />}
    </>
  )
}

function Pie({ paso, valido, guardando, alAtras, alContinuar }: { paso: Paso; valido: boolean; guardando: boolean; alAtras: () => void; alContinuar: () => void }) {
  if (paso === 4) return null
  return (
    <div className="flex flex-wrap items-center justify-between gap-[12px] pt-[8px]">
      <div>{paso > 1 && <button type="button" className={BOTON_BLANCO} onClick={alAtras}>Atrás</button>}</div>
      <button type="button" className={`${BOTON_AZUL} px-[32px] disabled:bg-[var(--ag-border-card)] disabled:text-[var(--ag-ink-600)] disabled:opacity-100`}
        disabled={!valido || guardando} onClick={alContinuar}>
        {guardando ? 'Guardando…' : paso === 3 ? 'Terminar' : 'Continuar'}
      </button>
    </div>
  )
}

function PasoAvisos({ avisos, puedeAdministrar }: { avisos: EstadoAvisos; puedeAdministrar: boolean }) {
  return (
    <section className="flex flex-col gap-[20px]" aria-labelledby="primera-vez-titulo">
      <div className="flex flex-col gap-[8px]">
        <h1 id="primera-vez-titulo" className={TITULO_PASO}>¿Mandamos avisos por correo?</h1>
        <p className={SUB_PASO}>Ya dejamos lo más útil listo. Puedes cambiarlo cuando quieras.</p>
      </div>
      <BloquesAvisos estado={avisos} puedeEditar={puedeAdministrar} variante="funnel" />
    </section>
  )
}

/** El paso en que está, su guardado y los tres botones (Continuar, Atrás, Terminar después). */
function useNavegacion(p: Props, f: ReturnType<typeof useFunnel>) {
  const router = useRouter()
  const [paso, setPaso] = useState<Paso>(p.pasoInicial)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enlace, setEnlace] = useState<EnlaceCierre>({ estado: 'cargando' })
  const irA = (n: Paso) => { setError(null); setPaso(n); window.scrollTo({ top: 0 }) }

  async function guardarActual(): Promise<boolean> {
    if (paso === 4 || paso === 3) return true
    setGuardando(true)
    const motivo = paso === 1 ? await f.guardarHorario() : await f.guardarConsulta()
    setGuardando(false)
    setError(motivo)
    if (!motivo) p.alCambiarDatos()
    return !motivo
  }
  /* Un doble clic antes del repintado no guarda dos veces (dos duraciones principales, dos enlaces). */
  const enCurso = useRef(false)
  async function unaVez(accion: () => Promise<void>): Promise<void> {
    if (enCurso.current) return
    enCurso.current = true
    try { await accion() } finally { enCurso.current = false }
  }
  const continuar = () => unaVez(async () => {
    if (paso === 4 || !pasoValido(paso, f, p.avisos) || !(await guardarActual())) return
    if (paso === 1 || paso === 2) { irA(paso === 1 ? 2 : 3); return }
    olvidarPaso(p.usuarioId)
    setEnlace({ estado: 'cargando' })
    irA(4)
    setEnlace(await enlaceFijo(p.usuarioId))
    p.alCambiarDatos()
  })
  const terminarDespues = () => unaVez(async () => {
    if (paso === 4) return
    if (pasoValido(paso, f, p.avisos) && !(await guardarActual())) return
    guardarPaso(p.usuarioId, paso)
    router.push('/agenda')
  })
  return { paso, guardando, error, enlace, irA, continuar, terminarDespues }
}

export default function PrimeraVez(p: Props) {
  const f = useFunnel(p)
  const n = useNavegacion(p, f)
  const { paso } = n
  const horarios = p.consultorios.map(c => {
    const e = f.elecciones[c.id]
    return e?.modo === 'propio' ? e.propio : p.horarioClinica
  })
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-[28px] pb-[64px] pt-[8px]" data-primera-vez={paso}>
      <Cabecera paso={paso} guardando={n.guardando} alTerminarDespues={() => void n.terminarDespues()} />
      {paso === 1 && (
        <PasoHorario consultorios={p.consultorios} elecciones={f.elecciones} horarioClinica={p.horarioClinica}
          alCambiar={(id, e) => f.setElecciones(x => ({ ...x, [id]: e }))} />
      )}
      {paso === 2 && <PasoDuracion eleccion={f.duracion} horarios={horarios} alCambiar={f.setDuracion} />}
      {paso === 3 && <PasoAvisos avisos={p.avisos} puedeAdministrar={p.puedeAdministrar} />}
      {paso === 4 && (
        <CierrePrimeraVez enlace={n.enlace} aviso={avisoDeEnlace(p.motivos)} medicoId={p.usuarioId} vigenciaDias={p.vigenciaDias} irAPaso={n.irA}
          alCrearUnaVez={p.alCambiarDatos}
          resumen={{
            consultorios: p.consultorios.map((c, i) => ({ id: c.id, nombre: c.nombre, texto: textoHorario(horarios[i] ?? p.horarioClinica) || 'Sin días' })),
            minutos: minutosDe(f.duracion), avisos: textoAvisos(p.avisos),
          }} />
      )}
      {n.error && <p role="alert" className={ERROR}>{n.error}</p>}
      <Pie paso={paso} valido={pasoValido(paso, f, p.avisos)} guardando={n.guardando}
        alAtras={() => n.irA(paso === 4 ? 3 : paso === 3 ? 2 : 1)} alContinuar={() => void n.continuar()} />
    </div>
  )
}
