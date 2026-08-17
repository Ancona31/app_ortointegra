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

> **RESUELTO ASÍ** (2026-08-17): la regla se adoptó, y el «los secretos» de la
> versión original pasó a ser «los tokens, por las tres RPC del puente». El
> detalle, en la tabla de §1 y en §2.1; las decisiones del callback, en §2.5.

Hay una segunda excepción forzada, menor, en §3.4 (leer el nombre del médico para crear un calendario dentro de `after()`). La marco ahí y ofrezco la alternativa.

**0.3 — «freebusy sigue amarrado a la sesión» no es «no tocar»: es código nuevo.** Hoy `consultarOcupado` corre **dentro** del callback de `conCalendarioSpinus` (`events/route.ts:136`) y usa el MISMO cliente de Google que `events.list`. En cuanto ese cliente pase a ser el de la conexión de la clínica, `freebusy` sobre `primary` consulta el calendario personal del administrador y se lo enseña a toda la clínica — exactamente la fuga que el brief quiere evitar, entrando por la puerta de al lado. Mantener el comportamiento descrito obliga a **abrir un segundo cliente de Google, el de la conexión propia de quien pregunta**, fuera del cuerpo que se reintenta. Con eso desaparece de paso la memoización de `ocupadoPromesa`, que existía sólo para no repetir freebusy en el reintento.

**Añadido al absorber H8:** hay un efecto lateral que el texto original no vio. Hoy el GET sólo devuelve `ocupado` cuando hay calendario de clínica resuelto (`events/route.ts:153-155`), porque los bloques viajan dentro de la misma respuesta que los eventos. Al separar los dos clientes eso deja de tener sentido: los bloques de «Ocupado» de una persona **no dependen de la conexión de la clínica**, así que un administrador cuya conexión de clínica falte perdería también sus propios bloques sin motivo. `ocupado` se resuelve y se devuelve **al margen** de que la conexión de clínica exista o no.

**0.4 — La intersección de H2 deja un payload que es 100% duplicado.** Si sólo se devuelve un evento cuando su id está en el conjunto de citas que la sesión lee bajo RLS, entonces **todo evento devuelto tiene una cita detrás**, y la agenda ya pinta esa cita desde `/api/appointments` (`agenda/page.tsx:1341-1372`). Cada cita saldría dos veces: una como cita y otra como bloque morado `gcal-<id>`. Peor: el conjunto de dedupe no conoce el filtro por médico, así que filtrar la agenda por un médico seguiría pintando las citas de los demás como bloques de Google, con el nombre del paciente en el título.

La intersección es la regla de seguridad correcta y va en el servidor. Pero su consecuencia real no es «se pierden los eventos crudos»: es que **el array `events` deja de tener sentido**. Lo honesto es intersecar en el servidor *y* que la agenda deje de pintar `data.events` (≈20 líneas en `gcalSource`). Eso toca `agenda/page.tsx`, fuera de la lista original: **aprobado** (§4, F10, y el cierre de decisiones).

**Precisión al absorber H2, y es peor de lo que este apartado decía.** El dedupe de hoy no es neutro: **agrava**. `yaSonCitas` (`events/route.ts:162-168`) se construye con las citas que la SESIÓN lee bajo RLS, y para un médico invitado eso es sólo lo suyo —`(medico_id = auth.uid() OR get_my_role() = 'secretaria') AND clinica_id = …`, `20260530_etapa5h_paso3_policies_appointments.sql:82-96`—. O sea que las citas de sus colegas **no se restan**: salen como eventos crudos de Google, y el título los lleva con nombre y apellidos del paciente (`tituloParaGoogle`, `src/lib/appointments.ts`). Restar lo propio de un calendario de clínica entera es exactamente el mecanismo que enseña lo ajeno. Por eso la intersección no es una mejora de limpieza: es la contención.

**0.5 — El callback no tiene regla para decidir `rol`, y equivocarse es un 23505.** El índice único parcial deja como máximo una fila `rol='clinica'` por clínica. Hoy el callback hace `upsert` por `user_id` y ya está; bajo el modelo nuevo tiene que decidir si la conexión que nace es la de la clínica o una 'personal', y si decide mal, o si hay carrera, revienta con violación de índice dentro de un redirect. El brief no dice la regla.

**RESUELTO ASÍ** (2026-08-17): la regla está en §2.5 y ya no es una propuesta, es una decisión tomada. Y el 23505 crudo dejó de ser problema del callback: `alta_conexion_google` comprueba el caso antes de escribir y reetiqueta la violación de índice si la carrera se cuela, así que lo que llega arriba es un literal estable y no un código de Postgres. Hay un segundo error que traducir —`rol_no_promovido`—; también en §2.5.

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
| F9 | `src/app/api/google/connect/route.ts` | gate `canManageClinica` por higiene —el que cuenta es el del callback, que es donde se escribe el renglón (§2.5)—; y los scopes `openid` y `email` :35-38, **en su propio commit** (§6) |
| F10 | `src/app/(app)/agenda/page.tsx` | `gcalSource` :1385-1440 deja de pintar `data.events` (sigue pintando `ocupado`). Fuera de la lista original: **aprobado** |
| F11 | `src/lib/__tests__/gcalConexion.test.ts` **(nuevo)** | el cerrojo de §2.2 |
| F12 | `src/app/(app)/perfil/page.tsx` | **H5.** «Desconectar» no está detrás de `isAdmin` —sólo lo está «Recrear calendario», :708— y su handler hace `setGcalEstado('sin_token')` incondicional ignorando la respuesta (:351-357). Con F5 gateando el DELETE, un invitado hace clic, recibe 403 y la interfaz le dice «desconectado» sin estarlo. Se gatea el botón y el handler pasa a mirar la respuesta. Segundo caso del mismo tipo que F10 |
| F13 | `src/lib/audit.ts` + `callback`, `disconnect`, `calendar` | **H6.** Las cuatro acciones nuevas de `AuditAccion` y sus `logAudit` (§8) |

Son **13** archivos —eran 11 antes de absorber H5 y H6—. Muy por encima del umbral del Protocolo 3, y por eso esto es un plan y no un parche.

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
3. **`feat(gcal): resolver la conexión por clínica y escribir en las dos fuentes`** — F2 + F3 + F4 + F5 + F7 + F8 + F9 (gate) + F12. **Indivisible, y ahora por dos razones.** La semántica: si el alta escribe en el calendario de la clínica y la baja borra la del actor, se rompen las dos. Y la compilación, que es H3 y no estaba visto:

   > **H3 — la serie no compilaba.** El commit 3 traía la firma nueva de `conCalendarioSpinus` (F2) y sus **tres llamadores restantes** cambiaban en el 4: `appointments/route.ts:272`, `[id]/route.ts:315` y `[id]/route.ts:415`. `npm run build` habría fallado ahí mismo, con tres call sites pasando `(admin, userId, operacion)` a una función que espera `(conexion, admin, operacion, opciones)`. El Protocolo 7 lo prohíbe explícitamente: build verde después de cada cambio.
   >
   > **Elegida la primera de las dos salidas: fundir F7/F8 en el commit 3.** La alternativa —mantener una firma compatible con `userId` durante un commit— deja un intermedio en el que las citas se escriben en un calendario y se leen del de la clínica; hoy es invisible porque sólo hay una conexión, y deja de serlo el día del primer relevo. Un intermedio que sólo es correcto mientras el sistema sea de un solo médico es justo lo que esta rama viene a quitar de en medio.
   >
   > **Precio, dicho entero:** el commit 3 pasa a tocar **ocho** archivos y el estado «3 sin 4» deja de existir. Se compensa con que ya no hay ningún punto de la serie en el que la agenda y el alta discrepen sobre a qué calendario van las citas.

4. **`feat(gcal): pedir openid y email en el consentimiento`** — los scopes de F9. **Commit propio y posterior al 3, a propósito:** si la pantalla de consentimiento de Google se comporta raro, se revierte solo sin tocar la resolución por clínica. Hasta que alguien reconecte, `google_account_sub` y `google_account_email` siguen en NULL, que es el estado de hoy.
5. **`feat(gcal): registrar en audit_log conexión, desconexión y recreación`** — F13 (§8).
6. **`test(gcal): prohibir escrituras de conexión fuera del módulo`** — F11. Va al final porque hasta aquí la prueba no puede pasar; a partir de aquí, cierra la puerta.

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
| H11, H12, H13 | — | Se resolvieron por el camino durante el trabajo del puente |
| H14 | El secreto sigue legible por su dueño mientras viva el espejo | §2.7, nueva |

---

# 11. Decisiones tomadas

Esta sección era «Lo que necesito de ti antes de escribir una línea» y eran seis preguntas. **Las seis están contestadas**; las respuestas vivían en la conversación y no en el documento, que es de donde se va a escribir el código. Quedan aquí como decisiones, no como propuestas.

1. **Gate `canManageClinica` en el callback y en `/connect`, y el 23505 explícito — SÍ a las dos** (§2.5). El gate que cuenta es el del **callback**, que es donde se escribe el renglón; el de `/connect` va por higiene, para no llevar a nadie a una pantalla de Google que va a acabar en un error. Y el conflicto **no se degrada a `'personal'` en silencio**: sale por `?gcal_error=clinica_ya_conectada`. Con el puente, además, el callback ya no ve un 23505 crudo (§2.5).
2. **Tocar `agenda/page.tsx` para dejar de pintar `data.events` — SÍ** (§0.4, F10). No hacerlo significa pintar cada cita dos veces.
3. **Estampar `gcal_calendar_id` en el `after()` — SÍ** (§0.7, F7 y F8). En el alta **y también en el PUT** cuando el evento se cree ahí. Sin eso la rama siguiente nace sin datos.
4. **§3.4, opción (a): leer `profiles` con cliente admin filtrado por `id` y `clinica_id` — SÍ.** La (b) paga un SELECT en cada alta de cita para el 0,1% de los casos en que hay que crear un calendario. Y la tercera vía que parecía obvia —cargar el nombre en el descriptor de conexión al resolverla— **no sirve**: `profiles_select` deja leer los perfiles de la clínica a admin y secretaria, pero a un médico invitado sólo el suyo, así que el descriptor saldría sin nombre justo para el usuario que más probablemente dispare la creación.
5. **Desconectar gateado a `canManageClinica` — SÍ** (§0.6, F5). Y con él viene F12: el botón de `/perfil` tiene que gatearse igual, o la interfaz miente (H5).
6. **Scopes `openid` y `email` — SÍ, en esta rama**, como **commit propio después del commit 3** (§6, commit 4), para poder revertirlos solos si la pantalla de consentimiento se comporta raro.

## Lo que la absorción destapó y sí necesita tu visto bueno

Ninguna de las dos es una pregunta de gusto: las dos cambian la forma de la rama.

- **El modo estricto de §3.3 (H2).** `conCalendarioSpinus` gana un cuarto argumento obligatorio y quien no administra la clínica deja de poder crear, desvincular y recrear. **Tiene un coste de UX real y conviene que lo aceptes con los ojos abiertos:** una secretaria que agenda la primera cita de una clínica cuyo calendario aún no existe ya no lo crea; la cita queda `pending` hasta que entre quien administra. La alternativa es dejar que cualquier miembro dispare un UPDATE masivo sobre citas que no puede leer y una escritura en la cuenta de Google de otra persona.
- **El commit 3 pasa a tocar ocho archivos (H3).** Es la salida elegida de las dos posibles, y está razonada en §6. La otra dejaba un intermedio que sólo es correcto mientras la clínica tenga un solo médico.
