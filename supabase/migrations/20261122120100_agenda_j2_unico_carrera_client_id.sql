-- ═══════════════════════════════════════════════════════════════════════
-- Agenda · tanda J, agente J2 (punto 3, segunda parte) — el intento del
-- único no se deshace con un client_id en carrera.
-- Rama: feature/agenda-v2-j2 · Escrita: 2026-11-18
-- Riesgo estimado: BAJO (CREATE OR REPLACE de reservar_por_enlace, con un
-- único cambio: el INSERT de la cita va en un bloque propio que atrapa el
-- unique_violation de idx_appointments_client_id. Ni columnas, ni filas, ni
-- policies, ni otras funciones).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: ver «APLICACIÓN LOCAL» al pie de la cabecera.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR, justo DESPUÉS de
--   20261122120000_agenda_j2_unico_tope_correo y antes del código de la rama.
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- 20261122120000 cuenta cada intento de un único con un UPDATE dentro de la
-- transacción de reservar_por_enlace. Lo que reviente DESPUÉS de contar
-- deshace el conteo, y por eso comprueba `client_id_en_uso` con un EXISTS
-- justo después de contar. Esa comprobación NO basta en carrera (revisión de
-- seguridad del orquestador, MEDIA, TOCTOU): si otra transacción que el
-- candado 1790 no serializa (una reserva con un enlace de OTRO médico, o
-- cualquier otro INSERT con ese client_id) tiene sin confirmar una cita con
-- el mismo client_id, el EXISTS no la ve, el único cuenta, y el INSERT espera
-- al índice único y revienta al confirmar la otra: la excepción revierte la
-- transacción entera y el intento no cuenta.
-- Cuándo NO pasa (comprobado en el cuerpo): con el MISMO enlace, el FOR
-- UPDATE serializa y la segunda sale 'repetida' antes de contar; con dos
-- enlaces del MISMO médico, el candado 1790 serializa y el EXISTS (sentencia
-- nueva en READ COMMITTED, tras el candado) ve la cita confirmada.
-- Las demás salidas por excepción después de contar no las provoca quien
-- reserva: los disparadores de INSERT de appointments (cita_proteger_reserva,
-- cita_proteger_cierre, cita_asignacion_google, aviso_clinica_de_cita,
-- log_cita_change) no fallan con lo que esta función escribe, y la forma de
-- los datos se valida ANTES de contar (22023). Lo que queda sin atrapar
-- (deadlock, statement/lock timeout, el borrado concurrente del consultorio
-- o del tipo por un administrador, 23503) no lo controla quien reserva con
-- los datos de la ruta; atraparlo escondería errores reales.
--
-- ═══ QUÉ CAMBIA ════════════════════════════════════════════════════════
-- public.reservar_por_enlace: el cuerpo de 20261122120000 con el INSERT de
--   la cita dentro de BEGIN … EXCEPTION WHEN unique_violation. Si la
--   restricción es idx_appointments_client_id, devuelve 'client_id_en_uso'
--   (el mismo resultado y el mismo 400 genérico que ya existían). Si es otra,
--   RAISE: sube igual que antes. El bloque abre una subtransacción que sólo
--   deshace el INSERT; el conteo y el agotado, hechos antes y fuera del
--   bloque, quedan. Vale también para el fijo, que en esa carrera daba un
--   500 y ahora el 400 de client_id_en_uso sin consumir la ficha.
--   REVOKE/GRANT explícitos de nuevo (sólo service_role); COMMENT al día.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere: 20261122120000 (su cuerpo de reservar_por_enlace, md5 5d8c6c55…).
-- Bloqueos: ninguno sobre tablas (CREATE OR REPLACE FUNCTION).
-- Orden respecto al código: indiferente; el código ya trata client_id_en_uso.
-- Contrato con spinus-consola: no toca nada de lo que la consola lee.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
-- Volver a pegar reservar_por_enlace de 20261122120000 con sus REVOKE/GRANT.
--
-- ═══ APLICACIÓN LOCAL ══════════════════════════════════════════════════
-- 2026-11-18: ensayo con ROLLBACK y dos pasadas, bajo flock, en la base
--   local compartida. Prueba: escenario 5 de scripts/reserva-carrera.sh (en
--   rojo con el cuerpo de 20261122120000; en verde con este).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  -- md5(prosrc): el cuerpo de 20261122120000 y el de esta (segunda pasada).
  c_reserva_j2   CONSTANT text := '5d8c6c55d852222bdb2f779b1f4afb76';
  c_reserva_j2b  CONSTANT text := '1a448df0732e62754fb428b1892d45e8';
  v_reserva oid := to_regprocedure('public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)');
  v_md5 text;
BEGIN
  IF v_reserva IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta reservar_por_enlace con su firma de D3.';
  END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid = v_reserva) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: reservar_por_enlace es SECURITY DEFINER; D3 la dejó INVOKER.';
  END IF;
  SELECT md5(prosrc) INTO v_md5 FROM pg_proc WHERE oid = v_reserva;
  IF v_md5 NOT IN (c_reserva_j2, c_reserva_j2b) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: reservar_por_enlace no es el cuerpo de 20261122120000 ni el de esta (md5 %). Aplicar antes 20261122120000 o revisar quién la cambió.', v_md5;
  END IF;
  IF to_regclass('public.idx_appointments_client_id') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: no existe el índice único idx_appointments_client_id que este bloque atrapa por nombre.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · reservar_por_enlace: el INSERT de la cita en su propio bloque.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reservar_por_enlace(
  p_clinica_id uuid, p_codigo_hash text, p_consultorio_id uuid, p_tipo_cita_id uuid, p_inicio timestamptz,
  p_nombre text, p_telefono text, p_correo text, p_tel_hmac text, p_correo_hmac text, p_ficha_hmac text,
  p_aviso_version text, p_aviso_sha256 text, p_client_id uuid)
RETURNS TABLE (r_resultado text, r_cita_id uuid, r_inicio timestamptz, r_fin timestamptz, r_historial integer)
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
  IF NOT FOUND OR v_enl.revocado_en IS NOT NULL THEN
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

  -- seg1 (punto 5): un evento de TODO EL DÍA del médico (vacaciones, congreso;
  -- de Spinus o de Google) también ocupa: sus puntas son las medianoches de su
  -- zona (appointments_all_day_medianoche_check), así que cubre esos días
  -- enteros. Dentro de la agenda sigue sin bloquear (B7: sólo alerta).
  IF EXISTS (SELECT 1 FROM public.appointments a
              WHERE a.clinica_id = p_clinica_id AND a.medico_id = v_enl.medico_id
                AND a.start_time < v_fin AND a.end_time > p_inicio
                AND a.status NOT IN ('cancelled', 'no_show')) THEN
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

-- Permisos de funciones (CLAUDE.md), los de D3/seg1/i2 repetidos: SÓLO service_role.
REVOKE EXECUTE ON FUNCTION public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) TO service_role;

-- ---------------------------------------------------------------------
-- 3 · Comentario.
-- ---------------------------------------------------------------------
COMMENT ON FUNCTION public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) IS
  'Reserva por enlace (D3, cambiada en seg1, i2 y j2). Sólo service_role. Serializa por enlace (FOR UPDATE) y por médico (advisory 1790). CONVENIO: horario del consultorio y alineación del turno (rejilla fija de G2) los comprueba el servidor antes de llamar (src/lib/reserva/turnosReserva.ts, ruta pública de D5); un llamador que no lo haga puede reservar fuera de horario sin que la base lo note. seg1: lo de todo el día ocupa; en el fijo la ficha del correo va antes que el candado; bloqueado = manual (teléfono o correo, también en el único) o automático por correo (sólo fijo); «1 activa» sólo por correo. A PROPÓSITO: el manual por teléfono no exige que el correo verificado sea de la misma persona, así que un «bloqueado» delata que la clínica bloqueó a mano ese teléfono (AG-DT-28, decisión de Angel). i2: p_correo y p_correo_hmac pueden llegar NULL juntos; el fijo sin correo da correo_sin_verificar. j2 (tanda J, punto 3): en el ÚNICO se IGNORAN p_correo y p_correo_hmac: la cita lleva el correo que escribió la clínica al emitir el enlace (reserva_enlaces.correo y su correo_hmac) o ninguno; sin él, reserva_correo NULL y reserva_correo_hmac = sha256(''reserva-sin-correo:''||id de la cita) en hex (seudónimo propio de i2, que no es el HMAC de ningún correo). Tope del único: cada llamada con un único vigente que no sea ''repetida'' suma reserva_enlaces.intentos; la 5.ª marca agotado_en; ''bloqueado'' lo agota en el acto; agotado devuelve ''enlace_agotado''; un client_id que ya es de otra cita, ''client_id_en_uso'' (contado; j2-b: también en carrera, porque el INSERT atrapa el unique_violation de idx_appointments_client_id sin deshacer el conteo). Devuelve UNA fila: usar .single().';

COMMIT;

-- ---------------------------------------------------------------------
-- 4 · Veredicto (sólo lectura). Todo «OK».
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'reservar_por_enlace: cuerpo j2-b (md5) / invoker / search_path vacío / VOLATILE' AS comprobacion,
         coalesce((SELECT md5(p.prosrc) || ' / ' || p.prosecdef::text || ' / ' || (p.proconfig @> ARRAY['search_path=""'])::text || ' / ' || p.provolatile::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)')), 'AUSENTE') AS valor,
         '1a448df0732e62754fb428b1892d45e8 / false / true / v' AS esperado
  UNION ALL
  SELECT 2, 'la garantía atómica sigue: FOR UPDATE del enlace, candado 1790, READ COMMITTED; y el bloque del INSERT',
         coalesce((SELECT (p.prosrc LIKE '%PERFORM pg_advisory_xact_lock(1790, hashtext(v_enl.medico_id::text));%'
                           AND p.prosrc LIKE '%WHERE e.codigo_hash = p_codigo_hash AND e.clinica_id = p_clinica_id%FOR UPDATE;%'
                           AND p.prosrc LIKE '%current_setting(''transaction_isolation'') <> ''read committed''%'
                           AND p.prosrc LIKE '%EXCEPTION WHEN unique_violation THEN%idx_appointments_client_id%RAISE;%')::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)')), 'AUSENTE'),
         'true'
  UNION ALL
  SELECT 3, 'EXECUTE anon / authenticated / service_role / PUBLIC',
         coalesce((SELECT has_function_privilege('anon', p.oid, 'EXECUTE')::text || ' / ' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                          || ' / ' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text || ' / '
                          || EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                      WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)')), 'AUSENTE'),
         'false / false / true / false'
) t ORDER BY t.n;
