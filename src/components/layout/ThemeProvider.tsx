'use client'

import { useClinica } from '@/hooks/useClinica'

/**
 * Inyecta CSS variables con los colores de la clínica y sobreescribe
 * las clases Tailwind hardcodeadas en toda la interfaz.
 * No requiere modificar cada componente individualmente.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { colorPrimario, colorSecundario } = useClinica()

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

    /* ── Tabs activos ── */
    .border-b-2.border-\\[\\#1e5fa8\\] { border-bottom-color: var(--cs) !important; }

    /* ── Focus rings ── */
    .focus\\:ring-\\[\\#1e5fa8\\]\\/30:focus {
      --tw-ring-color: color-mix(in srgb, var(--cs) 30%, transparent) !important;
    }
    .focus\\:ring-2:focus {
      --tw-ring-color: color-mix(in srgb, var(--cs) 30%, transparent);
    }

    /* ── Checkboxes y switches ── */
    .accent-\\[\\#1e5fa8\\] { accent-color: var(--cs) !important; }

    /* ── Fondo azul claro de cards/badges ── */
    .bg-\\[\\#e8f4fd\\] {
      background-color: color-mix(in srgb, var(--cs) 12%, white) !important;
    }
  `

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {children}
    </>
  )
}
