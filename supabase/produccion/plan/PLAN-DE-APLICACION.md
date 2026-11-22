# Plan de aplicación en producción — agenda v2 (8 migraciones)

> Escrito y ensayado el 2026-11-22 (agente L, rama `feature/agenda-v2-produccion-l`).
> **En esta fase no se aplica nada.** Este documento es el guion para el día que
> Angel lo ordene. Todo lo que dice «[C]» se comprobó en contenedores locales
> (`spinus-l-*`); lo que dice «ASUMIENDO QUE…» no se pudo comprobar.
>
> Ensayado contra `~/spinus-fusion/base-main` (la base sin la agenda) **menos las
> dos de TRUNCATE**, que es lo que se cree que hay hoy en producción, con datos
> SINTÉTICOS (18 clínicas, 36 consultorios, 20 000 citas; y una pasada con
> 200 000). La foto real (`~/spinus-produccion-foto/`) **todavía no existe**: lo
> que cambia al verla está en el §10.

Archivos de esta carpeta:

| Archivo | Para qué |
|---|---|
| `aplicar.sh` | El único comando del día: `estado`, `respaldo`, `aplicar`, `reversa`. Pide la contraseña con `read -rs`. |
| `huellas.sha256` | sha256 de las 8 migraciones y las 6 reversas revisadas. `aplicar.sh` se niega a correr un archivo cuya huella no coincida. |
| `rejillas-del-ensayo.txt` | La rejilla final de cada archivo, literal, tal como salió en el ensayo. |
| `diferencias-antes-despues.base-main.tsv` | Las 952 diferencias de estructura antes → después del ensayo (provisional: se rehace con la foto real, §10). |
| `COMPROBACION-POSTERIOR.md` | Cómo comprobar que producción quedó idéntica al ensayo (paso 5). |

Las 8, en el orden obligatorio (el de nombre de archivo):

| # | Versión | Archivo | Qué es |
|---|---|---|---|
| 1 | 20261125170000 | `audit_log_sin_truncate` | audit_log sin TRUNCATE (no es de la agenda) |
| 2 | 20261126120000 | `public_sin_truncate` | `public` sin TRUNCATE (no es de la agenda; **pendiente de auditoría independiente** según su cabecera) |
| 3 | 20261201120000 | `agenda_f1_ajustes_tipos_horarios` | F1: ajustes, interruptor, tipos, auditoría de citas, **el único backfill** |
| 4 | 20261201130000 | `agenda_f5a_bloqueos` | F5a: bloqueos |
| 5 | 20261201140000 | `agenda_f3_reserva_enlace` | F3: reserva por enlace |
| 6 | 20261201150000 | `agenda_f2_google` | F2: Google |
| 7 | 20261201160000 | `agenda_f4_confirmacion_correos_avisos` | F4: confirmación, correos, avisos |
| 8 | 20261201170000 | `agenda_f5b_protecciones_cita` | F5b: disparadores de protección de `appointments` |

---

## 1. Cómo aplica la CLI 2.117.0 (comprobado) y qué vía se usa

### 1.1 `supabase db push --db-url …` — lo que hace de verdad [C]

Probado contra los clones `spinus-l-cli` y `spinus-l-cli2`, con la URL **sin
contraseña** y la contraseña en `PGPASSWORD`:

- **Compara contra `supabase_migrations.schema_migrations`** por versión (el
  prefijo numérico del nombre). `migration list` lo enseña así:

  ```
     Local            | Remote           | Time (UTC)
    ------------------|------------------|-----------------------
     `20260912190416` | `20260912190416` | `2026-09-12 19:04:16`
     `20260913`       | `20260913`       | `20260913`
     `20260914`       | `20260914`       | `20260914`
     `20260919`       | `20260919`       | `20260919`
     `20260919230000` | `20260919230000` | `2026-09-19 23:00:00`
     `20261125170000` | ` `              | `2026-11-25 17:00:00`
     …
  ```

  Las versiones cortas de `main` (`20260913`, `20260914`, `20260919`) se tratan
  como versiones normales; `20260919` va **antes** que `20260919230000` (el orden
  es el mismo como texto que como número), y se registran tal cual.
- **Cada archivo es UNA petición** (un lote de sentencias seguido del INSERT en
  el historial). El `BEGIN … COMMIT` del propio archivo se respeta. Si una
  sentencia de dentro falla, se deshace la transacción del archivo **y no se
  registra la versión**; los archivos anteriores quedan aplicados y registrados,
  y se para. Salida real con un pre-vuelo que aborta en el 4.º archivo (F5a;
  provocado creando antes una `public.agenda_bloqueos` falsa):

  ```
  Applying migration 20261201120000_agenda_f1_ajustes_tipos_horarios.sql...
  Applying migration 20261201130000_agenda_f5a_bloqueos.sql...
  ERROR: PRE-VUELO FALLÓ: public.agenda_bloqueos existe con otra forma. (SQLSTATE P0001)
  At statement: 3
  -- ---------------------------------------------------------------------
  -- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
  … (imprime la sentencia entera) …
  Try rerunning the command with --debug to troubleshoot the error.
  ```

  Historial después: `20261125170000`, `20261126120000`, `20261201120000`. Quitado
  el obstáculo, un segundo `db push` aplicó de F5a en adelante, sin repetir nada.
- **Guarda en `statements` cada sentencia**, incluida la rejilla `SELECT` final
  (8 sentencias para la nº 1: `BEGIN`, `SET LOCAL`, `DO`, `REVOKE`, `CREATE OR
  REPLACE TRIGGER`, `DO`, `COMMIT`, `SELECT`).
- **NO enseña la rejilla ni los NOTICE.** La salida entera de una pasada buena es:

  ```
  Applying migration 20261125170000_audit_log_sin_truncate.sql...
  …
  Applying migration 20261201170000_agenda_f5b_protecciones_cita.sql...
  Finished supabase db push.
  ```

  El veredicto de cada archivo (su rejilla) se pierde.
- **Aplica TODO lo pendiente de una vez**, tras un único `[Y/n]`. No hay pausa
  entre archivos.
- **Cuidado con el historial incompleto** [C]: si falta en el historial una
  versión de `main` más antigua que la última registrada, `db push` se niega
  («Found local migration files to be inserted before the last migration on
  remote database. Rerun the command with --include-all…»). Con `--include-all`
  las aplicaría. Y si la que falta es la **última** de `main` (`20260919230000`,
  la que su propia cabecera da por «PENDIENTE DE APLICAR»), `db push` **la
  aplicaría sin avisar**, junto con las 8. Si la tabla del historial no existe,
  `db push` quiere aplicar las 13, empezando por `remote_schema`, que en
  producción abortaría o algo peor.
- **`--dry-run` NO imprime la contraseña** (ni con `--debug`) [C] cuando va en
  `PGPASSWORD` y no en la URL. (Es `db dump --dry-run` el que la imprime: el
  README de `scripts/produccion/` lo advierte.) Con contraseña equivocada, la
  CLI dice `password authentication failed for user "postgres"` y no la repite.
- **Antes de migrar actualiza los secretos de Vault de `config.toml`** (lo dice
  `--help`). En `supabase/config.toml` la sección `[db.vault]` está comentada:
  no hace nada. `--include-seed` y `--include-roles` no se usan.
- La documentación oficial (`supabase.com/docs/reference/cli/supabase-db-push`,
  leída el 2026-11-22, ya de la v3) confirma el historial («Subsequent pushes will
  skip migrations that have already been applied») y **no dice nada de
  transacciones**: lo de arriba sale del ensayo, no de la documentación. En la v3
  `--db-url` está obsoleto (`--remote`); la 2.117.0 lo admite.

### 1.2 `supabase migration repair --status applied|reverted <versión> --db-url …` [C]

- Si la tabla del historial no existe, **la crea** (esquema
  `supabase_migrations`, dueño `postgres`) y registra la versión.
- Registra `version`, `name` y `statements` leídos del archivo local (por eso se
  corre desde la raíz del repo). No ejecuta nada del archivo.
- `--status reverted` borra la fila.
- Salida:

  ```
  Connecting to remote database...
  Repaired migration history: [20261201120000] => applied
  Finished supabase migration repair.
  ```

### 1.3 La vía recomendada: **psql archivo a archivo + `migration repair`**

`aplicar.sh aplicar` hace, por cada una de las 8:

1. comprueba que la versión no esté ya en el historial (si está, la salta);
2. comprueba la huella sha256 del archivo contra `huellas.sha256`;
3. pide que Angel **escriba la versión** para seguir;
4. `psql -X -v ON_ERROR_STOP=1 -f <archivo>` (la imagen de Postgres local, en un
   contenedor efímero, con `supabase/` montado sólo lectura);
5. si psql falla → para («no quedó nada de ella y NO se registró»);
6. si la rejilla tiene alguna fila `REVISAR` → para sin registrar;
7. `migration repair --status applied <versión>` y comprueba que la fila quedó.

**Por qué ésta y no `db push`:**

- **Se ve el veredicto.** Cada archivo termina en una rejilla diseñada para que
  quien aplica la lea (OK/INFO/REVISAR); `db push` la tira.
- **Un paso cada vez, con pausa y confirmación**, que es lo que pide el plan; `db
  push` aplica todas tras un `Y`.
- **Sólo toca las 8.** `db push` aplicaría también cualquier migración de `main`
  que no esté en el historial de producción (ver 1.1).
- Es como se ensayaron todas en local (las cabeceras dicen «psql -v
  ON_ERROR_STOP=1» o «SQL Editor, de una vez»).

**Lo que se pierde:** el registro deja de ser atómico con la migración (hay un
instante entre el `COMMIT` del archivo y el `repair`). Si el `repair` fallara, la
migración queda aplicada y sin registrar: se repite **sólo** el `repair`
(`aplicar.sh` lo dice). Si alguien volviera a correr el archivo, las seis de la
agenda abortan limpio o no cambian nada (cabecera de cada una) y las dos de
TRUNCATE son re-ejecutables: no hay daño.

**Vía de emergencia** (si `aplicar.sh` no sirviera ese día): el SQL Editor de
Supabase, pegando el archivo entero de una vez (enseña sólo el último resultado,
que es la rejilla), y luego el `repair` desde la terminal. No se usa `db push`.

### 1.4 Lo que depende del historial de producción (se decide al ver la foto)

`04-migraciones.tsv` de la foto dice qué hay. Tres ramas, **excluyentes**:

**(A) El historial tiene las 5 de `main`** (`20260912190416`, `20260913`,
`20260914`, `20260919`, `20260919230000`) y ninguna de las 8. Es el caso
ensayado. Se sigue el plan tal cual.

**(B) El historial existe pero le falta alguna de las 5.** No se aplica ninguna de
`main` en este plan. Por cada una que falte:
  1. se comprueba en la foto que su efecto ya está (ejemplos: `20260919` →
     `consultorios_default_unico` es una EXCLUDE en `05-catalogo.jsonl`;
     `20260914` → disparador `on_auth_user_created` en `03-esquema-completo.sql`;
     `20260913` → los `*_gates_insert` llaman a `perfil_completo()`;
     `20260919230000` → los GRANT de `rate_limit_intento`/`rate_limit_reset`);
  2. si está, se registra sin ejecutarla:
     `npx --yes supabase@2.117.0 migration repair --status applied <versión> --db-url "$URL"`
     (con la contraseña en `PGPASSWORD`; `aplicar.sh` no lo hace solo, a
     propósito);
  3. si **no** está (lo más probable sería `20260919230000`, auth_02), **se para**:
     es una migración fuera de este conjunto y necesita su propia auditoría y su
     propia orden de Angel. Las 8 no dependen de ella (ningún pre-vuelo la
     exige), así que puede ir después, pero hay que decidirlo antes.

  `aplicar.sh aplicar` avisa si falta alguna de `main` y pide escribir `SEGUIR`.

**(C) La tabla no existe** («# NO EXISTE supabase_migrations.schema_migrations» en
la foto). Igual que (B) para las cinco: se verifica cada efecto en la foto y se
registran con `repair` (que crea la tabla) **antes** de aplicar las 8. Así,
quien corra un `db push` en el futuro no intentará volver a aplicar
`remote_schema`.

Si la foto trae **alguna de las 8 ya registrada**, se para y se averigua (no
debería: nadie la ha aplicado).

---

## 2. La contraseña

- `aplicar.sh` la pide con `read -rsp` (no se ve, no va en la línea de comandos,
  no queda en `~/.zsh_history`), igual que `scripts/produccion/foto-produccion.sh`.
- Vive en `PGPASSWORD` de ese proceso y de sus contenedores efímeros (`docker run
  -e PGPASSWORD`, sin valor en la línea: `ps` no la enseña).
- La URL de la CLI va **sin** contraseña:
  `postgresql://postgres.qpnegmmpneseirfyplbf@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require`.
- Nunca `supabase link`, nunca `--linked`, nunca `-p`/`--password`, nunca `db push`.
- Los registros (`~/spinus-produccion-foto/aplicacion-<fecha>/*.log`) no la
  contienen: la CLI no la imprime ni al fallar [C].

Si conviene un comando suelto de la CLI ese día (rama B/C), la contraseña se
mete igual:

```bash
read -rs PGPASSWORD; export PGPASSWORD
URL='postgresql://postgres.qpnegmmpneseirfyplbf@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require'
npx --yes supabase@2.117.0 migration list --db-url "$URL"
unset PGPASSWORD
```

---

## 3. El día, paso a paso

Todo desde la raíz del repo, en la rama que se vaya a desplegar, con Docker
encendido, sin prisa. Cada paso deja su salida en la carpeta de la sesión.

### Paso 0 · Requisitos previos (si falta uno, no se empieza)

- [ ] Auditoría global del conjunto **aprobada** (`supabase/AUDITORIA-MIGRACIONES.md`;
      la nº 2, `public_sin_truncate`, dice «PENDIENTE DE AUDITORÍA INDEPENDIENTE»).
- [ ] La equivalencia independiente (E0) y el ensayo de código ↔ base (E2) en verde.
- [ ] La foto real tomada (`bash scripts/produccion/foto-produccion.sh`) y el
      **ensayo general repetido sobre su clon** (§10). `huellas.sha256` al día con
      los archivos que se aprobaron.
- [ ] Los conteos en OK (los del paso 3).
- [ ] **Orden explícita de Angel** para aplicar, ese día.
- [ ] Nadie más desplegando ni tocando la base. Ninguna `db push` de nadie.

### Paso 1 · Respaldo previo

**(a) El de Supabase** (documentación oficial, `supabase.com/docs/guides/platform/backups`,
leída el 2026-11-22):

- Pro, Team y Enterprise tienen **respaldo diario automático** (Pro: 7 días;
  Team: 14; Enterprise: hasta 30). El plan Free **no** lo menciona: allí sólo
  existe lo que uno exporte.
- PITR es un complemento de pago para Pro/Team/Enterprise (con PITR dejan de
  hacerse los diarios; el peor caso de pérdida son unos 2 minutos).
- Dónde mirar: Dashboard → **Database → Backups** (los diarios) y la sección
  **Point in Time**.
- Desde Postgres 15.8.1.079 los diarios son **físicos** y **no se descargan**:
  restaurar uno devuelve el proyecto ENTERO a ese momento (se perdería todo lo
  escrito después, también lo de los médicos). Es el último recurso, no la vuelta
  atrás normal: la vuelta atrás normal son las reversas (§7).
- **ASUMIENDO QUE** Spinus está en Pro (no lo puedo comprobar). Ese día Angel
  anota: plan, si hay PITR, y la hora del último respaldo diario que aparece en
  la lista. Si no hay ninguno (Free), el volcado propio de (b) es el único
  respaldo, y eso se decide antes de empezar.

**(b) El volcado lógico propio** — la ÚNICA operación del plan que saca datos de
pacientes de producción:

```bash
bash supabase/produccion/plan/aplicar.sh respaldo
```

- `pg_dump -Fc` de **toda** la base (estructura + datos, también `auth`: cuentas,
  **sesiones y refresh tokens**), pasado por `gpg --symmetric --cipher-algo
  AES256` al vuelo: **el volcado en claro nunca toca el disco**. gpg pide la frase
  dos veces; la frase no se apunta en el repo ni en el equipo.
- Destino: `~/spinus-produccion-foto/aplicacion-<fecha>/respaldo-<fecha>.dump.gpg`,
  carpeta 700, archivo 600, más su `.sha256`. Fuera del repo.
- Ensayado [C] (con la frase por stdin, sólo en ensayo):

  ```
  Volcado lógico COMPLETO (estructura + DATOS DE PACIENTES), cifrado con gpg AES256 al vuelo:
    …/respaldo-20261122-163050.dump.gpg   (el volcado en claro nunca toca el disco)
  Hecho: 744K. Compruébalo (pide la frase; no escribe nada en claro):
    gpg -d …dump.gpg | docker run --rm -i public.ecr.aws/supabase/postgres:17.6.1.167 pg_restore -l | grep -c 'TABLE DATA'
  ```

  La comprobación dio 79 tablas con datos (incluidas `auth.users`,
  `public.pacientes`, `public.audit_log`, `public.appointments`). **Hazla**: un
  número razonable (decenas) quiere decir que el respaldo se puede leer.
- Si `pg_dump` da `permission denied` en algún esquema gestionado de Supabase
  (**ASUMIENDO QUE** en producción `postgres` no es superusuario y puede pasar,
  como advierte el README de la foto): `RESPALDO_EXTRA="--exclude-schema=vault"
  bash supabase/produccion/plan/aplicar.sh respaldo`. Si falla, el script lo dice
  y el archivo no vale: `shred -u` y repetir.
- **Cuándo se borra:** cuando la comprobación posterior (paso 5) esté en verde y
  hayan pasado **7 días** sin necesitar nada de él (el respaldo diario de Supabase
  ya cubre esa ventana), con `shred -u respaldo-*.dump.gpg`. No se copia a la
  nube, a un USB ni a otro equipo; no se adjunta a nada.

### Paso 2 · La foto «antes»

`~/spinus-produccion-foto/` es la foto del ensayo general (y la carpeta donde
`aplicar.sh` deja sus registros, `aplicacion-<fecha>/`). El día se toma otra,
aparte, justo antes de aplicar:

```bash
FOTO_DESTINO=$HOME/spinus-produccion-foto-antes bash scripts/produccion/foto-produccion.sh
scripts/produccion/comparar-estructura.sh --etiquetas ensayo,hoy \
  ~/spinus-produccion-foto/05-catalogo.jsonl ~/spinus-produccion-foto-antes/05-catalogo.jsonl
```

Tiene que salir `0 diferencias (0 esperadas, 0 inesperadas)`. Si alguien cambió
producción desde el ensayo, **se para**: el ensayo ya no vale y se repite con la
foto nueva. La foto «antes» de la comprobación posterior es
`~/spinus-produccion-foto-antes/`.

### Paso 3 · Los conteos

```bash
bash supabase/produccion/plan/aplicar.sh estado
```

Sólo lee. Enseña la versión del servidor, **cuentas** (citas, consultorios,
clínicas, filas de `audit_log`; ningún dato), el historial y qué falta. En el
ensayo:

```
── servidor
PostgreSQL 17.6 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit
── tamaños (sólo cuentas; ningún dato): citas, consultorios, clínicas, audit_log
200000|36|18|72
── historial (supabase_migrations.schema_migrations)
20260912190416
20260913
20260914
20260919
20260919230000
pendiente:     20261125170000_audit_log_sin_truncate
…
pendiente:     20261201170000_agenda_f5b_protecciones_cita
```

Se anotan las cuatro cuentas (sirven para el paso 5: las filas de `audit_log`
sólo pueden subir, y deben subir exactamente en el número de consultorios por el
backfill de F1, más lo que la app escriba mientras tanto). Los conteos de la
auditoría global (paso 0) tienen que coincidir con lo que dé aquí.

### Paso 4 · Las 8 migraciones

```bash
bash supabase/produccion/plan/aplicar.sh aplicar
```

Pide `PRODUCCION`, la contraseña, y luego, antes de cada archivo, que se escriba
su versión. Cualquier otra respuesta para sin dejar nada a medias. Lo que se ve
en una buena (ensayo, la nº 1):

```
════ 20261125170000_audit_log_sin_truncate
Para aplicarla escribe su versión (20261125170000); cualquier otra cosa para parar: 20261125170000
BEGIN
SET
COMMIT
 n | comprobacion                                                                              | valor                 | esperado              | estado
---+-------------------------------------------------------------------------------------------+-----------------------+-----------------------+--------
 1 | TRUNCATE: anon / authenticated / service_role                                             | false / false / false | false / false / false | OK
 …
duración: 0.27 s
Connecting to remote database...
Repaired migration history: [20261125170000] => applied
Finished supabase migration repair.
✓ 20261125170000_audit_log_sin_truncate aplicada y registrada.
```

(Rejilla resumida; la literal de las 8 está en `rejillas-del-ensayo.txt`: 59
filas OK, 10 INFO, 0 REVISAR.) Lo que hay que mirar en cada una:

| # | Filas | Mirar especialmente | NOTICE esperados (no son errores) |
|---|---|---|---|
| 1 | 7 | fila 7: filas de `audit_log` (no cambian) | — |
| 2 | 8 | fila 2: cuántas tablas perdieron TRUNCATE (28 en el ensayo, 30 en local; en producción, las que haya); fila 8: «ninguna» | `schema "pg_temp" does not exist, skipping` |
| 3 F1 | 15 | 11: 0 con `horario_propio = false`; 12: consultorios respaldados = **todos** los consultorios (36 en el ensayo); 13 y 14: 0 | — |
| 4 F5a | 6 | todas OK | 6 × `policy/trigger … does not exist, skipping` |
| 5 F3 | 9 | 9: censo 0 / 0 / 0 | — |
| 6 F2 | 9 | 8: md5 de `clinica_no_suspendida`/`clinica_tiene_acceso` = `a2dcfa8f…` / `2efd7734…` | 1 × `policy … does not exist, skipping` |
| 7 F4 | 8 | 7: los 7 tipos de aviso | — |
| 8 F5b | 7 | 6: 3 índices válidos; 7: 0 inválidos | 6 × `trigger … does not exist, skipping` |

Duraciones medidas [C] (incluyen ~0,25 s de arrancar el contenedor de psql):

| # | 20 000 citas | 200 000 citas |
|---|---|---|
| 1 | 0,27 s | 0,30 s |
| 2 | 0,29 s | 0,30 s |
| 3 F1 | 0,35 s | 0,41 s |
| 4 F5a | 0,29 s | 0,28 s |
| 5 F3 | 0,36 s | 0,48 s |
| 6 F2 | 0,51 s | 0,76 s |
| 7 F4 | 0,41 s | 0,32 s |
| 8 F5b | 0,37 s | 1,01 s |

Por el pooler de producción, cada sentencia lleva además la latencia de red
hasta `us-west-2` (**ASUMIENDO QUE** del orden de decenas de ms por sentencia;
F4 tiene 122 sentencias): espera segundos por archivo, no milisegundos. Lo que
manda en los bloqueos es eso (§5).

**Si un archivo falla**, `aplicar.sh` para con un `ALTO:` que dice qué hacer (§7).

Terminadas las 8: `bash supabase/produccion/plan/aplicar.sh estado` → las 8
«ya registrada».

### Paso 5 · La comprobación posterior

`COMPROBACION-POSTERIOR.md` entero. Si algo no cuadra, no se despliega el
código y se decide entre arreglar o revertir (§7).

### Paso 6 · El despliegue del código

Después del paso 5 en verde, y con las variables del paso 7 ya puestas (Vercel
lee las variables **al construir**: una variable puesta después no llega hasta
el siguiente despliegue). Ver §4 para el orden y por qué.

### Paso 7 · Las variables de Vercel

Ver §8. Se ponen **antes** del paso 6 (o se redespliega después de ponerlas).

### Paso 8 · Encender la v2 en UNA clínica

Sólo cuando el §9 esté resuelto. El interruptor `agenda_ajustes.agenda_v2_encendida`
**sólo** lo cambian `postgres`/`supabase_admin` (`trg_agenda_ajustes_proteger`):
desde el SQL Editor, para la clínica de pruebas de Angel, y nada más. Lo que se
prueba después está en `mejora_agendaV2.md` §7 y §10.

---

## 4. Código y base: el orden seguro

Lo que prevé el diseño (`mejora_agendaV2.md` §7, fila «Aplicar»): **migraciones
primero, código después.** Los dos órdenes son seguros, pero:

- **Código nuevo sobre base sin migrar:** el código falla cerrado. Lee el
  interruptor tolerando la tabla o la RPC ausentes (`42P01`, `PGRST202`) y las
  cuenta como «v2 apagada»; la agenda es la de antes. Coste: un `warn` en el log
  por petición (hallazgo H3) y las tareas de `vercel.json` sin nada que hacer.
- **Base migrada con el código viejo (el que hay hoy en producción):** el código
  viejo no conoce las tablas nuevas y no las toca. Lo que cambia son los
  disparadores que actúan con la v2 apagada (§6): p. ej., cambiar de estado una
  cita atendida con nota daría al código viejo un 42501 que no sabe traducir
  (error genérico en vez del 409 `nota_ligada` del código nuevo).

Por eso: aplicar (paso 4) → comprobar (paso 5) → variables (paso 7) →
desplegar (paso 6) **en la misma sesión**, para que la ventana «base nueva +
código viejo» dure minutos.

> **PENDIENTE DEL ENSAYO DE E2.** E2 ensayará las dos direcciones contra una base
> migrada y sin migrar. Lo que habría que ver: con el código nuevo y la base sin
> migrar, la agenda abre y crea/mueve/cancela citas igual que hoy, sin 500, y el
> log sólo tiene los `warn` esperados; con la base migrada y el código viejo, lo
> mismo, salvo los rechazos del §6 (atendida con nota), y `audit_log` empieza a
> recibir las filas de `log_cita_change`. Hasta que E2 lo confirme, el orden de
> arriba es el del diseño, no un hecho comprobado.

---

## 5. Bloqueos y ventana

Cada archivo es UNA transacción: cada candado se mantiene **hasta su COMMIT**.
Todos llevan `SET LOCAL lock_timeout = '5s'` (y `statement_timeout` 60 s; F5b
120 s; las dos de TRUNCATE sólo `lock_timeout`).

| # | Tabla | Candado | Qué frena |
|---|---|---|---|
| 1 | `audit_log` | SHARE ROW EXCLUSIVE | escrituras de `audit_log` (toda acción auditada espera) |
| 2 | las 11 tablas clínicas (`pacientes`, `consultas`, `documentos`, `addendums`, `mediciones_analitos`, `appointments`, …) | SHARE ROW EXCLUSIVE | escrituras de esas tablas |
| 3 F1 | `appointments`, `consultorios`, `clinicas` | **ACCESS EXCLUSIVE** | **lecturas y escrituras**; `clinicas` la leen las funciones de la RLS (`get_clinica_id()`, `clinica_tiene_acceso()`): prácticamente **toda la app** espera |
| 3 F1 | `profiles` | SHARE ROW EXCLUSIVE (FK) | escrituras de perfiles |
| 4 F5a | `clinicas`, `profiles` | SHARE ROW EXCLUSIVE | escrituras |
| 5 F3 | `appointments` | **ACCESS EXCLUSIVE** | lecturas y escrituras de citas |
| 6 F2 | `appointments` | **ACCESS EXCLUSIVE** | lecturas y escrituras de citas |
| 7 F4 | `appointments`, `clinicas`, `profiles` + tablas nuevas | SHARE ROW EXCLUSIVE | escrituras |
| 8 F5b | `appointments` | **ACCESS EXCLUSIVE** + SHARE (3 `CREATE INDEX` no concurrentes) | lecturas y escrituras de citas mientras se construyen los índices |

Ninguna toca `auth.users` (grep de las 8: sólo comentarios).

**Medido [C].** Una sonda leyendo citas sin parar (60 000 lecturas, como la
agenda de un médico) mientras se aplicaban las 6 de la agenda sobre 20 000 citas:
lectura normal ≤ 3 ms; la peor, **92 ms**; sólo 4 lecturas pasaron de 3 ms. Es
decir, un médico no nota nada en local. En producción la ventana crece con la
latencia del pooler (§3, paso 4): **ASUMIENDO QUE** del orden de segundos por
archivo, durante los cuales la agenda (y, en F1, toda la app) se queda «pensando»
y luego responde. Nadie ve un error salvo que su petición tenga un timeout menor
que esa espera.

**El caso malo: `lock_timeout`** [C]. Con una sesión que tenía abierta una
lectura de `appointments` (como un informe largo o una conexión colgada), F1
esperó 5 s y abortó:

```
psql:/s/migrations/20261201120000_agenda_f1_ajustes_tipos_horarios.sql:471: ERROR:  canceling statement due to lock timeout
ALTO: 20261201120000_agenda_f1_ajustes_tipos_horarios FALLÓ (ver arriba). Va en una transacción: no quedó nada de ella y NO se registró. Plan §7.
```

Comprobado después: ni `agenda_ajustes` ni `tipos_cita` existían (las había
creado antes de la línea 471 y se deshicieron), y el historial no tenía la
versión. **Mientras espera esos 5 s, todo lo que llega detrás a esa tabla
también espera** (así funciona la cola de candados de Postgres): un médico puede
ver la app parada hasta 5 s. Qué hacer: mirar quién tiene la tabla
(`select pid, state, xact_start, left(query, 60) from pg_stat_activity where datname = 'postgres' and xact_start < now() - interval '30 seconds';`
— enseña consultas, no datos), esperar a que acabe y **repetir sólo ese archivo**
(`aplicar.sh aplicar` salta las ya registradas). No subir el `lock_timeout`.

**A qué hora.** Cuando no haya consulta: **ASUMIENDO QUE** de noche (después de
las 22:00, hora del centro) o domingo temprano. No coincidir con la tarea
`google-sync` (cada 10 min) importa poco porque todavía no está desplegada en el
paso 4. Calcula 30–45 minutos para todo el día (pasos 1–7), la mayor parte en
leer.

---

## 6. Punto de no retorno, y lo que un médico notaría con la v2 APAGADA

**El punto de no retorno es el COMMIT de F1 (nº 3).** Es el único archivo que
cambia datos existentes: copia a cada consultorio el `horario_consulta` de su
clínica y lo marca `horario_propio = true`, con respaldo previo en
`respaldos.consultorios_horario_20261119` y una fila `UPDATE` de `user_id
'system'` en `audit_log` por consultorio. Desde ahí:

- `audit_log` tiene filas que **no se borran nunca** (también las de la reversa:
  en el ensayo, 36 de la copia y 36 de la vuelta);
- la reversa de F1 devuelve el horario previo sólo a los consultorios que nadie
  editó después (los editados se quedan como estén) y **conserva** el respaldo;
- el horario EFECTIVO no cambia (antes heredaban el de la clínica y ahora lo
  tienen copiado), y **con la v2 apagada la app de hoy no lee `consultorios.horario`**
  (la agenda vieja usa `config?.horario`, el de la clínica; en `main` ninguna
  pantalla enseña el horario de un consultorio — grep de `src` en `main`).

Todo lo demás es estructura nueva que nace vacía y detrás del interruptor
(apagado en todas las clínicas: `agenda_ajustes` nace sin filas, y sin fila
cuenta como apagado). Las dos de TRUNCATE sólo quitan un privilegio que nadie
usa.

**Lo que actúa aunque la v2 esté apagada** — lo que alguien podría notar el
mismo día:

| Desde | Qué | Quién lo notaría |
|---|---|---|
| nº 1 y 2 | `TRUNCATE` de `audit_log` y de las tablas de `public` falla para `anon`/`authenticated`/`service_role`, y un disparador lo impide a `postgres` sobre `audit_log` y las 11 tablas clínicas | nadie (ningún código hace TRUNCATE; grep de la cabecera de la nº 1). Quien limpie tablas a mano en el SQL Editor con TRUNCATE, sí |
| F1 | **`log_cita_change`**: cada alta, borrado y cambio no técnico de una cita escribe una fila en `audit_log` (nombres de columna, nunca valores). También las escrituras de la sincronización de Google vieja | nadie en pantalla; `audit_log` crece más rápido y el panel de auditoría del super-admin enseña filas de `appointments` |
| F1 | backfill de horarios (arriba) | nadie con la v2 apagada |
| F2 | `cita_asignacion_google` en cada alta de cita: pone `google_asignacion` (NULL salvo lo que importe el sondeo nuevo) | nadie |
| F3 / F5b | `cita_proteger_reserva`: una sesión no puede escribir columnas `reserva_*` | nadie (el código viejo no las conoce) |
| F5b | **`cita_proteger_atendida`**: una cita **atendida con nota clínica ligada** no cambia de estado, ni de fecha/hora/todo el día, ni se borra — con la v2 encendida **o apagada**, también para `service_role` | **un médico que intente mover, cancelar o borrar una cita atendida con nota.** Con el código viejo verá un error genérico; con el nuevo, el 409 `nota_ligada` con su texto |
| F5b | `cita_proteger_cierre`: sólo el servidor cierra una cancelada (columnas nuevas) | nadie |
| F5b | `cita_proteger_eleccion`, `_bloqueo`, `_borrado` | nadie: actúan sólo sobre citas por enlace o con la v2 encendida |
| F1–F5b | `appointments` está en la publicación `supabase_realtime` con todas sus columnas: las nuevas viajan en los mensajes de tiempo real | nadie (van NULL mientras la v2 esté apagada) |

Las acciones referenciales (borrar una clínica en cascada, poner a NULL el
paciente de una cita) corren como dueño (`postgres`) y los disparadores las
dejan pasar.

---

## 7. Si falla a medias

Regla general: **cada archivo es una transacción**. Si aborta, de ese archivo no
queda nada y su versión no se registra; los anteriores quedan aplicados y
registrados. Para seguir basta con volver a correr `aplicar.sh aplicar`: salta
lo registrado.

### 7.1 Por paso

| Si aborta en… | Estado de la base | Qué hacer |
|---|---|---|
| 1 (audit_log) | como antes | leer el error (pre-vuelo: md5 de `prevent_audit_modification` distinto, otro otorgante…) y consultar; nada que deshacer |
| 2 (public) | nº 1 aplicada | ídem; la nº 1 sola es segura y se puede quedar |
| 3 F1 | 1–2 aplicadas; **ningún dato tocado** | si es `lock_timeout`: §5, repetir. Si es un pre-vuelo: parar y consultar. Nada que deshacer |
| 4 F5a | F1 aplicada: `agenda_ajustes` vacía, auditoría de citas ya activa, horarios copiados | repetir tras quitar la causa. F1 sola es coherente: la v2 está apagada y el código (viejo o nuevo) la ve apagada |
| 5 F3 | F1, F5a | ídem. Sin F3 no hay reserva; nadie la puede pedir (no hay enlaces) |
| 6 F2 | F1, F5a, F3 | ídem. **La reserva por enlace falla (42883) hasta aplicar F2**; nadie puede llamarla todavía |
| 7 F4 | F1, F5a, F3, F2 | ídem |
| 8 F5b | F1–F4 | ídem. Sin F5b faltan las protecciones: **no se enciende la v2** hasta tenerla |
| el `repair` después de un archivo bueno | archivo aplicado, sin registrar | repetir **sólo** `npx --yes supabase@2.117.0 migration repair --status applied <versión> --db-url "$URL"` |
| rejilla con REVISAR | archivo aplicado (COMMIT hecho), sin registrar | no seguir; mandar `*.salida.txt` y decidir: registrar o revertir ese archivo |

Ensayado [C]: el `lock_timeout` en F1 (§5) y su recuperación (se soltó la
sesión, se volvió a correr: `ya está en el historial: se salta` para las dos
primeras y F1–F5b aplicadas); y con `db push`, el pre-vuelo de F5a (§1.1).

### 7.2 No seguir y quedarse a medias

Es válido parar en cualquier punto entre archivos y dejarlo así días: cada
prefijo del orden es coherente con la v2 apagada (es para lo que se ordenó F1 →
F5a → F3 → F2 → F4 → F5b). Lo que **no** se hace es desplegar el código ni
encender nada hasta tener las 8.

### 7.3 La reversa completa (sólo con orden de Angel)

```bash
bash supabase/produccion/plan/aplicar.sh reversa
```

Corre las reversas de `supabase/reversas/` en orden inverso de bloques —**F5b,
F4, F2, F3, F5a, F1**—, pidiendo que se escriba `REVERTIR <versión>` antes de
cada una, y quita cada versión del historial (`migration repair --status
reverted`). Ensayado [C] sobre el clon con las 8 aplicadas: las seis en verde, y
después, comparado con la foto «antes», sólo quedaban las dos de TRUNCATE y la
tabla de respaldo (lo esperado). Después se volvió a aplicar todo y quedó idéntico
al primer ensayo (0 diferencias).

Antes, **apagar la v2 en todas las clínicas y respaldar** lo que la reversa va a
perder. Guardas (abortan sin tocar nada):

| Reversa | Aborta si… | Pierde |
|---|---|---|
| F5b | hay canceladas cerradas (`cerrada_en`) | las protecciones (reabre borrados y cambios de atendidas con nota): hazlo con la v2 apagada |
| F4 | `cita_confirmaciones`, `cita_reagendos`, `cita_correos` o `avisos_clinica` tienen filas; o no corre como `postgres` | confirmaciones, correos, avisos |
| F2 | quedan disparadores de F4 | tokens de sincronización, empalmes, rechazados, la marca «por asignar» |
| F3 | quedan F4/F5b o F2; hay filas en sus tablas o citas nacidas de un enlace | enlaces, verificaciones, candado, columnas `reserva_*` |
| F5a | quedan funciones que la nombran (F5b, F2, F3); hay bloqueos | los bloqueos |
| F1 | quedan objetos de bloques posteriores; falta el respaldo | ajustes e interruptor, tipos de cita (y qué tipo tenía cada cita), qué consultorios tienen horario propio o revisado, el huso de fábrica. **No aborta por datos**: respaldar antes con los `CREATE TABLE respaldos.…_AAAAMMDD AS SELECT …` de su cabecera |

Lo que la reversa no quita: `respaldos.consultorios_horario_20261119` (se queda a
propósito) y las filas de `audit_log` (nunca).

### 7.4 Las dos de TRUNCATE (aparte, sólo si Angel lo pide)

No entran en `aplicar.sh reversa`: deshacerlas **reabre el hueco** (TRUNCATE no
pasa por la RLS ni por la auditoría).

- nº 2: `supabase/reversas/20261126120000_public_sin_truncate_reversa.sql`, con
  psql y luego `migration repair --status reverted 20261126120000`. Ojo: su
  inventario es el de la base local; si en producción la fila 2 de la rejilla
  listó otras tablas, se añaden antes (lo dice su cabecera).
- nº 1: no tiene archivo de reversa; está en su cabecera («VUELTA ATRÁS»):
  `DROP TRIGGER IF EXISTS prevent_audit_truncate ON public.audit_log;` y `GRANT
  TRUNCATE ON public.audit_log TO anon, authenticated, service_role;`, y `repair
  --status reverted 20261125170000`.

---

## 8. Vercel

Comprobado en el código (`grep` en `src/` y `vercel.json`, 2026-11-22) y en la
documentación de Vercel (`vercel.com/docs/cron-jobs/manage-cron-jobs`, leída el
2026-11-22).

| Variable | Cómo se genera | Entorno | Si falta |
|---|---|---|---|
| `RESERVA_SECRETO` | `openssl rand -hex 32` (64 caracteres hex; `src/lib/reserva/secretos.ts` exige ≥ 64 hex, si no lo da por ausente) | Production | la reserva y la confirmación por enlace fallan cerradas: no se emiten enlaces («Sin `RESERVA_SECRETO` no se emiten enlaces», `PasosConfiguracion.tsx`) |
| `EMAIL_TRANSPORT` | el literal `resend` | Production | los correos de la agenda no salen (`decidirTransporte`: `sin_variable` → apagado). Necesita `RESEND_API_KEY`, que ya existe, y una `NEXT_PUBLIC_SUPABASE_URL` remota |
| `CRON_SECRET` | `openssl rand -hex 32` (Vercel pide ≥ 16 caracteres válidos en una cabecera: letras y números; sin espacios ni saltos de línea al pegar) | Production | `/api/cron/google-sync` (cada 10 min) y `/api/cron/recordatorios` (cada 15 min) responden 401 a cada llamada (`src/lib/cronAutorizacion.ts`: sin secreto, `false`) |
| `AGENDA_RSVP_GOOGLE` | el literal `encendido` | Production | apagado por omisión (`src/lib/gcalRsvp.ts`). **Sólo después de la prueba de RSVP con Google real** |

- Los valores se generan en la terminal de Angel y se pegan directamente en
  Vercel → Project → Settings → Environment Variables (como «Sensitive»). No se
  escriben en ningún archivo, ni en el repo, ni en `.env.local` de producción.
- **Cuándo:** después del paso 5 y **antes** del despliegue (paso 6). Vercel
  captura las variables **al construir**: cambiarlas no afecta al despliegue que
  ya corre hasta el siguiente. Las tareas de `vercel.json` se registran con ese
  despliegue y sólo corren en el de producción.
- **Preview:** no se ponen (**ASUMIENDO QUE** las previews no deben usar la agenda
  v2). Un `RESERVA_SECRETO` distinto en otro entorno que hablara con la misma base
  produciría enlaces que producción no reconoce.
- **Rotar `RESERVA_SECRETO` invalida todos los enlaces de reserva y de
  confirmación y el historial del candado.** Se genera una vez y se guarda en el
  gestor de contraseñas de Angel (Vercel no lo vuelve a enseñar si es «Sensitive»).
- Rotar `CRON_SECRET`: editar, redesplegar y mirar la primera invocación en
  Schedules → Cron Jobs → View Logs (2xx).
- **ASUMIENDO QUE el proyecto de Vercel está en Pro.** En Hobby, Vercel rechaza el
  despliegue si una tarea corre más de una vez al día, y las dos de `vercel.json`
  corren cada 10 y 15 minutos: **el despliegue fallaría**. Comprobarlo antes del
  paso 6.

---

## 9. Lo que no es de este plan pero bloquea ENCENDER la v2

Aplicar las 8 y desplegar no enciende nada. Para el paso 8 hace falta, además
(detalle en `mejora_agendaV2.md` §7 y §10):

- **Texto legal:** el aviso de privacidad de la reserva
  (`src/lib/reserva/avisoReserva.ts`) está PENDIENTE DE REVISIÓN LEGAL; mientras
  lleve la marca, el enlace no abre aunque se apruebe su hash. Los demás textos
  PENDIENTE DE REVISIÓN (lista en §10), y decidir si el consentimiento de los
  pacientes existentes cubre recordatorios y WhatsApp. Contra la LFPDPPP vigente
  (2025), no de memoria.
- **Google real:** ida y vuelta, sincronización antes de reservar, RSVP (y sólo
  entonces `AGENDA_RSVP_GOOGLE`); revisar el panel de auditoría (`user_id =
  'system'`).
- **PostgREST con `imatch`** (búsqueda de pacientes; sale sin interruptor, así que
  se comprueba en cuanto se despliega: `COMPROBACION-POSTERIOR.md`, humo 5).
- Las decisiones pendientes de Angel de `mejora_agendaV2.md` §7.

---

## 10. Cuando exista la foto real (`~/spinus-produccion-foto/`)

Hay que ajustar, en este orden:

1. **§1.4:** con `04-migraciones.tsv`, elegir la rama A, B o C. Si B/C, verificar
   en la foto el efecto de cada versión de `main` que falte.
2. **Repetir el ensayo general sobre el clon de la foto real**, con `aplicar.sh`
   en modo ensayo (los comandos están en `COMPROBACION-POSTERIOR.md` §0). Es lo
   que fija la lista de diferencias esperadas (sustituye a
   `diferencias-antes-despues.base-main.tsv`) y la de esperadas del clon (puede
   crecer: CHECK con AND anidados, otros roles, otras extensiones).
3. **Pre-vuelos con md5/texto:** F5a, F2 y F4 exigen el cuerpo exacto de
   `clinica_no_suspendida()` y `clinica_tiene_acceso()` (`a2dcfa8f…`,
   `2efd7734…`, normalizado `588de29d…`), la nº 1 el de
   `prevent_audit_modification()` (`f1fe023a…`). Si producción difiere, abortan
   limpio: se ve en el ensayo sobre el clon, no el día.
4. **Rejillas:** las cuentas INFO (tablas sin TRUNCATE, consultorios respaldados)
   salen con los números de producción; anotarlas en este plan.
5. **Versión de Postgres** (`00-version.txt`): ≥ 14 (todas usan `CREATE OR
   REPLACE TRIGGER`); si es mayor que la 17 de la imagen local, `pg_dump`/`psql`
   de `aplicar.sh` podrían no servir: forzar `IMAGEN_PG`.
6. **Permisos de `pg_dump`** en esquemas gestionados (respaldo, paso 1b): si la
   foto necesitó `FOTO_PGDUMP_EXTRA`, el respaldo necesitará el mismo
   `RESPALDO_EXTRA`.
7. **Volumen:** con las cuentas reales de citas, recalcular la ventana de F5b
   (índices) y F2 (CHECK que recorre la tabla).
8. **`huellas.sha256`:** regenerarla con los archivos que se aprueben al final
   (`sha256sum supabase/migrations/2026112* supabase/migrations/202612*
   supabase/reversas/202612* > supabase/produccion/plan/huellas.sha256`), en el
   mismo commit que la aprobación.

Y después de aplicar de verdad: la línea `-- ESTADO · PRODUCCIÓN` de cada uno de
los 8 archivos, con fecha y la comprobación usada (`AUDITORIA-MIGRACIONES.md` §7),
en un commit. (Cambia sus huellas: es lo esperado, `aplicar.sh` ya no hace falta.)
