-- ============================================================================
-- ESTADO: PENDIENTE DE APLICAR — la ejecuta Angel a mano, EN UN SOLO BLOQUE.
-- ============================================================================
-- Puente de acceso a private.google_conexiones_secretos
--
-- Especificación: BRIEF-MIGRACION-PUENTE-SECRETOS.md (§§1-9). Este archivo la
-- implementa y no la reinterpreta. Donde diverge, la divergencia va marcada
-- inline con «DIVERGENCIA CON LA ESPECIFICACIÓN» y con su razón.
--
-- ── QUÉ PROBLEMA RESUELVE ───────────────────────────────────────────────────
--
-- 20260817_gcal_conexion_clinica_a_esquema.sql creó una tabla que la
-- aplicación NO PUEDE ALCANZAR, por dos causas apiladas e independientes:
--
--   1. No concede nada a `service_role`. El ACL real de la tabla es
--      {postgres=arwdDxtm/postgres}. Un esquema nuevo no hereda privilegios:
--      todas las entradas de pg_default_acl de Supabase están declaradas sobre
--      esquemas NOMBRADOS (public, storage, auth, realtime, graphql,
--      graphql_public, extensions) y no hay ninguna sin esquema. Y BYPASSRLS
--      no suple nada: es un atributo de rol que actúa sobre el filtro de
--      FILAS, después de que el chequeo de privilegios de esquema y tabla haya
--      pasado. Aquí no pasa.
--   2. supabase-js habla por PostgREST, que sólo sirve los esquemas de su
--      lista de expuestos. `private` no está en ella, y src/lib/supabase/admin.ts
--      no pasa `db: { schema }` (no hay ni una llamada `.schema(` en todo src/).
--
-- ── QUÉ CREA ────────────────────────────────────────────────────────────────
--
--   public.alta_conexion_google               metadata + secretos en UNA
--                                             transacción (cierra el hueco de
--                                             «conexión sin secretos»)
--   public.guardar_secretos_conexion          el refresh, con COALESCE sobre
--                                             refresh_token
--   public.leer_conexion_google_con_secretos  la lectura, con `tiene_secretos`
--                                             para que 0 filas y «sin
--                                             secretos» dejen de confundirse
--
-- Las tres SECURITY DEFINER, en `public`, con `p_clinica_id` obligatorio, y
-- alcanzables SÓLO por service_role.
--
-- ── LO QUE ESTE ARCHIVO NO HACE ─────────────────────────────────────────────
--   · NO concede USAGE ON SCHEMA private ni privilegios de tabla a
--     service_role. La función corre como su dueño y no los necesita. Esa
--     denegación se AFIRMA a propósito en R6.
--   · NO edita 20260817_..._a_esquema.sql. Sus COMMENT los corrige la §6 de
--     aquí, dentro de la base; su cabecera lleva ya la anotación cruzada.
--   · NO toca código de aplicación. Los cambios A1-A6 del brief §4 van con la
--     serie de la Rama 1.
--
-- ⚠️ ESTE ARCHIVO NO AUTORIZA EL DEPLOY. El veredicto de abajo se responde
--    entero dentro del motor, y lo que se rompió fue el camino de la
--    aplicación HACIA el motor. La condición de salida es
--    `npx tsx scripts/gcal-puente-humo.ts` con sus cinco sondas en verde.
--    Ver el brief §7.
-- ============================================================================

BEGIN;

-- Un ALTER/GRANT que espera un lock encola detrás de sí a todas las consultas
-- siguientes, lecturas incluidas. Con timeout falla limpio y se reintenta.
SET LOCAL lock_timeout      = '5s';
SET LOCAL statement_timeout = '60s';

-- ════════════════════════════════════════════════════════════════════════════
-- 1. PRE-VUELO QUE ABORTA + tablas temporales del veredicto
-- ════════════════════════════════════════════════════════════════════════════

DO $do$
BEGIN
  IF to_regnamespace('private') IS NULL THEN
    RAISE EXCEPTION 'ABORTADO: no existe el esquema private. Falta aplicar 20260817_gcal_conexion_clinica_a_esquema.sql.';
  END IF;
  IF to_regclass('private.google_conexiones_secretos') IS NULL THEN
    RAISE EXCEPTION 'ABORTADO: no existe private.google_conexiones_secretos.';
  END IF;
  IF to_regclass('public.clinica_conexiones_google') IS NULL THEN
    RAISE EXCEPTION 'ABORTADO: no existe public.clinica_conexiones_google.';
  END IF;
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'ABORTADO: no existe public.profiles.';
  END IF;
END $do$;

-- La tabla temporal existe para reconciliar una tensión que no tiene otra
-- salida: la prueba de escritura quiere estar DENTRO de la transacción (para
-- poder deshacerse) y el veredicto quiere ser la ÚLTIMA sentencia del archivo
-- (porque el SQL Editor sólo muestra la rejilla de la última, y no muestra
-- RAISE NOTICE de forma fiable — dimensión 5 de AUDITORIA-MIGRACIONES.md).
-- ON COMMIT PRESERVE ROWS la deja viva para el SELECT posterior al COMMIT.
CREATE TEMP TABLE IF NOT EXISTS veredicto_puente (
  orden      int,
  afirmacion text,
  resultado  text
) ON COMMIT PRESERVE ROWS;
DELETE FROM pg_temp.veredicto_puente;

-- El SUJETO de las afirmaciones con rol, resuelto por subconsulta y NUNCA por
-- literal de producción: este archivo tiene que sobrevivir a un replay sobre
-- una base recién creada desde supabase/baseline/, donde no hay ni conexiones
-- ni perfiles. Si no hay sujeto, cada afirmación que lo necesite escribe
-- 'NO PROBADO' en la rejilla. «No probado» y «probado y bien» no pueden salir
-- del mismo color.
CREATE TEMP TABLE IF NOT EXISTS sujeto_puente (
  conexion_id       uuid,
  clinica_id        uuid,
  user_id           uuid,
  perfil_id         uuid,
  dueno_con_perfil  boolean
) ON COMMIT PRESERVE ROWS;
DELETE FROM pg_temp.sujeto_puente;

INSERT INTO pg_temp.sujeto_puente (conexion_id, clinica_id, user_id, perfil_id, dueno_con_perfil)
SELECT c.id,
       c.clinica_id,
       c.user_id,
       -- Un perfil CUALQUIERA de esa clínica, para R8. Se elige a partir de la
       -- clínica de la conexión, así que su clinica_id no es nulo y su clínica
       -- sí tiene conexión: los dos matices que harían fallar la afirmación
       -- sin que nada estuviera mal.
       (SELECT p.id FROM public.profiles p
         WHERE p.clinica_id = c.clinica_id ORDER BY p.id LIMIT 1),
       -- R4 llama al alta con el dueño de la conexión, y la guarda 1 exige que
       -- ese usuario tenga perfil en esa clínica. Si no lo tiene, R4 no puede
       -- probarse sin abortar la migración por un motivo ajeno.
       EXISTS (SELECT 1 FROM public.profiles p
                WHERE p.id = c.user_id AND p.clinica_id = c.clinica_id)
  FROM public.clinica_conexiones_google c
 WHERE c.rol = 'clinica' AND c.estado = 'activa'
 ORDER BY c.created_at
 LIMIT 1;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. GUARDAS DE SOBRECARGA
-- ════════════════════════════════════════════════════════════════════════════
-- CREATE OR REPLACE con una lista de argumentos distinta NO reemplaza: CREA
-- una función nueva. Con dos sobrecargas del mismo nombre, PostgREST responde
-- ambigüedad (PGRST203) en vez de ejecutar. Se dropea por firma exacta; si
-- quedara viva una sobrecarga con OTRA firma, C1 lo caza contando.
DROP FUNCTION IF EXISTS public.alta_conexion_google(uuid, uuid, text, text, text, text, text, bigint);
DROP FUNCTION IF EXISTS public.guardar_secretos_conexion(uuid, uuid, text, text, bigint);
DROP FUNCTION IF EXISTS public.leer_conexion_google_con_secretos(uuid, uuid);

-- ════════════════════════════════════════════════════════════════════════════
-- 3. LAS TRES FUNCIONES
-- ════════════════════════════════════════════════════════════════════════════
-- `SET search_path = ''` en las tres, y TODO nombre calificado.
--
-- La convención del repo es `SET search_path = public, pg_temp`
-- (20260427_b1_03_security_definer_search_path.sql). Aquí se diverge a `''` a
-- propósito y no por gusto: deja fuera pg_temp sin discusión, y estas tres
-- funciones tocan la tabla de tokens. NO lo «arregles» a la convención.
--
-- (Nota para quien venga del brief: la afirmación de la propuesta original de
--  que las funciones del baseline «no llevan search_path» era falsa, leída de
--  un artefacto anterior al 2026-04-27. En producción sí lo llevan.)

-- ── 3.1 alta_conexion_google ────────────────────────────────────────────────
-- Metadata + secretos en UNA llamada. Es lo que impide que nazca el estado
-- «hay conexión y no hay secretos», que hoy no existe porque google_tokens
-- guarda las dos cosas en la misma fila (src/lib/gcal.ts:158-162).
CREATE OR REPLACE FUNCTION public.alta_conexion_google(
  p_clinica_id           uuid,
  p_user_id              uuid,
  p_rol                  text,
  p_google_account_sub   text,
  p_google_account_email text,
  p_access               text,
  p_refresh              text,
  p_expires              bigint
)
RETURNS TABLE (
  conexion_id uuid,
  calendar_id text,
  rol         text,
  estado      text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
-- Los nombres de salida (rol, estado, calendar_id, conexion_id) coinciden con
-- columnas de las tablas. Todo va calificado por alias, y esta directiva es el
-- cinturón: ante la duda, el identificador es la COLUMNA y no la variable.
#variable_conflict use_column
DECLARE
  v_id         uuid;
  v_constraint text;
BEGIN
  -- ── Guardas, ANTES de escribir nada. El orden importa. ────────────────────

  -- 1. Aislamiento entre clínicas en el camino de escritura: sin esto, un par
  --    (clínica, usuario) mal formado crea una conexión de la clínica A a
  --    nombre de un usuario de la B.
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = p_user_id AND p.clinica_id = p_clinica_id
  ) THEN
    RAISE EXCEPTION 'perfil_ajeno_a_clinica'
      USING DETAIL = 'El usuario no tiene perfil en esa clínica; no se puede colgar de ella una conexión de Google.';
  END IF;

  -- 2. El índice único es por user_id y NO es parcial
  --    (clinica_conexiones_google_user_id_uniq). Sin esta guarda, el
  --    ON CONFLICT (user_id) DO UPDATE de abajo actualizaría la fila de la OTRA
  --    clínica y devolvería SU id — y el llamador escribiría los secretos
  --    dentro de la conexión ajena. El traslado exige desconectar primero.
  IF EXISTS (
    SELECT 1 FROM public.clinica_conexiones_google c
     WHERE c.user_id = p_user_id AND c.clinica_id <> p_clinica_id
  ) THEN
    RAISE EXCEPTION 'conexion_de_otra_clinica'
      USING DETAIL = 'Ese usuario ya tiene conexión en otra clínica. Desconéctala antes de darla de alta aquí.';
  END IF;

  -- 3. La comprobación amable. El guardián de verdad es el índice único
  --    parcial clinica_conexiones_google_una_por_clinica, que sigue puesto
  --    para la carrera; el EXCEPTION de abajo reetiqueta su 23505 con este
  --    mismo nombre para que el callback tenga UN SOLO literal que reconocer.
  IF p_rol = 'clinica' AND EXISTS (
    SELECT 1 FROM public.clinica_conexiones_google c
     WHERE c.clinica_id = p_clinica_id
       AND c.rol        = 'clinica'
       AND c.user_id   <> p_user_id
  ) THEN
    RAISE EXCEPTION 'clinica_ya_conectada'
      USING DETAIL = 'Esa clínica ya tiene otra cuenta de Google como conexión de clínica. El relevo es un flujo consciente.';
  END IF;

  -- 4. La columna es NOT NULL; sin esta guarda el fallo sería un 23502 opaco
  --    llegando desde dentro de after(), donde el error se traga.
  IF p_access IS NULL THEN
    RAISE EXCEPTION 'access_token_nulo'
      USING DETAIL = 'No se da de alta una conexión sin access_token.';
  END IF;

  -- ── Escritura, en la misma transacción ────────────────────────────────────
  BEGIN
    INSERT INTO public.clinica_conexiones_google AS c
      (clinica_id, user_id, rol, google_account_sub, google_account_email, estado)
    VALUES
      (p_clinica_id, p_user_id, p_rol, p_google_account_sub, p_google_account_email, 'activa')
    ON CONFLICT (user_id) DO UPDATE SET
      -- Reconectar reactiva…
      estado               = 'activa',
      -- …y NADA MÁS que pueda destruir. COALESCE por la misma razón que el
      -- refresh_token en 3.2: hoy estos dos llegan NULL porque los scopes
      -- openid/email todavía no se piden, y NULL significa «no lo sé», nunca
      -- «bórralo» (lo dice el propio COMMENT de la columna).
      google_account_sub   = COALESCE(EXCLUDED.google_account_sub,   c.google_account_sub),
      google_account_email = COALESCE(EXCLUDED.google_account_email, c.google_account_email)
      -- NO se toca `calendar_id`: reconectar no debe crear un segundo
      --   calendario ni huerfanar el anterior (la invariante que el callback
      --   ya protege hoy, callback/route.ts:85-95).
      -- NO se toca `rol`: reconectar no promueve ni degrada.
      -- NO se toca `clinica_id`: lo cubre la guarda 2.
    RETURNING c.id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint = 'clinica_conexiones_google_una_por_clinica' THEN
      RAISE EXCEPTION 'clinica_ya_conectada'
        USING DETAIL = 'Carrera contra el índice único parcial: otra cuenta acaba de quedarse con la conexión de clínica.';
    END IF;
    RAISE;
  END;

  INSERT INTO private.google_conexiones_secretos AS s
    (conexion_id, access_token, refresh_token, expires_at)
  VALUES
    (v_id, p_access, p_refresh, p_expires)
  ON CONFLICT (conexion_id) DO UPDATE SET
    access_token  = EXCLUDED.access_token,
    refresh_token = COALESCE(EXCLUDED.refresh_token, s.refresh_token),
    expires_at    = EXCLUDED.expires_at;

  RETURN QUERY
    SELECT c.id, c.calendar_id, c.rol, c.estado
      FROM public.clinica_conexiones_google c
     WHERE c.id = v_id;
END;
$$;

COMMENT ON FUNCTION public.alta_conexion_google(uuid, uuid, text, text, text, text, text, bigint) IS
  'Alta o reconexión de una conexión de Google: metadata y secretos en UNA transacción, para que no pueda nacer una conexión sin tokens. Junto con guardar_secretos_conexion y leer_conexion_google_con_secretos, es el ÚNICO camino de la aplicación a private.google_conexiones_secretos: service_role no alcanza ese esquema por ningún otro. Sólo service_role puede ejecutarla. 20260818_gcal_puente_secretos.sql.';

-- ── 3.2 guardar_secretos_conexion ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guardar_secretos_conexion(
  p_clinica_id  uuid,
  p_conexion_id uuid,
  p_access      text,
  p_refresh     text,
  p_expires     bigint
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- El lado caro del aislamiento: escribir los tokens de la clínica A bajo la
  -- conexión de la B haría que las citas de B se escribieran en el calendario
  -- de Google de A, con el nombre del paciente en el título del evento.
  IF NOT EXISTS (
    SELECT 1 FROM public.clinica_conexiones_google c
     WHERE c.id = p_conexion_id AND c.clinica_id = p_clinica_id
  ) THEN
    RAISE EXCEPTION 'conexion_ajena_o_inexistente'
      USING DETAIL = 'Esa conexión no existe o no es de esa clínica. Un escritor no escribe en el vacío.';
  END IF;

  IF p_access IS NULL THEN
    RAISE EXCEPTION 'access_token_nulo'
      USING DETAIL = 'access_token es NOT NULL; sin esta guarda el fallo sería un 23502 opaco desde dentro de after().';
  END IF;

  INSERT INTO private.google_conexiones_secretos AS s
    (conexion_id, access_token, refresh_token, expires_at)
  VALUES
    (p_conexion_id, p_access, p_refresh, p_expires)
  ON CONFLICT (conexion_id) DO UPDATE SET
    access_token  = EXCLUDED.access_token,
    -- ⚠️ EL COALESCE NO ES OPCIONAL, Y NO SE «SIMPLIFICA» A EXCLUDED A SECAS.
    --
    -- 1. El refresh token no es un dato que el camino de refresco produzca.
    --    Hoy `credentials.refresh_token` viene poblado tras refrescar, pero es
    --    un eco de nuestra propia entrada, no un hecho de Google:
    --    google-auth-library/build/src/auth/oauth2client.js:287-292 hace
    --    literalmente `tokens.refresh_token = this.credentials.refresh_token`
    --    antes de devolver. Un contrato que descansa en que el llamador
    --    reencripte y reenvíe un valor que la librería le devolvió por
    --    cortesía se rompe el día que alguien no lo sabe.
    -- 2. Hay caminos legítimos que no lo tienen: una función de reparación, un
    --    camino que sólo renueva el access token, un refactor que escribe
    --    `credentials.refresh_token ?? null`.
    -- 3. El modo de fallo por defecto sería destructivo e INDISTINGUIBLE de una
    --    revocación real: sin refresh token, el siguiente vencimiento da
    --    invalid_grant, y eso marca la conexión como revocada. La clínica
    --    pierde la sincronización y el sistema diagnostica «el médico revocó el
    --    acceso desde Google».
    --
    -- No hay ningún caso legítimo de poner el refresh token a NULL: el único
    -- borrado legítimo es el de la conexión entera, vía ON DELETE CASCADE.
    refresh_token = COALESCE(EXCLUDED.refresh_token, s.refresh_token),
    -- `expires_at` SÍ se sobrescribe verbatim, incluido a NULL, y es una
    -- decisión distinta a propósito: access_token y expires_at viajan siempre
    -- juntos, así que aquí NULL significa de verdad «no sé cuándo vence».
    -- Preservar el valor viejo convertiría «vencimiento desconocido» en
    -- «vencido» sin decirlo.
    expires_at    = EXCLUDED.expires_at;
END;
$$;

COMMENT ON FUNCTION public.guardar_secretos_conexion(uuid, uuid, text, text, bigint) IS
  'Guarda los tokens de una conexión (refresco y reescritura). NULL en p_refresh significa «no lo toques», nunca «bórralo». Junto con alta_conexion_google y leer_conexion_google_con_secretos, es el ÚNICO camino de la aplicación a private.google_conexiones_secretos. Sólo service_role puede ejecutarla. 20260818_gcal_puente_secretos.sql.';

-- ── 3.3 leer_conexion_google_con_secretos ───────────────────────────────────
-- El nombre dice que devuelve secretos. Es feo y es a propósito: quien lea el
-- sitio de llamada tiene que ver, sin abrir nada, que por ahí salen tokens.
--
-- CÓMO SE DISTINGUE «no hay conexión» de «hay conexión sin secretos»:
--
--   0 filas                          → no existe, o existe y es de OTRA
--                                      clínica. Anomalía: el resolvedor bajo
--                                      RLS acababa de decir que existía.
--   1 fila, tiene_secretos = false   → la metadata existe y los secretos no.
--                                      Anomalía, y de las ruidosas.
--   1 fila, tiene_secretos = true    → camino normal.
--
-- Esta función NUNCA levanta excepción; devuelve 0 filas. Es la asimetría
-- deliberada con la escritora: un lector contesta una pregunta, un escritor no
-- puede escribir en el vacío. Y devolver 0 filas ante una clínica ajena es lo
-- que hace comprobable el aislamiento desde el cliente (sonda P5).
CREATE OR REPLACE FUNCTION public.leer_conexion_google_con_secretos(
  p_clinica_id  uuid,
  p_conexion_id uuid
)
RETURNS TABLE (
  conexion_id    uuid,
  clinica_id     uuid,
  user_id        uuid,
  rol            text,
  calendar_id    text,
  estado         text,
  tiene_secretos boolean,
  access_token   text,
  refresh_token  text,
  expires_at     bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.id,
         c.clinica_id,
         c.user_id,
         c.rol,
         c.calendar_id,
         c.estado,
         (s.conexion_id IS NOT NULL),
         s.access_token,
         s.refresh_token,
         s.expires_at
    FROM public.clinica_conexiones_google c
    LEFT JOIN private.google_conexiones_secretos s ON s.conexion_id = c.id
   WHERE c.id         = p_conexion_id
     AND c.clinica_id = p_clinica_id;
$$;

COMMENT ON FUNCTION public.leer_conexion_google_con_secretos(uuid, uuid) IS
  'Devuelve la conexión CON sus tokens. 0 filas = no existe o es de otra clínica; tiene_secretos=false = metadata sin tokens (anomalía, no «desconectado»). Junto con alta_conexion_google y guardar_secretos_conexion, es el ÚNICO camino de la aplicación a private.google_conexiones_secretos. Sólo service_role puede ejecutarla. 20260818_gcal_puente_secretos.sql.';

-- ════════════════════════════════════════════════════════════════════════════
-- 4. PERMISOS DE LAS TRES FUNCIONES — REVOKE ANTES DEL GRANT
-- ════════════════════════════════════════════════════════════════════════════
-- Obligatorio, y no ceremonial: el pg_default_acl de este proyecto para el tipo
-- 'f' sobre public es {postgres=X, anon=X, authenticated=X, service_role=X}, o
-- sea que una función nueva en `public` nace ejecutable por `anon`
-- DIRECTAMENTE, no vía PUBLIC. Revocar sólo de PUBLIC no bastaría.
--
-- Precedentes en el repo (sobre FUNCIONES, no sobre tablas):
--   20260807_folio_01_esquema_y_generador.sql:612-613
--   20260615_consultorios_05_marcar_default_rpc.sql:110-116 — cuyo comentario
--   ya dejó anotado este mismo hecho.
--
-- Las dos sentencias van SIEMPRE JUNTAS y EN ESTE ORDEN.
REVOKE ALL ON FUNCTION public.alta_conexion_google(uuid, uuid, text, text, text, text, text, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.alta_conexion_google(uuid, uuid, text, text, text, text, text, bigint)
  TO service_role;

REVOKE ALL ON FUNCTION public.guardar_secretos_conexion(uuid, uuid, text, text, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_secretos_conexion(uuid, uuid, text, text, bigint)
  TO service_role;

REVOKE ALL ON FUNCTION public.leer_conexion_google_con_secretos(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leer_conexion_google_con_secretos(uuid, uuid)
  TO service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. HIGIENE DE GRANTS SOBRE public.clinica_conexiones_google
-- ════════════════════════════════════════════════════════════════════════════
-- El ACL real de `authenticated` es `rm`: r = SELECT, m = MAINTAIN, privilegio
-- nuevo de PG 17. La migración del 17 revocó una lista ENUMERADA que no lo
-- incluye (20260817_...:355-356 tras la anotación). El impacto de MAINTAIN es
-- prácticamente nulo —habilita VACUUM/ANALYZE/REINDEX, y PostgREST no emite
-- esas sentencias—; lo que se corrige es el MÉTODO: enumerar verbos deja
-- huecos que aparecen solos al cambiar de versión mayor.
--
-- Patrón del propio repo: 20260813_firmas_documento.sql:235-236.
REVOKE ALL ON public.clinica_conexiones_google FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.clinica_conexiones_google TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. LOS COMMENT DE LA BASE, CORREGIDOS
-- ════════════════════════════════════════════════════════════════════════════
-- Las afirmaciones falsas no estaban sólo en los .md: están DENTRO de la base,
-- que es donde se consulta con \dn+ y \d+. El archivo del 17 no se edita
-- (forward-only, CLAUDE.md); lleva una anotación cruzada en su cabecera y sus
-- COMMENT —que son SENTENCIAS, no comentarios— se corrigen aquí.

COMMENT ON SCHEMA private IS
  'Datos que ninguna sesión de la aplicación alcanza directamente. El esquema NO tiene grants para NINGÚN rol de la aplicación, tampoco service_role: BYPASSRLS actúa sobre el filtro de filas, DESPUÉS del chequeo de privilegios de esquema y tabla, y no lo suple. Tampoco está expuesto por PostgREST. El único camino desde la aplicación son las tres funciones SECURITY DEFINER de public: alta_conexion_google, guardar_secretos_conexion y leer_conexion_google_con_secretos (20260818_gcal_puente_secretos.sql). Conceder USAGE aquí a service_role no arregla un olvido: deshace una decisión, y R6 de esa migración la afirma a propósito.';

COMMENT ON TABLE private.google_conexiones_secretos IS
  'access_token / refresh_token cifrados (AES-256-GCM, src/lib/encrypt.ts) de cada conexión de Google. Sin grants para ningún rol de la aplicación: ni anon, ni authenticated, ni service_role. Se llega sólo por public.leer_conexion_google_con_secretos, public.guardar_secretos_conexion y public.alta_conexion_google. El borrado se hereda del ON DELETE CASCADE desde public.clinica_conexiones_google, que corre como acción de integridad referencial. CORRIGE al COMMENT anterior (20260817_gcal_conexion_clinica_a_esquema.sql), que decía que service_role llegaba y era falso: ése fue el bug.';

-- ════════════════════════════════════════════════════════════════════════════
-- 7. LA CACHÉ DE POSTGREST
-- ════════════════════════════════════════════════════════════════════════════
-- Alcanzable por Postgres ≠ alcanzable por PostgREST. Son dos preguntas, y la
-- segunda es la que se rompió. Supabase suele recargar la caché por su cuenta
-- vía event trigger de DDL, pero el problema nunca fue que fallara siempre:
-- fue que nada distinguía el caso en que falla.
--
-- Precedentes: 20260807_folio_01_esquema_y_generador.sql:617,
--              20260813_firmas_documento.sql:444.
-- Es transaccional: si el veredicto de abajo aborta, no se entrega.
NOTIFY pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════════════════════
-- 8. VEREDICTO DENTRO DE LA BASE
-- ════════════════════════════════════════════════════════════════════════════
-- Veinte afirmaciones (C1-C11 de catálogo, R1-R9 con rol real), frente a las
-- trece de la propuesta original. NINGUNA decide el deploy: eso es el script de
-- humo (§7 del brief). Lo que hacen es abortar la migración si algo dentro de
-- la base está mal — y como esto va antes del COMMIT, abortar significa que no
-- queda nada aplicado.
--
-- MECÁNICA OBLIGATORIA DE LOS BLOQUES CON ROL, y no es opcional ninguna pieza:
--
--   · `SET LOCAL ROLE x` seguido INMEDIATAMENTE de una afirmación sobre
--     current_user. SET LOCAL fuera de un bloque de transacción no hace nada:
--     emite un WARNING y sigue. Sin esta afirmación, las cuatro pruebas que
--     dependen del rol son justo las que dan verde habiendo corrido como
--     postgres, que puede todo. Es la asimetría que este archivo existe para
--     eliminar.
--   · RESET ROLE en la salida normal Y en cada manejador de excepciones. Un
--     bloque DO sin cláusula SET propia no establece un nivel de anidamiento de
--     GUC, así que el cambio de rol sobrevive al bloque; y un EXCEPTION WHEN
--     abre una subtransacción cuyos cambios de GUC se deshacen al abortarla.
--     Que vuelva o no vuelva depende de dónde caiga el SET respecto del
--     BEGIN…EXCEPTION, y eso no se ve leyendo el código. Se pone en los dos
--     sitios y se deja de depender de saberlo.
--   · Las pruebas de ESCRITURA van en una subtransacción con centinela
--     ('ZX001', clase no asignada por Postgres) que SIEMPRE se deshace. El
--     resultado se guarda en una variable plpgsql —que no es transaccional— y
--     lo escribe en la tabla temporal el MANEJADOR, que ya corre en la
--     transacción exterior. Escribirlo dentro del cuerpo no sirve: se
--     desharía con la subtransacción.
--   · NINGÚN `INSERT` a las tablas temporales ocurre con el rol conmutado.
--     Una tabla temporal creada por `postgres` NO es escribible por
--     `service_role` ni por `authenticated` sin un GRANT explícito: el intento
--     da «permission denied for table». Así que todo `INSERT` va o bien ANTES
--     del `SET LOCAL ROLE` (las salidas 'NO PROBADO'), o bien DESPUÉS del
--     `RESET ROLE` correspondiente. En los bloques de sólo lectura (R1, R2, R6,
--     R7, R9) eso significa que el `RESET ROLE` va antes del `INSERT`, y en R6,
--     R7 y R9 que el `INSERT` vive FUERA del `BEGIN…EXCEPTION`, después de que
--     las dos salidas hayan reseteado. Se resuelve así y no concediendo
--     privilegios sobre las temporales: menos superficie, y no depende de
--     conceder nada.
--     ⚠️ SI MUEVES UN `INSERT` DE SITIO, COMPRUEBA ESTO PRIMERO. El fallo no es
--     un falso verde: la migración aborta entera, pero por un motivo que no
--     tiene nada que ver con lo que la afirmación estaba probando.

-- ── C1-C11 · Catálogo ───────────────────────────────────────────────────────

-- C1 · Existen las tres, con la firma exacta, y no hay sobrecargas.
INSERT INTO pg_temp.veredicto_puente
SELECT 101, 'C1 · las 3 funciones existen con la firma exacta y sin sobrecargas',
  CASE WHEN to_regprocedure('public.alta_conexion_google(uuid,uuid,text,text,text,text,text,bigint)') IS NOT NULL
        AND to_regprocedure('public.guardar_secretos_conexion(uuid,uuid,text,text,bigint)')            IS NOT NULL
        AND to_regprocedure('public.leer_conexion_google_con_secretos(uuid,uuid)')                     IS NOT NULL
        AND (SELECT count(*) FROM pg_proc p
              JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public'
               AND p.proname IN ('alta_conexion_google','guardar_secretos_conexion','leer_conexion_google_con_secretos')
            ) = 3
       THEN 'OK'
       ELSE 'FALLO: falta alguna firma exacta, o hay una sobrecarga (PostgREST respondería PGRST203)'
  END;

-- C2 · SECURITY DEFINER + search_path fijado, en las tres.
INSERT INTO pg_temp.veredicto_puente
SELECT 102, 'C2 · prosecdef y proconfig con search_path=, en las 3',
  CASE WHEN (SELECT count(*) FROM pg_proc p
              JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public'
               AND p.proname IN ('alta_conexion_google','guardar_secretos_conexion','leer_conexion_google_con_secretos')
               AND p.prosecdef
               AND EXISTS (SELECT 1 FROM unnest(p.proconfig) e WHERE e LIKE 'search_path=%')
            ) = 3
       THEN 'OK'
       ELSE 'FALLO: alguna no es SECURITY DEFINER o no lleva search_path fijado'
  END;

-- C3 · service_role puede ejecutarlas.
INSERT INTO pg_temp.veredicto_puente
SELECT 103, 'C3 · has_function_privilege(service_role, EXECUTE) = true en las 3',
  CASE WHEN (SELECT count(*) FROM (VALUES
               ('public.alta_conexion_google(uuid,uuid,text,text,text,text,text,bigint)'),
               ('public.guardar_secretos_conexion(uuid,uuid,text,text,bigint)'),
               ('public.leer_conexion_google_con_secretos(uuid,uuid)')
             ) AS f(sig)
             WHERE has_function_privilege('service_role', f.sig, 'EXECUTE')) = 3
       THEN 'OK'
       ELSE 'FALLO: service_role NO puede ejecutar alguna de las tres — el puente no abre'
  END;

-- C4 · anon y authenticated NO pueden.
INSERT INTO pg_temp.veredicto_puente
SELECT 104, 'C4 · has_function_privilege(anon/authenticated, EXECUTE) = false en las 6 combinaciones',
  CASE WHEN (SELECT count(*) FROM (VALUES
               ('public.alta_conexion_google(uuid,uuid,text,text,text,text,text,bigint)'),
               ('public.guardar_secretos_conexion(uuid,uuid,text,text,bigint)'),
               ('public.leer_conexion_google_con_secretos(uuid,uuid)')
             ) AS f(sig)
             CROSS JOIN (VALUES ('anon'),('authenticated')) AS r(rol)
             WHERE has_function_privilege(r.rol, f.sig, 'EXECUTE')) = 0
       THEN 'OK'
       ELSE 'FALLO: anon o authenticated pueden ejecutar el puente — ¿faltó el REVOKE antes del GRANT?'
  END;

-- C5 · EL DUEÑO alcanza private. Es la prueba directa de la propiedad que hace
--      funcionar el puente, y no depende de que el rol se llame `postgres`.
INSERT INTO pg_temp.veredicto_puente
SELECT 105, 'C5 · el dueño de las 3 funciones alcanza private.google_conexiones_secretos (S/I/U/D)',
  CASE WHEN (SELECT count(*) FROM pg_proc p
              JOIN pg_namespace n ON n.oid = p.pronamespace
             CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) AS v(priv)
             WHERE n.nspname = 'public'
               AND p.proname IN ('alta_conexion_google','guardar_secretos_conexion','leer_conexion_google_con_secretos')
               AND has_table_privilege(p.proowner::regrole::text, 'private.google_conexiones_secretos', v.priv)
            ) = 12
       THEN 'OK'
       ELSE 'FALLO: el dueño de alguna función NO alcanza la tabla de secretos — se aplicó con el rol equivocado'
  END;

-- C6 · El contador de grants indebidos que ya venía en la migración del 17.
INSERT INTO pg_temp.veredicto_puente
SELECT 106, 'C6 · grants_indebidos sobre private para anon/authenticated = 0',
  CASE WHEN (SELECT count(*) FROM (VALUES ('anon'),('authenticated')) AS r(rol)
             WHERE has_schema_privilege(r.rol, 'private', 'USAGE')
                OR has_table_privilege(r.rol, 'private.google_conexiones_secretos', 'SELECT')) = 0
       THEN 'OK'
       ELSE 'FALLO: anon o authenticated tienen USAGE sobre private o SELECT sobre la tabla'
  END;

-- C7 · authenticated: SELECT sí, y el CONJUNTO COMPLETO restante no. Se
--      comprueba el conjunto entero y no tres verbos elegidos a mano, que es
--      justo como se coló MAINTAIN.
INSERT INTO pg_temp.veredicto_puente
SELECT 107, 'C7 · authenticated sobre clinica_conexiones_google: SELECT sí, el resto del conjunto no',
  CASE WHEN has_table_privilege('authenticated', 'public.clinica_conexiones_google', 'SELECT')
        AND (SELECT count(*) FROM unnest(
               CASE WHEN current_setting('server_version_num')::int >= 170000
                    THEN ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']
                    ELSE ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']
               END) AS v(priv)
             WHERE has_table_privilege('authenticated', 'public.clinica_conexiones_google', v.priv)) = 0
       THEN 'OK'
       ELSE 'FALLO: authenticated no puede leer, o conserva algún privilegio de escritura/mantenimiento'
  END;

-- C8 · anon no tiene NINGÚN privilegio, SELECT incluido.
INSERT INTO pg_temp.veredicto_puente
SELECT 108, 'C8 · anon no tiene ningún privilegio sobre clinica_conexiones_google',
  CASE WHEN (SELECT count(*) FROM unnest(
               CASE WHEN current_setting('server_version_num')::int >= 170000
                    THEN ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']
                    ELSE ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']
               END) AS v(priv)
             WHERE has_table_privilege('anon', 'public.clinica_conexiones_google', v.priv)) = 0
       THEN 'OK'
       ELSE 'FALLO: anon conserva algún privilegio sobre la tabla de conexiones'
  END;

-- C9 · service_role: SELECT, INSERT, UPDATE y DELETE. El SELECT no es
--      decorativo: el comparar-y-cambiar de crearCalendarioSpinus sólo se
--      entera de que perdió la carrera por su .select() (src/lib/gcal.ts:291-294),
--      y la re-lectura de desempate también (:316-320).
INSERT INTO pg_temp.veredicto_puente
SELECT 109, 'C9 · service_role tiene SELECT, INSERT, UPDATE y DELETE sobre clinica_conexiones_google',
  CASE WHEN (SELECT count(*) FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) AS v(priv)
             WHERE has_table_privilege('service_role', 'public.clinica_conexiones_google', v.priv)) = 4
       THEN 'OK'
       ELSE 'FALLO: a service_role le falta algún verbo sobre la tabla de conexiones'
  END;

-- C10 · La columna nueva de appointments es visible para el cliente.
INSERT INTO pg_temp.veredicto_puente
SELECT 110, 'C10 · appointments.gcal_calendar_id visible (attacl IS NULL y SELECT para authenticated)',
  CASE WHEN (SELECT a.attacl IS NULL FROM pg_attribute a
              WHERE a.attrelid = 'public.appointments'::regclass
                AND a.attname  = 'gcal_calendar_id'
                AND NOT a.attisdropped)
        AND has_column_privilege('authenticated', 'public.appointments', 'gcal_calendar_id', 'SELECT')
       THEN 'OK'
       ELSE 'FALLO: la columna tiene ACL propio o authenticated no la ve'
  END;

-- C11 · Los COMMENT corregidos están puestos.
INSERT INTO pg_temp.veredicto_puente
SELECT 111, 'C11 · los COMMENT de private ya no documentan la avería como diseño',
  CASE WHEN coalesce(obj_description('private'::regnamespace, 'pg_namespace'), '') NOT LIKE '%bypasea RLS%'
        AND coalesce(obj_description('private'::regnamespace, 'pg_namespace'), '') LIKE '%20260818_gcal_puente_secretos%'
        AND coalesce(obj_description('private.google_conexiones_secretos'::regclass, 'pg_class'), '') LIKE '%20260818_gcal_puente_secretos%'
       THEN 'OK'
       ELSE 'FALLO: los COMMENT no se actualizaron'
  END;

-- ── R1 · service_role lee la conexión con sus secretos ──────────────────────
DO $do$
DECLARE
  v_conexion uuid; v_clinica uuid; v_n int; v_secretos boolean; v_hay_token boolean;
BEGIN
  SELECT s.conexion_id, s.clinica_id INTO v_conexion, v_clinica FROM pg_temp.sujeto_puente s;
  IF v_conexion IS NULL THEN
    INSERT INTO pg_temp.veredicto_puente VALUES (201, 'R1 · service_role → leer_conexion_google_con_secretos devuelve 1 fila con secretos',
      'NO PROBADO — no hay conexiones en esta base');
    RETURN;
  END IF;

  SET LOCAL ROLE service_role;
  IF current_user <> 'service_role' THEN
    RESET ROLE;
    RAISE EXCEPTION 'VEREDICTO R1: el SET LOCAL ROLE no surtió efecto (current_user=%). Se estaría comprobando el rol equivocado; ¿se pegó esta sección fuera del bloque de transacción?', current_user;
  END IF;

  -- Los valores NO se imprimen, ni truncados: sólo se cuentan y se comprueban.
  SELECT count(*), bool_or(r.tiene_secretos), bool_or(r.access_token IS NOT NULL)
    INTO v_n, v_secretos, v_hay_token
    FROM public.leer_conexion_google_con_secretos(v_clinica, v_conexion) r;

  RESET ROLE;

  INSERT INTO pg_temp.veredicto_puente VALUES (201,
    'R1 · service_role → leer_conexion_google_con_secretos devuelve 1 fila con secretos',
    CASE WHEN v_n = 1 AND v_secretos AND v_hay_token THEN 'OK'
         ELSE format('FALLO: filas=%s, tiene_secretos=%s, access_token no nulo=%s', v_n, v_secretos, v_hay_token) END);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RAISE;
END $do$;

-- ── R2 · el filtro de clínica muerde en la lectura ──────────────────────────
DO $do$
DECLARE v_conexion uuid; v_n int;
BEGIN
  SELECT s.conexion_id INTO v_conexion FROM pg_temp.sujeto_puente s;
  IF v_conexion IS NULL THEN
    INSERT INTO pg_temp.veredicto_puente VALUES (202, 'R2 · leer con una clinica_id ajena devuelve 0 filas',
      'NO PROBADO — no hay conexiones en esta base');
    RETURN;
  END IF;

  SET LOCAL ROLE service_role;
  IF current_user <> 'service_role' THEN
    RESET ROLE;
    RAISE EXCEPTION 'VEREDICTO R2: el SET LOCAL ROLE no surtió efecto (current_user=%).', current_user;
  END IF;

  SELECT count(*) INTO v_n
    FROM public.leer_conexion_google_con_secretos(gen_random_uuid(), v_conexion) r;

  RESET ROLE;

  INSERT INTO pg_temp.veredicto_puente VALUES (202,
    'R2 · leer con una clinica_id ajena devuelve 0 filas',
    CASE WHEN v_n = 0 THEN 'OK'
         ELSE format('FALLO: devolvió %s filas desde una clínica ajena — el aislamiento no muerde', v_n) END);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RAISE;
END $do$;

-- ── R3 · el COALESCE del refresh, probado de verdad y deshecho ──────────────
DO $do$
DECLARE
  v_conexion uuid; v_clinica uuid;
  v_refresh_antes text; v_refresh_despues text; v_access_despues text; v_res text;
BEGIN
  SELECT s.conexion_id, s.clinica_id INTO v_conexion, v_clinica FROM pg_temp.sujeto_puente s;
  IF v_conexion IS NULL THEN
    INSERT INTO pg_temp.veredicto_puente VALUES (203, 'R3 · guardar_secretos_conexion con p_refresh NULL no borra el refresh_token',
      'NO PROBADO — no hay conexiones en esta base');
    RETURN;
  END IF;

  -- Digest, no valor: así ni siquiera queda un token dentro de una variable que
  -- pudiera acabar en un mensaje de error.
  SELECT md5(coalesce(s.refresh_token, '')) INTO v_refresh_antes
    FROM private.google_conexiones_secretos s WHERE s.conexion_id = v_conexion;

  BEGIN
    SET LOCAL ROLE service_role;
    IF current_user <> 'service_role' THEN
      RAISE EXCEPTION 'VEREDICTO R3: el SET LOCAL ROLE no surtió efecto (current_user=%).', current_user;
    END IF;

    -- DIVERGENCIA CON LA ESPECIFICACIÓN (brief §6.3, R3): el brief dice «se pasa
    -- el access_token actual». Se pasa un marcador en su lugar. Con el valor
    -- actual no hay forma de distinguir «escribió lo mismo» de «no escribió
    -- nada», y entonces la afirmación no probaría la rama DO UPDATE. Con el
    -- marcador se prueban las dos mitades: que el access_token SÍ cambia y que
    -- el refresh_token NO. Todo se deshace igual.
    PERFORM public.guardar_secretos_conexion(v_clinica, v_conexion, 'sonda-r3-access', NULL, NULL);

    RESET ROLE;

    SELECT md5(coalesce(s.refresh_token, '')), s.access_token
      INTO v_refresh_despues, v_access_despues
      FROM private.google_conexiones_secretos s WHERE s.conexion_id = v_conexion;

    v_res := CASE
      WHEN v_refresh_despues IS DISTINCT FROM v_refresh_antes
        THEN 'FALLO: p_refresh NULL cambió el refresh_token — el COALESCE no está'
      WHEN v_access_despues IS DISTINCT FROM 'sonda-r3-access'
        THEN 'FALLO: la rama DO UPDATE no escribió el access_token'
      ELSE 'OK'
    END;

    RAISE EXCEPTION 'centinela' USING ERRCODE = 'ZX001';
  EXCEPTION WHEN sqlstate 'ZX001' THEN
    RESET ROLE;
    INSERT INTO pg_temp.veredicto_puente VALUES (203,
      'R3 · guardar_secretos_conexion con p_refresh NULL no borra el refresh_token', v_res);
  END;
END $do$;

-- ── R4 · el alta es un upsert que no destruye, probada y deshecha ───────────
DO $do$
DECLARE
  v_conexion uuid; v_clinica uuid; v_user uuid; v_ok_perfil boolean;
  v_n_antes int; v_n_despues int;
  v_cal_antes text; v_cal_despues text;
  v_secretos int; v_res text;
BEGIN
  SELECT s.conexion_id, s.clinica_id, s.user_id, s.dueno_con_perfil
    INTO v_conexion, v_clinica, v_user, v_ok_perfil
    FROM pg_temp.sujeto_puente s;

  IF v_conexion IS NULL THEN
    INSERT INTO pg_temp.veredicto_puente VALUES (204, 'R4 · alta_conexion_google reconecta sin duplicar ni pisar calendar_id',
      'NO PROBADO — no hay conexiones en esta base');
    RETURN;
  END IF;
  IF NOT v_ok_perfil THEN
    INSERT INTO pg_temp.veredicto_puente VALUES (204, 'R4 · alta_conexion_google reconecta sin duplicar ni pisar calendar_id',
      'NO PROBADO — el dueño de la conexión no tiene perfil en esa clínica; la guarda 1 lo rechazaría por un motivo ajeno a lo que se prueba');
    RETURN;
  END IF;

  SELECT count(*) INTO v_n_antes FROM public.clinica_conexiones_google;
  SELECT c.calendar_id INTO v_cal_antes FROM public.clinica_conexiones_google c WHERE c.id = v_conexion;

  BEGIN
    SET LOCAL ROLE service_role;
    IF current_user <> 'service_role' THEN
      RAISE EXCEPTION 'VEREDICTO R4: el SET LOCAL ROLE no surtió efecto (current_user=%).', current_user;
    END IF;

    PERFORM * FROM public.alta_conexion_google(
      v_clinica, v_user, 'clinica', NULL, NULL, 'sonda-r4-access', NULL, NULL);

    RESET ROLE;

    SELECT count(*) INTO v_n_despues FROM public.clinica_conexiones_google;
    SELECT c.calendar_id INTO v_cal_despues FROM public.clinica_conexiones_google c WHERE c.id = v_conexion;
    SELECT count(*) INTO v_secretos FROM private.google_conexiones_secretos s WHERE s.conexion_id = v_conexion;

    v_res := CASE
      WHEN v_n_despues <> v_n_antes
        THEN format('FALLO: creó fila nueva (%s → %s) en vez de reconectar', v_n_antes, v_n_despues)
      WHEN v_cal_despues IS DISTINCT FROM v_cal_antes
        THEN 'FALLO: la reconexión pisó calendar_id — el calendario anterior quedaría huérfano'
      WHEN v_secretos <> 1
        THEN format('FALLO: la conexión quedó con %s filas de secretos', v_secretos)
      ELSE 'OK'
    END;

    RAISE EXCEPTION 'centinela' USING ERRCODE = 'ZX001';
  EXCEPTION WHEN sqlstate 'ZX001' THEN
    RESET ROLE;
    INSERT INTO pg_temp.veredicto_puente VALUES (204,
      'R4 · alta_conexion_google reconecta sin duplicar ni pisar calendar_id', v_res);
  END;
END $do$;

-- ── R5 · el ON DELETE CASCADE del disconnect, probado y deshecho ────────────
-- Es el único camino DESTRUCTIVO y ninguna de las trece afirmaciones originales
-- lo tocaba. Si el cascade no disparase, el disconnect dejaría tokens cifrados
-- huérfanos en private para siempre y nadie se enteraría: el DELETE del padre
-- habría tenido éxito.
DO $do$
DECLARE v_conexion uuid; v_quedan int; v_res text;
BEGIN
  SELECT s.conexion_id INTO v_conexion FROM pg_temp.sujeto_puente s;
  IF v_conexion IS NULL THEN
    INSERT INTO pg_temp.veredicto_puente VALUES (205, 'R5 · borrar la conexión como service_role arrastra sus secretos (ON DELETE CASCADE)',
      'NO PROBADO — no hay conexiones en esta base');
    RETURN;
  END IF;

  BEGIN
    SET LOCAL ROLE service_role;
    IF current_user <> 'service_role' THEN
      RAISE EXCEPTION 'VEREDICTO R5: el SET LOCAL ROLE no surtió efecto (current_user=%).', current_user;
    END IF;

    DELETE FROM public.clinica_conexiones_google c WHERE c.id = v_conexion;

    RESET ROLE;

    SELECT count(*) INTO v_quedan
      FROM private.google_conexiones_secretos s WHERE s.conexion_id = v_conexion;

    v_res := CASE WHEN v_quedan = 0 THEN 'OK'
                  ELSE 'FALLO: el cascade no disparó; el disconnect dejaría tokens huérfanos en private' END;

    RAISE EXCEPTION 'centinela' USING ERRCODE = 'ZX001';
  EXCEPTION WHEN sqlstate 'ZX001' THEN
    RESET ROLE;
    INSERT INTO pg_temp.veredicto_puente VALUES (205,
      'R5 · borrar la conexión como service_role arrastra sus secretos (ON DELETE CASCADE)', v_res);
  END;
END $do$;

-- ── R6 · service_role NO alcanza private por la puerta directa ──────────────
-- La afirmación que justifica no conceder USAGE ON SCHEMA private. La propuesta
-- original la declaraba en prosa y luego no la comprobaba.
DO $do$
DECLARE v_res text;
BEGIN
  BEGIN
    SET LOCAL ROLE service_role;
    IF current_user <> 'service_role' THEN
      RESET ROLE;
      RAISE EXCEPTION 'VEREDICTO R6: el SET LOCAL ROLE no surtió efecto (current_user=%).', current_user;
    END IF;
    PERFORM 1 FROM private.google_conexiones_secretos LIMIT 1;
    RESET ROLE;
    v_res := 'FALLO: service_role SÍ alcanza private directamente — alguien concedió USAGE o privilegios de tabla';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    v_res := 'OK — denegado, como debe ser';
  END;
  INSERT INTO pg_temp.veredicto_puente VALUES (206,
    'R6 · service_role NO puede leer private.google_conexiones_secretos directamente', v_res);
END $do$;

-- ── R7 · authenticated tampoco ──────────────────────────────────────────────
DO $do$
DECLARE v_res text;
BEGIN
  BEGIN
    SET LOCAL ROLE authenticated;
    IF current_user <> 'authenticated' THEN
      RESET ROLE;
      RAISE EXCEPTION 'VEREDICTO R7: el SET LOCAL ROLE no surtió efecto (current_user=%).', current_user;
    END IF;
    PERFORM 1 FROM private.google_conexiones_secretos LIMIT 1;
    RESET ROLE;
    v_res := 'FALLO: authenticated alcanza la tabla de tokens';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    v_res := 'OK — denegado, como debe ser';
  END;
  INSERT INTO pg_temp.veredicto_puente VALUES (207,
    'R7 · authenticated NO puede leer private.google_conexiones_secretos', v_res);
END $do$;

-- ── R8 · la policy de SELECT enseña lo propio y sólo lo propio ──────────────
DO $do$
DECLARE v_perfil uuid; v_clinica uuid; v_visibles int; v_esperadas int; v_res text;
BEGIN
  SELECT s.perfil_id, s.clinica_id INTO v_perfil, v_clinica FROM pg_temp.sujeto_puente s;
  IF v_perfil IS NULL THEN
    INSERT INTO pg_temp.veredicto_puente VALUES (208, 'R8 · authenticated ve bajo su policy las conexiones de su clínica y ninguna más',
      'NO PROBADO — no hay perfil con clínica y conexión en esta base');
    RETURN;
  END IF;

  SELECT count(*) INTO v_esperadas
    FROM public.clinica_conexiones_google c WHERE c.clinica_id = v_clinica;

  BEGIN
    -- La simulación satisface a public.get_clinica_id(): es SECURITY DEFINER,
    -- LANGUAGE sql, y su cuerpo es `SELECT clinica_id FROM profiles WHERE
    -- id = auth.uid()`; auth.uid() lee request.jwt.claims.
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_perfil)::text, true);
    SET LOCAL ROLE authenticated;
    IF current_user <> 'authenticated' THEN
      RAISE EXCEPTION 'VEREDICTO R8: el SET LOCAL ROLE no surtió efecto (current_user=%).', current_user;
    END IF;

    SELECT count(*) INTO v_visibles FROM public.clinica_conexiones_google;

    -- DIVERGENCIA CON LA ESPECIFICACIÓN (brief §6.3, R8): el brief pide «ve
    -- exactamente 1 fila». Se compara contra las filas de SU clínica en vez de
    -- contra el literal 1, porque el esquema permite a propósito varias
    -- conexiones por clínica (una 'clinica' y N 'personal', para el relevo de
    -- administrador), y con el literal esta afirmación se pondría roja sola el
    -- día del primer relevo. Lo que se prueba —ve las suyas y ninguna ajena— es
    -- lo mismo, y así no caduca.
    v_res := CASE
      WHEN v_visibles = v_esperadas AND v_visibles >= 1 THEN 'OK'
      WHEN v_visibles > v_esperadas THEN format('FALLO: ve %s filas y su clínica sólo tiene %s — la policy filtra de menos', v_visibles, v_esperadas)
      ELSE format('FALLO: ve %s filas de las %s de su clínica', v_visibles, v_esperadas)
    END;

    RAISE EXCEPTION 'centinela' USING ERRCODE = 'ZX001';
  EXCEPTION WHEN sqlstate 'ZX001' THEN
    -- El claim es transaccional: si no se limpia, los bloques siguientes lo
    -- verían. La subtransacción ya lo deshace; esto es el cinturón.
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    INSERT INTO pg_temp.veredicto_puente VALUES (208,
      'R8 · authenticated ve bajo su policy las conexiones de su clínica y ninguna más', v_res);
  END;
END $do$;

-- ── R9 · authenticated no puede llamar al puente ────────────────────────────
-- Complementa C4 con alcance real: has_function_privilege puede decir la verdad
-- y aun así no ser lo que ocurre.
DO $do$
DECLARE v_res text;
BEGIN
  BEGIN
    SET LOCAL ROLE authenticated;
    IF current_user <> 'authenticated' THEN
      RESET ROLE;
      RAISE EXCEPTION 'VEREDICTO R9: el SET LOCAL ROLE no surtió efecto (current_user=%).', current_user;
    END IF;
    PERFORM * FROM public.leer_conexion_google_con_secretos(gen_random_uuid(), gen_random_uuid());
    RESET ROLE;
    v_res := 'FALLO: authenticated ejecutó el puente — los tokens son alcanzables desde una sesión de cliente';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    v_res := 'OK — denegado, como debe ser';
  END;
  INSERT INTO pg_temp.veredicto_puente VALUES (209,
    'R9 · authenticated NO puede ejecutar leer_conexion_google_con_secretos', v_res);
END $do$;

-- ── Cierre: el rol volvió, y nada salió en rojo ─────────────────────────────
DO $do$
DECLARE v_fallos text; v_reservas int;
BEGIN
  -- DIVERGENCIA CON LA ESPECIFICACIÓN (brief §6.1): el brief pide afirmar
  -- current_user = 'postgres'. Se compara contra session_user, que es la misma
  -- pregunta —«¿me quedé con un rol puesto?»— sin clavar el nombre del rol que
  -- aplica la migración.
  IF current_user <> session_user THEN
    RAISE EXCEPTION 'VEREDICTO: la transacción sigue con un rol puesto (current_user=%, session_user=%). Los GRANT de arriba pudieron correr con el rol equivocado.',
      current_user, session_user;
  END IF;

  SELECT string_agg(format('[%s] %s → %s', v.orden, v.afirmacion, v.resultado), chr(10) ORDER BY v.orden)
    INTO v_fallos
    FROM pg_temp.veredicto_puente v WHERE v.resultado LIKE 'FALLO%';

  IF v_fallos IS NOT NULL THEN
    RAISE EXCEPTION E'VEREDICTO EN ROJO — no se aplica nada:\n%', v_fallos;
  END IF;

  SELECT count(*) INTO v_reservas
    FROM pg_temp.veredicto_puente v WHERE v.resultado LIKE 'NO PROBADO%';

  INSERT INTO pg_temp.veredicto_puente VALUES (900, 'VEREDICTO',
    CASE WHEN v_reservas > 0
      THEN format('OK CON RESERVAS — %s afirmaciones sin sujeto en esta base. FALTA LO QUE DECIDE: npx tsx scripts/gcal-puente-humo.ts', v_reservas)
      ELSE 'OK — las 20 en verde. FALTA LO QUE DECIDE: npx tsx scripts/gcal-puente-humo.ts, y sólo entonces el deploy.'
    END);
END $do$;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- 9. LA REJILLA
-- ════════════════════════════════════════════════════════════════════════════
-- Cinturón: un SET ROLE no-LOCAL sobreviviría al COMMIT.
RESET ROLE;

-- Última sentencia del archivo a propósito: el editor de Supabase muestra el
-- resultado de la última, y no muestra RAISE NOTICE de forma fiable.
SELECT v.orden, v.afirmacion, v.resultado
  FROM pg_temp.veredicto_puente v
 ORDER BY v.orden;
