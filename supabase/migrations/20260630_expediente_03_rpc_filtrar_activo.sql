-- ═══════════════════════════════════════════════════════════
-- Expediente — Fix: listar_pacientes_expediente debe excluir soft-deleted
-- ═══════════════════════════════════════════════════════════
--
-- BUG QUE CORRIGE
--   El RPC listar_pacientes_expediente NO filtraba `activo`. Es SECURITY
--   INVOKER, y la RLS de pacientes tiene una 2ª policy
--   (pacientes_select_inactivos_admin) que permite al ADMIN de clínica ver los
--   pacientes con activo=false. Por eso el admin veía en la lista los pacientes
--   soft-deleted (borrados). La lista debe excluir borrados para TODO rol.
--
-- FIX
--   Añadir al WHERE el filtro explícito de soft-delete, espejeando la policy
--   pacientes_select_activos: (p.activo = true OR p.activo IS NULL). Se incluye
--   NULL como visible para coincidir con esa policy y con el índice compuesto.
--   Es la ÚNICA diferencia funcional respecto a la función viva en producción.
--
-- NOTA (corrige razonamiento previo): NO se delega la visibilidad de bajas a la
--   RLS. La RLS del admin SÍ expone inactivos (a propósito, para otras
--   pantallas como una futura papelera/restauración). Esta lista filtra activo
--   explícitamente en el WHERE; es la capa correcta (la RLS es global, el
--   caller no puede filtrar sin romper la paginación LIMIT/OFFSET del RPC).
--
-- Forward-only: el RPC ya está en producción; este es un CREATE OR REPLACE con
-- timestamp posterior (no se edita la migración original 20260626_expediente_02).
-- El cuerpo se tomó verbatim de pg_get_functiondef de la función viva; por eso
-- no lleva comentarios inline (el diff contra prod es exactamente la línea del
-- filtro).
--
-- ESTADO: APLICADO en producción vía SQL Editor (verificado: los borrados ya no
--   aparecen en la lista). Este archivo documenta ese cambio en el repo.
--
-- UNIDAD DE APLICACIÓN (protocolo D-T6): BEGIN; … COMMIT; explícito.
--
-- ── ROLLBACK (DOWN) — referencia, NO se ejecuta ──────────────
--   Volver a CREATE OR REPLACE sin la línea (p.activo = true OR p.activo IS NULL).
-- ─────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.listar_pacientes_expediente(
  p_busqueda text DEFAULT NULL::text,
  p_medico_id uuid DEFAULT NULL::uuid,
  p_fecha_desde timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_fecha_hasta timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_orden text DEFAULT 'created_at'::text,
  p_direccion text DEFAULT 'desc'::text,
  p_limite integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
 RETURNS TABLE(id uuid, numero_expediente text, nombre text, apellidos text, fecha_nacimiento date, sexo text, created_at timestamp with time zone, activo boolean, clinica_id uuid, medicos jsonb)
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH q AS (
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
      min(pr.apellido_paterno)   AS medico_sort
    FROM public.paciente_medico pm
    JOIN public.profiles pr ON pr.id = pm.medico_id
    WHERE pm.paciente_id = p.id
  ) m ON true
  WHERE
    (p.activo = true OR p.activo IS NULL)
    AND (q.term IS NULL
       OR p.nombre    ILIKE '%' || q.term || '%'
       OR p.apellidos ILIKE '%' || q.term || '%')
    AND (p_medico_id IS NULL OR EXISTS (
          SELECT 1 FROM public.paciente_medico pmf
          WHERE pmf.paciente_id = p.id
            AND pmf.medico_id   = p_medico_id
        ))
    AND (p_fecha_desde IS NULL OR p.created_at >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR p.created_at <  p_fecha_hasta)
  ORDER BY
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
    p.created_at DESC,
    p.id
  LIMIT  GREATEST(p_limite, 0)
  OFFSET GREATEST(p_offset, 0);
$function$;

REVOKE EXECUTE ON FUNCTION public.listar_pacientes_expediente(
  text, uuid, timestamptz, timestamptz, text, text, integer, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.listar_pacientes_expediente(
  text, uuid, timestamptz, timestamptz, text, text, integer, integer) TO authenticated;

-- ─── POST-FLIGHT ─────────────────────────────────────────────
DO $$
DECLARE
  v_secdef boolean;
  v_grant  boolean;
  v_tiene_filtro boolean;
BEGIN
  SELECT p.prosecdef INTO v_secdef
  FROM pg_proc p
  WHERE p.proname = 'listar_pacientes_expediente'
    AND p.pronamespace = 'public'::regnamespace;

  IF v_secdef IS NULL THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: la función no se creó.';
  END IF;
  IF v_secdef IS NOT FALSE THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: la función NO es SECURITY INVOKER.';
  END IF;

  SELECT pg_get_functiondef(p.oid) LIKE '%p.activo = true OR p.activo IS NULL%'
    INTO v_tiene_filtro
  FROM pg_proc p
  WHERE p.proname = 'listar_pacientes_expediente'
    AND p.pronamespace = 'public'::regnamespace;
  IF v_tiene_filtro IS NOT TRUE THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: el filtro de activo NO quedó en el cuerpo.';
  END IF;

  v_grant := has_function_privilege(
    'authenticated',
    'public.listar_pacientes_expediente(text, uuid, timestamptz, timestamptz, text, text, integer, integer)',
    'EXECUTE'
  );
  IF v_grant IS NOT TRUE THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: authenticated NO tiene EXECUTE.';
  END IF;

  RAISE NOTICE 'POST-FLIGHT OK: RPC actualizado, INVOKER, EXECUTE a authenticated, filtro de activo presente en el cuerpo.';
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
