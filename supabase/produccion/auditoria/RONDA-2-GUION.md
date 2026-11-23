# Auditoría independiente del guion de aplicación (`aplicar.sh`) — ronda 2

Auditor independiente. Rama `feature/agenda-v2-produccion` (commit `a4b16a85`). Todo lo que
sigue está EJECUTADO contra mi clon local salvo lo marcado **DEDUCIDO**.

## 0. Banco de pruebas

- Clon: contenedor `clon-spinus-aud2-1`, `127.0.0.1:54391`, levantado con
  `scripts/produccion/clonar-desde-foto.sh ~/spinus-produccion-foto` (0 errores de restauración,
  14 diferencias foto ↔ clon, las 14 esperadas). PostgreSQL 17.6. `postgres` NO es superusuario
  (`rolsuper = f`, `rolbypassrls = t`).
- Datos inventados del tamaño real (`aud2-trabajo/semilla.sql`): 17 clínicas, 20 perfiles,
  18 consultorios, 247 citas.
- Estados guardados como plantillas de base dentro del mismo contenedor (`b0` = sembrada sin
  aplicar; `b9` = las 9 aplicadas) para volver a un punto de partida entre pruebas.
- El guion se corre tal cual, sin tocarlo: `APL_HOST=127.0.0.1 APL_PUERTO=54391 APL_USUARIO=postgres
  APL_SSL=disable APL_RED=host PGPASSWORD=postgres APL_DESTINO=… bash supabase/produccion/plan/aplicar.sh …`.
- Registro del servidor con `log_min_duration_statement = 0`, `log_connections`, `log_disconnections`.
- Guiones y salidas: `~/spinus-fusion/auditoria/aud2-trabajo/`.

## 1. Corrida de base (sin fallos)

`estado` y `aplicar` con las 9 confirmaciones: las 9 «aplicada y registrada», sin REVISAR; historial
con 14 versiones. En el registro del servidor, cada sesión de archivo son **3 peticiones** (los SET,
la línea de ajustes, el archivo entero como un solo mensaje de consulta simple). Tiempo de servidor
de la petición del archivo, sin carga: 6–77 ms (el mayor, F4).

## 2. Medición obligatoria: ACCESS EXCLUSIVE sobre `appointments`

**Método exacto.** Clon con 247 citas / 17 clínicas / 18 consultorios / 20 perfiles inventados. Guion
de hoy sin tocar (`aplicar.sh aplicar`, las 9 seguidas). Tres sondas en paralelo, conectadas DIRECTAS
por el socket del contenedor (nunca por el proxy), como `supabase_admin`:
- `sonda_candados.sql`: un bucle que consulta `pg_locks` cada **2,07 ms** (medido: 1447 muestras en 3 s)
  y anuncia cada tramo en que hay un `AccessExclusiveLock` CONCEDIDO sobre `appointments`, `clinicas`
  o `consultorios`. Doy dos cifras: «visto» (última muestra con candado − primera) y «hasta libre»
  (primera muestra sin candado − primera con candado); la ventana real está entre las dos, ±2 ms.
- `lector_appointments.sql` y `lector_clinicas.sql`: `select count(*)` en bucle, una transacción por
  lectura (no retienen nada), una cada ~5 ms, con `\timing`; apunto la lectura más lenta de la corrida.
- Cada tramo se casa con su archivo por la hora de la petición en el registro del servidor.
- Retardo: mi proxy TCP (`aud2-trabajo/proxy.py`, asyncio; cada trozo sale la mitad del retardo
  después en cada sentido). Retardo verificado con 5 × `select 1`: directo 0,11–0,25 ms; proxy «50»
  50,7–50,9 ms; proxy «150» 151,0–151,5 ms por viaje.

| Archivo | Tabla con ACCESS EXCLUSIVE | Sin retardo (visto / hasta libre) | 50 ms | 150 ms |
|---|---|---|---|---|
| F1 `20261201120000` | `appointments`, `clinicas`, `consultorios` (a la vez) | 34,7 / 36,9 ms | 24,1 / 26,5 ms | 29,4 / 31,6 ms |
| F3 `20261201140000` | `appointments` | 24,5 / 26,7 ms | 44,3 / 46,6 ms | 43,4 / 45,6 ms |
| F2 `20261201150000` | `appointments` | 11,0 / 13,2 ms | 37,3 / 39,5 ms | 33,0 / 35,2 ms |
| F5b `20261201170000` | `appointments` | 4,3 / 6,4 ms | 19,4 / 21,5 ms | 18,4 / 20,6 ms |
| las otras 5 (1, 2, F5a, F4, T) | ninguna de las tres | — | — | — |
| Lectura de citas más lenta de toda la corrida | | 38,0 ms | 45,1 ms | 43,5 ms |
| Lectura de `clinicas` más lenta | | 38,3 ms | 24,3 ms | 31,0 ms |
| Las 9 de punta a punta (con registro) | | 29,6 s | 42,6 s | 70,9 s |

Las tres corridas: 9 «✓», 0 REVISAR. **La ventana no crece con el retardo de red** (la diferencia
entre columnas es ruido del equipo: mismas decenas de ms): el archivo va en una petición y el
servidor no espera al cliente. Tiempo de servidor de la petición entera de cada archivo: 7–167 ms.

**Lo que SÍ es largo (medido, camino 5):** no la ventana del candado concedido, sino la COLA. Si al
llegar F3 hay otra sesión con una transacción abierta que LEYÓ `appointments` (un `idle in
transaction`, un `pg_dump`, una consulta larga), F3 pide su ACCESS EXCLUSIVE, espera sus 5 s de
`lock_timeout` y aborta; durante esos 5 s **toda lectura nueva de `appointments` queda detrás de F3:
lectura más lenta medida 5 000 ms** (la agenda parada 5 s; un rol con `statement_timeout` de 3 s,
como `anon`, vería error — esto último DEDUCIDO). Con un ESCRITOR ajeno (UPDATE sin confirmar, 3 s)
F3 espera en un candado más débil y los lectores NO se frenan (lectura más lenta 27,7 ms); F3 entra al
confirmar el otro. F1 (NOWAIT con reintentos) nunca hace cola: con un lector ajeno de `clinicas`
aborta a los 5 s y los lectores no notan nada (1,4 ms).

## 3. Caminos de fallo

### Camino 1 — fallo ANTES del COMMIT de un archivo
- **1a, candado ajeno** (otra sesión con transacción abierta tras leer `appointments`, 12 s; F3 desde
  el estado «4 aplicadas»): psql dio `ERROR: canceling statement due to lock timeout` a los 5 s; el
  guion: «FALLÓ (ver arriba). El catálogo dice que NO quedó aplicada (no existe tabla
  public.reserva_enlaces) y NO se registró». Base: testigos `111100000`, historial `111100000`. **Verdad.**
  La sesión ajena no abortó ni se enteró.
- **1b, pre-vuelo que aborta** (renombré `idx_appointments_client_id`): `ERROR: PRE-VUELO F3: falta el
  índice único…`; mismo mensaje del guion, mismo estado. **Verdad.**
- Observación (G-LEVE, ver hallazgos): el `ERROR` sale en pantalla ANTES de los `CREATE TABLE…` de la
  misma petición (stderr sin búfer, stdout con búfer): lo último que se lee encima del «ALTO» no es el error.

### Camino 5 — candado ajeno / sesiones ajenas
Medido arriba («Lo que sí es largo»). Ninguna sesión ajena abortó en ninguna prueba; las lecturas
esperan como mucho lo que dura la cola de F3 (≤ 5 s) o la ventana (≤ 47 ms).

### Camino 2 — fallo DESPUÉS del COMMIT
- **2a, rejilla con REVISAR** (añadí una policy a `audit_log` antes de la migración 1): «la rejilla …
  tiene filas REVISAR. Quedó APLICADA (COMMIT hecho) pero NO registrada». Base: testigo sí, historial
  no. **Verdad.** Al repetir `aplicar`: «no está en el historial pero YA está aplicada … No la vuelvo
  a correr». **Verdad.** Pero `estado` la lista como «pendiente» (hallazgo G4).
- **2b, falla el registro** (disparador que rechaza el INSERT en `schema_migrations`): la CLI dijo
  `failed to update migration table: ERROR: aud2…`; el guion: «AVISO: migration repair salió con 1 …
  se aplicó pero no quedó en el historial. Repite sólo: migration repair --status applied …». **Verdad.**

### Camino 3 — cliente MUERTO a media aplicación
Método (`aud2-trabajo/corte.sh`): F3 desde «4 aplicadas»; otra sesión retiene `appointments` (UPDATE sin
confirmar) para que el servidor esté DENTRO de la transacción de F3 esperando; corte 1,6 s después de
empezar la espera; el candado ajeno se suelta 1,55 s después del corte.

| Corte | Qué hizo el servidor | Qué dijo el guion | Base (testigo / historial) | ¿Verdad? |
|---|---|---|---|---|
| `kill -9` al guion (bash) | terminó F3 0,2 s después de soltarse el candado ajeno (el `psql` vive en su contenedor y siguió) | nada (murió); el `.salida.txt` sí trae la rejilla | F3 sí / no | — (al repetir: «YA está aplicada … sin registrar», verdad) |
| `kill -9` al `docker run` | ídem | esperó a la otra sesión y dijo «FALLÓ DESPUÉS de su COMMIT … SÍ quedó aplicada … NO se registró» | sí / no | sí |
| muerte del `psql` (`docker kill` del contenedor) | ídem: F3 confirmada 0,05–0,2 s tras soltarse el candado, con el cliente ya muerto | ídem | sí / no | sí |
| ídem, con F2 (emite un NOTICE) | ídem, F2 confirmada | ídem | sí / no | sí |
| ídem, por el proxy de 150 ms | ídem (37,6 ms de ACCESS EXCLUSIVE) | ídem | sí / no | sí |
| Ctrl-C (SIGINT al grupo) | `psql` mandó «Cancel request»; el servidor deshizo | «FALLÓ … NO quedó aplicada» | no / no | sí |
| terminal cerrada (SIGHUP al grupo) | terminó F3 | nada (murió, rc 129); `.salida.txt` sin rejilla | sí / no | — (al repetir lo detecta) |

Candados tras el corte: en todos los casos se soltaron con el fin de la transacción, 1,6–1,8 s después
del corte = lo que tardó en soltarse el candado ajeno + 0,05–0,2 s. Ventana de ACCESS EXCLUSIVE en esos
casos: 38–140 ms (más que en vacío porque mi sesión ajena dejó 247 filas muertas).

### Camino 4 — cliente CONGELADO
- **`docker pause` del contenedor de `psql`** (25 s) con el servidor a media F3: el servidor terminó F3
  0,1 s después de soltarse el candado ajeno; sin transacción abierta a 1,65 s del corte; la sesión
  quedó `idle` (sin transacción, sin candados) esperando al cliente. Al despausar, el guion leyó la
  rejilla, registró y siguió. ACCESS EXCLUSIVE: 45 ms.
- **Red congelada** (mi proxy deja de reenviar en los dos sentidos sin cerrar, 25 s, con 150 ms de
  retardo): igual. Sin transacción abierta a 1,61 s del corte; ACCESS EXCLUSIVE 31 ms; al descongelar,
  registrado.
- **Red congelada A MEDIA SUBIDA del archivo** (el proxy deja pasar sólo los primeros 60 000 bytes de
  la petición de F3 y se congela 30 s): la sesión queda `idle`, `Client/ClientRead`, **sin transacción
  y sin ningún candado** (a los 16 s y a los 30 s); F3 no aplicada. Al descongelar, se aplicó y registró.
- **¿Puede el servidor quedarse bloqueado ESCRIBIENDO al cliente con los candados tomados?** Medí lo
  que emite cada archivo antes de su `COMMIT`: 339–1 555 bytes (F4 el mayor). Cabe en cualquier búfer de
  socket (mínimo de Linux 4 096 bytes), así que no puede bloquearse ahí (DEDUCIDO de la cifra medida).
- **Respuesta:** los candados sobre `appointments` quedan retenidos lo que tarde el SERVIDOR (decenas de
  ms, o hasta 5 s si hace cola y aborta), nunca lo que dure la congelación. Los suelta el `COMMIT` (o el
  `ROLLBACK` por error/`lock_timeout`) que el servidor ejecuta solo porque ya tiene el archivo entero.
  `idle_in_transaction_session_timeout = 10s` no llegó a actuar en ninguna prueba (nunca hubo una
  transacción ociosa). Lo que NO pude ejecutar: Supavisor en medio (ver §6).
- Dato lateral: 10–22 s después de mis pruebas con UPDATE ajeno aparece un ACCESS EXCLUSIVE de 0–23 ms
  sobre `appointments` que NO es del guion: es autovacuum truncando (`last_autovacuum` coincide).

### Camino 6 — historial ilegible o inconsistente
- **Columna `version` renombrada:** `estado`, `aplicar`, `reversa` y `reversa-truncate` paran con
  «no pude LEER el historial … No sigo». Nada tocado. **Verdad; A2 (2.ª parte) se cumple.**
- **Tabla ausente:** también para con «no pude LEER» (`ERROR: relation … does not exist`). Es seguro,
  pero NO es lo que el guion documenta («vacío si la tabla no existe»): la guarda `to_regclass(...) is
  null` no evita que el analizador resuelva la tabla del subselect (hallazgo G6).
- **Aplicada sin registrar:** `aplicar` para («YA está aplicada … No la vuelvo a correr»). Bien.
- **Registrada sin aplicar** (fila de F3 en el historial sobre «4 aplicadas»): `estado` dice «ya
  registrada»; `aplicar` la SALTA sin mirar su testigo; aquí lo paró el pre-vuelo de F2 («falta
  appointments.reserva_canal»). Con la migración 1 registrada sin aplicar nada lo para: el guion aplicó
  las otras 8 y terminó con **«Las 9 aplicadas y registradas»** siendo falso (testigos `011111111`,
  historial `111111111`). Hallazgo G1.

### Camino 7 — la v2 ENCENDIDA al revertir
- **Encendida antes:** «previo: la v2 está ENCENDIDA en estas clínicas …: 1 … la cadena de reversas NO
  empieza … No se tocó nada». Testigos e historial intactos. **Verdad.** (Dice cuántas, no cuáles.)
- **Encendida ENTRE la comprobación previa y la primera reversa:** NADA lo vuelve a mirar (ninguna de
  las 7 reversas tiene esa guarda; sólo `reversa-previa.sql`). Ejecutado dos veces:
  (a) con una fila en `agenda_ajustes` y «PERDER DATOS» ya escrito: las 7 reversas corrieron con la v2
  encendida en una clínica (la última avisó «1 con la v2 encendida» y siguió);
  (b) sin datos en la previa: se deshicieron T, F5b, F4, F2, F3 y F5a con la v2 encendida y sólo F1 se
  negó («datos que la comprobación previa no vio»). Hallazgo G2.

### Camino 8 — reversas con datos
- **Sin confirmar** (otra cosa que «PERDER DATOS»): «parado antes de la primera reversa: no se tocó
  nada». Verdad (testigos/historial `111111111`).
- **Confirmando**, con datos plantados en 5 condiciones de 4 bloques (cita cerrada, aviso, bloqueo,
  horario revisado, huso de clínica): la previa las listó las 5 con su versión; cada reversa avisó de
  lo suyo con las mismas cuentas; 7 «✓»; quedan aplicadas y registradas sólo las dos de TRUNCATE.
- **Falla a mitad** (candado ajeno durante la 2.ª, F5b): T quedó deshecha y quitada del historial; de
  F5b: «FALLÓ … la migración SIGUE aplicada … la reversa no hizo nada». Verdad (`111111110` en los
  dos). Al repetir `reversa`: salta T («no está en el historial») y termina las 6 restantes. Un estado
  intermedio de la cadena queda coherente entre catálogo e historial.
- `reversa-truncate` después: las 2 deshechas (`000000000`); negada mientras T siga en el historial.
  Vuelta a aplicar las 9 después de todo: 9 «✓».
- Ventanas de las reversas (misma sonda): ACCESS EXCLUSIVE sobre `appointments` ≤ 13,5 ms sin retardo
  y ≤ 31 ms con 150 ms; lectura de citas más lenta 12,5 ms / 31,8 ms.

### Camino 9 — el respaldo que falla
`aplicar.sh respaldo` sin terminal (frase por stdin). Normal: `respaldo-<fecha>.dump.gpg` (600) + `.sha256`;
descifrado y leído con `pg_restore -l`: 97 `TABLE DATA`. Fallos provocados:

| Fallo | Qué dijo | ¿Queda algún `respaldo-*.dump.gpg` o `.parcial`? |
|---|---|---|
| `pg_dump` falla (`RESPALDO_EXTRA=--table=public.no_existe`) | «pg_dump o gpg fallaron (código 1) … NO hay respaldo» | no (sólo el `.log`) |
| frase vacía (gpg: `Invalid passphrase`) | ídem, código 2 | no |
| `pg_dump` muerto a medias (`docker kill`, por el proxy de 150 ms) | ídem, código 137 | no |
| `gpg` falso que escribe 5 000 bytes y sale con 2 | ídem, código 2 | no |

**A8: verdad.** No ejecutado: `kill -9` al propio guion a medio respaldo (DEDUCIDO: quedaría
`…dump.gpg.parcial`, que no tiene nombre de respaldo válido, sin `.sha256`).

### Camino 10 — la prueba de humo de `estado`
- El texto que manda es fijo: `BEGIN TRANSACTION READ ONLY`, ~104 KB de comentarios, dos `SELECT`,
  `COMMIT`. Ejecutado: «transacción de sólo lectura: on; identificador de escritura asignado: ninguno».
  No contiene ninguna escritura (leído) y la transacción no llegó a tener xid (ejecutado). Los tres
  `SET` de sesión que van delante no escriben. **No puede escribir.**
- Destino que rechaza la petición grande (mi proxy corta la conexión al pasar de 60 000 bytes): «server
  closed the connection unexpectedly … ⚠️ NO aceptada … No apliques hasta saber por qué». Verdad. Pero
  `estado` sale con **rc 0**, y `aplicar` (que llama a `estado`) **sigue** y ofrece la primera migración:
  ejecutado, llegó a F3, que falló limpia («NO quedó aplicada»; testigos/historial `111100000`). Hallazgo G3.

### Camino 11 — repetir
- `aplicar` sobre las 9 ya aplicadas: 9 «se salta», «Las 9 aplicadas y registradas», nada cambia.
- Repetir tras cada fallo: tras 1a/1b vuelve a intentarla; tras 2a/2b/3 (aplicada sin registrar) se
  niega a correrla; tras 6 (historial ilegible) no hace nada; tras una reversa a medias (8) sigue donde
  quedó. En ningún caso ejecutado aplicó dos veces un archivo ni dejó el historial por delante del
  catálogo. **La excepción es la inversa:** historial por delante del catálogo de antemano (G1).
- Dos `aplicar` A LA VEZ desde cero: uno terminó las 9; el otro paró en la 2.ª con «FALLÓ DESPUÉS de su
  COMMIT … NO se registró» (no es exacto: la había confirmado y registrado el otro). La migración 1 la
  corrieron los dos (es reentrante). Estado final coherente: 14 versiones, 9 testigos. NOTA G9.

### Camino 12 — lo que se me ocurrió
- **Rutas con espacios** (copia del árbol en `…/copia con espacios/repo`, destino con espacios): aplicó y
  registró bien.
- **Archivo alterado** (un espacio añadido a F1; a una reversa): «la huella … no es la de
  huellas.sha256»; nada corrido. `reversa-previa.sql` y el propio `aplicar.sh` NO están en
  `huellas.sha256` (NOTA G10).
- **Contraseña** (una inventada, distinta del usuario): 0 apariciones en las salidas del guion, 0 en la
  carpeta de registros, 0 en ~19 800 líneas de `ps -eo args` muestreadas durante `aplicar`, `respaldo`,
  un `estado` con contraseña mala y un registro fallido. Sí aparece en `docker inspect` de cada
  contenedor efímero mientras vive (`Config.Env`), visible para quien tenga acceso a Docker (NOTA G11).
  Con contraseña mala: «password authentication failed … ALTO: no puedo conectar», sin eco.
- **Destino:** `127.0.0.1` a través de mi proxy se trata como ENSAYO sin más pregunta: un túnel o
  reenvío local hacia otra base pasaría por ensayo (NOTA G12). Hosts no locales: **no ejecutado** (el
  sistema de permisos me lo denegó, con razón: `APL_HOST` vacío cae en el pooler de producción).
  DEDUCIDO de `aplicar.sh:124-132`: todo lo que no sea literalmente `127.0.0.1`, `localhost` o `::1`
  exige escribir `PRODUCCION` antes de pedir la contraseña.
- **Otro usuario** (`APL_USUARIO=supabase_admin`, superusuario del clon): aplicó la migración 1 sin
  avisar de que no es `postgres` (las que lo exigen lo comprueban en su pre-vuelo; NOTA).
- **Las reversas no miran REVISAR:** `revertir_una` no busca filas REVISAR en la rejilla de una reversa
  (dos reversas pueden darla); imprime «✓» igual. DEDUCIDO de `aplicar.sh:367-384` (G8).

## 4. Las afirmaciones

| | Veredicto | Evidencia |
|---|---|---|
| **A1** un archivo = una petición; sin viajes entre el primer candado fuerte y el COMMIT; un corte no retiene candados | **VERDAD** | 3 peticiones por sesión de archivo en el registro del servidor (las 9 + 2 de humo); ventana ≤ 47 ms igual con 0, 50 y 150 ms; kill, pausa y red congelada: candados sueltos al terminar el servidor (≤ 0,2 s tras quedar libre el candado ajeno); congelado a media subida: sin transacción ni candados |
| **A2** tras un fallo pregunta al catálogo y dice la verdad; un fallo al leer el historial no cuenta como «no registrada» | **VERDAD**, con dos matices | caminos 1, 2, 3, 6. Matices: `estado` llama «pendiente» a una aplicada sin registrar (G4); una REGISTRADA sin aplicar se salta sin mirar el testigo (G1) |
| **A5** la cadena no empieza si alguna se va a negar ni con la v2 encendida; mismas condiciones que las guardas | **VERDAD al empezar; no se sostiene durante la cadena** | 7a, 8a, 8b ejecutados. Comparación una a una (leída; 5 condiciones además ejecutadas): F5b 1/1, F4 4/4 tablas + rol, F2 3 tablas + columna, F3 5 tablas + 3 columnas, F5a 1/1, F1 6/6 + los dos del respaldo; T no tiene guarda de datos. Las dos de TRUNCATE no pasan por la previa (sus guardas son de orden y de dueño). La de «v2 encendida» NO es guarda de ninguna reversa: sólo la mira la previa, una vez (G2). Las guardas de ORDEN (F5a: «funciones todavía nombran agenda_bloqueos»; F3: «sigue F2»; F1: «quedan objetos…») no están en la previa: con el historial coherente el orden las cumple; con una versión aplicada y no registrada la cadena se la salta y se rompe a mitad (DEDUCIDO) |
| **A8** un respaldo fallido no deja archivo con nombre válido | **VERDAD** | camino 9, cuatro fallos |
| **A15** la confirmación de pérdida no sobrevive a su petición | **VERDAD** | misma conexión, después del COMMIT de dos reversas confirmadas: `current_setting('spinus.reversa_con_datos', true)` = vacío, sin transacción; tras una reversa fallida + ROLLBACK: vacío; la siguiente reversa con datos, sin confirmación, en esa conexión: «REVERSA ABORTADA». (`aud2-trabajo/a15.sh`) |
| **A16** no muere en silencio cuando un `grep` no deja pasar nada | **VERDAD** | `registrar` con un `npx` falso que sólo emite las dos líneas filtradas, y con uno mudo: el guion siguió y dijo «se aplicó pero no quedó en el historial». Resto de tuberías, leídas una a una (líneas 211-212, 239, 258-260, 267-268, 288, 295-299, 311, 341-344, 376, 391-399, 445-450, 464-465): todas tienen `|| true`, van en condición, o su fallo es el que debe parar; `(( b > mayor )) && …` (222-223) no dispara `set -e` (ejecutado en cada `estado`) |

## 5. Hallazgos nuevos (del más grave al más leve)

Ninguno BLOQUEANTE ni GRAVE.

**G1 · MEDIO · `aplicar.sh:330` (y `:260`, `:354`) — una versión REGISTRADA pero NO aplicada se salta
sin mirar su testigo, y el guion termina diciendo «Las 9 aplicadas y registradas».**
Reproducción: base sembrada sin aplicar; `insert into supabase_migrations.schema_migrations(version,name)
values ('20261125170000','audit_log_sin_truncate')`; `aplicar.sh aplicar` con las otras 8
confirmaciones → rc 0, «Las 9 aplicadas y registradas», y `prevent_audit_truncate` no existe (testigos
`011111111`). Con F3 registrada sin aplicar lo paró el pre-vuelo de F2, no el guion.
Daño: se llega a este estado con un `migration repair --status applied <versión>` a mano con la versión
equivocada (el plan §8 manda hacerlo a mano en «aplicada sin registrar») o con una reversa a mano sin
reparar. El hueco de TRUNCATE sobre `audit_log` (o la protección que tocara) queda abierto con el guion
en verde; sólo lo vería la comprobación posterior del catálogo.
Criterio: para cada una de las 9, historial y testigo deben coincidir antes de saltarla y antes del
mensaje final; si no coinciden, el guion se detiene diciéndolo. `estado` debe enseñar las dos columnas.

**G2 · MEDIO · `aplicar.sh:416-421` y `reversa-previa.sql` — «la v2 apagada en todas» se comprueba UNA
vez, antes de la primera reversa; nada lo vuelve a mirar.**
Reproducción (`carrera.sh 7c`): las 9 aplicadas, sin filas en `agenda_ajustes`; `aplicar.sh reversa`;
cuando pide «REVERTIR 20261201180000», en otra sesión: insertar una fila en `agenda_ajustes` y ponerle
`agenda_v2_encendida = true`; contestar las 7 confirmaciones → se deshacen T, F5b, F4, F2, F3 y F5a con
la v2 encendida; F1 se niega. Variante con «PERDER DATOS» ya escrito (`carrera7b.sh`): se deshacen las 7.
Daño: la clínica encendida se queda con la agenda rota (lo que el propio plan §10 describe) a media
cadena. Hoy el interruptor sólo lo cambia `postgres`/`supabase_admin`, y entre la previa y la última
reversa pasan las 7 confirmaciones tecleadas (minutos): la ventana es humana, no de milisegundos.
Criterio: la condición «ninguna clínica con la v2 encendida» debe evaluarse en la MISMA transacción de
cada reversa que la necesita (o, como mínimo, justo antes de cada una), no sólo al principio.

**G3 · MEDIO · `aplicar.sh:237-244`, `:352` — si la prueba de humo falla, `estado` sale con 0 y `aplicar`
continúa.**
Reproducción: proxy que corta la conexión al pasar una petición de 60 000 bytes; `aplicar.sh aplicar` →
«⚠️ NO aceptada … No apliques hasta saber por qué» y, acto seguido, pide la versión de la siguiente
migración; las que caben se aplican y la primera que no cabe falla.
Daño: ninguno sobre los datos (cada prefijo es coherente y el fallo es limpio), pero el día de
producción dejaría el conjunto a medias —las pequeñas sí, F3/F2/F4 no— justo en el caso que la prueba
existe para evitar.
Criterio: un humo rechazado debe impedir que `aplicar` ofrezca ninguna migración (o exigir una
confirmación expresa), y `estado` debe salir ≠ 0.

**G4 · LEVE · `aplicar.sh:259-261` — `estado` dice «pendiente» de una migración aplicada sin registrar.**
Reproducción: 2a. El plan §8 («no lo sé») manda correr `estado` para decidir. Criterio: `estado` enseña
el testigo junto al historial.

**G5 · LEVE · cola de 5 s sobre `appointments` cuando F3/F2/F5b encuentran un lector con transacción
abierta (medido: lectura más lenta 5 000 ms; §2).** No es un defecto del guion sino del `lock_timeout`
de 5 s en cola; lo apunto porque es la única ventana de segundos que medí y un rol con
`statement_timeout` de 3 s fallaría en ella. Criterio: que el plan lo diga con esta cifra y que
«repetir» no se haga en bucle (cada intento son otros 5 s de agenda parada).

**G6 · LEVE · `aplicar.sh:154-158`, `:256` — con la tabla del historial ausente, `registradas` no
devuelve vacío: falla** (`relation … does not exist`; la guarda `to_regclass` no evita el análisis del
subselect). El guion para («no pude LEER»), que es seguro, pero el comentario, el mensaje «vacío o NO
EXISTE la tabla» y la rama `SEGUIR` son inalcanzables para ese caso. Reproducción: 6b. Criterio: o se
documenta que sin tabla el guion no arranca, o la consulta no nombra la tabla cuando no existe.

**G7 · LEVE · `aplicar.sh:295-298` — el `ERROR` de psql sale ANTES que los resultados de la misma
petición** (stderr sin búfer, stdout con búfer al no haber terminal dentro del contenedor). Reproducción:
1a: `ERROR: canceling statement due to lock timeout` aparece encima de `BEGIN / SET / CREATE TABLE…`, y
lo último antes del «ALTO … (ver arriba)» son órdenes que parecen haber salido bien. Criterio: que el
error sea lo último que se lee, o que el «ALTO» lo repita.

**G8 · LEVE · `aplicar.sh:367-384` — las reversas no miran filas REVISAR de su rejilla** (la ida sí).
DEDUCIDO. Criterio: mismo trato que en la ida.

**G9 · NOTA** — dos `aplicar` simultáneos: estado final correcto, mensaje del perdedor inexacto.
**G10 · NOTA** — `reversa-previa.sql` y `aplicar.sh` no tienen huella en `huellas.sha256`.
**G11 · NOTA** — la contraseña es legible con `docker inspect` mientras vive cada contenedor efímero.
**G12 · NOTA** — un `127.0.0.1` que sea un túnel hacia otra base se trata como ensayo.
**G13 · NOTA** — el mensaje de la v2 encendida dice cuántas clínicas, no cuáles.

## 6. Lo que NO pude ejecutar

- **El pooler real (Supavisor) y la red real.** Todo es contra Postgres directo o por mi proxy. No sé qué
  hace Supavisor con una petición de 104 KB, con un cliente que muere o se congela, ni si limpia la
  sesión al reutilizarla. La prueba de humo de `estado` es lo que lo dirá el día.
- **Con terminal:** `read -rs`, el aviso de `PRODUCCION` y el `gpg` con pinentry. Todo fue por stdin.
- **Hosts no locales** (denegado por permisos; ver camino 12).
- **Historial sin permiso de lectura:** `postgres` conservó el acceso al esquema tras mi `REVOKE`; lo
  sustituí por columna renombrada y tabla ausente.
- **`kill -9` al guion durante `respaldo`**, y el servidor bloqueado al escribir al cliente (sólo medí que
  no hay salida suficiente para que ocurra).
- **Guardas de datos de F2 y F3 con filas reales** (las restricciones no me dejaron plantarlas); esas dos
  comparaciones de A5 son leídas.
- **Tamaños mayores:** sólo el tamaño real (247 citas).
- No volví a auditar el SQL. Al ejecutarlo no vi nada mal en él.

## 7. Veredicto

**No hay nada que impida usar este guion contra producción;** G1, G2 y G3 conviene cerrarlos antes
porque son los tres casos en que el guion sigue adelante (o dice «todo bien») cuando debería pararse.

Contenedor `clon-spinus-aud2-1` borrado; repo sin cambios; proxies parados.
