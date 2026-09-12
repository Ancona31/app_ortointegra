// src/app/api/expediente/listar/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// API route que envuelve el RPC listar_pacientes_expediente.
// Centraliza el tipado manual del cliente UNTYPED; la página nunca toca la DB.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fechaHoraLocalAInstante, desplazarFecha, TZ_CLINICA } from '@/lib/dates'

const PAGE_SIZE = 20

const ORDEN_VALIDO = ['nombre', 'apellidos', 'numero_expediente', 'fecha_nacimiento', 'medico', 'created_at'] as const
const DIRECCION_VALIDA = ['asc', 'desc'] as const
type OrdenValido = typeof ORDEN_VALIDO[number]
type DireccionValida = typeof DIRECCION_VALIDA[number]

function esOrdenValido(s: string): s is OrdenValido {
  return (ORDEN_VALIDO as readonly string[]).includes(s)
}
function esDireccionValida(s: string): s is DireccionValida {
  return (DIRECCION_VALIDA as readonly string[]).includes(s)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/

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
  fecha_nacimiento: string | null
  sexo: string | null
  created_at: string
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

  const busquedaRaw = (searchParams.get('q') ?? '').trim()
  const p_busqueda = busquedaRaw.length > 0 ? busquedaRaw : null

  const pagRaw = Number.parseInt(searchParams.get('pag') ?? '0', 10)
  const pag = Number.isFinite(pagRaw) && pagRaw >= 0 ? pagRaw : 0

  const ordenRaw = searchParams.get('orden') ?? ''
  const p_orden: OrdenValido = esOrdenValido(ordenRaw) ? ordenRaw : 'created_at'
  const direccionRaw = searchParams.get('direccion') ?? ''
  const p_direccion: DireccionValida = esDireccionValida(direccionRaw) ? direccionRaw : 'desc'

  const medicoRaw = searchParams.get('medico') ?? ''
  const p_medico_id: string | null = UUID_RE.test(medicoRaw) ? medicoRaw : null

  const desdeRaw = searchParams.get('desde') ?? ''
  const hastaRaw = searchParams.get('hasta') ?? ''
  let p_fecha_desde: string | null = null
  let p_fecha_hasta: string | null = null
  // DEUDA CONSCIENTE — `TZ_CLINICA` en las dos conversiones es un apaño.
  //
  // `desde` y `hasta` son fechas-solo que el médico eligió en el sheet de
  // filtros, así que los bordes de la ventana ("el día 1 entero", "hasta
  // acabar el día 15") son los de SU DISPOSITIVO, no los del Centro. En
  // Sonora la ventana sale corrida una hora por los dos extremos, y un
  // paciente creado en la última hora del día cae fuera del filtro.
  //
  // No se cableó porque el huso no viaja por el cable: haría falta un campo
  // nuevo en `ParamsListaExpediente`, mandarlo desde `fetchPacientes.ts` y
  // validarlo aquí contra `Intl.supportedValuesOf('timeZone')` —un IANA sin
  // validar no revienta gracias a estos try/catch, pero apagaría el filtro
  // entero en silencio, que es peor—. Demasiado para un dato que no es una
  // hora de cita. Se dejó anotado en vez de arreglado (commit B de husos,
  // agosto de 2026). Hasta ese commit la zona del Centro llegaba sola, por
  // el valor por defecto de `fechaHoraLocalAInstante`; ahora al menos se ve.
  try {
    if (FECHA_RE.test(desdeRaw)) {
      p_fecha_desde = fechaHoraLocalAInstante(desdeRaw, '00:00', TZ_CLINICA)
    }
  } catch {
    p_fecha_desde = null
  }
  try {
    if (FECHA_RE.test(hastaRaw)) {
      p_fecha_hasta = fechaHoraLocalAInstante(desplazarFecha(hastaRaw, { dias: 1 }), '00:00', TZ_CLINICA)
    }
  } catch {
    p_fecha_hasta = null
  }

  const { data, error } = await supabase.rpc('listar_pacientes_expediente', {
    p_busqueda,
    p_medico_id,
    p_fecha_desde,
    p_fecha_hasta,
    p_orden,
    p_direccion,
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
  const hayMas = filas.length > PAGE_SIZE
  const pacientes = hayMas ? filas.slice(0, PAGE_SIZE) : filas

  let total: number | null = null
  if (pag === 0 && p_busqueda === null && p_medico_id === null && p_fecha_desde === null && p_fecha_hasta === null) {
    const { count, error: countError } = await supabase
      .from('pacientes')
      .select('id', { count: 'exact', head: true })
      .neq('activo', false)
    if (!countError) {
      total = count ?? 0
    }
  }

  return NextResponse.json({ pacientes, hayMas, total })
}
