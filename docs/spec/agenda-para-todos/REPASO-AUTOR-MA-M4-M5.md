# Agenda para todos — MA, M4 y M5: diseño y repaso del AUTOR

Migraciones: **MA** `20261203130000_avisos_globales_cierre_auditoria`, **M4**
`20261204120000_reserva_purga_y_tope`, **M5** `20261205120000_gcal_empalmes_pendientes`. Rama
`feature/agenda-para-todos`. Fecha: 2026-11-25. (M3 tiene su propio repaso: `REPASO-AUTOR-M3.md`.)

> **Esto NO es la auditoría.** La dimensión 25 de `supabase/AUDITORIA-MIGRACIONES.md` exige que audite
> alguien que no escribió la migración. Todo lo de aquí se comprobó en el stack local de Supabase
> (CLI 2.117.0), no en el clon de la foto de producción ni en producción.

## 1. MA — cierre de la tercera auditoría de M1

M1 y M2 están aplicadas en producción y no se editan. Los cuatro hallazgos:

| # | Hallazgo | Qué se hizo |
|---|---|---|
| 1 | Avisos con cita sin copia del médico (lectura lineal para el invitado) | Relleno: `UPDATE` de todo aviso con cita cuya copia falta o no coincide. Para los futuros: MA va detrás de M1 en la cadena, así que toda ida de M1 (también desde la «forma conservada») va seguida del relleno |
| 2 | «Marcar todos» se traga un aviso cuya transacción no había confirmado | La marca de agua no puede adelantar al inicio de la transacción abierta más antigua. Si queda corta, lo que quien pulsa VE en ese tramo se marca uno a uno |
| 3 | El pre-vuelo de la forma conservada no mira restricciones ni índices | No se puede corregir sin editar M1. Fila D.6 de los conteos (sólo lectura), a correr antes de re-aplicar M1 |
| 4 | Reasignar una cita espera por sus avisos y puede caer con 57014 | Espera 200 ms como mucho; si no, actualiza los libres (`SKIP LOCKED`), WARNING, y la cita se reasigna |

**Por qué el punto 2 queda cerrado de raíz.** `creado_en` es `now()` (inicio de la transacción) en un
alta, o `clock_timestamp()` en un refresco: siempre ≥ el inicio de la transacción que lo escribe. Si la
marca es < el inicio de TODA transacción abierta en el momento de marcar, cualquier aviso que confirme
después (lo escribe una de esas, o una posterior) tiene `creado_en` > la marca. Lo prueba
`scripts/avisos-carrera.sh` con dos sesiones, con un control: la misma carrera con el cuerpo de M1
pierde el aviso.

**Lo que descarté:** sellar `creado_en` al confirmar (un disparador diferido que actualiza la fila):
duplicaría las filas de `audit_log` de cada aviso y deja una ventana de milisegundos. Guardar una
instantánea de transacciones en la marca y comparar el `xmin` del aviso: exacto, pero frágil (conversión
de `xid`, filas congeladas) y metería una segunda búsqueda en la lectura de la campana.

**Coste del recorte:** mientras haya una transacción larga abierta (un volcado lógico, una sesión
olvidada «idle in transaction»), la marca de agua no avanza más allá de su inicio. El gesto sigue
vaciando la lista (marcado uno a uno, hasta 1 000), pero «lo que la lista no enseña» posterior a ese
inicio no queda cubierto hasta que la transacción termine y se vuelva a pulsar.

**Residuo anotado (no era un hallazgo):** la marca POR AVISO (`avisos_vistos.visto_en`) tiene la misma
carrera para un aviso que se está REFRESCANDO en una transacción abierta mientras alguien lo marca
visto: no se puede recortar igual sin impedir marcar durante una transacción larga. El refresco dura
milisegundos.

**Observación de los 17 ms** (administrador y secretaria con 21 000 avisos dirigidos a un médico): no
sale gratis. Haría falta un índice parcial más y reescribir `avisos_candidatos`. No se tocó.

## 2. M4 — purga y tope de emisión (AG-DT-274)

- **Quién dispara la purga:** la ruta de Vercel `GET /api/cron/purga-reserva`, una vez al día
  (`17 10 * * *` UTC), y no `pg_cron`: es como la app hace todo lo programado (se ve en `vercel.json` y
  en el panel, con sus fallos), y `pg_cron` sería el único trabajo de la agenda viviendo en la base.
  Cada pasada deja su fila en `audit_log` (también con cero): la última dice cuándo corrió.
- **El plazo no es un argumento:** 30 días dentro de la función.
- **`ip_rate_limits`:** leídos todos sus usos. Ventanas: inicio de sesión 15 y 60 min; registro y
  recuperación 60 min; `checkIpRateLimit` 60 min; reserva por enlace, de 10 min a 24 h (la mayor,
  `reservar.enlace`). Todos cuentan `created_at >=` «hace N minutos»; ninguno acumula. Borrar lo de más
  de 30 días no cambia ningún límite. La tabla guarda IP y, en los límites del inicio de sesión, el
  correo en claro en la columna `ip`.
- **El correo de los enlaces de un solo uso (riesgo ALTO; decisión expresa de Angel, 2026-11-25).**
  `proteger_reserva_enlace_unico()` NO se tocó: ya deja pasar a `postgres`, y `reserva_purgar()` es
  SECURITY DEFINER de postgres. La excepción es estrecha porque lo es la función: sólo NULL, sólo
  `correo` y `correo_hmac`, sólo `clase = 'unico'`, sólo los que dejaron de servir hace más de 30 días
  (el primero de usado, revocado, agotado o caducado). Probado en los dos sentidos (`ap2`, casos 2 y
  3): el vaciado pasa; la sesión y `service_role` siguen sin poder cambiar el correo, tampoco para
  vaciarlo, tampoco en un enlace caducado.
  **Quién lee ese correo y qué ve después:** `reservar_por_enlace` lo lee al reservar con un único
  VIGENTE (uno vaciado ya no era reservable). La cita guarda su copia (`appointments.reserva_correo` y
  `reserva_correo_hmac`): comprobante, recordatorio, candado e historial leen de la cita y de
  `reserva_incidencias`, no del enlace. La pantalla de enlaces deja de enseñar el correo de un único
  de hace más de 30 días.
- **El tope en la base:** 3 por correo y 60 min, global (los números de `LIMITES.codigo.correo`).
  `limitesReserva.ts` no se tocó. La ruta contesta `'limite'` como su propio 429 (sin cuánto falta).
- **El candado consultivo (1793, por correo):** dura lo que la llamada (una transacción). Quien pida en
  bucle para un correo ajeno no lo retiene; lo que puede es gastar los 3 por hora de ese correo, igual
  que hoy con el tope de la app. Medido (esta máquina, 20 000 filas en la tabla, 3 × 300 emisiones):
  0,31–0,44 ms por código con el tope y 0,32–0,34 sin él.
- **Equivalencia del resto de `reserva_codigo_emitir`:** `d3`, `k2`, `k3` y `seg1` pasan sin cambios en
  sus aserciones. `d3` pide muchos códigos seguidos al mismo correo: su ayudante envejece una hora los
  anteriores (único cambio, anotado en el archivo).
- **Repaso de la ruta pública del código:** el tope de la base va DESPUÉS de los de la app (red, reenvío
  de 30 s, correo) y de abrir el enlace; `'limite'` no revela nada nuevo (misma respuesta que el tope
  global por correo); no se manda correo; no hay camino nuevo sin límites.

**Otras tablas con conservación indefinida (no se tocan; decisión pendiente):** `reserva_incidencias` y
`appointments.reserva_correo_hmac` (de quien sí reservó; plazo propuesto 12 meses, pendiente de la
revisión legal); `reserva_contactos` (bloqueos manuales); `reserva_empalmes_google`,
`gcal_movimientos_rechazados`, `cita_correos`, `cita_confirmaciones`, `avisos_clinica`, `avisos_vistos`
(cuelgan de citas o son historial de la clínica).

## 3. M5 — cola de empalmes (AG-DT-264, A + C)

- **A.** El apunte se escribe en la transacción de la cita (dos disparadores con
  `WHEN (current_setting('spinus.via', true) = 'google')`); la base procesa y borra en una transacción;
  el servidor llama al consumidor al empezar la pasada y al acabar cada página.
- **La señal si el consumidor falla siempre:** al EMPEZAR la pasada un fallo la tumba (cuenta en
  `errores_seguidos`; a la tercera, el aviso «Google no sincroniza» de M1). Al acabar la página sólo
  cuenta un error: los apuntes siguen en la base.
- **Sin FK a `appointments`:** una cola no debe impedir borrar la cita; el apunte de una cita borrada se
  descarta al procesarlo (`ap3`, caso 6).
- **C.** `avisarMovimientoRechazado` y los bloqueos de la página: un fallo PASAJERO de la base ya no deja
  avanzar la página (se repite). El aviso va antes de auditar: repetir no duplica nada.
- **Compatibilidad:** sin M5, el código nuevo cae en la lista en memoria (los reintentos y el aviso a
  Sentry se conservan sólo para ese camino). Con M5 y el código viejo, los apuntes esperan.
- **Medido** (300 op × 3, ms por operación, sesión de la persona): médico 0,99–1,49 · secretaria
  1,55–2,31, el mismo intervalo que sin M5 (1,06–1,69 · 1,50–2,46). Para una escritura normal el `WHEN`
  es falso y la función no se llama.
- **Lo que A + C NO cierra** (alternativa B, sin construir): `DEUDA_TECNICA.md`, AG-DT-264.

## 4. Dimensión por dimensión

| # | MA | M4 | M5 |
|---|---|---|---|
| 1 Corre | Sí, local | Sí, local | Sí, local |
| 2 Atomicidad | `BEGIN … COMMIT`; post-vuelo antes del COMMIT | Ídem | Ídem |
| 3 Replay | 2.ª pasada aborta en el pre-vuelo | Ídem | Ídem |
| 4 Orden | Pre-vuelo antes de todo | Ídem | Ídem |
| 5 / 18 Veredicto | Un SELECT, 8 filas | Un SELECT, 8 filas | Un SELECT, 7 filas |
| 6 / 29 Bloqueos | Catálogo y filas del relleno | SHARE sobre `reserva_verificaciones` e `ip_rate_limits` (índices), último bloque | SHARE ROW EXCLUSIVE sobre `appointments` (2 `CREATE TRIGGER`), último bloque; después, post-vuelo y COMMIT. **Sin medir con el RTT de Angel** |
| 7 Destructividad / reversa | No borra. Reversa ensayada (devuelve cuerpos de M1 byte a byte); el relleno no se deshace | La MIGRACIÓN no borra; la FUNCIÓN sí (códigos caducados, intentos viejos; vacía correos). Irrecuperable por diseño (es una purga). Reversa ensayada | No borra. Reversa ensayada; se niega con apuntes |
| 8 Constraints | — | — | PK y FK nuevas en tabla nueva |
| 9 Semántica | La copia = el médico de la cita HOY | El corte de 30 días usa `created_at` y, en el enlace, el PRIMER instante en que dejó de servir | El apunte no dice qué cambió: el registro lo recalcula con el estado actual |
| 10 Aislamiento | La función nueva devuelve un instante global (no datos) | La purga es de toda la base a propósito; el tope cuenta por HMAC en toda la tabla (como el de la app) | Consumidor filtrado por `p_clinica_id` (`ap3`, caso 3) |
| 11 Propiedad | Pre-vuelo: dueño de las 3 funciones y de la tabla; `pg_read_all_stats` | Pre-vuelo: postgres; dueño de tablas y función | Pre-vuelo: dueño de `appointments` |
| 12 Ventana | Cualquiera | Cualquiera (mejor antes) | Cualquiera (mejor antes) |
| 13 Afirmaciones | «`now()` = inicio de la transacción» y «`pg_stat_activity.xact_start`»: manual de PostgreSQL; comprobado con dos sesiones | «`FOR UPDATE` exige UPDATE» (lo dio el error en local); «un GUC puesto en un subbloque se deshace con él»: comprobado (`av5`, caso 1) | «`WHEN` admite funciones, no subconsultas»: comprobado al crear |
| 15 Roles | Nadie gana ni pierde (las tres conservan firma y privilegios; lo comprueba el post-vuelo) | `service_role` gana ejecutar la purga; nadie gana DELETE de tabla. Quien emite códigos pierde poder pasar de 3 por correo y hora por un camino que no sea la app | `service_role` gana procesar la cola; las sesiones, nada |
| 16 Convenios | En los COMMENT | «Sólo NULL, sólo únicos vencidos»: en el COMMENT y en la cabecera | «Un apunte de más de una hora = no se está procesando»: en el COMMENT de la tabla |
| 17 Otros caminos | — | A `reserva_verificaciones` escribe sólo `service_role` por sus funciones; borra sólo la purga | La cola la escribe sólo el disparador |
| 19 Recursión | No toca policies | Ídem | Tabla sin policies |
| 20 Permisos de fábrica | REVOKE/GRANT explícitos | Ídem | `REVOKE ALL` y sólo SELECT, DELETE y UPDATE(`creado_en`) a `service_role`; el post-vuelo lo exige |
| 21 Rendimiento | Una lectura de `pg_stat_activity` por «Marcar todos» | Índices para el barrido y el tope; emisión medida | Disparador de citas medido |
| 22 Conjunto | Reescribe 3 funciones de M1 desde su cuerpo (huella) | Reescribe 1 de F3 desde su cuerpo (huella) | No reescribe nada |
| 23 Prueba | `av5` + `scripts/avisos-carrera.sh` | `ap2` + Vitest de la ruta | `ap3` + Vitest de la sincronización |
| 24 DEFINER | `avisos_transaccion_mas_antigua`: `search_path` vacío, sin PUBLIC | `reserva_purgar`: ídem | `gcal_empalme_apuntar`: ídem |
| 26 Otorgante | — | — | El post-vuelo pregunta el privilegio efectivo |
| 27 Contadores | — | El tope cuenta FILAS ya escritas: un fallo posterior no «devuelve» intentos; el candado consultivo cierra la carrera | — |
| 28 Pre-vuelos acotados | Huellas con sólo los fines de línea normalizados | Ídem; el disparador del único se reconoce por dos fragmentos de su cuerpo, no por huella | Miran sólo lo suyo |
| 30 FK multi-clínica | — | — | Sin FK a `appointments`; la sesión no escribe la tabla |
| 31 Cadena de reversas | No se niega | No se niega | Se niega con apuntes; su guarda está en `reversa-previa.sql` |
| 14 Otras | Depende de que `postgres` vea `pg_stat_activity` entero: si dejara de verlo, el defecto vuelve sin error (lo vigila la carrera, no la base) | La tarea no avisa a nadie si deja de correr: se ve en `audit_log` (última fila `reserva_purga`) | Nada vacía una cola de una clínica que deja de sincronizar (Google desconectado): los apuntes se quedan |

## 5. Lo que NO quedó en cero

- Ensayo sobre el clon, conteos en producción y auditoría independiente de las tres.
- Las huellas md5 de las funciones de M1 y de F3 EN PRODUCCIÓN (filas D.3 y E.2 de los conteos).
- Que `postgres` sea miembro de `pg_read_all_stats` en producción (fila D.4; en local lo es).
- El aviso de privacidad de la reserva sigue sin decir el plazo de 30 días (pendiente de revisión legal).
