'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useClinica } from '@/hooks/useClinica'

type ThemeCtx = { dark: boolean; toggle: () => void }
const Ctx = createContext<ThemeCtx>({ dark: false, toggle: () => {} })
export const useTheme = () => useContext(Ctx)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { colorPrimario, colorSecundario } = useClinica()
  const [dark, setDark] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('theme')
      if (saved === 'dark') { setDark(true); document.documentElement.classList.add('dark') }
    } catch {}
  }, [])

  function toggle() {
    setDark(prev => {
      const next = !prev
      try {
        localStorage.setItem('theme', next ? 'dark' : 'light')
        document.documentElement.classList.toggle('dark', next)
      } catch {}
      return next
    })
  }

  const css = `
    :root {
      --cp: ${colorPrimario};
      --cs: ${colorSecundario};
    }

    /* ── Fondos ── */
    .bg-\\[\\#1e5fa8\\]               { background-color: var(--cs) !important; }
    .bg-\\[\\#1a3a5c\\]               { background-color: var(--cp) !important; }
    .hover\\:bg-\\[\\#1e5fa8\\]:hover { background-color: var(--cs) !important; }
    .hover\\:bg-\\[\\#1a3a5c\\]:hover { background-color: var(--cp) !important; }

    /* ── Texto ── */
    .text-\\[\\#1e5fa8\\]               { color: var(--cs) !important; }
    .text-\\[\\#1a3a5c\\]               { color: var(--cp) !important; }
    .hover\\:text-\\[\\#1e5fa8\\]:hover { color: var(--cs) !important; }
    .hover\\:text-\\[\\#1a3a5c\\]:hover { color: var(--cp) !important; }

    /* ── Bordes ── */
    .border-\\[\\#1e5fa8\\]           { border-color: var(--cs) !important; }
    .border-b-\\[\\#1e5fa8\\]         { border-bottom-color: var(--cs) !important; }
    .border-t-\\[\\#1e5fa8\\]         { border-top-color: var(--cs) !important; }
    .border-b-2.border-\\[\\#1e5fa8\\] { border-bottom-color: var(--cs) !important; }

    /* ── Focus rings ── */
    .focus\\:ring-\\[\\#1e5fa8\\]\\/30:focus {
      --tw-ring-color: color-mix(in srgb, var(--cs) 30%, transparent) !important;
    }
    .focus\\:ring-2:focus {
      --tw-ring-color: color-mix(in srgb, var(--cs) 30%, transparent);
    }

    /* ── Misc ── */
    .accent-\\[\\#1e5fa8\\] { accent-color: var(--cs) !important; }
    .bg-\\[\\#e8f4fd\\] {
      background-color: color-mix(in srgb, var(--cs) 12%, white) !important;
    }

    /* ═══════════════════════════════════════════════
       MODO OSCURO — Material Design Dark Theme
       Base:    #121212  (dp0 — fondo raíz)
       dp1:     #1E1E1E  (cards primer nivel)
       dp2:     #242424  (cards segundo nivel / inputs)
       dp4:     #2C2C2C  (hover / elevated)
       Texto primario:    rgba(255,255,255,0.87)
       Texto secundario:  rgba(255,255,255,0.60)
       Texto desactivado: rgba(255,255,255,0.38)
       Bordes/divisores:  rgba(255,255,255,0.12)
    ═══════════════════════════════════════════════ */

    /* ── Raíz ── */
    html.dark body {
      background-color: #121212 !important;
      color: rgba(255,255,255,0.87) !important;
    }
    html.dark .min-h-full { background-color: #121212 !important; }

    /* ── Superficies / cards ── */
    html.dark .bg-white          { background-color: #1E1E1E !important; }
    html.dark .bg-slate-50       { background-color: #242424 !important; }
    html.dark .bg-slate-100      { background-color: #2C2C2C !important; }
    html.dark .bg-slate-200      { background-color: #383838 !important; }

    /* ── Bordes — muy sutiles, Material usa 12% blanco ── */
    html.dark .border-slate-200,
    html.dark .border-slate-200\\/80  { border-color: rgba(255,255,255,0.12) !important; }
    html.dark .border-slate-100       { border-color: rgba(255,255,255,0.08) !important; }
    html.dark .border-slate-300       { border-color: rgba(255,255,255,0.16) !important; }
    html.dark .divide-slate-100 > * + *,
    html.dark .divide-slate-200 > * + * { border-color: rgba(255,255,255,0.08) !important; }

    /* ── Texto ── */
    /* Texto oscuro macOS → blanco/87 */
    html.dark .text-\\[\\#1d1d1f\\]     { color: rgba(255,255,255,0.87) !important; }
    /* Texto secundario macOS → blanco/60 */
    html.dark .text-\\[\\#86868b\\]     { color: rgba(255,255,255,0.60) !important; }

    html.dark .text-slate-900    { color: rgba(255,255,255,0.87) !important; }
    html.dark .text-slate-800    { color: rgba(255,255,255,0.87) !important; }
    html.dark .text-slate-700    { color: rgba(255,255,255,0.75) !important; }
    html.dark .text-slate-600    { color: rgba(255,255,255,0.60) !important; }
    html.dark .text-slate-500    { color: rgba(255,255,255,0.50) !important; }
    html.dark .text-slate-400    { color: rgba(255,255,255,0.38) !important; }
    html.dark .text-slate-300    { color: rgba(255,255,255,0.28) !important; }

    /* ── Colores primarios desaturados en dark ── */
    /* Evita que el azul "vibre" sobre el fondo oscuro */
    html.dark .text-\\[\\#1e5fa8\\],
    html.dark .hover\\:text-\\[\\#1e5fa8\\]:hover { color: #60a5fa !important; }
    html.dark .text-\\[\\#1a3a5c\\],
    html.dark .hover\\:text-\\[\\#1a3a5c\\]:hover { color: #93c5fd !important; }
    html.dark .text-emerald-600   { color: #34d399 !important; }
    html.dark .text-red-600       { color: #f87171 !important; }
    html.dark .text-red-500       { color: #f87171 !important; }
    html.dark .text-amber-700     { color: #fbbf24 !important; }
    html.dark .text-blue-600      { color: #60a5fa !important; }

    /* ── Inputs / textareas / selects ── */
    html.dark input:not([type="color"]),
    html.dark textarea,
    html.dark select {
      background-color: #242424 !important;
      color: rgba(255,255,255,0.87) !important;
      border-color: rgba(255,255,255,0.12) !important;
    }
    html.dark input::placeholder,
    html.dark textarea::placeholder { color: rgba(255,255,255,0.38) !important; }

    /* ── Hover states ── */
    html.dark .hover\\:bg-slate-50:hover,
    html.dark .hover\\:bg-slate-50\\/80:hover { background-color: #2C2C2C !important; }
    html.dark .hover\\:bg-slate-100:hover     { background-color: #383838 !important; }

    /* ── Sombras — Material las elimina, usa elevación por color ── */
    html.dark .shadow-sm  { box-shadow: none !important; }
    html.dark .shadow-md  { box-shadow: none !important; }
    html.dark .shadow-xl  {
      box-shadow: 0 20px 40px rgba(0,0,0,0.8) !important;
    }

    /* ── Scrollbar ── */
    html.dark ::-webkit-scrollbar-track { background: #1E1E1E !important; }
    html.dark ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.16) !important; border-radius: 3px; }
    html.dark ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.28) !important; }

    /* ── Prose (ReactMarkdown) ── */
    html.dark .prose p,
    html.dark .prose li     { color: rgba(255,255,255,0.75) !important; }
    html.dark .prose strong { color: rgba(255,255,255,0.87) !important; }
    html.dark .prose h1, html.dark .prose h2,
    html.dark .prose h3, html.dark .prose h4 { color: #93c5fd !important; }

    /* ── Badges de color — usar tint suave, no bloques sólidos oscuros ── */
    html.dark .bg-blue-50    { background-color: rgba(59,130,246,0.14)  !important; }
    html.dark .bg-emerald-50 { background-color: rgba(16,185,129,0.14)  !important; }
    html.dark .bg-red-50     { background-color: rgba(239,68,68,0.14)   !important; }
    html.dark .bg-amber-50   { background-color: rgba(245,158,11,0.14)  !important; }
    html.dark .bg-violet-50  { background-color: rgba(139,92,246,0.14)  !important; }
    html.dark .bg-indigo-50  { background-color: rgba(99,102,241,0.14)  !important; }
    html.dark .bg-teal-50    { background-color: rgba(20,184,166,0.14)  !important; }
    html.dark .bg-rose-50    { background-color: rgba(244,63,94,0.14)   !important; }
    html.dark .bg-orange-50  { background-color: rgba(249,115,22,0.14)  !important; }
    html.dark .bg-green-50   { background-color: rgba(34,197,94,0.14)   !important; }
    html.dark .bg-sky-50     { background-color: rgba(14,165,233,0.14)  !important; }

    /* Bordes de badges */
    html.dark .border-blue-100,
    html.dark .border-blue-200    { border-color: rgba(59,130,246,0.25)  !important; }
    html.dark .border-emerald-100,
    html.dark .border-emerald-200 { border-color: rgba(16,185,129,0.25)  !important; }
    html.dark .border-red-100,
    html.dark .border-red-200     { border-color: rgba(239,68,68,0.25)   !important; }
    html.dark .border-amber-100,
    html.dark .border-amber-200   { border-color: rgba(245,158,11,0.25)  !important; }

    /* Texto de badges — desaturado */
    html.dark .text-blue-600,
    html.dark .text-\\[\\#1a3a5c\\]   { color: #93c5fd !important; }
    html.dark .text-emerald-700      { color: #6ee7b7 !important; }
    html.dark .text-red-700          { color: #fca5a5 !important; }
    html.dark .text-amber-700        { color: #fcd34d !important; }
    html.dark .text-blue-400         { color: #7dd3fc !important; }

    /* ── Modales ── */
    html.dark .fixed.inset-0.bg-black\\/50 { background-color: rgba(0,0,0,0.8) !important; }

    /* ── Tabs ── */
    html.dark .border-b.border-slate-200 { border-color: rgba(255,255,255,0.12) !important; }

    /* ── Gradientes del header de tarjeta — se mantienen, son parte del branding ── */
    /* Los gradientes azules del header de TarjetaPaciente se ven bien en dark */
  `

  return (
    <Ctx.Provider value={{ dark, toggle }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {children}
    </Ctx.Provider>
  )
}
