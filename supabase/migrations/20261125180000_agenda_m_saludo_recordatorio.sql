-- ═══════════════════════════════════════════════════════════════════════
-- Agenda v2 · integración de la tanda M — el nombre del saludo del recordatorio
-- Rama: feature/agenda-v2 (integración M) · Escrita: 2026-11-19
-- Riesgo estimado: BAJO (una función NUEVA de sólo lectura, sólo para
-- service_role. Ninguna tabla, columna, fila, policy, disparador ni otra
-- función cambia).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: ver «APLICACIÓN LOCAL» al pie de esta cabecera.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR.
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Decisión de Angel en la integración M: «El recordatorio y el aviso de
-- cambio al reagendar saludan por nombre cuando lo hay, igual que el
-- comprobante. "Hola:" solo si no hay nombre.»
-- El aviso de cambio sale de una ruta con la sesión de quien reagenda y lee
-- el nombre con la RLS (no necesita nada de aquí). El RECORDATORIO lo manda
-- la tarea programada sin sesión, con el cliente de servicio, y
-- src/lib/confirmacion/recordatorios.ts sólo usa `.rpc()`, NUNCA `.from()`
-- (su regla, que viene del pendiente prioritario de CLAUDE.md). Ninguna RPC
-- de E4 devuelve el nombre. Por eso esta función, en vez de leer la tabla
-- con el cliente de servicio o de reemplazar cita_correo_tomar (que también
-- usan el comprobante y la confirmación, y cuyo cuerpo exigen otras
-- migraciones por md5).
--
-- ═══ QUÉ CAMBIA ════════════════════════════════════════════════════════
-- public.cita_nombre_saludo(p_clinica_id uuid, p_cita_id uuid) RETURNS text:
--   el nombre del paciente ligado (pacientes.nombre, el de pila) y, si no
--   hay, el que tecleó quien reservó (appointments.reserva_nombre); NULL sin
--   ninguno o si la cita no es de esa clínica. La MISMA regla y la misma
--   fuente que la confirmación del personal (src/app/api/agenda/correo/
--   route.ts: `pacientes.nombre || reserva_nombre`). Filtra por
--   p_clinica_id en la cita Y en el paciente.
--   Diferencia aceptada con esa ruta (la señaló la auditoría): la ruta lee
--   con la RLS de quien manda, y a quien no administra un paciente dado de
--   baja (activo = false) le queda oculto, así que su confirmación saluda
--   «Hola:»; aquí, con service_role, el recordatorio lo saluda por su nombre.
--   No es una fuga: el correo va a la dirección de ese mismo paciente.
--   LANGUAGE sql, STABLE, SECURITY INVOKER, search_path ''. La llama sólo
--   service_role, que salta la RLS: por eso INVOKER basta y no hace falta
--   DEFINER.
-- Permisos (CLAUDE.md «Permisos de funciones», la versión cerrada):
--   revoke from public, anon, authenticated; grant sólo a service_role.
--   Justificación: devuelve un dato de paciente (su nombre) por id de cita
--   sin mirar quién llama; abierta a authenticated, un médico de otra clínica
--   que adivinara un id leería un nombre. Sólo la usa la tarea programada.
--
-- Lo que NO hace: no toca cita_correo_tomar, ni appointments, ni pacientes,
-- ni la RLS. No escribe nada.
--
-- ═══ DEPENDENCIAS ══════════════════════════════════════════════════════
--   · public.appointments con id, clinica_id, paciente_id (baseline) y
--     reserva_nombre (20261114140000_agenda_d3_reservar);
--   · public.pacientes con id, clinica_id y nombre (baseline).
-- El pre-vuelo comprueba esas columnas y que no exista ya otra función con
-- ese nombre y otro cuerpo.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Bloqueos: crear una función no bloquea ninguna tabla (lock_timeout 5 s por
--   costumbre).
-- Orden respecto al código: cualquiera es seguro. Sin la función, el
--   recordatorio sale con «Hola:» (recordatorios.ts, `nombreDelSaludo`, no
--   lanza); con la función y el código viejo, nadie la llama.
-- Re-ejecutable: CREATE OR REPLACE con el mismo cuerpo (el pre-vuelo exige su
--   md5 si la función ya existe); los GRANT/REVOKE se repiten.
-- Alcance de los roles:
--   gana — service_role puede leer el nombre del saludo de una cita.
--   pierde — nadie.
-- Contrato con spinus-consola: no cambia ninguna columna, vista ni función
--   que la consola lea.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   DROP FUNCTION IF EXISTS public.cita_nombre_saludo(uuid, uuid);
--   (el recordatorio vuelve a «Hola:»).
--
-- ═══ AUDITORÍA INDEPENDIENTE ═══════════════════════════════════════════
-- 2026-11-19, Sonnet, sólo lectura, con supabase/AUDITORIA-MIGRACIONES.md:
-- APTA CON CAMBIOS, ninguno bloqueante. Aplicados: (1) un caso de prueba
-- para el filtro `p.clinica_id = a.clinica_id` (el paciente de otra clínica),
-- que antes no vigilaba nadie; (2) la nota de la diferencia aceptada con la
-- ruta de la confirmación (arriba, «QUÉ CAMBIA»). Anotado sin cambio:
-- BEGIN/COMMIT explícitos, como las migraciones vecinas. Recalculó el md5
-- del cuerpo (coincide) y confirmó aislamiento, permisos y search_path.
--
-- ═══ APLICACIÓN LOCAL ══════════════════════════════════════════════════
-- 2026-11-19, integración M, sobre la base de la tanda L (sin reiniciar: el
-- reinicio, ya autorizado por Angel, lo denegó el sistema de permisos de la
-- sesión), bajo el flock de e2e: ensayo en seco con COMMIT → ROLLBACK (4 de
-- 4 OK y la función ausente después), real y segunda pasada (4 de 4 OK),
-- registrada a mano en supabase_migrations.schema_migrations (50 filas, la
-- última 20261125180000). Comprobado después: md5(prosrc) = 1b8ede6c…,
-- has_function_privilege('authenticated', …) = false. audit_log: 82 069
-- filas antes y después. Prueba: supabase/pruebas-sql/m_saludo_recordatorio.sql.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ── Pre-vuelo ───────────────────────────────────────────────────────────
DO $pre$
DECLARE
  v_faltan text;
  v_cuerpo text;
BEGIN
  SELECT string_agg(t || '.' || c, ', ') INTO v_faltan
    FROM (VALUES ('appointments', 'id'), ('appointments', 'clinica_id'), ('appointments', 'paciente_id'),
                 ('appointments', 'reserva_nombre'), ('pacientes', 'id'), ('pacientes', 'clinica_id'),
                 ('pacientes', 'nombre')) AS x(t, c)
   WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns k
                      WHERE k.table_schema = 'public' AND k.table_name = x.t AND k.column_name = x.c);
  IF v_faltan IS NOT NULL THEN
    RAISE EXCEPTION 'M-saludo pre-vuelo: faltan columnas: %', v_faltan;
  END IF;
  SELECT p.prosrc INTO v_cuerpo FROM pg_proc p
   WHERE p.oid = to_regprocedure('public.cita_nombre_saludo(uuid, uuid)');
  -- Re-ejecución: sólo con el cuerpo de esta migración (md5 de prosrc).
  IF v_cuerpo IS NOT NULL AND md5(v_cuerpo) <> '1b8ede6c76a681949de5d7944358e6c0' THEN
    RAISE EXCEPTION 'M-saludo pre-vuelo: ya existe public.cita_nombre_saludo(uuid, uuid) con otro cuerpo (md5 %)', md5(v_cuerpo);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = 'cita_nombre_saludo'
                AND p.oid IS DISTINCT FROM to_regprocedure('public.cita_nombre_saludo(uuid, uuid)')) THEN
    RAISE EXCEPTION 'M-saludo pre-vuelo: hay otra sobrecarga de public.cita_nombre_saludo';
  END IF;
END
$pre$;

-- ── La función ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cita_nombre_saludo(p_clinica_id uuid, p_cita_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
  SELECT coalesce(nullif(btrim(p.nombre), ''), nullif(btrim(a.reserva_nombre), ''))
    FROM public.appointments a
    LEFT JOIN public.pacientes p ON p.id = a.paciente_id AND p.clinica_id = a.clinica_id
   WHERE a.id = p_cita_id AND a.clinica_id = p_clinica_id
$fn$;

COMMENT ON FUNCTION public.cita_nombre_saludo(uuid, uuid) IS
  'Agenda v2 (integración M): el nombre del saludo del recordatorio. El paciente ligado y, si no, el de la reserva. Sólo service_role.';

REVOKE EXECUTE ON FUNCTION public.cita_nombre_saludo(uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cita_nombre_saludo(uuid, uuid) TO service_role;

-- ── Post-vuelo: aborta antes del COMMIT si los permisos no quedaron así ──
DO $post$
BEGIN
  IF has_function_privilege('anon', 'public.cita_nombre_saludo(uuid, uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.cita_nombre_saludo(uuid, uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.cita_nombre_saludo(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'M-saludo post-vuelo: los permisos de cita_nombre_saludo no son los esperados';
  END IF;
END
$post$;

-- ── Veredicto ───────────────────────────────────────────────────────────
SELECT n AS fila, que, CASE WHEN ok THEN 'OK' ELSE 'REVISAR' END AS veredicto FROM (VALUES
  (1, 'la función existe, STABLE, INVOKER, search_path vacío',
     EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure('public.cita_nombre_saludo(uuid, uuid)')
              AND p.provolatile = 's' AND NOT p.prosecdef AND p.proconfig = ARRAY['search_path=""'])),
  (2, 'anon y authenticated sin EXECUTE',
     NOT has_function_privilege('anon', 'public.cita_nombre_saludo(uuid, uuid)', 'EXECUTE')
     AND NOT has_function_privilege('authenticated', 'public.cita_nombre_saludo(uuid, uuid)', 'EXECUTE')),
  (3, 'service_role con EXECUTE',
     has_function_privilege('service_role', 'public.cita_nombre_saludo(uuid, uuid)', 'EXECUTE')),
  (4, 'PUBLIC sin EXECUTE',
     NOT EXISTS (SELECT 1 FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                  WHERE p.oid = to_regprocedure('public.cita_nombre_saludo(uuid, uuid)')
                    AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'))
) AS v(n, que, ok) ORDER BY n;

COMMIT;
