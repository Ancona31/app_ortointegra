# PLAN DE IMPLEMENTACIÓN — Funnel de Nueva Nota Médica (Fase A)

**Branch:** `feature/rediseno-nota-expediente` — verificación obligatoria al inicio de cada prompt.
**Fuentes:** BLUEPRINT_FUNNEL_NOTA.md (sellado, incluye confirmación universal) + Informes 1–3 + mockups aprobados M1–M10/M9a–d.
**Fecha:** 2026-07-23

---

## §A — Reglas operativas (aplican a TODOS los pasos)

1. **Protocolo por paso:** (1) prompt de auditoría del paso → (2) reporte del auditor → (3) correcciones → (4) re-auditoría si hubo cambios → (5) "listo sin bloqueantes" → (6) prompt de aplicación → (7) Claude Code aplica + `npx tsc --noEmit` + `npm test` → (8) Angel: smoke en dev server (checklist del paso) → (9) commit checkpoint → siguiente paso. Nunca dos pasos en un mismo commit.
2. **Prohibido en prompts:** `npm run build`, `lint` (WSL UNC — Angel los corre en consola cuando aplique). Prohibido tocar `src/app/(offline)/` y `src/lib/offline/`.
3. **Referencias de línea:** los informes citan líneas del estado pre-proyecto. Cada paso las desplaza. Los prompts referencian **símbolos/funciones** con línea orientativa ("según informe, puede haberse movido").
4. **Colores:** cada pieza del modal hereda la fuente de color de su equivalente actual (hardcode donde hoy hay hardcode, perfil donde hoy hay perfil). Cero sistemas nuevos de tematización.
5. **Arquitectura fijada:** el modal de estados vive **inline en page.tsx dentro de ModalShell** (como la entrevista hoy) — evita prop-drilling de las 8 fuentes de estado que lee `imprimir()` (R11) y el riesgo de extracción. Siempre portalado, **nunca** renderizado inline en el árbol de la página (transform persistente de `animate-page-enter` mataría `position:fixed`).
6. **Cada smoke de Fases 1–2 incluye una pasada móvil** (390px, `fullscreenMobile` activo desde 1.1).
7. **Máquina de estados:** `estadoModal: 'generando' | 'entrevista' | 'revision' | 'contexto' | 'confirmacion' | 'exito' | null`. `useState` simple (patrón del repo), transiciones solo vía handlers nombrados.

---

## §B — Mapa de fases y dependencias

```
FASE 0 · CIMIENTOS (sin cambio visible)
  0.1 ModalShell: prop fullscreenMobile + overscroll-contain
  0.2 Draft v2: notaGenerada en el payload
       ↓
FASE 1 · LA MÁQUINA DEL MODAL
  1.1 Máquina de estados + Estado 0 + validación previa + entrevista absorbida
  1.2 Estado 2 · Revisión + Ancla + una sola vía de guardado (R8)   [paso mayor]
  1.3 Estado 2 completo: chips de medicamentos + diagnósticos en modal
  1.4 Estado 3 · Confirmación universal (muere Portal crudo + flag)
  1.5 Estado 4 · Éxito → receta precargada + imprimir post-guardado
       ↓
FASE 2 · LA PÁGINA
  2.1 Captura funnel: mueren selector/Terapéutica/Pronóstico; criterio M9a
  2.2 Vía manual reubicada (link + SOAP en la misma card + R9)
       ↓
FASE 3 · PULIDO Y CIERRE
  3.1 Transiciones + mensajes rotativos del Estado 0
  3.2 Onboarding (texto tip nota-ia, id intacto)
  3.3 Limpieza, DEUDA_TECNICA.md y regresión integral
```

Dependencias duras: 0.1 antes de 1.1 (fullscreen). 0.2 antes de 1.2 (el ancla depende de que la nota persista). 1.2 antes de 2.1 (las cards no mueren hasta que sus campos vivan en el modal).

---

## §C — Transitorios conocidos (estados intermedios aceptados)

| ID | Ventana | Comportamiento transitorio |
|---|---|---|
| T1 | 1.1 → 1.2 | Respuesta 'completa' cierra el modal y pinta el panel inline viejo (flujo actual) |
| T2 | 1.2 → 1.4 | "Guardar" cierra el modal de estados y abre el confirm clásico secuencialmente (nunca apilado — evita el z-index indefinido de R3) |
| T3 | 1.2 → 1.5 | Sin botón Imprimir en el flujo (el pre-guardado muere en 1.2, el post-guardado nace en 1.5). Aceptado en dev |
| T4 | 1.2/1.3 → 2.1 | Cards Pronóstico y Terapéutica siguen en la página mientras sus campos ya viven en el modal (mismo estado, nunca visibles a la vez con el modal abierto) |

---

## §D — Pasos

### FASE 0 — CIMIENTOS

#### 0.1 · ModalShell: variante fullscreen móvil + overscroll
**Archivos:** `src/components/ui/ModalShell.tsx`.
**Cambios:** (a) prop `fullscreenMobile?: boolean` (default `false`); con `true`, en `max-md:`: caja `h-dvh max-h-dvh w-full max-w-full rounded-none`, wrapper `p-0`; desktop intacto. (b) `overscroll-contain` en el cuerpo (`flex-1 overflow-y-auto`) para todos los consumidores (mata scroll-chaining a `<main>`).
**Puntos de auditoría:** la cadena de clases de la caja (informe 3 §1, :86) es única y compartida por 16 consumidores — la división condicional NO debe alterar el resultado con la prop en default. Scroll-lock y stack de Escape intactos.
**Smoke:** 4 modales existentes idénticos a antes en desktop y móvil (documentos, consultorios, labs, entrevista); scroll al fondo del cuerpo de un modal ya no arrastra el fondo.
**Commit:** `feat(modal): variante fullscreen movil opt-in y overscroll contain`

#### 0.2 · Draft v2: notaGenerada persiste
**Archivos:** `src/app/(app)/expediente/[id]/nueva-nota/page.tsx`.
**Cambios (tabla del informe 3 §6):** escritura (payload + `notaGenerada`), gate de escritura (`|| notaGenerada`), deps del autosave (+`notaGenerada`), tipo `DraftPayload`, restauración (`typeof parsed.notaGenerada === 'string'` → `setNotaGenerada`), guard anti-race (vacío incluye `!notaGenerada` vía ref fresco), descarte del banner (resetea también `notaGenerada`). `remove` al guardar ya existe.
**Smoke:** dictar + generar (flujo actual) → refresh → banner de borrador + panel con la nota restaurada; "Descartar" limpia todo incluida la nota; guardar limpia el draft.
**Commit:** `feat(nota): draft v2 persiste notaGenerada con migracion duck-typing`

---

### FASE 1 — LA MÁQUINA DEL MODAL

#### 1.1 · Máquina de estados + Estado 0 + validación previa + entrevista absorbida
**Archivos:** `page.tsx`.
**Cambios:**
- `estadoModal` (§A.7). El ModalShell de la entrevista actual se convierte en **el** ModalShell del modal de estados: `open={estadoModal !== null}`, `fullscreenMobile`, contenido condicional por estado. `bloquesEntrevista.length` deja de controlar la apertura.
- `validarParaAbrir()` extraída de `intentarGuardar`: motivo no vacío (IA) + vitales duros (FC condicional + límites). Incluye **R14**: `setErroresVitales(new Set())` también cuando no hay vitales capturados. Falla → banner + tiles en página, el modal NO abre.
- "Generar con Spinus": `validarParaAbrir()` → `setEstadoModal('generando')` → request. `faltan_datos` → `'entrevista'`; `completa` → **T1** (cierra modal, `aplicarNotaCompleta` pinta panel inline como hoy); error → el Estado 0 muestra el error con Reintentar/Cerrar. **R16**: `mapearErrorIA` recibe también `res.status` (401/400/502/500 con mensajes diferenciados).
- Estado 0: icono + "Estructurando tu nota…" (label estático; rotación en 3.1).
- Entrevista: JSX intacto (blueprint: conservada). `cancelarEntrevista` → además `setEstadoModal(null)`. `responderEntrevista` con `completa` → T1.
**Smoke:** IA rica → generando → cierra → panel inline (como siempre). IA pobre → generando → entrevista idéntica → responder → panel. Vitales fuera de rango → no abre + tiles rojos; corregir → abre. Error de red → error en modal + Reintentar funciona. Móvil: fullscreen.
**Commit:** `feat(nota): maquina de estados del modal con estado generando y validacion previa`

#### 1.2 · Estado 2 — Revisión + Ancla + una sola vía de guardado  ⚠ paso mayor: auditoría doble
**Archivos:** `page.tsx`.
**Cambios:**
- Estado `'revision'`: header "Tu nota está lista" / "Revísala antes de guardar" + badge origen (IA/Manual). Cuerpo: **preview real** = `notaGenerada` + `[PRONÓSTICO]` (si `form.pronostico`) renderizado con ReactMarkdown — exactamente la cadena que `guardar()` arma. Toggle Editar: textarea sobre `notaGenerada` + campos Pronóstico y Próxima cita debajo (sección "Seguimiento"). **R12**: flag `notaEditada` (onChange del textarea); Regenerar/Actualizar con `notaEditada` → confirmación inline "Perderás tus cambios"; toda regeneración resetea `modoEdicion=false` y `notaEditada=false`.
- **Paso Contexto (solo IA)**: "Regenerar" no relanza a ciegas — muta a `estadoModal='contexto'`: textarea bindeado a `form.motivo_consulta` + microcopy "Corrige o amplía el contexto; la nota se generará de nuevo" + "Cancelar" (→ `'revision'`, nota intacta) / "Regenerar nota" (motivo no vacío → `'generando'`, `historial: []` como hoy; puede derivar en entrevista nueva). "Actualizar" (manual) conserva su semántica local: re-render del preview sin IA, sin paso Contexto.
- `aplicarNotaCompleta` → `setEstadoModal('revision')` (**muere T1**). El panel inline (`panelResultado` :674-735 y montajes :1106/:1214) **se elimina**.
- `previewNotaManual`: valida 4 obligatorios NOM + vitales duros ANTES; éxito → `'revision'` con badge Manual y botón "Actualizar". (La vía manual sigue viviendo donde hoy; se reubica en 2.2.)
- Footer sticky del modal: "Cerrar" / "Guardar nota". **T2**: Guardar → `setEstadoModal(null)` + `setMostrarConfirmacion(true)` (confirm clásico secuencial, nunca apilado).
- **Ancla** (Card Captura, condición `notaGenerada && !estadoModal && !notaSaved`): "✓ Nota lista" + dictado colapsado read-only (line-clamp + expandir) + primario "Revisar y guardar" (→ `validarParaAbrir()` → `'revision'`) + secundario "Empezar de nuevo" con confirmación inline de descarte (limpia `notaGenerada`, `notaEditada`, draft conserva form).
- **R8**: el botón "Guardar nota" de la columna sticky (:1307) pasa a `validarParaAbrir()` → `'revision'`.
- Cierre del modal (X/backdrop/Escape) en revisión → `setEstadoModal(null)` → ancla. Nada se destruye (draft v2 respalda).
**Smoke:** IA → revisión → preview incluye pronóstico al editarlo → guardar → confirm clásico → guardado íntegro (payload idéntico, verificar consulta guardada); manual → previsualizar → revisión Manual → Actualizar regenera preview local; Regenerar (IA) → paso Contexto muestra el dictado → ampliarlo → regenera con el dictado nuevo (entrevista nueva si aplica) → revisión con nota nueva; Cancelar desde Contexto conserva la nota; regenerar con edición sucia → confirmación inline antes del paso Contexto; cerrar → ancla → reabrir; refresh → ancla directa; sticky abre revisión; móvil: footer fijo, teclado no tapa acciones.
**Commit:** `feat(nota): estado revision en modal con preview real, ancla y via unica de guardado`

#### 1.3 · Estado 2 completo: chips + diagnósticos en lectura
**Archivos:** `page.tsx`.
**Cambios:**
- Chips de medicamentos (solo modo IA, solo si `medicamentos.filter(m=>m.nombre.trim()).length>0`): "Detecté estos medicamentos (precargarán tu receta):" + chip por nombre con ✕ (`removeMed`, conserva invariante ≥1 fila; sin nombres visibles → la sección se oculta). Cero inputs (D4). El shape del estado `medicamentos` NO cambia (dosis/frecuencia/duración quedan `''`) → payload y `saveMedCache` intactos.
- Sección Diagnósticos en LECTURA (ambos modos — primera vez visible en IA, R7): render de `form.diagnosticos` en formato "CÓDIGO — Descripción" (sin código → descripción sola), entre chips y Seguimiento. Sin editor, sin combobox, sin ✕: en IA vienen confirmados por el médico en el loop del prompt y la corrección es regenerar; en manual se corrigen en la card SOAP. Hint bajo la sección (solo IA): "¿Algo incorrecto? Regenera la nota con más contexto."
**Puntos de auditoría:** la regeneración IA sobrescribe `form.diagnosticos` y `medicamentos` — chips y lectura deben reflejar el reemplazo; diagnóstico sin `codigo_cie10` renderiza limpio.
**Smoke:** dictado con fármacos → chips pueblan; ✕ descarta; dictado sin fármacos → sin sección de chips; diagnósticos visibles y correctos en IA y manual; regenerar refresca ambos; guardar → payload con solo-nombre.
**Commit:** `feat(nota): chips de medicamentos y diagnosticos visibles en revision`

#### 1.4 · Estado 3 — Confirmación universal
**Archivos:** `page.tsx`, `src/app/globals.css`.
**Cambios:**
- Estado `'confirmacion'`: textos LITERALES del confirm actual (título "¿Guardar esta nota?" con animación `alertGlow`; cuerpo con "no podrá modificarse" en énfasis rojo; advertencia condicional de vitales `sinVitalesCapturados`; botones "Volver a revisar" / "Guardar nota" → `guardar()`).
- **Universal**: Guardar en revisión → `'confirmacion'` siempre (muere T2). Sin checkbox. Eliminar flag `spinus_skip_confirm_nota` (lectura, escritura, checkbox) y `mostrarConfirmacion`; el Portal crudo (:744-802) se elimina completo.
- `alertGlow` migra del `<style>` inline a `globals.css`.
- Red de seguridad (§8 blueprint): `guardar()` conserva la re-validación antes del POST; fallo (borde) → error DENTRO del modal + "Ir a corregir" (cierra a ancla + scroll a vitales).
- **onClose despachador por estado**: en `'confirmacion'`, X/backdrop/Escape → `setEstadoModal('revision')` (retrocede, no cierra); en los demás estados, cierre normal a ancla.
**Puntos de auditoría:** grep global de residuos del flag; `intentarGuardar` queda absorbida entre `validarParaAbrir` y el flujo del modal — verificar que no quedan llamadores huérfanos.
**Smoke:** guardar SIEMPRE muestra confirmación (con y sin vitales; advertencia solo sin vitales); "Volver a revisar" regresa con la nota intacta; Escape/backdrop retroceden; guardar → guardado íntegro; título con glow.
**Commit:** `feat(nota): confirmacion universal integrada al modal, muere flag skip y portal crudo`

#### 1.5 · Estado 4 — Éxito
**Archivos:** `page.tsx`.
**Cambios:**
- `guardar()` éxito → `setEstadoModal('exito')` (además de `notaSaved`, limpieza de draft, `saveMedCache` — todo lo actual se conserva).
- Estado `'exito'`: check + "Nota guardada". **Primario único**: "Generar receta" (badge "N medicamentos" si `medicamentosParaReceta.length>0`) → `setEstadoModal(null)` + `setDocInline('receta')` (el overlay de documentos hace el resto). Secundarios: "Otros documentos" (→ cierra + `scrollIntoView` del panel `data-onboard="panel-documentos"`), "Imprimir nota" (→ `imprimir()`, handler queda en el padre — muere T3), "Ver expediente" (link actual), "Cerrar" (→ página post-guardado actual: banner verde + docs desbloqueados).
- `medicamentosParaReceta` se simplifica: `{ nombre_comercial: m.nombre, via_administracion: 'Oral', presentacion: '', principio_activo: '', indicacion: '', dosis: '' }` — muere el mapeo de dosis fantasma y la concatenación "·".
- **R15**: tras éxito no existe superficie con "Guardar" activo (ancla condicionada a `!notaSaved`); doble POST imposible.
**Smoke:** ciclo completo → éxito → receta abre con nombres precargados y campos de posología limpios; sin fármacos → CTA sin badge → receta vacía funcional; "Otros documentos" enfoca el grid; "Imprimir" genera el PDF correcto (idéntico a la consulta guardada); "Cerrar" → banner verde + panel activo; no hay vía de doble guardado; móvil: CTA fijo (M9c).
**Commit:** `feat(nota): estado exito con puente a receta precargada e impresion post-guardado`

---

### FASE 2 — LA PÁGINA

#### 2.1 · Captura funnel  → criterio M9a
**Archivos:** `page.tsx`.
**Cambios:** muere la card selector de modo (`modoNota` persiste como estado, default `'ia'`); mueren las cards "Terapéutica empleada" y "Pronóstico y seguimiento" (campos ya en el modal — muere T4); card Captura: título "Cuéntame la consulta", placeholder-ejemplo del blueprint §2.1, botón de micrófono presente y deshabilitado (title "Dictado por voz — próximamente"), chip de autosave conservado; estados formales de la card (inicial / generando: textarea+botón bloqueados / ancla de 1.2 refinada al diseño M2 / **post-guardado: la card se oculta** — el banner verde existente cumple §2.2 y conserva `data-onboard="ver-expediente"`).
**Smoke:** página = M1 (desktop); **criterio M9a formal en teléfono real**: 390px, todo visible sin scroll, vitales legibles, textarea ≥5 líneas útiles; flujo IA completo intacto; post-guardado sin card de captura.
**Commit:** `feat(nota): pagina funnel de captura, mueren selector y cards migradas`

#### 2.2 · Vía manual reubicada
**Archivos:** `page.tsx`.
**Cambios:** link discreto "Prefiero escribirla yo" bajo el botón Generar → expande EN LA MISMA card los 6 campos SOAP actuales + `DiagnosticosEditor` + "Previsualizar nota" (ya cableado a revisión desde 1.2); link inverso "Usar IA" → conserva semántica del toggle actual (`setNotaGenerada('')`, `setError('')`) + **R9**: ejecuta `cancelarEntrevista()` si hay entrevista poblada.
**Smoke:** manual completo hasta guardar (validación de 4 obligatorios antes de abrir); alternar IA↔manual repetidamente sin estado huérfano (entrevista cancelada, modal cerrado); badge Manual y botón Actualizar correctos.
**Commit:** `feat(nota): via manual como expansion de la card de captura con cancelacion de entrevista`

---

### FASE 3 — PULIDO Y CIERRE

#### 3.1 · Transiciones + mensajes rotativos
**Archivos:** `page.tsx`, `globals.css`.
**Cambios:** contenido interno del modal con remount por `key={estadoModal}` + `animate-fade-in` (0↔1↔2); 2↔3 con `slideFromRight`/`slideFromLeft` (patrón slideDir existente, adaptado); 3→4 keyframe nuevo `checkPop` (scale+fade, sobrio) en globals; Estado 0: rotación de 3–4 mensajes ("Leyendo tu dictado…", "Estructurando la nota…", …) con interval ~2s; transiciones suaves de la Card Captura (fade en cambios de estado).
**Puntos de auditoría:** el remount por key aplica SOLO al contenido interno — el ModalShell (backdrop) nunca se desmonta entre estados (backdrop único, cero parpadeo, scroll-lock intacto).
**Smoke:** ciclo completo con transiciones fluidas en desktop y móvil; sin parpadeo de backdrop en 0→1→2→3→4; reduced-motion no rompe nada (animaciones CSS degradan solas).
**Commit:** `feat(nota): transiciones entre estados del modal y mensajes rotativos`

#### 3.2 · Onboarding
**Archivos:** `src/components/ui/OnboardingGuide.tsx`.
**Cambios:** reescribir SOLO el texto del tip `nota-ia` (id INTACTO — cambiarlo resetea "visto" y rompe `/audio/nota-ia.mp3`) describiendo el funnel nuevo; verificar en dev los tips 2–4 (anclas `panel-documentos`, `modal-doc-iconos`, `consulta-completa`, `ver-expediente` — todas sobreviven por diseño).
**Tarea de Angel (assets):** regrabar `/audio/nota-ia.mp3` con el texto nuevo.
**Smoke:** con `spinus_onboarding` limpio en localStorage, recorrido completo de los 4 tips sobre el flujo nuevo; highlights apuntan bien.
**Commit:** `fix(onboarding): tip nota-ia actualizado al funnel`

#### 3.3 · Limpieza y regresión integral
**Archivos:** `page.tsx`, `DEUDA_TECNICA.md`.
**Cambios:** grep y purga de código muerto (`panelResultado`, `mostrarConfirmacion`, residuos del flag, estados/handlers huérfanos); registrar en DEUDA_TECNICA.md la lista Fase B: normalización `null`/`[]` de `consultas.medicamentos` (migración + API), precarga no reactiva de RecetaForm, verificación `types/index.ts:84`, safe-areas móviles (`viewport-fit=cover` + `env(safe-area-inset-*)`), cuota silenciosa de secureStorage, focus trap de ModalShell, catálogo `cat_cie10` incompleto (enriquecer la fuente del autocomplete de la vía manual), divergencia narrativa↔estructurado al editar la nota a mano (limitación preexistente — documentar); y como mejora futura: precarga de receta desde DB + botón de receta en vista de consulta.
**Regresión integral (checklist final, Angel en dev):** IA sin entrevista / IA con entrevista / manual / error de red con reintento / vitales inválidos bloquean / ancla + refresh + reabrir / empezar de nuevo / confirmación siempre (con y sin vitales) / éxito→receta precargada / éxito→otros documentos / imprimir = PDF fiel / expediente y export intactos / borrador clásico (solo form) restaura / onboarding / móvil M9a-b-c-d / `npm test` verde / `tsc` limpio / build+lint en consola de Angel.
**Commit:** `chore(nota): limpieza post-funnel y registro de deuda fase B`

---

## §E — Qué NO entra (recordatorio duro)

Voz (proyecto 2 — solo el botón deshabilitado). Streaming (el Estado 0 es su slot futuro). Safe-areas, cuota secureStorage, focus trap, null/`[]`, RecetaForm reactivo, types:84 → Fase B. Prompt de IA: **no se toca** (ya cumple posología en [PLAN]). Entrevista: **JSX intacto**. Estética del 15% de M10/M9d: licencia de mockup, no requisito.

---

## §F — Presupuesto

9 pasos de código + 3 de fase 3 = **12 checkpoints/commits**. ~24–28 prompts (auditoría + aplicación por paso, más correcciones). Ritmo sugerido: 1–2 pasos por sesión; Fase 0 completa puede salir en una.
