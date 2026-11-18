'use client'

import { useEffect, useRef, useState, type ReactElement, type RefObject } from 'react'
import SelectorTurno from './SelectorTurno'
import FormularioDatos, { type Datos } from './FormularioDatos'
import PasoCodigo from './PasoCodigo'
import PasoQueDonde from './PasoQueDonde'
import ResumenCita from './ResumenCita'
import Comprobante, { cuandoEnZona } from './Comprobante'
import { hoyEn, mensajeDeError, pedir, type ConsultorioPagina, type TipoPagina, type TurnoPagina } from './clienteReserva'

/** Lo que la página de servidor le pasa: sólo lo que se pinta (ver page.tsx). */
export interface DatosPagina {
  codigo: string
  clase: 'fijo' | 'unico'
  medico: string
  especialidad: string | null
  consultorios: ConsultorioPagina[]
  /** Los tipos que valen en cada consultorio (`tiposDelConsultorio`, en page.tsx). */
  tiposPorConsultorio: Record<string, TipoPagina[]>
  aviso: string
  casilla: string
  /** E6: la cita cancelada que se reagenda (su código de confirmación y su fecha), o null. */
  origen: { codigo: string; cuando: string } | null
}

type Paso = 'que' | 'turno' | 'datos' | 'codigo' | 'listo'

/**
 * Los cuatro pasos visibles (tanda G1, punto 1). «Tus datos» incluye el código
 * del correo. El primero se llama «Lugar» (tanda H, punto 3 de Angel).
 */
const PASOS = ['Lugar', 'Día y hora', 'Tus datos', 'Listo'] as const
const INDICE: Record<Paso, number> = { que: 0, turno: 1, datos: 2, codigo: 2, listo: 3 }

/** El cuerpo de POST /api/reservar/[codigo]. Sin correo (sólo en el único, tanda I punto 2), la clave no va. */
function cuerpoReserva(c: string, t: string, turno: TurnoPagina, d: Datos, clientId: string, ficha: string | null, origen: string | null) {
  const correo = d.correo.trim()
  return { consultorio_id: c, tipo_cita_id: t, inicio: turno.inicio, nombre: d.nombre, telefono: d.telefono,
    ...(correo ? { correo } : {}), acepta_aviso: true, client_id: clientId, ...(ficha ? { ficha } : {}), ...(origen ? { origen } : {}) }
}

function Pasos({ paso }: { paso: Paso }): ReactElement {
  const actual = INDICE[paso]
  return (
    <ol className="rp-pasos" aria-label="Pasos de la reserva">
      {PASOS.map((p, i) => (
        <li key={p} data-e={i < actual ? 'hecho' : i === actual ? 'actual' : ''} aria-current={i === actual ? 'step' : undefined}>
          {p}{i < actual && <span className="sr-only"> (hecho)</span>}
        </li>
      ))}
    </ol>
  )
}

/** El título de cada paso; al cambiar de paso recibe el foco (ver `useFocoAlCambiar`). */
function Encabezado({ titulo }: { titulo: string }): ReactElement {
  return <h2 className="rp-titulo" tabIndex={-1} data-titulo-paso>{titulo}</h2>
}

/**
 * «Volver» (tanda H, punto 1 de Angel): un botón de verdad, secundario y con
 * borde, en el pie de CADA paso después del primero (también en el del
 * código), junto al botón principal y con su misma altura. Antes era un
 * enlace azul arriba que no se notaba, y en «Día y hora» sólo salía con más
 * de un consultorio o tipo. Volver no borra nada: lo elegido y lo escrito
 * viven en `useReserva`.
 */
function BotonVolver({ onClick }: { onClick: () => void }): ReactElement {
  return (
    <button type="button" className="rp-btn rp-btn--sec rp-volver" onClick={onClick}>
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      Volver
    </button>
  )
}

/** El aviso al volver a «Día y hora» si el horario elegido ya no está libre: el MISMO texto que el `turno_invalido` de la API. */
const TURNO_PERDIDO = mensajeDeError({ status: 400, cuerpo: { error: 'turno_invalido' } })

/** Al cambiar de paso (no al cargar), el foco va al título del paso nuevo: un lector de pantalla lo anuncia. */
function useFocoAlCambiar(paso: Paso): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null)
  const primera = useRef(true)
  useEffect(() => {
    if (primera.current) { primera.current = false; return }
    ref.current?.querySelector<HTMLElement>('[data-titulo-paso]')?.focus()
  }, [paso])
  return ref
}

/** Con un solo tipo, ése; con varios NO se preselecciona ninguno (como el «Elige…» de antes). */
const tipoDeOficio = (tipos: TipoPagina[]): string => (tipos.length === 1 ? tipos[0]?.id ?? '' : '')

/** El estado de la reserva y sus llamadas a la API: las mismas que antes del rediseño. */
function useReserva(datos: DatosPagina) {
  const base = `/api/reservar/${encodeURIComponent(datos.codigo)}`
  const tiposDe = (id: string): TipoPagina[] => datos.tiposPorConsultorio[id] ?? []
  const [consultorioId, setConsultorioId] = useState(datos.consultorios[0]?.id ?? '')
  const [tipoId, setTipoId] = useState(() => tipoDeOficio(tiposDe(consultorioId)))
  const [turno, setTurno] = useState<TurnoPagina | null>(null)
  /* Tanda H, punto 3: SIEMPRE se empieza en «Lugar», también con un solo
     consultorio (sale ya elegido, con su dirección). G1 lo saltaba. */
  const [paso, setPaso] = useState<Paso>('que')
  const [persona, setPersona] = useState<Datos | null>(null)
  /* Lo escrito en «Tus datos», también sin enviar: vuelve tal cual al regresar (punto 1). */
  const [borrador, setBorrador] = useState<Datos | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [clientId] = useState(() => crypto.randomUUID())

  async function reservar(d: Datos, ficha: string | null): Promise<void> {
    if (!turno) return
    const r = await pedir(base, 'POST', cuerpoReserva(consultorioId, tipoId, turno, d, clientId, ficha, datos.origen?.codigo ?? null))
    if (r.status === 201 || r.status === 200) { setPaso('listo'); return }
    setError(mensajeDeError(r))
    if (r.cuerpo.error === 'turno_ocupado' || r.cuerpo.error === 'turno_invalido') { setTurno(null); setPaso('turno') }
  }
  async function conEspera(f: () => Promise<void>): Promise<void> {
    setOcupado(true); setError(null)
    try { await f() } finally { setOcupado(false) }
  }
  const pedirCodigo = (d: Datos) => conEspera(async () => {
    // Tanda I, punto 21: el consultorio elegido, sólo para la cabecera del correo del código.
    const r = await pedir(`${base}/codigo`, 'POST', { correo: d.correo, consultorio_id: consultorioId })
    if (r.status === 200) setPaso('codigo'); else setError(mensajeDeError(r))
  })
  const alEnviarDatos = (d: Datos) => { setPersona(d); setBorrador(d); return datos.clase === 'fijo' ? pedirCodigo(d) : conEspera(() => reservar(d, null)) }
  const alVerificar = (codigo: string) => conEspera(async () => {
    if (!persona) return
    const r = await pedir(`${base}/verificar`, 'POST', { correo: persona.correo, codigo })
    if (r.status === 200 && typeof r.cuerpo.ficha === 'string') await reservar(persona, r.cuerpo.ficha)
    else setError(mensajeDeError(r))
  })
  const ir = (p: Paso) => { setError(null); setPaso(p) }
  const turnoPerdido = () => { setTurno(null); setError(TURNO_PERDIDO) }
  /* Punto 5 de Angel: al cambiar de consultorio, el tipo elegido se reinicia si no vale en el nuevo. */
  const elegirConsultorio = (id: string) => {
    setConsultorioId(id)
    if (!tiposDe(id).some(t => t.id === tipoId)) setTipoId(tipoDeOficio(tiposDe(id)))
  }
  const tipos = tiposDe(consultorioId)
  return { consultorioId, elegirConsultorio, tipos, tipoId, setTipoId, turno, setTurno, paso, ir, persona, borrador, setBorrador,
    turnoPerdido, error, ocupado, pedirCodigo, alEnviarDatos, alVerificar }
}
type Reserva = ReturnType<typeof useReserva>

interface Vista { datos: DatosPagina; r: Reserva; consultorio: ConsultorioPagina; tipos: TipoPagina[]; zona: string }

/**
 * Paso 2: el resumen, la semana y el pie con lo elegido. Guarda semana y día
 * para volver a ellos; si al volver el horario elegido ya no está libre, se
 * avisa (`turnoPerdido`) y lo escrito en «Tus datos» se conserva.
 */
function VistaTurno({ datos, r, consultorio, tipos, zona, semana }: Vista & { semana: Semana }): ReactElement {
  const cuando = r.turno ? cuandoEnZona(r.turno.inicio, zona) : null
  return (
    <>
      <Encabezado titulo="Elige día y hora" />
      <ResumenCita consultorio={consultorio} tipo={tipos.length > 1 ? tipos.find(t => t.id === r.tipoId) : null} />
      <SelectorTurno codigo={datos.codigo} consultorioId={r.consultorioId} tipoId={r.tipoId} zona={zona} desde={semana.desde}
        onDesde={semana.setDesde} dia={semana.dia} onDia={d => { semana.setDia(d); r.setTurno(null) }} elegido={r.turno}
        onElegir={r.setTurno} onPerdido={r.turnoPerdido} />
      <div className="rp-pie">
        <small aria-live="polite">{cuando ? <b>{cuando}</b> : 'Elige un horario para continuar'}</small>
        <div className="rp-pie__fila">
          <BotonVolver onClick={() => r.ir('que')} />
          <button type="button" className="rp-btn" disabled={!r.turno} onClick={() => r.ir('datos')}>Continuar</button>
        </div>
      </div>
    </>
  )
}

/** Paso 3: los datos y, con el enlace fijo, el código del correo. */
function VistaDatos({ datos, r, consultorio, tipos, zona }: Vista): ReactElement {
  const enCodigo = r.paso === 'codigo'
  const volver = <BotonVolver onClick={() => r.ir(enCodigo ? 'datos' : 'turno')} />
  return (
    <>
      <Encabezado titulo={enCodigo ? 'Revisa tu correo' : 'Tus datos'} />
      <ResumenCita consultorio={consultorio} tipo={tipos.length > 1 ? tipos.find(t => t.id === r.tipoId) : null}
        cuando={r.turno ? cuandoEnZona(r.turno.inicio, zona) : null} />
      {!enCodigo && <FormularioDatos aviso={datos.aviso} casilla={datos.casilla} ocupado={r.ocupado}
        textoBoton={datos.clase === 'fijo' ? 'Enviar código a mi correo' : 'Reservar cita'} onEnviar={r.alEnviarDatos}
        inicial={r.borrador} onCambio={r.setBorrador} volver={volver} sinCorreo={datos.clase === 'unico'} />}
      {enCodigo && r.persona && <PasoCodigo correo={r.persona.correo} ocupado={r.ocupado} onVerificar={r.alVerificar}
        onReenviar={() => { if (r.persona) void r.pedirCodigo(r.persona) }} volver={volver} />}
    </>
  )
}

interface Semana { desde: string; setDesde: (d: string) => void; dia: string | null; setDia: (d: string | null) => void }

/** Paso 1, «Lugar»: consultorio (con uno solo, ya elegido) y, si hay más de uno, tipo. Cambiar cualquiera de los dos olvida la hora elegida. */
function VistaQueDonde({ datos, r, tipos, semana, zona }: Vista & { semana: Semana }): ReactElement {
  const cambiar = (f: () => void) => { f(); r.setTurno(null); semana.setDia(null); semana.setDesde(hoyEn(zona)) }
  return (
    <>
      <Encabezado titulo={tipos.length > 1 ? '¿Qué necesitas y dónde?' : '¿Dónde quieres tu cita?'} />
      <PasoQueDonde consultorios={datos.consultorios} consultorioId={r.consultorioId} tipos={tipos} tipoId={r.tipoId}
        onConsultorio={id => cambiar(() => r.elegirConsultorio(id))} onTipo={id => cambiar(() => r.setTipoId(id))} />
      <div className="rp-pie">
        {!r.tipoId && <small>Elige el tipo de cita para continuar</small>}
        <button type="button" className="rp-btn" disabled={!r.tipoId} onClick={() => r.ir('turno')}>Elegir día y hora</button>
      </div>
    </>
  )
}

export default function ReservaCliente({ datos }: { datos: DatosPagina }): ReactElement {
  const r = useReserva(datos)
  const consultorio = datos.consultorios.find(c => c.id === r.consultorioId) ?? datos.consultorios[0]
  const zona = consultorio?.zona ?? 'America/Mexico_City'
  const [desde, setDesde] = useState(() => hoyEn(zona))
  const [dia, setDia] = useState<string | null>(null)
  const foco = useFocoAlCambiar(r.paso)
  if (!consultorio) return <></>
  /* Tipos del consultorio elegido (punto 7 de G1; punto 5 de Angel con los
     tipos por consultorio de G2): con uno solo no hay selector. */
  const vista: Vista = { datos, r, consultorio, tipos: r.tipos, zona }
  const semana: Semana = { desde, setDesde, dia, setDia }
  return (
    <>
      <h1 className="sr-only">Reservar cita con {datos.medico}</h1>
      <Pasos paso={r.paso} />
      {/* PENDIENTE DE REVISIÓN (texto). */}
      {datos.origen && <p className="rp-nota">Estás reagendando tu cita del {datos.origen.cuando}.</p>}
      <div className="rp-tarjeta" ref={foco}>
        {r.error && <p role="alert" className="rp-nota rp-nota--error">{r.error}</p>}
        <div className="rp-paso" key={r.paso}>
          {r.paso === 'que' && <VistaQueDonde {...vista} semana={semana} />}
          {r.paso === 'turno' && <VistaTurno {...vista} semana={semana} />}
          {(r.paso === 'datos' || r.paso === 'codigo') && <VistaDatos {...vista} />}
          {r.paso === 'listo' && r.turno && <Comprobante medico={datos.medico} consultorio={consultorio} inicio={r.turno.inicio}
            conCorreo={datos.clase === 'fijo' && Boolean(r.persona?.correo.trim())} />}
        </div>
      </div>
    </>
  )
}
