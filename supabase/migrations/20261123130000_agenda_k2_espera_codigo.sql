-- ═══════════════════════════════════════════════════════════════════════
-- Agenda · tanda K, agente K2 (punto 10 de Angel) — cuánto falta para
-- volver a pedir el código, y el código de un correo anterior no cuenta
-- como equivocado
-- Rama: feature/agenda-v2-k2 · Escrita: 2026-11-18
-- Riesgo estimado: BAJO (una función nueva de sólo lectura, sólo
-- service_role; CREATE OR REPLACE de reserva_codigo_verificar con UNA rama
-- más, que no escribe. Ninguna tabla, columna, fila ni policy cambia).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: ver «APLICACIÓN LOCAL» al pie de esta cabecera.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de D3, 20261114140000;
--   con el conjunto de la agenda v2).
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Punto 10 de Angel (tanda K): «Me salieron "Demasiados intentos" y "Pide un
-- código primero" al pedir y reenviar el código, hasta quedar bloqueado.»
-- Pide, sin relajar el tope de códigos equivocados seguidos ni los límites
-- de la ruta: reenviar no cuenta como intento fallido; el botón de reenviar
-- con una cuenta regresiva de 30 s; cuando haya que esperar, el mensaje dice
-- cuánto falta.
--   · `rate_limit_intento` (auth_02) sólo dice «bloqueado» o «quedan N»; no
--     cuánto falta. La espera la sabe sólo la base: es cuándo sale de la
--     ventana el renglón que hace tope en `ip_rate_limits`. La ruta pública
--     no puede leer la tabla (cliente de servicio sólo `.rpc()`, D5), así
--     que hace falta una RPC: `rate_limit_espera`.
--   · Los 30 s entre dos códigos al mismo correo los IMPONE el servidor con
--     esa misma RPC (límite 1 en 30 s sobre la llave del correo, la que ya
--     cuenta `rate_limit_intento`), y la página los cuenta hacia atrás con el
--     número que le da el servidor. Es un límite MÁS, no uno relajado.
--   · Reenviar invalida el código anterior (`reserva_codigo_emitir` lo deja
--     en intentos = 5, D3, sin cambios). Si la persona escribía después el
--     código del correo ANTERIOR, `reserva_codigo_verificar` lo comparaba con
--     el nuevo y le sumaba un equivocado al nuevo: el reenvío le costaba un
--     intento. Ahora, si coincide con un código anterior de ese mismo enlace
--     y correo, todavía no vencido, devuelve 'reemplazado' SIN sumar. El tope
--     no se relaja: cualquier código que no sea ni el vigente ni uno de los
--     anteriores (como mucho dos más, por el límite de 3 por correo por hora)
--     sigue sumando, y el vigente sigue en 5.
--
-- ═══ QUÉ CAMBIA ════════════════════════════════════════════════════════
-- public.rate_limit_espera(p_ruta text, p_limite integer, p_ventana_seg integer)
--   → integer (segundos que faltan; 0 si ya cabe otro). NUEVA. STABLE,
--   INVOKER, search_path vacío, SÓLO service_role (la ruta pública con
--   createAdminClient(); ip_rate_limits no es dato de clínica, no hay
--   clinica_id). No escribe: es la cuenta de rate_limit_intento sin el
--   INSERT, con la ventana en segundos.
-- public.reserva_codigo_verificar(uuid, uuid, text, text, text): CREATE OR
--   REPLACE con el cuerpo de D3 y una rama nueva ('reemplazado') antes de
--   sumar el equivocado. La firma, la seguridad (INVOKER), el search_path y
--   los permisos no cambian (CREATE OR REPLACE los conserva; se repiten
--   abajo igual).
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere D3 (reserva_verificaciones y su función) y auth_02
-- (ip_rate_limits). Bloqueos: ninguno sobre tablas (sólo funciones).
-- Orden respecto al código: MIGRACIÓN PRIMERO.
--   · Código nuevo, base sin esto: `rate_limit_espera` no existe → la ruta
--     no sabe la espera: los 429 salen como antes («Demasiados intentos», sin
--     cuánto falta) y el reenvío dentro de los 30 s NO se frena en el
--     servidor (sólo en la página). 'reemplazado' no sale nunca: el código
--     anterior cuenta como equivocado, como antes. Nada falla.
--   · Código viejo, base con esto: nadie llama a la función nueva; si
--     verificar devuelve 'reemplazado', la ruta vieja lo da como 500
--     «no_disponible» (respuestaVerificacion: valor desconocido). Por eso,
--     migración primero y código en la misma ventana.
-- Alcance de los roles:
--   gana — service_role: leer cuánto falta (sólo por la RPC).
--   pierde — nada.
-- Contrato con spinus-consola: función nueva; la otra conserva firma, tipo
--   y significado de sus valores de siempre (añade uno).
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   DROP FUNCTION IF EXISTS public.rate_limit_espera(text, integer, integer);
--   -- y reserva_codigo_verificar con el cuerpo de 20261114140000 (md5 de
--   -- prosrc 321e36cc30ea234340aa87b49a0b0c54), copiado tal cual.
--
-- ═══ AUDITORÍA INDEPENDIENTE (2026-11-18, con supabase/AUDITORIA-MIGRACIONES.md) ═══
-- APTA CON CAMBIOS, aplicados: H1 (media) la ruta traduce 'reemplazado' a
-- 400 codigo_reemplazado (respuestasReserva.ts) en el mismo commit; H2 el
-- pre-vuelo exige SELECT de service_role sobre ip_rate_limits; H3 `<` y no
-- `<=` en el borde de la ventana; H4 y H5 anotados en el COMMENT (consulta no
-- atómica; la ventana no puede exceder la de rate_limit_intento); H7 la prueba
-- cubre otro enlace y la coincidencia con rate_limit_intento real. H6 (la
-- llave del correo no lleva enlace ni clínica: la espera delata que ese correo
-- pidió un código hace poco en cualquier enlace) queda como deuda: cambiarla
-- cambia el contrato de la llave del límite. Sin relajación del tope:
-- 'reemplazado' sólo responde a valores ya muertos, después de agotado y
-- caducado, y no escribe.
--
-- ═══ APLICACIÓN LOCAL (2026-11-18, base de Docker, nunca producción) ═══
-- Ensayo con ROLLBACK en lugar de COMMIT: nada quedó (1, 2, 3 y 5 REVISAR; 4,
-- 6 y 7 OK). Después, dos pasadas reales: las dos con 1-7 OK (la segunda,
-- replay sin cambios). Prueba: supabase/pruebas-sql/k2_espera_codigo.sql.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_md5 text;
BEGIN
  IF to_regclass('public.reserva_verificaciones') IS NULL OR to_regclass('public.ip_rate_limits') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta reserva_verificaciones (D3) o ip_rate_limits (auth_02).';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.ip_rate_limits'::regclass AND NOT attisdropped
        AND (attname, atttypid::regtype) IN (('ruta', 'text'::regtype), ('created_at', 'timestamptz'::regtype))) <> 2 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: ip_rate_limits no tiene ruta text y created_at timestamptz.';
  END IF;
  IF NOT coalesce((SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role'), false) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: service_role no se salta la RLS (ip_rate_limits tiene RLS sin policies).';
  END IF;
  -- La función nueva es INVOKER: necesita además SELECT sobre la tabla (auditoría H2).
  IF NOT has_table_privilege('service_role', 'public.ip_rate_limits', 'SELECT') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: service_role sin SELECT en ip_rate_limits.';
  END IF;
  -- El cuerpo vigente de verificar es el de D3 o ya el de esta migración (replay).
  SELECT md5(p.prosrc) INTO v_md5 FROM pg_proc p
   WHERE p.oid = to_regprocedure('public.reserva_codigo_verificar(uuid, uuid, text, text, text)') AND NOT p.prosecdef;
  IF v_md5 IS NULL OR v_md5 NOT IN ('321e36cc30ea234340aa87b49a0b0c54', 'c3deded3c0d558fdc5ea6740a18964dd') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: reserva_codigo_verificar no es la de D3 ni la de esta migración (md5 %).', coalesce(v_md5, 'AUSENTE o DEFINER');
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('public.rate_limit_espera(text, integer, integer)') AND prosecdef) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: rate_limit_espera ya existe como SECURITY DEFINER.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · Cuánto falta. La cuenta de rate_limit_intento (auth_02: renglones de
--     ESA ruta dentro de la ventana), sin el INSERT y en segundos: con
--     `p_limite` o más renglones en la ventana, cabe otro cuando sale el
--     p_limite-ésimo más reciente.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rate_limit_espera(p_ruta text, p_limite integer, p_ventana_seg integer)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_sale timestamptz;
BEGIN
  IF p_ruta IS NULL OR p_limite IS NULL OR p_limite < 1 OR p_ventana_seg IS NULL OR p_ventana_seg < 1 THEN
    RAISE EXCEPTION 'rate_limit_espera: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  SELECT r.created_at + make_interval(secs => p_ventana_seg) INTO v_sale
    FROM public.ip_rate_limits r
   WHERE r.ruta = p_ruta AND r.created_at >= now() - make_interval(secs => p_ventana_seg)
   ORDER BY r.created_at DESC
  OFFSET p_limite - 1 LIMIT 1;
  -- `<` y no `<=`: rate_limit_intento cuenta `created_at >= now() - ventana` (auditoría H3).
  IF v_sale IS NULL OR v_sale < now() THEN
    RETURN 0;
  END IF;
  RETURN greatest(1, ceil(extract(epoch FROM v_sale - now()))::integer);
END
$fn$;

COMMENT ON FUNCTION public.rate_limit_espera(text, integer, integer) IS
  'Tanda K (K2, punto 10): segundos que faltan para que `p_ruta` vuelva a tener sitio con un tope de `p_limite` en `p_ventana_seg` segundos (0 = ya cabe). Cuenta como rate_limit_intento (renglones de ip_rate_limits de esa ruta dentro de la ventana) y no escribe. Sólo service_role (rutas públicas de la reserva: Retry-After y los 30 s entre códigos al mismo correo). Consulta NO atómica: informa, no sustituye a rate_limit_intento (dos peticiones simultáneas pueden pasar las dos). p_ventana_seg no debe exceder la ventana con la que rate_limit_intento cuenta esa ruta: lo que sale de ella ya se borró.';

-- ---------------------------------------------------------------------
-- 3 · Verificar: el cuerpo de D3 y, antes de sumar un equivocado, la rama
--     'reemplazado' (un código anterior de ESTE enlace y ESTE correo, sin
--     verificar y sin vencer). No escribe nada en esa rama.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserva_codigo_verificar(
  p_clinica_id uuid, p_enlace_id uuid, p_correo_hmac text, p_codigo_hmac text, p_ficha_hmac text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v public.reserva_verificaciones%ROWTYPE;
BEGIN
  IF p_clinica_id IS NULL OR p_enlace_id IS NULL OR p_correo_hmac IS NULL OR p_codigo_hmac IS NULL OR p_ficha_hmac IS NULL
     OR p_ficha_hmac !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'reserva_codigo_verificar: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  SELECT r.* INTO v FROM public.reserva_verificaciones r
   WHERE r.clinica_id = p_clinica_id AND r.enlace_id = p_enlace_id AND r.correo_hmac = p_correo_hmac
     AND r.verificado_en IS NULL
   ORDER BY r.created_at DESC, r.intentos ASC LIMIT 1
   FOR UPDATE;
  IF NOT FOUND THEN RETURN 'sin_codigo'; END IF;
  IF v.intentos >= 5 THEN RETURN 'agotado'; END IF;
  IF v.caduca_en <= now() THEN RETURN 'caducado'; END IF;
  IF v.codigo_hmac <> p_codigo_hmac THEN
    -- K2 (punto 10): el código de un correo ANTERIOR (lo invalidó un reenvío) no cuenta como equivocado.
    IF EXISTS (SELECT 1 FROM public.reserva_verificaciones r
                WHERE r.clinica_id = p_clinica_id AND r.enlace_id = p_enlace_id AND r.correo_hmac = p_correo_hmac
                  AND r.id <> v.id AND r.verificado_en IS NULL AND r.caduca_en > now()
                  AND r.codigo_hmac = p_codigo_hmac) THEN
      RETURN 'reemplazado';
    END IF;
    UPDATE public.reserva_verificaciones SET intentos = intentos + 1 WHERE id = v.id;
    RETURN CASE WHEN v.intentos + 1 >= 5 THEN 'agotado' ELSE 'incorrecto' END;
  END IF;
  UPDATE public.reserva_verificaciones
     SET verificado_en = now(), ficha_hmac = p_ficha_hmac, ficha_caduca_en = now() + interval '30 minutes'
   WHERE id = v.id;
  RETURN 'ok';
END
$fn$;

COMMENT ON FUNCTION public.reserva_codigo_verificar(uuid, uuid, text, text, text) IS
  'Reserva por enlace (D3; K2): comprueba el código del correo (5 equivocados por código, 10 min) y, si vale, deja la ficha de un uso (30 min). Devuelve ok | sin_codigo | agotado | caducado | incorrecto | reemplazado. reemplazado (K2, punto 10): el código es el de un correo ANTERIOR de este enlace y correo (lo invalidó un reenvío), todavía sin vencer; NO suma equivocado. Sólo service_role.';

-- Permisos de funciones (CLAUDE.md). Las dos, SÓLO service_role: las llaman
-- las rutas públicas con createAdminClient(); ni la consola ni las sesiones.
REVOKE EXECUTE ON FUNCTION public.rate_limit_espera(text, integer, integer) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.rate_limit_espera(text, integer, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.reserva_codigo_verificar(uuid, uuid, text, text, text) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reserva_codigo_verificar(uuid, uuid, text, text, text) TO service_role;

COMMIT;

-- ---------------------------------------------------------------------
-- 4 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO' WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'rate_limit_espera: INVOKER / STABLE / search_path vacío' AS comprobacion,
         coalesce((SELECT (NOT p.prosecdef)::text || ' / ' || (p.provolatile = 's')::text || ' / ' || (p.proconfig @> ARRAY['search_path=""'])::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.rate_limit_espera(text, integer, integer)')), 'AUSENTE') AS valor,
         'true / true / true' AS esperado
  UNION ALL
  SELECT 2, 'EXECUTE de rate_limit_espera: anon / authenticated / service_role',
         coalesce((SELECT has_function_privilege('anon', p.oid, 'EXECUTE')::text || ' / ' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                          || ' / ' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.rate_limit_espera(text, integer, integer)')), 'AUSENTE'),
         'false / false / true'
  UNION ALL
  SELECT 3, 'reserva_codigo_verificar: md5 de prosrc (el de esta migración)',
         coalesce((SELECT md5(p.prosrc) FROM pg_proc p WHERE p.oid = to_regprocedure('public.reserva_codigo_verificar(uuid, uuid, text, text, text)')), 'AUSENTE'),
         'c3deded3c0d558fdc5ea6740a18964dd'
  UNION ALL
  SELECT 4, 'EXECUTE de reserva_codigo_verificar: anon / authenticated / service_role; INVOKER',
         coalesce((SELECT has_function_privilege('anon', p.oid, 'EXECUTE')::text || ' / ' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                          || ' / ' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text || '; ' || (NOT p.prosecdef)::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.reserva_codigo_verificar(uuid, uuid, text, text, text)')), 'AUSENTE'),
         'false / false / true; true'
  UNION ALL
  SELECT 5, 'ninguna de las 2 con EXECUTE a PUBLIC',
         (SELECT count(*)::text FROM pg_proc p
           WHERE p.oid IN (to_regprocedure('public.rate_limit_espera(text, integer, integer)'),
                           to_regprocedure('public.reserva_codigo_verificar(uuid, uuid, text, text, text)'))
             AND NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
                              WHERE x.grantee = 0 AND x.privilege_type = 'EXECUTE')),
         '2'
  UNION ALL
  SELECT 6, 'rate_limit_intento, intacta (md5 de prosrc)',
         coalesce((SELECT md5(p.prosrc) FROM pg_proc p WHERE p.oid = to_regprocedure('public.rate_limit_intento(text, text, integer, integer)')), 'AUSENTE'),
         'f931c333c05d036bf683759f7a0aaa32'
  UNION ALL
  SELECT 7, 'reserva_codigo_emitir, intacta (md5 de prosrc)',
         coalesce((SELECT md5(p.prosrc) FROM pg_proc p WHERE p.oid = to_regprocedure('public.reserva_codigo_emitir(uuid, uuid, text, text)')), 'AUSENTE'),
         '31171bf5d00cc49bc6dc57afbdb82f66'
) t
ORDER BY t.n;
