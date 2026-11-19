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
 * Integración M: la prueba SQL del TRUNCATE puede intentarlo (ver `PRUEBA_DEL_TRUNCATE`); en rojo si
 * pierde su `rollback;` final, si lleva un `delete from public.audit_log` o si otro archivo hace TRUNCATE.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const RAIZ = path.resolve(__dirname, '../../..')
const CARPETAS = ['e2e', 'scripts', 'supabase/pruebas-sql'] as const
const EXTENSIONES = /\.(ts|mjs|js|sh|sql)$/
/** DELETE de `audit_log` (con o sin `public.`) y el `.from('audit_log').delete()` del cliente. */
const BORRA_AUDITORIA = /delete\s+from\s+(only\s+)?("?public"?\.)?"?audit_log\b|from\(\s*['"]audit_log['"]\s*\)\s*\.delete\(/i
/** TRUNCATE de `audit_log`. */
const VACIA_AUDITORIA = /truncate\b[^;]*\baudit_log\b/i
/**
 * La única excepción al TRUNCATE (integración M, encargo de Angel): la prueba de
 * `20261125170000_audit_log_sin_truncate.sql`, que INTENTA vaciar la tabla para comprobar que falla, dentro de
 * subbloques que se deshacen siempre y de una transacción que termina en `rollback`. El DELETE le sigue
 * prohibido, y si deja de terminar en `rollback;` o lleva un `commit`, la guarda la vuelve a señalar.
 */
const PRUEBA_DEL_TRUNCATE = 'supabase/pruebas-sql/m_audit_log_sin_truncate.sql'

function borraAuditoria(archivo: string, texto: string): boolean {
  if (BORRA_AUDITORIA.test(texto)) return true
  if (!VACIA_AUDITORIA.test(texto)) return false
  return !(archivo === PRUEBA_DEL_TRUNCATE && /\brollback;\s*$/i.test(texto) && !/\bcommit\b/i.test(texto))
}

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
    expect(todos).toContain(PRUEBA_DEL_TRUNCATE)
  })
  it('ninguno tiene un DELETE o TRUNCATE de audit_log', () => {
    const culpables = archivos().filter(f => borraAuditoria(f, readFileSync(path.join(RAIZ, f), 'utf8')))
    expect(culpables).toEqual([])
  })
})
