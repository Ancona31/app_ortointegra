# Propuesta corregida — puente de acceso a `private.google_conexiones_secretos`

> Reescritura completa de la propuesta auditada el 2026-08-17. Sustituye al texto anterior en su totalidad: no lo enmienda, lo reemplaza. Los tres bloqueantes de la auditoría (H1, H2, H3) están resueltos de forma explícita, y las once observaciones restantes están incorporadas o reconsideradas por escrito en §11.
>
> **Nada de esto está aplicado.** El producto de este documento es un plan; el `.sql`, el script de humo y el código de aplicación se escriben después, contra lo que aquí se especifica.

---

## 0. Cómo leer este documento

Cada afirmación de hecho lleva marca. La propuesta anterior falló, entre otras cosas, por no distinguir estas dos cosas:

- **[V]** — verificado contra fuente en este repo o en `node_modules/`, con la cita al lado. Si la cita no está, la marca no es válida.
- **[J]** — juicio mío sobre el comportamiento de Postgres, PostgREST o Supabase, **no ejecutado** (no hay `psql` ni `docker` en esta máquina, y no hay base de staging: `supabase/AUDITORIA-MIGRACIONES.md` §2). Cada **[J]** lleva el nivel de confianza y, cuando lo hay, el mecanismo que lo convierte en fallo ruidoso si resulta falso.

Un **[J]** que sostenga una propiedad de seguridad y que no tenga ese mecanismo es un defecto de esta propuesta, no un detalle. He intentado que no quede ninguno; los que quedan están listados en §12.

---

## 1. El problema, en una línea, y las alternativas descartadas

`private.google_conexiones_secretos` no la alcanza nadie de la aplicación: el ACL real es `{postgres=arwdDxtm/postgres}` y no hay `GRANT` en la migración aplicada **[V]** — `supabase/migrations/20260817_gcal_conexion_clinica_a_esquema.sql` no contiene ni un `GRANT`; su §3 sólo hace `REVOKE ALL ON SCHEMA private FROM anon, authenticated` (:353) y `REVOKE ALL ON private.google_conexiones_secretos FROM anon, authenticated` (:378). Y aunque lo alcanzara, `supabase-js` habla por PostgREST, que sólo sirve esquemas expuestos: no hay ni una llamada `.schema(` en `src/` **[V]** (`grep -rn "\.schema(" src` → cero resultados) y `src/lib/supabase/admin.ts` no pasa `db: { schema }` **[V]** (el archivo entero son 9 líneas).

Se descartan, igual que en la propuesta original y por las mismas razones:

- **Exponer `private` en el panel de Supabase.** Mueve una propiedad de seguridad fuera de git, donde ninguna migración puede afirmarla, y no es reproducible en local.
- **Devolver la tabla a `public` con `REVOKE`.** `TRUNCATE` no pasa por RLS, así que expondría la destrucción de los tokens; y obliga a mover una tabla ya poblada. El repo ya tomó esta decisión en el sentido contrario para `firmas_documento` **[V]** (`20260813_firmas_documento.sql:229-236`: se revoca `ALL` a `authenticated` precisamente porque `ALL` incluye `TRUNCATE`, «que no pasa por RLS ni dispara triggers de fila»).

Lo que sí cambia respecto de la propuesta original: **el puente ya no son dos funciones, son tres**, y las tres llevan `p_clinica_id`. El porqué está en §2.

---

## 2. La forma del puente: tres funciones `SECURITY DEFINER` en `public`

### 2.0 Por qué tres y no dos

La propuesta original tenía dos funciones —una lectura y un upsert de secretos— y dejaba el alta de metadata en PostgREST. Eso parte la conexión en dos objetos escritos por dos viajes sin transacción entre ellos, y estrena un estado que hoy no existe: «hay conexión y no hay secretos» (H3). Hoy `abrirSesionGoogle` lee metadata y secretos en **una** fila de `google_tokens` **[V]** (`src/lib/gcal.ts:158-162`: un solo `select('access_token, refresh_token, expires_at, calendar_id')`): o está entera o no está.

La corrección tiene dos mitades, y hacen falta las dos:

1. **Que ese estado no pueda nacer**: el alta escribe metadata y secretos en **una sola llamada**, dentro de una transacción de Postgres. Eso es una tercera función.
2. **Que si nace por otra puerta —replay, restauración parcial, SQL a mano— sea distinguible y ruidoso**: la lectura devuelve siempre la metadata cuando la conexión existe, con un booleano `tiene_secretos`, en vez de devolver «0 filas» para dos situaciones que no significan lo mismo.

### 2.1 `public.alta_conexion_google`

```
public.alta_conexion_google(
  p_clinica_id            uuid,
  p_user_id               uuid,
  p_rol                   text,
  p_google_account_sub    text,
  p_google_account_email  text,
  p_access                text,
  p_refresh               text,
  p_expires               bigint
) RETURNS TABLE (
  conexion_id  uuid,
  calendar_id  text,
  rol          text,
  estado       text
)
```

`VOLATILE`, `SECURITY DEFINER`, `LANGUAGE plpgsql`. Sustituye al `upsert` del callback **[V]** (`src/app/api/google/callback/route.ts:66-71`) **y** al alta de secretos, en una sola llamada.

**Guardas, antes de escribir nada** (este orden importa; dimensión 4 de la auditoría de migraciones):

1. `perfil_ajeno_a_clinica` — si no existe `public.profiles` con `id = p_user_id AND clinica_id = p_clinica_id`. Es la guarda de aislamiento de H10 en el camino de escritura: sin ella, un par (clínica, usuario) mal formado crea una conexión de la clínica A a nombre de un usuario de la B.
2. `conexion_de_otra_clinica` — si ya hay fila con ese `user_id` y su `clinica_id` no es `p_clinica_id`. El índice único es por `user_id` **[V]** (`20260817_...sql:248-249`, `clinica_conexiones_google_user_id_uniq`, no parcial), así que un `ON CONFLICT (user_id) DO UPDATE` que tocara `clinica_id` **movería la conexión y su calendario de una clínica a otra en silencio**. Se prohíbe: el traslado exige desconectar primero.
3. `clinica_ya_conectada` — si `p_rol = 'clinica'` y ya hay otra fila (`user_id` distinto) con `rol = 'clinica'` en esa clínica. Es la comprobación amable; el guardián de verdad es el índice único parcial **[V]** (`20260817_...sql:241-243`, `clinica_conexiones_google_una_por_clinica ... WHERE rol='clinica'`), que sigue puesto para la carrera. Si el índice dispara de todos modos, un `EXCEPTION WHEN unique_violation` con `GET STACKED DIAGNOSTICS ... CONSTRAINT_NAME` reetiqueta el 23505 como el mismo `clinica_ya_conectada`, para que el callback tenga **un solo** literal que reconocer.

**Escritura, en una transacción:**

- `INSERT INTO public.clinica_conexiones_google ... ON CONFLICT (user_id) DO UPDATE SET` — y aquí lo que **NO** se toca es tan importante como lo que se toca:
  - **no se toca `calendar_id`**: reconectar no debe crear un segundo calendario ni huerfanar el anterior. Es la invariante que el callback ya protege hoy y documenta al detalle **[V]** (`src/app/api/google/callback/route.ts:85-95`).
  - **no se toca `rol`**: reconectar no promueve ni degrada. El relevo de administrador es un flujo consciente (plan §2.5).
  - `estado = 'activa'` sí (plan §2.5 punto 3).
  - `google_account_sub` y `google_account_email` con `COALESCE(EXCLUDED.x, tabla.x)`, por la misma razón que el refresh token en §2.2: hoy llegan `NULL` porque los scopes `openid`/`email` todavía no se piden, y `NULL` tiene que significar «no lo sé», nunca «bórralo». El comentario de la columna ya dice exactamente eso **[V]** (`20260817_...sql:270-271`: «NULL = identidad desconocida ..., NO “sin cuenta”»).
- `INSERT INTO private.google_conexiones_secretos ... ON CONFLICT (conexion_id) DO UPDATE`, con la misma regla de `COALESCE` sobre `refresh_token` de §2.2.
- `RETURN QUERY` con el descriptor.

**Lo que esta función NO hace: escribir el espejo `public.google_tokens`.** Es deliberado. El espejo muere con el archivo B **[V]** (`20260817_gcal_conexion_clinica_b_retiro.sql:247-248`, `ALTER TABLE public.google_tokens SET SCHEMA respaldos` + `RENAME`), y meterlo dentro de la función obligaría a `CREATE OR REPLACE`-arla en el archivo B para que dejara de referenciar una tabla que ya no está. El espejo se queda en TypeScript, en `src/lib/gcalConexion.ts`, con el orden y el manejo de fallos que el plan §2.4 ya fijó: primero la fuente nueva, después el espejo; si falla el espejo, se registra con operación distintiva y el archivo B aborta sobre la divergencia. **Consecuencia que hay que decir sin adornarla:** el alta es atómica *dentro de la fuente nueva* y no lo es respecto del espejo. Eso es exactamente lo que ya estaba aceptado, y el hueco que H3 denuncia —conexión sin secretos— queda cerrado, porque ese hueco estaba dentro de la fuente nueva.

### 2.2 `public.guardar_secretos_conexion`

```
public.guardar_secretos_conexion(
  p_clinica_id   uuid,
  p_conexion_id  uuid,
  p_access       text,
  p_refresh      text,
  p_expires      bigint
) RETURNS void
```

`VOLATILE`, `SECURITY DEFINER`. Cubre el refresh **[V]** (`src/lib/gcal.ts:192-195`, hoy un `UPDATE` que sólo nombra `access_token` y `expires_at`).

**Guarda:** si no existe `public.clinica_conexiones_google` con `id = p_conexion_id AND clinica_id = p_clinica_id` → `conexion_ajena_o_inexistente`. Un escritor no debe escribir en el vacío, y este es el lado caro del aislamiento: escribir los tokens de la clínica A bajo la conexión de la B haría que **las citas de B se escribieran en el calendario de Google de A**, con el nombre del paciente en el título del evento (H10).

**Guarda:** `p_access IS NULL` → `access_token_nulo`. La columna es `NOT NULL` **[V]** (`20260817_...sql:361`), así que sin la guarda el fallo sería un 23502 opaco desde dentro de `after()`.

**El `COALESCE`, y por qué la firma no puede obligar a pasar el refresh (H2):**

```
ON CONFLICT (conexion_id) DO UPDATE SET
  access_token  = EXCLUDED.access_token,
  refresh_token = COALESCE(EXCLUDED.refresh_token,
                           private.google_conexiones_secretos.refresh_token),
  expires_at    = EXCLUDED.expires_at
```

Tres razones, y hacen falta las tres para que la decisión no dependa de la disciplina de quien escriba el siguiente llamador:

1. **El refresh token no es un dato que el camino de refresco produzca.** Hoy parece que sí: `credentials.refresh_token` viene poblado tras refrescar. Pero es un eco de nuestra propia entrada, no un hecho de Google **[V]** — `node_modules/google-auth-library/build/src/auth/oauth2client.js:287-292`, `refreshAccessTokenAsync` hace literalmente `tokens.refresh_token = this.credentials.refresh_token` antes de devolver. Un contrato que descansa en que el llamador reencripte y reenvíe un valor que la librería le devolvió por cortesía es un contrato que se rompe el día que alguien no lo sabe.
2. **Hay caminos legítimos que no lo tienen.** Una función de reparación, un camino que sólo renueva el access token, un refactor que escribe `credentials.refresh_token ?? null`. Con `EXCLUDED` a pelo, cualquiera de ellos escribe `NULL`.
3. **El modo de fallo por defecto sería destructivo e indistinguible de una revocación real.** Sin refresh token, el siguiente vencimiento da `invalid_grant`; con el §5 del plan puesto, eso escribe `estado='revocada'`. La clínica pierde la sincronización y el sistema diagnostica «el médico revocó el acceso desde Google». Irrecuperable sin reconectar, y con el índice único parcial de por medio: la conexión revocada sigue ocupando el hueco de `rol='clinica'` (plan §5).

**No hay ningún caso legítimo de poner el refresh token a `NULL`.** El único borrado legítimo es el de la conexión entera, y ese pasa por el `ON DELETE CASCADE` (§2.4). Por eso `NULL` significa «no lo toques» y punto.

**`expires_at` sí se sobrescribe verbatim, incluido a `NULL`, y esto es una decisión distinta a propósito.** El argumento de H2 no aplica: `access_token` y `expires_at` viajan siempre juntos —quien tiene uno tiene el otro o sabe que no hay—, así que `NULL` aquí significa de verdad «no sé cuándo vence» y no «no me lo dieron». Preservar el valor viejo convertiría «vencimiento desconocido» en «vencido» sin decirlo. **Aviso para el llamador, no para la función [J, confianza alta]:** con `expires_at` en `NULL`, `abrirSesionGoogle` nunca entra en la rama de refresco **[V]** (`src/lib/gcal.ts:177`, `if (tokenData.expires_at && Date.now() > tokenData.expires_at)`) y el token se queda sin renovar hasta que Google conteste 401. Eso es comportamiento de hoy, no lo estrena el puente, y el sitio de arreglarlo es TypeScript.

### 2.3 `public.leer_conexion_google_con_secretos`

```
public.leer_conexion_google_con_secretos(
  p_clinica_id   uuid,
  p_conexion_id  uuid
) RETURNS TABLE (
  conexion_id     uuid,
  clinica_id      uuid,
  user_id         uuid,
  rol             text,
  calendar_id     text,
  estado          text,
  tiene_secretos  boolean,
  access_token    text,
  refresh_token   text,
  expires_at      bigint
)
```

`STABLE`, `SECURITY DEFINER`, `LANGUAGE sql`. Un `SELECT` sobre `public.clinica_conexiones_google c LEFT JOIN private.google_conexiones_secretos s ON s.conexion_id = c.id`, con `WHERE c.id = p_conexion_id AND c.clinica_id = p_clinica_id`, y `tiene_secretos = (s.conexion_id IS NOT NULL)`.

**El nombre dice que devuelve secretos.** Es feo y es a propósito: quien lea el sitio de llamada tiene que ver, sin abrir nada, que por ahí salen tokens.

**Cómo se distingue «no hay conexión» de «hay conexión sin secretos» (H3), escrito para que no haga falta deducirlo:**

| Resultado | Significa | Qué hace el llamador |
|---|---|---|
| 0 filas | No existe esa conexión, **o existe y es de otra clínica** | Anomalía. Se registra y **se lanza**. El resolvedor bajo RLS acababa de decir que existía. |
| 1 fila, `tiene_secretos = false` | La metadata existe y los secretos no | Anomalía. Se registra con operación propia (`conexion_sin_secretos`) y **se lanza**. |
| 1 fila, `tiene_secretos = true` | Todo bien | Camino normal. |

**Esta función nunca levanta excepción; devuelve 0 filas.** Es la asimetría deliberada con la escritora: un lector contesta una pregunta, un escritor no puede escribir en el vacío. Y devolver 0 filas ante una clínica ajena es lo que hace la sonda de aislamiento del §7 (P5) ejecutable desde el cliente.

**Los tokens no se imprimen nunca**, ni en el veredicto de la migración ni en el script de humo, ni truncados. Un token cifrado en la rejilla del SQL Editor acaba en una captura de pantalla.

### 2.4 Lo que el puente NO cubre, a propósito

- **La escritura de metadata que no es el alta** (`calendar_id` por comparar-y-cambiar, `estado='revocada'`, el `DELETE` del disconnect) se queda en PostgREST con el cliente admin. `public.clinica_conexiones_google` está en `public` y `service_role` tiene `arwdDxtm` sobre ella: se alcanza sin puente. Meterla en funciones sería agrandar la superficie sin ganar nada.
- **El borrado de los secretos** se apoya en el `ON DELETE CASCADE` **[V]** (`20260817_...sql:372-376`). El disparador de integridad referencial cambia al dueño de la tabla que referencia antes de ejecutar la cascada, así que `service_role` no necesita nada sobre `private` **[J, confianza alta — comportamiento documentado de las comprobaciones de integridad referencial de Postgres, no ejecutado]**. Precisamente porque es un **[J]** que sostiene el único camino destructivo, **se afirma en el veredicto con un `DELETE` real ejecutado como `service_role` dentro de una subtransacción que se deshace** (§6, R5). Si el cascade no dispara, el disconnect dejaría tokens cifrados huérfanos en `private` para siempre y nadie se enteraría, porque el `DELETE` del padre habría tenido éxito.

---

## 3. Condiciones no negociables de las tres funciones

1. **`SET search_path = ''` en la definición, y todo nombre calificado** (`private.google_conexiones_secretos`, `public.clinica_conexiones_google`, `public.profiles`).

   **Corrección a la propuesta original, que aquí se retira:** decía que las funciones del baseline «no llevan `search_path`» citando `supabase/baseline/05_functions.sql:20-27`, y presentaba eso como un mal hábito del repo que no había que imitar. **Es falso.** Ese archivo es una foto anterior al 2026-04-27 **[V]** — `20260427_b1_03_security_definer_search_path.sql` fija `SET search_path = public, pg_temp` en seis funciones, `get_clinica_id` entre ellas (:88-103), y `20260429_b2_02_consolidate_get_clinica_id.sql:22-23` lo da por hecho («Tras B1.03 ambas tienen el mismo `SET search_path = public, pg_temp`»). En producción sí lo lleva. La propuesta estaba leyendo un artefacto obsoleto.

   Se elige `''` en vez de `public, pg_temp` —que es la convención del repo— por una razón concreta y no por gusto: `''` deja fuera `pg_temp` sin discusión, y estas tres funciones tocan la tabla de tokens. La divergencia con la convención va escrita en el comentario del archivo, para que la siguiente persona no la «arregle».

2. **Sin SQL dinámico, sin `format()`, sin `EXECUTE`.** Argumentos tipados `uuid` / `text` / `bigint`.

3. **`REVOKE ALL ON FUNCTION … FROM PUBLIC, anon, authenticated;` antes del `GRANT EXECUTE … TO service_role;`**, en ese orden, siempre juntas, y para las tres funciones. Es obligatorio: el `pg_default_acl` de producción de tipo `f` sobre `public` es `{postgres=X, anon=X, authenticated=X, service_role=X}`, así que una función nueva en `public` nace ejecutable por `anon` **directamente**, no vía `PUBLIC` — revocar sólo de `PUBLIC` no bastaría.

   **Corrección al precedente que citaba la propuesta original (H12):** decía que el patrón «ya existe en el repo en `20260813_firmas_documento.sql:235`». Esa línea es `REVOKE ALL ON public.firmas_documento FROM PUBLIC, anon, authenticated` **[V]** — una **tabla**, no una función, y sin `GRANT` posterior a `service_role`. Los precedentes reales sobre funciones son **[V]**:
   - `20260807_folio_01_esquema_y_generador.sql:612-613` — `REVOKE ALL ON FUNCTION public.generar_folio(text) FROM PUBLIC, anon, authenticated, service_role;`, con el razonamiento escrito al lado.
   - `20260615_consultorios_05_marcar_default_rpc.sql:110-116` — y su comentario anota exactamente el hecho que aquí importa: «en Supabase, anon/authenticated/service_role mantienen EXECUTE por configuración del proyecto independiente del REVOKE FROM PUBLIC».

   El patrón que se propone es correcto; lo que estaba mal era la cita. Se apunta porque es la misma clase de error que este ejercicio existe para eliminar: una línea citada de memoria que sostiene la conclusión sin decir lo que se le atribuye.

4. **Ni un `GRANT USAGE ON SCHEMA private` ni un privilegio de tabla a `service_role`.** La función corre como su dueño y no los necesita. Y esa denegación se afirma **a propósito** en el veredicto (R6): el día que alguien añada ese grant «por si acaso», la migración correctiva vuelta a correr lo detecta. La propuesta original declaraba esta condición en prosa y luego no la comprobaba (H8a).

5. **Ni una sobrecarga.** `CREATE OR REPLACE FUNCTION` con una lista de argumentos distinta **crea una función nueva**, no reemplaza la anterior; con dos sobrecargas del mismo nombre, PostgREST responde ambigüedad en vez de ejecutar **[J, confianza alta]**. Por eso: `DROP FUNCTION IF EXISTS` con la firma exacta antes de cada `CREATE`, y una afirmación de catálogo de que hay **exactamente tres** funciones con esos nombres en `public` (§6, C1).

6. **Errores con nombre.** `RAISE EXCEPTION` con el token de máquina como `MESSAGE` (`clinica_ya_conectada`, `conexion_ajena_o_inexistente`, `perfil_ajeno_a_clinica`, `conexion_de_otra_clinica`, `access_token_nulo`) y el texto humano en `DETAIL`. PostgREST devuelve `message`, `details`, `hint` y `code` en el cuerpo del error **[J, confianza alta, no ejecutado]**, así que el callback compara contra un literal estable en vez de contra una frase. La sonda P3 del §7 comprueba justo eso.

7. **Comentario `COMMENT ON FUNCTION` en las tres**, diciendo que son el único camino de la aplicación a `private` y que `service_role` no alcanza esa tabla por ningún otro. Es el sitio donde se consulta (§5.3).

---

## 4. Lo que cambia en la aplicación

El puente no sirve de nada si el llamador se traga sus errores. Hoy `abrirSesionGoogle` desestructura `{ data: tokenData }` y **descarta `error`**, y `if (!tokenData) return null` **[V]** (`src/lib/gcal.ts:158-163`). Con el puente, cualquier fallo —EXECUTE mal concedido, caché de PostgREST fría, dueño equivocado— entraría por ese mismo `null`, y aguas abajo `conCalendarioSpinus` devuelve `null`, el `catch` no se ejecuta porque no hubo excepción, y la cita se marca `'synced'` **sin evento en Google** **[V]** (`src/app/api/appointments/route.ts:288-289`: `google_event_id = creado?.data.id ?? null; gcal_sync_status = 'synced'`, la asignación va después del `??  null` y sin comprobar que se creó algo; el PUT tiene la misma forma en `src/app/api/appointments/[id]/route.ts:328-329`).

Sería el patrón que la propia migración aplicada denuncia en su cabecera —«rompe CALLADO… el error se traga»— reproducido dentro del remedio. Así que el puente entra con estos cambios, no sin ellos:

| # | Archivo | Qué cambia |
|---|---|---|
| A1 | `src/lib/gcalConexion.ts` *(nuevo, F1 del plan)* | `altaConexion`, `guardarSecretos` y `leerConexionConSecretos` llaman a los tres RPC. Único sitio del repo donde aparecen sus nombres. Espejo a `google_tokens` en el orden del plan §2.4. |
| A2 | `src/lib/gcal.ts` | `abrirSesionGoogle` **deja de devolver `null` por causa de los secretos**. Las tres ramas de la tabla de §2.3: `error` no nulo, 0 filas, o `tiene_secretos=false` → `registrarFalloGCal` con operación distinguible y **`throw`**. El único `null` que sobrevive es «no hay conexión», y ese lo decide el resolvedor bajo RLS antes de llamar, no esta función. |
| A3 | `src/app/api/appointments/route.ts` | El `'synced'` optimista pasa a `creado?.data.id ? 'synced' : 'failed'`, con `registrarFalloGCal` en la rama falsa. Bajo el diseño nuevo, si la ruta resolvió conexión, un `creado === null` es una anomalía, no «este médico no tiene Google». |
| A4 | `src/app/api/appointments/[id]/route.ts` | Lo mismo para el PUT. |
| A5 | `src/app/api/google/callback/route.ts` | El alta es **una** llamada (`altaConexion`), no un INSERT más un RPC. Traduce **los dos** errores con nombre que el alta puede devolverle, porque los dos son accionables por el médico y ninguno es un fallo de Google: `clinica_ya_conectada` → `?gcal_error=clinica_ya_conectada` (plan §2.5), y `rol_no_promovido` → `?gcal_error=rol_no_promovido` (es el relevo de administrador: esa cuenta ya tiene una conexión `'personal'` y reconectar no la promueve, hay que desconectarla antes). Sin la segunda rama, ese caso cae en el `catch` genérico y sale como `?error=oauth_failed`: «falló la conexión con Google» cuando Google no falló y lo que hay que hacer es otra cosa. |
| A6 | `src/lib/__tests__/gcalConexion.test.ts` *(nuevo)* | El cerrojo reorientado de §5.2. |

**A3 y A4 están fuera de la lista original del brief de la Rama 1** y son cambios de comportamiento visible (una cita que hoy sale `'synced'` pasaría a `'failed'`). Van marcados como **decisión que necesita OK** (§12, D2). Sin ellos el puente se puede desplegar igual, pero el modo de fallo silencioso que H4 describe se queda vivo.

---

## 5. La migración correctiva: qué contiene el archivo

**Nombre:** `supabase/migrations/20260818_gcal_puente_secretos.sql`.

Va con fecha del 18 y no como «parte C» del 17 a propósito: `20260817_gcal_conexion_clinica_b_retiro.sql` ya ocupa la letra B y es lo **último** que se aplica —después del deploy y de un periodo de reposo **[V]** (su runbook, líneas 12-27)—, así que una «C» del 17 ordenaría el puente detrás del retiro y mentiría sobre la secuencia. En replay por nombre el orden A → B → C tampoco importa: el puente no referencia `google_tokens` en ninguna de las tres funciones.

**Estructura del archivo, en orden:**

```
BEGIN;
SET LOCAL lock_timeout      = '5s';
SET LOCAL statement_timeout = '60s';
```

— siguiendo el patrón del repo **[V]** (`20260817_...sql:112-113`, `20260817_..._b_retiro.sql:39-40`, `20260810_plantillas_documento.sql:75`).

**§1 — Tabla temporal de resultados.** `CREATE TEMP TABLE ... ON COMMIT PRESERVE ROWS` con `(orden int, afirmacion text, resultado text)`. Existe para reconciliar la tensión que la propuesta original no vio: **la prueba de escritura quiere estar dentro de la transacción y el veredicto quiere ser la última sentencia del archivo.**

**§2 — Guardas de sobrecarga.** `DROP FUNCTION IF EXISTS` con las tres firmas exactas.

**§3 — Las tres funciones**, con sus `COMMENT ON FUNCTION`.

**§4 — `REVOKE` + `GRANT`** de las tres, en el orden de §3.3.

**§5 — Higiene de grants sobre `public.clinica_conexiones_google` (H13).** El ACL real de `authenticated` es `rm`: `r` = SELECT, `m` = MAINTAIN, privilegio nuevo de PG 17. La migración aplicada revocó una lista enumerada que no lo incluye **[V]** (`20260817_...sql:343-344`: `REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER`). Se sustituye por el patrón del propio repo **[V]** (`20260813_firmas_documento.sql:235-236`):

```
REVOKE ALL ON public.clinica_conexiones_google FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.clinica_conexiones_google TO authenticated;
```

El impacto de MAINTAIN es prácticamente nulo —habilita VACUUM/ANALYZE/REINDEX, y PostgREST no emite esas sentencias—. Lo que se corrige es el **método**: enumerar verbos deja huecos que aparecen solos al cambiar de versión mayor. **[J, confianza media-alta, no ejecutado]:** `GRANT`/`REVOKE` sobre una tabla toma un lock fuerte; con una fila y sin tráfico es instantáneo, y el `lock_timeout` de arriba lo acota. Si alguien discrepa del alcance, esta sección se puede retirar sin tocar el resto del archivo.

**§6 — `COMMENT` corregidos (H9).** Las afirmaciones falsas no están sólo en los `.md`; están **dentro de la base**, donde se consulta con `\dn+` y `\d+` **[V]**:

- `20260817_...sql:356` — `COMMENT ON SCHEMA private`: «Sólo service_role (que bypasea RLS) y el dueño de la base». Es exactamente lo que resultó falso: `BYPASSRLS` actúa sobre el filtro de filas, **después** del chequeo de privilegios de esquema y tabla, y `service_role` no tiene ninguno de los dos aquí.
- `20260817_...sql:381` — `COMMENT ON TABLE`: «Fuera de public y sin grants: no alcanzable por PostgREST». Cierto de menos: tampoco era alcanzable por la aplicación.

Se reemplazan por texto que diga lo que hay: que el esquema no tiene grants para **ningún** rol de la aplicación, que el único camino desde la aplicación son las tres funciones `SECURITY DEFINER` de `public`, y que quien añada un `GRANT` a `service_role` está desandando una decisión y no arreglando un olvido. El texto nuevo nombra este archivo, para que el rastro se siga desde la base.

**Lo que NO se hace: editar `20260817_gcal_conexion_clinica_a_esquema.sql`.** El repo es forward-only y los archivos aplicados se conservan **[V]** (`CLAUDE.md`, «Incidentes resueltos»: «los archivos de migración originales se conservan; los reverts son migraciones explícitas con timestamp posterior»). Su comentario de cabecera (:38-39) queda con la afirmación falsa; el registro de la corrección es este archivo, con su fecha, justo al lado en el listado.

**§7 — `NOTIFY pgrst, 'reload schema';`** dentro de la transacción, antes del `COMMIT`. Precedente del repo **[V]**: `20260807_folio_01_esquema_y_generador.sql:617` y `20260813_firmas_documento.sql:444`, los dos con `NOTIFY` inmediatamente antes de `COMMIT` (:446). **La migración aplicada no lo lleva** **[V]** (`grep -n "NOTIFY pgrst" 20260817_...sql` → cero), ni para la tabla ni para la columna nuevas. Supabase tiene un event trigger de DDL que suele recargar la caché **[J, confianza media]**; el problema nunca fue que fallara siempre, sino que **nada distinguía el caso en que falla**. El `NOTIFY` es transaccional: si el veredicto aborta, no se entrega.

**§8 — El veredicto dentro de la base** (todo el §6 de este documento), antes del `COMMIT`, para que un fallo deshaga la migración entera.

```
COMMIT;
RESET ROLE;              -- cinturón: un SET ROLE no-LOCAL sobrevive al COMMIT
SELECT ... FROM pg_temp....  -- última sentencia del archivo
```

---

## 6. El veredicto dentro de la base

La propuesta original tenía trece afirmaciones y **las trece se respondían dentro del motor**, cuando lo que se rompió fue el camino de la aplicación hacia el motor. Aquí el veredicto interno se endurece **y deja de ser lo que decide**: lo que decide está en §7.

### 6.1 Mecánica obligatoria de los bloques con rol

Sin esto, las afirmaciones que más importan son las que dan verde sin haber comprobado nada.

- **`SET LOCAL ROLE <rol>;` y, en la sentencia inmediatamente siguiente, `IF current_user <> '<rol>' THEN RAISE EXCEPTION`.** `SET LOCAL` **fuera de un bloque de transacción no hace nada**: emite un `WARNING` y sigue **[J, confianza alta]**. El archivo abre con `BEGIN;` explícito, así que debería estar dentro; la afirmación de `current_user` es lo que convierte «debería» en «se comprueba». Y cubre de paso el caso de que el rol que aplica la migración no sea miembro de `service_role` o `authenticated` **[J: en Supabase, `postgres` lo es y `SET ROLE` es el mecanismo que la propia documentación recomienda para probar policies — confianza alta, no ejecutado]**: si no lo fuera, el `SET ROLE` reventaría y la migración abortaría, que es el resultado conservador correcto.
- **`RESET ROLE` en la salida normal y dentro de *cada* manejador de excepciones.** Un bloque `DO` de plpgsql sin cláusula `SET` propia no establece un nivel de anidamiento de GUC: el cambio de rol sobrevive al bloque **[J, confianza alta para `SET`; media-alta para el detalle exacto de `SET LOCAL` dentro de `DO` — en las dos lecturas el arreglo es el mismo]**. Y un `EXCEPTION WHEN` abre una subtransacción cuyos cambios de GUC se deshacen al abortarla **[J, confianza alta]**, así que si el rol vuelve o no vuelve depende de dónde caiga el `SET` respecto del `BEGIN … EXCEPTION` — y eso no se ve leyendo el código. Se pone en los dos sitios y se deja de depender de saberlo.
- **Afirmación final `current_user = 'postgres'`** antes del `COMMIT`. Si el resto del archivo corriera como `authenticated`, los `GRANT` fallarían, o —peor— pasarían y el `SELECT` final se evaluaría bajo RLS devolviendo conteos falsos.
- **Sujetos resueltos por subconsulta, jamás literales de producción (H6).** El archivo tiene que sobrevivir a un replay sobre una base recién creada desde `supabase/baseline/` **[V]** (`AUDITORIA-MIGRACIONES.md` §2). Se resuelven al principio:
  - `v_conexion_id`, `v_clinica_id`, `v_user_id` ← `SELECT id, clinica_id, user_id FROM public.clinica_conexiones_google WHERE rol='clinica' AND estado='activa' ORDER BY created_at LIMIT 1`.
  - `v_perfil_id` ← `SELECT id FROM public.profiles WHERE clinica_id = v_clinica_id LIMIT 1` (elegido a partir de la clínica de la conexión, así que su `clinica_id` no es nulo y su clínica sí tiene conexión: los dos matices que harían fallar la afirmación sin que nada estuviera mal).
  - Si alguno sale nulo, cada afirmación que lo necesite escribe **`'NO PROBADO — no hay conexiones en esta base'`** en la tabla temporal. Nunca un paso silencioso: «no probado» y «probado y bien» no pueden salir del mismo color.
- **Las pruebas de escritura van en una subtransacción que se deshace (H7).** Patrón: `BEGIN … EXCEPTION WHEN sqlstate 'ZX001' THEN …` con un `RAISE EXCEPTION USING ERRCODE='ZX001'` centinela al final del cuerpo. Clase de SQLSTATE no asignada por Postgres, para no tragarse errores reales: cualquier otro error no se captura y aborta la migración.

  **Corrección a mi propio H7, que estaba mal en un detalle que lo invalidaba:** dije «se anota el resultado en una tabla temporal antes de levantarla». **No funciona.** El `INSERT` en la temporal ocurriría *dentro* de la subtransacción y se deshace con ella. Lo correcto: el cuerpo asigna el resultado a una **variable plpgsql** (que no es transaccional), levanta el centinela, y **el manejador** —que ya corre en la transacción exterior, viva— escribe la variable en la tabla temporal y hace `RESET ROLE`.

### 6.2 Afirmaciones de catálogo (C1–C11)

Salen todas en la rejilla del `SELECT` final.

| # | Afirmación | Origen |
|---|---|---|
| C1 | Las tres funciones existen con la firma exacta (`to_regprocedure`) **y no hay sobrecargas**: `count(*)` en `pg_proc` para esos tres `proname` en `public` = 3 | orig. 1 + §3.5 |
| C2 | `prosecdef = true` y `proconfig` contiene `search_path=`, en las tres | orig. 12 |
| C3 | `has_function_privilege('service_role', …, 'EXECUTE')` = true, en las tres | orig. 2 |
| C4 | `has_function_privilege` = false para `anon` y `authenticated`, en las seis combinaciones | orig. 11 |
| C5 | **El dueño alcanza `private`**: `has_table_privilege(p.proowner::regrole::text, 'private.google_conexiones_secretos', v)` = true para SELECT/INSERT/UPDATE/DELETE, resolviendo el dueño desde `pg_proc` y no asumiendo que se llama `postgres` | **nueva, H8e** |
| C6 | `grants_indebidos` = 0 — el contador que ya existe en la migración aplicada **[V]** (`20260817_...sql:660-663`) | orig. 9 |
| C7 | `authenticated` sobre `public.clinica_conexiones_google`: SELECT = true, y **false para el conjunto completo restante** (`INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN`), no para tres verbos elegidos a mano | orig. 5 + 13, endurecida por H13 |
| C8 | **`anon` no tiene ningún privilegio** sobre `public.clinica_conexiones_google` (el conjunto completo, incluido SELECT) | **nueva, H8d** |
| C9 | `service_role` tiene **SELECT**, INSERT, UPDATE y DELETE sobre `public.clinica_conexiones_google`. El SELECT no es decorativo: el comparar-y-cambiar de `crearCalendarioSpinus` sólo se entera de que perdió la carrera por su `.select('calendar_id').maybeSingle()` **[V]** (`src/lib/gcal.ts:291-294`), y la re-lectura de desempate también **[V]** (`:316-320`) | orig. 7 + **H8c** |
| C10 | `appointments.gcal_calendar_id` visible: `attacl IS NULL` y `has_column_privilege('authenticated', …, 'SELECT')` = true | orig. 8 |
| C11 | Los `COMMENT` corregidos están puestos: el de `private` ya no contiene la frase «bypasea RLS» y el de la tabla nombra este archivo | **nueva, H9** |

### 6.3 Afirmaciones con rol real (R1–R9)

Cada una en su bloque `DO`, con la mecánica de §6.1, escribiendo su línea en la tabla temporal.

| # | Rol | Afirmación | Origen |
|---|---|---|---|
| R1 | `service_role` | `leer_conexion_google_con_secretos(v_clinica_id, v_conexion_id)` devuelve **1 fila con `tiene_secretos = true`**. Se comprueban el conteo y el booleano; **los valores no se imprimen** | orig. 3, endurecida |
| R2 | `service_role` | La misma función con `p_clinica_id = gen_random_uuid()` y la conexión real devuelve **0 filas**. Es H10 hecho ejecutable | **nueva** |
| R3 | `service_role` | `guardar_secretos_conexion` sobre la conexión real, **dentro de subtransacción con centinela**: se pasa el `access_token` actual y `p_refresh = NULL`, y se comprueba **dentro** que `refresh_token` **no cambió**. Es la prueba del `COALESCE` de H2, no sólo de que la función corre. Se deshace | orig. 4, rehecha por H7 |
| R4 | `service_role` | `alta_conexion_google` con la clínica y el usuario reales, en subtransacción con centinela: hace el `DO UPDATE`, **no crea fila nueva** (`count` de conexiones igual antes y después), **no pisa `calendar_id`** y deja los secretos coherentes. Se deshace | **nueva** — es el tercer camino y la propuesta original no lo tenía |
| R5 | `service_role` | `DELETE FROM public.clinica_conexiones_google WHERE id = v_conexion_id` como `service_role`; después `RESET ROLE` y, ya como `postgres`, comprobar que `private.google_conexiones_secretos` **ya no tiene esa fila**. Prueba del `ON DELETE CASCADE`, que es el único camino destructivo y ninguna de las trece afirmaciones tocaba. Se deshace | **nueva, H8b** |
| R6 | `service_role` | `SELECT … FROM private.google_conexiones_secretos` **debe fallar** con `insufficient_privilege`; si tiene éxito, el bloque levanta excepción. Es la afirmación que justifica no conceder `USAGE ON SCHEMA private` | **nueva, H8a** — la propuesta la declaraba en prosa y no la comprobaba |
| R7 | `authenticated` | El mismo `SELECT` sobre `private` debe fallar | orig. 10 |
| R8 | `authenticated` | Con `set_config('request.jwt.claims', '{"sub":"<v_perfil_id>"}', true)`: ve **exactamente 1 fila** de `clinica_conexiones_google` bajo su policy. La simulación sí satisface a `public.get_clinica_id()` — es `SECURITY DEFINER`, `LANGUAGE sql`, y su cuerpo es `SELECT clinica_id FROM profiles WHERE id = auth.uid()` **[V]** (`supabase/baseline/05_functions.sql:20-27`, con `search_path` fijado después por `20260427_b1_03`). **El bloque limpia el claim al salir**, también en el manejador: es transaccional y los bloques siguientes lo verían | orig. 6 |
| R9 | `authenticated` | Llamar a `leer_conexion_google_con_secretos` **debe fallar** con `insufficient_privilege`. Complementa C4 con alcance real: `has_function_privilege` puede decir la verdad y aun así no ser lo que ocurre | **nueva** |

Nueve bloques y once afirmaciones de catálogo: veinte, frente a las trece originales. **Ninguna decide el deploy.** Lo que hacen es abortar la migración si algo dentro de la base está mal — y como el veredicto va antes del `COMMIT`, abortar significa que no queda nada aplicado.

---

## 7. La comprobación que decide: fuera de la base, antes del deploy (H1)

Este es el bloqueante principal y por eso tiene sección propia. **Ninguna afirmación SQL puede probar que PostgREST encuentre la función.** `supabase-js` no habla SQL: habla HTTP contra una lista de esquemas expuestos y contra una caché de esquema. La secuencia que hay que hacer imposible es esta: se aplica la correctiva → las veinte salen en verde → se despliega → `admin.rpc('leer_conexion_google_con_secretos', …)` responde `PGRST202: Could not find the function … in the schema cache` → el fallo cae dentro de `after()`, donde el error se traga, y no llega al médico.

### 7.1 Forma concreta

**`scripts/gcal-puente-humo.ts`**, ejecutado con `npx tsx scripts/gcal-puente-humo.ts`. Es el patrón que el repo ya usa para scripts de una sola vez **[V]** (`scripts/stripe-setup.ts:5` documenta `npx tsx scripts/stripe-setup.ts` y :11-14 carga `.env.local` con `dotenv`).

**Importa el cliente real, no una copia:** `import { createAdminClient } from '../src/lib/supabase/admin'` — import relativo, sin alias `@/`, y `admin.ts` no importa nada del árbol de la app **[V]** (sólo `@supabase/supabase-js`). El punto entero de la comprobación es que pase por el mismo objeto que la producción, con las mismas variables (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) y sin `db: { schema }`.

**No escribe nada.** Las tres sondas de escritura son negativas: se rechazan en la guarda antes de tocar una fila. Eso es deliberado — desde el cliente no hay subtransacción que deshacer, así que la única prueba de escritura aceptable contra producción es la que no escribe.

**No imprime tokens.** Ni truncados. Sólo booleanos, longitudes y códigos de error.

### 7.2 Las cinco sondas y el criterio de aprobado

| Sonda | Llamada | Aprobado si | Suspenso si |
|---|---|---|---|
| **P1** | `admin.from('clinica_conexiones_google').select('id, clinica_id, user_id').eq('rol','clinica').eq('estado','activa')` | devuelve **exactamente 1** fila (lo que hay hoy en producción) | 0 filas → **`NO PROBADO`, salida ≠ 0**. No se despliega sobre una comprobación vacía |
| **P2** | `admin.rpc('leer_conexion_google_con_secretos', { p_clinica_id, p_conexion_id })` con los valores de P1 | `error === null`, `data.length === 1`, `data[0].tiene_secretos === true`, `typeof data[0].access_token === 'string'` | cualquier otra cosa; en particular `PGRST202` (no está en la caché), `42501` (permission denied), `42883` (no existe la función) |
| **P3** | `admin.rpc('guardar_secretos_conexion', { p_clinica_id: <uuid aleatorio>, p_conexion_id: <uuid aleatorio>, p_access: 'sonda', p_refresh: null, p_expires: null })` | devuelve **error** con `code === 'P0001'` y `message === 'conexion_ajena_o_inexistente'` — o sea: **la función existe, es ejecutable, corrió y rechazó** | `PGRST202`, `42501`, `42883`, `PGRST203` (ambigüedad por sobrecarga), o `error === null` (¡escribió algo!) |
| **P4** | `admin.rpc('alta_conexion_google', …)` con clínica y usuario aleatorios | error `P0001` / `perfil_ajeno_a_clinica` | igual que P3 |
| **P5** | `admin.rpc('leer_conexion_google_con_secretos', { p_clinica_id: <uuid aleatorio>, p_conexion_id: <el real de P1> })` | `error === null` y **`data.length === 0`** — el filtro de aislamiento de H10, comprobado desde el cliente | 1 fila devuelta: la conexión se lee desde una clínica ajena |

**Criterio de salida, sin matices:** las cinco en verde ⇒ se puede desplegar. Cualquiera en rojo o en `NO PROBADO` ⇒ **no se despliega**, y el script sale con código ≠ 0 y una tabla legible en la terminal.

P3 y P4 son la parte que la propuesta original no tenía y que resuelve el bloqueante: **distinguen «la función no está donde el cliente la busca» de «la función está y me dijo que no»**. Un `PGRST202` y un `P0001` se parecen mucho en un log y no se parecen en nada en lo que significan.

### 7.3 Cuándo se corre

1. Aplicar `20260818_gcal_puente_secretos.sql` en el SQL Editor. Leer el veredicto en la rejilla.
2. **Correr el script.** Desde local, contra producción (no hay staging).
3. Sólo entonces, desplegar el código.

Si el paso 2 falla por caché fría pese al `NOTIFY`, el remedio es volver a lanzar el `NOTIFY pgrst, 'reload schema';` suelto y repetir el script. El archivo entero es idempotente (`DROP … IF EXISTS` + `CREATE OR REPLACE`, pruebas de escritura deshechas, cero escrituras de datos), así que reaplicarlo completo también es seguro.

---

## 8. Documentación y cerrojos

### 8.1 `PLAN-RAMA1-CONEXION-CLINICA.md:78`

La celda dice hoy **[V]**:

> `| private.google_conexiones_secretos SELECT/UPSERT | **admin** | fuera de PostgREST, sin grants |`

Documenta la avería como si fuera el diseño: «fuera de PostgREST, sin grants» era justo la razón por la que no funcionaba. Pasa a decir que ese acceso va por los tres RPC `SECURITY DEFINER` de `public`, nombrándolos, y que el cliente admin los invoca con `.rpc()`.

### 8.2 El cerrojo de Vitest del plan §2.2 (H11)

El plan propone una prueba que recorre `src/` y falla si `'google_tokens'` o `'google_conexiones_secretos'` aparecen fuera de `src/lib/gcalConexion.ts` **[V]** (`PLAN-RAMA1-CONEXION-CLINICA.md:107`). **Con el puente, el literal `google_conexiones_secretos` no vuelve a aparecer en `src/` nunca**: el código llama a un RPC. Media prueba queda vacía dando sensación de cobertura, y un camino nuevo puede llamar a `leer_conexion_google_con_secretos` desde cualquier archivo con el PR en verde.

Lista nueva, cinco literales, todos confinados a `src/lib/gcalConexion.ts`:

- `alta_conexion_google`
- `guardar_secretos_conexion`
- `leer_conexion_google_con_secretos`
- `clinica_conexiones_google`
- `google_tokens`

Se conserva además `google_conexiones_secretos` como sexto, aunque ya no deba aparecer en ningún sitio: cuesta una línea y atrapa a quien intente `admin.schema('private')`.

### 8.3 Dimensión nueva para `supabase/AUDITORIA-MIGRACIONES.md` §4

Se añade al final de la lista, como pide la §6 de ese mismo archivo:

> **15. Alcance de los roles, en las dos direcciones, y desde el cliente que va a usarlo.** Una migración que retira privilegios casi siempre comprueba que `anon` y `authenticated` no llegan, y casi nunca que **el rol de la aplicación sí llega**. Las dos preguntas hay que hacerlas. Cuatro cosas concretas que buscar:
>
> - **Un esquema nuevo no hereda nada.** Las entradas de `pg_default_acl` están declaradas sobre esquemas nombrados; si el esquema no está en esa lista, los objetos que se creen dentro nacen sin un solo grant. Y `BYPASSRLS` no salva: es un atributo de rol sobre el filtro de filas, que se evalúa **después** del chequeo de privilegios de esquema y de tabla.
> - **`has_table_privilege` no prueba alcance.** Ignora el `USAGE` del esquema y puede devolver `true` sobre una tabla que el rol no puede tocar. Toda afirmación que importe va con `SET LOCAL ROLE` real dentro de un bloque que aborta — y con una afirmación de `current_user` **inmediatamente después** del `SET`, porque `SET LOCAL` fuera de un bloque de transacción es un no-op que sólo emite un `WARNING`, y sin esa afirmación las pruebas de rol dan verde habiendo corrido como el rol equivocado. `RESET ROLE` en la salida normal **y** en cada manejador de excepciones.
> - **Alcanzable por Postgres ≠ alcanzable por PostgREST.** Son dos preguntas. Toda tabla, vista, columna o función nueva que la aplicación vaya a usar lleva `NOTIFY pgrst, 'reload schema';` dentro de la transacción, y el esquema tiene que estar expuesto o hay que llegar por otro camino.
> - **La comprobación que decide no puede vivir dentro de SQL.** Si el cambio existe para que la aplicación llegue a algo, la condición de salida es una llamada **desde el cliente real** (`createAdminClient()`, el mismo objeto que usa producción) antes del deploy, y con sondas que distingan «no está donde lo busco» de «está y me rechazó». Un veredicto en la rejilla del SQL Editor no puede responder a eso.

---

## 9. Orden, ventana de despliegue y qué se rompe a medias

- **La correctiva es aditiva pura.** Crea funciones que nadie llama todavía; el único cambio sobre un objeto existente es el `REVOKE ALL` + `GRANT SELECT` del §5, que deja a `authenticated` con lo que ya usaba. Código viejo contra esquema nuevo: no se entera. Es el orden seguro (dimensión 12).
- **Correctiva sin deploy:** inocuo. Producción sigue leyendo `google_tokens` **[V]** (`src/lib/gcal.ts:159`) y nada la toca.
- **Deploy sin correctiva:** roto y **callado**, por la misma razón que la cabecera de la migración A describe para su propio caso: el alta de citas escribe dentro de `after()`, donde el error se traga. Con A2 puesto (§4) deja de ser callado —pasa a `gcal_sync_status='failed'` y a una línea de log con operación distinguible—, pero sigue siendo roto. **Nunca en este orden.**
- **El script de humo va en medio**, y es el que autoriza el paso.
- **Despliegue rodante:** la instancia vieja sigue leyendo y escribiendo `google_tokens`; la nueva escribe las dos fuentes. Es exactamente el escenario que el plan §2.4 y el archivo B ya contemplan, y el puente no lo cambia.
- **Archivo B sigue siendo lo último**, después del deploy, del periodo de reposo y del corte de la doble escritura **[V]** (su runbook, :12-27). El puente no toca `google_tokens`, así que B no necesita cambios por esto.

**Commits** (encajan en la serie del plan §6, que no se reordena):

1. `fix(gcal): puente SECURITY DEFINER a los secretos de la conexión` — el `.sql`, el script de humo, y los dos cambios de documentación de §8.1/§8.3. Sin código de aplicación: nada de esto se llama todavía.
2. Los cambios A1–A5 entran en los commits 1 y 3 de la serie del plan, donde ya estaban previstos.
3. El cerrojo reorientado (§8.2, A6) se queda en el commit 5 de la serie, que es donde la prueba puede pasar por primera vez.

---

## 10. Y una cosa que este puente **no** arregla, para que el verde no se lea de más (H14)

Mientras viva la doble escritura, el mismo ciphertext está en `private.google_conexiones_secretos` **y** en `public.google_tokens`. Esa tabla tiene RLS con `tokens_select_own` **[V]** (`supabase/baseline/07_rls_policies.sql:357-360`) y ACL `authenticated=arwdDxtm`: el médico dueño lee sus propios tokens cifrados por PostgREST, y por la policy legacy `"Users manage own tokens"` **[V]** (`:341-345`, `FOR ALL TO public`) también los escribe.

No es un fallo del puente y el archivo B lo cierra. Se anota para que «los tokens están fuera de alcance» no se dé por vigente antes de tiempo: hoy es media verdad, y lo seguirá siendo hasta el paso 6 del runbook de B.

---

## 11. Hallazgos propios que reconsidero

La instrucción era decirlo en vez de arrastrarlos por coherencia. Son cuatro:

1. **H7 estaba mal en el detalle que lo hacía funcionar.** Dije que el resultado de la prueba de escritura se anota en la tabla temporal «antes de levantar» el centinela. El `INSERT` estaría dentro de la subtransacción y se desharía con ella; el resultado se perdería y la afirmación saldría vacía. Lo correcto está en §6.1: variable plpgsql dentro, escritura a la temporal **desde el manejador**. El mecanismo que propuse era el bueno; el orden que describí, no.

2. **H13 es más leve de lo que su posición en la lista sugería, y su arreglo es más amplio.** `MAINTAIN` para `authenticated` no habilita nada que PostgREST pueda emitir. Lo mantengo porque el método —enumerar verbos— sí es el defecto, pero el arreglo que propongo (§5, `REVOKE ALL` + `GRANT SELECT`) es un cambio sobre una tabla ya en producción por un riesgo prácticamente nulo. Va marcado como retirable sin tocar el resto (§12, D3), y si se retira, la afirmación C7 se queda igual: comprueba el conjunto completo y tolera `MAINTAIN` explícitamente, dejándolo escrito en la rejilla en vez de en el olvido.

3. **La parte de H5 sobre la afirmación 6 la formulé peor de lo que debía.** Escribí que, sin `SET ROLE` efectivo, «la 6 pasa o falla por motivos ajenos (postgres es dueño de `profiles`, pero la RLS sí se le aplica al no ser… depende de `FORCE`)». Eso no es un análisis, es una duda escrita en voz alta. La formulación correcta: `postgres` en Supabase es superusuario y la RLS no se le aplica salvo `FORCE ROW LEVEL SECURITY` sobre la tabla **[J, confianza alta]**, así que la afirmación no probaría nada. La conclusión no cambia —la afirmación de `current_user` es lo que lo resuelve— pero el razonamiento que la sostenía estaba a medias.

4. **H3 no requería las dos mitades que propuse; requiere las dos, y lo digo ahora con la razón.** En la auditoría ofrecí dos arreglos como alternativos («cualquiera vale»). Al desarrollarlo no se sostiene: el alta atómica impide que el estado nazca, pero no lo hace imposible (una restauración parcial, un `DELETE` a mano sobre `private`, un replay a medias), y si nace, el resolvedor bajo RLS sigue diciendo `'pending'` para siempre porque sólo ve metadata. La lectura discriminante es la red que convierte ese estado en un fallo ruidoso. Van las dos, y por eso el puente tiene tres funciones y no dos.

---

## 12. Lo que sigue sin verificar, y lo que necesito que apruebes

**Sin verificar (todos con su mecanismo de fallo ruidoso, salvo donde se diga):**

- Que `postgres` pueda `SET ROLE service_role` y `SET ROLE authenticated` en el SQL Editor de Supabase **[J, alta]**. Si es falso, la migración aborta antes del `COMMIT` y no queda nada aplicado.
- Que PostgREST devuelva el SQLSTATE en `code` y el `MESSAGE` en `message` **[J, alta]**. Si es falso, P3/P4 salen en rojo y no se despliega — falla en la dirección segura.
- Que el event trigger de DDL de Supabase recargue la caché por su cuenta **[J, media]**. Irrelevante: el `NOTIFY` está puesto y el script lo comprueba de todos modos.
- Que el lock de `GRANT`/`REVOKE` sobre una tabla sea instantáneo aquí **[J, media-alta]**. Acotado por `lock_timeout = '5s'`.
- **Que la tabla temporal sobreviva al `COMMIT` hasta el `SELECT` final** **[J, media]**. Si el editor no conservara la sesión, la última sentencia falla con «relation pg_temp… does not exist»: visible y ruidoso, nunca un falso verde, y el remedio es reaplicar el archivo entero, que es idempotente. Es el **[J]** más flojo de este documento y por eso lo dejo dicho aquí y no enterrado.

**Decisiones que necesitan tu OK antes de escribir el `.sql`:**

- **D1 — Tres funciones en vez de dos**, con el alta de metadata + secretos en una sola llamada. Es lo que cierra H3 y lo que cambia la forma respecto de la propuesta que auditaste.
- **D2 — A3 y A4** (`'synced'` deja de ser optimista en el POST y el PUT de `appointments`). Están fuera de la lista original del brief y cambian comportamiento visible.
- **D3 — El `REVOKE ALL` + `GRANT SELECT` del §5** sobre una tabla que ya está en producción, por el `MAINTAIN` de H13. Es la pieza más prescindible del archivo.
- **D4 — No editar `20260817_gcal_conexion_clinica_a_esquema.sql`**, ni siquiera su comentario de cabecera falso (:38-39), por la regla forward-only. Los `COMMENT` de la base sí se corrigen. Si prefieres una nota apendicada al archivo aplicado, dilo: es una línea, pero es tocar un artefacto ya aplicado y no lo hago por mi cuenta.
