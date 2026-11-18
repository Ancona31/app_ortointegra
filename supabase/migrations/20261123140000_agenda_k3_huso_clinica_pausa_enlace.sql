-- ═══════════════════════════════════════════════════════════════════════
-- Agenda · tanda K, agente K3 (puntos 12 y 14 de Angel) — el huso horario
-- de la clínica y el enlace fijo PAUSADO.
-- Rama: feature/agenda-v2-k3 · Escrita: 2026-11-18
-- Riesgo estimado: BAJO (dos columnas nuevas que nacen NULL en todas las
-- filas, un CHECK que todas cumplen al nacer, y una condición más —«y no
-- pausado»— en seis funciones de la reserva pública, justo donde ya miran
-- «no revocado». Ni filas, ni policies, ni disparadores, ni permisos).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: ver «APLICACIÓN LOCAL» al pie de la cabecera.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR, después de 20261122140000 y de
--   las migraciones de la tanda K con timestamp anterior (en especial la de
--   K1, que rehace reservar_por_enlace: ver «ORDEN CON K1»), y ANTES del
--   código de la rama (el código tolera la ausencia de las columnas, pero sin
--   ellas no se puede pausar ni guardar el huso).
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Punto 12: el horario de la clínica pasa a ser el primer paso del funnel de
--   la configuración, «con su huso horario». Hoy el huso sólo vive en cada
--   consultorio (consultorios.timezone) y en las fotos de la cita
--   (appointments.consultorio_timezone, consultas.consultorio_timezone); la
--   clínica no tiene. clinicas.timezone es el huso «de fábrica» con el que la
--   configuración propone los consultorios que se creen. NO lo lee la
--   rejilla, ni la reserva, ni los correos: todos siguen con el huso de cada
--   consultorio, que esta migración no toca.
-- Punto 14: apagar «Tu enlace» lo PAUSA, no lo revoca: al prenderlo vuelve a
--   servir la MISMA dirección (el código se deriva del id del enlace por HMAC
--   de RESERVA_SECRETO, así que la misma fila = la misma dirección). Sólo
--   «Cambiar por uno nuevo» revoca. Pausado, la página pública y la RPC de
--   reserva lo tratan EXACTAMENTE como uno revocado: mismo NULL de
--   reserva_contexto (→ el mismo 404 neutro de la página), mismo
--   'enlace_invalido' de reservar_por_enlace. Nada distingue «pausado» de
--   «no existe» desde fuera.
--
-- ═══ QUÉ CAMBIA ════════════════════════════════════════════════════════
-- 1. public.clinicas.timezone text NULL. Sin DEFAULT ni CHECK: NULL = la
--    clínica aún no eligió (la configuración propone uno). Lo escribe sólo
--    PUT /api/me/horario (administrador, Zod contra Intl, cliente de servicio
--    filtrado por clinica_id, audit_log). clinicas no tiene policy de UPDATE
--    para authenticated: nada cambia ahí.
-- 2. public.reserva_enlaces.pausado_en timestamptz NULL, con
--    reserva_enlaces_pausado_check: sólo un FIJO se pausa (el único se apaga
--    revocándolo, como hoy). La escribe la sesión por la policy de UPDATE que
--    ya revoca (PATCH /api/agenda/enlaces/[id], acciones pausar/reanudar);
--    proteger_reserva_enlaces() NO la lista entre lo inmutable, así que no se
--    toca (su md5 acd4128b lo exigen otros pre-vuelos). La auditoría de la
--    tabla (audit_reserva_enlaces → log_tabla_change) ya apunta cada UPDATE.
-- 3. «Y no pausado» donde hoy se mira «no revocado», en las seis funciones
--    que abren un enlace por su código o su id para el público:
--      reserva_contexto       (la página y TODAS las rutas /api/reservar/*
--                              pasan por aquí: abrirEnlace())
--      reservar_por_enlace    (la reserva; «no basta la página»)
--      reagendar_por_enlace   (reagendar con el fijo desde /confirmar)
--      cita_reagendar_oferta  (qué fijo se ofrece para reagendar)
--      reserva_ocupacion      (los turnos)
--      reserva_codigo_emitir  (el código de verificación del correo)
--    Se hace SUSTITUYENDO un fragmento exacto del cuerpo VIGENTE de cada una
--    (pg_get_functiondef → replace → EXECUTE), no pegando un cuerpo copiado:
--    así no pisa lo que otra migración anterior de esta tanda haya cambiado en
--    el resto de la función (K1 rehace reservar_por_enlace). El pre-vuelo
--    exige que cada fragmento aparezca EXACTAMENTE una vez; si no, aborta
--    antes de cambiar nada. CREATE OR REPLACE conserva dueño, SECURITY
--    INVOKER, search_path, volatilidad y permisos (sólo service_role); el
--    veredicto lo comprueba.
--
-- ═══ ORDEN CON K1 ══════════════════════════════════════════════════════
-- Si una migración POSTERIOR a ésta vuelve a pegar reservar_por_enlace (o
-- cualquiera de las seis) con un cuerpo propio, perderá la comprobación de
-- «pausado» sin error. Lo atrapa supabase/pruebas-sql/k3_enlace_pausado.sql
-- (casos 2 a 4 y 6). Quien la escriba: mantener `OR v_enl.pausado_en IS NOT NULL`
-- junto a `v_enl.revocado_en IS NOT NULL`. En producción, donde se pega a
-- mano: K1 ANTES que ésta; si se pegó al revés, volver a pegar ésta.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere: las seis funciones con su comprobación de «revocado» tal como la
--   dejaron 20261122120000/20261122120100 (cuerpos con md5, al escribir:
--   reserva_contexto a39a4dad…, reservar_por_enlace 1a448df0…,
--   reagendar_por_enlace a05266ad…, cita_reagendar_oferta 4bcf4c7e…,
--   reserva_ocupacion 50a89d85…, reserva_codigo_emitir 31171bf5…; el
--   pre-vuelo NO exige esos md5 sino el fragmento, por el ORDEN CON K1).
-- Bloqueos: ALTER TABLE … ADD COLUMN sin DEFAULT y ADD CONSTRAINT CHECK toman
--   ACCESS EXCLUSIVE sobre clinicas y reserva_enlaces un instante (sin
--   reescritura; el CHECK recorre reserva_enlaces, decenas de filas).
--   lock_timeout de 5 s: si alguien las retiene, aborta entero.
-- Orden respecto al código: esta migración PRIMERO. Código viejo con esta
--   migración: no lee ni escribe las columnas nuevas y no puede pausar nada:
--   todo igual. Código nuevo sin esta migración: el PATCH de pausar responde
--   409 (42703), el PUT del horario guarda el horario sin el huso (como
--   antes) y la lista de enlaces lee como antes; nada se rompe.
-- Contrato con spinus-consola: añade una columna a clinicas; no renombra ni
--   cambia ninguna de las que la consola lee.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
-- Volver a correr la sustitución al revés (fragmento nuevo → viejo) en las
-- seis funciones; luego DROP CONSTRAINT reserva_enlaces_pausado_check, DROP
-- COLUMN reserva_enlaces.pausado_en y clinicas.timezone (pierde qué enlaces
-- estaban pausados —quedan PRENDIDOS— y el huso elegido; respaldarlos antes).
--
-- ═══ APLICACIÓN LOCAL ══════════════════════════════════════════════════
-- 2026-11-18: ensayo con ROLLBACK (9/9 OK, nada persistió), dos pasadas
--   (9/9 OK cada una; la segunda omite las seis sustituciones) y una tercera
--   con el archivo dos veces en LA MISMA sesión (18/18 OK: pg_temp.k3_veces
--   es OR REPLACE), bajo flock, en la base local compartida.
--   supabase/pruebas-sql/k3_enlace_pausado.sql en verde, y en rojo con cada
--   mutación de su cabecera. Auditoría independiente: sin bloqueantes; sus
--   hallazgos 1 (pg_temp de sesión), 2 (post-vuelo que aborta), 5 (caso 6
--   de catálogo) y 6 (mensaje del pre-vuelo) aplicados.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 0 · Las sustituciones: función, fragmento de hoy, fragmento nuevo.
-- ---------------------------------------------------------------------
CREATE TEMPORARY TABLE k3_sustituciones (
  n integer PRIMARY KEY, firma text NOT NULL, viejo text NOT NULL, nuevo text NOT NULL
) ON COMMIT DROP;
INSERT INTO k3_sustituciones VALUES
  (1, 'public.reserva_contexto(text, text, text)',
      'IF NOT FOUND OR v_e.revocado_en IS NOT NULL THEN RETURN NULL; END IF;',
      'IF NOT FOUND OR v_e.revocado_en IS NOT NULL OR v_e.pausado_en IS NOT NULL THEN RETURN NULL; END IF;'),
  (2, 'public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)',
      'IF NOT FOUND OR v_enl.revocado_en IS NOT NULL THEN',
      'IF NOT FOUND OR v_enl.revocado_en IS NOT NULL OR v_enl.pausado_en IS NOT NULL THEN'),
  (3, 'public.reagendar_por_enlace(text, uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)',
      'WHERE e.codigo_hash = p_codigo_hash AND e.clinica_id = p_clinica_id AND e.revocado_en IS NULL;',
      'WHERE e.codigo_hash = p_codigo_hash AND e.clinica_id = p_clinica_id AND e.revocado_en IS NULL AND e.pausado_en IS NULL;'),
  (4, 'public.cita_reagendar_oferta(uuid, text)',
      'AND e.clase = ''fijo'' AND e.revocado_en IS NULL;',
      'AND e.clase = ''fijo'' AND e.revocado_en IS NULL AND e.pausado_en IS NULL;'),
  (5, 'public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz)',
      'WHERE e.id = p_enlace_id AND e.clinica_id = p_clinica_id AND e.revocado_en IS NULL',
      'WHERE e.id = p_enlace_id AND e.clinica_id = p_clinica_id AND e.revocado_en IS NULL AND e.pausado_en IS NULL'),
  (6, 'public.reserva_codigo_emitir(uuid, uuid, text, text)',
      'AND e.clase = ''fijo'' AND e.revocado_en IS NULL)',
      'AND e.clase = ''fijo'' AND e.revocado_en IS NULL AND e.pausado_en IS NULL)');

-- Cuántas veces aparece `frag` en `texto`. OR REPLACE: pg_temp vive lo que la SESIÓN (no la
-- transacción), y el SQL Editor puede reutilizar la conexión en una segunda pasada.
CREATE OR REPLACE FUNCTION pg_temp.k3_veces(texto text, frag text) RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT (char_length(texto) - char_length(replace(texto, frag, ''))) / char_length(frag)
$$;

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  s record;
  v_oid oid;
  v_src text;
BEGIN
  IF to_regclass('public.clinicas') IS NULL OR to_regclass('public.reserva_enlaces') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: faltan public.clinicas o public.reserva_enlaces.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clinicas'
              AND column_name = 'timezone' AND (data_type <> 'text' OR is_nullable <> 'YES' OR column_default IS NOT NULL)) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: clinicas.timezone ya existe con otra forma (no es text NULL sin DEFAULT): revisar quién la creó.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reserva_enlaces'
              AND column_name = 'pausado_en' AND (data_type <> 'timestamp with time zone' OR is_nullable <> 'YES' OR column_default IS NOT NULL)) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: reserva_enlaces.pausado_en ya existe con otra forma: revisar quién la creó.';
  END IF;
  FOR s IN SELECT * FROM k3_sustituciones ORDER BY n LOOP
    v_oid := to_regprocedure(s.firma);
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta %.', s.firma;
    END IF;
    SELECT prosrc INTO v_src FROM pg_proc WHERE oid = v_oid;
    IF (SELECT prosecdef FROM pg_proc WHERE oid = v_oid) THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: % es SECURITY DEFINER; la reserva las dejó INVOKER.', s.firma;
    END IF;
    -- Segunda pasada: ya lleva el fragmento nuevo y ninguno viejo suelto → no hay nada que hacer.
    CONTINUE WHEN pg_temp.k3_veces(v_src, s.nuevo) = 1
             AND pg_temp.k3_veces(v_src, s.viejo) = (CASE WHEN position(s.viejo IN s.nuevo) > 0 THEN 1 ELSE 0 END);
    IF pg_temp.k3_veces(v_src, s.viejo) <> 1 OR pg_temp.k3_veces(v_src, s.nuevo) <> 0 THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: en % el fragmento de «revocado» aparece % veces y el de «pausado» % (se esperan 1 y 0): alguien cambió la función. Fragmento: %',
        s.firma, pg_temp.k3_veces(v_src, s.viejo), pg_temp.k3_veces(v_src, s.nuevo), s.viejo;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 2 · Las columnas.
-- ---------------------------------------------------------------------
ALTER TABLE public.clinicas ADD COLUMN IF NOT EXISTS timezone text;
COMMENT ON COLUMN public.clinicas.timezone IS
  'K3 (punto 12): huso horario IANA «de fábrica» de la clínica; NULL = aún sin elegir. Lo escribe sólo PUT /api/me/horario (administrador, validado contra Intl.supportedValuesOf). CONVENIO: NO lo lee la rejilla, ni la reserva, ni los correos: cada consultorio tiene su propio consultorios.timezone, que cambiar éste NO toca. Sólo propone el huso de los consultorios que se creen.';

ALTER TABLE public.reserva_enlaces ADD COLUMN IF NOT EXISTS pausado_en timestamptz;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.reserva_enlaces'::regclass AND conname = 'reserva_enlaces_pausado_check') THEN
    ALTER TABLE public.reserva_enlaces ADD CONSTRAINT reserva_enlaces_pausado_check CHECK (pausado_en IS NULL OR clase = 'fijo');
  END IF;
END $$;
COMMENT ON COLUMN public.reserva_enlaces.pausado_en IS
  'K3 (punto 14): el enlace FIJO apagado desde «Tu enlace» sin revocarlo; NULL = prendido. Al volver a NULL sirve la MISMA dirección (el código sale del id). CONVENIO: toda función que abra un enlace para el público lo trata como revocado (reserva_contexto, reservar_por_enlace, reagendar_por_enlace, cita_reagendar_oferta, reserva_ocupacion, reserva_codigo_emitir: «revocado_en IS NULL AND pausado_en IS NULL»); quien escriba otra, igual. Sólo el fijo (reserva_enlaces_pausado_check).';

-- ---------------------------------------------------------------------
-- 3 · «Y no pausado» en las seis funciones (cuerpo vigente, un fragmento).
-- ---------------------------------------------------------------------
DO $$
DECLARE
  s record;
  v_oid oid;
  v_def text;
BEGIN
  FOR s IN SELECT * FROM k3_sustituciones ORDER BY n LOOP
    v_oid := to_regprocedure(s.firma);
    CONTINUE WHEN pg_temp.k3_veces((SELECT prosrc FROM pg_proc WHERE oid = v_oid), s.nuevo) = 1;
    v_def := pg_get_functiondef(v_oid);
    IF pg_temp.k3_veces(v_def, s.viejo) <> 1 THEN
      RAISE EXCEPTION 'k3: % no tiene el fragmento una sola vez en su definición completa.', s.firma;
    END IF;
    EXECUTE replace(v_def, s.viejo, s.nuevo);
  END LOOP;
END $$;

-- Permisos de funciones (CLAUDE.md): CREATE OR REPLACE los conserva; se repiten
-- explícitos, los de siempre de las seis: SÓLO service_role.
REVOKE EXECUTE ON FUNCTION public.reserva_contexto(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reserva_contexto(text, text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.reagendar_por_enlace(text, uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reagendar_por_enlace(text, uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.cita_reagendar_oferta(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cita_reagendar_oferta(uuid, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz) TO service_role;
REVOKE EXECUTE ON FUNCTION public.reserva_codigo_emitir(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reserva_codigo_emitir(uuid, uuid, text, text) TO service_role;

-- ---------------------------------------------------------------------
-- 4 · Post-vuelo que ABORTA (antes del COMMIT): si algo no quedó como debe,
--     no se aplica nada. El veredicto de abajo es sólo para verlo en la rejilla.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  s record;
  p record;
BEGIN
  FOR s IN SELECT * FROM k3_sustituciones ORDER BY n LOOP
    SELECT * INTO p FROM pg_proc WHERE oid = to_regprocedure(s.firma);
    IF pg_temp.k3_veces(p.prosrc, s.nuevo) <> 1 OR p.prosecdef
       OR has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
       OR NOT has_function_privilege('service_role', p.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'POST-VUELO FALLÓ: % no quedó con su guarda de «pausado», INVOKER y sólo service_role.', s.firma;
    END IF;
  END LOOP;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.proteger_reserva_enlaces()')) <> 'acd4128b5f25df54f6b4fd95391cf1dc' THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: proteger_reserva_enlaces() cambió.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 5 · Veredicto (dentro de la transacción, que aún ve la tabla de
--     sustituciones). Todo «OK».
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'clinicas.timezone: tipo / nulo / default' AS comprobacion,
         coalesce((SELECT data_type || ' / ' || is_nullable || ' / ' || coalesce(column_default, '-') FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'clinicas' AND column_name = 'timezone'), 'AUSENTE') AS valor,
         'text / YES / -' AS esperado
  UNION ALL
  SELECT 2, 'reserva_enlaces.pausado_en: tipo / nulo / default; y su CHECK',
         coalesce((SELECT data_type || ' / ' || is_nullable || ' / ' || coalesce(column_default, '-') FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'reserva_enlaces' AND column_name = 'pausado_en'), 'AUSENTE')
           || ' / ' || coalesce((SELECT pg_get_constraintdef(oid) FROM pg_constraint
                                  WHERE conrelid = 'public.reserva_enlaces'::regclass AND conname = 'reserva_enlaces_pausado_check'), 'SIN CHECK'),
         'timestamp with time zone / YES / - / CHECK (((pausado_en IS NULL) OR (clase = ''fijo''::text)))'
  UNION ALL
  SELECT 2 + s.n, s.firma || ': guarda de «pausado» 1 vez / invoker / sólo service_role',
         coalesce((SELECT pg_temp.k3_veces(p.prosrc, s.nuevo)::text || ' / ' || p.prosecdef::text || ' / '
                          || has_function_privilege('anon', p.oid, 'EXECUTE')::text || ' ' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                          || ' ' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text || ' '
                          || EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                      WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure(s.firma)), 'AUSENTE'),
         '1 / false / false false true false'
    FROM k3_sustituciones s
  UNION ALL
  SELECT 9, 'proteger_reserva_enlaces() intacto (md5 de prosrc)',
         coalesce((SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.proteger_reserva_enlaces()')), 'AUSENTE'),
         'acd4128b5f25df54f6b4fd95391cf1dc'
) t ORDER BY t.n;

COMMIT;
