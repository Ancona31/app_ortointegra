# scripts/produccion — foto de la estructura de producción y comparador

Herramientas de la fase «agenda v2 lista para producción». **Ninguna escribe en
producción.** La única que se conecta a producción es `foto-produccion.sh`, y la
corre Angel en su terminal; las demás trabajan con la foto o con bases locales.

| Archivo | Para qué |
|---|---|
| `foto-produccion.sh` | Descarga SÓLO la estructura de producción a `~/spinus-produccion-foto/` |
| `sin-datos.sh` (+ `sin_datos.py`) | Comprueba que un volcado no trae datos |
| `comparar-estructura.sh` (+ `comparar_estructura.py`, `catalogo.sql`) | Compara la estructura de dos bases / fotos objeto por objeto |
| `clonar-desde-foto.sh` (+ `roles_desde_catalogo.py`) | Levanta un Postgres aparte con la estructura de una foto |
| `esperadas-clon.tsv` | Diferencias esperadas foto ↔ clon (con su razón) |

Requisitos: Docker encendido, `python3`, y la imagen de Postgres del stack local
(`docker inspect --format '{{.Config.Image}}' supabase_db_app_ortointegra`, hoy
`public.ecr.aws/supabase/postgres:17.6.1.167`; se puede forzar con `IMAGEN_PG`).
La CLI es `npx --yes supabase@2.117.0`. Ninguna dependencia nueva.

---

## 1. La foto de producción (lo corre Angel)

Desde la raíz del repo, con Docker encendido:

```bash
bash scripts/produccion/foto-produccion.sh
```

Pide la contraseña con `read -rs`: **se escribe en ese aviso**, no se ve, no va en
la línea de comandos y por tanto no queda en `~/.zsh_history`. Vive sólo en el
entorno del proceso y de los contenedores efímeros (`docker run -e PGPASSWORD`,
sin valor en la línea; `ps` no la enseña). La URL que recibe la CLI va **sin**
contraseña: `supabase db dump --db-url` la toma de `PGPASSWORD` (comprobado con
`--dry-run` contra la base local). **No uses `--dry-run` contra producción:
imprime la contraseña en claro.**

Conexión (no secreta, de `CLAUDE.md`): Session pooler
`aws-0-us-west-2.pooler.supabase.com:5432`, usuario `postgres.qpnegmmpneseirfyplbf`,
base `postgres`, `sslmode=require`. Nunca usa `--linked` ni `supabase link`.

Archivos que deben quedar en `~/spinus-produccion-foto/` (carpeta 700, archivos 600):

| Archivo | Contenido | Cómo |
|---|---|---|
| `00-version.txt` | `select version()` y `server_version` | psql |
| `01-roles.sql` | roles del clúster, sin contraseñas | `supabase db dump --role-only` |
| `02-esquema.sql` | estructura de los esquemas de la app (`public`, `private`, `respaldos`…) | `supabase db dump` (formato que Supabase documenta para restaurar sobre un proyecto) |
| `03-esquema-completo.sql` | estructura de **todos** los esquemas, con GRANT, policies, disparadores y disparadores de evento | `pg_dump --schema-only` |
| `04-migraciones.tsv` | `supabase_migrations.schema_migrations`: sólo `version` y `name` | psql |
| `05-catalogo.jsonl` | foto de catálogos para `comparar-estructura.sh` | psql + `catalogo.sql` |
| `06-buckets.tsv` | configuración de Storage (id, nombre, público, límites); ningún objeto | psql |
| `99-sha256.txt` | sumas de los anteriores | sha256sum |

Al final corre `sin-datos.sh` sobre la foto. Si algo falla, dice qué archivo; la
salida no contiene la contraseña.

**Por qué dos volcados de estructura.** `supabase db dump` excluye por omisión
`auth`, `storage`, `realtime`, `extensions`, `vault`, `graphql`, `graphql_public`,
`supabase_migrations`, `supabase_functions`, `pgbouncer`, `net`, `cron`,
`pgsodium`… (se ve con `--dry-run` contra local). Con eso se pierden cosas
NUESTRAS que viven en esos esquemas: el disparador `on_auth_user_created` sobre
`auth.users` y las 13 policies de `storage.objects` (comprobado en local). Y
comenta `CREATE PUBLICATION supabase_realtime` y los disparadores de evento. Por
eso `03-esquema-completo.sql` es `pg_dump --schema-only` de todo, y
`05-catalogo.jsonl` cubre también esos esquemas.

`04-migraciones.tsv`: si la tabla no existe, el archivo trae la cabecera y la
línea `# NO EXISTE supabase_migrations.schema_migrations`; si existe sin la
columna `name` (CLI antigua), sale `# la tabla existe pero no tiene la columna name`
y las versiones con el nombre vacío. La columna `statements` (el SQL de cada
migración) NO se descarga.

**Posibles fallos en producción (ASUMIENDO, no comprobado: no hay acceso):**
- en Supabase alojado `postgres` no es superusuario; si `pg_dump` da
  `permission denied` en algún esquema gestionado, repetir con, p. ej.,
  `FOTO_PGDUMP_EXTRA="--exclude-schema=vault" bash scripts/produccion/foto-produccion.sh`
  (la carpeta debe estar vacía: muévela antes);
- `pg_dump` 17 de la imagen local puede volcar un servidor 15 o 17; si
  producción fuera de una versión mayor, fallaría (lo dirá `00-version.txt`).
- La foto puede contener secretos incrustados en el CUERPO de alguna función (es
  estructura). Las variables `ALTER DATABASE/ROLE … SET` con pinta de secreto
  (`app.settings.jwt_secret`…) salen como `<oculto>` en el catálogo, y `pg_dump`
  sin `--create` no las vuelca. Trata la carpeta como confidencial.

### Ensayo contra la base local

Mismo script, cambiando sólo la conexión (lo que se probó):

```bash
printf 'postgres\n' | FOTO_HOST=127.0.0.1 FOTO_PUERTO=54322 FOTO_USUARIO=postgres \
  FOTO_SSL=disable FOTO_RED=host FOTO_DESTINO=/tmp/foto-local \
  bash scripts/produccion/foto-produccion.sh
```

(Por stdin sólo en ensayos; con terminal la pide con `read -rs`.)

---

## 2. `sin-datos.sh`

```bash
scripts/produccion/sin-datos.sh ~/spinus-produccion-foto/0*.sql ~/spinus-produccion-foto/04-migraciones.tsv
```

Lee las sentencias de **nivel superior** (lexer de comillas, `$…$` y
comentarios: un `INSERT` dentro del cuerpo de una función no cuenta). Falla con
`archivo:línea` ante `INSERT/UPDATE/DELETE/MERGE/VALUES`, `COPY … FROM stdin`
con filas, `setval` que no sea `setval('…', 1, false)`, objetos grandes, o un
literal sin cerrar. Excepción acotada: el archivo llamado `04-migraciones.tsv`
(u otro con `--historial NOMBRE`) sólo puede traer la cabecera `version<TAB>name`,
líneas `# …` y filas `dígitos<TAB>nombre`; cualquier otra columna es fallo.

---

## 3. `comparar-estructura.sh`

```bash
scripts/produccion/comparar-estructura.sh [opciones] FUENTE_A FUENTE_B
```

FUENTE: `contenedor:NOMBRE[:BASE]`, `url:CONNINFO` (sin contraseña; la toma de
`PGPASSWORD` o la pide), o una foto `.jsonl` (p. ej. `05-catalogo.jsonl`).
`--extraer FUENTE > foto.jsonl` sólo extrae.

Compara, leyendo catálogos (no texto de `pg_dump`): esquemas; tablas, vistas
(definición y md5), secuencias (parámetros, no su valor); columnas (orden, tipo,
nulabilidad, default, identidad, generadas, collation); restricciones e índices
(definición); funciones (firma, lenguaje, SECURITY DEFINER, `proconfig` /
search_path, volatilidad, estricta, paralelo, dueño, md5 del cuerpo y diff del
cuerpo); disparadores (definición y estado O/D/R/A) y disparadores de evento;
reglas; policies (comando, roles, USING, WITH CHECK, permisiva/restrictiva); RLS
activado y forzado; permisos por objeto y rol (esquemas, tablas, columnas,
secuencias, funciones; TRUNCATE incluido; ACL nulo = su default); default
privileges; extensiones y versión; tipos, enums, dominios; comentarios;
publicaciones y sus tablas; roles y membresías; `ALTER ROLE/DATABASE … SET`.
Los objetos que pertenecen a una extensión no se listan: los fija su versión.
**No cubre:** operadores, casts, clases de operadores, configuraciones de texto,
servidores FDW, tablespaces, estadísticas extendidas.

Opciones: `--esperadas ARCHIVO` (TAB: `estado tipo clave razón`; estado
`solo_a|solo_b|distinto|*`; glob en tipo y clave; razón obligatoria; avisa de
las que ya no aparecen), `--tsv`/`--json` (salida para otro script),
`--esquemas RE`, `--excluir-esquemas RE`, `--tipos a,b`, `--excluir-tipos a,b`,
`--etiquetas A,B`, `--silencioso` (no imprime las esperadas), `--guardar DIR`.
Sale 0 si no hay diferencias inesperadas, 1 si las hay, 2 si hay error.

Ejemplos:

```bash
# producción (foto) contra la base local, sólo lo de la app
scripts/produccion/comparar-estructura.sh --etiquetas prod,local --excluir-esquemas '^(auth|storage|realtime|vault|graphql.*|extensions|pgbouncer|supabase_functions|_realtime)$' \
  ~/spinus-produccion-foto/05-catalogo.jsonl contenedor:supabase_db_app_ortointegra
# tras ensayar migraciones en el clon: qué cambió respecto de la foto
scripts/produccion/comparar-estructura.sh --tsv /tmp/difs.tsv ~/spinus-produccion-foto/05-catalogo.jsonl contenedor:spinus-clon-produccion
```

---

## 4. Levantar una base local a partir de la foto

```bash
scripts/produccion/clonar-desde-foto.sh ~/spinus-produccion-foto            # contenedor spinus-clon-produccion, 127.0.0.1:54330
ESPERADAS=scripts/produccion/esperadas-clon.tsv scripts/produccion/clonar-desde-foto.sh ~/spinus-produccion-foto
docker rm -f spinus-clon-produccion                                          # al terminar
```

Qué hace, en orden:
1. Pasa `sin-datos.sh` a la foto (si falla, no restaura).
2. `docker run` de la **misma imagen** que el stack local, sólo en 127.0.0.1;
   superusuario `supabase_admin`, contraseña `postgres` (es un clon local sin datos).
3. **Roles:** `roles_desde_catalogo.py` crea los que falten con los atributos de
   la foto (sin contraseñas) y sus membresías; luego `01-roles.sql`. Hace falta
   porque `db dump --role-only` omite a propósito los reservados (`anon`,
   `supabase_*`…) y la imagen no trae todos (`supabase_realtime_admin` y
   `supabase_functions_admin` faltaban: 33 errores de restauración sin este paso).
4. **Base `postgres` vacía:** `DROP DATABASE postgres` + `CREATE DATABASE`. La de
   la imagen trae esquemas de arranque (`auth` con 5 tablas antiguas, `storage`,
   `realtime`, disparadores de evento) que chocarían con los de la foto.
5. **Estructura:** `03-esquema-completo.sql` con psql como `supabase_admin`
   (superusuario: puede crear extensiones, esquemas gestionados y objetos con
   dueño `supabase_admin`/`supabase_auth_admin`).
6. **Historial:** `04-migraciones.tsv` → `supabase_migrations.schema_migrations`
   (versión y nombre; `statements` vacío).
7. Compara el clon con `05-catalogo.jsonl`.

Para ensayar con el stack de Supabase completo (GoTrue, Storage…) esto no basta:
el clon es sólo Postgres. Para eso la vía documentada por Supabase es restaurar
`01-roles.sql` y `02-esquema.sql` sobre un stack recién levantado (y añadir a
mano lo de `auth`/`storage` que está en `03`). No se ensayó: exigiría otro stack
o `db reset`, prohibido en esta fase.

### Resultado comprobado (foto de la base local → clon)

0 errores de restauración y 13 diferencias, todas en `esperadas-clon.tsv`:
- 4 `config`: `ALTER DATABASE postgres SET app.settings.jwt_*` (pg_dump sin
  `--create` no los vuelca) y el `search_path` de dos roles reservados creados
  desde la foto;
- 8 `permiso` de `USAGE` sobre `graphql` y `graphql_public`: los da el disparador
  de evento `grant_pg_graphql_access` al crear la extensión, y `pg_dump` crea los
  disparadores de evento al final;
- 1 `restriccion` (`tipos_cita_duracion_check`): Postgres reescribe
  `(a AND b) AND c` como `a AND b AND c` al volver a leerla; mismo significado.
  Contra producción saldrán más de esta clase (CHECK con ANDs anidados): revísalas
  y añádelas con su razón, no con un glob amplio.

Con producción la lista puede cambiar (otros roles, otras extensiones): cada
diferencia nueva se mira y se añade con su razón.
