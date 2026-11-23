# Ensayo E2 — orden de despliegue y reversa (5.4 y 5.5)

> Agente E2, rama `feature/agenda-v2-produccion-e2`, 2026-11-22. **Nada contra
> producción.** Todo en un stack local aparte; datos sólo de la semilla.
> «[C]» = comprobado (cómo, al lado); «[D]» = deducido (no ejecutado).
> Evidencias crudas (registros, salidas, capturas): `~/spinus-fusion/ensayo-e2/`
> (fuera del repo). Lo de `antes-del-reinicio*/` NO cuenta como resultado: son
> corridas cortadas por los reinicios del equipo y se repitieron enteras.

## 0. Montaje

| Qué | Cómo |
|---|---|
| Código «nuevo» | rama en `5f4b2112` (punta de `feature/agenda-v2-produccion` fusionada), `next build --webpack` + `next start` en 127.0.0.1:3102 |
| Código «viejo» | worktree de `main` en `95cb5781`, mismo procedimiento en 127.0.0.1:3103 |
| Un servidor a la vez | nunca estuvieron vivos los dos; cada uno se mató por el pid de su puerto |
| Stack aparte | copia de `supabase/` en `~/spinus-fusion/ensayo-e2-trabajo/stack/`, `project_id = "spinus_e2"`, puertos 55320-55329 y 58083; el `config.toml` del repo no se tocó. CLI 2.117.0, `start -x studio,imgproxy,edge-runtime,logflare,vector,postgres-meta,realtime,supavisor` (quedan db, auth, rest, kong, storage, mailpit) |
| Por qué sin Realtime | el ensayo va por HTTP; en el navegador sólo produce errores de WebSocket en la consola, iguales en las dos direcciones (ruido del montaje, no de la app) |
| `.env.local` | claves locales de demostración de la CLI, secretos aleatorios (`RESERVA_SECRETO`, `CRON_SECRET`, `GOOGLE_TOKEN_SECRET`), `EMAIL_TRANSPORT=captura` contra el Mailpit del stack, y claves FICTICIAS de Resend/Stripe/hook (sin ellas `next build` falla al recoger `/api/auth/email-hook`: «Missing API key»). En 5.5, además, `RESERVA_AVISO_BORRADOR_LOCAL=1` (la excepción local del aviso pendiente de revisión legal) |
| Base «vieja» | `start` con SÓLO las 5 de `main` + la deriva conocida de producción aplicada a mano (`DERIVA.md`): los GRANT de más retirados (7 funciones, 4 tablas a `anon`, 1 a `authenticated`) y los cuerpos de las 32 funciones con `\r\n`. Resultado [C]: md5 de `clinica_no_suspendida` `bff6c203…`, `clinica_tiene_acceso` `038f41ee…`, `prevent_audit_modification` `7f0318cb…` = los de producción; `comparar-estructura.sh` contra `05-catalogo.jsonl` de la foto, esquemas `public|private|respaldos`: **sólo 3 diferencias**, el deparseo de tres CHECK (ya explicado en `DERIVA.md` §4). Lo demás que difiere es plataforma (pg_cron, roles de la CLI) |
| Semilla | copia de `scripts/agenda-semilla.ts` FUERA del repo con el contenedor cambiado a `supabase_db_spinus_e2` (el original tiene fijo el contenedor compartido; usarlo tal cual habría escrito en la base de otros agentes) |
| Gestos | arnés propio por HTTP con sesión real (`@supabase/ssr`, cookies como el navegador): `~/spinus-fusion/ensayo-e2-trabajo/h/scripts/arnes.ts`; y Chromium sin cabeza para `/inicio` y `/agenda` (`navegador.ts`). Playwright del repo NO se usó: `e2e/ayudas.ts`, `global-setup.ts` y `guardaAsistencia.ts` tienen fijo el contenedor compartido y habrían tocado su base |

Gestos del arnés, para admin (médico administrador), secretaria e invitado de
la clínica Semilla A: abrir `/inicio`, `/agenda`, el expediente de un paciente;
`GET /api/appointments`; cita CON paciente y SIN paciente: alta, editar notas,
mover 1 h, confirmar, cancelar, borrar (y comprobar que la fila desapareció);
alta de paciente; y, como admin, una cita con nota clínica ligada
(`POST /api/consultas` con `appointment_id`) seguida de editar notas, moverla,
cancelarla, volverla a agendada y borrarla.

## 5.4 (b) Base VIEJA (5 de main + deriva) + código NUEVO (rama) [C]

Evidencia: `05b-arnes.txt`, `arnes-b-rama-base-vieja.json`, `05b-servidor-rama.log`, `nav-b-rama*.png|txt`.

**Todo lo de siempre funciona.** Los tres roles: 200 en todas las páginas y en
todas las escrituras de citas (con y sin paciente), el borrado deja 0 filas,
el alta de paciente da su expediente. La agenda en Chromium pinta la rejilla
de siempre (sin campana ni engrane), sin «Algo salió mal» ni errores de página.

**La cita atendida con nota**: la ruta nueva ya la protege SIN la base nueva
(`vetoPorNotaLigada`): mover, cancelar, volver a agendada y borrar dan **409
`nota_ligada`** con su texto; editar notas, 200. La fila queda atendida y en
su hora. (Con `main` sobre la misma base vieja, todo eso da 200 y la cita se
borra: ver la línea base de §5.4 (a).)

**Rutas nuevas, ninguna 500:**

| Ruta | Respuesta |
|---|---|
| `GET /reservar/<código>`, `GET /confirmar/<código>` | 404 (página «no encontrado») |
| `GET /api/reservar/<c>/turnos`, `POST /api/reservar/<c>`, `POST …/codigo` | 404 `{"error":"no_encontrado"}` |
| `GET /api/reservar/<c>`, `GET /api/confirmar/<c>` | 405 (no hay GET) |
| `POST /api/confirmar/<c>` (sin `Origin`) | 403 |
| `GET /api/cron/google-sync` sin secreto | 401 |
| `GET /api/cron/google-sync` y `/api/cron/recordatorios` con secreto | 200 `{"ok":true}` sin hacer nada |
| `GET /agenda/configuracion` | 200 |
| `GET|POST /api/agenda/{por-confirmar,tipos-cita,enlaces,reservas/contactos,reservas/historial,respuestas,bloqueos,restablecer,correo,whatsapp}` | 404 `{"error":"no_disponible"}` (el GET de `bloqueos` es 405: no existe) |

**Registro del servidor** (81 líneas en toda la corrida, ~95 peticiones): 57
veces `[agenda] interruptor de la agenda sin leer (cuenta como apagado): Could
not find the table 'public.agenda_ajustes' in the schema cache` (una por
petición autenticada que mira el interruptor: es el `warn` previsto, H3), 4
`[reserva] reserva_contexto falló: PGRST202`, 1 `[confirmacion]
cita_confirmacion_contexto no disponible: PGRST202`, 1 `[recordatorios]
recordatorios no disponibles: faltan las RPC de E4`. Ningún error, ningún
reintento en bucle. En el navegador, además, la secretaria pide
`/rest/v1/agenda_ajustes` desde el cliente y recibe un 404 que la consola
enseña («Failed to load resource»); la página sigue bien.

**Conclusión (b):** seguro. Coste: un `warn` por petición autenticada mientras
dure la ventana, un 404 en la consola del navegador de quien abra el dashboard,
y los crons de `vercel.json` contestan `ok` sin trabajo.

## 5.4 (a) Base NUEVA (14) + código VIEJO (`main`) [C]

**Cómo se puso la base nueva:** con el propio `supabase/produccion/plan/aplicar.sh aplicar`
contra el stack E2 (`APL_HOST=127.0.0.1 APL_PUERTO=55322 APL_USUARIO=postgres
APL_SSL=disable APL_RED=host`, confirmaciones por stdin), sobre la base vieja
de (b) con sus datos (semilla + lo que dejó (b): 366 citas, 4 consultorios, 2
clínicas). Las 9 pasaron sus pre-vuelos sobre los cuerpos con `\r\n` (la
corrección de `DERIVA.md` §0 funciona), sin ninguna fila REVISAR, y quedaron
registradas con `migration repair --status applied`; duración de cada archivo
0,27–0,58 s, ~3 s las 9 (`06a-aplicar.txt`). El cambio de estructura 5 → 14
(`comparar-estructura.sh`) da **958 diferencias, idénticas una a una** a
`plan/diferencias-antes-despues.clon-foto.tsv` (0 de más, 0 de menos). F1 dejó
4 filas en `audit_log` (una por consultorio copiado): 48 → 52.

Nota del montaje: la CLI crea `supabase/.temp/` en el repo al hacer el `repair`
(está en `.gitignore`).

**Lo que hace `main` encima** (`06a-arnes.txt`, `06a-servidor-main.log`,
`nav-a-main*`). Línea base para comparar: el mismo arnés con `main` sobre la
base VIEJA (`05x-arnes-main-base-vieja.txt`).

| Gesto (admin, secretaria, invitado) | `main` + base vieja | `main` + base nueva |
|---|---|---|
| `/inicio`, `/agenda`, expediente, `GET /api/appointments` | 200 | 200 (agenda pintada en Chromium, sin errores de página) |
| cita con y sin paciente: alta, notas, mover, confirmar, cancelar, borrar | 200; la fila desaparece | **igual** |
| alta de paciente | 200 | 200 |
| nota clínica ligada a una cita (`POST /api/consultas`) | 200, cita → `attended` | **igual** |
| editar notas de la atendida con nota | 200 | 200 |
| mover / cancelar / volver a agendada la atendida con nota | **200: lo hace** | **500** `{"error":"Una cita atendida con nota clínica no cambia de estado ni de fecha u hora"}`; la cita no cambia |
| borrar la atendida con nota | **200: la borra** | **500** `{"error":"Una cita atendida con nota clínica no se borra"}`; la cita sigue |

El registro del servidor de `main` no tiene ni un error en toda la corrida (sólo
el aviso de Gemini sin llave, igual que en la línea base): esos 500 no se
registran, `main` devuelve `error.message` de PostgREST al cliente.

**`audit_log` empieza a recibir `log_cita_change`** (desde la marca previa al
arnés): `cita_alta` 7, `cita_editada` 20, `cita_cancelada` 6, `cita_eliminada`
6, de los 3 usuarios; nombres de columnas y estado de→a, sin valores
(`06a-audit-durante.txt`). Las escrituras técnicas de Google que hace `main` con
el cliente admin (`google_event_id`, `gcal_sync_status`, `gcal_calendar_id`, y
el «unbound» de `gcal.ts`) pasan como `service_role` también sobre citas
atendidas con nota (transacción deshecha, `06a-sql-tecnicas.txt`).

**Por lectura de `main` (`git grep`/grep sobre su worktree) [D]:** sus únicas
escrituras a `appointments` son el alta y el PUT de `/api/appointments` (columnas
de la cita y del consultorio, nunca `reserva_*`, `cerrada_en`, `sustituida_por`,
`tipo_cita_*`, `google_asignacion`), el `DELETE`, el paso a `attended` de
`/api/consultas`, y cuatro escrituras técnicas de Google (`route.ts` del alta y
del PUT, `fijarEventoCreado`, `gcal.ts`). Contra los disparadores: `proteger_reserva`,
`proteger_cierre`, `proteger_eleccion` (sólo citas por enlace) y
`asignacion_google`/`aviso_clinica` (sólo `service_role` + `spinus.via='google'`)
no los alcanza; `proteger_borrado` y `horario_bloqueado` sólo actúan con la v2
encendida o con bloqueos, que no existen mientras corre `main`;
`proteger_atendida` es el único que cambia un resultado (tabla de arriba). Ningún
código de `main` hace TRUNCATE. Las tablas nuevas nacen vacías, así que sus FK
RESTRICT no frenan ningún borrado de clínica, consultorio o perfil de `main`.
Un efecto lateral: si durante la ventana alguien cambia el horario de la clínica
con `PUT /api/me/horario` de `main`, la copia que F1 hizo en cada consultorio
(`horario_propio = true`) ya no lo sigue; con la v2 apagada nadie lo lee, pero al
encenderla se verá el horario de la hora de F1.

**Conclusión (a):** seguro salvo un cambio visible: un intento de mover,
cancelar o borrar una cita **atendida con nota clínica** da 500 con un texto en
castellano (antes se hacía). Es la protección que se quiere; con el código nuevo
es un 409 con su mensaje. Nada más se rompe.

## 5.4 Conclusión: orden recomendado

**Las dos direcciones son seguras; ninguna deja a nadie sin agenda.** [C]

| Ventana | Qué ve un médico o una secretaria | Qué ve el registro |
|---|---|---|
| (b) código nuevo sobre base vieja | **nada distinto** de hoy; además, la cita atendida con nota ya queda protegida (409 con texto claro) | un `warn` «interruptor … sin leer (cuenta como apagado)» por petición autenticada; los crons contestan `ok` sin trabajo |
| (a) base nueva con código viejo | todo igual salvo **mover, cancelar, volver a agendada o borrar una cita atendida con nota clínica**: 500 con el texto de la base en castellano, y no se hace | nada (`main` no registra esos 500); `audit_log` empieza a recibir `log_cita_change` |

**Recomendado: CÓDIGO PRIMERO, base después** (con la v2 apagada en todas, como
nace). Razones, comprobadas: en (b) ningún gesto cambia de resultado y no hay
500; en (a) sí hay un 500 (raro, pero existe) y una copia de horarios que deja de
seguir a la clínica si alguien la edita en la ventana [D]. Además, con el código
desplegado primero, cada estado intermedio de la aplicación de las 9 es uno de
los estados de la reversa r1–r9 de abajo (14−T = ida hasta F5b, …, sólo las dos
de TRUNCATE = ida hasta 20261126). Con la v2 apagada, la rama funcionó en todos
los que se probaron apagada (5, sólo TRUNCATE, +F1, +F1+F5a, 14) [C]; los
prefijos +F3, +F2 y +F4 sólo se probaron con la v2 ENCENDIDA, el caso más
exigente, y funcionaron salvo la reserva por enlace en +F3 sin F2 (404 limpio)
[C]; apagada se deduce que también [D]. El plan vigente (`PLAN-DE-APLICACION.md`)
dice «base primero» y también es seguro: la diferencia es ese 500, no un riesgo
de datos. Lo decide Angel.

**Si se mantiene «base primero»**: la ventana es segura; hasta desplegar, una
cita atendida con nota no se puede mover/cancelar/borrar y la app vieja lo dice
con un error que trae un texto legible.

**Duración, para el tamaño real de producción** (247 citas, 17 clínicas, 18
consultorios, 20 perfiles). En el stack (366 citas, 4 consultorios): cada archivo
0,27–0,58 s y las 9 en ~3 s; la reversa completa, de un orden parecido. Lo que
crece con los datos es el backfill de F1 (una fila por consultorio) y los
índices/CHECK de `appointments`; con 247 citas es despreciable [D, extrapolado:
aquí 366 y en el ensayo del plan 20 000, ya de segundos]. En producción dominará
la latencia del pooler y el tiempo de leer cada rejilla y confirmar: minutos de
ventana humana, no de base. Los candados ACCESS EXCLUSIVE de F1/F3/F2/F5b sobre
`appointments` duran lo que cada archivo [C local, D en producción]. La ventana
entre base y código la fija el despliegue de Vercel. Ninguna ruta de la agenda
declara `maxDuration` (salvo `/api/google/sync` 30 s y los dos crons 60 s) y
Fluid Compute da 300 s por omisión: las peticiones del ensayo tardaron 40–120 ms
[C local].

## 5.5 Reversa

Montaje: sobre el stack con las 14 y los datos de (a), **la rama** en :3102, v2
ENCENDIDA en Semilla A (como postgres) y datos de la v2 generados POR LAS RUTAS
(`08-genera-datos-v2.txt`): tipo principal y otro tipo; enlace fijo y único (con
correo de la clínica); una reserva por el único (`201 {"estado":"reservada"}`);
el correo de confirmación manual (`POST /api/agenda/correo`); la confirmación del
paciente con su enlace (`303 …?r=confirmada`, código sacado de Mailpit); un
bloqueo; un evento cancelado y «eliminado» (`/quitar` → `cerrada_en`); con eso,
2 avisos de clínica. Entre pasos, una sonda de escrituras v2
(`12-sonda-*.txt`) que añade más datos.

Cada paso (`10-reversa/rN/`): foto de catálogo y conteo de filas de todas las
tablas de `public`/`respaldos` antes; **(1)** la reversa con `psql` SIN confirmar
datos, y foto y comparación otra vez; **(2)** `aplicar.sh reversa` (o
`reversa-truncate`), que repite la negativa, pide `PERDER DATOS <versión>`, la
corre con `SET spinus.reversa_con_datos = 'si'` y hace `migration repair
--status reverted`; foto y conteos después. Tras cada paso, la rama con el arnés
(`11-app-rN-*`).

### 5.5.1 y 5.5.2 — negativa con datos y qué se pierde [C]

| Paso | Reversa | Sin confirmar | Catálogo tras la negativa | Con `reversa_con_datos = 'si'` se pierde | Objetos que cambian | `audit_log` antes → tras negativa → después |
|---|---|---|---|---|---|---|
| r1 | `20261201180000` (T) | no tiene guarda de datos (sólo quita disparadores) | — | nada | 11 | 217 → 217 |
| r2 | F5b | **se niega**: «hay 1 citas canceladas cerradas…» | **0 diferencias** | el cierre de 1 cancelada (`cerrada_en`): **vuelve a pintarse en la agenda** | 59 | 312 → 312 → 312 |
| r3 | F4 | **se niega**: avisos_clinica 3, cita_correos 7, cita_confirmaciones 6 | **0 diferencias** | esas 16 filas; `cita_reagendos` estaba vacía | 222 | 367 → 367 → 367 |
| r4 | F2 | **no se negó: no había datos de F2** (sin Google no hay tokens, empalmes, rechazos ni «por asignar»), así que la «negativa» la APLICÓ (ver 5.5.6) | — | nada | 126 | 416 → 416 → 416 |
| r5 | F3 | **se niega**: reserva_avisos 1, reserva_enlaces 6, 3 citas con `reserva_*` | **0 diferencias** | la aprobación del aviso, los 6 enlaces y **todas las columnas `reserva_*` de las 3 citas por enlace** (nombre, teléfono, correo, HMAC, enlace, aviso aceptado, historial). Las citas **se quedan** como eventos sin paciente, con el nombre tecleado de título | 251 | 461 → 461 → 461 |
| r6 | F5a | **se niega**: agenda_bloqueos 6 | **0 diferencias** | los 6 bloqueos | 50 | 552 → 552 → 552 |
| r7 | F1 | **se niega**: agenda_ajustes 1 (0 encendidas: se apagó en r5, ver 5.5.4), tipos_cita 7, citas con tipo 3 | **0 diferencias** | el interruptor, los 7 tipos, el tipo de 3 citas, `horario_propio` (4), `horario_revisado_en`, `clinicas.timezone`. **Los horarios de los 4 consultorios vuelven exactamente al respaldo** (md5 de cada `horario` = el del respaldo); `respaldos.consultorios_horario_20261119` **se queda** (4 filas) | 131 | 595 → 595 → **599** (+4: la vuelta del horario, una por consultorio) |
| r8 | `20261126120000` | sin guarda de datos | — | nada (devuelve TRUNCATE, quita `prohibir_truncate`) | 97 | 603 → 603 |
| r9 | `20261125170000` | sin guarda de datos (exige r8 antes) | — | nada | 4 | 603 → 603 |

`audit_log` **sólo crece** durante toda la reversa: ninguna le borra una fila; F1
añade las de la vuelta del horario. De 48 al empezar el ensayo a 616 al terminar.

### 5.5.3 — tras la reversa completa [C]

`comparar-estructura.sh` entre la base «5 de main + deriva» del principio y la de
después de r9: **10 diferencias, todas de `respaldos.consultorios_horario_20261119`**
(la tabla, sus 5 columnas, su PK, su dueño, su privilegio): se queda a propósito.
Nada más. *(Nota del 2026-11-22, agente CA: tras la corrección A4 de la
auditoría, ronda 1, el respaldo tiene 8 columnas y son **13** diferencias;
comprobado en el ensayo de la fase 2 de CA. Este ensayo E2 no se repitió.)* Encima de esa base:

- **la rama** (`11-app-r9-rama*`): como en (b): 200 en los gestos, 409
  `nota_ligada`, 404 `no_disponible` en la v2, un `warn` por petición;
- **`main`** (`11-app-r9-main*`, `14-servidor-main-tras-reversa.log`): como en su
  línea base sobre la base vieja, también que vuelve a dejar mover/cancelar/borrar
  la atendida con nota (esa protección era de F5b). Registro sin errores.

### 5.5.4 — reversa PARCIAL: qué estados sirven a la rama [C salvo donde dice D]

| Estado (lo que queda) | Rama con la v2 ENCENDIDA | Rama con la v2 APAGADA |
|---|---|---|
| 14 (r0) | bien; borrar cita con paciente = 409 (regla v2) | bien (`07-arnes-rama-catorce-apagada.txt`) |
| sin T (r1) | igual que r0 | [D] bien |
| sin T, F5b (r2) | gestos y lecturas bien; **«Eliminar cita» (`/quitar`) da 503 `no_disponible`**; la cancelada cerrada reaparece; sin las protecciones de BASE (atendida con nota, borrado con v2, bloqueo total, candado de la elección): sólo quedan las de la API | [D] bien |
| … y F4 (r3) | como r2, más: `/confirmar/<código>` 404 y recordatorios «no disponibles» (warn); la reserva por enlace sigue | [D] bien |
| … y F2 (r4) | gestos bien; **la reserva por enlace deja de funcionar**: `/reservar/<fijo>` 404, `reserva_contexto falló: 42883` en el registro (F3 sin F2) | [D] bien |
| … y F3 (r5: quedan F1, F5a y las dos de TRUNCATE) | **ROTA**: 21 de 66 peticiones 500 — PUT/DELETE de `/api/appointments/[id]` (mover, editar, confirmar, cancelar, borrar), `por-confirmar`, `enlaces`, `contactos`; emitir enlaces 500; `42703` repetido en el registro («cita por ligar sin leer») | **bien**, como en (b) |
| … y F5a (r6) | [D] rota como r5 | bien |
| … y F1 (r7: sólo las dos de TRUNCATE) | sin interruptor: cuenta como apagada | bien |
| … y las dos de TRUNCATE (r9 = 5 de main) | apagada | bien |

**Regla que sale de aquí:** una reversa que quite F3 (o más) con la v2 ENCENDIDA
en alguna clínica **rompe la agenda de esa clínica** (500 al mover o cancelar).
Antes de revertir nada, **apagar la v2 en todas** (ya lo pide el plan, §7.3): así
funcionan todos los estados probados. Quitar sólo T, F5b o F4 deja la v2 usable,
pero sin las protecciones de base o sin confirmaciones.

### 5.5.5 — la ida otra vez [C]

`aplicar.sh aplicar` sobre la base revertida: las 9 pasan sus pre-vuelos, sin
REVISAR, y se registran; 0,27–0,56 s cada una. Catálogo comparado con el de la
primera ida: **0 diferencias** (3433 objetos). F1 encuentra el respaldo ya creado
y lo conserva (4 filas).

### 5.5.6 — el historial `supabase_migrations.schema_migrations` [C]

Las reversas **no** tocan el historial: lo hace `aplicar.sh` después de cada una
con `migration repair --status reverted <versión>` (CLI 2.117.0 con `--db-url`):
14 → 13 → … → 5 filas, las de `main`.

Si una reversa se corre **fuera** de `aplicar.sh` (psql o SQL Editor), el
historial queda mintiendo. Dos consecuencias, comprobadas:

1. **La ida no la repone.** Con T revertida a mano y su versión aún registrada,
   `aplicar.sh aplicar` dice «ya registrada: 20261201180000_agenda_sin_truncate»
   y la salta: los disparadores siguen sin estar (`16-historial/`). Tras
   `migration repair --status reverted 20261201180000`, la misma orden la aplicó
   y el catálogo volvió a ser idéntico al de la primera ida (0 diferencias).
2. **La reversa no se puede repetir.** En r4 la «negativa» de F2 se aplicó (no
   había datos); luego `aplicar.sh reversa` intentó la misma reversa porque el
   historial todavía la tenía, falló («va en una transacción: no tocó nada») y
   paró. Se arregló con `migration repair --status reverted 20261201150000` a
   mano (`10-reversa/r4/repair-a-mano.txt`) y se siguió.

Conclusión: **revertir siempre con `aplicar.sh`**; si alguna vez se hace a mano,
el paso siguiente obligatorio es `npx --yes supabase@2.117.0 migration repair
--status reverted <versión> --db-url …` (lo corre Angel en su terminal). Y una
reversa sin datos que perder (T, F2 sin Google, las dos de TRUNCATE) **no pide
confirmación**: se aplica a la primera.

## Lo que NO se ensayó

- Google (ni `main` ni la rama): no hubo cuenta ni Google falso en este montaje,
  y F2 no tuvo datos que perder. La sincronización de `main` sobre la base nueva
  se dedujo por lectura y por la prueba SQL de sus escrituras técnicas.
- Realtime (excluido del stack): la actualización en vivo de la agenda no se vio.
- Playwright del repo (sus ayudas tienen fijo el contenedor compartido); en su
  lugar, el arnés HTTP y Chromium para `/inicio` y `/agenda`.
- Los prefijos +F3, +F2 y +F4 con la v2 APAGADA (sólo encendida).
- Producción, el pooler y Vercel: duración y ventana allí son [D].
