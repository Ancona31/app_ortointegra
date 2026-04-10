import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Verifica el OTP server-side con un cliente standalone (sin cookies)
// Esto confirma el email en la base de datos sin afectar la sesión activa del browser
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { token_hash?: unknown; type?: unknown }
    const token_hash = typeof body.token_hash === 'string' ? body.token_hash : ''
    const rawType = typeof body.type === 'string' ? body.type : 'email'
    // Solo tipos válidos para confirmación de cuenta
    const type = rawType === 'magiclink' ? 'magiclink' : 'email'

    if (!token_hash) {
      return NextResponse.json({ error: 'Token faltante' }, { status: 400 })
    }

    // Cliente standalone — no usa cookies del request, no afecta sesión del browser
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { error } = await supabase.auth.verifyOtp({ token_hash, type })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
