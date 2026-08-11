-- ============================================================================
-- PENDIENTE DE APLICAR — la ejecuta Angel a mano, EN CUATRO BLOQUES
-- ============================================================================
-- Firmas electrónicas del consentimiento · tabla, bucket y protección
--
-- ── QUÉ RESUELVE ────────────────────────────────────────────────────────────
--
-- El consentimiento informado es el único documento del sistema que se firma, y
-- la NOM-004 exige que esa firma sea trazable: sello de tiempo por cada firma,
-- constancia de quién firmó y en qué calidad, y garantía de que el documento no
-- se alteró después.
--
-- Un trazo guardado sin nada de eso es un dibujo, no una firma.
--
-- ── LOS CINCO FIRMANTES ─────────────────────────────────────────────────────
--
--   medico       Su rúbrica sale del perfil, no se captura en el momento. Se
--                registra con la hora del SELLADO, que es el acto que reúne
--                todas las demás.
--   paciente     Firma en el dispositivo. Si no puede, se marca y el familiar
--                firma en su lugar.
--   familiar     Familiar o representante legal.
--   testigo_1
--   testigo_2    Los dos opcionales.
--
-- Cada uno con su hora propia: el paciente firmó a las 12:43:07 y el familiar a
-- las 12:44:51, y esa diferencia es parte de la evidencia.
--
-- ── POR QUÉ EL TRAZO VA EN LA BASE Y NO EN UN BUCKET ────────────────────────
--
-- Un trazo capturado con el dedo son unos pocos kilobytes, y es evidencia: debe
-- viajar con su sello de tiempo, en la misma fila y la misma transacción.
-- Separarlo en un bucket abriría la posibilidad de que uno exista sin el otro.
--
-- ── LAS FOTOS DE IDENTIFICACIÓN SÍ VAN A UN BUCKET, Y CERRADO ───────────────
--
-- Una identificación oficial es el dato más sensible que va a guardar el
-- sistema. El bucket sigue el patrón de firmas-medicos: RLS que DENIEGA A TODOS
-- los usuarios, incluido el médico que la subió. Solo el servidor la toca.
--
-- Cómo se renderiza entonces, que es la pregunta que esto obliga a responder:
--
--   · El PDF se genera en el NAVEGADOR, así que la foto tiene que llegar a su
--     memoria. Con el bucket cerrado no puede pedirla directamente: hace falta
--     una ruta del servidor que compruebe que quien la pide es el médico del
--     documento, la saque con privilegios de servicio y se la devuelva.
--   · Y el PDF emitido la lleva DENTRO, incrustada. Así reimprimir un
--     consentimiento de hace un año no depende de que la foto siga existiendo,
--     y encaja con la inmutabilidad del documento emitido.
--
-- ── DOS DECISIONES DE PRODUCTO, TOMADAS Y DECLARADAS ────────────────────────
--
-- 1 · UN BORRADOR FIRMADO SÍ SE PUEDE CANCELAR, y borrarlo se lleva sus firmas.
--     Para eso es un borrador: el paciente puede firmar y después decidir no
--     operarse. Si el documento se imprimió, ya no es borrador y no se borra.
--
-- 2 · UNA CLÍNICA SIN ACCESO DE ESCRITURA NO FIRMA, ni siquiera un borrador que
--     empezó cuando lo tenía. El borrador es una función de pago, y las otras
--     siete tablas con datos de paciente ya bloquean igual: la excepción sería
--     esta, no la regla.
--
-- ── EL ORDEN DE LAS TRES OPERACIONES, Y NO ES EL INTUITIVO ──────────────────
--
--   1. insertar las firmas
--   2. UPDATE del documento a 'firmado', devolviendo el folio
--   3. renderizar el PDF
--
-- Los tres pasos están forzados por sendas reglas, y ninguna admite otro orden:
--
--   · Las firmas van ANTES del sellado porque el guardián solo admite firmar un
--     borrador. Si se sella primero, aunque sea en la misma transacción, la
--     firma que llega después ve el estado ya cambiado y se rechaza.
--   · El sellado va ANTES de renderizar porque el folio lo asigna la base en
--     ese UPDATE. Si se renderiza antes, el papel sale sin el número.
--
-- La migración anterior dice «primero el UPDATE, después renderizar», y leído a
-- la ligera invita a sellar antes de firmar. No: las firmas son lo primero.
--
-- ── DEPENDENCIA ─────────────────────────────────────────────────────────────
--
-- Requiere 20260812_documentos_estado.sql, ya aplicada: las firmas cuelgan de
-- un documento y solo tienen sentido mientras es borrador o al sellarlo.
-- ============================================================================


-- ── BLOQUE A · PRE-FLIGHT ────────────────────────────────────────────────────

DO $$
BEGIN
  IF to_regclass('public.firmas_documento') IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: public.firmas_documento ya existe';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='documentos' AND column_name='estado'
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: falta documentos.estado; aplica antes 20260812_documentos_estado';
  END IF;

  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'identificaciones') THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: el bucket identificaciones ya existe';
  END IF;

  -- El patrón que este archivo replica. Si no está, algo no es lo que creemos.
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'firmas-medicos') THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: no existe firmas-medicos, cuyo patrón de cierre se replica';
  END IF;

  -- Sin RLS activa en storage.objects, la policy del bloque D se crearía y no
  -- haría absolutamente nada: el bucket quedaría abierto creyéndolo cerrado.
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'storage.objects'::regclass) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: storage.objects no tiene RLS activa; la policy no protegería nada';
  END IF;

  -- Los dos predicados del gate que impone el guardián del bloque C.
  IF to_regprocedure('public.clinica_tiene_acceso()') IS NULL
     OR to_regprocedure('public.clinica_no_suspendida()') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: faltan los helpers del gate de clínica';
  END IF;

  RAISE NOTICE 'PRE-FLIGHT OK';
END $$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ BLOQUE B — la tabla de firmas                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Nace CERRADA: la RLS y el REVOKE van en la misma transacción que el CREATE.
-- RLS activa sin policies deniega todo, así que el estado intermedio es el
-- fallo seguro.

BEGIN;

SET LOCAL lock_timeout = '5s';

CREATE TABLE public.firmas_documento (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  documento_id  uuid        NOT NULL,

  -- En qué calidad firma, no quién es. El nombre va en el contenido del
  -- documento, que es lo que se imprime.
  rol           text        NOT NULL,

  -- El trazo, como imagen embebida. Unos pocos kilobytes: es evidencia y viaja
  -- con su sello, en la misma fila.
  -- NULL en el médico: su rúbrica sale del perfil y no se captura aquí.
  trazo         text,

  -- ── El sello de tiempo, por partida doble y a propósito ──────────────────
  -- La del dispositivo es el momento real del trazo, pero se altera cambiando
  -- la hora del iPad. La del servidor es fiable pero llega tarde si se firmó
  -- sin conexión. Guardar las dos es lo que permite detectar el caso raro sin
  -- perder el normal.
  -- ⚠ firmado_en_servidor lo IMPONE el trigger del bloque C, no este DEFAULT:
  -- un DEFAULT solo aplica si la columna se omite, y el cliente puede
  -- enviarla. Sin esa imposición, las dos horas serían igual de falsificables
  -- y el razonamiento de arriba se caería.
  firmado_en          timestamptz NOT NULL,
  firmado_en_servidor timestamptz NOT NULL DEFAULT now(),

  -- Desde dónde. Lo que el navegador declara de sí mismo: no es prueba de
  -- nada por sí solo, pero es lo que distingue una firma capturada en el
  -- consultorio de una hecha desde otro sitio.
  dispositivo   text,

  -- La huella del documento EN EL MOMENTO DE FIRMAR. Es lo que convierte un
  -- dibujo en una firma: sin ella no se puede demostrar que lo que se firmó es
  -- lo que hoy está guardado.
  huella        text        NOT NULL,

  -- La foto de la identificación, si se capturó. Ruta dentro del bucket
  -- cerrado; nunca una URL pública.
  identificacion_path text,

  creado_por    uuid        NOT NULL,

  CONSTRAINT firmas_documento_pkey PRIMARY KEY (id),

  CONSTRAINT firmas_documento_documento_fkey
    FOREIGN KEY (documento_id) REFERENCES public.documentos(id) ON DELETE CASCADE,

  CONSTRAINT firmas_documento_creado_por_fkey
    FOREIGN KEY (creado_por) REFERENCES public.profiles(id) ON DELETE RESTRICT,

  CONSTRAINT firmas_documento_rol_check
    CHECK (rol IN ('medico', 'paciente', 'familiar', 'testigo_1', 'testigo_2')),

  -- El médico es el único que puede no traer trazo: el suyo sale del perfil.
  -- Los demás sin trazo no firmaron, y entonces no hay fila.
  --
  -- Con forma y tope: sin ellos, una cadena vacía o un espacio pasarían por
  -- firma, y nada impediría que cinco trazos de un megabyte cada uno viajaran
  -- en la misma consulta que se lee entera al renderizar.
  CONSTRAINT firmas_documento_trazo_check
    CHECK (
      rol = 'medico'
      -- Solo png y jpeg: son los que el generador de PDF sabe decodificar. Con
      -- webp o svg el trazo entraría, se guardaría, y el documento fallaría al
      -- generarse —y la firma ya no se puede corregir, porque es inmutable: la
      -- única salida sería cancelar el borrador entero—.
      OR (trazo ~ '^data:image/(png|jpeg);base64,' AND length(trazo) BETWEEN 100 AND 300000)
    ),

  -- La cota superior es la que importa: nadie firma en el futuro, y esa es la
  -- dirección en la que se falsifica. Con firmado_en_servidor impuesto por el
  -- trigger, el techo no depende del cliente.
  --
  -- La inferior es deliberadamente absurda, no ajustada. Una cota estrecha
  -- contradiría el motivo de guardar las dos horas: un tablet reiniciado o con
  -- la pila del reloj agotada arranca con una fecha del pasado, y rechazar esa
  -- firma sería perderla entera con el paciente delante, cuando lo que el doble
  -- sello quiere es DETECTAR la discrepancia, no impedirla. Queda registrada y
  -- consultable para siempre.
  CONSTRAINT firmas_documento_reloj_check
    CHECK (firmado_en > timestamptz '2000-01-01'
       AND firmado_en < firmado_en_servidor + interval '1 day'),

  -- Solo garantiza que la ruta no esté vacía: no hay clave foránea a los
  -- objetos del almacenamiento, así que una ruta muerta es posible. Y la fila
  -- es inmutable, así que no se podría corregir: SUBE LA FOTO ANTES DE INSERTAR
  -- LA FIRMA, nunca al revés.
  CONSTRAINT firmas_documento_identificacion_check
    CHECK (identificacion_path IS NULL OR btrim(identificacion_path) <> '')
);

ALTER TABLE public.firmas_documento ENABLE ROW LEVEL SECURITY;

-- Se revoca a authenticated también, y se le devuelve solo lo que necesita.
-- Los privilegios por defecto de Supabase le dan ALL sobre las tablas nuevas,
-- y ALL incluye TRUNCATE, que no pasa por RLS ni dispara triggers de fila. En
-- la única tabla del sistema cuyo valor entero es «esto no se borra», ese
-- hueco no se deja abierto.
REVOKE ALL ON public.firmas_documento FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.firmas_documento TO authenticated;

COMMENT ON TABLE public.firmas_documento IS
  'Firmas electrónicas del consentimiento. Una fila por firmante que firmó: '
  'quien se omitió no tiene fila. El trazo va en la base, no en un bucket, '
  'porque es evidencia y debe viajar con su sello de tiempo en la misma '
  'transacción. La huella es la del documento en el momento de firmar: sin '
  'ella no se puede demostrar que lo firmado es lo guardado. NUNCA se edita ni '
  'se borra: una firma es un hecho, no un dato.';

-- Un solo firmante por rol y documento: dos filas de «paciente» serían dos
-- versiones del mismo acto.
CREATE UNIQUE INDEX firmas_documento_unica
  ON public.firmas_documento (documento_id, rol);

-- La consulta real: todas las firmas de un documento, en orden de firma.
CREATE INDEX firmas_documento_listado
  ON public.firmas_documento (documento_id, firmado_en);

COMMIT;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ BLOQUE C — la inmutabilidad y las policies                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ── El guardián de la inserción ──────────────────────────────────────────
-- Impone en la BASE tres cosas que si no dependerían de que nadie se equivoque
-- de cliente. Y va a haber código con privilegios de servicio a centímetros de
-- esta tabla: es como se sirve la foto de identificación.
CREATE OR REPLACE FUNCTION public.firmas_documento_guardian()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
DECLARE
  v_estado text;
BEGIN
  -- 1 · La hora del servidor la pone el SERVIDOR. El DEFAULT no basta: solo
  --     aplica si la columna se omite, y el cliente puede enviarla.
  NEW.firmado_en_servidor := now();

  -- 2 · Solo se firma un BORRADOR. Vive aquí y no solo en la policy porque
  --     service_role no evalúa policies: sin esto, cualquier ruta con
  --     privilegios de servicio podría firmar un documento ya emitido, y el
  --     papel impreso y la fila dirían cosas distintas.
  --     FOR UPDATE cierra además la carrera entre firmar y sellar.
  --     La condición de propiedad cierra un oráculo: los triggers BEFORE corren
  --     ANTES de que la RLS evalúe su WITH CHECK, así que sin ella un médico
  --     podría distinguir por el mensaje de error si un identificador ajeno
  --     existe y en qué estado está.
  SELECT estado INTO v_estado
    FROM public.documentos
   WHERE id = NEW.documento_id
     AND (auth.uid() IS NULL OR subido_por = auth.uid())
     FOR UPDATE;

  IF v_estado IS NULL THEN
    RAISE EXCEPTION 'El documento que se intenta firmar no existe';
  END IF;

  IF v_estado <> 'borrador' THEN
    RAISE EXCEPTION 'Solo se firma un borrador; este documento está %', v_estado
      USING HINT = 'un documento emitido ya no admite firmas: emite uno nuevo';
  END IF;

  -- 3 · El gate de suscripción. Firmar es emitir, y una clínica sin acceso no
  --     emite, tampoco lo que empezó cuando lo tenía.
  --
  --     ⚠ Se exenta a quien no trae sesión. Sin JWT no hay clínica que
  --     consultar: get_clinica_id() devuelve NULL y el helper diría que no hay
  --     acceso POR UNA NULL, no por una decisión —y el mensaje culparía a la
  --     suscripción de una clínica que puede tener todo pagado—. Es la misma
  --     exención que abre asignar_folio_documento, y tiene la misma
  --     consecuencia: LAS FIRMAS SE INSERTAN SIEMPRE CON EL CLIENTE DE SESIÓN
  --     DEL MÉDICO, NUNCA CON PRIVILEGIOS DE SERVICIO.
  --
  --     El paso 2 no se exenta: ese era el motivo de moverlo aquí.
  --     Los DOS predicados, como las otras siete tablas: sin el de suspensión,
  --     una clínica suspendida no podría crear documentos nuevos pero sí firmar
  --     un borrador abierto antes de la suspensión. Y los dos van DENTRO del
  --     mismo IF de sesión: el de suspensión también resuelve por la clínica y
  --     es fail-closed, así que sin JWT devolvería falso y reintroduciría la
  --     trampa que este bloque acaba de cerrar.
  --
  --     Con mensajes distintos: «suspendida» y «sin acceso» se depuran en
  --     sitios distintos.
  IF auth.uid() IS NOT NULL THEN
    IF NOT public.clinica_no_suspendida() THEN
      RAISE EXCEPTION 'La clínica está suspendida: no se firman documentos';
    END IF;

    IF NOT public.clinica_tiene_acceso() THEN
      RAISE EXCEPTION 'La clínica no tiene acceso de escritura: no se firman documentos';
    END IF;
  END IF;

  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.firmas_documento_guardian() IS
  'BEFORE INSERT en firmas_documento. Impone en la base lo que no puede quedar '
  'en manos del cliente: la hora del servidor la pone el servidor, solo se '
  'firma un borrador —con FOR UPDATE, que cierra la carrera entre firmar y '
  'sellar— y la clínica necesita acceso de escritura. Es SECURITY DEFINER para '
  'poder leer el estado del documento sin depender de la RLS del invocador.';

CREATE TRIGGER trg_firmas_documento_guardian
  BEFORE INSERT ON public.firmas_documento
  FOR EACH ROW
  EXECUTE FUNCTION public.firmas_documento_guardian();


-- ── La inmutabilidad ─────────────────────────────────────────────────────
-- Una firma no se edita. Ni el trazo, ni la hora, ni la huella, ni el rol.
-- Si algo está mal, se emite un documento nuevo.
--
-- ⚠ Con UNA excepción, y es la que corrige un error de la primera versión de
-- este archivo: el borrado en cascada desde documentos SÍ pasa por aquí.
-- PostgreSQL implementa ON DELETE CASCADE emitiendo un DELETE real sobre la
-- tabla hija, así que dispara sus triggers de fila con normalidad. Sin la
-- excepción, cancelar un borrador firmado devolvería un error incomprensible
-- y ese documento no se podría borrar nunca.
--
-- Y cancelarlo tiene que poder hacerse: un borrador es trabajo en curso, y el
-- paciente puede firmar y después decidir no operarse. Si en cambio el
-- documento se imprimió, ya no es borrador y no se borra.
-- SECURITY DEFINER para que la exención de la cascada sea correcta por sí sola:
-- sin él, la función lee documentos con la RLS del invocador, y «no puedo ver el
-- padre» se leería como «el padre no existe». Hoy es inalcanzable —haría falta
-- devolver a authenticated el privilegio de DELETE y una policy— pero la
-- garantía no debe descansar en algo que vive fuera de la función.
CREATE OR REPLACE FUNCTION public.firmas_documento_inmutable()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
BEGIN
  -- La cascada: el padre ya no existe cuando este trigger corre, y eso es lo
  -- que la distingue de un borrado directo sobre firmas_documento.
  --
  -- Los dos IF van anidados y no unidos por AND: PostgreSQL no garantiza el
  -- corto-circuito, y en la rama de TRUNCATE el registro OLD no está asignado.
  IF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (SELECT 1 FROM public.documentos WHERE id = OLD.documento_id) THEN
      RETURN OLD;
    END IF;
  END IF;

  RAISE EXCEPTION 'Una firma electrónica no se modifica ni se borra'
    USING HINT = 'si el documento tiene un error, se emite uno nuevo; y si es un borrador, se cancela entero';
END $$;

COMMENT ON FUNCTION public.firmas_documento_inmutable() IS
  'BEFORE UPDATE OR DELETE en firmas_documento. Rechaza siempre, salvo el '
  'borrado en cascada desde documentos —que SÍ pasa por aquí, porque PostgreSQL '
  'implementa la cascada como un DELETE real sobre la hija—. Esa excepción es '
  'lo que permite cancelar un borrador firmado: el paciente puede firmar y '
  'después decidir no operarse.';

CREATE TRIGGER trg_firmas_documento_inmutable
  BEFORE UPDATE OR DELETE ON public.firmas_documento
  FOR EACH ROW
  EXECUTE FUNCTION public.firmas_documento_inmutable();

-- TRUNCATE no pasa por RLS ni dispara triggers de fila. El REVOKE del bloque B
-- ya lo cierra para authenticated; esto es la segunda línea.
CREATE TRIGGER trg_firmas_documento_no_truncate
  BEFORE TRUNCATE ON public.firmas_documento
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.firmas_documento_inmutable();


-- Las policies: solo el médico dueño del documento, y solo leer e insertar.
-- No hay policy de UPDATE ni de DELETE: sin policy, la RLS deniega. El trigger
-- de arriba es la segunda línea, para service_role, que sí las esquivaría.

CREATE POLICY firmas_documento_select ON public.firmas_documento
  FOR SELECT TO authenticated
  -- documento_id va calificado a propósito: sin el prefijo, la resolución de
  -- nombres prefiere el ámbito interno, así que el día que documentos gane una
  -- columna con ese nombre el predicado pasaría a ser d.id = d.documento_id y
  -- las policies se romperían en silencio.
  USING (EXISTS (
    SELECT 1 FROM public.documentos d
     WHERE d.id = firmas_documento.documento_id AND d.subido_por = auth.uid()
  ));

CREATE POLICY firmas_documento_insert ON public.firmas_documento
  FOR INSERT TO authenticated
  WITH CHECK (
    creado_por = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.documentos d
       WHERE d.id = firmas_documento.documento_id
         AND d.subido_por = auth.uid()
         -- Solo se firma un borrador. Un documento emitido ya no admite firmas:
         -- si las admitiera, el papel impreso y la fila dirían cosas distintas.
         AND d.estado = 'borrador'
    )
  );

NOTIFY pgrst, 'reload schema';

COMMIT;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ BLOQUE D — el bucket de identificaciones                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Patrón de firmas-medicos: DENIEGA A TODOS los usuarios, incluido el médico
-- que subió la foto. Solo el servidor la toca, con privilegios de servicio, y
-- solo después de comprobar que quien la pide es el médico del documento.

BEGIN;

-- ⚠ CREATE POLICY toma ACCESS EXCLUSIVE sobre storage.objects, y eso no bloquea
-- solo las escrituras: bloquea CADA lectura, subida y URL firmada del proyecto
-- entero, los cinco buckets, hasta que confirme. Suelen ser milisegundos, pero
-- si algo tiene esa tabla ocupada, todo el almacenamiento se encola detrás.
-- Con el límite, el peor caso pasa de «almacenamiento parado» a «este bloque
-- aborta y se reintenta».
SET LOCAL lock_timeout = '5s';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'identificaciones',
  'identificaciones',
  false,                                   -- NUNCA público
  5242880,                                 -- 5 MB: una credencial reducida pesa
                                           -- unos cientos de kB; 5 MB deja
                                           -- margen sin admitir un original de
                                           -- cámara sin comprimir
  -- Los dos que el generador de PDF sabe decodificar. Una foto en webp subiría
  -- sin problema y rompería el documento al incrustarla.
  ARRAY['image/jpeg', 'image/png']
);

-- Denegar a todos, igual que firmas-medicos. RESTRICTIVE: se suma a cualquier
-- otra policy en vez de competir con ella, así que ninguna permisiva futura
-- puede abrir este bucket por descuido.
CREATE POLICY identificaciones_deny_all_users ON storage.objects
  AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (bucket_id <> 'identificaciones')
  WITH CHECK (bucket_id <> 'identificaciones');

COMMIT;


-- ============================================================================
-- VERIFICACIÓN, después de aplicar
-- ============================================================================
--
-- -- 1 · La tabla nace cerrada
-- SELECT relname, relrowsecurity AS rls_on, relforcerowsecurity AS force_rls,
--        relowner::regrole::text AS owner
--   FROM pg_class WHERE relname = 'firmas_documento';
-- -- esperado: rls_on = true, force_rls = false, owner = postgres
--
-- -- 2 · Dos policies, y NINGUNA de update ni delete
-- SELECT policyname, cmd, roles::text FROM pg_policies
--  WHERE schemaname='public' AND tablename='firmas_documento' ORDER BY policyname;
--
-- -- 3 · Los TRES triggers: guardián, inmutabilidad y no-truncate
-- SELECT tgname, tgenabled FROM pg_trigger
--  WHERE tgrelid='public.firmas_documento'::regclass AND NOT tgisinternal
--  ORDER BY tgname;
--
-- -- 3b · Los privilegios: authenticated solo SELECT e INSERT, nada más
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
--  WHERE table_schema='public' AND table_name='firmas_documento'
--  ORDER BY grantee, privilege_type;
--
-- -- 3c · Las dos funciones son de postgres y SECURITY DEFINER
-- SELECT proname, proowner::regrole::text AS dueno, prosecdef, proconfig
--   FROM pg_proc
--  WHERE pronamespace = 'public'::regnamespace
--    AND proname IN ('firmas_documento_guardian','firmas_documento_inmutable');
--
-- -- 4 · El bucket, cerrado y con sus límites
-- SELECT id, public, file_size_limit, allowed_mime_types
--   FROM storage.buckets WHERE id = 'identificaciones';
-- -- esperado: public = false
--
-- SELECT policyname, cmd, permissive, roles::text FROM pg_policies
--  WHERE schemaname='storage' AND policyname = 'identificaciones_deny_all_users';
-- -- esperado: permissive = RESTRICTIVE
--
-- -- 5 · Que los buckets existentes no se movieron
-- SELECT id, public FROM storage.buckets ORDER BY id;
--
--
-- ============================================================================
-- DOWN
-- ============================================================================
--
-- ⚠ FALLA si hay firmas registradas, y debe fallar: son evidencia legal.
-- Comprueba antes:
--   SELECT count(*) FROM public.firmas_documento;
--   SELECT count(*) FROM storage.objects WHERE bucket_id = 'identificaciones';
--   -- las dos tienen que dar 0.
--
-- BEGIN;
--
-- DO $$
-- DECLARE v_f integer; v_o integer;
-- BEGIN
--   SELECT count(*) INTO v_f FROM public.firmas_documento;
--   SELECT count(*) INTO v_o FROM storage.objects WHERE bucket_id = 'identificaciones';
--   IF v_f > 0 OR v_o > 0 THEN
--     RAISE EXCEPTION 'Hay % firmas y % identificaciones: revertir destruiría evidencia legal', v_f, v_o;
--   END IF;
-- END $$;
--
-- SET LOCAL lock_timeout = '5s';   -- mismo ACCESS EXCLUSIVE que en el bloque D
-- DROP POLICY IF EXISTS identificaciones_deny_all_users ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'identificaciones';
-- DROP TRIGGER IF EXISTS trg_firmas_documento_no_truncate ON public.firmas_documento;
-- DROP TRIGGER IF EXISTS trg_firmas_documento_inmutable ON public.firmas_documento;
-- DROP TRIGGER IF EXISTS trg_firmas_documento_guardian ON public.firmas_documento;
-- DROP FUNCTION IF EXISTS public.firmas_documento_inmutable();
-- DROP FUNCTION IF EXISTS public.firmas_documento_guardian();
-- DROP TABLE IF EXISTS public.firmas_documento;
-- NOTIFY pgrst, 'reload schema';
-- COMMIT;
