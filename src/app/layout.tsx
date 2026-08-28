import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Spinus®',
  description: 'Sistema de gestión clínica — Cirugía de Columna, Traumatología y Ortopedia',
}

/* ═══ EL VIEWPORT DEL DOCUMENTO (bloque 6 · paso 10) ══════════════════════════
   Antes NO se declaraba ninguno, así que Next emitía el suyo por defecto
   —`width=device-width, initial-scale=1`— y no había `viewport-fit`.

   ⚠️ ES UN EXPORT Y NO UN `<meta>` A MANO. Next 16 resuelve `viewport` por ruta
   y emite él la etiqueta; si además la escribiéramos en el `<head>` de abajo
   saldrían DOS `<meta name="viewport">` y gana la primera, que sería la de Next
   sin nuestros campos. Por eso `theme-color`, que sí estaba a mano, se ha mudado
   aquí: la etiqueta manual y este export no pueden coexistir.

   ⚠️ Y VA EN EL LAYOUT RAÍZ, o sea que aplica a TODA la aplicación: la agenda,
   las otras veinte páginas de `(app)`, el login y la landing. No es una decisión
   de la agenda aunque el paso venga de ahí. */
export const viewport: Viewport = {
  /* ── EL COLOR DE LA BARRA DEL SISTEMA ───────────────────────────────────
     ⚠️ ES EL NAVY DEL MENÚ LATERAL Y DE LA BANDA MÓVIL DE LA AGENDA, NO
     `--cp` A PELO. Es el valor al que resuelve `--ag-navy` de `globals.css`
     —`hsl(from #1a3a5c h s 20%)`— con la marca POR DEFECTO. Se escribe crudo
     porque un `<meta>` no lee variables CSS: el navegador lo lee del HTML antes
     de que exista hoja de estilos alguna, y `ThemeProvider` inyecta `--cp` ya
     montado y sólo dentro de `(app)`.

     ⚠️ POR ESO NO SIGUE A LA MARCA DE LA CLÍNICA, Y NO PASA NADA: donde de
     verdad se ve la barra de estado es en la app instalada de iOS, y allí este
     valor NO se usa. iOS la pinta con `black-translucent` —o sea transparente—
     y lo que se ve es EL PÍXEL DE LA PÁGINA que hay debajo, que sí sale de
     `--ag-navy` y sí sigue a la marca (ver la franja de `body::before` en
     `globals.css`). Este valor manda en Chrome de Android y en la barra de
     direcciones del navegador, donde no hay clínica que valga porque se lee
     antes de saber quién entra.

     ⚠️ UNO SOLO Y SIN `media`, a propósito. El cromo de marca NO cambia con el
     tema —el menú lateral no cambia, y `--ag-navy` no se redeclara en oscuro—,
     así que una segunda entrada para `prefers-color-scheme: dark` diría
     exactamente lo mismo. Si algún día el navy sí se tematiza, aquí van dos. */
  themeColor: '#163250',
  /* ── DIBUJARSE BAJO LAS ÁREAS DEL SISTEMA ───────────────────────────────
     ⚠️ ESTA LÍNEA ES LA QUE ENCIENDE TODOS LOS `env(safe-area-inset-*)` DE LA
     APLICACIÓN. Sin ella valen CERO en todas partes, y con ella empiezan a
     valer lo que mide la muesca y la barra de gestos. Los que ya estaban
     escritos y esperaban a esto: la banda y la barra «Agendar» de la agenda
     (`globals.css`) y la barra de acciones de los formularios de documentos
     (`spinus-tokens.css`, `.sp-doc-actions`).

     ⚠️ Y ES LO QUE QUITA LA FRANJA NEGRA DE iOS. El `<head>` de abajo ya pedía
     `black-translucent`, que significa «barra transparente, píntala tú»; sin
     `cover` la página nunca llegaba ahí debajo y iOS rellenaba el hueco con
     negro. El color no faltaba: faltaba el píxel.

     ⚠️ NO CAMBIA NADA EN UN NAVEGADOR NORMAL. En una pestaña de Safari o Chrome
     las áreas seguras valen 0 en vertical, así que todo esto degrada a lo de
     siempre. Donde se nota es en la app instalada. */
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <head>
        {/* ⚠️ `theme-color` YA NO ESTÁ AQUÍ: se mudó al export `viewport` de
            arriba. No lo repongas — dos etiquetas del mismo nombre y gana la
            que no queremos. */}
        <meta name="mobile-web-app-capable" content="yes" />
        {/* ⚠️ `black-translucent` SÓLO FUNCIONA CON `viewportFit: 'cover'`, que
            está en el export de arriba. Los dos van juntos o esto vuelve a
            pintar la franja negra. */}
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Spinus" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="min-h-full antialiased">
        {children}
      </body>
    </html>
  )
}
