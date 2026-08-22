-- ESTADO: APLICADA Y VERIFICADA EN PRODUCCIÓN EL 2026-08-21, al segundo intento.
-- ============================================================================
-- Veredicto final devuelto en la rejilla:
--
--   columna_ok         = 1   (appointment_id existe como uuid nullable)
--   fk_validada        = 1   (la FK existe y convalidated = t)
--   accion_al_borrar   = n   (ON DELETE SET NULL, que es lo correcto)
--   indice             = 1   (idx_consultas_appointment_id en su sitio)
--   unique_indebido    = 0   (nadie añadió un UNIQUE)
--   grants_por_columna = 0
--   consultas_con_cita = 0   (correcto: el código aún no ha subido)
--
-- ── POSTGREST: VERIFICADO DESDE FUERA ─────────────────────────────────────
-- Con la anon key del proyecto:
--   /rest/v1/consultas?select=id,appointment_id  →  200, `[]`
-- Sin PGRST204. La caché de esquema ya conoce la columna y no hizo falta el
-- `NOTIFY pgrst, 'reload schema'`. Importaba especialmente aquí: lo que se
-- habría perdido de no ser así es una nota clínica recién escrita.
--
-- (El texto del propio veredicto sigue diciendo «FALTA COMPROBAR PostgREST».
-- Se queda: es un literal dentro de una sentencia ejecutada, y §7 sólo permite
-- anotar por encima. Lo cierto es esta anotación.)
--
-- ── EL PRIMER INTENTO FALLÓ, Y SE CONSERVA ESCRITO ────────────────────────
-- No es historia ociosa: es el motivo de que el `::text` del `WITH m` exista y
-- la razón por la que un veredicto no se da por bueno leyéndolo.
--
-- El 2026-08-21 este archivo se ejecutó y MURIÓ EN LA CONSULTA DEL VEREDICTO,
-- con la transacción ya confirmada:
--
--   ERROR 42725: operator is not unique: unknown || "char"
--
-- `pg_constraint.confdeltype` es de tipo `"char"` y el CASE lo concatenaba con
-- un literal sin castear. Es un fallo de ANÁLISIS, no de ejecución: la consulta
-- entera se rechaza antes de evaluar ninguna rama. Corregido con `::text` en el
-- `WITH m` (ver el comentario junto a `accion_al_borrar`).
--
-- QUÉ QUEDÓ APLICADO, comprobado en producción ese mismo día:
--   · `consultas.appointment_id`, el índice y la FK EXISTEN — el bloque
--     BEGIN…COMMIT pasó entero.
--   · `confdeltype = n` — la FK es ON DELETE SET NULL, que es lo correcto.
--   · `convalidated = false` — el error mató el script ANTES del VALIDATE.
--
-- O sea: el estado real era «FK creada y NOT VALID», que es exactamente el que
-- la guarda de pre-vuelo sabe reconocer —de ahí la normalización del sufijo
-- ` NOT VALID` que lleva—.
--
-- ── CÓMO SE CERRÓ, EL MISMO DÍA ───────────────────────────────────────────
--   1. Se corrigió el `||` casteando `confdeltype::text` en el `WITH m`.
--   2. **El veredicto se probó SOLO, antes de tocar nada más:** se extrajo la
--      consulta final y se corrió aparte, que es lectura pura. Corrió limpia
--      —sin el 42725— y reportó correctamente el estado a medias, eligiendo la
--      rama `fk_validada <> 1`. Ese paso es el que faltó desde el principio.
--   3. Se reejecutó el archivo ENTERO, y esta vez llegó al final: el ADD COLUMN
--      y el CREATE INDEX fueron no-op por IF NOT EXISTS, la guarda reconoció la
--      FK NOT VALID gracias a la normalización, y el VALIDATE corrió.
--
-- La comprobación que respalda el rótulo de arriba, para repetirla:
--
--   SELECT conname, convalidated, confdeltype, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = 'public.consultas'::regclass
--      AND conname  = 'consultas_appointment_id_fkey';
--   -- Aplicada = una fila, convalidated = t y confdeltype = 'n' (SET NULL).
--   SELECT indexname FROM pg_indexes
--    WHERE schemaname='public' AND indexname='idx_consultas_appointment_id';
--   -- Aplicada = una fila.
--
-- ── LO QUE DOS AUDITORÍAS NO PODÍAN CAZAR, Y HAY QUE TENER PRESENTE ─────────
-- Este archivo pasó por DOS revisiones antes de ejecutarse y las dos lo dieron
-- por bueno. Ninguna vio el `||` sobre `"char"`, y no por descuido: **ninguna
-- de las dos ejecutó SQL**. Un error de resolución de operadores no se ve
-- leyendo, se ve cuando el analizador lo rechaza.
--
-- Y hay un agravante de forma que conviene nombrar: **el veredicto es la parte
-- del archivo que menos se revisa y la única que corre siempre al final**, así
-- que un fallo suyo aparece con todo lo demás ya aplicado — que es justo lo que
-- pasó. Las sentencias de esquema estaban bien; lo que rompió fue la consulta
-- que sirve para saber si estaban bien.
--
-- **Para el siguiente que escriba una migración de esta serie:** las columnas
-- de catálogo `confdeltype`, `confupdtype`, `contype`, `relkind`, `attidentity`
-- y `attgenerated` son todas de tipo `"char"` y **no se pueden concatenar sin
-- `::text`**. Compararlas con un literal (`contype = 'p'`) sí funciona, y por
-- eso el defecto se cuela: el archivo está lleno de comparaciones correctas.
-- ============================================================================
-- De qué cita salió esta consulta  (plan §12.13, §12.15 fila 5)
--
-- ── QUÉ CAMBIA ──────────────────────────────────────────────────────────────
--   consultas.appointment_id  uuid NULL, FK → appointments(id) ON DELETE SET NULL
--   idx_consultas_appointment_id  índice parcial sobre las filas que la llevan
--
-- Nada más. Ni una fila se mueve; las consultas que ya existen nacen con NULL,
-- que es la verdad: nadie sabe de qué cita salieron.
--
-- ── POR QUÉ EXISTE ESTA COLUMNA ─────────────────────────────────────────────
-- §12.13 dice que «Iniciar consulta» marque la cita como atendida. El mecanismo
-- escrito allí —escribir el estado al pulsar el botón— NO SE PUEDE CONSTRUIR:
-- los tres botones son enlaces de navegación (`agenda/page.tsx`,
-- `dashboard/page.tsx` ×2), así que una petición disparada en el clic compite
-- con la navegación y el navegador puede abortarla. «El estado no se guarda»
-- no sería el caso raro sino el normal, y el «se reintenta» que §12.13 promete
-- no tenía dónde vivir.
--
-- El estado se escribe entonces EN EL SERVIDOR, cuando la consulta se crea de
-- verdad (`POST /api/consultas`). No hay petición que abortar, no hace falta
-- reintento, si falla falla donde alguien lo ve, y da igual desde cuál de los
-- tres botones se haya llegado. Efecto secundario y deseado: quien pulsa y se
-- arrepiente sin escribir nada NO deja la cita marcada.
--
-- Para eso el servidor tiene que saber a qué cita corresponde la consulta, y
-- HOY NO HAY FORMA DE SABERLO: `consultas` no tenía ninguna columna que
-- apuntara a `appointments` y su única foreign key era `paciente_id`.
--
-- ── POR QUÉ COLUMNA Y NO UN PARÁMETRO DE PASO ───────────────────────────────
-- El identificador de la cita viaja por la URL del enlace y por el cuerpo del
-- POST; eso solo bastaría para marcar el estado. La columna existe por lo que
-- el parámetro NO da:
--   · es TRAZABLE — «¿de qué cita salió esta consulta?» pasa a tener respuesta
--     permanente, no una que existe durante un clic;
--   · habilita la única cuenta que hoy no se puede hacer: cuántas citas
--     agendadas acaban en consulta —ausentismo, conversión de agenda—.
--
-- ── ⚠️ ON DELETE SET NULL, Y NO RESTRICT — JUSTIFICACIÓN OBLIGADA ───────────
-- `CLAUDE.md` fija `ON DELETE RESTRICT` como regla. Esa regla habla de las FK
-- **a `pacientes`**, y su motivo es que un expediente no puede desaparecer
-- porque alguien borre algo colgado de él.
--
-- Aquí la dirección es la contraria y el motivo se invierte:
--
--   · Las citas SÍ SE BORRAN de verdad, desde la papelera del modal de la
--     agenda (`DELETE /api/appointments/[id]`), y eso es una operación normal
--     del día a día, no una excepción.
--   · Una NOTA CLÍNICA no puede desaparecer ni volverse imposible de borrar
--     por eso. Con RESTRICT, borrar una cita atendida quedaría BLOQUEADO para
--     siempre por la consulta que salió de ella — y la consulta es inmutable y
--     no se borra nunca (NOM-004, retención de 5 años), así que ese bloqueo no
--     tendría salida.
--   · Con CASCADE se borraría la consulta, que es exactamente lo que las dos
--     normas prohíben.
--
-- SET NULL es lo único que dice la verdad: el dato clínico sobrevive intacto y
-- lo que se pierde es el VÍNCULO, que es lo que efectivamente dejó de existir.
-- La consulta queda como las anteriores a esta migración: sin saber de qué
-- cita salió.
--
-- ── ⚠️ EFECTO COLATERAL DEL SET NULL: UNA FILA DE audit_log QUE ENGAÑA ──────
-- El `ON DELETE SET NULL` no es una anotación en el catálogo: **ejecuta un
-- UPDATE de verdad** sobre las filas de `consultas` que apuntaran a la cita
-- borrada. Y `public.consultas` tiene el trigger `audit_consultas`
-- (`AFTER INSERT OR DELETE OR UPDATE`, baseline/06_triggers.sql:33-36) que
-- llama a `log_tabla_change` (baseline/05_functions.sql:100-116).
--
-- Consecuencia exacta: **en `audit_log` aparece una fila con
-- `accion = 'UPDATE'`, `tabla = 'consultas'`, el id de la NOTA CLÍNICA, y
-- firmada con el `auth.uid()` de quien borró la CITA.**
--
-- Desde fuera —y `audit_log` se lee justamente desde fuera, en el panel de
-- super-admin y ante una auditoría— **es indistinguible de que alguien editara
-- un expediente**, que es exactamente lo que el sistema promete que no ocurre
-- nunca: las notas clínicas son inmutables y las correcciones van por addendum.
--
-- **NO se desactiva el trigger y NO se toca el audit log.** `CLAUDE.md` lo
-- prohíbe sin matices —«NUNCA quites el audit log de ninguna acción»— y con
-- razón: el registro no miente, dice la verdad literal de que esa fila cambió.
-- Lo que falta es el contexto, y el contexto va aquí.
--
-- **Cómo se distingue una de otra, para quien tenga que hacerlo:** una edición
-- de expediente **no puede existir** —`PUT /api/consultas/[id]` está bloqueado
-- por NOM-004 y no hay ningún camino en la aplicación que actualice una nota—,
-- así que **todo `UPDATE` sobre `consultas` en `audit_log` es este efecto o es
-- un incidente**. Si aparece uno, lo que hay que buscar es el `DELETE` sobre
-- `appointments` del mismo usuario y del mismo instante: si está, es esto.
--
-- Se acepta a cambio de lo que evita: con RESTRICT no se podría borrar nunca
-- una cita atendida, y con CASCADE se borraría la nota.
--
-- ── NO ES UNIQUE, Y ES A PROPÓSITO ──────────────────────────────────────────
-- Dos consultas sobre la misma cita son posibles y no son un error. Un UNIQUE
-- convertiría la segunda en un 23505 a media escritura de una nota clínica.
-- La idempotencia de «marcar atendida» NO sale de aquí: sale del WHERE del
-- UPDATE (`AND status IN ('scheduled','confirmed')`), que sobre una cita ya
-- atendida no casa ninguna fila y no hace nada.
--
-- Un UNIQUE tendría además el problema de la dimensión 10: un índice único
-- global filtra la existencia de filas ajenas por conflicto.
--
-- ── SE ESCRIBE UNA VEZ Y NO SE VUELVE A TOCAR ───────────────────────────────
-- El valor entra en el INSERT de la consulta y nadie lo actualiza después: las
-- notas clínicas son inmutables y `PUT /api/consultas/[id]` está bloqueado por
-- NOM-004. Esta migración NO añade ninguna forma de editarlo.
--
-- ── AISLAMIENTO ENTRE CLÍNICAS (dimensión 10) — HAY UN RESIDUO, Y SE NOMBRA ─
-- La FK comprueba que el uuid EXISTA, no de quién es. Un médico que escribiera
-- por PostgREST podría meter en su propia consulta el id de una cita de otra
-- clínica, si lo adivinara.
--
-- Qué NO puede hacer con eso, que es lo que importa: no lee ni un campo de esa
-- cita —releer su propia fila le devuelve el uuid que él mismo escribió—, y no
-- puede marcarla como atendida, porque ese UPDATE va por el cliente de sesión
-- y `appointments_update` filtra por `clinica_id` y por médico. O sea: no hay
-- lectura cruzada ni escritura cruzada; queda un uuid inerte en una fila suya.
--
-- La barrera real está en la ruta, que exige que la cita sea de la misma
-- clínica Y del mismo paciente que la consulta. Se deja escrito aquí porque un
-- CHECK no puede expresarlo (tendría que consultar otra tabla) y una policy
-- tampoco sin un helper nuevo; convertirlo en trigger sería más maquinaria que
-- riesgo. Si algún día esta columna alimenta un informe que se enseñe, hay que
-- volver a este párrafo.
--
-- ── LA FK ESTRENA SUPERFICIE DE API, Y NO FILTRA (verificado) ───────────────
-- Esto se escribe porque es la alarma que cualquiera levanta al leer lo de
-- arriba, y conviene que no haya que volver a levantarla:
--
-- PostgREST descubre las relaciones por las foreign keys, así que en cuanto
-- ésta exista se podrá **embeber `appointments` desde `consultas`** —y al
-- revés— en una sola petición (`?select=*,appointments(*)`). Es superficie de
-- API nueva que hoy no existe.
--
-- **NO filtra.** El recurso embebido se resuelve **bajo la RLS de su propia
-- tabla**: pedir `consultas?select=*,appointments(*)` devuelve la cita sólo si
-- `appointments_select` se la deja ver a quien pregunta, y si no, ese campo
-- llega en null. La RLS no se salta por venir de un embed. Lo mismo en la
-- dirección contraria con `consultas_select`.
--
-- O sea: cambia CÓMO se puede pedir el dato, no QUIÉN puede verlo.
--
-- El alcance de los roles no cambia en NINGUNA de las dos direcciones
-- (dimensión 15): las cuatro policies de `consultas` no mencionan esta columna
-- y siguen decidiendo por `medico_id` y por la clínica del paciente. Quien
-- podía crear notas sigue pudiendo; quien no, tampoco ahora.
--
-- ── ORDEN DE DESPLIEGUE — ESTE ARCHIVO VA ANTES DEL CÓDIGO ──────────────────
-- Código viejo contra esquema migrado: la columna se queda NULL y no se entera
-- nadie. Código nuevo contra esquema viejo: el INSERT de la consulta revienta
-- por columna inexistente y NO SE PUEDE GUARDAR NINGUNA NOTA CLÍNICA. Este
-- orden es el único aceptable.
--
-- ── PRE-VUELO (correr APARTE, leer el resultado; no forma parte del archivo) ─
--
--   -- ⚠️ NO USAR `information_schema.column_privileges`: EXPANDE los grants de
--   -- TABLA columna por columna y devuelve decenas de filas aunque no exista
--   -- ni un grant de columna. El ACL real vive en `pg_attribute.attacl`, NULL
--   -- cuando el grant viene de la tabla. Comprobado y escrito desde el
--   -- 2026-08-17 en 20260817_gcal_conexion_clinica_a_esquema.sql:92-107.
--   SELECT c.relname, a.attname, a.attacl
--     FROM pg_attribute a
--     JOIN pg_class c     ON c.oid = a.attrelid
--     JOIN pg_namespace n ON n.oid = c.relnamespace
--    WHERE n.nspname = 'public'
--      AND c.relname = 'consultas'
--      AND a.attnum > 0 AND NOT a.attisdropped
--      AND a.attacl IS NOT NULL;
--   -- Se espera VACÍO. Si hay filas, la columna nueva nace invisible.
--
--   SELECT pid, state, age(clock_timestamp(), xact_start) AS edad, query
--     FROM pg_stat_activity
--    WHERE xact_start IS NOT NULL AND state <> 'idle'
--    ORDER BY xact_start;
--
-- ── BLOQUEOS ────────────────────────────────────────────────────────────────
-- La columna es nullable y sin DEFAULT: no reescribe la tabla.
--
-- ⚠️ CORRECCIÓN A LO QUE ESTE MISMO ARCHIVO AFIRMABA: `NOT VALID` **NO evita el
-- lock sobre `appointments`**. El manual de Postgres es incondicional en esto —
-- `ADD FOREIGN KEY` toma `SHARE ROW EXCLUSIVE` sobre la tabla **referenciada**
-- se declare NOT VALID o no, porque ese lock existe para impedir que alguien
-- borre filas referenciadas mientras se establece la relación. Lo que `NOT
-- VALID` evita es **el escaneo de `consultas`**, la referenciante, y sólo eso.
--
-- `SHARE ROW EXCLUSIVE` sobre `appointments` **no bloquea lecturas** pero sí
-- bloquea INSERT, UPDATE y DELETE: mientras dure, no se puede agendar. Por eso
-- importa que dure lo menos posible, y de ahí el orden de abajo.
--
-- ⚠️ EL `CREATE INDEX` VA ANTES DEL `ADD CONSTRAINT`, Y NO ES ESTÉTICA. Si va
-- después, queda **dentro de la ventana del lock**: la transacción sostiene el
-- `SHARE ROW EXCLUSIVE` sobre `appointments` mientras construye un índice sobre
-- `consultas`, una tabla que ese índice ni toca. Hoy son milisegundos; con
-- volumen, es el alta de citas parada durante la construcción de un índice
-- ajeno. Puesto antes, el lock se toma en la última sentencia y se suelta en el
-- COMMIT, que es lo más corto posible.
--
-- El índice se crea SIN CONCURRENTLY a propósito: la tabla es pequeña hoy y
-- CREATE INDEX CONCURRENTLY no puede ir dentro de una transacción, lo que
-- chocaría con el bloque de arriba (dimensión 2 contra dimensión 6). Sobre una
-- base grande habría que sacarlo del BEGIN y ponerle CONCURRENTLY.
--
-- ⚠️ EL ÍNDICE NO ES OPCIONAL, y no es por las consultas de informe: sin él,
-- CADA borrado de una cita obliga a Postgres a barrer `consultas` entera para
-- resolver el ON DELETE SET NULL. Borrar una cita es una acción interactiva.
--
-- El VALIDATE posterior toma SHARE UPDATE EXCLUSIVE en la referenciante y ROW
-- SHARE en la referenciada: deja pasar todo.
--
-- ── DESPUÉS DE APLICAR: LA CACHÉ DE ESQUEMA DE POSTGREST ────────────────────
-- Tras un `ADD COLUMN`, PostgREST puede seguir sirviendo su esquema en caché y
-- responder **PGRST204 «column not found»** a cualquier INSERT que nombre
-- `appointment_id` — o sea, a TODA nota clínica que se guarde — hasta que
-- recargue. Aquí importa más que en la migración 4: lo que se pierde es una
-- nota que el médico acaba de escribir.
--
-- ⚠️ EL SQL EDITOR NO PRUEBA ESTO: sus consultas van directas a Postgres sin
-- pasar por PostgREST, así que el veredicto de abajo puede salir OK con la
-- aplicación rota. Comprobar desde fuera, con la anon key:
--   curl -s "$SUPABASE_URL/rest/v1/consultas?select=id,appointment_id&limit=1" \
--        -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
--   -- 200 (aunque sea `[]` por la RLS) = la caché ya tiene la columna.
--   -- PGRST204 o «column does not exist» = no ha recargado.
-- Si no ha recargado, forzarlo desde el SQL Editor:
--   NOTIFY pgrst, 'reload schema';
--
-- ── REVERSIÓN ───────────────────────────────────────────────────────────────
-- DROP CONSTRAINT + DROP COLUMN. Es destructivo: se pierde el vínculo de las
-- consultas que ya lo tuvieran. Respaldar antes:
--   CREATE TABLE respaldos.consultas_cita_AAAAMMDD AS
--     SELECT id, paciente_id, appointment_id FROM public.consultas
--      WHERE appointment_id IS NOT NULL;
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout      = '5s';
SET LOCAL statement_timeout = '60s';

-- ── PRE-VUELO QUE ABORTA (dimensión 4) ──────────────────────────────────────
DO $$
DECLARE
  v_tipo text;
BEGIN
  -- Mismo razonamiento que en la migración 4: `ADD COLUMN IF NOT EXISTS` es un
  -- no-op silencioso aunque la columna exista con otro tipo, y ahí el replay
  -- deja de ser inofensivo sin decirlo.
  SELECT format_type(a.atttypid, a.atttypmod) INTO v_tipo
    FROM pg_attribute a
   WHERE a.attrelid = 'public.consultas'::regclass
     AND a.attname  = 'appointment_id'
     AND a.attnum > 0 AND NOT a.attisdropped;

  IF v_tipo IS NOT NULL AND v_tipo <> 'uuid' THEN
    RAISE EXCEPTION
      'PRE-VUELO FALLO: consultas.appointment_id ya existe con tipo % en vez de uuid. No es un replay inofensivo. Abortando.',
      v_tipo;
  END IF;

  -- La tabla referenciada tiene que existir.
  IF to_regclass('public.appointments') IS NULL THEN
    RAISE EXCEPTION
      'PRE-VUELO FALLO: no existe public.appointments. El esquema no es el esperado. Abortando.';
  END IF;

  -- Y tener clave primaria sobre `id`, que es lo que la FK va a referenciar.
  -- Esto se comprueba de verdad: antes esta guarda DECÍA comprobarlo y sólo
  -- miraba que la tabla existiera, que es una afirmación distinta y más floja.
  -- Sin PK (o con una PK sobre otra columna) el ADD CONSTRAINT falla con un
  -- mensaje que no señala la causa.
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute  a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
     WHERE c.conrelid = 'public.appointments'::regclass
       AND c.contype  = 'p'
       AND a.attname  = 'id'
       AND array_length(c.conkey, 1) = 1
  ) THEN
    RAISE EXCEPTION
      'PRE-VUELO FALLO: public.appointments no tiene clave primaria simple sobre id. La FK no se puede crear. Abortando.';
  END IF;

  -- ── QUÉ ESTAMOS A PUNTO DE DESTRUIR (dimensión 3, y dimensión 4) ──────────
  -- El `DROP CONSTRAINT IF EXISTS` de abajo tira la FK SIN MIRARLA. Si alguien
  -- la hubiera cambiado —a RESTRICT, a CASCADE, o a apuntar a otra columna—,
  -- reejecutar este archivo la devolvería a SET NULL en silencio. Y aquí eso no
  -- es cosmético: la diferencia entre las tres es si borrar una cita bloquea,
  -- borra una nota clínica, o suelta el vínculo.
  --
  -- ⚠️ COMPARACIÓN EXACTA CONTRA UNA CADENA, NO REGEX. Y el literal SE LEE DE
  -- LA BASE, no se escribe de memoria — el formato de `pg_get_constraintdef`
  -- depende de la versión de Postgres. Tras aplicar por primera vez:
  --
  --   SELECT pg_get_constraintdef(oid) FROM pg_constraint
  --    WHERE conrelid = 'public.consultas'::regclass
  --      AND conname  = 'consultas_appointment_id_fkey';
  --
  -- SI NO CUADRA, LA MIGRACIÓN ABORTA SIEMPRE sin tocar nada. Es el fallo
  -- seguro de una guarda, no un problema de la base; conviene saberlo antes.
  DECLARE
    v_fk text;
    /* ⚠️ ASUMIDO, NO LEÍDO — pero hay una gemela en producción con la que
       cuadrarlo sin crear nada. `consultas_consultorio_id_fkey` es la MISMA
       forma sobre la MISMA tabla (`FOREIGN KEY (…) REFERENCES … ON DELETE SET
       NULL ON UPDATE NO ACTION`, 20260615_consultorios_04_snapshot.sql:75-77),
       así que su salida deparseada da el molde exacto:

         SELECT pg_get_constraintdef(oid) FROM pg_constraint
          WHERE conrelid = 'public.consultas'::regclass
            AND conname  = 'consultas_consultorio_id_fkey';

       Se asume que Postgres omite `ON UPDATE NO ACTION` por ser el valor por
       defecto. Si la gemela lo imprime, hay que añadirlo también aquí.

       ⚠️ EL NOMBRE VA SIN ESQUEMA —`appointments(id)`, no
       `public.appointments(id)`— porque `pg_get_constraintdef` omite el esquema
       cuando está en el `search_path`, y en el SQL Editor `public` lo está. Si
       esta guarda llegara a abortar mostrando `public.appointments(id)` en el
       «Encontrado», la causa NO es la FK: es un `search_path` alterado en esa
       pestaña. Merece la línea porque el mensaje de error se lee como si el
       constraint estuviera mal.

       En la primera pasada esta guarda no se evalúa (la FK no existe y `v_fk`
       sale NULL): un literal equivocado no impide aplicar, rompe el REPLAY. */
    v_esperada text := 'FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL';
  BEGIN
    SELECT regexp_replace(pg_get_constraintdef(oid), ' NOT VALID$', '') INTO v_fk
      FROM pg_constraint
     WHERE conrelid = 'public.consultas'::regclass
       AND conname  = 'consultas_appointment_id_fkey';

    IF v_fk IS NOT NULL AND v_fk IS DISTINCT FROM v_esperada THEN
      RAISE EXCEPTION
        'PRE-VUELO FALLO: consultas_appointment_id_fkey ya existe con una definición que este archivo no reconoce, y el DROP la destruiría en silencio. Encontrado: %. Esperado: %. Abortando.',
        v_fk, v_esperada;
    END IF;
  END;
END $$;

ALTER TABLE public.consultas
  ADD COLUMN IF NOT EXISTS appointment_id uuid;

COMMENT ON COLUMN public.consultas.appointment_id IS
  'La cita de la que salió esta consulta (plan §12.13). NULL = la consulta no vino de ninguna cita agendada, o la cita se borró después. Se escribe una sola vez, en el INSERT; nada la actualiza. ON DELETE SET NULL a propósito: el dato clínico sobrevive al borrado de la cita, sólo se pierde el vínculo.';

-- ⚠️ EL ÍNDICE VA PRIMERO, Y EL ORDEN ES LA PRECAUCIÓN. `ADD FOREIGN KEY` toma
-- SHARE ROW EXCLUSIVE sobre `appointments` —la referenciada— y lo sostiene
-- hasta el COMMIT, con NOT VALID o sin él. Todo lo que se ejecute después queda
-- dentro de esa ventana, y construir aquí un índice sobre `consultas` dejaría
-- el alta de citas parada mientras dura, por un índice que ni toca esa tabla.
-- Puesto antes, el lock se toma en la última sentencia y se suelta enseguida.
--
-- Parcial: la inmensa mayoría de las filas tiene y tendrá NULL aquí (toda
-- consulta que no venga de una cita), y esas no interesan a ninguna de las dos
-- preguntas que el índice sirve.
CREATE INDEX IF NOT EXISTS idx_consultas_appointment_id
  ON public.consultas USING btree (appointment_id)
  WHERE appointment_id IS NOT NULL;

ALTER TABLE public.consultas
  DROP CONSTRAINT IF EXISTS consultas_appointment_id_fkey;
ALTER TABLE public.consultas
  ADD CONSTRAINT consultas_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id)
  ON DELETE SET NULL ON UPDATE NO ACTION
  NOT VALID;

COMMIT;

-- ⚠️ Los `SET LOCAL` murieron en el COMMIT y lo que viene está fuera de la
-- transacción. Sin repetirlos, el VALIDATE espera el lock SIN LÍMITE si lo
-- encuentra ocupado, y el editor parece colgado. Sin LOCAL: ya no hay
-- transacción a la que atarlos.
SET lock_timeout      = '5s';
SET statement_timeout = '60s';

-- Fuera de la transacción. No puede fallar —todas las filas están en NULL y una
-- FK no mira los NULL— pero si fallara, la FK se queda NOT VALID vigilando lo
-- nuevo, que es el estado seguro.
ALTER TABLE public.consultas VALIDATE CONSTRAINT consultas_appointment_id_fkey;

-- ⚠️ Sin LOCAL, los `SET` de arriba se quedan pegados a la CONEXIÓN, y el SQL
-- Editor reparte conexiones de un pool: la siguiente consulta de esa pestaña
-- puede caer en la misma con `statement_timeout = 60s` y morir con 57014, de
-- forma intermitente. Y 60 s es más corto que el valor por defecto, así que
-- esto aprieta el límite en vez de relajarlo — justo cuando lo siguiente puede
-- ser el respaldo `CREATE TABLE respaldos.… AS SELECT …` de la cabecera. Va
-- antes del veredicto, que tarda milisegundos y debe seguir siendo la última
-- sentencia (dimensión 5).
RESET lock_timeout;
RESET statement_timeout;

-- ── VEREDICTO EN LA REJILLA (dimensión 5) ───────────────────────────────────
WITH m AS (
  SELECT
    (SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='consultas'
        AND column_name='appointment_id' AND data_type='uuid'
        AND is_nullable='YES')                                          AS columna_ok,
    (SELECT count(*) FROM pg_constraint
      WHERE conrelid='public.consultas'::regclass
        AND conname='consultas_appointment_id_fkey'
        AND contype='f' AND convalidated)                               AS fk_validada,
    /* confdeltype: 'n' = SET NULL, 'r' = RESTRICT, 'c' = CASCADE, 'a' = NO ACTION.
       ⚠️ EL `::text` NO ES COSMÉTICO — SIN ÉL EL ARCHIVO NO CORRE. `confdeltype`
       es de tipo `"char"` (el de un byte, no `char(n)`), y concatenarlo con un
       literal en el CASE de abajo revienta en el ANÁLISIS de la consulta:
         ERROR 42725: operator is not unique: unknown || "char"
       Hay varios operadores candidatos y Postgres no elige. Se castea AQUÍ, en
       el origen, y no en el punto de uso: así la columna de la rejilla también
       se lee como texto y no queda un segundo sitio donde repetir el cast.
       Ocurrió de verdad en producción el 2026-08-21; ver la cabecera. */
    (SELECT confdeltype::text FROM pg_constraint
      WHERE conrelid='public.consultas'::regclass
        AND conname='consultas_appointment_id_fkey')                    AS accion_al_borrar,
    (SELECT count(*) FROM pg_indexes
      WHERE schemaname='public' AND indexname='idx_consultas_appointment_id') AS indice,
    -- Un UNIQUE aquí sería un defecto, no una mejora: rompería la segunda
    -- consulta sobre la misma cita. Se comprueba que NADIE lo haya añadido.
    (SELECT count(*) FROM pg_index i
       JOIN pg_attribute a
         ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
      WHERE i.indrelid = 'public.consultas'::regclass
        AND i.indisunique
        AND a.attname = 'appointment_id')                               AS unique_indebido,
    /* ⚠️ `pg_attribute.attacl`, NO `information_schema.column_privileges`: esa
       vista EXPANDE los grants de TABLA columna por columna y devuelve decenas
       de filas aunque no exista ni un grant de columna, con lo que esta rama
       del CASE se cumplía SIEMPRE y tapaba las cinco comprobaciones de arriba.
       Escrito desde 20260817_gcal_conexion_clinica_a_esquema.sql:92-107. */
    (SELECT count(*) FROM pg_attribute a
      WHERE a.attrelid = 'public.consultas'::regclass
        AND a.attnum > 0 AND NOT a.attisdropped
        AND a.attacl IS NOT NULL)                                       AS grants_por_columna,
    (SELECT count(*) FROM public.consultas WHERE appointment_id IS NOT NULL) AS consultas_con_cita
)
SELECT m.*,
       CASE
         WHEN m.columna_ok <> 1 THEN
           'REVISAR: consultas.appointment_id no existe como uuid nullable.'
         WHEN m.fk_validada <> 1 THEN
           'REVISAR: la foreign key no existe o quedó NOT VALID.'
         WHEN m.accion_al_borrar <> 'n' THEN
           'REVISAR: la FK NO es ON DELETE SET NULL (confdeltype=' || m.accion_al_borrar || '). Con RESTRICT no se podría borrar una cita atendida NUNCA; con CASCADE se borraría una nota clínica.'
         WHEN m.indice <> 1 THEN
           'REVISAR: falta idx_consultas_appointment_id. Sin él, cada borrado de cita barre consultas entera.'
         WHEN m.unique_indebido > 0 THEN
           'REVISAR: hay un UNIQUE sobre appointment_id. Rompe la segunda consulta de una misma cita; retirarlo.'
         WHEN m.grants_por_columna > 0 THEN
           'REVISAR: hay ' || m.grants_por_columna || ' columna(s) de consultas con ACL propio. La columna nueva puede ser invisible para el cliente.'
         ELSE
           'OK — consultas.appointment_id creada, FK ON DELETE SET NULL validada, índice parcial en su sitio y sin UNIQUE. consultas_con_cita debe ser 0 hasta que suba el código. FALTA COMPROBAR PostgREST desde fuera (ver la cabecera): esta consulta no pasa por ahí.'
       END AS veredicto
  FROM m;
