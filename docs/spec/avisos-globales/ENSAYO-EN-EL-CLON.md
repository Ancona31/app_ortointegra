# Avisos globales — TERCER ensayo de M1 y M2 en el clon de producción

Para quien corra el ensayo en el equipo de Angel. Autocontenido: no hace falta leer nada más.
Rama `feature/avisos-globales`. Nada de aquí toca producción; el guion se corre en MODO ENSAYO.

- **M1** `supabase/migrations/20261202120000_avisos_globales_modelo.sql` (riesgo medio) — versión 3
- **M2** `supabase/migrations/20261202130000_avisos_globales_rsvp_rechazo.sql` (riesgo bajo; exige M1) — sin cambios

> **Versión 3, tras la segunda auditoría («apta con reservas», sobre `7cac5d49`).** Cambiaron M1, su
> reversa, `reversa-previa.sql` y `huellas.sha256`; también la ESTRUCTURA que deja M1 (una tabla, dos
> índices, cinco funciones y un disparador más), así que los números del segundo ensayo (99
> diferencias antes ↔ después) ya no valen y los fija éste. NO cambiaron M2, su reversa ni
> `aplicar.sh`. Qué se corrigió, punto por punto (A–F): §7.

## 0. Huellas (antes de nada)

```bash
sha256sum supabase/produccion/plan/aplicar.sh
# 4bbbb971efe5a3565d382fd63c8c4bb1e4f71e4b3f6ac00165523005f6e13864
sha256sum -c supabase/produccion/plan/huellas.sha256      # 23 líneas, todas OK
```

| Archivo | sha256 |
|---|---|
| `supabase/migrations/20261202120000_avisos_globales_modelo.sql` | `2cc0bf64327e0319604cb4468d6d70f947906c537ae32b6d9caa65b3439f14c0` |
| `supabase/migrations/20261202130000_avisos_globales_rsvp_rechazo.sql` | `54744f3bc3ab2828e258ab9198719316d1b73ab4039934b93e55690297a2fd5f` |
| `supabase/reversas/20261202120000_avisos_globales_modelo_reversa.sql` | `59699b30bf4cd70ffdcf328b80500b7fbda45d7a02eb35ae8a42c4129d1a8e45` |
| `supabase/reversas/20261202130000_avisos_globales_rsvp_rechazo_reversa.sql` | `ae4a2745b0d31475f09ad644c07861e214035435214468fd5908833242aca7fa` |
| `supabase/produccion/plan/reversa-previa.sql` | `d2b3c37525138bd5252ef7cf46eb244db4cd0c14afbc8044f17aa26e9fc7d545` |
| `supabase/produccion/plan/huellas.sha256` | `2c9b8b8b4d0cfe37e87af612250614397b5924dd707937380ff96db04e898bae` |

Si una huella no coincide, alto: el archivo no es el que se ensayó en local.

## 1. Qué hay en el guion `aplicar.sh` (no cambió en esta versión)

- `MIGRACIONES`: las 9 de antes + `20261202120000_avisos_globales_modelo` y
  `20261202130000_avisos_globales_rsvp_rechazo`, al final. Las que ya están en el historial y
  aplicadas se saltan solas; `aplicar` sólo ofrecerá estas dos.
- `REVERSAS`, en este orden: **M2, M1**, T, F5b, F4, F2, F3, F5a, F1.
- Objeto testigo: M1, la función `public.aviso_clinica_registrar(uuid, text, uuid, uuid, uuid, text)`;
  M2, `public.cita_rsvp_google_rechazo(uuid, uuid, text, text, text[])`.
- `reversa-previa.sql`: TRES filas `DATOS` para M1 (marcas en `avisos_vistos`; «Marcar todos» en
  `avisos_vistos_hasta`, nueva; avisos con la forma de M1). La de la forma de M1 ya no cuenta
  `medico_id` en un aviso CON cita (ahora es una copia del médico de la cita: se recalcula).
- El defecto de la imagen («invalid reference format» sin el contenedor local) sigue arreglado en
  los cinco guiones.

## 2. Conteos de sólo lectura (en PRODUCCIÓN, antes de aplicar; los corre Angel)

```bash
bash supabase/produccion/conteos/correr-conteos-avisos.sh
```

Corre `supabase/produccion/conteos/conteos-avisos-globales.sql` (`BEGIN TRANSACTION READ ONLY` …
`ROLLBACK`; ningún dato de personas). **Guarda por omisión en una carpeta propia,
`~/spinus-produccion-conteos-avisos/`** (antes, en la de la foto vieja); `CONTEOS_DESTINO` manda.
Esperado: **0 ALTO, 0 AVISO** (20 filas: 16 OK y 4 INFO). Los tres conteos del primer guion son las
filas **A.4**, **A.5** y **A.6 + B.1**; A.6 cuenta ahora también la tabla `avisos_vistos_hasta`. Qué
hacer con cada fila: `supabase/produccion/conteos/LEEME.md`, «Avisos globales (M1 y M2)».
`correr-conteos.sh` / `conteos.sql` (los de las 9) NO sirven para esto. Contra el clon:
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

En `reversa`, tras las dos primeras, contestar cualquier otra cosa a la de `20261201180000`. Con un
clon SIN datos, la comprobación previa dice «ninguna reversa de la cadena se va a negar». (Si el clon
tiene datos, pregunta «PERDER DATOS» antes de la primera: contestar otra cosa la para sin tocar nada.)

### 3-bis. El ciclo con datos: reversa CON confirmación y vuelta

Con M1 y M2 aplicadas en el clon, se siembra UN aviso de forma nueva, UNA marca de visto y UN «Marcar
todos» (hace falta una clínica, un médico, una secretaria, un consultorio y un paciente; valen los de
`supabase/pruebas-sql/av1_avisos_globales.sql`, pero con COMMIT), se apaga la v2 y:

```bash
bash supabase/produccion/plan/aplicar.sh reversa   # dice qué se perdería; PERDER DATOS, REVERTIR …130000, REVERTIR …120000, y parar en T
bash supabase/produccion/plan/aplicar.sh estado    # M1 y M2 «pendiente»; ningún ALTO
bash supabase/produccion/conteos/correr-conteos-avisos.sh   # 0 ALTO; A.6 = «0 / 0 / 4 / false»; A.6b = «la de M1, conservada por su reversa»
bash supabase/produccion/plan/aplicar.sh aplicar   # las dos otra vez; fila 11 de M1 = «la de M1, conservada por su reversa»
```

Lo que salió en local: la reversa de M1 imprime `WARNING: REVERSA CON DATOS … se borran 1 marca(s)
de avisos_vistos y 1 de avisos_vistos_hasta; 1 aviso(s) con la forma de M1 se CONSERVAN …` y su fila
5 dice `la de M1, CONSERVADA con confirmación: 1 aviso(s) la usan` (INFO). La ida imprime `NOTICE:
M1: avisos_clinica ya tiene la forma de M1 … se completa lo que falta.` y termina igual que una ida
limpia: mismas 15 filas, y el `pg_dump -s` de `public` idéntico al de una ida desde F4. El aviso sigue
(no se borra nada); las marcas de visto y el «Marcar todos» no vuelven.

**Nuevo (D1): la forma conservada se comprueba columna a columna.** Con un `DEFAULT` puesto a mano en
`datos`, o un `NOT NULL` en `destinatario_id`, la ida ABORTA en el pre-vuelo: `PRE-VUELO FALLÓ:
avisos_clinica está a medias (4 de las 4 columnas de M1, 3 como las deja M1: su tipo, admiten NULL y
sin DEFAULT) …`. Probado en local con los dos; quitando la alteración, la ida entra.

Luego, las pruebas (crean sus datos y terminan en rollback):

```bash
for p in av1_avisos_globales av2_rsvp_rechazo av3_avisos_no_impiden av4_policies_como_f4; do
  docker exec -i <contenedor del clon> psql -U postgres -v ON_ERROR_STOP=1 -q -o /dev/null -f - < supabase/pruebas-sql/$p.sql
done
```

Dejan estas líneas de WARNING **a propósito**, siempre las mismas y en este orden (son
deterministas: no dependen de la base); cualquier `ERROR` es un fallo:

- `av1`: `aviso_clinica_de_cambio_cita: aviso personal_agendo no escrito (SQLSTATE 23514)`
- `av2` y `av4`: ninguna.
- `av3`, SEIS:
  1. `aviso_clinica_reabrir: aviso reserva_enlace no refrescado (SQLSTATE P0001)`
  2. `aviso_clinica_reabrir: aviso confirmacion_paciente no refrescado (SQLSTATE P0001)`
  3. `aviso_clinica_reabrir: aviso cancelacion_paciente no refrescado (SQLSTATE P0001)`
  4. `aviso_clinica_de_cambio_medico: médico de los avisos no actualizado (SQLSTATE P0001)`
  5. `aviso_clinica_de_cambio_cita: aviso (sin decidir) no escrito (SQLSTATE 22P02)`
  6. `aviso_clinica_de_bloqueo: aviso no escrito (SQLSTATE 22P02)`

  (En el segundo ensayo salieron 4 de 5: faltó la 1. No era el clon: una reserva por enlace crea
  una cita NUEVA, sin aviso que refrescar, así que el refresco que la prueba rompe no llegaba a
  correr; la 1 sólo salía con el reabrir de la versión 1, y en mi lista se quedó por error. Ahora la
  prueba presiembra el aviso de esa cita al nacer (un disparador de la propia prueba), y la 1 sale
  siempre. La 4 es nueva: el cambio de médico de una cita.)

Mediciones (a mano, no son pruebas; terminan en rollback):

```bash
for n in 1200 6000 21000; do
  docker exec -i <clon> psql -U postgres -q -v n=$n -f - < supabase/pruebas-sql/medicion/av1_campana.sql
done
docker exec -i <clon> psql -U postgres -q -v n=21000 -v franja=1 -f - < supabase/pruebas-sql/medicion/av1_campana.sql
# -v version2=1: las mismas, con las funciones de la versión 2 (7cac5d49), para comparar
```

## 4. Rejillas esperadas, fila por fila

**M1** (15 filas; 13 OK y 2 INFO):

| n | comprobación | valor esperado |
|---|---|---|
| 1 | columnas nuevas de avisos_clinica | `actor_id,datos,destinatario_id,medico_id` |
| 2 | tipos que admite avisos_clinica_tipo_check | `19` |
| 3 | policies de avisos_clinica | `avisos_clinica_select:SELECT,avisos_clinica_update:UPDATE` |
| 4 | disparadores aviso nuevos, habilitados | `8` |
| 5 | funciones aviso_clinica_* DEFINER con search_path vacío (6 de F4 + 6 de disparador + la RPC) | `13` |
| 6 | quién ejecuta aviso_clinica_registrar (anon/authenticated/service_role) | `false/false/true` |
| 7 | avisos_vistos: policies | `avisos_vistos_insert:INSERT,avisos_vistos_select:SELECT,avisos_vistos_update:UPDATE` |
| 8 | reabrir, sellar y sin_truncate (disparadores propios de avisos), habilitados | `5` |
| 9 | avisos_clinica en la publicación supabase_realtime | `0` |
| 10 | filas de avisos_clinica (no se añade ni se borra ninguna) (INFO) | las que hubiera |
| 11 | forma de avisos_clinica de la que partió (INFO) | `la de F4` (o `la de M1, conservada por su reversa` en 3-bis) |
| 12 | avisos_pendientes acotada (ventana de 60 días y tope de 500) | `true` |
| 13 | quién ejecuta avisos_mas_antiguos, avisos_candidatos, avisos_revisar_todos y avisos_vistos_hasta_mia | `false/true/false` × 4 |
| 14 | avisos_vistos_hasta («Marcar todos»): policies | `avisos_vistos_hasta_insert:INSERT,avisos_vistos_hasta_select:SELECT,avisos_vistos_hasta_update:UPDATE` |
| 15 | índices de la lectura (pendientes de F4, médico y cita de M1) | `3` |

Antes de la rejilla, una ida desde la forma de F4 imprime seis `NOTICE … does not exist, skipping`
(la tabla temporal del pre-vuelo, dos CHECK y tres índices): son los `IF EXISTS` que la hacen
re-aplicable desde la forma conservada. Normales.

**M2** (3 filas, todas OK): `1 · INVOKER y search_path vacío = true` · `2 · quién la ejecuta =
false/false/true` · `3 · cita_rsvp_google (el «Sí») sigue = true`.

**Reversa de M2** (1 fila): `cita_rsvp_google_rechazo quitada = true`.

**Reversa de M1** (5 filas, todas OK sin datos): `1 · disparadores de M1 que quedan = 0` · `2 · funciones
de M1 que quedan = 0` · `3 · escritores de F4, intactos = 7` · `4 · tablas avisos_vistos y
avisos_vistos_hasta = false` · `5 · forma de avisos_clinica = la de F4`. Con datos y confirmación, la
5 es INFO: `la de M1, CONSERVADA con confirmación: N aviso(s) la usan`.

## 5. Diff de estructura esperado (antes ↔ después de M1 y M2)

El diff completo de mi base local está en `docs/spec/avisos-globales/estructura-antes-despues.local.diff`
(`pg_dump -s -n public --no-comments`, 1 102 líneas). En el clon debe salir lo mismo, y NADA más:

- **Dos tablas nuevas:** `public.avisos_vistos` (como en la versión 2) y **`public.avisos_vistos_hasta`**
  (`usuario_id` llave primaria, `clinica_id` con FK RESTRICT a `clinicas`, `hasta`; 1 índice, RLS, 3
  policies; sólo `authenticated`: SELECT, INSERT de las tres columnas, UPDATE de `clinica_id` y `hasta`).
- **`public.avisos_clinica`**: lo de la versión 2 (4 columnas, `cita_id` admite NULL, CHECK de 19
  tipos, 2 CHECK nuevos, `avisos_clinica_sin_cita_key`, las 2 policies con `OFFSET 0` en su
  `EXISTS`) y **dos índices nuevos**: `avisos_clinica_medico_pendientes_idx (clinica_id, medico_id,
  creado_en DESC) WHERE revisado_en IS NULL` y `avisos_clinica_cita_idx (cita_id) WHERE cita_id IS NOT
  NULL`. Las policies NO cambiaron respecto de la versión 2.
- **16 funciones nuevas**: las 11 de la versión 2 (`avisos_pendientes` y `avisos_mas_antiguos`, con
  cuerpo nuevo) y **5 nuevas**: `aviso_clinica_de_cambio_medico` (disparador, DEFINER),
  `avisos_candidatos` (plpgsql, INVOKER, con `plan_cache_mode = force_custom_plan`),
  `avisos_revisar_todos` y `avisos_vistos_hasta_mia` (INVOKER, sólo `authenticated`) y
  `aviso_visto_hasta_sellar` (disparador, INVOKER).
- **13 disparadores nuevos**: los 10 de la versión 2 y **3 nuevos**: `trg_appointments_aviso_medico`
  (`AFTER UPDATE OF medico_id … WHEN (old.medico_id IS DISTINCT FROM new.medico_id)`) y, en
  `avisos_vistos_hasta`, `trg_avisos_vistos_hasta_sellar` y `trg_avisos_vistos_hasta_sin_truncate`.
- **Lo que NO debe aparecer:** ninguna otra tabla, ninguna policy de otra tabla, ningún cambio en
  `reservar_por_enlace`, `cita_rsvp_google`, `log_cita_change` ni en los seis `aviso_clinica_de_*` de
  F4, ninguna publicación y ningún privilegio nuevo para `anon`.

Tras la reversa de las dos (sin datos), el diff contra «antes» debe quedar VACÍO (en local: 0
diferencias, dos veces).

## 6. Lo que se comprobó en local y lo que no

Comprobado en el stack local de Supabase (CLI 2.117.0), sobre esta versión (la punta que se ensaya: la del reporte):

- las 16 migraciones desde cero con `supabase db reset --local`;
- `aplicar.sh` en modo ensayo con el stack encendido (`APL_PUERTO=54322`): `reversa` → conteos (0
  ALTO) → `aplicar` → segunda pasada → `reversa` (estructura = «antes», 0 diferencias) → `aplicar`;
- el ciclo 3-bis entero, con un «Marcar todos» además de la marca de visto, y D1 (dos alteraciones a
  mano que abortan la ida);
- **con el stack local APAGADO** (sin el contenedor; sólo su volumen) y la base en un contenedor
  suelto en el 54373, sin `IMAGEN_PG`: `aplicar.sh` (`estado`, `aplicar`, `reversa` con datos,
  `aplicar`), `correr-conteos.sh` y `correr-conteos-avisos.sh` (éste, también con su carpeta por
  omisión). Ningún «invalid reference format»;
- batería SQL: 52 archivos; Vitest 187 archivos, 2 689 pruebas; build; e2e en **escritorio** (116 de
  18 archivos: avisos, campana, reserva, confirmación, reagendar, bloqueos) y en **teléfono** (el mismo
  conjunto: 26 en verde y 90 que cada archivo se salta solo por no ser de ese formato;
  `avisos-globales`, 8 de 8 en teléfono);
- las mediciones de §8.

NO comprobado: nada sobre el clon de la foto de producción del 24-nov con esta versión (por eso existe
este guion); el tiempo de los candados con el RTT real; la tercera auditoría.

## 7. Qué se corrigió tras la segunda auditoría (A–F)

| | Qué se hizo | Dónde / cómo se prueba |
|---|---|---|
| A · la lectura del invitado era lineal | Cada aviso con cita lleva una COPIA del médico de su cita (`medico_id`, ya existía): la pone `trg_avisos_clinica_reabrir` al nacer y la mantiene `trg_appointments_aviso_medico` si la cita cambia de médico. La lectura (`avisos_candidatos`, plpgsql) va por dos caminos: toda la clínica (administrador y secretaria, índice de F4) o, para el invitado, lo SUYO y lo SIN MÉDICO por el índice nuevo `(clinica_id, medico_id, creado_en)`. La policy sigue siendo la autoridad (encima de todo) y no cambió. Planes con el valor real del usuario (`force_custom_plan`) y la consulta para en cuanto tiene lo pedido. | M1; `av4` parte 2 (seis perfiles, `avisos_pendientes` = la lectura sólo-RLS, con un aviso «heredado» sin copia y una cita que cambia de médico); `av3` caso 3-bis y 4; §8 |
| B · orden de candados de la reversa contra el lector | Los órdenes son INCOMPATIBLES por naturaleza (el lector toma `avisos_clinica` y luego `appointments`; los escritores y la reversa, al revés). Se deja el que protege a los escritores, y la cabecera dice ahora exactamente qué puede abortar: contra un escritor, nadie (espera; si pasan 5 s, aborta la reversa, limpia); contra un lector, el detector aborta a uno, casi siempre el lector (la campana repite a los 2 min); la reversa, si le toca, aborta limpia. | reversa de M1, cabecera |
| C · el «+» podía quedarse fijo | El indicador sólo sale si hay algo SIN VER que la lista no enseña, y siempre lo resuelve «Marcar todos como revisados», que ahora es UN gesto: una marca de agua por usuario (`avisos_vistos_hasta`, vía `avisos_revisar_todos`) que cubre también lo de fuera del tope y de la ventana; lo que se reabre después vuelve. Con la lista vacía se enseña la nota y el botón, no «No hay avisos». El cliente sólo pregunta por lo antiguo cuando la lista no se llenó. | M1; `av1` casos 19 y 20; e2e `avisos-globales` (dos pruebas nuevas, escritorio y teléfono); Vitest |
| D1 · la forma conservada no miraba atributos | El pre-vuelo exige las cuatro columnas con su tipo, admitiendo NULL y sin DEFAULT. | M1; §3-bis |
| D2 · fechas | Cabeceras de M1 y de su reversa: «Versión 3 · 2026-11-24 en Mérida (2026-11-25 UTC)». | M1, reversa |
| D3 · líneas de `esperadas-clon.tsv` | Las esperadas se citan por su clave y su línea de hoy (11 y 15); quedan los datos del segundo ensayo (3 519 / 3 510 objetos; 14 / 14 / 0) y que las 99 diferencias antes ↔ después cambian con esta versión. | `esperadas-clon.tsv`, `COMPROBACION-POSTERIOR.md`, `DERIVA.md` |
| D4 · carpeta de los conteos | `correr-conteos-avisos.sh` guarda por omisión en `~/spinus-produccion-conteos-avisos/`. | §2 |
| E · `av3` dejaba 4 de 5 WARNING | Explicado arriba (§3-bis) y hecho determinista: seis, siempre. | `av3` |
| F · el nombre sólo tras aceptar el aviso | `src/lib/tests/reservarAvisoFrenada.test.ts`: con la ruta real, `reserva_frenada` se registra con el nombre sólo con `acepta_aviso: true` y la reserva frenada; sin la casilla, con `false` o con `"true"` es 400, no se intenta la reserva ni se registra nada; una reserva que sale no lo registra. Comprobado en rojo quitando la casilla del esquema y registrando también con `ok`. | Vitest |

## 8. Mediciones en local (máquina de desarrollo; tiempo de base, no de petición)

**Lectura de la campana**, las dos funciones que pide en cada relectura (`avisos_pendientes` con
límite 51 / `avisos_mas_antiguos`), mediana de 15, en ms (`supabase/pruebas-sql/medicion/av1_campana.sql`).
Una clínica con N citas y un aviso por cita, TODOS dentro de los últimos 59 días (el peor caso).
Médicos: el administrador; un invitado con la mitad de las citas; un invitado con el 1 % («casi no
ve nada»). «v2» = las funciones de `7cac5d49` con los mismos datos (`-v version2=1`).

| Quién | 1 200 v2 | 1 200 ahora | 6 000 v2 | 6 000 ahora | 21 000 v2 | 21 000 ahora | 21 000 + franja, v2 | 21 000 + franja, ahora |
|---|---|---|---|---|---|---|---|---|
| administrador · nada visto | 1,8 / 8,2 | 2,4 / 9,8 | 1,9 / 8,5 | 2,6 / 9,3 | 1,9 / 8,3 | 2,3 / 9,2 | 1,9 / 8,3 | 2,3 / 9,1 |
| invitado mitad · nada visto | 3,3 / 19,9 | 2,4 / 7,0 | 3,4 / 20,5 | 2,3 / 7,2 | 3,1 / 18,9 | 2,4 / 7,4 | 3,5 / 22,3 | 2,3 / 6,9 |
| **invitado 1 % · nada visto** | **32,9 / 33,0** | **1,6 / 2,8** | **139 / 163** | **2,2 / 3,3** | **136 / 566** | **3,9 / 8,9** | **131 / 541** | **2,4 / 5,8** |
| administrador · todo visto uno a uno | 11,0 / 8,2 | 10,7 / 23,1 | 10,5 / 8,0 | 10,1 / 20,1 | 11,1 / 8,3 | 10,0 / 20,4 | 9,4 / 6,6 | 10,2 / 30,0 |
| invitado mitad · todo visto | 22,5 / 19,2 | 8,4 / 10,2 | 21,9 / 19,1 | 8,4 / 10,1 | 22,5 / 19,4 | 8,3 / 9,2 | 21,6 / 19,1 | 9,4 / 18,2 |
| **invitado 1 % · todo visto** | **33,5 / 33,3** | **1,6 / 2,8** | **167 / 167** | **2,2 / 3,4** | **564 / 554** | **4,1 / 4,8** | **557 / 1 077** | **4,5 / 8,6** |
| administrador · tras «Marcar todos» | — | 1,1 / 1,8 | — | 0,8 / 1,4 | — | 0,8 / 1,4 | — | 1,5 / 2,8 |
| invitado mitad · tras «Marcar todos» | — | 1,5 / 3,0 | — | 1,3 / 2,4 | — | 1,4 / 2,6 | — | 2,5 / 4,9 |
| invitado 1 % · tras «Marcar todos» | — | 1,4 / 2,6 | — | 1,3 / 2,3 | — | 1,3 / 2,6 | — | 2,5 / 4,6 |

Plano en los tres tamaños para los tres perfiles, también con la franja de 60 a 120 días cargada
(«+ franja»: otros 21 000 avisos ahí, sin ver). El caso del auditor (el invitado que casi no ve nada)
pasa de 33 → 564 ms (y 1 077 con la franja) a 1,6–4,5 / 2,6–8,9 ms. El techo de las dos funciones
es el de sus topes (500 y 600 + 500 candidatos), no el tamaño de la clínica: «todo visto uno a uno»
del administrador es el peor caso (10 / 20–30 ms); «Marcar todos» lo deja en 1–3 ms. Y
`avisos_mas_antiguos` el cliente sólo la pide cuando la lista trae 50 o menos (con 51 la nota ya es
cierta): en «nada visto», que es casi siempre, no se llama.

Lo que cuesta más que en la versión 2: el administrador con nada visto paga ~0,5 ms más en la lista
(la función auxiliar es plpgsql) y `avisos_mas_antiguos` con todo visto uno a uno sube de 8 a 20–30
ms porque ahora sí mira los candidatos 501.º a 600.º (antes contaba avisos ya vistos como «más
antiguos»: era el «+» fijo del punto C).

**Disparador en `appointments`** (300 operaciones, 3 corridas, ms por operación, con la sesión de la
persona; `av1_tiempos.sql`):

| | alta | mover | cancelar |
|---|---|---|---|
| médico en su agenda (no escribe aviso) | 1,00–1,01 | 1,11–1,19 | 1,02–1,17 |
| secretaria en la agenda de otro (escribe aviso) | 1,43–1,54 | 1,70–1,92 | 1,66–1,85 |

En la versión 2: médico 1,03–1,28 / 1,22–1,56 / 1,18–1,48; secretaria 1,52–1,83 / 1,75–2,21 /
1,64–2,51. La copia del médico (una lectura de la cita por su llave, al nacer el aviso) no se
distingue del ruido entre corridas. El disparador nuevo de cambio de médico sólo corre cuando una
cita cambia de médico (`WHEN`), algo que no mide esta prueba.
