-- =============================================================================
-- 20260430_vip_01_es_vip_grant.sql
--
-- Propósito:
--   Introducir el override administrativo VIP como columna explícita en
--   `public.clinicas` (`es_vip_grant boolean`), separado del concepto de
--   plan. Hasta ahora la condición "VIP" se inferia de
--   `max_pacientes IS NULL`, lo cual es ambiguo porque ese mismo valor
--   nulo aparece de forma legítima en clínicas con planes pagados que
--   simplemente no tienen tope (individual/basica/pro/premium en
--   PLAN_LIMITS = null). Esta migración convierte VIP en un flag binario
--   intencional, no derivado.
--
--   Adicionalmente:
--     - Cambia el DEFAULT de `clinicas.max_pacientes` de 15 a 5 para
--       alinearlo con `PLAN_LIMITS.free.max_pacientes = 5`. Las nuevas
--       clínicas se crean en plan free; el default 15 era un legado
--       pre-rebrand que excedía el límite real del plan.
--     - Migra los datos existentes para marcar `es_vip_grant = true` en
--       las 5 clínicas que hoy son VIP de hecho (3 intencionales sin
--       suscripción + 2 cuentas excepción del super-admin con
--       suscripción activa pero sin tope contractual).
--
-- Hallazgos de Fase 1 que motivan esta migración:
--   - 14 clínicas en producción.
--   - 5 con max_pacientes IS NULL (las que se ven como VIP hoy).
--     De esas 5: 3 sin suscripción Stripe y 2 con suscripción activa
--     (Drailse y Dr. Ancona TYO, marcadas como excepción manual).
--   - 9 con max_pacientes numérico.
--   - NO existe ningún sentinela `-1` en datos reales (la rama de
--     salvaguarda queda igual por defensa en profundidad).
--   - `get_max_pacientes()` existe pero ninguna policy RLS la usa, y
--     se eliminará en una fase posterior (Fase 5). Esta migración no
--     la toca.
--   - RLS sobre `clinicas` tiene una sola policy SELECT
--     (`clinicas_select_own_or_super_admin`); todas las escrituras
--     pasan por service_role. Esta migración no toca policies.
--
-- Decisiones de producto cerradas y aplicadas aquí:
--   1) VIP es OVERRIDE administrativo separado del plan, no un plan.
--      Por eso NO se agrega 'vip' al enum `clinicas_plan_check`.
--   2) Campo nuevo: `clinicas.es_vip_grant boolean NOT NULL DEFAULT false`.
--   3) DEFAULT de `clinicas.max_pacientes` pasa de 15 a 5.
--   4) Migración de datos:
--        a) max_pacientes IS NULL Y stripe_subscription_id IS NULL
--             → es_vip_grant = true (VIPs intencionales sin Stripe).
--        b) Las dos excepciones (Drailse y Dr. Ancona TYO) por id
--           explícito de clinica → es_vip_grant = true.
--           Se usa id porque depender de email/auth.users sería
--           frágil y porque ambas clínicas tienen stripe_subscription_id
--           activo, así que la regla (a) no las cubre.
--        c) Cualquier otra clínica → es_vip_grant = false (default).
--        d) Salvaguarda preventiva para max_pacientes = -1: marcar
--           es_vip_grant = true Y normalizar max_pacientes = NULL.
--           Hoy no existe esa fila; se deja la rama por defensa.
--   5) NO se modifica `get_max_pacientes()` ni se agregan policies
--      ni triggers ni indices en esta migración. Cualquier consumo
--      del nuevo flag se hará en Fases 3-5.
--
-- Riesgo estimado: BAJO.
--   - ADD COLUMN con DEFAULT false sobre tabla pequeña (14 filas) es
--     una operación instantánea en PostgreSQL >= 11 (default constante,
--     no rewrite).
--   - ALTER DEFAULT no toca filas existentes; solo afecta inserts
--     futuros sin valor explícito de max_pacientes.
--   - Los UPDATE solo escriben es_vip_grant (booleano nuevo) o,
--     en la rama de -1, también max_pacientes. Como no hay filas con
--     -1 hoy, ese UPDATE afecta 0 filas en práctica.
--   - No hay aún código TypeScript que lea `es_vip_grant`, por lo que
--     no se rompe ninguna ruta. La integración con UI/lógica viene en
--     fases siguientes.
--
-- Smoke tests recomendados (post-aplicación):
--   Ver bloque "Verificación post-aplicación" al final del archivo.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- UP
-- -----------------------------------------------------------------------------

-- PASO 1
-- Agrega la columna es_vip_grant.
-- NOT NULL DEFAULT false rellena las 14 filas existentes con false en una
-- sola operación atomica. Las clinicas VIP reales se marcan true en los
-- pasos 3-5 mas abajo. Idempotente: IF NOT EXISTS evita romper si la
-- migracion se re-ejecuta.
ALTER TABLE public.clinicas
  ADD COLUMN IF NOT EXISTS es_vip_grant boolean NOT NULL DEFAULT false;


-- PASO 2
-- Cambia el DEFAULT de max_pacientes de 15 a 5 para alinearlo con
-- PLAN_LIMITS.free.max_pacientes = 5. Solo afecta INSERTs futuros que no
-- especifiquen valor; las 14 filas existentes conservan su valor actual
-- (numerico o NULL) sin cambio.
ALTER TABLE public.clinicas
  ALTER COLUMN max_pacientes SET DEFAULT 5;


-- PASO 3
-- Marca como VIP a las clinicas intencionales sin suscripcion Stripe:
-- aquellas cuya max_pacientes ya es NULL (sin tope) y que no tienen
-- stripe_subscription_id. Segun Fase 1 esto debe afectar 3 filas (las
-- 5 con max_pacientes NULL menos las 2 excepciones con suscripcion).
-- La condicion `es_vip_grant = false` evita reescribir filas ya marcadas
-- si la migracion se re-corre.
UPDATE public.clinicas
SET    es_vip_grant = true
WHERE  max_pacientes IS NULL
  AND  stripe_subscription_id IS NULL
  AND  es_vip_grant = false;


-- PASO 4
-- Marca como VIP a las dos cuentas de excepcion explicita (Drailse y
-- Dr. Ancona TYO). Ambas tienen stripe_subscription_id activo, por lo
-- que el PASO 3 no las cubre. Se identifican por id de clinica para
-- evitar dependencias fragiles con auth.users.email o joins.
--
-- IDs confirmados en reporte de Fase 1:
--   - a5139188-b8e6-45a4-b2a9-54af1323bf71  Dra. Ilse Casillas (Drailse)
--   - 5865f842-da75-49d4-9daa-9be0862559b7  Dr. Ancona TYO
UPDATE public.clinicas
SET    es_vip_grant = true
WHERE  id IN (
         'a5139188-b8e6-45a4-b2a9-54af1323bf71',
         '5865f842-da75-49d4-9daa-9be0862559b7'
       )
  AND  es_vip_grant = false;


-- PASO 5
-- Salvaguarda preventiva: si existiera alguna fila con max_pacientes = -1
-- (sentinela legacy hipotetica que no aparece en datos reales hoy segun
-- Fase 1), marcarla como VIP y normalizar el valor a NULL. Esta rama
-- afecta 0 filas en produccion actual; se incluye por defensa en
-- profundidad para evitar que un valor -1 sobreviva a la migracion sin
-- ser tratado como VIP. Si en el futuro se introdujera -1 por error,
-- esta rama lo limpiaria al re-aplicar la migracion.
UPDATE public.clinicas
SET    es_vip_grant = true,
       max_pacientes = NULL
WHERE  max_pacientes = -1;


-- -----------------------------------------------------------------------------
-- DOWN
-- -----------------------------------------------------------------------------
-- Reversion completa. Bloque comentado para evitar ejecucion accidental
-- si se pega el archivo entero en SQL Editor. Para revertir, descomentar
-- y ejecutar en este orden:
--
-- ALTER TABLE public.clinicas
--   ALTER COLUMN max_pacientes SET DEFAULT 15;
--
-- ALTER TABLE public.clinicas
--   DROP COLUMN IF EXISTS es_vip_grant;
--
-- Nota: el rollback NO restaura los valores previos de es_vip_grant
-- (porque al dropear la columna se pierden), pero como la columna era
-- nueva eso es aceptable. El estado pre-migracion es exactamente el
-- mismo: clinicas sin la columna y con default 15 en max_pacientes.


-- -----------------------------------------------------------------------------
-- Verificación post-aplicación
-- -----------------------------------------------------------------------------
-- Pegar cada query en SQL Editor (una a la vez) y comparar con el
-- resultado esperado.

-- VERIFY V1: total de clinicas marcadas como VIP.
-- Esperado: 5  (3 intencionales sin Stripe + Drailse + Dr. Ancona TYO).
--
-- SELECT count(*) AS total_vip
-- FROM   public.clinicas
-- WHERE  es_vip_grant = true;


-- VERIFY V2: detalle de las 5 VIP.
-- Esperado: 5 filas. Las 2 excepciones deben mostrar
-- stripe_subscription_id NOT NULL y plan distinto de 'free'; las otras
-- 3 deben mostrar stripe_subscription_id NULL.
--
-- SELECT id,
--        nombre,
--        plan,
--        suscripcion_estado,
--        stripe_subscription_id,
--        max_pacientes
-- FROM   public.clinicas
-- WHERE  es_vip_grant = true
-- ORDER  BY nombre;


-- VERIFY V3: ningun "VIP fantasma" sin marcar.
-- Una clinica con suscripcion Stripe activa, plan distinto de 'free' y
-- max_pacientes NULL es legitima (los planes pagados tienen tope NULL
-- en PLAN_LIMITS), pero NO debe ser tratada como VIP a menos que
-- es_vip_grant = true. Esta query lista las que cumplen ese patron sin
-- estar marcadas; manualmente Angel debe confirmar que ninguna de ellas
-- deberia haber sido VIP. Si la lista esta vacia, perfecto. Si no,
-- revisar caso por caso.
--
-- SELECT id,
--        nombre,
--        plan,
--        suscripcion_estado,
--        stripe_subscription_id
-- FROM   public.clinicas
-- WHERE  stripe_subscription_id IS NOT NULL
--   AND  plan <> 'free'
--   AND  max_pacientes IS NULL
--   AND  es_vip_grant = false
-- ORDER  BY nombre;


-- VERIFY V4: confirmar el nuevo DEFAULT de max_pacientes (debe ser 5).
--
-- SELECT column_name,
--        column_default,
--        is_nullable,
--        data_type
-- FROM   information_schema.columns
-- WHERE  table_schema = 'public'
--   AND  table_name   = 'clinicas'
--   AND  column_name IN ('max_pacientes', 'es_vip_grant')
-- ORDER  BY column_name;
--
-- Esperado:
--   es_vip_grant   | false | NO  | boolean
--   max_pacientes  | 5     | YES | integer
