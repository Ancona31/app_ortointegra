-- ============================================================================
-- PENDIENTE DE APLICAR — la ejecuta Angel a mano, UNA CONSULTA A LA VEZ
-- ============================================================================
-- Sistema de documentos v2 · sub-paso «generador de folio», commit 1 de 2.
--
-- Da al folio las tres cosas que hoy no tiene: una COLUMNA propia (hoy vive
-- dentro del JSON de `contenido`, sin índice, y no es buscable), un CORRELATIVO
-- que no se puede repetir, y UN SOLO generador para los tres formatos que lo
-- llevan — Receta, Honorarios/Cotización y Consentimiento. Los otros cinco no
-- llevan folio, y por eso la columna es nullable.
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
-- Esto importa aquí porque significa que resolver el correlativo en la base
-- **no basta por sí solo**: el formulario tiene que pedir un folio por emisión,
-- no por montaje. Ese cableado es del Paso 4 y no entra en este archivo.
--
-- ── NADA DE ESTO MIGRA LOS 421 FOLIOS VIEJOS ────────────────────────────────
--
-- La columna nace vacía y se queda vacía. Los folios existentes siguen donde
-- están, dentro de `contenido`, y las tres formas viejas NO caben en el CHECK
-- de la consulta 5 — a propósito: mezclarlas con los nuevos en la misma columna
-- haría que un `RX-2026-0042` y un `R-a3f9…` significaran lo mismo, y no lo
-- significan. Qué se hace con ellos se decide con los números delante y en su
-- propio sub-paso.
-- ============================================================================


-- ── Consulta 1 de 9 · PRE-FLIGHT ────────────────────────────────────────────
-- No cambia nada. Aborta si el terreno no es el que este archivo supone.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documentos' AND column_name = 'folio'
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: public.documentos.folio ya existe';
  END IF;

  IF to_regprocedure('public.get_clinica_id()') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: falta public.get_clinica_id()';
  END IF;

  IF to_regprocedure('public.clinica_tiene_acceso()') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: falta public.clinica_tiene_acceso()';
  END IF;

  RAISE NOTICE 'PRE-FLIGHT OK';
END $$;


-- ── Consulta 2 de 9 · La tabla de contadores ────────────────────────────────
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
-- irrelevante, y la RPC de la consulta 6 es una transacción de microsegundos.
-- Si algún día dejara de serlo, el arreglo es acortar esa transacción, no
-- cambiar de mecanismo.
CREATE TABLE IF NOT EXISTS public.folios_contador (
  -- La CLASE de folio, que no es `documentos.tipo`: Honorarios y Cotización son
  -- el mismo `tipo` ('nota_honorarios') y llevan prefijos distintos, decididos
  -- por `contenido.tipoDoc`. Si esto se llamara `tipo` alguien lo cruzaría con
  -- la columna de documentos y las dos series se fundirían en una.
  clase   text     NOT NULL,
  anio    smallint NOT NULL,
  -- Último número entregado. 0 significa «serie abierta, nada entregado aún»,
  -- estado que no llega a existir: la primera emisión inserta la fila con 1.
  ultimo  integer  NOT NULL DEFAULT 0,
  CONSTRAINT folios_contador_pkey PRIMARY KEY (clase, anio),
  CONSTRAINT folios_contador_clase_check CHECK (clase IN ('rx', 'noh', 'cot', 'ci')),
  CONSTRAINT folios_contador_ultimo_check CHECK (ultimo >= 0)
);


-- ── Consulta 3 de 9 · RLS de la tabla de contadores ─────────────────────────
-- RLS activado y CERO policies: nadie llega a esta tabla desde la app. El único
-- camino es el generador de la consulta 6, que es SECURITY DEFINER y por eso la
-- ve. Sin esto, cualquier autenticado podría leer el volumen de emisión de toda
-- la plataforma, o escribir el contador y forzar duplicados.
ALTER TABLE public.folios_contador ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.folios_contador FROM anon, authenticated;


-- ── Consulta 4 de 9 · La columna ────────────────────────────────────────────
-- Nullable porque cinco de los ocho formatos no llevan folio (Laboratorio,
-- Imagenología, Suplementación, Internamiento y Escrito Médico). Un folio solo
-- sirve donde alguien de fuera lo cita, y esos cinco no salen a esa circulación.
ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS folio text;


-- ── Consulta 5 de 9 · La forma del folio, como constraint ───────────────────
-- Postgres no acepta IF NOT EXISTS en ADD CONSTRAINT; si ya existe, esta
-- consulta falla y se ignora sin consecuencias.
--
-- El CHECK es lo que impide que las tres formas viejas se cuelen en la columna
-- nueva y que un noveno formato empiece a poner folios sin decidirlo: añadir un
-- prefijo obliga a tocar este constraint Y el CASE del generador. Esa fricción
-- es deliberada.
--
-- `{4,}` y no `{4}`: el relleno con ceros es a cuatro dígitos, pero la serie
-- 10 000 no se trunca, se ensancha. Un correlativo que se rompe al llegar a un
-- número redondo no es un correlativo.
ALTER TABLE public.documentos
  ADD CONSTRAINT documentos_folio_formato_check
  CHECK (folio IS NULL OR folio ~ '^(RX|NOH|COT|CI)-[0-9]{4}-[0-9]{4,}$');


-- ── Consulta 6 de 9 · El índice ─────────────────────────────────────────────
-- Parcial porque los cinco formatos sin folio dejarían 5/8 del índice en NULL.
-- Hace dos trabajos con un solo objeto: garantiza que no haya dos documentos
-- con el mismo folio —la red de seguridad bajo el contador— y resuelve la
-- búsqueda por igualdad del commit 2.
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
-- Lo que NO se pierde: la enumerabilidad deja de importar. El folio ya no es
-- llave de acceso a nada (DECISIONES §6) — el token del QR es un campo aparte,
-- secreto y revocable—, así que adivinar RX-2026-0043 no abre ninguna puerta.
-- Ese era el defecto grave del folio de Honorarios, y lo cierra la separación
-- folio/token, no el hecho de que el número sea difícil de adivinar.
--
-- El día que haya que pasar a por-clínica: `clinica_id` en documentos, una
-- columna más en la PK de `folios_contador`, y este índice pasa a
-- `(clinica_id, folio)`. El generador no cambia de forma.
CREATE UNIQUE INDEX IF NOT EXISTS idx_documentos_folio
  ON public.documentos (folio)
  WHERE folio IS NOT NULL;


-- ── Consulta 7 de 9 · El generador ──────────────────────────────────────────
-- UNA función para los tres formatos, cuatro prefijos. El correlativo se
-- resuelve AQUÍ y no en el navegador: el reloj del cliente es exactamente lo
-- que hoy produce los folios repetidos de Honorarios.
CREATE OR REPLACE FUNCTION public.generar_folio(p_clase text)
  RETURNS text
  LANGUAGE plpgsql
  -- VOLATILE (el defecto). Marcarla STABLE la haría cachearse dentro de una
  -- misma consulta y dos documentos emitidos en un mismo statement recibirían
  -- el mismo número. Es el defecto que este archivo existe para cerrar.
  SECURITY DEFINER
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
    RAISE EXCEPTION 'clase de folio desconocida: %', p_clase
      USING HINT = 'las cuatro son rx, noh, cot, ci';
  END IF;

  -- Las dos puertas del sistema, en positivo. Sin ellas cualquier autenticado
  -- podría quemar números de una serie que es global, y los huecos que dejara
  -- los vería otra clínica. `clinica_tiene_acceso()` es el MISMO gate que decide
  -- quién puede insertar en `documentos`: quien no podría guardar el documento
  -- tampoco gasta su folio.
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
  v_anio := EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Mexico_City'))::smallint;

  -- EL CORAZÓN: un solo statement, atómico. Dos emisiones concurrentes de la
  -- misma serie chocan en la llave primaria; la segunda espera al lock de fila
  -- de la primera y luego suma sobre el valor ya confirmado. No hay ventana
  -- entre leer y escribir porque no hay lectura previa: no existe un SELECT que
  -- ganar por delante. Es lo que hace imposible el número repetido.
  INSERT INTO public.folios_contador AS c (clase, anio, ultimo)
  VALUES (p_clase, v_anio, 1)
  ON CONFLICT (clase, anio) DO UPDATE
    SET ultimo = c.ultimo + 1
  RETURNING c.ultimo INTO v_n;

  RETURN v_prefijo || '-' || v_anio::text || '-' || lpad(v_n::text, 4, '0');
END $$;


-- ── Consulta 8 de 9 · Permisos del generador ────────────────────────────────
-- SECURITY DEFINER sin REVOKE es una puerta abierta: por defecto, EXECUTE lo
-- tiene PUBLIC, que aquí incluye `anon`. Un anónimo no emite documentos y no
-- gasta números.
REVOKE ALL ON FUNCTION public.generar_folio(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generar_folio(text) TO authenticated;


-- ── Consulta 9 de 9 ─────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- VERIFICACIÓN — después de aplicar. No cambia nada.
-- ============================================================================
-- La función tiene que ser propiedad de `postgres`, o SECURITY DEFINER no
-- alcanza a leer `folios_contador` con RLS activado:
--
--   SELECT proname, proowner::regrole, prosecdef, provolatile
--     FROM pg_proc WHERE proname = 'generar_folio';
--   -- se espera: postgres · prosecdef = t · provolatile = v
--
-- Dos llamadas seguidas tienen que dar números distintos y consecutivos:
--
--   SELECT public.generar_folio('rx'), public.generar_folio('rx');
--   -- se espera: RX-2026-0001 · RX-2026-0002
--
-- Y si se corren para probar, la serie queda arrancada en 2. Para dejarla en
-- cero antes de que exista el primer formato v2 (Paso 4):
--
--   DELETE FROM public.folios_contador WHERE clase = 'rx' AND anio = 2026;
-- ============================================================================
