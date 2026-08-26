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
-- día. Son DOS, porque este archivo deja dos objetos:
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
--   SELECT conname, convalidated, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = 'public.appointments'::regclass
--      AND conname  = 'appointments_all_day_medianoche_check';
--   -- Aplicada = una fila, con convalidated = t.
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
--   ALTER TABLE public.appointments
--     DROP CONSTRAINT IF EXISTS appointments_all_day_medianoche_check;
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
--   appointments_all_day_medianoche_check  — el CHECK que impone su convenio.
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
-- ⚠️ Y NO SE PINTARÁ EN NINGUNA PARTE HASTA QUE EL CÓDIGO ENCIENDA
-- `allDaySlot`, que hoy va en `false` (agenda/page.tsx:4274). Eso no esconde la
-- banda: hace que FullCalendar NO LA MONTE, así que un evento `allDay` se queda
-- en el store sin dibujarse —le pasa ya a los de Google, y está escrito en
-- agenda/page.tsx:2382-2390—. Al encenderla hay que retirar además la reja
-- `sinAllDay` de `contarVisibles` (:2396-2399) o el subtítulo contará de menos.
-- Esta columna es INERTE hasta entonces, y eso es lo que hace segura la ventana
-- de despliegue de más abajo.
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
-- que esta tabla ya tiene). El CHECK de abajo es lo que impide que sea otra.
--
-- ⚠️⚠️ Y AQUÍ VA LA PARTE QUE NO SE PUEDE DEJAR PARA DESPUÉS, PORQUE EL
-- PRODUCTO LEE Y ESCRIBE EN LA ZONA CONTRARIA. La regla escrita de este código
-- es que las horas de las citas se pintan EN EL HUSO DEL DISPOSITIVO de quien
-- mira —src/lib/dates.ts:21-46 y dashboard/utils.ts:18-24, que llegó a existir
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
-- y es la única lectura que no depende de dónde esté el navegador.
--
-- ⚠️ Y AL REVÉS, QUE ES LO QUE CORROMPE EL DATO Y NO SÓLO LA PANTALLA: la
-- medianoche se COMPONE con `fechaHoraLocalAInstante(fecha,'00:00',tz)`
-- (src/lib/dates.ts:139), NUNCA con `componerIso` (agenda/page.tsx:660), que
-- usa el reloj del navegador y lo dice en su propio comentario. El sitio con
-- menos formas de equivocarse es el SERVIDOR: el POST ya carga el consultorio
-- con su `timezone` (api/appointments/route.ts:199-217), así que el cliente
-- puede mandar fechas y el servidor componer los instantes, un punto y no dos.
-- Lo mismo vale para el arrastre y el redimensionado, que hoy mandan
-- `arg.event.start.toISOString()` a pelo (:3359-3360, :3422).
--
-- El día que esto no baste, la salida es migrar a columnas `date`, no parchear
-- la lectura.
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
--   4. `diasTocados` (ventanaRejilla.ts:529) calcula su último día con
--      `ev.end.getTime() - 1`. ⚠️ OJO CON LO QUE ESO PRUEBA Y LO QUE NO: ese
--      «menos un milisegundo» es COMPATIBLE con los dos convenios, y sólo es
--      NECESARIO bajo el exclusivo —sin él, un all_day 19→20T00:00 marcaría el
--      día 20 como ocupado—. O sea que no demuestra qué se eligió; demuestra
--      que el módulo aguanta esta elección sin tocarlo.
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
-- El CHECK de abajo existe por esta frase.
--
-- ── EL CHECK: SE PUEDE ESCRIBIR, Y VA ──────────────────────────────────────
-- ⚠️ ESTA SECCIÓN DECÍA LO CONTRARIO Y ERA FALSO. La versión anterior sostenía
-- que el CHECK «no se puede escribir bien» porque «un CHECK no puede consultar
-- otra tabla para resolver la zona». Lo segundo es cierto y no viene al caso:
-- LA ZONA NO ESTÁ EN OTRA TABLA, ESTÁ EN LA PROPIA FILA. `consultorio_timezone`
-- se snapshotea en `appointments` desde 20260615_consultorios_04_snapshot.sql:47
-- justamente para no tener que ir a buscarla.
--
-- Y `AT TIME ZONE` es IMMUTABLE también cuando el huso sale de una columna, no
-- sólo de un literal: `timezone(text, timestamptz)` está marcada provolatile='i'
-- desde PostgreSQL 8.0 (era 's' en 7.4). Tanto, que se puede indexar. Lo que NO
-- es inmutable es `timestamptz::date`, que depende del TimeZone de la sesión;
-- de ahí venía la confusión.
--
-- ⚠️ ESA VOLATILIDAD NO SE COMPROBÓ CONTRA EL CATÁLOGO, y queda dicho en vez de
-- darse por buena: no hay Postgres a mano donde consultar `pg_proc.provolatile`,
-- y la referencia de PostgreSQL §9.9 documenta el operador pero NO dice nada de
-- volatilidad ni de uso en índices o constraints (comprobado el 2026-08-26).
-- SE ACEPTA IGUAL, y por un motivo concreto: es la afirmación menos peligrosa
-- del archivo, porque SE VERIFICA SOLA EN LA PRIMERA EJECUCIÓN. Si fuera falsa,
-- el ADD CONSTRAINT de abajo moriría con `42P17` —«functions in check constraint
-- expression must be marked IMMUTABLE»— dentro de la transacción, abortándolo
-- todo. No hay forma de que esto pase en verde y deje datos mal: o corre, o no
-- corre. Lo que SÍ está verificado, y es la mitad que importaba, es la
-- distinción: lo no-inmutable es `timestamptz::date`, que lee el TimeZone de la
-- sesión, y de ahí salía la confusión que esta sección deshace.
--
-- Así que el invariante del convenio SÍ es imponible, y aquí se impone:
--   · si all_day, la fila LLEVA su zona (sin ella el dato es ininterpretable);
--   · las dos puntas caen a medianoche EN ESA zona;
--   · el fin va después del inicio.
--
-- ⚠️ `consultorio_timezone IS NOT NULL` VA PRIMERO Y NO ES DECORATIVO. Sin ese
-- conjunto, una fila con all_day y la zona en NULL daría NULL en la comparación,
-- Y UN CHECK QUE DEVUELVE NULL NO SE VIOLA: PASA. Es la trampa clásica, y aquí
-- mordería justo en el caso que más importa.
--
-- QUÉ ATRAPA, EN CONCRETO:
--   · el 23:59 por descuido, que FullCalendar repone a un día sin avisar;
--   · el alta escrita con la medianoche del NAVEGADOR en vez de la del
--     consultorio (componerIso, el arrastre) — deja de corromper en silencio y
--     pasa a fallar con un 23514;
--   · el cambio de consultorio a otro huso sin recomponer las horas
--     (PUT /api/appointments/[id]:280-285 re-snapshotea consultorio_timezone y
--     no toca los instantes) — mismo 23514 en vez de un día de deriva mudo.
--
-- QUÉ NO ATRAPA: nada de esto vale para las citas CON hora, y es a propósito.
-- La rama `NOT all_day` las deja pasar enteras, así que NINGUNA FILA ACTUAL
-- puede violarlo: todas nacen false y el VALIDATE es trivial.
--
-- DOS FORMAS QUE SE CONSIDERARON Y NO VAN, para que nadie las reintroduzca:
--   · Zona horneada —`(start_time AT TIME ZONE 'America/Mexico_City')::time`—:
--     compila, pero la primera clínica en Cancún (UTC-5) vería rechazada cada
--     alta de todo el día. Este producto guarda la zona POR CITA porque hay
--     varias; hornear una en el esquema es negarlo.
--   · Sobre la DURACIÓN, sin zona:
--       mod(extract(epoch FROM end_time - start_time)::numeric, 86400) = 0
--     Caza el 23:59 sin nombrar husos, y aun así NO VALE: `America/Tijuana`
--     sigue con horario de verano —México lo abolió en 2022 salvo la franja
--     fronteriza— y un evento de varios días que cruce el cambio dura 23 o 25
--     horas, con lo que rechazaría un alta legítima. Son CUATRO de las DOCE
--     zonas que ofrece el selector (Tijuana, Matamoros, Ojinaga, Ciudad Juárez,
--     src/lib/consultorios/zonas-mexico.ts:46-59), comprobadas con `zdump -v`.
--     El CHECK que va mira las PUNTAS y no la duración, así que ese mismo
--     evento pasa: sus dos extremos siguen siendo medianoche.
--
-- ⚠️ UN RIESGO, DICHO ENTERO: si `consultorio_timezone` guardara algo que no es
-- una zona IANA, `AT TIME ZONE` LANZA (22023) en vez de devolver false. El valor
-- sale de una lista cerrada de DOCE, así que sólo pasaría con una fila editada
-- a mano — y si pasara, saltaría en el VALIDATE de abajo, o sea ANTES del
-- COMMIT y abortándolo todo. Fallo seguro, no fallo silencioso.
--
-- Lo que sigue FUERA es el `CHECK (end_time > start_time)` incondicional, para
-- las citas con hora: exige saber si hay filas que hoy lo violan, y este archivo
-- no puede afirmarlo. Va en su propia migración, con su pre-vuelo. El caso
-- peligroso —el de los eventos de todo el día— ya queda cubierto aquí.
--
-- ── QUÉ NO SE TOCA, Y POR QUÉ ──────────────────────────────────────────────
-- · RLS. Las cinco policies de appointments (20260530_etapa5h_paso3) sólo
--   nombran `clinica_id` y `medico_id`. El alcance de los roles NO CAMBIA EN
--   NINGUNA DE LAS DOS DIRECCIONES: nadie gana ni pierde nada. Las policies de
--   Postgres no discriminan por columna, así que la nueva queda cubierta por
--   las mismas cinco sin escribir una línea. El CHECK tampoco es un permiso:
--   restringe QUÉ se puede escribir, no QUIÉN.
-- · Índices. Ninguno de los DIEZ referencia esta columna, y no se crea uno
--   nuevo: cardinalidad dos, y ninguna consulta filtra por ella. (Son diez, no
--   ocho: los ocho del baseline/03_indexes.sql:24-44 más
--   idx_appointments_consultorio, de 20260615_consultorios_04_snapshot.sql:58,
--   y appointments_gcal_calendar_id_idx, de 20260817_..._a_esquema.sql:416.)
--   ⚠️ El arreglo del GET —pasar de filtrar por `start_time` a filtrar por
--   SOLAPE— cambia la forma de la consulta más caliente de la agenda. Hoy da
--   igual por volumen; si algún día no lo diera, el índice que hace falta es
--   otra migración y no ésta.
-- · El baseline (supabase/baseline/02_tables.sql). No se actualiza aquí, igual
--   que en las cuatro migraciones anteriores. ⚠️ Ya va con tres migraciones de
--   retraso sobre esta misma tabla —le faltan icono, color y las seis
--   consultorio_*, y su CHECK de status no conoce 'attended'—. Reconciliarlo es
--   trabajo propio, no de aquí.
-- · Realtime. appointments está publicada (20260816) SIN lista de columnas
--   —`ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments`,
--   :169—, así que la columna nueva entra sola en el payload; es boolean, no
--   es TOAST, y viaja en todo UPDATE aunque la REPLICA IDENTITY sea default.
--   El veredicto de abajo lo comprueba, porque el repo no es la base.
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
-- ⚠️ EL `NOT VALID` + `VALIDATE` DE ESTE ARCHIVO ES CEREMONIAL, NO UNA
-- OPTIMIZACIÓN DE LOCK, Y ESTE PÁRRAFO DECÍA LO CONTRARIO. Aquí las dos
-- sentencias van DENTRO del mismo `BEGIN`, y el `ACCESS EXCLUSIVE` que toma el
-- `ADD CONSTRAINT` se retiene hasta el `COMMIT`: el escaneo del `VALIDATE` corre
-- con la tabla cerrada a lecturas Y escrituras. El `SHARE UPDATE EXCLUSIVE` más
-- flojo del `VALIDATE` no compra nada mientras el fuerte siga puesto. Si lees
-- este bloque buscando la ganancia de concurrencia del patrón, no está.
--
-- VA EN UNA SOLA TRANSACCIÓN A PROPÓSITO, y es lo que sostiene la promesa de la
-- sección «EL CHECK» de más arriba: si alguna fila guardara una zona no-IANA,
-- el `22023` de `AT TIME ZONE` aborta TODO y no deja nada a medias. Sacando el
-- `VALIDATE` fuera del `COMMIT`, ese mismo error dejaría la columna creada y el
-- CHECK puesto pero en `NOT VALID`, o sea vigilando las escrituras nuevas y sin
-- imponer nada sobre lo viejo, y habría que rematarlo a mano. Atomicidad por
-- concurrencia es el cambio que se hizo, sabiendo lo que se compraba.
--
-- ⚠️ Y POR ESO ESTE ARCHIVO SE APARTA DEL PATRÓN DE SUS TRES PRECEDENTES, que
-- sacan el `VALIDATE` FUERA del `COMMIT` con sus `SET`/`RESET` propios:
--   20260815_gcal_calendario_propio_a_esquema.sql   COMMIT 116 · VALIDATE 122-123
--   20260821_agenda_evento_generico_icono_color.sql COMMIT 362 · VALIDATE 375-376
--   20260822_agenda_pinta_definitiva.sql            COMMIT 533 · VALIDATE 546-547
-- Lo hacen porque SUS constraints SÍ podían fallar contra los datos viejos —una
-- lista cerrada de iconos y colores estrenada sobre filas ya escritas—, así que
-- ahí el escaneo largo bajo lock flojo valía el riesgo de quedarse a medias.
-- El de aquí NO PUEDE FALLAR: toda fila existente nace `all_day = false` y la
-- rama `NOT all_day` las deja pasar enteras. NO ES UN DESCUIDO; es la elección
-- contraria ante un riesgo contrario, y queda escrita para que el siguiente que
-- compare los cuatro archivos no la "corrija".
--
-- ⚠️ EL PRECIO, DICHO ENTERO: si esto se replaya sobre una base con muchas más
-- filas —que es el escenario que la §2 del protocolo obliga a considerar—, el
-- escaneo ENTERO corre bajo `ACCESS EXCLUSIVE`. Hoy es instantáneo porque
-- ninguna fila puede violar el CHECK; deja de serlo el día que existan filas con
-- `all_day = true`, y ese día un replay de este archivo bloquea la tabla lo que
-- dure el recorrido. Si llega ese día, la salida es partirlo en dos como los
-- precedentes y asumir el `NOT VALID` colgado, no fingir que este párrafo decía
-- otra cosa.
--
-- ── VENTANA DE DESPLIEGUE: EL ORDEN SEGURO ES MIGRACIÓN PRIMERO ────────────
-- · Código VIEJO contra esquema NUEVO: inofensivo. Sus INSERT no mencionan
--   all_day y el DEFAULT false los deja correctos —toda cita de hoy es una cita
--   con hora, así que false no sólo es válido, es VERDADERO—. Sus SELECT usan
--   `*` (APPOINTMENT_SELECT, src/lib/appointments.ts:25) y recibirán una clave
--   de más que nadie lee. El CHECK nuevo no les afecta: su rama `NOT all_day`
--   se cumple sola en todo lo que el código viejo sabe escribir.
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
-- lo que pg_has_role llama 'USAGE'. Lo dice el manual en 5.7: «The right to
-- modify or destroy an object is inherent in being the object's owner… that
-- right can be INHERITED by members of the owning role». Con 'MEMBER', un rol
-- miembro NOINHERIT pasaría el pre-vuelo y moriría en el ALTER: el falso verde
-- exacto que este bloque existe para impedir.
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
-- CON HORA, así que `false` no es sólo un valor válido para el CHECK sino que
-- es VERDADERO respecto del mundo real, que es lo que pide la dimensión 9.
-- Comprobado contra los caminos de escritura, no supuesto: el único INSERT a
-- esta tabla es api/appointments/route.ts:221-244, que no tiene forma de
-- expresar un evento de todo el día, y nada del código escribe filas con
-- origen='google' (los eventos de Google se pintan desde otra fuente y no se
-- copian a appointments). No hay backfill porque no hay nada que corregir.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS all_day boolean NOT NULL DEFAULT false;


-- ── EL CHECK DEL CONVENIO ──────────────────────────────────────────────────
-- El razonamiento entero está arriba, en «EL CHECK: SE PUEDE ESCRIBIR, Y VA».
-- El DROP previo es lo que mantiene el replay como no-op silencioso: ADD
-- CONSTRAINT no tiene IF NOT EXISTS y un segundo pase moriría con 42710.
-- Precedente del patrón: 20260821_agenda_evento_generico_icono_color.sql:348-357.
-- Redeclarar un CHECK idéntico no destruye nada, así que el DROP aquí NO es el
-- caso que la dimensión 3 manda convertir en aborto ruidoso.
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_all_day_medianoche_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_all_day_medianoche_check CHECK (
    NOT all_day
    OR (
      -- ⚠️ ESTE CONJUNTO VA PRIMERO: sin él la expresión daría NULL cuando la
      -- zona es NULL, y un CHECK que devuelve NULL PASA.
          consultorio_timezone IS NOT NULL
      AND end_time > start_time
      AND (start_time AT TIME ZONE consultorio_timezone)::time = '00:00'::time
      AND (end_time   AT TIME ZONE consultorio_timezone)::time = '00:00'::time
    )
  ) NOT VALID;

ALTER TABLE public.appointments
  VALIDATE CONSTRAINT appointments_all_day_medianoche_check;


COMMENT ON COLUMN public.appointments.all_day IS
  'true = la cita ocupa días enteros y se pinta en la banda de todo el día de la agenda, no en la rejilla horaria. CONVENIO DE FECHAS, no romperlo: start_time = medianoche del primer día y end_time = medianoche del día SIGUIENTE al último (fin EXCLUSIVO), en la zona del consultorio de la cita (consultorio_timezone). Un solo día del 19 → 19T00:00 .. 20T00:00. Lo impone appointments_all_day_medianoche_check, que ademas obliga a que la fila lleve su consultorio_timezone: sin ella el dato es ininterpretable. Es el convenio de FullCalendar (computeAlignedDayRange) y el mismo con el que la agenda ya lee los eventos de todo el día de Google (end.date), comprobado el 2026-08-26 contra la respuesta real: un evento de un solo día llega con start.date 2026-08-27 y end.date 2026-08-28. NO es "el ultimo dia a las 23:59". EL CONVENIO DE LECTURA ES PARTE DEL TRATO: una fila con all_day se convierte a FECHA en la zona de SU consultorio —renderEnTZ(start_time, ''yyyy-MM-dd'', consultorio_timezone)— y se entrega como cadena de solo fecha; y al escribir, la medianoche se compone con fechaHoraLocalAInstante(fecha, ''00:00'', consultorio_timezone), nunca con el reloj del navegador. Leerla o escribirla en el huso del dispositivo, que es LA REGLA del resto de la agenda (src/lib/dates.ts), corre el evento un dia entero cuando quien mira no esta en el huso del consultorio. false = cita con hora, que es el caso normal y el de todas las filas anteriores a esta columna.';

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
    /* El CHECK del convenio, y VALIDADO: un NOT VALID que se quedara a medias
       dejaría el invariante sin imponer sobre lo que ya hay. Tiene que dar 1. */
    (SELECT count(*) FROM pg_constraint
      WHERE conrelid='public.appointments'::regclass
        AND conname='appointments_all_day_medianoche_check'
        AND contype='c' AND convalidated)                               AS check_convenio,
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
         WHEN m.check_convenio <> 1 THEN
           'REVISAR: falta appointments_all_day_medianoche_check, o esta NOT VALID. Sin el, nada impide guardar un evento de todo el dia con las horas en el huso equivocado o sin consultorio_timezone, y eso no falla: se pinta un dia corrido. Ver la seccion "EL CHECK" de la cabecera.'
         WHEN m.grants_por_columna > 0 THEN
           'REVISAR: hay ' || m.grants_por_columna::text || ' columna(s) de appointments con ACL propio. La columna nueva puede ser invisible para el cliente; conceder a mano.'
         WHEN m.realtime_publica <> 1 THEN
           'REVISAR: all_day NO figura entre las columnas que supabase_realtime publica de appointments (o la tabla dejo de estar publicada). El cambio de todo-el-dia no llegaria a la otra pestana y nadie veria un error. Comprobar pg_publication_tables y 20260816_agenda_realtime_appointments.sql.'
         ELSE
           'OK — appointments.all_day boolean NOT NULL DEFAULT false, con su CHECK de convenio validado y publicada en Realtime. Ni una fila movida, ni un indice, ni una policy, ni un trigger. filas_todo_el_dia es informativo: 0 hasta que suba el codigo nuevo, >0 despues, y las dos cosas estan bien. default_rapido tambien es informativo (t = la ruta sin reescritura de PG 11+). FALTA COMPROBAR PostgREST DESDE FUERA: esta consulta no pasa por ahi. Y OJO: la columna es INERTE hasta que el codigo encienda allDaySlot; aplicar esto no enciende nada.'
       END AS veredicto
  FROM m;
