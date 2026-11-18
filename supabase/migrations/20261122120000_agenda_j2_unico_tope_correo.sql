-- ═══════════════════════════════════════════════════════════════════════
-- Agenda · tanda J, agente J2 (punto 3 de Angel) — el enlace de UN SOLO USO
-- con tope de intentos y con el correo que escribió la clínica al emitirlo.
-- Rama: feature/agenda-v2-j2 · Escrita: 2026-11-18
-- Riesgo estimado: BAJO-MEDIO (cuatro columnas nuevas en reserva_enlaces,
-- tres con NULL y una con DEFAULT constante, y dos CHECK que todas las filas
-- de hoy cumplen; un disparador nuevo BEFORE en reserva_enlaces; CREATE OR
-- REPLACE de reservar_por_enlace y reserva_contexto; reserva_enlace_emitir
-- tiene una hermana con dos argumentos más (la de 7 se queda igual). Ninguna
-- policy, ninguna fila existente y ninguna otra función cambian).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: ver «APLICACIÓN LOCAL» al pie de la cabecera.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de i2, 20261121120000,
--   con el conjunto de la agenda v2; ANTES del código de esta rama).
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Punto 3 de Angel (tanda J), literal: «Enlace de un solo uso: ponle tope de
-- intentos, y que el comprobante solo se mande al correo que la clínica
-- escribió al emitir el enlace, nunca al que teclee quien reserva.»
-- Cierra AG-DT-100 (el único sin verificar admitía el correo de un tercero:
-- le llegaba el comprobante y su HMAC real le activaba «ya_tiene_cita» en el
-- fijo) y AG-DT-101 (el único no tenía tope: con un único se probaban
-- teléfonos y se distinguía «bloqueado a mano», 403, de «ok», porque un 403
-- no gastaba el enlace).
--
-- ═══ QUÉ ES UN INTENTO, Y EL TOPE ═══════════════════════════════════════
-- · Intento = cada llamada a reservar_por_enlace con un enlace ÚNICO vigente
--   (ni usado, ni caducado, ni agotado) que no es el reenvío del mismo envío
--   (mismo client_id: sale 'repetida', antes, y no cuenta). Cuenta haya el
--   resultado que haya (ocupado, fuera de ventana, bloqueado, ok…). Lo que la
--   ruta rechaza antes de llamar a la base (400 de forma, turno fuera de la
--   rejilla, límites por IP y dispositivo) no llega aquí y no cuenta.
-- · Tope: 5 intentos (c_tope_unico). El 5.º lo marca agotado al empezar; si
--   reserva, queda además usado. Del 6.º en adelante: 'enlace_agotado'.
-- · «Bloqueado» (bloqueo manual por teléfono o por el correo del enlace)
--   AGOTA el único en el acto. Es el intento que revela algo de la persona
--   (AG-DT-28, decisión de Angel: el 403 lo dice); con esto un único deja
--   probar UN teléfono. El que no está bloqueado reserva y gasta el enlace.
--   Así de un único sale como mucho UNA respuesta sobre una persona.
-- · Por qué 5 y no 1 ni el tope del fijo: lo que menos cambia lo de hoy
--   para quien reserva de verdad (un 409 «se acaba de ocupar» o un turno que
--   se pasó de la anticipación se reintentan) y, con «bloqueado agota», la
--   enumeración queda cerrada con cualquier tope. El tope del fijo (30/día)
--   no la cerraba: 30 teléfonos al día.
-- · Lo que haría fallar la reserva DESPUÉS de contar desharía el conteo (la
--   excepción revierte la transacción entera). El único fallo provocable por
--   quien reserva es el client_id ya usado por otra cita (índice único): se
--   comprueba justo después de contar ('client_id_en_uso', el mismo 400 de
--   antes), antes de mirar nada de la persona. (Auditoría de j2, H1.)
-- · Agotado = `agotado_en` NO NULL. reserva_contexto lo dice como estado
--   'agotado' (la página: «Este enlace ya no está disponible», el mismo texto
--   neutro de usado o caducado; la API: 410 `enlace_no_disponible`, sin la
--   causa). El conteo vive en la BASE, bajo el FOR UPDATE del enlace que ya
--   serializaba las reservas: atómico, sin memoria del servidor.
--
-- ═══ EL CORREO DEL ÚNICO ═══════════════════════════════════════════════
-- · Al emitir un único, la clínica puede escribir un correo (opcional). Se
--   guarda en el enlace (`correo`, tal cual recortado) con su seudónimo
--   (`correo_hmac` = HMAC(RESERVA_SECRETO) del correo normalizado, el MISMO
--   que el fijo calcula al verificar: lo calcula el servidor, la base no
--   conoce el secreto, como codigo_hash).
-- · reservar_por_enlace, en el ÚNICO, IGNORA p_correo y p_correo_hmac y usa
--   los del enlace: la cita lleva reserva_correo = el de la clínica (o NULL),
--   y como TODOS los correos de la cita (comprobante, confirmación,
--   recordatorio, reagendar) toman el destinatario de reserva_correo
--   (cita_correo_tomar), van sólo ahí. Sin correo de la clínica: NULL y el
--   seudónimo propio de i2, así que no sale ninguno aunque quien reserva
--   teclee uno. En el FIJO nada cambia (el correo verificado con código).
-- · El seudónimo real del correo de la clínica entra en reserva_correo_hmac:
--   el candado y el bloqueo manual por correo funcionan como con el correo
--   tecleado de antes, pero ahora con uno que eligió la clínica.
--
-- ═══ QUÉ CAMBIA ════════════════════════════════════════════════════════
-- public.reserva_enlaces: + correo text NULL, correo_hmac text NULL,
--   intentos integer NOT NULL DEFAULT 0, agotado_en timestamptz NULL.
--   · CHECK reserva_enlaces_correo_check: correo y hmac juntos, sólo en el
--     único, con forma mínima (3–254, recortado, con @ y algo antes; la
--     forma completa la valida el servidor) y hmac hex de 64.
--   · CHECK reserva_enlaces_intentos_check: intentos ≥ 0 y agotado sólo en
--     el único. Las filas de hoy: todo NULL / 0 → cumplen.
-- public.proteger_reserva_enlace_unico() (NUEVA, disparador BEFORE INSERT OR
--   UPDATE trg_reserva_enlaces_unico, INVOKER): al emitir, intentos 0 y sin
--   agotar; después, el correo no cambia nunca (ni la sesión, ni
--   service_role) y los intentos y el agotado sólo los cambia service_role
--   (la RPC), sólo hacia arriba y sin des-agotar. postgres/supabase_admin
--   pasan (como proteger_reserva_enlaces, que NO se toca: su md5 acd4128b lo
--   exige h2 y la regla de CLAUDE.md). Sin esto la policy de UPDATE de la
--   sesión (revocar) dejaría cambiar el correo o reiniciar los intentos.
-- public.reserva_enlace_emitir (9 args, NUEVA): la de seg (7a) + p_correo,
--   p_correo_hmac (los dos o ninguno; sólo el único). REVOKE/GRANT explícitos
--   (sólo service_role). La de 7 args NO se borra (se vuelve a pegar
--   idéntica): el código de antes sigue emitiendo, sin correo, durante el
--   despliegue y en la base local compartida. Se retira con otra migración
--   cuando no la llame nadie (deuda).
-- public.reserva_contexto: cuerpo de G2 + estado 'agotado'.
-- public.reservar_por_enlace: cuerpo de i2 + el conteo, el agotado, el
--   correo del enlace en el único, y «bloqueado agota».
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere: i2 (20261121120000), G2 (20261119120000), seg 7a
--   (20261117122000). PG ≥ 11 (ADD COLUMN con DEFAULT constante sin
--   reescribir la tabla).
-- Bloqueos: ACCESS EXCLUSIVE breve en reserva_enlaces (ADD COLUMN, ADD
--   CONSTRAINT con una pasada de validación sobre una tabla chica, CREATE
--   TRIGGER); lock_timeout 5 s.
-- Orden respecto al código: la MIGRACIÓN PRIMERO. Con la base nueva y el
--   código viejo: se emite igual (la de 7 args sigue), una reserva por un
--   único ignora el correo tecleado (sin comprobante) y un único agotado da
--   en el código viejo un 404 (resultado desconocido) en vez del 410. Con el
--   código nuevo y la base vieja: emitir falla (PGRST202). Es el conjunto de
--   la v2, que en producción se aplica entero antes de encender nada.
-- Contrato con spinus-consola: sólo columnas NUEVAS; ninguna cambia.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
-- Volver a pegar reservar_por_enlace de 20261121120000, reserva_contexto de
-- 20261119120000 (la emisora de 7 args no se tocó), con sus
-- REVOKE/GRANT; DROP de la emisora de 9 args, del disparador y de su función;
-- las columnas pueden quedarse (nadie las lee) o borrarse con sus CHECK.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  -- md5(prosrc) de los cuerpos de los que parte esta migración y de los suyos (segunda pasada).
  c_reserva_i2  CONSTANT text := '600fc445419b26946166132d7caa441b';
  c_reserva_j2  CONSTANT text := '5d8c6c55d852222bdb2f779b1f4afb76';
  c_contexto_g2 CONSTANT text := '8d81bc662a7312256fefea8494458f4f';
  c_contexto_j2 CONSTANT text := 'a39a4dadaacb1a625d966a832f67575b';
  c_emitir_seg  CONSTANT text := 'dae88a95eea005d0cf385cd4d90b2932';
  c_proteger    CONSTANT text := 'acd4128b5f25df54f6b4fd95391cf1dc';
  v_reserva oid := to_regprocedure('public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)');
  v_ctx     oid := to_regprocedure('public.reserva_contexto(text, text, text)');
  v_emit7   oid := to_regprocedure('public.reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text)');
  v_emit9   oid := to_regprocedure('public.reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text, text, text)');
  v_md5 text;
BEGIN
  IF v_reserva IS NULL OR v_ctx IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: faltan reservar_por_enlace o reserva_contexto con sus firmas de D3.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE oid IN (v_reserva, v_ctx) AND prosecdef) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: reservar_por_enlace o reserva_contexto es SECURITY DEFINER; D3 las dejó INVOKER.';
  END IF;
  SELECT md5(prosrc) INTO v_md5 FROM pg_proc WHERE oid = v_reserva;
  IF v_md5 NOT IN (c_reserva_i2, c_reserva_j2) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: reservar_por_enlace no es el cuerpo de i2 ni el de j2 (md5 %). Alguien la cambió: revisar antes de pisarla.', v_md5;
  END IF;
  SELECT md5(prosrc) INTO v_md5 FROM pg_proc WHERE oid = v_ctx;
  IF v_md5 NOT IN (c_contexto_g2, c_contexto_j2) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: reserva_contexto no es el cuerpo de G2 ni el de j2 (md5 %).', v_md5;
  END IF;
  -- La emisora de seg (7 args) se QUEDA tal cual (compatibilidad, ver la cabecera); se vuelve a
  -- pegar idéntica, así que si existe tiene que ser la de seg 7a. La de 9 es nueva o ya de j2.
  IF v_emit7 IS NOT NULL AND (SELECT md5(prosrc) FROM pg_proc WHERE oid = v_emit7) <> c_emitir_seg THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: reserva_enlace_emitir (7 args) no es el cuerpo de seg 7a; revisar antes de pisarla.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'reserva_enlace_emitir'
               AND p.oid NOT IN (coalesce(v_emit7, 0), coalesce(v_emit9, 0))) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: hay otra reserva_enlace_emitir con una firma que no es la de seg ni la de j2.';
  END IF;
  -- Lo que se da por hecho sin tocarlo: el disparador de seg sigue siendo el de 7a.
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.proteger_reserva_enlaces()')) IS DISTINCT FROM c_proteger THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: proteger_reserva_enlaces() no es el cuerpo de seg 7a (acd4128b…).';
  END IF;
  -- Columnas: o no existen (primera pasada) o son las de j2 (segunda).
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.reserva_enlaces'::regclass AND NOT attisdropped
                AND (attname, format_type(atttypid, atttypmod)) IN (('correo', 'text'), ('correo_hmac', 'text'), ('intentos', 'integer'), ('agotado_en', 'timestamp with time zone'))
              HAVING count(*) NOT IN (0, 4))
     OR EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.reserva_enlaces'::regclass AND NOT attisdropped
                  AND attname IN ('correo', 'correo_hmac', 'intentos', 'agotado_en')
                  AND (attname, format_type(atttypid, atttypmod)) NOT IN (('correo', 'text'), ('correo_hmac', 'text'), ('intentos', 'integer'), ('agotado_en', 'timestamp with time zone'))) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: reserva_enlaces ya tiene alguna de correo/correo_hmac/intentos/agotado_en con otra forma.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · Las columnas del único y sus CHECK.
-- ---------------------------------------------------------------------
ALTER TABLE public.reserva_enlaces
  ADD COLUMN IF NOT EXISTS correo      text,
  ADD COLUMN IF NOT EXISTS correo_hmac text,
  ADD COLUMN IF NOT EXISTS intentos    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agotado_en  timestamptz;

ALTER TABLE public.reserva_enlaces DROP CONSTRAINT IF EXISTS reserva_enlaces_correo_check;
ALTER TABLE public.reserva_enlaces ADD CONSTRAINT reserva_enlaces_correo_check CHECK (
  (correo IS NULL) = (correo_hmac IS NULL)
  AND (correo IS NULL OR (clase = 'unico' AND char_length(correo) BETWEEN 3 AND 254 AND position('@' IN correo) > 1
                          AND correo = btrim(correo) AND correo_hmac ~ '^[0-9a-f]{64}$')));
ALTER TABLE public.reserva_enlaces DROP CONSTRAINT IF EXISTS reserva_enlaces_intentos_check;
ALTER TABLE public.reserva_enlaces ADD CONSTRAINT reserva_enlaces_intentos_check CHECK (
  intentos >= 0 AND (agotado_en IS NULL OR clase = 'unico'));

-- ---------------------------------------------------------------------
-- 3 · El disparador del único: correo inmutable, intentos sólo de la RPC.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.proteger_reserva_enlace_unico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    -- Al emitir: sin intentos y sin agotar, lo pida quien lo pida.
    NEW.intentos   := 0;
    NEW.agotado_en := NULL;
    RETURN NEW;
  END IF;
  IF (NEW.correo, NEW.correo_hmac) IS DISTINCT FROM (OLD.correo, OLD.correo_hmac) THEN
    RAISE EXCEPTION 'El correo de un enlace emitido no se modifica: se revoca y se emite otro' USING ERRCODE = '42501';
  END IF;
  IF (NEW.intentos, NEW.agotado_en) IS DISTINCT FROM (OLD.intentos, OLD.agotado_en) THEN
    IF current_user <> 'service_role' OR NEW.intentos < OLD.intentos
       OR (OLD.agotado_en IS NOT NULL AND NEW.agotado_en IS DISTINCT FROM OLD.agotado_en) THEN
      RAISE EXCEPTION 'Sólo la reserva cuenta los intentos de un enlace, y no los devuelve' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END
$fn$;
-- Permisos de funciones (CLAUDE.md): la ejecuta el disparador con el rol de quien escribe.
REVOKE EXECUTE ON FUNCTION public.proteger_reserva_enlace_unico() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.proteger_reserva_enlace_unico() TO anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_reserva_enlaces_unico ON public.reserva_enlaces;
CREATE TRIGGER trg_reserva_enlaces_unico
  BEFORE INSERT OR UPDATE ON public.reserva_enlaces
  FOR EACH ROW EXECUTE FUNCTION public.proteger_reserva_enlace_unico();

-- ---------------------------------------------------------------------
-- 4 · La emisión, con el correo opcional del único (firma nueva, al lado de la de seg).
-- ---------------------------------------------------------------------
-- La de seg 7a, IDÉNTICA (mismo cuerpo, md5 dae88a95): no se borra para que el
-- código de antes siga emitiendo mientras se despliega (y la base local, que
-- comparten otras ramas). Se vuelve a pegar sólo para que esta migración la
-- deje en su sitio aunque falte. Emite sin correo. Se retira cuando no quede
-- código que la llame (deuda anotada).
CREATE OR REPLACE FUNCTION public.reserva_enlace_emitir(p_clinica_id uuid, p_actor uuid, p_id uuid, p_medico_id uuid,
                                                        p_clase text, p_codigo_hash text, p_etiqueta text)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF p_clinica_id IS NULL OR p_actor IS NULL OR p_id IS NULL OR p_medico_id IS NULL OR p_codigo_hash IS NULL
     OR p_clase IS NULL OR p_clase NOT IN ('fijo', 'unico') OR (p_clase = 'fijo' AND p_etiqueta IS NOT NULL) THEN
    RAISE EXCEPTION 'reserva_enlace_emitir: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  -- La regla de las policies de reserva_enlaces (lista A, 16) con el actor en lugar de auth.uid().
  IF NOT EXISTS (SELECT 1 FROM public.profiles p
                  WHERE p.id = p_actor AND p.clinica_id = p_clinica_id
                    AND (p.id = p_medico_id OR (p.role = 'medico' AND p.es_admin_de_clinica IS TRUE)
                         OR p.role = 'secretaria')) THEN
    RAISE EXCEPTION 'reserva_enlace_emitir: quien emite no gestiona los enlaces de ese médico' USING ERRCODE = '42501';
  END IF;
  IF p_clase = 'fijo' THEN
    UPDATE public.reserva_enlaces
       SET revocado_en = now(), revocado_por = p_actor
     WHERE clinica_id = p_clinica_id AND medico_id = p_medico_id AND clase = 'fijo' AND revocado_en IS NULL;
  END IF;
  INSERT INTO public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash, etiqueta, created_by)
  VALUES (p_id, p_clinica_id, p_medico_id, p_clase, p_codigo_hash, p_etiqueta, p_actor);
  RETURN p_id;
END
$fn$;
REVOKE EXECUTE ON FUNCTION public.reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text) TO service_role;

-- La nueva, con dos argumentos más. PostgREST elige entre las dos por los NOMBRES de los argumentos.
CREATE OR REPLACE FUNCTION public.reserva_enlace_emitir(p_clinica_id uuid, p_actor uuid, p_id uuid, p_medico_id uuid,
                                                        p_clase text, p_codigo_hash text, p_etiqueta text,
                                                        p_correo text, p_correo_hmac text)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF p_clinica_id IS NULL OR p_actor IS NULL OR p_id IS NULL OR p_medico_id IS NULL OR p_codigo_hash IS NULL
     OR p_clase IS NULL OR p_clase NOT IN ('fijo', 'unico') OR (p_clase = 'fijo' AND p_etiqueta IS NOT NULL)
     -- j2: el correo del único, los dos juntos; el fijo nunca lleva.
     OR (p_correo IS NULL) <> (p_correo_hmac IS NULL) OR (p_clase = 'fijo' AND p_correo IS NOT NULL) THEN
    RAISE EXCEPTION 'reserva_enlace_emitir: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  -- La regla de las policies de reserva_enlaces (lista A, 16) con el actor en lugar de auth.uid().
  IF NOT EXISTS (SELECT 1 FROM public.profiles p
                  WHERE p.id = p_actor AND p.clinica_id = p_clinica_id
                    AND (p.id = p_medico_id OR (p.role = 'medico' AND p.es_admin_de_clinica IS TRUE)
                         OR p.role = 'secretaria')) THEN
    RAISE EXCEPTION 'reserva_enlace_emitir: quien emite no gestiona los enlaces de ese médico' USING ERRCODE = '42501';
  END IF;
  IF p_clase = 'fijo' THEN
    UPDATE public.reserva_enlaces
       SET revocado_en = now(), revocado_por = p_actor
     WHERE clinica_id = p_clinica_id AND medico_id = p_medico_id AND clase = 'fijo' AND revocado_en IS NULL;
  END IF;
  INSERT INTO public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash, etiqueta, created_by, correo, correo_hmac)
  VALUES (p_id, p_clinica_id, p_medico_id, p_clase, p_codigo_hash, p_etiqueta, p_actor, btrim(p_correo), p_correo_hmac);
  RETURN p_id;
END
$fn$;
-- Permisos de funciones (CLAUDE.md): función nueva; SÓLO service_role, como la de 7a.
REVOKE EXECUTE ON FUNCTION public.reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text, text, text) TO service_role;

-- ---------------------------------------------------------------------
-- 5 · El contexto público: el único agotado.
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
  IF NOT FOUND OR v_e.revocado_en IS NOT NULL THEN RETURN NULL; END IF;
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
REVOKE EXECUTE ON FUNCTION public.reserva_contexto(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reserva_contexto(text, text, text) TO service_role;

-- ---------------------------------------------------------------------
-- 6 · La reserva atómica (cuerpo de i2 + el tope y el correo del enlace).
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
-- 7 · Los convenios, donde viajan con la base.
-- ---------------------------------------------------------------------
COMMENT ON FUNCTION public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) IS
  'Reserva por enlace (D3, cambiada en seg1, i2 y j2). Sólo service_role. Serializa por enlace (FOR UPDATE) y por médico (advisory 1790). CONVENIO: horario del consultorio y alineación del turno (rejilla fija de G2) los comprueba el servidor antes de llamar (src/lib/reserva/turnosReserva.ts, ruta pública de D5); un llamador que no lo haga puede reservar fuera de horario sin que la base lo note. seg1: lo de todo el día ocupa; en el fijo la ficha del correo va antes que el candado; bloqueado = manual (teléfono o correo, también en el único) o automático por correo (sólo fijo); «1 activa» sólo por correo. A PROPÓSITO: el manual por teléfono no exige que el correo verificado sea de la misma persona, así que un «bloqueado» delata que la clínica bloqueó a mano ese teléfono (AG-DT-28, decisión de Angel). i2: p_correo y p_correo_hmac pueden llegar NULL juntos; el fijo sin correo da correo_sin_verificar. j2 (tanda J, punto 3): en el ÚNICO se IGNORAN p_correo y p_correo_hmac: la cita lleva el correo que escribió la clínica al emitir el enlace (reserva_enlaces.correo y su correo_hmac) o ninguno; sin él, reserva_correo NULL y reserva_correo_hmac = sha256(''reserva-sin-correo:''||id de la cita) en hex (seudónimo propio de i2, que no es el HMAC de ningún correo). Tope del único: cada llamada con un único vigente que no sea ''repetida'' suma reserva_enlaces.intentos; la 5.ª marca agotado_en; ''bloqueado'' lo agota en el acto; agotado devuelve ''enlace_agotado''; un client_id que ya es de otra cita, ''client_id_en_uso'' (contado). Devuelve UNA fila: usar .single().';
COMMENT ON FUNCTION public.reserva_contexto(text, text, text) IS
  'Contexto público de un enlace de reserva (D3; G2 añadió consultorio_id y principal a cada tipo; j2 el estado ''agotado'' del único). NULL = 404 indistinguible. Sólo service_role. CONVENIO: los tipos van todos juntos; qué tipos valen en cada consultorio (el principal por consultorio sustituye allí al general) lo decide el servidor antes de reservar (tiposDelConsultorio, src/lib/agenda/tiposPorConsultorio.ts). reservar_por_enlace no mira el consultorio del tipo. NO devuelve el correo del enlace (j2): no debe llegar a la página.';
COMMENT ON FUNCTION public.reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text, text, text) IS
  'Emite un enlace de reserva (seg 7a; j2 añadió p_correo y p_correo_hmac, los dos o ninguno, sólo en el único). Sólo service_role, llamada desde POST /api/agenda/enlaces con la clínica de la sesión y el actor; repite la regla de las policies. El hmac lo calcula el servidor con RESERVA_SECRETO.';
COMMENT ON COLUMN public.reserva_enlaces.correo IS
  'j2: el correo del paciente que escribió la clínica al emitir un enlace ÚNICO (opcional). El comprobante y todos los correos de la cita van SÓLO aquí; el que teclee quien reserva no se usa. Nunca viaja a la página pública ni a la lista de enlaces. Inmutable (trg_reserva_enlaces_unico).';
COMMENT ON COLUMN public.reserva_enlaces.correo_hmac IS
  'j2: HMAC(RESERVA_SECRETO) del correo normalizado, el seudónimo del candado (el mismo que usa el fijo al verificar). Lo calcula el servidor.';
COMMENT ON COLUMN public.reserva_enlaces.intentos IS
  'j2: llamadas a reservar_por_enlace con este único vigente (sin contar los reenvíos ''repetida''). Sólo la sube service_role (la RPC).';
COMMENT ON COLUMN public.reserva_enlaces.agotado_en IS
  'j2: el único ya no sirve por el tope de intentos (5) o porque un intento dio ''bloqueado''. Sólo service_role lo pone y no se quita. La página dice «Este enlace ya no está disponible», sin la causa.';
COMMENT ON COLUMN public.appointments.reserva_correo_hmac IS
  'Seudónimo del correo de quien reservó por enlace (D1): HMAC(RESERVA_SECRETO) del correo normalizado. EXCEPCIÓN (i2): una reserva por enlace único SIN correo lleva sha256(''reserva-sin-correo:''||id de la cita) en hex, propio de esa reserva: no es el HMAC de nada y no sirve para buscar a la persona (para eso está el teléfono). j2: en el único, el correo es el que escribió la clínica en el enlace.';

COMMIT;

-- ---------------------------------------------------------------------
-- 8 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'reservar_por_enlace: cuerpo j2 (md5) / invoker / search_path vacío / VOLATILE' AS comprobacion,
         coalesce((SELECT md5(p.prosrc) || ' / ' || p.prosecdef::text || ' / ' || (p.proconfig @> ARRAY['search_path=""'])::text || ' / ' || p.provolatile::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)')), 'AUSENTE') AS valor,
         '5d8c6c55d852222bdb2f779b1f4afb76 / false / true / v' AS esperado
  UNION ALL
  SELECT 2, 'la garantía atómica sigue en el cuerpo: FOR UPDATE del enlace, candado 1790, READ COMMITTED',
         coalesce((SELECT (p.prosrc LIKE '%PERFORM pg_advisory_xact_lock(1790, hashtext(v_enl.medico_id::text));%'
                           AND p.prosrc LIKE '%WHERE e.codigo_hash = p_codigo_hash AND e.clinica_id = p_clinica_id%FOR UPDATE;%'
                           AND p.prosrc LIKE '%current_setting(''transaction_isolation'') <> ''read committed''%')::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)')), 'AUSENTE'),
         'true'
  UNION ALL
  SELECT 3, 'reserva_contexto: cuerpo j2 (md5) / invoker',
         coalesce((SELECT md5(p.prosrc) || ' / ' || p.prosecdef::text FROM pg_proc p WHERE p.oid = to_regprocedure('public.reserva_contexto(text, text, text)')), 'AUSENTE'),
         'a39a4dadaacb1a625d966a832f67575b / false'
  UNION ALL
  SELECT 4, 'reserva_enlace_emitir: la de 7 args, cuerpo de seg (md5 corto) / la de 9, invoker',
         coalesce((SELECT left(md5(p.prosrc), 8) FROM pg_proc p WHERE p.oid = to_regprocedure('public.reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text)')), 'AUSENTE') || ' / '
         || coalesce((SELECT p.prosecdef::text FROM pg_proc p WHERE p.oid = to_regprocedure('public.reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text, text, text)')), 'AUSENTE'),
         'dae88a95 / false'
  UNION ALL
  SELECT 5, 'EXECUTE anon,authenticated,service_role / PUBLIC: reservar, contexto, emitir (sólo service_role); disparador (los tres)',
         (SELECT string_agg(p.proname || '=' || has_function_privilege('anon', p.oid, 'EXECUTE')::text || ','
                            || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || ','
                            || has_function_privilege('service_role', p.oid, 'EXECUTE')::text || '/'
                            || EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                        WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')::text, ' ; ' ORDER BY p.proname)
            FROM pg_proc p WHERE p.oid IN (to_regprocedure('public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)'),
                                           to_regprocedure('public.reserva_contexto(text, text, text)'),
                                           to_regprocedure('public.reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text, text, text)'),
                                           to_regprocedure('public.reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text)'),
                                           to_regprocedure('public.proteger_reserva_enlace_unico()'))),
         'proteger_reserva_enlace_unico=true,true,true/false ; reserva_contexto=false,false,true/false ; reserva_enlace_emitir=false,false,true/false ; reserva_enlace_emitir=false,false,true/false ; reservar_por_enlace=false,false,true/false'
  UNION ALL
  SELECT 6, 'columnas nuevas de reserva_enlaces (tipo / NOT NULL / DEFAULT)',
         (SELECT string_agg(a.attname || '=' || format_type(a.atttypid, a.atttypmod) || '/' || a.attnotnull::text || '/' || coalesce(pg_get_expr(d.adbin, d.adrelid), '-'), ',' ORDER BY a.attname)
            FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
           WHERE a.attrelid = 'public.reserva_enlaces'::regclass AND NOT a.attisdropped AND a.attname IN ('correo', 'correo_hmac', 'intentos', 'agotado_en')),
         'agotado_en=timestamp with time zone/false/-,correo=text/false/-,correo_hmac=text/false/-,intentos=integer/true/0'
  UNION ALL
  SELECT 7, 'CHECK nuevos validados y disparador del único habilitado',
         (SELECT count(*)::text FROM pg_constraint WHERE conrelid = 'public.reserva_enlaces'::regclass AND convalidated
             AND conname IN ('reserva_enlaces_correo_check', 'reserva_enlaces_intentos_check')) || ' / '
         || coalesce((SELECT tgenabled::text || ' ' || tgtype::text FROM pg_trigger WHERE tgrelid = 'public.reserva_enlaces'::regclass AND tgname = 'trg_reserva_enlaces_unico'), 'AUSENTE'),
         '2 / O 23'
  UNION ALL
  SELECT 8, 'lo que no se toca: proteger_reserva_enlaces (md5 de 7a) y sus policies (3)',
         coalesce((SELECT left(md5(prosrc), 8) FROM pg_proc WHERE oid = to_regprocedure('public.proteger_reserva_enlaces()')), 'AUSENTE') || ' / '
         || (SELECT count(*)::text FROM pg_policy WHERE polrelid = 'public.reserva_enlaces'::regclass),
         'acd4128b / 3'
) t
ORDER BY t.n;
