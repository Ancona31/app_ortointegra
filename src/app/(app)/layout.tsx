import Sidebar from '@/components/layout/Sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 lg:ml-64 overflow-y-auto">
        <div className="min-h-full p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
