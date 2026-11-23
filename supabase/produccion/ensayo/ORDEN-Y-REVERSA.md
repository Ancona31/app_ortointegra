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
