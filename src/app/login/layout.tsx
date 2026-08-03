import { inter } from '@/lib/fonts'

/* Layout de /login — Server Component (sin `'use client'`, sin hooks).
   Existe para dos cosas y ninguna más: montar la familia Inter sobre esta
   ruta y poner el fondo de la pantalla.

   SIN `metadata` PROPIA, a propósito. El `<title>` sigue siendo el del layout
   raíz (`src/app/layout.tsx:5`), que hoy dice "Spinus®". Ese ® es real y está
   contabilizado en **LP-DT-15** (barrido de ® fuera de la landing); corregirlo
   aquí con un `metadata` que lo pise sería esconder el síntoma en una ruta y
   dejarlo vivo en las otras veinte. Se arregla en su proyecto, en el archivo
   raíz, de una vez. No añadas metadata aquí para "arreglar el título".

   ⚠️ `font-lp` NO ES SOLO TIPOGRAFÍA EN ESTE ÁRBOL, y por eso la clase va aquí
   y no en el <div> de la página. El anillo de foco único de la landing
   (`globals.css`, bloque "ANILLO DE FOCO ÚNICO") está acotado con el selector
   `.font-lp :where(a, button, summary, [tabindex]…):focus-visible` — un
   DESCENDIENTE de `.font-lp`, no el elemento que la lleva. Verificado leyendo
   la regla, no supuesto: con la clase en este envoltorio, los inputs, el botón
   de envío, el botón-ojo y los enlaces de la página quedan dentro del selector
   y heredan el `outline: 2px solid var(--lp-focus)` sin declarar ni uno.
   La contrapartida es que el anillo del <div> mismo NO estaría cubierto — es
   irrelevante, no es enfocable.

   `inter.variable` declara `--lp-font`; la utilidad `font-lp` la consume
   (`globals.css`, bloque `@theme inline`). Las dos son necesarias: la clase
   de next/font sin la utilidad no aplica la familia a nada.

   ⚠️ `min-h-dvh` Y NO `min-h-screen`, que es lo que había. En Tailwind 4
   `min-h-screen` compila a `100vh`, y §4.3·10 del maestro es explícito:
   `100dvh` nunca `100vh`. En iOS/Android `100vh` no descuenta la barra de
   direcciones, así que el alto reservado excede el viewport real y aparece un
   salto al mostrarse u ocultarse la barra al hacer scroll. Es la misma
   corrección que **LP-DT-18** aplicó a la landing. No lo devuelvas a
   `min-h-screen`. */
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.variable} font-lp min-h-dvh bg-[var(--lp-wash)]`}>
      {children}
    </div>
  )
}
