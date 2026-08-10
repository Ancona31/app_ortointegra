# 03 · Modal posterior a imprimir

Spec de implementación. Extiende `ModalDocumentoGenerado.tsx`; **no lo reescribe**.
Aplica `PROPUESTA_DISENO_DOCUMENTOS.md` §2. Común a los 8 formatos.

---

## 0 · Invariantes del componente actual — no tocar

1. **Visualizar es un `<a href>`, no un `onClick`.** Entre el toque y la navegación no
   puede quedar asincronía o Safari/iOS lo bloquea en silencio. `pdfUrl` en `useMemo`,
   nunca en efecto con `setState`.
2. **No hay botón de imprimir.** El visor de PDF ya lo trae en las cuatro plataformas.
3. **Lo deshabilitado va a opacidad plena.** Se comunica con relleno, cursor y badge;
   nunca apagando el texto, porque entonces no se lee *qué* es lo que no se puede usar.
4. **`title=""` + `spinusGeometry="done"`** → `ModalShell` omite el header entero. La
   salida es Cerrar, el backdrop y `Escape`. El título vive en el cuerpo.
5. El object URL se revoca a los **60 s** de desmontar.

**Único cambio de composición: la rejilla pasa de 2 celdas a 3, y Correo deja de estar
deshabilitado.**

---

## 1 · Geometría

| Parte | Token | Valor |
|---|---|---|
| Shell | `ModalShell elevated spinusGeometry="done" title=""` | `z-[60]`, portalado |
| Ancho | `--sp-modal-w-done` | 600 px · móvil `calc(100vw - 32px)` |
| Radio | `--sp-r-modal` | 20 |
| Sombra | `--sp-shadow-modal` | — |
| Backdrop | `--sp-backdrop` | rgba(15,32,56,.55) |
| Cuerpo | — | `px-4 md:px-6 pt-8 pb-6`, `flex-col items-center text-center gap-4` |
| Pie | — | `p-4 md:px-6 space-y-2.5` |

### 1.1 · Medallón

| Caso | Valor |
|---|---|
| Éxito | `.sp-medal` 96 px (fondo `--sp-success-bg`) + `.sp-medal__core` 70 px (fondo `--sp-success`) con `Check` — **no `CheckCircle2`**: renderiza dos paths y el arco se parte bajo el `stroke-dasharray` |
| Aviso | Círculo de 70 px, fondo `--sp-warn-bg-badge`, `AlertTriangle` 32 px `--sp-warn` |

Se oculta en el sub-panel de correo.

### 1.2 · Título y cuerpo

- Título: `.sp-title-state` — `--sp-fs-success` 27 px / `--sp-fw-black` / `--sp-lh-tight` /
  `--sp-ls-tight` / `--sp-ink-800`.
- Cuerpo: `.sp-body max-w-xs` — `Ya puedes abrirlo para revisarlo o imprimirlo.`

**La prop `titulo` lleva la frase completa**, no el sustantivo: la concordancia de género
no se puede resolver desde el componente. Renombrar la prop a `tituloCompleto` para que el
cambio de contrato no pase inadvertido en los 8 llamantes.

| Formato | `tituloCompleto` |
|---|---|
| Receta | `Receta generada` |
| Laboratorio | `Solicitud de laboratorio generada` |
| Imagen | `Solicitud de imagen generada` |
| Suplementación | `Plan de suplementación generado` |
| Honorarios | `Recibo generado` / `Cotización generada` |
| Internamiento | `Solicitud de internamiento generada` |
| Escrito | `Escrito médico generado` |
| Consentimiento | `Consentimiento generado` |

### 1.3 · Primario

`.sp-btn .sp-btn--primary .sp-btn--primary-block .sp-btn--reward` sobre `<a href>`:
ancho completo, `padding: 16px`, radio `--sp-r-cta` 12, `--sp-fs-btn` 17 / `--sp-fw-bold`,
`--sp-shadow-btn-lg`, icono `Eye` 17 px. Texto `Visualizar`.
Sin blob: `<button disabled>` sin la variante `--reward`.

---

## 2 · Rejilla de acciones

`.sp-grid-actions` — `1fr 1fr`, `gap: 11px`, `margin-top: 8px`, `padding-top: 12px`,
`border-top: 1px solid var(--sp-line-divider)`.

**El colapso a 1 columna pasa de `@media (max-width: 768px)` a consulta de contenedor:**
contenedor `< 420px` → 1 columna, `gap: var(--sp-2-5)`. El modal mide 600 px aunque el
viewport sea de 1180: el viewport no decide aquí.

| Celdas | Disposición |
|---|---|
| 3 (caso normal) | fila 1: Correo · Anexar — fila 2: WhatsApp con `grid-column: 1 / -1` |
| 2 (sin paciente, y Honorarios) | fila única: Correo · WhatsApp, sin `span` |

Botones: `.sp-btn--tertiary` — fondo `--sp-surface`, texto `--sp-ink-700`, borde 1 px
`--sp-line-soft`, `--sp-fw-semi`, `--sp-fs-body-sm` 14, `padding: 13px`,
`min-height: 44px`, radio `--sp-r-btn` 10, icono 17 px con `gap: var(--sp-2)`.
Las celdas igualan altura por `align-items: stretch` (≈66 px). Aceptado.

`style={{ flexDirection: 'column' }}` **solo** en los inertes (necesitan segunda línea para
el badge) y **inline**, no como utilidad: `.sp-btn` gana a las utilidades con el orden de
importación actual.

Cerrar: `.sp-btn--ghost`, `style={{ width: '100%' }}`.

---

## 3 · Anexar al expediente

**`guardadoEnExpediente` deja de ser `boolean` y pasa a `'ok' | 'error' | 'omitido'`.**

| Formato | Comportamiento |
|---|---|
| Consentimiento firmado | Se anexa **solo**, al imprimir, tras el flujo de firma. Nace en `ok`. **No hay acción** |
| Los otros seis con paciente | Anexar es **opcional**: nace en `omitido` y el médico decide |
| Honorarios | **Nunca** se anexa: sin valor clínico. El botón no se renderiza |
| Sin `pacienteId` | No hay expediente: el botón no se renderiza |

| Estado | Aspecto |
|---|---|
| `omitido` | Botón **activo**: fondo `--sp-surface`, borde `--sp-line-soft`, icono `FilePlus` 17 px, texto `Anexar al expediente`. Ni verde ni de peligro |
| Anexando | `.sp-spinner` 17 px + `Anexando…` |
| `ok` | Icono `Check` 18 px `--sp-success`, texto `Anexado al expediente`, fondo `--sp-success-bg-alt`, borde `--sp-success-border`, texto `--sp-ink-700`, `aria-disabled="true"`, no pulsable. **Es un recibo, no un control** |
| `error` | Icono `RefreshCw`, texto `Reintentar anexar`, borde `--sp-danger-border`, texto `--sp-danger-ink`. Pulsable |

**Acuse:** en los formatos opcionales, pulsar anexar produce su propio acuse — el médico
acaba de hacer algo. En el consentimiento **no lo hay**: ocurrió solo al imprimir y esa
notificación ya salió en el flujo de firma. El modal solo refleja el estado resultante.

---

## 4 · Banner de estado del expediente

Primera cosa del cuerpo, **solo cuando hay algo que decir**.

| Situación | Banner |
|---|---|
| `ok` | **ninguno** — lo comunica el botón. Un banner verde en cada emisión es ruido ocho veces al día |
| `omitido` | **ninguno** — no ha fallado nada |
| `error` | `.sp-banner--warn` (fondo `--sp-warn-bg`, borde `--sp-warn-border`, texto `--sp-warn`, `--sp-fs-body-sm` 14 / `--sp-fw-semi`, radio `--sp-r-field` 10, `padding: 13px 18px`, `AlertTriangle` 18 px) |
| Sin paciente | `.sp-banner--info` (fondo `--sp-primary-bg-faint`, sin borde, `--sp-ink-500` 13 px) |
| Honorarios | **ninguno** — no aplica |

Literales:

- Error: `El documento está listo y puedes abrirlo e imprimirlo ahora, pero no se pudo guardar en el expediente: no va a aparecer en la lista de documentos del paciente. Puedes reintentarlo abajo.`
  *(Conserva el literal actual del componente y añade la referencia al reintento.)*
- Sin paciente: `Este documento no se guardó en ningún expediente porque no hay paciente seleccionado.`

**Semántica exacta de `error`:** o el insert lanzó, o `storagePath === null`. En el segundo
caso la fila **sí se insertó**, pero sin PDF en Storage: el documento no es recuperable
desde la lista. Por eso el texto habla de *no aparecer en la lista*, no de *no se guardó
nada*.

**Offline no aparece aquí a propósito:** el búnker entrega el PDF él mismo
(`entregar: !!offlineMode`) y este modal no se monta.

---

## 5 · Enviar por correo

Pulsar **Enviar por correo** **no abre otro modal**: sustituye el cuerpo y el pie del mismo
modal.

### 5.1 · Cabecera del sub-panel

`ModalShell` no tiene header aquí, así que el sub-panel aporta el suyo dentro del cuerpo:
fila de 44 px, `display:flex; align-items:center; gap: var(--sp-3)`,
`border-bottom: 1px solid var(--sp-line-divider)`,
`margin-bottom: var(--sp-gap-section)` 20. `ArrowLeft` 20 px `--sp-ink-500` con
`aria-label="Volver"` + `.sp-title-sec` `Enviar por correo`.

El contenido va `text-align:left`; el cuerpo del modal es `items-center text-center` y hay
que neutralizarlo con `style` inline.

### 5.2 · Con correo en el expediente

| Parte | Valor |
|---|---|
| Label | `.sp-label-field` — `SE ENVIARÁ A` |
| Correo | `.sp-card-inner` (fondo `--sp-surface-sunken`, borde `--sp-line-card`, radio `--sp-r-card-inner` 13, padding 18/20) con el correo en `.sp-body`. **No es un input**: no se edita por accidente |
| Alterna | `.sp-btn--ghost` `Usar otro correo` → conmuta a 5.3 con el campo vacío |
| Enviar | `.sp-btn--primary-block` |

### 5.3 · Sin correo

| Parte | Valor |
|---|---|
| Campo | `.sp-input` 44 px, `type="email"`, `inputmode="email"`, `autocomplete="email"`, `autocapitalize="off"`, `spellcheck="false"`, autofocus |
| Validación | Al perder foco y al pulsar Enviar. Inválido → borde `--sp-warn` + `.sp-hint` en `--sp-warn`: `Revisa el correo: falta la arroba o el dominio.` |
| Casilla | `.sp-check` — 22×22, radio `--sp-r-checkbox` 6, borde `--sp-bw-accent` 1.5 `--sp-line-strong`, marcada `--sp-primary`. **Desmarcada por defecto.** Contenedor `min-height: 44px` |
| Texto | `Guardar este correo en el expediente de {nombre}` · sin nombre: `Guardar este correo en el expediente` |
| Sin `pacienteId` | La casilla **no se renderiza** |
| Separación campo → casilla | `var(--sp-4)` 16 |
| Enviar | `.sp-btn--primary-block`, `margin-top: var(--sp-gap-section)` 20. Deshabilitado con el campo vacío |

### 5.4 · Estados de envío

| Estado | Qué se ve |
|---|---|
| Enviando | Botón con `.sp-spinner` 17 px + `Enviando…`; campo y casilla `disabled` |
| Enviado | Vuelve al cuerpo principal. El botón de la rejilla pasa a: `Check` 18 px `--sp-success`, texto `Enviado`, borde `--sp-success-border`, fondo `--sp-success-bg-alt`, **sigue pulsable** para reenviar (vuelve al sub-panel con el destinatario precargado). Toast `Documento enviado a {correo}` |
| Error | Se queda en el sub-panel. `.sp-banner--danger` sobre el botón: `No se pudo enviar el correo.` + motivo si el backend lo da. El correo tecleado se conserva |
| Envío ok + guardado en expediente falló | Vuelve al cuerpo; el toast añade segunda línea en `--sp-warn`: `El correo se envió, pero no se pudo guardar en el expediente.` No se reintenta solo |
| Sin conexión | El botón nace deshabilitado con `.sp-badge--deferred` `Sin conexión`, a opacidad plena |

### 5.5 · Qué viaja

**Decidido:** el correo lleva un **enlace al archivo almacenado**, nunca un PDF
regenerado ni adjunto.

---

## 6 · WhatsApp

Sigue deshabilitado con `.sp-badge--deferred` `Próximamente`, a opacidad plena. No se
esconde: su ausencia se pregunta más de lo que su estado inerte molesta.

---

## 7 · Decisiones, una línea cada una

- **Tres celdas y WhatsApp abajo a lo ancho** — agrupar arriba los dos vivos deja la fila de acción limpia.
- **Colapso por contenedor y no por viewport** — el modal tiene ancho propio de 600 px.
- **Anexar como acción y no casilla previa** — el opt-out es el caso normal en siete de ocho.
- **`omitido` no se pinta como fallo** — el médico decidió no anexarlo; no hay nada que reparar.
- **Consentimiento nace en `ok` sin acción** — se anexó solo al imprimir; ahí el botón es un recibo.
- **Sin banner en el caso normal** — el estado ya lo comunica el botón.
- **Correo en sub-panel y no en modal nuevo** — misma razón de capas que el panel de plantillas.
- **Enviado sigue pulsable** — un botón que se apaga obliga a cerrar y repetir todo para corregir un correo mal tecleado.

---

## 8 · NO DEFINIDO

| Ref | Qué falta |
|---|---|
| §2.3 | **Asunto y cuerpo del correo.** Copy clínico-legal, no se inventa. Y si el envío queda registrado como evento del expediente. |
| §2.3 | **Caducidad, revocación y segundo factor del enlace.** Se deciden con el token del QR, aparte. Consecuencia para esta pantalla: si el enlace caduca, el sub-panel necesitará una línea que lo diga antes de enviar. Hasta entonces no promete permanencia ni la niega. |


---

## Anexo · Radio de control (cambio de sistema, 2026-08-09)

Aplica a los nueve formularios y a toda la app. **Los contenedores no bajan.**

| Token | Antes | Ahora | Rol |
|---|---|---|---|
| `--sp-r-input` | 14 | **12** | textarea grande |
| `--sp-r-cta` | 14 | **12** | primario a ancho completo |
| `--sp-r-btn` | 12 | **10** | botón |
| `--sp-r-field` | 12 | **10** | input, select, textarea, banner |
| `--sp-r-field-sm` | 11 | **9** | fila e input compactos |
| `--sp-r-btn-sm` | 10 | **8** | botón compacto e icono-botón |
| `--sp-r-card` | 16 | 16 | sin cambio |
| `--sp-r-modal` | 20 | 20 | sin cambio |
| `--sp-r-pill` | 999 | 999 | es una forma, no un radio |

- Un escalón por token: la jerarquía de la escala no se altera.
- La diferencia entre la curva del contenedor y la del control pasa de 4 px a 6 px; es lo que se lee como más limpio.
- Por debajo de 10 px el control entra en el terreno de `--sp-r-note` (8 px), que es para texto embebido.
- **Revisar tras el cambio** los tres sitios donde el radio convive con un borde de 1,5 px: input en foco, tarjeta de tipo seleccionada y card protagonista.
