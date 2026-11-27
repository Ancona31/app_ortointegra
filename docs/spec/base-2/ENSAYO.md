# BASE-2 — guion de ensayo y aplicación (B1, B2 y B3)

> Rama `feature/agenda-para-todos`, encima de `43ea6dc2`. Escrito el 2026-11-27.
> **Sin aplicar en producción.** Lo aplica Angel, con `aplicar.sh`, tras las cuatro cosas de siempre: ensayo
> sobre el clon de estructura, auditoría (`supabase/AUDITORIA-MIGRACIONES.md`), conteos de sólo lectura y su
> orden explícita. Tres migraciones, UN ensayo y UNA sesión de aplicación.

## 0. Qué es

| | Migración | Qué hace | Filas |
|---|---|---|---|
| **B1** | `20261208120000_gcal_quitar_cancelada` | Función nueva `gcal_cita_quitar_cancelada`: cierra y desvincula, en una sentencia, la cita CANCELADA cuyo evento se borró en Google. La sincronización deja de tener consultas directas a tablas. | No toca |
| **B2** | `20261208130000_lotes_sin_reejecucion` | `reserva_purgar` (M4) y `reserva_empalmes_pendientes_procesar` (M5): el lote vuelve a ser un tope. Informe: `INFORME-LOTES.md`. | No toca |
| **B3** | `20261208140000_avisos_y_correos_cierre_bajos` | Hallazgos bajos: MA 1 (lectura fresca de `pg_stat_activity`), MA 2 (la sesión ya no puede llamar a `avisos_transaccion_mas_antigua`), MA 3 (se documenta) y los comentarios «van juntas» de R1. | No toca |

Ninguna cambia tablas, columnas, policies ni datos. Las tres son `CREATE [OR REPLACE] FUNCTION`, un
`ALTER FUNCTION`, un `REVOKE` y comentarios.

## 1. Huellas

```
6b9dc1166ddeecdde5d451e1e0333a4ed41962b09824a169830eb9b2c316ab41  supabase/migrations/20261208120000_gcal_quitar_cancelada.sql
435580c6911fc24a7a82bc22249c1000b7d1c0ff7f8144ff1c8f83b7b49f833f  supabase/migrations/20261208130000_lotes_sin_reejecucion.sql
8f373222e7d3b96610212b6647ec99dc8c7b59183f3ceae3af49c653d65bc42f  supabase/migrations/20261208140000_avisos_y_correos_cierre_bajos.sql
1a18e1dcae3209f3fce427e5497da7f212e5e47823764ecd0d8c28f1f8296db6  supabase/reversas/20261208120000_gcal_quitar_cancelada_reversa.sql
9d0e1bca989369cdc7aae8b9ab0af23bb05bd4b18796003289fc1a3cd78408ba  supabase/reversas/20261208130000_lotes_sin_reejecucion_reversa.sql
0a7102b46864b1240b9af76190959665d4f89abdb0cd7368c30a957d2f1663b1  supabase/reversas/20261208140000_avisos_y_correos_cierre_bajos_reversa.sql
```

Están en `supabase/produccion/plan/huellas.sha256` (39 líneas). Desde la raíz:
`sha256sum -c supabase/produccion/plan/huellas.sha256` → todo `OK`.

## 2. Qué cambia para quien usa la app

- **B1:** nada a la vista. Lo de antes (commit `d08ad0a3`): borrar en Google el evento de una cita cancelada
  la quita de la agenda. Ahora en un paso de la base en vez de dos.
- **B2:** nada a la vista.
- **B3:** nada a la vista. «Marcar todos como revisados» hace lo mismo.

## 3. Orden respecto al código — ⚠️ B1 VA ANTES QUE EL CÓDIGO

El código de esta rama llama a `gcal_cita_quitar_cancelada`. B2 y B3 no dependen del código.

| Orden | Qué pasa |
|---|---|
| **Migración B1 primero, código después (el correcto)** | Entre una y otro no pasa nada: nadie llama a la función. El código en producción (el de `d08ad0a3`: cierre directo + `gcal_aplicar_evento`) sigue funcionando igual, porque B1 no cambia nada de lo que usa. |
| **Código primero, B1 después** | Mientras falte la función, cada vez que Google informe del borrado del evento de una cita cancelada, ese evento cuenta como **error** de la pasada (queda en el registro: «evento sin aplicar»), la cita **no** se quita ni se desvincula y la página **sí** avanza. Es decir: ese borrado se pierde (Google no lo vuelve a informar) y la cita se queda en la agenda, cancelada y ligada a un evento que ya no existe, hasta que alguien pulse «Eliminar cita». No se daña ningún dato y el resto de la sincronización sigue. Lo fija una prueba (`gcalSincronizacion.test.ts`, «sin la migración de B1»). |
| **Deshacer B1 con el código nuevo desplegado** | Lo mismo que la fila anterior. |

No añadí tolerancia: lo que ya hay (`SincronizacionNoDisponible`) da el comportamiento de la segunda fila, que
es aceptable para una ventana corta pero no para vivir así. Parar la página en vez de avanzar dejaría la
sincronización de toda la clínica detenida por un solo evento.

**Orden entre las tres:** el de sus nombres (`aplicar.sh` las ofrece así). Son independientes entre sí; el
orden sólo importa para tener un único guion.

## 4. Ensayo sobre el clon de estructura

1. Foto y clon como siempre (`scripts/produccion/README.md`). `esperadas-clon.tsv` tiene tres líneas nuevas
   (20–22): el disparador de M5 cuyo `WHEN` cambia de paréntesis al volcar y restaurar, las particiones
   diarias de `realtime.messages` y `auth.custom_oauth_providers`.
2. Conteos de sólo lectura sobre el clon: `bash supabase/produccion/conteos/correr-conteos-base-2.sh` (con
   `CONTEOS_HOST` etc. del clon). Todo `OK`/`INFO`.
3. `aplicar.sh estado` → las 16 anteriores «aplicada y registrada» y las tres nuevas «pendiente».
4. `aplicar.sh aplicar` → ofrece B1, B2 y B3; cada una se confirma con su versión. Rejillas esperadas: §6.
5. Probar la app sobre el clon con el código de esta rama.
6. Auditoría.

## 5. Conteos de sólo lectura (producción, los corre Angel)

`bash supabase/produccion/conteos/correr-conteos-base-2.sh`. Lo que hay que leer:

- **ALTO en B2.1, B2.2, B3.1 o B3.2:** el cuerpo de producción de esa función no es el que se espera; la
  migración abortaría limpia. No se aplica hasta saber quién la cambió.
- **B1.3 (AVISO si falla):** la huella de `cita_proteger_cierre`. B1 no la exige (sólo que el disparador esté
  puesto y encendido), pero si no es la de F5b conviene mirar por qué antes.
- **B1.4:** citas canceladas todavía ligadas a un evento de Google.
- **B2.4–B2.7:** cuánto hay por purgar, la cola de empalmes, las filas estimadas de las cuatro tablas y si
  alguna pasada de la purga se llevó más de 5 000 (el tope superado alguna vez).
- **B3.6:** transacciones abiertas ahora mismo y los minutos de la más antigua (MA 3).

## 6. Rejillas esperadas al aplicar

- **B1:** 4 filas `OK` (función INVOKER/VOLATILE/`search_path` vacío y sólo de `service_role`; dueño
  `postgres`; `cita_proteger_cierre` intacta; `false/false` para una clínica inexistente) y 1 `INFO`.
- **B2:** 4 filas `OK` (las dos funciones con sus atributos y «el lote aparte»; ninguna conserva el cuerpo
  viejo ni un «IN (SELECT»; dueño) y 2 `INFO`.
- **B3:** 4 filas `OK` (la función DEFINER que tira la foto y que ningún rol ejecuta; el disparador DEFINER
  con el cuerpo de MA; dueño; los dos comentarios) y 1 `INFO`.

## 7. Después de aplicar

- `aplicar.sh estado` → las 19 «aplicada y registrada».
- Desplegar el código de esta rama (después de B1).
- B2: la siguiente pasada de `/api/cron/purga-reserva` deja su fila `reserva_purga` en `audit_log`, como
  siempre, con contadores ≤ 5 000.
- B3: pulsar «Marcar todos como revisados» en la campana con cualquier usuario: la lista se vacía.

## 8. Deshacer (sólo con orden de Angel)

`aplicar.sh reversa` ofrece primero B3, luego B2, luego B1 (y sigue con R1, M3…: se para escribiendo otra
cosa). Ninguna de las tres toca filas ni se niega por datos.

- **B1:** borra la función. Con el código nuevo desplegado, ver §3.
- **B2:** devuelve los dos cuerpos de M4 y M5 (y el defecto del lote).
- **B3:** devuelve la función a su cuerpo de MA con el permiso para `authenticated`, el disparador a
  INVOKER y los comentarios como estaban. **Deshacer MA deshace también B3** (su `CREATE OR REPLACE` y su
  `DROP`): no hace falta correr antes la de B3.

## 9. Lo comprobado en local (2026-11-27)

- Las tres: ida, reversa e ida otra vez, a mano con `psql` y con `aplicar.sh` en modo ensayo (aplicar las
  tres; `reversa` de las tres, parando en R1; aplicar otra vez). Segunda pasada de cada una: aborta en el
  pre-vuelo sin tocar nada.
- Batería SQL completa (`scripts/pruebas-sql.sh`): 60 archivos en verde, con `gq1` reescrita, `av5`
  adaptada y las nuevas `b2_lotes_sin_reejecucion.sql` y `b3_avisos_bajos.sql`.
- `scripts/avisos-carrera.sh` (dos sesiones) en verde, con el paso 4 nuevo (MA 1) y su control en rojo con
  el cuerpo de MA.
- Conteos `conteos-base-2.sql` antes de aplicar: todo `OK`/`INFO`.
- Vitest, lint, build y las e2e de Google: ver el mensaje de entrega.

## 10. Lo que NO se comprobó

- **Nada contra producción ni contra un clon de la estructura de producción**: sólo la base local (que sale de
  las migraciones del repo). Las huellas md5 que exigen los pre-vuelos son las de esos archivos; si producción
  difiere, lo dicen los conteos antes de aplicar.
- B1 contra **Google real**: sólo el Google falso.
- B2: si el defecto ocurrió alguna vez en producción (lo dice `B2.7`).
- `esperadas-clon.tsv`, líneas 21 y 22 (`realtime.messages_AAAA_MM_DD` y `auth.custom_oauth_providers`):
  escritas por lo visto entre fotos de producción, **sin una foto aquí** para comprobar que el patrón casa con
  las claves reales. La 20 (el disparador de M5) sí está comprobada en local. Un patrón que no case sólo da
  el aviso «no apareció»; la diferencia seguiría saliendo como inesperada.
- MA 3 no tiene arreglo: queda documentado en el comentario de la función.
