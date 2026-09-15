-- ═══════════════════════════════════════════════════════════════════════
-- Bloque B5.6 — el trigger de aprovisionamiento que faltó
-- Rama: feature/auth-b5-trigger · Escrita: 2026-09-14
-- Revisión de auditoría: 2026-09-14 (ver «CAMBIOS DE LA AUDITORÍA» abajo)
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-09-14
--   Aplicada con `npx supabase db push --local`.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (al 2026-09-14)
--   Al aplicar, sustituir este rótulo por «APLICADA Y VERIFICADA — <fecha>»
--   con el resultado de la consulta de abajo (§7 del protocolo).
--
-- ✅ AUDITADA — 2026-09-14, por `supabase/AUDITORIA-MIGRACIONES.md`. Sus diez
-- correcciones están incorporadas y listadas en «CAMBIOS DE LA AUDITORÍA»,
-- más abajo. Este renglón sustituye al aviso de «pendiente de auditoría» que
-- llevó el archivo mientras no había pasado por ella: queda como constancia de
-- que pasó, no como adorno.
--
-- La comprobación que respalda lo de LOCAL, corrida aparte el 2026-09-14.
-- Corre aparte porque `npx supabase db push` NO imprime conjuntos de
-- resultados: el `SELECT` del final del archivo no llega a ninguna pantalla.
--
--   SELECT (SELECT count(*) FROM information_schema.columns
--            WHERE table_schema='public' AND table_name='profiles'
--              AND column_name='invitado_por')                    AS col,
--          (SELECT count(*) FROM pg_constraint
--            WHERE conrelid='public.profiles'::regclass
--              AND conname='profiles_invitado_por_fkey')           AS fk,
--          p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner)   AS owner,
--          (SELECT count(*) FROM pg_trigger
--            WHERE tgrelid='auth.users'::regclass
--              AND tgname='on_auth_user_created'
--              AND tgfoid=p.oid AND NOT tgisinternal)             AS trg
--     FROM pg_proc p WHERE p.oid = to_regprocedure('public.handle_new_user()');
--
--   Esperado: 1 · 1 · t · {"search_path=\"\""} · postgres · 1
--   → En LOCAL devolvió EXACTAMENTE esos seis valores el 2026-09-14.
--
-- ⚠️ Y VERIFICADA EN COMPORTAMIENTO, NO SOLO EN CATÁLOGO. Que los seis valores
-- cuadren dice que los objetos existen; no dice que el trigger haga su trabajo.
-- El 2026-09-14, en local, un alta REAL por Google OAuth —con un correo que no
-- estaba en la base— produjo un perfil con `role='medico'`, `clinica_id` NULL,
-- `es_admin_de_clinica` false e `invitado_por` NULL: exactamente las cuatro
-- cosas que las dos decisiones de diseño de abajo prometen. Ese mismo camino,
-- antes de esta migración, dejaba la fila de `auth.users` SIN NINGÚN PERFIL —
-- que es el hueco que este bloque viene a cerrar, comprobado en los dos
-- sentidos.
--
-- ⚠️ `npx supabase db push` SIN `--local` APUNTA A PRODUCCIÓN. Comprobado el
-- 2026-09-14: `--dry-run` respondió «Connecting to remote database... Would
-- push these migrations: 20260914_b56…». Para local es `db push --local`.
-- ═══════════════════════════════════════════════════════════════════════
-- Propósito: que TODA fila nueva de `auth.users` tenga su fila en
-- `public.profiles`, venga por donde venga. Hoy ese perfil lo crean dos rutas
-- de la aplicación —`api/auth/registro` y `api/admin/crear-usuario`—, así que
-- cualquier alta que no pase por ellas queda huérfana:
--   · un POST directo a /auth/v1/signup con la anon key (abierto HOY, y ya
--     produjo dos cuentas huérfanas en producción);
--   · Google OAuth, comprobado en local: fila en `auth.users` y nada más.
-- Un usuario sin perfil no tiene rol, ni clínica, ni gate: la aplicación
-- entera lee `profiles` para saber quién es.
--
-- El plan de B5 pedía tres capas —trigger, layout y RLS—. Se construyeron dos.
-- El trigger se perdió en un reordenamiento y NO hay decisión escrita de
-- descartarlo (comprobado: cero menciones de `handle_new_user` en todo el
-- repositorio). Esto es esa tercera capa, con seis meses de retraso.
--
-- ═══ LAS DOS DECISIONES DE DISEÑO, Y SON LO IMPORTANTE ══════════════════
--
-- 1 · EL TRIGGER NO CREA CLÍNICA. Crea un perfil con `clinica_id` NULL, y la
--     clínica la crea el propio médico en el onboarding, con gesto humano
--     explícito, vía `POST /api/me/clinica`.
--     Por qué importa: así UNA FILA NUEVA EN `auth.users` NUNCA ES UN
--     INQUILINO NUEVO. Si el trigger creara clínica, encender Google —que
--     permite darse de alta a cualquiera con un correo— convertiría cada
--     registro en una clínica nueva; y un médico que un día entra por
--     contraseña y otro por Google acabaría con DOS clínicas y su expediente
--     partido entre ambas, con la RLS impidiendo siquiera verlas juntas.
--     Reunirlas después es cirugía con cliente de servicio sobre datos
--     clínicos.
--
-- 2 · EL TRIGGER NO ESCRIBE `es_admin_de_clinica`. Esa columna significa
--     «dueño de la clínica X» y sólo afirma algo cuando `clinica_id` NO es
--     NULL. El estado (flag=true, clinica_id=NULL) no debería existir: es
--     exactamente el que dejó pasar guardas de administración que comprobaban
--     el flag sin mirar la clínica (cerrado el 2026-09-14 en cinco archivos;
--     ver el comentario de `canManageClinica` en `src/lib/permissions.ts`).
--     El DEFAULT de la columna es `false` y el trigger lo deja tal cual.
--
--     ⚠️ Y ESCRIBIR `true` NO ES UNA ALTERNATIVA, POR UNA RAZÓN QUE NO ESTABA
--     ESCRITA: el UPSERT de `api/admin/crear-usuario/route.ts:94-106` NO
--     incluye la columna `es_admin_de_clinica`. Antes de este trigger eso era
--     inocuo —el INSERT tomaba el DEFAULT `false`—, pero con el trigger puesto
--     el UPSERT pasa a ser un UPDATE que NO la toca: lo que el trigger
--     escriba, se queda. Un trigger que escribiera `true` convertiría a TODO
--     médico o secretaria invitado en dueño de la clínica ajena a la que lo
--     añadieron. La decisión 2 no es estilo: es la que evita una escalada de
--     privilegios entre inquilinos.
--
-- ⚠️⚠️ EL PRECIO DE LA DECISIÓN 2, QUE EL BORRADOR DE ESTE ARCHIVO DESCRIBÍA
-- AL REVÉS. El borrador decía que el peor caso era «el médico ve una pantalla
-- de onboarding que no esperaba: molesto, visible y reversible». No es eso.
-- Un usuario aprovisionado SÓLO por este trigger queda con `clinica_id` NULL y
-- `es_admin_de_clinica` false, y `src/lib/perfil/gate.ts:164` calcula
-- `requiereSoporte: sinClinica && !esDueno` — o sea TRUE. Con eso,
-- `OnboardingModal.tsx:382,580-600` no le enseña el formulario de clínica: le
-- enseña el PANEL DE SOPORTE, un modal bloqueante (`hideClose`, `onClose`
-- no-op) SIN botón «Continuar» y con un `mailto:` como única salida. NO puede
-- llegar a `POST /api/me/clinica`, que es lo que la decisión 1 da por hecho.
-- `api/auth/registro/route.ts:26-32` ya documenta ese estado con nombre
-- propio —«un encierro de fábrica»— y es la razón de que esa ruta escriba
-- `es_admin_de_clinica: true` (`route.ts:81-84`).
--
-- Los dos literales son malos y el trigger no puede elegir, porque no sabe si
-- el alta es un registro propio o una invitación. Quien lo sabrá es
-- `invitado_por`, y leerlo es el bloque siguiente. CONSECUENCIA OPERATIVA, Y
-- ES LA ÚNICA QUE HAY QUE RECORDAR DE TODO ESTE ARCHIVO:
--
--   ⛔ NO ENCENDER GOOGLE OAUTH EN PRODUCCIÓN HASTA QUE EL BLOQUE SIGUIENTE
--      LEA `invitado_por` EN EL GATE. Con esta migración puesta y Google
--      encendido, cada alta nueva por Google aterriza en el panel de soporte.
--
-- Lo que sí arregla hoy en producción: el POST directo a /auth/v1/signup con
-- la anon key deja de producir cuentas SIN perfil. Ese camino no es un camino
-- de producto —el registro legítimo es `api/auth/registro`, que escribe el
-- flag correcto—, así que cambiar «huérfano silencioso» por «cuenta que pide
-- soporte» es una mejora estricta: pasa de invisible a visible. Las dos rutas
-- de la aplicación NO se ven afectadas (ver la comprobación del UPSERT arriba
-- y la de `registro`, que sí escribe el flag).
--
-- ═══ QUÉ AÑADE LA COLUMNA `invitado_por` ════════════════════════════════
-- Registra QUIÉN dio de alta a este usuario, que es el hecho que distingue
-- los dos casos y que hoy no se guarda en ninguna parte: un dueño que se
-- registró solo (`invitado_por` NULL) y un médico o secretaria que añadió el
-- administrador de una clínica (`invitado_por` = su id). Hoy eso se deduce de
-- `es_admin_de_clinica`, que es la deducción que este bloque viene a retirar.
-- La columna se AÑADE aquí y NADIE LA ESCRIBE TODAVÍA: la escribirá
-- `api/admin/crear-usuario` y la leerá el criterio del gate, los dos en el
-- bloque siguiente. Se adelanta para que la base esté puesta antes.
--
-- ⚠️ ORDEN DE DESPLIEGUE: ESTA MIGRACIÓN PUEDE IR PRIMERO. Ninguna capa de la
-- aplicación depende de esto para funcionar: el trigger sólo AÑADE filas que
-- antes faltaban, y los dos escritores existentes hacen UPSERT
-- (`registro/route.ts:81`, `crear-usuario/route.ts:94`), así que se encuentran
-- la fila hecha y la actualizan. Nada de `src/` cambia en este bloque.
--
-- ⚠️ PERO SÍ CAMBIA ALGO QUE NO ESTABA ESCRITO: al existir ya la fila, el
-- UPSERT de esas dos rutas deja de ser un INSERT y pasa a ser un UPDATE, y con
-- eso EMPIEZA A DISPARAR `trg_proteger_columnas_sensibles_profiles` (BEFORE
-- UPDATE), que aborta si cambian `role`, `clinica_id` o `es_admin_de_clinica`.
-- No rompe nada porque ese trigger se exime cuando `auth.uid()` es NULL y las
-- dos rutas escriben con `service_role`, cuyo JWT no trae `sub` (comprobado en
-- local: `SET ROLE service_role` → `auth.uid() IS NULL` → true; y es el mismo
-- caso (c) de los smoke tests de `20260602_sec_proteger_columnas_sensibles_
-- profiles.sql:41`). Queda escrito porque si algún día esas rutas escriben con
-- la sesión del admin en vez de con `service_role`, el alta empezará a fallar
-- aquí y nadie sabrá por qué.
--
-- ⚠️ NO RELLENA LOS HUÉRFANOS QUE YA EXISTEN, y es deliberado. Las cuentas de
-- `auth.users` que hoy no tienen perfil SEGUIRÁN sin tenerlo después de
-- aplicar esto. El pre-vuelo las cuenta y las escribe en el mensaje de aborto
-- de su última comprobación; regularizarlas es otra decisión: escribirles
-- `role='medico'` a ciegas es afirmar algo que nadie ha comprobado sobre esas
-- cuentas. Se auditan y se deciden aparte.
--
-- ═══ CAMBIOS DE LA AUDITORÍA sobre el borrador original ═════════════════
--  A. EL POST-VUELO SE ABORTABA A SÍ MISMO. Comprobaba el `search_path` con
--     `'search_path=' = ANY(proconfig)`, y `proconfig` guarda
--     `search_path=""` —con las dos comillas dentro del valor—. El predicado
--     era falso SIEMPRE, así que el archivo no podía aplicarse nunca: moría en
--     su propio POST-FLIGHT y revertía. Reproducido dos veces en local
--     (PostgreSQL 17.6) y confirmado contra la función hermana ya viva:
--     `proteger_columnas_sensibles_profiles` tiene `{"search_path=\"\""}`.
--  B. PRE-VUELO: la guarda del invariante sólo veía `polcmd = 'a'`. Una policy
--     `FOR ALL` tiene `polcmd = '*'` y también abre INSERT, y se colaba entera
--     (comprobado creando una en transacción revertida). Ahora busca las dos.
--  C. PRE-VUELO: se comprueba que el rol que aplica pueda producir una función
--     que escriba en `profiles` —dueño de la tabla o `BYPASSRLS`, y la tabla
--     sin `FORCE ROW LEVEL SECURITY`— ANTES de crear nada. Sin eso, la función
--     queda instalada y CADA alta falla con «Database error saving new user».
--     El POST-VUELO lo vuelve a comprobar sobre `proowner`. La migración
--     hermana `20260913_b5_perfil_completo_rls.sql:829` ya lo hacía.
--  D. PRE-VUELO: se aborta si ya existe un trigger `on_auth_user_created` en
--     `auth.users` que NO sea éste. `on_auth_user_created` es el nombre
--     canónico de la documentación de Supabase; el `DROP TRIGGER IF EXISTS` se
--     habría llevado en silencio un trigger ajeno con ese nombre. Que el dump
--     de producción no lo liste no prueba nada: ese dump NO contiene el DDL
--     del esquema `auth` (comprobado: cero `CREATE TABLE "auth"…`). Si el
--     trigger que hay YA es éste, es un no-op silencioso, como pide la
--     dimensión 3.
--  E. PRE-VUELO: se comprueba que ninguna columna de `profiles` distinta de
--     `id`/`role` sea `NOT NULL` sin DEFAULT, y que no haya ningún otro
--     trigger de INSERT sobre `profiles`. Ésas son las dos formas en que el
--     INSERT del trigger levantaría excepción DENTRO de la transacción de
--     GoTrue, y ninguna depende de las dos columnas que el borrador
--     comprobaba. Importa sobre todo en replay: hoy no hay ninguna.
--  F. POST-VUELO: SMOKE TEST REAL. Se inserta una fila de prueba en
--     `auth.users` dentro de una subtransacción, se comprueba que el perfil
--     salió con `role='medico'`, sin clínica y sin flag, y se deshace. Es la
--     única respuesta no especulativa a «¿puede este cuerpo levantar
--     excepción?». Mismo patrón que los smoke tests de la migración de 2026-06-02.
--  G. POST-VUELO: se comprueba la FK `profiles_invitado_por_fkey`. El
--     `ADD COLUMN IF NOT EXISTS … REFERENCES` se salta la FK entera si la
--     columna ya existe, y el pre-vuelo sólo validaba el tipo: una columna
--     `invitado_por uuid` creada a mano pasaba el pre-vuelo y se quedaba sin
--     FK, con el post-vuelo dándolo por bueno (comprobado).
--  H. El veredicto final SIGUE SIENDO UN SOLO `SELECT`, pero ya no se
--     pretende que sirva de veredicto: con `db push` no se imprime. La
--     consulta que respalda el §7 está en la cabecera y se corre aparte.
--  I. `huerfanos_previos` excluye `deleted_at IS NOT NULL`. Los borrados
--     lógicos de GoTrue no tienen perfil por diseño y engordaban el número
--     hasta hacerlo ilegible. (Los anónimos no hacen falta filtrarlos:
--     `enable_anonymous_sign_ins = false`, `supabase/config.toml:177`.)
--  J. Dos citas del borrador eran falsas y se corrigen en su sitio:
--     · «esa ruta NO comprueba el error de su UPSERT
--       (`api/admin/crear-usuario/route.ts:87`)» — la :87 es justamente el
--       ÚNICO error que esa ruta SÍ comprueba (`authError` de `createUser`).
--       El UPSERT sin comprobar es el de :94-106.
--     · «`CREATE TRIGGER` no tiene `OR REPLACE` en Postgres 15» — sí lo tiene
--       desde Postgres 14 (comprobado en 17.6: `CREATE OR REPLACE TRIGGER`
--       sobre `auth.users` funciona). Se sigue usando DROP + CREATE, pero por
--       ser explícito, no porque no exista la alternativa.
--
-- Dependencias: `public.profiles` con `id` y `role`; `auth.users`.
-- Bloqueos: `ALTER TABLE … ADD COLUMN` de una columna NULL sin default no
-- reescribe filas, y añadir la FK en el MISMO `ADD COLUMN` no dispara escaneo
-- de validación porque la columna nace toda NULL (comprobado: 200 000 filas,
-- 0.4 ms, `convalidated = true`). Toma ACCESS EXCLUSIVE sobre `profiles` un
-- instante; la FK es auto-referencial, así que no bloquea ninguna otra tabla.
-- `CREATE TRIGGER` toma ACCESS EXCLUSIVE sobre `auth.users` hasta el COMMIT, y
-- eso frena los inicios de sesión además de las altas: GoTrue escribe
-- `last_sign_in_at` en esa tabla. Hora valle.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ---------- PRE-FLIGHT ----------
DO $$
DECLARE
  v_tipo      text;
  v_faltan    text;
  v_trg       text;
  v_pol       text;
  v_owner     name;
  v_force     boolean;
  v_huerfanos int;
BEGIN
  IF to_regclass('public.profiles') IS NULL OR to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: falta public.profiles o auth.users. Abortando.';
  END IF;

  -- Las dos columnas que el trigger escribe. Si `role` no existiera, el INSERT
  -- del trigger fallaría DENTRO de la transacción de GoTrue y rompería el alta.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='profiles'
       AND column_name IN ('id','role')
     GROUP BY table_name HAVING count(*) = 2
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: profiles no tiene id y role. Abortando.';
  END IF;

  -- ⚠️ CAMBIO E — LAS COLUMNAS QUE EL TRIGGER *NO* ESCRIBE SON EL RIESGO REAL.
  -- Una columna NOT NULL sin DEFAULT añadida en el futuro rompe TODAS las
  -- altas, y comprobar `id` y `role` no lo ve. Hoy no hay ninguna; esto existe
  -- para el replay y para la próxima vez que alguien añada una columna.
  SELECT string_agg(a.attname, ', ' ORDER BY a.attnum) INTO v_faltan
    FROM pg_attribute a
   WHERE a.attrelid = 'public.profiles'::regclass
     AND a.attnum > 0 AND NOT a.attisdropped
     AND a.attnotnull AND NOT a.atthasdef
     AND a.attidentity = '' AND a.attgenerated = ''
     AND a.attname NOT IN ('id','role');
  IF v_faltan IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: profiles tiene columnas NOT NULL sin DEFAULT que el trigger no escribe (%). Su INSERT levantaria excepcion dentro de la transaccion de GoTrue y ninguna alta funcionaria. Abortando.', v_faltan;
  END IF;

  -- Cualquier otro trigger de INSERT sobre `profiles` corre también dentro de
  -- la transacción de GoTrue y puede abortar el alta. Que se mire antes.
  SELECT string_agg(t.tgname, ', ') INTO v_trg
    FROM pg_trigger t
   WHERE t.tgrelid = 'public.profiles'::regclass
     AND NOT t.tgisinternal
     AND (t.tgtype & 4) = 4;
  IF v_trg IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: profiles ya tiene trigger(s) de INSERT (%) que correrian dentro de la transaccion de GoTrue. Revisar que no puedan abortar antes de seguir. Abortando.', v_trg;
  END IF;

  -- Si `invitado_por` ya existe, tiene que ser uuid. Un tipo distinto significa
  -- que alguien la creó para otra cosa: parar antes de escribir encima.
  SELECT data_type INTO v_tipo
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='profiles' AND column_name='invitado_por';
  IF v_tipo IS NOT NULL AND v_tipo <> 'uuid' THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: profiles.invitado_por ya existe con tipo % (esperado uuid). Abortando.', v_tipo;
  END IF;

  -- ⚠️ EL INVARIANTE DEL QUE DEPENDE NO NECESITAR UN `BEFORE INSERT` GEMELO.
  -- `20260602_sec_proteger_columnas_sensibles_profiles.sql:45-49` dice que su
  -- protección es BEFORE UPDATE porque no hay camino de INSERT para
  -- `authenticated`, y que si se abre uno hay que replicarla. Ese camino es una
  -- POLICY de INSERT, no este trigger —este escribe como `postgres`, no como
  -- `authenticated`—, pero si alguien añadió la policy, la deuda de 2026-06-02
  -- está vencida y esta migración no la paga: aborta en vez de instalar media
  -- protección.
  -- CAMBIO B: `FOR ALL` es `polcmd = '*'` y también abre INSERT.
  SELECT string_agg(polname || ' (' || polcmd::text || ')', ', ') INTO v_pol
    FROM pg_policy
   WHERE polrelid = 'public.profiles'::regclass AND polcmd IN ('a','*');
  IF v_pol IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: profiles tiene policy que abre INSERT (%) y no existia al escribir esto. Hay que replicar proteger_columnas_sensibles_profiles en un BEFORE INSERT antes de seguir. Abortando.', v_pol;
  END IF;

  -- ⚠️ CAMBIO C — PROPIEDAD Y RLS, ANTES DE CREAR NADA (dimensiones 4 y 11).
  -- La función será SECURITY DEFINER propiedad de `current_user`. Para que su
  -- INSERT en `profiles` pase, ese rol tiene que ser dueño de la tabla (y la
  -- tabla no estar en FORCE RLS) o tener BYPASSRLS. Si no, la función queda
  -- instalada y CADA alta responde «Database error saving new user».
  SELECT pg_get_userbyid(c.relowner), c.relforcerowsecurity
    INTO v_owner, v_force
    FROM pg_class c WHERE c.oid = 'public.profiles'::regclass;
  IF NOT (
       (current_user = v_owner AND NOT v_force)
       OR COALESCE((SELECT r.rolbypassrls FROM pg_roles r WHERE r.rolname = current_user), false)
     ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: el rol que aplica (%) no es dueno de public.profiles (dueno: %, force_rls: %) ni tiene BYPASSRLS. La funcion SECURITY DEFINER no podria escribir en profiles y romperia todas las altas. Aplicar como postgres. Abortando.', current_user, v_owner, v_force;
  END IF;

  -- ⚠️ CAMBIO D — `on_auth_user_created` ES EL NOMBRE CANÓNICO DE LA
  -- DOCUMENTACIÓN DE SUPABASE. Si ya hay uno y NO es el nuestro, el
  -- `DROP TRIGGER IF EXISTS` de abajo se lo llevaría en silencio.
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
     WHERE t.tgrelid = 'auth.users'::regclass
       AND t.tgname  = 'on_auth_user_created'
       AND NOT t.tgisinternal
       AND COALESCE(t.tgfoid <> to_regprocedure('public.handle_new_user()'), true)
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: ya existe un trigger on_auth_user_created sobre auth.users que NO ejecuta public.handle_new_user(). Este archivo lo reemplazaria en silencio. Mirar de quien es (pg_trigger.tgfoid) y decidir a mano. Abortando.';
  END IF;

  -- Privilegio de TRIGGER sobre una tabla que NO es nuestra (dimensión 11).
  IF NOT has_table_privilege(current_user, 'auth.users', 'TRIGGER') THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: % no tiene privilegio TRIGGER sobre auth.users (dueno: supabase_auth_admin). Abortando.', current_user;
  END IF;

  -- Censo informativo de huérfanos previos. No aborta —no es un fallo de esta
  -- migración—, pero viaja en el mensaje de la comprobación que sí puede
  -- abortar, que es el único canal que se lee con `db push`.
  SELECT count(*) INTO v_huerfanos
    FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
   WHERE p.id IS NULL AND u.deleted_at IS NULL;
  IF v_huerfanos < 0 THEN
    RAISE EXCEPTION 'imposible';   -- la rama existe para que el censo no se optimice
  END IF;
  RAISE NOTICE 'PRE-FLIGHT OK. Huerfanos previos (NO se rellenan aqui): %', v_huerfanos;
END $$;

-- ---------- 1 · La columna ----------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS invitado_por uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.invitado_por IS
  'Quien dio de alta a este usuario. NULL = se registro por su cuenta (dueno). '
  'Lo escribe api/admin/crear-usuario. ON DELETE SET NULL: si se borra a quien '
  'invito, el invitado no se borra ni queda apuntando a nada. '
  'B5.6 la crea y NADIE la escribe todavia: hasta que el gate la lea, un NULL '
  'significa "se registro solo" O "lo creo el trigger de auth.users", que no '
  'es lo mismo.';

-- ---------- 2 · La función ----------
-- ⚠️ ESCRIBE SOLO LITERALES Y `NEW.id`, Y AHÍ ESTÁ SU SEGURIDAD. Este trigger
-- corre DENTRO de la transacción de GoTrue: cualquier excepción aquí hace
-- rollback del alta entera y el usuario recibe «Database error saving new
-- user», sin cuenta y sin diagnóstico. Por eso no lee `NEW.raw_user_meta_data`
-- ni ningún otro campo del INSERT, no consulta otras tablas y no bifurca.
--
-- ⚠️⚠️ SI ALGÚN DÍA ESTE CUERPO LEE ALGO DEL INSERT DE `auth.users` PARA
-- DECIDIR `role`, `clinica_id` O `es_admin_de_clinica` —un `role` que venga en
-- los metadatos, por ejemplo—, EL ATACANTE PASA A CONTROLAR LO QUE SE ESCRIBE,
-- y entonces sí hace falta replicar `proteger_columnas_sensibles_profiles` en
-- un BEFORE INSERT. Ojo con el detalle que hace la trampa: ese trigger se
-- EXIME cuando `auth.uid()` es NULL, y en la transacción de GoTrue `auth.uid()`
-- ES NULL, así que un BEFORE INSERT calcado no frenaría a este trigger. Lo que
-- hoy cierra el camino de `authenticated` es que `profiles` NO TIENE POLICY DE
-- INSERT —el pre-vuelo aborta si aparece una—, no la forma de este cuerpo.
-- Son dos cosas distintas y el borrador las daba por una.
--
-- SECURITY DEFINER porque `supabase_auth_admin`, que es quien inserta en
-- `auth.users`, no pasa la RLS de `profiles` — y `profiles` NO tiene policy de
-- INSERT a propósito. La función es propiedad de `postgres`, que tiene
-- BYPASSRLS y además es dueño de la tabla, y por eso puede (comprobado; el
-- pre-vuelo lo exige y el post-vuelo lo confirma).
-- `SET search_path = ''` obliga a calificar todo: sin eso, un esquema temporal
-- podría secuestrar el nombre `profiles`. Mismo patrón que
-- `proteger_columnas_sensibles_profiles`.
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $function$
BEGIN
  -- ON CONFLICT DO NOTHING: idempotencia por cuenta propia. Los dos escritores
  -- de la aplicación usan UPSERT y no colisionan —se encuentran la fila y la
  -- actualizan—, pero este trigger no debe depender de que sigan haciéndolo.
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'medico')
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Bloque B5.6. Crea el profiles minimo de toda fila nueva de auth.users. '
  'Solo literales y NEW.id: corre dentro de la transaccion de GoTrue y '
  'cualquier excepcion aqui aborta el alta con "Database error saving new user". '
  'NO crea clinica y NO escribe es_admin_de_clinica. Ese false NO es neutro: '
  'con clinica_id NULL, gate.ts calcula requiereSoporte=true y el onboarding '
  'ensena el panel de soporte, no el formulario de clinica. Se acepta porque '
  'escribir true haria dueno de una clinica ajena a todo invitado (el UPSERT '
  'de api/admin/crear-usuario no toca esa columna). Lo resuelve el gate '
  'leyendo invitado_por. Mientras eso no este: no encender Google OAuth.';

-- `postgres` y `service_role` ya pueden por ser propietario/BYPASSRLS; el
-- GRANT explícito es para `supabase_auth_admin`, que es el rol que dispara el
-- trigger. Se escribe en vez de confiar en el EXECUTE por defecto de PUBLIC,
-- que alguien podría revocar en una ronda de hardening sin ver que esto lo
-- necesitaba. Ese EXECUTE de PUBLIC no es una puerta: la función devuelve
-- `trigger`, y Postgres rechaza llamarla fuera de un trigger, así que
-- PostgREST no la puede invocar por /rest/v1/rpc.
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

-- ---------- 3 · El trigger ----------
-- AFTER INSERT: la fila de `auth.users` ya existe, así que la FK
-- `profiles_id_fkey` se satisface dentro de la misma transacción.
-- DROP + CREATE por ser explícito. (`CREATE OR REPLACE TRIGGER` existe desde
-- Postgres 14 y funciona aquí — comprobado en 17.6—; el borrador decía que no
-- existía en 15 y eso era falso.) El pre-vuelo ya abortó si el trigger que hay
-- con ese nombre es de otro, así que este DROP sólo puede llevarse el nuestro.
--
-- ⚠️ ESTADO TRANSITORIO NUEVO QUE ESTA MIGRACIÓN INTRODUCE — LA VENTANA DEL
-- ROL. `api/admin/crear-usuario` crea el usuario y DESPUÉS hace el UPSERT del
-- perfil con el rol real. Con este trigger puesto, entre esas dos sentencias
-- una secretaria existirá unos milisegundos con `role='medico'`, que es el
-- literal que escribe el trigger.
--   POR QUÉ HOY NO IMPORTA: las dos sentencias viven en el mismo request, sin
--   nada entre medias que lea el perfil, y el UPSERT lo corrige antes de que la
--   ruta responda. Nadie puede observar esa fila intermedia: quien acaba de ser
--   dado de alta todavía no tiene sesión.
--   POR QUÉ MAÑANA PODRÍA IMPORTAR: deja de ser cierto en cuanto algo se meta
--   entre las dos —un `await` nuevo, un envío de correo, un reintento— o en
--   cuanto el alta deje de ser un solo request. Y sobre todo, si el UPSERT
--   falla, la secretaria se queda PERMANENTEMENTE como `medico` Y SIN CLÍNICA;
--   esa ruta NO comprueba el error de su UPSERT
--   (`api/admin/crear-usuario/route.ts:94-106` — la :87 comprueba el error de
--   `createUser`, que es otro), a diferencia de `api/auth/registro`, que sí lo
--   comprueba y revierte el usuario (`registro/route.ts:86-89`).
--   BASTA CON DOCUMENTARLO SÓLO PORQUE EL FALLO ES VISIBLE Y REVERSIBLE: una
--   secretaria con `role='medico'` y `clinica_id` NULL no ve datos de nadie
--   —la RLS filtra por una clínica que no tiene— y el admin la vuelve a dar de
--   alta. Lo que NO es aceptable dejar sin arreglar es el error sin comprobar:
--   va en el bloque siguiente, que es el que toca `src/`.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- POST-FLIGHT ----------
DO $$
DECLARE
  v_secdef boolean;
  v_path   text[];
  v_owner  name;
  v_towner name;
  v_force  boolean;
  v_role   text;
  v_smoke  uuid := '00000000-0000-0000-0000-0000000b56aa';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='profiles' AND column_name='invitado_por'
  ) THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: no se creo profiles.invitado_por. Revirtiendo.';
  END IF;

  -- CAMBIO G: `ADD COLUMN IF NOT EXISTS … REFERENCES` se salta la FK entera si
  -- la columna ya existía, y eso pasaba el pre-vuelo sin que nada lo notara.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.profiles'::regclass
       AND contype  = 'f'
       AND conkey   = ARRAY[(SELECT attnum FROM pg_attribute
                              WHERE attrelid='public.profiles'::regclass
                                AND attname='invitado_por')]
  ) THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: profiles.invitado_por existe pero SIN foreign key. Pasa cuando la columna ya estaba creada a mano: ADD COLUMN IF NOT EXISTS se salta tambien el REFERENCES. Anadirla a mano y volver. Revirtiendo.';
  END IF;

  SELECT p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner)
    INTO v_secdef, v_path, v_owner
    FROM pg_proc p WHERE p.oid = to_regprocedure('public.handle_new_user()');
  IF v_secdef IS NULL THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: no existe handle_new_user(). Revirtiendo.';
  END IF;
  IF NOT v_secdef THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: handle_new_user() no quedo SECURITY DEFINER; sin eso no puede escribir en profiles. Revirtiendo.';
  END IF;

  -- ⚠️ CAMBIO A — EL VALOR EXACTO QUE GUARDA EL CATÁLOGO, NO EL QUE PARECE.
  -- `SET search_path = ''` deja en `pg_proc.proconfig` el elemento
  -- `search_path=""` —con las dos comillas DENTRO del valor—, no
  -- `search_path=`. Comprobado en PostgreSQL 17.6 y contra la función hermana
  -- `proteger_columnas_sensibles_profiles`, que tiene `{"search_path=\"\""}`.
  -- El borrador comparaba con `'search_path='` y por eso abortaba SIEMPRE.
  IF v_path IS NULL OR NOT ('search_path=""' = ANY(v_path)) THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: handle_new_user() no quedo con search_path vacio (proconfig = %). Revirtiendo.', COALESCE(v_path::text,'NULL');
  END IF;

  -- CAMBIO C (segunda mitad): el dueño real de la función.
  SELECT pg_get_userbyid(c.relowner), c.relforcerowsecurity
    INTO v_towner, v_force
    FROM pg_class c WHERE c.oid = 'public.profiles'::regclass;
  IF NOT (
       (v_owner = v_towner AND NOT v_force)
       OR COALESCE((SELECT r.rolbypassrls FROM pg_roles r WHERE r.rolname = v_owner), false)
     ) THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: handle_new_user() quedo propiedad de %, que no es dueno de public.profiles (%) ni tiene BYPASSRLS. Su INSERT chocaria con la RLS y CADA alta fallaria. Revirtiendo.', v_owner, v_towner;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid = 'auth.users'::regclass
       AND tgname  = 'on_auth_user_created'
       AND tgfoid  = to_regprocedure('public.handle_new_user()')
       AND NOT tgisinternal
       AND (tgtype & 1) = 1    -- FOR EACH ROW
       AND (tgtype & 4) = 4    -- INSERT
       AND (tgtype & 2) = 0    -- AFTER (no BEFORE)
       AND tgenabled <> 'D'    -- y habilitado
  ) THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: on_auth_user_created no quedo como AFTER INSERT FOR EACH ROW habilitado sobre auth.users ejecutando handle_new_user(). Revirtiendo.';
  END IF;

  -- ═══ CAMBIO F · SMOKE TEST REAL, EN SUBTRANSACCIÓN QUE SE DESHACE ═══════
  -- La pregunta «¿puede este cuerpo levantar excepción dentro de la
  -- transacción de GoTrue?» no se contesta leyendo el cuerpo: se contesta
  -- metiendo una fila en `auth.users` y mirando. Se inserta, se comprueba, y
  -- se revierte con un RAISE que el handler se traga.
  -- Si lo que falla es la FORMA de la fila de prueba y no el trigger —una
  -- columna nueva de GoTrue, por ejemplo—, el mensaje lo dice con su SQLSTATE
  -- para que no se confunda con un defecto del trigger. Aborta igual: es más
  -- seguro no aplicar que instalar un trigger sin probar.
  BEGIN
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
                            created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    VALUES ('00000000-0000-0000-0000-000000000000', v_smoke,
            'authenticated', 'authenticated',
            'b56-smoke-' || v_smoke::text || '@invalid.spinus', 'x',
            now(), now(), '{}'::jsonb,
            -- metadatos hostiles A PROPÓSITO: el trigger debe ignorarlos
            '{"role":"super_admin","es_admin_de_clinica":true,"clinica_id":"00000000-0000-0000-0000-000000000001"}'::jsonb);

    SELECT p.role INTO v_role FROM public.profiles p WHERE p.id = v_smoke;
    IF v_role IS NULL THEN
      RAISE EXCEPTION 'SMOKE FALLO: el alta no creo ninguna fila en profiles.';
    END IF;
    IF v_role <> 'medico' THEN
      RAISE EXCEPTION 'SMOKE FALLO: el trigger dejo role=% (esperado medico).', v_role;
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles
                WHERE id = v_smoke
                  AND (clinica_id IS NOT NULL OR es_admin_de_clinica IS TRUE
                       OR invitado_por IS NOT NULL)) THEN
      RAISE EXCEPTION 'SMOKE FALLO: el trigger escribio clinica_id, es_admin_de_clinica o invitado_por desde los metadatos.';
    END IF;
    -- todo bien: deshacer el alta de prueba
    RAISE EXCEPTION 'B56_SMOKE_OK';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'B56_SMOKE_OK' THEN
        RAISE NOTICE 'POST-FLIGHT: smoke test OK (alta de prueba revertida).';
      ELSIF SQLERRM LIKE 'SMOKE FALLO%' THEN
        RAISE EXCEPTION 'POST-FLIGHT FALLO: %. Revirtiendo.', SQLERRM;
      ELSE
        RAISE EXCEPTION 'POST-FLIGHT FALLO: el alta de prueba en auth.users no se pudo completar (SQLSTATE %, %). Puede ser la FORMA de la fila de prueba (columna nueva de GoTrue) y no el trigger: comprobarlo a mano antes de reintentar. Revirtiendo.', SQLSTATE, SQLERRM;
      END IF;
  END;
END $$;

COMMIT;

-- ---------- CENSO FINAL (NO es el veredicto) ----------
-- UN SOLO SELECT, y va DESPUÉS del COMMIT — pero que quede claro que con
-- `npx supabase db push` ESTO NO SE IMPRIME EN NINGUNA PARTE: el CLI no
-- muestra conjuntos de resultados. El veredicto que respalda el §7 es la
-- consulta de la CABECERA, y se corre aparte. Esto se queda por si el archivo
-- se pega alguna vez en el SQL Editor, donde postgres-meta devuelve a la
-- rejilla sólo el último statement con filas (`dist/lib/db.js`).
-- `huerfanos_previos` NO es un fallo de esta migración: son las cuentas que ya
-- estaban sin perfil ANTES de aplicarla. El trigger cubre las nuevas, NO
-- rellena las viejas — ver la nota de la cabecera.
SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles'
      AND column_name='invitado_por')                          AS columna_invitado_por,
  (to_regprocedure('public.handle_new_user()') IS NOT NULL)    AS funcion,
  (SELECT count(*) FROM pg_trigger
    WHERE tgrelid='auth.users'::regclass
      AND tgname='on_auth_user_created' AND NOT tgisinternal)  AS trigger_puesto,
  (SELECT count(*) FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
   WHERE p.id IS NULL AND u.deleted_at IS NULL)                AS huerfanos_previos;
-- Esperado: 1 · true · 1 · (el número que haya, sin cambiar)

-- ═══════════════════════════════════════════════════════════════════════
-- ROLLBACK (no ejecutar salvo que haya que revertir)
--
-- El trigger se quita entero; la columna se deja por defecto — es NULL y no
-- estorba, y si alguna fila ya tiene valor, borrarla pierde el dato. Quitarla
-- va aparte y a conciencia.
-- ═══════════════════════════════════════════════════════════════════════
-- BEGIN;
--   DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
--   DROP FUNCTION IF EXISTS public.handle_new_user();
--   -- ALTER TABLE public.profiles DROP COLUMN IF EXISTS invitado_por;
-- COMMIT;
