-- ═══════════════════════════════════════════════════════════════════════
-- Bloque B5.6 — el trigger de aprovisionamiento que faltó
-- Rama: feature/auth-b5-trigger · Escrita: 2026-09-14
-- ───────────────────────────────────────────────────────────────────────
-- ⚠️⚠️ PENDIENTE DE AUDITORÍA — NO APLICAR TODAVÍA.
-- Este archivo NO ha pasado por `supabase/AUDITORIA-MIGRACIONES.md`. Que esté
-- escrito y comentado no es que esté revisado: el protocolo existe porque el
-- autor no es quien encuentra lo que se le escapó.
-- ESTADO · LOCAL: PENDIENTE DE APLICAR (al 2026-09-14)
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (al 2026-09-14)
-- (al aplicar, actualizar los dos rótulos con la fecha real y la comprobación
--  concreta que los respalde — §7 del protocolo)
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
--     clínicos. Con esta decisión, el peor caso degrada a «el médico ve una
--     pantalla de onboarding que no esperaba»: molesto, visible y reversible.
--
-- 2 · EL TRIGGER NO ESCRIBE `es_admin_de_clinica`. Esa columna significa
--     «dueño de la clínica X» y sólo afirma algo cuando `clinica_id` NO es
--     NULL. El estado (flag=true, clinica_id=NULL) no debería existir: es
--     exactamente el que dejó pasar guardas de administración que comprobaban
--     el flag sin mirar la clínica (cerrado el 2026-09-14 en cinco archivos;
--     ver el comentario de `canManageClinica` en `src/lib/permissions.ts`).
--     El DEFAULT de la columna es `false` y con eso basta: el único escritor
--     de `true` pasa a ser `POST /api/me/clinica`, que lo escribe JUNTO a
--     `clinica_id` en la misma sentencia — la única forma en que la columna
--     significa algo.
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
-- ⚠️ ORDEN DE DESPLIEGUE: ESTA MIGRACIÓN PUEDE IR PRIMERO, y es la diferencia
-- con la de B5. Aquí no hay ninguna capa de la aplicación que dependa de esto
-- para funcionar: el trigger sólo AÑADE filas que antes faltaban, y los dos
-- escritores existentes hacen UPSERT, así que se encuentran la fila hecha y la
-- actualizan igual que antes. Nada de `src/` cambia en este bloque.
--
-- ⚠️ NO RELLENA LOS HUÉRFANOS QUE YA EXISTEN, y es deliberado. Las cuentas de
-- `auth.users` que hoy no tienen perfil SEGUIRÁN sin tenerlo después de
-- aplicar esto. El veredicto final las cuenta para que el número esté a la
-- vista, pero regularizarlas es otra decisión: escribirles `role='medico'` a
-- ciegas es afirmar algo que nadie ha comprobado sobre esas cuentas. Se
-- auditan y se deciden aparte.
--
-- Dependencias: `public.profiles` con `id` y `role`; `auth.users`.
-- Bloqueos: `ALTER TABLE … ADD COLUMN` de una columna NULL sin default no
-- reescribe filas (Postgres ≥ 11), pero toma ACCESS EXCLUSIVE sobre `profiles`
-- un instante. `CREATE TRIGGER` toma el suyo sobre `auth.users`. Hora valle.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ---------- PRE-FLIGHT ----------
DO $$
DECLARE
  v_tipo text;
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
  -- `authenticated`, y que si se abre uno hay que replicarla. Si alguien añadió
  -- una policy de INSERT, ese camino existe y esta migración deja de ser
  -- suficiente: aborta en vez de instalar media protección.
  IF EXISTS (
    SELECT 1 FROM pg_policy
     WHERE polrelid = 'public.profiles'::regclass AND polcmd = 'a'
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: profiles tiene una policy de INSERT que no existia al escribir esto. Hay que replicar proteger_columnas_sensibles_profiles en un BEFORE INSERT antes de seguir. Abortando.';
  END IF;
END $$;

-- ---------- 1 · La columna ----------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS invitado_por uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.invitado_por IS
  'Quien dio de alta a este usuario. NULL = se registro por su cuenta (dueno). '
  'Lo escribe api/admin/crear-usuario. ON DELETE SET NULL: si se borra a quien '
  'invito, el invitado no se borra ni queda apuntando a nada.';

-- ---------- 2 · La función ----------
-- ⚠️ ESCRIBE SOLO LITERALES Y `NEW.id`, Y AHÍ ESTÁ SU SEGURIDAD. Este trigger
-- corre DENTRO de la transacción de GoTrue: cualquier excepción aquí hace
-- rollback del alta entera y el usuario recibe «Database error saving new
-- user», sin cuenta y sin diagnóstico. Por eso no lee `NEW.raw_user_meta_data`
-- ni ningún otro campo del INSERT, no consulta otras tablas y no bifurca.
--
-- ⚠️⚠️ Y ÉSA ES TAMBIÉN LA INVARIANTE QUE HACE INNECESARIO EL `BEFORE INSERT`
-- GEMELO de `proteger_columnas_sensibles_profiles`. Aquel protege `role`,
-- `clinica_id` y `es_admin_de_clinica` de escrituras arbitrarias; este trigger
-- es el camino de INSERT que aquella migración anticipaba, y es seguro
-- MIENTRAS SE CUMPLA ESTA CONDICIÓN: que escriba `role` con un literal fijo y
-- no escriba las otras dos. Si algún día este cuerpo lee algo del INSERT de
-- `auth.users` para decidir cualquiera de esas tres columnas —un `role` que
-- venga en los metadatos, por ejemplo—, el atacante pasa a controlar lo que se
-- escribe y HACE FALTA el `BEFORE INSERT`. No lo cambies sin escribirlo.
--
-- SECURITY DEFINER porque `supabase_auth_admin`, que es quien inserta en
-- `auth.users`, no pasa la RLS de `profiles` — y `profiles` NO tiene policy de
-- INSERT a propósito. La función es propiedad de `postgres` y por eso puede.
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
  'NO crea clinica y NO escribe es_admin_de_clinica: la clinica la crea el '
  'medico en el onboarding via POST /api/me/clinica, que es el unico escritor '
  'de es_admin_de_clinica=true y la escribe junto a clinica_id. '
  'Solo literales y NEW.id: corre dentro de la transaccion de GoTrue.';

-- `postgres` y `service_role` ya pueden por ser superusuario/propietario; el
-- GRANT explícito es para `supabase_auth_admin`, que es el rol que dispara el
-- trigger. Se escribe en vez de confiar en el EXECUTE por defecto de PUBLIC,
-- que alguien podría revocar en una ronda de hardening sin ver que esto lo
-- necesitaba.
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

-- ---------- 3 · El trigger ----------
-- AFTER INSERT: la fila de `auth.users` ya existe, así que la FK
-- `profiles_id_fkey` se satisface dentro de la misma transacción.
-- DROP + CREATE porque `CREATE TRIGGER` no tiene `OR REPLACE` en Postgres 15.
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
--   falla, la secretaria se queda PERMANENTEMENTE como `medico`; hoy esa ruta
--   NO comprueba el error de su UPSERT (`api/admin/crear-usuario/route.ts:87`),
--   a diferencia de `api/auth/registro`, que sí lo comprueba y revierte.
--   El arreglo de fondo es que el rol viaje en el alta o que esa ruta compruebe
--   su escritura; no se hace aquí porque este bloque no toca `src/`.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- POST-FLIGHT ----------
DO $$
DECLARE
  v_secdef boolean;
  v_path   text[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='profiles' AND column_name='invitado_por'
  ) THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: no se creo profiles.invitado_por. Revirtiendo.';
  END IF;

  SELECT p.prosecdef, p.proconfig INTO v_secdef, v_path
    FROM pg_proc p WHERE p.oid = to_regprocedure('public.handle_new_user()');
  IF v_secdef IS NULL THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: no existe handle_new_user(). Revirtiendo.';
  END IF;
  IF NOT v_secdef THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: handle_new_user() no quedo SECURITY DEFINER; sin eso no puede escribir en profiles. Revirtiendo.';
  END IF;
  IF v_path IS NULL OR NOT ('search_path=' = ANY(v_path)) THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: handle_new_user() no quedo con search_path vacio. Revirtiendo.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid = 'auth.users'::regclass
       AND tgname  = 'on_auth_user_created'
       AND NOT tgisinternal
       AND (tgtype & 1) = 1    -- FOR EACH ROW
       AND (tgtype & 4) = 4    -- INSERT
       AND (tgtype & 2) = 0    -- AFTER (no BEFORE)
  ) THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: on_auth_user_created no quedo como AFTER INSERT FOR EACH ROW sobre auth.users. Revirtiendo.';
  END IF;
END $$;

COMMIT;

-- ---------- VEREDICTO ----------
-- UN SOLO SELECT, y va DESPUÉS del COMMIT. El SQL Editor de Supabase devuelve
-- a la rejilla únicamente el último statement que traiga filas
-- (postgres-meta, `dist/lib/db.js`), así que dos SELECT al final esconderían
-- el primero. El `huerfanos_previos` no es un fallo de esta migración: son las
-- cuentas que ya estaban sin perfil ANTES de aplicarla. El trigger cubre las
-- nuevas, NO rellena las viejas — ver la nota de la cabecera.
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
   WHERE p.id IS NULL)                                         AS huerfanos_previos;
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
