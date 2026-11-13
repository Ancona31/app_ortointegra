-- ═══════════════════════════════════════════════════════════════════════
-- Agenda seg1 — correcciones de seguridad del enlace de reserva (decisiones
-- de Angel tras la revisión independiente, 2026-11-12): el candado decide
-- lo automático por el CORREO verificado y no por el teléfono; el bloqueo
-- manual corta también el enlace único; un evento de todo el día del médico
-- ocupa esos días en el enlace.
-- Rama: feature/agenda-v2-seg1 · Escrita: 2026-11-12 · Riesgo: BAJO (sólo
-- CREATE OR REPLACE de tres funciones y COMMENT ON; ninguna tabla, ningún
-- dato, ninguna policy).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-11-12
--   `docker exec -i supabase_db_app_ortointegra psql -U postgres
--   -v ON_ERROR_STOP=1 -f` del archivo completo (rejilla: 6 × OK) y otras
--   pasadas iguales (no-op: mismos md5). Antes, en seco con ROLLBACK junto
--   con las pruebas. Anotada a mano en supabase_migrations.schema_migrations
--   (versión 20261117130000). La primera pasada falló SÓLO en la rejilla
--   (text || "char": faltaba ::text en provolatile), ya con el COMMIT hecho;
--   se corrigió la rejilla y se volvió a correr.
--   Pruebas: supabase/pruebas-sql/seg1_candado_correo.sql (rojo con los
--   cuerpos de D2/D3 y con cada mutación; verde con éste),
--   d2_candado_reserva.sql y d3_reservar_por_enlace.sql ajustadas;
--   scripts/reserva-carrera.sh en verde (con candado 1 cita, sin él 2).
--   Comprobación:
--     select md5(prosrc) from pg_proc
--      where oid = 'public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)'::regprocedure;
--   → d3ddd46b556be508622917070d798872.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de D2, D3 y E6; con
--   el conjunto de la agenda v2).
-- AUDITORÍA INDEPENDIENTE 2026-11-12 (otro modelo, supabase/AUDITORIA-
--   MIGRACIONES.md, las 18 dimensiones): APTA CON CAMBIOS. Aplicado:
--   hallazgo 1, documentar que el bloqueo manual por teléfono sigue siendo
--   observable con un correo verificado ajeno (EL PORQUÉ y COMMENT de
--   reservar_por_enlace; decide Angel, AG-DT-28). No aplicado, anotado:
--   (2) sin prueba de un médico con consultorios en zonas distintas (la
--   lógica compara instantes, correcta); (3) el lock de COMMENT ON TABLE no
--   se pudo verificar en su entorno; (4) e6_reagendar.sql no se amplió:
--   reagendar_por_enlace llama a reservar_por_enlace y hereda los cambios.
--   El hash de D2 que vio un instante en el catálogo fue la mutación de las
--   e2e (cuerpos de D2/D3 restaurados un momento y vueltos a poner).
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Lo pidió Angel (mejora_agendaV2.md §6-bis, «Correcciones de seguridad tras
-- la revisión independiente»), puntos 1, 2, 5 y 6:
--   1. El enlace no debe revelar nada sobre un teléfono. El correo se
--      verifica con código; el teléfono no. Hasta aquí, con SU PROPIO correo
--      verificado, cualquiera con el enlace fijo podía escribir el teléfono
--      de otra persona y leer en la respuesta si ese número tenía cita
--      (409 ya_tiene_cita) o historial (403 bloqueado) con el médico.
--   2. Nadie debe perjudicar a un tercero con su teléfono: reservar con el
--      número ajeno lo dejaba con «ya tiene cita» y, cancelando, le cargaba
--      incidencias hasta cerrarle el autoservicio. Lo automático del candado
--      (cita activa, cancelaciones, bloqueo automático) decide ahora por el
--      correo verificado. El teléfono se sigue guardando (la clínica lo ve) y
--      sirve para el bloqueo MANUAL. Esto debilita el candado frente a quien
--      cambie de correo; decisión de Angel.
--   5. Un evento de todo el día del médico (vacaciones, congreso) bloquea
--      esos días en el enlace. En la agenda interna nada cambia (B7).
--   6. El enlace de un solo uso se salta lo automático, pero no el bloqueo
--      manual: a un contacto que la clínica bloqueó a mano no le sirve
--      ningún enlace.
-- ⚠️ LO QUE QUEDA ABIERTO A PROPÓSITO (puntos 2 y 6 frente al 1): el
-- bloqueo MANUAL mira teléfono O correo sin exigir que vengan de la misma
-- persona. Quien verifique un correo propio cualquiera y escriba el teléfono
-- de otro recibe «bloqueado» si la clínica bloqueó a mano ESE teléfono: un
-- rechazo por un dato que nadie verifica lo ve quien lo manda. Lo automático
-- y el camino sin correo verificado sí quedan cerrados. Lo decide Angel
-- (mejora_agendaV2.md §6-bis seg1; DEUDA_TECNICA.md AG-DT-28); la
-- alternativa es que el manual mire sólo el correo.
--
-- ═══ QUÉ CAMBIA ════════════════════════════════════════════════════════
-- 1. reserva_contacto_estado (D2): las incidencias cuentan sólo por
--    correo_hmac (antes, teléfono O correo), y el «desbloquear» que las
--    descuenta es el del correo. `manual` sigue mirando las dos claves. Lo
--    leen reservar_por_enlace, reserva_contactos_bloqueados (la lista de la
--    clínica) y GET /api/agenda/reservas/historial: los tres pasan a contar
--    por correo (el historial que ve la clínica también: si no, un tercero
--    podía mancharlo con un número ajeno).
-- 2. reservar_por_enlace (D3), el cuerpo de D3 con tres cambios:
--    · el empalme ya no excluye las filas all_day;
--    · en el fijo la ficha del correo se comprueba ANTES de leer el estado
--      del contacto (sin ficha, ni teléfono ni correo se tocan);
--    · `bloqueado` = manual (en los dos enlaces) o automático por correo
--      (sólo en el fijo); «1 activa» sólo por reserva_correo_hmac.
--    No cambia: la firma, el FOR UPDATE del enlace, el candado consultivo
--    (1790, hashtext(médico)) ni el orden respecto a él, la exigencia de
--    READ COMMITTED, la idempotencia, lo que se inserta ni la auditoría.
-- 3. reserva_ocupacion (D3): ya no excluye las filas all_day (las puntas de
--    un evento de todo el día cubren sus días en la zona de su consultorio).
-- Los tres cuerpos son los de D2/D3 copiados tal cual salvo lo dicho; el
-- pre-vuelo aborta si el cuerpo vigente no es el de D2/D3 ni el de esta
-- migración (md5 de prosrc), así que no pisa un cambio que no conoce.
-- reagendar_por_enlace (E6) llama a reservar_por_enlace y hereda todo.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere D2 (20261114130000) y D3 (20261114140000). PG ≥ 14.
-- Bloqueos: sólo catálogo (CREATE OR REPLACE FUNCTION, COMMENT ON FUNCTION
--   y COMMENT ON TABLE reserva_incidencias, que toma SHARE UPDATE EXCLUSIVE
--   un instante: no bloquea lecturas ni escrituras de filas); lock_timeout
--   5 s. Una reserva en curso que ya entró a reservar_por_enlace termina
--   con el cuerpo viejo.
-- Orden respecto al código: indiferente. El código no cambia de forma con
--   esta migración (mismas firmas, mismos resultados posibles).
-- Alcance de los roles: no cambia en ninguna de las dos direcciones
--   (CREATE OR REPLACE conserva proacl; se repiten revoke y grant por la
--   regla de CLAUDE.md). Para quien reserva: pierde «ya tiene cita» y el
--   bloqueo automático por teléfono; gana nada; el bloqueo manual ahora le
--   corta también el enlace único. La clínica ve el historial por correo.
-- Contrato con spinus-consola: ninguna columna cambia.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
-- Volver a pegar los CREATE OR REPLACE de reserva_contacto_estado
-- (20261114130000, sección de funciones) y de reserva_ocupacion y
-- reservar_por_enlace (20261114140000) con sus REVOKE/GRANT y el COMMENT
-- de reservar_por_enlace de D3; COMMENT ON FUNCTION … IS NULL en las otras
-- dos y el COMMENT de reserva_incidencias de D2. Ningún dato cambia.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  -- md5(prosrc) del cuerpo de D2/D3 y del de esta migración, por función.
  c_estado_d2  CONSTANT text := 'd694184dc3d00292e575524178d39401';
  c_estado_s1  CONSTANT text := '52ca884f922f5f518da44720f237d947';
  c_ocup_d3    CONSTANT text := '648672c060c56ece3a81f91213e708fc';
  c_ocup_s1    CONSTANT text := '50a89d8589d84b57de04571ee1aa3da2';
  c_reserva_d3 CONSTANT text := '52ee7af1aa2825571925887a9b41ce9a';
  c_reserva_s1 CONSTANT text := 'd3ddd46b556be508622917070d798872';
  v_estado  oid := to_regprocedure('public.reserva_contacto_estado(uuid, uuid, text, text)');
  v_ocup    oid := to_regprocedure('public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz)');
  v_reserva oid := to_regprocedure('public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)');
  v_md5 text;
BEGIN
  IF v_estado IS NULL OR v_ocup IS NULL OR v_reserva IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta D2 (reserva_contacto_estado) o D3 (reserva_ocupacion / reservar_por_enlace) con su firma.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE oid IN (v_estado, v_ocup, v_reserva) AND prosecdef) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: una de las tres funciones es SECURITY DEFINER; D2/D3 las dejaron INVOKER.';
  END IF;
  IF NOT coalesce((SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role'), false) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: service_role no tiene BYPASSRLS (las funciones INVOKER no verían las filas).';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.reserva_incidencias'::regclass AND NOT attisdropped
        AND (attname, atttypid) IN (('correo_hmac', 'text'::regtype), ('tel_hmac', 'text'::regtype), ('anulada_en', 'timestamptz'::regtype))) <> 3
     OR (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.reserva_contactos'::regclass AND NOT attisdropped
        AND (attname, atttypid) IN (('clave_hmac', 'text'::regtype), ('bloqueado_en', 'timestamptz'::regtype), ('perdonado_en', 'timestamptz'::regtype))) <> 3 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: reserva_incidencias / reserva_contactos sin las columnas de D2.';
  END IF;
  SELECT md5(prosrc) INTO v_md5 FROM pg_proc WHERE oid = v_estado;
  IF v_md5 NOT IN (c_estado_d2, c_estado_s1) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: reserva_contacto_estado no es el cuerpo de D2 ni el de seg1 (md5 %). Alguien la cambió: revisar antes de pisarla.', v_md5;
  END IF;
  SELECT md5(prosrc) INTO v_md5 FROM pg_proc WHERE oid = v_ocup;
  IF v_md5 NOT IN (c_ocup_d3, c_ocup_s1) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: reserva_ocupacion no es el cuerpo de D3 ni el de seg1 (md5 %). Alguien la cambió: revisar antes de pisarla.', v_md5;
  END IF;
  SELECT md5(prosrc) INTO v_md5 FROM pg_proc WHERE oid = v_reserva;
  IF v_md5 NOT IN (c_reserva_d3, c_reserva_s1) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: reservar_por_enlace no es el cuerpo de D3 ni el de seg1 (md5 %). Alguien la cambió: revisar antes de pisarla.', v_md5;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · Estado del contacto: lo automático por correo; lo manual, por las dos.
-- ---------------------------------------------------------------------
-- INVOKER: con authenticated sólo ve SU clínica (RLS); con service_role
-- (reservar_por_enlace) ve lo que p_clinica_id acota.
CREATE OR REPLACE FUNCTION public.reserva_contacto_estado(
  p_clinica_id uuid, p_medico_id uuid, p_tel_hmac text, p_correo_hmac text)
RETURNS TABLE (bloqueado boolean, manual boolean, cancelaciones integer, no_shows integer, hasta timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
  WITH aj AS (
    SELECT coalesce(max(j.candado_cancelaciones), 3) AS umbral,
           coalesce(max(j.candado_ventana_dias), 60) AS ventana
      FROM public.agenda_ajustes j
     WHERE j.clinica_id = p_clinica_id
  ),
  -- Manual: lo que la clínica bloqueó a mano, por teléfono o por correo.
  -- El desbloqueo que descuenta incidencias es el del CORREO.
  k AS (
    SELECT max(c.perdonado_en) FILTER (WHERE c.clave_hmac = p_correo_hmac) AS perdonado,
           coalesce(bool_or(c.bloqueado_en IS NOT NULL
                            AND (c.perdonado_en IS NULL OR c.perdonado_en < c.bloqueado_en)), false) AS manual
      FROM public.reserva_contactos c
     WHERE c.clinica_id = p_clinica_id AND c.medico_id = p_medico_id
       AND c.clave_hmac IN (p_tel_hmac, p_correo_hmac)
  ),
  -- Automático: cancelaciones e inasistencias SÓLO por el correo (seg1). El
  -- teléfono no lo es: nadie lo verifica y cualquiera puede escribir uno ajeno.
  i AS (
    SELECT x.tipo, x.created_at, row_number() OVER (ORDER BY x.created_at DESC) AS n
      FROM public.reserva_incidencias x CROSS JOIN aj CROSS JOIN k
     WHERE x.clinica_id = p_clinica_id AND x.medico_id = p_medico_id AND x.anulada_en IS NULL
       AND x.correo_hmac = p_correo_hmac
       AND x.created_at > now() - make_interval(days => aj.ventana)
       AND x.created_at > coalesce(k.perdonado, '-infinity'::timestamptz)
  )
  SELECT k.manual OR (SELECT count(*) FROM i) >= aj.umbral,
         k.manual,
         (SELECT count(*) FROM i WHERE i.tipo = 'cancelacion')::integer,
         (SELECT count(*) FROM i WHERE i.tipo = 'no_show')::integer,
         (SELECT i.created_at + make_interval(days => aj.ventana) FROM i WHERE i.n = aj.umbral)
    FROM aj CROSS JOIN k;
$fn$;

-- ---------------------------------------------------------------------
-- 3 · Ocupación: también las filas de todo el día.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserva_ocupacion(p_clinica_id uuid, p_enlace_id uuid, p_desde timestamptz, p_hasta timestamptz)
RETURNS TABLE (start_time timestamptz, end_time timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
  SELECT a.start_time, a.end_time
    FROM public.reserva_enlaces e
    JOIN public.agenda_ajustes j ON j.clinica_id = e.clinica_id AND j.agenda_v2_encendida
    JOIN public.appointments a ON a.clinica_id = e.clinica_id AND a.medico_id = e.medico_id
   WHERE e.id = p_enlace_id AND e.clinica_id = p_clinica_id AND e.revocado_en IS NULL
     AND p_hasta > p_desde AND p_hasta - p_desde <= interval '15 days'
     AND a.start_time < p_hasta AND a.end_time > p_desde
     AND a.status NOT IN ('cancelled', 'no_show')
   ORDER BY a.start_time;
$fn$;

-- ---------------------------------------------------------------------
-- 4 · La reserva atómica (cuerpo de D3 con los cambios de seg1).
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
  IF p_clinica_id IS NULL OR p_codigo_hash IS NULL OR p_consultorio_id IS NULL OR p_tipo_cita_id IS NULL
     OR p_inicio IS NULL OR p_nombre IS NULL OR p_telefono IS NULL OR p_correo IS NULL OR p_tel_hmac IS NULL
     OR p_correo_hmac IS NULL OR p_aviso_version IS NULL OR p_aviso_sha256 IS NULL OR p_client_id IS NULL THEN
    RAISE EXCEPTION 'reservar_por_enlace: argumentos obligatorios en NULL' USING ERRCODE = '22023';
  END IF;
  IF btrim(p_nombre) = '' OR char_length(p_nombre) > 120 OR p_telefono !~ '^[0-9]{10}$'
     OR char_length(p_correo) NOT BETWEEN 3 AND 254 OR position('@' IN p_correo) = 0
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
  -- para cualquier teléfono.
  IF v_enl.clase = 'fijo' THEN
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
  -- teléfono o correo, y corta también el enlace único.
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

  INSERT INTO public.appointments (
    clinica_id, paciente_id, created_by, medico_id, title, start_time, end_time, status, origen, all_day, client_id,
    gcal_sync_status,
    consultorio_id, consultorio_nombre, consultorio_nombre_corto, consultorio_direccion, consultorio_telefono,
    consultorio_timezone, tipo_cita_id, tipo_cita_nombre,
    reserva_enlace_id, reserva_canal, reserva_nombre, reserva_telefono, reserva_correo, reserva_tel_hmac,
    reserva_correo_hmac, reserva_aviso_version, reserva_aceptado_en, reserva_historial_previo)
  VALUES (
    p_clinica_id, NULL, NULL, v_enl.medico_id, btrim(p_nombre), p_inicio, v_fin, 'scheduled', 'spinus', false, p_client_id::text,
    'pending',
    v_con.id, v_con.nombre, v_con.nombre_corto, v_con.direccion, v_con.telefono, v_con.timezone, v_tipo.id, v_tipo.nombre,
    v_enl.id, v_enl.clase, btrim(p_nombre), p_telefono, btrim(p_correo), p_tel_hmac,
    p_correo_hmac, p_aviso_version, now(), coalesce(v_hist.cancelaciones, 0) + coalesce(v_hist.no_shows, 0))
  RETURNING id INTO v_id;

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

-- Permisos de funciones (CLAUDE.md), los de D2/D3 repetidos:
-- reserva_contacto_estado también para authenticated (el historial de la
-- cita en la agenda, bajo la RLS de las tablas del candado); las otras dos,
-- SÓLO service_role: son la página pública, sin sesión.
REVOKE EXECUTE ON FUNCTION public.reserva_contacto_estado(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.reserva_contacto_estado(uuid, uuid, text, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz) TO service_role;
REVOKE EXECUTE ON FUNCTION public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) TO service_role;

-- Los convenios, donde viajan con la base (dimensión 16).
COMMENT ON FUNCTION public.reserva_contacto_estado(uuid, uuid, text, text) IS
  'Estado del candado de un contacto con un médico (D2, cambiado en seg1). manual = bloqueo a mano vigente por el teléfono O por el correo. cancelaciones / no_shows / hasta y el bloqueo automático cuentan SÓLO las incidencias del CORREO (correo_hmac) dentro de la ventana y después del último desbloqueo del correo: el teléfono no se verifica y no debe poder perjudicar a un tercero. bloqueado = manual OR automático.';
COMMENT ON FUNCTION public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz) IS
  'Lo que ocupa en el enlace de reserva (D3, cambiado en seg1): sólo puntas. Cuenta todo menos cancelled y no_show, INCLUIDAS las filas de todo el día (sus puntas son las medianoches de la zona de su consultorio: ocupan esos días enteros). Sólo service_role; interruptor apagado o enlace revocado = nada.';
COMMENT ON FUNCTION public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) IS
  'Reserva por enlace (D3, cambiada en seg1). Sólo service_role. Serializa por enlace (FOR UPDATE) y por médico (advisory 1790). CONVENIO: horario del consultorio y alineación del turno (P9) los comprueba el servidor antes de llamar (src/lib/reserva/turnosReserva.ts, ruta pública de D5); un llamador que no lo haga puede reservar fuera de horario sin que la base lo note. seg1: lo de todo el día ocupa; en el fijo la ficha del correo va antes que el candado; bloqueado = manual (teléfono o correo, también en el único) o automático por correo (sólo fijo); «1 activa» sólo por correo. A PROPÓSITO: el manual por teléfono no exige que el correo verificado sea de la misma persona, así que un «bloqueado» delata que la clínica bloqueó a mano ese teléfono (AG-DT-28, decisión de Angel). Devuelve UNA fila: usar .single().';
COMMENT ON TABLE public.reserva_incidencias IS
  'Cancelaciones y no_show de citas por enlace (candado D2). La escribe SÓLO reserva_registrar_incidencia(). anulada_en = la cita se reactivó. Seudónimos (HMAC), sin datos en claro. Desde seg1 el conteo automático (reserva_contacto_estado) mira sólo correo_hmac; tel_hmac se guarda pero no cuenta.';

COMMIT;

-- ---------------------------------------------------------------------
-- 5 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'reserva_contacto_estado: cuerpo seg1 (md5) / invoker / search_path vacío / STABLE' AS comprobacion,
         coalesce((SELECT md5(p.prosrc) || ' / ' || p.prosecdef::text || ' / ' || (p.proconfig @> ARRAY['search_path=""'])::text || ' / ' || p.provolatile::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.reserva_contacto_estado(uuid, uuid, text, text)')), 'AUSENTE') AS valor,
         '52ca884f922f5f518da44720f237d947 / false / true / s' AS esperado
  UNION ALL
  SELECT 2, 'reserva_ocupacion: cuerpo seg1 (md5) / invoker / search_path vacío / STABLE',
         coalesce((SELECT md5(p.prosrc) || ' / ' || p.prosecdef::text || ' / ' || (p.proconfig @> ARRAY['search_path=""'])::text || ' / ' || p.provolatile::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz)')), 'AUSENTE'),
         '50a89d8589d84b57de04571ee1aa3da2 / false / true / s'
  UNION ALL
  SELECT 3, 'reservar_por_enlace: cuerpo seg1 (md5) / invoker / search_path vacío / VOLATILE',
         coalesce((SELECT md5(p.prosrc) || ' / ' || p.prosecdef::text || ' / ' || (p.proconfig @> ARRAY['search_path=""'])::text || ' / ' || p.provolatile::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)')), 'AUSENTE'),
         'd3ddd46b556be508622917070d798872 / false / true / v'
  UNION ALL
  SELECT 4, 'la garantía atómica sigue en el cuerpo: FOR UPDATE del enlace, candado 1790, READ COMMITTED',
         coalesce((SELECT (p.prosrc LIKE '%PERFORM pg_advisory_xact_lock(1790, hashtext(v_enl.medico_id::text));%'
                           AND p.prosrc LIKE '%WHERE e.codigo_hash = p_codigo_hash AND e.clinica_id = p_clinica_id%FOR UPDATE;%'
                           AND p.prosrc LIKE '%current_setting(''transaction_isolation'') <> ''read committed''%')::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)')), 'AUSENTE'),
         'true'
  UNION ALL
  SELECT 5, 'EXECUTE: estado authenticated+service_role; ocupación y reserva sólo service_role; nunca anon ni PUBLIC',
         (SELECT string_agg(p.proname || '=' || has_function_privilege('anon', p.oid, 'EXECUTE')::text || ','
                            || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || ','
                            || has_function_privilege('service_role', p.oid, 'EXECUTE')::text || ','
                            || EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                        WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')::text, ' ; ' ORDER BY p.proname)
            FROM pg_proc p WHERE p.oid IN (to_regprocedure('public.reserva_contacto_estado(uuid, uuid, text, text)'),
                                           to_regprocedure('public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz)'),
                                           to_regprocedure('public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)'))),
         'reserva_contacto_estado=false,true,true,false ; reserva_ocupacion=false,false,true,false ; reservar_por_enlace=false,false,true,false'
  UNION ALL
  SELECT 6, 'COMMENT de seg1 en las tres funciones y en reserva_incidencias',
         ((obj_description(to_regprocedure('public.reserva_contacto_estado(uuid, uuid, text, text)'), 'pg_proc') LIKE '%seg1%')
          AND (obj_description(to_regprocedure('public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz)'), 'pg_proc') LIKE '%seg1%')
          AND (obj_description(to_regprocedure('public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)'), 'pg_proc') LIKE '%seg1%')
          AND (obj_description('public.reserva_incidencias'::regclass, 'pg_class') LIKE '%seg1%'))::text,
         'true'
) t
ORDER BY t.n;
