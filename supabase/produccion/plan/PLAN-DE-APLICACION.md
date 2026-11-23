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

Archivos de esta carpeta:

| Archivo | Para qué |
|---|---|
| `aplicar.sh` | El único comando del día: `estado`, `respaldo`, `aplicar`, `reversa`, `reversa-truncate`. |
| `huellas.sha256` | sha256 de las 9 migraciones y sus 9 reversas, tal como están hoy. `aplicar.sh` se niega a correr un archivo cuya huella no coincida. |
| `rejillas-del-ensayo.txt` | La rejilla final de cada archivo, literal, del ensayo de punta a punta sobre el clon de la foto (§11). |
| `diferencias-antes-despues.clon-foto.tsv` | Las 958 diferencias de estructura antes → después de ese ensayo (claves: estado, tipo, esquema, clave, campo). |
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
  sentencia). C1–C3 dejaron en 3–13 sentencias las ventanas fuertes de F1, F4
  y F5b, **pero no las de F3 y F2**: su ACCESS EXCLUSIVE sobre `appointments`
  dura **90 y 60 sentencias** desde el `ALTER TABLE` hasta el `COMMIT` [C-PL,
  §5]. Por el pooler eso son segundos, no décimas (§5, estimación). Es el
  argumento más fuerte a favor de mandar cada archivo en una sola petición
  (§12, punto 6).

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
- [ ] Nadie más desplegando ni tocando la base.
- [ ] Las variables de Vercel del §6.2 preparadas (generadas en la terminal de
      Angel, sin escribirlas en ningún archivo).

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
`correr-conteos.sh`, el mismo día, después del paso 5 y antes del 6). Qué mirar:

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

- [ ] Las variables nuevas del §6.2 puestas en **Production** (Settings →
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

Pide `PRODUCCION`, la contraseña y, antes de cada archivo, su versión. En el
ensayo [C] cada una tardó 0,24–0,53 s en el clon (en las tres corridas) (incluye arrancar el
contenedor de `psql`); por el pooler, más (§5). Mientras se aplica, el código
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

| # | Ventana | Sentencias (= viajes por el pooler) | Tiempo de servidor medido, 247 citas | ESTIMADO por el pooler (+ N × RTT, ASUMIENDO RTT 50–150 ms) |
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
- **Lo que domina en producción es el número de viajes por el pooler**, no el
  servidor. La columna «ESTIMADO» es sólo la cuenta N × RTT con un RTT
  **supuesto** de 50–150 ms (el mismo que usó C3 en `fusion/notas/f4.md` §9); el
  RTT real de la terminal de Angel a `us-west-2` no se ha medido. `aplicar.sh`
  lo enseña indirectamente: lo que tarda cada archivo menos ~0,1 s, dividido por
  sus sentencias.
- **F3 y F2 son las ventanas largas** (C1–C3 no las acortaron: sus cabeceras lo
  explican, «el ACCESS EXCLUSIVE del ADD COLUMN ya dura hasta el COMMIT»).
  Durante esos segundos, abrir la agenda o guardar una cita **espera** hasta el
  COMMIT. Y puede fallar: en la foto, `authenticated` tiene `statement_timeout`
  de **8 s**, `anon` de **3 s** y `authenticator` `lock_timeout` de **8 s**
  [C, `01-roles.sql` / `05-catalogo.jsonl` de la foto]; una petición que espere
  más que eso acaba en error (ASUMIENDO que PostgREST aplica esos ajustes del
  rol a cada petición, como documenta Supabase; no ensayado). Con un RTT alto,
  la ventana de F3 podría pasar de 8 s: algún error suelto en la app durante esos
  segundos; cada llamada a PostgREST es su propia transacción, pero una ruta
  que haga varias podría quedar a medias como ante cualquier error de red
  (DEDUCIDO).
  Por eso la hora (abajo) y el §12, punto 6.

**Por el pooler** cada sentencia suma la ida y vuelta a `us-west-2`. Por eso
C1–C3 juntaron lo que necesita el candado fuerte en bloques `DO`: lo que alarga
la ventana es el número de viajes, no el trabajo del servidor.

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
| `CRON_SECRET` | cualquier cadena no vacía; la ruta compara la cabecera con `Bearer <CRON_SECRET>` en tiempo constante (`src/lib/cronAutorizacion.ts:20-24`); Vercel manda esa cabecera a las tareas programadas cuando la variable existe (documentación de Vercel Cron Jobs, citada en `mejora_agendaV2.md`; no releída por PL) | **sí** (Sensitive) | `openssl rand -hex 32` (sin espacios ni caracteres raros) | **sí**: sin ella `/api/cron/google-sync` y `/api/cron/recordatorios` responden 401 y no hacen nada | formato comprobado; presencia deducida (falta: es nueva) |
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
   que sí lo declaran: `google/sync` (30 s) y `cron/google-sync` (60 s), sin
   tocar; y `cron/recordatorios`, **subida de 60 a 120 s** en la oleada 3
   (agente PL): queda por debajo de los 10 min tras los que `cita_correo_tomar`
   deja volver a tomar un envío y de la frecuencia de 15 min de `vercel.json`
   (relación de cada límite con su candado: `DEUDA_TECNICA.md` AG-DT-268). La
   comprobación del panel va en el paso 4.
5. Después de aplicar de verdad: la línea `-- ESTADO · PRODUCCIÓN` de cada uno de
   los 9 archivos, con fecha y comprobación (`AUDITORIA-MIGRACIONES.md` §7), en
   un commit. Cambia sus huellas: es lo esperado.
6. **Las ventanas largas de F3 y F2 (§5.1): decisión de Angel / del
   coordinador.** Con `psql -f`, cada sentencia es un viaje por el pooler: 90 y
   60 viajes con ACCESS EXCLUSIVE sobre `appointments` (ESTIMADO 4,5–13,5 s y
   3–9 s con un RTT supuesto de 50–150 ms; el `statement_timeout` de 8 s de
   `authenticated` podría hacer fallar alguna petición en ese rato). Opciones,
   **ninguna probada**: (a) dejarlo así y aplicar sin consulta; (b) medir antes
   el RTT real (p. ej. `\timing` de un `select 1` por el pooler desde la terminal
   de Angel) y decidir con la cifra; (c) mandar cada archivo en UNA petición
   (el SQL Editor ya lo hace; con `psql`, el archivo entero como un solo `-c`),
   lo que exigiría cambiar y volver a ensayar `aplicar.sh`, comprobando que la
   rejilla y los NOTICE se siguen viendo. No se tocó `aplicar.sh`.

---

## 13. Lo que no es de este plan pero bloquea ENCENDER la v2

Aplicar las 9 y desplegar no enciende nada. Para el paso 8 hace falta, además
(detalle en `mejora_agendaV2.md` §7 y §10): el **texto legal** del aviso de la
reserva (`src/lib/reserva/avisoReserva.ts`, PENDIENTE DE REVISIÓN LEGAL; contra
la LFPDPPP vigente de 2025, no de memoria); **Google real** (ida y vuelta, RSVP,
y sólo entonces `AGENDA_RSVP_GOOGLE`); **PostgREST con `imatch`** (búsqueda de
pacientes, sale sin interruptor: humo 5 de la comprobación posterior); y las
decisiones pendientes de Angel de `mejora_agendaV2.md` §7.
