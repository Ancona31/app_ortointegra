# Plan de aplicación en producción — agenda v2 (9 migraciones)

> Rehecho el 2026-11-22 (agente QL; el ensayo se repitió entero tres veces tras sendos cortes del equipo, la última con todo en un solo clon, rama `feature/agenda-v2-produccion-ql`)
> tras la foto real de producción y las correcciones C1, C2, C3 y T. Sustituye
> al borrador del agente L, que era anterior a la foto.
> **En esta fase no se aplica nada.** Es el guion para el día que Angel lo
> ordene. «[C]» = comprobado en un clon de la foto real (contenedores
> `clon-spinus-ql-*`, PostgreSQL 17.6, `postgres` NO superusuario, como en
> producción); «[N]» = comprobado por otro agente y anotado en
> `supabase/fusion/notas/`; «ASUMIENDO QUE…» = no se pudo comprobar.
>
> **Actualizado por el agente PL (2026-11-22, rama
> `feature/agenda-v2-produccion-pl`):** el conteo previo real de producción
> (§4, paso 3), las ventanas de candado medidas con el volumen real (§5), el
> orden **«código primero, base inmediatamente después»** (decisión de Angel,
> §6), la regla de reversa (§10) y la tabla exacta de variables de Vercel (§6.2).
> «[C-PL]» = comprobado por PL en un clon de la foto con datos sintéticos del
> tamaño real (§5).
>
> **Actualizado por el agente CA (2026-11-22, rama
> `feature/agenda-v2-produccion-ca`) tras la auditoría independiente, ronda 1
> (`../auditoria/RONDA-1.md`):** `aplicar.sh` manda **cada archivo en una sola
> petición** y acota la transacción ociosa (A1, §2 y §5); tras un fallo
> **pregunta al catálogo** en vez de afirmar, y se detiene si no puede leer el
> historial (A2, §8); la reversa **comprueba toda la cadena antes de empezar**
> (A5, §10); el respaldo fallido ya no deja un archivo con nombre válido (A8).
> Además: se aplica **a una hora sin consulta** (§4, paso 0), `CRON_SECRET`
> **antes de desplegar** (§6.2), la medición de la agenda al encender (§15) y los
> límites aceptados (§14). «[C-CA]» = comprobado por CA en el clon
> `clon-spinus-ca-1` de la foto real, con el guion nuevo; salidas en
> `~/spinus-fusion/ensayo-ca/` (fuera del repo).

Archivos de esta carpeta:

| Archivo | Para qué |
|---|---|
| `aplicar.sh` | El único comando del día: `estado`, `respaldo`, `aplicar`, `reversa`, `reversa-truncate`. |
| `huellas.sha256` | sha256 de las 9 migraciones y sus 9 reversas, tal como están hoy. `aplicar.sh` se niega a correr un archivo cuya huella no coincida. |
| `reversa-previa.sql` | Sólo lee. `aplicar.sh reversa` la corre antes de la primera reversa: reúne las negativas de toda la cadena (§10.1). |
| `rejillas-del-ensayo.txt` | La rejilla final de cada archivo, literal, del ensayo de punta a punta sobre el clon de la foto (§11). |
| `diferencias-antes-despues.clon-foto.tsv` | Las 965 diferencias de estructura antes → después de ese ensayo (claves: estado, tipo, esquema, clave, campo). |
| `COMPROBACION-POSTERIOR.md` | Cómo comprobar que producción quedó idéntica al ensayo (paso 7). |

Los conteos de sólo lectura de antes están en `../conteos/` (`LEEME.md`).

---

## 1. Las 9, en el orden obligatorio (el de nombre de archivo)

| # | Versión | Archivo | Qué es | Rol exigido |
|---|---|---|---|---|
| 1 | 20261125170000 | `audit_log_sin_truncate` | `audit_log` sin TRUNCATE (no es de la agenda) | dueño de `audit_log` |
| 2 | 20261126120000 | `public_sin_truncate` | `public` sin TRUNCATE (no es de la agenda; **pendiente de auditoría independiente**) | `postgres` exacto |
| 3 | 20261201120000 | `agenda_f1_ajustes_tipos_horarios` | F1: ajustes, interruptor, tipos, auditoría de citas, **el único backfill** | dueño de 4 tablas |
| 4 | 20261201130000 | `agenda_f5a_bloqueos` | F5a: bloqueos | dueño |
| 5 | 20261201140000 | `agenda_f3_reserva_enlace` | F3: reserva por enlace | dueño |
| 6 | 20261201150000 | `agenda_f2_google` | F2: Google | dueño |
| 7 | 20261201160000 | `agenda_f4_confirmacion_correos_avisos` | F4: confirmación, correos, avisos | `postgres` exacto |
| 8 | 20261201170000 | `agenda_f5b_protecciones_cita` | F5b: protecciones de `appointments` | `postgres` exacto, con BYPASSRLS |
| 9 | 20261201180000 | `agenda_sin_truncate` | T: disparador contra TRUNCATE en las 11 tablas de la agenda con datos de personas (**aparte del conjunto fundido**, va la última; pendiente de auditoría independiente) | dueño |

**Con qué rol se conecta:** `postgres`, por el **Session pooler**
(`aws-0-us-west-2.pooler.supabase.com:5432`, usuario
`postgres.qpnegmmpneseirfyplbf`, base `postgres`, `sslmode=require`); Supavisor
lo presenta como `postgres` (DEDUCIDO de cómo nombra al usuario; G.02 de los
conteos lo confirma en la misma conexión). En la foto `postgres` es dueño de
todo `public`, NO es superusuario y tiene BYPASSRLS (`DERIVA.md` §4–§5). Así se
ensayó. **No** se aplica como `supabase_admin` (F4 y F5b abortan; las funciones
quedarían suyas) ni por el Transaction pooler (6543), que no garantiza la misma
sesión para todo un archivo.

El historial de producción es el que el plan supone [C, `04-migraciones.tsv`]:
las 5 de `main` (`20260912190416`, `20260913`, `20260914`, `20260919`,
`20260919230000`) y ninguna de las 9. Las ramas B/C del borrador anterior
(historial incompleto o ausente) ya no aplican; si el día G.07, G.08, G.10 o
G.11 de los conteos no salen OK, **se para** y se toma otra foto.

---

## 2. Qué comando corre Angel, y por qué no `db push`

**El comando del día es uno:**

```bash
bash supabase/produccion/plan/aplicar.sh aplicar
```

Por cada una de las 9: comprueba que no esté ya en el historial (si está, la
salta; si no puede LEER el historial, se detiene), comprueba en el catálogo que
no esté ya aplicada sin registrar (su objeto testigo, §8), comprueba su sha256
contra `huellas.sha256`, pide escribir su versión, la ejecuta con `psql` (imagen
de Postgres 17.6 del stack local, en un contenedor efímero), para si `psql`
falla o si su rejilla tiene alguna fila `REVISAR`, y la registra con la CLI:
`npx --yes supabase@2.117.0 migration repair --status applied <versión>
--db-url <URL sin contraseña>`. Comprueba que la fila quedó en el historial.

**Cómo viaja cada archivo (A1, desde la oleada 3, ronda 1): ENTERO, EN UNA SOLA
PETICIÓN.** Cada archivo es una sesión de `psql` con tres peticiones:

```bash
psql -X -v ON_ERROR_STOP=1 -P pager=off \
  -c "SET idle_in_transaction_session_timeout = '10s'; SET lock_timeout = '5s'; SET statement_timeout = '120s'" \
  -c "SELECT 'sesión: …' || current_setting(…)"   \   # deja en la salida los tres ajustes, para verlos
  -c "<el archivo entero>"
```

- **Qué hace `psql -c` con un texto de varias sentencias** (documentación de
  `psql` de PostgreSQL 17, opción `-c`,
  https://www.postgresql.org/docs/17/app-psql.html, leída el 2026-11-22):
  «Each SQL command string passed to -c
  is sent to the server as a single request. Because of this, the server
  executes it as a single transaction even if the string contains multiple SQL
  commands, unless there are explicit BEGIN/COMMIT commands included in the
  string to divide it into multiple transactions.» Los 9 archivos y las 9
  reversas traen su `BEGIN; … COMMIT;` y, después, la `SELECT` de la rejilla:
  el servidor ejecuta la transacción del archivo tal cual y la rejilla en su
  propia transacción implícita. Un solo mensaje de consulta simple del
  protocolo; el servidor no espera al cliente entre sentencias.
  **[C-CA] Medido en el registro del servidor** (`log_min_duration_statement =
  0` en el clon): **3 peticiones por archivo** (los SET, la línea de ajustes y
  el archivo), en las 28 sesiones de archivo del ensayo; con `-f` eran 7–200
  (una por sentencia).
- **La rejilla y los NOTICE se siguen viendo.** psql 17 enseña el resultado de
  CADA sentencia del texto (variable `SHOW_ALL_RESULTS`, activa por omisión;
  la descripción de la variable no se releyó literal: el comportamiento se
  comprobó en el clon) y los NOTICE/WARNING según llegan. Misma página: en
  `-c` «you cannot mix SQL and psql meta-commands». [C-CA] Las 9 rejillas del
  ensayo con el guion nuevo son **idénticas byte a byte** a las del guion viejo
  (`rejillas-del-ensayo.txt`, `diff` vacío), con los mismos NOTICE.
- **Se detiene igual.** Ante un error, el servidor deja de ejecutar el resto
  del texto y deshace la transacción abierta; `psql` sale con 1 [C-CA: F3 con un
  candado ajeno → `canceling statement due to lock timeout`, F3 no quedó, el
  guion paró; con una fila `REVISAR` provocada, paró igual]. Lo que queda
  aplicado tras un fallo es lo mismo que con `-f`: todo el archivo o nada,
  porque cada archivo es una transacción (salvo un fallo DESPUÉS de su `COMMIT`,
  que el guion ahora detecta: §8).
- **`SET LOCAL`, bloques `DO $$…$$` y comillas**: van dentro del texto, que el
  servidor analiza entero; `psql` no lo trocea ni interpola variables en `-c`.
  Ningún archivo usa meta-comandos `\…` (comprobado con `grep`): con `-c` no se
  podrían mezclar con SQL.
- **Tamaño:** un argumento de la línea de órdenes no puede pasar de 128 KiB en
  Linux (`MAX_ARG_STRLEN` = 131 072 bytes). El mayor, F3, tiene 103 708 bytes
  (con las correcciones de la ronda 1).
  `aplicar.sh` se niega, sin correr nada, a mandar un archivo de 130 000 bytes o
  más.
- **Una diferencia nueva:** como el servidor ya tiene el archivo entero, **si el
  cliente se corta a media aplicación, el servidor TERMINA el archivo** (y lo
  confirma) aunque nadie vea la rejilla [C-CA, §5.2]. Por eso, tras un fallo,
  `aplicar.sh` pregunta al catálogo (§8).
- **Los tres ajustes de sesión** van con SQL (`SET`), no con `PGOPTIONS`: un
  `SET` en la propia sesión pasa por cualquier pooler en modo sesión. Que
  Supavisor deje pasar opciones de arranque (`PGOPTIONS`/`options`) no se pudo
  comprobar sin producción, y así no hace falta. La línea «sesión:
  idle_in_transaction_session_timeout=10s, lock_timeout=5s,
  statement_timeout=2min» de cada `*.salida.txt` confirma que se aplicaron.

**Por qué `psql` + `migration repair` y no `supabase db push`:**

- **La rejilla.** Cada archivo termina en una rejilla OK/INFO/REVISAR para que
  quien aplica la lea; `db push` no enseña ni la rejilla ni los NOTICE (lo
  comprobó el agente L con la 2.117.0). Una fila REVISAR **no aborta** (por
  diseño: es «míralo»), así que con `db push` pasaría sin que nadie la viera. Es
  lo que manda.
- **Uno cada vez.** `aplicar.sh` pide confirmación antes de cada archivo y
  permite parar entre dos (cada prefijo del orden es coherente con la v2
  apagada, §10.2). `db push` aplica todo lo pendiente tras un único `[Y/n]`.
- **Sólo las 9.** `db push` aplicaría también cualquier archivo de
  `supabase/migrations/` que no esté en el historial. Hoy no hay ninguno de más
  (el historial cuadra con las 5 de `main`), así que este motivo pesa menos que
  en el borrador.
- Lo que antes `db push` hacía mejor —mandar cada archivo en una sola petición,
  sin un viaje por sentencia— ahora lo hace también `aplicar.sh` (arriba). Con
  `-f`, el ACCESS EXCLUSIVE de F3 y F2 sobre `appointments` duraba 90 y 60
  viajes; medido con 150 ms de ida y vuelta, 13,5 s y 8,9 s. Con una petición,
  50 y 30 ms (§5).

**Sobre «se aplica a producción con la CLI» (CLAUDE.md, flujo del 2026-11-22).**
Este plan **usa la CLI para registrar** (`migration repair`) pero **no para
ejecutar**: ejecuta `psql`. Si Angel entiende «con la CLI» como «con
`supabase db push`», esta decisión no se sostiene y hay que decidirla: la
alternativa equivalente sería `npx --yes supabase@2.117.0 db push --db-url
"$URL"` (URL sin contraseña, contraseña en `PGPASSWORD`), perdiendo las
rejillas, y suplir su lectura con la comprobación posterior entera (que sí
detectaría una diferencia de estructura, pero no una fila INFO con un número
inesperado). **Recomendación: `aplicar.sh`.** Decisión de Angel.

**Lo que se pierde con `aplicar.sh`:** el registro no es atómico con la
migración (entre el `COMMIT` del archivo y el `repair` hay un instante). Si el
`repair` fallara, la migración queda aplicada y sin registrar: se repite **sólo**
el `repair` (§8). Volver a correr el archivo no hace daño (§9).

**Vía de emergencia** (si `aplicar.sh` no sirviera ese día): el SQL Editor de
Supabase, pegando el archivo entero de una vez (enseña sólo el último resultado,
que es la rejilla) y luego el `repair` desde la terminal. Nunca `db push` a
medias con `aplicar.sh`.

---

## 3. La contraseña y por qué `aplicar.sh` no puede ir a producción por accidente

Revisado línea a línea el 2026-11-22 [C, lectura y ensayo]:

- **Producción sólo a propósito.** Si el host es `127.0.0.1`, `localhost` o
  `::1`, es un ENSAYO. **Cualquier otro host** (por omisión, el pooler) es
  PRODUCCIÓN y exige escribir `PRODUCCION` antes de pedir la contraseña; si el
  host no es el pooler de siempre, además avisa. Después, cada archivo pide que
  se escriba su versión, y cada reversa `REVERTIR <versión>`. (El borrador sólo
  pedía `PRODUCCION` si el host era literalmente el pooler: con la conexión
  directa `db.<ref>.supabase.co` se habría tratado como ensayo. Corregido.)
- **La contraseña:** si `PGPASSWORD` ya está en el entorno, la usa (lo dice, sin
  imprimirla); si no, la pide con `read -rsp` (no se ve, no va en la línea de
  comandos, no queda en `~/.zsh_history`). Vive en el entorno del proceso y de
  los contenedores efímeros (`docker run -e PGPASSWORD`, sin valor en la línea:
  `ps` no la enseña). Nunca se escribe en disco ni en los registros; no se
  imprime [C: buscada en todos los registros del ensayo, no aparece].
- La URL de la CLI va **sin** contraseña:
  `postgresql://postgres.qpnegmmpneseirfyplbf@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require`.
- **Nunca** `supabase link`, `--linked`, `db push`, `-p`/`--password` ni
  `--dry-run` de `db dump` (que imprime la contraseña). `aplicar.sh` sólo llama
  a la CLI para `migration repair`.
- Los registros quedan en `~/spinus-produccion-foto/aplicacion-<fecha>/`
  (carpeta 700, archivos 600, fuera del repo).

---

## 4. El día, paso a paso

Todo desde la raíz del repo, en la rama que se vaya a desplegar, con Docker
encendido.

### Paso 0 · Requisitos previos (si falta uno, no se empieza)

- [ ] Auditoría global aprobada (`supabase/AUDITORIA-MIGRACIONES.md`; la 2 y la
      9 dicen «PENDIENTE DE AUDITORÍA INDEPENDIENTE»).
- [ ] La equivalencia (E0) y el ensayo de código ↔ base (E2) en verde.
- [ ] `huellas.sha256` regenerado con los archivos aprobados (§12, punto 1).
- [ ] Los conteos en OK (paso 3), corridos por Angel **ese mismo día**, justo
      antes de aplicar: el conteo previo del 2026-11-22 no vale por sí solo.
- [ ] **Orden explícita de Angel**, ese día.
- [ ] **Se aplica a una hora sin consulta** (decisión de Angel): ninguna
      clínica atendiendo ni agendando. Aunque con el guion nuevo la ventana con
      `appointments` cerrada es de decenas de milisegundos (§5), código y base
      se tocan en la misma sesión y, si algo sale mal, hay que poder parar sin
      nadie en consulta.
- [ ] Nadie más desplegando ni tocando la base.
- [ ] Las variables de Vercel del §6.2 preparadas (generadas en la terminal de
      Angel, sin escribirlas en ningún archivo), **`CRON_SECRET` incluida: se
      pone ANTES de desplegar** (§6.2).

> **El orden del día (decisión de Angel, 2026-11-22): CÓDIGO PRIMERO y la BASE
> inmediatamente después, en la misma sesión**, con la v2 apagada en todas las
> clínicas (como nace). Pasos 1–3 preparan; 4 despliega el código; 5 comprueba
> que la app sigue igual; 6 aplica las 9; 7 comprueba; 8 enciende (otro día).
> Por qué y la alternativa, en §6.1.

> ### ⚠️ REVERSA — LA REGLA, ANTES DE NADA
> **Antes de revertir CUALQUIER migración, apagar la v2 en TODAS las clínicas.**
> Revertir F3 (o más) con la v2 encendida en una clínica le rompe la agenda (500
> al mover o cancelar) [C, E2 5.5.4]. **Las reversas, sólo con `aplicar.sh
> reversa` / `reversa-truncate`**, que reparan el historial; nunca a mano (§10).
> Si el problema es del CÓDIGO y la base aún no se tocó, no hay reversa de base:
> se vuelve al despliegue anterior de Vercel (paso 5).

### Paso 1 · Respaldo previo

**(a) El de Supabase.** El proyecto está en **Pro** (confirmado por Angel): hay
respaldo diario automático con 7 días de retención (documentación oficial,
`supabase.com/docs/guides/platform/backups`, leída por el agente L el
2026-11-22). Son físicos y no se descargan: restaurar uno devuelve el proyecto
ENTERO a ese momento. Es el último recurso; la vuelta atrás normal son las
reversas (§10). Ese día se anota la hora del último diario (Dashboard →
Database → Backups) y si hay PITR.

**(b) El volcado lógico propio** — la ÚNICA operación del plan que saca datos de
pacientes de producción:

```bash
bash supabase/produccion/plan/aplicar.sh respaldo
```

`pg_dump -Fc` de toda la base cifrado al vuelo con `gpg --symmetric --cipher-algo
AES256` (el volcado en claro nunca toca el disco), en
`~/spinus-produccion-foto/aplicacion-<fecha>/respaldo-<fecha>.dump.gpg` con su
`.sha256`. Comprobarlo con la línea que imprime al final (cuenta tablas con
datos). Si `pg_dump` diera `permission denied` en un esquema gestionado:
`RESPALDO_EXTRA="--exclude-schema=vault"`. Se borra con `shred -u` a los 7 días
si nada lo necesitó. No se copia a ningún otro sitio. El volcado se escribe a
`respaldo-<fecha>.dump.gpg.parcial` y **sólo se renombra si `pg_dump` y `gpg`
salieron bien** (A8): si algo falla, borra el parcial y dice «NO hay respaldo»;
no queda ningún archivo con nombre de respaldo bueno. [C-CA: con `pg_dump`
forzado a fallar, ese mensaje y la carpeta sin `.gpg`; uno bueno del clon, con su
`.sha256` verificado, se descifró y `pg_restore -l` lo leyó.]

### Paso 2 · La foto «antes»

```bash
FOTO_DESTINO=$HOME/spinus-produccion-foto-antes bash scripts/produccion/foto-produccion.sh
scripts/produccion/comparar-estructura.sh --etiquetas ensayo,hoy \
  ~/spinus-produccion-foto/05-catalogo.jsonl ~/spinus-produccion-foto-antes/05-catalogo.jsonl
```

Tiene que salir `0 diferencias`. Si alguien cambió producción desde la foto del
ensayo, **se para**: se repite el ensayo (§11) con la foto nueva.

### Paso 3 · Los conteos y el estado

```bash
bash supabase/produccion/conteos/correr-conteos.sh
bash supabase/produccion/plan/aplicar.sh estado
```

Los conteos: todo OK o INFO (en el clon de la foto, 73 OK y 5 INFO [C]); qué
hacer con cada fila, `../conteos/LEEME.md`. Lo que sólo producción sabe y hay
que mirar: **G.13b** (número de citas: ventanas de §5), **G.14/G.15**
(transacciones y candados abiertos: si hay, esperar), **G.17** (trabajos de
`pg_cron` que toquen `appointments`/`clinicas`: aplicar fuera de su horario),
**G.18/F5b.3** (índices inválidos), **F1.10/C.1/C.2** (lo que haría abortar el
backfill). `estado` enseña versión, usuario y `search_path` de la sesión, cuatro
cuentas (citas, consultorios, clínicas, filas de `audit_log`) y el historial: se
anotan las cuentas para el paso 7.

#### Conteo previo del 2026-11-22 (Angel, contra producción, 21:08)

Rejilla en `~/spinus-produccion-foto/conteos-20261122-210851.txt` (fuera del
repo; aquí sólo cifras). **78 filas: 73 OK, 5 INFO, 0 AVISO, 0 ALTO** [C,
leída por PL]. Las 5 INFO son las esperadas: G.13 (tamaños), M2.8 (29 tablas
con TRUNCATE para los tres roles: `audit_log` y las 28 del inventario de la
reversa de la nº 2, igual que la foto), F1.11 (lo que reescribirá el backfill),
T.1 y T.2 (privilegios por omisión con TRUNCATE de `postgres` y de
`supabase_admin`, los tres roles).

| Dato | Rejilla | Lo que dijo Angel |
|---|---|---|
| citas (G.13b, `count` exacto) | **247** | 247 |
| clínicas / consultorios / perfiles (G.13, por `reltuples`, estimado) | ≈17 / ≈18 / ≈20 | 17 / 18 / 20 |
| filas de `audit_log` (G.13, estimado) | ≈9 679 (3,5 MB) | unas 9 700 |
| backfill de F1 (F1.11) | **18 consultorios (17 activos / 1 archivado) · 13 clínicas · 15 médicos** | lo mismo |
| G.14 / G.15 (transacciones y candados de otras sesiones) | ninguna / ninguno | — |
| G.17 (`pg_cron` que nombre `appointments`/`clinicas`) | ninguno (1 trabajo activo en total) | — |
| G.18 / F5b.3 (índices inválidos) | ninguno / ninguno | — |
| F1.10 / C.1 / C.2 (lo que abortaría el backfill) | 0 / ninguna / 0 | — |
| G.01 / G.02 / G.03 | 17.6 / `postgres` / BYPASSRLS sí, no superusuario | — |
| G.07–G.11 (historial) | 5 versiones, las de `main`; ninguna de las 9 | — |

Las cifras de Angel y las de la rejilla coinciden (las de clínicas, consultorios,
perfiles y `audit_log` en la rejilla son estimaciones de `reltuples`; la exacta
de consultorios la da F1.11: 18).

**Este conteo hay que REPETIRLO justo antes de aplicar** (el mismo
`correr-conteos.sh`, el mismo día, después del paso 5 y antes del 6).

> **Justo antes de empezar el paso 6 (orden de Angel): las filas de sesiones y
> candados abiertos.** En la rejilla de ese conteo repetido, mirar **G.14**
> (otras sesiones con una transacción abierta hace más de 60 s), **G.15**
> (candados de otras sesiones, con transacción de más de 5 s, sobre las tablas
> que se alteran) y **G.16** (si el rol ve la actividad de las demás). **Valor
> aceptable: G.14 `ninguna`, G.15 `ninguno` y G.16 `true`.** Cualquier otra
> cosa: no se empieza; esperar un minuto y repetir el conteo (si es una pestaña
> propia del SQL Editor, cerrarla); si persiste, identificar la sesión como dice
> `../conteos/LEEME.md` (G.14) sin terminar sesiones ajenas. Con G.16 en
> `false`, G.14 y G.15 pueden contar de menos: no fiarse de su OK. Ojo: G.14
> sólo enseña transacciones de más de 60 s y G.15 de más de 5 s; lo más corto
> no frena nada (las migraciones esperan hasta 5 s y abortan limpias).
> Y `aplicar.sh estado` enseña la **ida y vuelta medida** (mediana de 5
> `select 1`): se anota; es el RTT real de la terminal de Angel al pooler (A1,
> criterio c).
>
> **Prueba de humo de petición grande (orden de Angel), también en `aplicar.sh
> estado`, de SÓLO LECTURA:** manda, por el MISMO camino que una migración (los
> tres `-c`), UNA petición del tamaño del archivo mayor del conjunto (calculado
> del archivo cada vez; hoy F3, ~104 KB): `BEGIN TRANSACTION READ ONLY;`, relleno
> de comentarios, una línea que dice el tamaño recibido por el servidor, que la
> transacción es de sólo lectura y que no tiene identificador de escritura, un
> `SELECT 1` y `COMMIT`. En pantalla: «prueba de humo de SÓLO LECTURA: no
> escribe nada …», la línea `humo: petición de N bytes en UNA petición;
> transacción de sólo lectura: on; identificador de escritura asignado:
> ninguno` y «aceptada; X s de punta a punta … No se escribió nada.» Se anota el
> tiempo. **Si sale «NO aceptada», no se aplica** hasta saber por qué (el pooler
> no acepta peticiones de ese tamaño: habría que volver a decidir el envío).
> [C-CA, clon de la foto: aceptada, 104 104 bytes, 0,32 s directo y 1,10 s con
> 150 ms de ida y vuelta; la misma construcción con un `INSERT` dentro da
> `ERROR: 25006: cannot execute INSERT in a read-only transaction` y no entra;
> los contadores de escritura de `pg_stat_database` (insertadas / actualizadas /
> borradas) no cambiaron con las dos pruebas.]

Qué mirar, además:

- **Lo que cambia con el tiempo** y puede salir distinto ese día: **G.14/G.15**
  (si hay una transacción larga o candados de otra sesión, esperar), **G.17**
  (un `pg_cron` nuevo que toque las tablas), **G.18/F5b.3** (un índice inválido
  que haya dejado algo entretanto), **G.13b** (número de citas: con 247 las
  ventanas son las del §5; si fuera de otro orden de magnitud, se mide otra vez),
  **F1.10/C.1/C.2** (un médico que haya quedado sin consultorio predeterminado
  aborta F1) y **F1.11** (cuántos consultorios reescribirá: la cifra que la fila
  12 de la rejilla de F1 tiene que repetir).
- **Lo que tiene que seguir en OK exactamente igual** (si cambia, alguien tocó
  producción y **se para**, como en el paso 2): G.01–G.11 (versión, rol,
  atributos, historial), M1.2, F5a.2, F5a.3 y F4.3 (los md5 de
  `prevent_audit_modification` y de las dos puertas), M2.8 (29), y todas las de
  «objetos que YA existen» (M1.3, M2.5, M2.6, F1.7, F1.9, F3.4, F2.6, F2.8, F4.4,
  F5b.4, T.3).

### Paso 4 · Variables de Vercel y despliegue del código (v2 apagada)

**Antes de desplegar** (Vercel → Project → Settings):

- [ ] **⚠️ `CRON_SECRET` PUESTA ANTES DE DESPLEGAR** (Production, Sensitive).
      Las dos tareas programadas **nacen con este despliegue** (§6.3): sin la
      variable ya puesta, cada invocación de `google-sync` y `recordatorios`
      responde 401 hasta que se ponga y se vuelva a desplegar.
- [ ] Las demás variables nuevas del §6.2 puestas en **Production** (Settings →
      Environment Variables). Vercel aplica una variable a los despliegues que
      se hagan **después** de ponerla: se ponen antes de desplegar.
- [ ] `AGENDA_RSVP_GOOGLE` **sin definir** (apagada; §6.2).
- [ ] Ninguna de las que no deben existir (§6.2, segunda tabla).
- [ ] (Settings → Functions) **Fluid Compute sigue ACTIVADO.** La agenda depende
      de él: el trabajo que sus rutas dejan en `after()` vive dentro del límite
      de la función, y ninguna declara `maxDuration` (§12, punto 4).
- [ ] **No hay un «Function Max Duration» de proyecto menor que 300 s.**
- [ ] Anotar cuál es el despliegue de producción ACTUAL (el de `main`): es al
      que se vuelve si el paso 5 falla.

Desplegar la rama (el merge a `main` y el despliegue los hace Angel). Con este
despliegue **nacen las dos tareas programadas**: `main` no tiene `crons` en
`vercel.json` (comprobado: `git show main:vercel.json` sólo trae
`buildCommand`); la rama trae `google-sync` cada 10 min y `recordatorios` cada
15 (§6.3).

### Paso 5 · Comprobación corta: la app sigue igual (código nuevo + base vieja)

Con la base todavía sin las 9 y la v2 apagada (no hay ni tabla de interruptor),
Angel, con su cuenta, unos minutos:

1. **Entrar** (y `/inicio`), sin bucles de recarga.
2. **Abrir un paciente** (de prueba o la cuenta demo): el expediente abre.
3. **Abrir la agenda**: la vista de siempre, sin engrane v2, campana ni candado.
4. **Crear una cita y cancelarla** (en un hueco de la semana siguiente; un evento
   sin paciente basta).
5. (Opcional) Vercel → el proyecto → Logs: un `warn` «interruptor de la agenda
   sin leer (cuenta como apagado)» por petición es lo esperado (§6.1); un
   `error` o un 500, no.

Es lo que E2 ensayó en esta dirección [C, `../ensayo/ORDEN-Y-REVERSA.md` §5.4
(b)]: los tres roles, 200 en todo, sin 500.

**Si el código recién desplegado falla aquí (ANTES de tocar la base):** se
vuelve al despliegue anterior desde el panel de Vercel, **sin ninguna reversa de
base** (la base no se tocó). En el panel, Vercel ofrece volver a poner en
producción un despliegue anterior («Instant Rollback», o «Promote to
Production» sobre el despliegue anterior en la lista de Deployments) — **POR
COMPROBAR en el panel ese día**: el nombre exacto y el sitio de la opción no se
verificaron (este agente no tiene acceso al panel ni leyó esa página de la
documentación). Lo que sí se sabe: el código de `main` sobre la base vieja es
exactamente lo que hay hoy en producción. Las dos tareas programadas
desaparecen con la vuelta atrás si el despliegue anterior no las trae
(DEDUCIDO: lo dice `vercel.json`; no comprobado en Vercel). Luego, a investigar
con calma; no se aplica nada.

**Si todo va bien, sin pausa:** se repiten los conteos (paso 3, «REPETIRLO») y
se sigue con el paso 6 en la misma sesión, para que la ventana «código nuevo +
base vieja» dure minutos.

### Paso 6 · Las 9 migraciones

```bash
bash supabase/produccion/plan/aplicar.sh aplicar
```

Pide `PRODUCCION`, la contraseña y, antes de cada archivo, su versión. Con el
guion nuevo [C-CA] cada una tardó 0,25–0,50 s en el clon sin retardo y
1,19–1,51 s con 150 ms de ida y vuelta simulados (incluye arrancar el
contenedor de `psql`, conectar y la línea de ajustes); la parte con candados es
la del servidor (§5). Cada `*.salida.txt` empieza por la línea «sesión:
idle_in_transaction_session_timeout=10s, lock_timeout=5s,
statement_timeout=2min». Mientras se aplica, el código
nuevo ya está desplegado: cada prefijo del orden es un estado que E2 probó o
dedujo seguro con la v2 apagada (§8, «Quedarse a medias»), y las tareas
programadas no hacen nada mientras ninguna clínica tenga la v2 (§6.3). Lo que hay que mirar en cada
rejilla (literal en `rejillas-del-ensayo.txt`: **63 OK, 10 INFO, 0 REVISAR**):

| # | Filas | Mirar especialmente | NOTICE esperados (no son errores) |
|---|---|---|---|
| 1 | 7 (5 OK, 2 INFO) | fila 4: md5 normalizado `f1fe023a…`; fila 7: filas de `audit_log` (no cambian) | — |
| 2 | 8 (3 OK, 5 INFO) | fila 2: **28 tablas** a las que quitó TRUNCATE (las del inventario de su reversa; si salen otras, añadirlas a la reversa); fila 8: «ninguna» | `schema "pg_temp" does not exist, skipping` |
| 3 F1 | 15 (14 OK, 1 INFO) | consultorios respaldados = **todos** los consultorios (F1.11 de los conteos: **18** el 2026-11-22); 0 con `horario_propio = false` | — |
| 4 F5a | 6 OK | — | 6 × `policy/trigger … does not exist, skipping` |
| 5 F3 | 9 (8 OK, 1 INFO) | el censo: 0 / 0 / 0 | — |
| 6 F2 | 9 (8 OK, 1 INFO) | fila 8: md5 normalizado de las dos puertas, `a2dcfa8f…` / `2efd7734…` | 1 × `policy … does not exist, skipping` |
| 7 F4 | 8 OK | los 7 tipos de aviso | — |
| 8 F5b | 7 OK | fila 6: 3 índices válidos; fila 7: llave primaria válida | (un WARNING sólo si hubiera un índice inválido ajeno: G.18) |
| 9 T | 4 OK | los 11 disparadores; cero TRUNCATE en las 16 tablas | `schema "pg_temp" does not exist, skipping` |

Terminadas: `aplicar.sh estado` → las 9 «ya registrada».

### Paso 7 · La comprobación posterior

`COMPROBACION-POSTERIOR.md` entero (incluido su humo con la v2 apagada, que ya
corre sobre el código nuevo y la base nueva). Si algo no cuadra, **no se
enciende nada** y se decide entre arreglar o revertir (§10; primero la regla del
recuadro del paso 0).

### Paso 8 · Encender la v2 en UNA clínica

Sólo cuando §13 esté resuelto. `agenda_ajustes.agenda_v2_encendida` **sólo** la
cambian `postgres`/`supabase_admin` (`trg_agenda_ajustes_proteger`): desde el
SQL Editor, para la clínica de pruebas de Angel.

**Antes de encender**, con la v2 todavía apagada: la medición «antes» de §15
(cuánto tarda en abrir la agenda). **Primer paso tras encender** (orden de
Angel): la medición «después» de §15, con la misma cuenta, el mismo equipo y la
misma red, y compararla. Si sale peor de lo que dice §15, se apaga.

---

## 5. Candados y ventanas (las de hoy, tras C1–C3 y T)

Cada archivo es UNA transacción: cada candado se mantiene hasta su `COMMIT`.
Todos llevan `SET LOCAL lock_timeout = '5s'`; las de la agenda, además,
`statement_timeout` 60 s (F5b 120 s). La sesión de `aplicar.sh` fija además
`idle_in_transaction_session_timeout` 10 s, `lock_timeout` 5 s y
`statement_timeout` 120 s (§2).

### 5.0 Medido con el guion NUEVO (un archivo, una petición) [C-CA, 2026-11-22]

**Cómo.** Clon `clon-spinus-ca-1` de la foto real (14 diferencias foto ↔ clon,
todas esperadas), como `postgres` NO superusuario. Para cada condición se
aplicaron F3 y luego F2 sobre la base con las cuatro anteriores, y se
revirtieron después. Dos sondas en paralelo, desde otras sesiones:

- una que mira `pg_locks` cada 5 ms y apunta cuándo está concedido el ACCESS
  EXCLUSIVE sobre `public.appointments` (ventana = última muestra − primera);
- una «agenda» que lee `select count(*) from public.appointments` cada 20 ms y
  apunta la lectura más lenta (lo que esperaría una petición de la app).

**El retardo de red** se simuló con un proxy TCP escrito para esto
(`~/spinus-fusion/ensayo-ca/proxy_retardo.py`, 60 líneas de `python3` sin
dependencias: entrega cada trozo, en cada sentido, la mitad del retardo después).
`tc netem` no se pudo usar: la imagen de Postgres no trae `tc` y en el equipo
hace falta ser root. El retardo medido con `select 1` a través del proxy:
**50,6 ms** y **150,8 ms** de ida y vuelta (sin proxy, 0,14 ms).

| Archivo | Modo | Sin retardo | 50 ms de ida y vuelta | 150 ms de ida y vuelta |
|---|---|---|---|---|
| F3 | viejo (`psql -f`, una petición por sentencia) | 40 ms · lectura más lenta 40 ms | **4,55 s** · 4,54 s | **13,46 s** · 13,45 s |
| F3 | **nuevo (`aplicar.sh`, `-c`)** | 20 ms · 10 ms | **45 ms** · 32 ms | **50 ms** · 48 ms |
| F2 | viejo | 20 ms · 14 ms | **3,01 s** · 3,01 s | **8,91 s** · 8,90 s |
| F2 | **nuevo** | 5 ms · 4 ms | **15 ms** · 17 ms | **30 ms** · 35 ms |

(Primera cifra: ACCESS EXCLUSIVE visto por la sonda de `pg_locks`; segunda: la
lectura de citas más lenta. Resolución de la sonda: 5 ms.) Las rejillas, en las
12 corridas, sin ninguna REVISAR. **Lectura:** el estimado de hoy para el guion
viejo (F3 4,5–13,5 s, F2 3–9 s con 50–150 ms) se confirma medido: 4,55/13,46 s
y 3,01/8,91 s. Con el guion nuevo la ventana ya no depende de la red: es el
tiempo de servidor (35 ms y 16 ms medidos por PL con 247 citas, §5.1), por
debajo de los 3 s de `anon` y los 8 s de `authenticated` con mucho margen. Lo
mismo vale para las demás ventanas de la tabla de §5.1: con una petición, la
columna «ESTIMADO por el pooler» deja de aplicar y queda la de servidor.

**De punta a punta con 150 ms** [C-CA]: `aplicar.sh reversa`, `reversa-truncate`
y `aplicar` completos a través del proxy, en verde y sin REVISAR; cada archivo,
1,19–1,51 s (casi todo es arrancar el contenedor, conectar y las otras dos
peticiones); las 9 con su registro por la CLI, 63 s.

### 5.2 Si el cliente se corta a media F3 [C-CA, 2026-11-22]

Con 150 ms de ida y vuelta, se cortó el `psql` que aplicaba F3 y se midió
cuánto tardaba el servidor en soltar el ACCESS EXCLUSIVE sobre `appointments`.
«Matar» = `kill -9` (el sistema cierra la conexión y el servidor lo ve);
«congelar» = `docker pause` del cliente: la conexión queda abierta sin que nadie
hable, como un portátil suspendido o un wifi que se cae sin cerrar.

| Modo | Corte | Candado suelto tras el corte | ¿F3 quedó? |
|---|---|---|---|
| viejo (`-f`), sin ajuste de sesión | matar a los 6 s | 0,14 s | no (se deshizo) |
| viejo (`-f`), sin ajuste de sesión | **congelar** a los 6 s | **nunca**: a los 30 s seguía `idle in transaction` con el candado; se soltó a los 43,8 s, al descongelar y matar el cliente a mano | no |
| viejo (`-f`) **con** `idle_in_transaction_session_timeout = 10s` | congelar a los 6 s | **10,15 s** (el servidor corta la sesión) | no |
| **nuevo** (`aplicar.sh`), con el servidor A MEDIA F3 (otra sesión retenía `appointments` 4 s, así que F3 estaba dentro de su transacción esperando su `ALTER TABLE`) | matar a los 2,5 s | el servidor **siguió**: terminó F3 1,6 s después del corte, al soltarse el candado ajeno | **sí, entera** |
| nuevo, ídem | congelar a los 2,5 s | ídem, 1,8 s | **sí, entera** |

**Lectura.** Con el guion viejo, una conexión que se queda colgada a media F3 o
F2 dejaba la agenda de todas las clínicas detenida **sin límite** (lo que temía
el auditor). Con el nuevo ya no puede pasar: el servidor tiene el archivo entero
y no espera al cliente; termina (o falla y deshace) por su cuenta, en lo que
tarde el servidor. Y si algún día un archivo quedara ocioso dentro de su
transacción, el ajuste de sesión lo corta a los 10 s (comprobado con el modo
viejo). **La contrapartida:** si la conexión de Angel se corta a media
aplicación, el archivo puede quedar APLICADO sin que se vea su rejilla y sin
registrar: `aplicar.sh` lo detecta al repetir (§8, «aplicada sin registrar»).

**Lo que no se pudo ensayar:** el pooler real. Con Supavisor en medio, lo que ve
el servidor no es la terminal de Angel sino el pooler: si la terminal se corta,
la conexión del pooler al servidor sigue viva hasta que Supavisor lo note (no
medido). Con el guion nuevo da igual para los candados (el servidor no espera a
nadie); con el viejo, eso era exactamente el caso «congelar».

| # | Tabla | Candado | Cómo se pide | Ventana (desde el candado hasta el COMMIT) |
|---|---|---|---|---|
| 1 | `audit_log` | SHARE ROW EXCLUSIVE | cola, `lock_timeout` 5 s | un instante; frena escrituras de `audit_log` (toda acción auditada) |
| 2 | las 11 tablas clínicas | SHARE ROW EXCLUSIVE | cola, 5 s | hasta el COMMIT; frena escrituras, no lecturas |
| 3 F1 | `clinicas`, `profiles`, `consultorios` | SHARE ROW EXCLUSIVE | **`NOWAIT` con reintentos (50 × 0,1 s)**: nunca hace cola | el resto del archivo (66 sentencias, 45 ms sin datos; 208 ms con 200 000 citas sintéticas [N]) |
| 3 F1 | `appointments`, `consultorios`, `clinicas` | **ACCESS EXCLUSIVE** | `NOWAIT` con reintentos | **3 viajes** (un bloque `DO`, el post-vuelo y el COMMIT): 23 ms sin datos, 189 ms con 200 000 citas [N]. `clinicas` la leen las funciones de la RLS: **toda la app** espera ese rato |
| 4 F5a | `clinicas`, `profiles` | SHARE ROW EXCLUSIVE | `NOWAIT` con reintentos (5 s) | el archivo |
| 5 F3 | `appointments` | **ACCESS EXCLUSIVE** | cola, 5 s | desde el `ADD COLUMN`: 67 ms sin datos; con 50 000 citas, ~277 ms (213 el COMMIT) [N] |
| 5 F3 | `clinicas`, `profiles` | SHARE ROW EXCLUSIVE (FK) | cola | el archivo |
| 6 F2 | `appointments` | **ACCESS EXCLUSIVE** | cola, 5 s | desde el `ADD COLUMN`: 52 ms sin datos; con 50 000 citas, ~143 ms [N] |
| 7 F4 | `clinicas`, `appointments`, `profiles` | SHARE ROW EXCLUSIVE (9 FK y 3 disparadores, al final) | cola, 5 s | **9 sentencias** (antes 117) [N]; ASUMIENDO 50–150 ms por viaje, 0,5–1,4 s |
| 8 F5b | `appointments` | SHARE (2 índices de rango) → SHARE ROW EXCLUSIVE (5 disparadores) → **ACCESS EXCLUSIVE** (un bloque `DO`) | cola, 5 s | escrituras bloqueadas **13 sentencias** (antes 51); ACCESS EXCLUSIVE **4 sentencias** (antes 47), 90–220 ms de servidor con 200 000 citas; los índices de rango, 0,5–1,7 s con 200 000 citas, con lecturas libres [N] |
| 9 T | las 11 tablas nuevas | SHARE ROW EXCLUSIVE | cola, 5 s | tablas recién creadas y vacías |

Ninguna toca `auth.users`.

Las cifras de la última columna son de los ensayos de C1–C3, con 0 y con
20 000–200 000 citas **sintéticas**. Producción tiene **247** (conteo previo,
§4 paso 3): para ese tamaño, la medida de abajo.

### 5.1 Medido con el volumen real [C-PL, 2026-11-22]

**Cómo.** Un solo clon de la foto (`clonar-desde-foto.sh`, contenedor
`clon-spinus-pl-medir`, 14 diferencias foto ↔ clon, todas esperadas), sembrado
con datos **inventados** del tamaño de producción: 17 clínicas, 20 perfiles (con
sus `auth.users` ficticios), 18 consultorios (17 activos y 1 archivado, de 13
clínicas y 15 médicos: la forma de F1.11), 130 pacientes y **247 citas** con los
cinco estados; `ANALYZE`. Sin filas sintéticas en `audit_log` (sólo las que
escribieron los disparadores de la siembra: 149). Las 9 aplicadas con `psql -X
-v ON_ERROR_STOP=1 -e` + `\timing` como `postgres` NO superusuario, en orden,
dentro del contenedor (sin red: **no incluye la latencia del pooler**). Las 9
rejillas sin ninguna REVISAR; F1 respaldó **18** consultorios y `audit_log` pasó
de 149 a 167 (+18, una por consultorio). Contenedor borrado al terminar; el
script y las salidas, fuera del repo (scratchpad de la sesión de PL).

> **Desde el guion nuevo (§5.0) la última columna es HISTÓRICA:** era el modo
> viejo, una petición por sentencia. Con un archivo en una petición, cada
> ventana dura lo que dice la columna de servidor. Se conserva porque es la
> medida de servidor con 247 citas y porque explica por qué se cambió. Los
> recuentos de sentencias son de antes de las correcciones de la ronda 1 (F2
> trae ahora 3 sentencias más antes de su ventana sobre `appointments`, y F4
> una más); con el guion nuevo no cuentan.

| # | Ventana | Sentencias (= viajes por el pooler con el guion VIEJO) | Tiempo de servidor medido, 247 citas | ESTIMADO por el pooler con el guion VIEJO (+ N × RTT, ASUMIENDO RTT 50–150 ms) |
|---|---|---|---|---|
| 1 | archivo entero (SRE sobre `audit_log`) | 7 | 11 ms | 0,4–1,1 s |
| 2 | archivo entero (SRE sobre las 11 clínicas) | 24 | 16 ms | 1,2–3,6 s |
| 3 F1 | SRE `clinicas`/`profiles`/`consultorios` → COMMIT | 66 | 51 ms | 3,3–9,9 s (escrituras de esas tablas esperan; lecturas no) |
| 3 F1 | **ACCESS EXCLUSIVE** `appointments`/`consultorios`/`clinicas` → COMMIT | 3 | 32 ms (23 el COMMIT) | 0,2–0,5 s (**toda la app** espera: la RLS lee `clinicas`) |
| 4 F5a | SRE `clinicas`/`profiles` → COMMIT | 29 | 12 ms | 1,5–4,4 s |
| 5 F3 | **ACCESS EXCLUSIVE** `appointments`, desde el primer `ALTER TABLE` → COMMIT | **90** | 35 ms | **4,5–13,5 s** (ni se lee ni se escribe una cita) |
| 6 F2 | **ACCESS EXCLUSIVE** `appointments`, desde el `ADD COLUMN` → COMMIT | **60** | 16 ms | **3–9 s** (ídem) |
| 7 F4 | SRE `clinicas`/`appointments`/`profiles` (las 9 FK) → COMMIT | 9 | 22 ms | 0,5–1,4 s |
| 8 F5b | escrituras de `appointments` bloqueadas (índices de rango → COMMIT) | 13 | 27 ms | 0,7–2 s |
| 8 F5b | **ACCESS EXCLUSIVE** `appointments` → COMMIT | 4 | 24 ms (20 el COMMIT) | 0,2–0,6 s |
| 9 T | archivo entero (tablas nuevas, vacías) | 19 | 30 ms | 1–2,9 s |

Tiempo de servidor por archivo entero, 247 citas: 14 / 18 / 64 / 17 / 51 / 33 /
61 / 42 / 32 ms; con el arranque de `psql`, 0,06–0,11 s cada uno.

**Lectura.**

- **Con 247 citas el volumen no cuenta** [C-PL]: los tiempos de servidor son los
  mismos que los de los ensayos con la tabla vacía (F1: 45 ms SRE y 23 ms AE sin
  datos [N] frente a 51 y 32 aquí; F3: 67 ms el archivo sin datos [N]). Los
  ensayos de 20 000–200 000 citas sobrestiman por mucho lo que pasará: lo que
  crece con las citas (recorrer `appointments` al validar FK/CHECK, los dos
  índices de rango de F5b: 0,5–1,7 s con 200 000 [N]) es despreciable con 247.
- **Con el guion viejo dominaba el número de viajes por el pooler**, no el
  servidor: la columna «ESTIMADO» (N × RTT supuesto de 50–150 ms) se confirmó
  medida en §5.0 (F3 13,46 s y F2 8,91 s con 150 ms). **Con el guion nuevo, no
  hay viajes dentro de la transacción**: la ventana es la de servidor. El RTT
  real de la terminal de Angel al pooler lo da ahora `aplicar.sh estado` («ida y
  vuelta al servidor», mediana de 5 `select 1`); sólo cuenta ya para lo que
  tarda cada archivo de punta a punta, no para los candados.
- **F3 y F2 eran las ventanas largas** (C1–C3 no las acortaron: sus cabeceras lo
  explican, «el ACCESS EXCLUSIVE del ADD COLUMN ya dura hasta el COMMIT»). Con
  el guion viejo, abrir la agenda o guardar una cita **esperaba** hasta el
  COMMIT y, pasados 8 s, fallaba: en la foto, `authenticated` tiene
  `statement_timeout` de **8 s**, `anon` de **3 s** y `authenticator`
  `lock_timeout` de **8 s** [C, `01-roles.sql` / `05-catalogo.jsonl` de la
  foto] (ASUMIENDO que PostgREST aplica esos ajustes del rol a cada petición,
  como documenta Supabase; no ensayado). Con el nuevo, la espera medida de una
  lectura de citas fue de 48 ms como máximo (§5.0).

**Lo que sigue pudiendo alargar la espera** con el guion nuevo: que el archivo
tenga que hacer cola detrás de otra transacción (abajo). Mientras F3, F2, F4,
F5b o T esperan su candado (hasta 5 s), lo que llega detrás de ellas también
espera; por eso G.14/G.15 justo antes de empezar (§4, paso 3) y la hora sin
consulta.

**Qué pasa con una transacción larga abierta** (G.14): F1 y F5a no hacen cola:
reintentan 5 s y abortan con `CANDADOS: … reintenta en unos minutos`, sin dejar
nada y sin frenar a nadie mientras tanto [N: con una lectura abierta 12 s, una
lectura de `appointments` lanzada detrás tardó 0,05 s]. Las demás hacen cola
hasta 5 s (y lo que llega detrás espera con ellas) y abortan con `canceling
statement due to lock timeout`. En los dos casos: esperar a que acabe y
**repetir** `aplicar.sh aplicar` (salta lo registrado). No subir el
`lock_timeout`.

**A qué hora (decisión de Angel): a una hora sin consulta**, aunque con el
guion nuevo la ventana sea de milisegundos (§4, paso 0). ASUMIENDO que eso es
de noche o el domingo temprano; la hora la pone Angel. Y fuera del horario de cualquier trabajo de `pg_cron` que nombre
`appointments` o `clinicas` (G.17; el 2026-11-22, ninguno). **Con «código
primero», las dos tareas de `vercel.json` YA corren durante el paso 6** (cada
10 min `google-sync`, minutos :00, :10, :20…; cada 15 `recordatorios`, :00,
:15, :30, :45). Mientras ninguna clínica tenga la v2 no leen `appointments`
(sus listados parten de `agenda_ajustes`, vacía, o no existen todavía: §6.3),
así que no deberían chocar con los candados (DEDUCIDO). Aun así, por
prudencia, no lanzar F3 ni F2 justo en esos minutos.

---

## 6. Código y base: el orden, y las variables de Vercel

### 6.1 El orden: CÓDIGO PRIMERO, base inmediatamente después (decisión de Angel, 2026-11-22)

**Recomendado y elegido: desplegar el código (paso 4), comprobar en unos
minutos que la app sigue igual (paso 5) y aplicar las 9 a continuación (paso
6), en la misma sesión**, con la v2 apagada en todas las clínicas. Sustituye a
«migraciones primero» de las versiones anteriores de este plan y de
`mejora_agendaV2.md` §7. El ensayo E2 probó las dos direcciones
(`../ensayo/ORDEN-Y-REVERSA.md` §5.4) [C]: **las dos son seguras y ninguna deja
a nadie sin agenda.** La diferencia:

| Ventana | Qué ve un médico o una secretaria | Qué ve el registro |
|---|---|---|
| **código nuevo + base vieja** (la elegida) | **nada distinto** de hoy; la cita atendida con nota ya queda protegida por la API (409 `nota_ligada` con su texto) [C] | un `warn` «interruptor de la agenda sin leer (cuenta como apagado)» por petición autenticada mientras dure; en el navegador de la secretaria, un 404 de `/rest/v1/agenda_ajustes` en la consola, sin efecto en la página [C]; las tareas programadas contestan `{"ok":true}` sin hacer nada [C, §6.3] |
| base nueva + código de `main` (la alternativa, «base primero») | todo igual **salvo mover, cancelar, volver a agendada o borrar una cita ATENDIDA CON NOTA clínica: 500** con el texto de la base en castellano, y no se hace (antes `main` lo hacía) [C] | nada (`main` no registra esos 500); `audit_log` empieza a recibir `log_cita_change` [C]. Además, si alguien cambia el horario de la clínica con `main` en esa ventana, la copia de F1 en cada consultorio ya no lo sigue (con la v2 apagada nadie lo lee; se vería al encenderla) [D] |

Con «código primero», además, cada estado intermedio mientras se aplican las 9
es uno de los que E2 recorrió en la reversa: con la v2 apagada la rama funcionó
en todos los que se probaron (las 5 de `main`, sólo las dos de TRUNCATE, +F1,
+F1+F5a, las 14) [C]; con +F3, +F2 y +F4 sólo se probó con la v2 ENCENDIDA (y
funcionó salvo la reserva por enlace con F3 sin F2: 404 limpio) [C]; apagada se
deduce que también [D, no ensayado].

**Si se volviera a «base primero»:** la ventana es segura; hasta desplegar el
código, una cita atendida con nota no se puede mover, cancelar ni borrar y la app
vieja responde 500 con un texto legible. Ese es todo su coste.

### 6.2 Variables de entorno de Vercel

Nombres sacados el 2026-11-22 de `src/` en la rama y en `main` (`git grep -h -o
"process\.env\.[A-Z_0-9]*"` y, además, los que se leen como `env.X` de un objeto
de entorno: `EMAIL_TRANSPORT`, `AGENDA_RSVP_GOOGLE`, `MAILPIT_URL`,
`RESERVA_AVISO_BORRADOR_LOCAL`, `VERCEL`) y de `.env.example`. **Sólo nombres y
formatos; ningún valor real.** Vercel aplica una variable a los despliegues
hechos **después** de ponerla: se ponen antes del paso 4 (o se redespliega).

**Nuevas con la agenda v2** (ninguna la lee `main`: comprobado comparando las dos
listas). «Formato» = comprobado leyendo el código; **que estén puestas en el
panel no lo puede comprobar el repo: todas «deducida» = hay que mirarlas en
Vercel → Project → Settings → Environment Variables.**

| Nombre | Qué valor lleva | ¿Secreta? | Cómo generarla | ¿Obligatoria? | Comprobada / deducida |
|---|---|---|---|---|---|
| `RESERVA_SECRETO` | hexadecimal, **≥ 64 caracteres y de longitud par**, sólo `[0-9a-f]` (se recorta y pasa a minúsculas); si no cumple, cuenta como ausente (`src/lib/reserva/secretos.ts:38-42`) | **sí** (Sensitive). **Rotarla invalida todos los enlaces y el historial del candado**: se genera UNA vez y se guarda en el gestor de contraseñas de Angel | `openssl rand -hex 32` (64 hex) | **sí** para la v2: sin ella no se emiten enlaces de reserva ni de confirmación, ni sale el recordatorio (falla cerrado) | formato comprobado; presencia deducida (falta: es nueva) |
| **`CRON_SECRET` — ⚠️ PONER ANTES DE DESPLEGAR** (las tareas programadas nacen con el despliegue: §6.3) | cualquier cadena no vacía; la ruta compara la cabecera con `Bearer <CRON_SECRET>` en tiempo constante (`src/lib/cronAutorizacion.ts:20-24`); Vercel manda esa cabecera a las tareas programadas cuando la variable existe (documentación de Vercel Cron Jobs, citada en `mejora_agendaV2.md`; no releída por PL) | **sí** (Sensitive) | `openssl rand -hex 32` (sin espacios ni caracteres raros) | **sí**: sin ella `/api/cron/google-sync` y `/api/cron/recordatorios` responden 401 y no hacen nada | formato comprobado; presencia deducida (falta: es nueva) |
| `EMAIL_TRANSPORT` | el literal **`resend`**. Además exige `RESEND_API_KEY` y una `NEXT_PUBLIC_SUPABASE_URL` `https` remota; cualquier otro valor o vacío = apagado (`src/lib/correo/transporte.ts:127-136`) | no | se escribe tal cual | **sí** para que salgan los correos de la agenda; sin ella, apagado (nada sale, nada falla) | formato comprobado; presencia deducida (falta: es nueva) |
| `AGENDA_RSVP_GOOGLE` | **NO SE DEFINE al desplegar.** Sólo el literal exacto `encendido` la enciende (`src/lib/gcalRsvp.ts:22-24`): ausente, vacía o cualquier otro valor = apagada. Se pondrá `encendido` **después** de probar Google real (RSVP) en la clínica de Angel | no | — | no (y hoy, no debe estar) | formato comprobado; que no exista, hay que mirarlo |

**Las que ya usa `main`** (siguen igual; que estén puestas es DEDUCIDO porque
`main` funciona en producción): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_HOOK_SECRET`, `NEXT_PUBLIC_APP_URL` (los enlaces de los correos y de
la reserva salen de aquí: tiene que ser el dominio de producción),
`RESEND_API_KEY` (la usa también `EMAIL_TRANSPORT=resend`), `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_TOKEN_SECRET`,
`GEMINI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, las ocho
`STRIPE_PRICE_*`, `NEXT_PUBLIC_GOOGLE_OAUTH`, `NEXT_PUBLIC_LOGIN_SERVIDOR`,
`TZ`; y en `.env.example`, además, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
`NEXT_PUBLIC_SENTRY_DSN` y `ANTHROPIC_API_KEY` (no salen en `src/`; se leen fuera
o ya no se usan: no se tocan).

**Las que pone Vercel solo** (no se definen a mano): `VERCEL` (la lee
`avisoReserva.ts:91`: con `1`, la excepción local del aviso no existe) y
`VERCEL_ENV` (la lee `gcalFalso.ts:41`); `NODE_ENV` la pone el build.

**Las que NO deben existir en producción** (de pruebas locales):

| Nombre | Por qué no | Qué haría si estuviera |
|---|---|---|
| `GCAL_FALSO_URL` | apunta al Google falso de las e2e | nada: `rootUrlGoogleFalso()` la ignora con `NODE_ENV=production`, con `VERCEL_ENV=production`, si no es `localhost`/`127.0.0.1` y si la Supabase no es local (`src/lib/gcalFalso.ts:40-46`). Igual no se pone |
| `MAILPIT_URL` | el buzón de pruebas local | sólo se lee con `EMAIL_TRANSPORT=captura`, y sólo si es loopback (`transporte.ts:144-165`) |
| `RESERVA_AVISO_BORRADOR_LOCAL` | abre la reserva con el aviso de privacidad PENDIENTE DE REVISIÓN LEGAL, sólo en local | nada en Vercel (`VERCEL=1`) ni con Supabase remota (`avisoReserva.ts:89-93`). Igual no se pone |
| `EMAIL_TRANSPORT` = `captura` | manda los correos a Mailpit | con `captura` los correos no salen a nadie de verdad |
| `AGENDA_RSVP_GOOGLE` = `encendido` | todavía no: falta la prueba con Google real | confirmaría citas por la respuesta a la invitación de Google |

- Los valores se generan en la terminal de Angel y se pegan en Vercel como
  «Sensitive», entorno **Production** sólo (ASUMIENDO que las previews no usan la
  agenda v2: un `RESERVA_SECRETO` distinto contra la misma base daría enlaces
  que producción no reconoce). No se escriben en ningún archivo.
- **Vercel está en Pro** (confirmado por Angel): las dos tareas de `vercel.json`
  (cada 10 y 15 min) se admiten. Tras el despliegue: Schedules → Cron Jobs →
  View Logs, la primera invocación en 2xx.

### 6.3 Las dos tareas programadas en la ventana «código nuevo + base vieja»

**Nacen con este despliegue**: `main:vercel.json` no tiene `crons`; la rama trae
`/api/cron/google-sync` (`*/10 * * * *`) y `/api/cron/recordatorios` (`*/15 * *
* *`) [C, `git show main:vercel.json` y `vercel.json`]. Sin `CRON_SECRET`
responden 401 y no hacen nada.

| Tarea | Qué llama primero | Con la base vieja (sin las 9) | Con las 9 y la v2 apagada en todas |
|---|---|---|---|
| `google-sync` | `gcal_sync_clinicas_pendientes` (de F2), por `listarConexionesParaSincronizar` (`src/lib/gcalConexion.ts:774-791`) | la RPC no existe: PGRST202 / 42883 / 42P01 → lista vacía → `{"ok":true}`, **sin escribir nada ni llamar a Google** [C: E2 5.4 (b), 200 `{"ok":true}`; el porqué, por lectura]. Sin `warn` en el registro | la lista parte de `agenda_ajustes … AND agenda_v2_encendida` (`20261201150000…:641-649`): vacía → nada [D, lectura] |
| `recordatorios` | si `EMAIL_TRANSPORT` está apagado o falta `RESERVA_SECRETO`, contesta `{"ok":true}` sin tocar la base (`src/app/api/cron/recordatorios/route.ts:64-66`); si no, `cita_recordatorios_pendientes` (de F4) | la RPC no existe: PGRST202 / 42883 / 42P01 / PGRST205 → `RecordatoriosNoDisponibles` → un `warn` «recordatorios no disponibles: faltan las RPC de E4» → `{"ok":true}`, **sin tomar ni enviar nada** (`src/lib/confirmacion/recordatorios.ts:44-62`, `:205-210`) [C: E2 5.4 (b), 200 `{"ok":true}` y ese `warn` una vez, con `EMAIL_TRANSPORT=captura`; con `resend` el camino es el mismo, D] | el listado parte de `agenda_ajustes` con la v2 y el recordatorio encendidos (`20261201160000…:1026-1053`): vacío → nada [D, lectura] |

Ninguna de las dos escribe antes de su primer listado, así que **no dejan nada
a medias** en ninguna de las dos ventanas [D, lectura de las rutas]. **Google:**
con la v2 apagada, el código nuevo no sincroniza (las dos puertas de arriba y
`POST /api/google/sync`, que contesta `omitida` sin la v2: `src/app/api/google/sync/route.ts:80`), así
que lo único que va a Google es lo que ya hacía `main` (el alta y los cambios de
eventos al guardar citas) [D, lectura]. **No ensayado:** E2 no tuvo cuenta de
Google ni Google falso, así que ninguna escritura hacia Google de la rama sobre
la base vieja se vio en ejecución; tampoco Realtime.

---

## 7. Punto de no retorno, y lo que se nota con la v2 APAGADA

**El punto de no retorno es el COMMIT de F1 (nº 3)**, el único archivo que
cambia datos existentes: copia a cada consultorio el `horario_consulta` de su
clínica y lo marca `horario_propio = true`, con respaldo en
`respaldos.consultorios_horario_20261119` y una fila UPDATE de `user_id
'system'` en `audit_log` por consultorio. Esas filas de `audit_log` no se
borran nunca (tampoco las de la reversa). El horario EFECTIVO no cambia, y con
la v2 apagada la app de hoy no lee `consultorios.horario`.

Todo lo demás es estructura nueva que nace vacía y detrás del interruptor
(`agenda_ajustes` nace sin filas: apagado en todas las clínicas).

| Desde | Qué actúa aunque la v2 esté apagada | Quién lo notaría |
|---|---|---|
| nº 1, 2 y 9 | TRUNCATE de `audit_log` y de las tablas de `public` falla para `anon`/`authenticated`/`service_role`; un disparador lo impide también a `postgres` en `audit_log`, las 11 tablas clínicas y las 11 de la agenda con datos de personas | nadie (ningún código hace TRUNCATE). Quien limpie tablas a mano con TRUNCATE, sí |
| F1 | `log_cita_change`: cada alta, borrado y cambio no técnico de una cita escribe en `audit_log` (nombres de columna, nunca valores) | nadie en pantalla; `audit_log` crece más deprisa |
| F2 | `cita_asignacion_google` en cada alta de cita | nadie |
| F3/F5b | una sesión no puede escribir columnas `reserva_*` | nadie (el código viejo no las conoce) |
| F5b | **una cita atendida con nota clínica ligada no cambia de estado ni de fecha/hora ni se borra**, también para `service_role` | **un médico que lo intente**: con el código nuevo (el orden elegido) ya lo rechazaba la API con 409 `nota_ligada`; sólo con «base primero» y `main` sería un 500 con el texto de la base (§6.1) |
| F1–F5b | las columnas nuevas de `appointments` viajan en los mensajes de Realtime | nadie (van NULL) |

---

## 8. Si algo aborta: mensaje → causa → acción

Regla general: **cada archivo es una transacción**. Si aborta ANTES de su
`COMMIT`, de ese archivo no queda nada y su versión no se registra; los
anteriores quedan aplicados y registrados. **`aplicar.sh` ya no lo da por
supuesto (A2):** tras cualquier fallo pregunta al catálogo por el **objeto
testigo** del archivo (lo crea ese archivo, no existe en la foto) y dice una de
tres cosas. Antes de contestar espera hasta 20 s si otra sesión del mismo
usuario tiene una transacción abierta (con el archivo en una petición, el
servidor puede estar terminándolo aunque el cliente haya muerto, §5.2).

| Versión | Testigo |
|---|---|
| 20261125170000 | disparador `prevent_audit_truncate` en `audit_log` |
| 20261126120000 | función `public.prohibir_truncate()` |
| F1 | tabla `public.agenda_ajustes` |
| F5a | tabla `public.agenda_bloqueos` |
| F3 | tabla `public.reserva_enlaces` |
| F2 | tabla `public.gcal_sync_estado` |
| F4 | tabla `public.avisos_clinica` |
| F5b | disparador `trg_appointments_proteger_borrado` |
| T | disparador `trg_agenda_bloqueos_sin_truncate` |

| Lo que dice `aplicar.sh` | Qué significa | Qué hacer |
|---|---|---|
| `… FALLÓ (ver arriba). El catálogo dice que NO quedó aplicada …` | se deshizo entera | quitar la causa (tabla de abajo) y volver a correr `aplicar.sh aplicar` (salta lo registrado) |
| `… FALLÓ (ver arriba) DESPUÉS de su COMMIT: … SÍ quedó aplicada …, pero NO se registró` o, al repetir, `… no está en el historial pero YA está aplicada …: aplicada sin registrar` | el archivo está ENTERO (es una transacción: si el testigo existe, el COMMIT se hizo); falló la rejilla, o se cortó la conexión y no se vio | **aplicada sin registrar**: mirar su `*.salida.txt`; si trae la rejilla, leerla (ninguna REVISAR); si no la trae (corte), seguir igual: la comprobación posterior (paso 7) revisa el catálogo entero. Registrar SÓLO esa versión: `npx --yes supabase@2.117.0 migration repair --status applied <versión> --db-url "$URL"` (con `PGPASSWORD` en el entorno) y volver a correr `aplicar.sh aplicar` [C-CA: T con un fallo provocado tras su rejilla → este mensaje; al repetir, se negó a correrla otra vez; `repair` a mano y siguió] |
| `… y NO SÉ si quedó aplicada …` / `no sé si … está aplicada: … otra sesión de … tiene una transacción abierta …` | no pudo preguntar al catálogo (red) u otra sesión tuya sigue trabajando | **no lo sé**: no correr nada. Esperar un minuto y `aplicar.sh estado`; mirar a mano si existe el testigo (p. ej. `select to_regclass('public.reserva_enlaces')`); con G.14 ver qué sesión es. Luego, según lo que diga, una de las dos filas de arriba |
| `no pude LEER el historial …` | falló la consulta a `supabase_migrations.schema_migrations` | no seguir: sin historial no se sabe qué hay aplicado. Mirar el error (red, contraseña, permisos) y repetir [C-CA: con el historial ilegible, `estado`, `aplicar` y `reversa` se detienen sin tocar nada] |
| `… tiene N bytes: no cabe en una sola petición …` | un archivo pasa de 130 000 bytes | no se aplicó nada; consultar (no partirlo a mano) |

### 8.1 Si aborta por la espera del candado: repetir, y a qué hora

Es el aborto más probable y el más inocente: otra transacción tenía la tabla y
el archivo no consiguió su candado en 5 s (`lock_timeout`, aprobado por Angel
junto con los 10 s de transacción ociosa, los 120 s por sentencia y el tope de
130 000 bytes). **Lo que se verá**, una de estas dos:

- F1 y F5a (piden el candado sin hacer cola):
  `ERROR:  CANDADOS: clinicas, profiles o consultorios siguieron ocupadas 5 s (una transacción larga las escribe). No se cambió nada: reintenta en unos minutos.`
  (o la variante con `appointments, consultorios o clinicas … las lee o escribe`,
  o con `clinicas o profiles`);
- las demás (hacen cola 5 s): `ERROR:  canceling statement due to lock timeout`;

y debajo, en las dos, la línea del guion:
`ALTO: <archivo> FALLÓ (ver arriba). El catálogo dice que NO quedó aplicada (no existe <testigo>) y NO se registró. Plan §8 (tabla de abortos).`

**Qué significa:** de ESE archivo no quedó nada (es una transacción y se
deshizo; lo confirma el propio guion preguntando al catálogo); los anteriores
siguen aplicados y registrados; la v2 sigue apagada. Nadie notó nada más que una
espera de hasta 5 s. [C-CA: F3 con un candado ajeno, en el ensayo.]

**Qué hacer:**

1. Mirar la fila de sesiones y candados abiertos: volver a correr los conteos y
   leer **G.14 / G.15 / G.16** (§4, paso 3). Si dicen quién retiene la tabla y
   es algo propio (una pestaña del SQL Editor), cerrarlo.
2. Esperar **2 minutos** y repetir `bash supabase/produccion/plan/aplicar.sh
   aplicar`: salta lo registrado y vuelve a intentar ese archivo.
3. Repetir así **hasta 3 veces** en total (con 2 minutos de pausa entre cada una).
   No subir el `lock_timeout` ni terminar sesiones ajenas.
4. **Si persiste, se deja para otra hora sin consulta** —fuera del horario de
   consulta de las clínicas; la hora la pone Angel—. Quedarse a medias entre dos
   archivos es un estado válido (abajo, «Quedarse a medias»): se retoma ese otro
   día desde el paso 3 (conteos) con `aplicar.sh aplicar`, que sigue donde se
   quedó.

(Los 2 minutos y las 3 veces son una propuesta de este agente: lo bastante para
que acabe una transacción normal de la app, que dura milisegundos, y poco para
no alargar la sesión; Angel puede cambiarlos.)

Causas de fallo, por el mensaje del servidor:

| Mensaje (empieza por…) | Archivo | Causa | Acción |
|---|---|---|---|
| `CANDADOS: … siguieron ocupadas 5 s … reintenta en unos minutos` | F1, F5a | una transacción larga escribe (o lee, para el ACCESS EXCLUSIVE) esas tablas | esperar (G.14/G.15 de los conteos dicen cuál) y repetir |
| `canceling statement due to lock timeout` | 1, 2, F3, F2, F4, F5b, T | lo mismo, pero estas hacen cola 5 s | ídem |
| `canceling statement due to statement timeout` | F1–F5b | una sentencia pasó de 60 s (F5b 120 s): tabla mucho mayor que lo medido | no repetir sin mirar G.13b; consultar |
| `PRE-VUELO FALLÓ: … tiene otro cuerpo (md5 con \r\n→\n: …, tal cual: …)` | 1 | `prevent_audit_modification()` cambió de verdad (si sólo difiere el «tal cual», ya no aborta: compara normalizado) | no seguir; mandar `pg_get_functiondef` |
| `PRE-VUELO FALLÓ: clinica_no_suspendida() / clinica_tiene_acceso() falta o cambió (md5 …)` | F5a | la regla de suscripción cambió (la de spinus-consola) | no seguir; mandar `pg_get_functiondef` |
| `PRE-VUELO FALLÓ: clinica_no_suspendida() no es la que copian … (md5 normalizado encontrado …)` | F4 | ídem | ídem |
| `PRE-VUELO FALLÓ: … no es postgres` / `hay que aplicar como el rol postgres (current_user es …)` | 2, F4, F5b | conexión con otro usuario | conectarse con `postgres.<ref>` por el pooler (G.02) |
| `PRE-VUELO FALLÓ: el rol … no es dueño de …` | 1, 2, F1, F3, F2, F5b, T | ídem, o una tabla con otro dueño | ídem; si el dueño no es `postgres`, consultar |
| `PRE-VUELO FALLÓ: … médico(s) con consultorios activos y ninguno predeterminado` | F1 | datos (F1.10) | marcar un predeterminado desde la app, repetir |
| `PRE-VUELO FALLÓ: este bloque (F1) ya está aplicado o a medias` / `PRE-VUELO F3: el bloque … ya existe` / `F4 ya está aplicada` | F1, F3, F4 | se volvió a correr un archivo ya aplicado (§9) o hay un intento anterior | si está registrada, nada que hacer; si no, mandar la lista que da el error |
| `PRE-VUELO FALLÓ: TRUNCATE que esta migración no puede quitar: …` | 2, T | un TRUNCATE concedido por otro otorgante o a PUBLIC (M2.3) | `REVOKE GRANT OPTION … CASCADE` según el LEEME de conteos (cambio en producción: decisión de Angel) |
| `PRE-VUELO FALLÓ: falta public.prohibir_truncate()` / `no existe …: aplica antes …` | T | se corrió T sin 2 o sin las seis | aplicar en orden (`aplicar.sh` ya lo hace) |
| `PRE-VUELO FALLÓ: appointments.google_asignacion existe sin su CHECK y % fila(s) no la cumplen` | F2 | intento anterior con datos (F2.8) | consultar |
| `PRE-VUELO FALLÓ: el índice … de appointments está INVALID … REINDEX INDEX CONCURRENTLY …` | F5b | llave primaria o uno de sus tres índices inválidos (F5b.3) | lo que dice el error, fuera de una transacción; repetir |
| `POST-VUELO …` (cualquiera) | todas | el resultado no es el esperado; nada quedó (es antes del COMMIT) | no seguir; mandar `*.salida.txt` |
| `ALTO: la rejilla de … tiene filas REVISAR` | todas | **ya tiene COMMIT**, sin registrar | no seguir; mandar `*.salida.txt`; decidir registrar o revertir ese archivo |
| `ALTO: … se aplicó pero no quedó en el historial` | todas | falló el `repair` | repetir sólo `npx --yes supabase@2.117.0 migration repair --status applied <versión> --db-url "$URL"` (con `PGPASSWORD` en el entorno) |
| `password authentication failed` | — | contraseña | repetir; la CLI no la imprime |

**Quedarse a medias** entre dos archivos es válido días: cada prefijo del orden
es coherente con la v2 apagada, y con «código primero» el código nuevo ya está
desplegado encima: E2 lo probó apagada con las 5 de `main`, sólo las dos de
TRUNCATE, +F1, +F1+F5a y las 14 [C]; con +F3, +F2 y +F4, sólo encendida [C], y
apagada se deduce [D] (§6.1). Lo que no se hace es encender nada hasta tener las
9. Excepción conocida: entre F3 y F2 la reserva por enlace no funciona (nadie
puede pedirla: no hay enlaces). Si se para a medias porque algo va mal, **no se
revierte nada a mano** (§10).

---

## 9. La segunda pasada de cada archivo

`aplicar.sh` salta lo registrado; esto es lo que pasa si alguien vuelve a correr
un archivo a mano después de aplicar las 9 [C, clon A, `psql -f` como
`postgres`]:

| Archivo | Segunda pasada |
|---|---|
| 1 | entra, sin cambios, rejilla OK |
| 2 | entra, sin cambios, rejilla OK (desde A6 su fila 3 cuenta sólo sus 11 disparadores) [C-CA, fase 2] |
| F1 | aborta limpio en el pre-vuelo («ya está aplicado o a medias») |
| F5a | entra, sin cambios, rejilla OK (desde A6 su fila 6 lista sólo sus dos disparadores) [C-CA, fase 2] |
| F3 | aborta limpio en el pre-vuelo |
| F2 | entra, sin cambios, rejilla OK |
| F4 | aborta limpio en el pre-vuelo |
| F5b | entra, sin cambios, rejilla OK |
| T | entra, sin cambios, rejilla OK |

**Desde la corrección A6** (ronda 1 de la auditoría) las rejillas de 2 y F5a cuentan sólo lo que crea cada archivo: repetirlas después de T ya **no** da REVISAR [C-CA, fase 2: las dos con `rc=0` y 0 REVISAR]. (Antes daban dos REVISAR falsos: la regla era no repetirlas tras T.)

---

## 10. Reversas (sólo con orden de Angel)

> ### ⚠️ LA REGLA DE LA REVERSA (ensayo E2, `../ensayo/ORDEN-Y-REVERSA.md` §5.5)
>
> 1. **Antes de revertir CUALQUIER migración, apagar la v2 en TODAS las
>    clínicas** (`agenda_ajustes.agenda_v2_encendida = false`, por SQL como
>    `postgres`). Revertir F3 (o más) con la v2 encendida en una clínica **le
>    rompe la agenda**: 21 de 66 peticiones dieron 500 (mover, editar,
>    confirmar, cancelar, borrar citas; «Por confirmar»; enlaces) [C, E2 5.5.4,
>    estado r5]. Con la v2 apagada, todos los estados probados funcionaron [C].
> 2. **Las reversas, sólo con `aplicar.sh reversa` / `reversa-truncate`**,
>    nunca a mano. `aplicar.sh` hace `migration repair --status reverted
>    <versión>` tras cada una; las reversas no tocan el historial.
> 3. **Si alguna vez se revierte a mano** (psql o SQL Editor), el paso
>    siguiente OBLIGATORIO es reparar el historial, en la terminal de Angel:
>    `npx --yes supabase@2.117.0 migration repair --status reverted <versión>
>    --db-url "$URL"` (URL sin contraseña, `PGPASSWORD` en el entorno). Si no,
>    el historial miente: la ida **salta** esa migración («ya registrada») y la
>    deja sin aplicar, y `aplicar.sh reversa` intenta revertirla otra vez y falla
>    [C, E2 5.5.6].
> 4. **Una reversa sin datos que perder no pide confirmación de datos**: se
>    aplica a la primera (la de T, la de F2 si no hubo Google, las dos de
>    TRUNCATE). No se corre «para ver si se niega» [C, E2 5.5.6: la de F2, lanzada
>    para ver la negativa, se aplicó].
> 5. Si lo que falla es el CÓDIGO y la base aún no se tocó (paso 5), no hay
>    reversa de base: se vuelve al despliegue anterior de Vercel.

### 10.1 La de la agenda

```bash
bash supabase/produccion/plan/aplicar.sh reversa
```

Orden inverso: **T, F5b, F4, F2, F3, F5a, F1**. Pide `REVERTIR <versión>` antes
de cada una y quita su versión del historial (`migration repair --status
reverted`). Antes: **apagar la v2 en todas las clínicas y respaldar** lo que se
va a perder.

**Comprobación previa de toda la cadena (A5, desde la oleada 3, ronda 1).**
Antes de deshacer la PRIMERA, `aplicar.sh reversa` corre
`reversa-previa.sql` (sólo lee: `BEGIN TRANSACTION READ ONLY` … `ROLLBACK`),
que reúne por adelantado las negativas de las siete, sólo de las que siguen en
el historial:

- **BLOQUEA** — la cadena no empieza y no hay confirmación que lo salte: la v2
  **encendida en alguna clínica** (regla de Angel: apagarla en TODAS antes),
  no ser `postgres`, o que falte `respaldos.consultorios_horario_20261119`
  (sin él la reversa de F1 no podría devolver el horario).
- **DATOS** — lo que cada reversa se negaría a perder (las mismas cuentas que su
  pre-vuelo). Se enseña **la lista entera, una vez**, y se pide escribir
  `PERDER DATOS`; con eso las siete corren con `SET spinus.reversa_con_datos =
  'si'` en su sesión. Cualquier otra respuesta para sin tocar nada.

Así ya no puede pasar lo que vio el auditor: quitar T y F5b y descubrir en F4
que no se puede seguir, con la v2 sin sus candados. [C-CA: con la v2 encendida
en una clínica, «la v2 está ENCENDIDA en estas clínicas … : 1» y ALTO, T y F5b
intactas; apagada, con un aviso y una fila de ajustes, la lista «F4:
avisos_clinica: 1 · F1: agenda_ajustes (filas): 1»; sin confirmar, nada tocado;
con `PERDER DATOS`, las siete en verde.] Si una reversa se negara igualmente
(datos escritos entre la comprobación y su turno), `aplicar.sh` para ahí y pide
empezar de nuevo. **Cada condición de `reversa-previa.sql` es copia de la guarda
de su reversa:** quien cambie una guarda (p. ej. la de F1, hallazgo A4) cambia
también la copia en el mismo commit. [C-CA, fase 2: con un dato para cada guarda, la comprobación previa y cada reversa real dieron el mismo veredicto, §11.]

**Todas se niegan si hay datos** que se perderían (salvo T, que no guarda nada),
sin tocar nada, diciendo cuáles; **sin datos, se aplican sin preguntar más**
(recuadro, punto 4):

| Reversa | Se niega si hay… | Pierde |
|---|---|---|
| T | — (sólo quita 11 disparadores) | la protección contra TRUNCATE de las tablas de la agenda |
| F5b | canceladas cerradas (`cerrada_en`/`sustituida_por`) | las protecciones (reabre borrados y cambios de atendidas con nota) |
| F4 | filas en `cita_confirmaciones`, `cita_reagendos`, `cita_correos` o `avisos_clinica`; exige `postgres` | confirmaciones, correos, avisos |
| F2 | estado de sincronización, empalmes, movimientos rechazados o citas con `google_asignacion` | eso |
| F3 | avisos, enlaces, verificaciones, incidencias, contactos o citas con `reserva_*` | enlaces, candado, columnas `reserva_*` |
| F5a | bloqueos | los bloqueos |
| F1 | ajustes, tipos de cita, citas con tipo, consultorios revisados o con horario propio editados tras la copia, `clinicas.timezone` | ajustes e interruptor, tipos, horario propio/revisado, huso de fábrica. **Conserva** el respaldo |

La confirmación de pérdida de datos se pide **una sola vez, al principio**, con
la lista de la comprobación previa (arriba); ya no reversa por reversa. Tras un
fallo de una reversa, `aplicar.sh` pregunta al catálogo por el testigo (§8):
«SIGUE aplicada» (no hizo nada), «YA NO está … pero SIGUE en el historial»
(repetir sólo `migration repair --status reverted <versión>`) o «no lo sé».
`reversa-truncate` se niega sin tocar nada si T sigue en el historial [C-CA].

Lo que la reversa no quita: `respaldos.consultorios_horario_20261119` (a
propósito) y las filas de `audit_log` (nunca).

### 10.2 Las dos de TRUNCATE (aparte)

```bash
bash supabase/produccion/plan/aplicar.sh reversa-truncate
```

Primero la de `20261126120000` (devuelve TRUNCATE en las **28 tablas** del
inventario de la foto, a los roles que lo tenían, y los privilegios por
omisión; quita sus 11 disparadores y `prohibir_truncate()`), luego la de
`20261125170000` (que aborta si la otra sigue puesta). **Reabren el hueco**
(TRUNCATE no pasa por la RLS ni por la auditoría): sólo si Angel lo pide. Si la
fila 2 de la rejilla de la nº 2 listó el día otras tablas que no estén en el
inventario de su reversa, se añaden antes. T tiene que estar revertida antes
(usa `prohibir_truncate()`).

---

## 11. Ensayo de punta a punta (2026-11-22) [C]

Sobre `clon-spinus-ql-e` (127.0.0.1:54375), clon NUEVO de `~/spinus-produccion-foto/`
con `clonar-desde-foto.sh` + `esperadas-clon.tsv` (14 diferencias foto ↔ clon,
todas esperadas), aplicando con el MISMO `aplicar.sh` en modo ensayo, como
`postgres` NO superusuario (`APL_HOST=127.0.0.1 … APL_RED=host`, contraseña por
stdin). Incluye `migration repair` de verdad (CLI 2.117.0) contra el clon.

1. **Conteos:** 0 ALTO, 0 AVISO (73 OK, 5 INFO).
2. **`aplicar.sh aplicar`:** las 9 aplicadas y registradas; **ninguna REVISAR**;
   rejillas 63 OK + 10 INFO (`rejillas-del-ensayo.txt`).
3. **`aplicar.sh estado`:** las 14 versiones, las 9 «ya registrada».
4. **Antes → después:** 958 diferencias entonces; **965 con el SQL definitivo** (fase 2 de CA, abajo: +3 columnas del respaldo y +4 comentarios de columna) (`diferencias-antes-despues.clon-foto.tsv`).
   Frente a las 952 del borrador sobre `base-main`: −5 (`anon`/`authenticated`
   no tenían en producción privilegios en `clinica_conexiones_google`,
   `firmas_documento`, `folios_contador` y `plantillas_documento`, así que ahí no
   hay TRUNCATE que quitar) y +11 (los disparadores de T). Foto → después: 972
   (las 958 + las 14 foto ↔ clon).
5. **`reversa` (7) y `reversa-truncate` (2):** todas en verde, historial
   devuelto a las 5 de `main`.
6. **Contra la foto, tras las reversas:** sólo las 14 esperadas foto ↔ clon y
   **10 de `respaldos.consultorios_horario_20261119`** (relación, 5 columnas,
   llave primaria e índice, comentario, permiso de `postgres`): lo esperado.
   Contra el clon de antes: esas 10 y nada más. **Con el SQL definitivo (A4) son
   13 y 8 columnas** (`horario_antes`, `horario_copiado`, `copiado_en`) [C-CA, fase 2].
7. **Segunda ida:** las 9 otra vez en verde, sin REVISAR; estructura idéntica a
   la de la primera ida (0 diferencias). Las rejillas, iguales; la única
   diferencia de la salida es un NOTICE de F1 (`relation
   "consultorios_horario_20261119" already exists, skipping`: el respaldo se
   conserva tras la reversa y F1 lo reutiliza).
8. **`catalogo-despues.sql`** tras la primera ida: los valores de
   `COMPROBACION-POSTERIOR.md` §5. Ninguna contraseña en los registros (buscada).

En el mismo clon, después: la segunda pasada de cada archivo (§9) y la
reversa con datos (§10.1). Script y salidas fuera del repo, en
`~/spinus-fusion/ensayo-ql/` (`scripts/ensayo.sh`, `salidas-20261122-205231/`).
Las tres corridas (clones `-b`, `-c` y `-e`, cada una sobre un clon nuevo)
dieron las mismas cifras: 958 diferencias con las mismas claves, 63 OK + 10
INFO, ninguna REVISAR, reversas al estado de la foto salvo el respaldo.

**Repetido con el guion NUEVO [C-CA, 2026-11-22]**, sobre `clon-spinus-ca-1`
(clon nuevo de la misma foto, 14 diferencias esperadas), con el registro de cada
petición del servidor encendido: conteos 73 OK + 5 INFO; las 9 en verde, 3
peticiones por archivo, rejillas idénticas byte a byte a
`rejillas-del-ensayo.txt` (63 OK + 10 INFO, 0 REVISAR, mismos NOTICE); `estado`
con las 14; `catalogo-despues.sql` con los valores de
`COMPROBACION-POSTERIOR.md` §5; antes → después, 958 diferencias con las MISMAS
claves que `diferencias-antes-despues.clon-foto.tsv`; reversa (con la
comprobación previa: «ninguna se va a negar») y reversa-truncate en verde; contra
la foto, sólo las 14 esperadas y las 10 del respaldo; segunda ida **con fallos
provocados**: parar a petición antes de F3 (cuatro aplicadas, «Nada a medias»),
F3 con un candado ajeno sobre `appointments` (`lock timeout` a los 5 s, «el
catálogo dice que NO quedó aplicada», F3 ni en el catálogo ni en el historial),
y la repetición (salta las cuatro, aplica las cinco); estructura idéntica a la
primera ida (0 diferencias). Ninguna contraseña en los registros. Salidas en
`~/spinus-fusion/ensayo-ca/salidas-20261122-222443/`; las pruebas de A2, A5 y A8
en `pruebas-20261122-223440/`, las medidas de §5.0 y §5.2 en
`medidas-20261122-222827/`. **La fase 2 de CA lo repitió entero con el SQL definitivo** (abajo).

**Repetido ENTERO con el SQL DEFINITIVO [C-CA, fase 2, 2026-11-22]** (las
correcciones de la ronda 1 de CB y el COMMENT de A3), sobre `clon-spinus-ca-2`,
clon nuevo de la foto; salidas en `~/spinus-fusion/ensayo-ca/fase2-20261122-225336/`:

1. Conteos: 0 ALTO, 0 AVISO (F1.9 `no existe`, con la forma nueva de 8 columnas).
2. `aplicar.sh aplicar`: la prueba de humo (104 104 bytes, aceptada, 0,30 s) y
   las 9 en verde, cada una con su rejilla visible; 3 peticiones por archivo en
   el registro del servidor; 63 OK + 10 INFO, 0 REVISAR (`rejillas-del-ensayo.txt`,
   regenerado: cambian los textos de la fila 3 de la nº 2 y de la fila 6 de F5a).
3. `estado`: las 9 «ya registrada».
4. `catalogo-despues.sql`: los mismos valores de `COMPROBACION-POSTERIOR.md` §5
   (no cambió). Antes → después: **965** diferencias (958 + 3 columnas del
   respaldo + 4 comentarios de columna; `diferencias-antes-despues.clon-foto.tsv`,
   regenerada con este ensayo); foto → después, 979.
5. Repetir la nº 2 y F5a después de T: `rc=0`, **0 REVISAR** (A6).
6. `reversa` (comprobación previa: «ninguna se va a negar») y `reversa-truncate`:
   en verde; contra la foto, las 14 esperadas y **13** del respaldo; historial en 5.
7. Segunda ida: las 9 en verde, estructura idéntica a la primera (0 diferencias).
8. **El ciclo de A4**, con dos consultorios sembrados ANTES de F1 (horarios
   «previo-1» y «previo-2», la clínica con otro): aplicar → los dos con el de la
   clínica; revertir sin preguntar nada → vuelven «previo-1» y «previo-2»;
   reaplicar; editar el HORARIO de uno y el NOMBRE del otro; revertir → la
   comprobación previa lista **sólo** «consultorios con horario editado …: 1» y,
   sin confirmar, no toca nada; confirmada, el renombrado **recupera «previo-2»**
   y el editado se queda con su edición; reaplicar en verde.
9. **Cada guarda, comprobación previa frente a la reversa real:** con un dato
   sembrado para cada una (cancelada cerrada, aviso, movimiento rechazado de
   Google, contacto bloqueado, bloqueo, fila de ajustes y huso de fábrica),
   `reversa-previa.sql` las listó todas, y cada reversa corrida a mano, sin
   confirmar, **se negó por exactamente lo mismo** (T, que no tiene guarda, no);
   confirmando, todas en verde.
10. Las 48 pruebas de `supabase/pruebas-sql/` contra el clon migrado, con
    `semilla-minima.sql`: **48 PASAN** (incluida `cb_aislamiento_clinicas`).
11. A3 en el clon: con la sesión del médico administrador de la clínica A, un
    contacto para un médico de OTRA clínica, para una secretaria o para un uuid
    que no existe da el mismo `El médico del contacto no pertenece a la
    clínica`; para el médico propio entra. Los enlaces (como `service_role`):
    el mismo veredicto en los cuatro casos. md5 de `proteger_reserva_contactos`
    `7049ecc7…` y de `proteger_reserva_enlaces` `acd4128b…`, sin cambios.
12. **A través del proxy con 150 ms:** reversa, reversa-truncate y las 9 en
    verde, sin REVISAR; 1,21–1,60 s por archivo; prueba de humo aceptada en
    1,09 s.

Las ventanas de candado de §5.0 y los cortes de §5.2 se midieron con el SQL de
la fase 1; con una petición por archivo, las sentencias que añadió la ronda 1 no
las cambian (es tiempo de servidor) — DEDUCIDO, no se volvieron a medir.

**Lo que no se ensayó:**

- El pooler real (Supavisor): cómo presenta la rejilla y los NOTICE de una
  petición de 100 KB, cuánto tarda en notar una terminal muerta y si dejaría
  pasar opciones de arranque (por eso los ajustes van con `SET`).
- Datos: el clon está vacío. El backfill de F1 y las ventanas con citas se
  midieron con datos sintéticos (notas de C1–C3, hasta 200 000 citas).
- Que Supavisor presente `postgres.<ref>` como `postgres` (DEDUCIDO; G.02 lo
  dirá). La latencia se simuló con un proxy (§5.0), no se midió contra el
  pooler: la mide `aplicar.sh estado` el día.
- `migration repair` contra el historial de producción (sí contra el clon,
  cuya tabla viene de la foto).
- `aplicar.sh respaldo` (lo ensayó L; no se repitió).
- El comportamiento de la app contra la base migrada (es de E2).
- Otro `search_path` en las dos de TRUNCATE, F5a y T: no constan probadas con
  `''`; con el de `postgres` (`"$user", public, extensions`) sí [C].

---

## 12. Pendiente antes del día

Sólo lo que de verdad queda (al 2026-11-22, tras la fase 2 de CA). Lo resuelto
se quitó: las rejillas de 2 y F5a (A6, corregidas), la elección `aplicar.sh` /
`db push` (decidido: `aplicar.sh`), las ventanas de F3 y F2 (A1, resuelto con
una petición por archivo, §5.0) y la duración de las rutas en Vercel (Fluid
Compute confirmado por Angel; se mira el panel en el paso 4).

1. **`huellas.sha256`:** regenerado con el SQL definitivo (fase 2 de CA: 17 de
   los 18 archivos cambiaron con la ronda 1; sólo T sigue igual). Si se toca
   cualquier migración o reversa, se regenera en el mismo commit:
   `sha256sum supabase/migrations/2026112* supabase/migrations/202612* supabase/reversas/2026112* supabase/reversas/202612* > supabase/produccion/plan/huellas.sha256`.
2. **§15, el tramo de «más del 20 % y hasta el 50 % más lenta»:** SIN DEFINIR
   POR ANGEL (el coordinador se lo pregunta).
3. **§15, el fragmento de la consola:** pendiente de probar en un navegador
   real; lo prueba el agente del ensayo principal.
4. **La hora sin consulta** (§4, paso 0; §8.1 si hay que dejarlo para otra):
   la pone Angel. Y la pausa y el número de repeticiones de §8.1 (2 min, 3 veces)
   son una propuesta de CA que Angel puede cambiar.
5. **El pooler real** no se puede ensayar sin producción: el día lo dicen la
   prueba de humo de petición grande y la ida y vuelta de `aplicar.sh estado`
   (§4, paso 3). Si la prueba de humo sale «NO aceptada», no se aplica.
6. Después de aplicar de verdad: la línea `-- ESTADO · PRODUCCIÓN` de cada uno de
   los 9 archivos, con fecha y comprobación (`AUDITORIA-MIGRACIONES.md` §7), en
   un commit. Cambia sus huellas: es lo esperado.
7. Dónde correr de forma automática la comprobación periódica de los privilegios
   por omisión (`COMPROBACION-POSTERIOR.md` §10; `DEUDA_TECNICA.md` AG-DT-270):
   lo decide Angel. A mano, la consulta ya está.

---

## 13. Lo que no es de este plan pero bloquea ENCENDER la v2

Aplicar las 9 y desplegar no enciende nada. Para el paso 8 hace falta, además
(detalle en `mejora_agendaV2.md` §7 y §10): el **texto legal** del aviso de la
reserva (`src/lib/reserva/avisoReserva.ts`, PENDIENTE DE REVISIÓN LEGAL; contra
la LFPDPPP vigente de 2025, no de memoria); **Google real** (ida y vuelta, RSVP,
y sólo entonces `AGENDA_RSVP_GOOGLE`); **PostgREST con `imatch`** (búsqueda de
pacientes, sale sin interruptor: humo 5 de la comprobación posterior); y las
decisiones pendientes de Angel de `mejora_agendaV2.md` §7.

---

## 14. Límites conocidos y aceptados

Decididos por Angel tras la auditoría independiente, ronda 1
(`../auditoria/RONDA-1.md`). No son defectos pendientes: no se «arreglan» sin
una decisión nueva.

- **A7 · El bloqueo y la reserva son totales salvo carrera de milisegundos, y
  dentro de Spinus el empalme avisa.** El alta de una cita por el personal (o un
  bloqueo) no toma el candado del médico que toma `reservar_por_enlace`
  (`pg_advisory_xact_lock(1790, médico)`): si las dos escrituras caen en la
  misma ventana de milisegundos, pueden quedar dos citas en el mismo turno, o
  una cita dentro de un bloqueo. No se añade candado a las altas del personal
  (`DEUDA_TECNICA.md` AG-DT-271).
- **A9 · Tres tablas guardan ids de cita sin llave foránea, a propósito:**
  `avisos_clinica.cita_id`, `gcal_movimientos_rechazados.cita_id` y
  `reserva_empalmes_google.cita_reserva_id`/`cita_otra_id`. El motivo queda en
  el `COMMENT` de cada columna (lo escribe el agente de las correcciones de SQL).
- **A10 y A11 quedan en la deuda como notas:** las acciones referenciales pasan
  por encima de los candados de la cita (`DEUDA_TECNICA.md` AG-DT-272) y F5b
  sube de candado sobre `appointments` dentro de su transacción (AG-DT-273).

---

## 15. Medir cuánto tarda en abrir la agenda (al encender la v2)

Orden de Angel: el **primer paso tras encender la v2 en su clínica** es medir en
producción cuánto tarda en abrir la agenda y compararlo con lo de antes. Sin
instalar nada: las herramientas de desarrollador de **Chrome o Edge** (en
Firefox los nombres cambian y no da el LCP del punto 4).

**Lo que la app ya marca:** nada. `src/` no tiene `performance.mark` ni
`performance.measure` (comprobado con `git grep` el 2026-11-22), así que se mide
con lo que da el navegador.

**Las condiciones, iguales antes y después:** la misma cuenta, el mismo equipo,
el mismo navegador, la misma red (no cambiar de wifi a datos), la misma vista y
la misma semana de la agenda, a una hora parecida, sin otras pestañas pesadas.
«Antes» = el mismo día, con las 9 aplicadas y la v2 todavía apagada; «después» =
nada más encenderla.

**Cada medición** (5 veces seguidas; se anota la **mediana**, la del medio al
ordenarlas):

1. Abrir la agenda (`/agenda`) con la sesión iniciada. `F12` → pestaña **Red**
   (*Network*). Marcar **Inhabilitar caché** (*Disable cache*) y dejar el filtro
   en **Todo** (*All*). Las herramientas tienen que seguir abiertas: con ellas
   cerradas, la casilla de la caché no actúa.
2. Recargar la página (`F5`). Esperar a que la agenda pinte las citas y a que la
   lista de Red deje de crecer.
3. En la barra de abajo de la pestaña Red, anotar: **solicitudes** (*requests*),
   **Finalización** (*Finish*), **DOMContentLoaded** y **Carga** (*Load*). (Los
   nombres exactos dependen del idioma del navegador.) Mirar también si alguna
   fila sale en rojo (4xx/5xx).
4. En la pestaña **Consola**, pegar esto y pulsar Enter (sólo lee los tiempos que
   el navegador ya guarda; **no** enseña direcciones ni datos, sólo números):

   ```js
   new Promise(r => new PerformanceObserver(l => r(l.getEntries().at(-1)?.startTime ?? 0))
     .observe({ type: 'largest-contentful-paint', buffered: true })).then(lcp => {
     const n = performance.getEntriesByType('navigation')[0];
     const rec = performance.getEntriesByType('resource');
     const api = rec.filter(e => /\/(api|rest\/v1)\//.test(e.name));
     console.table({
       'primer byte (ms)': Math.round(n.responseStart),
       'DOMContentLoaded (ms)': Math.round(n.domContentLoadedEventEnd),
       'load (ms)': Math.round(n.loadEventEnd),
       'mayor pintado, LCP (ms)': Math.round(lcp),
       'recursos': rec.length,
       'peticiones a /api y /rest': api.length,
       'fin de la última de esas (ms)': Math.round(Math.max(0, ...api.map(e => e.responseEnd))),
     });
   });
   ```

   **Pendiente de probar en un navegador real; lo prueba el agente del ensayo
   principal.** (Sólo se comprobó su sintaxis con `node --check`; si da error,
   basta con los números del punto 3.)
   El «primer byte» incluye el servidor: la página trae las citas de la semana
   ya en el HTML. «Fin de la última de /api y /rest» es lo más cerca de «la
   agenda terminó de cargar sus datos».

**Tabla para anotar** (una fila por recarga; al final, la mediana de cada
columna):

| | Solicitudes | Finalización (s) | DOMContentLoaded (s) | Carga (s) | Primer byte (ms) | LCP (ms) | Fin de la última /api (ms) | Filas en rojo |
|---|---|---|---|---|---|---|---|---|
| antes 1 | | | | | | | | |
| antes 2 | | | | | | | | |
| antes 3 | | | | | | | | |
| antes 4 | | | | | | | | |
| antes 5 | | | | | | | | |
| **mediana antes** | | | | | | | | |
| después 1 | | | | | | | | |
| … | | | | | | | | |
| **mediana después** | | | | | | | | |

**Qué se espera con la v2** (DEDUCIDO de `CLAUDE.md`, «Agenda v2»): unas
pocas solicitudes más (el trozo de la campana y del engrane, que sólo se
descarga con la v2, y `GET /api/agenda/por-confirmar` con los avisos); nada de
peticiones nuevas para pintar la rejilla.

**Qué se hace con el resultado (decisión de Angel, literal; se compara la
mediana «después» con la mediana «antes» de encender):** «igual o más rápida:
se sigue; hasta un 20 % más lenta: no se apaga, pero no se enciende en ninguna
otra clínica hasta saber la causa; más de un 50 % más lenta, o con errores: se
apaga en mi clínica y se investiga.»

| Resultado (mediana después frente a mediana antes) | Qué se hace |
|---|---|
| igual o más rápida | se sigue |
| hasta un 20 % más lenta | no se apaga; **no se enciende en ninguna otra clínica** hasta saber la causa |
| **más del 20 % y hasta el 50 % más lenta** | **SIN DEFINIR POR ANGEL (el coordinador se lo pregunta)** |
| más de un 50 % más lenta, **o con errores** | se apaga en la clínica de Angel y se investiga |

«Errores» = filas en rojo (4xx/5xx) en la pestaña Red que antes no salían, o
avisos de error en la página. Para apagar: `agenda_ajustes.agenda_v2_encendida =
false` en esa clínica, desde el SQL Editor (§4, paso 8); la agenda vuelve a la
de antes (falla cerrado).
