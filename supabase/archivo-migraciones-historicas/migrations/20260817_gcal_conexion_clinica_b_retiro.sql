-- ============================================================================
-- PENDIENTE DE APLICAR — parte B de 2. La ejecuta Angel a mano.
-- ============================================================================
-- Conexión de Google POR CLÍNICA — RETIRO DE public.google_tokens
--
-- ⚠️ ORDEN OBLIGATORIO. Este archivo va DESPUÉS de que el código nuevo esté en
--    producción Y DESPUÉS de un periodo de reposo. Aplicarlo antes deja al
--    código vivo escribiendo contra una tabla que ya no está en `public`: el
--    alta de citas revienta dentro de `after()`, donde el error se traga y
--    sólo deja una línea de log.
--
--    Runbook:
--      1. Archivo A aplicado y verificado (veredicto OK en la rejilla).
--      2. Deploy del código nuevo. Durante esta etapa el código escribe en
--         LAS DOS fuentes: google_tokens y clinica_conexiones_google +
--         private.google_conexiones_secretos.
--      3. Periodo de reposo: dejar correr la doble escritura el tiempo que
--         haga falta para que al menos una reconexión y un refresh de token
--         hayan pasado por el camino nuevo. Esto NO se puede comprobar desde
--         SQL —google_tokens no guarda cuándo se escribió cada fila—; es
--         responsabilidad del operador. La comprobación de divergencia de
--         abajo verifica que las dos fuentes coinciden, no cuánto llevan
--         coincidiendo.
--      4. Deploy que CORTA la doble escritura: el código deja de tocar
--         google_tokens. Esto es código, no SQL, y no está en este archivo.
--      5. Snapshot del proyecto en el panel de Supabase.
--      6. Aplicar ESTE archivo.
--
-- ── QUÉ HACE ────────────────────────────────────────────────────────────────
--   · Comprueba que las dos fuentes coinciden y ABORTA si no.
--   · Retira public.google_tokens al esquema `respaldos`. NO la dropea:
--     mientras la tabla exista, revertir el corte es un ALTER TABLE.
--
--   No se borra ni una fila. No se toca appointments.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout      = '5s';
SET LOCAL statement_timeout = '60s';

-- ════════════════════════════════════════════════════════════════════════════
-- 1. GUARDA DE UN SOLO DISPARO
-- ════════════════════════════════════════════════════════════════════════════
-- Un replay tiene que ser un fallo ruidoso, no un no-op silencioso: si la
-- tabla ya se retiró y alguien vuelve a correr esto, conviene que se entere.
DO $$
BEGIN
  IF to_regclass('respaldos.google_tokens_20260817') IS NOT NULL THEN
    RAISE EXCEPTION
      'ABORTADO: este archivo ya se aplicó (existe respaldos.google_tokens_20260817). No hay nada que retirar.';
  END IF;

  IF to_regclass('public.google_tokens') IS NULL THEN
    RAISE EXCEPTION
      'ABORTADO: public.google_tokens no existe y tampoco está el respaldo esperado. Alguien la retiró por otro camino: averigua cuál antes de seguir.';
  END IF;

  -- Sin las tablas nuevas no hay contra qué comparar, y retirar google_tokens
  -- dejaría a la app sin ninguna fuente de tokens.
  IF to_regclass('public.clinica_conexiones_google') IS NULL
     OR to_regclass('private.google_conexiones_secretos') IS NULL THEN
    RAISE EXCEPTION
      'ABORTADO: faltan las tablas del corte A. Aplica primero 20260817_gcal_conexion_clinica_a_esquema.sql.';
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. COMPROBACIÓN DE DIVERGENCIA — aborta antes de retirar nada
-- ════════════════════════════════════════════════════════════════════════════
-- Qué se compara y qué NO, y por qué:
--
--   SE COMPARA (y aborta):
--     · El conjunto de user_id, en las dos direcciones. Un usuario en una
--       fuente y no en la otra significa que la doble escritura tiene un
--       agujero: retirar google_tokens perdería esa conexión.
--     · Que cada conexión tenga su fila de secretos.
--     · calendar_id, expires_at, y si refresh_token es NULL o no.
--
--   NO SE COMPARA byte a byte el contenido de access_token / refresh_token,
--   y esto NO es pereza: `encrypt()` (src/lib/encrypt.ts:19) usa AES-256-GCM
--   con un IV ALEATORIO por llamada, así que cifrar dos veces el mismo token
--   produce dos strings distintos. La igualdad de bytes sólo se sostiene si el
--   código cifra UNA vez y escribe el MISMO string en las dos fuentes; si
--   cifra por separado para cada una, los bytes difieren SIEMPRE y una
--   comprobación así sería una falsa alarma permanente.
--
--   `expires_at` hace de sustituto honesto: el refresh de un access_token
--   reescribe siempre los dos campos a la vez, así que dos `expires_at`
--   iguales significan, en la práctica, tokens de la misma generación. La
--   igualdad de bytes se reporta como columna INFORMATIVA en el veredicto,
--   sin abortar.
--
--   POR QUÉ EL SUSTITUTO CUBRE HOY: todos los caminos que escriben en
--   google_tokens tocan al menos un campo comparado —el upsert del callback
--   (access + refresh + expires_at, api/google/callback/route.ts:66), el
--   refresh de `abrirSesionGoogle` (access + expires_at, src/lib/gcal.ts:192),
--   el comparar-y-cambiar de `crearCalendarioSpinus` (calendar_id, :317), el
--   borrado de calendario (calendar_id, api/google/calendar/route.ts:153) y el
--   disconnect (borra la fila, api/google/disconnect/route.ts:9)—. No queda
--   ninguna escritura invisible para esta comprobación.
--
--   ⚠️ CONTRATO QUE EL DEPLOY DEBE CUMPLIR PARA QUE SIGA CUBRIENDO: la doble
--      escritura tiene que mover `expires_at` en el MISMO paso que
--      `access_token`, y `calendar_id` en las dos fuentes a la vez. Si algún
--      camino nuevo escribe un token sin tocar `expires_at`, esta comprobación
--      pasa en verde sobre fuentes divergentes.
--
--   LO QUE AUN ASÍ SE COLARÍA, y sólo se vería con la tabla vieja ya retirada:
--     · Dos ciphertexts con el mismo `expires_at` que descifran a tokens
--       DISTINTOS (el deploy escribiendo generaciones distintas en cada
--       fuente en la misma operación). Después del corte, la app usa la copia
--       nueva: si es la vieja de las dos, Google contesta 401 y el código no
--       tiene camino de «401 ⇒ refresca ya» —sólo refresca cuando
--       `Date.now() > expires_at`—, así que el médico queda en 'error_google'
--       sin que nada le pida reconectar.
--     · Dos `refresh_token` ambos no nulos pero de generaciones distintas: la
--       nulidad coincide y los bytes no se comparan. Si la copia nueva lleva
--       uno revocado, el primer refresh contesta `invalid_grant`, que el
--       código sí lee como 'sin_token' y sí pide reconectar. Ruidoso.
--     · Una rotación de GOOGLE_TOKEN_SECRET entre el corte A y éste: las dos
--       copias quedan igual de indescifrables y la comprobación no ve nada.
--       La clave no está en la base; esto NO es detectable desde SQL.
--   Para las tres, la red de seguridad es la misma y por eso este archivo
--   MUEVE la tabla en vez de dropearla: recuperar es un INSERT ... SELECT
--   desde respaldos.google_tokens_20260817.
DO $$
DECLARE
  v_detalle text;
BEGIN
  -- ── 2.1 Tokens sin conexión ───────────────────────────────────────────────
  SELECT string_agg(gt.user_id::text, ', ' ORDER BY gt.user_id::text)
    INTO v_detalle
    FROM public.google_tokens gt
   WHERE NOT EXISTS (
           SELECT 1 FROM public.clinica_conexiones_google c
            WHERE c.user_id = gt.user_id);

  IF v_detalle IS NOT NULL THEN
    RAISE EXCEPTION
      'ABORTADO: hay filas en google_tokens sin conexión equivalente (user_id: %). Retirar la tabla perdería esas conexiones. Revisa por qué la doble escritura no las cubrió.',
      v_detalle;
  END IF;

  -- ── 2.2 Conexiones sin token ──────────────────────────────────────────────
  -- Durante la doble escritura, toda conexión nueva debía escribirse también
  -- en google_tokens. Una conexión sin fila allí significa que el corte de la
  -- doble escritura se hizo antes de tiempo, o que hubo una escritura parcial.
  -- No impide retirar la tabla, pero sí significa que la comparación de abajo
  -- no cubre a todo el mundo: mejor enterarse ahora.
  SELECT string_agg(c.user_id::text, ', ' ORDER BY c.user_id::text)
    INTO v_detalle
    FROM public.clinica_conexiones_google c
   WHERE NOT EXISTS (
           SELECT 1 FROM public.google_tokens gt
            WHERE gt.user_id = c.user_id);

  IF v_detalle IS NOT NULL THEN
    RAISE EXCEPTION
      'ABORTADO: hay conexiones sin fila en google_tokens (user_id: %). La doble escritura no estaba completa; el estado de esas conexiones no se puede contrastar contra nada.',
      v_detalle;
  END IF;

  -- ── 2.3 Divergencia de contenido ──────────────────────────────────────────
  SELECT string_agg(
           format('%s[%s]', c.user_id,
             concat_ws('+',
               CASE WHEN s.conexion_id IS NULL                             THEN 'sin_secreto'   END,
               CASE WHEN c.calendar_id  IS DISTINCT FROM gt.calendar_id    THEN 'calendar_id'   END,
               CASE WHEN s.expires_at   IS DISTINCT FROM gt.expires_at     THEN 'expires_at'    END,
               CASE WHEN (s.refresh_token IS NULL) IS DISTINCT FROM (gt.refresh_token IS NULL)
                                                                           THEN 'refresh_token' END)),
           ' | ' ORDER BY c.user_id::text)
    INTO v_detalle
    FROM public.clinica_conexiones_google c
    JOIN public.google_tokens gt ON gt.user_id = c.user_id
    LEFT JOIN private.google_conexiones_secretos s ON s.conexion_id = c.id
   WHERE s.conexion_id IS NULL
      OR c.calendar_id IS DISTINCT FROM gt.calendar_id
      OR s.expires_at  IS DISTINCT FROM gt.expires_at
      OR (s.refresh_token IS NULL) IS DISTINCT FROM (gt.refresh_token IS NULL);

  IF v_detalle IS NOT NULL THEN
    RAISE EXCEPTION
      'ABORTADO: las dos fuentes divergen. Entre corchetes, qué difiere en cada usuario: %. Corrige la fuente nueva (es la que se queda) antes de retirar la vieja.',
      v_detalle;
  END IF;

  -- ── 2.4 Forma del ciphertext en la copia que se queda ─────────────────────
  -- Lo único que se puede verificar de un token sin tener la clave: que
  -- PAREZCA salida de encrypt(). El formato es `iv:authTag:ciphertext` en hex
  -- (src/lib/encrypt.ts:23), con iv de 12 bytes → 24 hex y authTag de 16 bytes
  -- → 32 hex.
  --
  -- Esto no es ceremonia: `decrypt()` devuelve NULL EN SILENCIO ante cualquier
  -- valor que no cuadre —formato malo, clave que no abre, valor legado sin
  -- cifrar— (src/lib/encrypt.ts:30-47), y aguas arriba un token indescifrable
  -- se ve exactamente igual que «este médico nunca conectó». Sin esta
  -- comprobación, un token guardado en claro por error, truncado, o cifrado
  -- dos veces, cruza el corte sin que nada lo diga y sólo se manifiesta
  -- cuando la tabla vieja ya no está.
  --
  -- Se comprueba la copia NUEVA, que es la que se queda. Un token en claro
  -- aquí sería además un hallazgo de seguridad, no sólo de integridad.
  SELECT string_agg(
           format('%s[%s]', c.user_id,
             concat_ws('+',
               CASE WHEN s.access_token !~ '^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$'
                    THEN 'access_token' END,
               CASE WHEN s.refresh_token IS NOT NULL
                     AND s.refresh_token !~ '^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$'
                    THEN 'refresh_token' END)),
           ' | ' ORDER BY c.user_id::text)
    INTO v_detalle
    FROM private.google_conexiones_secretos s
    JOIN public.clinica_conexiones_google c ON c.id = s.conexion_id
   WHERE s.access_token !~ '^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$'
      OR (s.refresh_token IS NOT NULL
          AND s.refresh_token !~ '^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$');

  IF v_detalle IS NOT NULL THEN
    RAISE EXCEPTION
      'ABORTADO: hay secretos que no tienen forma de salida de encrypt() (iv:authTag:ciphertext en hex). Entre corchetes, qué campo en cada usuario: %. Un valor así lo lee decrypt() como NULL en silencio y la app lo confunde con «sin conexión». Averigua qué lo escribió antes de retirar la fuente vieja, que es de donde se recupera.',
      v_detalle;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. RETIRO — mover, no dropear
-- ════════════════════════════════════════════════════════════════════════════
-- NO en `public`: Supabase concede por default a anon/authenticated sobre las
-- tablas de ese esquema y PostgREST lo expone entero. Una tabla de tokens ahí
-- —aunque estén cifrados— es superficie que no hace falta.
-- El esquema ya existe desde 20260815_gcal_calendario_propio_b_datos.sql:62;
-- se repiten CREATE/REVOKE por si este archivo se replayea sobre una base
-- creada desde el baseline.
CREATE SCHEMA IF NOT EXISTS respaldos;
REVOKE ALL ON SCHEMA respaldos FROM anon, authenticated;

-- SET SCHEMA y no DROP: mientras la tabla exista, deshacer el corte es un
-- ALTER TABLE y no una restauración de snapshot. Se lleva consigo sus
-- índices, su FK a auth.users y sus policies de RLS, que quedan inertes
-- porque nadie puede alcanzar el esquema.
--
-- ACCESS EXCLUSIVE sobre google_tokens durante el cambio de nombre. Es
-- instantáneo y, a estas alturas, ya no la lee nadie.
ALTER TABLE public.google_tokens SET SCHEMA respaldos;
ALTER TABLE respaldos.google_tokens RENAME TO google_tokens_20260817;

REVOKE ALL ON respaldos.google_tokens_20260817 FROM anon, authenticated;

COMMENT ON TABLE respaldos.google_tokens_20260817 IS
  'public.google_tokens tal como quedó al retirarla (2026-08-17), sustituida por public.clinica_conexiones_google + private.google_conexiones_secretos. Se conserva por si hay que revertir el corte: ALTER TABLE ... RENAME TO google_tokens; ALTER TABLE ... SET SCHEMA public.';

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. VEREDICTO — en la rejilla de resultados
-- ════════════════════════════════════════════════════════════════════════════
-- El SQL Editor de Supabase no muestra de forma fiable RAISE NOTICE ni
-- RAISE WARNING. Última sentencia del archivo a propósito.
--
-- `secretos_byte_identicos` es INFORMATIVA, no un criterio de éxito: por el IV
-- aleatorio de encrypt() (ver sección 2), que sea menor que `conexiones` sólo
-- dice que el código cifró por separado para cada fuente. Que sea igual dice
-- que cifró una vez y copió. Ninguna de las dos cosas es un fallo.
WITH m AS (
  SELECT
    (SELECT to_regclass('public.google_tokens') IS NULL)                     AS retirada,
    (SELECT count(*) FROM respaldos.google_tokens_20260817)                  AS filas_respaldadas,
    (SELECT count(*) FROM public.clinica_conexiones_google)                  AS conexiones,
    (SELECT count(*) FROM private.google_conexiones_secretos)                AS secretos,
    (SELECT count(*) FROM public.clinica_conexiones_google
      WHERE rol = 'clinica')                                                 AS de_clinica,
    (SELECT count(DISTINCT clinica_id) FROM public.clinica_conexiones_google) AS clinicas,
    (SELECT count(*)
       FROM public.clinica_conexiones_google c
       JOIN respaldos.google_tokens_20260817 gt ON gt.user_id = c.user_id
       JOIN private.google_conexiones_secretos s ON s.conexion_id = c.id
      WHERE s.access_token = gt.access_token
        AND s.refresh_token IS NOT DISTINCT FROM gt.refresh_token)           AS secretos_byte_identicos,
    -- has_*_privilege y no information_schema.role_table_grants: esa vista
    -- sólo muestra los grants de roles de los que el usuario actual es
    -- miembro, así que puede devolver 0 por no ver, no por no haber.
    (SELECT count(*) FROM (VALUES ('anon'),('authenticated')) AS r(rol)
      WHERE has_schema_privilege(r.rol, 'respaldos', 'USAGE')
         OR has_table_privilege(r.rol, 'respaldos.google_tokens_20260817', 'SELECT')) AS grants_indebidos
)
SELECT m.*,
       CASE
         WHEN NOT m.retirada THEN
           'REVISAR: public.google_tokens sigue existiendo. El retiro no se aplicó.'
         WHEN m.filas_respaldadas <> m.conexiones THEN
           'REVISAR: ' || m.filas_respaldadas || ' filas respaldadas frente a ' || m.conexiones || ' conexiones. No cuadran.'
         WHEN m.secretos <> m.conexiones THEN
           'REVISAR: ' || m.conexiones || ' conexiones y ' || m.secretos || ' secretos. Hay conexiones sin token y la fuente vieja ya no está en public.'
         WHEN m.de_clinica <> m.clinicas THEN
           'REVISAR: ' || m.clinicas || ' clínicas con conexión pero ' || m.de_clinica || ' conexiones de clínica.'
         WHEN m.grants_indebidos > 0 THEN
           'REVISAR: el respaldo tiene ' || m.grants_indebidos || ' grants para anon/authenticated.'
         ELSE
           'OK — google_tokens retirada a respaldos.google_tokens_20260817. La única fuente de conexiones es ahora clinica_conexiones_google + private.google_conexiones_secretos.'
       END AS veredicto
  FROM m;
