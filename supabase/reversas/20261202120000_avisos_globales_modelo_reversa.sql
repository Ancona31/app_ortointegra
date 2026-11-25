-- ═══════════════════════════════════════════════════════════════════════
-- REVERSA de M1 (20261202120000_avisos_globales_modelo.sql)
-- NO es una migración: vive fuera de supabase/migrations/. Se corre a mano (o
-- con supabase/produccion/plan/aplicar.sh reversa) y SÓLO si Angel lo pide.
-- ═══════════════════════════════════════════════════════════════════════
-- QUÉ HACE: quita TODO lo que creó M1 y sólo eso: sus 7 disparadores, sus 5
--   funciones de disparador, la RPC aviso_clinica_registrar, el disparador de
--   reabrir y su función, las lecturas avisos_pendientes y avisos_mas_antiguos, la tabla avisos_vistos
--   (con su función y sus disparadores) y devuelve avisos_clinica a la forma de
--   F4 (sus dos policies, cita_id NOT NULL, el CHECK de 7 tipos; fuera el
--   índice, los dos CHECK y las 4 columnas). Los 7 escritores de F4 no se tocan.
-- QUÉ SE PIERDE MIENTRAS TANTO: los avisos del personal, de Google («Sí», «No»,
--   mover, borrar, desconexión), de correos fallidos y de reservas frenadas, y
--   el «revisado» por usuario (vuelve a ser por clínica). El código nuevo lo
--   tolera: sin avisos_pendientes ni avisos_vistos (PGRST202 / PGRST205) lee y
--   marca como antes; sin la RPC, no avisa y sigue.
-- DATOS: si hay marcas de visto (avisos_vistos) o avisos con la forma de M1
--   (sin cita, dirigidos, con actor, con datos o de un tipo nuevo), la reversa
--   SE NIEGA sin tocar nada: deshacerla los perdería o dejaría la tabla en una
--   forma que F4 no admite. Para seguir de todos modos (tras respaldar), la
--   misma confirmación que las demás reversas, en la MISMA transacción:
--       BEGIN;
--       SET LOCAL spinus.reversa_con_datos = 'si';
--       \i supabase/reversas/20261202120000_avisos_globales_modelo_reversa.sql
--   Con ella: avisos_vistos se borra CON sus filas (las marcas de visto se
--   pierden) y los avisos con la forma de M1 NO SE BORRAN: avisos_clinica
--   CONSERVA la forma de M1 (columnas, CHECK de 19 tipos y sus policies, que
--   siguen ocultando lo dirigido) y la rejilla lo dice. Es un superconjunto de
--   la de F4 y sigue siendo seguro; en la cadena completa, la reversa de F4
--   borra después la tabla entera.
-- EL CAMINO DE VUELTA DESDE LA «FORMA CONSERVADA» (sin borrar ningún aviso): la
--   IDA de M1 se puede volver a aplicar tal cual. Su pre-vuelo reconoce este
--   estado exacto (las cuatro columnas y nada más de M1) y completa lo que
--   falta: funciones, disparadores, avisos_vistos, y vuelve a poner CHECK,
--   índice y policies. Con aplicar.sh: tras esta reversa M1 queda «pendiente»
--   (su testigo, la RPC, ya no existe y la versión sale del historial) y
--   «aplicar» la ofrece de nuevo; su rejilla dice en la fila 11 «la de M1,
--   conservada por su reversa». Lo único que no vuelve son las marcas de visto.
--   Ensayado: ida → avisos de forma nueva y marcas → reversa con confirmación
--   → ida → historial, testigo y rejilla coherentes.
-- GUARDA DE DATOS, SIN CORRER LA REVERSA (dimensión 31): consulta de SÓLO
--   LECTURA con la misma condición que la negativa de abajo; 0 filas = no se
--   negará. La copia supabase/produccion/plan/reversa-previa.sql.
--     SELECT 'M1: ' || t AS motivo, n FROM (
--       SELECT 'avisos_vistos' AS t, count(*) AS n FROM public.avisos_vistos
--       UNION ALL
--       SELECT 'avisos_clinica con la forma de M1', count(*) FROM public.avisos_clinica
--        WHERE cita_id IS NULL OR destinatario_id IS NOT NULL OR actor_id IS NOT NULL OR medico_id IS NOT NULL
--           OR datos IS NOT NULL
--           OR tipo NOT IN ('reserva_enlace', 'cancelacion_paciente', 'reagendado_paciente', 'google_por_asignar',
--                           'empalme_google', 'google_movimiento_rechazado', 'confirmacion_paciente')) x
--      WHERE n > 0;
--   Ojo: los avisos confirmacion_paciente/cancelacion_paciente que nacieron del
--   «Sí»/«No» de Google tienen la forma de F4 y no cuentan: se quedan.
-- ORDEN EN LA CADENA: después de la de M2 (que exige M1) y ANTES que la de
--   20261201180000 y las de F5b … F1: la de F4 borra avisos_clinica y los
--   disparadores de M1 en otras tablas quedarían escribiendo en una tabla que no
--   existe (cada uno dejaría un WARNING por escritura; ninguna escritura fallaría).
-- RIESGO / BLOQUEOS: ACCESS EXCLUSIVE (lo que pide DROP TRIGGER: frena también
--   las lecturas) sobre appointments, agenda_bloqueos, cita_correos,
--   clinica_conexiones_google y gcal_sync_estado, y sobre avisos_clinica y
--   avisos_vistos, hasta el COMMIT. Se piden TODOS AL PRINCIPIO y EN EL ORDEN DE
--   LOS ESCRITORES (primero las tablas de origen, luego avisos_clinica, al final
--   avisos_vistos), el mismo de la ida: una reserva en curso tiene appointments y
--   pide avisos_clinica, y pedirlos al revés es un interbloqueo posible.
--   lock_timeout 5 s (si no los obtiene, aborta sin cambiar nada); lo que el
--   orden no cubra (una lectura de la campana toma avisos_clinica y luego
--   avisos_vistos; marcar visto, al revés) lo resuelve el detector de
--   interbloqueos abortando ESTA reversa, sin dejar nada. Una sola transacción.
--   Se corre con la v2 APAGADA en todas las clínicas (aplicar.sh lo exige).
-- SEGUNDA PASADA: no hace nada y sale bien (IF EXISTS).
-- Ensayo: stack local, 2026-11-25: ida → reversa → ida; con datos, se niega; con
--   la confirmación, sigue, conserva la forma y la ida vuelve a entrar. También
--   con aplicar.sh en modo ensayo.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

DROP TABLE IF EXISTS pg_temp._reversa_m1;
CREATE TEMP TABLE _reversa_m1 (forma text NOT NULL);

DO $$
DECLARE
  v_vistos integer := 0;
  v_forma  integer := 0;
  v_con    boolean := coalesce(current_setting('spinus.reversa_con_datos', true), '') = 'si';
  v_tiene  boolean := to_regclass('public.avisos_clinica') IS NOT NULL
                      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
                                     AND table_name = 'avisos_clinica' AND column_name = 'destinatario_id');
BEGIN
  IF NOT pg_has_role(current_user, 'postgres', 'USAGE') THEN
    RAISE EXCEPTION 'REVERSA ABORTADA: hay que correrla como el rol postgres (current_user es %).', current_user;
  END IF;

  -- ── Los candados, TODOS aquí y en el orden de los escritores (origen → avisos_clinica →
  --    avisos_vistos), antes de mirar ni tocar nada. ACCESS EXCLUSIVE: lo que pide DROP TRIGGER.
  LOCK TABLE public.appointments IN ACCESS EXCLUSIVE MODE;
  IF to_regclass('public.agenda_bloqueos') IS NOT NULL THEN LOCK TABLE public.agenda_bloqueos IN ACCESS EXCLUSIVE MODE; END IF;
  IF to_regclass('public.cita_correos') IS NOT NULL THEN LOCK TABLE public.cita_correos IN ACCESS EXCLUSIVE MODE; END IF;
  IF to_regclass('public.clinica_conexiones_google') IS NOT NULL THEN LOCK TABLE public.clinica_conexiones_google IN ACCESS EXCLUSIVE MODE; END IF;
  IF to_regclass('public.gcal_sync_estado') IS NOT NULL THEN LOCK TABLE public.gcal_sync_estado IN ACCESS EXCLUSIVE MODE; END IF;
  IF to_regclass('public.avisos_clinica') IS NOT NULL THEN LOCK TABLE public.avisos_clinica IN ACCESS EXCLUSIVE MODE; END IF;
  IF to_regclass('public.avisos_vistos') IS NOT NULL THEN LOCK TABLE public.avisos_vistos IN ACCESS EXCLUSIVE MODE; END IF;

  -- ── Guarda de datos, ANTES de tocar nada, con las tablas ya bloqueadas ──
  IF to_regclass('public.avisos_vistos') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.avisos_vistos' INTO v_vistos;
  END IF;
  IF v_tiene THEN
    EXECUTE $q$SELECT count(*) FROM public.avisos_clinica
                WHERE cita_id IS NULL OR destinatario_id IS NOT NULL OR actor_id IS NOT NULL OR medico_id IS NOT NULL
                   OR datos IS NOT NULL
                   OR tipo NOT IN ('reserva_enlace', 'cancelacion_paciente', 'reagendado_paciente', 'google_por_asignar',
                                   'empalme_google', 'google_movimiento_rechazado', 'confirmacion_paciente')$q$ INTO v_forma;
  END IF;
  IF v_vistos + v_forma > 0 THEN
    IF NOT v_con THEN
      RAISE EXCEPTION 'REVERSA ABORTADA: hay datos de los avisos que se perderían (avisos_vistos: %; avisos_clinica con la forma de M1: %). Respáldalos y, si aun así quieres seguir, repite con SET LOCAL spinus.reversa_con_datos = ''si'' en la misma transacción (ver la cabecera).', v_vistos, v_forma;
    END IF;
    RAISE WARNING 'REVERSA CON DATOS (spinus.reversa_con_datos = si): se borran % marca(s) de avisos_vistos; % aviso(s) con la forma de M1 se CONSERVAN (la tabla no vuelve a la forma de F4; la ida de M1 se puede volver a aplicar desde ahí).', v_vistos, v_forma;
  END IF;

  -- ── Lo que escribe y lo que lee ──
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
  IF to_regclass('public.avisos_clinica') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_avisos_clinica_reabrir ON public.avisos_clinica;
  END IF;
  DROP FUNCTION IF EXISTS public.aviso_clinica_de_cambio_cita();
  DROP FUNCTION IF EXISTS public.aviso_clinica_de_bloqueo();
  DROP FUNCTION IF EXISTS public.aviso_clinica_de_correo();
  DROP FUNCTION IF EXISTS public.aviso_clinica_de_conexion_google();
  DROP FUNCTION IF EXISTS public.aviso_clinica_de_sync_google();
  DROP FUNCTION IF EXISTS public.aviso_clinica_registrar(uuid, text, uuid, uuid, uuid, text);
  DROP FUNCTION IF EXISTS public.aviso_clinica_reabrir();
  DROP FUNCTION IF EXISTS public.avisos_pendientes(text[], integer);
  DROP FUNCTION IF EXISTS public.avisos_mas_antiguos(text[]);
  DROP TABLE IF EXISTS public.avisos_vistos;
  DROP FUNCTION IF EXISTS public.aviso_visto_sellar();

  -- ── La forma de F4, salvo que queden avisos con la de M1 (sólo se llega aquí con la confirmación) ──
  IF NOT v_tiene THEN
    INSERT INTO pg_temp._reversa_m1 VALUES ('la de F4');
    RETURN;
  END IF;
  IF v_forma > 0 THEN
    INSERT INTO pg_temp._reversa_m1 VALUES (format('la de M1, CONSERVADA con confirmación: %s aviso(s) la usan', v_forma));
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
  INSERT INTO pg_temp._reversa_m1 VALUES ('la de F4');
END $$;

COMMIT;

-- Ninguna fila dice REVISAR si la reversa hizo lo que debía: «CONSERVADA con confirmación» es un
-- resultado previsto (lo eligió quien confirmó la pérdida de datos) y va como INFO.
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO' WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'disparadores de M1 que quedan' AS comprobacion,
         (SELECT count(*)::text FROM pg_trigger g WHERE NOT g.tgisinternal
             AND g.tgname IN ('trg_appointments_aviso_alta_personal', 'trg_appointments_aviso_cambio',
                              'trg_agenda_bloqueos_aviso_alta', 'trg_agenda_bloqueos_aviso_baja',
                              'trg_cita_correos_aviso_clinica', 'trg_conexiones_google_aviso_clinica',
                              'trg_gcal_sync_estado_aviso_clinica', 'trg_avisos_clinica_reabrir')) AS valor,
         '0' AS esperado
  UNION ALL
  SELECT 2, 'funciones de M1 que quedan',
         (SELECT count(*)::text FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
             AND p.proname IN ('aviso_clinica_de_cambio_cita', 'aviso_clinica_de_bloqueo', 'aviso_clinica_de_correo',
                               'aviso_clinica_de_conexion_google', 'aviso_clinica_de_sync_google', 'aviso_clinica_registrar',
                               'aviso_clinica_reabrir', 'avisos_pendientes', 'avisos_mas_antiguos', 'aviso_visto_sellar')),
         '0'
  UNION ALL
  SELECT 3, 'escritores de F4, intactos (6 DEFINER + aviso_clinica_revisar)',
         (SELECT count(*)::text FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'aviso\_clinica\_%'),
         CASE WHEN to_regclass('public.avisos_clinica') IS NULL THEN NULL ELSE '7' END
  UNION ALL
  SELECT 4, 'tabla avisos_vistos', (to_regclass('public.avisos_vistos') IS NOT NULL)::text, 'false'
  UNION ALL
  SELECT 5, 'forma de avisos_clinica', (SELECT forma FROM pg_temp._reversa_m1 LIMIT 1),
         (SELECT CASE WHEN forma = 'la de F4' THEN 'la de F4' END FROM pg_temp._reversa_m1 LIMIT 1)
) t
ORDER BY t.n;
