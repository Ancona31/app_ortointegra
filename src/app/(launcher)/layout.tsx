import { ToastProvider } from '@/components/ui/Toast'
import { ThemeProvider } from '@/components/launcher/ThemeContext'

export default function LauncherLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </ToastProvider>
  )
}
