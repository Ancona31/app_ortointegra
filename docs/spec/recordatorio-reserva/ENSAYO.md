# R1 · el recordatorio tras el comprobante — guion de ensayo y aplicación

> Rama `feature/recordatorio-reserva` (nacida de `main` en `148de519`). Escrito el 2026-11-26.
> **R1 se aplicó en producción el 2026-11-26 (22:13, Mérida) desde `b0d9d21e`. R2 (§8) está sin
> aplicar.** Lo aplica Angel, con `aplicar.sh`, tras las cuatro
> cosas de siempre: ensayo sobre el clon de estructura, auditoría (`supabase/AUDITORIA-MIGRACIONES.md`),
> conteos de sólo lectura y su orden explícita.

## 0. El defecto, en una línea

Una cita reservada por enlace con MÁS antelación que la ventana del recordatorio no recibía nunca el
recordatorio: `cita_correo_tomar` y `cita_recordatorios_pendientes` (F4) lo saltaban si había un
comprobante `enviado` para ese inicio, sin mirar cuándo salió. Caso real: reserva del 25-nov 17:53
para el 26-nov 09:00, recordatorio a 2 h; salió el comprobante y nada más.

R1 (`20261207120000_recordatorio_tras_comprobante`) deja la regla que estaba escrita: el comprobante
sólo quita el recordatorio si salió **ya dentro de la ventana** del recordatorio de esa cita
(`coalesce(enviado_en, tomado_en) >= inicio − recordatorio_horas`), la misma condición en las dos
funciones.

## 1. Huellas

```
28cddd5190361c1ee5ecdce867873cdb56ce1b449dc5a05ebfb413147d99c15d  supabase/migrations/20261207120000_recordatorio_tras_comprobante.sql
4cdd006364583128dfe0566aa96073699756a45824fb67e6a63d048e7e0dfd68  supabase/reversas/20261207120000_recordatorio_tras_comprobante_reversa.sql
```

Están en `supabase/produccion/plan/huellas.sha256` (33 líneas). Desde la raíz:
`sha256sum -c supabase/produccion/plan/huellas.sha256` → todo `OK`.

## 2. Orden respecto al código

**R1 no depende del código: puede ir antes o después del despliegue.** Lo que arregla el defecto es
la migración sola. El código de esta rama sólo cambia la pantalla (el recordatorio se elige en horas,
libre) y no llama a nada nuevo de la base.

## 3. Conteos de sólo lectura (en PRODUCCIÓN, antes de aplicar; los corre Angel)

```
bash supabase/produccion/conteos/correr-conteos-recordatorio-reserva.sh
```

| Fila | Qué dice | Valor en producción |
|---|---|---|
| R.1–R.3 | rol, las 15 anteriores en el historial, R1 sin registrar | _(pendiente; esperado OK)_ |
| R.4, R.5 | huellas md5 de las dos funciones de F4 (las exige el pre-vuelo) | _(pendiente; esperado OK)_ |
| R.6, R.7 | INVOKER, sólo `service_role`, dueño; columnas de `cita_correos` | _(pendiente; esperado OK)_ |
| R.8 | clínicas con el recordatorio encendido, y a cuántas horas | _(pendiente)_ |
| **R.9** | **citas futuras hoy sin recordatorio por el defecto, que lo recibirán tras aplicar** | _(pendiente)_ |
| R.10 | de ésas, las que la tarea manda en su primera pasada (ya están en su ventana) | _(pendiente)_ |
| R.11 | citas con comprobante ya dentro de su ventana: siguen recibiendo uno, a propósito | _(pendiente)_ |
| R.12 | citas de los últimos 7 días que se quedaron sin recordatorio (no se recuperan) | _(pendiente)_ |
| R.13 | clínicas con `recordatorio_horas = 1` (ventana vacía, §5) | _(pendiente; esperado 0 / 0)_ |

Un ALTO en R.4 o R.5 significa que el cuerpo de producción no es el de F4: R1 abortaría limpia.

## 4. El ensayo (sobre el clon de estructura) y la aplicación

1. `bash supabase/produccion/plan/aplicar.sh estado` → las 15 anteriores «aplicada y registrada» y
   `20261207120000_recordatorio_tras_comprobante` «pendiente».
2. `bash supabase/produccion/plan/aplicar.sh aplicar` → ofrece sólo R1; se confirma escribiendo
   `20261207120000`. Rejilla esperada (6 filas):

   | n | comprobación | esperado |
   |---|---|---|
   | 1 | `cita_correo_tomar`: INVOKER, `search_path` vacío, condición nueva; anon/authenticated/service_role | `true ; false/false/true` · OK |
   | 2 | `cita_recordatorios_pendientes`: lo mismo, y STABLE | `true ; false/false/true` · OK |
   | 3 | ninguna conserva el cuerpo de F4 | `0` · OK |
   | 4 | dueño de las dos | `postgres` · OK |
   | 5 | ANTES: citas futuras con comprobante de antes de su ventana y sin recordatorio | INFO |
   | 6 | de ésas, las que la tarea tomará en su siguiente pasada | INFO |

   Termina con «Las 16 aplicadas y registradas».
3. Segunda pasada de `aplicar`: no ofrece nada. El archivo a mano abortaría con «PRE-VUELO FALLÓ: esta
   migración ya está aplicada».
4. Prueba: `supabase/pruebas-sql/r1_recordatorio_tras_comprobante.sql` (con `scripts/pruebas-sql.sh`;
   crea sus datos y termina en `rollback`).

**Qué se nota al aplicar:** en su siguiente pasada (cada 15 min) la tarea manda el recordatorio de las
citas de R.10. A las que les falta menos de 1 h ya no les llega (regla de F4, sin cambio).

**Deshacer** (sólo con orden de Angel): `aplicar.sh reversa` ofrece primero la de R1; se confirma con
`REVERTIR 20261207120000` y se para en la siguiente. Devuelve las dos funciones al cuerpo de F4 (lo
comprueba por huella) y vuelve el defecto. Como toda reversa del guion, exige la v2 apagada en todas
las clínicas; a mano, el archivo de la reversa no lo exige ni toca filas.

## 5. Con el recordatorio a 1 hora no salía ninguno (DECIDIDO: opción B, ver §8)

El listado y la toma exigen `inicio > ahora + 1 h` e `inicio <= ahora + recordatorio_horas`. Con
`recordatorio_horas = 1` las dos condiciones no se cumplen nunca a la vez: **la ventana está vacía**.
La base admite de 1 a 72 (`agenda_ajustes_recordatorio_rango`) y, desde este cambio, la pantalla
también deja escribir 1. NO se ha decidido nada en esta rama; opciones:

* **A (recomendada): mínimo de 2 h en la pantalla y en la validación del servidor**
  (`LIMITES_AJUSTES_AGENDA.recordatorio_horas.min = 2`), sin tocar la base. Un cambio de una línea y
  sus pruebas. Si R.13 no da `0 / 0`, antes hay que subir esas filas a 2 (el PUT de ajustes valida los
  cuatro campos juntos y esa clínica no podría guardar ningún plazo).
* A-bis: lo mismo y además el CHECK de la base a 2–72, en otra migración. Más seguro frente a quien
  escriba por SQL; pide su ensayo.
* B: bajar el piso de «falta más de 1 h» (por ejemplo a 30 min). Cambia las dos funciones otra vez y
  manda recordatorios cuando ya no se puede cancelar por el enlace (el plazo de cancelar es de 1 h).
  No se recomienda.

## 6. Casos borde revisados

* **Cita movida:** la llave de `cita_correos` lleva `inicio_cita`. El comprobante del inicio viejo no
  cuenta para el nuevo, como antes de R1 (caso 6 de la prueba).
* **`recordatorio_horas` cambia entre el comprobante y el recordatorio:** se juzga con el valor
  vigente cuando corre la tarea. Ampliado (2 → 24) y el comprobante cae dentro de la ventana nueva: no
  sale recordatorio. Acortado: sale (caso 5).
* **Comprobante minutos antes de la ventana** (reserva a 2 h 05 con ventana de 2 h): recibe los dos
  correos con minutos de diferencia. Es lo que dice la regla; no se le puso margen. Si se quiere uno,
  es un número más en la misma condición (decisión de Angel).
* **Comprobante «enviando»** (a medias): quita el recordatorio sólo si se tomó hace menos de 10 min
  **y** dentro de la ventana; uno colgado de antes de la ventana ya no lo quita (caso 4).
* **Comprobante fallido:** no quitaba el recordatorio antes y sigue sin quitarlo.
* **Correo de confirmación manual** (`tipo = 'confirmacion'`): nunca quitó el recordatorio; sin cambio.

## 7. Lo que se comprobó en local y lo que no

Comprobado (stack local, CLI 2.117.0, las 20 de `main` + R1): ida, segunda pasada (aborta), reversa
(huellas de F4 de vuelta) e ida otra vez, a mano y con `aplicar.sh` en modo ensayo; prueba SQL con su
mutación en rojo (con los cuerpos de F4 falla el caso 1); batería SQL (57 archivos); conteos corridos
contra la base local.

NO comprobado: nada contra producción ni contra el clon de estructura. Las huellas md5 de las dos
funciones se leyeron en local (cuerpos de F4 del repo): que producción tenga las mismas lo dicen R.4 y
R.5. Los números de R.8 a R.13 sólo los da producción.

## 8. R2 · el piso del recordatorio baja de 1 hora a 30 minutos

> Decisión de Angel (2026-11-26): la opción B del §5. `recordatorio_horas` sigue en horas enteras, de
> 1 a 72; la pantalla no cambia. También decidió dejar sin margen el caso de la reserva hecha minutos
> antes de la ventana (§6): recibe los dos correos.

`20261208120000_recordatorio_piso_30_min` reescribe `cita_correo_tomar` y
`cita_recordatorios_pendientes` con el cuerpo de R1 cambiando un literal en cada una
(`interval '1 hour'` → `interval '30 minutes'`; en la toma, sólo la rama del recordatorio). Añade el
`COMMENT ON FUNCTION` con el convenio «van juntas» (destinatario, piso y condición del comprobante).
No toca filas. **No depende del código: puede ir antes o después del despliegue** (esta rama no trae
código nuevo para R2).

### 8.1 Huellas

```
cc06296fcb458edd5965845e972536f3bff6e69aa92c61f5bfa46321c3b183c4  supabase/migrations/20261208120000_recordatorio_piso_30_min.sql
039bcdec65ea1b6fe20db54820cf752a87bad568bb11d597f7b97668d0e84fab  supabase/reversas/20261208120000_recordatorio_piso_30_min_reversa.sql
```

En `supabase/produccion/plan/huellas.sha256` (35 líneas; `sha256sum -c` desde la raíz, todo `OK`).
El pre-vuelo exige las huellas md5 de los cuerpos de R1: `0339111d435e4592acb45261bd412f84`
(`cita_correo_tomar`) y `dee6e983be793c1145b8c56bcb89937f` (`cita_recordatorios_pendientes`).

### 8.2 Conteos, ensayo y reversa

* Conteos (sólo lectura, los corre Angel): `bash supabase/produccion/conteos/correr-conteos-recordatorio-piso.sh`.

  | Fila | Qué dice | Valor en producción |
  |---|---|---|
  | P.1–P.3 | rol, las 16 anteriores en el historial, R2 sin registrar | _(pendiente; esperado OK)_ |
  | P.4, P.5 | huellas md5 de los cuerpos de R1 (las exige el pre-vuelo) | _(pendiente; esperado OK)_ |
  | P.6 | INVOKER, sólo `service_role`, dueño | _(pendiente; esperado OK)_ |
  | P.7 | clínicas con el recordatorio encendido, y a cuántas horas | _(pendiente)_ |
  | P.8 | clínicas con el recordatorio a 1 hora (hoy no les sale ninguno) | _(pendiente)_ |
  | P.9 | citas a las que ahora faltan entre 30 y 60 min, en ventana y sin recordatorio | _(pendiente)_ |
  | P.10 | recordatorios enviados en los últimos 7 días | _(pendiente)_ |

* `aplicar.sh estado` → R2 «pendiente»; `aplicar.sh aplicar` la ofrece sola (confirmar con
  `20261208120000`). Rejilla de 7 filas: 1–5 `OK` (las dos funciones con el piso de 30 min y sin
  `1 hour`, INVOKER, sólo `service_role`; las dos con la condición de R1; ninguna con el cuerpo de R1;
  dueño `postgres`), 6–7 `INFO`. Termina con «Las 17 aplicadas y registradas».
* Prueba: `supabase/pruebas-sql/r2_recordatorio_piso_30_min.sql` (citas a 45, 31, 30, 29, 61, 119 y
  121 min con ventana de 1 h y de 2 h).
* Reversa (sólo con orden de Angel): la primera de `aplicar.sh reversa` (`REVERTIR 20261208120000`,
  y parar en la siguiente). Devuelve los cuerpos de R1 por huella y los comentarios de antes.

### 8.3 Qué más depende de «1 hora» (revisado en el código; NADA de esto se cambió)

| Qué | Dónde | Tras R2 |
|---|---|---|
| Plazo para **cancelar** por el enlace del correo | `cita_confirmacion_contexto` (`puede_cancelar`, `corte_cancelar`) y `cita_confirmacion_responder` (`fuera_de_plazo`): `supabase/migrations/20261201160000_agenda_f4_confirmacion_correos_avisos.sql:600-601` y `:668` | **Sigue en 1 hora.** |
| **Confirmar** por el enlace | misma función, `:657-666`: hasta la hora de la cita (`pasada` si ya empezó) | Sin plazo de 1 h: sigue sirviendo. |
| Texto del correo (recordatorio, confirmación y aviso de cambio comparten cuerpo) | `src/lib/confirmacion/correosCita.ts:57` (`PLAZO_CANCELAR = '1 hora'`), `:103` y `:105` | Sigue diciendo «hasta 1 hora antes de tu cita». |
| Página del enlace cuando ya no se puede cancelar | `src/app/confirmar/[codigo]/page.tsx:129-132` | Ya lo resuelve: quita el botón y dice «Ya no es posible cancelar desde el enlace; comunícate…». |
| El «No» de Google | `cita_rsvp_google_rechazo`, `supabase/migrations/20261202130000_avisos_globales_rsvp_rechazo.sql:142`; comentarios en `src/lib/gcalRsvpRechazo.ts:7-10`, `src/lib/gcalRsvp.ts:47`, `src/lib/gcalSincronizacionBase.ts:338-339`, `src/lib/gcalSincronizacion.ts:340`, `src/lib/avisos/avisosClinica.ts:235` | Independiente del recordatorio: cancela con más de 1 h; en la última hora sólo avisa. Sin cambio. |
| Cambiar la cita por el enlace (reagendar) | `reagendar_por_enlace` / `cita_reagendar_oferta` (F4) | Sólo se ofrece DESPUÉS de cancelar por el enlace (`cita_reagendar_oferta`, `:692-733`: respuesta `cancelo`, hasta 7 días después), así que hereda el plazo de cancelar de 1 hora; el turno nuevo va por las reglas de la reserva (anticipación mínima de la clínica, F3 `:1159`). No usa el piso del recordatorio. Sin cambio. |
| La tarea | `vercel.json` (`/api/cron/recordatorios`, cada 15 min) | Con el recordatorio a 1 hora la ventana dura 30 min: caben dos pasadas. |
| Pruebas que afirmaban el piso | `supabase/pruebas-sql/e4_correos_cita.sql` (la cita 4, «menos de 1 h») | Adaptada: ahora a 20 min, «menos de 30 min». |
| Conteos y rejilla de R1 | `conteos-recordatorio-reserva.sql` (R.9–R.13) y la fila 5 de la rejilla de R1 | Cuentan «a más de 1 h»: son de antes de R2 y no se tocan (R1 ya está aplicada). |

### 8.4 PARA DECIDIR ANGEL: el recordatorio de la última hora promete un botón que ya no cancela

Un recordatorio que sale cuando faltan entre 60 y 30 minutos (siempre, con el recordatorio a 1 hora; a
veces, con más horas: citas reservadas o movidas tarde) lleva los dos botones de siempre:

* «Confirmo mi asistencia»: funciona.
* «No podré asistir», con la nota «Puedes cancelar con este botón hasta 1 hora antes de tu cita.»: a
  esa hora **ya no cancela**. La nota es literalmente cierta y la página lo explica («Ya no es posible
  cancelar desde el enlace», con el teléfono), pero el correo ofrece un botón que nace caducado.

No se cambió nada. Propuesta mínima, de menor a mayor:

1. **(Recomendada)** Sólo el correo: cuando el recordatorio se compone con menos de 1 hora para la
   cita, no pintar «No podré asistir» ni su nota, y dejar la línea del teléfono como «Si no puedes
   asistir, llámanos al …». Un cambio en `bloquesCita`/`botonesCita` de `correosCita.ts` (el
   recordatorio ya recibe `inicio`; hay que pasarle el instante del envío) y sus pruebas. Sin migración.
2. Bajar también a 30 minutos el plazo de cancelar por el enlace (`cita_confirmacion_contexto`,
   `cita_confirmacion_responder` y `PLAZO_CANCELAR`): otra migración sobre dos funciones de F4, y la
   clínica se entera de la cancelación con media hora. Cambia una regla que Angel fijó (AG-DT-249).
3. Dejarlo como está: el correo no miente, pero el botón no sirve.

### 8.5 Lo que se comprobó en local y lo que no (R2)

Comprobado (stack local, las 21 anteriores + R2): ida, segunda pasada (aborta), reversa (huellas de R1
de vuelta) e ida otra vez, a mano y con `aplicar.sh` en modo ensayo («Las 17 aplicadas y
registradas»); prueba SQL con su mutación en rojo (con los cuerpos de R1, a 1 hora no sale ninguna);
batería SQL (58 archivos); conteos contra la base local.

NO comprobado: nada contra producción ni el clon. Las huellas md5 de R1 son las de mi local (cuerpos
del repo): que producción tenga las mismas lo dicen P.4 y P.5. Los números de P.7 a P.10 sólo los da
producción. No hay e2e de navegador para el recordatorio a menos de 1 hora (la regla está en SQL).

