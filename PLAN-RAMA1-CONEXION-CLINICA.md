# Plan — Rama 1: el camino de datos habla de clínica

> Texto entregado el 2026-08-16 en respuesta al brief de la Rama 1, y auditado
> tal cual. Ninguna línea de código se escribió al producirlo.
>
> **Actualizado el 2026-08-17, así que ya NO es el texto íntegro de aquel día.**
> La frase que había aquí decía «se guarda íntegro y sin editar» y dejó de ser
> cierta: este documento pasó de artefacto de auditoría a documento de trabajo
> del que se va a escribir código, y no puede describir un acceso que no existe.
>
> Qué cambió y por qué: el acceso a `private.google_conexiones_secretos` era
> imposible tal como estaba planteado —`service_role` no alcanza ese esquema— y
> se resolvió con un puente de tres funciones `SECURITY DEFINER` en `public`
> (`supabase/migrations/20260818_gcal_puente_secretos.sql`). Se corrigió sólo lo
> que describía el acceso viejo: la tabla de clientes de §1, §2.1, §2.2, §2.3,
> §2.5, §3.1 y las filas F1 y F3 de §4. Lo demás está como se entregó.
>
> **Donde este plan y `BRIEF-MIGRACION-PUENTE-SECRETOS.md` discrepen, manda el
> brief:** es la especificación del puente y está auditada.

Leí `CLAUDE.md` completo (y `AGENTS.md`). Sobre el módulo offline: lo viejo —`read-mirror`, `outbox-engine`, `useHybridQuery`, el SW de la app online— está muerto y no se revive; la app online no tiene capacidades offline; lo vivo es el Búnker aislado en `/public/bunker/` con SW de scope `/bunker/`, más `SessionGuard` y el cliente Supabase ya sin lógica offline.

Leí también el corte A aplicado, el archivo B pendiente, `src/lib/gcal.ts` entero y las seis rutas implicadas. **No toqué código.** Abajo va el plan, y arriba de todo lo que más importa: lo que comprobé falso.

---

# 0. Premisas del brief que comprobé falsas o incompletas

Esto va primero porque tres de ellas cambian el plan.

**0.1 — `gcal.ts:192` es correcto; `gcal.ts:317` NO es una escritura.** La escritura del comparar-y-cambiar de `crearCalendarioSpinus` está en `src/lib/gcal.ts:286-294`. La línea 317 es la RE-LECTURA posterior al fallo (`select('calendar_id')`) que decide si se perdió una carrera. El archivo B repite el mismo número en su comentario (`:317`). El inventario de cinco caminos es correcto —lo verifiqué con grep, no hay un sexto—, sólo el puntero está mal.

**0.2 — «El cliente admin se usa sólo para `private.google_conexiones_secretos`» es imposible tal como está escrito.** El corte A dejó `public.clinica_conexiones_google` con RLS activa, **una sola policy de SELECT y sin ninguna de escritura**, y además revocó `INSERT, UPDATE, DELETE` a `authenticated` (líneas 332-344 de la migración). Toda escritura de metadata —`calendar_id`, `estado`, el alta del callback, la baja del disconnect— **exige service role por construcción**. La regla que sí se puede cumplir, y la que propongo adoptar, es:

> el cliente de sesión hace **todas las lecturas** de `clinica_conexiones_google`, `appointments`, `profiles` y `clinicas`; el cliente admin toca **sólo la conexión**: los tokens —por las tres RPC del puente, nunca por la tabla—, las escrituras de metadata que la RLS prohíbe, y las escrituras de `appointments` dentro de `after()` que ya existen hoy.

Hay una segunda excepción forzada, menor, en §3.4 (leer el nombre del médico para crear un calendario dentro de `after()`). La marco ahí y ofrezco la alternativa.

**0.3 — «freebusy sigue amarrado a la sesión» no es «no tocar»: es código nuevo.** Hoy `consultarOcupado` corre **dentro** del callback de `conCalendarioSpinus` (`events/route.ts:136`) y usa el MISMO cliente de Google que `events.list`. En cuanto ese cliente pase a ser el de la conexión de la clínica, `freebusy` sobre `primary` consulta el calendario personal del administrador y se lo enseña a toda la clínica — exactamente la fuga que el brief quiere evitar, entrando por la puerta de al lado. Mantener el comportamiento descrito obliga a **abrir un segundo cliente de Google, el de la conexión propia de quien pregunta**, fuera del cuerpo que se reintenta. Con eso desaparece de paso la memoización de `ocupadoPromesa`, que existía sólo para no repetir freebusy en el reintento.

**0.4 — La intersección de H2 deja un payload que es 100% duplicado.** Si sólo se devuelve un evento cuando su id está en el conjunto de citas que la sesión lee bajo RLS, entonces **todo evento devuelto tiene una cita detrás**, y la agenda ya pinta esa cita desde `/api/appointments` (`agenda/page.tsx:1341-1372`). Cada cita saldría dos veces: una como cita y otra como bloque morado `gcal-<id>`. Peor: el conjunto de dedupe no conoce el filtro por médico, así que filtrar la agenda por un médico seguiría pintando las citas de los demás como bloques de Google, con el nombre del paciente en el título.

La intersección es la regla de seguridad correcta y va en el servidor. Pero su consecuencia real no es «se pierden los eventos crudos»: es que **el array `events` deja de tener sentido**. Lo honesto es intersecar en el servidor *y* que la agenda deje de pintar `data.events` (≈20 líneas en `gcalSource`). Eso toca `agenda/page.tsx`, fuera de tu lista: **necesito tu OK** (§4, F10).

**0.5 — El callback no tiene regla para decidir `rol`, y equivocarse es un 23505.** El índice único parcial deja como máximo una fila `rol='clinica'` por clínica. Hoy el callback hace `upsert` por `user_id` y ya está; bajo el modelo nuevo tiene que decidir si la conexión que nace es la de la clínica o una 'personal', y si decide mal, o si hay carrera, revienta con violación de índice dentro de un redirect. El brief no dice la regla. Propuesta en §2.5, y es la decisión abierta más importante.

**0.6 — Desconectar pasa a ser destructivo para toda la clínica y hoy no está gateado.** `DELETE /api/google/disconnect` no comprueba rol: borra la fila del usuario. Después del cambio, si apunta a la conexión de la clínica, un médico invitado entrando a `/perfil` (que sólo redirige a no-médicos) deja sin sincronización a todos. Hay que gatearlo. Propuesta en §3.3.

**0.7 — `appointments.gcal_calendar_id` se queda sin escritor.** El corte A la creó y la rellenó, pero ningún camino del brief la escribe: desde el deploy, toda cita nueva la tendría en NULL, justo la columna que existe para que la rama siguiente (`desvincularCitas`) deje de barrer a ciegas. El alta ya captura `calendarIdUsado`; añadirla al UPDATE del `after()` es **un campo más en un UPDATE que ya existe**. Recomiendo incluirlo; lo marco como añadido fuera del brief (§4, F7).

**0.8 — Comprobado y CORRECTO, no hay nada que arreglar:** las dos escrituras de `appointments` con cliente admin ya llevan `.eq('clinica_id', …)` capturado antes de responder (`appointments/route.ts:307`, `[id]/route.ts:346`), y `desvincularCitas` ya filtra por la `clinica_id` del perfil. La regla del pendiente prioritario ya se cumple en los caminos existentes.

**0.9 — Menor:** `events.list` va con `maxResults: 100` y sin paginación (`events/route.ts:144`). Con un calendario de clínica entera eso se rebasa fácil y hoy se perderían eventos en silencio. Con la intersección de H2 el impacto es nulo (lo que falta era duplicado), pero conviene que quede dicho antes de que alguien reintroduzca los renglones sombra.

**0.10 — Sin migración.** Confirmado: todo cabe en el esquema del corte A. `estado` ya existe para la señal de revocación (§5).

---

# 1. Cómo queda la resolución

**Archivo nuevo: `src/lib/gcalConexion.ts`.** Es el dueño único de la conexión: la resuelve y la escribe. No importa `googleapis` (eso sigue en `gcal.ts`), sólo Supabase y `encrypt`.

```ts
/** La conexión, SIN secretos. Sale de una lectura bajo RLS. */
export interface ConexionGoogle {
  id:          string
  clinicaId:   string
  userId:      string        // dueño de la cuenta de Google
  rol:         'clinica' | 'personal'
  calendarId:  string | null
  estado:      'activa' | 'revocada'
}

/** LA conexión de la clínica. Cero o una fila, garantizado por el índice único parcial. */
export function resolverConexionClinica(
  sesion: SupabaseClient, clinicaId: string,
): Promise<ConexionGoogle | null>

/** La conexión propia de quien pregunta. Sólo para freebusy sobre `primary`. */
export function resolverConexionPropia(
  sesion: SupabaseClient, clinicaId: string, userId: string,
): Promise<ConexionGoogle | null>
```

Las dos hacen `.eq('clinica_id', clinicaId)` **explícito** aunque la RLS ya lo imponga, y `.eq('estado','activa')`. `clinicaId` sale siempre de `profiles` de la sesión autenticada, nunca del body ni del query param.

**Qué consulta queda en qué cliente** (respuesta explícita a tu regla):

| Consulta | Cliente | Por qué |
|---|---|---|
| `clinica_conexiones_google` SELECT (ambos resolvedores) | **sesión** | la policy de SELECT del corte A lo permite |
| Tokens de la conexión (leer y escribir) | **admin, por RPC** | **La tabla `private.google_conexiones_secretos` NO se toca desde el código.** Se llaman las tres funciones del puente —`public.alta_conexion_google`, `public.guardar_secretos_conexion`, `public.leer_conexion_google_con_secretos`— con `.rpc()` desde `createAdminClient()`, sin `db: { schema }` y sin ninguna llamada `.schema(`. Motivo: **`service_role` no alcanza `private`** —un esquema nuevo no hereda nada de `pg_default_acl`, y `BYPASSRLS` actúa sobre el filtro de filas, después del chequeo de privilegios de esquema y tabla—. Esa denegación **es deliberada y se afirma en el veredicto** de `20260818_gcal_puente_secretos.sql` (R6): no se concede `USAGE ON SCHEMA private` a nadie. |
| `clinica_conexiones_google` INSERT/UPDATE/DELETE | **admin** *(forzado)* | sin policy de escritura y con grants revocados — ver §0.2 |
| `google_tokens` (espejo, mientras viva) | **admin** | mismo paso que la escritura nueva, sin depender de la RLS del actor |
| `profiles` (clinica_id del actor, validación de médico) | **sesión** | como hoy |
| `profiles` (nombre para bautizar un calendario nuevo) | **admin** *(excepción, §3.4)* | ocurre dentro de `after()`; filtrado por `id` **y** `clinica_id` |
| `appointments` SELECT (dedupe de H2, lectura de la cita) | **sesión** | la RLS ES el filtro de seguridad de H2 |
| `appointments` UPDATE en `after()` | **admin** | como hoy, con `.eq('clinica_id', …)` capturado antes de responder |
| `clinicas` (gate de suscripción) | **sesión** | como hoy, sin cambios |

**En `after()` no se resuelve nada.** El descriptor de conexión, la `clinica_id` y el `user_id` se capturan **antes de responder**, con el cliente de sesión, y viajan por closure. Dentro de `after()` sólo entra el cliente admin. Así la regla de las cookies se cumple sin discutir si `after()` conserva contexto.

---

# 2. La doble escritura, y cómo se hace imposible saltársela

## 2.1 Un solo dueño

Los cinco caminos de escritura dejan de escribir y la lectura de tokens deja de leer. Cada uno llama a una función del módulo, y esas funciones son las únicas del repo donde aparecen los nombres de las tres RPC y de las dos tablas:

| Camino de hoy | Pasa a llamar | Qué usa por debajo |
|---|---|---|
| `gcal.ts:158-162` (lectura de tokens) | `leerConexionConSecretos({ clinicaId, conexionId })` | RPC `public.leer_conexion_google_con_secretos` |
| `callback/route.ts:66` (upsert) | `altaConexion({ userId, clinicaId, rol, cuenta, tokens })` | RPC `public.alta_conexion_google` — metadata **y** secretos en una sola transacción, para que no pueda nacer una conexión sin tokens |
| `gcal.ts:192` (refresh) | `guardarSecretos({ clinicaId, conexion, accessToken, expiresAt })` | RPC `public.guardar_secretos_conexion` |
| `gcal.ts:286-294` (CAS) | `guardarCalendarIdSiEsperado({ conexion, nuevo, esperado })` | `clinica_conexiones_google` por PostgREST con admin: es metadata, no secreto, y no necesita puente |
| `calendar/route.ts:152` (soltar) | `guardarCalendarIdSiEsperado({ …, nuevo: null, esperado: anterior })` | ídem |
| `disconnect/route.ts:9` (borrar) | `borrarConexion({ conexion })` | `DELETE` sobre `clinica_conexiones_google` por PostgREST; los secretos caen solos por el `ON DELETE CASCADE`, que corre como acción de integridad referencial y no pide privilegios sobre `private` |

**El `refresh_token` no se pasa en el refresco.** `guardar_secretos_conexion` hace `COALESCE` sobre esa columna: `NULL` significa «no lo toques», nunca «bórralo». No hay ningún caso legítimo de ponerlo a `NULL` —el único borrado legítimo es el de la conexión entera— y el modo de fallo contrario sería indistinguible de una revocación real. Ver el brief §2.2.

## 2.2 Cómo se hace imposible añadir un sexto sin doble escritura

Tu instinto es el correcto y lo adopto, pero un módulo por convención se salta solo. Le pongo un cerrojo que no cuesta dependencias nuevas: **una prueba de Vitest que recorre `src/` y falla si alguno de estos seis literales aparece fuera de `src/lib/gcalConexion.ts`.** Un camino nuevo que escriba directo no saca un PR verde.

- `alta_conexion_google`
- `guardar_secretos_conexion`
- `leer_conexion_google_con_secretos`
- `clinica_conexiones_google`
- `google_tokens`
- `google_conexiones_secretos`

**Los tres primeros son la mitad que importa ahora y no estaban en la versión de este plan del día 16.** Con el puente, el nombre de la tabla de secretos no vuelve a aparecer en `src/` nunca —el código llama a un RPC—, así que un cerrojo que sólo vigilara nombres de tabla quedaría medio vacío dando sensación de cobertura, y cualquier archivo podría llamar a `leer_conexion_google_con_secretos` sin que nada chistara. El sexto se conserva aunque ya no deba aparecer en ningún sitio: cuesta una línea y atrapa a quien intente `admin.schema('private')`.

Descarto la alternativa de un tipo *branded* que sólo el resolvedor pueda producir: es abstracción especulativa (Protocolo 4) y no impide llamar al RPC a mano, que es el riesgo real.

## 2.3 El contrato del archivo B, cumplido a la letra

- `guardarSecretos` escribe `access_token` **y** `expires_at` en la misma llamada, en las dos fuentes. No existe firma que permita mover uno sin el otro: el RPC `guardar_secretos_conexion` los recibe juntos y los escribe juntos.
- `guardarCalendarIdSiEsperado` es el único camino a `calendar_id`, y escribe en las dos.
- **Se cifra UNA vez y se escribe el MISMO string en ambas.** El archivo B acepta las dos formas, pero así su columna informativa `secretos_byte_identicos` sale igual a `conexiones` y la comprobación queda maximalmente verificable en vez de ciega por el IV aleatorio.

## 2.4 Qué pasa si una de las dos falla

Orden fijo: **primero la fuente nueva** (es la que se queda), después el espejo.

- **Falla la nueva:** se aborta la operación y no se toca el espejo. El resultado de cara al médico es el de hoy cuando falla el guardado, y no se crea divergencia en la dirección que el archivo B no sabe reparar.
- **Falla el espejo (nueva OK):** se sigue adelante y se registra con una operación distintiva —`doble_escritura_espejo` en `registrarFalloGCal`— para que sea greppable. Lo que queda es divergencia de `expires_at` o `calendar_id`, y **el archivo B aborta sobre eso** con el `user_id` en el mensaje. Esa es la red, y es el motivo de que exista.
- **Disconnect:** se borra primero la conexión nueva; si el borrado del espejo falla, queda una fila en `google_tokens` sin conexión y el archivo B aborta por 2.1 («tokens sin conexión»). Ruidoso y correcto.
- **No hay transacción posible** entre las dos: son dos tablas por PostgREST y meterlas en una RPC sería una migración, que este brief prohíbe. La secuencia + el guardián del archivo B es la garantía disponible, y lo digo sin adornarlo.
- **Despliegue rodante** (instancias vieja y nueva sirviendo a la vez): la vieja refresca tokens escribiendo sólo `google_tokens` → divergencia de `expires_at` → el archivo B aborta. Se repara solo con el primer refresh que pase por el código nuevo, o a mano.

## 2.5 Decisión abierta: qué `rol` nace en el callback

Propuesta (necesito tu OK, §4 F1):

1. **`/api/google/connect` y el callback se gatean con `canManageClinica`.** El corte A lo dice explícitamente: los médicos invitados no van a poder conectar. Sin este gate, un invitado crea una conexión 'personal' que no sirve para nada y confunde el estado.
2. La conexión nace con `rol='clinica'`. Si otra cuenta ya es la de la clínica: **no se degrada a 'personal' en silencio**, se redirige con `?gcal_error=clinica_ya_conectada`. El relevo de administrador es un flujo consciente, no un efecto colateral de un botón de conectar.

   Con el puente, el callback ya no tiene que reconocer un 23505 crudo: `alta_conexion_google` lo hace por él. Comprueba el caso antes de escribir y, si aun así el índice único parcial dispara por una carrera, reetiqueta la violación con el mismo nombre. **El callback tiene un solo literal que reconocer, no un código de error de Postgres.**

   Y tiene que reconocer **dos**, no uno. El segundo es `rol_no_promovido`, que es el relevo de administrador visto desde el otro lado: la cuenta entrante ya tiene una conexión `'personal'`, reconectar **no** la promueve —el `ON CONFLICT … DO UPDATE` no toca `rol`, a propósito—, y sin ese error la clínica se quedaría con cero conexiones de clínica y las citas dejarían de sincronizarse en silencio. Va a `?gcal_error=rol_no_promovido`, y la salida para el médico es desconectar la conexión anterior antes de conectar. Ver el brief §4, fila A5.
3. Reconectar **el mismo** `user_id` actualiza su fila (incluido `estado='activa'`), que es lo que ya hace el `upsert` por `user_id` hoy.

---

# 3. Qué le pasa a `conCalendarioSpinus` y a sus hermanas

## 3.1 `abrirSesionGoogle` (privada, `gcal.ts:154`)
Firma: `(conexion: ConexionGoogle, admin) => { calendar, calendarId } | null`. Lee los secretos **por RPC** (`leerConexionConSecretos`, con `clinicaId` y `conexionId`), refresca si toca y **guarda vía módulo**. Deja de recibir `userId` y deja de leer `google_tokens`.

**Y deja de devolver `null` cuando el problema son los secretos.** Hoy `gcal.ts:158-163` descarta el `error` de la consulta y contesta `null`, que aguas arriba se lee como «este médico nunca conectó»; con el puente, esa misma rama se tragaría un `PGRST202`, un `42501` o un dueño equivocado. Las tres respuestas anómalas del RPC —`error` no nulo, **0 filas**, o **`tiene_secretos = false`**— van a `registrarFalloGCal` con operación distinguible y **`throw`**. El único `null` que sobrevive es «no hay conexión», y ese lo decide el resolvedor bajo RLS antes de llamar aquí. Brief §4, fila A2, y la tabla de las tres lecturas en su §2.3.

## 3.2 `getGCalClient` (`gcal.ts:217`)
Igual, sobre `ConexionGoogle`. Sus dos llamadores están en `calendar/route.ts` (GET del perfil y POST de recrear) y pasan a resolver la conexión **de la clínica**.

## 3.3 `desvincularCitas` (`gcal.ts:385`) — **no se toca, y hay que decir qué queda mal**
Se le sigue pasando un `userId`, que ahora será `conexion.userId` (el administrador). Su ámbito —«citas de ese médico más las que no tienen médico»— pasa a ser **incorrecto** bajo un calendario de clínica: lo correcto sería «las citas cuyo `gcal_calendar_id` es el del calendario que murió», que es justo para lo que se creó la columna. Lo dejo así porque me pediste que fuera sola en la rama siguiente, pero **la consecuencia es que, tras un 404 del calendario de la clínica, las citas de los demás médicos quedan apuntando a eventos muertos**. Es raro (exige que el administrador borre el calendario a mano) y es exactamente el trabajo de la rama siguiente. Va comentado en el código con esa frase.

## 3.4 `crearCalendarioSpinus` (`gcal.ts:243`)
El CAS pasa al módulo (`guardarCalendarIdSiEsperado`), que hace el comparar-y-cambiar **sobre la fuente nueva** (`id = conexion.id`, `.is/.eq('calendar_id', esperado)`, con `.select()` para enterarse de los cero renglones) y **espeja el valor ganador** al legado por `user_id` sin CAS. La re-lectura de desempate (`:316`) también pasa a la fuente nueva. El resto de la función —crear en Google, borrar el huérfano, adoptar el del ganador— no cambia.

El nombre del calendario sale del perfil de `conexion.userId` (el dueño de la cuenta de Google), o sea el mismo texto que hoy: «Spinus - Dr. Fulano». **No propongo renombrarlo a la clínica en esta rama**; el calendario vive en esa cuenta de Google y el nombre sigue siendo cierto.

**Excepción de cliente que necesito que apruebes:** esa lectura de `profiles` ocurre dentro de `after()` cuando hay que crear un calendario, y con la regla de las cookies no puedo usar el cliente de sesión ahí. Dos salidas: (a) leer `profiles` con admin filtrando por `id = conexion.userId` **y** `clinica_id` (una consulta, rara, acotada); (b) pre-resolver el nombre antes de responder en cada alta de cita, pagando un SELECT extra en el 99,9% de los casos en que no hay nada que crear. **Recomiendo (a)**, documentada en el módulo.

## 3.5 `calendarioVive` (`gcal.ts:348`)
Sin cambios. Es Google puro, no toca la base.

## 3.6 `conCalendarioSpinus` (`gcal.ts:427`)
Firma nueva: `(conexion: ConexionGoogle, admin, operacion) => T | null`. Devuelve `null` cuando `conexion` es null (la clínica no tiene conexión activa) exactamente como hoy devolvía null sin token, así que los seis llamadores conservan su semántica de «null = nada que sincronizar». `registrarFalloGCal` gana un `conexionId` opcional en el contexto, conservando `userId` = quien ejecuta la acción (que es lo que sirve para diagnosticar).

---

# 4. Archivos y líneas que cambian

| # | Archivo | Qué cambia |
|---|---|---|
| F1 | `src/lib/gcalConexion.ts` **(nuevo)** | resolvedores + la lectura de tokens + las 5 escrituras con doble escritura. Las tres que tocan secretos van por RPC (`alta_conexion_google`, `guardar_secretos_conexion`, `leer_conexion_google_con_secretos`); las de metadata, por PostgREST con admin. Único sitio del repo donde aparecen esos seis literales (§2.2). ~180 líneas, ninguna función >50 (Protocolo 3) |
| F2 | `src/lib/gcal.ts` | `abrirSesionGoogle` :154-211 sobre conexión; refresh :192 al módulo; CAS :286-294 y re-lectura :316-320 al módulo; `getGCalClient` :217; `conCalendarioSpinus` :427-453 firma; `desvincularCitas` :385 **sólo comentario**; marcado `estado='revocada'` (§5) |
| F3 | `src/app/api/google/callback/route.ts` | gate `canManageClinica`; upsert :66-71 → `altaConexion` (**una** llamada: metadata y secretos van juntos, ya no son un INSERT más un RPC); lectura de `calendar_id` :101-105 → resolvedor; traduce los **dos** errores con nombre del alta → `?gcal_error=clinica_ya_conectada` y `?gcal_error=rol_no_promovido` (§2.5) |
| F4 | `src/app/api/google/calendar/route.ts` | `calendarioRegistrado` :26-36 → resolvedor; GET :64 y POST :112 sobre la conexión de la clínica; `update(calendar_id=null)` :152-155 → módulo |
| F5 | `src/app/api/google/disconnect/route.ts` | gate `canManageClinica`; delete :9 → `borrarConexion` sobre la conexión de la clínica |
| F6 | `src/app/api/google/events/route.ts` | `estadoDeFallo` :22-41 por clínica; `consultarOcupado` :54-94 con **cliente propio** fuera del reintento; dedupe :162-168 **intersección** + `.eq('clinica_id')`; lista blanca en :170-176 |
| F7 | `src/app/api/appointments/route.ts` | conexión resuelta antes de responder; `after()` :263-314 con la conexión; veredicto :325-333 por clínica; **`gcal_calendar_id: calendarIdUsado` en el UPDATE :303-307** (añadido §0.7) |
| F8 | `src/app/api/appointments/[id]/route.ts` | ídem para PUT (`after()` :295-353, veredicto :361-369) y DELETE (`after()` :412-428) |
| F9 | `src/app/api/google/connect/route.ts` | sólo si apruebas el gate de F1/§2.5 |
| F10 | `src/app/(app)/agenda/page.tsx` | `gcalSource` :1385-1440 deja de pintar `data.events` (sigue pintando `ocupado`). **Fuera de tu lista: necesito OK** |
| F11 | `src/lib/__tests__/gcalConexion.test.ts` **(nuevo)** | el cerrojo de §2.2 |

Son 11 archivos. Muy por encima del umbral del Protocolo 3, y por eso esto es un plan y no un parche.

---

# 5. Los tres estados, y la señal de revocación

Sí conviene distinguirlo, y sale gratis porque el corte A ya dejó la columna.

**La señal es `invalid_grant` al refrescar**, que `esCredencialInvalida` (`gcal.ts:71`) ya sabe reconocer y que hoy sólo se usa para pintar. Propuesta: en el `catch` del refresh de `abrirSesionGoogle` (`gcal.ts:185-191`), si `esCredencialInvalida(err)`, escribir `estado='revocada'` en la conexión (vía módulo, cliente admin) antes de relanzar. `google_tokens` no tiene columna equivalente, así que no hay espejo y el archivo B no compara `estado`: la doble escritura no se ve afectada.

Con eso, los resolvedores filtran por `estado='activa'` y **«conectado» deja de significar «existe una fila»**: significa «hay una conexión que la última vez que se usó seguía sirviendo». Los tres sitios se vuelven una sola pregunta —¿hay conexión de clínica activa?— resuelta con el cliente de sesión:

- `appointments/route.ts:325-329` → `'pending'` si la resolución (ya hecha antes de responder) no es null, `'disconnected'` si lo es.
- `[id]/route.ts:363-368` → igual.
- `events/route.ts:32-36` (`estadoDeFallo`) → `'error_google'` si hay conexión activa, `'sin_token'` si no. El atajo de `esCredencialInvalida` que ya tiene arriba se queda: cubre el caso de la misma petición que acaba de descubrir la revocación.

Reconectar pone `estado='activa'` (§2.5, punto 3). Ojo con el matiz que esto crea y hay que aceptar: una conexión de clínica revocada **sigue ocupando el índice único parcial**, así que otro administrador no puede conectar encima; tiene que desconectar primero. Es coherente con «el relevo es un flujo consciente».

---

# 6. Los commits, en orden

El orden **no es negociable** por lo que explico en §7: el endurecimiento de `/api/google/events` tiene que ir **antes** del cambio de resolución.

1. **`feat(gcal): módulo dueño de la conexión de Google por clínica`** — F1 + tests unitarios del módulo. Inerte: nadie lo llama, producción no cambia.
2. **`fix(gcal): endurecer /api/google/events antes del cambio de resolución`** — F6 (intersección + lista blanca + freebusy con conexión propia) y F10. Seguro antes del cambio: hoy `events.list` lee el calendario del propio médico, así que la única consecuencia visible es que la agenda deja de pintar eventos que ya pintaba como citas.
3. **`feat(gcal): resolver la conexión por clínica y escribir en las dos fuentes`** — F2 + F3 + F4 + F5 (+F9). **Este commit es indivisible**: si el alta escribe en el calendario de la clínica y la baja borra del calendario del actor, se rompen los dos.
4. **`fix(gcal): resolver 'disconnected' por clínica`** — F7 + F8 (veredictos, `after()` sobre la conexión y el estampado de `gcal_calendar_id`).
5. **`test(gcal): prohibir escrituras de conexión fuera del módulo`** — F11. Va al final porque hasta aquí la prueba no puede pasar; a partir de aquí, cierra la puerta.

---

# 7. Qué se rompe si el deploy sale a medias

Vercel despliega un commit entero, así que «a medias» es: (a) parte de la serie desplegada, o (b) despliegue rodante con dos versiones sirviendo a la vez.

- **Sólo 1:** nada. Código muerto.
- **1-2 sin 3:** la agenda pierde los eventos de Google que no son citas (la consecuencia ya aceptada) y los bloques de «Ocupado» pasan a resolverse por conexión propia — mismo resultado que hoy, porque hoy la conexión propia es la única que hay. **Sin fuga.**
- **3 sin 2 — ESTE ES EL PELIGROSO, y por eso el orden.** La resolución pasa a la clínica y `events.list` devuelve el calendario entero **restando** en vez de intersecando: a cada médico invitado se le pintan las citas de sus colegas con el nombre del paciente en el título, y `freebusy` le enseña la disponibilidad del calendario personal del administrador. Fuga de datos de pacientes entre médicos de la misma clínica. **El commit 2 nunca puede quedar detrás del 3.**
- **3 sin 4:** cosmético. La secretaria ve «Google desconectado» mientras la cita sí llegó al calendario — exactamente el defecto que el brief describe, un deploy más. Y las citas nuevas nacen con `gcal_calendar_id` en NULL, que es el estado de hoy.
- **4 sin 5:** nada; falta el cerrojo, no la función.
- **Rodante (vieja + nueva a la vez):** el alta de una cita puede ir al calendario del actor (instancia vieja) o al de la clínica (nueva) según a quién le toque; con una sola conexión, hoy, son el mismo calendario y no se nota. Lo que sí queda es que la instancia vieja refresque tokens escribiendo sólo `google_tokens` → divergencia de `expires_at` → **el archivo B aborta**, que es el comportamiento correcto: no se corta la fuente vieja hasta que la doble escritura lleve un rato limpia. Se repara con el primer refresh que pase por el código nuevo.
- **Migración A sin código:** inocuo por diseño (aditivo puro). **Código sin migración A:** no aplica, ya está en producción.

---

## Lo que necesito de ti antes de escribir una línea

1. **§2.5** — ¿gate `canManageClinica` en connect/callback, y 23505 → error explícito en vez de degradar a 'personal'?
2. **§0.4 / F10** — ¿autorizas tocar `agenda/page.tsx` para dejar de pintar `data.events`? Si no, la intersección deja cada cita duplicada en pantalla.
3. **§0.7 / F7** — ¿estampo `gcal_calendar_id` en el `after()` del alta? Es un campo en un UPDATE que ya existe, y sin él la rama siguiente nace sin datos.
4. **§3.4** — ¿apruebas la lectura de `profiles` con cliente admin (filtrada por `id` **y** `clinica_id`) para bautizar un calendario nuevo dentro de `after()`?
5. **§0.6 / F5** — ¿desconectar queda gateado a `canManageClinica` sobre la conexión de la clínica?
6. **Fuera del brief, no lo incluyo salvo que lo pidas:** los scopes `openid`/`email` en `/api/google/connect`. Sin ellos, `google_account_sub` y `google_account_email` se quedan en NULL para siempre y el 404 nunca se podrá desambiguar — que es una de las tres razones por las que existe el corte A.
