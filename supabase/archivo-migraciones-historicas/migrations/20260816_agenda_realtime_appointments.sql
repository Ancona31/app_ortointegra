-- ============================================================================
-- Agenda en tiempo real — alta de `appointments` en la publicación de Realtime
-- ============================================================================
--
-- QUÉ HACE: agrega `public.appointments` a la publicación `supabase_realtime`.
-- Sin esto, la suscripción a `postgres_changes` de la agenda se conecta sin
-- error y no recibe nada nunca — que es exactamente lo que pasaba hasta hoy.
--
-- QUÉ NO HACE, A PROPÓSITO: no toca `REPLICA IDENTITY`. Ver la nota al final.
--
-- TODO va dentro de UN SOLO `DO`, con el ALTER por `EXECUTE`. No es estilo:
-- un statement es atómico bajo cualquier cliente, sin depender de que el SQL
-- Editor envuelva el script en una transacción implícita ni de un `BEGIN`
-- explícito (que dentro de un cliente que ya abrió transacción avisa
-- «there is already a transaction in progress» y cierra la suya antes de
-- tiempo). Si algo truena, no queda nada a medias.
--
-- El veredicto sale por el `SELECT` final, no por `RAISE NOTICE`: el SQL
-- Editor de Supabase no muestra los notices de forma fiable, y una
-- comprobación que no se ve no es una comprobación.
--
-- Aplicar a mano en el SQL Editor de Supabase, FUERA DE HORARIO DE CONSULTA
-- (ver "SUSCRIPTORES YA CONECTADOS" al final).
-- ============================================================================

DO $$
DECLARE
  v_ident      "char";
  v_extra      text;
  v_pub        record;
  v_dueno_pub  oid;
  v_dueno_tab  oid;
BEGIN
  -- Que una espera por lock falle rápido en vez de colgar el editor detrás de
  -- un autovacuum o de una transacción larga. `ADD TABLE` toma
  -- ShareUpdateExclusiveLock: no estorba a las lecturas ni a las escrituras de
  -- la app, pero sí hace cola tras VACUUM/ANALYZE/otros ALTER.
  PERFORM set_config('lock_timeout', '5s', true);

  -- ─── PRE-FLIGHT ─────────────────────────────────────────────
  -- 0. La tabla existe. Va primero porque los `::regclass` de abajo revientan
  --    con un error críptico si no, antes de cualquier mensaje legible.
  IF to_regclass('public.appointments') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: no existe la tabla public.appointments. Abortando.';
  END IF;

  v_dueno_tab := (SELECT relowner FROM pg_class WHERE oid = 'public.appointments'::regclass);

  -- 1. La publicación existe, y publica las tres acciones que la agenda
  --    necesita. Con `pubdelete` en false las citas canceladas se quedarían
  --    pintadas para siempre sin que nada lo delate.
  SELECT oid, pubowner, pubinsert, pubupdate, pubdelete
    INTO v_pub
    FROM pg_publication
   WHERE pubname = 'supabase_realtime';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: la publicación supabase_realtime no existe. Abortando.';
  END IF;

  IF NOT (v_pub.pubinsert AND v_pub.pubupdate AND v_pub.pubdelete) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: supabase_realtime no publica las tres acciones (insert=%, update=%, delete=%). La agenda necesita las tres. Abortando.',
      v_pub.pubinsert, v_pub.pubupdate, v_pub.pubdelete;
  END IF;

  -- 2. ¿Ya está publicada? Es un NO-OP, no un error: este archivo vive en
  --    supabase/migrations/ y cualquier `db push`, `db reset` o repegado lo
  --    vuelve a correr. Una migración que falla al repetirse rompe el
  --    historial. `pg_publication_tables` expande FOR ALL TABLES, así que esta
  --    rama también cubre ese caso (donde el ALTER fallaría).
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'appointments'
  ) THEN
    PERFORM set_config(
      'spinus.resultado',
      'SIN CAMBIOS: appointments ya estaba en supabase_realtime. Nada que aplicar.',
      false
    );
    RETURN;
  END IF;

  -- 3. La RLS no es un requisito administrativo, es LA pieza de la que depende
  --    que esto sea seguro, y por dos vías distintas:
  --      · INSERT y UPDATE: Realtime evalúa `appointments_select` por
  --        suscriptor (relee la fila con su rol y sus claims), así que una
  --        clínica no ve los cambios de otra;
  --      · DELETE: la RLS no puede evaluarse sobre una fila que ya no existe.
  --        Realtime ni lo intenta —manda el borrado a TODO suscriptor de la
  --        tabla— y justo por eso poda el `old_record` a la llave primaria
  --        CUANDO LA TABLA TIENE RLS. Con la RLS apagada mandaría la fila
  --        vieja entera, título y notas incluidos, a cualquier clínica.
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.appointments'::regclass) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: RLS deshabilitada en appointments. Publicarla filtraría datos de otras clínicas en los DELETE. Abortando.';
  END IF;

  -- 4. La policy que aísla las clínicas existe Y ES LA ÚNICA permisiva de
  --    SELECT. Comprobar solo que exista no basta: el SELECT bajo RLS es la
  --    UNIÓN de las permisivas, así que una segunda (la vieja `clinica_select`
  --    resucitada, una de depuración con USING(true)) ensancharía el canal con
  --    el pre-flight en verde. Las RESTRICTIVE no cuentan: solo estrechan.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.appointments'::regclass
      AND polname = 'appointments_select'
      AND polpermissive
      AND polcmd IN ('r', '*')
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: no existe una policy PERMISSIVE de SELECT llamada appointments_select. Es la que aísla las clínicas en el canal. Abortando.';
  END IF;

  SELECT string_agg(polname, ', ' ORDER BY polname) INTO v_extra
    FROM pg_policy
   WHERE polrelid = 'public.appointments'::regclass
     AND polpermissive
     AND polcmd IN ('r', '*')
     AND polname <> 'appointments_select';

  IF v_extra IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: hay otras policies PERMISSIVE de SELECT sobre appointments (%). El canal enseñaría la unión de todas, no solo appointments_select. Revisar antes de publicar. Abortando.', v_extra;
  END IF;

  -- 5. REPLICA IDENTITY utilizable. Esto NO es cosmético: si la tabla está en
  --    'nothing', publicarla hace que Postgres RECHACE todo UPDATE y todo
  --    DELETE sobre ella («cannot update table ... because it does not have a
  --    replica identity and publishes updates»). Sería la agenda entera muerta
  --    desde el commit. Por eso aborta ANTES del ALTER y no avisa después.
  SELECT relreplident INTO v_ident FROM pg_class WHERE oid = 'public.appointments'::regclass;

  IF v_ident = 'n' THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: appointments tiene REPLICA IDENTITY = nothing. Publicarla haría fallar TODO update y delete de citas. Abortando.';
  END IF;

  IF v_ident = 'i' AND NOT EXISTS (
    SELECT 1 FROM pg_index
    WHERE indrelid = 'public.appointments'::regclass
      AND indisreplident AND indisvalid
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: REPLICA IDENTITY = index pero el índice de identidad no existe o es inválido. Equivale a nothing: los update y delete fallarían. Abortando.';
  END IF;

  -- 6. El rol suscriptor puede leer la tabla. Realtime filtra las columnas del
  --    payload por los privilegios de `authenticated`; sin SELECT, el canal
  --    entrega registros de error en vez de citas, y eso desde el navegador no
  --    hay quien lo diagnostique.
  IF NOT has_table_privilege('authenticated', 'public.appointments', 'SELECT') THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: el rol authenticated no tiene SELECT sobre public.appointments. El canal entregaría registros de error. Abortando.';
  END IF;

  -- 7. Propiedad. `ALTER PUBLICATION ... ADD TABLE` exige ser dueño de la
  --    publicación Y de la tabla. En proyectos Supabase antiguos
  --    supabase_realtime es de supabase_admin y esto muere aquí; mejor un
  --    mensaje que diga qué pedir que un «must be owner of publication».
  v_dueno_pub := v_pub.pubowner;

  IF NOT pg_has_role(current_user, v_dueno_pub, 'MEMBER') THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: % no es dueño de la publicación supabase_realtime (dueño: %). Aplicar con ese rol. Abortando.',
      current_user, pg_get_userbyid(v_dueno_pub);
  END IF;

  IF NOT pg_has_role(current_user, v_dueno_tab, 'MEMBER') THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: % no es dueño de public.appointments (dueño: %). Abortando.',
      current_user, pg_get_userbyid(v_dueno_tab);
  END IF;

  -- ─── CAMBIO ─────────────────────────────────────────────────
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments';

  -- ─── POST-FLIGHT ────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'appointments'
  ) THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: appointments no quedó en supabase_realtime.';
  END IF;

  PERFORM set_config(
    'spinus.resultado',
    format('APLICADO: appointments publicada en supabase_realtime. REPLICA IDENTITY = %s.', v_ident),
    false
  );
END $$;

-- Veredicto visible en la rejilla de resultados. Los RAISE NOTICE no se ven en
-- el SQL Editor; esto sí.
SELECT
  current_setting('spinus.resultado', true)                                    AS resultado,
  (SELECT count(*) FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'appointments')                AS publicada,
  (SELECT relreplident FROM pg_class WHERE oid = 'public.appointments'::regclass) AS replica_identity,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.appointments'::regclass) AS rls_activa,
  (SELECT count(*) FROM pg_policy
    WHERE polrelid = 'public.appointments'::regclass
      AND polpermissive AND polcmd IN ('r','*'))                               AS policies_select_permisivas;

-- ============================================================================
-- POR QUÉ NO SE TOCA `REPLICA IDENTITY`
--
-- La tentación es ponerla en `full` para que los DELETE traigan la fila vieja
-- y poder filtrarlos por `clinica_id`. No sirve: con RLS activa, Supabase poda
-- el `old_record` de un DELETE a la llave primaria pase lo que pase. Verbatim
-- de walrus (`walrus_migration_0015`, la última que redefine `apply_rls`):
--
--   and ( not is_rls_enabled or (c).is_pkey )
--       -- if RLS enabled, we can't secure deletes so filter to pkey
--
-- y, unas líneas antes, la RLS ni se evalúa para los borrados:
--
--   if is_rls_enabled and action <> 'DELETE' then   -- prepara la sentencia RLS
--   if not is_rls_enabled or action = 'DELETE' then -- visible para TODOS
--
-- En `full` seguiría llegando sólo el uuid. Lo que `full` SÍ habilitaría —y la
-- versión anterior de esta nota omitía— es que walrus recupere columnas TOAST
-- no modificadas en un UPDATE, que reconstruye desde el registro viejo. Con
-- `default` una `notes` grande que el UPDATE no tocó no viaja en el payload.
-- No es un problema aquí: el cliente fusiona `extendedProps` clave por clave,
-- así que la clave ausente deja el valor anterior, que es el correcto. Si algún
-- día `aplicarAppointmentAlEvento` pasa a sustituir en bloque, esto se vuelve
-- borrado silencioso de la nota y hay que reevaluar `full`.
--
-- El precio de `full` es escribir la imagen completa de la fila anterior en el
-- WAL en cada UPDATE y cada DELETE, y cada alta de cita hace además dos UPDATE
-- por la sincronización con Google. No se paga.
--
-- LO QUE ESTO NO PROTEGE, Y ES DELIBERADO
--   Todo suscriptor de la tabla, de CUALQUIER clínica, recibe TODOS los DELETE
--   con `{ id }` y su marca de tiempo. No hay fuga de datos del paciente; sí de
--   la existencia y el momento de un borrado ajeno. Con una clínica activa es
--   irrelevante; con N clínicas es N× abanico por cancelación. Aceptado.
--
--   Y por eso el canal NO lleva `filter` de `clinica_id`: en los DELETE el
--   filtro se evalúa contra el registro viejo —sólo la PK—, así que filtrar
--   SUPRIMIRÍA todos los borrados en vez de acotarlos.
--
-- SUSCRIPTORES YA CONECTADOS
--   Quien tenga la agenda abierta al aplicar esto no recibirá nunca los
--   cambios escritos entre su carga de página y el commit: nunca se
--   publicaron. El websocket no se cae, así que el refetch de reconexión del
--   cliente (`huboCaida`) tampoco se dispara. Aplicar fuera de horario de
--   consulta y pedir recarga de las pestañas abiertas.
--
-- REVERSA
--   No desconecta a nadie: los canales siguen unidos y dejan de recibir en
--   silencio, sin CHANNEL_ERROR y por tanto sin refetch. Avisar de recargar.
--
--   DO $$
--   BEGIN
--     IF EXISTS (SELECT 1 FROM pg_publication_tables
--                 WHERE pubname='supabase_realtime'
--                   AND schemaname='public' AND tablename='appointments') THEN
--       EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.appointments';
--     END IF;
--   END $$;
-- ============================================================================
