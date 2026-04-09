/**
 * GET /api/super-admin/dashboard/audit
 *
 * §5 — Audit log viewer:
 * - Lee audit_log con filtros: q (userId/descripcion), accion, fechaDesde, fechaHasta
 * - Paginado: 50 entradas por página (?page=1)
 * - Exportación CSV: ?format=csv devuelve el stream completo (sin paginación)
 *
 * Usa audit_log directamente (el admin client omite RLS).
 * Los nombres se resuelven contra la tabla profiles.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import type { AuditLogEntry, AuditLogResponse } from '@/lib/super-admin/types'

const PAGE_SIZE = 50

interface AuditRowDb {
  id: string
  user_id: string | null
  accion: string
  tabla: string | null
  registro_id: string | null
  ip: string | null
  descripcion: string | null
  created_at: string
}

interface ProfileRowDb {
  id: string
  nombre: string | null
}

function buildCsvLine(fields: string[]): string {
  return fields
    .map((f) => `"${String(f ?? '').replace(/"/g, '""')}"`)
    .join(',')
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() ?? ''
  const accionFiltro = url.searchParams.get('accion')?.trim() ?? ''
  const fechaDesde = url.searchParams.get('fechaDesde')?.trim() ?? ''
  const fechaHasta = url.searchParams.get('fechaHasta')?.trim() ?? ''
  const pageParam = parseInt(url.searchParams.get('page') ?? '1', 10)
  const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam
  const format = url.searchParams.get('format')?.trim().toLowerCase() ?? ''
  const isCsv = format === 'csv'

  const accionAudit = isCsv ? 'sa_export_audit_csv' : 'sa_ver_audit'

  await logAudit({
    userId: auth.user.id,
    accion: accionAudit,
    descripcion: isCsv ? 'exportación CSV del audit log' : `página ${page}`,
  })

  try {
    const admin = createAdminClient()

    // Build base query
    let countQuery = admin.from('audit_log').select('*', { count: 'exact', head: true })
    let dataQuery = admin
      .from('audit_log')
      .select('id, user_id, accion, tabla, registro_id, ip, descripcion, created_at')
      .order('created_at', { ascending: false })

    // Filters
    if (q) {
      // Search in descripcion or user_id
      dataQuery = dataQuery.or(`descripcion.ilike.%${q}%,user_id.eq.${q}`)
      countQuery = countQuery.or(`descripcion.ilike.%${q}%,user_id.eq.${q}`)
    }
    if (accionFiltro) {
      dataQuery = dataQuery.eq('accion', accionFiltro)
      countQuery = countQuery.eq('accion', accionFiltro)
    }
    if (fechaDesde) {
      dataQuery = dataQuery.gte('created_at', fechaDesde)
      countQuery = countQuery.gte('created_at', fechaDesde)
    }
    if (fechaHasta) {
      // Add 1 day so the filter is inclusive of the selected date
      const hasta = new Date(fechaHasta)
      hasta.setUTCDate(hasta.getUTCDate() + 1)
      dataQuery = dataQuery.lt('created_at', hasta.toISOString())
      countQuery = countQuery.lt('created_at', hasta.toISOString())
    }

    if (isCsv) {
      // Stream the full result set (up to 10 000 rows for safety)
      const csvRes = await dataQuery.limit(10_000)
      if (csvRes.error) throw new Error(csvRes.error.message)
      const rows = (csvRes.data ?? []) as AuditRowDb[]

      // Resolve nombres
      const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[]
      let nombrePorId = new Map<string, string>()
      if (userIds.length > 0) {
        const profilesRes = await admin
          .from('profiles')
          .select('id, nombre')
          .in('id', userIds)
        if (!profilesRes.error) {
          for (const p of (profilesRes.data ?? []) as ProfileRowDb[]) {
            if (p.nombre) nombrePorId.set(p.id, p.nombre)
          }
        }
      }

      const header = buildCsvLine([
        'id',
        'user_id',
        'nombre_usuario',
        'accion',
        'tabla',
        'registro_id',
        'ip',
        'descripcion',
        'created_at',
      ])
      const lines = rows.map((r) =>
        buildCsvLine([
          r.id,
          r.user_id ?? '',
          nombrePorId.get(r.user_id ?? '') ?? '',
          r.accion,
          r.tabla ?? '',
          r.registro_id ?? '',
          r.ip ?? '',
          r.descripcion ?? '',
          r.created_at,
        ]),
      )
      const csv = [header, ...lines].join('\r\n')

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="audit_log_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      })
    }

    // Paginated JSON response
    const offset = (page - 1) * PAGE_SIZE
    dataQuery = dataQuery.range(offset, offset + PAGE_SIZE - 1)

    const [countRes, dataRes] = await Promise.all([countQuery, dataQuery])
    if (countRes.error) throw new Error(countRes.error.message)
    if (dataRes.error) throw new Error(dataRes.error.message)

    const total = countRes.count ?? 0
    const rows = (dataRes.data ?? []) as AuditRowDb[]

    // Resolve nombres en batch
    const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[]
    let nombrePorId = new Map<string, string>()
    if (userIds.length > 0) {
      const profilesRes = await admin
        .from('profiles')
        .select('id, nombre')
        .in('id', userIds)
      if (!profilesRes.error) {
        for (const p of (profilesRes.data ?? []) as ProfileRowDb[]) {
          if (p.nombre) nombrePorId.set(p.id, p.nombre)
        }
      }
    }

    const items: AuditLogEntry[] = rows.map((r) => ({
      id: r.id,
      userId: r.user_id ?? 'anonymous',
      userNombre: r.user_id ? (nombrePorId.get(r.user_id) ?? null) : null,
      accion: r.accion,
      tabla: r.tabla,
      registroId: r.registro_id,
      ip: r.ip,
      descripcion: r.descripcion,
      createdAtIso: r.created_at,
    }))

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    const body: AuditLogResponse = { items, total, page, totalPages }
    return NextResponse.json(body)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
