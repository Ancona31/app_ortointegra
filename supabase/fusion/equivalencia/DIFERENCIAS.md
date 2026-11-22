# E0 · Equivalencia de las 44 migraciones originales y las 6 fundidas

**Veredicto: ACEPTADO.** Hay 96 diferencias de estructura. Las 96 están explicadas, verificadas una
por una y son ACEPTABLES. No hay ninguna DUDOSA ni NO ACEPTABLE.

Marcas: **[E]** = comprobado ejecutando; **[D]** = deducido (leyendo código o catálogo, sin ejecutar).

## 1. Qué se comparó y cómo

| Base | Construcción | Contenedor / puerto |
|---|---|---|
| común | clon de `~/spinus-fusion/base-main` (`clonar-desde-foto.sh`) | — |
| **A** | común + las 44 originales del tag `fusion-originales` (`git archive`), en orden de nombre, `psql -v ON_ERROR_STOP=1` como `postgres` | `spinus-e0-a` 54391 |
| **B** | común + las 6 `supabase/migrations/20261201*.sql` en orden de nombre | `spinus-e0-b` 54392 |
| C / D | como A / B, pero sobre un clon con **datos previos inventados** (`datos-previos.sql`) | `spinus-e0-c/d` 54393/54394 |

Los contenedores se borraron al terminar. No se tocó el stack local compartido.

- **La foto base-main es lo que dice ser [E].** Sus `99-sha256.txt` cuadran. `04-migraciones.tsv`
  tiene exactamente las 5 de `main`, más `20261125170000` y `20261126120000`. El clon reproduce la
  foto con las 12 diferencias conocidas del viaje foto → clon (`esperadas-clon.tsv`).
- **Aplicación [E].** A: 44/44 sin ningún `ERROR`, con 303 filas OK y 17 INFO en las rejillas, y
  ningún REVISAR. B: 6/6 sin ningún `ERROR`, con 51 OK y 3 INFO. Las salidas completas están en
  `salidas/A-aplicar-44-originales.log` y `salidas/B-aplicar-6-fundidas.log`.
- **El orden histórico no cambia nada [E].** En la referencia, `20261125170000` y `20261126120000`
  corrieron después de casi toda la agenda. Aquí ya estaban en la base. Comparé A contra la foto
  `ref-originales` (construida en orden histórico) y salen **0 diferencias** aparte de las 12 del viaje
  foto → clon (`salidas/comparador-refOriginales-A.txt`). Hay dos razones:
  - Cada tabla nueva de la agenda revoca TRUNCATE de forma explícita, así que los `ALTER DEFAULT
    PRIVILEGES … REVOKE TRUNCATE` no cambian el resultado. En orden histórico, el barrido de
    `20261126120000` encontraba lo mismo.
  - Los disparadores `trg_<t>_sin_truncate` son para una lista fija de 11 tablas de `main`.

  No hizo falta construir una variante aparte.

## 2. Dos métodos independientes, mismo resultado

| Método | Diferencias A↔B |
|---|---|
| `comparar-estructura.sh` (catálogo) | **96**: 52 comentarios, 31 funciones, 10 permisos, 3 policies |
| `pg_dump --schema-only` de toda la base, partido por objeto y comparado por texto (`herramientas/dump_objetos.py`) | **90** objetos: los mismos. El comparador cuenta los permisos por rol (10 filas) y `pg_dump` por función (4 entradas ACL): 96 − 10 + 4 = 90 |
| `aclexplode` **con otorgante**, en tablas, columnas, funciones y default privileges de `public`, `respaldos`, `private`, `auth` y `storage` | tablas: 4050 = 4050, con el mismo md5. Columnas: 34 = 34. Default ACL: 345 = 345. Funciones: sólo los 7 EXECUTE retirados y los 3 nuevos (`salidas/acl-funciones-*.txt`) |

`pg_dump` cubre lo que el comparador declara que no cubre: operadores, casts, clases de operadores,
configuraciones de texto, FDW y estadísticas extendidas. Ahí no hay **ninguna** diferencia [E].

MAINTAIN y TRUNCATE salen en `aclexplode`. Cuentan lo mismo en A y B: 304 MAINTAIN y 0 TRUNCATE para
`anon`, `authenticated` y `service_role` en `public` [E].

Hay otras cosas idénticas en los dos métodos [E]:
- el orden de columnas de `appointments`: 45 columnas, md5 de `attnum:nombre:tipo` igual;
- la publicación `supabase_realtime`: sólo `public.appointments`;
- RLS activado y forzado;
- disparadores (incluidos los de evento), índices, restricciones, tipos, roles y configuración.

## 3. Las 96 diferencias

La lista exacta está en `DIFERENCIAS.tsv`. Es una fila por diferencia, sin globs, y la razón empieza
por el veredicto. Como `--esperadas` deja **96/96 esperadas, 0 inesperadas** y ninguna línea sobrante [E].

### 3.1 Funciones con el cuerpo cambiado (27): sólo cambia `md5_cuerpo`

En las 27 no cambia el dueño, SECURITY DEFINER, el search_path, la volatilidad ni la firma [E]. Así
se reparten:

- **9 sólo cambian comentarios.** Quité comentarios `--` y `/* */` respetando literales y `$tag$`, y
  colapsé espacios: el código es **idéntico** [E] (`salidas/cuerpos-funciones.txt`). Son:
  `agenda_restablecer_configuracion`, `cita_correo_tomar`, `log_cita_change`, `rate_limit_espera`,
  `reserva_codigo_verificar`, `reserva_contacto_estado`, `reserva_enlace_emitir` (9 arg.),
  `reserva_espera_reenvio` y `reservar_por_enlace`.
- **17 cambian SÓLO la lectura del interruptor**, `EXISTS/JOIN agenda_ajustes … agenda_v2_encendida`
  → `public.agenda_v2_encendida(x)`. El diff sin comentarios tiene esa única línea en cada una [E].
  Son: `cita_confirmacion_contexto/emitir/responder`, `cita_movimiento_google_registrar`,
  `cita_proteger_bloqueo/borrado/eleccion`, `cita_reagendar_clinica`, `cita_rsvp_google`,
  `gcal_aplicar_evento`, `gcal_bloqueo_aplicar`, `gcal_citas_por_evento`, `gcal_importar_evento`,
  `gcal_sync_tomar`, `reserva_codigo_emitir`, `reserva_empalmes_registrar` y `reserva_ocupacion`.

  La sustitución es equivalente en cada sitio por lo siguiente:
  - **Misma clínica.** El argumento es el mismo que la condición original: `p_clinica_id`,
    `NEW/OLD.clinica_id`, `v_c.clinica_id` o `e.clinica_id`.
  - **Sin fila = false.** `agenda_ajustes.clinica_id` es UNIQUE (`agenda_ajustes_clinica_key`) y
    `agenda_v2_encendida` es NOT NULL [E, catálogo]. Por eso `coalesce((SELECT …), false)` vale lo
    mismo que el EXISTS o el JOIN, y no puede dar «más de una fila».
  - **Sin `FOR UPDATE`.** Ningún fragmento sustituido lo tenía [E, diff].
  - **El modo de lectura no cambia.** Las 17 son INVOKER en A y en B, y `agenda_v2_encendida` es
    INVOKER. Lee con los mismos permisos y la misma RLS que el EXISTS original.
  - **EXECUTE por rol.** Revisé quién puede llegar a esa línea [E]:
    - Las 14 que no son disparadores sólo tienen EXECUTE para `service_role`, que tiene EXECUTE sobre
      `agenda_v2_encendida`.
    - Los 3 disparadores corren con `authenticated`, `service_role`, `postgres` o `supabase_admin`, y
      los cuatro tienen EXECUTE. `anon` tiene INSERT/UPDATE/DELETE sobre `appointments` pero no
      EXECUTE. Aun así no llega a la llamada:
      - en INSERT, `cita_proteger_bloqueo` lee antes `agenda_bloqueos` y falla con
        `permission denied for table agenda_bloqueos`, igual en A (paso 01);
      - en UPDATE y DELETE, la RLS no le deja ver ninguna fila (pasos 11 y 25).
    - `supabase_read_only_user` y `supabase_etl_admin` leen `agenda_ajustes` pero no tienen EXECUTE.
      Tampoco pueden escribir citas ni ejecutar ninguna de las 17, así que no llegan.
  - **Ejecutadas por rol en A y en B, con resultado idéntico** [E], en `comportamiento.sql`. Se
    ejecutaron todas salvo `gcal_aplicar_evento`, que necesita una conexión de Google (ésa queda
    [D], por el diff de una línea). Los pasos están en `DIFERENCIAS.tsv`.
- **1 HINT.** `gcal_sync_clinica_habilitada` sólo cambia el texto del HINT del P0001: nombra el archivo
  fundido en lugar de C1. El SQLSTATE y la lógica no cambian. Nadie lee ese texto [E, grep].

### 3.2 Funciones nuevas (1) y retiradas (3), con sus 10 permisos

- `agenda_v2_encendida(uuid)` es nueva. Es sql, STABLE, INVOKER y con `search_path=''`. Su EXECUTE es
  para postgres, authenticated y service_role, sin PUBLIC ni anon [E].
- `reserva_enlace_regenerar_fijo` tiene 0 llamadores en `src/`, `scripts/` y `e2e/` [E, grep]. En
  `supabase/pruebas-sql/` sólo aparece en `d1` y `seg_emision`, que esperan ahora
  `undefined_function`. En los cuerpos de función sólo se nombraba a sí misma [E].
- `reserva_enlace_emitir` de 7 argumentos. Sólo se llega a ella por la caída PGRST202 de
  `src/app/api/agenda/enlaces/route.ts:128-131`, que no puede darse mientras exista la de 9 [D].
  `e2e/seguridad-postgrest.e2e.ts:126` admite `42501` o `PGRST202`. Con B, PostgREST dará PGRST202:
  la de 9 no tiene DEFAULT y no casa con 7 parámetros [D, no se levantó PostgREST].
- `cita_correos_pendientes` sólo aparece en comentarios: `src/lib/confirmacion/recordatorios.ts:19` y
  el cuerpo de `cita_correo_tomar` [E].

### 3.3 Policies (3)

- `agenda_bloqueos_insert` y `agenda_bloqueos_update`: la misma sustitución, dentro de un WITH CHECK
  `TO authenticated`. Los pasos 14 a 18 dan lo mismo en A y en B [E].
- `reserva_enlaces_insert`, retirada. Hice dos pruebas [E]:
  - `INSERT` en `reserva_enlaces` como `anon`, como médico y secretaria de la clínica, como médico de
    otra clínica (en la ajena y en la suya) y como `service_role` (pasos 32 a 37). Da el **mismo
    SQLSTATE y el mismo mensaje** en A y en B. La sesión recibe `42501 «Los enlaces de reserva los
    emite el servidor»` del disparador, `anon` recibe `permission denied for table` y `service_role`
    inserta.
  - Con el disparador desactivado (`policy-sin-disparador.sql`), en A la RLS deja pasar al
    administrador de su clínica, que después cae en un CHECK. En B la RLS lo niega con `42501`.
    **B es más estricta.**

### 3.4 Comentarios (52)

Antes y después hay 5448 filas en `pg_description` [E]. Cambian 50, desaparece 1 (la de 7 argumentos)
y aparece 1 (`agenda_v2_encendida`). El diff por palabras está en `salidas/comentarios-palabras.txt`.

Casi todos sólo pierden etiquetas de tanda («D1», «j2», «tanda I, punto 10»…). Seis cambian
contenido, y comprobé que el texto nuevo es cierto:
- `agenda_bloqueos`: el bloqueo total. Ejecutado, pasos 19 a 22.
- `reserva_tel_hmac`: «candado» → «bloqueo manual», la regla vigente de CLAUDE.md.
- `reserva_reagendados`: «única reserva_* con DEFAULT». Cierto en el catálogo.
- `cita_recordatorios_pendientes`: enumera sus tres puertas. Cierto en el cuerpo.
- `proteger_reserva_enlaces`: el md5 de `prosrc` sigue siendo `acd4128b`.
- `cita_correos`: ya no nombra a la función retirada.

El prefijo «false = la disponibilidad» de `consultorios.horario_propio`, que exige
`b5_horario_propio.sql`, se conserva, y la prueba pasa en B [E].

## 4. Comportamiento, no sólo estructura

- **Pruebas SQL [E]** (`salidas/pruebas-sql.tsv`):
  - A, con las pruebas del tag: 45 de 46 pasan.
  - B, con las actuales: 45 de 46 pasan.
  - La que falla en los dos lados es `m_saludo_recordatorio`, porque necesita la semilla. Con
    `semilla-minima.sql` pasa en A y en B, y es el mismo archivo en los dos. Total: **46/46 en cada
    lado.**
  - El commit `791ee3a3` cambió 5 pruebas: `d1`, `e4`, `j2`, `k3` y `seg_emision`. Las originales
    fallan en B, y sólo porque llaman a lo retirado (`does not exist`). Las nuevas fallan en A en 3
    casos, porque comprueban que lo retirado ya no existe. Ninguna pierde un caso de seguridad: donde
    se esperaba `insufficient_privilege` ahora se espera `undefined_function`.
- **Mismo guion en A y en B** [E]. `comportamiento.sql` tiene 89 pasos:
  - con `anon`, `authenticated` (médico, secretaria, otra clínica) y `service_role`;
  - con la v2 encendida y apagada;
  - cubre alta, edición, mover, confirmar, columnas `reserva_*`, bloqueos, alta y movimiento dentro de
    un bloqueo, borrar, cancelar, cerrar y reabrir;
  - los enlaces, con INSERT directo y por RPC, y `reservar_por_enlace` (único, fijo sin código, código
    y verificación, ocupado, dentro de un bloqueo);
  - el candado de elección, reagendar, la confirmación, el correo, recordatorios, las `gcal_*` y
    restablecer.

  Comparé resultado, SQLSTATE, mensaje, HINT y filas nuevas de `audit_log`: la salida es **idéntica
  byte a byte** (`diff` vacío; `salidas/comportamiento-*.out`). Todo va en una transacción con
  ROLLBACK, y `audit_log` no se tocó.
- **Datos previos [E].** C y D se sembraron con clínicas, consultorios con y sin horario, citas
  pasadas, futuras, de Google y canceladas. Después de las migraciones, consultorios, clínicas, citas,
  `respaldos.consultorios_horario_20261119` y las 7 filas de `audit_log` del backfill son
  **idénticos** (`salidas/datos-C.txt` = `datos-D.txt`). El comparador entre C y D da las mismas 96
  diferencias.

## 5. Lo que la fusión pudo perder sin que se note

En las 44 originales hay, a nivel superior, 106 COMMENT, 16 RLS, 4 sentencias de datos y 21 DO que
contienen palabras de escritura o de DDL; los demás DO sólo leen (`herramientas/sentencias.py`;
`salidas/sentencias-no-ddl-*.tsv`). No hay ningún `NOTIFY`, `ALTER PUBLICATION`,
`ALTER DEFAULT PRIVILEGES`, `OWNER TO`, `CREATE EXTENSION` ni GRANT sobre esquemas o secuencias, ni
dentro de los DO [E, grep].

- **COMMENT y RLS.** Su efecto sale en el catálogo y queda cubierto por §2 y §3.4 [E].
- **Datos:**
  - El backfill de G4 (respaldo + UPDATE de consultorios) está en F1, en las líneas 608 y 615, con el
    mismo texto, y da los mismos datos (§4) [E].
  - Los dos INSERT de arrastre de `avisos_clinica` de i5 se retiraron. Leen `reserva_empalmes_google`
    y `cita_confirmaciones`, que crea esta misma tanda de migraciones, así que en un despliegue están
    vacías: el arrastre inserta 0 filas siempre [D; en A y C insertó 0, E].
- **DO.** Son pre-vuelos y post-vuelos, o `ADD CONSTRAINT` condicionales cuyo efecto está en el
  catálogo. Ninguno escribe datos fuera del backfill. Busqué en el cuerpo de cada DO toda sentencia
  que empiece por UPDATE, INSERT, DELETE, ALTER, GRANT, REVOKE, COMMENT, NOTIFY, CREATE o DROP. Sólo
  salen `THEN ALTER TABLE … ADD CONSTRAINT` y un texto de RAISE. Las sentencias de datos que encuentra
  el grep de archivos están dentro de cuerpos de función [E].
- **Defaults.** Ninguna original cambia un DEFAULT después de crear la columna (no hay
  `ALTER COLUMN … SET/DROP DEFAULT`). Por eso crear la columna ya con su DEFAULT final da los mismos
  valores en las filas existentes [E en C/D].
- **Disparadores del backfill.** Los de `consultorios` son los 6 de `main`, iguales en los dos órdenes.

## 6. Lo que no cubre ninguno de los dos métodos, y lo que no comprobé

- **Historial de migraciones.** En A, B, C y D sólo están las 7 de la base: apliqué con psql, no con
  la CLI. En producción las versiones registradas serán las `20261201*`, no las 44. Es una decisión
  de despliegue, no de estructura.
- **No ejecutadas:**
  - `gcal_aplicar_evento`, porque exige una conexión de Google [D];
  - `scripts/reserva-carrera.sh` (la carrera de dos sesiones) y las e2e;
  - el comportamiento a través de PostgREST (PGRST202 frente a 42501 de la de 7 argumentos) [D].
- **Lo que no ve el catálogo:** estadísticas, planes y rendimiento. Pasar el JOIN de
  `reserva_ocupacion` al WHERE con una función STABLE sin inlining (por el `SET search_path`) cambia
  el plan, pero sobre una sola fila.
- **Sobre `CONJUNTO.tsv`:** 18 entradas usan el glob `(*`, más ancho de lo necesario. Verifiqué que
  cada una cubre una sola función y que dentro sólo hay lo declarado. `DIFERENCIAS.tsv` usa claves
  exactas.

## Archivos

- `DIFERENCIAS.tsv`: las 96 diferencias con la razón y el veredicto.
- `comportamiento.sql`, `datos-previos.sql`, `datos-extraer.sql`, `policy-sin-disparador.sql` y
  `semilla-minima.sql`: guiones de prueba con datos inventados.
- `herramientas/`: `aplicar.sh`, `pruebas.sh`, `volcar.sh`, `dump_objetos.py`, `cuerpos.py`,
  `comentarios.py`, `sentencias.py` y `hacer_tsv.py`.
- `salidas/`: registros completos de aplicación (rejillas incluidas), comparaciones, cuerpos,
  pruebas, comportamiento y datos.
