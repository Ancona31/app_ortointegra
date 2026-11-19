/**
 * pruebasSinBorrarAuditoria.test.ts — Tanda M (punto 17 de Angel, 2026-11-19, literal): «No vuelvas a
 * borrar filas de audit_log, tampoco en local ni de pruebas.» Ni con DELETE, ni con TRUNCATE, ni
 * saltándose `prevent_audit_delete` con `session_replication_role = replica`.
 *
 * Hasta la tanda L, las dos carreras (`scripts/*-carrera.sh`) y 22 archivos de `e2e/` borraban como
 * `postgres` las filas de auditoría de lo que limpiaban. Esta guarda lee las pruebas, los guiones y las
 * pruebas SQL y falla si alguno vuelve a hacerlo. Una prueba que necesite contar auditoría filtra por
 * sus propios ids o por marca de tiempo (`created_at >= …`).
 *
 * MUTACIÓN (en rojo): volver a poner `delete from public.audit_log where …` en `e2e/reservaAyudas.ts`.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const RAIZ = path.resolve(__dirname, '../../..')
const CARPETAS = ['e2e', 'scripts', 'supabase/pruebas-sql'] as const
const EXTENSIONES = /\.(ts|mjs|js|sh|sql)$/
/** DELETE o TRUNCATE de `audit_log` (con o sin `public.`), y el `.from('audit_log').delete()` del cliente. */
const BORRA_AUDITORIA = /delete\s+from\s+(only\s+)?("?public"?\.)?"?audit_log\b|truncate\b[^;]*\baudit_log\b|from\(\s*['"]audit_log['"]\s*\)\s*\.delete\(/i

/** Los archivos de primer nivel de cada carpeta (las capturas y resultados de `e2e/resultados/` no son código). */
function archivos(): string[] {
  return CARPETAS.flatMap(c => readdirSync(path.join(RAIZ, c), { withFileTypes: true })
    .filter(f => f.isFile() && EXTENSIONES.test(f.name))
    .map(f => path.join(c, f.name)))
}

describe('ninguna prueba ni guion borra filas de audit_log (orden de Angel, tanda M)', () => {
  it('lee algo: las carpetas existen y tienen los archivos de siempre', () => {
    const todos = archivos()
    expect(todos).toContain('e2e/reservaAyudas.ts')
    expect(todos).toContain('scripts/reserva-carrera.sh')
    expect(todos).toContain('scripts/confirmacion-carrera.sh')
  })
  it('ninguno tiene un DELETE o TRUNCATE de audit_log', () => {
    const culpables = archivos().filter(f => BORRA_AUDITORIA.test(readFileSync(path.join(RAIZ, f), 'utf8')))
    expect(culpables).toEqual([])
  })
})
