'use client'

/**
 * src/components/agenda/BurbujaCita.tsx — tanda K, sección E, punto 21 de Angel: «La burbuja
 * de la cita se rehace como en Burbuja.dc.html: estructura, textos, tamaños y comportamiento,
 * tal cual; colores y tipografía, con los tokens de la app.»
 *
 * Es lo de DENTRO de la tarjeta de una cita (`TarjetaLectura.tsx` pone el diálogo, su sitio, la
 * entrada y la salida; las dos variantes, la de clic y la de pasar el ratón, pintan esto). Qué
 * acción va en cada sitio lo decide `burbujaDeTarjeta` (`accionesTarjeta.ts`), derivada de la
 * regla de siempre; qué HACE cada una, el llamador (`alAccion`, `InteraccionesV2.tsx`).
 *
 * Los cuatro ajustes de Angel sobre la maqueta: «Confirmar» abre WhatsApp, correo y «Marcar como
 * confirmada» (cada una si aplica); en la cancelada, «Darle otra cita» y «Reasignar el horario»;
 * los tres puntos sustituyen al engrane; el pie dice «No es una cita». Los iconos son los trazos
 * de la maqueta; la «G», a color (`GoogleGIcon`).
 *
 * Tanda M, punto 4 de Angel: «Los tres puntos de la burbuja abren directamente el formulario
 * completo de la cita. Quita el menú chico. Las observaciones, si la cita las tiene, se muestran en
 * una línea dentro de la burbuja.» El ⋮ es `alAccion('editar')`, la misma puerta que «Editar»; lo
 * que tenía el menú (tipo, consultorio, teléfono, «No asistió» de la agendada, los recordatorios de
 * la confirmada) está en ese formulario. Las medidas de computadora (punto 1) van en `globals.css`.
 *
 * Accesibilidad: las acciones en un `role="toolbar"` con foco itinerante (flechas, Inicio, Fin);
 * «Confirmar» despliega (`aria-expanded`); Escape cierra lo desplegado antes que la burbuja; el
 * expediente tachado es un botón con nombre y aviso.
 */
import { Fragment, useId, useRef, useState, type KeyboardEvent, type PointerEvent as EventoPuntero, type ReactElement, type ReactNode, type RefObject } from 'react'
import { ArrowRightLeft, CalendarX, ChevronDown, Trash2, UserPlus, X as Tache } from 'lucide-react'
import type { Appointment } from '@/lib/agenda/tiposAgenda'
import { marcasDeCita } from '@/lib/agenda/tarjetasAgenda'
import IconoEstadoCita from '@/components/ui/IconoEstadoCita'
import { indiceTrasTecla } from '@/lib/agenda/opcionesLista'
import { GoogleGIcon } from '@/components/agenda/GoogleGIcon'
import { IconoEnlace, IconoSinExpediente } from '@/components/agenda/MarcasCita'
import {
  burbujaDeTarjeta, cuandoDeTarjeta, diaLargoDeTarjeta, ETIQUETA_ACCION, horarioDeTarjeta, inicialesDeMedico, nombreDeTarjeta,
  type AccionTarjeta, type CeldaBurbuja, type DisposicionBurbuja,
} from '@/lib/agenda/accionesTarjeta'

/** Un mensaje de una acción (aviso enviado, o el motivo de un error). */
export interface MensajeAccion { texto: string; alerta: boolean }

/** Lo que la burbuja le pasa al botón de WhatsApp o de correo que pinta el llamador. */
export interface PiezaEnvio {
  etiqueta: string
  tabIndex?: number
  onFocus?: () => void
  alMensaje: (m: MensajeAccion | null) => void
}

export interface PropsBurbuja {
  cita: Appointment
  zonaVisor: string
  puedeIniciarConsulta: boolean
  conConfirmar?: boolean
  nombreMedico?: string | null
  puedeVerExpediente?: boolean
  destacar?: 'reagendar'
  /** La cita es de quien mira: «La apartó con TU enlace». */
  enlacePropio?: boolean
  alAccion: (accion: AccionTarjeta) => void
  whatsapp?: (o: PiezaEnvio) => ReactNode
  correo?: (o: PiezaEnvio) => ReactNode
}

/* ── Los trazos de la maqueta ─────────────────────────────────────────── */
function Trazo({ size = 20, color = 'currentColor', children }: { size?: number; color?: string; children: ReactNode }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" focusable="false" className="flex-none">{children}</svg>
  )
}
const IconoCerrar = () => <Trazo><path d="M6 6l12 12M18 6L6 18" /></Trazo>
const IconoReloj = () => <Trazo color="var(--tinta2)"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Trazo>
const IconoPlay = () => <Trazo><path d="M7 4v16l13-8z" /></Trazo>
const IconoDoc = () => <Trazo><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></Trazo>
const IconoCal = ({ color }: { color?: string }) => (
  <Trazo color={color}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18M10 15h6M14 13l2 2-2 2" /></Trazo>
)
const IconoCheck = () => <Trazo><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 10" /></Trazo>
const IconoLapiz = () => <Trazo><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" /></Trazo>
const IconoNoAsistio = () => (
  <Trazo><circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 9l5 5M21 9l-5 5" /></Trazo>
)

/** El icono de cada botón de la rejilla (y del ancho, si «Reagendar» sube a principal). */
function IconoDeAccion({ a }: { a: CeldaBurbuja }): ReactElement | null {
  switch (a) {
    case 'menu-confirmar': return <IconoCheck />
    case 'reagendar': return <IconoCal />
    case 'editar': return <IconoLapiz />
    case 'no-asistio': return <IconoNoAsistio />
    case 'reasignar': return <ArrowRightLeft size={20} aria-hidden="true" />
    case 'convertir': return <UserPlus size={20} aria-hidden="true" />
    /* B13 · AG5: las del pie, con su icono (la destructiva en rojo, por CSS). */
    case 'cancelar': return <Tache size={20} aria-hidden="true" />
    case 'eliminar': case 'eliminar-cita': return <Trash2 size={20} aria-hidden="true" />
    case 'no-es-cita': return <CalendarX size={20} aria-hidden="true" />
    case 'iniciar-consulta': case 'ligar': return <IconoPlay />
    default: return null
  }
}

/* ── Cabecera ─────────────────────────────────────────────────────────── */
/** El expediente tachado: un botón con nombre y el aviso «Aún no tiene expediente» (maqueta). */
function SinExpediente(): ReactElement {
  const [aviso, setAviso] = useState(false)
  const id = useId()
  return (
    <div className="ag-burbuja-sinexp">
      <button type="button" className="ag-burbuja-sinexp-boton" aria-label="Sin expediente: este paciente aún no tiene expediente"
        aria-describedby={aviso ? id : undefined}
        onMouseEnter={() => setAviso(true)} onMouseLeave={() => setAviso(false)} onFocus={() => setAviso(true)} onBlur={() => setAviso(false)}>
        <IconoSinExpediente size={20} />
      </button>
      {aviso && <span id={id} role="tooltip" className="ag-burbuja-aviso">Aún no tiene expediente</span>}
    </div>
  )
}

/** Las líneas de procedencia y el eslabón (permanente). B13 · AG5 (CALMA §28, textos unificados):
    «Agendada desde Google Calendar» y «Reservó por enlace» (antes «Llegó de Google Calendar» y
    «La apartó con tu enlace» / «… con el enlace de reserva»). */
function Procedencia({ cita, historial }: { cita: Appointment; historial: string | null }): ReactElement | null {
  const google = cita.origen === 'google'
  const enlace = Boolean(cita.reserva_canal)
  if (!google && !enlace) return null
  return (
    <>
      {google && (
        <p className="ag-burbuja-origen">
          <span className="ag-burbuja-origen-icono ag-burbuja-origen-icono--g"><GoogleGIcon size={14} /></span>Agendada desde Google Calendar
        </p>
      )}
      {enlace && (
        <p className="ag-burbuja-origen" data-burbuja-enlace="">
          <span className="ag-burbuja-origen-icono ag-burbuja-origen-icono--enlace"><IconoEnlace size={14} /></span>
          Reservó por enlace
        </p>
      )}
      {historial && <p className="ag-burbuja-origen ag-burbuja-historial">{historial}</p>}
    </>
  )
}

interface PropsCabecera {
  cita: Appointment; idTitulo: string; salir: () => void
  /** Tanda M, punto 4 · el botón abre el formulario completo (`alAccion('editar')`), sin menú. */
  alEditar: () => void
}

/* B13 · AG5 · el estado es el icono en círculo del dashboard (`IconoEstadoCita`, sus colores del kit)
   con su texto 12/600; el botón del formulario completo lleva LÁPIZ (CALMA §29.5) y el nombre de
   siempre, «Más opciones de la cita». */
function Cabecera({ cita, idTitulo, salir, alEditar }: PropsCabecera): ReactElement {
  const s = cita.status
  const marcas = marcasDeCita(cita)
  return (
    <div className="ag-burbuja-cab">
      <div className="ag-burbuja-fila">
        <span className="ag-burbuja-estado"><IconoEstadoCita estado={s} texto="siempre" compacto /></span>
        <div className="ag-burbuja-botones">
          <button type="button" className="ag-burbuja-icono" aria-label="Más opciones de la cita" aria-haspopup="dialog"
            onClick={alEditar}><IconoLapiz /></button>
          <button type="button" className="ag-burbuja-icono" aria-label="Cerrar" onClick={salir}><IconoCerrar /></button>
        </div>
      </div>
      <div className="ag-burbuja-nombre">
        <h2 id={idTitulo} className={s === 'cancelled' ? 'ag-burbuja-titulo ag-burbuja-titulo--cancelada' : 'ag-burbuja-titulo'}>
          {nombreDeTarjeta(cita)}
        </h2>
        {marcas.sinExpediente && <SinExpediente />}
      </div>
      <Procedencia cita={cita} historial={marcas.historial} />
    </div>
  )
}

/* ── El bloque de la hora y el médico ─────────────────────────────────── */
/* B13 · AG5 · el bloque de detalles entre dos líneas: la hora, el médico y, al final, las observaciones. */
function Info({ cita, zonaVisor, nombreMedico }: { cita: Appointment; zonaVisor: string; nombreMedico?: string | null }): ReactElement {
  const { duracion } = cuandoDeTarjeta(cita, zonaVisor)
  const { tramo, enConsultorio } = horarioDeTarjeta(cita, zonaVisor)
  const cancelada = cita.status === 'cancelled'
  return (
    <div className="ag-burbuja-info">
      <div className="ag-burbuja-cuando">
        <span className="ag-burbuja-reloj"><IconoReloj /></span>
        <div className="ag-burbuja-cuando-texto">
          <span className={cancelada ? 'ag-burbuja-hora ag-burbuja-hora--cancelada' : 'ag-burbuja-hora'}>
            {tramo.replace('–', ' – ')}{duracion && <span className="ag-burbuja-duracion"> · {duracion}</span>}
          </span>
          <span className="ag-burbuja-dia">{diaLargoDeTarjeta(cita, zonaVisor)}</span>
          {enConsultorio && <span className="ag-lectura-huso">{enConsultorio}</span>}
        </div>
      </div>
      {nombreMedico && (
        <div className="ag-burbuja-medico">
          <span aria-hidden="true" className="ag-burbuja-iniciales">{inicialesDeMedico(nombreMedico)}</span>
          <span>{nombreMedico}</span>
        </div>
      )}
      <Observaciones notas={cita.notes} />
    </div>
  )
}

/** Tanda M, punto 4 · Las observaciones en UNA línea, recortada con «…» (CSS); el texto entero
    queda en el DOM (lo lee el lector de pantalla) y en `title` (el ratón). Sin observaciones, nada. */
function Observaciones({ notas }: { notas: string | null | undefined }): ReactElement | null {
  const texto = notas?.replace(/\s+/g, ' ').trim()
  if (!texto) return null
  return (
    <p className="ag-burbuja-obs" title={texto} data-burbuja-obs="">
      <span className="ag-burbuja-obs-rotulo">Observaciones: </span>{texto}
    </p>
  )
}

/* ── Foco itinerante de la barra (APG «toolbar») ──────────────────────── */
/** Cada control de la barra lleva `data-clave` (él o, si lo pinta el llamador, su envoltorio). */
function useFocoBarra(orden: string[]): {
  barra: RefObject<HTMLDivElement | null>; foco: (clave: string) => { tabIndex: number; onFocus: () => void }; alTeclear: (e: KeyboardEvent) => void
} {
  const [activa, setActiva] = useState<string | null>(null)
  const barra = useRef<HTMLDivElement | null>(null)
  const actual = activa !== null && orden.includes(activa) ? activa : orden[0]
  const foco = (clave: string) => ({ tabIndex: clave === actual ? 0 : -1, onFocus: () => setActiva(clave) })
  function alTeclear(e: KeyboardEvent): void {
    /* B13 · AG5: la barra es una COLUMNA de filas (`aria-orientation="vertical"`): arriba y abajo
       recorren, y las flechas de los lados siguen haciéndolo, como antes. */
    const tecla = e.key === 'ArrowDown' ? 'ArrowRight' : e.key === 'ArrowUp' ? 'ArrowLeft' : e.key
    const i = indiceTrasTecla(orden.indexOf(actual), orden.length, tecla, 'horizontal')
    if (i === null) return
    e.preventDefault()
    setActiva(orden[i])
    const el = barra.current?.querySelector(`[data-clave="${orden[i]}"]`)
    const objetivo = el?.matches('button, a[href]') ? el : el?.querySelector('button, a[href]')
    if (objetivo instanceof HTMLElement) objetivo.focus()
  }
  return { barra, foco, alTeclear }
}

/** Las claves de la barra en el orden en que se recorren. */
function ordenDeBarra(d: DisposicionBurbuja, confirmarAbierto: boolean): string[] {
  const c = d.confirmar
  return [
    ...(d.principal ? ['principal'] : []),
    ...d.rejilla.map(a => `r:${a}`),
    ...(confirmarAbierto ? [...(c.whatsapp ? ['c:whatsapp'] : []), ...(c.correo ? ['c:correo'] : []), ...(c.marcar ? ['c:marcar'] : [])] : []),
    ...d.pie.map(a => `p:${a}`),
  ]
}

/* ── El botón ancho y su ayuda ────────────────────────────────────────── */
function Principal({ a, ayuda, alAccion, foco, autoFoco }: {
  a: AccionTarjeta; ayuda: string | null; alAccion: (a: AccionTarjeta) => void
  foco: { tabIndex: number; onFocus: () => void }; autoFoco: boolean
}): ReactElement {
  const icono = a === 'ver-expediente' ? <IconoDoc /> : a === 'reagendar' || a === 'reagendar-cita' ? <IconoCal /> : <IconoPlay />
  return (
    <div className="ag-burbuja-principal">
      <button type="button" data-clave="principal" autoFocus={autoFoco} {...foco} onClick={() => alAccion(a)}
        className={a === 'ver-expediente' ? 'ag-burbuja-cta ag-burbuja-cta--contorno' : 'ag-burbuja-cta'}>
        {icono}{ETIQUETA_ACCION[a]}
      </button>
      {ayuda && <span className="ag-burbuja-ayuda">{ayuda}</span>}
    </div>
  )
}

/* ── Lo que abre «Confirmar» ──────────────────────────────────────────── */
interface PropsConfirmar {
  d: DisposicionBurbuja; props: PropsBurbuja; id: string
  foco: (clave: string) => { tabIndex: number; onFocus: () => void }; alMensaje: (m: MensajeAccion | null) => void
}

function OpcionesConfirmar({ d, props, id, foco, alMensaje }: PropsConfirmar): ReactElement {
  const { whatsapp, correo, alAccion } = props
  return (
    <div id={id} className="ag-burbuja-submenu" data-submenu="" role="group" aria-label="Confirmar la cita">
      {d.confirmar.whatsapp && whatsapp && <div data-clave="c:whatsapp">{whatsapp({ etiqueta: 'Enviar por WhatsApp', ...foco('c:whatsapp'), alMensaje })}</div>}
      {d.confirmar.correo && correo && <div data-clave="c:correo">{correo({ etiqueta: 'Enviar por correo', ...foco('c:correo'), alMensaje })}</div>}
      {d.confirmar.marcar && (
        <button type="button" className="ag-capa-boton" data-clave="c:marcar" {...foco('c:marcar')} onClick={() => alAccion('confirmar')}>
          <IconoCheck />{ETIQUETA_ACCION.confirmar}
        </button>
      )}
    </div>
  )
}

/* ── La barra: el ancho, la rejilla, lo de «Confirmar» y el pie ───────── */
interface PropsAcciones {
  d: DisposicionBurbuja; props: PropsBurbuja; autoFoco: boolean
  confirmar: { abierto: boolean; alternar: () => void; id: string }
  mensaje: MensajeAccion | null; alMensaje: (m: MensajeAccion | null) => void
}

/* B13 · AG5 (CALMA §28) · Las acciones son FILAS DE MENÚ: icono de color y texto, a todo el ancho;
   lo que abre «Confirmar» cuelga de su fila; el pie va tras una línea, con la destructiva en rojo al
   final. Las clases y el orden del foco son los de antes (`.ag-burbuja-rejilla` = la lista,
   `.ag-burbuja-celda` = una fila, `.ag-burbuja-pie` = lo de tras la línea). */
function Acciones({ d, props, autoFoco, confirmar, mensaje, alMensaje }: PropsAcciones): ReactElement {
  const orden = ordenDeBarra(d, confirmar.abierto)
  const { barra, foco, alTeclear } = useFocoBarra(orden)
  if (orden.length === 0) return <div className="ag-burbuja-fin" />
  const celda = (a: CeldaBurbuja): ReactElement => (
    <button key={a} type="button" className="ag-burbuja-celda" data-clave={`r:${a}`} autoFocus={autoFoco && orden[0] === `r:${a}`}
      {...foco(`r:${a}`)} {...(a === 'menu-confirmar'
        ? { 'aria-expanded': confirmar.abierto, 'aria-controls': confirmar.abierto ? confirmar.id : undefined, 'data-abre-submenu': '', onClick: confirmar.alternar }
        : { onClick: () => props.alAccion(a) })}>
      <IconoDeAccion a={a} />{a === 'menu-confirmar' ? 'Confirmar' : ETIQUETA_ACCION[a]}
      {a === 'menu-confirmar' && <ChevronDown size={16} aria-hidden="true" className="ag-burbuja-chev" />}
    </button>
  )
  const opciones = confirmar.abierto ? <OpcionesConfirmar d={d} props={props} id={confirmar.id} foco={foco} alMensaje={alMensaje} /> : null
  return (
    <div ref={barra} role="toolbar" aria-label="Acciones de la cita" aria-orientation="vertical" className="ag-burbuja-acciones" onKeyDown={alTeclear}>
      <div className="ag-burbuja-cuerpo">
        {d.principal && <Principal a={d.principal} ayuda={d.ayuda} alAccion={props.alAccion} foco={foco('principal')} autoFoco={autoFoco} />}
        {!d.principal && d.ayuda && <span className="ag-burbuja-ayuda">{d.ayuda}</span>}
      </div>
      {d.rejilla.length > 0 && (
        <div className="ag-burbuja-rejilla">
          {d.rejilla.map(a => (a === 'menu-confirmar' ? <Fragment key={a}>{celda(a)}{opciones}</Fragment> : celda(a)))}
        </div>
      )}
      {d.rejilla.length === 0 && opciones}
      {mensaje && <p className="ag-lectura-mensaje" role={mensaje.alerta ? 'alert' : undefined}>{mensaje.texto}</p>}
      {d.pie.length > 0 ? (
        <div className="ag-burbuja-pie">
          {d.pie.map(a => (
            <button key={a} type="button" data-clave={`p:${a}`} {...foco(`p:${a}`)} autoFocus={autoFoco && orden[0] === `p:${a}`}
              className={a === 'no-es-cita' ? 'ag-burbuja-pie-boton' : 'ag-burbuja-pie-boton ag-burbuja-pie-boton--peligro'}
              onClick={() => props.alAccion(a)}><IconoDeAccion a={a} />{ETIQUETA_ACCION[a]}</button>
          ))}
        </div>
      ) : <div className="ag-burbuja-fin" />}
    </div>
  )
}

/* ── Todo junto ───────────────────────────────────────────────────────── */
/** Lo que despliega «Confirmar». Escape y el toque fuera lo cierran antes que la burbuja (y el foco
    vuelve a «Confirmar»). Tanda M, punto 4: los tres puntos ya no despliegan nada. */
function useDesplegado(): {
  abierto: boolean; alternar: () => void; alTeclear: (e: KeyboardEvent) => void; alPulsar: (e: EventoPuntero) => void
} {
  const [abierto, setAbierto] = useState(false)
  function alTeclear(e: KeyboardEvent): void {
    if (e.key !== 'Escape' || !abierto) return
    e.stopPropagation()
    e.currentTarget.querySelector<HTMLElement>('[data-clave="r:menu-confirmar"]')?.focus()
    setAbierto(false)
  }
  function alPulsar(e: EventoPuntero): void {
    if (!abierto || !(e.target instanceof Element) || e.target.closest('[data-submenu], [data-abre-submenu]')) return
    setAbierto(false)
  }
  return { abierto, alternar: () => setAbierto(a => !a), alTeclear, alPulsar }
}

export default function BurbujaCita({ props, idTitulo, salir, autoFoco }: {
  props: PropsBurbuja; idTitulo: string; salir: () => void; autoFoco: boolean
}): ReactElement {
  const { cita, zonaVisor, puedeIniciarConsulta, conConfirmar = true, nombreMedico, puedeVerExpediente = false, destacar } = props
  const [mensaje, setMensaje] = useState<MensajeAccion | null>(null)
  const desplegado = useDesplegado()
  const idConfirmar = useId()
  const d = burbujaDeTarjeta(cita, puedeIniciarConsulta, {
    conConfirmar, conWhatsApp: Boolean(props.whatsapp), conCorreo: Boolean(props.correo), puedeVerExpediente, destacar,
  })
  return (
    <div className="ag-burbuja-raiz" onKeyDown={desplegado.alTeclear} onPointerDown={desplegado.alPulsar}>
      <div className="ag-burbuja-franja" aria-hidden="true" style={{ background: `var(--ag-status-${cita.status}-dot)` }} />
      <span className="ag-burbuja-asa" aria-hidden="true" />
      <Cabecera cita={cita} idTitulo={idTitulo} salir={salir} alEditar={() => props.alAccion('editar')} />
      <Info cita={cita} zonaVisor={zonaVisor} nombreMedico={nombreMedico} />
      <Acciones d={d} props={props} autoFoco={autoFoco} mensaje={mensaje} alMensaje={setMensaje}
        confirmar={{ abierto: desplegado.abierto, alternar: desplegado.alternar, id: idConfirmar }} />
    </div>
  )
}
