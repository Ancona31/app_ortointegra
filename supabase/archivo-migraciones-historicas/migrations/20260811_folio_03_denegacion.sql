-- ============================================================================
-- PENDIENTE DE APLICAR — la ejecuta Angel a mano, EN DOS BLOQUES
-- ============================================================================
-- Denegación o revocación del consentimiento · tipo nuevo y clase de folio
--
-- ── QUÉ ES ──────────────────────────────────────────────────────────────────
--
-- Un documento INDEPENDIENTE de una hoja que se emite EN LUGAR del
-- consentimiento, cuando el paciente rechaza el procedimiento o revoca una
-- autorización previa. No es una hoja del consentimiento: si el paciente
-- deniega, no se imprimen las siete hojas que explican y otorgan lo que acaba
-- de rechazar.
--
-- En el formulario se elige con un conmutador, como recibo y cotización en
-- Honorarios: comparten los datos de identificación, y al elegir denegación se
-- pliegan las siete secciones clínicas y las autorizaciones.
--
-- Spec de composición: GUIA_FORM_DENEGACION.md.
--
-- ── POR QUÉ TIPO PROPIO Y NO DISCRIMINADOR ──────────────────────────────────
--
-- Honorarios y Cotización comparten `documentos.tipo` y se distinguen por
-- `contenido->>'tipo_doc'`. Aquí NO se sigue ese precedente, y la razón es que
-- los dos casos no se parecen:
--
--   · Una cotización es un recibo sin cobrar. Confundirlos en una lista no hace
--     daño.
--   · Un consentimiento y una denegación son actos OPUESTOS. Que una denegación
--     apareciera en el expediente etiquetada como «consentimiento informado»
--     obligaría a abrirla para saber que el paciente rechazó, y quien busque
--     «¿este paciente autorizó?» leería exactamente lo contrario de lo que pasó.
--
-- El coste es conocido y se asume: los sitios que conocen la lista de tipos
-- —el visor y los filtros del expediente— tienen que aprender el valor nuevo.
-- Van en el mismo deploy.
--
-- Lo que NO cambia, y está decidido: la denegación no aparece en la barra de
-- tipos de documento —se elige con un conmutador dentro del formulario de
-- consentimiento, como recibo y cotización—, comparte plantillas con él, y NO
-- cuenta como consentimiento otorgado en el panel legal, porque es el acto
-- contrario.
--
-- ── SUSTITUYE A folio_02, NO LA SIGUE ───────────────────────────────────────
--
-- `20260808_folio_02_clases_faltantes.sql` NO se aplica. Este archivo la
-- contiene entera —verificado línea a línea: las dos funciones y los dos CHECK
-- compartidos son superconjuntos estrictos— así que aplicar las dos sería hacer
-- dos veces el mismo ALTER sobre `documentos`, con dos ACCESS EXCLUSIVE y dos
-- escaneos, para llegar al mismo sitio.
--
-- ⚠ Y dejarla en el directorio con fecha ANTERIOR es peligroso, por un modo de
-- fallo que no truena: si algún día se enlaza el CLI, `supabase db push`
-- aplicaría 02 DESPUÉS de esta y reescribiría las dos funciones sin la clase
-- 'den'. Pero 02 no toca `documentos_tipo_check`, así que
-- `denegacion_consentimiento` seguiría siendo un tipo válido: la fila entraría,
-- el trigger caería al ELSE implícito, y la denegación se guardaría CON FOLIO
-- NULL, sin error y sin aviso. Un documento legal mudo.
--
-- Por eso folio_02 se retira del directorio de migraciones en el mismo commit
-- que trae este archivo.
--
-- Orden: 20260807_folio_01 (ya en producción) → este.
--
-- ── LOS SITIOS DEL CLIENTE QUE ESTE ARCHIVO **NO** TOCA ─────────────────────
--
--   src/lib/mobileShare.ts         la unión DocType y el switch del renderizador.
--                                  Sin caso, generarPdf devuelve null y el
--                                  documento no se puede imprimir ni compartir.
--   src/lib/documentos/folio.ts    PREFIJO_POR_CLASE, FOLIO_CANONICO, DICTADO
--   src/lib/tests/folio.test.ts    afirma cuántos prefijos hay «y solo esos»
--   src/types/index.ts             la unión TipoDocumento
--   El visor y los filtros del expediente, que hoy degradan a la etiqueta cruda
--
-- **Todos van en el MISMO deploy que esta migración.**
--
-- ── EL PREFIJO ──────────────────────────────────────────────────────────────
--
-- `DEN`, no `D-`. La guía de composición proponía una sola letra, siguiendo las
-- láminas viejas, pero la convención ya establecida por las ocho clases
-- existentes es de dos a tres letras en mayúscula: RX NOH COT CI LAB IMG SUP
-- INT. Mezclar longitudes complica el patrón de dictado sin ganar nada.
--
-- ── PLANTILLAS: NO SE TOCAN ─────────────────────────────────────────────────
--
-- `plantillas_documento` admite ocho tipos y no incluye este, y así se queda:
-- la denegación comparte formulario con el consentimiento, así que comparte sus
-- plantillas. No hace falta ampliar su CHECK.
-- ============================================================================


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ BLOQUE A — los dos CHECK                                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Los tres CHECK de este bloque RELAJAN, no restringen: ninguna fila existente
-- puede quedar en falso, así que el escaneo de validación no puede fallar.

BEGIN;

SET LOCAL lock_timeout = '3s';

-- ── 1 de 4 · El tipo de documento ───────────────────────────────────────────
-- De once valores a doce. Escanea public.documentos entera; el conjunto nuevo
-- es un superconjunto estricto del anterior, así que todas las filas pasan.
ALTER TABLE public.documentos
  DROP CONSTRAINT documentos_tipo_check;

ALTER TABLE public.documentos
  ADD CONSTRAINT documentos_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'receta'::text,
    'solicitud_lab'::text,
    'solicitud_imagen'::text,
    'informe_clinico'::text,
    'plan_suplementacion'::text,
    'escrito_medico'::text,
    'solicitud_internamiento'::text,
    'consentimiento_informado'::text,
    'denegacion_consentimiento'::text,
    'nota_honorarios'::text,
    'resultado_laboratorio'::text,
    'estudio_imagen'::text
  ]));

-- ── 2 de 4 · Las clases admitidas en el contador ────────────────────────────
-- De ocho a nueve.
ALTER TABLE public.folios_contador
  DROP CONSTRAINT folios_contador_clase_check;

ALTER TABLE public.folios_contador
  ADD CONSTRAINT folios_contador_clase_check
  CHECK (clase IN ('rx', 'noh', 'cot', 'ci', 'lab', 'img', 'sup', 'int', 'den'));

-- ── 3 de 4 · La forma del folio en la columna ───────────────────────────────
-- Una alternativa más en el grupo de prefijo. El {4,} del correlativo no se
-- toca: la serie 10 000 se ensancha, no se trunca.
ALTER TABLE public.documentos
  DROP CONSTRAINT documentos_folio_formato_check;

ALTER TABLE public.documentos
  ADD CONSTRAINT documentos_folio_formato_check
  CHECK (folio IS NULL OR folio ~ '^(RX|NOH|COT|CI|LAB|IMG|SUP|INT|DEN)-[0-9]{4}-[0-9]{4,}$');

COMMIT;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ BLOQUE B — las dos funciones y el reload                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Las dos se reproducen ENTERAS a propósito: un CREATE OR REPLACE sustituye el
-- cuerpo completo, así que omitir cualquier pieza la borraría. El razonamiento
-- de cada una está en 20260807_folio_01.

BEGIN;

SET LOCAL lock_timeout = '3s';

-- ── 4 de 4a · El generador ──────────────────────────────────────────────────
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
  -- comparten documentos.tipo y no comparten serie.
  v_prefijo := CASE p_clase
    WHEN 'rx'  THEN 'RX'   -- Receta
    WHEN 'noh' THEN 'NOH'  -- Nota de Honorarios
    WHEN 'cot' THEN 'COT'  -- Cotización
    WHEN 'ci'  THEN 'CI'   -- Consentimiento Informado
    WHEN 'lab' THEN 'LAB'  -- Solicitud de Laboratorio
    WHEN 'img' THEN 'IMG'  -- Solicitud de Imagenología
    WHEN 'sup' THEN 'SUP'  -- Plan de Suplementación
    WHEN 'int' THEN 'INT'  -- Solicitud de Internamiento
    WHEN 'den' THEN 'DEN'  -- Denegación o revocación
  END;

  IF v_prefijo IS NULL THEN
    RAISE EXCEPTION 'clase de folio desconocida'
      USING HINT = 'las nueve son rx, noh, cot, ci, lab, img, sup, int, den';
  END IF;

  -- Las dos puertas del sistema, en positivo, ANTES de tocar el contador: quien
  -- no podría guardar el documento tampoco gasta su folio.
  IF public.get_clinica_id() IS NULL THEN
    RAISE EXCEPTION 'sin clínica activa: no se emite folio';
  END IF;

  IF NOT public.clinica_tiene_acceso() THEN
    RAISE EXCEPTION 'la clínica no tiene acceso de escritura: no se emite folio';
  END IF;

  -- El año es el de MÉXICO, no el de UTC. Ver la nota larga en folio_01.
  v_anio := EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Mexico_City'))::smallint;

  -- Un solo statement, atómico. Sin ventana entre leer y escribir.
  INSERT INTO public.folios_contador AS c (clase, anio, ultimo)
  VALUES (p_clase, v_anio, 1)
  ON CONFLICT (clase, anio) DO UPDATE
    SET ultimo = c.ultimo + 1
  RETURNING c.ultimo INTO v_n;

  -- El CASE no es decorativo: lpad TRUNCA POR LA DERECHA. Ver la nota en
  -- folio_01.
  RETURN v_prefijo || '-' || v_anio::text || '-' ||
         CASE WHEN v_n < 10000 THEN lpad(v_n::text, 4, '0') ELSE v_n::text END;
END $$;

COMMENT ON FUNCTION public.generar_folio(text) IS
  'Entrega el siguiente correlativo de una clase de folio '
  '(rx/noh/cot/ci/lab/img/sup/int/den) para el año de México. Su único invocador '
  'legítimo es el trigger trg_asignar_folio_documento; NO se expone como RPC. '
  'Exponerla a authenticated reabre dos cosas: huecos permanentes en la serie '
  '(cada llamada RPC confirma en su propia transacción) y lectura directa del '
  'volumen de emisión de toda la plataforma, porque la serie es global.';


-- ── 4 de 4b · Quién pone el folio ───────────────────────────────────────────
-- Solo cambia el CASE de documentos.tipo → clase. El resto se reproduce literal
-- por la misma razón que arriba.
--
-- escrito_medico sigue cayendo al ELSE implícito y quedándose en NULL: es el
-- único de los formatos sin folio. informe_clinico, resultado_laboratorio y
-- estudio_imagen tampoco son formatos: los dos últimos son archivos que se
-- suben.
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

  -- El discriminador de Honorarios/Cotización sigue siendo
  -- contenido->>'tipo_doc' (snake_case), con tipoDoc como respaldo para rutas
  -- antiguas u offline. Sin discriminador reconocible → 'noh'.
  --
  -- La denegación NO usa discriminador: tiene tipo propio, por lo que se
  -- explica en la cabecera.
  v_clase := CASE NEW.tipo
    WHEN 'receta'                    THEN 'rx'
    WHEN 'consentimiento_informado'  THEN 'ci'
    WHEN 'denegacion_consentimiento' THEN 'den'
    WHEN 'solicitud_lab'             THEN 'lab'
    WHEN 'solicitud_imagen'          THEN 'img'
    WHEN 'plan_suplementacion'       THEN 'sup'
    WHEN 'solicitud_internamiento'   THEN 'int'
    WHEN 'nota_honorarios'           THEN
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
  'ocho formatos con folio; escrito_medico, informe_clinico, '
  'resultado_laboratorio y estudio_imagen quedan en NULL. Rechaza todo folio '
  'provisto por un cliente autenticado; exenta a service_role.';


-- PostgREST cachea tablas, columnas, tipos y funciones —no los predicados de
-- CHECK, que llegan desde Postgres en tiempo de ejecución—. Aquí no hay nada que
-- refrescar de verdad; se deja porque cuesta cero y porque folio_01 lo hace, así
-- que quitarlo solo aquí invitaría a preguntarse por qué.
NOTIFY pgrst, 'reload schema';

COMMIT;


-- ============================================================================
-- VERIFICACIÓN, después de aplicar
-- ============================================================================
--
-- -- 1 · Los doce tipos y las nueve clases
-- SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--  WHERE conname IN ('documentos_tipo_check',
--                    'folios_contador_clase_check',
--                    'documentos_folio_formato_check');
--
-- -- 2 · La clase nueva responde. DESDE UNA SESIÓN DE MÉDICO: los dos gates de
-- --     generar_folio() piden clínica activa, así que como service_role falla.
-- --     Deja una fila en folios_contador, así que va dentro de una transacción
-- --     que se deshace.
-- BEGIN;
--   SELECT public.generar_folio('den');   -- esperado: DEN-2026-0001
-- ROLLBACK;
--
-- -- 3 · Que el contador quedó limpio
-- SELECT clase, anio, ultimo FROM public.folios_contador ORDER BY clase;
--
--
-- ============================================================================
-- DOWN
-- ============================================================================
--
-- ⚠ ESTE DOWN NO ES UN INVERSO EXACTO, y hay que saber por qué antes de usarlo.
--
-- Como esta migración se aplica SALTÁNDOSE 20260808_folio_02 —que se retiró por
-- estar contenida entera aquí—, el estado anterior real de dos de los tres CHECK
-- es el de folio_01: CUATRO clases y CUATRO prefijos, no ocho.
--
-- El DOWN los deja en ocho, que es un estado que NUNCA existió en producción. No
-- es peligroso —sigue relajando respecto de folio_01, así que ninguna fila puede
-- quedar en falso— pero no devuelve la base a donde estaba. Si lo que quieres es
-- el estado real anterior, usa los valores de folio_01 en su lugar:
--   folios_contador_clase_check   → ('rx','noh','cot','ci')
--   documentos_folio_formato_check → ^(RX|NOH|COT|CI)-...
--
-- El CHECK de tipo SÍ vuelve exacto a sus once valores.
--
-- NO revierte las funciones, y eso tiene una consecuencia concreta: tras el DOWN,
-- generar_folio sigue conociendo 'den' y el trigger sigue mapeando el tipo a esa
-- clase.
--
-- ⚠ Y el error que se ve depende de POR DÓNDE se intente, justo al revés de lo
-- intuitivo:
--   · Desde el SQL Editor o service_role, auth.uid() es NULL, el trigger sale
--     por su primera línea sin generar folio, y el error es el claro:
--     documentos_tipo_check.
--   · Desde la app, con sesión de médico, el trigger BEFORE corre antes que el
--     CHECK de la columna, así que el error NO dice «tipo inválido» sino que
--     violó folios_contador_clase_check. Bloquea igual; el mensaje despista.
--
-- O sea: probando el DOWN a mano se ve el error correcto y todo parece en orden;
-- el médico ve el incomprensible.
--
-- ⚠ EL DOWN FALLA si ya se emitió una denegación, y debe fallar. Comprueba las
-- TRES cosas, no solo la primera: puede haber una fila en el contador sin ningún
-- documento, si alguien probó el generador y confirmó.
--
--   SELECT
--     (SELECT count(*) FROM public.documentos
--        WHERE tipo = 'denegacion_consentimiento')        AS docs,
--     (SELECT count(*) FROM public.folios_contador
--        WHERE clase = 'den')                             AS contador,
--     (SELECT count(*) FROM public.documentos
--        WHERE folio LIKE 'DEN-%')                        AS folios;
--
--   -- las tres tienen que dar 0. Si no:
--   --
--   --   contador > 0 con docs = 0 y folios = 0
--   --     Residuo de una prueba del generador que se confirmó en vez de
--   --     revertirse. Se limpia y el DOWN sigue:
--   --       DELETE FROM public.folios_contador WHERE clase = 'den';
--   --
--   --   docs > 0 o folios > 0
--   --     Hay denegaciones emitidas. NO hay salida: son documentos clínicos y
--   --     son inmutables por regla del proyecto. El DOWN deja de ser una
--   --     opción y hay que ir hacia adelante.
--
-- BEGIN;
-- ALTER TABLE public.documentos DROP CONSTRAINT documentos_tipo_check;
-- ALTER TABLE public.documentos ADD CONSTRAINT documentos_tipo_check
--   CHECK (tipo = ANY (ARRAY['receta'::text, 'solicitud_lab'::text,
--     'solicitud_imagen'::text, 'informe_clinico'::text,
--     'plan_suplementacion'::text, 'escrito_medico'::text,
--     'solicitud_internamiento'::text, 'consentimiento_informado'::text,
--     'nota_honorarios'::text, 'resultado_laboratorio'::text,
--     'estudio_imagen'::text]));
-- ALTER TABLE public.folios_contador DROP CONSTRAINT folios_contador_clase_check;
-- ALTER TABLE public.folios_contador ADD CONSTRAINT folios_contador_clase_check
--   CHECK (clase IN ('rx','noh','cot','ci','lab','img','sup','int'));
-- ALTER TABLE public.documentos DROP CONSTRAINT documentos_folio_formato_check;
-- ALTER TABLE public.documentos ADD CONSTRAINT documentos_folio_formato_check
--   CHECK (folio IS NULL OR folio ~ '^(RX|NOH|COT|CI|LAB|IMG|SUP|INT)-[0-9]{4}-[0-9]{4,}$');
-- NOTIFY pgrst, 'reload schema';
-- COMMIT;
