-- ═══════════════════════════════════════════════════════════════════════
-- Avisos globales · M1 — modelo de avisos para toda la app y escritores nuevos
-- Rama: feature/avisos-globales · Escrita: 2026-11-24
-- Plan: docs/spec/avisos-globales/PLAN.md (§1 y §2)
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: 2026-11-25 (versión corregida tras la PRIMERA auditoría independiente y el primer
--   ensayo sobre el clon, «apta con reservas»), stack local de Supabase (CLI 2.117.0) con las 14
--   migraciones anteriores: aplicada, deshecha con su reversa y vuelta a
--   aplicar, también desde la «forma conservada» (ver «RE-APLICABLE»); pruebas
--   av1_avisos_globales.sql y av3_avisos_no_impiden.sql en verde; mediciones en
--   supabase/pruebas-sql/medicion/ (resultados en docs/spec/avisos-globales/).
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR. PENDIENTE DEL SEGUNDO ENSAYO SOBRE EL
--   CLON Y DE LA SEGUNDA AUDITORÍA (supabase/AUDITORIA-MIGRACIONES.md).
--   La aplica Angel, con supabase/produccion/plan/aplicar.sh, tras su orden.
--
-- QUÉ HACE (todo aditivo; no borra ni reescribe ninguna fila)
--   1. avisos_clinica gana cuatro columnas NULL y sin DEFAULT:
--        destinatario_id  NULL = toda la clínica (lo de hoy); con valor, sólo
--                         ese usuario ve el aviso.
--        actor_id         quién lo hizo (atribución, sin FK, como revisado_por);
--                         quien lo hizo NUNCA ve su propio aviso (policy).
--        medico_id        el dueño de la agenda en los avisos SIN cita.
--        datos            jsonb con contadores y horas; y, SÓLO en reserva_frenada,
--                         el nombre que tecleó quien intentó reservar.
--   2. cita_id admite NULL (avisos sin cita) y un CHECK liga tipo ↔ cita.
--   3. avisos_clinica_tipo_check pasa de 7 a 19 tipos.
--   4. Un índice único para agrupar los avisos sin cita que se repiten.
--   5. Las dos policies se recrean. Con las columnas nuevas en NULL son
--      EXACTAMENTE las de F4: el código de antes ve lo mismo.
--   6. «REVISADO» POR USUARIO (decisión de Angel, 2026-11-24): tabla nueva
--      avisos_vistos (aviso_id, usuario_id, visto_en), con su RLS (cada quien
--      sólo lo suyo). Un aviso está PENDIENTE PARA MÍ si no lo he visto o si
--      cambió después de que lo vi (visto_en < creado_en). Lo lee
--      avisos_pendientes(tipos, límite), con la sesión y bajo RLS, ACOTADA: sólo
--      los de los últimos 60 días y, de esos, los 500 más nuevos (ver la función).
--      avisos_mas_antiguos(tipos) dice si quedan avisos FUERA de eso, para que
--      la campana lo diga («hay avisos más antiguos») en vez de callarlo.
--      revisado_en/revisado_por SE QUEDAN y significan «cerrado para todos»:
--      el código de antes los sigue escribiendo durante el despliegue; el
--      nuevo ya no. Nada se borra ni se convierte.
--   7. Reabrir: trg_avisos_clinica_reabrir (BEFORE INSERT). Si ya hay un aviso
--      sin cerrar del mismo tipo y cita, le pone creado_en = la hora real (vuelve a
--      estar pendiente para quien ya lo había visto) y se salta el alta. Así
--      los SEIS escritores de F4 reabren sin tocarlos: su ON CONFLICT DO
--      NOTHING ya no llega a evaluarse. Si la fila está tomada por otra
--      transacción NO espera (se salta el alta); si el refresco falla NO lanza:
--      deja seguir el alta, que es la de F4, como antes de M1.
--   8. Cinco funciones de disparador (DEFINER de postgres, search_path vacío) y
--      siete disparadores, en appointments, agenda_bloqueos, cita_correos,
--      clinica_conexiones_google y gcal_sync_estado.
--   9. La RPC aviso_clinica_registrar (sólo service_role) para lo que el
--      servidor escribe sin sesión de base: la reserva frenada (con el nombre
--      que tecleó la persona), el «Reagendar» del personal y el «No» de Google
--      en la última hora.
--   NO toca Realtime: avisos_clinica NO entra en la publicación supabase_realtime
--   (decisión de Angel, 2026-11-25: la campana se entera releyendo cada 2
--   minutos con la pestaña a la vista; nada la escucha, así que publicarla
--   sería carga y superficie sin uso, y los DELETE de una publicación llegan a
--   todo suscrito sin pasar por la RLS).
--   NO toca: los seis escritores de F4, reservar_por_enlace, cita_rsvp_google,
--   log_cita_change, ninguna policy de otra tabla, ni el índice
--   avisos_clinica_pendiente_key.
--
-- ⚠️ UN AVISO NUNCA IMPIDE UNA ESCRITURA. En las cinco funciones de disparador
--   nuevas y en la de reabrir (que corre DENTRO de los seis escritores de F4),
--   TODO lo que puede fallar va en un subbloque BEGIN … EXCEPTION WHEN OTHERS:
--   leer la sesión (auth.uid()), el interruptor (agenda_v2_encendida) y el alta
--   o el refresco del aviso. Deja un RAISE WARNING (tipo y SQLSTATE, sin datos
--   de nadie) y la escritura de origen sigue. Los WHEN de los disparadores sólo
--   comparan columnas: no llaman a ninguna función. Lo prueban el caso 9 de av1
--   y av3_avisos_no_impiden.sql (reserva por enlace, respuesta de confirmación y
--   cancelación del paciente, con el reabrir forzado a fallar).
--   LO QUE POR NATURALEZA NO SE PUEDE ATRAPAR (y aborta la escritura de origen,
--   con o sin M1, como cualquier otro disparador de la tabla):
--     · la cancelación de la sentencia: statement_timeout o pg_cancel_backend
--       (57014). WHEN OTHERS no atrapa QUERY_CANCELED (ni ASSERT_FAILURE): el
--       tiempo de estos disparadores cuenta dentro de la sentencia de origen;
--     · el fin de la sesión o del servidor (pg_terminate_backend, caída, falta
--       de memoria del proceso);
--     · un fallo al ARRANCAR la función (que la hayan borrado o le falte EXECUTE
--       a quien escribe): lo comprueba el post-vuelo, no la función.
--   Y lo que no bloquea: el refresco de reabrir usa FOR UPDATE SKIP LOCKED y,
--   habiendo ya un aviso, se salta el alta: dos hechos simultáneos de la misma
--   cita no se esperan uno al otro (comprobado con dos sesiones).
-- ⚠️ SIN RECURSIÓN DE RLS (dimensión 19): las policies leen appointments y
--   helpers DEFINER sobre profiles; ninguna lee avisos_clinica.
-- ⚠️ «Quién lo hizo» es auth.uid() (la sesión) o, sin sesión, lo que marcan las
--   RPC de service_role con spinus.via ('google', 'google_rsvp'): la misma
--   regla de log_cita_change. PostgREST no deja a una sesión fijar spinus.via.
--
-- Depende de: F5a (agenda_bloqueos), F2 (gcal_sync_estado), F4 (avisos_clinica,
--   cita_correos), F1 (agenda_v2_encendida) y 20261126120000 (prohibir_truncate).
--   Sólo actúa con la v2 encendida.
-- Bloqueos (lock_timeout 5 s): TODOS se piden AL PRINCIPIO, en el pre-vuelo, y
--   EN EL ORDEN DE LOS ESCRITORES (primero la tabla de origen, al final
--   avisos_clinica), para no cruzarse con una reserva o una confirmación en
--   curso, que toman appointments y DESPUÉS avisos_clinica:
--     1.º SHARE ROW EXCLUSIVE (frena escrituras, no lecturas; lo que pide
--         CREATE TRIGGER) sobre appointments, agenda_bloqueos, cita_correos,
--         clinica_conexiones_google y gcal_sync_estado, en ese orden;
--     2.º ACCESS EXCLUSIVE sobre avisos_clinica (ALTER TABLE; tabla pequeña: las
--         cuatro columnas y el DROP NOT NULL son sólo catálogo, los tres CHECK
--         la recorren).
--   Se sostienen hasta el COMMIT. Si alguno no se obtiene en 5 s, aborta sin
--   cambiar nada. Lo que el orden NO puede garantizar: una transacción que tome
--   dos de las cinco tablas de origen en otro orden (no conozco ninguna); la
--   cubren el lock_timeout y el detector de interbloqueos (aborta ESTA
--   migración, sin dejar nada).
-- Ventana de despliegue: MIGRACIÓN PRIMERO, CÓDIGO DESPUÉS. El código de antes
--   pide sólo los tipos que conoce (leerAvisosClinica) y nunca ve un aviso sin
--   cita (cruza con appointments). El código nuevo tolera la base sin M1.
-- Riesgo: MEDIO. Disparador nuevo en appointments (costo medido) y dos policies
--   recreadas en la misma transacción.
-- No re-ejecutable SOBRE SÍ MISMA: una segunda pasada con M1 aplicada ABORTA en
--   el pre-vuelo sin cambiar nada.
-- RE-APLICABLE TRAS SU REVERSA, TAMBIÉN DESDE LA «FORMA CONSERVADA»: la reversa
--   con confirmación (spinus.reversa_con_datos) quita disparadores, funciones y
--   avisos_vistos pero CONSERVA en avisos_clinica las columnas, los CHECK, el
--   índice y las policies de M1 si quedan avisos que los usan (no borra avisos).
--   El pre-vuelo reconoce ese estado EXACTO (las cuatro columnas con su tipo y
--   NADA más de M1: ni funciones, ni disparadores, ni avisos_vistos) y completa
--   lo que falta: la sección 2 está escrita para dar el mismo resultado desde
--   la forma de F4 y desde la conservada. Cualquier otro estado intermedio
--   aborta («a medias»). La rejilla dice de cuál partió (fila 11).
-- Vuelta atrás: supabase/reversas/20261202120000_avisos_globales_modelo_reversa.sql
-- Prueba: supabase/pruebas-sql/av1_avisos_globales.sql
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS pg_temp._m1_partida;
CREATE TEMP TABLE _m1_partida (forma text NOT NULL);

DO $$
DECLARE
  c_mias CONSTANT text[] := ARRAY['aviso_clinica_de_cambio_cita', 'aviso_clinica_de_bloqueo', 'aviso_clinica_de_correo',
    'aviso_clinica_de_conexion_google', 'aviso_clinica_de_sync_google', 'aviso_clinica_registrar',
    'aviso_clinica_reabrir', 'avisos_pendientes', 'avisos_mas_antiguos', 'aviso_visto_sellar'];
  c_tablas CONSTANT text[] := ARRAY['avisos_clinica', 'appointments', 'agenda_bloqueos', 'cita_correos',
    'clinica_conexiones_google', 'gcal_sync_estado', 'agenda_ajustes', 'profiles'];
  c_disparadores CONSTANT text[] := ARRAY['trg_appointments_aviso_alta_personal', 'trg_appointments_aviso_cambio',
    'trg_agenda_bloqueos_aviso_alta', 'trg_agenda_bloqueos_aviso_baja', 'trg_cita_correos_aviso_clinica',
    'trg_conexiones_google_aviso_clinica', 'trg_gcal_sync_estado_aviso_clinica', 'trg_avisos_clinica_reabrir'];
  v_t text;
  v_n integer;
  v_cols integer;
  v_cols_bien integer;
BEGIN
  FOREACH v_t IN ARRAY c_tablas LOOP
    IF to_regclass('public.' || v_t) IS NULL THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: no existe public.%: aplica antes las migraciones de la agenda (20261201120000 … 20261201180000).', v_t;
    END IF;
    IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = to_regclass('public.' || v_t)), 'USAGE') THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: % no es dueño de public.%.', current_user, v_t;
    END IF;
  END LOOP;
  -- Los candados, TODOS aquí y en el orden de los escritores (origen → avisos_clinica):
  -- una reserva en curso tiene appointments y pide avisos_clinica; pedirlos al revés es
  -- un interbloqueo posible. Con lock_timeout 5 s: si no se obtienen, aborta sin cambiar nada.
  LOCK TABLE public.appointments, public.agenda_bloqueos, public.cita_correos,
             public.clinica_conexiones_google, public.gcal_sync_estado IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.avisos_clinica IN ACCESS EXCLUSIVE MODE;
  -- De dónde se parte. Sólo valen DOS estados:
  --   · la forma de F4: nada de M1 existe;
  --   · la forma de M1 CONSERVADA por su reversa con confirmación: las cuatro columnas, con su
  --     tipo, y nada más de M1 (ni funciones, ni disparadores, ni avisos_vistos).
  -- Con M1 aplicada (o a medias de cualquier otro modo), aborta.
  SELECT count(*), count(*) FILTER (WHERE (column_name, data_type) IN (('destinatario_id', 'uuid'), ('actor_id', 'uuid'),
                                                                        ('medico_id', 'uuid'), ('datos', 'jsonb')))
    INTO v_cols, v_cols_bien
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'avisos_clinica'
     AND column_name IN ('destinatario_id', 'actor_id', 'medico_id', 'datos');
  IF EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = ANY (c_mias))
     OR EXISTS (SELECT 1 FROM pg_trigger g WHERE NOT g.tgisinternal AND g.tgname = ANY (c_disparadores))
     OR to_regclass('public.avisos_vistos') IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: esta migración ya está aplicada (o a medias). No se repite: revisa la rejilla de la primera pasada o corre antes su reversa.';
  END IF;
  IF v_cols NOT IN (0, 4) OR v_cols_bien <> v_cols
     OR (v_cols = 0 AND (to_regclass('public.avisos_clinica_sin_cita_key') IS NOT NULL
                         OR EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.avisos_clinica'::regclass
                                       AND conname IN ('avisos_clinica_cita_tipo_check', 'avisos_clinica_datos_check')))) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: avisos_clinica está a medias (% de las 4 columnas de M1, % con su tipo): ni la forma de F4 ni la que conserva la reversa de M1. No se toca nada.', v_cols, v_cols_bien;
  END IF;
  INSERT INTO pg_temp._m1_partida VALUES (CASE v_cols WHEN 0 THEN 'la de F4' ELSE 'la de M1, conservada por su reversa' END);
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
  -- Desde la forma de F4: ninguna fila con un tipo fuera de los 7 de F4, ni sin cita (los CHECK nuevos
  -- las admitirían, pero no deberían existir). Desde la conservada sí las hay, por definición: las
  -- validan los CHECK de la sección 2 al volver a ponerse (si alguna no cabe, aborta ahí, sin dejar nada).
  IF v_cols = 0 THEN
    SELECT count(*) INTO v_n FROM public.avisos_clinica a
     WHERE a.cita_id IS NULL OR a.tipo NOT IN ('reserva_enlace', 'cancelacion_paciente', 'reagendado_paciente',
             'google_por_asignar', 'empalme_google', 'google_movimiento_rechazado', 'confirmacion_paciente');
    IF v_n > 0 THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: hay % fila(s) de avisos_clinica que no son de F4.', v_n;
    END IF;
  ELSE
    RAISE NOTICE 'M1: avisos_clinica ya tiene la forma de M1 (la conservó su reversa con confirmación): se completa lo que falta.';
  END IF;
  -- Lo que usan las funciones nuevas.
  IF to_regprocedure('public.agenda_v2_encendida(uuid)') IS NULL OR to_regprocedure('public.get_clinica_id()') IS NULL
     OR to_regprocedure('public.get_my_role()') IS NULL OR to_regprocedure('public.soy_admin_de_clinica()') IS NULL
     OR to_regprocedure('auth.uid()') IS NULL OR to_regprocedure('public.prohibir_truncate()') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta agenda_v2_encendida(uuid), get_clinica_id(), get_my_role(), soy_admin_de_clinica(), auth.uid() o prohibir_truncate() (20261126120000).';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · La tabla (nueva y pequeña): columnas, CHECK, índice y policies.
--     Escrita para dar EL MISMO resultado desde la forma de F4 y desde la
--     conservada (IF NOT EXISTS / IF EXISTS): desde la conservada no añade
--     columnas y vuelve a poner CHECK, índice y policies con el texto de hoy.
-- ---------------------------------------------------------------------
ALTER TABLE public.avisos_clinica
  ADD COLUMN IF NOT EXISTS destinatario_id uuid,
  ADD COLUMN IF NOT EXISTS actor_id uuid,
  ADD COLUMN IF NOT EXISTS medico_id uuid,
  ADD COLUMN IF NOT EXISTS datos jsonb,
  ALTER COLUMN cita_id DROP NOT NULL,
  DROP CONSTRAINT avisos_clinica_tipo_check,
  DROP CONSTRAINT IF EXISTS avisos_clinica_cita_tipo_check,
  DROP CONSTRAINT IF EXISTS avisos_clinica_datos_check,
  -- ⚠️ La misma lista que TIPOS_AVISO (src/lib/avisos/avisosClinica.ts). Un
  -- tipo nuevo va aquí antes que en el código.
  ADD CONSTRAINT avisos_clinica_tipo_check CHECK (tipo IN (
    'reserva_enlace', 'cancelacion_paciente', 'reagendado_paciente', 'google_por_asignar', 'empalme_google',
    'google_movimiento_rechazado', 'confirmacion_paciente',
    'google_movio_cita', 'google_cancelo_cita', 'correo_fallido', 'personal_agendo', 'personal_movio', 'personal_cancelo',
    'paciente_no_asistira', 'reserva_frenada', 'google_desconectado', 'google_sin_sincronizar',
    'personal_bloqueo', 'personal_desbloqueo')),
  -- Los cinco tipos SIN cita no llevan cita; los demás, siempre.
  ADD CONSTRAINT avisos_clinica_cita_tipo_check CHECK (
    (tipo IN ('reserva_frenada', 'google_desconectado', 'google_sin_sincronizar',
              'personal_bloqueo', 'personal_desbloqueo')) = (cita_id IS NULL)),
  -- El nombre sólo cabe en reserva_frenada, y acotado como reserva_nombre (120).
  ADD CONSTRAINT avisos_clinica_datos_check CHECK (
    datos IS NULL OR (jsonb_typeof(datos) = 'object'
      AND (NOT datos ? 'nombre' OR (tipo = 'reserva_frenada' AND jsonb_typeof(datos -> 'nombre') = 'string'
                                    AND char_length(datos ->> 'nombre') BETWEEN 1 AND 120))));

COMMENT ON COLUMN public.avisos_clinica.destinatario_id IS
  'Avisos globales: NULL = el aviso es de toda la clínica (quien vea la cita). Con valor, SÓLO ese usuario lo ve (ni el administrador): lo que el personal hace en la agenda de un médico. Sin FK, como revisado_por. Lo imponen las policies avisos_clinica_select/_update.';
COMMENT ON COLUMN public.avisos_clinica.actor_id IS
  'Avisos globales: quién hizo lo que el aviso cuenta (auth.uid() del disparador, o el actor que pasa el servidor a aviso_clinica_registrar). Atribución sin FK. CONVENIO: quien lo hizo no ve su propio aviso (policy: actor_id IS DISTINCT FROM auth.uid()).';
COMMENT ON COLUMN public.avisos_clinica.medico_id IS
  'Avisos globales: el dueño de la agenda en los avisos SIN cita (reserva_frenada, personal_bloqueo, personal_desbloqueo); NULL en los de toda la clínica (google_desconectado, google_sin_sincronizar). En los avisos CON cita no se usa: el médico es el de la cita. Sin FK.';
COMMENT ON COLUMN public.avisos_clinica.datos IS
  'Avisos globales: objeto jsonb con contadores y horas del aviso: {"intentos": n}, {"inicio": ts, "fin": ts, "todo_el_dia": bool, "zona": text}. ÚNICA EXCEPCIÓN con un dato de persona (decisión de Angel, 2026-11-24): en reserva_frenada, {"nombre": text} = el nombre que TECLEÓ quien intentó reservar por enlace (puede no ser real; recortado, de 1 a 120 caracteres, como appointments.reserva_nombre; lo impone avisos_clinica_datos_check). CONVENIO QUE LA BASE NO IMPONE: nada más de personas ni nada clínico (ni teléfono, ni correo, ni motivo, ni tipo de cita). Lo pinta textoAviso (src/lib/avisos/avisosClinica.ts).';
COMMENT ON COLUMN public.avisos_clinica.cita_id IS
  'La cita del aviso; NULL en los cinco tipos sin cita (avisos_clinica_cita_tipo_check). SIN FK a appointments a propósito: es un aviso y no debe impedir nada sobre la cita; el lector cruza con appointments y, si la cita ya no existe, la policy no muestra la fila. Por eso puede quedar huérfano: quien limpie citas (semilla, scripts) lo borra a mano.';

-- Uno SIN CERRAR por clínica, tipo, médico y nombre en los avisos sin cita que
-- se repiten: los escritores usan ON CONFLICT con ESTE predicado (y, la reserva
-- frenada, suben el contador: una línea por nombre). Los de bloqueo no entran:
-- cada bloqueo es su aviso.
DROP INDEX IF EXISTS public.avisos_clinica_sin_cita_key;
CREATE UNIQUE INDEX avisos_clinica_sin_cita_key
  ON public.avisos_clinica (clinica_id, tipo, (coalesce(medico_id, '00000000-0000-0000-0000-000000000000'::uuid)),
                            (lower(coalesce(datos ->> 'nombre', ''))))
  WHERE cita_id IS NULL AND revisado_en IS NULL
    AND tipo IN ('reserva_frenada', 'google_desconectado', 'google_sin_sincronizar');

-- Las dos policies de F4, recreadas. Con destinatario_id, actor_id y cita_id
-- como en F4 (NULL, NULL, con valor) dan el mismo resultado que antes.
-- Sin recursión: leen appointments (bajo la RLS de quien pregunta: el invitado,
-- sólo las suyas) y helpers DEFINER; nunca avisos_clinica.
-- ⚠️ EL «OFFSET 0» DEL EXISTS NO ES RUIDO: no cambia qué filas se ven. Obliga a
--   buscar la cita de CADA aviso por su llave. Sin él, Postgres puede resolver
--   el EXISTS leyendo de una vez TODAS las citas de la clínica (subplan «hashed»),
--   y la lectura de la campana costaba lo que pesara la agenda entera de la
--   clínica: medido, 100 ms de 120 con 21 000 citas, para devolver 50 avisos.
--   Con él cuesta lo que los avisos que de verdad se miran (como mucho 500).
DROP POLICY avisos_clinica_select ON public.avisos_clinica;
CREATE POLICY avisos_clinica_select ON public.avisos_clinica FOR SELECT TO authenticated
  USING (clinica_id = public.get_clinica_id()
         AND (destinatario_id IS NULL OR destinatario_id = auth.uid())
         AND actor_id IS DISTINCT FROM auth.uid()
         AND CASE WHEN cita_id IS NOT NULL
                  THEN EXISTS (SELECT 1 FROM public.appointments a
                                WHERE a.id = avisos_clinica.cita_id AND a.clinica_id = public.get_clinica_id() OFFSET 0)
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
                                WHERE a.id = avisos_clinica.cita_id AND a.clinica_id = public.get_clinica_id() OFFSET 0)
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
  v_uid   uuid;
  v_via   text;
  v_tipo  text;
  v_movio   boolean := false;
  v_cancelo boolean := false;
  v_confirmo boolean := false;
BEGIN
  -- ⚠️ TODO dentro del subbloque: leer la sesión, el interruptor y el alta. Un fallo de
  -- cualquiera de los tres deja un WARNING y la cita se guarda igual.
  BEGIN
    v_uid := auth.uid();
    v_via := current_setting('spinus.via', true);
    -- OLD sólo existe en UPDATE: no se nombra fuera de este IF.
    IF TG_OP = 'UPDATE' THEN
      v_movio := OLD.start_time IS DISTINCT FROM NEW.start_time OR OLD.end_time IS DISTINCT FROM NEW.end_time;
      v_cancelo := NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled';
      v_confirmo := NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed';
    END IF;
    IF v_uid IS NOT NULL THEN
      -- El médico en su propia agenda (o una fila sin médico) no avisa a nadie.
      IF NEW.medico_id IS NOT NULL AND NEW.medico_id <> v_uid THEN
        v_tipo := CASE WHEN TG_OP = 'INSERT' THEN 'personal_agendo' WHEN v_cancelo THEN 'personal_cancelo'
                       WHEN v_movio AND NEW.status <> 'cancelled' THEN 'personal_movio' END;
      END IF;
    ELSIF TG_OP = 'UPDATE' AND (NEW.paciente_id IS NOT NULL OR NEW.reserva_canal IS NOT NULL) THEN
      v_tipo := CASE
        WHEN v_via = 'google_rsvp' AND v_confirmo THEN 'confirmacion_paciente'
        WHEN v_via = 'google_rsvp' AND v_cancelo THEN 'cancelacion_paciente'
        WHEN v_via = 'google' AND v_cancelo THEN 'google_cancelo_cita'
        WHEN v_via = 'google' AND v_movio AND NEW.status <> 'cancelled' THEN 'google_movio_cita' END;
    END IF;
    IF v_tipo IS NOT NULL AND public.agenda_v2_encendida(NEW.clinica_id) THEN
      -- Si ya hay uno sin cerrar de ese tipo y cita, trg_avisos_clinica_reabrir lo refresca y se salta el alta.
      INSERT INTO public.avisos_clinica (clinica_id, tipo, cita_id, destinatario_id, actor_id)
      VALUES (NEW.clinica_id, v_tipo, NEW.id,
              CASE WHEN v_tipo LIKE 'personal\_%' THEN NEW.medico_id END, CASE WHEN v_tipo LIKE 'personal\_%' THEN v_uid END)
      ON CONFLICT (tipo, cita_id) WHERE revisado_en IS NULL DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Un aviso nunca impide guardar la cita. Sin datos de nadie en el mensaje.
    RAISE WARNING 'aviso_clinica_de_cambio_cita: aviso % no escrito (SQLSTATE %)', coalesce(v_tipo, '(sin decidir)'), SQLSTATE;
  END;
  RETURN NULL;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.aviso_clinica_de_cambio_cita() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.aviso_clinica_de_cambio_cita() TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.aviso_clinica_de_cambio_cita() IS
  'Avisos globales: deja el aviso de un alta, cambio de hora o cancelación de una cita cuando (a) lo hace alguien con sesión en la agenda de OTRO médico (personal_agendo/_movio/_cancelo, dirigido sólo a ese médico, con actor) o (b) llega sin sesión marcado por las RPC de Google con spinus.via (google_rsvp: confirmacion_paciente/cancelacion_paciente; google: google_movio_cita/google_cancelo_cita, sólo citas con paciente o por ligar). El médico en su propia agenda no genera nada. Sólo con la v2 encendida. TODO lo que puede fallar (leer la sesión, el interruptor, el alta del aviso) va en un subbloque: deja un WARNING y la cita se guarda igual.';

-- agenda_bloqueos AFTER INSERT / AFTER DELETE: el personal pone o quita un
-- bloqueo en la agenda de un médico. Los de Google (service_role) no avisan.
CREATE FUNCTION public.aviso_clinica_de_bloqueo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid;
  v_b   record;
BEGIN
  BEGIN
    v_uid := auth.uid();
    IF TG_OP = 'DELETE' THEN v_b := OLD; ELSE v_b := NEW; END IF;
    -- Sin sesión (Google, el servidor) o el médico en lo suyo: nada.
    IF v_uid IS NOT NULL AND v_b.medico_id IS DISTINCT FROM v_uid AND public.agenda_v2_encendida(v_b.clinica_id) THEN
      INSERT INTO public.avisos_clinica (clinica_id, tipo, medico_id, destinatario_id, actor_id, datos)
      VALUES (v_b.clinica_id, CASE TG_OP WHEN 'DELETE' THEN 'personal_desbloqueo' ELSE 'personal_bloqueo' END,
              v_b.medico_id, v_b.medico_id, v_uid,
              jsonb_build_object('inicio', v_b.inicio, 'fin', v_b.fin, 'todo_el_dia', v_b.todo_el_dia, 'zona', v_b.zona));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'aviso_clinica_de_bloqueo: aviso no escrito (SQLSTATE %)', SQLSTATE;
  END;
  RETURN NULL;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.aviso_clinica_de_bloqueo() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.aviso_clinica_de_bloqueo() TO anon, authenticated, service_role;

-- cita_correos AFTER UPDATE OF estado: un correo al paciente que falló y ya no
-- se reintenta (correo_fallido). El envío a mano (tipo confirmacion) no avisa:
-- quien lo mandó lo ve fallar en pantalla. Un recordatorio ENVIADO no avisa
-- (decisión de Angel: lo que importa es la respuesta del paciente).
CREATE FUNCTION public.aviso_clinica_de_correo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  BEGIN
    IF public.agenda_v2_encendida(NEW.clinica_id) THEN
      INSERT INTO public.avisos_clinica (clinica_id, tipo, cita_id) VALUES (NEW.clinica_id, 'correo_fallido', NEW.appointment_id)
      ON CONFLICT (tipo, cita_id) WHERE revisado_en IS NULL DO NOTHING;
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
  BEGIN
    IF public.agenda_v2_encendida(NEW.clinica_id) THEN
      INSERT INTO public.avisos_clinica (clinica_id, tipo) VALUES (NEW.clinica_id, 'google_desconectado')
      ON CONFLICT (clinica_id, tipo, (coalesce(medico_id, '00000000-0000-0000-0000-000000000000'::uuid)),
                   (lower(coalesce(datos ->> 'nombre', ''))))
        WHERE cita_id IS NULL AND revisado_en IS NULL
          AND tipo IN ('reserva_frenada', 'google_desconectado', 'google_sin_sincronizar')
      DO UPDATE SET creado_en = clock_timestamp();
    END IF;
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
  BEGIN
    IF public.agenda_v2_encendida(NEW.clinica_id) THEN
      INSERT INTO public.avisos_clinica (clinica_id, tipo) VALUES (NEW.clinica_id, 'google_sin_sincronizar')
      ON CONFLICT (clinica_id, tipo, (coalesce(medico_id, '00000000-0000-0000-0000-000000000000'::uuid)),
                   (lower(coalesce(datos ->> 'nombre', ''))))
        WHERE cita_id IS NULL AND revisado_en IS NULL
          AND tipo IN ('reserva_frenada', 'google_desconectado', 'google_sin_sincronizar')
      DO UPDATE SET creado_en = clock_timestamp();
    END IF;
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
-- la clinica_id de la sesión o del enlace). Lista blanca de TRES tipos:
--   reserva_frenada       (p_medico_id y p_nombre): la reserva por enlace que
--                         frenó el candado o un contacto bloqueado. Una línea
--                         por nombre, con contador.
--   personal_movio        (p_cita_id y p_actor_id): «Reagendar» del personal,
--                         que escribe con service_role y no trae auth.uid().
--   paciente_no_asistira  (p_cita_id): el «No» de Google en la última hora
--                         (M2): no cancela, avisa UNA vez por cita.
-- Comprueba que médico, cita y actor son de ESA clínica, y que el médico de la
-- reserva frenada tiene rol de médico (no cualquier perfil de la clínica); si
-- no, false sin más (la misma respuesta exista o no lo referido). No lanza por datos.
CREATE FUNCTION public.aviso_clinica_registrar(p_clinica_id uuid, p_tipo text, p_cita_id uuid, p_medico_id uuid, p_actor_id uuid, p_nombre text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_medico uuid;
  -- El nombre tecleado, como reserva_nombre: recortado, sin caracteres de control, 120 como mucho.
  v_nombre text := left(btrim(regexp_replace(coalesce(p_nombre, ''), '[[:cntrl:]]+', ' ', 'g')), 120);
BEGIN
  IF p_clinica_id IS NULL OR p_tipo IS NULL OR p_tipo NOT IN ('reserva_frenada', 'personal_movio', 'paciente_no_asistira') THEN
    RAISE EXCEPTION 'aviso_clinica_registrar: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  IF NOT public.agenda_v2_encendida(p_clinica_id) THEN RETURN false; END IF;
  IF p_tipo = 'reserva_frenada' THEN
    IF p_medico_id IS NULL OR v_nombre = '' OR NOT EXISTS (SELECT 1 FROM public.profiles pr
                                                           WHERE pr.id = p_medico_id AND pr.clinica_id = p_clinica_id
                                                             AND pr.role = 'medico') THEN
      RETURN false;
    END IF;
    INSERT INTO public.avisos_clinica AS a (clinica_id, tipo, medico_id, datos)
    VALUES (p_clinica_id, 'reserva_frenada', p_medico_id, jsonb_build_object('nombre', v_nombre, 'intentos', 1))
    ON CONFLICT (clinica_id, tipo, (coalesce(medico_id, '00000000-0000-0000-0000-000000000000'::uuid)),
                 (lower(coalesce(datos ->> 'nombre', ''))))
      WHERE cita_id IS NULL AND revisado_en IS NULL
        AND tipo IN ('reserva_frenada', 'google_desconectado', 'google_sin_sincronizar')
    DO UPDATE SET creado_en = clock_timestamp(),
                  datos = a.datos || jsonb_build_object('intentos', coalesce((a.datos ->> 'intentos')::integer, 0) + 1);
    RETURN true;
  END IF;
  SELECT c.medico_id INTO v_medico FROM public.appointments c
   WHERE c.id = p_cita_id AND c.clinica_id = p_clinica_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF p_tipo = 'paciente_no_asistira' THEN
    -- Una vez por cita, la haya visto alguien o no: cada pasada de la sincronización vuelve a llamar.
    IF EXISTS (SELECT 1 FROM public.avisos_clinica a WHERE a.tipo = 'paciente_no_asistira' AND a.cita_id = p_cita_id
                  AND a.clinica_id = p_clinica_id) THEN
      RETURN false;
    END IF;
    INSERT INTO public.avisos_clinica (clinica_id, tipo, cita_id) VALUES (p_clinica_id, 'paciente_no_asistira', p_cita_id)
    ON CONFLICT (tipo, cita_id) WHERE revisado_en IS NULL DO NOTHING;
    RETURN true;
  END IF;
  IF v_medico IS NULL OR p_actor_id IS NULL OR v_medico = p_actor_id
     OR NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = p_actor_id AND pr.clinica_id = p_clinica_id) THEN
    RETURN false;
  END IF;
  INSERT INTO public.avisos_clinica (clinica_id, tipo, cita_id, destinatario_id, actor_id)
  VALUES (p_clinica_id, 'personal_movio', p_cita_id, v_medico, p_actor_id)
  ON CONFLICT (tipo, cita_id) WHERE revisado_en IS NULL DO NOTHING;
  RETURN true;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.aviso_clinica_registrar(uuid, text, uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.aviso_clinica_registrar(uuid, text, uuid, uuid, uuid, text) TO service_role;
COMMENT ON FUNCTION public.aviso_clinica_registrar(uuid, text, uuid, uuid, uuid, text) IS
  'Avisos globales: el aviso de lo que el servidor sabe y un disparador no puede ver. Sólo service_role. Lista blanca: reserva_frenada (médico del enlace, que debe tener rol de médico en esa clínica, y el nombre tecleado, saneado y de 120 caracteres como mucho; una línea por nombre, sube datos.intentos), personal_movio (cita y actor: «Reagendar» del personal, que escribe sin auth.uid()) y paciente_no_asistira (cita: el «No» de Google en la última hora; una sola vez por cita). Comprueba que médico, cita y actor son de p_clinica_id y devuelve false si no; sólo con la v2 encendida. Un tipo nuevo exige migración.';

-- ---------------------------------------------------------------------
-- 3-bis · «Revisado» por usuario y reabrir.
-- ---------------------------------------------------------------------
-- Quién ha visto qué aviso. Sin FK a avisos_clinica (como avisos_clinica.cita_id:
-- la semilla y las pruebas borran avisos como postgres) ni a profiles (como
-- revisado_por). La FK a clinicas es RESTRICT: quien borre una clínica de
-- prueba borra antes estas filas (scripts/agenda-semilla.ts).
CREATE TABLE public.avisos_vistos (
  aviso_id    uuid        NOT NULL,
  usuario_id  uuid        NOT NULL,
  clinica_id  uuid        NOT NULL,
  visto_en    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT avisos_vistos_pkey PRIMARY KEY (aviso_id, usuario_id),
  CONSTRAINT avisos_vistos_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id) ON DELETE RESTRICT
);
CREATE INDEX avisos_vistos_clinica_idx ON public.avisos_vistos (clinica_id);
-- Mis vistos, por aviso. (avisos_pendientes busca cada marca por la llave primaria, que empieza por aviso_id.)
CREATE INDEX avisos_vistos_usuario_idx ON public.avisos_vistos (usuario_id, aviso_id);

ALTER TABLE public.avisos_vistos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.avisos_vistos FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.avisos_vistos TO authenticated;
GRANT INSERT (aviso_id, usuario_id, clinica_id) ON TABLE public.avisos_vistos TO authenticated;
GRANT UPDATE (visto_en) ON TABLE public.avisos_vistos TO authenticated;

-- Cada quien, sólo lo suyo. El alta exige que el aviso sea uno que YO veo: el
-- EXISTS corre bajo la RLS de avisos_clinica de quien pregunta (lo ajeno ni se
-- ve: el error es el mismo exista o no el aviso). Sin recursión: avisos_clinica
-- no lee avisos_vistos en ninguna policy.
CREATE POLICY avisos_vistos_select ON public.avisos_vistos FOR SELECT TO authenticated
  USING (usuario_id = auth.uid());
CREATE POLICY avisos_vistos_insert ON public.avisos_vistos FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid() AND clinica_id = public.get_clinica_id()
              AND EXISTS (SELECT 1 FROM public.avisos_clinica a
                           WHERE a.id = avisos_vistos.aviso_id AND a.clinica_id = public.get_clinica_id()));
CREATE POLICY avisos_vistos_update ON public.avisos_vistos FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid() AND clinica_id = public.get_clinica_id())
  WITH CHECK (usuario_id = auth.uid() AND clinica_id = public.get_clinica_id());

COMMENT ON TABLE public.avisos_vistos IS
  'Avisos globales: «revisado» POR USUARIO. Una fila = este usuario vio este aviso a esta hora. Un aviso está pendiente para alguien si no tiene fila suya o si visto_en < avisos_clinica.creado_en (el aviso se reabrió: llegó otro hecho del mismo tipo y cita). La escribe cada usuario para sí mismo (RLS); la hora la pone la base (aviso_visto_sellar). Que uno revise no se lo quita a nadie más. Sin FK a avisos_clinica ni a profiles a propósito.';

-- La hora la pone la base, no el navegador.
CREATE FUNCTION public.aviso_visto_sellar()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  -- Hora REAL (no la del inicio de la transacción): se compara con creado_en para saber si el aviso se reabrió después.
  NEW.visto_en := clock_timestamp();
  RETURN NEW;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.aviso_visto_sellar() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.aviso_visto_sellar() TO anon, authenticated, service_role;
CREATE TRIGGER trg_avisos_vistos_sellar
  BEFORE INSERT OR UPDATE ON public.avisos_vistos
  FOR EACH ROW EXECUTE FUNCTION public.aviso_visto_sellar();
CREATE TRIGGER trg_avisos_vistos_sin_truncate BEFORE TRUNCATE ON public.avisos_vistos
  FOR EACH STATEMENT EXECUTE FUNCTION public.prohibir_truncate();

-- Reabrir. BEFORE INSERT corre ANTES de que ON CONFLICT mire el índice: si ya
-- hay un aviso sin cerrar del mismo tipo y cita, se refresca (creado_en = hora real:
-- vuelve a estar pendiente para quien ya lo vio) y el alta se salta. INVOKER:
-- quien inserta es siempre un escritor DEFINER de postgres o la RPC.
-- Los avisos sin cita no pasan por aquí: los agrupa su propio ON CONFLICT.
-- ⚠️ CORRE DENTRO DE LOS SEIS ESCRITORES DE F4 (reserva por enlace, cancelación,
--   confirmación y reagendado del paciente, lo de Google), que NO tienen
--   EXCEPTION propio. Por eso:
--   · el refresco va en su subbloque: si falla, WARNING y RETURN NEW, o sea el
--     alta sigue y acaba en el ON CONFLICT DO NOTHING del escritor, EXACTAMENTE
--     lo que pasaba antes de M1. Nunca aborta la reserva ni la respuesta del
--     paciente (prueba av3_avisos_no_impiden.sql);
--   · no espera a nadie. Primero MIRA si ya hay un aviso sin cerrar (lectura
--     normal, sin candado). Si lo hay, intenta refrescarlo con FOR UPDATE SKIP
--     LOCKED y, lo consiga o no, SE SALTA EL ALTA (RETURN NULL): si otra
--     transacción tiene la fila es otro hecho de la misma cita que ya la está
--     refrescando. Saltarse el alta es lo que evita la espera: el INSERT … ON
--     CONFLICT DO NOTHING de F4 SÍ espera a la otra transacción (comprobado con
--     dos sesiones: 3 s hasta el lock_timeout con el alta; 0,1 s saltándola).
--     Dos hechos simultáneos de la misma cita no se bloquean entre sí.
--     (Carrera aceptada: si quien tiene la fila la está CERRANDO con el código
--     de antes, este hecho no deja aviso nuevo.) Si NO hay aviso, el alta sigue
--     y es la de F4 de siempre, con su espera de siempre entre dos primeros
--     avisos simultáneos de la misma cita: eso M1 no lo cambia.
--   · cada refresco deja una fila en audit_log (audit_avisos_clinica, de F4:
--     acción UPDATE, tabla e id, sin valores): es la única huella de que un
--     segundo hecho reabrió el aviso, igual que el INSERT lo es del primero.
CREATE FUNCTION public.aviso_clinica_reabrir()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  BEGIN
    -- ¿Hay ya uno sin cerrar? Lectura sin candado: lo ve aunque otra transacción lo esté refrescando.
    IF EXISTS (SELECT 1 FROM public.avisos_clinica b
                WHERE b.tipo = NEW.tipo AND b.cita_id = NEW.cita_id AND b.revisado_en IS NULL) THEN
      UPDATE public.avisos_clinica a
         SET creado_en = clock_timestamp(), actor_id = NEW.actor_id, destinatario_id = NEW.destinatario_id
       WHERE a.id IN (SELECT b.id FROM public.avisos_clinica b
                       WHERE b.tipo = NEW.tipo AND b.cita_id = NEW.cita_id AND b.revisado_en IS NULL
                         FOR UPDATE SKIP LOCKED);
      -- Refrescado, o tomado por otro hecho de la misma cita: en los dos casos el alta sobra.
      RETURN NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'aviso_clinica_reabrir: aviso % no refrescado (SQLSTATE %)', NEW.tipo, SQLSTATE;
  END;
  RETURN NEW;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.aviso_clinica_reabrir() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.aviso_clinica_reabrir() TO anon, authenticated, service_role;
CREATE TRIGGER trg_avisos_clinica_reabrir
  BEFORE INSERT ON public.avisos_clinica
  FOR EACH ROW
  WHEN (NEW.cita_id IS NOT NULL)
  EXECUTE FUNCTION public.aviso_clinica_reabrir();

-- La lectura de la campana: MIS pendientes, los más nuevos primero. INVOKER:
-- corre con la sesión, bajo la RLS de avisos_clinica y de avisos_vistos.
-- p_tipos = los que el código conoce (un tipo nuevo no tapa a los demás).
-- ⚠️ ACOTADA, porque el código nuevo ya no cierra avisos (revisado_en) y sin
--   tope cada relectura recorrería todos los de la clínica, también para quien
--   ya lo vio todo:
--   · VENTANA de 60 días sobre creado_en. Un aviso habla de una cita o de un
--     hecho de la agenda; el más lejano que la reserva por enlace deja agendar
--     queda a semanas, y un aviso que nadie abrió en dos meses habla de algo que
--     ya pasó. Reabrirlo (otro hecho de la misma cita) le renueva creado_en y
--     vuelve a entrar. Fuera de la ventana el aviso NO se borra ni se cierra:
--     se queda en la tabla como registro; sólo deja de leerse en la campana.
--   · TOPE de 500: sólo se miran los 500 más nuevos que la RLS deja ver, y de
--     esos se devuelven los que no he visto. Quien lo vio todo recorre 500
--     filas como mucho, haya 1 000 o 100 000 avisos. Consecuencia aceptada: un
--     aviso sin ver con 500 más nuevos por delante ya no sale.
--   Las dos las sirve el índice de F4 avisos_clinica_pendientes_idx
--   (clinica_id, creado_en DESC) WHERE revisado_en IS NULL: recorre de lo más
--   nuevo hacia atrás y se detiene en el tope o en el borde de la ventana.
--   Medido (supabase/pruebas-sql/medicion/av1_campana.sql): lo mismo con 1 200
--   avisos que con 21 000; ver docs/spec/avisos-globales/.
--   Límite que queda: a un médico invitado la RLS le oculta las citas ajenas,
--   y para juntar SUS 500 puede recorrer todos los avisos de la clínica de la
--   ventana (no más). Sin purga ni tarea programada: no hace falta ninguna.
CREATE FUNCTION public.avisos_pendientes(p_tipos text[], p_limite integer)
 RETURNS SETOF public.avisos_clinica
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT a.*
    FROM (SELECT c.*
            FROM public.avisos_clinica c
           WHERE c.clinica_id = public.get_clinica_id()
             AND c.revisado_en IS NULL
             AND c.creado_en >= now() - interval '60 days'
             AND c.tipo = ANY (coalesce(p_tipos, ARRAY[]::text[]))
           ORDER BY c.creado_en DESC
           LIMIT 500) a
   -- Mi marca de ESE aviso, buscada por su llave (aviso_id, usuario_id). Va como subconsulta
   -- escalar a propósito: con NOT EXISTS Postgres puede cargar TODAS mis marcas de siempre
   -- para cruzarlas, y esa tabla tampoco deja de crecer. Sin marca (NULL) = pendiente.
   WHERE coalesce((SELECT v.visto_en FROM public.avisos_vistos v
                    WHERE v.aviso_id = a.id AND v.usuario_id = auth.uid()) < a.creado_en, true)
   ORDER BY a.creado_en DESC
   LIMIT least(greatest(coalesce(p_limite, 50), 1), 200)
$function$;
REVOKE EXECUTE ON FUNCTION public.avisos_pendientes(text[], integer) FROM PUBLIC, anon, service_role;
GRANT  EXECUTE ON FUNCTION public.avisos_pendientes(text[], integer) TO authenticated;
COMMENT ON FUNCTION public.avisos_pendientes(text[], integer) IS
  'Avisos globales: los avisos pendientes PARA QUIEN LLAMA (los que su RLS le deja ver, sin cerrar para todos, y que no ha visto desde su último cambio: sin fila suya en avisos_vistos o con visto_en < creado_en), de los tipos dados, los más nuevos primero. ACOTADA: sólo avisos de los últimos 60 días (creado_en; reabrir lo renueva) y, de esos, los 500 más nuevos que la RLS deja ver; lo más viejo se queda en la tabla como registro y no se lee aquí. INVOKER: no se salta ninguna policy. Sólo authenticated.';

-- Lo que la lectura acotada deja FUERA, para que la campana lo diga en vez de callarlo: ¿hay
-- avisos más antiguos que avisos_pendientes ya no devuelve? Dos casos, los dos ACOTADOS:
--   · el TOPE: dentro de la ventana hay más de 500 que yo veo (el 501.º existe);
--   · la VENTANA: algún aviso que yo veo y NO he visto salió de ella hace poco (tiene entre 60 y
--     120 días). Más atrás no mira, a propósito: mirar «todo lo anterior» es justo el recorrido
--     sin tope que se quitó (a un médico invitado la RLS le oculta lo ajeno y lo recorrería
--     entero). Un aviso de más de 120 días sin ver deja de anunciarse; sigue en la tabla.
-- INVOKER: con la sesión y bajo RLS, como avisos_pendientes. Sólo devuelve un booleano.
CREATE FUNCTION public.avisos_mas_antiguos(p_tipos text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.avisos_clinica c
                  WHERE c.clinica_id = public.get_clinica_id()
                    AND c.revisado_en IS NULL
                    AND c.creado_en >= now() - interval '60 days'
                    AND c.tipo = ANY (coalesce(p_tipos, ARRAY[]::text[]))
                  ORDER BY c.creado_en DESC
                 OFFSET 500 LIMIT 1)
      OR EXISTS (SELECT 1 FROM public.avisos_clinica c
                  WHERE c.clinica_id = public.get_clinica_id()
                    AND c.revisado_en IS NULL
                    AND c.creado_en < now() - interval '60 days'
                    AND c.creado_en >= now() - interval '120 days'
                    AND c.tipo = ANY (coalesce(p_tipos, ARRAY[]::text[]))
                    AND coalesce((SELECT v.visto_en FROM public.avisos_vistos v
                                   WHERE v.aviso_id = c.id AND v.usuario_id = auth.uid()) < c.creado_en, true))
$function$;
REVOKE EXECUTE ON FUNCTION public.avisos_mas_antiguos(text[]) FROM PUBLIC, anon, service_role;
GRANT  EXECUTE ON FUNCTION public.avisos_mas_antiguos(text[]) TO authenticated;
COMMENT ON FUNCTION public.avisos_mas_antiguos(text[]) IS
  'Avisos globales: true si quedan avisos que avisos_pendientes ya no devuelve a quien llama: más de 500 visibles dentro de los últimos 60 días, o alguno visible y sin ver de entre 60 y 120 días atrás. Para que la campana diga «hay avisos más antiguos» en vez de ocultarlos en silencio. Acotada como la lectura. INVOKER: no se salta ninguna policy. Sólo authenticated.';

-- ---------------------------------------------------------------------
-- 4 · Lo que toca tablas EXISTENTES, junto y al final, en UN bloque: cada
--     CREATE TRIGGER toma SHARE ROW EXCLUSIVE sobre su tabla hasta el COMMIT.
--     Sus candados ya están tomados desde el pre-vuelo (sección 1).
--     ⚠️ Los WHEN SÓLO comparan columnas: no llaman a auth.uid() ni a ninguna
--     función, porque un fallo en un WHEN no lo atrapa nadie y abortaría la
--     escritura de origen. Quién escribe se mira DENTRO de la función, en su
--     subbloque. Un UPDATE que no cambia estado ni hora no llama a la función;
--     un alta, siempre (costo medido: supabase/pruebas-sql/medicion/).
-- ---------------------------------------------------------------------
DO $triggers$
BEGIN
  CREATE TRIGGER trg_appointments_aviso_alta_personal
    AFTER INSERT ON public.appointments
    FOR EACH ROW
    WHEN (NEW.medico_id IS NOT NULL)
    EXECUTE FUNCTION public.aviso_clinica_de_cambio_cita();
  CREATE TRIGGER trg_appointments_aviso_cambio
    AFTER UPDATE OF status, start_time, end_time ON public.appointments
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.start_time IS DISTINCT FROM NEW.start_time
          OR OLD.end_time IS DISTINCT FROM NEW.end_time)
    EXECUTE FUNCTION public.aviso_clinica_de_cambio_cita();
  CREATE TRIGGER trg_agenda_bloqueos_aviso_alta
    AFTER INSERT ON public.agenda_bloqueos
    FOR EACH ROW
    EXECUTE FUNCTION public.aviso_clinica_de_bloqueo();
  CREATE TRIGGER trg_agenda_bloqueos_aviso_baja
    AFTER DELETE ON public.agenda_bloqueos
    FOR EACH ROW
    EXECUTE FUNCTION public.aviso_clinica_de_bloqueo();
  -- Fallido sin reintento posible: el comprobante (no lo reintenta nadie) o el
  -- tercer intento del recordatorio; y sólo por fallo de envío o de plantilla.
  CREATE TRIGGER trg_cita_correos_aviso_clinica
    AFTER UPDATE OF estado ON public.cita_correos
    FOR EACH ROW
    WHEN (OLD.estado IS DISTINCT FROM NEW.estado AND NEW.estado = 'fallido'
          AND NEW.tipo IN ('comprobante', 'recordatorio') AND NEW.motivo IN ('transporte', 'plantilla')
          AND (NEW.tipo = 'comprobante' OR NEW.intentos >= 3))
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
                  WHERE p.oid = to_regprocedure('public.aviso_clinica_registrar(uuid, text, uuid, uuid, uuid, text)')
                    AND p.prosecdef AND p.proconfig = ARRAY['search_path=""'])
     OR has_function_privilege('anon', 'public.aviso_clinica_registrar(uuid, text, uuid, uuid, uuid, text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.aviso_clinica_registrar(uuid, text, uuid, uuid, uuid, text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.aviso_clinica_registrar(uuid, text, uuid, uuid, uuid, text)', 'EXECUTE') THEN
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
  -- avisos_vistos: RLS, sus tres policies, y la sesión sólo escribe lo suyo (sin DELETE ni TRUNCATE para nadie).
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.avisos_vistos'::regclass)
     OR (SELECT string_agg(policyname || ':' || cmd, ',' ORDER BY policyname) FROM pg_policies
          WHERE schemaname = 'public' AND tablename = 'avisos_vistos')
        IS DISTINCT FROM 'avisos_vistos_insert:INSERT,avisos_vistos_select:SELECT,avisos_vistos_update:UPDATE' THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: avisos_vistos sin RLS o sin sus tres policies.';
  END IF;
  SELECT string_agg(r || ':' || p, ', ') INTO v_mal
    FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) r
    CROSS JOIN unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) p
   WHERE has_table_privilege(r, 'public.avisos_vistos', p) AND NOT (r = 'authenticated' AND p = 'SELECT');
  IF v_mal IS NOT NULL OR has_column_privilege('authenticated', 'public.avisos_vistos', 'visto_en', 'INSERT')
     OR has_column_privilege('authenticated', 'public.avisos_vistos', 'usuario_id', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.avisos_vistos', 'visto_en', 'UPDATE') THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: privilegios de avisos_vistos distintos de los esperados: %', coalesce(v_mal, 'columnas');
  END IF;
  -- Ninguna policy de avisos_clinica lee avisos_vistos (si lo hiciera, la de avisos_vistos_insert haría un ciclo).
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'avisos_clinica'
                AND (coalesce(qual, '') || coalesce(with_check, '')) ~* 'avisos_vistos') THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: una policy de avisos_clinica consulta avisos_vistos (ciclo de RLS).';
  END IF;
  -- La lectura: INVOKER, sólo authenticated. Los dos disparadores propios de avisos, habilitados.
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure('public.avisos_pendientes(text[], integer)')
                    AND NOT p.prosecdef AND p.proconfig = ARRAY['search_path=""'])
     OR has_function_privilege('anon', 'public.avisos_pendientes(text[], integer)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.avisos_pendientes(text[], integer)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.avisos_pendientes(text[], integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: avisos_pendientes no quedó INVOKER, con search_path vacío y sólo para authenticated.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure('public.avisos_mas_antiguos(text[])')
                    AND NOT p.prosecdef AND p.proconfig = ARRAY['search_path=""'])
     OR has_function_privilege('anon', 'public.avisos_mas_antiguos(text[])', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.avisos_mas_antiguos(text[])', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.avisos_mas_antiguos(text[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: avisos_mas_antiguos no quedó INVOKER, con search_path vacío y sólo para authenticated.';
  END IF;
  IF (SELECT count(*) FROM pg_trigger g WHERE NOT g.tgisinternal AND g.tgenabled = 'O'
        AND g.tgname IN ('trg_avisos_clinica_reabrir', 'trg_avisos_vistos_sellar', 'trg_avisos_vistos_sin_truncate')) <> 3 THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: falta trg_avisos_clinica_reabrir, trg_avisos_vistos_sellar o trg_avisos_vistos_sin_truncate.';
  END IF;
  -- Ningún WHEN de los disparadores de M1 llama a una función (un fallo ahí no se atrapa).
  SELECT string_agg(g.tgname, ', ') INTO v_mal FROM pg_trigger g
   WHERE NOT g.tgisinternal AND g.tgname LIKE 'trg\_%aviso%' AND pg_get_triggerdef(g.oid) ~* 'WHEN \(.*(auth\.uid|agenda_v2_encendida)'
     AND g.tgname IN ('trg_appointments_aviso_alta_personal', 'trg_appointments_aviso_cambio', 'trg_agenda_bloqueos_aviso_alta',
                      'trg_agenda_bloqueos_aviso_baja', 'trg_cita_correos_aviso_clinica', 'trg_conexiones_google_aviso_clinica',
                      'trg_gcal_sync_estado_aviso_clinica', 'trg_avisos_clinica_reabrir');
  IF v_mal IS NOT NULL THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: el WHEN de % llama a una función.', v_mal;
  END IF;
  -- El índice que sirve la lectura acotada (de F4) sigue ahí.
  IF to_regclass('public.avisos_clinica_pendientes_idx') IS NULL THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: falta el índice avisos_clinica_pendientes_idx (F4), el que sirve avisos_pendientes.';
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
         (SELECT string_agg(has_function_privilege(r, 'public.aviso_clinica_registrar(uuid, text, uuid, uuid, uuid, text)', 'EXECUTE')::text, '/')
            FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) WITH ORDINALITY AS x(r, o)),
         'false/false/true'
  UNION ALL
  SELECT 7, 'avisos_vistos: policies',
         (SELECT string_agg(policyname || ':' || cmd, ',' ORDER BY policyname) FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'avisos_vistos'),
         'avisos_vistos_insert:INSERT,avisos_vistos_select:SELECT,avisos_vistos_update:UPDATE'
  UNION ALL
  SELECT 8, 'reabrir, sellar y sin_truncate (disparadores propios de avisos), habilitados',
         (SELECT count(*)::text FROM pg_trigger g WHERE NOT g.tgisinternal AND g.tgenabled = 'O'
             AND g.tgname IN ('trg_avisos_clinica_reabrir', 'trg_avisos_vistos_sellar', 'trg_avisos_vistos_sin_truncate')),
         '3'
  UNION ALL
  -- Realtime NO se toca (decisión de Angel: la campana relee cada 2 minutos, no escucha).
  SELECT 9, 'avisos_clinica en la publicación supabase_realtime (esta migración no la añade)',
         (SELECT count(*)::text FROM pg_publication_tables
           WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'avisos_clinica'),
         '0'
  UNION ALL
  SELECT 10, 'filas de avisos_clinica (ninguna cambia con esta migración)',
         (SELECT count(*)::text FROM public.avisos_clinica), NULL
  UNION ALL
  SELECT 11, 'forma de avisos_clinica de la que partió', (SELECT forma FROM pg_temp._m1_partida LIMIT 1), NULL
  UNION ALL
  SELECT 13, 'quién ejecuta avisos_mas_antiguos (anon/authenticated/service_role)',
         (SELECT string_agg(has_function_privilege(r, 'public.avisos_mas_antiguos(text[])', 'EXECUTE')::text, '/')
            FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) WITH ORDINALITY AS x(r, o)),
         'false/true/false'
  UNION ALL
  SELECT 12, 'avisos_pendientes acotada (ventana de 60 días y tope de 500)',
         (SELECT (p.prosrc LIKE '%interval ''60 days''%' AND p.prosrc LIKE '%LIMIT 500%')::text FROM pg_proc p
           WHERE p.oid = to_regprocedure('public.avisos_pendientes(text[], integer)')),
         'true'
) t
ORDER BY t.n;
