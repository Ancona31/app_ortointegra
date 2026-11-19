import { test, expect, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { SESION, diaDeLaSemana, interruptorAgenda, soloEscritorio, sqlLocal } from './ayudas'
import { codigoDe, contarCorreos, esperarCorreo, type CorreoCapturado } from './mailpit'
import { api, baseUrlPublica, emitirEnlace, ipAlAzar, personaNueva, prepararEscenario, reservar, turnosLibres, type Escenario } from './reservaPublicaAyudas'
import { fechaHoraLocalAInstante } from '../src/lib/dates'

/**
 * Tanda M (M5, puntos 9 a 14 de Angel): los correos REALES de la agenda, leídos
 * de Mailpit (EMAIL_TRANSPORT=captura, ningún correo real), con las maquetas de
 * `docs/spec/`:
 *
 *   · el CÓDIGO para reservar: el código sin espacios en el cuerpo y en la
 *     vista previa, «Continuar mi reserva» con el código en el fragmento;
 *   · el COMPROBANTE: «Cita agendada», «Hola, <nombre>:», la fila «Paciente»,
 *     la hora con «hora de …», «Para tu consulta», el enlace de siempre (que
 *     funciona: con él se cancela la cita al final) y nada clínico;
 *   · la CONFIRMACIÓN que manda el personal: «Pendiente de confirmar», los dos
 *     botones con sus enlaces de siempre, el plazo de 1 hora, «hora de
 *     Yucatán» (Hospital Norte, Mérida) y nada clínico.
 *
 * ⛔ SIN BORRAR NADA (regla de la tanda M sobre `audit_log`): no usa
 * `limpiarReservasE2e`. Las dos citas se CANCELAN con el enlace del propio
 * correo (lo que haría el paciente); el enlace se revoca y el tipo se apaga. Lo
 * que queda lo quita la siguiente siembra, que no borra auditoría.
 *
 * Las mutaciones de la plantilla (vistas en rojo) están en las pruebas de
 * Vitest `plantillaCita`, `correosCita` y `correosReserva`; ésta comprueba que
 * los correos que de verdad salen de las rutas son esos.
 */
soloEscritorio()
test.describe.configure({ mode: 'serial' })
test.use({ storageState: SESION.adminA, extraHTTPHeaders: { 'x-forwarded-for': ipAlAzar() } })

const MAILPIT = 'http://127.0.0.1:54324'
const MEDICO = 'Dr. Admin Semilla Uno'
const ENLACE = /\/confirmar\/([A-Za-z0-9_-]{22})(?=[\s"<?]|$)/
let e: Escenario
let enlaceId = ''
const porCancelar: string[] = []

/** El texto oculto de la vista previa, el HTML leído sin etiquetas y el remitente. */
const vistaPrevia = (html: string): string => /<div style="display:none[^"]*">([^<]*)<\/div>/.exec(html)?.[1]?.trim() ?? ''
const leible = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
async function remitenteDe(id: string): Promise<string> {
  const m: { From?: { Name?: string } } = await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()
  return m.From?.Name ?? ''
}
function enOrden(texto: string, partes: string[]): void {
  let desde = 0
  for (const parte of partes) {
    const i = texto.indexOf(parte, desde)
    expect(i, parte).toBeGreaterThanOrEqual(desde)
    desde = i + parte.length
  }
}

test.beforeAll(() => {
  e = prepararEscenario()
})
test.afterAll(async () => {
  // Cancela con el enlace de cada correo (la base audita la cancelación; nada se borra).
  const ctx = await api()
  try {
    for (const codigo of porCancelar) {
      await ctx.post(`/api/confirmar/${codigo}`, { form: { accion: 'cancelar' }, headers: { origin: baseUrlPublica() }, maxRedirects: 0 })
    }
  } finally {
    await ctx.dispose()
  }
  if (enlaceId) sqlLocal(`update public.reserva_enlaces set revocado_en = now() where id = :'id' and revocado_en is null`, { id: enlaceId })
  sqlLocal(`update public.tipos_cita set activo = false where id = :'t'`, { t: e.tipoId })
  interruptorAgenda('A', false)
})

/** El consultorio del escenario, como lo lee la reserva. */
function consultorioDelEscenario(): { nombre: string; direccion: string; zona: string } {
  const [nombre = '', direccion = '', zona = ''] = sqlLocal(`select nombre, coalesce(direccion, ''), timezone from public.consultorios where id = :'id'`,
    { id: e.consultorioId }).split('|')
  return { nombre, direccion, zona }
}

async function pedirCodigo(fijo: string, correo: string): Promise<CorreoCapturado> {
  const previos = await contarCorreos(correo, 'Tu código para reservar')
  const ctx = await api()
  try {
    expect((await ctx.post(`/api/reservar/${fijo}/codigo`, { data: { correo, consultorio_id: e.consultorioId } })).status()).toBe(200)
  } finally {
    await ctx.dispose()
  }
  return esperarCorreo(correo, 'Tu código para reservar', previos)
}

async function ficha(fijo: string, correo: string, codigo: string): Promise<string> {
  const ctx = await api()
  try {
    const r = await ctx.post(`/api/reservar/${fijo}/verificar`, { data: { correo, codigo } })
    expect(r.status()).toBe(200)
    return ((await r.json()) as { ficha: string }).ficha
  } finally {
    await ctx.dispose()
  }
}

test('código y comprobante de una reserva real, como las maquetas', async () => {
  const p = personaNueva()
  const fijo = emitirEnlace(e, 'fijo')
  enlaceId = fijo.id
  const lugar = consultorioDelEscenario()

  // El código (maqueta correo-codigo-reserva.html, punto 10).
  const m = await pedirCodigo(fijo.codigo, p.correo)
  const cifra = codigoDe(m.texto)
  expect(vistaPrevia(m.html)).toBe(`Tu código es ${cifra}. Vence en 10 minutos.`)
  expect(m.html).toContain(`<span style="padding-left:12px">${cifra}</span>`)
  const continuar = /href="([^"]*)"[^>]*>Continuar mi reserva</.exec(m.html)?.[1]?.replace(/&amp;/g, '&') ?? ''
  expect(continuar).toMatch(new RegExp(`/reservar/${fijo.codigo}#codigo=${cifra}$`))
  enOrden(leible(m.html), [lugar.nombre, MEDICO, 'Tu código para reservar', cifra, 'Vence en 10 minutos', 'Continuar mi reserva',
    'No compartas este código con nadie', 'Enviado con Spinus'])
  expect(await remitenteDe(m.id)).toBe(MEDICO)

  // El comprobante (maqueta correo-cita-paciente.html, punto 11).
  const [t] = await turnosLibres(e, fijo.codigo, 9)
  const previos = await contarCorreos(p.correo, 'Tu cita con')
  expect((await reservar(e, fijo.codigo, { inicio: t?.inicio ?? '', persona: p, ficha: await ficha(fijo.codigo, p.correo, cifra) })).status).toBe(201)
  const c = await esperarCorreo(p.correo, 'Tu cita con', previos)
  const codigo = ENLACE.exec(c.html)?.[1] ?? ''
  expect(codigo).not.toBe('')
  porCancelar.push(codigo)
  enOrden(leible(c.html), [lugar.nombre, MEDICO, 'Cita agendada', `Hola, ${p.nombre}:`, 'Tu cita quedó registrada', ' h ', 'hora de',
    `Médico ${MEDICO}`, `Paciente ${p.nombre}`, 'Confirmar o cancelar mi cita', 'Para tu consulta', 'Llega 10 minutos antes de tu hora.',
    '¿No puedes asistir?', 'Enviado con Spinus'])
  expect(c.html).toMatch(/>\d\d:\d\d h <span[^>]*>&nbsp;hora (de|del) [^<]+<\/span>/)
  expect(c.html).toMatch(new RegExp(`<a href="http[^"]+/confirmar/${codigo}" target="_blank"[^>]*>Confirmar o cancelar mi cita</a>`))
  if (lugar.direccion) expect(leible(c.html)).toContain(`Dirección ${lugar.direccion}`)
  expect(leible(c.html)).not.toMatch(/Cita confirmada|Pendiente de confirmar/)
  for (const cuerpo of [c.asunto, c.texto, c.html]) {
    for (const prohibido of [e.tipoNombre, p.telefono, p.correo]) expect(cuerpo).not.toContain(prohibido)
  }
  expect(await remitenteDe(c.id)).toBe(MEDICO)
})

const TZ = 'America/Merida'
const JUEVES = diaDeLaSemana(3, 3)

/** Una cita de admin.a en el Hospital Norte (Mérida) para «Paciente Prueba 13», con notas que NO deben viajar. */
async function alta(page: Page): Promise<string> {
  const [medico, consultorio, paciente] = sqlLocal(`
    select p.id, co.id, pa.id from auth.users u join public.profiles p on p.id = u.id
      join public.consultorios co on co.medico_id = p.id and co.nombre = 'Hospital Norte (ficticio)'
      join public.pacientes pa on pa.clinica_id = p.clinica_id and pa.apellidos = 'Prueba 13'
     where u.email = 'admin.a@semilla.spinus.test'`).split('|')
  const inicio = fechaHoraLocalAInstante(JUEVES, '12:15', TZ)
  const cuerpo = {
    title: `Paciente M5 ${randomUUID().slice(0, 6)}`, start_time: inicio, end_time: new Date(new Date(inicio).getTime() + 30 * 60_000).toISOString(),
    medico_id: medico, consultorio_id: consultorio, paciente_id: paciente, notes: 'DIAGNOSTICO SECRETO M5', status: 'scheduled',
  }
  let res = await page.request.post('/api/appointments', { data: cuerpo })
  if (res.status() === 409) {
    const { empalmes } = await res.json() as { empalmes: { id: string }[] }
    res = await page.request.post('/api/appointments', { data: { ...cuerpo, empalmes_aceptados: empalmes.map(x => x.id) } })
  }
  expect(res.ok(), await res.text()).toBeTruthy()
  return ((await res.json()) as { appointment: { id: string } }).appointment.id
}

test('la confirmación que manda el personal, como la maqueta, con sus enlaces de siempre', async ({ page }) => {
  const id = await alta(page)
  const para = 'paciente.13@semilla.spinus.test'
  const previos = await contarCorreos(para, 'Confirma tu cita')
  expect((await page.request.post('/api/agenda/correo', { data: { cita_id: id } })).status()).toBe(200)
  const c = await esperarCorreo(para, 'Confirma tu cita', previos)
  const codigo = ENLACE.exec(c.texto)?.[1] ?? ''
  expect(codigo).not.toBe('')
  porCancelar.push(codigo)

  expect(vistaPrevia(c.html)).toMatch(new RegExp(`^Confirma tu cita del jueves \\d+ de \\w+ de \\d{4} a las 12:15 h con ${MEDICO}\\.$`))
  enOrden(leible(c.html), ['Hospital Norte (ficticio)', MEDICO, 'Pendiente de confirmar', 'Hola, Paciente:', 'Tienes una cita próxima',
    'Jueves', '12:15 h', 'hora de Yucatán', 'Confirmo mi asistencia', 'No podré asistir',
    'Puedes cancelar con este botón hasta 1 hora antes de tu cita.', `Médico ${MEDICO}`, 'Consultorio Hospital Norte (ficticio)',
    'Dirección Avenida Ficticia 2, Norte, Mérida', '¿No reconoces esta cita?', 'Enviado con Spinus'])
  expect(c.html).toMatch(/>12:15 h <span[^>]*>&nbsp;hora de Yucatán<\/span>/)
  const url = /(https?:\/\/[^\s/]+\/confirmar\/[A-Za-z0-9_-]{22})/.exec(c.texto)?.[1] ?? ''
  expect(c.html).toMatch(new RegExp(`<a href="${url}\\?paso=confirmar"[^>]*>Confirmo mi asistencia</a>`))
  expect(c.html).toMatch(new RegExp(`<a href="${url}\\?paso=cancelar"[^>]*>No podré asistir</a>`))
  expect(c.texto).toContain(`Confirmar o avisar que no podré asistir: ${url}`)
  expect(`${c.asunto}\n${c.texto}\n${c.html}`).not.toMatch(/DIAGNOSTICO|SECRETO|Paciente M5|Prueba 13/)
  expect(await remitenteDe(c.id)).toBe(MEDICO)
})
