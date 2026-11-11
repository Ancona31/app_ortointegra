-- ═══════════════════════════════════════════════════════════════════════
-- Agenda A1.8 — índices de rango para GET /api/appointments
-- Rama: feature/agenda-v2 · Escrita: 2026-11-11
-- Riesgo estimado: BAJO (dos índices nuevos, ningún dato tocado, ninguna
-- policy ni permiso movido; `appointments` tiene ~154 filas en producción).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-11-11
--   `psql -v ON_ERROR_STOP=1 -f` del archivo completo (rejilla: 5 × OK), y
--   después `supabase migration up --local` (CLI 2.117.0), que lo volvió a
--   correr entero y lo anotó en `supabase_migrations.schema_migrations`
--   (versión 20261111120000, 9 sentencias). Esa segunda pasada fue no-op:
--   la CLI no enseña los NOTICE, pero la misma doble pasada probada antes
--   con psql dio los dos «relation … already exists, skipping» y la misma
--   rejilla. Se hizo con la CLI desde un directorio temporal que añadía los
--   tres `20261014*` de `feature/limites-ajustables`: la base local ya los
--   tiene en su historial y este árbol no, así que `migration up` desde
--   aquí se niega (comprobado: «Remote migration versions not found in
--   local migrations directory», LegacyMigrationMissingLocalError).
--   Comprobación:
--     select c.relname, i.indisvalid, i.indisready
--       from pg_index i join pg_class c on c.oid = i.indexrelid
--      where i.indrelid = 'public.appointments'::regclass
--        and c.relname in ('idx_appointments_clinica_inicio',
--                          'idx_appointments_clinica_medico_inicio');
--   → las dos filas con indisvalid = t e indisready = t.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR.
--
-- AUDITORÍA INDEPENDIENTE (`supabase/AUDITORIA-MIGRACIONES.md`, 2026-11-11):
-- sin hallazgos que bloqueen. Incorporados antes del primer commit (el
-- archivo no se había aplicado en producción): comprobación de `indoption`
-- en el pre-vuelo, y las dos notas de abajo sobre `db push` y los bloqueos
-- del replay.
--
-- Medición que la respalda (planes, tiempos, variantes descartadas):
-- `supabase/auditorias/A1.8-indices-rango-agenda.md`.
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
--
-- La consulta de la agenda (src/app/api/appointments/route.ts, GET) es
--
--   clinica_id = $1 [AND medico_id = $2]
--   AND start_time < $hasta AND end_time >= $desde      -- solape
--   ORDER BY start_time  LIMIT 1000   + un count(*) con el mismo filtro
--
-- y hasta hoy sólo había índices de una columna. El planificador elegía
-- `idx_appointments_start_time` con `start_time < $hasta` como única
-- condición de índice y descartaba en el heap, fila a fila, todo lo
-- anterior a la ventana y todo lo de otras clínicas (medido: 14,834 filas
-- leídas y tiradas para devolver 310 en una semana con 30,000 citas).
--
-- Con (clinica_id, start_time, end_time) las TRES condiciones son
-- condiciones de índice: `end_time >= $desde` se comprueba en la hoja del
-- índice y el heap sólo se visita para las filas que de verdad solapan. Y
-- el orden del índice coincide con el ORDER BY, así que la rama con LIMIT
-- no ordena. La variante (clinica_id, medico_id, …) cubre el filtro por
-- médico de la misma forma.
--
-- Lo que NO resuelven estos índices, y conviene tenerlo escrito: la cota
-- inferior de `start_time` no existe en la consulta (una cita puede haber
-- empezado mucho antes de la ventana), así que el recorrido del índice
-- empieza en la primera cita de la clínica y avanza hasta `$hasta`. Las
-- entradas anteriores a la ventana se descartan en el índice, no en el
-- heap, que es barato pero no gratis. Se midió la alternativa con
-- `end_time` delante y es peor en la consulta real (pierde el orden del
-- ORDER BY y el planificador vuelve al índice suelto): ver el informe.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO (o con
-- `supabase db push`, que da el mismo resultado pero no enseña la rejilla).
--   (Auditoría: no está comprobado que `db push` imprima las FILAS del
--   SELECT final. Si por ese camino no salen las 5 filas OK/REVISAR, correr
--   la sección 3 a mano contra la base de destino antes de darla por buena.)
--
-- SIN `CONCURRENTLY`, a propósito. `CREATE INDEX CONCURRENTLY` no puede ir
-- dentro de un bloque de transacción, y el SQL Editor envuelve el script
-- multi-sentencia en una transacción implícita: con CONCURRENTLY este
-- archivo no correría tal como se pega. Y no hace falta: con ~154 filas la
-- construcción es instantánea (medido en local: los dos índices sobre
-- 30,372 filas en ~120 ms).
--
-- Bloqueos: `CREATE INDEX` sin CONCURRENTLY toma SHARE sobre
-- `public.appointments` hasta el COMMIT. SHARE NO bloquea lecturas
-- (SELECT, que es ACCESS SHARE) pero SÍ bloquea INSERT/UPDATE/DELETE
-- (ROW EXCLUSIVE). El `lock_timeout` de abajo existe por la cola de
-- bloqueos: si alguien tuviera una transacción larga abierta sobre la
-- tabla, el CREATE INDEX esperaría, y mientras espera TODAS las escrituras
-- de la agenda se encolan detrás de él. Mejor fallar a los 5 s y repetir.
--   (Auditoría: también un replay no-op toma el SHARE un instante —se toma
--   al abrir la tabla, antes de decidir saltarse el CREATE—; dura lo que el
--   chequeo de catálogo, no lo que una construcción.)
--   ⚠️ Si este archivo se replayeara sobre una tabla de millones de filas,
--   la ventana de escrituras bloqueadas duraría lo que tarde en construirse
--   el índice. Ahí sí habría que partirlo y correr cada CREATE INDEX
--   CONCURRENTLY suelto, fuera de transacción y fuera del SQL Editor.
--
-- Orden respecto al código: da igual, y se puede aplicar ya. Ningún
-- código depende de estos índices para funcionar, sólo para ir más rápido;
-- el código viejo y el nuevo leen igual con y sin ellos.
--
-- Alcance de los roles: no cambia en ninguna de las dos direcciones. Un
-- índice no concede ni retira privilegios, no participa en la RLS y no es
-- alcanzable por PostgREST. Tampoco es UNIQUE, así que no puede filtrar la
-- existencia de filas ajenas por error de conflicto.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--
--   DROP INDEX IF EXISTS public.idx_appointments_clinica_medico_inicio;
--   DROP INDEX IF EXISTS public.idx_appointments_clinica_inicio;
--
-- No pierde datos (un índice no guarda nada que no esté en la tabla) y
-- devuelve la consulta a su plan anterior. `DROP INDEX` toma ACCESS
-- EXCLUSIVE sobre la tabla —bloquea también las lecturas— durante un
-- instante; con tráfico real, mejor `DROP INDEX CONCURRENTLY` suelto,
-- fuera de transacción. Los índices de una columna que ya existían
-- (`idx_appointments_clinica`, `_medico`, `_start_time`) no se tocan aquí,
-- así que no hay nada que restaurar.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de crear nada.
-- ---------------------------------------------------------------------
-- `CREATE INDEX IF NOT EXISTS` mira sólo el NOMBRE: si ya hubiera una
-- relación con ese nombre en `public` —un índice con otras columnas, uno
-- que quedó INVALID de un CONCURRENTLY abortado, o incluso una tabla—, se
-- saltaría en silencio y este archivo se leería como aplicado sin serlo.
-- Por eso, si el nombre existe, tiene que ser EXACTAMENTE el índice que
-- este archivo crearía; si no, excepción.
DO $$
DECLARE
  v_esperado  record;
  v_rel       record;
  v_cols      text[];
BEGIN
  -- (a) La tabla y sus cuatro columnas existen, y quien aplica puede
  --     crear índices sobre ella (hace falta ser su dueño).
  IF to_regclass('public.appointments') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: no existe public.appointments.';
  END IF;

  IF (SELECT count(*) FROM pg_attribute
       WHERE attrelid = 'public.appointments'::regclass
         AND attname IN ('clinica_id', 'medico_id', 'start_time', 'end_time')
         AND NOT attisdropped) <> 4 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: a public.appointments le falta alguna de clinica_id, medico_id, start_time, end_time.';
  END IF;

  IF NOT pg_has_role(current_user,
                     (SELECT relowner FROM pg_class WHERE oid = 'public.appointments'::regclass),
                     'USAGE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el rol % no es dueño de public.appointments (lo es %); CREATE INDEX fallaría.',
      current_user,
      pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = 'public.appointments'::regclass));
  END IF;

  -- (b) Si el nombre ya está tomado, tiene que ser este mismo índice.
  FOR v_esperado IN
    SELECT * FROM (VALUES
      ('idx_appointments_clinica_inicio',        ARRAY['clinica_id', 'start_time', 'end_time']),
      ('idx_appointments_clinica_medico_inicio', ARRAY['clinica_id', 'medico_id', 'start_time', 'end_time'])
    ) AS e(nombre, columnas)
  LOOP
    SELECT c.oid, c.relkind INTO v_rel
      FROM pg_class c
     WHERE c.relnamespace = 'public'::regnamespace
       AND c.relname = v_esperado.nombre;

    CONTINUE WHEN NOT FOUND;   -- nombre libre: el CREATE de abajo lo crea

    IF v_rel.relkind <> 'i' THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.% existe y no es un índice (relkind %).',
        v_esperado.nombre, v_rel.relkind;
    END IF;

    SELECT array_agg(a.attname::text ORDER BY k.ord) INTO v_cols
      FROM pg_index i
      CROSS JOIN LATERAL unnest(i.indkey::int2[]) WITH ORDINALITY AS k(attnum, ord)
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
     WHERE i.indexrelid = v_rel.oid;

    IF NOT EXISTS (
      SELECT 1
        FROM pg_index i
        JOIN pg_class ic ON ic.oid = i.indexrelid
        JOIN pg_am am    ON am.oid = ic.relam
       WHERE i.indexrelid = v_rel.oid
         AND i.indrelid   = 'public.appointments'::regclass
         AND am.amname    = 'btree'
         AND NOT i.indisunique
         AND i.indpred  IS NULL
         AND i.indexprs IS NULL
         AND i.indnatts = i.indnkeyatts
         AND v_cols = v_esperado.columnas
         -- Auditoría 2026-11-11: sin esto, un homónimo con las mismas columnas
         -- pero DESC o NULLS FIRST pasaba por idéntico sin servir al ORDER BY.
         AND 0 = ALL(i.indoption::int2[])
    ) THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: ya existe un índice public.% con OTRA definición (%). Revisar y, si sobra, borrarlo antes de correr esto.',
        v_esperado.nombre, pg_get_indexdef(v_rel.oid);
    END IF;

    IF NOT (SELECT indisvalid AND indisready FROM pg_index WHERE indexrelid = v_rel.oid) THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.% existe pero está INVALID (resto de un CREATE INDEX CONCURRENTLY abortado). DROP INDEX public.%; y volver a correr.',
        v_esperado.nombre, v_esperado.nombre;
    END IF;
    -- Existe, es idéntico y es válido: el CREATE de abajo es un no-op.
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 2 · Los índices.
-- ---------------------------------------------------------------------
-- Sirve a la agenda sin filtro de médico (vista «todos») y al conteo.
CREATE INDEX IF NOT EXISTS idx_appointments_clinica_inicio
  ON public.appointments USING btree (clinica_id, start_time, end_time);

-- Sirve a la agenda filtrada por un médico (`?medico_id=`).
CREATE INDEX IF NOT EXISTS idx_appointments_clinica_medico_inicio
  ON public.appointments USING btree (clinica_id, medico_id, start_time, end_time);

COMMENT ON INDEX public.idx_appointments_clinica_inicio IS
  'Ventana de la agenda: clinica_id = ? AND start_time < hasta AND end_time >= desde ORDER BY start_time (GET /api/appointments). end_time va en la llave para que el solape se compruebe en el índice y no en el heap. Medido en supabase/auditorias/A1.8-indices-rango-agenda.md; no reordenar las columnas sin volver a medir.';

COMMENT ON INDEX public.idx_appointments_clinica_medico_inicio IS
  'Ventana de la agenda filtrada por médico: clinica_id = ? AND medico_id = ? AND start_time < hasta AND end_time >= desde ORDER BY start_time. Medido en supabase/auditorias/A1.8-indices-rango-agenda.md.';

COMMIT;

-- ---------------------------------------------------------------------
-- 3 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'idx_appointments_clinica_inicio: columnas / válido / listo' AS comprobacion,
         (SELECT coalesce(max(
                   (SELECT string_agg(a.attname, ',' ORDER BY k.ord)
                      FROM unnest(i.indkey::int2[]) WITH ORDINALITY k(attnum, ord)
                      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum)
                   || ' / ' || i.indisvalid::text || ' / ' || i.indisready::text), 'AUSENTE')
            FROM pg_index i
           WHERE i.indexrelid = to_regclass('public.idx_appointments_clinica_inicio')
             AND i.indrelid = 'public.appointments'::regclass) AS valor,
         'clinica_id,start_time,end_time / true / true' AS esperado
  UNION ALL
  SELECT 2, 'idx_appointments_clinica_medico_inicio: columnas / válido / listo',
         (SELECT coalesce(max(
                   (SELECT string_agg(a.attname, ',' ORDER BY k.ord)
                      FROM unnest(i.indkey::int2[]) WITH ORDINALITY k(attnum, ord)
                      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum)
                   || ' / ' || i.indisvalid::text || ' / ' || i.indisready::text), 'AUSENTE')
            FROM pg_index i
           WHERE i.indexrelid = to_regclass('public.idx_appointments_clinica_medico_inicio')
             AND i.indrelid = 'public.appointments'::regclass),
         'clinica_id,medico_id,start_time,end_time / true / true'
  UNION ALL
  SELECT 3, 'índices de appointments que NO son válidos',
         (SELECT count(*)::text FROM pg_index
           WHERE indrelid = 'public.appointments'::regclass
             AND NOT (indisvalid AND indisready)),
         '0'
  UNION ALL
  SELECT 4, 'los tres índices sueltos siguen ahí',
         (SELECT count(*)::text FROM pg_indexes
           WHERE schemaname = 'public' AND tablename = 'appointments'
             AND indexname IN ('idx_appointments_clinica', 'idx_appointments_medico',
                               'idx_appointments_start_time')),
         '3'
  UNION ALL
  SELECT 5, 'las 5 policies de appointments, intactas',
         (SELECT count(*)::text FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'appointments'),
         '5'
) t
ORDER BY t.n;
