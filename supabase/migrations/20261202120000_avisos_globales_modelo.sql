-- ═══════════════════════════════════════════════════════════════════════
-- Avisos globales · M1 — modelo de avisos para toda la app y escritores nuevos
-- Rama: feature/avisos-globales · Escrita: 2026-11-24
-- Plan: docs/spec/avisos-globales/PLAN.md (§1 y §2)
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: 2026-11-24, stack local de Supabase (CLI 2.117.0) con las 14
--   migraciones anteriores: aplicada, deshecha con su reversa y vuelta a
--   aplicar; prueba av1_avisos_globales.sql en verde; medición antes/después en
--   supabase/pruebas-sql/medicion/ (resultados en el PLAN, §8).
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR. PENDIENTE DE ENSAYO SOBRE EL CLON
--   DE ESTRUCTURA Y DE AUDITORÍA INDEPENDIENTE (supabase/AUDITORIA-MIGRACIONES.md).
--   La aplica Angel, con supabase/produccion/plan/aplicar.sh, tras su orden.
--
-- QUÉ HACE (todo aditivo; no borra ni reescribe ninguna fila)
--   1. avisos_clinica gana cuatro columnas NULL y sin DEFAULT:
--        destinatario_id  NULL = toda la clínica (lo de hoy); con valor, sólo
--                         ese usuario ve el aviso.
--        actor_id         quién lo hizo (atribución, sin FK, como revisado_por);
--                         quien lo hizo NUNCA ve su propio aviso (policy).
--        medico_id        el dueño de la agenda en los avisos SIN cita.
--        datos            jsonb con contadores y horas. NUNCA datos de personas.
--   2. cita_id admite NULL (avisos sin cita) y un CHECK liga tipo ↔ cita.
--   3. avisos_clinica_tipo_check pasa de 7 a 19 tipos.
--   4. Un índice único para agrupar los avisos sin cita que se repiten.
--   5. Las dos policies se recrean. Con las columnas nuevas en NULL son
--      EXACTAMENTE las de F4: el código de antes ve lo mismo.
--   6. Cinco funciones de disparador (DEFINER de postgres, search_path vacío) y
--      siete disparadores, en appointments, agenda_bloqueos, cita_correos,
--      clinica_conexiones_google y gcal_sync_estado.
--   7. La RPC aviso_clinica_registrar (sólo service_role) para lo que el
--      servidor escribe sin sesión de base: la reserva frenada y el «Reagendar»
--      del personal.
--   8. avisos_clinica entra en la publicación supabase_realtime.
--   NO toca: los seis escritores de F4, reservar_por_enlace, cita_rsvp_google,
--   log_cita_change, ninguna policy de otra tabla, ni el índice
--   avisos_clinica_pendiente_key.
--
-- ⚠️ UN AVISO NUNCA IMPIDE UNA ESCRITURA. Cada alta de aviso de los
--   disparadores nuevos va en su subbloque BEGIN … EXCEPTION WHEN OTHERS, que
--   deja un RAISE WARNING (tipo y SQLSTATE, sin datos de nadie) y sigue. Un
--   defecto aquí no puede dejar a nadie sin agendar (caso 9 de la prueba).
-- ⚠️ SIN RECURSIÓN DE RLS (dimensión 19): las policies leen appointments y
--   helpers DEFINER sobre profiles; ninguna lee avisos_clinica.
-- ⚠️ «Quién lo hizo» es auth.uid() (la sesión) o, sin sesión, lo que marcan las
--   RPC de service_role con spinus.via ('google', 'google_rsvp'): la misma
--   regla de log_cita_change. PostgREST no deja a una sesión fijar spinus.via.
--
-- Depende de: F5a (agenda_bloqueos), F2 (gcal_sync_estado), F4 (avisos_clinica,
--   cita_correos) y F1 (agenda_v2_encendida). Sólo actúa con la v2 encendida.
-- Bloqueos (lock_timeout 5 s): ALTER TABLE sobre avisos_clinica (ACCESS
--   EXCLUSIVE; tabla nueva y pequeña, las cuatro columnas y el DROP NOT NULL
--   son sólo catálogo; los dos CHECK la recorren) y CREATE TRIGGER (SHARE ROW
--   EXCLUSIVE: frena escrituras, no lecturas) sobre appointments,
--   agenda_bloqueos, cita_correos, clinica_conexiones_google y gcal_sync_estado.
--   Lo de las tablas calientes va AL FINAL, en un solo bloque DO (dimensión 29).
-- Ventana de despliegue: MIGRACIÓN PRIMERO, CÓDIGO DESPUÉS. El código de antes
--   pide sólo los tipos que conoce (leerAvisosClinica) y nunca ve un aviso sin
--   cita (cruza con appointments). El código nuevo tolera la base sin M1.
-- Riesgo: MEDIO. Disparador nuevo en appointments (costo medido) y dos policies
--   recreadas en la misma transacción.
-- No re-ejecutable: una segunda pasada ABORTA en el pre-vuelo sin cambiar nada.
-- Vuelta atrás: supabase/reversas/20261202120000_avisos_globales_modelo_reversa.sql
-- Prueba: supabase/pruebas-sql/av1_avisos_globales.sql
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  c_mias CONSTANT text[] := ARRAY['aviso_clinica_de_cambio_cita', 'aviso_clinica_de_bloqueo', 'aviso_clinica_de_correo',
    'aviso_clinica_de_conexion_google', 'aviso_clinica_de_sync_google', 'aviso_clinica_registrar'];
  c_tablas CONSTANT text[] := ARRAY['avisos_clinica', 'appointments', 'agenda_bloqueos', 'cita_correos',
    'clinica_conexiones_google', 'gcal_sync_estado', 'agenda_ajustes', 'profiles'];
  v_t text;
  v_n integer;
BEGIN
  FOREACH v_t IN ARRAY c_tablas LOOP
    IF to_regclass('public.' || v_t) IS NULL THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: no existe public.%: aplica antes las migraciones de la agenda (20261201120000 … 20261201180000).', v_t;
    END IF;
    IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = to_regclass('public.' || v_t)), 'USAGE') THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: % no es dueño de public.%.', current_user, v_t;
    END IF;
  END LOOP;
  -- Replay: nada de lo que esta migración crea puede existir ya.
  IF EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = ANY (c_mias))
     OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'avisos_clinica'
                   AND column_name IN ('destinatario_id', 'actor_id', 'medico_id', 'datos'))
     OR to_regclass('public.avisos_clinica_sin_cita_key') IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: esta migración ya está aplicada (o a medias). No se repite: revisa la rejilla de la primera pasada o corre antes su reversa.';
  END IF;
  -- La forma de F4 que se va a sustituir: el CHECK de 7 tipos y las dos policies.
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'avisos_clinica'
        AND policyname IN ('avisos_clinica_select', 'avisos_clinica_update')) <> 2
     OR (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'avisos_clinica') <> 2 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: avisos_clinica no tiene exactamente las policies avisos_clinica_select y avisos_clinica_update de F4.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'avisos_clinica_tipo_check'
                    AND conrelid = 'public.avisos_clinica'::regclass) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta avisos_clinica_tipo_check (F4).';
  END IF;
  -- Ninguna fila con un tipo fuera de los 7 de F4, ni sin cita: los CHECK nuevos las admitirían, pero no deberían existir.
  SELECT count(*) INTO v_n FROM public.avisos_clinica a
   WHERE a.cita_id IS NULL OR a.tipo NOT IN ('reserva_enlace', 'cancelacion_paciente', 'reagendado_paciente',
           'google_por_asignar', 'empalme_google', 'google_movimiento_rechazado', 'confirmacion_paciente');
  IF v_n > 0 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: hay % fila(s) de avisos_clinica que no son de F4.', v_n;
  END IF;
  -- Lo que usan las funciones nuevas.
  IF to_regprocedure('public.agenda_v2_encendida(uuid)') IS NULL OR to_regprocedure('public.get_clinica_id()') IS NULL
     OR to_regprocedure('public.get_my_role()') IS NULL OR to_regprocedure('public.soy_admin_de_clinica()') IS NULL
     OR to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta agenda_v2_encendida(uuid), get_clinica_id(), get_my_role(), soy_admin_de_clinica() o auth.uid().';
  END IF;
  -- La publicación: existe, no es FOR ALL TABLES, quien aplica es su dueño y la tabla aún no está.
  IF NOT EXISTS (SELECT 1 FROM pg_publication p WHERE p.pubname = 'supabase_realtime' AND NOT p.puballtables
                    AND pg_has_role(current_user, p.pubowner, 'USAGE')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: la publicación supabase_realtime no existe, es FOR ALL TABLES o % no es su dueño.', current_user;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
                AND tablename = 'avisos_clinica') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: avisos_clinica ya está en la publicación supabase_realtime.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · La tabla (nueva y pequeña): columnas, CHECK, índice y policies.
-- ---------------------------------------------------------------------
ALTER TABLE public.avisos_clinica
  ADD COLUMN destinatario_id uuid,
  ADD COLUMN actor_id uuid,
  ADD COLUMN medico_id uuid,
  ADD COLUMN datos jsonb,
  ALTER COLUMN cita_id DROP NOT NULL,
  DROP CONSTRAINT avisos_clinica_tipo_check,
  -- ⚠️ La misma lista que TIPOS_AVISO (src/lib/avisos/avisosClinica.ts). Un
  -- tipo nuevo va aquí antes que en el código.
  ADD CONSTRAINT avisos_clinica_tipo_check CHECK (tipo IN (
    'reserva_enlace', 'cancelacion_paciente', 'reagendado_paciente', 'google_por_asignar', 'empalme_google',
    'google_movimiento_rechazado', 'confirmacion_paciente',
    'google_movio_cita', 'google_cancelo_cita', 'correo_fallido', 'personal_agendo', 'personal_movio', 'personal_cancelo',
    'reserva_frenada', 'google_desconectado', 'google_sin_sincronizar', 'recordatorios_enviados',
    'personal_bloqueo', 'personal_desbloqueo')),
  -- Los seis tipos SIN cita no llevan cita; los demás, siempre.
  ADD CONSTRAINT avisos_clinica_cita_tipo_check CHECK (
    (tipo IN ('reserva_frenada', 'google_desconectado', 'google_sin_sincronizar', 'recordatorios_enviados',
              'personal_bloqueo', 'personal_desbloqueo')) = (cita_id IS NULL)),
  ADD CONSTRAINT avisos_clinica_datos_check CHECK (datos IS NULL OR jsonb_typeof(datos) = 'object');

COMMENT ON COLUMN public.avisos_clinica.destinatario_id IS
  'Avisos globales: NULL = el aviso es de toda la clínica (quien vea la cita). Con valor, SÓLO ese usuario lo ve (ni el administrador): lo que el personal hace en la agenda de un médico. Sin FK, como revisado_por. Lo imponen las policies avisos_clinica_select/_update.';
COMMENT ON COLUMN public.avisos_clinica.actor_id IS
  'Avisos globales: quién hizo lo que el aviso cuenta (auth.uid() del disparador, o el actor que pasa el servidor a aviso_clinica_registrar). Atribución sin FK. CONVENIO: quien lo hizo no ve su propio aviso (policy: actor_id IS DISTINCT FROM auth.uid()).';
COMMENT ON COLUMN public.avisos_clinica.medico_id IS
  'Avisos globales: el dueño de la agenda en los avisos SIN cita (reserva_frenada, recordatorios_enviados, personal_bloqueo, personal_desbloqueo); NULL en los de toda la clínica (google_desconectado, google_sin_sincronizar). En los avisos CON cita no se usa: el médico es el de la cita. Sin FK.';
COMMENT ON COLUMN public.avisos_clinica.datos IS
  'Avisos globales: objeto jsonb con contadores y horas del aviso: {"intentos": n}, {"enviados": n}, {"inicio": ts, "fin": ts, "todo_el_dia": bool, "zona": text}. CONVENIO QUE LA BASE NO IMPONE: NUNCA datos de personas ni nada clínico (ni nombre, ni teléfono, ni correo, ni motivo). Lo pinta textoAviso (src/lib/avisos/avisosClinica.ts).';
COMMENT ON COLUMN public.avisos_clinica.cita_id IS
  'La cita del aviso; NULL en los seis tipos sin cita (avisos_clinica_cita_tipo_check). SIN FK a appointments a propósito: es un aviso y no debe impedir nada sobre la cita; el lector cruza con appointments y, si la cita ya no existe, la policy no muestra la fila. Por eso puede quedar huérfano: quien limpie citas (semilla, scripts) lo borra a mano.';

-- Uno SIN REVISAR por clínica, tipo y médico en los avisos sin cita que se
-- repiten: los escritores usan ON CONFLICT con ESTE predicado y suben el
-- contador. Los de bloqueo no entran: cada bloqueo es su aviso.
CREATE UNIQUE INDEX avisos_clinica_sin_cita_key
  ON public.avisos_clinica (clinica_id, tipo, (coalesce(medico_id, '00000000-0000-0000-0000-000000000000'::uuid)))
  WHERE cita_id IS NULL AND revisado_en IS NULL
    AND tipo IN ('reserva_frenada', 'google_desconectado', 'google_sin_sincronizar', 'recordatorios_enviados');

-- Las dos policies de F4, recreadas. Con destinatario_id, actor_id y cita_id
-- como en F4 (NULL, NULL, con valor) dan el mismo resultado que antes.
-- Sin recursión: leen appointments (bajo la RLS de quien pregunta: el invitado,
-- sólo las suyas) y helpers DEFINER; nunca avisos_clinica.
DROP POLICY avisos_clinica_select ON public.avisos_clinica;
CREATE POLICY avisos_clinica_select ON public.avisos_clinica FOR SELECT TO authenticated
  USING (clinica_id = public.get_clinica_id()
         AND (destinatario_id IS NULL OR destinatario_id = auth.uid())
         AND actor_id IS DISTINCT FROM auth.uid()
         AND CASE WHEN cita_id IS NOT NULL
                  THEN EXISTS (SELECT 1 FROM public.appointments a
                                WHERE a.id = avisos_clinica.cita_id AND a.clinica_id = public.get_clinica_id())
                  ELSE (medico_id IS NULL OR medico_id = auth.uid()
                        OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria')
             END);
-- Un revisado no se reabre (USING revisado_en IS NULL + aviso_clinica_revisar).
DROP POLICY avisos_clinica_update ON public.avisos_clinica;
CREATE POLICY avisos_clinica_update ON public.avisos_clinica FOR UPDATE TO authenticated
  USING (clinica_id = public.get_clinica_id() AND revisado_en IS NULL
         AND (destinatario_id IS NULL OR destinatario_id = auth.uid())
         AND actor_id IS DISTINCT FROM auth.uid()
         AND CASE WHEN cita_id IS NOT NULL
                  THEN EXISTS (SELECT 1 FROM public.appointments a
                                WHERE a.id = avisos_clinica.cita_id AND a.clinica_id = public.get_clinica_id())
                  ELSE (medico_id IS NULL OR medico_id = auth.uid()
                        OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria')
             END)
  WITH CHECK (clinica_id = public.get_clinica_id() AND revisado_por = auth.uid());

COMMENT ON TABLE public.avisos_clinica IS
  'Agenda v2 · avisos de la campana (en toda la app desde «avisos globales»). Lo que pasó en la agenda y alguien de la clínica debe saber: lo que hizo el paciente, lo que llegó de Google, lo que falló y lo que el personal hizo en la agenda de un médico. Se conserva hasta que alguien lo revisa (revisado_en/revisado_por) y después queda como registro. La escriben SÓLO los disparadores aviso_clinica_de_* (DEFINER, dueño postgres) y la RPC aviso_clinica_registrar (sólo service_role); el personal sólo marca revisado. destinatario_id limita quién lo ve y actor_id excluye a quien lo hizo. Sin FK a appointments a propósito: el lector cruza con appointments.';

-- ---------------------------------------------------------------------
-- 3 · Escritores nuevos. DEFINER de postgres y search_path vacío, como los de
--     F4: no dependen de los permisos de quien escribe la fila de origen.
--     RETURNS trigger: no se pueden llamar por RPC.
-- ---------------------------------------------------------------------

-- appointments AFTER INSERT / AFTER UPDATE OF status, start_time, end_time.
--   Con sesión, en la agenda de OTRO médico: personal_agendo / _movio / _cancelo,
--   dirigido sólo a ese médico. Sin sesión, lo que marcan las RPC de Google.
CREATE FUNCTION public.aviso_clinica_de_cambio_cita()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid   uuid := auth.uid();
  v_via   text := current_setting('spinus.via', true);
  v_tipo  text;
  v_movio   boolean := false;
  v_cancelo boolean := false;
  v_confirmo boolean := false;
BEGIN
  -- OLD sólo existe en UPDATE: no se nombra fuera de este IF.
  IF TG_OP = 'UPDATE' THEN
    v_movio := OLD.start_time IS DISTINCT FROM NEW.start_time OR OLD.end_time IS DISTINCT FROM NEW.end_time;
    v_cancelo := NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled';
    v_confirmo := NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed';
  END IF;
  IF v_uid IS NOT NULL THEN
    IF NEW.medico_id IS NULL OR NEW.medico_id = v_uid THEN RETURN NULL; END IF;
    v_tipo := CASE WHEN TG_OP = 'INSERT' THEN 'personal_agendo' WHEN v_cancelo THEN 'personal_cancelo'
                   WHEN v_movio AND NEW.status <> 'cancelled' THEN 'personal_movio' END;
  ELSIF TG_OP = 'UPDATE' AND (NEW.paciente_id IS NOT NULL OR NEW.reserva_canal IS NOT NULL) THEN
    v_tipo := CASE
      WHEN v_via = 'google_rsvp' AND v_confirmo THEN 'confirmacion_paciente'
      WHEN v_via = 'google_rsvp' AND v_cancelo THEN 'cancelacion_paciente'
      WHEN v_via = 'google' AND v_cancelo THEN 'google_cancelo_cita'
      WHEN v_via = 'google' AND v_movio AND NEW.status <> 'cancelled' THEN 'google_movio_cita' END;
  END IF;
  IF v_tipo IS NULL OR NOT public.agenda_v2_encendida(NEW.clinica_id) THEN RETURN NULL; END IF;
  BEGIN
    IF v_tipo LIKE 'personal\_%' THEN
      INSERT INTO public.avisos_clinica AS a (clinica_id, tipo, cita_id, destinatario_id, actor_id)
      VALUES (NEW.clinica_id, v_tipo, NEW.id, NEW.medico_id, v_uid)
      ON CONFLICT (tipo, cita_id) WHERE revisado_en IS NULL
      DO UPDATE SET creado_en = now(), actor_id = EXCLUDED.actor_id, destinatario_id = EXCLUDED.destinatario_id;
    ELSIF v_tipo = 'google_movio_cita' THEN
      INSERT INTO public.avisos_clinica (clinica_id, tipo, cita_id) VALUES (NEW.clinica_id, v_tipo, NEW.id)
      ON CONFLICT (tipo, cita_id) WHERE revisado_en IS NULL DO UPDATE SET creado_en = now();
    ELSE
      INSERT INTO public.avisos_clinica (clinica_id, tipo, cita_id) VALUES (NEW.clinica_id, v_tipo, NEW.id)
      ON CONFLICT (tipo, cita_id) WHERE revisado_en IS NULL DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Un aviso nunca impide guardar la cita. Sin datos de nadie en el mensaje.
    RAISE WARNING 'aviso_clinica_de_cambio_cita: aviso % no escrito (SQLSTATE %)', v_tipo, SQLSTATE;
  END;
  RETURN NULL;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.aviso_clinica_de_cambio_cita() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.aviso_clinica_de_cambio_cita() TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.aviso_clinica_de_cambio_cita() IS
  'Avisos globales: deja el aviso de un alta, cambio de hora o cancelación de una cita cuando (a) lo hace alguien con sesión en la agenda de OTRO médico (personal_agendo/_movio/_cancelo, dirigido sólo a ese médico, con actor) o (b) llega sin sesión marcado por las RPC de Google con spinus.via (google_rsvp: confirmacion_paciente/cancelacion_paciente; google: google_movio_cita/google_cancelo_cita, sólo citas con paciente o por ligar). El médico en su propia agenda no genera nada. Sólo con la v2 encendida. Si el alta del aviso falla, deja un WARNING y la cita se guarda igual.';

-- agenda_bloqueos AFTER INSERT / AFTER DELETE: el personal pone o quita un
-- bloqueo en la agenda de un médico. Los de Google (service_role) no avisan.
CREATE FUNCTION public.aviso_clinica_de_bloqueo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_b   record;
BEGIN
  IF TG_OP = 'DELETE' THEN v_b := OLD; ELSE v_b := NEW; END IF;
  IF v_uid IS NULL OR v_b.medico_id = v_uid OR NOT public.agenda_v2_encendida(v_b.clinica_id) THEN RETURN NULL; END IF;
  BEGIN
    INSERT INTO public.avisos_clinica (clinica_id, tipo, medico_id, destinatario_id, actor_id, datos)
    VALUES (v_b.clinica_id, CASE TG_OP WHEN 'DELETE' THEN 'personal_desbloqueo' ELSE 'personal_bloqueo' END,
            v_b.medico_id, v_b.medico_id, v_uid,
            jsonb_build_object('inicio', v_b.inicio, 'fin', v_b.fin, 'todo_el_dia', v_b.todo_el_dia, 'zona', v_b.zona));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'aviso_clinica_de_bloqueo: aviso no escrito (SQLSTATE %)', SQLSTATE;
  END;
  RETURN NULL;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.aviso_clinica_de_bloqueo() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.aviso_clinica_de_bloqueo() TO anon, authenticated, service_role;

-- cita_correos AFTER UPDATE OF estado: un correo que ya no se reintenta
-- (correo_fallido) o un recordatorio enviado (recordatorios_enviados, agrupado
-- por médico). El envío a mano (tipo confirmacion) no avisa: quien lo mandó lo
-- ve fallar en pantalla.
CREATE FUNCTION public.aviso_clinica_de_correo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_medico uuid;
BEGIN
  IF NOT public.agenda_v2_encendida(NEW.clinica_id) THEN RETURN NULL; END IF;
  BEGIN
    IF NEW.estado = 'fallido' THEN
      INSERT INTO public.avisos_clinica (clinica_id, tipo, cita_id) VALUES (NEW.clinica_id, 'correo_fallido', NEW.appointment_id)
      ON CONFLICT (tipo, cita_id) WHERE revisado_en IS NULL DO NOTHING;
    ELSE
      SELECT a.medico_id INTO v_medico FROM public.appointments a
       WHERE a.id = NEW.appointment_id AND a.clinica_id = NEW.clinica_id;
      INSERT INTO public.avisos_clinica AS a (clinica_id, tipo, medico_id, datos)
      VALUES (NEW.clinica_id, 'recordatorios_enviados', v_medico, jsonb_build_object('enviados', 1))
      ON CONFLICT (clinica_id, tipo, (coalesce(medico_id, '00000000-0000-0000-0000-000000000000'::uuid)))
        WHERE cita_id IS NULL AND revisado_en IS NULL
          AND tipo IN ('reserva_frenada', 'google_desconectado', 'google_sin_sincronizar', 'recordatorios_enviados')
      DO UPDATE SET creado_en = now(),
                    datos = jsonb_build_object('enviados', coalesce((a.datos ->> 'enviados')::integer, 0) + 1);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'aviso_clinica_de_correo: aviso no escrito (SQLSTATE %)', SQLSTATE;
  END;
  RETURN NULL;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.aviso_clinica_de_correo() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.aviso_clinica_de_correo() TO anon, authenticated, service_role;

-- clinica_conexiones_google AFTER UPDATE OF estado: la conexión de la clínica
-- pasó de activa a revocada (Google rechazó la credencial).
CREATE FUNCTION public.aviso_clinica_de_conexion_google()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT public.agenda_v2_encendida(NEW.clinica_id) THEN RETURN NULL; END IF;
  BEGIN
    INSERT INTO public.avisos_clinica (clinica_id, tipo) VALUES (NEW.clinica_id, 'google_desconectado')
    ON CONFLICT (clinica_id, tipo, (coalesce(medico_id, '00000000-0000-0000-0000-000000000000'::uuid)))
      WHERE cita_id IS NULL AND revisado_en IS NULL
        AND tipo IN ('reserva_frenada', 'google_desconectado', 'google_sin_sincronizar', 'recordatorios_enviados')
    DO UPDATE SET creado_en = now();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'aviso_clinica_de_conexion_google: aviso no escrito (SQLSTATE %)', SQLSTATE;
  END;
  RETURN NULL;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.aviso_clinica_de_conexion_google() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.aviso_clinica_de_conexion_google() TO anon, authenticated, service_role;

-- gcal_sync_estado AFTER UPDATE OF errores_seguidos: la sincronización cruza
-- los 3 fallos seguidos (una vez por racha: el WHEN mira el cruce).
CREATE FUNCTION public.aviso_clinica_de_sync_google()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT public.agenda_v2_encendida(NEW.clinica_id) THEN RETURN NULL; END IF;
  BEGIN
    INSERT INTO public.avisos_clinica (clinica_id, tipo) VALUES (NEW.clinica_id, 'google_sin_sincronizar')
    ON CONFLICT (clinica_id, tipo, (coalesce(medico_id, '00000000-0000-0000-0000-000000000000'::uuid)))
      WHERE cita_id IS NULL AND revisado_en IS NULL
        AND tipo IN ('reserva_frenada', 'google_desconectado', 'google_sin_sincronizar', 'recordatorios_enviados')
    DO UPDATE SET creado_en = now();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'aviso_clinica_de_sync_google: aviso no escrito (SQLSTATE %)', SQLSTATE;
  END;
  RETURN NULL;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.aviso_clinica_de_sync_google() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.aviso_clinica_de_sync_google() TO anon, authenticated, service_role;

-- La única puerta que no es un disparador: lo que el servidor sabe y la base
-- no puede ver. SÓLO service_role (las rutas la llaman con createAdminClient y
-- la clinica_id de la sesión o del enlace). Lista blanca de DOS tipos:
--   reserva_frenada  (p_medico_id; sin cita ni actor): la reserva por enlace que
--                    frenó el candado o un contacto bloqueado. Agrupado.
--   personal_movio   (p_cita_id y p_actor_id): «Reagendar» del personal, que
--                    escribe con service_role y por eso no trae auth.uid().
-- Comprueba que médico, cita y actor son de ESA clínica; si no, false sin más
-- (la misma respuesta exista o no lo referido). No lanza por datos.
CREATE FUNCTION public.aviso_clinica_registrar(p_clinica_id uuid, p_tipo text, p_cita_id uuid, p_medico_id uuid, p_actor_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_medico uuid;
BEGIN
  IF p_clinica_id IS NULL OR p_tipo IS NULL OR p_tipo NOT IN ('reserva_frenada', 'personal_movio') THEN
    RAISE EXCEPTION 'aviso_clinica_registrar: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  IF NOT public.agenda_v2_encendida(p_clinica_id) THEN RETURN false; END IF;
  IF p_tipo = 'reserva_frenada' THEN
    IF p_medico_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles pr
                                           WHERE pr.id = p_medico_id AND pr.clinica_id = p_clinica_id) THEN
      RETURN false;
    END IF;
    INSERT INTO public.avisos_clinica AS a (clinica_id, tipo, medico_id, datos)
    VALUES (p_clinica_id, 'reserva_frenada', p_medico_id, jsonb_build_object('intentos', 1))
    ON CONFLICT (clinica_id, tipo, (coalesce(medico_id, '00000000-0000-0000-0000-000000000000'::uuid)))
      WHERE cita_id IS NULL AND revisado_en IS NULL
        AND tipo IN ('reserva_frenada', 'google_desconectado', 'google_sin_sincronizar', 'recordatorios_enviados')
    DO UPDATE SET creado_en = now(),
                  datos = jsonb_build_object('intentos', coalesce((a.datos ->> 'intentos')::integer, 0) + 1);
    RETURN true;
  END IF;
  SELECT c.medico_id INTO v_medico FROM public.appointments c
   WHERE c.id = p_cita_id AND c.clinica_id = p_clinica_id;
  IF v_medico IS NULL OR p_actor_id IS NULL OR v_medico = p_actor_id
     OR NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = p_actor_id AND pr.clinica_id = p_clinica_id) THEN
    RETURN false;
  END IF;
  INSERT INTO public.avisos_clinica (clinica_id, tipo, cita_id, destinatario_id, actor_id)
  VALUES (p_clinica_id, 'personal_movio', p_cita_id, v_medico, p_actor_id)
  ON CONFLICT (tipo, cita_id) WHERE revisado_en IS NULL
  DO UPDATE SET creado_en = now(), actor_id = EXCLUDED.actor_id, destinatario_id = EXCLUDED.destinatario_id;
  RETURN true;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.aviso_clinica_registrar(uuid, text, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.aviso_clinica_registrar(uuid, text, uuid, uuid, uuid) TO service_role;
COMMENT ON FUNCTION public.aviso_clinica_registrar(uuid, text, uuid, uuid, uuid) IS
  'Avisos globales: el aviso de lo que el servidor sabe y un disparador no puede ver. Sólo service_role. Lista blanca: reserva_frenada (médico del enlace; agrupado, sube datos.intentos) y personal_movio (cita y actor: «Reagendar» del personal, que escribe sin auth.uid()). Comprueba que médico, cita y actor son de p_clinica_id y devuelve false si no; sólo con la v2 encendida. Un tipo nuevo exige migración.';

-- ---------------------------------------------------------------------
-- 4 · Lo que toca tablas EXISTENTES, junto y al final, en UN bloque: cada
--     CREATE TRIGGER toma SHARE ROW EXCLUSIVE sobre su tabla hasta el COMMIT.
--     ⚠️ Los WHEN ahorran la llamada en casi toda escritura: el médico en su
--     propia agenda no llama a la función al dar de alta, y un UPDATE que no
--     cambia estado ni hora, tampoco.
-- ---------------------------------------------------------------------
DO $triggers$
BEGIN
  CREATE TRIGGER trg_appointments_aviso_alta_personal
    AFTER INSERT ON public.appointments
    FOR EACH ROW
    WHEN (NEW.medico_id IS NOT NULL AND auth.uid() IS NOT NULL AND auth.uid() <> NEW.medico_id)
    EXECUTE FUNCTION public.aviso_clinica_de_cambio_cita();
  CREATE TRIGGER trg_appointments_aviso_cambio
    AFTER UPDATE OF status, start_time, end_time ON public.appointments
    FOR EACH ROW
    WHEN ((OLD.status IS DISTINCT FROM NEW.status OR OLD.start_time IS DISTINCT FROM NEW.start_time
           OR OLD.end_time IS DISTINCT FROM NEW.end_time)
          AND auth.uid() IS DISTINCT FROM NEW.medico_id)
    EXECUTE FUNCTION public.aviso_clinica_de_cambio_cita();
  CREATE TRIGGER trg_agenda_bloqueos_aviso_alta
    AFTER INSERT ON public.agenda_bloqueos
    FOR EACH ROW
    WHEN (auth.uid() IS NOT NULL AND auth.uid() <> NEW.medico_id)
    EXECUTE FUNCTION public.aviso_clinica_de_bloqueo();
  CREATE TRIGGER trg_agenda_bloqueos_aviso_baja
    AFTER DELETE ON public.agenda_bloqueos
    FOR EACH ROW
    WHEN (auth.uid() IS NOT NULL AND auth.uid() <> OLD.medico_id)
    EXECUTE FUNCTION public.aviso_clinica_de_bloqueo();
  -- Fallido sin reintento posible: el comprobante (no lo reintenta nadie) o el
  -- tercer intento; y sólo por fallo de envío o de plantilla. O un recordatorio enviado.
  CREATE TRIGGER trg_cita_correos_aviso_clinica
    AFTER UPDATE OF estado ON public.cita_correos
    FOR EACH ROW
    WHEN (OLD.estado IS DISTINCT FROM NEW.estado
          AND ((NEW.estado = 'fallido' AND NEW.tipo IN ('comprobante', 'recordatorio')
                AND NEW.motivo IN ('transporte', 'plantilla') AND (NEW.tipo = 'comprobante' OR NEW.intentos >= 3))
            OR (NEW.estado = 'enviado' AND NEW.tipo = 'recordatorio')))
    EXECUTE FUNCTION public.aviso_clinica_de_correo();
  CREATE TRIGGER trg_conexiones_google_aviso_clinica
    AFTER UPDATE OF estado ON public.clinica_conexiones_google
    FOR EACH ROW
    WHEN (OLD.estado = 'activa' AND NEW.estado = 'revocada' AND NEW.rol = 'clinica')
    EXECUTE FUNCTION public.aviso_clinica_de_conexion_google();
  CREATE TRIGGER trg_gcal_sync_estado_aviso_clinica
    AFTER UPDATE OF errores_seguidos ON public.gcal_sync_estado
    FOR EACH ROW
    WHEN (NEW.errores_seguidos >= 3 AND OLD.errores_seguidos < 3)
    EXECUTE FUNCTION public.aviso_clinica_de_sync_google();
END $triggers$;

-- Realtime: la campana se entera sin sondear. Realtime entrega cada cambio
-- SÓLO a quien puede leer la fila con su sesión (RLS de SELECT). Un DELETE no
-- pasa por la RLS y viaja con la llave primaria nada más (identidad de réplica
-- por omisión): aquí nadie borra avisos salvo postgres.
ALTER PUBLICATION supabase_realtime ADD TABLE public.avisos_clinica;

-- ---------------------------------------------------------------------
-- 5 · Post-vuelo, ANTES del COMMIT. Si algo no quedó, aborta y no queda nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_mal text;
BEGIN
  -- Las cinco funciones de disparador: DEFINER, search_path vacío, sin PUBLIC.
  SELECT string_agg(f, ', ') INTO v_mal
    FROM unnest(ARRAY['aviso_clinica_de_cambio_cita', 'aviso_clinica_de_bloqueo', 'aviso_clinica_de_correo',
                      'aviso_clinica_de_conexion_google', 'aviso_clinica_de_sync_google']) f
   WHERE NOT EXISTS (SELECT 1 FROM pg_proc p
                      WHERE p.oid = to_regprocedure('public.' || f || '()') AND p.prosecdef
                        AND p.proconfig = ARRAY['search_path=""'] AND p.prorettype = 'pg_catalog.trigger'::regtype
                        AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0));
  IF v_mal IS NOT NULL THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: funciones de disparador que no quedaron como deben: %', v_mal;
  END IF;
  -- La RPC: DEFINER, search_path vacío, y SÓLO service_role la ejecuta.
  IF NOT EXISTS (SELECT 1 FROM pg_proc p
                  WHERE p.oid = to_regprocedure('public.aviso_clinica_registrar(uuid, text, uuid, uuid, uuid)')
                    AND p.prosecdef AND p.proconfig = ARRAY['search_path=""'])
     OR has_function_privilege('anon', 'public.aviso_clinica_registrar(uuid, text, uuid, uuid, uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.aviso_clinica_registrar(uuid, text, uuid, uuid, uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.aviso_clinica_registrar(uuid, text, uuid, uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: aviso_clinica_registrar no quedó DEFINER, con search_path vacío y sólo para service_role.';
  END IF;
  -- Los siete disparadores, habilitados.
  SELECT string_agg(t.n, ', ') INTO v_mal
    FROM (VALUES ('appointments', 'trg_appointments_aviso_alta_personal'), ('appointments', 'trg_appointments_aviso_cambio'),
                 ('agenda_bloqueos', 'trg_agenda_bloqueos_aviso_alta'), ('agenda_bloqueos', 'trg_agenda_bloqueos_aviso_baja'),
                 ('cita_correos', 'trg_cita_correos_aviso_clinica'),
                 ('clinica_conexiones_google', 'trg_conexiones_google_aviso_clinica'),
                 ('gcal_sync_estado', 'trg_gcal_sync_estado_aviso_clinica')) AS t(tabla, n)
   WHERE NOT EXISTS (SELECT 1 FROM pg_trigger g WHERE g.tgrelid = ('public.' || t.tabla)::regclass AND g.tgname = t.n
                        AND g.tgenabled = 'O' AND NOT g.tgisinternal);
  IF v_mal IS NOT NULL THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: faltan o están deshabilitados los disparadores: %', v_mal;
  END IF;
  -- Privilegios de la tabla, los de F4: authenticated lee y marca revisado; nadie más nada (TRUNCATE incluido).
  SELECT string_agg(r || ':' || p, ', ') INTO v_mal
    FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) r
    CROSS JOIN unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) p
   WHERE has_table_privilege(r, 'public.avisos_clinica', p) AND NOT (r = 'authenticated' AND p = 'SELECT');
  IF v_mal IS NOT NULL THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: privilegios de más en avisos_clinica: %', v_mal;
  END IF;
  IF has_column_privilege('authenticated', 'public.avisos_clinica', 'destinatario_id', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.avisos_clinica', 'actor_id', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.avisos_clinica', 'datos', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.avisos_clinica', 'revisado_en', 'UPDATE') THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: authenticated debe poder actualizar sólo revisado_en y revisado_por.';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.avisos_clinica'::regclass)
     OR (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'avisos_clinica') <> 2 THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: avisos_clinica sin RLS o sin sus dos policies.';
  END IF;
  -- Ninguna policy de avisos_clinica lee avisos_clinica (recursión).
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'avisos_clinica'
                AND (coalesce(qual, '') || coalesce(with_check, '')) ~* 'from\s+(public\.)?avisos_clinica') THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: una policy de avisos_clinica consulta avisos_clinica (recursión).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
                    AND tablename = 'avisos_clinica') THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: avisos_clinica no quedó en la publicación supabase_realtime.';
  END IF;
END $$;

COMMIT;

-- ---------------------------------------------------------------------
-- 6 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO' WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'columnas nuevas de avisos_clinica' AS comprobacion,
         (SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'avisos_clinica'
             AND column_name IN ('destinatario_id', 'actor_id', 'medico_id', 'datos')) AS valor,
         'actor_id,datos,destinatario_id,medico_id' AS esperado
  UNION ALL
  SELECT 2, 'tipos que admite avisos_clinica_tipo_check',
         (SELECT (length(pg_get_constraintdef(oid)) - length(replace(pg_get_constraintdef(oid), '::text', ''))) / 6
            FROM pg_constraint WHERE conname = 'avisos_clinica_tipo_check' AND conrelid = to_regclass('public.avisos_clinica'))::text,
         '19'
  UNION ALL
  SELECT 3, 'policies de avisos_clinica',
         (SELECT string_agg(policyname || ':' || cmd, ',' ORDER BY policyname) FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'avisos_clinica'),
         'avisos_clinica_select:SELECT,avisos_clinica_update:UPDATE'
  UNION ALL
  SELECT 4, 'disparadores aviso nuevos, habilitados',
         (SELECT count(*)::text FROM pg_trigger g
           WHERE NOT g.tgisinternal AND g.tgenabled = 'O'
             AND g.tgname IN ('trg_appointments_aviso_alta_personal', 'trg_appointments_aviso_cambio',
                              'trg_agenda_bloqueos_aviso_alta', 'trg_agenda_bloqueos_aviso_baja',
                              'trg_cita_correos_aviso_clinica', 'trg_conexiones_google_aviso_clinica',
                              'trg_gcal_sync_estado_aviso_clinica')),
         '7'
  UNION ALL
  SELECT 5, 'funciones aviso_clinica_* DEFINER con search_path vacío (6 de F4 + 5 de disparador + la RPC)',
         (SELECT count(*)::text FROM pg_proc p
           WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'aviso\_clinica\_%'
             AND p.prosecdef AND p.proconfig = ARRAY['search_path=""']),
         '12'
  UNION ALL
  SELECT 6, 'quién ejecuta aviso_clinica_registrar (anon/authenticated/service_role)',
         (SELECT string_agg(has_function_privilege(r, 'public.aviso_clinica_registrar(uuid, text, uuid, uuid, uuid)', 'EXECUTE')::text, '/')
            FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) WITH ORDINALITY AS x(r, o)),
         'false/false/true'
  UNION ALL
  SELECT 7, 'avisos_clinica en la publicación supabase_realtime',
         (SELECT count(*)::text FROM pg_publication_tables
           WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'avisos_clinica'),
         '1'
  UNION ALL
  SELECT 8, 'filas de avisos_clinica (ninguna cambia con esta migración)',
         (SELECT count(*)::text FROM public.avisos_clinica), NULL
) t
ORDER BY t.n;
