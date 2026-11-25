-- ═══════════════════════════════════════════════════════════════════════
-- Avisos globales · MA — cierre de la tercera auditoría de M1 y M2
-- Rama: feature/agenda-para-todos · Escrita: 2026-11-25
-- Guion y repaso del autor: docs/spec/agenda-para-todos/
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: 2026-11-25, stack local de Supabase (CLI 2.117.0) con las 16
--   migraciones anteriores: aplicada, deshecha con su reversa y vuelta a
--   aplicar; pruebas av5_avisos_cierre_auditoria.sql y scripts/avisos-carrera.sh
--   en verde.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR. PENDIENTE DE ENSAYO SOBRE EL CLON
--   DE ESTRUCTURA Y DE AUDITORÍA INDEPENDIENTE (supabase/AUDITORIA-MIGRACIONES.md).
--
-- POR QUÉ EXISTE: M1 (20261202120000) y M2 se aplicaron en producción el
--   2026-11-25. Su tercera auditoría dejó cuatro hallazgos bajos que no se
--   corrigieron en M1 para no reabrir su ciclo. M1 y M2 son historia aplicada:
--   NO se editan. Se corrigen aquí.
--
-- QUÉ HACE:
--   1 · LA COPIA DEL MÉDICO (hallazgo 1). Un aviso con cita guarda una copia del
--       médico de su cita (avisos_clinica.medico_id), que es por donde lee el
--       médico invitado. Los avisos anteriores a M1, y los que nazcan sin los
--       disparadores de M1 (tras su reversa «con datos»), no la tienen y se leen
--       por la rama lenta. Aquí se RELLENA: todo aviso con cita cuya copia falta
--       o no coincide con el médico de su cita. Sólo esa columna; cada cambio
--       queda en audit_log (audit_avisos_clinica). Para los futuros: esta
--       migración va detrás de M1 en la cadena, así que toda ida de M1 (también
--       desde la forma conservada) va seguida de este relleno.
--   2 · «MARCAR TODOS» NO SE TRAGA UN AVISO QUE NADIE VIO (hallazgo 2).
--       creado_en es la hora de INICIO de la transacción que escribe el aviso
--       (now()), o la del refresco (clock_timestamp()): en los dos casos, una
--       hora ANTERIOR a su confirmación. Si alguien pulsa «Marcar todos» entre
--       esa hora y la confirmación, el aviso nace por debajo de la marca de agua
--       y nunca sale como pendiente.
--       Arreglo: la marca de agua NO PUEDE ADELANTAR al inicio de la transacción
--       abierta más antigua (aviso_visto_hasta_sellar la recorta a un instante
--       antes de ese inicio). Todo aviso que confirme después de la marca lo
--       escribe una transacción que estaba abierta al marcar, o una posterior:
--       su creado_en es >= el inicio de su transacción > la marca. Vale para el
--       alta y para el refresco.
--       Para que el gesto siga vaciando la lista cuando hay una transacción
--       larga abierta (un volcado, una sesión olvidada): avisos_revisar_todos
--       marca además UNO A UNO (avisos_vistos) lo que quien llama VE entre la
--       marca que quedó y la que pidió. Lo que no ve todavía no se marca.
--   3 · REASIGNAR UNA CITA NO ESPERA NI FALLA POR SUS AVISOS (hallazgo 4).
--       aviso_clinica_de_cambio_medico esperaba sin límite si otra sesión tenía
--       tomada la fila de un aviso de la cita; pasados los 8 s del
--       statement_timeout la reasignación caía con 57014 (que WHEN OTHERS no
--       atrapa). Ahora espera como mucho 200 ms; si no la consigue, actualiza
--       los avisos libres (SKIP LOCKED), deja un WARNING y la cita se reasigna.
--       El aviso que quedó tomado conserva la copia vieja: lo enseña el conteo
--       «avisos cuya copia no es el médico de su cita» y lo corrige el paso 1 de
--       esta migración al volver a aplicarse o el UPDATE de su cabecera.
--   NO HACE (hallazgo 3): el pre-vuelo de la «forma conservada» de M1 no mira
--       restricciones ni índices puestos a mano. Sólo afecta a re-aplicar M1
--       tras su reversa, y M1 no se edita: se cubre con una fila de sólo lectura
--       en los conteos (conteos-agenda-para-todos.sql, sección MA), que se
--       corren antes de re-aplicar.
--   NO toca ninguna policy, ninguna tabla nueva, ni los escritores de F4/M1.
--
-- ⚠️ avisos_transaccion_mas_antigua() ES SECURITY DEFINER: lee pg_stat_activity
--   como su dueño (postgres, que en Supabase es miembro de pg_read_all_stats;
--   el pre-vuelo lo exige) porque la sesión no ve el xact_start de las demás.
--   Devuelve UN instante y nada más. Si dejara de ver las demás sesiones, la
--   marca de agua volvería a poder adelantarse (el defecto de antes), sin error:
--   lo vigila la prueba de dos sesiones.
-- Reparar a mano una copia vieja (como postgres; sólo esa columna):
--   UPDATE public.avisos_clinica a SET medico_id = ap.medico_id FROM public.appointments ap
--    WHERE a.cita_id = ap.id AND a.clinica_id = ap.clinica_id AND a.medico_id IS DISTINCT FROM ap.medico_id;
--
-- Depende de: M1 (20261202120000): reescribe TRES de sus funciones, partiendo
--   de su cuerpo (el pre-vuelo exige su huella). No depende de M3.
-- Bloqueos: sólo catálogo y los candados de fila del relleno (avisos_clinica).
-- Ventana de despliegue: cualquiera de los dos órdenes es seguro. El código no
--   cambia: las funciones conservan firma, tipo de retorno y privilegios.
-- Riesgo: BAJO.
-- No re-ejecutable: una segunda pasada ABORTA en el pre-vuelo sin cambiar nada.
-- Vuelta atrás: supabase/reversas/20261203130000_avisos_globales_cierre_auditoria_reversa.sql
-- Pruebas: supabase/pruebas-sql/av5_avisos_cierre_auditoria.sql y scripts/avisos-carrera.sh
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DROP TABLE IF EXISTS pg_temp._ma_antes;
CREATE TEMP TABLE _ma_antes (con_cita bigint NOT NULL, sin_copia bigint NOT NULL, copia_vieja bigint NOT NULL);

DO $$
DECLARE
  v_f record;
BEGIN
  IF to_regprocedure('public.avisos_transaccion_mas_antigua()') IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.avisos_transaccion_mas_antigua() ya existe: esta migración ya está aplicada. No se repite.';
  END IF;
  IF to_regclass('public.avisos_vistos') IS NULL OR to_regclass('public.avisos_vistos_hasta') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = to_regclass('public.appointments')
                       AND tgname = 'trg_appointments_aviso_medico' AND tgenabled = 'O')
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = to_regclass('public.avisos_vistos_hasta')
                       AND tgname = 'trg_avisos_vistos_hasta_sellar' AND tgenabled = 'O') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta M1 (20261202120000_avisos_globales_modelo): avisos_vistos, avisos_vistos_hasta o sus disparadores.';
  END IF;
  -- Las tres funciones de M1 que se reescriben, con SU cuerpo (fines de línea normalizados: dimensión 28).
  FOR v_f IN SELECT * FROM (VALUES
      ('public.aviso_visto_hasta_sellar()',        '839f7457daa2d7c618daaea254106d7e', false),
      ('public.avisos_revisar_todos(timestamptz)', '5e1f662fee337d583e590d377425aec4', false),
      ('public.aviso_clinica_de_cambio_medico()',  '200f5f6fec02d59bea2e51686ebf3a43', true)) t(firma, huella, definer)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure(v_f.firma)
                      AND p.prosecdef = v_f.definer AND p.proconfig = ARRAY['search_path=""']
                      AND md5(replace(p.prosrc, E'\r\n', E'\n')) = v_f.huella) THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: % no es la de M1 (su cuerpo, su SECURITY y su search_path): alguien la cambió. No se reescribe a ciegas.', v_f.firma;
    END IF;
    IF NOT pg_has_role(current_user, (SELECT proowner FROM pg_proc WHERE oid = to_regprocedure(v_f.firma)), 'USAGE') THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: % no es dueño de %.', current_user, v_f.firma;
    END IF;
  END LOOP;
  IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = to_regclass('public.avisos_clinica')), 'USAGE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: % no es dueño de public.avisos_clinica.', current_user;
  END IF;
  -- La función nueva lee el inicio de las transacciones de TODAS las sesiones: su dueño tiene que poder.
  IF NOT (SELECT rolsuper FROM pg_roles WHERE rolname = current_user)
     AND NOT pg_has_role(current_user, 'pg_read_all_stats', 'USAGE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: % no es miembro de pg_read_all_stats: avisos_transaccion_mas_antigua() no vería las transacciones de las demás sesiones.', current_user;
  END IF;
  INSERT INTO pg_temp._ma_antes
  SELECT count(*), count(*) FILTER (WHERE a.medico_id IS NULL AND ap.medico_id IS NOT NULL),
         count(*) FILTER (WHERE a.medico_id IS NOT NULL AND a.medico_id IS DISTINCT FROM ap.medico_id)
    FROM public.avisos_clinica a JOIN public.appointments ap ON ap.id = a.cita_id AND ap.clinica_id = a.clinica_id;
END $$;

-- ---------------------------------------------------------------------
-- 1 · El inicio de la transacción abierta más antigua de ESTA base, sin contar
--     la propia ni el mantenimiento (autovacuum, replicación). NULL = ninguna.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.avisos_transaccion_mas_antigua()
 RETURNS timestamptz
 LANGUAGE sql
 VOLATILE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT min(s.xact_start)
    FROM pg_catalog.pg_stat_activity s
   WHERE s.datname = pg_catalog.current_database()
     AND s.pid <> pg_catalog.pg_backend_pid()
     AND s.xact_start IS NOT NULL
     AND s.backend_type NOT LIKE 'autovacuum%' AND s.backend_type <> 'walsender'
$function$;
REVOKE EXECUTE ON FUNCTION public.avisos_transaccion_mas_antigua() FROM PUBLIC, anon, service_role;
GRANT  EXECUTE ON FUNCTION public.avisos_transaccion_mas_antigua() TO authenticated;
COMMENT ON FUNCTION public.avisos_transaccion_mas_antigua() IS
  'Avisos globales (MA): el inicio de la transacción abierta más antigua de esta base (sin la propia, autovacuum ni replicación), o NULL. La usa aviso_visto_hasta_sellar para que «Marcar todos» no adelante a un aviso cuya transacción aún no confirmó. SECURITY DEFINER a propósito: la sesión no ve el xact_start de las demás. Sólo devuelve un instante.';

-- ---------------------------------------------------------------------
-- 2 · La marca de agua: nunca en el futuro, nunca hacia atrás (como en M1) y,
--     nuevo, nunca por delante de una transacción que sigue abierta.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aviso_visto_hasta_sellar()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_ahora   timestamptz := clock_timestamp();
  v_abierta timestamptz := public.avisos_transaccion_mas_antigua();
BEGIN
  NEW.hasta := least(coalesce(NEW.hasta, v_ahora), v_ahora);
  -- Un aviso que confirme después nace con creado_en >= el inicio de su transacción: la marca se queda antes.
  IF v_abierta IS NOT NULL THEN
    NEW.hasta := least(NEW.hasta, v_abierta - interval '1 microsecond');
  END IF;
  IF TG_OP = 'UPDATE' THEN NEW.hasta := greatest(OLD.hasta, NEW.hasta); END IF;
  RETURN NEW;
END
$function$;

-- El gesto. Igual que en M1 (p_hasta = el creado_en del aviso más nuevo que la persona tenía a la
-- vista; NULL = ahora), y además: si la marca quedó por detrás de lo pedido (había una transacción
-- abierta), lo que quien llama VE entre las dos se marca uno a uno. INVOKER, con la sesión y bajo RLS.
CREATE OR REPLACE FUNCTION public.avisos_revisar_todos(p_hasta timestamptz)
 RETURNS boolean
 LANGUAGE plpgsql
 VOLATILE
 SET search_path TO ''
AS $function$
DECLARE
  v_yo     uuid := auth.uid();
  v_cl     uuid := public.get_clinica_id();
  v_ahora  timestamptz := clock_timestamp();
  v_pedido timestamptz := least(coalesce(p_hasta, v_ahora), v_ahora);
  v_puesto timestamptz;
BEGIN
  INSERT INTO public.avisos_vistos_hasta AS x (usuario_id, clinica_id, hasta)
  VALUES (v_yo, v_cl, p_hasta)
  ON CONFLICT (usuario_id) DO UPDATE SET clinica_id = EXCLUDED.clinica_id, hasta = EXCLUDED.hasta
  RETURNING x.hasta INTO v_puesto;
  IF v_puesto < v_pedido THEN
    INSERT INTO public.avisos_vistos AS v (aviso_id, usuario_id, clinica_id)
    SELECT a.id, v_yo, v_cl
      FROM public.avisos_clinica a
     WHERE a.clinica_id = v_cl AND a.revisado_en IS NULL
       AND a.creado_en > v_puesto AND a.creado_en <= v_pedido
     ORDER BY a.creado_en DESC, a.id DESC
     LIMIT 1000
    ON CONFLICT (aviso_id, usuario_id) DO UPDATE SET visto_en = EXCLUDED.visto_en;
  END IF;
  RETURN true;
END
$function$;
COMMENT ON FUNCTION public.avisos_revisar_todos(timestamptz) IS
  'Avisos globales: «Marcar todos como revisados» para quien llama: su marca de agua en avisos_vistos_hasta (hasta = p_hasta o ahora; nunca hacia atrás ni por delante de una transacción abierta: MA, 20261203130000). Si la marca queda por detrás de lo pedido, marca uno a uno (avisos_vistos) los avisos que quien llama ve en ese tramo (hasta 1000). Lo que se reabre después vuelve a estar pendiente. INVOKER, bajo RLS.';

-- ---------------------------------------------------------------------
-- 3 · Cambio de médico de una cita: la copia de sus avisos, sin poder
--     bloquear ni tumbar la reasignación.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aviso_clinica_de_cambio_medico()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_antes text;
BEGIN
  BEGIN
    -- Espera corta por los avisos de la cita. El ajuste es de esta transacción y se devuelve al salir
    -- (y solo, si el bloque falla: los cambios de ajustes se deshacen con el subbloque).
    v_antes := current_setting('lock_timeout');
    PERFORM set_config('lock_timeout', '200ms', true);
    UPDATE public.avisos_clinica a SET medico_id = NEW.medico_id
     WHERE a.cita_id = NEW.id AND a.clinica_id = NEW.clinica_id AND a.medico_id IS DISTINCT FROM NEW.medico_id;
    PERFORM set_config('lock_timeout', v_antes, true);
  EXCEPTION
    WHEN lock_not_available THEN
      -- Otra sesión tiene tomado alguno: se actualizan los libres y la reasignación sigue.
      BEGIN
        UPDATE public.avisos_clinica a SET medico_id = NEW.medico_id
         WHERE a.id IN (SELECT b.id FROM public.avisos_clinica b
                         WHERE b.cita_id = NEW.id AND b.clinica_id = NEW.clinica_id
                           AND b.medico_id IS DISTINCT FROM NEW.medico_id
                           FOR UPDATE SKIP LOCKED);
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
      RAISE WARNING 'aviso_clinica_de_cambio_medico: algún aviso de la cita estaba tomado; conserva el médico anterior (SQLSTATE 55P03)';
    WHEN OTHERS THEN
      RAISE WARNING 'aviso_clinica_de_cambio_medico: médico de los avisos no actualizado (SQLSTATE %)', SQLSTATE;
  END;
  RETURN NULL;
END
$function$;

-- ---------------------------------------------------------------------
-- 4 · El relleno de la copia (hallazgo 1). Sólo avisos con cita; sólo medico_id.
-- ---------------------------------------------------------------------
UPDATE public.avisos_clinica a SET medico_id = ap.medico_id
  FROM public.appointments ap
 WHERE a.cita_id = ap.id AND a.clinica_id = ap.clinica_id
   AND a.medico_id IS DISTINCT FROM ap.medico_id;

-- ---------------------------------------------------------------------
-- 5 · Post-vuelo.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = 'public.avisos_transaccion_mas_antigua()'::regprocedure
                    AND p.prosecdef AND p.proconfig = ARRAY['search_path=""']
                    AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee = 0))
     OR has_function_privilege('anon', 'public.avisos_transaccion_mas_antigua()', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.avisos_transaccion_mas_antigua()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.avisos_transaccion_mas_antigua()', 'EXECUTE') THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: avisos_transaccion_mas_antigua() no quedó DEFINER, con search_path vacío y sólo para authenticated.';
  END IF;
  -- CREATE OR REPLACE conserva privilegios, SECURITY y ajustes: se comprueba.
  IF has_function_privilege('anon', 'public.avisos_revisar_todos(timestamptz)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.avisos_revisar_todos(timestamptz)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.avisos_revisar_todos(timestamptz)', 'EXECUTE')
     OR (SELECT prosecdef OR proconfig IS DISTINCT FROM ARRAY['search_path=""'] FROM pg_proc
          WHERE oid = 'public.avisos_revisar_todos(timestamptz)'::regprocedure)
     OR (SELECT prosecdef OR proconfig IS DISTINCT FROM ARRAY['search_path=""'] FROM pg_proc
          WHERE oid = 'public.aviso_visto_hasta_sellar()'::regprocedure)
     OR (SELECT NOT prosecdef OR proconfig IS DISTINCT FROM ARRAY['search_path=""'] FROM pg_proc
          WHERE oid = 'public.aviso_clinica_de_cambio_medico()'::regprocedure) THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: alguna de las tres funciones reescritas cambió de SECURITY, de search_path o de privilegios.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.avisos_clinica a JOIN public.appointments ap ON ap.id = a.cita_id AND ap.clinica_id = a.clinica_id
              WHERE a.medico_id IS DISTINCT FROM ap.medico_id) THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: quedan avisos con cita cuya copia no es el médico de su cita.';
  END IF;
END $$;

COMMIT;

SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO' WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'avisos_transaccion_mas_antigua: DEFINER, search_path vacío; quién la ejecuta (anon/authenticated/service_role)' AS comprobacion,
         (SELECT (p.prosecdef AND p.proconfig = ARRAY['search_path=""'])::text || ' ; '
                 || has_function_privilege('anon', p.oid, 'EXECUTE')::text || '/'
                 || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || '/'
                 || has_function_privilege('service_role', p.oid, 'EXECUTE')::text
            FROM pg_proc p WHERE p.oid = to_regprocedure('public.avisos_transaccion_mas_antigua()')) AS valor,
         'true ; false/true/false' AS esperado
  UNION ALL
  SELECT 2, 'las tres funciones de M1 ya NO tienen el cuerpo de M1',
         (SELECT count(*)::text FROM pg_proc p
           WHERE (p.oid, md5(replace(p.prosrc, E'\r\n', E'\n'))) IN (
                   (to_regprocedure('public.aviso_visto_hasta_sellar()'), '839f7457daa2d7c618daaea254106d7e'),
                   (to_regprocedure('public.avisos_revisar_todos(timestamptz)'), '5e1f662fee337d583e590d377425aec4'),
                   (to_regprocedure('public.aviso_clinica_de_cambio_medico()'), '200f5f6fec02d59bea2e51686ebf3a43'))),
         '0'
  UNION ALL
  SELECT 3, 'avisos_revisar_todos: INVOKER; quién la ejecuta (anon/authenticated/service_role)',
         (SELECT (NOT p.prosecdef)::text || ' ; ' || has_function_privilege('anon', p.oid, 'EXECUTE')::text || '/'
                 || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || '/'
                 || has_function_privilege('service_role', p.oid, 'EXECUTE')::text
            FROM pg_proc p WHERE p.oid = to_regprocedure('public.avisos_revisar_todos(timestamptz)')),
         'true ; false/true/false'
  UNION ALL
  SELECT 4, 'aviso_clinica_de_cambio_medico: DEFINER, y su disparador en appointments sigue habilitado',
         (SELECT p.prosecdef::text FROM pg_proc p WHERE p.oid = to_regprocedure('public.aviso_clinica_de_cambio_medico()')) || '/'
         || (SELECT count(*)::text FROM pg_trigger WHERE tgrelid = to_regclass('public.appointments')
               AND tgname = 'trg_appointments_aviso_medico' AND tgenabled = 'O'),
         'true/1'
  UNION ALL
  SELECT 5, 'avisos con cita cuya copia no es el médico de su cita',
         (SELECT count(*)::text FROM public.avisos_clinica a JOIN public.appointments ap ON ap.id = a.cita_id AND ap.clinica_id = a.clinica_id
           WHERE a.medico_id IS DISTINCT FROM ap.medico_id),
         '0'
  UNION ALL
  SELECT 6, 'policies de avisos_clinica, avisos_vistos y avisos_vistos_hasta (no se tocan)',
         (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public'
             AND tablename IN ('avisos_clinica', 'avisos_vistos', 'avisos_vistos_hasta')),
         '8'
  UNION ALL
  SELECT 7, 'ANTES: avisos con cita / sin copia del médico / con copia vieja',
         (SELECT con_cita || ' / ' || sin_copia || ' / ' || copia_vieja FROM pg_temp._ma_antes LIMIT 1), NULL
  UNION ALL
  SELECT 8, 'transacción abierta más antigua vista ahora (INFO: NULL = ninguna)',
         coalesce(public.avisos_transaccion_mas_antigua()::text, 'NULL'), NULL
) t
ORDER BY t.n;
