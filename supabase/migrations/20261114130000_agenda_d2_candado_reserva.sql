-- ═══════════════════════════════════════════════════════════════════════
-- Agenda D2 — candado de la reserva por enlace: incidencias (cancelación y
-- no_show), bloqueo y desbloqueo manual, y estado del contacto
-- Rama: feature/agenda-v2 (worktree feature/agenda-v2-d) · Escrita: 2026-11-11
-- Riesgo estimado: MEDIO (disparador nuevo en appointments que, si falla,
-- hace fallar la cancelación —P10—; dos tablas nuevas vacías).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-11-12
--   `docker exec -i supabase_db_app_ortointegra psql -U postgres
--   -v ON_ERROR_STOP=1 -f` del archivo completo (rejilla: 6 × OK + 1 INFO,
--   0 / 0), y una segunda pasada: misma rejilla, sólo 5 NOTICE «already
--   exists, skipping» (2 tablas, 3 índices), y no-op comprobado con la huella
--   de catálogo de D1 ampliada a estas tablas (206 renglones: columnas,
--   relacl, RLS, COMMENT, constraints, índices, policies, disparadores de
--   appointments y de las tablas nuevas, md5/proacl/prosecdef/COMMENT de las
--   funciones) y count(*) de audit_log de las dos tablas: sin diferencias.
--   Anotada a mano en supabase_migrations.schema_migrations (versión
--   20261114130000, 45 sentencias), como D1.
--   Pruebas: supabase/pruebas-sql/d2_candado_reserva.sql (bash
--   scripts/pruebas-sql.sh).
--   Comprobación:
--     select tgfoid::regproc from pg_trigger
--      where tgrelid = 'public.appointments'::regclass
--        and tgname = 'trg_appointments_reserva_incidencia';
--   → reserva_registrar_incidencia.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de D1).
-- AUDITORÍA INDEPENDIENTE 2026-11-12: APTA CON CAMBIOS
-- (supabase/AUDITORIA-MIGRACIONES.md). Aplicado antes de aplicar en local:
--   · El pre-vuelo comprueba el dueño de appointments, clinicas y profiles
--     (antes sólo appointments).
--   · reserva_contactos_bloqueados() miraba citas de los últimos 400 días,
--     fijo, y candado_ventana_dias no tiene tope. El auditor propuso
--     ventana + 30; se eligió ventana + 366, porque cuenta la fecha de ALTA de
--     la cita y una reserva con el horizonte máximo (365) cancelada al final
--     de la ventana quedaría fuera con + 30.
--   · Supuesto que el auditor no pudo verificar: los dos *_hmac son de datos
--     reales. Lo garantiza D3 (exige teléfono y correo) y hmacContacto('')
--     devuelve null; queda escrito junto al disparador.
--   Dimensión propuesta por el auditor (no se tocó AUDITORIA-MIGRACIONES.md):
--   invariantes prestadas de un archivo fuera del encargo, y números fijos que
--   apuestan por el tope de un CHECK que no lo tiene.
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- §2 «Candado»: 3 cancelaciones o inasistencias en 60 días (candado_* de
-- agenda_ajustes) cierran el autoservicio con ESE médico; se levanta solo o
-- a mano. Persona = teléfono O correo normalizados (cualquiera de los dos
-- coincide), por médico, vía los *_hmac de D1.
-- reserva_incidencias la escribe SÓLO reserva_registrar_incidencia(), un
-- disparador SECURITY DEFINER (la escritura de la cita la hace quien sea:
-- personal, Google por C2, o la reserva). Reactivar una cita anula su
-- incidencia; pasar de cancelled a no_show la re-etiqueta (no cuenta doble).
-- reserva_contactos guarda el bloqueo manual (bloqueado_en) y el desbloqueo
-- manual (perdonado_en): desbloquear también pone a cero el conteo
-- automático (las incidencias anteriores a perdonado_en no cuentan).
-- Ninguna función escribe agenda_ajustes: sólo leen candado_*.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO. Requiere D1.
-- Bloqueos: CREATE TABLE con FK → SHARE ROW EXCLUSIVE un instante sobre
--   clinicas, profiles y appointments. CREATE TRIGGER sobre appointments →
--   SHARE ROW EXCLUSIVE hasta el COMMIT (bloquea escrituras de citas un
--   instante, no lecturas). lock_timeout 5 s.
-- Orden respecto al código: PRIMERO esta migración.
-- Alcance de los roles:
--   gana — médico: ver el historial y bloquear/desbloquear los contactos de
--          SUS citas por enlace; administrador y secretaria: los de toda la
--          clínica; service_role: leer las dos tablas.
--   pierde — anon: todo sobre las dos tablas; authenticated: escribir
--          reserva_incidencias (sólo el disparador), DELETE/TRUNCATE en
--          reserva_contactos. appointments: sin cambio de permisos.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   DROP TRIGGER IF EXISTS trg_appointments_reserva_incidencia ON public.appointments;
--   DROP FUNCTION IF EXISTS public.reserva_contactos_bloqueados();
--   DROP FUNCTION IF EXISTS public.reserva_contacto_marcar(uuid, text);
--   DROP FUNCTION IF EXISTS public.reserva_contacto_estado(uuid, uuid, text, text);
--   DROP TABLE IF EXISTS public.reserva_contactos; DROP TABLE IF EXISTS public.reserva_incidencias;
--   DROP FUNCTION IF EXISTS public.reserva_registrar_incidencia(); DROP FUNCTION IF EXISTS public.proteger_reserva_contactos();
-- Pierde el historial del candado. Respaldar antes las dos tablas.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

DO $$
DECLARE
  v_cols  text[];
  v_tabla text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass
                  AND attname = 'reserva_tel_hmac' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta D1 (appointments.reserva_tel_hmac).';
  END IF;
  -- Dueño de appointments (el disparador) y de clinicas y profiles (las FK).
  FOREACH v_tabla IN ARRAY ARRAY['public.appointments', 'public.clinicas', 'public.profiles'] LOOP
    IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = v_tabla::regclass), 'USAGE') THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: el rol % no es dueño de %.', current_user, v_tabla;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.appointments'::regclass
              AND tgname = 'trg_appointments_reserva_incidencia'
              AND tgfoid IS DISTINCT FROM to_regprocedure('public.reserva_registrar_incidencia()')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: trg_appointments_reserva_incidencia existe y apunta a otra función.';
  END IF;
  IF to_regclass('public.reserva_incidencias') IS NOT NULL THEN
    SELECT array_agg(attname::text) INTO v_cols FROM pg_attribute
     WHERE attrelid = 'public.reserva_incidencias'::regclass AND attnum > 0 AND NOT attisdropped;
    IF NOT (v_cols @> ARRAY['id','clinica_id','medico_id','appointment_id','tipo','tel_hmac','correo_hmac','anulada_en','created_at']
            AND v_cols <@ ARRAY['id','clinica_id','medico_id','appointment_id','tipo','tel_hmac','correo_hmac','anulada_en','created_at']) THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: reserva_incidencias existe con OTRAS columnas (%).', v_cols;
    END IF;
  END IF;
  IF to_regclass('public.reserva_contactos') IS NOT NULL THEN
    SELECT array_agg(attname::text) INTO v_cols FROM pg_attribute
     WHERE attrelid = 'public.reserva_contactos'::regclass AND attnum > 0 AND NOT attisdropped;
    IF NOT (v_cols @> ARRAY['id','clinica_id','medico_id','clave_hmac','clase','bloqueado_en','bloqueado_por','perdonado_en','perdonado_por','created_at','updated_at']
            AND v_cols <@ ARRAY['id','clinica_id','medico_id','clave_hmac','clase','bloqueado_en','bloqueado_por','perdonado_en','perdonado_por','created_at','updated_at']) THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: reserva_contactos existe con OTRAS columnas (%).', v_cols;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE prosecdef AND oid IN (
       to_regprocedure('public.proteger_reserva_contactos()'), to_regprocedure('public.reserva_contacto_estado(uuid, uuid, text, text)'),
       to_regprocedure('public.reserva_contacto_marcar(uuid, text)'), to_regprocedure('public.reserva_contactos_bloqueados()'))) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: una función de D2 que debe ser invoker existe como SECURITY DEFINER.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.reserva_incidencias (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  clinica_id     uuid        NOT NULL,
  medico_id      uuid        NOT NULL,
  appointment_id uuid        NOT NULL,
  tipo           text        NOT NULL,
  tel_hmac       text        NOT NULL,
  correo_hmac    text        NOT NULL,
  anulada_en     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reserva_incidencias_pkey PRIMARY KEY (id),
  CONSTRAINT reserva_incidencias_clinica_fkey FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  CONSTRAINT reserva_incidencias_medico_fkey FOREIGN KEY (medico_id) REFERENCES public.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT reserva_incidencias_cita_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE RESTRICT,
  CONSTRAINT reserva_incidencias_tipo_check CHECK (tipo IN ('cancelacion', 'no_show')),
  CONSTRAINT reserva_incidencias_hmac_check CHECK (tel_hmac ~ '^[0-9a-f]{64}$' AND correo_hmac ~ '^[0-9a-f]{64}$')
);
CREATE INDEX IF NOT EXISTS reserva_incidencias_tel ON public.reserva_incidencias (clinica_id, medico_id, tel_hmac, created_at)
  WHERE anulada_en IS NULL;
CREATE INDEX IF NOT EXISTS reserva_incidencias_correo ON public.reserva_incidencias (clinica_id, medico_id, correo_hmac, created_at)
  WHERE anulada_en IS NULL;
CREATE INDEX IF NOT EXISTS reserva_incidencias_cita ON public.reserva_incidencias (appointment_id);

CREATE TABLE IF NOT EXISTS public.reserva_contactos (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  clinica_id    uuid        NOT NULL,
  medico_id     uuid        NOT NULL,
  clave_hmac    text        NOT NULL,
  clase         text        NOT NULL,
  bloqueado_en  timestamptz,
  bloqueado_por uuid,
  perdonado_en  timestamptz,
  perdonado_por uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reserva_contactos_pkey PRIMARY KEY (id),
  CONSTRAINT reserva_contactos_clave_key UNIQUE (clinica_id, medico_id, clave_hmac),
  CONSTRAINT reserva_contactos_clinica_fkey FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  CONSTRAINT reserva_contactos_medico_fkey FOREIGN KEY (medico_id) REFERENCES public.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT reserva_contactos_bloqueado_por_fkey FOREIGN KEY (bloqueado_por) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT reserva_contactos_perdonado_por_fkey FOREIGN KEY (perdonado_por) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT reserva_contactos_clase_check CHECK (clase IN ('telefono', 'correo')),
  CONSTRAINT reserva_contactos_hmac_check CHECK (clave_hmac ~ '^[0-9a-f]{64}$')
);

ALTER TABLE public.reserva_incidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserva_contactos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.reserva_incidencias FROM anon, authenticated, service_role;
GRANT SELECT ON TABLE public.reserva_incidencias TO authenticated, service_role;
REVOKE ALL ON TABLE public.reserva_contactos FROM anon, service_role;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.reserva_contactos FROM authenticated;
GRANT SELECT ON TABLE public.reserva_contactos TO service_role;

DROP POLICY IF EXISTS reserva_incidencias_select ON public.reserva_incidencias;
CREATE POLICY reserva_incidencias_select ON public.reserva_incidencias FOR SELECT TO authenticated
  USING (clinica_id = public.get_clinica_id()
         AND (medico_id = auth.uid() OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria'));
DROP POLICY IF EXISTS reserva_contactos_select ON public.reserva_contactos;
CREATE POLICY reserva_contactos_select ON public.reserva_contactos FOR SELECT TO authenticated
  USING (clinica_id = public.get_clinica_id()
         AND (medico_id = auth.uid() OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria'));
DROP POLICY IF EXISTS reserva_contactos_insert ON public.reserva_contactos;
CREATE POLICY reserva_contactos_insert ON public.reserva_contactos FOR INSERT TO authenticated
  WITH CHECK (clinica_id = public.get_clinica_id()
              AND (medico_id = auth.uid() OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria'));
DROP POLICY IF EXISTS reserva_contactos_update ON public.reserva_contactos;
CREATE POLICY reserva_contactos_update ON public.reserva_contactos FOR UPDATE TO authenticated
  USING (clinica_id = public.get_clinica_id()
         AND (medico_id = auth.uid() OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria'))
  WITH CHECK (clinica_id = public.get_clinica_id()
              AND (medico_id = auth.uid() OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria'));

-- Disparador de appointments. DEFINER sólo para insertar en reserva_incidencias
-- (sin policy de INSERT); no escribe ninguna otra tabla. RETURNS trigger: no
-- invocable por RPC (B0, caso 9; Postgres: «trigger functions can only be
-- called as triggers»). Supone que los dos *_hmac son de datos reales: D3
-- exige teléfono Y correo al reservar y el servidor no seudonimiza vacíos
-- (hmacContacto('') = null), así que dos personas no comparten seudónimo.
CREATE OR REPLACE FUNCTION public.reserva_registrar_incidencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  c_cuentan CONSTANT text[] := ARRAY['cancelled', 'no_show'];
BEGIN
  IF NEW.reserva_canal IS NULL OR NEW.medico_id IS NULL
     OR NEW.reserva_tel_hmac IS NULL OR NEW.reserva_correo_hmac IS NULL THEN
    RETURN NULL;
  END IF;
  IF NEW.status = ANY (c_cuentan) AND NOT (OLD.status = ANY (c_cuentan)) THEN
    INSERT INTO public.reserva_incidencias (clinica_id, medico_id, appointment_id, tipo, tel_hmac, correo_hmac)
    VALUES (NEW.clinica_id, NEW.medico_id, NEW.id,
            CASE NEW.status WHEN 'cancelled' THEN 'cancelacion' ELSE 'no_show' END,
            NEW.reserva_tel_hmac, NEW.reserva_correo_hmac);
  ELSIF OLD.status = ANY (c_cuentan) AND NOT (NEW.status = ANY (c_cuentan)) THEN
    UPDATE public.reserva_incidencias SET anulada_en = now()
     WHERE appointment_id = NEW.id AND clinica_id = NEW.clinica_id AND anulada_en IS NULL;
  ELSIF OLD.status = ANY (c_cuentan) AND NEW.status = ANY (c_cuentan) THEN
    UPDATE public.reserva_incidencias
       SET tipo = CASE NEW.status WHEN 'cancelled' THEN 'cancelacion' ELSE 'no_show' END
     WHERE appointment_id = NEW.id AND clinica_id = NEW.clinica_id AND anulada_en IS NULL;
  END IF;
  RETURN NULL;
END
$fn$;
REVOKE EXECUTE ON FUNCTION public.reserva_registrar_incidencia() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserva_registrar_incidencia() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.proteger_reserva_contactos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    IF TG_OP = 'UPDATE' THEN NEW.updated_at := now(); END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.created_at    := now();
    NEW.updated_at    := now();
    NEW.bloqueado_por := CASE WHEN NEW.bloqueado_en IS NOT NULL THEN auth.uid() END;
    NEW.bloqueado_en  := CASE WHEN NEW.bloqueado_en IS NOT NULL THEN now() END;
    NEW.perdonado_por := CASE WHEN NEW.perdonado_en IS NOT NULL THEN auth.uid() END;
    NEW.perdonado_en  := CASE WHEN NEW.perdonado_en IS NOT NULL THEN now() END;
    RETURN NEW;
  END IF;
  IF (NEW.id, NEW.clinica_id, NEW.medico_id, NEW.clave_hmac, NEW.clase, NEW.created_at)
     IS DISTINCT FROM (OLD.id, OLD.clinica_id, OLD.medico_id, OLD.clave_hmac, OLD.clase, OLD.created_at) THEN
    RAISE EXCEPTION 'La identidad de un contacto no cambia' USING ERRCODE = '42501';
  END IF;
  NEW.updated_at := now();
  IF NEW.bloqueado_en IS DISTINCT FROM OLD.bloqueado_en THEN
    IF NEW.bloqueado_en IS NULL THEN
      RAISE EXCEPTION 'Se desbloquea con perdonado_en, no borrando el bloqueo' USING ERRCODE = '42501';
    END IF;
    NEW.bloqueado_en := now(); NEW.bloqueado_por := auth.uid();
  ELSE
    NEW.bloqueado_por := OLD.bloqueado_por;
  END IF;
  IF NEW.perdonado_en IS DISTINCT FROM OLD.perdonado_en THEN
    IF NEW.perdonado_en IS NULL THEN
      RAISE EXCEPTION 'Un desbloqueo no se deshace: se vuelve a bloquear' USING ERRCODE = '42501';
    END IF;
    NEW.perdonado_en := now(); NEW.perdonado_por := auth.uid();
  ELSE
    NEW.perdonado_por := OLD.perdonado_por;
  END IF;
  RETURN NEW;
END
$fn$;
REVOKE EXECUTE ON FUNCTION public.proteger_reserva_contactos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proteger_reserva_contactos() TO anon, authenticated, service_role;

-- Estado del contacto. INVOKER: con authenticated sólo ve SU clínica (RLS);
-- con service_role (reservar_por_enlace) ve lo que p_clinica_id acota.
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
  k AS (
    SELECT max(c.perdonado_en) AS perdonado,
           coalesce(bool_or(c.bloqueado_en IS NOT NULL
                            AND (c.perdonado_en IS NULL OR c.perdonado_en < c.bloqueado_en)), false) AS manual
      FROM public.reserva_contactos c
     WHERE c.clinica_id = p_clinica_id AND c.medico_id = p_medico_id
       AND c.clave_hmac IN (p_tel_hmac, p_correo_hmac)
  ),
  i AS (
    SELECT x.tipo, x.created_at, row_number() OVER (ORDER BY x.created_at DESC) AS n
      FROM public.reserva_incidencias x CROSS JOIN aj CROSS JOIN k
     WHERE x.clinica_id = p_clinica_id AND x.medico_id = p_medico_id AND x.anulada_en IS NULL
       AND (x.tel_hmac = p_tel_hmac OR x.correo_hmac = p_correo_hmac)
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
REVOKE EXECUTE ON FUNCTION public.reserva_contacto_estado(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserva_contacto_estado(uuid, uuid, text, text) TO authenticated, service_role;

-- Bloquear / desbloquear desde una cita por enlace. Sólo sesión (RLS de
-- appointments y de reserva_contactos); service_role no tiene clínica.
CREATE OR REPLACE FUNCTION public.reserva_contacto_marcar(p_cita_id uuid, p_accion text)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v       record;
  v_clave record;
  v_n     integer := 0;
BEGIN
  IF p_cita_id IS NULL OR p_accion IS NULL OR p_accion NOT IN ('bloquear', 'desbloquear') THEN
    RAISE EXCEPTION 'reserva_contacto_marcar: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  SELECT a.clinica_id, a.medico_id, a.reserva_tel_hmac, a.reserva_correo_hmac INTO v
    FROM public.appointments a
   WHERE a.id = p_cita_id AND a.clinica_id = public.get_clinica_id()
     AND a.reserva_canal IS NOT NULL AND a.medico_id IS NOT NULL;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  FOR v_clave IN SELECT * FROM (VALUES (v.reserva_tel_hmac, 'telefono'), (v.reserva_correo_hmac, 'correo')) t(clave, clase) LOOP
    INSERT INTO public.reserva_contactos AS c (clinica_id, medico_id, clave_hmac, clase, bloqueado_en, perdonado_en)
    VALUES (v.clinica_id, v.medico_id, v_clave.clave, v_clave.clase,
            CASE WHEN p_accion = 'bloquear' THEN now() END,
            CASE WHEN p_accion = 'desbloquear' THEN now() END)
    ON CONFLICT (clinica_id, medico_id, clave_hmac) DO UPDATE
      SET bloqueado_en = CASE WHEN p_accion = 'bloquear' THEN now() ELSE c.bloqueado_en END,
          perdonado_en = CASE WHEN p_accion = 'desbloquear' THEN now() ELSE c.perdonado_en END;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END
$fn$;
REVOKE EXECUTE ON FUNCTION public.reserva_contacto_marcar(uuid, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.reserva_contacto_marcar(uuid, text) TO authenticated;

-- Lista de bloqueados: un renglón por (médico, teléfono, correo) con la cita
-- más reciente para enseñar quién es. Bajo la RLS de appointments. Mira las
-- citas creadas en los últimos (ventana del candado + 366) días: una cita
-- reservada con el horizonte máximo (365) y cancelada al final de la ventana
-- sigue dentro. candado_ventana_dias no tiene tope en su CHECK, por eso no es
-- un número fijo. Límite conocido: un bloqueo MANUAL de alguien sin citas en
-- ese plazo no sale en la lista (sigue bloqueando).
CREATE OR REPLACE FUNCTION public.reserva_contactos_bloqueados()
RETURNS TABLE (cita_id uuid, medico_id uuid, nombre text, telefono text, correo text,
               manual boolean, cancelaciones integer, no_shows integer, hasta timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
  WITH ventana AS (
    SELECT coalesce((SELECT j.candado_ventana_dias FROM public.agenda_ajustes j
                      WHERE j.clinica_id = public.get_clinica_id()), 60) + 366 AS dias
  )
  SELECT u.id, u.medico_id, u.reserva_nombre, u.reserva_telefono, u.reserva_correo,
         e.manual, e.cancelaciones, e.no_shows, e.hasta
    FROM (
      SELECT DISTINCT ON (a.medico_id, a.reserva_tel_hmac, a.reserva_correo_hmac)
             a.id, a.clinica_id, a.medico_id, a.reserva_nombre, a.reserva_telefono, a.reserva_correo,
             a.reserva_tel_hmac, a.reserva_correo_hmac
        FROM public.appointments a CROSS JOIN ventana v
       WHERE a.clinica_id = public.get_clinica_id()
         AND a.reserva_canal IS NOT NULL AND a.medico_id IS NOT NULL
         AND a.created_at > now() - make_interval(days => v.dias)
       ORDER BY a.medico_id, a.reserva_tel_hmac, a.reserva_correo_hmac, a.created_at DESC
    ) u
   CROSS JOIN LATERAL public.reserva_contacto_estado(u.clinica_id, u.medico_id, u.reserva_tel_hmac, u.reserva_correo_hmac) e
   WHERE e.bloqueado
   ORDER BY u.reserva_nombre
   LIMIT 500;
$fn$;
REVOKE EXECUTE ON FUNCTION public.reserva_contactos_bloqueados() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.reserva_contactos_bloqueados() TO authenticated;

CREATE OR REPLACE TRIGGER trg_reserva_contactos_proteger
  BEFORE INSERT OR UPDATE ON public.reserva_contactos
  FOR EACH ROW EXECUTE FUNCTION public.proteger_reserva_contactos();
CREATE OR REPLACE TRIGGER audit_reserva_contactos
  AFTER INSERT OR UPDATE OR DELETE ON public.reserva_contactos
  FOR EACH ROW EXECUTE FUNCTION public.log_tabla_change();
CREATE OR REPLACE TRIGGER trg_appointments_reserva_incidencia
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW
  WHEN (NEW.reserva_canal IS NOT NULL AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.reserva_registrar_incidencia();

COMMENT ON TABLE public.reserva_incidencias IS
  'Cancelaciones y no_show de citas por enlace (candado D2). La escribe SÓLO reserva_registrar_incidencia(). anulada_en = la cita se reactivó. Seudónimos (HMAC), sin datos en claro.';
COMMENT ON TABLE public.reserva_contactos IS
  'Bloqueo (bloqueado_en) y desbloqueo (perdonado_en) manuales por contacto y médico. Desbloquear también descuenta las incidencias anteriores. Lo escribe reserva_contacto_marcar().';

COMMIT;

SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO' WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'RLS incidencias / contactos' AS comprobacion,
         coalesce((SELECT relrowsecurity::text FROM pg_class WHERE oid = to_regclass('public.reserva_incidencias')), 'AUSENTE') || ' / '
         || coalesce((SELECT relrowsecurity::text FROM pg_class WHERE oid = to_regclass('public.reserva_contactos')), 'AUSENTE') AS valor,
         'true / true' AS esperado
  UNION ALL
  SELECT 2, 'policies incidencias / contactos',
         coalesce((SELECT string_agg(cmd, ',' ORDER BY cmd) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reserva_incidencias'), '-') || ' / '
         || coalesce((SELECT string_agg(cmd, ',' ORDER BY cmd) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reserva_contactos'), '-'),
         'SELECT / INSERT,SELECT,UPDATE'
  UNION ALL
  SELECT 3, 'disparador de incidencias en appointments',
         coalesce((SELECT tgfoid::regproc::text || '/' || tgenabled::text FROM pg_trigger
                    WHERE tgrelid = 'public.appointments'::regclass AND tgname = 'trg_appointments_reserva_incidencia'), 'AUSENTE'),
         'reserva_registrar_incidencia/O'
  UNION ALL
  SELECT 4, 'funciones: definer / EXECUTE anon,authenticated,service_role',
         (SELECT string_agg(p.proname || '=' || p.prosecdef::text || '/' || has_function_privilege('anon', p.oid, 'EXECUTE')::text
                  || ',' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || ','
                  || has_function_privilege('service_role', p.oid, 'EXECUTE')::text, ' ; ' ORDER BY p.proname)
            FROM pg_proc p WHERE p.oid IN (to_regprocedure('public.reserva_registrar_incidencia()'),
              to_regprocedure('public.proteger_reserva_contactos()'), to_regprocedure('public.reserva_contacto_estado(uuid, uuid, text, text)'),
              to_regprocedure('public.reserva_contacto_marcar(uuid, text)'), to_regprocedure('public.reserva_contactos_bloqueados()'))),
         'proteger_reserva_contactos=false/true,true,true ; reserva_contacto_estado=false/false,true,true ; reserva_contacto_marcar=false/false,true,false ; reserva_contactos_bloqueados=false/false,true,false ; reserva_registrar_incidencia=true/true,true,true'
  UNION ALL
  SELECT 5, 'FKs de incidencias en RESTRICT',
         (SELECT string_agg(conname || '=' || confdeltype::text, ',' ORDER BY conname) FROM pg_constraint
           WHERE conrelid = to_regclass('public.reserva_incidencias') AND contype = 'f'),
         'reserva_incidencias_cita_fkey=r,reserva_incidencias_clinica_fkey=r,reserva_incidencias_medico_fkey=r'
  UNION ALL
  SELECT 6, 'las 5 policies de appointments, intactas',
         (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'appointments'), '5'
  UNION ALL
  SELECT 7, 'censo incidencias / contactos',
         (SELECT count(*)::text FROM public.reserva_incidencias) || ' / ' || (SELECT count(*)::text FROM public.reserva_contactos), NULL
) t
ORDER BY t.n;
