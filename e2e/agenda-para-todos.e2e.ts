import { test } from '@playwright/test'
import { SESION, interruptorAgenda, sqlLocal } from './ayudas'
import { abrirAgendaApagada, abrirAgendaV2 } from './interaccionesAyudas'

/**
 * Agenda para todos (M3, `20261203120000_agenda_para_todos.sql`) — la agenda
 * v2 encendida por omisión, vista desde el navegador (escritorio y teléfono):
 *   · una clínica SIN fila en `agenda_ajustes` ve la agenda v2 (antes, la de
 *     siempre): la app le pregunta a la base y la base dice «encendida»;
 *   · una fila que dice `false` la sigue apagando (es lo que escriben la
 *     semilla y `global-setup` para que las demás pruebas partan apagadas);
 *   · una fila en `true`, encendida, como siempre.
 *
 * MUTACIÓN (comprobada en rojo): `coalesce(…, false)` en
 * `public.agenda_v2_encendida(uuid)` (la función de antes de M3) → «sin fila…».
 */
test.use({ storageState: SESION.adminA })
test.describe.configure({ mode: 'serial' })

/** La fila de la Clínica Semilla A, fuera (como postgres: nadie más puede borrarla). */
function quitarFila(): void {
  sqlLocal(`delete from public.agenda_ajustes
             where clinica_id = (select id from public.clinicas where nombre = 'Clínica Semilla A');`)
}

/* Deja la v2 APAGADA con fila explícita, como la encontró (regla de la tanda I). */
test.afterAll(() => { interruptorAgenda('A', false) })

test('sin fila en agenda_ajustes: la agenda es la v2', async ({ page }) => {
  quitarFila()
  await abrirAgendaV2(page)
})

test('una fila con false: la agenda es la de siempre', async ({ page }) => {
  interruptorAgenda('A', false)
  await abrirAgendaApagada(page)
})

test('una fila con true: la agenda es la v2', async ({ page }) => {
  interruptorAgenda('A', true)
  await abrirAgendaV2(page)
})
