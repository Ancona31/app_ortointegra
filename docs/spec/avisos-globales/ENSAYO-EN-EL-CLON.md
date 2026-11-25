# Avisos globales — SEGUNDO ensayo de M1 y M2 en el clon de producción

Para quien corra el ensayo en el equipo de Angel. Autocontenido: no hace falta leer nada más.
Rama `feature/avisos-globales`. Nada de aquí toca producción; el guion se corre en MODO ENSAYO.

- **M1** `supabase/migrations/20261202120000_avisos_globales_modelo.sql` (riesgo medio)
- **M2** `supabase/migrations/20261202130000_avisos_globales_rsvp_rechazo.sql` (riesgo bajo; exige M1)

> **Esta es la versión corregida tras la primera auditoría («apta con reservas», 2026-11-24).**
> M1, su reversa y `aplicar.sh` CAMBIARON: sus huellas son otras y el primer ensayo ya no vale como
> referencia. M2, su reversa y `reversa-previa.sql` NO cambiaron. Qué se corrigió, hallazgo por
> hallazgo: §7.

## 0. Huellas (antes de nada)

```bash
sha256sum supabase/produccion/plan/aplicar.sh
# 4bbbb971efe5a3565d382fd63c8c4bb1e4f71e4b3f6ac00165523005f6e13864
sha256sum -c supabase/produccion/plan/huellas.sha256      # 23 líneas, todas OK
```

| Archivo | sha256 |
|---|---|
| `supabase/migrations/20261202120000_avisos_globales_modelo.sql` | `91324698dacef79883c84722b3d0928c7ecd37db256af5d3614783ca2cd804a7` |
| `supabase/migrations/20261202130000_avisos_globales_rsvp_rechazo.sql` | `54744f3bc3ab2828e258ab9198719316d1b73ab4039934b93e55690297a2fd5f` |
| `supabase/reversas/20261202120000_avisos_globales_modelo_reversa.sql` | `a18ff0e6ecf9114f25985332307857df2075b7383d8ac19f5cbe2fd7c82c92c3` |
| `supabase/reversas/20261202130000_avisos_globales_rsvp_rechazo_reversa.sql` | `ae4a2745b0d31475f09ad644c07861e214035435214468fd5908833242aca7fa` |
| `supabase/produccion/plan/reversa-previa.sql` | `e6ad24b48e4251ea13bc69acde394f76ee4956ba80f2d905b3314ab8d7ca2c94` |
| `supabase/produccion/plan/huellas.sha256` | `4f688553ea58fff899fd56edf2edeeb0138a16a50c726551db0f2e25605f80b1` |

Si una huella no coincide, alto: el archivo no es el que se ensayó en local.

## 1. Qué hay en el guion `aplicar.sh` (ya hecho en esta rama)

- `MIGRACIONES`: las 9 de antes + `20261202120000_avisos_globales_modelo` y
  `20261202130000_avisos_globales_rsvp_rechazo`, al final. Las que ya están en el historial y
  aplicadas se saltan solas; `aplicar` sólo ofrecerá estas dos.
- `REVERSAS`, en este orden: **M2, M1**, T, F5b, F4, F2, F3, F5a, F1. M2 antes que M1 (M2 exige M1)
  y M1 antes que T y F4 (la de F4 borra `avisos_clinica`, de la que cuelgan los escritores de M1).
- Objeto testigo (existe si y sólo si la migración está aplicada):
  - M1: función `public.aviso_clinica_registrar(uuid, text, uuid, uuid, uuid, text)`
  - M2: función `public.cita_rsvp_google_rechazo(uuid, uuid, text, text, text[])`
- `reversa-previa.sql`: dos filas `DATOS` para M1 (marcas en `avisos_vistos`; avisos con la forma de
  M1). Con ellas, `reversa` pregunta por adelantado, como con las demás.
- **Nuevo en esta versión:** (a) la cabecera dice «las 9 … y las 2» (decía «las 11 … y las 2»);
  (b) el defecto de la imagen: sin el contenedor local `supabase_db_app_ortointegra`, `docker
  inspect` deja una línea vacía y la imagen quedaba con un salto de línea delante («docker: invalid
  reference format»). Arreglado igual (`| grep .`) en `aplicar.sh`, `clonar-desde-foto.sh`,
  `correr-conteos.sh`, `foto-produccion.sh` y `comparar-estructura.sh`; nada más cambió en esos
  guiones. Probados los cinco con el stack local apagado (§6).

## 2. Conteos de sólo lectura (en PRODUCCIÓN, antes de aplicar; los corre Angel)

Ya no hay que pegarlos a mano: están en el repo, con el patrón de `correr-conteos.sh`.

```bash
bash supabase/produccion/conteos/correr-conteos-avisos.sh
```

Corre `supabase/produccion/conteos/conteos-avisos-globales.sql` (`BEGIN TRANSACTION READ ONLY` …
`ROLLBACK`; ningún dato de personas) y guarda `conteos-avisos-<fecha>.txt`. Esperado: **0 ALTO, 0
AVISO** (20 filas: 16 OK y 4 INFO). Los tres conteos del primer guion son las filas **A.4** (avisos
que el pre-vuelo de M1 rechazaría: 0), **A.5** (las dos policies de F4) y **A.6 + B.1** (nada de M1
ni de M2 existe). Qué hacer con cada fila: `supabase/produccion/conteos/LEEME.md`, «Avisos globales
(M1 y M2)».

OJO: `correr-conteos.sh` / `conteos.sql` (los de las 9) NO sirven para esto: contra la base de hoy
dan ALTO en casi todo. Contra el clon, las mismas variables de siempre:
`CONTEOS_HOST=127.0.0.1 CONTEOS_PUERTO=54373 CONTEOS_USUARIO=postgres CONTEOS_SSL=disable CONTEOS_RED=host`.

## 3. El ensayo (clon de la foto del 24-nov, en local)

Con el clon levantado desde `~/spinus-produccion-foto-20261124` (`clonar-desde-foto.sh`; aquí en el
puerto 54373) y Docker encendido, desde la raíz del repo. Los registros van FUERA de la carpeta de
la foto:

```bash
export APL_HOST=127.0.0.1 APL_PUERTO=54373 APL_USUARIO=postgres APL_SSL=disable APL_RED=host \
       APL_DESTINO="$HOME/spinus-produccion-ensayo/avisos-$(date +%Y%m%d)"
bash supabase/produccion/plan/aplicar.sh estado     # M1 y M2 «pendiente»; las 9 «aplicada y registrada»
bash supabase/produccion/plan/aplicar.sh aplicar    # escribir 20261202120000 y luego 20261202130000
bash supabase/produccion/plan/aplicar.sh reversa    # REVERTIR 20261202130000, REVERTIR 20261202120000 y PARAR en la de T
bash supabase/produccion/plan/aplicar.sh aplicar    # otra vez las dos
bash supabase/produccion/plan/aplicar.sh aplicar    # segunda pasada: no ofrece nada, «Las 11 aplicadas y registradas»
```

En `reversa`, tras las dos primeras, contestar cualquier otra cosa a la de `20261201180000`: el guion
dice «parado antes de la reversa de 20261201180000_agenda_sin_truncate» y no toca nada más. Con un
clon sin datos, la comprobación previa dice «ninguna reversa de la cadena se va a negar».

### 3-bis. El ciclo nuevo: reversa CON datos y vuelta (hallazgo 1)

Con M1 y M2 aplicadas en el clon, se siembra UN aviso de forma nueva y UNA marca de visto (el clon no
tiene datos: hace falta una clínica, un médico, una secretaria, un consultorio y un paciente; valen
los de `supabase/pruebas-sql/av1_avisos_globales.sql`, pero con COMMIT), se apaga la v2 y:

```bash
bash supabase/produccion/plan/aplicar.sh reversa   # dice qué se perdería; escribir PERDER DATOS, REVERTIR …130000, REVERTIR …120000, y parar en T
bash supabase/produccion/plan/aplicar.sh estado    # M1 y M2 «pendiente»; ningún ALTO
bash supabase/produccion/conteos/correr-conteos-avisos.sh   # 0 ALTO; A.6 = «0 / 0 / 4 / false»; A.6b = «la de M1, conservada por su reversa»
bash supabase/produccion/plan/aplicar.sh aplicar   # las dos otra vez; fila 11 de M1 = «la de M1, conservada por su reversa»
```

Lo esperado, y lo que salió en local: la reversa de M1 imprime `WARNING: REVERSA CON DATOS … se
borran 1 marca(s) de avisos_vistos; 1 aviso(s) con la forma de M1 se CONSERVAN …` y su fila 5 dice
`la de M1, CONSERVADA con confirmación: 1 aviso(s) la usan` (INFO, no REVISAR). El aviso sigue en la
tabla (no se borra nada). La ida imprime `NOTICE: M1: avisos_clinica ya tiene la forma de M1 … se
completa lo que falta.` y termina igual que una ida limpia: mismas 13 filas, y el `pg_dump -s` de
`public` idéntico al de una ida desde F4 (0 diferencias). Lo único que no vuelve son las marcas de
visto. Sin la confirmación (`PERDER DATOS`), el guion se para antes de la primera reversa y no toca
nada.

Luego, las pruebas (crean sus datos y terminan en rollback):

```bash
for p in av1_avisos_globales av2_rsvp_rechazo av3_avisos_no_impiden av4_policies_como_f4; do
  docker exec -i <contenedor del clon> psql -U postgres -v ON_ERROR_STOP=1 -q -o /dev/null -f - < supabase/pruebas-sql/$p.sql
done
```

Dejan estas líneas de WARNING **a propósito** (prueban que un aviso que falla no impide nada);
cualquier `ERROR` es un fallo:

- `av1`: `aviso_clinica_de_cambio_cita: aviso personal_agendo no escrito (SQLSTATE 23514)`
- `av2` y `av4`: ninguna.
- `av3`: `aviso_clinica_reabrir: aviso reserva_enlace no refrescado (SQLSTATE P0001)`, lo mismo con
  `confirmacion_paciente` y con `cancelacion_paciente`, `aviso_clinica_de_cambio_cita: aviso (sin
  decidir) no escrito (SQLSTATE 22P02)` y `aviso_clinica_de_bloqueo: aviso no escrito (SQLSTATE 22P02)`.

Mediciones (a mano, no son pruebas; terminan en rollback):

```bash
docker exec -i <clon> psql -U postgres -q -v n=1200  -f - < supabase/pruebas-sql/medicion/av1_campana.sql
docker exec -i <clon> psql -U postgres -q -v n=21000 -f - < supabase/pruebas-sql/medicion/av1_campana.sql
```

## 4. Rejillas esperadas, fila por fila

**M1** (13 filas; 11 OK y 2 INFO):

| n | comprobación | valor esperado |
|---|---|---|
| 1 | columnas nuevas de avisos_clinica | `actor_id,datos,destinatario_id,medico_id` |
| 2 | tipos que admite avisos_clinica_tipo_check | `19` |
| 3 | policies de avisos_clinica | `avisos_clinica_select:SELECT,avisos_clinica_update:UPDATE` |
| 4 | disparadores aviso nuevos, habilitados | `7` |
| 5 | funciones aviso_clinica_* DEFINER con search_path vacío | `12` |
| 6 | quién ejecuta aviso_clinica_registrar (anon/authenticated/service_role) | `false/false/true` |
| 7 | avisos_vistos: policies | `avisos_vistos_insert:INSERT,avisos_vistos_select:SELECT,avisos_vistos_update:UPDATE` |
| 8 | reabrir, sellar y sin_truncate, habilitados | `3` |
| 9 | avisos_clinica en la publicación supabase_realtime (esta migración no la añade) | `0` |
| 10 | filas de avisos_clinica (INFO) | las que hubiera; no cambian |
| 11 | forma de avisos_clinica de la que partió (INFO) | `la de F4` (o `la de M1, conservada por su reversa` en el ciclo 3-bis) |
| 12 | avisos_pendientes acotada (ventana de 60 días y tope de 500) | `true` |
| 13 | quién ejecuta avisos_mas_antiguos (anon/authenticated/service_role) | `false/true/false` |

Antes de la rejilla, una ida desde la forma de F4 imprime cuatro `NOTICE … does not exist, skipping`
(la tabla temporal del pre-vuelo, dos CHECK y el índice): son los `IF EXISTS` que la hacen
re-aplicable desde la forma conservada. Normales.

**M2** (3 filas, todas OK): `1 · INVOKER y search_path vacío = true` · `2 · quién la ejecuta =
false/false/true` · `3 · cita_rsvp_google (el «Sí») sigue = true`.

**Reversa de M2** (1 fila): `cita_rsvp_google_rechazo quitada = true`.

**Reversa de M1** (5 filas, todas OK sin datos): `1 · disparadores de M1 que quedan = 0` · `2 · funciones
de M1 que quedan = 0` · `3 · escritores de F4, intactos = 7` · `4 · tabla avisos_vistos = false` ·
`5 · forma de avisos_clinica = la de F4`. Con datos y confirmación, la 5 es INFO: `la de M1,
CONSERVADA con confirmación: N aviso(s) la usan`.

Una segunda ida de M1 con M1 aplicada, o de M2, hecha a mano (sin el guion) ABORTA en su pre-vuelo:
«esta migración ya está aplicada». Es lo esperado.

## 5. Diff de estructura esperado (antes ↔ después de M1 y M2)

El diff completo de mi base local está en `docs/spec/avisos-globales/estructura-antes-despues.local.diff`
(`pg_dump -s -n public --no-comments`, 790 líneas). En el clon debe salir lo mismo, y NADA más:

- **Tabla nueva** `public.avisos_vistos` (`aviso_id`, `usuario_id`, `clinica_id`, `visto_en`), con su
  llave primaria `(aviso_id, usuario_id)`, FK RESTRICT a `clinicas`, 2 índices, RLS, 3 policies y
  privilegios sólo para `authenticated` (SELECT; INSERT de tres columnas; UPDATE de `visto_en`).
- **`public.avisos_clinica`**: 4 columnas nuevas (`destinatario_id`, `actor_id`, `medico_id`, `datos`);
  `cita_id` pasa a admitir NULL; `avisos_clinica_tipo_check` de 7 a 19 tipos; 2 CHECK nuevos
  (`avisos_clinica_cita_tipo_check`, `avisos_clinica_datos_check`); índice único nuevo
  `avisos_clinica_sin_cita_key`; las 2 policies, con la condición nueva **y con `OFFSET 0` dentro de
  su `EXISTS`** (nuevo en esta versión). Sus privilegios no cambian. **Ningún índice nuevo más:** la
  lectura acotada usa `avisos_clinica_pendientes_idx`, que ya era de F4.
- **11 funciones nuevas**: `aviso_clinica_de_cambio_cita`, `_de_bloqueo`, `_de_correo`,
  `_de_conexion_google`, `_de_sync_google` (disparador, DEFINER); `aviso_clinica_registrar` (DEFINER,
  sólo `service_role`); `aviso_clinica_reabrir` y `aviso_visto_sellar` (disparador, INVOKER);
  `avisos_pendientes` y `avisos_mas_antiguos` (INVOKER, sólo `authenticated`; la segunda es nueva en
  esta versión); `cita_rsvp_google_rechazo` (INVOKER, sólo `service_role`).
- **10 disparadores nuevos**: en `appointments` (`trg_appointments_aviso_alta_personal`,
  `trg_appointments_aviso_cambio`), `agenda_bloqueos` (2), `cita_correos` (1),
  `clinica_conexiones_google` (1), `gcal_sync_estado` (1), `avisos_clinica` (`trg_avisos_clinica_reabrir`)
  y `avisos_vistos` (`trg_avisos_vistos_sellar`, `trg_avisos_vistos_sin_truncate`). **Cambio respecto
  al primer ensayo:** los `WHEN` de los dos de `appointments` ya no nombran `auth.uid()`
  (`WHEN (new.medico_id IS NOT NULL)` y sólo la comparación de estado y horas) y los dos de
  `agenda_bloqueos` no llevan `WHEN`.
- **Lo que NO debe aparecer en el diff:** ninguna otra tabla, ninguna policy de otra tabla, ningún
  cambio en `reservar_por_enlace`, `cita_rsvp_google`, `log_cita_change` ni en los seis
  `aviso_clinica_de_*` de F4, ninguna publicación (Realtime no se toca) y ningún privilegio nuevo
  para `anon`.

Tras la reversa de las dos (sin datos), el diff contra «antes» debe quedar VACÍO (en local: 0
diferencias, dos veces).

## 6. Lo que se comprobó en local y lo que no

Comprobado en el stack local de Supabase (CLI 2.117.0), sobre esta versión:

- las 16 migraciones desde cero con `supabase db reset --local`;
- con `aplicar.sh` en modo ensayo (`APL_PUERTO=54322`): `estado`, `reversa` de M2 y M1, `aplicar`,
  segunda pasada, `reversa` otra vez (estructura = «antes», 0 diferencias) y `aplicar`;
- el ciclo 3-bis entero (se niega sin confirmar; con ella conserva la forma; conteos; ida desde la
  forma conservada; estructura final idéntica a la de una ida limpia; pruebas `av*` en verde después);
- **con el stack local APAGADO** (sin el contenedor `supabase_db_app_ortointegra`; sólo queda su
  volumen, que es justo cuando `docker inspect` devuelve la línea vacía) y la base en un contenedor
  suelto en el 54373: `aplicar.sh` (`estado`, `aplicar`, `reversa`, `aplicar`), `correr-conteos.sh`,
  `correr-conteos-avisos.sh`, `foto-produccion.sh`, `clonar-desde-foto.sh` y `comparar-estructura.sh`
  (`--extraer` con `contenedor:` y con `url:`). Ninguno dio «invalid reference format»;
- batería SQL: 52 archivos en verde;
- dos sesiones a la vez sobre el aviso de una misma cita: la segunda tarda 0,09 s (antes, 3 s hasta
  el `lock_timeout`);
- las mediciones de §8.

NO comprobado: nada sobre el clon de la foto de producción del 24-nov (por eso existe este guion); el
tiempo de los candados con el RTT real; y la segunda auditoría independiente.

## 7. Qué se corrigió tras la primera auditoría

| Hallazgo | Qué se hizo | Dónde |
|---|---|---|
| 1 · reversa con datos sin camino de vuelta | La ida de M1 reconoce la «forma conservada» (las 4 columnas con su tipo y nada más de M1) y completa lo que falta; su sección 2 da el mismo resultado desde F4 y desde la conservada. Cualquier otro estado a medias aborta. Sin DELETE | M1, pre-vuelo y sección 2; reversa, cabecera |
| 2 · la lectura crece sin tope | `avisos_pendientes`: ventana de 60 días, tope de 500 y búsquedas por llave (`OFFSET 0` en el `EXISTS` de las dos policies; subconsulta escalar para la marca). Sin índice nuevo, sin purga, sin tarea programada. Lo que queda fuera SE DICE: `avisos_mas_antiguos` y la nota «Hay avisos más antiguos que ya no se muestran aquí.» en las dos campanas, con «+» en el contador. `av4` prueba que las policies con `OFFSET 0` dan las mismas filas que las de F4 a cinco perfiles | M1; `av1` casos 18 y 19; `av4`; e2e `avisos-globales` |
| 4 · orden de candados | Todos al principio y en el orden de los escritores: tablas de origen → `avisos_clinica` (→ `avisos_vistos` en la reversa) | M1, pre-vuelo; reversa |
| 5 · reabrir dentro de los escritores de F4 | Subbloque con `EXCEPTION` + `WARNING`; si ya hay aviso, refresca con `SKIP LOCKED` y se salta el alta (no espera) | M1; prueba `av3` |
| 6 · lo que quedaba fuera de la protección | `auth.uid()` y `agenda_v2_encendida()` dentro del subbloque en las cinco funciones; los `WHEN` sólo comparan columnas (lo exige el post-vuelo). Documentado lo que no se puede atrapar | M1; prueba `av3`, caso 5 |
| 9 · «médico» = cualquier perfil | `aviso_clinica_registrar` exige `role = 'medico'` | M1; `av1`, caso 17 |
| 7 · conteos | `conteos-avisos-globales.sql` + `correr-conteos-avisos.sh` | §2 |
| 8 · textos y guiones | Cabecera de `aplicar.sh`, este guion, `COMPROBACION-POSTERIOR.md`, `esperadas-clon.tsv`, `DERIVA.md`, y el defecto de la imagen en los cinco guiones | §1 |

## 8. Mediciones en local (máquina de desarrollo; tiempo de base, no de petición)

**Lectura de la campana** (`avisos_pendientes`, 19 tipos, límite 50; mediana de 15, en ms;
`supabase/pruebas-sql/medicion/av1_campana.sql`). Una clínica con N citas y N avisos sin cerrar. El
rango es entre dos repartos: los avisos repartidos en 2 años y TODOS dentro de los últimos 60 días
(el peor caso). «Sin acotar» = la función que auditasteis (`-v vieja=1`), sobre la policy ya corregida.

| Quién | 1 200, sin acotar | 1 200, ahora | 21 000, sin acotar | 21 000, ahora |
|---|---|---|---|---|
| administrador, nada visto | 1,5–1,6 | 1,6 | 1,7–1,8 | 1,7–1,8 |
| administrador, TODO visto | 23–25 | 2,5–10,5 | 408–417 | 10,0–10,2 |
| médico invitado, nada visto | 2,8–3,0 | 2,7–2,9 | 2,7–3,0 | 2,8 |
| médico invitado, TODO visto | 25–26 | 2,9–21,8 | 438–441 | 20,9–21,9 |

Con 21 000 cuesta lo mismo que con 1 200: lo que manda es el tope de 500, no cuántos avisos hay.
«TODO visto» es el peor caso: recorre los 500 del tope (el invitado, hasta 1 000, porque la RLS le
oculta la mitad) sin devolver ninguno; 1 200 avisos repartidos en 2 años dejan sólo ~100 en la
ventana, por eso ahí baja a 2,5–2,9.

Aparte, y ANTES de corregir la policy: con el `EXISTS` de `avisos_clinica_select` sin `OFFSET 0`,
Postgres leía de una vez todas las citas de la clínica en CADA lectura, también con nada visto:
100–145 ms con 21 000 citas (7–12 ms con 1 200), de los que ~90 ms eran ese recorrido (`EXPLAIN
ANALYZE`: `hashed SubPlan`, `Index Scan … appointments rows=21000`). Eso ya no ocurre.

Límite que queda, dicho claro: a un médico invitado de una clínica grande la RLS le oculta los avisos
de las citas ajenas, y para juntar SUS 500 la lectura puede recorrer todos los avisos de la clínica
de los últimos 60 días (nunca más que eso).

**Disparador en `appointments`** (300 operaciones, 3 corridas, ms por operación, con la sesión de la
persona; `av1_tiempos.sql`):

| | alta | mover | cancelar |
|---|---|---|---|
| médico en su agenda (no escribe aviso) | 1,03–1,28 | 1,22–1,56 | 1,18–1,48 |
| secretaria en la agenda de otro (escribe aviso) | 1,52–1,83 | 1,75–2,21 | 1,64–2,51 |

En la versión anterior: médico 1,13–1,43 / 1,22–1,24 / 1,16–1,18; secretaria 1,55–1,77 / 1,91–1,94 /
1,87–1,92. Con los `WHEN` sin `auth.uid()`, el alta y el cambio del médico en su agenda ahora SÍ
llaman a la función (que no escribe nada): cuesta lo que el ruido entre corridas (décimas de
milisegundo como mucho).
