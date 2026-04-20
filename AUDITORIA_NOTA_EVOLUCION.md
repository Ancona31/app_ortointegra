# Auditoría Interna — nueva-nota/page.tsx

**Fecha:** 2026-04-18
**Generado para:** planeación del refactor de nota de evolución (Fase 1 = mapa, Fase 2 = refactor)
**Modo:** sólo lectura. No se modificó ningún archivo del repo.
**Archivos consultados:**
- `src/app/(app)/expediente/[id]/nueva-nota/page.tsx` (1266 líneas) — objetivo
- `src/hooks/useAudit.ts` — sólo firma
- `src/lib/secureStorage.ts` — sólo firma de la API pública
- `src/lib/mobileShare.ts` — sólo firma de `imprimirOCompartir`

---

## 1. Mapa estructural

Total de líneas: **1266**.

| Categoría | Líneas aprox. | % aprox. | Notas |
|---|---|---|---|
| Imports | 1–24 | ~1.9% | 24 imports, varios casi sin uso (ver §5) |
| Helpers fuera del default export (`FormCargando`, `FormErrorFallback`, `safeDynamic` + 8 `dynamic()`) | 26–60 | ~2.8% | factory de carga lazy + 8 wrappers |
| Tipos locales y constantes (`MedicoInfo`, `MedRow`, `MedicamentoConVia`, `DOCS`, `MED_VACIA`) | 62–86 | ~2.0% | tipos no exportados; `DOCS` es metadata UI |
| Declaración de estado (23 `useState` + 3 `useRef`) y wrappers `setDocInline`/`toggleCampo` | 89–138 | ~4.0% | concentrado en bloque inicial |
| Efectos (`useEffect`) | 144–204 | ~4.8% | 3 efectos: bootstrap, autosave, click-outside |
| Handlers / funciones internas (helpers de meds, `update*`, `generarNota`, `previewNotaManual`, `intentarGuardar`, `guardar`, `imprimir`) y derivados | 207–547 | ~26.9% | dominado por `imprimir()` (155 líneas, casi todo HTML inline) |
| JSX de render | 550–1264 | ~56.4% | dos columnas + modal portal + modal de confirmación |
| Cierre / blank | 1265–1266 | <0.5% | |

> **Observación:** ~56% del archivo es JSX y ~27% son handlers; menos del 5% es estado puro. La mole real está en `imprimir()` (HTML del PDF como template literal) y en el render de los dos modos del formulario (IA / manual) que duplican estructura.

---

## 2. Responsabilidades (core vs accesorio)

### 2.1 Core de la nota (inseparable de capturar/guardar una nota de evolución)

| Responsabilidad | Líneas aprox. | Detalle |
|---|---|---|
| Captura de campos SOAP | 95–98 (state) + 727–856 (UI dual IA/manual) | `motivo_consulta`, `exploracion_fisica`, `gabinete_laboratorios`, `diagnosticos` (CIE-10), `analisis`, `pronostico`, `plan_tratamiento`, `proxima_cita` |
| Captura terapéutica (medicamentos) | 99 (state) + 207–239 (helpers) + 870–924 (UI) | `MedRow[]` con autocomplete propio |
| Generación con IA (Gemini) | 246–282 | POST `/api/nota-medica` |
| Previsualización manual (sin IA) | 285–302 | concatena bloques SOAP en markdown |
| Validación NOM-004 + modal inmutabilidad | 305–323 + 553–606 | obligatorios: motivo, exploración, dx, plan |
| Guardado vía API | 326–376 | POST `/api/consultas` |
| Edición del texto generado | 105 (state) + 992–1011 (UI) | toggle vista/edición |
| Audit log al abrir | 91 | `useAuditAccess('consultas', id)` (NOM-024) |

### 2.2 Accesorios (podrían vivir fuera del componente "nota")

| Responsabilidad | Líneas aprox. | Por qué es accesorio |
|---|---|---|
| Carga de `medicoInfo` para PDF | 145 + state 92 | sólo se usa para imprimir; podría venir del padre o de un context |
| Carga de `paciente` y panel de contexto | 147–153 + 1037–1098 | el expediente padre ya tiene `paciente`; aquí se vuelve a pedir |
| Carga de `ultimaConsulta` (último dx + meds) | 164–178 + 1071–1091 | feature de contexto, no de captura |
| Cache de medicamentos frecuentes (`med-frecuentes`) | 155–157, 212–226, 207–210 | autocomplete; no es propio de la nota |
| Autosave cifrado en `secureStorage` | 158–162 + 182–193 + cleanup en 368, 687 | UX de borrador; concierne a infraestructura |
| Banner "borrador restaurado" + descartar | 129 + 679–695 | depende del autosave |
| Generación de PDF inline (`imprimir`) | 379–533 | 155 líneas de HTML+CSS embebido para `imprimirOCompartir` |
| Modal de confirmación inmutabilidad + flag `spinus_skip_confirm_nota` en `localStorage` directo | 110, 305–322, 553–606 | UX de seguridad, separable |
| Panel derecho de documentos (8 atajos a otros formularios) | 75–84 (DOCS) + 1100–1163 + modal 1168–1263 | shortcuts a Receta/Lab/Imagen/Suplementación/Internamiento/Escrito/Consentimiento/Honorarios; no son la nota |
| Animación slide entre documentos del modal (`slideDir`, `slideKey`, `prevDocRef`, wrapper `setDocInline`) | 113–127 + estilos en JSX | feature puramente visual del modal |
| Marcadores `data-onboard` (4 puntos) | 627, 634, 1127, 1206 | hooks para el sistema de onboarding |
| Indicador "Borrador guardado" con timestamp | 128 + 715–720 | feedback UI del autosave |
| Acordeón de campos en modo IA (`camposExpandidos`, `toggleCampo`) | 131–134 + 734–791 | sólo aplica a modo IA |
| Toggle modo IA / manual + render dual | 103, 651–676 + 723–858 | duplica estructura del formulario |
| Breadcrumbs + link "atrás" + header con nombre/edad del paciente | 608–639 | layout de página, no parte de la nota en sí |

> **Conclusión §2:** el "core de la nota" cabe holgado en ~250–300 líneas. El resto (~950 líneas) son accesorios atornillados al mismo archivo: PDF, panel de documentos, contexto del paciente, autosave, animaciones de modal, dos modos de captura.

---

## 3. Estado y flujo de datos

### 3.1 `useState` (23 totales)

| # | Variable | Tipo | Categoría | Para qué |
|---|---|---|---|---|
| 1 | `medicoInfo` | `MedicoInfo \| null` | Datos externos | Header del PDF al imprimir |
| 2 | `paciente` | `Paciente \| null` | Datos externos | Header, contexto, validaciones de edad/sexo |
| 3 | `form` | objeto con 8 strings | **Datos de la nota (CORE)** | Todos los campos SOAP + próxima cita |
| 4 | `medicamentos` | `MedRow[]` | **Datos de la nota (CORE)** | Terapéutica empleada |
| 5 | `medCache` | `string[]` | UI/cache | Sugerencias autocomplete |
| 6 | `showSuggest` | `number \| null` | UI | Índice de fila con dropdown abierto |
| 7 | `modoNota` | `'ia' \| 'manual'` | UI / control | Cambia render del formulario y botón principal |
| 8 | `notaGenerada` | `string` | **Datos de la nota (CORE)** | Texto final que se guardará |
| 9 | `modoEdicion` | `boolean` | UI | Toggle vista/edición de la nota generada |
| 10 | `generando` | `boolean` | UI | Spinner mientras llama `/api/nota-medica` |
| 11 | `guardando` | `boolean` | UI | Spinner mientras llama `/api/consultas` |
| 12 | `imprimiendo` | `boolean` | UI | Spinner mientras `imprimirOCompartir` |
| 13 | `error` | `string` | UI | Banner de error |
| 14 | `mostrarConfirmacion` | `boolean` | UI | Modal de inmutabilidad |
| 15 | `notaSaved` | `boolean` | UI / control mixto | Habilita panel de documentos, oculta botones, **detiene autosave** |
| 16 | `docInline` | `string \| null` | UI | Documento abierto en modal |
| 17 | `slideDir` | `'left' \| 'right'` | UI | Dirección de animación entre docs |
| 18 | `slideKey` | `number` | UI | Re-mount key para reiniciar animación |
| 19 | `ultimoGuardado` | `Date \| null` | UI | Timestamp para mostrar "Borrador guardado" |
| 20 | `borradorRestaurado` | `boolean` | UI | Banner amarillo |
| 21 | `ultimaConsulta` | `{diagnosticos, medicamentos} \| null` | Datos externos | Panel derecho de contexto |
| 22 | `camposExpandidos` | `Record<string,boolean>` | UI | Acordeón en modo IA |
| 23 | `complementoDx` | `string` | **Datos de la nota (CORE)** | Texto que se concatena al CIE-10 |

### 3.2 `useRef` (3)

- `prevDocRef: HTMLDivElement | null` → en realidad almacena `string | null` (el `key` previo de `docInline`); el tipo declarado como `HTMLDivElement` es **inconsistente con el uso** (línea 115 vs 118–125). Posible bug latente o tipo cosmético.
- `suggestRef: HTMLDivElement | null` → contenedor de medicamentos para detectar click-outside.
- `autosaveRef: ReturnType<typeof setTimeout> | null` → handle del debounce del autosave.

### 3.3 Estado derivado / duplicado / sincronizado

- **Derivado correcto:** `medicamentosParaReceta` (536), `nombrePaciente` (547), `mostrarSuggest` dentro del map (880), `dxCompleto` dentro de `previewNotaManual` y `guardar`.
- **Estado redundante (animación del modal):** `slideDir` + `slideKey` + `prevDocRef` son tres piezas para una sola feature visual; viven solo para animar el cambio de documento.
- **Estado con doble responsabilidad:** `notaSaved` decide simultáneamente (a) visibilidad del panel de documentos, (b) banner de éxito, (c) ocultamiento de botones de acción y (d) **detención del autosave**. Mezcla "estado de la captura" con "estado de UI".
- **Sincronización implícita (no useEffect):** el setter wrapper `setDocInline` (117–127) sincroniza `prevDocRef`, `slideDir`, `slideKey` y `docInline` en un mismo flujo. Funciona, pero acopla 4 variables a un set.
- **Posible duplicación de fuente:** `paciente` se carga aquí aunque la página padre `expediente/[id]` casi seguro ya lo tenga; misma query se ejecuta dos veces (a confirmar fuera de scope).
- **`useRouter` declarado y nunca usado** (línea 90) — código muerto.

---

## 4. Llamadas a Supabase / API

> **Confirmación clave:** la nota **NO** se inserta directo a la tabla `consultas` desde el cliente. Se hace **`POST /api/consultas`** (línea 353). La validación NOM/RLS y el `audit_log` ocurren server-side.

| # | Método | Recurso | Línea | Contexto | Datos |
|---|---|---|---|---|---|
| 1 | `fetch GET` | `/api/me/perfil-medico` | 145 | `useEffect` inicial | Recibe `MedicoInfo` para PDF |
| 2 | Supabase `select` | `pacientes` (single) | 147–149 | `useEffect` inicial | Trae el paciente por `id` (URL) |
| 3 | Supabase `select` | `consultas` (maybeSingle, last 1) | 165–178 | `useEffect` inicial | Última `diagnosticos` + `medicamentos` para panel de contexto |
| 4 | `fetch POST` | `/api/audit` | vía `useAuditAccess` (91 + hook) | render | `{ tabla:'consultas', registroId: id }` — fire-and-forget |
| 5 | `fetch POST` | `/api/nota-medica` | 252 | handler `generarNota` | Datos del paciente + form → texto IA |
| 6 | `fetch POST` | `/api/consultas` | 353 | handler `guardar` | Payload completo de la nota (ver abajo) |

**Payload del POST a `/api/consultas` (líneas 334–350):**
```
{ paciente_id, motivo_consulta, exploracion_fisica,
  diagnosticos: [{descripcion}] | [],
  plan_tratamiento, notas_evolucion (texto final con pronóstico anexado),
  proxima_cita, medicamentos | null, nota_origen: 'ia' | 'manual' }
```

**Otros side effects de I/O (no DB):**
- `secureStorage.get('med-frecuentes')` (155) y `set` (223) — autocomplete persistente.
- `secureStorage.get('nota-draft-{id}')` (158), `set` (188), `remove` (368, 687) — borrador cifrado.
- `localStorage.getItem('spinus_skip_confirm_nota')` (317), `setItem`/`removeItem` (575–576) — preferencia "no mostrar de nuevo".

---

## 5. Dependencias importadas

| Import | Origen | Tipo | Usos en el archivo |
|---|---|---|---|
| `useState`, `useEffect`, `useRef` | `react` | Hook | muchos |
| `createPortal` | `react-dom` | API | 1 (modal de docs al body) |
| `flushSync` | `react-dom` | API | 1 (en `imprimir`) |
| `Portal` | `@/components/ui/Portal` | Componente | 1 (modal de confirmación) |
| `useParams` | `next/navigation` | Hook | 1 |
| `useRouter` | `next/navigation` | Hook | **0 — declarado pero NO usado** |
| `createClient` | `@/lib/supabase/client` | Util | 2 (dos clientes en mismo `useEffect`) |
| `Paciente` | `@/types` | Tipo | varios |
| `calcularEdad` | `@/lib/patientUtils` | Util | 3 (header, generarNota, imprimir) |
| `imprimirOCompartir(html, filename)` | `@/lib/mobileShare` | Util | 1 (en `imprimir`) — recibe HTML completo |
| `secureStorage` | `@/lib/secureStorage` | Util | 5+ (get/set/remove × medCache + draft) |
| `useAuditAccess(tabla, id)` | `@/hooks/useAudit` | Hook | 1 (registro NOM-024 al montar) |
| `CIE10Combobox` | `@/components/ui/CIE10Combobox` | Componente | 2 (modo IA + modo manual) |
| `Breadcrumbs` | `@/components/layout/Breadcrumbs` | Componente | 1 |
| `Link` | `next/link` | Componente | 3 (atrás, ver expediente, banner) |
| `ReactMarkdown` | `react-markdown` | Componente | 1 (preview de la nota) |
| `dynamic` | `next/dynamic` | API | 8 (todos los formularios accesorios) |
| 19 iconos `lucide-react` | `lucide-react` | Iconos | varios |
| 8 forms dinámicos (`RecetaForm`, `SolicitudLabForm`, `SolicitudImagenForm`, `PlanSuplementacionForm`, `SolicitudInternamientoForm`, `EscritoMedicoForm`, `ConsentimientoInformadoForm`, `NotaHonorariosForm`) | `@/components/documentos/*` | Componentes lazy | 1 cada uno (en el modal) |

> **Limpieza fácil:** quitar `useRouter` (no usado).
> **Acoplamiento alto:** `secureStorage` (5 puntos), `createClient` (2 instancias en el mismo efecto), 8 formularios accesorios.

---

## 6. Puntos de acoplamiento

### 6.1 Estado global / persistencia compartida

- **`secureStorage` (cifrado AES, key derivada de cookie de sesión Supabase):**
  - `med-frecuentes` → cache de autocompletes; **se comparte con cualquier otro lugar que use la misma key** (a confirmar; no parece haber otro consumidor en el monolito).
  - `nota-draft-{id}` → borrador por paciente. TTL 24 h por diseño de `secureStorage`.
- **`localStorage` directo (sin cifrar):** `spinus_skip_confirm_nota` para suprimir el modal de confirmación. **Se lee y escribe sin pasar por `secureStorage`**: inconsistencia con el resto de persistencia clínica.
- **No hay context, no hay zustand/redux, no hay event bus.** Toda la comunicación con el resto de la app es por URL (`useParams`) y por persistencia local.

### 6.2 Marcadores `data-onboard` para sistema externo

Cuatro hooks DOM consumidos por el onboarding:
- `data-onboard="consulta-completa"` (627) — div oculto que aparece cuando la nota está guardada y no hay modal abierto.
- `data-onboard="ver-expediente"` (634) — link de retorno tras guardar.
- `data-onboard="panel-documentos"` (1127) — wrapper del panel derecho activo.
- `data-onboard="modal-doc-iconos"` (1206) — barra de iconos dentro del modal de docs.

> Cualquier refactor que cambie el árbol DOM debe preservar estos `data-onboard` o coordinarse con la state machine de onboarding.

### 6.3 Navegación

- `Link` a `/expediente/{id}` (3 lugares: ArrowLeft del header, banner de éxito, link "Ver expediente").
- **No hay redirect programático** tras guardar — el usuario se queda en la misma página y el botón principal cambia de "Guardar" a panel de documentos. (`useRouter` está importado pero no se usa para esto.)

### 6.4 Side effects al montar

En el primer `useEffect` (144–179) se disparan, en paralelo y sin coordinación:
1. POST `/api/audit` (vía hook).
2. GET `/api/me/perfil-medico`.
3. SELECT `pacientes`.
4. `secureStorage.get('med-frecuentes')`.
5. `secureStorage.get('nota-draft-{id}')` → si existe, sobreescribe `form` y `medicamentos`.
6. SELECT `consultas` (última).

> **Race condition latente:** el usuario puede empezar a teclear en el motivo antes de que `secureStorage.get` resuelva, y entonces el setter del borrador **sobreescribirá** lo que ya escribió. No hay guard.

### 6.5 Side effects al desmontar

- `useEffect` de autosave: `clearTimeout(autosaveRef.current)` (192).
- `useEffect` de click-outside: `removeEventListener('mousedown', handler)` (203).
- **No hay handler `beforeunload` ni `visibilitychange`.** Si el usuario cierra la pestaña entre el último cambio y los 1500 ms del debounce → ese tramo se pierde.

### 6.6 Comportamiento frente a "cerrar pestaña a media captura"

- El autosave es **debounced 1.5 s** y se desactiva una vez `notaSaved === true` (183).
- La condición de guardar borrador es `motivo_consulta || diagnosticos || exploracion_fisica` (186) — si solo se llenó otro campo (p. ej. `plan_tratamiento`), **no se guarda nada**.
- Sin `beforeunload`, no hay aviso al usuario ni flush sincrónico.
- Tras guardar, el borrador se elimina (368). Si la red falla justo después de un POST 200 (caso raro), todo bien — el server ya lo aceptó.

---

## 7. Complejidad estimada del refactor

### 7.1 Partes simples de extraer (riesgo bajo)

- **`FormCargando`, `FormErrorFallback`, `safeDynamic` y los 8 `dynamic()`** (26–60): aislables a un módulo `nueva-nota/dynamic-forms.ts` sin tocar comportamiento.
- **Tipos `MedRow`, `MedicamentoConVia`, `MedicoInfo` y la constante `DOCS`** (62–86): a `types.ts` y `constants.ts` locales.
- **Helpers de medicamentos** (`getSuggestions`, `saveMedCache`, `updateMed`, `addMed`, `removeMed`) (207–239): a un hook propio `useMedicamentosTerapeutica` o módulo puro; sólo dependen de `medicamentos` y `medCache`.
- **`previewNotaManual`** (285–302): función pura, depende de `form` y `complementoDx`.
- **`useAuditAccess`** (91): ya está aislado, no requiere cambios.
- **Limpieza inmediata:** borrar `useRouter` y corregir el tipo de `prevDocRef` (debería ser `string | null`, no `HTMLDivElement`).

### 7.2 Partes medianamente complejas (riesgo medio)

- **Bloque del formulario dual IA/manual** (723–858): hay duplicación significativa entre los dos modos (mismos campos con UI distinta). Se puede extraer un `<CamposNota modo="ia"|"manual" />` pero hay que preservar el comportamiento del acordeón sólo en modo IA.
- **Panel derecho de documentos** (1100–1163) **+ modal portal de documentos** (1168–1263): extraerlo a `<PanelDocumentosNota />` es viable; pasa props ya conocidas (`pacienteId`, `nombrePaciente`, `diagnosticoInicial`, `medicamentosParaReceta`). Lo tricky es la animación `slideDir`/`slideKey`/`prevDocRef`: hay que decidir si se preserva o se simplifica.
- **`generarNota`** (246–282): el bloque de mapeo de errores por substring (`timeout`, `rate`, `network`) se puede extraer pero requiere acordar un tipo de error compartido con `/api/nota-medica`.
- **Autosave con `secureStorage`** (155–193): aislable a `useBorradorNota(id)` que devuelva `{borradorRestaurado, ultimoGuardado, descartar}`. Cuidado con `notaSaved` (que detiene el autosave) — su responsabilidad mixta hay que dividirla.
- **Panel "Contexto del paciente"** (1037–1098) con `ultimaConsulta`: extraer a `<ContextoPacienteSidebar pacienteId={id} />` que internamente haga su query.

### 7.3 Partes complejas / arriesgadas (riesgo alto)

- **`imprimir()` con su HTML inline de 155 líneas** (379–533): es el "Frankenstein" más grande del archivo. El HTML usa colores de marca del médico (`cp`/`cs`), logo, watermark, datos del paciente, tabla de medicamentos y firma. Hay un mini-parser markdown propio (`notaToHtml`) que duplica funcionalidad de `react-markdown`. Migrar a `@react-pdf/renderer` (que el proyecto ya usa para los demás documentos vía `mobileShare.generarPdf`) implica reescribir el template — no es un mover-y-pegar.
- **Modal de confirmación + flag `spinus_skip_confirm_nota`** (553–606): UX no trivial (modal con animación CSS inline, checkbox que escribe a `localStorage` plano). Extraer es fácil; la decisión de fondo es si esa preferencia debería vivir en `secureStorage` / preferencias de usuario en DB en vez de `localStorage` plano.
- **Estado mezclado (`notaSaved`, `docInline`, `slideKey`):** hay que separar "estado de la captura" ("estoy aún capturando" / "ya se guardó") del "estado de UI del panel de documentos". Si no se separa, el componente extraído seguirá teniendo el mismo enredo.
- **Marcadores `data-onboard`:** cualquier reescritura del DOM del header, banner o panel de documentos puede romper el onboarding silenciosamente. Necesita verificación en runtime.
- **Doble llamada a `createClient`** dentro del mismo `useEffect` (146 y 164): no es problema funcional, pero un refactor debería decidir si las dos queries se hacen en serie/paralelo y con un solo cliente.

### 7.4 Estimación cualitativa de fases (sin compromiso de tiempo)

- **Fase A — limpieza barata:** quitar `useRouter`, corregir tipo de `prevDocRef`, extraer `safeDynamic`/`DOCS`/tipos. Bajo riesgo, alto valor de "limpieza de mesa".
- **Fase B — extraer accesorios:** `<PanelDocumentosNota />`, `<ContextoPacienteSidebar />`, `<ModalConfirmacionGuardado />`, `useBorradorNota`. Quita ~400 líneas del monolito sin tocar el core.
- **Fase C — colapsar el formulario dual:** `<CamposNota modo />` con manejo unificado del acordeón y CIE10. Quita ~150 líneas y elimina divergencia entre modos.
- **Fase D — reemplazar `imprimir()`:** migrar a `react-pdf` consistente con el resto del proyecto. Es la fase con más superficie de regresión visual; necesita capturas comparativas antes/después.
- **Fase E — separar responsabilidades de `notaSaved`:** dividir en `notaPersistida` (control de flujo) y `panelDocumentosActivo` (UI). Pequeña pero arriesgada porque es transversal.

---

## 8. Incógnitas / riesgos detectados (brutalmente honesto)

1. **`useRouter` está importado y nunca usado** (línea 90). Es código muerto desde hace tiempo o quedó tras un refactor previo. Sin impacto, pero síntoma de que el archivo no ha sido podado.

2. **`prevDocRef` está tipado como `HTMLDivElement | null` pero almacena strings** (115 vs 118–125). TypeScript no se queja porque se asigna `prevDocRef.current = key` donde `key: string | null`. Es un tipo cosmético equivocado — cualquier persona que lea ese ref va a confundirse.

3. **`paciente` se vuelve a cargar aquí** aunque la página padre `expediente/[id]` muy probablemente ya tenga el paciente en su árbol. **No verifiqué fuera de scope** — pero si es cierto, hay una query duplicada en cada apertura de "Nueva Nota". Vale la pena confirmarlo antes de la Fase B.

4. **`/api/me/perfil-medico` se pide en cada apertura** sin caché. Si el médico abre 10 notas en una sesión, son 10 fetches del mismo perfil. ¿Existe caché en el servidor? No verificado.

5. **Race condition del borrador restaurado:** si el usuario empieza a teclear antes de que `secureStorage.get('nota-draft-{id}')` resuelva, su input es **sobrescrito** por el borrador. No hay guard de "¿el form ya tiene contenido?". Bug latente, sutil, difícil de reproducir.

6. **Pérdida de hasta 1.5 s del último input** al cerrar pestaña: el autosave es debounced y no hay flush en `beforeunload`. Para una nota clínica, perder los últimos 1.5 segundos puede ser perder una frase clave.

7. **Autosave no se dispara si el usuario llenó solo `plan_tratamiento`** (la condición exige motivo, exploración o diagnóstico). Si alguien comienza por el plan, su trabajo no se guarda.

8. **`spinus_skip_confirm_nota` vive en `localStorage` sin cifrar**, mientras que los borradores van en `secureStorage`. Es solo una preferencia, pero la inconsistencia llama la atención. ¿Debería migrar a preferencias del usuario en DB para sincronizarse entre dispositivos?

9. **El payload a `/api/consultas` no envía `analisis`, `pronostico` separados ni `gabinete_laboratorios`** como campos propios — se concatenan dentro de `notaFinal` (campo `notas_evolucion`). Una vez guardados, esos campos **no son consultables individualmente** en la DB. Intencional o accidental — necesita confirmación humana.

10. **El `pronostico` se anexa al texto final pero NO se valida como obligatorio** (NOM-004 no lo exige). Sin embargo, en el modal de confirmación no se le menciona. OK por ahora, pero un editor futuro podría confundirse.

11. **`imprimir()` construye un HTML con un mini-parser markdown propio** (`notaToHtml`) que **duplica funcionalidad** de `react-markdown` ya usado en la vista previa. Dos motores de render markdown en el mismo componente — riesgo de divergencia visual entre lo que el médico ve y lo que se imprime.

12. **El modal de documentos abre formularios accesorios (Receta, Lab, etc.) que probablemente tienen su propio estado, su propia persistencia y sus propios PDFs.** El monolito no sabe nada de su ciclo de vida — solo los renderiza dentro del modal. Si uno de esos forms guarda en DB pero el usuario cierra el modal antes de tiempo, ¿qué pasa? **No verificado** (los forms están fuera de scope de esta auditoría).

13. **Sistema de animación slide del modal** depende de tres piezas (`slideDir`, `slideKey`, `prevDocRef`) coordinadas en un wrapper. Si un refactor pasa `setDocInline` directo en lugar del wrapper, **se pierde la animación silenciosamente**. Debería estar encapsulado.

14. **No hay test alguno mencionado** en el archivo, ni un comentario que diga "no toques esto sin probar X". Para un componente de 1266 líneas que guarda datos clínicos inmutables, el riesgo de regresión es alto. Antes de Fase D (PDF) en particular, conviene tener al menos un snapshot del HTML generado.

15. **Decisión humana pendiente — alcance del refactor:** ¿el objetivo final es solo "extraer el componente nota" preservando las 1266 líneas, o también modernizar la generación de PDF y consolidar la persistencia? La diferencia de esfuerzo es 5×–10×.
