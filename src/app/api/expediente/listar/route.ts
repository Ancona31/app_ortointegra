// src/app/api/expediente/listar/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// SUB-FASE 1 — API route que envuelve el RPC listar_pacientes_expediente.
//
// Por qué un API route (y no supabase.rpc() directo desde el cliente):
//   - El resto del proyecto invoca RPC server-side; mantiene la convención.
//   - Centraliza en UN solo lugar el tipado manual del cliente UNTYPED (un typo
//     de columna no lo atrapa tsc; aquí queda acotado y revisable).
//   - La página nunca toca la DB directamente.
//
// Contrato del RPC (commit 5d7112c):
//   listar_pacientes_expediente(
//     p_busqueda text, p_medico_id uuid, p_fecha_desde timestamptz,
//     p_fecha_hasta timestamptz, p_orden text, p_direccion text,
//     p_limite int, p_offset int)
//   → TABLE(id, numero_expediente, nombre, apellidos, fecha_nacimiento date,
//           sexo, created_at, activo, clinica_id, medicos jsonb)
//
// SUB-FASE 1: solo búsqueda + paginación + orden por defecto (created_at desc).
// Filtros (médico, rango de fecha) y orden por columna → sub-fase posterior;
// aquí esos parámetros del RPC van en NULL/default.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Tamaño de página fijo (igual al de la pantalla actual). Se pide PAGE_SIZE + 1
// para deducir "hay más" sin un count por página.
const PAGE_SIZE = 20

// ── Tipo manual de una fila del RPC (cliente UNTYPED) ────────────────────────
// Debe calzar EXACTAMENTE con el RETURNS TABLE del RPC. Un desajuste aquí no lo
// atrapa tsc; se valida en runtime y en el smoke test.
interface MedicoChip {
  id: string
  titulo: string | null
  nombres: string | null
  apellido_paterno: string | null
  apellido_materno: string | null
}

interface FilaPacienteRPC {
  id: string
  numero_expediente: string | null
  nombre: string
  apellidos: string
  fecha_nacimiento: string | null // date serializada a 'YYYY-MM-DD'
  sexo: string | null
  created_at: string // timestamptz ISO
  activo: boolean | null
  clinica_id: string
  medicos: MedicoChip[] | null
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)

  // ── Parámetros de SUB-FASE 1 ───────────────────────────────────────────────
  // Búsqueda: término crudo con trim; el RPC ya colapsa espacios internamente.
  // NULL si viene vacío → desactiva el filtro.
  const busquedaRaw = (searchParams.get('q') ?? '').trim()
  const p_busqueda = busquedaRaw.length > 0 ? busquedaRaw : null

  // Página (0-based), validada entero no negativo.
  const pagRaw = Number.parseInt(searchParams.get('pag') ?? '0', 10)
  const pag = Number.isFinite(pagRaw) && pagRaw >= 0 ? pagRaw : 0

  // ── Llamada al RPC ─────────────────────────────────────────────────────────
  // Se pide PAGE_SIZE + 1 para saber si hay siguiente página sin contar.
  const { data, error } = await supabase.rpc('listar_pacientes_expediente', {
    p_busqueda,
    p_medico_id: null,
    p_fecha_desde: null,
    p_fecha_hasta: null,
    p_orden: 'created_at',
    p_direccion: 'desc',
    p_limite: PAGE_SIZE + 1,
    p_offset: pag * PAGE_SIZE,
  })

  if (error) {
    console.error('[GET expediente/listar] rpc error:', error)
    return NextResponse.json(
      { error: 'No se pudo cargar la lista de pacientes' },
      { status: 500 },
    )
  }

  const filas = (data ?? []) as FilaPacienteRPC[]

  // "Hay más": si llegaron PAGE_SIZE + 1, hay siguiente página. Se descarta la
  // fila sobrante antes de responder.
  const hayMas = filas.length > PAGE_SIZE
  const pacientes = hayMas ? filas.slice(0, PAGE_SIZE) : filas

  // ── Count head del total — SOLO en la carga inicial sin búsqueda ───────────
  // Decisión cerrada: contador fijo de la clínica, no se recalcula al filtrar.
  // La RLS de `pacientes` ya acota por clínica/rol; el count (servido por el
  // índice compuesto) da el total visible. Solo en pag 0 sin búsqueda; en
  // cualquier otro caso total = null y el cliente conserva el que ya tenía.
  let total: number | null = null
  if (pag === 0 && p_busqueda === null) {
    const { count, error: countError } = await supabase
      .from('pacientes')
      .select('id', { count: 'exact', head: true })
      .neq('activo', false)
    if (!countError) {
      total = count ?? 0
    }
    // Si el count falla, la lista NO se rompe: total queda null y el header
    // simplemente no muestra número en esta carga.
  }

  return NextResponse.json({ pacientes, hayMas, total })
}
