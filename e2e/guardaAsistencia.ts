import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter'
import { execFileSync } from 'node:child_process'

/**
 * Guarda de la batería (AG-DT-256): ninguna prueba puede dejar una cita que
 * dispare la ventana «¿Asistió el paciente?» según el DÍA en que se corre.
 *
 * La ventana (`src/lib/agenda/asistenciaServidor.ts`) pregunta por las citas
 * agendadas o confirmadas, con hora, con paciente o reserva y sin nota ligada,
 * que empezaron hace más de 48 h. Una cita que una prueba crea el miércoles de
 * la semana visible no la dispara de lunes a jueves y sí de viernes a domingo:
 * tapa la rejilla y tumba las pruebas de la v2 que vienen después.
 *
 * Qué hace: tras CADA prueba aplica la misma regla, pero con el reloj puesto en
 * el PEOR momento de la semana (el final del domingo). Lo que la regla
 * encuentre y no estuviera ya al empezar la batería lo dejó una prueba: se
 * apunta a la que acababa de terminar y la corrida sale en rojo, se corra el
 * día que se corra. Lo que la semilla deja abierto en la semana visible queda
 * fuera (está en la base antes de la primera prueba): la semilla se calcula
 * desde hoy y cierra sola lo que ya pasó.
 *
 * Sólo lee. Habla con el contenedor local, como `sqlLocal` de `ayudas.ts`.
 *
 * Una prueba que NECESITA una cita vieja (las que prueban la ventana) la borra
 * o la cierra antes de terminar; si no puede, lleva la anotación
 * `asistencia-a-proposito` y la guarda no la cuenta en esa prueba (sí en la
 * siguiente, si sigue ahí).
 */
const CONTENEDOR_DB = 'supabase_db_app_ortointegra'
const ZONA = 'America/Merida'
export const ANOTACION_A_PROPOSITO = 'asistencia-a-proposito'

/** Las citas que la ventana preguntaría al final del domingo de la semana en que arrancó la batería. */
const SQL_CANDIDATAS = `
  select a.id || '|' || to_char(a.start_time at time zone :'zona', 'Dy DD Mon HH24:MI') || '|' || a.status
         || '|' || coalesce(a.reserva_nombre, a.title, '') || '|' || to_char(a.created_at at time zone :'zona', 'HH24:MI:SS')
  from public.appointments a
  where a.status in ('scheduled', 'confirmed') and not a.all_day
    and (a.paciente_id is not null or a.reserva_canal is not null)
    and a.start_time < (:'lunes_siguiente'::timestamp at time zone :'zona') - interval '48 hours'
    and not exists (select 1 from public.consultas c where c.appointment_id = a.id)
  order by a.created_at;`

function consultar(lunesSiguiente: string): Map<string, string> {
  const salida = execFileSync('docker', ['exec', '-i', CONTENEDOR_DB, 'psql', '-U', 'postgres', '-X', '-tAq',
    '-v', 'ON_ERROR_STOP=1', '-v', `zona=${ZONA}`, '-v', `lunes_siguiente=${lunesSiguiente}`, '-f', '-'],
  { input: SQL_CANDIDATAS, encoding: 'utf8' })
  const filas = new Map<string, string>()
  for (const linea of salida.split('\n').filter(Boolean)) filas.set(linea.slice(0, linea.indexOf('|')), linea)
  return filas
}

/** El lunes siguiente al de hoy, 00:00, en la zona de las pruebas (`AAAA-MM-DD 00:00`). */
function lunesSiguienteDe(ahora: Date): string {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(ahora)
  const d = new Date(`${hoy}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 7 - ((d.getUTCDay() + 6) % 7))
  return `${d.toISOString().slice(0, 10)} 00:00`
}

interface Hallazgo { prueba: string; fila: string }

export default class GuardaAsistencia implements Reporter {
  private readonly lunesSiguiente = lunesSiguienteDe(new Date())
  private conocidas: Set<string> | null = null
  private readonly hallazgos: Hallazgo[] = []

  /** La línea base se toma al empezar la primera prueba: la semilla ya corrió. */
  onTestBegin(): void {
    if (this.conocidas === null) this.conocidas = new Set(consultar(this.lunesSiguiente).keys())
  }

  onTestEnd(prueba: TestCase, resultado: TestResult): void {
    if (this.conocidas === null) return
    const anotaciones = [...prueba.annotations, ...resultado.annotations]
    if (anotaciones.some(a => a.type === ANOTACION_A_PROPOSITO)) return
    const donde = `${prueba.location.file.split('/').pop() ?? ''}:${prueba.location.line} › ${prueba.title}`
    for (const [id, fila] of consultar(this.lunesSiguiente)) {
      if (this.conocidas.has(id)) continue
      this.conocidas.add(id)
      this.hallazgos.push({ prueba: donde, fila })
    }
  }

  async onEnd(): Promise<{ status?: FullResult['status'] } | undefined> {
    if (this.hallazgos.length === 0) {
      console.log('\nGuarda de asistencia: ninguna prueba dejó citas que dependan del día de la corrida.')
      return undefined
    }
    console.error(`\nGuarda de asistencia: ${this.hallazgos.length} cita(s) dispararían «¿Asistió el paciente?» ` +
      'al final de la semana (AG-DT-256). Cada una, con la prueba tras la que apareció:')
    for (const h of this.hallazgos) console.error(`  ✘ ${h.prueba}\n      ${h.fila}`)
    return { status: 'failed' }
  }

  printsToStdio(): boolean { return false }
}
