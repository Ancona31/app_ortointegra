/**
 * continuidadReserva.ts — lo que hace que el código ya pedido NO se pierda
 * (K2, puntos 9 y 10 de Angel). Sólo navegador; sin React.
 *
 * Punto 10: recargar o ir atrás y adelante dejaba la página en «Lugar» y había
 * que pedir otro código (cada uno gasta del tope de 3 por correo por hora e
 * invalida el anterior). Lo pedido se guarda en `sessionStorage` (de ESTA
 * pestaña, se borra al cerrarla) con lo MÍNIMO para seguir: lo elegido
 * (consultorio, tipo, turno: nada personal), el `client_id`, el correo al que
 * se mandó el código (sin él no se puede verificar), cuándo se mandó, desde
 * cuándo se puede pedir otro y la ficha del correo ya verificado (un uso, 30
 * min, atada a ese enlace y ese correo). NUNCA el código de 6 dígitos y NUNCA
 * `localStorage`. Caduca a los 30 min (la vida de la ficha) y se borra al
 * reservar.
 *
 * TANDA L (punto 10 de Angel, orden expresa que REVIERTE la decisión H2 de la
 * revisión de seguridad de K2): también el NOMBRE y el TELÉFONO que la persona
 * ENVIÓ en «Tus datos» (no lo que está escribiendo), igual que lo demás: por
 * pestaña, 30 min, y por el traspaso a la pestaña nueva del mismo navegador.
 * Sin ellos, «Continuar mi reserva» pedía teclearlos otra vez tras verificar.
 * Vuelven a «Tus datos» ya escritos, NO reservan solos: tras verificar se marca
 * otra vez el aviso y se pulsa «Reservar cita» (revisión de seguridad de L4).
 * Se borran al reservar y al quedarse sin código ni ficha.
 * Riesgo que se acepta (`notas_l4.md` (b)): en un equipo compartido, quien abra
 * el mismo enlace con un `#codigo=` inventado mientras el código de otra
 * persona sigue vigente (10 min) recibe también su nombre y su teléfono, además
 * del correo que ya recibía. `sessionStorage` no es `localStorage`: la regla de
 * `secureStorage` de CLAUDE.md no aplica, y su cifrado tampoco protegería aquí
 * (sin sesión de Supabase, `secureStorage` guarda en claro en `localStorage`).
 *
 * Punto 9: el correo del código lleva «Continuar mi reserva» con el código en
 * el FRAGMENTO (`#codigo=123456`, no llega al servidor ni a sus registros). Un
 * correo se abre casi siempre en OTRA pestaña, que no ve el `sessionStorage`
 * de la primera: la pestaña nueva pregunta por `BroadcastChannel` (mismo
 * origen y mismo navegador; nada se guarda) y la que tenía la reserva a medias
 * le pasa lo suyo (sin la ficha; con nombre y teléfono desde la tanda L), en
 * memoria.
 */
import type { TurnoPagina } from './clienteReserva'

/** Lo que se guarda por pestaña. */
export interface Continuidad {
  consultorioId: string
  tipoId: string
  turno: TurnoPagina | null
  clientId: string
  /** El correo al que se mandó el último código, y cuándo (ms). */
  envio: { correo: string; en: number } | null
  /** Antes de este instante (ms) «Enviar otro código» cuenta hacia atrás. */
  reenviarDesde: number
  /** La ficha de /verificar: se reusa si la reserva falla después (antes se tiraba: «Pide un código primero»). */
  ficha: { valor: string; correo: string; hasta: number } | null
  /** Tanda L (punto 10): el nombre y el teléfono ENVIADOS en «Tus datos» (el correo es el de `envio`); null si aún no. */
  persona: { nombre: string; telefono: string } | null
}

/**
 * Lo que una pestaña le pasa a otra (punto 9): lo mismo que se guarda, SIN la ficha. Cualquier página
 * del mismo origen y navegador puede pedirlo (basta un `#codigo=` inventado): en un equipo compartido
 * no debe salir de aquí nada con lo que reservar sin el código del correo (revisión de seguridad de
 * K2). El nombre y el teléfono SÍ viajan desde la tanda L, por orden de Angel (ver la cabecera).
 */
export interface Traspaso { continuidad: Continuidad }

/** El código del correo vale 10 min (`reserva_codigo_emitir`, D3); la ficha, 30. */
export const VIDA_CODIGO_MS = 10 * 60_000
const VIDA_MS = 30 * 60_000
const ESPERA_TRASPASO_MS = 400

const clave = (codigo: string): string => `spinus.reserva.${codigo}`
const canal = (codigo: string): string => `spinus.reserva.${codigo}`

function esTurno(x: unknown): x is TurnoPagina {
  return typeof x === 'object' && x !== null && 'inicio' in x && 'fin' in x && typeof x.inicio === 'string' && typeof x.fin === 'string'
}

/**
 * El nombre y el teléfono guardados: null si no hay (o lo guardó una versión anterior, o están vacíos);
 * undefined si no tienen forma o se pasan de largo (120 el nombre, el tope de la base; 20 el teléfono).
 */
function leerPersona(x: unknown): Continuidad['persona'] | undefined {
  if (x === null || x === undefined) return null
  if (typeof x !== 'object' || !('nombre' in x) || !('telefono' in x)) return undefined
  const { nombre, telefono } = x
  if (typeof nombre !== 'string' || typeof telefono !== 'string' || nombre.length > 120 || telefono.length > 20) return undefined
  return nombre.trim() || telefono.trim() ? { nombre, telefono } : null
}

/** Valida por forma lo leído (puede venir de otra versión de la página o estar alterado). */
function leerContinuidad(x: unknown): Continuidad | null {
  if (typeof x !== 'object' || x === null) return null
  const o: Record<string, unknown> = { ...x }
  const envio = o.envio
  const ficha = o.ficha
  const okEnvio = envio === null || (typeof envio === 'object' && envio !== null && 'correo' in envio && 'en' in envio
    && typeof envio.correo === 'string' && typeof envio.en === 'number')
  const okFicha = ficha === null || (typeof ficha === 'object' && ficha !== null && 'valor' in ficha && 'correo' in ficha && 'hasta' in ficha
    && typeof ficha.valor === 'string' && typeof ficha.correo === 'string' && typeof ficha.hasta === 'number')
  if (typeof o.consultorioId !== 'string' || typeof o.tipoId !== 'string' || typeof o.clientId !== 'string'
    || typeof o.reenviarDesde !== 'number' || !(o.turno === null || esTurno(o.turno)) || !okEnvio || !okFicha) return null
  const persona = leerPersona(o.persona)
  if (persona === undefined) return null
  return {
    persona,
    consultorioId: o.consultorioId, tipoId: o.tipoId, turno: o.turno, clientId: o.clientId, reenviarDesde: o.reenviarDesde,
    envio: envio === null ? null : { correo: String(Reflect.get(envio, 'correo')), en: Number(Reflect.get(envio, 'en')) },
    ficha: ficha === null ? null : { valor: String(Reflect.get(ficha, 'valor')), correo: String(Reflect.get(ficha, 'correo')), hasta: Number(Reflect.get(ficha, 'hasta')) },
  }
}

/** Lo guardado de esta pestaña, o null (nada, caducado, roto o sin `sessionStorage`). */
export function recuperar(codigo: string, ahora = Date.now()): Continuidad | null {
  try {
    const crudo = sessionStorage.getItem(clave(codigo))
    const datos: unknown = crudo ? JSON.parse(crudo) : null
    const guardadoEn = typeof datos === 'object' && datos !== null && 'guardadoEn' in datos ? Number(datos.guardadoEn) : 0
    if (ahora - guardadoEn > VIDA_MS) { olvidar(codigo); return null }
    return leerContinuidad(datos)
  } catch {
    return null
  }
}

export function guardar(codigo: string, c: Continuidad): void {
  try { sessionStorage.setItem(clave(codigo), JSON.stringify({ ...c, guardadoEn: Date.now() })) } catch { /* sin almacenamiento: sólo en memoria */ }
}

export function olvidar(codigo: string): void {
  try { sessionStorage.removeItem(clave(codigo)) } catch { /* nada que borrar */ }
}

/**
 * El código del fragmento (`#codigo=123456`) y lo quita de la barra de
 * direcciones sin recargar (`history.replaceState`): no queda en el historial.
 */
export function codigoDelFragmento(): string | null {
  const m = /^#codigo=([0-9]{6})$/.exec(window.location.hash)
  if (!m?.[1]) return null
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
  return m[1]
}

/** La pestaña que tiene la reserva a medias contesta a las que la pidan. Devuelve cómo dejar de escuchar. */
export function atenderTraspasos(codigo: string, actual: () => Traspaso | null): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  const bc = new BroadcastChannel(canal(codigo))
  bc.onmessage = (ev: MessageEvent<unknown>) => {
    const t = ev.data === 'pide' ? actual() : null
    if (t) bc.postMessage({ traspaso: { continuidad: { ...t.continuidad, ficha: null } } })
  }
  return () => bc.close()
}

/** La pestaña nueva (la del correo) pide la reserva a medias; null si nadie contesta a tiempo. */
export function pedirTraspaso(codigo: string): Promise<Traspaso | null> {
  if (typeof BroadcastChannel === 'undefined') return Promise.resolve(null)
  return new Promise(resolver => {
    const bc = new BroadcastChannel(canal(codigo))
    const fin = (t: Traspaso | null) => { clearTimeout(reloj); bc.close(); resolver(t) }
    const reloj = setTimeout(() => fin(null), ESPERA_TRASPASO_MS)
    bc.onmessage = (ev: MessageEvent<unknown>) => {
      const d = ev.data
      const t = typeof d === 'object' && d !== null && 'traspaso' in d && typeof d.traspaso === 'object' && d.traspaso !== null ? d.traspaso : null
      const c = t && 'continuidad' in t ? leerContinuidad(t.continuidad) : null
      if (c) fin({ continuidad: { ...c, ficha: null } })
    }
    bc.postMessage('pide')
  })
}

export const correoLlave = (correo: string): string => correo.trim().toLowerCase()

/** K2 (punto 10): ¿sigue valiendo la ficha de /verificar para ese correo? (un uso, 30 min; la base lo vuelve a mirar). */
export function fichaPara(ficha: Continuidad['ficha'], correo: string, ahora = Date.now()): string | null {
  return ficha && ficha.correo === correoLlave(correo) && ficha.hasta > ahora ? ficha.valor : null
}

/** K2: ¿hay un código pedido para ese correo que todavía no vence? Entonces no se pide otro. */
export function codigoPendiente(envio: Continuidad['envio'], correo: string, ahora = Date.now()): boolean {
  return envio !== null && correoLlave(envio.correo) === correoLlave(correo) && ahora - envio.en < VIDA_CODIGO_MS
}

/** Al restaurar: con la ficha vigente, a «Tus datos» (ya verificado); con un código pendiente, a escribirlo. */
export function pasoAlRestaurar(g: Continuidad, ahora = Date.now()): { paso: 'codigo' | 'datos'; verificado: boolean } {
  const verificado = g.envio !== null && fichaPara(g.ficha, g.envio.correo, ahora) !== null
  return { paso: g.envio && !verificado && codigoPendiente(g.envio, g.envio.correo, ahora) ? 'codigo' : 'datos', verificado }
}
