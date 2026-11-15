-- ═══════════════════════════════════════════════════════════════════════
-- Agenda G2 — la duración de la consulta de cada médico (su tipo de cita
-- «principal»), una duración distinta por consultorio, el médico invitado
-- crea SUS tipos (policy tipos_cita_insert) y reserva_contexto entrega los
-- tipos con su consultorio.
-- Rama: feature/agenda-v2-g2 · Escrita: 2026-11-14 · Riesgo: MEDIO (dos
-- columnas, dos CHECK, una FK y dos índices sobre tipos_cita; cambia UNA
-- policy existente —autorizada por Angel— y reemplaza reserva_contexto).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-11-14
--   Antes, en seco con ROLLBACK. `docker exec -i supabase_db_app_ortointegra
--   psql -U postgres -v ON_ERROR_STOP=1 -f` del archivo completo dos veces
--   (rejilla 8 × OK + 1 INFO las dos; la segunda, sólo NOTICE «already
--   exists, skipping»). Anotada a mano en supabase_migrations.schema_migrations
--   (versión 20261119120000).
--   Pruebas: supabase/pruebas-sql/g2_duracion_consulta.sql (8 casos; en rojo
--   con la policy de B6, con una policy sin «sólo los suyos», con
--   validar_tipo_cita_consultorio() vacía y con el reserva_contexto de D3).
--   Comprobación:
--     select count(*) from pg_attribute where attrelid = 'public.tipos_cita'::regclass
--        and attname in ('consultorio_id', 'principal') and not attisdropped;
--   → 2;  select md5(prosrc) from pg_proc where oid = 'public.reserva_contexto(text, text, text)'::regprocedure;
--   → 8d81bc662a7312256fefea8494458f4f.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de B5, B6 y D3; con el
--   conjunto de la agenda v2).
-- AUDITORÍA INDEPENDIENTE 2026-11-14 (otro modelo, supabase/AUDITORIA-
--   MIGRACIONES.md, las 18 dimensiones, esquema leído en vivo): APTA. Notas:
--   (1) esta línea de ESTADO estaba sin rellenar (rellenada); (2) el 23514
--   de validar_tipo_cita_consultorio() sale también cuando el consultorio SÍ
--   es del médico pero quien escribe no lo ve por la RLS (el administrador
--   con el de otro médico): falla cerrado, el texto puede despistar; (3) los
--   dos CHECK nuevos se rehacen con DROP + ADD sin comparar la fórmula previa
--   (no existían antes de G2; riesgo remoto, no se añadió); (4) «decenas de
--   filas» de tipos_cita en producción no está verificado; y el «pierde» del
--   administrador es un límite sobre una capacidad nueva, no una pérdida.
--   Dimensión 2 declarada no re-verificada (mismo BEGIN/COMMIT que B6 y D3).
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Lo pidió Angel (tanda «diseño, duración y horarios», puntos 7 y 9):
--   7. «Tipo de cita» deja de ser un requisito visible: en los primeros pasos
--      se le pregunta a cada médico cuánto dura su consulta y con eso se crea
--      su plantilla por dentro; no nace ninguna con un valor fijo; esa
--      duración vale para todos sus consultorios; en el horario de cada
--      consultorio hay una opción discreta para una duración distinta solo
--      ahí; quien quiera más de una duración, agrega más tipos.
--   9. El médico invitado define su propia duración y sus propios tipos, sólo
--      los suyos: «Eso exige cambiar la policy tipos_cita_insert: te autorizo
--      a hacerlo, en una migración nueva con su auditoría, sin tocar ninguna
--      otra policy.»
-- El modelo, lo mínimo sobre B6 (sin tabla nueva):
--   · La duración de la consulta de un médico ES un tipo de cita suyo
--     (medico_id = él) marcado principal = true, sin consultorio. Uno activo
--     por médico (índice único parcial).
--   · La duración distinta en UN consultorio es OTRO tipo principal del mismo
--     médico con consultorio_id = ese consultorio (uno activo por consultorio).
--     Allí sustituye al principal general; en los demás no existe. Sólo los
--     principales llevan consultorio (CHECK): los tipos «de más» valen en
--     todos los consultorios, como hoy.
--   · Por qué en tipos_cita y no una columna en consultorios: la reserva por
--     enlace calcula el fin con la duración DEL TIPO dentro de
--     reservar_por_enlace (v_fin := p_inicio + duracion_min). Con la duración
--     del consultorio en otra tabla habría que cambiar la RPC de la garantía
--     atómica; así la RPC no se toca y la cita guarda la instantánea del
--     nombre como siempre.
--   · El nombre del principal por consultorio repite el del general
--     («Consulta»): el índice de nombre único deja de mirar las filas con
--     consultorio (las cubre el índice del principal).
--   · reserva_contexto añade a cada tipo consultorio_id y principal. CONVENIO
--     (dimensión 16): qué tipos valen en qué consultorio lo decide el
--     servidor ANTES de llamar a reservar_por_enlace (tiposDelConsultorio en
--     src/lib/agenda/tiposCita.ts, rutas de /api/reservar/[codigo]); la RPC
--     sigue aceptando cualquier tipo activo de la clínica o del médico.
--     Va en el COMMENT de la columna y de la función.
-- La policy tipos_cita_insert: antes sólo el administrador de la clínica;
-- ahora también un MÉDICO para sí mismo (medico_id = auth.uid()), nunca de
-- toda la clínica ni de otro médico. La secretaria, como hoy (no). Sin puerta
-- de suscripción, como B6 (tipos_cita no la lleva a propósito).
-- ⚠️ NO SE TOCA tipos_cita_update (sigue sólo para el administrador): el
-- invitado crea su duración pero NO puede cambiarla ni archivarla. Cambiar
-- esa policy no está autorizado; queda propuesto aparte (notas de G2).
-- validar_tipo_cita_consultorio() (INVOKER, nueva): el consultorio de un tipo
-- es de ESE médico y de ESA clínica. Lee consultorios con la RLS de quien
-- escribe: el médico ve los suyos; el administrador NO ve los de otro médico
-- (consultorios_select), así que no puede ponerle a otro una duración por
-- consultorio (falla cerrado, 23514). service_role/postgres lo ven todo.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Bloqueos (lock_timeout de 5 s): ADD COLUMN ×2 sobre tipos_cita (ACCESS
-- EXCLUSIVE un instante; el DEFAULT false es constante, no reescribe), FK
-- nueva (SHARE ROW EXCLUSIVE sobre consultorios y tipos_cita mientras valida:
-- tipos_cita tiene decenas de filas), CHECK (ACCESS EXCLUSIVE sobre
-- tipos_cita), DROP/CREATE INDEX (tipos_cita), DROP/CREATE POLICY y CREATE
-- OR REPLACE FUNCTION (catálogo). Nada sobre appointments ni pacientes.
-- Orden respecto al código: PRIMERO esta migración. El código nuevo pide
-- tipos_cita.consultorio_id/principal (sólo con la v2 encendida); al revés,
-- PostgREST daría 400 en la pantalla de configuración y la agenda no sabría
-- las duraciones. El código viejo contra el esquema nuevo no cambia: las
-- columnas nuevas tienen valor por omisión y reserva_contexto sólo AÑADE
-- claves (ContextoSchema de zod ignora las desconocidas).
-- Alcance de los roles:
--   gana   — el médico (dueño o invitado): crear tipos de cita SUYOS
--            (medico_id = él), también principales y por consultorio de SUS
--            consultorios. Nada de toda la clínica ni de otros médicos.
--   pierde — nadie. El administrador sigue creando de toda la clínica y de
--            cualquier médico; ahora no puede crear un tipo POR CONSULTORIO
--            de otro médico (columna nueva: antes no existía).
--   La secretaria no gana ni pierde. tipos_cita_select y tipos_cita_update
--   no cambian.
-- Contrato con spinus-consola: columnas aditivas; ninguna cambia de nombre,
-- tipo ni significado.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   Respaldar antes: CREATE TABLE respaldos.tipos_cita_AAAAMMDD AS SELECT * FROM public.tipos_cita;
--   Archivar o rehacer a mano los principales por consultorio (si hay dos
--   «Consulta» activos del mismo médico, el índice viejo no se podrá crear).
--   DROP TRIGGER IF EXISTS trg_tipos_cita_consultorio ON public.tipos_cita;
--   DROP FUNCTION IF EXISTS public.validar_tipo_cita_consultorio();
--   DROP INDEX IF EXISTS public.tipos_cita_principal_unico;
--   DROP INDEX IF EXISTS public.tipos_cita_consultorio;
--   DROP INDEX IF EXISTS public.tipos_cita_nombre_activo_unico;  -- y recrearlo como en B6
--   ALTER TABLE public.tipos_cita DROP CONSTRAINT IF EXISTS tipos_cita_consultorio_check,
--     DROP CONSTRAINT IF EXISTS tipos_cita_principal_check,
--     DROP CONSTRAINT IF EXISTS tipos_cita_consultorio_id_fkey,
--     DROP COLUMN IF EXISTS consultorio_id, DROP COLUMN IF EXISTS principal;
--   La policy tipos_cita_insert y reserva_contexto: volver a pegar las de
--   20261112150000 (B6) y 20261114140000 (D3). Se pierde qué tipo era la
--   duración de cada médico (las citas conservan su tipo y su nombre).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  c_ctx_d3  CONSTANT text := '3c2c9c91414e8fe58fe4504e58ccdde9';
  c_ctx_g2  CONSTANT text := '8d81bc662a7312256fefea8494458f4f';
  c_ins_b6  CONSTANT text := '(soy_admin_de_clinica() AND (clinica_id = get_clinica_id()))';
  c_ins_g2  CONSTANT text := '((clinica_id = get_clinica_id()) AND (soy_admin_de_clinica() OR ((medico_id = auth.uid()) AND (get_my_role() = ''medico''::text))))';
  c_upd_b6  CONSTANT text := '(soy_admin_de_clinica() AND (clinica_id = get_clinica_id()))';
  c_cols_b6 CONSTANT text[] := ARRAY['id', 'clinica_id', 'medico_id', 'nombre', 'duracion_min', 'color', 'activo', 'created_at', 'updated_at'];
  v_ctx  oid := to_regprocedure('public.reserva_contexto(text, text, text)');
  v_cols text[];
  v_md5  text;
  v_tabla text;
BEGIN
  IF to_regclass('public.tipos_cita') IS NULL OR to_regclass('public.consultorios') IS NULL OR v_ctx IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta tipos_cita (B6), consultorios o reserva_contexto (D3).';
  END IF;
  FOREACH v_tabla IN ARRAY ARRAY['public.tipos_cita', 'public.consultorios'] LOOP
    IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = v_tabla::regclass), 'USAGE') THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: el rol % no es dueño de %.', current_user, v_tabla;
    END IF;
  END LOOP;
  IF NOT (SELECT bool_and(prosecdef) FROM pg_proc
           WHERE oid IN (to_regprocedure('public.get_clinica_id()'), to_regprocedure('public.soy_admin_de_clinica()'),
                         to_regprocedure('public.get_my_role()'))) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: get_clinica_id(), soy_admin_de_clinica() o get_my_role() no es SECURITY DEFINER (recursión en la policy).';
  END IF;
  -- Las columnas: las de B6, o las de B6 más las dos de aquí con su tipo (replay).
  SELECT array_agg(attname::text) INTO v_cols FROM pg_attribute
   WHERE attrelid = 'public.tipos_cita'::regclass AND attnum > 0 AND NOT attisdropped;
  IF NOT (v_cols @> c_cols_b6 AND v_cols <@ (c_cols_b6 || ARRAY['consultorio_id', 'principal'])) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: tipos_cita tiene columnas inesperadas (%). No se toca.', v_cols;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.tipos_cita'::regclass AND NOT attisdropped
              AND ((attname = 'consultorio_id' AND atttypid <> 'uuid'::regtype)
                OR (attname = 'principal' AND (atttypid <> 'boolean'::regtype OR NOT attnotnull)))) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: tipos_cita.consultorio_id / principal ya existen con otro tipo.';
  END IF;
  IF (SELECT atttypid FROM pg_attribute WHERE attrelid = 'public.consultorios'::regclass AND attname = 'id' AND NOT attisdropped)
     IS DISTINCT FROM 'uuid'::regtype THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: consultorios.id no es uuid.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.tipos_cita'::regclass AND conname = 'tipos_cita_consultorio_id_fkey'
              AND (confrelid <> 'public.consultorios'::regclass OR confdeltype <> 'r')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: tipos_cita_consultorio_id_fkey existe con otra definición.';
  END IF;
  -- Las dos policies que se leen: la de INSERT tiene que ser la de B6 o la de
  -- aquí; la de UPDATE, la de B6 (esta migración no la toca y su veredicto lo dice).
  IF (SELECT pg_get_expr(polwithcheck, polrelid) FROM pg_policy
       WHERE polrelid = 'public.tipos_cita'::regclass AND polname = 'tipos_cita_insert') NOT IN (c_ins_b6, c_ins_g2) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: tipos_cita_insert no es la de B6 ni la de G2 (%). Alguien la cambió.',
      (SELECT pg_get_expr(polwithcheck, polrelid) FROM pg_policy WHERE polrelid = 'public.tipos_cita'::regclass AND polname = 'tipos_cita_insert');
  END IF;
  IF (SELECT pg_get_expr(polqual, polrelid) FROM pg_policy
       WHERE polrelid = 'public.tipos_cita'::regclass AND polname = 'tipos_cita_update') IS DISTINCT FROM c_upd_b6 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: tipos_cita_update ya no es la de B6. Revisar antes de seguir.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE oid = v_ctx AND prosecdef) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: reserva_contexto es SECURITY DEFINER; D3 la dejó INVOKER.';
  END IF;
  SELECT md5(prosrc) INTO v_md5 FROM pg_proc WHERE oid = v_ctx;
  IF v_md5 NOT IN (c_ctx_d3, c_ctx_g2) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: reserva_contexto no es el cuerpo de D3 ni el de G2 (md5 %). Revisar antes de pisarla.', v_md5;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('public.validar_tipo_cita_consultorio()') AND prosecdef) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: validar_tipo_cita_consultorio() existe como SECURITY DEFINER; tiene que ser invoker.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · Las dos columnas, su FK, sus CHECK y sus índices.
-- ---------------------------------------------------------------------
ALTER TABLE public.tipos_cita ADD COLUMN IF NOT EXISTS consultorio_id uuid;
ALTER TABLE public.tipos_cita ADD COLUMN IF NOT EXISTS principal boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.tipos_cita'::regclass AND conname = 'tipos_cita_consultorio_id_fkey') THEN
    ALTER TABLE public.tipos_cita ADD CONSTRAINT tipos_cita_consultorio_id_fkey
      FOREIGN KEY (consultorio_id) REFERENCES public.consultorios(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- DROP + ADD: con las filas de hoy (todas principal = false, sin consultorio)
-- se cumplen siempre, y una segunda pasada deja la misma fórmula.
ALTER TABLE public.tipos_cita DROP CONSTRAINT IF EXISTS tipos_cita_principal_check;
ALTER TABLE public.tipos_cita ADD CONSTRAINT tipos_cita_principal_check CHECK (NOT principal OR medico_id IS NOT NULL);
ALTER TABLE public.tipos_cita DROP CONSTRAINT IF EXISTS tipos_cita_consultorio_check;
ALTER TABLE public.tipos_cita ADD CONSTRAINT tipos_cita_consultorio_check CHECK (consultorio_id IS NULL OR principal);

-- El nombre único deja de mirar las filas por consultorio (repiten el nombre
-- del principal general; las cubre tipos_cita_principal_unico).
DROP INDEX IF EXISTS public.tipos_cita_nombre_activo_unico;
CREATE UNIQUE INDEX tipos_cita_nombre_activo_unico ON public.tipos_cita
  (clinica_id, coalesce(medico_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(nombre)))
  WHERE activo AND consultorio_id IS NULL;
-- Un principal activo por médico, y uno por médico y consultorio. La llave
-- empieza por clinica_id: un conflicto no delata nada de otra clínica.
CREATE UNIQUE INDEX IF NOT EXISTS tipos_cita_principal_unico ON public.tipos_cita
  (clinica_id, medico_id, coalesce(consultorio_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE activo AND principal;
-- El que usa la FK al comprobar RESTRICT desde consultorios.
CREATE INDEX IF NOT EXISTS tipos_cita_consultorio ON public.tipos_cita (consultorio_id) WHERE consultorio_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 3 · El consultorio de un tipo es de ese médico y de esa clínica.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validar_tipo_cita_consultorio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF NEW.consultorio_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.consultorios c
        WHERE c.id = NEW.consultorio_id AND c.clinica_id = NEW.clinica_id AND c.medico_id = NEW.medico_id) THEN
    RAISE EXCEPTION 'El consultorio del tipo de cita no es de ese médico' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.validar_tipo_cita_consultorio() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validar_tipo_cita_consultorio() TO anon, authenticated, service_role;

CREATE OR REPLACE TRIGGER trg_tipos_cita_consultorio
  BEFORE INSERT OR UPDATE OF consultorio_id, medico_id, clinica_id ON public.tipos_cita
  FOR EACH ROW EXECUTE FUNCTION public.validar_tipo_cita_consultorio();

-- ---------------------------------------------------------------------
-- 4 · La policy de INSERT (autorizada por Angel; ninguna otra se toca).
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS tipos_cita_insert ON public.tipos_cita;
CREATE POLICY tipos_cita_insert ON public.tipos_cita FOR INSERT TO authenticated
  WITH CHECK (clinica_id = public.get_clinica_id()
              AND (public.soy_admin_de_clinica()
                   OR (medico_id = auth.uid() AND public.get_my_role() = 'medico')));

-- ---------------------------------------------------------------------
-- 5 · reserva_contexto: el cuerpo de D3 con consultorio_id y principal en
--     cada tipo. Nada más cambia.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserva_contexto(p_codigo_hash text, p_aviso_version text, p_aviso_sha256 text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_e  public.reserva_enlaces%ROWTYPE;
  v_p  record;
  v_aj record;
BEGIN
  IF p_codigo_hash IS NULL OR p_codigo_hash !~ '^[0-9a-f]{64}$' OR p_aviso_version IS NULL OR p_aviso_sha256 IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT e.* INTO v_e FROM public.reserva_enlaces e WHERE e.codigo_hash = p_codigo_hash;
  IF NOT FOUND OR v_e.revocado_en IS NOT NULL THEN RETURN NULL; END IF;
  SELECT j.anticipacion_min_horas, j.horizonte_dias INTO v_aj
    FROM public.agenda_ajustes j WHERE j.clinica_id = v_e.clinica_id AND j.agenda_v2_encendida;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.reserva_avisos a
                  WHERE a.version = p_aviso_version AND a.texto_sha256 = p_aviso_sha256 AND a.aprobado) THEN
    RETURN NULL;
  END IF;
  IF NOT public.gcal_sync_clinica_habilitada(v_e.clinica_id) THEN RETURN NULL; END IF;
  SELECT p.titulo, p.nombres, p.apellido_paterno, p.apellido_materno, p.especialidad, p.telefono_consultorio INTO v_p
    FROM public.profiles p WHERE p.id = v_e.medico_id AND p.clinica_id = v_e.clinica_id AND p.role = 'medico';
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'clinica_id', v_e.clinica_id, 'enlace_id', v_e.id, 'medico_id', v_e.medico_id, 'clase', v_e.clase,
    'estado', CASE WHEN v_e.clase = 'unico' AND v_e.usado_en IS NOT NULL THEN 'usado'
                   WHEN v_e.clase = 'unico' AND v_e.caduca_en <= now() THEN 'caducado' ELSE 'vigente' END,
    'medico', jsonb_build_object('titulo', v_p.titulo, 'nombres', v_p.nombres, 'apellido_paterno', v_p.apellido_paterno,
                                 'apellido_materno', v_p.apellido_materno, 'especialidad', v_p.especialidad,
                                 'telefono', v_p.telefono_consultorio),
    'clinica', (SELECT jsonb_build_object('nombre', c.nombre, 'nombre_display', c.nombre_display, 'horario', c.horario_consulta)
                  FROM public.clinicas c WHERE c.id = v_e.clinica_id),
    'consultorios', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'direccion', c.direccion,
                       'telefono', c.telefono, 'timezone', c.timezone, 'horario', c.horario, 'horario_propio', c.horario_propio)
                       ORDER BY c.es_default DESC, c.nombre), '[]'::jsonb)
                       FROM public.consultorios c
                      WHERE c.clinica_id = v_e.clinica_id AND c.medico_id = v_e.medico_id AND c.activo),
    'tipos', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'nombre', t.nombre, 'duracion_min', t.duracion_min,
                                                         'consultorio_id', t.consultorio_id, 'principal', t.principal)
                ORDER BY t.nombre), '[]'::jsonb)
                FROM public.tipos_cita t
               WHERE t.clinica_id = v_e.clinica_id AND t.activo AND (t.medico_id IS NULL OR t.medico_id = v_e.medico_id)),
    'ajustes', jsonb_build_object('anticipacion_min_horas', v_aj.anticipacion_min_horas, 'horizonte_dias', v_aj.horizonte_dias));
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.reserva_contexto(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reserva_contexto(text, text, text) TO service_role;

COMMENT ON FUNCTION public.reserva_contexto(text, text, text) IS
  'Contexto público de un enlace de reserva (D3; G2 añadió consultorio_id y principal a cada tipo). NULL = 404 indistinguible. Sólo service_role. CONVENIO: los tipos van todos juntos; qué tipos valen en cada consultorio (el principal por consultorio sustituye allí al general) lo decide el servidor antes de reservar (tiposDelConsultorio, src/lib/agenda/tiposCita.ts). reservar_por_enlace no mira el consultorio del tipo.';
COMMENT ON COLUMN public.tipos_cita.principal IS
  'La duración de la consulta del médico (agenda G2): su tipo principal, creado al contestar «¿cuánto dura tu consulta?». Sólo con medico_id (tipos_cita_principal_check); uno activo por médico y, aparte, uno por médico y consultorio (tipos_cita_principal_unico).';
COMMENT ON COLUMN public.tipos_cita.consultorio_id IS
  'Sólo en un tipo principal (tipos_cita_consultorio_check): la duración distinta del médico en ESE consultorio, que allí sustituye a su principal general (agenda G2). El consultorio es del mismo médico y clínica (validar_tipo_cita_consultorio). CONVENIO QUE LA BASE NO IMPONE: reservar_por_enlace acepta el tipo en cualquier consultorio del médico; la ruta pública lo filtra antes (tiposDelConsultorio en src/lib/agenda/tiposCita.ts). En la agenda interna es sólo la lista del selector.';

COMMIT;

-- ---------------------------------------------------------------------
-- 6 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO'
            WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'tipos_cita.consultorio_id / principal' AS comprobacion,
         coalesce((SELECT string_agg(attname || '=' || format_type(atttypid, atttypmod) || '/' || attnotnull::text
                                     || '/' || coalesce(pg_get_expr(d.adbin, d.adrelid), '-'), ',' ORDER BY attname)
                     FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
                    WHERE a.attrelid = 'public.tipos_cita'::regclass AND NOT a.attisdropped
                      AND a.attname IN ('consultorio_id', 'principal')), 'AUSENTE') AS valor,
         'consultorio_id=uuid/false/-,principal=boolean/true/false' AS esperado
  UNION ALL
  SELECT 2, 'FK consultorio → consultorios RESTRICT',
         coalesce((SELECT confrelid::regclass::text || ' / ' || confdeltype::text FROM pg_constraint
                    WHERE conrelid = 'public.tipos_cita'::regclass AND conname = 'tipos_cita_consultorio_id_fkey'), 'AUSENTE'),
         'consultorios / r'
  UNION ALL
  SELECT 3, 'CHECK principal / consultorio',
         coalesce((SELECT string_agg(pg_get_constraintdef(oid), ' ; ' ORDER BY conname) FROM pg_constraint
                    WHERE conrelid = 'public.tipos_cita'::regclass
                      AND conname IN ('tipos_cita_consultorio_check', 'tipos_cita_principal_check')), 'AUSENTE'),
         'CHECK (((consultorio_id IS NULL) OR principal)) ; CHECK (((NOT principal) OR (medico_id IS NOT NULL)))'
  UNION ALL
  SELECT 4, 'índices únicos de nombre y de principal',
         coalesce((SELECT string_agg(indexname || ': ' || substring(indexdef FROM 'WHERE .*$'), ' ; ' ORDER BY indexname) FROM pg_indexes
                    WHERE schemaname = 'public' AND tablename = 'tipos_cita'
                      AND indexname IN ('tipos_cita_nombre_activo_unico', 'tipos_cita_principal_unico')), 'AUSENTE'),
         'tipos_cita_nombre_activo_unico: WHERE (activo AND (consultorio_id IS NULL)) ; tipos_cita_principal_unico: WHERE (activo AND principal)'
  UNION ALL
  SELECT 5, 'policies de tipos_cita (INSERT nueva; SELECT y UPDATE de B6)',
         (SELECT string_agg(polname || '=' || coalesce(pg_get_expr(polwithcheck, polrelid), pg_get_expr(polqual, polrelid)), ' ; ' ORDER BY polname)
            FROM pg_policy WHERE polrelid = 'public.tipos_cita'::regclass),
         'tipos_cita_insert=((clinica_id = get_clinica_id()) AND (soy_admin_de_clinica() OR ((medico_id = auth.uid()) AND (get_my_role() = ''medico''::text)))) ; '
         || 'tipos_cita_select=((clinica_id = get_clinica_id()) AND ((medico_id IS NULL) OR (medico_id = auth.uid()) OR soy_admin_de_clinica() OR (get_my_role() = ''secretaria''::text))) ; '
         || 'tipos_cita_update=(soy_admin_de_clinica() AND (clinica_id = get_clinica_id()))'
  UNION ALL
  SELECT 6, 'disparadores de tipos_cita',
         (SELECT string_agg(tgname || '→' || tgfoid::regproc::text, ',' ORDER BY tgname) FROM pg_trigger
           WHERE tgrelid = 'public.tipos_cita'::regclass AND NOT tgisinternal AND tgenabled = 'O'),
         'audit_tipos_cita→log_tabla_change,trg_tipos_cita_consultorio→validar_tipo_cita_consultorio,trg_tipos_cita_medico→validar_tipo_cita_medico,trg_tipos_cita_updated_at→update_tipos_cita_updated_at'
  UNION ALL
  SELECT 7, 'funciones: definer / EXECUTE PUBLIC,anon,authenticated,service_role',
         (SELECT string_agg(p.proname || '=' || p.prosecdef::text || ' / '
                 || (EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                              WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'))::text || ','
                 || has_function_privilege('anon', p.oid, 'EXECUTE')::text || ','
                 || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || ','
                 || has_function_privilege('service_role', p.oid, 'EXECUTE')::text, ' ; ' ORDER BY p.proname)
            FROM pg_proc p
           WHERE p.oid IN (to_regprocedure('public.reserva_contexto(text, text, text)'),
                           to_regprocedure('public.validar_tipo_cita_consultorio()'))),
         'reserva_contexto=false / false,false,false,true ; validar_tipo_cita_consultorio=false / false,true,true,true'
  UNION ALL
  SELECT 8, 'md5 de reserva_contexto (el de G2)',
         (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.reserva_contexto(text, text, text)')),
         '8d81bc662a7312256fefea8494458f4f'
  UNION ALL
  SELECT 9, 'tipos principales / por consultorio / total (censo)',
         (SELECT count(*) FILTER (WHERE principal)::text || ' / ' || count(*) FILTER (WHERE consultorio_id IS NOT NULL)::text
                 || ' / ' || count(*)::text FROM public.tipos_cita),
         NULL
) t
ORDER BY t.n;
