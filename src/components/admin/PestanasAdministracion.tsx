'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useProfile } from '@/hooks/useProfile'
import { canManageClinica } from '@/lib/permissions'

/* ═══ PESTAÑAS DE ADMINISTRACIÓN — B4 del rediseño (CALMA §30.2) ════════════
 *
 * La navegación nueva es plana: «Administración» es UNA entrada que lleva a
 * Estadísticas, y sus tres pantallas se recorren con esta fila de pestañas
 * («Estadísticas · Usuarios · Facturación»). Antes eran tres entradas de la
 * barra lateral y la del medio se llamaba «Usuarios de la clínica».
 *
 * ⚠️ «Usuarios» y «Facturación» SÓLO PARA QUIEN ADMINISTRA LA CLÍNICA, con la
 * MISMA regla que usan esas dos pantallas para dejar entrar
 * (`canManageClinica(profile)`): una pestaña que expulsa al que la pulsa sería
 * peor que no tenerla. Es la condición que tenía la barra lateral.
 *
 * Son enlaces de navegación, no un `tablist`: cada pestaña es otra página.
 * La activa lleva `aria-current="page"`.
 */

const PESTANAS = [
  { href: '/estadisticas', etiqueta: 'Estadísticas', soloAdmin: false },
  { href: '/admin/usuarios', etiqueta: 'Usuarios', soloAdmin: true },
  { href: '/billing', etiqueta: 'Facturación', soloAdmin: true },
] as const

export default function PestanasAdministracion() {
  const pathname = usePathname()
  const { profile } = useProfile()
  const admin = canManageClinica(profile)
  const visibles = PESTANAS.filter(p => admin || !p.soloAdmin)
  return (
    <nav aria-label="Administración" className="mb-6 flex gap-6 border-b border-linea">
      {visibles.map(p => {
        const activa = pathname === p.href || pathname.startsWith(`${p.href}/`)
        return (
          <Link key={p.href} href={p.href} prefetch={false} aria-current={activa ? 'page' : undefined}
            className={`-mb-px inline-flex min-h-11 items-center border-b-2 text-[14px] transition-colors ${
              activa ? 'border-accion font-semibold text-tinta' : 'border-transparent font-normal text-tinta2 hover:text-tinta'
            }`}>
            {p.etiqueta}
          </Link>
        )
      })}
    </nav>
  )
}
