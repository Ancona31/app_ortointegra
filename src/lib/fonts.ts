import { Inter } from 'next/font/google'

/* ═══ ÚNICO CALL-SITE DE `Inter()` DEL REPO ════════════════════════════════
   Módulo NEUTRO a propósito: sin `'use client'`, sin JSX, solo la instancia.
   `next/font` genera un archivo de fuente por CALL-SITE, no por import: dos
   `Inter({...})` con opciones idénticas producen DOS familias y DOS woff2
   servidos. Con un solo call-site importado desde varios layouts hay una
   familia, un preload y una clase `--lp-font`.

   Consumidores legítimos hoy: `src/app/(landing)/layout.tsx` y
   `src/app/login/layout.tsx`. Añadir uno más es importar de aquí, NUNCA
   volver a llamar a `Inter()`.

   ⚠️ NO SE MONTA EN EL LAYOUT RAÍZ. §3.2 acota Inter a la landing (y ahora a
   /login); declararla en `src/app/layout.tsx` la mandaría al producto entero
   —(app), (launcher), (offline), /register, /pricing, /privacy, /terms— que
   es justo lo que esa regla prohíbe. La app sigue en fuente de sistema.

   ⚠️ `axes: ['opsz']` es CORRECTO pese a que la doc embarcada diga otra cosa.
   node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md:170
   afirma que el eje extra de Inter es `slnt` — se quedó en Inter v3. La
   fuente de verdad es el JSON que el validador realmente lee:
   node_modules/next/dist/compiled/@next/font/dist/google/font-data.json,
   entrada "Inter" → [{opsz 14–32}, {wght 100–900}]. `slnt` no existe.
   Verificar SIEMPRE contra ese JSON, nunca contra la prosa de la doc.

   `latin-ext` es obligatorio, no opcional: sin él se rompen "Ángel",
   "Pérez", "práctica", "diseñado".

   Sin `adjustFontFallback: false` — se deja en su default `true`, que es
   lo que genera la métrica de respaldo ajustada y protege el CLS del
   presupuesto de §4.3·9.

   Sin `font-optical-sizing` forzado — se deja en el `auto` del navegador.
   Inter v4 se diseñó para eso, y la tanda (d) debe juzgar la escala
   tipográfica con el eje ya activo, no neutralizado. */
export const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  axes: ['opsz'],
  variable: '--lp-font',
  display: 'swap',
})
