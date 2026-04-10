import { ToastProvider } from '@/components/ui/Toast'

export default function LauncherLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#f0f4f8]">
        {children}
      </div>
    </ToastProvider>
  )
}
