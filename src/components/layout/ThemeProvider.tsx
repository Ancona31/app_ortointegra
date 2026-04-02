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
       MODO OSCURO — html.dark
    ═══════════════════════════════════════════════ */
    html.dark body {
      background-color: #0f172a !important;
      color: #e2e8f0 !important;
    }

    /* Fondo de página */
    html.dark .min-h-full { background-color: #0f172a !important; }

    /* Cards y panels */
    html.dark .bg-white          { background-color: #1e293b !important; }
    html.dark .bg-slate-50       { background-color: #0f172a !important; }
    html.dark .bg-slate-100      { background-color: #1e293b !important; }
    html.dark .bg-slate-200      { background-color: #334155 !important; }

    /* Bordes */
    html.dark .border-slate-200  { border-color: #334155 !important; }
    html.dark .border-slate-100  { border-color: #1e293b !important; }
    html.dark .border-slate-300  { border-color: #475569 !important; }
    html.dark .divide-slate-200 > * + * { border-color: #334155 !important; }

    /* Texto */
    html.dark .text-slate-900    { color: #f1f5f9 !important; }
    html.dark .text-slate-800    { color: #e2e8f0 !important; }
    html.dark .text-slate-700    { color: #cbd5e1 !important; }
    html.dark .text-slate-600    { color: #94a3b8 !important; }
    html.dark .text-slate-500    { color: #64748b !important; }
    html.dark .text-slate-400    { color: #475569 !important; }
    html.dark .text-slate-300    { color: #334155 !important; }

    /* Inputs, textareas, selects */
    html.dark input:not([type="color"]),
    html.dark textarea,
    html.dark select {
      background-color: #0f172a !important;
      color: #e2e8f0 !important;
      border-color: #334155 !important;
    }
    html.dark input::placeholder,
    html.dark textarea::placeholder { color: #475569 !important; }

    /* Hover states */
    html.dark .hover\\:bg-slate-50:hover  { background-color: #1e293b !important; }
    html.dark .hover\\:bg-slate-100:hover { background-color: #334155 !important; }

    /* Sombras */
    html.dark .shadow-sm {
      box-shadow: 0 1px 2px rgba(0,0,0,0.6) !important;
    }
    html.dark .shadow-xl {
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.7), 0 8px 10px -6px rgba(0,0,0,0.5) !important;
    }

    /* Scrollbar oscuro */
    html.dark ::-webkit-scrollbar-track { background: #1e293b !important; }
    html.dark ::-webkit-scrollbar-thumb { background: #475569 !important; }
    html.dark ::-webkit-scrollbar-thumb:hover { background: #64748b !important; }

    /* Prose (ReactMarkdown) */
    html.dark .prose p,
    html.dark .prose li     { color: #cbd5e1 !important; }
    html.dark .prose strong { color: #e2e8f0 !important; }
    html.dark .prose h1, html.dark .prose h2,
    html.dark .prose h3, html.dark .prose h4 { color: #93c5fd !important; }

    /* Badges / pills de colores suaves */
    html.dark .bg-blue-50    { background-color: #1e3a5f !important; }
    html.dark .bg-emerald-50 { background-color: #064e3b !important; }
    html.dark .bg-red-50     { background-color: #450a0a !important; }
    html.dark .bg-amber-50   { background-color: #451a03 !important; }
    html.dark .bg-violet-50  { background-color: #2e1065 !important; }
    html.dark .bg-indigo-50  { background-color: #1e1b4b !important; }
    html.dark .bg-teal-50    { background-color: #042f2e !important; }
    html.dark .bg-rose-50    { background-color: #4c0519 !important; }
    html.dark .bg-orange-50  { background-color: #431407 !important; }
    html.dark .bg-green-50   { background-color: #052e16 !important; }

    /* Modales */
    html.dark .fixed.inset-0.bg-black\\/50 { background-color: rgba(0,0,0,0.75) !important; }

    /* Tabs */
    html.dark .border-b.border-slate-200 { border-color: #334155 !important; }
  `

  return (
    <Ctx.Provider value={{ dark, toggle }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {children}
    </Ctx.Provider>
  )
}
