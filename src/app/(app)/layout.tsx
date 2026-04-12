import Sidebar from '@/components/layout/Sidebar'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ToastProvider } from '@/components/ui/Toast'
import CommandPalette from '@/components/CommandPalette'
import PageTransition from '@/components/layout/PageTransition'
import SessionGuard from '@/components/SessionGuard'
import OfflineSync from '@/components/OfflineSync'
import OfflineGate from '@/components/OfflineGate'
import PersistenceWarning from '@/components/ui/PersistenceWarning'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ThemeProvider>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 lg:ml-60 overflow-y-auto">
            <div className="min-h-full pt-16 px-4 pb-6 lg:pt-8 lg:px-8 lg:pb-8">
              <ErrorBoundary>
                <PageTransition>
                  <OfflineGate>
                    <PersistenceWarning />
                    {children}
                  </OfflineGate>
                </PageTransition>
              </ErrorBoundary>
            </div>
          </main>
        </div>
        <CommandPalette />
        <SessionGuard />
        <OfflineSync />
      </ThemeProvider>
    </ToastProvider>
  )
}
