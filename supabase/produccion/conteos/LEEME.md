# Conteos antes de aplicar el conjunto a producción

`conteos.sql` reúne, como consultas de **sólo lectura**, todo lo que los
pre-vuelos (y los post-vuelos que miran el estado de antes) de las 8
migraciones nuevas exigen a la base, más lo que depende de la versión, del
historial de migraciones, del tamaño de las tablas y de la actividad del
momento. Devuelve **una rejilla**: una fila por comprobación,

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

**Qué devuelve y qué no.** Números, nombres de objetos de la base (tablas,
funciones, disparadores, restricciones, índices), nombres de roles, versiones
del historial y md5 de cuerpos de funciones. **Ningún dato de pacientes ni de
personas**: ni nombres, ni correos, ni teléfonos, ni títulos de citas, ni ids
de fila, de clínica o de médico. Donde hace falta saber *cuáles* son las filas
(F1.10, C.1), el LEEME da la consulta para que la corras tú, aparte.

---

## 1. Cómo correrlo

**Cuándo:** antes de aplicar la primera de las 8, y otra vez justo antes de
empezar (G.14 y G.15 miran la actividad de ese momento). Con todo OK (e INFO),
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
desde otra sesión). `appointments` **no se recorre**: su tamaño sale de
`pg_class.reltuples`. Las únicas cuentas de filas son sobre `consultorios`,
`clinicas` (horario), el historial y, si existiera, el respaldo de F1.

---

## 2. Fila por fila: qué significa, cuándo seguir y qué hacer si no

Las consultas «aparte» que se citan son de lectura y las corres tú con `psql`
(no van en la rejilla porque devuelven ids).

### G · general

| id | Qué significa | Sigue si | Si no |
|---|---|---|---|
| G.01 | Versión de Postgres. F3 concede `MAINTAIN` (`GRANT … MAINTAIN ON TABLE public.reserva_enlaces`), un privilegio que **sólo existe desde PG 17**; en 15 o 16 F3 falla con error de sintaxis. (M1 y M2 nombran MAINTAIN sólo en comentarios.) `mejora_agendaV2.md` §7 y §10 dicen «≥ 14»: se quedan cortos. | `≥ 17` | No apliques nada. O se actualiza el proyecto a PG 17 desde el panel de Supabase (Settings → Infrastructure) antes, o se pide al coordinador una variante de F3 sin `MAINTAIN`. Con M1 y M2 solas no hay problema de versión (≥ 14). |
| G.02 | El rol con el que se corre esto. F4 exige **exactamente** `postgres` (`current_user <> 'postgres'` aborta), y todas suponen que quien aplica es el dueño de las tablas. Corre el conteo con la MISMA conexión que usarás para aplicar. | `postgres` | Conéctate por el pooler con `postgres.qpnegmmpneseirfyplbf` (Supavisor lo convierte en `postgres`) y repite. Comprobado: corrido como `supabase_admin`, G.02 sale ALTO y F4 aborta en su pre-vuelo. |
| G.03 | BYPASSRLS del rol que aplica (F5b lo exige: `cita_tiene_nota_ligada` es DEFINER y su dueño tiene que ver todas las notas). | primer valor `true` | No apliques nada: `postgres` no puede darse BYPASSRLS a sí mismo. Mándale la fila al coordinador. |
| G.04 | `search_path` de la sesión, y si `public` es visible. **Comprobado:** con `search_path` vacío, los post-vuelos de **F3** («disparadores inesperados», compara `tgfoid::regproc::text`) y de **F2** (compara `pg_get_triggerdef` con `cita_asignacion_google()` sin esquema) abortan; las rejillas de F1 (3 filas) y F5b (fila 1) salen REVISAR. | `public visible: true` | Antes de aplicar, en la terminal donde aplicarás, mira `SHOW search_path;` (debe tener `public`). Si la sesión de la CLI no lo tuviera, no apliques: avisa al coordinador (lo limpio es que F3 y F2 comparen sin depender del `search_path`). Si sólo es el SQL Editor el que no lo tiene, no afecta a la CLI. |
| G.05 | `service_role` existe con BYPASSRLS (F2, F3 y F4: sus RPC son INVOKER y las llama `service_role`). | `true` | No apliques nada; manda la fila. |
| G.06 | Existen `anon`, `authenticated` y `service_role`. | `true / true / true` | No apliques nada: no es la base que el conjunto supone. |
| G.07 | Existe `supabase_migrations.schema_migrations` (cuántas versiones). | `sí (5 versiones)` | Sin ella la CLI la crea y trataría de aplicar las 13, empezando por `remote_schema`. No apliques con la CLI; manda la fila. |
| G.08 | Las 5 de `main` (`20260912190416`, `20260913`, `20260914`, `20260919`, `20260919230000`) están registradas. **Comprobado con la CLI 2.117.0** (`db push --dry-run` contra un clon): si falta una, la CLI la incluye en lo que empujaría. | `ninguna falta` | Comprueba en la foto si su efecto ya está en producción (para `20260919230000`, G.09b). Si está: regístrala tú con `npx supabase@2.117.0 migration repair --status applied <versión> --db-url …` (escribe sólo el historial; es decisión tuya). Si no está: esa migración tiene que aplicarse antes, con su propia auditoría. |
| G.09 | Caso particular de G.08: `20260919230000` (auth_02). Su cabecera decía «PENDIENTE DE APLICAR»; la foto del 2026-11-22 la enseña registrada y con su ACL (`DERIVA.md`, §2), y la cabecera ya está corregida. | `true` | Mira G.09b. Con el efecto presente (OK), regístrala con `migration repair --status applied 20260919230000`. Si no, la CLI la aplicará primero (es idempotente según su cabecera, pero pásala antes por su auditoría). |
| G.09b | El efecto de auth_02: EXECUTE de `rate_limit_intento` y `rate_limit_reset` sólo para `service_role`. | `…=false,false,true / …=false,false,true` | Si `anon` o `authenticated` tienen `true`, auth_02 no está aplicada (y hay un hueco de seguridad que ella cierra): aplícala la primera. `NO EXISTEN`: las funciones faltan; manda la fila. |
| G.10 | Alguna de las 8 nuevas ya registrada: la CLI la saltaría. | `ninguna` | Mira las filas «objetos que YA existen» de esa migración (M1.3, M2.5, F1.7, F5a.4, F3.4, F2.6, F4.4, F5b.4). Registrada sin sus objetos: el historial miente; `migration repair --status reverted <versión>` y vuelve a contar. Registrada con sus objetos: ya está aplicada; manda la rejilla antes de seguir con las demás. |
| G.11 | Versiones registradas que el repo no conoce. **Comprobado:** la CLI se niega a empujar (`Remote migration versions not found in local migrations directory`). | `ninguna` | Mira de dónde salen: `select version, name from supabase_migrations.schema_migrations where version in (…);`. Si son de otra rama (p. ej. las `20261014*` de `feature/limites-ajustables`), hay que integrar esa rama en local antes de empujar. **No** corras `db pull` ni `migration repair` sin plan. |
| G.12 | Extensiones instaladas y su esquema. Las 8 no usan ninguna (`gen_random_uuid`, `sha256`, `hashtext`, los candados consultivos son del núcleo; comprobado por grep); `btree_gist` la usa la EXCLUDE de `consultorios` de `main`. | `btree_gist presente` | Sin `btree_gist`, `consultorios_default_unico` no puede existir: `main` no es la que creemos. Manda la fila. |
| G.13 | Filas estimadas y tamaño de `appointments`, `consultorios`, `clinicas`, `audit_log`, `profiles`. F1, F3, F2 y F5b toman ACCESS EXCLUSIVE sobre `appointments` hasta su COMMIT; F2 recorre `appointments` una vez (su CHECK) y F5b construye tres índices (`statement_timeout` 60 s y 120 s). | INFO | Con < 10 000 citas es instantáneo (≈154 en la última medida de A1.8). Con cientos de miles, aplica en horario sin consultas y cuenta segundos de agenda congelada por archivo. Un `≈0` en una tabla con datos sólo significa que no se ha hecho ANALYZE. |
| G.14 | Otras sesiones con una transacción abierta hace más de 60 s, y cuántas están «idle in transaction». Retendrían candados y harían saltar el `lock_timeout` de 5 s de las migraciones. **Comprobado** en un clon con una sesión de prueba. | `0 / 0` | Espera y vuelve a contar. Para ver cuáles (sin el texto de las consultas): `select pid, usename, application_name, state, now() - xact_start from pg_stat_activity where xact_start < now() - interval '60 s';`. Si es una pestaña tuya del SQL Editor, ciérrala. No termines sesiones ajenas sin saber qué son. |
| G.15 | Candados de OTRAS sesiones (con transacción de más de 5 s) sobre las tablas que se alteran. **Comprobado** (sale `appointments:RowExclusiveLock` con una sesión de prueba). | `ninguno` | Igual que G.14: espera un minuto y repite; si persiste, identifica la sesión como en G.14. |
| G.16 | Si el rol ve la actividad de las demás sesiones (`pg_read_all_stats`). | `true` | G.14 y G.15 pueden contar de menos: aplica en un momento sin uso y no te fíes de su OK. |

### M1 · `20261125170000_audit_log_sin_truncate`

| id | Qué significa | Sigue si | Si no |
|---|---|---|---|
| M1.1 | `audit_log` existe y quien aplica actúa como su dueño. | `postgres / true` | No apliques nada; manda la fila. |
| M1.2 | `prevent_audit_modification()`: plpgsql, RETURNS trigger y **md5 exacto** del cuerpo `f1fe023a…` (el pre-vuelo lo exige byte a byte). La fila da también el md5 con los espacios normalizados (en `main`: `b3467f60…`). | `plpgsql / trigger / f1fe023a…` | Si el `norm` es `b3467f606cfb73a42e53780352fefd8b`, sólo cambian espacios o fines de línea (`\r\n`, ver §5): o se vuelve a crear la función con el cuerpo exacto del repo, o el coordinador ajusta el md5 del pre-vuelo; tú decides. Si el `norm` también difiere, la función es otra: manda `select pg_get_functiondef('public.prevent_audit_modification()'::regprocedure);` al coordinador. |
| M1.3 | `prevent_audit_truncate` ya existe. Con otra forma, M1 aborta (ALTO). Con la suya (AVISO), M1 ya se aplicó fuera de la CLI. | `no existe` | AVISO: mira G.10; si `20261125170000` no está registrada, regístrala con `migration repair --status applied 20261125170000`. ALTO: manda `select pg_get_triggerdef(oid) from pg_trigger where tgname = 'prevent_audit_truncate';`. |
| M1.4 | TRUNCATE sobre `audit_log` que el REVOKE de M1 no quitaría: concedido a PUBLIC, concedido por otro otorgante o heredado por pertenencia a otro rol. **Comprobado:** con un TRUNCATE concedido por `authenticated` (con GRANT OPTION), M1 aborta en el propio REVOKE («dependent privileges exist»). | `ninguno` | Mira quién lo concedió: `select a.grantee::regrole, a.grantor::regrole, a.is_grantable from pg_class c, aclexplode(c.relacl) a where c.oid = 'public.audit_log'::regclass and a.privilege_type = 'TRUNCATE';`. Otro otorgante: `REVOKE GRANT OPTION FOR TRUNCATE ON public.audit_log FROM <otorgante> CASCADE;` (comprobado: tras esto el conteo vuelve a OK). PUBLIC: `REVOKE TRUNCATE ON public.audit_log FROM PUBLIC;`. Pertenencia: manda la fila. Cualquiera de esas sentencias es un cambio en producción: decisión tuya. |
| M1.5 | Los disparadores de fila `prevent_audit_delete` y `prevent_audit_update`, activos (la rejilla de M1, fila 3). | `prevent_audit_delete:O,prevent_audit_update:O` | No aborta, pero si falta alguno **el `audit_log` de producción no es inmutable**: avisa antes de aplicar nada. |
| M1.6 | Policies de `audit_log` (la rejilla de M1, fila 5). | `audit_super_admin_select` | No aborta; su rejilla saldrá REVISAR. Mira la lista: una policy de más sobre `audit_log` hay que entenderla antes. |

### M2 · `20261126120000_public_sin_truncate`

| id | Qué significa | Sigue si | Si no |
|---|---|---|---|
| M2.1 | Quien aplica es miembro de `postgres` (lo exige `ALTER DEFAULT PRIVILEGES FOR ROLE postgres`). | `true` | Como G.02. |
| M2.2 | Las 11 tablas clínicas (`addendums`, `appointments`, `calculadora_resultados`, `casos_clinicos`, `casos_clinicos_recursos`, `consultas`, `documentos`, `mediciones_analitos`, `paciente_medico`, `pacientes`, `solicitudes_arco`) existen y quien aplica es su dueño. | `ninguna` | No apliques nada; manda la lista. |
| M2.3 | Réplica exacta del pre-vuelo: TRUNCATE de una tabla de `public` concedido a PUBLIC, concedido por quien no es el dueño, o en una tabla de un dueño del que quien aplica no es miembro (p. ej. creada por `supabase_admin`). **Comprobado:** con un TRUNCATE concedido por `authenticated`, M2 aborta en su pre-vuelo con la misma lista. | `ninguno` | Por cada entrada: PUBLIC → `REVOKE TRUNCATE ON public.<tabla> FROM PUBLIC;`; otro otorgante → `REVOKE GRANT OPTION FOR TRUNCATE ON public.<tabla> FROM <otorgante> CASCADE;`; dueño ajeno (`supabase_admin`) → postgres no puede quitarlo: manda la fila (hay que decidir la tabla con soporte de Supabase o dejar M2 fuera). |
| M2.4 | Lo que comprueba el post-vuelo: TRUNCATE **efectivo** que sobreviviría al REVOKE (incluye la pertenencia a otro rol, que M2.3 no ve). | `ninguno` | Lo de M2.3, y para la pertenencia: `select m.roleid::regrole, m.member::regrole from pg_auth_members m where m.member in ('anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole);` → manda la salida. |
| M2.5 | `public.prohibir_truncate` ya existe. Otra forma o sobrecargas → aborta (ALTO). Su forma (AVISO) → M2 ya se aplicó. | `no existe` | AVISO: como M1.3 con `20261126120000`. ALTO: manda `pg_get_functiondef` de la función. |
| M2.6 | Disparadores `trg_<tabla>_sin_truncate` que ya existen (los de otra forma abortan). | `ninguno` | Igual que M2.5. |
| M2.7 | Tablas de `public` cuyo dueño no es `postgres`. M2 no puede cambiar sus privilegios por omisión ni, si conceden TRUNCATE, quitárselo. | `ninguna` | Si alguna sale aquí y no en M2.3/M2.4, M2 entra (su rejilla, fila 8, la listará): sigue. Si sale también allí, manda la de M2.3. |
| M2.8 | Cuántas tablas de `public` conceden hoy TRUNCATE a los tres roles (lo que M1 y M2 quitarán). En un clon de `main` sin M1 ni M2: 29 (las 28 del inventario de M2 más `audit_log`). | INFO | — |

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
| F5a.2 | `clinica_no_suspendida()`: **md5 exacto** `a2dcfa8f…` (lo exige el pre-vuelo de F5a; F2 la evalúa y su rejilla, fila 8, lo compara). | md5 exacto igual | Si el `norm` es `588de29d551f6d474eb24346748e1148`, sólo difieren espacios o fines de línea (§5). Elige: volver a crear la función con el cuerpo exacto del repo, o que el coordinador ajuste el md5. Si el `norm` también difiere, la regla RN-1 de spinus-consola cambió: **no apliques**, manda `pg_get_functiondef`. |
| F5a.3 | `clinica_tiene_acceso()`: md5 exacto `2efd7734…`. **Comprobado:** con el mismo cuerpo pero fines de línea `\r\n`, F5a aborta («falta o cambió») y el `norm` (`59d2accd…`) sigue igual. | md5 exacto igual | Como F5a.2, con el `norm` `59d2accdf9baff7f8cc5b4f95b7d77dc`. |
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
| F5b.3 | Índices de `appointments` que no son válidos (restos de un `CREATE INDEX CONCURRENTLY` fallido). El post-vuelo de F5b aborta con **cualquiera**, también con uno ajeno a la agenda. **Comprobado.** | `ninguno` | Si el nombre es un resto conocido: `DROP INDEX CONCURRENTLY public.<nombre>;` (fuera de una transacción) y vuelve a contar. Si no sabes de dónde sale, manda el nombre. |
| F5b.4 | Objetos de F5b que ya existen. F5b es re-ejecutable con su forma exacta; en producción no debería haber ninguno. | `ninguno` | Intento anterior: no apliques; manda la lista. |

(BYPASSRLS del rol: G.03. Propiedad de `appointments`: F1.5.)

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

La foto de `scripts/produccion/foto-produccion.sh` (`~/spinus-produccion-foto/`,
todavía no tomada) es **sólo estructura**. Cuando exista, se puede clonar con
`scripts/produccion/clonar-desde-foto.sh` y correr este mismo `conteos.sql`
contra el clon: las filas de estructura ya dan la respuesta de producción.

| Se responde con la foto (estructura) | Sólo en producción |
|---|---|
| G.01 (`00-version.txt`); G.05, G.06 (roles); G.07–G.11 (`04-migraciones.tsv`); G.09b; G.12 | G.02 y G.04: describen la SESIÓN con la que se aplica |
| M1.1–M1.6; M2.1–M2.8 (los ACL van en el volcado) | G.03: el rol de la sesión (la foto trae los atributos de `postgres`, pero no que la CLI conecte como él) |
| F1.1–F1.8, F1.9 (que exista y su forma), F1.13, F1.14 | G.13: `reltuples` y tamaños (un clon está vacío) |
| C.3, C.4, C.5 | G.14, G.15, G.16: la actividad de ese momento |
| F5a.*, F3.*, F2.* (incluida la puerta S3), F4.* | F1.9 (cuántas filas tiene el respaldo), F1.10, F1.11, F1.12, C.1, C.2: cuentan filas |
| F5b.1, F5b.2, F5b.4 | F5b.3: `pg_dump` no vuelca los índices inválidos, así que el clon no los tiene |

Los md5 de las funciones (M1.2, F5a.2, F5a.3, F4.3) sí van en la foto, pero
**sólo si el volcado conserva el cuerpo byte a byte**: un `\r` del cuerpo
original se conserva en `pg_dump`, pero cualquier paso intermedio que
normalice fines de línea (git, un editor) lo borra. Para esas cuatro, la
respuesta buena es la de producción.

---

## 5. Condiciones de los pre-vuelos que pueden abortar sin un problema real

Probadas en clones; van también en el reporte al coordinador.

1. **El `search_path` de la sesión (G.04).** Comprobado: con `search_path`
   vacío abortan los post-vuelos de F3 y F2, que comparan nombres de función
   sin esquema (`regproc::text`, `pg_get_triggerdef`). Con el de Supabase
   (`"$user", public, extensions`) entran.
2. **md5 exactos frente a fines de línea (M1.2, F5a.2, F5a.3).** Comprobado: un
   cuerpo idéntico con `\r\n` hace abortar F5a, mientras que F4 compara con
   espacios normalizados y pasa. El proyecto se desarrolló en Windows hasta el
   2026-05-04 (`CLAUDE.md`): si alguna de esas funciones se creó desde allí,
   el md5 exacto no coincidirá aunque la lógica sea la misma.
3. **G.01 y el «≥ 14» de `mejora_agendaV2.md`.** F3 necesita PG 17 por
   `MAINTAIN` (deducido de la documentación de Postgres: el privilegio se
   introdujo en la 17; no se probó en una 15, no hay imagen local).
4. **Índices inválidos ajenos (F5b.3).** El post-vuelo de F5b aborta con
   cualquier índice inválido de `appointments`, aunque no sea suyo.
5. **El pre-vuelo de F2 no cuenta filas.** Si `appointments.google_asignacion`
   existiera con valores (C.5), F2 no aborta en el pre-vuelo sino en el
   `ADD CONSTRAINT` (comprobado). No es un falso positivo, pero sólo lo ve el
   conteo.
6. **F4 exige `current_user = 'postgres'` literal (G.02).** Por el pooler con
   `postgres.<ref>` lo es (DEDUCIDO de cómo nombra Supavisor al usuario; el
   conteo lo confirma en la misma conexión).

---

## 6. Cómo se probó (2026-11-22)

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
| historial sin `20260919230000` | G.08, G.09 | la CLI la volvería a empujar (`db push --dry-run`) |
| historial con una versión desconocida | G.11 | la CLI se niega a empujar |
| sesión con un candado y transacción larga | G.15 (AVISO) | — |
