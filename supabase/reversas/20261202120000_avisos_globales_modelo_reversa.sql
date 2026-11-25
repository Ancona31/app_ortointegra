-- ═══════════════════════════════════════════════════════════════════════
-- REVERSA de M1 (20261202120000_avisos_globales_modelo.sql)
-- NO es una migración: vive fuera de supabase/migrations/. Se corre a mano y
-- SÓLO si Angel lo pide.
-- ═══════════════════════════════════════════════════════════════════════
-- QUÉ HACE, en dos partes:
--   A · SIEMPRE: quita lo que ESCRIBE avisos nuevos y lo que los publica: los 7
--       disparadores de M1, sus 5 funciones, la RPC aviso_clinica_registrar,
--       el disparador de reabrir, la lectura avisos_pendientes y avisos_clinica
--       de la publicación supabase_realtime. Desde ese momento no nace ningún
--       aviso de los 12 tipos nuevos; los 7 de F4 siguen igual. La tabla
--       avisos_vistos (quién vio qué) se borra SÓLO si está vacía; con filas se
--       queda, inerte, y la rejilla lo dice: nunca se borra lo que alguien marcó.
--   B · SÓLO SI NINGUNA FILA USA LA FORMA NUEVA (ver la guarda): devuelve la
--       tabla a la forma de F4: las dos policies de F4, cita_id NOT NULL, el
--       CHECK de 7 tipos, y fuera el índice, los dos CHECK y las 4 columnas.
--       Si hay filas de la forma nueva, la parte B NO SE HACE y la rejilla lo
--       dice (REVISAR): la tabla conserva su forma de M1, que es un superconjunto
--       de la de F4 y sigue siendo segura (las policies de M1 ocultan lo
--       dirigido). NUNCA borra un aviso para poder deshacer.
-- QUÉ SE PIERDE MIENTRAS TANTO: los avisos del personal, de Google («Sí», «No»,
--   mover, borrar, desconexión), de correos y de reservas frenadas; y la
--   campana deja de enterarse por Realtime (vuelve a su relectura cada 2 min).
--   El código nuevo lo tolera: sin la RPC (PGRST202) no avisa y sigue.
-- ORDEN EN LA CADENA: ésta va la PRIMERA (antes que la de 20261201180000 y las
--   de F5b … F1): la reversa de F4 borra avisos_clinica, y los disparadores de
--   M1 en appointments, agenda_bloqueos, cita_correos, clinica_conexiones_google
--   y gcal_sync_estado quedarían escribiendo en una tabla que ya no existe
--   (cada uno dejaría un WARNING por escritura; ninguna escritura fallaría).
-- GUARDA DE DATOS, SIN CORRER LA REVERSA (dimensión 31): consulta de SÓLO
--   LECTURA con la misma condición que decide la parte B. 0 filas = la parte B
--   se hará; con filas, sólo la parte A.
--     SELECT 'M1: marcas de visto (avisos_vistos se quedaría)' AS motivo, count(*) AS n FROM public.avisos_vistos HAVING count(*) > 0;
--     SELECT 'M1: avisos con la forma nueva' AS motivo, count(*) AS n FROM public.avisos_clinica
--      WHERE cita_id IS NULL OR destinatario_id IS NOT NULL OR actor_id IS NOT NULL OR medico_id IS NOT NULL
--         OR datos IS NOT NULL
--         OR tipo NOT IN ('reserva_enlace', 'cancelacion_paciente', 'reagendado_paciente', 'google_por_asignar',
--                         'empalme_google', 'google_movimiento_rechazado', 'confirmacion_paciente')
--     HAVING count(*) > 0;
--   Ojo: los avisos confirmacion_paciente/cancelacion_paciente que nacieron del
--   «Sí»/«No» de Google tienen la forma de F4 y no cuentan: se quedan.
-- RIESGO / BLOQUEOS: SHARE ROW EXCLUSIVE sobre appointments, agenda_bloqueos,
--   cita_correos, clinica_conexiones_google y gcal_sync_estado (DROP TRIGGER) y
--   ACCESS EXCLUSIVE sobre avisos_clinica (parte B), hasta el COMMIT;
--   lock_timeout 5 s (si no los obtiene, aborta sin cambiar nada).
-- SEGUNDA PASADA: no hace nada y sale bien (IF EXISTS).
-- Ensayo: stack local, 2026-11-24: ida, reversa (sin filas: A y B; con filas: sólo A), ida otra vez.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

DROP TABLE IF EXISTS pg_temp._reversa_m1;
CREATE TEMP TABLE _reversa_m1 (parte_b text NOT NULL);

DO $$
DECLARE
  v_n integer := 0;
BEGIN
  -- ── Parte A: lo que escribe y lo que publica ─────────────────────────
  DROP TRIGGER IF EXISTS trg_appointments_aviso_alta_personal ON public.appointments;
  DROP TRIGGER IF EXISTS trg_appointments_aviso_cambio ON public.appointments;
  IF to_regclass('public.agenda_bloqueos') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_agenda_bloqueos_aviso_alta ON public.agenda_bloqueos;
    DROP TRIGGER IF EXISTS trg_agenda_bloqueos_aviso_baja ON public.agenda_bloqueos;
  END IF;
  IF to_regclass('public.cita_correos') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_cita_correos_aviso_clinica ON public.cita_correos;
  END IF;
  IF to_regclass('public.clinica_conexiones_google') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_conexiones_google_aviso_clinica ON public.clinica_conexiones_google;
  END IF;
  IF to_regclass('public.gcal_sync_estado') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_gcal_sync_estado_aviso_clinica ON public.gcal_sync_estado;
  END IF;
  DROP FUNCTION IF EXISTS public.aviso_clinica_de_cambio_cita();
  DROP FUNCTION IF EXISTS public.aviso_clinica_de_bloqueo();
  DROP FUNCTION IF EXISTS public.aviso_clinica_de_correo();
  DROP FUNCTION IF EXISTS public.aviso_clinica_de_conexion_google();
  DROP FUNCTION IF EXISTS public.aviso_clinica_de_sync_google();
  DROP FUNCTION IF EXISTS public.aviso_clinica_registrar(uuid, text, uuid, uuid, uuid, text);
  DROP FUNCTION IF EXISTS public.avisos_pendientes(text[], integer);
  IF to_regclass('public.avisos_clinica') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_avisos_clinica_reabrir ON public.avisos_clinica;
  END IF;
  DROP FUNCTION IF EXISTS public.aviso_clinica_reabrir();
  -- avisos_vistos: sólo si está vacía. Con filas se queda (inerte: ya nadie la lee).
  IF to_regclass('public.avisos_vistos') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.avisos_vistos' INTO v_n;
    IF v_n = 0 THEN
      DROP TABLE public.avisos_vistos;
      DROP FUNCTION IF EXISTS public.aviso_visto_sellar();
    END IF;
    v_n := 0;
  END IF;

  IF to_regclass('public.avisos_clinica') IS NULL THEN
    INSERT INTO pg_temp._reversa_m1 VALUES ('no aplica: avisos_clinica no existe');
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
                AND tablename = 'avisos_clinica') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.avisos_clinica;
  END IF;

  -- ── Parte B: la forma de F4, sólo si ninguna fila usa la nueva ───────
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'avisos_clinica'
                    AND column_name = 'destinatario_id') THEN
    INSERT INTO pg_temp._reversa_m1 VALUES ('ya estaba en la forma de F4');
    RETURN;
  END IF;
  -- Con el candado puesto: nadie escribe un aviso entre la cuenta y el ALTER.
  LOCK TABLE public.avisos_clinica IN ACCESS EXCLUSIVE MODE;
  EXECUTE $q$SELECT count(*) FROM public.avisos_clinica
              WHERE cita_id IS NULL OR destinatario_id IS NOT NULL OR actor_id IS NOT NULL OR medico_id IS NOT NULL
                 OR datos IS NOT NULL
                 OR tipo NOT IN ('reserva_enlace', 'cancelacion_paciente', 'reagendado_paciente', 'google_por_asignar',
                                 'empalme_google', 'google_movimiento_rechazado', 'confirmacion_paciente')$q$ INTO v_n;
  IF v_n > 0 THEN
    INSERT INTO pg_temp._reversa_m1 VALUES (format('NO HECHA: %s aviso(s) usan la forma de M1; la tabla la conserva', v_n));
    RETURN;
  END IF;
  DROP POLICY IF EXISTS avisos_clinica_select ON public.avisos_clinica;
  DROP POLICY IF EXISTS avisos_clinica_update ON public.avisos_clinica;
  DROP INDEX IF EXISTS public.avisos_clinica_sin_cita_key;
  ALTER TABLE public.avisos_clinica
    DROP CONSTRAINT IF EXISTS avisos_clinica_cita_tipo_check,
    DROP CONSTRAINT IF EXISTS avisos_clinica_datos_check,
    DROP CONSTRAINT IF EXISTS avisos_clinica_tipo_check,
    DROP COLUMN destinatario_id, DROP COLUMN actor_id, DROP COLUMN medico_id, DROP COLUMN datos,
    ALTER COLUMN cita_id SET NOT NULL,
    ADD CONSTRAINT avisos_clinica_tipo_check CHECK (tipo IN ('reserva_enlace', 'cancelacion_paciente', 'reagendado_paciente',
                                                             'google_por_asignar', 'empalme_google', 'google_movimiento_rechazado',
                                                             'confirmacion_paciente'));
  -- Las policies y los comentarios, tal como los dejó F4.
  CREATE POLICY avisos_clinica_select ON public.avisos_clinica FOR SELECT TO authenticated
    USING (clinica_id = public.get_clinica_id()
           AND EXISTS (SELECT 1 FROM public.appointments a
                        WHERE a.id = avisos_clinica.cita_id AND a.clinica_id = public.get_clinica_id()));
  CREATE POLICY avisos_clinica_update ON public.avisos_clinica FOR UPDATE TO authenticated
    USING (clinica_id = public.get_clinica_id() AND revisado_en IS NULL
           AND EXISTS (SELECT 1 FROM public.appointments a
                        WHERE a.id = avisos_clinica.cita_id AND a.clinica_id = public.get_clinica_id()))
    WITH CHECK (clinica_id = public.get_clinica_id() AND revisado_por = auth.uid());
  COMMENT ON TABLE public.avisos_clinica IS
    'Agenda v2: lo que pasó en la agenda sin que nadie de la clínica lo hiciera (reserva por enlace; cancelación, confirmación y reagendado del paciente; evento de Google por asignar; empalme con Google; movimiento rechazado de Google). Se conserva hasta que alguien del personal lo revisa (revisado_en/revisado_por) y después queda como registro. Sólo la escriben los disparadores aviso_clinica_de_* (dueño postgres); el personal sólo marca revisado. Sin FK a appointments a propósito (como reserva_empalmes_google): el lector cruza con appointments.';
  COMMENT ON COLUMN public.avisos_clinica.cita_id IS
    'La cita del aviso. SIN FK a appointments a propósito: es un aviso y no debe impedir nada sobre la cita (con RESTRICT, borrar un evento sin paciente, que la v2 permite, fallaría por un aviso que nadie ve); el lector cruza con appointments y, si la cita ya no existe, la policy no muestra la fila. Por eso puede quedar huérfano: quien limpie citas (semilla, scripts) lo borra a mano (auditoría ronda 1, A9).';
  INSERT INTO pg_temp._reversa_m1 VALUES ('hecha');
END $$;

COMMIT;

SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO' WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'disparadores de M1 que quedan' AS comprobacion,
         (SELECT count(*)::text FROM pg_trigger g WHERE NOT g.tgisinternal
             AND g.tgname IN ('trg_appointments_aviso_alta_personal', 'trg_appointments_aviso_cambio',
                              'trg_agenda_bloqueos_aviso_alta', 'trg_agenda_bloqueos_aviso_baja',
                              'trg_cita_correos_aviso_clinica', 'trg_conexiones_google_aviso_clinica',
                              'trg_gcal_sync_estado_aviso_clinica')) AS valor,
         '0' AS esperado
  UNION ALL
  SELECT 2, 'funciones de M1 que quedan',
         (SELECT count(*)::text FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
             AND p.proname IN ('aviso_clinica_de_cambio_cita', 'aviso_clinica_de_bloqueo', 'aviso_clinica_de_correo',
                               'aviso_clinica_de_conexion_google', 'aviso_clinica_de_sync_google', 'aviso_clinica_registrar',
                               'aviso_clinica_reabrir', 'avisos_pendientes')),
         '0'
  UNION ALL
  SELECT 3, 'escritores de F4, intactos (6 DEFINER + aviso_clinica_revisar)',
         (SELECT count(*)::text FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'aviso\_clinica\_%'),
         CASE WHEN to_regclass('public.avisos_clinica') IS NULL THEN NULL ELSE '7' END
  UNION ALL
  SELECT 4, 'avisos_clinica en la publicación supabase_realtime',
         (SELECT count(*)::text FROM pg_publication_tables
           WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'avisos_clinica'),
         '0'
  UNION ALL
  -- «hecha», «ya estaba…» o «no aplica…» son buenas; «NO HECHA: …» sale como REVISAR.
  SELECT 5, 'avisos_vistos (se borra sólo vacía; con filas se queda, inerte)',
         CASE WHEN to_regclass('public.avisos_vistos') IS NULL THEN 'borrada' ELSE 'SE QUEDA: tiene filas' END, 'borrada'
  UNION ALL
  SELECT 6, 'parte B (la forma de F4)', (SELECT parte_b FROM pg_temp._reversa_m1 LIMIT 1),
         (SELECT CASE WHEN parte_b LIKE 'NO HECHA%' THEN 'hecha' ELSE parte_b END FROM pg_temp._reversa_m1 LIMIT 1)
) t
ORDER BY t.n;
