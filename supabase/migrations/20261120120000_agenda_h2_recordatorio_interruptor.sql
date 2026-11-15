-- ═══════════════════════════════════════════════════════════════════════
-- Agenda · tanda H (punto 9 de Angel) — el recordatorio automático por
-- correo tiene su propio interruptor por clínica, APAGADO de fábrica
-- Rama: feature/agenda-v2-h2 · Escrita: 2026-11-15
-- Riesgo estimado: BAJO (una columna nueva con DEFAULT constante —sólo
-- catálogo, sin reescribir la tabla— y una función nueva de sólo lectura;
-- ninguna policy, ningún permiso de tabla, ninguna función existente y
-- ningún dato existente cambian).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-11-15
--   `docker exec -i supabase_db_app_ortointegra psql -U postgres -v ON_ERROR_STOP=1 -f`
--   del archivo completo, dos pasadas seguidas (rejilla 7 × OK las dos; la
--   segunda, no-op: ADD COLUMN IF NOT EXISTS y el pre-vuelo acepta el md5
--   de esta migración). Anotada a mano en
--   supabase_migrations.schema_migrations (versión 20261120120000).
--   Pruebas: supabase/pruebas-sql/h2_recordatorio_interruptor.sql (en rojo
--   sin la condición `j.recordatorio_encendido` del listado).
--   Comprobación:
--     select md5(prosrc) from pg_proc where oid = 'public.cita_recordatorios_pendientes(integer)'::regprocedure;
--     → be18fa7735f7bf072bdc8178125694d0
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de E4,
--   20261115140000_agenda_e4_correos_cita.sql, y de B1).
-- AUDITORÍA INDEPENDIENTE: APTA (ver la sección «Auditoría», al pie de la cabecera).
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Punto 9 de la tanda H (Angel, 2026-11-15): «Recordatorio automático por
-- correo: APAGADO de fábrica. Cada clínica lo enciende con un interruptor
-- en esa sección […]. La tarea programada no envía nada a las clínicas que
-- lo tengan apagado. Los correos que no dependen de este interruptor siguen
-- igual: el código y el comprobante de la reserva por enlace, y la
-- confirmación que el personal manda a mano con su botón.»
-- Hasta hoy el recordatorio salía para toda clínica con la v2 encendida (y
-- la puerta S3): bastaba con eso y con `recordatorio_horas`.
--
-- ═══ QUÉ CAMBIA ════════════════════════════════════════════════════════
-- agenda_ajustes.recordatorio_encendido boolean NOT NULL DEFAULT false
--   (columna NUEVA; ninguna existente cambia). La escribe quien ya escribe
--   los plazos: el administrador de la clínica por la policy de UPDATE de
--   B1 (por fila, sin cambio) y `PUT/PATCH /api/me/ajustes-agenda`. El
--   disparador `proteger_agenda_ajustes()` NO la protege (sólo protege el
--   interruptor de la v2 y el candado), así que no hace falta tocarlo.
-- cita_recordatorios_pendientes(integer): FUNCIÓN NUEVA = el cuerpo de
--   `cita_correos_pendientes` (E4) con UNA condición más en la consulta que
--   elige a las clínicas: `AND j.recordatorio_encendido`. La tarea
--   `/api/cron/recordatorios` llama a ESTA (el código de esta rama).
--   Por qué una función nueva y no un CREATE OR REPLACE de la de E4: con el
--   código nuevo contra una base SIN esta migración, la función no existe
--   (PGRST202), la tarea lo trata como «no disponible» y NO MANDA NADA: el
--   «apagado de fábrica» se cumple aunque falte la columna. Si se cambiara
--   la de E4 en su sitio, una base sin la migración seguiría mandando.
-- cita_correos_pendientes(integer) (E4) NO se toca ni se borra: deja de
--   tener llamadores en el código de esta rama (anotado como deuda: se
--   retira en una migración posterior, junto con su prueba SQL). Sigue
--   sólo para service_role.
-- cita_correo_tomar NO cambia: el comprobante y la confirmación manual
--   (que la usan con sus tipos) no dependen del interruptor nuevo. Un
--   recordatorio sólo se toma para una cita que dio el listado.
--
-- ═══ CONSECUENCIA EN PRODUCCIÓN (decisión de Angel: «de fábrica») ═════
-- Toda clínica, también las que ya tengan la v2 encendida al aplicar esto,
-- queda con el recordatorio APAGADO hasta que su administrador lo encienda
-- en la configuración. No hay backfill a true, a propósito.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere B1 y E4 (y C1 por gcal_sync_clinica_habilitada). PG ≥ 11 (ADD
--   COLUMN con DEFAULT constante sin reescritura).
-- Bloqueos (lock_timeout 5 s): ALTER TABLE … ADD COLUMN toma ACCESS
--   EXCLUSIVE sobre agenda_ajustes un instante (una fila por clínica; sin
--   reescritura). CREATE FUNCTION no bloquea tablas.
-- Orden respecto al código: cualquiera es seguro.
--   · Código nuevo, base sin esto: la tarea recibe PGRST202 y no manda
--     recordatorios; la configuración enseña el interruptor deshabilitado
--     («no disponible») y los plazos siguen como hoy.
--   · Código viejo, base con esto: sigue llamando a cita_correos_pendientes
--     (sin el interruptor) y manda como hoy hasta que se despliegue el nuevo.
-- Alcance de los roles:
--   gana — service_role: EXECUTE de cita_recordatorios_pendientes.
--          administrador de clínica: escribir la columna nueva de SU fila (la
--          policy de UPDATE de B1 ya le deja escribir toda la fila salvo lo
--          que protege el disparador).
--   pierde — nada. authenticated sigue leyendo agenda_ajustes de su clínica
--          (ahora también esta columna, que no es secreta).
-- Contrato con spinus-consola: columna nueva; ninguna existente cambia de
--   nombre, tipo ni significado.
-- ⚠️ Re-ejecutar B1 después de esta migración ABORTA en su pre-vuelo (la
--   tabla ya no tiene exactamente sus columnas): es lo correcto.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   DROP FUNCTION IF EXISTS public.cita_recordatorios_pendientes(integer);
--   ALTER TABLE public.agenda_ajustes DROP COLUMN IF EXISTS recordatorio_encendido;
--   (y desplegar el código anterior, que vuelve a llamar a la función de E4).
--   La columna sólo guarda la decisión de cada clínica; sin ella el código
--   nuevo no manda recordatorios.
--
-- ═══ AUDITORÍA ═════════════════════════════════════════════════════════
-- AUDITORÍA INDEPENDIENTE 2026-11-15 (otro modelo —sonnet—, las 18
--   dimensiones de supabase/AUDITORIA-MIGRACIONES.md, con el catálogo local en
--   vivo): APTA. Comprobó que la expresión del destinatario es idéntica a la
--   de cita_correo_tomar (dimensión 16), que el GRANT de tabla de B1 cubre la
--   columna nueva y que re-ejecutar B1 después aborta, como se dice arriba.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  -- md5(prosrc) de cita_correos_pendientes tal como la deja E4: el cuerpo de
  -- la función nueva es copia de ése; si cambió, hay que revisar la copia.
  c_md5_e4     CONSTANT text := 'a8b08c15c9f44c50a8a2f8d4aeff08ee';
  -- md5(prosrc) de la función nueva tal como la deja esta migración.
  c_md5_h2     CONSTANT text := 'be18fa7735f7bf072bdc8178125694d0';
  v_md5        text;
  v_tipo       regtype;
  v_nulo       boolean;
  v_def        text;
BEGIN
  IF to_regclass('public.agenda_ajustes') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta public.agenda_ajustes (B1).';
  END IF;
  IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = 'public.agenda_ajustes'::regclass), 'USAGE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el rol % no es dueño de public.agenda_ajustes.', current_user;
  END IF;
  SELECT md5(prosrc) INTO v_md5 FROM pg_proc
   WHERE oid = to_regprocedure('public.cita_correos_pendientes(integer)') AND NOT prosecdef;
  IF v_md5 IS DISTINCT FROM c_md5_e4 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: cita_correos_pendientes(integer) no es la de E4 (md5 %); revisar la copia antes de crear la nueva.', coalesce(v_md5, 'AUSENTE');
  END IF;
  IF to_regprocedure('public.gcal_sync_clinica_habilitada(uuid)') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta gcal_sync_clinica_habilitada(uuid) (C1).';
  END IF;
  -- Replay: si la columna ya existe, tiene que ser ÉSTA (boolean, NOT NULL, DEFAULT false).
  SELECT a.atttypid::regtype, NOT a.attnotnull, pg_get_expr(d.adbin, d.adrelid)
    INTO v_tipo, v_nulo, v_def
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
   WHERE a.attrelid = 'public.agenda_ajustes'::regclass AND a.attname = 'recordatorio_encendido' AND NOT a.attisdropped;
  IF FOUND AND (v_tipo IS DISTINCT FROM 'boolean'::regtype OR v_nulo OR v_def IS DISTINCT FROM 'false') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: agenda_ajustes.recordatorio_encendido ya existe con otra forma (%, nulo %, default %).', v_tipo, v_nulo, v_def;
  END IF;
  -- Replay: si la función nueva ya existe, tiene que ser la de esta migración.
  SELECT md5(prosrc) INTO v_md5 FROM pg_proc WHERE oid = to_regprocedure('public.cita_recordatorios_pendientes(integer)');
  IF v_md5 IS NOT NULL AND v_md5 <> c_md5_h2 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: cita_recordatorios_pendientes(integer) ya existe con otro cuerpo (md5 %).', v_md5;
  END IF;
  IF (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'cita_recordatorios_pendientes') > 1 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: hay más de una cita_recordatorios_pendientes (sobrecarga).';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · La columna. DEFAULT constante: sin reescritura de la tabla.
-- ---------------------------------------------------------------------
ALTER TABLE public.agenda_ajustes ADD COLUMN IF NOT EXISTS recordatorio_encendido boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.agenda_ajustes.recordatorio_encendido IS
  'Recordatorio automático por correo (tanda H, punto 9). APAGADO de fábrica: sólo con true la tarea /api/cron/recordatorios lista las citas de esta clínica (cita_recordatorios_pendientes). No afecta al código ni al comprobante de la reserva por enlace ni a la confirmación que manda el personal. Lo cambia el administrador de la clínica desde la configuración (policy de UPDATE de B1).';

-- ---------------------------------------------------------------------
-- 3 · El listado de la tarea, con el interruptor. Cuerpo de E4 + UNA
--     condición (`AND j.recordatorio_encendido`, al final).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cita_recordatorios_pendientes(p_limite integer)
RETURNS TABLE (r_clinica_id uuid, r_cita_id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
  SELECT x.clinica_id, x.id
    FROM public.agenda_ajustes j
   CROSS JOIN LATERAL (
     SELECT a.clinica_id, a.id, a.start_time
       FROM public.appointments a
       LEFT JOIN public.pacientes p ON p.id = a.paciente_id AND p.clinica_id = a.clinica_id
      WHERE a.clinica_id = j.clinica_id
        AND a.start_time >  now() + interval '1 hour'
        AND a.start_time <= now() + make_interval(hours => j.recordatorio_horas)
        AND a.status IN ('scheduled', 'confirmed') AND NOT a.all_day
        -- ⚠️ Destinatario: la MISMA expresión que cita_correo_tomar.
        AND (CASE WHEN a.paciente_id IS NOT NULL
                  THEN CASE WHEN p.activo IS NOT FALSE THEN coalesce(nullif(btrim(p.email), ''), nullif(btrim(a.reserva_correo), '')) END
                  ELSE CASE WHEN a.reserva_canal IS NOT NULL THEN nullif(btrim(a.reserva_correo), '') END END) IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.cita_correos k
                         WHERE k.appointment_id = a.id AND k.clinica_id = a.clinica_id AND k.inicio_cita = a.start_time
                           AND ((k.tipo = 'comprobante'
                                 AND (k.estado = 'enviado'
                                   OR (k.estado = 'enviando' AND k.tomado_en > now() - interval '10 minutes')))
                             OR (k.tipo = 'recordatorio'
                                 AND (k.estado IN ('enviado', 'omitido')
                                   OR (k.estado = 'fallido' AND (k.intentos >= 3 OR k.motivo = 'duplicado'))
                                   OR (k.estado = 'enviando' AND (k.tomado_en > now() - interval '10 minutes' OR k.intentos >= 3))))))
      ORDER BY a.start_time
      LIMIT least(greatest(coalesce(p_limite, 0), 0), 500)
   ) x
   WHERE j.agenda_v2_encendida
     AND public.gcal_sync_clinica_habilitada(j.clinica_id)
     AND j.recordatorio_encendido
   ORDER BY x.start_time
   LIMIT least(greatest(coalesce(p_limite, 0), 0), 500);
$fn$;

-- Permisos de funciones (CLAUDE.md): sólo service_role, como la de E4. Es la
-- única lectura entre clínicas de la tarea programada; ni la consola ni una
-- sesión de la app deben listar citas de otras clínicas.
REVOKE EXECUTE ON FUNCTION public.cita_recordatorios_pendientes(integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cita_recordatorios_pendientes(integer) TO service_role;

COMMENT ON FUNCTION public.cita_recordatorios_pendientes(integer) IS
  'Listado ENTRE CLÍNICAS de recordatorios por mandar (sólo ids), para /api/cron/recordatorios. Igual que cita_correos_pendientes (E4) más el interruptor agenda_ajustes.recordatorio_encendido (tanda H, punto 9). CONVENIO: la expresión del destinatario va junta con la de cita_correo_tomar.';

COMMIT;

-- ---------------------------------------------------------------------
-- 4 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO' WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'columna recordatorio_encendido: tipo / NOT NULL / default' AS comprobacion,
         coalesce((SELECT format_type(a.atttypid, a.atttypmod) || ' / ' || a.attnotnull::text || ' / ' || pg_get_expr(d.adbin, d.adrelid)
                     FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
                    WHERE a.attrelid = 'public.agenda_ajustes'::regclass AND a.attname = 'recordatorio_encendido' AND NOT a.attisdropped), 'AUSENTE') AS valor,
         'boolean / true / false' AS esperado
  UNION ALL
  SELECT 2, 'cita_recordatorios_pendientes: cuerpo de esta migración (md5)',
         coalesce((SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.cita_recordatorios_pendientes(integer)')), 'AUSENTE'),
         'be18fa7735f7bf072bdc8178125694d0'
  UNION ALL
  SELECT 3, 'cita_recordatorios_pendientes: INVOKER / search_path vacío / STABLE',
         coalesce((SELECT (NOT prosecdef)::text || ' / ' || (proconfig @> ARRAY['search_path=""'])::text || ' / ' || provolatile::text
                    FROM pg_proc WHERE oid = to_regprocedure('public.cita_recordatorios_pendientes(integer)')), 'AUSENTE'),
         'true / true / s'
  UNION ALL
  SELECT 4, 'EXECUTE anon,authenticated,service_role / PUBLIC',
         coalesce((SELECT has_function_privilege('anon', p.oid, 'EXECUTE')::text || ',' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                    || ',' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text || ' / '
                    || EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x WHERE x.grantee = 0 AND x.privilege_type = 'EXECUTE')::text
                    FROM pg_proc p WHERE p.oid = to_regprocedure('public.cita_recordatorios_pendientes(integer)')), 'AUSENTE'),
         'false,false,true / false'
  UNION ALL
  SELECT 5, 'cita_correos_pendientes (E4) intacta (md5)',
         coalesce((SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.cita_correos_pendientes(integer)')), 'AUSENTE'),
         'a8b08c15c9f44c50a8a2f8d4aeff08ee'
  UNION ALL
  SELECT 6, 'policies de agenda_ajustes, intactas',
         coalesce((SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agenda_ajustes'), 'NINGUNA'),
         'agenda_ajustes_insert,agenda_ajustes_select,agenda_ajustes_update'
  UNION ALL
  SELECT 7, 'clínicas con el recordatorio encendido',
         (SELECT count(*)::text FROM public.agenda_ajustes WHERE recordatorio_encendido),
         NULL
) t
ORDER BY t.n;
