-- ═══════════════════════════════════════════════════════════════════════
-- Agenda E1 — enlace de confirmación por cita, respuesta del paciente
-- (confirmar / no podré asistir) y lista blanca de «via» en log_cita_change
-- Rama: feature/agenda-v2 · Escrita: 2026-11-12
-- Riesgo estimado: ALTO (segundo camino SIN sesión que escribe appointments
-- con service_role; reemplaza log_cita_change: si fallara, fallaría toda
-- escritura de citas, igual que en B0 y C2).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-11-12
--   `docker exec -i supabase_db_app_ortointegra psql -U postgres
--   -v ON_ERROR_STOP=1 -f` del archivo completo (rejilla: 8 × OK + 1 INFO,
--   0 / 0 / 0), y una segunda pasada: misma rejilla, sólo NOTICE «already
--   exists, skipping» (tabla y 3 índices), y no-op comprobado con una huella
--   de catálogo de 129 renglones (columnas con tipo, NOT NULL, DEFAULT y
--   COMMENT; relacl, RLS y COMMENT de la tabla; constraints; índices;
--   policies de la tabla y de appointments; disparadores; md5, proacl,
--   prosecdef, proconfig y COMMENT de las funciones; privilegios por columna;
--   count(*) de audit_log): sin diferencias. Pre-vuelo probado en ROLLBACK:
--   aborta con log_cita_change alterada, con una constraint de la tabla
--   quitada y con una sobrecarga de cita_confirmacion_revocar. Anotada a mano
--   en supabase_migrations.schema_migrations (versión 20261115120000), como
--   D1-D4.
--   Pruebas: supabase/pruebas-sql/e1_confirmacion_enlace.sql (bash
--   scripts/pruebas-sql.sh) y la carrera bash scripts/confirmacion-carrera.sh
--   (B esperó ~1,9 s y salió fuera_de_plazo; sin el FOR UPDATE de la cita,
--   cancelaba la cita ya movida).
--   Comprobación:
--     select md5(prosrc) from pg_proc where oid = 'public.log_cita_change()'::regprocedure;
--   → 80c3556c1655ddf2eaf1d57995190463.
--   ⚠️ LO DE ARRIBA ES LA PRIMERA APLICACIÓN (2026-11-12). El archivo se
--   EDITÓ después (2026-11-13, ver «CIERRE DE LA SUSPENDIDA» abajo) y se
--   volvió a aplicar en local: ver «SEGUNDA APLICACIÓN».
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de B0, B1, C1, C2, D1 y D2).
-- AUDITORÍA INDEPENDIENTE 2026-11-12: APTA CON CAMBIOS
-- (supabase/AUDITORIA-MIGRACIONES.md). Aplicado antes del commit:
--   · cita_confirmacion_revocar toma el mismo candado consultivo que emitir
--     (1791, hashtext(cita)): una revocación y una emisión de la misma cita
--     no se intercalan (emitir no devuelve un vigente que se está revocando).
--   NO aplicado, con su razón (para revisar por Angel):
--   · Hallazgo 1 («grave»): contexto y responder no miran clinicas.suspendida.
--     Es a propósito (plan_E lista A, 9): la respuesta del paciente es un
--     UPDATE como los del personal, y appointments_update tampoco mira la
--     suspensión (la puerta RESTRICTIVE es sólo de INSERT); emitir sí exige
--     la puerta S3. La prueba (caso 4) fija que una clínica suspendida y una
--     degradada responden. Si Angel prefiere cerrarlo, es un EXISTS sobre
--     clinicas.suspendida en las dos funciones.
--   · Hallazgo 2: el lado de aplicación (subllave «confirmacion» en
--     secretos.ts) no existía cuando se auditó: llega en E2, el commit
--     siguiente. La tolerancia a PGRST202/42P01 (hallazgo 4) la prueban sus
--     pruebas de Vitest (src/lib/tests/confirmacionEnlace.test.ts).
--   Sin calificar, como en B0-D4: cómo envuelve el SQL Editor un BEGIN/COMMIT
--   explícito. Sin dimensión nueva para AUDITORIA-MIGRACIONES.md.
-- CIERRE DE LA SUSPENDIDA (2026-11-13, por la auditoría; manda sobre el
--   «NO aplicado» del hallazgo 1 de arriba, que se deja como constancia):
--   contexto devuelve NULL y responder 'invalido' si la clínica está
--   suspendida: es clinica_no_suspendida() evaluada con la clínica del enlace
--   (`EXISTS clinicas k WHERE k.id = … AND NOT k.suspendida`; la clínica que
--   no existe, cerrada, como el coalesce(…, false) de la original). Para el
--   paciente es lo mismo que un enlace que no existe (404). Copia del
--   predicado, no lectura de pg_proc como C1: es una columna, y la prueba
--   (caso 4b) comprueba que da lo mismo que clinica_no_suspendida() en cada
--   clínica de la prueba; el caso 4, que contexto y responder cierran. Lo
--   degradado NO se cierra (lista A 9 sigue para la degradada: el UPDATE del
--   personal tampoco mira el acceso). Pre-vuelo: exige clinicas.suspendida
--   boolean NOT NULL, SELECT de service_role en clinicas y que
--   clinica_no_suspendida() siga siendo la copiada (md5 normalizado). Rejilla:
--   fila 9 nueva, md5 de los dos cuerpos (el censo pasa a la 10). El
--   reagendar de E6 (migración 20261115130000, se audita aparte) lleva el
--   mismo cierre.
--   Re-auditoría independiente 2026-11-13: APTA. Aplicados sus tres
--   hallazgos leves (huella de la original en el pre-vuelo, fila 9 por md5 y
--   no por texto, cabecera). No aplicado (4, aceptado por el auditor): una
--   suspensión que se confirme entre la lectura de clinicas y el UPDATE de
--   responder no se ve, igual que en el UPDATE del personal (READ COMMITTED).
--   Señalado para E9: gcal_aplicar_evento no mira la suspensión; si el RSVP
--   responde por ahí, necesitará el mismo cierre.
-- SEGUNDA APLICACIÓN · LOCAL: APLICADA Y VERIFICADA — 2026-11-13. El archivo
--   completo sobre la base que ya tenía la primera (rejilla: 9 × OK + 1 INFO,
--   0 / 0 / 0; sólo cambian los cuerpos de contexto y responder, CREATE OR
--   REPLACE), y otra pasada encima: misma rejilla, sólo los 4 NOTICE «already
--   exists, skipping», y la huella de catálogo de 129 renglones sin
--   diferencias. Pre-vuelo nuevo probado en ROLLBACK (aborta con
--   suspendida sin NOT NULL, sin SELECT de service_role en clinicas y con
--   clinica_no_suspendida() alterada). Repetido tras la re-auditoría. Fila de
--   supabase_migrations.schema_migrations (20261115120000) borrada y vuelta a
--   anotar con las 38 sentencias de este archivo. Pruebas: e1_confirmacion_enlace.sql
--   (casos 4 y 4b) y confirmacion-carrera.sh, en verde.
--   Comprobación:
--     select proname, md5(prosrc) from pg_proc
--      where proname in ('cita_confirmacion_contexto', 'cita_confirmacion_responder') order by 1;
--   → 2fca66ffb8ea3b15eb7d0224c90a4f1a / 7961e24a4f9f7bda0ce2df744f5b46aa.
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- mejora_agendaV2.md §2 («Confirmación de asistencia», «Cancelación por el
-- paciente», «Cambio de opinión») y §5 E; diseño en e2e/resultados/plan_E.md E1.
-- cita_confirmaciones — el enlace Y la respuesta del paciente, en UNA tabla:
--   la respuesta es un atributo del enlace (respuesta, respondido_en: la
--   última). El historial completo (confirmó y luego canceló) queda en
--   audit_log, por log_cita_change y log_tabla_change.
--   UN enlace vigente por cita (índice único parcial).
--   EL CÓDIGO NO SE GUARDA: se deriva como HMAC(subllave «confirmacion» de
--   RESERVA_SECRETO, 'confirmacion:' || id) (src/lib/reserva/secretos.ts) y
--   aquí sólo vive sha256(código). Se vuelve a enseñar (correo, WhatsApp)
--   sin que la base tenga nada que filtrar. UNIQUE(codigo_hash) global a
--   propósito (dimensión 10): la búsqueda no conoce la clínica y un choque
--   exige adivinar 128 bits.
-- VÍNCULO: el enlace nace atado al paciente de la cita (paciente_id) o, en
--   una cita por ligar (D1), al seudónimo de su correo (reserva_correo_hmac).
--   Si el personal cambia de paciente, el enlace viejo deja de valer (y la
--   siguiente emisión lo revoca). Al ligar una cita por ligar, sigue valiendo
--   (reserva_correo_hmac se queda en la cita, D7). paciente_id NO lleva FK, a
--   propósito (dimensión 16): una FK RESTRICT haría fallar el borrado de un
--   paciente sin historial, que hoy funciona (appointments.paciente_id es
--   SET NULL), y SET NULL/CASCADE no se permiten. Si el paciente se borra, la
--   cita queda con paciente_id NULL y el enlace deja de coincidir: falla
--   cerrado.
-- CADUCIDAD: no se guarda. Vale mientras la cita no empiece; cancelar, hasta
--   1 h antes, estricto (§2). La decide la cita VIGENTE: mover la cita mueve
--   el plazo.
-- LA RESPUESTA (cita_confirmacion_responder): FOR UPDATE sobre el enlace y
--   sobre la cita (una edición del personal en curso termina antes y se lee
--   la fila vigente), y la hora se toma con clock_timestamp() DESPUÉS de los
--   candados: now() es la del inicio de la transacción y, tras una espera,
--   quedaría del lado equivocado de T-1h. Transiciones: scheduled→confirmed;
--   scheduled|confirmed→cancelled; nada sobre attended/no_show; nunca
--   reactiva. updated_at = esa hora («gana el último», bloque C). La
--   cancelación dispara reserva_registrar_incidencia (D2) igual que hoy.
--   Con la clínica suspendida, ni contexto ni respuesta (ver CIERRE arriba).
-- AUDITORÍA: log_cita_change es la de C2 con UNA diferencia: «via» deja de
--   ser sólo 'google' y pasa a una lista blanca de literales, SÓLO sin
--   auth.uid(): 'google' (C2), 'enlace_paciente' (E1 y el reagendar de E6:
--   lo hizo la persona por el enlace de su cita) y 'google_rsvp' (E9). Con
--   sesión se ignora: authenticated no puede fingir que fue el paciente. Un
--   literal fuera de la lista no se escribe. c_tecnicas y el WHEN no se tocan.
--   El pre-vuelo aborta si el cuerpo vigente no es el de C2 ni el de E1 (md5
--   de prosrc, como D4). No se quita ninguna auditoría.
-- Todas INVOKER y sólo service_role (BYPASSRLS, comprobado), salvo
--   cita_confirmacion_coincide (pura, regla general). Ninguna SECURITY
--   DEFINER nueva. Ninguna escribe agenda_ajustes.
-- Aislamiento: contexto resuelve la clínica por el hash (es el único que no
--   la conoce, como reserva_contexto de D3); emitir, responder y revocar
--   reciben p_clinica_id OBLIGATORIO y lo casan con la fila en cada
--   sentencia. La FK a appointments es simple (sin UNIQUE(id, clinica_id) en
--   appointments, igual que D1): la misma clínica la garantizan las
--   funciones, que son el único camino de escritura (authenticated no tiene
--   INSERT ni UPDATE).
-- appointments NO gana columnas (plan_E hallazgo 4: c_tecnicas es una lista
--   de exclusión; una columna nueva saldría como «cita_editada»).
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere B0, B1, C1, C2, D1 y D2. PG ≥ 14.
-- Bloqueos (lock_timeout 5 s): CREATE TABLE con FK → SHARE ROW EXCLUSIVE un
--   instante sobre clinicas, profiles y appointments (bloquea escrituras de
--   citas un instante, no lecturas). CREATE OR REPLACE FUNCTION y COMMENT:
--   catálogo. Tabla nueva vacía: índices instantáneos.
-- Orden respecto al código: PRIMERO esta migración. Sin el GUC spinus.via,
--   log_cita_change se comporta como la de C2 (el código viejo no cambia); el
--   código nuevo sin ella recibe PGRST202/42P01 y devuelve null (cerrado: no
--   hay enlace, la agenda sigue como hoy).
-- Alcance de los roles:
--   gana — service_role: EXECUTE de 4 funciones; SELECT/INSERT/UPDATE en
--          cita_confirmaciones. authenticated: SELECT de 7 columnas (sin
--          codigo_hash, paciente_id, reserva_correo_hmac ni creado_por) de los
--          enlaces de las citas que YA ve (EXISTS bajo la RLS de appointments).
--          Todos: EXECUTE de cita_confirmacion_coincide (pura, sin datos).
--   pierde — anon: todo sobre la tabla nueva; authenticated: escribirla;
--          service_role: DELETE/TRUNCATE/REFERENCES/TRIGGER en ella.
--   appointments y audit_log: sin cambio de permisos. log_cita_change
--   conserva sus grants (CREATE OR REPLACE) y se repiten por la regla.
-- Contrato con spinus-consola: tabla nueva; ninguna columna de public cambia.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   Respaldar antes:
--     CREATE TABLE respaldos.cita_confirmaciones_AAAAMMDD AS SELECT * FROM public.cita_confirmaciones;
--   DROP FUNCTION IF EXISTS public.cita_confirmacion_responder(uuid, text, text);
--   DROP FUNCTION IF EXISTS public.cita_confirmacion_revocar(uuid, uuid);
--   DROP FUNCTION IF EXISTS public.cita_confirmacion_contexto(text);
--   DROP FUNCTION IF EXISTS public.cita_confirmacion_emitir(uuid, uuid, uuid, text, uuid);
--   DROP TABLE IF EXISTS public.cita_confirmaciones;
--   DROP FUNCTION IF EXISTS public.cita_confirmacion_coincide(uuid, text, uuid, text);
--   y volver a pegar SÓLO la sección 5 de 20261113130000_agenda_c2_gcal_aplicar.sql
--   (log_cita_change con «via» sólo 'google'). Las citas confirmadas o
--   canceladas por el paciente se quedan así (son hechos).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de crear nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  -- md5(prosrc) de log_cita_change: el cuerpo de C2 y el de esta migración.
  c_log_c2  CONSTANT text := 'e57358a132ad89fc94c4df136c40f65f';
  c_log_e1  CONSTANT text := '80c3556c1655ddf2eaf1d57995190463';
  -- md5(prosrc con espacios normalizados) de clinica_no_suspendida(), la que se copia.
  c_no_susp CONSTANT text := '588de29d551f6d474eb24346748e1148';
  -- Huella de constraints e índices de cita_confirmaciones tal como los deja
  -- esta migración (md5 de sus definiciones, sin «public.»): un replay sobre
  -- una tabla con el mismo nombre y OTRAS reglas aborta en vez de saltarlas.
  c_huella  CONSTANT text := '223dd96f1328cfbfe5139534d7631100';
  c_cols    CONSTANT text[] := ARRAY['id','clinica_id','appointment_id','codigo_hash','paciente_id',
                                     'reserva_correo_hmac','creado_por','respuesta','respondido_en','revocado_en','created_at'];
  c_nombres CONSTANT text[] := ARRAY['cita_confirmacion_coincide','cita_confirmacion_emitir','cita_confirmacion_contexto',
                                     'cita_confirmacion_responder','cita_confirmacion_revocar'];
  v_log  oid := to_regprocedure('public.log_cita_change()');
  v_md5  text;
  v_cols text[];
BEGIN
  IF to_regprocedure('public.gcal_sync_clinica_habilitada(uuid)') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta la puerta S3 gcal_sync_clinica_habilitada(uuid) (C1).';
  END IF;
  IF to_regclass('public.agenda_ajustes') IS NULL
     OR (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass AND NOT attisdropped
           AND (attname, atttypid) IN (('reserva_correo_hmac', 'text'::regtype), ('reserva_canal', 'text'::regtype),
                 ('paciente_id', 'uuid'::regtype), ('medico_id', 'uuid'::regtype), ('status', 'text'::regtype),
                 ('start_time', 'timestamptz'::regtype), ('end_time', 'timestamptz'::regtype),
                 ('all_day', 'boolean'::regtype), ('updated_at', 'timestamptz'::regtype),
                 ('google_event_id', 'text'::regtype), ('gcal_etag', 'text'::regtype),
                 ('consultorio_nombre', 'text'::regtype), ('consultorio_direccion', 'text'::regtype),
                 ('consultorio_telefono', 'text'::regtype), ('consultorio_timezone', 'text'::regtype))) <> 15 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta B1 (agenda_ajustes) o appointments no tiene las columnas esperadas (D1).';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.profiles'::regclass AND NOT attisdropped
        AND attname IN ('id', 'clinica_id', 'titulo', 'nombres', 'apellido_paterno', 'apellido_materno')) <> 6 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: profiles no tiene id, clinica_id, titulo, nombres y apellidos.';
  END IF;
  -- contexto y responder cierran a una clínica suspendida con una COPIA del
  -- predicado de clinica_no_suspendida() (por clínica, no por sesión). La
  -- columna tiene que existir como boolean NOT NULL (con NULL el EXISTS falla
  -- cerrado, pero ya no diría lo mismo que la original), y la original tiene
  -- que seguir siendo la que se copió (md5 de prosrc con los espacios
  -- normalizados; su texto es el de 20260912190416_remote_schema.sql:896).
  -- Si alguien la cambia, se aborta: hay que revisar la copia a mano.
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.clinicas'::regclass AND attname = 'suspendida'
                   AND atttypid = 'boolean'::regtype AND attnotnull AND NOT attisdropped) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: clinicas.suspendida no existe como boolean NOT NULL.';
  END IF;
  IF (SELECT md5(regexp_replace(p.prosrc, '\s+', ' ', 'g')) FROM pg_proc p
       WHERE p.oid = to_regprocedure('public.clinica_no_suspendida()')) IS DISTINCT FROM c_no_susp THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: clinica_no_suspendida() no es la que copian contexto y responder (cambió o no existe). Revisar la copia antes de aplicar.';
  END IF;
  IF to_regprocedure('public.log_tabla_change()') IS NULL OR to_regprocedure('public.get_clinica_id()') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta log_tabla_change() o get_clinica_id().';
  END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure('public.get_clinica_id()')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: get_clinica_id() ya no es SECURITY DEFINER (la policy podría recursar).';
  END IF;
  IF NOT coalesce((SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role'), false) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: service_role no tiene BYPASSRLS; las funciones invoker no verían las filas.';
  END IF;
  -- Una por privilegio: con una lista, has_table_privilege da true si tiene CUALQUIERA.
  IF NOT (has_table_privilege('service_role', 'public.appointments', 'SELECT')
          AND has_table_privilege('service_role', 'public.appointments', 'UPDATE')
          AND has_table_privilege('service_role', 'public.profiles', 'SELECT')
          AND has_table_privilege('service_role', 'public.agenda_ajustes', 'SELECT')
          AND has_table_privilege('service_role', 'public.clinicas', 'SELECT')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: service_role sin privilegios sobre appointments, profiles, agenda_ajustes o clinicas.';
  END IF;
  IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = 'public.appointments'::regclass), 'USAGE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el rol % no es dueño de public.appointments.', current_user;
  END IF;
  IF v_log IS NULL OR NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = v_log AND p.prosecdef
                                    AND p.prorettype = 'trigger'::regtype AND pg_has_role(current_user, p.proowner, 'USAGE')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: log_cita_change() no existe o no es el trigger SECURITY DEFINER de B0 de este rol.';
  END IF;
  -- Ni la de C2 ni la de E1: alguien la cambió; no se pisa a ciegas.
  SELECT md5(prosrc) INTO v_md5 FROM pg_proc WHERE oid = v_log;
  IF v_md5 NOT IN (c_log_c2, c_log_e1) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: log_cita_change no es el cuerpo de C2 ni el de E1 (md5 %). Alguien la cambió: revisar antes de pisarla.', v_md5;
  END IF;
  IF (SELECT count(*) FROM pg_trigger t WHERE t.tgrelid = 'public.appointments'::regclass
        AND t.tgname IN ('audit_appointments', 'audit_appointments_update') AND t.tgfoid = v_log) <> 2 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: los disparadores de B0 no apuntan a log_cita_change().';
  END IF;
  IF position($w$ARRAY['updated_at'::text, 'client_id'::text, 'gcal_sync_status'::text, 'gcal_etag'::text, 'gcal_calendar_id'::text, 'google_event_id'::text]$w$
              IN (SELECT pg_get_triggerdef(t.oid) FROM pg_trigger t
                   WHERE t.tgrelid = 'public.appointments'::regclass AND t.tgname = 'audit_appointments_update')) = 0 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el WHEN de audit_appointments_update ya no es el de B0 (c_tecnicas divergiría).';
  END IF;
  IF to_regclass('public.cita_confirmaciones') IS NOT NULL THEN
    SELECT array_agg(attname::text) INTO v_cols FROM pg_attribute
     WHERE attrelid = 'public.cita_confirmaciones'::regclass AND attnum > 0 AND NOT attisdropped;
    IF NOT (v_cols @> c_cols AND v_cols <@ c_cols) THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.cita_confirmaciones ya existe con OTRAS columnas (%).', v_cols;
    END IF;
    SELECT md5(string_agg(x.d, ';' ORDER BY x.d)) INTO v_md5 FROM (
      SELECT k.conname || ':' || replace(pg_get_constraintdef(k.oid), 'public.', '') AS d
        FROM pg_constraint k WHERE k.conrelid = 'public.cita_confirmaciones'::regclass
      UNION ALL
      SELECT i.indexname || ':' || replace(i.indexdef, 'public.', '')
        FROM pg_indexes i WHERE i.schemaname = 'public' AND i.tablename = 'cita_confirmaciones') x;
    IF v_md5 IS DISTINCT FROM c_huella THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.cita_confirmaciones ya existe con OTRAS constraints o índices (md5 %).', v_md5;
    END IF;
  END IF;
  -- Ninguna sobrecarga con otra firma, y ninguna como SECURITY DEFINER.
  IF EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = ANY (c_nombres)
               AND (p.prosecdef OR p.oid NOT IN (
                 coalesce(to_regprocedure('public.cita_confirmacion_coincide(uuid, text, uuid, text)')::oid, 0::oid),
                 coalesce(to_regprocedure('public.cita_confirmacion_emitir(uuid, uuid, uuid, text, uuid)')::oid, 0::oid),
                 coalesce(to_regprocedure('public.cita_confirmacion_contexto(text)')::oid, 0::oid),
                 coalesce(to_regprocedure('public.cita_confirmacion_responder(uuid, text, text)')::oid, 0::oid),
                 coalesce(to_regprocedure('public.cita_confirmacion_revocar(uuid, uuid)')::oid, 0::oid)))) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: una función cita_confirmacion_* existe como SECURITY DEFINER o con otra firma.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · La tabla, su RLS y sus permisos.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cita_confirmaciones (
  id                  uuid        NOT NULL,
  clinica_id          uuid        NOT NULL,
  appointment_id      uuid        NOT NULL,
  codigo_hash         text        NOT NULL,
  paciente_id         uuid,
  reserva_correo_hmac text,
  creado_por          uuid,
  respuesta           text,
  respondido_en       timestamptz,
  revocado_en         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cita_confirmaciones_pkey PRIMARY KEY (id),
  CONSTRAINT cita_confirmaciones_codigo_key UNIQUE (codigo_hash),
  CONSTRAINT cita_confirmaciones_clinica_fkey FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  CONSTRAINT cita_confirmaciones_cita_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE RESTRICT,
  CONSTRAINT cita_confirmaciones_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT cita_confirmaciones_codigo_check CHECK (codigo_hash ~ '^[0-9a-f]{64}$'),
  -- Exactamente uno de los dos vínculos (IS NOT NULL explícito: un CHECK que da NULL pasa).
  CONSTRAINT cita_confirmaciones_vinculo_check CHECK ((paciente_id IS NOT NULL) <> (reserva_correo_hmac IS NOT NULL)),
  CONSTRAINT cita_confirmaciones_hmac_check CHECK (reserva_correo_hmac IS NULL OR reserva_correo_hmac ~ '^[0-9a-f]{64}$'),
  CONSTRAINT cita_confirmaciones_respuesta_check CHECK (
    (respuesta IS NULL AND respondido_en IS NULL)
    OR (respuesta IS NOT NULL AND respuesta IN ('confirmo', 'cancelo') AND respondido_en IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS cita_confirmaciones_vigente ON public.cita_confirmaciones (appointment_id)
  WHERE revocado_en IS NULL;
-- Para la FK RESTRICT (borrar una cita busca aquí por appointment_id, revocados incluidos).
CREATE INDEX IF NOT EXISTS cita_confirmaciones_cita ON public.cita_confirmaciones (appointment_id);
CREATE INDEX IF NOT EXISTS cita_confirmaciones_respuestas ON public.cita_confirmaciones (clinica_id, respondido_en DESC)
  WHERE respondido_en IS NOT NULL;

ALTER TABLE public.cita_confirmaciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cita_confirmaciones FROM PUBLIC, anon, authenticated, service_role;
-- Sin codigo_hash, sin los dos vínculos y sin creado_por: el personal ve QUÉ respondió el paciente, nada más.
GRANT SELECT (id, clinica_id, appointment_id, respuesta, respondido_en, revocado_en, created_at)
  ON TABLE public.cita_confirmaciones TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.cita_confirmaciones TO service_role;

-- Sin recursión: lee appointments, no cita_confirmaciones; el EXISTS corre
-- bajo la RLS de appointments de quien pregunta (el invitado, sólo las suyas).
-- Sin policy de escritura: authenticated no tiene INSERT ni UPDATE.
DROP POLICY IF EXISTS cita_confirmaciones_select ON public.cita_confirmaciones;
CREATE POLICY cita_confirmaciones_select ON public.cita_confirmaciones FOR SELECT TO authenticated
  USING (clinica_id = public.get_clinica_id()
         AND EXISTS (SELECT 1 FROM public.appointments a
                      WHERE a.id = cita_confirmaciones.appointment_id AND a.clinica_id = public.get_clinica_id()));

CREATE OR REPLACE TRIGGER audit_cita_confirmaciones
  AFTER INSERT OR UPDATE OR DELETE ON public.cita_confirmaciones
  FOR EACH ROW EXECUTE FUNCTION public.log_tabla_change();

-- ---------------------------------------------------------------------
-- 3 · Funciones.
-- ---------------------------------------------------------------------
-- ¿El enlace sigue siendo de quien es hoy el destinatario de la cita? Pura.
CREATE OR REPLACE FUNCTION public.cita_confirmacion_coincide(
  p_enlace_paciente uuid, p_enlace_hmac text, p_cita_paciente uuid, p_cita_hmac text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
  SELECT coalesce((p_enlace_paciente IS NOT NULL AND p_enlace_paciente = p_cita_paciente)
               OR (p_enlace_hmac IS NOT NULL AND p_enlace_hmac = p_cita_hmac), false);
$fn$;
REVOKE EXECUTE ON FUNCTION public.cita_confirmacion_coincide(uuid, text, uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cita_confirmacion_coincide(uuid, text, uuid, text) TO anon, authenticated, service_role;

-- Emitir (o devolver el vigente). El id y su hash los genera el servidor. Si
-- ya hay uno vigente que coincide, se devuelve ESE (r_id ≠ p_id) con su hash,
-- para que el servidor compruebe que el código que deriva sigue siendo el
-- guardado (tras rotar RESERVA_SECRETO no lo es: revoca y emite otro).
-- UNA fila siempre; r_id NULL = no aplica (apagado, sin acceso, pasada, sin
-- destinatario, otra clínica). Usar .single().
CREATE OR REPLACE FUNCTION public.cita_confirmacion_emitir(
  p_clinica_id uuid, p_cita_id uuid, p_id uuid, p_codigo_hash text, p_creado_por uuid)
RETURNS TABLE (r_id uuid, r_codigo_hash text)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_a record;
  v_c public.cita_confirmaciones%ROWTYPE;
BEGIN
  IF p_clinica_id IS NULL OR p_cita_id IS NULL OR p_id IS NULL OR p_codigo_hash IS NULL
     OR p_codigo_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'cita_confirmacion_emitir: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.agenda_ajustes j WHERE j.clinica_id = p_clinica_id AND j.agenda_v2_encendida)
     OR NOT public.gcal_sync_clinica_habilitada(p_clinica_id) THEN
    RETURN NEXT; RETURN;
  END IF;
  -- Serializa las emisiones de ESTA cita sin bloquear su fila en appointments.
  PERFORM pg_advisory_xact_lock(1791, hashtext(p_cita_id::text));
  SELECT a.id, a.paciente_id, a.reserva_correo_hmac INTO v_a
    FROM public.appointments a
   WHERE a.id = p_cita_id AND a.clinica_id = p_clinica_id
     AND a.status IN ('scheduled', 'confirmed') AND NOT a.all_day AND a.start_time > now()
     AND (a.paciente_id IS NOT NULL OR a.reserva_canal IS NOT NULL);
  IF NOT FOUND OR (v_a.paciente_id IS NULL AND v_a.reserva_correo_hmac IS NULL) THEN
    RETURN NEXT; RETURN;
  END IF;
  SELECT c.* INTO v_c FROM public.cita_confirmaciones c
   WHERE c.appointment_id = p_cita_id AND c.clinica_id = p_clinica_id AND c.revocado_en IS NULL;
  IF FOUND THEN
    IF public.cita_confirmacion_coincide(v_c.paciente_id, v_c.reserva_correo_hmac, v_a.paciente_id, v_a.reserva_correo_hmac) THEN
      r_id := v_c.id; r_codigo_hash := v_c.codigo_hash;
      RETURN NEXT; RETURN;
    END IF;
    UPDATE public.cita_confirmaciones SET revocado_en = now() WHERE id = v_c.id AND clinica_id = p_clinica_id;
  END IF;
  INSERT INTO public.cita_confirmaciones (id, clinica_id, appointment_id, codigo_hash, paciente_id, reserva_correo_hmac, creado_por)
  VALUES (p_id, p_clinica_id, p_cita_id, p_codigo_hash, v_a.paciente_id,
          CASE WHEN v_a.paciente_id IS NULL THEN v_a.reserva_correo_hmac END,
          (SELECT p.id FROM public.profiles p WHERE p.id = p_creado_por AND p.clinica_id = p_clinica_id));
  r_id := p_id; r_codigo_hash := p_codigo_hash;
  RETURN NEXT;
END
$fn$;

-- Revocar el enlace vigente de una cita (el servidor, tras rotar el secreto;
-- E6 al reagendar). Devuelve cuántos revocó (0 o 1). Nunca borra.
CREATE OR REPLACE FUNCTION public.cita_confirmacion_revocar(p_clinica_id uuid, p_cita_id uuid)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_n integer;
BEGIN
  IF p_clinica_id IS NULL OR p_cita_id IS NULL THEN
    RAISE EXCEPTION 'cita_confirmacion_revocar: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  -- El mismo candado que emitir: una revocación y una emisión de la MISMA cita
  -- no se intercalan (emitir no devuelve un vigente que se está revocando).
  PERFORM pg_advisory_xact_lock(1791, hashtext(p_cita_id::text));
  UPDATE public.cita_confirmaciones SET revocado_en = now()
   WHERE appointment_id = p_cita_id AND clinica_id = p_clinica_id AND revocado_en IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END
$fn$;

-- Lo que enseña la página: lo mínimo (§5 E). NULL = 404 indistinguible.
-- NUNCA título, notas, paciente, tipo de cita, especialidad ni ids de la cita.
-- clinica_id sale para el servidor (responder la exige); la página no lo pinta.
CREATE OR REPLACE FUNCTION public.cita_confirmacion_contexto(p_codigo_hash text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_c      public.cita_confirmaciones%ROWTYPE;
  v_a      record;
  v_estado text;
BEGIN
  IF p_codigo_hash IS NULL OR p_codigo_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN NULL;
  END IF;
  SELECT c.* INTO v_c FROM public.cita_confirmaciones c WHERE c.codigo_hash = p_codigo_hash;
  IF NOT FOUND OR v_c.revocado_en IS NOT NULL THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.agenda_ajustes j WHERE j.clinica_id = v_c.clinica_id AND j.agenda_v2_encendida) THEN
    RETURN NULL;
  END IF;
  -- Clínica suspendida = no disponible (auditoría de E1, hallazgo 1). Es
  -- clinica_no_suspendida() con la clínica del enlace en vez de get_clinica_id().
  IF NOT EXISTS (SELECT 1 FROM public.clinicas k WHERE k.id = v_c.clinica_id AND NOT k.suspendida) THEN
    RETURN NULL;
  END IF;
  SELECT a.id, a.status, a.start_time, a.end_time, a.medico_id, a.paciente_id, a.reserva_correo_hmac,
         a.consultorio_nombre, a.consultorio_direccion, a.consultorio_telefono, a.consultorio_timezone
    INTO v_a
    FROM public.appointments a
   WHERE a.id = v_c.appointment_id AND a.clinica_id = v_c.clinica_id;
  IF NOT FOUND OR NOT public.cita_confirmacion_coincide(v_c.paciente_id, v_c.reserva_correo_hmac,
                                                        v_a.paciente_id, v_a.reserva_correo_hmac) THEN
    RETURN NULL;
  END IF;
  v_estado := CASE
    WHEN v_a.status IN ('attended', 'no_show') THEN 'cerrada'
    WHEN v_a.status = 'cancelled'              THEN 'cancelada'
    WHEN v_a.start_time <= now()               THEN 'pasada'
    WHEN v_a.status = 'confirmed'              THEN 'confirmada'
    ELSE 'agendada' END;
  RETURN jsonb_build_object(
    'clinica_id', v_c.clinica_id,
    'estado', v_estado,
    'inicio', v_a.start_time,
    'fin', v_a.end_time,
    'zona', v_a.consultorio_timezone,
    'medico', (SELECT jsonb_build_object('titulo', p.titulo, 'nombres', p.nombres,
                                         'apellido_paterno', p.apellido_paterno, 'apellido_materno', p.apellido_materno)
                 FROM public.profiles p WHERE p.id = v_a.medico_id AND p.clinica_id = v_c.clinica_id),
    'consultorio', jsonb_build_object('nombre', v_a.consultorio_nombre, 'direccion', v_a.consultorio_direccion,
                                      'telefono', v_a.consultorio_telefono),
    'puede_confirmar', v_estado = 'agendada',
    'puede_cancelar', v_estado IN ('agendada', 'confirmada') AND v_a.start_time - interval '1 hour' > now(),
    'corte_cancelar', v_a.start_time - interval '1 hour',
    'respuesta', v_c.respuesta);
END
$fn$;

-- La respuesta. UNA fila siempre; usar .single().
-- r_resultado: confirmada | cancelada | ya_confirmada | ya_cancelada | cerrada
--              | pasada | fuera_de_plazo | invalido.
CREATE OR REPLACE FUNCTION public.cita_confirmacion_responder(p_clinica_id uuid, p_codigo_hash text, p_accion text)
RETURNS TABLE (r_resultado text, r_cita_id uuid, r_google_event_id text, r_gcal_etag text)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_c     public.cita_confirmaciones%ROWTYPE;
  v_a     record;
  v_ahora timestamptz;
BEGIN
  IF p_clinica_id IS NULL OR p_codigo_hash IS NULL OR p_codigo_hash !~ '^[0-9a-f]{64}$'
     OR p_accion IS NULL OR p_accion NOT IN ('confirmar', 'cancelar') THEN
    RAISE EXCEPTION 'cita_confirmacion_responder: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  SELECT c.* INTO v_c FROM public.cita_confirmaciones c
   WHERE c.codigo_hash = p_codigo_hash AND c.clinica_id = p_clinica_id
   FOR UPDATE;
  IF NOT FOUND OR v_c.revocado_en IS NOT NULL
     OR NOT EXISTS (SELECT 1 FROM public.agenda_ajustes j WHERE j.clinica_id = p_clinica_id AND j.agenda_v2_encendida)
     -- Suspendida = no disponible, como en contexto (auditoría de E1, hallazgo 1).
     OR NOT EXISTS (SELECT 1 FROM public.clinicas k WHERE k.id = p_clinica_id AND NOT k.suspendida) THEN
    r_resultado := 'invalido'; RETURN NEXT; RETURN;
  END IF;
  -- La cita, bloqueada: lo de abajo decide sobre la fila VIGENTE.
  SELECT a.id, a.status, a.start_time, a.updated_at, a.paciente_id, a.reserva_correo_hmac, a.google_event_id, a.gcal_etag
    INTO v_a
    FROM public.appointments a
   WHERE a.id = v_c.appointment_id AND a.clinica_id = p_clinica_id
   FOR UPDATE;
  IF NOT FOUND OR NOT public.cita_confirmacion_coincide(v_c.paciente_id, v_c.reserva_correo_hmac,
                                                        v_a.paciente_id, v_a.reserva_correo_hmac) THEN
    r_resultado := 'invalido'; RETURN NEXT; RETURN;
  END IF;
  r_cita_id := v_a.id;
  -- Hora REAL tras los candados (ver cabecera). No usar now() aquí.
  v_ahora := clock_timestamp();
  IF v_a.status IN ('attended', 'no_show') THEN r_resultado := 'cerrada';      RETURN NEXT; RETURN; END IF;
  IF v_a.status = 'cancelled'              THEN r_resultado := 'ya_cancelada'; RETURN NEXT; RETURN; END IF;
  IF v_a.start_time <= v_ahora             THEN r_resultado := 'pasada';       RETURN NEXT; RETURN; END IF;

  IF p_accion = 'confirmar' THEN
    IF v_a.status = 'confirmed' THEN r_resultado := 'ya_confirmada'; RETURN NEXT; RETURN; END IF;
    PERFORM set_config('spinus.via', 'enlace_paciente', true);
    UPDATE public.appointments
       SET status = 'confirmed', updated_at = greatest(coalesce(v_a.updated_at, v_ahora), v_ahora)
     WHERE id = v_a.id AND clinica_id = p_clinica_id;
    UPDATE public.cita_confirmaciones SET respuesta = 'confirmo', respondido_en = v_ahora
     WHERE id = v_c.id AND clinica_id = p_clinica_id;
    r_resultado := 'confirmada';
  ELSE
    -- §2: hasta 1 hora antes. A T-1h exacto ya no.
    IF v_a.start_time - interval '1 hour' <= v_ahora THEN
      r_resultado := 'fuera_de_plazo'; RETURN NEXT; RETURN;
    END IF;
    PERFORM set_config('spinus.via', 'enlace_paciente', true);
    UPDATE public.appointments
       SET status = 'cancelled', updated_at = greatest(coalesce(v_a.updated_at, v_ahora), v_ahora)
     WHERE id = v_a.id AND clinica_id = p_clinica_id;
    UPDATE public.cita_confirmaciones SET respuesta = 'cancelo', respondido_en = v_ahora
     WHERE id = v_c.id AND clinica_id = p_clinica_id;
    r_resultado := 'cancelada';
  END IF;
  r_google_event_id := v_a.google_event_id;
  r_gcal_etag := v_a.gcal_etag;
  RETURN NEXT;
END
$fn$;

-- Permisos de funciones: SOLO service_role, justificado: son la lectura y la
-- escritura de la página pública y del servidor sin sesión; ni la consola ni
-- una sesión de la app deben escribir citas por aquí saltándose la RLS.
REVOKE EXECUTE ON FUNCTION public.cita_confirmacion_emitir(uuid, uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cita_confirmacion_emitir(uuid, uuid, uuid, text, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.cita_confirmacion_revocar(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cita_confirmacion_revocar(uuid, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.cita_confirmacion_contexto(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cita_confirmacion_contexto(text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.cita_confirmacion_responder(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cita_confirmacion_responder(uuid, text, text) TO service_role;

-- ---------------------------------------------------------------------
-- 4 · log_cita_change: la de C2 + lista blanca de «via». Nada más cambia.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_cita_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  -- ⚠️ La misma lista que el WHEN de audit_appointments_update. Van juntas.
  c_tecnicas CONSTANT text[] := ARRAY['updated_at', 'client_id', 'gcal_sync_status',
                                      'gcal_etag', 'gcal_calendar_id', 'google_event_id'];
  -- C2 'google' · E1/E6 'enlace_paciente' · E9 'google_rsvp'. Sólo éstos, sólo sin sesión.
  c_vias     CONSTANT text[] := ARRAY['google', 'enlace_paciente', 'google_rsvp'];
  v_uid    uuid := auth.uid();
  v_via    text := current_setting('spinus.via', true);
  v_fila   record;
  v_campos text[];
  v_accion text;
  v_desc   jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN v_fila := OLD; ELSE v_fila := NEW; END IF;
  v_desc := jsonb_build_object('clinica_id', v_fila.clinica_id,
                               'con_paciente', v_fila.paciente_id IS NOT NULL,
                               'origen', v_fila.origen);
  -- «Quién lo hizo sin sesión»: sólo sin auth.uid() y sólo un literal de la
  -- lista. Lo ponen las RPC de service_role con set_config(…, true).
  IF v_uid IS NULL AND v_via = ANY (c_vias) THEN
    v_desc := v_desc || jsonb_build_object('via', v_via);
  END IF;
  IF TG_OP = 'INSERT' THEN
    v_accion := 'cita_alta';
  ELSIF TG_OP = 'DELETE' THEN
    v_accion := 'cita_eliminada';
  ELSE
    -- Sólo NOMBRES de columna: n.value se compara, nunca se escribe.
    SELECT coalesce(array_agg(n.key ORDER BY n.key), ARRAY[]::text[]) INTO v_campos
      FROM jsonb_each(to_jsonb(NEW)) AS n
     WHERE n.key <> ALL (c_tecnicas)
       AND (to_jsonb(OLD) -> n.key) IS DISTINCT FROM n.value;
    -- El WHEN ya lo garantiza; esto sólo evita una fila vacía si divergieran.
    IF cardinality(v_campos) = 0 THEN RETURN NULL; END IF;
    v_accion := CASE
      WHEN OLD.status IS DISTINCT FROM 'cancelled' AND NEW.status = 'cancelled' THEN 'cita_cancelada'
      WHEN OLD.status = 'cancelled' AND NEW.status IS DISTINCT FROM 'cancelled' THEN 'cita_reactivada'
      ELSE 'cita_editada'
    END;
    v_desc := v_desc || jsonb_build_object('campos', to_jsonb(v_campos));
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_desc := v_desc || jsonb_build_object('estado', jsonb_build_object('de', OLD.status, 'a', NEW.status));
    END IF;
  END IF;
  INSERT INTO public.audit_log (user_id, accion, tabla, registro_id, descripcion)
  VALUES (coalesce(v_uid::text, 'system'), v_accion, 'appointments', v_fila.id, v_desc::text);
  RETURN NULL;  -- AFTER ... FOR EACH ROW: el valor de retorno se ignora.
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.log_cita_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_cita_change() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.log_cita_change() IS
  'Auditoría de public.appointments (AG-DT-10). Escribe NOMBRES de columnas y estado de→a, nunca valores: audit_log es inmutable y no admite ARCO. "via" sólo sin auth.uid() y con el GUC spinus.via en la lista blanca c_vias: google (C2), enlace_paciente (E1/E6), google_rsvp (E9); otro literal no se escribe. La lista c_tecnicas está también en el WHEN de audit_appointments_update: cambiar las dos.';
COMMENT ON TABLE public.cita_confirmaciones IS
  'Enlace de confirmación por cita y la última respuesta del paciente (agenda E1). El código NO se guarda: HMAC(subllave confirmacion de RESERVA_SECRETO, ''confirmacion:''||id); aquí sólo sha256. Uno vigente por cita; se revoca, nunca se borra. CONVENIO (dimensión 16): paciente_id SIN FK a propósito (ver la migración); el enlace vale si coincide con el paciente vigente de la cita o, en una cita por ligar, con su reserva_correo_hmac (cita_confirmacion_coincide). Sólo escriben las funciones cita_confirmacion_*; rotar RESERVA_SECRETO invalida todos.';
COMMENT ON COLUMN public.cita_confirmaciones.paciente_id IS
  'Paciente al que se emitió el enlace. SIN FK a propósito: una FK RESTRICT impediría borrar pacientes sin historial y SET NULL/CASCADE no se permiten. Exactamente uno de paciente_id / reserva_correo_hmac. Si el paciente de la cita cambia o se borra, el enlace deja de coincidir y deja de valer.';
COMMENT ON COLUMN public.cita_confirmaciones.respuesta IS
  'confirmo | cancelo: la ÚLTIMA respuesta del paciente por este enlace (respondido_en, su hora). Un confirmo seguido de un cancelo deja cancelo; el historial va en audit_log.';

COMMIT;

-- ---------------------------------------------------------------------
-- 5 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO' WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'cita_confirmaciones: RLS / policies' AS comprobacion,
         coalesce((SELECT relrowsecurity::text FROM pg_class WHERE oid = to_regclass('public.cita_confirmaciones')), 'AUSENTE')
         || ' / ' || coalesce((SELECT string_agg(cmd, ',' ORDER BY cmd) FROM pg_policies
                                WHERE schemaname = 'public' AND tablename = 'cita_confirmaciones'), '-') AS valor,
         'true / SELECT' AS esperado
  UNION ALL
  SELECT 2, 'privilegios de TABLA anon / authenticated / service_role',
         coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
                    WHERE table_schema = 'public' AND table_name = 'cita_confirmaciones' AND grantee = 'anon'), '-') || ' / '
         || coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
                    WHERE table_schema = 'public' AND table_name = 'cita_confirmaciones' AND grantee = 'authenticated'), '-') || ' / '
         || coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
                    WHERE table_schema = 'public' AND table_name = 'cita_confirmaciones' AND grantee = 'service_role'), '-'),
         '- / - / INSERT,SELECT,UPDATE'
  UNION ALL
  SELECT 3, 'columnas que authenticated puede leer',
         coalesce((SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.column_privileges
                    WHERE table_schema = 'public' AND table_name = 'cita_confirmaciones'
                      AND grantee = 'authenticated' AND privilege_type = 'SELECT'), '-'),
         'appointment_id,clinica_id,created_at,id,respondido_en,respuesta,revocado_en'
  UNION ALL
  SELECT 4, 'FKs (sin CASCADE) / huella de constraints e índices',
         coalesce((SELECT string_agg(conname || '=' || confdeltype::text, ',' ORDER BY conname) FROM pg_constraint
                    WHERE conrelid = to_regclass('public.cita_confirmaciones') AND contype = 'f'), '-')
         || ' / ' || coalesce((SELECT md5(string_agg(x.d, ';' ORDER BY x.d)) FROM (
              SELECT k.conname || ':' || replace(pg_get_constraintdef(k.oid), 'public.', '') AS d
                FROM pg_constraint k WHERE k.conrelid = to_regclass('public.cita_confirmaciones')
              UNION ALL
              SELECT i.indexname || ':' || replace(i.indexdef, 'public.', '')
                FROM pg_indexes i WHERE i.schemaname = 'public' AND i.tablename = 'cita_confirmaciones') x), '-'),
         'cita_confirmaciones_cita_fkey=r,cita_confirmaciones_clinica_fkey=r,cita_confirmaciones_creado_por_fkey=n / 223dd96f1328cfbfe5139534d7631100'
  UNION ALL
  SELECT 5, 'funciones: definer / EXECUTE anon,authenticated,service_role / PUBLIC',
         coalesce((SELECT string_agg(p.proname || '=' || p.prosecdef::text || '/' || has_function_privilege('anon', p.oid, 'EXECUTE')::text
                    || ',' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || ','
                    || has_function_privilege('service_role', p.oid, 'EXECUTE')::text || '/'
                    || (EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                 WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'))::text, ' ; ' ORDER BY p.proname)
                     FROM pg_proc p WHERE p.oid IN (
                       to_regprocedure('public.cita_confirmacion_coincide(uuid, text, uuid, text)'),
                       to_regprocedure('public.cita_confirmacion_emitir(uuid, uuid, uuid, text, uuid)'),
                       to_regprocedure('public.cita_confirmacion_revocar(uuid, uuid)'),
                       to_regprocedure('public.cita_confirmacion_contexto(text)'),
                       to_regprocedure('public.cita_confirmacion_responder(uuid, text, text)'))), '-'),
         'cita_confirmacion_coincide=false/true,true,true/false ; cita_confirmacion_contexto=false/false,false,true/false ; cita_confirmacion_emitir=false/false,false,true/false ; cita_confirmacion_responder=false/false,false,true/false ; cita_confirmacion_revocar=false/false,false,true/false'
  UNION ALL
  SELECT 6, 'log_cita_change: definer / search_path / md5 de E1 / EXECUTE PUBLIC,anon,authenticated,service_role',
         coalesce((SELECT p.prosecdef::text || ' / ' || coalesce(array_to_string(p.proconfig, ','), '') || ' / '
                          || (md5(p.prosrc) = '80c3556c1655ddf2eaf1d57995190463')::text || ' / '
                          || (EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                       WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'))::text
                          || ',' || has_function_privilege('anon', p.oid, 'EXECUTE')::text
                          || ',' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                          || ',' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.log_cita_change()')), 'AUSENTE'),
         'true / search_path="" / true / false,true,true,true'
  UNION ALL
  SELECT 7, 'disparadores: audit_cita_confirmaciones / audit_appointments*',
         (SELECT count(*)::text FROM pg_trigger WHERE tgrelid = to_regclass('public.cita_confirmaciones')
             AND tgname = 'audit_cita_confirmaciones' AND tgenabled = 'O') || ' / '
         || (SELECT count(*)::text FROM pg_trigger t WHERE t.tgrelid = 'public.appointments'::regclass
             AND t.tgname IN ('audit_appointments', 'audit_appointments_update')
             AND t.tgfoid = to_regprocedure('public.log_cita_change()') AND t.tgenabled = 'O'),
         '1 / 2'
  UNION ALL
  SELECT 8, 'las 5 policies de appointments, intactas',
         (SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'appointments'),
         'appointments_delete,appointments_gates_insert,appointments_insert,appointments_select,appointments_update'
  UNION ALL
  SELECT 9, 'contexto / responder: md5 del cuerpo con el cierre de la suspendida (hallazgo 1)',
         coalesce((SELECT string_agg(p.proname || '=' || md5(p.prosrc), ',' ORDER BY p.proname)
                     FROM pg_proc p WHERE p.oid IN (to_regprocedure('public.cita_confirmacion_contexto(text)'),
                                                     to_regprocedure('public.cita_confirmacion_responder(uuid, text, text)'))), '-'),
         'cita_confirmacion_contexto=2fca66ffb8ea3b15eb7d0224c90a4f1a,cita_confirmacion_responder=7961e24a4f9f7bda0ce2df744f5b46aa'
  UNION ALL
  SELECT 10, 'censo: enlaces / vigentes / con respuesta',
         (SELECT count(*)::text FROM public.cita_confirmaciones) || ' / '
         || (SELECT count(*)::text FROM public.cita_confirmaciones WHERE revocado_en IS NULL) || ' / '
         || (SELECT count(*)::text FROM public.cita_confirmaciones WHERE respuesta IS NOT NULL), NULL
) t
ORDER BY t.n;
