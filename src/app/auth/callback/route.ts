import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl
  const code      = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type      = searchParams.get('type') as 'email' | 'signup' | null

  const supabase = await createClient()

  // Flujo PKCE (client-side signUp)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return NextResponse.redirect(`${origin}/login?error=invalid_link`)
    return NextResponse.redirect(`${origin}/dashboard`)
  }

  // Flujo token_hash (generateLink server-side)
  if (tokenHash && (type === 'email' || type === 'signup')) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
    if (error) return NextResponse.redirect(`${origin}/login?error=invalid_link`)
    return NextResponse.redirect(`${origin}/dashboard`)
  }

  return NextResponse.redirect(`${origin}/login?error=invalid_link`)
}
