# BLUEPRINT — Funnel de Nueva Nota Médica (Fase A)

**Proyecto:** Reducción de fricción en el flujo de Nueva Nota Médica (Spinus)
**Branch:** `feature/rediseno-nota-expediente`
**Estado:** Documento de diseño teórico. Referencia de verdad del proyecto y brief para Claude Design. Sin código.
**Fecha:** 2026-07-23

---

## §0 — Principios rectores

1. **Una acción posible por momento.** El usuario nunca decide orden, nunca busca un botón, nunca scrollea para encontrar el siguiente paso. El sistema dicta la secuencia.
2. **Lo que se revisa es exactamente lo que se guarda.** El preview siempre muestra la nota final (narrativa + pronóstico integrado). Cero divergencia entre pantalla y documento sellado (NOM-004).
3. **Cerrar nunca destruye.** Ninguna acción de cierre pierde trabajo. Todo estado valioso sobrevive a un refresh.
4. **La recompensa es la receta.** El ciclo completo es: hablé/escribí 40 segundos → nota legal guardada → receta medio hecha. Ese es el momento que un médico le cuenta a otro.
5. **Métrica norte:** tiempo de puerta a nota guardada < 60 segundos.
6. **Fundamento en datos:** 100% de las notas reales de la mejor tester son IA (32/32); el modo manual tiene uso cero. IA es *el* flujo; manual es vía secundaria.

---

## §1 — Mapa del flujo

```
PÁGINA (Fase 1: Captura)
│  Vitales (opcional) + Dictado escrito [slot de voz: proyecto 2]
│
▼  clic "Generar nota" ──► validación previa EN PÁGINA (motivo + vitales duros)
│                          si falla: banner + tiles rojos, el modal NO abre
▼
MODAL ÚNICO (muta de estados, nunca dos modales, nunca handoff)
│
├─ Estado 0 · GENERANDO      abre al instante del clic, mensajes de progreso
├─ Estado 1 · ENTREVISTA     condicional (status 'faltan_datos') — se conserva tal cual
├─ Estado 2 · REVISIÓN       nota (preview real) + chips de medicamentos + diagnósticos
│                            + pronóstico + próxima cita
│                            (Regenerar → paso CONTEXTO: dictado editable → re-corre 0→[1]→2)
├─ Estado 3 · CONFIRMACIÓN   integrada y UNIVERSAL (sustituye al Portal crudo);
│                            se muestra SIEMPRE — el flag de skip se elimina
└─ Estado 4 · ÉXITO          "Nota guardada" → CTA primario "Generar receta"

Vía manual: link discreto en captura → SOAP 6 campos → "Previsualizar nota"
            → entra directo al Estado 2 del MISMO modal.

Cierre del modal en Estados 0–2 → la card de captura muta a ANCLA
("Nota lista — Revisar y guardar") que re-valida y reabre en Estado 2.
```

---

## §2 — Fase 1: Captura (página)

### 2.1 Anatomía

**Se conserva:** header (breadcrumbs + paciente + consultorio activo), columna derecha sticky (Contexto del paciente; Documentos en estado bloqueado con CTA), banner de borrador restaurado.

**Columna principal, de arriba a abajo:**

1. **Card Signos Vitales** — `SignosVitalesCard` intacta: mismos tiles, semáforo informativo, validación dura (FC condicional-obligatoria). Opcional capturarlos.
2. **Card Captura** — la protagonista:
   - Título: "Cuéntame la consulta".
   - Textarea grande (≈10 filas) con placeholder-ejemplo real que además enseña a dictar posología:
     > *"Ej.: Paciente con dolor lumbar de 2 semanas tras cargar peso, sin irradiación, Lasègue negativo, fuerza y reflejos normales. Indico naproxeno 500 mg cada 12 h por 7 días, ejercicios de McKenzie, cita en 2 semanas."*
   - **Slot de voz (proyecto 2):** botón de micrófono reservado en el layout, junto al textarea. En Fase A no se implementa; en el mockup se dibuja para validar composición. Marcado visualmente como parte del diseño futuro.
   - Chip "Borrador guardado" (autosave) vive en el header de esta card.
   - **Botón primario único de la página:** "Generar nota".
   - Debajo, discreto: link "Prefiero escribirla yo" (§6).

**Desaparecen de la página:** el selector de modo IA/manual como card, la card "Terapéutica empleada" (completa — ver §12/R1), y la card "Pronóstico y seguimiento" (sus dos campos migran al Estado 2 del modal).

### 2.2 Estados de la Card Captura

| Estado | Contenido |
|---|---|
| **Inicial** | Textarea vacío con placeholder + botón "Generar nota" |
| **Generando** | Textarea bloqueado, botón en loading (el modal ya está abierto encima) |
| **Ancla** (nota generada, modal cerrado) | Dictado colapsado (read-only, expandible) + ✓ "Nota lista" + botón primario "Revisar y guardar" + secundario "Empezar de nuevo" (con confirmación de descarte) |
| **Post-guardado** | "✓ Nota guardada" + acceso a expediente; columna derecha desbloqueada (documentos). Conserva el ancla de onboarding `ver-expediente` |

### 2.3 Validación previa (mata R2)

Al clic en "Generar nota" (y en cada reapertura desde el ancla):

- Motivo/dictado no vacío.
- Vitales duros: si hay algún vital capturado → FC obligatoria y todos dentro de límites fisiológicos.
- **Si falla:** banner de error en página + tiles rojos en `SignosVitalesCard`. El modal no abre. El usuario tiene el problema y la solución en la misma pantalla.
- **Si pasa:** el modal abre y, como los vitales no se editan dentro del modal, la validez al abrir garantiza la validez al guardar. Dentro del modal solo pueden ocurrir errores de servidor.

---

## §3 — Estados 0 y 1: Generando y Entrevista

### 3.1 Estado 0 · Generando

- El modal abre **en el instante del clic** — no tras la respuesta. Percepción de velocidad y cero "spinner sin contexto".
- Contenido: animación sobria + mensajes rotativos ("Leyendo tu dictado…", "Estructurando la nota…").
- Este estado es el **slot de streaming**: si en el futuro se aprueba streaming de la narrativa, aparece aquí palabra por palabra. El mockup no depende de esa decisión.
- Error de generación (red/servidor/timeout): se muestra dentro del modal con "Reintentar" y "Cerrar". El mapeo de errores pasa a leer `res.status` (R16).

### 3.2 Estado 1 · Entrevista (se conserva)

- Estructura actual intacta: título "Spinus necesita datos", progreso segmentado por bloques, preguntas con chips + texto libre, navegación Anterior/Siguiente/Enviar.
- **Cambio único:** al completar (respuesta 'completa'), el modal **no se cierra** — muta al Estado 2 con transición interna (§10). Muere el handoff modal→modal del diseño anterior (R6).
- Cancelar: conserva el comportamiento actual (cierra, preserva el dictado).
- Si la IA responde 'completa' sin necesitar entrevista, el Estado 1 simplemente no ocurre: 0 → 2.

---

## §4 — Estado 2: Revisión (el corazón)

### 4.1 Estructura

**Header:** ícono Spinus + "Tu nota está lista" + subtítulo "Revísala antes de guardar" + badge de origen (IA / Manual). Sin barra de progreso (la barra segmentada es identidad de la entrevista; aquí el footer guía).

**Cuerpo (scroll interno), en orden:**

1. **La nota** — preview real: narrativa **+ [PRONÓSTICO] integrado**, renderizada como documento (prose). Es exactamente la cadena que se guardará. Toggle "Editar":
   - Modo edición: textarea sobre la narrativa + campo separado de pronóstico visible debajo (el preview siempre re-integra ambos).
   - "Regenerar" (IA): NO relanza a ciegas. Tras la confirmación R12 si hay edición sucia, el modal muta al **paso Contexto**: el dictado (`form.motivo_consulta`) editable en el cuerpo + microcopy "Corrige o amplía el contexto; la nota se generará de nuevo" + "Cancelar" (vuelve a Revisión con la nota intacta) / "Regenerar nota" (→ Estado 0 con historial de entrevista limpio; puede derivar en entrevista nueva). El gasto de IA siempre es deliberado: el médico ve el contexto antes de relanzar. Toda regeneración vuelve a modo preview.
   - "Actualizar" (manual): semántica actual — reconstruye el preview localmente desde los campos SOAP, sin IA y sin costo.
2. **Medicamentos detectados** — solo si la extracción trajo alguno:
   - Etiqueta: "Detecté estos medicamentos (precargarán tu receta):"
   - Chips solo-nombre con ✕ para descartar falsos positivos. **Cero campos de captura.** Agregar medicamentos se hace en la receta (que es su destino y tiene el autocomplete completo). Esto elimina además el problema técnico del dropdown clipeado por el scroll del modal.
3. **Diagnósticos** — sección en LECTURA (formato "CÓDIGO — Descripción"; sin código → descripción sola), ambos modos. Primera vez que el modo IA los hace visibles (R7). Sin editor ni combobox: en IA vienen confirmados por el médico en el loop del prompt y la corrección es regenerar con mejor contexto (hint visible); en manual se corrigen en la card SOAP. Racional: el combobox CIE-10 depende de un catálogo local incompleto y su texto libre borra el código — meterlo aquí degradaría el dato que la IA trae de su conocimiento completo del catálogo.
4. **Seguimiento** — dos campos compactos: pronóstico (si no se editó arriba, mismo estado) y próxima cita (opcional).

**Footer (sticky dentro del modal):**
- Secundario: "Cerrar" (→ ancla, §7).
- Primario: "Guardar nota".

### 4.2 Qué ya NO existe aquí

- Botón "Imprimir" pre-guardado: se mueve al Estado 4 (§13, decisión D2).
- Tabla de posología: eliminada del flujo (§12/R1).

---

## §5 — Estados 3 y 4: Confirmación y Éxito

### 5.1 Estado 3 · Confirmación (integrada, universal)

- El contenido del modal muta (slide adelante; "Volver" = slide atrás). El Portal crudo actual (z-50) **se elimina**.
- **Universal: se muestra SIEMPRE, en cada guardado.** El checkbox "No mostrar de nuevo" y el flag `spinus_skip_confirm_nota` se eliminan del producto. Racional: en el funnel este paso cuesta un slide de ~300ms y un clic; el flag era por navegador (no por usuario), permitía sellar notas inmutables sin ver advertencia alguna — indefendible para un EHR que vende cumplimiento NOM-004 — y su eliminación linealiza la máquina de estados (Revisión → Confirmación → Éxito, sin ramas). El residuo del flag en localStorage de quienes lo activaron queda huérfano e inofensivo; no requiere migración.
- Contenido migrado del modal actual: título "¿Guardar esta nota?", texto NOM-004 completo (con "no podrá modificarse" en énfasis), advertencia condicional "⚠ No capturaste signos vitales en esta nota", botones "Volver a revisar" / "Guardar nota".
- Escape/atrás en este estado retrocede a Revisión, no cierra el modal.
- Nota de mockup: el checkbox dibujado en M6 se ignora en implementación.

### 5.2 Estado 4 · Éxito

- Check animado + "Nota guardada".
- **CTA primario: "Generar receta"** — con badge "N medicamentos precargados" cuando hay chips confirmados. Al pulsarlo: el modal cierra y se abre la receta por el mecanismo actual (`docInline` en la columna de documentos) con scroll/focus automático a ella (§13, decisión D3). La precarga usa los chips (solo `nombre_comercial`; muere el mapeo de la dosis fantasma y la concatenación con "·").
- Secundarios: **"Otros documentos"** (mismo mecanismo que la receta: cierra el modal y enfoca el panel de documentos desbloqueado — laboratorio, imagen, consentimientos, escrito, honorarios, etc.), "Imprimir nota" (ahora sí, sobre la nota sellada), "Ver expediente", "Cerrar".
- Al cerrar: la página entra en **estado de Cierre** (§2.3).

### 5.3 Estado de Cierre (página post-guardado)

Con la nota sellada, la página deja de ser un formulario: **la rejilla de dos columnas colapsa a una sola**. La Card Captura ya está oculta (§2.2) y la columna derecha deja de ser lateral — los documentos pasan a ser el protagonista a ancho completo, presentados como la rejilla de 8 formatos disponibles. Al pie, un botón primario **"Concluir consulta"** que cierra el ciclo y redirige al expediente del paciente.

Racional: el funnel arrancaba guiado y terminaba a la deriva — el médico cerraba el modal de éxito y aterrizaba en una pantalla que seguía pareciendo de captura, sin señal de finalización. El cierre explícito completa el arco: capturar → generar → revisar → guardar → documentar → concluir.

**Decisiones:** "Contexto del paciente" NO sobrevive en este estado (existe para informar mientras se redacta; los formularios de documentos ya se prellenan solos) · el banner verde se ABSORBE como encabezado del cierre, en vez de duplicar el mensaje · "Concluir consulta" NO advierte si no se generó receta: el médico sabe si la necesita y ahí el sistema debe quitarse de en medio.

---

## §6 — Vía manual (convergencia)

- Entrada: link "Prefiero escribirla yo" bajo el botón Generar. Despliega **en la misma superficie** (la Card Captura se expande, sin navegación): los 6 campos SOAP actuales + `DiagnosticosEditor` + botón "Previsualizar nota".
- Validación previa al abrir: los 4 obligatorios NOM-004 (motivo, exploración, ≥1 diagnóstico, plan) + vitales duros. Falla → error en página, el modal no abre.
- "Previsualizar nota" construye el preview local (instantáneo) y entra **directo al Estado 2** del mismo modal: badge "Manual", botón "Actualizar" en lugar de "Regenerar".
- Sin chips de medicamentos (no hay extracción): el tratamiento vive en el texto de [PLAN]; la receta se llena de cero (uso marginal confirmado por datos: 0/32).
- Los diagnósticos en el modal son el mismo estado que los de la página — nunca visibles a la vez (backdrop), sin duplicación real.
- Cambiar de vía con entrevista activa ejecuta la cancelación de entrevista (R9): cero estado huérfano.

---

## §7 — Cierre y ancla de reapertura

- Cerrar el modal (X, backdrop o Escape) en Estados 0–2: **nunca destruye.** `notaGenerada` persiste y la Card Captura muta al estado Ancla.
- El ancla re-valida (misma validación previa) y reabre en Estado 2. Cubre el flujo real: *"generé antes de que me pasaran los vitales → cierro, capturo, reabro, guardo".*
- **El draft amplía su payload con la nota generada** (mismo `secureStorage` cifrado que ya usa el borrador): un refresh accidental ya no pierde el turno de IA (R5). La entrevista no se persiste — es regenerable.
- El botón "Guardar nota" de la columna sticky deja de guardar directo: ejecuta la misma validación previa y abre el modal en Estado 2. **Una sola vía de guardado** (R8).

---

## §8 — Reglas transversales

- **Errores, dos territorios:** antes de abrir el modal → banner en página + tiles (como hoy). Dentro del modal → banner con el mismo diseño, dentro del modal (guardado de servidor, impresión, generación). Ningún error puede pintarse detrás de un backdrop.
- **Red de seguridad:** la validación completa se conserva en el momento de guardar aunque la previa ya haya pasado. Si algo imposible fallara, el modal lo muestra dentro con CTA "Ir a corregir" (cierra + scroll al campo).
- `erroresVitales` se limpia también cuando ya no hay vitales capturados (R14).
- **Autosave:** sin cambios de mecanismo; el payload suma la nota generada. El chip de confirmación sigue en la Card Captura.
- **Prompt de la IA (entra al scope):** instrucción de que la posología dictada se escriba en [PLAN] y nunca se invente si no fue dictada. La extracción de medicamentos sigue siendo solo-nombre.
- **Onboarding:** las anclas `data-onboard` se re-mapean al flujo nuevo (el paso "guarda tu nota" apunta al nuevo botón; `panel-documentos` y `ver-expediente` siguen existiendo en post-guardado). Verificación puntual de timing en implementación (R13).
- **Payload y API:** sin cambios. `medicamentos` sigue siendo solo-nombre (sidebar, precarga y export ARCO lo toleran, verificado).

---

## §9 — Móvil (mandato, no adaptación)

Los médicos usan Spinus desde el teléfono en el consultorio, y el flujo actual concentra ahí su fricción máxima: la nota aparece como un chorro de texto inline de varias pantallas, las acciones de guardar quedan enterradas a media página, y receta/documentos viven en el fondo absoluto del apilado. El funnel se diseña **mobile-first** (~390px) y se expande a desktop — nunca al revés.

Reglas:

- **La página de captura en móvil cabe prácticamente sin scroll**: vitales compactos (los tiles actuales en fila ya funcionan) + textarea + botón primario. Nada más compite por la pantalla.
- **El modal es una pantalla nativa en móvil**: fullscreen (variante de ModalShell), header fijo con título y cierre, cuerpo scrolleable, **footer de acciones siempre fijo y visible** — ningún botón primario enterrado en el scroll, en ningún estado. El modal de receta actual ya sigue este patrón (fullscreen + CTA fijo): es el precedente interno a replicar.
- **Cero viajes al fondo del scroll**: receta y demás documentos se alcanzan desde el Estado 4 (Éxito), nunca scrolleando la página hasta la columna apilada.
- **Teclado**: al editar la nota, el footer permanece accesible y el layout no brinca; el textarea de edición scrollea dentro del cuerpo del modal.
- **Tap targets ≥ 44px**: chips de entrevista y de medicamentos, toggles, botones.
- **Transiciones entre estados con slide horizontal tipo navegación nativa**: la sensación es avanzar por pasos de una app, no ver aparecer contenido.

---

## §10 — Transiciones y motion (guía para Claude Design)

- **Continuidad física, nunca cortes secos.** El backdrop es uno solo durante todo el ciclo del modal; solo el contenido interior transiciona.
- Estado 0 → 1 o 0 → 2: cross-fade + leve slide vertical del contenido; el header muta su texto.
- Estado 2 → 3: slide horizontal adelante; "Volver" = slide atrás.
- Estado 3 → 4: check animado (celebración sobria, sin confeti).
- Página: la Card Captura muta entre estados con transición suave de altura/contenido.
- Tono: médico, sobrio, confiable. Identidad Spinus (azul `#1e5fa8`). La celebración vive en la velocidad y la fluidez, no en la ornamentación.

---

## §11 — Inventario de conservación (qué NO cambia)

- `SignosVitalesCard` completa (tiles, semáforo, validación dura).
- La entrevista IA: bloques, chips, progreso segmentado, textos.
- Contexto del paciente (sticky) y panel de Documentos post-guardado.
- `ModalShell` como base (+ variante fullscreen móvil como única extensión).
- Pipeline de impresión react-pdf (parser, adaptador, plantilla, tematización).
- `DiagnosticosEditor` y `CIE10Combobox` (siguen en la vía manual, intactos; no entran al modal).
- API `/api/consultas` y estructura del payload.
- Cero contacto con offline-mode.

---

## §12 — Trazabilidad: riesgos del informe → resolución de diseño

| Riesgo | Resolución |
|---|---|
| R1 medicamentos tapados | La tabla se elimina; chips solo-quitar en revisión; posología en la receta (su lugar real). La tabla nunca se imprimió en la nota — era teatro |
| R2 errores inalcanzables | Validación previa en página antes de abrir; errores de servidor dentro del modal |
| R3 colisión z-index confirm | El Portal crudo muere; confirmación integrada como estado del modal |
| R4 dos puntos de montaje | Un solo modal para ambas vías; el ancla unifica la posición en página |
| R5 nota no persistida | Draft amplía payload con la nota generada (secureStorage cifrado) |
| R6 handoff modal→modal | No existe: un solo modal que muta de estados |
| R7 diagnósticos invisibles en IA | Sección de diagnósticos en lectura en Estado 2; corrección vía regeneración (el editor con catálogo local queda solo en la vía manual) |
| R8 doble botón de guardado | El botón sticky abre el modal; una sola vía |
| R9 entrevista huérfana | Cambio de vía ejecuta cancelación de entrevista |
| R10 sin focus trap | Deuda preexistente de ModalShell; más visible ahora — candidata a Fase B |
| R11 imprimir lee 8 fuentes | Imprimir se mueve a post-guardado (Estado 4); el handler permanece en el padre |
| R12 edición pisada al regenerar | Confirmación inline si hay cambios; regenerar resetea a preview |
| R13 onboarding acoplado | Re-mapeo de anclas + verificación de timing en implementación |
| R14 erroresVitales obsoleto | Se limpia también sin vitales |
| R15 doble POST post-guardado | El Estado 4 sustituye al panel vivo; la página pasa a Post-guardado sin botón de guardar |
| R16 errores IA sin status | El mapeo lee `res.status` |

---

## §13 — Decisiones nuevas de este blueprint (sujetas a veto)

- **D1 · El modal abre al instante del clic** (Estado 0 Generando), no tras la respuesta. Feedback inmediato; slot natural para streaming futuro.
- **D2 · Imprimir solo post-guardado.** Hoy se puede imprimir sin guardar; eso permite circular papel de notas no selladas — antipatrón de expediente. Con el preview fiel en pantalla, el caso "ver cómo queda antes" pierde sentido. Cambio de comportamiento real: requiere tu visto bueno.
- **D3 · "Generar receta" cierra el modal y abre la receta por el mecanismo actual** (`docInline` + scroll automático). Cero refactor de RecetaForm en Fase A, respetando su fragilidad conocida (precarga no reactiva → Fase B).
- **D4 · Chips solo-quitar, sin "agregar".** Agregar medicamentos se hace en la receta (destino real, autocomplete completo). Evita reintroducir inputs y el clipping del dropdown en el modal.
- **D5 · [SUSTITUIDA] Confirmación universal**: el Estado 3 se muestra siempre; checkbox y flag `spinus_skip_confirm_nota` se eliminan del producto (§5.1). La regla original ("el skip no salta la advertencia de vitales") queda sin objeto al no existir skip; la advertencia de vitales vive como contenido condicional del estado universal.

---

## §14 — Fuera de alcance de Fase A

- Voz (proyecto 2; el slot queda dibujado).
- Streaming de la narrativa (evaluar en implementación; el Estado 0 lo absorbe sin rediseño).
- Precarga de receta desde `consultas.medicamentos` (DB) y botón de receta en la vista de consulta guardada → DEUDA_TECNICA.
- Normalización null/`[]` del campo, precarga no reactiva de RecetaForm, focus trap de ModalShell, verificación types/index.ts:84 → **Fase B** (mini-proyecto de cierre, comprometido al final de este proyecto).

---

## §15 — Brief para Claude Design

**Instrucción crítica:** las capturas de pantalla adjuntas son **referencia de identidad visual y componentes existentes** (colores, cards, chips de la entrevista, tipografía, densidad). **La estructura y el flujo los define este documento — no reproduzcas el layout actual.** La página actual es exactamente lo que se está reemplazando.

**Identidad:** azul primario `#1e5fa8`, tono médico sobrio, familia visual del modal de entrevista (progreso segmentado, chips, header con ícono).

**Mockups a producir:**

| # | Pantalla | Estados |
|---|---|---|
| M1 | Página de captura (desktop) | Inicial |
| M2 | Página de captura (desktop) | Ancla "Nota lista" |
| M3 | Modal · Estado 0 | Generando |
| M4 | Modal · Estado 2 | Revisión en preview (nota + chips + diagnósticos + seguimiento) |
| M5 | Modal · Estado 2 | Revisión en edición |
| M6 | Modal · Estado 3 | Confirmación |
| M7 | Modal · Estado 4 | Éxito (CTA receta con badge) |
| M8 | Vía manual desplegada | SOAP expandido en la Card Captura |
| M10 | Modal · Estado 1 | Entrevista dentro del nuevo contenedor (desktop) — SIN rediseñar: bloques, chips, progreso segmentado, textos y navegación EXACTOS a los actuales; anotar transiciones 0→1 y 1→2 (header muta, mismo backdrop) |
| M9a | Móvil (~390px) — PRIORIDAD | Página de captura, estado inicial |
| M9b | Móvil (~390px) — PRIORIDAD | Modal fullscreen · Estado 2 (revisión, footer fijo) |
| M9c | Móvil (~390px) — PRIORIDAD | Modal fullscreen · Estado 4 (éxito, CTA receta fijo) |
| M9d | Móvil (~390px) | Modal fullscreen · Estado 1 (entrevista, footer fijo con Cancelar/Anterior/Siguiente) — contenido exacto al actual, solo cambia el contenedor |

Anotar en cada mockup las transiciones de §10. El slot de voz se dibuja en M1 marcado como "proyecto 2".

**Nota de divergencia aceptada (M10/M9d):** los mockups entregados aplican ~15% de licencia estética al interior de la entrevista. NO es requisito de implementación: la Fase A conserva el JSX actual del Estado 1 (chips, progreso segmentado, bullets, textos y navegación) dentro del contenedor nuevo; solo lo derivado del contenedor (header del modal de estados, fullscreen móvil, footer fijo) cambia de verdad. Si algún elemento del delta estético se desea, se registra como mejora cosmética separada post-Fase A — nunca colado en este proyecto.
