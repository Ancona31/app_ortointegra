-- ═══════════════════════════════════════════════════════════════════════
-- Agenda B1 — ajustes de la agenda por clínica, candado y el interruptor v2
-- Rama: feature/agenda-v2 · Escrita: 2026-11-11
-- Riesgo estimado: BAJO (tabla nueva, vacía; ningún dato existente tocado,
-- ninguna policy ni permiso de otra tabla movido).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-11-11
--   `docker exec -i supabase_db_app_ortointegra psql -U postgres
--   -v ON_ERROR_STOP=1 -f` del archivo completo (rejilla: 8 × OK + 1 INFO,
--   0 filas), y una segunda pasada igual: misma rejilla, sólo el NOTICE
--   «relation "agenda_ajustes" already exists, skipping», y no-op comprobado
--   comparando antes y después la función (definición y proacl), relacl,
--   RLS y COMMENT de la tabla, columnas con sus DEFAULT y COMMENT,
--   constraints, disparadores, policies (expresiones y roles) y count(*) de
--   audit_log (sin diferencias). Anotada a mano en
--   supabase_migrations.schema_migrations (versión 20261112130000, 23
--   sentencias), por la misma razón que B0 y A1.8.
--   Pruebas: supabase/pruebas-sql/b1_ajustes_agenda.sql
--   (bash scripts/pruebas-sql.sh), src/lib/tests/ajustesAgenda.test.ts y
--   e2e/agenda-interruptor.e2e.ts.
--   Comprobación:
--     select relrowsecurity, (select count(*) from pg_policies
--              where schemaname = 'public' and tablename = 'agenda_ajustes')
--       from pg_class where oid = 'public.agenda_ajustes'::regclass;
--   → t, 3.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR.
-- AUDITORÍA INDEPENDIENTE 2026-11-12: APTA (supabase/AUDITORIA-MIGRACIONES.md),
-- sin cambios en ninguna sentencia. Notas:
--   · La protección del interruptor y del candado decide con current_user. Una
--     función SECURITY DEFINER futura, propiedad de postgres o supabase_admin,
--     que escriba en agenda_ajustes la evadiría. Vigilarlo en B4.
--   · service_role conserva DELETE y TRUNCATE, igual que clinicas y
--     consultorios, y TRUNCATE no audita. Patrón heredado.
--   · El pre-vuelo compara sólo los nombres de columna de una agenda_ajustes ya
--     existente, no sus tipos ni sus constraints.
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Los cuatro ajustes de mejora_agendaV2.md §2 («Ajustes editables por
-- clínica»), con los límites de su tabla, en CHECK. El candado (1 cita activa
-- / 2 reagendados / 3 cancelaciones en 60 días, mismo §2) queda guardado y SIN
-- exponer: sólo el editor SQL lo cambia. agenda_v2_encendida es el interruptor
-- de las funciones nuevas de la agenda, por clínica; sólo el editor SQL lo
-- cambia, y nace apagado.
-- Tabla propia y NO columnas en clinicas: allí el prefijo ajuste_* es contrato
-- con spinus-consola y Spinus nunca lo escribe (CLAUDE.md, «Contrato con
-- spinus-consola»).
-- SIN FILA = valores de fábrica e interruptor apagado (el código cae ahí ante
-- cualquier error, incluida la tabla todavía inexistente). Por eso no hay
-- backfill.
-- `id` existe porque log_tabla_change() escribe NEW.id.
-- Escritura de los 4 ajustes: cliente de SESIÓN y RLS (sólo el administrador
-- de la clínica); sin createAdminClient. Auditoría: disparador
-- log_tabla_change() aquí, más el logAudit con el diff en la ruta (paso B4).
-- updated_at lo pone el disparador de protección en cada UPDATE, venga de
-- quien venga: nadie tiene que acordarse de mandarlo.
--
-- Encender para una clínica (lo hace Angel, como postgres):
--   INSERT INTO public.agenda_ajustes (clinica_id, agenda_v2_encendida)
--   VALUES ('<uuid>', true)
--   ON CONFLICT (clinica_id) DO UPDATE SET agenda_v2_encendida = true;
-- Apagar: lo mismo con false (no borrar la fila: perdería sus ajustes).
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Bloqueos: CREATE TABLE con FK toma SHARE ROW EXCLUSIVE sobre clinicas un
-- instante (bloquea escrituras en clinicas, no lecturas). Lo demás es sobre
-- la tabla nueva, que nadie lee todavía. lock_timeout de 5 s por la cola.
-- Orden respecto al código: PRIMERO esta migración. El código viejo no la
-- lee; el nuevo sin ella cae a «apagado» (falla cerrado).
-- Alcance de los roles:
--   gana   — el administrador de clínica: insertar y cambiar SUS 4 ajustes;
--            los miembros de la clínica (médicos, secretaria): leer su fila.
--   pierde — anon: los privilegios por omisión de Supabase sobre esta tabla
--            (no tenía uso); authenticated: DELETE, TRUNCATE, REFERENCES y
--            TRIGGER sobre ella (sin DELETE por diseño; TRUNCATE se salta la
--            RLS). Sobre las demás tablas nadie gana ni pierde nada.
--   nadie más que postgres y supabase_admin cambia el interruptor, el candado,
--   la clínica, el id o el created_at de una fila (ni service_role).
-- La FK a clinicas es RESTRICT (regla de CLAUDE.md): borrar una clínica con
-- fila de ajustes falla, como ya pasa con consultorios.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   DROP TABLE IF EXISTS public.agenda_ajustes;
--   DROP FUNCTION IF EXISTS public.proteger_agenda_ajustes();
-- Pierde los ajustes escritos por las clínicas (no son datos de pacientes) y
-- deja todos los interruptores apagados. Respaldar antes:
--   CREATE TABLE respaldos.agenda_ajustes_AAAAMMDD AS SELECT * FROM public.agenda_ajustes;
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de crear nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_cols text[];
  c_esperadas CONSTANT text[] := ARRAY['id', 'clinica_id', 'recordatorio_horas', 'anticipacion_min_horas',
    'horizonte_dias', 'vigencia_enlace_unico_dias', 'candado_citas_activas', 'candado_reagendados',
    'candado_cancelaciones', 'candado_ventana_dias', 'agenda_v2_encendida', 'created_at', 'updated_at'];
BEGIN
  IF to_regclass('public.clinicas') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: no existe public.clinicas.';
  END IF;
  IF (SELECT atttypid FROM pg_attribute
       WHERE attrelid = 'public.clinicas'::regclass AND attname = 'id' AND NOT attisdropped) IS DISTINCT FROM 'uuid'::regtype THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.clinicas.id no es uuid.';
  END IF;
  IF to_regprocedure('public.get_clinica_id()') IS NULL
     OR to_regprocedure('public.soy_admin_de_clinica()') IS NULL
     OR to_regprocedure('public.log_tabla_change()') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta get_clinica_id(), soy_admin_de_clinica() o log_tabla_change().';
  END IF;
  -- Las policies de abajo no leen agenda_ajustes: sólo estos dos helpers, que
  -- tienen que ser SECURITY DEFINER (leen profiles sin RLS) para que no haya
  -- recursión ni dependencia de las policies de profiles.
  IF NOT (SELECT bool_and(prosecdef) FROM pg_proc
           WHERE oid IN (to_regprocedure('public.get_clinica_id()'), to_regprocedure('public.soy_admin_de_clinica()'))) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: get_clinica_id() o soy_admin_de_clinica() ya no es SECURITY DEFINER.';
  END IF;
  IF NOT pg_has_role(current_user,
                     (SELECT relowner FROM pg_class WHERE oid = 'public.clinicas'::regclass), 'USAGE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el rol % no es dueño de public.clinicas (lo es %); la FK no se podría crear.',
      current_user, pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = 'public.clinicas'::regclass));
  END IF;
  -- Replay: CREATE TABLE IF NOT EXISTS mira sólo el nombre. Si ya existe, tiene
  -- que ser ESTA tabla (mismas columnas) y de este rol; si no, no se toca.
  IF to_regclass('public.agenda_ajustes') IS NOT NULL THEN
    SELECT array_agg(attname::text) INTO v_cols FROM pg_attribute
     WHERE attrelid = 'public.agenda_ajustes'::regclass AND attnum > 0 AND NOT attisdropped;
    IF NOT (v_cols @> c_esperadas AND v_cols <@ c_esperadas) THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.agenda_ajustes ya existe con OTRAS columnas (%). No se toca.', v_cols;
    END IF;
    IF NOT pg_has_role(current_user,
                       (SELECT relowner FROM pg_class WHERE oid = 'public.agenda_ajustes'::regclass), 'USAGE') THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.agenda_ajustes existe y no es de %.', current_user;
    END IF;
  END IF;
  IF to_regprocedure('public.proteger_agenda_ajustes()') IS NOT NULL
     AND (SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure('public.proteger_agenda_ajustes()')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: proteger_agenda_ajustes() existe como SECURITY DEFINER; tiene que ser invoker (lee current_user).';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · La tabla, sus permisos y su RLS.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agenda_ajustes (
  id                         uuid        NOT NULL DEFAULT gen_random_uuid(),
  clinica_id                 uuid        NOT NULL,
  recordatorio_horas         integer     NOT NULL DEFAULT 24,
  anticipacion_min_horas     integer     NOT NULL DEFAULT 2,
  horizonte_dias             integer     NOT NULL DEFAULT 60,
  vigencia_enlace_unico_dias integer     NOT NULL DEFAULT 7,
  candado_citas_activas      integer     NOT NULL DEFAULT 1,
  candado_reagendados        integer     NOT NULL DEFAULT 2,
  candado_cancelaciones      integer     NOT NULL DEFAULT 3,
  candado_ventana_dias       integer     NOT NULL DEFAULT 60,
  agenda_v2_encendida        boolean     NOT NULL DEFAULT false,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agenda_ajustes_pkey PRIMARY KEY (id),
  CONSTRAINT agenda_ajustes_clinica_key UNIQUE (clinica_id),
  CONSTRAINT agenda_ajustes_clinica_id_fkey FOREIGN KEY (clinica_id)
    REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  CONSTRAINT agenda_ajustes_recordatorio_rango CHECK (recordatorio_horas BETWEEN 1 AND 72),
  CONSTRAINT agenda_ajustes_anticipacion_rango CHECK (anticipacion_min_horas BETWEEN 0 AND 72),
  CONSTRAINT agenda_ajustes_horizonte_rango    CHECK (horizonte_dias BETWEEN 1 AND 365),
  CONSTRAINT agenda_ajustes_vigencia_rango     CHECK (vigencia_enlace_unico_dias BETWEEN 1 AND 30),
  CONSTRAINT agenda_ajustes_candado_rango      CHECK (candado_citas_activas >= 1 AND candado_reagendados >= 0
                                                      AND candado_cancelaciones >= 1 AND candado_ventana_dias >= 1)
);

ALTER TABLE public.agenda_ajustes ENABLE ROW LEVEL SECURITY;
-- Los privilegios por omisión de Supabase dan ALL a anon y authenticated.
REVOKE ALL ON TABLE public.agenda_ajustes FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.agenda_ajustes FROM authenticated;

-- Sin recursión: las policies sólo llaman a helpers SECURITY DEFINER que leen
-- profiles, y nunca a agenda_ajustes. Sin policy de DELETE.
DROP POLICY IF EXISTS agenda_ajustes_select ON public.agenda_ajustes;
CREATE POLICY agenda_ajustes_select ON public.agenda_ajustes FOR SELECT TO authenticated
  USING (clinica_id = public.get_clinica_id());
DROP POLICY IF EXISTS agenda_ajustes_insert ON public.agenda_ajustes;
CREATE POLICY agenda_ajustes_insert ON public.agenda_ajustes FOR INSERT TO authenticated
  WITH CHECK (public.soy_admin_de_clinica() AND clinica_id = public.get_clinica_id());
DROP POLICY IF EXISTS agenda_ajustes_update ON public.agenda_ajustes;
CREATE POLICY agenda_ajustes_update ON public.agenda_ajustes FOR UPDATE TO authenticated
  USING (public.soy_admin_de_clinica() AND clinica_id = public.get_clinica_id())
  WITH CHECK (public.soy_admin_de_clinica() AND clinica_id = public.get_clinica_id());

-- ---------------------------------------------------------------------
-- 3 · Sólo el operador cambia el interruptor, el candado y la identidad de
--     la fila. Invoker a propósito, para que current_user sea quien escribe
--     (mismo patrón que proteger_ajustes_clinica de clinicas).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.proteger_agenda_ajustes()
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
  -- ⚠️ (1, 2, 3, 60) son los DEFAULT de los candado_* de la tabla. Van juntos.
  IF TG_OP = 'INSERT' THEN
    IF NEW.agenda_v2_encendida
       OR (NEW.candado_citas_activas, NEW.candado_reagendados, NEW.candado_cancelaciones, NEW.candado_ventana_dias)
          IS DISTINCT FROM (1, 2, 3, 60) THEN
      RAISE EXCEPTION 'El interruptor y el candado de la agenda sólo se cambian desde el editor SQL'
        USING ERRCODE = '42501';
    END IF;
  ELSIF (NEW.id, NEW.clinica_id, NEW.created_at, NEW.agenda_v2_encendida, NEW.candado_citas_activas,
         NEW.candado_reagendados, NEW.candado_cancelaciones, NEW.candado_ventana_dias)
        IS DISTINCT FROM
        (OLD.id, OLD.clinica_id, OLD.created_at, OLD.agenda_v2_encendida, OLD.candado_citas_activas,
         OLD.candado_reagendados, OLD.candado_cancelaciones, OLD.candado_ventana_dias) THEN
    RAISE EXCEPTION 'El interruptor y el candado de la agenda sólo se cambian desde el editor SQL'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.proteger_agenda_ajustes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proteger_agenda_ajustes() TO anon, authenticated, service_role;

CREATE OR REPLACE TRIGGER trg_agenda_ajustes_proteger
  BEFORE INSERT OR UPDATE ON public.agenda_ajustes
  FOR EACH ROW EXECUTE FUNCTION public.proteger_agenda_ajustes();

CREATE OR REPLACE TRIGGER audit_agenda_ajustes
  AFTER INSERT OR UPDATE OR DELETE ON public.agenda_ajustes
  FOR EACH ROW EXECUTE FUNCTION public.log_tabla_change();

COMMENT ON TABLE public.agenda_ajustes IS
  'Ajustes de agenda por clínica (mejora_agendaV2 §2). Sin fila = valores de fábrica (24 h, 2 h, 60 d, 7 d) e interruptor apagado. Los límites viven aquí en CHECK y en LIMITES_AJUSTES_AGENDA (src/lib/agenda/ajustesAgenda.ts): cambiar los dos.';
COMMENT ON COLUMN public.agenda_ajustes.agenda_v2_encendida IS
  'Interruptor de las funciones nuevas de la agenda para ESTA clínica. Sólo lo cambia postgres (trg_agenda_ajustes_proteger). Cualquier error al leerlo se trata como false.';
COMMENT ON COLUMN public.agenda_ajustes.candado_citas_activas IS
  'Candado de la reserva por enlace (§2), fijo por ahora; no se expone en pantalla. Los cuatro candado_* sólo los cambia postgres, y sus DEFAULT están repetidos en proteger_agenda_ajustes().';

COMMIT;

-- ---------------------------------------------------------------------
-- 4 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO'
            WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'agenda_ajustes existe / RLS activa' AS comprobacion,
         coalesce((SELECT 'sí / ' || relrowsecurity::text FROM pg_class
                    WHERE oid = to_regclass('public.agenda_ajustes')), 'AUSENTE') AS valor,
         'sí / true' AS esperado
  UNION ALL
  SELECT 2, 'policies (ninguna de DELETE)',
         coalesce((SELECT string_agg(cmd, ',' ORDER BY cmd) FROM pg_policies
                    WHERE schemaname = 'public' AND tablename = 'agenda_ajustes'), 'NINGUNA'),
         'INSERT,SELECT,UPDATE'
  UNION ALL
  SELECT 3, 'valores de fábrica (§2), candado e interruptor',
         coalesce((SELECT string_agg(column_name || '=' || column_default, ',' ORDER BY column_name)
                     FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'agenda_ajustes'
                      AND column_name IN ('recordatorio_horas', 'anticipacion_min_horas', 'horizonte_dias',
                                          'vigencia_enlace_unico_dias', 'candado_citas_activas', 'candado_reagendados',
                                          'candado_cancelaciones', 'candado_ventana_dias', 'agenda_v2_encendida')), 'AUSENTE'),
         'agenda_v2_encendida=false,anticipacion_min_horas=2,candado_cancelaciones=3,candado_citas_activas=1,candado_reagendados=2,candado_ventana_dias=60,horizonte_dias=60,recordatorio_horas=24,vigencia_enlace_unico_dias=7'
  UNION ALL
  SELECT 4, 'FK a clinicas es RESTRICT',
         coalesce((SELECT confdeltype::text FROM pg_constraint
                    WHERE conrelid = to_regclass('public.agenda_ajustes') AND conname = 'agenda_ajustes_clinica_id_fkey'), 'AUSENTE'),
         'r'
  UNION ALL
  SELECT 5, 'CHECK de rangos',
         (SELECT count(*)::text FROM pg_constraint
           WHERE conrelid = to_regclass('public.agenda_ajustes') AND contype = 'c'),
         '5'
  UNION ALL
  SELECT 6, 'disparadores',
         coalesce((SELECT string_agg(tgname || '→' || tgfoid::regproc::text, ',' ORDER BY tgname) FROM pg_trigger
                    WHERE tgrelid = to_regclass('public.agenda_ajustes') AND NOT tgisinternal AND tgenabled = 'O'), 'NINGUNO'),
         'audit_agenda_ajustes→log_tabla_change,trg_agenda_ajustes_proteger→proteger_agenda_ajustes'
  UNION ALL
  SELECT 7, 'proteger_agenda_ajustes: definer / EXECUTE PUBLIC,anon,authenticated,service_role',
         coalesce((SELECT p.prosecdef::text || ' / '
                          || (EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                       WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'))::text || ','
                          || has_function_privilege('anon', p.oid, 'EXECUTE')::text || ','
                          || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || ','
                          || has_function_privilege('service_role', p.oid, 'EXECUTE')::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.proteger_agenda_ajustes()')), 'AUSENTE'),
         'false / false,true,true,true'
  UNION ALL
  SELECT 8, 'privilegios de tabla: anon / authenticated',
         coalesce((SELECT coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type)
                                      FROM information_schema.role_table_grants
                                     WHERE table_schema = 'public' AND table_name = 'agenda_ajustes' AND grantee = 'anon'), '-')
                          || ' / '
                          || coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type)
                                         FROM information_schema.role_table_grants
                                        WHERE table_schema = 'public' AND table_name = 'agenda_ajustes' AND grantee = 'authenticated'), '-')
                    WHERE to_regclass('public.agenda_ajustes') IS NOT NULL), 'AUSENTE'),
         '- / INSERT,SELECT,UPDATE'
  UNION ALL
  SELECT 9, 'filas (clínicas con ajustes propios)',
         (SELECT count(*)::text FROM public.agenda_ajustes),
         NULL
) t
ORDER BY t.n;
