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
- **Estado:** 🟡 abierta
- **Detectada:** Auditoría de seguridad (2026-06-02), EJE 6 del reporte de
  investigación cross-tenant.
- **Archivo afectado:** Policies de `storage.objects` en producción (no
  presentes en el repo).
- **Descripción:** Los 4 buckets de Supabase Storage (`clinica-logos`
  público, `documentos-pdf`, `firmas-medicos`, `labs-documentos` privados)
  tienen policies de `storage.objects` que NO están exportadas en el repo.
  El baseline `09_storage_buckets.sql` lo dice explícitamente. Si esas
  policies usan `get_clinica_id()` (que tras el trigger guardián de la
  Pieza 2 ya no es manipulable) o paths enumerables tipo
  `/<clinica_uuid>/...`, podrían ser vectores adicionales no auditados.
- **Fix pendiente:** Exportar las policies de `storage.objects` vía
  dashboard de Supabase o Management API, agregarlas al repo
  (`supabase/baseline/`), y auditarlas en una sesión del auditor de
  seguridad.
- **Cuándo atacar:** Sin urgencia (no se ha detectado breach activo).
  En sesión del auditor de seguridad de Spinus.
- **Relación con otras deudas:** Complementa el cierre de vulnerabilidades
  cross-tenant. Hace falta para tener visibilidad completa del modelo de
  seguridad.

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

---

(Fin del registro actual. Nuevas etapas se añaden como secciones ## debajo.)
