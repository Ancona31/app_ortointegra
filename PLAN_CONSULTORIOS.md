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
- Snapshot inmutable de nombre/alias/dirección/teléfono/timezone en
  `appointments` y `consultas`.
- TZ por consultorio (hora de pared del consultorio es la verdad).
- Selector "consultorio activo" en sidebar, visible solo si ≥2 consultorios.
- Modal de onboarding bloqueante al login si count = 0.
- Cambio automático silencioso del activo al iniciar consulta de cita con
  snapshot (toast informativo).
- Cada consultorio tiene un alias corto (máx 12 caracteres) para UI compacta
  + nombre completo para PDFs y documentos formales.

---

## FASE 2 — Backend (BD + APIs)

Orden de aplicación: una migración a la vez vía SQL Editor manual en
Supabase Dashboard. Auditar cada una con Claude Code antes de aplicar.
Todas las migraciones deben traer UP + DOWN explícitos.

### 2.1 — Migración SQL #1: crear tabla `consultorios`

**Archivo nuevo:** `supabase/migrations/AAAA_consultorios_01_table.sql`

DDL completo:
- Tabla `public.consultorios` con columnas: id, clinica_id, medico_id,
  nombre, alias, direccion, telefono, timezone, horario, es_default, activo,
  fecha_baja, created_at, updated_at.
- Columna `alias`: text NOT NULL, CHECK char_length BETWEEN 1 AND 12 (máx 12
  caracteres). Para UI compacta (agenda, sidebar, selector).
- FK `clinica_id → clinicas(id)` ON DELETE RESTRICT ON UPDATE NO ACTION.
- FK `medico_id → profiles(id)` ON DELETE RESTRICT ON UPDATE NO ACTION.
- Default del JSONB `horario`: 7 días con `activo: false`, estructura espejo
  de `clinicas.horario_consulta`.
- 3 índices: UNIQUE PARCIAL del default
  (`WHERE es_default = true AND activo = true`), parcial de activos
  (`WHERE activo = true`), simple de `clinica_id`.

Rollback: `DROP TABLE public.consultorios CASCADE;`

> NOTA: El campo `alias` y su CHECK constraint deben re-auditarse con Claude
> Code antes de aplicar esta migración. El usuario solicitó esta auditoría
> adicional explícitamente en Fase 1.

### 2.2 — Migración SQL #2: funciones y triggers de `consultorios`

**Archivo nuevo:** `supabase/migrations/AAAA_consultorios_02_triggers.sql`

3 funciones + 3 triggers:
- `update_consultorios_updated_at()` (sin SECURITY DEFINER, sin search_path).
  BEFORE UPDATE → NEW.updated_at = now().
- `enforce_cap_10_consultorios_activos()` (SECURITY DEFINER +
  SET search_path TO 'public'). BEFORE INSERT/UPDATE.
  Bloquea con `RAISE EXCEPTION` si
  COUNT(*) WHERE medico_id = NEW.medico_id AND activo = true >= 10.
- `enforce_consultorio_default_invariants()` (SECURITY DEFINER +
  SET search_path TO 'public'). BEFORE INSERT + BEFORE UPDATE.
  - INSERT: si no existe otro consultorio activo del médico → fuerza
    NEW.es_default = true.
  - UPDATE: bloquea archivar (activo true→false) o desmarcar
    (es_default true→false) cuando esto dejaría al médico sin default activo.

Rollback: DROP de los 3 triggers + DROP de las 3 funciones.

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
- ADD COLUMN `consultorio_id uuid REFERENCES public.consultorios(id)
  ON DELETE SET NULL ON UPDATE NO ACTION`.
- ADD COLUMN `consultorio_nombre text`.
- ADD COLUMN `consultorio_alias text` (nullable, sin backfill).
- ADD COLUMN `consultorio_direccion text`.
- ADD COLUMN `consultorio_telefono text`.
- ADD COLUMN `consultorio_timezone text`.
- ADD CONSTRAINT `<tabla>_consultorio_snapshot_check CHECK
  (consultorio_id IS NULL OR consultorio_nombre IS NOT NULL)`.
- CREATE INDEX `idx_<tabla>_consultorio ON <tabla>(consultorio_id)
  WHERE consultorio_id IS NOT NULL`.

Rollback: DROP de los índices, CONSTRAINTS y COLUMNS de ambas tablas.

> NOTA: La columna snapshot `consultorio_alias` debe re-auditarse con Claude
> Code antes de aplicar.

### 2.5 — APIs CRUD de `consultorios`

**Archivos nuevos:**
- `src/app/api/consultorios/route.ts` — GET (listar activos del médico
  autenticado), POST (crear).
- `src/app/api/consultorios/[id]/route.ts` — GET (uno), PATCH (editar),
  DELETE (archivar = UPDATE activo=false + fecha_baja=now()).
- `src/app/api/consultorios/[id]/marcar-default/route.ts` — PATCH (mueve el
  flag es_default; trigger T3 garantiza unicidad).

Reglas server-side:
- Validación de body con Zod.
- Validación de TZ contra lista IANA en API (no en BD).
- Validación de cap de 10 (defensa redundante con trigger T2).
- Validación de unicidad de default (defensa redundante con trigger T3).
- POST y PATCH aceptan campos `nombre` y `alias`.
- Si `alias` no se envía y `nombre.length <= 12`, autocompletar
  `alias = nombre` server-side.
- Validación: `alias` length entre 1 y 12.
- Mensajes de error legibles para el frontend.

### 2.6 — Actualizar APIs de creación de citas y consultas

**Archivos a modificar:**
- `src/app/api/appointments/route.ts`:
  - Aceptar `consultorio_id` en body.
  - Snapshot al INSERT: leer consultorio actual y copiar nombre, alias,
    dirección, teléfono y timezone a las columnas snapshot.
  - Construir `start_time` y `end_time` usando
    `fechaHoraLocalAInstante(fecha, hora, consultorio.timezone)` del módulo
    `dates.ts`.
  - Reemplazar literal `'America/Mexico_City'` en push a GCal por
    `consultorio.timezone`. Fallback a `'America/Mexico_City'` si NULL.
- `src/app/api/appointments/[id]/route.ts`:
  - PATCH: si se cambia `consultorio_id`, refrescar snapshot completo (incluye
    alias).
  - Misma lógica de TZ que el POST.
- `src/app/api/consultas/route.ts` (o donde se cree la consulta):
  - Si la consulta se crea desde una cita: copiar snapshot completo de cita a
    consulta (incluye alias).
  - Si es walk-in: snapshot del consultorio activo enviado por el cliente
    (incluye alias).

### 2.7 — Eliminar código muerto

**Archivo a borrar:** `src/lib/pdf/header.ts` (confirmado código muerto en
investigación I-1b).

---

## FASE 3 — Frontend (UI base)

### 3.1 — Tipos compartidos

**Archivo a modificar:** `src/types/index.ts`

- Añadir interfaz `Consultorio` con todos los campos de la tabla (incluido
  `alias`).
- Añadir `consultorio_id` y campos snapshot (incluido `consultorio_alias`) a
  `Appointment` y `Consulta`.

### 3.2 — Módulo de fechas

**Archivo a modificar:** `src/lib/dates.ts`

- La constante `TZ_CLINICA` deja de ser global. Los helpers que la usaban
  deben aceptar `timezone` como parámetro explícito.
- Mantener compatibilidad: si no se pasa timezone, usar fallback
  `'America/Mexico_City'`.

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
- Card con label "CONSULTORIO ACTIVO" + alias del consultorio + chevron.
- El selector muestra `consultorio.alias` (no `nombre`).
- Dropdown con lista plana de consultorios activos (alias) + check en el
  actual.
- Footer del dropdown: link "Gestionar consultorios" → `/perfil`.
- Al hacer click en otro consultorio: modal de confirmación "¿Cambiar a X
  consultorio?" → "Cancelar" / "Sí, cambiar".

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
  - Nombre (text, obligatorio, vacío + texto ayuda). Campo "Alias corto"
    (máx 12 caracteres) aparece debajo SOLO si el nombre escrito supera los
    12 caracteres. Si nombre ≤12, el alias se autocompleta server-side con
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
  completo (no el alias), dirección, teléfono, badge "Default" si aplica.
- Botones por card: "Editar" (modal completo, permite editar ambos campos:
  nombre y alias), "Editar horario" (modal de horario M1 + P1), "Marcar como
  default", "Archivar" (deshabilitado si es el único activo).
- Sección colapsable de "Archivados" debajo.

**Archivo nuevo:** `src/components/consultorios/EditConsultorioModal.tsx`

- Modal de edición completo: nombre, alias, dirección, teléfono, timezone.
- Sin campo horario (se edita en modal aparte).

**Archivo nuevo:** `src/components/consultorios/EditHorarioConsultorioModal.tsx`

- Reutiliza componente UI de "Horario de consulta" existente.
- Añade desplegable arriba (usando alias) para cambiar entre consultorios sin
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
  - El badge visual por consultorio usa el `alias` del consultorio, no el
    nombre completo.
  - Si médico tiene ≥2 consultorios activos: badge visible (N2-b). Si tiene 1
    solo, badge oculto.
  - Nota arriba del calendario: "Cada cita se muestra en la hora local de su
    consultorio."
- Layout de la card de evento en FullCalendar:
HH:MM - HH:MM
Nombre del paciente
📍 [alias del consultorio]
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
  cambiado a [alias] (consultorio de la cita)".
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
- Los PDFs usan `consultorio.nombre` (completo) en el membrete. El alias NO
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
- Verificar logs de Supabase por errores de trigger T2/T3.

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

## Decisiones pendientes de re-auditoría

- Antes de aplicar la migración 2.1 (creación de tabla `consultorios`),
  re-auditar con Claude Code la columna `alias` y su CHECK constraint.
- Antes de aplicar la migración 2.4 (ALTERs de `appointments` y `consultas`),
  re-auditar con Claude Code la nueva columna snapshot `consultorio_alias`.

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
