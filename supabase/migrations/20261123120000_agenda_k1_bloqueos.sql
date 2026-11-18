-- ═══════════════════════════════════════════════════════════════════════
-- Agenda · tanda K, agente K1 (sección A de Angel) — BLOQUEO DE HORARIOS:
-- un periodo que el médico cierra a propósito, propio y distinto de una cita
-- o de un evento; el enlace de reserva deja de ofrecer turnos ahí, y los
-- eventos de TODO EL DÍA dejan de cerrar el día en el enlace.
-- Rama: feature/agenda-v2-k1 · Escrita: 2026-11-18
-- Riesgo estimado: ALTO (toca reservar_por_enlace, la función de la reserva
-- pública; CREATE OR REPLACE con dos cambios en UNA comprobación, la de
-- empalme. Además: una tabla nueva con RLS y tres funciones nuevas. Ninguna
-- policy, columna ni fila existente cambia).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: ver «APLICACIÓN LOCAL» al pie de la cabecera.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR, después de toda la agenda v2
--   (en particular de 20261122120100_agenda_j2_unico_carrera_client_id).
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Angel (tanda K, sección A): «Hoy un evento de todo el día cierra ese día en
-- el enlace de reserva, pero no impide agendar desde Spinus. Es
-- contradictorio y además no es lo que quiero: un "Congreso" de todo el día
-- no significa que no consulte. Se sustituye por un bloqueo que el médico
-- pone a propósito.» El bloqueo es «un periodo, de horas o de días
-- completos, de un médico, con un motivo opcional»; en el enlace «un periodo
-- bloqueado no ofrece turnos. Sin excepción, y comprobado también en la
-- función de la base al reservar, no solo en la página».
--
-- ═══ QUÉ CAMBIA ════════════════════════════════════════════════════════
-- public.agenda_bloqueos (TABLA NUEVA). NO es una fila de appointments.
--   · inicio/fin timestamptz (fin > inicio, ≤ 400 días); todo_el_dia con su
--     zona: en todo el día las dos puntas son medianoches de `zona` (la misma
--     regla que appointments_all_day_medianoche_check); motivo opcional
--     (≤ 120); google_event_id / gcal_calendar_id / gcal_etag (los escribe
--     sólo el servidor con service_role); created_by = auth.uid() (atribución,
--     SIN FK, como audit_log.user_id); created_at/updated_at.
--   · FK a clinicas y a profiles (medico_id) ON DELETE RESTRICT.
--   · RLS con policies PROPIAS de la tabla y el MISMO predicado de quién
--     puede agendar para ese médico que appointments (médico dueño,
--     administrador de la clínica o secretaria; de la clínica de la sesión).
--     INSERT/UPDATE exigen además, DENTRO de su WITH CHECK PERMISSIVE (sin
--     otra puerta RESTRICTIVE, regla de CLAUDE.md), clinica_no_suspendida()
--     AND clinica_tiene_acceso() AND perfil_completo() (las puertas de
--     appointments_gates_insert, sin tocarlas), la agenda v2 encendida en la
--     clínica y que el médico sea de la clínica. Sin recursión: las policies
--     leen profiles y agenda_ajustes, nunca agenda_bloqueos.
--   · Permisos: authenticated SELECT, DELETE, INSERT de (clinica_id,
--     medico_id, inicio, fin, todo_el_dia, zona, motivo) y UPDATE de (inicio,
--     fin, todo_el_dia, zona, motivo). service_role SELECT/INSERT/UPDATE/
--     DELETE (el servidor guarda el evento de Google; la RPC del sondeo
--     aplica lo movido o borrado en Google). anon nada.
--   · agenda_bloqueo_preparar() (BEFORE INSERT OR UPDATE, INVOKER): toma el
--     candado consultivo 1790 del médico —el mismo de reservar_por_enlace—
--     y pone updated_at. Así un bloqueo y una reserva del mismo médico a la
--     vez se serializan: si el bloqueo entra antes, la reserva (READ
--     COMMITTED, sentencia nueva tras el candado) lo ve y sale 'ocupado'; si
--     la reserva entra antes, el bloqueo espera y queda encima de la cita
--     (punto 5: no la cancela). Prueba: escenario 6 de reserva-carrera.sh.
--   · audit_agenda_bloqueos: log_tabla_change() en alta, edición y borrado.
-- public.reserva_ocupacion (CREATE OR REPLACE, misma firma, mismas
--   columnas): devuelve además las puntas de los bloqueos del médico del
--   enlace, y deja de devolver las filas de TODO EL DÍA de appointments
--   (punto 4). La página de turnos (D5) no cambia: lo que devuelve esto es lo
--   que no se ofrece. Nada del bloqueo sale de ahí más que sus dos puntas.
-- public.reservar_por_enlace (CREATE OR REPLACE, cuerpo de j2-b): en la
--   comprobación de empalme, `AND NOT a.all_day` (punto 4) y un EXISTS sobre
--   agenda_bloqueos con el mismo solape (punto 2), las dos con salida
--   'ocupado'. MISMO SITIO que antes: después del conteo del único y de
--   'fuera_de_ventana', antes de la ficha del fijo y del candado de persona.
--   Un EXISTS no lanza: nada nuevo que quien reserva pueda hacer reventar
--   después del contador (regla de CLAUDE.md). Todo lo demás, letra por
--   letra igual (veredicto 4 y 5).
-- public.gcal_bloqueo_aplicar (NUEVA, sólo service_role): lo movido o
--   borrado en Google de un evento de bloqueo vuelve al bloqueo (punto 6),
--   como un evento sin paciente: borrado → se borra el bloqueo; movido → sus
--   puntas, si Google es más reciente («gana el último»); eco (mismo etag)
--   → nada. Sólo el bloqueo ya ligado a ese evento, o el que nombra la marca
--   privada `spinus_bloqueo` mientras no tenga evento: un evento creado en
--   Google NUNCA se convierte en bloqueo (no hay INSERT).
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere: 20261117130000 (reserva_ocupacion de seg1, md5 50a89d85…) y
--   20261122120100 (reservar_por_enlace de j2-b, md5 1a448df0…); B1
--   (agenda_ajustes), C1 (clinica_conexiones_google). PG ≥ 14.
-- Bloqueos (lock_timeout 5 s): CREATE TABLE con FK → SHARE ROW EXCLUSIVE un
--   instante sobre clinicas y profiles; CREATE OR REPLACE FUNCTION, ninguno
--   sobre tablas.
-- Orden respecto al código:
--   · Base con esto, código viejo: los eventos de todo el día dejan de
--     cerrar el día en el enlace (lo que pide el punto 4); no hay bloqueos
--     porque nadie los crea.
--   · Código nuevo, base sin esto: la agenda no pinta bloqueos (la tabla
--     ausente se lee como «ninguno») y crear uno da «no disponible».
-- Alcance de los roles:
--   gana — authenticated: crear, ver, editar y quitar bloqueos de los médicos
--          para los que hoy puede agendar.
--   pierde — nada. anon no gana nada (la ruta pública usa service_role).
-- Contrato con spinus-consola: tabla nueva; nada de lo que la consola lee.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   Volver a pegar reserva_ocupacion de 20261117130000 y reservar_por_enlace
--   de 20261122120100, con sus REVOKE/GRANT; después
--   DROP FUNCTION IF EXISTS public.gcal_bloqueo_aplicar(uuid, text, text, uuid, text, timestamptz, boolean, timestamptz, timestamptz, date, date);
--   DROP TABLE IF EXISTS public.agenda_bloqueos;  -- (respaldar antes)
--   DROP FUNCTION IF EXISTS public.agenda_bloqueo_preparar();
--
-- ═══ ORDEN CON K3 ══════════════════════════════════════════════════════
-- 20261123140000 (K3) añade «y no pausado» a reservar_por_enlace y a
-- reserva_ocupacion sustituyendo UN fragmento del cuerpo vigente. Esta
-- migración hace lo mismo con fragmentos que no se solapan con el suyo, y
-- acepta en el pre-vuelo los cuerpos con y sin K3: las dos se aplican en
-- cualquier orden y el resultado es el mismo texto (md5 en la sección 0).
--
-- ═══ AUDITORÍA ═════════════════════════════════════════════════════════
-- Independiente (subagente sonnet, 2026-11-18), contra AUDITORIA-MIGRACIONES.md
-- y CLAUDE.md, sólo lectura en la base local. Veredicto: APTA CON
-- OBSERVACIONES. Comprobado: sustitución y md5 en los dos órdenes con K3;
-- garantía atómica intacta (1790, FOR UPDATE, READ COMMITTED, bloque del
-- INSERT); los EXISTS nuevos no lanzan; permisos de funciones; el motivo no
-- sale por reserva_ocupacion; RLS sin huecos ni recursión, sin RESTRICTIVE
-- nueva y sin tocar policies existentes; con v2 apagada no cambia nada.
-- Observaciones y qué se hizo:
--   · (media) los md5 del replay de las dos funciones nuevas eran de una
--     versión anterior: la segunda pasada abortaba. CORREGIDO (recalculados).
--   · (baja) gcal_bloqueo_aplicar tomaba la fila antes que el candado 1790.
--     CORREGIDO: lee sin bloquear, toma el candado y relee FOR UPDATE.
--   · (baja) el replay no comprobaba las CHECK. CORREGIDO en el pre-vuelo.
--   · (baja) el disparador BEFORE toma el candado de un médico ajeno antes
--     de que la RLS rechace el alta: sólo lo que dura la sentencia. Se deja.
--   · (baja) la marca privada spinus_bloqueo la edita quien escribe en el
--     calendario de Google: sólo liga o borra, en su clínica, un bloqueo sin
--     evento aún. Se acepta; el servidor no la usa para nada más.
-- Revisión de seguridad de la ruta pública (subagente sonnet): sin hallazgos
-- medios ni altos; B1 (índice por fin), B2 (minutos enteros: CHECK y
-- date_trunc en gcal) y B3 (candados ordenados al cambiar de médico)
-- aplicados.
--
-- ═══ APLICACIÓN LOCAL ══════════════════════════════════════════════════
-- (se completa al aplicar)
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 0 · Las sustituciones de la sección 4: función, fragmento de hoy,
--     fragmento nuevo, y los md5 de prosrc que se aceptan antes y después.
--     Antes = el cuerpo de seg1 (ocupación) o de j2-b (reserva), con o sin
--     la guarda de «pausado» de K3. Después = lo mismo con lo de k1.
-- ---------------------------------------------------------------------
CREATE TEMPORARY TABLE k1_sustituciones (
  n integer PRIMARY KEY, firma text NOT NULL, viejo text NOT NULL, nuevo text NOT NULL,
  md5_antes text[] NOT NULL, md5_despues text[] NOT NULL
) ON COMMIT DROP;
INSERT INTO k1_sustituciones VALUES
  (1, 'public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz)',
$v$  SELECT a.start_time, a.end_time
    FROM public.reserva_enlaces e
    JOIN public.agenda_ajustes j ON j.clinica_id = e.clinica_id AND j.agenda_v2_encendida
    JOIN public.appointments a ON a.clinica_id = e.clinica_id AND a.medico_id = e.medico_id
$v$,
$n$  -- k1 (tanda K): lo que tiene hora y no está cancelado ni faltó (lo de TODO
  -- EL DÍA ya no ocupa, punto 4) y los bloqueos del médico (punto 2).
  SELECT o.start_time, o.end_time
    FROM public.reserva_enlaces e
    JOIN public.agenda_ajustes j ON j.clinica_id = e.clinica_id AND j.agenda_v2_encendida
    CROSS JOIN LATERAL (
      SELECT a.start_time, a.end_time
        FROM public.appointments a
       WHERE a.clinica_id = e.clinica_id AND a.medico_id = e.medico_id
         AND a.start_time < p_hasta AND a.end_time > p_desde
         AND a.status NOT IN ('cancelled', 'no_show')
         AND NOT a.all_day
      UNION ALL
      SELECT b.inicio, b.fin
        FROM public.agenda_bloqueos b
       WHERE b.clinica_id = e.clinica_id AND b.medico_id = e.medico_id
         AND b.inicio < p_hasta AND b.fin > p_desde
    ) o
$n$,
   ARRAY['50a89d8589d84b57de04571ee1aa3da2', '89059ef99cb59afb63c913d57c292cea'],
   ARRAY['e7cf1c347ef5391b3078a02744fdf5d4', 'f1701599edf6756887fbb01a8c18464f']),
  (2, 'public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz)',
$v$     AND p_hasta > p_desde AND p_hasta - p_desde <= interval '15 days'
     AND a.start_time < p_hasta AND a.end_time > p_desde
     AND a.status NOT IN ('cancelled', 'no_show')
   ORDER BY a.start_time;$v$,
$n$     AND p_hasta > p_desde AND p_hasta - p_desde <= interval '15 days'
   ORDER BY o.start_time;$n$,
   ARRAY['50a89d8589d84b57de04571ee1aa3da2', '89059ef99cb59afb63c913d57c292cea'],
   ARRAY['e7cf1c347ef5391b3078a02744fdf5d4', 'f1701599edf6756887fbb01a8c18464f']),
  (3, 'public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)',
$v$  -- seg1 (punto 5): un evento de TODO EL DÍA del médico (vacaciones, congreso;
  -- de Spinus o de Google) también ocupa: sus puntas son las medianoches de su
  -- zona (appointments_all_day_medianoche_check), así que cubre esos días
  -- enteros. Dentro de la agenda sigue sin bloquear (B7: sólo alerta).
  IF EXISTS (SELECT 1 FROM public.appointments a
              WHERE a.clinica_id = p_clinica_id AND a.medico_id = v_enl.medico_id
                AND a.start_time < v_fin AND a.end_time > p_inicio
                AND a.status NOT IN ('cancelled', 'no_show')) THEN
    r_resultado := 'ocupado'; RETURN NEXT; RETURN;
  END IF;$v$,
$n$  -- k1 (tanda K, punto 4): lo de TODO EL DÍA ya no ocupa en el enlace (un
  -- «Congreso» de todo el día no significa que no consulte); lo que tiene hora
  -- sí, como siempre. Punto 2: un bloqueo del médico (agenda_bloqueos) ocupa,
  -- sin excepción, con el mismo solape. Los dos son EXISTS: no lanzan, así
  -- que nada nuevo después del contador del único puede reventar. El bloqueo
  -- se escribe bajo el mismo candado 1790 (agenda_bloqueo_preparar): uno
  -- confirmado antes de este candado se ve aquí (READ COMMITTED).
  IF EXISTS (SELECT 1 FROM public.appointments a
              WHERE a.clinica_id = p_clinica_id AND a.medico_id = v_enl.medico_id
                AND a.start_time < v_fin AND a.end_time > p_inicio
                AND a.status NOT IN ('cancelled', 'no_show')
                AND NOT a.all_day)
     OR EXISTS (SELECT 1 FROM public.agenda_bloqueos b
                 WHERE b.clinica_id = p_clinica_id AND b.medico_id = v_enl.medico_id
                   AND b.inicio < v_fin AND b.fin > p_inicio) THEN
    r_resultado := 'ocupado'; RETURN NEXT; RETURN;
  END IF;$n$,
   ARRAY['1a448df0732e62754fb428b1892d45e8', '13025ad591295e9faf4879f6149bdd22'],
   ARRAY['eb5ec46ca21cad79a690fb704fbf662c', 'be25c16726eb90839767fd4bd9176195']);

-- Cuántas veces aparece `frag` en `texto` (como pg_temp.k3_veces). OR REPLACE:
-- pg_temp vive lo que la SESIÓN, y el SQL Editor puede reutilizar la conexión.
CREATE OR REPLACE FUNCTION pg_temp.k1_veces(texto text, frag text) RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT (char_length(texto) - char_length(replace(texto, frag, ''))) / char_length(frag)
$$;

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  s record;
  p record;
  v_n integer;
BEGIN
  FOR s IN SELECT * FROM k1_sustituciones ORDER BY n LOOP
    SELECT * INTO p FROM pg_proc WHERE oid = to_regprocedure(s.firma);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta % con su firma de D3.', s.firma;
    END IF;
    IF p.prosecdef THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: % es SECURITY DEFINER; D3 la dejó INVOKER.', s.firma;
    END IF;
    IF NOT (md5(p.prosrc) = ANY (s.md5_antes || s.md5_despues)) THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: % tiene un cuerpo desconocido (md5 %): ni seg1/j2-b ni esta, con o sin K3. Revisar quién la cambió.', s.firma, md5(p.prosrc);
    END IF;
    -- Segunda pasada: ya lleva el fragmento nuevo y no el viejo.
    CONTINUE WHEN md5(p.prosrc) = ANY (s.md5_despues)
             AND pg_temp.k1_veces(p.prosrc, s.nuevo) = 1 AND pg_temp.k1_veces(p.prosrc, s.viejo) = 0;
    IF pg_temp.k1_veces(p.prosrc, s.viejo) <> 1 OR pg_temp.k1_veces(p.prosrc, s.nuevo) <> 0 THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: en % el fragmento % de hoy aparece % veces y el nuevo % (se esperan 1 y 0).',
        s.firma, s.n, pg_temp.k1_veces(p.prosrc, s.viejo), pg_temp.k1_veces(p.prosrc, s.nuevo);
    END IF;
  END LOOP;
  -- Lo que la sección 4 NO puede tocar: la garantía atómica de reservar_por_enlace.
  SELECT * INTO p FROM pg_proc WHERE oid = to_regprocedure('public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)');
  IF NOT (p.prosrc LIKE '%PERFORM pg_advisory_xact_lock(1790, hashtext(v_enl.medico_id::text));%'
          AND p.prosrc LIKE '%EXCEPTION WHEN unique_violation THEN%idx_appointments_client_id%RAISE;%') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: reservar_por_enlace sin el candado 1790 o sin el bloque del INSERT.';
  END IF;
  IF to_regclass('public.agenda_ajustes') IS NULL OR to_regclass('public.clinica_conexiones_google') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: faltan agenda_ajustes (B1) o clinica_conexiones_google (C1).';
  END IF;
  IF to_regprocedure('public.get_clinica_id()') IS NULL OR to_regprocedure('public.log_tabla_change()') IS NULL
     OR to_regprocedure('public.soy_admin_de_clinica()') IS NULL OR to_regprocedure('public.get_my_role()') IS NULL
     OR to_regprocedure('public.clinica_no_suspendida()') IS NULL OR to_regprocedure('public.clinica_tiene_acceso()') IS NULL
     OR to_regprocedure('public.perfil_completo()') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta una de las funciones auxiliares de la RLS o log_tabla_change().';
  END IF;
  -- Replay: las dos funciones nuevas, si existen, son las de esta migración (md5 de prosrc).
  IF EXISTS (SELECT 1 FROM (VALUES
       ('public.agenda_bloqueo_preparar()', 'f1f887ecf99cea0e16ce0ae202bf8df4'),
       ('public.gcal_bloqueo_aplicar(uuid, text, text, uuid, text, timestamptz, boolean, timestamptz, timestamptz, date, date)', '3e426d39518506fc2395318e6f832c8d')) AS e(firma, esperado)
       JOIN pg_proc f ON f.oid = to_regprocedure(e.firma)
      WHERE md5(f.prosrc) <> e.esperado) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: agenda_bloqueo_preparar o gcal_bloqueo_aplicar ya existe con otro cuerpo.';
  END IF;
  -- Replay: la tabla, si existe, tiene exactamente estas columnas y tipos.
  IF to_regclass('public.agenda_bloqueos') IS NOT NULL THEN
    SELECT count(*) INTO v_n FROM pg_attribute a
     WHERE a.attrelid = to_regclass('public.agenda_bloqueos') AND a.attnum > 0 AND NOT a.attisdropped
       AND (a.attname, a.atttypid::regtype) IN (('id', 'uuid'::regtype), ('clinica_id', 'uuid'::regtype),
           ('medico_id', 'uuid'::regtype), ('inicio', 'timestamptz'::regtype), ('fin', 'timestamptz'::regtype),
           ('todo_el_dia', 'boolean'::regtype), ('zona', 'text'::regtype), ('motivo', 'text'::regtype),
           ('google_event_id', 'text'::regtype), ('gcal_calendar_id', 'text'::regtype), ('gcal_etag', 'text'::regtype),
           ('created_by', 'uuid'::regtype), ('created_at', 'timestamptz'::regtype), ('updated_at', 'timestamptz'::regtype));
    IF v_n <> 14 OR (SELECT count(*) FROM pg_attribute WHERE attrelid = to_regclass('public.agenda_bloqueos') AND attnum > 0 AND NOT attisdropped) <> 14 THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.agenda_bloqueos existe con otra forma.';
    END IF;
    -- Y con todas sus CHECK y FK (CREATE TABLE IF NOT EXISTS no las añadiría).
    IF (SELECT count(*) FROM pg_constraint WHERE conrelid = to_regclass('public.agenda_bloqueos') AND conname IN (
          'agenda_bloqueos_pkey', 'agenda_bloqueos_clinica_id_fkey', 'agenda_bloqueos_medico_id_fkey',
          'agenda_bloqueos_puntas_check', 'agenda_bloqueos_minuto_check', 'agenda_bloqueos_zona_check',
          'agenda_bloqueos_todo_el_dia_check', 'agenda_bloqueos_motivo_check', 'agenda_bloqueos_gcal_check')) <> 9 THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.agenda_bloqueos existe sin alguna de sus restricciones.';
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · La tabla, sus permisos y su RLS.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agenda_bloqueos (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  clinica_id       uuid        NOT NULL,
  medico_id        uuid        NOT NULL,
  inicio           timestamptz NOT NULL,
  fin              timestamptz NOT NULL,
  todo_el_dia      boolean     NOT NULL DEFAULT false,
  zona             text,
  motivo           text,
  google_event_id  text,
  gcal_calendar_id text,
  gcal_etag        text,
  created_by       uuid                 DEFAULT auth.uid(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agenda_bloqueos_pkey PRIMARY KEY (id),
  CONSTRAINT agenda_bloqueos_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  CONSTRAINT agenda_bloqueos_medico_id_fkey FOREIGN KEY (medico_id) REFERENCES public.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT agenda_bloqueos_puntas_check CHECK (fin > inicio AND fin - inicio <= interval '400 days'),
  -- Minutos enteros: la página de turnos trabaja en minutos; un fin con segundos
  -- haría ofrecer un turno que la RPC luego rechaza (revisión de seguridad, B2).
  CONSTRAINT agenda_bloqueos_minuto_check CHECK (date_trunc('minute', inicio) = inicio AND date_trunc('minute', fin) = fin),
  CONSTRAINT agenda_bloqueos_zona_check CHECK (zona IS NULL OR char_length(zona) BETWEEN 1 AND 64),
  CONSTRAINT agenda_bloqueos_todo_el_dia_check CHECK (NOT todo_el_dia OR (zona IS NOT NULL
    AND (inicio AT TIME ZONE zona)::time = '00:00'::time AND (fin AT TIME ZONE zona)::time = '00:00'::time)),
  CONSTRAINT agenda_bloqueos_motivo_check CHECK (motivo IS NULL OR (btrim(motivo) <> '' AND char_length(motivo) <= 120)),
  CONSTRAINT agenda_bloqueos_gcal_check CHECK (char_length(google_event_id) <= 1024 AND char_length(gcal_calendar_id) <= 1024
    AND char_length(gcal_etag) <= 300)
);

-- Un evento de Google liga como mucho un bloqueo por clínica (el sondeo busca por aquí).
CREATE UNIQUE INDEX IF NOT EXISTS agenda_bloqueos_evento_key ON public.agenda_bloqueos (clinica_id, google_event_id)
  WHERE google_event_id IS NOT NULL;
-- La lectura de la agenda y de la reserva: los de un médico que acaban después del
-- inicio del rango (por `fin`, para que los bloqueos pasados no se recorran: B1). También la FK a clinicas.
CREATE INDEX IF NOT EXISTS agenda_bloqueos_medico_idx ON public.agenda_bloqueos (clinica_id, medico_id, fin);
-- La FK RESTRICT a profiles (dar de baja a un médico busca aquí).
CREATE INDEX IF NOT EXISTS agenda_bloqueos_medico_fk_idx ON public.agenda_bloqueos (medico_id);

ALTER TABLE public.agenda_bloqueos ENABLE ROW LEVEL SECURITY;
-- Los privilegios por omisión de Supabase dan ALL a anon, authenticated y service_role.
REVOKE ALL ON TABLE public.agenda_bloqueos FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, DELETE ON TABLE public.agenda_bloqueos TO authenticated;
GRANT INSERT (clinica_id, medico_id, inicio, fin, todo_el_dia, zona, motivo) ON TABLE public.agenda_bloqueos TO authenticated;
GRANT UPDATE (inicio, fin, todo_el_dia, zona, motivo) ON TABLE public.agenda_bloqueos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agenda_bloqueos TO service_role;

-- Quién: el MISMO predicado que appointments_select/insert/update/delete.
DROP POLICY IF EXISTS agenda_bloqueos_select ON public.agenda_bloqueos;
CREATE POLICY agenda_bloqueos_select ON public.agenda_bloqueos FOR SELECT TO authenticated
  USING ((medico_id = auth.uid() OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria')
         AND clinica_id = public.get_clinica_id());
DROP POLICY IF EXISTS agenda_bloqueos_delete ON public.agenda_bloqueos;
CREATE POLICY agenda_bloqueos_delete ON public.agenda_bloqueos FOR DELETE TO authenticated
  USING ((medico_id = auth.uid() OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria')
         AND clinica_id = public.get_clinica_id());
-- Alta y edición: además las puertas de appointments_gates_insert (dentro del
-- PERMISSIVE: sin otra puerta RESTRICTIVE), la v2 encendida y el médico de la clínica.
DROP POLICY IF EXISTS agenda_bloqueos_insert ON public.agenda_bloqueos;
CREATE POLICY agenda_bloqueos_insert ON public.agenda_bloqueos FOR INSERT TO authenticated
  WITH CHECK ((medico_id = auth.uid() OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria')
              AND clinica_id = public.get_clinica_id()
              AND public.clinica_no_suspendida() AND public.clinica_tiene_acceso() AND public.perfil_completo()
              AND EXISTS (SELECT 1 FROM public.agenda_ajustes j WHERE j.clinica_id = public.get_clinica_id() AND j.agenda_v2_encendida)
              AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = agenda_bloqueos.medico_id AND p.clinica_id = public.get_clinica_id()));
DROP POLICY IF EXISTS agenda_bloqueos_update ON public.agenda_bloqueos;
CREATE POLICY agenda_bloqueos_update ON public.agenda_bloqueos FOR UPDATE TO authenticated
  USING ((medico_id = auth.uid() OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria')
         AND clinica_id = public.get_clinica_id())
  WITH CHECK ((medico_id = auth.uid() OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria')
              AND clinica_id = public.get_clinica_id()
              AND public.clinica_no_suspendida() AND public.clinica_tiene_acceso() AND public.perfil_completo()
              AND EXISTS (SELECT 1 FROM public.agenda_ajustes j WHERE j.clinica_id = public.get_clinica_id() AND j.agenda_v2_encendida));

COMMENT ON TABLE public.agenda_bloqueos IS
  'Tanda K (sección A): un periodo que el médico cierra a propósito (horas o días completos, motivo opcional). NO es una cita ni un evento. En el enlace de reserva no se ofrecen turnos que lo toquen (reserva_ocupacion) y reservar_por_enlace lo rechaza (''ocupado''); dentro de Spinus sólo pide confirmación. Lo crean, editan y quitan quienes pueden agendar para ese médico (mismo predicado que appointments). google_event_id/gcal_*: el evento «Ocupado» del calendario de Spinus, sólo los escribe el servidor; gcal_bloqueo_aplicar trae lo movido o borrado en Google. agenda_bloqueo_preparar toma el candado 1790 del médico.';

-- ---------------------------------------------------------------------
-- 3 · Antes de escribir: el candado del médico y updated_at.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agenda_bloqueo_preparar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  -- El candado de reservar_por_enlace (1790 + médico): un bloqueo y una
  -- reserva del mismo médico a la vez no se cruzan (ver la cabecera).
  -- Si cambia de médico, los dos candados en orden fijo (sin abrazo mortal, B3).
  IF TG_OP = 'UPDATE' AND OLD.medico_id IS DISTINCT FROM NEW.medico_id THEN
    PERFORM pg_advisory_xact_lock(1790, least(hashtext(OLD.medico_id::text), hashtext(NEW.medico_id::text)));
    PERFORM pg_advisory_xact_lock(1790, greatest(hashtext(OLD.medico_id::text), hashtext(NEW.medico_id::text)));
  ELSE
    PERFORM pg_advisory_xact_lock(1790, hashtext(NEW.medico_id::text));
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    NEW.updated_at := now();
  ELSIF NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN
    -- gcal_bloqueo_aplicar pone a propósito la hora del cambio de Google; lo demás, now().
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END
$fn$;
REVOKE EXECUTE ON FUNCTION public.agenda_bloqueo_preparar() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.agenda_bloqueo_preparar() TO anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_agenda_bloqueos_preparar ON public.agenda_bloqueos;
CREATE TRIGGER trg_agenda_bloqueos_preparar BEFORE INSERT OR UPDATE ON public.agenda_bloqueos
  FOR EACH ROW EXECUTE FUNCTION public.agenda_bloqueo_preparar();
DROP TRIGGER IF EXISTS audit_agenda_bloqueos ON public.agenda_bloqueos;
CREATE TRIGGER audit_agenda_bloqueos AFTER INSERT OR DELETE OR UPDATE ON public.agenda_bloqueos
  FOR EACH ROW EXECUTE FUNCTION public.log_tabla_change();

-- ---------------------------------------------------------------------
-- 4 · reserva_ocupacion (+ bloqueos, − todo el día) y reservar_por_enlace
--     (la comprobación de empalme). SUSTITUYENDO fragmentos exactos del
--     cuerpo VIGENTE (pg_get_functiondef → replace → EXECUTE, la técnica de
--     K3), no pegando un cuerpo copiado: así esta migración y la de K3
--     (20261123140000, «y no pausado» en la línea del enlace) se pueden
--     aplicar en cualquier orden sin pisarse. Los fragmentos y sus md5
--     posibles están en la tabla temporal de la sección 0.
-- ---------------------------------------------------------------------
-- Una función de LANGUAGE sql se valida entera al crearla: sus fragmentos se
-- sustituyen todos sobre la definición y se ejecuta UNA vez por función.
DO $$
DECLARE
  f record;
  s record;
  v_oid oid;
  v_def text;
  v_cambia boolean;
BEGIN
  FOR f IN SELECT DISTINCT firma FROM k1_sustituciones ORDER BY firma LOOP
    v_oid := to_regprocedure(f.firma);
    v_def := pg_get_functiondef(v_oid);
    v_cambia := false;
    FOR s IN SELECT * FROM k1_sustituciones WHERE firma = f.firma ORDER BY n LOOP
      CONTINUE WHEN pg_temp.k1_veces((SELECT prosrc FROM pg_proc WHERE oid = v_oid), s.nuevo) = 1;
      IF pg_temp.k1_veces(v_def, s.viejo) <> 1 THEN
        RAISE EXCEPTION 'k1: % no tiene el fragmento % una sola vez en su definición completa.', s.firma, s.n;
      END IF;
      v_def := replace(v_def, s.viejo, s.nuevo);
      v_cambia := true;
    END LOOP;
    IF v_cambia THEN
      EXECUTE v_def;
    END IF;
  END LOOP;
END $$;

-- Permisos de funciones (CLAUDE.md): CREATE OR REPLACE los conserva; se repiten
-- explícitos, los de D3/seg1/i2/j2: SÓLO service_role.
REVOKE EXECUTE ON FUNCTION public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz) TO service_role;
REVOKE EXECUTE ON FUNCTION public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) TO service_role;

COMMENT ON FUNCTION public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz) IS
  'Lo que ocupa en el enlace de reserva (D3, cambiado en seg1 y k1): sólo puntas. Las citas y eventos CON HORA del médico del enlace menos cancelled y no_show, y sus bloqueos (agenda_bloqueos). k1 (tanda K, punto 4): las filas de TODO EL DÍA de appointments ya NO ocupan. Sólo service_role; interruptor apagado o enlace revocado = nada; rango ≤ 15 días.';

COMMENT ON FUNCTION public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) IS
  'Reserva por enlace (D3, cambiada en seg1, i2, j2 y k1). Sólo service_role. Serializa por enlace (FOR UPDATE) y por médico (advisory 1790, que también toman los bloqueos). CONVENIO: horario del consultorio y alineación del turno (rejilla fija de G2) los comprueba el servidor antes de llamar (src/lib/reserva/turnosReserva.ts, ruta pública de D5); un llamador que no lo haga puede reservar fuera de horario sin que la base lo note. k1 (tanda K): ocupa lo que tiene hora (no lo de todo el día) y todo bloqueo del médico (agenda_bloqueos) que toque el turno: ''ocupado''. seg1: en el fijo la ficha del correo va antes que el candado; bloqueado = manual (teléfono o correo, también en el único) o automático por correo (sólo fijo); «1 activa» sólo por correo. A PROPÓSITO: el manual por teléfono no exige que el correo verificado sea de la misma persona, así que un «bloqueado» delata que la clínica bloqueó a mano ese teléfono (AG-DT-28, decisión de Angel). i2: p_correo y p_correo_hmac pueden llegar NULL juntos; el fijo sin correo da correo_sin_verificar. j2 (tanda J, punto 3): en el ÚNICO se IGNORAN p_correo y p_correo_hmac: la cita lleva el correo que escribió la clínica al emitir el enlace (reserva_enlaces.correo y su correo_hmac) o ninguno; sin él, reserva_correo NULL y reserva_correo_hmac = sha256(''reserva-sin-correo:''||id de la cita) en hex (seudónimo propio de i2, que no es el HMAC de ningún correo). Tope del único: cada llamada con un único vigente que no sea ''repetida'' suma reserva_enlaces.intentos; la 5.ª marca agotado_en; ''bloqueado'' lo agota en el acto; agotado devuelve ''enlace_agotado''; un client_id que ya es de otra cita, ''client_id_en_uso'' (contado; j2-b: también en carrera, porque el INSERT atrapa el unique_violation de idx_appointments_client_id sin deshacer el conteo). Devuelve UNA fila: usar .single().';

-- Post-vuelo que ABORTA (antes del COMMIT): cada fragmento nuevo una vez, el
-- cuerpo entre los conocidos, INVOKER y sólo service_role.
DO $$
DECLARE
  s record;
  p record;
BEGIN
  FOR s IN SELECT * FROM k1_sustituciones ORDER BY n LOOP
    SELECT * INTO p FROM pg_proc WHERE oid = to_regprocedure(s.firma);
    IF pg_temp.k1_veces(p.prosrc, s.nuevo) <> 1 OR pg_temp.k1_veces(p.prosrc, s.viejo) <> 0 OR p.prosecdef
       OR NOT (md5(p.prosrc) = ANY (s.md5_despues))
       OR has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
       OR NOT has_function_privilege('service_role', p.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'POST-VUELO FALLÓ: % (fragmento %) no quedó con su cambio, con un cuerpo conocido (md5 %), INVOKER y sólo service_role.',
        s.firma, s.n, md5(p.prosrc);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 5 · gcal_bloqueo_aplicar: lo movido o borrado en Google (punto 6).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gcal_bloqueo_aplicar(
  p_clinica_id uuid, p_calendar_id text, p_google_event_id text, p_bloqueo_id uuid, p_etag text,
  p_google_updated timestamptz, p_borrar boolean, p_inicio timestamptz, p_fin timestamptz, p_desde date, p_hasta date)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_b    public.agenda_bloqueos%ROWTYPE;
  v_zona text;
  v_ini  timestamptz;
  v_fin  timestamptz;
BEGIN
  IF p_clinica_id IS NULL OR p_calendar_id IS NULL OR p_google_event_id IS NULL OR p_borrar IS NULL
     OR (NOT p_borrar AND (p_etag IS NULL
         OR ((p_inicio IS NULL OR p_fin IS NULL) AND (p_desde IS NULL OR p_hasta IS NULL))
         OR (p_inicio IS NOT NULL AND p_desde IS NOT NULL))) THEN
    RAISE EXCEPTION 'gcal_bloqueo_aplicar: argumentos incoherentes' USING ERRCODE = '22023';
  END IF;
  IF length(p_calendar_id) > 1024 OR length(p_google_event_id) > 1024 OR length(p_etag) > 300 THEN
    RAISE EXCEPTION 'gcal_bloqueo_aplicar: texto demasiado largo' USING ERRCODE = '22023';
  END IF;
  -- Las mismas dos puertas que gcal_aplicar_evento: v2 encendida y la conexión activa de ESE calendario.
  IF NOT EXISTS (SELECT 1 FROM public.agenda_ajustes j WHERE j.clinica_id = p_clinica_id AND j.agenda_v2_encendida) THEN
    RETURN 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clinica_conexiones_google g
                  WHERE g.clinica_id = p_clinica_id AND g.rol = 'clinica' AND g.estado = 'activa'
                    AND g.calendar_id = p_calendar_id) THEN
    RETURN 0;
  END IF;

  -- Sólo un bloqueo que YA existe: el ligado a ese evento, o el de la marca
  -- privada mientras aún no tenga evento. Un evento de Google no crea bloqueos.
  -- Primero sin bloquear, para tomar el candado 1790 del médico ANTES que la
  -- fila (el orden de agenda_bloqueo_preparar y de reservar_por_enlace).
  SELECT b.* INTO v_b FROM public.agenda_bloqueos b
   WHERE b.clinica_id = p_clinica_id
     AND (b.gcal_calendar_id IS NULL OR b.gcal_calendar_id = p_calendar_id)
     AND (b.google_event_id = p_google_event_id
          OR (p_bloqueo_id IS NOT NULL AND b.id = p_bloqueo_id AND b.google_event_id IS NULL))
   ORDER BY (b.google_event_id IS NOT DISTINCT FROM p_google_event_id) DESC
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  PERFORM pg_advisory_xact_lock(1790, hashtext(v_b.medico_id::text));
  SELECT b.* INTO v_b FROM public.agenda_bloqueos b
   WHERE b.id = v_b.id AND b.clinica_id = p_clinica_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF p_borrar THEN
    DELETE FROM public.agenda_bloqueos WHERE id = v_b.id AND clinica_id = p_clinica_id;
    RETURN 1;
  END IF;
  -- Eco de lo que Spinus acaba de escribir, o Spinus más reciente: nada.
  IF p_etag IS NOT DISTINCT FROM v_b.gcal_etag
     OR (p_google_updated IS NOT NULL AND p_google_updated < v_b.updated_at) THEN
    RETURN 0;
  END IF;

  IF p_desde IS NOT NULL THEN
    v_zona := coalesce(v_b.zona, 'America/Mexico_City');
    v_ini := p_desde::timestamp AT TIME ZONE v_zona;
    v_fin := p_hasta::timestamp AT TIME ZONE v_zona;
  ELSE
    v_zona := v_b.zona;
    -- Al minuto (agenda_bloqueos_minuto_check): Google puede traer segundos.
    v_ini := date_trunc('minute', p_inicio);
    v_fin := date_trunc('minute', p_fin);
  END IF;
  IF v_fin <= v_ini OR v_fin - v_ini > interval '400 days' THEN
    RAISE EXCEPTION 'gcal_bloqueo_aplicar: puntas inválidas' USING ERRCODE = '22023';
  END IF;

  UPDATE public.agenda_bloqueos
     SET inicio = v_ini, fin = v_fin, todo_el_dia = (p_desde IS NOT NULL), zona = v_zona,
         google_event_id = p_google_event_id, gcal_calendar_id = p_calendar_id, gcal_etag = p_etag,
         -- La hora del cambio de GOOGLE, no now(): como gcal_aplicar_evento («gana el último»).
         updated_at = greatest(v_b.updated_at, coalesce(p_google_updated, now()))
   WHERE id = v_b.id AND clinica_id = p_clinica_id;
  RETURN 1;
END
$fn$;

-- Permisos de funciones (CLAUDE.md): SÓLO service_role (la llama el sondeo de Google con el cliente admin).
REVOKE EXECUTE ON FUNCTION public.gcal_bloqueo_aplicar(uuid, text, text, uuid, text, timestamptz, boolean, timestamptz, timestamptz, date, date) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.gcal_bloqueo_aplicar(uuid, text, text, uuid, text, timestamptz, boolean, timestamptz, timestamptz, date, date) TO service_role;

COMMENT ON FUNCTION public.gcal_bloqueo_aplicar(uuid, text, text, uuid, text, timestamptz, boolean, timestamptz, timestamptz, date, date) IS
  'Tanda K (punto 6): lo movido o borrado en Google de un evento de BLOQUEO vuelve al bloqueo, como un evento sin paciente. Sólo un bloqueo que ya existe (ligado al evento, o el de la marca privada spinus_bloqueo sin evento aún): nunca crea uno. Borrado = DELETE; movido = puntas (p_inicio/p_fin con hora, o p_desde/p_hasta de todo el día en la zona del bloqueo) si Google es más reciente; mismo etag = eco. Puertas: v2 encendida y conexión activa de ese calendario. Sólo service_role. Devuelve filas tocadas (0 o 1).';

COMMIT;

-- ---------------------------------------------------------------------
-- 6 · Veredicto (sólo lectura). Todo «OK».
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'reservar_por_enlace: cuerpo k1, con o sin K3 (md5) / invoker / search_path vacío / VOLATILE' AS comprobacion,
         coalesce((SELECT (md5(p.prosrc) IN ('eb5ec46ca21cad79a690fb704fbf662c', 'be25c16726eb90839767fd4bd9176195'))::text || ' / ' || p.prosecdef::text || ' / ' || (p.proconfig @> ARRAY['search_path=""'])::text || ' / ' || p.provolatile::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)')), 'AUSENTE') AS valor,
         'true / false / true / v' AS esperado
  UNION ALL
  SELECT 2, 'reserva_ocupacion: cuerpo k1, con o sin K3 (md5) / invoker / search_path vacío / STABLE',
         coalesce((SELECT (md5(p.prosrc) IN ('e7cf1c347ef5391b3078a02744fdf5d4', 'f1701599edf6756887fbb01a8c18464f'))::text || ' / ' || p.prosecdef::text || ' / ' || (p.proconfig @> ARRAY['search_path=""'])::text || ' / ' || p.provolatile::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz)')), 'AUSENTE'),
         'true / false / true / s'
  UNION ALL
  SELECT 3, 'la garantía atómica sigue: FOR UPDATE del enlace, candado 1790, READ COMMITTED; bloque del INSERT',
         coalesce((SELECT (p.prosrc LIKE '%PERFORM pg_advisory_xact_lock(1790, hashtext(v_enl.medico_id::text));%'
                           AND p.prosrc LIKE '%WHERE e.codigo_hash = p_codigo_hash AND e.clinica_id = p_clinica_id%FOR UPDATE;%'
                           AND p.prosrc LIKE '%current_setting(''transaction_isolation'') <> ''read committed''%'
                           AND p.prosrc LIKE '%EXCEPTION WHEN unique_violation THEN%idx_appointments_client_id%RAISE;%')::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)')), 'AUSENTE'),
         'true'
  UNION ALL
  SELECT 4, 'el orden sigue: contador del único → fuera_de_ventana → ocupado (con bloqueos) → ficha del fijo → candado de persona',
         coalesce((SELECT (p.prosrc LIKE '%SET intentos = intentos + 1%''fuera_de_ventana''%NOT a.all_day%public.agenda_bloqueos b%''ocupado''%reserva_verificaciones%reserva_contacto_estado%')::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)')), 'AUSENTE'),
         'true'
  UNION ALL
  SELECT 5, 'EXECUTE anon / authenticated / service_role / PUBLIC (reservar, ocupación, gcal_bloqueo_aplicar)',
         (SELECT string_agg(has_function_privilege('anon', p.oid, 'EXECUTE')::text || ' / ' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                          || ' / ' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text || ' / '
                          || EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                      WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')::text, ' | ' ORDER BY p.proname)
            FROM pg_proc p
           WHERE p.oid IN (to_regprocedure('public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)'),
                           to_regprocedure('public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz)'),
                           to_regprocedure('public.gcal_bloqueo_aplicar(uuid, text, text, uuid, text, timestamptz, boolean, timestamptz, timestamptz, date, date)'))),
         'false / false / true / false | false / false / true / false | false / false / true / false'
  UNION ALL
  SELECT 6, 'agenda_bloqueo_preparar: invoker / search_path vacío / sin PUBLIC / anon,authenticated,service_role',
         coalesce((SELECT p.prosecdef::text || ' / ' || (p.proconfig @> ARRAY['search_path=""'])::text || ' / '
                          || EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                      WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')::text || ' / '
                          || (has_function_privilege('anon', p.oid, 'EXECUTE') AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
                              AND has_function_privilege('service_role', p.oid, 'EXECUTE'))::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.agenda_bloqueo_preparar()')), 'AUSENTE'),
         'false / true / false / true'
  UNION ALL
  SELECT 7, 'agenda_bloqueos: RLS / privilegios anon / authenticated / service_role',
         coalesce((SELECT relrowsecurity::text FROM pg_class WHERE oid = to_regclass('public.agenda_bloqueos')), 'AUSENTE')
         || ' / ' || coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
                    WHERE table_schema = 'public' AND table_name = 'agenda_bloqueos' AND grantee = 'anon'), '-')
         || ' / ' || coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
                    WHERE table_schema = 'public' AND table_name = 'agenda_bloqueos' AND grantee = 'authenticated'), '-')
         || ' / ' || coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
                    WHERE table_schema = 'public' AND table_name = 'agenda_bloqueos' AND grantee = 'service_role'), '-'),
         'true / - / DELETE,SELECT / DELETE,INSERT,SELECT,UPDATE'
  UNION ALL
  SELECT 8, 'columnas que authenticated escribe (INSERT | UPDATE)',
         coalesce((SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.column_privileges
                    WHERE table_schema = 'public' AND table_name = 'agenda_bloqueos' AND grantee = 'authenticated' AND privilege_type = 'INSERT'), '-')
         || ' | ' || coalesce((SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.column_privileges
                    WHERE table_schema = 'public' AND table_name = 'agenda_bloqueos' AND grantee = 'authenticated' AND privilege_type = 'UPDATE'), '-'),
         'clinica_id,fin,inicio,medico_id,motivo,todo_el_dia,zona | fin,inicio,motivo,todo_el_dia,zona'
  UNION ALL
  SELECT 9, 'policies (todas PERMISSIVE)',
         (SELECT string_agg(policyname || ':' || cmd || ':' || permissive, ',' ORDER BY policyname) FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'agenda_bloqueos'),
         'agenda_bloqueos_delete:DELETE:PERMISSIVE,agenda_bloqueos_insert:INSERT:PERMISSIVE,agenda_bloqueos_select:SELECT:PERMISSIVE,agenda_bloqueos_update:UPDATE:PERMISSIVE'
  UNION ALL
  SELECT 10, 'FK RESTRICT (clinicas, profiles) y ninguna otra',
         coalesce((SELECT string_agg(conname || ':' || confdeltype::text, ',' ORDER BY conname) FROM pg_constraint
                    WHERE conrelid = to_regclass('public.agenda_bloqueos') AND contype = 'f'), 'NINGUNA'),
         'agenda_bloqueos_clinica_id_fkey:r,agenda_bloqueos_medico_id_fkey:r'
  UNION ALL
  SELECT 11, 'disparadores de agenda_bloqueos',
         (SELECT string_agg(tgname, ',' ORDER BY tgname) FROM pg_trigger
           WHERE NOT tgisinternal AND tgrelid = to_regclass('public.agenda_bloqueos')),
         'audit_agenda_bloqueos,trg_agenda_bloqueos_preparar'
  UNION ALL
  SELECT 12, 'policies de appointments, intactas (nombres)',
         (SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'appointments'),
         'appointments_delete,appointments_gates_insert,appointments_insert,appointments_select,appointments_update'
  UNION ALL
  SELECT 13, 'clinica_no_suspendida / clinica_tiene_acceso intactas (md5)',
         (SELECT string_agg(md5(prosrc), ' / ' ORDER BY proname) FROM pg_proc
           WHERE oid IN (to_regprocedure('public.clinica_no_suspendida()'), to_regprocedure('public.clinica_tiene_acceso()'))),
         'a2dcfa8f2cfda91bc9c7a7ff7b642e1e / 2efd7734772dd4c7bea262e43a3779b5'
) t ORDER BY t.n;
