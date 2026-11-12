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
    calendarioRegistrado: 'cal-spinus@group.calendar.google.com' as string | null,
    insertCalendario: 0,
    /** C5: los `events.patch` del restablecimiento, con sus opciones (If-Match). */
    parches: [] as Array<{ params: unknown; opciones: unknown }>,
    patchFalla: null as number | null,
    rpc: { data: null as unknown, error: null as { code: string; message: string } | null, args: [] as unknown[] },
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
        list: async (p: unknown) => {
          h.estado.llamadas.push(p)
          const paso = h.estado.guion.shift()
          if (!paso) throw new Error('guion agotado')
          return { data: paso(p) }
        },
        patch: async (params: unknown, opciones: unknown) => {
          h.estado.parches.push({ params, opciones })
          if (h.estado.patchFalla) throw Object.assign(new Error(`HTTP ${h.estado.patchFalla}`), { code: h.estado.patchFalla })
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
      return { data: h.estado.rpc.data, error: h.estado.rpc.error }
    },
  }),
}))
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn(async () => undefined) }))
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
  aplicarDevuelve: 1,
  /** E9: las llamadas a `confirmarPorRsvp` y lo que devuelve (o lanza). */
  rsvps: [] as Array<{ citaId: string; eventId: string; aceptaron: string[] }>,
  rsvpDevuelve: true as boolean | 'lanza',
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
      return db.filas.filter((f) => (f.googleEventId && ids.includes(f.googleEventId)) || marcas.includes(f.id))
    },
    aplicarEvento: async (_c: string, _cal: string, a: Aplicacion) => {
      if (db.fallarAplicar.has(a.citaId)) throw new Error('la base falló')
      db.aplicadas.push(a)
      return db.aplicarDevuelve
    },
    confirmarPorRsvp: async (_c: string, _cal: string, citaId: string, eventId: string, aceptaron: string[]) => {
      db.rsvps.push({ citaId, eventId, aceptaron })
      if (db.rsvpDevuelve === 'lanza') throw new Error('la base falló')
      return db.rsvpDevuelve
    },
    importarEvento: async (_c: string, _cal: string, d: DatosImportar) => {
      db.importadas.push(d)
      return '55555555-5555-4555-8555-555555555555'
    },
  }
})

import { sincronizarClinica, type OpcionesSincronizacion } from '@/lib/gcalSincronizacion'
import { logAudit } from '@/lib/audit'

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
    noDisponible: false, noDisponibleC2: false, soltados: [], reinicios: 0, filas: [fila()], aplicadas: [], importadas: [], fallarAplicar: new Set(),
    aplicarDevuelve: 1, rsvps: [], rsvpDevuelve: true,
  })
  Object.assign(h.estado, { guion: [], llamadas: [], calendarioRegistrado: CAL, insertCalendario: 0, parches: [], patchFalla: null })
  h.estado.rpc = { data: null, error: null, args: [] }
  vi.mocked(logAudit).mockClear()
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

  it('otro fallo de Google al restablecer: cuenta un error y la página avanza igual', async () => {
    db.filas = [fila({ status: 'attended' })]
    h.estado.patchFalla = 500
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
