'use client'

import { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react'
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info' | 'warning'
type ToastItem = { id: number; message: string; type: ToastType }

type ToastFn = {
  success: (msg: string) => void
  error: (msg: string) => void
  info: (msg: string) => void
  warning: (msg: string) => void
}

const ToastContext = createContext<ToastFn>({ success: () => {}, error: () => {}, info: () => {}, warning: () => {} })

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const add = useCallback((message: string, type: ToastType) => {
    const id = ++counter.current
    setToasts(prev => [...prev, { id, message, type }])
    const duration = type === 'warning' ? 8000 : 4000
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  const dismiss = (id: number) => setToasts(prev => prev.filter(t => t.id !== id))

  // Memoizado: sin esto el objeto cambia de identidad en cada toast que entra
  // o sale, y re-renderiza todo el arbol bajo el provider.
  const toast: ToastFn = useMemo(() => ({
    success: (msg: string) => add(msg, 'success'),
    error:   (msg: string) => add(msg, 'error'),
    info:    (msg: string) => add(msg, 'info'),
    warning: (msg: string) => add(msg, 'warning'),
  }), [add])

  const styles: Record<ToastType, string> = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error:   'bg-red-50 border-red-200 text-red-800',
    info:    'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
  }
  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle    size={16} className="text-emerald-500 flex-shrink-0" />,
    error:   <XCircle        size={16} className="text-red-500 flex-shrink-0" />,
    info:    <Info           size={16} className="text-blue-500 flex-shrink-0" />,
    warning: <AlertTriangle  size={16} className="text-amber-500 flex-shrink-0" />,
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* ⚠️ EL `bottom` LLEVA LA BARRA DE GESTOS SUMADA (bloque 6 · paso 10).
          Con `viewport-fit=cover` los 20 px de `bottom-5` se miden desde el
          borde FÍSICO de la pantalla y la barra de gestos mide ~34, así que el
          aviso salía por debajo de ella. El 20 de diseño no se toca: se suma, y
          donde el sistema no se superpone `env()` vale 0.
          ⚠️ ES EL MENOS GRAVE DE LA TANDA y aun así se arregla: el aviso es
          `pointer-events-none` y se va solo, o sea que nadie se queda sin poder
          pulsar nada — pero es donde la app dice «guardado» o «falló», y medio
          tapado por el indicador del sistema se lee mal justo cuando importa. */}
      <div className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium
              pointer-events-auto max-w-sm
              animate-[slideInRight_0.25s_ease-out]
              ${styles[t.type]}`}
          >
            {icons[t.type]}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="opacity-50 hover:opacity-100 ml-1">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
