/**
 * Sondas de humo del puente a `private.google_conexiones_secretos`.
 *
 *   npx tsx scripts/gcal-puente-humo.ts
 *
 * ESTA ES LA COMPROBACIÓN QUE DECIDE. La migración
 * `supabase/migrations/20260818_gcal_puente_secretos.sql` trae veinte
 * afirmaciones, y las veinte se responden DENTRO del motor — pero lo que se
 * rompió el 2026-08-17 fue el camino de la aplicación HACIA el motor:
 * `supabase-js` no habla SQL, habla HTTP contra una lista de esquemas
 * expuestos y contra una caché de esquema. Ninguna afirmación SQL puede probar
 * que PostgREST encuentre la función.
 *
 * La secuencia que este script hace imposible: la migración sale en verde → se
 * despliega → `admin.rpc(...)` responde PGRST202 → el fallo cae dentro de
 * `after()`, donde el error se traga, y no llega al médico.
 *
 * ORDEN: (1) aplicar la migración y leer su rejilla, (2) correr esto,
 *        (3) sólo entonces, desplegar.
 *
 * NO ESCRIBE NADA. Las tres sondas de escritura son negativas: se rechazan en
 * la guarda antes de tocar una fila. Desde el cliente no hay subtransacción que
 * deshacer, así que la única prueba de escritura aceptable contra producción es
 * la que no escribe.
 *
 * NO IMPRIME NINGÚN TOKEN, ni truncado. Sólo booleanos, longitudes y códigos.
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { randomUUID } from 'crypto'

config({ path: resolve(process.cwd(), '.env.local') })

// Import RELATIVO y sin alias `@/`: el punto entero de esta comprobación es
// pasar por el MISMO objeto que usa producción, con las mismas variables de
// entorno y sin `db: { schema }`. Una copia del cliente aquí no probaría nada.
import { createAdminClient } from '../src/lib/supabase/admin'

type Estado = 'OK' | 'FALLO' | 'NO PROBADO'

interface Resultado {
  sonda:   string
  titulo:  string
  estado:  Estado
  detalle: string
}

/** Lo que devuelve `leer_conexion_google_con_secretos`, de lo que sólo se mira la forma. */
interface FilaConexion {
  conexion_id:    string
  clinica_id:     string
  tiene_secretos: boolean
  access_token:   string | null
}

/** Error de PostgREST tal como llega por `supabase-js`. */
interface ErrorPostgrest {
  code:    string | null
  message: string
}

const CODIGOS_DE_PUENTE_ROTO: Record<string, string> = {
  PGRST202: 'la función no está en la caché de esquema de PostgREST',
  PGRST203: 'hay una sobrecarga y PostgREST no sabe cuál llamar',
  '42501':  'permission denied — falta el GRANT EXECUTE a service_role',
  '42883':  'la función no existe con esa firma',
  '42P01':  'la relación no existe',
}

const resultados: Resultado[] = []

function anota(sonda: string, titulo: string, estado: Estado, detalle: string): void {
  resultados.push({ sonda, titulo, estado, detalle })
}

function esErrorPostgrest(e: unknown): e is ErrorPostgrest {
  if (typeof e !== 'object' || e === null) return false
  const o = e as Record<string, unknown>
  return typeof o.message === 'string'
}

/** Describe un error sin arrastrar el cuerpo entero de la respuesta. */
function describe(e: unknown): string {
  if (!esErrorPostgrest(e)) return 'error de forma desconocida'
  const codigo = typeof e.code === 'string' ? e.code : 'sin código'
  const pista  = typeof e.code === 'string' && CODIGOS_DE_PUENTE_ROTO[e.code]
    ? ` — ${CODIGOS_DE_PUENTE_ROTO[e.code]}`
    : ''
  return `${codigo}: ${e.message}${pista}`
}

function esFilaConexion(x: unknown): x is FilaConexion {
  if (typeof x !== 'object' || x === null) return false
  const o = x as Record<string, unknown>
  return typeof o.conexion_id === 'string'
      && typeof o.clinica_id === 'string'
      && typeof o.tiene_secretos === 'boolean'
}

/**
 * Las tres sondas negativas comparten criterio: la función tiene que EXISTIR,
 * ser EJECUTABLE, CORRER y RECHAZAR. Un PGRST202 y un P0001 se parecen mucho en
 * un log y no se parecen en nada en lo que significan — distinguirlos es el
 * motivo de que estas sondas existan.
 */
function juzgaRechazoEsperado(
  error: unknown,
  data: unknown,
  literalEsperado: string,
): { estado: Estado; detalle: string } {
  if (error === null || error === undefined) {
    return { estado: 'FALLO', detalle: `no rechazó (data=${JSON.stringify(data) ?? 'null'}) — ¿escribió algo?` }
  }
  if (!esErrorPostgrest(error)) {
    return { estado: 'FALLO', detalle: 'error de forma desconocida' }
  }
  if (error.code !== 'P0001') {
    return { estado: 'FALLO', detalle: describe(error) }
  }
  if (error.message !== literalEsperado) {
    return { estado: 'FALLO', detalle: `rechazó con «${error.message}» y se esperaba «${literalEsperado}»` }
  }
  return { estado: 'OK', detalle: `rechazó con «${literalEsperado}» (P0001): existe, es ejecutable y corrió` }
}

async function main(): Promise<void> {
  for (const v of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const) {
    if (!process.env[v]) {
      console.error(`✖ Falta ${v} en .env.local. Sin eso esto no prueba nada.`)
      process.exit(1)
    }
  }

  const admin = createAdminClient()

  // ── P1 · ¿hay sujeto? ─────────────────────────────────────────────────────
  const p1 = await admin
    .from('clinica_conexiones_google')
    .select('id, clinica_id, user_id')
    .eq('rol', 'clinica')
    .eq('estado', 'activa')

  let conexionId: string | null = null
  let clinicaId:  string | null = null

  if (p1.error) {
    anota('P1', 'leer clinica_conexiones_google con el cliente admin', 'FALLO', describe(p1.error))
  } else if (!p1.data || p1.data.length !== 1) {
    // 0 filas no es «bien»: es que no se comprobó nada. No se despliega sobre
    // una comprobación vacía.
    anota('P1', 'leer clinica_conexiones_google con el cliente admin', 'NO PROBADO',
      `se esperaba exactamente 1 conexión de clínica activa y hay ${p1.data?.length ?? 0}`)
  } else {
    const fila = p1.data[0] as { id: string; clinica_id: string }
    conexionId = fila.id
    clinicaId  = fila.clinica_id
    anota('P1', 'leer clinica_conexiones_google con el cliente admin', 'OK',
      '1 conexión de clínica activa; sujeto resuelto')
  }

  // ── P2 · la lectura real, por RPC ─────────────────────────────────────────
  if (conexionId === null || clinicaId === null) {
    anota('P2', 'rpc leer_conexion_google_con_secretos con los valores reales', 'NO PROBADO',
      'sin sujeto: P1 no resolvió conexión')
  } else {
    const p2 = await admin.rpc('leer_conexion_google_con_secretos', {
      p_clinica_id:  clinicaId,
      p_conexion_id: conexionId,
    })

    if (p2.error) {
      anota('P2', 'rpc leer_conexion_google_con_secretos con los valores reales', 'FALLO', describe(p2.error))
    } else {
      const filas: unknown[] = Array.isArray(p2.data) ? p2.data : []
      const fila = filas.length === 1 && esFilaConexion(filas[0]) ? filas[0] : null
      if (fila === null) {
        anota('P2', 'rpc leer_conexion_google_con_secretos con los valores reales', 'FALLO',
          `se esperaba 1 fila con la forma esperada y llegaron ${filas.length}`)
      } else if (!fila.tiene_secretos) {
        anota('P2', 'rpc leer_conexion_google_con_secretos con los valores reales', 'FALLO',
          'tiene_secretos = false: hay metadata y no hay tokens. Es una anomalía, no «desconectado»')
      } else if (typeof fila.access_token !== 'string') {
        anota('P2', 'rpc leer_conexion_google_con_secretos con los valores reales', 'FALLO',
          `tiene_secretos = true pero access_token no es string (${typeof fila.access_token})`)
      } else {
        // Longitud, nunca el valor.
        anota('P2', 'rpc leer_conexion_google_con_secretos con los valores reales', 'OK',
          `1 fila, tiene_secretos = true, access_token: string de ${fila.access_token.length} caracteres`)
      }
    }
  }

  // ── P3 · la escritora existe y rechaza ────────────────────────────────────
  const p3 = await admin.rpc('guardar_secretos_conexion', {
    p_clinica_id:  randomUUID(),
    p_conexion_id: randomUUID(),
    p_access:      'sonda',
    p_refresh:     null,
    p_expires:     null,
  })
  {
    const j = juzgaRechazoEsperado(p3.error, p3.data, 'conexion_ajena_o_inexistente')
    anota('P3', 'rpc guardar_secretos_conexion con ids aleatorios', j.estado, j.detalle)
  }

  // ── P4 · el alta existe y rechaza ─────────────────────────────────────────
  const p4 = await admin.rpc('alta_conexion_google', {
    p_clinica_id:           randomUUID(),
    p_user_id:              randomUUID(),
    p_rol:                  'clinica',
    p_google_account_sub:   null,
    p_google_account_email: null,
    p_access:               'sonda',
    p_refresh:              null,
    p_expires:              null,
  })
  {
    const j = juzgaRechazoEsperado(p4.error, p4.data, 'perfil_ajeno_a_clinica')
    anota('P4', 'rpc alta_conexion_google con clínica y usuario aleatorios', j.estado, j.detalle)
  }

  // ── P5 · el aislamiento entre clínicas, desde el cliente ──────────────────
  if (conexionId === null) {
    anota('P5', 'rpc leer_conexion_google_con_secretos desde una clínica ajena', 'NO PROBADO',
      'sin sujeto: P1 no resolvió conexión')
  } else {
    const p5 = await admin.rpc('leer_conexion_google_con_secretos', {
      p_clinica_id:  randomUUID(),
      p_conexion_id: conexionId,
    })
    if (p5.error) {
      anota('P5', 'rpc leer_conexion_google_con_secretos desde una clínica ajena', 'FALLO', describe(p5.error))
    } else {
      const filas: unknown[] = Array.isArray(p5.data) ? p5.data : []
      anota('P5', 'rpc leer_conexion_google_con_secretos desde una clínica ajena',
        filas.length === 0 ? 'OK' : 'FALLO',
        filas.length === 0
          ? '0 filas: el filtro por clínica muerde también desde fuera de la base'
          : `devolvió ${filas.length} fila(s) desde una clínica ajena — FUGA ENTRE CLÍNICAS`)
    }
  }

  // ── Informe ───────────────────────────────────────────────────────────────
  const icono: Record<Estado, string> = { 'OK': '✔', 'FALLO': '✖', 'NO PROBADO': '?' }

  console.log('')
  console.log('Sondas del puente a private.google_conexiones_secretos')
  console.log('─'.repeat(78))
  for (const r of resultados) {
    console.log(`${icono[r.estado]} ${r.sonda}  ${r.titulo}`)
    console.log(`     ${r.estado} — ${r.detalle}`)
  }
  console.log('─'.repeat(78))

  const fallos   = resultados.filter((r) => r.estado === 'FALLO').length
  const reservas = resultados.filter((r) => r.estado === 'NO PROBADO').length

  if (fallos > 0 || reservas > 0) {
    console.log(`✖ NO SE DESPLIEGA — ${fallos} en rojo, ${reservas} sin probar.`)
    console.log('  Si es PGRST202, la caché de PostgREST está fría: lanza')
    console.log("  NOTIFY pgrst, 'reload schema'; y repite. La migración entera es idempotente.")
    process.exit(1)
  }

  console.log('✔ Las cinco en verde. El puente se abre desde el cliente real: se puede desplegar.')
  process.exit(0)
}

main().catch((err: unknown) => {
  console.error('✖ El script reventó antes de terminar:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
