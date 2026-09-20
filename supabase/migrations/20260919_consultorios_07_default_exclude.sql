-- ═══════════════════════════════════════════════════════════════════════
-- Consultorios 07 — el predeterminado tiene que poder volver atrás
-- Rama: fix/consultorio-default-exclude · Escrita: 2026-09-19
-- Riesgo estimado: BAJO (un objeto, misma tabla, mismo nombre, mismo
-- invariante; el volumen de `consultorios` es de decenas de filas).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-09-19
--   `npx supabase db reset --local` sobre una base desde cero, seguido de
--   `npx supabase db push --local --include-all`, y luego las cuatro
--   llamadas PATCH por HTTP contra `next dev`: las cuatro 200. Detalle de
--   la verificación al pie del archivo.
--   ⚠️ Hicieron falta DOS comandos por un defecto PREEXISTENTE y ajeno a
--   este archivo: `20260805_auth_01_rate_limit_atomico.sql` ordena ANTES
--   que el volcado base `20260912190416_remote_schema.sql`, y su pre-vuelo
--   aborta porque `public.ip_rate_limits` —que crea el volcado, línea 417—
--   todavía no existe. O sea que HOY un `db reset` desde cero revienta en
--   la primera migración, con o sin este archivo. Tiene su propio ticket.
-- ESTADO · PRODUCCIÓN: APLICADA Y VERIFICADA — 2026-09-19
--   Aplicada con `npx supabase db push --linked`.
--
--   ⚠️ LA REJILLA DEL FINAL DE ESTE ARCHIVO NO SE IMPRIMIÓ, y por eso la
--   comprobación consta CORRIDA APARTE: `npx supabase db push` no
--   devuelve conjuntos de resultados a ninguna pantalla, así que su
--   `SELECT` de veredicto se ejecutó sin que nadie lo viera. Mismo caso —y
--   misma forma de registrarlo— que `20260914_b56_trigger_
--   aprovisionamiento.sql:26-28`. La verificación que respalda este rótulo
--   se corrió DESPUÉS, a mano, en el SQL Editor del Dashboard:
--
--     select
--       (select conname from pg_constraint
--         where conrelid='public.consultorios'::regclass and contype='x')        as constraint_nombre,
--       (select condeferrable from pg_constraint
--         where conrelid='public.consultorios'::regclass and contype='x')        as diferible,
--       (select condeferred from pg_constraint
--         where conrelid='public.consultorios'::regclass and contype='x')        as diferida_por_defecto,
--       (select count(*) from pg_indexes
--         where schemaname='public' and indexname='consultorios_default_unico'
--           and indexdef ilike 'CREATE UNIQUE INDEX%')                           as indice_unico_viejo,
--       (select n.nspname from pg_extension e
--          join pg_namespace n on n.oid=e.extnamespace
--         where e.extname='btree_gist')                                          as btree_gist_en,
--       (select count(*) from pg_indexes
--         where schemaname='public' and tablename='consultorios'
--           and indexname in ('consultorios_pkey','consultorios_clinica',
--                             'consultorios_medico_activo'))                     as otros_indices,
--       (select count(*) from (
--           select medico_id from public.consultorios
--            where es_default and activo group by medico_id having count(*)>1) d) as medicos_con_dos_default;
--
--   Y esto es lo que devolvió en producción el 2026-09-19:
--
--    constraint_nombre          | diferible | diferida_por_defecto | indice_unico_viejo | btree_gist_en | otros_indices | medicos_con_dos_default
--   ----------------------------+-----------+----------------------+--------------------+---------------+---------------+-------------------------
--    consultorios_default_unico | true      | true                 | 0                  | extensions    | 3             | 0
--
--   Cómo se lee, columna por columna:
--     · `consultorios_default_unico` — el objeto con `contype='x'`, o sea
--       EXCLUDE, existe Y conserva el nombre del índice al que sustituye.
--     · `true` · `true` — DIFERIBLE y DIFERIDA POR DEFECTO. Son las dos
--       columnas que importan y la razón entera del archivo: sin ellas la
--       constraint se comprobaría fila a fila y el bug seguiría ahí.
--     · `0` — no queda ningún `CREATE UNIQUE INDEX` con ese nombre, así
--       que la sustitución ocurrió y no se duplicó el invariante.
--     · `extensions` — `btree_gist` quedó instalada donde se esperaba.
--     · `3` — los otros tres índices de la tabla siguen en pie.
--     · `0` — ningún médico con dos predeterminados activos.
--
--   ⚠️ Y VERIFICADA EN COMPORTAMIENTO, NO SÓLO EN CATÁLOGO. Que las siete
--   columnas cuadren dice que el objeto quedó; no dice que el médico pueda
--   volver atrás, que es lo único que este archivo vino a arreglar. En
--   producción, con una cuenta real de dos consultorios, el cambio de
--   predeterminado se hizo DE IDA Y DE VUELTA sin error —la vuelta era
--   justo la dirección que devolvía 409 de forma permanente— y el membrete
--   del PDF salió con la dirección del consultorio marcado.
--
-- ✅ AUDITADA — por `supabase/AUDITORIA-MIGRACIONES.md`. Veredicto: APTA.
-- Este renglón sustituye al aviso de «pendiente de auditoría» que llevó el
-- archivo mientras no había pasado por ella: queda como constancia de que
-- pasó, no como adorno.
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
--
-- El síntoma: un médico con dos consultorios cambia el predeterminado de A
-- a B y funciona; intenta devolverlo de B a A y recibe
--
--     PATCH /api/consultorios/{id}/marcar-default → 409
--     23505: duplicate key value violates unique constraint
--            "consultorios_default_unico"
--
-- y queda clavado en B para siempre. La bandera sólo avanza, nunca
-- retrocede. Alcanza a todo médico con dos o más consultorios activos sin
-- que haga falta que ningún dato esté corrupto. El daño real no es la
-- pantalla: es que el membrete de las recetas y demás documentos sale con
-- la dirección y el teléfono del consultorio equivocado, con folio y QR
-- válidos.
--
-- La causa NO es el RPC, y por eso el RPC no se toca. `marcar_consultorio_
-- default` hace la mutación en UNA sola sentencia, deliberadamente:
--
--     UPDATE public.consultorios
--     SET es_default = (id = p_target_id), updated_at = now()
--     WHERE medico_id = v_medico_id AND activo = true;
--
-- Esa sentencia tiene que atravesar, a mitad de recorrido, uno de estos dos
-- estados: o pasa por CERO predeterminados (si baja el viejo antes de subir
-- el nuevo) o pasa por DOS (si sube el nuevo antes de bajar el viejo). Y el
-- esquema prohibía los dos: el trigger de existencia
-- (`enforce_consultorio_default_existencia`, AFTER STATEMENT) prohíbe
-- terminar con cero, y `consultorios_default_unico` —un índice único
-- PARCIAL, que se comprueba fila a fila, no al cierre— prohibía pasar por
-- dos. No hay forma de escribirlo en una sentencia sin chocar con uno.
--
-- Que fallara en una dirección y no en la otra es el recorrido del plan:
-- va por `consultorios_medico_activo` y, con claves iguales, ordena por
-- TID, o sea por posición física. Si la fila que sube a `true` se procesa
-- ANTES que la que baja a `false`, en ese instante hay dos predeterminados
-- y salta el 23505. Y era permanente porque la propia sentencia escribe las
-- versiones nuevas en el mismo orden en que las recorrió: el orden relativo
-- se conserva y el sentido que falla sigue fallando. Sólo un `VACUUM FULL`
-- lo invertiría.
--
-- ═══ EL ARREGLO, Y POR QUÉ ES UNA CONSTRAINT Y NO UN ÍNDICE ════════════
--
-- Lo que sobra es la comprobación fila a fila; el invariante no. Basta con
-- diferirla al COMMIT: durante la sentencia puede haber dos, al cerrar la
-- transacción tiene que haber uno.
--
-- Diferir exige una CONSTRAINT: `DEFERRABLE` sólo existe en constraints, y
-- un índice único —aunque lo respalde— no lo es. Y una constraint UNIQUE no
-- sirve, porque no admite `WHERE`: el invariante es parcial (sólo entre
-- consultorios activos y predeterminados; un médico puede tener diez
-- archivados con la bandera puesta y da igual). `EXCLUDE` es la única forma
-- que admite las dos cosas a la vez —predicado parcial y diferimiento—, y
-- con `medico_id WITH =` expresa exactamente lo mismo que expresaba el
-- índice único: nunca dos filas con el mismo `medico_id` dentro del
-- predicado.
--
-- Lo que NO cambia, y conviene tenerlo escrito:
--   · El invariante es el mismo. No se relaja: se mueve del final de cada
--     fila al final de la transacción.
--   · El trigger de existencia sigue igual y sigue haciendo su trabajo:
--     es AFTER STATEMENT y lee el estado vivo de la tabla, así que el
--     diferimiento no lo afecta.
--   · El RPC, el trigger de alta y las policies RLS no se tocan.
--   · El alcance de los roles no cambia en ninguna de las dos direcciones:
--     una constraint de tabla no concede ni retira privilegios, y nadie
--     gana ni pierde capacidad de leer o escribir nada.
--
-- ⚠️ EL CÓDIGO DE ERROR CAMBIA. Un índice único violado lanza `23505`
-- (`unique_violation`); una constraint EXCLUDE violada lanza `23P01`
-- (`exclusion_violation`). Tras esta migración el flujo normal de
-- marcar-default ya no produce ninguno de los dos, pero la carrera de dos
-- INSERT simultáneos del primer consultorio de un médico sigue pudiendo
-- producir `23P01` —ahora al COMMIT, no en la sentencia—. Los manejadores
-- de `src/app/api/consultorios/` que hoy sólo miran `23505` necesitan mirar
-- también `23P01`, o ese conflicto pasa de 409 legible a 500 crudo. Va en
-- su propio commit, fuera de este archivo.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
--
-- El `BEGIN`/`COMMIT` explícito es deliberado y sigue el precedente de las
-- tres migraciones vecinas de `supabase/migrations/`. El DROP del índice y
-- el ADD de la constraint TIENEN que ir en la misma transacción: entre uno
-- y otro no existe el invariante, y esa ventana no puede llegar a
-- producción. Partir el archivo en dos pegadas la abre.
--
-- Bloqueos: el `ALTER TABLE ... ADD CONSTRAINT` toma ACCESS EXCLUSIVE sobre
-- `public.consultorios` y construye el índice GiST sin concurrencia, así
-- que bloquea lecturas y escrituras de esa tabla mientras dura. Con el
-- volumen real (decenas de filas) es instantáneo. Si alguna vez se
-- replayea sobre una base con millones, esto sería la preocupación
-- principal del archivo.
--
-- Orden seguro respecto al despliegue de código: ESTA MIGRACIÓN PRIMERO, el
-- código después, pero el orden casi da igual porque el cambio es
-- compatible en las dos direcciones. El código viejo contra el esquema ya
-- migrado funciona (deja de recibir el 409 que era el bug; su rama de
-- `23505` queda sin usar, no rota). El código nuevo contra el esquema viejo
-- también funciona (mira `23505` y `23P01`; sólo se dispara el primero).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ---------------------------------------------------------------------
-- 1 · La extensión que aporta el opclass.
-- ---------------------------------------------------------------------
-- GiST no sabe comparar `uuid` con `=` de serie: esa clase de operadores
-- (`gist_uuid_ops`) la aporta `btree_gist`. En Supabase las extensiones
-- viven en el esquema `extensions`, que ya es donde están `pgcrypto` y
-- `uuid-ossp` en esta base.
--
-- No hace falta calificar el opclass ni tocar el `search_path`: cuando no
-- se nombra ninguno, Postgres resuelve el opclass POR DEFECTO del par
-- (tipo, método de acceso) recorriendo `pg_opclass` sin filtrar por
-- visibilidad de esquema. Comprobado en local el 2026-09-19: el
-- `ALTER TABLE` de abajo crea la constraint igual con
-- `search_path = pg_catalog`, donde `extensions` no es visible.
--
-- `IF NOT EXISTS` ignora la cláusula `WITH SCHEMA` si la extensión ya
-- existe, así que si producción ya la tuviera en otro esquema esto es un
-- no-op y el opclass se resuelve igual.
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

-- ---------------------------------------------------------------------
-- 2 · Pre-vuelo + sustitución, en un solo bloque.
-- ---------------------------------------------------------------------
-- Va en un DO para poder abortar ANTES de tocar nada, y para que volver a
-- pegar el archivo sobre una base ya migrada sea un no-op silencioso en
-- vez de un error por «el índice no existe».
DO $$
DECLARE
  v_constraint_ok boolean;
  v_indice_ok     boolean;
  v_duplicados    integer;
BEGIN
  -- (a) ¿Ya está aplicada? Constraint con ese nombre y contype 'x'
  --     (EXCLUDE). Entonces no hay nada que hacer y repetirlo es
  --     inofensivo: no-op silencioso, no excepción.
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.consultorios'::regclass
       AND conname  = 'consultorios_default_unico'
       AND contype  = 'x'
  ) INTO v_constraint_ok;

  IF v_constraint_ok THEN
    RETURN;
  END IF;

  -- (b) Si no está aplicada, el índice viejo TIENE que estar ahí. Si no
  --     está ninguno de los dos, la tabla está sin invariante y este
  --     archivo no es lo que hay que correr: abortar ruidosamente.
  SELECT EXISTS (
    SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = 'consultorios_default_unico'
       AND c.relkind = 'i'
  ) INTO v_indice_ok;

  IF NOT v_indice_ok THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: no existe ni el índice ni la constraint consultorios_default_unico. La tabla está sin invariante de predeterminado único; investigar antes de correr esto.';
  END IF;

  -- (c) Validación contra los datos que ya hay. El índice único lo hacía
  --     imposible, pero la constraint nueva se valida contra la tabla
  --     entera al crearse: si hubiera un médico con dos predeterminados
  --     activos, el ALTER TABLE reventaría con un mensaje sobre una fila
  --     suelta. Mejor decirlo aquí, con el conteo, y no tocar nada.
  SELECT count(*) INTO v_duplicados
    FROM (
      SELECT medico_id
        FROM public.consultorios
       WHERE es_default AND activo
       GROUP BY medico_id
      HAVING count(*) > 1
    ) d;

  IF v_duplicados > 0 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: % médico(s) tienen más de un consultorio activo marcado como predeterminado. Hay que dejar uno solo por médico antes de aplicar esta migración.', v_duplicados;
  END IF;

  -- (d) La sustitución. Las dos sentencias, en esta transacción, sin
  --     ventana entre ellas.
  EXECUTE 'DROP INDEX public.consultorios_default_unico';

  EXECUTE $ddl$
    ALTER TABLE public.consultorios
      ADD CONSTRAINT consultorios_default_unico
      EXCLUDE USING gist (medico_id WITH =)
      WHERE (es_default AND activo)
      DEFERRABLE INITIALLY DEFERRED
  $ddl$;
END $$;

-- ---------------------------------------------------------------------
-- 3 · El convenio, escrito donde viaja con la base.
-- ---------------------------------------------------------------------
-- La cabecera de este archivo se queda en el repositorio; quien mire la
-- base dentro de un año sólo tiene el catálogo. El diferimiento es
-- exactamente la clase de detalle que alguien «arreglaría» sin saber por
-- qué está, así que va aquí.
COMMENT ON CONSTRAINT consultorios_default_unico ON public.consultorios IS
  'Un solo consultorio predeterminado por médico, entre los activos. Es EXCLUDE y no un índice único PORQUE TIENE QUE SER DIFERIBLE: el RPC marcar_consultorio_default recalcula la bandera de todos los consultorios del médico en UNA sola sentencia, que atraviesa un estado transitorio con dos predeterminados. Con la comprobación fila a fila de un índice único, esa sentencia fallaba con 23505 en una de las dos direcciones y la bandera sólo podía avanzar. No la vuelvas a convertir en índice único. Violarla lanza 23P01, no 23505.';

COMMIT;

-- ---------------------------------------------------------------------
-- 4 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
-- El SQL Editor de Supabase sólo enseña el último conjunto de resultados
-- con filas, así que todo lo que hay que comprobar va aquí dentro.
SELECT * FROM (
  SELECT 1 AS n, 'constraint EXCLUDE diferida' AS comprobacion,
         (SELECT coalesce(string_agg(contype::text || '/' || condeferrable::text || '/' || condeferred::text, ','), 'AUSENTE')
            FROM pg_constraint
           WHERE conrelid = 'public.consultorios'::regclass
             AND conname  = 'consultorios_default_unico') AS valor,
         'x/true/true' AS esperado
  UNION ALL
  SELECT 2, 'índice único viejo retirado',
         (SELECT count(*)::text FROM pg_index i
            JOIN pg_class c ON c.oid = i.indexrelid
           WHERE c.relname = 'consultorios_default_unico' AND i.indisunique),
         '0'
  UNION ALL
  SELECT 3, 'btree_gist instalada',
         (SELECT coalesce(max(n.nspname), 'AUSENTE')
            FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
           WHERE e.extname = 'btree_gist'),
         'extensions'
  UNION ALL
  SELECT 4, 'los otros 3 índices siguen ahí',
         (SELECT count(*)::text FROM pg_indexes
           WHERE schemaname = 'public' AND tablename = 'consultorios'
             AND indexname IN ('consultorios_pkey','consultorios_medico_activo','consultorios_clinica')),
         '3'
  UNION ALL
  SELECT 5, 'médicos con dos predeterminados activos',
         (SELECT count(*)::text FROM (
            SELECT medico_id FROM public.consultorios
             WHERE es_default AND activo
             GROUP BY medico_id HAVING count(*) > 1) d),
         '0'
  UNION ALL
  SELECT 6, 'el RPC sigue vivo y de una sola sentencia',
         (SELECT (to_regprocedure('public.marcar_consultorio_default(uuid)') IS NOT NULL
                  AND prosrc LIKE '%es_default = (id = p_target_id)%')::text
            FROM pg_proc WHERE oid = to_regprocedure('public.marcar_consultorio_default(uuid)')),
         'true'
  UNION ALL
  SELECT 7, 'los 6 triggers de consultorios siguen ahí',
         (SELECT count(*)::text FROM pg_trigger
           WHERE tgrelid = 'public.consultorios'::regclass AND NOT tgisinternal),
         '6'
) t
CROSS JOIN LATERAL (SELECT CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado) e
ORDER BY t.n;

-- ═══════════════════════════════════════════════════════════════════════
-- REVERSIÓN EN CALIENTE — las dos sentencias exactas, en este orden
-- ═══════════════════════════════════════════════════════════════════════
--
--   ALTER TABLE public.consultorios DROP CONSTRAINT consultorios_default_unico;
--
--   CREATE UNIQUE INDEX consultorios_default_unico ON public.consultorios
--     USING btree (medico_id) WHERE ((es_default = true) AND (activo = true));
--
-- Las dos juntas, en una sola transacción, por lo mismo que el UP: entre
-- una y otra la tabla no tiene invariante.
--
-- ⚠️ REVERTIR REINTRODUCE EL BUG. Deja la tabla exactamente como estaba
-- antes de este archivo, o sea con el predeterminado clavado en una
-- dirección. Es la salida de emergencia si algo inesperado sale de esta
-- migración, no una alternativa válida: el 409 vuelve el mismo día.
--
-- `btree_gist` se deja instalada a propósito. Un `DROP EXTENSION` no hace
-- falta para volver al comportamiento anterior y sí puede tumbar otros
-- objetos por dependencia.
--
-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN EN LOCAL — 2026-09-19
-- ═══════════════════════════════════════════════════════════════════════
-- Base creada desde cero (`db reset --local` + `db push --local
-- --include-all`, por el defecto preexistente de orden que explica la
-- cabecera) y comprobado contra el servidor de desarrollo, no pegando SQL:
--
--   · Las CUATRO direcciones de PATCH /api/consultorios/{id}/marcar-default
--     devolvieron 200: A→B, B→A, A→B otra vez, y marcar el que ya estaba
--     marcado (idempotencia). Antes de esta migración, una de esas cuatro
--     devolvía 409/23505 de forma permanente.
--   · El invariante sigue en pie: forzar dos predeterminados activos del
--     mismo médico falla AL COMMIT con
--     `23P01: conflicting key value violates exclusion constraint
--      "consultorios_default_unico"`.
--   · El trigger de existencia sigue en pie: dejar a un médico con
--     consultorios activos y ninguno predeterminado falla con
--     `23514: Inconsistencia: el médico ... tiene N consultorio(s)
--      activo(s) pero ningún default`.
--   · Y NO ES PLACEBO, que es la comprobación que faltaría si no se
--     hiciera: con la misma cuenta y el servidor en marcha se revirtió al
--     índice único con las dos sentencias del bloque de arriba, y la
--     dirección B→A volvió a dar 409 al instante mientras A→B seguía
--     dando 200. Se volvió a poner la constraint y B→A volvió a 200.
--   · El error llega entero al cliente: un PATCH directo a PostgREST que
--     deja dos predeterminados devuelve
--     `{"code":"23P01", ...}` con HTTP 400, o sea que el `error.code` que
--     ve `supabase-js` es `23P01`. De ahí el cambio en los manejadores.
--   · Lecturas: la consulta de `api/email/enviar-documento/route.ts:99`
--     NO usaba el índice viejo ni usa el nuevo, porque filtra por
--     `es_default` sin `activo` y no implica el predicado parcial. Con
--     200 000 filas sintéticas el plan es Seq Scan en los dos casos, y si
--     se le añadiera `activo = true` sería Index Scan en los dos.
-- ═══════════════════════════════════════════════════════════════════════
