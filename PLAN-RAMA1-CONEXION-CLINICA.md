# Plan — Rama 1: el camino de datos habla de clínica

> Texto entregado el 2026-08-16 en respuesta al brief de la Rama 1, y auditado
> tal cual. Ninguna línea de código se escribió al producirlo.
>
> **Actualizado el 2026-08-17, así que ya NO es el texto íntegro de aquel día.**
> La frase que había aquí decía «se guarda íntegro y sin editar» y dejó de ser
> cierta: este documento pasó de artefacto de auditoría a documento de trabajo
> del que se va a escribir código, y no puede describir un acceso que no existe.
>
> **Dos tandas de cambios, las dos del 2026-08-17:**
>
> 1. **El puente.** El acceso a `private.google_conexiones_secretos` era
>    imposible tal como estaba planteado —`service_role` no alcanza ese
>    esquema— y se resolvió con tres funciones `SECURITY DEFINER` en `public`
>    (`supabase/migrations/20260818_gcal_puente_secretos.sql`). Tocó la tabla de
>    clientes de §1, §2.1, §2.2, §2.3, §2.5, §3.1 y las filas F1 y F3.
> 2. **Los diez hallazgos que quedaron sueltos.** La auditoría de este plan
>    devolvió catorce; sólo se había absorbido el primero, porque en cuanto
>    apareció el bloqueante nos fuimos al puente y no volvimos. **§10 lleva la
>    tabla de los catorce y dónde quedó cada uno.** Los dos que cambian la forma
>    de la rama son **H2** (§3.3, reescrita entera: el modo estricto) y **H3**
>    (§6: F7 y F8 se funden en el commit 3, porque la serie no compilaba).
>    Secciones nuevas: §2.6, §2.7, §8, §9, §10 y §11.
>
> Las seis preguntas del final dejaron de ser preguntas: **§11 son decisiones
> tomadas.**
>
> **PLAN CERRADO el 2026-08-17.** Cero preguntas abiertas, catorce hallazgos
> absorbidos o resueltos (§10). Lo que sigue es escribir el código en el orden
> de §6.
>
> **Donde este plan y `BRIEF-MIGRACION-PUENTE-SECRETOS.md` discrepen, manda el
> brief:** es la especificación del puente y está auditada.
>
> ---
>
> ## ⚠ LEE §12 ANTES DE ESCRIBIR CÓDIGO (añadido el 2026-08-19)
>
> Después de cerrarse este plan se tomaron **decisiones de producto** que cambian
> qué hay que construir. Viven en **§12**, al final del documento, y **mandan
> sobre lo que diga el cuerpo del plan** allí donde se contradigan.
>
> No están fundidas en el texto a propósito: la convención del repositorio es
> anotar, no enmendar. Las secciones afectadas llevan su anotación en el sitio
> —§0.3, §0.4, §0.9, §0.10, la tabla de §4, el commit 2 de §6, §7, §9 y §11— y
> todas apuntan a §12.
>
> **Si empiezas por §6 sin haber leído §12, vas a construir la ruta de eventos al
> revés de lo que se quiere.**

Leí `CLAUDE.md` completo (y `AGENTS.md`). Sobre el módulo offline: lo viejo —`read-mirror`, `outbox-engine`, `useHybridQuery`, el SW de la app online— está muerto y no se revive; la app online no tiene capacidades offline; lo vivo es el Búnker aislado en `/public/bunker/` con SW de scope `/bunker/`, más `SessionGuard` y el cliente Supabase ya sin lógica offline.

Leí también el corte A aplicado, el archivo B pendiente, `src/lib/gcal.ts` entero y las seis rutas implicadas. **No toqué código.** Abajo va el plan, y arriba de todo lo que más importa: lo que comprobé falso.

---

# 0. Premisas del brief que comprobé falsas o incompletas

Esto va primero porque tres de ellas cambian el plan.

**0.1 — `gcal.ts:192` es correcto; `gcal.ts:317` NO es una escritura.** La escritura del comparar-y-cambiar de `crearCalendarioSpinus` está en `src/lib/gcal.ts:286-294`. La línea 317 es la RE-LECTURA posterior al fallo (`select('calendar_id')`) que decide si se perdió una carrera. El archivo B repite el mismo número en su comentario (`:317`). El inventario de cinco caminos es correcto —lo verifiqué con grep, no hay un sexto—, sólo el puntero está mal.

**0.2 — «El cliente admin se usa sólo para `private.google_conexiones_secretos`» es imposible tal como está escrito.** El corte A dejó `public.clinica_conexiones_google` con RLS activa, **una sola policy de SELECT y sin ninguna de escritura**, y además revocó `INSERT, UPDATE, DELETE` a `authenticated` (líneas 332-344 de la migración). Toda escritura de metadata —`calendar_id`, `estado`, el alta del callback, la baja del disconnect— **exige service role por construcción**. La regla que sí se puede cumplir, y la que propongo adoptar, es:

> el cliente de sesión hace **todas las lecturas** de `clinica_conexiones_google`, `appointments`, `profiles` y `clinicas`; el cliente admin toca **sólo la conexión**: los tokens —por las tres RPC del puente, nunca por la tabla—, las escrituras de metadata que la RLS prohíbe, y las escrituras de `appointments` dentro de `after()` que ya existen hoy.

> **RESUELTO ASÍ** (2026-08-17): la regla se adoptó, y el «los secretos» de la
> versión original pasó a ser «los tokens, por las tres RPC del puente». El
> detalle, en la tabla de §1 y en §2.1; las decisiones del callback, en §2.5.

Hay una segunda excepción forzada, menor, en §3.4 (leer el nombre del médico para crear un calendario dentro de `after()`). La marco ahí y ofrezco la alternativa.

**0.3 — «freebusy sigue amarrado a la sesión» no es «no tocar»: es código nuevo.** Hoy `consultarOcupado` corre **dentro** del callback de `conCalendarioSpinus` (`events/route.ts:136`) y usa el MISMO cliente de Google que `events.list`. En cuanto ese cliente pase a ser el de la conexión de la clínica, `freebusy` sobre `primary` consulta el calendario personal del administrador y se lo enseña a toda la clínica — exactamente la fuga que el brief quiere evitar, entrando por la puerta de al lado. Mantener el comportamiento descrito obliga a **abrir un segundo cliente de Google, el de la conexión propia de quien pregunta**, fuera del cuerpo que se reintenta. Con eso desaparece de paso la memoización de `ocupadoPromesa`, que existía sólo para no repetir freebusy en el reintento.

> **⚠ ANOTACIÓN 2026-08-19 — §0.3 entera queda SIN EFECTO.** `freebusy` se
> elimina por completo (§12.6), así que no hay segundo cliente que abrir ni
> bloques de «Ocupado» que preservar. El análisis de arriba era correcto y sigue
> siéndolo: describe el riesgo real de mantener `freebusy` bajo un calendario de
> clínica. Lo que cambió es que ese riesgo se retira quitando la función, no
> conteniéndola. **La memoización de `ocupadoPromesa` sí desaparece, como decía
> este apartado, sólo que por otro motivo.**

**Añadido al absorber H8:** hay un efecto lateral que el texto original no vio. Hoy el GET sólo devuelve `ocupado` cuando hay calendario de clínica resuelto (`events/route.ts:153-155`), porque los bloques viajan dentro de la misma respuesta que los eventos. Al separar los dos clientes eso deja de tener sentido: los bloques de «Ocupado» de una persona **no dependen de la conexión de la clínica**, así que un administrador cuya conexión de clínica falte perdería también sus propios bloques sin motivo. `ocupado` se resuelve y se devuelve **al margen** de que la conexión de clínica exista o no.

**0.4 — La intersección de H2 deja un payload que es 100% duplicado.** Si sólo se devuelve un evento cuando su id está en el conjunto de citas que la sesión lee bajo RLS, entonces **todo evento devuelto tiene una cita detrás**, y la agenda ya pinta esa cita desde `/api/appointments` (`agenda/page.tsx:1341-1372`). Cada cita saldría dos veces: una como cita y otra como bloque morado `gcal-<id>`. Peor: el conjunto de dedupe no conoce el filtro por médico, así que filtrar la agenda por un médico seguiría pintando las citas de los demás como bloques de Google, con el nombre del paciente en el título.

La intersección es la regla de seguridad correcta y va en el servidor. Pero su consecuencia real no es «se pierden los eventos crudos»: es que **el array `events` deja de tener sentido**. Lo honesto es intersecar en el servidor *y* que la agenda deje de pintar `data.events` (≈20 líneas en `gcalSource`). Eso toca `agenda/page.tsx`, fuera de la lista original: **aprobado** (§4, F10, y el cierre de decisiones).

**Precisión al absorber H2, y es peor de lo que este apartado decía.** El dedupe de hoy no es neutro: **agrava**. `yaSonCitas` (`events/route.ts:162-168`) se construye con las citas que la SESIÓN lee bajo RLS, y para un médico invitado eso es sólo lo suyo —`(medico_id = auth.uid() OR get_my_role() = 'secretaria') AND clinica_id = …`, `20260530_etapa5h_paso3_policies_appointments.sql:82-96`—. O sea que las citas de sus colegas **no se restan**: salen como eventos crudos de Google, y el título los lleva con nombre y apellidos del paciente (`tituloParaGoogle`, `src/lib/appointments.ts`). Restar lo propio de un calendario de clínica entera es exactamente el mecanismo que enseña lo ajeno. Por eso la intersección no es una mejora de limpieza: es la contención.

> **⚠ ANOTACIÓN 2026-08-19 — la intersección queda DESCARTADA como mecanismo, y
> este apartado es el que más engaña si se lee suelto.**
>
> El diagnóstico de §0.4 es correcto: restar lo propio de un calendario de clínica
> entera es lo que enseña lo ajeno. **La cura que propone, no.** La intersección
> devolvería sólo eventos que tienen cita detrás, y eso **borra exactamente los
> eventos que el producto exige conservar**: los que el administrador escribe a
> mano dentro del calendario de Spinus, que no tienen cita y tienen que seguir
> viéndose en la agenda (§12.1).
>
> **El mecanismo correcto es la RESTA, acotada por capacidad.** La fuga no venía
> de restar: venía de restar con un conjunto RLS parcial. El administrador y la
> secretaria leen **todas** las citas de la clínica, así que para ellos la resta
> deja exactamente los eventos escritos a mano y nada más — sin fuga posible. El
> médico invitado no entra en esta ruta: recibe vacío (§12.1).
>
> Cae con esto la premisa de que «cada cita saldría dos veces»: bajo la resta las
> citas se quitan, que es justo lo que hace la resta.

**0.5 — El callback no tiene regla para decidir `rol`, y equivocarse es un 23505.** El índice único parcial deja como máximo una fila `rol='clinica'` por clínica. Hoy el callback hace `upsert` por `user_id` y ya está; bajo el modelo nuevo tiene que decidir si la conexión que nace es la de la clínica o una 'personal', y si decide mal, o si hay carrera, revienta con violación de índice dentro de un redirect. El brief no dice la regla.

**RESUELTO ASÍ** (2026-08-17): la regla está en §2.5 y ya no es una propuesta, es una decisión tomada. Y el 23505 crudo dejó de ser problema del callback: `alta_conexion_google` comprueba el caso antes de escribir y reetiqueta la violación de índice si la carrera se cuela, así que lo que llega arriba es un literal estable y no un código de Postgres. Hay un segundo error que traducir —`rol_no_promovido`—; también en §2.5.

**0.6 — Desconectar pasa a ser destructivo para toda la clínica y hoy no está gateado.** `DELETE /api/google/disconnect` no comprueba rol: borra la fila del usuario. Después del cambio, si apunta a la conexión de la clínica, un médico invitado entrando a `/perfil` (que sólo redirige a no-médicos) deja sin sincronización a todos. Hay que gatearlo. Propuesta en §3.3.

**0.7 — `appointments.gcal_calendar_id` se queda sin escritor.** El corte A la creó y la rellenó, pero ningún camino del brief la escribe: desde el deploy, toda cita nueva la tendría en NULL, justo la columna que existe para que la rama siguiente (`desvincularCitas`) deje de barrer a ciegas. El alta ya captura `calendarIdUsado`; añadirla al UPDATE del `after()` es **un campo más en un UPDATE que ya existe**. Recomiendo incluirlo; lo marco como añadido fuera del brief (§4, F7).

**0.8 — Comprobado y CORRECTO, no hay nada que arreglar:** las dos escrituras de `appointments` con cliente admin ya llevan `.eq('clinica_id', …)` capturado antes de responder (`appointments/route.ts:307`, `[id]/route.ts:346`), y `desvincularCitas` ya filtra por la `clinica_id` del perfil. La regla del pendiente prioritario ya se cumple en los caminos existentes.

**0.9 — Menor:** `events.list` va con `maxResults: 100` y sin paginación (`events/route.ts:144`). Con un calendario de clínica entera eso se rebasa fácil y hoy se perderían eventos en silencio. Con la intersección de H2 el impacto es nulo (lo que falta era duplicado), pero conviene que quede dicho antes de que alguien reintroduzca los renglones sombra.

> **⚠ ANOTACIÓN 2026-08-19 — esto deja de ser menor.** El «impacto nulo» dependía
> de la intersección, y la intersección está descartada (anotación de §0.4). Bajo
> la resta acotada por capacidad, lo que sobrevive al filtro son precisamente los
> eventos escritos a mano (§12.1), que **no** son duplicados de nada: si el rango
> consultado tiene más de 100 eventos, el evento escrito a mano número 101
> desaparece de la agenda **sin un solo aviso**, y el administrador no tiene por
> dónde enterarse.
>
> Los renglones sombra ya no son una amenaza futura: el camino de vuelta no se
> construye (§12.2). El techo de `maxResults` sí lo es. **Queda como asunto
> abierto en §12.12; no está decidido si se arregla en el commit 2 o después.**

**0.10 — Sin migración.** Confirmado: todo cabe en el esquema del corte A. `estado` ya existe para la señal de revocación (§5).

> **⚠ ANOTACIÓN 2026-08-19 — sigue siendo cierto para lo que este plan describe, y
> dos decisiones nuevas lo desbordan.** El permiso de escritura en la agenda
> (§12.7) necesita columna en `profiles`, entrada en el trigger guardián y cambio
> de policy en `appointments`; el «no mostrar más» de los avisos (§12.10)
> necesitaría columna si se guarda en la base. **No está dicho si esas dos
> pertenecen a esta rama o a la siguiente** — ver §12.12.

> **⚠ SEGUNDA ANOTACIÓN 2026-08-20 — «Sin migración» YA NO ES CIERTO. Resuelto.**
> Las decisiones de §12.7 y §12.10 **son de esta rama** (§12.12.1), y con §12.13 y
> §12.14 la cuenta sube a **cuatro migraciones**, con una quinta condicionada.
> El listado operativo está en **§12.15**.
>
> El titular de este apartado —«todo cabe en el esquema del corte A»— sigue siendo
> **cierto para lo que este plan describía**: la conexión por clínica no pide
> esquema nuevo. Lo que lo desborda es producto que llegó después, no un error de
> §0.10.
>
> **Y todas pasan por `supabase/AUDITORIA-MIGRACIONES.md`** y sus 15 dimensiones
> antes de aplicarse.

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

> **⚠ ANOTACIÓN 2026-08-19 — `resolverConexionPropia` NO se implementa en F1.**
>
> La especificación de arriba y los cuatro párrafos de abajo se conservan tal
> cual: describen el diseño aprobado el 2026-08-17 y no eran falsos. Lo que
> cambió viene de fuera del plan — por decisión de producto posterior a su
> cierre, **`freebusy` se elimina por completo**, y esa función no tenía ningún
> otro llamador previsto: su propio docstring lo dice, «Sólo para freebusy sobre
> `primary`». Escribirla sería estrenar código muerto en el mismo commit que lo
> crea.
>
> **El commit 1 expone `resolverConexionClinica` y las cinco escrituras, y nada
> más.** `resolverConexionClinica` sí filtra además por `rol = 'clinica'`, que el
> párrafo siguiente no enumera: sin ese filtro la garantía de «cero o una fila»
> se cae, porque el índice único parcial sólo cubre las filas de ese rol.
>
> No se tocan §0.3, la fila F6, el commit 2 de §6, el escenario de §7 ni H8:
> siguen describiendo la rama tal como se cerró. Si `freebusy` volviera, esta
> especificación está aquí entera y sirve sin reescribir nada.

Las dos hacen `.eq('clinica_id', clinicaId)` **explícito** aunque la RLS ya lo imponga, y `.eq('estado','activa')`. `clinicaId` sale siempre de `profiles` de la sesión autenticada, nunca del body ni del query param.

**Y `resolverConexionPropia` filtra además por `userId`, que NO es decorativo** (H8). La policy de `clinica_conexiones_google` deja leer **todas** las filas de la clínica a cualquier miembro, así que aquí la RLS no acota nada: el filtro por usuario es puramente código, y si se cae, «mi conexión» pasa a ser «una cualquiera de mi clínica». El `userId` sale de la sesión, igual que el `clinicaId`.

**Contrato de `resolverConexionPropia` cuando devuelve `null` — y va a ser el caso NORMAL** (H8). La secretaria no tiene conexión propia. Ningún médico invitado la tiene. Bajo el gate de §2.5, nadie salvo quien administra la clínica va a tenerla nunca. El plan original daba la firma y no el contrato, y eso deja abierta la lectura razonable de «pues uso la de la clínica» — que es precisamente la fuga de §0.3 servida a toda la clínica:

> **Sin conexión propia, `ocupado: []`. Nunca, bajo ninguna circunstancia, se cae a la conexión de la clínica para resolver `freebusy`.** Los bloques de «Ocupado» son el calendario `primary` de una persona física; pedírselos al token del administrador significa enseñarle su agenda personal a toda la clínica.

Que la mayoría de los usuarios vean el carril de «Ocupado» vacío no es un defecto: es que no tienen calendario propio conectado, y es lo correcto.

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
- **EXCEPCIÓN, y es obligatoria (H9): el refresco NO aborta.** La regla de arriba, aplicada literalmente a `guardarSecretos` desde el camino del refresh, sería una regresión. Hoy ese guardado está escrito para no abortar y su comentario dice por qué (`src/lib/gcal.ts:196-197`): «No se aborta: la sesión en memoria sirve para esta petición». Convertirlo en aborto significa que un fallo de escritura en base tira una cita que se podía haber sincronizado con el access token que ya está en memoria y es válido. Ahí se escribe, **se registra el fallo con operación distinguible, y se sigue**. El orden «primero la fuente nueva» se mantiene; lo que no se aplica es el «se aborta».
- **Falla el espejo (nueva OK):** se sigue adelante y se registra con una operación distintiva —`doble_escritura_espejo` en `registrarFalloGCal`— para que sea greppable. Lo que queda es divergencia de `expires_at` o `calendar_id`, y **el archivo B aborta sobre eso** con el `user_id` en el mensaje. Esa es la red, y es el motivo de que exista.
- **Disconnect:** se borra primero la conexión nueva; si el borrado del espejo falla, queda una fila en `google_tokens` sin conexión y el archivo B aborta por 2.1 («tokens sin conexión»). Ruidoso y correcto.
- **No hay transacción posible** entre las dos: son dos tablas por PostgREST y meterlas en una RPC sería una migración, que este brief prohíbe. La secuencia + el guardián del archivo B es la garantía disponible, y lo digo sin adornarlo.
- **Despliegue rodante** (instancias vieja y nueva sirviendo a la vez): la vieja refresca tokens escribiendo sólo `google_tokens` → divergencia de `expires_at` → el archivo B aborta. Se repara solo con el primer refresh que pase por el código nuevo, o a mano.

## 2.5 Qué `rol` nace en el callback — **decidido**

Era la decisión abierta más importante del plan. Está tomada (ver el cierre):

1. **`/api/google/connect` y el callback se gatean con `canManageClinica`.** El corte A lo dice explícitamente: los médicos invitados no van a poder conectar. Sin este gate, un invitado crea una conexión 'personal' que no sirve para nada y confunde el estado.
2. La conexión nace con `rol='clinica'`. Si otra cuenta ya es la de la clínica: **no se degrada a 'personal' en silencio**, se redirige con `?gcal_error=clinica_ya_conectada`. El relevo de administrador es un flujo consciente, no un efecto colateral de un botón de conectar.

   Con el puente, el callback ya no tiene que reconocer un 23505 crudo: `alta_conexion_google` lo hace por él. Comprueba el caso antes de escribir y, si aun así el índice único parcial dispara por una carrera, reetiqueta la violación con el mismo nombre. **El callback tiene un solo literal que reconocer, no un código de error de Postgres.**

   Y tiene que reconocer **dos**, no uno. El segundo es `rol_no_promovido`, que es el relevo de administrador visto desde el otro lado: la cuenta entrante ya tiene una conexión `'personal'`, reconectar **no** la promueve —el `ON CONFLICT … DO UPDATE` no toca `rol`, a propósito—, y sin ese error la clínica se quedaría con cero conexiones de clínica y las citas dejarían de sincronizarse en silencio. Va a `?gcal_error=rol_no_promovido`, y la salida para el médico es desconectar la conexión anterior antes de conectar. Ver el brief §4, fila A5.
3. Reconectar **el mismo** `user_id` actualiza su fila (incluido `estado='activa'`), que es lo que ya hace el `upsert` por `user_id` hoy.

## 2.6 Lo que el archivo B **no** atrapa, y que no estaba dicho (H10)

El plan se apoyaba en el archivo B como red de la doble escritura. Lo es, pero tiene tres huecos que conviene tener escritos antes de fiarse de su verde:

- **`estado` no tiene espejo, y B no lo compara.** El plan lo daba por neutro para la doble escritura y lo es; lo que no es neutro es la consecuencia operativa. Una conexión marcada `revocada` le presenta a B dos fuentes que coinciden perfectamente: veredicto verde, y el corte se aplica sobre una clínica que hace días que no sincroniza. **B verifica que las copias coinciden, no que sirvan.** Antes de aplicar B hay que mirar `estado` a mano.
- **El espejo del CAS no tiene CAS.** §3.4 escribe el `calendar_id` ganador al legado por `user_id` sin comparar-y-cambiar, así que dos peticiones en carrera pueden espejar en el orden inverso al que persistieron. B lo caza y aborta —correcto—, pero deja el corte bloqueado pendiente de reparación a mano. **El espejo del CAS pasa a ser también CAS**, con el mismo `esperado`.
- **`google_account_sub` y `google_account_email` no tienen espejo ni comparación.** No es divergencia —el legado no tiene esas columnas—: es que el «OK» de B no dice nada sobre ellas. Si el poblado de identidad sale mal, B no se entera.

## 2.7 Y una propiedad que todavía NO rige (H14)

La doble escritura pone el **mismo ciphertext** en `private.google_conexiones_secretos` y en `public.google_tokens`. Esa segunda tabla tiene RLS con `tokens_select_own` (`supabase/baseline/07_rls_policies.sql:357-360`) y ACL para `authenticated`, así que su dueño lee sus propios tokens cifrados por PostgREST — y por la policy legacy `"Users manage own tokens"` (`:341-345`, `FOR ALL TO public`) también los escribe.

No es un fallo del puente y el archivo B lo cierra al retirar la tabla. Va dicho para que «los tokens están fuera de alcance» no se dé por vigente antes de tiempo: **mientras viva el espejo es media verdad.**

---

# 3. Qué le pasa a `conCalendarioSpinus` y a sus hermanas

## 3.1 `abrirSesionGoogle` (privada, `gcal.ts:154`)
Firma: `(conexion: ConexionGoogle, admin) => { calendar, calendarId } | null`. Lee los secretos **por RPC** (`leerConexionConSecretos`, con `clinicaId` y `conexionId`), refresca si toca y **guarda vía módulo**. Deja de recibir `userId` y deja de leer `google_tokens`.

**Y deja de devolver `null` cuando el problema son los secretos.** Hoy `gcal.ts:158-163` descarta el `error` de la consulta y contesta `null`, que aguas arriba se lee como «este médico nunca conectó»; con el puente, esa misma rama se tragaría un `PGRST202`, un `42501` o un dueño equivocado. Las tres respuestas anómalas del RPC —`error` no nulo, **0 filas**, o **`tiene_secretos = false`**— van a `registrarFalloGCal` con operación distinguible y **`throw`**. El único `null` que sobrevive es «no hay conexión», y ese lo decide el resolvedor bajo RLS antes de llamar aquí. Brief §4, fila A2, y la tabla de las tres lecturas en su §2.3.

## 3.2 `getGCalClient` (`gcal.ts:217`)
Igual, sobre `ConexionGoogle`. Sus dos llamadores están en `calendar/route.ts` (GET del perfil y POST de recrear) y pasan a resolver la conexión **de la clínica**.

## 3.3 `desvincularCitas` y la rama destructiva — **H2: no es daño pasivo, y hay que contenerla en esta rama**

> Esta sección decía que la consecuencia era «las citas de los demás médicos quedan apuntando a eventos muertos», que eso es «raro», y que iría «comentado en el código». **Las tres cosas eran insuficientes y una era falsa.** Reescrita el 2026-08-17 al absorber H2. Es el hallazgo que más cambia esta rama.

### Los tres hechos, y ninguno estaba junto a los otros dos

1. **`conCalendarioSpinus` no es una función de lectura.** Si `calendar_id` es null, **crea** un calendario (`gcal.ts:243`, vía `:436`). Y ante un 404 que `calendarioVive` confirma, llama a `desvincularCitas` —un `UPDATE` masivo— y **recrea** (`gcal.ts:443-451`).
2. **`/api/google/events` no tiene gate de rol.** Sólo `auth.getUser()`. Cualquier miembro autenticado de la clínica entra por ahí con sólo abrir la agenda (`gcalSource` en `src/app/(app)/agenda/page.tsx`).
3. **Bajo el modelo nuevo, esa función recibe la conexión de la clínica y el cliente admin** (§3.6). El cliente admin es el prerrequisito para leerle los tokens a otro, y trae de regalo que **la RLS deja de acotar nada** de lo que la función escriba.

Por separado los tres son defendibles. Juntos son una escalada de privilegios.

### La secuencia

Un médico invitado abre su agenda. GET `/api/google/events` → `conCalendarioSpinus(conexionDeLaClinica, admin, …)`. Si el administrador borró el calendario desde Google:

- `desvincularCitas(admin, conexion.userId)` (`gcal.ts:385`) ejecuta un `UPDATE` que pone `google_event_id = null` y `gcal_sync_status = 'unbound'` sobre **las citas del administrador más todas las de `medico_id` NULL de la clínica**. Ese invitado **no puede leer ni una de esas filas** —su `appointments_select` es `(medico_id = auth.uid() OR get_my_role() = 'secretaria') AND clinica_id = …`, `20260530_etapa5h_paso3_policies_appointments.sql:82-96`—, y las modifica igual, porque va con cliente admin.
- `crearCalendarioSpinus` crea un calendario **en la cuenta de Google del administrador** y reescribe el `calendar_id` de la conexión de la clínica.

**Y no hace falta ni el 404.** Con `calendar_id` en null —que es exactamente el estado en que queda la conexión tras un POST a `/api/google/calendar`, que lo suelta antes de recrear (`calendar/route.ts:152-165`)— basta con que el invitado cargue la agenda para que se cree el calendario de la clínica en la cuenta ajena.

**El rastro que queda es un `logger.warn`** (`gcal.ts:326`), y sólo en la rama de carrera perdida.

### La contención, y va en esta rama

No es trabajo de la rama siguiente: la rama siguiente arregla el **ámbito** de `desvincularCitas` (que siga siendo «las citas de ese médico» bajo un calendario de clínica es incorrecto, y para eso existe `gcal_calendar_id`). Lo que hay que cerrar **aquí** es **quién puede disparar la rama destructiva**, porque es esta rama la que la pone al alcance de cualquiera.

**Decisión: `conCalendarioSpinus` gana un modo, y el modo lo decide el rol de quien ejecuta, no la ruta.**

- Quien cumple `canManageClinica` opera como hoy: crea si falta, desvincula y recrea ante un 404 confirmado.
- **Todos los demás operan en modo estricto: si no hay `calendar_id`, o si hay 404, la función devuelve vacío y NO escribe nada** —ni en la base, ni en Google—. Ni crea, ni desvincula, ni recrea.

Consecuencias, dichas enteras:

- Una secretaria que agenda una cita cuando la clínica todavía no tiene calendario creado **no lo crea**: la cita queda `gcal_sync_status = 'pending'` sin evento, hasta que entre alguien que administre. Es peor UX que hoy y es la contención correcta: el arreglo es que quien administra abra la agenda una vez, no que cualquiera pueda escribir en la cuenta de Google de otro.
- El caso normal no cambia, porque el calendario ya existe y no da 404.
- El modo estricto **no** es un gate de ruta. Ponerlo sólo en `/api/google/events` dejaría abierto el mismo camino por el `after()` del alta de citas, que también llama a `conCalendarioSpinus` y también lo dispara cualquiera con permiso para agendar.

Esto añade un archivo a la lista (`src/lib/permissions.ts` no cambia, pero el descriptor de conexión tiene que viajar con «quién ejecuta» y su rol) y **cambia la firma de §3.6**.

## 3.4 `crearCalendarioSpinus` (`gcal.ts:243`)
El CAS pasa al módulo (`guardarCalendarIdSiEsperado`), que hace el comparar-y-cambiar **sobre la fuente nueva** (`id = conexion.id`, `.is/.eq('calendar_id', esperado)`, con `.select()` para enterarse de los cero renglones) y **espeja el valor ganador** al legado por `user_id` sin CAS. La re-lectura de desempate (`:316`) también pasa a la fuente nueva. El resto de la función —crear en Google, borrar el huérfano, adoptar el del ganador— no cambia.

El nombre del calendario sale del perfil de `conexion.userId` (el dueño de la cuenta de Google), o sea el mismo texto que hoy: «Spinus - Dr. Fulano». **No propongo renombrarlo a la clínica en esta rama**; el calendario vive en esa cuenta de Google y el nombre sigue siendo cierto.

**Excepción de cliente que necesito que apruebes:** esa lectura de `profiles` ocurre dentro de `after()` cuando hay que crear un calendario, y con la regla de las cookies no puedo usar el cliente de sesión ahí. Dos salidas: (a) leer `profiles` con admin filtrando por `id = conexion.userId` **y** `clinica_id` (una consulta, rara, acotada); (b) pre-resolver el nombre antes de responder en cada alta de cita, pagando un SELECT extra en el 99,9% de los casos en que no hay nada que crear. **Recomiendo (a)**, documentada en el módulo.

## 3.5 `calendarioVive` (`gcal.ts:348`)
Sin cambios. Es Google puro, no toca la base.

## 3.6 `conCalendarioSpinus` (`gcal.ts:427`)
Firma nueva: `(conexion: ConexionGoogle, admin, operacion, opciones: { puedeReparar: boolean }) => T | null`. El cuarto argumento es la contención de H2 (§3.3) y **no es opcional con default `true`**: un default permisivo es exactamente cómo se vuelve a abrir el agujero desde un llamador nuevo que no lo sabe. Lo calcula cada ruta con `canManageClinica` sobre el perfil de la sesión, **antes** de responder, y viaja por closure hasta `after()` como todo lo demás (§1). Devuelve `null` cuando `conexion` es null (la clínica no tiene conexión activa) exactamente como hoy devolvía null sin token, así que los seis llamadores conservan su semántica de «null = nada que sincronizar». `registrarFalloGCal` gana un `conexionId` opcional en el contexto, conservando `userId` = quien ejecuta la acción (que es lo que sirve para diagnosticar).

---

# 4. Archivos y líneas que cambian

| # | Archivo | Qué cambia |
|---|---|---|
| F1 | `src/lib/gcalConexion.ts` **(nuevo)** | resolvedores + la lectura de tokens + las 5 escrituras con doble escritura. Las tres que tocan secretos van por RPC (`alta_conexion_google`, `guardar_secretos_conexion`, `leer_conexion_google_con_secretos`); las de metadata, por PostgREST con admin. Único sitio del repo donde aparecen esos seis literales (§2.2). ~180 líneas, ninguna función >50 (Protocolo 3) |
| F2 | `src/lib/gcal.ts` | **modo estricto de §3.3/§3.6 (H2)**; `abrirSesionGoogle` :154-211 sobre conexión; refresh :192 al módulo; CAS :286-294 y re-lectura :316-320 al módulo; `getGCalClient` :217; `conCalendarioSpinus` :427-453 firma; `desvincularCitas` :385 **sólo comentario**; marcado `estado='revocada'` (§5) |
| F3 | `src/app/api/google/callback/route.ts` | gate `canManageClinica`; upsert :66-71 → `altaConexion` (**una** llamada: metadata y secretos van juntos, ya no son un INSERT más un RPC); lectura de `calendar_id` :101-105 → resolvedor; traduce los **dos** errores con nombre del alta → `?gcal_error=clinica_ya_conectada` y `?gcal_error=rol_no_promovido` (§2.5) |
| F4 | `src/app/api/google/calendar/route.ts` | `calendarioRegistrado` :26-36 → resolvedor; GET :64 y POST :112 sobre la conexión de la clínica; `update(calendar_id=null)` :152-155 → módulo |
| F5 | `src/app/api/google/disconnect/route.ts` | gate `canManageClinica`; delete :9 → `borrarConexion` sobre la conexión de la clínica |
| F6 | `src/app/api/google/events/route.ts` | `estadoDeFallo` :22-41 por clínica; `consultarOcupado` :54-94 con **cliente propio** fuera del reintento y `ocupado: []` si no hay conexión propia (H8); dedupe :162-168 **intersección** + `.eq('clinica_id')`; lista blanca en :170-176; **`puedeReparar` calculado con `canManageClinica`** y pasado a `conCalendarioSpinus` (H2, §3.3) |
| F7 | `src/app/api/appointments/route.ts` | conexión resuelta antes de responder, junto con `puedeReparar` (§3.6); `after()` :263-314 con la conexión; veredicto :325-333 por clínica; **`gcal_calendar_id: calendarIdUsado` en el UPDATE :303-307** (§0.7, aprobado); **el `'synced'` deja de ser optimista**: :288-289 pasa a `creado?.data.id ? 'synced' : 'failed'` con `registrarFalloGCal` en la rama falsa (H4) |
| F8 | `src/app/api/appointments/[id]/route.ts` | ídem para PUT (`after()` :295-353, veredicto :361-369) y DELETE (`after()` :412-428); el `'synced'` optimista de :328-329 con el mismo arreglo que F7 (H4); y **`gcal_calendar_id` también en el PUT** cuando el evento se cree ahí |
| F9 | `src/app/api/google/connect/route.ts` | gate `canManageClinica` por higiene —el que cuenta es el del callback, que es donde se escribe el renglón (§2.5)—; y los scopes `openid` y `email` :67-69, **en su propio commit** (§6) |
| F10 | `src/app/(app)/agenda/page.tsx` | `gcalSource` :1385-1440 deja de pintar `data.events` (sigue pintando `ocupado`). Fuera de la lista original: **aprobado** |
| F11 | `src/lib/__tests__/gcalConexion.test.ts` **(nuevo)** | el cerrojo de §2.2 |
| F12 | `src/app/(app)/perfil/page.tsx` | **H5.** «Desconectar» no está detrás de `isAdmin` —sólo lo está «Recrear calendario», :708— y su handler hace `setGcalEstado('sin_token')` incondicional ignorando la respuesta (:351-357). Con F5 gateando el DELETE, un invitado hace clic, recibe 403 y la interfaz le dice «desconectado» sin estarlo. Se gatea el botón y el handler pasa a mirar la respuesta. Segundo caso del mismo tipo que F10 |
| F13 | `src/lib/audit.ts` + `callback`, `disconnect`, `calendar` | **H6.** Las cuatro acciones nuevas de `AuditAccion` y sus `logAudit` (§8) |

Son **13** archivos —eran 11 antes de absorber H5 y H6—. Muy por encima del umbral del Protocolo 3, y por eso esto es un plan y no un parche.

> **⚠ ANOTACIÓN 2026-08-19 — correcciones a F6 y F10.** Van aquí y no dentro de la
> tabla porque una anotación entre renglones la rompería.
>
> **F6 — la fila enumera cinco cosas y NO son todas del mismo commit.** Leída
> suelta induce a meterlas juntas, y dos de ellas no compilan en el commit 2:
>
> | Ítem de F6 | Dónde va | Por qué |
> |---|---|---|
> | dedupe `:162-168` + `.eq('clinica_id')` | **commit 2** | pero ya no como intersección, sino como **resta acotada por capacidad** (anotación de §0.4 y §12.1) |
> | lista blanca en `:170-176` | **commit 2** | hoy `:172` devuelve el `Schema$Event` entero; la agenda sólo usa `id`, `summary`, `start` y `end` |
> | `consultarOcupado` con cliente propio (H8) | **SIN EFECTO** | `freebusy` se elimina (§12.6). Y `resolverConexionPropia` no existe: no se escribió en el commit 1 (ver la anotación de §1) |
> | `estadoDeFallo` `:22-41` **por clínica** | **commit 3** | necesita `resolverConexionClinica`; hoy pregunta por `google_tokens` del usuario |
> | `puedeReparar` a `conCalendarioSpinus` | **commit 3** | es el cuarto argumento de la firma nueva de F2 (§3.6). Pasarlo antes no compila |
>
> **F10 — las dos mitades de su renglón cambian.** La cláusula «(sigue pintando
> `ocupado`)» queda **sin efecto**: no habrá bloques de «Ocupado» (§12.6). Y
> «deja de pintar `data.events`» queda **REVERTIDA para el administrador y la
> secretaria**: esos eventos son los escritos a mano y tienen que seguir
> pintándose (§12.1), con estilo propio e inertes. Para el médico invitado el
> array llega vacío, así que no hay nada que pintar y el efecto es el que F10
> describía.
>
> **Consecuencia sobre `gcalSource` y `GoogleEventCard`:** NO mueren. El
> inventario que los daba por muertos partía de que F10 vaciaba el pintado y
> `freebusy` se llevaba el resto; con §12.1 el carril de eventos de Google sigue
> vivo para dos de los tres roles. Lo que sí muere es todo lo de «Ocupado»
> (§12.6).

> **⚠ ANOTACIÓN 2026-08-20 — puntero corregido en F9.** La fila decía «los scopes
> `openid` y `email` **:35-38**» y ese tramo dejó de ser el de los scopes: hoy
> `:35-38` es la comprobación de variables de entorno. **Los scopes están en
> `:67-69`**, y los movió el commit 2 al retirar `freebusy` del array. La fila
> queda enmendada en el sitio —una anotación entre renglones rompería la tabla— y
> se deja constancia aquí. No cambia nada del alcance: sólo el puntero estaba mal,
> como ya le pasó a `gcal.ts:317` en §0.1.

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

   > **⚠ ANOTACIÓN 2026-08-19 — el alcance del commit 2 cambia.** El paréntesis
   > de arriba dice «intersección + lista blanca + freebusy con conexión propia»,
   > y de esos tres ya sólo sobrevive uno tal cual:
   >
   > - **intersección → RESTA acotada por capacidad** (anotación de §0.4, §12.1).
   > - **lista blanca →** se mantiene igual.
   > - **freebusy con conexión propia →** sin efecto; `freebusy` se elimina
   >   entero, y eso también es de este commit (§12.6).
   >
   > Se añade lo que no estaba: el **helper de capacidad** en
   > `src/lib/permissions.ts`, como lista blanca (administrador o secretaria),
   > del que sale el vacío del médico invitado (§12.1 y §12.11).
   >
   > **Y NO entran en este commit los dos ítems de F6 que necesitan el 3**
   > —`estadoDeFallo` por clínica y `puedeReparar`—: ver la anotación de la tabla
   > de §4. El orden respecto del commit 3 no cambia y sigue siendo lo único
   > innegociable de §6.
   >
   > **Añadido el 2026-08-20 (§12.12.2 y §12.12.4), dos cosas más a este commit:**
   >
   > - **El bucle de `pageToken` sobre `events.list`** (`events/route.ts:138-145`).
   >   No es paginación completa: es recorrer el `nextPageToken` que hoy se
   >   ignora, sobre la llamada que ya existe. Va aquí porque es **este** commit
   >   el que convierte el techo de 100 en un fallo real (§0.9).
   > - **Borrar `isGoogleEvent`** (`agenda/page.tsx:1797`), bandera muerta. Este
   >   commit ya está dentro de ese archivo retirando lo de «Ocupado».
3. **`feat(gcal): resolver la conexión por clínica y escribir en las dos fuentes`** — F2 + F3 + F4 + F5 + F7 + F8 + F9 (gate) + F12. **Indivisible, y ahora por dos razones.** La semántica: si el alta escribe en el calendario de la clínica y la baja borra la del actor, se rompen las dos. Y la compilación, que es H3 y no estaba visto:

   > **H3 — la serie no compilaba.** El commit 3 traía la firma nueva de `conCalendarioSpinus` (F2) y sus **tres llamadores restantes** cambiaban en el 4: `appointments/route.ts:272`, `[id]/route.ts:315` y `[id]/route.ts:415`. `npm run build` habría fallado ahí mismo, con tres call sites pasando `(admin, userId, operacion)` a una función que espera `(conexion, admin, operacion, opciones)`. El Protocolo 7 lo prohíbe explícitamente: build verde después de cada cambio.
   >
   > **Elegida la primera de las dos salidas: fundir F7/F8 en el commit 3.** La alternativa —mantener una firma compatible con `userId` durante un commit— deja un intermedio en el que las citas se escriben en un calendario y se leen del de la clínica; hoy es invisible porque sólo hay una conexión, y deja de serlo el día del primer relevo. Un intermedio que sólo es correcto mientras el sistema sea de un solo médico es justo lo que esta rama viene a quitar de en medio.
   >
   > **Precio, dicho entero:** el commit 3 pasa a tocar **ocho** archivos y el estado «3 sin 4» deja de existir. Se compensa con que ya no hay ningún punto de la serie en el que la agenda y el alta discrepen sobre a qué calendario van las citas.

4. **`feat(gcal): pedir openid y email en el consentimiento`** — los scopes de F9. **Commit propio y posterior al 3, a propósito:** si la pantalla de consentimiento de Google se comporta raro, se revierte solo sin tocar la resolución por clínica. Hasta que alguien reconecte, `google_account_sub` y `google_account_email` siguen en NULL, que es el estado de hoy.
5. **`feat(gcal): registrar en audit_log conexión, desconexión y recreación`** — F13 (§8).
6. **`test(gcal): prohibir escrituras de conexión fuera del módulo`** — F11. Va al final porque hasta aquí la prueba no puede pasar; a partir de aquí, cierra la puerta.

> **⚠ ANOTACIÓN 2026-08-20 — la serie ya no acaba en el 6.** Las decisiones de
> producto de §12 añaden trabajo que no cabía en este plan cuando se escribió. El
> orden de arriba **no cambia**; lo que sigue va detrás.
>
> **7. El permiso de escritura en la agenda — COMMIT PROPIO, Y AL FINAL** (§12.7).
> No se funde con ningún otro, y el motivo es de riesgo, no de orden:
>
> - **Es el único cambio de la rama que le quita algo a un usuario real.** Hoy los
>   médicos invitados crean citas; después de este commit, los que no tengan el
>   permiso encendido no podrán. Eso es visible en producción desde el primer
>   minuto y va a generar preguntas.
> - **Tiene que poder revertirse solo.** Fundido con el arreglo de la conexión por
>   clínica, dar marcha atrás en el permiso significaría arrastrar consigo la
>   corrección del bug que motiva toda esta rama. Separados, se revierte uno sin
>   tocar el otro.
>
> Los demás trabajos que §12 añade —«atendida» (§12.13) y los eventos genéricos
> (§12.14)— **no tienen commit asignado todavía**. Lo que sí está fijado es que el
> permiso de escritura va el último.

> **⛔ ANOTACIÓN 2026-09-01 — EL COMMIT 7 QUEDA CANCELADO. LA SERIE ACABA EN EL 6,
> como acababa antes de la anotación de arriba.**
>
> No se pospone ni se traslada a otra rama: **no se construye**. La barrera que
> venía a levantar ya existe en las cuatro policies de `appointments`, y lo que
> habría añadido encima es que la interfaz deje de ofrecer botones que el servidor
> ya rechaza — cosmético, y a cambio de dos migraciones.
>
> **Los dos motivos de riesgo de arriba caen solos, y conviene ver por qué:** el
> commit 7 pedía commit propio porque «le quita algo a un usuario real» y porque
> «tiene que poder revertirse solo». Si no se escribe, no le quita nada a nadie y
> no hay nada que revertir. La razón que lo separaba era exactamente la razón por
> la que ahora no hace falta.
>
> El registro completo, con las policies en las que se apoya y qué lo reabriría,
> en **§12.19**. La cancelación **no toca** §12.13 ni §12.14, que ya están hechas.

---

# 7. Qué se rompe si el deploy sale a medias

Vercel despliega un commit entero, así que «a medias» es: (a) parte de la serie desplegada, o (b) despliegue rodante con dos versiones sirviendo a la vez.

- **Sólo 1:** nada. Código muerto.
- **1-2 sin 3:** la agenda pierde los eventos de Google que no son citas (la consecuencia ya aceptada) y los bloques de «Ocupado» pasan a resolverse por conexión propia — mismo resultado que hoy, porque hoy la conexión propia es la única que hay. **Sin fuga.**
- **3 sin 2 — ESTE ES EL PELIGROSO, y por eso el orden.** La resolución pasa a la clínica y `events.list` devuelve el calendario entero **restando** en vez de intersecando: a cada médico invitado se le pintan las citas de sus colegas con el nombre del paciente en el título, y `freebusy` le enseña la disponibilidad del calendario personal del administrador. Fuga de datos de pacientes entre médicos de la misma clínica. **El commit 2 nunca puede quedar detrás del 3.**
- **3 sin 4:** el estado que antes era «cosmético» **ya no existe**: F7 y F8 entraron en el 3 (H3). Lo que falta del 4 son los scopes, y su ausencia es exactamente el estado de hoy: `google_account_sub` y `google_account_email` en NULL y un 404 que no se puede desambiguar.
- **4 sin 5:** las acciones de conexión no quedan registradas en `audit_log`. Es el estado de hoy y el incumplimiento que H6 describe; no empeora nada, sigue sin cumplirse.
- **5 sin 6:** nada; falta el cerrojo, no la función.
- **Rodante (vieja + nueva a la vez):** el alta de una cita puede ir al calendario del actor (instancia vieja) o al de la clínica (nueva) según a quién le toque; con una sola conexión, hoy, son el mismo calendario y no se nota. Lo que sí queda es que la instancia vieja refresque tokens escribiendo sólo `google_tokens` → divergencia de `expires_at` → **el archivo B aborta**, que es el comportamiento correcto: no se corta la fuente vieja hasta que la doble escritura lleve un rato limpia. Se repara con el primer refresh que pase por el código nuevo.
- **Migración A sin código:** inocuo por diseño (aditivo puro). **Código sin migración A:** no aplica, ya está en producción.

> **⚠ ANOTACIÓN 2026-08-19 — el escenario «1-2 sin 3» ya no dice la verdad.**
> Afirmaba que los bloques de «Ocupado» pasarían a resolverse por conexión propia,
> «mismo resultado que hoy». Con `freebusy` eliminado (§12.6) **no hay bloques**:
> la agenda pierde ese carril, y eso es un cambio visible, no un empate. Lo que
> sigue intacto es la conclusión que importaba —**sin fuga**— y también que la
> agenda deja de pintar eventos que ya pintaba como citas.
>
> El escenario **«3 sin 2» sigue siendo el peligroso por el mismo motivo, y con
> uno más:** sin el commit 2, además de la resta con conjunto parcial, tampoco
> existe el helper de capacidad, así que un médico invitado recibiría los eventos
> escritos a mano del administrador. **El commit 2 sigue sin poder quedar detrás
> del 3.**

---

# 8. `audit_log` — lo que ahora hay que registrar y hoy no se registra (H6)

Conectar, desconectar y recrear el calendario **no escriben nada** en `audit_log`. Comprobado: `callback/route.ts` entero, `disconnect/route.ts:4-11` y `calendar/route.ts` no mencionan la tabla ni el helper. Tampoco lo hace el borrado de una cita.

Cuando esto era un médico sobre su propia cuenta, era discutible. Bajo el modelo nuevo **desconectar deja sin sincronización a toda la clínica**, y «quién apuntó la clínica a qué cuenta de Google» pasa a ser una pregunta sin respuesta posible. `CLAUDE.md` lo tiene entre los no-negociables por partida doble: «NUNCA quites el audit log de ninguna acción» y «Todo cambio en datos sensibles DEBE registrarse en `audit_log`».

El helper ya existe y es trivial de usar: `logAudit({ userId, accion, tabla, registroId, descripcion })` en `src/lib/audit.ts:87`, que nunca lanza —si el registro falla, no bloquea la operación—. Lo que hay que hacer es **añadir las acciones al tipo `AuditAccion`**, que es una unión cerrada de literales: sin eso no compila, y ése es justamente el mecanismo que impide inventarse nombres sueltos.

| Cuándo | `accion` | `tabla` / `registroId` | `descripcion` |
|---|---|---|---|
| El callback da de alta o reconecta | `gcal_conexion_alta` | `clinica_conexiones_google` / id de la conexión | el `rol` con el que quedó y si fue alta o reconexión |
| `DELETE /api/google/disconnect` | `gcal_conexion_baja` | ídem | **el que más importa**: deja la clínica entera sin sincronizar |
| `POST /api/google/calendar` recrea | `gcal_calendario_recreado` | ídem | el id del calendario que se soltó y el del nuevo |
| El refresh detecta `invalid_grant` y marca `estado='revocada'` (§5) | `gcal_conexion_revocada` | ídem | que la marcó el sistema, no una persona |

**Nunca entra en `descripcion` ningún token, ni cifrado, ni truncado, ni el nombre de ningún paciente.** Van ids de conexión y de calendario, que no son datos personales.

Queda **fuera** el registro por cita sincronizada: son tres escrituras por cita en `after()` y convertiría el `audit_log` en un log de tráfico. Lo que se registra son los actos sobre la **conexión**, que son raros y consecuentes.

---

# 9. Lo que este diseño concentra, y el plan no nombraba (H7)

**No es un defecto de código: es la consecuencia directa del diseño aprobado.** El hallazgo es que el plan no la nombraba ni una vez, y es la clase de cosa que hay que tener escrita antes y no después.

Tras el cambio, los nombres de los pacientes **de todos los médicos de la clínica** caen en el Google personal de una persona física, sincronizado a su teléfono. El título del evento es literalmente `Cita médica: <nombre> <apellidos>` (`tituloParaGoogle`, `src/lib/appointments.ts`).

Lo que importa de esto:

- **Dentro de Spinus no es una fuga.** Quien administra la clínica ya ve todas las citas, por `appointments_select` y por diseño de rol. No se le enseña nada que no pudiera ver.
- **La superficie nueva es hacia fuera de Spinus.** El ACL de ese calendario —con quién lo comparte su dueño— vive en Google, **fuera de la RLS y fuera de `audit_log`**. El scope `calendar.app.created` (`connect/route.ts:36`) permite a Spinus crear el calendario y escribir en él; **no** le permite controlar, ni siquiera consultar, con quién lo comparte el dueño después. Si el administrador comparte ese calendario con su pareja, Spinus no puede saberlo.
- **Y el calendario se sigue llamando «Spinus - Dr. Fulano»** (`gcal.ts:260`) para un calendario que ya no es de ese médico sino de la clínica. §3.4 decidió no renombrarlo en esta rama porque el nombre «sigue siendo cierto»: bajo el modelo nuevo deja de serlo.

**Qué se hace en esta rama:** nada de código. Se nombra, se acepta conscientemente y se registra aquí. **Qué queda pendiente y no es de esta rama:** decidir si el aviso de privacidad de la clínica tiene que decir que las citas viajan a una cuenta de Google de un tercero, y si el nombre del calendario pasa a ser el de la clínica. Lo primero es cumplimiento y no lo decide un plan técnico.

> **⚠ ANOTACIÓN 2026-08-19 — hay una SEGUNDA superficie hacia fuera, y esta
> sección no la contemplaba.** §9 razona sobre una sola: los pacientes de la
> clínica concentrados en el Google personal de quien administra. La decisión de
> mandar a cada médico invitado una invitación por correo (§12.4) abre otra: el
> título del evento —con el **nombre completo** del paciente (§12.5)— viaja al
> buzón personal de cada médico invitado, y de ahí a su propia agenda.
>
> El pendiente de cumplimiento que §9 dejaba abierto sigue abierto y ahora es más
> ancho: hay que declarar las **dos** rutas de salida, no una. La redacción
> concreta que se quiere está en §12.5. Sigue sin ser de esta rama.

> **⚠ SEGUNDA ANOTACIÓN 2026-08-20 — la segunda superficie dejó de ser hipótesis,
> y trae un detalle que esta sección no contemplaba.** La invitación por correo
> de §12.4 se probó contra producción y funciona (§12.12.3): esa ruta de salida
> **existe de verdad**, no es un diseño sobre el papel.
>
> Y en la respuesta de la API aparece una pieza más: **`creator` es el correo
> personal de quien administra la clínica**, mientras que `organizer` es el
> calendario de Spinus. De cara al médico invitado el organizador se ve como
> «Spinus - <nombre>», que es lo correcto; el correo personal viaja en el campo
> `creator`.
>
> **Dentro de Spinus no estrena nada** —quien administra ya es identificable para
> su clínica—, pero es una tercera pieza del mismo inventario que esta sección
> lleva: **qué identidad de una persona física sale de Spinus por la vía de
> Google**. Junto al ACL del calendario, que vive fuera de la RLS, y al nombre del
> paciente en el título. **Sin acción en esta rama**; se nombra para que esté
> contado cuando se redacte lo del aviso de privacidad.

> **⚠ TERCERA ANOTACIÓN 2026-08-21 — EL TÍTULO DEJA DE TENER FORMA CONOCIDA.
> Esto AMPLÍA el pendiente de cumplimiento que esta sección ya llevaba abierto;
> no abre uno nuevo.**
>
> Todo lo de arriba razona sobre un título de forma fija: `Cita médica: <nombre>
> <apellidos>`, compuesto por `tituloParaGoogle` y por nadie más. Se podía decir
> con exactitud qué salía de Spinus, y por eso §12.5 podía prometer una
> redacción concreta —el nombre del paciente, sin nada clínico—.
>
> Los **eventos genéricos** de §12.14 rompen esa propiedad: su título es **TEXTO
> LIBRE que escribe el usuario** y viaja a Google **tal cual, sin filtro**. El
> ejemplo del propio §12.14 —«Cirugía Sr. Pérez»— ya lleva nombre de paciente, y
> nada impide que alguien escriba además el diagnóstico.
>
> **No hay forma de sanearlo, y por eso se acepta en vez de mitigarse.** Un
> filtro sobre texto libre o deja pasar lo que no reconoce o rechaza títulos
> legítimos, y las dos cosas son peores que decirlo claro. Lo que sí se hace es
> **decirlo donde se escribe**: el campo de título del modal lleva debajo, fijo,
> «Se verá tal cual en Google Calendar y en la invitación de quien asista».
>
> **Consecuencia para el inventario de esta sección:** la descripción del evento
> sigue teniendo formato fijo y garantía de mínimos —clínica, paciente y hora, y
> NADA clínico, `eventoParaGoogle` en `lib/appointments.ts`—, pero **el título ya
> no la tiene**. Quien redacte el aviso de privacidad tiene que declarar que el
> contenido del título de un evento lo decide quien lo escribe. Sigue sin ser de
> esta rama.

---

# 10. Los catorce hallazgos de la auditoría de este plan

Estado tras la absorción del 2026-08-17. Se anota aquí porque el reporte no se guardó en ningún archivo y sin esta tabla no hay forma de saber qué se recogió y qué no.

| # | Qué era | Dónde quedó |
|---|---|---|
| H1 | Bloqueante: `private.google_conexiones_secretos` inalcanzable para la aplicación | Cerrado por `20260818_gcal_puente_secretos.sql`. Cabecera de este documento, §1, §2.1 y §2.2 |
| H2 | **Grave.** Un invitado provoca escrituras masivas sobre citas ajenas y en la cuenta de Google de otro, desde un GET | **§3.3 reescrita**, §3.6 (modo estricto), §0.4 (la mitad del dedupe), F2 |
| H3 | La serie no compila en el commit 3 | §6 (F7/F8 funden en el 3) y §7 |
| H4 | El error del RPC es indistinguible de «nunca conectó» | §3.1 (la lectura) y F7/F8 (el `'synced'` optimista) |
| H5 | `/perfil` sin gatear: va a mentir tras el gate de F5 | F12, nueva |
| H6 | Nada se registra en `audit_log` | §8, nueva, y F13 |
| H7 | El calendario concentra los pacientes de la clínica en una cuenta personal, y no se nombraba | §9, nueva |
| H8 | El contrato de `resolverConexionPropia` devolviendo null no estaba escrito | §1 (contrato explícito) y §0.3 (el matiz del `ocupado`) |
| H9 | §2.4 contradecía el código en el camino del refresh | §2.4, con la excepción escrita |
| H10 | Divergencias que el archivo B no atrapa | §2.6, nueva |
| H11 | El cerrojo de §2.2 apuntaba a un literal que iba a dejar de existir: con el puente, `google_conexiones_secretos` no vuelve a aparecer en `src/` —el código llama a un RPC—, así que media prueba quedaba vacía dando una cobertura que no tenía, y cualquiera podía llamar a `leer_conexion_google_con_secretos` desde cualquier archivo | **§2.2**, que vigila los tres nombres de función además de los de las tablas |
| H12 | La cita del precedente no decía lo que se le atribuía: `20260813_firmas_documento.sql:235` es un `REVOKE` sobre una **tabla**, sin `GRANT` posterior, no el patrón de funciones. Los precedentes reales son `20260807_folio_01:612-613` y `20260615_consultorios_05:110-116`, y el segundo anota lo que importa: en Supabase `anon`/`authenticated` reciben EXECUTE por configuración del proyecto, al margen del `REVOKE FROM PUBLIC`. El patrón era correcto; la cita, no | Especificación del puente, que ya cita los precedentes reales |
| H13 | `authenticated` conservaba `MAINTAIN` sobre `clinica_conexiones_google`: la lista enumerada de verbos de `20260817_...:343-344` no lo incluye porque Postgres lo añadió en la 17, después de escribirse la lista. Impacto casi nulo —habilita VACUUM/ANALYZE/REINDEX y PostgREST no emite esas sentencias—; el defecto es el método, porque enumerar verbos deja huecos que aparecen solos al cambiar de versión mayor | `20260818_gcal_puente_secretos.sql` §5 (`REVOKE ALL` + `GRANT SELECT`) y su afirmación C7, que comprueba el conjunto completo |
| H14 | El secreto sigue legible por su dueño mientras viva el espejo | §2.7, nueva |

---

# 11. Decisiones tomadas

Esta sección era «Lo que necesito de ti antes de escribir una línea» y eran seis preguntas. **Las seis están contestadas**; las respuestas vivían en la conversación y no en el documento, que es de donde se va a escribir el código. Quedan aquí como decisiones, no como propuestas.

1. **Gate `canManageClinica` en el callback y en `/connect`, y el 23505 explícito — SÍ a las dos** (§2.5). El gate que cuenta es el del **callback**, que es donde se escribe el renglón; el de `/connect` va por higiene, para no llevar a nadie a una pantalla de Google que va a acabar en un error. Y el conflicto **no se degrada a `'personal'` en silencio**: sale por `?gcal_error=clinica_ya_conectada`. Con el puente, además, el callback ya no ve un 23505 crudo (§2.5).
2. **Tocar `agenda/page.tsx` para dejar de pintar `data.events` — SÍ** (§0.4, F10). No hacerlo significa pintar cada cita dos veces.

   > **⚠ ANOTACIÓN 2026-08-19 — esta decisión queda REVERTIDA en su mitad
   > principal.** La agenda **sigue pintando** `data.events` para el administrador
   > y la secretaria: ahí van los eventos que el administrador escribe a mano en el
   > calendario de Spinus, y conservarlos es requisito de producto (§12.1). Para el
   > médico invitado el array llega vacío y no hay nada que pintar.
   >
   > El motivo que sostenía el «SÍ» —«pintar cada cita dos veces»— **desaparece con
   > la resta**: bajo la resta las citas no salen en el array, así que no hay
   > duplicado que evitar. Lo que sí se mantiene de esta decisión es que
   > `agenda/page.tsx` se toca, sólo que para **cambiar cómo** se pintan esos
   > eventos (inertes, estilo propio, interruptor) en vez de para dejar de
   > pintarlos.
3. **Estampar `gcal_calendar_id` en el `after()` — SÍ** (§0.7, F7 y F8). En el alta **y también en el PUT** cuando el evento se cree ahí. Sin eso la rama siguiente nace sin datos.
4. **§3.4, opción (a): leer `profiles` con cliente admin filtrado por `id` y `clinica_id` — SÍ.** La (b) paga un SELECT en cada alta de cita para el 0,1% de los casos en que hay que crear un calendario. Y la tercera vía que parecía obvia —cargar el nombre en el descriptor de conexión al resolverla— **no sirve**: `profiles_select` deja leer los perfiles de la clínica a admin y secretaria, pero a un médico invitado sólo el suyo, así que el descriptor saldría sin nombre justo para el usuario que más probablemente dispare la creación.
5. **Desconectar gateado a `canManageClinica` — SÍ** (§0.6, F5). Y con él viene F12: el botón de `/perfil` tiene que gatearse igual, o la interfaz miente (H5).
6. **Scopes `openid` y `email` — SÍ, en esta rama**, como **commit propio después del commit 3** (§6, commit 4), para poder revertirlos solos si la pantalla de consentimiento se comporta raro.

## Lo que la absorción destapó — **aprobado también**

Las dos cambian la forma de la rama, y las dos están aceptadas:

- **El modo estricto de §3.3 (H2), con default restrictivo.** `conCalendarioSpinus` gana `puedeReparar` como cuarto argumento **obligatorio**, y quien no administra la clínica deja de poder crear, desvincular y recrear. El coste de UX se acepta con los ojos abiertos: una secretaria que agenda la primera cita de una clínica cuyo calendario aún no existe ya no lo crea, y la cita queda `pending` hasta que entre quien administra. La alternativa era dejar que cualquier miembro disparase un UPDATE masivo sobre citas que no puede leer y una escritura en la cuenta de Google de otra persona.
- **El gate va en la capacidad, no en la ruta.** Es la corrección que más importa de todo H2 y conviene que quede escrita para que nadie la «simplifique» a un gate de ruta: **gatear `/api/google/events` no cierra nada**, porque el `after()` del alta de citas llama exactamente a lo mismo y lo dispara cualquiera con permiso para agendar. El modo vive en la función; cada ruta calcula `puedeReparar` con `canManageClinica` antes de responder.
- **El commit 3 toca ocho archivos (H3).** Aceptado. Es la salida elegida de las dos posibles, razonada en §6; la otra dejaba un intermedio que sólo es correcto mientras la clínica tenga un solo médico.

---

**Con esto el plan queda cerrado.** No hay ninguna pregunta abierta: las seis de arriba y las tres de aquí están decididas, y los catorce hallazgos de §10 están absorbidos o resueltos. Lo siguiente es el código, en el orden de §6.

> **⚠ ANOTACIÓN 2026-08-19 — el plan siguió cerrado, y el producto no se paró.**
> Lo de arriba describe el estado del 2026-08-17 y sigue siendo cierto **de aquel
> día**. Entre entonces y hoy se tomaron decisiones de producto que cambian qué
> hay que construir, y **§12 las recoge**. No sigas al código sin leerla: manda
> sobre el cuerpo de este plan allí donde se contradigan.

---

# 12. Decisiones de producto posteriores al cierre

> **Añadida el 2026-08-19.** Las decisiones de aquí se tomaron DESPUÉS de cerrarse
> el plan y **mandan sobre el cuerpo del documento** donde discrepen. Vivían sólo
> en conversación, que es como se pierden: un agente que arrancara en blanco
> leyendo §0-§11 construiría otra cosa.
>
> El cuerpo del plan **no se ha reescrito**. Las secciones afectadas llevan su
> anotación en el sitio y apuntan aquí. Lo que decidieron en su momento era
> correcto; lo que cambió es el producto, no su razonamiento.

## 12.1 Los eventos escritos a mano — LA FUNCIÓN QUE CASI SE PIERDE

**El administrador escribe eventos a mano dentro del calendario secundario de
Spinus, desde Google Calendar, y esos eventos SE SIGUEN VIENDO en la agenda de
Spinus. No se elimina, no se aplaza y no se negocia.**

Es la decisión que más cerca estuvo de perderse por deducción técnica, así que va
primera y con el cuadro entero:

| | |
|---|---|
| **Quién los escribe** | El administrador, desde Google Calendar (web o móvil). Es el único con acceso a esa cuenta de Google |
| **Quién los ve en Spinus** | Administrador y secretaria. Nadie más |
| **Médico invitado** | **NO los ve.** Por esta vía recibe vacío. Sus propias citas las sigue viendo por `appointments` bajo RLS, y eso no cambia |
| **Cómo se ven** | Con su título tal cual, e **INERTES**: no se mueven, no se borran desde Spinus, sin paciente ni médico asignado |
| **En la base de datos** | **No existen.** Ni una fila en `appointments` |
| **Dónde aparecen** | **SÓLO en la agenda. NUNCA en la dashboard** |
| **Estilo** | Propio, apagado y de fondo, para que no compitan visualmente con las citas reales |
| **Control** | Interruptor en la agenda para mostrarlos u ocultarlos |
| **La raya que no se cruza** | En el momento en que alguien quiera ligarles un paciente se entra en el «camino de vuelta», que está **fuera de alcance** (§12.2) |

### ⛔ Opción descartada: retirar el array `events` del payload

**Se consideró y SE DESCARTA EXPRESAMENTE.** Queda escrita como opción muerta —no
sólo como decisión tomada— porque el razonamiento que lleva a ella es limpio,
reaparece solo, y **es exactamente cómo se destruiría esta función**.

El razonamiento tentador dice: si la ruta interseca, el array es 100% duplicado de
`/api/appointments`; si además la agenda deja de pintarlo (F10), no lo consume
nadie; luego retirarlo del payload para todos los roles satisface el vacío del
invitado sin un solo chequeo de rol, y un rol futuro hereda el comportamiento
correcto por construcción. Todo eso es cierto **bajo la intersección**.

**Y es exactamente el error.** El array sólo parece redundante porque la
intersección lo había vaciado de lo único que no era duplicado: los eventos
escritos a mano. Retirarlo mata la función de §12.1 sin que nadie lo note en una
revisión de código, porque no hay ningún test que pinte un calendario de Google.

> **A quien vuelva a proponerlo:** el array `events` **no** es redundante. Bajo la
> resta acotada por capacidad contiene justo lo que ninguna otra fuente tiene —lo
> que el administrador escribió a mano en Google— y es el único camino por el que
> eso llega a Spinus.

### El mecanismo que sí cumple

La fuga original **no venía de restar**: venía de restar contra un conjunto RLS
parcial. Un médico invitado sólo lee sus citas, así que la resta le dejaba las de
sus colegas como eventos crudos, con el nombre del paciente en el título.

Administrador y secretaria leen **todas** las citas de su clínica
(`appointments_select`, §12.11), así que para ellos la resta deja exactamente los
eventos escritos a mano. Sin fuga posible. El invitado no entra en esta ruta.

**Resta + capacidad, no intersección.** El vacío del invitado sale del helper de
lista blanca de §12.11, no de un `if` por rol en la ruta.

## 12.2 El «camino de vuelta» NO se construye

Que un evento nacido en Google se convierta en cita de Spinus **queda fuera de
alcance**. Caen con él, y no se echan de menos:

- los renglones sombra;
- ligar pacientes desde eventos de Google;
- el alta rápida desde un evento;
- la unión en la dashboard;
- la edición bidireccional de horarios, **con todo el aparato de `gcal_etag` e
  `If-Match`**.

El flujo es de un solo sentido: Spinus escribe en Google, y de Google sólo se
**lee** para pintar (§12.1).

## 12.3 Quién conecta Google

**Sólo el administrador. Una conexión por clínica.** Ni la secretaria ni los
médicos invitados conectan nada. Coincide con §2.5 y con la decisión 1 de §11, que
ya gateaban el callback y `/connect` con `canManageClinica`: esto lo confirma, no
lo cambia.

## 12.4 Médicos invitados: invitación por correo

Los médicos invitados **no conectan Google**. En su lugar, cada cita les manda una
invitación por correo (`attendees` + `sendUpdates`) para que les caiga en su propia
agenda, con **tres interruptores**:

1. el invitado **no puede modificar** el evento;
2. **no puede reenviar** la invitación;
3. **los invitados no se ven entre sí**.

Puede rechazarla: eso la quita de su calendario y **no altera** el de la clínica.

> **⚠ ASUMIDO Y NO PROBADO.** Que el scope `calendar.app.created` autorice invitar
> asistentes externos y disparar el correo **no está verificado**. Es
> comportamiento de Google, no del repositorio, y no se puede comprobar leyendo
> código. **Hay que probarlo con un evento real antes de construir nada encima.**
> Si resultara que no lo autoriza, esta decisión entera se queda sin suelo.

> **✅ ANOTACIÓN 2026-08-20 — VERIFICADO, Y EN VERDE. El aviso de arriba queda
> CUMPLIDO, no derogado:** se conserva porque describe la duda que hubo y por qué
> había que despejarla antes de construir nada encima. Ya está despejada.
>
> **El token de la app, bajo `calendar.app.created` y sin ningún scope más, SÍ
> puede invitar asistentes externos.** `events.insert` con `attendees` y
> `sendUpdates: 'all'` respondió **200** contra la conexión real de producción,
> con el asistente registrado en `responseStatus: needsAction`, **y el correo
> llegó a la bandeja del invitado** —comprobado a mano, que es la única forma:
> la respuesta de la API no dice si el correo salió—. **§12.4 tiene suelo.**
>
> **Los tres interruptores se aplicaron los tres:** `guestsCanModify`,
> `guestsCanInviteOthers` y `guestsCanSeeOtherGuests`, los tres en `false`. El
> tercero se confirmó además fuera de la API: el correo recibido dice
> literalmente que la lista de invitados se ocultó a petición del organizador.
>
> > **⚠ TRAMPA PARA QUIEN REPITA ESTA VERIFICACIÓN — el campo AUSENTE no
> > significa lo mismo en los tres.** Google omite estos campos de la respuesta
> > cuando valen su valor por defecto, y **los defaults NO son iguales**:
> > `guestsCanModify` es `false` por defecto, pero `guestsCanInviteOthers` y
> > `guestsCanSeeOtherGuests` son **`true`**. Un campo que no aparece quiere
> > decir «aplicado» en el primero y **«Google lo ignoró»** en los otros dos.
> > Hay que mirar el valor crudo, no si el campo está.
>
> **Google Meet: la API NO añade conferencia sola.** La respuesta vino sin
> `conferenceData` y sin `hangoutLink`. El enlace de Meet que aparecía al crear
> el evento a mano desde la interfaz era una **preferencia de la cuenta**, no de
> la API. **No hay que desactivar nada al crear eventos por código** — y conviene
> que quede dicho, porque el reflejo es añadir un apagado explícito «por si
> acaso», y eso es código que nadie sabría explicar después.
>
> ### El punto 2 de la lista de arriba hay que MATIZARLO
>
> «No puede reenviar la invitación» **se da por absoluto y no lo es.** Pese a
> `guestsCanInviteOthers: false`, el correo de Google incluye una nota que dice
> que si el destinatario reenvía la invitación, quien la reciba podrá responder
> al organizador, ser agregado a la lista de invitados o modificar la
> confirmación de asistencia.
>
> La lectura probable —**y va marcada como probable, no como verificada**— es que
> el interruptor impide añadir invitados **desde el evento** y no impide
> **reenviar el correo**. No es una fuga más allá de lo que ya viaja dentro de
> ese correo (el título con el nombre completo del paciente, §12.5), pero el
> punto 2 hay que leerlo así: **lo bloqueado es la invitación desde dentro del
> evento; el reenvío no lo bloquea Google.**
>
> ### Un dato para el commit 3, sin acción en él
>
> En la respuesta, **`creator` es el correo personal de quien administra** y
> `organizer` es el calendario de Spinus. El invitado ve como organizador
> «Spinus - <nombre>», que es lo correcto, pero el correo personal del
> administrador viaja en la respuesta de la API. No pide ningún cambio ahora;
> queda anotado también en §9, que es donde vive el inventario de lo que sale
> hacia fuera.
>
> **El artefacto que produjo esto:** `scripts/gcal-attendees-humo.ts`, de una
> sola ejecución —resuelve la conexión por el puente, crea el evento de prueba y
> lo borra él mismo—. **Estaba sin commitear al escribirse esta anotación**, así
> que puede no existir en el repo: si hay que repetir la verificación y no
> aparece, se vuelve a escribir. Lo que importa está en las líneas de arriba.

Nada de esto figura en §4: es alcance nuevo, no cubierto por ninguna fila F1-F13.

> **⚠ SEGUNDA ANOTACIÓN 2026-08-20 — LA INVITACIÓN DEJA DE SER AUTOMÁTICA Y DEJA
> DE SER SÓLO PARA EL MÉDICO.** El cuerpo de §12.4 dice «cada cita les manda una
> invitación por correo», y esa frase es la que cambia. Lo verificado sigue en
> pie —el token de la app puede invitar y el correo llega—; lo que cambia es
> **quién dispara el envío y a quién**.
>
> ### Un botón, no un efecto de crear la cita
>
> La invitación va por un botón **«Enviar invitación»** en el modal de la cita.
> Es una acción deliberada de quien está mirando esa cita, no algo que ocurra
> solo al guardarla.
>
> ### Dos destinatarios, independientes y los dos opcionales
>
> El **médico asignado** a la cita y el **paciente**, cada uno con su botón. Las
> dos acciones son **completamente opcionales por diseño**: ninguna es un paso
> del flujo de agendar.
>
> **LA CREACIÓN DE LA CITA NUNCA DEPENDE DEL CORREO.** Sin correo, con un correo
> mal escrito o con uno que rebota, **la cita se crea igual y no se bloquea
> nada**. Un correo inválido significa que no llega el correo, y ya. Esto no es
> tolerancia a fallos: es la regla, y hay que resistirse a «validar» de más.
>
> ### Cuándo NO se muestra el botón, y cuándo se muestra apagado
>
> | Situación | Qué se hace |
> |---|---|
> | El destinatario no tiene correo registrado | **El botón NO se muestra.** Mejor que enseñarlo deshabilitado sin que se entienda por qué |
> | La cita todavía no tiene evento en Google | **Deshabilitado, CON EL MOTIVO VISIBLE.** Invitar es un `patch` sobre el evento: sin evento no hay dónde invitar |
>
> El segundo caso no es raro y conviene saber cuándo pasa: la clínica no tiene
> Google conectado, o es la primera cita y el calendario aún no existe — que bajo
> el modo estricto de §3.3 le pasa a la secretaria y al médico invitado hasta que
> entre quien administra.
>
> ### No se guarda si ya se envió, y es una decisión
>
> El botón dice **«Enviar invitación» siempre** y se puede pulsar las veces que
> haga falta: Google **no duplica** el asistente, sólo reenvía el correo — que es
> justo lo que se quiere para quien lo perdió. **Se descarta a propósito una
> columna de «ya enviada»:** ahorra una migración y evita mantener sincronizado
> con Google un estado que Google ya conoce. **§12.15 se queda en cuatro
> migraciones** (más la quinta condicionada); esto no añade ninguna.
>
> ### El rechazo del paciente NO vuelve a Spinus
>
> El paciente puede rechazar la invitación desde su correo. **Spinus no hace nada
> con eso:** no cancela, no cambia el estado y no lee la respuesta. La
> notificación cae en el buzón de la cuenta de Google de la clínica y **la
> secretaria cancela a mano** en Spinus si procede.
>
> Leer el `responseStatus` desde Google sería **CAMINO DE VUELTA** y está fuera de
> alcance (§12.2). Es exactamente el razonamiento que §12.2 previene: parece un
> campo suelto y es la primera pieza de la sincronización bidireccional.
>
> ### Dónde vive cada correo — COMPROBADO CONTRA EL ESQUEMA, y con una corrección
>
> - **El del paciente:** `public.pacientes.email`, `text` **NULLABLE**
>   (`supabase/baseline/02_tables.sql:339`) y **sin ningún CHECK de formato**. O
>   sea que puede estar vacío y puede estar mal escrito, las dos cosas previstas
>   arriba. ✔ como se dijo.
> - **Y la cita puede no tener paciente en absoluto:** `appointments.paciente_id`
>   es nullable (`02_tables.sql:64`), que es la puerta de los eventos genéricos de
>   §12.14. Ahí el botón del paciente sencillamente no existe.
> - **El del médico:** en `auth.users`, sí. **`public.profiles` NO TIENE COLUMNA
>   `email`** — comprobado, son 16 columnas y ninguna es ésa
>   (`02_tables.sql:404-424`).
>
> > **⚠ CORRECCIÓN A «hay que ampliar `APPOINTMENT_SELECT`».** Ampliarlo **no
> > sirve, y no es cuestión de añadir un campo**: ese `select` trae al médico por
> > `medico:profiles!appointments_medico_id_fkey(...)`
> > (`src/lib/appointments.ts:11`), y en `profiles` **el correo no está**. No se
> > puede pedir lo que la tabla no tiene. Tampoco hay vista que lo exponga: el
> > esquema `public` **no tiene ni una** (`supabase/baseline/08_view.sql`), y
> > PostgREST no cruza a `auth` desde aquí.
> >
> > **El correo del médico sale por la API de Admin de Auth, con service role**,
> > que es como ya lo hace el repo hoy —`admin.auth.admin.listUsers()` en
> > `src/app/api/admin/usuarios/route.ts:20`, cruzando después por `id`—. Para un
> > solo médico lo que corresponde es la llamada dirigida (`getUserById`), no
> > barrer mil usuarios. La alternativa sería una columna o una vista: **migración**,
> > y no hace falta para esto.
> >
> > Consecuencia práctica: **es una consulta aparte, fuera de la forma canónica de
> > la cita**, y no un campo más viajando en el payload de la agenda.
>
> ### Lo que esto NO decide
>
> **Quién puede pulsar los botones.** El permiso de escritura de §12.7 está
> definido por COLUMNAS de `appointments`, y enviar una invitación no escribe
> ninguna: es un `patch` contra Google. Así que no queda cubierto ni a favor ni en
> contra. **Sin decidir; hay que zanjarlo al implementarlo.**

> **✅ TERCERA ANOTACIÓN 2026-08-20 — `guestsCanSeeOtherGuests`, VERIFICADO OTRA
> VEZ Y AHORA SÍ CON ALGO QUE OCULTAR. En verde.**
>
> ### Por qué hubo que repetirla
>
> La primera verificación (§12.12.3) dio verde en los tres interruptores, pero se
> hizo **con UN SOLO invitado**. Y ahí `guestsCanSeeOtherGuests` **no tenía nada
> que ocultar**: se guardó en `false` y no protegió nada, porque no había una
> lista que esconder. Un campo bien guardado no es un campo que funcione.
>
> Con la anotación de arriba eso deja de ser un detalle: ahora hay **dos**
> destinatarios en la misma cita, el médico y el paciente. **De ese verde depende
> que el correo personal de un médico no acabe en el buzón de un paciente, ni al
> revés.** Repetir la prueba con la lista llena era la única forma de saberlo.
>
> ### Qué se hizo y qué salió
>
> El 2026-08-20, con `scripts/gcal-attendees-humo.ts` ampliado para aceptar dos
> correos y meter a los dos como `attendees` del mismo evento, contra la conexión
> **real de producción**:
>
> - **Los dos asistentes entraron**, los dos en `responseStatus: needsAction`.
> - **`guestsCanSeeOtherGuests` siguió en `false` con la lista llena.**
> - **Y lo que la API no puede decir, comprobado en el buzón:** la invitación dice
>   literalmente que **la lista de invitados se ocultó a petición del
>   organizador**. Ni el médico ve el correo del paciente ni el paciente el del
>   médico.
> - **Nada más cambió** respecto de la primera pasada: mismo 200, mismos tres
>   interruptores, sin Meet.
>
> **El punto 3 de la lista de §12.4 —«los invitados no se ven entre sí»— queda
> verificado de verdad, no por defecto.** El script compara además campo a campo
> contra el resultado de la primera pasada, así que un cambio de comportamiento de
> Google entre las dos habría salido señalado.
>
> ### Una pieza para el inventario de §9, sin acción
>
> Que el paciente reciba invitación estrena un destinatario para algo que §9 ya
> tenía anotado: **`creator` es el correo personal de quien administra la
> clínica**. Antes viajaba al buzón del médico invitado; ahora también al del
> paciente. **No es fuga entre invitados** —eso es lo que acaba de verificarse—,
> es una identidad más saliendo de Spinus por la vía de Google. Sin acción en esta
> rama; cuenta para cuando se redacte lo del aviso de privacidad (§9 y §12.5).

> **✅ CUARTA ANOTACIÓN 2026-08-21 — EL MÉDICO PROPIETARIO SÍ RECIBE LA CITA, Y
> ESO ESTRENA UNA FUNCIÓN QUE NO SE BUSCABA. Detalle entero en §12.17.**
>
> Invitar al médico que **es dueño de la cuenta de Google conectada** no le manda
> correo —Google no notifica al organizador de su propio evento— pero **el evento
> sí entra en su calendario personal**. La invitación funciona; lo que no ocurre
> es el aviso.
>
> Con eso, esta sección resuelve de paso lo que **§12.9** daba por inalcanzable
> sin el scope sensible `calendar.acls`: cada médico ve **sus** citas en su propio
> Google, y sólo las suyas.
>
> **Consecuencia para el acuse, y es un pendiente:** el texto que dice que «Google
> le mandó la invitación por correo» **es falso en ese caso**. Cómo detectarlo y
> las tres trampas de hacerlo, en §12.17.
>
> Se descartaron además las **notificaciones del calendario** (`calendarList`)
> como forma de tapar ese supuesto hueco: no había hueco, y el plan B pedía scopes
> sensibles. La prueba no se ejecutó a propósito. §12.17.

## 12.5 El título lleva el nombre completo del paciente

**Decidido y no se discute.** El evento sigue llevando `Cita médica: <nombre>
<apellidos>` (`tituloParaGoogle`, `src/lib/appointments.ts`).

**Pendiente, fuera de esta rama:** actualizar el aviso de privacidad para declarar
que el nombre del paciente se comparte con el médico al que se le agenda la cita,
como parte del proceso de consulta, **sin información clínica ni sensible**. Ver la
anotación de §9: son dos rutas de salida que declarar, no una.

> **⚠ ANOTACIÓN 2026-08-21 — «SIN INFORMACIÓN CLÍNICA NI SENSIBLE» YA NO SE PUEDE
> PROMETER DEL TÍTULO. Amplía este pendiente; no lo sustituye.**
>
> La frase de arriba es exacta para una CITA, y ahí no cambia nada: su título lo
> compone `tituloParaGoogle` y sólo lleva el nombre. Pero los **eventos genéricos**
> de §12.14 llevan **título de texto libre**, escrito por el usuario y mandado a
> Google **sin filtro** — no hay forma de sanear texto libre, y montar un filtro
> que deje pasar lo que no reconoce sería peor que no tenerlo.
>
> **Decisión: se acepta.** Lo que la interfaz sí hace es advertirlo donde se
> escribe, con una línea fija bajo el campo del título.
>
> Para la redacción del aviso, esto significa que hay **dos afirmaciones
> distintas** y no una: de la cita se puede seguir prometiendo qué sale; del
> evento genérico hay que declarar que su contenido lo decide quien lo escribe.
> El detalle entero está en la tercera anotación de §9, que es donde vive el
> inventario. **Sigue fuera de esta rama.**

## 12.6 `freebusy` se elimina POR COMPLETO

Desaparecen el scope `calendar.events.freebusy` y los bloques anónimos de
«Ocupado». Deja sin efecto §0.3, el ítem correspondiente de F6, la cláusula de F10
y el escenario «1-2 sin 3» de §7 (todos anotados en su sitio).

**Inventario verificado el 2026-08-19.** El que circulaba estaba casi completo;
esto es lo que hay, con el hueco y las dos banderas que le faltaban:

| Archivo | Qué |
|---|---|
| `src/app/api/google/connect/route.ts` | el scope `:37` y su comentario `:34` |
| `src/app/api/google/callback/route.ts` | el comentario `:56-58` |
| `src/app/api/google/events/route.ts` | tipo `BloqueOcupado` `:11-12`; `consultarOcupado` `:54-94`; comentario de diseño `:43-53`; memoización `ocupadoPromesa` `:115-147`; campo `ocupado` `:175` |
| `src/lib/gcal.ts` | la mención en el docstring `:88` (cosmética) |
| `src/app/(app)/agenda/page.tsx` | `GoogleEventCard` prop `busy` y su rama de estilo; `renderEventContent` `:1178-1181`; en `gcalSource`, tipo local `BloqueOcupado` `:1399`, mapeo de `data.ocupado` `:1422`, título `'🔒 Ocupado'` `:1425` |
| **`src/app/(app)/agenda/page.tsx` — FALTABA** | **`MonthChip` `:1128-1170`**, el camino de la Vista Mes: lee `isGcalBusy` en `:1133` (`isGcalSinCita`) y limpia el `🔒` en `:1137`. Es el hermano del camino de Semana/Día |

**Dos hallazgos de propina, ninguno es de `freebusy`:**

- **`isGoogleEvent` (`agenda/page.tsx:1797`) es una bandera MUERTA.** Nadie la
  produce; sólo se escribe `isGcalBlock`. Se puede retirar, pero es limpieza
  aparte y no entra por arrastre.
- **`/api/google/events` tiene un único consumidor en todo el repo:**
  `gcalSource:1391`. `/perfil` usa `/api/google/calendar` y su comentario `:214`
  explica por qué.

**Lo que NO muere:** `gcalSource`, `GoogleEventCard` ni el carril de eventos de
Google. Ver la anotación de la tabla de §4.

## 12.7 Permiso de escritura en la agenda, por usuario

> # ⛔ CANCELADO EL 2026-09-01 — NO SE CONSTRUYE. LEE ESTO ANTES QUE NADA.
>
> **Todo lo que sigue en este apartado describe algo que ya no se va a escribir.**
> El commit 7 queda cancelado y con él sus dos migraciones (§12.15, migraciones 1
> y 2). El apartado **se conserva entero** —no se borra— porque es el razonamiento
> del que depende poder reabrirlo, y porque el reparto policy/trigger de más abajo
> sigue siendo la respuesta correcta *si* algún día vuelve a hacer falta.
>
> **El motivo: la barrera que este commit venía a construir YA EXISTE en la base.**
> Verificado en producción el 2026-09-01, y comprobable en el repo en
> `supabase/migrations/20260530_etapa5h_paso3_policies_appointments.sql:81-143`.
> Las **cuatro** policies de `appointments` —`appointments_select` (`:81`),
> `appointments_insert` (`:95`), `appointments_update` (`:109`) y
> `appointments_delete` (`:131`)— llevan **la misma** restricción:
>
> ```sql
> (medico_id = auth.uid()
>  OR public.soy_admin_de_clinica()
>  OR public.get_my_role() = 'secretaria')
> AND clinica_id = public.get_clinica_id()
> ```
>
> Y el `UPDATE` la aplica **en `qual` Y en `with_check`** (`:114` y `:122`), que es
> la mitad que se pasa por alto: sin el `with_check`, un médico invitado podría
> coger una cita que ya cumple el `USING` y dejarla apuntando a otro sitio. Con
> las dos, **no puede reasignarse una cita ajena**.
>
> **Lo único que el commit 7 habría añadido es que la interfaz no muestre botones
> que el servidor ya rechaza.** Eso es cosmético: nadie lo ha pedido, y cuesta dos
> migraciones sobre la tabla de la agenda.
>
> ### ⚠️ ESTA CANCELACIÓN SE APOYA EN ESAS POLICIES, Y EN NADA MÁS
>
> **Si algún día alguien las relaja, la decisión deja de valer y §12.7 vuelve a
> estar abierto.** No es una fórmula: es la condición literal. Relajar aquí
> significa cualquiera de estas cosas —quitar el `medico_id = auth.uid()`,
> ensanchar el `OR` a un rol más, dejar el `UPDATE` sólo con `USING` y sin
> `WITH CHECK`, o soltar el `AND clinica_id = get_clinica_id()`—. Cualquiera de
> ellas devuelve al médico invitado la capacidad que este apartado quería
> quitarle, y entonces hay que releer esto entero, no parchear la interfaz.
>
> ### Y lo que estas policies NO cubren, para que la reapertura se decida sobre lo cierto
>
> Cubren la **propiedad**: un médico invitado no toca las citas de otro. **No
> cubren sus propias filas**: sobre una cita suya sigue pudiendo crear, borrar y
> mover fecha, hora, duración y paciente — justo las cinco cosas de la lista «NO
> PUEDE» de abajo. Eso **no es un descuido de la cancelación**: es que ese trozo
> de §12.7 nunca fue seguridad, era preferencia de producto («por defecto APAGADO
> para los médicos invitados»), y hoy se acepta que un médico invitado gestione su
> propia agenda. Queda escrito para que quien reabra esto no crea que las policies
> prometían más de lo que prometen.
>
> El registro de la decisión, en **§12.19**.

> **Reescrito el 2026-08-20.** La primera versión de este apartado decía que
> apagado significaba «no crea, no mueve, no cancela y no borra nada, ni siquiera
> lo suyo». **Era cierto en intención y llevaba al error en la implementación:**
> traducido directo a SQL —bloquear el `UPDATE` entero— dejaría al médico invitado
> sin poder marcar una cita como confirmada o como no asistió, algo que **hoy hace
> y tiene que seguir haciendo**. Se conserva dicho aquí porque es el atajo que
> cualquiera vuelve a tomar al leer «no escribe».

Lo administra el administrador desde el panel. **Por defecto ENCENDIDO para la
secretaria y APAGADO para los médicos invitados.**

### El permiso NO es un interruptor sobre la operación: es sobre QUÉ COLUMNAS se tocan

Un médico invitado **SIN** permiso de escritura **PUEDE**:

- leer todas sus citas y abrir el modal;
- cambiar **`status`**, a cualquiera de los estados de la cita. **«Cancelada» es
  sólo un estado visual**: cambia el color de la cita y **NO borra la fila**;
- cambiar **`consultorio_id`** — es el lugar físico y no afecta al horario;
- cambiar las **notas** de la cita;
- pulsar **«Iniciar consulta»**.

Un médico invitado **SIN** permiso de escritura **NO PUEDE**:

- **crear** citas ni **borrarlas**;
- cambiar el **paciente**;
- cambiar la **fecha y hora de inicio**;
- cambiar la **duración**;
- cambiar el **médico asignado**.

Con el permiso **ENCENDIDO** puede todo, como hoy. **Secretaria: encendido por
defecto. Médicos invitados: apagado por defecto.**

> **Dependencia cruzada, y no es negociable:** §12.7 **tiene** que permitir
> `status` pase lo que pase. Si se bloqueara, el médico invitado no podría pulsar
> «Iniciar consulta», que a partir de §12.13 escribe el estado.

### Dónde vive cada mitad de la regla

**Una policy RLS no sabe qué columna cambió.** `USING` y `WITH CHECK` ven la fila
entera, antes y después, pero no pueden decir «este `UPDATE` sólo tocó `status`».
De ahí el reparto, y conviene tenerlo escrito antes de escribir SQL:

| Qué | Dónde |
|---|---|
| Bloquear `INSERT` y `DELETE` | **Policy** sobre `appointments`. Es lo que una policy sí sabe hacer |
| Bloquear el cambio de `paciente_id`, `start_time`, `end_time` y `medico_id` | **TRIGGER** sobre `appointments`, comparando `NEW` contra `OLD` **columna por columna**, con `IS DISTINCT FROM` |

Es el mismo patrón que ya usa `proteger_columnas_sensibles_profiles`
(`20260602_sec_proteger_columnas_sensibles_profiles.sql`), y por el mismo motivo:
la policy restringe la fila, el trigger restringe la columna.

**Tres condiciones, y las tres son de seguridad, no de diseño:**

1. **La regla va en la POLICY de `appointments`, no sólo en la ruta.** Si vive
   sólo en el endpoint, se escribe directo por PostgREST y el permiso es
   decorativo.
2. **La columna nueva entra en el trigger que ya protege `role`, `clinica_id` y
   `es_admin_de_clinica` en `profiles`**
   (`20260602_sec_proteger_columnas_sensibles_profiles.sql`). Sin eso, un médico
   invitado se concede el permiso a sí mismo con un `UPDATE` — la policy
   `profiles_update` restringe la fila, no las columnas.
3. **El administrador no debe poder quitárselo a sí mismo.**

**Dos migraciones, no una** (§12.15, migraciones 1 y 2), y **commit propio al final
de la serie de §6** — el porqué, en la anotación del final de §6.

> **⚠ ANOTACIÓN 2026-08-21 — LAS DOS COLUMNAS DE §12.14 VAN DEL LADO PERMITIDO, Y
> SE ESCRIBE AQUÍ PARA QUE NO SE DECIDA POR OMISIÓN.**
>
> Las listas de arriba se escribieron antes de que existieran
> `appointments.icono` y `appointments.color` (§12.14, migración 4, ya aplicable),
> así que **no las nombran ni a favor ni en contra**. Y eso importa más de lo que
> parece: **el trigger de la migración 2 se escribe con una lista cerrada**, así
> que lo que no esté nombrado queda decidido por quien lo teclee.
>
> **Un médico invitado SIN permiso de escritura PUEDE cambiar `icono` y
> `color`.** Se suman a la lista de lo que sí puede, junto a `status`,
> `consultorio_id` y las notas. El criterio es el mismo que separa las dos listas:
> no mueven un horario, no cambian de paciente y no reasignan a nadie — sólo
> cambian cómo se ve el evento en la agenda.
>
> Queda dicho además en el propio archivo de la migración 4 y en el PUT de
> `/api/appointments/[id]`, para que quien escriba el trigger lo encuentre por
> los dos caminos.

> **Dimensión 15 de `supabase/AUDITORIA-MIGRACIONES.md`, y aquí es donde más
> importa:** el alcance de los roles se comprueba **en las dos direcciones**. No
> basta con verificar que un invitado sin permiso **no** pueda mover una cita:
> hay que verificar que **sí** pueda cambiar `status`, `consultorio_id` y las
> notas. Un trigger de más es tan defecto como uno de menos, y el de más es el que
> nadie reporta como bug de seguridad — se reporta como «la app no me deja
> confirmar».

## 12.8 Eventos genéricos sin paciente

Se quiere poder crear en la agenda **eventos genéricos sin paciente ligado**:
cirugía, reunión, bloqueo de horario. **Si un médico quiere bloquear un espacio por
un compromiso, lo hace en Spinus, no en Google.**

Ojo con no confundirlos con los de §12.1: estos **sí** son filas de
`appointments`, nacen en Spinus y se sincronizan a Google como cualquier cita. Los
de §12.1 nacen en Google y no existen en la base.

> **Desarrollado en §12.14** (2026-08-20): qué soporta ya la base, las dos columnas
> nuevas y el trabajo de interfaz que hace falta.

## 12.9 Compartir el calendario en lectura

El calendario de la clínica **se puede compartir en modo lectura desde Google, a
mano**, eligiendo el papel `reader`. Es **opcional y no lo hace Spinus**:
automatizarlo pediría el scope sensible `calendar.acls`, que es justo lo que toda
esta arquitectura evita. Conecta con §9: el ACL de ese calendario vive en Google,
fuera de la RLS y fuera de `audit_log`.

> **⚠ ANOTACIÓN 2026-08-21 — ESTO YA NO ES LA RESPUESTA A «CÓMO VE UN MÉDICO SU
> AGENDA EN GOOGLE». Ver §12.17.** Todo lo de arriba sigue siendo cierto y este
> apartado no se retira: compartir en lectura sigue disponible, a mano, y la nota
> sobre el ACL fuera de la RLS sigue vigente.
>
> Lo que cambió es que **hay otro camino, y es mejor**: la invitación de §12.4
> mete el evento en el calendario personal del médico aunque no le llegue correo,
> y le mete **sólo sus citas**. `calendar.acls` habría compartido el calendario
> entero —las de todos—, así que lo que este apartado daba por inalcanzable sin
> scope sensible resulta estar ya resuelto, y con mejor alcance.

## 12.10 Avisos al usuario

Tres, y los tres sobre lo mismo:

1. **Un modal al conectar Google**, para quien conecta.
2. **Una línea fija** junto al estado de la conexión en el perfil.
3. **Un aviso contextual** la primera vez que a esa persona le aparece un evento
   nacido en Google en su agenda, con casilla de **«no mostrar más»**.

**El texto debe decir** que esos eventos no tienen paciente ligado, que **no se
puede iniciar consulta** desde ellos y que **NO aparecen en la dashboard, sólo en
la agenda**.

> **PENDIENTE DE ZANJAR:** dónde se guarda el «no mostrar más» por usuario. Hoy no
> hay sitio, y si va en la base es columna y por tanto migración. Ver §12.12.

> **⚠ ANOTACIÓN 2026-08-20 — sigue pendiente, y ya es lo ÚNICO.** Cerrados los
> cuatro puntos de §12.12, **este aviso es el último asunto abierto de todo §12**.
> Lo que sí quedó decidido es que **el aviso pertenece a esta rama** (§12.12.1);
> lo que no, es **dónde vive el «no mostrar más»**. Si acaba en la base, es la
> quinta migración de §12.15.

> **⚠ SEGUNDA ANOTACIÓN 2026-08-20 — sigue siendo lo único, y ahora sin
> asterisco.** La anotación de arriba se escribió con §12.12.3 *decidida* pero
> **no ejecutada**: la verificación de `attendees` estaba por hacer y §12.4 entera
> colgaba de ella, así que «último asunto abierto» convivía con un supuesto sin
> comprobar. **Ya se ejecutó, y salió en verde** (§12.12.3 y la anotación de
> §12.4). Con eso, **dónde se guarda el «no mostrar más» por usuario es el ÚNICO
> asunto abierto de todo §12**, sin nada pendiente detrás.

> **⚠ TERCERA ANOTACIÓN 2026-08-20 — «el único» pasa a ser «uno de dos».** Las dos
> anotaciones de arriba eran ciertas al escribirse y han dejado de serlo por un
> añadido, no por un error suyo: **§12.16** recoge un caso que el plan no
> contemplaba —reconectar con **otra cuenta de Google**— y queda **sin decidir**.
> Lo de aquí sigue abierto exactamente igual; lo que ya no es cierto es que esté
> solo.

> **✅ CUARTA ANOTACIÓN 2026-08-21 — DECIDIDO, Y CIERRA ESTE PUNTO: EL «NO MOSTRAR
> MÁS» SE GUARDA EN EL NAVEGADOR, NO EN LA BASE.**
>
> Con esto, **el punto que llevaba abierto desde el 2026-08-19 queda cerrado** y
> las tres anotaciones de arriba dejan de estar pendientes. Lo único abierto de
> §12 pasa a ser §12.16.
>
> **El razonamiento, que es lo que hay que conservar:** son **preferencias de
> vista**. No requieren trazabilidad, no hay nada que auditar ni que
> reconstruir, y a nadie le hace daño que se pierdan al cambiar de dispositivo —
> como mucho el aviso reaparece una vez—.
>
> Y una columna en `profiles` **no es gratis**: pasa por las 15 dimensiones de
> `supabase/AUDITORIA-MIGRACIONES.md`, y encima entra en la lista del **trigger
> guardián** del commit 7 (§12.7, migración 1), que es donde se decide qué
> columnas puede tocar cada quien. Eso para una casilla de «no volver a
> enseñarme esto».
>
> **Lo mismo vale para el interruptor de mostrar u ocultar los eventos de Google**
> en la agenda (§12.1): misma naturaleza, mismo sitio, misma decisión.
>
> **Consecuencia para §12.15:** la «quinta migración condicionada» que aquella
> tabla arrastraba **DESAPARECE**. No es que se aplace: no va a existir.

## 12.11 Hechos verificados el 2026-08-19

- **El puente está APLICADO y verificado en producción.**
  `20260818_gcal_puente_secretos.sql`; comprobado con `SELECT proname FROM pg_proc
  WHERE proname = 'leer_conexion_google_con_secretos'`, que devuelve una fila. La
  cabecera del archivo ya está corregida.
- **La app está EN PRODUCCIÓN en Google Cloud, tipo Usuarios externos, y el tope
  de 100 usuarios NO aplica** porque no se piden scopes sensibles. **Dos avisos que
  conviene no perder:** ese contador **no se puede restablecer nunca**, así que
  pasaría a ser una barrera real el día que alguien añada un scope sensible; y
  «Volver al modo de prueba» está **a un clic** en la consola, lo que activaría el
  tope de golpe.
- **`appointments_select`** permite a la secretaria y al administrador leer
  **todas** las citas de su clínica; al médico invitado, sólo las suyas
  (`medico_id = auth.uid()`), y **las citas con `medico_id` NULL le son
  invisibles** (`20260530_etapa5h_paso3_policies_appointments.sql:81-94`).
- **`clinica_conexiones_google_select` filtra sólo por `clinica_id`, sin filtro por
  usuario** (`20260817_gcal_conexion_clinica_a_esquema.sql:338-342`). **Un médico
  invitado resuelve la conexión de la clínica igual que el administrador.**

> **Consecuencia directa, y hay que tenerla escrita porque la intuición dice lo
> contrario:** el vacío del médico invitado en `/api/google/events` **NO puede
> derivarse de «no tiene conexión que resolver». Esa premisa es FALSA.** Necesita
> un **helper de capacidad explícito en `src/lib/permissions.ts`**, construido
> como **LISTA BLANCA** —administrador **o** secretaria—, **nunca** como negación
> de `isMedicoInvitado`: así un rol futuro cae en vacío por defecto, que es el
> fallo seguro. El nombre del helper no está fijado.

## 12.12 Los cuatro puntos abiertos — CERRADOS el 2026-08-20

> Estaban abiertos desde el 2026-08-19 y **los cuatro tienen respuesta**. Se
> conserva el enunciado original de cada uno para que se vea qué se preguntaba, y
> debajo la respuesta **con su porqué**: el veredicto solo no sirve, porque el que
> venga detrás va a querer saber si su caso es el mismo.

### 12.12.1 — ¿A qué rama pertenecen §12.7 y el «no mostrar más» de §12.10?

**SON DE ESTA RAMA.**

**Consecuencia inmediata:** §0.10 («sin migración») deja de ser cierto, y está
anotado allí. Esta rama pasa a llevar **cuatro migraciones** (§12.15), con una
quinta condicionada a dónde acabe guardándose el «no mostrar más» — que **sigue sin
decidirse** y es lo único que queda abierto de todo §12.12.

**Todas pasan por `supabase/AUDITORIA-MIGRACIONES.md` y sus 15 dimensiones antes de
aplicarse**, con atención especial a la **dimensión 15**: el alcance de los roles se
comprueba **en las dos direcciones**. Ver la nota al final de §12.7.

**Mitigación de riesgo, y es parte de la respuesta, no un añadido:** el permiso de
escritura va en **su propio commit, al final de la serie de §6**. Hoy los médicos
invitados pueden crear citas; después no podrán. Es un cambio de comportamiento
visible para usuarios reales y **tiene que poder revertirse solo, sin arrastrar el
arreglo de la conexión por clínica**, que es el bug que motiva toda la rama.

### 12.12.2 — El techo de `maxResults: 100`

**SE ARREGLA EN EL COMMIT 2.**

**Por qué ahí y no después:** es el commit 2 el que convierte ese techo en un
problema real. Hoy, con la resta contra el calendario propio, lo que se pierde
pasados los 100 es material duplicado. Al pasar a la **resta acotada por
capacidad**, lo que sobrevive al filtro son los **eventos escritos a mano** (§12.1),
que **no están duplicados en ninguna otra fuente**. Un evento que desaparece en
silencio es el peor fallo posible: nadie lo reporta porque nadie sabe que faltaba.

**Y por qué es barato:** no es paginación completa. Es un **bucle de `pageToken`**
sobre la llamada que ya existe (`events/route.ts:138-145`), en un archivo que el
commit 2 toca igualmente.

### 12.12.3 — La verificación de `attendees`

**ANTES DEL COMMIT 3, y la hace Angel a mano.**

**No bloquea el commit 2.** Bloquea **§12.4 entera**.

**Por qué no se puede resolver aquí:** es comportamiento de Google, no del
repositorio. La prueba es crear un evento real con un `attendee` y comprobar si
llega el correo. Ninguna cantidad de lectura de código la sustituye.

**Qué pasa si sale que no:** si `calendar.app.created` no autoriza invitar
asistentes externos, §12.4 se queda sin suelo y hay que **replantear cómo le llega
la cita al médico invitado**. No es un ajuste: es volver a la mesa.

> **✅ EJECUTADA EL 2026-08-20 — EN VERDE. YA NO BLOQUEA NADA.**
>
> Se hizo con `scripts/gcal-attendees-humo.ts` contra la conexión **real de
> producción**: token resuelto por el puente, evento de prueba creado con un
> `attendee`, y borrado por el propio script al terminar. `events.insert`
> respondió 200 con el asistente registrado, y **el correo llegó** —comprobado en
> la bandeja del invitado, porque la API no lo dice—.
>
> **El «qué pasa si sale que no» de arriba NO se activa.** No hay que replantear
> cómo le llega la cita al médico invitado: §12.4 tiene suelo y deja de colgar de
> un supuesto.
>
> El resultado entero —los tres interruptores, la trampa de los defaults, el Meet
> que no aparece, el matiz sobre el reenvío y el dato de `creator`— está en la
> anotación de **§12.4**, que es donde sirve. Aquí sólo consta que la pregunta
> está respondida.
>
> > **✅ Y SE REPITIÓ, el mismo 2026-08-20, con DOS invitados.** Esta ejecución se
> > hizo con uno solo, así que `guestsCanSeeOtherGuests` dio verde **sin haber
> > ocultado nada**. Al pasar §12.4 a dos destinatarios —médico y paciente— hubo
> > que probarlo con la lista llena: salió en verde, y esta vez también **en el
> > buzón**, donde el correo dice que la lista de invitados se ocultó a petición
> > del organizador. **El resultado está en la tercera anotación de §12.4.**

### 12.12.4 — `isGoogleEvent`

**SE BORRA EN EL COMMIT 2.** Bandera muerta en `agenda/page.tsx:1797`; nadie la
produce. El commit 2 ya está dentro de ese archivo retirando todo lo de «Ocupado»,
así que no abre un frente nuevo.

---

## 12.13 El estado «atendida»

**Hoy «Iniciar consulta» NO escribe.** No cambia el estado de la cita: el estado se
cambia a mano en el modal. **Pasa a escribir:** al pulsarlo, una cita `agendada` o
`confirmada` pasa a **`atendida`**.

**Ese estado NO EXISTE.** El CHECK de `appointments.status`
(`supabase/baseline/02_tables.sql:82-84`) sólo admite `scheduled`, `confirmed`,
`cancelled` y `no_show`. **Hace falta migración** (§12.15, migración 3).

> **⚠ CABO SUELTO A RESOLVER AL IMPLEMENTARLO — verificado el 2026-08-20.**
> `STATUS_COLOR` en `src/app/api/appointments/[id]/route.ts:296-301` **ya incluye
> `completed: '8'`** (línea 300). Es una rama **hoy muerta**: la base rechaza ese
> valor, así que nunca se ha evaluado.
>
> **O se reutiliza ese nombre o se limpia, pero no pueden convivir dos nombres para
> el mismo concepto.** Un `completed` en el código y un `atendida` en la base es
> exactamente el tipo de desajuste que sobrevive años porque las dos mitades
> «funcionan».

**Decisión tomada sobre el fallo:** si el guardado del estado falla al iniciar
consulta, **la consulta SE ABRE IGUAL** y el estado se reintenta. **Bloquear la
atención de un paciente por un fallo de red es peor que un estado desactualizado.**

**Dependencia con §12.7:** esto obliga a que el permiso de escritura **permita
`status` siempre**. Si se bloqueara, el médico invitado no podría iniciar consulta
— que es justamente lo que va a hacer todo el día.

> **⚠ ANOTACIÓN 2026-08-21 — EL MECANISMO CAMBIA DE SITIO. EL «AL PULSARLO» DE
> ARRIBA NO SE PUEDE CONSTRUIR.** Lo que esta sección decide —que iniciar una
> consulta marque la cita— se mantiene entero; lo que cambia es **cuándo se
> escribe**. Se conserva el texto original porque el atajo que propone es el que
> cualquiera vuelve a tomar al leer «al pulsarlo».
>
> ### Por qué no se puede
>
> **«Iniciar consulta» no es un botón: es un enlace de navegación**, en los tres
> sitios donde existe (`agenda/page.tsx`, y dos veces en `dashboard/page.tsx`).
> Una petición disparada en el clic **compite con la navegación** y el navegador
> puede abortarla. «El estado no se guarda» no sería el caso raro, sería el
> normal. Y el «se reintenta» que promete el párrafo de arriba **no tenía dónde
> vivir**: no hay ningún sitio en el cliente que sobreviva a la navegación para
> alojar un reintento.
>
> ### Dónde se escribe ahora
>
> **En el servidor, en `POST /api/consultas`, cuando la consulta se crea de
> verdad** — que es cuando la fila de `consultas` nace y no antes: entrar a la
> pantalla de nota no escribe nada en la base, sólo un borrador cifrado en
> `secureStorage`.
>
> Lo que se gana, y por eso se elige: no hay petición que el navegador pueda
> abortar; no hace falta reintento; si falla, falla donde alguien lo ve; y da
> igual desde cuál de los tres botones se haya llegado, porque los tres acaban en
> el mismo sitio. **Efecto secundario buscado:** quien pulsa y se arrepiente sin
> escribir nada **NO deja la cita marcada**, que es más correcto que lo contrario.
>
> ### Lo que hizo falta para que el servidor sepa de qué cita se trata
>
> **No existía relación entre `consultas` y `appointments`** — ninguna columna,
> ninguna foreign key salvo `paciente_id`, y los tres enlaces no pasaban nada por
> la URL. Sin eso el mecanismo no se sostiene, así que **§12.15 pasa a cinco
> migraciones**: `consultas.appointment_id`, con FK `ON DELETE SET NULL`.
>
> Se eligió columna, y no un parámetro de paso, porque la columna da lo que el
> parámetro no: **trazabilidad permanente** («¿de qué cita salió esta consulta?»)
> y el dato que permite calcular **cuántas citas agendadas acaban en consulta**.
> El identificador sigue viajando por la URL del enlace (`?cita=<uuid>`) y por el
> cuerpo del POST: eso es el transporte, la columna es la memoria.
>
> ### Las reglas exactas, tal como quedaron
>
> - **La transición vive en el `WHERE` del UPDATE**, no en un CHECK: un CHECK ve
>   la fila, no la transición. `AND status IN ('scheduled','confirmed')`.
> - **La idempotencia sale de ese mismo `WHERE`.** Una segunda consulta sobre la
>   misma cita no casa ninguna fila y no hace nada. Sin leer antes de escribir no
>   hay carrera entre las dos cosas.
> - **`cancelled` y `no_show` NO se tocan.** Machacarlos borraría una afirmación
>   que alguien hizo a propósito, y en `cancelled` la base diría «atendida»
>   mientras el evento de Google conserva su prefijo «CANCELADA — ». Se corrige a
>   mano en el modal, que es donde se afirmó.
> - **Sin cita no se marca nada**, y no es una comprobación sino una ausencia: el
>   caso por defecto es no marcar. Cubre al paciente que llega sin agendar.
> - **Ningún fallo de este camino impide guardar la nota.** Un id malformado, una
>   cita de otra clínica o de otro paciente caen todos a «se ignora el vínculo, se
>   guarda la nota, queda la línea de log». Es la decisión de esta sección llevada
>   a su sitio.
>
> ### El nombre en la base es `attended`
>
> No `atendida` —los otros cuatro valores de la columna son inglés— y no
> `completed`, que era el nombre muerto que el código traía en `STATUS_COLOR`: el
> estado se escribe cuando la consulta **empieza**, así que «completada» sería
> falso durante toda la consulta. `attended` es además el antónimo exacto de
> `no_show`. **La etiqueta de cara al médico sigue siendo «Atendida».** El
> `completed: '8'` se retiró y su `colorId` (grafito) pasó a `attended`.
>
> ### Coste aceptado: Google no se entera
>
> Como esto **no pasa por `PUT /api/appointments/[id]`**, el evento conserva el
> color que tuviera y no recibe el `colorId` de `attended`. Replicarlo metería un
> `events.get` + `events.patch` **en el camino crítico de guardar una nota
> clínica**, a cambio de un matiz de color en un evento que ya pasó. **Aceptado,
> no pendiente.** El `colorId` sí funciona cuando alguien marca el estado a mano
> desde el modal, que sí pasa por el PUT.
>
> ### Un defecto viejo que se encontró al lado y NO se arregla aquí
>
> `STATUS_COLOR` no tiene entrada para `scheduled`, así que el patch no manda
> `colorId` y **Google conserva el anterior**: reactivar una cita cancelada le
> quita el prefijo del título **pero la deja roja** en el calendario. Es anterior
> a todo esto y arreglarlo toca el color de citas que ya existen. Queda anotado.

---

## 12.14 Eventos genéricos sin paciente — desarrollo de §12.8

> **⚠ ANOTACIÓN 2026-08-22 — LAS DOS LISTAS DE VALORES DE ESTA SECCIÓN ESTÁN
> SUPERADAS. LA FORMA NO.**
>
> Todo lo que esta sección dice sobre *por qué* hay dos columnas, *por qué* llevan
> CHECK contra lista cerrada y *por qué* son nullables **sigue vigente palabra por
> palabra**. Lo que ya no vale son los VALORES: los cinco iconos y los cuatro
> colores de más abajo eran provisionales por decisión propia —esta sección lo
> anuncia dos veces— y el rediseño del calendario los sustituyó.
>
> **Las listas vigentes están en `20260822_agenda_pinta_definitiva.sql`**, que
> reemplaza los dos CHECK de la migración 4:
>
> - **20 iconos**, y el identificador es el nombre de un archivo de
>   `/public/icons/` sin `.svg`: `cirugia` · `instrumental` · `urgencias` ·
>   `internamiento` · `ronda` · `columna` · `ortopedia` · `imagen` ·
>   `ultrasonido` · `rehabilitacion` · `laboratorio` · `vacuna` · `junta` ·
>   `videollamada` · `docencia` · `congreso` · `viaje` · `comida` · `personal` ·
>   `bloqueo`.
> - **6 colores**: `indigo` #3730a3 · `magenta` #a21caf · `carmin` #be185d ·
>   `oliva` #4d7c0f · `bronce` #78350f · `grafito` #1f2937.
>
> **⚠⚠ `teal` y `pizarra` se propusieron para esa paleta y SE RETIRARON. No los
> reintroduzcas.** Son, literalmente, los colores de dos estados de cita:
> `teal` es el de «atendida» (#0f766e) y `pizarra` el de «no asistió» (#64748b) —
> a **cero grados de hue** del estado que imitan. La tabla de más abajo retiró
> `cian` por estar a diecisiete grados de ese mismo teal, así que el criterio ya
> estaba fijado y estos dos lo incumplían por el doble. `grafito` es el neutro que
> `pizarra` iba a cubrir. `magenta` sustituye a `fucsia` sólo por nombre.
>
> **Y un matiz que la tabla de abajo no recoge y hace falta para añadir colores:**
> no todos se separan de los estados por hue. Medidos contra los estados vigentes,
> `grafito` está a 0.4° del gris de «no asistió», `indigo` a 11.4° del morado de
> Google, `bronce` a 21.7° del rojo de «cancelada» y `carmin` a 24.9° de ese rojo.
> Lo que los separa ahí es la **claridad**, no el tono. Comprobar sólo el hue —que
> es lo que la tabla de abajo insinúa— daría por bueno un choque.
>
> **`indigo` se repite de nombre pero NO es el mismo color:** su hex pasó de
> #4338ca a #3730a3. Por eso el constraint se rehízo entero en vez de ampliarse.

Un evento genérico es **una fila de `appointments` SIN paciente**: nace en Spinus y
se sincroniza a Google como cualquier cita.

> **No confundir con §12.1.** Los de §12.1 nacen **en Google**, no existen en la
> base y son inertes. Los de aquí nacen **en Spinus**, son filas de verdad, y por
> tanto **sí aparecen en la dashboard** — al revés que los de §12.1, que no
> aparecen nunca. Esa diferencia es la razón de que haya que arreglar los dos
> consumidores del final de este apartado.

### Lo que la base ya soporta (verificado el 2026-08-20)

- **`paciente_id` es nullable** (`supabase/baseline/02_tables.sql:64`), con FK
  `ON DELETE SET NULL` (`04_foreign_keys.sql:33-36`).
- **`title` es NOT NULL** (`02_tables.sql:66`) — o sea que el campo donde va el
  texto del evento ya existe y ya es obligatorio.
- **`eventoParaGoogle`** (`src/lib/appointments.ts:43-45` y `:75-81`) **ya está
  escrita para el caso sin paciente**: cae al título libre y compone la
  descripción sólo con el nombre de la clínica.
- **`POST /api/appointments:198`** ya acepta `paciente_id: null`.

**No hace falta tocar nada de eso.** El trabajo está arriba, en la interfaz, y en
dos columnas nuevas.

### El título es texto libre

El usuario escribe lo que quiera: «Cirugía Sr. Pérez», «Junta de personal», «Bloqueo
— consulta externa». **NO hay tipos cerrados de evento.** Se usa el `title` que ya
existe; **para esto no hace falta ninguna columna**.

### Dos columnas nuevas, las dos con CHECK contra lista cerrada

Un **icono** (de una lista predeterminada) y un **color** (de una paleta).

> **El CHECK no es desconfianza del usuario.** Si la columna admite cualquier cosa,
> un fallo de interfaz o un `UPDATE` por PostgREST mete un valor que la agenda no
> sabe pintar, **y el evento sale roto** — sin error, sólo mal. La lista cerrada
> convierte eso en un rechazo de la base.

**Forma propuesta** (nombres provisionales, nullables porque una cita normal no
lleva ninguno):

```sql
icono text CHECK (icono IS NULL OR icono = ANY (ARRAY[...])),
color text CHECK (color IS NULL OR color = ANY (ARRAY[...]))
```

**⚠ LOS VALORES DE ABAJO SON PROVISIONALES.** Claude Design va a proponer la
iconografía y rehacer la estética del calendario más adelante, **y los va a
sustituir**. Lo que queda **FIJO es la forma** —dos columnas con CHECK contra lista
cerrada—, porque cambiar los valores después es trivial y **cambiar de texto libre a
lista cerrada no lo es**: obliga a migrar datos que ya no encajan.

**Iconos iniciales:** `bisturi` (cirugía), `personas` (reunión), `candado` (bloqueo
de horario), `avion` (ausencia o viaje), `libro` (formación), `punto` (genérico, sin
icono).

**Paleta inicial.** Restricción dura: **ningún color puede colisionar con los de los
estados de cita**, o un evento genérico se confundirá con una cita de un vistazo.
Ocupados hoy (`src/app/globals.css:90-97`): azul `#2f6fed` (agendada), verde
`#16a34a` (confirmada), rojo `#dc2626` (cancelada), gris pizarra `#64748b` (no
asistió) — **más el que se lleve «atendida»** (§12.13), que aún no está elegido, y
**más el morado `#7c5cdb`** que ya es de los eventos de Google (`--ag-gcal-*`,
`:100-104`). Con eso fuera:

| Nombre | Hex | Se mantiene lejos de |
|---|---|---|
| `ambar` | `#d97706` | nada cercano |
| `cian` | `#0891b2` | del verde de «confirmada» |
| `rosa` | `#db2777` | del rojo de «cancelada» |
| `terracota` | `#9a3412` | del rojo y del ámbar |
| `indigo` | `#4338ca` | del azul de «agendada» y del morado de Google |

> Al elegir el color de «atendida» (§12.13) **hay que mirar esta tabla**, no sólo la
> de estados: son la misma paleta compartiendo un calendario.

### Trabajo de interfaz que esto exige (verificado el 2026-08-20)

- **El modal impide guardar sin paciente:** `handleSave` aborta
  (`agenda/page.tsx:563`) y el botón está deshabilitado (`:865`).
- **El título se compone del paciente** (`:580`) y **no hay campo de título
  libre**. Hay que crearlo.
- **`POST /api/appointments` exige `consultorio_id`** (`:89-94`) y, para
  administrador y secretaria, **`medico_id`** (`:136-140`).

  > **DECISIÓN — un evento genérico exige los dos igual que una cita.** No es
  > inercia; es que quitarlos rompe cosas concretas:
  >
  > - **`medico_id`:** `appointments_select` deja al médico invitado **sólo** las
  >   filas con su `medico_id`, y **las de `medico_id` NULL le son invisibles**
  >   (§12.11). Un bloqueo de horario sin médico sería invisible **justo para la
  >   persona cuyo tiempo bloquea**.
  > - **`consultorio_id`:** su snapshot alimenta el badge de zona horaria
  >   (`consultorio_timezone`) y toda la agenda lo da por presente desde la Fase
  >   2.6. Hacerlo opcional estrena una segunda forma de fila que **todos** los
  >   consumidores tendrían que contemplar.
  >
  > El coste es escoger consultorio para una junta, y el consultorio por defecto
  > ya viene preseleccionado. **Es la decisión más reversible de las dos**: dejar
  > de exigirlo después es fácil; empezar a exigirlo sobre filas que ya existen sin
  > él, no.

- **DOS CONSUMIDORES PINTAN UN RENGLÓN VACÍO, y se arreglan en el mismo commit:**
  `src/app/(app)/dashboard/page.tsx:270` y `:324`, y
  `src/app/(app)/dashboard/AsistenteDashboard.tsx:129`. Los tres sacan
  `{cita.pacientes?.nombre} {cita.pacientes?.apellidos}` **sin caer al `title`**,
  como sí hace la agenda (`renderEventContent:1208`). No revientan —los enlaces sí
  están protegidos por `cita.paciente_id &&`, `:280` y `:331`— pero **pintan una
  línea en blanco donde debería ir «Junta de personal»**.

> **✅ ANOTACIÓN 2026-08-21 — IMPLEMENTADO, con tres cambios sobre lo propuesto
> aquí y las decisiones de interfaz que faltaban.**
>
> ### 1. Fuera `punto` de la lista de iconos — quedan CINCO
>
> §12.14 proponía `punto` para «genérico, sin icono». **Se retira.** La columna
> es nullable y **NULL ya significa exactamente eso**: dos nombres para el mismo
> concepto es el cabo suelto que §12.13 prohíbe, y aquí se habría metido de
> nacimiento. Quedan `bisturi`, `personas`, `candado`, `avion`, `libro`.
>
> En la interfaz esto se traduce en que **volver a pulsar el icono elegido lo
> quita**: no hay ninguna opción «ninguno» que pulsar.
>
> ### 2. Fuera `cian` de la paleta — quedan CUATRO
>
> Al elegir el color de «atendida» (§12.13) se cumplió lo que esta misma sección
> ordena —mirar las dos tablas a la vez— y salió que **`cian` (#0891b2) era el par
> más apretado** con el teal oscuro **#0f766e** que se llevó «atendida» (hue 192
> contra 175). **Gana el estado**, y por un motivo que no es de gusto: los colores
> de estado NO son provisionales y éstos sí. Quedan `ambar` #d97706, `rosa`
> #db2777, `terracota` #9a3412, `indigo` #4338ca.
>
> ### 3. Un token por color, no cuatro
>
> El fondo y el borde se derivan del color con `color-mix` en vez de declararse
> aparte. Motivo: lo que hay que dejar barato de sustituir cuando Claude Design
> rehaga la paleta es **el color**, no su descomposición en cuatro tonos. Viven en
> `globals.css` como `--ag-evento-*`, junto a los de estado, que es con quien no
> pueden chocar.
>
> ### 4. Cómo conviven cita y evento en el mismo modal — DECIDIDO
>
> **El tipo se elige al ENTRAR y no se puede cambiar después.** Dos puertas en la
> cabecera de la agenda: «Nueva cita» (principal, como siempre) y **«Nuevo
> evento»** (secundario). Arrastrar sobre el calendario y pulsar en un hueco
> siguen abriendo **cita**, que es lo que espera quien hace ese gesto.
>
> **Por qué fijo y no un selector dentro del modal:** si fuera mutable,
> convertir una cita en evento sería **quitarle el paciente por otra puerta**, y
> esa puerta ya está cerrada por §12.18 —quitar el paciente **es** borrar la cita,
> con su alerta delante—. Al revés tampoco: ligarle un paciente a un evento roza
> el «camino de vuelta» de §12.2.
>
> En edición el tipo **se deduce de la fila** (tiene paciente o no lo tiene), y
> por eso no hay ningún control que lo cambie.
>
> **Los dos tipos nunca enseñan los dos campos a la vez:** el título libre ocupa
> el sitio del campo de paciente, no se suma a él.
>
> > **⚠ ANOTACIÓN 2026-08-22 — EN EL ALTA SÍ SE PUEDE ELEGIR. LO DE ARRIBA VALE
> > PARA LA EDICIÓN, Y AHÍ NO CAMBIA NADA.**
> >
> > Lo que sigue vigente palabra por palabra: **en `mode: 'edit'` el tipo se
> > deduce de la fila y no hay ningún control que lo cambie**, por el motivo que
> > este mismo punto da —convertir una cita en evento sería quitarle el paciente
> > por una puerta lateral, y esa puerta la cierra §12.18—. También siguen ahí las
> > dos puertas del toolbar, y **pulsar un hueco o arrastrar siguen abriendo
> > CITA**, que es lo que espera quien hace ese gesto.
> >
> > Lo que cambia es la frase «el tipo se elige al ENTRAR y no se puede cambiar
> > después», que se escribió como absoluta: **en `mode: 'create'` ahora hay un
> > control de dos posiciones «Cita | Evento», arriba del todo del modal.**
> >
> > **Por qué esto no contradice el motivo de la decisión, que es lo que hay que
> > entender antes de tocarlo:** el argumento de §12.18 presupone **una fila que
> > ya existe y que tiene paciente**. En el alta no la hay. Cambiar de tipo antes
> > de guardar no le quita el paciente a nada, no dispara ningún DELETE y no roza
> > §12.18 —cuya X, en el alta, sigue limpiando el campo justamente porque
> > «todavía no hay cita»—. No se convierte nada: se elige qué se va a crear. El
> > «no» de este punto era más amplio que su propia razón.
> >
> > **Qué lo motivó:** la vía más usada para crear es pulsar un hueco del
> > calendario, y desde ahí no había forma de cambiar de idea salvo cerrar el
> > modal y volver a entrar por el botón «Nuevo evento».
> >
> > **Cómo se implementó, porque el detalle es el que sostiene la decisión:** el
> > tipo sigue viviendo en `modal` y NO es estado del modal. El control llama a la
> > página, que reemplaza el `modal`, y el componente se monta con
> > `key={modal.tipo}` — así que cambiar de tipo **REMONTA el modal entero**. Ese
> > remonte es lo que tira el paciente ya elegido, el título ya tecleado y un
> > `status` que el otro tipo no ofrece (`ESTADOS_EVENTO` no tiene «no asistió»),
> > sin una sola línea de reseteo. Por eso el control va **arriba del todo, antes
> > de cualquier campo**: cambiarlo pierde lo escrito, y ponerlo abajo invitaría a
> > descubrirlo tarde.
>
> ### 5. El selector de estado enseña listas distintas
>
> Una **cita** enseña los cinco estados. Un **evento genérico**, sólo `scheduled`
> y `cancelled`: «No asistió» o «Atendida» no significan nada sobre una junta de
> personal, y ofrecerlos sería fingir que sí. El selector recorre la lista del
> tipo y ya no `STATUS_CONFIG` entero, así que añadir un estado en el futuro **no
> le aparece automáticamente a las juntas**.
>
> ### 6. Lo que NO hizo falta tocar, comprobado
>
> - **«Iniciar consulta» se apaga solo**: su condición ya exigía paciente.
> - **El botón de invitación ya estaba preparado**: `ModalInvitacionCita` trae
>   escrito «Null en eventos genéricos sin paciente» y la ruta responde
>   `cita_sin_paciente`. La casilla de dirección tecleada a mano sigue sirviendo,
>   que es justo lo que hace falta para invitar a alguien a una junta.
> - **La agenda ya caía al título** (`pacNombre ?? title`). Los tres renglones en
>   blanco eran sólo de la dashboard, y ya caen al `title`.
>
> ### 7. Lo que NO se cambió y conviene saber que es así
>
> **El evento genérico invita a su médico por correo, automáticamente**, porque el
> alta mete al médico asignado en el mismo `events.insert` sin mirar si hay
> paciente. **Se deja como está**: encaja con §12.18 —si la fila es suya, su
> tiempo está bloqueado y tiene que verlo en su calendario— y cambiarlo sería
> estrenar una excepción que nadie pidió. Queda escrito porque **no se decidió en
> ninguna parte**: se heredó.
>
> **El `color` NO viaja a Google.** Allí el color del evento lo sigue decidiendo
> el ESTADO, vía `STATUS_COLOR`. Que la pinta elegida se refleje también en Google
> es una decisión que nadie ha tomado y que colisionaría con ese mapa.

---

## 12.15 Las migraciones de esta rama

§0.10 decía que esta rama no llevaba ninguna. **Lleva cuatro**, y una quinta
condicionada. Todas pasan por `supabase/AUDITORIA-MIGRACIONES.md` y sus 15
dimensiones **antes** de aplicarse, y su cabecera se actualiza al aplicarlas (§7 de
ese documento).

| # | Qué | De dónde sale |
|---|---|---|
| 1 | La **columna del permiso** en `profiles`, **más su entrada en el trigger guardián** `proteger_columnas_sensibles_profiles` | §12.7 |
| 2 | El **trigger sobre `appointments`** que compara `NEW` contra `OLD` **columna por columna**, más la policy de `INSERT`/`DELETE` | §12.7 |
| 3 | El valor **`atendida`** en el CHECK de `appointments.status` | §12.13 |
| 4 | Las **dos columnas de icono y color** con sus CHECK contra lista cerrada | §12.14 |
| *(5)* | *El «no mostrar más» de los avisos, **si** acaba guardándose en la base* | §12.10 — **sigue sin decidirse dónde se guarda** |

**Las 1 y 2 son inseparables en intención y separables en archivo:** sin la 1 no hay
columna que consultar; sin la 2, el permiso es decorativo porque se escribe directo
por PostgREST. Las dos van en el **commit 7** (final de §6).

> **El único punto que sigue abierto en todo §12** es dónde se guarda el «no
> mostrar más» por usuario. Si va a la base, esta tabla pasa a cinco.

> **⚠ ANOTACIÓN 2026-08-20 — la frase de arriba sigue siendo cierta, y ahora es
> la única lectura posible.** Se escribió con la verificación de `attendees`
> (§12.12.3) decidida pero **sin ejecutar**, y esa verificación podía haber
> mandado §12.4 de vuelta a la mesa con lo que arrastrase. **Ya está ejecutada y
> en verde:** §12.4 no pide migración, no pide replanteo y no añade nada a esta
> tabla. **Se queda en cuatro, más la quinta condicionada**, exactamente como
> está.

> **⚠ ANOTACIÓN 2026-08-21 — LA TABLA DE ARRIBA QUEDA OBSOLETA EN SU RECUENTO.
> SON CINCO, Y LA «QUINTA CONDICIONADA» YA NO EXISTE.** Las dos cosas cambian a la
> vez y por motivos independientes, así que conviene leerlas por separado.
>
> ### El recuento vigente
>
> | # | Qué | De dónde sale | Estado |
> |---|---|---|---|
> | 1 | La **columna del permiso** en `profiles`, más su entrada en el trigger guardián | §12.7 | sin escribir (commit 7) |
> | 2 | El **trigger sobre `appointments`** columna por columna, más la policy de `INSERT`/`DELETE` | §12.7 | sin escribir (commit 7) |
> | 3 | El valor **`attended`** en el CHECK de `appointments.status` | §12.13 | escrita — `20260821_agenda_status_attended.sql` |
> | 4 | Las **dos columnas de icono y color** con sus CHECK | §12.14 | escrita — `20260821_agenda_evento_generico_icono_color.sql` |
> | 5 | **`consultas.appointment_id`** con FK `ON DELETE SET NULL` | §12.13 | escrita — `20260821_consultas_appointment_id.sql` |
>
> ### Por qué entra una quinta
>
> **`consultas.appointment_id` es nueva y no estaba prevista.** Sale de que el
> mecanismo que §12.13 describía —escribir el estado al pulsar «Iniciar
> consulta»— **no se puede construir**: los tres botones son enlaces de
> navegación. El estado pasa a escribirse en el servidor al crear la consulta, y
> para eso el servidor tiene que saber de qué cita se trata — cosa que **hoy no
> tiene forma de saber**, porque no existía ninguna relación entre las dos tablas.
> El razonamiento entero, en la anotación de §12.13.
>
> ### Por qué desaparece la condicionada
>
> **El «no mostrar más» de §12.10 se guarda en el navegador**, así que la quinta
> que aquella fila reservaba no se aplaza: **no va a existir**. Decidido el
> 2026-08-21; el porqué está en la cuarta anotación de §12.10, y vale igual para
> el interruptor de mostrar u ocultar los eventos de Google.
>
> ### Sobre la FK de la migración 5, porque contradice una regla en apariencia
>
> Lleva **`ON DELETE SET NULL`** y `CLAUDE.md` fija `ON DELETE RESTRICT`. **Esa
> regla habla de las FK a `pacientes`** y su motivo es que un expediente no
> desaparezca. Aquí la dirección es la contraria: las citas **sí se borran** desde
> la papelera, y con RESTRICT borrar una cita atendida quedaría bloqueado **para
> siempre** por una consulta que es inmutable y no se borra nunca. Con CASCADE se
> borraría la nota clínica, que es lo que las dos normas prohíben. SET NULL es lo
> único que dice la verdad: **el dato clínico sobrevive, el vínculo no**. La
> justificación va escrita también en la cabecera de esa migración.
>
> **Las tres nuevas van ANTES del código**, cada una por su motivo, y los tres
> están escritos en su cabecera.

> **✅ ANOTACIÓN 2026-08-21 — LAS TRES (3, 4 y 5) ESTÁN APLICADAS Y VERIFICADAS
> EN PRODUCCIÓN.** La frase de arriba decía que ninguna se había aplicado
> todavía; dejó de ser cierta el mismo día. El veredicto de cada una está en su
> cabecera, con las cifras que devolvió la rejilla.
>
> - **3 — `attended`:** a la primera. El CHECK admite los cinco valores.
> - **4 — `icono` y `color`:** a la primera. Las dos columnas nullables, los dos
>   CHECK validados, sin grants por columna. La guarda de replay quedó
>   verificada aparte, en seco, y coincide byte a byte.
> - **5 — `consultas.appointment_id`:** **al segundo intento.** El primero murió
>   en la consulta del veredicto con `ERROR 42725: operator is not unique:
>   unknown || "char"` —`pg_constraint.confdeltype` concatenado sin `::text`— y
>   lo hizo **con la transacción ya confirmada**, dejando la FK creada y NOT
>   VALID. Corregido el cast, se probó el veredicto por separado y se reejecutó
>   el archivo entero.
>
> **PostgREST comprobado desde fuera** en las dos que añaden columnas, con la
> anon key: `appointments?select=id,icono,color` y
> `consultas?select=id,appointment_id` responden 200 sin PGRST204. No hizo falta
> forzar la recarga de la caché de esquema.
>
> **La lección, que es lo que importa conservar:** las tres pasaron por **dos
> auditorías** y ninguna vio el `||` sobre `"char"`, porque **ninguna ejecutó
> SQL**. Un error de resolución de operadores no se ve leyendo. Y le tocó a la
> parte que menos se revisa y que corre siempre la última —el `SELECT` del
> veredicto—, así que apareció con todo el esquema ya aplicado. **Antes de pegar
> una migración, el veredicto se corre solo:** es lectura pura y se puede
> ejecutar aparte sobre el estado que haya.
>
> **Lo que sigue abierto son las migraciones 1 y 2** (§12.7, commit 7), que ni
> siquiera están escritas. Con las tres de aquí aplicadas, **el despliegue del
> código de §12.13 y §12.14 ya no está bloqueado por esquema**.

> **✅ ANOTACIÓN 2026-08-22 — ENTRA UNA SEXTA, Y ESTÁ APLICADA. LA RAMA VA POR
> SEIS MIGRACIONES APLICADAS Y DOS PENDIENTES.**
>
> | # | Qué | De dónde sale | Estado |
> |---|---|---|---|
> | 1 | La **columna del permiso** en `profiles`, más su entrada en el trigger guardián | §12.7 | **sin escribir** (commit 7) |
> | 2 | El **trigger sobre `appointments`** columna por columna, más la policy de `INSERT`/`DELETE` | §12.7 | **sin escribir** (commit 7) |
> | 3 | El valor **`attended`** en el CHECK de `appointments.status` | §12.13 | aplicada 2026-08-21 |
> | 4 | Las **dos columnas de icono y color** con sus CHECK | §12.14 | aplicada 2026-08-21 |
> | 5 | **`consultas.appointment_id`** con FK `ON DELETE SET NULL` | §12.13 | aplicada 2026-08-21 (2.º intento) |
> | 6 | Las **listas definitivas de icono y color**: 20 y 6 | §12.14 | **aplicada 2026-08-22, a la primera** — `20260822_agenda_pinta_definitiva.sql` |
>
> ### Qué es la 6 y por qué hacía falta
>
> **Sustituye los dos CHECK de la migración 4**, cuyos cinco iconos y cuatro
> colores eran provisionales por decisión propia —su cabecera lo anuncia dos
> veces— a la espera del rediseño del calendario. El rediseño cerró con otras
> listas, así que sin esto un usuario que eligiera cualquier valor nuevo recibiría
> un **23514** y no podría guardar el evento. Las listas vigentes y el porqué de
> cada retirada están en la anotación del 2026-08-22 al principio de §12.14.
>
> **No añade ninguna columna**, y de ahí una diferencia con la 4 y la 5 que
> conviene no copiar por inercia: **no hizo falta comprobar PostgREST desde
> fuera**. Su caché es de columnas, no de constraints.
>
> ### Lo que esta migración deja como método, que es lo que vale conservar
>
> - **Los cuatro literales de su guarda de replay están LEÍDOS de Postgres**, no
>   razonados: los dos vigentes por consulta directa a `pg_constraint`, y los dos
>   nuevos —que aún no existían en ninguna base— con una `TEMP TABLE` y `ROLLBACK`
>   que los deparsea igual sin dejar rastro. Es la respuesta al fallo que abortó
>   la migración 3 en su primer intento.
> - **El veredicto se corrió solo, dos veces**, antes de pegar nada: la lección de
>   la 5 aplicada tal cual.
> - **Una auditoría externa encontró un fallo real en el veredicto** y se corrigió
>   antes de aplicar: `faltan_*` y `sobran_*` son pruebas de **pertenencia**, no
>   de igualdad, así que una lista ampliada a mano con un valor de más habría
>   pasado como OK. Ahora dos ramas comparan la **definición completa** contra los
>   literales exactos, y en la corrida de después de aplicar se evaluaron por
>   primera vez sin disparar.
>
> ### Un hueco conocido que se deja abierto a propósito
>
> El veredicto comprueba que las dos columnas sigan siendo **nullable**, pero no
> que sigan **sin DEFAULT**. Un `SET DEFAULT 'grafito'` puesto a mano pasaría el
> CHECK, dejaría la columna nullable y pintaría en silencio todas las citas de
> paciente nuevas —justo lo que §12.14 argumenta que no debe pasar— y el veredicto
> diría OK. Es un hueco **heredado del veredicto de la migración 4**, no lo
> introduce la 6, y cerrarlo es un `atthasdef` en el CTE más una rama. No se
> consideró motivo para retrasar la aplicación.
>
> ### Lo que sigue abierto
>
> **Sólo las migraciones 1 y 2** (§12.7, commit 7), que siguen sin escribirse. El
> despliegue del código de §12.14 ya no está bloqueado por esquema — y el orden es
> el de siempre: **esta migración va antes del código**, aunque aquí por un motivo
> distinto al de la 4, porque las columnas ya existían y lo que cambia es qué
> valores admiten. Está razonado en su cabecera.

> **⛔ ANOTACIÓN 2026-09-01 — YA NO QUEDA NINGUNA PENDIENTE. LAS MIGRACIONES 1 Y 2
> QUEDAN CANCELADAS, NO APLAZADAS.**
>
> Las tablas de arriba las listan como «sin escribir (commit 7)», y **esa lectura
> ya no vale**: el commit 7 está cancelado (§12.19), así que esas dos migraciones
> **no se van a escribir nunca** mientras la decisión siga en pie. La cuenta viva
> de la rama es **seis aplicadas y cero pendientes**.
>
> Las tablas **no se reescriben**, por la costumbre de este documento: dicen lo
> que se planeó, y esta anotación dice en qué acabó. Si alguien vuelve a abrir
> §12.7, estas dos vuelven a la cola tal como están descritas — el diseño
> policy + trigger columna por columna sigue siendo válido, lo que cambió es que
> hoy no hace falta.

---

## 12.16 Reconexión con OTRA cuenta de Google — alcance nuevo, SIN DECIDIR

> **Añadida el 2026-08-20, al escribir el commit 4** (los scopes `openid` y
> `email`). Sale de la fase de lectura de ese commit: con la identidad de la
> cuenta poblándose, aparece un caso que **el plan no contempla en ningún sitio**.
> Aquí se describe **qué pasa hoy**; **no se decide nada.**

El plan sí cubre el **relevo de administrador** —otra *persona* conectando—, y
para eso están `clinica_ya_conectada` y `rol_no_promovido` (§2.5). Lo que nadie
escribió es qué debe pasar cuando **la misma persona** reconecta con una **cuenta
de Google distinta** de la que tenía registrada.

### Qué hace el código hoy, paso a paso

1. **Ninguna guarda del RPC lo ve.** La guarda 3 compara `user_id <> p_user_id`
   (mismo usuario: no dispara) y la guarda 4 compara roles, no cuentas
   (`20260818_gcal_puente_secretos.sql:250-277`).
2. **El `ON CONFLICT (user_id) DO UPDATE` pisa el `sub` anterior en silencio.**
   El `COALESCE` de `:301-302` protege contra NULL, no contra un valor distinto.
   Hasta el commit 4 era inobservable, porque el `sub` llegaba siempre NULL.
3. **El `calendar_id` NO se toca** (`:304-306`, deliberado), así que la conexión
   queda apuntando a un calendario que vive **en la cuenta anterior** y al que el
   token nuevo no llega.
4. **El callback lo tapa creando otro calendario.** `calendarioVive` da 404 con
   el cliente nuevo (`callback/route.ts`) y se crea uno nuevo con
   `esperado: yaRegistrado`. La conexión sobrevive y sincroniza.
5. **Y ahí queda el residuo:** las citas anteriores conservan un
   `google_event_id` de un calendario muerto. `desvincularCitas` **no** corre por
   este camino, así que nada vuelve a intentarlo.

O sea: **hoy funciona mal, pero funciona.** No hay fuga ni corrupción; hay un
rastro de citas con vínculos muertos y un `sub` sobrescrito sin dejar huella.

### Las opciones, y por qué no se elige ninguna ahora

- **Dejarlo como está.** Con la identidad ya poblada, al menos el 404 deja de ser
  ambiguo para quien lea la base a mano — que es el motivo declarado del commit 4
  (§7, escenario «3 sin 4»).
- **Detectar y avisar** sin bloquear: comparar el `sub` entrante con el guardado
  y registrar el cambio de cuenta.
- **Bloquear** con un sexto error con nombre en el RPC. Tiene un contra real: hoy
  reconectar con otra cuenta funciona, y convertirlo en error deja al
  administrador **sin salida salvo desconectar primero**. Además es **migración**,
  con sus 15 dimensiones de `supabase/AUDITORIA-MIGRACIONES.md`.

**Nada de esto es del commit 4:** poner el dato y actuar sobre él son cosas
distintas, y ese commit sólo pone el dato. **No añade migración a §12.15** salvo
que se elija la tercera opción.

> **NO CONFUNDIR CON `cuenta_ya_vinculada`, que sí se resolvió en el commit 4.**
> Aquél es el choque del índice único `..._account_sub_uniq` cuando **dos
> usuarios distintos** de Spinus intentan enlazar **la misma** cuenta de Google
> (una persona con dos contextos, dos clínicas y dos cuentas de Spinus). Se
> detecta en `altaConexion` y sale por `?gcal_error=cuenta_ya_vinculada`, sin
> tocar el RPC ni la base. Éste de aquí es el contrario: **un solo usuario
> cambiando de cuenta de Google**, que ningún índice ve.


## 12.17 El médico propietario recibe la cita en su calendario — y con eso cae §12.9

> **Añadida el 2026-08-21**, al construir el botón de invitación. Toca **§12.4**
> (qué hace la invitación), **§12.9** (compartir el calendario en lectura) y deja
> **un pendiente de interfaz** que hay que arreglar después.

### Lo que se descubrió

**Cuando el médico asignado a una cita ES el dueño de la cuenta de Google
conectada, la invitación SÍ funciona — sólo que no por correo.** No le llega
ningún mensaje, porque **Google no notifica al organizador de su propio evento**,
pero **el evento SÍ entra en su calendario personal**.

Y eso es exactamente lo que hacía falta: **con el calendario de la clínica
apagado, cada médico ve sólo SUS citas y no las de los demás.**

### Esto resuelve lo que §12.9 daba por inalcanzable

§12.9 dice que compartir el calendario en lectura es manual y opcional porque
automatizarlo pediría el scope sensible `calendar.acls`, «que es justo lo que toda
esta arquitectura evita». **La invitación llega al mismo sitio por otro camino, y
además a uno mejor:** `calendar.acls` habría compartido el calendario ENTERO —las
citas de todos—, mientras que el `attendees` del `patch` mete en la agenda de cada
médico **sólo las citas que son suyas**. Lo que parecía el sucedáneo resulta ser
lo que se quería.

**§12.9 no se retira** —compartir en lectura sigue siendo una opción manual para
quien la quiera, y su nota sobre el ACL fuera de la RLS sigue vigente—, pero deja
de ser la respuesta a «cómo ve un médico invitado su agenda en Google».

### Las notificaciones del calendario quedan DESCARTADAS

Se consideró encender para la cuenta de la clínica los avisos por correo de
«evento creado», «evento modificado» y «evento cancelado» —`calendarList`,
`notificationSettings.notifications`— para que el administrador tuviera constancia
de cada cita aunque no le llegara invitación. **Descartado, por dos motivos
independientes:**

1. **No cubre ningún hueco.** El hueco que pretendía tapar no existe: el médico
   propietario ya recibe la cita en su calendario. Un correo por evento sería
   avisarle de algo que ya tiene delante.
2. **El plan B costaba la arquitectura entera.** Si `calendar.app.created` no lo
   autorizara —desenlace probable: `calendarList` es la lista de suscripciones de
   la CUENTA, no un calendario—, hacerlo por API exigiría `calendar.calendarlist`
   o `calendar` a secas. **Los dos son SENSIBLES**, y §12.11 recuerda que eso
   reabre la verificación de la app y activa el tope de 100 usuarios, **un
   contador que no se puede restablecer nunca**.

**La prueba NO se ejecutó, y es deliberado:** sus dos desenlaces terminaban en «no
se hace». El script queda en `scripts/gcal-notificaciones-humo.ts` con la cabecera
diciendo justo eso, para que nadie lo tome por trabajo a medias ni vuelva a
plantear la idea creyéndola inexplorada.

Lo que sí quedó averiguado sin gastar una llamada: **el ajuste vive en
`calendarList` y NO en `calendars`** —comprobado en los tipos instalados; la
documentación del propio tipo dice «the notifications that THE AUTHENTICATED USER
is receiving»—, o sea que es una preferencia **por cuenta suscrita**, no una
propiedad del calendario. Encenderla desde Spinus nunca habría servido para nadie
más que para la cuenta conectada.

Queda documentada en ese script la vía manual —escritorio, «Configuración y uso
compartido», sección **«Notificaciones generales»**, que no es la de
«Notificaciones de eventos»— por si algún médico quisiera esos avisos **para su
propia cuenta**. Es cosa suya y Spinus no participa.

### ⚠️ PENDIENTE DE INTERFAZ — el acuse miente en un caso

**Cuando el destinatario invitado es el dueño de la cuenta conectada, el acuse NO
puede decir que Google le mandó la invitación, porque no se la manda.** Hoy el
panel dice que «quedó añadido a la cita y Google le mandó la invitación por
correo»: la primera mitad es cierta siempre, la segunda es falsa en este caso.

**Cómo se detecta:** comparando el correo del médico con
`clinica_conexiones_google.google_account_email`, que se puebla desde el commit 4.

Tres avisos para quien lo implemente, los tres verificados el 2026-08-21:

- **Por correo, NO por `user_id`.** Tienta comparar `conexion.userId` con
  `cita.medico_id` —los dos son ids de perfil de Spinus y el descriptor ya trae el
  primero—, y **está mal**: lo que decide si Google notifica es qué **cuenta de
  Google** organiza el evento, y quien administra puede haber conectado un Gmail
  personal distinto de su cuenta de Spinus. Ese atajo daría falsos positivos.
- **`google_account_email` puede ser NULL, y NULL significa «identidad
  desconocida», no «no coincide»** (`20260817_gcal_conexion_clinica_a_esquema.sql:509`).
  Las conexiones migradas desde `google_tokens` lo tienen vacío hasta que su dueño
  reconecte. Con NULL no se puede afirmar ni lo uno ni lo otro, así que el acuse
  tiene que caer en una redacción que sea cierta en los dos casos.
- **`resolverConexionClinica` hoy NO lo devuelve:** `COLUMNAS_CONEXION`
  (`src/lib/gcalConexion.ts:71`) es `id, clinica_id, user_id, rol, calendar_id,
  estado`, y `ConexionGoogle` no tiene ese campo. Hay que ensancharlo — y el
  correo **no debe viajar al navegador**, igual que el del médico: la comparación
  se hace en el servidor y lo que baja es un booleano.

**No se implementa en esta rama.** Es un cambio de redacción del acuse que depende
de un dato que hay que hacer llegar a la ruta, y llega tarde para el commit del
botón.
## 12.18 El médico entra solo · notificaciones · los tres costes aceptados

> **Añadida el 2026-08-21**, al construir el flujo definitivo de la invitación.
> Cambia §12.4 en un punto de fondo y añade lo que Google notifica.

### El médico ya no se invita: entra solo

El botón sirve para UNA cosa —meter a alguien en la lista de asistentes— y una
vez dentro, **Google avisa SOLO de cada cambio que Spinus haga sobre el evento**,
con `sendUpdates: 'all'` y sin que nadie pulse nada. Lo único que las ediciones
no cubren es que ENTRE ALGUIEN NUEVO, y de eso sólo hay un caso automático: el
médico.

- **Al crear**, su correo va en el MISMO `events.insert` que crea el evento. Una
  llamada y no dos: añadirlo después con un `patch` costaría un viaje más y un
  segundo correo de «evento actualizado» pisando la invitación recién recibida.
- **Al reasignar**, el nuevo entra y **el anterior SALE**, en el `patch` que el
  PUT ya hacía. Sacarlo no es limpieza: mientras siga en la lista recibe todas
  las actualizaciones futuras —cambios de hora, cancelaciones— **con el nombre de
  un paciente que ya no atiende**.
- **Su casilla desapareció del modal.** Si tiene la cita, tiene que tenerla en su
  calendario: no es una elección de nadie y ofrecerla sería fingir una decisión
  que no existe.

**Lo que esto deroga de §12.4:** el botón ya no dice «Enviar invitación siempre».
Tras enviar desaparece y queda «Aceptar». El motivo que daba §12.4 —Google no
duplica al asistente, sólo reenvía— **sigue siendo cierto**, y reenviar sigue
siendo posible: se entra de nuevo a la cita y se usa «Agregar invitados». Lo que
cambió es que el modal ahora se abre solo al crear, así que es lo último que ve
quien acaba de agendar, y un botón de enviar vivo ahí invita a pulsarlo «por si
acaso» y a mandar dos correos por cita.

### Qué notifica Google ahora, y qué sigue callado

| Acción | Antes | Ahora |
|---|---|---|
| Mover la cita de hora | silencio | `sendUpdates: 'all'` |
| Borrar la cita | silencio | `sendUpdates: 'all'` |
| Marcar «Cancelada» | silencio | título «CANCELADA — …» + aviso |
| Reactivar una cancelada | silencio | se quita el prefijo + aviso |
| Reasignar el médico | silencio | el nuevo entra, el anterior sale |
| Cambiar notas, o pasar a «Confirmada» | silencio | **silencio**, y a propósito |

La última fila es la que hay que defender: se compara **la transición**, no el
estado. Sin eso, editar las notas de una cita ya cancelada le volvería a mandar la
cancelación al paciente en cada guardado.

**La idempotencia del prefijo sale gratis y hay UNA sola forma de romperla.**
`summary` se recompone desde cero en cada escritura, a partir del paciente y del
estado de la fila; este código **nunca lee el título que hay ahora en Google**. El
día que alguien lo lea para anteponerle algo —«así conservo lo que hubiera puesto
el médico a mano»— aparece «CANCELADA — CANCELADA — …» al segundo guardado. Está
escrito junto a la constante, en `lib/appointments.ts`.

### Quitar el paciente **es** borrar la cita

No son dos operaciones. Una cita sin paciente no existe en Spinus: el título del
evento sale del paciente, Guardar está apagado sin él y no hay ningún estado
intermedio que guardar.

Por eso la **X junto al paciente**, en edición, no vacía un campo: lleva a una
alerta y de ahí al **DELETE de la cita entera**, el mismo camino que la papelera
—que ya borra el evento con `sendUpdates: 'all'`, así que el invitado recibe su
cancelación—. En el alta sigue limpiando el campo, porque todavía no hay cita.

**El texto de la alerta dice el desenlace en la primera frase**, y eso es el
punto: quien pulsa una X sobre un nombre espera vaciar un campo, no borrar nada.

> **Se consideró y se retiró:** una rama en el PUT que tratara `paciente_id: null`
> como caso especial —borrar el evento y dejar la fila en `unbound`—. Estaba
> escrita y se quitó al comprobar que **ningún llamador puede producirla**: el
> único punto que manda `paciente_id` en un PUT es el modal de la agenda, y
> siempre manda uno real. Los eventos genéricos de §12.14 tampoco la alcanzarían:
> nacerán **sin** paciente, así que nunca hacen esa transición. Era código sin
> camino que lo alcance, que es peor que no tenerlo — parece cubierto y nadie lo
> ha probado nunca.

### Los tres costes aceptados

Van aquí **como aceptados, no como pendientes**. Ninguno se arregla en esta rama.

1. **Si el calendario se recrea tras un 404, el evento nuevo nace SIN
   ASISTENTES** y nadie se entera. Hay que reinvitar a mano. La rama de
   reparación de `conCalendarioSpinus` copia la cita, no su lista de invitados.
2. **Las citas ya canceladas hoy tienen su evento sin el prefijo** hasta que
   alguien las edite. No hay backfill posible sin barrer Google.
3. **Si a un paciente le editan el correo en su ficha, la dirección anterior
   sigue invitada.** Y no es una omisión: **el dato que haría falta no existe.**
   `PUT /api/pacientes/[id]` sobrescribe la columna y Spinus no guarda el valor
   viejo en ninguna parte, así que no hay forma de saber cuál de las entradas de
   la lista de Google era la suya — y adivinar está prohibido, porque en esa lista
   están también el médico, el propietario del calendario y los invitados
   externos. Entra la nueva y la vieja se queda hasta que alguien la quite a mano.
   **El cambio de PACIENTE sí se resuelve**: al saliente se le lee su correo
   porque su ficha sigue existiendo.

> **DATO DE ESTADO (2026-08-21):** ningún beta tester tiene Google conectado, así
> que no hay ni una cita con la lista de asistentes en mal estado. Estos tres
> costes nacen sin deuda acumulada detrás; no hace falta corrección de datos.

---

## 12.19 El permiso de escritura en la agenda — CANCELADO (2026-09-01)

**Decisión: el commit 7 (§12.7) no se construye.** No se pospone, no pasa a la
rama siguiente, no queda «para cuando haya hueco». Se cancela, y con él sus dos
migraciones (§12.15, migraciones 1 y 2), que nunca llegaron a escribirse.

### Por qué

**La barrera que el commit 7 venía a construir ya existe en la base.** Se verificó
en producción el 2026-09-01: las **cuatro** policies de `appointments` —SELECT,
INSERT, UPDATE y DELETE— llevan la misma restricción, acotada por `clinica_id`:

```sql
(medico_id = auth.uid()
 OR public.soy_admin_de_clinica()
 OR public.get_my_role() = 'secretaria')
AND clinica_id = public.get_clinica_id()
```

El `UPDATE` **la aplica en `qual` Y en `with_check`**, así que **un médico
invitado no puede reasignarse una cita ajena** — ni cogiendo una que ya cumple el
`USING` para dejarla apuntando a otro sitio.

En el repo: `supabase/migrations/20260530_etapa5h_paso3_policies_appointments.sql`,
`appointments_select` en `:81`, `appointments_insert` en `:95`,
`appointments_update` en `:109` (con `USING` en `:114` y `WITH CHECK` en `:122`) y
`appointments_delete` en `:131`.

**Lo único que el commit 7 habría añadido encima es que la interfaz no muestre
botones que el servidor rechaza.** Eso es cosmético. Nadie lo ha pedido, y el
precio son dos migraciones sobre la tabla de la agenda: una columna en `profiles`
con su entrada en el trigger guardián, y un trigger sobre `appointments` que
compara `NEW` contra `OLD` columna por columna. Es mucha superficie de esquema
para pulir una interfaz que hoy no molesta a nadie.

### ⚠️ QUÉ REABRE ESTA DECISIÓN

**La cancelación se apoya en esas cuatro policies y en nada más.** Si alguien las
relaja, deja de valer y §12.7 vuelve a estar abierto — sin discusión previa, por
la condición misma con la que se cerró. Cuenta como relajarlas:

- quitar el `medico_id = auth.uid()` de cualquiera de las cuatro;
- ensanchar el `OR` a un rol más;
- dejar el `UPDATE` sólo con `USING`, sin `WITH CHECK`;
- soltar el `AND clinica_id = public.get_clinica_id()`.

Quien toque `appointments` en una migración futura tiene que pasar por aquí. Es la
**dimensión 15** de `supabase/AUDITORIA-MIGRACIONES.md` aplicada a este caso: el
alcance de los roles se comprueba en las dos direcciones, y aquí una de las dos
direcciones es una decisión de producto que se cae.

### Lo que estas policies no prometen, y por eso no se pierde

Cubren la **propiedad**, no el permiso por columna: un médico invitado no toca las
citas de otro, pero **sobre las suyas sigue pudiendo crear, borrar y mover fecha,
hora, duración y paciente**. Es exactamente la lista «NO PUEDE» de §12.7, y **no
se está afirmando que la base la cumpla** — no la cumple.

Eso no invalida la cancelación: ese trozo de §12.7 nunca fue seguridad, era
preferencia de producto (el permiso nacía «APAGADO por defecto para los médicos
invitados»), y hoy se acepta que un médico invitado gestione su propia agenda. Se
escribe para que la reapertura, si llega, se decida sobre lo que las policies
hacen de verdad y no sobre lo que este apartado parezca prometer.

### Lo que la cancelación NO arrastra

- **§12.13 («atendida») y §12.14 (eventos genéricos) siguen en pie** y ya están
  construidos. Sus migraciones 3, 4, 5 y 6 están aplicadas.
- **La dependencia cruzada de §12.7 con §12.13** —«el permiso tiene que dejar
  cambiar `status` pase lo que pase, o el invitado no puede pulsar Iniciar
  consulta»— **deja de existir como riesgo**: sin trigger que restrinja columnas,
  no hay nada que pueda bloquear `status` por accidente.
- **La cuenta de migraciones de la rama** pasa a **seis aplicadas y cero
  pendientes** (§12.15, anotación del 2026-09-01).
