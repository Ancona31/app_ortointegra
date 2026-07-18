# Deuda técnica — Spinus

Registro central de deuda técnica detectada durante el trabajo de las etapas.
Cada entrada se agrupa por la etapa donde se detectó.

NO es lo mismo que CLAUDE.md (instrucciones permanentes para Claude Code) ni que
la sección "Fuera de alcance" de los planes operativos (deuda acotada a un
sub-paso específico). Aquí va deuda transversal que sobrevive a las etapas.

Estado: 🔴 abierta · 🟡 en progreso · 🟢 resuelta (se elimina al cerrar)

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

(Fin del registro actual. Nuevas etapas se añaden como secciones ## debajo.)
