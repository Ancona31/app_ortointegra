-- ═══════════════════════════════════════════════════════════════════════
-- Bloque B5 · segunda parte — el gate de perfil en la capa de datos
-- Rama: feature/auth-a · Escrita: 2026-09-13 · NO APLICADA A NINGUNA BASE
-- Revisión de auditoría: 2026-09-13 (ver «CAMBIOS DE LA AUDITORÍA» abajo)
-- ═══════════════════════════════════════════════════════════════════════
-- Propósito: llevar a la base el criterio único de «perfil completo» que ya
-- vive en `src/lib/perfil/gate.ts` (función `evaluarPerfil`), y exigirlo en
-- TODOS los sitios por los que se escribe de verdad:
--   1. las SEIS policies restrictivas de INSERT que ya existen,
--   2. el PASO 3 del RPC `crear_paciente_con_medico_v2`, y
--   3. la puerta trasera del RPC v1 `crear_paciente_con_medico(jsonb,uuid)`,
--      que sigue viva y con EXECUTE para `authenticated` (ver §4).
--
-- POR QUÉ EN LA BASE Y NO SOLO EN LA PANTALLA: el layout de `(app)` no se
-- re-ejecuta al navegar —Partial Rendering, documentado en
-- node_modules/next/dist/docs/01-app/02-guides/authentication.md:1350— y nueve
-- formularios escriben DIRECTO a Supabase desde el navegador, sin pasar por
-- ninguna ruta del servidor. La RLS es la única capa que un usuario con sesión
-- no puede rodear.
--
-- ═══ CAMBIOS DE LA AUDITORÍA sobre el borrador original ═══════════════════
--  A. §4 NUEVA — se retira EXECUTE a `anon`/`authenticated` sobre el RPC v1
--     `crear_paciente_con_medico(jsonb,uuid)`. Ese RPC es SECURITY DEFINER
--     propiedad de `postgres` (BYPASSRLS), inserta en `public.pacientes` sin
--     el gate de perfil, y está publicado en PostgREST. Sin este paso, el
--     gate que esta migración instala se rodea con un `curl` a
--     /rest/v1/rpc/crear_paciente_con_medico. `ETAPA5_PLAN.md:1338` lo da por
--     eliminado; el dump de producción `20260912190416_remote_schema.sql:953`
--     y su GRANT de `:3389` demuestran que no lo está. Ningún código de
--     `src/` lo llama (único llamador vivo: v2, en api/pacientes/route.ts:136).
--     `postgres` y `service_role` conservan EXECUTE, así que ninguna vía de
--     servidor se toca. Es reversible con un GRANT (ver ROLLBACK).
--  B. El censo de médicos que quedarían bloqueados PASA AL PRE-VUELO Y ABORTA.
--     En el borrador vivía en el último `SELECT` del archivo: avisaba DESPUÉS
--     del cambio, que es justo lo que la dimensión 4 del protocolo prohíbe.
--  C. El veredicto viaja en UN SOLO `SELECT` final. El SQL Editor de Supabase
--     (postgres-meta, `dist/lib/db.js`: `res.reverse().find(x =>
--     x.rows.length !== 0)`) devuelve a la rejilla UN ÚNICO conjunto de
--     resultados: el del último statement que traiga filas. Con tres SELECT
--     al final, los dos primeros —los que llevaban el veredicto— no se veían.
--  D. Los `LIKE` del post-vuelo se anclan a `polrelid`: contaban por nombre de
--     policy sin mirar de qué tabla era.
--
-- ⚠️⚠️ ORDEN DE DESPLIEGUE EN PRODUCCIÓN — ESTA MIGRACIÓN VA LA ÚLTIMA.
-- Se aplica DESPUÉS de que estén desplegados el gate visible y el layout que
-- lo consume, NUNCA antes. Mientras ninguna capa consuma `gate.ts`, un médico
-- con el perfil a medias no ve una pantalla que se lo explique: ve el error
-- crudo de PostgREST (42501, «new row violates row-level security policy») al
-- intentar guardar una consulta o emitir un documento, y en el alta de
-- paciente el mensaje del RPC sin ninguna pantalla que lo acompañe. Invertir
-- el orden convierte un gate en una avería.
--
-- ⚠️ A DÍA DE HOY ESA CONDICIÓN NO SE CUMPLE. El único consumidor de
-- `src/lib/perfil/gate.ts` en todo el repo es `src/lib/tests/gate.test.ts`
-- (comprobado con grep sobre `src/`); el propio `gate.ts:19` lo dice. Aplicar
-- esto ANTES de que exista la pantalla entrega errores crudos a los médicos.
-- En local da igual: ahí se aplica cuando convenga.
--
-- Dependencias: helpers `clinica_no_suspendida()`, `clinica_tiene_acceso()` y
-- `clinica_dentro_de_limite()`; las siete policies `*_gates_insert`; y el RPC
-- `crear_paciente_con_medico_v2(jsonb, uuid, boolean)`.
--
-- Bloqueos: `ALTER POLICY` toma ACCESS EXCLUSIVE sobre cada tabla. Es trabajo
-- instantáneo (no reescribe filas), pero los seis locks se retienen hasta el
-- COMMIT y esperan a las transacciones abiertas sobre esas tablas. Aplicar en
-- hora valle.
--
-- Se aplica pegando el archivo COMPLETO en el SQL Editor de Supabase. El
-- `BEGIN`/`COMMIT` explícito es correcto ahí: postgres-meta manda el archivo
-- como una única simple query multi-sentencia y honra el control de
-- transacción explícito (comprobado: `BEGIN; …; COMMIT; SELECT …;` no emite
-- WARNING y deja el SELECT final fuera de la transacción de la migración).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ---------- PRE-FLIGHT ----------
DO $$
DECLARE
  -- ⚠️⚠️ EL INTERRUPTOR DE ESTA MIGRACIÓN. LÉELO ANTES DE TOCARLO.
  -- Con `false`, la migración ABORTA si algún médico de la base quedaría
  -- bloqueado por el criterio nuevo, y te dice cuántos son. Ese aborto NO es
  -- un fallo: es la decisión que no se puede tomar sin mirar el número, y en
  -- este proyecto no hay staging donde mirarlo antes.
  -- Si tras verlo se decide seguir igualmente, se pone `true` AQUÍ, en un
  -- commit propio, con el número escrito en el mensaje de ese commit.
  v_aceptar_bloqueo CONSTANT boolean := false;

  v_faltan     text;
  v_md5        text;
  v_bloqueados int;
  v_medicos    int;
BEGIN
  IF to_regprocedure('public.clinica_no_suspendida()') IS NULL
     OR to_regprocedure('public.clinica_tiene_acceso()') IS NULL
     OR to_regprocedure('public.clinica_dentro_de_limite()') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: falta algún helper de gates. Abortando.';
  END IF;

  -- Las columnas que lee `perfil_completo()`. Si una no existe, la función se
  -- crearía igual —el cuerpo SQL no se resuelve hasta la primera llamada— y el
  -- fallo aparecería como un INSERT roto en producción, no aquí.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'profiles'
       AND column_name IN ('id','role','nombres','especialidad','cedula_profesional','clinica_id')
     GROUP BY table_name HAVING count(*) = 6
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: profiles no tiene las 6 columnas del criterio. Abortando.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'consultorios'
       AND column_name IN ('medico_id','clinica_id','activo')
     GROUP BY table_name HAVING count(*) = 3
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: consultorios no tiene (medico_id, clinica_id, activo). Abortando.';
  END IF;

  -- Las SEIS tienen que existir Y ser RESTRICTIVE de INSERT antes de tocarlas.
  -- Si alguna no está, `ALTER POLICY` fallaría a media aplicación y dejaría el
  -- gate puesto en unas tablas y no en otras.
  SELECT string_agg(v.policy, ', ') INTO v_faltan
  FROM (VALUES
    ('pacientes',           'pacientes_gates_insert'),
    ('consultas',           'consultas_gates_insert'),
    ('documentos',          'documentos_gates_insert'),
    ('appointments',        'appointments_gates_insert'),
    ('addendums',           'addendums_gates_insert'),
    ('mediciones_analitos', 'mediciones_gates_insert')
  ) AS v(tabla, policy)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_policy pol
     WHERE pol.polname     = v.policy
       AND pol.polrelid    = to_regclass('public.' || v.tabla)
       AND pol.polcmd      = 'a'      -- INSERT
       AND pol.polpermissive IS FALSE -- RESTRICTIVE
  );
  IF v_faltan IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: policies ausentes o no restrictivas: %. Abortando.', v_faltan;
  END IF;

  -- La séptima tiene que existir y quedarse COMO ESTÁ. Ver el bloque de abajo.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
     WHERE polname = 'consultorios_gates_insert'
       AND polrelid = to_regclass('public.consultorios')
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: no existe consultorios_gates_insert. El esquema no es el esperado. Abortando.';
  END IF;

  -- ⚠️ EL CUERPO DEL RPC TIENE QUE SER EL QUE ESTA MIGRACIÓN ESPERA.
  -- Abajo se reescribe ENTERO con `CREATE OR REPLACE`, así que si alguien lo
  -- cambió a mano después del dump `20260912190416`, aplicar esto le borraría
  -- el cambio en silencio. Los dos hashes admitidos:
  --   6762f92416dc33bea3f2fcffda0f0218 → el cuerpo de hoy (sin el gate)
  --   0835cd6a598f740b1c5d1a85f8dbbb62 → el cuerpo de después (con el gate),
  --      que es lo que hace que repetir esta migración sea un no-op y no un
  --      aborto espurio.
  -- Los dos se comprobaron contra la base: `md5(prosrc)` del RPC vivo es hoy
  -- 6762f92…, y el cuerpo que escribe este archivo da 0835cd6… byte a byte.
  -- CONSECUENCIA: si el editor donde pegas esto normaliza saltos de línea o
  -- pierde acentos, el POST-FLIGHT abortará y revertirá todo. Falla cerrado,
  -- pero pega el archivo tal cual, sin reformatear.
  SELECT md5(prosrc) INTO v_md5
    FROM pg_proc
   WHERE oid = to_regprocedure('public.crear_paciente_con_medico_v2(jsonb,uuid,boolean)');
  IF v_md5 IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: no existe crear_paciente_con_medico_v2(jsonb,uuid,boolean). Abortando.';
  END IF;
  IF v_md5 NOT IN ('6762f92416dc33bea3f2fcffda0f0218',
                   '0835cd6a598f740b1c5d1a85f8dbbb62') THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: el cuerpo de crear_paciente_con_medico_v2 no es el esperado (md5=%). Alguien lo modificó después del dump 20260912190416: reescribirlo entero borraría ese cambio. Revisar a mano y reconciliar antes de aplicar. Abortando.', v_md5;
  END IF;

  -- ═══ CENSO: A CUÁNTA GENTE DEJA FUERA ═════════════════════════════════
  -- Va AQUÍ, antes de cualquier cambio, y ABORTA. En el borrador esto era el
  -- último SELECT del archivo: informaba de un cambio ya hecho.
  -- No usa `perfil_completo()` —esa función habla del llamador, y aquí no hay
  -- llamador— sino el mismo criterio evaluado fila a fila.
  SELECT count(*), count(*) FILTER (WHERE NOT completo)
    INTO v_medicos, v_bloqueados
  FROM (
    SELECT (
           btrim(COALESCE(pr.nombres, ''))            <> ''
       AND btrim(COALESCE(pr.especialidad, ''))       <> ''
       AND btrim(COALESCE(pr.cedula_profesional, '')) <> ''
       AND pr.clinica_id IS NOT NULL
       AND EXISTS (
             SELECT 1 FROM public.consultorios co
              WHERE co.medico_id  = pr.id
                AND co.clinica_id = pr.clinica_id
                AND co.activo IS TRUE
           )
    ) AS completo
    FROM public.profiles pr
    WHERE pr.role = 'medico'
  ) t;

  IF v_bloqueados > 0 AND NOT v_aceptar_bloqueo THEN
    RAISE EXCEPTION
      'PRE-FLIGHT ABORTA (no es un error de esquema): % de % medicos quedarian bloqueados por el criterio nuevo y no podrian crear pacientes, consultas, documentos, citas, addendums ni mediciones hasta completar su perfil. Nada se ha cambiado. Decide con ese numero delante: si se acepta, pon v_aceptar_bloqueo := true en la cabecera de este DO y vuelve a aplicar.',
      v_bloqueados, v_medicos;
  END IF;
END $$;


-- ═══ 1 · perfil_completo() ═══════════════════════════════════════════════
--
-- Replica EXACTAMENTE `evaluarPerfil` de src/lib/perfil/gate.ts. Son las dos
-- mitades del mismo criterio: si una cambia, la otra cambia en el mismo
-- commit, o la base y la pantalla dejan de decir lo mismo.
--
--   super_admin  → true (exento; su perfil no tiene clínica POR DISEÑO)
--   secretaria   → true (exenta; decisión previa, api/me/estado-perfil:22-30)
--   resto        → nombres, especialidad y cedula_profesional no vacíos tras
--                  trim, clinica_id no nulo, y ≥1 consultorio activo suyo.
--
-- La lista es de EXENTOS, no de exigidos: cualquier rol futuro nace bloqueado,
-- igual que en gate.ts. Hoy `profiles_role_check` solo admite
-- ('super_admin','medico','secretaria'), así que el único rol exigido es
-- `medico`.
--
-- `cedula_especialidad` NO se exige: un médico general no la tiene. `firma_url`
-- tampoco: es otro escalón.
--
-- SECURITY DEFINER + propiedad de `postgres` (BYPASSRLS) es lo que impide la
-- recursión: dentro de la función no se evalúa la RLS de `profiles` ni la de
-- `consultorios`, igual que en get_clinica_id(), get_my_role(),
-- soy_admin_de_clinica() y clinica_tiene_acceso(). La recursión de mayo de 2026
-- (CLAUDE.md, incidente 2026-05-04) fue otra cosa: un predicado en línea sobre
-- la tabla restringida, sin función intermedia.
--
-- `pg_temp` va EXPLÍCITO y AL FINAL del search_path: sin listarlo, Postgres lo
-- busca PRIMERO y una tabla temporal podría secuestrar el nombre `profiles`.
-- El cuerpo además cualifica `public.` en las dos tablas, que es el cinturón.
--
-- COALESCE(..., false) = fallo cerrado, misma forma que clinica_no_suspendida().
-- Sin fila de perfil (sin sesión, o perfil inexistente) NO se inserta.
--
-- El filtro por `clinica_id` en el EXISTS no es adorno: un consultorio que
-- quedó colgando de una clínica anterior no cuenta, porque tampoco lo cuenta
-- la app —`consultorios_select` filtra por `clinica_id = get_clinica_id()` AND
-- `medico_id = auth.uid()`, y de ahí sale el número que recibe gate.ts
-- (src/app/api/me/config/route.ts, `.eq('activo', true)` sobre esa RLS).
CREATE OR REPLACE FUNCTION public.perfil_completo()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT COALESCE(
    (
      SELECT
        CASE
          WHEN pr.role IN ('super_admin', 'secretaria') THEN true
          ELSE
                 btrim(COALESCE(pr.nombres, ''))             <> ''
             AND btrim(COALESCE(pr.especialidad, ''))        <> ''
             AND btrim(COALESCE(pr.cedula_profesional, '')) <> ''
             AND pr.clinica_id IS NOT NULL
             AND EXISTS (
                   SELECT 1
                     FROM public.consultorios co
                    WHERE co.medico_id  = pr.id
                      AND co.clinica_id = pr.clinica_id
                      AND co.activo IS TRUE
                 )
        END
        FROM public.profiles pr
       WHERE pr.id = auth.uid()
    ),
    false
  );
$fn$;

COMMENT ON FUNCTION public.perfil_completo() IS
  'Criterio unico de perfil completo (Bloque B5). Espejo en la base de '
  'evaluarPerfil() en src/lib/perfil/gate.ts: super_admin y secretaria exentos; '
  'medico exige nombres+especialidad+cedula_profesional no vacios, clinica_id y '
  '>=1 consultorio activo propio. NO exige cedula_especialidad ni firma_url. '
  'Si cambia una mitad, cambia la otra en el mismo commit; el espejo no lo '
  'vigila ningun test ni ninguna restriccion, solo esta nota y la de gate.ts. '
  'NO se usa en consultorios_gates_insert: encerraria al medico.';

-- Los GRANT por defecto se dejan como están, igual que los otros cuatro
-- helpers. Comprobado creando una función de prueba en una transacción
-- revertida: una función nueva de `public` creada por `postgres` nace con
-- proacl {=X/postgres, postgres=X, anon=X, authenticated=X, service_role=X};
-- es decir, PUBLIC (el default de fábrica) MÁS lo que añade `pg_default_acl`.
-- `authenticated` recibe EXECUTE por partida doble y DEBE recibirlo: la policy
-- se evalúa con el rol que inserta, así que sin ese EXECUTE fallarían TODOS
-- los INSERT de las seis tablas. El post-vuelo lo comprueba en vez de darlo
-- por hecho.
-- Queda expuesta como RPC en PostgREST (/rest/v1/rpc/perfil_completo): solo
-- informa del estado del PROPIO llamador —`auth.uid()`—, sin fuga entre
-- clínicas; `anon` recibe false.


-- ═══ 2 · Las SEIS policies ═══════════════════════════════════════════════
--
-- `ALTER POLICY` y no DROP+CREATE a propósito: DROP dejaría una ventana, por
-- corta que sea, en la que la tabla pierde una restricción. El resto de la
-- policy —comando, roles (`TO authenticated`), carácter RESTRICTIVE, nombre—
-- no se toca: `ALTER POLICY … WITH CHECK` no puede cambiarlos.
--
-- Cada WITH CHECK se reescribe COMPLETO y conserva sus condiciones actuales
-- verbatim, comprobadas contra `pg_get_expr(polwithcheck, polrelid)` de la
-- base. Ojo con `pacientes`: tiene TRES, no dos.

ALTER POLICY pacientes_gates_insert ON public.pacientes
  WITH CHECK (
    public.clinica_no_suspendida()
    AND public.clinica_tiene_acceso()
    AND public.clinica_dentro_de_limite()
    AND public.perfil_completo()
  );

ALTER POLICY consultas_gates_insert ON public.consultas
  WITH CHECK (
    public.clinica_no_suspendida()
    AND public.clinica_tiene_acceso()
    AND public.perfil_completo()
  );

ALTER POLICY documentos_gates_insert ON public.documentos
  WITH CHECK (
    public.clinica_no_suspendida()
    AND public.clinica_tiene_acceso()
    AND public.perfil_completo()
  );

ALTER POLICY appointments_gates_insert ON public.appointments
  WITH CHECK (
    public.clinica_no_suspendida()
    AND public.clinica_tiene_acceso()
    AND public.perfil_completo()
  );

ALTER POLICY addendums_gates_insert ON public.addendums
  WITH CHECK (
    public.clinica_no_suspendida()
    AND public.clinica_tiene_acceso()
    AND public.perfil_completo()
  );

ALTER POLICY mediciones_gates_insert ON public.mediciones_analitos
  WITH CHECK (
    public.clinica_no_suspendida()
    AND public.clinica_tiene_acceso()
    AND public.perfil_completo()
  );

-- ═══ LA SÉPTIMA NO SE TOCA, Y NO ES UN OLVIDO ════════════════════════════
--
-- `consultorios_gates_insert` SE QUEDA EXACTAMENTE COMO ESTÁ:
--     (clinica_no_suspendida() AND clinica_tiene_acceso())
--
-- Añadirle `AND perfil_completo()` encerraría al médico en un punto muerto sin
-- salida. El criterio EXIGE tener al menos un consultorio activo; si además
-- hiciera falta el perfil completo para CREAR un consultorio, el médico que no
-- tiene ninguno no podría crear el primero — y sin el primero nunca cumpliría
-- el criterio. La condición se estaría pidiendo a sí misma.
--
-- Las tres vías de salida del gate quedan abiertas a propósito, verificado
-- contra pg_policy:
--   · consultorios → esta policy, más la PERMISSIVE `consultorios_insert`
--                    (medico_id = auth.uid() AND clinica_id = get_clinica_id()
--                    AND get_my_role() = 'medico'), sin la condición nueva.
--   · profiles     → solo tiene profiles_select y profiles_update, las dos
--                    PERMISSIVE; el médico puede completar sus datos.
--   · clinicas     → solo tiene clinicas_select_own_or_super_admin; la
--                    escritura va por cliente de servicio tras el candado de
--                    rol (src/app/api/me/clinica/route.ts:106-115).
--
-- Salvedad conocida y PREEXISTENTE, que esta migración no crea ni empeora: el
-- médico INVITADO que se quedó sin `clinica_id` (p. ej. porque se borró su
-- clínica: `profiles_clinica_id_fkey` es ON DELETE SET NULL) no puede crear
-- consultorio —`consultorios_insert` exige `clinica_id = get_clinica_id()`, que
-- es NULL— ni clínica. Es el caso `requiereSoporte` de gate.ts:68-76. Ya hoy
-- no puede escribir nada: `clinica_no_suspendida()` devuelve false sin clínica.
--
-- Si alguien añade aquí la condición «por consistencia», el síntoma será un
-- médico nuevo que no puede hacer absolutamente nada y sin mensaje que lo
-- explique. NO LA AÑADAS.


-- ═══ 3 · El RPC de alta de pacientes ═════════════════════════════════════
--
-- Se reescribe ENTERO porque Postgres no sabe parchear el cuerpo de una
-- función. El texto de abajo es, carácter por carácter, el que hay hoy en
-- producción —extraído de `supabase/migrations/20260912190416_remote_schema.sql`
-- líneas 1074-1270, comprobado contra `md5(prosrc)` de la base— MÁS el bloque
-- del gate de perfil al final del PASO 3. El pre-vuelo de arriba aborta si el
-- cuerpo vivo no es uno de los dos esperados.
--
-- `CREATE OR REPLACE` conserva los privilegios existentes (el REVOKE/GRANT de
-- `remote_schema.sql:3391-3393` sigue vigente); el post-vuelo lo comprueba.
CREATE OR REPLACE FUNCTION public.crear_paciente_con_medico_v2 (
  p_datos        jsonb,
  p_medico_id    uuid,
  p_force_create boolean DEFAULT false
)
  RETURNS TABLE (
    resultado         text,
    id                uuid,
    numero_expediente text,
    dup_id            uuid,
    dup_nombre        text,
    dup_apellidos     text,
    dup_numero_exp    text,
    dup_fecha_nac     date,
    dup_es_mio        boolean
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
DECLARE
  v_uid          uuid := auth.uid();
  v_rol          text;
  v_clinica_id   uuid;
  v_es_admin     boolean;
  v_medico_rol   text;
  v_medico_clin  uuid;
  v_anio         text := to_char(now(), 'YYYY');
  v_correlativo  int;
  v_num_exp      text;
  v_nuevo_id     uuid;
  v_nombre       text;
  v_apellidos    text;
  v_fecha_nac    date;
  v_dup_id       uuid;
  v_dup_nombre   text;
  v_dup_apell    text;
  v_dup_num_exp  text;
  v_dup_fnac     date;
  v_dup_es_mio   boolean;
  v_medico_eval  uuid;
BEGIN
  -- PASO 1 — validar quién llama
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
  END IF;
  SELECT pr.role, pr.clinica_id, pr.es_admin_de_clinica
    INTO v_rol, v_clinica_id, v_es_admin
  FROM public.profiles pr WHERE pr.id = v_uid;
  IF v_clinica_id IS NULL THEN
    RAISE EXCEPTION 'El usuario no tiene clinica asignada.' USING ERRCODE = '42501';
  END IF;
  IF v_rol NOT IN ('medico','secretaria') THEN
    RAISE EXCEPTION 'El rol % no puede crear pacientes.', v_rol USING ERRCODE = '42501';
  END IF;

  -- PASO 2 — validar el médico objetivo
  IF p_medico_id IS NULL THEN
    RAISE EXCEPTION 'Debe especificarse el medico tratante.' USING ERRCODE = '42501';
  END IF;
  SELECT pr.role, pr.clinica_id INTO v_medico_rol, v_medico_clin
  FROM public.profiles pr WHERE pr.id = p_medico_id;
  IF v_medico_rol IS NULL THEN
    RAISE EXCEPTION 'El medico especificado no existe.' USING ERRCODE = '42501';
  END IF;
  IF v_medico_rol <> 'medico' THEN
    RAISE EXCEPTION 'El usuario asignado no es un medico.' USING ERRCODE = '42501';
  END IF;
  IF v_medico_clin IS DISTINCT FROM v_clinica_id THEN
    RAISE EXCEPTION 'El medico no pertenece a la clinica del usuario.' USING ERRCODE = '42501';
  END IF;
  IF v_rol = 'medico' AND v_es_admin IS NOT TRUE AND p_medico_id <> v_uid THEN
    RAISE EXCEPTION 'Un medico invitado solo puede asignarse pacientes a si mismo.'
      USING ERRCODE = '42501';
  END IF;

  -- PASO 3 — gates de suscripción
  IF NOT public.clinica_no_suspendida() THEN
    RAISE EXCEPTION 'La clinica esta suspendida.' USING ERRCODE = 'SP002';
  END IF;
  IF NOT public.clinica_tiene_acceso() THEN
    RAISE EXCEPTION 'La clinica no tiene una suscripcion activa.' USING ERRCODE = 'SP003';
  END IF;
  IF NOT public.clinica_dentro_de_limite() THEN
    RAISE EXCEPTION 'La clinica alcanzo su limite de pacientes.' USING ERRCODE = 'SP001';
  END IF;

  /* ── Gate de perfil (Bloque B5) ────────────────────────────────────────
     VA AQUÍ Y NO SOLO EN LA POLICY. Esta función es SECURITY DEFINER
     propiedad de `postgres`, rol con BYPASSRLS: dentro de ella NO se evalúa
     `pacientes_gates_insert` ni ninguna otra policy. Y éste es el camino que
     la app usa a diario (src/app/api/pacientes/route.ts:136), así que sin
     esta comprobación el gate de perfil tendría su único agujero justo en la
     tabla que más importa.

     Por qué importa más aquí que en ningún otro sitio: un paciente creado por
     alguien sin clínica colgaría de un `clinica_id` vacío, invisible para
     todos, en una tabla que NO tiene borrado y con retención legal de 5 años.

     `auth.uid()` sigue devolviendo AL LLAMADOR aquí dentro, comprobado antes
     de escribir esto: sale de `current_setting('request.jwt.claim.sub' /
     'request.jwt.claims')` —ver la definición de `auth.uid()`—, que es un GUC
     de la sesión y no cambia con SECURITY DEFINER, que solo cambia el rol
     efectivo. Este mismo PASO 3 ya dependía de ello: `clinica_no_suspendida()`
     llama a `get_clinica_id()`, que hace `where id = auth.uid()`.

     EVALÚA AL LLAMADOR, NO AL MÉDICO OBJETIVO (`p_medico_id`), igual que las
     policies. Consecuencia deliberada: un admin con su perfil completo puede
     dar de alta un paciente asignado a un invitado que aún no completó el
     suyo. Se prefiere así: el invitado no queda bloqueado por el trabajo de
     otro, y su propio gate lo alcanza en cuanto intente escribir él.

     ERRCODE 42501 Y NO UN `SP00x` NUEVO, A PROPÓSITO: `api/pacientes/route.ts`
     mapea 42501 → 403 `forbidden` y deja pasar el mensaje (`:156-168`),
     mientras que un código desconocido cae al 500 genérico de `:168`. Cuando
     la parte visible del bloque tenga pantalla y token propios, aquí entra un
     SP00x y allí su entrada en el mapa; las dos mitades, en el mismo commit.

     Va al FINAL del PASO 3 para que los mensajes de suscripción conserven la
     prioridad: una clínica suspendida es un problema más de fondo que un
     perfil a medias. */
  IF NOT public.perfil_completo() THEN
    RAISE EXCEPTION 'Completa tu perfil (nombre, especialidad, cedula profesional y al menos un consultorio) antes de registrar pacientes.'
      USING ERRCODE = '42501';
  END IF;

  -- PASO NUEVO — detección de duplicados (DUP-RPC Fase 1; ver DUPRPC_PLAN.md §4.3)
  IF p_force_create IS NOT TRUE THEN
    v_nombre    := p_datos->>'nombre';
    v_apellidos := p_datos->>'apellidos';
    v_fecha_nac := NULLIF(p_datos->>'fecha_nacimiento','')::date;

    IF v_nombre IS NOT NULL AND btrim(v_nombre) <> ''
       AND v_apellidos IS NOT NULL AND btrim(v_apellidos) <> ''
       AND v_fecha_nac IS NOT NULL
    THEN
      SELECT p.id, p.nombre, p.apellidos, p.numero_expediente, p.fecha_nacimiento
        INTO v_dup_id, v_dup_nombre, v_dup_apell, v_dup_num_exp, v_dup_fnac
      FROM public.pacientes p
      WHERE p.clinica_id = v_clinica_id
        AND (p.activo = true OR p.activo IS NULL)
        AND p.fecha_nacimiento = v_fecha_nac
        AND lower(btrim(p.nombre))    = lower(btrim(v_nombre))
        AND lower(btrim(p.apellidos)) = lower(btrim(v_apellidos))
      ORDER BY p.created_at ASC
      LIMIT 1;

      IF v_dup_id IS NOT NULL THEN
        IF v_rol = 'medico' THEN
          v_medico_eval := v_uid;
        ELSE
          v_medico_eval := p_medico_id;
        END IF;

        v_dup_es_mio := EXISTS (
          SELECT 1 FROM public.paciente_medico pm
          WHERE pm.paciente_id = v_dup_id
            AND pm.medico_id = v_medico_eval
        );

        RETURN QUERY SELECT
          'duplicado'::text,
          NULL::uuid,
          NULL::text,
          v_dup_id,
          v_dup_nombre,
          v_dup_apell,
          v_dup_num_exp,
          v_dup_fnac,
          v_dup_es_mio;
        RETURN;  -- NO inserta nada
      END IF;
    END IF;
  END IF;

  -- PASO 4 — generar numero_expediente
  SELECT COALESCE(MAX(
           NULLIF(regexp_replace(p.numero_expediente, '^EXP-\d{4}-', ''), '')::int
         ), 0) + 1
    INTO v_correlativo
  FROM public.pacientes p
  WHERE p.clinica_id = v_clinica_id
    AND p.numero_expediente ~ ('^EXP-' || v_anio || '-[0-9]+$');
  v_num_exp := 'EXP-' || v_anio || '-' || lpad(v_correlativo::text, 4, '0');

  -- PASO 5 — insert en pacientes
  INSERT INTO public.pacientes (
    nombre, apellidos, fecha_nacimiento, sexo,
    peso_kg, talla_cm, imc,
    telefono, email, direccion,
    ant_no_patologicos, ant_patologicos, ant_quirurgicos, ant_familiares,
    alergias, medicamentos_actuales,
    clinica_id, medico_id, numero_expediente,
    consentimiento_otorgado, fecha_consentimiento, version_aviso_privacidad
  ) VALUES (
    p_datos->>'nombre',
    p_datos->>'apellidos',
    NULLIF(p_datos->>'fecha_nacimiento','')::date,
    NULLIF(p_datos->>'sexo', ''),
    NULLIF(p_datos->>'peso_kg', '')::numeric,
    NULLIF(p_datos->>'talla_cm', '')::numeric,
    NULLIF(p_datos->>'imc', '')::numeric,
    NULLIF(p_datos->>'telefono', ''),
    NULLIF(p_datos->>'email', ''),
    NULLIF(p_datos->>'direccion', ''),
    NULLIF(p_datos->>'ant_no_patologicos', ''),
    NULLIF(p_datos->>'ant_patologicos', ''),
    NULLIF(p_datos->>'ant_quirurgicos', ''),
    NULLIF(p_datos->>'ant_familiares', ''),
    NULLIF(p_datos->>'alergias', ''),
    NULLIF(p_datos->>'medicamentos_actuales', ''),
    v_clinica_id,
    p_medico_id,
    v_num_exp,
    true,
    now(),
    'v1.0-2026-04-08'
  )
  RETURNING pacientes.id INTO v_nuevo_id;

  -- PASO 6 — insert en paciente_medico
  INSERT INTO public.paciente_medico (paciente_id, medico_id, asignado_por)
  VALUES (v_nuevo_id, p_medico_id, v_uid);

  RETURN QUERY SELECT
    'creado'::text,
    v_nuevo_id,
    v_num_exp,
    NULL::uuid,
    NULL::text,
    NULL::text,
    NULL::text,
    NULL::date,
    false;
END;
$function$;


-- ═══ 4 · LA PUERTA TRASERA: EL RPC v1 ════════════════════════════════════
--
-- ⚠️ SIN ESTE BLOQUE, TODO LO ANTERIOR SE RODEA CON UN `curl`.
--
-- `public.crear_paciente_con_medico(jsonb, uuid)` —la versión anterior de
-- v2— SIGUE VIVA en producción:
--   · SECURITY DEFINER, owner `postgres` (BYPASSRLS) ⇒ las seis policies de
--     arriba NO se evalúan dentro de ella;
--   · inserta en `public.pacientes` con los tres gates de suscripción pero
--     SIN el gate de perfil;
--   · tiene `GRANT EXECUTE … TO anon, authenticated`
--     (20260912190416_remote_schema.sql:3389) ⇒ está publicada en PostgREST
--     como POST /rest/v1/rpc/crear_paciente_con_medico.
-- Es decir: un médico con el perfil a medias seguiría dando de alta pacientes
-- —la tabla con retención legal de 5 años y sin borrado— con una petición
-- directa, saltándose el gate que esta migración instala.
--
-- `ETAPA5_PLAN.md:1338` la da por eliminada («Paso 4 de DUP-RPC, ejecutado»);
-- `ETAPA5_PLAN.md:1566` la sigue dando por pendiente, y el dump de producción
-- del 2026-09-12 (`:953` y `:3389`) demuestra que la pendiente es la buena.
--
-- SE RETIRA EL EXECUTE, NO SE HACE DROP. El DROP es el Paso 4 de DUP-RPC y es
-- decisión de ese plan, no de esta migración; el REVOKE cierra el agujero hoy,
-- es reversible con un GRANT y no destruye nada. `postgres` y `service_role`
-- CONSERVAN EXECUTE: cualquier uso desde servidor con clave de servicio sigue
-- funcionando. Ningún archivo de `src/` invoca esta función (grep: el único
-- llamador vivo es v2, en src/app/api/pacientes/route.ts:136).
--
-- PUBLIC VA EN LA LISTA DEL REVOKE, y no es redundante: en Postgres una
-- función nace con EXECUTE para PUBLIC, así que quitárselo solo a `anon` y a
-- `authenticated` dejaría el permiso vivo por la puerta de PUBLIC. Hoy el v1
-- no lo tiene —`remote_schema.sql:3387` hizo REVOKE ALL FROM PUBLIC antes del
-- GRANT—, pero el REVOKE se escribe completo para que no dependa de eso.
--
-- Va condicionado a que exista, para que el día que DUP-RPC ejecute su DROP
-- este archivo siga siendo replayable sin tocarlo.
DO $$
BEGIN
  IF to_regprocedure('public.crear_paciente_con_medico(jsonb,uuid)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.crear_paciente_con_medico(jsonb, uuid)
      FROM PUBLIC, anon, authenticated;
    COMMENT ON FUNCTION public.crear_paciente_con_medico(jsonb, uuid) IS
      'RPC v1 SUPERSEDIDO por crear_paciente_con_medico_v2. Sin EXECUTE para '
      'anon/authenticated desde el Bloque B5: no lleva el gate de perfil y, al '
      'ser SECURITY DEFINER, rodearia las policies *_gates_insert. Pendiente de '
      'DROP (DUPRPC_PLAN.md, Paso 4). No volver a exponerlo en PostgREST.';
  END IF;
END $$;


-- ---------- POST-FLIGHT ----------
DO $$
DECLARE
  v_con    int;
  v_owner  name;
  v_volat  char;
  v_secdef boolean;
BEGIN
  SELECT pg_get_userbyid(proowner), provolatile, prosecdef
    INTO v_owner, v_volat, v_secdef
    FROM pg_proc WHERE oid = to_regprocedure('public.perfil_completo()');

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: no existe perfil_completo().';
  END IF;
  IF v_owner <> 'postgres' THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: owner=% (esperado postgres). Sin ese owner, SECURITY DEFINER no bypasea la RLS de profiles/consultorios.', v_owner;
  END IF;
  IF v_secdef IS NOT TRUE OR v_volat <> 's' THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: perfil_completo() no quedó STABLE SECURITY DEFINER.';
  END IF;

  -- Anclado a polrelid: el nombre de una policy solo es único DENTRO de su
  -- tabla, así que contar por polname a secas puede sumar de más.
  SELECT count(*) INTO v_con
    FROM pg_policy
   WHERE (polrelid, polname) IN (
           (to_regclass('public.pacientes'),           'pacientes_gates_insert'),
           (to_regclass('public.consultas'),           'consultas_gates_insert'),
           (to_regclass('public.documentos'),          'documentos_gates_insert'),
           (to_regclass('public.appointments'),        'appointments_gates_insert'),
           (to_regclass('public.addendums'),           'addendums_gates_insert'),
           (to_regclass('public.mediciones_analitos'), 'mediciones_gates_insert'))
     AND pg_get_expr(polwithcheck, polrelid) LIKE '%perfil_completo()%';
  IF v_con <> 6 THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: % de 6 policies llevan la condición.', v_con;
  END IF;

  -- Que la de `pacientes` no haya perdido su tercer gate por el camino.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
     WHERE polname  = 'pacientes_gates_insert'
       AND polrelid = to_regclass('public.pacientes')
       AND pg_get_expr(polwithcheck, polrelid) LIKE '%clinica_dentro_de_limite()%'
  ) THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: pacientes_gates_insert perdió clinica_dentro_de_limite(). Revertir.';
  END IF;

  -- Y que la séptima siga limpia.
  IF EXISTS (
    SELECT 1 FROM pg_policy
     WHERE polname  = 'consultorios_gates_insert'
       AND polrelid = to_regclass('public.consultorios')
       AND pg_get_expr(polwithcheck, polrelid) LIKE '%perfil_completo%'
  ) THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: consultorios_gates_insert lleva la condición. Encierra al médico. Revertir.';
  END IF;

  -- El RPC: cuerpo nuevo, firma intacta y `authenticated` conserva EXECUTE.
  -- Sin ese EXECUTE el alta de pacientes deja de funcionar para todo el mundo.
  IF (SELECT md5(prosrc) FROM pg_proc
       WHERE oid = to_regprocedure('public.crear_paciente_con_medico_v2(jsonb,uuid,boolean)'))
     IS DISTINCT FROM '0835cd6a598f740b1c5d1a85f8dbbb62' THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: el cuerpo del RPC no quedó como esperaba esta migración (¿el editor reformateó el archivo al pegarlo?). Revertir.';
  END IF;

  IF NOT has_function_privilege('authenticated',
        to_regprocedure('public.crear_paciente_con_medico_v2(jsonb,uuid,boolean)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: authenticated perdió EXECUTE sobre el RPC v2. Nadie podría dar de alta pacientes. Revertir.';
  END IF;

  IF NOT has_function_privilege('authenticated',
        to_regprocedure('public.perfil_completo()'), 'EXECUTE') THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: authenticated sin EXECUTE sobre perfil_completo(). Fallarían TODOS los INSERT de las seis tablas. Revertir.';
  END IF;

  -- La puerta trasera, cerrada (si la función sigue existiendo).
  IF to_regprocedure('public.crear_paciente_con_medico(jsonb,uuid)') IS NOT NULL THEN
    IF has_function_privilege('authenticated',
          to_regprocedure('public.crear_paciente_con_medico(jsonb,uuid)'), 'EXECUTE')
       OR has_function_privilege('anon',
          to_regprocedure('public.crear_paciente_con_medico(jsonb,uuid)'), 'EXECUTE') THEN
      RAISE EXCEPTION 'POST-FLIGHT FALLO: el RPC v1 sigue ejecutable por anon/authenticated. El gate de perfil se rodearia por PostgREST. Revertir.';
    END IF;
  END IF;
END $$;

COMMIT;


-- ═══════════════════════════════════════════════════════════════════════
-- VEREDICTO EN LA REJILLA — UN SOLO SELECT, A PROPÓSITO.
--
-- El SQL Editor de Supabase (postgres-meta, dist/lib/db.js) hace
-- `res.reverse().find(x => x.rows.length !== 0)`: de un script con varias
-- sentencias solo llega a la rejilla el ÚLTIMO conjunto de resultados que
-- traiga filas. Con varios SELECT al final, todos menos uno son invisibles.
-- Por eso el veredicto entero va en esta única consulta. NO le añadas otro
-- SELECT detrás: lo taparías.
--
-- Cómo se lee: las 8 primeras filas deben decir OK. Si alguna dice REVISAR,
-- la migración quedó a medias pese al COMMIT y hay que mirar `detalle`.
-- ═══════════════════════════════════════════════════════════════════════
SELECT * FROM (
  SELECT 1 AS n,
         'policy ' || p.polrelid::regclass::text AS objeto,
         CASE
           WHEN p.polrelid = to_regclass('public.consultorios')
             THEN CASE WHEN pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%perfil_completo()%'
                       THEN 'REVISAR' ELSE 'OK (sin gate, es la excepcion)' END
           ELSE CASE WHEN pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%perfil_completo()%'
                     THEN 'OK (con gate)' ELSE 'REVISAR' END
         END AS estado,
         pg_get_expr(p.polwithcheck, p.polrelid) AS detalle
    FROM pg_policy p
   WHERE p.polname LIKE '%\_gates\_insert'

  UNION ALL
  SELECT 2,
         'rpc crear_paciente_con_medico_v2',
         CASE WHEN md5(prosrc) = '0835cd6a598f740b1c5d1a85f8dbbb62'
              THEN 'OK (con gate)' ELSE 'REVISAR' END,
         'md5=' || md5(prosrc)
    FROM pg_proc
   WHERE oid = to_regprocedure('public.crear_paciente_con_medico_v2(jsonb,uuid,boolean)')

  UNION ALL
  SELECT 3,
         'rpc v1 crear_paciente_con_medico',
         CASE
           WHEN to_regprocedure('public.crear_paciente_con_medico(jsonb,uuid)') IS NULL
             THEN 'OK (ya no existe)'
           WHEN has_function_privilege('authenticated', to_regprocedure('public.crear_paciente_con_medico(jsonb,uuid)'), 'EXECUTE')
             OR has_function_privilege('anon', to_regprocedure('public.crear_paciente_con_medico(jsonb,uuid)'), 'EXECUTE')
             THEN 'REVISAR'
           ELSE 'OK (sin EXECUTE para anon/authenticated)'
         END,
         COALESCE((SELECT array_to_string(proacl, ' ') FROM pg_proc
                    WHERE oid = to_regprocedure('public.crear_paciente_con_medico(jsonb,uuid)')), '-')

  UNION ALL
  SELECT 4,
         'medicos bloqueados por el criterio',
         'INFORMATIVO',
         (SELECT count(*) FILTER (WHERE NOT completo) || ' de ' || count(*)
            FROM (SELECT (
                     btrim(COALESCE(pr.nombres, ''))            <> ''
                 AND btrim(COALESCE(pr.especialidad, ''))       <> ''
                 AND btrim(COALESCE(pr.cedula_profesional, '')) <> ''
                 AND pr.clinica_id IS NOT NULL
                 AND EXISTS (SELECT 1 FROM public.consultorios co
                              WHERE co.medico_id  = pr.id
                                AND co.clinica_id = pr.clinica_id
                                AND co.activo IS TRUE)
                  ) AS completo
                  FROM public.profiles pr WHERE pr.role = 'medico') t)
) v
ORDER BY n, objeto;


-- ═══════════════════════════════════════════════════════════════════════
-- ROLLBACK (no ejecutar salvo que haya que revertir)
--
-- Devuelve las seis policies a su predicado anterior y reabre el RPC v1. Para
-- el RPC v2 hay que volver a aplicar su cuerpo SIN el bloque del gate: está en
-- `supabase/migrations/20260912190416_remote_schema.sql` líneas 1074-1270,
-- que es el original íntegro. NO se puede revertir con un ALTER.
--
-- `perfil_completo()` se puede dejar viva: sin llamadores no hace nada. Si se
-- borra, hacerlo DESPUÉS de revertir las seis policies y el RPC, o el DROP
-- falla por dependencia.
--
-- Reabrir el RPC v1 (última línea) SOLO si se revierte todo: mientras las seis
-- policies lleven el gate, ese GRANT es el agujero que §4 cerró.
-- ═══════════════════════════════════════════════════════════════════════
-- BEGIN;
--   ALTER POLICY pacientes_gates_insert ON public.pacientes
--     WITH CHECK (public.clinica_no_suspendida() AND public.clinica_tiene_acceso() AND public.clinica_dentro_de_limite());
--   ALTER POLICY consultas_gates_insert ON public.consultas
--     WITH CHECK (public.clinica_no_suspendida() AND public.clinica_tiene_acceso());
--   ALTER POLICY documentos_gates_insert ON public.documentos
--     WITH CHECK (public.clinica_no_suspendida() AND public.clinica_tiene_acceso());
--   ALTER POLICY appointments_gates_insert ON public.appointments
--     WITH CHECK (public.clinica_no_suspendida() AND public.clinica_tiene_acceso());
--   ALTER POLICY addendums_gates_insert ON public.addendums
--     WITH CHECK (public.clinica_no_suspendida() AND public.clinica_tiene_acceso());
--   ALTER POLICY mediciones_gates_insert ON public.mediciones_analitos
--     WITH CHECK (public.clinica_no_suspendida() AND public.clinica_tiene_acceso());
--   -- + pegar aquí el CREATE OR REPLACE del RPC v2 original (remote_schema.sql:1074-1270)
--   GRANT EXECUTE ON FUNCTION public.crear_paciente_con_medico(jsonb, uuid) TO anon, authenticated;
--   -- DROP FUNCTION IF EXISTS public.perfil_completo();
-- COMMIT;
