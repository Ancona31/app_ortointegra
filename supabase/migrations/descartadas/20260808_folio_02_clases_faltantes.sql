-- ============================================================================
-- PENDIENTE DE APLICAR — la ejecuta Angel a mano, EN DOS BLOQUES
-- ============================================================================
-- Sistema de documentos v2 · folio, commit 2 de 2.
--
-- Abre la serie de folios a los CUATRO formatos que faltaban. No cambia ninguna
-- forma, ningún permiso y ningún gate: solo amplía el conjunto de clases.
--
-- ── POR QUÉ ─────────────────────────────────────────────────────────────────
--
-- `20260807_folio_01` se escribió sobre la premisa de que «tres de los ocho
-- formatos llevan folio» y de que los otros cinco «no salen a esa circulación».
-- Contra las láminas aprobadas la premisa es falsa: **siete de los ocho llevan
-- folio.** `SPEC_DISENO_PARTE_B.md` los compone uno por uno, con el riel en el
-- bloque de título y el número repetido en la banda de pie, y observa el prefijo
-- emitido en cada archivo:
--
--   B.1  Solicitud de Laboratorio     riel de folio de 156 pt   `L-`
--   B.2  Solicitud de Imagenología    riel derecho de 190 pt    `I-`
--   B.3  Receta Médica                riel derecho de 210 pt    `P-`
--   B.4  Plan de Suplementación       riel de folio             `S-`
--   B.5  Recibo / Cotización          riel de folio             `Q-` `R-`
--   B.6  Solicitud de Internamiento   riel de folio             `H-`
--   B.7  Consentimiento Informado     riel de folio             `C-`
--   B.8  Escrito Médico               «Folio: no existe en ninguna parte»
--
-- El octavo, Escrito Médico, es **el único sin folio**, y B.8 lo dice dos veces.
-- Ese sigue cayendo al ELSE del trigger y quedándose en NULL.
--
-- ── LOS PREFIJOS DE LAS LÁMINAS NO SON LOS DE ESTA MIGRACIÓN, Y ES CORRECTO ──
--
-- Las láminas emiten `L-7C15A0E4D2B9`: una letra más 8 hex de UUID. Es la
-- GENERACIÓN ANTERIOR del folio —la misma que `20260807_folio_01` describe en su
-- cabecera y que su CHECK excluye a propósito—, no una decisión de diseño. La
-- lámina manda en que el folio EXISTA y en dónde se compone; la FORMA del folio
-- es decisión de producto y la fija `DOCUMENTOS_SPEC.md`.
--
-- Los cuatro prefijos nuevos siguen la convención ya establecida por los cuatro
-- existentes —clase corta en minúscula → prefijo en mayúscula, de 2 a 3 letras—:
--
--   lab → LAB   Solicitud de Laboratorio     (documentos.tipo = 'solicitud_lab')
--   img → IMG   Solicitud de Imagenología    ('solicitud_imagen')
--   sup → SUP   Plan de Suplementación       ('plan_suplementacion')
--   int → INT   Solicitud de Internamiento   ('solicitud_internamiento')
--
-- ⚠️ SI PREFIERES LAS LETRAS DE LA LÁMINA (L, I, S, H) hay que cambiarlas en los
-- tres sitios de este archivo Y en `src/lib/documentos/folio.ts`. No las mezcles:
-- `CI` (Consentimiento) e `I` (Imagenología) se solaparían en el patrón de
-- dictado, que lee el prefijo sin separador obligatorio.
--
-- ── DEPENDENCIA DURA ────────────────────────────────────────────────────────
--
-- **Esto NO se ejecuta antes que `20260807_folio_01_esquema_y_generador.sql`.**
-- Toca objetos que aquel archivo crea: `public.folios_contador`, la columna
-- `public.documentos.folio` con su CHECK, y las dos funciones. Si 01 todavía no
-- se ha corrido, lo correcto es correr 01 entero y después este; o fundir los dos
-- en uno, que también vale mientras 01 siga sin aplicar.
--
-- ── LOS DOS SITIOS DEL CLIENTE QUE ESTE ARCHIVO **NO** TOCA ─────────────────
--
-- 01 dejó escrito que añadir un prefijo obliga a tocar cuatro sitios y que la
-- fricción es deliberada. Dos son SQL y están aquí. Los otros dos son TypeScript
-- y **quedan sin cambiar a propósito**, porque el encargo era escribir el SQL sin
-- aplicarlo y porque tocarlos hoy pondría el buscador a aceptar folios que la
-- base todavía no puede emitir:
--
--   src/lib/documentos/folio.ts    `PREFIJO_POR_CLASE`, `FOLIO_CANONICO`, `DICTADO`
--   src/lib/tests/folio.test.ts    afirma que los prefijos son CUATRO «y solo esos»
--
-- **Los dos van en el MISMO deploy que esta migración.** Si esto se aplica sin
-- ellos, la base emite `LAB-2026-0001` y el buscador de folio no lo encuentra —en
-- silencio, porque una búsqueda vacía se parece a un folio que no existe.
--
-- ── CÓMO SE EJECUTA ─────────────────────────────────────────────────────────
--
--   BLOQUE A = {1, 2}      los dos CHECK, ampliados
--   BLOQUE B = {3, 4, 5}   las dos funciones y el reload
--
-- El orden importa: si las funciones supieran emitir una clase antes de que el
-- CHECK la admitiera, la primera emisión de esa clase fallaría contra el
-- constraint. Al revés no hay ventana: un CHECK más ancho sin generador que lo
-- use no cambia nada.
--
-- Ninguna de las dos amplía una restricción: las dos la RELAJAN, así que ninguna
-- fila existente puede quedar en falso y el escaneo de validación no puede
-- fallar. No hay estado intermedio explotable, que es lo que en 01 obligaba a
-- cuatro bloques y aquí solo pide dos.
-- ============================================================================


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ BLOQUE A — los dos CHECK                                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
BEGIN;

SET LOCAL lock_timeout = '3s';

-- ── Consulta 1 de 5 · Las clases admitidas en el contador ───────────────────
-- De cuatro a ocho. `folios_contador` está vacía o casi —solo tiene filas de
-- series ya emitidas—, así que el escaneo es inmediato.
ALTER TABLE public.folios_contador
  DROP CONSTRAINT folios_contador_clase_check;

ALTER TABLE public.folios_contador
  ADD CONSTRAINT folios_contador_clase_check
  CHECK (clase IN ('rx', 'noh', 'cot', 'ci', 'lab', 'img', 'sup', 'int'));


-- ── Consulta 2 de 5 · La forma del folio en la columna ──────────────────────
-- Mismo patrón, cuatro alternativas más en el grupo de prefijo. El `{4,}` del
-- correlativo no se toca: la serie 10 000 se ensancha, no se trunca.
--
-- Escaneo: valida toda `public.documentos`. Las filas con folio NULL y las que
-- ya llevan uno de los cuatro prefijos viejos pasan; el patrón nuevo es un
-- superconjunto estricto del anterior, así que **ninguna fila que pasaba antes
-- puede fallar ahora**.
ALTER TABLE public.documentos
  DROP CONSTRAINT documentos_folio_formato_check;

ALTER TABLE public.documentos
  ADD CONSTRAINT documentos_folio_formato_check
  CHECK (folio IS NULL OR folio ~ '^(RX|NOH|COT|CI|LAB|IMG|SUP|INT)-[0-9]{4}-[0-9]{4,}$');

COMMIT;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ BLOQUE B — las dos funciones y el reload                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
BEGIN;

SET LOCAL lock_timeout = '3s';

-- ── Consulta 3 de 5 · El generador ──────────────────────────────────────────
-- CREATE OR REPLACE conserva propietario, permisos y `search_path`, así que los
-- REVOKE de la consulta 10 de 01 siguen en pie y NO hay que repetirlos. Lo único
-- que cambia respecto de aquella versión es el CASE de prefijos y el texto de
-- las dos excepciones.
--
-- Todo lo demás se reproduce literal y a propósito —SECURITY DEFINER, el
-- `search_path` con `pg_temp` al final, los dos gates, el año de México, el
-- INSERT … ON CONFLICT atómico y el CASE del `lpad`—: un REPLACE sustituye el
-- cuerpo entero, así que omitir cualquiera de esas piezas la borraría. Si
-- cambias algo aquí, léelo primero en 01, donde está el razonamiento de cada una.
CREATE OR REPLACE FUNCTION public.generar_folio(p_clase text)
  RETURNS text
  LANGUAGE plpgsql
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
    WHEN 'lab' THEN 'LAB'  -- Solicitud de Laboratorio
    WHEN 'img' THEN 'IMG'  -- Solicitud de Imagenología
    WHEN 'sup' THEN 'SUP'  -- Plan de Suplementación
    WHEN 'int' THEN 'INT'  -- Solicitud de Internamiento
  END;

  IF v_prefijo IS NULL THEN
    RAISE EXCEPTION 'clase de folio desconocida'
      USING HINT = 'las ocho son rx, noh, cot, ci, lab, img, sup, int';
  END IF;

  -- Las dos puertas del sistema, en positivo, ANTES de tocar el contador: quien
  -- no podría guardar el documento tampoco gasta su folio.
  IF public.get_clinica_id() IS NULL THEN
    RAISE EXCEPTION 'sin clínica activa: no se emite folio';
  END IF;

  IF NOT public.clinica_tiene_acceso() THEN
    RAISE EXCEPTION 'la clínica no tiene acceso de escritura: no se emite folio';
  END IF;

  -- El año es el de MÉXICO, no el de UTC. Ver la nota larga en 01.
  v_anio := EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Mexico_City'))::smallint;

  -- Un solo statement, atómico. Sin ventana entre leer y escribir.
  INSERT INTO public.folios_contador AS c (clase, anio, ultimo)
  VALUES (p_clase, v_anio, 1)
  ON CONFLICT (clase, anio) DO UPDATE
    SET ultimo = c.ultimo + 1
  RETURNING c.ultimo INTO v_n;

  -- El CASE no es decorativo: `lpad` TRUNCA POR LA DERECHA. Ver la nota en 01.
  RETURN v_prefijo || '-' || v_anio::text || '-' ||
         CASE WHEN v_n < 10000 THEN lpad(v_n::text, 4, '0') ELSE v_n::text END;
END $$;

COMMENT ON FUNCTION public.generar_folio(text) IS
  'Entrega el siguiente correlativo de una clase de folio '
  '(rx/noh/cot/ci/lab/img/sup/int) para el año de México. Su único invocador '
  'legítimo es el trigger trg_asignar_folio_documento; NO se expone como RPC. '
  'Exponerla a authenticated reabre dos cosas: huecos permanentes en la serie '
  '(cada llamada RPC confirma en su propia transacción) y lectura directa del '
  'volumen de emisión de toda la plataforma, porque la serie es global.';


-- ── Consulta 4 de 5 · Quién pone el folio ───────────────────────────────────
-- Solo cambia el CASE de `documentos.tipo` → clase. El resto se reproduce
-- literal por la misma razón que en la consulta 3.
--
-- **Escrito Médico y las subidas de archivo siguen cayendo al ELSE implícito** y
-- quedándose en NULL: `escrito_medico` es el único de los ocho formatos sin
-- folio (B.8), y `resultado_laboratorio` no es un formato, es un PDF que sube el
-- paciente.
CREATE OR REPLACE FUNCTION public.asignar_folio_documento()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
DECLARE
  v_clase text;
BEGIN
  -- Sin JWT (service_role, migraciones, backfills) → exento por completo.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- UPDATE: el folio de un documento emitido es inmutable.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.folio IS DISTINCT FROM OLD.folio THEN
      RAISE EXCEPTION 'El folio de un documento emitido es inmutable';
    END IF;
    RETURN NEW;
  END IF;

  -- INSERT: el cliente no propone folio.
  IF NEW.folio IS NOT NULL THEN
    RAISE EXCEPTION 'El folio lo asigna la base, no el cliente';
  END IF;

  -- SIETE de los ocho formatos llevan folio. `escrito_medico` y
  -- `resultado_laboratorio` caen al ELSE implícito y se quedan en NULL.
  --
  -- El discriminador de Honorarios/Cotización sigue siendo
  -- `contenido->>'tipo_doc'` (snake_case), con `tipoDoc` como respaldo para
  -- rutas antiguas u offline. Sin discriminador reconocible → 'noh'.
  v_clase := CASE NEW.tipo
    WHEN 'receta'                   THEN 'rx'
    WHEN 'consentimiento_informado' THEN 'ci'
    WHEN 'solicitud_lab'            THEN 'lab'
    WHEN 'solicitud_imagen'         THEN 'img'
    WHEN 'plan_suplementacion'      THEN 'sup'
    WHEN 'solicitud_internamiento'  THEN 'int'
    WHEN 'nota_honorarios'          THEN
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
  'transacción que la fila (INSERT) y lo declara inmutable (UPDATE). Cubre los '
  'siete formatos con folio; escrito_medico y resultado_laboratorio quedan en '
  'NULL. Rechaza todo folio provisto por un cliente autenticado; exenta a '
  'service_role.';


-- ── Consulta 5 de 5 · Recarga del esquema de PostgREST ──────────────────────
-- El CHECK de la columna cambió y PostgREST lo cachea.
NOTIFY pgrst, 'reload schema';

COMMIT;


-- ============================================================================
-- COMPROBACIÓN POSTERIOR, para pegar en el SQL Editor cuando esté aplicado
-- ============================================================================
-- Las ocho clases responden y ninguna choca con el CHECK de la columna. Se corre
-- como service_role (sin JWT) NO sirve: los dos gates de generar_folio() piden
-- clínica activa. Hazlo desde una sesión de médico, y después BORRA las ocho
-- filas de folios_contador que deja, o esas series arrancan en 2.
--
--   SELECT c, public.generar_folio(c)
--   FROM unnest(ARRAY['rx','noh','cot','ci','lab','img','sup','int']) AS c;
--
--   -- limpieza
--   DELETE FROM public.folios_contador
--   WHERE anio = EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Mexico_City'));
-- ============================================================================
