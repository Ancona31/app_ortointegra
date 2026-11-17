-- ═══════════════════════════════════════════════════════════════════════
-- Agenda · tanda I, punto 10 de Angel — un evento NUEVO de Google entra como
-- cita «Por asignar», y «¿No es una cita?» lo deja como evento para siempre
-- Rama: feature/agenda-v2-i3 · Escrita: 2026-11-17
-- Riesgo estimado: BAJO (una columna NULL sin DEFAULT, un CHECK que sólo mira
-- esa columna y un disparador BEFORE INSERT OR UPDATE OF esa columna sobre
-- appointments; ninguna policy, ningún permiso de tabla, ninguna fila
-- existente cambia).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA 2026-11-17 (ensayo en seco con ROLLBACK y dos pasadas,
--   rejilla 8×OK en cada una; reaplicada dos veces más tras dos ajustes del
--   disparador, 8×OK). Prueba: supabase/pruebas-sql/i3_por_asignar_google.sql.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de C2 y de D1; sólo
--   tiene efecto con la v2 encendida, porque sólo el sondeo de la v2 importa).
-- AUDITORÍA INDEPENDIENTE: 2026-11-17, sonnet, APTA CON OBSERVACIONES (sin
--   bloqueantes). Atendidas: el comentario de bloqueos (1) y OLD.paciente_id
--   en la excepción del UPDATE (2). Las demás son notas.
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Punto 10 de Angel (2026-11-17): «Un evento creado directamente en el
-- calendario de Google entra SIEMPRE a Spinus como "Por asignar", igual que
-- una reserva por enlace […] Como no todo lo anotado en Google es una cita,
-- lleva un botón "¿No es una cita?". Al pulsarlo […] se convierte en evento
-- sin paciente […] no vuelve a preguntar, aunque el evento se edite después
-- en Google.»
-- Hoy (C2, `gcal_importar_evento`) un evento nuevo de Google entra como fila
-- `origen = 'google'` sin paciente: un EVENTO. Hace falta distinguir, entre
-- esas filas, las que esperan que alguien diga si son cita («por asignar») de
-- las que ya se dijo que no lo son («evento»), y que la segunda respuesta no
-- la deshaga el sondeo.
--
-- ═══ EL MODELO, Y POR QUÉ NO SE REUTILIZA reserva_canal ═══════════════
-- appointments.google_asignacion text NULL:
--   NULL          — lo de siempre (toda fila que no es un evento nuevo de
--                   Google importado tras esta migración);
--   'por_asignar' — evento nuevo de Google que se trata como cita por ligar
--                   (marca, «Próximas citas», ligar al iniciar la consulta);
--   'evento'      — alguien pulsó «¿No es una cita?»: evento sin paciente.
-- NO se reutiliza `reserva_canal` con un valor 'google':
--   · `appointments_reserva_check` exige con él enlace, aviso, hmacs y
--     consentimiento (una reserva por enlace); habría que reescribir ese CHECK
--     sobre la tabla más grande;
--   · el candado (D2: incidencias, «una activa», bloqueados), el disparador
--     de incidencias (`reserva_canal IS NOT NULL`), el espejo de Google de D4
--     (`gcal_citas_por_evento`: una por ligar NO acepta el título de Google,
--     C-d) y el candado nuevo de I2 cuentan a quien reserva por enlace; un
--     evento de Google no es una persona que reservó;
--   · el nombre no puede empezar por `reserva_`: `cita_proteger_reserva`
--     (seg2) cierra por el PREFIJO toda columna `reserva_*` a la sesión, y
--     «¿No es una cita?» la escribe la sesión.
--
-- ═══ QUÉ CREA ══════════════════════════════════════════════════════════
-- Columna appointments.google_asignacion (text NULL, sin DEFAULT: ADD COLUMN
--   sin reescribir la tabla) y CHECK appointments_google_asignacion_check:
--   NULL, o origen = 'google' y uno de los dos valores. NOT VALID + VALIDATE
--   aparte (toda fila existente es NULL: pasa).
-- cita_asignacion_google() — función de disparador, INVOKER,
--   search_path = ''. Sólo lee NEW/OLD, now() y el GUC spinus.via. NUNCA
--   consulta tablas.
--   · INSERT: el valor lo pone LA BASE, no quien inserta: 'por_asignar' si la
--     fila la importa el sondeo (service_role con spinus.via = 'google', que
--     pone `gcal_importar_evento` justo antes de su INSERT; las dos cosas: el
--     GUC es de la transacción y no basta solo), es origen = 'google',
--     sin paciente ni reserva, con hora (no de todo el día) y aún no
--     terminada; NULL en cualquier otro caso. Así la sesión no puede crear una
--     fila «por asignar» ni «evento» a mano.
--   · UPDATE de la columna: el ÚNICO paso permitido es 'por_asignar' →
--     'evento' de una fila sin paciente («¿No es una cita?»). Todo lo demás
--     (volver a 'por_asignar', ponerlo a una fila que no lo tenía, quitarlo)
--     → 42501. Volver atrás es «Convertir en cita» (T3), que liga un paciente
--     y no toca esta columna.
--   · postgres y supabase_admin quedan fuera (editor SQL, ayudantes de las
--     e2e: el patrón de B1, D1, seg2 y H5). service_role NO: el sondeo no
--     escribe esta columna en un UPDATE (gcal_aplicar_evento no la nombra), y
--     así ninguna sincronización posterior puede devolver un 'evento' a
--     'por_asignar'.
-- trg_appointments_asignacion_google — BEFORE INSERT OR UPDATE OF
--   google_asignacion, FOR EACH ROW. Por nombre corre ANTES que
--   trg_appointments_proteger_* (orden alfabético de los BEFORE); ninguno de
--   ellos mira esta columna.
--
-- ═══ DECISIONES (sin regla previa; la opción que menos cambia) ════════
-- · Un evento de TODO EL DÍA entra como evento (NULL): una cita no puede ser
--   de todo el día (la API da 400 `todo_el_dia_con_paciente`).
-- · Un evento ya TERMINADO al importarse (la primera completa trae 30 días
--   atrás, C-b) entra como evento: no hay consulta que iniciar y llenaría
--   «Próximas citas» y la campana con el pasado.
-- · Las filas de Google importadas ANTES de esta migración se quedan NULL
--   (eventos, como hoy): no se rellena nada.
-- · Un evento RECURRENTE no se importa como fila (C-a): nada cambia.
--
-- ═══ CHOQUES CON LO QUE YA EXISTE (comprobados) ═══════════════════════
-- S1: la columna no viaja a Google; las notas de una fila 'por_asignar' son
--   las de un evento nacido en Google (viajan en los dos sentidos mientras no
--   tenga paciente; al ligarla dejan de enviarse), como hoy.
-- C-d: una fila 'por_asignar' NO tiene reserva_canal, así que el espejo de D4
--   la trata como evento sin paciente: su título sigue viniendo de Google
--   (es el «nombre» con el que sale en «Próximas citas»). Al ligarla, tiene
--   paciente y el título deja de aceptarse desde Google.
-- C-e: nace 'scheduled' y acepta cambios de Google como hoy.
-- log_cita_change (B0): la columna NO está en c_tecnicas, así que el paso a
--   'evento' deja su `cita_editada` con el nombre del campo (y la ruta añade
--   `cita_no_es_cita`). No hace falta tocar log_cita_change ni su WHEN.
-- trg_appointments_proteger_reserva (seg2): mira sólo `reserva_*`.
-- cita_proteger_borrado (seg2): no mira esta columna; borrar sigue igual.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere C2 (appointments.origen, gcal_importar_evento) y D1
--   (appointments.reserva_canal). PG ≥ 14 (CREATE OR REPLACE TRIGGER).
-- Bloqueos (lock_timeout 5 s): ADD COLUMN y ADD CONSTRAINT NOT VALID toman
--   ACCESS EXCLUSIVE sin reescritura, y como todo va en UN BEGIN…COMMIT ese
--   candado se retiene hasta el COMMIT, VALIDATE incluido: appointments queda
--   bloqueada (lecturas y escrituras) lo que tarde el script entero. Con el
--   tamaño de hoy son milisegundos (todas las filas tienen la columna en NULL);
--   es el mismo patrón que H5. Si la tabla creciera mucho, el VALIDATE iría en
--   una transacción aparte tras el COMMIT (auditoría independiente, hallazgo 1).
-- Orden respecto al código: la migración ANTES del despliegue. El código
--   tolera la columna ausente (sólo la nombra con la v2 encendida y trata
--   42703/PGRST204 como «no disponible»).
-- Alcance de los roles:
--   pierde — authenticated: escribir en google_asignacion otra cosa que
--            'por_asignar' → 'evento'. Nadie la escribía.
--   gana   — authenticated: ese paso, bajo la RLS de UPDATE de siempre.
-- Contrato con spinus-consola: columna NUEVA; ninguna existente cambia de
--   nombre, tipo ni significado.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   DROP TRIGGER IF EXISTS trg_appointments_asignacion_google ON public.appointments;
--   DROP FUNCTION IF EXISTS public.cita_asignacion_google();
--   ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_google_asignacion_check;
--   -- Respaldo antes de borrar la columna (las respuestas de «¿No es una cita?»):
--   -- CREATE TABLE respaldos.citas_google_asignacion_AAAAMMDD AS
--   --   SELECT id, google_asignacion FROM public.appointments WHERE google_asignacion IS NOT NULL;
--   ALTER TABLE public.appointments DROP COLUMN IF EXISTS google_asignacion;
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de crear nada.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = 'public.appointments'::regclass), 'USAGE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el rol % no es dueño de public.appointments.', current_user;
  END IF;
  -- El cuerpo no se valida al crearse: las columnas que nombra, aquí.
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass AND NOT attisdropped
        AND (attname, atttypid) IN (('origen', 'text'::regtype), ('paciente_id', 'uuid'::regtype),
                                    ('reserva_canal', 'text'::regtype), ('all_day', 'bool'::regtype),
                                    ('end_time', 'timestamptz'::regtype))) <> 5 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: appointments sin origen, paciente_id, reserva_canal, all_day o end_time con su tipo (¿falta C2 o D1?).';
  END IF;
  -- La regla del INSERT depende de que el sondeo marque su escritura con spinus.via = 'google' (C2).
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure(
       'public.gcal_importar_evento(uuid, text, text, text, timestamptz, text, timestamptz, timestamptz, boolean, text, text, uuid)')
       AND prosrc ~ 'set_config\(''spinus\.via'', ''google'', true\)' AND prosrc ~ 'INSERT INTO public\.appointments') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: gcal_importar_evento no existe o ya no pone spinus.via = ''google'' antes de su INSERT.';
  END IF;
  -- Re-ejecución: la columna, si existe, con su tipo; la constraint, con su fórmula; la función, invoker.
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass AND attname = 'google_asignacion'
              AND NOT attisdropped AND atttypid <> 'text'::regtype) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: appointments.google_asignacion existe con otro tipo.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.appointments'::regclass
              AND conname = 'appointments_google_asignacion_check'
              AND pg_get_constraintdef(oid) <> 'CHECK (((google_asignacion IS NULL) OR ((origen = ''google''::text) AND (google_asignacion = ANY (ARRAY[''por_asignar''::text, ''evento''::text])))))') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: appointments_google_asignacion_check existe con otra fórmula.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('public.cita_asignacion_google()') AND prosecdef) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: cita_asignacion_google() existe como SECURITY DEFINER; tiene que ser invoker.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · La columna y su CHECK.
-- ---------------------------------------------------------------------
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS google_asignacion text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.appointments'::regclass
                  AND conname = 'appointments_google_asignacion_check') THEN
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_google_asignacion_check
      CHECK (google_asignacion IS NULL OR (origen = 'google' AND google_asignacion IN ('por_asignar', 'evento'))) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.appointments VALIDATE CONSTRAINT appointments_google_asignacion_check;

COMMENT ON COLUMN public.appointments.google_asignacion IS
  'Agenda (tanda I, punto 10): qué es un evento NUEVO de Google. NULL = lo de siempre; por_asignar = importado por el sondeo con la v2, se trata como cita por ligar (marca «Por asignar», «Próximas citas», se liga al iniciar la consulta); evento = alguien pulsó «¿No es una cita?» (evento sin paciente; el sondeo no lo devuelve). Lo pone la BASE al importar (cita_asignacion_google); el único cambio permitido es por_asignar → evento. No viaja a Google (S1). Sin reserva_canal: el título sigue viniendo de Google hasta ligarla (C-d).';

-- ---------------------------------------------------------------------
-- 3 · El disparador.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cita_asignacion_google()
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
    NEW.google_asignacion := CASE
      WHEN current_user = 'service_role' AND current_setting('spinus.via', true) = 'google' AND NEW.origen = 'google'
           AND NEW.paciente_id IS NULL AND NEW.reserva_canal IS NULL
           AND NEW.all_day IS NOT TRUE AND NEW.end_time > now()
      THEN 'por_asignar' END;
    RETURN NEW;
  END IF;
  IF NEW.google_asignacion IS DISTINCT FROM OLD.google_asignacion
     -- IS NOT DISTINCT FROM y no `=`: con OLD NULL, `=` daría NULL y el NOT dejaría pasar el cambio.
     AND NOT (OLD.google_asignacion IS NOT DISTINCT FROM 'por_asignar' AND NEW.google_asignacion IS NOT DISTINCT FROM 'evento'
              AND OLD.paciente_id IS NULL AND NEW.paciente_id IS NULL) THEN
    RAISE EXCEPTION 'google_asignacion sólo pasa de por_asignar a evento'
      USING ERRCODE = '42501', HINT = '«¿No es una cita?» es definitivo; para volver, «Convertir en cita»';
  END IF;
  RETURN NEW;
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.cita_asignacion_google() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cita_asignacion_google() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.cita_asignacion_google() IS
  'Agenda (tanda I, punto 10): pone appointments.google_asignacion al INSERTAR (por_asignar sólo si la importa el sondeo de Google —service_role con spinus.via = google—, origen google, sin paciente ni reserva, con hora y sin terminar; si no, NULL) y en un UPDATE sólo deja pasar por_asignar → evento de una fila sin paciente (42501 lo demás). Sólo lee NEW/OLD, now() y el GUC; nunca tablas. postgres y supabase_admin quedan fuera.';

CREATE OR REPLACE TRIGGER trg_appointments_asignacion_google
  BEFORE INSERT OR UPDATE OF google_asignacion ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.cita_asignacion_google();

COMMIT;

-- ---------------------------------------------------------------------
-- 4 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'columna google_asignacion text, sin DEFAULT, admite NULL' AS comprobacion,
         coalesce((SELECT format_type(a.atttypid, a.atttypmod) || ' / ' || a.atthasdef::text || ' / ' || (NOT a.attnotnull)::text
                    FROM pg_attribute a WHERE a.attrelid = 'public.appointments'::regclass AND a.attname = 'google_asignacion'
                     AND NOT a.attisdropped), 'AUSENTE') AS valor,
         'text / false / true' AS esperado
  UNION ALL
  SELECT 2, 'CHECK validado con su fórmula',
         coalesce((SELECT convalidated::text || ' / ' || pg_get_constraintdef(oid) FROM pg_constraint
                    WHERE conrelid = 'public.appointments'::regclass AND conname = 'appointments_google_asignacion_check'), 'AUSENTE'),
         'true / CHECK (((google_asignacion IS NULL) OR ((origen = ''google''::text) AND (google_asignacion = ANY (ARRAY[''por_asignar''::text, ''evento''::text])))))'
  UNION ALL
  SELECT 3, 'disparador BEFORE INSERT OR UPDATE OF google_asignacion',
         coalesce((SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid = 'public.appointments'::regclass
                    AND tgname = 'trg_appointments_asignacion_google' AND tgenabled = 'O'), 'AUSENTE'),
         'CREATE TRIGGER trg_appointments_asignacion_google BEFORE INSERT OR UPDATE OF google_asignacion ON public.appointments FOR EACH ROW EXECUTE FUNCTION cita_asignacion_google()'
  UNION ALL
  SELECT 4, 'función: INVOKER, search_path vacío, no nombra tablas',
         coalesce((SELECT (NOT prosecdef)::text || ' / ' || (proconfig @> ARRAY['search_path=""'])::text || ' / '
                          || (prosrc !~* '(from|join|update|into)\s+public\.')::text
                    FROM pg_proc WHERE oid = to_regprocedure('public.cita_asignacion_google()')), 'AUSENTE'),
         'true / true / true'
  UNION ALL
  SELECT 5, 'EXECUTE anon,authenticated,service_role / PUBLIC',
         coalesce((SELECT has_function_privilege('anon', p.oid, 'EXECUTE')::text || ',' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                    || ',' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text || ' / '
                    || EXISTS (SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee = 0 AND x.privilege_type = 'EXECUTE')::text
                    FROM pg_proc p WHERE p.oid = to_regprocedure('public.cita_asignacion_google()')), 'AUSENTE'),
         'true,true,true / false'
  UNION ALL
  SELECT 6, 'gcal_importar_evento sigue marcando spinus.via = google antes de su INSERT',
         coalesce((SELECT (prosrc ~ 'set_config\(''spinus\.via'', ''google'', true\)')::text FROM pg_proc WHERE oid = to_regprocedure(
           'public.gcal_importar_evento(uuid, text, text, text, timestamptz, text, timestamptz, timestamptz, boolean, text, text, uuid)')), 'AUSENTE'),
         'true'
  UNION ALL
  SELECT 7, 'las 5 policies de appointments, intactas (nombres)',
         (SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'appointments'),
         'appointments_delete,appointments_gates_insert,appointments_insert,appointments_select,appointments_update'
  UNION ALL
  SELECT 8, 'los disparadores de seg2 y H5 siguen',
         (SELECT count(*)::text FROM pg_trigger WHERE tgrelid = 'public.appointments'::regclass AND tgenabled = 'O'
            AND tgname IN ('trg_appointments_proteger_borrado', 'trg_appointments_proteger_reserva', 'trg_appointments_proteger_atendida')),
         '3'
) t
ORDER BY t.n;
