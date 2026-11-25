-- ═══════════════════════════════════════════════════════════════════════
-- Agenda para todos · M3 — la agenda v2 ENCENDIDA POR OMISIÓN
-- Rama: feature/agenda-para-todos · Escrita: 2026-11-25
-- Guion y repaso del autor: docs/spec/agenda-para-todos/
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: 2026-11-25, stack local de Supabase (CLI 2.117.0) con las 16
--   migraciones anteriores: aplicada, deshecha con su reversa y vuelta a
--   aplicar; prueba ap1_agenda_para_todos.sql en verde.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR. PENDIENTE DE ENSAYO SOBRE EL CLON
--   DE ESTRUCTURA Y DE AUDITORÍA INDEPENDIENTE (supabase/AUDITORIA-MIGRACIONES.md).
--
-- DECISIÓN DE ANGEL (2026-11-25): la agenda v2 deja de encenderse clínica por
--   clínica. Queda encendida para TODAS, las de hoy y las que se registren
--   después, sin pasos manuales. El interruptor sigue existiendo como dato:
--   una fila que diga EXPLÍCITAMENTE false sigue siendo «apagada».
--
-- QUÉ HACE (cuatro cosas, y ninguna más):
--   1. agenda_ajustes.agenda_v2_encendida: DEFAULT false → DEFAULT true.
--   2. public.agenda_v2_encendida(uuid): «sin fila» pasa de false a true
--      (coalesce(<fila>, true)). Mismo dueño, mismos privilegios, INVOKER.
--   3. TODA CLÍNICA TIENE SU FILA. Ocho funciones de la agenda no llaman a la
--      función común: leen la fila en línea, porque de ella sacan también los
--      plazos y el candado (F1 agenda_restablecer_configuracion; F3
--      reserva_contexto y reservar_por_enlace; F2 gcal_sync_clinicas_pendientes;
--      F4, cuatro). Para ellas «sin fila» seguiría siendo «apagada», y la
--      clínica quedaría a medias. En vez de reescribir las ocho:
--        a) RELLENO: una fila de fábrica por cada clínica que no la tenga;
--        b) las filas que hoy dicen false pasan a true (en producción nadie la
--           apagó a propósito: false era el valor de fábrica; lo confirma el
--           conteo previo de sólo lectura, conteos-agenda-para-todos.sql);
--        c) un disparador AFTER INSERT en public.clinicas crea la fila de
--           fábrica de cada clínica NUEVA.
--   4. COMMENT ON de la tabla, la columna y la función, que decían lo contrario.
--   NO toca: ninguna policy; proteger_agenda_ajustes() (el interruptor lo
--   siguen cambiando sólo postgres y supabase_admin); recordatorio_encendido ni
--   correo_reserva_clinica (siguen APAGADOS de fábrica); ninguna cita.
--
-- ⚠️ agenda_ajustes_de_clinica_nueva() ES SECURITY DEFINER A PROPÓSITO. F1
--   avisa de que una DEFINER de postgres que escriba agenda_ajustes se salta
--   proteger_agenda_ajustes(): aquí es lo que se quiere, y sólo para esto.
--   Inserta (clinica_id) y nada más: todo lo demás son los DEFAULT de la tabla.
--   No es una RPC (devuelve trigger). Si el alta de la fila fallara, avisa con
--   WARNING y la clínica se crea igual: la agenda nunca impide registrar una
--   clínica. Esa clínica quedaría SIN fila (encendida para la función común,
--   apagada para las ocho de arriba): la rejilla de esta migración y el conteo
--   «clínicas sin fila» lo enseñan, y se arregla con un INSERT como postgres.
-- ⚠️ CONSECUENCIA PARA QUIEN BORRE UNA CLÍNICA: agenda_ajustes apunta a
--   clinicas con ON DELETE RESTRICT (F1; no se cambia a CASCADE). Como ahora
--   toda clínica tiene fila, un DELETE de clinicas da 23503 hasta borrar antes
--   su fila de agenda_ajustes. En este repo lo hacen la semilla (ya la borraba)
--   y la marcha atrás de POST /api/me/clinica (ajustada en esta rama).
-- ⚠️ CONSECUENCIA PARA proteger_agenda_ajustes(), que NO se toca: su rama de
--   INSERT rechaza a quien no sea postgres/supabase_admin si la fila nace con
--   el interruptor en true. Con el DEFAULT nuevo, un INSERT de la sesión o de
--   service_role que no diga el interruptor da 42501 (antes entraba, con false).
--   Ningún código de la app inserta en agenda_ajustes; y con (3) la fila ya existe.
--
-- Depende de: F1 (20261201120000). No usa nada de M1 ni de M2.
-- Bloqueos: SHARE ROW EXCLUSIVE sobre public.clinicas (no bloquea lecturas;
--   sí altas y cambios de clínica) y ACCESS EXCLUSIVE sobre public.agenda_ajustes
--   (bloquea también leer el interruptor: toda escritura de citas lo lee),
--   los dos tomados en el ÚLTIMO bloque DO: de ahí al COMMIT hay dos
--   sentencias (el post-vuelo y el COMMIT). Con aplicar.sh el archivo entero
--   viaja en una petición.
-- VENTANA DE DESPLIEGUE — EL ORDEN SEGURO ES CÓDIGO PRIMERO, M3 DESPUÉS.
--   · Código viejo de main (sin agenda v2) + M3: al encenderse en todas, los
--     disparadores de F5b actúan en todas. main borra las citas con DELETE
--     (src/app/api/appointments/[id]/route.ts): trg_appointments_proteger_borrado
--     daría 42501 al borrar una cita con paciente, y cita_proteger_atendida al
--     mover una atendida con nota. NO APLICAR M3 CON EL CÓDIGO DE main SIN LA v2.
--   · Código nuevo + base sin M3: nada cambia. El código pregunta a esta misma
--     función (rpc agenda_v2_encendida) y la base sigue contestando false para
--     quien no tiene fila: cada clínica sigue como estaba hasta el COMMIT de M3.
-- Riesgo: MEDIO. La migración es pequeña; lo que pesa es su EFECTO: enciende
--   la agenda nueva, con sus protecciones de base, en todas las clínicas.
-- No re-ejecutable: una segunda pasada ABORTA en el pre-vuelo sin cambiar nada.
-- Vuelta atrás: supabase/reversas/20261203120000_agenda_para_todos_reversa.sql
--   (devuelve el DEFAULT y la función y quita el disparador; NO toca filas:
--   para APAGAR hay que escribir false en las filas, como postgres).
-- Prueba: supabase/pruebas-sql/ap1_agenda_para_todos.sql
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Los números de ANTES, para la rejilla final (que va tras el COMMIT).
DROP TABLE IF EXISTS pg_temp._m3_antes;
CREATE TEMP TABLE _m3_antes (clinicas bigint NOT NULL, filas bigint NOT NULL, encendidas bigint NOT NULL, sin_fila bigint NOT NULL);

DO $$
DECLARE
  v_t text;
BEGIN
  IF to_regprocedure('public.agenda_ajustes_de_clinica_nueva()') IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.agenda_ajustes_de_clinica_nueva() ya existe: esta migración ya está aplicada. No se repite.';
  END IF;
  -- El relleno escribe el interruptor: proteger_agenda_ajustes() sólo deja a estos dos.
  IF current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: hay que aplicarla como postgres (current_user es %): proteger_agenda_ajustes() rechazaría el relleno.', current_user;
  END IF;
  IF to_regclass('public.agenda_ajustes') IS NULL OR to_regclass('public.clinicas') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta public.agenda_ajustes (F1, 20261201120000) o public.clinicas.';
  END IF;
  FOREACH v_t IN ARRAY ARRAY['agenda_ajustes', 'clinicas'] LOOP
    IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = to_regclass('public.' || v_t)), 'USAGE') THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: % no es dueño de public.%.', current_user, v_t;
    END IF;
  END LOOP;
  -- La columna, tal como la deja F1: boolean, NOT NULL, DEFAULT false.
  IF NOT EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
                  WHERE a.attrelid = 'public.agenda_ajustes'::regclass AND a.attname = 'agenda_v2_encendida'
                    AND a.atttypid = 'boolean'::regtype AND a.attnotnull AND NOT a.attisdropped
                    AND pg_get_expr(d.adbin, d.adrelid) = 'false') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: agenda_ajustes.agenda_v2_encendida no es boolean NOT NULL DEFAULT false (la de F1). No se toca nada.';
  END IF;
  -- La función común, con el cuerpo de F1 (sólo se normalizan los fines de línea: dimensión 28).
  IF NOT EXISTS (SELECT 1 FROM pg_proc p
                  WHERE p.oid = to_regprocedure('public.agenda_v2_encendida(uuid)')
                    AND NOT p.prosecdef AND p.provolatile = 's' AND p.prorettype = 'boolean'::regtype
                    AND p.proconfig = ARRAY['search_path=""']
                    AND md5(replace(p.prosrc, E'\r\n', E'\n')) = '18288c1dd2adc17c6ef0b88ee701942b') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.agenda_v2_encendida(uuid) no es la de F1 (INVOKER, STABLE, search_path vacío y su cuerpo): alguien la cambió. No se reescribe a ciegas.';
  END IF;
  -- Los dos disparadores de la tabla por los que pasa el relleno.
  IF (SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.agenda_ajustes'::regclass AND NOT tgisinternal AND tgenabled = 'O'
         AND tgname IN ('trg_agenda_ajustes_proteger', 'audit_agenda_ajustes')) <> 2 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta trg_agenda_ajustes_proteger o audit_agenda_ajustes, o no están habilitados.';
  END IF;
  -- Lo único que el relleno escribe es clinica_id: todo lo demás tiene que tener DEFAULT o admitir NULL.
  IF EXISTS (SELECT 1 FROM pg_attribute a
              WHERE a.attrelid = 'public.agenda_ajustes'::regclass AND a.attnum > 0 AND NOT a.attisdropped
                AND a.attnotnull AND NOT a.atthasdef AND a.attname <> 'clinica_id') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: agenda_ajustes tiene una columna NOT NULL sin DEFAULT distinta de clinica_id: el relleno no sabría qué poner.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.agenda_ajustes'::regclass
                    AND conname = 'agenda_ajustes_clinica_key' AND contype = 'u') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta la restricción única agenda_ajustes_clinica_key (clinica_id).';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.clinicas'::regclass AND tgname = 'trg_clinicas_agenda_ajustes') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.clinicas ya tiene un disparador trg_clinicas_agenda_ajustes.';
  END IF;
  INSERT INTO pg_temp._m3_antes
  SELECT (SELECT count(*) FROM public.clinicas),
         (SELECT count(*) FROM public.agenda_ajustes),
         (SELECT count(*) FROM public.agenda_ajustes WHERE agenda_v2_encendida),
         (SELECT count(*) FROM public.clinicas c
           WHERE NOT EXISTS (SELECT 1 FROM public.agenda_ajustes a WHERE a.clinica_id = c.id));
END $$;

-- ---------------------------------------------------------------------
-- 1 · La lectura común: sin fila = ENCENDIDA. Lo demás, como en F1 (INVOKER a
--     propósito; ver su COMMENT). CREATE OR REPLACE conserva dueño y privilegios.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agenda_v2_encendida(p_clinica_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
  SELECT coalesce((SELECT a.agenda_v2_encendida FROM public.agenda_ajustes a
                    WHERE a.clinica_id = p_clinica_id), true)
$fn$;

-- ---------------------------------------------------------------------
-- 2 · La fila de fábrica de cada clínica nueva. DEFINER a propósito (cabecera).
-- ---------------------------------------------------------------------
CREATE FUNCTION public.agenda_ajustes_de_clinica_nueva()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  BEGIN
    INSERT INTO public.agenda_ajustes (clinica_id) VALUES (NEW.id)
    ON CONFLICT (clinica_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'agenda_ajustes_de_clinica_nueva: fila de ajustes no creada para la clínica % (SQLSTATE %)', NEW.id, SQLSTATE;
  END;
  RETURN NULL;
END
$fn$;

-- Función de disparador: EXECUTE a los tres roles (regla del proyecto); no se
-- puede llamar como RPC.
REVOKE EXECUTE ON FUNCTION public.agenda_ajustes_de_clinica_nueva() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.agenda_ajustes_de_clinica_nueva() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.agenda_ajustes_de_clinica_nueva() IS
  'Agenda para todos (M3): crea la fila de fábrica de agenda_ajustes de cada clínica nueva (sólo clinica_id; lo demás, los DEFAULT). SECURITY DEFINER a propósito: como postgres pasa proteger_agenda_ajustes() con el interruptor en true. Si falla, avisa con WARNING y NO impide crear la clínica. No la uses para nada más ni le añadas columnas.';
COMMENT ON TABLE public.agenda_ajustes IS
  'Ajustes de agenda por clínica (mejora_agendaV2 §2). Desde M3 (20261203120000) TODA clínica tiene su fila: la crea trg_clinicas_agenda_ajustes al nacer la clínica. Ocho funciones de la agenda leen la fila directamente: una clínica SIN fila queda a medias (encendida para agenda_v2_encendida(), apagada para ellas). Para borrar una clínica hay que borrar antes su fila (FK RESTRICT). Los límites viven aquí en CHECK y en LIMITES_AJUSTES_AGENDA (src/lib/agenda/ajustesAgenda.ts): cambiar los dos.';
COMMENT ON COLUMN public.agenda_ajustes.agenda_v2_encendida IS
  'Interruptor de la agenda v2 de ESTA clínica. ENCENDIDO de fábrica desde M3 (20261203120000): sólo una fila que diga false la apaga. Sólo lo cambia postgres (trg_agenda_ajustes_proteger). En la app, un ERROR al leerlo se trata como apagado (falla cerrado); «sin fila» no es un error.';
COMMENT ON FUNCTION public.agenda_v2_encendida(uuid) IS
  'La única lectura común del interruptor de la agenda v2 de una clínica. Desde M3 (20261203120000): sin fila = true (encendida de fábrica); sólo una fila con false la apaga. La app la llama por RPC y trata cualquier error como apagado. INVOKER a propósito: con la sesión lee con la RLS de agenda_ajustes (sólo la clínica propia; de otra clínica no ve la fila y contesta true, igual que para un uuid que no existe); dentro de una SECURITY DEFINER, como su dueño. No la hagas DEFINER. Sin EXECUTE para anon.';

-- ---------------------------------------------------------------------
-- 3 · Lo que toma candados, junto y al final (dimensión 29). El candado sobre
--     clinicas va PRIMERO: desde ahí nadie crea una clínica hasta el COMMIT,
--     así que ninguna se queda entre el relleno y el disparador.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  LOCK TABLE public.clinicas IN SHARE ROW EXCLUSIVE MODE;
  ALTER TABLE public.agenda_ajustes ALTER COLUMN agenda_v2_encendida SET DEFAULT true;
  -- Relleno: la fila de fábrica de cada clínica que no la tenga.
  INSERT INTO public.agenda_ajustes (clinica_id)
  SELECT c.id FROM public.clinicas c
   WHERE NOT EXISTS (SELECT 1 FROM public.agenda_ajustes a WHERE a.clinica_id = c.id)
   ORDER BY c.id;
  -- Las que decían false (el valor de fábrica de antes) pasan a true.
  UPDATE public.agenda_ajustes SET agenda_v2_encendida = true WHERE NOT agenda_v2_encendida;
  CREATE TRIGGER trg_clinicas_agenda_ajustes
    AFTER INSERT ON public.clinicas
    FOR EACH ROW EXECUTE FUNCTION public.agenda_ajustes_de_clinica_nueva();
END $$;

-- ---------------------------------------------------------------------
-- 4 · Post-vuelo: aborta ANTES del COMMIT si algo no quedó.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF public.agenda_v2_encendida('00000000-0000-0000-0000-000000000000'::uuid) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: agenda_v2_encendida no devuelve true sin fila.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = 'public.agenda_v2_encendida(uuid)'::regprocedure
                    AND NOT p.prosecdef AND p.provolatile = 's' AND p.proconfig = ARRAY['search_path=""'])
     OR has_function_privilege('anon', 'public.agenda_v2_encendida(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.agenda_v2_encendida(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.agenda_v2_encendida(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: agenda_v2_encendida no quedó INVOKER, STABLE, con search_path vacío y para authenticated + service_role (sin anon).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = 'public.agenda_ajustes_de_clinica_nueva()'::regprocedure
                    AND p.prosecdef AND p.proconfig = ARRAY['search_path=""']
                    AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee = 0)) THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: agenda_ajustes_de_clinica_nueva() no quedó DEFINER, con search_path vacío y sin EXECUTE para PUBLIC.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.clinicas'::regclass AND tgname = 'trg_clinicas_agenda_ajustes'
                    AND tgenabled = 'O' AND tgfoid = 'public.agenda_ajustes_de_clinica_nueva()'::regprocedure) THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: trg_clinicas_agenda_ajustes no quedó habilitado en public.clinicas.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.clinicas c WHERE NOT EXISTS (SELECT 1 FROM public.agenda_ajustes a WHERE a.clinica_id = c.id)) THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: quedan clínicas sin fila en agenda_ajustes.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.agenda_ajustes WHERE NOT agenda_v2_encendida) THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: quedan filas de agenda_ajustes con la v2 apagada.';
  END IF;
  -- Lo que M3 NO enciende: una fila que nace aquí lo hace con los dos correos apagados.
  IF EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
              WHERE a.attrelid = 'public.agenda_ajustes'::regclass AND NOT a.attisdropped
                AND a.attname IN ('recordatorio_encendido', 'correo_reserva_clinica')
                AND pg_get_expr(d.adbin, d.adrelid) <> 'false') THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: recordatorio_encendido o correo_reserva_clinica ya no nacen en false.';
  END IF;
END $$;

COMMIT;

SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO' WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'agenda_ajustes.agenda_v2_encendida: DEFAULT' AS comprobacion,
         (SELECT pg_get_expr(d.adbin, d.adrelid) FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
           WHERE a.attrelid = to_regclass('public.agenda_ajustes') AND a.attname = 'agenda_v2_encendida') AS valor,
         'true' AS esperado
  UNION ALL
  SELECT 2, 'agenda_v2_encendida: INVOKER / STABLE / EXECUTE anon,authenticated,service_role / sin fila',
         (SELECT (NOT p.prosecdef)::text || '/' || (p.provolatile = 's')::text || '/'
                 || has_function_privilege('anon', p.oid, 'EXECUTE')::text || ','
                 || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || ','
                 || has_function_privilege('service_role', p.oid, 'EXECUTE')::text || '/'
                 || public.agenda_v2_encendida('00000000-0000-0000-0000-000000000000'::uuid)::text
            FROM pg_proc p WHERE p.oid = to_regprocedure('public.agenda_v2_encendida(uuid)')),
         'true/true/false,true,true/true'
  UNION ALL
  SELECT 3, 'agenda_ajustes_de_clinica_nueva: DEFINER con search_path vacío, sin PUBLIC',
         (SELECT (p.prosecdef AND p.proconfig = ARRAY['search_path=""']
                  AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee = 0))::text
            FROM pg_proc p WHERE p.oid = to_regprocedure('public.agenda_ajustes_de_clinica_nueva()')),
         'true'
  UNION ALL
  SELECT 4, 'trg_clinicas_agenda_ajustes en clinicas, habilitado',
         (SELECT count(*)::text FROM pg_trigger WHERE tgrelid = to_regclass('public.clinicas')
             AND tgname = 'trg_clinicas_agenda_ajustes' AND tgenabled = 'O'),
         '1'
  UNION ALL
  SELECT 5, 'clínicas sin fila en agenda_ajustes',
         (SELECT count(*)::text FROM public.clinicas c
           WHERE NOT EXISTS (SELECT 1 FROM public.agenda_ajustes a WHERE a.clinica_id = c.id)),
         '0'
  UNION ALL
  SELECT 6, 'filas de agenda_ajustes con la v2 apagada', (SELECT count(*)::text FROM public.agenda_ajustes WHERE NOT agenda_v2_encendida), '0'
  UNION ALL
  SELECT 7, 'proteger_agenda_ajustes y auditoría de agenda_ajustes, habilitados (no se tocan)',
         (SELECT count(*)::text FROM pg_trigger WHERE tgrelid = to_regclass('public.agenda_ajustes') AND NOT tgisinternal
             AND tgenabled = 'O' AND tgname IN ('trg_agenda_ajustes_proteger', 'audit_agenda_ajustes')),
         '2'
  UNION ALL
  SELECT 8, 'recordatorio_encendido / correo_reserva_clinica: DEFAULT (siguen apagados de fábrica)',
         (SELECT string_agg(pg_get_expr(d.adbin, d.adrelid), '/' ORDER BY a.attname DESC)
            FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
           WHERE a.attrelid = to_regclass('public.agenda_ajustes')
             AND a.attname IN ('recordatorio_encendido', 'correo_reserva_clinica')),
         'false/false'
  UNION ALL
  SELECT 9, 'ANTES: clínicas / filas / encendidas / clínicas sin fila',
         (SELECT clinicas || ' / ' || filas || ' / ' || encendidas || ' / ' || sin_fila FROM pg_temp._m3_antes LIMIT 1), NULL
  UNION ALL
  SELECT 10, 'DESPUÉS: clínicas / filas / encendidas',
         (SELECT count(*)::text FROM public.clinicas) || ' / ' || (SELECT count(*)::text FROM public.agenda_ajustes) || ' / '
         || (SELECT count(*)::text FROM public.agenda_ajustes WHERE agenda_v2_encendida), NULL
  UNION ALL
  SELECT 11, 'filas con recordatorio o correo a la clínica encendidos (las que ya lo estaban; M3 no enciende ninguno)',
         (SELECT count(*) FILTER (WHERE recordatorio_encendido)::text || ' / ' || count(*) FILTER (WHERE correo_reserva_clinica)::text
            FROM public.agenda_ajustes), NULL
) t
ORDER BY t.n;
