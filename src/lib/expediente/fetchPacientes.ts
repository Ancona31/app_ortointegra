// src/lib/expediente/fetchPacientes.ts
// ─────────────────────────────────────────────────────────────────────────────
// Helper de cliente para consumir el API route /api/expediente/listar.
// Mantiene a page.tsx libre de armar URLs y de tipar la respuesta a mano.
// ─────────────────────────────────────────────────────────────────────────────

import type { MedicoChipData } from '@/components/expediente/ChipMedico'

export type OrdenColumna =
  | 'nombre'
  | 'apellidos'
  | 'numero_expediente'
  | 'fecha_nacimiento'
  | 'medico'
  | 'created_at'

export type OrdenDireccion = 'asc' | 'desc'

export interface PacienteExpediente {
  id: string
  numero_expediente: string | null
  nombre: string
  apellidos: string
  fecha_nacimiento: string | null
  sexo: string | null
  created_at: string
  activo: boolean | null
  clinica_id: string
  medicos: MedicoChipData[] | null
}

export interface RespuestaListaExpediente {
  pacientes: PacienteExpediente[]
  hayMas: boolean
  total: number | null
}

export interface ParamsListaExpediente {
  q?: string
  pag?: number
  orden?: OrdenColumna
  direccion?: OrdenDireccion
  medicoId?: string | null
  fechaDesde?: string | null
  fechaHasta?: string | null
  signal?: AbortSignal
}

export async function fetchPacientesExpediente(
  params: ParamsListaExpediente = {},
): Promise<RespuestaListaExpediente> {
  const { q = '', pag = 0, orden, direccion, medicoId, fechaDesde, fechaHasta, signal } = params

  const sp = new URLSearchParams()
  if (q.trim().length > 0) sp.set('q', q.trim())
  if (pag > 0) sp.set('pag', String(pag))
  if (orden) sp.set('orden', orden)
  if (direccion) sp.set('direccion', direccion)
  if (medicoId) sp.set('medico', medicoId)
  if (fechaDesde) sp.set('desde', fechaDesde)
  if (fechaHasta) sp.set('hasta', fechaHasta)

  const url = `/api/expediente/listar${sp.toString() ? `?${sp.toString()}` : ''}`

  const res = await fetch(url, { signal })

  if (!res.ok) {
    let mensaje = 'No se pudo cargar la lista de pacientes'
    try {
      const body = await res.json()
      if (body?.error) mensaje = body.error
    } catch {
      // respuesta sin cuerpo JSON; se conserva el mensaje genérico.
    }
    throw new Error(mensaje)
  }

  const body = (await res.json()) as RespuestaListaExpediente
  return {
    pacientes: body.pacientes ?? [],
    hayMas: Boolean(body.hayMas),
    total: typeof body.total === 'number' ? body.total : null,
  }
}
