-- ═══════════════════════════════════════════════════════════════════════
-- audit_log sin TRUNCATE — encargo de Angel en la integración de la tanda M
-- NO es de la agenda v2: va sola, separada del conjunto de la agenda.
-- Rama: feature/agenda-v2 (integración M) · Escrita: 2026-11-19
-- Riesgo estimado: BAJO (quita un privilegio que nadie usa y añade un
-- disparador de sentencia que reutiliza la función del de borrado. Ninguna
-- fila, columna, policy, función ni otro disparador cambia; nada se concede).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: ver «APLICACIÓN LOCAL» al pie de esta cabecera.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR. Se puede aplicar SOLA y ANTES
--   que cualquier migración de la agenda v2 (ver «Dependencias»).
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Encargo de Angel (2026-11-19), literal: «una migración propia, separada de
-- las de la agenda: quita TRUNCATE sobre public.audit_log a anon,
-- authenticated y service_role, y añade un disparador BEFORE TRUNCATE que lo
-- impida con el mismo mensaje del disparador de borrado. Solo quita permisos:
-- no concede ninguno, no toca policies ni el disparador existente».
-- El audit_log es inmutable por diseño (NOM-004, «todo acceso a expedientes
-- debe quedar registrado»): prevent_audit_delete y prevent_audit_update son
-- disparadores POR FILA, y TRUNCATE no dispara disparadores de fila ni pasa
-- por la RLS. Hoy anon, authenticated y service_role tienen TRUNCATE (los
-- privilegios por omisión de Supabase en public), así que la tabla podía
-- vaciarse entera sin que ningún disparador lo impidiera. PostgREST no
-- expone TRUNCATE, pero service_role y cualquier SQL con esos roles sí.
--
-- ═══ QUÉ CAMBIA ════════════════════════════════════════════════════════
-- 1. REVOKE TRUNCATE ON public.audit_log FROM anon, authenticated, service_role.
--    El resto de sus privilegios (SELECT, INSERT, UPDATE, DELETE, REFERENCES,
--    TRIGGER y, en PG 17, MAINTAIN) NO se toca: UPDATE y DELETE ya los paran los disparadores de
--    fila, y quitarlos no es el encargo.
-- 2. prevent_audit_truncate: BEFORE TRUNCATE ... FOR EACH STATEMENT EXECUTE
--    FUNCTION public.prevent_audit_modification(). Reutiliza la función del
--    de borrado y lanza su mismo mensaje («El audit_log es inmutable. No se
--    permite UPDATE ni DELETE.»). La función vale para un disparador de
--    sentencia: sólo hace RAISE EXCEPTION y RETURN NULL; no lee OLD ni NEW
--    (que en un disparador de sentencia valen NULL). El pre-vuelo exige el
--    md5 de su cuerpo con los fines de línea \r\n pasados a \n (en producción
--    está guardada con \r\n: md5 tal cual 7f0318cb…, normalizado f1fe023a…,
--    el mismo código que en local), así que si en producción fuera otra,
--    aborta antes.
--    Al reutilizarla no nace ninguna función: «Permisos de funciones» de
--    CLAUDE.md no aplica, y la función conserva sus privilegios. El disparador
--    no necesita EXECUTE de quien hace el TRUNCATE: PostgreSQL comprueba
--    EXECUTE sobre la función de un disparador al CREAR el disparador (lo
--    crea su dueño, postgres), no al dispararlo.
-- El disparador es para los roles que conservan TRUNCATE (el dueño postgres,
-- supabase_admin) y para cualquier GRANT futuro. Ojo, igual que los de fila:
-- es un disparador normal (tgenabled 'O'), así que con
-- session_replication_role = replica NO se dispara. No se cambia a ALWAYS:
-- el encargo pide uno igual al de borrado, y los de fila tampoco lo son.
--
-- Lo que NO hace: no concede nada; no toca policies (audit_super_admin_select
-- sigue igual), ni prevent_audit_delete, ni prevent_audit_update, ni la
-- función, ni ninguna otra tabla. Las otras tablas de public con TRUNCATE
-- concedido a esos roles están listadas en el reporte de la integración M
-- (mejora_agendaV2.md §6-bis, «Tanda M»), sin tocarlas.
--
-- ═══ DEPENDENCIAS ══════════════════════════════════════════════════════
-- Sólo objetos del baseline de producción (anteriores a la agenda v2):
--   · la tabla public.audit_log (supabase/baseline, remote_schema
--     20260912190416), dueño postgres;
--   · la función public.prevent_audit_modification() (baseline/05_functions.sql,
--     remote_schema:1843), RETURNS trigger, plpgsql;
--   · los disparadores prevent_audit_delete y prevent_audit_update, sólo para
--     el veredicto (comprueba que siguen igual; no los necesita).
-- Ninguna migración de la agenda (20261111120000 en adelante) la necesita ni
-- la toca: su timestamp va después del conjunto sólo para no chocar con los
-- rangos de las ramas; el orden no importa. Tampoco choca con
-- feature/limites-ajustables (20261014120000 revoca EXECUTE de PUBLIC en las
-- funciones de public; el disparador no depende de ese EXECUTE).
--
-- ═══ ANTES DE APLICAR: nada depende de vaciar audit_log ════════════════
-- 2026-11-19, grep de «truncate» (sin distinguir mayúsculas) en src, scripts,
-- e2e y supabase: ningún TRUNCATE de audit_log. En src sólo hay la clase CSS
-- «truncate» de Tailwind y la constante NOTAS_TRUNCATE; en supabase, REVOKE
-- de TRUNCATE en tablas de la agenda y comentarios; la guarda
-- src/lib/tests/pruebasSinBorrarAuditoria.test.ts prohíbe DELETE y TRUNCATE
-- de audit_log en e2e, scripts y pruebas SQL. La semilla
-- (scripts/agenda-semilla.ts) sólo inserta en audit_log.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO. PG ≥ 14
-- (CREATE OR REPLACE TRIGGER).
-- Bloqueos (lock_timeout 5 s): REVOKE no bloquea la tabla; CREATE TRIGGER
--   toma SHARE ROW EXCLUSIVE un instante sobre audit_log: bloquea las
--   escrituras (cada acción auditada espera ese instante), no las lecturas.
--   Si alguien la tiene ocupada más de 5 s, aborta entero sin cambiar nada.
-- Orden respecto al código: cualquiera es seguro. Ningún código hace TRUNCATE.
-- Alcance de los roles:
--   gana — nadie gana nada.
--   pierde — anon, authenticated y service_role pierden TRUNCATE sobre
--            audit_log (nadie lo usaba). postgres y supabase_admin lo
--            conservan, pero el disparador se lo impide salvo en replica.
-- Contrato con spinus-consola: no cambia ninguna columna, vista ni función.
--   La consola lee con su propia credencial; si alguna vez hiciera TRUNCATE
--   de audit_log, ahora fallaría (no debe hacerlo).
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   supabase/reversas/20261125170000_audit_log_sin_truncate_reversa.sql
--   (quita el disparador y devuelve TRUNCATE a los tres roles; reabre el
--   hueco: sólo si Angel lo pide, y después de la reversa de 20261126120000).
--
-- ═══ AUDITORÍA INDEPENDIENTE ═══════════════════════════════════════════
-- 2026-11-19, agente aparte (Sonnet), sólo lectura, con
-- supabase/AUDITORIA-MIGRACIONES.md: APTA, sin hallazgos graves. Aplicado:
-- (1) post-vuelo que aborta antes del COMMIT si un rol conserva TRUNCATE
-- (un REVOKE de otro otorgante pasaría sin efecto; propone una dimensión 19,
-- «otorgante del privilegio que se revoca», que queda para Angel: el
-- procedimiento no lo edita nadie más). Anotado sin cambiar: (2) el mensaje
-- dice «UPDATE ni DELETE» también ante un TRUNCATE, porque el encargo pide
-- el mismo mensaje; (3) el recuento de la prueba compara en READ COMMITTED,
-- un INSERT concurrente daría un falso rojo, nunca un falso verde.
-- Confirmó con el manual y el catálogo: la función vale para un disparador
-- de sentencia; EXECUTE se comprueba al crear el disparador; el privilegio
-- se comprueba antes que los BEFORE TRUNCATE (42501 antes que P0001);
-- tgtype 34; replica lo salta; sin FK que arrastre un TRUNCATE CASCADE.
--
-- ═══ APLICACIÓN LOCAL ══════════════════════════════════════════════════
-- 2026-11-19, base local (supabase_db_app_ortointegra), sobre la base de la
-- tanda L sin reiniciar (no se hace db reset: vaciaría el audit_log), bajo el
-- flock: ensayo con ROLLBACK, dos pasadas con veredicto OK, re-aplicada tras
-- la auditoría (con el post-vuelo nuevo) y registrada en
-- supabase_migrations.schema_migrations. audit_log: 65036 filas antes y
-- después. Prueba: supabase/pruebas-sql/m_audit_log_sin_truncate.sql, en rojo
-- antes de aplicarla y con sus tres mutaciones, en verde después.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_md5 text;
  v_crudo text;
  v_def text;
BEGIN
  IF to_regclass('public.audit_log') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: no existe public.audit_log.';
  END IF;
  IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = 'public.audit_log'::regclass), 'USAGE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el rol % no es dueño de public.audit_log.', current_user;
  END IF;
  -- La función es la del baseline: RETURNS trigger, plpgsql y el cuerpo (md5 de prosrc con \r\n → \n:
  -- en producción está guardada con \r\n). ⚠️ Cualquier otra diferencia, aunque sea un espacio, aborta:
  -- revisar antes de cambiar el md5.
  SELECT md5(replace(p.prosrc, E'\r\n', E'\n')), md5(p.prosrc) INTO v_md5, v_crudo FROM pg_proc p
   WHERE p.oid = to_regprocedure('public.prevent_audit_modification()')
     AND p.prorettype = 'pg_catalog.trigger'::regtype
     AND p.prolang = (SELECT oid FROM pg_language WHERE lanname = 'plpgsql');
  IF v_md5 IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta public.prevent_audit_modification() (RETURNS trigger, plpgsql).';
  END IF;
  IF v_md5 <> 'f1fe023a49dae586103b5e80b52841ea' THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.prevent_audit_modification() tiene otro cuerpo (md5 con \r\n→\n: %, tal cual: %; se esperaba f1fe023a49dae586103b5e80b52841ea con \r\n→\n). Si sólo difiere el tal cual, son fines de línea; si difiere el otro, cambió el código.', v_md5, v_crudo;
  END IF;
  -- Replay: si el disparador ya existe, tiene que ser exactamente el de esta migración.
  -- tgtype 34 = BEFORE (2) + TRUNCATE (32), sin el bit de fila (1): de sentencia. Se compara por
  -- catálogo y no por el texto de pg_get_triggerdef, que cambia con el search_path de la sesión.
  SELECT pg_get_triggerdef(t.oid) INTO v_def FROM pg_trigger t
   WHERE t.tgrelid = 'public.audit_log'::regclass AND t.tgname = 'prevent_audit_truncate' AND NOT t.tgisinternal
     AND NOT (t.tgtype = 34 AND t.tgfoid = 'public.prevent_audit_modification()'::regprocedure
              AND t.tgnargs = 0 AND t.tgqual IS NULL AND t.tgattr = ''::int2vector);
  IF FOUND THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: ya existe prevent_audit_truncate con otra definición: %', v_def;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · Quitar TRUNCATE a los tres roles. No se concede nada.
-- ---------------------------------------------------------------------
REVOKE TRUNCATE ON TABLE public.audit_log FROM anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3 · El disparador de sentencia, con la función del de borrado.
-- ---------------------------------------------------------------------
CREATE OR REPLACE TRIGGER prevent_audit_truncate
  BEFORE TRUNCATE ON public.audit_log
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.prevent_audit_modification();

-- ---------------------------------------------------------------------
-- 4 · Post-vuelo, ANTES del COMMIT: un REVOKE sólo quita lo que concedió
--     quien lo ejecuta; si otro otorgante hubiera concedido TRUNCATE, el
--     REVOKE pasaría sin efecto. Entonces se aborta y no queda nada.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.audit_log', 'TRUNCATE')
     OR has_table_privilege('authenticated', 'public.audit_log', 'TRUNCATE')
     OR has_table_privilege('service_role', 'public.audit_log', 'TRUNCATE') THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: algún rol conserva TRUNCATE sobre public.audit_log (otro otorgante): %',
      (SELECT relacl::text FROM pg_class WHERE oid = 'public.audit_log'::regclass);
  END IF;
END $$;

COMMIT;

-- ---------------------------------------------------------------------
-- 5 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO' WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'TRUNCATE: anon / authenticated / service_role' AS comprobacion,
         has_table_privilege('anon', 'public.audit_log', 'TRUNCATE')::text
           || ' / ' || has_table_privilege('authenticated', 'public.audit_log', 'TRUNCATE')::text
           || ' / ' || has_table_privilege('service_role', 'public.audit_log', 'TRUNCATE')::text AS valor,
         'false / false / false' AS esperado
  UNION ALL
  SELECT 2, 'disparador nuevo: tgtype (34 = BEFORE TRUNCATE de sentencia) / la función del de borrado / habilitado',
         coalesce((SELECT t.tgtype::text || ' / ' || (t.tgfoid = 'public.prevent_audit_modification()'::regprocedure)::text
                          || ' / ' || t.tgenabled::text FROM pg_trigger t
                    WHERE t.tgrelid = 'public.audit_log'::regclass AND t.tgname = 'prevent_audit_truncate' AND NOT t.tgisinternal), 'AUSENTE'),
         '34 / true / O'
  UNION ALL
  SELECT 3, 'disparadores de fila de antes, intactos',
         coalesce((SELECT string_agg(t.tgname || ':' || t.tgenabled::text, ',' ORDER BY t.tgname) FROM pg_trigger t
                    WHERE t.tgrelid = 'public.audit_log'::regclass AND NOT t.tgisinternal AND t.tgname <> 'prevent_audit_truncate'), 'NINGUNO'),
         'prevent_audit_delete:O,prevent_audit_update:O'
  UNION ALL
  SELECT 4, 'la función, la misma (md5 de prosrc con \r\n→\n)',
         coalesce((SELECT md5(replace(prosrc, E'\r\n', E'\n')) FROM pg_proc WHERE oid = to_regprocedure('public.prevent_audit_modification()')), 'AUSENTE'),
         'f1fe023a49dae586103b5e80b52841ea'
  UNION ALL
  SELECT 5, 'policies de audit_log, intactas',
         coalesce((SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'audit_log'), 'NINGUNA'),
         'audit_super_admin_select'
  UNION ALL
  SELECT 6, 'los demás privilegios de los tres roles (SELECT, INSERT, UPDATE, DELETE)',
         (SELECT string_agg(r || ':' || has_table_privilege(r, 'public.audit_log', 'SELECT')::text
                   || has_table_privilege(r, 'public.audit_log', 'INSERT')::text
                   || has_table_privilege(r, 'public.audit_log', 'UPDATE')::text
                   || has_table_privilege(r, 'public.audit_log', 'DELETE')::text, ' ' ORDER BY r)
            FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) r),
         NULL
  UNION ALL
  SELECT 7, 'filas de audit_log (no cambian)', (SELECT count(*)::text FROM public.audit_log), NULL
) t
ORDER BY t.n;
