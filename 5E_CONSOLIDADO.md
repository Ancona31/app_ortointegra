# SUB-PASO 5.E — DOCUMENTO DE CONSOLIDACIÓN DEL DISEÑO

> **Propósito:** registro maestro del diseño completo de 5.E. Insumo para la
> auditoría integral y referencia para la ejecución chunk por chunk.
> **Estado:** diseño completo. Nada ejecutado en producción.
> **Fecha:** consolidado en sesión de mayo 2026.

---

## 1. QUÉ ES 5.E

5.E reescribe la seguridad de la tabla `pacientes` y de la tabla de unión
`paciente_medico`, e introduce el modelo médico-paciente muchos-a-muchos (M:N)
en el flujo real de la aplicación. Es el primer sub-paso de la Etapa 5 que
cambia el comportamiento observable.

Cambio central: un médico invitado pasa de ver TODOS los pacientes de su
clínica a ver SOLO los suyos (los vinculados a él en `paciente_medico`).

### Frentes
- **BD-2** — policies RLS de la tabla `paciente_medico`.
- **TS-1a** — RPC `crear_paciente_con_medico` (creación atómica paciente + vínculo).
- **TS-1b** — reescritura de `api/pacientes/route.ts` + 5 componentes de frontend.
- **BD-1** — reescritura de las policies RLS de la tabla `pacientes`.
- **Backfill correctivo** — crear el vínculo M:N faltante del paciente "Angel Gabriel".
- **Pieza 2 (gate soft-delete)** — gate de rol en `api/pacientes/[id]/route.ts`.

Fuera del alcance de 5.E (diferido): **TS-2** (métricas super-admin) y la
**trazabilidad de consultas** (deuda NOM-004, va a 5.F).

---

## 2. DECISIONES DE DISEÑO (D1-D7 + soft-delete M:N)

- **D1** — Visibilidad en policies PERMISSIVE (ramas de rol con OR); gates de
  suscripción en policies RESTRICTIVE separadas (AND obligatorio).
- **D2-A** — La policy de pacientes inactivos NO lleva rama `super_admin` (el
  super_admin accede por `/api/super-admin/*` con service_role / BYPASSRLS).
- **D3-A** — Se ELIMINA la policy DELETE de `pacientes`. El hard-delete queda
  solo para service_role/SQL. El soft-delete (UPDATE `activo=false`) no se afecta.
- **D4-A** — Backfill correctivo solo del paciente real "Angel Gabriel". Los
  pacientes de prueba soft-deleted (Guillermo, Riata) NO se tocan.
- **D5** — Orden de ejecución: BD-2 → TS-1a (RPC) → TS-1b → backfill → BD-1.
  TS-2 fuera (diferido).
- **D6-A** — RPC SECURITY DEFINER atómico para crear paciente + vínculo M:N.
- **D7** — Resuelto por diseño: `clinica_tiene_acceso()` (whitelist) ya cubre
  el estado 'vencido'. No requiere cambio.
- **Soft-delete M:N** — "Archivar paciente" (UPDATE `activo=false`) lo hace
  SOLO el médico admin de clínica. El médico invitado solo puede
  "desvincularse" (borrar su fila en `paciente_medico`); el paciente sigue
  activo para los demás. La secretaria no archiva.

---

## 3. FRENTE BD-2 — POLICIES DE `paciente_medico`

Tabla `paciente_medico`: hoy RLS habilitada, 0 policies (cerrada por defecto).
3 policies nuevas, todas PERMISSIVE TO authenticated. Sin policy UPDATE
(los vínculos no se editan, se crean o se borran).

Restricción anti-recursión: las policies de `paciente_medico` NO pueden usar
`soy_medico_tratante()` (ese helper consulta `paciente_medico`). Se usa lógica
directa `medico_id = auth.uid()`.

```sql
-- BD-2 Policy 1 — SELECT
CREATE POLICY paciente_medico_select ON public.paciente_medico
  FOR SELECT TO authenticated
  USING (
    medico_id = auth.uid()
    OR (soy_admin_de_clinica()
        AND paciente_pertenece_a_mi_clinica(paciente_id))
  );

-- BD-2 Policy 2 — INSERT
CREATE POLICY paciente_medico_insert ON public.paciente_medico
  FOR INSERT TO authenticated
  WITH CHECK (
    paciente_pertenece_a_mi_clinica(paciente_id)
    AND (
      (get_my_role() = 'medico' AND medico_id = auth.uid())
      OR soy_admin_de_clinica()
      OR get_my_role() = 'secretaria'
    )
  );

-- BD-2 Policy 3 — DELETE
CREATE POLICY paciente_medico_delete ON public.paciente_medico
  FOR DELETE TO authenticated
  USING (
    medico_id = auth.uid()
    OR (soy_admin_de_clinica()
        AND paciente_pertenece_a_mi_clinica(paciente_id))
  );
```

Nota: en las policies de `paciente_medico` SÍ se puede usar
`paciente_pertenece_a_mi_clinica()` porque consulta `pacientes` (tabla
distinta de `paciente_medico`).

El RPC `crear_paciente_con_medico` (SECURITY DEFINER) se salta estas policies;
son red de seguridad para acceso directo no-RPC.

---

## 4. FRENTE TS-1a — RPC `crear_paciente_con_medico`

RPC SECURITY DEFINER que crea, en una transacción atómica, el paciente Y su
vínculo en `paciente_medico`. Se crea en el SQL Editor (owner=postgres).

Decisiones del RPC: R1 (valida permisos internamente), R2 (gates dentro del
RPC), R3 (duplicados NO en el RPC, se quedan en route.ts), R4 (devuelve id +
numero_expediente), E1 (genera numero_expediente internamente). Consentimiento
hardcodeado (igual que route.ts hoy).

```sql
CREATE OR REPLACE FUNCTION public.crear_paciente_con_medico(
  p_datos      jsonb,
  p_medico_id  uuid
)
RETURNS TABLE (id uuid, numero_expediente text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_uid          uuid := auth.uid();
  v_rol          text;
  v_clinica_id   uuid;
  v_es_admin     boolean;
  v_medico_rol   text;
  v_medico_clin  uuid;
  v_anio         text := to_char(now(), 'YYYY');
  v_correlativo  int;
  v_num_exp      text;
  v_nuevo_id     uuid;
BEGIN
  -- PASO 1 — validar quién llama
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
  END IF;
  SELECT pr.role, pr.clinica_id, pr.es_admin_de_clinica
    INTO v_rol, v_clinica_id, v_es_admin
  FROM public.profiles pr WHERE pr.id = v_uid;
  IF v_clinica_id IS NULL THEN
    RAISE EXCEPTION 'El usuario no tiene clinica asignada.' USING ERRCODE = '42501';
  END IF;
  IF v_rol NOT IN ('medico','secretaria') THEN
    RAISE EXCEPTION 'El rol % no puede crear pacientes.', v_rol USING ERRCODE = '42501';
  END IF;

  -- PASO 2 — validar el médico objetivo
  IF p_medico_id IS NULL THEN
    RAISE EXCEPTION 'Debe especificarse el medico tratante.' USING ERRCODE = '42501';
  END IF;
  SELECT pr.role, pr.clinica_id INTO v_medico_rol, v_medico_clin
  FROM public.profiles pr WHERE pr.id = p_medico_id;
  IF v_medico_rol IS NULL THEN
    RAISE EXCEPTION 'El medico especificado no existe.' USING ERRCODE = '42501';
  END IF;
  IF v_medico_rol <> 'medico' THEN
    RAISE EXCEPTION 'El usuario asignado no es un medico.' USING ERRCODE = '42501';
  END IF;
  IF v_medico_clin IS DISTINCT FROM v_clinica_id THEN
    RAISE EXCEPTION 'El medico no pertenece a la clinica del usuario.' USING ERRCODE = '42501';
  END IF;
  IF v_rol = 'medico' AND v_es_admin IS NOT TRUE AND p_medico_id <> v_uid THEN
    RAISE EXCEPTION 'Un medico invitado solo puede asignarse pacientes a si mismo.'
      USING ERRCODE = '42501';
  END IF;

  -- PASO 3 — gates de suscripción
  IF NOT public.clinica_no_suspendida() THEN
    RAISE EXCEPTION 'La clinica esta suspendida.' USING ERRCODE = 'SP002';
  END IF;
  IF NOT public.clinica_tiene_acceso() THEN
    RAISE EXCEPTION 'La clinica no tiene una suscripcion activa.' USING ERRCODE = 'SP003';
  END IF;
  IF NOT public.clinica_dentro_de_limite() THEN
    RAISE EXCEPTION 'La clinica alcanzo su limite de pacientes.' USING ERRCODE = 'SP001';
  END IF;

  -- PASO 4 — generar numero_expediente
  SELECT COALESCE(MAX(
           NULLIF(regexp_replace(p.numero_expediente, '^EXP-\d{4}-', ''), '')::int
         ), 0) + 1
    INTO v_correlativo
  FROM public.pacientes p
  WHERE p.clinica_id = v_clinica_id
    AND p.numero_expediente ~ ('^EXP-' || v_anio || '-[0-9]+$');
  v_num_exp := 'EXP-' || v_anio || '-' || lpad(v_correlativo::text, 4, '0');

  -- PASO 5 — insert en pacientes
  INSERT INTO public.pacientes (
    nombre, apellidos, fecha_nacimiento, sexo,
    peso_kg, talla_cm, imc,
    telefono, email, direccion,
    ant_patologicos, ant_quirurgicos, ant_familiares,
    alergias, medicamentos_actuales,
    clinica_id, medico_id, numero_expediente,
    consentimiento_otorgado, fecha_consentimiento, version_aviso_privacidad
  ) VALUES (
    p_datos->>'nombre',
    p_datos->>'apellidos',
    NULLIF(p_datos->>'fecha_nacimiento','')::date,
    NULLIF(p_datos->>'sexo', ''),
    NULLIF(p_datos->>'peso_kg', '')::numeric,
    NULLIF(p_datos->>'talla_cm', '')::numeric,
    NULLIF(p_datos->>'imc', '')::numeric,
    NULLIF(p_datos->>'telefono', ''),
    NULLIF(p_datos->>'email', ''),
    NULLIF(p_datos->>'direccion', ''),
    NULLIF(p_datos->>'ant_patologicos', ''),
    NULLIF(p_datos->>'ant_quirurgicos', ''),
    NULLIF(p_datos->>'ant_familiares', ''),
    NULLIF(p_datos->>'alergias', ''),
    NULLIF(p_datos->>'medicamentos_actuales', ''),
    v_clinica_id,
    p_medico_id,
    v_num_exp,
    true,
    now(),
    'v1.0-2026-04-08'
  )
  RETURNING pacientes.id INTO v_nuevo_id;

  -- PASO 6 — insert en paciente_medico
  INSERT INTO public.paciente_medico (paciente_id, medico_id, asignado_por)
  VALUES (v_nuevo_id, p_medico_id, v_uid);

  RETURN QUERY SELECT v_nuevo_id, v_num_exp;
END;
$fn$;
```

Al crearse, además: `GRANT EXECUTE ON FUNCTION
public.crear_paciente_con_medico(jsonb, uuid) TO authenticated;` y owner=postgres.

Estado: auditado dos veces, veredicto 🟢.

---

## 5. FRENTE TS-1b — `route.ts` + 5 componentes de frontend

### 5.1 — `src/app/api/pacientes/route.ts` (reescrito)

El handler POST deja de hacer el INSERT directo y llama al RPC. Se conserva:
auth, profile, gate de secretaria, gate de consentimiento, detección de
duplicados (bloque actual ~:66-101 verbatim), cálculo de medico_id. Se elimina:
gates de cancelación/tope inline, generación del numero_expediente, INSERT
directo. Nuevo: construir `p_datos`, llamar al RPC, mapear ERRCODE.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isMedico } from '@/lib/permissions';
import type { DuplicatePatientResponse } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. AUTH
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // 2. PROFILE
    const { data: profile } = await supabase
      .from('profiles')
      .select('clinica_id, role, id')
      .eq('id', user.id)
      .single();
    if (!profile?.clinica_id) {
      return NextResponse.json({ error: 'Sin clínica asignada' }, { status: 403 });
    }

    const body = await req.json();

    // 3. GATE SECRETARIA
    if (profile.role === 'secretaria' && !body.medico_id) {
      return NextResponse.json(
        { error: 'Las secretarias deben asignar un médico al paciente' },
        { status: 400 }
      );
    }

    // 4. GATE CONSENTIMIENTO
    if (!body.consentimiento_otorgado) {
      return NextResponse.json(
        { error: 'Se requiere el consentimiento del aviso de privacidad' },
        { status: 400 }
      );
    }

    // 5. DETECCIÓN DE DUPLICADOS
    //    [SE CONSERVA VERBATIM el bloque actual de route.ts ~:66-101.
    //     Normalización de nombre/apellidos/fecha, check de body.forceCreate,
    //     query de candidatos, filtro en JS, respuesta 409 DuplicatePatientResponse.]

    // 6. CALCULAR medico_id
    const medico_id =
      body.medico_id || (isMedico(profile) ? profile.id : null);

    // 7. CONSTRUIR p_datos
    const p_datos = {
      nombre: body.nombre,
      apellidos: body.apellidos,
      fecha_nacimiento: body.fecha_nacimiento || null,
      sexo: body.sexo ?? null,
      peso_kg: body.peso_kg ?? null,
      talla_cm: body.talla_cm ?? null,
      imc: body.imc ?? null,
      telefono: body.telefono ?? null,
      email: body.email ?? null,
      direccion: body.direccion ?? null,
      ant_patologicos: body.ant_patologicos ?? null,
      ant_quirurgicos: body.ant_quirurgicos ?? null,
      ant_familiares: body.ant_familiares ?? null,
      alergias: body.alergias ?? null,
      medicamentos_actuales: body.medicamentos_actuales ?? null,
    };

    // 8. LLAMAR AL RPC
    const { data, error } = await supabase
      .rpc('crear_paciente_con_medico', { p_datos, p_medico_id: medico_id })
      .single();

    // 9. MAPEAR ERRORES DEL RPC
    if (error) {
      const map: Record<string, { status: number; token: string }> = {
        '42501': { status: 403, token: 'forbidden' },
        'SP001': { status: 403, token: 'patient_limit' },
        'SP002': { status: 403, token: 'clinic_suspended' },
        'SP003': { status: 403, token: 'subscription_inactive' },
      };
      const mapped = map[error.code ?? ''];
      if (mapped) {
        return NextResponse.json(
          { error: mapped.token, message: error.message },
          { status: mapped.status }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 10. ÉXITO
    if (!data) {
      return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
    return NextResponse.json({
      id: data.id,
      numero_expediente: data.numero_expediente,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### 5.2 — Los 5 cambios de frontend

Contrato de error nuevo: `error` lleva un token, `message` lleva el texto
legible. Cada componente, en su rama de error genérico (NUNCA en el branch
`DUPLICATE_PATIENT`), antepone `data.message` antes de `data.error`. Se respeta
el operador (`||` o `??`) original de cada archivo.

```
CAMBIO 1 — src/app/(app)/pacientes/nuevo/page.tsx:159
  ANTES:   setError('Error al guardar: ' + (data.error || 'Error desconocido'))
  DESPUÉS: setError('Error al guardar: ' + (data.message || data.error || 'Error desconocido'))

CAMBIO 2 — src/components/ui/QuickPatientModal.tsx:132
  ANTES:   if (!res.ok) { setError((data.error as string) ?? 'Error al crear paciente'); setSaving(false); return }
  DESPUÉS: if (!res.ok) { setError((data.message as string) ?? (data.error as string) ?? 'Error al crear paciente'); setSaving(false); return }

CAMBIO 3 — src/components/launcher/ConsultaRapidaModal.tsx:156
  ANTES:   setFormError((data.error as string) ?? 'Error al crear paciente')
  DESPUÉS: setFormError((data.message as string) ?? (data.error as string) ?? 'Error al crear paciente')

CAMBIO 4 — src/app/(app)/agenda/page.tsx:~334
  ANTES:   if (!res.ok) { setError(data.error ?? 'Error al crear paciente'); ... }
  DESPUÉS: if (!res.ok) { setError(data.message ?? data.error ?? 'Error al crear paciente'); ... }

CAMBIO 5 — src/lib/offline/sync.ts:~149
  ANTES:   throw new Error((err as {error?:string}).error ?? `HTTP ${res.status}`)
  DESPUÉS: throw new Error((err as {error?:string, message?:string}).message ?? (err as {error?:string}).error ?? `HTTP ${res.status}`)
```

`CommandPalette.tsx` NO se toca (no muestra el error de creación).

Estado: auditado, veredicto 🟢.

---

## 6. FRENTE BD-1 — POLICIES DE `pacientes`

Reescribe las 5 policies actuales de `pacientes`. La policy DELETE se elimina
sin reemplazo (D3-A).

Restricción anti-recursión: ninguna policy de `pacientes` puede usar
`paciente_pertenece_a_mi_clinica()` (consulta `pacientes`) ni subqueries
inline a `pacientes`. Sí puede usar `soy_medico_tratante()` (consulta
`paciente_medico`), `soy_admin_de_clinica()`, `get_my_role()`,
`get_clinica_id()` y los gates `clinica_*()`.

```sql
-- BD-1 Policy 1 — SELECT de pacientes activos (visibilidad M:N)
CREATE POLICY pacientes_select_activos ON public.pacientes
  FOR SELECT TO authenticated
  USING (
    clinica_id = get_clinica_id()
    AND (activo = true OR activo IS NULL)
    AND (
      soy_admin_de_clinica()
      OR get_my_role() = 'secretaria'
      OR soy_medico_tratante(id)
    )
  );

-- BD-1 Policy 2 — SELECT de pacientes inactivos (solo admin)
CREATE POLICY pacientes_select_inactivos_admin ON public.pacientes
  FOR SELECT TO authenticated
  USING (
    clinica_id = get_clinica_id()
    AND activo = false
    AND soy_admin_de_clinica()
  );

-- BD-1 Policy 3 — INSERT (red de 2ª línea; el flujo real va por el RPC)
CREATE POLICY pacientes_insert ON public.pacientes
  FOR INSERT TO authenticated
  WITH CHECK (
    clinica_id = get_clinica_id()
    AND get_my_role() IN ('medico', 'secretaria')
  );

-- BD-1 Policy 4 — UPDATE
CREATE POLICY pacientes_update ON public.pacientes
  FOR UPDATE TO authenticated
  USING (
    clinica_id = get_clinica_id()
    AND (
      soy_admin_de_clinica()
      OR get_my_role() = 'secretaria'
      OR soy_medico_tratante(id)
    )
  )
  WITH CHECK (
    clinica_id = get_clinica_id()
    AND (
      soy_admin_de_clinica()
      OR get_my_role() = 'secretaria'
      OR soy_medico_tratante(id)
    )
  );

-- BD-1 Policy 5 — RESTRICTIVE de gates en INSERT
CREATE POLICY pacientes_gates_insert ON public.pacientes
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    clinica_no_suspendida()
    AND clinica_tiene_acceso()
    AND clinica_dentro_de_limite()
  );
```

### Requisitos de ejecución de BD-1 (de la auditoría de BD-1)
1. La migración debe empezar con `DROP POLICY IF EXISTS` de las 5 policies
   ACTUALES por nombre exacto: `pacientes_select_activos`,
   `pacientes_select_inactivos_admin`, `clinica_insert`, `clinica_update`,
   `pacientes_delete_solo_sin_historial`. Si no se dropean `clinica_insert` y
   `clinica_update`, sobreviven y el OR de PERMISSIVE anula las nuevas reglas.
2. Post-flight: verificar que quedan exactamente las 5 policies nuevas.
3. Comentario en la migración: NO activar FORCE RLS en `pacientes` (rompería
   `clinica_dentro_de_limite()` por recursión).
4. Antes de aplicar BD-1: verificar que no haya pacientes activos huérfanos de
   vínculo M:N (el backfill debe estar completo).

Estado: el diseño de las 5 policies auditado 🟢. Los hallazgos 🔴 de la
auditoría eran requisitos de ORDEN de ejecución (no ejecutar BD-1 antes que el
RPC), ya cubiertos por D5.

---

## 7. BACKFILL CORRECTIVO (set-based idempotente)

Crear el vínculo M:N de todo paciente ACTIVO que tenga `medico_id` seteado
pero no tenga fila en `paciente_medico`. Diseño set-based adoptado tras la
auditoría integral (recomendación 8a): más robusto que el INSERT de una sola
fila hardcodeada — cubre a "Angel Gabriel" y a cualquier otro huérfano que
pudiera crearse vía el route.ts viejo antes del deploy de TS-1b.

```sql
-- Backfill correctivo set-based — vincula a TODOS los pacientes activos
-- sin vínculo M:N. Idempotente (el NOT EXISTS lo hace re-ejecutable sin daño).
INSERT INTO public.paciente_medico (paciente_id, medico_id, asignado_por)
SELECT p.id, p.medico_id, NULL
FROM public.pacientes p
WHERE (p.activo IS TRUE OR p.activo IS NULL)
  AND p.medico_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.paciente_medico pm
    WHERE pm.paciente_id = p.id
  );
```

Respeta D4-A: el filtro `activo IS TRUE OR activo IS NULL` excluye los
pacientes de prueba soft-deleted (Guillermo, Riata) — no se tocan.

Verificación previa (antes de ejecutar el backfill): contar los huérfanos.

```sql
-- ¿Cuántos pacientes activos sin vínculo M:N hay? (esperado tras el backfill: 0)
SELECT count(*) AS huerfanos_activos
FROM public.pacientes p
WHERE (p.activo IS TRUE OR p.activo IS NULL)
  AND NOT EXISTS (
    SELECT 1 FROM public.paciente_medico pm WHERE pm.paciente_id = p.id
  );
```

Caso a vigilar: un paciente activo con `medico_id IS NULL` NO puede
auto-vincularse (el backfill lo omite). Si la verificación posterior aún
reporta huérfanos, serán de ese tipo — decidir caso por caso. Tras BD-1, un
paciente sin vínculo M:N solo lo verán admin y secretaria, no su médico.

---

## 8. PIEZA 2 — GATE DE ROL EN EL SOFT-DELETE

Decisión: el soft-delete (UPDATE `activo=false`) lo hace solo el médico admin
de clínica (control por código, decisión U1). Hoy el handler DELETE de
`api/pacientes/[id]/route.ts` NO valida rol.

Dos cambios en `src/app/api/pacientes/[id]/route.ts`:
1. El helper `getProfile` (compartido por PUT y DELETE) debe añadir
   `es_admin_de_clinica` a su SELECT (hoy lee `id, clinica_id, role`).
2. El handler DELETE, después del guard de clínica y antes del UPDATE, añade:

```typescript
// Solo el médico admin de clínica puede archivar (soft-delete) pacientes
if (!(profile.role === 'medico' && profile.es_admin_de_clinica === true)) {
  return NextResponse.json(
    { error: 'Solo el administrador de la clínica puede archivar pacientes' },
    { status: 403 }
  );
}
```

---

## 9. ORDEN DE EJECUCIÓN (D5)

```
1. BD-2   — policies de paciente_medico (SQL Editor)
2. TS-1a  — RPC crear_paciente_con_medico (SQL Editor, owner=postgres,
            + GRANT EXECUTE TO authenticated, + NOTIFY pgrst 'reload schema')
3. TS-1b  — deploy de route.ts + 5 componentes (deploy de la app)
            + Pieza 2 (gate soft-delete) — mismo deploy de código
4. Backfill correctivo set-based (SQL Editor)
   · verificación previa: contar huérfanos activos (query sección 7)
   · ejecutar el INSERT set-based
   · verificación posterior: el conteo de huérfanos debe ser 0
     (salvo activos con medico_id NULL — decidir caso por caso)
5. BD-1   — policies de pacientes (SQL Editor)
   · pre-check EN VIVO contra prod: confirmar que pacientes tiene
     exactamente las 5 policies que el DROP espera (el baseline del
     repo está stale; mirar prod con pg_policy, no el archivo)
   · la migración empieza con los DROP de las 5 policies viejas
   · post-flight: verificar que quedan exactamente las 5 nuevas
```

Razón del orden: BD-2 abre la tabla de unión antes de que el RPC/route escriban
en ella. El RPC se crea antes de que route.ts lo invoque. El backfill completa
los vínculos antes de que BD-1 active la visibilidad M:N (si no, un paciente
activo sin vínculo quedaría invisible para su médico). BD-1 va al final.

Cada paso se aplica y verifica bajo protocolo D-T6, con smoke test obligatorio
de los 4 roles tras BD-1.

---

## 10. FUERA DEL ALCANCE DE 5.E (anotado para después)

- **DUP-RPC — el sub-paso SIGUIENTE a 5.E (compromiso firme, no "algún
  día").** La detección de duplicados se conserva en `route.ts` y corre bajo
  RLS de usuario. Tras BD-1, un médico invitado solo ve sus pacientes → no
  detectará un duplicado que pertenezca a otro médico de su clínica → puede
  crear un expediente duplicado de la misma persona. Detectado por la auditoría
  integral (punto 7a). El arreglo correcto es mover la detección de duplicados
  al RPC (corre como postgres → clínica-wide, consistente con cómo ya se trató
  la numeración de expediente). Implica: rediseñar el contrato del RPC para
  devolver "posible duplicado" como un resultado (no como error tipo gate),
  rediseñar el flujo `forceCreate` como bidireccional, re-auditar TS-1a y
  TS-1b. Por eso NO se incrusta en 5.E — merece su propio ciclo completo de
  diseño + auditoría como sub-paso inmediatamente posterior. Mientras tanto,
  para médicos invitados la detección de duplicados es médico-scoped (afecta
  calidad de datos, no es brecha de seguridad).
- **TS-2** — métricas super-admin (`metricas/route.ts:78`,
  `dashboard/usuarios/route.ts:151-160`) asumen 1 paciente → 1 médico. Con M:N
  dan números imprecisos. No rompen nada (tablero interno). Se ajusta después.
- **Trazabilidad de consultas (5.F)** — `api/consultas/route.ts` (~:74-90) NO
  setea `consultas.medico_id` → toda consulta nace con `medico_id` NULL. Es
  deuda de trazabilidad NOM-004 activa. Arreglo: cablear `medico_id: user.id`
  (patrón ya existente en `addendum/route.ts:38`). Decisión de Angel: NO
  backfillear las 81 consultas existentes (son de beta test); solo corregir
  para que las consultas NUEVAS sean trazables. Es trabajo de 5.F.
- **Deuda preexistente** — la creación de paciente no escribe en `audit_log`.
- **UI tabla de expediente** con filtros (fecha, médicos asignados, creador) —
  mini-proyecto de frontend post-5.E.
- **Hotfix 5.D** — registrar como migración en `supabase/migrations/`.
- **Inconsistencia transitoria de gates** (auditoría 8b) — tras 5.E, crear
  paciente usa el gate estricto del RPC, pero crear consulta/documento/cita
  sigue con el gate inline viejo. Rollout escalonado esperado; esos endpoints
  son de 5.F+. No rompe nada.
- **Pérdida del CTA de Facturación** (auditoría 8c) — el route.ts nuevo pierde
  el mensaje accionable "Reactívala desde Facturación…" del token
  `subscription_cancelled` en favor del mensaje genérico del RPC. Cosmético.

---

## 11. RESUMEN DE ESTADO

| Frente | Estado | Auditoría |
|---|---|---|
| BD-2 | diseño cerrado | 🟢 |
| TS-1a (RPC) | diseño cerrado | 🟢 (×2) |
| TS-1b | diseño cerrado | 🟢 |
| BD-1 | diseño cerrado | 🟢 (diseño) |
| Backfill (set-based) | diseño cerrado | 🟢 (vía integral) |
| Pieza 2 (gate soft-delete) | diseño cerrado | 🟢 (vía integral) |
| **Auditoría INTEGRAL** | **completada** | **🟢 sin bloqueantes** |

La auditoría integral de coherencia de conjunto se completó sin bloqueantes
🔴. Sus recomendaciones 🟡 quedaron resueltas: el backfill se rediseñó a la
versión set-based (sección 7); el pre-check de policies en vivo se incorporó
al orden D5 (sección 9, paso 5); la detección de duplicados médico-scoped se
difiere como sub-paso DUP-RPC, el siguiente a 5.E (sección 10).

**Estado: diseño de 5.E COMPLETO y auditado. Listo para ejecución D-T6.**

Siguiente acción: ejecución chunk por chunk en el orden D5, bajo protocolo
D-T6, con smoke test obligatorio de los 4 roles tras BD-1. Después de 5.E:
sub-paso DUP-RPC.
