# Agenda para todos — M3: diseño, informe del interruptor y repaso del AUTOR

Migración: **M3** `supabase/migrations/20261206120000_agenda_para_todos.sql`. Rama
`feature/agenda-para-todos`. Fecha: 2026-11-25.

> **Esto NO es la auditoría.** La dimensión 25 de `supabase/AUDITORIA-MIGRACIONES.md` exige que audite
> alguien que no escribió la migración. Esto es lo que el autor comprobó y lo que NO pudo comprobar.
> Todo lo marcado «local» se comprobó en el stack local de Supabase (CLI 2.117.0), no en el clon de
> la foto de producción ni en producción.

## 1. La decisión y lo que se construyó

Decisión de Angel (2026-11-25): la agenda v2 queda encendida para TODAS las clínicas, las de hoy y
las que se registren después, sin pasos manuales. El interruptor sigue existiendo como dato; no se
construye nada alrededor de él.

Semántica nueva: **encendida salvo que la fila diga explícitamente `false`.**

| Pieza | Antes | Ahora |
|---|---|---|
| `agenda_ajustes.agenda_v2_encendida` | `DEFAULT false` | `DEFAULT true` |
| `public.agenda_v2_encendida(uuid)` | sin fila → `false` | sin fila → `true` |
| Clínicas de hoy | sólo la de Angel tiene fila en `true` | todas con fila; las que decían `false` pasan a `true` |
| Clínica nueva | nace sin fila (apagada) | `trg_clinicas_agenda_ajustes` le crea su fila de fábrica (encendida) |
| La app | lee la fila; `true` sólo si la fila dice `true` | le PREGUNTA a la función de la base (`rpc`); un error sigue siendo «apagada» |

### 1.1 Por qué hay fila para todas (y no sólo «sin fila = encendida»)

Ocho funciones de la base NO llaman a la función común: leen la fila de `agenda_ajustes` en línea,
porque de esa misma fila sacan los plazos y el candado. Sin fila contestan «apagado», diga lo que
diga la función común:

| Dónde | Función | Qué dejaría de funcionar sin fila |
|---|---|---|
| F1 `20261201120000:646` | `agenda_restablecer_configuracion` | «Empezar de nuevo» de la configuración |
| F3 `20261201140000:813` | (la que abre el enlace para el público) | la página de reserva por enlace |
| F3 `20261201140000:1125` | `reservar_por_enlace` | reservar por enlace |
| F2 `20261201150000:649` | `gcal_sync_clinicas_pendientes` | la sincronización programada con Google |
| F4 `20261201160000:713`, `:800`, `:944` | confirmación y reagendado por enlace del paciente | confirmar, cancelar y reagendar por enlace |
| F4 `20261201160000:1059` | `cita_recordatorios_pendientes` | el recordatorio (además exige `recordatorio_encendido`) |

Y `PUT`/`PATCH /api/me/ajustes-agenda` sólo hacen `UPDATE`: sin fila responden 404.

Reescribir las ocho para que toleren «sin fila» (F3 pasa de 300 líneas y lleva huellas md5) es
mucho más riesgo que garantizar la fila. Por eso M3 rellena y pone el disparador en `clinicas`. El
`DEFAULT true` y el `coalesce(…, true)` quedan como pidió la sesión de planificación, de respaldo:
una clínica que por lo que sea se quedara sin fila está encendida para los disparadores de
protección y para la app, y apagada para esas ocho. La rejilla de M3 (fila 5) y el conteo «clínicas
sin fila» lo enseñan; se arregla con un `INSERT` como postgres.

### 1.2 Por qué la app pregunta a la función en vez de leer la fila

Para que el orden de despliegue no importe y no haya un estado a medias. Con el código nuevo y la
base SIN M3, la función sigue contestando `false` para quien no tiene fila: todo sigue como hoy. En
el instante en que M3 hace `COMMIT`, la base y la app pasan a decir «encendida» a la vez. Si la app
hubiera escrito por su cuenta «sin fila = encendida», entre el despliegue del código y M3 las
clínicas sin fila habrían visto la agenda nueva con la base apagada (sin bloqueos, sin enlaces, sin
guardar ajustes).

Sigue fallando cerrado: error de red, función o tabla ausentes, o una respuesta que no sea `true` →
apagada. «Sin fila» no es un error (lo contesta la base); un fallo de lectura sí.

### 1.3 Lectores del interruptor (todos)

Lecturas de la BASE (son las únicas que se cambiaron):

1. `agendaV2Encendida()` — `src/lib/agenda/ajustesAgenda.ts`. La usan, con el cliente de sesión:
   `src/app/(app)/layout.tsx` (monta la campana de avisos de toda la app), `src/app/(app)/agenda/page.tsx`
   (y por promesa, `AgendaCliente` y todo lo que cuelga de él), `agenda/configuracion/page.tsx`,
   `api/appointments` (POST), `api/appointments/[id]` (PUT y DELETE), `api/agenda/bloqueos` y
   `…/[id]`, `api/agenda/tipos-cita` y `…/[id]`, `api/me/ajustes-agenda`, `api/consultorios/[id]`,
   `api/google/sync`, `src/lib/gcalEscritura.ts` (`prepararAtendidaEnGoogle`, desde `api/consultas`)
   y `src/lib/reserva/gestionServidor.ts` (enlaces de reserva).
2. `leerAgendaV2()` / `agendaV2DeClinica()` — `src/components/dashboard/ProximasCitas.tsx`, en el
   navegador (dashboard del médico y de la secretaria). Recuerda la respuesta buena por pestaña.
3. `leerAjustes()` — `agenda/configuracion/page.tsx`: **no se cambió.** Lee interruptor y ajustes
   de la misma fila en UNA consulta (preguntar además a la función añadiría un viaje a esa página).
   Con fila, la columna y la función dicen lo mismo; sin fila la página no abre (404), que es
   coherente: sin fila la configuración no puede guardar (§1.1).

**Viajes a la base por navegación, antes → después: ninguno añadido.** `agendaV2Encendida`: 1 → 1
(un `select` por la clave única pasa a ser un `rpc` que hace esa misma lectura; el layout lo sigue
lanzando dentro de su `Promise.all`). `ProximasCitas`: 1 → 1 la primera vez por pestaña y clínica, 0
después (conserva el recuerdo a nivel de módulo). `/agenda/configuracion`: 1 → 1.

Todo lo demás (`AgendaCliente`, `BurbujaAlta`, `AppointmentModal`, las campanas, `useAjusteTurno`…)
recibe el valor ya leído; no consulta la base. Los crons no leen el interruptor en la app: lo decide
la base en su listado.

## 2. Qué cuelga del interruptor y qué pasa al encenderse de golpe

| Qué | Con la v2 apagada | Al encenderse en una clínica que nunca configuró nada |
|---|---|---|
| La agenda (`/agenda`) | la de siempre | la nueva: cuatro vistas, burbuja, tarjeta, barra v2, campana, engrane a `/agenda/configuracion` |
| Horarios | el de la clínica | los de los consultorios; los que no tienen horario propio heredan el de la clínica (G4). F1 ya copió el de la clínica a cada consultorio el día que se aplicó |
| `/agenda/configuracion` | 404 | abre en «primera vez» mientras el médico no tenga duración propia o todos sus consultorios estén por revisar. La agenda funciona sin haberlo completado |
| Borrar una cita con paciente | se borra | **no se borra: se cancela** (API: 409; base: `trg_appointments_proteger_borrado`, 42501 también a `service_role`) |
| Mover una atendida con nota | la API ya lo impedía | también la base (`cita_proteger_atendida`) |
| Bloqueos de horario | no existen (404) | existen; nada entra en un bloqueo (`trg_appointments_horario_bloqueado`). Sin bloqueos creados no cambia nada |
| Tipos de cita, duración de la consulta | 404 | disponibles; sin tipos, las citas duran lo de siempre |
| Reserva por enlace | 404 | disponible para emitir enlaces, **pero ningún enlace abre** mientras el aviso de privacidad lleve la marca de revisión legal (`avisoReserva.ts`) |
| Confirmación por correo, «Por confirmar» | no | sí (manda el personal). El recordatorio AUTOMÁTICO sigue apagado (`recordatorio_encendido = false`), y el correo a la clínica también |
| Avisos (campana, M1) | no se escriben | los disparadores de M1 y F4 empiezan a escribir avisos en todas las clínicas |
| Google, con conexión | Spinus → Google | en los dos sentidos: lo creado en el calendario de Spinus en Google entra como «por asignar» (30 días atrás la primera vez) y deja aviso; el título de una cita con paciente no se acepta desde Google |
| «¿Asistió el paciente?» | no | al abrir la agenda pregunta por las citas agendadas o confirmadas, con paciente, de hace más de 48 h y sin nota (hasta 50, las más recientes primero; **sólo las de los últimos 30 días**) |
| Rutas que dan 404 `no_disponible` | tipos de cita, bloqueos, ajustes, enlaces | dejan de darlo |

### 2.1 Tareas programadas

- **`/api/cron/google-sync`** (cada 10 min, `maxDuration` 60 s, presupuesto 45 s, hasta 15 s por
  clínica, en serie; lista hasta 100 con `gcal_sync_clinicas_pendientes`, la que lleva más tiempo sin
  sincronizar primero). Hoy recorre una clínica. Tras M3 recorre TODAS las que tengan Google
  conectado con calendario. Una sincronización completa (la primera) puede agotar sus 15 s: caben
  tres por pasada y el resto esperan a la siguiente; las incrementales son cortas. No cambia
  `maxDuration` ni el presupuesto. Cuántas clínicas son: **hueco — fila C.1 de los conteos**.
- **`/api/cron/recordatorios`** (cada 15 min): su listado sólo trae clínicas con
  `recordatorio_encendido = true`. M3 no enciende ninguno: **carga añadida, cero**.
- Además, cada vez que alguien abre la agenda de una clínica con Google conectado, la app pide un
  sondeo (`POST /api/google/sync`, como mucho uno por minuto y clínica).

### 2.2 En lenguaje llano: una clínica que hoy usa la agenda vieja y mañana entra con la nueva

- Ve otra agenda: Mes, Semana, 3 días y Día; al tocar un hueco sale una burbuja para agendar; al
  tocar una cita, una tarjeta con sus acciones. Sus citas son las mismas.
- Arriba aparece una campana con avisos (por ejemplo, cuando la secretaria agenda en la agenda del
  médico) y un engrane que lleva a la configuración de la agenda.
- Ya no puede BORRAR una cita que tenga paciente: la cancela. Los eventos sin paciente sí se borran.
- Si tiene citas pasadas que se quedaron como «agendada» o «confirmada», la agenda le pregunta si el
  paciente asistió (de 50 en 50). Puede contestar «Decidir después».
- Si tiene Google conectado, lo que escriba en el calendario de Spinus dentro de Google empieza a
  aparecer en Spinus como «por asignar», con su aviso.
- Puede bloquear horarios, definir la duración de su consulta y sus tipos de cita, y mandar al
  paciente un correo de confirmación. Nada de eso es obligatorio.
- No recibe ni manda ningún correo automático nuevo: el recordatorio y el aviso por reserva nacen
  apagados. La reserva por enlace no abre al público hasta la revisión legal del aviso.

### 2.3 Lo que conviene que Angel decida antes de aplicar

1. ~~«¿Asistió el paciente?» sin límite hacia atrás.~~ **Decidido por Angel (2026-11-25) y hecho:**
   sólo se pregunta por las citas de los últimos 30 días (`DIAS_QUE_SE_PREGUNTAN`,
   `asistenciaServidor.ts`; sin migración: la regla vive en el servidor, no en la base). Lo anterior
   no se pregunta ni se toca: sigue agendado o confirmado en la base, la rejilla, el buscador y las
   estadísticas, como antes. El conteo C.5 dice cuántas quedan dentro y cuántas fuera.
2. **AG-DT-274 y AG-DT-264** dicen «resolver antes de encender la v2 en otras clínicas», y M3 es
   exactamente eso. La 274 (códigos de la reserva) no puede crecer mientras los enlaces no abran al
   público; la 264 (reflejos hacia Google y avisos que se pierden sin reintento) sí aplica desde el
   primer día a toda clínica con Google conectado.
3. **`spinus-consola`**: si borra clínicas, desde M3 tiene que borrar antes su fila de
   `agenda_ajustes` (FK RESTRICT). No se ve desde este repositorio.

## 3. Ventana de despliegue

**Orden seguro: CÓDIGO primero (merge a `main` y despliegue), M3 después.**

- **Código viejo de `main` + M3** (el orden que NO): `main` no tiene agenda v2 y borra las citas con
  `DELETE` (`main:src/app/api/appointments/[id]/route.ts:1131`). Con M3, los disparadores de F5b
  actúan en todas las clínicas: borrar una cita con paciente daría un error (42501 → 500) en la app
  vieja, y mover una atendida con nota, también. Cancelar y mover lo demás seguiría funcionando.
- **Código nuevo + base sin M3**: nada cambia para nadie (§1.2). Puede durar lo que haga falta.
- **Código nuevo + M3**: lo previsto.

M3 se aplica sola con `aplicar.sh`: con M1 y M2 ya registradas, `aplicar` sólo ofrece M3. No usa
ningún objeto de M1 ni de M2 (sólo va detrás en el orden de archivos).

## 4. Deshacer

La reversa (`supabase/reversas/20261206120000_agenda_para_todos_reversa.sql`) devuelve el DEFAULT y
la función y quita el disparador. **No toca filas, así que por sí sola no apaga nada.** El guion
exige, para cualquier reversa de la agenda, la v2 apagada en todas las clínicas: deshacer M3 es
apagar primero (un `UPDATE` como postgres) y revertir después. Pasos en `ENSAYO.md`, §4.

## 5. Dimensión por dimensión (`supabase/AUDITORIA-MIGRACIONES.md`, 1 a 31)

| # | M3 |
|---|---|
| 1 Corre | Sí, local: con `supabase db reset --local` (17 migraciones) y con `aplicar.sh` sobre una base con datos |
| 2 Atomicidad | `BEGIN … COMMIT` propio; post-vuelo antes del `COMMIT`. Con `aplicar.sh` viaja en una petición |
| 3 Replay | Segunda pasada: ABORTA en el pre-vuelo sin cambiar nada (probado). Desde cero: va detrás de F1. Tras su reversa se puede volver a aplicar (probado) |
| 4 Orden de comprobaciones | Pre-vuelo antes de todo, con `RAISE EXCEPTION` |
| 5 / 18 Veredicto | Un solo `SELECT` final, 11 filas (8 OK y 3 INFO); nada detrás |
| 6 / 29 Bloqueos | `LOCK clinicas IN SHARE ROW EXCLUSIVE` (no bloquea lecturas; sí altas y cambios de clínica: el webhook de Stripe, el alta de clínica) y `ACCESS EXCLUSIVE` sobre `agenda_ajustes` (bloquea leer el interruptor: toda escritura de citas), los dos en el ÚLTIMO bloque `DO`; hasta el `COMMIT` quedan el post-vuelo y el `COMMIT` (2 sentencias). `lock_timeout` 5 s. **Sin medir con el RTT de Angel** |
| 7 Destructividad / reversa | No borra nada. Cambia el valor de `agenda_v2_encendida` de las filas en `false` (no queda respaldo del valor anterior salvo en `audit_log`, una fila UPDATE por cambio). Reversa escrita y ensayada en local (ida → reversa → ida); no devuelve las filas a `false` |
| 8 Constraints | No añade ninguna. El relleno escribe sólo `clinica_id`; el pre-vuelo aborta si hubiera otra columna NOT NULL sin DEFAULT |
| 9 Semántica | El valor escrito (`true`) es el que Angel decidió para todas. Lo que podría ser falso: una fila que alguien apagó A PROPÓSITO pasaría a `true`. Lo mira el conteo B.4 (**hueco: correrlo en producción**) |
| 10 Aislamiento | La función sigue INVOKER: con la sesión sólo ve la fila de su clínica; de otra clínica contesta lo mismo que para un uuid inexistente (`true`), antes `false`: en ninguno de los dos casos delata nada (ap1, caso 2). El disparador escribe sólo la fila de `NEW.id` |
| 11 Propiedad | Pre-vuelo: `current_user` es postgres o supabase_admin y dueño de `agenda_ajustes` y `clinicas` |
| 12 Ventana | §3: código primero, M3 después |
| 13 Afirmaciones | «`CREATE OR REPLACE FUNCTION` conserva dueño y privilegios»: documentación de PostgreSQL (CREATE FUNCTION, Notes) y comprobado en el post-vuelo (`has_function_privilege`). «El DELETE de `main` es real»: leído en `origin/main` |
| 15 Roles, en las dos direcciones | **Ganan:** nadie gana un privilegio. Todos los usuarios de todas las clínicas pasan a tener las funciones de la v2. **Pierden:** todos dejan de poder borrar citas con paciente (se cancelan); la sesión y `service_role` dejan de poder dar de alta una fila de `agenda_ajustes` sin decir el interruptor (nacería encendida: 42501; ningún código lo hace). Quien borre clínicas necesita borrar antes la fila |
| 16 Convenios | «Sin fila = encendida; sólo una fila con `false` apaga» va en `COMMENT ON COLUMN` y `COMMENT ON FUNCTION`. Lectores que asumían lo contrario: los tres de §1.3 (cambiados) y las ocho funciones de §1.1 (no se tocan: por eso la fila) |
| 17 Otros caminos | A `agenda_ajustes` se llega también por la sesión del administrador (`agenda_ajustes_insert`/`update`) y por `service_role`: los dos siguen pasando por `proteger_agenda_ajustes()`, sin tocar. La única DEFINER que escribe la tabla es la nueva, que no es RPC |
| 19 Recursión | No toca policies |
| 20 Permisos de fábrica | Función nueva: `REVOKE … FROM PUBLIC`, EXECUTE a los tres roles (regla del proyecto para funciones de disparador). Sin tablas nuevas |
| 21 Rendimiento | La función común hace la misma lectura por la clave única. El disparador de `clinicas` corre sólo al crear una clínica: medido en esta máquina (5 corridas de 300 altas como `service_role`), 0,10–0,12 ms por alta con él y 0,03–0,06 ms sin él; no toma ningún candado de tabla (inserta una fila y la FK toma el candado de fila de la clínica recién creada, en la misma transacción). El disparador de citas no cambia: medido en esta máquina, 300 operaciones × 3 corridas, ms por operación — sin M3: médico 1,07–1,35 · secretaria 1,46–2,20; con M3: médico 1,06–1,69 · secretaria 1,50–2,46 (el mismo intervalo; el código del disparador es idéntico) |
| 22 Conjunto | Reescribe UNA función de F1 (`agenda_v2_encendida`), partiendo de su cuerpo (el pre-vuelo exige su huella) y cambiando una palabra. No reescribe `proteger_agenda_ajustes()`. Va la última. La reversa de F1 se niega si sigue existiendo la función nueva (nombra `agenda_ajustes`): la de M3 va antes |
| 23 Prueba | `supabase/pruebas-sql/ap1_agenda_para_todos.sql`, 7 casos; corrida en local. Tres mutaciones comprobadas en ROJO y restauradas: `coalesce(…, false)` → caso 2; disparador deshabilitado → caso 0; función del disparador sin `EXCEPTION` → caso 5 |
| 24 DEFINER | `agenda_ajustes_de_clinica_nueva()`: `search_path = ''`, sin PUBLIC (post-vuelo) |
| 26 Otorgante | No revoca privilegios de tabla |
| 27 Contadores | No hay |
| 28 Pre-vuelos acotados | Miran sólo lo que M3 toca; la huella normaliza sólo los fines de línea (en producción 32 funciones tienen `\r\n`: **hueco — fila A.3 de los conteos**) |
| 30 FK a tabla multi-clínica | No hay FK nuevas |
| 31 Cadena de reversas | La de M3 va la PRIMERA; no se niega por datos. La guarda «v2 apagada en todas» del guion la para si no se apagó antes |
| 14 Otras | El disparador traga cualquier error con `WHEN OTHERS` (no atrapa `query_canceled`): una clínica puede nacer sin fila si el alta falla. Lo vigila la rejilla y el conteo; no hay tarea que lo repare sola |

## 6. Lo que NO quedó en cero

- **Ensayo sobre el clon de la foto de producción:** no hecho (no hay foto en este entorno).
- **Conteos de sólo lectura en producción:** los corre Angel (`correr-conteos-agenda-para-todos.sh`).
- **Auditoría independiente** (dimensión 25).
- **e2e:** ver el reporte de la entrega (qué se corrió y qué no).
- **`spinus-consola`:** no se ve desde aquí.
