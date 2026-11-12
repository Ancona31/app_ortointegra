-- ═══════════════════════════════════════════════════════════════════════
-- Agenda B6 — tipos de cita (de clínica o de médico) y appointments.tipo_cita_*
-- Rama: feature/agenda-v2 (worktree feature/agenda-v2-b56) · Escrita: 2026-11-12
-- Riesgo estimado: MEDIO (columnas y FK nuevas sobre appointments, la tabla más
-- escrita de la agenda; la FK se valida contra la tabla entera, que tiene la
-- columna nueva en NULL en todas las filas).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-11-12
--   `docker exec -i supabase_db_app_ortointegra psql -U postgres
--   -v ON_ERROR_STOP=1 -f` del archivo completo (rejilla: 10 × OK + 1 INFO,
--   0 citas con tipo / 0 tipos), y una segunda pasada igual: misma rejilla,
--   sólo los NOTICE «… already exists, skipping» de la tabla, sus dos índices,
--   las dos columnas y el índice de appointments, y no-op comprobado comparando
--   antes y después columnas (tipo, NOT NULL, DEFAULT, COMMENT) de tipos_cita
--   y appointments, relacl, RLS y COMMENT de las dos tablas, policies,
--   disparadores, constraints, índices, las dos funciones (prosecdef, proacl,
--   md5 de la definición) y count(*) de audit_log de tipos_cita (sin
--   diferencias). Pre-vuelo probado: con el CHECK viejo puesto (en una
--   transacción con ROLLBACK) aborta con «existe con otra fórmula». Anotada a
--   mano en supabase_migrations.schema_migrations (versión 20261112150000, 33
--   sentencias), por la misma razón que B0 y A1.8.
--   Pruebas: supabase/pruebas-sql/b6_tipos_cita.sql (bash scripts/pruebas-sql.sh).
--   Comprobación:
--     select relrowsecurity, (select count(*) from pg_policies
--              where schemaname = 'public' and tablename = 'tipos_cita')
--       from pg_class where oid = 'public.tipos_cita'::regclass;
--   → t, 3.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR.
-- AUDITORÍA INDEPENDIENTE 2026-11-12: APTA (supabase/AUDITORIA-MIGRACIONES.md).
-- Notas incorporadas antes de aplicar:
--   · appointments_tipo_cita_snapshot_check sólo imponía «tipo ⇒ nombre»; podía
--     quedar un nombre huérfano sin tipo. Ahora es bidireccional (las dos nulas
--     o las dos con valor), y el COMMENT de tipo_cita_nombre lo dice.
--   · La cifra de filas de la cabecera estaba vieja (380 en local).
--   · Re-auditoría del cambio: el CHECK se crea con IF NOT EXISTS por nombre,
--     así que un replay sobre una base con OTRA fórmula se la saltaría en
--     silencio. El auditor propuso DROP + ADD incondicional; se eligió en su
--     lugar que el pre-vuelo ABORTE si el nombre existe con otra fórmula
--     (comparando pg_get_constraintdef con el texto que da PG 17, comprobado
--     en local con una tabla temporal en una transacción con ROLLBACK), y que
--     la fila 5 del veredicto compare la fórmula y no sólo el nombre. Así la
--     segunda pasada sigue siendo no-op y la discrepancia es ruidosa
--     (dimensión 3). Si otra versión de Postgres reconstruye el texto distinto,
--     el pre-vuelo aborta en vez de seguir: falla del lado seguro.
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Un tipo de cita (nombre, duración, color opcional) es de la CLÍNICA:
--   medico_id NULL      = vale para todos sus médicos;
--   medico_id con valor = sólo para ese médico.
-- Una tabla y una consulta cubren los dos casos de mejora_agendaV2.md §5 B.
-- Decisiones (P5): los edita sólo el administrador de la clínica; el médico
-- invitado no ve los tipos personales de otros médicos; duración 5–600 min en
-- múltiplos de 5; el color es sólo marca en el selector (los mismos seis que
-- appointments_color_check) y nunca sustituye al color del estado; sólo para
-- citas con paciente; opcional; con instantánea del nombre.
-- Nunca se borra: se archiva (activo = false). Las citas lo referencian con
-- RESTRICT y ni la RLS ni los privilegios conceden DELETE a authenticated.
-- FK COMPUESTA (tipo_cita_id, clinica_id) → tipos_cita(id, clinica_id): la
-- base impide que una cita use un tipo de OTRA clínica sin disparador en
-- appointments, y el error es el mismo exista o no el tipo ajeno (no delata
-- ids de otras clínicas). Que el tipo sea de toda la clínica o del médico de
-- la cita es un CONVENIO que comprueba la API (dimensión 16; escrito en el
-- COMMENT de la columna, que es lo que viaja con la base).
-- tipo_cita_nombre es la instantánea del nombre, como consultorio_nombre:
-- renombrar un tipo no reescribe el historial.
-- validar_tipo_cita_medico() es INVOKER: lee profiles con la RLS de quien
-- escribe; si no ve al médico, rechaza (falla cerrado). update_tipos_cita_
-- updated_at() pone updated_at en cada UPDATE, como en las demás tablas
-- (update_consultorios_updated_at). Ninguna de las dos escribe otra tabla.
-- La auditoría la da log_tabla_change() (audit_tipos_cita).
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere PostgreSQL ≥ 14 (CREATE OR REPLACE TRIGGER).
-- Bloqueos (lock_timeout de 5 s por la cola):
--   · CREATE TABLE con FK: SHARE ROW EXCLUSIVE sobre clinicas y profiles un
--     instante (bloquea sus escrituras, no sus lecturas).
--   · ADD COLUMN ×2 sobre appointments: ACCESS EXCLUSIVE un instante (sólo
--     catálogo: sin DEFAULT, no reescribe).
--   · ADD CONSTRAINT FK: SHARE ROW EXCLUSIVE sobre appointments y tipos_cita
--     mientras recorre appointments para validar; ADD CONSTRAINT CHECK:
--     ACCESS EXCLUSIVE mientras recorre appointments. CREATE INDEX (no
--     concurrente): SHARE sobre appointments mientras lo construye.
--     Con las filas de hoy es instantáneo (380 en la base local; ~154 en
--     producción según el último volcado, sin verificar). ⚠️ Replayado sobre millones de filas:
--     todo esto ocurre dentro de la misma transacción, y el ACCESS EXCLUSIVE
--     del ADD COLUMN ya se sostiene hasta el COMMIT, así que partir en NOT
--     VALID + VALIDATE no ayudaría aquí; habría que separar la FK, el CHECK y
--     el índice (CONCURRENTLY) en otra migración.
-- Orden respecto al código: PRIMERO esta migración. El código que añade
-- tipo_cita_* a APPOINTMENT_SELECT / consultaCitas va DESPUÉS: al revés,
-- PostgREST responde 400 y la agenda no carga. Las rutas de
-- /api/agenda/tipos-cita sólo consultan la tabla con el interruptor de la
-- agenda v2 encendido (B1), así que sin esta migración no fallan.
-- Alcance de los roles:
--   gana   — el administrador de clínica: crear, editar y archivar tipos de
--            SU clínica; los miembros de la clínica: leerlos (el invitado
--            sólo los de toda la clínica y los suyos; la secretaria todos).
--   pierde — anon: los privilegios por omisión de Supabase sobre tipos_cita
--            (no tenía uso); authenticated: DELETE, TRUNCATE, REFERENCES y
--            TRIGGER sobre ella (sin DELETE por diseño; TRUNCATE se salta la
--            RLS).
--   Los permisos sobre appointments no cambian: quien ya escribía una cita
--   puede escribir sus dos columnas nuevas (la FK sólo restringe valores
--   incoherentes). Sobre las demás tablas nadie gana ni pierde nada.
--   FK de tipos_cita a profiles RESTRICT: borrar el perfil de un médico con
--   tipos personales falla, igual que ya pasa con sus consultorios.
-- Contrato con spinus-consola: tabla nueva y columnas aditivas en
-- appointments; no se renombran ni cambian de tipo o significado nunca.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_tipo_cita_fkey;
--   ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_tipo_cita_snapshot_check;
--   DROP INDEX IF EXISTS public.idx_appointments_tipo_cita;
--   ALTER TABLE public.appointments DROP COLUMN IF EXISTS tipo_cita_nombre;
--   ALTER TABLE public.appointments DROP COLUMN IF EXISTS tipo_cita_id;
--   DROP TABLE IF EXISTS public.tipos_cita;
--   DROP FUNCTION IF EXISTS public.validar_tipo_cita_medico();
--   DROP FUNCTION IF EXISTS public.update_tipos_cita_updated_at();
-- Pierde qué tipo tenía cada cita. Ajustar antes la vista de spinus-consola si
-- la lee. Respaldar antes:
--   CREATE TABLE respaldos.citas_tipo_AAAAMMDD AS
--     SELECT id, tipo_cita_id, tipo_cita_nombre FROM public.appointments
--      WHERE tipo_cita_id IS NOT NULL;
--   CREATE TABLE respaldos.tipos_cita_AAAAMMDD AS SELECT * FROM public.tipos_cita;
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de crear nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_cols text[];
  c_esperadas CONSTANT text[] := ARRAY['id', 'clinica_id', 'medico_id', 'nombre', 'duracion_min',
                                       'color', 'activo', 'created_at', 'updated_at'];
  v_fk record;
  v_tabla text;
BEGIN
  IF to_regclass('public.appointments') IS NULL OR to_regclass('public.clinicas') IS NULL
     OR to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta public.appointments, public.clinicas o public.profiles.';
  END IF;
  IF to_regprocedure('public.get_clinica_id()') IS NULL OR to_regprocedure('public.soy_admin_de_clinica()') IS NULL
     OR to_regprocedure('public.get_my_role()') IS NULL OR to_regprocedure('public.log_tabla_change()') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta get_clinica_id(), soy_admin_de_clinica(), get_my_role() o log_tabla_change().';
  END IF;
  -- Las policies de abajo no leen tipos_cita: sólo estos tres helpers, que
  -- tienen que ser SECURITY DEFINER (leen profiles sin RLS) para que no haya
  -- recursión ni dependencia de las policies de profiles.
  IF NOT (SELECT bool_and(prosecdef) FROM pg_proc
           WHERE oid IN (to_regprocedure('public.get_clinica_id()'), to_regprocedure('public.soy_admin_de_clinica()'),
                         to_regprocedure('public.get_my_role()'))) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: get_clinica_id(), soy_admin_de_clinica() o get_my_role() ya no es SECURITY DEFINER.';
  END IF;
  FOREACH v_tabla IN ARRAY ARRAY['public.appointments', 'public.clinicas', 'public.profiles'] LOOP
    IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = v_tabla::regclass), 'USAGE') THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: el rol % no es dueño de % (lo es %).',
        current_user, v_tabla, pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = v_tabla::regclass));
    END IF;
  END LOOP;
  IF (SELECT atttypid FROM pg_attribute
       WHERE attrelid = 'public.appointments'::regclass AND attname = 'clinica_id' AND NOT attisdropped)
     IS DISTINCT FROM 'uuid'::regtype THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.appointments.clinica_id no es uuid.';
  END IF;
  -- Replay: CREATE TABLE IF NOT EXISTS mira sólo el nombre. Si ya existe, tiene
  -- que ser ESTA tabla (mismas columnas) y de este rol; si no, no se toca.
  IF to_regclass('public.tipos_cita') IS NOT NULL THEN
    SELECT array_agg(attname::text) INTO v_cols FROM pg_attribute
     WHERE attrelid = 'public.tipos_cita'::regclass AND attnum > 0 AND NOT attisdropped;
    IF NOT (v_cols @> c_esperadas AND v_cols <@ c_esperadas) THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.tipos_cita ya existe con OTRAS columnas (%). No se toca.', v_cols;
    END IF;
    IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = 'public.tipos_cita'::regclass), 'USAGE') THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.tipos_cita existe y no es de %.', current_user;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_attribute
              WHERE attrelid = 'public.appointments'::regclass AND NOT attisdropped
                AND ((attname = 'tipo_cita_id' AND atttypid <> 'uuid'::regtype)
                  OR (attname = 'tipo_cita_nombre' AND atttypid <> 'text'::regtype))) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: appointments.tipo_cita_id / tipo_cita_nombre ya existen con otro tipo.';
  END IF;
  SELECT c.confrelid, c.confdeltype INTO v_fk FROM pg_constraint c
   WHERE c.conrelid = 'public.appointments'::regclass AND c.conname = 'appointments_tipo_cita_fkey';
  IF FOUND AND (v_fk.confrelid IS DISTINCT FROM to_regclass('public.tipos_cita')::oid OR v_fk.confdeltype <> 'r') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: appointments_tipo_cita_fkey existe con otra definición.';
  END IF;
  -- El CHECK de la instantánea se crea con IF NOT EXISTS por nombre: si ya
  -- existe con OTRA fórmula (p. ej. la unidireccional de un borrador), aborta
  -- en vez de saltárselo en silencio. El texto es el que devuelve
  -- pg_get_constraintdef en PG 17 (comprobado en local con una tabla temporal).
  IF EXISTS (SELECT 1 FROM pg_constraint
              WHERE conrelid = 'public.appointments'::regclass AND conname = 'appointments_tipo_cita_snapshot_check'
                AND pg_get_constraintdef(oid) <> 'CHECK (((tipo_cita_id IS NULL) = (tipo_cita_nombre IS NULL)))') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: appointments_tipo_cita_snapshot_check existe con otra fórmula (%). No se toca.',
      (SELECT pg_get_constraintdef(oid) FROM pg_constraint
        WHERE conrelid = 'public.appointments'::regclass AND conname = 'appointments_tipo_cita_snapshot_check');
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc
              WHERE oid IN (to_regprocedure('public.validar_tipo_cita_medico()'),
                            to_regprocedure('public.update_tipos_cita_updated_at()'))
                AND prosecdef) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: validar_tipo_cita_medico() o update_tipos_cita_updated_at() existe como SECURITY DEFINER; tienen que ser invoker.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · La tabla, sus permisos y su RLS.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tipos_cita (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  clinica_id   uuid        NOT NULL,
  medico_id    uuid,
  nombre       text        NOT NULL,
  duracion_min integer     NOT NULL,
  color        text,
  activo       boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tipos_cita_pkey PRIMARY KEY (id),
  CONSTRAINT tipos_cita_id_clinica_key UNIQUE (id, clinica_id),
  CONSTRAINT tipos_cita_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  CONSTRAINT tipos_cita_medico_id_fkey  FOREIGN KEY (medico_id)  REFERENCES public.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT tipos_cita_nombre_check    CHECK (btrim(nombre) <> '' AND char_length(nombre) <= 60),
  CONSTRAINT tipos_cita_duracion_check  CHECK (duracion_min BETWEEN 5 AND 600 AND duracion_min % 5 = 0),
  CONSTRAINT tipos_cita_color_check     CHECK (color IS NULL OR color = ANY (ARRAY['indigo', 'magenta', 'carmin', 'oliva', 'bronce', 'grafito']))
);

-- Nombre único por ámbito (clínica, o clínica + médico) entre los ACTIVOS, y
-- DENTRO de la clínica: la llave empieza por clinica_id, así que un conflicto
-- nunca delata nombres de otra clínica. Archivar libera el nombre.
CREATE UNIQUE INDEX IF NOT EXISTS tipos_cita_nombre_activo_unico ON public.tipos_cita
  (clinica_id, coalesce(medico_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(nombre)))
  WHERE activo;
CREATE INDEX IF NOT EXISTS tipos_cita_medico ON public.tipos_cita (medico_id) WHERE medico_id IS NOT NULL;

ALTER TABLE public.tipos_cita ENABLE ROW LEVEL SECURITY;
-- Los privilegios por omisión de Supabase dan ALL a anon y authenticated.
REVOKE ALL ON TABLE public.tipos_cita FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.tipos_cita FROM authenticated;

-- Sin recursión: ninguna policy lee tipos_cita, sólo helpers SECURITY DEFINER
-- sobre profiles. Sin policy de DELETE (se archiva).
DROP POLICY IF EXISTS tipos_cita_select ON public.tipos_cita;
CREATE POLICY tipos_cita_select ON public.tipos_cita FOR SELECT TO authenticated
  USING (clinica_id = public.get_clinica_id()
         AND (medico_id IS NULL OR medico_id = auth.uid()
              OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria'));
DROP POLICY IF EXISTS tipos_cita_insert ON public.tipos_cita;
CREATE POLICY tipos_cita_insert ON public.tipos_cita FOR INSERT TO authenticated
  WITH CHECK (public.soy_admin_de_clinica() AND clinica_id = public.get_clinica_id());
DROP POLICY IF EXISTS tipos_cita_update ON public.tipos_cita;
CREATE POLICY tipos_cita_update ON public.tipos_cita FOR UPDATE TO authenticated
  USING (public.soy_admin_de_clinica() AND clinica_id = public.get_clinica_id())
  WITH CHECK (public.soy_admin_de_clinica() AND clinica_id = public.get_clinica_id());

-- ---------------------------------------------------------------------
-- 3 · Disparadores de tipos_cita. Las dos funciones son INVOKER y no
--     escriben ninguna otra tabla.
-- ---------------------------------------------------------------------
-- El médico de un tipo personal es un médico de ESA clínica. Lee profiles con
-- la RLS de quien escribe; si no lo ve, rechaza (falla cerrado).
CREATE OR REPLACE FUNCTION public.validar_tipo_cita_medico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF NEW.medico_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.profiles p
        WHERE p.id = NEW.medico_id AND p.clinica_id = NEW.clinica_id AND p.role = 'medico') THEN
    RAISE EXCEPTION 'El médico del tipo de cita no pertenece a la clínica' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.validar_tipo_cita_medico() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validar_tipo_cita_medico() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_tipos_cita_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.update_tipos_cita_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_tipos_cita_updated_at() TO anon, authenticated, service_role;

CREATE OR REPLACE TRIGGER trg_tipos_cita_medico
  BEFORE INSERT OR UPDATE OF medico_id, clinica_id ON public.tipos_cita
  FOR EACH ROW EXECUTE FUNCTION public.validar_tipo_cita_medico();

CREATE OR REPLACE TRIGGER trg_tipos_cita_updated_at
  BEFORE UPDATE ON public.tipos_cita
  FOR EACH ROW EXECUTE FUNCTION public.update_tipos_cita_updated_at();

CREATE OR REPLACE TRIGGER audit_tipos_cita
  AFTER INSERT OR UPDATE OR DELETE ON public.tipos_cita
  FOR EACH ROW EXECUTE FUNCTION public.log_tabla_change();

-- ---------------------------------------------------------------------
-- 4 · appointments: las dos columnas, la FK compuesta, el CHECK de la
--     instantánea y el índice que usa la FK al comprobar RESTRICT.
-- ---------------------------------------------------------------------
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS tipo_cita_id uuid;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS tipo_cita_nombre text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.appointments'::regclass AND conname = 'appointments_tipo_cita_fkey') THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_tipo_cita_fkey
      FOREIGN KEY (tipo_cita_id, clinica_id) REFERENCES public.tipos_cita (id, clinica_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.appointments'::regclass AND conname = 'appointments_tipo_cita_snapshot_check') THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_tipo_cita_snapshot_check
      CHECK ((tipo_cita_id IS NULL) = (tipo_cita_nombre IS NULL));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_appointments_tipo_cita ON public.appointments (tipo_cita_id)
  WHERE tipo_cita_id IS NOT NULL;

COMMENT ON TABLE public.tipos_cita IS
  'Tipos de cita de la clínica (agenda B6). medico_id NULL = de toda la clínica; con valor = sólo de ese médico. Se archivan (activo=false), nunca se borran. Los límites (nombre 1-60, duración 5-600 en múltiplos de 5, los seis colores) están aquí en CHECK y en src/lib/agenda/tiposCita.ts: cambiar los dos.';
COMMENT ON COLUMN public.appointments.tipo_cita_id IS
  'Tipo de la cita (agenda B6). La FK compuesta garantiza la misma clínica. CONVENIO QUE LA BASE NO IMPONE: el tipo es de toda la clínica (medico_id NULL) o del medico_id de la cita, y la cita tiene paciente; lo comprueban POST/PUT /api/appointments (validarTipoParaCita en src/lib/agenda/tiposCita.ts). Un camino que escriba la columna sin pasar por ahí puede dejar un tipo de otro médico sin que nada lo note.';
COMMENT ON COLUMN public.appointments.tipo_cita_nombre IS
  'Instantánea del nombre del tipo al asignarlo (como consultorio_nombre). Renombrar el tipo no la cambia. Va junto con tipo_cita_id: las dos nulas o las dos con valor (appointments_tipo_cita_snapshot_check); quitar el tipo es poner las dos a NULL.';

COMMIT;

-- ---------------------------------------------------------------------
-- 5 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO'
            WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'tipos_cita existe / RLS activa' AS comprobacion,
         coalesce((SELECT 'sí / ' || relrowsecurity::text FROM pg_class
                    WHERE oid = to_regclass('public.tipos_cita')), 'AUSENTE') AS valor,
         'sí / true' AS esperado
  UNION ALL
  SELECT 2, 'policies de tipos_cita (ninguna de DELETE)',
         coalesce((SELECT string_agg(cmd, ',' ORDER BY cmd) FROM pg_policies
                    WHERE schemaname = 'public' AND tablename = 'tipos_cita'), 'NINGUNA'),
         'INSERT,SELECT,UPDATE'
  UNION ALL
  SELECT 3, 'FKs de tipos_cita (clinicas, profiles) en RESTRICT',
         coalesce((SELECT string_agg(conname || '=' || confdeltype::text, ',' ORDER BY conname) FROM pg_constraint
                    WHERE conrelid = to_regclass('public.tipos_cita') AND contype = 'f'), 'NINGUNA'),
         'tipos_cita_clinica_id_fkey=r,tipos_cita_medico_id_fkey=r'
  UNION ALL
  SELECT 4, 'appointments_tipo_cita_fkey: destino / RESTRICT / columnas',
         coalesce((SELECT c.confrelid::regclass::text || ' / ' || c.confdeltype::text || ' / '
                          || (SELECT string_agg(a.attname, ',' ORDER BY k.ord)
                                FROM unnest(c.conkey) WITH ORDINALITY k(attnum, ord)
                                JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum)
                     FROM pg_constraint c
                    WHERE c.conrelid = 'public.appointments'::regclass AND c.conname = 'appointments_tipo_cita_fkey'), 'AUSENTE'),
         'tipos_cita / r / tipo_cita_id,clinica_id'
  UNION ALL
  SELECT 5, 'CHECK de tipos_cita / fórmula del CHECK de instantánea en appointments',
         (SELECT count(*)::text FROM pg_constraint WHERE conrelid = to_regclass('public.tipos_cita') AND contype = 'c')
         || ' / ' ||
         coalesce((SELECT pg_get_constraintdef(oid) FROM pg_constraint
                    WHERE conrelid = 'public.appointments'::regclass AND conname = 'appointments_tipo_cita_snapshot_check'), 'AUSENTE'),
         '3 / CHECK (((tipo_cita_id IS NULL) = (tipo_cita_nombre IS NULL)))'
  UNION ALL
  SELECT 6, 'funciones: definer / EXECUTE PUBLIC,anon,authenticated,service_role',
         coalesce((SELECT string_agg(p.proname || '=' || p.prosecdef::text || ' / '
                          || (EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                       WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'))::text || ','
                          || has_function_privilege('anon', p.oid, 'EXECUTE')::text || ','
                          || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || ','
                          || has_function_privilege('service_role', p.oid, 'EXECUTE')::text, ' ; ' ORDER BY p.proname)
                     FROM pg_proc p
                    WHERE p.oid IN (to_regprocedure('public.update_tipos_cita_updated_at()'),
                                    to_regprocedure('public.validar_tipo_cita_medico()'))), 'AUSENTE'),
         'update_tipos_cita_updated_at=false / false,true,true,true ; validar_tipo_cita_medico=false / false,true,true,true'
  UNION ALL
  SELECT 7, 'disparadores de tipos_cita',
         coalesce((SELECT string_agg(tgname || '→' || tgfoid::regproc::text, ',' ORDER BY tgname) FROM pg_trigger
                    WHERE tgrelid = to_regclass('public.tipos_cita') AND NOT tgisinternal AND tgenabled = 'O'), 'NINGUNO'),
         'audit_tipos_cita→log_tabla_change,trg_tipos_cita_medico→validar_tipo_cita_medico,trg_tipos_cita_updated_at→update_tipos_cita_updated_at'
  UNION ALL
  SELECT 8, 'privilegios de tipos_cita: anon / authenticated',
         coalesce((SELECT coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type)
                                      FROM information_schema.role_table_grants
                                     WHERE table_schema = 'public' AND table_name = 'tipos_cita' AND grantee = 'anon'), '-')
                          || ' / '
                          || coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type)
                                         FROM information_schema.role_table_grants
                                        WHERE table_schema = 'public' AND table_name = 'tipos_cita' AND grantee = 'authenticated'), '-')
                    WHERE to_regclass('public.tipos_cita') IS NOT NULL), 'AUSENTE'),
         '- / INSERT,SELECT,UPDATE'
  UNION ALL
  SELECT 9, 'las 5 policies de appointments, intactas',
         (SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'appointments'),
         'appointments_delete,appointments_gates_insert,appointments_insert,appointments_select,appointments_update'
  UNION ALL
  SELECT 10, 'appointments.tipo_cita_id / tipo_cita_nombre: tipos',
         coalesce((SELECT string_agg(attname || '=' || format_type(atttypid, atttypmod), ',' ORDER BY attname)
                     FROM pg_attribute
                    WHERE attrelid = 'public.appointments'::regclass AND NOT attisdropped
                      AND attname IN ('tipo_cita_id', 'tipo_cita_nombre')), 'AUSENTE'),
         'tipo_cita_id=uuid,tipo_cita_nombre=text'
  UNION ALL
  SELECT 11, 'citas con tipo / tipos de cita (censo)',
         (SELECT count(*)::text FROM public.appointments WHERE tipo_cita_id IS NOT NULL)
         || ' / ' || (SELECT count(*)::text FROM public.tipos_cita),
         NULL
) t
ORDER BY t.n;
