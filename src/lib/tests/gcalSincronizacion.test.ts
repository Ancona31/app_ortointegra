/**
 * El orquestador de la sincronización de vuelta (bloque C, paso C4) contra un
 * Google SIMULADO: `vi.mock('googleapis')` con un `events.list` guionado. Nada
 * sale a la red ni toca una cuenta real.
 *
 * La base también es un doble (en memoria) de `gcalSincronizacionBase`: lo que
 * se prueba aquí es el BUCLE —paginación, token, 410, candado, presupuesto,
 * errores por evento— y que cada decisión llegue a la RPC que toca. Las RPC de
 * verdad se prueban contra la base local, con rollback, en
 * `supabase/pruebas-sql/c1_*.sql`, `c2_*.sql` y `c4_gcal_flujo.sql`.
 *
 * Al final, la capa de base REAL (`importActual`) con un cliente de servicio
 * falso: valida el uuid de la clínica, manda `p_clinica_id` y tolera que la
 * migración no exista (PGRST202) sin lanzar un error cualquiera.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { calendar_v3 } from 'googleapis'
import type { Aplicacion, Candado } from '@/lib/gcalSincronizacionBase'
import type { DatosImportar, FilaEspejo } from '@/lib/gcalSincronizacionDecidir'
import type { ConexionGoogle } from '@/lib/gcalConexion'

type Lista = calendar_v3.Schema$Events
type Params = calendar_v3.Params$Resource$Events$List

const CLINICA = '33333333-3333-4333-8333-333333333333'
const DUENO = '44444444-4444-4444-8444-444444444444'
const CAL = 'cal-spinus@group.calendar.google.com'
const CITA = '22222222-2222-4222-8222-222222222222'

/* ── Estado compartido de los dobles ───────────────────────────────────── */
const h = vi.hoisted(() => {
  const estado = {
    guion: [] as Array<(p: unknown) => unknown>,
    llamadas: [] as unknown[],
    /** D11: el segundo argumento de cada `events.list` (la señal). */
    opcionesLista: [] as unknown[],
    calendarioRegistrado: 'cal-spinus@group.calendar.google.com' as string | null,
    insertCalendario: 0,
    /** C5: los `events.patch` del restablecimiento, con sus opciones (If-Match). */
    parches: [] as Array<{ params: unknown; opciones: unknown }>,
    patchFalla: null as number | Error | null,
    rpc: { data: null as unknown, error: null as { code: string; message: string } | null, args: [] as unknown[], status: undefined as number | undefined },
  }
  return { estado }
})

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: class {
        setCredentials(): void {}
        async refreshAccessToken(): Promise<{ credentials: Record<string, never> }> { return { credentials: {} } }
      },
    },
    calendar: () => ({
      events: {
        list: async (p: unknown, opciones?: unknown) => {
          h.estado.llamadas.push(p)
          h.estado.opcionesLista.push(opciones)
          const paso = h.estado.guion.shift()
          if (!paso) throw new Error('guion agotado')
          return { data: paso(p) }
        },
        patch: async (params: unknown, opciones: unknown) => {
          h.estado.parches.push({ params, opciones })
          const f = h.estado.patchFalla
          if (f instanceof Error) throw f
          if (f) throw Object.assign(new Error(`HTTP ${f}`), { code: f })
          return { data: { etag: '"e3"' } }
        },
      },
      calendars: {
        get: async () => ({ data: {} }),
        insert: async () => { h.estado.insertCalendario += 1; return { data: { id: 'nuevo' } } },
        delete: async () => ({}),
      },
    }),
  },
}))
vi.mock('@/lib/encrypt', () => ({ decrypt: (s: string) => s, encrypt: (s: string) => s }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: async (nombre: string, args: unknown) => {
      h.estado.rpc.args.push({ nombre, args })
      return { data: h.estado.rpc.data, error: h.estado.rpc.error, status: h.estado.rpc.status }
    },
  }),
}))
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn(async () => undefined) }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn() }))
vi.mock('@/lib/gcalConexion', () => ({
  leerConexionConSecretos: async () => ({
    fila: {
      conexionId: 'conexion-1', clinicaId: CLINICA, userId: DUENO, rol: 'clinica', estado: 'activa',
      calendarId: h.estado.calendarioRegistrado, tieneSecretos: true, accessToken: 'a', refreshToken: 'r',
      expiresAt: Date.now() + 3_600_000,
    },
    error: null,
  }),
  guardarSecretos: async () => undefined,
  guardarCalendarIdSiEsperado: async () => true,
  releerCalendarId: async () => null,
  marcarRevocada: async () => undefined,
}))

/* ── El doble de la base: candado, token y filas en memoria ────────────── */
const db = vi.hoisted(() => ({
  fase: 'completa' as 'completa' | 'incremental',
  syncToken: null as string | null,
  pageToken: null as string | null,
  ventana: null as string | null,
  candado: null as string | null,
  ocupado: false,
  habilitada: true,
  noDisponible: false,
  noDisponibleC2: false,
  soltados: [] as Array<string | null>,
  reinicios: 0,
  filas: [] as FilaEspejo[],
  aplicadas: [] as Aplicacion[],
  importadas: [] as DatosImportar[],
  fallarAplicar: new Set<string>(),
  /** Oleada 3, arreglo 3: el error (de la capa de base REAL) con que falla `aplicarEvento`. */
  errorAplicar: null as unknown,
  /** Tanda I, punto 9: la base rechaza (candado de la cita por enlace) lo que cambia contenido. */
  rechazarAplicar: new Set<string>(),
  aplicarDevuelve: 1,
  /** E9: las llamadas a `confirmarPorRsvp` y lo que devuelve (o lanza). */
  rsvps: [] as Array<{ citaId: string; eventId: string; aceptaron: string[] }>,
  rsvpDevuelve: true as boolean | 'lanza',
  /** D11: las llamadas a `registrarEmpalmesReserva` y su comportamiento. */
  empalmes: [] as string[][],
  empalmesFalla: null as null | 'lanza' | 'ausente',
  /** W: cuántas de las próximas llamadas fallan antes de funcionar. */
  empalmesFallan: 0,
  /** W: la lectura del espejo falla a media página (la sonda vacía del principio, no). */
  espejoFalla: false,
  /** Tanda J, punto 10: las llamadas a `registrarMovimientoRechazado` y su comportamiento. */
  movimientos: [] as { citaId: string; actualizado: string }[],
  movimientosFalla: null as null | 'lanza' | 'ausente',
}))

vi.mock('@/lib/gcalSincronizacionBase', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/gcalSincronizacionBase')>()
  return {
    ...real,
    tomarCandado: async (): Promise<Candado | null> => {
      if (db.noDisponible) throw new real.SincronizacionNoDisponible('gcal_sync_tomar')
      if (db.ocupado || db.candado) return null
      db.candado = `candado-${Math.random()}`
      return { candado: db.candado, fase: db.fase, syncToken: db.syncToken, pageToken: db.pageToken, ventanaDesde: db.ventana }
    },
    clinicaHabilitada: async () => db.habilitada,
    avanzarPagina: async (_c: string, a: { candado: string; siguiente: { pageToken: string } | { syncToken: string }; ventanaDesde: string | null }) => {
      if (a.candado !== db.candado) return false
      if (db.fase === 'completa') db.ventana = db.ventana ?? a.ventanaDesde
      if ('pageToken' in a.siguiente) { db.pageToken = a.siguiente.pageToken; return true }
      db.syncToken = a.siguiente.syncToken; db.pageToken = null; db.fase = 'incremental'; db.candado = null
      return true
    },
    reiniciarToken: async (_c: string, candado: string) => {
      if (candado !== db.candado) return false
      db.reinicios += 1; db.fase = 'completa'; db.syncToken = null; db.pageToken = null; db.ventana = null
      return true
    },
    soltarCandado: async (_c: string, candado: string, error: string | null) => {
      if (candado !== db.candado) return false
      db.soltados.push(error); db.candado = null
      return true
    },
    citasDeEventos: async (_c: string, ids: string[], marcas: string[]) => {
      if (db.noDisponibleC2) throw new real.SincronizacionNoDisponible('gcal_citas_por_evento')
      if (db.espejoFalla && ids.length + marcas.length > 0) throw new Error('la base falló')
      return db.filas.filter((f) => (f.googleEventId && ids.includes(f.googleEventId)) || marcas.includes(f.id))
    },
    aplicarEvento: async (_c: string, _cal: string, a: Aplicacion) => {
      if (db.fallarAplicar.has(a.citaId)) throw new Error('la base falló')
      if (db.errorAplicar) throw db.errorAplicar
      if (db.rechazarAplicar.has(a.citaId) && Object.keys(a.cambios).length > 0) throw new real.CambioRechazadoPorLaBase('gcal_aplicar_evento')
      db.aplicadas.push(a)
      return db.aplicarDevuelve
    },
    /* El «No» (avisos globales): aquí la base no tiene M2 → no hace nada. Lo suyo se prueba en `gcalRsvpRechazo.test.ts`. */
    rechazarPorRsvp: async () => null,
    confirmarPorRsvp: async (_c: string, _cal: string, citaId: string, eventId: string, aceptaron: string[]) => {
      db.rsvps.push({ citaId, eventId, aceptaron })
      if (db.rsvpDevuelve === 'lanza') throw new Error('la base falló')
      return db.rsvpDevuelve
    },
    registrarEmpalmesReserva: async (_c: string, ids: string[]) => {
      db.empalmes.push(ids)
      if (db.empalmesFalla === 'ausente') throw new real.SincronizacionNoDisponible('reserva_empalmes_registrar')
      if (db.empalmesFalla === 'lanza') throw new Error('la base falló')
      if (db.empalmesFallan > 0) { db.empalmesFallan -= 1; throw new Error('la base falló') }
      return 1
    },
    registrarMovimientoRechazado: async (_c: string, citaId: string, actualizado: string) => {
      db.movimientos.push({ citaId, actualizado })
      if (db.movimientosFalla === 'ausente') throw new real.SincronizacionNoDisponible('cita_movimiento_google_registrar')
      if (db.movimientosFalla === 'lanza') throw new Error('la base falló')
      return true
    },
    importarEvento: async (_c: string, _cal: string, d: DatosImportar) => {
      db.importadas.push(d)
      return '55555555-5555-4555-8555-555555555555'
    },
  }
})

import { sincronizarClinica, type OpcionesSincronizacion } from '@/lib/gcalSincronizacion'
import { logAudit } from '@/lib/audit'
import { captureMessage } from '@sentry/nextjs'
import { beforeSend } from '@/lib/sentryPiiFilter'

const conexion: ConexionGoogle = {
  id: 'conexion-1', clinicaId: CLINICA, userId: DUENO, rol: 'clinica', calendarId: CAL, estado: 'activa', googleAccountEmail: null,
}
const AHORA = Date.parse('2031-06-01T00:00:00Z')
const op: OpcionesSincronizacion = { actorId: 'prueba', presupuestoMs: 8000, leaseSeg: 60, minIntervaloSeg: 60, ahora: () => AHORA }

function fila(cambios: Partial<FilaEspejo> = {}): FilaEspejo {
  return {
    id: CITA, googleEventId: 'ev1', gcalCalendarId: CAL, gcalEtag: '"e1"', gcalSyncStatus: 'synced', origen: 'spinus',
    status: 'scheduled', inicio: '2031-06-06T16:00:00+00:00', fin: '2031-06-06T17:00:00+00:00', todoElDia: false,
    zona: 'America/Mexico_City', updatedAt: '2031-05-01T00:00:00.123456+00:00', conPaciente: false,
    tituloSinPaciente: 'Junta', notasDeGoogle: null, paciente: null, ...cambios,
  }
}
function evento(cambios: calendar_v3.Schema$Event = {}): calendar_v3.Schema$Event {
  return {
    id: 'ev1', etag: '"e2"', status: 'confirmed', updated: '2031-05-20T00:00:00Z', summary: 'Junta',
    start: { dateTime: '2031-06-06T12:00:00-06:00' }, end: { dateTime: '2031-06-06T13:00:00-06:00' }, ...cambios,
  }
}
const nuevo = evento({ id: 'nuevo', summary: 'Cirugía', start: { dateTime: '2031-06-07T08:00:00-06:00' }, end: { dateTime: '2031-06-07T10:00:00-06:00' } })
function pagina(items: calendar_v3.Schema$Event[], fin: { nextPageToken?: string; nextSyncToken?: string }): (p: unknown) => Lista {
  return () => ({ items, timeZone: 'America/Mexico_City', ...fin })
}
function errorHttp(code: number): (p: unknown) => never {
  return () => { throw Object.assign(new Error(`HTTP ${code}`), { code }) }
}
const llamadas = (): Params[] => h.estado.llamadas as Params[]

beforeEach(() => {
  Object.assign(db, {
    fase: 'completa', syncToken: null, pageToken: null, ventana: null, candado: null, ocupado: false, habilitada: true,
    noDisponible: false, noDisponibleC2: false, soltados: [], reinicios: 0, filas: [fila()], aplicadas: [], importadas: [], fallarAplicar: new Set(), errorAplicar: null, rechazarAplicar: new Set(),
    aplicarDevuelve: 1, rsvps: [], rsvpDevuelve: true, empalmes: [], empalmesFalla: null, empalmesFallan: 0, espejoFalla: false, movimientos: [], movimientosFalla: null,
  })
  Object.assign(h.estado, { guion: [], llamadas: [], opcionesLista: [], calendarioRegistrado: CAL, insertCalendario: 0, parches: [], patchFalla: null })
  h.estado.rpc = { data: null, error: null, args: [], status: undefined }
  vi.mocked(logAudit).mockClear()
  vi.mocked(captureMessage).mockClear()
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('paginación y token', () => {
  it('completa en dos páginas: la MISMA ventana, nunca syncToken, y el token sólo al final', async () => {
    h.estado.guion = [pagina([nuevo], { nextPageToken: 'p2' }), pagina([evento()], { nextSyncToken: 'tok-1' })]
    const r = await sincronizarClinica(conexion, op)
    expect(r).toMatchObject({ estado: 'ok', paginas: 2, cambios: 2, errores: 0 })
    const [a, b] = llamadas()
    expect(a).toMatchObject({ calendarId: CAL, timeMin: '2031-05-02T00:00:00.000Z', showDeleted: true, singleEvents: false, maxResults: 250 })
    expect(b).toMatchObject({ timeMin: a.timeMin, pageToken: 'p2' })
    expect(llamadas().some((p) => 'syncToken' in p)).toBe(false)
    expect(db).toMatchObject({ fase: 'incremental', syncToken: 'tok-1', pageToken: null, candado: null, ventana: a.timeMin })
    expect(db.importadas).toHaveLength(1)
    // El comparar-y-cambiar recibe el updated_at TAL CUAL (microsegundos).
    expect(db.aplicadas[0]).toMatchObject({ citaId: CITA, esperadoUpdatedAt: '2031-05-01T00:00:00.123456+00:00' })
  })

  it('incremental: syncToken y nada de timeMin', async () => {
    Object.assign(db, { fase: 'incremental', syncToken: 'tok-1', ventana: '2031-05-02T00:00:00.000Z' })
    h.estado.guion = [pagina([], { nextSyncToken: 'tok-2' })]
    expect(await sincronizarClinica(conexion, op)).toMatchObject({ estado: 'ok', paginas: 1 })
    expect(llamadas()[0]).toMatchObject({ syncToken: 'tok-1' })
    expect(llamadas()[0]).not.toHaveProperty('timeMin')
    expect(db.syncToken).toBe('tok-2')
  })

  it('410: reinicia y hace la completa en la misma pasada, y guarda el token nuevo', async () => {
    Object.assign(db, { fase: 'incremental', syncToken: 'muerto', ventana: '2031-01-01T00:00:00.000Z' })
    h.estado.guion = [errorHttp(410), pagina([nuevo], { nextSyncToken: 'tok-nuevo' })]
    expect(await sincronizarClinica(conexion, op)).toMatchObject({ estado: 'ok', cambios: 1 })
    expect(db.reinicios).toBe(1)
    expect(llamadas()[1]).toMatchObject({ timeMin: '2031-05-02T00:00:00.000Z' })
    expect(llamadas()[1]).not.toHaveProperty('syncToken')
    expect(db).toMatchObject({ syncToken: 'tok-nuevo', fase: 'incremental' })
  })

  it('410 dos veces: error, y suelta con un código fijo', async () => {
    Object.assign(db, { fase: 'incremental', syncToken: 'muerto' })
    h.estado.guion = [errorHttp(410), errorHttp(410)]
    expect(await sincronizarClinica(conexion, op)).toMatchObject({ estado: 'error' })
    expect(db.soltados).toEqual(['google_410'])
  })

  it('una página guardada que Google ya no reconoce (400): vuelve a empezar sin ella, una vez', async () => {
    Object.assign(db, { pageToken: 'caducada', ventana: '2031-05-02T00:00:00.000Z' })
    h.estado.guion = [errorHttp(400), pagina([], { nextSyncToken: 'tok' })]
    expect(await sincronizarClinica(conexion, op)).toMatchObject({ estado: 'ok' })
    expect(llamadas()[0]).toMatchObject({ pageToken: 'caducada' })
    expect(llamadas()[1]).not.toHaveProperty('pageToken')
  })

  it('presupuesto agotado: suelta SIN error, la página queda; la pasada siguiente sigue desde ella', async () => {
    let t = AHORA
    const reloj = (): number => t
    h.estado.guion = [(p) => { t += 10_000; return pagina([nuevo], { nextPageToken: 'p2' })(p) }]
    expect(await sincronizarClinica(conexion, { ...op, ahora: reloj })).toMatchObject({ estado: 'parcial', paginas: 1 })
    expect(db).toMatchObject({ pageToken: 'p2', candado: null, soltados: [null] })
    const ventana = llamadas()[0].timeMin
    h.estado.guion = [pagina([], { nextSyncToken: 'tok' })]
    expect(await sincronizarClinica(conexion, { ...op, ahora: reloj })).toMatchObject({ estado: 'ok' })
    expect(llamadas()[1]).toMatchObject({ pageToken: 'p2', timeMin: ventana })
  })
})

describe('candado, interruptor y tolerancia', () => {
  it('candado ocupado (o interruptor apagado): cero llamadas a Google', async () => {
    db.ocupado = true
    expect(await sincronizarClinica(conexion, op)).toMatchObject({ estado: 'omitida' })
    expect(llamadas()).toHaveLength(0)
  })

  it('migración ausente: no_disponible, sin lanzar y sin Google', async () => {
    db.noDisponible = true
    await expect(sincronizarClinica(conexion, op)).resolves.toMatchObject({ estado: 'no_disponible' })
    expect(llamadas()).toHaveLength(0)
  })

  it('C1 aplicada y C2 no: no_disponible, candado suelto sin error y sin Google', async () => {
    db.noDisponibleC2 = true
    h.estado.guion = [pagina([evento()], { nextSyncToken: 't' })]
    await expect(sincronizarClinica(conexion, op)).resolves.toMatchObject({ estado: 'no_disponible' })
    expect(llamadas()).toHaveLength(0)
    expect(db).toMatchObject({ candado: null, soltados: [null] })
  })

  it('clínica sin acceso (S3): suelta con sin_acceso y no llama a Google', async () => {
    db.habilitada = false
    expect(await sincronizarClinica(conexion, op)).toMatchObject({ estado: 'sin_acceso' })
    expect(db.soltados).toEqual(['sin_acceso'])
    expect(llamadas()).toHaveLength(0)
  })

  it('conexión sin calendario: ni candado ni Google', async () => {
    expect(await sincronizarClinica({ ...conexion, calendarId: null }, op)).toMatchObject({ estado: 'omitida' })
    expect(db.candado).toBeNull()
  })

  it('puedeReparar: false — sin calendario registrado no se crea uno', async () => {
    h.estado.calendarioRegistrado = null
    expect(await sincronizarClinica(conexion, op)).toMatchObject({ estado: 'error' })
    expect(h.estado.insertCalendario).toBe(0)
    expect(llamadas()).toHaveLength(0)
    expect(db.soltados).toEqual(['sin_calendario'])
  })

  it('el calendario registrado ya no es el de la conexión: suelta sin leer', async () => {
    h.estado.calendarioRegistrado = 'otro@group.calendar.google.com'
    expect(await sincronizarClinica(conexion, op)).toMatchObject({ estado: 'error' })
    expect(db.soltados).toEqual(['calendario_cambio'])
    expect(llamadas()).toHaveLength(0)
  })
})

describe('cada decisión llega a su RPC', () => {
  it('borrado con sólo el id: cancela y desvincula', async () => {
    h.estado.guion = [pagina([{ id: 'ev1', status: 'cancelled' }], { nextSyncToken: 't' })]
    await sincronizarClinica(conexion, op)
    expect(db.aplicadas).toEqual([expect.objectContaining({ citaId: CITA, desvincular: true, etag: null, cambios: { cancelar: true } })])
  })

  it('eco (mismo etag): no escribe nada', async () => {
    h.estado.guion = [pagina([evento({ etag: '"e1"' })], { nextSyncToken: 't' })]
    expect(await sincronizarClinica(conexion, op)).toMatchObject({ estado: 'ok', cambios: 0 })
    expect(db.aplicadas).toHaveLength(0)
  })

  it('recurrente: ni se importa ni se aplica', async () => {
    h.estado.guion = [pagina([evento({ id: 'serie', recurrence: ['RRULE:FREQ=WEEKLY'] })], { nextSyncToken: 't' })]
    await sincronizarClinica(conexion, op)
    expect(db.importadas).toHaveLength(0)
    expect(db.aplicadas).toHaveLength(0)
  })

  it('C-e: una attended movida en Google se rechaza, se audita y se marca para restablecer', async () => {
    db.filas = [fila({ status: 'attended' })]
    h.estado.guion = [pagina([evento()], { nextSyncToken: 't' })]
    const r = await sincronizarClinica(conexion, op)
    expect(r.restablecer).toEqual([CITA])
    // C5: nada de contenido se aplica; sólo se guarda el etag del restablecimiento.
    expect(db.aplicadas).toEqual([expect.objectContaining({ citaId: CITA, etag: '"e3"', cambios: {}, vincular: null, desvincular: false })])
    expect(vi.mocked(logAudit)).toHaveBeenCalledWith(expect.objectContaining({
      accion: 'gcal_cambio_rechazado', registroId: CITA, userId: DUENO, tabla: 'appointments',
    }))
    const desc = JSON.parse(vi.mocked(logAudit).mock.calls[0][0].descripcion ?? '{}')
    expect(desc).toEqual({ clinica: CLINICA, gana: 'spinus', motivo: 'estado_cerrado', campos: ['hora'], via: 'sondeo', origen: 'sistema' })
  })

  it('conflicto: gana Google sobre una escritura de Spinus pendiente, y se audita', async () => {
    db.filas = [fila({ gcalSyncStatus: 'failed' })]
    h.estado.guion = [pagina([evento()], { nextSyncToken: 't' })]
    await sincronizarClinica(conexion, op)
    expect(db.aplicadas).toHaveLength(1)
    expect(vi.mocked(logAudit)).toHaveBeenCalledWith(expect.objectContaining({ accion: 'gcal_conflicto_cita' }))
  })

  it('conflicto: gana Spinus (más reciente) y no se aplica', async () => {
    db.filas = [fila({ updatedAt: '2031-05-25T00:00:00+00:00' })]
    h.estado.guion = [pagina([evento()], { nextSyncToken: 't' })]
    const r = await sincronizarClinica(conexion, op)
    expect(db.aplicadas.filter((a) => Object.keys(a.cambios).length > 0)).toHaveLength(0)
    expect(r.restablecer).toEqual([CITA])
    expect(h.estado.parches).toHaveLength(1)
  })

  it('comparar-y-cambiar que no prende (n = 0): ni auditoría ni restablecer', async () => {
    db.filas = [fila({ conPaciente: true, tituloSinPaciente: null, paciente: { nombre: 'Ana', apellidos: 'Pérez' } })]
    h.estado.guion = [pagina([evento({ summary: 'Otra' })], { nextSyncToken: 't' })]
    db.aplicarDevuelve = 0
    const r = await sincronizarClinica(conexion, op)
    expect(r.restablecer).toEqual([])
    expect(vi.mocked(logAudit)).not.toHaveBeenCalled()
  })

  it('I, punto 9: lo que la BASE rechaza (cita por enlace movida en Google) se audita y se restablece, sin contar error', async () => {
    db.filas = [fila({ conPaciente: true, tituloSinPaciente: null, paciente: { nombre: 'Ana', apellidos: 'Pérez' } })]
    db.rechazarAplicar.add(CITA)
    h.estado.guion = [pagina([evento({ summary: 'Ana Pérez' })], { nextSyncToken: 't' })]
    const r = await sincronizarClinica(conexion, op)
    expect(r).toMatchObject({ estado: 'ok', errores: 0, cambios: 0 })
    expect(r.restablecer).toEqual([CITA])
    expect(h.estado.parches).toHaveLength(1)
    const desc = JSON.parse(vi.mocked(logAudit).mock.calls.find(c => c[0].accion === 'gcal_cambio_rechazado')?.[0].descripcion ?? '{}')
    expect(desc).toMatchObject({ gana: 'spinus', motivo: 'eleccion_paciente', campos: ['hora'] })
  })

  /* Tanda J, punto 10 · el rechazo deja el aviso de la campana con el `updated` del evento
     (la base deduplica por él). Mutación en rojo: quitar la llamada a
     `avisarMovimientoRechazado` de `aplicarORechazar`. */
  it('J, punto 10: el rechazo registra el intento con el `updated` del evento; lo aplicado no', async () => {
    db.filas = [fila({ conPaciente: true, tituloSinPaciente: null, paciente: { nombre: 'Ana', apellidos: 'Pérez' } })]
    db.rechazarAplicar.add(CITA)
    h.estado.guion = [pagina([evento({ summary: 'Ana Pérez' })], { nextSyncToken: 't' })]
    await sincronizarClinica(conexion, op)
    expect(db.movimientos).toEqual([{ citaId: CITA, actualizado: '2031-05-20T00:00:00Z' }])
    db.rechazarAplicar.clear()
    h.estado.guion = [pagina([evento({ summary: 'Ana Pérez', updated: '2031-05-21T00:00:00Z' })], { nextSyncToken: 't2' })]
    await sincronizarClinica(conexion, op)
    expect(db.movimientos).toHaveLength(1)
  })

  it('J, punto 10: si el aviso falla, cuenta un error y la página avanza; sin la migración, nada', async () => {
    db.filas = [fila({ conPaciente: true, tituloSinPaciente: null, paciente: { nombre: 'Ana', apellidos: 'Pérez' } })]
    db.rechazarAplicar.add(CITA)
    db.movimientosFalla = 'lanza'
    h.estado.guion = [pagina([evento({ summary: 'Ana Pérez' })], { nextSyncToken: 't' })]
    expect(await sincronizarClinica(conexion, op)).toMatchObject({ estado: 'ok', errores: 1, restablecer: [CITA] })
    expect(db.syncToken).toBe('t')
    db.movimientosFalla = 'ausente'
    h.estado.guion = [pagina([evento({ summary: 'Ana Pérez' })], { nextSyncToken: 't2' })]
    expect(await sincronizarClinica(conexion, op)).toMatchObject({ estado: 'ok', errores: 0 })
  })

  it('un evento que falla no tumba la página', async () => {
    db.fallarAplicar.add(CITA)
    h.estado.guion = [pagina([evento(), nuevo], { nextSyncToken: 't' })]
    expect(await sincronizarClinica(conexion, op)).toMatchObject({ estado: 'ok', errores: 1, cambios: 1 })
    expect(db.syncToken).toBe('t')
  })

  it('la marca de Spinus liga una cita que aún no tenía evento', async () => {
    db.filas = [fila({ googleEventId: null, gcalEtag: null })]
    const marcado = evento({ id: 'ev-nuevo', extendedProperties: { private: { spinus_cita: CITA } } })
    h.estado.guion = [pagina([marcado], { nextSyncToken: 't' })]
    await sincronizarClinica(conexion, op)
    expect(db.aplicadas).toEqual([expect.objectContaining({ citaId: CITA, vincular: 'ev-nuevo' })])
    expect(db.importadas).toHaveLength(0)
  })
})

describe('la capa de base real', () => {
  it('J, punto 10: registrarMovimientoRechazado manda clínica, cita y `updated`, y valida lo que vuelve', async () => {
    const real = await vi.importActual<typeof import('@/lib/gcalSincronizacionBase')>('@/lib/gcalSincronizacionBase')
    await expect(real.registrarMovimientoRechazado(CLINICA, CITA, 'no-es-fecha')).rejects.toThrow()
    h.estado.rpc.data = true
    await expect(real.registrarMovimientoRechazado(CLINICA, CITA, '2031-05-20T00:00:00Z')).resolves.toBe(true)
    expect(h.estado.rpc.args.at(-1)).toEqual({ nombre: 'cita_movimiento_google_registrar',
      args: { p_clinica_id: CLINICA, p_cita_id: CITA, p_google_updated: '2031-05-20T00:00:00Z' } })
    h.estado.rpc.error = { code: 'PGRST202', message: 'Could not find the function' }
    await expect(real.registrarMovimientoRechazado(CLINICA, CITA, '2031-05-20T00:00:00Z')).rejects.toBeInstanceOf(real.SincronizacionNoDisponible)
  })

  it('valida la clínica, manda p_clinica_id y traduce una RPC ausente', async () => {
    const real = await vi.importActual<typeof import('@/lib/gcalSincronizacionBase')>('@/lib/gcalSincronizacionBase')
    await expect(real.clinicaHabilitada('no-es-uuid')).rejects.toThrow(/uuid/)
    expect(h.estado.rpc.args).toHaveLength(0)
    h.estado.rpc.data = true
    await expect(real.clinicaHabilitada(CLINICA)).resolves.toBe(true)
    expect(h.estado.rpc.args[0]).toEqual({ nombre: 'gcal_sync_clinica_habilitada', args: { p_clinica_id: CLINICA } })
    h.estado.rpc.error = { code: 'PGRST202', message: 'Could not find the function' }
    await expect(real.tomarCandado(CLINICA, { conexionId: 'x', calendarId: CAL, leaseSeg: 60, minIntervaloSeg: 60 }))
      .rejects.toBeInstanceOf(real.SincronizacionNoDisponible)
    h.estado.rpc.error = { code: '42501', message: 'permission denied' }
    await expect(real.citasDeEventos(CLINICA, ['ev1'], [])).rejects.toThrow(/42501/)
    await expect(real.citasDeEventos(CLINICA, ['ev1'], [])).rejects.not.toBeInstanceOf(real.CambioRechazadoPorLaBase)
    // Tanda I, punto 9: SÓLO el 42501 del candado de la cita por enlace es un cambio rechazado.
    h.estado.rpc.error = { code: '42501', message: 'El consultorio, el día y la hora de una cita reservada por enlace sólo cambian con «Reagendar»' }
    await expect(real.citasDeEventos(CLINICA, ['ev1'], [])).rejects.toBeInstanceOf(real.CambioRechazadoPorLaBase)
  })

  it('valida con Zod lo que devuelve el espejo', async () => {
    const real = await vi.importActual<typeof import('@/lib/gcalSincronizacionBase')>('@/lib/gcalSincronizacionBase')
    h.estado.rpc.data = [{ r_id: CITA, r_status: 'inventado' }]
    await expect(real.citasDeEventos(CLINICA, ['ev1'], [])).rejects.toThrow()
  })

  it('listarConexionesParaSincronizar tolera la RPC ausente y no inventa filas', async () => {
    const conexiones = await vi.importActual<typeof import('@/lib/gcalConexion')>('@/lib/gcalConexion')
    h.estado.rpc.error = { code: 'PGRST202', message: 'Could not find the function' }
    await expect(conexiones.listarConexionesParaSincronizar(20)).resolves.toEqual([])
    h.estado.rpc.error = null
    h.estado.rpc.data = [
      { r_conexion_id: CITA, r_clinica_id: CLINICA, r_user_id: DUENO, r_calendar_id: CAL, r_google_account_email: null },
      { r_conexion_id: 7 },
      { r_conexion_id: 'no-uuid', r_clinica_id: CLINICA, r_user_id: DUENO, r_calendar_id: CAL, r_google_account_email: null },
    ]
    await expect(conexiones.listarConexionesParaSincronizar(20)).resolves.toEqual([
      { id: CITA, clinicaId: CLINICA, userId: DUENO, rol: 'clinica', calendarId: CAL, estado: 'activa', googleAccountEmail: null },
    ])
  })
})

describe('C5 · restablecer en Google lo rechazado', () => {
  it('attended movida en Google: patch con la hora de Spinus, confirmed, color, marca e If-Match; sin descripción', async () => {
    db.filas = [fila({ status: 'attended' })]
    h.estado.guion = [pagina([evento()], { nextSyncToken: 't' })]
    const r = await sincronizarClinica(conexion, op)
    expect(r.errores).toBe(0)
    expect(h.estado.parches).toHaveLength(1)
    const { params, opciones } = h.estado.parches[0] as { params: calendar_v3.Params$Resource$Events$Patch; opciones: { headers: Record<string, string> } }
    expect(opciones).toEqual({ headers: { 'If-Match': '"e2"' } })
    expect(params).toMatchObject({ calendarId: CAL, eventId: 'ev1', sendUpdates: 'none' })
    expect(params.requestBody).toMatchObject({
      summary: 'Junta', status: 'confirmed', colorId: '8',
      start: { dateTime: '2031-06-06T16:00:00+00:00', date: null }, end: { dateTime: '2031-06-06T17:00:00+00:00', date: null },
      extendedProperties: { private: { spinus_cita: CITA, spinus_v: '2' } },
    })
    expect(params.requestBody).not.toHaveProperty('description')
  })

  it('cancelada borrada en Google: se restaura con «CANCELADA — » (status confirmed)', async () => {
    db.filas = [fila({ status: 'cancelled' })]
    h.estado.guion = [pagina([{ id: 'ev1', etag: '"e9"', status: 'cancelled' }], { nextSyncToken: 't' })]
    await sincronizarClinica(conexion, op)
    const { params } = h.estado.parches[0] as { params: calendar_v3.Params$Resource$Events$Patch }
    expect(params.requestBody).toMatchObject({ summary: 'CANCELADA — Junta', status: 'confirmed', colorId: '11' })
  })

  it('C-d: el título de una cita con paciente vuelve al de Spinus aunque la hora se acepte', async () => {
    db.filas = [fila({ conPaciente: true, tituloSinPaciente: null, paciente: { nombre: 'Ana', apellidos: 'Pérez' } })]
    h.estado.guion = [pagina([evento({ summary: 'Otra cosa', start: { dateTime: '2031-06-06T14:00:00-06:00' }, end: { dateTime: '2031-06-06T15:00:00-06:00' } })], { nextSyncToken: 't' })]
    await sincronizarClinica(conexion, op)
    expect(db.aplicadas[0].cambios).toHaveProperty('puntas')
    const { params } = h.estado.parches[0] as { params: calendar_v3.Params$Resource$Events$Patch }
    expect(String(params.requestBody?.summary)).toContain('Ana Pérez')
  })

  it('412 al restablecer: no se guarda etag ni cuenta como error (la pasada siguiente decide)', async () => {
    db.filas = [fila({ status: 'attended' })]
    h.estado.patchFalla = 412
    h.estado.guion = [pagina([evento()], { nextSyncToken: 't' })]
    const r = await sincronizarClinica(conexion, op)
    expect(r).toMatchObject({ estado: 'ok', errores: 0 })
    expect(db.aplicadas).toHaveLength(0)
  })

  /* Tanda J, punto 9 · Google no responde al restablecer (5xx): la página NO avanza y la
     pasada siguiente la repite y restablece. Mutación en rojo: quitar el `throw new
     RestablecimientoPendiente()` de `procesarPagina` (la página avanzaba y Google se quedaba
     con la hora movida: la segunda pasada no veía el evento). */
  it('Google no responde al restablecer (5xx): la página no avanza y la pasada siguiente restablece', async () => {
    db.filas = [fila({ status: 'attended' })]
    h.estado.patchFalla = 500
    h.estado.guion = [pagina([evento()], { nextSyncToken: 't' })]
    const r = await sincronizarClinica(conexion, op)
    expect(r).toMatchObject({ estado: 'error', errores: 1 })
    expect(db.syncToken).toBeNull()
    expect(db.soltados).toEqual(['google_restablecer'])
    h.estado.patchFalla = null
    h.estado.guion = [pagina([evento()], { nextSyncToken: 't' })]
    const r2 = await sincronizarClinica(conexion, op)
    expect(r2).toMatchObject({ estado: 'ok', errores: 0 })
    expect(h.estado.parches).toHaveLength(2)
    expect(db.syncToken).toBe('t')
  })

  /* Revisión del punto 9: sólo lo pasajero detiene la página. Una excepción sin forma de red
     (un dato raro, un fallo nuestro) avanzaba antes y avanza ahora: repetirla dejaría a la
     clínica entera sin sincronizar. Mutación en rojo: `esFalloPasajero` con `s === null → true`
     (la versión primera) — la del TypeError no avanza. */
  it('la red cortada o un 403 de cuota detienen la página; una excepción sin forma de red, no', async () => {
    const casos: [Error, 'error' | 'ok'][] = [
      [Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }), 'error'],
      [Object.assign(new Error('Rate Limit Exceeded'), { code: 403, errors: [{ reason: 'rateLimitExceeded' }] }), 'error'],
      [Object.assign(new Error('Forbidden'), { code: 403, errors: [{ reason: 'forbidden' }] }), 'ok'],
      [new TypeError('x is undefined'), 'ok'],
    ]
    for (const [err, estado] of casos) {
      db.syncToken = null
      db.soltados = []
      db.filas = [fila({ status: 'attended' })]
      h.estado.patchFalla = err
      h.estado.guion = [pagina([evento()], { nextSyncToken: 't' })]
      expect((await sincronizarClinica(conexion, op)).estado, err.message).toBe(estado)
      expect(db.syncToken, err.message).toBe(estado === 'ok' ? 't' : null)
    }
  })

  it('un 4xx al restablecer (no 412 ni 429): cuenta un error y la página avanza igual (repetirlo no lo arregla)', async () => {
    db.filas = [fila({ status: 'attended' })]
    h.estado.patchFalla = 400
    h.estado.guion = [pagina([evento()], { nextSyncToken: 't' })]
    const r = await sincronizarClinica(conexion, op)
    expect(r).toMatchObject({ estado: 'ok', errores: 1 })
    expect(db.syncToken).toBe('t')
  })

  it('lo aceptado sin nada rechazado no escribe en Google', async () => {
    h.estado.guion = [pagina([evento({ summary: 'Junta movida' })], { nextSyncToken: 't' })]
    await sincronizarClinica(conexion, op)
    expect(h.estado.parches).toHaveLength(0)
  })
})

describe('E9 · RSVP de Google (detrás de AGENDA_RSVP_GOOGLE)', () => {
  const PACIENTE = { nombre: 'Ana', apellidos: 'Pérez' }
  const asistentes: calendar_v3.Schema$EventAttendee[] = [
    { email: 'medico@ejemplo.mx', organizer: true, responseStatus: 'accepted' },
    { email: 'Paciente@Ejemplo.MX ', responseStatus: 'accepted' },
    { email: 'otro@ejemplo.mx', responseStatus: 'declined' },
  ]
  function conAsistentes(): void {
    db.filas = [fila({ conPaciente: true, paciente: PACIENTE, tituloSinPaciente: null })]
    h.estado.guion = [pagina([evento({ etag: '"e1"', summary: 'Cita médica: Ana Pérez', attendees: asistentes })], { nextSyncToken: 's1' })]
  }

  it('apagado (sin la variable): ninguna llamada aunque el paciente haya aceptado', async () => {
    vi.stubEnv('AGENDA_RSVP_GOOGLE', '')
    conAsistentes()
    await sincronizarClinica(conexion, op)
    expect(db.rsvps).toEqual([])
    vi.unstubAllEnvs()
  })

  it('encendido, con la clínica suspendida o sin acceso (S3): ni RSVP ni Google; sale antes de leer eventos', async () => {
    vi.stubEnv('AGENDA_RSVP_GOOGLE', 'encendido')
    conAsistentes()
    db.habilitada = false
    expect(await sincronizarClinica(conexion, op)).toMatchObject({ estado: 'sin_acceso' })
    expect(db.rsvps).toEqual([])
    expect(llamadas()).toHaveLength(0)
    vi.unstubAllEnvs()
  })

  it('encendido: manda sólo los que aceptaron (sin organizador), normalizados, y cuenta el cambio', async () => {
    vi.stubEnv('AGENDA_RSVP_GOOGLE', 'encendido')
    conAsistentes()
    const r = await sincronizarClinica(conexion, op)
    expect(db.rsvps).toEqual([{ citaId: CITA, eventId: 'ev1', aceptaron: ['paciente@ejemplo.mx'] }])
    expect(r.cambios).toBeGreaterThanOrEqual(1)
    expect(r.errores).toBe(0)
    vi.unstubAllEnvs()
  })

  it('encendido: ni confirmadas, ni sin paciente, ni eventos borrados, ni sin aceptados', async () => {
    vi.stubEnv('AGENDA_RSVP_GOOGLE', 'encendido')
    for (const [f, e] of [
      [fila({ conPaciente: true, paciente: PACIENTE, status: 'confirmed' }), evento({ attendees: asistentes })],
      [fila(), evento({ attendees: asistentes })],
      [fila({ conPaciente: true, paciente: PACIENTE }), evento({ status: 'cancelled', attendees: asistentes })],
      [fila({ conPaciente: true, paciente: PACIENTE }), evento({ attendees: [{ email: 'p@e.mx', responseStatus: 'needsAction' }] })],
    ] as const) {
      Object.assign(db, { candado: null, fase: 'completa', syncToken: null, pageToken: null })
      db.filas = [f]
      h.estado.guion = [pagina([e], { nextSyncToken: 's1' })]
      await sincronizarClinica(conexion, op)
    }
    expect(db.rsvps).toEqual([])
    vi.unstubAllEnvs()
  })

  it('un fallo de la RPC cuenta como error y la página avanza igual', async () => {
    vi.stubEnv('AGENDA_RSVP_GOOGLE', 'encendido')
    conAsistentes()
    db.rsvpDevuelve = 'lanza'
    const r = await sincronizarClinica(conexion, op)
    expect(r.errores).toBe(1)
    expect(db.syncToken).toBe('s1')
    vi.unstubAllEnvs()
  })

  it('las decisiones de C3 no cambian: con o sin RSVP se aplica lo mismo', async () => {
    conAsistentes()
    vi.stubEnv('AGENDA_RSVP_GOOGLE', '')
    await sincronizarClinica(conexion, op)
    const sin = JSON.stringify(db.aplicadas)
    Object.assign(db, { candado: null, fase: 'completa', syncToken: null, pageToken: null, aplicadas: [] })
    conAsistentes()
    vi.stubEnv('AGENDA_RSVP_GOOGLE', 'encendido')
    await sincronizarClinica(conexion, op)
    expect(JSON.stringify(db.aplicadas)).toBe(sin)
    vi.unstubAllEnvs()
  })
})

describe('D11 · señal de la reserva pública y empalmes con reservas por enlace', () => {
  const IMPORTADA = '55555555-5555-4555-8555-555555555555'

  it('sin señal (sondeo, tarea): events.list sin opciones, como antes', async () => {
    h.estado.guion = [pagina([], { nextSyncToken: 't' })]
    await sincronizarClinica(conexion, op)
    expect(h.estado.opcionesLista).toEqual([{}])
  })

  it('con señal: la lleva events.list y el patch del restablecimiento', async () => {
    const senal = new AbortController().signal
    db.filas = [fila({ status: 'attended' })]
    h.estado.guion = [pagina([evento()], { nextSyncToken: 't' })]
    await sincronizarClinica(conexion, { ...op, senal })
    expect(h.estado.opcionesLista).toEqual([{ signal: senal }])
    expect(h.estado.parches[0].opciones).toMatchObject({ signal: senal, headers: { 'If-Match': '"e2"' } })
  })

  it('señal abortada a media pasada: error con código propio (google_tiempo), sin avanzar el token', async () => {
    const control = new AbortController()
    h.estado.guion = [() => { control.abort(new Error('tope')); throw new Error('This operation was aborted') }]
    const r = await sincronizarClinica(conexion, { ...op, senal: control.signal })
    expect(r.estado).toBe('error')
    expect(db.soltados).toEqual(['google_tiempo'])
    expect(db.syncToken).toBeNull()
  })

  it('señal ya abortada entre páginas: suelta sin error y deja la página (parcial)', async () => {
    const control = new AbortController()
    h.estado.guion = [(p) => { control.abort(new Error('tope')); return pagina([], { nextPageToken: 'p2' })(p) }]
    expect(await sincronizarClinica(conexion, { ...op, senal: control.signal })).toMatchObject({ estado: 'parcial' })
    expect(db).toMatchObject({ pageToken: 'p2', soltados: [null] })
  })

  it('lo importado y lo movido de la página va a registrar empalmes, una vez por página', async () => {
    h.estado.guion = [pagina([nuevo, evento()], { nextSyncToken: 't' })]
    expect(await sincronizarClinica(conexion, op)).toMatchObject({ estado: 'ok', errores: 0 })
    expect(db.empalmes).toEqual([[IMPORTADA, CITA]])
  })

  it('sin cambios de hora (sólo el título) ni importaciones: no se llama', async () => {
    db.filas = [fila({ inicio: '2031-06-06T18:00:00+00:00', fin: '2031-06-06T19:00:00+00:00' })]
    h.estado.guion = [pagina([evento({ summary: 'Otra junta' })], { nextSyncToken: 't' })]
    await sincronizarClinica(conexion, op)
    expect(db.aplicadas).toHaveLength(1)
    expect(db.empalmes).toEqual([])
  })

  it('un aplicar que no prendió (n = 0) no cuenta como movido', async () => {
    db.aplicarDevuelve = 0
    h.estado.guion = [pagina([evento()], { nextSyncToken: 't' })]
    await sincronizarClinica(conexion, op)
    expect(db.empalmes).toEqual([])
  })

  it('un fallo al registrar cuenta en errores y la página avanza; sin la migración, ni eso', async () => {
    db.empalmesFalla = 'lanza'
    h.estado.guion = [pagina([nuevo], { nextSyncToken: 't1' })]
    expect(await conRelojFalso(() => sincronizarClinica(conexion, op))).toMatchObject({ estado: 'ok', errores: 1 })
    expect(db.syncToken).toBe('t1')
    db.empalmesFalla = 'ausente'
    db.empalmes = []
    vi.mocked(captureMessage).mockClear()
    h.estado.guion = [pagina([nuevo], { nextSyncToken: 't2' })]
    expect(await sincronizarClinica(conexion, op)).toMatchObject({ estado: 'ok', errores: 0 })
    expect(db.syncToken).toBe('t2')
    // Sin la migración no se reintenta ni se avisa a Sentry.
    expect(db.empalmes).toHaveLength(1)
    expect(captureMessage).not.toHaveBeenCalled()
  })
})

/** Corre la pasada con temporizadores falsos (las pausas entre reintentos no esperan de verdad). */
async function conRelojFalso<T>(fn: () => Promise<T>): Promise<T> {
  vi.useFakeTimers()
  try {
    let hecho = false
    const p = fn().finally(() => { hecho = true })
    while (!hecho) await vi.advanceTimersByTimeAsync(1_000)
    return await p
  } finally {
    vi.useRealTimers()
  }
}

describe('W · el aviso de empalmes no se pierde en silencio', () => {
  const IMPORTADA = '55555555-5555-4555-8555-555555555555'

  it('la base falla una vez y luego funciona: el par se registra y nada va a Sentry', async () => {
    db.empalmesFallan = 1
    h.estado.guion = [pagina([nuevo], { nextSyncToken: 't' })]
    expect(await conRelojFalso(() => sincronizarClinica(conexion, op))).toMatchObject({ estado: 'ok', errores: 0 })
    expect(db.empalmes).toEqual([[IMPORTADA], [IMPORTADA]])
    expect(captureMessage).not.toHaveBeenCalled()
  })

  it('falla tres veces (dos reintentos): errores sube y Sentry recibe clínica e ids, nada más', async () => {
    db.empalmesFallan = 3
    h.estado.guion = [pagina([nuevo], { nextSyncToken: 't' })]
    expect(await conRelojFalso(() => sincronizarClinica(conexion, op))).toMatchObject({ estado: 'ok', errores: 1 })
    expect(db.empalmes).toHaveLength(3)
    expect(captureMessage).toHaveBeenCalledTimes(1)
    const [mensaje, contexto] = vi.mocked(captureMessage).mock.calls[0]
    expect(mensaje).toBe('GCalSync: empalmes con reservas sin registrar')
    expect(contexto).toEqual({ level: 'error', extra: { clinica: CLINICA, citas: [IMPORTADA] } })
  })

  it('el evento, tal como sale del filtro de PII: el filtro redacta los uuid (no se toca el filtro)', async () => {
    db.empalmesFallan = 3
    h.estado.guion = [pagina([nuevo], { nextSyncToken: 't' })]
    await conRelojFalso(() => sincronizarClinica(conexion, op))
    const [mensaje, contexto] = vi.mocked(captureMessage).mock.calls[0]
    const extra = typeof contexto === 'object' && contexto !== null && 'extra' in contexto ? contexto.extra : undefined
    const filtrado = beforeSend({ message: String(mensaje), extra: { ...extra } })
    expect(filtrado).toEqual({
      message: 'GCalSync: empalmes con reservas sin registrar',
      extra: { clinica: '[ID-REDACTADO]', citas: ['[ID-REDACTADO]'] },
    })
  })

  it('sin presupuesto: no reintenta (y avisa a Sentry)', async () => {
    db.empalmesFallan = 3
    h.estado.guion = [pagina([nuevo], { nextSyncToken: 't' })]
    expect(await conRelojFalso(() => sincronizarClinica(conexion, { ...op, presupuestoMs: 0 }))).toMatchObject({ errores: 1 })
    expect(db.empalmes).toHaveLength(1)
    expect(captureMessage).toHaveBeenCalledTimes(1)
  })

  it('con la señal abortada (tope de la reserva): no reintenta', async () => {
    const control = new AbortController()
    db.empalmesFallan = 3
    h.estado.guion = [(p) => { control.abort(new Error('tope')); return pagina([nuevo], { nextSyncToken: 't' })(p) }]
    await conRelojFalso(() => sincronizarClinica(conexion, { ...op, senal: control.signal }))
    expect(db.empalmes).toHaveLength(1)
    expect(captureMessage).toHaveBeenCalledTimes(1)
  })
})

describe('W · el candado se suelta siempre (la pasada que sigue dentro de after())', () => {
  it('la señal ya abortada al empezar: toma el candado y lo suelta sin error, sin llamar a Google', async () => {
    const control = new AbortController()
    control.abort(new Error('tope'))
    expect(await sincronizarClinica(conexion, { ...op, senal: control.signal })).toMatchObject({ estado: 'parcial' })
    expect(db).toMatchObject({ candado: null, soltados: [null] })
    expect(llamadas()).toHaveLength(0)
  })

  it('la base falla a media página: la pasada no lanza y suelta el candado con código', async () => {
    db.espejoFalla = true
    h.estado.guion = [pagina([nuevo], { nextSyncToken: 't' })]
    expect(await sincronizarClinica(conexion, op)).toMatchObject({ estado: 'error' })
    expect(db).toMatchObject({ candado: null, soltados: ['desconocido'], syncToken: null })
  })

  it('abortada a media página tras el tope: suelta con google_tiempo', async () => {
    const control = new AbortController()
    db.espejoFalla = true
    h.estado.guion = [(p) => { control.abort(new Error('tope')); return pagina([nuevo], { nextSyncToken: 't' })(p) }]
    expect(await sincronizarClinica(conexion, { ...op, senal: control.signal })).toMatchObject({ estado: 'error' })
    expect(db).toMatchObject({ candado: null, soltados: ['google_tiempo'] })
  })
})

/* Oleada 3, arreglo 3 (orden de Angel): «si falla al aplicar un cambio de Google, la página no
   avanza y la pasada siguiente lo repite [...] Solo ante fallos pasajeros; un error definitivo no
   debe dejar a la clínica sin sincronizar.» El error sale de la capa de base REAL (`llamar`) con
   la respuesta de PostgREST que toca, como en producción. Mutación en rojo: quitar el `throw new
   AplicacionPendiente()` de `procesarPagina` (la página avanzaba y el cambio se perdía). */
describe('oleada 3 · un fallo pasajero de la base al aplicar repite la página', () => {
  async function errorDeLaBase(code: string, status: number): Promise<unknown> {
    const real = await vi.importActual<typeof import('@/lib/gcalSincronizacionBase')>('@/lib/gcalSincronizacionBase')
    h.estado.rpc.error = { code, message: 'falló' }
    h.estado.rpc.status = status
    const err = await real.aplicarEvento(CLINICA, CAL, {
      citaId: CITA, esperadoUpdatedAt: '2031-05-01T00:00:00Z', etag: null, actualizado: null, vincular: null, desvincular: false, cambios: {},
    }).then(() => null, (e: unknown) => e)
    h.estado.rpc = { data: null, error: null, args: [], status: undefined }
    return err
  }
  const movida = evento({ start: { dateTime: '2031-06-06T14:00:00-06:00' }, end: { dateTime: '2031-06-06T15:00:00-06:00' } })

  it('40001 al aplicar: la página no avanza, el candado se suelta con código y la pasada siguiente lo aplica', async () => {
    db.errorAplicar = await errorDeLaBase('40001', 500)
    h.estado.guion = [pagina([movida], { nextSyncToken: 't' })]
    expect(await sincronizarClinica(conexion, op)).toMatchObject({ estado: 'error', errores: 1 })
    expect(db).toMatchObject({ syncToken: null, candado: null, soltados: ['base_pendiente'] })
    db.errorAplicar = null
    h.estado.guion = [pagina([movida], { nextSyncToken: 't' })]
    expect(await sincronizarClinica(conexion, op)).toMatchObject({ estado: 'ok', errores: 0 })
    expect(db.syncToken).toBe('t')
    expect(db.aplicadas).toHaveLength(1)
  })

  it('lo que es pasajero y lo que no (sin código: la red o el 5xx de la pasarela; con código, sólo la lista)', async () => {
    const casos: Array<[string, number, boolean]> = [
      ['', 0, true], ['', 503, true], ['PGRST003', 504, true], ['40P01', 500, true], ['55P03', 500, true],
      ['57014', 500, true], ['08006', 503, true], ['53300', 503, true],
      ['23505', 409, false], ['P0001', 400, false], ['42501', 403, false], ['42703', 400, false], ['XX000', 500, false], ['', 400, false],
    ]
    for (const [code, status, pasajero] of casos) {
      Object.assign(db, { syncToken: null, soltados: [], aplicadas: [] })
      db.errorAplicar = await errorDeLaBase(code, status)
      h.estado.guion = [pagina([movida], { nextSyncToken: 't' })]
      const r = await sincronizarClinica(conexion, op)
      expect(r.errores, `${code}/${status}`).toBe(1)
      expect(db.syncToken, `${code}/${status}`).toBe(pasajero ? null : 't')
    }
  })

  it('los empalmes de lo que sí se aplicó en la página se registran ANTES de no avanzar', async () => {
    db.errorAplicar = await errorDeLaBase('40001', 500)
    h.estado.guion = [pagina([movida, nuevo], { nextSyncToken: 't' })]
    await sincronizarClinica(conexion, op)
    expect(db.importadas).toHaveLength(1)
    expect(db.empalmes).toEqual([['55555555-5555-4555-8555-555555555555']])
    expect(db.syncToken).toBeNull()
  })
})
