'use client'

import { useEffect, useRef, useState, type ReactElement, type RefObject } from 'react'
import SelectorTurno from './SelectorTurno'
import FormularioDatos, { type Datos } from './FormularioDatos'
import PasoCodigo from './PasoCodigo'
import PasoQueDonde from './PasoQueDonde'
import ResumenCita from './ResumenCita'
import Comprobante, { cuandoEnZona } from './Comprobante'
import {
  esperaDe, hoyEn, mensajeDeError, pedir, type ConsultorioPagina, type RespuestaApi, type TipoPagina, type TurnoPagina,
} from './clienteReserva'
import {
  atenderTraspasos, codigoDelFragmento, codigoPendiente, correoLlave, fichaPara, guardar, olvidar, pasoAlRestaurar, pedirTraspaso, recuperar,
  type Continuidad, type Traspaso,
} from './continuidadReserva'

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

const YA_VERIFICADO = 'Tu correo ya está verificado. Completa tus datos para reservar.'
/** Los 30 s del servidor entre dos códigos (`REENVIO_CODIGO_S`): sólo para fechar un envío hecho en otra pestaña. */
const REENVIO_S = 30
/** La ficha vive 30 min en la base; aquí, un minuto menos para no mandarla al borde. */
const VIDA_FICHA_MS = 29 * 60_000
/** El número de `reenviar_en` (los 30 s que impone la ruta), o null. */
function reenviarEn(r: RespuestaApi): number | null {
  const s = r.cuerpo.reenviar_en
  return typeof s === 'number' && Number.isFinite(s) && s > 0 ? s : null
}

/**
 * Tanda L (punto 10): el nombre y el teléfono restaurados vuelven al FORMULARIO («Tus datos», ya escritos),
 * no a la reserva: tras verificar se marca otra vez el aviso y se pulsa «Reservar cita» (revisión de
 * seguridad de L4: el consentimiento se da en la pestaña que reserva, y lo que llegue por el traspaso se ve
 * antes de mandarlo). Sin código pedido no hay nada que restaurar.
 */
function borradorRestaurado(g: Continuidad): Datos | null {
  return g.envio ? { nombre: g.persona?.nombre ?? '', telefono: g.persona?.telefono ?? '', correo: g.envio.correo } : null
}

/** Tanda L (punto 10): se guardan los ENVIADOS (el código, nunca) o, si aún no, los restaurados: una 2.ª recarga no los pierde. */
function personaGuardable(persona: Datos | null, restaurada: Continuidad['persona']): Continuidad['persona'] {
  return persona ? { nombre: persona.nombre, telefono: persona.telefono } : restaurada
}

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
  const [clientId, setClientId] = useState(() => crypto.randomUUID())
  const c = useEstadoCodigo()
  const [restaurada, setRestaurada] = useState<Continuidad['persona']>(null) // tanda L: hasta que se envíen otros
  useContinuidad(datos, { continuidad: { consultorioId, tipoId, turno, clientId, ...c.guardable, persona: personaGuardable(persona, restaurada) } }, paso, g => {
    setConsultorioId(g.consultorioId); setTipoId(g.tipoId); setTurno(g.turno); setClientId(g.clientId); c.restaurar(g)
    const b = borradorRestaurado(g); if (b) setBorrador(b); setRestaurada(g.persona)
    const r = pasoAlRestaurar(g) // con el correo ya verificado no hay código que escribir: a «Tus datos», diciéndolo
    if (r.verificado) setError(YA_VERIFICADO); setPaso(r.paso)
  }, c.setCodigoCorreo)
  async function reservar(d: Datos, f: string | null): Promise<void> {
    if (!turno) return
    const r = await pedir(base, 'POST', cuerpoReserva(consultorioId, tipoId, turno, d, clientId, f, datos.origen?.codigo ?? null))
    if (r.status === 201 || r.status === 200) { setPaso('listo'); return }
    setError(mensajeDeError(r))
    // La ficha ya no vale: el código que la dio está gastado, así que el siguiente envío pide uno nuevo (no «Pide un código primero»).
    if (r.cuerpo.error === 'correo_sin_verificar') { c.setFicha(null); c.setEnvio(null); c.setCodigoCorreo(null) }
    if (r.cuerpo.error === 'turno_ocupado' || r.cuerpo.error === 'turno_invalido') { setTurno(null); setPaso('turno') }
  }
  async function conEspera(f: () => Promise<void>): Promise<void> {
    setOcupado(true); setError(null)
    try { await f() } finally { setOcupado(false) }
  }
  const flujo = flujoCodigo({ base, consultorioId, origen: datos.origen?.codigo ?? null, clase: datos.clase, persona, c, conEspera, reservar, setPaso, setError,
    alDatos: d => { setPersona(d); setBorrador(d) } })
  const ir = (p: Paso) => { setError(null); setPaso(p) }
  const turnoPerdido = () => { setTurno(null); setError(TURNO_PERDIDO) }
  /* Punto 5 de Angel: al cambiar de consultorio, el tipo elegido se reinicia si no vale en el nuevo. */
  const elegirConsultorio = (id: string) => {
    setConsultorioId(id)
    if (!tiposDe(id).some(t => t.id === tipoId)) setTipoId(tipoDeOficio(tiposDe(id)))
  }
  const tipos = tiposDe(consultorioId)
  return { consultorioId, elegirConsultorio, tipos, tipoId, setTipoId, turno, setTurno, paso, ir, persona, borrador, setBorrador,
    turnoPerdido, error, ocupado, envio: c.envio, reenviarDesde: c.reenviarDesde, codigoCorreo: c.codigoCorreo, ...flujo,
    /* K2: con la ficha vigente (recargó tras verificar), «Tus datos» ya reserva: no pide otro código. */
    conFicha: borrador !== null && fichaPara(c.ficha, borrador.correo) !== null }
}

/** K2 (punto 10): el código pedido, la ficha y la cuenta regresiva; sobreviven a recargar (continuidadReserva.ts). */
function useEstadoCodigo() {
  const [envio, setEnvio] = useState<Continuidad['envio']>(null)
  const [ficha, setFicha] = useState<Continuidad['ficha']>(null)
  const [reenviarDesde, setReenviarDesde] = useState(0)
  /* K2 (punto 9): el código que trajo «Continuar mi reserva» (`#codigo=`). Sólo en memoria: nunca se guarda. */
  const [codigoCorreo, setCodigoCorreo] = useState<string | null>(null)
  const restaurar = (g: Continuidad) => { setEnvio(g.envio); setFicha(g.ficha); setReenviarDesde(g.reenviarDesde) }
  return { envio, setEnvio, ficha, setFicha, reenviarDesde, setReenviarDesde, restaurar, codigoCorreo, setCodigoCorreo,
    guardable: { envio, ficha, reenviarDesde } }
}

interface CtxCodigo {
  base: string
  consultorioId: string
  origen: string | null
  clase: DatosPagina['clase']
  persona: Datos | null
  c: ReturnType<typeof useEstadoCodigo>
  conEspera: (f: () => Promise<void>) => Promise<void>
  reservar: (d: Datos, f: string | null) => Promise<void>
  setPaso: (p: Paso) => void
  setError: (e: string | null) => void
  alDatos: (d: Datos) => void
}

/**
 * Pedir el código, verificarlo y reservar (enlace fijo). K2 (punto 10): con la ficha vigente se reserva
 * sin otro código; con un código pendiente para ese correo se vuelve a él en vez de pedir otro; y si la
 * reserva falló DESPUÉS de verificar, se reusa la ficha (antes se volvía a verificar el código, ya
 * gastado, y salía «Pide un código primero»).
 */
function flujoCodigo(x: CtxCodigo) {
  const { c } = x
  const pedirCodigo = (correo: string) => x.conEspera(async () => {
    // Tanda I, punto 21: el consultorio elegido, sólo para la cabecera del correo del código.
    // K2 (punto 9): el `origen` (E6), para que «Continuar mi reserva» del correo lo conserve.
    const r = await pedir(`${x.base}/codigo`, 'POST', { correo, consultorio_id: x.consultorioId, ...(x.origen ? { origen: x.origen } : {}) })
    // La cuenta regresiva con lo que dice el servidor (30 s, o lo que falte del tope).
    const espera = r.status === 200 ? reenviarEn(r) : esperaDe(r)
    if (espera) c.setReenviarDesde(Date.now() + espera * 1000)
    if (r.status === 200) { c.setEnvio({ correo, en: Date.now() }); c.setCodigoCorreo(null); x.setPaso('codigo'); return }
    x.setError(mensajeDeError(r))
    /* Un código a ESTE correo en ESTE enlace salió hace menos de 30 s (otra pestaña, o la de antes de
       recargar): sigue valiendo, así que se va a escribirlo en vez de quedarse en «Tus datos». */
    if (r.cuerpo.error === 'espera_reenvio' && espera) {
      c.setEnvio(e => e && correoLlave(e.correo) === correoLlave(correo) ? e : { correo, en: Date.now() - (REENVIO_S - espera) * 1000 })
      x.setPaso('codigo')
    }
  })
  const alEnviarDatos = (d: Datos): Promise<void> => {
    x.alDatos(d)
    if (x.clase !== 'fijo') return x.conEspera(() => x.reservar(d, null))
    const f = fichaPara(c.ficha, d.correo)
    if (f) return x.conEspera(() => x.reservar(d, f))
    /* K2 (punto 9): con el código del correo en la mano (abrió «Continuar mi reserva» sin la pestaña de antes)
       no se pide otro, que invalidaría ése: se va a escribirlo. Si el correo no es el suyo, verificar lo dirá. */
    if (c.codigoCorreo && !codigoPendiente(c.envio, d.correo)) c.setEnvio({ correo: d.correo, en: Date.now() })
    if (c.codigoCorreo || codigoPendiente(c.envio, d.correo)) { x.setError(null); x.setPaso('codigo'); return Promise.resolve() }
    return pedirCodigo(d.correo)
  }
  async function verificarYReservar(codigo: string): Promise<void> {
    const envio = c.envio
    if (!envio) return
    let f = fichaPara(c.ficha, envio.correo)
    if (!f) {
      const r = await pedir(`${x.base}/verificar`, 'POST', { correo: envio.correo, codigo })
      // El código del correo (punto 9) ya se probó: si falló, no vuelve a adelantar el paso (se pide otro).
      c.setCodigoCorreo(null)
      if (r.status !== 200 || typeof r.cuerpo.ficha !== 'string') { x.setError(mensajeDeError(r)); return }
      f = r.cuerpo.ficha
      c.setFicha({ valor: f, correo: correoLlave(envio.correo), hasta: Date.now() + VIDA_FICHA_MS })
    }
    if (x.persona && correoLlave(x.persona.correo) === correoLlave(envio.correo)) await x.reservar(x.persona, f)
    else { x.setError(YA_VERIFICADO); x.setPaso('datos') } // tras recargar o en la pestaña nueva: «Tus datos», ya escritos (tanda L)
  }
  return { pedirCodigo, alEnviarDatos, alVerificar: (codigo: string) => x.conEspera(() => verificarYReservar(codigo)) }
}

/**
 * K2 (puntos 9 y 10): guarda lo pedido en `sessionStorage` mientras haya un código o una ficha y lo borra
 * al reservar. Al montar: lo de esta pestaña si casa con la página; si no y llegó `#codigo=` del correo,
 * se lo pide a la pestaña que tenía la reserva a medias y, si ninguna contesta, sólo se guarda el código.
 */
function useContinuidad(datos: DatosPagina, actual: Traspaso, paso: Paso, aplicar: (g: Continuidad) => void,
  alCodigo: (codigo: string) => void): void {
  const ref = useRef({ aplicar, alCodigo, actual, paso })
  useEffect(() => { ref.current = { aplicar, alCodigo, actual, paso } }) // lo último, para los avisos que llegan después
  const fragmento = useRef<string | null | undefined>(undefined)
  const tiposRef = useRef(datos.tiposPorConsultorio)
  useEffect(() => {
    const vale = (g: Continuidad) => g.turno !== null && (tiposRef.current[g.consultorioId] ?? []).some(t => t.id === g.tipoId)
    // Una sola lectura: StrictMode corre el efecto dos veces y la primera ya limpió la barra de direcciones.
    if (fragmento.current === undefined) fragmento.current = codigoDelFragmento()
    const codigo = fragmento.current
    if (codigo) ref.current.alCodigo(codigo)
    const g = recuperar(datos.codigo)
    if (g && vale(g)) { ref.current.aplicar(g); return }
    if (!codigo) return
    let vivo = true
    void pedirTraspaso(datos.codigo).then(t => { if (vivo && t && vale(t.continuidad)) ref.current.aplicar(t.continuidad) })
    return () => { vivo = false }
  }, [datos.codigo]) // sólo al montar (o con otro enlace): un refresco del servidor no pisa lo que se está escribiendo
  useEffect(() => {
    // Otra pestaña abrió «Continuar mi reserva»: se le pasa la reserva a medias sólo mientras el código pedido aquí no vence.
    const atender = atenderTraspasos(datos.codigo, () => {
      const { actual: t, paso: p } = ref.current
      const envio = t.continuidad.envio
      return envio && p !== 'listo' && codigoPendiente(envio, envio.correo) ? t : null
    })
    const alHash = () => { const codigo = codigoDelFragmento(); if (codigo) ref.current.alCodigo(codigo) }
    window.addEventListener('hashchange', alHash)
    return () => { atender(); window.removeEventListener('hashchange', alHash) }
  }, [datos.codigo])
  const firma = JSON.stringify(actual.continuidad)
  useEffect(() => {
    if (paso === 'listo') { olvidar(datos.codigo); return }
    const c = ref.current.actual.continuidad
    if (c.envio || c.ficha) guardar(datos.codigo, c)
    else olvidar(datos.codigo) // sin código ni ficha (p. ej. `correo_sin_verificar`), nada que guardar: tampoco el nombre
  }, [firma, paso, datos.codigo])
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
        textoBoton={datos.clase === 'fijo' && !r.conFicha ? 'Enviar código a mi correo' : 'Reservar cita'} onEnviar={r.alEnviarDatos}
        inicial={r.borrador} onCambio={r.setBorrador} volver={volver} sinCorreo={datos.clase === 'unico'} />}
      {enCodigo && r.envio && <PasoCodigo key={r.codigoCorreo ?? ''} codigoInicial={r.codigoCorreo} correo={r.envio.correo} ocupado={r.ocupado} onVerificar={r.alVerificar}
        reenviarDesde={r.reenviarDesde} onReenviar={() => { if (r.envio) void r.pedirCodigo(r.envio.correo) }} volver={volver} />}
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
