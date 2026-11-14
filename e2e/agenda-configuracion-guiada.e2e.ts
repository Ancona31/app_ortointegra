import { test, expect, type Page } from '@playwright/test'
import { CORREO, SESION, diaDeLaSemana, enContextoNuevo, interruptorAgenda, irAAgenda, soloEscritorio, sqlLocal, toastConTexto } from './ayudas'
import { aparcarEnlacesVigentes, devolverEnlaces, limpiarReservasE2e, marcaE2e } from './reservaAyudas'
import { aprobarAviso, emitirEnlace, type Escenario } from './reservaPublicaAyudas'

/**
 * Tanda T2 · la configuración guiada de la agenda (puntos 7 a 10 de Angel):
 *
 *   · 7 · «Para empezar»: tres pasos con su estado calculado de los datos;
 *     desaparece al completarse;
 *   · 8 · al crear un enlace sin tipo de cita, la ficha lo pide ahí mismo con
 *     «Consulta, 30 min» en un clic; el enlace que no abrirá lleva su aviso,
 *     con la MISMA regla con la que la página pública dice «Este enlace ya no
 *     está disponible»;
 *   · 9 · cada médico ve su ficha; el administrador, la de todos (la suya
 *     primero, «(tú)»);
 *   · 10 · la rejilla pinta el horario propio del consultorio activo.
 *
 * Lo que se crea se borra al terminar: tipos (FK RESTRICT, la semilla no los
 * limpia), enlaces (`limpiarReservasE2e`) y el horario propio de Rehab.
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })

const RUTA = '/agenda/configuracion'
const REHAB = 'Rehabilitación (ficticio)'
const LUNES_SOLO_MANANA = `'{"lunes":{"activo":true,"inicio":"08:00","fin":"12:00"},"martes":{"activo":false,"inicio":"08:00","fin":"18:00"},
  "miercoles":{"activo":false,"inicio":"08:00","fin":"18:00"},"jueves":{"activo":false,"inicio":"08:00","fin":"18:00"},
  "viernes":{"activo":false,"inicio":"08:00","fin":"18:00"},"sabado":{"activo":false,"inicio":"08:00","fin":"13:00"},
  "domingo":{"activo":false,"inicio":"08:00","fin":"13:00"}}'::jsonb`

const idDe = (correo: string) => sqlLocal(`select id from auth.users where email = :'c'`, { c: correo })
const clinicaA = () => sqlLocal(`select id from public.clinicas where nombre = 'Clínica Semilla A'`)

/** El horario de Rehab tal como lo dejó la semilla, para devolverlo al terminar. */
let horarioRehab = ''
/** Lo creado desde aquí es de este archivo: lo único que limpian `limpiar()` y `limpiarReservasE2e`. */
let desde = ''
/** Los tipos de cita activos que había (los de la semilla o hechos a mano): se
    aparcan (inactivos) para que la prueba empiece «sin tipos» y se devuelven. */
let tiposAparcados: string[] = []
/** Lo mismo con los enlaces vigentes (un enlace fijo hecho a mano chocaría con «Crear enlace fijo»). */
let enlacesAparcados: string[] = []

/**
 * CENTINELAS · lo que alguien hizo A MANO en la Clínica A antes de la prueba
 * (un tipo de cita y un enlace de un solo uso ya revocado). Hasta el
 * 2026-11-13 este archivo borraba todos los tipos de la clínica y
 * `limpiarReservasE2e` todos los enlaces: se llevaron un tipo y un enlace de
 * Angel. La última prueba comprueba que siguen ahí.
 */
const CENTINELA_TIPO = 'Cita a mano (centinela e2e)'
let centinelaEnlace = ''

function crearCentinelas(): void {
  sqlLocal(`insert into public.tipos_cita (clinica_id, nombre, duracion_min, activo, created_at)
            values (:'c', :'n', 45, true, now() - interval '2 days')`, { c: clinicaA(), n: CENTINELA_TIPO })
  centinelaEnlace = sqlLocal(`
    insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash, vigencia_dias, caduca_en, revocado_en, created_at)
    values (gen_random_uuid(), :'c', :'m', 'unico', encode(sha256(gen_random_uuid()::text::bytea), 'hex'), 7, now() + interval '5 days',
            now() - interval '1 day', now() - interval '2 days')
    returning id;`, { c: clinicaA(), m: idDe(CORREO.adminA) })
}

function borrarCentinelas(): void {
  sqlLocal(`
    begin;
    set local session_replication_role = replica;
    delete from public.audit_log where registro_id = :'e'::uuid
       or registro_id in (select id from public.tipos_cita where nombre = :'n');
    delete from public.reserva_enlaces where id = :'e'::uuid;
    delete from public.tipos_cita where nombre = :'n';
    commit;`, { e: centinelaEnlace || '00000000-0000-0000-0000-000000000000', n: CENTINELA_TIPO })
}

function limpiar(): void {
  limpiarReservasE2e(desde)
  sqlLocal(`delete from public.tipos_cita where clinica_id = :'c' and created_at >= :'d'::timestamptz`, { c: clinicaA(), d: desde })
  sqlLocal(`update public.consultorios set horario_propio = false, horario = :'h'::jsonb where nombre = :'n'`, { n: REHAB, h: horarioRehab })
}

test.beforeAll(() => {
  horarioRehab = sqlLocal(`select horario::text from public.consultorios where nombre = :'n'`, { n: REHAB })
  crearCentinelas()
  tiposAparcados = sqlLocal(`update public.tipos_cita set activo = false where clinica_id = :'c' and activo returning id`, { c: clinicaA() })
    .split('\n').filter(Boolean)
  enlacesAparcados = aparcarEnlacesVigentes()
  desde = marcaE2e()
})
test.afterAll(() => {
  /* Cada paso aunque falle el anterior: lo aparcado se devuelve siempre. */
  try { limpiarReservasE2e(desde) } finally {
    try { devolverEnlaces(enlacesAparcados) } finally {
      try {
        if (tiposAparcados.length) {
          sqlLocal(`update public.tipos_cita set activo = true where id = any (string_to_array(:'ids', ',')::uuid[])`, { ids: tiposAparcados.join(',') })
        }
      } finally { borrarCentinelas() }
    }
  }
})

test.beforeEach(() => {
  limpiar()
  interruptorAgenda('A', true)
  aprobarAviso(true)
})
test.afterEach(() => {
  limpiar()
  interruptorAgenda('A', false)
})

const enlaces = (page: Page) => page.getByRole('region', { name: 'Enlaces de reserva' })
const pasos = (page: Page) => page.getByRole('region', { name: 'Para empezar' })

test('7 y 8 · sin tipo de cita: «Para empezar» lo marca, la ficha lo pide y un clic lo resuelve; al completar, la lista se va', async ({ page }) => {
  await page.goto(RUTA)
  await expect(pasos(page).getByRole('listitem', { name: 'Horario y disponibilidad: hecho' })).toBeVisible()
  await expect(pasos(page).getByRole('listitem', { name: 'Tipos de cita: pendiente' })).toBeVisible()
  await expect(pasos(page).getByRole('listitem', { name: 'Enlace de reserva: pendiente' })).toBeVisible()

  const ficha = enlaces(page).getByRole('note', { name: 'Falta para que el enlace abra' }).first()
  await expect(ficha).toContainText('Un tipo de cita.')
  await ficha.getByRole('button', { name: 'Crear «Consulta», 30 min' }).click()
  await expect(toastConTexto(page, 'Tipo de cita «Consulta» creado')).toBeVisible()
  await expect(enlaces(page).getByRole('note', { name: 'Falta para que el enlace abra' })).toHaveCount(0)
  await expect(pasos(page).getByRole('listitem', { name: 'Tipos de cita: hecho' })).toBeVisible()
  expect(sqlLocal(`select duracion_min || '|' || (medico_id is null) from public.tipos_cita where nombre = 'Consulta' and activo`)).toBe('30|true')

  await enlaces(page).getByRole('button', { name: 'Crear enlace fijo' }).first().click()
  await expect(toastConTexto(page, 'Enlace fijo creado')).toBeVisible()
  await expect(pasos(page)).toHaveCount(0)
  /* Calculado, no guardado: al recargar sigue sin salir. */
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Enlaces de reserva' })).toBeVisible()
  await expect(pasos(page)).toHaveCount(0)
})

test('8 · el enlace que no abrirá lo dice con la regla de la página pública', async ({ page, browser }) => {
  const e: Escenario = {
    clinicaId: clinicaA(), medicoId: idDe(CORREO.medicoA), consultorioId: '', consultorioTelefono: null,
    consultorioOtraClinica: '', tipoId: '', tipoNombre: '',
  }
  const { codigo } = emitirEnlace(e, 'fijo')
  await page.goto(RUTA)
  const fila = enlaces(page).getByRole('listitem').filter({ hasText: 'Enlace fijodesde el' })
  await expect(fila).toContainText('No abrirá: no hay un tipo de cita para este médico.')
  /* La misma regla, del lado del paciente: el mensaje genérico. */
  const anonimo = await browser.newContext()
  try {
    const p = await anonimo.newPage()
    await p.goto(`/reservar/${codigo}`)
    await expect(p.getByText('Este enlace ya no está disponible')).toBeVisible()
  } finally {
    await anonimo.close()
  }

  /* Con tipo pero sin ningún día abierto: abre (como hoy) y se avisa a la clínica. */
  sqlLocal(`insert into public.tipos_cita (clinica_id, nombre, duracion_min, activo) values (:'c', 'Consulta', 30, true)`, { c: e.clinicaId })
  sqlLocal(`update public.consultorios set horario_propio = true,
              horario = jsonb_set(${LUNES_SOLO_MANANA}, '{lunes,activo}', 'false') where nombre = :'n'`, { n: REHAB })
  await page.reload()
  await expect(fila).toContainText('Abrirá sin horarios: ningún consultorio del médico tiene días abiertos.')

  /* El aviso de privacidad sin aprobar: la página da 404 y la ficha, «No abrirá». */
  aprobarAviso(false)
  await page.reload()
  await expect(fila).toContainText('No abrirá: la clínica no puede recibir reservas ahora')
})

test('9 · el administrador ve la ficha de cada médico, la suya primero; la invitada sólo la suya', async ({ page, browser }) => {
  await page.goto(RUTA)
  const titulos = enlaces(page).getByRole('heading', { level: 4 })
  await expect(titulos.first()).toHaveText('Dr. Admin Semilla Uno (tú)')
  await expect(titulos).toHaveCount(2)
  await enContextoNuevo(browser, SESION.medicoA, async (p) => {
    await p.goto(RUTA)
    await expect(p.getByRole('heading', { name: 'Enlaces de reserva' })).toBeVisible()
    await expect(enlaces(p).getByRole('heading', { level: 4 })).toHaveCount(0)
    await expect(enlaces(p).getByRole('button', { name: 'Crear enlace fijo' })).toHaveCount(1)
  })
})

/** ¿La hora `hora` del día `fecha` cae en una franja gris de «fuera de horario»? */
function enFueraDeHorario(page: Page, fecha: string, hora: string): Promise<boolean> {
  return page.evaluate(([f, h]) => {
    const lane = document.querySelector(`td.fc-timegrid-slot-lane[data-time="${h}"]`)?.getBoundingClientRect()
    const col = document.querySelector(`.fc-timegrid-col[data-date="${f}"]`)
    if (!lane || !col) return false
    const y = lane.top + lane.height / 2
    return Array.from(col.querySelectorAll('.fc-non-business')).some(e => {
      const r = e.getBoundingClientRect()
      return r.top <= y && y < r.bottom
    })
  }, [fecha, hora])
}

test('10 · la rejilla de la invitada pinta el horario propio de su consultorio; apagada, el de la clínica', async ({ browser }) => {
  sqlLocal(`update public.consultorios set horario_propio = true, horario = ${LUNES_SOLO_MANANA} where nombre = :'n'`, { n: REHAB })
  const lunes = diaDeLaSemana(0, 0)
  await enContextoNuevo(browser, SESION.medicoA, async (p) => {
    await irAAgenda(p)
    /* Lunes 13:00: dentro del horario de la clínica (08–18), fuera del propio (08–12). */
    await expect.poll(() => enFueraDeHorario(p, lunes, '13:00:00')).toBe(true)
    expect(await enFueraDeHorario(p, lunes, '10:00:00')).toBe(false)
    interruptorAgenda('A', false)
    await irAAgenda(p)
    await expect.poll(() => enFueraDeHorario(p, lunes, '13:00:00')).toBe(false)
  })
})

test('lo hecho a mano antes de la prueba sigue ahí: el tipo de cita (aparcado) y el enlace', () => {
  /* Las limpiezas ya corrieron antes y después de cada prueba de este archivo. */
  expect(sqlLocal(`select activo from public.tipos_cita where nombre = :'n'`, { n: CENTINELA_TIPO })).toBe('f')
  expect(sqlLocal(`select count(*) from public.reserva_enlaces where id = :'e'::uuid and revocado_en is not null`, { e: centinelaEnlace })).toBe('1')
})
