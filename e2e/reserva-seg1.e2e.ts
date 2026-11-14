import { test, expect } from '@playwright/test'
import { soloEscritorio, sqlLocal } from './ayudas'
import {
  cancelarCita, cerrarEscenario, citaDe, emitirEnlace, personaNueva, prepararEscenario, reservar, turnosLibres,
  verificarCorreo, type Escenario, type Turno,
} from './reservaPublicaAyudas'
import { hmacContacto } from '../src/lib/reserva/secretos'

/**
 * seg1 — correcciones de seguridad del enlace de reserva (decisiones de Angel
 * tras la revisión independiente; mejora_agendaV2.md §6-bis), por HTTP contra
 * la API pública, sin sesión:
 *   1. el enlace no revela nada de un teléfono: dos teléfonos —uno con cita,
 *      historial y bloqueo automático (que le cargó un tercero) y otro limpio—
 *      dan la MISMA respuesta, sin correo verificado y con él;
 *   2. lo automático del candado decide por el correo verificado (el teléfono
 *      ajeno ni bloquea ni deja «ya tiene cita»);
 *   5. un evento de todo el día del médico tapa ese día en el enlace;
 *   6. el bloqueo MANUAL por teléfono corta el fijo y también el único;
 *   7b. el nombre con una URL o un salto de línea es el 400 genérico.
 * El trabajo idéntico de la base (no sólo la respuesta) lo prueba
 * `supabase/pruebas-sql/seg1_candado_correo.sql`, caso 1.
 */
test.describe.configure({ mode: 'serial' })
soloEscritorio()

let e: Escenario
let libres: Turno[] = []
let siguiente = 0
function turno(): string {
  const t = libres[siguiente++]
  if (!t) throw new Error('Se acabaron los turnos libres de la semana elegida')
  return t.inicio
}

test.beforeAll(async () => {
  e = prepararEscenario()
  libres = await turnosLibres(e, emitirEnlace(e, 'unico').codigo, 21)
})
test.afterAll(() => { cerrarEscenario() })

/** Un tercero, con SUS correos, deja al teléfono una cita activa y tres cancelaciones. */
async function ensuciarTelefono(telefono: string): Promise<void> {
  for (let i = 0; i < 3; i++) {
    const p = { ...personaNueva(), telefono }
    expect((await reservar(e, emitirEnlace(e, 'unico').codigo, { inicio: turno(), persona: p })).status).toBe(201)
    cancelarCita(citaDe(p.correo)?.id ?? '')
  }
  expect((await reservar(e, emitirEnlace(e, 'unico').codigo, { inicio: turno(), persona: { ...personaNueva(), telefono } })).status).toBe(201)
}

/** El día de pared de un instante en la zona del consultorio de la semilla. */
function diaEnMerida(instante: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Merida' }).format(new Date(instante))
}

/** Lo que haría «Bloquear contacto» sólo con el teléfono (como postgres). */
function bloquearTelefono(telefono: string): void {
  const clave = hmacContacto('telefono', telefono)
  if (!clave) throw new Error('Falta RESERVA_SECRETO en .env.local')
  sqlLocal(`
    insert into public.reserva_contactos (clinica_id, medico_id, clave_hmac, clase, bloqueado_en)
    values (:'clinica', :'medico', :'clave', 'telefono', now())
    on conflict (clinica_id, medico_id, clave_hmac) do update set bloqueado_en = now();`,
  { clinica: e.clinicaId, medico: e.medicoId, clave })
}

test('punto 1: sin correo verificado, el teléfono sucio y el limpio dan la misma respuesta', async () => {
  const sucio = personaNueva().telefono
  await ensuciarTelefono(sucio)
  const { codigo } = emitirEnlace(e, 'fijo')
  const atacante = personaNueva()
  const inicio = turno()
  const a = await reservar(e, codigo, { inicio, persona: { ...atacante, telefono: sucio } })
  const b = await reservar(e, codigo, { inicio, persona: atacante })
  expect(a).toEqual(b)
  expect(a).toEqual({ status: 403, cuerpo: { error: 'correo_sin_verificar' } })
})

test('puntos 1 y 2: con SU correo verificado, el teléfono sucio reserva igual que el limpio', async () => {
  const sucio = personaNueva().telefono
  await ensuciarTelefono(sucio)
  const { codigo } = emitirEnlace(e, 'fijo')
  const uno = personaNueva()
  const dos = personaNueva()
  const a = await reservar(e, codigo, { inicio: turno(), persona: { ...uno, telefono: sucio }, ficha: await verificarCorreo(codigo, uno.correo) })
  const b = await reservar(e, codigo, { inicio: turno(), persona: dos, ficha: await verificarCorreo(codigo, dos.correo) })
  expect(a).toEqual(b)
  expect(a).toEqual({ status: 201, cuerpo: { estado: 'reservada' } })
})

test('punto 6: el bloqueo manual por teléfono corta el fijo y también el enlace único', async () => {
  const bloqueado = personaNueva()
  bloquearTelefono(bloqueado.telefono)
  const { codigo } = emitirEnlace(e, 'fijo')
  const fijo = await reservar(e, codigo, { inicio: turno(), persona: bloqueado, ficha: await verificarCorreo(codigo, bloqueado.correo) })
  expect(fijo).toMatchObject({ status: 403, cuerpo: { error: 'autoservicio_cerrado' } })
  const unico = await reservar(e, emitirEnlace(e, 'unico').codigo, { inicio: turno(), persona: { ...personaNueva(), telefono: bloqueado.telefono } })
  expect(unico).toMatchObject({ status: 403, cuerpo: { error: 'autoservicio_cerrado' } })
})

/** ¿Cuántas citas activas (no canceladas ni «no asistió») tiene el médico ese día de pared en Mérida?
    Los mismos criterios que `reserva_ocupacion` (clínica, médico, estados, solape). */
function citasDelDia(dia: string): number {
  return Number(sqlLocal(`
    select count(*) from public.appointments
     where clinica_id = :'clinica' and medico_id = :'medico' and status not in ('cancelled', 'no_show')
       and start_time < ((:'dia'::date) + 1)::timestamp at time zone 'America/Merida'
       and end_time > (:'dia'::date)::timestamp at time zone 'America/Merida';`, { clinica: e.clinicaId, medico: e.medicoId, dia }))
}

/**
 * Un turno de un día en que el médico NO tiene ninguna otra cita, buscando
 * semana a semana desde la cuarta (lejos de los turnos que gastan las demás
 * pruebas y dentro del horizonte de 60 días de la semilla).
 *
 * ⚠️ POR QUÉ NO SIRVE «el último turno libre» (la versión anterior, que fallaba
 * según el día): la ruta, ANTES de la RPC, exige que el turno se haya podido
 * ofrecer (`turnoValido`): con la ocupación del momento o, si no, con la
 * jornada VACÍA. Con el evento de todo el día puesto sólo vale lo segundo, y
 * por P9 los turnos arrancan en cada hueco: si ese día había una cita de 13:00
 * a 13:15, el último turno libre era, p. ej., 17:15, que no está alineado a la
 * jornada vacía (08:00, 08:30…) → 400 `turno_invalido` antes de llegar a la
 * RPC. Qué día caía y qué citas tenía dependía de la fecha de la siembra y de
 * hoy. En un día sin citas todos los turnos están alineados, así que la
 * petición llega a la RPC y la prueba vuelve a medir lo que quiere: que el
 * evento de todo el día OCUPA dentro de la RPC (409 `turno_ocupado`).
 */
async function turnoDeDiaSinCitas(codigo: string): Promise<{ turno: Turno; desde: number }> {
  for (let desde = 21; desde <= 49; desde += 7) {
    const vistos = new Map<string, boolean>()
    const vacio = (dia: string): boolean => {
      if (!vistos.has(dia)) vistos.set(dia, citasDelDia(dia) === 0)
      return vistos.get(dia) === true
    }
    const turno = (await turnosLibres(e, codigo, desde)).find(t => vacio(diaEnMerida(t.inicio)))
    if (turno) return { turno, desde }
  }
  throw new Error('No hay ningún día sin citas del médico en el horizonte de la reserva')
}

test('punto 5: un evento de todo el día del médico tapa ese día en el enlace; cancelado, vuelve', async () => {
  const { codigo } = emitirEnlace(e, 'unico')
  const { turno: elegido, desde } = await turnoDeDiaSinCitas(codigo)
  const dia = diaEnMerida(elegido.inicio)
  const id = sqlLocal(`
    insert into public.appointments (clinica_id, medico_id, title, start_time, end_time, status, origen, all_day, consultorio_timezone)
    values (:'clinica', :'medico', 'Congreso E2E seg1', (:'dia'::date)::timestamp at time zone 'America/Merida',
            ((:'dia'::date) + 1)::timestamp at time zone 'America/Merida', 'scheduled', 'spinus', true, 'America/Merida')
    returning id;`, { clinica: e.clinicaId, medico: e.medicoId, dia })
  try {
    const delDia = (await turnosLibres(e, codigo, desde)).filter(t => diaEnMerida(t.inicio) === dia)
    expect(delDia).toEqual([])
    const r = await reservar(e, codigo, { inicio: elegido.inicio, persona: personaNueva() })
    expect(r).toMatchObject({ status: 409, cuerpo: { error: 'turno_ocupado' } })
    sqlLocal(`update public.appointments set status = 'cancelled' where id = :'id';`, { id })
    expect((await turnosLibres(e, codigo, desde)).map(t => t.inicio)).toContain(elegido.inicio)
  } finally {
    sqlLocal(`delete from public.appointments where id = :'id';`, { id })
  }
})

test('punto 7b: un nombre con URL, dominio o salto de línea es el 400 genérico y no crea cita', async () => {
  const { codigo } = emitirEnlace(e, 'unico')
  for (const nombre of ['Ana https://pago.evil.mx', 'Ana evil.com', 'Ana\nCita cancelada', 'A'.repeat(81)]) {
    const p = { ...personaNueva(), nombre }
    const r = await reservar(e, codigo, { inicio: turno(), persona: p })
    expect(r, JSON.stringify(nombre)).toEqual({ status: 400, cuerpo: { error: 'solicitud_invalida' } })
    expect(citaDe(p.correo)).toBeNull()
  }
})
