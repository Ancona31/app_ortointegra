-- ESTADO: APLICADA Y VERIFICADA EN PRODUCCIÓN EL 2026-08-21.
-- ============================================================================
-- Aplicada a la primera, sin errores. Veredicto devuelto en la rejilla:
--
--   columnas_text       = 2   (icono y color, las dos text)
--   columnas_nullables  = 2   (ninguna nació NOT NULL)
--   checks_validados    = 2   (los dos CHECK con convalidated = t)
--   faltan_iconos       = ''  (los CINCO iconos están en el CHECK)
--   faltan_colores      = ''  (los CUATRO colores están en el CHECK)
--   grants_por_columna  = 0   (ninguna columna con ACL propio)
--   filas_con_pinta     = 0   (correcto: el código aún no ha subido)
--
-- ── POSTGREST: VERIFICADO DESDE FUERA, NO SÓLO EN EL SQL EDITOR ────────────
-- El 2026-08-21, con la anon key del proyecto:
--   /rest/v1/appointments?select=id,icono,color  →  200, `[]`
-- Sin PGRST204. La caché de esquema ya conoce las dos columnas y no hizo falta
-- el `NOTIFY pgrst, 'reload schema'`. Esto cierra el hueco que la sección de
-- más abajo advierte: el veredicto de la rejilla no pasa por PostgREST y no
-- podía decir nada de esto.
--
-- (El texto del propio veredicto sigue diciendo «FALTA COMPROBAR PostgREST».
-- Se queda: es un literal DENTRO de una sentencia ya ejecutada, y §7 sólo
-- permite anotar por encima, nunca reescribir lo que corrió. Lo cierto es esta
-- anotación, no aquella línea.)
--
-- ── LA GUARDA DE REPLAY: VERIFICADA, YA NO ES UNA ASUNCIÓN ─────────────────
-- Los dos literales de `v_esperado_icono` y `v_esperado_color` estaban
-- RAZONADOS y no leídos, y aplicar bien no los probaba —en la primera pasada
-- esa guarda no se evalúa, porque los constraints todavía no existen—.
--
-- **Ya están comprobados.** El 2026-08-21 se corrió la comprobación en seco que
-- el propio archivo describe (`TEMP TABLE` con los dos CHECK,
-- `pg_get_constraintdef`, `ROLLBACK`, sin dejar rastro) y las dos cadenas
-- coinciden **byte a byte** con lo escrito. El razonamiento sobre el nivel de
-- paréntesis que introduce el `OR` era correcto.
--
-- ⚠️ El comentario que hay junto a esos literales sigue diciendo «ASUMIDO, NO
-- LEÍDO», y se queda: vive dentro del bloque `DO $$` —una sentencia ejecutada—
-- y §7 no deja reescribirlo. Lo cierto es esto de aquí.
-- ============================================================================
-- ⚠️ DE LA PRIMERA SENTENCIA HACIA ABAJO NO SE TOCA NADA (§7 de
-- supabase/AUDITORIA-MIGRACIONES.md). Este bloque de comentarios es la única
-- región editable, y sólo para anotar.
--
-- ── ANOTACIÓN 2026-08-21: EL VEREDICTO DE ESTE ARCHIVO NO SE PROBÓ NUNCA ────
-- Contra un Postgres real, quiero decir. Pasó por dos auditorías y **ninguna
-- ejecutó SQL**. Aquí salió bien, pero en la migración 5 de esta misma serie el
-- `SELECT` del veredicto murió con `ERROR 42725: operator is not unique:
-- unknown || "char"` —concatenar `pg_constraint.confdeltype` sin `::text`— y lo
-- hizo con la transacción ya confirmada.
--
-- Este archivo se libró porque sus concatenaciones son sobre `text` y `bigint`.
--
-- (Aquella anotación seguía diciendo que la guarda de replay estaba SIN
-- comprobar. Ya no lo está: se verificó en seco el mismo 2026-08-21 y coincide
-- byte a byte. El detalle, arriba.)
--
-- La comprobación de que quedó aplicado, para volver a hacerla cuando haga falta:
-- La comprobación queda YA ESCRITA para no inventarla ese día:
--
--   SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS tipo, a.attnotnull
--     FROM pg_attribute a
--    WHERE a.attrelid = 'public.appointments'::regclass
--      AND a.attname IN ('icono','color')
--      AND a.attnum > 0 AND NOT a.attisdropped;
--   SELECT conname, convalidated, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = 'public.appointments'::regclass
--      AND conname IN ('appointments_icono_check','appointments_color_check');
--   -- Aplicada = dos columnas text nullables + dos CHECK con convalidated = t.
-- ============================================================================
-- Eventos genéricos sin paciente: icono y color  (plan §12.8, §12.14, §12.15 fila 4)
--
-- ── QUÉ CAMBIA ──────────────────────────────────────────────────────────────
--   appointments.icono  text NULL, CHECK contra lista cerrada de 5 valores.
--   appointments.color  text NULL, CHECK contra lista cerrada de 4 valores.
--
-- Nada más. Ni una fila se mueve; las que ya existen nacen con NULL en las dos.
--
-- ── QUÉ ES UN EVENTO GENÉRICO, Y QUÉ NO ─────────────────────────────────────
-- Una fila de `appointments` SIN paciente: nace en Spinus y se sincroniza a
-- Google como cualquier cita. «Cirugía Sr. Pérez», «Junta de personal»,
-- «Bloqueo — consulta externa».
--
-- NO CONFUNDIR con los eventos escritos a mano en Google (§12.1), que nacen
-- allí, NO existen en esta tabla y son inertes. Esas dos cosas se parecen al
-- describirlas y no comparten ni una línea de código.
--
-- ── POR QUÉ NO HACE FALTA NINGUNA COLUMNA PARA EL TEXTO ─────────────────────
-- El título es TEXTO LIBRE y ya tiene sitio: `appointments.title`, que es NOT
-- NULL desde el principio. No hay tipos cerrados de evento y no los va a haber.
-- Lo único que se cierra es la PINTA: icono y color.
--
-- ── POR QUÉ EL CHECK, QUE NO ES DESCONFIAR DEL USUARIO ──────────────────────
-- Si la columna admitiera cualquier cosa, un fallo de interfaz o un UPDATE
-- directo por PostgREST metería un valor que la agenda no sabe pintar, y el
-- evento saldría ROTO: sin error, sólo mal. La lista cerrada convierte eso en
-- un rechazo de la base, que es un fallo que alguien ve.
--
-- ⚠️ LOS VALORES SON PROVISIONALES; LA FORMA NO. Claude Design va a proponer la
-- iconografía y rehacer la estética del calendario, y va a sustituir estas dos
-- listas. Cambiar los valores después es trivial —un ALTER del CHECK y un
-- UPDATE de las pocas filas que hubiera—. Pasar de texto libre a lista cerrada
-- NO lo es: obliga a migrar datos que ya no encajan. Por eso la lista cerrada
-- entra ahora aunque los valores no estén decididos del todo.
--
-- ── LAS DOS LISTAS, Y LO QUE SE RETIRÓ DE CADA UNA ──────────────────────────
--
-- ICONOS (5): bisturi (cirugía), personas (reunión), candado (bloqueo de
-- horario), avion (ausencia o viaje), libro (formación).
--
--   §12.14 proponía un sexto, `punto`, para «genérico, sin icono». SE RETIRA:
--   la columna es nullable y NULL ya significa exactamente eso. Dos nombres
--   para el mismo concepto es el cabo suelto que §12.13 prohíbe, y aquí se
--   habría metido de nacimiento.
--
-- COLORES (4): ambar (#d97706), rosa (#db2777), terracota (#9a3412),
-- indigo (#4338ca).
--
--   RESTRICCIÓN DURA: ningún color puede colisionar con los de los ESTADOS de
--   cita, o un evento genérico se confunde con una cita de un vistazo. Ocupados
--   hoy en src/app/globals.css: azul #2f6fed (agendada), verde #16a34a
--   (confirmada), rojo #dc2626 (cancelada), gris pizarra #64748b (no asistió),
--   teal oscuro #0f766e (ATENDIDA, estrenado en la migración 3), y morado
--   #7c5cdb, que es de los eventos de Google.
--
--   §12.14 proponía un quinto, `cian` (#0891b2). SE RETIRA: era el par más
--   apretado con el teal de «atendida» (hue 192 contra 175) y, entre un color
--   de estado y uno decorativo, gana el estado. Los de estado no son
--   provisionales; éstos sí.
--
-- ── EL PERMISO DE ESCRITURA (§12.7), DECIDIDO AQUÍ PARA QUE NO SE DECIDA SOLO ─
-- `icono` y `color` van del lado PERMITIDO: un médico invitado SIN permiso de
-- escritura puede cambiarlos. No afectan a nadie más que a cómo se ve el
-- evento —no mueven una hora, no cambian de paciente, no reasignan a nadie—.
--
-- ⚠️ ESTO ES PARA EL TRIGGER DE LA MIGRACIÓN 2 (commit 7), que compara NEW
-- contra OLD columna por columna. Queda escrito aquí porque ese trigger se
-- escribe con una lista cerrada, y lo que no esté nombrado se decide por
-- omisión — que es como se cuelan los permisos que nadie eligió.
--
-- ── ORDEN DE DESPLIEGUE — ESTE ARCHIVO VA ANTES DEL CÓDIGO ──────────────────
-- Código viejo contra esquema migrado: no pasa nada, ignora columnas que no
-- conoce. Código nuevo contra esquema viejo: el INSERT entero revienta por
-- columna inexistente y NO SE PUEDE AGENDAR NADA. Este orden no es preferible,
-- es el único.
--
-- ── PRE-VUELO (correr APARTE, leer el resultado; no forma parte del archivo) ─
--
--   -- ⚠️ ESTE IMPORTA AQUÍ DE VERDAD, y no en la migración 3: si hay grants a
--   -- nivel de COLUMNA, las columnas NUEVAS nacen invisibles para anon y
--   -- authenticated, y habría que concederlas a mano. La agenda las pediría
--   -- por PostgREST y no llegarían, sin error claro.
--   --
--   -- ⚠️ NO USAR `information_schema.column_privileges`: EXPANDE los grants de
--   -- TABLA columna por columna, así que sobre appointments devuelve del orden
--   -- de un centenar de filas aunque no exista ni un solo grant de columna. El
--   -- ACL real vive en `pg_attribute.attacl`, NULL cuando el grant es de tabla.
--   -- Comprobado y escrito desde el 2026-08-17 en
--   -- 20260817_gcal_conexion_clinica_a_esquema.sql:92-107.
--   SELECT c.relname, a.attname, a.attacl
--     FROM pg_attribute a
--     JOIN pg_class c     ON c.oid = a.attrelid
--     JOIN pg_namespace n ON n.oid = c.relnamespace
--    WHERE n.nspname = 'public'
--      AND c.relname = 'appointments'
--      AND a.attnum > 0 AND NOT a.attisdropped
--      AND a.attacl IS NOT NULL;
--   -- Se espera VACÍO. Si devuelve filas, parar y conceder a mano.
--
--   SELECT pid, state, age(clock_timestamp(), xact_start) AS edad, query
--     FROM pg_stat_activity
--    WHERE xact_start IS NOT NULL AND state <> 'idle'
--    ORDER BY xact_start;
--
-- ── DESPUÉS DE APLICAR: LA CACHÉ DE ESQUEMA DE POSTGREST ────────────────────
-- Tras un `ADD COLUMN`, PostgREST puede seguir sirviendo su esquema en caché y
-- responder **PGRST204 «column not found»** a cualquier INSERT o UPDATE que
-- nombre `icono` o `color` — o sea, a TODA alta de cita — hasta que recargue.
--
-- ⚠️ EL SQL EDITOR NO PRUEBA ESTO, y por eso hay que decirlo: sus consultas van
-- directas a Postgres sin pasar por PostgREST, así que el veredicto del final
-- puede salir OK mientras la aplicación está rota. Son dos caminos distintos.
--
-- Comprobar desde fuera, con la anon key del proyecto:
--   curl -s "$SUPABASE_URL/rest/v1/appointments?select=id,icono,color&limit=1" \
--        -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
--   -- 200 (aunque sea `[]` por la RLS) = la caché ya tiene las columnas.
--   -- PGRST204 o «column does not exist» = no ha recargado.
--
-- Si no ha recargado, forzarlo desde el SQL Editor:
--   NOTIFY pgrst, 'reload schema';
--
-- ── BLOQUEOS Y COSTE ────────────────────────────────────────────────────────
-- Columna nullable SIN DEFAULT: Postgres no reescribe la tabla, sólo apunta el
-- catálogo. El ACCESS EXCLUSIVE dura lo que tarde eso, incluso con millones de
-- filas. Los CHECK van NOT VALID + VALIDATE por el mismo motivo que la
-- migración 3, aunque aquí no puedan fallar: todas las filas nacen NULL y el
-- CHECK admite NULL explícitamente.
--
-- ── AISLAMIENTO ENTRE CLÍNICAS (dimensión 10) ───────────────────────────────
-- No crea objetos nuevos alcanzables por PostgREST: son dos columnas de una
-- tabla que ya tiene RLS y cuyas policies filtran por `clinica_id`. Las
-- columnas nuevas quedan cubiertas por las mismas policies, sin excepción. No
-- se crea ningún índice único sobre ellas —no lo llevan y no deben llevarlo—,
-- así que no hay forma de sondear la existencia de filas ajenas por conflicto.
-- El alcance de los roles no cambia en NINGUNA de las dos direcciones
-- (dimensión 15): quien podía editar una cita sigue pudiendo, y quien no,
-- tampoco puede ahora.
--
-- ── REVERSIÓN ───────────────────────────────────────────────────────────────
-- DROP COLUMN de las dos. Es DESTRUCTIVO en el sentido literal: se pierde el
-- icono y el color que alguien hubiera elegido. Como los eventos genéricos no
-- existen hasta que suba el código, revertir el mismo día no pierde nada; una
-- semana después, sí. Antes de revertir, respaldar:
--   CREATE TABLE respaldos.appointments_pinta_AAAAMMDD AS
--     SELECT id, clinica_id, icono, color FROM public.appointments
--      WHERE icono IS NOT NULL OR color IS NOT NULL;
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout      = '5s';
SET LOCAL statement_timeout = '60s';

-- ── PRE-VUELO QUE ABORTA (dimensión 4) ──────────────────────────────────────
-- `ADD COLUMN IF NOT EXISTS` es un no-op silencioso si la columna ya existe
-- CON CUALQUIER TIPO. Ese es justo el caso que la dimensión 3 obliga a separar:
-- «ya está hecho y repetirlo es inofensivo» sólo es cierto si lo que hay es lo
-- que esperamos. Si `icono` existiera como jsonb, o `color` como integer, el
-- archivo seguiría adelante y el CHECK reventaría después con un error de tipo
-- que no dice nada de la causa.
DO $$
DECLARE
  v_tipo text;
BEGIN
  FOR v_tipo IN
    SELECT a.attname || ':' || format_type(a.atttypid, a.atttypmod)
      FROM pg_attribute a
     WHERE a.attrelid = 'public.appointments'::regclass
       AND a.attname IN ('icono','color')
       AND a.attnum > 0 AND NOT a.attisdropped
       AND format_type(a.atttypid, a.atttypmod) <> 'text'
  LOOP
    RAISE EXCEPTION
      'PRE-VUELO FALLO: appointments ya tiene una columna con el nombre esperado y OTRO tipo (%). No es un replay inofensivo. Abortando.',
      v_tipo;
  END LOOP;
END $$;

-- ── QUÉ ESTAMOS A PUNTO DE DESTRUIR (dimensión 3, y dimensión 4) ────────────
-- Los `DROP CONSTRAINT` de abajo tiran definiciones SIN MIRARLAS y las
-- sustituyen por literales escritos aquí. Y en ESTA migración el riesgo no es
-- teórico, lo anuncia su propia cabecera: **las listas son provisionales y
-- Claude Design va a sustituirlas**. El día que eso ocurra por otra migración,
-- reejecutar este archivo devolvería las listas viejas EN SILENCIO y sin
-- fallar — y las filas que usaran un valor nuevo empezarían a rebotar.
--
-- La guarda acepta sólo dos estados por constraint: ausente (aún sin aplicar)
-- o exactamente el que este archivo crea (replay inofensivo). Cualquier otra
-- definición aborta.
--
-- ⚠️ COMPARACIÓN EXACTA, NO REGEX. Una regex que «busque bisturi» daría por
-- buena una lista ampliada con un sexto icono, que es justo lo que hay que
-- atrapar.
--
-- ⚠️ LOS LITERALES SE LEEN DE LA BASE, NO SE ESCRIBEN DE MEMORIA. El formato de
-- `pg_get_constraintdef` depende de la versión de Postgres. Tras aplicar por
-- primera vez, correr esto y pegar el resultado si no coincide:
--
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = 'public.appointments'::regclass
--      AND conname IN ('appointments_icono_check','appointments_color_check');
--
-- SI NO CUADRA, LA MIGRACIÓN ABORTA SIEMPRE sin tocar nada — que es el fallo
-- seguro de una guarda, no un problema de la base. Conviene saberlo antes.
DO $$
DECLARE
  v_actual  text;
  /* ⚠️ ASUMIDO, NO LEÍDO. Estos dos constraints NO EXISTEN todavía en ninguna
     base, así que no hay de dónde leerlos: la forma está RAZONADA a partir de
     cómo deparsea Postgres un `BoolExpr` OR —cada operando entre paréntesis y
     el conjunto entre paréntesis— más el par que envuelve todo CHECK. De ahí
     los cuatro cierres tras el `]`:
       CHECK (  ( (icono IS NULL) OR (icono = ANY ( ARRAY[…] )) )  )
              1   2                   3            4
     Es UN NIVEL MÁS que en la migración 3, y la diferencia es exactamente el
     `OR`: allí no lo hay y la forma leída de producción lleva tres cierres.
     Confundir las dos formas ya rompió la migración 3 una vez.

     ⚠️ COMPROBACIÓN EN SECO, ANTES DE APLICAR. No hace falta tocar nada real:
     una tabla temporal con los mismos dos CHECK deparsea igual, y el ROLLBACK
     no deja rastro. Si la salida no coincide EXACTAMENTE con estas dos cadenas,
     pegar la buena aquí antes de aplicar — si no, la guarda abortará en la
     segunda pasada:

       BEGIN;
       CREATE TEMP TABLE _fmt (
         icono text CHECK (icono IS NULL OR icono = ANY (ARRAY['bisturi','personas','candado','avion','libro']::text[])),
         color text CHECK (color IS NULL OR color = ANY (ARRAY['ambar','rosa','terracota','indigo']::text[]))
       );
       SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
        WHERE conrelid = '_fmt'::regclass AND contype = 'c';
       ROLLBACK;

     NOTA: en la primera pasada esta guarda NO se evalúa —los constraints no
     existen y `v_actual` sale NULL—, así que un literal equivocado no impide
     aplicar: rompe el REPLAY. Por eso conviene cuadrarlo ahora y no el día que
     haga falta reejecutar. */
  v_esperado_icono text := 'CHECK (((icono IS NULL) OR (icono = ANY (ARRAY[''bisturi''::text, ''personas''::text, ''candado''::text, ''avion''::text, ''libro''::text]))))';
  v_esperado_color text := 'CHECK (((color IS NULL) OR (color = ANY (ARRAY[''ambar''::text, ''rosa''::text, ''terracota''::text, ''indigo''::text]))))';
BEGIN
  SELECT regexp_replace(pg_get_constraintdef(oid), ' NOT VALID$', '') INTO v_actual
    FROM pg_constraint
   WHERE conrelid = 'public.appointments'::regclass
     AND conname  = 'appointments_icono_check';
  IF v_actual IS NOT NULL AND v_actual IS DISTINCT FROM v_esperado_icono THEN
    RAISE EXCEPTION
      'PRE-VUELO FALLO: appointments_icono_check ya existe con una definición que este archivo no reconoce, y el DROP la destruiría en silencio. Encontrado: %. Esperado: %. Abortando.',
      v_actual, v_esperado_icono;
  END IF;

  SELECT regexp_replace(pg_get_constraintdef(oid), ' NOT VALID$', '') INTO v_actual
    FROM pg_constraint
   WHERE conrelid = 'public.appointments'::regclass
     AND conname  = 'appointments_color_check';
  IF v_actual IS NOT NULL AND v_actual IS DISTINCT FROM v_esperado_color THEN
    RAISE EXCEPTION
      'PRE-VUELO FALLO: appointments_color_check ya existe con una definición que este archivo no reconoce, y el DROP la destruiría en silencio. Encontrado: %. Esperado: %. Abortando.',
      v_actual, v_esperado_color;
  END IF;
END $$;

-- ── LAS DOS COLUMNAS ────────────────────────────────────────────────────────
-- Nullables a propósito y sin DEFAULT: una cita normal no lleva ninguna de las
-- dos, y NULL es lo que significa «esto no es un evento genérico, o lo es y no
-- eligió pinta». No hay tercer estado que representar.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS icono text,
  ADD COLUMN IF NOT EXISTS color text;

COMMENT ON COLUMN public.appointments.icono IS
  'Icono del evento genérico sin paciente (plan §12.14). Lista cerrada por CHECK. NULL = sin icono; no existe un valor "ninguno".';
COMMENT ON COLUMN public.appointments.color IS
  'Color del evento genérico sin paciente (plan §12.14). Lista cerrada por CHECK. Ningún valor puede colisionar con los colores de los ESTADOS de cita ni con el morado de los eventos de Google.';

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_icono_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_icono_check
  CHECK (icono IS NULL OR icono = ANY (ARRAY['bisturi'::text, 'personas'::text, 'candado'::text, 'avion'::text, 'libro'::text]))
  NOT VALID;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_color_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_color_check
  CHECK (color IS NULL OR color = ANY (ARRAY['ambar'::text, 'rosa'::text, 'terracota'::text, 'indigo'::text]))
  NOT VALID;

COMMIT;

-- ⚠️ Los `SET LOCAL` murieron en el COMMIT y lo que viene está fuera de la
-- transacción. Sin repetirlos, un VALIDATE que encuentre el lock ocupado —un
-- autovacuum, por ejemplo— espera SIN LÍMITE y el editor parece colgado. Van
-- sin LOCAL porque ya no hay transacción a la que atarlos.
SET lock_timeout      = '5s';
SET statement_timeout = '60s';

-- Fuera de la transacción: SHARE UPDATE EXCLUSIVE, no bloquea lecturas ni
-- escrituras. No pueden fallar —todas las filas están en NULL— pero si alguno
-- fallara, ese constraint se queda NOT VALID vigilando lo nuevo, que es el
-- estado seguro.
ALTER TABLE public.appointments VALIDATE CONSTRAINT appointments_icono_check;
ALTER TABLE public.appointments VALIDATE CONSTRAINT appointments_color_check;

-- ⚠️ Sin LOCAL, los `SET` de arriba se quedan pegados a la CONEXIÓN, y el SQL
-- Editor reparte conexiones de un pool: la siguiente consulta de esa pestaña
-- puede caer en la misma con `statement_timeout = 60s` y morir con 57014, de
-- forma intermitente. Y 60 s es más corto que el valor por defecto, así que
-- esto aprieta el límite en vez de relajarlo. Va antes del veredicto, que tarda
-- milisegundos y debe seguir siendo la última sentencia (dimensión 5).
RESET lock_timeout;
RESET statement_timeout;

-- ── VEREDICTO EN LA REJILLA (dimensión 5) ───────────────────────────────────
WITH m AS (
  SELECT
    (SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='appointments'
        AND column_name IN ('icono','color') AND data_type='text')      AS columnas_text,
    (SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='appointments'
        AND column_name IN ('icono','color') AND is_nullable='YES')     AS columnas_nullables,
    (SELECT count(*) FROM pg_constraint
      WHERE conrelid='public.appointments'::regclass
        AND conname IN ('appointments_icono_check','appointments_color_check')
        AND convalidated)                                               AS checks_validados,
    (SELECT pg_get_constraintdef(oid) FROM pg_constraint
      WHERE conrelid='public.appointments'::regclass
        AND conname='appointments_icono_check')                         AS def_icono,
    (SELECT pg_get_constraintdef(oid) FROM pg_constraint
      WHERE conrelid='public.appointments'::regclass
        AND conname='appointments_color_check')                         AS def_color,
    /* Los valores que DEBERÍAN estar en cada CHECK y no están. Cadena vacía =
       la lista completa. No basta con mirar si la definición existe: si al
       editar el ARRAY se cayera un valor y ninguna fila lo usara —hoy no lo usa
       ninguna, todas están en NULL—, el VALIDATE pasaría y esto diría OK. El
       fallo aparecería el primer día que alguien eligiera ese icono. */
    (SELECT coalesce(string_agg(v, ', '), '')
       FROM unnest(ARRAY['bisturi','personas','candado','avion','libro']) AS v
      WHERE coalesce((SELECT pg_get_constraintdef(oid) FROM pg_constraint
                       WHERE conrelid='public.appointments'::regclass
                         AND conname='appointments_icono_check'), '') NOT LIKE '%''' || v || '''%') AS faltan_iconos,
    (SELECT coalesce(string_agg(v, ', '), '')
       FROM unnest(ARRAY['ambar','rosa','terracota','indigo']) AS v
      WHERE coalesce((SELECT pg_get_constraintdef(oid) FROM pg_constraint
                       WHERE conrelid='public.appointments'::regclass
                         AND conname='appointments_color_check'), '') NOT LIKE '%''' || v || '''%') AS faltan_colores,
    /* Grants a nivel de COLUMNA: si los hubiera, las columnas nuevas nacen
       invisibles para el cliente y la agenda no las recibiría.

       ⚠️ `pg_attribute.attacl` y NO `information_schema.column_privileges`. Esa
       vista EXPANDE los grants de TABLA columna por columna y devuelve del
       orden de un centenar de filas sobre appointments aunque no exista ni un
       grant de columna — o sea que esta rama del CASE se cumplía SIEMPRE y
       TAPABA las cinco comprobaciones de arriba: el veredicto decía REVISAR
       incluso con la migración perfecta. Estaba comprobado y escrito desde el
       2026-08-17 en 20260817_gcal_conexion_clinica_a_esquema.sql:92-107. */
    (SELECT count(*) FROM pg_attribute a
      WHERE a.attrelid = 'public.appointments'::regclass
        AND a.attnum > 0 AND NOT a.attisdropped
        AND a.attacl IS NOT NULL)                                       AS grants_por_columna,
    (SELECT count(*) FROM public.appointments
      WHERE icono IS NOT NULL OR color IS NOT NULL)                     AS filas_con_pinta
)
SELECT m.*,
       CASE
         WHEN m.columnas_text <> 2 THEN
           'REVISAR: no hay dos columnas text llamadas icono y color. Se crearon mal o ya existían con otro tipo.'
         WHEN m.columnas_nullables <> 2 THEN
           'REVISAR: alguna de las dos nació NOT NULL. Una cita normal no lleva ninguna.'
         WHEN m.checks_validados <> 2 THEN
           'REVISAR: falta algún CHECK o quedó NOT VALID.'
         WHEN m.faltan_iconos <> '' THEN
           'REVISAR: el CHECK de icono NO admite estos valores: ' || m.faltan_iconos || '. La base los rechazará cuando alguien los elija.'
         WHEN m.faltan_colores <> '' THEN
           'REVISAR: el CHECK de color NO admite estos valores: ' || m.faltan_colores || '. La base los rechazará cuando alguien los elija.'
         WHEN m.def_icono LIKE '%punto%' THEN
           'REVISAR: el CHECK de icono admite ''punto''. Se retiró a propósito: NULL ya significa sin icono.'
         WHEN m.def_color LIKE '%cian%' THEN
           'REVISAR: el CHECK de color admite ''cian''. Se retiró a propósito: colisionaba con el teal de ''attended''.'
         WHEN m.grants_por_columna > 0 THEN
           'REVISAR: hay ' || m.grants_por_columna || ' columna(s) de appointments con ACL propio. Las columnas nuevas pueden ser invisibles para el cliente; conceder a mano.'
         ELSE
           'OK — appointments.icono (5 valores) y appointments.color (4 valores), las dos nullables y con su CHECK validado. filas_con_pinta debe ser 0 hasta que suba el código. FALTA COMPROBAR PostgREST desde fuera (ver la cabecera): esta consulta no pasa por ahí.'
       END AS veredicto
  FROM m;
