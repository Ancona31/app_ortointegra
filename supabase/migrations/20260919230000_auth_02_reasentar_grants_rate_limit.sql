-- ═══════════════════════════════════════════════════════════════════════
-- Auth 02 — reasentar los privilegios de los RPC de rate limit
-- Rama: fix/db-reset-permisos-rate-limit · Escrita: 2026-09-19
-- Riesgo estimado: BAJO. En producción es un no-op: el estado que esta
-- migración impone es EXACTAMENTE el que ya hay allí.
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-09-19
--   `npx supabase db reset --local` desde cero, exit 0, y el `proacl` de
--   las dos funciones quedó en `{postgres=X/postgres,service_role=X/postgres}`.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR.
--
-- ✅ AUDITADA — 2026-09-19, por `supabase/AUDITORIA-MIGRACIONES.md`.
-- Veredicto: NO APTA. Este archivo es la respuesta a esa auditoría; sus
-- correcciones están listadas en «LO QUE LA AUDITORÍA TUMBÓ», más abajo.
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
--
-- `public.rate_limit_intento` y `public.rate_limit_reset` son dos
-- `SECURITY DEFINER` propiedad de `postgres`, alcanzables por PostgREST,
-- que insertan y borran filas de `public.ip_rate_limits` saltándose su RLS
-- deny-all. El privilegio de ejecutarlas es de `service_role` y de nadie
-- más. Eso es un invariante de la base, y vale con independencia de lo que
-- hoy se pueda hacer con ellas.
--
-- Quien lo asienta hoy es UN SOLO archivo del repositorio,
-- `supabase/archivo-migraciones-historicas/migrations/20260805_auth_01_rate_limit_atomico.sql`
-- (líneas 164-170). Y el volcado base `20260912190416_remote_schema.sql`
-- NO lo sustituye, aunque a primera vista lo parezca: trae las dos
-- funciones, los dos índices, el `SECURITY DEFINER`, el `owner=postgres` y
-- el `GRANT` a `service_role`. Todo menos lo que importa.
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
-- desde el repositorio sin aquel archivo:
--
--     proname            | proacl
--     -------------------+-----------------------------------------------
--     rate_limit_intento | {postgres=X/postgres,anon=X/postgres,
--                          authenticated=X/postgres,service_role=X/postgres}
--
-- y las dos funciones respondieron a llamadas hechas con la anon key, sin
-- sesión ninguna.
--
-- ⚠️ POR ESO ESTO NO SE PUEDE DAR POR HEREDADO. Es la clase de propiedad
-- que no vive en la definición del objeto sino en su ACL, y el ACL es justo
-- lo que un volcado replayado NO reconstruye.
--
-- ═══ QUÉ ALCANCE TIENE HOY, MEDIDO Y NO SUPUESTO ═══════════════════════
--
-- `rate_limit_reset` rechaza por excepción toda ruta que no empiece por
-- `auth:login_v2:`. Y NINGÚN CUBO DE LA APLICACIÓN SE LLAMA ASÍ:
-- `src/lib/rateLimit.ts:80` compone la ruta como `auth:${action}:${identifier}`
-- y las acciones vivas son `login`, `login_email_global`, `login_ip`,
-- `registro`, `recovery`, `auth-login-fallido`, `auth-rate-limit`,
-- `invitar`, `reset-password`, `aceptar-invitacion`. `login_v2` no aparece
-- en `src/` ni una vez. Así que, mientras eso siga así, esa función no
-- alcanza ningún cubo real.
--
-- Eso NO convierte el grant de más en algo inofensivo, y no es el motivo de
-- este archivo: el motivo es que el ACL de una base reconstruida tiene que
-- ser el de producción, y hoy no lo es. Se escribe aquí para que nadie
-- justifique el arreglo con un escenario que no existe.
--
-- ═══ QUÉ HACE, Y QUÉ NO ════════════════════════════════════════════════
--
-- Reasienta los mismos `REVOKE`/`GRANT` de aquel archivo, ni uno más. NO
-- recrea las funciones, NO toca sus cuerpos, NO toca índices y NO toca
-- `ip_rate_limits`. El alcance de los roles cambia en UNA sola dirección y
-- sólo donde estaba mal: `anon` y `authenticated` PIERDEN un EXECUTE que
-- nunca debieron tener. `service_role` y `postgres` no pierden nada — el
-- `GRANT` a `service_role` se re-concede explícitamente en la misma
-- transacción, para que revocar no pueda dejar al limitador sin poder
-- ejecutar nada.
--
-- IDEMPOTENTE: `REVOKE` de un privilegio que no está y `GRANT` de uno que
-- ya está son no-ops en Postgres. Correrla dos veces no cambia nada.
--
-- NO-OP EN PRODUCCIÓN: allí el ACL ya es
-- `{postgres=X/postgres,service_role=X/postgres}` —verificado por Angel con
-- un SELECT de sólo lectura el 2026-09-19—, así que esta migración lo deja
-- idéntico. Su valor allí es documental: deja el invariante escrito en un
-- archivo que ordena al final.
--
-- TOLERANTE A QUE LAS FUNCIONES NO EXISTAN, y no por si acaso. Comprobado:
-- `supabase/baseline/` crea la tabla `ip_rate_limits` y sus índices
-- (02_tables.sql, 03_indexes.sql) pero NO crea estas dos funciones —no
-- aparecen en 05_functions.sql—. Una base levantada desde `baseline/`
-- llegaría aquí sin ellas y un `REVOKE ... ON FUNCTION` sin guarda abortaría
-- con 42883.
--
-- ═══ LO QUE LA AUDITORÍA TUMBÓ, Y CÓMO QUEDA ═══════════════════════════
--
-- EL DEFECTO DE FONDO: la guarda que decide si actuar resolvía las firmas
-- declaradas con `to_regprocedure` y saltaba con `CONTINUE` al recibir
-- NULL — y el post-vuelo filtraba con ESE MISMO PREDICADO. O sea que si una
-- firma declarada no casaba con la real (otra aridad, otro tipo, un tipo
-- inexistente), el `REVOKE` se saltaba, el post-vuelo se saltaba con él, y
-- el archivo terminaba EN VERDE con `anon` conservando EXECUTE. La única
-- comprobación que protege el propósito del archivo no podía dispararse por
-- la única causa que la haría falta.
--
-- Cómo queda: el pre-vuelo del bloque 1 entra al catálogo POR NOMBRE
-- (`proname`), que es una llave DISTINTA de la que usa la guarda, y compara
-- el conjunto de firmas vivas contra el declarado. Una firma mal escrita ya
-- no se salta en silencio: aborta nombrando las dos listas. El conteo del
-- bloque 2 se asevera en vez de sólo anunciarse, y la rejilla del final
-- distingue «no existe» de «existe con otra firma», que son situaciones
-- opuestas.
--
-- Y CINCO AFIRMACIONES FALSAS DE ESTA CABECERA, ya corregidas arriba:
--   · decía que toma ACCESS EXCLUSIVE. Medido con `pg_locks`: no lo toma.
--   · citaba `src/lib/auth/` como llamador. Ese directorio no existe.
--   · su modelo de amenaza hablaba de vaciar cubos `auth:login_v2:*`. No
--     existe ningún cubo con ese nombre.
--   · decía `ESTADO · LOCAL: PENDIENTE` estando aplicada en local.
--   · citaba `20260805` en su ruta vieja, antes de archivarlo.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
--
-- Bloqueos: medido con `pg_locks` dentro de la propia transacción, un
-- `REVOKE`/`GRANT` sobre una función NO toma ningún lock de tabla. Actualiza
-- la fila de `pg_proc` y dispara el event trigger de graphql, que toma
-- `RowExclusiveLock` sobre `graphql.seq_schema_version`. Nada más. No
-- bloquea lecturas ni escrituras de ninguna tabla de datos.
--
-- Ventana de despliegue: no hay nada que coordinar. NINGÚN código de la
-- aplicación llama a estas dos funciones — `grep` de sus nombres en `src/`
-- da cero. El limitador que corre hoy es `src/lib/rateLimit.ts`, que ataca
-- la tabla `ip_rate_limits` directamente con cliente admin y no pasa por
-- estos RPC. Así que revocar no puede romper ninguna ruta viva: no hay
-- ninguna ruta viva.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ---------------------------------------------------------------------
-- 1 · PRE-VUELO: censar POR NOMBRE y abortar si las firmas no casan.
-- ---------------------------------------------------------------------
-- ⚠️ ESTE BLOQUE ES LA CORRECCIÓN CENTRAL DE LA AUDITORÍA. Entra al
-- catálogo por `proname`, NO por `to_regprocedure(firma)`. Esa diferencia
-- es todo el punto: si la llave de la comprobación fuera la misma que la
-- de la guarda, una firma mal declarada las desactivaría a las dos a la vez
-- y el archivo saldría en verde sin haber revocado nada.
DO $$
DECLARE
  -- ⚠️ LISTA DE FIRMAS (1 de 4) — ver el mensaje de la excepción de abajo.
  k_firmas  CONSTANT text[] := ARRAY[
    'public.rate_limit_intento(text,text,int,int)',
    'public.rate_limit_reset(text)'
  ];
  k_nombres CONSTANT text[] := ARRAY['rate_limit_intento','rate_limit_reset'];
  v_vivas      text[];
  v_declaradas text[];
BEGIN
  SELECT coalesce(array_agg(p.oid::regprocedure::text ORDER BY p.oid::regprocedure::text), '{}')
    INTO v_vivas
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = ANY (k_nombres);

  -- Caso legítimo: base recién creada desde `supabase/baseline/`, que no
  -- crea estas funciones. No hay nada que reasentar y no es un fallo.
  IF cardinality(v_vivas) = 0 THEN
    RAISE NOTICE 'Auth 02: ninguna de las dos funciones existe todavía (replay desde baseline/). Nada que reasentar.';
    RETURN;
  END IF;

  SELECT coalesce(array_agg(to_regprocedure(f)::regprocedure::text ORDER BY to_regprocedure(f)::regprocedure::text), '{}')
    INTO v_declaradas
    FROM unnest(k_firmas) AS f
   WHERE to_regprocedure(f) IS NOT NULL;

  IF v_vivas <> v_declaradas OR cardinality(v_vivas) <> cardinality(k_firmas) THEN
    RAISE EXCEPTION
      'PRE-VUELO FALLÓ: las firmas declaradas en este archivo no casan con las que hay en la base. VIVAS (por proname, en public): %. DECLARADAS y resolubles: %. Corrige las CUATRO listas de firmas de este archivo —están marcadas «LISTA DE FIRMAS (n de 4)»: pre-vuelo, reasiento, post-vuelo y el SELECT final— y vuelve a correrlo. NO se ha modificado ningún privilegio.',
      v_vivas, v_declaradas;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · Reasentar privilegios, función por función.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  -- ⚠️ LISTA DE FIRMAS (2 de 4)
  k_firmas CONSTANT text[] := ARRAY[
    'public.rate_limit_intento(text,text,int,int)',
    'public.rate_limit_reset(text)'
  ];
  r           text;
  v_presentes int := 0;
BEGIN
  FOREACH r IN ARRAY k_firmas
  LOOP
    IF to_regprocedure(r) IS NULL THEN
      RAISE NOTICE 'Auth 02: % no existe todavía — se salta.', r;
      CONTINUE;
    END IF;

    v_presentes := v_presentes + 1;

    -- Los dos, y en este orden. Revocar de PUBLIC no basta (ver cabecera);
    -- revocar sin re-conceder a service_role dejaría al limitador sin poder
    -- ejecutar nada si alguna vez volviera a usar estos RPC.
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r);
  END LOOP;

  -- ⚠️ ASEVERADO, NO ANUNCIADO. Antes esto era un RAISE NOTICE, y un NOTICE
  -- no lo ve nadie: el SQL Editor no los muestra de forma fiable y
  -- `db push` no los imprime. Los únicos dos valores que significan algo
  -- son 0 (base desde baseline/, el pre-vuelo ya salió por ahí) y 2 (las
  -- dos reasentadas). Cualquier otro es un par a medias.
  IF v_presentes NOT IN (0, cardinality(k_firmas)) THEN
    RAISE EXCEPTION
      'FALLÓ: se reasentaron % de % funciones. Un par a medias no es un estado que este archivo pueda dar por bueno.',
      v_presentes, cardinality(k_firmas);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 3 · POST-VUELO: aborta si el reasiento no quedó.
-- ---------------------------------------------------------------------
-- Va DENTRO de la transacción a propósito: si algo salió mal, lo que se
-- quiere es que no se confirme nada, no un aviso a toro pasado.
DO $$
DECLARE
  -- ⚠️ LISTA DE FIRMAS (3 de 4)
  k_firmas CONSTANT text[] := ARRAY[
    'public.rate_limit_intento(text,text,int,int)',
    'public.rate_limit_reset(text)'
  ];
  r   text;
  v_o oid;
BEGIN
  FOREACH r IN ARRAY k_firmas
  LOOP
    v_o := to_regprocedure(r);
    CONTINUE WHEN v_o IS NULL;

    IF has_function_privilege('anon', v_o, 'EXECUTE')
       OR has_function_privilege('authenticated', v_o, 'EXECUTE') THEN
      RAISE EXCEPTION 'POST-VUELO FALLÓ: % conserva EXECUTE para anon o authenticated.', r;
    END IF;
    IF NOT has_function_privilege('service_role', v_o, 'EXECUTE') THEN
      RAISE EXCEPTION 'POST-VUELO FALLÓ: % se quedó SIN EXECUTE para service_role.', r;
    END IF;
  END LOOP;
END $$;

-- Que PostgREST reconstruya su caché de esquema: los privilegios que acaba
-- de perder `anon` los tiene cacheados.
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ---------------------------------------------------------------------
-- 4 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
-- El LEFT JOIN sobre la lista de firmas es deliberado: así devuelve SIEMPRE
-- dos renglones. Con un `FROM pg_proc` a secas, una base sin las funciones
-- daría cero filas, y el SQL Editor —que enseña el último conjunto CON
-- filas— mostraría el resultado de otra sentencia como si fuera éste.
--
-- Y el LATERAL busca POR NOMBRE, no por firma, porque «no existe» y «existe
-- con otra firma» son situaciones OPUESTAS: la primera es el replay desde
-- baseline/ y es correcta; la segunda significa que el REVOKE se saltó.
-- Compartir texto entre las dos es como el archivo salía antes en verde.
SELECT
  f.nombre                                            AS proname,
  coalesce(pg_get_userbyid(p.proowner), '(sin firma declarada)') AS owner,
  p.prosecdef                                         AS security_definer,
  coalesce(p.proacl::text, viva.acls, '(ninguno)')    AS proacl,
  CASE
    WHEN p.oid IS NULL AND viva.n = 0 THEN
      'AUSENTE OK — no existe con ningún nombre; es el replay desde baseline/, no hay nada que reasentar'
    WHEN p.oid IS NULL AND viva.n > 0 THEN
      'FALLO — existe con OTRA firma (' || viva.firmas || '): el REVOKE se saltó y anon/authenticated pueden conservar EXECUTE. Corrige las cuatro LISTA DE FIRMAS de este archivo'
    WHEN has_function_privilege('anon',          p.oid, 'EXECUTE')
      OR has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN
      'FALLO — anon/authenticated conservan EXECUTE'
    WHEN NOT has_function_privilege('service_role', p.oid, 'EXECUTE') THEN
      'FALLO — service_role sin EXECUTE'
    WHEN p.prosecdef IS NOT TRUE THEN
      'REVISAR — dejó de ser SECURITY DEFINER'
    WHEN pg_get_userbyid(p.proowner) <> 'postgres' THEN
      'REVISAR — owner inesperado'
    ELSE 'OK'
  END                                                 AS estado
FROM (VALUES
  -- ⚠️ LISTA DE FIRMAS (4 de 4)
  ('rate_limit_intento', 'public.rate_limit_intento(text,text,int,int)'),
  ('rate_limit_reset',   'public.rate_limit_reset(text)')
) f(nombre, firma)
LEFT JOIN pg_proc p ON p.oid = to_regprocedure(f.firma)
LEFT JOIN LATERAL (
  SELECT count(*)                                            AS n,
         string_agg(q.oid::regprocedure::text, ', ')          AS firmas,
         string_agg(coalesce(q.proacl::text, '(ninguno)'), ', ') AS acls
    FROM pg_proc q
   WHERE q.pronamespace = 'public'::regnamespace
     AND q.proname = f.nombre
) viva ON true
ORDER BY f.nombre;

-- ═══════════════════════════════════════════════════════════════════════
-- REVERSIÓN — y por qué casi nunca es lo que quieres
-- ═══════════════════════════════════════════════════════════════════════
--
--   GRANT EXECUTE ON FUNCTION public.rate_limit_intento(text,text,int,int) TO anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.rate_limit_reset(text)                TO anon, authenticated;
--
-- ⚠️ ESO DEVUELVE A `anon` UN EXECUTE QUE PRODUCCIÓN NO LE DA. Se deja
-- escrito porque una reversión a ciegas es peor que una informada, no
-- porque haya un escenario en el que convenga: ningún código llama a estas
-- funciones, así que revocar no puede haber roto nada. Si algo falla tras
-- aplicar esto, el problema no es el revoke.
-- ═══════════════════════════════════════════════════════════════════════
