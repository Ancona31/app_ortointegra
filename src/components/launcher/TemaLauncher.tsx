'use client'

import { createContext, useContext, useEffect, useState } from 'react'

/* ═══ EL TEMA DE /inicio, ATADO AL DE LA APP ══════════════════════════════════
 *
 * ⚠️ ESTE ARCHIVO SUSTITUYE A `launcher/ThemeContext.tsx`, QUE DECIDÍA EL TEMA
 * POR LA HORA DEL DÍA. Aquel `ThemeProvider` no leía `localStorage`, no tocaba
 * la clase `dark` del <html> y no se enteraba del interruptor del menú lateral:
 * a las 20:00 el launcher se ponía oscuro aunque el médico tuviera la app en
 * claro, y a las 8:00 salía claro aunque la tuviera en oscuro. Además exportaba
 * `ThemeProvider` y `useTheme`, los MISMOS nombres que `layout/ThemeProvider`,
 * así que en un import quedaba a suerte del alias cuál entraba.
 *
 * ⚠️ NO MONTA `layout/ThemeProvider` NI LO REEMPLAZA, y es deliberado. Aquel
 * inyecta además la hoja de traducción de modo oscuro, que repinta `.bg-white`,
 * `.bg-slate-*` y compañía con `!important`. `/inicio` tiene su propio diseño
 * oscuro escrito a mano —cada bloque elige su color con el booleano de aquí—, y
 * meterle esa hoja encima le cambiaría superficies que ya están resueltas. Este
 * contexto sólo LEE el tema; no pinta nada más que el fondo de la página.
 *
 * ⚠️ LA FUENTE DE VERDAD ES LA CLASE `dark` DEL <html>, no `localStorage`. Es la
 * misma que escribe el script del <head> de `layout.tsx` antes del primer
 * pintado y la que mueve el interruptor del menú, así que leyéndola no hay dos
 * versiones de la verdad ni orden de carga que respetar.
 */
const Ctx = createContext<{ dark: boolean }>({ dark: false })

export function useTemaLauncher(): { dark: boolean } {
  return useContext(Ctx)
}

export function TemaLauncherProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false)
  const [montado, setMontado] = useState(false)

  useEffect(() => {
    const raiz = document.documentElement
    const leer = () => setDark(raiz.classList.contains('dark'))
    leer()
    setMontado(true)
    /* El observador es por si el tema cambia sin recargar. Hoy `/inicio` no
       lleva interruptor, pero sí lo lleva el menú lateral de `(app)` y se
       navega entre las dos sin recarga. Sin esto, volver de la app con el tema
       cambiado dejaría el launcher pintado del anterior. */
    const obs = new MutationObserver(leer)
    obs.observe(raiz, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  return (
    <Ctx.Provider value={{ dark }}>
      {/* ⚠️ EL FONDO DEL PLACEHOLDER SALE DE UN TOKEN Y NO DE UN HEX. Antes era
          `bg-[#f0f4f8]`, o sea claro fijo: en tema oscuro el primer fotograma
          era un rectángulo claro a pantalla completa. `--sp-app-bg` ya tiene sus
          dos valores, así que el placeholder nace del color correcto sin esperar
          a que monte React. */}
      {!montado ? (
        <div className="min-h-screen" style={{ background: 'var(--sp-app-bg)' }} />
      ) : (
        <div
          className="min-h-screen relative overflow-hidden transition-colors duration-500"
          style={{
            background: dark
              ? '#020617'
              : 'linear-gradient(180deg, rgba(30,95,168,0.07) 0%, rgba(30,95,168,0.02) 50%, #f0f4f8 100%)',
          }}
        >
          {children}
        </div>
      )}
    </Ctx.Provider>
  )
}
