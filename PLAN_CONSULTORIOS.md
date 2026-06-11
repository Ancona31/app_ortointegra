# PLAN_CONSULTORIOS.md

> Plan de implementación de multiconsultorio en Spinus.
> Fase 1 cerrada. Este documento es el contrato de Fase 2 en adelante.
> Branch: `multiconsultorio`.

## Resumen ejecutivo

Multiconsultorio permite a cada médico tener hasta 10 consultorios activos
con dirección, teléfono, zona horaria y horario propios. Citas, consultas
y documentos quedan anclados a su consultorio vía snapshot inmutable.
El médico controla qué consultorio está "activo" en su sesión vía selector
en la sidebar.

Decisiones de producto consolidadas:
- 1 médico = N consultorios. NO se comparten entre médicos.
- Cap 10 activos por médico (archivados no cuentan).
- Soft delete vía `activo` boolean + `fecha_baja` timestamptz.
- Default obligatorio: 1 consultorio default activo por médico.
- Sin backfill: citas/consultas viejas quedan sin consultorio (nullable).
- Snapshot inmutable de nombre/nombre_corto/dirección/teléfono/timezone en
  `appointments` y `consultas`.
- TZ por consultorio (hora de pared del consultorio es la verdad).
- Selector "consultorio activo" en sidebar, visible solo si ≥2 consultorios.
- Modal de onboarding bloqueante al login si count = 0.
- Cambio automático silencioso del activo al iniciar consulta de cita con
  snapshot (toast informativo).
- Cada consultorio tiene un nombre corto (máx 12 caracteres) para UI compacta
  + nombre completo para PDFs y documentos formales.

---

## FASE 2 — Backend (BD + APIs)

Orden de aplicación: una migración a la vez vía SQL Editor manual en
Supabase Dashboard. Auditar cada una con Claude Code antes de aplicar.
Todas las migraciones deben traer UP + DOWN explícitos.

### 2.0 — Refactor de `src/lib/dates.ts`

Esta es la primera tarea de Fase 2, anterior a cualquier migración SQL. Se
hace en código TypeScript, NO en BD.

**Archivo a modificar:** `src/lib/dates.ts`

Cambios:
- La constante `TZ_CLINICA` deja de usarse directamente en los helpers
  consumidos por código de citas/consultas/documentos.
- Cambiar firmas de helpers para aceptar timezone como parámetro explícito:
  - `fechaHoraLocalAInstante(fecha: string, hora: string, timezone: string): string`
  - `hoyEnTZ(timezone: string): string`
  - Otros helpers que internamente usen TZ deben recibir el parámetro
    igualmente.
- Mantener compatibilidad para callers que aún no pasan timezone: si
  `timezone` es undefined, hacer fallback a `'America/Mexico_City'`. Esto
  evita romper código existente durante la transición.

Validación:
- `npx tsc --noEmit` debe pasar.
- Smoke test manual: la app sigue funcionando idéntico antes de la
  migración SQL (los callers actuales sin timezone usan el fallback).

Por qué va antes: la sección 2.6 (actualizar APIs de citas) consume estos
helpers con 3 args. Si no se refactoriza primero, 2.6 no compila.

### 2.1 — Migración SQL #1: crear tabla `consultorios`

**Archivo nuevo:** `supabase/migrations/AAAA_consultorios_01_table.sql`

DDL completo:
- Tabla `public.consultorios` con columnas: id, clinica_id, medico_id,
  nombre, nombre_corto, direccion, telefono, timezone, horario, es_default, activo,
  fecha_baja, created_at, updated_at.
- Columna `nombre_corto`: text NOT NULL, CHECK char_length BETWEEN 1 AND 12 (máx 12
  caracteres). Para UI compacta (agenda, sidebar, selector).
- FK `clinica_id → clinicas(id)` ON DELETE RESTRICT ON UPDATE NO ACTION.
- FK `medico_id → profiles(id)` ON DELETE RESTRICT ON UPDATE NO ACTION.
- Default del JSONB `horario`: estructura espejo de
  `clinicas.horario_consulta`, con todos los días en `activo: false`. Valores
  `inicio`/`fin` coinciden con los del default de `clinicas`:

```json
  {
    "lunes":     {"activo": false, "inicio": "09:00", "fin": "19:00"},
    "martes":    {"activo": false, "inicio": "09:00", "fin": "19:00"},
    "miercoles": {"activo": false, "inicio": "09:00", "fin": "19:00"},
    "jueves":    {"activo": false, "inicio": "09:00", "fin": "19:00"},
    "viernes":   {"activo": false, "inicio": "09:00", "fin": "19:00"},
    "sabado":    {"activo": false, "inicio": "09:00", "fin": "14:00"},
    "domingo":   {"activo": false, "inicio": "09:00", "fin": "14:00"}
  }
```

- 3 índices:

```sql
CREATE UNIQUE INDEX consultorios_default_unico ON public.consultorios (medico_id) WHERE es_default = true AND activo = true;
CREATE INDEX consultorios_medico_activo ON public.consultorios (medico_id) WHERE activo = true;
CREATE INDEX consultorios_clinica ON public.consultorios (clinica_id);
```

Rollback: `DROP TABLE public.consultorios CASCADE;`

### 2.2 — Migración SQL #2: funciones y triggers de `consultorios`

**Archivo nuevo:** `supabase/migrations/AAAA_consultorios_02_triggers.sql`

4 funciones + 4 triggers:
- `update_consultorios_updated_at()` (sin SECURITY DEFINER, sin search_path).
  BEFORE UPDATE → NEW.updated_at = now().
- `enforce_cap_10_consultorios_activos()` (SECURITY DEFINER +
  SET search_path TO 'public'). BEFORE INSERT/UPDATE.
  Bloquea con `RAISE EXCEPTION` si
  COUNT(*) WHERE medico_id = NEW.medico_id AND activo = true >= 10.
- `enforce_consultorio_default_insert()` (SECURITY DEFINER +
  SET search_path TO 'public'). BEFORE INSERT (row-level).
  - Si no existe otro consultorio activo del médico → fuerza
    NEW.es_default = true.
  - Único propósito: garantizar que el primer consultorio de un médico
    siempre nace como default.
- `enforce_consultorio_default_existencia()` (SECURITY DEFINER +
  SET search_path TO 'public'). AFTER UPDATE OR DELETE (statement-level).
  - Evalúa al final del statement: si para algún medico_id afectado, el
    COUNT(*) WHERE es_default = true AND activo = true es 0 → RAISE
    EXCEPTION. Es decir, garantiza la invariante "≥1 default activo"
    como propiedad del set, no fila por fila.
  - Esto permite que un UPDATE atómico de tipo
    `UPDATE consultorios SET es_default = (id = :target) WHERE medico_id = :m AND activo = true`
    funcione: el statement deja A=false y B=true simultáneamente, y el
    trigger valida que el conteo final = 1 al cierre del statement.
    El BEFORE-ROW no podría tolerar este transitorio.

Nota sobre unicidad y existencia:
- Unicidad del default ("≤1 default activo por médico"): garantizada por
  el índice UNIQUE PARCIAL de la sección 2.1.
- Existencia del default ("≥1 default activo por médico, cuando hay
  ≥1 activo"): garantizada por `enforce_consultorio_default_existencia`.
- Cap de 10 activos: garantizada por `enforce_cap_10_consultorios_activos`.

Rollback: DROP de los 4 triggers + DROP de las 4 funciones.

### 2.3 — Migración SQL #3: RLS de `consultorios`

**Archivo nuevo:** `supabase/migrations/AAAA_consultorios_03_rls.sql`

- `ALTER TABLE public.consultorios ENABLE ROW LEVEL SECURITY;`
- Policy `consultorios_select` (PERMISSIVE, SELECT, authenticated):
  `clinica_id = get_clinica_id() AND (medico_id = auth.uid() OR
  soy_admin_de_clinica() OR get_my_role() = 'secretaria')`.
- Policy `consultorios_insert` (PERMISSIVE, INSERT, authenticated):
  `medico_id = auth.uid() AND clinica_id = get_clinica_id() AND
  get_my_role() = 'medico'`.
- Policy `consultorios_gates_insert` (RESTRICTIVE, INSERT, authenticated):
  `clinica_no_suspendida() AND clinica_tiene_acceso()`.
- Policy `consultorios_update` (PERMISSIVE, UPDATE, authenticated):
  USING + WITH CHECK idénticos:
  `medico_id = auth.uid() AND clinica_id = get_clinica_id()`.
- Sin DELETE policy (archivado-only).

Rollback: DROP de las 4 policies + DISABLE RLS.

### 2.4 — Migración SQL #4: ALTERs de `appointments` y `consultas`

**Archivo nuevo:** `supabase/migrations/AAAA_consultorios_04_snapshot.sql`

Para CADA una de las 2 tablas (`appointments`, `consultas`):
- ADD COLUMN `consultorio_id uuid` (sin REFERENCES inline).
- ADD COLUMN `consultorio_nombre text`.
- ADD COLUMN `consultorio_nombre_corto text` (nullable, sin backfill).
- ADD COLUMN `consultorio_direccion text`.
- ADD COLUMN `consultorio_telefono text`.
- ADD COLUMN `consultorio_timezone text`.
- ADD CONSTRAINT `<tabla>_consultorio_snapshot_check CHECK
  (consultorio_id IS NULL OR consultorio_nombre IS NOT NULL)`.
- CREATE INDEX `idx_<tabla>_consultorio ON <tabla>(consultorio_id)
  WHERE consultorio_id IS NOT NULL`.

Tras los ADD COLUMN, añadir las FKs como CONSTRAINTs nombrados separados:

```sql
ALTER TABLE public.appointments ADD CONSTRAINT appointments_consultorio_id_fkey FOREIGN KEY (consultorio_id) REFERENCES public.consultorios(id) ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE public.consultas ADD CONSTRAINT consultas_consultorio_id_fkey FOREIGN KEY (consultorio_id) REFERENCES public.consultorios(id) ON DELETE SET NULL ON UPDATE NO ACTION;
```

Rollback: DROP de los índices, CONSTRAINTS (incluidos los FKs nombrados:
appointments_consultorio_id_fkey, consultas_consultorio_id_fkey) y COLUMNS
de ambas tablas.
NOTA: Si hubo escrituras posteriores al UP (es decir, hay filas con
consultorio_id IS NOT NULL), el rollback con DROP COLUMN pierde los
snapshots irreversiblemente. Antes de ejecutar el DOWN: hacer pg_dump o
COPY de las columnas snapshot de las filas afectadas como respaldo.
PostgreSQL no tiene DROP COLUMN reversible nativo.

### 2.5 — APIs CRUD de `consultorios`

**Archivos nuevos:**
- `src/app/api/consultorios/route.ts` — GET (listar activos del médico
  autenticado), POST (crear).
- `src/app/api/consultorios/[id]/route.ts` — GET (uno), PATCH (editar),
  DELETE (archivar = UPDATE activo=false + fecha_baja=now()).
- `src/app/api/consultorios/[id]/marcar-default/route.ts` — PATCH.
  Ejecuta un UPDATE atómico que cambia el es_default de TODOS los
  consultorios activos del médico en una sola sentencia:
  `UPDATE consultorios SET es_default = (id = :target_id), updated_at = now() WHERE medico_id = :medico_id AND activo = true`.
  Esto evita estados intermedios donde 0 o 2 consultorios tengan
  es_default = true. El índice UNIQUE PARCIAL garantiza unicidad final;
  `enforce_consultorio_default_existencia` (statement-level) garantiza
  existencia.

Reglas server-side:
- Validación de body con Zod.
- Validación de TZ contra lista IANA en API (no en BD).
- Validación de cap de 10 (defensa redundante con enforce_cap_10_consultorios_activos).
- Validación de unicidad de default (defensa redundante con el índice UNIQUE PARCIAL de 2.1).
- POST y PATCH aceptan campos `nombre` y `nombre_corto`.
- Si `nombre_corto` no se envía y `nombre.length <= 12`, autocompletar
  `nombre_corto = nombre` server-side.
- Validación: `nombre_corto` length entre 1 y 12.
- Mensajes de error legibles para el frontend.

### 2.6 — Actualizar APIs de creación de citas y consultas

**Archivos a modificar:**
- `src/app/api/appointments/route.ts`:
  - Aceptar `consultorio_id` en body.
  - Snapshot al INSERT: leer consultorio actual y copiar nombre, nombre_corto,
    dirección, teléfono y timezone a las columnas snapshot.
  - Construir `start_time` y `end_time` usando
    `fechaHoraLocalAInstante(fecha, hora, consultorio.timezone)` del módulo
    `dates.ts`.
  - Reemplazar literal `'America/Mexico_City'` en push a GCal por
    `consultorio.timezone`. Fallback a `'America/Mexico_City'` si NULL.
- `src/app/api/appointments/[id]/route.ts`:
  - PATCH: si se cambia `consultorio_id`, refrescar snapshot completo (incluye
    nombre_corto).
  - Misma lógica de TZ que el POST.
- `src/app/api/consultas/route.ts` (o donde se cree la consulta):
  - Si la consulta se crea desde una cita: copiar snapshot completo de cita a
    consulta (incluye nombre_corto).
  - Si es walk-in: snapshot del consultorio activo enviado por el cliente
    (incluye nombre_corto).

### 2.7 — Eliminar código muerto

**Archivo a borrar:** `src/lib/pdf/header.ts` (confirmado código muerto en
investigación I-1b).

---

## FASE 3 — Frontend (UI base)

### 3.1 — Tipos compartidos

**Archivo a modificar:** `src/types/index.ts`

- Añadir interfaz `Consultorio` con todos los campos de la tabla (incluido
  `nombre_corto`).
- Añadir `consultorio_id` y campos snapshot (incluido `consultorio_nombre_corto`) a
  `Appointment` y `Consulta`.

### 3.2 — Módulo de fechas

Movido a sección 2.0 (inicio de Fase 2). Ver allí.

### 3.3 — Hook de consultorios

**Archivo nuevo:** `src/hooks/useConsultorios.ts`

- SWR fetcher contra `/api/consultorios` que devuelve lista de activos.
- Cache offline en `secureStorage` siguiendo el patrón de `useMedicoInfo`
  y `useClinica`.
- Expone: `consultorios`, `consultorioDefault`, `isLoading`, `mutate`.

### 3.4 — Context Provider del consultorio activo

**Archivo nuevo:** `src/contexts/ConsultorioActivoContext.tsx`

- React Context global.
- Estado: `consultorioActivo` (objeto completo).
- Persistencia: `sessionStorage` (sobrevive F5, se borra al cerrar
  pestaña/logout).
- Al montar: si sessionStorage tiene valor → usarlo. Si no → cargar default
  desde useConsultorios.
- Exposed: `consultorioActivo`, `cambiarActivo(consultorio)`, `isLoading`.
- `cambiarActivo` NO dispara confirmación; la confirmación vive en el
  componente del selector.

### 3.5 — Componente del selector de consultorio activo

**Archivo nuevo:** `src/components/sidebar/ConsultorioActivoSelector.tsx`

- Visible solo si `consultorios.length >= 2`.
- Card con label "CONSULTORIO ACTIVO" + nombre corto del consultorio + chevron.
- El selector muestra `consultorio.nombre_corto` (no `nombre`).
- Dropdown con lista plana de consultorios activos (nombre_corto) + check en el
  actual.
- Footer del dropdown: link "Gestionar consultorios" → `/perfil`.
- Al hacer click en otro consultorio: modal de confirmación "¿Cambiar a X
  consultorio?" → "Cancelar" / "Sí, cambiar".

Verificación obligatoria (de auditoría):
Implementar fallback en el render: si `consultorio.nombre_corto` es NULL
(caso edge: snapshot heredado antes de que la API poblara el campo, o
datos sembrados manualmente sin nombre_corto), mostrar `consultorio.nombre`
truncado a 12 caracteres en su lugar. NO mostrar string vacío. Esta
verificación es obligatoria porque toda fila legacy nace con
`consultorio_nombre_corto` NULL desde el día 1 post-deploy.

**Archivo a modificar:** `src/components/sidebar/Sidebar.tsx` (o equivalente,
identificar en Fase 3 inicial).

- Insertar `<ConsultorioActivoSelector />` debajo del bloque
  nombre+especialidad del médico.

### 3.6 — Modal de onboarding bloqueante

**Archivo nuevo:** `src/components/consultorios/OnboardingConsultorioModal.tsx`

- Bloqueante (sin X, sin cancelar).
- Layout single-step.
- Título: "Configura tu consultorio".
- Texto explicativo (2 líneas): "Spinus ahora soporta múltiples consultorios.
  Configura tu consultorio principal para continuar."
- Campos:
  - Nombre (text, obligatorio, vacío + texto ayuda). Campo "Nombre corto"
    (máx 12 caracteres) aparece debajo SOLO si el nombre escrito supera los
    12 caracteres. Si nombre ≤12, el nombre corto se autocompleta server-side con
    el mismo valor.
  - Dirección (text, obligatorio, pre-llenado desde
    `profiles.direccion_consultorio`).
  - Teléfono (text, opcional, pre-llenado desde
    `profiles.telefono_consultorio`).
  - Timezone (selector de 3 opciones rápidas + "Otra zona" → buscador IANA,
    obligatorio, sin pre-marcar). Pista debajo: zona detectada del navegador.
- Leyenda encima del botón: "Configuración completa disponible en tu perfil."
- Botón "Guardar consultorio" deshabilitado hasta que los 3 obligatorios
  estén llenos.
- Al guardar: POST `/api/consultorios` → toast "Consultorio creado. Puedes
  agregar más consultorios desde tu perfil → Mis consultorios." → modal
  cierra.

**Archivo a modificar:** layout principal autenticado (probablemente
`src/app/(app)/layout.tsx` o equivalente, identificar en Fase 3 inicial).

- Después de cargar `useConsultorios`: si rol = medico Y
  `consultorios.length === 0` → renderizar modal bloqueante.

### 3.7 — Sección "Mis consultorios" en Mi perfil

**Archivo a modificar:** `src/app/(app)/perfil/page.tsx` (o equivalente).

- Reemplazar la sección actual "CONSULTORIO" (Dirección + Teléfono).
- Nueva sección "MIS CONSULTORIOS" con sub-leyenda: "Requerido en recetas y
  documentos. Hasta 10 consultorios activos por médico."
- Botón "+ Agregar consultorio".
- Lista de cards (una por consultorio activo): cada card muestra el `nombre`
  completo (no el nombre corto), dirección, teléfono, badge "Default" si aplica.
- Botones por card: "Editar" (modal completo, permite editar ambos campos:
  nombre y nombre_corto), "Editar horario" (modal de horario M1 + P1), "Marcar como
  default", "Archivar" (deshabilitado si es el único activo).
- Sección colapsable de "Archivados" debajo.

**Archivo nuevo:** `src/components/consultorios/EditConsultorioModal.tsx`

- Modal de edición completo: nombre, nombre_corto, dirección, teléfono, timezone.
- Sin campo horario (se edita en modal aparte).

**Archivo nuevo:** `src/components/consultorios/EditHorarioConsultorioModal.tsx`

- Reutiliza componente UI de "Horario de consulta" existente.
- Añade desplegable arriba (usando nombre_corto) para cambiar entre consultorios sin
  cerrar.
- Pre-seleccionado en el consultorio del cual se abrió.

### 3.8 — Selector de consultorio en formulario de cita y render en agenda

**Archivo a modificar:** `src/app/(app)/agenda/page.tsx`

- Añadir campo "Consultorio" al modal de crear/editar cita.
- Pre-llenado con el consultorio activo del header (decisión L1).
- Editable libremente.
- NO se sincroniza si el activo del header cambia con el formulario abierto.
- FullCalendar config:
  - `timeZone="local"` (modo "respeta offset embebido en cada ISO").
- Render de eventos:
  - El badge visual por consultorio usa el `nombre_corto` del consultorio, no el
    nombre completo.
  - Si médico tiene ≥2 consultorios activos: badge visible (N2-b). Si tiene 1
    solo, badge oculto.
  - Nota arriba del calendario: "Cada cita se muestra en la hora local de su
    consultorio."
  - Fallback obligatorio: si `consultorio_nombre_corto` (snapshot de la
    cita) es NULL, el badge usa `consultorio_nombre` truncado a 12 caracteres.
    Esta verificación es obligatoria porque las citas legacy y las creadas
    antes de que la API poble nombre_corto tendrán este campo en NULL.
- Layout de la card de evento en FullCalendar:
HH:MM - HH:MM
Nombre del paciente
📍 [nombre_corto del consultorio]
● Estado
  La línea de consultorio aparece SOLO si el médico tiene ≥2 consultorios
  activos (N2-b).

### 3.9 — Botón "Horario de consulta" desde agenda

**Archivo a modificar:** `src/app/(app)/agenda/page.tsx`

- Al hacer click, abrir `EditHorarioConsultorioModal` con desplegable visible,
  pre-seleccionado en el consultorio activo (G2-b + M1 + P1).

### 3.10 — Cambio automático del activo al iniciar consulta

**Archivos a modificar (todos los puntos de entrada de "Iniciar consulta"):**
- Card de "Próximas citas" en dashboard.
- Eventos clickeables en agenda.
- Expediente → "Nueva consulta" desde una cita pendiente.

Lógica:
- Si la cita tiene `consultorio_id` snapshot Y es distinto al activo actual:
  cambiar activo silenciosamente + toast informativo "Consultorio activo
  cambiado a [nombre_corto] (consultorio de la cita)".
- Si no tiene snapshot: no hacer nada (CC1).

Walk-in (sin cita previa): el médico selecciona consultorio manualmente desde
el formulario de consulta.

---

## FASE 4 — Documentos (los 8)

Para cada uno de los 8 documentos, en este orden:
1. Receta médica
2. Solicitud de laboratorio
3. Solicitud de imagen
4. Plan de suplementación
5. Solicitud de internamiento
6. Escrito médico
7. Consentimiento informado
8. Honorarios / cotización

### 4.1 — PdfHeader compartido

**Archivo a modificar:** `src/lib/pdf/PdfHeader.tsx`

- Reemplazar lectura de `medico.direccion_consultorio` por
  `consultorio.direccion` recibido como prop.
- Misma lógica para `consultorio.telefono`.
- Los PDFs usan `consultorio.nombre` (completo) en el membrete. El nombre_corto NO
  aparece en PDFs.
- Si no se recibe consultorio (consultas viejas): fallback al activo actual
  del médico.

### 4.2 — Forms de los 8 documentos

**Archivos a modificar (uno por documento):**
- `src/components/documentos/RecetaForm.tsx`
- `src/components/documentos/SolicitudLabForm.tsx`
- `src/components/documentos/SolicitudImagenForm.tsx`
- `src/components/documentos/PlanSuplementacionForm.tsx`
- `src/components/documentos/SolicitudInternamientoForm.tsx`
- `src/components/documentos/EscritoMedicoForm.tsx`
- `src/components/documentos/ConsentimientoInformadoForm.tsx`
- `src/components/documentos/NotaHonorariosForm.tsx`

Cambios uniformes en cada uno:
- Leer consultorio activo del Context.
- Empaquetar `consultorio` (no `medico.direccion_consultorio`) al generar el
  PDF.
- Si el documento se genera desde una consulta con `consultorio_id` snapshot:
  usar ese snapshot, no el activo.

### 4.3 — Fix del bug del +1 día en valor inicial de fecha

**En los 8 forms**: reemplazar
`new Date().toISOString().split('T')[0]`
por
`hoyEnTZ(consultorio.timezone)` (del módulo `dates.ts`).

### 4.4 — Receta pública (vista del paciente)

**Archivo a modificar:** `src/app/r/[folio]/page.tsx`

- Reemplazar fallback `'America/Mexico_City'` por
  `receta.consultorio_timezone` del snapshot.
- Si NULL (receta vieja): fallback a `'America/Mexico_City'`.

---

## FASE 5 — Super admin

### 5.1 — Endpoint detalle de clínica

**Archivo a modificar:**
`src/app/api/super-admin/dashboard/clinicas/[id]/route.ts`

- Añadir query a Promise.all:
  `supabase.from('consultorios').select('id', { count: 'exact', head: true
  }).eq('clinica_id', id).eq('activo', true)`.
- Devolver `metricas.consultorios = count` en el shape.

### 5.2 — Tipos

**Archivo a modificar:** `src/lib/super-admin/types.ts`

- Añadir `consultorios: number` a `ClinicaDetalle.metricas`.

### 5.3 — Vista detalle de clínica

**Archivo a modificar:**
`src/app/super-admin/dashboard/clinicas/[id]/page.tsx`

- Añadir `<MetricSmall>` para "Consultorios activos" en la fila.
- Riesgo conocido: grid actual es `grid-cols-4`. Ajustar a `grid-cols-5` o
  reorganizar a 2 filas.

---

## FASE 6 — QA y rollout

### 6.1 — Smoke tests en producción (post-deploy de cada fase)
- Crear consultorio.
- Editar consultorio.
- Archivar consultorio (verificar bloqueo si es el único).
- Marcar otro como default.
- Crear cita con consultorio asignado.
- Generar receta y validar dirección correcta.
- Iniciar consulta desde Próximas citas y validar cambio automático del
  activo.
- Smoke test de cita vieja sin snapshot: regenerar PDF debe usar activo
  actual.

### 6.2 — Aviso a médicos
- WhatsApp a los 3 médicos el día del deploy:
  "Verán un modal de 30 segundos al entrar para configurar su consultorio.
  Ya tiene su dirección actual pre-llenada."

### 6.3 — Monitoreo
- Sentry 48h post-deploy.
- Verificar logs de Supabase por errores de enforce_cap_10_consultorios_activos, enforce_consultorio_default_insert y enforce_consultorio_default_existencia.

### 6.4 — Cierre
- Documentar en `DEUDA_TECNICA.md`:
  - Deprecar `profiles.direccion_consultorio` y
    `profiles.telefono_consultorio` (post-multiconsultorio).
  - Deprecar `clinicas.horario_consulta` (post-multiconsultorio).
  - Escritura a Google Calendar (proyecto separado futuro).

---

## Fuera de alcance (deuda explícita)

- Backfill de citas/consultas viejas.
- Reportes/estadísticas por consultorio.
- Vinculación paciente↔consultorio.
- Escritura a Google Calendar.
- Migración de TZ en `api/labs/mediciones/route.ts` (corregido en proyecto
  precursor pero no usa TZ por consultorio).

---

## Notas para Fase 2.5 (API) — ajustes detectados en auditoría

Estos 3 puntos no afectan el SQL de las migraciones 2.1 ni 2.4 (ya
auditadas y aprobadas), pero deben aplicarse al implementar la capa API
en Fase 2.5.

### A. Regla del PATCH cuando `nombre` cambia a >12 chars sin enviar `nombre_corto`

Escenario: el médico edita un consultorio existente cambiando solo el
`nombre` de "CDMX" (4 chars) a "Hospital Ángeles del Pedregal" (29 chars).
El body del PATCH NO incluye `nombre_corto`.

Regla obligatoria en el endpoint PATCH:
- Si el body NO contiene `nombre_corto` explícitamente: conservar el
  `nombre_corto` previo intacto. NO re-derivar desde el nuevo `nombre`.
- Solo re-autocompletar `nombre_corto = nombre` cuando el cliente mande
  explícitamente `nombre_corto: null` o `nombre_corto: ''` Y el nuevo
  `nombre.length <= 12`.

Esto evita que un PATCH parcial deje el consultorio en estado inválido
por el CHECK de BD.

### B. Validación Zod: trim + rechazar whitespace-only

El CHECK de BD `char_length(nombre_corto) BETWEEN 1 AND 12` acepta
`"   "` (3 espacios). Para evitar `nombre_corto` inútil:
- En el schema Zod de POST y PATCH: aplicar `.trim()` ANTES de validar.
- Validar que el resultado del trim tenga `length >= 1`.
- El trim aplica también a `nombre` por simetría.

### C. Asimetría JS .length vs char_length (Postgres)

Para texto BMP normal (español, ASCII): `string.length` (JS) y
`char_length(text)` (Postgres) coinciden.

Para emojis y caracteres astrales: divergen. JS cuenta unidades UTF-16
(emoji = 2), Postgres cuenta code points (emoji = 1).

Implicación: la validación de longitud en API usando `.length` es más
estricta que la de BD. Si alguien mete un emoji, API podría rechazar
algo que la BD aceptaría. No es bug — es asimetría conocida y aceptada.
No requiere acción correctiva. Documentado aquí para evitar perseguir
un "bug" fantasma en el futuro.

---

## Protocolos de trabajo

- Branch: `multiconsultorio`.
- SQL: vía SQL Editor manual en Supabase Dashboard.
- Cada migración: auditada con Claude Code (read-only) antes de aplicar.
- Cada migración: trae UP + DOWN explícitos.
- Backup de Supa solo para escenarios catastróficos.
- TypeScript: `npx tsc --noEmit` antes de commit. NUNCA `npm run build`.
- Commits manuales por el usuario. Claude Code NO commitea ni pushea.
- Plan auditado completo: este documento es el contrato. Cambios requieren
  actualizar este documento primero.
