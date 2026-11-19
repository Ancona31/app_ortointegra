-- ═══════════════════════════════════════════════════════════════════════
-- Agenda · tanda L, punto 9 de Angel — «Eliminar cita» en la burbuja de una
-- cita CANCELADA: la quita de la agenda SIN borrarla. Queda CERRADA, como al
-- reasignar (20261121142000), pero SIN sustituta.
-- Rama: feature/agenda-v2-l2 · Escrita: 2026-11-18
-- Riesgo estimado: BAJO (se AFLOJA un CHECK y una condición del disparador
-- cita_proteger_cierre; ninguna columna, ninguna policy, ningún permiso de
-- tabla y ningún dato cambian. Las filas de hoy cumplen el CHECK nuevo porque
-- es estrictamente más ancho que el viejo).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: ver «APLICACIÓN LOCAL» al final de esta cabecera.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de 20261121142000).
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Punto 9 de Angel (2026-11-18): «La burbuja de una cancelada conserva
-- "Darle otra cita" y "Reasignar el horario", y suma "Eliminar cita".
-- "Eliminar" la quita de la agenda con una confirmación, pero NO la borra de
-- la base: queda cerrada, como ya pasa al reasignar, y en audit_log. No toques
-- el disparador que impide borrar citas con paciente.»
--
-- Hoy cerrar EXIGE una sustituta: appointments_cierre_check pide las dos
-- columnas a la vez, y cita_proteger_cierre rechaza `sustituida_por` NULL.
-- «Eliminar» no tiene sustituta. Sin aflojar las dos cosas, no hay forma de
-- cerrar sin borrar (y borrar está vetado por cita_proteger_borrado, que NO
-- se toca).
--
-- ═══ QUÉ CAMBIA ════════════════════════════════════════════════════════
-- appointments_cierre_check (se vuelve a crear, más ancho):
--   antes — (cerrada_en NULL y sustituida_por NULL)
--           o (las dos puestas, sustituida_por <> id, status 'cancelled');
--   ahora — (cerrada_en NULL y sustituida_por NULL)
--           o (cerrada_en puesta, status 'cancelled' y, SI hay sustituta,
--              sustituida_por <> id).
--   Sigue sin poder haber sustituta sin cierre, ni cierre de una no cancelada.
--   Cerrada SIN sustituta = «la quitaron de la agenda» (punto 9); CON
--   sustituta = «se reasignó o se le dio otra cita» (tanda I).
-- cita_proteger_cierre() (CREATE OR REPLACE: conserva sus permisos; se
--   repiten igual): en la rama «abierta», cerrar acepta `sustituida_por`
--   NULL. TODO lo demás queda como estaba: sólo service_role, sólo una
--   cancelada que sigue cancelada, `cerrada_en` puesta; SI viene sustituta,
--   viva y de la misma clínica; ninguna nace cerrada; una cerrada no se
--   reabre ni cambia de sustituta (tampoco se le puede PONER una después).
--
-- ═══ CHOQUES CON LO QUE YA EXISTE (comprobados) ═══════════════════════
-- cita_proteger_borrado (seg2): NO se toca y no interviene (esto es un
--   UPDATE, no un DELETE).
-- La FK appointments_sustituida_por_fkey (RESTRICT) y su índice parcial: con
--   NULL no señalan a nadie; nada cambia.
-- log_cita_change / audit_appointments_update (B0): cerrar sin sustituta
--   deja la fila 'cita_editada' con campos ["cerrada_en"] (nombres, nunca
--   valores). La ruta añade un logAudit 'cita_quitada_de_agenda' a nombre de
--   quien pulsó.
-- trg_appointments_reserva_incidencia (D2): sólo con cambio de estado;
--   cerrar no cambia el estado: lo que contó la cancelación para el candado
--   sigue contando igual.
-- Las lecturas de la agenda (consultaCitas), el tiempo real
--   (useTiempoRealAgenda: `if (fila.cerrada_en)` la quita), el buscador
--   (`.is('cerrada_en', null)`) y «Próximas citas» (sólo agendadas y
--   confirmadas) ya ocultan cualquier cerrada: no miran `sustituida_por`.
-- sustitucionServidor.comprobarSustituible: una cerrada sin sustituta da
--   409 al intentar reasignarla (cerradaPorEsteReintento con NULL = false),
--   que es lo correcto: ya no está en la agenda.
-- spinus-consola: no lee ni cerrada_en ni sustituida_por; ninguna columna
--   existente cambia de nombre, tipo ni significado.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere 20261121142000 (columnas, CHECK, FK, disparador).
-- Bloqueos (lock_timeout 5 s): DROP/ADD CONSTRAINT CHECK toma ACCESS
--   EXCLUSIVE sobre appointments mientras valida (tabla pequeña: un
--   instante). CREATE OR REPLACE FUNCTION no bloquea la tabla.
-- Orden respecto al código: PRIMERO esta migración. Sin ella, la ruta nueva
--   (POST /api/appointments/[id]/quitar, sólo con la v2 encendida) recibe el
--   42501/23514 del cierre y responde 409 `no_aplica`: no rompe nada, sólo
--   no quita la cita.
-- Alcance de los roles:
--   gana   — service_role: cerrar una cancelada SIN sustituta.
--   pierde — nadie.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   ⚠️ Antes, decidir qué hacer con las cerradas sin sustituta: el CHECK viejo
--   no las admite. Respaldo:
--     CREATE TABLE respaldos.appointments_quitadas_AAAAMMDD AS
--       SELECT id, cerrada_en FROM public.appointments WHERE cerrada_en IS NOT NULL AND sustituida_por IS NULL;
--   y, como postgres (el disparador lo deja pasar), reabrirlas:
--     UPDATE public.appointments SET cerrada_en = NULL WHERE cerrada_en IS NOT NULL AND sustituida_por IS NULL;
--   (Reabiertas, vuelven a pintarse en la agenda como canceladas. Si el esquema
--   respaldos no existe en producción: CREATE SCHEMA IF NOT EXISTS respaldos.)
--   Después, volver a pegar el CHECK y la función de 20261121142000 (bloques
--   2 y 3), con sus REVOKE/GRANT.
--
-- ═══ AUDITORÍA INDEPENDIENTE ═══════════════════════════════════════════
-- 2026-11-18, otro modelo, con las dimensiones de supabase/AUDITORIA-MIGRACIONES.md
--   y lectura del catálogo local: APTA CON CAMBIOS, todos menores y de
--   documentación o cobertura, aplicados: estas dos secciones (que la cabecera
--   citaba y faltaban); el pre-vuelo del CHECK declarado como comprobación de
--   cordura (la rejilla compara la definición entera); la vuelta atrás dice que
--   las reabiertas reaparecen y cómo crear respaldos; la prueba SQL prueba el
--   CHECK solo, como postgres (que salta el disparador). Sin hallazgos de
--   seguridad ni de integridad: CHECK estrictamente más ancho; ninguna ruta de
--   src asume «cerrada ⇒ con sustituta» (sólo miran cerrada_en).
--
-- ═══ APLICACIÓN LOCAL ══════════════════════════════════════════════════
-- 2026-11-18: ensayo con ROLLBACK y dos pasadas, bajo flock, en la base local
--   compartida (rejilla 8 × OK las dos). Prueba: supabase/pruebas-sql/
--   l2_quitar_cancelada.sql, en rojo sin la migración (caso 2) y en verde con ella.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = 'public.appointments'::regclass), 'USAGE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el rol % no es dueño de public.appointments.', current_user;
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass AND NOT attisdropped
        AND (attname, atttypid) IN (('cerrada_en', 'timestamptz'::regtype), ('sustituida_por', 'uuid'::regtype))) <> 2 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: faltan cerrada_en/sustituida_por (20261121142000).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.appointments'::regclass
                  AND tgname = 'trg_appointments_proteger_cierre' AND tgenabled = 'O') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta trg_appointments_proteger_cierre (20261121142000).';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('public.cita_proteger_cierre()') AND prosecdef) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: cita_proteger_cierre() es SECURITY DEFINER; tiene que ser invoker.';
  END IF;
  -- Sólo cordura: el CHECK, si existe, habla del cierre. Se rehace entero en el bloque 2 y la
  -- rejilla (fila 1) compara su definición completa.
  IF coalesce(pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conname = 'appointments_cierre_check'
                                     AND conrelid = 'public.appointments'::regclass)), 'cerrada_en') !~ 'cerrada_en' THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: appointments_cierre_check existe con otra definición.';
  END IF;
  -- El disparador que impide borrar citas con paciente sigue (no se toca).
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.appointments'::regclass
                  AND tgname = 'trg_appointments_proteger_borrado' AND tgenabled = 'O') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta trg_appointments_proteger_borrado (seg2).';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · El CHECK, más ancho. Las filas de hoy cumplen el viejo, luego el nuevo.
-- ---------------------------------------------------------------------
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_cierre_check;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_cierre_check CHECK (
  (cerrada_en IS NULL AND sustituida_por IS NULL)
  OR (cerrada_en IS NOT NULL AND status = 'cancelled' AND (sustituida_por IS NULL OR sustituida_por <> id)));

-- ---------------------------------------------------------------------
-- 3 · El disparador. INVOKER: tiene que ver QUIÉN escribe (current_user).
--     Único cambio de fondo: `NEW.sustituida_por IS NULL` ya no rechaza, y el
--     EXISTS de la sustituta sólo se exige si viene una.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cita_proteger_cierre()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.cerrada_en IS NOT NULL OR NEW.sustituida_por IS NOT NULL THEN
      RAISE EXCEPTION 'Una cita no nace cerrada' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  -- Ya cerrada: no se reabre ni cambia (ni se le pone) sustituta.
  IF OLD.cerrada_en IS NOT NULL THEN
    IF (NEW.status, NEW.cerrada_en, NEW.sustituida_por) IS DISTINCT FROM (OLD.status, OLD.cerrada_en, OLD.sustituida_por) THEN
      RAISE EXCEPTION 'Una cita cancelada que ya se cerró no se reabre'
        USING ERRCODE = '42501', HINT = 'Se sustituyó por otra cita o se quitó de la agenda; se conserva como cancelada';
    END IF;
    RETURN NEW;
  END IF;
  -- Abierta: cerrar sólo el servidor, sólo una cancelada que sigue cancelada. Sin sustituta
  -- (tanda L, punto 9: «Eliminar cita») o con una sustituta VIVA (ni cancelada ni cerrada: sin
  -- cadenas ni pares que se escondan entre sí) de la misma clínica (tanda I, punto 12).
  IF (NEW.cerrada_en, NEW.sustituida_por) IS DISTINCT FROM (OLD.cerrada_en, OLD.sustituida_por) THEN
    IF current_user <> 'service_role' OR OLD.status IS DISTINCT FROM 'cancelled' OR NEW.status IS DISTINCT FROM 'cancelled'
       OR NEW.cerrada_en IS NULL
       OR (NEW.sustituida_por IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM public.appointments s
                            WHERE s.id = NEW.sustituida_por AND s.id <> NEW.id AND s.clinica_id = NEW.clinica_id
                              AND s.status IS DISTINCT FROM 'cancelled' AND s.cerrada_en IS NULL)) THEN
      RAISE EXCEPTION 'Sólo el servidor cierra una cita cancelada, sin sustituta o con una sustituta viva de la misma clínica'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END
$fn$;

-- Permisos de funciones (CLAUDE.md): sin PUBLIC, explícitos a los tres roles
-- (la ejecuta el disparador como quien escribe). CREATE OR REPLACE los
-- conserva; se repiten para que el archivo sea autosuficiente.
REVOKE EXECUTE ON FUNCTION public.cita_proteger_cierre() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cita_proteger_cierre() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.cita_proteger_cierre() IS
  'Agenda v2 (tanda I, punto 12; tanda L, punto 9): cerrada_en/sustituida_por de appointments sólo los pone service_role, sólo sobre una cancelada que sigue cancelada; sin sustituta («Eliminar cita») o con una sustituta viva de la misma clínica; ninguna cita nace cerrada y una cerrada no se reabre (ni estado ni cierre ni sustituta). 42501. postgres y supabase_admin quedan fuera.';
COMMENT ON COLUMN public.appointments.cerrada_en IS
  'Agenda v2: cuándo esta cita CANCELADA dejó la agenda. Con sustituta (sustituida_por): se le dio otra cita o se reasignó su horario (tanda I, punto 12). Sin sustituta: se quitó con «Eliminar cita» (tanda L, punto 9). No nula = cerrada: no se pinta, no se reabre y sigue contando para el candado. La escribe sólo el servidor (service_role, cita_proteger_cierre).';

COMMIT;

-- ---------------------------------------------------------------------
-- 4 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'CHECK del cierre (nuevo), validado' AS comprobacion,
         coalesce((SELECT pg_get_constraintdef(oid) || ' / ' || convalidated::text FROM pg_constraint
                    WHERE conrelid = 'public.appointments'::regclass AND conname = 'appointments_cierre_check'), 'AUSENTE') AS valor,
         'CHECK ((((cerrada_en IS NULL) AND (sustituida_por IS NULL)) OR ((cerrada_en IS NOT NULL) AND (status = ''cancelled''::text) AND ((sustituida_por IS NULL) OR (sustituida_por <> id))))) / true' AS esperado
  UNION ALL
  SELECT 2, 'la función acepta cerrar sin sustituta (texto)',
         coalesce((SELECT (prosrc ~ 'NEW\.sustituida_por IS NOT NULL\s+AND NOT EXISTS')::text FROM pg_proc
                    WHERE oid = to_regprocedure('public.cita_proteger_cierre()')), 'AUSENTE'),
         'true'
  UNION ALL
  SELECT 3, 'función: INVOKER / search_path vacío',
         coalesce((SELECT (NOT prosecdef)::text || ' / ' || (proconfig @> ARRAY['search_path=""'])::text
                    FROM pg_proc WHERE oid = to_regprocedure('public.cita_proteger_cierre()')), 'AUSENTE'),
         'true / true'
  UNION ALL
  SELECT 4, 'EXECUTE anon,authenticated,service_role / PUBLIC',
         coalesce((SELECT has_function_privilege('anon', p.oid, 'EXECUTE')::text || ',' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                    || ',' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text || ' / '
                    || EXISTS (SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee = 0 AND x.privilege_type = 'EXECUTE')::text
                    FROM pg_proc p WHERE p.oid = to_regprocedure('public.cita_proteger_cierre()')), 'AUSENTE'),
         'true,true,true / false'
  UNION ALL
  SELECT 5, 'el disparador del cierre, igual (BEFORE INSERT OR UPDATE OF …)',
         coalesce((SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid = 'public.appointments'::regclass
                    AND tgname = 'trg_appointments_proteger_cierre' AND tgenabled = 'O'), 'AUSENTE'),
         'CREATE TRIGGER trg_appointments_proteger_cierre BEFORE INSERT OR UPDATE OF status, cerrada_en, sustituida_por ON public.appointments FOR EACH ROW EXECUTE FUNCTION cita_proteger_cierre()'
  UNION ALL
  SELECT 6, 'ninguna sustituta sin cierre; ninguna cerrada que no esté cancelada',
         (SELECT count(*)::text FROM public.appointments
           WHERE (cerrada_en IS NULL AND sustituida_por IS NOT NULL) OR (cerrada_en IS NOT NULL AND status <> 'cancelled')),
         '0'
  UNION ALL
  SELECT 7, 'las 5 policies de appointments, intactas (nombres)',
         (SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'appointments'),
         'appointments_delete,appointments_gates_insert,appointments_insert,appointments_select,appointments_update'
  UNION ALL
  SELECT 8, 'los disparadores de seg2 (borrado, reserva) y H5 siguen',
         (SELECT count(*)::text FROM pg_trigger WHERE tgrelid = 'public.appointments'::regclass AND tgenabled = 'O'
            AND tgname IN ('trg_appointments_proteger_borrado', 'trg_appointments_proteger_reserva', 'trg_appointments_proteger_atendida')),
         '3'
) t
ORDER BY t.n;
