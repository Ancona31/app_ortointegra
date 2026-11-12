-- ═══════════════════════════════════════════════════════════════════════
-- Agenda E4 — registro de correos de cita (recordatorio y comprobante):
-- idempotencia, candado con testigo y reintentos, para la tarea programada
-- Rama: feature/agenda-v2 · Escrita: 2026-11-12
-- Riesgo estimado: MEDIO (tabla nueva vacía; una lectura ENTRE CLÍNICAS que
-- sólo devuelve ids, como gcal_sync_clinicas_pendientes de C1).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-11-12
--   `docker exec -i supabase_db_app_ortointegra psql -U postgres
--   -v ON_ERROR_STOP=1 -f` del archivo completo (rejilla: 8 × OK + 1 INFO,
--   censo «-»), y una segunda y tercera pasada: misma rejilla, sólo NOTICE
--   «already exists, skipping» (tabla e índice), y no-op comprobado con una
--   huella de catálogo de 151 renglones (columnas con tipo, NOT NULL, DEFAULT
--   y COMMENT; relacl, RLS y COMMENT de la tabla; constraints; índices;
--   policies de la tabla y de appointments; disparador; md5, proacl,
--   prosecdef, provolatile y proconfig de las funciones; privilegios de tabla
--   y por columna; count(*) de audit_log): sin diferencias. Pre-vuelo probado
--   en ROLLBACK: aborta con una constraint quitada, con una columna de más,
--   con una sobrecarga de cita_correo_marcar y con cita_correo_tomar como
--   SECURITY DEFINER. Anotada a mano en supabase_migrations.schema_migrations
--   (versión 20261115140000), como D1-E1.
--   Pruebas: supabase/pruebas-sql/e4_correos_cita.sql (bash scripts/pruebas-sql.sh).
--   Comprobación:
--     select proname, prosecdef, proacl from pg_proc
--      where proname in ('cita_correos_pendientes','cita_correo_tomar','cita_correo_marcar');
--   → tres filas, prosecdef = false, EXECUTE sólo postgres y service_role.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de B1, C1, D1 y E1).
-- AUDITORÍA INDEPENDIENTE 2026-11-12: APTA CON CAMBIOS
-- (supabase/AUDITORIA-MIGRACIONES.md). Aplicado antes del commit:
--   · Hallazgo 1: un comprobante «enviando» tomado hace menos de 10 min
--     también impide el recordatorio del mismo inicio (antes sólo
--     «enviado»: el after() de la reserva y la tarea podían coincidir y
--     mandar los dos). En el listado y en la toma a la vez; caso 6 de la prueba.
--   NO aplicado, con su razón (para revisar por Angel):
--   · Hallazgo 2: un envío «enviando» en su TERCER intento cuya ejecución
--     muere sin marcar se queda así para siempre (no pasa a fallido). No se
--     manda nada de más; sólo falta el renglón de cierre. Cerrarlo pide un
--     barrido aparte.
--   · Hallazgo 3: «duplicado» junta el 409 permanente (otro cuerpo) y el
--     concurrente (el primero sigue en curso); los dos sin reintento: en los
--     dos el correo salió o está saliendo.
--   · Hallazgo 5: el pre-vuelo no compara la definición del disparador.
--   Resuelto por el auditor (antes «sin calificar» en B0-E1): el BEGIN/COMMIT
--   explícito con el SELECT final fuera es correcto con postgres-meta
--   (dist/lib/db.js del contenedor local). Propuso una dimensión 19
--   (funciones que reescriben y ejecutan el prosrc de OTRA, como la puerta
--   S3): anotada en mejora_agendaV2.md §6-bis, no en el archivo.
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- mejora_agendaV2.md §2 «Correos» y §5 E; diseño en plan_E.md E4 (allí se
-- llamaba «E2 correos»; el número de archivo es el del paso E4).
-- cita_correos — un renglón por (cita, tipo, inicio_cita). NO SE GUARDA
--   DESTINATARIO NI CONTENIDO: sólo qué cita, qué tipo, para qué hora de
--   inicio y cómo terminó. Si el personal mueve la cita, la hora nueva tiene
--   su propio recordatorio (lista A 5). Una tabla y NO marcas en
--   appointments: una columna nueva allí se auditaría como cita_editada en
--   cada envío (c_tecnicas es lista de exclusión, en dos sitios) y es
--   contrato con la consola.
-- IDEMPOTENCIA, en tres capas:
--   (1) UNIQUE de la llave + INSERT … ON CONFLICT con condición: sólo una
--       ejecución toma el envío.
--   (2) testigo + tomado_en: una ejecución muerta suelta el envío a los
--       10 min (más que maxDuration = 60 s); sólo quien lo tomó lo cierra.
--   (3) Resend con Idempotency-Key = '<tipo>/<id>' (24 h; exige el mismo
--       cuerpo, así que el correo se compone determinista de la fila).
--   Máximo 3 intentos (lista A 6). 'fallido' con motivo 'duplicado' (409 de
--   Resend: el primero salió o sigue en curso) NO se reintenta.
-- VENTANA del recordatorio: inicio en (now()+1 h, now()+N h], con N =
--   agenda_ajustes.recordatorio_horas (1–72, lista A 3). Una ejecución
--   perdida la recoge la siguiente mientras la cita siga dentro; por debajo
--   de 1 h ya no se manda (el enlace ya no cancela).
-- No se manda recordatorio si ya salió el COMPROBANTE para ESE inicio (lista
--   A 4: una reserva hecha dentro de la ventana ya trae el enlace), ni si
--   está SALIENDO (enviando, tomado hace menos de 10 min: el after() de la
--   reserva y la tarea pueden coincidir). El tipo 'comprobante' lo usará E5
--   con las mismas dos funciones.
-- DESTINATARIO (⚠️ la MISMA expresión en cita_correos_pendientes y en
--   cita_correo_tomar: van juntas): con paciente activo, su email y si no
--   tiene, reserva_correo; por ligar, reserva_correo; nada más. Nunca un
--   evento sin paciente ni de todo el día (lista A 2).
-- PUERTAS: interruptor encendido y S3 (gcal_sync_clinica_habilitada), en el
--   listado (para que las clínicas sin acceso no ocupen el tope) y otra vez
--   en la toma, por clínica.
-- Todas INVOKER y sólo service_role (BYPASSRLS, comprobado). Ninguna
--   SECURITY DEFINER nueva. Ninguna escribe agenda_ajustes ni appointments.
-- Aislamiento: el listado es la ÚNICA lectura entre clínicas y devuelve sólo
--   (clinica_id, cita_id); tomar y marcar reciben p_clinica_id OBLIGATORIO y
--   lo casan con la fila en cada sentencia.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere B0, B1, C1, D1 y E1. PG ≥ 14.
-- Bloqueos (lock_timeout 5 s): CREATE TABLE con FK → SHARE ROW EXCLUSIVE un
--   instante sobre clinicas y appointments (bloquea escrituras de citas un
--   instante, no lecturas). Tabla nueva vacía: índices instantáneos.
-- Orden respecto al código: PRIMERO esta migración. Sin ella la tarea recibe
--   PGRST202 y responde {ok:true} sin hacer nada.
-- Alcance de los roles:
--   gana — service_role: EXECUTE de 3 funciones; SELECT/INSERT/UPDATE en
--          cita_correos. authenticated: SELECT de 7 columnas (sin testigo,
--          tomado_en, intentos, motivo ni marcas de tiempo internas) de los
--          envíos de las citas que YA ve (EXISTS bajo la RLS de appointments).
--   pierde — anon: todo sobre la tabla nueva; authenticated: escribirla;
--          service_role: DELETE/TRUNCATE/REFERENCES/TRIGGER en ella.
--   appointments, pacientes y audit_log: sin cambio de permisos.
-- Contrato con spinus-consola: tabla nueva; ninguna columna de public cambia.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   Respaldar antes:
--     CREATE TABLE respaldos.cita_correos_AAAAMMDD AS SELECT * FROM public.cita_correos;
--   DROP FUNCTION IF EXISTS public.cita_correo_marcar(uuid, uuid, uuid, text, text);
--   DROP FUNCTION IF EXISTS public.cita_correo_tomar(uuid, uuid, text, uuid);
--   DROP FUNCTION IF EXISTS public.cita_correos_pendientes(integer);
--   DROP TABLE IF EXISTS public.cita_correos;
-- Sin la tabla, la próxima tarea volvería a mandar recordatorios ya enviados
-- (dentro de las 24 h de Resend los frena la Idempotency-Key; después, no).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de crear nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  -- Huella de constraints e índices de cita_correos tal como los deja esta
  -- migración (md5 de sus definiciones, sin «public.»).
  c_huella  CONSTANT text := '93981fdfca374c88486803d4cea04db2';
  c_cols    CONSTANT text[] := ARRAY['id','clinica_id','appointment_id','tipo','inicio_cita','estado','intentos',
                                     'testigo','tomado_en','enviado_en','motivo','created_at','updated_at'];
  c_nombres CONSTANT text[] := ARRAY['cita_correos_pendientes','cita_correo_tomar','cita_correo_marcar'];
  v_md5  text;
  v_cols text[];
BEGIN
  IF to_regclass('public.cita_confirmaciones') IS NULL
     OR to_regprocedure('public.cita_confirmacion_emitir(uuid, uuid, uuid, text, uuid)') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta E1 (cita_confirmaciones y cita_confirmacion_emitir).';
  END IF;
  IF to_regprocedure('public.gcal_sync_clinica_habilitada(uuid)') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta la puerta S3 gcal_sync_clinica_habilitada(uuid) (C1).';
  END IF;
  IF to_regclass('public.agenda_ajustes') IS NULL
     OR (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.agenda_ajustes'::regclass AND NOT attisdropped
           AND (attname, atttypid) IN (('clinica_id', 'uuid'::regtype), ('recordatorio_horas', 'int4'::regtype),
                                       ('agenda_v2_encendida', 'bool'::regtype))) <> 3 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta B1 (agenda_ajustes con recordatorio_horas y agenda_v2_encendida).';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass AND NOT attisdropped
        AND (attname, atttypid) IN (('id', 'uuid'::regtype), ('clinica_id', 'uuid'::regtype), ('paciente_id', 'uuid'::regtype),
              ('medico_id', 'uuid'::regtype), ('status', 'text'::regtype), ('start_time', 'timestamptz'::regtype),
              ('end_time', 'timestamptz'::regtype), ('all_day', 'bool'::regtype), ('reserva_canal', 'text'::regtype),
              ('reserva_correo', 'text'::regtype), ('consultorio_nombre', 'text'::regtype),
              ('consultorio_direccion', 'text'::regtype), ('consultorio_telefono', 'text'::regtype),
              ('consultorio_timezone', 'text'::regtype))) <> 14 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: appointments no tiene las columnas esperadas (D1).';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.pacientes'::regclass AND NOT attisdropped
        AND (attname, atttypid) IN (('id', 'uuid'::regtype), ('clinica_id', 'uuid'::regtype),
                                    ('email', 'text'::regtype), ('activo', 'bool'::regtype))) <> 4 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: pacientes no tiene id, clinica_id, email y activo.';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.profiles'::regclass AND NOT attisdropped
        AND attname IN ('id', 'clinica_id', 'titulo', 'nombres', 'apellido_paterno', 'apellido_materno')) <> 6 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: profiles no tiene id, clinica_id, titulo, nombres y apellidos.';
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
          AND has_table_privilege('service_role', 'public.pacientes', 'SELECT')
          AND has_table_privilege('service_role', 'public.profiles', 'SELECT')
          AND has_table_privilege('service_role', 'public.agenda_ajustes', 'SELECT')
          AND has_function_privilege('service_role', 'public.gcal_sync_clinica_habilitada(uuid)', 'EXECUTE')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: service_role sin privilegios sobre appointments, pacientes, profiles, agenda_ajustes o la puerta S3.';
  END IF;
  IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = 'public.appointments'::regclass), 'USAGE')
     OR NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = 'public.clinicas'::regclass), 'USAGE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el rol % no es dueño de public.appointments o public.clinicas.', current_user;
  END IF;
  IF to_regclass('public.cita_correos') IS NOT NULL THEN
    SELECT array_agg(attname::text) INTO v_cols FROM pg_attribute
     WHERE attrelid = 'public.cita_correos'::regclass AND attnum > 0 AND NOT attisdropped;
    IF NOT (v_cols @> c_cols AND v_cols <@ c_cols) THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.cita_correos ya existe con OTRAS columnas (%).', v_cols;
    END IF;
    SELECT md5(string_agg(x.d, ';' ORDER BY x.d)) INTO v_md5 FROM (
      SELECT k.conname || ':' || replace(pg_get_constraintdef(k.oid), 'public.', '') AS d
        FROM pg_constraint k WHERE k.conrelid = 'public.cita_correos'::regclass
      UNION ALL
      SELECT i.indexname || ':' || replace(i.indexdef, 'public.', '')
        FROM pg_indexes i WHERE i.schemaname = 'public' AND i.tablename = 'cita_correos') x;
    IF v_md5 IS DISTINCT FROM c_huella THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.cita_correos ya existe con OTRAS constraints o índices (md5 %).', v_md5;
    END IF;
  END IF;
  -- Ninguna sobrecarga con otra firma, y ninguna como SECURITY DEFINER.
  IF EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = ANY (c_nombres)
               AND (p.prosecdef OR p.oid NOT IN (
                 coalesce(to_regprocedure('public.cita_correos_pendientes(integer)')::oid, 0::oid),
                 coalesce(to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)')::oid, 0::oid),
                 coalesce(to_regprocedure('public.cita_correo_marcar(uuid, uuid, uuid, text, text)')::oid, 0::oid)))) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: una función cita_correo* existe como SECURITY DEFINER o con otra firma.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · La tabla, su RLS y sus permisos.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cita_correos (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  clinica_id     uuid        NOT NULL,
  appointment_id uuid        NOT NULL,
  tipo           text        NOT NULL,
  inicio_cita    timestamptz NOT NULL,
  estado         text        NOT NULL,
  intentos       smallint    NOT NULL DEFAULT 1,
  testigo        uuid,
  tomado_en      timestamptz,
  enviado_en     timestamptz,
  motivo         text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cita_correos_pkey PRIMARY KEY (id),
  CONSTRAINT cita_correos_llave_key UNIQUE (appointment_id, tipo, inicio_cita),
  CONSTRAINT cita_correos_clinica_fkey FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  CONSTRAINT cita_correos_cita_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE RESTRICT,
  -- IS NOT NULL explícito en cada CHECK: un CHECK que evalúa a NULL pasa.
  CONSTRAINT cita_correos_tipo_check CHECK (tipo IS NOT NULL AND tipo IN ('comprobante', 'recordatorio')),
  CONSTRAINT cita_correos_estado_check CHECK (estado IS NOT NULL AND estado IN ('enviando', 'enviado', 'fallido', 'omitido')),
  CONSTRAINT cita_correos_intentos_check CHECK (intentos IS NOT NULL AND intentos BETWEEN 1 AND 3),
  CONSTRAINT cita_correos_motivo_check CHECK (motivo IS NULL OR motivo IN ('transporte', 'duplicado', 'sin_enlace', 'sin_destinatario', 'plantilla')),
  CONSTRAINT cita_correos_coherencia_check CHECK (
       (estado = 'enviando' AND testigo IS NOT NULL AND tomado_en IS NOT NULL AND motivo IS NULL AND enviado_en IS NULL)
    OR (estado = 'enviado' AND enviado_en IS NOT NULL AND motivo IS NULL)
    OR (estado IN ('fallido', 'omitido') AND motivo IS NOT NULL AND enviado_en IS NULL))
);

-- Para la FK RESTRICT a clinicas (la de appointments la cubre la llave única).
CREATE INDEX IF NOT EXISTS cita_correos_clinica ON public.cita_correos (clinica_id);

ALTER TABLE public.cita_correos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cita_correos FROM PUBLIC, anon, authenticated, service_role;
-- Sin testigo, tomado_en, intentos ni motivo: el personal ve QUÉ salió y cuándo.
GRANT SELECT (id, clinica_id, appointment_id, tipo, inicio_cita, estado, enviado_en)
  ON TABLE public.cita_correos TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.cita_correos TO service_role;

-- Sin recursión: lee appointments, no cita_correos; el EXISTS corre bajo la
-- RLS de appointments de quien pregunta (el invitado, sólo las suyas).
-- Sin policy de escritura: authenticated no tiene INSERT ni UPDATE.
DROP POLICY IF EXISTS cita_correos_select ON public.cita_correos;
CREATE POLICY cita_correos_select ON public.cita_correos FOR SELECT TO authenticated
  USING (clinica_id = public.get_clinica_id()
         AND EXISTS (SELECT 1 FROM public.appointments a
                      WHERE a.id = cita_correos.appointment_id AND a.clinica_id = public.get_clinica_id()));

CREATE OR REPLACE TRIGGER audit_cita_correos
  AFTER INSERT OR UPDATE OR DELETE ON public.cita_correos
  FOR EACH ROW EXECUTE FUNCTION public.log_tabla_change();

-- ---------------------------------------------------------------------
-- 3 · Funciones.
-- ---------------------------------------------------------------------
-- 3.1 · Listado ENTRE CLÍNICAS de recordatorios por mandar: SÓLO ids. Parte de
--       agenda_ajustes (pocas clínicas encendidas, y con la puerta S3) y entra
--       por idx_appointments_clinica_inicio. El tope va dentro de cada clínica
--       y en total.
CREATE OR REPLACE FUNCTION public.cita_correos_pendientes(p_limite integer)
RETURNS TABLE (r_clinica_id uuid, r_cita_id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
  SELECT x.clinica_id, x.id
    FROM public.agenda_ajustes j
   CROSS JOIN LATERAL (
     SELECT a.clinica_id, a.id, a.start_time
       FROM public.appointments a
       LEFT JOIN public.pacientes p ON p.id = a.paciente_id AND p.clinica_id = a.clinica_id
      WHERE a.clinica_id = j.clinica_id
        AND a.start_time >  now() + interval '1 hour'
        AND a.start_time <= now() + make_interval(hours => j.recordatorio_horas)
        AND a.status IN ('scheduled', 'confirmed') AND NOT a.all_day
        -- ⚠️ Destinatario: la MISMA expresión que cita_correo_tomar.
        AND (CASE WHEN a.paciente_id IS NOT NULL
                  THEN CASE WHEN p.activo IS NOT FALSE THEN coalesce(nullif(btrim(p.email), ''), nullif(btrim(a.reserva_correo), '')) END
                  ELSE CASE WHEN a.reserva_canal IS NOT NULL THEN nullif(btrim(a.reserva_correo), '') END END) IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.cita_correos k
                         WHERE k.appointment_id = a.id AND k.clinica_id = a.clinica_id AND k.inicio_cita = a.start_time
                           AND ((k.tipo = 'comprobante'
                                 AND (k.estado = 'enviado'
                                   OR (k.estado = 'enviando' AND k.tomado_en > now() - interval '10 minutes')))
                             OR (k.tipo = 'recordatorio'
                                 AND (k.estado IN ('enviado', 'omitido')
                                   OR (k.estado = 'fallido' AND (k.intentos >= 3 OR k.motivo = 'duplicado'))
                                   OR (k.estado = 'enviando' AND (k.tomado_en > now() - interval '10 minutes' OR k.intentos >= 3))))))
      ORDER BY a.start_time
      LIMIT least(greatest(coalesce(p_limite, 0), 0), 500)
   ) x
   WHERE j.agenda_v2_encendida
     AND public.gcal_sync_clinica_habilitada(j.clinica_id)
   ORDER BY x.start_time
   LIMIT least(greatest(coalesce(p_limite, 0), 0), 500);
$fn$;

-- 3.2 · Tomar UN envío y devolver lo justo para componerlo. Sin fila = no toca
--       (apagada, sin acceso, fuera de ventana, sin destinatario, ya salió el
--       comprobante, ya tomado por otra ejecución, intentos agotados, otra
--       clínica). r_estado: 'scheduled' | 'confirmed' (la versión confirmada
--       del correo no ofrece «Confirmar», lista A 2).
CREATE OR REPLACE FUNCTION public.cita_correo_tomar(p_clinica_id uuid, p_cita_id uuid, p_tipo text, p_testigo uuid)
RETURNS TABLE (r_envio_id uuid, r_para text, r_inicio timestamptz, r_fin timestamptz, r_zona text,
               r_estado text, r_medico jsonb, r_consultorio jsonb)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_a     record;
  v_horas integer;
  v_id    uuid;
BEGIN
  IF p_clinica_id IS NULL OR p_cita_id IS NULL OR p_testigo IS NULL
     OR p_tipo IS NULL OR p_tipo NOT IN ('comprobante', 'recordatorio') THEN
    RAISE EXCEPTION 'cita_correo_tomar: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  SELECT j.recordatorio_horas INTO v_horas FROM public.agenda_ajustes j
   WHERE j.clinica_id = p_clinica_id AND j.agenda_v2_encendida;
  IF NOT FOUND OR NOT public.gcal_sync_clinica_habilitada(p_clinica_id) THEN
    RETURN;
  END IF;
  -- Serializa las tomas de ESTA cita (dos tipos o dos ejecuciones a la vez).
  PERFORM pg_advisory_xact_lock(1792, hashtext(p_cita_id::text));
  SELECT a.id, a.start_time, a.end_time, a.status, a.medico_id, a.consultorio_timezone,
         a.consultorio_nombre, a.consultorio_direccion, a.consultorio_telefono,
         -- ⚠️ Destinatario: la MISMA expresión que cita_correos_pendientes.
         CASE WHEN a.paciente_id IS NOT NULL
              THEN CASE WHEN p.activo IS NOT FALSE THEN coalesce(nullif(btrim(p.email), ''), nullif(btrim(a.reserva_correo), '')) END
              ELSE CASE WHEN a.reserva_canal IS NOT NULL THEN nullif(btrim(a.reserva_correo), '') END END AS para
    INTO v_a
    FROM public.appointments a
    LEFT JOIN public.pacientes p ON p.id = a.paciente_id AND p.clinica_id = p_clinica_id
   WHERE a.id = p_cita_id AND a.clinica_id = p_clinica_id
     AND a.status IN ('scheduled', 'confirmed') AND NOT a.all_day
     AND a.start_time > now() + CASE WHEN p_tipo = 'recordatorio' THEN interval '1 hour' ELSE interval '0' END
     AND (p_tipo = 'comprobante' OR a.start_time <= now() + make_interval(hours => v_horas));
  IF NOT FOUND OR v_a.para IS NULL THEN
    RETURN;
  END IF;
  IF p_tipo = 'recordatorio' AND EXISTS (
       SELECT 1 FROM public.cita_correos k
        WHERE k.appointment_id = p_cita_id AND k.clinica_id = p_clinica_id AND k.tipo = 'comprobante'
          AND k.inicio_cita = v_a.start_time
          AND (k.estado = 'enviado'
            OR (k.estado = 'enviando' AND k.tomado_en > now() - interval '10 minutes'))) THEN
    RETURN;
  END IF;
  INSERT INTO public.cita_correos AS k (clinica_id, appointment_id, tipo, inicio_cita, estado, intentos, testigo, tomado_en)
  VALUES (p_clinica_id, p_cita_id, p_tipo, v_a.start_time, 'enviando', 1, p_testigo, now())
  ON CONFLICT (appointment_id, tipo, inicio_cita) DO UPDATE
     SET estado = 'enviando', intentos = k.intentos + 1, testigo = p_testigo, tomado_en = now(),
         motivo = NULL, updated_at = now()
   WHERE k.clinica_id = p_clinica_id
     AND k.intentos < 3
     AND ((k.estado = 'fallido' AND k.motivo IS DISTINCT FROM 'duplicado')
       OR (k.estado = 'enviando' AND k.tomado_en <= now() - interval '10 minutes'))
  RETURNING k.id INTO v_id;
  IF v_id IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT v_id, v_a.para, v_a.start_time, v_a.end_time, v_a.consultorio_timezone, v_a.status,
    (SELECT jsonb_build_object('titulo', pr.titulo, 'nombres', pr.nombres, 'apellido_paterno', pr.apellido_paterno,
                               'apellido_materno', pr.apellido_materno)
       FROM public.profiles pr WHERE pr.id = v_a.medico_id AND pr.clinica_id = p_clinica_id),
    jsonb_build_object('nombre', v_a.consultorio_nombre, 'direccion', v_a.consultorio_direccion,
                       'telefono', v_a.consultorio_telefono);
END
$fn$;

-- 3.3 · Cerrar UN envío. Sólo quien lo tomó (testigo) y sólo si sigue
--       «enviando». false = no era suyo, ya lo cerró otro o se soltó.
CREATE OR REPLACE FUNCTION public.cita_correo_marcar(
  p_clinica_id uuid, p_envio_id uuid, p_testigo uuid, p_estado text, p_motivo text)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_n integer;
BEGIN
  IF p_clinica_id IS NULL OR p_envio_id IS NULL OR p_testigo IS NULL
     OR p_estado IS NULL OR p_estado NOT IN ('enviado', 'fallido', 'omitido')
     OR (p_estado = 'enviado' AND p_motivo IS NOT NULL) OR (p_estado <> 'enviado' AND p_motivo IS NULL)
     OR (p_motivo IS NOT NULL AND p_motivo NOT IN ('transporte', 'duplicado', 'sin_enlace', 'sin_destinatario', 'plantilla')) THEN
    RAISE EXCEPTION 'cita_correo_marcar: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  UPDATE public.cita_correos
     SET estado = p_estado, motivo = p_motivo, updated_at = now(),
         enviado_en = CASE WHEN p_estado = 'enviado' THEN now() END
   WHERE id = p_envio_id AND clinica_id = p_clinica_id AND testigo = p_testigo AND estado = 'enviando';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n = 1;
END
$fn$;

-- Permisos de funciones: SOLO service_role, justificado: son el camino de la
-- tarea programada y del after() de la reserva, sin sesión; ni la consola ni
-- una sesión de la app deben listar entre clínicas ni tomar envíos.
REVOKE EXECUTE ON FUNCTION public.cita_correos_pendientes(integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cita_correos_pendientes(integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.cita_correo_tomar(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cita_correo_tomar(uuid, uuid, text, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.cita_correo_marcar(uuid, uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cita_correo_marcar(uuid, uuid, uuid, text, text) TO service_role;

COMMENT ON TABLE public.cita_correos IS
  'Envíos de correo de cita (agenda E4): recordatorio y comprobante. Llave (cita, tipo, inicio_cita): mover la cita da un recordatorio nuevo. SIN destinatario ni contenido. Sólo escriben cita_correo_tomar y cita_correo_marcar. CONVENIO (dimensión 16): la expresión del destinatario está en cita_correos_pendientes y en cita_correo_tomar (van juntas); el correo se compone determinista de la fila porque Resend exige el mismo cuerpo con la misma Idempotency-Key (<tipo>/<id>). fallido/duplicado no se reintenta; máximo 3 intentos. Un comprobante enviado, o enviando hace menos de 10 min, impide el recordatorio del mismo inicio.';
COMMENT ON COLUMN public.cita_correos.inicio_cita IS
  'start_time de la cita cuando se tomó el envío. Si la cita se mueve, la hora nueva es otra llave y tiene su propio recordatorio.';
COMMENT ON COLUMN public.cita_correos.testigo IS
  'uuid de la ejecución que tomó el envío (estado enviando). Sólo ella lo cierra; a los 10 min otra puede volver a tomarlo.';

COMMIT;

-- ---------------------------------------------------------------------
-- 4 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO' WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'cita_correos: RLS / policies' AS comprobacion,
         coalesce((SELECT relrowsecurity::text FROM pg_class WHERE oid = to_regclass('public.cita_correos')), 'AUSENTE')
         || ' / ' || coalesce((SELECT string_agg(cmd, ',' ORDER BY cmd) FROM pg_policies
                                WHERE schemaname = 'public' AND tablename = 'cita_correos'), '-') AS valor,
         'true / SELECT' AS esperado
  UNION ALL
  SELECT 2, 'privilegios de TABLA anon / authenticated / service_role',
         coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
                    WHERE table_schema = 'public' AND table_name = 'cita_correos' AND grantee = 'anon'), '-') || ' / '
         || coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
                    WHERE table_schema = 'public' AND table_name = 'cita_correos' AND grantee = 'authenticated'), '-') || ' / '
         || coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
                    WHERE table_schema = 'public' AND table_name = 'cita_correos' AND grantee = 'service_role'), '-'),
         '- / - / INSERT,SELECT,UPDATE'
  UNION ALL
  SELECT 3, 'columnas que authenticated puede leer',
         coalesce((SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.column_privileges
                    WHERE table_schema = 'public' AND table_name = 'cita_correos'
                      AND grantee = 'authenticated' AND privilege_type = 'SELECT'), '-'),
         'appointment_id,clinica_id,enviado_en,estado,id,inicio_cita,tipo'
  UNION ALL
  SELECT 4, 'FKs (sin CASCADE) / huella de constraints e índices',
         coalesce((SELECT string_agg(conname || '=' || confdeltype::text, ',' ORDER BY conname) FROM pg_constraint
                    WHERE conrelid = to_regclass('public.cita_correos') AND contype = 'f'), '-')
         || ' / ' || coalesce((SELECT md5(string_agg(x.d, ';' ORDER BY x.d)) FROM (
              SELECT k.conname || ':' || replace(pg_get_constraintdef(k.oid), 'public.', '') AS d
                FROM pg_constraint k WHERE k.conrelid = to_regclass('public.cita_correos')
              UNION ALL
              SELECT i.indexname || ':' || replace(i.indexdef, 'public.', '')
                FROM pg_indexes i WHERE i.schemaname = 'public' AND i.tablename = 'cita_correos') x), '-'),
         'cita_correos_cita_fkey=r,cita_correos_clinica_fkey=r / 93981fdfca374c88486803d4cea04db2'
  UNION ALL
  SELECT 5, 'funciones: definer / EXECUTE anon,authenticated,service_role / PUBLIC',
         coalesce((SELECT string_agg(p.proname || '=' || p.prosecdef::text || '/' || has_function_privilege('anon', p.oid, 'EXECUTE')::text
                    || ',' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || ','
                    || has_function_privilege('service_role', p.oid, 'EXECUTE')::text || '/'
                    || (EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                 WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'))::text, ' ; ' ORDER BY p.proname)
                     FROM pg_proc p WHERE p.oid IN (
                       to_regprocedure('public.cita_correos_pendientes(integer)'),
                       to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)'),
                       to_regprocedure('public.cita_correo_marcar(uuid, uuid, uuid, text, text)'))), '-'),
         'cita_correo_marcar=false/false,false,true/false ; cita_correo_tomar=false/false,false,true/false ; cita_correos_pendientes=false/false,false,true/false'
  UNION ALL
  SELECT 6, 'disparador de auditoría / índice de appointments que usa el listado',
         (SELECT count(*)::text FROM pg_trigger WHERE tgrelid = to_regclass('public.cita_correos')
             AND tgname = 'audit_cita_correos' AND tgenabled = 'O') || ' / '
         || (to_regclass('public.idx_appointments_clinica_inicio') IS NOT NULL)::text,
         '1 / true'
  UNION ALL
  SELECT 7, 'ninguna SECURITY DEFINER escribe agenda_ajustes',
         (SELECT count(*)::text FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
           AND p.prosrc ~* '(insert\s+into|update)\s+public\.agenda_ajustes'), '0'
  UNION ALL
  SELECT 8, 'las 5 policies de appointments, intactas',
         (SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'appointments'),
         'appointments_delete,appointments_gates_insert,appointments_insert,appointments_select,appointments_update'
  UNION ALL
  SELECT 9, 'censo: envíos por estado',
         coalesce((SELECT string_agg(estado || '=' || n, ',' ORDER BY estado)
                     FROM (SELECT estado, count(*)::text n FROM public.cita_correos GROUP BY estado) s), '-'), NULL
) t
ORDER BY t.n;
