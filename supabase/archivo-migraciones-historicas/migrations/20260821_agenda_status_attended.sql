-- ESTADO: APLICADA Y VERIFICADA EN PRODUCCIÓN EL 2026-08-21.
-- ============================================================================
-- Aplicada a la primera, sin errores. Lo que la convierte en un hecho
-- consultable y no en la palabra de quien pegó el archivo es el veredicto que
-- devolvió en la rejilla, con `SELECT pg_get_constraintdef(oid), convalidated
-- FROM pg_constraint WHERE conrelid='public.appointments'::regclass AND
-- conname='appointments_status_check'` por debajo:
--
--   validada     = 1     (el constraint existe y convalidated = t)
--   faltantes    = ''    (los CINCO valores están en el CHECK, ninguno se cayó)
--   ya_atendidas = 0     (correcto: el código aún no ha subido)
--   filas_raras  = 0
--
--   CHECK ((status = ANY (ARRAY['scheduled'::text, 'confirmed'::text,
--   'cancelled'::text, 'no_show'::text, 'attended'::text])))
--
-- Esa última línea es además el literal real que la guarda de replay compara,
-- así que la guarda queda confirmada contra producción y no sólo razonada.
-- ============================================================================
-- ⚠️ DE LA PRIMERA SENTENCIA HACIA ABAJO NO SE TOCA NADA (§7 de
-- supabase/AUDITORIA-MIGRACIONES.md). Este bloque de comentarios es la única
-- región editable, y sólo para anotar.
--
-- ── ANOTACIÓN 2026-08-21: EL VEREDICTO DE ESTE ARCHIVO NO SE PROBÓ NUNCA ────
-- Contra un Postgres real, quiero decir. Pasó por dos auditorías y **ninguna
-- ejecutó SQL**: lo que ambas revisaron fue el texto. Aquí salió bien, pero en
-- la migración 5 de esta misma serie el `SELECT` del veredicto murió con
-- `ERROR 42725: operator is not unique: unknown || "char"` —concatenar
-- `pg_constraint.confdeltype` sin `::text`— y lo hizo **con la transacción ya
-- confirmada**, que es el peor momento posible.
--
-- Este archivo se libró por casualidad: sus concatenaciones son sobre `text` y
-- `bigint`, que sí resuelven. Queda escrito para que nadie deduzca de «corrió
-- bien» que el patrón estaba comprobado.
--
-- Ya está probado, por ejecución: el veredicto de arriba salió de correr esta
-- consulta contra producción. La lección se conserva igual — que un `SELECT`
-- de veredicto no se puede dar por bueno leyéndolo — porque es lo que costó una
-- transacción confirmada a medias en la migración 5.
--
-- La comprobación de que quedó aplicado, para volver a hacerla cuando haga falta:
-- La comprobación que la respalda queda YA ESCRITA aquí para no tener que
-- inventarla ese día — que es como el rótulo envejece mintiendo, y el
-- precedente es 20260818_gcal_puente_secretos.sql:
--
--   SELECT pg_get_constraintdef(oid) AS def, convalidated
--     FROM pg_constraint
--    WHERE conrelid = 'public.appointments'::regclass
--      AND conname  = 'appointments_status_check';
--   -- Aplicada = una fila, convalidated = t, y `def` nombra los CINCO valores.
-- ============================================================================
-- El estado «atendida» de una cita  (plan §12.13, §12.15 fila 3)
--
-- ── QUÉ CAMBIA ──────────────────────────────────────────────────────────────
--   appointments.status  admite un quinto valor: 'attended'.
--
-- Nada más. No añade columnas, no toca policies, no mueve ni una fila.
--
-- ── POR QUÉ 'attended' Y NO 'atendida' NI 'completed' ───────────────────────
-- Los cuatro valores que ya viven en esta columna son inglés y minúsculas
-- ('scheduled', 'confirmed', 'cancelled', 'no_show'), igual que los de la
-- columna hermana `gcal_sync_status`. Meter un valor en castellano sería el
-- mismo desajuste que §12.13 quiere evitar, sólo que en otro idioma.
--
-- Y NO 'completed', que era el nombre que el código traía muerto en
-- `STATUS_COLOR` (src/app/api/appointments/[id]/route.ts, rama jamás evaluada
-- porque la base rechazaba el valor): el estado se escribe cuando la consulta
-- EMPIEZA, no cuando termina, así que «completada» sería falso durante toda la
-- consulta. 'attended' además es el antónimo exacto de 'no_show', que ya está
-- en esta misma columna. El código deja de nombrar 'completed' en el mismo
-- deploy que acompaña a esta migración: no pueden convivir dos nombres para el
-- mismo concepto.
--
-- La etiqueta de cara al médico sigue siendo «Atendida». Eso ya pasaba:
-- 'no_show' se pinta «No asistió».
--
-- ── QUIÉN ESCRIBE ESTE VALOR ────────────────────────────────────────────────
--   1. `POST /api/consultas`, al crear la nota, sobre la cita que la originó
--      (`consultas.appointment_id`, migración 5). Es el camino automático.
--   2. El selector de estado del modal de la agenda, a mano.
--
-- La transición permitida es 'scheduled'|'confirmed' → 'attended'. Una cita
-- 'cancelled' o 'no_show' NO se toca: machacarlas borraría una afirmación que
-- alguien hizo a propósito, y en el caso de 'cancelled' dejaría la base
-- diciendo «atendida» mientras el evento de Google conserva su prefijo
-- «CANCELADA — ». Esa regla vive en el WHERE del UPDATE, no aquí: un CHECK ve
-- la fila, no la transición.
--
-- ── ORDEN DE DESPLIEGUE — ESTE ARCHIVO VA ANTES DEL CÓDIGO ──────────────────
-- Con el esquema migrado, el código VIEJO no escribe 'attended' nunca y no se
-- entera de nada: el cambio es aditivo puro. Al revés —código nuevo contra
-- esquema viejo— el UPDATE se va con 23514 y, por la decisión de §12.13 (la
-- consulta se abre igual pase lo que pase), el fallo queda SILENCIOSO. Ese es
-- justo el desenlace que no se quiere.
--
-- ── PRE-VUELO (correr APARTE, leer el resultado; no forma parte del archivo) ─
--
--   -- ¿Hay grants a nivel de COLUMNA sobre appointments? No los toca esta
--   -- migración, pero si existieran, la 4 (icono/color) nacería invisible.
--   -- Cero filas = no hay ninguno = no hay nada que hacer.
--   --
--   -- ⚠️ NO USAR `information_schema.column_privileges`: esa vista EXPANDE los
--   -- grants de TABLA columna por columna, así que devuelve (nº columnas × 4)
--   -- filas aunque no exista ni un solo grant de columna — sobre appointments,
--   -- del orden de un centenar. Se lee como alarma y no lo es, y haría parar
--   -- una aplicación perfectamente sana. El ACL real de la columna vive en
--   -- `pg_attribute.attacl`, que es NULL cuando el grant viene de la tabla.
--   -- Está comprobado y escrito desde el 2026-08-17 en
--   -- 20260817_gcal_conexion_clinica_a_esquema.sql:92-107; esta migración lo
--   -- había vuelto a equivocar.
--   SELECT c.relname, a.attname, a.attacl
--     FROM pg_attribute a
--     JOIN pg_class c     ON c.oid = a.attrelid
--     JOIN pg_namespace n ON n.oid = c.relnamespace
--    WHERE n.nspname = 'public'
--      AND c.relname = 'appointments'
--      AND a.attnum > 0 AND NOT a.attisdropped
--      AND a.attacl IS NOT NULL;
--
--   -- ¿Transacciones viejas abiertas? Un ALTER que encole detrás de una
--   -- bloquea también a todo el que llegue después.
--   SELECT pid, state, age(clock_timestamp(), xact_start) AS edad, query
--     FROM pg_stat_activity
--    WHERE xact_start IS NOT NULL AND state <> 'idle'
--    ORDER BY xact_start;
--
-- ── LO QUE ESTA MIGRACIÓN NO PUEDE ROMPER, Y POR QUÉ ────────────────────────
--   · Aislamiento entre clínicas: ninguna policy de `appointments` menciona
--     `status` (comprobado sobre 20260530_etapa5h_paso3_policies_appointments,
--     las cinco policies filtran por medico_id/rol y clinica_id, nada más).
--     El alcance de los roles queda EXACTAMENTE igual en las dos direcciones
--     (dimensión 15): ni gana ni pierde permisos nadie, porque el permiso no
--     se evalúa sobre el valor de esta columna.
--   · Índices: `idx_appointments_status` es un btree simple. Un valor más no
--     le afecta.
--   · Datos: el conjunto nuevo es SUPERCONJUNTO ESTRICTO del viejo, así que
--     ninguna fila existente puede violarlo.
--
-- ── REVERSIÓN ───────────────────────────────────────────────────────────────
-- Es la misma sentencia con el ARRAY de cuatro, y SÓLO si no hay ya filas en
-- 'attended'. Si las hay, hay que decidir a mano a qué estado vuelven —no hay
-- respuesta automática— antes de volver a apretar el CHECK.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout      = '5s';
SET LOCAL statement_timeout = '60s';

-- ── PRE-VUELO QUE ABORTA (dimensión 4) ──────────────────────────────────────
-- Va ANTES del cambio y con RAISE EXCEPTION, no con un aviso posterior.
--
-- Qué comprueba: que no haya ya filas con un `status` fuera de la lista nueva.
-- Si las hubiera, el DROP + ADD ... NOT VALID las dejaría pasar en silencio
-- (NOT VALID no mira lo existente) y el fallo aparecería más abajo, en el
-- VALIDATE, con el constraint ya sustituido. Mejor no empezar.
DO $$
DECLARE
  v_raras bigint;
BEGIN
  SELECT count(*) INTO v_raras
    FROM public.appointments
   WHERE status IS NULL
      OR status NOT IN ('scheduled','confirmed','cancelled','no_show','attended');

  IF v_raras > 0 THEN
    RAISE EXCEPTION
      'PRE-VUELO FALLO: % fila(s) de appointments tienen un status fuera de la lista nueva. Revísalas antes de tocar el CHECK. Abortando.',
      v_raras;
  END IF;

  -- Que el constraint que vamos a sustituir sea el que creemos. Si alguien lo
  -- renombró, el DROP IF EXISTS no encontraría nada y el ADD chocaría por
  -- duplicado de definición sin que se entienda por qué.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.appointments'::regclass
       AND conname  = 'appointments_status_check'
  ) THEN
    RAISE EXCEPTION
      'PRE-VUELO FALLO: no existe el constraint appointments_status_check. El esquema no es el esperado. Abortando.';
  END IF;
END $$;

-- ── QUÉ ESTAMOS A PUNTO DE DESTRUIR (dimensión 3, y dimensión 4) ────────────
-- El `DROP CONSTRAINT` de abajo tira una definición SIN MIRARLA, y el `ADD` la
-- sustituye por un literal escrito aquí. Eso convierte cualquier reejecución
-- futura en una REVERSIÓN SILENCIOSA: el día que otra migración amplíe la lista
-- de estados, volver a correr este archivo la devolvería a cinco sin decir nada
-- y sin fallar. El escenario no es hipotético — la migración 4 de esta misma
-- serie declara en su cabecera que sus listas van a sustituirse.
--
-- La guarda acepta SÓLO dos definiciones: la de ANTES (cuatro valores, aún sin
-- aplicar) y la de DESPUÉS (cinco, ya aplicada, replay inofensivo). Cualquier
-- otra aborta.
--
-- ⚠️ COMPARACIÓN EXACTA CONTRA DOS CADENAS, NO EXPRESIÓN REGULAR. Una regex que
-- «busque attended» daría por buena una definición que alguien hubiera ampliado
-- con un sexto valor, que es justo el caso que hay que atrapar.
--
-- ⚠️ LOS DOS LITERALES SE LEEN DE LA BASE, NO SE ESCRIBEN DE MEMORIA. El
-- formato exacto que devuelve `pg_get_constraintdef` (espacios, `::text`,
-- niveles de paréntesis) depende de la forma de la expresión, y deducirlo por
-- analogía con otra migración ya salió mal una vez — ver la nota junto a
-- `v_antes`. Estos dos están LEÍDOS de producción el 2026-08-21 con:
--
--   SELECT pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = 'public.appointments'::regclass
--      AND conname  = 'appointments_status_check';
--
-- SI NO CUADRA, LA MIGRACIÓN ABORTA SIEMPRE, sin tocar nada. Eso es lo
-- correcto: el fallo seguro de una guarda es no dejar pasar. Pero conviene
-- saberlo de antemano para no leerlo como un problema de la base.
DO $$
DECLARE
  v_actual text;
  /* ⚠️ LEÍDOS DE PRODUCCIÓN EL 2026-08-21, NO DEDUCIDOS. `v_antes` es la salida
     literal de `pg_get_constraintdef` sobre este mismo constraint, con las
     comillas simples dobladas para meterla en un literal de PL/pgSQL; `v_despues`
     es esa misma cadena con `, 'attended'::text` insertado antes del `]`.

     La versión anterior de estas dos líneas tenía UN NIVEL DE PARÉNTESIS DE MÁS
     —copiado de la migración 4, que lleva un `OR` y por eso deparsea con un
     nivel extra que ésta no tiene— y como `appointments_status_check` SÍ existe
     en producción, la guarda no habría casado con ninguno de los dos y la
     migración habría ABORTADO SIEMPRE, en la primera pasada y siendo el primer
     archivo de la serie. */
  v_antes  text := 'CHECK ((status = ANY (ARRAY[''scheduled''::text, ''confirmed''::text, ''cancelled''::text, ''no_show''::text])))';
  v_despues text := 'CHECK ((status = ANY (ARRAY[''scheduled''::text, ''confirmed''::text, ''cancelled''::text, ''no_show''::text, ''attended''::text])))';
BEGIN
  /* El `regexp_replace` NORMALIZA, no compara: `pg_get_constraintdef` añade un
     ` NOT VALID` al final cuando el constraint no está validado, y ese estado
     es alcanzable —si el COMMIT pasa y el VALIDATE de más abajo falla por
     lock_timeout, el constraint se queda así—. Sin quitarlo, reintentar el
     archivo abortaría en falso justo cuando hay que reintentarlo. La
     comparación de la lista de valores sigue siendo EXACTA, que es lo que la
     auditoría pedía. */
  SELECT regexp_replace(pg_get_constraintdef(oid), ' NOT VALID$', '') INTO v_actual
    FROM pg_constraint
   WHERE conrelid = 'public.appointments'::regclass
     AND conname  = 'appointments_status_check';

  IF v_actual IS DISTINCT FROM v_antes AND v_actual IS DISTINCT FROM v_despues THEN
    RAISE EXCEPTION
      'PRE-VUELO FALLO: appointments_status_check tiene una definición que este archivo no reconoce, y el DROP la destruiría en silencio. Encontrado: %. Esperado (antes): %. O (ya aplicada): %. Abortando.',
      v_actual, v_antes, v_despues;
  END IF;
END $$;

-- ── EL CAMBIO ───────────────────────────────────────────────────────────────
-- NOT VALID + VALIDATE aparte, mismo criterio que
-- 20260815_gcal_calendario_propio_a_esquema.sql:110-123: un ADD CONSTRAINT
-- normal escanea la tabla entera bajo ACCESS EXCLUSIVE (bloquea lecturas Y
-- escrituras). NOT VALID vigila las escrituras nuevas de inmediato y aplaza
-- sólo la comprobación de lo ya existente; el VALIDATE posterior toma SHARE
-- UPDATE EXCLUSIVE, que no bloquea ni lectura ni escritura. Con las filas de
-- hoy da igual; con millones es la diferencia entre un parpadeo y una caída, y
-- este archivo queda como artefacto replayable.
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status = ANY (ARRAY['scheduled'::text, 'confirmed'::text, 'cancelled'::text, 'no_show'::text, 'attended'::text]))
  NOT VALID;

COMMIT;

-- ⚠️ LOS `SET LOCAL` DE ARRIBA MURIERON EN EL COMMIT, y lo que viene está fuera
-- de la transacción. Sin repetirlos, el VALIDATE espera un lock SIN LÍMITE: si
-- justo está pasando un autovacuum sobre appointments, el SQL Editor se queda
-- aparentemente colgado y no hay forma de saber si trabaja o espera. Van sin
-- LOCAL porque ya no hay transacción a la que atarlos.
SET lock_timeout      = '5s';
SET statement_timeout = '60s';

-- Fuera de la transacción a propósito: si el VALIDATE fallara, el constraint se
-- queda en NOT VALID —que sigue vigilando toda escritura nueva— y hay datos
-- viejos que mirar antes de reintentar. Es el estado seguro, no un a medias.
ALTER TABLE public.appointments VALIDATE CONSTRAINT appointments_status_check;

-- ⚠️ DEVOLVER LOS DOS A SU VALOR DE SESIÓN, Y NO ES HIGIENE: SIN LOCAL, LOS
-- `SET` DE ARRIBA SE QUEDAN PEGADOS A LA CONEXIÓN. El SQL Editor de Supabase
-- reparte conexiones de un pool, así que la siguiente consulta que se lance en
-- esa pestaña puede caer en la MISMA conexión con `statement_timeout = 60s`
-- puesto y morir con 57014 sin que la causa esté a la vista — e intermitente,
-- según qué conexión le toque, que es peor que reproducible.
--
-- Y 60 s es MÁS CORTO que el valor por defecto: esto no relaja un límite, lo
-- aprieta y lo deja apretado. Justo cuando lo siguiente puede ser el respaldo
-- `CREATE TABLE respaldos.… AS SELECT …` que recomiendan estas cabeceras.
--
-- Va DESPUÉS del VALIDATE —que sí los necesita— y ANTES del veredicto, que
-- tarda milisegundos y tiene que seguir siendo la última sentencia del archivo
-- (dimensión 5).
RESET lock_timeout;
RESET statement_timeout;

-- ── VEREDICTO EN LA REJILLA (dimensión 5) ───────────────────────────────────
-- El SQL Editor de Supabase no muestra de forma fiable RAISE NOTICE ni RAISE
-- WARNING: una migración cuyo resultado viaje sólo por ahí se lee igual haya
-- funcionado o no. Última sentencia del archivo a propósito.
WITH m AS (
  SELECT
    (SELECT count(*) FROM pg_constraint
      WHERE conrelid = 'public.appointments'::regclass
        AND conname  = 'appointments_status_check'
        AND convalidated)                                              AS validada,
    (SELECT pg_get_constraintdef(oid) FROM pg_constraint
      WHERE conrelid = 'public.appointments'::regclass
        AND conname  = 'appointments_status_check')                    AS definicion,
    -- Los valores que DEBERÍAN estar y no están. Cadena vacía = los cinco.
    (SELECT coalesce(string_agg(v, ', '), '')
       FROM unnest(ARRAY['scheduled','confirmed','cancelled','no_show','attended']) AS v
      WHERE (SELECT pg_get_constraintdef(oid) FROM pg_constraint
              WHERE conrelid = 'public.appointments'::regclass
                AND conname  = 'appointments_status_check') NOT LIKE '%''' || v || '''%') AS faltantes,
    (SELECT count(*) FROM public.appointments
      WHERE status = 'attended')                                       AS ya_atendidas,
    (SELECT count(*) FROM public.appointments
      WHERE status IS NULL
         OR status NOT IN ('scheduled','confirmed','cancelled','no_show','attended')) AS filas_raras
)
SELECT m.*,
       CASE
         WHEN m.validada <> 1 THEN
           'REVISAR: appointments_status_check no existe o quedó NOT VALID. El VALIDATE no pasó.'
         /* ⚠️ SE EXIGEN LOS CINCO, NO SÓLO EL NUEVO. Buscar `attended` y darlo
            por bueno no detecta el fallo peligroso: que al editar el ARRAY se
            haya CAÍDO uno de los cuatro viejos. Si se perdiera `no_show` y
            ninguna fila lo usara hoy, el VALIDATE pasaría y esto diría OK — y
            el fallo aparecería semanas después, como un 23514 al marcar la
            primera inasistencia. */
         WHEN m.faltantes <> '' THEN
           'REVISAR: el CHECK NO admite estos valores: ' || m.faltantes || '. Se sustituyó por uno incompleto y la base rechazará esos estados.'
         WHEN m.filas_raras > 0 THEN
           'REVISAR: hay ' || m.filas_raras || ' fila(s) con un status fuera de la lista. Imposible con el CHECK validado; mirar a mano.'
         ELSE
           'OK — appointments.status admite los 5 valores (scheduled, confirmed, cancelled, no_show, attended). ya_atendidas debe ser 0 hasta que suba el código.'
       END AS veredicto
  FROM m;
