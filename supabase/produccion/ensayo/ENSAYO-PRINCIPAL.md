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

## 5.6 — Rendimiento: NO HECHO

Preparado y probado, pero **sin ninguna cifra**: la corrida de medición se
lanzó y se paró en el primer cambio de base, antes de la primera muestra, porque
el agente tuvo que entregar su informe. No hay tabla, ni comparación con `main`,
ni prueba del fragmento de la consola del plan §15.

Lo que queda listo en `~/spinus-fusion/ensayo-e1/perf/` (fuera del repo):
- `rondas-e1.sh`: el método de `e2e/resultados/linea-base-equipo-nuevo/rondas.sh`
  (`medir-carga.e2e.ts` + `peso-js.cjs` + `guardar.cjs`, 4 rondas, mediana) con
  tres configuraciones, un servidor cada vez en 3001: `main` sobre la base de 5 +
  deriva (bloques A y C), y `main`, rama apagada y rama encendida sobre la de 14,
  intercaladas (bloque B). Termina en la base de 5: al acabar, volver a
  `base.sh 14` y sembrar.
- `base.sh 5|14`, `medicion.config.ts`, `medicion-v2.config.ts` +
  `global-setup-v2.ts` (enciende la v2 en A tras la siembra), `guardar.cjs`
  tolerante a la base de 5 y `mover-cancelar.cjs` (PUT de mover y de cancelar con
  la sesión del navegador; probado: 200/200, 55–68 ms en la rama).
- El build de `main` salió bien (`16-build-main.txt`, 1 min 44 s, 6,3 GB de pico);
  el worktree de `main` se borró al cerrar: hay que recrearlo.

## Estado al cerrar

Base local: 14 migraciones (rehecha con `base.sh 14`: 5 + deriva + las 9 con
`aplicar.sh`), sembrada (365 citas), v2 apagada en A y B. Ningún servidor en
3000–3009. Worktree de `main` borrado (con su `.env.local` y `.next`).
