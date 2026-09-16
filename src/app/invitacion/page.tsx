'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Lock, CheckCircle, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

/* ⚠️ ESTE ARCHIVO NO IMPORTA SUPABASE, Y ES EL PUNTO ENTERO DE LA PANTALLA.
   El token viaja a `/api/auth/aceptar-invitacion`, que lo canjea en servidor
   con un cliente sin cookies y NO devuelve sesión. Comprobado: el canje de un
   token `invite` devuelve access_token y refresh_token, así que hacerlo aquí
   metería esa sesión en cookies de todo el dominio.

   Si alguien vuelve a meter aquí `createClient()`, `verifyOtp` o
   `exchangeCodeForSession`, reabre el agujero que B6-bis cerró en la
   recuperación. Tampoco hay `router.push('/inicio')` al terminar: el invitado
   entra por el login de siempre. Mismo criterio y mismos motivos que
   `app/reset-password/page.tsx`, donde está el razonamiento largo. */

function InvitacionContent() {
  const searchParams = useSearchParams()
  const tokenHash = searchParams.get('token_hash')

  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [enlaceMuerto, setEnlaceMuerto] = useState(!tokenHash)
  const [correo, setCorreo] = useState<string | null>(null)
  const [aviso, setAviso] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    /* Se valida ANTES de enviar porque el canje consume el token: un rechazo
       del servidor por contraseña corta dejaría a la persona sin enlace y
       teniendo que pedirle a otra que se lo reenvíe.
       ⚠️ EL 8 NO ES EL 6 DE `reset-password`, y no es un descuido al copiar:
       aquí se elige la PRIMERA contraseña de una cuenta, que es el caso del
       registro (`RegistroSchema`, min 8). Este número y el del zod de
       `api/auth/aceptar-invitacion` se mueven juntos. */
    if (password !== confirmar) { setError('Las contraseñas no coinciden.'); return }
    if (password.length < 8) { setError('Mínimo 8 caracteres.'); return }
    enviar(false)
  }

  /* `avisoVisto` en true es el segundo clic sobre «usar esta de todos modos».
     El servidor no cambia nada en la primera pasada —el aviso llega ANTES del
     canje—, así que este reenvío no cuesta el enlace. */
  async function enviar(avisoVisto: boolean) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/aceptar-invitacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_hash: tokenHash, password, aviso_visto: avisoVisto }),
      })
      const json = await res.json() as { ok?: boolean; correo?: string; error?: string; aviso?: string }

      if (json.aviso === 'password_conocida') { setAviso(true); return }
      if (res.ok && json.ok) { setCorreo(json.correo ?? ''); return }

      if (res.status === 429) {
        setError('Demasiados intentos desde esta conexión. Espera un rato e inténtalo de nuevo.')
      } else if (json.error === 'enlace_invalido') {
        setEnlaceMuerto(true)
      } else if (json.error === 'password_debil' || json.error === 'password_rechazada') {
        /* Las dos dejan el enlace quemado, así que el texto tiene que mandar a
           pedir otro — y aquí «pedir otro» es pedírselo a una persona, no a un
           formulario. */
        setError('No se aceptó la contraseña, y este enlace ya se consumió. Pide que te reenvíen la invitación.')
        setEnlaceMuerto(true)
      } else {
        setError('No se pudo guardar la contraseña. Intenta de nuevo.')
      }
    } catch {
      setError('No se pudo conectar. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  /* El relleno superior lleva el área segura sumada, por lo mismo que en
     `reset-password/page.tsx` (ahí está el porqué): con `viewport-fit=cover` la
     franja navy de `globals.css` es opaca y se come la cabecera cuando el
     contenido desborda. En escritorio el `env()` vale 0. */
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8] px-4 pt-[env(safe-area-inset-top,0px)]">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-2xl font-bold text-[#1a3a5c]">Spinus®</h1>
          <p className="text-xs text-slate-400 mt-1 text-center">Gestión clínica inteligente para el especialista moderno</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          {correo !== null ? (
            /* ⚠️ EL CORREO SE ENSEÑA ENTERO, y en `reset-password` va
               enmascarado. No es una incoherencia: allí quien abre un enlace
               robado no tiene por qué aprender la dirección de su víctima, y
               aquí a esta pantalla solo se llega con un enlace que llegó a ese
               buzón. Quien lo tiene ya conoce la dirección; lo que sí aporta
               verla es que alguien que abrió el enlace de un compañero se dé
               cuenta en el acto. */
            <div className="text-center space-y-4">
              <CheckCircle size={40} className="text-emerald-500 mx-auto" />
              <h2 className="font-semibold text-slate-700">Listo</h2>
              {correo && (
                <p className="text-sm text-slate-500">
                  La contraseña de <strong className="text-slate-700">{correo}</strong> quedó establecida. Ya puedes entrar.
                </p>
              )}
              <Link
                href="/login"
                className="inline-block px-6 py-2.5 bg-[#1e5fa8] text-white text-sm font-semibold rounded-xl hover:bg-[#1a3a5c] transition-colors"
              >
                Iniciar sesión
              </Link>
            </div>
          ) : enlaceMuerto ? (
            /* Decir DÓNDE está el botón de reenviar es lo que convierte un
               callejón sin salida en una instrucción que se puede repetir por
               teléfono a quien invitó. */
            <div className="space-y-4">
              <AlertTriangle size={36} className="text-amber-500 mx-auto" />
              <h2 className="font-semibold text-slate-700 text-center">Esta invitación ya no sirve</h2>
              {error && <p className="text-sm text-slate-500">{error}</p>}
              <p className="text-sm text-slate-500">
                Los enlaces de invitación caducan una hora después de enviarse, y solo pueden usarse una vez.
              </p>
              <p className="text-sm text-slate-500">
                Pídele a quien te invitó que te la reenvíe: lo hace desde <strong className="text-slate-700">Spinus → Usuarios</strong>, con el botón «Reenviar».
              </p>
            </div>
          ) : aviso ? (
            /* ⚠️ AVISA, NO BLOQUEA — es el mismo aviso de `reset-password` y su
               comentario vale entero: «usar esta de todos modos» es una salida
               visible y no una casilla de «entiendo los riesgos»; nada de
               «insegura», «débil» ni «comprometida», que son juicios sobre la
               persona; y NO añadas el número de apariciones de HIBP.
               El enlace sigue INTACTO aquí: el servidor consulta HIBP antes del
               canje, así que dudar no cuesta la invitación.
               Lo único que cambia es «Tu cuenta de Spinus» → «Tu cuenta nueva»:
               la frase original tranquiliza sobre una cuenta con historial, y
               ésta acaba de nacer. */
            <div className="space-y-4">
              <h2 className="font-semibold text-slate-700">Esta contraseña ya es conocida</h2>
              <p className="text-sm text-slate-500">
                Apareció en robos de datos de otras páginas web, así que está en listas públicas que se usan para intentar entrar en cuentas ajenas.
              </p>
              <p className="text-sm text-slate-500">
                <strong className="text-slate-700">Tu cuenta nueva no está afectada.</strong> Puedes usarla si quieres; otra distinta sería más difícil de adivinar.
              </p>
              <button
                type="button"
                onClick={() => { setAviso(false); setPassword(''); setConfirmar('') }}
                className="w-full py-3 bg-[#1e5fa8] text-white rounded-xl font-medium hover:bg-[#1a3a5c] transition-colors"
              >
                Elegir otra
              </button>
              <button
                type="button"
                onClick={() => enviar(true)}
                disabled={loading}
                className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : 'Usar esta de todos modos'}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-6">
                <Lock size={16} className="text-[#1a3a5c]" />
                <h2 className="font-semibold text-slate-700">Elige tu contraseña</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    required
                    autoComplete="new-password"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">
                    Confirmar contraseña
                  </label>
                  <input
                    type="password"
                    value={confirmar}
                    onChange={e => setConfirmar(e.target.value)}
                    placeholder="Repite la contraseña"
                    required
                    autoComplete="new-password"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#1e5fa8] text-white rounded-xl font-medium hover:bg-[#1a3a5c] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading
                    ? <><Loader2 size={16} className="animate-spin" /> Guardando...</>
                    : 'Guardar y continuar'
                  }
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-300 mt-6">
          © 2026 Spinus® · Todos los derechos reservados
        </p>
      </div>
    </div>
  )
}

export default function InvitacionPage() {
  return (
    <Suspense>
      <InvitacionContent />
    </Suspense>
  )
}
