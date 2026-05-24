# DUP-RPC — Plan de ejecución (Fase 1) — v2

> **Estado:** Diseño v2 — corregido tras auditoría
> **Fecha:** 2026-05-24
> **Sub-paso siguiente a:** Etapa 5.E (modelo M:N de pacientes, ya aplicado)
> **Documento de referencia:** `ETAPA5_PLAN.md`, `5E_CONSOLIDADO.md`
> **Changelog v1→v2:** adopción de la estrategia V3 (RPC con nombre nuevo); corrección del método de validación del endpoint `/vincular`; corrección de la dirección del riesgo PGRST202; corrección del rollback del RPC; + 6 recomendaciones de auditoría incorporadas.

## 1. Problema

La detección de pacientes duplicados vive hoy en `src/app/api/pacientes/route.ts` (sección 5, líneas ~44-79). Esa detección hace su query `SELECT ... FROM pacientes` con el cliente Supabase del usuario logueado, sujeta a RLS. Tras el sub-paso 5.E, un médico invitado solo VE sus propios pacientes vía RLS. Consecuencia: un médico invitado ya no detecta si OTRO médico de su clínica tiene registrado al mismo paciente, y creará un duplicado.

Dos situaciones que hoy se confunden en una:

- **Caso A — homónimo real:** dos personas distintas con el mismo nombre. Duplicar es correcto.
- **Caso B — mismo paciente, otro médico:** el paciente ya existe en la clínica, registrado por otro médico, y un segundo médico lo va a registrar. Duplicar aquí parte el expediente clínico de una persona en dos. Riesgo clínico. Post-5.E deja de ser raro.

DUP-RPC Fase 1 resuelve el Caso B para pacientes ACTIVOS.

## 2. Hechos confirmados por investigación

- NO existe restricción de BD (UNIQUE, índice único, exclusion constraint) que impida dos pacientes con mismo nombre+apellidos+fecha_nacimiento en la misma clínica. La deduplicación es 100% a nivel aplicación.
- El RPC `crear_paciente_con_medico` (aplicado en 5.E) hoy NO detecta duplicados. Firma: `(p_datos jsonb, p_medico_id uuid) RETURNS TABLE(id uuid, numero_expediente text)`, SECURITY DEFINER, owner postgres.
- La detección actual en `route.ts` normaliza nombre/apellidos con `.trim().toLowerCase()`, filtra por `clinica_id`, `fecha_nacimiento` exacta, `activo != false`, compara nombre+apellidos en JS. Solo dispara si vienen nombre, apellidos Y fecha_nacimiento.
- 3 componentes consumen el 409 (`pacientes/nuevo/page.tsx`, `QuickPatientModal.tsx`, `ConsultaRapidaModal.tsx`) con patrón `forceCreateRef` + banner ámbar inline.
- `agenda/page.tsx` NO maneja el 409 — delega en `QuickPatientModal` vía `onCreated(paciente)`.
- `sync.ts` (offline) envía `forceCreate:true` siempre, nunca recibe 409. FUERA de alcance.
- `paciente_medico` NO tiene trigger de auditoría — confirmado leyendo `06_triggers.sql` y la migración que crea la tabla. Insertar un vínculo NO genera `audit_log` automáticamente.
- Patrón de auditoría del proyecto: helper `logAudit()` en `src/lib/audit.ts` (usa service role, fire-and-forget). El campo `accion` es un union cerrado `AuditAccion` (`audit.ts:19-61`); NO existe hoy un valor para "vincular médico".
- La PK de `paciente_medico` es `(paciente_id, medico_id)`. La tabla tiene columna `asignado_por`.
- Las policies RLS de `paciente_medico` (BD-2 de 5.E): el WITH CHECK del INSERT exige `paciente_pertenece_a_mi_clinica(paciente_id)` y que un médico solo se vincule a sí mismo (admin/secretaria pueden a otros).

## 3. Decisiones de diseño (cerradas)

| ID | Decisión |
|---|---|
| Lógica de producto | Al detectar un posible duplicado, el modal ofrece 3 acciones: **vincular** ("es el mismo paciente"), **crear igual** ("es otra persona"), **cancelar**. No restrictivo. |
| D-A | La detección dentro del RPC aplica a TODOS los roles que crean pacientes. |
| D-B | La acción "vincular" se rige por las policies RLS de `paciente_medico` (BD-2). Sin lógica de permisos nueva. |
| D-C | "Vincular" se ejecuta vía endpoint nuevo `POST /api/pacientes/[id]/vincular`. |
| D-D | Fase 1 detecta solo pacientes ACTIVOS. Pacientes archivados re-registrados → DUP-RPC Fase 2. |
| D-E | El modal distingue si el paciente duplicado YA está vinculado al médico → ajusta mensaje y acciones. |
| D-F | `sync.ts` queda intacto. Su detección con bug de RLS → deuda "DUP-offline". |
| Contrato RPC | El RPC expresa "duplicado" mediante su RETURNS (campo `resultado`), NO mediante `RAISE EXCEPTION`. |
| Estrategia de despliegue | **V3**: el RPC nuevo se crea con NOMBRE NUEVO (`crear_paciente_con_medico_v2`); la función vieja queda intacta hasta que el código nuevo esté desplegado, luego se elimina. (Ver sección 8.) |
| Auditoría de /vincular | El endpoint `/vincular` escribe `audit_log` explícitamente vía `logAudit()` (Camino X). Se añade un valor nuevo `'vincular_medico'` al union `AuditAccion`. La auditoría integral de `paciente_medico` (cubrir todo insert, incl. el del RPC) queda como deuda aparte. |

## 4. Frente 1 — Nuevo RPC `crear_paciente_con_medico_v2`

Se CREA una función nueva, `crear_paciente_con_medico_v2`. La función original `crear_paciente_con_medico` NO se modifica ni se elimina en este paso (ver sección 8, estrategia V3).

**4.1 Firma.** `crear_paciente_con_medico_v2(p_datos jsonb, p_medico_id uuid, p_force_create boolean DEFAULT false)`. SECURITY DEFINER, owner postgres, `SET search_path = public, pg_temp`.

**4.2 RETURNS.** Tabla plana de 9 columnas:

```sql
RETURNS TABLE (
  resultado          text,        -- 'creado' | 'duplicado'
  id                 uuid,
  numero_expediente  text,
  dup_id             uuid,
  dup_nombre         text,
  dup_apellidos      text,
  dup_numero_exp     text,
  dup_fecha_nac      date,
  dup_es_mio         boolean
)
```

**Nota de tipado (corrección de auditoría 🟡):** todos los `RETURN QUERY SELECT` con literales NULL DEBEN castear explícitamente — `NULL::uuid`, `NULL::text`, `NULL::date` — y los literales de texto `'creado'::text` / `'duplicado'::text`, para evitar el error "returned type unknown does not match expected type".

**Nota de colisión de identificadores (corrección de auditoría 🟡):** los OUT params `id` y `numero_expediente` existen como variables dentro de la función. Todo SELECT sobre `pacientes` que referencie esas columnas DEBE calificarlas con alias de tabla (`p.id`, `p.numero_expediente`), o usar `#variable_conflict use_column`. El patrón ya presente en el RPC de 5.E (`RETURNING pacientes.id INTO ...`) debe mantenerse.

**4.3 Lógica interna.** Igual que el RPC de 5.E (PASOS 1-3 de validación del caller, del médico objetivo, y gates de suscripción), con un PASO NUEVO de detección de duplicados insertado entre los gates y la generación del `numero_expediente`:

- Si `p_force_create = true`: se SALTA la detección, se procede a crear.
- Si `p_force_create = false`: se ejecuta la detección. El RPC corre como `postgres` (SECURITY DEFINER, sin FORCE RLS en `pacientes` — verificado), por lo que el SELECT ve TODA la clínica. Sin riesgo de recursión: es un SELECT dentro de una función SECURITY DEFINER, no una policy.
- La detección solo se ejecuta si `p_datos` trae nombre, apellidos Y fecha_nacimiento (igual que `route.ts` hoy). Busca en `pacientes`: misma `clinica_id` que el caller, `activo` true o null (solo activos — D-D), misma `fecha_nacimiento`, mismo `lower(trim(nombre))` y `lower(trim(apellidos))`.
- Si encuentra duplicado: `RETURN QUERY SELECT 'duplicado'::text, NULL::uuid, NULL::text, <p.id>, <p.nombre>, <p.apellidos>, <p.numero_expediente>, <p.fecha_nacimiento>, <dup_es_mio>` y TERMINA — NO inserta nada.
- `dup_es_mio` se calcula con un EXISTS sobre `paciente_medico`. **Corrección de auditoría 🟡:** se evalúa contra el médico que será el tratante — si el caller es médico, contra `auth.uid()`; si el caller es secretaria/admin creando en nombre de otro, contra `p_medico_id`. Así el mensaje del modal es correcto también cuando una secretaria registra el paciente.
- Si NO hay duplicado (o `p_force_create=true`): continúa, crea el paciente y el vínculo M:N (como el RPC de 5.E), y devuelve `RETURN QUERY SELECT 'creado'::text, <id>, <numero_expediente>, NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::date, false`.

El RPC nuevo lleva su pre-flight (la función v2 NO debe existir aún), post-flight (SECURITY DEFINER, owner, grant), REVOKE/GRANT y `NOTIFY pgrst, 'reload schema'`, igual que el patrón del RPC de 5.E.

## 5. Frente 2 — `src/app/api/pacientes/route.ts`

- Se ELIMINA el bloque de detección de duplicados local (sección 5 actual).
- La llamada al RPC apunta a la función NUEVA: `.rpc('crear_paciente_con_medico_v2', { p_datos, p_medico_id, p_force_create: body.forceCreate === true })`.
- El genérico de `.single<...>()` se actualiza al nuevo shape de 9 columnas.
- `route.ts` inspecciona el campo `resultado`:
  - `'creado'` → responde 200 con `{ id, numero_expediente }`.
  - `'duplicado'` → arma la respuesta 409 con shape `DuplicatePatientResponse`, mapeando `dup_*` → `existingPatient`, y añade `existingPatientIsMine` (de `dup_es_mio`).
- El mapeo de errores de gates (`42501`, `SP001`/`2`/`3`) se conserva.
- **Nota (corrección de auditoría 🟡):** documentar que `dup_fecha_nac` es tipo `date` en SQL y PostgREST lo serializa a string `"YYYY-MM-DD"`, compatible con `DuplicatePatientResponse.fecha_nacimiento: string | null`.

## 6. Frente 3 — Endpoint nuevo `POST /api/pacientes/[id]/vincular`

- Archivo nuevo: `src/app/api/pacientes/[id]/vincular/route.ts`.
- Función: insertar una fila en `paciente_medico` vinculando el paciente `[id]` con un médico.
- Auth: usuario autenticado; lee su profile (rol, `clinica_id`, `id`).
- Médico a vincular: si el caller es médico, se vincula a sí mismo; si es admin/secretaria y el body trae `medico_id`, a ese médico. Las policies RLS de `paciente_medico` (BD-2) son la autoridad — el endpoint no reimplementa permisos.
- **CORRECCIÓN DE AUDITORÍA 🔴 (bloqueante #1) — método de validación:** el endpoint NO debe hacer un pre-SELECT sobre `pacientes` con el cliente del usuario para validar que el paciente existe. El usuario objetivo de esta feature es el médico invitado que AÚN no está vinculado al paciente duplicado; por las policies de `pacientes` de 5.E, ese médico no puede ver ese paciente todavía → un pre-SELECT devolvería vacío → 404 falso → la feature nunca funcionaría para su usuario objetivo. En su lugar: el endpoint ejecuta el INSERT directamente con el cliente del usuario y CONFÍA en el WITH CHECK de la policy de `paciente_medico` (que usa `paciente_pertenece_a_mi_clinica()`, SECURITY DEFINER, ve todo). Si el INSERT viola RLS, se traduce esa violación a un 403. No hay pre-SELECT sobre `pacientes`.
- El INSERT usa `ON CONFLICT (paciente_id, medico_id) DO NOTHING` → idempotente. **Nota:** con `DO NOTHING` un `RETURNING` no devuelve fila si hubo conflicto; el endpoint responde `{ ok: true, paciente_id }` usando el `id` de entrada, sin depender del RETURNING.
- **Corrección de auditoría 🟡:** el INSERT setea `asignado_por = auth.uid()` (trazabilidad, igual que hace el RPC).
- **Auditoría (Camino X):** tras el INSERT exitoso, el endpoint llama a `logAudit()` de `@/lib/audit` con: `userId` = caller, `accion` = `'vincular_medico'` (valor NUEVO a añadir al union `AuditAccion` en `src/types` o `src/lib/audit.ts`), `tabla` = `'paciente_medico'`, `registroId` = el `paciente_id`, `descripcion` con qué médico se vinculó. `logAudit` es fire-and-forget; no bloquea la operación.
- Responde 200 en éxito (`{ ok: true, paciente_id }`), 403 si RLS rechaza, 401 si no hay sesión.

## 7. Frente 4 — Frontend (los 3 componentes del modal de duplicados)

Componentes afectados: `pacientes/nuevo/page.tsx`, `QuickPatientModal.tsx`, `ConsultaRapidaModal.tsx`. (`agenda/page.tsx` NO se toca directamente — delega en `QuickPatientModal`. `sync.ts` NO se toca.)

El banner ámbar de duplicado gana una acción. Pasa de 2 a 3 acciones:

- **"Es el mismo paciente"** → llama a `POST /api/pacientes/[id]/vincular` con el `id` del duplicado. En éxito: el flujo termina con el paciente existente.
- **"Es otra persona, crear de todos modos"** → comportamiento actual: `forceCreateRef.current = true` + re-submit.
- **"Cancelar"** → cierra el banner.

**CORRECCIÓN DE AUDITORÍA 🟡 — QuickPatientModal tiene doble rol:** `QuickPatientModal` es usado por `agenda/page.tsx` para adjuntar un paciente a una cita en curso (vía `onCreated(paciente)`), no para navegar. Por eso la conducta post-vincular NO debe ser "navegar al expediente" de forma fija. Debe resolverse por CALLBACK: tras un vincular exitoso, el componente invoca su callback de éxito (`onCreated` con el paciente existente, o el equivalente), y cada caller decide qué hacer (navegar, o adjuntar a la cita). En `pacientes/nuevo/page.tsx` el callback navega; en el contexto de agenda, adjunta a la cita.

**Aplicación de D-E:** la respuesta 409 trae `existingPatientIsMine`. Si es `true`:

- El mensaje del banner cambia a "Este paciente ya está en tu lista de pacientes."
- La acción "vincular" se reemplaza por "Ir a su expediente" (vincular no aplica — ya está vinculado).
- "Crear de todos modos" se mantiene (posible homónimo real).

El tipo `DuplicatePatientResponse` (`src/types/index.ts`) gana el campo opcional `existingPatientIsMine?: boolean`.

## 8. Estrategia de despliegue — V3 (RPC con nombre nuevo)

La auditoría evaluó tres opciones (V1: orden BD-primero con ventana aceptada; V2: código-primero tolerante con mismo nombre; V3: función con nombre nuevo) y recomendó **V3**. Decisión adoptada: **V3**.

**Por qué V3:**

- **Contratos no solapados:** el código viejo llama a `crear_paciente_con_medico` (la función original, intacta, 100% funcional); el código nuevo llama a `crear_paciente_con_medico_v2`. Ninguna versión de código ve un contrato que no espera.
- **Elimina el riesgo PGRST202:** la auditoría corrigió la dirección del riesgo — el PGRST202 NO le ocurre a la llamada vieja (un subconjunto de args siempre resuelve), sino a la llamada NUEVA que envía `p_force_create` cuando el cache de PostgREST aún tiene una firma sin ese parámetro. Con V3, el código nuevo solo llama a `v2` (que se crea con ese parámetro desde el inicio y con su propio `NOTIFY pgrst`), y el código viejo solo llama a la función vieja. Cada código manda los args que su función conoce. Cero PGRST202.
- **Elimina el matiz del `id=NULL`:** con contratos separados, el código viejo nunca recibe un `resultado='duplicado'` con `id` nulo, porque nunca llama a v2.
- **Rollback trivial:** revertir el deploy de código deja al código viejo llamando a la función vieja, que nunca se tocó. Cero acoplamiento BD↔código en el rollback.

**Costo aceptado:** una función huérfana temporal (la original) que se elimina con un `DROP FUNCTION` al final, una vez el código nuevo está estable en producción.

## 9. Orden de ejecución (estrategia V3)

1. **Paso 1 — Crear el RPC v2.** Aplicar el script que crea `crear_paciente_con_medico_v2` (SQL al Dashboard). Incluye `NOTIFY pgrst, 'reload schema'`. Verificar post-flight + que la función está en el cache de PostgREST con una llamada de prueba controlada (smoke test con sesión simulada).
2. **Paso 2 — Desplegar el código.** En un solo deploy: `route.ts` apuntando a `v2`, el endpoint nuevo `/vincular`, los 3 componentes del frontend, y el nuevo valor `'vincular_medico'` en `AuditAccion`. Build local + prueba en localhost antes del deploy.
3. **Paso 3 — Verificación en producción.** Smoke test del flujo completo: crear paciente normal, detección de duplicado (caso B), acción vincular, acción crear-igual, y el caso D-E (paciente ya propio).
4. **Paso 4 — Eliminar la función vieja.** Una vez el código nuevo está estable y verificado en producción, `DROP FUNCTION crear_paciente_con_medico(jsonb, uuid)`. (SQL al Dashboard, con verificación previa de que ningún código vivo la llama.)

Cada paso de BD: snapshot lógico previo (`pg_get_functiondef`), script con pre/post-flight, transacción atómica, verificación, smoke test. Cada paso de código: build local + prueba en localhost antes del deploy.

## 10. Mitigación y rollback (estrategia V3)

- **Tras el Paso 1 (v2 creada):** si algo falla, `DROP FUNCTION crear_paciente_con_medico_v2` — la función original sigue intacta y el código viejo sigue funcionando. Sin impacto.
- **Tras el Paso 2 (código desplegado):** rollback = `git revert` del/los commit(s) + redeploy de Vercel. El código viejo vuelve a llamar a la función original, que nunca se tocó. **No hay acoplamiento BD↔código** — no hace falta revertir nada en la BD. (Esto resuelve el bloqueante 🔴 #3 de la auditoría: ya no se depende de "re-aplicar el archivo de 5.E", cuyo pre-flight guard abortaría.)
- **El endpoint `/vincular`** es aditivo (archivo nuevo); revertir el deploy lo hace desaparecer, sin romper nada preexistente.
- **Filas creadas en `paciente_medico` por `/vincular`:** son vínculos reales (acceso concedido). Un rollback de código NO las borra ni necesita borrarlas — son datos válidos. Si por alguna razón se quisiera revertir un vínculo concreto, se hace con un DELETE puntual sobre esa fila.
- **El Paso 4 (DROP de la función vieja)** es el único punto sin vuelta atrás fácil; por eso se hace SOLO después de verificar que el código nuevo es estable. Si tras el DROP se necesitara la función vieja, se recrea con un `CREATE` desde el archivo de 5.E (su contenido está versionado en `supabase/migrations/20260524_etapa5e_ts1a_rpc_crear_paciente_con_medico.sql`).
- **Snapshot:** antes del Paso 1, capturar `pg_get_functiondef` de la función original. Antes del Paso 2, el estado git limpio es el snapshot.

## 11. Fuera de alcance de DUP-RPC Fase 1

- Pacientes archivados re-registrados → DUP-RPC Fase 2 (sub-paso futuro, con su lógica de reactivar+vincular y permisos).
- El bug de RLS en la detección propia de `sync.ts` → deuda "DUP-offline".
- Auditoría integral de `paciente_medico` (que TODO insert quede auditado, incluido el del PASO 6 del RPC) → deuda "auditoría paciente_medico", a resolver junto con la deuda preexistente de que la creación de paciente vía RPC no escribe `audit_log`.
- Cualquier cambio directo en `agenda/page.tsx`.
- Detección "fuzzy" o por similitud — sigue siendo igualdad exacta de nombre+apellidos+fecha.

## 12. Estado

Diseño v2 — corregido tras auditoría (3 bloqueantes 🔴 + 6 recomendaciones 🟡 incorporados). Pendiente de decisión: ¿segunda auditoría del plan v2, o proceder a trazar scripts y código?
