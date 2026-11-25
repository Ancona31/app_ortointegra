/**
 * semillaCitas.test.ts — la semilla de A1.4c se guarda SÓLO en semanas que
 * quedan enteras, con las claves exactas de `rangoQuePedir`, y una sola vez.
 *
 * Las fechas locales se construyen con `new Date(a, m, d)` (huso de la
 * máquina), como en `rangoQuePedir.test.ts`: `vitest.config.ts` no fija `TZ`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  esperarSemilla, olvidarSemillas, partirSemilla, semanasAlrededor, sembrarCacheCitas, ventanaDeLaSemilla,
  TOPE_SEMILLA_MS, type SemillaCitas,
} from '@/lib/agenda/semillaCitas'
import { claveCitas, generacionCitas, leerCitas, vaciarCacheCitas } from '@/lib/agenda/cacheRangosCitas'
import { rangoQuePedir } from '@/lib/agenda/rangoQuePedir'

type Fila = { id: string; start_time: string; end_time: string }

const HOY = new Date(2026, 10, 11, 10) // miércoles
const fila = (id: string, desde: Date, hasta: Date): Fila => ({ id, start_time: desde.toISOString(), end_time: hasta.toISOString() })

function semilla(appointments: Fila[], extra: Partial<SemillaCitas<Fila>> = {}): SemillaCitas<Fila> {
  const semanas = semanasAlrededor(HOY)
  return {
    id: Math.random().toString(36), usuario: 'u1', filtro: '', salio: Date.now(),
    desde: semanas[0].startStr, hasta: semanas[2].endStr, appointments, incompleta: false, ...extra,
  }
}

describe('ventanaDeLaSemilla', () => {
  it('del lunes de W-1 menos un día al lunes de W+2 más un día, en TZ_CLINICA', () => {
    expect(ventanaDeLaSemilla('2026-11-11')).toEqual({
      desde: '2026-11-01T06:00:00.000Z', hasta: '2026-11-24T06:00:00.000Z',
    })
    // Un domingo pertenece a la semana que empezó el lunes anterior.
    expect(ventanaDeLaSemilla('2026-11-15').desde).toBe('2026-11-01T06:00:00.000Z')
  })
})

describe('partirSemilla', () => {
  it('las claves son las que pedirá FullCalendar para W-1, W y W+1', () => {
    const semanaW = rangoQuePedir({ startStr: new Date(2026, 10, 9).toISOString(), endStr: new Date(2026, 10, 16).toISOString() })
    const partes = partirSemilla(semilla([]), HOY)
    expect(partes.map(p => p.clave)).toHaveLength(3)
    expect(partes[1].clave).toBe(claveCitas('u1', '', semanaW.startStr, semanaW.endStr))
  })

  it('reparte por solape (`start < fin && end >= inicio`): una de varios días entra en las dos', () => {
    const larga = fila('larga', new Date(2026, 10, 14), new Date(2026, 10, 18))
    const borde = fila('borde', new Date(2026, 10, 16), new Date(2026, 10, 16, 1))
    const partes = partirSemilla(semilla([larga, borde]), HOY)
    expect(partes[1].filas.map(f => f.id)).toEqual(['larga'])
    expect(partes[2].filas.map(f => f.id)).toEqual(['larga', 'borde'])
  })

  it('no guarda una semana que no quede entera dentro de lo sembrado', () => {
    const semanas = semanasAlrededor(HOY)
    const partes = partirSemilla(semilla([], { desde: semanas[1].startStr }), HOY)
    expect(partes).toHaveLength(2)
  })

  it('incompleta: sólo las semanas que terminan antes del último inicio recibido', () => {
    const tardia = fila('t', new Date(2026, 10, 17, 9), new Date(2026, 10, 17, 10))
    expect(partirSemilla(semilla([tardia], { incompleta: true }), HOY)).toHaveLength(2)
    expect(partirSemilla(semilla([], { incompleta: true }), HOY)).toHaveLength(0)
  })
})

describe('sembrarCacheCitas', () => {
  beforeEach(() => vaciarCacheCitas())
  const traducir = (f: Fila) => ({ id: f.id })
  const claveW = () => partirSemilla(semilla([]), HOY)[1].clave

  it('guarda las tres semanas, una sola vez por semilla', () => {
    const s = semilla([fila('a', new Date(2026, 10, 11, 9), new Date(2026, 10, 11, 10))])
    sembrarCacheCitas(s, traducir, generacionCitas(), Date.now(), HOY)
    expect(leerCitas(claveW())).toEqual([{ id: 'a' }])
    vaciarCacheCitas()
    sembrarCacheCitas(s, traducir, generacionCitas(), Date.now(), HOY)
    expect(leerCitas(claveW())).toBeNull()
  })

  it('un vaciado mientras viajaba la descarta', () => {
    const gen = generacionCitas()
    vaciarCacheCitas()
    sembrarCacheCitas(semilla([]), traducir, gen, Date.now(), HOY)
    expect(leerCitas(claveW())).toBeNull()
  })
})

describe('olvidarSemillas y el tope del registro', () => {
  beforeEach(() => { vaciarCacheCitas(); olvidarSemillas() })
  const traducir = (f: Fila) => ({ id: f.id })
  const entra = (s: SemillaCitas<Fila>): boolean => sembrarCacheCitas(s, traducir, generacionCitas(), Date.now(), HOY) !== null

  it('vaciar la caché NO olvida la semilla; cerrar sesión sí', () => {
    const s = semilla([])
    expect(entra(s)).toBe(true)
    vaciarCacheCitas()
    expect(entra(s)).toBe(false)
    olvidarSemillas()
    expect(entra(s)).toBe(true)
  })

  it('recuerda las 50 últimas: la más vieja se descarta, la reciente no', () => {
    const semillas = Array.from({ length: 51 }, () => semilla([]))
    for (const s of semillas) entra(s)
    expect(entra(semillas[50])).toBe(false)
    expect(entra(semillas[1])).toBe(false)
    expect(entra(semillas[0])).toBe(true)
  })
})

describe('esperarSemilla: si la semilla falla, la fuente sigue a la red', () => {
  /* La fuente de citas hace `await esperarSemilla(...)`, vuelve a leer la caché
     y, si no hay su clave, pide a la red. Aquí: la espera suelta con `null` y
     la clave sigue sin estar, que es «a la red». El fallo de la semilla del
     servidor no se puede provocar desde Playwright; esto es lo que lo cubre. */
  beforeEach(() => { vi.useFakeTimers(); vaciarCacheCitas() })
  afterEach(() => { vi.useRealTimers() })
  const claveW = () => partirSemilla(semilla([]), HOY)[1].clave

  it('la semilla rechaza: suelta enseguida con null', async () => {
    const espera = esperarSemilla(Promise.reject(new Error('stream roto')))
    await expect(espera).resolves.toBeNull()
    expect(leerCitas(claveW())).toBeNull()
  })

  it('la semilla nunca resuelve: suelta a los 3 s, ni antes', async () => {
    let soltada = false
    const espera = esperarSemilla(new Promise<number | null>(() => {})).then((m) => { soltada = true; return m })
    await vi.advanceTimersByTimeAsync(TOPE_SEMILLA_MS - 1)
    expect(soltada).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await expect(espera).resolves.toBeNull()
    expect(leerCitas(claveW())).toBeNull()
  })

  it('la semilla resuelve null (no sembró): suelta enseguida con null', async () => {
    await expect(esperarSemilla(Promise.resolve(null))).resolves.toBeNull()
    expect(leerCitas(claveW())).toBeNull()
  })

  it('la semilla entra a tiempo: devuelve su marca', async () => {
    await expect(esperarSemilla(Promise.resolve(1234))).resolves.toBe(1234)
  })
})

/* ── Zona horaria: navegador ≠ servidor ──────────────────────────────────────
   El servidor siembra en TZ_CLINICA y el navegador parte en SU zona. Se
   compara cada semana guardada con lo que la API devolvería para esa misma
   semana (el mismo criterio, sobre todas las filas que existen): ni una fila
   de más, ni una de borde de menos. Y una semana que no cabe entera en lo
   sembrado no se guarda. */
describe('partirSemilla con el navegador en otra zona y otro «hoy»', () => {
  const TZ_ORIGINAL = process.env.TZ
  afterEach(() => { process.env.TZ = TZ_ORIGINAL })

  const H = 3_600_000
  const ms = (iso: string): number => Date.parse(iso)
  const solapa = (f: Fila, desde: number, hasta: number): boolean => ms(f.start_time) < hasta && ms(f.end_time) >= desde
  const fila2 = (id: string, a: number, b: number): Fila => ({ id, start_time: new Date(a).toISOString(), end_time: new Date(b).toISOString() })

  /** Filas cada 5 h por todo el periodo, y en cada borde: una que acaba justo
   *  en él, una que empieza justo en él, una de duración cero y una larga. */
  function universo(bordes: number[], desde: number, hasta: number): Fila[] {
    const filas: Fila[] = []
    for (let t = desde - 72 * H; t < hasta + 72 * H; t += 5 * H) filas.push(fila2(`r${t}`, t, t + H))
    for (const b of bordes) {
      filas.push(fila2(`acaba${b}`, b - H, b), fila2(`empieza${b}`, b, b + H), fila2(`cero${b}`, b, b), fila2(`larga${b}`, b - 72 * H, b + 72 * H))
    }
    return filas
  }

  const casos: { tz: string; hoyServidor: string; desplazamiento: number }[] = []
  for (const tz of ['UTC', 'Europe/Madrid']) {
    for (const hoyServidor of ['2026-11-11', '2026-11-15', '2026-11-16']) {
      for (const desplazamiento of [-1, 0, 1]) casos.push({ tz, hoyServidor, desplazamiento })
    }
  }

  it.each(casos)('$tz, servidor en $hoyServidor, navegador $desplazamiento día(s)', ({ tz, hoyServidor, desplazamiento }) => {
    process.env.TZ = tz
    const [a, m, d] = hoyServidor.split('-').map(Number)
    const hoyNavegador = new Date(a, m - 1, d + desplazamiento, 12)
    const ventana = ventanaDeLaSemilla(hoyServidor)
    const semanas = semanasAlrededor(hoyNavegador)
    const bordes = [ms(ventana.desde), ms(ventana.hasta), ...semanas.flatMap(w => [ms(w.startStr), ms(w.endStr)])]
    const todas = universo(bordes, ms(ventana.desde), ms(ventana.hasta))
    const s: SemillaCitas<Fila> = {
      id: 'tz', usuario: 'u1', filtro: '', salio: 0, ...ventana, incompleta: false,
      appointments: todas.filter(f => solapa(f, ms(ventana.desde), ms(ventana.hasta))),
    }
    const guardadas = new Map(partirSemilla(s, hoyNavegador).map(p => [p.clave, p.filas]))
    for (const w of semanas) {
      const cabe = ms(w.startStr) >= ms(ventana.desde) && ms(w.endStr) <= ms(ventana.hasta)
      const filas = guardadas.get(claveCitas('u1', '', w.startStr, w.endStr))
      expect(filas !== undefined).toBe(cabe)
      if (!filas) continue
      const deLaApi = todas.filter(f => solapa(f, ms(w.startStr), ms(w.endStr))).map(f => f.id).sort()
      expect(filas.map(f => f.id).sort()).toEqual(deLaApi)
    }
    // El margen de un día cubre ±1 día de desfase: la semana del navegador
    // siempre se puede garantizar.
    expect(guardadas.has(claveCitas('u1', '', semanas[1].startStr, semanas[1].endStr))).toBe(true)
  })
})
