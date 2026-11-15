-- ═══════════════════════════════════════════════════════════════════════
-- Agenda G2b — el médico invitado cambia y archiva SUS tipos de cita y su
-- duración de la consulta (policy tipos_cita_update).
-- Rama: feature/agenda-v2-g2 · Escrita: 2026-11-14 · Riesgo: BAJO (una
-- policy; ninguna tabla, dato ni función).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-11-14
--   Antes, en seco con ROLLBACK. `docker exec -i supabase_db_app_ortointegra
--   psql -U postgres -v ON_ERROR_STOP=1 -f` del archivo completo dos veces
--   (rejilla 3 × OK + 1 INFO las dos). Anotada a mano en
--   supabase_migrations.schema_migrations (versión 20261119121000).
--   Pruebas: supabase/pruebas-sql/g2b_tipos_cita_update.sql (en rojo con la
--   policy de B6, con una WITH CHECK sin «sigue siendo suyo» y con una USING
--   de toda la clínica); b6_tipos_cita.sql caso 3 y g2_duracion_consulta.sql
--   caso 6 ajustados a la regla nueva. e2e agenda-configuracion-guiada
--   («la cambia y archiva sus tipos»), en rojo con la policy de B6.
--   Comprobación:
--     select pg_get_expr(polqual, polrelid) from pg_policy
--      where polrelid = 'public.tipos_cita'::regclass and polname = 'tipos_cita_update';
--   → ((clinica_id = get_clinica_id()) AND (soy_admin_de_clinica() OR ((medico_id = auth.uid()) AND (get_my_role() = 'medico'::text)))).
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de B6 y de
--   20261119120000; con el conjunto de la agenda v2).
-- AUDITORÍA INDEPENDIENTE 2026-11-14 (otro modelo, supabase/AUDITORIA-
--   MIGRACIONES.md, las 18 dimensiones, roles probados en vivo con ROLLBACK):
--   APTA, sin cambios. Notas: el invitado puede poner su propio consultorio y
--   principal en una fila suya (legítimo) y no el de otro médico (lo para
--   validar_tipo_cita_consultorio); puede archivar su principal sin dejar otro
--   (lo pidió Angel; el índice único sólo limita a uno como máximo); el
--   pre-vuelo usa pg_has_role(…,'USAGE') como prueba de propiedad, como B6.
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Lo pidió Angel (2026-11-14), literal: «Sí: aplica la migración para que el
-- médico invitado pueda cambiar y archivar SUS tipos de cita y su duración.
-- Solo los suyos, sin poder reasignarlos a otro médico; el administrador
-- conserva lo que ya tiene. Con su auditoría y su prueba.»
-- 20261119120000 dejó al médico CREAR los suyos (tipos_cita_insert) pero no
-- cambiarlos: tipos_cita_update era sólo del administrador (B6).
-- ARCHIVAR ES UN UPDATE (activo = false): tipos_cita no tiene policy ni
-- privilegio de DELETE para authenticated (B6, «se archiva»), así que sólo se
-- toca tipos_cita_update. Ninguna otra policy cambia.
-- La policy nueva:
--   USING      — la fila es de SU clínica y (es administrador, o es médico y
--                la fila es suya: medico_id = auth.uid()).
--   WITH CHECK — la fila RESULTANTE cumple lo mismo: un médico no puede
--                dejarla con medico_id de otro, ni NULL (de toda la clínica),
--                ni de otra clínica. Basta la policy; no hace falta disparador.
-- El administrador: la expresión se reduce a la de B6 (soy_admin_de_clinica()
-- AND clinica_id = get_clinica_id()), en USING y en WITH CHECK: igual que hoy.
-- La secretaria: no es administradora ni médica: igual que hoy (nada).
-- Los disparadores siguen mandando: validar_tipo_cita_medico (el médico es de
-- la clínica) y validar_tipo_cita_consultorio (el consultorio es de ese
-- médico) también en UPDATE.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Bloqueos: DROP/CREATE POLICY toma ACCESS EXCLUSIVE sobre tipos_cita un
-- instante (lock_timeout 5 s). Nada sobre appointments.
-- Orden respecto al código: indiferente para la base. El código nuevo deja
-- pasar al médico en PATCH /api/agenda/tipos-cita/[id]; contra la policy
-- vieja, su PATCH no actualiza ninguna fila y responde 404 (no rompe nada).
-- Alcance de los roles:
--   gana   — el médico (dueño o invitado): editar y archivar/reactivar las
--            filas con medico_id = él, dejándolas suyas.
--   pierde — nadie.
-- Contrato con spinus-consola: no cambia ninguna columna.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   DROP POLICY IF EXISTS tipos_cita_update ON public.tipos_cita;
--   CREATE POLICY tipos_cita_update ON public.tipos_cita FOR UPDATE TO authenticated
--     USING (public.soy_admin_de_clinica() AND clinica_id = public.get_clinica_id())
--     WITH CHECK (public.soy_admin_de_clinica() AND clinica_id = public.get_clinica_id());
-- Ningún dato cambia.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  c_upd_b6  CONSTANT text := '(soy_admin_de_clinica() AND (clinica_id = get_clinica_id()))';
  c_upd_g2b CONSTANT text := '((clinica_id = get_clinica_id()) AND (soy_admin_de_clinica() OR ((medico_id = auth.uid()) AND (get_my_role() = ''medico''::text))))';
  c_ins_g2  CONSTANT text := '((clinica_id = get_clinica_id()) AND (soy_admin_de_clinica() OR ((medico_id = auth.uid()) AND (get_my_role() = ''medico''::text))))';
  v_qual  text;
  v_check text;
BEGIN
  IF to_regclass('public.tipos_cita') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta public.tipos_cita (B6).';
  END IF;
  IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = 'public.tipos_cita'::regclass), 'USAGE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el rol % no es dueño de public.tipos_cita.', current_user;
  END IF;
  IF NOT (SELECT bool_and(prosecdef) FROM pg_proc
           WHERE oid IN (to_regprocedure('public.get_clinica_id()'), to_regprocedure('public.soy_admin_de_clinica()'),
                         to_regprocedure('public.get_my_role()'))) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: get_clinica_id(), soy_admin_de_clinica() o get_my_role() no es SECURITY DEFINER.';
  END IF;
  -- Va después de 20261119120000: su policy de INSERT tiene que estar.
  IF (SELECT pg_get_expr(polwithcheck, polrelid) FROM pg_policy
       WHERE polrelid = 'public.tipos_cita'::regclass AND polname = 'tipos_cita_insert') IS DISTINCT FROM c_ins_g2 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: tipos_cita_insert no es la de 20261119120000. Aplicar antes esa migración.';
  END IF;
  -- La de UPDATE: la de B6 (primera pasada) o la de aquí (replay); otra cosa, no se pisa.
  SELECT pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid) INTO v_qual, v_check
    FROM pg_policy WHERE polrelid = 'public.tipos_cita'::regclass AND polname = 'tipos_cita_update';
  IF NOT ((v_qual = c_upd_b6 AND v_check = c_upd_b6) OR (v_qual = c_upd_g2b AND v_check = c_upd_g2b)) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: tipos_cita_update no es la de B6 ni la de G2b (USING %, CHECK %). Alguien la cambió.', v_qual, v_check;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.tipos_cita'::regclass AND polcmd IN ('d', '*')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: tipos_cita tiene una policy de DELETE o ALL; esta migración da por hecho que se archiva.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · La policy de UPDATE (autorizada por Angel; ninguna otra se toca).
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS tipos_cita_update ON public.tipos_cita;
CREATE POLICY tipos_cita_update ON public.tipos_cita FOR UPDATE TO authenticated
  USING (clinica_id = public.get_clinica_id()
         AND (public.soy_admin_de_clinica()
              OR (medico_id = auth.uid() AND public.get_my_role() = 'medico')))
  WITH CHECK (clinica_id = public.get_clinica_id()
              AND (public.soy_admin_de_clinica()
                   OR (medico_id = auth.uid() AND public.get_my_role() = 'medico')));

COMMIT;

-- ---------------------------------------------------------------------
-- 3 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO'
            WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'tipos_cita_update: USING = WITH CHECK = la nueva' AS comprobacion,
         coalesce((SELECT (pg_get_expr(polqual, polrelid) = pg_get_expr(polwithcheck, polrelid))::text || ' / ' || pg_get_expr(polqual, polrelid)
                     FROM pg_policy WHERE polrelid = 'public.tipos_cita'::regclass AND polname = 'tipos_cita_update'), 'AUSENTE') AS valor,
         'true / ((clinica_id = get_clinica_id()) AND (soy_admin_de_clinica() OR ((medico_id = auth.uid()) AND (get_my_role() = ''medico''::text))))' AS esperado
  UNION ALL
  SELECT 2, 'policies de tipos_cita (sin DELETE)',
         (SELECT string_agg(polname || ':' || polcmd::text, ',' ORDER BY polname) FROM pg_policy WHERE polrelid = 'public.tipos_cita'::regclass),
         'tipos_cita_insert:a,tipos_cita_select:r,tipos_cita_update:w'
  UNION ALL
  SELECT 3, 'privilegios de authenticated sobre tipos_cita',
         (SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
           WHERE table_schema = 'public' AND table_name = 'tipos_cita' AND grantee = 'authenticated'),
         'INSERT,SELECT,UPDATE'
  UNION ALL
  SELECT 4, 'tipos de cita (censo)', (SELECT count(*)::text FROM public.tipos_cita), NULL
) t
ORDER BY t.n;
