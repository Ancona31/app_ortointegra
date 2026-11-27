# R1 · el recordatorio tras el comprobante — guion de ensayo y aplicación

> Rama `feature/recordatorio-reserva` (nacida de `main` en `148de519`). Escrito el 2026-11-26.
> **R1 se aplicó en producción el 2026-11-26 (22:13, Mérida) desde `b0d9d21e`.** Lo aplica Angel, con `aplicar.sh`, tras las cuatro
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

## 5. Con el recordatorio a 1 hora no sale ninguno — DECIDIDO: opción A (mínimo de 2 horas)

> **Decisión de Angel (2026-11-27): la opción A.** `LIMITES_AJUSTES_AGENDA.recordatorio_horas.min = 2`
> (`src/lib/agenda/ajustesAgenda.ts`): la pantalla (también el asistente de la primera vez, que usa el
> mismo campo) y el `PUT /api/me/ajustes-agenda` rechazan 1; la base no se toca (sigue admitiendo
> 1–72). El conteo R.13 en producción dio `0 / 0`: no había filas que subir.
> Antes eligió la B (bajar el piso a 30 minutos) y la CANCELÓ el mismo día: la migración
> `20261208120000_recordatorio_piso_30_min` se escribió, se empujó (`8534049f`) y se revirtió con un
> commit de reversión; no existe en el repositorio ni se aplicó en ningún sitio que no fuera la base
> local, donde también se deshizo. Lo de abajo es el planteamiento original.


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
