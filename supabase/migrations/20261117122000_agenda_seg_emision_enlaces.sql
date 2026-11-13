-- ═══════════════════════════════════════════════════════════════════════
-- Agenda · corrección de seguridad (punto 7a de Angel) — un enlace de
-- reserva sólo lo emite el servidor, con el código que él calcula
-- Rama: feature/agenda-v2-seg2 · Escrita: 2026-11-12
-- Riesgo estimado: BAJO (reemplaza proteger_reserva_enlaces() con la misma
-- firma y crea una función nueva sólo para service_role; ninguna policy,
-- ningún permiso de tabla y ningún dato cambian).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-11-12
--   `docker exec -i supabase_db_app_ortointegra psql -U postgres -v ON_ERROR_STOP=1 -f`
--   del archivo completo, dos pasadas seguidas (rejilla 6 × OK las dos; la segunda sin
--   cambios). Antes, en seco con ROLLBACK. Anotada a mano en
--   supabase_migrations.schema_migrations (sin statements). Pruebas: supabase/pruebas-sql/seg_emision_enlaces.sql, d1_enlaces_reserva.sql (adaptada) y e2e/seguridad-postgrest.e2e.ts
--   (cada caso en rojo con su mutación, mejora_agendaV2.md §9). Comprobación:
--     select md5(prosrc) from pg_proc where oid = 'public.proteger_reserva_enlaces()'::regprocedure;
--     → acd4128b5f25df54f6b4fd95391cf1dc; y has_function_privilege('authenticated',
--     'public.reserva_enlace_emitir(uuid,uuid,uuid,uuid,text,text,text)', 'EXECUTE') → false.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de D1). Va JUNTO con
--   el código de esta rama (POST /api/agenda/enlaces): ver «Orden».
-- AUDITORÍA INDEPENDIENTE 2026-11-12 (otro modelo, las 18 dimensiones de
--   supabase/AUDITORIA-MIGRACIONES.md, con pruebas en vivo rol por rol en local): APTA.
--   Único hallazgo: esta línea de ESTADO · LOCAL sin rellenar (rellenada).
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- mejora_agendaV2.md §6-bis, «Correcciones de seguridad en la base tras la
-- revisión independiente», punto 7a. El código de un enlace es
-- HMAC(RESERVA_SECRETO, 'enlace:'||id) y la base guarda sha256(código)
-- (D1). Pero el alta la hacía el cliente de SESIÓN (insert directo, o
-- reserva_enlace_regenerar_fijo, INVOKER con EXECUTE para authenticated),
-- así que cualquiera con sesión podía, por PostgREST, emitir un enlace con
-- el codigo_hash de un código ELEGIDO por él: uno corto o conocido, o uno
-- que no deriva del secreto y por tanto sobrevive a su rotación (rotar
-- RESERVA_SECRETO es, según el COMMENT de reserva_enlaces, la forma de
-- invalidar TODOS los enlaces). La base no conoce el secreto, así que no
-- puede comprobar el hash: la única garantía es que el INSERT sólo lo haga
-- el servidor. Cambiar el codigo_hash de un enlace emitido ya estaba
-- prohibido (UPDATE → 42501, D1).
--
-- ═══ QUÉ CAMBIA ═════════════════════════════════════════════════════════
-- 1. proteger_reserva_enlaces() (CREATE OR REPLACE, misma firma y grants):
--    · INSERT de cualquier rol que no sea service_role (postgres y
--      supabase_admin ya salían antes) → 42501 «Los enlaces de reserva los
--      emite el servidor». Cubre también reserva_enlace_regenerar_fijo, que
--      inserta con los permisos de quien la llama.
--    · created_by y revocado_por: coalesce(auth.uid(), lo que venga). Para
--      la sesión es auth.uid(), como antes; para service_role (sin sub en el
--      JWT) es el actor que pasa reserva_enlace_emitir. Todo lo demás, igual
--      (vigencia congelada, usado una vez y sólo por service_role, revocar
--      sin reactivar, lo emitido no se modifica).
-- 2. reserva_enlace_emitir(p_clinica_id, p_actor, p_id, p_medico_id,
--    p_clase, p_codigo_hash, p_etiqueta) → uuid. INVOKER, sólo
--    service_role. Repite la regla de las policies de reserva_enlaces
--    (lista A, 16) con p_actor en vez de auth.uid(): el actor es de ESA
--    clínica y es el médico del enlace, un médico administrador o la
--    secretaria (42501 si no). El médico del enlace lo sigue comprobando el
--    disparador (23514). Fijo: revoca el vigente y emite otro en la misma
--    transacción (lo que hacía reserva_enlace_regenerar_fijo); único: emite.
--    Sin p_etiqueta en un fijo. Error de argumentos: 22023.
-- reserva_enlace_regenerar_fijo(uuid, uuid, text) se queda (Protocolo 2:
--   no se borra en este paso); ya no puede insertar como authenticated
--   (falla entera, sin revocar nada) y como service_role no tiene clínica.
--   Sin llamadores tras este cambio: retirarla es una limpieza aparte.
-- Las policies reserva_enlaces_insert/update no se tocan: la de INSERT ya
--   no tiene camino que la use, y la de UPDATE sigue sirviendo para revocar
--   con la sesión (PATCH /api/agenda/enlaces/[id]).
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere D1. PG ≥ 14. Bloqueos: sólo catálogo (CREATE OR REPLACE
--   FUNCTION); el disparador no se recrea.
-- Orden respecto al código: el código nuevo de POST /api/agenda/enlaces
--   llama a reserva_enlace_emitir con el cliente de servicio; sin esta
--   migración esa llamada da PGRST202 → 500 al emitir (nada se escribe).
--   El código viejo contra la base migrada también da error al emitir
--   (42501 → 403). Ninguno de los dos órdenes pierde datos; con la agenda v2
--   apagada (producción hoy) la ruta contesta 404 antes. Lo seguro:
--   aplicar y desplegar juntos, o migración primero con v2 apagada.
-- Alcance de los roles:
--   pierde — authenticated: insertar en reserva_enlaces (y por tanto
--            ejecutar con efecto reserva_enlace_regenerar_fijo). Sigue
--            pudiendo leer y revocar con su RLS.
--   gana   — service_role: EXECUTE de reserva_enlace_emitir, y que el
--            created_by/revocado_por que pase se conserve.
-- Contrato con spinus-consola: ninguna columna cambia.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   DROP FUNCTION IF EXISTS public.reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text);
--   y volver a crear proteger_reserva_enlaces() con el cuerpo de
--   20261114120000_agenda_d1_enlaces_reserva.sql (sección 4; misma firma,
--   los grants se conservan). Con la vuelta atrás, el código de esta rama
--   ya no puede emitir enlaces.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  -- md5(prosrc) del cuerpo de D1 y del de este archivo (segunda pasada).
  c_d1    CONSTANT text := '181cee8564a9ab7c0ad01c51d63af04f';
  c_nuevo CONSTANT text := 'acd4128b5f25df54f6b4fd95391cf1dc';
  v_md5   text;
BEGIN
  IF to_regclass('public.reserva_enlaces') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta public.reserva_enlaces (D1).';
  END IF;
  SELECT md5(prosrc) INTO v_md5 FROM pg_proc WHERE oid = to_regprocedure('public.proteger_reserva_enlaces()');
  IF v_md5 IS NULL OR v_md5 NOT IN (c_d1, c_nuevo) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: proteger_reserva_enlaces() no es la de D1 ni la de este archivo (md5 %); revisar a mano.', v_md5;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('public.proteger_reserva_enlaces()') AND prosecdef) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: proteger_reserva_enlaces() es SECURITY DEFINER; decide con current_user y tiene que ser invoker.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.reserva_enlaces'::regclass
                  AND tgname = 'trg_reserva_enlaces_proteger' AND tgenabled = 'O') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta el disparador trg_reserva_enlaces_proteger (D1).';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'reserva_enlace_emitir'
               AND (p.prosecdef OR p.oid IS DISTINCT FROM to_regprocedure('public.reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text)'))) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: reserva_enlace_emitir existe como SECURITY DEFINER o con otra firma.';
  END IF;
  IF NOT coalesce((SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role'), false)
     OR NOT has_table_privilege('service_role', 'public.reserva_enlaces', 'INSERT')
     OR NOT has_table_privilege('service_role', 'public.reserva_enlaces', 'UPDATE')
     OR NOT has_table_privilege('service_role', 'public.profiles', 'SELECT') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: service_role sin BYPASSRLS o sin INSERT/UPDATE en reserva_enlaces o SELECT en profiles.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · La protección: el alta sólo la hace el servidor.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.proteger_reserva_enlaces()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
  END IF;
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    -- Punto 7a: el código (y su hash) lo calcula el servidor con RESERVA_SECRETO; la base no puede comprobarlo.
    IF current_user <> 'service_role' THEN
      RAISE EXCEPTION 'Los enlaces de reserva los emite el servidor' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles p
                    WHERE p.id = NEW.medico_id AND p.clinica_id = NEW.clinica_id AND p.role = 'medico') THEN
      RAISE EXCEPTION 'El médico del enlace no pertenece a la clínica' USING ERRCODE = '23514';
    END IF;
    NEW.created_at    := now();
    NEW.updated_at    := now();
    NEW.usado_en      := NULL;
    NEW.usado_cita_id := NULL;
    NEW.revocado_en   := NULL;
    NEW.revocado_por  := NULL;
    NEW.created_by    := coalesce(auth.uid(), NEW.created_by);
    IF NEW.clase = 'unico' THEN
      NEW.vigencia_dias := coalesce((SELECT j.vigencia_enlace_unico_dias FROM public.agenda_ajustes j
                                      WHERE j.clinica_id = NEW.clinica_id), 7);
      NEW.caduca_en := now() + make_interval(days => NEW.vigencia_dias);
    ELSE
      NEW.vigencia_dias := NULL;
      NEW.caduca_en     := NULL;
    END IF;
    RETURN NEW;
  END IF;
  IF (NEW.id, NEW.clinica_id, NEW.medico_id, NEW.clase, NEW.codigo_hash, NEW.etiqueta, NEW.vigencia_dias,
      NEW.caduca_en, NEW.created_by, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.clinica_id, OLD.medico_id, OLD.clase, OLD.codigo_hash, OLD.etiqueta, OLD.vigencia_dias,
      OLD.caduca_en, OLD.created_by, OLD.created_at) THEN
    RAISE EXCEPTION 'Un enlace emitido no se modifica: se revoca y se emite otro' USING ERRCODE = '42501';
  END IF;
  IF (NEW.revocado_en, NEW.revocado_por) IS DISTINCT FROM (OLD.revocado_en, OLD.revocado_por) THEN
    IF OLD.revocado_en IS NOT NULL OR NEW.revocado_en IS NULL THEN
      RAISE EXCEPTION 'Un enlace revocado no se reactiva' USING ERRCODE = '42501';
    END IF;
    NEW.revocado_en  := now();
    NEW.revocado_por := coalesce(auth.uid(), NEW.revocado_por);
  END IF;
  IF (NEW.usado_en, NEW.usado_cita_id) IS DISTINCT FROM (OLD.usado_en, OLD.usado_cita_id) THEN
    IF current_user <> 'service_role' OR OLD.usado_en IS NOT NULL OR NEW.usado_en IS NULL THEN
      RAISE EXCEPTION 'Sólo la reserva marca un enlace como usado, y una sola vez' USING ERRCODE = '42501';
    END IF;
    -- La cita que lo gasta es de ESTE enlace y de ESTA clínica (la FK de
    -- usado_cita_id es de una sola columna: esto la ata a la clínica sin
    -- añadir un UNIQUE(id, clinica_id) a appointments).
    IF NOT EXISTS (SELECT 1 FROM public.appointments a
                    WHERE a.id = NEW.usado_cita_id AND a.clinica_id = NEW.clinica_id
                      AND a.reserva_enlace_id = NEW.id) THEN
      RAISE EXCEPTION 'La cita que gasta el enlace no es de ese enlace' USING ERRCODE = '23514';
    END IF;
    NEW.usado_en := now();
  END IF;
  RETURN NEW;
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.proteger_reserva_enlaces() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proteger_reserva_enlaces() TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3 · La emisión, sólo para el servidor.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserva_enlace_emitir(p_clinica_id uuid, p_actor uuid, p_id uuid, p_medico_id uuid,
                                                        p_clase text, p_codigo_hash text, p_etiqueta text)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF p_clinica_id IS NULL OR p_actor IS NULL OR p_id IS NULL OR p_medico_id IS NULL OR p_codigo_hash IS NULL
     OR p_clase IS NULL OR p_clase NOT IN ('fijo', 'unico') OR (p_clase = 'fijo' AND p_etiqueta IS NOT NULL) THEN
    RAISE EXCEPTION 'reserva_enlace_emitir: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  -- La regla de las policies de reserva_enlaces (lista A, 16) con el actor en lugar de auth.uid().
  IF NOT EXISTS (SELECT 1 FROM public.profiles p
                  WHERE p.id = p_actor AND p.clinica_id = p_clinica_id
                    AND (p.id = p_medico_id OR (p.role = 'medico' AND p.es_admin_de_clinica IS TRUE)
                         OR p.role = 'secretaria')) THEN
    RAISE EXCEPTION 'reserva_enlace_emitir: quien emite no gestiona los enlaces de ese médico' USING ERRCODE = '42501';
  END IF;
  IF p_clase = 'fijo' THEN
    UPDATE public.reserva_enlaces
       SET revocado_en = now(), revocado_por = p_actor
     WHERE clinica_id = p_clinica_id AND medico_id = p_medico_id AND clase = 'fijo' AND revocado_en IS NULL;
  END IF;
  INSERT INTO public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash, etiqueta, created_by)
  VALUES (p_id, p_clinica_id, p_medico_id, p_clase, p_codigo_hash, p_etiqueta, p_actor);
  RETURN p_id;
END
$fn$;

-- Más cerrada que la regla general (justificación: el código lo calcula el
-- servidor con un secreto; que la sesión pueda llamarla es justo el hueco).
REVOKE EXECUTE ON FUNCTION public.reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text) TO service_role;

COMMENT ON FUNCTION public.reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text) IS
  'Agenda v2 (corrección de seguridad, punto 7a): emite un enlace de reserva. Sólo service_role (POST /api/agenda/enlaces, con el código derivado de RESERVA_SECRETO). p_actor = quien lo pide, comprobado con la regla de las policies de reserva_enlaces. Fijo: revoca el vigente y emite otro, atómico. Único: emite (la vigencia la congela el disparador).';
COMMENT ON FUNCTION public.proteger_reserva_enlaces() IS
  'Protección de reserva_enlaces (D1; alta sólo por service_role desde la corrección de seguridad 7a). Decide con current_user: postgres/supabase_admin libres; INSERT sólo service_role; lo emitido no se modifica; revocar una vez; marcar usado sólo service_role y una vez.';

COMMIT;

-- ---------------------------------------------------------------------
-- 4 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'proteger_reserva_enlaces: cuerpo nuevo (md5) / invoker' AS comprobacion,
         coalesce((SELECT md5(prosrc) || ' / ' || (NOT prosecdef)::text FROM pg_proc
                    WHERE oid = to_regprocedure('public.proteger_reserva_enlaces()')), 'AUSENTE') AS valor,
         'acd4128b5f25df54f6b4fd95391cf1dc / true' AS esperado
  UNION ALL
  SELECT 2, 'EXECUTE de reserva_enlace_emitir: anon,authenticated,service_role / PUBLIC',
         coalesce((SELECT has_function_privilege('anon', p.oid, 'EXECUTE')::text || ',' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                    || ',' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text || ' / '
                    || EXISTS (SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee = 0 AND x.privilege_type = 'EXECUTE')::text
                    FROM pg_proc p WHERE p.oid = to_regprocedure('public.reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text)')), 'AUSENTE'),
         'false,false,true / false'
  UNION ALL
  SELECT 3, 'reserva_enlace_emitir INVOKER con search_path vacío',
         coalesce((SELECT (NOT prosecdef)::text || ' / ' || (proconfig @> ARRAY['search_path=""'])::text FROM pg_proc
                    WHERE oid = to_regprocedure('public.reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text)')), 'AUSENTE'),
         'true / true'
  UNION ALL
  SELECT 4, 'EXECUTE de proteger_reserva_enlaces: anon,authenticated,service_role / PUBLIC',
         coalesce((SELECT has_function_privilege('anon', p.oid, 'EXECUTE')::text || ',' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                    || ',' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text || ' / '
                    || EXISTS (SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee = 0 AND x.privilege_type = 'EXECUTE')::text
                    FROM pg_proc p WHERE p.oid = to_regprocedure('public.proteger_reserva_enlaces()')), 'AUSENTE'),
         'true,true,true / false'
  UNION ALL
  SELECT 5, 'policies de reserva_enlaces, intactas',
         (SELECT string_agg(policyname || ':' || cmd, ',' ORDER BY policyname) FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'reserva_enlaces'),
         'reserva_enlaces_insert:INSERT,reserva_enlaces_select:SELECT,reserva_enlaces_update:UPDATE'
  UNION ALL
  SELECT 6, 'sin sobrecargas de reserva_enlace_emitir',
         (SELECT count(*)::text FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'reserva_enlace_emitir'),
         '1'
) t
ORDER BY t.n;
