-- ═══════════════════════════════════════════════════════════════════════
-- Etapa A · Paso A2 — Rate limit atómico (RPC + índice)
-- Fecha: 2026-08-05 · AUTH_MAESTRO.md §3.1, decisiones D4/D5/D6
-- Aplicado a producción: 2026-08-05 ✅ VERIFICADO
-- ═══════════════════════════════════════════════════════════════════════
-- Aditiva pura: no cambia el esquema de ip_rate_limits ni toca el índice
-- idx_ip_rate_limits_ip_ruta_fecha (no-tocar #4: checkIpRateLimit +
-- api/r/[folio] siguen usándolo). Si nada llama a las funciones, nada
-- cambia de comportamiento.
--
-- EJECUTAR EN EL SQL EDITOR, DE UNA SOLA VEZ, COMPLETO.
--   · Owner esperado: postgres → SECURITY DEFINER bypasea el RLS
--     deny-all de ip_rate_limits (mismo razonamiento que 5.C:6).
--   · Partirlo en trozos abre una ventana en la que anon tiene EXECUTE
--     sobre funciones SECURITY DEFINER sin control de identidad.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ---------- PRE-FLIGHT ----------
DO $$
BEGIN
  IF to_regclass('public.ip_rate_limits') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: tabla ip_rate_limits no existe. Abortando.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'ip_rate_limits'
       AND column_name IN ('ip', 'ruta', 'created_at')
     GROUP BY table_name HAVING count(*) = 3
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: ip_rate_limits no tiene (ip, ruta, created_at). Abortando.';
  END IF;

  -- no-tocar #4: el índice viejo debe existir ANTES y DESPUÉS.
  IF to_regclass('public.idx_ip_rate_limits_ip_ruta_fecha') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: falta idx_ip_rate_limits_ip_ruta_fecha (lo usa rateLimit.ts). Abortando.';
  END IF;

  IF to_regprocedure('public.rate_limit_intento(text,text,int,int)') IS NOT NULL THEN
    RAISE NOTICE 'PRE-FLIGHT: rate_limit_intento ya existe — se reemplaza y se re-asientan privilegios.';
  END IF;
END $$;


-- ═══ 1 · rate_limit_intento — chequeo + inserción atómicos (D4) ═══
CREATE OR REPLACE FUNCTION public.rate_limit_intento(
  p_clave       text,
  p_ruta        text,
  p_limite      int,
  p_ventana_min int
) RETURNS TABLE (bloqueado boolean, restantes int)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp   -- pg_temp EXPLÍCITO: si no se lista,
                                    -- Postgres lo busca PRIMERO y una tabla
                                    -- temporal podría secuestrar el nombre
                                    -- ip_rate_limits. Convención 5.C / ts1a.
AS $fn$
DECLARE
  v_total int;
  v_desde timestamptz;
BEGIN
  -- Guardas de entrada. Sin ellas, un NULL produce fail-open MUDO:
  -- make_interval(mins => NULL) → NULL → count 0 → (0 >= NULL) es NULL →
  -- el IF lo trata como FALSE → inserta y devuelve restantes NULL, sin
  -- error. El fail-open de D6 vive en el try/catch del servidor, no aquí.
  IF p_clave IS NULL OR p_ruta IS NULL THEN
    RAISE EXCEPTION 'rate_limit_intento: p_clave y p_ruta no pueden ser NULL';
  END IF;
  IF p_limite IS NULL OR p_limite < 1
     OR p_ventana_min IS NULL OR p_ventana_min < 1 THEN
    RAISE EXCEPTION 'rate_limit_intento: p_limite y p_ventana_min deben ser >= 1 (recibido %, %)',
      p_limite, p_ventana_min;
  END IF;

  -- Serializa por cubo. Forma de DOS enteros: el literal 1789 es un
  -- espacio de claves privado de este módulo, aislado del espacio global
  -- de advisory locks que comparten extensiones y procesos del sistema.
  -- Una colisión de hashtext entre dos rutas distintas produce SOLO
  -- contención: jamás cuentas erróneas, porque todos los predicados de
  -- fila filtran por ruta = p_ruta, no por el hash.
  PERFORM pg_advisory_xact_lock(1789, hashtext(p_ruta));

  v_desde := now() - make_interval(mins => p_ventana_min);

  DELETE FROM public.ip_rate_limits
   WHERE ruta = p_ruta
     AND created_at < v_desde;

  SELECT count(*) INTO v_total
    FROM public.ip_rate_limits
   WHERE ruta = p_ruta
     AND created_at >= v_desde;

  IF v_total >= p_limite THEN
    RETURN QUERY SELECT true, 0;
  ELSE
    INSERT INTO public.ip_rate_limits (ip, ruta) VALUES (p_clave, p_ruta);
    -- v_total <= p_limite - 1 en esta rama ⇒ el resultado nunca es negativo.
    RETURN QUERY SELECT false, (p_limite - v_total - 1);
  END IF;
END
$fn$;

COMMENT ON FUNCTION public.rate_limit_intento(text,text,int,int) IS
  'Etapa A/D4: chequeo+inserción atómicos de un intento de auth, serializados por pg_advisory_xact_lock(1789, hashtext(ruta)). '
  'DEVUELVE UNA FILA, NO UN OBJETO: es set-returning, PostgREST la expone como array. Desde supabase-js usar .rpc(...).single() — '
  'sin .single(), data.bloqueado es undefined (falsy) y el limitador no bloquea NUNCA, en silencio. '
  'restantes=0 con bloqueado=false es el ÚLTIMO intento permitido: ramificar por bloqueado, jamás por restantes. '
  'NO invocar las dos llamadas del login (login_ip y login_v2) dentro de una misma transacción: dos advisory locks con orden '
  'variable ⇒ riesgo de deadlock. Solo service_role. No usar para verificar-receta (no-tocar #4).';


-- ═══ 2 · rate_limit_reset — vaciado del cubo email+IP (D5) ═══
CREATE OR REPLACE FUNCTION public.rate_limit_reset(p_ruta text)
RETURNS int
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_borradas int;
BEGIN
  -- D5 POR CONSTRUCCIÓN, no por convención. Sin esta guarda, D5 depende de
  -- que limiter.ts nunca se equivoque de ruta. Con ella, R4 es imposible:
  -- esta función NO PUEDE tocar auth:login_ip:*, recovery, registro ni
  -- verificar-receta (no-tocar #4), venga la llamada de donde venga.
  IF p_ruta IS NULL OR p_ruta NOT LIKE 'auth:login_v2:%' THEN
    RAISE EXCEPTION 'rate_limit_reset: ruta no permitida (%). Solo se aceptan cubos auth:login_v2:* (D5).', p_ruta;
  END IF;

  -- Mismo lock que rate_limit_intento: el reset no se intercala con un
  -- intento concurrente sobre el mismo cubo.
  PERFORM pg_advisory_xact_lock(1789, hashtext(p_ruta));

  DELETE FROM public.ip_rate_limits WHERE ruta = p_ruta;
  GET DIAGNOSTICS v_borradas = ROW_COUNT;
  RETURN v_borradas;
END
$fn$;

COMMENT ON FUNCTION public.rate_limit_reset(text) IS
  'Etapa A/D5: vacía el cubo de login por email+IP tras autenticación exitosa. Rechaza por excepción cualquier ruta que no sea '
  'auth:login_v2:* — R4 imposible por construcción, no por convención. Devuelve escalar int (filas borradas). Solo service_role.';


-- ═══ 3 · Privilegios ═══
-- Postgres concede EXECUTE TO PUBLIC por defecto, y Supabase añade GRANTs
-- DIRECTOS a anon/authenticated/service_role vía ALTER DEFAULT PRIVILEGES
-- (documentado en 20260524_..._ts1a.sql:12-13). Hay que revocar los cuatro
-- y RE-CONCEDER a service_role de forma explícita:
--   · revocar solo anon/authenticated (como está en §3.1 del maestro) deja
--     el RPC abierto vía PUBLIC;
--   · revocar de PUBLIC sin re-conceder deja a service_role sin EXECUTE si
--     el grant directo no estuviera → 42501 → D6 se lo traga → limitador
--     en FAIL-OPEN PERMANENTE Y SILENCIOSO.
-- CREATE OR REPLACE preserva la ACL; DROP+CREATE la restablece. Por eso el
-- POST-FLIGHT asserta el estado final: si mañana alguien recrea la función
-- sin re-revocar, esta migración vuelve a asentarlo y el post-flight avisa.
REVOKE ALL ON FUNCTION public.rate_limit_intento(text,text,int,int)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rate_limit_reset(text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.rate_limit_intento(text,text,int,int) TO service_role;
GRANT EXECUTE ON FUNCTION public.rate_limit_reset(text)                TO service_role;


-- ═══ 4 · Índice para el predicado real del RPC ═══
-- El RPC filtra SOLO por ruta. idx_ip_rate_limits_ip_ruta_fecha tiene `ip`
-- como PRIMERA columna → inservible aquí → seq scan en las tres operaciones.
-- ⚠️ EL ÍNDICE VIEJO NO SE TOCA: lo usan checkAuthRateLimit y checkIpRateLimit
-- (esta última compartida con verificar-receta, no-tocar #4).
-- Sin CONCURRENTLY a propósito: no puede correr dentro de una transacción y
-- la tabla es diminuta (el SHARE lock dura milisegundos).
CREATE INDEX IF NOT EXISTS idx_ip_rate_limits_ruta_fecha
  ON public.ip_rate_limits USING btree (ruta, created_at);

COMMENT ON INDEX public.idx_ip_rate_limits_ruta_fecha IS
  'Etapa A: sirve el predicado (ruta, created_at) de rate_limit_intento. NO sustituye a idx_ip_rate_limits_ip_ruta_fecha, '
  'que sigue sirviendo a rateLimit.ts (checkAuthRateLimit / checkIpRateLimit + verificar-receta).';


-- ---------- POST-FLIGHT ----------
DO $$
DECLARE
  v_owner  text;
  v_secdef boolean;
  v_n      int := 0;
BEGIN
  IF to_regprocedure('public.rate_limit_intento(text,text,int,int)') IS NULL
     OR to_regprocedure('public.rate_limit_reset(text)') IS NULL THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: falta alguna función con su firma esperada.';
  END IF;

  FOR v_owner, v_secdef IN
    SELECT r.rolname, p.prosecdef
      FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname IN ('rate_limit_intento', 'rate_limit_reset')
  LOOP
    v_n := v_n + 1;
    IF v_owner <> 'postgres' THEN
      RAISE EXCEPTION 'POST-FLIGHT FALLO: owner=% (esperado postgres). Sin ese owner, SECURITY DEFINER NO bypasea el RLS deny-all de ip_rate_limits.', v_owner;
    END IF;
    IF v_secdef IS NOT TRUE THEN
      RAISE EXCEPTION 'POST-FLIGHT FALLO: alguna función no quedó SECURITY DEFINER.';
    END IF;
  END LOOP;
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: se esperaban 2 funciones, se encontraron %.', v_n;
  END IF;

  IF has_function_privilege('anon',          'public.rate_limit_intento(text,text,int,int)', 'EXECUTE')
  OR has_function_privilege('authenticated', 'public.rate_limit_intento(text,text,int,int)', 'EXECUTE')
  OR has_function_privilege('anon',          'public.rate_limit_reset(text)',                'EXECUTE')
  OR has_function_privilege('authenticated', 'public.rate_limit_reset(text)',                'EXECUTE') THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: anon/authenticated conservan EXECUTE sobre un SECURITY DEFINER sin control de identidad.';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.rate_limit_intento(text,text,int,int)', 'EXECUTE')
  OR NOT has_function_privilege('service_role', 'public.rate_limit_reset(text)',                'EXECUTE') THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: service_role SIN EXECUTE — el limitador quedaría en fail-open permanente y silencioso (D6).';
  END IF;

  IF to_regclass('public.idx_ip_rate_limits_ruta_fecha') IS NULL THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: no se creó idx_ip_rate_limits_ruta_fecha.';
  END IF;
  IF to_regclass('public.idx_ip_rate_limits_ip_ruta_fecha') IS NULL THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: se perdió idx_ip_rate_limits_ip_ruta_fecha (no-tocar #4). Revertir.';
  END IF;

  RAISE NOTICE 'A2 aplicado: 2 RPC SECURITY DEFINER (owner=postgres), EXECUTE solo service_role, indice nuevo OK, indice viejo intacto.';
END $$;

-- Obligatorio: sin esto PostgREST puede devolver 404/PGRST202 al .rpc()
-- y D6 lo convertiría en fail-open silencioso.
NOTIFY pgrst, 'reload schema';

COMMIT;


-- ---------- DOWN (rollback) — referencia, no se ejecuta ----------
-- Válido mientras nada más consuma estas funciones (no hay policies ni
-- triggers que las referencien: son consumidas solo desde src/lib/auth/).
-- BEGIN;
--   DROP FUNCTION IF EXISTS public.rate_limit_intento(text,text,int,int);
--   DROP FUNCTION IF EXISTS public.rate_limit_reset(text);
--   DROP INDEX    IF EXISTS public.idx_ip_rate_limits_ruta_fecha;
--
--   -- OPCIONAL — decisión de Angel, NO incluido por defecto.
--   -- Tras el rollback, las filas escritas por el RPC quedan huérfanas:
--   -- nada las lee y nada las purga. Son datos transitorios de rate limit,
--   -- no clínicos, pero CLAUDE.md prohíbe DELETE en prod sin decisión
--   -- explícita. auth:login_ip:* NO se toca: lo comparte el código viejo.
--   -- DELETE FROM public.ip_rate_limits WHERE ruta LIKE 'auth:login_v2:%';
--
--   NOTIFY pgrst, 'reload schema';   -- que PostgREST olvide los RPC
--   RAISE NOTICE 'A2 revertido: 2 funciones + 1 indice eliminados. Indice viejo intacto.';
-- COMMIT;


-- ═══════════════════════════════════════════════════════════════════════
-- SMOKE TEST EJECUTADO EN PRODUCCIÓN — 2026-08-05 · TODO CORRECTO
-- ═══════════════════════════════════════════════════════════════════════
--   intento 1/2/3 → (false,2) (false,1) (false,0) · intento 4 → (true,0)
--   reset → 3 · intento posterior → (false,2) · reset limpieza → 1
--   rate_limit_reset('auth:login_ip:1.2.3.4') → EXCEPTION P0001 (correcto)
--   EXPLAIN → Index Only Scan using idx_ip_rate_limits_ruta_fecha
--   residuo → 0
--   PostgreSQL 17.6
--
-- Lectura de cada línea:
--   · (false,0) en el 3.er intento con límite 3 es el ÚLTIMO PERMITIDO, no
--     un bloqueo. Confirma en producción la aritmética de ambas ramas y la
--     regla de D4: ramificar por `bloqueado`, JAMÁS por `restantes`.
--   · El 4.º devuelve (true,0): el corte cae donde debe, ni antes ni después.
--   · reset → 3 y el intento posterior → (false,2): el cubo quedó vacío de
--     verdad; el reset no es cosmético.
--   · P0001 sobre 'auth:login_ip:1.2.3.4' prueba D5 CONTRA SU VECTOR REAL:
--     el cubo por IP es precisamente lo que R4 querría vaciar, y la función
--     lo rechaza por excepción. D5 es cierto por construcción, no por
--     convención. (Prueba más fuerte que la de 'verificar-receta'.)
--   · Index Only Scan (no Seq Scan, ni siquiera Index Scan): el índice
--     nuevo sirve el predicado (ruta, created_at) sin tocar el heap.
--     Cierra la salvedad de A2 sobre el Seq Scan no concluyente.
--   · residuo 0: el smoke test no dejó basura en ip_rate_limits.
--   · PostgreSQL 17.6 confirma la única afirmación que la auditoría marcó
--     como NO verificada contra esta instancia: make_interval(mins => ...)
--     existe desde PG 9.4. Ya no es un supuesto.
-- ═══════════════════════════════════════════════════════════════════════
