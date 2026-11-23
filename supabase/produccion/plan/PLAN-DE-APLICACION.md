# Plan de aplicación en producción — agenda v2 (9 migraciones)

> Rehecho el 2026-11-22 (agente QL; el ensayo se repitió entero tres veces tras sendos cortes del equipo, la última con todo en un solo clon, rama `feature/agenda-v2-produccion-ql`)
> tras la foto real de producción y las correcciones C1, C2, C3 y T. Sustituye
> al borrador del agente L, que era anterior a la foto.
> **En esta fase no se aplica nada.** Es el guion para el día que Angel lo
> ordene. «[C]» = comprobado en un clon de la foto real (contenedores
> `clon-spinus-ql-*`, PostgreSQL 17.6, `postgres` NO superusuario, como en
> producción); «[N]» = comprobado por otro agente y anotado en
> `supabase/fusion/notas/`; «ASUMIENDO QUE…» = no se pudo comprobar.

Archivos de esta carpeta:

| Archivo | Para qué |
|---|---|
| `aplicar.sh` | El único comando del día: `estado`, `respaldo`, `aplicar`, `reversa`, `reversa-truncate`. |
| `huellas.sha256` | sha256 de las 9 migraciones y sus 9 reversas, tal como están hoy. `aplicar.sh` se niega a correr un archivo cuya huella no coincida. |
| `rejillas-del-ensayo.txt` | La rejilla final de cada archivo, literal, del ensayo de punta a punta sobre el clon de la foto (§11). |
| `diferencias-antes-despues.clon-foto.tsv` | Las 958 diferencias de estructura antes → después de ese ensayo (claves: estado, tipo, esquema, clave, campo). |
| `COMPROBACION-POSTERIOR.md` | Cómo comprobar que producción quedó idéntica al ensayo (paso 5). |

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
salta), comprueba su sha256 contra `huellas.sha256`, pide escribir su versión,
la ejecuta con `psql -X -v ON_ERROR_STOP=1 -f` (imagen de Postgres 17.6 del
stack local, en un contenedor efímero, `supabase/` montado sólo lectura), para
si `psql` falla o si su rejilla tiene alguna fila `REVISAR`, y la registra con
la CLI: `npx --yes supabase@2.117.0 migration repair --status applied <versión>
--db-url <URL sin contraseña>`. Comprueba que la fila quedó en el historial.

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
- Lo que `db push` haría mejor: manda cada archivo en una sola petición, con lo
  que las ventanas de candado serían algo más cortas (sin un viaje por
  sentencia). Desde C1–C3 las ventanas fuertes ya son de 3–13 sentencias (§5):
  la diferencia es de décimas de segundo.

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
- [ ] Los conteos en OK (paso 3), corridos por Angel.
- [ ] **Orden explícita de Angel**, ese día.
- [ ] Nadie más desplegando ni tocando la base.

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
si nada lo necesitó. No se copia a ningún otro sitio. (Ensayado por L con la
frase por stdin; no se repitió en este ensayo.)

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
anotan las cuentas para el paso 5.

### Paso 4 · Las 9 migraciones

```bash
bash supabase/produccion/plan/aplicar.sh aplicar
```

Pide `PRODUCCION`, la contraseña y, antes de cada archivo, su versión. En el
ensayo [C] cada una tardó 0,24–0,53 s en el clon (en las tres corridas) (incluye arrancar el
contenedor de `psql`); por el pooler, más (§5). Lo que hay que mirar en cada
rejilla (literal en `rejillas-del-ensayo.txt`: **63 OK, 10 INFO, 0 REVISAR**):

| # | Filas | Mirar especialmente | NOTICE esperados (no son errores) |
|---|---|---|---|
| 1 | 7 (5 OK, 2 INFO) | fila 4: md5 normalizado `f1fe023a…`; fila 7: filas de `audit_log` (no cambian) | — |
| 2 | 8 (3 OK, 5 INFO) | fila 2: **28 tablas** a las que quitó TRUNCATE (las del inventario de su reversa; si salen otras, añadirlas a la reversa); fila 8: «ninguna» | `schema "pg_temp" does not exist, skipping` |
| 3 F1 | 15 (14 OK, 1 INFO) | consultorios respaldados = **todos** los consultorios (G.13/F1.11 de los conteos); 0 con `horario_propio = false` | — |
| 4 F5a | 6 OK | — | 6 × `policy/trigger … does not exist, skipping` |
| 5 F3 | 9 (8 OK, 1 INFO) | el censo: 0 / 0 / 0 | — |
| 6 F2 | 9 (8 OK, 1 INFO) | fila 8: md5 normalizado de las dos puertas, `a2dcfa8f…` / `2efd7734…` | 1 × `policy … does not exist, skipping` |
| 7 F4 | 8 OK | los 7 tipos de aviso | — |
| 8 F5b | 7 OK | fila 6: 3 índices válidos; fila 7: llave primaria válida | (un WARNING sólo si hubiera un índice inválido ajeno: G.18) |
| 9 T | 4 OK | los 11 disparadores; cero TRUNCATE en las 16 tablas | `schema "pg_temp" does not exist, skipping` |

Terminadas: `aplicar.sh estado` → las 9 «ya registrada».

### Paso 5 · La comprobación posterior

`COMPROBACION-POSTERIOR.md` entero. Si algo no cuadra, no se despliega el
código y se decide entre arreglar o revertir (§10).

### Paso 6 · Variables de Vercel (§6), y después el despliegue del código

**Antes de desplegar** (Vercel → Project → Settings → Functions):

- [ ] **Fluid Compute sigue ACTIVADO.** La agenda depende de él: el trabajo que
      sus rutas dejan en `after()` vive dentro del límite de la función, y
      ninguna declara `maxDuration` (§12, punto 4).
- [ ] **No hay un «Function Max Duration» de proyecto menor que 300 s.**

### Paso 7 · Encender la v2 en UNA clínica

Sólo cuando §13 esté resuelto. `agenda_ajustes.agenda_v2_encendida` **sólo** la
cambian `postgres`/`supabase_admin` (`trg_agenda_ajustes_proteger`): desde el
SQL Editor, para la clínica de pruebas de Angel.

---

## 5. Candados y ventanas (las de hoy, tras C1–C3 y T)

Cada archivo es UNA transacción: cada candado se mantiene hasta su `COMMIT`.
Todos llevan `SET LOCAL lock_timeout = '5s'`; las de la agenda, además,
`statement_timeout` 60 s (F5b 120 s).

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

**Lo que cambia con el número de citas (G.13b).** F3 y F2 recorren
`appointments` una vez (FK/CHECK nuevas) y F5b construye dos índices y valida
una FK y un CHECK: las ventanas de F3, F2 y F5b crecen en proporción. Medido
hasta 200 000. Con más, se avisa antes de seguir.

**Por el pooler** cada sentencia suma la ida y vuelta a `us-west-2`
(ASUMIENDO decenas de ms). Por eso C1–C3 juntaron lo que necesita el candado
fuerte en bloques `DO`: lo que alarga la ventana es el número de viajes, no el
trabajo del servidor.

**Qué pasa con una transacción larga abierta** (G.14): F1 y F5a no hacen cola:
reintentan 5 s y abortan con `CANDADOS: … reintenta en unos minutos`, sin dejar
nada y sin frenar a nadie mientras tanto [N: con una lectura abierta 12 s, una
lectura de `appointments` lanzada detrás tardó 0,05 s]. Las demás hacen cola
hasta 5 s (y lo que llega detrás espera con ellas) y abortan con `canceling
statement due to lock timeout`. En los dos casos: esperar a que acabe y
**repetir** `aplicar.sh aplicar` (salta lo registrado). No subir el
`lock_timeout`.

**A qué hora.** Cuando no haya consulta (ASUMIENDO de noche o domingo
temprano), y fuera del horario de cualquier trabajo de `pg_cron` que nombre
`appointments` o `clinicas` (G.17). Las tareas de `vercel.json` aún no están
desplegadas en el paso 4.

---

## 6. Código y base: el orden, y las variables de Vercel

**Orden: migraciones primero, código después**, en la misma sesión (pasos 4 →
5 → 6), para que la ventana «base nueva + código viejo» dure minutos.

- **Base migrada + código viejo (el de `main`, hoy en producción):** el código
  viejo no conoce las tablas nuevas. Lo que actúa sin la v2 está en §7: lo único
  que alguien podría notar es que una cita **atendida con nota** ya no cambia de
  estado ni de fecha (el código viejo verá un error genérico en vez del 409
  `nota_ligada`).
- **Código nuevo + base sin migrar:** falla cerrado (interruptor ausente =
  apagado; tolera 42P01/PGRST202), con un `warn` en el log por petición.
- **E2** (ensayo de código ↔ base) es quien comprueba las dos direcciones; hasta
  que lo confirme, este orden es el del diseño (`mejora_agendaV2.md` §7).

**Variables de entorno de Vercel** (nombres sacados de `src/` y `.env.example`
el 2026-11-22; sólo nombres, nunca valores). Vercel lee las variables **al
construir**: se ponen **antes** del despliegue (o se redespliega).

| Variable | ¿Nueva con la agenda v2? | Valor (cómo se genera) | Si falta |
|---|---|---|---|
| `RESERVA_SECRETO` | **sí** | `openssl rand -hex 32` (≥ 64 hex; `src/lib/reserva/secretos.ts`) | no se emiten enlaces de reserva ni de confirmación (falla cerrado) |
| `EMAIL_TRANSPORT` | **sí** | el literal `resend` | los correos de la agenda no salen (`decidirTransporte`: apagado) |
| `CRON_SECRET` | **sí** | `openssl rand -hex 32` | `/api/cron/google-sync` (cada 10 min) y `/api/cron/recordatorios` (cada 15 min) responden 401 |
| `AGENDA_RSVP_GOOGLE` | **sí**, opcional | el literal `encendido` | apagado por omisión. **Sólo tras la prueba de RSVP con Google real** |
| `RESEND_API_KEY` | no (ya la usa `main`) | — | sin correo |
| `NEXT_PUBLIC_APP_URL` | no | — | los enlaces de los correos salen mal |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | no | — | — |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_TOKEN_SECRET` | no (ya la usa `main`) | — | sin conexión con Google |

**Las que faltarían en producción, según lo que el repo permite saber:** las
cuatro nuevas (`RESERVA_SECRETO`, `EMAIL_TRANSPORT`, `CRON_SECRET`,
`AGENDA_RSVP_GOOGLE`), porque ningún código de `main` las lee (comparado
`env.*` de `src/` en `main` y en la rama). Que las de `main` estén puestas es
DEDUCIDO (`main` funciona en producción); el repo no puede verlo. Angel lo mira
en Vercel → Project → Settings → Environment Variables.

**Las que NO deben existir en producción** (son de pruebas locales; el código
las ignora fuera de local, pero no se ponen): `GCAL_FALSO_URL`, `MAILPIT_URL`,
`RESERVA_AVISO_BORRADOR_LOCAL`; y `EMAIL_TRANSPORT` nunca con `captura`.

- Los valores se generan en la terminal de Angel y se pegan en Vercel como
  «Sensitive», entorno **Production** sólo (ASUMIENDO que las previews no usan la
  agenda v2: un `RESERVA_SECRETO` distinto contra la misma base daría enlaces
  que producción no reconoce). No se escriben en ningún archivo.
- **Rotar `RESERVA_SECRETO` invalida todos los enlaces y el historial del
  candado**: se genera una vez y se guarda en el gestor de contraseñas de Angel.
- **Vercel está en Pro** (confirmado por Angel): las dos tareas de `vercel.json`
  (cada 10 y 15 min) se admiten. Tras el despliegue: Schedules → Cron Jobs →
  View Logs, la primera invocación en 2xx.

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
| F5b | **una cita atendida con nota clínica ligada no cambia de estado ni de fecha/hora ni se borra**, también para `service_role` | **un médico que lo intente** (error genérico con el código viejo) |
| F1–F5b | las columnas nuevas de `appointments` viajan en los mensajes de Realtime | nadie (van NULL) |

---

## 8. Si algo aborta: mensaje → causa → acción

Regla general: **cada archivo es una transacción**. Si aborta, de ese archivo
no queda nada y su versión no se registra; los anteriores quedan aplicados y
registrados. `aplicar.sh` para con `ALTO: … FALLÓ`. Para seguir, quitar la
causa y volver a correr `aplicar.sh aplicar`.

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
es coherente con la v2 apagada. Lo que no se hace es desplegar el código ni
encender nada hasta tener las 9. Excepción conocida: entre F3 y F2 la reserva
por enlace no funciona (nadie puede pedirla: no hay enlaces).

---

## 9. La segunda pasada de cada archivo

`aplicar.sh` salta lo registrado; esto es lo que pasa si alguien vuelve a correr
un archivo a mano después de aplicar las 9 [C, clon A, `psql -f` como
`postgres`]:

| Archivo | Segunda pasada |
|---|---|
| 1 | entra, sin cambios, rejilla OK |
| 2 | entra, sin cambios, pero **fila 3 REVISAR** (cuenta 22 disparadores con `prohibir_truncate()`: sus 11 y los 11 de T) |
| F1 | aborta limpio en el pre-vuelo («ya está aplicado o a medias») |
| F5a | entra, sin cambios, pero **fila 6 REVISAR** (lista también `trg_agenda_bloqueos_sin_truncate`, de T) |
| F3 | aborta limpio en el pre-vuelo |
| F2 | entra, sin cambios, rejilla OK |
| F4 | aborta limpio en el pre-vuelo |
| F5b | entra, sin cambios, rejilla OK |
| T | entra, sin cambios, rejilla OK |

**Regla:** las de antes de T **no se repiten después de T**. Esos dos REVISAR
son falsos (las rejillas de 2 y F5a no conocían T), no abortan y no cambian
nada. Si hubiera que repetir 2 o F5a, se lee su rejilla sabiendo esto. Para que
no salieran, habría que tocar el SQL de las rejillas de esas dos migraciones
(contar sólo sus disparadores por nombre): fuera del encargo de este agente; se
deja para el coordinador.

---

## 10. Reversas (sólo con orden de Angel)

### 10.1 La de la agenda

```bash
bash supabase/produccion/plan/aplicar.sh reversa
```

Orden inverso: **T, F5b, F4, F2, F3, F5a, F1**. Pide `REVERTIR <versión>` antes
de cada una y quita su versión del historial (`migration repair --status
reverted`). Antes: **apagar la v2 en todas las clínicas y respaldar** lo que se
va a perder.

**Todas se niegan si hay datos** que se perderían (salvo T, que no guarda nada),
sin tocar nada, diciendo cuáles:

| Reversa | Se niega si hay… | Pierde |
|---|---|---|
| T | — (sólo quita 11 disparadores) | la protección contra TRUNCATE de las tablas de la agenda |
| F5b | canceladas cerradas (`cerrada_en`/`sustituida_por`) | las protecciones (reabre borrados y cambios de atendidas con nota) |
| F4 | filas en `cita_confirmaciones`, `cita_reagendos`, `cita_correos` o `avisos_clinica`; exige `postgres` | confirmaciones, correos, avisos |
| F2 | estado de sincronización, empalmes, movimientos rechazados o citas con `google_asignacion` | eso |
| F3 | avisos, enlaces, verificaciones, incidencias, contactos o citas con `reserva_*` | enlaces, candado, columnas `reserva_*` |
| F5a | bloqueos | los bloqueos |
| F1 | ajustes, tipos de cita, citas con tipo, consultorios revisados o con horario propio editados tras la copia, `clinicas.timezone` | ajustes e interruptor, tipos, horario propio/revisado, huso de fábrica. **Conserva** el respaldo |

Si una se niega por datos, `aplicar.sh` lo dice y pregunta: escribir
`PERDER DATOS <versión>` la repite con `SET spinus.reversa_con_datos = 'si'` en
la sesión (lo que las reversas leen); cualquier otra cosa para sin tocar nada.
[C: con una clínica de ensayo con huso, la de F1 se negó, se confirmó y se hizo;
sin confirmar, paró y F1 siguió aplicada y registrada.]

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
4. **Antes → después:** 958 diferencias (`diferencias-antes-despues.clon-foto.tsv`).
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
   Contra el clon de antes: esas 10 y nada más.
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

**Lo que no se ensayó:**

- Datos: el clon está vacío. El backfill de F1 y las ventanas con citas se
  midieron con datos sintéticos (notas de C1–C3, hasta 200 000 citas).
- El pooler: la latencia por sentencia y que Supavisor presente
  `postgres.<ref>` como `postgres` (DEDUCIDO; G.02 lo dirá).
- `migration repair` contra el historial de producción (sí contra el clon,
  cuya tabla viene de la foto).
- `aplicar.sh respaldo` (lo ensayó L; no se repitió).
- El comportamiento de la app contra la base migrada (es de E2).
- Otro `search_path` en las dos de TRUNCATE, F5a y T: no constan probadas con
  `''`; con el de `postgres` (`"$user", public, extensions`) sí [C].

---

## 12. Pendiente antes del día

1. **`huellas.sha256`:** está regenerado con los archivos de HOY (las 9 y sus 9
   reversas). Si la auditoría cambia alguno, se regenera en el mismo commit que
   la aprobación:
   `sha256sum supabase/migrations/2026112* supabase/migrations/202612* supabase/reversas/2026112* supabase/reversas/202612* > supabase/produccion/plan/huellas.sha256`.
2. Las dos REVISAR falsas de la segunda pasada (§9): decidir si se corrigen las
   rejillas de 2 y F5a o basta con la regla.
3. La decisión de §2 (`aplicar.sh` o `db push`).
4. **Duración máxima de las rutas de la agenda en Vercel: CONFIRMADA**
   (2026-11-22, oleada 3). Angel miró el panel: **Fluid Compute está
   activado**. Con Fluid Compute, en Pro, una función sin `maxDuration` tiene
   **300 s por omisión** (800 s de máximo configurable): documentación de
   Vercel, https://vercel.com/docs/functions/configuring-functions/duration,
   «Duration limits» (leída por el coordinador el 2026-11-22). Lo entregado a
   `waitUntil` —y `after()` va por ahí: Next 16.2.1,
   `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`,
   «Duration» y «Reference: supporting `after` for serverless platforms»—
   comparte ese límite y se cancela al alcanzarlo (Vercel,
   `functions/functions-api-reference/vercel-functions-package`, `waitUntil`).
   Esa documentación NO da la cifra con Fluid Compute desactivado.
   Por eso **ninguna** de las rutas de la agenda con `after()` declara
   `maxDuration` (decisión de Angel: 30 s acortaría el margen):
   `reservar/[codigo]`, `reservar/[codigo]/turnos`, `confirmar/[codigo]`,
   `appointments`, `appointments/[id]`, `appointments/[id]/reagendar`,
   `agenda/bloqueos`, `agenda/bloqueos/[id]` (todas bajo `src/app/api/`). Las
   que sí lo declaran se quedan como están: `google/sync` (30 s) y
   `cron/google-sync` y `cron/recordatorios` (60 s). La comprobación del panel
   va en el paso 6.
5. Después de aplicar de verdad: la línea `-- ESTADO · PRODUCCIÓN` de cada uno de
   los 9 archivos, con fecha y comprobación (`AUDITORIA-MIGRACIONES.md` §7), en
   un commit. Cambia sus huellas: es lo esperado.

---

## 13. Lo que no es de este plan pero bloquea ENCENDER la v2

Aplicar las 9 y desplegar no enciende nada. Para el paso 7 hace falta, además
(detalle en `mejora_agendaV2.md` §7 y §10): el **texto legal** del aviso de la
reserva (`src/lib/reserva/avisoReserva.ts`, PENDIENTE DE REVISIÓN LEGAL; contra
la LFPDPPP vigente de 2025, no de memoria); **Google real** (ida y vuelta, RSVP,
y sólo entonces `AGENDA_RSVP_GOOGLE`); **PostgREST con `imatch`** (búsqueda de
pacientes, sale sin interruptor: humo 5 de la comprobación posterior); y las
decisiones pendientes de Angel de `mejora_agendaV2.md` §7.
