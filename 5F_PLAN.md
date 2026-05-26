# 5.F — Plan de ejecución: policies de `consultas` (privacidad bidireccional + gate de suscripción)

> **Estado:** Diseño — pendiente de auditoría
> **Fecha:** 2026-05-26
> **Sub-paso de:** Etapa 5 (refactor de roles M:N)
> **Pre-requisitos:** 5.B, 5.C, 5.E aplicados (verificado)
> **Documentos de referencia:** ETAPA5_PLAN.md (§5.F), ROLES_POST_REFACTOR.md, 5E_CONSOLIDADO.md

## 1. Objetivo

Reescribir las policies RLS de la tabla `consultas` para implementar la **privacidad bidireccional** del modelo de roles M:N (invariante 22): un médico ve solo SUS consultas; el admin de clínica ve todas las de su clínica. Adicionalmente, añadir un **gate RESTRICTIVE de suscripción** a la creación de consultas, alineándolo con el que `pacientes` ya tiene (5.E), cerrando las deudas C.2.a (estado 'vencido' no bloqueado) y C.2.b (clínica suspendida no bloqueada).

## 2. Estado actual (confirmado por investigación)

- `consultas` tiene hoy 4 policies — `clinica_select`, `clinica_insert`, `clinica_update`, `clinica_delete` — todas PERMISSIVE, todas `TO authenticated`. Todas filtran SOLO por clínica vía `EXISTS (SELECT 1 FROM pacientes p WHERE p.id = consultas.paciente_id AND p.clinica_id = get_clinica_id())`. No discriminan por médico.
- `consultas` NO tiene columna `clinica_id` propia — la clínica se deriva vía `paciente_id → pacientes.clinica_id`.
- `consultas.medico_id` existe (añadida en 5.B.1), es `uuid` NULLABLE, FK a `profiles(id)` ON DELETE SET NULL, con índice `idx_consultas_medico`.
- La tabla es inmutable por diseño NOM-004: el endpoint `[id]/route.ts` devuelve 403 hard a PUT/DELETE. El único punto de escritura de cliente es el INSERT de `api/consultas/route.ts`.
- **Deuda NOM-004 confirmada:** el INSERT de `api/consultas/route.ts` NO setea `medico_id`. Hoy toda consulta nueva nace con `medico_id` NULL.
- El gate de suscripción de consultas vive hoy inline en `api/consultas/route.ts` (~líneas 18-38) y solo bloquea el estado 'cancelado' (con la condición adicional de >5 pacientes activos). NO cubre 'vencido' ni la columna `suspendida`.
- Estados de `clinicas.suscripcion_estado` (CHECK): 'free', 'trial', 'activo', 'vencido', 'cancelado'. `suspendida` es columna BOOL aparte.

## 3. Decisiones cerradas

| ID | Decisión |
|---|---|
| D-orden | El cableado de `medico_id` en `api/consultas/route.ts` (Paso 1) se despliega ANTES de aplicar las policies nuevas (Paso 3). Evita la ventana en la que una consulta nueva (aún con `medico_id` NULL) quedaría invisible para su creador bajo las policies nuevas. |
| D-gate | 5.F incluye un gate RESTRICTIVE de suscripción para `consultas` (`consultas_gates_insert`), además de las 4 policies de privacidad. |
| D-gate-helpers | El gate usa `clinica_no_suspendida() AND clinica_tiene_acceso()`. NO incluye `clinica_dentro_de_limite()` — el tope de pacientes free se aplica al crear pacientes, no consultas; una clínica free debe poder crear consultas ilimitadas sobre sus pacientes existentes. |
| D-excliente | Una clínica que pagó, luego canceló, y hoy tiene ≤5 pacientes activos: NO puede crear consultas. Se alinea con el comportamiento de `pacientes` (que usa `clinica_tiene_acceso()`, el cual bloquea a todo ex-cliente con `ha_tenido_acceso_premium = true` sin importar el conteo). Consistencia entre tablas. |
| D-legacy | Las consultas legacy con `medico_id IS NULL` son visibles solo para el admin de clínica (y super_admin). No se backfillean las consultas legacy — decisión heredada del plan. |
| D-ui | El aviso de UI "estás viendo solo tus notas" en el expediente NO entra en 5.F. Se anota y se decide al final del sub-paso. |

## 4. Los 4 pasos de ejecución

### Paso 1 — Endpoint: cablear `medico_id` + alinear el guard de suscripción (código, deploy Vercel)

En `src/app/api/consultas/route.ts`:

a) **Cablear `medico_id`** en el objeto del `.insert()` a la tabla `consultas`: añadir `medico_id: user.id` (el id del usuario autenticado, que el endpoint ya carga vía `auth.getUser()`). Esto hace que toda consulta nueva nazca asociada a su médico.

b) **Alinear el guard de suscripción inline.** El guard actual (~líneas 18-38) solo cubre 'cancelado' + >5 pacientes. Reemplazarlo / extenderlo para que bloquee los mismos casos que el gate RESTRICTIVE del Paso 3 cubrirá: clínica suspendida, y clínica sin acceso (ex-cliente 'vencido' o 'cancelado'). El propósito del guard del endpoint es devolver un HTTP 403 con un **mensaje claro** ANTES de que el INSERT toque la BD — porque si el INSERT lo bloquea solo la policy RESTRICTIVE, el error que llega al frontend es un genérico de Postgres sin contexto. El guard del endpoint y la policy RESTRICTIVE son defensa redundante a propósito: el guard da UX, la policy da garantía.

Este paso se despliega y se verifica en localhost ANTES de continuar al Paso 3.

### Paso 2 — Snapshot lógico

Antes de tocar la BD, capturar la definición de las 4 policies actuales de `consultas` (vía `pg_policy` / `pg_get_expr`). Es la red de rollback del Paso 3.

### Paso 3 — BD: reescribir las policies de `consultas` (SQL al Dashboard, DO block atómico)

Script con `BEGIN; ... COMMIT;`, pre-flight (verifica que existen las 4 policies viejas), DROP de las 4 viejas, CREATE de las 5 nuevas, post-flight (verifica que quedan exactamente las 5 nuevas).

**SQL propuesto (BORRADOR — pendiente de auditoría):**

```sql
-- DROP de las 4 policies viejas
DROP POLICY IF EXISTS clinica_select ON public.consultas;
DROP POLICY IF EXISTS clinica_insert ON public.consultas;
DROP POLICY IF EXISTS clinica_update ON public.consultas;
DROP POLICY IF EXISTS clinica_delete ON public.consultas;

-- SELECT: el médico ve sus consultas; el admin ve todas las de su clínica;
-- las consultas legacy (medico_id NULL) las ve solo el admin.
CREATE POLICY consultas_select ON public.consultas
  FOR SELECT TO authenticated
  USING (
    public.paciente_pertenece_a_mi_clinica(paciente_id)
    AND (
      public.soy_admin_de_clinica()
      OR medico_id = auth.uid()
    )
  );

-- INSERT: el paciente debe pertenecer a la clínica del caller,
-- y el medico_id de la consulta debe ser el propio caller.
CREATE POLICY consultas_insert ON public.consultas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.paciente_pertenece_a_mi_clinica(paciente_id)
    AND medico_id = auth.uid()
  );

-- UPDATE: solo el creador o el admin de clínica.
CREATE POLICY consultas_update ON public.consultas
  FOR UPDATE TO authenticated
  USING (
    public.paciente_pertenece_a_mi_clinica(paciente_id)
    AND (public.soy_admin_de_clinica() OR medico_id = auth.uid())
  )
  WITH CHECK (
    public.paciente_pertenece_a_mi_clinica(paciente_id)
    AND (public.soy_admin_de_clinica() OR medico_id = auth.uid())
  );

-- DELETE: solo el creador o el admin de clínica.
-- (La app no hace DELETE de cliente — [id]/route.ts da 403 hard —
--  pero la policy se define por completitud y coherencia.)
CREATE POLICY consultas_delete ON public.consultas
  FOR DELETE TO authenticated
  USING (
    public.paciente_pertenece_a_mi_clinica(paciente_id)
    AND (public.soy_admin_de_clinica() OR medico_id = auth.uid())
  );

-- Gate RESTRICTIVE de suscripción para INSERT.
CREATE POLICY consultas_gates_insert ON public.consultas
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.clinica_no_suspendida()
    AND public.clinica_tiene_acceso()
  );
```

**Notas de diseño del SQL (a verificar en la auditoría):**

- Anti-recursión: las policies de `consultas` usan `paciente_pertenece_a_mi_clinica()` (consulta la tabla `pacientes`, no `consultas`) y `soy_admin_de_clinica()` / `clinica_*()` (consultan `profiles` / `clinicas`). Ninguna consulta `consultas` → sin recursión. El plan de ETAPA5_PLAN.md §5.F lo confirma explícitamente.
- El manejo de `medico_id IS NULL` (consulta legacy) en la policy SELECT: una consulta legacy tiene `medico_id` NULL → `medico_id = auth.uid()` es NULL (falso) → solo la ve quien pase `soy_admin_de_clinica()`. Es el comportamiento deseado (D-legacy).
- `super_admin`: opera vía `service_role`, que bypasa RLS — no necesita rama explícita en estas policies. (Verificar en la auditoría que esto es consistente con cómo 5.E trató al super_admin.)

### Paso 4 — Verificación + smoke test

Smoke test con sesiones simuladas (`SET LOCAL request.jwt.claims` dentro de `BEGIN...ROLLBACK`), cubriendo DOS ejes por separado:

**Eje privacidad:**

- Médico A crea una consulta → la ve.
- Médico B (misma clínica, no es médico tratante de esa consulta) → NO la ve.
- Admin de clínica → ve la consulta de A y la de B.
- Consulta legacy (`medico_id` NULL) → visible solo para el admin.

**Eje gate de suscripción:**

- Clínica con `suspendida = true` → NO puede INSERT una consulta.
- Clínica ex-cliente cancelada (`ha_tenido_acceso_premium = true`, sin pago activo) → NO puede INSERT.
- Clínica con suscripción activa → SÍ puede INSERT.
- Clínica free de buena fe → SÍ puede INSERT.

**No regresión:** crear una consulta como médico normal desde la app funciona end-to-end.

### Paso 5 — Checkpoint

Archivo de migración registrado en `supabase/migrations/` + commit. Sincronizar `ETAPA5_PLAN.md` (marcar 5.F como aplicado, entrada en la Bitácora §8).

## 5. Impacto en el código existente (de la investigación)

Las lecturas de `consultas` cambian de semántica automáticamente al aplicar las policies. Puntos a vigilar en el smoke test / verificación:

- `expediente/[id]/page.tsx` — la lista de consultas del paciente. Un médico verá solo las suyas. Es el cambio de UX más visible (ver D-ui).
- `dashboard/page.tsx`, `api/me/stats/route.ts`, `api/me/estadisticas/route.ts`, `api/me/seguimientos/route.ts` — conteos y "actividad reciente"; pasan a contar solo lo del médico. Verificar que la semántica resultante es la deseada.
- `consulta/[consultaId]/page.tsx` — abrir por URL una consulta de otro médico devolverá null; la UI debe manejar el null sin romperse.
- `api/consultas/[id]/addendum/route.ts` — su verificación previa de la consulta dependerá de la nueva policy SELECT.
- Endpoints de super-admin — usan `service_role`, NO afectados (confirmar en la auditoría).
- `api/paciente/[id]/exportar/route.ts` (ARCO) — verificar si usa cliente de usuario o `service_role`.

## 6. Rollback y mitigación

- **Paso 1 (endpoint):** rollback vía `git revert` del commit + redeploy.
- **Paso 3 (policies):** rollback restaurando las 4 policies viejas desde el snapshot del Paso 2 (DROP de las 5 nuevas + CREATE de las 4 viejas).
- **Acoplamiento:** si el Paso 3 se revierte pero el Paso 1 ya está desplegado, no hay ruptura — las consultas nuevas seguirán teniendo `medico_id` poblado, y las policies viejas (solo por clínica) las muestran igual. El cableado de `medico_id` es inofensivo bajo las policies viejas.
- **Datos:** 5.F no hace backfill ni migración de datos. No toca filas existentes.

## 7. Fuera de alcance de 5.F

- El aviso de UI "ves solo tus notas" (D-ui) — se decide al final.
- La ventana de edición de 24 h para notas médicas — mini-proyecto aparte, requiere verificación regulatoria NOM-004 propia.
- Las policies de `addendums` — son de 5.I (heredarán la visibilidad de `consultas`).
- La columna `client_id` residual de `consultas` (residuo del sistema offline viejo) — deuda menor, no se toca aquí.

## 8. Estado

Diseño completo, pendiente de auditoría (doble check con Claude Code) antes de trazar los scripts y el código definitivos.
