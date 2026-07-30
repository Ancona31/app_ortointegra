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

---

(Fin del registro actual. Nuevas etapas se añaden como secciones ## debajo.)
