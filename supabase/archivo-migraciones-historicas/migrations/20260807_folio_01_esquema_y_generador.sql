-- ============================================================================
-- PENDIENTE DE APLICAR — la ejecuta Angel a mano, EN CUATRO BLOQUES
-- ============================================================================
-- Sistema de documentos v2 · sub-paso «generador de folio», commit 1 de 2.
--
-- Da al folio las tres cosas que hoy no tiene: una COLUMNA propia (hoy vive
-- dentro del JSON de `contenido`, sin índice, y no es buscable), un CORRELATIVO
-- que no se puede repetir, y UN SOLO generador para los tres formatos que lo
-- llevan — Receta, Honorarios/Cotización y Consentimiento. Los otros cinco no
-- llevan folio, y por eso la columna es nullable.
--
-- ── CÓMO SE EJECUTA: CUATRO BLOQUES, NO NUEVE CONSULTAS SUELTAS ─────────────
--
-- La versión anterior de este archivo decía «UNA CONSULTA A LA VEZ». Se cambia
-- a propósito, y la razón es que tres de los estados intermedios que eso deja
-- son explotables mientras duran:
--
--   · Consulta 2 sin la 3  → la tabla de contadores existe con los grants por
--     defecto de Supabase a `anon`/`authenticated` y SIN RLS. Cualquier
--     autenticado la lee y la escribe. Es el peor de los tres.
--   · Consulta 4 sin la 5 y la 6 → la columna existe sin CHECK de forma y sin
--     índice único. PostgREST la expone en cuanto recargue (Supabase trae
--     event triggers que hacen NOTIFY tras cada DDL), y cualquier autenticado
--     escribe cadenas arbitrarias en `folio`, incluidas las que después van a
--     chocar con la serie.
--   · Consultas 7-9 sin la 10 → el generador queda ejecutable por PUBLIC, y el
--     trigger existe o no existe a medias con su función.
--
-- Los cuatro bloques son:
--
--   BLOQUE A = {1}              pre-flight, no cambia nada
--   BLOQUE B = {2, 3}           tabla de contadores + su RLS y sus REVOKE
--   BLOQUE C = {4, 5, 6}        columna + CHECK + índice único
--   BLOQUE D = {7, 8, 9, 10, 11} generador + trigger + permisos + reload
--
-- Cada bloque es atómico y deja un estado coherente. Ninguno de los estados
-- entre bloques es explotable. La lógica SQL no cambia por esto: cambia dónde
-- van los BEGIN/COMMIT.
--
-- Los bloques C y D tocan `public.documentos`, que es una tabla de uso diario,
-- y por eso llevan `SET LOCAL lock_timeout = '3s'`: si hay una transacción
-- abierta por delante, el bloque falla rápido en vez de encolar detrás de sí
-- todas las peticiones de la app.
--
-- NOTA OPERATIVA — SQL Editor del dashboard (Protocolo D-T6). El editor ya
-- envuelve cada envío en una transacción, así que al llegar al `BEGIN;` va a
-- responder `WARNING: there is already a transaction in progress`. Es un
-- WARNING, no un error: la ejecución sigue y el bloque es atómico igual. Los
-- BEGIN/COMMIT van escritos de todos modos para que el archivo diga lo que
-- significa y para que sea correcto si algún día se corre por psql. Lo que NO
-- se puede hacer es enviar los cuatro bloques juntos en un solo envío.
--
-- ── VERIFICADO CONTRA PRODUCCIÓN ANTES DE ESCRIBIR ESTO ─────────────────────
--
-- 1 037 documentos; 421 con folio dentro de `contenido`, todos de 2026, en
-- TRES formas incompatibles:
--
--     311  receta            R- + 12 hex de UUID
--      46  receta            R- +  8 hex de UUID   ← generación anterior
--      42  nota_honorarios   NOH-AAAAMMDD-SSSSS
--      22  nota_honorarios   COT-AAAAMMDD-SSSSS
--       0  consentimiento_informado
--
-- Y la colisión ya ocurrió: 6 folios repartidos sobre 15 filas, todos
-- `nota_honorarios`, con `client_id` distintos — documentos distintos
-- compartiendo folio, el más reciente del 2026-08-06.
--
-- La causa dominante NO es el choque de dos emisiones en el mismo segundo, que
-- es lo que se supuso al detectarlo. Es que `generarFolio()` corre en el
-- `useState` inicial de `NotaHonorariosForm.tsx:123` y solo se vuelve a llamar
-- al aplicar una plantilla (:189): el formulario NO lo regenera después de
-- guardar, así que dos honorarios emitidos sin recargar salen con el mismo
-- número. El grupo de cuatro del 2026-04-16 es eso. El choque por segundo
-- también es posible, pero es el caso raro.
--
-- ── EL FOLIO LO PONE LA BASE AL INSERTAR, NO EL CLIENTE AL PEDIRLO ──────────
--
-- Este archivo cambió de diseño respecto a su primera versión, y el cambio es
-- la consulta 9. Antes, el generador se exponía como RPC a `authenticated` y el
-- formulario iba a pedirle un folio antes de guardar. Eso tenía dos defectos
-- que se anulaban entre sí con el argumento de la consulta 2:
--
--   1. UNA LLAMADA RPC CONFIRMA EN SU PROPIA TRANSACCIÓN. El folio se
--      commitea en la transacción A y el documento se inserta en la B. Si B
--      falla —policy, CHECK, red, el médico cierra el formulario—, el número
--      queda quemado exactamente igual que un `nextval()`. Es decir: el
--      beneficio por el que se descartó la secuencia (punto 1 de la consulta 2)
--      NO se estaba obteniendo. Se pagaba la serialización de la tabla sin
--      cobrar lo único que la tabla da a cambio.
--   2. UNA COLUMNA NO ESTÁ PROTEGIDA POR LA RLS. Las policies de `documentos`
--      son de FILA; `authenticated` tiene INSERT/UPDATE a nivel TABLA. Con la
--      columna suelta, cualquiera podía escribir su propio `folio` vía
--      PostgREST: saltarse el generador, reclamar por adelantado un rango del
--      índice único —que es GLOBAL— y con eso hacer fallar la emisión de TODAS
--      las clínicas, o cambiar el folio de un papel ya entregado.
--
-- Los dos se cierran con la misma pieza: el folio se asigna en un trigger
-- BEFORE INSERT, dentro de la misma transacción que la fila. Si la fila no
-- entra, el número vuelve. Y como el trigger rechaza cualquier folio que venga
-- del cliente, no hay nada que reclamar por adelantado ni que mutar después.
--
-- Consecuencia directa: el generador YA NO SE EXPONE a `authenticated` (ver la
-- consulta 10). El único camino al contador es insertar un documento.
--
-- ⚠️ ESTADO TRANSITORIO HASTA EL PASO 4 — LEER ANTES DE APLICAR.
-- Desde el momento en que este archivo entra, toda receta, honorarios,
-- cotización y consentimiento NUEVO sale con DOS folios: el de la columna, que
-- lo pone el trigger (`RX-2026-0001`), y el de `contenido`, que lo sigue
-- poniendo el formulario en el navegador (`R-a3f9b2c1d4e5`) y es el que se
-- imprime en el PDF. No se estorban —viven en sitios distintos— pero durante
-- esa ventana el buscador del CommandPalette encuentra documentos por un folio
-- que no está en ningún papel. Es el Paso 4 el que quita el generador del
-- navegador y pone la columna en el PDF; hasta entonces la ventana está
-- abierta a propósito y es visible.
--
-- ── NADA DE ESTO MIGRA LOS 421 FOLIOS VIEJOS ────────────────────────────────
--
-- La columna nace vacía para todo lo existente. Los folios viejos siguen donde
-- están, dentro de `contenido`, y las tres formas viejas NO caben en el CHECK
-- de la consulta 5 — a propósito: mezclarlas con los nuevos en la misma columna
-- haría que un `RX-2026-0042` y un `R-a3f9…` significaran lo mismo, y no lo
-- significan. Qué se hace con ellos se decide con los números delante y en su
-- propio sub-paso.
--
-- El trigger de la consulta 9 asigna folio SOLO en INSERT, nunca en UPDATE,
-- justo para que ninguna edición posterior de una fila vieja le invente uno.
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- BLOQUE A · Consulta 1 de 11 — PRE-FLIGHT
-- ════════════════════════════════════════════════════════════════════════════
-- No cambia nada. Aborta si el terreno no es el que este archivo supone.
DO $$
DECLARE
  v_tipo_contenido text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documentos' AND column_name = 'folio'
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: public.documentos.folio ya existe';
  END IF;

  IF to_regclass('public.folios_contador') IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: public.folios_contador ya existe';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.documentos'::regclass
      AND tgname = 'trg_asignar_folio_documento'
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: el trigger trg_asignar_folio_documento ya existe';
  END IF;

  IF to_regprocedure('public.get_clinica_id()') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: falta public.get_clinica_id()';
  END IF;

  IF to_regprocedure('public.clinica_tiene_acceso()') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: falta public.clinica_tiene_acceso()';
  END IF;

  -- El trigger de la consulta 9 lee `contenido->>'tipo_doc'`. Si la columna no
  -- fuera json/jsonb, ese operador revienta en runtime, en el camino de
  -- emisión y no aquí. Se comprueba ahora.
  SELECT data_type INTO v_tipo_contenido
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'documentos' AND column_name = 'contenido';

  -- El IS NULL va explícito: sin él, una columna `contenido` inexistente daría
  -- NULL, y `NULL NOT IN (...)` es NULL, que no dispara el IF. Pasaría de largo.
  IF v_tipo_contenido IS NULL OR v_tipo_contenido NOT IN ('json', 'jsonb') THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: documentos.contenido es [%], se esperaba json o jsonb',
      COALESCE(v_tipo_contenido, 'inexistente');
  END IF;

  RAISE NOTICE 'PRE-FLIGHT OK';
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- BLOQUE B · Consultas 2 y 3 de 11 — La tabla de contadores y su blindaje
-- ════════════════════════════════════════════════════════════════════════════
-- Van juntas y son inseparables: entre una y otra, la tabla existe con los
-- grants por defecto que Supabase otorga a `anon` y `authenticated` sobre toda
-- tabla nueva del schema `public`, y sin RLS. Ese estado no debe existir ni un
-- segundo.
BEGIN;

-- ── Consulta 2 de 11 · La tabla de contadores ───────────────────────────────
--
-- POR QUÉ UNA TABLA DE CONTADORES Y NO UNA SECUENCIA POR TIPO Y AÑO
--
-- Las dos resuelven la concurrencia. Se elige la tabla por cuatro razones, en
-- orden de peso:
--
-- 1. UNA SECUENCIA NO SE DESHACE. `nextval()` es deliberadamente no
--    transaccional: si la emisión falla después de pedir el número — el PDF no
--    se genera, el INSERT viola una policy—, ese número queda quemado y la
--    serie sale con un hueco. Un correlativo con huecos invita justo a la
--    pregunta que un correlativo existe para no provocar: «¿dónde está el
--    RX-2026-0043?». En Honorarios esa pregunta tiene sabor fiscal. Con la
--    tabla, el incremento vive dentro de la transacción y un fallo lo devuelve.
--
--    ⚠️ ESTA RAZÓN SOLO SE COBRA SI EL NÚMERO Y LA FILA COMPARTEN TRANSACCIÓN.
--    Es exactamente por eso que el folio lo pone el trigger de la consulta 9 y
--    no una llamada RPC desde el navegador. Ver la cabecera del archivo.
--
-- 2. OBLIGARÍA A HACER DDL EN CALIENTE. Una secuencia por tipo y año significa
--    crear cuatro secuencias nuevas cada 1 de enero. Hacerlo dentro del
--    generador es `CREATE SEQUENCE` en el camino de emisión, con los permisos y
--    los locks de catálogo que eso arrastra; hacerlo a mano es una tarea anual
--    que nadie va a recordar y que rompe el generador el día que se olvida.
--    Aquí, un año nuevo es una fila nueva que aparece sola.
--
-- 3. SE PUEDE MIRAR. `SELECT * FROM folios_contador` dice exactamente por dónde
--    va cada serie. El `last_value` de una secuencia miente bajo concurrencia y
--    no es comparable entre sesiones.
--
-- 4. LA LLAVE ES UNA COLUMNA, NO UN NOMBRE. Si algún día el correlativo pasa a
--    ser por clínica (ver la nota de la consulta 6), es una columna más en esta
--    llave primaria. Con secuencias sería una secuencia por clínica, tipo y año
--    — cientos de objetos de catálogo creados en caliente.
--
-- LO QUE SE PAGA, dicho sin adornos: esta tabla SERIALIZA las emisiones
-- concurrentes de la misma serie mientras dure la transacción que pidió el
-- número, cosa que una secuencia no hace. Con 421 folios en ocho meses es
-- irrelevante. La regla operativa que se deriva: NUNCA meter una llamada de red
-- dentro de la transacción que emite. Hoy no la hay — el trigger corre dentro
-- del INSERT y nada más.
CREATE TABLE public.folios_contador (
  -- La CLASE de folio, que no es `documentos.tipo`: Honorarios y Cotización son
  -- el mismo `tipo` ('nota_honorarios') y llevan prefijos distintos, decididos
  -- por `contenido->>'tipo_doc'`. Si esto se llamara `tipo` alguien lo cruzaría
  -- con la columna de documentos y las dos series se fundirían en una.
  clase   text     NOT NULL,
  anio    smallint NOT NULL,
  -- Último número entregado. 0 significa «serie abierta, nada entregado aún»,
  -- estado que no llega a existir: la primera emisión inserta la fila con 1.
  ultimo  integer  NOT NULL DEFAULT 0,
  CONSTRAINT folios_contador_pkey PRIMARY KEY (clase, anio),
  CONSTRAINT folios_contador_clase_check CHECK (clase IN ('rx', 'noh', 'cot', 'ci')),
  CONSTRAINT folios_contador_ultimo_check CHECK (ultimo >= 0)
);

COMMENT ON TABLE public.folios_contador IS
  'Correlativo por clase de folio y año. Se escribe SOLO desde public.generar_folio(), '
  'que es SECURITY DEFINER y propiedad de postgres. RLS activada con CERO policies: '
  'el bypass del PROPIETARIO es lo que deja pasar al generador. '
  'NUNCA añadir FORCE ROW LEVEL SECURITY a esta tabla: quita esa exención y rompe '
  'la emisión de folios por completo.';


-- ── Consulta 3 de 11 · RLS de la tabla de contadores ────────────────────────
-- RLS activada y CERO policies: `anon` y `authenticated` no ven ninguna fila ni
-- pueden escribir. Sin esto, cualquier autenticado podría leer el volumen de
-- emisión de toda la plataforma, o escribir el contador y forzar duplicados.
--
-- El REVOKE no es redundante con la RLS: los `ALTER DEFAULT PRIVILEGES` de
-- Supabase otorgan sobre toda tabla nueva del schema `public` en el momento del
-- CREATE, así que hay que quitarlos explícitamente. Se revoca también de
-- PUBLIC, que cubre cualquier rol futuro que no sea ninguno de esos dos.
--
-- QUIÉN SIGUE LLEGANDO A ESTA TABLA, para que nadie lo lea al revés:
--   · `postgres` (propietario) — bypass por exención de propietario. Es el
--     camino del generador y es el motivo de que esto funcione.
--   · `service_role` — tiene BYPASSRLS y conserva sus grants. Es decir: TODA
--     ruta del servidor que use `createAdminClient()` puede leer y escribir
--     este contador. Son ~10 hoy. No es un defecto, es el nivel de confianza
--     que ya tiene esa llave, pero no es cierto que «nadie llegue desde la app».
ALTER TABLE public.folios_contador ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.folios_contador FROM PUBLIC, anon, authenticated;

COMMIT;


-- ════════════════════════════════════════════════════════════════════════════
-- BLOQUE C · Consultas 4, 5 y 6 de 11 — La columna, su forma y su unicidad
-- ════════════════════════════════════════════════════════════════════════════
-- Van juntas porque los estados intermedios son columna-sin-forma y
-- columna-sin-unicidad, y PostgREST expone la columna en cuanto recargue.
BEGIN;

-- Las tres tocan `public.documentos`. Con 1 037 filas el trabajo es de
-- milisegundos; el riesgo no es la duración sino la COLA: si hay una
-- transacción abierta por delante, el AccessExclusive espera y todo lo que
-- llegue detrás se encola tras él. Con esto, el bloque falla en 3 s y la app
-- no se entera.
SET LOCAL lock_timeout = '3s';

-- ── Consulta 4 de 11 · La columna ───────────────────────────────────────────
-- Nullable porque cinco de los ocho formatos no llevan folio (Laboratorio,
-- Imagenología, Suplementación, Internamiento y Escrito Médico). Un folio solo
-- sirve donde alguien de fuera lo cita, y esos cinco no salen a esa circulación.
--
-- Sin DEFAULT, a propósito: es lo que hace que las 1 037 filas existentes
-- queden en NULL y que la consulta 5 no pueda fallar contra ninguna de ellas.
ALTER TABLE public.documentos
  ADD COLUMN folio text;


-- ── Consulta 5 de 11 · La forma del folio, como constraint ──────────────────
-- El CHECK es lo que impide que las tres formas viejas se cuelen en la columna
-- nueva y que un noveno formato empiece a poner folios sin decidirlo: añadir un
-- prefijo obliga a tocar este constraint, el CASE del generador (consulta 7),
-- el CASE del trigger (consulta 8) y `src/lib/documentos/folio.ts`. Esa
-- fricción es deliberada; que sean cuatro sitios y no dos, no.
--
-- `{4,}` y no `{4}`: el relleno con ceros es a cuatro dígitos, pero la serie
-- 10 000 no se trunca, se ensancha. Un correlativo que se rompe al llegar a un
-- número redondo no es un correlativo. (El generador de la consulta 7 tiene que
-- cumplir esa promesa por su cuenta — ver la nota del `lpad` allí.)
--
-- Nota sobre el escaneo: ADD CONSTRAINT valida las 1 037 filas existentes. Todas
-- pasan por la primera rama, porque la consulta 4 las dejó en NULL. Si alguien
-- reordena estas dos consultas o le pone un DEFAULT a la columna, esto deja de
-- ser cierto.
ALTER TABLE public.documentos
  ADD CONSTRAINT documentos_folio_formato_check
  CHECK (folio IS NULL OR folio ~ '^(RX|NOH|COT|CI)-[0-9]{4}-[0-9]{4,}$');


-- ── Consulta 6 de 11 · El índice ────────────────────────────────────────────
-- Parcial porque los cinco formatos sin folio dejarían 5/8 del índice en NULL.
-- Hace dos trabajos con un solo objeto: garantiza que no haya dos documentos
-- con el mismo folio —la red de seguridad bajo el contador— y resuelve la
-- búsqueda por igualdad del commit 2.
--
-- Se construye con CERO entradas: la columna acaba de nacer vacía.
--
-- ⚠️ ESTE ÍNDICE ES LO QUE HACE QUE EL CORRELATIVO SEA GLOBAL, NO POR CLÍNICA.
--
-- `public.documentos` NO tiene `clinica_id` — cada policy deriva el tenant por
-- `pacientes`—, así que un índice único por clínica no es expresable sin
-- desnormalizar la columna, hacer backfill de 1 037 filas y mantenerla con un
-- trigger. Eso es un sub-paso propio, no una nota al pie de este.
--
-- Lo que se pierde por ser global: los folios de un médico no son contiguos
-- —salta de RX-2026-0042 a RX-2026-0117 si otra clínica emitió 75 en medio— y
-- ese salto revela el volumen de emisión de la plataforma entera a cualquier
-- cliente que sepa restar. Con una clínica productiva hoy es teórico; con
-- varias, no.
--
-- Lo que un índice único GLOBAL habría hecho peligroso, y ya no: si el cliente
-- pudiera escribir la columna, un usuario podría reclamar por adelantado un
-- rango entero y dejar sin emitir a todas las demás clínicas. No puede: el
-- trigger de la consulta 9 rechaza todo folio que venga del cliente.
--
-- 🔴 LO QUE SÍ SIGUE ABIERTO, Y ES LO ÚNICO PELIGROSO DE QUE EL FOLIO SEA
--    CORRELATIVO Y ADIVINABLE — LEER ANTES DE TOCAR /r/[folio]:
--
-- La separación «folio público, token secreto y revocable» está decidida en
-- DECISIONES §6 y NO ESTÁ IMPLEMENTADA EN EL CÓDIGO. Hoy, `/api/r/[folio]`
-- (src/app/api/r/[folio]/route.ts:13) y `/r/[folio]`
-- (src/app/r/[folio]/page.tsx:35) son endpoints PÚBLICOS, SIN AUTENTICACIÓN,
-- que toman un folio de la URL, lo resuelven con el cliente SERVICE-ROLE
-- —saltándose toda la RLS— y devuelven el `contenido` completo de la receta:
-- paciente, medicamentos, médico. La única defensa es
-- `checkIpRateLimit(ip, 'verificar-receta', 30)`: 30 peticiones por IP y hora.
--
-- Eso es tolerable HOY, y solo por una razón: esos dos endpoints filtran por
-- `contenido->>'folio'`, el folio VIEJO, que son 8-12 hex de un UUID y no se
-- enumera. Esta migración no los toca y no abre nada.
--
-- ⛔ Pero el día que alguien apunte `/r/[folio]` o `/api/r/[folio]` a la COLUMNA
--    nueva, un correlativo global de cuatro dígitos pasa a ser la única llave de
--    lectura no autenticada de contenido clínico. RX-2026-0001..0500 son 500
--    peticiones: ~17 IPs al límite actual. NO SE HACE ESE CAMBIO hasta que el
--    token del QR exista de verdad como campo aparte, secreto y revocable. El
--    QR y su token van en su propio sub-paso; este aviso es lo que impide que
--    se haga por descuido mientras tanto.
--
-- El día que haya que pasar a por-clínica: `clinica_id` en documentos, una
-- columna más en la PK de `folios_contador`, y este índice pasa a
-- `(clinica_id, folio)`. El generador no cambia de forma.
CREATE UNIQUE INDEX idx_documentos_folio
  ON public.documentos (folio)
  WHERE folio IS NOT NULL;

COMMIT;


-- ════════════════════════════════════════════════════════════════════════════
-- BLOQUE D · Consultas 7 a 11 de 11 — Generador, trigger, permisos y reload
-- ════════════════════════════════════════════════════════════════════════════
-- Van juntas: una función sin su trigger, un trigger sin su función, o un
-- generador sin su REVOKE son todos estados que no deben quedar sobre la mesa.
BEGIN;

-- La consulta 9 toma ShareRowExclusive sobre `public.documentos` para colgar el
-- trigger: bloquea escrituras mientras dura. Mismo argumento que el bloque C.
SET LOCAL lock_timeout = '3s';

-- ── Consulta 7 de 11 · El generador ─────────────────────────────────────────
-- UNA función para los tres formatos, cuatro prefijos. El correlativo se
-- resuelve AQUÍ y no en el navegador: el reloj del cliente es exactamente lo
-- que hoy produce los folios repetidos de Honorarios.
--
-- Su único invocador legítimo es el trigger de la consulta 9. No se expone como
-- RPC (consulta 10).
CREATE OR REPLACE FUNCTION public.generar_folio(p_clase text)
  RETURNS text
  LANGUAGE plpgsql
  -- VOLATILE (el defecto), que es lo obligatorio: una función que hace INSERT
  -- no puede declararse STABLE — Postgres rechaza la escritura en runtime.
  SECURITY DEFINER
  -- `pg_temp` AL FINAL es la parte que importa: si se omitiera, Postgres busca
  -- el schema temporal PRIMERO para relaciones, y un `CREATE TEMP TABLE
  -- folios_contador` de cualquier sesión eclipsaría la tabla real. Nombrado al
  -- final, `public` gana. Misma cadena que los 6 helpers de la etapa 5.C.
  SET search_path = public, pg_temp
AS $$
DECLARE
  v_prefijo text;
  v_anio    smallint;
  v_n       integer;
BEGIN
  -- El único sitio del sistema donde clase → prefijo. Cotización y Honorarios
  -- comparten `documentos.tipo` y no comparten serie.
  v_prefijo := CASE p_clase
    WHEN 'rx'  THEN 'RX'   -- Receta
    WHEN 'noh' THEN 'NOH'  -- Nota de Honorarios
    WHEN 'cot' THEN 'COT'  -- Cotización
    WHEN 'ci'  THEN 'CI'   -- Consentimiento Informado
  END;

  IF v_prefijo IS NULL THEN
    RAISE EXCEPTION 'clase de folio desconocida'
      USING HINT = 'las cuatro son rx, noh, cot, ci';
  END IF;

  -- Las dos puertas del sistema, en positivo, ANTES de tocar el contador: quien
  -- no podría guardar el documento tampoco gasta su folio.
  -- `clinica_tiene_acceso()` es el MISMO gate que decide quién puede insertar
  -- en `documentos` (documentos_gates_insert).
  IF public.get_clinica_id() IS NULL THEN
    RAISE EXCEPTION 'sin clínica activa: no se emite folio';
  END IF;

  IF NOT public.clinica_tiene_acceso() THEN
    RAISE EXCEPTION 'la clínica no tiene acceso de escritura: no se emite folio';
  END IF;

  -- El año es el de MÉXICO, no el de UTC. `now()` es timestamptz y en UTC: una
  -- receta emitida el 31 de diciembre a las 19:00 en Ciudad de México ya es
  -- 1 de enero en UTC, y abriría la serie del año siguiente con seis horas de
  -- adelanto — un RX-2027-0001 fechado en 2026. La zona va escrita porque es
  -- una propiedad del producto (NOM-004, expediente mexicano), no del servidor.
  -- Efecto colateral asumido: durante esas ~6 horas cada 31 de diciembre, el
  -- año del folio y el año de `created_at` en UTC no coinciden.
  v_anio := EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Mexico_City'))::smallint;

  -- EL CORAZÓN: un solo statement, atómico. Dos emisiones concurrentes de la
  -- misma serie chocan en la llave primaria; la segunda espera al lock de fila
  -- de la primera y, al confirmar aquélla, el DO UPDATE RE-LEE la versión
  -- confirmada más reciente antes de sumar. No hay ventana entre leer y
  -- escribir porque no hay lectura previa. Es lo que hace imposible el número
  -- repetido.
  --
  -- ASUME READ COMMITTED, que es el defecto de PostgREST y de Supabase. Bajo
  -- REPEATABLE READ o SERIALIZABLE este statement no espera: lanza
  -- `40001 could not serialize access` y el llamante tiene que reintentar.
  -- Sigue sin producir duplicados, pero deja de ser transparente.
  INSERT INTO public.folios_contador AS c (clase, anio, ultimo)
  VALUES (p_clase, v_anio, 1)
  ON CONFLICT (clase, anio) DO UPDATE
    SET ultimo = c.ultimo + 1
  RETURNING c.ultimo INTO v_n;

  -- ⚠️ EL CASE NO ES DECORATIVO. `lpad` de Postgres TRUNCA POR LA DERECHA si la
  -- cadena ya es más larga que el ancho pedido: `lpad('10000', 4, '0')` no
  -- devuelve '10000', devuelve '1000'. Con `lpad` a secas, la emisión número
  -- 10 000 de una clase saldría como RX-2026-1000, chocaría contra el folio ya
  -- emitido para el número 1 000, y a partir de ahí TODA emisión de esa clase y
  -- año fallaría de forma permanente contra idx_documentos_folio. Es justo lo
  -- que el `{4,}` del CHECK de la consulta 5 dice que no puede pasar.
  -- (El cliente ya lo hace bien: `padStart` de JS no trunca — folio.ts:76.)
  RETURN v_prefijo || '-' || v_anio::text || '-' ||
         CASE WHEN v_n < 10000 THEN lpad(v_n::text, 4, '0') ELSE v_n::text END;
END $$;

COMMENT ON FUNCTION public.generar_folio(text) IS
  'Entrega el siguiente correlativo de una clase de folio (rx/noh/cot/ci) para el año '
  'de México. Su único invocador legítimo es el trigger trg_asignar_folio_documento; '
  'NO se expone como RPC. Exponerla a authenticated reabre dos cosas: huecos '
  'permanentes en la serie (cada llamada RPC confirma en su propia transacción) y '
  'lectura directa del volumen de emisión de toda la plataforma, porque la serie es global.';


-- ── Consulta 8 de 11 · Quién pone el folio ──────────────────────────────────
-- El folio se asigna DENTRO de la transacción que inserta la fila. Eso es lo
-- que convierte el argumento 1 de la consulta 2 en algo real: si el INSERT
-- falla —una policy, el CHECK, cualquier cosa— el incremento del contador se
-- va con él y el número vuelve a la serie.
--
-- Sigue el patrón de `proteger_columnas_sensibles_profiles`
-- (20260602_sec_proteger_columnas_sensibles_profiles.sql:53): exenta a quien no
-- trae JWT y aplica a `authenticated`.
--
-- DESVIACIÓN RESPECTO A ESE PATRÓN, y por qué: aquélla es SECURITY INVOKER,
-- ésta es SECURITY DEFINER. Tiene que serlo porque llama a `generar_folio()`,
-- que ya no tiene EXECUTE para `authenticated` (consulta 10). Siendo DEFINER y
-- propiedad de postgres, el llamante efectivo dentro del cuerpo es el
-- propietario de la función, que sí puede. `auth.uid()` no se ve afectado: lee
-- un GUC de sesión, no el usuario efectivo, así que la discriminación de abajo
-- sigue siendo correcta.
CREATE OR REPLACE FUNCTION public.asignar_folio_documento()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
DECLARE
  v_clase text;
BEGIN
  -- Sin JWT (service_role, migraciones, backfills) → exento por completo. Es la
  -- única puerta que queda para escribir un folio a mano, y existe a propósito:
  -- una reparación futura de la serie no debería necesitar tirar el trigger.
  -- Sigue acotada por el CHECK de forma y por el índice único.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- UPDATE: el folio de un documento emitido es inmutable. `IS DISTINCT FROM`
  -- y no `<>` para que un UPDATE que no lo toca —el de `pdf_url` en
  -- ModalDocumentos.tsx:277, por ejemplo— pase sin ruido.
  -- Aquí NUNCA se asigna: si se asignara, cualquier edición de una de las 1 037
  -- filas viejas le inventaría un folio que no está en su papel.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.folio IS DISTINCT FROM OLD.folio THEN
      RAISE EXCEPTION 'El folio de un documento emitido es inmutable';
    END IF;
    RETURN NEW;
  END IF;

  -- INSERT: el cliente no propone folio. Si lo propone, se rechaza en vez de
  -- pisarlo en silencio — un formulario que cree que puso un folio y no lo puso
  -- es peor que uno que falla.
  IF NEW.folio IS NOT NULL THEN
    RAISE EXCEPTION 'El folio lo asigna la base, no el cliente';
  END IF;

  -- Tres de los ocho formatos llevan folio. Los otros cinco
  -- (solicitud_lab, solicitud_imagen, plan_suplementacion,
  -- solicitud_internamiento, escrito_medico) y las subidas de archivo
  -- (resultado_laboratorio) caen al ELSE implícito y se quedan en NULL.
  --
  -- El discriminador de Honorarios/Cotización es `contenido->>'tipo_doc'`
  -- (snake_case), que es lo que NotaHonorariosForm.tsx:347 mete realmente en la
  -- fila. Se lee también `tipoDoc` por si alguna ruta antigua u offline usó esa
  -- forma. Sin discriminador reconocible → 'noh', que es la misma decisión que
  -- toma el cliente en NotaHonorariosForm.tsx:447.
  v_clase := CASE NEW.tipo
    WHEN 'receta'                  THEN 'rx'
    WHEN 'consentimiento_informado' THEN 'ci'
    WHEN 'nota_honorarios'         THEN
      CASE COALESCE(NEW.contenido->>'tipo_doc', NEW.contenido->>'tipoDoc')
        WHEN 'cotizacion' THEN 'cot'
        ELSE 'noh'
      END
  END;

  IF v_clase IS NOT NULL THEN
    NEW.folio := public.generar_folio(v_clase);
  END IF;

  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.asignar_folio_documento() IS
  'BEFORE INSERT OR UPDATE en public.documentos. Asigna el folio en la MISMA '
  'transacción que la fila (INSERT) y lo declara inmutable (UPDATE). Rechaza todo '
  'folio provisto por un cliente autenticado; exenta a service_role. Es lo que '
  'protege la columna: las policies de documentos son de FILA y authenticated tiene '
  'INSERT/UPDATE a nivel TABLA, así que sin este trigger la columna sería escribible '
  'directamente vía PostgREST.';


-- ── Consulta 9 de 11 · El trigger ───────────────────────────────────────────
-- BEFORE, no AFTER: tiene que poder modificar NEW.
--
-- Orden de evaluación, que es lo que hace que esto encaje: Postgres corre los
-- triggers BEFORE ROW primero y evalúa DESPUÉS el CHECK de la consulta 5 y las
-- policies RLS de `documentos` sobre la fila ya modificada. Así que el folio se
-- pone antes de que el gate decida, y si el gate rechaza, todo se va junto.
--
-- `INSERT OR UPDATE` y no `UPDATE OF folio`: las dos formas serían correctas
-- —una columna que no está en el SET no puede cambiar— pero la primera se lee
-- sin tener que razonarlo.
CREATE TRIGGER trg_asignar_folio_documento
  BEFORE INSERT OR UPDATE ON public.documentos
  FOR EACH ROW
  EXECUTE FUNCTION public.asignar_folio_documento();


-- ── Consulta 10 de 11 · Permisos del generador ──────────────────────────────
-- SECURITY DEFINER sin REVOKE es una puerta abierta: por defecto, EXECUTE lo
-- tiene PUBLIC, que aquí incluye `anon`.
--
-- Y NO SE VUELVE A OTORGAR A NADIE. Con el trigger de la consulta 9 puesto,
-- nadie necesita llamarla: el camino al contador es insertar un documento. El
-- propietario (`postgres`) conserva su EXECUTE de forma implícita —REVOKE FROM
-- PUBLIC no toca al dueño— y es por ahí por donde entra el trigger, que corre
-- como él.
--
-- Se revoca también de `service_role`. Si algún día una herramienta de
-- reparación de la serie necesitara llamarla desde el servidor, el GRANT se
-- añade entonces y de forma explícita; lo que no se hace es dejarlo puesto por
-- si acaso.
REVOKE ALL ON FUNCTION public.generar_folio(text)
  FROM PUBLIC, anon, authenticated, service_role;


-- ── Consulta 11 de 11 ───────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

COMMIT;


-- ============================================================================
-- VERIFICACIÓN — después de aplicar. No cambia nada.
-- ============================================================================
--
-- 1) DUEÑOS Y FLAGS. Los dos objetos tienen que ser propiedad de `postgres`, o
--    el SECURITY DEFINER no alcanza a leer `folios_contador` con RLS activada.
--    Y `relforcerowsecurity` tiene que ser FALSE: es la exención de propietario
--    lo que deja pasar al generador, y FORCE ROW LEVEL SECURITY la quita.
--
--      SELECT 'tabla'   AS objeto, relname::text, relowner::regrole::text AS owner,
--             relrowsecurity AS a, relforcerowsecurity AS b
--        FROM pg_class WHERE relname = 'folios_contador'
--      UNION ALL
--      SELECT 'generador', proname::text, proowner::regrole::text,
--             prosecdef, provolatile = 'v'
--        FROM pg_proc WHERE proname = 'generar_folio'
--      UNION ALL
--      SELECT 'trigger_fn', proname::text, proowner::regrole::text,
--             prosecdef, provolatile = 'v'
--        FROM pg_proc WHERE proname = 'asignar_folio_documento';
--      -- se espera: owner = postgres en las TRES filas
--      --            tabla      → a = t (RLS on),  b = f (force off)  ← b = t rompe todo
--      --            generador  → a = t (secdef),  b = t (volatile)
--      --            trigger_fn → a = t (secdef),  b = t (volatile)
--
-- 2) EL TRIGGER ESTÁ VIVO:
--
--      SELECT tgname, tgenabled, tgtype
--        FROM pg_trigger
--       WHERE tgrelid = 'public.documentos'::regclass AND NOT tgisinternal;
--      -- se espera: trg_asignar_folio_documento · tgenabled = 'O' (habilitado)
--
-- 3) EL GENERADOR NO ESTÁ EXPUESTO:
--
--      SELECT has_function_privilege('authenticated','public.generar_folio(text)','EXECUTE') AS auth,
--             has_function_privilege('anon','public.generar_folio(text)','EXECUTE')          AS anon,
--             has_function_privilege('service_role','public.generar_folio(text)','EXECUTE')  AS srole;
--      -- se espera: false · false · false
--
-- 4) LA COLUMNA NACIÓ VACÍA:
--
--      SELECT count(*) AS filas, count(folio) AS con_folio FROM public.documentos;
--      -- se espera: con_folio = 0
--
-- 5) SMOKE TEST DE EXTREMO A EXTREMO, EN TRANSACCIÓN REVERTIDA. Es la única
--    prueba que vale, porque `generar_folio()` ya no se puede llamar suelta y
--    porque exige sesión autenticada (las puertas de get_clinica_id() y
--    clinica_tiene_acceso()). Correr desde la app con un usuario real, o
--    simulando el JWT:
--
--      BEGIN;
--        INSERT INTO public.documentos (paciente_id, tipo, contenido, subido_por)
--        VALUES ('<uuid-de-un-paciente-propio>', 'receta', '{}'::jsonb, auth.uid())
--        RETURNING folio;                       -- se espera RX-2026-0001
--
--        -- el cliente no puede proponer folio:
--        INSERT INTO public.documentos (paciente_id, tipo, contenido, subido_por, folio)
--        VALUES ('<uuid>', 'receta', '{}'::jsonb, auth.uid(), 'RX-2026-9999');
--        -- se espera: ERROR «El folio lo asigna la base, no el cliente»
--
--        -- un formato sin folio se queda en NULL:
--        INSERT INTO public.documentos (paciente_id, tipo, contenido, subido_por)
--        VALUES ('<uuid>', 'escrito_medico', '{}'::jsonb, auth.uid())
--        RETURNING folio;                       -- se espera NULL
--
--        -- cotización y honorarios no comparten serie:
--        INSERT INTO public.documentos (paciente_id, tipo, contenido, subido_por)
--        VALUES ('<uuid>', 'nota_honorarios', '{"tipo_doc":"cotizacion"}'::jsonb, auth.uid())
--        RETURNING folio;                       -- se espera COT-2026-0001
--
--        -- el folio emitido es inmutable:
--        UPDATE public.documentos SET folio = 'RX-2026-0002'
--         WHERE folio = 'RX-2026-0001';
--        -- se espera: ERROR «El folio de un documento emitido es inmutable»
--
--        -- un UPDATE que no toca el folio sigue funcionando:
--        UPDATE public.documentos SET pdf_url = 'x' WHERE folio = 'RX-2026-0001';
--        -- se espera: OK
--      ROLLBACK;
--
--    El ROLLBACK devuelve también los números del contador. Eso es, exactamente,
--    la propiedad por la que se eligió una tabla en vez de una secuencia:
--    comprobar después que `folios_contador` quedó vacía es la prueba de que
--    funciona.
--
--      SELECT * FROM public.folios_contador;   -- se espera: 0 filas
--
-- ============================================================================
-- DOWN (rollback) — referencia, no se ejecuta
-- ============================================================================
-- Orden inverso exacto. Cada bloque revierte al suyo.
--
-- ⚠️ El DROP COLUMN del bloque C es DESTRUCTIVO en cuanto exista un solo folio
--    emitido. Antes de correrlo:
--      SELECT count(folio) FROM public.documentos;   -- si no es 0, PARAR.
--
-- -- BLOQUE D
-- BEGIN;
--   DROP TRIGGER IF EXISTS trg_asignar_folio_documento ON public.documentos;
--   DROP FUNCTION IF EXISTS public.asignar_folio_documento();
--   DROP FUNCTION IF EXISTS public.generar_folio(text);
--   NOTIFY pgrst, 'reload schema';
-- COMMIT;
--
-- -- BLOQUE C
-- BEGIN;
--   SET LOCAL lock_timeout = '3s';
--   DROP INDEX IF EXISTS public.idx_documentos_folio;
--   ALTER TABLE public.documentos DROP CONSTRAINT IF EXISTS documentos_folio_formato_check;
--   ALTER TABLE public.documentos DROP COLUMN IF EXISTS folio;   -- ⚠️ destructivo
-- COMMIT;
--
-- -- BLOQUE B
-- BEGIN;
--   DROP TABLE IF EXISTS public.folios_contador;
-- COMMIT;
--
-- -- BLOQUE A no cambió nada: no tiene rollback.
-- ============================================================================
