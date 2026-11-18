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
--    Cada una va con su CUERPO COMPLETO y explícito (CREATE OR REPLACE; desde
--    la integración de la tanda K, antes por sustitución de fragmentos): el
--    vigente tras K1 (20261123120000) para reservar_por_enlace y
--    reserva_ocupacion, y el de J (20261122120000/120100) para las otras
--    cuatro, con «y no pausado» como única diferencia. El pre-vuelo exige el
--    md5 de cada cuerpo de partida (o el de esta, en una segunda pasada) y
--    aborta con cualquier otro antes de cambiar nada. SECURITY INVOKER,
--    search_path vacío, volatilidad y permisos (sólo service_role) como
--    estaban; el veredicto lo comprueba.
--
-- ═══ ORDEN CON K1: FIJO, K1 ANTES ══════════════════════════════════════
-- Esta migración parte de los cuerpos que deja K1 (reserva_ocupacion
-- e7cf1c34…, reservar_por_enlace eb5ec46c…) y los exige: sin K1,
-- aborta. K1, a su vez, aborta si encuentra ya los de ésta. En producción,
-- donde se pega a mano: K1 y DESPUÉS ésta; el orden equivocado se detiene,
-- no borra nada en silencio. Una migración POSTERIOR que vuelva a pegar una de
-- las seis con un cuerpo propio debe partir del de ésta (md5 en el
-- veredicto) y conservar `pausado_en IS NULL` / `IS NOT NULL` junto a la de
-- `revocado_en`; lo vigila supabase/pruebas-sql/k3_enlace_pausado.sql (casos
-- 2 a 4 y 6).
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere: 20261123120000 (K1) y las otras cuatro como las dejaron
--   20261122120000/20261122120100. md5 de prosrc que exige el pre-vuelo:
--   reserva_contexto a39a4dad…, reservar_por_enlace eb5ec46c… (K1),
--   reagendar_por_enlace a05266ad…, cita_reagendar_oferta 4bcf4c7e…,
--   reserva_ocupacion e7cf1c34… (K1), reserva_codigo_emitir 31171bf5….
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
-- Volver a pegar las seis funciones con el cuerpo de partida (el de K1 para
-- reservar_por_enlace y reserva_ocupacion; el de J para las otras cuatro) y
-- sus REVOKE/GRANT; luego DROP CONSTRAINT reserva_enlaces_pausado_check, DROP
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
-- Integración de la tanda K (2026-11-18): rehecha con cuerpos completos y el
--   orden K1 → K3 fijo (ya no hay tabla de sustituciones ni pg_temp). Los
--   cuerpos son los mismos textos que daba la sustitución (mismo md5 de
--   prosrc). El párrafo de 2026-11-18 de arriba es de la VERSIÓN POR
--   SUSTITUCIÓN (ya no hay sustituciones ni pg_temp). Ésta: ensayo con
--   ROLLBACK; sin K1 aborta en el pre-vuelo sin cambiar nada; dos pasadas
--   reales tras K1, 9/9 OK cada una; después db reset con todo el conjunto.
--   k3_enlace_pausado en verde y en rojo con cada mutación (emitir, reservar,
--   oferta y reagendar sin la guarda). Auditoría independiente (subagente
--   sonnet): APTA con observaciones, sin bloqueantes; queda anotada como
--   deuda (AG-DT) la falta de CHECK de forma en clinicas.timezone (NULL
--   = «aún no eligió», sólo la escribe el servidor tras Zod contra Intl).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  p record;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clinicas'
              AND column_name = 'timezone' AND (data_type <> 'text' OR is_nullable <> 'YES' OR column_default IS NOT NULL)) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: clinicas.timezone ya existe con otra forma (no es text NULL sin DEFAULT): revisar quién la creó.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reserva_enlaces'
              AND column_name = 'pausado_en' AND (data_type <> 'timestamp with time zone' OR is_nullable <> 'YES' OR column_default IS NOT NULL)) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: reserva_enlaces.pausado_en ya existe con otra forma: revisar quién la creó.';
  END IF;
  -- Las seis: el cuerpo de partida, o ya el de esta migración (segunda pasada).
  FOR p IN SELECT f.firma, f.antes, f.despues, pr.prosrc, pr.prosecdef
             FROM (VALUES
               ('public.reserva_contexto(text, text, text)', 'a39a4dadaacb1a625d966a832f67575b', 'e8be3201d2192ccef16766db72b05271'),
               ('public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)', 'eb5ec46ca21cad79a690fb704fbf662c', 'be25c16726eb90839767fd4bd9176195'),
               ('public.reagendar_por_enlace(text, uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)', 'a05266ad00e3ecc1cdcdcd3d5600b533', '54b257ed431bb7061092fe4fd26f0a02'),
               ('public.cita_reagendar_oferta(uuid, text)', '4bcf4c7ef84526c6b2ecefecade8a18f', 'dbcd8da825f4db80b20f554d37cc65c5'),
               ('public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz)', 'e7cf1c347ef5391b3078a02744fdf5d4', 'f1701599edf6756887fbb01a8c18464f'),
               ('public.reserva_codigo_emitir(uuid, uuid, text, text)', '31171bf5d00cc49bc6dc57afbdb82f66', 'd24c01e93ce43ae8b75013010a7cb1fd')
             ) AS f(firma, antes, despues)
             LEFT JOIN pg_proc pr ON pr.oid = to_regprocedure(f.firma) LOOP
    IF p.prosrc IS NULL THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta %.', p.firma;
    END IF;
    IF p.prosecdef THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: % es SECURITY DEFINER; la reserva las dejó INVOKER.', p.firma;
    END IF;
    IF md5(p.prosrc) NOT IN (p.antes, p.despues) THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: % tiene un cuerpo desconocido (md5 %; se espera % o % de esta). Si es reservar_por_enlace o reserva_ocupacion, ¿falta K1 (20261123120000)? Va antes que ésta.', p.firma, md5(p.prosrc), p.antes, p.despues;
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
-- 3 · «Y no pausado» en las seis funciones, con su CUERPO COMPLETO: el de
--     partida (pre-vuelo) con `pausado_en` junto a `revocado_en` como única
--     diferencia.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserva_contexto(p_codigo_hash text, p_aviso_version text, p_aviso_sha256 text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_e  public.reserva_enlaces%ROWTYPE;
  v_p  record;
  v_aj record;
BEGIN
  IF p_codigo_hash IS NULL OR p_codigo_hash !~ '^[0-9a-f]{64}$' OR p_aviso_version IS NULL OR p_aviso_sha256 IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT e.* INTO v_e FROM public.reserva_enlaces e WHERE e.codigo_hash = p_codigo_hash;
  IF NOT FOUND OR v_e.revocado_en IS NOT NULL OR v_e.pausado_en IS NOT NULL THEN RETURN NULL; END IF;
  SELECT j.anticipacion_min_horas, j.horizonte_dias INTO v_aj
    FROM public.agenda_ajustes j WHERE j.clinica_id = v_e.clinica_id AND j.agenda_v2_encendida;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.reserva_avisos a
                  WHERE a.version = p_aviso_version AND a.texto_sha256 = p_aviso_sha256 AND a.aprobado) THEN
    RETURN NULL;
  END IF;
  IF NOT public.gcal_sync_clinica_habilitada(v_e.clinica_id) THEN RETURN NULL; END IF;
  SELECT p.titulo, p.nombres, p.apellido_paterno, p.apellido_materno, p.especialidad, p.telefono_consultorio INTO v_p
    FROM public.profiles p WHERE p.id = v_e.medico_id AND p.clinica_id = v_e.clinica_id AND p.role = 'medico';
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'clinica_id', v_e.clinica_id, 'enlace_id', v_e.id, 'medico_id', v_e.medico_id, 'clase', v_e.clase,
    'estado', CASE WHEN v_e.clase = 'unico' AND v_e.usado_en IS NOT NULL THEN 'usado'
                   WHEN v_e.clase = 'unico' AND v_e.caduca_en <= now() THEN 'caducado'
                   WHEN v_e.clase = 'unico' AND v_e.agotado_en IS NOT NULL THEN 'agotado' ELSE 'vigente' END,
    'medico', jsonb_build_object('titulo', v_p.titulo, 'nombres', v_p.nombres, 'apellido_paterno', v_p.apellido_paterno,
                                 'apellido_materno', v_p.apellido_materno, 'especialidad', v_p.especialidad,
                                 'telefono', v_p.telefono_consultorio),
    'clinica', (SELECT jsonb_build_object('nombre', c.nombre, 'nombre_display', c.nombre_display, 'horario', c.horario_consulta)
                  FROM public.clinicas c WHERE c.id = v_e.clinica_id),
    'consultorios', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'direccion', c.direccion,
                       'telefono', c.telefono, 'timezone', c.timezone, 'horario', c.horario, 'horario_propio', c.horario_propio)
                       ORDER BY c.es_default DESC, c.nombre), '[]'::jsonb)
                       FROM public.consultorios c
                      WHERE c.clinica_id = v_e.clinica_id AND c.medico_id = v_e.medico_id AND c.activo),
    'tipos', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'nombre', t.nombre, 'duracion_min', t.duracion_min,
                                                         'consultorio_id', t.consultorio_id, 'principal', t.principal)
                ORDER BY t.nombre), '[]'::jsonb)
                FROM public.tipos_cita t
               WHERE t.clinica_id = v_e.clinica_id AND t.activo AND (t.medico_id IS NULL OR t.medico_id = v_e.medico_id)),
    'ajustes', jsonb_build_object('anticipacion_min_horas', v_aj.anticipacion_min_horas, 'horizonte_dias', v_aj.horizonte_dias));
END
$fn$;

CREATE OR REPLACE FUNCTION public.reservar_por_enlace(p_clinica_id uuid, p_codigo_hash text, p_consultorio_id uuid, p_tipo_cita_id uuid, p_inicio timestamp with time zone, p_nombre text, p_telefono text, p_correo text, p_tel_hmac text, p_correo_hmac text, p_ficha_hmac text, p_aviso_version text, p_aviso_sha256 text, p_client_id uuid)
RETURNS TABLE(r_resultado text, r_cita_id uuid, r_inicio timestamp with time zone, r_fin timestamp with time zone, r_historial integer)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_enl   public.reserva_enlaces%ROWTYPE;
  v_aj    record;
  v_con   record;
  v_tipo  record;
  v_hist  record;
  v_verif uuid;
  v_fin   timestamptz;
  v_id    uuid;
  -- j2 (punto 3): el correo que cuenta. En el ÚNICO, el que escribió la
  -- clínica al emitir el enlace (o ninguno); en el FIJO, el verificado.
  v_correo      text;
  v_correo_hmac text;
  -- j2 (punto 3): intentos que admite un enlace único (ver la cabecera).
  c_tope_unico CONSTANT integer := 5;
  v_restr      text;
BEGIN
  -- i2: p_correo y p_correo_hmac son opcionales, pero LOS DOS JUNTOS.
  IF p_clinica_id IS NULL OR p_codigo_hash IS NULL OR p_consultorio_id IS NULL OR p_tipo_cita_id IS NULL
     OR p_inicio IS NULL OR p_nombre IS NULL OR p_telefono IS NULL OR p_tel_hmac IS NULL
     OR (p_correo IS NULL) <> (p_correo_hmac IS NULL)
     OR p_aviso_version IS NULL OR p_aviso_sha256 IS NULL OR p_client_id IS NULL THEN
    RAISE EXCEPTION 'reservar_por_enlace: argumentos obligatorios en NULL' USING ERRCODE = '22023';
  END IF;
  IF btrim(p_nombre) = '' OR char_length(p_nombre) > 120 OR p_telefono !~ '^[0-9]{10}$'
     OR (p_correo IS NOT NULL AND (char_length(p_correo) NOT BETWEEN 3 AND 254 OR position('@' IN p_correo) = 0))
     OR p_codigo_hash !~ '^[0-9a-f]{64}$' OR p_tel_hmac !~ '^[0-9a-f]{64}$' OR p_correo_hmac !~ '^[0-9a-f]{64}$'
     OR (p_ficha_hmac IS NOT NULL AND p_ficha_hmac !~ '^[0-9a-f]{64}$')
     OR date_trunc('minute', p_inicio) <> p_inicio THEN
    RAISE EXCEPTION 'reservar_por_enlace: datos con forma inválida' USING ERRCODE = '22023';
  END IF;

  -- La garantía de un solo turno exige READ COMMITTED: cada sentencia después
  -- del candado toma una instantánea nueva y ve la reserva que ganó. En
  -- REPEATABLE READ o SERIALIZABLE la instantánea es la del inicio y el
  -- empalme no se vería. PostgREST usa READ COMMITTED; si alguien lo cambia,
  -- esto falla cerrado en vez de duplicar turnos.
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'reservar_por_enlace: requiere READ COMMITTED (es %)', current_setting('transaction_isolation')
      USING ERRCODE = '25001';
  END IF;

  -- El enlace, bloqueado: dos reservas con el mismo enlace se serializan.
  SELECT e.* INTO v_enl FROM public.reserva_enlaces e
   WHERE e.codigo_hash = p_codigo_hash AND e.clinica_id = p_clinica_id
   FOR UPDATE;
  IF NOT FOUND OR v_enl.revocado_en IS NOT NULL OR v_enl.pausado_en IS NOT NULL THEN
    r_resultado := 'enlace_invalido'; RETURN NEXT; RETURN;
  END IF;

  -- Candado por médico (empalme y candado de persona en la misma sección).
  PERFORM pg_advisory_xact_lock(1790, hashtext(v_enl.medico_id::text));

  -- Idempotencia: el mismo envío ya entró.
  SELECT a.id, a.start_time, a.end_time INTO v_id, r_inicio, r_fin FROM public.appointments a
   WHERE a.client_id = p_client_id::text AND a.clinica_id = p_clinica_id AND a.reserva_enlace_id = v_enl.id;
  IF FOUND THEN
    r_resultado := 'repetida'; r_cita_id := v_id; RETURN NEXT; RETURN;
  END IF;
  r_inicio := NULL; r_fin := NULL;

  IF v_enl.clase = 'unico' AND v_enl.usado_en IS NOT NULL THEN
    r_resultado := 'enlace_usado'; RETURN NEXT; RETURN;
  END IF;
  IF v_enl.clase = 'unico' AND v_enl.caduca_en <= now() THEN
    r_resultado := 'enlace_caducado'; RETURN NEXT; RETURN;
  END IF;

  -- j2 (punto 3): el ÚNICO cuenta cada intento que llega aquí (un reenvío del
  -- mismo client_id ya salió arriba como 'repetida' y no cuenta). Agotado, no
  -- sirve más y no dice por qué. El intento número c_tope_unico es el último:
  -- lo marca agotado al empezar, y si reserva queda además usado. Bajo el
  -- FOR UPDATE del enlace: dos intentos a la vez se cuentan los dos.
  -- El correo del único es el de la clínica (v_enl.correo), NUNCA p_correo.
  IF v_enl.clase = 'unico' THEN
    IF v_enl.agotado_en IS NOT NULL THEN
      r_resultado := 'enlace_agotado'; RETURN NEXT; RETURN;
    END IF;
    UPDATE public.reserva_enlaces
       SET intentos = intentos + 1,
           agotado_en = CASE WHEN intentos + 1 >= c_tope_unico THEN now() END
     WHERE id = v_enl.id AND clinica_id = p_clinica_id;
    v_correo := v_enl.correo;
    v_correo_hmac := v_enl.correo_hmac;
    -- Auditoría de j2 (H1): un client_id que ya usó OTRA cita haría fallar el
    -- INSERT de abajo (índice único) y la excepción desharía este conteo: con
    -- él se probarían teléfonos sin gastar el enlace. Se corta aquí, ANTES de
    -- mirar nada de la persona, y el intento queda contado.
    IF EXISTS (SELECT 1 FROM public.appointments a WHERE a.client_id = p_client_id::text) THEN
      r_resultado := 'client_id_en_uso'; RETURN NEXT; RETURN;
    END IF;
  ELSE
    v_correo := p_correo;
    v_correo_hmac := p_correo_hmac;
  END IF;

  SELECT j.anticipacion_min_horas, j.horizonte_dias, j.candado_citas_activas INTO v_aj
    FROM public.agenda_ajustes j WHERE j.clinica_id = p_clinica_id AND j.agenda_v2_encendida;
  IF NOT FOUND THEN
    r_resultado := 'apagado'; RETURN NEXT; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.reserva_avisos a
                  WHERE a.version = p_aviso_version AND a.texto_sha256 = p_aviso_sha256 AND a.aprobado) THEN
    r_resultado := 'aviso_no_aprobado'; RETURN NEXT; RETURN;
  END IF;
  IF NOT public.gcal_sync_clinica_habilitada(p_clinica_id) THEN
    r_resultado := 'clinica_sin_acceso'; RETURN NEXT; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p
                  WHERE p.id = v_enl.medico_id AND p.clinica_id = p_clinica_id AND p.role = 'medico') THEN
    r_resultado := 'enlace_invalido'; RETURN NEXT; RETURN;
  END IF;

  SELECT c.id, c.nombre, c.nombre_corto, c.direccion, c.telefono, c.timezone INTO v_con
    FROM public.consultorios c
   WHERE c.id = p_consultorio_id AND c.clinica_id = p_clinica_id AND c.medico_id = v_enl.medico_id AND c.activo;
  IF NOT FOUND THEN
    r_resultado := 'consultorio_invalido'; RETURN NEXT; RETURN;
  END IF;
  SELECT t.id, t.nombre, t.duracion_min INTO v_tipo
    FROM public.tipos_cita t
   WHERE t.id = p_tipo_cita_id AND t.clinica_id = p_clinica_id AND t.activo
     AND (t.medico_id IS NULL OR t.medico_id = v_enl.medico_id);
  IF NOT FOUND THEN
    r_resultado := 'tipo_invalido'; RETURN NEXT; RETURN;
  END IF;
  v_fin := p_inicio + make_interval(mins => v_tipo.duracion_min);

  IF p_inicio < now() + make_interval(hours => v_aj.anticipacion_min_horas)
     OR p_inicio >= now() + make_interval(days => v_aj.horizonte_dias) THEN
    r_resultado := 'fuera_de_ventana'; RETURN NEXT; RETURN;
  END IF;

  -- k1 (tanda K, punto 4): lo de TODO EL DÍA ya no ocupa en el enlace (un
  -- «Congreso» de todo el día no significa que no consulte); lo que tiene hora
  -- sí, como siempre. Punto 2: un bloqueo del médico (agenda_bloqueos) ocupa,
  -- sin excepción, con el mismo solape. Los dos son EXISTS: no lanzan, así
  -- que nada nuevo después del contador del único puede reventar. El bloqueo
  -- se escribe bajo el mismo candado 1790 (agenda_bloqueo_preparar): uno
  -- confirmado antes de este candado se ve aquí (READ COMMITTED).
  IF EXISTS (SELECT 1 FROM public.appointments a
              WHERE a.clinica_id = p_clinica_id AND a.medico_id = v_enl.medico_id
                AND a.start_time < v_fin AND a.end_time > p_inicio
                AND a.status NOT IN ('cancelled', 'no_show')
                AND NOT a.all_day)
     OR EXISTS (SELECT 1 FROM public.agenda_bloqueos b
                 WHERE b.clinica_id = p_clinica_id AND b.medico_id = v_enl.medico_id
                   AND b.inicio < v_fin AND b.fin > p_inicio) THEN
    r_resultado := 'ocupado'; RETURN NEXT; RETURN;
  END IF;

  -- seg1 (punto 1): en el fijo, el correo verificado se exige ANTES de mirar
  -- nada de la persona. j2: v_correo_hmac es p_correo_hmac en el fijo. Sin ficha, la respuesta y el trabajo son los mismos
  -- para cualquier teléfono. i2: sin correo, el fijo no reserva (lo mismo que
  -- una ficha que no casa).
  IF v_enl.clase = 'fijo' THEN
    IF v_correo_hmac IS NULL THEN
      r_resultado := 'correo_sin_verificar'; RETURN NEXT; RETURN;
    END IF;
    SELECT r.id INTO v_verif FROM public.reserva_verificaciones r
     WHERE r.ficha_hmac = p_ficha_hmac AND r.clinica_id = p_clinica_id AND r.enlace_id = v_enl.id
       AND r.correo_hmac = v_correo_hmac AND r.verificado_en IS NOT NULL AND r.consumida_en IS NULL
       AND r.ficha_caduca_en > now()
     FOR UPDATE;
    IF NOT FOUND THEN
      r_resultado := 'correo_sin_verificar'; RETURN NEXT; RETURN;
    END IF;
  END IF;

  -- seg1 (puntos 2 y 6): lo automático (cancelaciones e inasistencias, «1
  -- activa») decide por el CORREO; el bloqueo MANUAL de la clínica, por
  -- teléfono o correo, y corta también el enlace único. i2: sin correo,
  -- p_correo_hmac es NULL y decide sólo el teléfono (el bloqueo manual).
  SELECT * INTO v_hist FROM public.reserva_contacto_estado(p_clinica_id, v_enl.medico_id, p_tel_hmac, v_correo_hmac);
  IF v_hist.manual OR (v_enl.clase = 'fijo' AND v_hist.bloqueado) THEN
    -- j2 (punto 3): en el ÚNICO, «bloqueado» agota el enlace. Es el intento que
    -- revela algo de la persona (AG-DT-28): con esto un único deja probar UN
    -- teléfono, no uno tras otro (AG-DT-101). El que no está bloqueado reserva
    -- y gasta el enlace, así que de un único sale como mucho una respuesta.
    IF v_enl.clase = 'unico' THEN
      UPDATE public.reserva_enlaces SET agotado_en = coalesce(agotado_en, now())
       WHERE id = v_enl.id AND clinica_id = p_clinica_id;
    END IF;
    r_resultado := 'bloqueado'; RETURN NEXT; RETURN;
  END IF;
  IF v_enl.clase = 'fijo'
     AND (SELECT count(*) FROM public.appointments a
           WHERE a.clinica_id = p_clinica_id AND a.medico_id = v_enl.medico_id AND a.reserva_canal IS NOT NULL
             AND a.reserva_correo_hmac = v_correo_hmac
             AND a.status IN ('scheduled', 'confirmed') AND a.end_time > now()) >= v_aj.candado_citas_activas THEN
    r_resultado := 'ya_tiene_cita'; RETURN NEXT; RETURN;
  END IF;

  -- i2: el id lo pone la función para que la reserva SIN correo lleve, en el
  -- mismo INSERT, su seudónimo propio (ver la cabecera de la migración).
  v_id := gen_random_uuid();
  -- j2-b: el INSERT va en su propio bloque. Si otra transacción que este candado no
  -- serializa (otro médico) confirma antes una cita con el mismo client_id, el índice
  -- único revienta aquí; sin el bloque, la excepción desharía también el conteo del
  -- único de arriba y ese intento no contaría. Sólo se atrapa ESE índice; lo demás sube.
  BEGIN
    INSERT INTO public.appointments (
      id, clinica_id, paciente_id, created_by, medico_id, title, start_time, end_time, status, origen, all_day, client_id,
      gcal_sync_status,
      consultorio_id, consultorio_nombre, consultorio_nombre_corto, consultorio_direccion, consultorio_telefono,
      consultorio_timezone, tipo_cita_id, tipo_cita_nombre,
      reserva_enlace_id, reserva_canal, reserva_nombre, reserva_telefono, reserva_correo, reserva_tel_hmac,
      reserva_correo_hmac, reserva_aviso_version, reserva_aceptado_en, reserva_historial_previo)
    VALUES (
      v_id, p_clinica_id, NULL, NULL, v_enl.medico_id, btrim(p_nombre), p_inicio, v_fin, 'scheduled', 'spinus', false, p_client_id::text,
      'pending',
      v_con.id, v_con.nombre, v_con.nombre_corto, v_con.direccion, v_con.telefono, v_con.timezone, v_tipo.id, v_tipo.nombre,
      v_enl.id, v_enl.clase, btrim(p_nombre), p_telefono, btrim(v_correo), p_tel_hmac,
      coalesce(v_correo_hmac, encode(sha256(convert_to('reserva-sin-correo:' || v_id::text, 'UTF8')), 'hex')),
      p_aviso_version, now(), coalesce(v_hist.cancelaciones, 0) + coalesce(v_hist.no_shows, 0));
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_restr = CONSTRAINT_NAME;
    IF v_restr IS DISTINCT FROM 'idx_appointments_client_id' THEN
      RAISE;
    END IF;
    r_resultado := 'client_id_en_uso'; RETURN NEXT; RETURN;
  END;

  IF v_enl.clase = 'unico' THEN
    UPDATE public.reserva_enlaces SET usado_en = now(), usado_cita_id = v_id
     WHERE id = v_enl.id AND clinica_id = p_clinica_id;
  ELSE
    UPDATE public.reserva_verificaciones SET consumida_en = now() WHERE id = v_verif;
  END IF;

  -- Además de cita_alta ('system') de log_cita_change: quién fue el canal. Sin datos personales.
  INSERT INTO public.audit_log (user_id, accion, tabla, registro_id, descripcion)
  VALUES ('system', 'cita_reservada_enlace', 'appointments', v_id,
          jsonb_build_object('clinica_id', p_clinica_id, 'enlace_id', v_enl.id, 'canal', v_enl.clase,
                             'aviso', p_aviso_version)::text);

  r_resultado := 'ok'; r_cita_id := v_id; r_inicio := p_inicio; r_fin := v_fin;
  r_historial := coalesce(v_hist.cancelaciones, 0) + coalesce(v_hist.no_shows, 0);
  RETURN NEXT;
END
$fn$;

CREATE OR REPLACE FUNCTION public.reagendar_por_enlace(p_confirmacion_hash text, p_clinica_id uuid, p_codigo_hash text, p_consultorio_id uuid, p_tipo_cita_id uuid, p_inicio timestamp with time zone, p_nombre text, p_telefono text, p_correo text, p_tel_hmac text, p_correo_hmac text, p_ficha_hmac text, p_aviso_version text, p_aviso_sha256 text, p_client_id uuid)
RETURNS TABLE(r_resultado text, r_cita_id uuid, r_inicio timestamp with time zone, r_fin timestamp with time zone, r_historial integer)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_c    public.cita_confirmaciones%ROWTYPE;
  v_a    record;
  v_e    record;
  v_tope integer;
  v_prev record;
  v_r    record;
BEGIN
  IF p_confirmacion_hash IS NULL OR p_confirmacion_hash !~ '^[0-9a-f]{64}$' OR p_clinica_id IS NULL
     OR p_codigo_hash IS NULL OR p_client_id IS NULL THEN
    RAISE EXCEPTION 'reagendar_por_enlace: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  SELECT c.* INTO v_c FROM public.cita_confirmaciones c
   WHERE c.codigo_hash = p_confirmacion_hash AND c.clinica_id = p_clinica_id AND c.revocado_en IS NULL
   FOR UPDATE;
  IF NOT FOUND OR v_c.respuesta IS DISTINCT FROM 'cancelo'
     -- Suspendida = no disponible (el cierre de E1).
     OR NOT EXISTS (SELECT 1 FROM public.clinicas k WHERE k.id = p_clinica_id AND NOT k.suspendida) THEN
    r_resultado := 'reagendar_invalido'; RETURN NEXT; RETURN;
  END IF;
  -- La cita de origen, bloqueada: el personal no la reactiva mientras tanto.
  SELECT a.id, a.status, a.medico_id, a.reserva_reagendados, a.paciente_id, a.reserva_correo_hmac INTO v_a
    FROM public.appointments a WHERE a.id = v_c.appointment_id AND a.clinica_id = p_clinica_id
   FOR UPDATE;
  IF NOT FOUND OR v_a.status <> 'cancelled' OR v_a.medico_id IS NULL
     OR NOT public.cita_confirmacion_coincide(v_c.paciente_id, v_c.reserva_correo_hmac, v_a.paciente_id, v_a.reserva_correo_hmac) THEN
    r_resultado := 'reagendar_invalido'; RETURN NEXT; RETURN;
  END IF;
  -- Idempotencia: el mismo envío ya reagendó; otro envío, ya está reagendada.
  SELECT r.cita_nueva_id, n.start_time, n.end_time, n.client_id INTO v_prev
    FROM public.cita_reagendos r JOIN public.appointments n ON n.id = r.cita_nueva_id AND n.clinica_id = p_clinica_id
   WHERE r.cita_origen_id = v_a.id AND r.clinica_id = p_clinica_id;
  IF FOUND THEN
    IF v_prev.client_id = p_client_id::text THEN
      r_resultado := 'repetida'; r_cita_id := v_prev.cita_nueva_id; r_inicio := v_prev.start_time; r_fin := v_prev.end_time;
    ELSE
      r_resultado := 'ya_reagendada';
    END IF;
    RETURN NEXT; RETURN;
  END IF;
  IF v_c.respondido_en <= now() - interval '7 days' THEN
    r_resultado := 'reagendar_invalido'; RETURN NEXT; RETURN;
  END IF;
  SELECT e.medico_id, e.clase INTO v_e FROM public.reserva_enlaces e
   WHERE e.codigo_hash = p_codigo_hash AND e.clinica_id = p_clinica_id AND e.revocado_en IS NULL AND e.pausado_en IS NULL;
  IF NOT FOUND OR v_e.clase <> 'fijo' OR v_e.medico_id <> v_a.medico_id THEN
    r_resultado := 'reagendar_invalido'; RETURN NEXT; RETURN;
  END IF;
  SELECT j.candado_reagendados INTO v_tope FROM public.agenda_ajustes j
   WHERE j.clinica_id = p_clinica_id AND j.agenda_v2_encendida;
  IF NOT FOUND THEN r_resultado := 'apagado'; RETURN NEXT; RETURN; END IF;
  IF v_a.reserva_reagendados >= v_tope THEN r_resultado := 'tope_reagendados'; RETURN NEXT; RETURN; END IF;

  SELECT x.* INTO v_r FROM public.reservar_por_enlace(
    p_clinica_id, p_codigo_hash, p_consultorio_id, p_tipo_cita_id, p_inicio, p_nombre, p_telefono, p_correo,
    p_tel_hmac, p_correo_hmac, p_ficha_hmac, p_aviso_version, p_aviso_sha256, p_client_id) x;
  IF v_r.r_resultado = 'repetida' THEN
    -- D3 reconoció un envío que NO es el reagendado de este origen (ése lo
    -- atrapa la idempotencia de arriba): no se da por reagendado.
    r_resultado := 'reagendar_invalido'; RETURN NEXT; RETURN;
  END IF;
  IF v_r.r_resultado = 'ok' THEN
    -- Lo hizo la persona por el enlace de su cita (lista blanca de E1).
    PERFORM set_config('spinus.via', 'enlace_paciente', true);
    UPDATE public.appointments SET reserva_reagendados = v_a.reserva_reagendados + 1
     WHERE id = v_r.r_cita_id AND clinica_id = p_clinica_id;
    INSERT INTO public.cita_reagendos (clinica_id, cita_origen_id, cita_nueva_id, confirmacion_id, numero)
    VALUES (p_clinica_id, v_a.id, v_r.r_cita_id, v_c.id, v_a.reserva_reagendados + 1);
    -- set_config(…, true) dura hasta el fin de la TRANSACCIÓN, no de la función:
    -- se limpia para que nada de lo que siga en ella herede el «via».
    PERFORM set_config('spinus.via', '', true);
  END IF;
  r_resultado := v_r.r_resultado; r_cita_id := v_r.r_cita_id; r_inicio := v_r.r_inicio;
  r_fin := v_r.r_fin; r_historial := v_r.r_historial;
  RETURN NEXT;
END
$fn$;

CREATE OR REPLACE FUNCTION public.cita_reagendar_oferta(p_clinica_id uuid, p_codigo_hash text)
RETURNS TABLE(r_enlace_id uuid, r_motivo text)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_c    public.cita_confirmaciones%ROWTYPE;
  v_a    record;
  v_tope integer;
BEGIN
  IF p_clinica_id IS NULL OR p_codigo_hash IS NULL OR p_codigo_hash !~ '^[0-9a-f]{64}$' THEN
    r_motivo := 'no_aplica'; RETURN NEXT; RETURN;
  END IF;
  -- Suspendida = no disponible (el cierre de E1).
  IF NOT EXISTS (SELECT 1 FROM public.clinicas k WHERE k.id = p_clinica_id AND NOT k.suspendida) THEN
    r_motivo := 'no_aplica'; RETURN NEXT; RETURN;
  END IF;
  SELECT c.* INTO v_c FROM public.cita_confirmaciones c
   WHERE c.codigo_hash = p_codigo_hash AND c.clinica_id = p_clinica_id AND c.revocado_en IS NULL;
  SELECT j.candado_reagendados INTO v_tope FROM public.agenda_ajustes j
   WHERE j.clinica_id = p_clinica_id AND j.agenda_v2_encendida;
  IF v_c.id IS NULL OR v_tope IS NULL OR v_c.respuesta IS DISTINCT FROM 'cancelo' THEN
    r_motivo := 'no_aplica'; RETURN NEXT; RETURN;
  END IF;
  SELECT a.id, a.status, a.medico_id, a.reserva_reagendados, a.paciente_id, a.reserva_correo_hmac INTO v_a
    FROM public.appointments a WHERE a.id = v_c.appointment_id AND a.clinica_id = p_clinica_id;
  IF NOT FOUND OR v_a.status <> 'cancelled' OR v_a.medico_id IS NULL
     OR NOT public.cita_confirmacion_coincide(v_c.paciente_id, v_c.reserva_correo_hmac, v_a.paciente_id, v_a.reserva_correo_hmac) THEN
    r_motivo := 'no_aplica'; RETURN NEXT; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.cita_reagendos r WHERE r.cita_origen_id = v_a.id AND r.clinica_id = p_clinica_id) THEN
    r_motivo := 'ya_reagendada'; RETURN NEXT; RETURN;
  END IF;
  IF v_c.respondido_en <= now() - interval '7 days' THEN r_motivo := 'vencida'; RETURN NEXT; RETURN; END IF;
  IF v_a.reserva_reagendados >= v_tope THEN r_motivo := 'tope'; RETURN NEXT; RETURN; END IF;
  SELECT e.id INTO r_enlace_id FROM public.reserva_enlaces e
   WHERE e.clinica_id = p_clinica_id AND e.medico_id = v_a.medico_id AND e.clase = 'fijo' AND e.revocado_en IS NULL AND e.pausado_en IS NULL;
  r_motivo := CASE WHEN r_enlace_id IS NULL THEN 'sin_enlace' ELSE 'ok' END;
  RETURN NEXT;
END
$fn$;

CREATE OR REPLACE FUNCTION public.reserva_ocupacion(p_clinica_id uuid, p_enlace_id uuid, p_desde timestamp with time zone, p_hasta timestamp with time zone)
RETURNS TABLE(start_time timestamp with time zone, end_time timestamp with time zone)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
  -- k1 (tanda K): lo que tiene hora y no está cancelado ni faltó (lo de TODO
  -- EL DÍA ya no ocupa, punto 4) y los bloqueos del médico (punto 2).
  SELECT o.start_time, o.end_time
    FROM public.reserva_enlaces e
    JOIN public.agenda_ajustes j ON j.clinica_id = e.clinica_id AND j.agenda_v2_encendida
    CROSS JOIN LATERAL (
      SELECT a.start_time, a.end_time
        FROM public.appointments a
       WHERE a.clinica_id = e.clinica_id AND a.medico_id = e.medico_id
         AND a.start_time < p_hasta AND a.end_time > p_desde
         AND a.status NOT IN ('cancelled', 'no_show')
         AND NOT a.all_day
      UNION ALL
      SELECT b.inicio, b.fin
        FROM public.agenda_bloqueos b
       WHERE b.clinica_id = e.clinica_id AND b.medico_id = e.medico_id
         AND b.inicio < p_hasta AND b.fin > p_desde
    ) o
   WHERE e.id = p_enlace_id AND e.clinica_id = p_clinica_id AND e.revocado_en IS NULL AND e.pausado_en IS NULL
     AND p_hasta > p_desde AND p_hasta - p_desde <= interval '15 days'
   ORDER BY o.start_time;
$fn$;

CREATE OR REPLACE FUNCTION public.reserva_codigo_emitir(p_clinica_id uuid, p_enlace_id uuid, p_correo_hmac text, p_codigo_hmac text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF p_clinica_id IS NULL OR p_enlace_id IS NULL OR p_correo_hmac IS NULL OR p_codigo_hmac IS NULL
     OR p_correo_hmac !~ '^[0-9a-f]{64}$' OR p_codigo_hmac !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'reserva_codigo_emitir: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.reserva_enlaces e
                   JOIN public.agenda_ajustes j ON j.clinica_id = e.clinica_id AND j.agenda_v2_encendida
                  WHERE e.id = p_enlace_id AND e.clinica_id = p_clinica_id AND e.clase = 'fijo' AND e.revocado_en IS NULL AND e.pausado_en IS NULL)
     OR NOT public.gcal_sync_clinica_habilitada(p_clinica_id) THEN
    RETURN 'enlace_invalido';
  END IF;
  UPDATE public.reserva_verificaciones SET intentos = 5
   WHERE clinica_id = p_clinica_id AND enlace_id = p_enlace_id AND correo_hmac = p_correo_hmac
     AND verificado_en IS NULL AND intentos < 5;
  -- clock_timestamp(): dos códigos pedidos en la misma transacción no empatan
  -- en created_at, que es por donde verificar elige el último.
  INSERT INTO public.reserva_verificaciones (clinica_id, enlace_id, correo_hmac, codigo_hmac, caduca_en, created_at)
  VALUES (p_clinica_id, p_enlace_id, p_correo_hmac, p_codigo_hmac, now() + interval '10 minutes', clock_timestamp());
  RETURN 'ok';
END
$fn$;

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
  p record;
BEGIN
  FOR p IN SELECT f.firma, f.md5, pr.oid, pr.prosrc, pr.prosecdef
             FROM (VALUES
               ('public.reserva_contexto(text, text, text)', 'e8be3201d2192ccef16766db72b05271'),
               ('public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)', 'be25c16726eb90839767fd4bd9176195'),
               ('public.reagendar_por_enlace(text, uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)', '54b257ed431bb7061092fe4fd26f0a02'),
               ('public.cita_reagendar_oferta(uuid, text)', 'dbcd8da825f4db80b20f554d37cc65c5'),
               ('public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz)', 'f1701599edf6756887fbb01a8c18464f'),
               ('public.reserva_codigo_emitir(uuid, uuid, text, text)', 'd24c01e93ce43ae8b75013010a7cb1fd')
             ) AS f(firma, md5)
             JOIN pg_proc pr ON pr.oid = to_regprocedure(f.firma) LOOP
    IF md5(p.prosrc) <> p.md5 OR p.prosrc NOT LIKE '%pausado_en IS %NULL%' OR p.prosecdef
       OR has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
       OR NOT has_function_privilege('service_role', p.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'POST-VUELO FALLÓ: % no quedó con su cuerpo (md5 %), con la guarda de «pausado», INVOKER y sólo service_role.', p.firma, md5(p.prosrc);
    END IF;
  END LOOP;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.proteger_reserva_enlaces()')) <> 'acd4128b5f25df54f6b4fd95391cf1dc' THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: proteger_reserva_enlaces() cambió.';
  END IF;
END $$;

COMMIT;

-- ---------------------------------------------------------------------
-- 5 · Veredicto (sólo lectura, después del COMMIT). Todo «OK».
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
  SELECT v.n, v.firma || ': cuerpo de esta (md5) con «pausado» / invoker / anon authenticated service_role PUBLIC',
         coalesce((SELECT (md5(p.prosrc) = v.md5 AND p.prosrc LIKE '%pausado_en IS %NULL%')::text || ' / ' || p.prosecdef::text || ' / '
                          || has_function_privilege('anon', p.oid, 'EXECUTE')::text || ' ' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                          || ' ' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text || ' '
                          || EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                      WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure(v.firma)), 'AUSENTE'),
         'true / false / false false true false'
    FROM (VALUES
           (3, 'public.reserva_contexto(text, text, text)', 'e8be3201d2192ccef16766db72b05271'),
           (4, 'public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)', 'be25c16726eb90839767fd4bd9176195'),
           (5, 'public.reagendar_por_enlace(text, uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)', '54b257ed431bb7061092fe4fd26f0a02'),
           (6, 'public.cita_reagendar_oferta(uuid, text)', 'dbcd8da825f4db80b20f554d37cc65c5'),
           (7, 'public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz)', 'f1701599edf6756887fbb01a8c18464f'),
           (8, 'public.reserva_codigo_emitir(uuid, uuid, text, text)', 'd24c01e93ce43ae8b75013010a7cb1fd')
         ) AS v(n, firma, md5)
  UNION ALL
  SELECT 9, 'proteger_reserva_enlaces() intacto (md5 de prosrc)',
         coalesce((SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.proteger_reserva_enlaces()')), 'AUSENTE'),
         'acd4128b5f25df54f6b4fd95391cf1dc'
) t ORDER BY t.n;
