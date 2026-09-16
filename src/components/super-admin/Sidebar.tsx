'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  DollarSign,
  Activity,
  ScrollText,
  AlertTriangle,
  Scale,
  LogOut,
} from 'lucide-react'
import { useState, type ReactElement } from 'react'
import { createClient } from '@/lib/supabase/client'

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
}

const NAV: ReadonlyArray<NavItem> = [
  { href: '/super-admin/dashboard', label: 'Resumen', icon: LayoutDashboard },
  { href: '/super-admin/dashboard/clinicas', label: 'Clínicas y usuarios', icon: Building2 },
  { href: '/super-admin/dashboard/ingresos', label: 'Ingresos', icon: DollarSign },
  { href: '/super-admin/dashboard/uso', label: 'Uso de plataforma', icon: Activity },
  { href: '/super-admin/dashboard/audit', label: 'Audit log', icon: ScrollText },
  { href: '/super-admin/dashboard/alertas', label: 'Alertas', icon: AlertTriangle },
  { href: '/super-admin/dashboard/legal', label: 'Legal / ARCO', icon: Scale },
]

export default function SuperAdminSidebar(): ReactElement {
  const pathname = usePathname()
  const router = useRouter()

  /* El aviso vive aquí, en estado local, y NO en el `ToastProvider` del
     proyecto: en `super-admin/dashboard/layout.tsx` ese provider envuelve sólo a
     `{children}` y esta barra es su HERMANA, así que `useToast()` cogería el
     contexto por defecto —cuatro funciones vacías— y el aviso se perdería sin
     ruido. Peor que no ponerlo. */
  const [errorLogout, setErrorLogout] = useState<string | null>(null)

  async function handleLogout(): Promise<void> {
    // NOM-024: registrar logout antes de cerrar sesión. El await no sobra: esta
    // ruta identifica al usuario por sus cookies sb-*, o sea por lo mismo que el
    // cierre borra. Si el registro falla, el cierre continúa igual.
    try {
      await fetch('/api/auth/audit-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      })
    } catch { /* silent */ }

    /* ⚠️ ESTO DUPLICA A PROPÓSITO EL `signOut()` DE `lib/auth-context.tsx`, Y NO
       SE UNIFICA. `AuthProvider` está montado sólo en `(app)/layout.tsx`;
       /super-admin vive fuera de ese grupo de rutas, así que un `useAuth()` aquí
       lanzaría en el render y tumbaría el centro de control entero. Traerlo
       metería además su *loading gate* en el área desde la que se resuelven
       incidentes. Diez líneas repetidas es el precio correcto.

       El orden es el mismo y por el mismo motivo: `@supabase/ssr` guarda la
       sesión DENTRO de las cookies sb-*, así que limpiar antes dejaba al SDK sin
       sesión que revocar y el refresh token seguía vivo en Supabase Auth.
       Y auth-js NO LANZA aquí: DEVUELVE `{ error }`. */
    setErrorLogout(null)
    let revocado = false
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signOut({ scope: 'global' })
      if (error) throw error
      revocado = true
    } catch { /* se decide abajo, después de limpiar */ }

    /* ⚠️ LA LIMPIEZA LOCAL CORRE SIEMPRE, CONFIRME EL SERVIDOR O NO, y antes no:
       el `return` del catch se iba sin borrar nada y dejaba la credencial entera
       en el navegador. Mismo invariante y mismo razonamiento que en
       `lib/auth-context.tsx` — leer el bloque de `signOut()` de allí antes de
       tocar esto.
       ⚠️ Y AQUÍ SE BORRAN LAS COOKIES sb-*, QUE ESTA RUTA NO TOCABA. El
       `_removeSession()` del SDK sólo corre si el servidor contestó, así que sin
       estas líneas el camino del fallo se quedaba con el JWT y el refresh token
       dentro del navegador. Las diez líneas repetidas siguen siendo el precio
       correcto por el motivo del bloque de arriba: aquí no hay `useAuth()`. */
    try {
      document.cookie.split(';').forEach(c => {
        const name = c.trim().split('=')[0]
        if (name.startsWith('sb-')) {
          document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
        }
      })
    } catch { /* silent */ }
    try { sessionStorage.removeItem('spinus_active') } catch { /* silent */ }
    try { localStorage.removeItem('spinus_session_meta') } catch { /* silent */ }

    /* ⚠️ SIN REVOCACIÓN NO SE NAVEGA, PARA QUE EL AVISO SE LEA: `router.push`
       desmontaría esta barra y con ella el `errorLogout`, que vive en su estado
       local (ver el bloque del principio). La sesión de ESTE navegador ya está
       cerrada cuando esto se pinta.
       ⚠️ EL AVISO NO DICE «inténtalo de nuevo» A PROPÓSITO. Un segundo clic
       encontraría el navegador ya sin `accessToken`, así que `_signOut` se
       saltaría la llamada al servidor —sólo la hace `if (accessToken)`,
       GoTrueClient.js:1754— y devolvería ÉXITO sin haber revocado nada. El
       reintento mentiría. Lo que sí revoca de verdad en el servidor es el cambio
       de contraseña (`api/auth/reset-password/route.ts:194`). */
    if (!revocado) {
      setErrorLogout('Sesión cerrada en este navegador, pero el servidor no confirmó la revocación: puede seguir abierta en otros dispositivos. Cambia la contraseña para cerrarlas todas.')
      return
    }

    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 bg-slate-900 border-r border-slate-800 sticky top-0 h-screen">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b border-slate-800">
        <Image
          src="/logo-spinus.png"
          alt="Spinus"
          width={800}
          height={777}
          className="object-contain h-7 w-auto"
          priority
        />
        <div className="flex flex-col leading-none">
          <span className="text-[14px] font-bold text-slate-100">Spinus®</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            Centro de control
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        {NAV.map((item) => {
          const Icon = item.icon
          const isActive =
            item.href === '/super-admin/dashboard'
              ? pathname === '/super-admin/dashboard'
              : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                isActive
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
              }`}
            >
              {isActive ? (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r bg-[#1e5fa8]" />
              ) : null}
              <Icon size={16} className={isActive ? 'text-[#1e5fa8]' : ''} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-slate-800 space-y-1">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
        >
          <LogOut size={14} />
          Cerrar sesión
        </button>
        {errorLogout ? (
          <p role="alert" className="px-3 pt-1 text-[11px] leading-snug text-red-400">
            {errorLogout}
          </p>
        ) : null}
      </div>
    </aside>
  )
}
