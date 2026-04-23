@AGENTS.md

# Reglas del proyecto Spinus®

> **Lee este documento COMPLETO antes de proponer cualquier cambio. Confirma que lo leíste resumiendo en 3 líneas qué entendiste sobre el estado actual del módulo offline antes de tocar código.**

---

## 🔴 PROTOCOLOS DE INTERACCIÓN — LEER PRIMERO, NO NEGOCIABLES

Estos protocolos existen porque el proyecto ha sufrido regresiones severas por código inyectado fuera de scope, eliminaciones sin verificar dependencias, y "soluciones mágicas" complejas que aumentaron la fragilidad. Su violación causa retrabajo de días.

### Protocolo 1 — SCOPE EXPLÍCITO

* SOLO modifica los archivos que el usuario te indicó explícitamente en su mensaje
* Si crees que necesitas tocar otro archivo, **DETENTE** y pregunta antes de hacerlo
* Antes de empezar a editar, lista los archivos que vas a tocar y espera confirmación si son más de 2
* NUNCA "aprovecha" para arreglar otra cosa que viste de paso

### Protocolo 2 — PROTOCOLO DE ELIMINACIÓN

* Antes de eliminar cualquier archivo, ejecuta `grep -rn "nombre-del-archivo" src` y reporta los resultados
* Si encuentras imports activos, **NO ELIMINES**. Reporta el bloqueo
* Antes de eliminar bloques grandes de código (>50 líneas), pregunta si es seguro
* Si el usuario dice "elimina X", **verifica primero qué está vivo y reporta antes de borrar**

### Protocolo 3 — TAMAÑO DE CAMBIOS

* Ninguna función nueva debe exceder 50 líneas. Si necesitas más, divide
* Si tu solución requiere más de 200 líneas nuevas, **primero propón una alternativa de menos de 50 líneas**, aunque sea más limitada
* Si un cambio toca más de 3 archivos, **DETENTE** y muestra el plan antes de ejecutar
* Prefiere ediciones quirúrgicas sobre reescrituras

### Protocolo 4 — ANTI-ABSTRACCIÓN PREMATURA

* NUNCA crees factories, providers, contextos genéricos, custom hooks reutilizables, o capas de abstracción nuevas sin OK explícito del usuario
* La duplicación de código es preferible a una abstracción especulativa
* Si propones una abstracción, justifica con al menos 3 casos de uso reales en el proyecto actual
* Las abstracciones se introducen cuando el dolor de duplicar supera el costo de abstraer, no antes

### Protocolo 5 — HONESTIDAD SOBRE INCERTIDUMBRE

* Si no sabes por qué algo falla, **dilo**. No inventes diagnósticos
* Si no estás seguro de cómo funciona una API o librería, **verifica en la documentación oficial** antes de proponer
* Si propones algo basado en suposiciones, márcalo explícitamente: "ASUMIENDO QUE..."
* Antes de aplicar un workaround "creativo", explica primero la causa raíz del problema. Si no puedes explicar la causa raíz, **el workaround está prohibido**
* Es mejor decir "necesito investigar más" que entregar código que no entiendes

### Protocolo 6 — SERVICE WORKERS Y MÓDULO OFFLINE

* NUNCA crees un Service Worker nuevo si ya existe uno. Reporta el conflicto
* NUNCA registres un Service Worker desde código que se ejecuta en todas las páginas (ej. `layout.tsx` raíz)
* El Service Worker del búnker offline DEBE tener `scope: '/bunker/'` o equivalente, NUNCA el scope raíz `/`
* NUNCA agregues código que desregistre Service Workers indiscriminadamente (ej. `getRegistrations().forEach(unregister)`). Si necesitas desregistrar uno específico, hazlo por nombre/scope
* La página `/offline-mode` o cualquier ruta del búnker NO debe ser una ruta de Next.js, debe ser HTML estático servido desde `/public/bunker/`
* Cualquier propuesta de pre-cachear chunks de Next.js con hashes hardcodeados está PROHIBIDA — los hashes cambian en cada deploy

### Protocolo 7 — VERIFICACIÓN POST-CAMBIO

* Después de CUALQUIER cambio, corre `npm run build` y reporta el resultado
* Si el build falla, **NO continúes con más cambios**. Repórtalo y espera instrucciones
* Si el cambio toca tipos, corre `npm run lint` también
* Sugiere un `git commit` con mensaje descriptivo cuando algo funciona

### Protocolo 8 — REPORTE DE FIN DE TAREA

Al terminar cualquier cambio, escribe en máximo 5 líneas:
1. Qué hiciste
2. Qué archivos tocaste (lista exacta)
3. Qué NO funcionó si algo no funcionó
4. Qué decisiones tomaste sin pedir permiso (si las hubo)
5. Qué seguiría lógicamente (sin ejecutarlo)

---

## 📦 ESTADO ACTUAL DEL MÓDULO OFFLINE — CRÍTICO

> Esta sección debe leerse antes de proponer cualquier cosa relacionada con offline, Service Workers, IndexedDB, o sincronización.

### Lo que ESTÁ MUERTO y NO debe revivirse sin discusión explícita

Los siguientes archivos fueron eliminados intencionalmente en abril 2026 tras una regresión severa. **El documento `RESUMEN_ARQUITECTURA.md` describe este sistema viejo y ya no aplica**:

* `src/lib/read-mirror.ts` — sistema de espejo de lectura en IndexedDB
* `src/lib/outbox-engine.ts` — cola de escrituras offline
* `src/lib/connectionMonitor.ts` — monitor de red
* `src/hooks/useHybridQuery.ts` — hook híbrido online/offline
* `src/components/MirrorInitializer.tsx`
* `src/components/OfflineSync.tsx`
* `src/components/ChunkMissingListener.tsx`
* `src/app/sw.js/route.ts` — Service Worker custom de la app online

**No los recrees. No propongas reactivarlos. Si encuentras referencias en documentación vieja, ignóralas.**

### Lo que ESTÁ VIVO actualmente

* `src/components/SessionGuard.tsx` (34 líneas, simplificado)
* `src/lib/supabase/client.ts` (67 líneas, sin lógica offline)
* `public/spinus-bunker-sw.js` — Service Worker del búnker (en desarrollo)
* `src/app/(offline)/offline-setup/page.tsx` — página de setup
* `src/app/(offline)/offline-mode/page.tsx` — página del búnker (a migrar a HTML estático)

### Estrategia offline actual (Sidecar Bunker)

* La app online **NO** debe tener capacidades offline
* Existe un módulo offline **aislado** llamado "Búnker" que vive en `/public/bunker/` (en construcción)
* El Búnker es una mini-app independiente, NO comparte código con la app online
* El Búnker se usa para emergencias: ver paciente, escribir nota, generar PDF, sincronizar al volver online
* El Service Worker del Búnker tiene scope restringido a `/bunker/`

---

## 🛡️ Reglas de seguridad — NO NEGOCIABLES

* NUNCA modifiques `src/lib/anonimizar.ts` ni quites las llamadas de anonimización en las rutas de IA
* NUNCA cambies `ON DELETE RESTRICT` a `CASCADE` en ninguna foreign key
* NUNCA quites las validaciones de roles o autenticación en endpoints de API
* NUNCA guardes datos de pacientes en localStorage sin usar `secureStorage`
* NUNCA envíes datos identificables de pacientes a APIs externas (Gemini, Anthropic, Google Calendar, Sentry)
* NUNCA permitas editar o eliminar notas clínicas ya guardadas — son inmutables
* NUNCA quites los filtros PII de Sentry
* NUNCA quites el audit log de ninguna acción
* NUNCA pases HTML sin sanitizar a Puppeteer
* Si necesitas modificar alguno de estos archivos, explícame qué vas a cambiar y por qué ANTES de hacerlo

---

## 🧬 Stack y versiones (bleeding edge — verifica antes de proponer)

* **Next.js 16.2.1** (App Router, Webpack explícito, no Turbopack)
* **React 19.2.4**
* **Tailwind 4** (con `@tailwindcss/postcss`)
* **TypeScript 5**
* **Supabase** (`@supabase/ssr` 0.9, `@supabase/supabase-js` 2.100)
* **Sentry** (`@sentry/nextjs` 10.47)
* **Cornerstone.js 4.20** (DICOM viewer)
* **@react-pdf/renderer 4.4** (generación de PDFs)
* **Vitest 4** (testing)

**Importante:** Estas son versiones recientes. Si tu propuesta usa APIs deprecadas de Next.js 13/14, React 18, o Tailwind 3, **márcalo explícitamente y verifica en la documentación oficial actual**.

---

## ✏️ Buenas prácticas de TypeScript

* NUNCA uses `any`. Usa tipos explícitos, generics, `unknown` o `Record<string, unknown>` según corresponda
* Siempre define interfaces o types para props de componentes, respuestas de API y datos de la DB
* Usa tipos estrictos de Supabase generados con `supabase gen types` para las queries
* Prefiere `as const` sobre enums cuando sea posible
* Usa discriminated unions para manejar estados (loading, error, success)
* Toda función pública debe tener tipos de retorno explícitos
* Usa Zod para validación de inputs en API routes y formularios
* Nunca uses type assertions (`as`) para silenciar errores — corrige el tipo real
* Usa Optional chaining (`?.`) y nullish coalescing (`??`) en lugar de checks manuales
* Prefiere `satisfies` sobre `as` para validar tipos sin perder inferencia

---

## 🎨 Estilo de código

* Componentes React: functional components con hooks, nunca class components
* Nombra archivos de componentes en PascalCase, utilidades en camelCase
* Un componente por archivo
* Extrae lógica compleja a custom hooks en `src/hooks/` **solo cuando se use en >1 lugar**
* Extrae utilidades reutilizables a `src/lib/` **solo cuando se use en >1 lugar**
* Server actions y API routes validan inputs en el servidor, nunca confíes solo en el frontend
* Maneja errores con try/catch en toda llamada async, nunca dejes promesas sin catch
* Usa el logger de `src/lib/logger.ts` en lugar de `console.log`
* Imports absolutos con `@/` en lugar de rutas relativas largas

---

## 📁 Estructura del proyecto

* `src/app/` — páginas y API routes (App Router)
* `src/app/(app)/` — rutas autenticadas de la app online
* `src/app/(offline)/` — rutas del módulo offline (en migración a HTML estático)
* `src/app/(launcher)/` — páginas públicas iniciales
* `src/components/` — componentes React reutilizables
* `src/hooks/` — custom hooks
* `src/lib/` — utilidades, tipos, configuraciones
* `src/lib/dicom/` — visor DICOM y utilidades
* `src/lib/pdf/` — generación de PDFs
* `src/lib/supabase/` — cliente Supabase
* `public/` — assets estáticos
* `public/bunker/` — (futuro) app estática del búnker offline
* Las migraciones SQL van en archivos separados con prefijo `supabase_migration_`

---

## 🗃️ Base de datos

* NUNCA ejecutes migraciones SQL directamente. Genera el archivo SQL y yo lo ejecuto manualmente en Supabase
* NUNCA hagas DELETE de datos en producción
* Toda tabla nueva con datos de pacientes DEBE tener RLS activado
* Toda foreign key a pacientes DEBE ser `ON DELETE RESTRICT`
* Todo cambio en datos sensibles DEBE registrarse en `audit_log`

---

## ⚖️ Cumplimiento normativo mexicano

* Esta app maneja datos de salud regulados por la NOM-004-SSA3-2012 y NOM-024-SSA3-2012
* Los datos de salud son datos personales sensibles bajo la LFPDPPP
* Las notas clínicas son inmutables — correcciones se hacen vía addendum
* Los expedientes nunca se borran — se usa soft delete con retención mínima de 5 años
* Todo acceso a expedientes debe quedar registrado en `audit_log`
* El consentimiento de privacidad es obligatorio antes de crear un paciente

---

## 🚦 Antes de cada sesión

Cuando inicies una sesión nueva contigo, espera que el usuario te diga el objetivo específico de la sesión. **Una sesión = un objetivo atómico.** No abras varios frentes a la vez.

Tu primer mensaje en cada sesión debe ser:
1. Confirmar que leíste este `CLAUDE.md` completo
2. Resumir en 3 líneas qué entendiste sobre el estado actual del módulo offline
3. Esperar el objetivo del usuario antes de proponer cualquier cosa

## Documentos de referencia para fases en progreso

- **CALCULADORAS_ROADMAP.md** — Sistema de 200 calculadoras clínicas. Leer ANTES de trabajar en calculadoras.
- **RESUMEN_DASHBOARD.md** — Dashboard del paciente en /expediente/[id]/estado. Leer ANTES de trabajar en esa página.

---

## 🪫 Deuda técnica conocida

Lista de bugs/limitaciones aceptadas conscientemente. No corregir sin plan explícito — cada ítem tiene contexto que justifica dejarlo.

1. **`regenerarYSubirPdf` muta `doc.pdf_url` local sin re-render.** En `src/components/expediente/ModalDocumentos.tsx` (migrado desde el antiguo `TabDocumentos` en Fase 6). Al regenerar un PDF, el botón de descarga no aparece hasta refetch manual. Arreglar con `setState` inmutable que reemplace el documento en la lista, no mutando el objeto por referencia.
2. **`ModalShell` sin focus trap.** Deuda de accesibilidad. El Tab puede escapar del modal. Agregar trap cuando tengamos auditoría a11y formal.
3. **Modales de Consultas y Documentos sin paginación.** Límite hard de 50 registros heredado de `QUERY_LIMIT` en `page.tsx`. Si un paciente tiene >50 consultas/documentos, los restantes no se ven en el modal. Agregar scroll virtual o buscador interno en fase futura.
4. ~~**`TabGraficas.tsx` vive temporalmente en disco como archivo utilitario.**~~ ✅ Resuelto (sub-fase 0 del rediseño de labs, 2026-04-21). Archivo eliminado; `normalizarKey` y `ParamGrafica` inlined en `src/hooks/useLaboratoriosNormalizados.ts`.
5. **`useLaboratoriosNormalizados.ts` — borrar al final del rediseño de labs (sub-fase 8).** Único consumidor externo: `src/app/(app)/expediente/[id]/page.tsx`. Ver `LABS_REDISEÑO_NOTES.md` para orden de migración.
6. **Tabla `laboratorios` legacy — DROP al final del rediseño de labs (sub-fase 8).** Consumidores además de `/estado`: `src/app/api/paciente/[id]/exportar/route.ts` (producción-crítico — migrar antes del drop). Ver detalles y orden estricto en `LABS_REDISEÑO_NOTES.md`.

---

## 🔓 Pendientes de seguridad

Hardening conocido pero no aplicado todavía. Cada ítem tiene fix planeado y momento previsto. No reordenar prioridades sin discusión.

### QW3 — Restringir endpoint ARCO a super_admin y admin

**Archivo afectado:** `src/app/api/paciente/[id]/exportar/route.ts`

**Problema:** El endpoint `POST /api/paciente/[id]/exportar` devuelve JSON completo con todos los datos del paciente (consultas, mediciones, documentos, addendums, datos personales) para cumplimiento ARCO (LFPDPPP Art. 28). Actualmente requiere sesión autenticada pero NO valida el role del usuario. Cualquier médico autenticado puede invocarlo vía fetch/curl.

**Origen:** Endpoint creado en sesión anterior como preparación para cumplimiento legal ARCO. Nunca se integró a UI de super-admin.

**Fix planeado:**
1. Agregar validación post-auth: `role IN ('super_admin', 'admin')`
2. Si role no cumple → responder `403 Forbidden`
3. Registrar intentos denegados en `audit_log` con `accion='arco_intento_denegado'`
4. Mantener el registro de accesos exitosos con `accion='arco_acceso'` (ya existe)

**Cuándo atacar:** Después del rediseño de labs (post sub-fase 8C y 9). Prioridad alta (riesgo de fuga de datos cross-usuario dentro de misma clínica, aunque endpoint esté dormido).

**Alcance estimado:** 1 archivo, ~15 líneas, 20 min.

**Decisiones ya tomadas:**
- Roles permitidos: `super_admin` + `admin` (admin de clínica puede ejecutar ARCO para pacientes de su clínica; super_admin global puede para cualquier clínica).
- Respuesta denegada: `403 Forbidden` con JSON `{ error: "forbidden" }`.
- Audit log: sí registrar intentos denegados.