# Conteos antes de aplicar el conjunto a producción

`conteos.sql` reúne, como consultas de **sólo lectura**, todo lo que los
pre-vuelos (y los post-vuelos que miran el estado de antes) de las **9**
migraciones nuevas exigen a la base, más lo que sólo los datos reales dicen
(historial, número de citas, transacciones y candados abiertos, trabajos de
`pg_cron`, filas que harían abortar el backfill de F1). Al día con la foto de
producción del 2026-11-22 (`supabase/produccion/DERIVA.md`) y con las
correcciones C1–C3 y T. Devuelve **una rejilla**: una fila por comprobación,

```
id | migración | qué mira | valor | esperado | veredicto
```

| Veredicto | Significa |
|---|---|
| **OK** | Lo que el conjunto supone. |
| **ALTO** | No apliques nada. La migración que nombra la fila abortaría (en su pre-vuelo, en su post-vuelo o a mitad, siempre sin dejar nada a medias), o la base no está en el estado que el conjunto supone. |
| **AVISO** | No aborta nada, pero algo no es lo previsto: una rejilla de las migraciones saldrá con REVISAR, o la comprobación no pudo ver todo. Lee la fila abajo antes de seguir. |
| **INFO** | Sólo informa (tamaños, cuántas filas tocará el backfill). |

Las migraciones, en el orden en que se aplican:

| Abreviatura | Migración |
|---|---|
| M1 | `20261125170000_audit_log_sin_truncate` |
| M2 | `20261126120000_public_sin_truncate` |
| F1 | `20261201120000_agenda_f1_ajustes_tipos_horarios` |
| F5a | `20261201130000_agenda_f5a_bloqueos` |
| F3 | `20261201140000_agenda_f3_reserva_enlace` |
| F2 | `20261201150000_agenda_f2_google` |
| F4 | `20261201160000_agenda_f4_confirmacion_correos_avisos` |
| F5b | `20261201170000_agenda_f5b_protecciones_cita` |
| T | `20261201180000_agenda_sin_truncate` (aparte del conjunto fundido, la última) |

**Qué devuelve y qué no.** Números, nombres de objetos de la base (tablas,
funciones, disparadores, restricciones, índices), nombres de roles, versiones
del historial, md5 de cuerpos de funciones, y de la actividad sólo usuario,
estado y edad de la transacción (G.14) y nombre y horario de los trabajos de
`pg_cron` (G.17). **Ningún dato de pacientes ni de personas**: ni nombres, ni
correos, ni teléfonos, ni títulos de citas, ni ids de fila, de clínica o de
médico, ni el texto de ninguna consulta ni de ningún comando programado. Donde hace falta saber *cuáles* son las filas
(F1.10, C.1), el LEEME da la consulta para que la corras tú, aparte.

---

## 1. Cómo correrlo

**Cuándo:** antes de aplicar la primera de las 9, y otra vez justo antes de
empezar (G.14, G.15 y G.17 miran la actividad de ese momento). Con todo OK (e INFO),
se aplica. Si ya aplicaste alguna, sus filas salen ALTO o AVISO («ya existe»):
eso es lo esperado; el conteo vale para la base de ANTES.

**Con el script (recomendado)**, desde la raíz del repo, con Docker encendido:

```bash
bash supabase/produccion/conteos/correr-conteos.sh
```

Es el mismo mecanismo que `scripts/produccion/foto-produccion.sh`:

- pide la contraseña con `read -rs`: **se escribe en ese aviso**, no se ve, no
  va en la línea de comandos y por tanto no queda en `~/.zsh_history`;
- vive sólo en el entorno del proceso y del contenedor efímero de `psql`
  (`docker run -e PGPASSWORD`, sin valor en la línea; `ps` no la enseña); nunca
  se escribe en disco;
- `psql` sale de la imagen de Postgres del stack local: nada que instalar;
- conexión: Session pooler `aws-0-us-west-2.pooler.supabase.com:5432`, usuario
  `postgres.qpnegmmpneseirfyplbf`, base `postgres`, `sslmode=require` (los de
  `CLAUDE.md`). Nunca `supabase link` ni `--linked`.

Guarda la rejilla en `~/spinus-produccion-foto/conteos-<fecha>.txt` (carpeta
700, archivo 600) **si esa carpeta ya tiene la foto**. Si todavía no existe, la
guarda en `~/spinus-produccion-conteos/`: `foto-produccion.sh` se niega a
escribir en una carpeta que ya tenga archivos, y un conteo previo le cerraría
el paso. `CONTEOS_DESTINO=…` fuerza otra carpeta.

Al final imprime un resumen con las filas ALTO y AVISO. Código de salida:
`0` todo OK/INFO · `1` hay algún ALTO · `4` sin ALTO pero con AVISO · `3` psql
falló (conexión, contraseña, permiso o un `lock_timeout`) · `2` error de uso.

**A mano**, si prefieres tu propio `psql` (la contraseña, por `~/.pgpass` o
por el aviso de `psql`, nunca en la URL):

```bash
psql -X -v ON_ERROR_STOP=1 -P pager=off "host=aws-0-us-west-2.pooler.supabase.com port=5432 user=postgres.qpnegmmpneseirfyplbf dbname=postgres sslmode=require" -f supabase/produccion/conteos/conteos.sql
```

**En el SQL Editor de Supabase** también se puede pegar entero. Si el editor
sólo enseña el resultado de la última sentencia (el `ROLLBACK`), pega sólo el
`SELECT` (desde `WITH` hasta el `;` antes del `ROLLBACK`): todo él es de
lectura. Ojo: el editor corre como `postgres` pero con SU sesión; G.04 y G.14
describen esa sesión, no la de la CLI.

**Por qué no puede escribir:** `BEGIN TRANSACTION READ ONLY` (Postgres rechaza
cualquier escritura, también de catálogo) y `ROLLBACK` al final; no crea
funciones ni tablas temporales; las cuentas sobre tablas que pueden no existir
van con `query_to_xml`, que sólo lee. `statement_timeout` 30 s y
`lock_timeout` 2 s: si una tabla está tomada en exclusiva, aborta con error en
vez de esperar (vuelve a correrlo en un minuto; si se repite, mira G.14/G.15
desde otra sesión). Las cuentas de filas son sobre `consultorios`,
`clinicas` (horario), el historial, `appointments` (G.13b, un `count(*)`: un
recorrido de lectura con ACCESS SHARE, que no frena a nadie) y, si existieran,
el respaldo de F1 y `google_asignacion` (F2.8).

---

## 2. Fila por fila: qué significa, cuándo seguir y qué hacer si no

Las consultas «aparte» que se citan son de lectura y las corres tú con `psql`
(no van en la rejilla porque devuelven ids).

### G · general

| id | Qué significa | Sigue si | Si no |
|---|---|---|---|
| G.01 | Versión de Postgres. La foto es la **17.6**, y el `psql`/`pg_dump` de `aplicar.sh` son los de la imagen local (17.6). F3 concede `MAINTAIN` (sólo existe desde la 17). | `17.x` | Supabase cambió de versión mayor desde la foto: no apliques; toma otra foto y repite el ensayo (y fuerza `IMAGEN_PG` con una imagen de esa versión). |
| G.02 | El rol con el que se corre esto. **M2, F4 y F5b exigen exactamente `postgres`** (`current_user <> 'postgres'` aborta; F4 y F5b dicen cómo conectarse), y todas suponen que quien aplica es el dueño de las tablas. Corre el conteo con la MISMA conexión que usarás para aplicar. | `postgres` | Conéctate por el pooler con `postgres.qpnegmmpneseirfyplbf` (Supavisor lo convierte en `postgres`) y repite. Comprobado: corrido como `supabase_admin`, G.02 sale ALTO y F4 aborta en su pre-vuelo. |
| G.03 | BYPASSRLS del rol que aplica (F5b lo exige: `cita_tiene_nota_ligada` es DEFINER y su dueño tiene que ver todas las notas). | primer valor `true` | No apliques nada: `postgres` no puede darse BYPASSRLS a sí mismo. Mándale la fila al coordinador. |
| G.04 | `search_path` de la sesión, y si `public` es visible. Desde las correcciones C1–C3, F1, F3, F2, F4 y F5b dan lo mismo con `''`, `public` y el de `postgres` (probado por sus agentes, notas en `supabase/fusion/notas/`). Las demás nombran todo con `public.`; con `''` no constan probadas. | `public visible: true` | Con el pooler y el usuario `postgres` sale `"$user", public, extensions` (foto). Si no, `SHOW search_path;` en la terminal donde aplicarás y avisa antes de seguir. |
| G.05 | `service_role` existe con BYPASSRLS (F2, F3 y F4: sus RPC son INVOKER y las llama `service_role`). | `true` | No apliques nada; manda la fila. |
| G.06 | Existen `anon`, `authenticated` y `service_role`. | `true / true / true` | No apliques nada: no es la base que el conjunto supone. |
| G.07 | Existe `supabase_migrations.schema_migrations` (cuántas versiones). | `sí (5 versiones)` | Sin ella, un `db push` la crearía y trataría de aplicar las 14, empezando por `remote_schema`. No apliques; manda la fila. |
| G.08 | Las 5 de `main` (`20260912190416`, `20260913`, `20260914`, `20260919`, `20260919230000`) están registradas (la foto del 2026-11-22 las tiene todas; `20260919230000` confirmada también por su efecto, `DERIVA.md` §2). | `ninguna falta` | Alguien tocó el historial desde la foto: no apliques; toma otra foto y compárala (plan, paso 2). |
| G.10 | Alguna de las 9 nuevas ya registrada: `aplicar.sh` la saltaría. | `ninguna` | Mira las filas «objetos que YA existen» de esa migración (M1.3, M2.5, F1.7, F5a.4, F3.4, F2.6, F4.4, F5b.4, T.3). Registrada sin sus objetos: el historial miente; manda la fila antes de tocar nada. Registrada con sus objetos: ya está aplicada; manda la rejilla antes de seguir con las demás. |
| G.11 | Versiones registradas que el repo no conoce: alguien aplicó algo fuera de este plan (o se aplicó otra rama). | `ninguna` | Mira cuáles: `select version, name from supabase_migrations.schema_migrations where version in (…);`. No apliques nada hasta saber qué cambiaron (otra foto y su comparación). **No** corras `db pull` ni `migration repair` sin plan. |
| G.12 | Extensiones instaladas y su esquema. Las 9 no usan ninguna (`gen_random_uuid`, `sha256`, `hashtext`, los candados consultivos son del núcleo); `btree_gist` la usa la EXCLUDE de `consultorios` de `main`. En la foto hay además `pg_cron 1.6.4` (ver G.17). | `btree_gist presente` | Sin `btree_gist`, `consultorios_default_unico` no puede existir: `main` no es la que creemos. Manda la fila. |
| G.13 | Filas estimadas (`reltuples`) y tamaño de `appointments`, `consultorios`, `clinicas`, `audit_log`, `profiles`. | INFO | Un `≈0` en una tabla con datos sólo significa que no se ha hecho ANALYZE; la cuenta buena es G.13b. |
| G.13b | **Número exacto de citas.** De él dependen las ventanas con `appointments` bloqueada: F3 recorre la tabla con 2 FK y 2 CHECK, F2 con 1 CHECK y F5b construye 2 índices de rango (SHARE: frenan escrituras, no lecturas) y valida una FK y un CHECK con ACCESS EXCLUSIVE. Medidas en el plan (§5) hasta 200 000 citas. | `≤ 200000` | No aborta nada. Con más, las ventanas crecen en proporción (F5b: 0,5–1,7 s de índices por cada 200 000): aplica sin consultas y avisa antes de seguir. |
| G.14 | Otras sesiones con una transacción abierta hace más de 60 s: `usuario:estado:edad` (sin texto de consulta). Retendrían candados: F1 y F5a piden los suyos con `NOWAIT` y abortan a los 5 s con «CANDADOS: … reintenta en unos minutos»; las demás esperan hasta `lock_timeout` (5 s) haciendo cola. **Comprobado** en el clon con una sesión de prueba (`postgres:active:65 s`). | `ninguna` | Espera y vuelve a contar. Si es una pestaña tuya del SQL Editor, ciérrala. Para ver más (sigue sin texto de consultas): `select pid, usename, application_name, state, now() - xact_start from pg_stat_activity where xact_start < now() - interval '60 s';`. No termines sesiones ajenas sin saber qué son. |
| G.15 | Candados de OTRAS sesiones (con transacción de más de 5 s) sobre las tablas que se alteran. **Comprobado** (sale `clinicas:AccessShareLock` con una lectura de prueba abierta). | `ninguno` | Igual que G.14: espera un minuto y repite; si persiste, identifica la sesión como en G.14. |
| G.16 | Si el rol ve la actividad de las demás sesiones (`pg_read_all_stats`). | `true` | G.14 y G.15 pueden contar de menos: aplica en un momento sin uso y no te fíes de su OK. |
| G.17 | Trabajos **activos** de `pg_cron` cuyo comando nombra `appointments` o `clinicas`: `nombre@horario`, y cuántos activos hay en total. Sólo nombre y horario (ni el comando ni su usuario). La foto tiene la extensión pero no dice si hay trabajos. Un trabajo que escriba citas durante F3, F2 o F5b esperaría (o haría esperar) en la cola de candados. `postgres` tiene BYPASSRLS, así que ve los de todos los usuarios. **Comprobado** en el clon con un trabajo de prueba. | `ninguno / N activos` | `NO LEGIBLE`: el rol no puede leer `cron.job`; míralo en el panel (Integrations → Cron) antes de aplicar. Con alguno: aplica fuera de su horario (y no a la vez que corre). Si los activos que no nombran esas tablas son muchos, míralos también en el panel. |
| G.18 | Índices inválidos o a medias en todo `public` (restos de un `CREATE INDEX CONCURRENTLY` o `REINDEX` abortado). La foto no tiene ninguno, pero `pg_dump` no vuelca su estado: sólo producción lo sabe. | `ninguno` | Uno ajeno de `appointments` hace que F5b dé un WARNING (no aborta); el de la llave primaria o uno de los tres de F5b, ALTO en F5b.3. Si es un resto conocido: `DROP INDEX CONCURRENTLY public.<nombre>;` (fuera de una transacción; cambio en producción, decisión tuya). |

### M1 · `20261125170000_audit_log_sin_truncate`

| id | Qué significa | Sigue si | Si no |
|---|---|---|---|
| M1.1 | `audit_log` existe y quien aplica actúa como su dueño. | `postgres / true` | No apliques nada; manda la fila. |
| M1.2 | `prevent_audit_modification()`: plpgsql, RETURNS trigger y md5 del cuerpo **con `\r\n`→`\n`** = `f1fe023a…`, que es lo que compara la migración desde C1. La fila enseña también el md5 tal cual (en la foto `7f0318cb…`, porque el cuerpo está guardado con `\r\n`: `DERIVA.md` §0). | `plpgsql / trigger / f1fe023a… / tal cual …` | El normalizado difiere: la función cambió de verdad. No apliques; manda `select pg_get_functiondef('public.prevent_audit_modification()'::regprocedure);` al coordinador. El tal cual puede ser cualquiera. |
| M1.3 | `prevent_audit_truncate` ya existe. Con otra forma, M1 aborta (ALTO). Con la suya (AVISO), M1 ya se aplicó fuera de la CLI. | `no existe` | AVISO: mira G.10; si `20261125170000` no está registrada, regístrala con `migration repair --status applied 20261125170000`. ALTO: manda `select pg_get_triggerdef(oid) from pg_trigger where tgname = 'prevent_audit_truncate';`. |
| M1.4 | TRUNCATE sobre `audit_log` que el REVOKE de M1 no quitaría: concedido a PUBLIC, concedido por otro otorgante o heredado por pertenencia a otro rol. **Comprobado:** con un TRUNCATE concedido por `authenticated` (con GRANT OPTION), M1 aborta en el propio REVOKE («dependent privileges exist»). | `ninguno` | Mira quién lo concedió: `select a.grantee::regrole, a.grantor::regrole, a.is_grantable from pg_class c, aclexplode(c.relacl) a where c.oid = 'public.audit_log'::regclass and a.privilege_type = 'TRUNCATE';`. Otro otorgante: `REVOKE GRANT OPTION FOR TRUNCATE ON public.audit_log FROM <otorgante> CASCADE;` (comprobado: tras esto el conteo vuelve a OK). PUBLIC: `REVOKE TRUNCATE ON public.audit_log FROM PUBLIC;`. Pertenencia: manda la fila. Cualquiera de esas sentencias es un cambio en producción: decisión tuya. |
| M1.5 | Los disparadores de fila `prevent_audit_delete` y `prevent_audit_update`, activos (la rejilla de M1, fila 3). | `prevent_audit_delete:O,prevent_audit_update:O` | No aborta, pero si falta alguno **el `audit_log` de producción no es inmutable**: avisa antes de aplicar nada. |
| M1.6 | Policies de `audit_log` (la rejilla de M1, fila 5). | `audit_super_admin_select` | No aborta; su rejilla saldrá REVISAR. Mira la lista: una policy de más sobre `audit_log` hay que entenderla antes. |

### M2 · `20261126120000_public_sin_truncate`

| id | Qué significa | Sigue si | Si no |
|---|---|---|---|
| M2.1 | Quien aplica **es** `postgres` (el pre-vuelo lo exige: `ALTER DEFAULT PRIVILEGES FOR ROLE postgres`). | `postgres` | Como G.02. |
| M2.2 | Las 11 tablas clínicas (`addendums`, `appointments`, `calculadora_resultados`, `casos_clinicos`, `casos_clinicos_recursos`, `consultas`, `documentos`, `mediciones_analitos`, `paciente_medico`, `pacientes`, `solicitudes_arco`) existen y quien aplica es su dueño. | `ninguna` | No apliques nada; manda la lista. |
| M2.3 | Réplica exacta del pre-vuelo: TRUNCATE de una tabla de `public` concedido a PUBLIC, concedido por quien no es el dueño, o en una tabla de un dueño del que quien aplica no es miembro (p. ej. creada por `supabase_admin`). **Comprobado:** con un TRUNCATE concedido por `authenticated`, M2 aborta en su pre-vuelo con la misma lista. | `ninguno` | Por cada entrada: PUBLIC → `REVOKE TRUNCATE ON public.<tabla> FROM PUBLIC;`; otro otorgante → `REVOKE GRANT OPTION FOR TRUNCATE ON public.<tabla> FROM <otorgante> CASCADE;`; dueño ajeno (`supabase_admin`) → postgres no puede quitarlo: manda la fila (hay que decidir la tabla con soporte de Supabase o dejar M2 fuera). |
| M2.4 | Lo que comprueba el post-vuelo: TRUNCATE **efectivo** que sobreviviría al REVOKE (incluye la pertenencia a otro rol, que M2.3 no ve). | `ninguno` | Lo de M2.3, y para la pertenencia: `select m.roleid::regrole, m.member::regrole from pg_auth_members m where m.member in ('anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole);` → manda la salida. |
| M2.5 | `public.prohibir_truncate` ya existe. Otra forma o sobrecargas → aborta (ALTO). Su forma (AVISO) → M2 ya se aplicó. | `no existe` | AVISO: como M1.3 con `20261126120000`. ALTO: manda `pg_get_functiondef` de la función. |
| M2.6 | Disparadores `trg_<tabla>_sin_truncate` que ya existen (los de otra forma abortan). | `ninguno` | Igual que M2.5. |
| M2.7 | Tablas de `public` cuyo dueño no es `postgres`. M2 no puede cambiar sus privilegios por omisión ni, si conceden TRUNCATE, quitárselo. | `ninguna` | Si alguna sale aquí y no en M2.3/M2.4, M2 entra (su rejilla, fila 8, la listará): sigue. Si sale también allí, manda la de M2.3. |
| M2.8 | Cuántas tablas de `public` conceden hoy TRUNCATE a los tres roles (lo que M1 y M2 quitarán). En la foto: **29** (`audit_log` y las 28 del inventario de la reversa de M2, que es el de la foto). Si en producción sale otro número, la reversa de M2 se queda corta: añade las de más a su `v_inventario` antes de necesitarla. | INFO | — |

### F1 · `20261201120000_agenda_f1_ajustes_tipos_horarios`

| id | Qué significa | Sigue si | Si no |
|---|---|---|---|
| F1.1 | Existen las 5 tablas de `main` que usa. | `ninguna` | No apliques nada; manda la fila. |
| F1.2 | `get_clinica_id()`, `soy_admin_de_clinica()`, `get_my_role()` existen y son SECURITY DEFINER (las policies de la agenda los llaman; INVOKER = recursión de RLS); `log_tabla_change()` y `auth.uid()` existen. **Comprobado:** con `get_my_role()` en INVOKER sale ALTO. | `ninguna` | No apliques nada; manda la fila con `pg_get_functiondef` de la que salga. |
| F1.3 | Las 18 columnas de `main` que F1 lee o escribe, con su tipo exacto. | `ninguna` | No apliques nada; manda la lista. |
| F1.4 | `consultorios.horario` y `clinicas.horario_consulta` son jsonb NOT NULL (el backfill copia una en la otra). | `2 de 2` | No apliques nada; manda la fila. |
| F1.5 | Quien aplica actúa como dueño de `appointments`, `clinicas`, `consultorios` y `profiles` (ADD COLUMN, FK, CREATE TRIGGER; F3, F2 y F5b exigen lo mismo). | `ninguna` | No apliques nada; manda la lista (`tabla:dueño`). |
| F1.6 | `appointments` ya tiene un disparador con `log_tabla_change()`: F1 aborta (duplicaría la auditoría de citas). | `ninguno` | Manda el nombre: hay que decidir cuál de las dos auditorías se queda antes de aplicar. |
| F1.7 | Objetos de F1 que ya existen (tablas, funciones, disparadores, columnas, índice). **Cualquiera aborta F1** (no es re-ejecutable). **Comprobado** con una tabla `agenda_ajustes` previa. | `ninguno` | Es un intento anterior a medias. No borres nada en producción sin plan: manda la lista; la reversa (`supabase/reversas/20261201120000_…`) tiene su propio pre-vuelo. |
| F1.8 | El esquema `respaldos` existe y quien aplica puede crear en él (allí va el respaldo del backfill). Lo crea `remote_schema`. | `sí / true` | Sin esquema: `CREATE SCHEMA respaldos;` como postgres (lo pide el propio pre-vuelo) y repite. Sin CREATE: lo concede su dueño (`GRANT CREATE ON SCHEMA respaldos TO postgres;`). Cambio en producción: decisión tuya. |
| F1.9 | `respaldos.consultorios_horario_20261119` ya existe. Con otra forma, F1 aborta (ALTO). Con la suya (AVISO), hubo un intento y una reversa: F1 reutiliza la tabla y se queda con la PRIMERA copia de cada consultorio. | `no existe` | AVISO: sigue; la fila dice cuántas filas tiene. ALTO: no la toques; manda la fila. |
| F1.10 | Médicos con consultorios activos y **ninguno predeterminado**: el UPDATE del backfill dispara `enforce_consultorio_default_existencia` y abortaría (el pre-vuelo 1.4 lo cuenta antes). **Comprobado** con un consultorio inventado. | `0` | Aparte, sin pasarlo a nadie: `select medico_id, count(*) filter (where activo) from public.consultorios group by medico_id having count(*) filter (where activo) >= 1 and count(*) filter (where activo and es_default) = 0;`. Para cada uno, marca un consultorio activo como predeterminado **desde la app** (así queda auditado) y vuelve a contar. |
| F1.11 | Cuántos consultorios reescribirá el backfill (activos / archivados), de cuántas clínicas y médicos. Es también el número de filas UPDATE `system` que añadirá a `audit_log` y de filas del respaldo. | INFO | — |
| F1.12 | Clínicas cuyo `horario_consulta` no tiene los 7 días: el backfill lo copia tal cual a cada consultorio. | `0 clínicas` | No aborta. Tras aplicar, revisa en la configuración de la agenda el horario de los consultorios de esas clínicas; o corrige antes el horario de la clínica desde la app. |
| F1.13 | `audit_log.created_at` con DEFAULT `now()`: la rejilla de F1 (fila 14) cruza el respaldo con la auditoría por el mismo instante. | `now()` | No aborta; la fila 14 de la rejilla de F1 saldrá REVISAR y no significará nada. Sigue. |
| F1.14 | Las policies de `appointments` y `consultorios` (la rejilla de F1, fila 15, las compara). | la lista de 9 | No aborta. Una policy de más o de menos en producción es una diferencia de RLS con el repo: mándala antes de aplicar. |

### C · restricciones y disparadores que el backfill vuelve a pasar sobre filas que ya hay

El único UPDATE de filas existentes del conjunto es el backfill de F1 sobre
`consultorios`. Reescribir una fila vuelve a evaluar sus CHECK (también las
NOT VALID), sus disparadores y, al COMMIT, la EXCLUDE diferida. Las
restricciones NUEVAS del conjunto sobre `appointments` (la FK compuesta y el
CHECK de F1; 2 FK y 2 CHECK de F3; el CHECK de F2; la FK y el CHECK de F5b) son
todas sobre columnas que nacen NULL: **ninguna fila existente puede
violarlas**, siempre que esas columnas no existan ya (C.5).

| id | Qué significa | Sigue si | Si no |
|---|---|---|---|
| C.1 | Para cada CHECK de `consultorios`, cuántas filas la violan (se evalúa la expresión de la propia restricción). **Comprobado:** con una CHECK NOT VALID y una fila que la viola, F1 aborta en el UPDATE del backfill. | `ninguna` | Aparte: `select id from public.consultorios where not coalesce((<expresión de la CHECK>), true);` y corrige esas filas desde la app (editar el consultorio). Luego `ALTER TABLE public.consultorios VALIDATE CONSTRAINT <nombre>;` y vuelve a contar. |
| C.2 | Médicos con más de un consultorio activo predeterminado (la EXCLUDE `consultorios_default_unico`, diferida, se revalida al COMMIT de F1). | `0` | Con la EXCLUDE validada es imposible: si sale, la restricción no es la de `main`. Corrige desde la app (deja un solo predeterminado) y manda la fila. |
| C.3 | Restricciones NOT VALID en `appointments`, `consultorios` y `clinicas`. | `ninguna` | Si C.1 da `ninguna`, no aborta nada: sigue, y valida la restricción más adelante. |
| C.4 | Los disparadores de `consultorios` (los 6 de `main`, todos activos). | la lista de 6 | Uno desconocido corre en el UPDATE del backfill y podría abortarlo: lee su función (`pg_get_functiondef`) antes; si puede lanzar una excepción al cambiar `horario` u `horario_propio`, no apliques. Uno deshabilitado (`:D`): avisa. |
| C.5 | Columnas que el conjunto añade a `appointments` (`tipo_cita_*`, `reserva_*`, `google_asignacion`, `cerrada_en`, `sustituida_por`) que ya existen. Si existen, sus filas SÍ pueden violar las restricciones nuevas. **Comprobado:** con una `google_asignacion` previa con valores, F2 aborta en el CHECK («violated by some row»). | `ninguna (0 filas pueden violarlas)` | Es un intento anterior: no apliques; manda la lista junto con la de F1.7 / F3.4 / F2.6 / F5b.4. |

### F5a · `20261201130000_agenda_f5a_bloqueos`

| id | Qué significa | Sigue si | Si no |
|---|---|---|---|
| F5a.1 | `clinicas`, `profiles` y las funciones de `main` que usan sus policies (incluida `perfil_completo()`). | `ninguna` | No apliques nada; manda la fila. |
| F5a.2 | `clinica_no_suspendida()`: md5 del cuerpo **con `\r\n`→`\n`** = `a2dcfa8f…` (lo comparan el pre-vuelo de F5a y la fila 8 de la rejilla de F2). El tal cual, en la foto, `bff6c203…`. | `a2dcfa8f… / tal cual …` | El normalizado difiere: la regla RN-1 de spinus-consola cambió. **No apliques**; manda `pg_get_functiondef`. |
| F5a.3 | `clinica_tiene_acceso()`: md5 **con `\r\n`→`\n`** = `2efd7734…`. El tal cual, en la foto, `038f41ee…`. | `2efd7734… / tal cual …` | Como F5a.2. |
| F5a.4 | Objetos de F5a que ya existen. F5a es re-ejecutable si tienen su forma exacta; en producción no debería haber ninguno. | `ninguno` | Intento anterior: no apliques; manda la fila. |

### F3 · `20261201140000_agenda_f3_reserva_enlace`

| id | Qué significa | Sigue si | Si no |
|---|---|---|---|
| F3.1 | Tablas de `main`, incluida `ip_rate_limits`. | `ninguna` | No apliques nada; manda la fila. |
| F3.2 | Las 16 columnas de `appointments` (más `consultorios.horario` y `timezone`) que nombra. | `ninguna` | No apliques nada; manda la lista. |
| F3.3 | El índice ÚNICO `idx_appointments_client_id` (`reservar_por_enlace` atrapa el `unique_violation` por su nombre). | su definición | No apliques nada; manda la fila. |
| F3.4 | Objetos de F3 que ya existen. **Cualquiera aborta F3** (no es re-ejecutable). **Comprobado** con una función `rate_limit_espera` previa. | `ninguno` | Intento anterior: no apliques; manda la lista. |

### F2 · `20261201150000_agenda_f2_google`

| id | Qué significa | Sigue si | Si no |
|---|---|---|---|
| F2.1 | `clinica_conexiones_google` con sus 7 columnas. | `7 de 7` | No apliques nada; manda la fila. |
| F2.2 | Las 18 columnas de `appointments` con su tipo, y las de `pacientes`, `profiles` y `audit_log` que usan sus RPC. | `ninguna` | No apliques nada; manda la lista. |
| F2.3 | El índice único parcial `(clinica_id, google_event_id) WHERE google_event_id IS NOT NULL` (`gcal_importar_evento` hace `ON CONFLICT` sobre él). | `appointments_clinica_google_event_id_uniq` | No apliques nada; manda la fila. |
| F2.4 | Privilegios de `service_role` que usan las RPC de F2 y F4, **uno a uno** (el pre-vuelo de F2 los mira en lista y daría por bueno uno solo; éste es más estricto). | `ninguno` | No apliques nada; manda la lista. |
| F2.5 | La puerta S3: `clinica_no_suspendida()` y `clinica_tiene_acceso()` son SQL, DEFINER, boolean, de una sola SELECT con `public.get_clinica_id()` y sin otra fuente de sesión: la misma prueba de forma que hace `gcal_sync_clinica_habilitada`. Si falla, el post-vuelo de F2 aborta (P0001) y la sincronización con Google no podría evaluarse. | `ninguna` | No apliques nada; manda `pg_get_functiondef` de la que salga. |
| F2.6 | Objetos de F2 que ya existen. F2 es re-ejecutable si tienen su forma exacta; en producción no debería haber ninguno (y C.5 cubre la columna). | `ninguno` | Intento anterior: no apliques; manda la fila. |
| F2.7 | Disparadores BEFORE de fila que `appointments` ya tiene. En `main` no hay ninguno; las rejillas de F2 (fila 6: `trg_appointments_asignacion_google` es el primero por nombre) y F5b (fila 1: la lista exacta) lo suponen. | `ninguno` | No aborta. Pero un BEFORE con nombre anterior a `trg_appointments_asignacion_google` correría antes que la marca «por asignar»: manda la lista antes de aplicar. |
| F2.8 | Si `appointments.google_asignacion` ya existiera: cuántas filas tienen valor y cuántas no cumplirían `appointments_google_asignacion_check` (desde C2 el pre-vuelo de F2 las cuenta y aborta con alguna). | `no existe la columna` | Es un intento anterior: no apliques; manda la fila junto con C.5 y F2.6. |

### F4 · `20261201160000_agenda_f4_confirmacion_correos_avisos`

| id | Qué significa | Sigue si | Si no |
|---|---|---|---|
| F4.1 | Las columnas de `main` que F4 lee o escribe, con su tipo exacto (las de la agenda las comprueba su pre-vuelo tras F1–F3). | `ninguna` | No apliques nada; manda la lista. |
| F4.2 | `clinicas.suspendida` es NOT NULL. | `true` | No apliques nada; manda la fila. |
| F4.3 | `clinica_no_suspendida()`, md5 con espacios normalizados `588de29d…` (contexto, responder, oferta y reagendar copian su predicado). | igual | Aquí no valen los espacios: si difiere, la función cambió de verdad. No apliques; manda `pg_get_functiondef`. |
| F4.4 | Objetos de F4 que ya existen. **Cualquiera aborta F4.** | `ninguno` | Intento anterior: no apliques; manda la lista. |

(Que F4 se aplique como `postgres` exacto lo mira G.02.)

### F5b · `20261201170000_agenda_f5b_protecciones_cita`

| id | Qué significa | Sigue si | Si no |
|---|---|---|---|
| F5b.1 | `appointments_status_check` admite `'attended'` y `'cancelled'`. | la definición con los dos | No apliques nada; manda la fila. |
| F5b.2 | `consultas.appointment_id`/`paciente_id`, `pacientes.id`/`clinica_id` son uuid; `get_clinica_id()` devuelve uuid. | `4 de 4 / uuid` | No apliques nada; manda la fila. |
| F5b.3 | Índices inválidos de `appointments` que **hacen abortar F5b**: desde C3 sólo la llave primaria (la usa la FK `sustituida_por`) o uno de sus tres índices; uno ajeno sólo da un WARNING (lo lista G.18). | `ninguno` | La llave primaria: `REINDEX INDEX CONCURRENTLY public.appointments_pkey;` (lo dice el propio error). Uno de los tres de F5b: `DROP INDEX CONCURRENTLY public.<nombre>;`. Fuera de una transacción; cambio en producción, decisión tuya. |
| F5b.4 | Objetos de F5b que ya existen. F5b es re-ejecutable con su forma exacta; en producción no debería haber ninguno. | `ninguno` | Intento anterior: no apliques; manda la lista. |

(BYPASSRLS del rol y `postgres` exacto: G.02 y G.03. Propiedad de `appointments`: F1.5.)

### T · `20261201180000_agenda_sin_truncate`

Las 11 tablas a las que pone disparador nacen en F5a, F3, F2 y F4: antes de
aplicar no existen, así que no hay filas que contar. Lo que la justifica sí se
ve ya: T.1.

| id | Qué significa | Sigue si | Si no |
|---|---|---|---|
| T.1 | Privilegios por omisión de `postgres` en `public` que dan TRUNCATE. En la foto, a `anon`, `authenticated` y `service_role` (`arwdDxtm`): sin M2, cada tabla nueva de la agenda nacería con TRUNCATE para los tres. M2 los quita; T pone además el disparador (que para también al dueño) y quita lo que quedara. | INFO | — |
| T.2 | Lo mismo para `supabase_admin`. En la foto, también los tres. `postgres` no puede cambiarlos; sólo afectan a tablas que cree `supabase_admin` (ninguna de las 9 lo hace: F4 y F5b exigen `postgres`). | INFO | — |
| T.3 | Disparadores con los nombres de T (`trg_<tabla>_sin_truncate` de las 11) que ya existen en `public`. | `ninguno` | Intento anterior: no apliques; manda la lista. |

---

## 3. Pasos manuales (no son SQL)

1. **PostgREST admite `imatch`** (la búsqueda de pacientes de la agenda lo usa,
   sin interruptor). Con la app de producción abierta y la sesión iniciada:
   en «Agendar», busca un nombre con dos palabras; debe devolver resultados (o
   ninguno) y la consola del navegador no debe mostrar un **400** de
   `/rest/v1/pacientes`. Equivalente sin datos, desde la pestaña Red de las
   herramientas del navegador con tu sesión: copia una petición a
   `/rest/v1/pacientes` y cámbiala por
   `GET /rest/v1/pacientes?select=id&nombre=imatch.x&limit=0` → **200 y `[]`**
   (con `limit=0` no viaja ninguna fila). Un 400 con «operator» o «imatch»
   significa que no lo admite: no despliegues el código de la búsqueda.
2. **Versión de PostgREST** (`imatch` existe desde la 10, según
   `mejora_agendaV2.md` §7; en local, la 14.5). ASUMIENDO que el proyecto expone
   la raíz OpenAPI: `curl -s "https://qpnegmmpneseirfyplbf.supabase.co/rest/v1/" -H "apikey: <clave anon>" | jq .info.version`.
   La clave anon es pública (va en el navegador), pero no la pegues en ningún
   documento. Si la raíz está cerrada, basta el paso 1.
3. **La versión de la CLI** con la que aplicarás: `npx supabase@2.117.0
   --version`. G.08–G.11 se comprobaron con esa versión
   (`db push --dry-run --db-url` contra un clon local, nunca contra producción).

---

## 4. Con la foto o sólo en producción

La foto (`~/spinus-produccion-foto/`, tomada el 2026-11-22) es **sólo
estructura**. Su clon (`scripts/produccion/clonar-desde-foto.sh`) ya da la
respuesta de producción en las filas de estructura (§6); las de la columna
derecha sólo las responde producción.

| Se responde con la foto (estructura) | Sólo en producción |
|---|---|
| G.01 (`00-version.txt`); G.05, G.06 (roles); G.07, G.08, G.10, G.11 (`04-migraciones.tsv`); G.12 | G.02 y G.04: describen la SESIÓN con la que se aplica |
| M1.1–M1.6; M2.1–M2.8 (los ACL van en el volcado) | G.03: el rol de la sesión (la foto trae los atributos de `postgres`, pero no que la CLI conecte como él) |
| F1.1–F1.8, F1.9 (que exista y su forma), F1.13, F1.14 | G.13, G.13b: tamaños y número de citas (un clon está vacío) |
| C.3, C.4, C.5 | G.14, G.15, G.16, G.17: la actividad de ese momento y los trabajos de `pg_cron` (la foto no trae filas de `cron.job`) |
| F5a.*, F3.*, F2.1–F2.7 (incluida la puerta S3), F4.* | F1.9 (cuántas filas tiene el respaldo), F1.10, F1.11, F1.12, C.1, C.2, F2.8: cuentan filas |
| F5b.1, F5b.2, F5b.4, T.1–T.3 | F5b.3, G.18: `pg_dump` no vuelca los índices inválidos, así que el clon no los tiene |

Los md5 de las funciones (M1.2, F5a.2, F5a.3, F4.3) van en la foto **tal
cual**: el clon conserva los `\r` (32 funciones con `\r` en `prosrc`, las mismas
que en `05-catalogo.jsonl`; `DERIVA.md` §1). Por eso el conteo compara el md5
normalizado, como las migraciones.

---

## 5. Condiciones de los pre-vuelos que pueden abortar sin un problema real

Probadas en clones; van también en el reporte al coordinador.

Las cinco que había antes de la foto están **resueltas** en las migraciones
(C1–C3): el `search_path` vacío (F1, F3, F2, F4, F5b), los md5 con `\r\n`
(M1 y F5a comparan normalizado; la foto real los tenía así: era el aborto
seguro de `DERIVA.md` §0), la versión (es 17.6), los índices inválidos ajenos
(F5b sólo aborta por los suyos o la llave primaria) y las filas de
`google_asignacion` (el pre-vuelo de F2 las cuenta). Queda una:

1. **M2, F4 y F5b exigen `current_user = 'postgres'` literal (G.02).** Por el
   pooler con `postgres.<ref>` lo es (DEDUCIDO de cómo nombra Supavisor al
   usuario; el conteo lo confirma en la misma conexión).

---

## 6. Cómo se probó (2026-11-22)

**Sobre el clon de la foto real (agente QL, la versión de hoy).** Contenedor
propio (`clon-spinus-ql-a`, 127.0.0.1:54371; repetido tras el reinicio del
equipo en clones nuevos, el último `clon-spinus-ql-e`, con el mismo resultado),
`clonar-desde-foto.sh` con
`esperadas-clon.tsv`: 14 diferencias, todas esperadas. `correr-conteos.sh`
contra él como `postgres` no superusuario (contraseña por stdin,
`CONTEOS_RED=host`): **78 filas, 73 OK, 5 INFO, 0 AVISO, 0 ALTO**, salida 0.
Las 5 INFO son G.13 (tamaños, todo ≈0: el clon no tiene datos), M2.8 (29),
F1.11 (0 consultorios), T.1 y T.2 (los tres roles). Los md5 esperados se
comprobaron en el clon: `prevent_audit_modification` `f1fe023a…` (tal cual
`7f0318cb…`), `clinica_no_suspendida` `a2dcfa8f…` (tal cual `bff6c203…`),
`clinica_tiene_acceso` `2efd7734…` (tal cual `038f41ee…`). Con una
transacción abierta 65 s y un trabajo de `pg_cron` de prueba que nombra
`appointments`, G.14, G.15 y G.17 salieron AVISO con
`postgres:active:65 s`, `clinicas:AccessShareLock` y `prueba-ql@*/5 * * * *`
(trabajo quitado después). Lo que en el clon vacío no se puede ver (filas,
actividad real, `cron.job` de producción, índices inválidos) es la columna
derecha de §4.

**Antes de la foto (agente Q), sobre `base-main`:**

En contenedores propios (`spinus-q-*`, puertos 54401–54404), clones de
`~/spinus-fusion/base-main` llevados al estado que se supone en producción (las
5 de `main`, sin M1 ni M2: reversa de M2, vuelta atrás de M1 y sus dos filas
quitadas del historial del clon) y con unas pocas filas inventadas (dos
clínicas, dos médicos, tres consultorios, dos eventos). Ningún contenedor
compartido; ninguna conexión a producción.

- **Base sana:** todas las filas OK (salvo INFO). Después, las 8 aplicadas en
  orden con `psql -v ON_ERROR_STOP=1`: las 8 entran, ninguna rejilla con
  REVISAR. El script `correr-conteos.sh` se ensayó contra un clon (contraseña
  por stdin, `CONTEOS_RED=host`): salida 0 limpia, salida 1 con un ALTO
  provocado, salida 3 con una contraseña mala; la contraseña no aparece en
  ningún archivo.
- **ALTO provocados**, cada uno visto en la rejilla y con la migración
  abortando de verdad en ese estado (y entrando al deshacerlo):

| Estado provocado | Fila | La migración |
|---|---|---|
| rol `supabase_admin` | G.02 | F4 aborta en su pre-vuelo |
| TRUNCATE de `audit_log` y `cat_cie10` concedido por `authenticated` | M1.4, M2.3, M2.4 | M1 aborta en el REVOKE; M2 en su pre-vuelo |
| `clinica_tiene_acceso()` con `\r\n` | F5a.3 | F5a aborta en su pre-vuelo |
| `get_my_role()` INVOKER | F1.2 | (sólo el conteo) |
| médico con consultorio activo sin predeterminado | F1.10 | F1 aborta en el pre-vuelo 1.4 |
| CHECK NOT VALID violada por un consultorio | C.1 (y C.3 AVISO) | F1 aborta en el UPDATE del backfill |
| tabla `agenda_ajustes` previa | F1.7 | F1 aborta en su pre-vuelo |
| función `rate_limit_espera(text)` previa | F3.4 | F3 aborta en su pre-vuelo |
| `appointments.google_asignacion` previa con valores | C.5, F2.6 | F2 aborta en el CHECK |
| índice inválido en `appointments` | F5b.3 | F5b aborta en su post-vuelo |
| `search_path` vacío | G.04 | F3 y F2 abortan en su post-vuelo |
| historial sin `20260919230000` | G.08 (y la G.09 de entonces, retirada) | la CLI la volvería a empujar (`db push --dry-run`) |
| historial con una versión desconocida | G.11 | la CLI se niega a empujar |
| sesión con un candado y transacción larga | G.15 (AVISO) | — |
