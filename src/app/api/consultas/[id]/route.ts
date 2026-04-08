import { NextRequest, NextResponse } from 'next/server'

/* ── PUT /api/consultas/[id] — BLOQUEADO (inmutabilidad NOM-004) ──── */
export async function PUT() {
  // NOM-004-SSA3: las notas clínicas son inmutables una vez guardadas.
  // Para correcciones, usar addendums (POST /api/consultas/[id]/addendum).
  return NextResponse.json(
    { error: 'Las notas clínicas no pueden modificarse una vez guardadas. Use la opción de addendum para agregar aclaraciones.' },
    { status: 403 }
  )
}

/* ── DELETE /api/consultas/[id] — BLOQUEADO (retención NOM-004) ──── */
export async function DELETE() {
  // NOM-004-SSA3: los registros clínicos deben conservarse mínimo 5 años.
  return NextResponse.json(
    { error: 'Las notas clínicas no pueden eliminarse por normativa de retención de expedientes médicos.' },
    { status: 403 }
  )
}
