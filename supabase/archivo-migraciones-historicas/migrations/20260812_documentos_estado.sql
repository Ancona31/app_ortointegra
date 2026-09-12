-- ============================================================================
-- PENDIENTE DE APLICAR — la ejecuta Angel a mano, EN DOS BLOQUES
-- ============================================================================
-- Estado del documento · el borrador del consentimiento
--
-- ── POR QUÉ ─────────────────────────────────────────────────────────────────
--
-- El consentimiento informado tiene tres flujos reales:
--
--   1. Se llena en la consulta, con el paciente y al menos un testigo
--      delante, y se firma ahí mismo.
--   2. Se firma el día de la cirugía.
--   3. El médico lo escribe con calma en el consultorio —las complicaciones y
--      en qué consiste el procedimiento no se redactan con el paciente
--      esperando— y se firma el día del procedimiento.
--
-- El tercero es el habitual y hoy no tiene salida: un consentimiento a medias
-- no se puede guardar. Este es el trabajo que el borrador resuelve.
--
-- ── LOS TRES ESTADOS ────────────────────────────────────────────────────────
--
--   borrador               Pendiente de firmar y NO impreso. Se puede editar.
--                          NO consume folio.
--   emitido_firma_manual   Salió en papel sin firmas digitales; la firma vive
--                          fuera del sistema, en el papel.
--   firmado                Firmado digitalmente, sellado y guardado.
--
-- **borrador → cualquiera de los otros dos. Los otros dos son TERMINALES.**
--
-- Un emitido_firma_manual NO pasa después a firmado: ya se emitió y es
-- inmutable. Si el médico quiere firmas digitales sobre un documento que ya
-- imprimió, emite uno nuevo. Si no, tendría un PDF impreso sin firmas y una
-- versión sellada distinta del mismo acto.
--
-- ── LOS 1 037 DOCUMENTOS EXISTENTES ─────────────────────────────────────────
--
-- No se rellenan. La columna nace con DEFAULT 'emitido_firma_manual', que es la
-- verdad de todos ellos: se emitieron y su firma, si la hay, está en el papel.
--
-- Eso NO es un backfill: el valor por defecto lo aplica la base al añadir la
-- columna, sin escribir una sola fila. Y evita el tercer caso que tendría que
-- tratar cualquier filtro si la columna naciera vacía.
--
-- ── LO QUE ESTE ARCHIVO GARANTIZA, Y ES SU RAZÓN DE SER ─────────────────────
--
-- **Un borrador NO consume folio.**
--
-- Hoy trg_asignar_folio_documento asigna en el INSERT, así que un borrador
-- guardado como fila de documentos se llevaría un CI- desde el primer momento.
-- Si el paciente nunca vuelve, ese número queda quemado y la serie tiene un
-- hueco —que es exactamente lo que se evitó al elegir tabla de contadores en
-- vez de secuencia—.
--
-- Así que el folio se asigna al SALIR de borrador, no al crear la fila.
--
-- ── ORDEN DE DEPLOY, ESTRICTO ───────────────────────────────────────────────
--
--   BLOQUE B  →  BLOQUE C  →  deploy del cliente
--
-- NUNCA el cliente antes del bloque C. Si el código que escribe estado
-- 'borrador' llega a producción con la función vieja todavía viva, esa función
-- ignora el estado y asigna folio al insertar: el borrador quema un número, sin
-- error y sin aviso. Exactamente lo que esta migración existe para impedir.
--
-- ── DOS TRAMPAS PARA QUIEN ESCRIBA EL CLIENTE ───────────────────────────────
--
-- 1 · LA EMISIÓN DEL BORRADOR VA CON EL CLIENTE DE SESIÓN DEL MÉDICO, NUNCA
--     con createAdminClient(). El trigger exenta por completo a quien no trae
--     JWT, así que un UPDATE con privilegios de servicio dejaría el documento
--     en estado terminal, con folio NULL, para siempre: un segundo intento no
--     lo arregla, porque la rama de asignación exige venir de borrador.
--
--     Y comprueba el número de filas afectadas: la policy de UPDATE exige
--     subido_por = auth.uid(), así que emitir el borrador de otro médico
--     devuelve cero filas SIN error. La interfaz creería que emitió.
--
-- 2 · EL FOLIO SALE DEL UPDATE, ASÍ QUE VA ANTES DE RENDERIZAR EL PDF. El flujo
--     de hoy genera el PDF, lo sube y después escribe la fila. Para el borrador
--     hay que invertirlo: primero el UPDATE con RETURNING folio, después
--     renderizar. Si no, el papel sale sin el número que la base acaba de
--     asignar.
--
-- ── Y UN ACOPLAMIENTO QUE CONVIENE NO ROMPER ────────────────────────────────
--
-- La promesa de folio_01 de que ninguna edición de una fila vieja le inventa un
-- folio se sostiene HOY únicamente porque el DEFAULT de la columna es
-- 'emitido_firma_manual'. Si alguien lo cambiara a 'borrador', cada edición de
-- las 1 037 filas antiguas les inventaría uno.
-- ============================================================================


-- ── BLOQUE A · PRE-FLIGHT ────────────────────────────────────────────────────
-- No cambia nada. Aborta si el estado de partida no es el esperado.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'documentos'
       AND column_name = 'estado'
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: public.documentos.estado ya existe';
  END IF;

  IF to_regprocedure('public.asignar_folio_documento()') IS NULL
     OR to_regprocedure('public.generar_folio(text)') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: faltan las funciones de folio; aplica antes folio_01';
  END IF;

  -- No basta con que existan: hace falta la versión de folio_03. Este archivo
  -- reescribe asignar_folio_documento() con las nueve clases, pero NO reescribe
  -- generar_folio(), así que depende de que esa segunda función ya las conozca.
  -- Con la versión de folio_01, que solo sabe de cuatro, toda emisión de
  -- laboratorio, imagenología, suplementación, internamiento y denegación
  -- fallaría en producción con «clase de folio desconocida».
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
     WHERE proname = 'generar_folio'
       AND prosrc ~ 'WHEN ''den'''
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: generar_folio() no conoce la clase den; aplica antes folio_03';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'folios_contador_clase_check'
       AND pg_get_constraintdef(oid) LIKE '%den%'
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: folio_03 no está aplicada (el contador no admite den)';
  END IF;

  RAISE NOTICE 'PRE-FLIGHT OK';
END $$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ BLOQUE B — la columna                                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

BEGIN;

SET LOCAL lock_timeout = '3s';

-- NOT NULL con DEFAULT: en PostgreSQL 11+ esto NO reescribe la tabla, solo
-- anota el valor en el catálogo. A 1 037 filas sería instantáneo de todos
-- modos, pero conviene saber que no depende del volumen.
ALTER TABLE public.documentos
  ADD COLUMN estado text NOT NULL DEFAULT 'emitido_firma_manual';

ALTER TABLE public.documentos
  ADD CONSTRAINT documentos_estado_check
  CHECK (estado IN ('borrador', 'emitido_firma_manual', 'firmado'));

-- ⚠ La columna nace ESCRIBIBLE por el cliente. Las policies de documentos son
-- de FILA y authenticated tiene UPDATE a nivel de TABLA, así que un PATCH puede
-- proponer cualquier estado. Lo único que impone la máquina de estados es el
-- trigger del bloque C —la RLS no participa—, igual que ocurre con el folio.

COMMENT ON COLUMN public.documentos.estado IS
  'borrador: pendiente de firmar y sin imprimir, editable, SIN folio. '
  'emitido_firma_manual: salió en papel, la firma vive fuera del sistema. '
  'firmado: firmado digitalmente y sellado. Los dos últimos son TERMINALES: '
  'de ellos no se vuelve a borrador ni se pasa de uno a otro. Si el médico '
  'quiere firmas digitales sobre un documento ya impreso, emite uno nuevo.';

-- La consulta real del borrador: los de UN médico, más reciente primero.
-- Parcial, así que solo indexa las pocas filas en borrador y no las 1 037
-- emitidas.
CREATE INDEX idx_documentos_borrador
  ON public.documentos (subido_por, created_at DESC)
  WHERE estado = 'borrador';

COMMIT;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ BLOQUE C — el trigger, y las dos garantías                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Se reproduce ENTERO a propósito: un CREATE OR REPLACE sustituye el cuerpo
-- completo, así que omitir cualquier pieza la borraría. El razonamiento de cada
-- una está en 20260807_folio_01.
--
-- Lo que cambia respecto de la versión de folio_03, y solo esto:
--   · En INSERT, un borrador no recibe folio.
--   · En UPDATE, el folio se asigna al SALIR de borrador.
--   · En UPDATE, se declaran las transiciones válidas de estado.

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

  -- ── La clase, según el tipo. Igual que en folio_03. ──────────────────────
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
    --   borrador → borrador                (se sigue editando)
    --   borrador → emitido_firma_manual    (se imprime sin firmar)
    --   borrador → firmado                 (se sella con firmas)
    -- Los dos estados finales son TERMINALES: de ellos no se sale.
    IF OLD.estado IS DISTINCT FROM NEW.estado THEN
      IF OLD.estado <> 'borrador' THEN
        RAISE EXCEPTION 'Un documento % ya no cambia de estado', OLD.estado
          USING HINT = 'emitido_firma_manual y firmado son terminales; emite un documento nuevo';
      END IF;
      IF NEW.estado NOT IN ('emitido_firma_manual', 'firmado') THEN
        RAISE EXCEPTION 'Transición de estado no válida: % → %', OLD.estado, NEW.estado;
      END IF;
    END IF;

    -- El folio se asigna AL SALIR de borrador, no al crear la fila. Un
    -- borrador que nunca se emite no debe dejar un hueco en la serie.
    IF OLD.estado = 'borrador'
       AND NEW.estado <> 'borrador'
       AND NEW.folio IS NULL
       AND v_clase IS NOT NULL THEN
      NEW.folio := public.generar_folio(v_clase);
      RETURN NEW;
    END IF;

    -- Fuera de esa transición, el folio de un documento emitido es inmutable.
    IF NEW.folio IS DISTINCT FROM OLD.folio THEN
      RAISE EXCEPTION 'El folio de un documento emitido es inmutable';
    END IF;

    RETURN NEW;
  END IF;

  -- ── INSERT ───────────────────────────────────────────────────────────────

  -- El cliente no propone folio.
  IF NEW.folio IS NOT NULL THEN
    RAISE EXCEPTION 'El folio lo asigna la base, no el cliente';
  END IF;

  -- Un borrador no es un documento emitido: no consume folio. Lo recibirá al
  -- salir de ese estado.
  IF NEW.estado = 'borrador' THEN
    RETURN NEW;
  END IF;

  IF v_clase IS NOT NULL THEN
    NEW.folio := public.generar_folio(v_clase);
  END IF;

  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.asignar_folio_documento() IS
  'BEFORE INSERT OR UPDATE en public.documentos. Asigna el folio en la MISMA '
  'transacción que la fila, y en el momento en que el documento deja de ser un '
  'borrador: al insertar si nace emitido, o al salir de borrador si no. Un '
  'borrador que nunca se emite no deja hueco en la serie. Declara además las '
  'transiciones válidas de estado —solo desde borrador— y la inmutabilidad del '
  'folio. Cubre los ocho formatos con folio; escrito_medico, informe_clinico, '
  'resultado_laboratorio y estudio_imagen quedan en NULL. Exenta a service_role.';

NOTIFY pgrst, 'reload schema';

COMMIT;


-- ============================================================================
-- VERIFICACIÓN, después de aplicar
-- ============================================================================
--
-- -- 1 · La columna, su CHECK y su índice
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='documentos' AND column_name='estado';
--
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
--  WHERE conname = 'documentos_estado_check';
--
-- SELECT indexname FROM pg_indexes
--  WHERE tablename='documentos' AND indexname='idx_documentos_borrador';
--
-- -- 2 · Los 1 037 existentes quedaron todos como emitidos, sin escribir ninguno
-- SELECT estado, count(*) FROM public.documentos GROUP BY estado;
-- -- esperado: emitido_firma_manual = todas
--
-- -- 3 · El borrador NO consume folio, y lo recibe al salir. DESDE UNA SESIÓN
-- --     DE MÉDICO: los dos gates de generar_folio() piden clínica activa.
-- --     Sustituye los dos uuid por los de una cuenta y un paciente de prueba.
-- BEGIN;
--   INSERT INTO public.documentos (paciente_id, tipo, estado, contenido, subido_por)
--   VALUES ('<uuid-paciente-prueba>'::uuid, 'consentimiento_informado',
--           'borrador', '{}'::jsonb, auth.uid())
--   RETURNING id, estado, folio;
--   -- esperado: folio NULL
--
--   UPDATE public.documentos SET estado = 'firmado'
--    WHERE id = '<el id que devolvió el INSERT>'::uuid
--   RETURNING id, estado, folio;
--   -- esperado: folio CI-2026-NNNN
--
--   -- Y que los terminales lo son:
--   UPDATE public.documentos SET estado = 'borrador'
--    WHERE id = '<el mismo id>'::uuid;
--   -- esperado: falla con «Un documento firmado ya no cambia de estado»
-- ROLLBACK;
--
--
-- ============================================================================
-- DOWN
-- ============================================================================
--
-- ⚠⚠ EL PRIMER PASO ES REPONER LA FUNCIÓN, Y NO ES OPCIONAL.
--
-- La función nueva lee NEW.estado y OLD.estado. plpgsql resuelve los campos de
-- un record EN EJECUCIÓN, no al crear la función, así que quitar la columna
-- tiene éxito, el DOWN parece limpio, y el siguiente INSERT o UPDATE sobre
-- documentos revienta con «record "new" has no field "estado"». Todo el módulo
-- de documentos cae.
--
-- Así que antes de tocar la columna hay que volver a aplicar el BLOQUE B de
-- 20260811_folio_03_denegacion.sql, que devuelve asignar_folio_documento() a su
-- versión sin estados.
--
-- ⚠ Y el bloqueo con borradores vivos hay que IMPONERLO: un DROP COLUMN se
-- ejecuta pase lo que pase. Sin esta guarda, cada borrador se convierte en un
-- documento indistinguible de los emitidos y sin folio, que es justo el daño
-- que la guarda evita.
--
-- -- PASO 1 · reponer la función: aplicar el BLOQUE B de folio_03.
--
-- -- PASO 2 · la guarda y la columna, en una sola transacción:
-- BEGIN;
--
-- DO $$
-- DECLARE v_n integer;
-- BEGIN
--   SELECT count(*) INTO v_n FROM public.documentos WHERE estado = 'borrador';
--   IF v_n > 0 THEN
--     RAISE EXCEPTION 'Hay % borradores vivos: revertir los convertiría en documentos emitidos sin folio', v_n
--       USING HINT = 'son trabajo del médico sin terminar, no residuo. Decide qué hacer con ellos antes.';
--   END IF;
--
--   IF EXISTS (SELECT 1 FROM pg_proc
--               WHERE proname = 'asignar_folio_documento'
--                 AND prosrc LIKE '%estado%') THEN
--     RAISE EXCEPTION 'La función todavía lee estado: aplica antes el BLOQUE B de folio_03';
--   END IF;
-- END $$;
--
-- DROP INDEX IF EXISTS public.idx_documentos_borrador;
-- ALTER TABLE public.documentos DROP CONSTRAINT IF EXISTS documentos_estado_check;
-- ALTER TABLE public.documentos DROP COLUMN IF EXISTS estado;
-- NOTIFY pgrst, 'reload schema';
-- COMMIT;
--
-- El estado de las 1 037 filas antiguas se pierde, pero era reconstruible por
-- defecto. La pérdida real serían los borradores, y por eso la guarda.
