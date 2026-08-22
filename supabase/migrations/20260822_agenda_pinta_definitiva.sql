-- ESTADO: ESCRITA, NO APLICADA. Angel la ejecuta a mano tras auditarla.
--
-- ✅ LOS CUATRO LITERALES DE LA GUARDA DE REPLAY ESTÁN LEÍDOS DE POSTGRES, no
--    deducidos: verificados byte a byte el 2026-08-22 (114, 132, 147 y 419
--    bytes). Cómo se leyeron y cómo repetirlo, en «LOS LITERALES» más abajo.
-- ✅ EL VEREDICTO ESTÁ PROBADO POR SEPARADO contra producción el 2026-08-22,
--    antes de aplicar nada. Corrió SIN error de tipos —que es lo que mató a la
--    migración 5, y el paso que allí faltó— y devolvió lo esperado del estado
--    de antes de aplicar:
--      columnas_text=2 · columnas_nullables=2 · checks_validados=2
--      faltan_iconos  = los 20 nuevos
--      faltan_colores = magenta, carmin, oliva, bronce, grafito
--                       (indigo no aparece: está en las dos listas)
--      sobran_iconos  = bisturi, personas, candado, avion, libro
--      sobran_colores = ambar, rosa, terracota
--      grants_por_columna=0 · filas_con_pinta=0
--      veredicto = 'REVISAR: el CHECK de icono NO admite estos valores: …'
--    Ese REVISAR era el resultado correcto: describe el estado de ANTES.
--
--    ⚠️ PERO ESA CORRIDA NO CUBRE EL VEREDICTO ENTERO TAL COMO ESTÁ HOY. Después
--    de correrla, la auditoría encontró que `faltan_*` y `sobran_*` son pruebas
--    de PERTENENCIA y no de igualdad, y se añadieron DOS RAMAS al CASE que
--    comparan la definición completa contra los literales exactos. Esas dos
--    ramas son SQL que NO se ha ejecutado nunca. Son de la misma familia que lo
--    ya probado —`regexp_replace` sobre `text`, `IS DISTINCT FROM` contra un
--    literal, `||` sobre `coalesce(text, text)`— y ninguna toca una columna de
--    catálogo de tipo raro, que es lo que mató a la 5. Pero eso es lectura, y
--    la lección de la 5 fue justamente que leer no basta:
--
--       VOLVER A CORRER EL VEREDICTO SUELTO ANTES DE APLICAR.
--
--    Sobre el estado de hoy debe devolver lo mismo de arriba: la rama que gana
--    sigue siendo `faltan_iconos`, porque va antes que las dos nuevas.
-- ============================================================================
-- La pinta definitiva del evento genérico: 20 iconos y 6 colores
--
-- ⚠️⚠️ ESTE ARCHIVO SUSTITUYE A PROPÓSITO LOS DOS CHECK DE LA MIGRACIÓN 4
-- (`20260821_agenda_evento_generico_icono_color.sql`). NO ES UN ACCIDENTE Y NO
-- ES UNA CORRECCIÓN DE AQUÉLLA: aquella migración declara en su propia cabecera
-- que sus valores eran PROVISIONALES a la espera del rediseño del calendario, y
-- el rediseño ya cerró con otras listas. Esto es lo que ella anunció.
--
-- ── CONSECUENCIA PARA QUIEN LEA LA MIGRACIÓN 4 DESPUÉS ──────────────────────
-- Su guarda de replay dejará de reconocer lo que hay en la base y ABORTARÁ con
-- «ya existe con una definición que este archivo no reconoce». **ESO ES LO
-- CORRECTO Y ES SU TRABAJO**: la 4 fue escrita para atrapar exactamente este
-- caso —que alguien reejecute el archivo viejo y devuelva las listas viejas en
-- silencio— y lo está atrapando. La 4 NO se reejecuta nunca más. Si alguien
-- necesita el estado que ella dejaba, es este archivo el que hay que revertir,
-- no aquél el que hay que volver a correr.
--
-- Y por §7 de supabase/AUDITORIA-MIGRACIONES.md la 4 no se toca: sus literales
-- viven dentro de sentencias ya ejecutadas. La constancia de que quedó superada
-- es este bloque.
--
-- ── QUÉ CAMBIA ──────────────────────────────────────────────────────────────
--   appointments_icono_check:  de 5 valores  a 20.
--   appointments_color_check:  de 4 valores  a  6.
--
-- Nada más. Ni una columna se crea, ni una se borra, ni una fila se mueve. Las
-- DOS COLUMNAS SIGUEN NULLABLE (ver abajo por qué, que es una decisión y no un
-- olvido).
--
-- ── POR QUÉ HACE FALTA ──────────────────────────────────────────────────────
-- Los CHECK vigentes admiten cinco iconos y cuatro colores que ya no existen en
-- la interfaz. Un usuario que elija cualquiera de los valores nuevos recibiría
-- un **23514** de la base y no podría guardar el evento. El fallo no es sutil:
-- es «no se pudo guardar» sin más explicación.
--
-- Los archivos SVG de los 20 iconos viven en el repo, en `/public/icons/`,
-- verificado el 2026-08-22: los 20, con el nombre exacto de la lista y sin
-- acentos ni sufijos. **La base sólo guarda el NOMBRE** —el identificador es el
-- nombre del archivo sin `.svg`— y ese nombre tiene que estar en esta lista.
--
-- ── LOS 20 ICONOS ───────────────────────────────────────────────────────────
--   Quirófano y hospital: cirugia · instrumental · urgencias · internamiento ·
--                         ronda
--   Clínica y estudios:   columna · ortopedia · imagen · ultrasonido ·
--                         rehabilitacion · laboratorio · vacuna
--   Agenda no clínica:    junta · videollamada · docencia · congreso · viaje ·
--                         comida · personal · bloqueo
--
-- Se retiran los cinco viejos: bisturi, personas, candado, avion, libro.
--
-- ── LOS 6 COLORES, Y POR QUÉ SON SEIS Y NO SIETE ────────────────────────────
--   indigo #3730a3 · magenta #a21caf · carmin #be185d · oliva #4d7c0f ·
--   bronce #78350f · grafito #1f2937
--
-- Se retiran los cuatro viejos ENTEROS: ambar, rosa, terracota, indigo.
--
--   ⚠️ `indigo` NO SE CONSERVA POR COMPATIBILIDAD, aunque el nombre se repita:
--   su hex cambia (#4338ca → #3730a3). Por eso el constraint entero va por DROP
--   y re-ADD en vez de por un ALTER que añada valores: se regenera limpio y no
--   queda duda de qué tono es. **El HEX NO ENTRA A LA BASE, sólo el
--   identificador** — así, ajustar un tono más adelante es CSS y no migración.
--
--   ⚠️⚠️ `teal` Y `pizarra` SE RETIRARON DE LA PROPUESTA. NO LOS REINTRODUZCAS.
--   La propuesta original traía siete colores e incluía esos dos. Colisionan de
--   frente con colores de ESTADO que ya viven en este mismo calendario:
--     · `teal`    es el color de «atendida»    (#0f766e), estrenado en la
--                 migración 3, un día antes que esto.
--     · `pizarra` es el color de «no asistió»  (#64748b).
--   Y no es una colisión de nombre solamente: medido en hue, `teal` está a CERO
--   grados del teal de «atendida». Sirve de referencia que en la migración 4 se
--   retiró `cian` (#0891b2) por estar a DIECISIETE grados de ese mismo teal —o
--   sea que el criterio ya estaba fijado y `teal` lo incumple por el doble—. La
--   regla es la de siempre: entre un color de estado y uno decorativo, gana el
--   estado. Los de estado no son provisionales; éstos, ahora, tampoco.
--
--   `grafito` #1f2937 es el neutro que `pizarra` iba a cubrir, con un tono y un
--   nombre que no se confunden con «no asistió».
--   `magenta` en vez de `fucsia`: con `carmin` al lado la distinción se lee
--   igual y el nombre es más reconocible. Nota de nomenclatura, para que nadie
--   los «corrija»: `magenta` es el rosa-púrpura y `carmin` el rosa-rojo. Se
--   eligieron distinguibles a propósito, y NO se reusó `rosa`, que ya existía
--   con otro hex.
--
--   Los seis pasan AA con texto blanco (el más apretado es `oliva`, 4.99:1).
--
--   ⚠️ MATIZ SOBRE LA SEPARACIÓN, MEDIDO Y NO SUPUESTO: no todos se separan de
--   los estados por HUE. Medidos contra los estados vigentes, `grafito` está a
--   0.4° del gris de «no asistió», `indigo` a 11.4° del morado de Google,
--   `bronce` a 21.7° del rojo de «cancelada» y `carmin` a 24.9° de ese mismo
--   rojo. Lo que los separa en esos cuatro casos es la CLARIDAD, no el tono:
--   `grafito` está 30 puntos de luminosidad por debajo del gris de «no asistió»
--   (contraste 3.08:1 entre ellos) y `bronce` 25 por debajo del rojo. Quien
--   añada un color mañana tiene que mirar las DOS cosas; comprobar sólo el hue
--   daría por bueno un choque.
--
-- ── POR QUÉ LAS DOS COLUMNAS SIGUEN NULLABLE ────────────────────────────────
-- Decisión de Angel, y el motivo va escrito para que no se «arregle» después:
-- `color` vive en `appointments`, que es la tabla de TODAS las citas. Un NOT
-- NULL con default obligaría a que cada cita de paciente arrastrara
-- `color = 'grafito'`, un dato que no significa nada — las citas se pintan por
-- ESTADO, no por color. Con nullable, NULL significa exactamente lo que ocurre:
-- «esta fila no eligió pinta». Que un evento genérico siempre tenga color lo
-- garantiza el formulario, no el esquema.
--
-- Y por lo mismo NO existe un valor «ninguno» dentro de las listas: NULL ya es
-- eso. La migración 4 retiró `punto` de la propuesta de §12.14 por este motivo
-- y aquí se mantiene retirado.
--
-- ── ORDEN DE DESPLIEGUE — ESTE ARCHIVO VA ANTES DEL CÓDIGO ──────────────────
-- ⚠️ EL ARGUMENTO DE LA MIGRACIÓN 4 NO SIRVE AQUÍ Y HAY QUE REHACERLO. Allí el
-- orden era forzoso porque el código nuevo nombraba columnas que no existían y
-- el INSERT reventaba entero. Aquí las columnas ya existen: lo que cambia es
-- qué valores admiten. Los dos órdenes fallan, y fallan igual:
--
--   · Código nuevo + esquema viejo → el médico elige `cirugia`, **23514**.
--     Mueren los 20 iconos y 5 de los 6 colores.
--   · Esquema nuevo + código viejo → el médico elige `bisturi`, **23514**.
--     Mueren los 5 iconos viejos y 3 de los 4 colores viejos.
--
-- En los dos casos la escritura se RECHAZA: no hay corrupción, no hay pérdida,
-- no queda nada a medias. La ventana hay que hacerla corta en cualquiera de los
-- dos sentidos. Aun así, la migración primero, por tres razones:
--   1. Tras la migración lo único que rompe es elegir uno de los cinco iconos
--      que están a punto de desaparecer del selector. Tras un deploy adelantado
--      rompe TODO lo que el selector nuevo ofrece.
--   2. La migración es un acto manual de segundos, encajable justo antes del
--      deploy. Revertir un deploy es más lento.
--   3. Es la invariante de la serie, y romperla en la 6 obliga a explicar por
--      qué en cada archivo posterior.
--
-- ⚠️ `indigo` ES EL ÚNICO VALOR QUE ATRAVIESA LA VENTANA EN SILENCIO: está en
-- las dos listas, así que código viejo puede guardarlo contra esquema nuevo sin
-- error. Guardará bien y se pintará con el tono NUEVO. Inofensivo, pero conviene
-- saberlo antes de mirar una fila y no entender por qué cambió de color.
--
-- ── AQUÍ **NO** HACE FALTA COMPROBAR POSTGREST (dimensión 12) ───────────────
-- Las migraciones 4 y 5 llevaban una comprobación desde fuera con la anon key
-- porque las dos hacían `ADD COLUMN`, y PostgREST cachea el esquema de COLUMNAS:
-- podía responder PGRST204 a toda alta de cita hasta recargar. **Este archivo no
-- añade ninguna columna.** Sustituye dos CHECK, y PostgREST no cachea
-- constraints: los evalúa Postgres al escribir, en el momento. No hay
-- `NOTIFY pgrst, 'reload schema'` que dar ni curl que correr.
--
-- ── DESPUÉS DE APLICAR: LA COMPROBACIÓN QUE PIDE §7, YA ESCRITA ────────────
-- Queda aquí redactada para que el ritual de §7 se reduzca a correrla y pegar
-- el resultado arriba, en vez de inventarla ese día:
--
--   SELECT conname, convalidated, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = 'public.appointments'::regclass
--      AND conname IN ('appointments_icono_check','appointments_color_check');
--
--   -- Aplicada = DOS filas, las dos con convalidated = t, y las dos
--   -- definiciones iguales a `v_nuevo_icono` y `v_nuevo_color` de la guarda 2.
--   -- Si alguna sale con convalidated = f, el bloque transaccional pasó pero su
--   -- VALIDATE no: ese constraint vigila lo nuevo pero no ha comprobado lo
--   -- viejo. Es el estado seguro, no una emergencia, pero hay que cerrarlo.
--
-- Y el veredicto del final de este archivo sirve igual como comprobación
-- posterior: se puede correr suelto cuando se quiera, es lectura pura.
--
-- ── ⚠️ APUNTE DE OPERACIÓN — SI UN `VALIDATE` TRUENA, LO PRIMERO ES RESETEAR ─
-- No es un defecto de este archivo sino de cómo se ejecuta. Los dos `SET` que
-- hay tras el COMMIT van SIN `LOCAL` porque ya no hay transacción a la que
-- atarlos, y los `RESET` que los deshacen están DESPUÉS de los dos VALIDATE. Si
-- un VALIDATE falla, el error aborta el resto del envío: los `RESET` NO LLEGAN A
-- EJECUTARSE y `lock_timeout` y `statement_timeout = 60s` se quedan pegados a la
-- CONEXIÓN, que el SQL Editor reparte de un pool. La siguiente consulta de esa
-- pestaña puede caer en la misma conexión y morir con 57014 de forma
-- intermitente — y 60 s es MÁS CORTO que el valor por defecto, así que aprieta
-- el límite en vez de relajarlo.
--
--   Si un VALIDATE truena, lo PRIMERO que se pega en esa pestaña, antes de
--   diagnosticar nada, es:
--       RESET lock_timeout; RESET statement_timeout;
--
-- Diagnosticar con los timeouts pegados es cómo un fallo se convierte en dos.
--
-- ── PRE-VUELO (correr APARTE, leer el resultado; no forma parte del archivo) ─
--
--   -- (1) ✅ YA CORRIDA EL 2026-08-22 — de aquí salieron `v_actual_4_icono` y
--   -- `v_actual_4_color`, que coinciden byte a byte con lo escrito en la
--   -- guarda. Queda aquí para repetirla el día que haga falta:
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = 'public.appointments'::regclass
--      AND conname IN ('appointments_icono_check','appointments_color_check');
--
--   -- (2) ✅ YA CORRIDA EL 2026-08-22 — de aquí salieron `v_nuevo_icono` y
--   -- `v_nuevo_color`. Es la forma que este archivo va a DEJAR, leída en seco y
--   -- sin tocar nada real: una tabla temporal deparsea igual que una de verdad
--   -- y el ROLLBACK no deja rastro. El `conname` sale como `_fmt_*` porque la
--   -- tabla es temporal; lo que se compara es el texto DESDE `CHECK `, así que
--   -- el nombre del constraint no interviene:
--   BEGIN;
--   CREATE TEMP TABLE _fmt (
--     icono text CHECK (icono IS NULL OR icono = ANY (ARRAY['cirugia'::text, 'instrumental'::text, 'urgencias'::text, 'internamiento'::text, 'ronda'::text, 'columna'::text, 'ortopedia'::text, 'imagen'::text, 'ultrasonido'::text, 'rehabilitacion'::text, 'laboratorio'::text, 'vacuna'::text, 'junta'::text, 'videollamada'::text, 'docencia'::text, 'congreso'::text, 'viaje'::text, 'comida'::text, 'personal'::text, 'bloqueo'::text])),
--     color text CHECK (color IS NULL OR color = ANY (ARRAY['indigo'::text, 'magenta'::text, 'carmin'::text, 'oliva'::text, 'bronce'::text, 'grafito'::text]))
--   );
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conrelid = '_fmt'::regclass AND contype = 'c';
--   ROLLBACK;
--
--   -- (3) Qué pinta hay guardada hoy. Se espera VACÍO; si devuelve filas con
--   -- valores viejos, la migración ABORTARÁ a propósito (ver la guarda 3).
--   SELECT icono, color, count(*) FROM public.appointments
--    WHERE icono IS NOT NULL OR color IS NOT NULL
--    GROUP BY 1,2 ORDER BY 3 DESC;
--
--   -- (4) Transacciones largas que puedan bloquear el ACCESS EXCLUSIVE:
--   SELECT pid, state, age(clock_timestamp(), xact_start) AS edad, query
--     FROM pg_stat_activity
--    WHERE xact_start IS NOT NULL AND state <> 'idle'
--    ORDER BY xact_start;
--
-- ── BLOQUEOS Y COSTE ────────────────────────────────────────────────────────
-- `DROP CONSTRAINT` y `ADD CONSTRAINT … NOT VALID` toman ACCESS EXCLUSIVE sobre
-- appointments, pero NO leen la tabla: es catálogo. Duran lo que tarde eso,
-- incluso con millones de filas. Los VALIDATE van fuera de la transacción, con
-- SHARE UPDATE EXCLUSIVE, y ésos SÍ recorren la tabla — pero sin bloquear ni
-- lecturas ni escrituras.
--
-- ⚠️ EL VALIDATE AQUÍ SÍ PUEDE FALLAR, a diferencia de la migración 4. Allí
-- todas las filas estaban en NULL y el CHECK admitía NULL. Aquí, si existiera
-- una fila con pinta vieja, el VALIDATE la encontraría. Por eso la guarda 3 de
-- más abajo aborta ANTES de tocar nada (dimensión 4: la comprobación cuyo fallo
-- hace peligroso continuar va primero). Si aun así fallara, ese constraint se
-- queda NOT VALID vigilando lo NUEVO, que es el estado seguro.
--
-- ── AISLAMIENTO ENTRE CLÍNICAS (dimensión 10) ───────────────────────────────
-- No crea ni un objeto nuevo alcanzable por PostgREST. Son dos CHECK sobre dos
-- columnas de una tabla que ya tiene RLS y cuyas policies filtran por
-- `clinica_id`; los CHECK no leen otras filas, no consultan otras tablas y no
-- pueden usarse para sondear la existencia de nada ajeno. Un 23514 dice
-- «este valor no está permitido», no dice nada de otra clínica. El alcance de
-- los roles no cambia en ninguna de las dos direcciones (dimensión 15): quien
-- podía editar una cita sigue pudiendo, y quien no, tampoco puede ahora.
--
-- ── REVERSIÓN ───────────────────────────────────────────────────────────────
-- NO se revierte reejecutando la migración 4 —su guarda abortará, y con razón—.
-- Se revierte con un archivo nuevo que haga el DROP y el re-ADD en sentido
-- contrario, y ANTES hay que resolver qué pasa con las filas que ya usen un
-- valor nuevo: el CHECK viejo las rechazaría y el VALIDATE fallaría. Respaldar
-- primero, siempre:
--   CREATE TABLE respaldos.appointments_pinta_AAAAMMDD AS
--     SELECT id, clinica_id, icono, color FROM public.appointments
--      WHERE icono IS NOT NULL OR color IS NOT NULL;
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout      = '5s';
SET LOCAL statement_timeout = '60s';

-- ── GUARDA 1 — LAS DOS COLUMNAS EXISTEN Y SON text ──────────────────────────
-- Este archivo presupone la migración 4 aplicada. Si las columnas no están, o
-- están con otro tipo, no hay nada que restringir y el `ADD CONSTRAINT` fallaría
-- después con un error que no dice nada de la causa.
DO $$
DECLARE
  v_cuantas int;
BEGIN
  SELECT count(*) INTO v_cuantas
    FROM pg_attribute a
   WHERE a.attrelid = 'public.appointments'::regclass
     AND a.attname IN ('icono','color')
     AND a.attnum > 0 AND NOT a.attisdropped
     AND format_type(a.atttypid, a.atttypmod) = 'text';

  IF v_cuantas <> 2 THEN
    RAISE EXCEPTION
      'PRE-VUELO FALLO: se esperaban DOS columnas text (icono, color) en public.appointments y se encontraron %. ¿Se aplicó la migración 4 (20260821_agenda_evento_generico_icono_color.sql)? Abortando.',
      v_cuantas;
  END IF;
END $$;

-- ── GUARDA 2 — REPLAY: SÓLO DOS DEFINICIONES SON ACEPTABLES ─────────────────
-- Los `DROP CONSTRAINT` de abajo tiran definiciones SIN MIRARLAS y las
-- sustituyen por literales escritos aquí. Esta guarda acepta exactamente dos
-- estados por constraint, y aborta con cualquier otro:
--
--   (a) la definición EXACTA que dejó la migración 4  → primera pasada, correcto
--   (b) la definición EXACTA que deja este archivo    → replay inofensivo
--
-- Y **la ausencia del constraint TAMBIÉN aborta**, que es una diferencia
-- deliberada con la migración 4. Allí «ausente» significaba «aún sin aplicar» y
-- era el caso normal. Aquí la migración 4 ya lo creó: si no está, es que alguien
-- lo tiró a mano, o sea que la barrera lleva quién sabe cuánto abierta y puede
-- haber filas con cualquier cosa. Eso no se arregla en silencio con un ADD; se
-- mira primero.
--
-- ⚠️ COMPARACIÓN EXACTA, NO REGEX. Una regex que «busque cirugia» daría por
-- buena una lista ampliada con un icono de más, que es justo lo que hay que
-- atrapar.
--
-- ── LOS LITERALES: LOS CUATRO LEÍDOS DE POSTGRES, NINGUNO DEDUCIDO ─────────
-- ✅ VERIFICADOS BYTE A BYTE EL 2026-08-22. No están razonados a partir de cómo
-- deparsea Postgres un `BoolExpr`, que es como se escribieron los de la
-- migración 4 y como la migración 3 se equivocó de nivel de paréntesis en su
-- primer intento. Salieron de la base, y así se repite:
--
--   · `v_actual_4_icono` (132 bytes) y `v_actual_4_color` (114 bytes) →
--     CONSULTA DIRECTA a `pg_constraint` sobre `public.appointments`, paso (1)
--     del pre-vuelo. Son los constraints que están vivos ahora mismo.
--   · `v_nuevo_icono` (419 bytes) y `v_nuevo_color` (147 bytes) →
--     TEMP TABLE con los dos CHECK, `pg_get_constraintdef`, ROLLBACK; paso (2)
--     del pre-vuelo. No existían en ninguna base y no había de dónde leerlos
--     directamente: la tabla temporal los deparsea igual que una de verdad y el
--     ROLLBACK no deja rastro. El `conname` salía como `_fmt_*`, que es
--     irrelevante — lo que se compara es el texto desde `CHECK `.
--
-- O sea que las dos ramas de la guarda están probadas: la (a) contra lo que hay
-- y la (b) contra lo que este archivo va a dejar. Un replay ya no puede romperse
-- por un paréntesis mal contado.
DO $$
DECLARE
  v_actual text;
  v_actual_4_icono text := 'CHECK (((icono IS NULL) OR (icono = ANY (ARRAY[''bisturi''::text, ''personas''::text, ''candado''::text, ''avion''::text, ''libro''::text]))))';
  v_actual_4_color text := 'CHECK (((color IS NULL) OR (color = ANY (ARRAY[''ambar''::text, ''rosa''::text, ''terracota''::text, ''indigo''::text]))))';
  v_nuevo_icono    text := 'CHECK (((icono IS NULL) OR (icono = ANY (ARRAY[''cirugia''::text, ''instrumental''::text, ''urgencias''::text, ''internamiento''::text, ''ronda''::text, ''columna''::text, ''ortopedia''::text, ''imagen''::text, ''ultrasonido''::text, ''rehabilitacion''::text, ''laboratorio''::text, ''vacuna''::text, ''junta''::text, ''videollamada''::text, ''docencia''::text, ''congreso''::text, ''viaje''::text, ''comida''::text, ''personal''::text, ''bloqueo''::text]))))';
  v_nuevo_color    text := 'CHECK (((color IS NULL) OR (color = ANY (ARRAY[''indigo''::text, ''magenta''::text, ''carmin''::text, ''oliva''::text, ''bronce''::text, ''grafito''::text]))))';
BEGIN
  -- El sufijo ` NOT VALID` se normaliza: un intento anterior que muriera entre
  -- el COMMIT y el VALIDATE deja el constraint creado y NOT VALID, y ese estado
  -- es un replay legítimo. Lección de la migración 5, que murió justo ahí.
  SELECT regexp_replace(pg_get_constraintdef(oid), ' NOT VALID$', '') INTO v_actual
    FROM pg_constraint
   WHERE conrelid = 'public.appointments'::regclass
     AND conname  = 'appointments_icono_check';

  IF v_actual IS NULL THEN
    RAISE EXCEPTION
      'PRE-VUELO FALLO: appointments_icono_check NO EXISTE. La migración 4 lo creó, así que alguien lo tiró a mano y la lista cerrada lleva un tiempo indeterminado sin vigilar. Mirar qué hay en la columna antes de recrearlo. Abortando.';
  END IF;
  IF v_actual IS DISTINCT FROM v_actual_4_icono AND v_actual IS DISTINCT FROM v_nuevo_icono THEN
    RAISE EXCEPTION
      'PRE-VUELO FALLO: appointments_icono_check tiene una definición que este archivo no reconoce, y el DROP la destruiría en silencio. Encontrado: %. Se esperaba la de la migración 4 (%) o la de este archivo (%). Abortando.',
      v_actual, v_actual_4_icono, v_nuevo_icono;
  END IF;

  SELECT regexp_replace(pg_get_constraintdef(oid), ' NOT VALID$', '') INTO v_actual
    FROM pg_constraint
   WHERE conrelid = 'public.appointments'::regclass
     AND conname  = 'appointments_color_check';

  IF v_actual IS NULL THEN
    RAISE EXCEPTION
      'PRE-VUELO FALLO: appointments_color_check NO EXISTE. La migración 4 lo creó, así que alguien lo tiró a mano y la lista cerrada lleva un tiempo indeterminado sin vigilar. Mirar qué hay en la columna antes de recrearlo. Abortando.';
  END IF;
  IF v_actual IS DISTINCT FROM v_actual_4_color AND v_actual IS DISTINCT FROM v_nuevo_color THEN
    RAISE EXCEPTION
      'PRE-VUELO FALLO: appointments_color_check tiene una definición que este archivo no reconoce, y el DROP la destruiría en silencio. Encontrado: %. Se esperaba la de la migración 4 (%) o la de este archivo (%). Abortando.',
      v_actual, v_actual_4_color, v_nuevo_color;
  END IF;
END $$;

-- ── GUARDA 3 — FILAS CON PINTA QUE LA LISTA NUEVA NO ADMITE ─────────────────
-- ⚠️ ESTA MIGRACIÓN NO ADIVINA MAPEOS Y NO ACTUALIZA NI UNA FILA. Es deliberado.
--
-- El 2026-08-21, al aplicar la migración 4, `filas_con_pinta = 0` verificado —el
-- código de eventos genéricos aún no había subido—. Pero este archivo se aplica
-- OTRO DÍA, y entre medias puede haber salido el código viejo a producción.
--
-- Si aparecieran filas, existe una correspondencia evidente para tres de los
-- cinco iconos (`bisturi` → `cirugia`, `avion` → `viaje`, `candado` →
-- `bloqueo`) y NINGUNA para `personas` ni `libro`, ni para los colores `ambar`,
-- `rosa` y `terracota`. Un UPDATE que arreglara los tres fáciles y dejara los
-- otros para el VALIDATE sería lo peor de las dos opciones: toca datos de un
-- usuario sin que nadie lo haya decidido Y aun así falla después. Así que esto
-- ABORTA listando qué hay, y la decisión la toma una persona con la lista
-- delante.
--
-- Va ANTES del DROP a propósito (dimensión 4): abortar aquí no deja nada a
-- medias, porque todavía no se ha tocado nada.
DO $$
DECLARE
  v_detalle text;
  v_total   bigint;
BEGIN
  SELECT count(*), string_agg(t.linea, '; ' ORDER BY t.linea)
    INTO v_total, v_detalle
    FROM (
      SELECT coalesce(a.icono, '∅') || '/' || coalesce(a.color, '∅') || ' ×' || count(*)::text AS linea
        FROM public.appointments a
       WHERE (a.icono IS NOT NULL AND a.icono <> ALL (ARRAY['cirugia'::text, 'instrumental'::text, 'urgencias'::text, 'internamiento'::text, 'ronda'::text, 'columna'::text, 'ortopedia'::text, 'imagen'::text, 'ultrasonido'::text, 'rehabilitacion'::text, 'laboratorio'::text, 'vacuna'::text, 'junta'::text, 'videollamada'::text, 'docencia'::text, 'congreso'::text, 'viaje'::text, 'comida'::text, 'personal'::text, 'bloqueo'::text]))
          OR (a.color IS NOT NULL AND a.color <> ALL (ARRAY['indigo'::text, 'magenta'::text, 'carmin'::text, 'oliva'::text, 'bronce'::text, 'grafito'::text]))
       GROUP BY a.icono, a.color
    ) t;

  IF coalesce(v_total, 0) > 0 THEN
    RAISE EXCEPTION
      'PRE-VUELO FALLO: hay % combinación(es) de pinta que la lista NUEVA no admite, y el VALIDATE fallaría con ellas. Esta migración NO adivina mapeos. Combinaciones (icono/color ×filas, ∅ = NULL): %. Decidir a mano qué hacer con cada una —hay correspondencia evidente para bisturi→cirugia, avion→viaje, candado→bloqueo, y NINGUNA para personas, libro, ambar, rosa ni terracota— y volver a correr. Abortando.',
      v_total, v_detalle;
  END IF;
END $$;

-- ── LOS DOS CHECK ───────────────────────────────────────────────────────────
-- DROP + re-ADD del constraint entero, no un ALTER que añada valores: `indigo`
-- se repite de nombre pero cambia de tono, y regenerar limpio es lo que impide
-- que quede duda de qué lista está vigente.
--
-- NOT VALID + VALIDATE aparte por el motivo de siempre: el ADD con validación
-- inmediata recorrería la tabla entera bajo ACCESS EXCLUSIVE.
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_icono_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_icono_check
  CHECK (icono IS NULL OR icono = ANY (ARRAY['cirugia'::text, 'instrumental'::text, 'urgencias'::text, 'internamiento'::text, 'ronda'::text, 'columna'::text, 'ortopedia'::text, 'imagen'::text, 'ultrasonido'::text, 'rehabilitacion'::text, 'laboratorio'::text, 'vacuna'::text, 'junta'::text, 'videollamada'::text, 'docencia'::text, 'congreso'::text, 'viaje'::text, 'comida'::text, 'personal'::text, 'bloqueo'::text]))
  NOT VALID;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_color_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_color_check
  CHECK (color IS NULL OR color = ANY (ARRAY['indigo'::text, 'magenta'::text, 'carmin'::text, 'oliva'::text, 'bronce'::text, 'grafito'::text]))
  NOT VALID;

-- Los COMMENT se reescriben porque los de la migración 4 anunciaban listas
-- provisionales y ya no lo son. El comentario de una columna es lo que lee
-- quien inspecciona el esquema sin abrir el repo.
COMMENT ON COLUMN public.appointments.icono IS
  'Icono del evento genérico sin paciente. Lista cerrada de 20 valores por CHECK; el identificador es el nombre del archivo de /public/icons/ sin .svg. NULL = sin icono; no existe un valor "ninguno".';
COMMENT ON COLUMN public.appointments.color IS
  'Color del evento genérico sin paciente. Lista cerrada de 6 valores por CHECK; el hex vive en globals.css (--ag-evento-*), no aquí. Ningún valor puede colisionar con los colores de ESTADO de cita ni con el morado de Google: por eso se retiraron teal (es el de "atendida") y pizarra (el de "no asistió"). NULL = sin color, y entonces la cita se pinta por su estado.';

COMMIT;

-- ⚠️ Los `SET LOCAL` murieron en el COMMIT y lo que viene está fuera de la
-- transacción. Sin repetirlos, un VALIDATE que encuentre el lock ocupado —un
-- autovacuum, por ejemplo— espera SIN LÍMITE y el editor parece colgado. Van
-- sin LOCAL porque ya no hay transacción a la que atarlos.
SET lock_timeout      = '5s';
SET statement_timeout = '60s';

-- Fuera de la transacción: SHARE UPDATE EXCLUSIVE, no bloquea lecturas ni
-- escrituras. La guarda 3 ya garantizó que no hay filas que puedan fallar; si
-- aun así fallara alguno, ese constraint se queda NOT VALID vigilando lo nuevo,
-- que es el estado seguro.
ALTER TABLE public.appointments VALIDATE CONSTRAINT appointments_icono_check;
ALTER TABLE public.appointments VALIDATE CONSTRAINT appointments_color_check;

-- ⚠️ Sin LOCAL, los `SET` de arriba se quedan pegados a la CONEXIÓN, y el SQL
-- Editor reparte conexiones de un pool: la siguiente consulta de esa pestaña
-- puede caer en la misma con `statement_timeout = 60s` y morir con 57014, de
-- forma intermitente. Y 60 s es más corto que el valor por defecto, así que esto
-- aprieta el límite en vez de relajarlo. Va antes del veredicto, que tarda
-- milisegundos y debe seguir siendo la última sentencia (dimensión 5).
RESET lock_timeout;
RESET statement_timeout;

-- ── VEREDICTO EN LA REJILLA (dimensión 5) ───────────────────────────────────
-- ⚠️ TODA CONCATENACIÓN VA SOBRE text, CON `::text` EXPLÍCITO EN LOS CONTADORES.
-- La migración 5 murió aquí mismo, con la transacción ya confirmada, por un
-- `||` contra una columna de catálogo de tipo `"char"`:
--   ERROR 42725: operator is not unique: unknown || "char"
-- Es un fallo de ANÁLISIS: la consulta entera se rechaza antes de evaluar
-- ninguna rama, así que un veredicto que no se haya corrido no está probado.
-- Este archivo no toca ninguna columna de catálogo rara —`pg_get_constraintdef`
-- devuelve `text` y los contadores van con `::text` explícito— pero el paso que
-- faltó en la 5 fue PROBARLA, no razonarla.
--
-- ⚠️ CORRERLA SOLA ANTES QUE EL ARCHIVO ENTERO. Es lectura pura: no abre
-- transacción, no toma más lock que un SELECT y no cambia nada, así que se puede
-- correr sobre el estado de hoy sin consecuencias. Sobre ese estado —los CHECK
-- todavía con la lista vieja— debe devolver `faltan_iconos` con los 20 valores
-- nuevos, `sobran_iconos` con los cinco viejos y un veredicto que empieza por
-- REVISAR. Ese resultado no es un problema: es la prueba de que la consulta
-- corre y de que detecta lo que tiene que detectar.
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
       lista completa. No basta con mirar que la definición exista: si al editar
       el ARRAY se cayera un valor y ninguna fila lo usara, el VALIDATE pasaría
       y esto diría OK; el fallo aparecería el primer día que alguien eligiera
       ese icono. Se compara contra el literal ENTRECOMILLADO (%'valor'%) para
       que un nombre que sea subcadena de otro no dé un falso positivo. */
    (SELECT coalesce(string_agg(v, ', '), '')
       FROM unnest(ARRAY['cirugia','instrumental','urgencias','internamiento','ronda','columna','ortopedia','imagen','ultrasonido','rehabilitacion','laboratorio','vacuna','junta','videollamada','docencia','congreso','viaje','comida','personal','bloqueo']) AS v
      WHERE coalesce((SELECT pg_get_constraintdef(oid) FROM pg_constraint
                       WHERE conrelid='public.appointments'::regclass
                         AND conname='appointments_icono_check'), '') NOT LIKE '%''' || v || '''%') AS faltan_iconos,
    (SELECT coalesce(string_agg(v, ', '), '')
       FROM unnest(ARRAY['indigo','magenta','carmin','oliva','bronce','grafito']) AS v
      WHERE coalesce((SELECT pg_get_constraintdef(oid) FROM pg_constraint
                       WHERE conrelid='public.appointments'::regclass
                         AND conname='appointments_color_check'), '') NOT LIKE '%''' || v || '''%') AS faltan_colores,
    /* Y los que NO deben estar: los cinco iconos y los tres colores retirados,
       más `teal` y `pizarra`, que nunca llegaron a entrar y no deben entrar. Si
       alguno aparece, es que se reejecutó la migración 4 o que alguien amplió
       la lista sin leer la cabecera de este archivo. */
    (SELECT coalesce(string_agg(v, ', '), '')
       FROM unnest(ARRAY['bisturi','personas','candado','avion','libro','punto']) AS v
      WHERE coalesce((SELECT pg_get_constraintdef(oid) FROM pg_constraint
                       WHERE conrelid='public.appointments'::regclass
                         AND conname='appointments_icono_check'), '') LIKE '%''' || v || '''%') AS sobran_iconos,
    (SELECT coalesce(string_agg(v, ', '), '')
       FROM unnest(ARRAY['ambar','rosa','terracota','cian','teal','pizarra','fucsia']) AS v
      WHERE coalesce((SELECT pg_get_constraintdef(oid) FROM pg_constraint
                       WHERE conrelid='public.appointments'::regclass
                         AND conname='appointments_color_check'), '') LIKE '%''' || v || '''%') AS sobran_colores,
    /* Grants a nivel de COLUMNA. Aquí NO pueden haber cambiado —este archivo no
       crea columnas— pero se mira igual: si los hubiera, la agenda pediría las
       columnas por PostgREST y no llegarían, sin error claro.
       ⚠️ `pg_attribute.attacl` y NO `information_schema.column_privileges`: esa
       vista EXPANDE los grants de TABLA columna por columna y devuelve un
       centenar de filas sobre appointments aunque no exista ni un grant de
       columna, con lo que esta rama se cumpliría SIEMPRE y taparía a las de
       arriba. Comprobado y escrito desde el 2026-08-17 en
       20260817_gcal_conexion_clinica_a_esquema.sql:92-107. */
    (SELECT count(*) FROM pg_attribute a
      WHERE a.attrelid = 'public.appointments'::regclass
        AND a.attnum > 0 AND NOT a.attisdropped
        AND a.attacl IS NOT NULL)                                       AS grants_por_columna,
    /* Informativo, NO es una condición de fallo. Si el código nuevo ya subió,
       esto es > 0 y está bien. Lo que garantiza que ninguna sea inválida es el
       CHECK validado de arriba, no este número. */
    (SELECT count(*) FROM public.appointments
      WHERE icono IS NOT NULL OR color IS NOT NULL)                     AS filas_con_pinta
)
SELECT m.*,
       CASE
         WHEN m.columnas_text <> 2 THEN
           'REVISAR: no hay dos columnas text llamadas icono y color. Este archivo presupone la migración 4 aplicada.'
         WHEN m.columnas_nullables <> 2 THEN
           'REVISAR: alguna de las dos dejó de ser nullable. Tienen que seguir siéndolo: una cita de paciente no lleva ninguna.'
         WHEN m.checks_validados <> 2 THEN
           'REVISAR: falta algún CHECK o quedó NOT VALID. Correr los dos VALIDATE a mano y mirar por qué falló.'
         WHEN m.faltan_iconos <> '' THEN
           'REVISAR: el CHECK de icono NO admite estos valores: ' || m.faltan_iconos || '. La base los rechazará cuando alguien los elija.'
         WHEN m.faltan_colores <> '' THEN
           'REVISAR: el CHECK de color NO admite estos valores: ' || m.faltan_colores || '. La base los rechazará cuando alguien los elija.'
         WHEN m.sobran_iconos <> '' THEN
           'REVISAR: el CHECK de icono TODAVÍA admite valores retirados: ' || m.sobran_iconos || '. ¿Se reejecutó la migración 4?'
         WHEN m.sobran_colores <> '' THEN
           'REVISAR: el CHECK de color TODAVÍA admite valores retirados: ' || m.sobran_colores || '. Ojo con teal y pizarra: se retiraron porque son los colores de "atendida" y "no asistió". No reintroducirlos.'
         /* ⚠️ LAS DOS RAMAS DE ARRIBA SON PRUEBAS DE PERTENENCIA, NO DE
            IGUALDAD: `faltan_*` comprueba que los valores buenos ESTÉN y
            `sobran_*` que unos concretos NO estén, pero ninguna de las dos ve
            un valor de más que nadie haya pensado en nombrar. Un `DROP` + `ADD`
            hecho a mano meses después con los 20 buenos MÁS un 'temporal'
            pasaría las dos y este veredicto diría OK con la lista abierta.
            Ese criterio es MÁS FLOJO que el de la guarda de replay de este mismo
            archivo, que ya avisa de que «una regex que busque cirugia daría por
            buena una lista ampliada, que es justo lo que hay que atrapar».
            Aquí no muerde el día que se aplica —la definición se escribe dos
            sentencias antes de leerla— sino cuando este veredicto se use como
            comprobación de salud POSTERIOR, que es justo para lo que §7 pide
            dejarlo escrito.
            Los dos literales son los mismos de la guarda 2, leídos de Postgres
            el 2026-08-22. El `regexp_replace` normaliza el sufijo ` NOT VALID`
            exactamente igual que allí: un constraint recién creado y aún sin
            validar es la misma definición. Van DESPUÉS de `sobran_*` para que
            los mensajes específicos sigan ganando cuando apliquen, y ésta
            recoja todo lo demás. */
         WHEN regexp_replace(m.def_icono, ' NOT VALID$', '') IS DISTINCT FROM
              'CHECK (((icono IS NULL) OR (icono = ANY (ARRAY[''cirugia''::text, ''instrumental''::text, ''urgencias''::text, ''internamiento''::text, ''ronda''::text, ''columna''::text, ''ortopedia''::text, ''imagen''::text, ''ultrasonido''::text, ''rehabilitacion''::text, ''laboratorio''::text, ''vacuna''::text, ''junta''::text, ''videollamada''::text, ''docencia''::text, ''congreso''::text, ''viaje''::text, ''comida''::text, ''personal''::text, ''bloqueo''::text]))))' THEN
           'REVISAR: el CHECK de icono existe pero NO es la definición exacta de esta migración, así que puede admitir valores DE MÁS que las comprobaciones de arriba no cazan. Encontrado: ' || coalesce(m.def_icono, '(ninguna)') || '.'
         WHEN regexp_replace(m.def_color, ' NOT VALID$', '') IS DISTINCT FROM
              'CHECK (((color IS NULL) OR (color = ANY (ARRAY[''indigo''::text, ''magenta''::text, ''carmin''::text, ''oliva''::text, ''bronce''::text, ''grafito''::text]))))' THEN
           'REVISAR: el CHECK de color existe pero NO es la definición exacta de esta migración, así que puede admitir valores DE MÁS que las comprobaciones de arriba no cazan. Encontrado: ' || coalesce(m.def_color, '(ninguna)') || '.'
         WHEN m.grants_por_columna > 0 THEN
           'REVISAR: hay ' || m.grants_por_columna::text || ' columna(s) de appointments con ACL propio. Las columnas pueden ser invisibles para el cliente; conceder a mano.'
         ELSE
           'OK — appointments.icono (20 valores) y appointments.color (6 valores), las dos nullables, con su CHECK validado y con la definición EXACTA de esta migración: ni un valor de menos ni uno de más. filas_con_pinta es informativo: 0 si el código nuevo aún no ha subido, >0 si ya subió, y las dos cosas están bien. NO hace falta comprobar PostgREST: este archivo no añade columnas y PostgREST no cachea constraints.'
       END AS veredicto
  FROM m;
