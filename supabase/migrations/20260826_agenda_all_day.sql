-- ESTADO: PENDIENTE DE APLICAR.
-- ============================================================================
-- ⚠️ AL APLICAR: sustituir esta línea por «APLICADA Y VERIFICADA EN PRODUCCIÓN
-- EL <fecha>», pegar aquí el veredicto que devolvió la rejilla, y commitear.
-- Es el §7 de supabase/AUDITORIA-MIGRACIONES.md, y es el paso que más se
-- olvida: ver DEUDA_TECNICA.md:2940 y el precedente de
-- 20260818_gcal_puente_secretos.sql, que declaró «PENDIENTE» con sus tres
-- funciones ya vivas en producción.
--
-- La comprobación que respaldará ese rótulo, escrita ya para no inventarla ese
-- día:
--
--   SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS tipo,
--          a.attnotnull, pg_get_expr(d.adbin, d.adrelid) AS defecto
--     FROM pg_attribute a
--     LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
--    WHERE a.attrelid = 'public.appointments'::regclass
--      AND a.attname  = 'all_day'
--      AND a.attnum > 0 AND NOT a.attisdropped;
--   -- Aplicada = una fila: boolean, attnotnull = t, defecto = false.
--
-- Y desde FUERA del SQL Editor, que es donde el veredicto de abajo no llega
-- (precedente: 20260821_agenda_evento_generico_icono_color.sql:13-19):
--
--   GET /rest/v1/appointments?select=id,all_day   →  200, sin PGRST204
--
-- Si diera PGRST204, la caché de esquema de PostgREST no se enteró:
--   NOTIFY pgrst, 'reload schema';
--
-- REVERSIÓN, por simetría con las cuatro migraciones anteriores de la serie:
--   ALTER TABLE public.appointments DROP COLUMN IF EXISTS all_day;
-- Destructiva sólo para esta columna: se pierde qué citas eran de todo el día,
-- y sus start_time/end_time quedan como instantes de medianoche sin bandera
-- que los explique. Respaldar antes si ya hay filas con all_day = true:
--   CREATE TABLE respaldos.appointments_all_day_AAAAMMDD AS
--     SELECT id, start_time, end_time, consultorio_timezone
--       FROM public.appointments WHERE all_day;
-- ============================================================================
-- ⚠️ DE LA PRIMERA SENTENCIA HACIA ABAJO NO SE TOCA NADA (§7 de
-- supabase/AUDITORIA-MIGRACIONES.md). Este bloque de comentarios es la única
-- región editable, y sólo para anotar.
-- ============================================================================
-- Citas de todo el día: appointments.all_day
--
-- ── QUÉ CAMBIA ──────────────────────────────────────────────────────────────
--   appointments.all_day  boolean NOT NULL DEFAULT false.
--
-- Nada más. Ni una fila se mueve, ni un índice, ni una policy, ni un trigger
-- —esta tabla no tiene ninguno—. No se toca `start_time` ni `end_time`.
--
-- ── POR QUÉ ─────────────────────────────────────────────────────────────────
-- La agenda va a encender la fila de todo el día de FullCalendar (`allDaySlot`)
-- y el modal de alta gana un interruptor de «Todo el día», para bloqueos largos
-- y eventos de varios días —las vacaciones del médico—.
--
-- Hoy eso NO SE PUEDE EXPRESAR. `start_time` y `end_time` son timestamptz NOT
-- NULL y no hay bandera: una cita «de todo el día» se guardaría como una cita
-- con hora de 00:00 a 23:59, se pintaría EN LA REJILLA ocupando el día entero
-- en vez de en su banda, y abriría la ventana vertical de la rejilla a las 24
-- horas para toda la semana (ver `tramoDeEvento` en
-- src/lib/agenda/ventanaRejilla.ts).
--
-- ── POR QUÉ UNA BANDERA Y NO COLUMNAS `date` ────────────────────────────────
-- La alternativa era `all_day_start date` / `all_day_end date`, que es más
-- honesta —un evento de todo el día es un rango de FECHAS, no de instantes— y
-- se descartó por coste: obliga a que TODO lector de citas mire dos pares de
-- columnas según la bandera, y hay catorce archivos que leen `appointments`.
-- La bandera reusa las columnas que ya existen.
--
-- ⚠️ EL PRECIO DE ESA DECISIÓN, DICHO AQUÍ PARA QUE NO SE DESCUBRA DESPUÉS: un
-- `timestamptz` es un INSTANTE, no una fecha, así que «el 19 de agosto entero»
-- se guarda como «desde el instante que es medianoche del 19 EN ALGUNA ZONA».
-- Esa zona es la del consultorio de la cita (`consultorio_timezone`, columna
-- que esta tabla ya tiene).
--
-- ⚠️⚠️ Y AQUÍ VA LA PARTE QUE NO SE PUEDE DEJAR PARA DESPUÉS, PORQUE EL
-- PRODUCTO LEE EN LA ZONA CONTRARIA. La regla escrita de este código es que las
-- horas de las citas se pintan EN EL HUSO DEL DISPOSITIVO de quien mira
-- —src/lib/dates.ts:21-46 y dashboard/utils.ts:18-24, que llegó a existir
-- porque una médica en Sonora veía sus citas una hora tarde—. La agenda hace
-- lo mismo: `agenda/page.tsx:2850` le pasa a FullCalendar el INSTANTE, y
-- FullCalendar hace `startOfDay` con el reloj del navegador.
--
-- Consecuencia REAL, no futura: un all_day guardado a medianoche de Cancún
-- (UTC-5) y mirado desde CDMX cae en las 23:00 del día anterior, y la barra se
-- pinta un día antes. No hace falta una clínica «a caballo entre dos husos»:
-- basta con que quien mira no esté en el huso del consultorio, y en la beta hay
-- cinco husos.
--
-- POR TANTO, EL CONVENIO DE LECTURA ES PARTE DEL CONVENIO DE ESCRITURA:
-- una fila con all_day se convierte a FECHA en la zona de SU consultorio
--   renderEnTZ(start_time, 'yyyy-MM-dd', consultorio_timezone ?? TZ_CLINICA)
-- y a FullCalendar se le entrega esa CADENA DE SÓLO FECHA, nunca el instante.
-- Es exactamente como ya entra el `end.date` de Google en agenda/page.tsx:2935,
-- y es la única lectura que no depende de dónde esté el navegador. El día que
-- eso no baste, la salida es migrar a columnas `date`, no parchear la lectura.
--
-- ── EL CONVENIO DE `end_time`, QUE ES LO QUE HAY QUE NO EQUIVOCARSE ─────────
-- FIN EXCLUSIVO: medianoche del día SIGUIENTE al último día del evento.
-- Un evento de todo el día del 19 → start 2026-08-19T00:00, end 2026-08-20T00:00.
-- Del 19 al 21 (tres días)        → start 2026-08-19T00:00, end 2026-08-22T00:00.
--
-- NO es «el último día a las 23:59». Cuatro motivos, y el tercero es el que manda:
--
--   1. Es lo que FullCalendar calcula internamente al convertir un evento con
--      hora en uno de todo el día: `computeAlignedDayRange` hace
--      `end = addDays(startOfDay(start), dayCnt)`
--      (@fullcalendar/core/internal-common.js:2730-2735, versión 6.1.20).
--   2. El solapamiento de `src/lib/agenda/ventanaRejilla.ts:286` es SEMIABIERTO
--      a propósito (su comentario lo dice en :283). Un fin inclusivo mete un
--      desajuste de un minuto en un cálculo escrito para el otro convenio.
--   3. ES EL QUE LA AGENDA YA CONSUME DE GOOGLE, SIN TRANSFORMAR.
--      `agenda/page.tsx:2935` hace `end: e.end?.dateTime ?? e.end?.date`, o sea
--      que el `end.date` de Google entra tal cual. Con 23:59 en nuestras citas,
--      la MISMA PANTALLA pintaría dos convenios distintos: la barra de un
--      «Congreso» de Google y la de unas vacaciones nuestras, del mismo rango,
--      no acabarían en el mismo sitio.
--   4. `diasTocados` (ventanaRejilla.ts:529) ya calcula su último día con
--      `ev.end.getTime() - 1`. Ese «menos un milisegundo» sólo tiene sentido
--      con fin exclusivo: es la prueba de que el módulo ya está escrito para
--      este convenio y no para el otro.
--
-- ── EL CONVENIO DE GOOGLE: COMPROBADO, NO ASUMIDO ──────────────────────────
-- Que Google manda `end.date` como fin EXCLUSIVO es lo que sostiene el motivo 3,
-- y está VERIFICADO EL 2026-08-26 contra la respuesta real de
-- `/api/google/events`. Un evento de todo el día de UN SOLO DÍA llegó así:
--
--   start.date = "2026-08-27"
--   end.date   = "2026-08-28"
--
-- N+1. Fin exclusivo, confirmado con datos y no por deducción. Respaldo
-- documental, por si alguien quiere la cita: la referencia oficial del recurso
-- Events dice «The (exclusive) end time of the event», y el mismo texto está en
-- el cliente que usa este servidor —`googleapis` ^171.4.0, importada en
-- src/lib/gcal.ts:18— en
-- node_modules/googleapis/build/src/apis/calendar/v3.d.ts:613-617.
--
-- ⚠️ SI ALGÚN DÍA QUIERES REPETIR LA COMPROBACIÓN, NO LA HAGAS MIRANDO LA
-- AGENDA. Un evento de todo el día de UN SOLO DÍA se pinta IGUAL con los dos
-- convenios, así que verlo bien no prueba nada:
--   · con fin exclusivo (end = N+1) sale un día por aritmética;
--   · con fin inclusivo (end = N) sale `endMarker <= startMarker`, y
--     `parseEventDef` lo DESCARTA (@fullcalendar/core/internal-common.js:3268-3270)
--     para reponerlo con `defaultAllDayEventDuration: { day: 1 }` (:1492) —
--     o sea, también un día.
-- Hace falta el JSON crudo de `/api/google/events`, o un evento de DOS DÍAS O
-- MÁS, que sí distingue a simple vista.
--
-- ⚠️ Y ESO MISMO ES EL MODO DE FALLO SILENCIOSO DE ESTE CONVENIO: un rango
-- invertido o de longitud cero NO da error en ningún sitio. FullCalendar tira
-- el `end` y repone un día. O sea que escribir 23:59 por descuido no se
-- manifiesta como un fallo, sino como un evento que casi siempre parece bien.
--
-- ── POR QUÉ NO HAY NINGÚN CHECK, QUE ES UNA DECISIÓN Y NO UN OLVIDO ─────────
-- El CHECK que pide el cuerpo es «si all_day, las horas a medianoche», y no se
-- puede escribir de forma útil. Ojo con el motivo, porque el fácil es falso:
-- NO es que Postgres no lo admita. `timestamptz AT TIME ZONE 'literal'` es
-- IMMUTABLE —lo que no lo es, es `timestamptz::date`, que depende del TimeZone
-- de la sesión—, así que un CHECK con la zona horneada compilaría. El motivo es
-- de producto: este producto guarda `consultorio_timezone` POR CITA porque hay
-- varias zonas, y la primera clínica en Cancún (UTC-5) vería rechazada cada
-- alta de todo el día por un literal que dice 'America/Mexico_City'. Un CHECK
-- no puede consultar otra tabla para resolver la zona, y un trigger sería la
-- primera pieza móvil de esta tabla, que hoy no tiene ninguna
-- (supabase/baseline/06_triggers.sql no lista ni un trigger de appointments).
--
-- La única forma SIN zona sería sobre la duración:
--   CHECK (NOT all_day OR (end_time > start_time
--          AND mod(extract(epoch FROM end_time - start_time)::numeric, 86400) = 0))
-- que caza el 23:59 sin nombrar ningún huso. TAMPOCO VALE, y conviene dejar
-- escrito por qué para que nadie lo reintroduzca: `America/Tijuana` sigue con
-- horario de verano (México lo abolió en 2022 salvo la franja fronteriza), así
-- que un evento de varios días que cruce el cambio dura 23 o 25 horas y este
-- CHECK rechazaría un alta legítima.
--
-- Lo que SÍ sería defendible es un `CHECK (end_time > start_time)`,
-- incondicional y sin relación con esta columna. Queda FUERA a propósito:
-- exige saber si hay filas que hoy lo violan, y este archivo no puede
-- afirmarlo. Va en su propia migración, con su pre-vuelo, si se quiere — y
-- vale más de lo que parece, porque es lo único que atraparía el fallo
-- silencioso descrito arriba.
--
-- ── QUÉ NO SE TOCA, Y POR QUÉ ──────────────────────────────────────────────
-- · RLS. Las cinco policies de appointments (20260530_etapa5h_paso3) sólo
--   nombran `clinica_id` y `medico_id`. El alcance de los roles NO CAMBIA EN
--   NINGUNA DE LAS DOS DIRECCIONES: nadie gana ni pierde nada. Las policies de
--   Postgres no discriminan por columna, así que la nueva queda cubierta por
--   las mismas cinco sin escribir una línea.
-- · Índices. Ninguno de los DIEZ referencia esta columna, y no se crea uno
--   nuevo: cardinalidad dos, y ninguna consulta filtra por ella. (Son diez, no
--   ocho: los ocho del baseline/03_indexes.sql:24-44 más
--   idx_appointments_consultorio, de 20260615_consultorios_04_snapshot.sql:58,
--   y appointments_gcal_calendar_id_idx, de 20260817_..._a_esquema.sql:416.)
-- · El baseline (supabase/baseline/02_tables.sql). No se actualiza aquí, igual
--   que en las cuatro migraciones anteriores. ⚠️ Ya va con tres migraciones de
--   retraso sobre esta misma tabla —le faltan icono, color y las seis
--   consultorio_*, y su CHECK de status no conoce 'attended'—. Reconciliarlo es
--   trabajo propio, no de aquí.
-- · Realtime. appointments está publicada (20260816) SIN lista de columnas
--   —`ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments`,
--   :169—, así que la columna nueva entra sola en el payload; es boolean, no
--   es TOAST, y viaja en todo UPDATE aunque la REPLICA IDENTITY sea default.
--   El veredicto de abajo lo comprueba.
--
--   ⚠️ PERO EL VALOR QUE LLEGA NO REPINTA EL EVENTO, y esto hay que arreglarlo
--   en el código o la agenda compartida miente. `aplicarAppointmentAlEvento`
--   (agenda/page.tsx:3046-3048) fusiona `extendedProps` clave por clave, y
--   `allDay` NO es un extendedProp: es propiedad de primer nivel de FullCalendar
--   y tiene su propio setter. La función llama a setStart, setEnd y
--   setProp('title'), y a ningún setAllDay. Sin esa línea, la pestaña del
--   médico recibe el cambio, actualiza extendedProps y DEJA EL EVENTO EN LA
--   REJILLA, con su bloque de 24 horas abriendo la ventana vertical de toda la
--   semana — el fallo exacto que esta funcionalidad viene a evitar.
--
-- ── BLOQUEOS ────────────────────────────────────────────────────────────────
-- ADD COLUMN con DEFAULT CONSTANTE **no reescribe la tabla desde PostgreSQL
-- 11**: el valor se anota en el catálogo (pg_attribute.atthasmissing /
-- attmissingval) y las filas viejas no se tocan. Supabase corre muy por encima
-- de 11, así que la ruta rápida está garantizada; el veredicto de abajo lo
-- comprueba de todas formas, para que conste en la rejilla y no de palabra.
--
-- El lock es ACCESS EXCLUSIVE, que bloquea lecturas Y escrituras, pero dura lo
-- que tarda el catálogo: milisegundos, independiente del volumen. Lo peligroso
-- no es tomarlo sino ESPERARLO —un ALTER encolado encola detrás a todas las
-- consultas siguientes, lecturas incluidas—, y de eso protege el lock_timeout.
--
-- ── VENTANA DE DESPLIEGUE: EL ORDEN SEGURO ES MIGRACIÓN PRIMERO ────────────
-- · Código VIEJO contra esquema NUEVO: inofensivo. Sus INSERT no mencionan
--   all_day y el DEFAULT false los deja correctos —toda cita de hoy es una cita
--   con hora, así que false no sólo es válido, es VERDADERO—. Sus SELECT usan
--   `*` (APPOINTMENT_SELECT, src/lib/appointments.ts:25) y recibirán una clave
--   de más que nadie lee.
-- · Código NUEVO contra esquema VIEJO: rompe. El INSERT mandaría `all_day` y
--   PostgREST respondería PGRST204 («column not found»), fallando el alta.
-- Por tanto: APLICAR ESTA MIGRACIÓN ANTES DE DESPLEGAR EL CÓDIGO.
--
-- ⚠️ HAY UN TERCER CASO, PORQUE LA AGENDA ES UN SPA DE SESIÓN LARGA CON
-- REALTIME: una pestaña CARGADA ANTES DEL DEPLOY sigue viva y recibe por
-- Realtime la primera cita de todo el día que cree cualquiera. Ese cliente
-- viejo no conoce la bandera y la pinta en la rejilla como bloque de 24 horas.
-- Se cura recargando, y conviene saberlo antes de que llegue como bug.
-- ============================================================================

BEGIN;

-- Un ALTER que espera un lock encola detrás de sí a TODAS las consultas
-- siguientes, lecturas incluidas. Con timeout, en vez de tumbar la agenda,
-- esto falla limpio y se reintenta.
SET LOCAL lock_timeout      = '5s';
SET LOCAL statement_timeout = '60s';

-- ── PRE-VUELO 1: la columna no existe con OTRA forma ───────────────────────
-- El `IF NOT EXISTS` de abajo se traga en silencio una columna preexistente
-- SEA COMO SEA. Si alguien creó un `all_day text`, o un `all_day boolean`
-- nullable, o sin DEFAULT, el ALTER no haría nada y el veredicto tendría que
-- cazarlo al final — o sea, con la transacción ya confirmada. Esto lo aborta
-- antes, que es lo que pide la dimensión 4 de la auditoría.
--
-- Un replay legítimo —la columna ya está, boolean, NOT NULL, DEFAULT false—
-- pasa por aquí sin ruido y el ALTER es un no-op. Es la distinción que exige la
-- dimensión 3: no-op silencioso cuando repetir es inofensivo, aborto ruidoso
-- cuando no lo es. NO distingue «ya corrió esta migración» de «alguien creó la
-- columna a mano con la forma correcta», y es a propósito: si la forma es la
-- que hace falta, las dos situaciones son la misma y no hay nada que decidir.
DO $$
DECLARE
  v_tipo     text;
  v_notnull  boolean;
  v_defecto  text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod),
         a.attnotnull,
         pg_get_expr(d.adbin, d.adrelid)
    INTO v_tipo, v_notnull, v_defecto
    FROM pg_attribute a
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
   WHERE a.attrelid = 'public.appointments'::regclass
     AND a.attname  = 'all_day'
     AND a.attnum > 0 AND NOT a.attisdropped;

  IF v_tipo IS NULL THEN
    RETURN;  -- no existe: primera pasada, todo normal
  END IF;

  IF v_tipo <> 'boolean' OR v_notnull IS NOT TRUE OR coalesce(v_defecto, '') <> 'false' THEN
    RAISE EXCEPTION
      'PRE-VUELO FALLO: public.appointments.all_day YA EXISTE con otra forma (tipo=%, not_null=%, defecto=%). Se esperaba boolean / NOT NULL / false. El ADD COLUMN IF NOT EXISTS de este archivo NO la corregiría: no haría nada y la migración terminaría en verde con la columna mal. Mirar quién la creó antes de tocar nada. Abortando.',
      v_tipo, v_notnull, coalesce(v_defecto, '(ninguno)');
  END IF;
END $$;

-- ── PRE-VUELO 2: la tabla es de quien aplica ───────────────────────────────
-- ALTER TABLE exige ser dueño. Un fallo de propiedad DESPUÉS de un pre-vuelo en
-- verde es justo lo que un pre-vuelo existe para adelantar (dimensión 11). El
-- precedente de esta comprobación está en
-- 20260816_agenda_realtime_appointments.sql:163-166.
--
-- ⚠️ 'USAGE' Y NO 'MEMBER', y el precedente citado tiene esto mal. 'MEMBER' es
-- el derecho a hacer SET ROLE; la comprobación de propiedad de Postgres es
-- `has_privs_of_role`, o sea los privilegios disponibles SIN SET ROLE, que es
-- lo que pg_has_role llama 'USAGE'. Con 'MEMBER', un rol miembro NOINHERIT
-- pasaría el pre-vuelo y moriría en el ALTER: el falso verde exacto que este
-- bloque existe para impedir.
DO $$
DECLARE
  v_dueno oid := (SELECT relowner FROM pg_class WHERE oid = 'public.appointments'::regclass);
BEGIN
  IF NOT pg_has_role(current_user, v_dueno, 'USAGE') THEN
    RAISE EXCEPTION
      'PRE-VUELO FALLO: % no es dueño de public.appointments (dueño: %). Aplicar con ese rol. Abortando.',
      current_user, pg_get_userbyid(v_dueno);
  END IF;
END $$;

-- ── LA COLUMNA ─────────────────────────────────────────────────────────────
-- DEFAULT false y no NULL-able: el 100 % de las filas que ya existen son citas
-- CON HORA, así que `false` no es sólo un valor válido para el CHECK —no hay
-- CHECK— sino que es VERDADERO respecto del mundo real, que es lo que pide la
-- dimensión 9. Comprobado contra los caminos de escritura, no supuesto: el
-- único INSERT a esta tabla es api/appointments/route.ts:221-244, que no tiene
-- forma de expresar un evento de todo el día, y nada del código escribe filas
-- con origen='google' (los eventos de Google se pintan desde otra fuente y no
-- se copian a appointments). No hay backfill porque no hay nada que corregir.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS all_day boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.appointments.all_day IS
  'true = la cita ocupa días enteros y se pinta en la banda de todo el día de la agenda, no en la rejilla horaria. CONVENIO DE FECHAS, no romperlo: start_time = medianoche del primer día y end_time = medianoche del día SIGUIENTE al último (fin EXCLUSIVO), en la zona del consultorio de la cita (consultorio_timezone). Un solo día del 19 → 19T00:00 .. 20T00:00. Es el convenio de FullCalendar (computeAlignedDayRange) y el mismo con el que la agenda ya lee los eventos de todo el día de Google (end.date), comprobado el 2026-08-26 contra la respuesta real: un evento de un solo día llega con start.date 2026-08-27 y end.date 2026-08-28. NO es "el ultimo dia a las 23:59". EL CONVENIO DE LECTURA ES PARTE DEL TRATO: una fila con all_day se convierte a FECHA en la zona de SU consultorio —renderEnTZ(start_time, ''yyyy-MM-dd'', consultorio_timezone)— y se entrega como cadena de solo fecha; leerla como instante en el huso del dispositivo, que es LA REGLA del resto de la agenda (src/lib/dates.ts), corre el evento un dia entero cuando quien mira no esta en el huso del consultorio. false = cita con hora, que es el caso normal y el de todas las filas anteriores a esta columna.';

COMMIT;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ VEREDICTO — en la REJILLA, que es el único canal fiable del SQL Editor   ║
-- ║ (dimensión 5). Todas las concatenaciones llevan su ::text: en la         ║
-- ║ migración 5 de la serie de agosto el veredicto murió con `ERROR 42725:   ║
-- ║ operator is not unique` por concatenar un "char" sin castear, y lo hizo  ║
-- ║ con la transacción ya confirmada. Ver                                    ║
-- ║ 20260821_agenda_evento_generico_icono_color.sql:44-51.                   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
WITH m AS (
  SELECT
    (SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='appointments'
        AND column_name='all_day' AND data_type='boolean')              AS columna_boolean,
    (SELECT a.attnotnull FROM pg_attribute a
      WHERE a.attrelid='public.appointments'::regclass
        AND a.attname='all_day' AND a.attnum > 0 AND NOT a.attisdropped) AS es_not_null,
    (SELECT pg_get_expr(d.adbin, d.adrelid)
       FROM pg_attribute a
       JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE a.attrelid='public.appointments'::regclass
        AND a.attname='all_day')                                        AS defecto,
    /* Prueba de que NO hubo reescritura de tabla: con la ruta rápida de PG 11+
       el valor de las filas viejas vive en el catálogo, no en el heap.
       ⚠️ INFORMATIVO, NO ES CONDICIÓN DE FALLO. Sale false si la tabla estaba
       vacía o si Postgres eligió otra ruta; en ninguno de los dos casos la
       migración está mal. Se enseña para que la afirmación «no reescribe» del
       encabezado sea comprobable y no una promesa. */
    (SELECT a.atthasmissing FROM pg_attribute a
      WHERE a.attrelid='public.appointments'::regclass
        AND a.attname='all_day')                                        AS default_rapido,
    /* Grants a nivel de COLUMNA: si los hubiera, la columna nueva nace
       invisible para el cliente y la agenda no la recibiría, sin error claro.
       ⚠️ pg_attribute.attacl y NO information_schema.column_privileges: esa
       vista EXPANDE los grants de TABLA columna por columna y devuelve del
       orden de un centenar de filas sobre appointments aunque no exista ni un
       grant de columna, con lo que esta rama se cumpliría SIEMPRE y taparía a
       las de arriba. Comprobado y escrito desde el 2026-08-17 en
       20260817_gcal_conexion_clinica_a_esquema.sql:92-107. */
    (SELECT count(*) FROM pg_attribute a
      WHERE a.attrelid='public.appointments'::regclass
        AND a.attnum > 0 AND NOT a.attisdropped
        AND a.attacl IS NOT NULL)                                       AS grants_por_columna,
    /* ¿La columna nueva VIAJA por Realtime? De esto depende que el cambio de
       all_day llegue a la otra pestaña, y no lo comprobaba nada. La publicación
       se creó SIN lista de columnas (20260816:169), así que attnames trae todas
       y la nueva entra sola; si alguien la republicara CON lista, la columna
       quedaría fuera y la agenda compartida fallaría sin un solo error. */
    (SELECT count(*) FROM pg_publication_tables p
      WHERE p.pubname='supabase_realtime' AND p.schemaname='public'
        AND p.tablename='appointments'
        AND (p.attnames IS NULL OR 'all_day' = ANY(p.attnames)))        AS realtime_publica,
    /* Informativo. Tiene que ser 0 el día que se aplica —el código nuevo aún no
       ha subido— y pasa a ser > 0 después. Las dos cosas están bien. */
    (SELECT count(*) FROM public.appointments WHERE all_day)            AS filas_todo_el_dia,
    /* También informativo, y es el número que hace falta para el §3: cuántas
       citas habría que revisar a mano si el convenio de fechas se cambiara
       después. Hoy da el total de la tabla. */
    (SELECT count(*) FROM public.appointments)                          AS filas_totales
)
SELECT m.*,
       CASE
         WHEN m.columna_boolean <> 1 THEN
           'REVISAR: no hay una columna boolean llamada all_day en public.appointments. El ADD COLUMN no corrió, o existía con otro tipo y el pre-vuelo 1 debería haber abortado: mirar por qué no lo hizo.'
         WHEN m.es_not_null IS NOT TRUE THEN
           'REVISAR: all_day existe pero es NULLABLE. El código no contempla un tercer estado; una fila con NULL se leeria como "ni una cosa ni otra" y la agenda no sabria donde pintarla.'
         WHEN coalesce(m.defecto, '') <> 'false' THEN
           'REVISAR: el DEFAULT de all_day no es false, es ' || coalesce(m.defecto, '(ninguno)')::text || '. Sin el default correcto, todo INSERT del codigo viejo —que no menciona la columna— fallaria por NOT NULL.'
         WHEN m.grants_por_columna > 0 THEN
           'REVISAR: hay ' || m.grants_por_columna::text || ' columna(s) de appointments con ACL propio. La columna nueva puede ser invisible para el cliente; conceder a mano.'
         WHEN m.realtime_publica <> 1 THEN
           'REVISAR: all_day NO figura entre las columnas que supabase_realtime publica de appointments (o la tabla dejo de estar publicada). El cambio de todo-el-dia no llegaria a la otra pestana y nadie veria un error. Comprobar pg_publication_tables y 20260816_agenda_realtime_appointments.sql.'
         ELSE
           'OK — appointments.all_day boolean NOT NULL DEFAULT false, publicada en Realtime. Ni una fila movida, ni un indice, ni una policy, ni un trigger. filas_todo_el_dia es informativo: 0 hasta que suba el codigo nuevo, >0 despues, y las dos cosas estan bien. default_rapido tambien es informativo (t = la ruta sin reescritura de PG 11+). FALTA COMPROBAR PostgREST DESDE FUERA: esta consulta no pasa por ahi. Ver la cabecera.'
       END AS veredicto
  FROM m;
