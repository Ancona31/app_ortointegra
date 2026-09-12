-- ═══════════════════════════════════════════════════════════
-- Expediente — Paso 2: RPC listar_pacientes_expediente
-- Propuesto: 2026-06-26  ·  Aplicado a producción: (PENDIENTE — auditoría)
-- ═══════════════════════════════════════════════════════════
--
-- QUÉ ES
--   RPC LANGUAGE sql SECURITY INVOKER que devuelve, por página, los pacientes
--   visibles para el usuario actual SEGÚN SU RLS, con sus médicos tratantes
--   resueltos en un jsonb (sin N+1), más búsqueda / filtro de médico / rango
--   de fecha de ingreso / orden / paginación.
--
-- POR QUÉ SECURITY INVOKER (NO definer)
--   La RLS de pacientes YA filtra correcto para los 3 roles
--   (20260524_etapa5e_bd1_policies_pacientes.sql:51-68):
--     · médico no-admin → solo pacientes donde es tratante (soy_medico_tratante)
--     · admin / secretaria → todos los de su clínica
--   y además inyecta `clinica_id = get_clinica_id() AND (activo=true OR
--   activo IS NULL)` en la policy principal (admin ve también activo=false vía
--   pacientes_select_inactivos_admin:62-68). El RPC NO debe sortear eso: corre
--   como INVOKER y deja que cada SELECT (a pacientes, a paciente_medico, a
--   profiles) sea filtrado por la RLS del que llama. NADA de SECURITY DEFINER.
--
-- FORMA DE RETORNO EXPLÍCITA (TABLE)
--   El cliente Supabase de servidor es UNTYPED (HECHO sub-fase 1): un nombre de
--   columna mal escrito pasa tsc y revienta en runtime. Al ser LANGUAGE sql con
--   TABLE(...) explícita, Postgres valida las columnas AL CREAR la función →
--   un error de columna falla en deploy de la migración, no en producción.
--
-- COLUMNAS DEVUELTAS (HECHO sub-fase 1: lo que consume la UI)
--   id, numero_expediente, nombre, apellidos, fecha_nacimiento (date CRUDA — la
--   edad se calcula en TS), sexo, created_at (= fecha de ingreso; no hay columna
--   dedicada), activo, clinica_id, y `medicos` jsonb = array de
--   {id, titulo, nombres, apellido_paterno, apellido_materno}. La composición a
--   "Dr. Apellido"/iniciales se hace en TS con src/lib/nombreMedico.ts
--   (CamposNombre = esos 4 campos). NO se compone nombre en SQL.
--
-- BÚSQUEDA — normalización replicada de la UI actual (HECHO sub-fase 1)
--   trim + colapso de espacios internos, luego ILIKE '%term%' sobre nombre y
--   apellidos (comodín a ambos lados; lo sirve el GIN trgm del Paso 1). Sin
--   unaccent (deuda E5-DT-23, fuera de alcance).
--
-- ANTI-INYECCIÓN EN EL ORDEN
--   p_orden y p_direccion NUNCA se interpolan como texto. El ORDER BY es una
--   lista fija de expresiones CASE con WHITELIST de columnas; valores fuera de
--   la whitelist caen al default (created_at DESC). Es la única vía segura en
--   LANGUAGE sql (que no permite EXECUTE dinámico).
--
-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ DECISIÓN Nº1 — COUNT total: CERRADO                                    │
-- │ Este RPC NO calcula total. Devuelve SOLO la página.                   │
-- │ · "hay más": el CALLER pide p_limite = PAGE_SIZE + 1 y deduce que hay  │
-- │   más página si recibió PAGE_SIZE+1 filas (descarta la sobrante).      │
-- │ · total exacto: SOLO en la carga inicial sin filtros, vía count head   │
-- │   desde el caller sobre pacientes (la RLS ya acota por clínica/rol),   │
-- │   NUNCA dentro de este listado.                                        │
-- └─────────────────────────────────────────────────────────────────────┘
--
-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ DECISIÓN Nº2 — Orden por MÉDICO tratante (desempate): CERRADO          │
-- │ Se ordena por MIN(apellido_paterno) de los médicos VISIBLES del        │
-- │ paciente, calculado como escalar `medico_sort` en el MISMO LATERAL que │
-- │ arma el array. Para médico no-admin es su propio apellido (ve un solo  │
-- │ vínculo por su RLS). Sin subquery extra, sin N+1.                      │
-- └─────────────────────────────────────────────────────────────────────┘
--
-- NOTA activo: NO se añade filtro de activo en el RPC; la RLS ya decide la
--   visibilidad de bajas (no-admin no las ve; admin sí, por la 2.ª policy). Si
--   el producto quisiera ocultar bajas también al admin en ESTA lista, sería un
--   parámetro nuevo p_solo_activos — fuera del set de parámetros pedido; se deja
--   anotado, no implementado.
--
-- PAGINACIÓN ESTABLE: el ORDER BY termina SIEMPRE en `p.id` como desempate
--   determinista, para que con claves de orden no únicas (created_at, nombre,
--   apellidos, fecha_nacimiento, medico_sort) la paginación por OFFSET no
--   duplique ni salte filas en los bordes de página.
--
-- UNIDAD DE APLICACIÓN (protocolo D-T6): BEGIN; … COMMIT; explícito.
--
-- ── ROLLBACK (DOWN) — referencia, NO se ejecuta ──────────────
--   DROP FUNCTION IF EXISTS public.listar_pacientes_expediente(
--     text, uuid, timestamptz, timestamptz, text, text, integer, integer);
-- ─────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.listar_pacientes_expediente(
  p_busqueda    text        DEFAULT NULL,
  p_medico_id   uuid        DEFAULT NULL,
  p_fecha_desde timestamptz DEFAULT NULL,
  p_fecha_hasta timestamptz DEFAULT NULL,
  p_orden       text        DEFAULT 'created_at',
  p_direccion   text        DEFAULT 'desc',
  p_limite      integer     DEFAULT 25,
  p_offset      integer     DEFAULT 0
)
RETURNS TABLE (
  id                uuid,
  numero_expediente text,
  nombre            text,
  apellidos         text,
  fecha_nacimiento  date,
  sexo              text,
  created_at        timestamptz,
  activo            boolean,
  clinica_id        uuid,
  medicos           jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
  WITH q AS (
    -- Normalización idéntica a la UI: trim + colapso de espacios internos.
    SELECT nullif(regexp_replace(btrim(p_busqueda), '\s+', ' ', 'g'), '') AS term
  )
  SELECT
    p.id,
    p.numero_expediente,
    p.nombre,
    p.apellidos,
    p.fecha_nacimiento,
    p.sexo,
    p.created_at,
    p.activo,
    p.clinica_id,
    COALESCE(m.medicos, '[]'::jsonb) AS medicos
  FROM public.pacientes p
  CROSS JOIN q
  -- Médicos del paciente resueltos en un solo LATERAL (sin N+1). Filtrado por
  -- la RLS de paciente_medico y de profiles del que llama (INVOKER).
  LEFT JOIN LATERAL (
    SELECT
      jsonb_agg(
        jsonb_build_object(
          'id',               pr.id,
          'titulo',           pr.titulo,
          'nombres',          pr.nombres,
          'apellido_paterno', pr.apellido_paterno,
          'apellido_materno', pr.apellido_materno
        )
        ORDER BY pr.apellido_paterno NULLS LAST, pr.nombres NULLS LAST
      )                          AS medicos,
      min(pr.apellido_paterno)   AS medico_sort   -- DECISIÓN Nº2
    FROM public.paciente_medico pm
    JOIN public.profiles pr ON pr.id = pm.medico_id
    WHERE pm.paciente_id = p.id
  ) m ON true
  WHERE
    -- Búsqueda: ILIKE '%term%' sobre nombre/apellidos (sirve GIN trgm).
    (q.term IS NULL
       OR p.nombre    ILIKE '%' || q.term || '%'
       OR p.apellidos ILIKE '%' || q.term || '%')
    -- Filtro por médico: EXISTS sobre paciente_medico (usa idx_paciente_medico_medico).
    AND (p_medico_id IS NULL OR EXISTS (
          SELECT 1 FROM public.paciente_medico pmf
          WHERE pmf.paciente_id = p.id
            AND pmf.medico_id   = p_medico_id
        ))
    -- Rango de fecha de ingreso (created_at). El caller pasa instantes UTC ya
    -- calculados desde días locales de la clínica: intervalo semiabierto
    -- [p_fecha_desde, p_fecha_hasta). El límite superior es EXCLUSIVO; el caller
    -- envía el inicio del día siguiente. El RPC NO conoce ni aplica zona.
    AND (p_fecha_desde IS NULL OR p.created_at >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR p.created_at <  p_fecha_hasta)
  ORDER BY
    -- WHITELIST de columnas × dirección. Sin interpolación de texto.
    CASE WHEN p_orden = 'nombre'            AND p_direccion = 'asc'  THEN p.nombre            END ASC  NULLS LAST,
    CASE WHEN p_orden = 'nombre'            AND p_direccion = 'desc' THEN p.nombre            END DESC NULLS LAST,
    CASE WHEN p_orden = 'apellidos'         AND p_direccion = 'asc'  THEN p.apellidos         END ASC  NULLS LAST,
    CASE WHEN p_orden = 'apellidos'         AND p_direccion = 'desc' THEN p.apellidos         END DESC NULLS LAST,
    CASE WHEN p_orden = 'numero_expediente' AND p_direccion = 'asc'  THEN p.numero_expediente END ASC  NULLS LAST,
    CASE WHEN p_orden = 'numero_expediente' AND p_direccion = 'desc' THEN p.numero_expediente END DESC NULLS LAST,
    CASE WHEN p_orden = 'fecha_nacimiento'  AND p_direccion = 'asc'  THEN p.fecha_nacimiento  END ASC  NULLS LAST,
    CASE WHEN p_orden = 'fecha_nacimiento'  AND p_direccion = 'desc' THEN p.fecha_nacimiento  END DESC NULLS LAST,
    CASE WHEN p_orden = 'medico'            AND p_direccion = 'asc'  THEN m.medico_sort        END ASC  NULLS LAST,
    CASE WHEN p_orden = 'medico'            AND p_direccion = 'desc' THEN m.medico_sort        END DESC NULLS LAST,
    CASE WHEN p_orden = 'created_at'         AND p_direccion = 'asc'  THEN p.created_at         END ASC  NULLS LAST,
    -- Default: ingreso reciente arriba.
    p.created_at DESC,
    -- Desempate determinista FINAL para paginación estable con claves no únicas.
    p.id
  LIMIT  GREATEST(p_limite, 0)
  OFFSET GREATEST(p_offset, 0);
$fn$;

-- Permisos: igual que el resto de RPCs del proyecto.
REVOKE EXECUTE ON FUNCTION public.listar_pacientes_expediente(
  text, uuid, timestamptz, timestamptz, text, text, integer, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.listar_pacientes_expediente(
  text, uuid, timestamptz, timestamptz, text, text, integer, integer) TO authenticated;

-- ─── POST-FLIGHT ─────────────────────────────────────────────
DO $$
DECLARE
  v_secdef boolean;
  v_grant  boolean;
BEGIN
  SELECT p.prosecdef
    INTO v_secdef
  FROM pg_proc p
  WHERE p.proname = 'listar_pacientes_expediente'
    AND p.pronamespace = 'public'::regnamespace;

  IF v_secdef IS NULL THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: la función no se creó.';
  END IF;
  IF v_secdef IS NOT FALSE THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: la función NO es SECURITY INVOKER (debe serlo).';
  END IF;

  v_grant := has_function_privilege(
    'authenticated',
    'public.listar_pacientes_expediente(text, uuid, timestamptz, timestamptz, text, text, integer, integer)',
    'EXECUTE'
  );
  IF v_grant IS NOT TRUE THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: authenticated NO tiene EXECUTE.';
  END IF;

  RAISE NOTICE 'POST-FLIGHT OK: RPC creado, SECURITY INVOKER, EXECUTE a authenticated.';
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
