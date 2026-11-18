import { test, expect } from '@playwright/test'
import { interruptorAgenda, soloEscritorio, sqlLocal } from './ayudas'
import { limpiarReservasE2e, marcaE2e } from './reservaAyudas'
import { aprobarAviso, api, emitirEnlace, type Escenario, type Turno } from './reservaPublicaAyudas'
import { desplazarFecha, hoyEnTZ } from '../src/lib/dates'
import { reglasDe, turnoValido, type ReglasReserva } from '../src/lib/reserva/turnosReserva'
import type { Horario } from '../src/lib/configApp'

/**
 * Tanda J, J2 (punto 5 de Angel): la anticipación mínima, con el reloj fijado.
 *
 *   1. LA PÁGINA Y LA BASE DAN LO MISMO PARA EL MISMO INSTANTE. En UNA
 *      transacción (que termina en ROLLBACK) se fija el instante (`now()`, el
 *      de la transacción), se pone la anticipación (0, 2 y 24 h) y se pregunta
 *      a `reservar_por_enlace` por cada turno de la rejilla alrededor de
 *      `now() + anticipación`, con un enlace FIJO sin ficha: lo que no pasa la
 *      ventana sale `fuera_de_ventana`, y lo que la pasa sale `ocupado` o
 *      `correo_sin_verificar` (antes de insertar nada). Con ESE instante, el
 *      servidor de la página (`turnoValido`, la regla de /turnos y del POST)
 *      tiene que decir lo mismo de cada turno. No hay otro mecanismo para el
 *      reloj del servidor y de la base en las e2e (las de husos y rejilla
 *      colocan los datos respecto al reloj real): el `now()` de una
 *      transacción ES un reloj fijado.
 *   2. LA PÁGINA CON EL RELOJ DEL NAVEGADOR FIJADO (`page.clock`), en un
 *      consultorio de Tijuana y el navegador en Mérida: lo que pinta es lo que
 *      da /turnos, ningún turno a menos de 2 h, y un reloj del navegador de
 *      ayer a las 23:30 no esconde los turnos de hoy.
 *
 * Mutación que la pone en rojo (comprobada): la anticipación por minutos en
 * vez de por horas en `turnosDelDia` (`turnosAgenda.ts`, `* 60_000` por
 * `* 3_600_000`): la página ofrece a las 2 h lo que la base rechaza. LÍMITE
 * CONOCIDO: el `now()` de la transacción nunca cae sobre la rejilla (lleva
 * microsegundos), así que esta prueba no distingue `<` de `<=` en la frontera
 * exacta; esa cara la fija la Vitest de `turnosReserva.test.ts` (con
 * `Date.parse(inicio) <= limite` se pone en rojo) y, en la base, la lectura de
 * la RPC (`p_inicio < now() + make_interval(hours => …)`, el mismo `<`).
 */
soloEscritorio()
test.describe.configure({ mode: 'serial' })

const MERIDA = 'America/Merida'
const TIJUANA = 'America/Tijuana'
const DIA = { activo: true, inicio: '00:00', fin: '23:55' }
const HORARIO: Horario = { lunes: DIA, martes: DIA, miercoles: DIA, jueves: DIA, viernes: DIA, sabado: DIA, domingo: DIA }
const CLINICA = `(select id from public.clinicas where nombre = 'Clínica Semilla A')`
const MEDICO = `(select id from auth.users where email = 'admin.a@semilla.spinus.test')`

let desde = ''
let e: Escenario
/** Los ajustes de la ventana de A antes de la prueba (la parte 2 los pone a los de fábrica). */
let ventanaPrevia = ''
test.beforeAll(() => {
  desde = marcaE2e()
  ventanaPrevia = sqlLocal(`select anticipacion_min_horas || '|' || horizonte_dias from public.agenda_ajustes where clinica_id = ${CLINICA}`)
  interruptorAgenda('A', true)
  aprobarAviso(true)
})
test.afterAll(() => {
  if (e?.consultorioId) {
    sqlLocal(`begin; set local session_replication_role = replica;
      delete from public.audit_log where registro_id in (:'k'::uuid, :'t'::uuid);
      delete from public.consultorios where id = :'k'; delete from public.tipos_cita where id = :'t'; commit;`,
    { k: e.consultorioId, t: e.tipoId })
  }
  const [ant = '2', hor = '60'] = ventanaPrevia.split('|')
  sqlLocal(`update public.agenda_ajustes set anticipacion_min_horas = :'a'::int, horizonte_dias = :'h'::int where clinica_id = ${CLINICA}`, { a: ant, h: hor })
  limpiarReservasE2e(desde)
  interruptorAgenda('A', false)
})

/**
 * Para una anticipación y una zona: el instante de la transacción y, por cada
 * turno de 5 min entre `now() + anticipación − 20 min` y `+ 20 min` (y
 * alrededor del horizonte, puesto a 2 días), lo que dice la base. Todo dentro
 * de una transacción que se deshace: el consultorio, el tipo, el enlace y los
 * ajustes no quedan.
 */
function preguntarALaBase(tz: string, horas: number): { ahora: Date; filas: { inicio: string; resultado: string }[] } {
  const salida = sqlLocal(`
    begin;
    update public.agenda_ajustes set agenda_v2_encendida = true, anticipacion_min_horas = :'h'::int, horizonte_dias = 2
     where clinica_id = ${CLINICA};
    update public.reserva_enlaces set revocado_en = now()
     where clinica_id = ${CLINICA} and medico_id = ${MEDICO} and clase = 'fijo' and revocado_en is null;
    create temp table _k on commit drop as
      with k as (insert into public.consultorios (clinica_id, medico_id, nombre, nombre_corto, direccion, timezone, horario, horario_propio)
                 select ${CLINICA}, ${MEDICO}, 'J2 anticipación (e2e)', 'J2', 'x', :'tz', :'hor'::jsonb, true returning id),
           t as (insert into public.tipos_cita (clinica_id, nombre, duracion_min, activo) select ${CLINICA}, 'J2 anticipación 5', 5, true returning id),
           n as (insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash)
                 select gen_random_uuid(), ${CLINICA}, ${MEDICO}, 'fijo', repeat('ab', 32) returning id)
      select (select id from k) k, (select id from t) t, (select id from n) n;
    select 'AHORA|' || to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
    select 'FILA|' || to_char(c at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') || '|' || r.r_resultado
      from _k,
           lateral (select g as c from generate_series(date_trunc('hour', now() + make_interval(hours => :'h'::int)) - interval '1 hour',
                                                       date_trunc('hour', now() + make_interval(hours => :'h'::int)) + interval '1 hour', interval '5 min') g
                    union
                    select g from generate_series(date_trunc('hour', now() + interval '2 days') - interval '30 min',
                                                  date_trunc('hour', now() + interval '2 days') + interval '30 min', interval '5 min') g) cs,
           lateral public.reservar_por_enlace(${CLINICA}, repeat('ab', 32), _k.k, _k.t, cs.c, 'Sonda J2', '5512345678', 'sonda@j2.test',
                                              repeat('cd', 32), repeat('ef', 32), null,
                                              (select version from public.reserva_avisos where aprobado limit 1),
                                              (select texto_sha256 from public.reserva_avisos where aprobado limit 1), gen_random_uuid()) r
     order by 1;
    rollback;`, { h: String(horas), tz, hor: JSON.stringify(HORARIO) })
  const lineas = salida.split('\n')
  const ahora = new Date((lineas.find(l => l.startsWith('AHORA|')) ?? '').slice(6))
  const filas = lineas.filter(l => l.startsWith('FILA|')).map(l => {
    const [, inicio = '', resultado = ''] = l.split('|')
    return { inicio: new Date(inicio).toISOString(), resultado }
  })
  return { ahora, filas }
}

for (const tz of [MERIDA, TIJUANA]) {
  for (const horas of [0, 2, 24]) {
    test(`la página y reservar_por_enlace dicen lo mismo para el mismo instante (${tz}, anticipación ${horas} h)`, () => {
      const { ahora, filas } = preguntarALaBase(tz, horas)
      expect(Number.isNaN(ahora.getTime())).toBe(false)
      expect(filas.length).toBeGreaterThan(20)
      const reglas: ReglasReserva = reglasDe({ horario: HORARIO, horario_propio: true, timezone: tz }, null, 5,
        { anticipacion_min_horas: horas, horizonte_dias: 2 })
      const lejos = new Date(ahora.getTime() - 400 * 86_400_000)
      let dentro = 0
      let fuera = 0
      for (const f of filas) {
        // Sólo los turnos de la rejilla (00:00–23:55 en la zona): el resto lo descarta el servidor antes de la base.
        const reglasSinVentana = { ...reglas, anticipacionMinHoras: 0, horizonteDias: 1000 }
        if (!turnoValido(reglasSinVentana, f.inicio, lejos)) continue
        const base = f.resultado !== 'fuera_de_ventana'
        expect(['fuera_de_ventana', 'ocupado', 'correo_sin_verificar']).toContain(f.resultado)
        expect({ inicio: f.inicio, pagina: turnoValido(reglas, f.inicio, ahora) !== null }).toEqual({ inicio: f.inicio, pagina: base })
        if (base) dentro++; else fuera++
        // Las dos caras de la regla, para el mismo instante.
        const falta = Date.parse(f.inicio) - ahora.getTime()
        expect(base).toBe(falta >= horas * 3_600_000 && falta < 2 * 86_400_000)
      }
      expect(dentro).toBeGreaterThan(0)
      expect(fuera).toBeGreaterThan(0)
    })
  }
}

test('la página con el reloj del navegador fijado: pinta lo de /turnos, nada a menos de 2 h, y un reloj de ayer no esconde hoy', async ({ browser }) => {
  // Consultorio de Tijuana abierto todo el día, consulta de 60 min; anticipación de fábrica (2 h).
  sqlLocal(`update public.agenda_ajustes set anticipacion_min_horas = 2, horizonte_dias = 60 where clinica_id = ${CLINICA}`)
  const fila = sqlLocal(`
    with k as (insert into public.consultorios (clinica_id, medico_id, nombre, nombre_corto, direccion, timezone, horario, horario_propio)
               select ${CLINICA}, ${MEDICO}, 'J2 Tijuana (e2e)', 'J2', 'Av. Revolución 1', :'tz', :'hor'::jsonb, true returning id),
         t as (insert into public.tipos_cita (clinica_id, nombre, duracion_min, activo) select ${CLINICA}, 'J2 anticipación 60', 60, true returning id)
    select ${CLINICA}, ${MEDICO}, (select id from k), (select id from t);`, { tz: TIJUANA, hor: JSON.stringify(HORARIO) })
  const [clinicaId = '', medicoId = '', consultorioId = '', tipoId = ''] = fila.split('|')
  e = { clinicaId, medicoId, consultorioId, consultorioTelefono: null, consultorioOtraClinica: '', tipoId, tipoNombre: 'J2 anticipación 60' }
  const { codigo } = emitirEnlace(e, 'unico')
  const hoy = hoyEnTZ(TIJUANA)
  const ctx = await api()
  let deLaApi: Turno[] = []
  try {
    const r = await ctx.get(`/api/reservar/${codigo}/turnos?consultorio=${consultorioId}&tipo=${tipoId}&desde=${hoy}`)
    expect(r.status()).toBe(200)
    const dias: { fecha: string; turnos: Turno[] }[] = (await r.json()).dias
    expect(dias[0]?.fecha).toBe(hoy)
    deLaApi = dias.find(d => d.turnos.length > 0)?.turnos ?? []
  } finally { await ctx.dispose() }
  expect(deLaApi.length).toBeGreaterThan(0)
  for (const t of deLaApi) expect(Date.parse(t.inicio) - Date.now()).toBeGreaterThanOrEqual(2 * 3_600_000 - 60_000)

  for (const reloj of [new Date(), new Date(`${desplazarFecha(hoyEnTZ(MERIDA), { dias: -1 })}T23:30:00-06:00`)]) {
    const pagina = await (await browser.newContext({ timezoneId: MERIDA, locale: 'es-MX' })).newPage()
    await pagina.clock.setFixedTime(reloj)
    await pagina.goto(`/reservar/${codigo}`)
    await pagina.locator(`input[name="consultorio"][value="${consultorioId}"]`).check()
    const tipo = pagina.locator(`input[name="tipo"][value="${tipoId}"]`)
    if (await tipo.count()) await tipo.check()
    await pagina.getByRole('button', { name: 'Elegir día y hora' }).click()
    const botones = pagina.locator('button[data-inicio]')
    await expect(botones.first()).toBeVisible()
    const pintados = await botones.evaluateAll(bs => bs.map(b => b.getAttribute('data-inicio') ?? ''))
    expect(pintados).toEqual(deLaApi.map(t => t.inicio))
    await pagina.context().close()
  }
})
