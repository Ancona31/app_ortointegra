-- =============================================================================
-- 20260503_phase81_block_post_cancellation.sql
--
-- Propósito:
--   Bloquear creación de pacientes, consultas y documentos cuando una
--   clínica cumple TODAS estas condiciones a la vez:
--     1) `suscripcion_estado = 'cancelado'`,
--     2) `es_vip_grant = false`,
--     3) tiene MÁS de 5 pacientes activos.
--
--   El predicado del count `> 5` separa a los ex-clientes pagados (que
--   alguna vez excedieron el plan free y por tanto pagaron) de los free
--   de buena fe (siempre con ≤5 pacientes por límite del plan free).
--   El bloqueo aplica solo a los primeros.
--
-- Diseño:
--   Tres policies adicionales, una por tabla, declaradas como
--   `RESTRICTIVE` para que se combinen con `AND` con las policies
--   PERMISSIVE preexistentes (`clinica_insert`, `pacientes_insert`,
--   `Insertar consultas solo medico`, `Insertar documentos solo medico`).
--   Las nuevas policies NO reemplazan ni alteran a las existentes; solo
--   agregan un veto adicional.
--
-- Defense in depth:
--   Los endpoints `POST /api/pacientes`, `POST /api/consultas` y
--   `POST /api/documentos` aplican el mismo predicado en TS antes de
--   cualquier insert. Estas policies cubren el caso del frontend que
--   inserta directo a Supabase via RPC (9 formularios de documentos
--   identificados; ver Fase 8.1 notas) saltándose los endpoints.
--
-- Hallazgos previos que motivan esta migración:
--   - Fase 8 inicial bloqueaba a TODO free, incluyendo cuentas legítimas.
--   - El endpoint `/api/documentos POST` es código zombie: el frontend
--     hace inserts directos para 9 tipos de documento, así que un gate
--     server-side ahí es inerte. Por eso la RLS es la barrera real.
--   - Producto refinó: solo bloquear a quien matemáticamente fue
--     pagado (>5 pacientes y luego canceló). Free real (≤5) no se toca.
--   - VIPs (`es_vip_grant=true`) están explícitamente excluidos.
--
-- Decisiones de producto cerradas y aplicadas aquí:
--   1) Umbral de bloqueo: count de pacientes activos `> 5`. Coincide con
--      `PLAN_LIMITS.free.max_pacientes = 5`. Cualquier clínica con >5
--      pacientes Y `suscripcion_estado='cancelado'` Y `es_vip_grant=false`
--      necesariamente fue pagada en algún momento.
--   2) "Paciente activo" = `activo = true OR activo IS NULL`, alineado
--      con la policy `pacientes_select_activos` y con el flag de
--      soft-delete usado en el resto de la app. NO existe columna
--      `eliminado` (en spec original aparecía por error).
--   3) Las policies son `RESTRICTIVE`. Si fueran `PERMISSIVE` el OR
--      con las existentes las haría inertes.
--   4) Aplican solo a `INSERT`. UPDATE y SELECT siguen permitidos:
--      el usuario cancelado conserva acceso de lectura/edición a sus
--      datos existentes (cumplimiento ARCO + decisión de producto).
--   5) `WITH CHECK` usa `NOT EXISTS (...)` envolviendo la condición de
--      bloqueo: el INSERT pasa cuando NO se cumple la cancelación.
--
-- Riesgo estimado: BAJO.
--   - Solo agrega policies; no toca tablas, datos, ni funciones.
--   - `get_clinica_id()` ya existe (baseline/05_functions.sql, STABLE
--     SECURITY DEFINER) y es la misma función usada por las policies
--     PERMISSIVE de estas mismas tablas. Sin nueva dependencia.
--   - El subquery `(SELECT count(*) FROM pacientes ...)` se evalúa por
--     cada INSERT; en clínicas grandes puede sumar latencia mínima
--     (~1-3 ms con índice por `clinica_id`). Aceptable: los inserts
--     son operaciones humanas, no batch.
--   - Idempotente: `DROP POLICY IF EXISTS` antes de cada `CREATE`.
--
-- Smoke tests recomendados (post-aplicación):
--   Ver bloque "Verificación post-aplicación" al final del archivo.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- UP
-- -----------------------------------------------------------------------------


-- PASO 1
-- pacientes: bloquea INSERT cuando la clínica está cancelada, no es VIP
-- y ya tiene >5 pacientes activos. La policy es RESTRICTIVE para
-- combinarse con AND con las PERMISSIVE existentes (clinica_insert y
-- pacientes_insert). Idempotente.
DROP POLICY IF EXISTS pacientes_block_post_cancellation ON public.pacientes;
CREATE POLICY pacientes_block_post_cancellation ON public.pacientes
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.clinicas c
      WHERE c.id = public.get_clinica_id()
        AND c.suscripcion_estado = 'cancelado'
        AND c.es_vip_grant = false
        AND (
          SELECT count(*) FROM public.pacientes p
          WHERE p.clinica_id = c.id
            AND (p.activo = true OR p.activo IS NULL)
        ) > 5
    )
  );


-- PASO 2
-- consultas: mismo predicado. Bloquea creación de notas clínicas a
-- ex-clientes cancelados con >5 pacientes activos. RESTRICTIVE.
DROP POLICY IF EXISTS consultas_block_post_cancellation ON public.consultas;
CREATE POLICY consultas_block_post_cancellation ON public.consultas
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.clinicas c
      WHERE c.id = public.get_clinica_id()
        AND c.suscripcion_estado = 'cancelado'
        AND c.es_vip_grant = false
        AND (
          SELECT count(*) FROM public.pacientes p
          WHERE p.clinica_id = c.id
            AND (p.activo = true OR p.activo IS NULL)
        ) > 5
    )
  );


-- PASO 3
-- documentos: mismo predicado. Crítico porque el frontend inserta
-- directo (9 formularios) saltándose el endpoint /api/documentos. Esta
-- policy es la barrera real, no el gate del endpoint.
DROP POLICY IF EXISTS documentos_block_post_cancellation ON public.documentos;
CREATE POLICY documentos_block_post_cancellation ON public.documentos
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.clinicas c
      WHERE c.id = public.get_clinica_id()
        AND c.suscripcion_estado = 'cancelado'
        AND c.es_vip_grant = false
        AND (
          SELECT count(*) FROM public.pacientes p
          WHERE p.clinica_id = c.id
            AND (p.activo = true OR p.activo IS NULL)
        ) > 5
    )
  );


-- -----------------------------------------------------------------------------
-- DOWN
-- -----------------------------------------------------------------------------
-- Reversion completa. Bloque comentado para evitar ejecucion accidental
-- si se pega el archivo entero en SQL Editor. Para revertir, descomentar
-- y ejecutar:
--
-- DROP POLICY IF EXISTS pacientes_block_post_cancellation ON public.pacientes;
-- DROP POLICY IF EXISTS consultas_block_post_cancellation ON public.consultas;
-- DROP POLICY IF EXISTS documentos_block_post_cancellation ON public.documentos;
--
-- Tras el rollback el comportamiento vuelve a Fase 8 inicial: cualquier
-- authenticated cuyo clinica_id coincida puede insertar (solo gates de
-- endpoint quedan vivos, y solo en las rutas que efectivamente pasan
-- por ellos — los 9 formularios de documentos quedarian sin barrera).


-- -----------------------------------------------------------------------------
-- Verificación post-aplicación
-- -----------------------------------------------------------------------------
-- Pegar cada query en SQL Editor (una a la vez) y comparar con el
-- resultado esperado.

-- VERIFY V1: las 3 policies nuevas existen y son RESTRICTIVE.
-- Esperado: 3 filas, columna `permissive` = 'RESTRICTIVE' en las 3.
--
-- SELECT schemaname, tablename, policyname, permissive, cmd, roles
-- FROM   pg_policies
-- WHERE  policyname IN (
--          'pacientes_block_post_cancellation',
--          'consultas_block_post_cancellation',
--          'documentos_block_post_cancellation'
--        )
-- ORDER  BY tablename;


-- VERIFY V2: clinicas que actualmente caen en la condición de bloqueo.
-- Útil para saber a quién va a afectar la migración el día que se
-- aplique. Esperado: lista pequeña (probablemente 0-2 filas en prod
-- según historial conocido). Si aparece alguna VIP por error, V2
-- devolveria 0 sobre esa fila porque `es_vip_grant=true` la excluye
-- antes del count.
--
-- SELECT c.id,
--        c.nombre,
--        c.suscripcion_estado,
--        c.es_vip_grant,
--        (SELECT count(*) FROM public.pacientes p
--         WHERE p.clinica_id = c.id
--           AND (p.activo = true OR p.activo IS NULL)) AS pacientes_activos
-- FROM   public.clinicas c
-- WHERE  c.suscripcion_estado = 'cancelado'
--   AND  c.es_vip_grant = false
--   AND  (SELECT count(*) FROM public.pacientes p
--         WHERE p.clinica_id = c.id
--           AND (p.activo = true OR p.activo IS NULL)) > 5
-- ORDER  BY c.nombre;


-- VERIFY V3: clinicas free con ≤5 pacientes (NO deben verse afectadas).
-- Sanity check del lado opuesto: confirma que el bloqueo no toca a
-- usuarios free legítimos. Esperado: free de buena fe aparece aquí y
-- NO debe ver el banner ni ser bloqueada al insertar.
--
-- SELECT c.id,
--        c.nombre,
--        c.plan,
--        c.suscripcion_estado,
--        c.es_vip_grant,
--        (SELECT count(*) FROM public.pacientes p
--         WHERE p.clinica_id = c.id
--           AND (p.activo = true OR p.activo IS NULL)) AS pacientes_activos
-- FROM   public.clinicas c
-- WHERE  c.plan = 'free'
--   AND  (SELECT count(*) FROM public.pacientes p
--         WHERE p.clinica_id = c.id
--           AND (p.activo = true OR p.activo IS NULL)) <= 5
-- ORDER  BY c.nombre;
