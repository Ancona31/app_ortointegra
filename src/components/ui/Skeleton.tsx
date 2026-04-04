/** Bloque shimmer genérico */
export function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton${className ? ' ' + className : ''}`} />
}

/** Fila de lista de pacientes */
export function PatientRowSkeleton() {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <div className="flex items-center gap-4">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-2.5 w-24" />
        </div>
      </div>
      <Skeleton className="h-5 w-14 rounded-full" />
    </div>
  )
}

/** Lista completa de pacientes */
export function PatientListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, i) => (
        <PatientRowSkeleton key={i} />
      ))}
    </div>
  )
}

/** Cards del dashboard */
export function DashboardSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 py-2">
      {/* Saludo */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-72" />
      </div>
      {/* CTAs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      {/* Módulos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
      </div>
      {/* Recientes */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        {[1,2,3,4].map(i => (
          <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100">
            <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-2.5 w-56" />
            </div>
            <Skeleton className="h-2.5 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Formulario de perfil */
export function PerfilSkeleton() {
  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="space-y-1">
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="h-7 w-28" />
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <Skeleton className="h-2.5 w-36" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
          </div>
          <Skeleton className="h-10 rounded-xl" />
        </div>
      ))}
      <Skeleton className="h-12 rounded-2xl" />
    </div>
  )
}

/** Stats de billing */
export function BillingSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-7 w-32" />
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-3 gap-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      </div>
      <Skeleton className="h-40 rounded-2xl" />
    </div>
  )
}

/** Lista de laboratorios / estadísticas */
export function ListSkeleton({ rows = 6, header = true }: { rows?: number; header?: boolean }) {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {header && (
        <div className="flex items-end justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-7 w-36" />
          </div>
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
      )}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-44" />
                <Skeleton className="h-2.5 w-28" />
              </div>
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
