import { AlertCircle, Loader2 } from 'lucide-react'
import type { ReactElement } from 'react'

export function LoadingView({ label = 'Cargando...' }: { label?: string }): ReactElement {
  return (
    <div className="flex items-center justify-center py-20 text-slate-500">
      <Loader2 size={18} className="animate-spin mr-2" />
      <span className="text-[13px]">{label}</span>
    </div>
  )
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }): ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 mb-3">
        <AlertCircle size={20} />
      </div>
      <p className="text-[13px] text-slate-300 mb-3">Ocurrió un error al cargar los datos</p>
      <p className="text-[11px] text-slate-500 max-w-md mb-4">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="text-[12px] font-medium px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
        >
          Reintentar
        </button>
      ) : null}
    </div>
  )
}
