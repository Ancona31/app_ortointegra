-- ═══════════════════════════════════════════════════════════════════════
-- Agenda · tanda I, punto 2 de Angel — el enlace de UN SOLO USO no exige
-- correo (ni código): basta el teléfono. El fijo no cambia.
-- Rama: feature/agenda-v2-i2 · Escrita: 2026-11-17
-- Riesgo estimado: BAJO (sólo CREATE OR REPLACE de reservar_por_enlace y su
-- COMMENT; ninguna tabla, ningún dato, ninguna policy, ninguna restricción).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA 2026-11-17 (base de Docker; ensayo con ROLLBACK, dos
--   pases con la rejilla en OK, registrada en schema_migrations).
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de seg1,
--   20261117130000; con el conjunto de la agenda v2 y ANTES del código de
--   esta rama: el código nuevo manda p_correo NULL en el único sin correo, y
--   el cuerpo de seg1 lo rechaza con 22023 → la página diría «no se pudo»).
-- AUDITORÍA INDEPENDIENTE: 2026-11-17, subagente aparte (sonnet), sólo
--   lectura, con diff real contra el cuerpo de seg1: APTA. Cinco cambios,
--   todos pretendidos; FOR UPDATE, candado 1790, READ COMMITTED,
--   idempotencia, ventana, todo el día, bloqueo manual, un solo uso y candado
--   por correo del fijo, idénticos. Anotado: el seudónimo no es un HMAC y sólo
--   lo dice el COMMENT de la función (no hay COMMENT de la columna); «Bloquear
--   contacto» desde una reserva sin correo deja una fila inerte con él.
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Punto 2 de Angel (tanda I, 2026-11-17), literal: «el enlace de UN SOLO USO
-- no exige correo ni código de verificación. Lo emite la clínica para una
-- persona concreta. Pide al menos teléfono; el correo queda opcional. El
-- enlace fijo sigue exigiendo correo y código, sin cambios.» Cierra AG-DT-70
-- (hallazgo de H1: hoy el único pedía un correo con «@», sin verificarlo).
--
-- ═══ EL PROBLEMA DE FONDO, Y POR QUÉ NO SE TOCA NINGUNA RESTRICCIÓN ═══
-- Tres sitios de la base dan por hecho que TODA reserva por enlace tiene
-- seudónimo de correo (reserva_correo_hmac):
--   · appointments_reserva_check (D1): reserva_correo_hmac IS NOT NULL;
--   · reserva_incidencias.correo_hmac NOT NULL (D2), que llena
--     reserva_registrar_incidencia() al cancelar (y se SALTA la fila si el
--     seudónimo de la cita es NULL: la cancelación no dejaría incidencia);
--   · cita_confirmaciones_vinculo_check (E1): el enlace de confirmar/cancelar
--     se ata al paciente O al seudónimo del correo; sin ninguno de los dos,
--     cita_confirmacion_emitir no emite y el WhatsApp manual (E7) da 503.
-- Dejar el seudónimo en NULL obligaría a relajar tres restricciones (dos en
-- tablas con filas) y a cambiar cuatro funciones de D2/E1/E7. En su lugar,
-- una reserva SIN correo lleva un seudónimo PROPIO DE ESA RESERVA:
--     sha256('reserva-sin-correo:' || id de la cita nueva), en hex.
-- Por qué es correcto y no un parche:
--   · El seudónimo de correo es la IDENTIDAD de la persona para lo
--     automático (seg1). Quien no da correo no tiene identidad de correo: la
--     suya no coincide con la de nadie más, ni con la de ninguna reserva
--     futura. Eso es exactamente lo que dice este valor: único por cita
--     (el id es un uuid nuevo), sin preimagen conocida que lo iguale al
--     HMAC(RESERVA_SECRETO) de un correo real (el servidor es el único que
--     calcula ésos, y nadie elige el id de la cita).
--   · «No hay correo que contar» (orientación del encargo): las
--     cancelaciones de esa cita quedan en reserva_incidencias con ese
--     seudónimo, que nunca vuelve a llegar → no suman a nadie. Lo
--     automático ya se lo saltaba el único (§2).
--   · El bloqueo MANUAL sigue cortando por teléfono (seg1/H5, AG-DT-28):
--     reserva_contacto_estado mira el teléfono O el correo, y aquí se le
--     pasa el p_correo_hmac recibido (NULL), así que decide el teléfono.
--     «Bloquear contacto» desde la cita bloquea el teléfono (que sí corta) y
--     ese seudónimo (inerte).
--   · El enlace de confirmación (E1) se ata a ese seudónimo → el WhatsApp
--     manual funciona igual que con correo; el comprobante y el
--     recordatorio no salen porque reserva_correo es NULL (cita_correo_tomar
--     no da destinatario), sin fallar.
-- Lo que este valor NO es: no es un HMAC del correo, aunque viva en la
-- columna *_correo_hmac. Va dicho en el COMMENT de la función.
--
-- ═══ QUÉ CAMBIA EN reservar_por_enlace (cuerpo de seg1 + esto) ════════
--   · p_correo y p_correo_hmac pueden llegar NULL, LOS DOS JUNTOS (uno sí y
--     otro no → 22023). Con correo, la misma forma de siempre.
--   · Con NULL, en el FIJO: 'correo_sin_verificar' (el mismo resultado que
--     una ficha que no casa; en el mismo sitio, después del empalme y antes
--     de mirar nada de la persona: el trabajo no depende del teléfono).
--   · Con NULL, en el ÚNICO: reserva_correo NULL y el seudónimo propio.
--   · El id de la cita lo pone la función (gen_random_uuid) en vez del
--     DEFAULT de la columna, para calcular el seudónimo en el mismo INSERT.
-- No cambia: la firma, la exigencia de READ COMMITTED, el FOR UPDATE del
-- enlace, el candado 1790 y su orden, la idempotencia, lo de todo el día,
-- la puerta S3, el candado de la persona en el fijo, «1 activa», lo que se
-- inserta además de esto, ni la auditoría. reagendar_por_enlace (E6) sólo
-- llama con el FIJO, así que un correo NULL ahí da 'correo_sin_verificar'.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere seg1 (20261117130000). PG ≥ 13 (gen_random_uuid y sha256 en
--   pg_catalog).
-- Bloqueos: sólo catálogo (CREATE OR REPLACE FUNCTION, COMMENT ON FUNCTION);
--   lock_timeout 5 s. Una reserva en curso termina con el cuerpo viejo.
-- Orden respecto al código: la MIGRACIÓN PRIMERO. Con el cuerpo nuevo y el
--   código viejo nada cambia (el código viejo siempre manda correo).
-- Alcance de los roles: no cambia (CREATE OR REPLACE conserva proacl; se
--   repiten REVOKE y GRANT por la regla de CLAUDE.md: sólo service_role).
--   Quien reserva con un ÚNICO gana poder reservar sin correo; con el FIJO,
--   nada cambia.
-- Contrato con spinus-consola: ninguna columna cambia.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
-- Volver a pegar el CREATE OR REPLACE de reservar_por_enlace de
-- 20261117130000 (sección 4) con su REVOKE/GRANT y su COMMENT. Las citas
-- que ya se reservaron sin correo se quedan (pasan todas las restricciones
-- de antes: tienen seudónimo y reserva_correo NULL, que el CHECK de D1 ya
-- admitía).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  -- md5(prosrc) del cuerpo de seg1 y del de esta migración.
  c_reserva_s1 CONSTANT text := 'd3ddd46b556be508622917070d798872';
  c_reserva_i2 CONSTANT text := '600fc445419b26946166132d7caa441b';
  v_reserva oid := to_regprocedure('public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)');
  v_md5 text;
BEGIN
  IF v_reserva IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta reservar_por_enlace con la firma de D3/seg1.';
  END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid = v_reserva) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: reservar_por_enlace es SECURITY DEFINER; D3/seg1 la dejaron INVOKER.';
  END IF;
  SELECT md5(prosrc) INTO v_md5 FROM pg_proc WHERE oid = v_reserva;
  IF v_md5 NOT IN (c_reserva_s1, c_reserva_i2) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: reservar_por_enlace no es el cuerpo de seg1 ni el de i2 (md5 %). Alguien la cambió: revisar antes de pisarla.', v_md5;
  END IF;
  -- Lo que el seudónimo propio tiene que cumplir para entrar.
  IF pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conname = 'appointments_reserva_check'
                            AND conrelid = 'public.appointments'::regclass))
     NOT LIKE '%(reserva_correo IS NULL) OR%' THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: appointments_reserva_check ya no admite reserva_correo NULL; revisar antes de reservar sin correo.';
  END IF;
  IF to_regprocedure('pg_catalog.sha256(bytea)') IS NULL OR to_regprocedure('pg_catalog.gen_random_uuid()') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: faltan sha256(bytea) o gen_random_uuid() en pg_catalog (PG ≥ 13).';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · La reserva atómica (cuerpo de seg1 con el correo opcional del único).
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
  -- nada de la persona. Sin ficha, la respuesta y el trabajo son los mismos
  -- para cualquier teléfono. i2: sin correo, el fijo no reserva (lo mismo que
  -- una ficha que no casa).
  IF v_enl.clase = 'fijo' THEN
    IF p_correo_hmac IS NULL THEN
      r_resultado := 'correo_sin_verificar'; RETURN NEXT; RETURN;
    END IF;
    SELECT r.id INTO v_verif FROM public.reserva_verificaciones r
     WHERE r.ficha_hmac = p_ficha_hmac AND r.clinica_id = p_clinica_id AND r.enlace_id = v_enl.id
       AND r.correo_hmac = p_correo_hmac AND r.verificado_en IS NOT NULL AND r.consumida_en IS NULL
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
  SELECT * INTO v_hist FROM public.reserva_contacto_estado(p_clinica_id, v_enl.medico_id, p_tel_hmac, p_correo_hmac);
  IF v_hist.manual OR (v_enl.clase = 'fijo' AND v_hist.bloqueado) THEN
    r_resultado := 'bloqueado'; RETURN NEXT; RETURN;
  END IF;
  IF v_enl.clase = 'fijo'
     AND (SELECT count(*) FROM public.appointments a
           WHERE a.clinica_id = p_clinica_id AND a.medico_id = v_enl.medico_id AND a.reserva_canal IS NOT NULL
             AND a.reserva_correo_hmac = p_correo_hmac
             AND a.status IN ('scheduled', 'confirmed') AND a.end_time > now()) >= v_aj.candado_citas_activas THEN
    r_resultado := 'ya_tiene_cita'; RETURN NEXT; RETURN;
  END IF;

  -- i2: el id lo pone la función para que la reserva SIN correo lleve, en el
  -- mismo INSERT, su seudónimo propio (ver la cabecera de la migración).
  v_id := gen_random_uuid();
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
    v_enl.id, v_enl.clase, btrim(p_nombre), p_telefono, btrim(p_correo), p_tel_hmac,
    coalesce(p_correo_hmac, encode(sha256(convert_to('reserva-sin-correo:' || v_id::text, 'UTF8')), 'hex')),
    p_aviso_version, now(), coalesce(v_hist.cancelaciones, 0) + coalesce(v_hist.no_shows, 0));

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

-- Permisos de funciones (CLAUDE.md), los de D3/seg1 repetidos: SÓLO
-- service_role (es la página pública, sin sesión).
REVOKE EXECUTE ON FUNCTION public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) TO service_role;

COMMENT ON FUNCTION public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) IS
  'Reserva por enlace (D3, cambiada en seg1 e i2). Sólo service_role. Serializa por enlace (FOR UPDATE) y por médico (advisory 1790). CONVENIO: horario del consultorio y alineación del turno (P9) los comprueba el servidor antes de llamar (src/lib/reserva/turnosReserva.ts, ruta pública de D5); un llamador que no lo haga puede reservar fuera de horario sin que la base lo note. seg1: lo de todo el día ocupa; en el fijo la ficha del correo va antes que el candado; bloqueado = manual (teléfono o correo, también en el único) o automático por correo (sólo fijo); «1 activa» sólo por correo. A PROPÓSITO: el manual por teléfono no exige que el correo verificado sea de la misma persona, así que un «bloqueado» delata que la clínica bloqueó a mano ese teléfono (AG-DT-28, decisión de Angel). i2 (tanda I, punto 2): p_correo y p_correo_hmac pueden llegar NULL juntos; el fijo sin correo da correo_sin_verificar; el ÚNICO sin correo reserva con reserva_correo NULL y reserva_correo_hmac = sha256(''reserva-sin-correo:''||id de la cita) en hex: un seudónimo PROPIO de esa reserva, que no es el HMAC de ningún correo y no coincide con nadie (sin identidad de correo, no hay nada automático que contar; el bloqueo manual decide por el teléfono). Devuelve UNA fila: usar .single().';

COMMIT;

-- ---------------------------------------------------------------------
-- 3 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'reservar_por_enlace: cuerpo i2 (md5) / invoker / search_path vacío / VOLATILE' AS comprobacion,
         coalesce((SELECT md5(p.prosrc) || ' / ' || p.prosecdef::text || ' / ' || (p.proconfig @> ARRAY['search_path=""'])::text || ' / ' || p.provolatile::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)')), 'AUSENTE') AS valor,
         '600fc445419b26946166132d7caa441b / false / true / v' AS esperado
  UNION ALL
  SELECT 2, 'la garantía atómica sigue en el cuerpo: FOR UPDATE del enlace, candado 1790, READ COMMITTED',
         coalesce((SELECT (p.prosrc LIKE '%PERFORM pg_advisory_xact_lock(1790, hashtext(v_enl.medico_id::text));%'
                           AND p.prosrc LIKE '%WHERE e.codigo_hash = p_codigo_hash AND e.clinica_id = p_clinica_id%FOR UPDATE;%'
                           AND p.prosrc LIKE '%current_setting(''transaction_isolation'') <> ''read committed''%')::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)')), 'AUSENTE'),
         'true'
  UNION ALL
  SELECT 3, 'EXECUTE anon,authenticated,service_role / PUBLIC',
         coalesce((SELECT has_function_privilege('anon', p.oid, 'EXECUTE')::text || ',' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                    || ',' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text || ' / '
                    || EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x WHERE x.grantee = 0 AND x.privilege_type = 'EXECUTE')::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)')), 'AUSENTE'),
         'false,false,true / false'
  UNION ALL
  SELECT 4, 'COMMENT de i2 (seudónimo propio de la reserva sin correo)',
         coalesce((obj_description(to_regprocedure('public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)'), 'pg_proc')
                   LIKE '%reserva-sin-correo%')::text, 'AUSENTE'),
         'true'
  UNION ALL
  SELECT 5, 'restricciones intactas: CHECK de reserva_* (D1), incidencias (D2) y vínculo de confirmación (E1)',
         (SELECT count(*)::text FROM pg_constraint
           WHERE (conrelid, conname) IN (('public.appointments'::regclass, 'appointments_reserva_check'),
                                         ('public.reserva_incidencias'::regclass, 'reserva_incidencias_hmac_check'),
                                         ('public.cita_confirmaciones'::regclass, 'cita_confirmaciones_vinculo_check'))),
         '3'
) t
ORDER BY t.n;
