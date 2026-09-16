'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Eye, EyeOff, CheckCircle, RefreshCw } from 'lucide-react'

/**
 * Registro público — correo y contraseña (Bloque B5, quinta parte).
 *
 * Los nueve campos que había aquí —título, nombre, apellidos, especialidad, las
 * dos cédulas y el «nombre del consultorio»— los pide ahora el gate de
 * onboarding, después de confirmar el correo. Dos razones: un formulario largo
 * delante de quien todavía no ha visto el producto, y que esos datos ya se
 * exigían otra vez en el gate, con otro criterio.
 *
 * ⚠️ EL «NOMBRE DEL CONSULTORIO» DE AQUÍ CREABA LA CLÍNICA, no un consultorio.
 * La clínica es la cuenta; el consultorio, el lugar físico, y vive en otra
 * tabla. En el onboarding son dos pasos distintos y cada uno se llama por su
 * nombre.
 */

/* ═══ BANDERA DE GOOGLE — APAGADA POR DEFECTO ══════════════════════════════
   Gemela de la de `login/page.tsx`, y DUPLICADA A PROPÓSITO: las dos páginas
   no comparten sistema visual ni módulo, y sacar dos constantes de una línea a
   un archivo común sería la abstracción prematura que el proyecto proscribe.
   Lo único que sí se comparte es el SVG de la «G».
   ⚠️ SI LA ENCIENDES, ENCIÉNDELA EN LAS DOS. Con una sola, el médico que se
   registra con Google no encontraría después cómo volver a entrar (o al revés).
   El orden de encendido —proveedor y URL de retorno EN EL PANEL primero, la
   variable y el redespliegue después— está escrito entero en `login/page.tsx`,
   junto a su bandera. */
const GOOGLE_OAUTH = ['1', 'true'].includes(
  (process.env.NEXT_PUBLIC_GOOGLE_OAUTH ?? '').trim().toLowerCase(),
)

export default function RegisterPage() {
  const router = useRouter()
  const [step,     setStep]     = useState<'form' | 'enviado' | 'aviso'>('form')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  // Reenvío de correo de confirmación
  const [reenvioLoading, setReenvioLoading] = useState(false)
  const [reenvioMsg,     setReenvioMsg]     = useState('')
  const [reenvioError,   setReenvioError]   = useState('')
  const [cooldown,       setCooldown]       = useState(0)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current) }
  }, [])

  async function handleReenviar() {
    setReenvioLoading(true)
    setReenvioMsg('')
    setReenvioError('')
    try {
      const res = await fetch('/api/auth/reenviar-confirmacion', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: form.email }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) {
        setReenvioError(data.error ?? 'No se pudo reenviar. Intenta más tarde.')
      } else {
        setReenvioMsg('¡Correo reenviado! Revisa tu bandeja de entrada.')
        // Cooldown de 60 s para no spamear
        setCooldown(60)
        cooldownRef.current = setInterval(() => {
          setCooldown(s => {
            if (s <= 1) { clearInterval(cooldownRef.current!); return 0 }
            return s - 1
          })
        }, 1000)
      }
    } finally {
      setReenvioLoading(false)
    }
  }

  const [form, setForm] = useState({
    email:    '',
    password: '',
  })

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))
  }

  /* ⚠️ AQUÍ NO SE «CREA UNA CUENTA», SE ENTRA — y por eso el botón dice
     «Continuar con Google» y no «Registrarse con Google». Google no distingue
     alta de acceso: es el mismo flujo, y si el correo ya existe entra a la
     cuenta de siempre en vez de fallar con un 409 como hace `/api/auth/registro`.
     Lo que venga después —perfil, clínica— lo pide el gate de onboarding, igual
     que a quien se registra con correo.
     ⚠️ No detecta fallos: `signInWithOAuth` sólo construye la URL y navega
     (`window.location.assign`), devolviendo `error: null` siempre. El razonamiento
     completo está junto al handler gemelo de `login/page.tsx`. */
  async function entrarConGoogle() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Solo 'openid': GoTrue AÑADE esto a sus scopes por defecto
        // (`email profile`), no los sustituye. Nunca el scope de Calendar.
        scopes: 'openid',
        queryParams: { prompt: 'select_account' },
      },
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    enviar(false)
  }

  /* `avisoVisto` en true es el segundo clic sobre «usar esta de todos modos».
     En la primera pasada el servidor no crea nada ni consume presupuesto de
     registro, así que dudar sale gratis. */
  async function enviar(avisoVisto: boolean) {
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/registro', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...form, aviso_visto: avisoVisto }),
    })

    const data = await res.json()
    setLoading(false)

    if (data.aviso === 'password_conocida') { setStep('aviso'); return }

    if (!res.ok) {
      if (res.status === 409) {
        setError(data.message || data.error)
        setTimeout(() => router.push('/login'), 2000)
      } else {
        setError(data.message || data.error || 'Error al crear la cuenta. Intenta de nuevo.')
      }
      return
    }

    setStep('enviado')
  }

  /* ── Pantalla: la contraseña elegida es conocida ───────── */
  if (step === 'aviso') {
    /* ⚠️ AVISA, NO BLOQUEA. La contraseña la elige el médico: esta pantalla le
       da el dato que no tenía y le devuelve la decisión. Por eso «usar esta de
       todos modos» es una salida visible y no una casilla de «entiendo los
       riesgos» — eso es un regaño con formulario.
       Aquí todavía no se ha creado nada ni se ha consumido presupuesto de
       registro (`api/auth/registro` comprueba antes de crear y con
       `registrar: false`), así que dudar sale gratis.
       ⚠️ NO AÑADAS EL NÚMERO DE APARICIONES que devuelve HIBP: convence, pero
       convierte el aviso en un informe técnico.
       ⚠️ NI «INSEGURA» NI «DÉBIL» NI «COMPROMETIDA»: son juicios sobre él. Y la
       línea de que su cuenta no está afectada no es relleno — es lo primero que
       va a pensar quien se está dando de alta en un expediente electrónico.
       El texto es el mismo que el de `/reset-password`, a propósito: dos
       redacciones distintas del mismo hecho se leen como dos hechos. */
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8] px-4 pt-[env(safe-area-inset-top,0px)]">
        <div className="w-full max-w-sm">
          <Logo />
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-4">
            <h2 className="font-semibold text-slate-700">Esta contraseña ya es conocida</h2>
            <p className="text-sm text-slate-500">
              Apareció en robos de datos de otras páginas web, así que está en listas públicas que se usan para intentar entrar en cuentas ajenas.
            </p>
            <p className="text-sm text-slate-500">
              <strong className="text-slate-700">Tu cuenta de Spinus no está afectada.</strong> Puedes usarla si quieres; otra distinta sería más difícil de adivinar.
            </p>
            <button
              type="button"
              onClick={() => { setForm(f => ({ ...f, password: '' })); setStep('form') }}
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
              {loading ? <><Loader2 size={14} className="animate-spin" /> Creando...</> : 'Usar esta de todos modos'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ── Pantalla: confirmación enviada ────────────────────── */
  if (step === 'enviado') {
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
          <Logo />
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
            <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">¡Cuenta creada!</h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              Te enviamos un correo de confirmación a <strong className="text-slate-700">{form.email}</strong>.
              Revísalo y haz clic en el enlace para activar tu cuenta.
            </p>
            <p className="text-xs text-slate-400">
              ¿No lo ves? Revisa tu carpeta de <strong>spam o correo no deseado</strong>.
            </p>

            {/* Reenvío */}
            <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
              {reenvioMsg && (
                <p className="text-xs text-emerald-600 font-medium">{reenvioMsg}</p>
              )}
              {reenvioError && (
                <p className="text-xs text-red-500">{reenvioError}</p>
              )}
              <button
                onClick={handleReenviar}
                disabled={reenvioLoading || cooldown > 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                {reenvioLoading
                  ? <Loader2 size={14} className="animate-spin" />
                  : <RefreshCw size={14} />
                }
                {cooldown > 0
                  ? `Reenviar correo (${cooldown}s)`
                  : reenvioLoading ? 'Enviando...' : 'Reenviar correo de confirmación'
                }
              </button>
              <Link href="/login" className="block text-center text-sm text-[#1e5fa8] hover:underline mt-1">
                Volver al inicio de sesión
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ── Pantalla: formulario de registro ──────────────────── */
  /* ⚠️ EL RELLENO DE ARRIBA LLEVA EL ÁREA SEGURA SUMADA, no sustituida.
     Centrar protege sólo mientras el contenido CABE: en cuanto desborda
     —formulario largo, teclado abierto, tipografía grande— el contenedor crece
     y la tarjeta se alinea arriba. Con `viewport-fit=cover` ese borde es el
     FÍSICO, y la franja navy de `globals.css` (`body::before`) es OPACA y mide
     lo que la muesca (47-59 px), así que se comía la cabecera.
     El `py-10` se parte en `pt` + `pb` A PROPÓSITO: dejar `py-10` y añadir un
     `pt-*` detrás haría que el ganador lo decidiera el orden de la hoja
     generada, no el del atributo. Los 40 px de diseño se conservan.
     En escritorio y en una pestaña normal el `env()` vale 0 y esto queda
     exactamente como estaba. */
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8] px-4 pt-[calc(2.5rem+env(safe-area-inset-top,0px))] pb-10">
      <div className="w-full max-w-sm">
        <Logo />

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">

            <p className="text-xs text-slate-500 leading-relaxed">
              Crea tu cuenta con tu correo. Al entrar te pediremos tus datos
              profesionales y los de tu clínica, una sola vez.
            </p>

            {/* Acceso */}
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Acceso</p>

            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Correo electrónico *</label>
              <input type="email" value={form.email} onChange={set('email')}
                placeholder="correo@ejemplo.com" required autoFocus
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]" />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Contraseña *</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={form.password} onChange={set('password')}
                  placeholder="Mínimo 8 caracteres" required minLength={8}
                  className="w-full px-3 py-2.5 pr-10 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]" />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-[#1e5fa8] text-white rounded-xl font-medium hover:bg-[#1a3a5c] transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-2">
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Creando cuenta...</>
                : 'Crear cuenta gratuita'
              }
            </button>

            {/* ═══ GOOGLE ═══
                ⚠️ ESTE BOTÓN NO ES EL DE /login, Y NO SE COPIA DE ALLÍ. Aquella
                pantalla corre sobre el sistema visual de la landing (tokens
                `--lp-*`, `rounded-xl`, 15px, escala 8·12·16·24); ésta no: usa
                hex literales, `slate-*`, `rounded-lg` y `text-sm`. Trasplantar
                el otro botón metería medio sistema visual en una página que no
                lo tiene. Lo único compartido entre las dos es el archivo SVG.
                Lo que sí es idéntico a propósito es el TEXTO: «Continuar con
                Google» en las dos.
                ⚠️ LOS TRES COLORES DEL BOTÓN SON DE GOOGLE, NO NUESTROS: fondo
                #FFFFFF, borde #747775, texto #1F1F1F. Su guía de marca no
                permite recolorearlo, así que no los alinees con el `#1e5fa8` de
                esta página aunque desentonen. En esta pantalla el choque es
                menor que en /login —aquí ya se escriben hex a mano—, pero el
                motivo por el que son intocables es el mismo.
                Con la bandera apagada no se pinta NADA: esta página nunca tuvo
                botón de Google, así que no hay estado previo que conservar, y
                un «Próximamente» aquí sería una promesa nueva en vez de una
                que ya estaba hecha (que es lo que sí ocurre en /login). */}
            {GOOGLE_OAUTH && (
              <>
                <div className="flex items-center gap-3 pt-1">
                  <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
                  <span className="text-xs text-slate-400">o</span>
                  <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
                </div>

                <button type="button" onClick={entrarConGoogle}
                  className="w-full py-3 bg-[#FFFFFF] text-[#1F1F1F] border border-[#747775] rounded-lg font-medium text-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
                  <Image src="/google/boton-g.svg" alt="" width={18} height={18} className="h-[18px] w-[18px]" />
                  Continuar con Google
                </button>
              </>
            )}

            <p className="text-center text-xs text-slate-400 pt-1">
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="text-[#1e5fa8] hover:underline font-medium">
                Inicia sesión
              </Link>
            </p>
          </form>
        </div>
        <Footer />
      </div>
    </div>
  )
}

function Logo() {
  return (
    <div className="flex flex-col items-center mb-6">
      <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg mb-4 overflow-hidden">
        <img src="/logo.png" alt="Logo Spinus" className="w-16 h-16 object-contain"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
      </div>
      <h1 className="text-2xl font-bold text-[#1a3a5c]">Spinus®</h1>
      <p className="text-xs text-slate-400 mt-1">Crea tu cuenta gratuita</p>
    </div>
  )
}

function Footer() {
  return (
    <p className="text-center text-xs text-slate-300 mt-6">
      © 2026 Spinus® · Todos los derechos reservados
    </p>
  )
}
