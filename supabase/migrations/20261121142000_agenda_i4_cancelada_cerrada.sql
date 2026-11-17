-- ═══════════════════════════════════════════════════════════════════════
-- Agenda · tanda I, punto 12 de Angel — una cita CANCELADA que se sustituye
-- («Reagendar» o «Reasignar» desde su tarjeta) queda CERRADA y LIGADA a la
-- que la sustituyó: no se borra, deja de pintarse en la agenda
-- Rama: feature/agenda-v2-i4 · Escrita: 2026-11-17
-- Riesgo estimado: MEDIO (dos columnas nuevas NULLABLE en appointments, una
-- FK a sí misma con RESTRICT, un CHECK y un índice parcial; un disparador
-- BEFORE INSERT OR UPDATE nuevo. Ninguna policy, ningún permiso de tabla y
-- ningún dato existente cambian: todas las filas quedan con las dos en NULL).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-11-17
--   `docker exec -i supabase_db_app_ortointegra psql -U postgres -v ON_ERROR_STOP=1 -f`
--   del archivo completo: un ensayo con ROLLBACK y luego dos pasadas seguidas (rejilla
--   10 × OK las dos; la segunda sin cambios, sólo NOTICEs). Registrada en
--   supabase_migrations.schema_migrations. Pruebas: supabase/pruebas-sql/i4_*.sql.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de 20261117121000, cuyo
--   disparador cita_proteger_reserva convive con éste).
-- AUDITORÍA INDEPENDIENTE 2026-11-17 (otro modelo, las dimensiones de
--   supabase/AUDITORIA-MIGRACIONES.md, con lectura del catálogo local y de
--   las 7 funciones que escriben appointments, todas INVOKER): APTA CON
--   CAMBIOS (menores), aplicados y reaplicados en local (ensayo + dos
--   pasadas): la sustituta tiene que estar VIVA (ni cancelada ni cerrada:
--   sin cadenas ni pares que se escondan entre sí; caso 3 nuevo en la prueba,
--   comprobado en rojo); el pre-vuelo del CHECK de status ya no pasa en
--   silencio si el CHECK falta (coalesce); el renglón 8 de la rejilla mira la
--   coherencia del par y no el censo (verdad en cualquier pasada); orden real
--   de los disparadores y bloqueos corregidos en la cabecera. Notas sin
--   cambio: una cancelada cerrada sin paciente ni reserva se puede seguir
--   borrando como hoy (appointments_delete); la vuelta atrás requiere el
--   esquema respaldos.
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Punto 12 de Angel (2026-11-17): «Al completar cualquiera de las dos, la
-- cancelada desaparece de la interfaz y el hueco queda libre para hacer clic.
-- NO se borra: se conserva en la base y en la auditoría, marcada como cerrada
-- y ligada a la cita que la sustituyó. Si nadie usa ninguna de las dos, la
-- cancelada se queda como está; no se oculta sola.»
--
-- ═══ QUÉ CREA ══════════════════════════════════════════════════════════
-- appointments.cerrada_en timestamptz NULL — cuándo se sustituyó.
-- appointments.sustituida_por uuid NULL REFERENCES appointments(id)
--   ON DELETE RESTRICT — la cita que la sustituyó (CLAUDE.md: nunca CASCADE;
--   la sustituta no se puede borrar mientras la cerrada la señale; la API ya
--   traduce el 23503 del DELETE a 409).
-- appointments_cierre_check — o las dos NULL (abierta), o las dos puestas,
--   con la sustituta distinta de sí misma y la fila CANCELADA. Valida las
--   filas de hoy (todas NULL: pasan).
-- idx_appointments_sustituida_por — parcial (sólo las cerradas): el chequeo
--   de la FK al borrar cualquier cita usa el índice y no recorre la tabla.
-- cita_proteger_cierre() + trg_appointments_proteger_cierre (BEFORE INSERT OR
--   UPDATE OF status, cerrada_en, sustituida_por), INVOKER, search_path = '':
--   · ninguna cita NACE cerrada (salvo postgres/supabase_admin);
--   · cerrar (poner las dos columnas) sólo service_role —el servidor, en
--     POST /api/appointments con `sustituye_a`, filtrado por la clínica de la
--     sesión—, sólo sobre una cancelada que sigue cancelada, con una
--     sustituta de la MISMA clínica (lee appointments por su id: es un
--     disparador, no una policy; sin recursión posible);
--   · una cerrada no se reabre: ni su estado ni sus dos columnas cambian
--     (Google, C-e, ya no reabre canceladas; esto lo cierra también por
--     PostgREST directo y por el formulario).
--   postgres/supabase_admin quedan fuera (editor SQL, semilla, e2e), como en
--   B1, D1, seg2 y H5. Patrón de cita_proteger_reserva (seg2): la sesión no
--   escribe columnas que sólo debe escribir el servidor.
--
-- ═══ CHOQUES CON LO QUE YA EXISTE (comprobados) ═══════════════════════
-- log_cita_change / audit_appointments_update (B0): las dos columnas NO están
--   en la lista de técnicas, así que cerrar deja una fila 'cita_editada' con
--   campos ["cerrada_en","sustituida_por"] (nombres, nunca valores). La ruta
--   añade además un logAudit 'cita_sustituida' a nombre de quien pulsó.
-- trg_appointments_reserva_incidencia (D2): sólo con cambio de estado;
--   cerrar no cambia el estado: la cancelación ya contó para el candado y
--   sigue contando igual.
-- trg_appointments_proteger_borrado (seg2) y _atendida (H5): otras
--   condiciones; ninguno cambia NEW. El orden de los BEFORE es alfabético
--   (asignacion_google < atendida < borrado < cierre < eleccion < reserva,
--   comprobado en pg_trigger); ninguno depende del otro.
-- trg_appointments_proteger_reserva (seg2): lista las columnas por el
--   prefijo reserva_; éstas no lo llevan.
-- reserva_ocupacion, empalmes (P3): una cancelada no ocupa, cerrada o no.
-- reagendar_por_enlace (E6): parte de una cancelada y crea OTRA cita; no
--   reabre la de origen, así que no choca (ver notas de I4: no se le añadió
--   que la de origen esté abierta).
-- Las lecturas de la agenda (consultaCitas) quitan las cerradas en el
--   servidor; Google no las ve distinto (siguen como «CANCELADA — »).
-- spinus-consola: dos columnas NUEVAS; ninguna existente cambia.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere 20261117121000 (seg2) y PG ≥ 14 (CREATE OR REPLACE TRIGGER).
-- Bloqueos (lock_timeout 5 s): ADD COLUMN y ADD CHECK toman ACCESS EXCLUSIVE,
--   ADD FOREIGN KEY SHARE ROW EXCLUSIVE y CREATE INDEX SHARE sobre
--   appointments mientras validan y construyen (tabla pequeña: un instante).
-- Orden respecto al código: PRIMERO esta migración si la v2 está encendida.
--   El código sólo NOMBRA las columnas con la v2 encendida (cerrar al crear
--   la sustituta, el buscador); la lectura de la agenda las filtra en el
--   servidor sin nombrarlas (columna ausente = ninguna cerrada).
-- Alcance de los roles:
--   pierde — authenticated: escribir cerrada_en/sustituida_por (nunca lo
--            hizo) y reabrir una cerrada. service_role: reabrir una cerrada.
--   gana   — service_role: cerrar una cancelada (con las condiciones de arriba).
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   Respaldar antes:
--     CREATE TABLE respaldos.appointments_cierre_AAAAMMDD AS
--       SELECT id, cerrada_en, sustituida_por FROM public.appointments WHERE cerrada_en IS NOT NULL;
--   DROP TRIGGER IF EXISTS trg_appointments_proteger_cierre ON public.appointments;
--   DROP FUNCTION IF EXISTS public.cita_proteger_cierre();
--   ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_cierre_check;
--   DROP INDEX IF EXISTS public.idx_appointments_sustituida_por;
--   ALTER TABLE public.appointments DROP COLUMN IF EXISTS sustituida_por, DROP COLUMN IF EXISTS cerrada_en;
--   (Las cerradas vuelven a pintarse en la agenda como canceladas.)
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
        AND (attname, atttypid) IN (('id', 'uuid'::regtype), ('clinica_id', 'uuid'::regtype), ('status', 'text'::regtype))) <> 3 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: appointments sin id, clinica_id o status con su tipo.';
  END IF;
  IF coalesce(pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conname = 'appointments_status_check'
                            AND conrelid = 'public.appointments'::regclass)), '') !~ '''cancelled''' THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el CHECK de appointments.status no tiene ''cancelled''.';
  END IF;
  -- Re-ejecución: las columnas, si existen, con su tipo; la función, invoker.
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass AND NOT attisdropped
              AND ((attname = 'cerrada_en' AND atttypid <> 'timestamptz'::regtype)
                OR (attname = 'sustituida_por' AND atttypid <> 'uuid'::regtype))) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: cerrada_en o sustituida_por ya existen con otro tipo.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('public.cita_proteger_cierre()') AND prosecdef) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: cita_proteger_cierre() existe como SECURITY DEFINER; tiene que ser invoker.';
  END IF;
  -- El disparador de seg2 que convive con éste (no se toca).
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.appointments'::regclass
                  AND tgname = 'trg_appointments_proteger_reserva' AND tgenabled = 'O') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta trg_appointments_proteger_reserva (20261117121000).';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · Columnas, FK, CHECK e índice.
-- ---------------------------------------------------------------------
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS cerrada_en timestamptz,
  ADD COLUMN IF NOT EXISTS sustituida_por uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.appointments'::regclass
                  AND conname = 'appointments_sustituida_por_fkey') THEN
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_sustituida_por_fkey
      FOREIGN KEY (sustituida_por) REFERENCES public.appointments (id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.appointments'::regclass
                  AND conname = 'appointments_cierre_check') THEN
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_cierre_check CHECK (
      (cerrada_en IS NULL AND sustituida_por IS NULL)
      OR (cerrada_en IS NOT NULL AND sustituida_por IS NOT NULL AND sustituida_por <> id AND status = 'cancelled'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_appointments_sustituida_por
  ON public.appointments (sustituida_por) WHERE sustituida_por IS NOT NULL;

COMMENT ON COLUMN public.appointments.cerrada_en IS
  'Agenda v2 (tanda I, punto 12): cuándo esta cita CANCELADA se sustituyó por otra («Reagendar» o «Reasignar» de su tarjeta). No nula = cerrada: no se pinta en la agenda, no se reabre y sigue contando para el candado. La escribe sólo el servidor (service_role, cita_proteger_cierre).';
COMMENT ON COLUMN public.appointments.sustituida_por IS
  'Agenda v2 (tanda I, punto 12): la cita que sustituyó a esta cancelada (misma clínica). FK RESTRICT: la sustituta no se borra mientras ésta la señale. La escribe sólo el servidor, junto con cerrada_en.';

-- ---------------------------------------------------------------------
-- 3 · El disparador. INVOKER: tiene que ver QUIÉN escribe (current_user).
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
  -- Ya cerrada: no se reabre ni cambia de sustituta.
  IF OLD.cerrada_en IS NOT NULL THEN
    IF (NEW.status, NEW.cerrada_en, NEW.sustituida_por) IS DISTINCT FROM (OLD.status, OLD.cerrada_en, OLD.sustituida_por) THEN
      RAISE EXCEPTION 'Una cita cancelada que ya se sustituyó no se reabre'
        USING ERRCODE = '42501', HINT = 'Se sustituyó por otra cita; se conserva como cancelada';
    END IF;
    RETURN NEW;
  END IF;
  -- Abierta: cerrar sólo el servidor, sólo una cancelada, con una sustituta VIVA (ni cancelada ni
  -- cerrada: así no hay cadenas ni pares que se escondan entre sí) de la misma clínica.
  IF (NEW.cerrada_en, NEW.sustituida_por) IS DISTINCT FROM (OLD.cerrada_en, OLD.sustituida_por) THEN
    IF current_user <> 'service_role' OR OLD.status IS DISTINCT FROM 'cancelled' OR NEW.status IS DISTINCT FROM 'cancelled'
       OR NEW.cerrada_en IS NULL OR NEW.sustituida_por IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.appointments s
                       WHERE s.id = NEW.sustituida_por AND s.id <> NEW.id AND s.clinica_id = NEW.clinica_id
                         AND s.status IS DISTINCT FROM 'cancelled' AND s.cerrada_en IS NULL) THEN
      RAISE EXCEPTION 'Sólo el servidor cierra una cita cancelada, con una sustituta viva de la misma clínica'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END
$fn$;

-- Permisos de funciones (CLAUDE.md): sin PUBLIC, explícitos a los tres roles
-- (la ejecuta el disparador como quien escribe).
REVOKE EXECUTE ON FUNCTION public.cita_proteger_cierre() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cita_proteger_cierre() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.cita_proteger_cierre() IS
  'Agenda v2 (tanda I, punto 12): cerrada_en/sustituida_por de appointments sólo los pone service_role, sólo sobre una cancelada y con una sustituta de la misma clínica; ninguna cita nace cerrada y una cerrada no se reabre (ni estado ni cierre). 42501. postgres y supabase_admin quedan fuera.';

CREATE OR REPLACE TRIGGER trg_appointments_proteger_cierre
  BEFORE INSERT OR UPDATE OF status, cerrada_en, sustituida_por ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.cita_proteger_cierre();

COMMIT;

-- ---------------------------------------------------------------------
-- 4 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'columnas nuevas: tipo, NULL, sin DEFAULT' AS comprobacion,
         (SELECT string_agg(a.attname || ' ' || format_type(a.atttypid, a.atttypmod) || ' ' || (NOT a.attnotnull)::text || ' ' || (NOT a.atthasdef)::text, ', ' ORDER BY a.attname)
            FROM pg_attribute a WHERE a.attrelid = 'public.appointments'::regclass AND a.attname IN ('cerrada_en', 'sustituida_por') AND NOT a.attisdropped) AS valor,
         'cerrada_en timestamp with time zone true true, sustituida_por uuid true true' AS esperado
  UNION ALL
  SELECT 2, 'FK sustituida_por → appointments(id) ON DELETE RESTRICT',
         coalesce((SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.appointments'::regclass AND conname = 'appointments_sustituida_por_fkey'), 'AUSENTE'),
         'FOREIGN KEY (sustituida_por) REFERENCES appointments(id) ON DELETE RESTRICT'
  UNION ALL
  SELECT 3, 'CHECK del cierre, validado',
         coalesce((SELECT convalidated::text FROM pg_constraint WHERE conrelid = 'public.appointments'::regclass AND conname = 'appointments_cierre_check'), 'AUSENTE'),
         'true'
  UNION ALL
  SELECT 4, 'índice parcial de sustituida_por',
         coalesce((SELECT pg_get_indexdef(indexrelid) FROM pg_index WHERE indexrelid = to_regclass('public.idx_appointments_sustituida_por')), 'AUSENTE'),
         'CREATE INDEX idx_appointments_sustituida_por ON public.appointments USING btree (sustituida_por) WHERE (sustituida_por IS NOT NULL)'
  UNION ALL
  SELECT 5, 'disparador BEFORE INSERT OR UPDATE OF … en appointments',
         coalesce((SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid = 'public.appointments'::regclass
                    AND tgname = 'trg_appointments_proteger_cierre' AND tgenabled = 'O'), 'AUSENTE'),
         'CREATE TRIGGER trg_appointments_proteger_cierre BEFORE INSERT OR UPDATE OF status, cerrada_en, sustituida_por ON public.appointments FOR EACH ROW EXECUTE FUNCTION cita_proteger_cierre()'
  UNION ALL
  SELECT 6, 'función: INVOKER / search_path vacío',
         coalesce((SELECT (NOT prosecdef)::text || ' / ' || (proconfig @> ARRAY['search_path=""'])::text
                    FROM pg_proc WHERE oid = to_regprocedure('public.cita_proteger_cierre()')), 'AUSENTE'),
         'true / true'
  UNION ALL
  SELECT 7, 'EXECUTE anon,authenticated,service_role / PUBLIC',
         coalesce((SELECT has_function_privilege('anon', p.oid, 'EXECUTE')::text || ',' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                    || ',' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text || ' / '
                    || EXISTS (SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee = 0 AND x.privilege_type = 'EXECUTE')::text
                    FROM pg_proc p WHERE p.oid = to_regprocedure('public.cita_proteger_cierre()')), 'AUSENTE'),
         'true,true,true / false'
  UNION ALL
  SELECT 8, 'ninguna cita con una sola de las dos columnas del cierre',
         (SELECT count(*)::text FROM public.appointments WHERE (cerrada_en IS NULL) <> (sustituida_por IS NULL)),
         '0'
  UNION ALL
  SELECT 9, 'las 5 policies de appointments, intactas (nombres)',
         (SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'appointments'),
         'appointments_delete,appointments_gates_insert,appointments_insert,appointments_select,appointments_update'
  UNION ALL
  SELECT 10, 'los disparadores de seg2 y H5 siguen',
         (SELECT count(*)::text FROM pg_trigger WHERE tgrelid = 'public.appointments'::regclass AND tgenabled = 'O'
            AND tgname IN ('trg_appointments_proteger_borrado', 'trg_appointments_proteger_reserva', 'trg_appointments_proteger_atendida')),
         '3'
) t
ORDER BY t.n;
