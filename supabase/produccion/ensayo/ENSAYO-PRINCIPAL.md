# Ensayo principal E1 — bloque 5 (5.1, 5.2, 5.3 y 5.6)

> Agente E1, rama `feature/agenda-v2-produccion` (punta de partida `b2993fe1`),
> 2026-11-23. **Nada contra producción.** Base local compartida
> (`supabase_db_app_ortointegra`, 127.0.0.1:54322), único agente corriendo.
> «[C]» = comprobado (cómo, al lado); «[D]» = deducido (no ejecutado).
> Evidencias crudas: `~/spinus-fusion/ensayo-e1/` (fuera del repo). La foto de
> producción se leyó desde `~/spinus-produccion-foto/`; aquí sólo hay nombres de
> objetos, md5 y recuentos.

## 5.1 — La base local como clon de la foto, y las 9 con el guion real

### Base de partida: 5 de `main` + deriva [C]

- **Método:** copia de `supabase/` en `~/spinus-fusion/ensayo-e1/stack/supabase/`
  con SÓLO las 5 primeras migraciones de `supabase/migrations/` y el
  `config.toml` idéntico (mismo `project_id = "app_ortointegra"`, para que la
  CLI apunte a los mismos contenedores). `npx --yes supabase@2.117.0 db reset
  --local --workdir ~/spinus-fusion/ensayo-e1/stack` → 5 versiones en el
  historial (`01-reset-cinco.txt`). El `config.toml` del repo no se tocó.
  Elegido porque no toca ningún archivo del repo y deja la base exactamente
  como la dejaría `main`.
- **Deriva:** `deriva.sql` del agente E2 (`~/spinus-fusion/ensayo-e2-trabajo/`),
  releído antes de usarlo: retira los GRANT que el replay da de más
  (`DERIVA.md` §4: 7 funciones, 4 tablas a `anon`, 1 a `authenticated`) y pone
  `\r\n` en los cuerpos de las 32 funciones (`DERIVA.md` §0). Resultado
  (`02-deriva.txt`): 32 funciones con `\r`; md5 de `clinica_no_suspendida`
  `bff6c203…`, `clinica_tiene_acceso` `038f41ee…`, `prevent_audit_modification`
  `7f0318cb…` = los de producción.
- **Contra la foto** (`comparar-estructura.sh`, `05-catalogo.jsonl` ↔ la base,
  `03-dif-prod-vs-cinco-app.*`): en `public|private|respaldos` **sólo 3
  diferencias de la app**, el deparseo de tres CHECK
  (`consultas_nota_origen_check`, `solicitudes_arco_estado_check`,
  `solicitudes_arco_tipo_check`; ya explicado en `DERIVA.md` §4). Las otras 13
  filas del resumen de esos esquemas son de plataforma: `pg_cron` (extensión,
  comentario, `cron`), la publicación `supabase_realtime_messages_publication`,
  roles de la CLI (`cli_login_postgres`, `supabase_functions_admin`, miembros de
  `postgres` y `supabase_realtime_admin`), configuración de roles
  (`session_preload_libraries`, `search_path`, `app.settings.jwt_secret`) y
  `issue_pg_graphql_access`. Sin filtrar esquemas: 547 diferencias, todas en
  `storage`, `realtime`, `auth`, `_realtime`, `supabase_functions`,
  `extensions`, `cron`, `pgbouncer` (versión de la plataforma) más las 16 de
  arriba.
- **Datos antes de aplicar:** se sembró la base de 5 (`05-semilla-cinco.txt`)
  para que el backfill de F1 tenga consultorios: 365 citas, 4 consultorios, 2
  clínicas, 39 filas de `audit_log`, 4 perfiles.

### Conteos, estado y las 9 [C]

| Paso | Resultado | Evidencia |
|---|---|---|
| `conteos/correr-conteos.sh` (`CONTEOS_HOST=127.0.0.1 …`, contraseña local por stdin) | **0 ALTO, 0 AVISO: 73 OK, 5 INFO** (lo mismo que el clon de la foto); las INFO: G.13 tamaños, M2.8 (29), F1.11, T.1, T.2 | `04-conteos/` |
| `aplicar.sh estado` (`APL_HOST=127.0.0.1 APL_PUERTO=54322 APL_USUARIO=postgres APL_SSL=disable APL_RED=host`, `PGPASSWORD` local) | «Destino: ENSAYO»; humo: petición de 104 104 bytes en UNA petición, sólo lectura, aceptada (0,34 s); historial 5; las 9 `pendiente`; salida 0 | `06-aplicar/estado-antes.txt` |
| `aplicar.sh aplicar` (las 9 versiones por stdin) | **las 9 `✓ aplicada y registrada`**, 0,28–0,41 s cada una (contenedor incluido); «Las 9 aplicadas y registradas (historial y catálogo coinciden)»; salida 0 | `06-aplicar/aplicar.txt` y `*.salida.txt` |
| Rejillas | 63 OK + 10 INFO, **0 REVISAR**; mismas filas y veredictos, una a una, que `rejillas-del-ensayo.txt` (`diff` vacío sobre «nº + veredicto») | idem |
| `aplicar.sh estado` después | historial con las **14** versiones en el orden de `COMPROBACION-POSTERIOR.md` §4; las 9 «aplicada y registrada» | `06-aplicar/estado-despues.txt` |

Huellas: `sha256sum aplicar.sh` = `67ec5d14…` (la del plan §2) y
`sha256sum -c huellas.sha256` todo OK [C].

### Comprobación posterior [C]

- **Antes ↔ después** (`comparar-estructura.sh` entre la base de 5 + deriva y la
  de 14): 2559 → 3440 objetos, **965 diferencias, con las MISMAS claves**
  (cut -f1-5) que `plan/diferencias-antes-despues.clon-foto.tsv`: `diff` vacío
  (`07-*`). Es decir, sobre una base con datos el conjunto cambia exactamente
  lo mismo que sobre el clon vacío de la foto.
- **`catalogo-despues.sql`** (`08-catalogo-despues.txt`): todas las filas con el
  valor de la tabla de `COMPROBACION-POSTERIOR.md` §5: 14 / 9 / 15 / true / 0 /
  0 / 22 / 1 / 12 de 12 / 45 / 0 / 112 / 0 / 0 / 0 / `0 / 0` / 0 / **4 / 4**
  (datos) / 0 / `a2dcfa8f…` / `2efd7734…`.
- `audit_log`: 39 → 43 (+4, una por consultorio del backfill de F1), como dice
  §4 de la comprobación.
- Nota de montaje: la CLI deja `supabase/.temp/` en el repo al hacer `repair`
  (está en `.gitignore`).

## 5.2 — Sembrar [C]

`npx tsx scripts/agenda-semilla.ts` (el de siempre, contra el contenedor
compartido) sobre la base de 14 (`09-semilla-catorce.txt`): **365 citas** (A:
scheduled 112, confirmed 71, cancelled 41, no_show 21, attended 103 = 348; B: 17),
29 pacientes, 4 consultorios, 2 clínicas, 4 perfiles; la v2 apagada en las dos.
`audit_log` pasa a 1090 filas (con F1 aplicada, `log_cita_change` audita las
altas de la semilla; antes de las 9, sembrar dejaba 39).

**Volumen.** No añadí citas: la Clínica Semilla A ya tiene 348 citas, más que
TODA producción junta (247 en 17 clínicas), así que supera a cualquier clínica
real; lo que la agenda lee está acotado a una clínica y a un rango de semanas.
Lo que NO reproduje [D, no medido]: las 17 clínicas, 18 consultorios, 20 perfiles
y ~9 700 filas de `audit_log` de producción repartidas en otras clínicas. Las
consultas de la agenda filtran por `clinica_id` y rango con índice, así que no
espero que cambie las cifras; `audit_log` no lo lee ninguna pantalla medida. Las
mediciones de 5.6 y la batería resiembran al empezar (su `globalSetup`): todas
corren sobre estos mismos datos, recalculados desde hoy.

## 5.3 — Todo, una vez y de una en una

### (a) Vitest ×3 [C]

`npx vitest run --exclude ".claude/**"`, uno tras otro (`10-vitest/`):

| Zona | Resultado |
|---|---|
| sin `TZ` | **2387 de 2387** |
| `TZ=UTC` | **2387 de 2387** |
| `TZ=America/Hermosillo` | **2387 de 2387** |

**Por qué el `--exclude`:** dentro del repo hay 28 worktrees de agentes anteriores
en `.claude/worktrees/` (4,4 GB; `.claude/` está en `.gitignore`), y
`vitest.config.ts` no los excluye: el primer intento recogía también las pruebas
de esas 28 ramas (con fallos propios, p. ej. `agent-affc…/correoConfirmacionRuta`)
y se paró a los 5 min (`10-vitest-descartado-worktrees/`). Todas las pruebas de
la rama están en `src/` (163 archivos). No toqué esos worktrees: no son míos.
Lo mismo afecta a `npm run lint` y a la comprobación de tipos del build (abajo).

### (b) Pruebas SQL [C]

Cada archivo de `supabase/pruebas-sql/` con el mismo comando que
`scripts/pruebas-sql.sh` (psql como `postgres`, `ON_ERROR_STOP`, cada uno en su
transacción con `rollback`), pero sin parar en el primero que falle:
**48 de 48 en verde** (`11-sql/`). El encargo decía 49: en la rama hay 48
archivos (`git ls-files`).

### (c) Carreras [C]

`12-carreras/`: `scripts/reserva-carrera.sh` en verde (escenarios 1–6b; 5 citas
esperadas, 5) y `scripts/confirmacion-carrera.sh` en verde (1–3). Son los dos
guiones de concurrencia del repo.

### (d) Build y lint [C]

- **`npm run build`** (una vez, `next build --webpack`): **sale 0**; compila en
  22 s, TypeScript 28,6 s, 98 páginas (`13-build-rama.txt`).
- **Lint.** `npm run lint` es `eslint` a secas, y `eslint.config.mjs` no ignora
  `.claude/`: tal cual recorrería los 28 worktrees ajenos. Lo corrí como
  `npx eslint --ignore-pattern '.claude/**'` en la rama y `npx eslint` en el
  worktree de `main` (`95cb5781`, `node_modules` enlazado; no hizo falta
  instalar nada):

  | | errores | avisos |
  |---|---|---|
  | `main` | 96 | 67 |
  | rama | 101 | 68 |

  Comparando (archivo, regla) de cada error (`14-lint-*.err`): **los 96 de
  `main` siguen en la rama y no hay ninguno nuevo en código versionado.** Las 5
  diferencias: 5 errores que en `main` están en `src/app/(app)/agenda/page.tsx`
  aparecen en `src/components/agenda/AppointmentModal.tsx` (el mismo código,
  movido por el refactor A2.3, `d145b774`), y 5 `no-require-imports` en
  `e2e/resultados/linea-base-equipo-nuevo/*.cjs`, que están en `.gitignore` (no
  son de la rama: los dejó una medición anterior en disco).

### (e) Batería completa de Playwright, una vez [C]

Servidor: `next start -p 3001` sobre el build de (d) (`.env.local` del repo, que
ya trae `EMAIL_TRANSPORT`, `RESERVA_AVISO_BORRADOR_LOCAL`, `CRON_SECRET`…), y
`~/.local/state/spinus-e2e/bateria/correr.sh` desligado. **Corrió el lunes
2026-11-23 de 00:35 a 01:00 (hora de Mérida)**; ese dato explica casi todo lo
que sigue.

**Resultado: 617 pasan, 5 fallan, 13 no corrieron (por las serie tras un
fallo), 491 se saltan** (617 + 5 + 13 = 635 = las 634 + 1 de la última batería
de la guía). Y **la guarda de asistencia pone la corrida en rojo con 51 citas**.
Evidencias (copiadas ANTES de correr nada más): `~/spinus-fusion/ensayo-e1/bateria-20261123/`
(`test-results/` con trazas y capturas, `e2e.log`, `salida.txt`,
`srv-3001-bateria.log`, `test-results/next-dev-3002.log`). No hubo informe HTML
(el config sólo usa `list` y la guarda).

| Falla | Diagnóstico | De qué es | Certeza | Suelta (`--workers=1`) |
|---|---|---|---|---|
| `agenda-empalme` «redimensionar hasta otra cita también avisa» | la conocida AG-DT-257 | prueba | — (conocida) | no se repitió |
| `agenda-g4-herencia-horario` «la migración de herencia copia una vez…» | la prueba recorta F1 desde `CREATE TABLE … respaldos.consultorios_horario_20261119` hasta `-- 9 · ` y lo ejecuta; en la F1 FUNDIDA ese tramo contiene además `CREATE FUNCTION public.agenda_restablecer_configuracion` (línea 621), que ya existe en una base con F1 → `ERROR: function "agenda_restablecer_configuracion" already exists`. Fallará en cualquier base con las 14 | **prueba** (desfasada respecto de la F1 fundida; la migración está bien: se aplicó y su rejilla salió OK) | alta (error literal y posiciones en el archivo) | **falla 3 de 3**, mismo error |
| `reserva-enlace` «flujo completo con el enlace fijo…» | espera 1 fila en el turno reservado y hay 2: una **cancelada** que la SEMILLA pone (hoy) el lunes de la semana siguiente a las 08:00 en el consultorio Centro, y la reserva nueva. La página ofrece ese turno porque una cancelada no ocupa (correcto); `citasEnTurno` cuenta todas las filas | **prueba** (depende del día en que se siembra) | alta (audit_log de la reintento: alta+cancelación del admin en la siembra, 5 s antes de la reserva; la semilla de hoy tiene `Mon 30 08:00 cancelled`) | **falla 3 de 3**, mismo error |
| `reserva-google` «4 · un evento de Google que se empalma…» | `0|0` en vez de `1|1` tras el sondeo (`cambios: 0`). La propia prueba documenta que «falló una vez en la batería con 0 y sola pasa siempre»: otra pasada de sincronización viva importa el evento antes | prueba (carrera con la pasada de fondo) | media (no vi el registro del `next dev` de ESA prueba: `next-dev-3002.log` lo pisa el siguiente archivo de Google) | **pasa 3 de 3** |
| `agenda-f-pulido` [teléfono] «F1.12 · el domingo, sin citas de hoy en adelante…» | fija el reloj en el domingo de la semana anterior (22-nov) y espera que no tenga citas; `confirmacion-enlace.e2e.ts:235` (que corre antes) dejó una cita a «ahora − 2 h» = **domingo 22-nov 22:53** (corría el lunes 00:53) | prueba (hora de la corrida + resto de otra prueba) | alta (la guarda nombra esa cita y esa prueba) | **pasa 3 de 3** |

**La guarda** (`e2e/guardaAsistencia.ts`) terminó en **rojo: «51 cita(s)
dispararían «¿Asistió el paciente?» al final de la semana»**: 32 del lunes 23,
16 del martes 24, 2 del jueves 26 y 1 del domingo 22, escritas por
`agenda-h4-por-confirmar` (5 + 4 entre pruebas), `reserva-k2-codigo` (9),
`confirmacion-enlace` (5), `recordatorios` (4), `agenda-k5-marcas` (3),
`agenda-i5-barra-avisos`, `agenda-j3-ligar-ventana`, `agenda-l5-campana`,
`husos-dos-consultorios`, `reserva-h1`, `reserva-i2` (2 cada una),
`agenda-i3-por-asignar`, `reserva-m4-salir`, `whatsapp-manual` (1 cada una)
y otras 5 «entre pruebas». **Diagnóstico [C por la lista, D en la causa
general]:** son pruebas que crean citas «para mañana» o «dentro de N horas»
(por confirmar, recordatorios, códigos, confirmación). Corriendo de sábado a
domingo, «mañana» cae en la semana siguiente y la guarda no las cuenta (así se
obtuvo el verde de la guía, «en fin de semana»); corriendo un **lunes**, caen
en la semana actual y la guarda, que mira el peor momento (fin del domingo),
las señala. Es la guarda haciendo su trabajo: **AG-DT-256 no está cerrada para
una corrida de lunes a viernes.** Ninguna de esas citas tumbó una prueba en
esta corrida (hoy no tienen 48 h), salvo la cadena de F1.12 de arriba. En las 12
corridas sueltas la guarda dijo «ninguna prueba dejó citas…».

Reintentos guardados en `bateria-20261123/reintentos/<archivo>-<n>/` (salida y
`test-results`).

### (f) `E2E_SIN_SEMILLA` [C]

- **Esta rama no la conoce**: `git grep E2E_SIN_SEMILLA` vacío. Existe en
  `2e2c4373` (sólo en `origin/feature/rediseno-estetico`): con `=1` el
  `globalSetup` sólo comprueba el build y abre sesiones, sin apagar la v2 ni
  resembrar.
- **Comprobado el comportamiento de la guarda en ese modo:** config aparte
  (`~/spinus-fusion/ensayo-e1/perf/sin-semilla.config.ts`: el de siempre sin
  `globalSetup`, con el mismo reporter), y ANTES de empezar, como `postgres`,
  una cita con paciente agendada hace 5 días y sin nota (Clínica Semilla A). Un
  archivo corto: `agenda-m3-barra.e2e.ts` (enciende la v2). Resultado
  (`15-sin-semilla.txt`, `15-test-results/`): la primera prueba **falla** por
  timeout porque la ventana «¿Asistió el paciente?» tapa la rejilla (captura:
  «Paciente Prueba 03 · Mié 18 nov · 10:30»), y **la guarda dice «ninguna
  prueba dejó citas que dependan del día de la corrida»**. Sin la cita (corrida
  anterior, misma config) pasan las 10.
- **Respuesta: NO** — en ese modo la guarda funciona en el sentido estricto
  (sólo acusa lo que escriben las pruebas), pero **es ciega a lo que ya trae la
  base**: toma su línea base en `onBegin`, después del `globalSetup`, así que
  cualquier cita vieja ya presente (de otra sesión, o de una semilla de otro
  día que quedó sin resembrar) entra como «conocida» y no se señala, aunque tape
  la rejilla y tumbe pruebas. Para que sirva sin resembrar haría falta, p. ej.,
  que la guarda avise en `onBegin` si la línea base ya trae citas que la ventana
  pregunta HOY (no las del peor domingo). No lo toqué (no es de este encargo).
  La cita de la prueba se borró al terminar y la v2 quedó apagada en A y B.

## 5.6 — Rendimiento [C]

### Lo que sale PEOR que `main` (mediana de 20 muestras; «ruido» = las medianas por ronda se solapan)

Contra `main` sobre la base de hoy (5 + deriva):

| Métrica | `main` | rama apagada | rama encendida | ¿Ruido? |
|---|---|---|---|---|
| JS al primer evento | 472 KiB, 25 chunks | **547 KiB (+16 %), 34 chunks** | **528 KiB (+12 %), 30 chunks** | no: es fijo |
| JS en reposo | 472 KiB | **547 KiB (+16 %)** | **587 KiB (+25 %)** (campana y engrane, J1) | no: es fijo |
| Guardar: clic → modal cerrado | 42 ms | 14 ms | **184 ms** | no (es la salida animada del modal, sólo con la v2, CLAUDE.md tanda K: la tarjeta ya está pintada a los 72 ms, igual que en `main`) |
| Cancelar: PUT | 49 ms | **58 ms (+18 %)** | 50 ms | apagada NO se solapa (medianas por ronda 48–50 frente a 51–68); +9 ms de servidor |
| Guardar: POST | 70 ms | 80 ms (+14 %) | 82 ms (+16 %) | sí, cabe en el ruido |
| Mover: PUT | 61 ms | 66 ms (+8 %) | 66 ms (+7 %) | sí |
| Guardar: clic → tarjeta pintada | 73 ms | 75 ms | 72 ms | sí |

Nada de lo que el usuario espera al ABRIR o NAVEGAR la agenda sale peor: la rama
abre y navega más rápido en las dos posiciones del interruptor (tabla de abajo).
El peso de JS es mayor y la rama lo compensa (abre 50–60 ms antes en frío y
~150 ms antes con red limitada). Los PUT/POST son 5–10 ms más lentos en mediana
(la rama hace más comprobaciones en el servidor: empalmes, bloqueos, nota
ligada); sólo «cancelar» con la v2 apagada sale fuera del ruido.

### Montaje

- **Método:** el de la tanda del equipo nuevo
  (`e2e/resultados/linea-base-equipo-nuevo/rondas.sh`): `e2e/medir-carga.e2e.ts`
  (5 repeticiones de cada medida, contexto nuevo = caché vacía), `peso-js.cjs` y
  `guardar.cjs` (5 cada uno), más `mover-cancelar.cjs` (nuevo: el MISMO PUT que
  mandan el arrastre —`start_time`/`end_time`— y «Cancelar» —`status`— en las
  dos versiones, desde el navegador con la sesión; 5). **4 rondas → 20 muestras
  por celda**; en cada celda: mediana [mín–máx] y el rango de las 4 medianas por
  ronda. Admin A, Chromium de Playwright, 1440×900, `es-MX`, `America/Merida`.
  Red limitada: 60 ms de latencia y 10 Mbps por CDP (el perfil del método).
- **Cambio en el método** (copia fuera del repo, `perf/e2e-copia/`): en `main` la
  medida «salto tras precarga» lanza (no tiene la precarga en ocioso, A1.5b) y
  tiraba la medición entera; la copia la anota «no aplica». Nada más cambia.
  `guardar.cjs` mira `agenda_bloqueos` sólo si existe.
- **Código y base de cada configuración**, un servidor `next start` cada vez en
  3001 (nunca dos), cada uno con su build (`main` en un worktree fuera del repo,
  `95cb5781`; la rama en `b2993fe1`+docs):
  - `main` · base 5 (5 de `main` + deriva): rondas 1–2 al principio y 3–4 al
    final (bloques A y C, `base.sh 5`).
  - `main` · base 14, rama apagada · base 14, rama encendida · base 14:
    intercaladas en cada ronda, con el orden rotado (bloque B, `base.sh 14`).
- **Datos:** cada medición resiembra (su `globalSetup`): **348 citas en la
  Clínica A en las dos bases** (comprobado en cada medición:
  `crudos/v2-*.txt`), la misma semilla calculada desde hoy. La v2: `true` en las
  4 de «encendida», sin fila en las demás.
- **«En frío»:** servidor recién arrancado antes de cada configuración y
  calentado igual (`/login` hasta 200, más el `globalSetup`, que abre sesión con
  los 4 usuarios), caché del navegador vacía en cada muestra.
- **Limitaciones:** el servidor y Supabase están en la misma máquina (sin la
  latencia servidor↔base de producción); la red limitada sólo frena
  navegador↔servidor. «Guardar» mide un evento sin paciente por el formulario;
  «mover» y «cancelar» miden la petición, no el gesto (la tarjeta se pinta de
  forma optimista en las dos versiones). Las validaciones contra Auth se
  cuentan en el registro del contenedor de Auth durante la apertura.

### La tabla

| Métrica | main · base 5 | main · base 14 | rama v2 apagada · base 14 | rama v2 encendida · base 14 |
|---|---|---|---|---|
| Abrir la agenda en frío (ms al 1er evento) | 452 [434–585] r:446–457 n=20 | 450 [437–493] r:442–457 n=20 | 391 [378–429] r:386–398 n=20 | 400 [391–415] r:398–409 n=20 |
| Abrir con red limitada 60 ms/10 Mbps (ms) | 999 [992–1499] r:998–1002 n=20 | 1506 [1000–1518] r:1505–1510 n=20 | 844 [837–854] r:841–846 n=20 | 852 [842–857] r:850–853 n=20 |
| Semana siguiente (ms) | 150 [131–165] r:144–152 n=20 | 148 [131–161] r:142–157 n=20 | 91 [75–103] r:86–94 n=20 | 91 [80–99] r:89–92 n=20 |
| Semana anterior (ms) | 150 [133–164] r:142–153 n=20 | 140 [131–160] r:135–150 n=20 | 86 [76–104] r:82–92 n=20 | 88 [77–93] r:87–90 n=20 |
| Volver del dashboard (ms) | 224 [220–242] r:223–234 n=20 | 225 [221–238] r:224–225 n=20 | 114 [93–134] r:104–117 n=20 | 121 [93–131] r:121–123 n=20 |
| Volver a una semana ya vista (ms) | 134 [129–153] r:132–136 n=20 | 132 [128–148] r:131–134 n=20 | 77 [64–82] r:67–79 n=20 | 74 [63–86] r:65–81 n=20 |
| Salto tras precarga W+1→W+2 (ms) | no aplica | no aplica | 78 [68–81] r:75–79 n=20 | 80 [68–93] r:77–85 n=20 |
| Bloqueantes al volver del dashboard | 1 [1–1] r:1–1 n=20 | 1 [1–1] r:1–1 n=20 | 0 [0–0] r:0–0 n=20 | 0 [0–0] r:0–0 n=20 |
| Bloqueantes en semana ya vista | 1 [1–1] r:1–1 n=20 | 1 [1–1] r:1–1 n=20 | 0 [0–0] r:0–0 n=20 | 0 [0–0] r:0–0 n=20 |
| Bloqueantes tras precarga | no aplica | no aplica | 0 [0–0] r:0–0 n=20 | 0 [0–0] r:0–0 n=20 |
| Validaciones Auth GET /user, servidor (al abrir) | 4 [4–4] r:4–4 n=20 | 4 [4–4] r:4–4 n=20 | 2 [2–2] r:2–2 n=20 | 4 [4–4] r:4–4 n=20 |
| Validaciones Auth GET /user, total (al abrir) | 5 [5–5] r:5–5 n=20 | 5 [5–5] r:5–5 n=20 | 2 [2–2] r:2–2 n=20 | 4 [4–4] r:4–4 n=20 |
| JS al primer evento (KiB) | 472 [472–472] r:472–472 n=20 | 472 [472–472] r:472–472 n=20 | 547 [511–547] r:547–547 n=20 | 528 [528–536] r:528–528 n=20 |
| JS al primer evento (chunks) | 25 [25–25] r:25–25 n=20 | 25 [25–25] r:25–25 n=20 | 34 [27–34] r:34–34 n=20 | 30 [30–33] r:30–30 n=20 |
| JS en reposo (KiB) | 472 [472–472] r:472–472 n=20 | 472 [472–472] r:472–472 n=20 | 547 [547–547] r:547–547 n=20 | 587 [587–587] r:587–587 n=20 |
| Guardar: clic → tarjeta pintada (ms) | 73 [45–79] r:70–76 n=20 | 72 [70–119] r:71–75 n=20 | 75 [42–84] r:74–76 n=20 | 72 [70–112] r:72–73 n=20 |
| Guardar: clic → modal cerrado (ms) | 42 [40–46] r:41–42 n=20 | 42 [38–46] r:40–43 n=20 | 14 [12–20] r:14–14 n=20 | 184 [184–184] r:184–184 n=20 |
| Guardar: POST /api/appointments (ms) | 70 [62–83] r:65–77 n=20 | 65 [57–163] r:59–76 n=20 | 80 [59–93] r:63–86 n=20 | 82 [59–112] r:76–85 n=20 |
| Mover: PUT (ms) | 61 [51–74] r:59–68 n=20 | 58 [52–158] r:54–67 n=20 | 66 [50–73] r:62–71 n=20 | 66 [58–166] r:65–76 n=20 |
| Cancelar: PUT (ms) | 49 [47–66] r:48–50 n=20 | 50 [46–66] r:49–54 n=20 | 58 [48–71] r:51–68 n=20 | 50 [46–75] r:48–56 n=20 |

Notas de lectura:
- **Abrir con red limitada, `main` sobre la base 14: 1506 ms, frente a 999 ms
  sobre la base 5.** No es ruido (las 4 rondas 1505–1510; en la base 5, 19 de 20
  muestras ~1000 y una de 1499). El salto es de ~500 ms exactos, lo que apunta a
  una espera fija en el cliente de `main` que la base nueva dispara siempre; no
  lo investigué [D]. Importa para la ventana «base nueva + código viejo»; con el
  orden decidido (código primero) esa combinación no se da.
- Con la v2 encendida, abrir cuesta +9 ms en frío y +8 ms con red limitada
  respecto de apagada, y 2 validaciones más contra Auth (4 frente a 2, las
  mismas que `main`).
- Peticiones bloqueantes: `main` 1 al volver del dashboard y 1 al volver a una
  semana vista; la rama 0 y 0, y 0 tras la precarga.
- Comparadas con la línea base del equipo nuevo de la guía (apertura 406/406,
  red limitada 850/855, semana siguiente 88/93, volver 117/123, Auth 2/4, JS
  547/587 KiB): la rama da lo mismo.

Evidencias: `~/spinus-fusion/ensayo-e1/perf/` (`rondas-e1.sh`, `rondas.log`,
`crudos/`, `tabla.md`, `analizar-e1.py`, `bases.log`).

### El fragmento de la consola del plan §15 [C]

Probado en Chromium de Playwright sobre `/agenda` con sesión (la rama, base 14),
caché desactivada, evaluando el texto TAL CUAL (`perf/fragmento.cjs`,
`frag-*.json`; 3 aperturas por caso). **Funciona**: la promesa se resuelve y
`console.table` saca las 7 cifras. Con sentido y coherentes con la medición:

| | primer byte | DOMContentLoaded | load | LCP | recursos | /api+/rest | fin de la última | (mi medida: 1er evento) |
|---|---|---|---|---|---|---|---|---|
| apagada | 67–75 | 93–113 | 144–154 | **336–340** | 46 | 2 | 215–225 | 308–327 |
| apagada, red limitada | 49–51 | 302–307 | 640–642 | **828–832** | 46 | 2 | 722–734 | 792–825 |
| encendida | 54–58 | 77–91 | 129–136 | **328–360** | 53 | 4 | **373–404** | 303–324 |
| encendida, red limitada | 52–58 | 304–308 | 640–643 | **828–844** | 53 | 4 | **921–935** | 798–804 |

Dónde engaña, y que lo decida Angel (no cambié su regla):
1. **«load» (la «Carga» de la pestaña Red, la cifra que DECIDE en el plan)
   llega ANTES de que se pinte la agenda**: 144 ms frente a 313 ms del primer
   evento (640 frente a 800 con red limitada). Mide la página, no la agenda. El
   **LCP** sí coincide con la aparición de las citas (+20–30 ms). Propuesta:
   decidir por la mediana del LCP.
2. **«fin de la última de /api y /rest» sube con la v2 sin que la agenda tarde
   más**: con la v2 entran `GET /api/agenda/por-confirmar` y `POST
   /api/google/sync` DESPUÉS del pintado (inicio ~330 ms, con las citas ya en
   pantalla), así que esa cifra pasa de ~220 a ~390 ms. No es «la agenda terminó
   de cargar sus datos» con la v2.
3. Las cifras dependen de cuándo se pega: «recursos» y «fin de la última»
   cuentan todo lo que haya pasado hasta ese momento.
4. Con la red limitada por CDP, el «primer byte» no sube (49–58 ms): la
   emulación de Chromium no frena esa fase. En una red real sí subiría [D].

En el plan, la nota «pendiente de probar» se sustituye por este resultado.

## Batería tras corregir las pruebas [C]

**Lunes 2026-11-23, de 03:11:12 a 03:36:43 (hora de Mérida)**, sobre `7af5775e`
(árbol limpio), mismo procedimiento que (e): `next start -p 3001` sobre el build
de (d) (no se tocó `src/`), `npx playwright test` una vez, sin editar nada
mientras corría. Evidencias: `~/spinus-fusion/ensayo-e1/bateria-20261123-b/`
(`e2e.log` completo, `salida.txt`, `resumen.txt`, `guarda.txt`, `test-results/`,
`srv-3001-bateria.log`, `commit.txt`).

**Resultado: 635 pasan, 0 fallan, 0 no corrieron, 491 se saltan; salida 0.**
**La guarda: «ninguna prueba dejó citas que dependan del día de la corrida».**
La conocida AG-DT-257 (`agenda-empalme` «redimensionar…») pasó esta vez; no se
tocó y sigue abierta (ya pasaba de vez en cuando en batería). La rama del lunes
de `agenda-t1-burbuja` punto 4 (AG-DT-259) corrió y pasó.

Antes de la batería: los 15 archivos de la lista de (e), juntos y sin tocar,
reprodujeron las 51 citas (119 verdes); cada archivo tocado, solo, 3 veces en
verde y con la guarda en verde, salvo `husos-dos-consultorios`, 1 de 6 en rojo
(un 429 al reservar en su prueba 2, sin causa encontrada: ninguna llave de IP
al tope, dispositivo nuevo en cada petición; el limitador falla cerrado si la
RPC falla y el registro de `next start` no lo muestra). Vitest 2387/2387; `tsc`
y `eslint` limpios en los archivos tocados.

**Pruebas tocadas (sólo `e2e/`):**

| Archivo | Qué |
|---|---|
| `agenda-g4-herencia-horario` | el recorte de la F1 fundida: tabla de §7 + INSERT/UPDATE del backfill de §10 (ya no arrastra `CREATE FUNCTION agenda_restablecer_configuracion`) |
| `reserva-enlace` | cuenta sólo lo activo del turno y exige que sea su reserva (la cancelada de la semilla no ocupa) |
| `reserva-google` (4) | espera a que ninguna pasada tenga el candado y a que la reserva ligue su evento antes de crear el que se empalma (la carrera es deducida, no reproducida) |
| `agenda-f-pulido` F1.12 | el domingo de la semana −2 (el de la −1 es «ayer» un lunes) |
| `reserva-g1-diseno`, `reserva-h1`, `reserva-i2`, `reserva-k2-codigo`, `reserva-m4-salir`, `reservaPublicaAyudas.ts` | reservan el primer turno de la «Semana siguiente» (`primerTurnoDeLaSemanaSiguiente`) |
| `agenda-h4-por-confirmar`, `whatsapp-manual`, `agenda-l5-campana`, `agenda-i5-barra-avisos`, `recordatorios`, `husos-dos-consultorios`, `confirmacion-enlace`, `agenda-k5-marcas`, `agenda-j3-ligar-ventana`, `agenda-i3-por-asignar` | lo que por su naturaleza es de mañana o de dentro de horas se crea y se borra dentro de la prueba (`afterEach`), con la anotación `asistencia-a-proposito`; lo que no lo necesitaba, a la semana siguiente |

## Batería del agente R sobre `d7486b0c` [C]

**Lunes 2026-11-23, de 09:56:44 a 09:57:07 (hora de Mérida)**, sobre `d7486b0c`
(árbol limpio; arreglo de AG-DT-276), `npm run build` de ese commit, `next start
-p 3001` y `npx playwright test` una vez. Evidencias:
`~/spinus-fusion/ensayo-r/bateria/` (`e2e.log`, `salida.txt`, `commit.txt`,
`srv-3001.log`).

**Resultado: no corrió ninguna prueba (salida 1).** El `globalSetup` abortó al
sembrar: «Hay 1 fila(s) en documentos sobre pacientes sembrados. No se borra
expediente clínico: retíralo a mano o recrea la base local.» La fila es una
solicitud de laboratorio creada a las 09:51 desde el `next start` de :3000
(Angel probando a mano: en `audit_log`, ver expediente, emitir, enviar, y la
configuración de la agenda de la clínica Semilla A). No se borró ni se recreó
la base. Antes de abortar, el `globalSetup` apagó la v2 de la Semilla A
(09:56:45), que estaba encendida; se volvió a encender a mano con `postgres`
(sólo esa fila, la que había cambiado). **Hay que repetir la batería entera**
cuando la base quede libre.

## Estado al cerrar [C]

Base local: 14 migraciones (`base.sh 14`: 5 + deriva + las 9 con `aplicar.sh`),
sembrada (365 citas), v2 APAGADA en A y B. Ningún servidor en 3000–3009.
Worktree de `main` borrado (con su `.env.local` y su `.next`).
