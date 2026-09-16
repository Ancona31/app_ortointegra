'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Lock, CheckCircle } from 'lucide-react'
import Link from 'next/link'

/* ⚠️ ESTE ARCHIVO NO IMPORTA SUPABASE, Y ES EL PUNTO ENTERO DE LA PANTALLA.
   El token viaja a `/api/auth/reset-password`, que lo canjea en servidor con un
   cliente sin cookies y NO devuelve sesión (OWASP Forgot Password: «Don't
   automatically log the user in»).

   Si alguien vuelve a meter aquí `createClient()`, `verifyOtp` o
   `exchangeCodeForSession`, reabre el agujero: los dos primeros ESTABLECEN
   SESIÓN en cookies de todo el dominio, y con `secure_password_change` en false
   esa sesión es la autorización del cambio. Tampoco hay `router.push('/inicio')`
   al terminar: el médico entra por el login de siempre.

   Aquí vivió el canje PKCE (`exchangeCodeForSession` con `?code=`). Se retiró a
   propósito: ataba la recuperación al NAVEGADOR que pidió el correo, así que un
   médico que lo pedía en el móvil y abría el enlace en el ordenador del
   consultorio se quedaba fuera. El canje en servidor no necesita esa atadura. */

function ResetPasswordContent() {
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
    /* Se valida ANTES de enviar porque el canje consume el token: un rechazo del
       servidor por contraseña corta deja al médico sin enlace. El 6 de aquí es
       el mismo de `minimum_password_length` y el del zod de la ruta; los tres se
       mueven juntos cuando suba la política. */
    if (password !== confirmar) { setError('Las contraseñas no coinciden.'); return }
    if (password.length < 6) { setError('Mínimo 6 caracteres.'); return }
    enviar(false)
  }

  /* `avisoVisto` en true es el segundo clic del médico sobre «usar esta de
     todos modos». El servidor no cambia nada en la primera pasada —el aviso
     llega ANTES del canje—, así que este reenvío no cuesta ningún enlace. */
  async function enviar(avisoVisto: boolean) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/reset-password', {
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
      } else if (json.error === 'password_debil') {
        /* Hoy inalcanzable: la validación de arriba se adelanta. Queda cableado
           para cuando suba la política de contraseña — ahí GoTrue podrá
           rechazar por su cuenta (contraseña filtrada, con HIBP encendido) y
           esto será lo que vea el médico. */
        setError('Esa contraseña no cumple los requisitos, y este enlace ya se consumió. Solicita uno nuevo y elige otra.')
        setEnlaceMuerto(true)
      } else if (json.error === 'password_rechazada') {
        setError('No se aceptó la contraseña, y este enlace ya se consumió. Solicita uno nuevo.')
        setEnlaceMuerto(true)
      } else {
        setError('No se pudo actualizar la contraseña. Intenta de nuevo.')
      }
    } catch {
      setError('No se pudo conectar. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  /* ⚠️ EL RELLENO DE ARRIBA LLEVA EL ÁREA SEGURA SUMADA, no sustituida.
     Centrar protege sólo mientras el contenido CABE: en cuanto desborda
     —formulario largo, teclado abierto, tipografía grande— el contenedor crece
     y la tarjeta se alinea arriba. Con `viewport-fit=cover` ese borde es el
     FÍSICO, y la franja navy de `globals.css` (`body::before`) es OPACA y mide
     lo que la muesca (47-59 px), así que se comía la cabecera.
     Esta pantalla no tenía relleno vertical de diseño, así que el área segura
     es aquí todo el valor.
     En escritorio y en una pestaña normal el `env()` vale 0 y esto queda
     exactamente como estaba. */
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8] px-4 pt-[env(safe-area-inset-top,0px)]">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-2xl font-bold text-[#1a3a5c]">Spinus®</h1>
          <p className="text-xs text-slate-400 mt-1 text-center">Gestión clínica inteligente para el especialista moderno</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          {correo !== null ? (
            /* ⚠️ EL CORREO SE ENSEÑA DESPUÉS Y NO ANTES, Y NO ES UNA CONCESIÓN:
               el `token_hash` no lleva la dirección —es un hash— y el único
               endpoint de GoTrue que lo acepta es el que lo consume. Sólo el
               canje la revela. Enseñarla aquí es lo que permite a un médico que
               abrió un enlace ajeno darse cuenta EN EL ACTO de que la cuenta que
               acaba de tocar no era la suya. */
            <div className="text-center space-y-4">
              <CheckCircle size={40} className="text-emerald-500 mx-auto" />
              {/* ⚠️ «QUEDÓ ESTABLECIDA» Y NO «SE CAMBIÓ», a propósito. Si el
                  médico tecleó la contraseña que ya tenía, el servidor lo trata
                  como éxito (ver la rama `same_password` de
                  `api/auth/reset-password/route.ts`) y no cambió nada. Este
                  texto es cierto en los dos casos, y por eso tampoco le dice a
                  quien traiga un token robado cuál de los dos ocurrió. */}
              <h2 className="font-semibold text-slate-700">Listo</h2>
              {correo && (
                <p className="text-sm text-slate-500">
                  La contraseña de <strong className="text-slate-700">{correo}</strong> quedó establecida, y se cerraron todas sus sesiones.
                </p>
              )}
              {/* ⚠️ AQUÍ HUBO UN AVISO DEL TIPO «SI ESE NO ES TU CORREO, CAMBIASTE
                  LA CONTRASEÑA DE OTRA CUENTA», Y SE RETIRÓ A PROPÓSITO. No lo
                  repongas creyendo que falta:
                  · Para el médico describe algo imposible. A esta pantalla solo
                    se llega con un enlace que llegó a un correo, así que el
                    correo que ve ES el suyo. Solo confunde.
                  · Para la víctima real tampoco funciona: está escrito desde el
                    conocimiento del atacante, no desde la confusión de quien
                    acaba de ser engañado. Esa persona no concluye «me
                    engañaron», concluye que la app se equivocó.
                  El canal que sí llega a la persona correcta es el correo de
                  aviso que manda `api/auth/reset-password/route.ts`. Lo que se
                  queda aquí es el correo enmascarado: información neutra, y la
                  señal para quien mire con atención. */}
              <Link
                href="/login"
                className="inline-block px-6 py-2.5 bg-[#1e5fa8] text-white text-sm font-semibold rounded-xl hover:bg-[#1a3a5c] transition-colors"
              >
                Iniciar sesión
              </Link>
            </div>
          ) : enlaceMuerto ? (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error || 'Enlace inválido o ya utilizado. Solicita uno nuevo.'}
              </div>
              <Link href="/forgot-password" className="block text-sm text-[#1e5fa8] hover:underline text-center">
                Solicitar nuevo enlace
              </Link>
            </div>
          ) : aviso ? (
            /* ⚠️ AVISA, NO BLOQUEA. La contraseña la elige el médico: esta
               pantalla le da el dato que no tenía y le devuelve la decisión.
               Por eso «usar esta de todos modos» es una salida visible y no una
               casilla de «entiendo los riesgos» — eso es un regaño con
               formulario.
               El enlace sigue INTACTO aquí: el servidor consulta HIBP antes del
               canje, así que dudar no cuesta un correo (y hay 2 por hora para
               todo el proyecto).
               ⚠️ NO AÑADAS EL NÚMERO DE APARICIONES que devuelve HIBP. Convence,
               pero convierte el aviso en un informe técnico.
               ⚠️ NI «CONTRASEÑA INSEGURA» NI «DÉBIL» NI «COMPROMETIDA»: son
               juicios sobre él. Y la línea de que su cuenta no está afectada no
               es relleno — es lo primero que va a pensar un médico al que le
               avisan de algo en su expediente electrónico. */
            <div className="space-y-4">
              <h2 className="font-semibold text-slate-700">Esta contraseña ya es conocida</h2>
              <p className="text-sm text-slate-500">
                Apareció en robos de datos de otras páginas web, así que está en listas públicas que se usan para intentar entrar en cuentas ajenas.
              </p>
              <p className="text-sm text-slate-500">
                <strong className="text-slate-700">Tu cuenta de Spinus no está afectada.</strong> Puedes usarla si quieres; otra distinta sería más difícil de adivinar.
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
                <h2 className="font-semibold text-slate-700">Nueva contraseña</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">
                    Nueva contraseña
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
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
                    : 'Guardar nueva contraseña'
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

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  )
}
