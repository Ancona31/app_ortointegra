# Deuda técnica — Spinus

Registro central de deuda técnica detectada durante el trabajo de las etapas.
Cada entrada se agrupa por la etapa donde se detectó.

NO es lo mismo que CLAUDE.md (instrucciones permanentes para Claude Code) ni que
la sección "Fuera de alcance" de los planes operativos (deuda acotada a un
sub-paso específico). Aquí va deuda transversal que sobrevive a las etapas.

Estado: 🔴 abierta · 🟡 en progreso · 🟢 resuelta (se elimina al cerrar)

---

## 🔴 CUMPLIMIENTO REGULATORIO — PRIORIDAD MÁXIMA (bloqueante de lanzamiento)

### RG-01 · Certificación NOM-024-SSA3-2012 ante DGIS

**Estado:** no iniciado
**Prioridad:** extremadamente alta — resolver marco legal ANTES del lanzamiento
**Scope:** proyecto independiente. NO es parte de ningún trabajo de UI/landing.

**Contexto**
La NOM-004-SSA3-2012 regula el contenido del expediente clínico y obliga al
MÉDICO. La NOM-024-SSA3-2012 regula el SISTEMA que lo gestiona y es la que
aplica a Spinus. Quien la certifica es la DGIS (Dirección General de
Información en Salud, Secretaría de Salud), mediante auditoría técnica.

**Requisitos conocidos (verificar contra el texto oficial del DOF 30/11/2012)**
- [ ] Catálogos oficiales de la Secretaría de Salud
- [ ] CIE-10 en diagnósticos
- [ ] Guías de Intercambio de Información en Salud (GIIS)
- [ ] Interoperabilidad: HL7 / FHIR / DICOM
- [ ] Seguridad de datos e integridad de registros
- [ ] Trazabilidad: quién registró qué y cuándo

**Preguntas abiertas antes de lanzar**
- [ ] ¿Qué se puede operar y facturar legalmente SIN certificación?
- [ ] ¿La obligación recae en el prestador de servicios de salud o en el
      proveedor de software?
- [ ] ¿Qué se puede y qué NO se puede afirmar en marketing sin el aval?
- [ ] Verificar decreto DOF 15/01/2026, reforma a Ley General de Salud
      Art. 71 Ter (digitalización obligatoria + interoperabilidad)
- [ ] Costo, duración y prerrequisitos del proceso ante DGIS

**Bloqueantes previos**
- [ ] Audit log incompleto (existe, falta cobertura total de eventos)
- [ ] Dashboard de super-admin sin pulir
- [ ] Aviso de privacidad desactualizado: la LFPDPPP de 2010 fue abrogada
      el 21/03/2025 por la nueva LFPDPPP (DOF 20/03/2025, reformada
      14/11/2025). El INAI ya no existe; la autoridad es la Secretaría
      Anticorrupción y Buen Gobierno. Aplica también a dranconacolumna.com
      y al agente de WhatsApp.
- [ ] Contrato de encargado del tratamiento con los médicos suscriptores
- [ ] Definir y documentar política de acceso del super-admin a datos
      clínicos de otros médicos

**Riesgo si se ignora:** exposición médico-legal directa al titular
(persona física, titular de la marca y responsable del tratamiento de datos
sensibles de pacientes de terceros).

---

## Etapa 5 — Refactor de roles

### E5-DT-1 — Cuatro pantallas leen data.error en vez de data.message
- **Estado:** 🔴 abierta
- **Detectada:** Etapa 5, sub-paso 5.F Paso 1 (2026-05-28)
- **Archivos afectados:**
  - src/app/register/page.tsx:95,98
  - src/app/(app)/admin/usuarios/page.tsx:82
  - src/app/(app)/expediente/[id]/editar/page.tsx:112
  - src/app/(app)/expediente/[id]/consulta/[consultaId]/page.tsx:99 (addendum)
- **Descripción:** El handler de error de estos fetch muestra el código técnico
  (ej. `subscription_inactive`) en lugar del mensaje legible que el endpoint sí
  envía en `data.message`. El call site de `nueva-nota/page.tsx` tenía la misma
  deuda y se corrigió en 5.F Paso 1.
- **Patrón correcto:** `data.message || data.error || <genérico>` — ya es la
  convención dominante del codebase (5 call sites lo usan).
- **Fix:** una línea por pantalla. Idealmente barrer el codebase por si hay más
  call sites con la misma deuda.
- **Alcance:** sub-proyecto "limpieza de mensajes de error en frontend".

### E5-DT-2 — Ocultar identificador interno medico_id en exportación ARCO
- **Estado:** 🔴 abierta
- **Detectada:** Etapa 5, sub-paso 5.F Paso 1 (2026-05-28)
- **Archivo afectado:** src/app/api/paciente/[id]/exportar/route.ts
- **Descripción:** El endpoint hace `select('*')` sobre consultas. Tras 5.F, la
  columna `consultas.medico_id` (UUID interno del médico, antes siempre NULL)
  queda poblada, por lo que ese UUID empieza a aparecer en el JSON exportado al
  paciente. No es dato sensible del paciente (no revela nada que el expediente
  no exponga ya en forma legible: `medico_nombre`, `medico_cedula_*`), pero es
  higiene de exportación: no conviene filtrar identificadores internos.
- **Origen:** el `select('*')` precede a 5.F; la columna simplemente estaba
  vacía hasta ahora.
- **Fix:** reemplazar `select('*')` por una lista explícita de columnas que
  excluya `medico_id`. Revisar si otras columnas internas (ej. `client_id`
  residual) también deben excluirse.
- **Cuándo atacar:** sin urgencia (cosmético, no fuga de datos sensibles).
  Agrupable con QW3 (mismo endpoint, sigue en CLAUDE.md por ahora).
- **Decisiones ya tomadas:**
  - No se toca en 5.F (fuera de alcance).
  - La regla de visibilidad ARCO (médico invitado exporta solo sus consultas;
    admin exporta todas) queda correcta por las policies de 5.F (D-arco); esta
    deuda es solo sobre qué columnas se serializan, no sobre cuáles filas.

### E5-DT-3 — Ruta /pacientes/[id] no existe (click-through a 404)
- **Estado:** 🔴 abierta
- **Detectada:** Etapa 5, sub-fase control de acceso secretaria (2026-05-28)
- **Descripción:** La lista `/pacientes` (src/app/(app)/pacientes/page.tsx:146)
  enlaza a `/pacientes/{id}`, pero no existe
  `src/app/(app)/pacientes/[id]/page.tsx`. Clic en un paciente desde la lista
  lleva a 404.
- **Impacto:** afecta a médico y secretaria. La secretaria ahora usa
  `/pacientes` como destino tras la sub-fase de control de acceso, lo que
  expone más esta ruta rota.
- **Origen:** deuda preexistente que la sub-fase de secretaria expuso.
- **Posible resolución:** crear `/pacientes/[id]/page.tsx`, o cambiar el
  enlace de la lista a otra ruta válida.

### E5-DT-4 — SecretariaDashboard.tsx huérfano (código muerto)
- **Estado:** 🔴 abierta
- **Detectada:** Etapa 5, sub-fase control de acceso secretaria (2026-05-28)
- **Descripción:** `src/app/(app)/dashboard/SecretariaDashboard.tsx` coexiste
  con `AsistenteDashboard.tsx`, pero `dashboard/page.tsx:195` solo importa
  `AsistenteDashboard`. `SecretariaDashboard.tsx` no se monta en ningún lado.
- **Impacto:** código muerto. Riesgo de confusión (dos componentes con
  propósito similar). Sin impacto funcional.
- **Posible resolución:** confirmar que es huérfano (grep de su nombre) y
  eliminarlo.

### E5-DT-5 — Colisión de path de PDF por timestamp de minuto
- **Estado:** 🔴 abierta
- **Detectada:** Etapa 5, sub-paso 5.G Paso 2 (2026-05-30, EJE 3.3 de auditoría)
- **Archivos afectados:**
  - src/lib/mobileShare.ts:220 (construcción del path)
  - src/lib/patientUtils.ts:122-134 (`generateDocFileName`)
- **Descripción:** El path del PDF generado en bucket `documentos-pdf` se
  construye como `${pacienteId}/${finalName}` donde `finalName` incluye
  timestamp con resolución de minuto (`YYYY-MM-DD_HHmm_Tipo_Nombre.pdf`). Dos
  documentos del mismo paciente, mismo tipo, mismo nombre, generados dentro del
  mismo minuto, comparten path. Con `upsert: true` en el `.upload()`, el
  segundo sobrescribe al primero — quedan 2 filas en `documentos` apuntando al
  mismo objeto. Si se borra UNA fila (vía Ruta A del DELETE, ahora con hard
  delete del bucket), el PDF desaparece y la otra fila queda con `pdf_url`
  huérfano (botón de descarga roto).
- **Impacto:** baja probabilidad real (requiere generación duplicada dentro
  del mismo minuto). Inofensivo en operación normal; ofensivo si dos médicos
  generan el mismo tipo de documento al mismo paciente casi simultáneamente
  (escenario futuro en clínicas multi-médico).
- **Origen:** esquema de naming preexistente, no introducido por 5.G.
- **Fix:** añadir segundos (`HHmmss`) o un sufijo aleatorio corto (uuid de 4-6
  caracteres) a `finalName` en `generateDocFileName`. Cambio acotado a una
  función; el resto del flujo (insert con `pdf_url`, descarga via signed URL,
  delete con hard-delete del bucket) ya es compatible con paths únicos.
- **Cuándo atacar:** sin urgencia hoy; revisar antes de habilitar clínicas
  multi-médico de uso intensivo.

### E5-DT-6 — UX del 403 silencioso en DELETE de documento ajeno
- **Estado:** 🔴 abierta
- **Detectada:** Etapa 5, sub-paso 5.G Paso 2 (2026-05-30, EJE C.2 de re-auditoría)
- **Archivos afectados:**
  - src/app/(app)/expediente/[id]/page.tsx:131-136 (función `eliminarDocumento`)
  - src/app/api/documentos/[id]/route.ts (handler que retorna 403)
- **Descripción:** Tras 5.G Paso 4, la policy `documentos_delete` filtra por
  `subido_por = auth.uid()`. Si un médico no-creador intenta borrar un
  documento ajeno (vía URL manipulada o por error), el handler retorna 403 con
  body `{ error: 'No se pudo eliminar' }`. El frontend solo lee `res.ok`
  (línea 133) y no muestra mensaje al usuario — la lista no se recarga, el
  modal se queda igual, el médico ve "no pasó nada" sin saber por qué.
- **Impacto:** UX confusa cuando 5.G Paso 4 entra en clínicas multi-médico.
  Hoy con clínica mono-médico el escenario no se materializa (no hay docs
  ajenos visibles que intentar borrar). En clínicas multi-médico, el médico
  no entendería por qué falla.
- **Origen:** UX preexistente del componente; las policies de 5.F (consultas)
  tenían la misma carencia.
- **Fix:** parsear el body del response no-ok y mostrar un toast con el
  mensaje (`'No se pudo eliminar'` o un texto más descriptivo). Patrón
  consistente con cómo otros endpoints del repo manejan errores.
- **Cuándo atacar:** antes de habilitar clínicas multi-médico, o cuando se
  reactive el flujo donde un usuario pueda chocar contra docs ajenos.

### E5-DT-7 — Endpoint ARCO exportar incluye documentos (fuera de alcance)
- **Estado:** 🔴 abierta
- **Detectada:** Etapa 5, sub-paso 5.G Paso 3 — diagnóstico (b) (2026-05-30)
- **Archivo afectado:** src/app/api/paciente/[id]/exportar/route.ts:57
- **Descripción:** El endpoint hace `.from('documentos').select('*').eq('paciente_id', id)`
  con cliente de usuario. Tras 5.G Paso 4, el array `documentos` del export se
  reduce a "documentos que el solicitante subió + legacy NULL" — queda
  incompleto si el paciente tiene documentos de otros médicos de la clínica.
- **Decisiones ya tomadas (D-5.G-ARCO):** los documentos generados (recetas,
  cotizaciones, solicitudes, escritos médicos) están **fuera del alcance
  ARCO** — son instrumentos profesionales del médico tratante, no datos
  personales del paciente. Si un paciente necesita una copia, el médico la
  genera de nuevo manualmente. Por tanto este endpoint NO debe incluir
  `documentos` en su payload final.
- **Fix:** eliminar la lectura de `documentos` del Promise.all del endpoint
  (líneas 47-58); el array `documentos` debería desaparecer del JSON
  exportado. Re-evaluar otros campos del export para coherencia con la regla
  "documentos generados son del médico, no del paciente".
- **Cuándo atacar:** vinculado a QW3 de CLAUDE.md ("rediseño del export ARCO
  con gate de admin y service_role"). Endpoint hoy sin call site activo
  (`ExportarExpedienteButton.tsx` no lo invoca), por lo que el impacto
  operacional es cero. Se ataca cuando se reactive el flujo ARCO.
- **Relación con E5-DT-2:** comparten archivo. Al rediseñar el endpoint se
  resuelven ambas deudas.

### E5-DT-8 — Duplicación visual transitoria de citas al cambiar horario
- **Estado:** 🔴 abierta
- **Detectada:** Etapa 5, sub-paso 5.H Paso 1 — smoke tests funcionales (2026-05-30)
- **Archivo afectado:** src/app/(app)/agenda/page.tsx (ejecutarDrop ~líneas 1080-1100 + handlers de FullCalendar y `optimisticEvent`)
- **Descripción:** Al cambiar el horario de una cita (drag&drop o resize en
  el calendario), la UI muestra ocasionalmente la cita DUPLICADA visualmente
  (la original + la nueva posición). La acción del usuario para "borrar el
  duplicado" elimina ambas instancias de la UI, pero en BD nunca existieron
  dos citas — solo había un source. Tras recargar la página, el estado
  vuelve a la verdad de BD. Reproducción intermitente: ocurrió una vez, al
  repetir el mismo escenario no se reprodujo.
- **Impacto:** confusión del usuario que ve "duplicados" inexistentes.
  Riesgo de que un usuario borre lo que cree son duplicados y elimine la
  cita real. Sin impacto en integridad de datos en BD.
- **Origen:** comportamiento preexistente del componente de agenda; no
  introducido por 5.H Paso 1. Posible race condition entre la actualización
  optimista (`optimisticEvent.remove()`/`refetch()`) y el render del
  calendar library.
- **Fix:** investigar el flujo de `optimisticEvent` en `agenda/page.tsx`,
  validar el orden remove/refetch en la rama de éxito de `ejecutarDrop`
  (hoy solo se limpia en la rama de error), evaluar si la librería de
  calendar gestiona mutaciones correctamente. Sub-proyecto dedicado al
  componente de agenda.
- **Cuándo atacar:** sin urgencia inmediata. NO bloquea Paso 1 ni Pasos 2-5
  de 5.H. Verificar primero en producción tras 5.H completo si el bug se
  reproduce (posible que el lag del servidor local agrave la race condition).
- **Contexto de detección:** detectado durante prueba local (`npm run dev`
  en `localhost:3000`); el cableado server-side del Paso 1 (medico_id por
  rol + validación admin/secretaria) NO está relacionado y funcionó
  correctamente en todos los smoke tests.

### E5-DT-9 — Citas legacy con medico_id NULL en producción
- **Estado:** 🔴 abierta
- **Detectada:** Etapa 5, sub-paso 5.H Paso 2 — diagnóstico (a) (2026-05-30)
- **Archivos afectados:** datos en producción (`public.appointments`), no código.
- **Descripción:** En el diagnóstico (a) del Paso 2 se detectaron 2 citas con
  `medico_id NULL` en producción, ambas creadas antes del cableado del Paso 1
  (que ahora exige `medico_id` server-side):
  - `6d1006a6-4fbf-42ee-8d2b-573d2baf48b8` ("Prueba Prueba", OrtoIntegra,
    creada el 2026-05-04 por la secretaria de la clínica).
  - `98baf83a-6b10-4c3e-a75e-79325b77600a` ("Alan Ramirez", Dra. Ilse Casillas,
    creada el 2026-04-05).
  Tras 5.H Paso 3 aplicado: estas citas son INVISIBLES para médicos invitados
  (el predicado no tiene rama `medico_id IS NULL`). Admin y secretaria de sus
  respectivas clínicas las siguen viendo (sus ramas `soy_admin_de_clinica()`
  y `get_my_role() = 'secretaria'` no dependen de `medico_id`).
- **Decisiones ya tomadas (D-5.H-NULL):** aceptar orfandad. Sin backfill ni
  rama NULL en las policies. El cableado del Paso 1 (validación server-side
  `medico_id_required`) garantiza que no se creen nuevas citas NULL en el
  futuro.
- **Impacto:** bajo. Solo afecta a las 2 citas existentes; cada admin de
  clínica decidirá si las asigna manualmente o las borra. Sin impacto en
  flujos vivos (las dos citas son del pasado: 5 may y 5 abr).
- **Fix:** opcional, decisión del admin de cada clínica:
  - Asignar `medico_id` desde la UI (abrir cita, seleccionar médico, guardar).
  - Borrar la cita si ya no tiene valor histórico.
  - O dejarla en orfandad permanente (admin sigue viéndola).
- **Cuándo atacar:** sin urgencia. No bloquea ningún flujo; cada admin lo
  resuelve cuando lo decida en su clínica. Para OrtoIntegra (Dr. Ancona):
  decidido dejarla en orfandad (registro de prueba histórica).
- **Relación con E5-DT-8:** independientes.

### E5-DT-10 — Endpoint ARCO incluye mediciones_analitos
- **Estado:** 🔴 abierta
- **Detectada:** Etapa 5, sub-paso 5.I (2026-05-31)
- **Archivo afectado:** `src/app/api/paciente/[id]/exportar/route.ts:53`
- **Descripción:** El endpoint ARCO de export de datos de paciente (dormante,
  sin call site activo según diagnóstico (b) de 5.G) incluye un SELECT a
  `mediciones_analitos` en el payload de export. Bajo D-5.I-ARCO, ARCO aplica
  SOLO sobre addendums; mediciones quedan FUERA (son ayuda al médico, no
  documentación clínica formal del expediente legal del paciente).
- **Fix pendiente:** eliminar el SELECT de `mediciones_analitos` del endpoint
  exportar.
- **Cuándo atacar:** sin urgencia (endpoint dormante). Junto con la limpieza
  pendiente de E5-DT-7 (eliminar SELECT de `documentos` del mismo endpoint
  bajo D-5.G-ARCO).
- **Relación con E5-DT-7:** ambas piden eliminar contenido del endpoint ARCO
  dormante para alinear con las decisiones de scope (D-5.G-ARCO + D-5.I-ARCO).

### E5-DT-11 — Consultas huérfanas legacy con medico_id NULL
- **Estado:** 🔴 abierta
- **Detectada:** Etapa 5, sub-paso 5.I Paso 1.bis (2026-05-31)
- **Archivo afectado:** datos en producción (`public.consultas`), no código.
- **Descripción:** 87 consultas con `medico_id IS NULL` en producción,
  distribuidas en 7 clínicas (la mayoría en OrtoIntegra). Origen mixto:
  69 con `nota_origen='ia'` + 17 con `nota_origen='manual'`. Rango temporal:
  25 mar 2026 → 27 may 2026.
- **Fuga cerrada:** smoke test del 2026-05-31 con notas IA y manual recién
  creadas en ambos flujos arrojó `medico_id` poblado correctamente. La fuga
  fue cerrada en algún commit anterior (probablemente durante 5.F o 5.H) sin
  registro explícito.
- **Impacto tras 5.I aplicado:** estas 87 consultas quedan permanentemente
  no-addendables bajo D-5.I-H2 interpretación A estricta + Opción A fail-closed
  (no hay autor identificable → ni autor ni admin pueden addendar). Admin
  puede VERLAS vía `consultas_select` (rama admin), pero no puede agregar
  addendums.
- **Fix opcional:** backfill puntual vía SQL Editor asignando `medico_id` a
  consultas legítimas (no "Prueba Prueba") que requieran addendum futuro.
  Operación admin manual con UPDATE puntual; sin urgencia (las 87 son
  legacy histórica, sin demanda activa).
- **Cuándo atacar:** sin urgencia. Backfill solo si surge necesidad clínica
  específica de addendar alguna consulta huérfana real.
- **Relación con otras deudas:** independiente de E5-DT-10. Es deuda de datos,
  no de código.

### E5-DT-13 — Pieza 3 del auditor: trigger de auditoría forense en profiles
- **Estado:** 🔴 abierta
- **Detectada:** Auditoría de seguridad (2026-06-02), Pieza 3 del plan de remediación.
- **Archivo afectado:** Base de datos en producción (no código).
- **Descripción:** Tras el cierre de las vulnerabilidades 🔴 1.1/1.2/1.3
  con el trigger guardián de columnas sensibles
  (`20260602_sec_proteger_columnas_sensibles_profiles.sql`), el cierre
  forense queda pendiente. Hoy, cualquier UPDATE legítimo a `profiles`
  (vía service_role) no deja huella propia en `audit_log`. Si en el
  futuro se requiere reconstruir cuándo y quién cambió `role`,
  `clinica_id` o `es_admin_de_clinica` de algún usuario, no hay rastro.
- **Fix pendiente:** Crear trigger AFTER UPDATE en profiles que registre
  en `audit_log` cualquier cambio de las 3 columnas sensibles. Antes de
  diseñar, inspeccionar la estructura de `audit_log` (columnas, tipo,
  formato del payload) para alinearse con el patrón existente.
- **Cuándo atacar:** Sin urgencia (no es agujero abierto). En sesión del
  auditor de seguridad de Spinus.
- **Relación con otras deudas:** Continuación natural del trigger
  guardián de la Pieza 2. Cierra el plan de remediación completo del
  auditor.

### E5-DT-14 — Storage policies sin auditar (EJE 6 de la investigación cross-tenant)
- **Estado:** 🟢 resuelta (2026-06-03) — se conserva como ancla de
  trazabilidad de los residuales E5-DT-20/21/22 (nuevos) y E5-DT-15/16/18
  (heredados, siguen abiertos).
- **Detectada:** Auditoría de seguridad (2026-06-02), EJE 6 del reporte de
  investigación cross-tenant.
- **Archivo afectado:** Policies de `storage.objects` en producción.
- **Descripción (original):** Los 4 buckets de Supabase Storage
  (`clinica-logos` público, `documentos-pdf`, `firmas-medicos`,
  `labs-documentos` privados) tenían policies de `storage.objects` no
  exportadas ni auditadas. El baseline `09_storage_buckets.sql` lo decía
  explícitamente.
- **Cierre (2026-06-03):** auditados los 4 buckets.
  - `firmas-medicos`: blindado con policy RESTRICTIVE (deny-all a
    authenticated/anon, acotada por bucket_id). Aplicado y validado.
    Registro: `supabase/migrations/20260603_sec_blindaje_bucket_firmas_medicos.sql`.
  - `documentos-pdf`: las 3 policies abiertas
    (`authenticated_select/insert/delete`, que solo exigían `bucket_id`)
    se reemplazaron por 3 policies atadas a
    `soy_medico_tratante(<paciente_id del path>)` con CASE-guard del cast a
    uuid. Cierra fuga cross-tenant E intra-clínica. Aplicado y validado.
    Registro: `supabase/migrations/20260603_sec_documentos_pdf_acceso_tratante.sql`.
  - `labs-documentos` y `casos-clinicos`: ya estaban correctamente acotados
    por bucket (PERMISSIVE por clínica/tratante). Sin cambios.
  - `clinica-logos`: público a propósito (logos no son PHI). Sin cambios.
  - Smoke tests (transacciones revertidas) y validación operativa posterior
    en la app: OK. Detalle en los dos archivos de migración citados.
- **Residuales abiertos tras el cierre:**
  - E5-DT-20 (nuevo) — seguridad de cliente de las firmas autógrafas.
  - E5-DT-21 (nuevo) — divergencia creador vs. tratante en documentos-pdf.
  - E5-DT-22 (nuevo) — documentos-pdf sin policy UPDATE: verificado, sin
    acción requerida.
  - E5-DT-15, E5-DT-16, E5-DT-18 (heredados de la auditoría 2026-06-02):
    siguen abiertos, sin cambio.

### E5-DT-15 — paciente_medico auto-asignación intra-clínica (EJE 10.3)
- **Estado:** 🟡 abierta
- **Detectada:** Auditoría de seguridad (2026-06-02), EJE 10.3 del reporte
  de investigación cross-tenant.
- **Archivo afectado:** Policy `paciente_medico_insert` en
  `supabase/migrations/<5.E BD-2>:36-45`.
- **Descripción:** La policy actual permite a cualquier médico/secretaria
  de la clínica insertar un vínculo `paciente_medico` con
  `medico_id = auth.uid()` para cualquier paciente de su clínica. Un
  médico no-admin puede auto-asignarse como tratante de un paciente que
  pertenece a un colega y, vía `soy_medico_tratante()`, leerlo. Derrota
  la privacidad por-médico que 5.E pretendió ("médico invitado ve SOLO
  sus pacientes"). No es cross-tenant (no cruza clínicas), pero es un
  agujero de privacidad intra-clínica entre médicos.
- **Fix pendiente:** Decidir si endurecer la policy (restringir INSERT
  a admin/secretaria, quitar la rama de auto-asignación) o aceptarlo
  como decisión de diseño documentada (ejemplo: secretaria es quien
  asigna, médico no-admin no puede). Decisión de producto pendiente.
- **Cuándo atacar:** Sin urgencia. En sesión del auditor de seguridad
  o como sub-paso de Etapa 5 si decides endurecer.
- **Relación con otras deudas:** Independiente del trigger guardián
  de la Pieza 2. Es deuda de modelo de policy, no de vulnerabilidad
  técnica.

### E5-DT-16 — Comparación no-constant-time en email-hook
- **Estado:** 🟡 abierta (menor)
- **Detectada:** Auditoría de seguridad (2026-06-02), hallazgo lateral.
- **Archivo afectado:** `src/app/api/auth/email-hook/route.ts`.
- **Descripción:** La verificación de la firma del email-hook usa
  comparación `===` que no es constant-time. En teoría permite ataques
  de timing para inferir la firma byte a byte. En la práctica, el
  vector es muy difícil de explotar (latencia de red >> diferencia de
  tiempo del comparación). Hardening defensivo.
- **Fix pendiente:** Reemplazar `===` por `crypto.timingSafeEqual()`
  de Node.js para comparación constant-time.
- **Cuándo atacar:** Sin urgencia. Fix pequeño que puede agruparse con
  otras tareas de hardening.

### E5-DT-17 — Limpieza: comentario huérfano signUp + reenviar-confirmacion no auditada
- **Estado:** 🟡 abierta (limpieza)
- **Detectada:** Auditoría de seguridad (2026-06-02), hallazgo lateral
  durante eliminación de complete-registro.
- **Archivo afectado:** Código con comentario huérfano sobre flujo signUp
  revertido (ubicación exacta a determinar) y endpoint
  `/api/auth/reenviar-confirmacion` no auditado.
- **Descripción:** Tras eliminar `/api/auth/complete-registro` (vestigio
  del flujo signUp revertido el 2026-04-02), quedó un comentario huérfano
  en el código que referencia el flujo desaparecido. Separadamente, el
  endpoint `/api/auth/reenviar-confirmacion` no fue auditado en la sesión
  del 2026-06-02 (fuera de alcance). Conviene revisarlo para confirmar
  que no es otra ruta muerta o que está correctamente blindado.
- **Fix pendiente:** (a) eliminar el comentario huérfano; (b) auditar
  el endpoint `reenviar-confirmacion` y decidir si es necesario o también
  es ruta muerta.
- **Cuándo atacar:** Sin urgencia. Limpieza menor.

### E5-DT-18 — Apunte preventivo: trigger BEFORE INSERT si se añade policy INSERT a profiles
- **Estado:** ⚪ preventiva (no es deuda actual, es recordatorio futuro)
- **Detectada:** Auditoría de seguridad (2026-06-02), apunte de Claude
  Code durante diseño del trigger guardián de la Pieza 2.
- **Archivo afectado:** Trigger guardián en
  `supabase/migrations/20260602_sec_proteger_columnas_sensibles_profiles.sql`.
- **Descripción:** El trigger guardián actual es BEFORE UPDATE: previene
  cambios maliciosos de `role`, `clinica_id` y `es_admin_de_clinica` en
  profiles existentes. NO cubre INSERT porque hoy `profiles` no tiene
  policy INSERT (el alta de usuarios va por endpoint admin con
  service_role). Si en el futuro se agrega una policy INSERT para
  `authenticated` en profiles (cambio de modelo significativo), el
  trigger debe extenderse con un BEFORE INSERT análogo que valide las
  3 columnas sensibles.
- **Acción pendiente:** Recordatorio. Aplica solo si se decide cambiar
  el modelo de alta de usuarios.
- **Cuándo atacar:** N/A hasta que cambie el modelo.

### E5-DT-19 — Falta endpoint + UI para que admin edite perfiles de su clínica
- **Estado:** 🟡 abierta
- **Detectada:** Etapa 5, sub-paso 5.J (2026-06-02), durante discusión de
  decisión D-5.J-PROFILES-UPDATE.
- **Archivo afectado:** `src/app/admin/usuarios/page.tsx` (UI) +
  `src/app/api/admin/usuarios/` (falta endpoint PATCH).
- **Descripción:** La página `/admin/usuarios` actualmente solo permite
  ELIMINAR usuarios; no tiene botón "Editar" para que el admin de clínica
  corrija datos profesionales (nombre, título, especialidad, cédulas,
  dirección, teléfono, firma) de sus médicos y secretarias. La intención
  de producto SÍ es permitirlo, por lo que la decisión D-5.J-PROFILES-UPDATE
  añadió la rama admin al predicado de la policy de UPDATE de profiles.
- **Fix pendiente:** (a) crear endpoint PATCH `/api/admin/usuarios/[id]`
  con validación de inputs (cédulas, role no editable por admin),
  whitelist explícita de campos editables, y verificación de que el target
  pertenece a la clínica del admin caller; (b) añadir botón "Editar" y
  modal con formulario de edición en la UI de `/admin/usuarios`; (c)
  smoke tests del flujo completo.
- **BD ya está lista:** tras 5.J, la policy `profiles_update` tiene rama
  admin (`USING (id = auth.uid() OR soy_admin_de_clinica()) AND tenant
  scope`, con WITH CHECK idéntico). El trigger guardián de columnas
  sensibles del auditor de seguridad (`20260602_sec_proteger_columnas_sensibles_profiles.sql`)
  protege automáticamente que el admin NO pueda cambiar `role`,
  `clinica_id` o `es_admin_de_clinica` de los usuarios que edita. El
  endpoint solo necesita whitelist server-side de columnas seguras y
  validación de tenant.
- **Cuándo atacar:** sin urgencia operativa. Se materializa cuando surja
  necesidad real (un admin reporta que necesita corregir datos de un
  miembro de su equipo). Trabajo de feature, no de seguridad.
- **Relación con E5-DT-13 a E5-DT-18:** independiente. Las del auditor son
  de hardening de seguridad; ésta es de capacidad funcional planeada en
  el modelo de roles.

### E5-DT-20 — Seguridad de cliente de las firmas autógrafas
- **Estado:** 🔴 abierta (ALTA PRIORIDAD)
- **Detectada:** Cierre de E5-DT-14 / auditoría de storage (Eje 6), 2026-06-03.
- **Archivos afectados:**
  - src/lib/offline/doctorProfile.ts — cache base64 en localStorage, clave
    `'spinus_doctor_profile'`, campo `firma_base64`.
  - src/app/api/me/perfil-medico, src/app/api/me/firma — signed URLs de 1h
    en respuestas JSON.
- **Descripción:** La firma autógrafa del médico se expone al cliente como
  signed URL de 1h, necesario para estamparla en los PDFs que se generan en
  el navegador con `@react-pdf/renderer`. El blindaje del bucket
  `firmas-medicos` (RESTRICTIVE, ver E5-DT-14) cierra el acceso directo al
  bucket, pero NO cubre la superficie de cliente, que sigue abierta:
  - **Vector principal:** la firma se cachea como base64 SIN caducidad en
    `localStorage` (`doctorProfile.ts`, `firma_base64`). Persiste
    indefinidamente en el dispositivo, sobrevive a la expiración de la
    signed URL y queda expuesta a XSS o a un dispositivo compartido.
  - **Vectores menores:** signed URLs de 1h circulando en respuestas JSON
    (`/api/me/perfil-medico`, `/api/me/firma`); firma presente en el DOM
    durante la generación del PDF.
- **Fix pendiente:** quitar / cifrar / caducar el cache base64 de
  `localStorage` + revisión anti-XSS del flujo. Es seguridad de **cliente**,
  no de bucket.
- **Cuándo atacar:** sesión de seguridad de cliente dedicada (alcance propio,
  no es continuación del blindaje de storage).
- **Relación con otras deudas:** surge del mismo cierre que E5-DT-14, pero su
  superficie (cliente) es ortogonal al blindaje de bucket ya aplicado.

### E5-DT-21 — documentos-pdf: divergencia creador vs. tratante
- **Estado:** 🔴 abierta (LATENTE — no se materializa en mono-médico)
- **Detectada:** Cierre de E5-DT-14 / auditoría de storage (Eje 6), 2026-06-03.
- **Archivos afectados:**
  - supabase/migrations/20260530_etapa5g_paso4_policies_documentos.sql
    (policies de la fila `public.documentos`: `subido_por = auth.uid()`).
  - supabase/migrations/20260603_sec_documentos_pdf_acceso_tratante.sql
    (policies de storage: `soy_medico_tratante(...)`).
- **Descripción:** La policy de la **fila** en `public.documentos` autoriza
  por **creador** (`subido_por = auth.uid()`), mientras que la policy de
  **storage** (aplicada 2026-06-03) autoriza por **tratante**
  (`soy_medico_tratante(<paciente_id>)`). Ambos predicados coinciden solo en
  clínicas **mono-médico** (estado actual: creador == tratante). Si se
  habilitan clínicas multi-médico o se reasigna el tratante de un paciente,
  pueden desincronizarse: un creador no-tratante podría tener la fila pero no
  poder subir/leer el PDF (documento sin PDF), o un PDF quedar inaccesible
  para quien sí ve la fila.
- **Fix pendiente:** decidir el modelo unificado (atar fila y storage al
  mismo predicado) antes de habilitar multi-médico o reasignación de
  tratante. No requiere acción mientras las clínicas sean mono-médico.
- **Cuándo atacar:** antes de habilitar clínicas multi-médico.
- **Relación con otras deudas:** comparte el disparador "revisar antes de
  multi-médico" con E5-DT-5 (colisión de path) y E5-DT-6 (UX del 403 en
  DELETE ajeno).

### E5-DT-22 — documentos-pdf sin policy UPDATE (verificada, sin acción)
- **Estado:** 🟢 resuelta (2026-06-03) — verificación cerrada, NO hay nada
  que construir. No reabrir.
- **Detectada:** Cierre de E5-DT-14 / auditoría de storage (Eje 6), 2026-06-03.
- **Archivo afectado:** Policies de `storage.objects` para el bucket
  `documentos-pdf` (no hay, ni debe haber, policy `FOR UPDATE`).
- **Conclusión (inequívoca):** **NO se requiere** una policy `UPDATE` en
  `documentos-pdf`. Esto NO es una tarea pendiente; es una verificación que
  resultó negativa.
  - **Razón:** la regeneración de documentos usa `upsert: true` en el
    `.upload()` (src/lib/mobileShare.ts), que se resuelve por la ruta
    **INSERT**, ya cubierta por la `WITH CHECK` de
    `documentos_pdf_insert_tratante`. No interviene ninguna operación UPDATE
    a nivel `storage.objects`.
  - **Verificación funcional:** el usuario regeneró un documento existente en
    la app el 2026-06-03 — funcionó sin error.
  - **Por qué NO añadir una policy UPDATE:** sería contraproducente. Abriría
    una operación de escritura hoy cerrada, ampliando la superficie de ataque
    sin ningún beneficio funcional.
- **Acción requerida:** ninguna. Solo reabrir si Supabase cambia el
  comportamiento de storage-api (p.ej. si el upsert dejara de resolverse por
  INSERT). Cualquiera que lea esta entrada NO debe construir nada.

### E5-DT-23 — unaccent instalada pero no cableada en búsqueda/detección
- **Estado:** 🟡 abierta
- **Detectada:** Sesión de fix de Bug #1/Bug #2 (2026-06-08).
- **Archivo afectado:** Queries de búsqueda en 6 componentes cliente (CommandPalette, ConsultaRapidaModal, /expediente, /pacientes, /documentos, /agenda) + query de detección TS-side en `/api/pacientes/route.ts`.
- **Descripción:** La extensión Postgres `unaccent` está instalada en producción y `authenticated` tiene permiso de EXECUTE (verificado empíricamente el 2026-06-08 con `SELECT unaccent('Pérez García')` que devolvió `Perez Garcia`). Sin embargo, NO está cableada en ninguna query del repo: ni el RPC `crear_paciente_con_medico_v2`, ni las 6 barras de búsqueda, ni el bloque de detección TS-side la usan. Como `ilike` de Postgres es case-insensitive pero NO accent-insensitive, búsquedas tipo "perez" no encuentran "Pérez" con tilde, y la detección TS-side no detecta duplicados cuando uno tiene tilde y el otro no.
- **Fix pendiente:** Cablear `unaccent` en los predicados ilike de queries de búsqueda y detección. Patrón sugerido para client-side: `.filter('unaccent(nombre)', 'ilike', unaccent_normalized_input)`. Patrón sugerido para SQL: `unaccent(nombre) ILIKE unaccent(input)`. Tradeoff: mejora UX de búsqueda pero requiere refactorizar 6 barras + endpoint + posible función wrapper si el filter de PostgREST no soporta funciones directas en la columna.
- **Cuándo atacar:** Sin urgencia. Es mejora real de UX pero no bloquea funcionalidad. Cuando se reciban reportes concretos de "no encuentro a Pérez si escribo Perez" o cuando se decida una sesión dedicada de mejora de búsqueda.
- **Relación con otras deudas:** Independiente. No bloquea ni es bloqueada por otras.

### E5-DT-24 — Médico invitado sin visibilidad cross-médico en detección TS-side de duplicados
- **Estado:** 🟡 abierta (limitación aceptada conscientemente)
- **Detectada:** Sesión de fix de Bug #1 (2026-06-08), durante auditoría con ojos frescos del Bloque B.
- **Archivo afectado:** `src/app/api/pacientes/route.ts` (bloque de detección TS-side añadido en commit del 2026-06-08).
- **Descripción:** La detección TS-side de duplicados (añadida para cubrir el caso "sin fecha de nacimiento" que el RPC no cubre) corre bajo el cliente authenticated con la RLS actual de `pacientes`. La policy `pacientes_select_activos` permite ver todos los pacientes de la clínica si el usuario es admin o secretaria, pero solo los propios (vía `soy_medico_tratante(id)` que consulta `paciente_medico`) si es médico invitado no-admin. Por tanto, un médico invitado intentando crear un paciente sin fecha que ya existe registrado por OTRO médico de la misma clínica NO disparará la alerta TS-side. Además, el RPC tampoco respalda este caso (solo detecta cuando hay fecha). Brecha real: sin fecha + médico invitado + duplicado registrado por colega = duplicado se crea.
- **Mitigación parcial actual:** Para admin/secretaria (incluyendo Angel como admin de OrtoIntegra) la detección funciona completa porque la RLS deja ver todos los pacientes de la clínica. Para mono-médico también funciona (no hay otros médicos en la clínica que puedan haber registrado al paciente). La brecha solo se materializa en clínicas multi-médico con médicos invitados no-admin.
- **Fix pendiente:** Dos opciones: (a) modificar la query TS-side para usar admin client (createAdminClient con service_role) cuando se necesita ver toda la clínica para detección; (b) crear un RPC SECURITY DEFINER dedicado solo para detección sin-fecha que bypassse RLS de forma controlada. Ambas requieren auditoría de seguridad.
- **Cuándo atacar:** Cuando se habilite multi-médico real con médicos invitados activos. Mientras Angel siga como admin único de OrtoIntegra, no se materializa.
- **Relación con otras deudas:** Conectada a E5-DT-21 (divergencia creador vs tratante en `documentos-pdf`) — ambas son consecuencias de que la app está siendo migrada de mono-médico a multi-médico y hay vectores latentes.

---

## Nota IA — Rediseño

### NIA-DT-1 — Separador inconsistente en profiles.especialidad
- **Estado:** 🔴 abierta
- **Detectada:** Investigación read-only de la nota IA (2026-06-05).
- **Archivos afectados:**
  - src/app/(app)/perfil/page.tsx (escritura con ' · ' + lectura que solo
    reconoce ' · ')
  - src/app/register/page.tsx (escritura con ' · ')
  - src/components/onboarding/OnboardingModal.tsx (escritura con ', ')
  - src/lib/especialidades.ts (catálogo fijo de 39 especialidades, sin
    validación aplicada)
- **Descripción:** El campo profiles.especialidad (text, máx 2 especialidades
  concatenadas) se guarda con separadores distintos según el punto de captura:
  perfil (perfil/page.tsx) y registro (register/page.tsx) usan ' · '; onboarding
  (OnboardingModal.tsx) usa ', '. La lectura del perfil (perfil/page.tsx) solo
  reconoce ' · ', por lo que un médico que cargó 2 especialidades vía onboarding
  no se re-parsea correctamente al editar su perfil (queda como una sola
  entrada). Además, no hay validación contra el catálogo (especialidades.ts) ni
  constraint en DB.
- **Impacto:** gestión de perfiles inconsistente; afecta a cualquier consumidor
  que intente separar las especialidades.
- **Mitigación recomendada:** unificar a un solo separador en los 3 puntos de
  captura y normalizar la lectura, en una sesión dedicada de perfiles (scope
  independiente del rediseño de la nota IA).
- **Nota:** la nota IA queda blindada vía split tolerante en su backend (ver
  NOTA_IA_PROMPT_DISEÑO.md, "Pendiente al implementar (SF3)"), así que esta deuda
  no la bloquea.

### NIA-DT-2 — Rate limit obsoleto con entrevista multi-turno
- **Estado:** 🟡 mitigada
- **Detectada:** Refactor de la nota IA a dos llamadas + entrevista multi-turno
  (2026-06-06).
- **Archivos afectados:**
  - src/lib/rateLimit.ts (límite 'nota-medica' = 20/24h, conteo por llamada)
  - src/app/api/nota-medica/route.ts (cada turno de entrevista = 1 llamada al
    endpoint)
- **Descripción:** El límite actual de 'nota-medica' (20/24h) cuenta 1 por CADA
  llamada al endpoint. Con el nuevo modelo de entrevista, una sola nota puede
  consumir varias llamadas: 1 por cada turno de la entrevista (el médico responde
  preguntas en varios turnos) + la generación final. Además, la llamada 2
  (extracción de medicamentos) es interna y NO cuenta para el rate limit
  (correcto). El límite "por llamada" ya no refleja "por nota".
- **Impacto:** un médico que use la entrevista a fondo puede agotar el cupo
  diario con pocas notas reales; el límite ya no mide lo que pretende.
- **Mitigación recomendada:** decidir entre (a) subir el límite a ~60-80/24h para
  absorber la entrevista, o (b) contar "por nota generada" (status completa) en
  vez de "por llamada", de forma que los turnos de entrevista no consuman cupo.
  Revisar de forma holística junto con el resto del rate limiting cuando se cablee
  el frontend de la entrevista.
- **Resolución (2026-06-07):** Mitigado subiendo el límite a 60/24h (opción a). La
  opción b (contar "por nota generada" —status completa— en vez de "por llamada")
  queda como mejora futura si el límite por llamada resulta insuficiente o impreciso
  en uso real.

---

## Fase 3 — Multiconsultorio

### F3-10-DT-01 — Regeneración de PDF en ModalDocumentos lee legacy

**Detectado en:** F3-10 (cableado de PDFs al consultorio activo)
**Estado:** Aceptado — NO refactorizar

**Contexto:**
`ModalDocumentos.regenerarYSubirPdf` (src/components/ui/ModalDocumentos.tsx)
solo se invoca para documentos sin pdf_url (legacy/fallidos). Para esos
docs no hay snapshot ni consulta_id, por lo que el único origen disponible
es `profiles.direccion_consultorio` / `profiles.telefono_consultorio`
(campos legacy).

**Por qué NO se cablea al consultorio activo:**
- Regenerar un PDF viejo con datos del consultorio activo de HOY falsearía
  el lugar de emisión histórico (riesgo legal NOM-004).
- Los docs sin pdf_url son anteriores a F3-10 → no tienen relación con el
  multiconsultorio actual.
- La reimpresión normal sirve los bytes congelados (inmutable), no usa esta
  función.

**Decisión:**
Mantener regenerarYSubirPdf leyendo del legacy. NO eliminar
profiles.direccion_consultorio / telefono_consultorio.

**Consecuencia conocida:**
Si un médico regenera un doc viejo y nunca configuró los campos legacy
en /perfil, el PDF saldrá sin dir/tel. Aceptable: docs viejos son
inherentemente best-effort.

---

## Dependencias / Entorno

### DEP-DT-1 — Vulnerabilidades de dependencias npm (npm audit)

**Detectado:** 2026-07-06, durante verificación de entorno (npm ci tras actualización de node a v24.15.0).

**Estado:** `npm ci` reporta 32 vulnerabilidades (1 baja, 23 moderadas, 8 altas) en el árbol de dependencias. La instalación es limpia y coincide con producción (Vercel usa npm ci desde el mismo lock); las vulnerabilidades están en dependencias transitivas, no en dependencias directas declaradas.

**Regla crítica:** NO ejecutar `npm audit fix --force`. Reescribe package-lock.json y puede cambiar versiones de paquetes rompiendo compatibilidad (Next 16 / React 19 / stack actual). Cualquier corrección debe hacerse revisando cada vulnerabilidad individualmente, validando que la versión objetivo es compatible, y probando build + smoke antes de commitear.

**Warnings de deprecación conocidos (transitivos, no accionables directamente):** inflight@1.0.6, lodash.get@4.4.2, glob@7.2.3, dommatrix@1.0.3, node-domexception@1.0.0. Dependen de que los mantenedores de las librerías padre los actualicen.

**Acción pendiente (proyecto aparte, NO bloquea billing):** correr `npm audit` (sin fix) para inventariar las 8 vulnerabilidades altas, determinar cuáles afectan runtime de producción vs. dev/build únicamente, y decidir mitigaciones caso por caso. Sesión dedicada, fuera del proyecto de cierre de fugas de billing Stripe.

---

## Billing — Cierre de fugas Stripe

### BILL-DT-1 — Limpieza programada de stripe_webhook_events (idempotencia)

**Detectado:** 2026-07-13, durante diseño de Deploy 3 (Fase 4 idempotencia).

**Estado:** 🔴 abierta (sin urgencia — años de margen).

**Contexto:** La tabla `stripe_webhook_events` (creada en Deploy 3, migración
`20260713_billing_01`) registra un row por cada evento de Stripe procesado,
para dedup at-least-once. NO se depura sola: crece indefinidamente (1 fila por
evento).

**Impacto:** Nulo a corto/mediano plazo. Filas diminutas (`event_id` text PK +
`type` + timestamp), lookup por PK; Postgres maneja millones de filas sin
degradación. Se está a años de que importe. NO es urgente.

**Acción pendiente (proyecto aparte, NO bloquea nada):** cuando el volumen
crezca o al cerrar el proyecto de billing, agregar limpieza programada. Stripe
no reentrega eventos pasados ~3 días, así que filas viejas no tienen valor
funcional. Sugerido: job vía `pg_cron` o función programada de Supabase con
margen generoso para conservar valor de auditoría:

```sql
DELETE FROM public.stripe_webhook_events WHERE processed_at < now() - interval '90 days';
```

Aislado; no toca el webhook ni la lógica de billing.

---

### BILL-DT-2 — Handler super-admin de VIP no normaliza `suscripcion_estado`

**Detectado:** 2026-07-13, en el Paso 0 (diagnóstico) del Proyecto 1 de billing.
Confirmado como **causa raíz del drift** de las 4 clínicas reconciliadas el
2026-07-18.

**Estado:** 🔴 abierta (sin urgencia — el drift histórico ya fue reconciliado).

**Contexto:** El handler super-admin que activa/revoca el acceso VIP de una
clínica manipula `es_vip_grant`, pero **no normaliza `suscripcion_estado`**:

- **Al activar VIP** marca `suscripcion_estado = 'activo'` indebidamente. Ese
  valor es mentira: la clínica no tiene suscripción Stripe, tiene un grant.
- **Al revocar VIP** no revierte el estado, dejándolo colgado en `'activo'` sin
  vínculo Stripe alguno.

Esto produjo el drift cosmético de 4 clínicas (Star Médica —ex-VIP revocado— y
el grupo VIP Playamed / Urrea / Arámbula) detectado en el Paso 0. **Ese drift ya
se reconciló el 2026-07-18** (UPDATE `'activo'` → `'free'`); lo que queda abierto
es la **causa**, que volverá a generar drift en la próxima activación o
revocación de VIP.

**Impacto:** cosmético hoy. El acceso VIP real nunca dependió de
`suscripcion_estado` sino de `es_vip_grant`, y el bloqueo depende del latch
`ha_tenido_acceso_premium`; por eso el drift no causó fuga de acceso ni de
capital. Pero ensucia el censo, confunde cualquier diagnóstico futuro de billing
y obliga a reconciliar a mano cada vez.

**Fix correcto:** que el acceso VIP dependa **únicamente de `es_vip_grant`**, sin
tocar `suscripcion_estado` en ningún sentido. El handler super-admin debe dejar
`suscripcion_estado` bajo control exclusivo del webhook de Stripe
(`customer.subscription.*` como escritor único, decisión de diseño del Deploy 2).
Al activar o revocar VIP, `suscripcion_estado` no debe modificarse.

**Cuándo atacar:** antes de la próxima activación o revocación de VIP, o en una
sesión dedicada al handler super-admin. Fuera del alcance del Proyecto 1 de
billing (así estaba declarado en `BILLING_FIX_PLAN.md`, sección "Problemas fuera
de alcance").

---

### BILL-DT-3 — Rechazo de RLS (`42501`) no se traduce a `403` limpio en rutas de INSERT

**Detectado:** Proyecto 1 de billing (2026-07), al revisar el comportamiento de
las 7 policies RESTRICTIVE `*_gates_insert`.

**Estado:** 🔴 abierta (UX / higiene de errores, sin implicación de seguridad).

**Contexto:** Cuando una clínica sin acceso intenta un INSERT sobre una tabla
protegida (`pacientes`, `consultas`, `documentos`, `appointments`, `addendums`,
`mediciones_analitos`, `consultorios`), Postgres rechaza con el código
**`42501` (insufficient privilege)**. Ese error sube crudo por la pila: el
usuario no recibe un `403` con un mensaje comprensible, sino un fallo genérico
o un código técnico.

**Impacto:** el bloqueo **funciona correctamente** — la barrera no tiene fuga.
Lo que falla es la explicación: el médico ve un error opaco en vez de "tu
suscripción no permite esta acción". Agravado en los formularios que insertan
directo a Supabase sin pasar por un endpoint API, donde no hay capa server-side
que pueda interceptar y traducir.

**Fix pendiente:** interceptar el código `42501` en las rutas de INSERT (y en el
wrapper del cliente Supabase para los formularios directos) y responder `403`
con un mensaje legible. Debe distinguirse de otros rechazos de RLS que no sean
por suscripción.

**Mitigación actual:** `SuscripcionBanner` ya avisa al usuario del estado de su
suscripción antes de que intente la acción, por lo que el error opaco rara vez
es la primera señal que recibe.

**Cuándo atacar:** sin urgencia. Agrupable con el sub-proyecto "limpieza de
mensajes de error en frontend" (ver E5-DT-1).

---

### BILL-DT-4 — Predicado UX de `subscription.ts` divergente de la RLS real

**Detectado:** 2026-07-18, durante el Deploy 4 (Fase 6 reducida) del Proyecto 1
de billing.

**Estado:** 🔴 abierta (higiene de código, **baja prioridad**, sin fuga).

**Contexto:** Existen dos predicados distintos que deciden "esta clínica está
bloqueada", y **no coinciden**:

- **RLS (barrera real, en producción):** `public.clinica_tiene_acceso()` —
  basado en el latch `clinicas.ha_tenido_acceso_premium`, más `es_vip_grant` y
  `suscripcion_estado = 'activo'`.
- **UX (`src/lib/subscription.ts`):** `isBlocked = suscripcion_estado ===
  'cancelado' && !es_vip_grant && count_pacientes > 5`.

**Impacto:** ninguno en seguridad — la barrera que efectivamente bloquea es la
RLS, y funciona. La divergencia solo puede producir un caso donde la UI no
anticipe un bloqueo que la RLS sí aplicará (o al revés). **El banner
`SuscripcionBanner` ya cubre el aviso al usuario**, que era la razón original
por la que se quería alinear el predicado; por eso la Fase 6 se redujo
deliberadamente y esto quedó como deuda en vez de ejecutarse.

**Fix pendiente:** alinear el predicado UX con `clinica_tiene_acceso()`, o
—preferible— hacer que la UI consulte el veredicto real en vez de reimplementarlo.

**⚠️ Advertencia:** `CLAUDE.md` advierte explícitamente que estos dos predicados
**no deben "unificarse" sin un plan explícito**, porque cambiar uno para que
coincida con el otro **altera quién queda bloqueado en producción**. Cualquier
intervención aquí requiere censo previo de a quién afecta el cambio.

**Cuándo atacar:** sin urgencia. Solo si la divergencia empieza a producir
confusión real en usuarios.

---

### BILL-DT-5 — Verificar suscripción a eventos `invoice.*` en el Dashboard de Stripe

**Detectado:** Paso 0.b del Proyecto 1 de billing (2026-07).

**Estado:** 🟡 **acción de verificación pendiente** (no es deuda de código).

**Contexto:** El Paso 0.b estableció que los eventos
**`invoice.payment_failed`** e **`invoice.payment_succeeded`** debían suscribirse
en el endpoint del webhook **después** de que los Deploys 1 y 2 estuvieran en
producción — el orden importaba porque antes del Deploy 2 los handlers de
`invoice.*` todavía escribían `suscripcion_estado` y habrían agravado el drift.

**Ambos deploys ya están en producción**, por lo que la precondición se cumple.

**Acción pendiente:** entrar al Dashboard de Stripe → configuración del endpoint
del webhook → **confirmar si `invoice.payment_failed` e
`invoice.payment_succeeded` ya están suscritos**. Si no lo están, suscribirlos.

**Nota:** tras el Deploy 2, `invoice.*` **ya no escribe `suscripcion_estado`**
(single-writer: solo `customer.subscription.*`). Suscribir estos eventos es
seguro y aporta observabilidad del ciclo de cobro, no riesgo de drift.

**Cuándo atacar:** en cualquier momento. Es una verificación de 2 minutos en el
Dashboard, fuera del repo.

---

### AUD-3.A — Carrera de creación de customers duplicados

**Detectado:** auditoría read-only inicial del Proyecto 1 (hallazgo **3.A** del
handoff original). **Reclasificado a deuda por decisión de Angel el 2026-07-19**,
con el scope original a la vista.

**Estado:** 🟡 abierta — **riesgo NO materializado**.

**Ubicación:** `src/app/api/stripe/checkout/route.ts:57-68`.

**Contexto:** dos requests concurrentes de checkout de la **misma clínica**
pueden crear **dos `stripe_customer_id`** distintos, porque la creación del
customer no es idempotente: entre el "¿ya existe?" y el "créalo" hay ventana.

**Verificado en producción** (SELECT 5.b.1 del Paso 0): **cero duplicados
actuales**. Además, el constraint `UNIQUE` sobre `clinicas.stripe_customer_id`
**contiene el peor caso** — la segunda escritura falla en vez de dejar la clínica
con dos customers vinculados.

**Criterio de diferimiento:** carrera de baja probabilidad, sin casos reales
observados, y contenida por el `UNIQUE`. Reabrir el flujo de checkout de un
webhook **recién estabilizado** tiene peor relación riesgo/beneficio que diferir.
No es omisión: es una decisión informada.

**Fix pendiente:** creación **idempotente** del customer — buscar por
`metadata.clinica_id` antes de crear, o usar una **idempotency key** de Stripe
derivada del `clinica_id`.

**Trigger para atacar:** el **primer customer duplicado real** detectado en
Stripe, **O** la siguiente vez que se toque `checkout/route.ts` por cualquier
motivo (aprovechar que el archivo ya está abierto y bajo prueba).

---

### AUD-PAR — Handler `invoice.payment_action_required` ausente

**Detectado:** handoff original del Proyecto 1 (era parte del **"Paso 6"**).
**Reclasificado a deuda por decisión de Angel el 2026-07-19.**

**Estado:** 🟡 abierta — **mitigado**.

**Contexto:** el webhook **no maneja** `invoice.payment_action_required`, el
evento que Stripe emite cuando un cobro requiere **acción del cliente** (típicamente
autenticación **SCA / 3DS**). El evento tampoco está suscrito en el Dashboard de
Stripe.

**Mitigación actual:** el **correo de "pago fallido"** de Stripe y la **página
alojada de actualización de método de pago** (ambos activados el 2026-07-18/19,
ver `BILLING_PROYECTO1_CIERRE.md` §6) ya cubren tanto el **aviso** al cliente
como la **ruta de resolución**, sin necesidad de un handler propio en el webhook.

**Criterio de diferimiento:** mitigado por infraestructura ya activa, y poco
común en el escenario real del producto (pago con tarjeta síncrono en México).
Decisión informada, no omisión.

**Fix pendiente:** si se decide, agregar el handler en el webhook **y** suscribir
el evento en el Dashboard de Stripe. Ambas cosas, o ninguna: un handler sin
suscripción es código muerto.

**Trigger para atacar:** el **primer `past_due` causado por SCA** detectado en
los logs de Vercel.

---

## Funnel de nota — Fase A

Deuda detectada durante el rediseño del funnel de nota
(`/expediente/[id]/nueva-nota`), Fase A (pasos 1.1 → 3.3). Registrada en el
sub-paso 3.3b (2026-07-26), después de que 3.3a moviera líneas en `page.tsx`,
`globals.css` y `spinus-tokens.css`: todas las referencias de abajo están
verificadas contra el árbol posterior a esa limpieza.

**La numeración FN-DT-N es fija.** `FN-DT-20` está citado desde
`src/app/spinus-tokens.css:229-231`; no reasignar números al reordenar.

> **Lee esto antes de atacar FN-DT-7 … FN-DT-16.** Las diez son síntomas de una
> misma raíz, no diez bugs independientes: el modo oscuro se implementa en
> `src/components/layout/ThemeProvider.tsx` **cazando clases de Tailwind** —
> ~76 reglas `html.dark .clase { … !important }` inyectadas en un `<style>`
> (:97-229). Todo lo que no sea exactamente una clase se le escapa: estilos
> inline, valores arbitrarios (`bg-white/95`), hex propios (`#EF5350`),
> selectores compuestos que no matchean ningún elemento real, y clases de
> Tailwind que nadie se acordó de listar. Arreglarlas una por una añade más
> reglas al mismo montón y multiplica los conflictos de FN-DT-9. El arreglo
> estructural es migrar el dark a tokens —como ya hizo el paso 3.2.C0 con el
> bloque `html.dark` de `spinus-tokens.css`— y adelgazar `ThemeProvider` hasta
> dejarlo solo con el color de perfil (`--cp`/`--cs`). **Atacar en bloque, no en
> goteo.**

### FN-DT-1 — `consultas.medicamentos`: la DB guarda `null`, el tipo no lo admite
- **Estado:** 🔴 abierta
- **Detectada:** Funnel de nota, Fase A (2026-07-26)
- **Archivos afectados:**
  - src/types/index.ts:79 (`medicamentos?: MedicamentoConsulta[]`)
  - src/app/(app)/expediente/[id]/nueva-nota/page.tsx:700 (escritura)
- **Descripción:** `Consulta.medicamentos` está tipado como opcional pero **no
  anulable**. El funnel escribe explícitamente `null` cuando no hay
  medicamentos: `medicamentos: medsConDatos.length ? medsConDatos : null`
  (page.tsx:700). Es decir, la columna jsonb tiene tres estados reales
  (ausente, `null`, array) y el tipo solo declara dos. Fusiona dos ítems del
  plan que eran el mismo problema visto desde los dos lados: "normalizar
  `null`/`[]`" y "verificar `types/index.ts`".
- **Impacto:** latente. TypeScript no lo atrapa porque las filas llegan de
  Supabase con tipado laxo y nadie asigna la fila cruda al tipo; el guard
  `?.`/truthy que usan los consumidores actuales funciona igual con `null` que
  con `undefined`. El riesgo aparece cuando alguien escriba
  `consulta.medicamentos.map(...)` confiando en el tipo, o cuando se generen
  tipos con `supabase gen types` y las dos definiciones diverjan.
- **Origen:** el shape lo fijó el formulario de nueva-nota; el tipo se escribió
  después, mirando el formulario y no la columna.
- **Fix:** decidir UNA forma canónica y aplicarla en los dos extremos. Opción
  preferida: normalizar a `[]` en la API (`/api/consultas`) y migración que
  convierta los `null` existentes; alternativa barata: cambiar el tipo a
  `medicamentos?: MedicamentoConsulta[] | null` y dejar la DB como está.
- **Cuándo atacar:** antes de generar tipos de Supabase o de escribir cualquier
  lector nuevo de `consultas.medicamentos`.

### FN-DT-2 — `RecetaForm` no reacciona a cambios de `medicamentosIniciales`
- **Estado:** 🔴 abierta
- **Detectada:** Funnel de nota, Fase A (2026-07-26)
- **Archivos afectados:**
  - src/components/documentos/RecetaForm.tsx:201-207
  - src/app/(app)/expediente/[id]/nueva-nota/page.tsx:786-795 (`medicamentosParaReceta`)
- **Descripción:** `medInicial` se calcula en el cuerpo del componente
  (RecetaForm.tsx:201-204) y se pasa como **valor inicial** de
  `useState(medInicial)` (:206) y de `sugerenciasDosis` (:207). React ignora el
  valor inicial en todos los renders posteriores al montaje: si la prop
  `medicamentosIniciales` cambia con el formulario montado, la lista no se
  entera. No hay ningún `useEffect` que sincronice (los `setMedicamentos` de
  :213-227 son todos de interacción del usuario).
- **Impacto:** hoy no se materializa. En el funnel la receta se abre desde el
  Estado Éxito o desde el panel de documentos, con la nota ya guardada y los
  medicamentos congelados; y cada apertura monta el form de cero. Es una trampa
  para el futuro: cualquier flujo que edite medicamentos con la receta abierta
  —incluido el fix de FN-DT-19— mostrará datos viejos sin avisar.
- **Origen:** patrón "props como estado inicial", común en el resto de los
  formularios de documentos.
- **Fix:** `useEffect` que resincronice cuando cambie la prop, o forzar remount
  con `key={...}` desde el llamador. La segunda es una línea y no toca el form.
- **Cuándo atacar:** junto con FN-DT-19, que es lo que lo va a despertar.

### FN-DT-3 — `env(safe-area-inset-*)` sin `viewport-fit=cover`: resuelve a 0 en iOS
- **Estado:** 🔴 abierta
- **Detectada:** Funnel de nota, Fase A (2026-07-26)
- **Archivos afectados:**
  - src/app/layout.tsx (sin `export const viewport`; :13 declara
    `apple-mobile-web-app-status-bar-style: black-translucent`)
  - src/components/ui/ModalShell.tsx:117 (panel fullscreen móvil)
- **Descripción:** `env(safe-area-inset-*)` solo devuelve valores distintos de
  cero si el viewport declara `viewport-fit=cover`. `src/app/layout.tsx` no
  exporta `viewport` ni emite esa meta, así que cualquier `env(...)` del repo
  vale 0 en iOS. Y sí importa: `:13` pide barra de estado translúcida, que es
  justo lo que mete el contenido debajo del notch y del home indicator en modo
  standalone.
- **Impacto:** hoy **cero consumidores**: la única regla que usaba
  `env(safe-area-inset-bottom)` era el `.sp-modal__footer` móvil de la sección
  `6. MODAL` de `spinus-tokens.css`, borrada en 3.3a junto con el resto del
  bloque muerto (`grep -rn "safe-area" src/ public/` no devuelve nada). Queda
  como deuda latente: el modal del funnel es fullscreen en móvil
  (`max-md:h-dvh`, ModalShell.tsx:117) y su footer no reserva el home
  indicator, así que el primer intento de arreglarlo con `env()` fallará en
  silencio y parecerá un bug de CSS.
- **Origen:** el `layout.tsx` es anterior a la API `viewport` de Next; nunca se
  migró.
- **Fix:** `export const viewport: Viewport = { viewportFit: 'cover' }` en
  `src/app/layout.tsx` (API de Next 16 — **verificar en
  `node_modules/next/dist/docs/` antes de escribirlo**), y recién entonces
  añadir `padding-bottom: max(Npx, env(safe-area-inset-bottom))` donde toque.
- **Cuándo atacar:** cuando se retome el pulido móvil del modal, o al primer
  reporte de botón tapado por el home indicator.

### FN-DT-4 — `secureStorage` traga la cuota en silencio y el chip "Borrador guardado" miente
- **Estado:** 🔴 abierta
- **Detectada:** Funnel de nota, Fase A (2026-07-26)
- **Archivos afectados:**
  - src/lib/secureStorage.ts:60-95 (`set`)
  - src/app/(app)/expediente/[id]/nueva-nota/page.tsx:344-346, :1465-1470
- **Descripción:** `secureStorage.set()` envuelve el `localStorage.setItem` de
  la rama cifrada en un `try` (:89) cuyo `catch` (:90-92) intenta el fallback
  sin cifrar dentro de **otro `catch {}` vacío**. Un `QuotaExceededError` —o
  cualquier fallo de escritura— se traga entero y la promesa resuelve como si
  todo hubiera ido bien. El autosave del funnel encadena
  `.then(() => setUltimoGuardado(new Date()))` (page.tsx:345), así que el chip
  verde "Borrador guardado" (:1465-1470) se enciende sin que exista borrador.
- **Impacto:** el médico cree tener red de seguridad y no la tiene. Si el
  navegador está al límite de cuota (varios pacientes con borradores, PWA con
  caché llena), un cierre accidental de pestaña pierde la nota completa
  mostrando "Borrador guardado" hasta el último segundo. Baja frecuencia, alto
  costo cuando pasa.
- **Origen:** los `catch {}` son deliberados (evitar que un fallo de
  `localStorage` tumbe la app); lo que falta es propagar el resultado.
- **Fix:** que `set()` devuelva `Promise<boolean>` (o rechace) y que el
  llamador solo encienda el chip si fue verdad; en el fallo, mostrar aviso.
  ~10 líneas entre los dos archivos.
- **Cuándo atacar:** prioridad media-alta — es el único ítem de esta tanda con
  pérdida de datos clínicos como resultado posible.

### FN-DT-5 — `ModalShell` sin focus trap
- **Estado:** 🔴 abierta
- **Detectada:** Funnel de nota, Fase A (2026-07-26). Deuda preexistente,
  registrada antes en `CLAUDE.md`.
- **Archivo afectado:** src/components/ui/ModalShell.tsx:71-89
- **Descripción:** el modal maneja `Escape` con un listener global (:81-89) y
  el scroll-lock, pero **no gestiona el foco**: no lo mueve al panel al abrir,
  no atrapa el `Tab` dentro del diálogo (se escapa a la página de atrás, bajo
  el backdrop) y no lo restaura al elemento que abrió el modal al cerrar.
- **Impacto:** accesibilidad (WCAG 2.4.3 / patrón `dialog` de ARIA). Afecta a
  los **16 consumidores** de `ModalShell`, incluido el funnel de nota completo,
  donde el modal es la superficie principal de trabajo. Sin impacto para el
  usuario de ratón.
- **⚠️ DUPLICADA:** esta entrada y el ítem 2 de `CLAUDE.md`
  §"Deuda técnica conocida" ("`ModalShell` sin focus trap") son la misma deuda.
  **Al cerrarla hay que borrar las dos**, no solo esta.
- **Fix:** focus trap estándar (primer elemento enfocable al abrir, ciclo de
  `Tab`/`Shift+Tab` acotado al panel, restauración al cerrar) + `role="dialog"`
  y `aria-modal="true"`. Un solo archivo.
- **Cuándo atacar:** cuando haya auditoría de accesibilidad formal, o antes si
  entra un requisito de a11y por contrato.

### FN-DT-6 — Catálogo `cat_cie10` incompleto degrada el autocomplete de la vía manual
- **Estado:** 🔴 abierta
- **Detectada:** Funnel de nota, Fase A — QA de la vía manual (2026-07-26)
- **Archivos afectados:**
  - src/app/api/cie10/route.ts:26-31 (query a `cat_cie10`)
  - src/components/ui/CIE10Combobox.tsx:56 (consumidor)
  - src/components/documentos/DiagnosticosEditor.tsx:4 (lo monta la vía manual)
- **Descripción:** el endpoint busca por código o descripción con `ilike` y
  `.limit(15)` sobre `cat_cie10`. **El código es correcto**: la deuda es de
  datos — la tabla no tiene el catálogo CIE-10 completo, así que diagnósticos
  frecuentes no aparecen al teclear y el médico termina escribiendo la
  descripción libre sin código.
- **Impacto:** notas guardadas sin CIE-10 donde sí había código aplicable.
  Afecta a la calidad del expediente y a cualquier explotación estadística
  futura. No bloquea: el editor acepta diagnóstico sin código a propósito.
- **Origen:** la tabla se sembró parcialmente; nunca se cargó el catálogo
  oficial completo.
- **Fix:** cargar el catálogo CIE-10 completo (fuente oficial de la SSA) en
  `cat_cie10` vía migración de datos. Revisar de paso si conviene índice
  `pg_trgm`/`unaccent` para que el `ilike` escale (ver E5-DT-23, que ya apunta
  a `unaccent` instalada pero no cableada).
- **Cuándo atacar:** independiente del funnel; es carga de datos + un índice.

### FN-DT-7 — 🔴 BUG VIVO: 15 de 16 modales con panel casi blanco en modo oscuro
- **Estado:** 🔴 **abierta — bug de producción, no deuda latente**
- **Detectada:** Funnel de nota, Fase A (2026-07-26)
- **Archivos afectados:**
  - src/components/layout/ThemeProvider.tsx:117 (`html.dark .bg-white`)
  - src/components/ui/ModalShell.tsx:117 (clase del panel)
  - src/app/(app)/expediente/[id]/nueva-nota/page.tsx:913 (único que pasa `spinusGeometry`)
- **Descripción:** la regla de superficie del modo oscuro es
  `html.dark .bg-white { background-color: #1E1E1E !important }`
  (ThemeProvider:117) — matchea la clase `bg-white` **exacta**. El panel de
  `ModalShell` usa
  `${geo ? 'bg-white' : 'bg-white/95 backdrop-blur-xl'}` (:117): con geometría
  del sistema aplica `bg-white` y se oscurece; sin ella aplica `bg-white/95`,
  que es **otra clase** y no matchea nada. `geo` solo es no-nulo cuando el
  llamador pasa `spinusGeometry`, y el único que lo hace es el funnel de nota
  (page.tsx:913).
- **Impacto:** **de los 16 consumidores de `ModalShell`, 15 abren en modo
  oscuro un panel blanco al 95%** sobre el backdrop. No es un matiz estético:
  es un flash de pantalla blanca en una app que un médico usa de noche y en
  quirófano. Está en producción hoy.
- **Origen:** el `bg-white/95 backdrop-blur-xl` es el chrome legacy del modal
  (efecto vidrio); la regla dark de ThemeProvider se escribió para `bg-white` a
  secas y nadie cruzó las dos.
- **Fix inmediato (una línea, seguro):** añadir
  `html.dark .bg-white\\/95 { background-color: #1E1E1E !important }` a
  ThemeProvider. **Fix correcto:** que el panel legacy también use la superficie
  tokenizada (`var(--sp-surface)`), que ya resuelve claro y oscuro.
- **Cuándo atacar:** **ya.** Es el único ítem de esta sección que no puede
  esperar al proyecto de tokenización del dark.

### FN-DT-8 — Regla de backdrop de ThemeProvider que no matchea ningún selector real
- **Estado:** 🔴 abierta
- **Detectada:** Funnel de nota, Fase A (2026-07-26)
- **Archivo afectado:** src/components/layout/ThemeProvider.tsx:222-223
- **Descripción:** la única regla dark de la sección "Modales" es
  `html.dark .fixed.inset-0.bg-black\/50 { background-color: rgba(0,0,0,0.8) }`
  — un selector compuesto que exige las tres clases en el mismo elemento. Los
  backdrops reales usan otra cosa: `bg-black/40` en `ModalShell.tsx:113` (rama
  legacy), en el portal de documentos del funnel (`page.tsx:1855`) y en ~8
  sitios más; los dos `bg-black/50` de la app
  (`agenda/page.tsx:363`, `QuickPatientModal.tsx:171`) son `absolute`, no
  `.fixed`, así que tampoco entran.
- **Matiz verificado:** dentro del árbol de `ThemeProvider`
  (`(app)/layout.tsx:41`) el selector sí alcanza **exactamente un** elemento:
  el overlay de `OfflineAlert.tsx:48`, que no es el backdrop de un modal. Los
  otros dos `.fixed…bg-black/50` del repo viven en `(offline)/offline-mode`,
  fuera del provider. Neto: la regla existe para los modales y no llega a
  ninguno.
- **Impacto:** cosmético. Los backdrops quedan al 40% de negro en oscuro en vez
  del 80% previsto, así que el fondo se transparenta más de la cuenta. El
  funnel no lo sufre: su backdrop usa `var(--sp-backdrop)` (ModalShell:113),
  que sí tiene override dark en `spinus-tokens.css:276`.
- **Origen:** la regla se escribió contra un markup que después cambió de
  opacidad y de posicionamiento.
- **Fix:** dentro del proyecto de tokenización, borrar la regla y llevar todos
  los backdrops a `var(--sp-backdrop)` — que es el patrón que el funnel ya
  demostró que funciona.
- **Cuándo atacar:** con el bloque FN-DT-7…16.

### FN-DT-9 — Selectores duplicados en ThemeProvider, con valores en conflicto
- **Estado:** 🔴 abierta
- **Detectada:** Funnel de nota, Fase A (2026-07-26)
- **Archivo afectado:** src/components/layout/ThemeProvider.tsx:146-154, :215-220
- **Descripción:** tres selectores están declarados dos veces en el mismo
  `<style>`, en bloques distintos ("Colores primarios desaturados" y "Texto de
  badges"), y en dos de los tres los valores **no coinciden**:

  | Selector | 1.ª declaración | 2.ª declaración | Gana |
  |---|---|---|---|
  | `.text-blue-600` | `#60a5fa` (:154) | `#93c5fd` (:215) | la 2.ª |
  | `.text-amber-700` | `#fbbf24` (:153) | `#fcd34d` (:219) | la 2.ª |
  | `.text-[#1a3a5c]` | `#93c5fd` (:148) | `#93c5fd` (:216) | empate (duplicado inerte) |

  Misma especificidad y mismo `!important`, así que decide el orden: siempre
  gana la segunda.
- **Impacto:** ninguno visual hoy (el resultado es determinista), pero es una
  trampa de mantenimiento: quien edite :153-154 para ajustar un color no verá
  ningún cambio y perderá el rato buscando por qué.
- **Origen:** el bloque de badges (:204-220) se añadió después sin revisar si
  los selectores ya existían arriba.
- **Fix:** dejar una sola declaración por selector. Trivial, pero hacerlo
  dentro del proyecto de tokenización para no tocar el archivo dos veces.
- **Cuándo atacar:** con el bloque FN-DT-7…16.

### FN-DT-10 — Tinta `.38` (hint/placeholder) falla AA en modo oscuro
- **Estado:** 🔴 abierta
- **Detectada:** Funnel de nota, Fase A (2026-07-26)
- **Archivo afectado:** src/components/layout/ThemeProvider.tsx:141, :164-165
- **Descripción:** el modo oscuro mapea `.text-slate-400` a
  `rgba(255,255,255,0.38)` (:141) y pinta **todos** los placeholders nativos con
  el mismo valor (:164-165, con `!important`). Compuesto sobre la superficie de
  card `#1E1E1E` eso equivale a `#737373`: **≈3.5:1**. Sobre el fondo de input
  `#242424`, **≈3.4:1**. WCAG AA para texto normal pide 4.5:1.
- **Impacto:** falla de contraste en toda la app en modo oscuro, no solo en el
  funnel — `.text-slate-400` es la clase de hints, unidades y textos de apoyo,
  y los placeholders son la guía de captura de cada formulario. El `.38` viene
  de la escala de Material para texto **desactivado**, que no es lo mismo que
  texto secundario.
- **Origen:** copia literal de la tabla de Material Design Dark Theme
  documentada en el comentario :97-107, aplicada a un rol que no le
  correspondía.
- **Fix:** subir a `0.50-0.60` (Material usa `.60` para texto secundario), o
  mejor: borrar la regla y dejar que el hint lo resuelva `--sp-ink-*` del
  bloque `html.dark` de `spinus-tokens.css`, que ya está calibrado.
- **Cuándo atacar:** con el bloque FN-DT-7…16.

### FN-DT-11 — El foco en oscuro pierde el color de borde (ThemeProvider gana a `.sp-input:focus`)
- **Estado:** 🔴 abierta
- **Detectada:** Funnel de nota, Fase A (2026-07-26)
- **Archivos afectados:**
  - src/components/layout/ThemeProvider.tsx:157-163
  - src/app/spinus-tokens.css:594-598 (`.sp-input:focus, .sp-textarea:focus`)
  - src/components/expediente/SignosVitalesCard.tsx:98-108 (precedente del fix)
- **Descripción:** ThemeProvider pinta en oscuro **todos** los `input`,
  `textarea` y `select` con `border-color: rgba(255,255,255,0.12) !important`
  (:157-163). `.sp-input:focus` declara `border-color: var(--sp-primary)` sin
  `!important` y dentro de `@layer components`, que pierde contra cualquier
  declaración de autor sin capa. Resultado: al enfocar un campo en oscuro
  sobrevive el halo (`box-shadow`, que ThemeProvider no toca) pero el borde se
  queda gris.
- **Impacto:** el foco se señala a medias en modo oscuro, en todos los campos
  del funnel y de la app. Afecta a usabilidad y a navegación por teclado —
  emparentado con FN-DT-5.
- **Origen:** `spinus-tokens.css` se instaló en `@layer components` a propósito
  (paso 3.2.B) para no pelear con Tailwind; ThemeProvider inyecta sin capa, así
  que gana siempre.
- **Fix:** ya hay precedente resuelto en el repo:
  `SignosVitalesCard.tsx:98-108` documenta este mismo choque y lo gana subiendo
  especificidad con selectores de atributo (`[data-k]`, `[data-estado]`), sin
  trucos de orden de capas. Replicar, o eliminar la regla de ThemeProvider al
  tokenizar el dark.
- **Cuándo atacar:** con el bloque FN-DT-7…16.

### FN-DT-12 — Bordes y textos de los tiles de documentos sin regla dark
- **Estado:** 🔴 abierta
- **Detectada:** Funnel de nota, Fase A (2026-07-26)
- **Archivos afectados:**
  - src/app/(app)/expediente/[id]/nueva-nota/page.tsx:71-79 (`DOCS`), :1801-1808 (render)
  - src/components/layout/ThemeProvider.tsx:192-219
- **Descripción:** cada tile de documento lleva la tripleta
  `border-<color>-200 bg-<color>-50 text-<color>-700` (page.tsx:72-79).
  ThemeProvider cubre los 11 fondos `bg-*-50` (:192-202), pero de los bordes
  solo `blue`, `emerald`, `red` y `amber` (:205-212) y de los textos solo
  `emerald-700`, `red-700` y `amber-700` (:217-219). Quedan **sin regla dark**:
  `border-violet-200`, `border-rose-200`, `border-teal-200`, `border-indigo-200`,
  `border-orange-200`; y `text-blue-700`, `text-violet-700`, `text-rose-700`,
  `text-teal-700`, `text-indigo-700`, `text-orange-700`.
- **Impacto:** en el Estado de Cierre (`notaSaved`), donde el panel de
  documentos es el protagonista a ancho completo, el tile activo queda con
  borde claro y texto oscuro (p. ej. `text-violet-700` ≈ `#6d28d9`) sobre un
  tinte translúcido oscuro: ilegible. Afecta a 6 de los 8 formatos.
- **Origen:** la lista de badges de ThemeProvider se escribió a mano para los
  colores que existían entonces; `DOCS` creció después.
- **Fix:** parte del proyecto de tokenización — el chrome del panel de
  documentos debería usar `.sp-*` como el resto del Cierre. Parche provisional:
  completar las 11 reglas faltantes.
- **Cuándo atacar:** con el bloque FN-DT-7…16.

### FN-DT-13 — Verde del semáforo de vitales bajo AA en modo claro móvil
- **Estado:** 🔴 abierta
- **Detectada:** Funnel de nota, Fase A (2026-07-26)
- **Archivos afectados:**
  - src/app/spinus-tokens.css:61 (`--sp-vital-ok: #17976a`), :40 (`--sp-success-bg: #e9f7ef`), :351 (override dark)
  - src/components/expediente/SignosVitalesCard.tsx:105, :158, :76, :109-129
- **Descripción:** `--sp-vital-ok` (`#17976a`) hace dos trabajos y falla
  distinto en cada uno:
  - **Valor en rango** (`.sv-input[data-estado="normal"]`, :105) sobre
    `--sp-surface` blanco → **3.70:1**. En desktop el valor es 19px/800 (:89):
    califica como texto grande y AA pide 3:1, así que pasa. En móvil el valor
    baja a **15px** (:124, dentro del `@media (max-width:767px)` :109-129):
    deja de ser texto grande, AA exige 4.5:1 y **falla**.
  - **Badge "Todo en rango"** (:158) a 12px/700 (:76) sobre `--sp-success-bg`
    `#e9f7ef` → **3.35:1**: falla en desktop y en móvil.

  En modo oscuro el token se sobrescribe a `#34d399` (:351), que sobre
  `#121212` da ≈9.7:1 y pasa de sobra. **El defecto es exclusivo del modo
  claro**, y solo del móvil para el valor.
- **Impacto:** agravado por el layout móvil, donde `.sv-dot` se oculta (:115) y
  el color del número queda como **único** portador del estado clínico. Un
  usuario con baja visión o una pantalla al sol pierde la señal de "en rango".
- **Origen:** el verde se eligió mirando el desktop; la reducción tipográfica
  móvil llegó después y cruzó el umbral de "texto grande" sin que nadie
  recalculara.
- **Fix:** oscurecer `--sp-vital-ok` en claro hasta ≥4.5:1 sobre blanco (a la
  altura de `#0f7a55` / `#15803d`) y revisar el par badge/`--sp-success-bg`.
  Verificar de paso `--sp-vital-watch` y `--sp-vital-out` con el mismo método.
- **Cuándo atacar:** con la auditoría de contraste (junto a FN-DT-10 y
  FN-DT-21).

### FN-DT-14 — Alergias sin sustituto tras retirar el Contexto en el Cierre (+ `#EF5350` inline)
- **Estado:** 🔴 abierta
- **Detectada:** Funnel de nota, Fase A — paso 3.2.C5 (2026-07-26)
- **Archivo afectado:** src/app/(app)/expediente/[id]/nueva-nota/page.tsx:1661, :1687-1691
- **Descripción:** dos defectos en el mismo bloque:
  1. **Desaparece cuando más falta hace.** La alerta de alergias vive dentro
     del panel "Contexto del paciente", montado bajo `{!notaSaved && paciente}`
     (:1661). Al guardar la nota, el Cierre (blueprint §5.3) retira el panel
     entero y la alerta se va con él — justo en la pantalla desde la que el
     médico genera la receta. El razonamiento de §5.3 (los formularios se
     prellenan solos) vale para diagnósticos y medicamentos, pero **no** para
     una contraindicación que el médico necesita leer al prescribir.
  2. **Inmune al modo oscuro.** El rojo va inline:
     `style={{ backgroundColor: '#EF5350' }}` (:1688). ThemeProvider solo caza
     clases, así que ninguna regla dark lo alcanza. El mismo hex aparece inline
     en otros 10 puntos del repo, con el mismo problema.
- **Impacto:** seguridad del paciente en el caso 1 (riesgo bajo pero
  consecuencia alta: prescribir sin ver la alergia en pantalla); cosmético en
  el caso 2.
- **Origen:** (1) decisión consciente de §5.3 cuyo alcance se pasó de largo;
  (2) el hex inline precede al sistema de tokens.
- **Fix:** re-emitir la alerta de alergias en el Cierre —una banda compacta
  sobre el panel de documentos, o dentro del CTA de receta— usando
  `var(--sp-danger)`/`var(--sp-danger-bg)` en vez del hex inline.
- **Cuándo atacar:** alta entre las de UX; el sub-fix del hex puede ir con el
  bloque de tokenización.

### FN-DT-15 — `.sp-btn--primary:disabled` sin token ni override dark
- **Estado:** 🔴 abierta
- **Detectada:** Funnel de nota, Fase A (2026-07-26)
- **Archivo afectado:** src/app/spinus-tokens.css:429
- **Descripción:** `.sp-btn--primary:disabled { background: #b6c6da; box-shadow:
  none; cursor: not-allowed; }` — hex literal, sin token declarado en la
  sección de color y **sin ninguna contraparte en el bloque `html.dark`**.
- **Impacto:** en modo oscuro un primario deshabilitado se queda azul-gris
  claro (`#b6c6da`) sobre superficie `#1E1E1E`: parece habilitado y destacado,
  exactamente lo contrario de lo que comunica. Afecta a los CTA principales del
  funnel (page.tsx:1605, :1634) y a los footers del modal, que es donde más
  tiempo pasa un botón deshabilitado (esperando motivo de consulta, esperando
  consultorio activo).
- **Origen:** el gris fijo de disabled es una decisión declarada del sistema
  (paso 3.2), pero se escribió como literal en vez de token, así que C0 no
  tenía dónde sobrescribirlo.
- **Fix:** promoverlo a token (`--sp-btn-disabled-bg` o similar) en la sección
  de color y darle valor dark en el bloque `html.dark`.
- **Cuándo atacar:** con el bloque FN-DT-7…16; es el más barato de todos.

### FN-DT-16 — `DiagnosticosEditor` / `CIE10Combobox` sin tokenizar
- **Estado:** 🔴 abierta
- **Detectada:** Funnel de nota, Fase A — paso 3.2.C4 (2026-07-26)
- **Archivos afectados:**
  - src/components/documentos/DiagnosticosEditor.tsx:67, :79
  - src/components/ui/CIE10Combobox.tsx:128, :134-136, :151, :159, :167-171, :180
- **Descripción:** son el único bloque de la vía manual que no pasó por la
  migración a `.sp-*` de 3.2.C4: siguen con clases crudas
  (`border-slate-200`, `text-slate-400`, `bg-white`, `text-[#1e5fa8]`,
  `focus:ring-[#1e5fa8]/30`). Se quedaron fuera por alcance: C4 reestructuró la
  rejilla SOAP del formulario, no el interior de sus componentes hijos.
- **Impacto:** dependen enteramente de que ThemeProvider siga cazando esas
  clases exactas, con las lagunas que eso implica: `hover:text-slate-900`
  (DiagnosticosEditor:79) no tiene regla dark, y el ítem seleccionado del
  dropdown `bg-[#1e5fa8]/5 text-[#1e5fa8]` (CIE10Combobox:167) tampoco. El
  input del combobox tampoco hereda el foco del sistema, así que arrastra
  FN-DT-11 por su cuenta. Visualmente, el editor de diagnósticos rompe la
  continuidad de la rejilla SOAP que lo rodea.
- **Origen:** alcance deliberado de C4; queda anotado aquí para que no se
  pierda.
- **Fix:** migrar el input a `.sp-input`, el dropdown a superficie/tinta
  tokenizadas y el ítem activo a `--sp-primary-bg`/`--sp-primary-text`. Dos
  archivos, sin cambios de comportamiento.
- **Cuándo atacar:** con el bloque FN-DT-7…16, o cuando se retome la vía
  manual.

### FN-DT-17 — `OnboardingGuide` huérfano (+ botón de `/ayuda` que limpia `spinus_onboarding`)
- **Estado:** 🔴 abierta
- **Detectada:** Funnel de nota, Fase A — paso 3.2-bis (2026-07-26)
- **Archivos afectados:**
  - src/components/ui/OnboardingGuide.tsx (700 líneas, cero importadores)
  - src/app/(app)/ayuda/page.tsx:155-165 (botón), :158 (`removeItem('spinus_onboarding')`)
  - audios del tutorial en `public/`
- **Descripción:** el `OnboardingGuide` fue retirado del producto (decisión del
  plan §3.2-bis: Spinus apuesta por una experiencia autoexplicativa, que es lo
  que el funnel resuelve). Ya no se monta en ningún lado —
  `grep -rn "OnboardingGuide" src/` solo devuelve el propio archivo — pero
  siguen vivos el componente, sus audios y el botón "Volver a ver el tutorial
  paso a paso" de `/ayuda`, que borra `spinus_onboarding` (:158) y recarga la
  página (:159) para que no ocurra absolutamente nada.
- **Impacto:** ~700 líneas de código muerto y **un botón roto en producción**:
  el usuario pide el tutorial, la página se recarga y no aparece nada. Peor que
  no tener el botón.
- **Origen:** el retiro del guide se hizo quitando su montaje, no eliminándolo.
  El paso 3.3a ya purgó las anclas `data-onboard` sin lector
  (`consulta-completa`, `modal-doc-iconos`), **conservando
  `data-onboard="panel-documentos"`** (page.tsx:1777), que tiene consumidor
  vivo en el `querySelector` del Estado Éxito (:1017).
- **Fix:** borrar `OnboardingGuide.tsx`, sus audios de `public/` y el botón de
  `/ayuda:155-165`. Antes de borrar, `grep` de `spinus_onboarding` y de los
  nombres de los audios (protocolo 2 de `CLAUDE.md`). **No tocar
  `panel-documentos`.**
- **Cuándo atacar:** mini-proyecto aparte (toca varios módulos), previsto para
  Fase B.

### FN-DT-18 — Divergencia narrativa ↔ estructurado (edición manual y guard de regeneración)
- **Estado:** 🔴 abierta — limitación conocida, documentada a propósito
- **Detectada:** Funnel de nota, Fase A (2026-07-26)
- **Archivo afectado:** src/app/(app)/expediente/[id]/nueva-nota/page.tsx:1186, :691-700, :208, :1135, :1153
- **Descripción:** en el estado de revisión el médico puede editar la nota a
  mano; el textarea escribe **solo** `notaGenerada` (:1186). El estructurado
  —`form.diagnosticos` y `medicamentos`— se queda como lo dejó la IA. Al
  guardar, el payload envía las dos cosas: diagnósticos (:691-696), narrativa
  (:698) y medicamentos (:700). Si el médico corrige el diagnóstico dentro del
  texto, la consulta queda con una narrativa que dice A y un CIE-10 que dice B,
  y la receta se precarga desde el estructurado viejo. El flag `notaEditada`
  (:208) solo alimenta la advertencia de que regenerar pisará la edición
  (:1135) y el swap de confirmación (:1153): **avisa, no reconcilia.**
- **Impacto:** calidad del expediente. Un dato clínico contradictorio dentro de
  la misma consulta inmutable; el estructurado es lo que alimenta explotación
  estadística y precarga de documentos, así que gana el que el médico no
  editó. Baja frecuencia (requiere editar el texto de un diagnóstico en vez de
  regenerar), consecuencia difícil de detectar después.
- **Origen:** preexistente al funnel — es consecuencia del diseño dual
  narrativa+estructurado de la nota IA, no algo que Fase A introdujera.
- **Fix (opciones, ninguna trivial):** (a) tras editar a mano, marcar el
  estructurado como "posiblemente desalineado" y pedir confirmación explícita
  antes de guardar; (b) re-extraer el estructurado desde la narrativa editada
  con una llamada de IA acotada; (c) bloquear la edición de las secciones que
  espejan el estructurado y obligar a corregirlas en sus campos.
- **Cuándo atacar:** requiere decisión de producto antes que código. No
  abordable dentro del funnel sin ampliar alcance.

### FN-DT-19 — Mejora: precarga de receta desde DB + botón de receta en la vista de consulta
- **Estado:** 🔴 abierta — mejora, no defecto
- **Detectada:** Funnel de nota, Fase A (2026-07-26). Origen:
  `BLUEPRINT_FUNNEL_NOTA.md:272`.
- **Archivos afectados (previstos):**
  - src/app/(app)/expediente/[id]/consulta/[consultaId]/page.tsx
  - src/components/documentos/RecetaForm.tsx (ver FN-DT-2)
- **Descripción:** la precarga de medicamentos en la receta solo existe
  **dentro** del funnel: `medicamentosParaReceta` (page.tsx:786-795) se deriva
  del estado en memoria y muere al salir de la pantalla. Desde la vista de una
  consulta ya guardada no hay botón de receta, y si se llega por otra vía el
  formulario arranca vacío aunque `consultas.medicamentos` tenga los datos.
- **Impacto:** el médico que necesita reimprimir o ajustar la receta de una
  consulta anterior la recaptura a mano. Fricción pura, sin riesgo clínico.
- **Fix:** leer `consultas.medicamentos` de la DB y mapearlo al shape de
  `RecetaForm` (el mismo mapeo de page.tsx:786-795, que ya existe), más un
  botón "Generar receta" en la vista de consulta. **Depende de FN-DT-2**: si el
  formulario se monta con la receta abierta y los datos llegan después, la
  precarga no reaccionará. Y roza FN-DT-1: la columna puede venir `null`.
- **Cuándo atacar:** Fase B, junto con FN-DT-2.

### FN-DT-20 — Geometría del modal duplicada entre `ModalShell` y los tokens
- **Estado:** 🔴 abierta
- **Detectada:** Funnel de nota, Fase A — paso 3.2.B, ampliada en 3.3a (2026-07-26)
- **Archivos afectados:**
  - src/app/spinus-tokens.css:229-237 (tokens + comentario que cita esta deuda)
  - src/app/spinus-tokens.css:142-147 (`--sp-pad-modal-*`)
  - src/components/ui/ModalShell.tsx:16-21 (`SP_GEO`)
- **Descripción:** la geometría del modal del funnel está declarada **dos
  veces**. Los tokens `--sp-modal-w-work|decide|done|wait`, `--sp-modal-top` y
  `--sp-modal-h-max` (spinus-tokens.css:232-237) son la spec canónica pero no
  los consume ningún `.sp-*`; `ModalShell` los espeja con literales de Tailwind
  en `SP_GEO` (`md:max-w-[724px]`, `md:pt-[60px]`,
  `md:max-h-[calc(100vh-120px)]`, ModalShell.tsx:17-20). Cambiar el ancho de un
  estado obliga a editar los dos sitios, y nada avisa si divergen.
- **Añadido en 3.3a:** al borrar la sección muerta `6. MODAL` de
  `spinus-tokens.css` (las clases `.sp-backdrop` / `.sp-modal*`, que ningún
  componente usaba), los **6 custom properties `--sp-pad-modal-*`
  (:142-147) perdieron su único consumidor**. Se conservaron deliberadamente:
  son parte de la misma spec y los consumiría un `ModalShell` cableado a
  tokens. **Cerrar FN-DT-20 debe resolver también su destino** — cablearlos
  junto con la geometría, o borrarlos si se decide que el padding se queda en
  utilidades.
- **Impacto:** ninguno funcional. Riesgo de divergencia silenciosa y una spec
  que miente sobre quién manda.
- **Origen:** 3.2.B implementó la geometría con utilidades de Tailwind (decisión
  correcta entonces: el ancho es responsive y las utilidades lo expresan mejor
  que un `width` fijo) mientras el token file ya traía los valores.
- **Fix:** cablear `SP_GEO` a los tokens (`md:max-w-[var(--sp-modal-w-work)]`
  y equivalentes) y decidir de paso el destino de `--sp-pad-modal-*`. Al
  cerrarla, **borrar el comentario de spinus-tokens.css:229-231**, que cita
  esta entrada por su ID.
- **Cuándo atacar:** cuando se migre el resto de Spinus al sistema de diseño —
  ahí `ModalShell` deja de tener rama legacy y el cableado se vuelve natural.

### FN-DT-21 — Contraste AA de las paletas de clínica (texto blanco sobre `--cs`)
- **Estado:** 🔴 abierta
- **Detectada:** Funnel de nota, Fase A — auditoría de contraste (2026-07-26)
- **Archivos afectados:**
  - src/app/(app)/perfil/page.tsx:42-48 (`PALETAS`)
  - src/components/layout/ThemeProvider.tsx:34-35, :66-69
- **Descripción:** el médico elige la paleta de su clínica desde el perfil; el
  secundario alimenta `--cs` (ThemeProvider:35), que ThemeProvider usa como
  fondo de todos los botones primarios reescribiendo `bg-[#1e5fa8]` (:66). El
  texto de esos botones es blanco. Con la paleta **"Verde médico"**
  (`secundario: '#0d9488'`, perfil/page.tsx:44) el par da **3.74:1**, por
  debajo del 4.5:1 que pide AA para texto normal. No está verificado el resto
  del catálogo (6 paletas).
- **Impacto:** transversal, no del funnel: afecta a cualquier CTA primario de
  cualquier pantalla para los médicos con esa paleta. Es una función de
  personalización que puede llevar al usuario a un estado inaccesible sin
  avisarle.
- **Origen:** las paletas se eligieron por estética de marca; nunca se validó
  el contraste del par botón/texto.
- **Fix:** validar las 7 paletas del catálogo y ajustar los secundarios que no
  lleguen a 4.5:1; o derivar el color del texto del botón por luminancia del
  fondo (blanco o tinta oscura según corresponda), que además blinda paletas
  futuras.
- **Cuándo atacar:** con la auditoría de contraste (junto a FN-DT-10 y
  FN-DT-13). Independiente del proyecto de tokenización del dark.

---

## Modo offline — Desmantelamiento

### OFF-DT-1 — Matar el modo offline definitivamente
- **Estado:** 🟡 en progreso — paso 1 aplicado, resto pendiente.
- **Detectada:** Sesión de desenlace del modo offline (2026-07-29).
- **Archivos afectados (ya modificados en el paso 1):**
  - src/components/layout/Sidebar.tsx
  - src/components/SessionGuard.tsx
  - src/components/ui/OfflineAlert.tsx
  - src/app/login/page.tsx
- **Contexto:** el modo offline no es funcional sin conexión real: estando en
  línea se puede entrar y navegar, pero si de verdad no hay red la aplicación
  no opera. Esto estaba generando incongruencias con los beta testers, que
  llegaban al búnker justo cuando no servía.
- **Lo que ya se hizo (paso 1 — solo desenlazar, sin borrar lógica):**
  - Se eliminó la entrada "Modo Offline" del menú de `navDoctor` en
    `src/components/layout/Sidebar.tsx`, junto con su estado `bunkerReady`, el
    badge del render y el import de `WifiOff`.
  - `SessionGuard.tsx` dejó de redirigir a `/offline-mode` cuando no hay red;
    `UNAUTHENTICATED` ahora va siempre a `/login`.
  - `OfflineAlert.tsx` conserva el aviso de pérdida de red, pero se le quitó el
    botón "Entrar a Modo Offline" y se corrigió el copy que lo mencionaba.
  - Se quitó el link "¿Sin conexión? Entrar al modo de emergencia" de
    `src/app/login/page.tsx`.
  - **Resultado:** ya no queda ningún punto de entrada visible al usuario hacia
    el modo offline.
- **Lo que sigue vivo y pendiente de matar:**
  - Las páginas `/offline-mode` y `/offline-setup` siguen existiendo y son
    accesibles por URL directa.
  - Los bypass de auth de esas dos rutas en `src/middleware.ts:59-60`.
  - Todo el subsistema: service worker, cache, `secureStorage`, el fallback
    offline de `useClinica`, la lógica de detección de red, y las claves de
    localStorage `spinus_session_meta` y `spinus_doctor_profile`.
  - `OfflineAlert` quedó sin ninguna acción de usuario: es un modal full-screen
    no dismissable cuyo único escape es que `navigator.onLine` vuelva a `true`,
    o recargar la página. Si la detección da un falso positivo, el usuario
    queda atrapado hasta recargar. Evaluar al matar el modo offline (opción
    considerada y descartada por ahora: un botón "Reintentar" que solo re-corra
    la detección).
- **Decisión pendiente:** definir si el modo offline se elimina por completo o
  se reimplementa funcionando de verdad. El paso 1 no compromete ninguna de las
  dos vías.

## Landing pública — auditoría de rediseño (julio 2026)

Deuda detectada durante la auditoría y el plan de rediseño de la landing
pública (`src/app/page.tsx`). Transcrita desde la sección 10 de
`PLAN_LANDING_SPINUS.md` (2026-07-28). Ninguno de estos ítems es scope del
rediseño en sí: son consecuencias o hallazgos colaterales del plan.

**Ver también:** `RG-01 · Certificación NOM-024-SSA3-2012 ante DGIS` —
apartado de prioridad máxima al inicio de este archivo, bloqueante de
lanzamiento oficial. Proyecto independiente, no es scope de este plan.

### LP-DT-1 — Réplica HTML/CSS de la receta desfasable respecto al PDF real
- **Estado:** 🔴 abierta
- **Detectada:** Auditoría de landing (2026-07-28)
- **Descripción:** Réplica HTML/CSS de la receta desfasable respecto al PDF
  real.
- **Materializada en F3 (2026-08-02):** la réplica ya existe —
  `src/components/landing/teaser2/RecetaPapel.tsx`— y copia a mano
  `src/lib/pdf/RecetaPdf.tsx`, `PdfHeader.tsx` y `PdfBarras.tsx`. **Nada
  detecta el desfase**: ni el build, ni el lint, ni un test. Si alguien cambia
  el PDF real, la landing enseña un documento que ya no se emite.
- **Mitigación aplicada, que NO cierra la deuda pero la hace auditable:** la
  unidad de la réplica es `--rx-u = 100cqw / 612`, y 612pt es el ancho de una
  hoja carta en `@react-pdf`. Cada número escrito con `u(n)` es LITERALMENTE
  el número del PDF (`u(8)` ↔ `fontSize: 8`, `u(50)` ↔
  `paddingHorizontal: 50`). Comparar las dos versiones es comparar dos
  columnas de cifras, no reinterpretar un diseño. **Quien toque `RecetaPdf`
  tiene que abrir también `RecetaPapel`.**
- **Desvío conocido y aceptado:** la réplica usa **Inter**, no Roboto. §5.7
  pedía igualar la fuente del PDF; la única copia de Roboto del repo son
  ~2.6MB de base64 en `src/lib/pdf/fonts.ts`, importado dinámicamente solo al
  generar PDFs. Servirlo a la landing, o añadir una segunda familia por
  webfont, es peso nuevo contra el presupuesto de LCP de §4.3·9. Se prefiere
  el desvío tipográfico al coste de carga.
- **Condición de cierre:** o un test de snapshot que renderice los dos y
  compare geometría, o aceptar el desfase como permanente y anotarlo en la
  cabecera de los dos archivos.

### LP-DT-2 — Recapturar imágenes de landing cuando cambie la UI
- **Estado:** 🔴 abierta
- **Detectada:** Auditoría de landing (2026-07-28)
- **Descripción:** Recapturar imágenes de landing cuando cambie la UI de
  agenda, expediente o recetas. Manifest con fecha y versión en
  `/public/capturas/`.

### LP-DT-3 — Unificar la app a Inter
- **Estado:** 🔴 abierta
- **Detectada:** Auditoría de landing (2026-07-28)
- **Descripción:** Unificar la app a Inter; al hacerlo, recapturar.

### LP-DT-4 — Generación de PDF no probada en gama media/baja
- **Estado:** 🔴 abierta
- **Detectada:** Auditoría de landing (2026-07-28)
- **Descripción:** Generación de PDF no probada en gama media/baja — riesgo
  aceptado.

### LP-DT-5 — Estado vacío del visor DICOM en móvil
- **Estado:** 🔴 abierta
- **Detectada:** Auditoría de landing (2026-07-28)
- **Descripción:** Estado vacío del visor DICOM en móvil — hoy no existe.
  Debe mostrar "Disponible en computadora", no un visor roto.

### LP-DT-6 — Bug de sync de Google Calendar
- **Estado:** 🔴 abierta
- **Detectada:** Auditoría de landing (2026-07-28)
- **Descripción:** Bug de sync de Google Calendar — bloquea el claim "en
  tiempo real" en toda la página.

### LP-DT-7 — Dashboard que los médicos no entienden
- **Estado:** 🔴 abierta
- **Detectada:** Auditoría de landing (2026-07-28)
- **Descripción:** Dashboard — si los médicos no entienden qué es (razón por
  la que se quitó de la landing), es señal de producto, no de copy.

### LP-DT-8 — Almacenamiento de DICOM
- **Estado:** 🔴 abierta
- **Detectada:** Auditoría de landing (2026-07-28)
- **Descripción:** Almacenamiento de DICOM — verificar Postgres vs Storage.

### LP-DT-9 — Página de verificación de recetas
- **Estado:** 🔴 abierta
- **Detectada:** Auditoría de landing (2026-07-28)
- **Descripción:** Página de verificación de recetas: minimización de datos
  (la farmacia no necesita nombre completo ni CIE-10), `noindex`, y vigencia
  del enlace.
- **Actualización F3 (2026-08-02) — YA EXISTE LA REFERENCIA, y sigue sin
  aplicarse a la página real.** `src/app/demo/receta/page.tsx` (lo que abre el
  QR del Teaser 2) implementa **iniciales del paciente**, **sin diagnóstico ni
  CIE-10** y **`robots: noindex`**. La página real
  (`src/app/r/[folio]/page.tsx:104,113`) sigue publicando nombre completo y
  diagnóstico tras una URL adivinable, y sin `noindex`. Portar la política es
  copiar tres decisiones de un archivo al otro; lo que falta de verdad es la
  **vigencia del enlace**, que sí necesita esquema (¿caduca? ¿a los cuántos
  días? ¿qué se responde después?).
- ⚠️ **NO "unifiques" las dos páginas igualando la demo a la real.** La demo es
  la que está bien.

### LP-DT-10 — Renderizador de recomendaciones inconsistente
- **Estado:** 🔴 abierta
- **Detectada:** Auditoría de landing (2026-07-28)
- **Descripción:** Renderizador de recomendaciones inconsistente entre PDF
  (parseado, con formato) y página web (texto crudo con emojis a la vista).
  El paciente ve la peor de las dos.

### LP-DT-11 — Marca de agua del PDF detrás de la tabla de medicamentos
- **Estado:** 🔴 abierta
- **Detectada:** Auditoría de landing (2026-07-28)
- **Descripción:** Marca de agua del PDF detrás de la tabla de medicamentos
  — ensucia el dato más importante al fotocopiar.

### LP-DT-12 — Alineación del bloque final del PDF
- **Estado:** 🔴 abierta
- **Detectada:** Auditoría de landing (2026-07-28)
- **Descripción:** Alineación del bloque final del PDF ("SOLICITAR CITA…")
  fuera de la caja de alarma.

### LP-DT-13 — Mini-mockup falso en SeccionExpediente
- **Estado:** ✅ **CERRADA (2026-08-01)** — eliminada al montar el Video 1.
  Con el bloque se fueron sus 13 nodos de contraste entre 2.51 y 2.63, sus
  cinco tamaños fuera de escala (10/11/12/13/14px) y los tres semánticos de su
  timeline, que e2 y e4 habían excluido explícitamente por ser UI falsa. Ningún
  import quedó huérfano: los cinco iconos de `lucide-react` los siguen usando
  el kicker y las viñetas.
- **Efecto de alcance:** con esta y LP-DT-17 cerradas, **la landing ya no
  dibuja ninguna interfaz en JSX**. La regla de fidelidad visual de §2·2 se
  cumple sin excepciones vivas.
- **Estado original:** 🔴 abierta
- **Detectada:** F1.2 tanda (a) — eliminaciones (2026-07-30)
- **Descripción:** `src/components/landing/sections/SeccionExpediente.tsx:40-72`
  dibuja en JSX una tarjeta de paciente inexistente ("Carlos Méndez Ríos,
  Exp. #1042") con contadores y timeline inventados. Es una violación de
  fidelidad conocida: la landing muestra una UI que no es captura real del
  producto. Se conserva deliberadamente en la tanda (a) por decisión de PM
  para no dejar el grid `lg:grid-cols-2` de esa sección con una columna
  vacía mientras no exista el reemplazo.
- **Condición de cierre:** se elimina al integrar Video 1.

### LP-DT-14 — NeuralBackground sin uso en la landing
- **Estado:** ✅ **CERRADA (rediseño de /login, 2026-08-03)** — archivo
  eliminado (`src/components/ui/NeuralBackground.tsx`, 325 líneas). Se cumplió
  la condición que la entrada misma fijaba: su único consumidor era `/login`, y
  el rediseño le dio un fondo propio —`--lp-wash` en
  `src/app/login/layout.tsx`, el mismo lavado de `--cs` al 4% que §3.1 mandó
  para el hero y el CTA—, así que el canvas se quedó sin trabajo antes de
  borrarse. Con él se van el `requestAnimationFrame` autoperpetuado, los 5
  listeners de `window` y el contexto `alpha: false` que hacía que el color de
  fondo de `/login` dependiera del canvas.
- **Verificación previa al borrado** (Protocolo 2 de `CLAUDE.md`):
  `grep -rn "NeuralBackground" src/` → 3 coincidencias, **todas comentarios**
  (`login/page.tsx:37`, `SeccionHero.tsx:11`, `SeccionCTA.tsx:10`, las tres
  documentando que el lavado CSS lo sustituye). **Cero imports, cero JSX.**
  Las coincidencias fuera de `src/` son este documento y
  `SPINUS_LANDING_MAESTRO.md:140`.
- **Efecto en el lint:** el archivo aportaba 1 error de ESLint (`prefer-const`
  en `NeuralBackground.tsx:70`). Es uno de los dos problemas que bajan el
  baseline de LP-DT-16 de 214 a 212 en esta tanda.
- **Estado original:** 🔴 abierta
- **Detectada:** F1.2 tanda (a) — eliminaciones (2026-07-30)
- **Descripción:** NeuralBackground: sin uso en landing; conservado por
  `/login`. Evaluar en rediseño de auth. El archivo
  (`src/components/ui/NeuralBackground.tsx`, 325 líneas) queda como único
  consumidor `src/app/login/page.tsx:8,126`. Arrastra canvas 2D,
  `requestAnimationFrame` autoperpetuado y 5 listeners de `window`
  (`mousemove`, `mouseleave`, `touchmove`, `touchend`, `resize`); no
  registra `visibilitychange`, así que el rAF sigue corriendo con la pestaña
  oculta salvo throttling del navegador. Además pinta su propio degradado de
  fondo con contexto `alpha: false`, por lo que en `/login` el color de
  fondo depende del canvas.

### LP-DT-15 — Proyecto aparte: barrido de ® fuera de la landing
- **Estado:** 🔴 abierta
- **Detectada:** F1.2 tanda (a) — eliminaciones (2026-07-30)
- **Actualización (rediseño de /login, 2026-08-03):** **41 símbolos en 22
  archivos.** Bajan 2 símbolos y 1 archivo: `src/app/login/page.tsx` salió del
  inventario. Eran el `<h1>` ("Spinus" con el símbolo) y la línea de copyright
  del pie; los dos desaparecieron en la reescritura del render, no se
  reemplazaron por texto equivalente.
  ⚠️ **El archivo NO vuelve a entrar por sus comentarios.** La reescritura
  documenta la eliminación en prosa —"sin símbolo de marca registrada"— sin
  escribir el glifo, precisamente para que el `grep -rn "®"` que este registro
  usa como inventario no lo cuente como pendiente. Si alguna tanda futura
  reintroduce el símbolo en un comentario de ese archivo, romperá el conteo.
  ⚠️ **`src/app/login/layout.tsx` NO cierra el `<title>`.** El nuevo layout de
  `/login` se creó deliberadamente SIN `metadata` propia, así que la pestaña
  sigue mostrando el "Spinus®" del layout raíz (`src/app/layout.tsx:5`), que
  sigue contado aquí. Pisarlo con un `metadata` por ruta habría escondido el
  síntoma en una ruta dejándolo vivo en las otras veinte; se arregla en el
  archivo raíz, de una vez, cuando se ataque este registro.
- **Descripción:** Quedan **43 símbolos ® en 23 archivos** fuera de la
  landing pública (zonas 3, 4, 5, 6a y 6b del inventario reconciliado de
  F1.2: app logueada, config/metadata, documentos legales, auth y entrada, y
  otras superficies públicas) — cifra de origen, ver la actualización de
  arriba. La marca está EN TRÁMITE ante IMPI
  (exp. 3594483, sin registro concedido), así que usar ® es infracción.
  F1.2 solo corrigió los 2 de la landing (`SeccionNav`, `SeccionFooter`); un
  tercero se fue con `SeccionMockup` y un cuarto
  (`SeccionInterfaz.tsx:45`) se resuelve con el copy de la tanda (c).
  `src/lib/pdf/PdfBarras.tsx:60` se corrigió aparte en micro-commit por ser
  cara al paciente.
- **Notas especiales antes de tocar nada:**
  - `src/components/legal/TerminosContent.tsx:711` — el ® **es el objeto de
    la afirmación jurídica** ("La marca **Spinus®** y sus…"), y es la única
    línea del repo con dos símbolos. No es un reemplazo de texto trivial.
  - `src/app/(app)/perfil/page.tsx:43` — `'Spinus® (defecto)'` es el nombre
    de un tema de color; **posible string persistido en DB — verificar**
    antes de cambiarlo. Su gemelo congelado está en
    `design/agenda/design_handoff_agenda/theme.js:60`.
  - `src/app/manifest.json/route.ts:5` — es el **nombre de la PWA ya
    instalada en dispositivos**; cambiarlo afecta instalaciones existentes.
- **No tocar:** `SPINUS_LANDING_MAESTRO.md:518,520,563` (son la instrucción
  misma de eliminar el ® y la nota del trámite IMPI), `CLAUDE.md:3`,
  `.env.example:2` y el `design/**` congelado.

### LP-DT-16 — Baseline de ESLint: 214 problemas preexistentes
- **Estado:** 🔴 abierta
- **Detectada:** F1.2 tanda (a) — eliminaciones (2026-07-30)
- **Descripción:** `npx eslint .` sale con **exit 1 y 214 problemas
  (125 errores, 89 warnings)** en un árbol sin cambios. La mayoría son los
  prototipos de `design/**/*.jsx` (`'Icon' is not defined`,
  `react/jsx-no-undef`), que no forman parte del build, más warnings
  repartidos por la app. `npx tsc --noEmit` sí sale limpio (exit 0).
- **Corrección de la cifra (auditoría de F1.2 tanda (b), 2026-07-30):** el
  registro original decía 215/126/89. La medición en limpio sobre el árbol
  de `4b99bf7` da **214/125/89** — un error menos, ya resuelto en la propia
  tanda (a). Los warnings coinciden exacto.
- **Criterio vigente:** la validación de las fases es **no-regresión contra
  214/125/89**, no exit 0. Cualquier fase que suba ese número introdujo
  deuda nueva y debe corregirla antes de cerrar.
- **Condición de cierre:** excluir `design/` de la configuración de ESLint
  (es handoff congelado, no código de producción) y luego atacar el
  remanente real de `src/`.

### LP-DT-17 — Marco de captura vacío en el hero
- **Estado:** ✅ **CERRADA (2026-08-01)** — `public/landing/dashboard-spinus.png`
  (1882×958) montada en el marco con `next/image`, `priority` y recorte por
  `object-cover` / `object-left` a la región x 0–1533. El marco conservó
  proporción, cromo y sangrado; solo se sustituyó el lienzo vacío y se
  colorearon los tres puntos del semáforo. La fórmula del recorte y el porqué
  de recortar por la derecha están en `SeccionHero.tsx`.
- **Nota de cierre:** la condición decía "F0.c produce la captura real". F0.c
  sigue ABIERTA como auditoría visual de la app; lo que se cerró es este
  hueco concreto. Ver **LP-DT-30** y **LP-DT-31**, que nacen de esta captura.
- **Estado original:** 🔴 abierta
- **Detectada:** F1.2 tanda (c1) — copy de secciones de producto (2026-07-30)
- **Descripción:** `src/components/landing/sections/SeccionHero.tsx:70-81`
  renderiza el marco de ventana de la columna derecha (tres puntos, borde,
  radio, lienzo `--sp-surface-muted`) **sin contenido**. §7·1 pide ahí una
  captura real de la agenda sangrando por el borde derecho, pero F0.b
  (cuenta demo) y F0.c (auditoría visual de la app) están bloqueadas y la
  captura no existe.
- **Decisión de PM:** espacio reservado declarado, NO mockup en JSX. Se
  eligió dejar el marco vacío antes que dibujar una interfaz falsa —
  justo el defecto que LP-DT-13 registra en `SeccionExpediente`.
- **Efecto visible:** en pantallas `lg+` se ve un rectángulo liso con
  cromo de ventana. Debajo de `lg` el marco va `hidden`, así que en móvil
  no hay hueco.
- **Condición de cierre:** F0.c produce la captura real y se inserta en
  ese contenedor. No requiere cambio estructural: el marco ya tiene la
  proporción (`aspect-[16/10]`) y el sangrado.

### LP-DT-18 — `min-h-screen` usa `100vh` donde §4.3·10 pide `100dvh`
- **Estado:** 🟢 **CERRADA (F6·f3, 2026-08-02)** — `min-h-screen` → `min-h-dvh`
  en `src/app/(landing)/page.tsx`. Era el único sitio de la landing.
  ⚠️ **Residual honesto:** la condición de cierre pedía verificar en iOS real,
  y esta tanda NO validó en navegador (lo hace Angel). El cambio de utilidad es
  mecánico y `dvh` está soportado desde iOS 15.4 / Chrome 108, así que el
  riesgo de regresión es nulo; lo que queda sin confirmar es que el síntoma
  original —el salto al mostrarse la barra de direcciones— desaparezca. Si
  Angel lo ve todavía, la causa es otra y esta entrada se reabre.
- **Detectada:** auditoría de F1.3 tanda (a) — route group + Inter (2026-07-30)
- **Descripción:** `src/app/(landing)/page.tsx:18` aplica `min-h-screen` al
  `<main>` de la landing. En Tailwind 4 esa utilidad es
  `min-height: 100vh`. §4.3·10 del maestro es explícito: **"Móvil: `100dvh`
  nunca `100vh`"**. `100vh` en iOS/Android no descuenta la barra de
  direcciones, así que el alto reservado excede el viewport real y aparece
  un salto al mostrarse/ocultarse la barra al hacer scroll.
- **Por qué no se corrigió al detectarlo:** se detectó en la línea que la
  tanda (a) estaba editando (retirada del `fontFamily` inline). Protocolo 1
  de `CLAUDE.md` prohíbe aprovechar un cambio para arreglar lo que se ve de
  paso, y (a) tenía prohibido tocar espaciado. Se registra en vez de
  colarlo.
- **Alcance:** 1 archivo, 1 clase (`min-h-screen` → `min-h-dvh`).
- **Condición de cierre:** aplicarlo en F1.3 tanda (c) —espaciado— o, si
  esa tanda no llega a tocar `page.tsx`, en F6 (pulido/móvil real vía
  preview de Vercel). Verificar en iOS real, no en el emulador de
  DevTools: es donde el síntoma se manifiesta.

### LP-DT-19 — Problema↔Features sin separación cromática (padding donado)
- **Estado:** 🟠 abierta — **síntoma mitigado por aire, causa raíz intacta**
- **Detectada:** auditoría de F1.3 tanda (b) — superficies (2026-07-30)
- **Actualizada:** QA visual de F1.3 tanda (b2) (2026-07-30)

> **⚠️ ACTUALIZACIÓN b2 — LEER ANTES QUE EL CUERPO DE ABAJO.**
> Dos hechos que el texto original daba por fijos ya NO lo son:
> 1. **`SeccionProblema` sí declara superficie:** `bg-white` explícito. Lo
>    que sigue prohibido es darle una superficie *distinta* a la de
>    Features, no declarar la misma. La cita textual que este ítem hacía
>    del comentario de contrato (*"Añadir pt aquí, o superficie de fondo,
>    rompe las dos a la vez"*) ya no existe en el archivo: se corrigió a
>    *"Añadir pt aquí rompe las dos a la vez"*, porque un `bg` no mueve
>    ningún padding y la redacción vieja afirmaba algo falso.
> 2. **La costura Problema↔Features es de 128px, no de 96.** El `pb-24` de
>    Problema pasó a `pb-32`. La cadena vigente es
>    `Hero (pb-24) → [96px] → Problema (sin pt … pb-32) → [128px] → Features`,
>    asimétrica a propósito.
>
> **Qué resuelve eso y qué no.** La separación cromática **sigue ausente**:
> el par continúa siendo la única pareja consecutiva con la misma
> superficie, y la causa raíz — el padding donado — está intacta. Lo que se
> mitigó es el *síntoma*: a 96px la costura era comparable al interlineado
> de la propia frase (`leading-[1.10]` sobre ~46px ≈ 50px), y frase y
> titular del bento se leían como un bloque continuo. A 128px la jerarquía
> se recupera **sin tocar la arquitectura de padding**. El ítem no se
> cierra: se degrada de 🔴 a 🟠.
>
> **La Opción B sigue disponible y sigue siendo la única solución real.**
> Ver "Condición de cierre" abajo — sin cambios, salvo que el reparto ahora
> parte de 128px, no de 96: `SeccionFeatures` tomaría `pt-32` y
> `SeccionProblema` soltaría su `pb-32`.
- **Descripción:** la alternancia de superficies de §3.1 deja **un único par
  de secciones consecutivas con la misma superficie**: `SeccionProblema`
  (blanca) y `SeccionFeatures` (blanca). Leen como una sola región blanca de
  ~700px; lo único que las distingue es el salto tipográfico (una frase
  suelta de 46px al 74% de ancho contra `<h2>` + bajada + retícula de 5
  cards). No es error de asignación: es forzado, y por dos causas distintas
  que coinciden en la misma costura.
- **Causa raíz — padding donado (INTACTA tras b2):** `SeccionFeatures` no
  declara `pt`. Sus 128px de aire superior los dona el `pb-32` de
  `SeccionProblema`, y **el padding donado se pinta con la superficie del
  donante**. Darle una franja a Features haría que la banda de color
  arrancase en el borde superior del `<h2>`, con 0px de aire sobre el
  titular. Simétricamente, Problema no puede tomar una superficie
  *distinta* de la de Features: los 128px que dona quedarían teñidos y la
  costura se leería como banda de color pegada al titular siguiente. Por
  eso ambas comparten `bg-white` — la igualdad de superficie no es
  descuido, es la única asignación que el padding donado admite. La cadena
  vigente es `Hero (pb-24) → [96px] → Problema (sin pt … pb-32) → [128px]
  → Features (sin pt)`, documentada en los tres contratos de costura de
  `SeccionHero.tsx`, `SeccionProblema.tsx` y `SeccionFeatures.tsx` (sin
  número de línea a propósito: se desplazan en cada tanda).
- **Por qué tampoco sirve un borde:** un `border-b` en la `<section>` de
  Problema cae en su borde inferior, es decir **128px por debajo de su texto
  y 0px por encima del `<h2>` de Features**. El filete quedaría pegado al
  titular siguiente en vez de a mitad del aire. La arquitectura de padding
  donado hace que **tanto un cambio de superficie como un borde aterricen
  asimétricos en esa costura**. No hay solución dentro de b1 ni de b2.
- **Restricción adicional (independiente de la anterior):** aunque el
  padding se repartiera, Problema no puede tomar franja mientras siga
  inmediatamente después del Hero: el lavado `color-mix(#1e5fa8 4%, #fff)`
  de `SeccionHero.tsx:17` resuelve a ≈`#f6f9fc`, a un punto por canal de la
  franja `#f5f8fc`. Son el mismo color. Problema queda blanca por decisión
  de PM y por aritmética.
- **Decisión de PM:** se asume el par sin separación. La alternativa
  (Opción B de la auditoría) exigía repartir el padding en 2 archivos y
  reescribir los **tres** contratos de costura, que es justo lo que la
  tanda (b) tenía prohibido tocar.
- **Efecto visible (tras b2):** cero riesgo funcional. Solo lectura: el
  visitante sigue sin percibir *frontera de superficie* entre la tesis del
  problema y la retícula de capacidades, pero con 128px sí percibe cambio
  de bloque. Discutible si es defecto — la franja del problema es la
  bisagra hacia el bento y encadenarlas tiene lectura propia.
- **Condición de cierre:** tanda futura que reparta el padding donado —
  `SeccionFeatures` toma `pt-32`, `SeccionProblema` suelta su `pb-32` — y
  con eso Features puede recibir `bg-[#f5f8fc]`. La colisión se muda
  entonces a Features↔IA, ambas franja, enmascarada por el bloque navy de
  `SeccionIA.tsx:10`. **Reescribir los tres contratos de costura en el mismo
  cambio, no después:** si el reparto se aplica sin actualizarlos, los
  comentarios pasan a describir una cadena que ya no existe y el siguiente
  editor confía en ellos.

### LP-DT-20 — Escalera de tarjetas de Seguridad DESCARTADA (§3.4·10 y §5.10 sin efecto)
- **Estado:** ⚪ cerrada como decisión — **no es un pendiente**
- **Decidida:** QA visual de F1.3 tanda (b1) — superficies (2026-07-30)
- **Qué decía el maestro:** §3.4·10 pide las 3 tarjetas de Seguridad **en
  escalera, no en fila**, y §5.10 fija los offsets en **0/24/48px estáticos**.
  Se implementó en F1.2 tanda (c2) como
  `const ESCALERA = ['sm:mt-0','sm:mt-6','sm:mt-12']` sobre un grid con
  `items-start`.
- **Por qué se descarta:** la QA visual sobre el render real mostró dos
  fallos que la ficha de diseño no anticipaba.
  1. **Zigzag, no diagonal.** Las 3 tarjetas tienen cuerpos de longitud muy
     distinta (`SeccionSeguridad.tsx`, array `tarjetas`: 2 líneas / 1 línea /
     2 líneas), y `items-start` —necesario para que el `mt` desplace algo—
     impide que igualen altura. Offset desigual **sobre** altura desigual no
     produce una diagonal legible: los tres títulos y los tres cuerpos acaban
     a alturas sin relación entre sí. Lee como error de maquetación, que es
     el efecto contrario al buscado.
  2. **Desbordamiento horizontal.** El `sm:mt-12` de la tercera tarjeta la
     empujaba fuera del ancho de contenido: su borde derecho salía del
     contenedor `max-w-6xl`.
- **Qué quedó en su lugar:** grid con `items-stretch` explícito. Las 3
  tarjetas alineadas arriba y con altura compartida.
- **Efecto sobre el maestro:** **§3.4·10 y §5.10 quedan sin efecto para esta
  sección.** No hay que "volver a intentarlo" ni queda trabajo abierto. El
  requisito de §3.4 que sí sigue vigente —que ningún esqueleto se repita dos
  veces seguidas— lo cumple igual: Seguridad es la única retícula de 3
  tarjetas centradas de la landing, y sus vecinas (Historia a 2 columnas con
  retrato, CTA navy centrado) no comparten esqueleto.
- **Condición para revisitarlo (solo si alguien lo pide, no pendiente):**
  igualar la altura de los cuerpos de las 3 tarjetas, o fijar altura de
  tarjeta, **antes** de reponer cualquier offset. Reponer los `mt` sin eso
  reproduce el zigzag idéntico. El comentario de advertencia vive en
  `SeccionSeguridad.tsx`, justo encima del componente.

---

### LP-DT-21 — Audit del export de expediente es fire-and-forget (hueco de trazabilidad NOM-024)
- **Estado:** 🔴 abierta
- **Detectada:** auditoría de la adenda de contenido previa a F1.3 (e) (2026-07-30)
- **Descripción:** `src/components/expediente/ExportarExpedienteButton.tsx:127-135`
  registra la exportación en `audit_log` con
  `fetch('/api/audit', …).catch(() => {})`. El `.catch` vacío es deliberado
  —el comentario de arriba dice "no bloquea ni revierte nada si falla"— pero
  la consecuencia es que **si el POST falla, el PDF se entrega igual y no
  queda ningún rastro de la exportación**. El PDF ya se generó en el cliente
  antes de esa llamada, así que no hay forma de revertirlo.
- **Por qué importa ahora:** exportar un expediente íntegro no es una lectura
  más; el propio comentario del archivo lo invoca ("NOM-024"). Y desde esta
  adenda la landing **anuncia la capacidad en público**
  (`SeccionSeguridad.tsx`, pie de sección), lo que sube el volumen esperado
  de uso y con él el de eventos perdidos.
- **Fix propuesto:** reintentar una vez con backoff corto; si el segundo
  intento también falla, encolar en `localStorage` vía `secureStorage` y
  drenar al siguiente arranque. NO bloquear la entrega del PDF: el médico no
  puede quedarse sin sus datos porque falle la bitácora.
- **Condición de cierre:** que toda exportación entregada tenga entrada en
  `audit_log`, o quede en cola persistente hasta tenerla.

### LP-DT-22 — QW3 sube de prioridad: el endpoint ARCO queda expuesto por el copy de la landing
- **Estado:** ✅ **cerrada (2026-07-31)** — QW3 aplicado en la tanda de la FAQ,
  antes de que el copy que lo motivaba llegara a producción.
  **Qué se hizo:** `src/app/api/paciente/[id]/exportar/route.ts` gatea ahora con
  `canManageClinica(profile)` ANTES de tocar la base (un médico invitado no
  puede ni confirmar que el paciente existe), responde `403 { error:
  "forbidden" }` y registra el intento con la acción nueva
  `arco_intento_denegado` (`src/lib/audit.ts`), con `await` y no
  fire-and-forget: aquí no hay nada que entregar al usuario, así que no hay
  prisa que justifique perder el evento.
  **⚠️ Una desviación respecto al plan original de QW3, deliberada:**
  **super_admin NO entra.** QW3 decía "super_admin + admin", pero se escribió
  antes del refactor de roles de la etapa 4. Hoy `permissions.ts:31-34` fija la
  doctrina contraria ("super_admin opera EXCLUSIVAMENTE vía
  /api/super-admin/*"), y aunque entrara no serviría: la ruta usa el cliente
  con sesión y las policies de `pacientes` no tienen rama de super_admin
  (decisión D2-A), así que se llevaría un 404 después de pasar el gate — lo
  peor de los dos mundos. El `admin` legacy tampoco existe desde
  `20260519114652_etapa4a8_eliminar_rol_admin_legacy.sql`.
  **Lo que sigue pendiente y NO lo cubre este cierre:** el endpoint continúa
  sin UI. Nadie lo invoca desde la app; se protegió, no se integró.
- **Estado anterior:** 🔴 abierta — **prioridad elevada**
- **Detectada:** el pendiente es previo (ver `CLAUDE.md` § Pendientes de
  seguridad, QW3). La **elevación de prioridad** es de esta adenda (2026-07-30)
- **Descripción:** `src/app/api/paciente/[id]/exportar/route.ts` devuelve JSON
  con TODO el expediente (datos personales, consultas, addendums, mediciones,
  documentos) y **solo exige sesión autenticada: no valida el role**. QW3 ya
  planeaba restringirlo a `super_admin` + `admin`.
- **Qué cambia con la adenda:** hasta hoy el endpoint estaba dormido y sin UI.
  A partir de que la landing dice públicamente *"Llévate tu información cuando
  quieras"*, **es el primer sitio donde mirará quien vaya a buscar cómo se
  exporta**. Un pendiente sin visibilidad pasa a ser superficie de ataque
  documentada por nuestro propio marketing.
- **Ojo con la confusión:** el endpoint ARCO **no es** lo que la landing
  anuncia. El copy describe el botón de PDF cliente
  (`ExportarExpedienteButton.tsx`), que sí está acotado por RLS. Son dos
  caminos distintos hacia el mismo dato y solo uno está protegido.
- **Fix:** el ya descrito en QW3 (validar role post-auth, `403` con
  `{ error: "forbidden" }`, registrar `arco_intento_denegado` en `audit_log`).
  ~15 líneas, 1 archivo.
- **Condición de cierre:** QW3 aplicado. Debería ir **antes** de que la landing
  con este copy llegue a producción.

### LP-DT-23 — Nombre público del rol: "asistente médico" (decisión revertida el mismo día)
- **Estado:** ✅ cerrada (2026-07-31) — las cuatro superficies visibles dicen lo mismo
- **Detectada:** auditoría de la adenda de contenido previa a F1.3 (e) (2026-07-30)
- **⚠️ ESTA FICHA SUSTITUYE A SU VERSIÓN ANTERIOR, QUE DECÍA LO CONTRARIO.**
  El 2026-07-30 por la mañana se decidió que la palabra pública fuera
  **"secretaria"** ("es la del médico mexicano") y esta ficha lo registró así.
  Ese mismo día, al redactar la sección "Tu práctica, tuya", el PM revirtió:
  la palabra pública es **"asistente médico"**. Si estás leyendo una copia
  vieja de este registro o un comentario que diga "secretaria es la decisión",
  está caducado.
- **Estado por superficie:**

  | Superficie | Dice | ¿Alineado? |
  |---|---|---|
  | `SeccionControl.tsx` (landing) | "asistente médico" | ✅ |
  | `SeccionCTA.tsx` (landing) | "asistente médico" | ✅ corregido en esta tanda |
  | `admin/usuarios/page.tsx:183` (UI de alta) | "Asistente Médico/a" | ✅ ya lo estaba |
  | `ayuda/page.tsx:41-42` (FAQ) | "asistentes médicos" / rol "Asistente Médico/a" | ✅ corregido 2026-07-31 |
  | `profiles.role` (enum de BD) | `secretaria` | ⬜ **NO SE TOCA** |

- **⚠️ EL ENUM NO ENTRA EN ESTO.** `permissions.ts:52-54` y toda la capa de
  RLS usan el valor `secretaria`. Renombrarlo es una migración con RLS,
  policies y `isSecretaria()` de por medio, y **no aporta nada**: es un valor
  interno que ningún usuario ve. Lo que se unifica es el RÓTULO.
- **Cierre:** el FAQ se corrigió el 2026-07-31 con el resto de la unificación.
  No queda ninguna superficie visible diciendo "secretaria"; el único sitio
  donde sobrevive la palabra es el valor del enum en BD y los comentarios que
  explican por qué no se toca.

### LP-DT-24 — `ROLES_POST_REFACTOR.md` desfasado: marca como TBD límites que `plans.ts` ya tiene concretos
- **Estado:** 🔴 abierta
- **Detectada:** auditoría de la adenda de contenido previa a F1.3 (e) (2026-07-30)
- **Descripción:** `ROLES_POST_REFACTOR.md:75-87` (§1.6, mapeo plan → tipo de
  cuenta) da los límites de los planes comerciales como rangos con "(TBD)" y
  remata: *"Los valores específicos de `max_medicos`/`max_secretarias` para los
  planes comerciales son TBD (a definir cuando se comercialicen)"*.
  **Ya están definidos y en producción** en `src/lib/plans.ts`:

  | plan | `max_medicos` | `max_secretarias` | línea |
  |---|---|---|---|
  | `basica` | 3 | 1 | `plans.ts:68-69` |
  | `pro` | 5 | 2 | `plans.ts:88-89` |
  | `premium` | 10 | 2 | `plans.ts:110-111` |

  Y se aplican de verdad: `src/app/api/admin/crear-usuario/route.ts:64-68`
  rechaza con 403 al alcanzar el tope.
- **Riesgo:** el doc de roles es la referencia que se consulta para decidir
  qué promete cada plan. Que diga "TBD" invita a inventar cifras. Nótese que
  `premium` **no sube de secretarias** respecto a `pro` (2 en ambos), cosa que
  el rango "3+ (TBD)" del doc contradice de frente.
- **Fuente de verdad:** `plans.ts`. El doc se sincroniza con él, no al revés.
- **Condición de cierre:** §1.6 de `ROLES_POST_REFACTOR.md` con los valores
  reales y sin "TBD".

### LP-DT-25 — La retícula de Seguridad se rompe entre 640 y 768px (preexistente)
- **Estado:** 🟠 **PARCIALMENTE RESUELTA (F6·f3, 2026-08-02)** — no cerrada.

> **⚠️ ACTUALIZACIÓN F6·f3 — LEER ANTES QUE LA TABLA DE ABAJO.**
> `SeccionSeguridad.tsx` pasó de `sm:grid-cols-3` a **`md:grid-cols-3`**. Lo
> que eso arregla y lo que NO, con la misma medición de la tabla:
>
> | viewport | antes | ahora |
> |---|---|---|
> | 640 | 176px/tarjeta (3 col) | **576px (1 col)** ✅ |
> | 768 | 218.67px (3 col) | **218.67px (3 col)** ❌ sin cambio |
> | 1024 | 304px | 304px ✅ |
>
> **La franja 640–767 desaparece; la de 768–1023 sigue igual.** La condición
> de cierre de este ítem es "ninguna tarjeta por debajo de ~240px en ningún
> breakpoint", y a 768px son 218.67 — así que **no se cierra**. Cerrarla exige
> `lg:grid-cols-3` (1024 → 304px), que es un cambio de composición mayor y no
> estaba en el alcance de f3.
>
> **No se metió `sm:grid-cols-2` en medio**, pese a que el "fix propuesto" de
> abajo lo sugería: son 3 tarjetas y dos columnas dejan la tercera huérfana a
> media fila.
>
> **Y NO barre las otras dos retículas.** `SeccionFeatures.tsx:225` y
> `SeccionPortabilidad.tsx:102` siguen en `sm:grid-cols-3`. El ítem pedía "las
> tres o justificar por qué no": la justificación es que el alcance aprobado de
> f3 nombraba Seguridad, y esas dos **no tienen medición propia** — sus
> contenidos son más cortos y podrían aguantar los 176px sin partir títulos,
> pero eso hay que medirlo, no suponerlo. **Quedan abiertas aquí.**

- **Detectada:** auditoría de la adenda de contenido previa a F1.3 (e)
  (2026-07-30), midiendo el layout con un cuarto elemento
- **Descripción:** `SeccionSeguridad.tsx` usa `grid sm:grid-cols-3`, y `sm`
  entra en **640px**. Medido en navegador sobre el ancho útil real (1088px a
  1440; el contenedor `max-w-6xl` mide 1152 **exteriores** y `px-8` come 32 por
  lado):

  | viewport | ancho/tarjeta | alto de tarjeta | H3 | cuerpo |
  |---|---|---|---|---|
  | 1440 | 346.67px | 286.88 | 1/1/1 L | 4/3/3 L |
  | 1024 | 304px | 314.92 | 1/1/1 L | 5/3/3 L |
  | 768 | 218.67px | 395.70 | **2/2/2 L** | 7/4/6 L |
  | 640 | **176px** | **507.89** | **2/3/2 L** | **11/6/8 L** |

  A 640px cada tarjeta mide 176px, el título parte en hasta 3 líneas y un
  cuerpo llega a 11. Tres columnas a ese ancho no son una retícula, son tres
  tiras.
- **Por qué no se arregló en la adenda:** el alcance aprobado era añadir un pie
  de sección (opción C), que **no toca la retícula**. Cambiar el breakpoint es
  una decisión de layout con su propia QA visual.
- **Fix propuesto:** subir el corte a `md:grid-cols-3` (768px) y dejar
  `sm:grid-cols-2` en medio, o pasar directo de 1 a 3 columnas en `lg`. Medir
  antes: el mismo patrón `sm:grid-cols-3` está en `SeccionFeatures.tsx:145` y
  `SeccionPortabilidad.tsx:53`, así que la decisión debería barrer las tres o
  justificar por qué no.
- **Condición de cierre:** ninguna tarjeta de Seguridad por debajo de ~240px de
  ancho en ningún breakpoint.

### LP-DT-26 — Retirar las cifras de soporte dejó a Premium sin escalón propio
- **Estado:** 🔴 abierta — decisión de producto, no técnica
- **Detectada:** tanda de la FAQ (2026-07-31)
- **Descripción:** `plans.ts` publicaba dos compromisos de tiempo sin nada
  detrás —"Soporte prioritario <24h" en Pro y "SLA de respuesta <8h" en
  Premium—, sin ticketing, sin turnos y sin cláusula en los términos. El PM
  ordenó sustituir ambos por "Soporte prioritario" sin cifra, para que la FAQ
  pública pudiera comprometer UN techo ("nuestro objetivo es responder dentro
  de las 24 horas hábiles") sin contradecir a `/pricing`. Aplicado.
- **Lo que quedó torcido, y se deja anotado en vez de resolverlo por cuenta
  propia:**
  1. **Premium repite una línea que ya hereda.** Sus features abren con "Todo
     lo de Clínica Pro", que ya incluye "Soporte prioritario". Sin cifras, la
     línea propia de Premium no aporta nada: el escalón de soporte entre Pro y
     Premium desapareció.
  2. **Clínica Básica no lista soporte prioritario en absoluto**, pero la
     pregunta 6 de la FAQ dice "los planes de clínica cuentan con atención
     prioritaria" — y Básica es un plan de clínica. O la línea entra en
     Básica, o la FAQ dice "los planes Pro y Premium".
- **Por qué no se arregló aquí:** reempaquetar planes es de producto. La
  instrucción era sustituir las cifras, no redistribuir features.
- **Condición de cierre:** que la lista de features de los tres planes de
  clínica y la pregunta 6 de la FAQ describan el mismo producto.

### LP-DT-27 — Nueve `role="region"` seguidos en la FAQ son ruido de landmarks
- **Estado:** 🔴 abierta — a11y, menor
- **Detectada:** tanda de la FAQ (2026-07-31)
- **Descripción:** cada panel del acordeón lleva `role="region"` +
  `aria-labelledby`, según la instrucción de accesibilidad de la tanda. Es el
  patrón del APG de acordeón, **pero el propio APG advierte de no usar `region`
  cuando hay muchos paneles** (orientativamente más de ~6) porque cada uno se
  convierte en un landmark y el menú de landmarks del lector de pantalla se
  llena de ruido. Aquí son **nueve**.
- **Por qué se dejó así:** el `role` venía indicado explícitamente en la
  instrucción, y quitarlo tiene coste: sin `role`, el `aria-labelledby` del
  panel deja de tener efecto (un `div` sin rol no toma nombre accesible).
- **Fix propuesto:** cambiar `role="region"` por `role="group"` en los nueve.
  `group` conserva el nombre accesible vía `aria-labelledby` y NO es landmark.
  Una línea en `SeccionFAQ.tsx`.
- **Condición de cierre:** verificar con un lector de pantalla real (VoiceOver
  o NVDA) que el panel sigue anunciándose con el texto de su pregunta y que la
  lista de landmarks de la página no crece en nueve entradas.

### LP-DT-28 — LP-DT-25 empeora: la tarjeta 2 de Seguridad triplicó su cuerpo
- **Estado:** 🟢 **CERRADA (F6·f3, 2026-08-02)** — este ítem describía el
  agravamiento **en el tramo 640–767**, y ese tramo ya no existe: con
  `md:grid-cols-3` las tres tarjetas van a una columna de 576px ahí, donde el
  cuerpo largo de la tarjeta 2 no parte nada. Lo que sigue vivo es la deuda
  madre, **LP-DT-25**, por la banda 768–1023 (218.67px/tarjeta). No dupliques
  el seguimiento: se hace allí.
- **Detectada:** tanda de la FAQ (2026-07-31)
- **Descripción:** la corrección de B4 sustituyó el cuerpo de la tarjeta "Tu
  información, separada" —una línea— por tres frases (médico, admin de clínica,
  bitácora). Las 3 tarjetas comparten altura por `items-stretch`, así que la
  más larga manda: la retícula entera crece.
  LP-DT-25 ya medía que a 640px cada tarjeta cae a **176px de ancho** con
  cuerpos de hasta 11 líneas; con este cuerpo, la columna del medio empeora en
  ese tramo.
- **Ojo con el diagnóstico:** el problema NO es el copy nuevo —que corrige un
  claim falso y no se toca— sino el `sm:grid-cols-3` de `SeccionSeguridad.tsx`,
  que mete tres columnas a partir de 640px. El fix es el de LP-DT-25 (subir el
  corte a `md`, con `sm:grid-cols-2` en medio), y barre también
  `SeccionFeatures.tsx:145` y `SeccionPortabilidad.tsx:53`.
- **Condición de cierre:** la de LP-DT-25 — ninguna tarjeta de Seguridad por
  debajo de ~240px de ancho en ningún breakpoint.

### LP-DT-29 — El aviso de privacidad declara a Anthropic como encargado activo, y ya no lo es
- **Estado:** 🔴 abierta — **documento legal desfasado**
- **Detectada:** auditoría previa a la FAQ (2026-07-31)
- **Descripción:** `AvisoPrivacidadContent.tsx:113-118` lista *"Anthropic, PBC
  (Claude) — Extracción estructurada de resultados de laboratorio a partir de
  archivos PDF"* con `status: 'activa'`, y `:475-476` repite que la plataforma
  usa IA "de Google (Gemini) y Anthropic (Claude)". **Ese código murió en la
  sub-fase 8C1 del rediseño de labs (2026-04-23)**, que eliminó
  `/api/labs-extract`. Hoy el único proveedor de IA con callsite vivo en `src/`
  es Google: `gemini-3.5-flash` en `nota-medica/route.ts:169,215`.
  `@anthropic-ai/sdk` sigue en `package.json:15` como dependencia muerta (cero
  imports).
- **Por qué importa:** un aviso de privacidad que declara una transferencia
  internacional de datos sensibles que no ocurre es un defecto del documento,
  no un exceso de prudencia — describe mal el tratamiento real. Y la FAQ
  pública enlaza al aviso.
- **Fix:** pasar la fila de Anthropic a `status` histórico o retirarla, quitar
  la mención de `:475-476`, subir la versión del aviso, y desinstalar
  `@anthropic-ai/sdk`.
- **⚠️ Verificar antes de retirarla del todo:** si hay planes cercanos de
  reintroducir extracción de labs con Claude, conviene dejarla declarada; lo
  que no puede quedarse es `status: 'activa'` describiendo algo que no pasa.
- **Condición de cierre:** que los encargados listados en el aviso coincidan
  uno a uno con los que reciben datos en el código.

---

### LP-DT-30 — La captura del hero lleva una fecha que envejece

- **Estado:** 🟠 abierta — **pendiente de decisión de Angel**
- **Detectada:** al montar la captura del hero (2026-08-01)
- **Descripción:** `public/landing/dashboard-spinus.png` muestra
  «Sábado, 1 De Agosto» y «Buenas tardes, Angel» sobre la tarjeta de próximas
  citas, que a su vez dice «lun 3 ago · 09:00». En octubre la landing seguirá
  enseñando una agenda de agosto.
- **Por qué importa más de lo que parece:** es **el mismo defecto por el que se
  eliminó el mockup original**, que estaba clavado en abril. La diferencia es
  que aquel era UI falsa en JSX (LP-DT-13) y este es producto real, así que no
  viola §2.2 — pero el síntoma que ve el visitante es idéntico: un producto que
  parece abandonado. Y está en el hero, donde §1 sitúa el juicio de 50ms.
- **Dos salidas, y la decisión es de Angel:**
  1. **Aceptar como deuda** y recapturar cada cierto tiempo. Barato ahora, pero
     entra en la cola de LP-DT-2 (recapturar cuando cambie la UI) y depende de
     que alguien se acuerde.
  2. **Recapturar sin el bloque de saludo**, encuadrando desde «PRÓXIMAS
     CITAS» hacia abajo. Elimina la fecha *y* el nombre de pila, y de paso
     sube el contenido de producto a la zona alta del marco. Cuesta una
     captura nueva.
  La fecha relativa de la tarjeta («lun 3 ago») envejece igual, así que la
  opción 2 solo resuelve del todo si el recorte también la deja fuera.
- **Condición de cierre:** Angel elige 1 o 2. Si elige 1, esta entrada se marca
  como aceptada y se enlaza a LP-DT-2.

### LP-DT-31 — La app llama «Buscar paciente» a lo que la landing llama «Búsqueda rápida»

- **Estado:** 🔴 abierta
- **Detectada:** al montar la captura del hero (2026-08-01)
- **Descripción:** el panel de accesos rápidos del dashboard rotula el buscador
  como **«Buscar paciente»** (visible en la captura, con su `Ctrl K` al lado).
  La landing lo llama **«Búsqueda rápida»** en tres sitios:
  `SeccionExpediente.tsx:55`, `SeccionInterfaz.tsx:129` y el copy de §7·8.
- **Por qué es una regla y no una minucia:** §7·6 del maestro lo exige
  literalmente — *«Un solo nombre para el buscador en TODA la página: "Búsqueda
  rápida"»*. Con la captura montada, las dos palabras conviven **en la misma
  pantalla**: el visitante lee «Búsqueda rápida» en el texto y ve «Buscar
  paciente» en la imagen de al lado.
- **Alcance probable:** rótulo de la UI del dashboard, más el resto de sitios
  de la app donde aparezca el mismo control. **No se tocó en esta tanda a
  propósito:** el alcance era la landing, y cambiar un rótulo de la app obliga
  además a **recapturar** — o sea que va junto con LP-DT-30, no por separado.
- **Condición de cierre:** un solo nombre en app y landing, y captura
  regenerada con él.

---

### LP-DT-32 — El Video 1 muestra «Spinus®»

- **Estado:** 🟠 **abierta — YA NO BLOQUEA EL MERGE** (autorización de Angel,
  2026-08-02)

> **⚠️ ACTUALIZACIÓN F6·f3 — ESTE ÍTEM CAMBIÓ DE NATURALEZA, NO DE CONTENIDO.**
> El título y el estado decían **«bloquea la publicación de la landing»** y
> **«BLOQUEA EL MERGE A `main`»**, con la instrucción expresa de parar y
> preguntar a Angel antes de mergear. **Angel dio esa autorización el
> 2026-08-02, nombrando esta deuda: decide publicar con el ® en el vídeo.**
> La condición que el propio ítem exigía —visto bueno suyo y explícito— está
> cumplida, así que la barrera se retira.
>
> **Lo que NO cambia, y es todo lo demás:** el ® sigue siendo uso de un
> símbolo de registro sobre una marca **en trámite y sin conceder**, el
> defecto sigue abierto, y la corrección sigue siendo la misma y en el mismo
> orden. Esto es una **decisión de riesgo asumida por el titular del
> proyecto**, no un problema resuelto ni una reevaluación de §7·Global. Nadie
> debe leer este cambio de estado como que el ® pasó a ser aceptable.

- **Decisión de Angel (2026-08-01, ampliada el 2026-08-02):** se publica así
  **por ahora**. NO se corrige en F2 ni en F6: se corrige **al cerrar LP-DT-15
  y regrabar**, en ese orden.
- **Detectada:** al montar el Video 1 (2026-08-01), revisando el póster
- **Descripción:** `public/landing/expediente-demo.mp4` / `.webm` es una captura
  de PANTALLA con el navegador visible, y el título de pestaña dice
  **«Spinus®»**. §7·Global del maestro no admite lectura: la marca está **en
  trámite ante IMPI (exp. 3594483), sin registro concedido**, y usar ® es
  **infracción**. El vídeo está montado para no dejar la sección coja, pero
  **esta rama no puede ir a producción así**.
- **⚠️ Y NO SE ARREGLA REGRABANDO SIN MÁS — DEPENDE DE LP-DT-15.** El ® no lo
  pinta la landing: lo pinta **la app**. LP-DT-15 («barrido de ® fuera de la
  landing») sigue abierta, así que *cualquier* grabación nueva de la app puede
  volver a capturarlo, en la pestaña o en la propia interfaz. **El orden
  correcto es: cerrar LP-DT-15 → regrabar → montar.** Nadie había conectado las
  dos deudas; grabar antes del barrido es repetir el trabajo.
- **El cromo del sistema en el asset se separó a LP-DT-34**, que Angel aceptó
  de forma independiente.
- **Segundo defecto, menor:** las cinco filas de pacientes ponen «1 ago 2026»,
  así que envejece igual que LP-DT-30. Al regrabar, sembrar fechas variadas.
- **Condición de cierre:** asset regenerado sin ®, sin cromo de navegador y sin
  fechas que envejezcan, con el marco HTML activado.

### LP-DT-33 — El Video 1 no se puede pausar: WCAG 2.2.2

- **Estado:** 🟢 **CERRADA con residual aceptado (2026-08-01)** — se retiró el
  `loop`. El vídeo corre una vez y se congela en el último fotograma, así que
  **no queda movimiento automático continuo que parar**: desaparece el conflicto
  entre 2.2.2 y la prohibición de `controls` de §6·4, sin botón de pausa y sin
  reabrir esa regla. También deja de ser el único bucle infinito de la página,
  que rozaba §12.
- ⚠️ **RESIDUAL, y se deja escrito en vez de declarar cumplimiento pleno:** el
  criterio 2.2.2 se dispara por **duración** —«lasts more than five seconds»—
  y no por repetición, así que una pasada única de 15s todavía cae dentro de su
  literalidad. La lectura del PM es que sin bucle no hay nada que parar, y se
  acepta; pero si en F6 el barrido de accesibilidad quiere cumplimiento
  literal, las dos salidas limpias siguen siendo:
  1. **Pausar bajo `prefers-reduced-motion`** con un `ref` + efecto que llame a
     `pause()`. No ramifica el render (§4.3·7): el árbol es idéntico y solo
     cambia un efecto secundario.
  2. **Recortar el asset a ≤5s**, que lo saca del alcance del criterio. Cambia
     el contenido: el recorrido actual no cabe en 5 segundos.
  La opción de un botón de pausa queda descartada: choca con §6·4 y ya no hace
  falta.

### LP-DT-34 — El Video 1 lleva cromo del sistema grabado (aceptado)

- **Estado:** 🟠 abierta — **aceptada conscientemente por Angel (2026-08-01)**
- **Descripción:** el asset es una captura de PANTALLA, no de ventana: se ven
  el semáforo de macOS, la pestaña del navegador, los iconos de extensiones y
  el fondo de escritorio alrededor. §6·1 pide capturar la ventana y §6·4 pone
  el marco de ventana en HTML alrededor, de modo que el vídeo se lea como «la
  interfaz corriendo» y no como un vídeo incrustado.
- **Consecuencia en el código, para que nadie la deshaga por error:** el vídeo
  se monta **SIN** el marco HTML del hero. Superponerlo daría **dos semáforos
  anidados**, que es exactamente el efecto que §6·4 quiere evitar. El bloque de
  marco está escrito y comentado dentro de `SeccionExpediente.tsx`, listo para
  activarse — **no lo borres**: es la mitad del trabajo de la próxima grabación.
- **Condición de cierre:** al regrabar (junto con LP-DT-32, que obliga a
  hacerlo de todas formas), capturar **solo la ventana**, sin escritorio ni
  cromo de navegador, y activar el marco HTML comentado. Las dos cosas van en
  el mismo movimiento: asset limpio + marco descomentado.

### LP-DT-35 — La cuenta demo escribe los nombres sin acentos, y el Video 1 los lleva grabados
- **Estado:** 🔴 abierta
- **Detectada:** F3 · Teaser 2 (2026-08-02), al verificar el hilo narrativo
  entre el video de Expediente y la receta del teaser
- **Descripción:** La cuenta demo tiene los nombres mal escritos y eso está
  **grabado en píxeles** en `public/landing/expediente-demo.mp4/webm` y en su
  póster. Verificado en el primer fotograma
  (`public/landing/expediente-demo-poster.jpg`):
  - paciente: **«Ana Gomez Sanchez»** — debería ser «Ana Gómez Sánchez»
  - médico: **«Dr. Angel Perez»** — debería ser «Dr. Ángel Pérez»
  - en la misma lista, «Pedro Jiménez Moreno» y «Juan García Bustamante» SÍ
    van acentuados, así que no es una decisión de la cuenta: son faltas.
- **Por qué importa:** el video es la pieza que sostiene «producto real en
  movimiento» (§6). Un nombre sin acentos en la interfaz que se está usando
  para vender rigor se lee exactamente como lo que es. Y F3 acaba de crear un
  segundo punto de contacto: la receta del teaser nombra a la misma paciente
  bien escrita, así que las dos secciones se contradicen a dos scrolls de
  distancia.
- **Decisión tomada en F3:** el teaser y `/demo/receta` usan la forma
  **correcta** («Ana Gómez Sánchez»). No se replica la falta. El hilo
  narrativo se sostiene igual — nadie lee «Gomez» y «Gómez» como dos personas.
- **Corrección:** resembrar la cuenta demo con acentos (F0.b) y **regrabar el
  Video 1**. No se arregla desde la landing.
- ⚠️ **No lo "arregles" desacentuando `receta-demo.ts`.** Sería propagar la
  falta a la única superficie donde hoy está bien.

---

## F6·f3 — lo que la última tanda antes del merge deja documentado

Cinco hallazgos de la auditoría de F6 que **no se aplican** y quedan
registrados con su medición. Ninguno bloquea el merge. Los cuatro puntos que
sí se aplicaron (bordes de control, skip link, retícula de Seguridad, `dvh`)
están anotados en LP-DT-18, LP-DT-25 y LP-DT-28, y en el bloque de «bordes de
control» de `globals.css`.

### LP-DT-36 — La landing y el producto comparten una sola hoja de CSS

- **Estado:** 🟠 abierta — **rendimiento, aceptada; el fix es estructural**
- **Detectada:** auditoría de F6 (2026-08-02)
- **Descripción:** `/` sirve **una única hoja con el CSS de la app entera**.
  Medido sobre el build de esta tanda
  (`.next/static/css/3a3275540edac12b.css`):

  | métrica | valor |
  |---|---|
  | tamaño sin comprimir | **183.961 B** (~180 KB) |
  | bloques `{` | **2.355** |
  | de ellos, at-rules | 257 (130 `@supports`, 71 `@property`, 29 `@keyframes`, 21 `@media`, 5 `@layer`) |
  | selectores de regla contados en la auditoría | **1.306** |

  El visitante de la landing descarga y parsea, en la ruta crítica, las reglas
  del expediente, la agenda, el visor DICOM, el super-admin y los modales —
  ninguna de las cuales puede llegar a aplicarse en `/`.
- **Por qué NO se arregla aquí, y por qué no es un `content` mal configurado:**
  en **Tailwind 4** el barrido de fuentes se declara desde el CSS con
  `@source`, y la unidad de salida es el **entry point**. Partirlo obliga a
  crear una segunda hoja de entrada con su `@source` acotado al árbol de la
  landing (`src/app/(landing)/**` + `src/components/landing/**`) y a cablearla
  solo en el layout de ese route group, dejando `globals.css` para el resto.
  Eso son: un archivo CSS nuevo, un import movido, y una **duplicación
  deliberada del bloque `:root`** de tokens `--lp-*` o su extracción a un
  tercer archivo compartido — más la verificación de que ninguna utilidad que
  la landing usa vive fuera de sus dos árboles (`ModalShell`, iconos, etc.).
  No es una línea de configuración: es una reestructuración del pipeline de
  estilos, y hacerla en la tanda previa al merge sería exactamente el tipo de
  cambio que este proyecto ya pagó caro.
- **⚠️ Antes de atacarlo, mide el beneficio real.** 180 KB sin comprimir NO son
  180 KB en red: con Brotli una hoja de utilidades comprime muy bien y el coste
  dominante puede ser el **parseo**, no la descarga. Si nadie ha medido LCP/CLS
  con y sin la hoja partida, el ahorro es una hipótesis.
- **Condición de cierre:** `/` sirve una hoja cuyo contenido sea solo el CSS
  alcanzable desde la landing, con las métricas de arriba medidas de nuevo y
  una comparación de LCP antes/después que justifique el cambio.

### LP-DT-37 — La banda 768–1023 de §5.11 (Control) es una composición fija estirada

- **Estado:** 🟠 abierta — **layout, tablet vertical**
- **Detectada:** auditoría de F6 (2026-08-02)
- **Descripción:** `SeccionControl.tsx` compone su mockup con **posiciones y
  tamaños absolutos en píxeles**, y solo tiene dos juegos: `md:` (768) y `lg:`
  (1024). Contados en el archivo: **38 utilidades `md:` y 28 `lg:`**, entre
  ellas `md:w-[534px]`, `md:h-[358px]`, `md:left-[252px]`, `md:w-[168px]`,
  `md:left-[124px]`, `md:left-[62px]`, `md:-left-[133px]`.

  El problema es que ese juego `md:` tiene que servir **todo** el tramo
  768–1023. El ancho útil es `viewport − 64` (contenedor `max-w-6xl` con
  `px-8`), o sea:

  | viewport | ancho útil | composición vigente |
  |---|---|---|
  | 768 | 704px | juego `md:` |
  | 1023 | 959px | juego `md:` |
  | 1024 | 960px | juego `lg:` |
  | ≥1216 | 1088px (tope) | juego `lg:` |

  Son **255px de holgura, un 36% de crecimiento**, con cada pieza clavada al
  píxel. La figura y la tarjeta flotante no acompañan al contenedor: se quedan
  ancladas donde las dejó el juego `md:` y el aire se acumula a un lado. A
  1023px la composición está calculada para un lienzo 255px más estrecho del
  que ocupa.
- **Por qué no se corrigió:** el alcance de f3 eran cuatro puntos nombrados y
  este no estaba. Además el arreglo correcto no es añadir un tercer juego de
  píxeles —sería el mismo defecto con más ramas— sino pasar la composición a
  unidades relativas al contenedor (`%`, `cqw` con container queries, o una
  retícula), y eso es un rediseño de la sección con su propia QA visual.
- **⚠️ No lo confundas con LP-DT-25.** Aquella es la retícula de Seguridad
  (tarjetas que encogen); esta es el mockup de Control (piezas que no se mueven
  cuando deberían). Coinciden en la banda por la misma razón —768 es donde este
  proyecto salta de móvil a escritorio sin peldaño intermedio— pero son
  arreglos distintos.
- **Condición de cierre:** la composición de §5.11 mantiene sus proporciones a
  768, 900 y 1023px sin que aparezca aire asimétrico.

### LP-DT-38 — Quedan colores crudos de Tailwind en dos secciones (no tres)

- **Estado:** 🟠 abierta — **coherencia de tokens, menor**
- **Detectada:** auditoría de F6 (2026-08-02)
- **Descripción:** §3.1 y la regla de la landing piden que todo color salga de
  la escala `--lp-*`. Sobreviven **9 declaraciones vivas** en dos archivos:

  | archivo | línea | valor crudo | qué pinta |
  |---|---|---|---|
  | `SeccionInterfaz.tsx` | 91 | `bg-[#f8fafc]` | fondo del panel de flujo |
  | `SeccionInterfaz.tsx` | 91 | `border-slate-200/60` | borde del panel |
  | `SeccionInterfaz.tsx` | 92 | `text-slate-400` | rótulo del panel |
  | `SeccionInterfaz.tsx` | 115 | `bg-white` + `border-slate-200/60` | tarjeta de paso |
  | `SeccionInterfaz.tsx` | 118 | `text-white` | número del paso |
  | `SeccionInterfaz.tsx` | 121 | `text-slate-800` | título del paso |
  | `SeccionInterfaz.tsx` | 122 | `text-slate-400` | descripción del paso |
  | `SeccionIA.tsx` | 43 | `from-slate-900 via-slate-800 to-slate-900` | caja de gradiente |

  Los equivalentes ya existen: `#f8fafc` **es** `--lp-surface-sunken`,
  `bg-white` es `--lp-surface`, `text-white` es `--lp-ink-inverse`.
- **⚠️ CORRECCIÓN AL ENUNCIADO DEL HALLAZGO: `SeccionHero.tsx` NO TIENE
  NINGUNO.** El hallazgo se anotó como «Interfaz, IA y Hero». Verificado línea
  a línea: los cuatro hits de Hero (`#4a9fd4` en :27, :339, :341, :343 y
  `from-[#1a3a5c] to-[#4a9fd4]`) están **todos dentro de comentarios** que
  documentan colores ya eliminados en F1.3·e3. Son prosa histórica, no código.
  **No los "limpies": borrar esos comentarios borra el motivo por el que
  #4a9fd4 no debe volver** (daba 4.40:1 en su peor punto).
- **⚠️ Y EL GRADIENTE DE `SeccionIA.tsx:43` NO ES UN DESCUIDO — TIENE CONTRATO
  ESCRITO.** El propio archivo (:28) razona que `slate-900/800` es casi negro y
  `--lp-navy` es bastante más claro, o sea que **no son intercambiables**.
  Además `--lp-ink-inverse-50` tiene su contrato ESTRECHADO a esa caja
  precisamente por ser más oscura que navy: mide 5.23:1 sobre slate-900 y
  4.80:1 en el punto más claro del gradiente (ver el aviso en `globals.css`).
  **Sustituir el slate por navy rompe ese cálculo y tira el kicker de §5.4 por
  debajo de AA.** Si se tokeniza, hay que crear tokens para el gradiente, no
  reapuntarlo a los que ya hay.
- **Por qué no se aplicó:** los 8 de `SeccionInterfaz` son mecánicos pero tocan
  un mockup cuyo aspecto nadie iba a validar en esta tanda, y el de
  `SeccionIA` no es mecánico en absoluto (ver arriba). Cambiar color sin QA
  visual en la tanda previa al merge no compensa.
- **Condición de cierre:** los 8 de `SeccionInterfaz` migrados a `--lp-*` con
  QA visual del panel de flujo; el de `SeccionIA` resuelto **con tokens
  propios** y re-midiendo el kicker, o declarado excepción permanente en
  `globals.css` junto a la nota de `--lp-ink-inverse-50`.

### LP-DT-39 — Sin `scrollbar-gutter: stable`: la landing salta al abrir modal

- **Estado:** 🟠 abierta — **el fix es global y la landing no puede decidirlo
  sola**
- **Detectada:** auditoría de F6 (2026-08-02)
- **Descripción:** `globals.css` no declara `scrollbar-gutter` en ningún sitio
  (verificado: cero ocurrencias en todo el repo). En navegadores de escritorio
  con barra de scroll clásica —Windows, y Chrome/Firefox en Linux—, cuando algo
  bloquea el scroll del `<body>` la barra desaparece, el viewport gana ~15px de
  ancho y **todo el contenido centrado se desplaza lateralmente**. En la landing
  el disparador concreto es el modal de firma del Teaser 2
  (`FirmaCanvas.tsx`), que se monta en `document.body` vía portal.
- **⚠️ POR QUÉ NO SE APLICÓ, Y ES EL MOTIVO ENTERO:** el fix natural es una
  línea, `html { scrollbar-gutter: stable; }` — pero `globals.css` **lo
  comparte el producto entero**: login, agenda, expediente, visor DICOM,
  super-admin. Reservar el canal de la barra en `html` cambia el ancho útil de
  **todas** esas pantallas, incluidas las que ya reservan espacio por su cuenta
  o las que tienen scroll interno. Es un cambio de alcance global metido en la
  tanda previa al merge de una rama de landing, y esta tanda no audita el
  producto. Es exactamente el patrón que el Protocolo 1 de `CLAUDE.md`
  prohíbe.
  Acotarlo a `.font-lp` **no funciona**: el que scrollea es el `<html>`, no el
  `<div>` envolvente de la landing.
- **Alternativas, para quien lo retome:** (a) aplicarlo global de verdad, con
  QA de las pantallas del producto — es la salida limpia; (b) compensar el
  ancho de la barra con `padding-right` al bloquear el scroll, que es más
  código y más frágil; (c) aceptarlo: en macOS y en todo móvil las barras son
  superpuestas y el salto no existe.
- **Condición de cierre:** abrir y cerrar el modal de firma en Chrome/Windows
  sin desplazamiento lateral del contenido, y las pantallas del producto sin
  regresión de ancho.

### LP-DT-40 — F1.4 (convertir secciones de la landing a Server Components): **NO APLICABLE**

- **Estado:** ⚪ **DESCARTADA — no es deuda, es una fase que no procede**
- **Decidida:** auditoría de F6 (2026-08-02)
- **Qué proponía F1.4:** quitar `'use client'` de las secciones de la landing
  para reducir el JS enviado al visitante.
- **Por qué no procede, con la medición:** las **16** secciones de
  `src/components/landing/sections/` llevan `'use client'`, y **14 de las 16
  usan APIs que solo existen en cliente** — `useState`, `useRef`, `useScroll`,
  `useTransform`, `useReducedMotion`, `motion.*`, `whileInView`, `whileHover`,
  `onClick`. Contado por archivo:

  | secciones | ocurrencias de API de cliente |
  |---|---|
  | Hero, FAQ | 32 cada una |
  | Receta | 23 · Control 19 |
  | Nav, Historia 11 · Problema 10 · Expediente 9 · Interfaz 8 | |
  | CTA, Features, Precio, Seguridad 7 · Portabilidad 5 | |
  | **Footer, IA** | **0** |

  Las **dos** candidatas reales son `SeccionFooter` y `SeccionIA`. Y ninguna de
  las dos sirve: **las dos importan `Reveal`**, que es un componente de
  cliente. Convertirlas en Server Components no elimina ese import — lo deja
  igual, solo cambia quién lo declara. **El JS enviado sería prácticamente el
  mismo.**
- **Y el objetivo que F1.4 perseguía ya está cubierto por otra vía:** `/` se
  **prerenderiza estáticamente** (aparece como `○ (Static)` en la salida de
  `next build`). El visitante recibe el HTML completo de las 16 secciones desde
  el servidor, sin esperar a hidratar. Lo que F1.4 quería —HTML de servidor—
  ya lo da el prerender; lo que no daría es menos JS, que es lo que el párrafo
  anterior descarta.
- **⚠️ Consecuencia práctica:** **no abras una fase para esto.** Si alguien
  quiere reducir el JS de la landing, el trabajo real está en `motion` y en el
  árbol de `Reveal`/`Stagger`, no en mover directivas `'use client'` de sitio.
  Esa sí sería una fase con premisa medible, y sería otra.

### LP-DT-41 — Destello del formulario de /login antes del redirect por sesión válida
- **Estado:** 🔴 abierta
- **Detectada:** rediseño de /login (2026-08-03)
- **Descripción:** quien llega a `/login` **con sesión local válida** ve el
  formulario de acceso completo —logo, campos, botón— durante unas décimas
  antes de que la página lo mande a `/inicio`. No es un fallo de render: es el
  orden natural del flujo. `src/app/login/page.tsx` monta su árbol de forma
  síncrona y el redirect vive dentro del `useEffect`, colgado de la promesa de
  `supabase.auth.getSession()`. Entre pintar y resolver esa promesa hay un
  hueco, y en ese hueco lo que está en pantalla es la pantalla de "no tienes
  sesión" servida a alguien que sí la tiene.
- **Precisión sobre el nombre:** se le ha llamado "el destello de *comprobando
  sesión*", pero **no existe ninguna cadena con ese texto**: `grep -rn
  "omprobando" src/` no devuelve nada, y `SessionGuard.tsx` no pinta rótulo
  alguno (`return null`). Lo que destella es el formulario en sí. Se anota
  porque buscar ese literal para arreglarlo es perder una tarde.
- **Por qué NO se arregló en el rediseño:** está **fuera de scope por
  decisión explícita** de esa tanda. El arreglo no es visual —no se resuelve
  con un estado de carga bonito, que sería cambiar un destello por otro— sino
  **de flujo**: hay que decidir dónde se resuelve la sesión antes de pintar.
  Tocarlo obliga a entrar en el blindaje offline del `useEffect` (Sprint 3
  Hotfix), que es justo lo que la tanda tenía prohibido mover.
- **Direcciones posibles, ninguna elegida:** (a) resolver la sesión en
  servidor y redirigir antes de pintar, lo que choca de frente con el blindaje
  offline —que existe *porque* el proxy server-side empuja a `/login` en gray
  zone mientras la sesión de cliente sigue viva—; (b) un gate de carga en el
  layout de `/login` hasta que `getSession` resuelva, que cambia el destello
  por una espera y penaliza al visitante SIN sesión, que es el caso mayoritario
  y el legítimo. **La (b) es más barata y probablemente peor.** Cualquiera de
  las dos es una sesión propia con su auditoría.
- **Condición de cierre:** decisión de Angel sobre (a) o (b) y una tanda que
  pueda tocar la lógica de sesión.

### LP-DT-42 — `/privacidad` y `/privacy`: ruta duplicada sin canónica declarada
- **Estado:** 🔴 abierta
- **Detectada:** rediseño de /login (2026-08-03), al cambiar el enlace legal
  del pie de esa pantalla. Fuera de scope de esa tanda.
- **Descripción:** existen **dos rutas** para el mismo aviso de privacidad y
  ninguna está declarada como canónica:
  - `src/app/privacidad/page.tsx` → `<AvisoPrivacidadContent />`
  - `src/app/privacy/page.tsx` → `<AvisoPrivacidadContent />`

  Renderizan **el mismo componente**, con metadata equivalente. No hay
  redirect de una a otra, ni `alternates.canonical`, ni nada en el proxy que
  las reconcilie: las dos responden 200 con el mismo contenido.
- **Reparto actual de enlazadores** (`grep -rn '"/privacy"\|"/privacidad"' src/`),
  que es lo que hace que esto no sea teórico:
  - → **`/privacy`**: `SeccionFooter.tsx:91` (landing pública),
    `(app)/ayuda/page.tsx:270`, `login/page.tsx` (desde esta tanda).
  - → **`/privacidad`**: `pacientes/nuevo/page.tsx:480`,
    `QuickPatientModal.tsx:340`, `CommandPalette.tsx:392`,
    `ConsultaRapidaModal.tsx:458`, `TerminosContent.tsx:166,642`,
    `LegalLayout.tsx:61`, `Sidebar.tsx:355`.

  O sea: **la landing y `/login` apuntan a una, y casi toda la app logueada a
  la otra.** El rediseño de /login movió su enlace a `/privacy` por coherencia
  con el footer de la landing, no porque `/privacy` sea la canónica — no lo es
  todavía, porque nadie la ha declarado.
- **Por qué importa y no es cosmético:**
  1. **SEO** — contenido duplicado en dos URLs indexables sin `canonical`. Es
     el mismo tipo de problema que la verificación de recetas indexable que
     §10 del maestro tiene abierto.
  2. **Consentimiento** — el aviso de privacidad es el documento que §
     "Cumplimiento normativo" de `CLAUDE.md` exige antes de crear un paciente.
     Dos URLs vivas para el documento legal significa dos sitios donde puede
     divergir la versión si algún día una de las dos deja de leer el
     componente compartido. Hoy no divergen; el riesgo es estructural.
- **Lo que NO hay que hacer:** borrar una de las dos a secas. Ocho enlazadores
  apuntan a `/privacidad`, y hay enlaces vivos fuera del repo (correos,
  documentos ya enviados) que no se pueden reescribir. La salida es elegir
  canónica, poner un **redirect permanente** desde la otra y propagar los
  enlaces internos — no un `git rm`.
- **Decisión pendiente de Angel:** cuál de las dos es la canónica. `/privacy`
  tiene a su favor la coherencia con `/terms` y `/pricing`, que ya están en
  inglés; `/privacidad` tiene a su favor que es la que más enlaces internos
  concentra y la que probablemente está en enlaces externos.
- **Alcance estimado:** 1 redirect + 8 enlaces internos + verificar que ningún
  correo transaccional ya enviado apunte a la que se retire.

### LP-DT-43 — Rate-limit de login: consume presupuesto en logins EXITOSOS y no es atómico
- **Estado:** 🔴 abierta — **PRIORIDAD MÁXIMA, NO DIFERIBLE**
- **Detectada:** auditoría del cerrojo de doble envío de /login (2026-08-03)
- **Cuándo se ataca:** rama propia `fix/rate-limit-login`, en cuanto
  `feature/rediseno-login` esté mergeada. No se mete en la rama del rediseño.
- **Defecto (a) — el presupuesto se gasta aunque aciertes la contraseña.**
  `checkAuthRateLimit` inserta una fila por cada intento **recibido**
  (`src/lib/rateLimit.ts:88`), antes de saber si la contraseña es correcta:
  la llamada al endpoint sale en `src/app/login/page.tsx:130` y
  `signInWithPassword` no corre hasta `:161`. Ningún camino descuenta al
  acertar — los únicos `DELETE` de `ip_rate_limits` son la limpieza de filas
  ya vencidas (`rateLimit.ts:91-97`). Umbral **5 por email en ventana
  deslizante de 15 minutos** (`src/app/api/auth/rate-limit/route.ts:19`,
  corte en `rateLimit.ts:84`), y el producto **no expone ninguna vía de
  desbloqueo**: solo esperar.
- **Defecto (b) — `count` e `insert` no son atómicos.** El conteo
  (`rateLimit.ts:75-81`) y la inserción (`:88`) son dos viajes separados. Dos
  peticiones concurrentes pueden contar el mismo total y ambas insertar.
  **Verificado que no hay red de seguridad en la base:** la tabla solo tiene
  `PRIMARY KEY (id)` (`supabase/baseline/02_tables.sql:272-278`) y su único
  índice es un btree **no único** sobre `(ip, ruta, created_at)`
  (`supabase/baseline/03_indexes.sql:102-103`). Ni restricción única ni
  `UPSERT` que pueda apoyarse en una.
- **⚠️ RIESGO AL CORREGIR (a):** el reseteo del contador debe ocurrir **SOLO
  tras confirmación real de sesión válida**. Cualquier reseteo antes de esa
  confirmación convierte el limitador en fuerza bruta ilimitada. Este es el
  punto donde un arreglo apresurado es peor que el defecto.
- **VALIDACIÓN — ninguna herramienta automática cubre esto.** Ni `tsc`, ni
  `eslint`, ni `next build` ven nada aquí: no es un error de tipos ni de
  compilación, es comportamiento de la ruta de auth contra la base. Exige
  **prueba deliberada con escritura real en `ip_rate_limits` y `audit_log`.**
  - Aritmética a tener presente al medir: **una llamada exitosa a
    `login_email` inserta DOS filas**, no una — `login_email` para el email
    (`route.ts:39`) y `login_ip` para la IP (`route.ts:52`). Lo que hay que
    contar es la fila con `ruta = 'auth:login_email:<email>'`.
  - `ip_rate_limits` se escribe con `createAdminClient()` (service role,
    `rateLimit.ts:71,88`), así que **no es consultable desde el cliente**.
    Canal de medición que no necesita service role: el 200 del endpoint
    devuelve `remaining` (`route.ts:65`), calculado como `limite - total - 1`
    (`rateLimit.ts:99`). De ahí **`filas = 4 − remaining`** — es el servidor
    contando sus propias filas. Con un email inexistente y virgen el estado
    previo es 0 por construcción; cada ronda de prueba necesita un email
    distinto para no gastar el presupuesto de 5/15 min y contaminar la
    siguiente medición.
  - Sobre `audit_log`: con email inexistente el 200 del rate-limit **no
    escribe nada** (`logAudit` solo corre en las ramas `blocked`,
    `route.ts:41,54`). Lo que sí escribe es `/api/auth/audit-login` con
    `login_fallido` tras el `signInWithPassword` fallido
    (`login/page.tsx:229-233` → `logLogin({ success: false })`).
  - **⚠️ NOTA DE MÉTODO — verificada el 2026-08-03. El doble clic de Claude
    in Chrome NO reproduce la rendija del mismo tick.** Dispara dos `click`
    reales separados por **~1.5 ms**, y a esa distancia React 19 ya hizo el
    flush síncrono de `setLoading(true)`: el botón está `disabled` y **no
    emite el segundo `click`**. Consecuencia para quien vaya a validar esto:
    **un doble clic de extensión que sale limpio demuestra `disabled={loading}`
    (`login/page.tsx:469`), NO el cerrojo `submitLockRef`** — con el cerrojo
    roto el resultado sería idéntico, así que ese experimento no distingue
    una cosa de la otra y no vale como confirmación.
    Para **ejercer el cerrojo de verdad** hay que forzar dos `click()` en el
    **mismo task síncrono**, rellenando los campos con el **setter nativo de
    `HTMLInputElement`** + evento `input` (si no, React no toma el estado y
    se envía el formulario vacío). Resultado de esa prueba el 2026-08-03:
    **2 entradas al handler → 1 petición → 1 fila.** El cerrojo funciona.
- **Mitigación parcial ya en producción, que NO cierra esta deuda:** el
  cerrojo síncrono `submitLockRef` de `login/page.tsx:105,153-154` impide que
  un doble clic duplique el gasto. Reduce la sangría; no toca ninguno de los
  dos defectos de arriba.

### LP-DT-44 — Cobertura de lint perdida en `login/page.tsx` por el `try/finally`
- **Estado:** 🔴 abierta — aceptada conscientemente, revisar en versiones
  futuras del plugin
- **Detectada:** auditoría del cerrojo de doble envío de /login (2026-08-03)
- **Descripción:** el `try/finally` del cerrojo (`src/app/login/page.tsx:163`
  y `:251-266`) **desactiva el compilador de React sobre todo el componente**.
  No es un efecto colateral misterioso: es un bail-out **declarado** del
  propio plugin. En `eslint-plugin-react-hooks` 7.0.1,
  `cjs/eslint-plugin-react-hooks.development.js:23982-23988`:

  ```js
  if (hasNode(stmt.get('finalizer'))) {
    builder.errors.push({
      reason: `(BuildHIR::lowerStatement) Handle TryStatement with a finalizer ('finally') clause`,
      category: ErrorCategory.Todo,
  ```

  Es decir: el compilador **no sabe** bajar un `finalizer` a su HIR
  (`ErrorCategory.Todo` = funcionalidad no implementada, no error del código).
  Al no compilar el componente, **todas** las reglas respaldadas por el
  compilador dejan de emitir para él.
- **Consecuencia:** `react-hooks/set-state-in-effect` dejó de reportar y **el
  defecto del `useEffect` (`:107-140`) SIGUE VIVO, ahora invisible.** El
  archivo pasa el lint en verde sin que nadie lo haya arreglado.
- **Verificado que la causa es `finally` en exclusiva.** Seis componentes
  sintéticos con el mismo `useEffect` infractor, idénticos salvo el handler,
  bajo la config del repo: sin `try` **reporta**; `try/finally` calla;
  `try/catch` sin `finally` **reporta**; `try/catch/finally` calla;
  `try/finally` sin el flag `navegando` calla; `try/catch` **con** el flag
  `navegando` reporta. Ni `try` en general ni el flag tienen nada que ver.
  El bail-out es **por componente, no por archivo**: un séptimo caso con dos
  componentes en un mismo módulo —uno con el `finally`, otro con el efecto—
  sí reporta. En `login/page.tsx` coinciden en el mismo componente, y por eso
  ahí se pierde el archivo entero.
- **Se evaluó y se DESCARTÓ migrar a `try/catch`** para recuperar la regla:
  - El `return` del 429 (`:192`) sale sin pasar por el `catch` ni por el
    final del `try`: **quedaría sin liberar el ref**, cerrojo echado hasta
    recargar.
  - Las dos salidas normales tienen **requisitos opuestos** y caen en el mismo
    punto: la rama de credenciales (`:222-233`) debe liberar, la de éxito
    (`:234-250`) no debe. Una liberación al final del `try` reabriría el botón
    durante el hueco de `window.location.href` — el defecto exacto que
    `:251-265` existe para matar.
  - `finally` cubre **gratis** las salidas que alguien añada en el futuro;
    `catch` obliga a acordarse en cada una. Con tres puntos de liberación
    explícitos hoy no quedaría ningún camino suelto, pero el patrón es frágil
    por construcción.
- **⚠️ EL BASELINE DE ESLINT BAJÓ DE 212 A 211 Y ESO NO ES UNA MEJORA.** Es
  **un archivo menos analizado**, no un defecto corregido. Cualquiera que
  compare los dos números sin leer esta nota leerá progreso donde hay pérdida
  de cobertura. (211 verificado con `npx eslint .` el 2026-08-03.)
- **Condición de cierre:** que una versión futura de
  `eslint-plugin-react-hooks` implemente el lowering del `finalizer` — el
  `ErrorCategory.Todo` dice que está pendiente, no que sea imposible. Al
  actualizar el plugin, **volver a correr el lint sobre este archivo** y
  arreglar lo que reaparezca.

### LP-DT-45 — Botón de login inerte tras excepción
- **Estado:** 🔴 abierta
- **Detectada:** al auditar las salidas del handler de /login (2026-08-03)
- **Descripción:** en las rutas de **excepción** —`createClient()` (`:201`),
  `supabase.auth.signOut()` (`:208`), `supabase.auth.signInWithPassword()`
  (`:211`)— no se ejecuta ningún `setLoading(false)`. `loading` se queda en
  `true` desde `:164` y el `disabled={loading}` del botón (`:469`) lo deja
  **muerto hasta recargar la página**.
- **Es un defecto PREVIO al cerrojo de doble envío e independiente de él.**
  El `finally` (`:265`) **sí** libera `submitLockRef`; lo que no baja es el
  `disabled`. El ref suelto no sirve de nada mientras el atributo siga puesto.
  Conviene tenerlo escrito porque invita a diagnosticar mal: quien vea el
  botón muerto pensará que falló el cerrojo, y el cerrojo funcionó.

---

(Fin del registro actual. Nuevas etapas se añaden como secciones ## debajo.)
