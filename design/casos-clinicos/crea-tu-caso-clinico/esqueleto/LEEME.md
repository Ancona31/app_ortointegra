# Crea tu Caso Clínico — Paquete mockup + esqueleto

Guía de construcción para **Spinus**. **No es código para integrar directo** (no
conoce tu DB ni tu arquitectura): es un **mockup de referencia** + el **esqueleto**
(tokens y estructura) para que tú lo reconstruyas con Claude Code sobre tu código.

## Qué hay aquí

```
Crea tu Caso Clinico.html      ← MOCKUP interactivo (ábrelo en el navegador)
assets/
  spinus.css                   ← tokens base
  proto/*.jsx                  ← componentes (la estructura REAL del HTML)
  proto/*.css                  ← estilos REALES (medidas exactas)

esqueleto/                     ← EL ESQUELETO PARA CONSTRUIR
  TOKENS.css                   ← todos los colores, medidas, radios, sombras, tipos
  ESTRUCTURA.md                ← distribución del HTML (DOM) de cada pantalla
  css/                         ← copia de los CSS del mockup (medidas por componente)

docs/                          ← contexto de producto (opcional pero útil)
  00-Propuesta.md · 01-IA · 02-Pantallas · 03-Componentes
  04-Design-tokens · 05-Decision-record · 06-Gaps-y-preguntas
```

## Cómo usarlo con Claude Code

1. **Abre el mockup** (`Crea tu Caso Clinico.html`) para ver el comportamiento y la
   estética objetivo. Navega: lista → editor → anotaciones → exportar → privacidad.
2. Dale a Claude Code **`esqueleto/TOKENS.css`** y **`esqueleto/ESTRUCTURA.md`** como
   referencia de estilo y estructura. Pídele que mapee los tokens a TU sistema
   (Tailwind 4 / tus CSS vars) y que reconstruya pantalla por pantalla **sobre tu
   código y tu DB**, respetando tu arquitectura (ruta lazy + Error Boundary + feature flag).
3. Para el **editor de anotaciones**, considera una librería en vez de construir de
   cero: **marker.js 2** (anotación de imágenes: flecha/texto/blur/elipse/trazo,
   mobile, export) + un *custom marker* para el **ángulo de Cobb**. Alternativa:
   **Fabric.js** (handles de transformación con rotación). Ver `docs/05-Decision-record.md`.

## Reglas de oro (no romper la identidad Spinus)

- Navy `#1a3a5c`, fondo `#f3f6fb`, cards `rounded-2xl/3xl`, sombras suaves.
- Tipografía del sistema (SF Pro / iOS), easing `cubic-bezier(0.32,0.72,0,1)`, CSS puro.
- Privacidad **sin IA**: difuminado manual + doble confirmación + aviso legal automático.
- Anotador: 1 herramienta = 1 gesto (nada tipo Photoshop). Paleta de color cerrada.

## Pendientes que decides tú (antes de construir)
Ver `docs/06-Gaps-y-preguntas.md`: cuotas de video, evidencia de consentimiento +
**validación legal**, permisos por rol, y confirmar el corte MVP (PDF + Story primero).
