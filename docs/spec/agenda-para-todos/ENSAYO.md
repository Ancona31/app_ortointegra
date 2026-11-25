# Agenda para todos — ensayo de las CUATRO migraciones en el clon de producción

Para quien corra el ensayo en el equipo de Angel. Rama `feature/agenda-para-todos`. Nada de aquí
toca producción; el guion se corre en MODO ENSAYO. Parte de una producción con M1 y M2 de «avisos
globales» ya aplicadas (historial: 16 versiones, hasta `20261202130000`).

| | Migración | Qué hace | Riesgo | Depende de | Respecto del código nuevo en `main` |
|---|---|---|---|---|---|
| **MA** | `20261203130000_avisos_globales_cierre_auditoria` | Cierra los hallazgos de la tercera auditoría de M1: copia del médico en los avisos, «Marcar todos» frente a transacciones abiertas, cambio de médico sin esperas | bajo | M1 | **antes o después** (el código no cambia) |
| **M4** | `20261204120000_reserva_purga_y_tope` | AG-DT-274: purga a los 30 días (códigos, intentos de límites, correo de enlaces únicos vencidos) y tope de emisión en la base | medio-alto | F3 | **antes o después**; mejor ANTES (sin ella, la tarea diaria contesta 500) |
| **M5** | `20261205120000_gcal_empalmes_pendientes` | AG-DT-264: cola persistente de empalmes de Google | medio | F2 | **antes o después**; mejor ANTES (sin ella, el código usa la lista en memoria, como hoy) |
| **M3** | `20261206120000_agenda_para_todos` | La agenda v2 encendida por omisión en todas las clínicas | medio | F1 | **SIEMPRE DESPUÉS** |

**Orden propuesto para producción:** MA, M4 y M5 → merge a `main` y despliegue → M3. El guion las
ofrece en ese orden (M3 lleva el sello más alto a propósito): se aplican las tres primeras, se
contesta otra cosa cuando ofrezca M3, y M3 se aplica en otra corrida, tras el despliegue.

> **Por qué M3 va después del código.** Con el código de `main` de hoy (sin agenda v2) y M3 aplicada,
> borrar una cita con paciente daría error en todas las clínicas (las protecciones de F5b actuarían
> en todas). Con el código nuevo y la base sin M3 no cambia nada para nadie.

Qué hace cada una y por qué: `REPASO-AUTOR-M3.md` y `REPASO-AUTOR-MA-M4-M5.md` (al lado).

## 0. Huellas (antes de nada)

```bash
sha256sum supabase/produccion/plan/aplicar.sh       # la del reporte final
sha256sum -c supabase/produccion/plan/huellas.sha256   # 31 líneas, todas OK
```

Las huellas de las cuatro migraciones, de sus reversas, de `aplicar.sh`, de `reversa-previa.sql` y de
`huellas.sha256` van en el reporte final (no aquí: este archivo cambiaría con ellas). Si una no
coincide, alto.

## 1. Qué cambió en el guion `aplicar.sh`

- `MIGRACIONES`: las 11 de antes + MA, M4, M5 y M3, en ese orden. Con M1 y M2 ya registradas,
  `aplicar` ofrece sólo estas cuatro.
- `REVERSAS`: **M3, M5, M4, MA**, luego M2, M1, T, F5b, F4, F2, F3, F5a, F1.
- Objetos testigo: MA, `public.avisos_transaccion_mas_antigua()`; M4, `public.reserva_purgar(integer)`;
  M5, la tabla `public.gcal_empalmes_pendientes`; M3, `public.agenda_ajustes_de_clinica_nueva()`.
- `reversa-previa.sql` tiene UNA fila nueva: la reversa de M5 se niega si quedan apuntes en su cola.
  Las de MA, M4 y M3 no se niegan por datos.

## 2. Conteos de sólo lectura (en PRODUCCIÓN, antes de aplicar; los corre Angel)

```bash
bash supabase/produccion/conteos/correr-conteos-agenda-para-todos.sh
```

Una sola rejilla para las cuatro (filas D.* = MA, E.* = M4, F.* = M5; G.*, A.*, B.* y C.* = M3).
Esperado, antes de aplicar ninguna: **0 ALTO**. Tras aplicar MA, M4 y M5, sus filas D.1, D.3, E.1, E.2
y F.1 pasan a ALTO (dicen «ya aplicada»): es lo normal antes de M3. Qué hacer con cada fila: `supabase/produccion/conteos/LEEME.md`, «Agenda para
todos (M3)». Los números que sólo salen de aquí (huecos de este documento):

| Fila | Qué dice | Valor en producción |
|---|---|---|
| B.1 | clínicas | _(pendiente)_ |
| B.2 | filas: total / encendidas / apagadas | _(pendiente)_ |
| B.3 | clínicas sin fila (las creará M3) | _(pendiente)_ |
| B.4 | filas apagadas que alguien tocó (¿a propósito?) | _(pendiente; esperado 0)_ |
| C.1 | clínicas con Google conectado: total / ya encendidas | _(pendiente)_ |
| C.3 | citas futuras con paciente que dejarán de poder borrarse | _(pendiente)_ |
| C.5 | citas viejas sin cerrar: por las que se preguntará «¿Asistió?» (últimos 30 días) / la clínica con más / las anteriores a 30 días, que quedan fuera / la clínica con más fuera | _(pendiente)_ |
| A.3 | huella de `agenda_v2_encendida` (la exige el pre-vuelo de M3) | _(pendiente; esperado OK)_ |
| D.3 | huellas de las tres funciones de M1 que MA reescribe | _(pendiente; esperado 3)_ |
| D.4 | quien aplica ve las transacciones de las demás sesiones | _(pendiente; esperado true)_ |
| D.5 | avisos con cita: total / sin copia / con copia vieja | _(pendiente; el planificador comunicó 3 avisos, todos cerrados)_ |
| E.2 | huella de `reserva_codigo_emitir` (la exige el pre-vuelo de M4) | _(pendiente; esperado OK)_ |
| E.6 – E.8 | códigos, intentos de límites y correos de únicos que se llevará la primera pasada | _(pendiente)_ |

Contra el clon: `CONTEOS_HOST=127.0.0.1 CONTEOS_PUERTO=54373 CONTEOS_USUARIO=postgres
CONTEOS_SSL=disable CONTEOS_RED=host`.

## 3. El ensayo

Con el clon levantado y M1 y M2 ya aplicadas en él, desde la raíz del repo:

```bash
export APL_HOST=127.0.0.1 APL_PUERTO=54373 APL_USUARIO=postgres APL_SSL=disable APL_RED=host \
       APL_DESTINO="$HOME/spinus-produccion-ensayo/agenda-para-todos-$(date +%Y%m%d)"
bash supabase/produccion/plan/aplicar.sh estado     # las cuatro «pendiente»; las 11 «aplicada y registrada»
bash supabase/produccion/plan/aplicar.sh aplicar    # escribir 20261203130000, 20261204120000, 20261205120000 y 20261206120000
bash supabase/produccion/plan/aplicar.sh aplicar    # segunda pasada: no ofrece nada, «Las 15 aplicadas y registradas»
bash supabase/produccion/plan/aplicar.sh reversa    # ver §4: con la v2 encendida se para sin tocar nada
```

Para ensayar el orden de producción (las tres primeras, y M3 aparte): en la primera `aplicar`,
escribir las tres versiones y contestar cualquier otra cosa a la de `20261206120000` (el guion para
ahí, «nada a medias»); `estado` dirá M3 «pendiente» y las otras tres aplicadas.

El clon no tiene datos: las rejillas dirán ceros en sus filas INFO. Para ver los rellenos, sembrar
ANTES de aplicar (como postgres; `clinicas` sólo exige `nombre`):

```sql
INSERT INTO public.clinicas (nombre) VALUES ('Ensayo uno'), ('Ensayo dos'), ('Ensayo tres');
INSERT INTO public.agenda_ajustes (clinica_id, agenda_v2_encendida)
SELECT id, false FROM public.clinicas WHERE nombre = 'Ensayo uno';
-- esperado en la rejilla de M3: ANTES 3 / 1 / 0 / 2 · DESPUÉS 3 / 3 / 3
```

Y después de aplicar M3, una clínica nueva nace con su fila:

```sql
INSERT INTO public.clinicas (nombre) VALUES ('Ensayo cuatro');
SELECT agenda_v2_encendida, recordatorio_encendido, correo_reserva_clinica
  FROM public.agenda_ajustes a JOIN public.clinicas c ON c.id = a.clinica_id WHERE c.nombre = 'Ensayo cuatro';
-- esperado: t | f | f
```

## 4. Deshacer (las reversas)

La cadena va en orden inverso: **M3, M5, M4, MA** (y luego M2, M1…). Se puede parar tras cualquiera.

### 4.1 M3

El guion exige, para TODA reversa de la agenda, la v2 apagada en todas las clínicas, y M3 la
enciende en todas. Con la v2 encendida, `reversa` se para ANTES de tocar nada y dice cuáles:

```
· previo: la v2 está ENCENDIDA en estas clínicas (apágala en TODAS antes de revertir): …
ALTO: la cadena de reversas NO empieza por lo de arriba. No se tocó nada (plan §10).
```

Para deshacerla:

```sql
-- 1. Como postgres. Apaga la agenda v2 en TODAS (es lo que de verdad devuelve la app a la agenda de antes).
--    Cada fila queda auditada (audit_agenda_ajustes). No borra nada.
UPDATE public.agenda_ajustes SET agenda_v2_encendida = false WHERE agenda_v2_encendida;
```

```bash
# 2. La reversa. Como desde M3 toda clínica tiene fila, la comprobación previa avisa de que la reversa
#    de F1 «perdería datos» (agenda_ajustes: N filas) y pide PERDER DATOS para SEGUIR CON LA CADENA.
#    Para deshacer SÓLO M3: escribir PERDER DATOS, luego REVERTIR 20261206120000, y cualquier otra
#    cosa en la pregunta siguiente (la de 20261205120000). La reversa de M3 no borra ni cambia filas.
bash supabase/produccion/plan/aplicar.sh reversa
bash supabase/produccion/plan/aplicar.sh estado     # M3 «pendiente»; ningún ALTO
```

```sql
-- 3. Si sólo una clínica debía seguir encendida (la de Angel), se vuelve a encender ella:
UPDATE public.agenda_ajustes SET agenda_v2_encendida = true WHERE clinica_id = '<id de la clínica>';
```

Tras 1 y 2 la base queda como antes de M3, con una diferencia: cada clínica tiene ya su fila
(apagada). Volver a aplicar M3 (`aplicar`) las enciende otra vez.

> En producción, apagar en todas con el código nuevo desplegado devuelve a todos a la agenda de
> siempre en la siguiente carga de página. Las citas, los bloqueos, los tipos y los avisos que se
> hayan creado con la v2 se quedan en la base; no se borra nada.

### 4.2 M5, M4 y MA

Con la v2 apagada en todas (§4.1, paso 1), `reversa` las ofrece después de M3:

- **M5** (`REVERTIR 20261205120000`): si quedan apuntes en `gcal_empalmes_pendientes`, la comprobación
  previa lo dice («gcal_empalmes_pendientes (empalmes de Google por mirar): N») y, sin `PERDER DATOS`,
  no empieza. Para no perderlos: dejar correr antes una pasada de la sincronización. Quita la tabla,
  las dos funciones y los dos disparadores. El código nuevo cae solo en la lista en memoria.
- **M4** (`REVERTIR 20261204120000`): quita `reserva_purgar` y los tres índices y devuelve
  `reserva_codigo_emitir` al cuerpo de F3. Lo ya purgado no vuelve. La tarea diaria contestará 500
  hasta volver a aplicarla.
- **MA** (`REVERTIR 20261203130000`): devuelve las tres funciones al cuerpo de M1 y quita la nueva. El
  relleno de la copia del médico se queda (es correcto también para M1).

## 5. Rejillas esperadas

**MA** (8 filas; 6 OK y 2 INFO):

| n | comprobación | valor esperado |
|---|---|---|
| 1 | avisos_transaccion_mas_antigua: DEFINER, search_path vacío; quién la ejecuta | `true ; false/true/false` |
| 2 | las tres funciones de M1 ya NO tienen el cuerpo de M1 | `0` |
| 3 | avisos_revisar_todos: INVOKER; quién la ejecuta | `true ; false/true/false` |
| 4 | aviso_clinica_de_cambio_medico: DEFINER, y su disparador sigue habilitado | `true/1` |
| 5 | avisos con cita cuya copia no es el médico de su cita | `0` |
| 6 | policies de avisos_clinica, avisos_vistos y avisos_vistos_hasta (no se tocan) | `8` |
| 7 | ANTES: avisos con cita / sin copia / con copia vieja (INFO) | los que hubiera |
| 8 | transacción abierta más antigua vista ahora (INFO) | un instante o `NULL` |

Reversa de MA (3 filas OK): `quitada = true` · `las tres funciones, con el cuerpo de M1 = 3` ·
`false/true/false`.

**M4** (8 filas; 6 OK y 2 INFO):

| n | comprobación | valor esperado |
|---|---|---|
| 1 | reserva_purgar: DEFINER, search_path vacío; quién la ejecuta | `true ; false/false/true` |
| 2 | reserva_codigo_emitir: INVOKER, con el tope; quién la ejecuta | `true ; false/false/true` |
| 3 | índices nuevos, válidos | `3` |
| 4 | DELETE sobre reserva_verificaciones para anon/authenticated/service_role | `false/false/false` |
| 5 | proteger_reserva_enlace_unico y su disparador, sin tocar | `1` |
| 6 | disparador contra TRUNCATE de reserva_verificaciones | `1` |
| 7 | ANTES: códigos · intentos de límites · correos vaciables (INFO) | los que hubiera |
| 8 | la migración NO purga nada (INFO) | los mismos totales que la 7 |

Reversa de M4 (2 filas OK): `0` · `true ; false/false/true`.

**M5** (7 filas; 6 OK y 1 INFO):

| n | comprobación | valor esperado |
|---|---|---|
| 1 | gcal_empalmes_pendientes: RLS activa / policies | `true / 0` |
| 2 | privilegios de la tabla: anon / authenticated / service_role | `ninguno / ninguno / DELETE,SELECT` |
| 3 | gcal_empalme_apuntar: DEFINER, search_path vacío, sin PUBLIC | `true` |
| 4 | reserva_empalmes_pendientes_procesar: INVOKER; quién la ejecuta | `true ; false/false/true` |
| 5 | disparadores nuevos en appointments, habilitados y con WHEN | `2` |
| 6 | reserva_empalmes_registrar de F2 sigue | `true` |
| 7 | apuntes en la cola (INFO) | `0` |

(`service_role` tiene además UPDATE sólo sobre la columna `creado_en`: lo exige `FOR UPDATE SKIP
LOCKED`. No sale en la fila 2, que mira privilegios de tabla.) Reversa de M5 (1 fila OK): `0`.

Las cuatro imprimen antes de su rejilla un `NOTICE … does not exist, skipping` por cada tabla temporal
de sus números de antes. Normal.

**M3** (11 filas; 8 OK y 3 INFO):

| n | comprobación | valor esperado |
|---|---|---|
| 1 | agenda_ajustes.agenda_v2_encendida: DEFAULT | `true` |
| 2 | agenda_v2_encendida: INVOKER / STABLE / EXECUTE anon,authenticated,service_role / sin fila | `true/true/false,true,true/true` |
| 3 | agenda_ajustes_de_clinica_nueva: DEFINER con search_path vacío, sin PUBLIC | `true` |
| 4 | trg_clinicas_agenda_ajustes en clinicas, habilitado | `1` |
| 5 | clínicas sin fila en agenda_ajustes | `0` |
| 6 | filas de agenda_ajustes con la v2 apagada | `0` |
| 7 | proteger_agenda_ajustes y auditoría de agenda_ajustes, habilitados (no se tocan) | `2` |
| 8 | recordatorio_encendido / correo_reserva_clinica: DEFAULT | `false/false` |
| 9 | ANTES: clínicas / filas / encendidas / clínicas sin fila (INFO) | las que hubiera |
| 10 | DESPUÉS: clínicas / filas / encendidas (INFO) | los tres números iguales |
| 11 | filas con recordatorio o correo a la clínica encendidos (INFO) | las que ya lo estuvieran |

Antes de la rejilla imprime un `NOTICE … does not exist, skipping` (la tabla temporal de los números
de antes). Normal.

**Reversa de M3** (4 filas; 3 OK y 1 INFO): `1 · disparador y función de M3 que quedan = 0` · `2 ·
DEFAULT = false` · `3 · cuerpo de F1 / sin fila = true/false` · `4 · filas: total / encendidas`
(INFO; con la guarda del guion, `N / 0`). Imprime `WARNING: there is already a transaction in
progress` (el `BEGIN` del guion delante del del archivo, como en las demás reversas).

## 6. Diff de estructura esperado (antes ↔ después de las cuatro)

`pg_dump -s -n public --no-comments`, quitando las dos líneas `\restrict` / `\unrestrict` (llevan un
valor al azar en cada volcado). Debe salir esto y NADA más:

- **MA:** una función nueva, `avisos_transaccion_mas_antigua()` (sql, SECURITY DEFINER, sólo
  `authenticated`); el cuerpo de `aviso_visto_hasta_sellar()`, de `avisos_revisar_todos(timestamptz)`
  (pasa de `sql` a `plpgsql`) y de `aviso_clinica_de_cambio_medico()`. Ninguna tabla, policy,
  disparador ni privilegio.
- **M4:** una función nueva, `reserva_purgar(integer)` (plpgsql, SECURITY DEFINER, con `lock_timeout`
  de 2 s, sólo `service_role`); el cuerpo de `reserva_codigo_emitir`; tres índices
  (`reserva_verificaciones_created_at_idx`, `reserva_verificaciones_correo_idx`,
  `ip_rate_limits_created_at_idx`). Ningún privilegio de tabla nuevo.
- **M5:** una tabla, `gcal_empalmes_pendientes` (llave primaria, un índice, FK RESTRICT a `clinicas`,
  RLS sin policies; `service_role`: SELECT, DELETE y UPDATE de `creado_en`); dos funciones
  (`gcal_empalme_apuntar()` DEFINER y `reserva_empalmes_pendientes_procesar(uuid, integer)` INVOKER); dos
  disparadores en `appointments` (`trg_appointments_empalme_google_alta` y `…_cambio`, con `WHEN`).
- **M3:** una función nueva, `agenda_ajustes_de_clinica_nueva()` (DEFINER), con su ACL; una línea de
  `agenda_v2_encendida(uuid)` (`…), false)` → `…), true)`); `agenda_ajustes.agenda_v2_encendida`
  `DEFAULT false` → `DEFAULT true`; un disparador, `trg_clinicas_agenda_ajustes`, en `clinicas`.
- **Lo que NO debe aparecer:** ninguna policy nueva ni cambiada; ningún cambio en
  `proteger_agenda_ajustes()`, `proteger_reserva_enlace_unico()`, `reserva_empalmes_registrar`,
  `reservar_por_enlace` ni en los escritores de avisos; ningún privilegio para `anon`.

Tras las cuatro reversas (sin datos), el diff contra «antes» debe quedar VACÍO.

## 7. Pruebas tras aplicar

```bash
for p in av5_avisos_cierre_auditoria ap2_reserva_purga_y_tope ap3_gcal_empalmes_pendientes ap1_agenda_para_todos; do
  docker exec -i <contenedor del clon> psql -U postgres -v ON_ERROR_STOP=1 -q -o /dev/null -f - < supabase/pruebas-sql/$p.sql
done
```

Crean sus datos y terminan en rollback. Dejan estas líneas de WARNING **a propósito**; cualquier
`ERROR` es un fallo:

- `av5` y `ap2`: ninguna.
- `ap3`: `gcal_empalme_apuntar: apunte de empalme no escrito (SQLSTATE 23514)`.
- `ap1`: `agenda_ajustes_de_clinica_nueva: fila de ajustes no creada para la clínica 00000000-0000-4000-8000-0000000a91c4 (SQLSTATE 23514)`.

Las carreras de dos sesiones de MA (`bash scripts/avisos-carrera.sh`) están escritas para el stack
local (buscan el contenedor `supabase_db_<proyecto>`): crean una clínica de prueba con ids fijos, la
borran al terminar y, en su control, deshacen y vuelven a aplicar MA con `psql`. No correrlas contra
el clon sin adaptar el nombre del contenedor.

## 8. Lo que se comprobó en local y lo que no

Ver el reporte final de la entrega (qué se corrió sobre el commit congelado y con qué resultado).

NO comprobado en ningún caso: nada sobre el clon de la foto de producción; los conteos en producción;
el tiempo de los candados con el RTT real; la auditoría independiente de ninguna de las cuatro.
