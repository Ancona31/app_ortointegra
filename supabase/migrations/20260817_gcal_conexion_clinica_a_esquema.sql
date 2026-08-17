-- ============================================================================
-- PENDIENTE DE APLICAR — parte A de 2. La ejecuta Angel a mano.
-- ============================================================================
-- Conexión de Google POR CLÍNICA (Alternativa B, dos tablas) — ESQUEMA + DATOS
--
-- ⚠️ ORDEN OBLIGATORIO: este archivo va ANTES del deploy del código nuevo.
--    La asimetría que lo obliga:
--      · Migración aplicada y deploy fallido → inocuo. Este archivo es
--        ADITIVO PURO: `public.google_tokens` se queda intacta y el código
--        que hay hoy en producción sigue funcionando sin tocarlo.
--      · Deploy aplicado sin migración → rompe CALLADO. El alta de citas
--        escribe la conexión dentro de `after()`, donde el error se traga y
--        sólo deja una línea de log: las citas dejarían de llegar a Google
--        sin ninguna señal de cara al médico.
--
-- ── QUÉ PROBLEMA RESUELVE ───────────────────────────────────────────────────
--
-- Hoy `public.google_tokens` es PRIMARY KEY (user_id) y nada más. Eso hace
-- imposibles tres cosas que el sistema necesita para que las citas que agenda
-- la secretaria lleguen al calendario de la clínica:
--
--   1. NO EXISTE «la conexión de la clínica». Hay N filas sueltas y la
--      elección sólo se puede inventar con un `ORDER BY`: una heurística que
--      puede cambiar de ganador sola y que decide a qué calendario van los
--      datos de los pacientes.
--   2. NO SE SABE DE QUÉ CUENTA DE GOOGLE es la conexión. Sin eso, un 404 no
--      se puede distinguir entre «borraron el calendario» y «este token no lo
--      ve», y esa ambigüedad alimenta la rama destructiva de
--      `desvincularCitas`.
--   3. NO SE SABE EN QUÉ CALENDARIO VIVE el evento de cada cita, así que
--      desvincular sólo puede ser un barrido por clínica entera.
--
-- ── QUÉ CREA ────────────────────────────────────────────────────────────────
--
--   public.clinica_conexiones_google      Metadata de la conexión. Legible
--                                         bajo RLS por los miembros de la
--                                         clínica. Sin secretos dentro.
--   private.google_conexiones_secretos    Los tokens. Fuera de `public`, sin
--                                         grants: inalcanzable por PostgREST.
--   public.appointments.gcal_calendar_id  En qué calendario vive el evento.
--
-- Y hace el backfill desde `google_tokens`, abortando —sin elegir— cuando los
-- datos no permiten decidir quién es la conexión de la clínica.
--
-- ── QUÉ NO ESTÁ AQUÍ (a propósito) ──────────────────────────────────────────
--   · El permiso por usuario para escribir eventos. Es la pieza siguiente y
--     necesita su propio diseño: lo difícil no es la columna, es qué pasa
--     cuando un usuario bloqueado edita una cita que ya está en Google.
--   · El cambio de scopes (`openid`, `email`), el nombre del calendario y la
--     resolución de la conexión por clínica: eso es código, va en el deploy.
--   · Retirar `google_tokens` y cortar la doble escritura: archivo B.
-- ============================================================================

-- ── PRE-VUELO (correr aparte, leer el resultado, NO forma parte del archivo) ─
--
--   -- Cuántas conexiones hay y cómo se reparten. Lo que se espera hoy:
--   -- 1 fila, 1 clínica, 1 candidata a administradora.
--   SELECT p.clinica_id,
--          count(*)                                                        AS conexiones,
--          count(*) FILTER (WHERE p.es_admin_de_clinica IS TRUE
--                              OR p.role = 'admin')                        AS candidatas_admin,
--          count(*) FILTER (WHERE p.clinica_id IS NULL OR p.id IS NULL)     AS sin_clinica
--     FROM public.google_tokens gt
--     LEFT JOIN public.profiles p ON p.id = gt.user_id
--    GROUP BY p.clinica_id;
--
--   -- ¿Qué citas con evento se van a poder ubicar? El backfill resuelve el
--   -- calendario por `created_by` (quien guardó la cita), NO por `medico_id`.
--   -- Las de created_by nulo se quedan sin ubicar, y eso es correcto.
--   SELECT count(*)                                          AS con_evento,
--          count(*) FILTER (WHERE created_by IS NULL)        AS sin_autor,
--          count(*) FILTER (WHERE created_by IS DISTINCT FROM medico_id) AS autor_distinto_del_medico
--     FROM public.appointments
--    WHERE google_event_id IS NOT NULL;
--
--   -- ¿Hay grants a nivel de COLUMNA? Si los hay, la columna nueva de
--   -- appointments nace invisible para el cliente y hay que concederla a mano.
--   -- Cero filas = no hay ninguno = no hay nada que hacer.
--   --
--   -- NO usar information_schema.column_privileges para esto: esa vista EXPANDE
--   -- los grants de TABLA columna por columna, así que devuelve
--   -- (nº de columnas × 4) filas aunque no exista ni un solo grant de columna.
--   -- Comprobado contra Postgres 16 sobre una base con sólo
--   -- `GRANT ALL ON ALL TABLES`: devuelve 20 filas para google_tokens, que son
--   -- sus 5 columnas × SELECT/INSERT/UPDATE/REFERENCES. Se lee como alarma y no
--   -- lo es. El ACL real de la columna vive en pg_attribute.attacl, y es NULL
--   -- cuando el grant viene de la tabla.
--   SELECT c.relname, a.attname, a.attacl
--     FROM pg_attribute a
--     JOIN pg_class c ON c.oid = a.attrelid
--     JOIN pg_namespace n ON n.oid = c.relnamespace
--    WHERE n.nspname = 'public'
--      AND c.relname IN ('appointments','google_tokens')
--      AND a.attnum > 0 AND NOT a.attisdropped
--      AND a.attacl IS NOT NULL;
--
--   -- ¿Transacciones viejas abiertas? Un ALTER que encola detrás de ellas
--   -- bloquea también a todo el que llegue después.
--   SELECT pid, state, age(clock_timestamp(), xact_start) AS edad, query
--     FROM pg_stat_activity
--    WHERE xact_start IS NOT NULL AND state <> 'idle'
--    ORDER BY xact_start;
--
--   -- Snapshot del proyecto en el panel de Supabase antes de aplicar.
-- ────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Un ALTER que espera un lock encola detrás de sí a TODAS las consultas
-- siguientes, lecturas incluidas. Con timeout, en vez de tumbar la agenda,
-- esto falla limpio y se reintenta.
SET LOCAL lock_timeout      = '5s';
SET LOCAL statement_timeout = '60s';

-- ════════════════════════════════════════════════════════════════════════════
-- 1. PRE-VUELO QUE ABORTA — objetos y columnas de los que depende el archivo
-- ════════════════════════════════════════════════════════════════════════════
-- Se comprueba antes de tocar nada. Un fallo aquí no deja rastro: el archivo
-- entero es una transacción.
DO $$
BEGIN
  IF to_regclass('public.clinicas')      IS NULL THEN
    RAISE EXCEPTION 'ABORTADO: no existe public.clinicas.';
  END IF;
  IF to_regclass('public.profiles')      IS NULL THEN
    RAISE EXCEPTION 'ABORTADO: no existe public.profiles.';
  END IF;
  IF to_regclass('public.appointments')  IS NULL THEN
    RAISE EXCEPTION 'ABORTADO: no existe public.appointments.';
  END IF;
  IF to_regclass('public.google_tokens') IS NULL THEN
    RAISE EXCEPTION 'ABORTADO: no existe public.google_tokens. Si ya se aplicó el archivo B, este archivo no tiene de dónde hacer el backfill.';
  END IF;
  IF to_regprocedure('public.get_clinica_id()') IS NULL THEN
    RAISE EXCEPTION 'ABORTADO: no existe public.get_clinica_id(); la policy de RLS de este archivo lo necesita.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'profiles'
       AND column_name = 'es_admin_de_clinica'
  ) THEN
    RAISE EXCEPTION 'ABORTADO: no existe profiles.es_admin_de_clinica; sin ella no se puede decidir el rol de cada conexión.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'google_tokens'
       AND column_name = 'calendar_id'
  ) THEN
    RAISE EXCEPTION 'ABORTADO: no existe google_tokens.calendar_id; falta aplicar 20260815_gcal_calendario_propio_a_esquema.sql.';
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. public.clinica_conexiones_google — metadata, legible bajo RLS
-- ════════════════════════════════════════════════════════════════════════════
-- Aquí NO hay secretos. Es la parte de la conexión que un miembro de la
-- clínica tiene derecho a ver: de qué cuenta de Google es, a qué calendario
-- escribe, y si sigue viva.

CREATE TABLE IF NOT EXISTS public.clinica_conexiones_google (
  id                   uuid        NOT NULL DEFAULT gen_random_uuid(),
  clinica_id           uuid        NOT NULL,
  user_id              uuid        NOT NULL,
  rol                  text        NOT NULL,
  google_account_sub   text,
  google_account_email text,
  calendar_id          text,
  estado               text        NOT NULL DEFAULT 'activa',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinica_conexiones_google_pkey PRIMARY KEY (id)
);

-- Foreign keys nombradas y separadas (estilo del repo).
--
-- clinica_id → RESTRICT. Las FK a `clinicas` que ya existen no siguen una
-- regla única (appointments/invitaciones/plantillas_honorarios van en CASCADE;
-- consultorios y solicitudes_arco en RESTRICT; pacientes y profiles en SET
-- NULL, que aquí es imposible porque la columna es NOT NULL). Se toma RESTRICT
-- por ser la del precedente más reciente —`consultorios`, 2026-06-15— y la
-- conservadora: borrar una clínica que todavía tiene una conexión de Google
-- viva falla en vez de llevársela por delante en silencio. Hoy la app no
-- borra clínicas por ningún camino, así que en la práctica ninguna de las dos
-- reglas se dispara; la diferencia es qué pasa el día que alguien lo intente.
ALTER TABLE public.clinica_conexiones_google
  DROP CONSTRAINT IF EXISTS clinica_conexiones_google_clinica_id_fkey;
ALTER TABLE public.clinica_conexiones_google
  ADD CONSTRAINT clinica_conexiones_google_clinica_id_fkey
  FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id)
  ON DELETE RESTRICT ON UPDATE NO ACTION;

-- user_id → auth.users ON DELETE CASCADE. Se CONSERVA el comportamiento
-- actual de `google_tokens` (FK a auth.users con cascade). Desde la app sólo
-- se borran secretarias y médicos invitados, y bajo el modelo nuevo ninguno de
-- ellos tiene conexión de Google: quien la tiene es quien administra la
-- clínica, y esa cuenta no se borra. No hay camino por el que esta llave
-- llegue a dispararse, así que no se cambia.
--
-- Apunta a auth.users y no a public.profiles a propósito: es el mismo destino
-- que hoy, y el borrado real del usuario ocurre en auth, no en profiles.
ALTER TABLE public.clinica_conexiones_google
  DROP CONSTRAINT IF EXISTS clinica_conexiones_google_user_id_fkey;
ALTER TABLE public.clinica_conexiones_google
  ADD CONSTRAINT clinica_conexiones_google_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id)
  ON DELETE CASCADE ON UPDATE NO ACTION;

-- CHECKs en NOT VALID + VALIDATE fuera de la transacción, igual que en
-- 20260815_gcal_calendario_propio_a_esquema.sql. En la primera aplicación la
-- tabla nace vacía y el matiz da igual; importa en un replay sobre una base
-- donde la tabla ya existe con filas: ahí `ADD CONSTRAINT` normal escanearía
-- la tabla entera bajo ACCESS EXCLUSIVE (bloquea lecturas Y escrituras),
-- mientras que NOT VALID sólo aplica a las escrituras nuevas y aplaza la
-- comprobación de lo viejo al VALIDATE, que toma SHARE UPDATE EXCLUSIVE y no
-- bloquea ni lectura ni escritura.
--
-- Ojo: NOT VALID ya vigila los INSERT, así que el backfill de más abajo queda
-- cubierto por ambos CHECK aunque todavía no estén validados.
ALTER TABLE public.clinica_conexiones_google
  DROP CONSTRAINT IF EXISTS clinica_conexiones_google_rol_check;
ALTER TABLE public.clinica_conexiones_google
  ADD CONSTRAINT clinica_conexiones_google_rol_check
  CHECK (rol = ANY (ARRAY['clinica'::text, 'personal'::text]))
  NOT VALID;

ALTER TABLE public.clinica_conexiones_google
  DROP CONSTRAINT IF EXISTS clinica_conexiones_google_estado_check;
ALTER TABLE public.clinica_conexiones_google
  ADD CONSTRAINT clinica_conexiones_google_estado_check
  CHECK (estado = ANY (ARRAY['activa'::text, 'revocada'::text]))
  NOT VALID;

-- ── Índices ─────────────────────────────────────────────────────────────────
-- Se crean ANTES del backfill a propósito: si el pre-vuelo de ambigüedad de la
-- sección 5 fallara en cubrir algún caso, el índice único parcial hace que el
-- INSERT reviente en vez de dejar dos conexiones de clínica conviviendo.

-- 1) EL REQUISITO ENTERO. Cuál es la conexión de la clínica pasa a ser un
--    hecho que impone la base, no algo que un `ORDER BY` decide en cada
--    consulta. Parcial sobre rol='clinica': deja convivir varias 'personal'.
CREATE UNIQUE INDEX IF NOT EXISTS clinica_conexiones_google_una_por_clinica
  ON public.clinica_conexiones_google (clinica_id)
  WHERE rol = 'clinica';

-- 2) Una conexión por usuario. Conserva el comportamiento de hoy: el callback
--    de OAuth hace upsert por usuario, y `google_tokens` lo garantizaba con su
--    PRIMARY KEY (user_id).
CREATE UNIQUE INDEX IF NOT EXISTS clinica_conexiones_google_user_id_uniq
  ON public.clinica_conexiones_google (user_id);

-- 3) La misma cuenta de Google no puede quedar vinculada dos veces —hoy
--    indetectable, porque la cuenta ni siquiera se registra—. Parcial porque
--    NULL significa «identidad desconocida» (ver el backfill) y de esos puede
--    haber varios sin que eso sea un conflicto.
CREATE UNIQUE INDEX IF NOT EXISTS clinica_conexiones_google_account_sub_uniq
  ON public.clinica_conexiones_google (google_account_sub)
  WHERE google_account_sub IS NOT NULL;

-- 4) Lecturas por clínica (la policy de RLS filtra por esta columna).
CREATE INDEX IF NOT EXISTS clinica_conexiones_google_clinica_idx
  ON public.clinica_conexiones_google (clinica_id);

-- ── Comentarios ─────────────────────────────────────────────────────────────
COMMENT ON TABLE public.clinica_conexiones_google IS
  'Metadata de las conexiones de Google de una clínica. Sin secretos: los tokens viven en private.google_conexiones_secretos. Sustituye a public.google_tokens (retirada en el archivo B).';

COMMENT ON COLUMN public.clinica_conexiones_google.rol IS
  'clinica = LA conexión de la clínica, a cuyo calendario van las citas (máx. 1 por clínica, impuesto por índice único parcial). personal = conexión que existe pero no es la de la clínica.';

COMMENT ON COLUMN public.clinica_conexiones_google.google_account_sub IS
  'El `sub` del id_token de Google: identificador estable de la cuenta conectada. NULL = identidad desconocida (fila migrada desde google_tokens), NO «sin cuenta».';

COMMENT ON COLUMN public.clinica_conexiones_google.google_account_email IS
  'Email de la cuenta de Google conectada, para que el médico vea a cuál está enganchada su clínica. NULL = identidad desconocida.';

COMMENT ON COLUMN public.clinica_conexiones_google.calendar_id IS
  'Calendario de Spinus de esta conexión (calendar.app.created). NULL = aún no creado.';

COMMENT ON COLUMN public.clinica_conexiones_google.estado IS
  'activa | revocada. `revocada` conserva la fila —y con ella la identidad de la cuenta y el calendario— cuando el token deja de servir.';

-- ── Por qué existe rol = 'personal' ─────────────────────────────────────────
-- NO es para médicos invitados: ninguno va a poder conectar, y hoy no existe
-- ni uno con conexión. Existe para EL RELEVO DE ADMINISTRADOR. Cuando uno se
-- va y entra otro, hay un rato en que la clínica tiene dos conexiones y sólo
-- una puede ser la suya; la otra tiene que poder existir marcada como
-- no-la-de-la-clínica en vez de estorbar el índice único. Sin este valor, el
-- relevo obligaría a borrar la conexión saliente antes de dar de alta la
-- entrante, y entre las dos operaciones la clínica se queda sin calendario.
-- ────────────────────────────────────────────────────────────────────────────

-- ── updated_at ──────────────────────────────────────────────────────────────
-- DECISIÓN NO PEDIDA EXPLÍCITAMENTE, marcada como tal: sin este trigger la
-- columna `updated_at` valdría siempre lo mismo que `created_at` y sería un
-- dato que miente. Se sigue el patrón que ya usa el repo
-- (public.update_consultorios_updated_at, 20260615_consultorios_02_triggers).
CREATE OR REPLACE FUNCTION public.update_clinica_conexiones_google_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clinica_conexiones_google_updated_at
  ON public.clinica_conexiones_google;
CREATE TRIGGER trg_clinica_conexiones_google_updated_at
BEFORE UPDATE ON public.clinica_conexiones_google
FOR EACH ROW
EXECUTE FUNCTION public.update_clinica_conexiones_google_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.clinica_conexiones_google ENABLE ROW LEVEL SECURITY;

-- UNA SOLA POLICY PERMISIVA DE SELECT, a propósito. Un SELECT bajo RLS es la
-- UNIÓN de las políticas permisivas que apliquen: una segunda no restringe,
-- ENSANCHA, y lo hace en silencio. Quien necesite afinar el alcance tiene que
-- editar ésta, no añadir otra.
--
-- Usa public.get_clinica_id(), el helper que ya existe en el esquema
-- (baseline/05_functions.sql:20). No se inventa uno nuevo.
DROP POLICY IF EXISTS clinica_conexiones_google_select
  ON public.clinica_conexiones_google;
CREATE POLICY clinica_conexiones_google_select
ON public.clinica_conexiones_google
FOR SELECT
TO authenticated
USING (clinica_id = public.get_clinica_id());

-- Sin policy de INSERT / UPDATE / DELETE: sólo escribe el service role, que
-- bypasea RLS. Con RLS activa y sin política de escritura, cualquier intento
-- desde el cliente no encuentra fila ni puede crear ninguna.
--
-- Y además, defensa en profundidad a nivel de GRANT. Supabase concede por
-- default a anon/authenticated sobre las tablas nuevas de `public`; aquí se
-- retira lo que no hace falta.
-- ⚠️ PARA EL FUTURO: si algún día se añade una policy de escritura, NO bastará
--    con la policy — hay que devolver el GRANT correspondiente, o el error
--    será «permission denied for table», no un filtrado silencioso.
REVOKE ALL ON public.clinica_conexiones_google FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.clinica_conexiones_google FROM authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. private.google_conexiones_secretos — los tokens, inalcanzables
-- ════════════════════════════════════════════════════════════════════════════
-- Que no esté en `public` NO BASTA: hay que revocar los grants explícitamente.
-- Mismo patrón que el esquema `respaldos` de
-- 20260815_gcal_calendario_propio_b_datos.sql:62-63,76.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;

COMMENT ON SCHEMA private IS
  'Datos que ningún rol de cliente debe poder alcanzar. No expuesto por PostgREST y sin grants para anon/authenticated. Sólo service_role (que bypasea RLS) y el dueño de la base.';

CREATE TABLE IF NOT EXISTS private.google_conexiones_secretos (
  conexion_id   uuid   NOT NULL,
  access_token  text   NOT NULL,
  refresh_token text,
  expires_at    bigint,
  CONSTRAINT google_conexiones_secretos_pkey PRIMARY KEY (conexion_id)
);

-- Nullabilidad calcada de public.google_tokens (baseline/02_tables.sql:245-252)
-- a propósito: este archivo copia esos valores tal cual y no puede ser más
-- estricto que su origen. `expires_at` es bigint porque guarda el
-- `expiry_date` de Google en milisegundos epoch, no un timestamp.

ALTER TABLE private.google_conexiones_secretos
  DROP CONSTRAINT IF EXISTS google_conexiones_secretos_conexion_id_fkey;
ALTER TABLE private.google_conexiones_secretos
  ADD CONSTRAINT google_conexiones_secretos_conexion_id_fkey
  FOREIGN KEY (conexion_id) REFERENCES public.clinica_conexiones_google(id)
  ON DELETE CASCADE ON UPDATE NO ACTION;

REVOKE ALL ON private.google_conexiones_secretos FROM anon, authenticated;

COMMENT ON TABLE private.google_conexiones_secretos IS
  'access_token / refresh_token cifrados (AES-256-GCM, src/lib/encrypt.ts) de cada conexión de Google. Fuera de public y sin grants: no alcanzable por PostgREST.';

-- SIN RLS, deliberadamente. La RLS filtra filas para roles que YA pueden leer
-- la tabla; aquí no hay ninguno: `private` no está expuesto por PostgREST y
-- los grants están revocados. Activarla daría una sensación falsa de barrera
-- adicional —service_role la bypasea igual— sin cambiar quién llega.

-- ════════════════════════════════════════════════════════════════════════════
-- 4. public.appointments.gcal_calendar_id
-- ════════════════════════════════════════════════════════════════════════════
-- Guarda EL ID LITERAL del calendario donde vive el evento, NO una FK a la
-- conexión. Si el calendario se recrea, la conexión es la misma y con una FK
-- se perdería justo lo que se quiere saber. Con el id literal, «qué citas
-- vivían en el calendario que murió» es un WHERE exacto en vez de un barrido
-- por clínica entera.
--
-- ADD COLUMN sin DEFAULT no reescribe la tabla: es sólo catálogo.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS gcal_calendar_id text;

COMMENT ON COLUMN public.appointments.gcal_calendar_id IS
  'Id literal del calendario de Google donde vive google_event_id. NULL = no se sabe dónde vive el evento (o no hay evento). No es FK a propósito: sobrevive a que el calendario se recree.';

CREATE INDEX IF NOT EXISTS appointments_gcal_calendar_id_idx
  ON public.appointments (gcal_calendar_id)
  WHERE gcal_calendar_id IS NOT NULL;

-- El índice único que ya existe —appointments_clinica_google_event_id_uniq
-- (clinica_id, google_event_id), baseline/03_indexes.sql:34-36— sigue siendo
-- correcto y NO SE TOCA: los ids de evento de Google son únicos por
-- calendario, no entre calendarios, y el ámbito de clínica ya lo cubre.

-- ════════════════════════════════════════════════════════════════════════════
-- 5. ABORTOS OBLIGATORIOS — antes de escribir un solo dato
-- ════════════════════════════════════════════════════════════════════════════
-- Van DESPUÉS del DDL porque consultan la tabla nueva, y ANTES de cualquier
-- escritura de datos. El archivo entero es una transacción: si abortan, el
-- DDL de arriba se deshace con ellos y la base queda como estaba.
--
-- LA MIGRACIÓN NO DEBE ELEGIR. Elegir cuál conexión es la de la clínica es
-- exactamente la heurística que este cambio viene a erradicar. El índice único
-- parcial haría fallar estos casos de todos modos, pero con una violación de
-- índice que no dice cuál clínica ni por qué.
--
-- Ambos abortos se limitan a las filas PENDIENTES (las que todavía no tienen
-- conexión). En un replay, lo ya migrado no vuelve a decidirse.
DO $$
DECLARE
  v_detalle text;
BEGIN
  -- ── Aborto 1: perfil sin clínica ──────────────────────────────────────────
  -- Incluye el caso «no hay perfil»: sin clinica_id no hay dónde colgar la
  -- conexión, y la columna es NOT NULL.
  SELECT string_agg(gt.user_id::text, ', ' ORDER BY gt.user_id::text)
    INTO v_detalle
    FROM public.google_tokens gt
    LEFT JOIN public.profiles p ON p.id = gt.user_id
   WHERE NOT EXISTS (
           SELECT 1 FROM public.clinica_conexiones_google c
            WHERE c.user_id = gt.user_id)
     AND (p.id IS NULL OR p.clinica_id IS NULL);

  IF v_detalle IS NOT NULL THEN
    RAISE EXCEPTION
      'ABORTADO: hay conexiones de Google cuyo perfil no tiene clínica (o no tiene perfil). user_id: %. Asigna clinica_id a esos perfiles —o borra su fila de google_tokens si la conexión es basura— y vuelve a aplicar.',
      v_detalle;
  END IF;

  -- ── Aborto 2: la clínica no tiene exactamente una candidata ───────────────
  -- Candidata = perfil con conexión pendiente en esa clínica que sea
  -- administradora (es_admin_de_clinica IS TRUE, o role = 'admin').
  --
  -- Se exime a la clínica que YA tenga una conexión con rol='clinica': ahí no
  -- hay nada que decidir, las pendientes entran como 'personal'. Ese caso sólo
  -- aparece en un replay; en la primera aplicación la tabla está vacía.
  --
  -- Cero candidatas aborta igual que dos: con cero, la clínica se quedaría con
  -- conexiones pero sin conexión-de-la-clínica, y las citas no llegarían a
  -- ningún calendario sin que nada lo dijera.
  SELECT string_agg(
           format('%s (candidatas: %s, conexiones pendientes: %s)',
                  x.clinica_id, x.candidatas, x.pendientes),
           ' | ' ORDER BY x.clinica_id::text)
    INTO v_detalle
    FROM (
      SELECT p.clinica_id,
             count(*) FILTER (
               WHERE p.es_admin_de_clinica IS TRUE OR p.role = 'admin'
             ) AS candidatas,
             count(*) AS pendientes
        FROM public.google_tokens gt
        JOIN public.profiles p ON p.id = gt.user_id
       WHERE NOT EXISTS (
               SELECT 1 FROM public.clinica_conexiones_google c
                WHERE c.user_id = gt.user_id)
         AND NOT EXISTS (
               SELECT 1 FROM public.clinica_conexiones_google c
                WHERE c.clinica_id = p.clinica_id AND c.rol = 'clinica')
       GROUP BY p.clinica_id
      HAVING count(*) FILTER (
               WHERE p.es_admin_de_clinica IS TRUE OR p.role = 'admin'
             ) <> 1
    ) x;

  IF v_detalle IS NOT NULL THEN
    RAISE EXCEPTION
      'ABORTADO: hay clínicas donde no se puede deducir cuál es LA conexión de la clínica (se necesita exactamente una candidata administradora y no la hay, o hay varias). %. Resuélvelo marcando es_admin_de_clinica en el perfil que corresponda —o retirando la conexión sobrante— y vuelve a aplicar. Esta migración no elige por ti.',
      v_detalle;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. BACKFILL
-- ════════════════════════════════════════════════════════════════════════════

-- ── 6.1 Metadata ────────────────────────────────────────────────────────────
-- google_account_sub y google_account_email quedan en NULL, y eso significa
-- «IDENTIDAD DESCONOCIDA», no «sin cuenta». Hoy no están en la base y no se
-- pueden deducir: la respuesta de `refreshAccessToken` no trae `id_token` si
-- no se pidió `openid`. Añadir los scopes `openid` y `email` es cambio de
-- código y va en el deploy posterior; se poblarán cuando el dueño reconecte.
--
-- El ON CONFLICT (user_id) es redundante con el NOT EXISTS —está por si dos
-- aplicaciones concurrentes se cruzan— y cubre SÓLO el conflicto de user_id:
-- si el índice de «una conexión de clínica por clínica» se violara, esto
-- revienta, que es lo que se busca.
INSERT INTO public.clinica_conexiones_google
  (clinica_id, user_id, rol, calendar_id, estado)
SELECT p.clinica_id,
       gt.user_id,
       CASE
         WHEN (p.es_admin_de_clinica IS TRUE OR p.role = 'admin')
              AND NOT EXISTS (
                SELECT 1 FROM public.clinica_conexiones_google c
                 WHERE c.clinica_id = p.clinica_id AND c.rol = 'clinica')
           THEN 'clinica'
         ELSE 'personal'
       END,
       gt.calendar_id,   -- copia directa
       'activa'
  FROM public.google_tokens gt
  JOIN public.profiles p ON p.id = gt.user_id
 WHERE NOT EXISTS (
         SELECT 1 FROM public.clinica_conexiones_google c
          WHERE c.user_id = gt.user_id)
ON CONFLICT (user_id) DO NOTHING;

-- ── 6.2 Secretos ────────────────────────────────────────────────────────────
-- Copia literal. Los valores YA VIENEN CIFRADOS (AES-256-GCM, src/lib/encrypt.ts);
-- aquí no se descifra, no se recifra y no se toca nada: sólo se mueven de
-- tabla. Recifrarlos sería, además, imposible desde SQL: la clave vive en
-- GOOGLE_TOKEN_SECRET, en la aplicación.
INSERT INTO private.google_conexiones_secretos
  (conexion_id, access_token, refresh_token, expires_at)
SELECT c.id, gt.access_token, gt.refresh_token, gt.expires_at
  FROM public.clinica_conexiones_google c
  JOIN public.google_tokens gt ON gt.user_id = c.user_id
ON CONFLICT (conexion_id) DO NOTHING;

-- ── 6.3 En qué calendario vive cada evento ──────────────────────────────────
-- ⚠️ LA FUENTE ES `created_by`, NO `medico_id`. Es contraintuitivo y es lo
--    único correcto: EL EVENTO SE CREA EN EL CALENDARIO DE QUIEN GUARDA LA
--    CITA, no en el del médico al que la cita pertenece. El alta llama a
--    `conCalendarioSpinus(admin, profile.userId, …)`
--    (src/app/api/appointments/route.ts:272) y escribe
--    `created_by: profile.userId` (:197) en el mismo INSERT, mientras que
--    `medico_id` sale de `finalMedicoId` (:204), que para un administrador o
--    una secretaria es OTRO usuario. La edición hace lo mismo con `user.id`.
--
-- Con `medico_id`, una cita que el administrador agenda para un médico que
-- también tiene conexión quedaría estampada con el calendario del médico
-- cuando el evento vive en el del administrador: un valor falso justo en la
-- columna cuyo propósito es que `desvincularCitas` deje de barrer a ciegas.
-- Con los datos de hoy —una sola conexión— no se dispara; el archivo tiene que
-- sobrevivir a los datos de hoy.
--
-- Esta columna es, literalmente, la que src/lib/gcal.ts:379-383 pide en su
-- «hueco conocido»: «Cerrarlo pide una columna que registre de quién es el
-- evento». Llenarla desde `medico_id` sería recrear el hueco dentro del
-- remedio.
--
-- POR QUÉ EL JOIN ENCUENTRA FILA SIEMPRE QUE HAY EVENTO: si quien guarda la
-- cita no tiene conexión, `conCalendarioSpinus` devuelve null y no se crea
-- ningún evento; así que `google_event_id IS NOT NULL` implica que su autor
-- tenía conexión. Y toda cita con evento es posterior al 2026-08-15: el corte
-- B de ese día dejó `google_event_id` en NULL en la tabla entera.
--
-- `created_by` es nullable (FK a profiles ON DELETE SET NULL). Esas citas se
-- quedan en NULL, que aquí significa honestamente «no sé dónde vive este
-- evento» y es mejor que adivinar: adivinar mal es exactamente lo que alimenta
-- la rama destructiva de desvincularCitas. Nótese que el borrado del usuario
-- también se lleva su conexión (FK a auth.users ON DELETE CASCADE), así que no
-- habría con qué hacer el JOIN de todos modos.
--
-- LÍMITE RESIDUAL, IRREDUCIBLE DESDE SQL: se estampa el calendario que la
-- conexión tiene AHORA, no el que tenía cuando se creó el evento. Si el
-- calendario del autor se recreó tras un 404, el id viejo no quedó registrado
-- en ninguna parte. El caso está acotado: antes de recrear,
-- `conCalendarioSpinus` llama a `desvincularCitas`, que pone `google_event_id`
-- en NULL para las citas de ese médico y para las que no tienen médico, y las
-- que sobreviven a ese filtro son justo las del hueco de arriba.
--
-- `c.clinica_id = a.clinica_id` NO es decorativo: sin él, un usuario que
-- cambió de clínica estamparía en las citas viejas de su clínica anterior el
-- calendario de la nueva. Filtro de aislamiento entre clínicas, obligatorio
-- por el pendiente prioritario de CLAUDE.md.
--
-- `a.gcal_calendar_id IS NULL` hace el paso idempotente y no destructivo: en
-- un replay nunca pisa un id ya escrito. Pisarlo sería el bug: si el autor
-- reconectó y su calendario cambió, el valor viejo es el correcto para las
-- citas viejas, y es el único rastro de dónde estaban.
UPDATE public.appointments a
   SET gcal_calendar_id = c.calendar_id
  FROM public.clinica_conexiones_google c
 WHERE c.user_id           = a.created_by
   AND c.clinica_id        = a.clinica_id
   AND c.calendar_id      IS NOT NULL
   AND a.google_event_id  IS NOT NULL
   AND a.gcal_calendar_id IS NULL;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. Fuera de la transacción
-- ════════════════════════════════════════════════════════════════════════════
-- Cada VALIDATE toma SHARE UPDATE EXCLUSIVE y deja pasar lecturas y
-- escrituras. Si alguno falla, el constraint se queda en NOT VALID —sigue
-- vigilando las escrituras nuevas— y el veredicto de abajo lo reporta.
ALTER TABLE public.clinica_conexiones_google
  VALIDATE CONSTRAINT clinica_conexiones_google_rol_check;
ALTER TABLE public.clinica_conexiones_google
  VALIDATE CONSTRAINT clinica_conexiones_google_estado_check;

-- appointments estrenó columna e índice; las estadísticas están frías.
ANALYZE public.appointments;
ANALYZE public.clinica_conexiones_google;

-- ════════════════════════════════════════════════════════════════════════════
-- 8. VEREDICTO — en la rejilla de resultados
-- ════════════════════════════════════════════════════════════════════════════
-- El SQL Editor de Supabase no muestra de forma fiable RAISE NOTICE ni
-- RAISE WARNING: una migración cuyo resultado viaje sólo por ahí se lee igual
-- haya funcionado o no. Esta es la última sentencia del archivo a propósito;
-- el editor muestra el resultado de la última.
--
-- `citas_ubicadas < citas_con_evento` NO es un fallo: son las citas sin
-- `created_by` (o cuyo autor ya no tiene conexión en esa clínica), cuyo
-- calendario es honestamente desconocido. Por eso va como columna informativa
-- y no entra en el veredicto. Con los datos de hoy se esperan las 3 ubicadas.
WITH m AS (
  SELECT
    (SELECT count(*) FROM public.google_tokens)                              AS tokens_viejos,
    (SELECT count(*) FROM public.clinica_conexiones_google)                  AS conexiones,
    (SELECT count(*) FROM public.clinica_conexiones_google
      WHERE rol = 'clinica')                                                 AS de_clinica,
    (SELECT count(DISTINCT clinica_id) FROM public.clinica_conexiones_google) AS clinicas,
    (SELECT count(*) FROM private.google_conexiones_secretos)                AS secretos,
    (SELECT count(*) FROM public.appointments
      WHERE google_event_id IS NOT NULL)                                     AS citas_con_evento,
    (SELECT count(*) FROM public.appointments
      WHERE google_event_id IS NOT NULL AND gcal_calendar_id IS NOT NULL)    AS citas_ubicadas,
    (SELECT count(*) FROM pg_constraint
      WHERE conrelid = 'public.clinica_conexiones_google'::regclass
        AND contype = 'c' AND convalidated)                                  AS checks_validados,
    (SELECT count(*) FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'clinica_conexiones_google')                         AS policies,
    (SELECT relrowsecurity FROM pg_class
      WHERE oid = 'public.clinica_conexiones_google'::regclass)              AS rls_activa,
    -- INFORMATIVA, fuera del veredicto: cuántos secretos NO tienen forma de
    -- salida de encrypt() (`iv:authTag:ciphertext` en hex, src/lib/encrypt.ts:23).
    -- Se espera 0. Si sale >0 no es culpa de este archivo —copia literal de lo
    -- que había en google_tokens— pero conviene saberlo AHORA y no después del
    -- deploy: decrypt() lee un valor así como NULL en silencio, y aguas arriba
    -- eso se ve igual que «este médico nunca conectó». El archivo B sí aborta
    -- sobre esto, porque allí ya no habría de dónde recuperar.
    (SELECT count(*) FROM private.google_conexiones_secretos s
      WHERE s.access_token !~ '^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$'
         OR (s.refresh_token IS NOT NULL
             AND s.refresh_token !~ '^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$')) AS secretos_con_forma_rara,
    -- has_*_privilege y no information_schema.role_table_grants: esa vista
    -- sólo muestra los grants de roles de los que el usuario actual es
    -- miembro, así que puede devolver 0 por no ver, no por no haber.
    (SELECT count(*) FROM (VALUES ('anon'),('authenticated')) AS r(rol)
      WHERE has_schema_privilege(r.rol, 'private', 'USAGE')
         OR has_table_privilege(r.rol, 'private.google_conexiones_secretos', 'SELECT')) AS grants_indebidos
)
SELECT m.*,
       CASE
         WHEN m.conexiones <> m.tokens_viejos THEN
           'REVISAR: hay ' || m.tokens_viejos || ' filas en google_tokens y ' || m.conexiones || ' conexiones. El backfill no cubrió todo.'
         WHEN m.secretos <> m.conexiones THEN
           'REVISAR: ' || m.conexiones || ' conexiones y ' || m.secretos || ' secretos. Hay conexiones sin token.'
         WHEN m.de_clinica <> m.clinicas THEN
           'REVISAR: ' || m.clinicas || ' clínicas con conexión pero ' || m.de_clinica || ' conexiones de clínica. Alguna clínica quedó sin calendario donde escribir.'
         WHEN m.checks_validados <> 2 THEN
           'REVISAR: se esperaban 2 CHECK validados y hay ' || m.checks_validados || '. Algún VALIDATE falló; hay datos que violan rol o estado.'
         WHEN m.rls_activa IS NOT TRUE OR m.policies <> 1 THEN
           'REVISAR: RLS activa=' || coalesce(m.rls_activa::text,'?') || ', policies=' || m.policies || '. Se esperaba activa=true y exactamente 1 policy (SELECT).'
         WHEN m.grants_indebidos > 0 THEN
           'REVISAR: private.google_conexiones_secretos tiene ' || m.grants_indebidos || ' grants para anon/authenticated. Los tokens son alcanzables.'
         ELSE
           'OK — corte A aplicado. Sigue: deploy del código nuevo. El archivo B (retiro de google_tokens) sólo después del deploy y de un periodo de reposo.'
       END AS veredicto
  FROM m;
