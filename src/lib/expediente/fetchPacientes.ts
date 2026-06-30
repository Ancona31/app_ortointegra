// src/lib/expediente/fetchPacientes.ts
// ─────────────────────────────────────────────────────────────────────────────
// Helper de cliente para consumir el API route /api/expediente/listar.
// Mantiene a page.tsx libre de armar URLs y de tipar la respuesta a mano.
// ─────────────────────────────────────────────────────────────────────────────

import type { MedicoChipData } from '@/components/expediente/ChipMedico'

// Fila tal como la expone el API route (calza con el RETURNS TABLE del RPC).
export interface PacienteExpediente {
  id: string
  numero_expediente: string | null
  nombre: string
  apellidos: string
  fecha_nacimiento: string | null // 'YYYY-MM-DD'
  sexo: string | null
  created_at: string // ISO timestamptz
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
  signal?: AbortSignal
}

export async function fetchPacientesExpediente(
  params: ParamsListaExpediente = {},
): Promise<RespuestaListaExpediente> {
  const { q = '', pag = 0, signal } = params

  const sp = new URLSearchParams()
  if (q.trim().length > 0) sp.set('q', q.trim())
  if (pag > 0) sp.set('pag', String(pag))

  const url = `/api/expediente/listar${sp.toString() ? `?${sp.toString()}` : ''}`

  const res = await fetch(url, { signal })

  if (!res.ok) {
    let mensaje = 'No se pudo cargar la lista de pacientes'
    try {
      const body = await res.json()
      if (body?.error) mensaje = body.error
    } catch {
      // respuesta sin cuerpo JSON; se queda el mensaje genérico.
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
