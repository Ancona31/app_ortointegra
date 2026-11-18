import { test, expect, type Page } from '@playwright/test'
import { CORREO, SESION, diaDeLaSemana, enContextoNuevo, interruptorAgenda, irAAgenda, pestanaConfig, sinPendientesAgenda, soloEscritorio, sqlLocal } from './ayudas'
import { aparcarEnlacesVigentes, devolverEnlaces, limpiarReservasE2e, marcaE2e } from './reservaAyudas'
import { aprobarAviso, emitirEnlace, type Escenario } from './reservaPublicaAyudas'

/**
 * Tanda T2 · la configuración guiada de la agenda (puntos 7 a 10 de Angel):
 *
 *   · 7 · «Primeros pasos»: tres pasos con su estado calculado de los datos;
 *     desaparece al completarse (G2: horario → duración → enlace, con avance);
 *   · 8 · al crear un enlace sin duración de la consulta, se PREGUNTA ahí mismo
 *     (G2: ya no se crea «Consulta, 30 min» con un valor fijo) y el enlace se
 *     crea a continuación; el enlace que no abrirá lleva su aviso y su
 *     píldora, con la MISMA regla con la que la página pública dice «Este
 *     enlace ya no está disponible»;
 *   · 9 · cada médico ve su ficha; el administrador, la de todos (la suya
 *     primero, «(tú)»);
 *   · 10 · la rejilla pinta el horario propio del consultorio activo.
 *
 * Lo que se crea se borra al terminar: tipos (FK RESTRICT, la semilla no los
 * limpia), enlaces (`limpiarReservasE2e`) y el horario propio de Rehab.
 *
 * Tanda J (J5, punto 13): «Primeros pasos» es ahora el FUNNEL de primera vez
 * (horario → duración → avisos, y el cierre crea el enlace): lo de los pasos
 * 7 y 8 se comprueba en él. Las pruebas de pestañas dejan antes al médico sin
 * pendientes (`sinPendientesAgenda`; lo que crea lo borra `limpiar()`).
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
/** Tanda I (punto 3): los consultorios de la clínica A que nadie había confirmado; aquí se dan por
    revisados (lo que se prueba es lo de G2) y al terminar vuelven a «por revisar». Ver agenda-i4. */
let revisadosAqui = ''

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
  revisadosAqui = sqlLocal(`update public.consultorios set horario_revisado_en = now()
    where clinica_id = :'c' and horario_revisado_en is null returning id`, { c: clinicaA() }).split('\n').filter(Boolean).join(',')
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
      } finally {
        try { borrarCentinelas() } finally {
          sqlLocal(`update public.consultorios set horario_revisado_en = null where id = any (string_to_array(:'r', ',')::uuid[])`, { r: revisadosAqui })
        }
      }
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

const enlaces = (page: Page) => page.getByRole('tabpanel', { name: 'Tu enlace' })
/** Tanda H, punto 6: los enlaces de los médicos invitados van plegados; esto los despliega. */
async function abrirDemas(page: Page): Promise<void> {
  await pestanaConfig(page, 'Tu enlace')
  const boton = enlaces(page).getByRole('button', { name: /Enlaces de los demás médicos/ })
  if ((await boton.getAttribute('aria-expanded')) !== 'true') await boton.click()
}

test('G2 · 7 y 8 · el funnel abre en el primer paso que falta (la duración); el enlace se crea después, al cerrar', async ({ page }) => {
  await page.goto(RUTA)
  // El horario ya está (revisado en `beforeAll`): abre en la duración, «Paso 3 de 4» (K3: el de la clínica va antes).
  await expect(page.getByRole('heading', { name: '¿Cuánto dura tu consulta?' })).toBeVisible()
  await expect(page.getByText('Paso 3 de 4 · menos de 2 minutos')).toBeVisible()
  await expect(page.getByRole('tablist')).toHaveCount(0)
  // Ningún tipo nace con un valor fijo: no hay botón «Crear «Consulta», 30 min».
  await expect(page.getByRole('button', { name: /Consulta», 30 min/ })).toHaveCount(0)
  expect(sqlLocal(`select count(*) from public.tipos_cita t join auth.users u on u.id = t.medico_id where u.email = :'c' and t.activo`,
    { c: CORREO.adminA })).toBe('0')

  await page.getByRole('button', { name: '45 min' }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByRole('heading', { name: '¿Mandamos avisos por correo?' })).toBeVisible()
  await page.getByRole('button', { name: 'Terminar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tu agenda ya está lista' })).toBeVisible()
  await expect(page.locator('[data-enlace-fijo]')).toHaveText(/\/reservar\/[A-Za-z0-9_-]{8,}$/)
  expect(sqlLocal(`select t.duracion_min || '|' || t.principal || '|' || (t.consultorio_id is null) from public.tipos_cita t
                    join auth.users u on u.id = t.medico_id where u.email = :'c' and t.activo`, { c: CORREO.adminA })).toBe('45|true|true')
  expect(sqlLocal(`select count(*) from public.reserva_enlaces e join auth.users u on u.id = e.medico_id
                    where u.email = :'c' and e.clase = 'fijo' and e.revocado_en is null`, { c: CORREO.adminA })).toBe('1')
  /* Calculado, no guardado: al recargar, nada pendiente → las pestañas, en la primera. */
  await page.reload()
  await expect(page.getByRole('tab', { name: 'Tu enlace' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('heading', { name: '¿Cuánto dura tu consulta?' })).toHaveCount(0)
})

test('G2 · 9 · la médica invitada contesta SU duración (sólo suya), la cambia y quita sus tipos', async ({ browser }) => {
  await enContextoNuevo(browser, SESION.medicoA, async (p) => {
    await p.goto(RUTA)
    await expect(p.getByRole('heading', { name: '¿Cuánto dura tu consulta?' })).toBeVisible()
    await p.getByRole('button', { name: '60 min' }).click()
    await p.getByRole('button', { name: 'Continuar' }).click()
    await expect(p.getByRole('heading', { name: '¿Mandamos avisos por correo?' })).toBeVisible()
    // Los avisos son de la clínica: ella los ve, no los cambia.
    await expect(p.getByText('Estos avisos los cambia quien administra la clínica.')).toBeVisible()
    await p.getByRole('button', { name: 'Terminar', exact: true }).click()
    await expect(p.getByRole('heading', { name: 'Tu agenda ya está lista' })).toBeVisible()
    await p.reload()
    await pestanaConfig(p, 'Tu consulta')
    const seccion = p.getByRole('tabpanel', { name: 'Tu consulta' })
    await expect(seccion).toContainText('Tu consulta dura 60 minutos.')
    await expect(seccion).not.toContainText('pídele a quien administra')
    /* G2b (20261119121000): la cambia ella misma… */
    await seccion.getByRole('button', { name: '45 min' }).click()
    await expect(seccion).toContainText('Tu consulta dura 45 minutos.')
    /* …y quita un tipo suyo (la fila es suya: Editar y Quitar). */
    await seccion.getByRole('button', { name: 'Agregar tipo de cita' }).click()
    await seccion.getByLabel('Nombre').fill('Curación e2e')
    await seccion.getByLabel('Duración (min)').fill('20')
    await seccion.getByRole('button', { name: 'Agregar', exact: true }).click()
    const fila = seccion.getByRole('group', { name: 'Curación e2e' })
    await expect(fila.getByRole('button', { name: 'Editar Curación e2e' })).toBeVisible()
    await fila.getByRole('button', { name: 'Quitar Curación e2e' }).click()
    // Quitado pasa a «Quitados (N)», plegado (maqueta): se abre y ahí está, con «Reactivar».
    await seccion.getByText(/^Quitados \(\d+\)$/).click()
    await expect(seccion.getByRole('button', { name: 'Reactivar Curación e2e' })).toBeVisible()
  })
  expect(sqlLocal(`select t.duracion_min || '|' || t.principal || '|' || (t.medico_id = u.id) || '|' || t.activo from public.tipos_cita t
                    join auth.users u on u.email = :'c' where t.clinica_id = :'cl' and t.principal`,
  { c: CORREO.medicoA, cl: clinicaA() })).toBe('45|true|true|true')
  expect(sqlLocal(`select (t.medico_id = u.id) || '|' || t.activo from public.tipos_cita t join auth.users u on u.email = :'c'
                    where t.nombre = 'Curación e2e'`, { c: CORREO.medicoA })).toBe('true|false')
})

test('G2 · 7 · duración distinta en un consultorio: opción discreta en «Tu consulta», sólo ahí', async ({ browser }) => {
  sqlLocal(`insert into public.tipos_cita (clinica_id, medico_id, nombre, duracion_min, principal)
            select :'cl', id, 'Consulta', 45, true from auth.users where email = :'c'`, { cl: clinicaA(), c: CORREO.medicoA })
  sinPendientesAgenda(CORREO.medicoA)
  await enContextoNuevo(browser, SESION.medicoA, async (p) => {
    await p.goto(RUTA)
    await pestanaConfig(p, 'Tu consulta')
    const fila = p.getByRole('tabpanel', { name: 'Tu consulta' }).getByRole('group', { name: REHAB, exact: true })
    await fila.getByRole('button', { name: 'Otra duración en este consultorio' }).click()
    await fila.getByText('1 hora', { exact: true }).click()
    await fila.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(fila).toContainText('Aquí la consulta dura 60 min (en los demás, 45 min)')
  })
  expect(sqlLocal(`select string_agg(t.duracion_min || ':' || coalesce(c.nombre, '-'), ',' order by t.duracion_min)
                     from public.tipos_cita t left join public.consultorios c on c.id = t.consultorio_id
                     join auth.users u on u.id = t.medico_id where u.email = :'c' and t.activo`, { c: CORREO.medicoA })).toBe(`45:-,60:${REHAB}`)
})

test('8 · el enlace que no abrirá lo dice con la regla de la página pública', async ({ page, browser }) => {
  const e: Escenario = {
    clinicaId: clinicaA(), medicoId: idDe(CORREO.medicoA), consultorioId: '', consultorioTelefono: null,
    consultorioOtraClinica: '', tipoId: '', tipoNombre: '',
  }
  const { codigo } = emitirEnlace(e, 'fijo')
  sinPendientesAgenda(CORREO.adminA)
  await page.goto(RUTA)
  await abrirDemas(page)
  const fila = enlaces(page).getByRole('listitem').filter({ hasText: 'Enlace fijodesde el' })
  await expect(fila).toContainText('No abrirá: falta la duración de la consulta del médico.')
  /* G2 · la píldora de estado y «Completar», que abre lo que falta ahí mismo. */
  await expect(fila).toContainText('No abrirá')
  // La ficha propia ya no existe (J5: «Tu enlace» arriba, sin ficha); «Completar» abre lo de la invitada.
  const notas = enlaces(page).getByRole('note', { name: 'Falta para que el enlace abra' })
  await expect(notas).toHaveCount(0)
  await fila.getByRole('button', { name: 'Completar Enlace fijo' }).click()
  await expect(notas).toHaveCount(1)
  await expect(notas).toContainText('La duración de la consulta.')
  await expect(notas).toContainText('¿Cuánto dura su consulta?')
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
  await abrirDemas(page)
  await expect(fila).toContainText('Abrirá sin horarios: ningún consultorio del médico tiene días abiertos.')

  /* El aviso de privacidad sin aprobar: la página da 404 y la ficha, «No abrirá». */
  aprobarAviso(false)
  await page.reload()
  await abrirDemas(page)
  await expect(fila).toContainText('No abrirá: la clínica no puede recibir reservas ahora')
})

test('9 · el administrador ve su enlace arriba y la ficha de cada médico plegada; la invitada sólo el suyo', async ({ page, browser }) => {
  sinPendientesAgenda(CORREO.adminA)
  sinPendientesAgenda(CORREO.medicoA)
  await page.goto(RUTA)
  await pestanaConfig(page, 'Tu enlace')
  await expect(enlaces(page).getByRole('switch', { name: /^Prendido/ })).toBeVisible()
  const titulos = enlaces(page).getByRole('heading', { level: 4 })
  // Tanda H, punto 6: la de la invitada, plegada hasta pulsar.
  await expect(titulos).toHaveCount(0)
  await abrirDemas(page)
  await expect(titulos).toHaveText([/Invitada Semilla Dos/])
  await enContextoNuevo(browser, SESION.medicoA, async (p) => {
    await p.goto(RUTA)
    await pestanaConfig(p, 'Tu enlace')
    await expect(p.getByRole('heading', { name: 'Tu enlace', level: 2 })).toBeVisible()
    await expect(enlaces(p).getByRole('switch', { name: /^Prendido/ })).toBeVisible()
    await expect(enlaces(p).getByRole('heading', { level: 4 })).toHaveCount(0)
    await expect(enlaces(p).getByRole('button', { name: /Enlaces de los demás médicos/ })).toHaveCount(0)
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
