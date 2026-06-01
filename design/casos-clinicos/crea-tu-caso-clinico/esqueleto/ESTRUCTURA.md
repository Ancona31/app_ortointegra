# Esqueleto HTML — Crea tu Caso Clínico

Estructura (distribución del DOM) de cada pantalla del mockup, con nombres de clase
y qué archivo CSS la estiliza. **Es un esqueleto de referencia, no código para pegar.**
Reconstrúyelo sobre tu app respetando tu DB y tu arquitectura.

> Fuente real de la estructura: los componentes en `assets/proto/*.jsx`.
> Fuente real de estilos/medidas: `esqueleto/TOKENS.css` + `assets/proto/*.css`.
> Animaciones: CSS puro, easing `cubic-bezier(0.32,0.72,0,1)`.

---

## 0. Shell (marco) — `shell.jsx` · `proto.css`

```
.shell                         (flex; min-height:100vh)
├── .shell-side                (264px; drawer en ≤880px)
│   └── aside.sidebar          (navy-grad; sticky; radio --r-xl)
│       ├── .side-brand        (logo 64 círculo + nombre + especialidad)
│       ├── nav.side-nav
│       │   └── .side-item[.active]   (ícono 20 + label; activo = píldora blanca)
│       │       └── .side-new         (badge "NUEVO" en "Crea tu caso clínico")
│       ├── .side-divider
│       ├── nav.side-nav  (Mi perfil · Ayuda · Modo Offline·.side-dot verde)
│       └── .side-foot    (Modo oscuro · Cerrar sesión · Aviso de Privacidad)
└── main.shell-main
    ├── header.mobile-bar      (solo ≤880px: hamburguesa + título)
    └── [CONTENIDO DE PANTALLA]
```

---

## 1. Lista de casos — `list.jsx` · `proto.css`

```
.page  (padding 34/40; max 1180; centrado)
├── .page-head
│   ├── div  (.page-eyebrow + h1.page-title 33/700 + p.page-sub)
│   └── button.btn.btn-primary.btn-lg   "Nuevo caso"
├── .toolbar
│   ├── .searchbox   (ícono + input)            buscar por título/región/paciente
│   └── .seg         (Todos · Borradores · Listos · Publicados + contador)
└── .cases-grid   (grid auto-fill minmax(290px,1fr); gap 18)
    ├── .new-case-card                      (tarjeta fantasma "Crear nuevo caso")
    └── article.case-card                   (×N)
        ├── .case-cover  (alto 148; fondo = portada; .case-cover-grid overlay)
        │   ├── .case-media-tags  (.media-tag Rx/Foto/Video con conteo)
        │   └── .pill.case-status (Borrador=amber · Listo=blue · Publicado=green)
        ├── .case-body
        │   ├── .case-region  + .case-title
        │   └── .case-meta    (.case-mono monograma + paciente/independiente + fecha)
        └── .case-foot   (bandera consentimiento ✓/⚠ + .pill tono)
```

Estados de caso: `borrador → listo → publicado`. La bandera de consentimiento es
un flag manual (no IA).

---

## 2. Editor del caso — `editor.jsx` · `editor.css`

```
.editor (max 1180; centrado)
├── .editor-top   (.back-link · .autosave · btn Previsualizar · btn Exportar)
└── .editor-grid  (grid 1fr / 332px; gap 26 → 1 col en ≤1080px)
    ├── .editor-main
    │   ├── input.editor-title              (título inline, 25/700)
    │   ├── .block  "Material gráfico"
    │   │   ├── .media-grid                 (grid auto-fill minmax(132,1fr))
    │   │   │   └── .media-thumb (aspect 4/3)
    │   │   │        ├── .thumb-kind (Rx/Foto/Video)  + .thumb-anno (#anotaciones)
    │   │   │        └── .thumb-actions (Anotar · borrar; aparece en hover)
    │   │   └── .slots-row  (3× .media-slot: Foto · Radiografía/DICOM · Video)
    │   ├── .block  "Comparativo antes/después"
    │   │   └── .ba-row (.ba-card Pre-op → .ba-arrow → .ba-card Post-op)
    │   └── .block  "Texto del caso"
    │       ├── .field > textarea.editor-textarea   (resumen clínico)
    │       ├── .tone-row > .seg   (Serio/educativo · Relajado/divulgativo)
    │       └── .tone-preview      (preview del relato según tono — texto que TÚ
    │                               escribes; la plantilla solo cambia estilo, no IA)
    └── aside.editor-rail  (sticky top 18)
        ├── .rail-card  "Vínculo con expediente"
        │   ├── .switch-row + .switch (asociar a paciente on/off)
        │   └── .linked-patient | .indep-note
        ├── .rail-card  "Clasificación"  (.select región · .select tipo de caso)
        ├── .rail-card.consent-card[.warn]  "Privacidad del paciente"
        │   ├── .consent-state (ok | warn: recordatorio manual de anonimizar)
        │   └── label.consent-check (checkbox de consentimiento informado)
        └── button.btn.btn-primary.btn-lg.rail-export  "Vista previa y exportar"
```

---

## 3. Editor de anotaciones (★) — `annotate.jsx` · `annotate.css`

Overlay a pantalla completa, fondo `#0b1016`. **Touch-first** (pointer events +
pointer-capture; `touch-action:none` solo en el lienzo).

```
.annot  (position:fixed; inset:0; z 60)
├── .annot-top
│   ├── button.annot-icon-btn  (volver)
│   ├── .annot-top-mid  (Undo · Redo · [Trash si hay selección])
│   └── .annot-done  "Listo"
├── .annot-stage
│   └── .annot-canvas-wrap
│       └── .annot-canvas  (coords FIJAS 300×400; aspect 3/4; touch-action:none)
│           ├── .annot-grid                  (rejilla sutil)
│           ├── .blur-region (×N)            (difuminado · backdrop-filter blur)
│           ├── svg.annot-svg  (viewBox 0 0 300 400; preserveAspectRatio meet)
│           │   ├── <defs> markers de punta de flecha (por color)
│           │   └── por anotación:
│           │       · arrow  = hit-line transparente 22 + línea color (4×size)
│           │                  + markerEnd + 2 handles r11 (reorientar/redimensionar)
│           │       · circle = hit-ellipse 22 + elipse color + 2 handles r11
│           │       · pen    = hit-path 22 + path color
│           │       · angle  = 2 hit-lines 22 + 2 líneas punteadas + 4 handles r9
│           │                  + badge "N°" (Cobb, lectura en vivo)
│           └── .text-label (×N)   (HTML; wrap width min(82%,Nch); tap = editar)
│               └── input.text-input-inline (edición inline) | span
├── .annot-hint            (pista contextual para Difuminar / Ángulo)
├── .annot-controls
│   ├── .annot-colors  (5 .swatch — paleta clínica cerrada)
│   └── .annot-sizes   (4 .sizedot — grosor [0.6,1,1.6,2.4]; aplica a nuevo o selección)
└── .annot-dock        (Mover · Flecha · Círculo · Texto · Trazo · Difuminar · Ángulo)
```

**Modelo de interacción** (clave para reconstruir):
- 1 herramienta = 1 gesto (sin capas, sin Photoshop).
- Crear: tap (texto/ángulo) o arrastre (flecha/círculo/trazo/blur).
- Seleccionar: tap sobre la anotación (hit-area ancha invisible).
- Reorientar/redimensionar: arrastrar las manijas de extremo.
- Mover: arrastrar el cuerpo (herramienta Mover).
- Borrar: seleccionar → basurero en la barra superior.

---

## 4. Exportación — `export.jsx` · `export.css`

```
.export (max 1180)
├── .editor-top  (volver al editor · btn Descargar · btn "Compartir a redes")
└── .export-grid  (grid 380px / 1fr; gap 26 → 1 col en ≤1080px, preview arriba)
    ├── .export-panel
    │   ├── .exp-section "Formato"   (.fmt-card: PDF · Story · Carrusel · Feed)
    │   ├── .exp-section "Plantilla" (.tpl-card: Académico · Clínico ·
    │   │                              Divulgativo · Marca + .tpl-desc)
    │   ├── .exp-section "Tu toque"  (acento ×4 · switch marca de agua · switch contacto)
    │   └── .exp-privacy-note        (recordatorio de aviso legal automático)
    └── .export-stage  (sticky)
        ├── .stage-bar  (.pill formato + .pill plantilla)
        └── .stage-canvas > .prev.prev-{plantilla}   (composición en vivo del export;
             aspect ratio según formato: pdf 8.5/11 · story 9/16 · carrusel 4/5 · feed 1/1)
             ├── .prev-head (logo+nombre)  · .prev-title
             ├── .prev-compare (figuras Pre/Post con anotación)  · .prev-chips/caption
             └── .prev-foot (.prev-wm marca de agua + .prev-legal aviso legal)
```

### Compuerta de privacidad (modal en `export.jsx`)
```
.modal-scrim > .modal.priv-modal
├── .priv-icon (escudo) + h2 + .priv-lead (NOM-024 / LFPDPPP)
├── label.priv-check  ☑ consentimiento informado (obligatorio)
├── label.priv-check  ☑ anonimización manual verificada (obligatorio)
├── button.priv-fix   "Abrir herramienta de difuminado"
├── .priv-legal-note  (aviso legal automático)
└── .modal-actions    (Cancelar · Compartir [deshabilitado hasta ✓✓])
```
Sin IA: anonimización manual (difuminado) + confirmación. Web Share API nativo.

---

## Archivos del esqueleto

| Archivo | Qué contiene |
|---|---|
| `esqueleto/TOKENS.css` | Todos los colores, medidas, radios, sombras, tipografía, dimensiones |
| `esqueleto/ESTRUCTURA.md` | Este documento (distribución del HTML por pantalla) |
| `esqueleto/css/*.css` | Copia de los CSS reales del mockup (medidas exactas por componente) |
| `Crea tu Caso Clinico.html` + `assets/` | El mockup interactivo (para ver y tomar de guía) |
| `docs/*.md` | Propuesta, IA, componentes, decision record, gaps (contexto de producto) |
