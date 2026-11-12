-- ═══════════════════════════════════════════════════════════════════════
-- Agenda B5 — consultorios.horario_propio: disponibilidad por médico y consultorio
-- Rama: feature/agenda-v2 (worktree feature/agenda-v2-b56) · Escrita: 2026-11-12
-- Riesgo estimado: BAJO (columna nueva con DEFAULT constante; ningún dato
-- existente cambia de significado; ninguna policy ni permiso se mueve).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-11-12
--   `docker exec -i supabase_db_app_ortointegra psql -U postgres
--   -v ON_ERROR_STOP=1 -f` del archivo completo (rejilla: 3 × OK + 2 INFO:
--   3 consultorios con algún día activo —los de la semilla local, que nadie
--   eligió como horario propio, así que false es cierto para ellos—, 0 con
--   horario_propio), y una segunda pasada igual: misma rejilla, sólo el NOTICE
--   «column "horario_propio" … already exists, skipping», y no-op comprobado
--   comparando antes y después las columnas de consultorios (tipo, NOT NULL,
--   DEFAULT, COMMENT), relacl, RLS, policies, disparadores, constraints y
--   count(*) de audit_log de consultorios (sin diferencias). Anotada a mano en
--   supabase_migrations.schema_migrations (versión 20261112140000, 7
--   sentencias partidas como las parte la CLI), por la misma razón que B0 y
--   A1.8.
--   Pruebas: supabase/pruebas-sql/b5_horario_propio.sql
--   (bash scripts/pruebas-sql.sh) y src/lib/tests/disponibilidad.test.ts.
--   Comprobación:
--     select format_type(atttypid, atttypmod), attnotnull from pg_attribute
--      where attrelid = 'public.consultorios'::regclass and attname = 'horario_propio';
--   → boolean, t.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR.
-- AUDITORÍA INDEPENDIENTE 2026-11-12: APTA (supabase/AUDITORIA-MIGRACIONES.md),
-- sin cambios en ninguna sentencia. Notas:
--   · El interruptor NO protege la columna en la base: consultorios_update es
--     por fila, así que el dueño puede escribir horario_propio directo por
--     PostgREST con el interruptor apagado. Aceptado: hoy es inerte (sólo la
--     leerá código que también exige el interruptor, y la rejilla no la lee),
--     y el dueño es quien decide su horario de todos modos. Si D llega a
--     ofrecer turnos con el interruptor apagado, revisarlo.
--   · La cabecera decía que Zod descartaba el campo con el interruptor
--     apagado; lo descarta el handler (corregido aquí, comentario).
--   · Propuso una dimensión 19 para AUDITORIA-MIGRACIONES.md («columnas nuevas
--     bajo una policy de fila ya permisiva, pensadas para un interruptor de
--     aplicación»); no se modifica ese archivo: se propone para la lista de
--     mejora_agendaV2.md §6-bis («Menores»), para que Angel decida.
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Cada consultorio es de UN médico, así que «disponibilidad por médico y
-- consultorio» (mejora_agendaV2.md §5, bloque B) es consultorios.horario.
-- Esa columna nace con los 7 días cerrados y ninguna pantalla la escribe:
-- hace falta saber si el médico la configuró. Una bandera explícita, y NO la
-- regla «si ningún día está activo, hereda el de la clínica»: con esa regla,
-- un consultorio cerrado a propósito heredaría el horario de la clínica y el
-- bloque D ofrecería turnos en un consultorio cerrado.
--   false (todas las filas existentes) = manda clinicas.horario_consulta, que
--         es lo que la agenda usa hoy;
--   true  = manda consultorios.horario, con un tramo por día y sin pausa
--         (decisión P6, la forma actual del horario).
-- false es VERDADERO para las filas existentes: nadie pudo elegir un horario
-- propio desde la app (la fila 2 del veredicto censa los que tienen algún día
-- activo, por si alguien lo escribió por API).
-- Quién la cambia: el dueño del consultorio, por la policy consultorios_update
-- que ya existe (P6). La auditoría ya la da audit_consultorios
-- (log_tabla_change). La rejilla de la agenda sigue pintando el horario de la
-- clínica (P6): nada de lo que se ve hoy cambia.
-- Quién la lee: horarioEfectivo() en src/lib/agenda/disponibilidad.ts, y sólo
-- con el interruptor de la agenda v2 encendido. Con él apagado, PATCH
-- /api/consultorios/[id] ignora el campo, como hoy (lo descarta el handler,
-- que sólo lo pasa a la base con el interruptor encendido; ver la nota 2 de
-- la auditoría).
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- ADD COLUMN con DEFAULT constante: sólo catálogo (PG ≥ 11), sin reescribir
-- la tabla. Toma ACCESS EXCLUSIVE sobre consultorios un instante (bloquea
-- también lecturas); lock_timeout de 5 s por la cola. No dispara
-- audit_consultorios ni ningún otro disparador de fila.
-- Orden respecto al código: PRIMERO esta migración. El código viejo no la
-- lee (leerConfigApp hace select('*') y el booleano viaja inocuo); el nuevo
-- sólo la escribe con el interruptor encendido, que exige B1 aplicada.
-- Alcance de los roles: no cambia en ninguna de las dos direcciones. La RLS
-- de consultorios no se toca: el dueño ya podía actualizar cualquier columna
-- de su consultorio, y ahora también ésta; el administrador sigue sin poder
-- tocar el consultorio de un invitado.
-- Contrato con spinus-consola: columna aditiva en public; no se renombra ni
-- cambia de tipo o significado nunca.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   ALTER TABLE public.consultorios DROP COLUMN IF EXISTS horario_propio;
-- Pierde qué consultorios eligieron horario propio (consultorios.horario se
-- conserva). Ajustar antes la vista de spinus-consola si la lee. Respaldar:
--   CREATE TABLE respaldos.consultorios_horario_propio_AAAAMMDD AS
--     SELECT id, horario_propio FROM public.consultorios WHERE horario_propio;
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v record;
BEGIN
  IF to_regclass('public.consultorios') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: no existe public.consultorios.';
  END IF;
  IF NOT pg_has_role(current_user,
                     (SELECT relowner FROM pg_class WHERE oid = 'public.consultorios'::regclass), 'USAGE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el rol % no es dueño de public.consultorios (lo es %).',
      current_user, pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = 'public.consultorios'::regclass));
  END IF;
  -- Replay: ADD COLUMN IF NOT EXISTS mira sólo el nombre. Si ya existe, tiene
  -- que ser ESTA columna (boolean, NOT NULL, DEFAULT false); si no, no se toca.
  SELECT a.atttypid, a.attnotnull, pg_get_expr(d.adbin, d.adrelid) AS def INTO v
    FROM pg_attribute a
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
   WHERE a.attrelid = 'public.consultorios'::regclass AND a.attname = 'horario_propio' AND NOT a.attisdropped;
  IF FOUND AND NOT (v.atttypid = 'boolean'::regtype AND v.attnotnull AND v.def IS NOT DISTINCT FROM 'false') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: consultorios.horario_propio ya existe con otra definición. No se toca.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · La columna y su convenio (el COMMENT es lo único que viaja con la base).
-- ---------------------------------------------------------------------
ALTER TABLE public.consultorios ADD COLUMN IF NOT EXISTS horario_propio boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.consultorios.horario_propio IS
  'false = la disponibilidad de este consultorio es clinicas.horario_consulta; true = manda consultorios.horario (un tramo por día, sin pausa; con true y todos los días inactivos el consultorio está CERRADO, no hereda). Lo resuelve horarioEfectivo() en src/lib/agenda/disponibilidad.ts. La rejilla de la agenda sigue pintando el horario de la clínica.';

COMMIT;

-- ---------------------------------------------------------------------
-- 3 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO'
            WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'horario_propio: tipo / not null / default' AS comprobacion,
         coalesce((SELECT format_type(a.atttypid, a.atttypmod) || ' / ' || a.attnotnull::text || ' / '
                          || coalesce(pg_get_expr(d.adbin, d.adrelid), '-')
                     FROM pg_attribute a
                     LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
                    WHERE a.attrelid = 'public.consultorios'::regclass AND a.attname = 'horario_propio'
                      AND NOT a.attisdropped), 'AUSENTE') AS valor,
         'boolean / true / false' AS esperado
  UNION ALL
  SELECT 2, 'consultorios con algún día activo en horario (censo; hoy heredan el de la clínica)',
         (SELECT count(*)::text FROM public.consultorios c
           WHERE jsonb_typeof(c.horario) = 'object'
             AND EXISTS (SELECT 1 FROM jsonb_each(c.horario) d
                          WHERE jsonb_typeof(d.value) = 'object' AND d.value ->> 'activo' = 'true')),
         NULL
  UNION ALL
  SELECT 3, 'consultorios con horario_propio = true',
         (SELECT count(*)::text FROM public.consultorios WHERE horario_propio),
         NULL
  UNION ALL
  SELECT 4, 'policies de consultorios, intactas (gates_insert, insert, select, update)',
         (SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'consultorios'),
         'consultorios_gates_insert,consultorios_insert,consultorios_select,consultorios_update'
  UNION ALL
  SELECT 5, 'COMMENT del convenio presente',
         (SELECT (col_description('public.consultorios'::regclass, a.attnum) LIKE 'false = la disponibilidad%')::text
            FROM pg_attribute a
           WHERE a.attrelid = 'public.consultorios'::regclass AND a.attname = 'horario_propio' AND NOT a.attisdropped),
         'true'
) t
ORDER BY t.n;
