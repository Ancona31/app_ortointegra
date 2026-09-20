-- ═══════════════════════════════════════════════════════════════════════
-- Auth 02 — reasentar los privilegios de los RPC de rate limit
-- Rama: fix/db-reset-permisos-rate-limit · Escrita: 2026-09-19
-- Riesgo estimado: BAJO. En producción es un no-op: el estado que esta
-- migración impone es EXACTAMENTE el que ya hay allí.
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: PENDIENTE
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR.
--
-- ⚠️ PENDIENTE DE AUDITORÍA por `supabase/AUDITORIA-MIGRACIONES.md`.
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
--
-- `public.rate_limit_intento` y `public.rate_limit_reset` son dos
-- `SECURITY DEFINER` propiedad de `postgres`, publicadas en PostgREST, que
-- escriben y borran filas de `public.ip_rate_limits` saltándose su RLS
-- deny-all. Sólo `service_role` debe poder ejecutarlas. Quien pueda
-- llamarlas sin sesión puede llenar el cubo de login de un médico concreto
-- y dejarlo sin poder entrar, o vaciar cualquier cubo `auth:login_v2:*` y
-- desactivar el limitador de fuerza bruta.
--
-- Quien revoca ese permiso hoy es UN SOLO archivo del repositorio,
-- `20260805_auth_01_rate_limit_atomico.sql:164-170`. Y el volcado base
-- `20260912190416_remote_schema.sql` NO lo sustituye, aunque a primera
-- vista lo parezca: trae las dos funciones, los dos índices, el
-- `SECURITY DEFINER`, el `owner=postgres` y el `GRANT` a `service_role`.
-- Todo menos lo que importa.
--
-- ═══ POR QUÉ EL VOLCADO NO BASTA, QUE ES EL NUDO ═══════════════════════
--
-- El volcado dice, en sus líneas 3449-3455:
--
--     REVOKE ALL ON FUNCTION "public"."rate_limit_intento"(...) FROM PUBLIC;
--     GRANT EXECUTE ON FUNCTION "public"."rate_limit_intento"(...) TO "postgres", "service_role";
--
-- y eso describe FIELMENTE el ACL de producción, donde no hay `anon`. Pero
-- describir no es reproducir. Al REPLAYARLO sobre una base nueva:
--
--   1. El `CREATE FUNCTION` dispara `ALTER DEFAULT PRIVILEGES`, que en
--      Supabase concede EXECUTE a `anon`, `authenticated` y `service_role`
--      sobre toda función nueva del esquema `public`. Está en el catálogo:
--      `pg_default_acl` para (postgres, public, 'f') vale
--      `{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,
--        service_role=X/postgres}`.
--   2. El `REVOKE ALL ... FROM PUBLIC` que viene después NO quita eso,
--      porque los grants de `anon` y `authenticated` son DIRECTOS, no
--      heredados de PUBLIC. Revocar de PUBLIC no toca un grant directo.
--
-- Resultado comprobado en local el 2026-09-19, reconstruyendo la base sólo
-- desde el repositorio sin `20260805`:
--
--     proname            | proacl
--     -------------------+-----------------------------------------------
--     rate_limit_intento | {postgres=X/postgres,anon=X/postgres,
--                          authenticated=X/postgres,service_role=X/postgres}
--
-- y con la anon key, sin sesión ninguna, los cuatro intentos del limitador
-- respondieron y `rate_limit_reset` devolvió `3`: el cubo de una víctima
-- vaciado por un anónimo.
--
-- ⚠️ POR ESO ESTO NO SE PUEDE DAR POR HEREDADO. Es la clase de propiedad
-- que no vive en la definición del objeto sino en su ACL, y el ACL es justo
-- lo que un volcado replayado NO reconstruye. Mientras el único sitio donde
-- se asiente sea un archivo de agosto, cualquier reconstrucción que lo
-- pierda —o lo salte— nace con el limitador abierto y sin que nada avise.
--
-- ═══ QUÉ HACE, Y QUÉ NO ════════════════════════════════════════════════
--
-- Reasienta los mismos `REVOKE`/`GRANT` de `20260805:164-170`, ni uno más.
-- NO recrea las funciones, NO toca sus cuerpos, NO toca índices y NO toca
-- `ip_rate_limits`. El alcance de los roles cambia en UNA sola dirección y
-- sólo donde estaba mal: `anon` y `authenticated` PIERDEN un EXECUTE que
-- nunca debieron tener. `service_role` y `postgres` no pierden nada — el
-- `GRANT` a `service_role` se re-concede explícitamente en la misma
-- transacción, justo para que revocar no pueda dejar al limitador sin
-- poder ejecutar nada (que sería fail-open permanente y silencioso, D6).
--
-- IDEMPOTENTE: `REVOKE` de un privilegio que no está y `GRANT` de uno que
-- ya está son no-ops en Postgres. Correrla dos veces no cambia nada.
--
-- NO-OP EN PRODUCCIÓN: allí el ACL ya es
-- `{postgres=X/postgres,service_role=X/postgres}` —verificado por Angel con
-- un SELECT de sólo lectura el 2026-09-19—, así que esta migración lo deja
-- idéntico. Su valor allí es documental: deja el invariante escrito en un
-- archivo que ordena al final, para que deje de depender del de agosto.
--
-- TOLERANTE A QUE LAS FUNCIONES NO EXISTAN, y no por si acaso. Comprobado:
-- `supabase/baseline/` crea la tabla `ip_rate_limits` y sus índices
-- (02_tables.sql, 03_indexes.sql) pero NO crea estas dos funciones —no
-- aparecen en 05_functions.sql—. Una base levantada desde `baseline/`, que
-- es el escenario de replay que exige la dimensión 3 de la auditoría,
-- llegaría aquí sin ellas y un `REVOKE ... ON FUNCTION` sin guarda abortaría
-- con 42883. Con las migraciones de `supabase/migrations/` el caso no se da
-- —el volcado las crea antes—, pero las dos rutas tienen que funcionar.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Sin bloqueos relevantes: `REVOKE`/`GRANT` sobre una función toman
-- ACCESS EXCLUSIVE sobre su fila de `pg_proc`, no sobre ninguna tabla de
-- datos. No hay ventana de despliegue que gestionar: ningún código de la
-- aplicación llama a estas funciones con `anon` ni con `authenticated`
-- —sólo `src/lib/auth/` a través de `service_role`—, así que ni el código
-- viejo ni el nuevo notan nada.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ---------------------------------------------------------------------
-- 1 · Reasentar privilegios, función por función y con guarda.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  r           record;
  v_presentes int := 0;
BEGIN
  FOR r IN
    SELECT *
      FROM (VALUES
        ('public.rate_limit_intento(text,text,int,int)'),
        ('public.rate_limit_reset(text)')
      ) f(firma)
  LOOP
    -- La guarda: si la función no existe (base desde `baseline/`), se
    -- salta en silencio en vez de abortar. El veredicto del final lo
    -- enseña igualmente, así que saltarse no es esconder.
    IF to_regprocedure(r.firma) IS NULL THEN
      RAISE NOTICE 'Auth 02: % no existe todavía — se salta.', r.firma;
      CONTINUE;
    END IF;

    v_presentes := v_presentes + 1;

    -- Los dos, y en este orden. Revocar de PUBLIC no basta (ver cabecera);
    -- revocar sin re-conceder a service_role dejaría el limitador en
    -- fail-open permanente y silencioso.
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.firma);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.firma);
  END LOOP;

  RAISE NOTICE 'Auth 02: % de 2 funciones reasentadas.', v_presentes;
END $$;

-- ---------------------------------------------------------------------
-- 2 · Post-vuelo: aborta si el reasiento no quedó.
-- ---------------------------------------------------------------------
-- Va DENTRO de la transacción a propósito: si algo salió mal, lo que se
-- quiere es que no se confirme nada, no un aviso a toro pasado.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT f.firma, to_regprocedure(f.firma) AS oid
      FROM (VALUES
        ('public.rate_limit_intento(text,text,int,int)'),
        ('public.rate_limit_reset(text)')
      ) f(firma)
     WHERE to_regprocedure(f.firma) IS NOT NULL
  LOOP
    IF has_function_privilege('anon', r.oid, 'EXECUTE')
       OR has_function_privilege('authenticated', r.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'POST-VUELO FALLÓ: % conserva EXECUTE para anon o authenticated.', r.firma;
    END IF;
    IF NOT has_function_privilege('service_role', r.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'POST-VUELO FALLÓ: % se quedó SIN EXECUTE para service_role — el limitador quedaría en fail-open permanente y silencioso (D6).', r.firma;
    END IF;
  END LOOP;
END $$;

-- Que PostgREST reconstruya su caché de esquema: los privilegios que acaba
-- de perder `anon` los tiene cacheados.
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ---------------------------------------------------------------------
-- 3 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
-- El LEFT JOIN sobre la lista de firmas es deliberado: así devuelve SIEMPRE
-- dos renglones. Con un `FROM pg_proc` a secas, una base sin las funciones
-- daría cero filas, y el SQL Editor —que enseña el último conjunto CON
-- filas— mostraría el resultado de otra sentencia como si fuera éste.
SELECT
  f.nombre                                            AS proname,
  coalesce(pg_get_userbyid(p.proowner), '(ausente)')  AS owner,
  p.prosecdef                                         AS security_definer,
  p.proacl                                            AS proacl,
  CASE
    WHEN p.oid IS NULL THEN 'AUSENTE — revisar si se esperaba'
    WHEN has_function_privilege('anon',          p.oid, 'EXECUTE')
      OR has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN 'REVISAR — anon/authenticated conservan EXECUTE'
    WHEN NOT has_function_privilege('service_role', p.oid, 'EXECUTE') THEN 'REVISAR — service_role sin EXECUTE'
    WHEN p.prosecdef IS NOT TRUE THEN 'REVISAR — dejó de ser SECURITY DEFINER'
    WHEN pg_get_userbyid(p.proowner) <> 'postgres' THEN 'REVISAR — owner inesperado'
    ELSE 'OK'
  END                                                 AS estado
FROM (VALUES
  ('rate_limit_intento', 'public.rate_limit_intento(text,text,int,int)'),
  ('rate_limit_reset',   'public.rate_limit_reset(text)')
) f(nombre, firma)
LEFT JOIN pg_proc p ON p.oid = to_regprocedure(f.firma)
ORDER BY f.nombre;

-- ═══════════════════════════════════════════════════════════════════════
-- REVERSIÓN — y por qué casi nunca es lo que quieres
-- ═══════════════════════════════════════════════════════════════════════
--
--   GRANT EXECUTE ON FUNCTION public.rate_limit_intento(text,text,int,int) TO anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.rate_limit_reset(text)                TO anon, authenticated;
--
-- ⚠️ ESO REABRE EL LIMITADOR A CUALQUIERA CON LA ANON KEY, que es pública.
-- Se deja escrito porque una reversión a ciegas es peor que una informada,
-- no porque haya un escenario en el que convenga. Si esta migración diera
-- problemas, el problema no es el revoke: es que algo llamaba a estas
-- funciones sin ser `service_role`, y eso hay que mirarlo, no restaurarlo.
-- ═══════════════════════════════════════════════════════════════════════
