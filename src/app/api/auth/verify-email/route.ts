import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Verifica el OTP server-side con un cliente standalone (sin cookies)
// Esto confirma el email en la base de datos sin afectar la sesión activa del browser
export async function POST(req: NextRequest) {
  try {
    const { token_hash } = await req.json()

    if (!token_hash) {
      return NextResponse.json({ error: 'Token faltante' }, { status: 400 })
    }

    // Cliente standalone — no usa cookies del request, no afecta sesión del browser
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'email' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
