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
