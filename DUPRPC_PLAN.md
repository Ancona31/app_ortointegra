# DUP-RPC — Plan de ejecución (Fase 1)

> **Estado:** Diseño — pendiente de auditoría
> **Fecha:** 2026-05-24
> **Sub-paso siguiente a:** Etapa 5.E (modelo M:N de pacientes, ya aplicado)
> **Documento de referencia:** `ETAPA5_PLAN.md`, `5E_CONSOLIDADO.md`

## 1. Problema

La detección de pacientes duplicados vive hoy en `src/app/api/pacientes/route.ts` (sección 5, líneas 44-79). Esa detección hace su query `SELECT ... FROM pacientes` con el cliente Supabase del usuario logueado, por lo tanto sujeta a RLS. Tras el sub-paso 5.E, un médico invitado solo VE sus propios pacientes vía RLS. Consecuencia: un médico invitado ya no puede detectar si OTRO médico de su clínica tiene registrado al mismo paciente, y creará un duplicado.

Se distinguen dos situaciones que hoy se confunden en una:

- **Caso A — homónimo real:** dos personas distintas con el mismo nombre. Duplicar es correcto.
- **Caso B — mismo paciente, otro médico:** el paciente ya existe en la clínica, registrado por otro médico, y un segundo médico lo va a registrar. Duplicar aquí parte el expediente clínico de una persona en dos. Es un riesgo clínico. Post-5.E este caso dejará de ser raro.

DUP-RPC Fase 1 resuelve el Caso B para pacientes ACTIVOS.

## 2. Hechos confirmados por investigación

- NO existe ninguna restricción de base de datos (UNIQUE constraint, índice único, exclusion constraint) que impida insertar dos pacientes con el mismo nombre+apellidos+fecha_nacimiento en la misma clínica. La deduplicación es 100% a nivel aplicación.
- El RPC `crear_paciente_con_medico` (aplicado en 5.E, archivo `supabase/migrations/20260524_etapa5e_ts1a_rpc_crear_paciente_con_medico.sql`) hoy NO tiene lógica de detección de duplicados. Firma actual: `(p_datos jsonb, p_medico_id uuid) RETURNS TABLE(id uuid, numero_expediente text)`, SECURITY DEFINER, owner postgres.
- La detección actual en `route.ts` normaliza nombre/apellidos con `.trim().toLowerCase()`, filtra por `clinica_id`, `fecha_nacimiento` exacta, `activo != false`, y compara nombre+apellidos en JS. Solo dispara si vienen nombre, apellidos Y fecha_nacimiento.
- 3 componentes consumen la respuesta 409 (`pacientes/nuevo/page.tsx`, `QuickPatientModal.tsx`, `ConsultaRapidaModal.tsx`) con el patrón: `forceCreateRef` + banner ámbar inline + botón "Crear de todos modos".
- `agenda/page.tsx` NO maneja el 409 — delega en `QuickPatientModal`.
- `sync.ts` (módulo offline) envía `forceCreate:true` siempre, nunca recibe 409, tiene su detección propia. Queda FUERA de DUP-RPC Fase 1.
- El tipo `DuplicatePatientResponse` está en `src/types/index.ts:1-12`.

## 3. Decisiones de diseño (cerradas)

| ID | Decisión |
|---|---|
| Lógica de producto | Cuando se detecta un posible duplicado, el modal ofrece 3 acciones: **vincular** ("es el mismo paciente"), **crear igual** ("es otra persona"), **cancelar**. No restrictivo. |
| D-A | La detección de duplicados (dentro del RPC) aplica a TODOS los roles que crean pacientes (médico admin, médico invitado, secretaria). |
| D-B | La acción "vincular" se rige por las policies RLS de `paciente_medico` aplicadas en 5.E Paso BD-2. Sin lógica de permisos nueva. |
| D-C | La acción "vincular" se ejecuta vía un endpoint nuevo: `POST /api/pacientes/[id]/vincular`. |
| D-D | Fase 1 detecta solo pacientes ACTIVOS. El caso de pacientes archivados re-registrados queda como **DUP-RPC Fase 2** (sub-paso futuro, con su propia lógica de reactivar+vincular y permisos). |
| D-E | El modal distingue si el paciente duplicado YA está vinculado al médico que lo busca ("es tuyo") vs. es de otro médico, y ajusta el mensaje y las acciones ofrecidas. |
| D-F | `sync.ts` (módulo offline) queda intacto. Su detección propia con el mismo bug de RLS se anota como deuda aparte ("DUP-offline"). |
| Contrato del RPC | El RPC expresa el desenlace "duplicado" mediante su RETURNS (un campo `resultado`), NO mediante `RAISE EXCEPTION`. Un duplicado es un desenlace normal, no un error. |

## 4. Frente 1 — El RPC `crear_paciente_con_medico` (cambio de contrato)

El RPC cambia de tres formas:

**4.1 Nuevo parámetro:** `p_force_create boolean DEFAULT false`. El DEFAULT es importante para la ventana de compatibilidad (ver sección 8).

**4.2 Nuevo RETURNS.** En lugar de `TABLE(id uuid, numero_expediente text)`, el RPC devuelve:

```sql
RETURNS TABLE (
  resultado          text,        -- 'creado' | 'duplicado'
  id                 uuid,        -- poblado si resultado='creado'
  numero_expediente  text,        -- poblado si resultado='creado'
  dup_id             uuid,        -- poblado si resultado='duplicado'
  dup_nombre         text,        -- "
  dup_apellidos      text,        -- "
  dup_numero_exp     text,        -- "
  dup_fecha_nac      date,        -- "
  dup_es_mio         boolean      -- true si el caller ya está vinculado al duplicado (D-E)
)
```

**4.3 Nuevo PASO interno de detección de duplicados.** Se inserta entre el PASO 3 (gates de suscripción) y el PASO 4 (generar `numero_expediente`) actuales. Lógica:

- Si `p_force_create = true`: se SALTA toda la detección, se procede a crear (comportamiento de creación directa).
- Si `p_force_create = false`: se ejecuta la detección. El RPC corre como `postgres` (SECURITY DEFINER), por lo que el SELECT ve TODA la clínica sin restricción de RLS — esto es lo que resuelve el problema del médico invitado.
- La detección busca en `pacientes` un registro con: misma `clinica_id` que el caller, `activo` true o null (solo activos — D-D), misma `fecha_nacimiento` (extraída de `p_datos`), y mismo nombre+apellidos normalizados (`lower(trim(...))`). Solo se ejecuta la detección si `p_datos` trae nombre, apellidos Y fecha_nacimiento (igual que la lógica actual de `route.ts`).
- Si encuentra un duplicado: el RPC hace `RETURN QUERY SELECT 'duplicado', NULL, NULL, <dup_id>, <dup_nombre>, <dup_apellidos>, <dup_numero_exp>, <dup_fecha_nac>, <dup_es_mio>` y TERMINA — NO inserta nada. El campo `dup_es_mio` se calcula con un EXISTS sobre `paciente_medico` (¿el caller `auth.uid()` ya está vinculado a ese paciente?).
- Si NO encuentra duplicado (o si `p_force_create=true`): continúa al PASO 4 y crea normalmente, devolviendo `RETURN QUERY SELECT 'creado', <id>, <numero_expediente>, NULL, NULL, NULL, NULL, NULL, false`.

**Notas de seguridad del Frente 1:**

- El nuevo SELECT de detección sobre `pacientes` corre dentro del RPC SECURITY DEFINER owner=postgres → bypasea RLS, sin riesgo de recursión (la tabla `pacientes` ya es consultada por el RPC para el correlativo del expediente; añadir otro SELECT no cambia el modelo de seguridad).
- La detección NO usa `paciente_pertenece_a_mi_clinica()` ni ningún helper que consulte `pacientes` recursivamente — usa un SELECT directo con `clinica_id` literal.
- El RPC mantiene su pre-flight, su post-flight, su REVOKE/GRANT y el `NOTIFY pgrst` del archivo de 5.E.

## 5. Frente 2 — `src/app/api/pacientes/route.ts`

- Se ELIMINA el bloque de detección de duplicados local (sección 5 actual, líneas ~44-79). La detección ahora vive en el RPC.
- La llamada al RPC pasa el nuevo parámetro: `p_force_create: body.forceCreate === true`.
- El RETURNS del RPC ahora trae el campo `resultado`. `route.ts` lo inspecciona:
  - Si `resultado === 'creado'`: responde 200 con `{ id, numero_expediente }` (igual que hoy).
  - Si `resultado === 'duplicado'`: `route.ts` ARMA la respuesta 409 con shape `DuplicatePatientResponse`, traduciendo los campos `dup_*` del RPC a `existingPatient`. Añade el campo nuevo `existingPatientIsMine` (booleano, de `dup_es_mio`) para que el modal aplique D-E.
- El mapeo de errores de gates (`42501`, `SP001`/`2`/`3`) del RPC se conserva igual.
- El genérico de `.single<...>()` se actualiza al nuevo shape del RETURNS.

## 6. Frente 3 — Endpoint nuevo `POST /api/pacientes/[id]/vincular`

- Archivo nuevo: `src/app/api/pacientes/[id]/vincular/route.ts`.
- Función: insertar una fila en `paciente_medico` vinculando el paciente `[id]` con un médico.
- Auth: usuario autenticado; lee su profile (rol, `clinica_id`, `id`).
- El médico a vincular: si el caller es médico, se vincula a sí mismo (`medico_id = caller`). Si el caller es admin o secretaria y el body especifica un `medico_id`, se vincula a ese médico. (Las policies RLS de `paciente_medico` de BD-2 son la autoridad final — D-B; el endpoint no reimplementa ese control, solo arma el INSERT y deja que RLS decida.)
- El INSERT usa `ON CONFLICT DO NOTHING` (o equivalente) para que vincular un paciente que ya está vinculado no produzca error — es idempotente.
- Validación: el paciente `[id]` debe existir y pertenecer a la clínica del caller (si no, 404/403).
- Responde 200 en éxito (vínculo creado o ya existente), con `{ ok: true, paciente_id }`.

## 7. Frente 4 — Frontend (los 3 componentes del modal de duplicados)

Componentes afectados: `pacientes/nuevo/page.tsx`, `QuickPatientModal.tsx`, `ConsultaRapidaModal.tsx`. (`agenda/page.tsx` NO se toca — delega en `QuickPatientModal`. `sync.ts` NO se toca — D-F.)

En cada uno, el banner ámbar inline de duplicado gana una acción nueva. El modal pasa de 2 acciones a 3:

- **"Es el mismo paciente"** → llama a `POST /api/pacientes/[id]/vincular` con el `id` del duplicado (`existingPatient.id`). En éxito, cierra el flujo y navega al expediente del paciente vinculado. NO crea paciente nuevo.
- **"Es otra persona, crear de todos modos"** → comportamiento actual: pone `forceCreateRef.current = true` y re-dispara el submit (que llamará al RPC con `forceCreate`).
- **"Cancelar"** → cierra el banner, comportamiento actual.

Aplicación de D-E: la respuesta 409 ahora trae `existingPatientIsMine`. Si es `true` (el paciente duplicado ya es del médico):

- El mensaje del banner cambia a algo como "Este paciente ya está en tu lista de pacientes."
- La acción "Es el mismo paciente / vincular" se OCULTA o se reemplaza por "Ir a su expediente" (vincular no tiene sentido — ya está vinculado).
- "Crear de todos modos" se mantiene (podría ser un homónimo real).

El tipo `DuplicatePatientResponse` en `src/types/index.ts` gana el campo opcional `existingPatientIsMine?: boolean`.

## 8. Punto crítico — Ventana de compatibilidad de la firma del RPC

Cambiar el RPC y desplegar `route.ts` NO son simultáneos. Entre que se aplica el RPC nuevo (paso de BD) y Vercel termina de desplegar el `route.ts` nuevo (paso de código), hay una ventana en la que el **`route.ts` viejo** está vivo y llama al RPC.

Problemas y mitigación:

- **El parámetro nuevo:** `p_force_create boolean DEFAULT false`. Gracias al DEFAULT, la llamada del `route.ts` viejo —que NO pasa `p_force_create`— sigue siendo válida. ✅ cubierto por el DEFAULT.
- **El RETURNS nuevo:** el `route.ts` viejo hace `.single<{ id: string; numero_expediente: string }>()` y luego lee `data.id` y `data.numero_expediente`. El RPC nuevo devuelve una fila con MÁS columnas (`resultado`, `dup_*`), pero `id` y `numero_expediente` SIGUEN presentes con esos nombres. Una fila con columnas extra no rompe el `.single()` ni el acceso a `data.id`/`data.numero_expediente` — supabase-js devuelve el objeto completo y el código viejo solo lee los campos que conoce. ✅ compatible, PERO con un matiz: cuando el RPC nuevo detecta un duplicado devuelve `resultado='duplicado'` con `id=NULL`. El `route.ts` viejo interpretaría eso como "paciente creado con id null" → su guard `if (!data)` no lo atrapa (`data` no es null, es una fila), y respondería 200 con id null. Es un comportamiento incorrecto DURANTE la ventana.

**Opciones para cerrar la ventana (a decidir en el plan / con la auditoría):**

- **Opción V1 — Orden BD-primero con ventana aceptada:** aplicar el RPC nuevo, e inmediatamente desplegar `route.ts`. La ventana dura lo que tarda el deploy de Vercel (~2-3 min). Durante esa ventana, si alguien crea un paciente que resulta ser duplicado, recibiría una respuesta 200 con id null en vez del aviso. Riesgo bajo (ventana corta, requiere coincidencia exacta de un duplicado en esos minutos) pero NO nulo.
- **Opción V2 — Código-primero defensivo:** desplegar primero un `route.ts` intermedio que ya sepa leer el campo `resultado` (tolerante: si `resultado` no existe en la respuesta, se comporta como hoy; si existe, lo respeta). Luego aplicar el RPC. Así, cuando el RPC nuevo empiece a devolver `resultado`, el `route.ts` ya desplegado lo entiende. Cero ventana de comportamiento incorrecto. Cuesta un deploy extra.
- **Opción V3 — RPC con nombre nuevo:** crear `crear_paciente_con_medico_v2` como función nueva (no reemplazar la vieja). `route.ts` nuevo apunta a la v2. La función vieja queda intacta hasta que el deploy termine, luego se elimina. Cero ventana, pero deja una función huérfana que limpiar.

El plan RECOMIENDA evaluar V2 como la opción más segura (cero ventana de comportamiento incorrecto, coste de un deploy extra). La auditoría debe pronunciarse sobre esto.

## 9. Orden de ejecución preliminar (estilo D5, sujeto a la decisión de la sección 8)

Asumiendo Opción V2:

1. **Paso 1 — `route.ts` tolerante:** desplegar un `route.ts` que sepa leer el campo `resultado` si está presente y comportarse como hoy si no. (Deploy de código.)
2. **Paso 2 — RPC nuevo:** aplicar el `CREATE OR REPLACE` del RPC con el nuevo parámetro, RETURNS y la detección. (SQL al Dashboard.)
3. **Paso 3 — endpoint `/vincular`:** desplegar el endpoint nuevo. (Deploy de código — puede ir junto con el Paso 4.)
4. **Paso 4 — frontend:** desplegar los 3 componentes con el modal de 3 acciones. (Deploy de código.)
5. **Paso 5 — `route.ts` final:** si el `route.ts` del Paso 1 era intermedio, desplegar la versión final (quita el bloque de detección viejo del todo). Puede fusionarse con pasos previos según lo decida la auditoría.

Cada paso de BD: snapshot lógico previo, script con pre/post-flight, transacción atómica, verificación, smoke test. Cada paso de código: build local + prueba en localhost antes del deploy.

## 10. Mitigación y rollback

- **RPC:** el `CREATE OR REPLACE` es reversible recreando la versión de 5.E (está en `supabase/migrations/20260524_etapa5e_ts1a_rpc_crear_paciente_con_medico.sql`). Como `crear_paciente_con_medico` mantiene el nombre, el rollback es re-aplicar ese archivo. ⚠️ Pero si `route.ts` nuevo ya está desplegado y espera el campo `resultado`, revertir solo el RPC rompería `route.ts` → el rollback debe revertir RPC Y código juntos.
- **Código (`route.ts`, endpoint, frontend):** rollback vía `git revert` del/los commit(s) + redeploy de Vercel.
- **Endpoint `/vincular`:** es aditivo (archivo nuevo); si se revierte, simplemente deja de existir, no rompe nada que existiera antes.
- **Datos:** DUP-RPC no hace backfill ni migración de datos. No toca filas existentes. El único efecto sobre datos es que, en adelante, el endpoint `/vincular` puede crear filas en `paciente_medico` — reversibles individualmente.
- **Plan de mitigación:** antes de cada paso de BD, snapshot lógico (definición del RPC actual vía `pg_get_functiondef`). Antes de cada paso de código, el estado git limpio es el snapshot.

## 11. Fuera de alcance de DUP-RPC Fase 1

- Pacientes archivados re-registrados (→ DUP-RPC Fase 2).
- El bug de RLS en la detección propia de `sync.ts` (→ deuda "DUP-offline").
- Cualquier cambio en `agenda/page.tsx`.
- Detección "fuzzy" o por similitud — la detección sigue siendo por igualdad exacta de nombre+apellidos+fecha, como hoy.

## 12. Estado

Diseño completo, pendiente de auditoría (doble check con Claude Code) antes de trazar los scripts y el código definitivos.
