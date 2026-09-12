-- ============================================================================
-- PENDIENTE DE APLICAR — la ejecuta Angel a mano, EN DOS BLOQUES
-- ============================================================================
-- documentos.formato_version · fijarla al emitir y declararla inmutable
--
-- ── QUÉ HAY HOY, comprobado contra producción y no contra las cabeceras ─────
--
-- La columna EXISTE y está completa:
--   formato_version integer NOT NULL DEFAULT 1
--   CHECK (formato_version = ANY (ARRAY[1, 2]))
--   1 080 filas, todas en 1.
--
-- 20260804_documentos_formato_version.sql se aplicó en su día; su cabecera
-- sigue diciendo «PENDIENTE DE APLICAR» y es falsa. Igual que ocurrió con las
-- de folio. Este archivo NO la sustituye: añade lo que le falta.
--
-- ── QUÉ LE FALTA, y son dos cosas ──────────────────────────────────────────
--
-- 1 · NADIE LA CONGELA. El trigger blinda el folio y las transiciones de
--     estado; la versión de formato no aparece en él. Un documento ya emitido
--     puede pasar de 1 a 2 con un PATCH, y entonces se reimprimiría con un
--     chasis que no es el suyo: el papel que el paciente firmó y el que sale
--     de la reimpresión dejarían de coincidir.
--
-- 2 · SE FIJA AL CREAR LA FILA, Y ESO YA NO SIRVE. Esa premisa se escribió
--     cuando toda fila nacía emitida. Hoy un consentimiento se guarda como
--     borrador y se emite días después: si v2 se enciende en medio, la fila
--     diría 1 y el papel saldría con v2.
--
-- ── LA REGLA, y es la misma que ya gobierna el folio ────────────────────────
--
-- La versión se fija EN EL MOMENTO EN QUE EL DOCUMENTO DEJA DE SER UN BORRADOR,
-- porque hasta entonces no hay papel. Un borrador nace con el DEFAULT de 1 y no
-- significa nada; al emitirse recibe la versión con la que de verdad se compuso.
--
-- Y a partir de ahí no se mueve.
--
-- ⚠ ESTA MIGRACIÓN NO CIERRA EL PUNTO 2 POR SÍ SOLA. Abre la ventana; el que
-- tiene que mandar la versión en ese UPDATE es el cliente, y hoy no la manda:
-- las dos emisiones reales del consentimiento envían solo el estado. Aplicada
-- esta migración y encendido v2, la fila seguiría diciendo 1 con el papel en 2.
--
-- El cambio de cliente va DESPUÉS, en el cableado, y tiene una regla: la versión
-- viaja SOLO en el UPDATE de emisión, nunca en el guardado del borrador. Un
-- borrador que se reguarda cambiando de versión cae a la guarda del final y
-- falla con un mensaje que en un borrador miente.
--
-- ── DEPENDENCIA ─────────────────────────────────────────────────────────────
--
-- Reescribe public.asignar_folio_documento() ENTERA con CREATE OR REPLACE, así
-- que se apoya en la versión que hoy está en producción: la de
-- 20260812_documentos_estado.sql. Si esa no estuviera aplicada, este archivo
-- borraría la máquina de estados.
-- ============================================================================


-- ── BLOQUE A · PRE-FLIGHT ────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='documentos'
       AND column_name='formato_version'
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: falta documentos.formato_version';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='documentos'
       AND column_name='estado'
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: falta documentos.estado; aplica antes 20260812';
  END IF;

  -- No basta con que la función exista: hace falta la versión que ya conoce la
  -- máquina de estados. Con la anterior, este REPLACE la borraría.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
     WHERE oid = to_regprocedure('public.asignar_folio_documento()')
       AND prosrc LIKE '%ya no cambia de estado%'
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: asignar_folio_documento() no trae la máquina de estados; aplica antes 20260812';
  END IF;

  IF to_regprocedure('public.generar_folio(text)') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: falta public.generar_folio(text)';
  END IF;

  -- Sin el trigger, o con él deshabilitado, esta migración «tendría éxito» sin
  -- imponer absolutamente nada.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid = 'public.documentos'::regclass
       AND tgname  = 'trg_asignar_folio_documento'
       AND NOT tgisinternal
       AND tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: trg_asignar_folio_documento no existe o está deshabilitado';
  END IF;

  RAISE NOTICE 'PRE-FLIGHT OK';
END $$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ BLOQUE B — el trigger, con las dos reglas nuevas                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Se reproduce ENTERA a propósito: un CREATE OR REPLACE sustituye el cuerpo
-- completo, así que omitir cualquier pieza la borraría. El razonamiento de cada
-- una está en folio_01 y en 20260812.
--
-- Lo que cambia respecto de la versión viva, y SOLO esto:
--   · En UPDATE, formato_version es inmutable fuera de la salida de borrador.
--   · En UPDATE, al salir de borrador se admite fijarla.
--   · En INSERT, una fila que nace emitida ya no puede mentir sobre su versión
--     después.

BEGIN;

SET LOCAL lock_timeout = '3s';

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

  -- ── UPDATE ───────────────────────────────────────────────────────────────
  IF TG_OP = 'UPDATE' THEN

    -- Las transiciones válidas, y solo esas:
    --   borrador → borrador · borrador → emitido_firma_manual · borrador → firmado
    IF OLD.estado IS DISTINCT FROM NEW.estado THEN
      IF OLD.estado <> 'borrador' THEN
        RAISE EXCEPTION 'Un documento % ya no cambia de estado', OLD.estado
          USING HINT = 'emitido_firma_manual y firmado son terminales; emite un documento nuevo';
      END IF;
      IF NEW.estado NOT IN ('emitido_firma_manual', 'firmado') THEN
        RAISE EXCEPTION 'Transición de estado no válida: % → %', OLD.estado, NEW.estado;
      END IF;
    END IF;

    -- El folio y la VERSIÓN DE FORMATO se fijan AL SALIR de borrador. Hasta
    -- entonces no hay papel: un borrador que nunca se emite no debe dejar hueco
    -- en la serie, y su versión no significa nada porque no se compuso nada.
    IF OLD.estado = 'borrador' AND NEW.estado <> 'borrador' THEN

      -- ⚠ ESTA GUARDA NO SE QUITA. El RETURN NEW de abajo es incondicional, así
      -- que si el cliente propusiera un folio aquí, ninguna de las dos guardas
      -- del final llegaría a evaluarse y el número forjado se escribiría.
      --
      -- El daño no sería solo esa fila: un folio adelantado hace que la emisión
      -- legítima que llegue a ese número falle por unicidad, y el fallo cae
      -- sobre un tercero. Corrupción de serie y denegación diferida, en un
      -- documento que además queda terminal e inmutable.
      --
      -- IS DISTINCT FROM OLD.folio y no IS NOT NULL: una fila escrita por
      -- service_role puede llegar a la transición con folio ya puesto, y esa sí
      -- debe conservarlo.
      IF NEW.folio IS DISTINCT FROM OLD.folio THEN
        RAISE EXCEPTION 'El folio lo asigna la base, no el cliente';
      END IF;

      IF NEW.folio IS NULL AND v_clase IS NOT NULL THEN
        NEW.folio := public.generar_folio(v_clase);
      END IF;

      -- La versión la propone el cliente en este UPDATE, y es la única ventana
      -- en que puede hacerlo: es el mismo acto que compone el papel.
      RETURN NEW;
    END IF;

    -- Fuera de esa transición, las dos son inmutables.
    IF NEW.folio IS DISTINCT FROM OLD.folio THEN
      RAISE EXCEPTION 'El folio de un documento emitido es inmutable';
    END IF;

    -- Sin esto, un documento ya emitido podría cambiar de chasis con un PATCH:
    -- el papel que el paciente firmó y el de la reimpresión dejarían de
    -- coincidir, sin error y sin rastro.
    IF NEW.formato_version IS DISTINCT FROM OLD.formato_version THEN
      RAISE EXCEPTION 'La versión de formato de un documento emitido es inmutable'
        USING HINT = 'dice con qué chasis se compuso el papel: cambiarla haría que la reimpresión no coincidiera con el original';
    END IF;

    RETURN NEW;
  END IF;

  -- ── INSERT ───────────────────────────────────────────────────────────────

  IF NEW.folio IS NOT NULL THEN
    RAISE EXCEPTION 'El folio lo asigna la base, no el cliente';
  END IF;

  -- Un borrador no es un documento emitido: no consume folio, y su versión de
  -- formato es el DEFAULT y no significa nada. Las dos se fijan al salir.
  IF NEW.estado = 'borrador' THEN
    RETURN NEW;
  END IF;

  IF v_clase IS NOT NULL THEN
    NEW.folio := public.generar_folio(v_clase);
  END IF;

  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.asignar_folio_documento() IS
  'BEFORE INSERT OR UPDATE en public.documentos. Asigna el folio y admite fijar '
  'la versión de formato en el momento en que el documento deja de ser un '
  'borrador: al insertar si nace emitido, o al salir de borrador si no. Un '
  'borrador que nunca se emite no deja hueco en la serie y su versión no '
  'significa nada. Declara además las transiciones válidas de estado —solo '
  'desde borrador— y la inmutabilidad del folio y de la versión de formato. '
  'Cubre los ocho formatos con folio; escrito_medico, informe_clinico, '
  'resultado_laboratorio y estudio_imagen quedan en NULL. Exenta a service_role.';

NOTIFY pgrst, 'reload schema';

COMMIT;


-- ============================================================================
-- VERIFICACIÓN, después de aplicar
-- ============================================================================
--
-- -- 1 · La función trae las dos reglas
-- SELECT prosrc LIKE '%versión de formato de un documento emitido%' AS congela_version,
--        prosrc LIKE '%ya no cambia de estado%'                      AS trae_estados,
--        prosecdef, proconfig
--   FROM pg_proc WHERE oid = to_regprocedure('public.asignar_folio_documento()');
-- -- las dos primeras: true
--
-- -- 2 · Los 1 080 siguen en 1, sin escribir ninguno
-- SELECT formato_version, count(*) FROM public.documentos GROUP BY 1;
--
-- -- 3 · La inmutabilidad, de extremo a extremo. DESDE UNA SESIÓN DE MÉDICO:
-- --     sin JWT el trigger se exime entero y la prueba no valdría.
-- --     Sustituye el uuid por uno de un documento propio ya emitido.
-- BEGIN;
--   UPDATE public.documentos SET formato_version = 2
--    WHERE id = '<uuid-de-un-documento-emitido-propio>'::uuid;
--   -- esperado: falla con «La versión de formato de un documento emitido es
--   -- inmutable». Si pasa, la regla no está actuando.
-- ROLLBACK;
--
-- -- 4 · El folio forjado al emitir. Es el agujero que la primera versión de
-- --     este archivo abría, y esta prueba es la que lo cierra.
-- --     TAMBIÉN desde sesión de médico, sobre un borrador propio.
-- BEGIN;
--   UPDATE public.documentos
--      SET estado = 'firmado', folio = 'CI-2026-9999'
--    WHERE id = '<uuid-de-un-borrador-propio>'::uuid
--   RETURNING folio;
--   -- esperado: falla con «El folio lo asigna la base, no el cliente».
--   -- Si devolviera CI-2026-9999, la guarda no está actuando y hay que PARAR:
--   -- un folio adelantado rompe la emisión legítima de un tercero.
-- ROLLBACK;
--
--
-- ============================================================================
-- DOWN
-- ============================================================================
--
-- ⚠ NO hay nada que revertir salvo la función. Para devolverla a su versión
-- anterior, vuelve a aplicar el BLOQUE C de 20260812_documentos_estado.sql, que
-- la deja sin la regla de formato_version.
--
-- La columna no se toca en este archivo, así que no hay dato que perder.
