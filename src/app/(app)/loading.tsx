import { Skeleton } from '@/components/ui/Skeleton'

/**
 * Esqueleto genérico del grupo (app).
 *
 * Se renderiza en el lugar de {children} DENTRO de (app)/layout.tsx: el
 * sidebar, el banner de suscripción y el resto del armazón siguen en pantalla;
 * solo se sustituye el contenido de la página.
 *
 * ⚠ NO REPITAS EL PADDING DEL LAYOUT. El contenedor de (app)/layout.tsx ya
 * aporta `min-h-full pt-16 px-4 pb-6 lg:pt-8 lg:px-8 lg:pb-8`. Duplicarlo aquí
 * desplaza el esqueleto respecto del contenido real y produce justo el salto
 * visual que este archivo existe para evitar.
 *
 * Su otra razón de ser es habilitar el prefetch: sin un boundary de carga, el
 * <Link> hacia una ruta dinámica (todas lo son, porque los layouts leen cookies
 * vía getUser()) no puede precargar nada al pasar el cursor.
 */
export default function AppLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-4" role="status" aria-label="Cargando">
      {/* Encabezado: eyebrow + título */}
      <div className="space-y-2">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-7 w-64" />
      </div>

      {/* Bloque principal */}
      <Skeleton className="h-28 rounded-2xl" />

      {/* Rejilla de tarjetas — misma métrica que el resto de la app */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}
      >
        {[0, 1, 2, 3].map(i => (
          <Skeleton key={i} className="h-[140px] rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
