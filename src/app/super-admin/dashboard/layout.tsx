import type { Metadata } from 'next'
import type { ReactNode, ReactElement } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SuperAdminSidebar from '@/components/super-admin/Sidebar'

export const metadata: Metadata = {
  title: 'Centro de control — Spinus®',
}

export default async function SuperAdminDashboardLayout({
  children,
}: {
  children: ReactNode
}): Promise<ReactElement> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') {
    redirect('/dashboard')
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <SuperAdminSidebar />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
