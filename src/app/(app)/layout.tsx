import Sidebar from '@/components/layout/Sidebar'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ToastProvider } from '@/components/ui/Toast'
import CommandPalette from '@/components/CommandPalette'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ThemeProvider>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 lg:ml-64 overflow-y-auto">
            <div className="min-h-full p-6 lg:p-8">
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </div>
          </main>
        </div>
        <CommandPalette />
      </ThemeProvider>
    </ToastProvider>
  )
}
