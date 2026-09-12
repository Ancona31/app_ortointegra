-- =============================================================================
-- 20260427_b1_03_security_definer_search_path.sql
--
-- Propósito:
--   Fijar `search_path = public, pg_temp` en las 6 funciones SECURITY
--   DEFINER que actualmente NO lo tienen, eliminando el vector clásico
--   de search-path-injection contra funciones SECURITY DEFINER.
--
-- Hallazgo Fase A que corrige:
--   D9 — `Funciones SECURITY DEFINER sin search_path fijado`
--   (docs/schema-recovery-report-final.md líneas 194-204).
--   Funciones afectadas (6, no 7 como dice el texto del reporte — el
--   conteo correcto coincide con la lista enumerada):
--     - get_clinica_id()
--     - get_my_clinica_id()
--     - get_my_role()
--     - get_max_pacientes()
--     - get_suscripcion_estado()
--     - prevent_audit_modification()
--   Sin search_path fijado, un atacante con permisos para crear objetos
--   en un schema con mayor prioridad de búsqueda (ej. pg_temp en una
--   sesión propia) puede sobrescribir referencias no calificadas dentro
--   de la función y ejecutar código con los privilegios del DEFINER
--   (típicamente `postgres`).
--
-- Riesgo estimado: BAJO.
--   - `ALTER FUNCTION ... SET search_path = ...` solo modifica el
--     atributo de la función; no recompila el cuerpo, no cambia firma,
--     no invalida llamadas existentes.
--   - Las funciones helper (get_*) ya califican `profiles` y `clinicas`
--     SIN prefijo de schema en sus cuerpos, pero como ahora el
--     search_path está fijado a `public, pg_temp`, los identificadores
--     resolverán a `public.profiles` y `public.clinicas` igual que
--     antes (que es lo que ya hace el resolver implícito vía el
--     `search_path` por defecto del rol). Cero cambio funcional.
--
-- Auditoría adicional realizada (durante diseño de B1.03):
--   Revisé `supabase/baseline/05_functions.sql` para detectar otras
--   funciones SECURITY DEFINER sin `SET search_path`. Resultado:
--     6 sin search_path (las listadas arriba).
--     7 SI tienen `SET search_path TO 'public'`:
--       log_tabla_change, enforce_limite_documentos_paciente,
--       sync_antropometria_paciente, trg_mediciones_antropometria,
--       sa_heatmap_horarios, sa_ranking_funciones, sa_top_medicos,
--       sa_uso_ia (8, no 7 — corrijo el conteo).
--   No hay funciones adicionales que agregar al UP.
--
-- Decisión de diseño aplicada (presentar en reporte):
--   Uso `SET search_path = public, pg_temp` en lugar de
--   `SET search_path TO 'public'` (variante usada en el resto del
--   schema). Razones:
--     - `public, pg_temp` es la recomendación oficial de PostgreSQL
--       para SECURITY DEFINER (cf. docs § "Writing SECURITY DEFINER
--       Functions Safely"): pg_temp al final mata el último vector
--       conocido (sobrescritura vía objetos temporales del invocador).
--     - Mantengo `public` primero para que los identificadores no
--       calificados sigan resolviendo igual que antes.
--   Si el usuario prefiere consistencia visual con
--   `SET search_path TO 'public'`, cambiar la lista a `'public'`.
--
-- Smoke tests recomendados (post-aplicación):
--   1) Confirmar que el atributo se aplicó:
--        SELECT proname, proconfig
--        FROM pg_proc
--        WHERE pronamespace = 'public'::regnamespace
--          AND proname IN ('get_clinica_id', 'get_my_clinica_id',
--                          'get_my_role', 'get_max_pacientes',
--                          'get_suscripcion_estado',
--                          'prevent_audit_modification')
--        ORDER BY proname;
--      → Cada fila debe tener proconfig que contenga
--        'search_path=public, pg_temp'.
--   2) Sanity check funcional como cualquier usuario autenticado:
--        SELECT public.get_my_role();
--      → Devuelve el rol del profile actual (igual que antes).
--   3) Sanity check del trigger inmutable:
--        UPDATE public.audit_log SET descripcion = 'x' WHERE id = ...;
--      → Falla con la excepción esperada
--        "El audit_log es inmutable. No se permite UPDATE ni DELETE."
-- =============================================================================


-- -----------------------------------------------------------------------------
-- UP
-- -----------------------------------------------------------------------------

ALTER FUNCTION public.get_clinica_id()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_my_clinica_id()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_my_role()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_max_pacientes()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_suscripcion_estado()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.prevent_audit_modification()
  SET search_path = public, pg_temp;


-- -----------------------------------------------------------------------------
-- DOWN
-- -----------------------------------------------------------------------------
-- Inverso EXACTO: remueve el atributo `search_path` de cada función,
-- dejándolas en el estado del baseline (sin search_path fijado).

-- ALTER FUNCTION public.get_clinica_id() RESET search_path;
-- ALTER FUNCTION public.get_my_clinica_id() RESET search_path;
-- ALTER FUNCTION public.get_my_role() RESET search_path;
-- ALTER FUNCTION public.get_max_pacientes() RESET search_path;
-- ALTER FUNCTION public.get_suscripcion_estado() RESET search_path;
-- ALTER FUNCTION public.prevent_audit_modification() RESET search_path;


-- -----------------------------------------------------------------------------
-- Verificación post-aplicación
-- -----------------------------------------------------------------------------
-- Pegar en SQL Editor:
--
-- SELECT
--   proname,
--   prosecdef AS security_definer,
--   proconfig
-- FROM pg_proc
-- WHERE pronamespace = 'public'::regnamespace
--   AND proname IN (
--     'get_clinica_id', 'get_my_clinica_id', 'get_my_role',
--     'get_max_pacientes', 'get_suscripcion_estado',
--     'prevent_audit_modification'
--   )
-- ORDER BY proname;
--
-- Resultado esperado (6 filas):
--   security_definer = true
--   proconfig contiene un elemento "search_path=public, pg_temp"
