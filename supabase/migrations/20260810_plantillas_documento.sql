-- ============================================================================
-- PENDIENTE DE APLICAR — la ejecuta Angel a mano, UN BLOQUE A LA VEZ
-- ============================================================================
-- Sistema de plantillas de documento · Paso 5.3.a
--
-- Crea public.plantillas_documento, que sustituye a plantillas_honorarios.
--
-- DECISIONES YA TOMADAS, no reabrir:
--   · Plantillas POR MÉDICO, no por clínica. clinica_id NO existe aquí: dos
--     médicos de la misma clínica no ven las plantillas del otro.
--   · Por TIPO DE DOCUMENTO: cada formato tiene su propio conjunto.
--   · Máximo DIEZ por médico y por tipo.
--   · Guardan todo el formulario MENOS los datos del paciente.
--   · El NOMBRE es una etiqueta privada del médico. NUNCA se imprime en ningún
--     documento, ni viaja en el payload que reciben los formatos.
--
-- SIN GATE DE SUSCRIPCIÓN, y es decisión, no descuido. Las otras siete tablas
-- con INSERT desde cliente llevan una policy RESTRICTIVE que comprueba el
-- estado de la clínica. Esta no: una plantilla no es dato clínico ni genera
-- documento, y bloquear que un médico degradado ordene sus preferencias no
-- protege nada. Por eso el pre-flight tampoco pide clinica_tiene_acceso().
--
-- plantillas_honorarios NO se toca en esta migración. Tiene 2 filas de abril
-- que no se migran, y se retira en un paso posterior, cuando el sistema nuevo
-- esté funcionando. Si algo sale mal, lo viejo sigue ahí.
--
-- PARA QUIEN ESCRIBA EL CLIENTE (paso 5.3.b), dos trampas ya identificadas:
--   · Compara los nombres con lower(...), igual que el índice único. El patrón
--     actual de NotaHonorariosForm usa coincidencia exacta y dejaría escapar el
--     error crudo de la base en la cara del médico.
--   · NADA de upsert ni ON CONFLICT DO UPDATE: los triggers BEFORE INSERT
--     disparan antes de que Postgres arbitre el conflicto, así que sobrescribir
--     la décima plantilla lanzaría el tope. Usa buscar, y después actualizar o
--     insertar.
-- ============================================================================


-- ── BLOQUE A · PRE-FLIGHT ────────────────────────────────────────────────────
-- No cambia nada. Aborta si el estado de partida no es el esperado.

DO $$
BEGIN
  IF to_regclass('public.plantillas_documento') IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: public.plantillas_documento ya existe';
  END IF;

  IF to_regclass('public.plantillas_honorarios') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: falta public.plantillas_honorarios (¿esquema inesperado?)';
  END IF;

  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: falta public.profiles, a la que apunta la clave foránea';
  END IF;

  RAISE NOTICE 'PRE-FLIGHT OK';
END $$;


-- ── BLOQUE B · TABLA, PROTECCIÓN E ÍNDICES ───────────────────────────────────
-- La tabla nace CERRADA: la RLS y el REVOKE van en la misma transacción que el
-- CREATE. Si se dejaran para más tarde, entre bloque y bloque la tabla viviría
-- con los grants por defecto de Supabase y sin RLS —y Supabase recarga
-- PostgREST sola tras cada DDL, así que quedaría expuesta a anon sin esperar al
-- NOTIFY—.
--
-- RLS activa sin policies deniega todo: el estado intermedio es el fallo
-- seguro, no el agujero.

BEGIN;

-- El único lock sobre una tabla viva es el de profiles, por la clave foránea.
-- No bloquea los SELECT, así que los inicios de sesión no se ven afectados,
-- pero si algo tiene profiles agarrada preferimos fallar rápido a encolar las
-- escrituras detrás.
SET LOCAL lock_timeout = '5s';

CREATE TABLE public.plantillas_documento (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL,
  tipo        text        NOT NULL,
  nombre      text        NOT NULL,
  contenido   jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT plantillas_documento_pkey PRIMARY KEY (id),

  -- CASCADE y no RESTRICT: profiles ya está protegida aguas arriba por las FK
  -- RESTRICT de documentos, consultas y mediciones, así que un médico con
  -- historial clínico no se puede borrar y esto nunca se dispara. Solo alcanza
  -- a un médico sin ningún historial, y ahí llevarse sus plantillas es lo
  -- correcto. RESTRICT convertiría una preferencia de formulario en un bloqueo
  -- nuevo para dar de baja usuarios.
  CONSTRAINT plantillas_documento_user_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Los ocho formatos, con los nombres exactos de documentos_tipo_check.
  -- Honorarios y Cotización comparten formulario, así que comparten conjunto.
  -- Los tres tipos de documentos que faltan —informe_clinico y los dos de
  -- archivo subido— no tienen formulario, así que no pueden tener plantilla.
  CONSTRAINT plantillas_documento_tipo_check
    CHECK (tipo IN (
      'receta',
      'solicitud_lab',
      'solicitud_imagen',
      'plan_suplementacion',
      'solicitud_internamiento',
      'escrito_medico',
      'consentimiento_informado',
      'nota_honorarios'
    )),

  -- El nombre es lo que el médico lee en el desplegable: sin él no puede
  -- distinguirlas. Los triggers lo normalizan antes de que llegue aquí.
  CONSTRAINT plantillas_documento_nombre_check
    CHECK (btrim(nombre) <> '' AND length(nombre) <= 60)
);

ALTER TABLE public.plantillas_documento ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plantillas_documento FROM PUBLIC, anon;

COMMENT ON TABLE public.plantillas_documento IS
  'Plantillas de formulario, por médico y por tipo de documento. Máximo 10 por '
  'combinación, impuesto por trigger con lock consultivo. El contenido NUNCA '
  'incluye datos del paciente. El NOMBRE es una etiqueta privada del médico: no '
  'se imprime en ningún documento ni viaja en el payload que reciben los '
  'formatos. Sin gate de suscripción, a diferencia de las otras siete tablas '
  'con INSERT desde cliente: una plantilla no es dato clínico ni genera '
  'documento.';

-- Único por médico y tipo: dos plantillas con el mismo nombre en el mismo
-- desplegable son indistinguibles. El cliente comprueba la colisión antes para
-- dar un aviso legible; esto es la garantía.
--
-- Recorta AUNQUE los triggers ya recorten, con el mismo juego de caracteres. Sin
-- el btrim aquí, la unicidad dependería de que los triggers sigan vivos: un
-- restore con session_replication_role = 'replica' los duerme, y quien algún día
-- decida que el tope sobra se llevaría con él la normalización de los INSERT,
-- que vive dentro de esa misma función. El coste es un btrim sobre diez filas
-- por serie.
CREATE UNIQUE INDEX plantillas_documento_nombre_unico
  ON public.plantillas_documento
     (user_id, tipo, lower(btrim(nombre, ' ' || chr(9) || chr(10) || chr(13) || chr(160))));

-- La consulta real: las plantillas de UN médico para UN tipo, más reciente
-- primero.
CREATE INDEX plantillas_documento_listado
  ON public.plantillas_documento (user_id, tipo, updated_at DESC);

COMMIT;


-- ── BLOQUE C · EL TOPE, LA NORMALIZACIÓN Y LA INMUTABILIDAD ──────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.plantillas_documento_tope()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
DECLARE
  v_n integer;
BEGIN
  -- Normaliza ANTES de contar y antes de que el índice único arbitre: así lo
  -- que se guarda es lo que el médico va a leer en el desplegable, sin espacios
  -- ni tabuladores pegados de otro sitio. btrim de un solo argumento solo
  -- recorta espacios, y el espacio duro llega al pegar desde un procesador de
  -- textos.
  NEW.nombre := btrim(NEW.nombre, ' ' || chr(9) || chr(10) || chr(13) || chr(160));

  -- Sin este lock el tope NO se cumple bajo concurrencia: un count(*) no toma
  -- ningún lock y no puede tomarlo sobre filas que aún no existen, así que dos
  -- inserciones simultáneas leerían 9 las dos y quedarían 11.
  -- Y NO sirve SELECT ... FOR UPDATE, que es la salida que parece obvia: la
  -- fila que la otra transacción está insertando no está en el snapshot, así
  -- que ni se bloquea ni se cuenta.
  -- El lock es por serie (médico, tipo), y con diez filas por serie su coste
  -- es nulo.
  --
  -- ASUME READ COMMITTED, que es el defecto de Supabase y de PostgREST. Bajo
  -- REPEATABLE READ el lock no basta: el snapshot de la segunda transacción es
  -- anterior al COMMIT de la primera, así que al despertar seguiría contando 9.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(NEW.user_id::text || ':' || NEW.tipo, 0)
  );

  SELECT count(*) INTO v_n
    FROM public.plantillas_documento
   WHERE user_id = NEW.user_id AND tipo = NEW.tipo;

  IF v_n >= 10 THEN
    RAISE EXCEPTION 'Ya tienes 10 plantillas de este documento. Borra una para crear otra.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.plantillas_documento_tope() IS
  'BEFORE INSERT. Normaliza el nombre e impone el tope de 10 por médico y tipo. '
  'Va en trigger porque un CHECK no puede contar filas, y con lock consultivo '
  'porque un count(*) por sí solo no serializa nada.';

CREATE TRIGGER trg_plantillas_documento_tope
  BEFORE INSERT ON public.plantillas_documento
  FOR EACH ROW
  EXECUTE FUNCTION public.plantillas_documento_tope();


CREATE OR REPLACE FUNCTION public.plantillas_documento_touch()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
AS $$
BEGIN
  -- Falla en vez de revertir en silencio: un cliente que intente mover una
  -- plantilla de dueño recibiría si no un 200 y creería que funcionó.
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'El dueño de una plantilla es inmutable'
      USING ERRCODE = 'check_violation';
  END IF;

  -- El tipo también, y esto es parte del tope, no higiene: el tope solo mira
  -- los INSERT, así que si el tipo fuera mutable un UPDATE podría meter una
  -- plantilla en una serie ya llena sin pasar por él.
  IF NEW.tipo IS DISTINCT FROM OLD.tipo THEN
    RAISE EXCEPTION 'El tipo de documento de una plantilla es inmutable'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'El identificador de una plantilla es inmutable'
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.created_at := OLD.created_at;
  NEW.nombre     := btrim(NEW.nombre, E' \t\r\n\u00A0');
  NEW.updated_at := now();
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.plantillas_documento_touch() IS
  'BEFORE UPDATE. Declara inmutables el dueño, el tipo y el identificador, '
  'conserva la fecha de creación y renueva la de actualización. La '
  'inmutabilidad del tipo es parte del tope: sin ella un UPDATE esquivaría el '
  'trigger de INSERT.';

CREATE TRIGGER trg_plantillas_documento_touch
  BEFORE UPDATE ON public.plantillas_documento
  FOR EACH ROW
  EXECUTE FUNCTION public.plantillas_documento_touch();

COMMIT;


-- ── BLOQUE D · POLÍTICAS ─────────────────────────────────────────────────────
-- La RLS ya está activa desde el bloque B, así que hasta aquí la tabla ha
-- denegado todo. Estas policies son lo que la abre, y solo al dueño.
--
-- authenticated tiene INSERT y UPDATE a nivel de TABLA, así que las policies de
-- fila son lo único que separa las plantillas de un médico de las de otro.
--
-- service_role las esquiva por BYPASSRLS, y aquí está bien: las plantillas no
-- contienen datos de paciente por diseño. Lo que NO esquiva son los triggers,
-- así que el tope y la inmutabilidad también le aplican.

BEGIN;

CREATE POLICY plantillas_documento_select ON public.plantillas_documento
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY plantillas_documento_insert ON public.plantillas_documento
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY plantillas_documento_update ON public.plantillas_documento
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY plantillas_documento_delete ON public.plantillas_documento
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';

COMMIT;


-- ── VERIFICACIÓN, después de aplicar ─────────────────────────────────────────
--
-- -- 1 · La tabla nace cerrada y con dueño correcto
-- SELECT relname, relrowsecurity AS rls_on, relforcerowsecurity AS force_rls,
--        relowner::regrole::text AS owner
--   FROM pg_class WHERE relname = 'plantillas_documento';
-- -- esperado: rls_on = true, force_rls = false, owner = postgres
--
-- -- 2 · Las cuatro policies, ninguna de más
-- SELECT policyname, cmd, roles, qual, with_check
--   FROM pg_policies
--  WHERE schemaname='public' AND tablename='plantillas_documento'
--  ORDER BY policyname;
--
-- -- 3 · Los dos triggers, habilitados
-- SELECT tgname, tgenabled FROM pg_trigger
--  WHERE tgrelid='public.plantillas_documento'::regclass AND NOT tgisinternal;
--
-- -- 4 · anon sin privilegios
-- SELECT grantee, privilege_type FROM information_schema.table_privileges
--  WHERE table_schema='public' AND table_name='plantillas_documento'
--    AND grantee IN ('anon','authenticated') ORDER BY 1,2;
--
-- -- 5 · Vacía
-- SELECT count(*) FROM public.plantillas_documento;   -- esperado: 0
--
-- -- 6 · El tope, de extremo a extremo y sin dejar rastro
-- --
-- -- SUSTITUYE el uuid por el de una cuenta de PRUEBA concreta. No lo dejes al
-- -- azar: si este INSERT llegara a correr fuera del BEGIN/ROLLBACK, le caerían
-- -- diez plantillas «prueba N» a un médico real en su desplegable.
-- BEGIN;
--   INSERT INTO public.plantillas_documento (user_id, tipo, nombre)
--   SELECT '<uuid-de-la-cuenta-de-prueba>'::uuid, 'receta', 'prueba ' || g
--     FROM generate_series(1, 11) g;
--   -- ESPERADO: falla en la undécima con «Ya tienes 10 plantillas».
--   -- Si entran las once SIN error, PARA: significa que el trigger no ve las
--   -- filas de su propio statement, y el tope se esquiva con un INSERT
--   -- múltiple —que es lo que genera insert([...]) con un array—. Habría que
--   -- rediseñarlo antes de escribir el cliente.
-- ROLLBACK;
--
-- -- 7 · La serialización, que la 6 no prueba. Dos ventanas del SQL Editor.
-- --
-- -- Sesión A:
-- --   BEGIN;
-- --   INSERT INTO public.plantillas_documento (user_id, tipo, nombre)
-- --   VALUES ('<uuid-de-prueba>'::uuid, 'receta', 'carrera A');
-- --   -- se deja abierta, sin confirmar
-- --
-- -- Sesión B, que debe QUEDARSE BLOQUEADA:
-- --   BEGIN;
-- --   INSERT INTO public.plantillas_documento (user_id, tipo, nombre)
-- --   VALUES ('<uuid-de-prueba>'::uuid, 'receta', 'carrera B');
-- --
-- -- Con B colgada:  SELECT * FROM pg_locks WHERE locktype = 'advisory';
-- -- Después: ROLLBACK en A —B se desbloquea al instante— y ROLLBACK en B.
-- -- Si B NO se bloquea, el lock consultivo no está haciendo su trabajo.


-- ── DOWN ─────────────────────────────────────────────────────────────────────
--
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_plantillas_documento_touch ON public.plantillas_documento;
-- DROP TRIGGER IF EXISTS trg_plantillas_documento_tope  ON public.plantillas_documento;
-- DROP FUNCTION IF EXISTS public.plantillas_documento_touch();
-- DROP FUNCTION IF EXISTS public.plantillas_documento_tope();
-- DROP TABLE IF EXISTS public.plantillas_documento;
-- NOTIFY pgrst, 'reload schema';
-- COMMIT;
--
-- Reversible sin pérdida mientras nadie haya creado plantillas. En cuanto
-- existan, el DROP se las lleva: a partir de ahí es una decisión, no un
-- reflejo.
