import type { ReactElement } from 'react'

/* La fórmula del saludo por hora del dispositivo. Era la misma función copiada
   en `page.tsx` y `AsistenteDashboard.tsx`; con la cabecera común (rediseño B5)
   vive aquí, una vez. */
function saludo(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

/**
 * La identidad de la cabecera del dashboard: la ceja (consultorio activo del
 * médico, o nombre de la clínica de la secretaria) y el saludo con el primer
 * nombre. Sin perfil, el saludo cae a la fórmula neutra y la ceja no se pinta.
 * La frase del día se retiró de toda la app (CALMA §20).
 */
export default function Identidad({ ceja, nombre }: { ceja: string; nombre: string }): ReactElement {
  return (
    <div className="min-w-0">
      {ceja && <p className="k-t-rotulo truncate">{ceja}</p>}
      <h1 className="k-t-pantalla mt-1 [overflow-wrap:anywhere] iv:text-[32px] iv:leading-[38px]">
        {saludo()}{nombre ? `, ${nombre}` : ''}
      </h1>
    </div>
  )
}
