# La ventana «base primero»: base nueva + código de `main` (y la v2 en los previews)

> Agente BP, 2026-11-23, sobre `feature/agenda-v2-produccion`. **Sólo
> documentación; nada contra producción.** Decisión de Angel: la BASE se aplica
> primero (plan `supabase/produccion/plan/PLAN-DE-APLICACION.md` §4) y el código
> se fusiona a `main` días después (§4-bis), porque Angel prueba el rediseño de
> la agenda en los previews de Vercel, que apuntan a la base de producción.
>
> **[C]** = comprobado: ensayado por E2 (`supabase/produccion/ensayo/ORDEN-Y-REVERSA.md`),
> leído del catálogo local con las 14 en una transacción de sólo lectura, o
> leído en la documentación citada. **[D]** = deducido leyendo el código de
> `main` (`git show main:<ruta>`, `main` = `95cb5781`) y las funciones de las 9
> migraciones; no ejecutado. Ningún dato de pacientes aquí.

## 0. Lo primero

**Nada de lo encontrado desaconseja «base primero»**: con la v2 apagada en todas,
lo ensayado es seguro [C, E2 §5.4 (a)] y lo no ensayado se deduce seguro (§1).
**Encender la v2 en la clínica de Angel con `main` en producción tampoco pierde
ni corrompe datos** [D], pero tiene costes que Angel debe aceptar antes:

1. **Quien use la app de producción (v1) en ESA clínica choca con reglas que la
   v1 no conoce**: borrar una cita con paciente, crear o mover una cita dentro de
   un bloqueo que la v1 no pinta, o mover una cita reservada por enlace, **no se
   hace**; la v1 lo dice con un aviso (al borrar, primero «Se eliminó de la
   agenda» y luego «No se pudo eliminar», y la cita vuelve). §2.
2. **Los correos que salgan de un preview van a pacientes reales** y sus
   enlaces dependen de `NEXT_PUBLIC_APP_URL` del entorno Preview: con el dominio
   de producción llevan a `main`, que no tiene `/confirmar` (enlace muerto). §3.
3. **`RESERVA_SECRETO` de Preview tiene que ser EL MISMO que tendrá
   Production**, o todo lo emitido en los previews deja de abrir tras el merge.
   §3 y `VARIABLES-VERCEL.md`.
4. **La reserva por enlace no se puede probar en ningún preview** mientras el
   aviso de privacidad lleve la marca de pendiente de revisión legal [C, lectura:
   `src/lib/reserva/avisoReserva.ts:88-93`, con `VERCEL=1` no hay excepción].
5. **Durante toda la ventana (días), `main` sobre la base nueva tarda ~+500 ms en
   abrir la agenda con red limitada**, para todas las clínicas [C local,
   `supabase/produccion/ensayo/ENSAYO-PRINCIPAL.md` §5.6; no investigado; en
   producción, D].

---

## 1. La ventana con la v2 APAGADA en todas (base nueva + `main`)

Lo que E2 ensayó en esta dirección [C, ORDEN-Y-REVERSA §5.4 (a)]: las 14 puestas
con este mismo `aplicar.sh`, y `main` encima con los tres roles: `/inicio`,
`/agenda`, expediente, alta, notas, mover, confirmar, cancelar y borrar citas con
y sin paciente, alta de paciente, nota ligada a una cita: **igual que con la base
vieja**, y el registro de `main` sin errores. Lo que cambia:

| # | Efecto | Qué ve el usuario | ¿Se pierde algo? | |
|---|---|---|---|---|
| 1.1 | **Cita ATENDIDA con nota clínica ligada** (`cita_proteger_atendida`, F5b `20261201170000…:279-305`; disparador sólo `WHEN OLD.status = 'attended'`, sobre `UPDATE OF status, start_time, end_time, all_day` o `DELETE`) | **Mover** (arrastrar o redimensionar), **cambiar el estado** (a agendada, confirmada, cancelada o no asistió), **cambiar «todo el día»**: la ruta da **500** `{"error":"Una cita atendida con nota clínica no cambia de estado ni de fecha u hora"}` y la agenda de `main` enseña ese texto en el aviso y devuelve la cita a su sitio (`main:src/app/(app)/agenda/page.tsx:7360-7363` al mover, `:7512-7517` al guardar el formulario). **Borrar**: 500 `{"error":"Una cita atendida con nota clínica no se borra"}`; la agenda, que borra de forma optimista, enseña **«Se eliminó de la agenda»** y después **«No se pudo eliminar»**, y la cita reaparece (`:7595-7611`). **Editar las notas sí** (200) | no: la cita se queda atendida y en su hora; el evento de Google no se toca (el DELETE y el PUT de `main` salen antes de su `after()`: `main:src/app/api/appointments/[id]/route.ts:611`, `:1131-1132`) | 500 y textos de la ruta [C, E2]; lo que pinta la agenda [D] |
| 1.2 | **Horario**: F1 copia una vez el `horario_consulta` de cada clínica a cada consultorio y lo marca `horario_propio = true` (F1 `…120000…:665`, `:824`) | Nada con la v2 apagada: `main` sólo lee y escribe el de la clínica (`main:src/app/api/me/horario/route.ts:55`, `main:src/lib/configApp.ts:59`). **Si alguien cambia el horario de la clínica en la ventana**, la agenda vieja enseña el nuevo, pero los consultorios se quedan con la copia de F1; **la v2** (los previews, y producción tras el merge) usa la copia. **Si alguien cambia el horario de un consultorio** con `main` (`main:src/app/api/consultorios/[id]/route.ts:149`), la v2 lo usará, y la reversa de F1 lo lista entre lo que perdería («consultorios con horario editado…», `reversa-previa.sql:76-78`). **Un consultorio creado por `main`** en la ventana nace con `horario_propio = false` (F1 `:789`): en la v2 hereda el de la clínica y sale «por revisar» | no | [D; E2 lo dedujo igual] |
| 1.3 | **`audit_log` recibe `log_cita_change`** (F1 `:521`, disparadores `:769-777`) | nada en pantalla: cada alta, cambio no técnico y borrado de cita deja una fila (nombres de columna, de→a del estado, nunca valores) | no; `audit_log` crece más deprisa | [C, E2] |
| 1.4 | **+500 ms** al abrir la agenda de `main` con red limitada (999 → 1506 ms, 4 rondas) | todas las clínicas, con red lenta | no | [C local; D en producción] |
| 1.5 | TRUNCATE prohibido en `audit_log`, las 11 tablas clínicas y las 11 de la agenda con datos de personas | nadie (ningún código hace TRUNCATE) | — | [C catálogo; D uso] |
| 1.6 | Los demás disparadores de `appointments` (`proteger_reserva`, `proteger_cierre`, `proteger_eleccion`, `horario_bloqueado`, `proteger_borrado`, `asignacion_google`, `aviso_clinica`, `reserva_incidencia`) | nada: o miran columnas que `main` no escribe (`reserva_*`, `cerrada_en`, `google_asignacion`), o sólo actúan con la v2 encendida, o con filas que no existen (bloqueos, citas por enlace) | — | [D, E2 §5.4 (a) por lectura; la lista de 12 disparadores de `appointments`, C: catálogo local con las 14] |
| 1.7 | Columnas nuevas de `appointments` en los mensajes de Realtime | nada (van NULL; `main` no las lee) | — | [D; Realtime no se ensayó] |
| 1.8 | Las escrituras técnicas de Google de `main` (con `service_role`, sin `spinus.via`) | nada: pasan también sobre una atendida con nota | — | [C, E2: transacción deshecha] |

**Estados intermedios** (si `aplicar.sh` se para a media): plan §8.2. Se ensayó
`main` con las 5 y con las 14; los prefijos de en medio con `main`, no [D,
seguros: `main` no nombra ningún objeto de las 9].

---

## 2. La v2 ENCENDIDA en la clínica de Angel, con `main` en producción

Angel la enciende por SQL sólo en su clínica (plan §4, paso 8) para usar los
previews. `main` no lee `agenda_ajustes`: **su agenda sigue siendo la v1**, pero
la base ya aplica a esa clínica las reglas de la v2. Quien entre a producción
(v1) en ESA clínica —Angel u otra persona de su clínica— ve esto (las demás
clínicas, nada nuevo: tienen la v2 apagada). **Todo esto es [D]**: E2 nunca
corrió `main` con la v2 encendida.

| Acción en la v1 | Qué pasa | Qué ve | ¿Se pierde o corrompe algo? |
|---|---|---|---|
| **Crear** una cita o evento | entra como siempre… **salvo dentro de un bloqueo** de ese médico (los bloqueos los crea la v2 de un preview; la v1 **no los pinta**: están en `agenda_bloqueos`, no en `appointments`). Dentro, `cita_proteger_bloqueo` (F5b `:238-271`) da 42501 → `main` 500 (`main:src/app/api/appointments/route.ts:504`) | el aviso «Este horario está bloqueado. Quita el bloqueo para agendar aquí.», sin ver por qué; el bloqueo sólo se quita desde la v2. Si Google está conectado y la v2 ya lo sincronizó, el bloqueo sale en Google como «Ocupado» y la v1 podría pintarlo como evento de Google (`main:src/app/api/google/events/route.ts`) | no |
| **Mover / redimensionar** | igual que crear si el destino toca un bloqueo (mira inicio, fin y médico). **Cita reservada por enlace que aún no empieza** (`cita_proteger_eleccion`, F5b `:389-417`): mover de día u hora, o cambiar consultorio o médico, da 42501 → 500. Redimensionar (sólo el fin) sí se hace | «El consultorio, el día y la hora de una cita reservada por enlace sólo cambian con «Reagendar»» o «El médico de una cita reservada por enlace no se cambia»; la cita vuelve a su sitio | no |
| **Cambiar estado / cancelar** | se hace, salvo la atendida con nota (1.1) y una **cancelada ya cerrada** por la v2 (reasignada o «Eliminar cita»), que no se reabre (`cita_proteger_cierre`, F5b `:339-385`: «Una cita cancelada que ya se cerró no se reabre»). En una cita reservada por enlace, cancelar o marcar «no asistió» **cuenta para el candado** del paciente (`reserva_registrar_incidencia`, F3 `…140000…:571-626`), como en la v2. Confirmar en la v1 no manda ningún correo | el aviso con el texto, en los dos vetos | no |
| **BORRAR una cita con paciente, o por ligar** (reservada por enlace) | `cita_proteger_borrado` (F5b `:312-334`) da 42501 → 500 (`main:src/app/api/appointments/[id]/route.ts:1131-1132`) | «Se eliminó de la agenda», luego «No se pudo eliminar», y la cita reaparece (`main:src/app/(app)/agenda/page.tsx:7595-7611`). En la v1 no hay «cancelar en vez de borrar» automático: hay que cancelarla | no: el evento de Google no se toca |
| **Borrar un evento sin paciente** (también uno «por asignar» importado de Google) | se borra, y `main` borra el evento de Google como siempre | lo de siempre | lo de siempre. Caso raro: si la v2 lo usó como sustituta de una cancelada cerrada, la FK RESTRICT `appointments_sustituida_por_fkey` lo impide: 500 con el texto en inglés de Postgres |
| **Cita atendida con nota** | igual que con la v2 apagada (1.1) | — | no |
| **Columnas `reserva_*`** | `main` no las escribe nunca, así que `cita_proteger_reserva` (F5b `:424-455`) no salta. La v1 enseña una cita por enlace como **evento sin paciente** con el nombre tecleado de título; ligarle un paciente desde la v1 se puede | — | no |
| **Citas «por asignar»** (`google_asignacion`, las importa la v2 de Google) | la v1 las enseña como eventos sin paciente, con el título de Google. Si la v1 les pone paciente, la marca se queda pero la v2 ya no la trata como «por asignar» (`src/lib/agenda/tarjetasAgenda.ts:63-65` exige `!paciente_id`); se salta, eso sí, el veto de la v2 al convertir (`vetoDeConversion`: consultorio obligatorio) | — | no |
| **Canceladas cerradas** (las que la v2 «elimina» o sustituye) | la v1 no filtra `cerrada_en` (`main:src/app/api/appointments/route.ts:69-79`): las sigue pintando como canceladas; tras un «Reagendar» de la v2 se ven las dos, la cancelada y la nueva | dos tarjetas | no |
| **Sincronización con Google de `main`** (escribe `google_event_id`, `gcal_sync_status`, `gcal_calendar_id` y el «unbound» con `service_role` sin `spinus.via`) | no la frena nada: esas columnas no despiertan ni a `proteger_eleccion` (`UPDATE OF medico_id, consultorio_id, start_time, end_time, all_day`) ni a `horario_bloqueado`; `proteger_reserva` exime a `service_role` | — | no. **Dos escritores sobre los mismos eventos**: `main` los parchea al guardar y la v2 del preview los relee al sincronizar; con las horas ya iguales en la base no debería cambiar nada. **No ensayado: E2 no tuvo Google** |
| **Horario** | la v1 pinta el de la clínica; la v2 del preview, el de cada consultorio (1.2). Lo que se cambie en la configuración de la v2 no lo ve la v1, y al revés | dos horarios distintos según dónde se mire | no |
| **Tiempo real** | la v1 escucha el mismo `appointments-realtime` (`main:src/app/(app)/agenda/page.tsx:6930`) y recibe todo lo que haga el preview, con las columnas nuevas, que ignora | lo hecho en el preview aparece en la v1 (con las salvedades de arriba) | no. **No ensayado** |

**Si Angel apaga la v2** después, lo creado en ella se queda (bloqueos, tipos,
enlaces, avisos, correos, cerradas) y deja de actuar lo que depende del
interruptor. Desde ahí, con `main`, borrar una cita que tenga filas en
`cita_correos`, `cita_confirmaciones`, `cita_reagendos`, `reserva_incidencias` o
`reserva_enlaces.usado_cita_id` (FK RESTRICT de F3 y F4) da 500 con el texto en
inglés de Postgres [D].

### Las tareas programadas: no corre ninguna en la ventana [C]

- `main` no tiene `crons` (`git show main:vercel.json`: sólo `buildCommand`).
- **Vercel no ejecuta tareas programadas en los previews**: «Cron jobs run only
  on production deployments» y «Vercel invokes cron jobs on the production
  deployment serving your production domain» (documentación de Vercel, *Managing
  Cron Jobs*, https://vercel.com/docs/cron-jobs/manage-cron-jobs, leída el
  2026-11-23).
- Así que hasta el día del código: **ningún recordatorio automático** (además
  nace apagado: `agenda_ajustes.recordatorio_encendido`) y **ningún sondeo
  periódico de Google**. Google→Spinus sólo se mueve cuando la v2 de un preview
  llama a `POST /api/google/sync` (lo hace la agenda v2 al abrirse, con la v2
  encendida; `src/app/api/google/sync/route.ts:80` contesta `omitida` sin ella)
  [D].

---

## 3. Riesgos de los previews contra la base de PRODUCCIÓN (antes de encender)

Un preview es el código de la rama con las variables del entorno **Preview** de
Vercel, contra la misma base de producción, con datos reales. Lo que el repo no
puede ver (qué variables tiene hoy Preview) hay que mirarlo en el panel.

| Riesgo | Por qué | Qué hacer |
|---|---|---|
| **`RESERVA_SECRETO` distinto (o ausente) en Preview** | los códigos de enlace y de confirmación se derivan por HMAC de él y en la base sólo está su sha256 (`src/lib/reserva/secretos.ts:1-26`); los seudónimos del candado (`contacto`), los códigos de 6 dígitos y la red, también. Con otro secreto, lo emitido en un preview **no abre en producción tras el merge** (y al revés), y el historial del candado (incidencias, bloqueos manuales por teléfono o correo) **no casa**. Sin él, falla cerrado: no se emite nada | el MISMO valor en Preview y Production, generado una vez (`VARIABLES-VERCEL.md` §1) |
| **`EMAIL_TRANSPORT` en Preview** | sin definir: apagado, no sale ningún correo de la agenda (ni la confirmación manual, ni el código de verificación del enlace fijo, que sin correo no se puede reservar) [C lectura, `src/lib/correo/transporte.ts:127-136`]. Con `resend`: **salen a pacientes reales**, a nombre del médico | decidir; si se pone `resend`, mirar antes `NEXT_PUBLIC_APP_URL` (fila siguiente) |
| **`NEXT_PUBLIC_APP_URL` de Preview** | los enlaces de los correos (`/confirmar/<código>`, «Continuar mi reserva») salen de ella (`src/lib/confirmacion/enlaceConfirmacion.ts:99`, `:120`). Con el dominio de producción llevan a `main`, que no tiene `/confirmar` ni `/reservar` (no existen en `main:src/app` ni son públicas en `main:src/middleware.ts`): **enlace muerto** (404 o el login) [D]. Con la URL de un preview, depende de la protección de despliegues de Vercel (si pide iniciar sesión en Vercel, el paciente no entra) [no comprobado]. El enlace que enseña la configuración usa `window.location.origin` (`src/components/agenda/configuracion/accionesConfig.ts:151`): el del preview | no mandar correos de la agenda a pacientes desde un preview hasta tenerlo claro |
| **El aviso de privacidad con la marca** | con `VERCEL=1` la página de reserva no abre aunque se apruebe el hash [C lectura, `avisoReserva.ts:88-93`] | la reserva por enlace no se prueba en previews; `RESERVA_AVISO_BORRADOR_LOCAL` no sirve (no tiene efecto en Vercel) y no se pone |
| **`GCAL_FALSO_URL`** | un build de Vercel lleva `NODE_ENV=production`: `rootUrlGoogleFalso()` la ignora (`src/lib/gcalFalso.ts:40-46`) [C lectura] | igual no se pone en Preview |
| **`AGENDA_RSVP_GOOGLE`** | con `encendido`, el preview confirmaría citas de verdad por la respuesta a la invitación, sin la prueba con Google real (`src/lib/gcalRsvp.ts`) | sin definir también en Preview |
| **Google desde el preview** | la sincronización del preview usa la conexión de Google REAL de la clínica (tokens descifrados con `GOOGLE_TOKEN_SECRET` del entorno Preview; con otro valor, falla) y escribe `appointments` de producción. Reconectar Google desde un preview usaría `GOOGLE_REDIRECT_URI` de Preview [D] | no reconectar Google desde un preview; si Preview no tiene las de Google, la sincronización falla y la agenda sigue |
| **`SUPABASE_SERVICE_ROLE_KEY` en Preview** | que los previews apunten a producción significa que **cualquier preview de cualquier rama** tiene la llave de servicio de producción; un preview de una rama vieja o a medias escribe con ella [D] | saber qué ramas generan previews; decisión de Angel |
| **Otras clínicas** | sólo cambian si alguien de ellas usa un preview: la v2 sigue apagada para ellas | no compartir enlaces de preview |

**Lo que no se pudo comprobar:** qué variables tiene hoy el entorno Preview, si
hay protección de despliegues, cómo resuelve `NEXT_PUBLIC_APP_URL` en Preview,
Google real, Realtime, y cualquier cosa de `main` con la v2 encendida en
ejecución (todo §2 es [D]).

## 4. Decisiones que quedan para Angel

1. Encender la v2 en su clínica con §13 del plan sin resolver (sin reserva por
   enlace en Vercel), sabiendo lo de §2 para quien use la v1 en esa clínica.
2. `EMAIL_TRANSPORT` y `NEXT_PUBLIC_APP_URL` en Preview: ¿correos reales desde
   un preview, sí o no?
3. Qué medición cuenta como «antes» el día del código si la v2 ya estaba
   encendida (plan §4-bis, C1).
4. Si se investigan los +500 ms de `main` sobre la base nueva, ahora que la
   ventana dura días.
