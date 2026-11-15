-- ═══════════════════════════════════════════════════════════════════════
-- Agenda · tanda «diseño, duración y horarios», punto 10 de Angel — cada
-- consultorio sin horario propio hereda, UNA vez, el horario de su clínica
-- Rama: feature/agenda-v2-g4 · Escrita: 2026-11-14
-- Riesgo estimado: BAJO (copia de datos en consultorios con respaldo previo
-- en respaldos.*; ninguna columna, policy, permiso ni función cambia; el
-- horario efectivo de cada consultorio es el mismo antes y después).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-11-14
--   Antes, en seco dos pasadas dentro de una transacción con ROLLBACK (rejilla
--   8 filas OK/INFO las dos). Después `docker exec -i supabase_db_app_ortointegra
--   psql -U postgres -v ON_ERROR_STOP=1 -f` del archivo completo, dos pasadas
--   seguidas: rejilla idéntica (7 × OK + 1 INFO: 4 respaldados, los 4
--   consultorios de la semilla local); la segunda sólo con el NOTICE «relation
--   … already exists, skipping», INSERT 0 0 y UPDATE 0. Huella md5 de
--   (id, horario, horario_propio) de consultorios: cambia en la pasada 1 y no en
--   la 2; la de clinicas.horario_consulta no cambia en ninguna; las filas UPDATE
--   de 'system' en audit_log de consultorios suben 4 en la pasada 1 y 0 en la
--   2. Anotada a mano en supabase_migrations.schema_migrations (versión
--   20261119130000, sin statements). Prueba: e2e/agenda-g4-herencia-horario.e2e.ts
--   (corre el cuerpo REAL del archivo dos veces en una transacción que se
--   deshace; en rojo sin `AND NOT k.horario_propio` y sin el INSERT del respaldo).
--   ⚠️ La semilla de las e2e recrea las clínicas Semilla A y B con
--   horario_propio = false: tras sembrar, la base local vuelve a estar «sin
--   heredar» para ellas (es inocuo: horarioEfectivo da lo mismo).
--   Tras la auditoría (pre-vuelo 1.4 acotado), el archivo FINAL se ensayó dos
--   veces en seco con ROLLBACK (UPDATE 3 / UPDATE 0) y se aplicó una vez más sobre
--   la semilla ya resembrada por otra corrida (INSERT 0 4, UPDATE 4: los
--   consultorios recreados; rejilla 7 × OK + 1 INFO).
--   Comprobación:
--     select count(*) from public.consultorios where not horario_propio;  → 0
--     select to_regclass('respaldos.consultorios_horario_20261119');      → la tabla
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de B5, 20261112140000).
-- AUDITORÍA INDEPENDIENTE 2026-11-14 (otro modelo, las 18 dimensiones de
--   supabase/AUDITORIA-MIGRACIONES.md, con ensayos en vivo dentro de ROLLBACK):
--   APTA CON CAMBIOS → aplicado el único cambio pedido: el pre-vuelo 1.4 contaba
--   a TODOS los médicos y abortaba por uno que el UPDATE nunca toca (reproducido
--   por el auditor); ahora sólo a los que tienen alguna fila sin horario propio.
--   Nota no bloqueante (en VUELTA ATRÁS): el respaldo es de la PRIMERA copia.
--   Propuso una dimensión 19 para AUDITORIA-MIGRACIONES.md (pre-vuelos que
--   reimplementan la condición de un disparador sobre más filas de las que la
--   sentencia toca); no se modifica ese archivo: va a las notas para Angel.
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Punto 10 de Angel (2026-11-14): «El horario de la clínica desaparece como
-- ajuste. La única fuente es el horario de cada consultorio: sus días y horas
-- de atención. Los consultorios que hoy no tengan horario propio heredan, una
-- sola vez, el horario actual de su clínica como punto de partida. No borres
-- la columna clinicas.horario_consulta: se queda sin usar.»
--
-- Hoy, con horario_propio = false (el valor de todos los consultorios que
-- nadie configuró), horarioEfectivo() (src/lib/agenda/disponibilidad.ts) da
-- el de la clínica. Esta migración lo hace explícito: copia
-- clinicas.horario_consulta a consultorios.horario y pone horario_propio =
-- true. El horario EFECTIVO no cambia para ninguna fila (la normalización de
-- horarioEfectivo es la misma en las dos ramas), así que el enlace de
-- reserva, la pantalla de configuración y la agenda dicen lo mismo que antes
-- del cambio; lo que cambia es que, desde aquí, editar el horario de la
-- clínica ya no mueve el de ningún consultorio.
--
-- ═══ QUÉ HACE ══════════════════════════════════════════════════════════
-- 1. Pre-vuelo (aborta antes de escribir nada).
-- 2. Respaldo: respaldos.consultorios_horario_20261119 guarda (id,
--    clinica_id, horario, horario_propio) de cada fila que se va a tocar,
--    ANTES de tocarla. Sin privilegios para anon, authenticated ni
--    service_role, y con RLS; el esquema respaldos no se expone a PostgREST.
--    Mismo patrón que respaldos.appointments_gcal_20260815.
-- 3. La herencia: UPDATE de las filas con horario_propio = false (también las
--    archivadas: si se reactivan, conservan el punto de partida). El valor
--    previo de consultorios.horario en esas filas era INERTE: con
--    horario_propio = false nada lo lee (horarioEfectivo lo ignora y la
--    pantalla de configuración enseña el de la clínica); queda en el respaldo.
-- 4. El COMMENT de horario_propio, que decía «La rejilla de la agenda sigue
--    pintando el horario de la clínica», y ya no es verdad con la v2.
--
-- ═══ IDEMPOTENCIA ══════════════════════════════════════════════════════
-- (a) Dos veces seguidas: la segunda no encuentra filas con horario_propio =
--     false; el respaldo es ON CONFLICT DO NOTHING; CREATE TABLE IF NOT EXISTS.
--     No-op, misma rejilla. Un consultorio con horario propio NUNCA se toca.
-- (b) Replay meses después: los consultorios creados entretanto con
--     horario_propio = false heredan el horario de la clínica tal como esté
--     — el mismo que ya usaban por horarioEfectivo—, así que tampoco cambia
--     ningún horario efectivo.
--
-- ═══ CLÍNICAS CON EL INTERRUPTOR APAGADO ═══════════════════════════════
-- La copia es para TODAS las clínicas, también las que no tienen la agenda v2
-- encendida. No cambia nada de lo que ven: con el interruptor apagado ningún
-- código lee horario_propio ni consultorios.horario (horarioEfectivo sólo lo
-- llaman la reserva por enlace, la configuración de la agenda y la rejilla v2,
-- las tres detrás de agendaV2Encendida; la agenda apagada pinta
-- clinicas.horario_consulta y edita con el modal de siempre). Al encender la
-- v2, cada consultorio ya tiene su horario de partida.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Bloqueos (lock_timeout 5 s): ROW EXCLUSIVE sobre consultorios por el
--   UPDATE (no bloquea lecturas); COMMENT ON COLUMN toma SHARE UPDATE
--   EXCLUSIVE un instante. Disparadores que corren: audit_consultorios (una
--   fila UPDATE por consultorio en audit_log, user_id 'system'),
--   trg_consultorios_updated_at, trg_consultorios_cap_10 (no-op: no cambia
--   activo) y el de existencia del predeterminado (por eso el pre-vuelo 1.4).
-- Orden respecto al código: cualquiera. El código viejo (rejilla T2) con la
--   v2 encendida pintaría el consultorio activo, que ahora tiene el mismo
--   horario que la clínica: lo mismo. El nuevo sin esta migración usa
--   horarioEfectivo, que cae al de la clínica: lo mismo.
-- Alcance de los roles: no cambia en ninguna de las dos direcciones.
-- Contrato con spinus-consola: clinicas.horario_consulta no se toca (ni
--   valor, ni tipo, ni nombre); en consultorios sólo cambian valores.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
-- Devuelve el valor previo SÓLO a las filas que nadie editó después (su
-- updated_at sigue siendo el de la copia):
--   UPDATE public.consultorios k
--      SET horario = r.horario, horario_propio = r.horario_propio
--     FROM respaldos.consultorios_horario_20261119 r
--    WHERE r.id = k.id AND k.updated_at = r.respaldado_en;
-- ⚠️ El respaldo guarda el valor de la PRIMERA copia (ON CONFLICT DO NOTHING): si
-- un consultorio volvió a «usar el de la clínica» y el archivo se reaplicó, su
-- updated_at ya no coincide y esta vuelta atrás no lo toca (se queda como está;
-- no se pisa con un valor más viejo).
-- El respaldo se puede borrar cuando ya no haga falta:
--   DROP TABLE respaldos.consultorios_horario_20261119;
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de escribir nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_n integer;
BEGIN
  -- 1.1 Las tres columnas, con su tipo (B5 aplicada).
  IF (SELECT count(*) FROM pg_attribute
       WHERE NOT attisdropped AND attnotnull
         AND (attrelid, attname, atttypid) IN (('public.consultorios'::regclass, 'horario_propio', 'boolean'::regtype),
                                               ('public.consultorios'::regclass, 'horario', 'jsonb'::regtype),
                                               ('public.clinicas'::regclass, 'horario_consulta', 'jsonb'::regtype))) <> 3 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: faltan consultorios.horario_propio (B5, 20261112140000), consultorios.horario o clinicas.horario_consulta como jsonb/boolean NOT NULL.';
  END IF;
  -- 1.2 Propiedad.
  IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = 'public.consultorios'::regclass), 'USAGE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el rol % no es dueño de public.consultorios.', current_user;
  END IF;
  -- 1.3 El esquema del respaldo, y si la tabla ya existe, que sea ésta.
  IF to_regnamespace('respaldos') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: no existe el esquema respaldos (créalo antes: CREATE SCHEMA respaldos;).';
  END IF;
  IF to_regclass('respaldos.consultorios_horario_20261119') IS NOT NULL
     AND (SELECT string_agg(attname || ':' || format_type(atttypid, atttypmod), ',' ORDER BY attnum) FROM pg_attribute
           WHERE attrelid = to_regclass('respaldos.consultorios_horario_20261119') AND attnum > 0 AND NOT attisdropped)
         <> 'id:uuid,clinica_id:uuid,horario:jsonb,horario_propio:boolean,respaldado_en:timestamp with time zone' THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: respaldos.consultorios_horario_20261119 ya existe con otra forma. No se toca.';
  END IF;
  -- 1.4 El disparador de existencia del predeterminado revisa a cada médico TOCADO (los de
  --     old_consultorios: los que tienen alguna fila con horario_propio = false): si alguno
  --     ya tiene consultorios activos sin predeterminado, el UPDATE abortaría. Sólo ésos:
  --     una inconsistencia de un médico que no se toca no bloquea la migración.
  SELECT count(*) INTO v_n FROM (
    SELECT medico_id FROM public.consultorios
     WHERE medico_id IN (SELECT medico_id FROM public.consultorios WHERE NOT horario_propio)
     GROUP BY medico_id
    HAVING count(*) FILTER (WHERE activo) >= 1 AND count(*) FILTER (WHERE activo AND es_default) = 0) m;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: % médico(s) con consultorios activos y ninguno predeterminado; enforce_consultorio_default_existencia abortaría la copia. Corrígelo antes.', v_n;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · El respaldo, ANTES de tocar nada.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS respaldos.consultorios_horario_20261119 (
  id             uuid PRIMARY KEY,
  clinica_id     uuid NOT NULL,
  horario        jsonb NOT NULL,
  horario_propio boolean NOT NULL,
  respaldado_en  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE respaldos.consultorios_horario_20261119 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE respaldos.consultorios_horario_20261119 FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON TABLE respaldos.consultorios_horario_20261119 IS
  'consultorios.horario y horario_propio de cada consultorio sin horario propio, ANTES de heredar el de su clínica (20261119130000, punto 10 de Angel). respaldado_en es el instante de la copia: una fila de consultorios con updated_at igual no se ha editado desde entonces (ver VUELTA ATRÁS en el archivo).';

INSERT INTO respaldos.consultorios_horario_20261119 (id, clinica_id, horario, horario_propio)
SELECT k.id, k.clinica_id, k.horario, k.horario_propio
  FROM public.consultorios k
 WHERE NOT k.horario_propio
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 3 · La herencia: sólo los que NO tienen horario propio.
-- ---------------------------------------------------------------------
UPDATE public.consultorios k
   SET horario = c.horario_consulta,
       horario_propio = true
  FROM public.clinicas c
 WHERE c.id = k.clinica_id
   AND NOT k.horario_propio;

-- ---------------------------------------------------------------------
-- 4 · El convenio, donde viaja con la base.
-- ---------------------------------------------------------------------
COMMENT ON COLUMN public.consultorios.horario_propio IS
  'false = la disponibilidad de este consultorio es clinicas.horario_consulta; true = manda consultorios.horario (un tramo por día, sin pausa; con true y todos los días inactivos el consultorio está CERRADO, no hereda). Lo resuelve horarioEfectivo() en src/lib/agenda/disponibilidad.ts. Desde 20261119130000 todos los consultorios existentes heredaron el horario de su clínica (true) y, con la agenda v2, la rejilla, los avisos y la reserva usan el de cada consultorio; clinicas.horario_consulta sólo queda como respaldo de los consultorios nuevos que sigan en false.';

COMMIT;

-- ---------------------------------------------------------------------
-- 5 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO'
            WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'consultorios con horario_propio = false (deben quedar 0)' AS comprobacion,
         (SELECT count(*)::text FROM public.consultorios WHERE NOT horario_propio) AS valor,
         '0' AS esperado
  UNION ALL
  SELECT 2, 'consultorios respaldados (los que heredaron, en esta pasada o en una anterior)',
         (SELECT count(*)::text FROM respaldos.consultorios_horario_20261119), NULL
  UNION ALL
  SELECT 3, 'heredados sin editar desde la copia cuyo horario NO es el de su clínica (deben ser 0)',
         (SELECT count(*)::text FROM respaldos.consultorios_horario_20261119 r
            JOIN public.consultorios k ON k.id = r.id
            JOIN public.clinicas c ON c.id = k.clinica_id
           WHERE k.updated_at = r.respaldado_en
             AND (k.horario IS DISTINCT FROM c.horario_consulta OR NOT k.horario_propio)),
         '0'
  UNION ALL
  SELECT 4, 'heredados sin fila UPDATE de la copia en audit_log (deben ser 0)',
         (SELECT count(*)::text FROM respaldos.consultorios_horario_20261119 r
            JOIN public.consultorios k ON k.id = r.id
           WHERE k.updated_at = r.respaldado_en
             AND NOT EXISTS (SELECT 1 FROM public.audit_log a
                              WHERE a.tabla = 'consultorios' AND a.accion = 'UPDATE'
                                AND a.registro_id = r.id AND a.created_at = r.respaldado_en)),
         '0'
  UNION ALL
  SELECT 5, 'respaldo: privilegios de anon / authenticated / service_role, y RLS',
         (SELECT has_table_privilege('anon', 'respaldos.consultorios_horario_20261119', 'SELECT')::text || ' / '
                 || has_table_privilege('authenticated', 'respaldos.consultorios_horario_20261119', 'SELECT')::text || ' / '
                 || has_table_privilege('service_role', 'respaldos.consultorios_horario_20261119', 'SELECT')::text || ' / '
                 || relrowsecurity::text
            FROM pg_class WHERE oid = 'respaldos.consultorios_horario_20261119'::regclass),
         'false / false / false / true'
  UNION ALL
  SELECT 6, 'clinicas.horario_consulta sigue ahí (jsonb NOT NULL)',
         coalesce((SELECT format_type(atttypid, atttypmod) || ' / ' || attnotnull::text FROM pg_attribute
                    WHERE attrelid = 'public.clinicas'::regclass AND attname = 'horario_consulta' AND NOT attisdropped), 'AUSENTE'),
         'jsonb / true'
  UNION ALL
  SELECT 7, 'policies de consultorios, intactas',
         (SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'consultorios'),
         'consultorios_gates_insert,consultorios_insert,consultorios_select,consultorios_update'
  UNION ALL
  SELECT 8, 'COMMENT nuevo de horario_propio presente',
         (SELECT (col_description('public.consultorios'::regclass, a.attnum) LIKE '%Desde 20261119130000%')::text
            FROM pg_attribute a
           WHERE a.attrelid = 'public.consultorios'::regclass AND a.attname = 'horario_propio' AND NOT a.attisdropped),
         'true'
) t
ORDER BY t.n;
