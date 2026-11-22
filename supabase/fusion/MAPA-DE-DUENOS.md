# Mapa de dueños del conjunto fundido de la agenda v2

> Fase «dejar la agenda v2 lista para producción», agente I. 2026-11-22, sobre
> `feature/agenda-v2-produccion` (`384f59c8`). Complemento de
> `supabase/fusion/INVENTARIO.md`. **Sin este mapa no empieza la oleada de
> fusión.**

## 1. Reglas del mapa

- **Un objeto tiene UN dueño.** Ese bloque escribe su versión final en su
  archivo, con su REVOKE/GRANT y su COMMENT. Los demás no lo redefinen, ni
  con CREATE OR REPLACE, ni con ALTER, ni con un COMMENT. Si necesitan que
  conserve algo, lo piden aquí (§3), y el dueño lo garantiza.
- **La «versión final»** es la de la última migración que lo crea o lo
  reemplaza. Su cuerpo es el del catálogo de la base local (md5 comprobados,
  INVENTARIO §1). Para escribirlo, se parte de `pg_get_functiondef` en local o
  del archivo de esa migración.
- **Filas del mapa** (§7): un objeto por fila.
  - Tablas, columnas añadidas a tablas ajenas, restricciones con nombre,
    índices, activaciones de RLS, policies, funciones (con su firma),
    disparadores, juegos de GRANT/REVOKE por objeto, COMMENT por objeto y
    escrituras de datos.
  - Las restricciones sin nombre van dentro de su tabla.
  - No hay tipos, secuencias, esquemas, extensiones ni publicaciones
    (comprobado: ninguna migración de la agenda los crea).
- **`[main]` en las notas** = el objeto vive en una tabla de `main` o la
  modifica (`appointments`, `consultorios`, `clinicas`, `audit_log`).
- **«M49»** = la #49 (`audit_log_sin_truncate`), que no es de la agenda y no
  se funde: no tiene dueño F.

## 2. Resumen por dueño

| Dueño | Objetos | Por tipo |
|---|---|---|
| F1 | 87 | tabla 3, columna 9, restricción 20, índice 5, RLS 3, policy 6, función 6, disparador 8, GRANT/REVOKE 9, COMMENT 16, datos 2 |
| F2 | 74 | tabla 3, columna 1, restricción 16, índice 2, RLS 3, policy 1, función 15, disparador 1, GRANT/REVOKE 18, COMMENT 14 |
| F3 | 165 | tabla 5, columna 16, restricción 46, índice 9, RLS 5, policy 8, función 17, disparador 7, GRANT/REVOKE 22, COMMENT 30 |
| F4 | 122 | tabla 4, restricción 31, índice 8, RLS 4, policy 5, función 20, disparador 11, GRANT/REVOKE 24, COMMENT 14, datos 1 |
| F5 | 62 | tabla 1, columna 2, restricción 11, índice 6, RLS 1, policy 4, función 8, disparador 8, GRANT/REVOKE 9, COMMENT 12 |
| M49 | 2 | disparador 1, GRANT/REVOKE 1 |

Total: 512 filas (comprobado: analizador sobre los 45 archivos, nombres y
firmas contrastados con el catálogo local).

### 2.1 Asignaciones que no encajan a la primera, y por qué

1. **Las 11 columnas `appointments.reserva_*`, sus dos FK, sus dos CHECK y sus
   tres índices (d1) → F3, no F5.**
   - El brief pone «columnas `reserva_*`» en F5. Leo ese punto como la
     PROTECCIÓN de esas columnas: es el nombre de la migración
     `seg_columnas_reserva`, que crea `cita_proteger_reserva`, y ésa sí es
     de F5.
   - Si las columnas fueran de F5, habría un ciclo:
     - sus FK apuntan a `reserva_enlaces` y `reserva_avisos` (F3);
     - el disparador `trg_appointments_reserva_incidencia` (F3) tiene un WHEN
       sobre `reserva_canal`;
     - `cita_nombre_saludo` (F4, SQL) lee `reserva_nombre` al crearse.
   - **Comprobado** en `pg_constraint`, `pg_trigger` y en el lenguaje de las
     funciones.
2. **`agenda_bloqueos` (tabla, policies, `agenda_bloqueo_preparar`, su
   auditoría) → F5, pero en un archivo TEMPRANO (F5a).**
   - `reserva_ocupacion` es `LANGUAGE sql`, y PostgreSQL valida su cuerpo al
     crearla (`check_function_bodies`, activo por omisión). Nombra
     `public.agenda_bloqueos`, así que esa tabla tiene que existir antes que
     el archivo de F3.
   - **Comprobado** en el catálogo: `pg_language` = sql y el cuerpo con
     `public.agenda_bloqueos`.
3. **`aviso_clinica_de_movimiento_google()` y su disparador → F4, no F2.**
   - El brief pone «movimientos rechazados y su aviso» en F2 y «avisos de la
     clínica y sus disparadores `aviso_clinica_de_*`» en F4: el objeto cae en
     los dos.
   - Lo dejo con la familia: los seis `aviso_clinica_de_*` escriben la misma
     tabla, bajo la misma CHECK de tipos (que es de F4) y con el mismo índice
     único parcial.
   - F2 es dueño de la tabla `gcal_movimientos_rechazados` y de
     `cita_movimiento_google_registrar`. Lo mismo vale para
     `aviso_clinica_de_empalme` (F4), que cuelga de `reserva_empalmes_google`
     (F2).
4. **`cita_rsvp_google` (e9) → F2.** Es «confirmación de asistencia», pero la
   llama sólo la sincronización con Google (`gcalSincronizacionBase.ts`,
   `gcalRsvp.ts`) y entra con `via = google_rsvp`.
5. **`reserva_empalmes_google` y `reserva_empalmes_registrar` (d11) → F2.** Las
   escribe la sincronización al detectar un evento de Google encima de una
   reserva.
6. **`cita_reagendar_clinica` (nace en i2, junto al candado de elección) → F4**
   (reagendar por la clínica). El disparador `cita_proteger_eleccion` de esa
   misma migración → F5.
7. **Las columnas añadidas a `agenda_ajustes` por otras tandas → F1**, dueño
   de la tabla:
   - `recordatorio_encendido` (h2), que necesita F4;
   - `correo_reserva_clinica` (i5), que necesita F4.

   La fusión crea la tabla entera, con sus 15 columnas. Las columnas
   añadidas a `reserva_enlaces` son de F3, por la misma razón.
8. **Los disparadores de `appointments`** son de quien es dueño de su
   función. Los de protección son de F5; además:
   - `audit_appointments*` → F1;
   - `trg_appointments_asignacion_google` → F2;
   - `trg_appointments_reserva_incidencia` → F3;
   - `trg_appointments_aviso_clinica` → F4.

   F5 tiene la REVISIÓN EN CONJUNTO de los once (§5), pero no los redefine
   sin el dueño.
9. **Los índices de rango de a18** (`idx_appointments_clinica_inicio`,
   `idx_appointments_clinica_medico_inicio`) → F5, como pide el brief. No
   dependen de nada de la agenda.

## 3. Objetos conflictivos: dueño y lo que necesita cada otro bloque

| Objeto | Dueño | Lo necesitan | Qué tiene que conservar |
|---|---|---|---|
| `reservar_por_enlace(…14…)` | F3 | F5, F2, F4 | **F5:** el `OR EXISTS (… agenda_bloqueos …)` en el bloque de solape (después del candado 1790), el `NOT a.all_day` (un evento de todo el día ya no cierra el día) y que siga siendo un INSERT de `service_role` con `reserva_canal` (exento en `cita_proteger_bloqueo` y `cita_proteger_reserva`). **F2:** la puerta `gcal_sync_clinica_habilitada` y la misma condición de empalme que `reserva_ocupacion`. **F4:** que `reagendar_por_enlace` la pueda llamar con la misma firma (lo hace dentro de la función). Además, el `BEGIN … EXCEPTION WHEN unique_violation` de j2b, `pausado_en IS NULL`, el seudónimo `sha256('reserva-sin-correo:'||id)`, el tope de 5 intentos y que el correo del único sea el del enlace |
| `reserva_ocupacion` | F3 | F5 | El `OR EXISTS … agenda_bloqueos` y `pausado_en IS NULL`. Es SQL: F5a va antes |
| `reserva_contexto` | F3 | F1, F2 | Lee `tipos_cita.principal`/`consultorio_id` y `consultorios.horario_propio`/`horario` (F1); la puerta S3 (F2). A la página no viajan `principal` ni `consultorio_id` (regla de `CLAUDE.md`) |
| `log_cita_change()` + `audit_appointments`/`_update` | F1 | F2, F4, F5 | La lista blanca `c_vias` = {`google`, `enlace_paciente`, `google_rsvp`}: F2 pone `google` y `google_rsvp`, F4 pone `enlace_paciente`. La lista `c_tecnicas` es idéntica en la función y en el WHEN. F5 cuenta con que sea AFTER y DEFINER (los BEFORE de F5 corren antes y pueden abortar sin dejar auditoría) |
| `proteger_reserva_enlaces()` | F3 | F1 | F1 (`agenda_restablecer_configuracion`) revoca enlaces por UPDATE y necesita que la función siga dejando revocar a `service_role` y no deje reactivar. `CLAUDE.md` cita su md5 `acd4128b`: al fundir sale otro md5 si cambia un byte |
| `gcal_sync_clinica_habilitada(uuid)` (puerta S3) | F2 | F3, F4 | Que siga siendo la única puerta de suscripción sin sesión. F4 la llama desde dos funciones SQL (`cita_recordatorios_pendientes`, `cita_correos_pendientes`), que se validan al crearse: F2 va antes que F4 |
| `agenda_ajustes` (15 columnas) | F1 | todos | `agenda_v2_encendida` (todos: falla cerrado); `candado_*`, `anticipacion_min_horas`, `horizonte_dias` y `vigencia_enlace_unico_dias` (F3); `recordatorio_horas`, `recordatorio_encendido` y `correo_reserva_clinica` (F4). Los DEFAULT de `candado_*` repetidos en `proteger_agenda_ajustes` |
| `tipos_cita` | F1 | F3, F4 | `principal` y `consultorio_id` (F3: `reserva_contexto`, `reservar_por_enlace`); la FK compuesta `(tipo_cita_id, clinica_id)` desde `appointments` |
| `appointments.reserva_*` (11) | F3 | F5, F2, F4 | **F5:** que ninguna `reserva_*` nueva lleve DEFAULT, salvo `reserva_reagendados` DEFAULT 0 (`cita_proteger_reserva` las lista por prefijo). **F2:** `reserva_canal` y `reserva_nombre` en el espejo. **F4:** `reserva_correo`, `reserva_nombre` y `reserva_correo_hmac` |
| `appointments.google_asignacion` + CHECK + `cita_asignacion_google` | F2 | F4 | El literal `'por_asignar'`: lo usan el WHEN de `trg_appointments_aviso_clinica` (F4), `cambioPuedeAvisar` y `esPorAsignar` (src). Los tres van juntos (`CLAUDE.md`) |
| `spinus.via` (GUC, no es objeto) | F2 lo pone en `gcal_*` y `cita_rsvp_google`; F4 en `cita_confirmacion_responder` y `reagendar_*` | F1, F5 | F1 (`log_cita_change`) y F5 (`cita_proteger_bloqueo`, `cita_asignacion_google` de F2) lo leen con `current_setting(…, true)`. Valores fijos |
| `spinus.reagendar_cita` (GUC) | F4 (`cita_reagendar_clinica`) | F5 | `cita_proteger_eleccion` exime el cambio cuando está puesto: el nombre del GUC no cambia |
| Candado consultivo 1790 | F3 (`reservar_por_enlace`) | F2, F5 | La misma clave `pg_advisory_xact_lock(1790, hashtext(medico_id::text))` en `gcal_bloqueo_aplicar` (F2) y `agenda_bloqueo_preparar` (F5): con el cambio de médico, los dos en orden `least`/`greatest` |
| `avisos_clinica` + `avisos_clinica_tipo_check` (7 tipos) | F4 | F2 | Los tipos `google_por_asignar`, `empalme_google` y `google_movimiento_rechazado` los generan disparadores sobre tablas de F2 |
| `cita_tiene_nota_ligada` | F5 | — | DEFINER y sólo booleano (la RLS de `consultas` oculta las notas a la secretaria) |
| `agenda_restablecer_configuracion` | F1 | F3 | plpgsql: en ejecución toca `reserva_enlaces` y `tipos_cita`. Puede ir en el archivo de F1 si su pre-vuelo no exige objetos de F3 (el de h2 exigía `proteger_reserva_enlaces` `acd4128b%`); si F1 quiere pre-volarlo, va en un archivo propio después de F3 |

## 4. DEPENDENCIAS ENTRE BLOQUES

Sólo las que obligan a un orden de APLICACIÓN.

- **Obligan:** una FK, una columna nombrada en un WHEN o en un CHECK, o una
  función `LANGUAGE sql` (se valida al crearse).
- **No obligan:** las referencias dentro de plpgsql se resuelven al
  ejecutarse. Sólo cuentan para los post-vuelos y las pruebas, que tienen
  que correr con todo el conjunto aplicado.

| Debe ir antes | … que | Por qué (comprobado en el catálogo salvo marca) |
|---|---|---|
| F1 | F2, F3, F4, F5 | **SQL:** `gcal_sync_clinicas_pendientes` (F2), `reserva_contacto_estado` y `reserva_ocupacion` (F3), y `cita_recordatorios_pendientes` y `cita_correos_pendientes` (F4) nombran `agenda_ajustes`. **FK:** `appointments.tipo_cita_id` → `tipos_cita` (dentro de F1) |
| F5a (`agenda_bloqueos`) | F3 | `reserva_ocupacion` (SQL) nombra `agenda_bloqueos` |
| F2 | F4 | **SQL:** `cita_recordatorios_pendientes` y `cita_correos_pendientes` llaman a `gcal_sync_clinica_habilitada`. **Disparadores:** F4 cuelga los suyos de `reserva_empalmes_google` y `gcal_movimientos_rechazados`. **WHEN:** el de `trg_appointments_aviso_clinica` usa `google_asignacion` |
| F2 | F3 | Blanda: las funciones de F3 llaman a la puerta S3 sólo al ejecutarse; F2 antes, para que los post-vuelos de F3 puedan llamarla. *Deducido* |
| F3 | F4 | **WHEN:** el de `trg_appointments_aviso_clinica` usa `reserva_enlace_id`. **SQL:** `cita_nombre_saludo` lee `reserva_nombre`. **Llamada:** `reagendar_por_enlace` llama a `reservar_por_enlace` (plpgsql, blanda) |
| F3 | F5b | **WHEN:** el de `trg_appointments_proteger_eleccion` usa `old.reserva_canal`. `cita_proteger_reserva` supone las `reserva_*` y sus DEFAULT (su pre-vuelo de seg los miraba) |
| F3 (dentro) | — | `trg_appointments_reserva_incidencia` (WHEN `reserva_canal`) va después de las columnas, en el mismo archivo |
| F4 | F5b | Blanda: `cita_proteger_eleccion` lee el GUC de `cita_reagendar_clinica` al ejecutarse. *Deducido* |
| F5a | F2 | Blanda: `gcal_bloqueo_aplicar` (plpgsql) escribe `agenda_bloqueos` al ejecutarse. Con F5a antes de F2, su post-vuelo puede probarla |
| `main` + `feature/limites-ajustables` (`20261014…`) | todo el conjunto | Por fecha. P1 deja `ALTER DEFAULT PRIVILEGES … REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` global para `postgres`: toda función fundida nace sin PUBLIC, y cada archivo tiene que seguir poniendo su REVOKE/GRANT explícito (hoy todos lo hacen; comprobado: ninguna función de la agenda tiene PUBLIC en el catálogo). No toca `clinica_tiene_acceso()` ni `clinica_no_suspendida()` |
| #49 y la migración nueva de TRUNCATE | — | Independientes: ninguna del conjunto toca `audit_log` en DDL |

**No hay dependencias hacia atrás** que obliguen a partir un bloque más allá
de F5a / F5b (comprobado: ninguna función SQL ni ningún WHEN de F1, F2 o F3
nombra objetos de F4 o de F5b).

### 4.1 Orden y nombres propuestos

**Fecha de los archivos:**

- Todos van después de `main` (`20260919230000`) y de las tres `20261014…`
  de `feature/limites-ajustables`.
- Uso un día nuevo, `20261201`, para que no se confundan con los 44 archivos
  que sustituyen. Esos 44 salen de `supabase/migrations/`; adónde (por
  ejemplo, a `descartadas/`) se decide al fundir.
- La #49 (`20261125170000`) y la nueva de TRUNCATE pueden quedarse con su
  fecha: no dependen del conjunto ni el conjunto de ellas.

| Orden | Archivo propuesto | Dueño | Contenido |
|---|---|---|---|
| 1 | `20261201120000_agenda_f1_ajustes_tipos_horarios.sql` | F1 | `agenda_ajustes` entera; `tipos_cita` entera; `appointments.tipo_cita_*`; `consultorios.horario_propio` y `horario_revisado_en`; `clinicas.timezone`; respaldo + backfill de G4; `log_cita_change` y sus dos disparadores; `agenda_restablecer_configuracion` (si no se pre-vuela F3) |
| 2 | `20261201130000_agenda_f5a_bloqueos.sql` | F5 | `agenda_bloqueos` con sus índices, RLS, policies, `agenda_bloqueo_preparar` y `audit_agenda_bloqueos` |
| 3 | `20261201140000_agenda_f2_google.sql` | F2 | `gcal_sync_estado` y las `gcal_sync_*`; espejo (`gcal_citas_por_evento`, `gcal_aplicar_evento`, `gcal_importar_evento`); `reserva_empalmes_google` y `gcal_sync_frescura`; `cita_rsvp_google`; `google_asignacion` con su CHECK, función y disparador; `gcal_movimientos_rechazados` y `cita_movimiento_google_registrar`; `gcal_bloqueo_aplicar` |
| 4 | `20261201150000_agenda_f3_reserva_enlace.sql` | F3 | `reserva_avisos`, `reserva_enlaces` (con las columnas de j2 y k3), `appointments.reserva_*` con FK, CHECK e índices, `reserva_incidencias` con su disparador en `appointments`, `reserva_contactos`, `reserva_verificaciones`, y todas las funciones de la reserva (las dos `reserva_enlace_emitir`, `rate_limit_espera`, `reserva_espera_reenvio`) |
| 5 | `20261201160000_agenda_f4_confirmacion_correos_avisos.sql` | F4 | `cita_confirmaciones`, `cita_reagendos`, `cita_correos`, `avisos_clinica` y sus `aviso_clinica_*`, y las funciones de confirmación, reagendo y correo |
| 6 | `20261201170000_agenda_f5b_protecciones_cita.sql` | F5 | Índices de rango; `cita_proteger_borrado`, `_reserva`, `_atendida` (+ `cita_tiene_nota_ligada`), `_eleccion`, `_cierre` (+ columnas `cerrada_en`/`sustituida_por`, FK, CHECK, índice) y `_bloqueo`, con sus disparadores |
| (6b) | `20261201180000_agenda_f1_restablecer.sql` | F1 | Sólo si F1 quiere pre-volar `proteger_reserva_enlaces`; si no, va en el 1 |

Cada archivo nuevo añade su fila a §7.1 de `mejora_agendaV2.md` en el mismo
commit (regla del proyecto), y la tabla vieja de 44 filas pasa a histórica.

**Riesgo del orden (deducido):**

- **F1 hace el ÚNICO backfill sobre datos reales** (consultorios, con su
  pre-vuelo 1.4). Ponerlo primero hace que un fallo ahí aborte antes de
  crear nada más.
- **El ACCESS EXCLUSIVE sobre `appointments`** lo toman F1 (columnas y FK de
  tipos), F2 (`google_asignacion`), F3 (11 columnas, FK y CHECK) y F5b
  (columnas de cierre y los CREATE TRIGGER). Hoy son 14 migraciones, cada una
  con `lock_timeout` de 5 s; fundidas serían 4 transacciones.


## 5. DISPARADORES DE appointments

**Comprobado en `pg_trigger`** (base local con las 50, sin los internos de las
FK):

- `appointments` tiene **11 disparadores**, y **los 11 son de la agenda**.
- `main` no le deja ninguno: el volcado `20260912190416_remote_schema.sql` no
  tiene ningún `CREATE TRIGGER … ON appointments`. Lo único de `main` en esa
  tabla es su entrada en la publicación `supabase_realtime`.
- PostgreSQL dispara los del mismo momento (BEFORE / AFTER) y el mismo nivel
  (ROW) **por orden alfabético de nombre**. La tabla sigue ese orden.

| Orden | Disparador | Momento | Eventos | Columnas (UPDATE OF) | WHEN | Función | Seguridad | Nace en | Dueño |
|---|---|---|---|---|---|---|---|---|---|
| B1 | `trg_appointments_asignacion_google` | BEFORE ROW | INSERT, UPDATE | `google_asignacion` | — | `cita_asignacion_google()` | INVOKER | i3 | F2 |
| B2 | `trg_appointments_horario_bloqueado` | BEFORE ROW | INSERT, UPDATE | `start_time, end_time, medico_id` | — | `cita_proteger_bloqueo()` | INVOKER | l1 | F5 |
| B3 | `trg_appointments_proteger_atendida` | BEFORE ROW | UPDATE, DELETE | `start_time, end_time, status, all_day` | `old.status = 'attended'` | `cita_proteger_atendida()` | INVOKER | h5 (cuerpo i4) | F5 |
| B4 | `trg_appointments_proteger_borrado` | BEFORE ROW | DELETE | — | — | `cita_proteger_borrado()` | INVOKER | seg-borrado | F5 |
| B5 | `trg_appointments_proteger_cierre` | BEFORE ROW | INSERT, UPDATE | `status, cerrada_en, sustituida_por` | — | `cita_proteger_cierre()` | INVOKER | i4-cancelada (cuerpo l2) | F5 |
| B6 | `trg_appointments_proteger_eleccion` | BEFORE ROW | UPDATE | `start_time, end_time, medico_id, consultorio_id, all_day` | `old.reserva_canal IS NOT NULL` | `cita_proteger_eleccion()` | INVOKER | i2-elección | F5 |
| B7 | `trg_appointments_proteger_reserva` | BEFORE ROW | INSERT, UPDATE | (todas) | — | `cita_proteger_reserva()` | INVOKER | seg-columnas | F5 |
| A1 | `audit_appointments` | AFTER ROW | INSERT, DELETE | — | — | `log_cita_change()` | DEFINER | b0 (cuerpo e1) | F1 |
| A2 | `audit_appointments_update` | AFTER ROW | UPDATE | — | `to_jsonb(old) - c_tecnicas IS DISTINCT FROM to_jsonb(new) - c_tecnicas` | `log_cita_change()` | DEFINER | b0 | F1 |
| A3 | `trg_appointments_aviso_clinica` | AFTER ROW | INSERT | — | `new.reserva_enlace_id IS NOT NULL OR new.google_asignacion = 'por_asignar'` | `aviso_clinica_de_cita()` | DEFINER | i5 | F4 |
| A4 | `trg_appointments_reserva_incidencia` | AFTER ROW | UPDATE | `status` | `new.reserva_canal IS NOT NULL AND old.status IS DISTINCT FROM new.status` | `reserva_registrar_incidencia()` | DEFINER | d2 | F3 |

**Hechos que condicionan cualquier unión** (comprobado en los cuerpos del
catálogo):

- **Los 7 BEFORE son INVOKER y los 4 AFTER, DEFINER.** Los INVOKER deciden
  por `current_user` (los 7, más `proteger_agenda_ajustes` y los
  `proteger_reserva_*`). Unirlos en una función DEFINER cambiaría
  `current_user` a `postgres` y abriría todas las puertas.
- **Sólo B1 escribe en NEW** (`google_asignacion`); los otros seis sólo
  deciden y lanzan 42501/23514. B1 corre primero, así que los demás ven ya
  la marca puesta. Una unión tiene que conservar ese orden.
- **Cuando dos BEFORE rechazan la misma fila, gana el primero por orden
  alfabético,** y con él su HINT. Las rutas traducen el error por su HINT:
  `agenda_horario_bloqueado`, `HINT_ATENDIDA_CON_NOTA`… Cambiar el orden
  cambia qué 409 recibe el cliente.
- **Los filtros `UPDATE OF` y `WHEN` ahorran llamadas.** Una sola función
  para todo correría en cada UPDATE de cada cita, incluidos los ecos de
  Google que sólo tocan `gcal_*`.

**Candidatos a unirse sin cambiar el comportamiento.** Es sólo la
observación; la decisión y la medición son de F5.

1. **B4 + la parte DELETE de B3**, en un único BEFORE DELETE. Los dos son
   INVOKER y sólo deciden. Con la v2 encendida, B4 veta todo DELETE de una
   cita con paciente o por ligar; B3 veta el de una atendida con nota,
   también con la v2 apagada. B3 es antes que B4 por orden alfabético, así
   que con los dos el error que se ve es el de B3; la unión tiene que
   preguntar en ese orden.
2. **B5 + B6 + B2**, todos BEFORE, INVOKER y de «no se mueve o no se
   reabre». Tienen columnas distintas:
   - unidos, el disparador tendría la UNIÓN de sus columnas
     (`start_time, end_time, medico_id, consultorio_id, all_day, status,
     cerrada_en, sustituida_por`);
   - cada rama tendría que volver a evaluar su propia condición: el WHEN de
     B6, y si cambió algo de lo que mira cada uno.

   Mismo resultado, menos disparadores; más llamadas cuando sólo cambia una
   de las columnas de otra rama. **A medir.**
3. **B7 no conviene unirlo:** mira TODAS las columnas en cada INSERT y en
   cada UPDATE de sesión. Meterlo en otro haría que éste también corriera
   siempre.
4. **A1 + A2 no se pueden unir sin perder el WHEN:** un WHEN que lea `OLD`
   no se admite en un disparador de INSERT. Por eso están partidos.
5. **A3 y A4** son DEFINER y escriben en tablas de F4 y F3. Unirlos con A1/A2
   mezclaría la auditoría con los avisos y el candado: un fallo en el aviso
   abortaría también la auditoría (hoy ya abortan juntos, porque comparten
   transacción). No lo recomiendo; F5 decide.

**Otros disparadores de la agenda sobre tablas de `main` o de otro bloque**
(comprobado):

| Tabla | Disparador | Dueño |
|---|---|---|
| `cita_confirmaciones` | `trg_cita_confirmaciones_aviso_clinica` (AFTER UPDATE OF `respuesta`, WHEN cancela) | F4 |
| `cita_confirmaciones` | `trg_cita_confirmaciones_aviso_confirmacion` (AFTER UPDATE OF `respuesta`, `respondido_en`) | F4 |
| `cita_reagendos` | `trg_cita_reagendos_aviso_clinica` | F4 |
| `reserva_empalmes_google` (F2) | `trg_reserva_empalmes_aviso_clinica` | F4 |
| `gcal_movimientos_rechazados` (F2) | `trg_gcal_movimientos_aviso_clinica` | F4 |
| `audit_log` | `prevent_audit_truncate` (#49) | M49 |

`consultorios` y `clinicas` no reciben ningún disparador de la agenda. Los de
`main` que tienen (`audit_consultorios`, `enforce_consultorio_default_*`,
`trg_consultorios_cap_10`, `trg_consultorios_updated_at`,
`trg_clinicas_latch_premium`) intervienen en el backfill de G4. La rama
`limites-ajustables` añade `trg_clinicas_proteger_ajustes`, que sólo mira
`ajuste_*` y no choca con `clinicas.timezone`.

## 6. LO REPETIDO

Fragmentos que aparecen en muchas funciones finales. El conteo sale del
catálogo, con regex sobre `prosrc`. Cada uno podría ser una pieza común. Si
se hace, es una función nueva, y eso exige OK explícito (Protocolo 4,
abstracción) y la lista del caso 3 de `p1` si no la ejecutan los tres roles.

| Fragmento | Dónde (conteo) | Pieza común posible | Dueño propuesto | Cuidado |
|---|---|---|---|---|
| **Leer el interruptor:** `SELECT agenda_v2_encendida FROM agenda_ajustes WHERE clinica_id = …`, con «sin fila o error = false» | **27 funciones**, de F1, F2, F3, F4 y F5 | `agenda_v2_encendida(p_clinica_id uuid) RETURNS boolean`: SQL, STABLE, **INVOKER**, `coalesce(…, false)` | F1 (dueño de `agenda_ajustes`) | Tiene que ser INVOKER. Los disparadores INVOKER la leen con la sesión, y la RLS de `agenda_ajustes` sólo deja ver la clínica propia: una DEFINER leería cualquier clínica. Hay que conservar el «falla cerrado» de `CLAUDE.md`. Es SQL, así que los demás bloques la necesitan creada antes (ya lo cumple: F1 va primero) |
| **Rol de sistema:** `current_user IN ('postgres','supabase_admin')` y, según el caso, `'service_role'` | **12 funciones**: los 7 BEFORE de `appointments`, `proteger_agenda_ajustes`, `proteger_reserva_enlaces`, `proteger_reserva_enlace_unico`, `proteger_reserva_contactos` y `gcal_sync_clinica_habilitada` | `agenda_rol_de_sistema(p_con_service boolean)`, INVOKER | F5 (revisa los disparadores en conjunto) | `current_user` dentro de una función INVOKER es el de quien la llama, pero una DEFINER la rompería. Cada sitio decide si `service_role` cuenta (borrado y atendida NO lo eximen; reserva y cierre, SÍ): un solo parámetro no basta para todos, y quizá conviene dejarlo en línea |
| **Vía Google:** `current_setting('spinus.via', true) = 'google'` + `current_user = 'service_role'` | `log_cita_change`, `cita_asignacion_google`, `cita_proteger_bloqueo`; lo ponen 10 `set_config` | `agenda_via()` con la lista blanca `c_vias` | F1 (la lista blanca vive en `log_cita_change`); F2 documenta quién la pone | Un literal nuevo exige migración (`CLAUDE.md`). No es una puerta de seguridad por sí sola: siempre va con `service_role` |
| **Permisos de agenda:** `clinica_id = get_clinica_id() AND (medico_id = auth.uid() OR soy_admin_de_clinica() OR get_my_role() = 'secretaria')`, y su variante con `p_actor` | **Policies:** `reserva_enlaces` ×3, `reserva_incidencias`, `reserva_contactos` ×3, `tipos_cita_select` (con su variante). **Funciones:** `reserva_enlace_emitir` ×2, `cita_reagendar_clinica` y `agenda_restablecer_configuracion` (sólo admin) | `agenda_puede_gestionar(p_medico uuid, p_actor uuid default auth.uid())` | F1 | En policies, una función por fila puede costar (la RLS no la plega como `initplan`). Las de `p_actor` son de `service_role` y no pueden usar `auth.uid()`. Medir antes |
| **Candados consultivos:** 1789 (`rate_limit_*`, `main`), **1790** (médico: `reservar_por_enlace`, `agenda_bloqueo_preparar`, `gcal_bloqueo_aplicar`), **1791** (cita: `cita_confirmacion_emitir`/`_revocar`), **1792** (cita: `cita_correo_tomar`) | 4 claves, 7 llamadas (comprobado) | Una tabla de claves en un COMMENT o en un documento, o `agenda_candado_medico(uuid)` | F3 (1790 nació en `reservar_por_enlace`); 1791 y 1792, F4 | Una función envolvente no cambia nada (el candado es de la transacción); el riesgo real es que alguien reutilice 1790 para otra cosa |
| **Puerta de suscripción sin sesión** | `gcal_sync_clinica_habilitada` ya ES la pieza común (14 migraciones la nombran) | — | F2 | No copiar RN-1 en ningún sitio (decisión S3) |
| **Clínica de la sesión** | `get_clinica_id()` (de `main`) en las policies; en las RPC de `service_role`, el parámetro `p_clinica_id`, filtrado en cada SELECT | — | — | Ya es común. Es la regla del pendiente prioritario de `CLAUDE.md` (todo `createAdminClient` filtra por `clinica_id`): no cambiarla |
| **Pre-vuelo con md5 + rejilla de veredicto** | Las 45 migraciones repiten la misma estructura: un DO de pre-vuelo con `md5(prosrc)` y `to_regprocedure`, y un SELECT final con OK/REVISAR | Una plantilla de TEXTO común (no una función: dejaría un objeto en la base) para los 6 archivos fundidos | Coordinador de la fusión, o F1 la escribe y los demás la copian | Al fundir, los md5 de cuerpos de la agenda dejan de tener sentido (INVENTARIO §6): sólo se pre-vuelan objetos de `main` y la existencia de los del bloque anterior |
| **Leer la cita de la clínica con candado:** `SELECT … FROM appointments WHERE id = p_cita_id AND clinica_id = p_clinica_id FOR UPDATE` | Las RPC de F4 (`cita_confirmacion_*`, `cita_correo_tomar`, `cita_reagendar_*`), de F2 (`gcal_aplicar_evento`, `cita_rsvp_google`, `cita_movimiento_google_registrar`) y de F3 | — | — | Cada una pide columnas distintas: no compensa |

## 7. La tabla completa

**Columnas:**

- **objeto:** nombre, con firma si es función; `X ON tabla` para policies,
  disparadores, índices y restricciones.
- **migraciones:** en orden, cada una con su acción: CREATE, C/R (CREATE OR
  REPLACE), ADD, DROP, VALIDATE, COMMENT, GRANT o REVOKE.
- **final:** la migración que deja la versión vigente.


| objeto | tipo | dueño | migraciones que lo tocan (en orden) | final | notas |
|---|---|---|---|---|---|
| `agenda_ajustes` | tabla | F1 | b1_ajustes_interruptor CREATE | b1_ajustes_interruptor | 15 columnas en catálogo: 13 de b1 + recordatorio_encendido (h2) + correo_reserva_clinica (i5): la fusión la crea entera. F3 necesita candado_*, anticipacion_min_horas, horizonte_dias, vigencia_enlace_unico_dias; F4, recordatorio_horas, recordatorio_encendido y correo_reserva_clinica; todos, agenda_v2_encendida. El pre-vuelo de b1 exigía 13 columnas exactas: desaparece. |
| `respaldos.consultorios_horario_20261119` | tabla | F1 | g4_herencia_horario_consultorios CREATE | g4_herencia_horario_consultorios | Respaldo previo al backfill de G4. En producción sigue haciendo falta (hay consultorios con horario_propio=false al nacer la columna): conservar respaldo + UPDATE en F1. |
| `tipos_cita` | tabla | F1 | b6_tipos_cita CREATE | b6_tipos_cita | b6 + consultorio_id y principal (g2). Sin DELETE ni policy de DELETE (regla). |
| `agenda_ajustes.correo_reserva_clinica` | columna | F1 | i5_avisos_clinica ADD | i5_avisos_clinica |  |
| `agenda_ajustes.recordatorio_encendido` | columna | F1 | h2_recordatorio_interruptor ADD | h2_recordatorio_interruptor |  |
| `appointments.tipo_cita_id` | columna | F1 | b6_tipos_cita ADD | b6_tipos_cita | **[main]** COMMENT escrito en b6 y repetido en d1. |
| `appointments.tipo_cita_nombre` | columna | F1 | b6_tipos_cita ADD | b6_tipos_cita | **[main]** |
| `clinicas.timezone` | columna | F1 | k3_huso_clinica_pausa_enlace ADD | k3_huso_clinica_pausa_enlace | **[main]** Columna nueva en tabla de main (k3); contrato con spinus-consola: sólo se añade. Sólo «de fábrica». |
| `consultorios.horario_propio` | columna | F1 | b5_horario_propio ADD | b5_horario_propio | **[main]** Columna nueva en tabla de main. COMMENT reescrito en g4 (herencia). |
| `consultorios.horario_revisado_en` | columna | F1 | i4_horario_revisado ADD | i4_horario_revisado | **[main]** Columna nueva en tabla de main (i4). NULL = por revisar; nace NULL en todos. |
| `tipos_cita.consultorio_id` | columna | F1 | g2_duracion_consulta ADD | g2_duracion_consulta |  |
| `tipos_cita.principal` | columna | F1 | g2_duracion_consulta ADD | g2_duracion_consulta |  |
| `agenda_ajustes_anticipacion_rango ON agenda_ajustes` | restricción | F1 | b1_ajustes_interruptor CREATE | b1_ajustes_interruptor |  |
| `agenda_ajustes_candado_rango ON agenda_ajustes` | restricción | F1 | b1_ajustes_interruptor CREATE | b1_ajustes_interruptor |  |
| `agenda_ajustes_clinica_id_fkey ON agenda_ajustes` | restricción | F1 | b1_ajustes_interruptor CREATE | b1_ajustes_interruptor |  |
| `agenda_ajustes_clinica_key ON agenda_ajustes` | restricción | F1 | b1_ajustes_interruptor CREATE | b1_ajustes_interruptor |  |
| `agenda_ajustes_horizonte_rango ON agenda_ajustes` | restricción | F1 | b1_ajustes_interruptor CREATE | b1_ajustes_interruptor |  |
| `agenda_ajustes_pkey ON agenda_ajustes` | restricción | F1 | b1_ajustes_interruptor CREATE | b1_ajustes_interruptor |  |
| `agenda_ajustes_recordatorio_rango ON agenda_ajustes` | restricción | F1 | b1_ajustes_interruptor CREATE | b1_ajustes_interruptor |  |
| `agenda_ajustes_vigencia_rango ON agenda_ajustes` | restricción | F1 | b1_ajustes_interruptor CREATE | b1_ajustes_interruptor |  |
| `appointments_tipo_cita_fkey ON appointments` | restricción | F1 | b6_tipos_cita ADD | b6_tipos_cita | **[main]** |
| `appointments_tipo_cita_snapshot_check ON appointments` | restricción | F1 | b6_tipos_cita ADD | b6_tipos_cita | **[main]** |
| `tipos_cita_clinica_id_fkey ON tipos_cita` | restricción | F1 | b6_tipos_cita CREATE | b6_tipos_cita |  |
| `tipos_cita_color_check ON tipos_cita` | restricción | F1 | b6_tipos_cita CREATE | b6_tipos_cita |  |
| `tipos_cita_consultorio_check ON tipos_cita` | restricción | F1 | g2_duracion_consulta DROP → g2_duracion_consulta ADD | g2_duracion_consulta | DROP+ADD en la misma migración (idempotencia). |
| `tipos_cita_consultorio_id_fkey ON tipos_cita` | restricción | F1 | g2_duracion_consulta ADD | g2_duracion_consulta |  |
| `tipos_cita_duracion_check ON tipos_cita` | restricción | F1 | b6_tipos_cita CREATE | b6_tipos_cita |  |
| `tipos_cita_id_clinica_key ON tipos_cita` | restricción | F1 | b6_tipos_cita CREATE | b6_tipos_cita |  |
| `tipos_cita_medico_id_fkey ON tipos_cita` | restricción | F1 | b6_tipos_cita CREATE | b6_tipos_cita |  |
| `tipos_cita_nombre_check ON tipos_cita` | restricción | F1 | b6_tipos_cita CREATE | b6_tipos_cita |  |
| `tipos_cita_pkey ON tipos_cita` | restricción | F1 | b6_tipos_cita CREATE | b6_tipos_cita |  |
| `tipos_cita_principal_check ON tipos_cita` | restricción | F1 | g2_duracion_consulta DROP → g2_duracion_consulta ADD | g2_duracion_consulta | DROP+ADD en la misma migración (idempotencia). |
| `idx_appointments_tipo_cita ON appointments` | índice | F1 | b6_tipos_cita CREATE | b6_tipos_cita | **[main]** |
| `tipos_cita_consultorio ON tipos_cita` | índice | F1 | g2_duracion_consulta CREATE | g2_duracion_consulta |  |
| `tipos_cita_medico ON tipos_cita` | índice | F1 | b6_tipos_cita CREATE | b6_tipos_cita |  |
| `tipos_cita_nombre_activo_unico ON tipos_cita` | índice | F1 | b6_tipos_cita CREATE → g2_duracion_consulta CREATE → g2_duracion_consulta DROP | g2_duracion_consulta | Versión de b6 sin efecto; g2 la recrea con un predicado más estrecho (excluye las filas por consultorio). |
| `tipos_cita_principal_unico ON tipos_cita` | índice | F1 | g2_duracion_consulta CREATE | g2_duracion_consulta |  |
| `agenda_ajustes` | RLS | F1 | b1_ajustes_interruptor ENABLE | b1_ajustes_interruptor |  |
| `respaldos.consultorios_horario_20261119` | RLS | F1 | g4_herencia_horario_consultorios ENABLE | g4_herencia_horario_consultorios |  |
| `tipos_cita` | RLS | F1 | b6_tipos_cita ENABLE | b6_tipos_cita |  |
| `agenda_ajustes_insert ON agenda_ajustes` | policy | F1 | b1_ajustes_interruptor DROP → b1_ajustes_interruptor CREATE | b1_ajustes_interruptor |  |
| `agenda_ajustes_select ON agenda_ajustes` | policy | F1 | b1_ajustes_interruptor DROP → b1_ajustes_interruptor CREATE | b1_ajustes_interruptor |  |
| `agenda_ajustes_update ON agenda_ajustes` | policy | F1 | b1_ajustes_interruptor DROP → b1_ajustes_interruptor CREATE | b1_ajustes_interruptor |  |
| `tipos_cita_insert ON tipos_cita` | policy | F1 | b6_tipos_cita DROP → b6_tipos_cita CREATE → g2_duracion_consulta DROP → g2_duracion_consulta CREATE | g2_duracion_consulta | Versión de b6 sin efecto; final g2 (médico crea SUS tipos). |
| `tipos_cita_select ON tipos_cita` | policy | F1 | b6_tipos_cita DROP → b6_tipos_cita CREATE | b6_tipos_cita |  |
| `tipos_cita_update ON tipos_cita` | policy | F1 | b6_tipos_cita DROP → b6_tipos_cita CREATE → g2_tipos_cita_update DROP → g2_tipos_cita_update CREATE | g2_tipos_cita_update | Versión de b6 sin efecto; final g2-update (WITH CHECK = USING). |
| `agenda_restablecer_configuracion(uuid, uuid)` | función | F1 | h2_restablecer_configuracion C/R → i4_horario_revisado C/R | i4_horario_revisado | h2 sin efecto; final i4-horario (md5 1c390644). plpgsql: en ejecución toca reserva_enlaces (F3) y tipos_cita, y su UPDATE de reserva_enlaces pasa por proteger_reserva_enlaces (F3). El pre-vuelo de h2 exigía proteger_reserva_enlaces `acd4128b%`: en la fusión F1 no debe pre-volar objetos de F3, o este objeto va en un archivo posterior a F3. INVOKER a propósito (no DEFINER). |
| `log_cita_change()` | función | F1 | b0_auditoria_citas C/R → c2_gcal_aplicar C/R → e1_confirmacion_enlace C/R | e1_confirmacion_enlace | Cuerpos de b0 y c2 sin efecto; final e1 (md5 80c3556c, catálogo). La lista c_tecnicas va también en el WHEN de audit_appointments_update (van juntas). Lista blanca c_vias: `google` y `google_rsvp` (los pone F2), `enlace_paciente` (lo pone F4): F2 y F4 necesitan que F1 conserve esos literales. Escribe NOMBRES de columna, nunca valores. |
| `proteger_agenda_ajustes()` | función | F1 | b1_ajustes_interruptor C/R | b1_ajustes_interruptor | Interruptor sólo postgres/supabase_admin; DEFAULT de candado_* repetidos aquí (van con la tabla). Lee current_user (INVOKER: no hacerla DEFINER). |
| `update_tipos_cita_updated_at()` | función | F1 | b6_tipos_cita C/R | b6_tipos_cita |  |
| `validar_tipo_cita_consultorio()` | función | F1 | g2_duracion_consulta C/R | g2_duracion_consulta | g2. src/lib/agenda/tiposCita.ts traduce su error. |
| `validar_tipo_cita_medico()` | función | F1 | b6_tipos_cita C/R | b6_tipos_cita |  |
| `audit_agenda_ajustes ON agenda_ajustes` | disparador | F1 | b1_ajustes_interruptor C/R | b1_ajustes_interruptor |  |
| `trg_agenda_ajustes_proteger ON agenda_ajustes` | disparador | F1 | b1_ajustes_interruptor C/R | b1_ajustes_interruptor |  |
| `audit_appointments ON appointments` | disparador | F1 | b0_auditoria_citas C/R | b0_auditoria_citas | **[main]** |
| `audit_appointments_update ON appointments` | disparador | F1 | b0_auditoria_citas C/R | b0_auditoria_citas | **[main]** WHEN con la lista de columnas técnicas, duplicada en log_cita_change. c2 y e1 la comprueban por texto deparseado. |
| `audit_tipos_cita ON tipos_cita` | disparador | F1 | b6_tipos_cita C/R | b6_tipos_cita |  |
| `trg_tipos_cita_consultorio ON tipos_cita` | disparador | F1 | g2_duracion_consulta C/R | g2_duracion_consulta |  |
| `trg_tipos_cita_medico ON tipos_cita` | disparador | F1 | b6_tipos_cita C/R | b6_tipos_cita |  |
| `trg_tipos_cita_updated_at ON tipos_cita` | disparador | F1 | b6_tipos_cita C/R | b6_tipos_cita |  |
| `function agenda_restablecer_configuracion(uuid, uuid)` | GRANT/REVOKE | F1 | h2_restablecer_configuracion REVOKE → h2_restablecer_configuracion GRANT → i4_horario_revisado REVOKE → i4_horario_revisado GRANT | i4_horario_revisado |  |
| `function log_cita_change()` | GRANT/REVOKE | F1 | b0_auditoria_citas REVOKE → b0_auditoria_citas GRANT → c2_gcal_aplicar REVOKE → c2_gcal_aplicar GRANT → e1_confirmacion_enlace REVOKE → e1_confirmacion_enlace GRANT | e1_confirmacion_enlace |  |
| `function proteger_agenda_ajustes()` | GRANT/REVOKE | F1 | b1_ajustes_interruptor REVOKE → b1_ajustes_interruptor GRANT | b1_ajustes_interruptor |  |
| `function update_tipos_cita_updated_at()` | GRANT/REVOKE | F1 | b6_tipos_cita REVOKE → b6_tipos_cita GRANT | b6_tipos_cita |  |
| `function validar_tipo_cita_consultorio()` | GRANT/REVOKE | F1 | g2_duracion_consulta REVOKE → g2_duracion_consulta GRANT | g2_duracion_consulta |  |
| `function validar_tipo_cita_medico()` | GRANT/REVOKE | F1 | b6_tipos_cita REVOKE → b6_tipos_cita GRANT | b6_tipos_cita |  |
| `table agenda_ajustes` | GRANT/REVOKE | F1 | b1_ajustes_interruptor REVOKE | b1_ajustes_interruptor |  |
| `table respaldos.consultorios_horario_20261119` | GRANT/REVOKE | F1 | g4_herencia_horario_consultorios REVOKE | g4_herencia_horario_consultorios |  |
| `table tipos_cita` | GRANT/REVOKE | F1 | b6_tipos_cita REVOKE | b6_tipos_cita |  |
| `column agenda_ajustes.agenda_v2_encendida` | COMMENT | F1 | b1_ajustes_interruptor COMMENT | b1_ajustes_interruptor |  |
| `column agenda_ajustes.candado_citas_activas` | COMMENT | F1 | b1_ajustes_interruptor COMMENT | b1_ajustes_interruptor |  |
| `column agenda_ajustes.correo_reserva_clinica` | COMMENT | F1 | i5_avisos_clinica COMMENT | i5_avisos_clinica |  |
| `column agenda_ajustes.recordatorio_encendido` | COMMENT | F1 | h2_recordatorio_interruptor COMMENT | h2_recordatorio_interruptor |  |
| `column appointments.tipo_cita_id` | COMMENT | F1 | b6_tipos_cita COMMENT → d1_enlaces_reserva COMMENT | d1_enlaces_reserva | **[main]** |
| `column appointments.tipo_cita_nombre` | COMMENT | F1 | b6_tipos_cita COMMENT | b6_tipos_cita | **[main]** |
| `column clinicas.timezone` | COMMENT | F1 | k3_huso_clinica_pausa_enlace COMMENT | k3_huso_clinica_pausa_enlace | **[main]** |
| `column consultorios.horario_propio` | COMMENT | F1 | b5_horario_propio COMMENT → g4_herencia_horario_consultorios COMMENT | g4_herencia_horario_consultorios | **[main]** |
| `column consultorios.horario_revisado_en` | COMMENT | F1 | i4_horario_revisado COMMENT | i4_horario_revisado | **[main]** |
| `column tipos_cita.consultorio_id` | COMMENT | F1 | g2_duracion_consulta COMMENT | g2_duracion_consulta |  |
| `column tipos_cita.principal` | COMMENT | F1 | g2_duracion_consulta COMMENT | g2_duracion_consulta |  |
| `function agenda_restablecer_configuracion(uuid, uuid)` | COMMENT | F1 | h2_restablecer_configuracion COMMENT → i4_horario_revisado COMMENT | i4_horario_revisado |  |
| `function log_cita_change()` | COMMENT | F1 | b0_auditoria_citas COMMENT → c2_gcal_aplicar COMMENT → e1_confirmacion_enlace COMMENT | e1_confirmacion_enlace |  |
| `table agenda_ajustes` | COMMENT | F1 | b1_ajustes_interruptor COMMENT | b1_ajustes_interruptor |  |
| `table respaldos.consultorios_horario_20261119` | COMMENT | F1 | g4_herencia_horario_consultorios COMMENT | g4_herencia_horario_consultorios |  |
| `table tipos_cita` | COMMENT | F1 | b6_tipos_cita COMMENT | b6_tipos_cita |  |
| `consultorios` | datos | F1 | g4_herencia_horario_consultorios DML_UPDATE | g4_herencia_horario_consultorios | **[main]** Backfill de G4: UPDATE de todos los consultorios con horario_propio=false (horario := clinicas.horario_consulta, horario_propio := true), audit_log por fila vía audit_consultorios. Sigue haciendo falta en producción. Pre-vuelo 1.4 (médicos sin predeterminado activo) depende de datos reales. |
| `respaldos.consultorios_horario_20261119` | datos | F1 | g4_herencia_horario_consultorios DML_INSERT | g4_herencia_horario_consultorios | Copia de respaldo antes del UPDATE de G4. |
| `gcal_movimientos_rechazados` | tabla | F2 | j4_aviso_google_reserva CREATE | j4_aviso_google_reserva | j4. La semilla la borra antes que las clínicas (regla de CLAUDE.md). |
| `gcal_sync_estado` | tabla | F2 | c1_gcal_sync_estado CREATE | c1_gcal_sync_estado |  |
| `reserva_empalmes_google` | tabla | F2 | d11_sync_antes_de_reservar CREATE | d11_sync_antes_de_reservar |  |
| `appointments.google_asignacion` | columna | F2 | i3_por_asignar_google ADD | i3_por_asignar_google | **[main]** i3; CHECK con origen=google. |
| `appointments_google_asignacion_check ON appointments` | restricción | F2 | i3_por_asignar_google ADD → i3_por_asignar_google VALIDATE | i3_por_asignar_google | **[main]** NOT VALID + VALIDATE en la misma transacción (no gana nada, lo admite la cabecera): al fundir, CHECK normal. |
| `gcal_movimientos_rechazados_clinica_id_fkey ON gcal_movimientos_rechazados` | restricción | F2 | j4_aviso_google_reserva CREATE | j4_aviso_google_reserva |  |
| `gcal_movimientos_rechazados_intento_key ON gcal_movimientos_rechazados` | restricción | F2 | j4_aviso_google_reserva CREATE | j4_aviso_google_reserva |  |
| `gcal_movimientos_rechazados_pkey ON gcal_movimientos_rechazados` | restricción | F2 | j4_aviso_google_reserva CREATE | j4_aviso_google_reserva |  |
| `gcal_sync_estado_candado_par ON gcal_sync_estado` | restricción | F2 | c1_gcal_sync_estado CREATE | c1_gcal_sync_estado |  |
| `gcal_sync_estado_clinica_id_fkey ON gcal_sync_estado` | restricción | F2 | c1_gcal_sync_estado CREATE | c1_gcal_sync_estado |  |
| `gcal_sync_estado_clinica_key ON gcal_sync_estado` | restricción | F2 | c1_gcal_sync_estado CREATE | c1_gcal_sync_estado |  |
| `gcal_sync_estado_contadores ON gcal_sync_estado` | restricción | F2 | c1_gcal_sync_estado CREATE | c1_gcal_sync_estado |  |
| `gcal_sync_estado_error_corto ON gcal_sync_estado` | restricción | F2 | c1_gcal_sync_estado CREATE | c1_gcal_sync_estado |  |
| `gcal_sync_estado_fase_check ON gcal_sync_estado` | restricción | F2 | c1_gcal_sync_estado CREATE | c1_gcal_sync_estado |  |
| `gcal_sync_estado_incremental_con_token ON gcal_sync_estado` | restricción | F2 | c1_gcal_sync_estado CREATE | c1_gcal_sync_estado |  |
| `gcal_sync_estado_pkey ON gcal_sync_estado` | restricción | F2 | c1_gcal_sync_estado CREATE | c1_gcal_sync_estado |  |
| `reserva_empalmes_google_clinica_id_fkey ON reserva_empalmes_google` | restricción | F2 | d11_sync_antes_de_reservar CREATE | d11_sync_antes_de_reservar |  |
| `reserva_empalmes_google_distintas ON reserva_empalmes_google` | restricción | F2 | d11_sync_antes_de_reservar CREATE | d11_sync_antes_de_reservar |  |
| `reserva_empalmes_google_par_key ON reserva_empalmes_google` | restricción | F2 | d11_sync_antes_de_reservar CREATE | d11_sync_antes_de_reservar |  |
| `reserva_empalmes_google_pkey ON reserva_empalmes_google` | restricción | F2 | d11_sync_antes_de_reservar CREATE | d11_sync_antes_de_reservar |  |
| `gcal_movimientos_rechazados_clinica_idx ON gcal_movimientos_rechazados` | índice | F2 | j4_aviso_google_reserva CREATE | j4_aviso_google_reserva |  |
| `reserva_empalmes_google_clinica_idx ON reserva_empalmes_google` | índice | F2 | d11_sync_antes_de_reservar CREATE | d11_sync_antes_de_reservar |  |
| `gcal_movimientos_rechazados` | RLS | F2 | j4_aviso_google_reserva ENABLE | j4_aviso_google_reserva |  |
| `gcal_sync_estado` | RLS | F2 | c1_gcal_sync_estado ENABLE | c1_gcal_sync_estado |  |
| `reserva_empalmes_google` | RLS | F2 | d11_sync_antes_de_reservar ENABLE | d11_sync_antes_de_reservar |  |
| `reserva_empalmes_google_select ON reserva_empalmes_google` | policy | F2 | d11_sync_antes_de_reservar DROP → d11_sync_antes_de_reservar CREATE | d11_sync_antes_de_reservar |  |
| `cita_asignacion_google()` | función | F2 | i3_por_asignar_google C/R | i3_por_asignar_google | Único BEFORE de appointments que asigna NEW (google_asignacion); lee spinus.via y current_user. Su marca la usan F4 (trg_appointments_aviso_clinica WHEN) y src (esPorAsignar). |
| `cita_movimiento_google_registrar(uuid, uuid, timestamptz)` | función | F2 | j4_aviso_google_reserva C/R | j4_aviso_google_reserva | J4. Su aviso (aviso_clinica_de_movimiento_google y su disparador) lo tiene F4 con los demás aviso_clinica_de_*: una sola CHECK de tipos. |
| `cita_rsvp_google(uuid, uuid, text, text, text[])` | función | F2 | e9_rsvp_google C/R | e9_rsvp_google | E9. Asignada a F2 porque la llama la sincronización (gcalSincronizacionBase, gcalRsvp). Escribe status con via google_rsvp (lista blanca de F1). F4 necesita que su efecto (confirmada) sea el mismo que el de la confirmación por enlace. |
| `gcal_aplicar_evento(uuid, uuid, timestamptz, text, text, timestamptz, text, boolean, timestamptz, timestamptz, boolean, text, boolean, text, boolean)` | función | F2 | c2_gcal_aplicar C/R → d4_gcal_por_ligar C/R | d4_gcal_por_ligar | c2 sin efecto; final d4 (5ac551e4). Pone spinus.via=google. |
| `gcal_bloqueo_aplicar(uuid, text, text, uuid, text, timestamptz, boolean, timestamptz, timestamptz, date, date)` | función | F2 | k1_bloqueos C/R | k1_bloqueos | K1. Escribe agenda_bloqueos (F5a) y toma el candado 1790 igual que reservar_por_enlace (F3) y agenda_bloqueo_preparar (F5): las tres deben usar la MISMA clave (1790, hashtext(medico_id)). Nunca crea bloqueos. |
| `gcal_citas_por_evento(uuid, text[], uuid[])` | función | F2 | c2_gcal_aplicar C/R → d4_gcal_por_ligar C/R | d4_gcal_por_ligar | c2 sin efecto; final d4 (66feb69a). Lee reserva_canal/reserva_nombre (F3) en ejecución. |
| `gcal_importar_evento(uuid, text, text, text, timestamptz, text, timestamptz, timestamptz, boolean, text, text, uuid)` | función | F2 | c2_gcal_aplicar C/R | c2_gcal_aplicar | c2 (9e0c7f19). i3 comprueba por regex en prosrc que haga set_config('spinus.via','google') y el INSERT: cita_asignacion_google depende de eso. |
| `gcal_sync_avanzar(uuid, uuid, text, text, timestamptz, integer)` | función | F2 | c1_gcal_sync_estado C/R | c1_gcal_sync_estado |  |
| `gcal_sync_clinica_habilitada(uuid)` | función | F2 | c1_gcal_sync_estado C/R | c1_gcal_sync_estado | Puerta S3. Lee de pg_proc el cuerpo VIGENTE de clinica_no_suspendida() y clinica_tiene_acceso() (main) y lo ejecuta con EXECUTE; falla cerrada (P0001) si cambian de forma. La llaman F3 (reserva_contexto, reservar_por_enlace, reserva_codigo_emitir), F4 (cita_confirmacion_emitir, cita_correo_tomar y las dos SQL cita_*_pendientes, que se validan al crear ⇒ F2 antes que F4) y F2. feature/limites-ajustables NO cambia esas dos funciones. |
| `gcal_sync_clinicas_pendientes(integer)` | función | F2 | c1_gcal_sync_estado C/R | c1_gcal_sync_estado |  |
| `gcal_sync_frescura(uuid)` | función | F2 | d11_sync_antes_de_reservar C/R | d11_sync_antes_de_reservar | D11 (SQL). La usa la reserva antes de ofrecer turnos (F3 la necesita). |
| `gcal_sync_reiniciar(uuid, uuid)` | función | F2 | c1_gcal_sync_estado C/R | c1_gcal_sync_estado |  |
| `gcal_sync_soltar(uuid, uuid, text)` | función | F2 | c1_gcal_sync_estado C/R | c1_gcal_sync_estado |  |
| `gcal_sync_tomar(uuid, uuid, text, integer, integer)` | función | F2 | c1_gcal_sync_estado C/R | c1_gcal_sync_estado |  |
| `reserva_empalmes_registrar(uuid, uuid[])` | función | F2 | d11_sync_antes_de_reservar C/R | d11_sync_antes_de_reservar | D11. F2 porque la escribe la sincronización; F4 cuelga aviso_clinica_de_empalme de su tabla. |
| `trg_appointments_asignacion_google ON appointments` | disparador | F2 | i3_por_asignar_google C/R | i3_por_asignar_google | **[main]** Dueño F2. BEFORE: corre primero por orden alfabético. |
| `function cita_asignacion_google()` | GRANT/REVOKE | F2 | i3_por_asignar_google REVOKE → i3_por_asignar_google GRANT | i3_por_asignar_google |  |
| `function cita_movimiento_google_registrar(uuid, uuid, timestamptz)` | GRANT/REVOKE | F2 | j4_aviso_google_reserva REVOKE → j4_aviso_google_reserva GRANT | j4_aviso_google_reserva |  |
| `function cita_rsvp_google(uuid, uuid, text, text, text[])` | GRANT/REVOKE | F2 | e9_rsvp_google REVOKE → e9_rsvp_google GRANT | e9_rsvp_google |  |
| `function gcal_aplicar_evento(uuid, uuid, timestamptz, text, text, timestamptz, text, boolean, timestamptz, timestamptz, boolean, text, boolean, text, boolean)` | GRANT/REVOKE | F2 | c2_gcal_aplicar REVOKE → c2_gcal_aplicar GRANT → d4_gcal_por_ligar REVOKE → d4_gcal_por_ligar GRANT | d4_gcal_por_ligar |  |
| `function gcal_bloqueo_aplicar(uuid, text, text, uuid, text, timestamptz, boolean, timestamptz, timestamptz, date, date)` | GRANT/REVOKE | F2 | k1_bloqueos REVOKE → k1_bloqueos GRANT | k1_bloqueos |  |
| `function gcal_citas_por_evento(uuid, text[], uuid[])` | GRANT/REVOKE | F2 | c2_gcal_aplicar REVOKE → c2_gcal_aplicar GRANT → d4_gcal_por_ligar REVOKE → d4_gcal_por_ligar GRANT | d4_gcal_por_ligar |  |
| `function gcal_importar_evento(uuid, text, text, text, timestamptz, text, timestamptz, timestamptz, boolean, text, text, uuid)` | GRANT/REVOKE | F2 | c2_gcal_aplicar REVOKE → c2_gcal_aplicar GRANT | c2_gcal_aplicar |  |
| `function gcal_sync_avanzar(uuid, uuid, text, text, timestamptz, integer)` | GRANT/REVOKE | F2 | c1_gcal_sync_estado REVOKE → c1_gcal_sync_estado GRANT | c1_gcal_sync_estado |  |
| `function gcal_sync_clinica_habilitada(uuid)` | GRANT/REVOKE | F2 | c1_gcal_sync_estado REVOKE → c1_gcal_sync_estado GRANT | c1_gcal_sync_estado |  |
| `function gcal_sync_clinicas_pendientes(integer)` | GRANT/REVOKE | F2 | c1_gcal_sync_estado REVOKE → c1_gcal_sync_estado GRANT | c1_gcal_sync_estado |  |
| `function gcal_sync_frescura(uuid)` | GRANT/REVOKE | F2 | d11_sync_antes_de_reservar REVOKE → d11_sync_antes_de_reservar GRANT | d11_sync_antes_de_reservar |  |
| `function gcal_sync_reiniciar(uuid, uuid)` | GRANT/REVOKE | F2 | c1_gcal_sync_estado REVOKE → c1_gcal_sync_estado GRANT | c1_gcal_sync_estado |  |
| `function gcal_sync_soltar(uuid, uuid, text)` | GRANT/REVOKE | F2 | c1_gcal_sync_estado REVOKE → c1_gcal_sync_estado GRANT | c1_gcal_sync_estado |  |
| `function gcal_sync_tomar(uuid, uuid, text, integer, integer)` | GRANT/REVOKE | F2 | c1_gcal_sync_estado REVOKE → c1_gcal_sync_estado GRANT | c1_gcal_sync_estado |  |
| `function reserva_empalmes_registrar(uuid, uuid[])` | GRANT/REVOKE | F2 | d11_sync_antes_de_reservar REVOKE → d11_sync_antes_de_reservar GRANT | d11_sync_antes_de_reservar |  |
| `table gcal_movimientos_rechazados` | GRANT/REVOKE | F2 | j4_aviso_google_reserva REVOKE → j4_aviso_google_reserva GRANT | j4_aviso_google_reserva |  |
| `table gcal_sync_estado` | GRANT/REVOKE | F2 | c1_gcal_sync_estado REVOKE → c1_gcal_sync_estado GRANT | c1_gcal_sync_estado |  |
| `table reserva_empalmes_google` | GRANT/REVOKE | F2 | d11_sync_antes_de_reservar REVOKE → d11_sync_antes_de_reservar GRANT | d11_sync_antes_de_reservar |  |
| `column appointments.google_asignacion` | COMMENT | F2 | i3_por_asignar_google COMMENT | i3_por_asignar_google | **[main]** |
| `column gcal_sync_estado.ventana_desde` | COMMENT | F2 | c1_gcal_sync_estado COMMENT | c1_gcal_sync_estado |  |
| `function cita_asignacion_google()` | COMMENT | F2 | i3_por_asignar_google COMMENT | i3_por_asignar_google |  |
| `function cita_movimiento_google_registrar(uuid, uuid, timestamptz)` | COMMENT | F2 | j4_aviso_google_reserva COMMENT | j4_aviso_google_reserva |  |
| `function cita_rsvp_google(uuid, uuid, text, text, text[])` | COMMENT | F2 | e9_rsvp_google COMMENT | e9_rsvp_google |  |
| `function gcal_aplicar_evento(uuid, uuid, timestamptz, text, text, timestamptz, text, boolean, timestamptz, timestamptz, boolean, text, boolean, text, boolean)` | COMMENT | F2 | d4_gcal_por_ligar COMMENT | d4_gcal_por_ligar |  |
| `function gcal_bloqueo_aplicar(uuid, text, text, uuid, text, timestamptz, boolean, timestamptz, timestamptz, date, date)` | COMMENT | F2 | k1_bloqueos COMMENT | k1_bloqueos |  |
| `function gcal_citas_por_evento(uuid, text[], uuid[])` | COMMENT | F2 | d4_gcal_por_ligar COMMENT | d4_gcal_por_ligar |  |
| `function gcal_sync_clinica_habilitada(uuid)` | COMMENT | F2 | c1_gcal_sync_estado COMMENT | c1_gcal_sync_estado |  |
| `function gcal_sync_frescura(uuid)` | COMMENT | F2 | d11_sync_antes_de_reservar COMMENT | d11_sync_antes_de_reservar |  |
| `function reserva_empalmes_registrar(uuid, uuid[])` | COMMENT | F2 | d11_sync_antes_de_reservar COMMENT | d11_sync_antes_de_reservar |  |
| `table gcal_movimientos_rechazados` | COMMENT | F2 | j4_aviso_google_reserva COMMENT | j4_aviso_google_reserva |  |
| `table gcal_sync_estado` | COMMENT | F2 | c1_gcal_sync_estado COMMENT | c1_gcal_sync_estado |  |
| `table reserva_empalmes_google` | COMMENT | F2 | d11_sync_antes_de_reservar COMMENT | d11_sync_antes_de_reservar |  |
| `reserva_avisos` | tabla | F3 | d1_enlaces_reserva CREATE | d1_enlaces_reserva |  |
| `reserva_contactos` | tabla | F3 | d2_candado_reserva CREATE | d2_candado_reserva |  |
| `reserva_enlaces` | tabla | F3 | d1_enlaces_reserva CREATE | d1_enlaces_reserva | d1 + correo, correo_hmac, intentos, agotado_en (j2) + pausado_en (k3). |
| `reserva_incidencias` | tabla | F3 | d2_candado_reserva CREATE | d2_candado_reserva |  |
| `reserva_verificaciones` | tabla | F3 | d3_reservar CREATE | d3_reservar |  |
| `appointments.reserva_aceptado_en` | columna | F3 | d1_enlaces_reserva ADD | d1_enlaces_reserva | **[main]** |
| `appointments.reserva_aviso_version` | columna | F3 | d1_enlaces_reserva ADD | d1_enlaces_reserva | **[main]** |
| `appointments.reserva_canal` | columna | F3 | d1_enlaces_reserva ADD | d1_enlaces_reserva | **[main]** |
| `appointments.reserva_correo` | columna | F3 | d1_enlaces_reserva ADD | d1_enlaces_reserva | **[main]** |
| `appointments.reserva_correo_hmac` | columna | F3 | d1_enlaces_reserva ADD | d1_enlaces_reserva | **[main]** COMMENT reescrito en j2 (seudónimo del único sin correo, i2). |
| `appointments.reserva_enlace_id` | columna | F3 | d1_enlaces_reserva ADD | d1_enlaces_reserva | **[main]** |
| `appointments.reserva_historial_previo` | columna | F3 | d1_enlaces_reserva ADD | d1_enlaces_reserva | **[main]** |
| `appointments.reserva_nombre` | columna | F3 | d1_enlaces_reserva ADD | d1_enlaces_reserva | **[main]** COMMENT reescrito en d4. Lo leen cita_nombre_saludo (F4, SQL) y gcal_citas_por_evento (F2). |
| `appointments.reserva_reagendados` | columna | F3 | d1_enlaces_reserva ADD | d1_enlaces_reserva | **[main]** NOT NULL DEFAULT 0: la única reserva_* con DEFAULT que tolera cita_proteger_reserva (F5). COMMENT reescrito en e6. |
| `appointments.reserva_tel_hmac` | columna | F3 | d1_enlaces_reserva ADD | d1_enlaces_reserva | **[main]** |
| `appointments.reserva_telefono` | columna | F3 | d1_enlaces_reserva ADD | d1_enlaces_reserva | **[main]** |
| `reserva_enlaces.agotado_en` | columna | F3 | j2_unico_tope_correo ADD | j2_unico_tope_correo |  |
| `reserva_enlaces.correo` | columna | F3 | j2_unico_tope_correo ADD | j2_unico_tope_correo |  |
| `reserva_enlaces.correo_hmac` | columna | F3 | j2_unico_tope_correo ADD | j2_unico_tope_correo |  |
| `reserva_enlaces.intentos` | columna | F3 | j2_unico_tope_correo ADD | j2_unico_tope_correo |  |
| `reserva_enlaces.pausado_en` | columna | F3 | k3_huso_clinica_pausa_enlace ADD | k3_huso_clinica_pausa_enlace |  |
| `appointments_reserva_aviso_fkey ON appointments` | restricción | F3 | d1_enlaces_reserva ADD | d1_enlaces_reserva | **[main]** |
| `appointments_reserva_check ON appointments` | restricción | F3 | d1_enlaces_reserva ADD | d1_enlaces_reserva | **[main]** Su fórmula la exige d1 por md5 (12f5eb0a, sin «public.»); i2 exige que siga admitiendo reserva_correo NULL. |
| `appointments_reserva_enlace_fkey ON appointments` | restricción | F3 | d1_enlaces_reserva ADD | d1_enlaces_reserva | **[main]** |
| `appointments_reserva_reagendados_check ON appointments` | restricción | F3 | d1_enlaces_reserva ADD | d1_enlaces_reserva | **[main]** |
| `reserva_avisos_aprobado_check ON reserva_avisos` | restricción | F3 | d1_enlaces_reserva CREATE | d1_enlaces_reserva |  |
| `reserva_avisos_id_key ON reserva_avisos` | restricción | F3 | d1_enlaces_reserva CREATE | d1_enlaces_reserva |  |
| `reserva_avisos_pkey ON reserva_avisos` | restricción | F3 | d1_enlaces_reserva CREATE | d1_enlaces_reserva |  |
| `reserva_avisos_sha_check ON reserva_avisos` | restricción | F3 | d1_enlaces_reserva CREATE | d1_enlaces_reserva |  |
| `reserva_avisos_version_check ON reserva_avisos` | restricción | F3 | d1_enlaces_reserva CREATE | d1_enlaces_reserva |  |
| `reserva_contactos_bloqueado_por_fkey ON reserva_contactos` | restricción | F3 | d2_candado_reserva CREATE | d2_candado_reserva |  |
| `reserva_contactos_clase_check ON reserva_contactos` | restricción | F3 | d2_candado_reserva CREATE | d2_candado_reserva |  |
| `reserva_contactos_clave_key ON reserva_contactos` | restricción | F3 | d2_candado_reserva CREATE | d2_candado_reserva |  |
| `reserva_contactos_clinica_fkey ON reserva_contactos` | restricción | F3 | d2_candado_reserva CREATE | d2_candado_reserva |  |
| `reserva_contactos_hmac_check ON reserva_contactos` | restricción | F3 | d2_candado_reserva CREATE | d2_candado_reserva |  |
| `reserva_contactos_medico_fkey ON reserva_contactos` | restricción | F3 | d2_candado_reserva CREATE | d2_candado_reserva |  |
| `reserva_contactos_perdonado_por_fkey ON reserva_contactos` | restricción | F3 | d2_candado_reserva CREATE | d2_candado_reserva |  |
| `reserva_contactos_pkey ON reserva_contactos` | restricción | F3 | d2_candado_reserva CREATE | d2_candado_reserva |  |
| `reserva_enlaces_clase_check ON reserva_enlaces` | restricción | F3 | d1_enlaces_reserva CREATE | d1_enlaces_reserva |  |
| `reserva_enlaces_clinica_id_fkey ON reserva_enlaces` | restricción | F3 | d1_enlaces_reserva CREATE | d1_enlaces_reserva |  |
| `reserva_enlaces_codigo_check ON reserva_enlaces` | restricción | F3 | d1_enlaces_reserva CREATE | d1_enlaces_reserva |  |
| `reserva_enlaces_codigo_key ON reserva_enlaces` | restricción | F3 | d1_enlaces_reserva CREATE | d1_enlaces_reserva |  |
| `reserva_enlaces_correo_check ON reserva_enlaces` | restricción | F3 | j2_unico_tope_correo DROP → j2_unico_tope_correo ADD | j2_unico_tope_correo | DROP+ADD en la misma migración (idempotencia), no reescritura. |
| `reserva_enlaces_created_by_fkey ON reserva_enlaces` | restricción | F3 | d1_enlaces_reserva CREATE | d1_enlaces_reserva |  |
| `reserva_enlaces_etiqueta_check ON reserva_enlaces` | restricción | F3 | d1_enlaces_reserva CREATE | d1_enlaces_reserva |  |
| `reserva_enlaces_id_clinica_key ON reserva_enlaces` | restricción | F3 | d1_enlaces_reserva CREATE | d1_enlaces_reserva |  |
| `reserva_enlaces_intentos_check ON reserva_enlaces` | restricción | F3 | j2_unico_tope_correo DROP → j2_unico_tope_correo ADD | j2_unico_tope_correo | DROP+ADD en la misma migración (idempotencia). |
| `reserva_enlaces_medico_id_fkey ON reserva_enlaces` | restricción | F3 | d1_enlaces_reserva CREATE | d1_enlaces_reserva |  |
| `reserva_enlaces_pausado_check ON reserva_enlaces` | restricción | F3 | k3_huso_clinica_pausa_enlace ADD | k3_huso_clinica_pausa_enlace |  |
| `reserva_enlaces_pkey ON reserva_enlaces` | restricción | F3 | d1_enlaces_reserva CREATE | d1_enlaces_reserva |  |
| `reserva_enlaces_revocado_check ON reserva_enlaces` | restricción | F3 | d1_enlaces_reserva CREATE | d1_enlaces_reserva |  |
| `reserva_enlaces_revocado_por_fkey ON reserva_enlaces` | restricción | F3 | d1_enlaces_reserva CREATE | d1_enlaces_reserva |  |
| `reserva_enlaces_usado_cita_fkey ON reserva_enlaces` | restricción | F3 | d1_enlaces_reserva ADD | d1_enlaces_reserva |  |
| `reserva_enlaces_uso_check ON reserva_enlaces` | restricción | F3 | d1_enlaces_reserva CREATE | d1_enlaces_reserva |  |
| `reserva_enlaces_vigencia_check ON reserva_enlaces` | restricción | F3 | d1_enlaces_reserva CREATE | d1_enlaces_reserva |  |
| `reserva_incidencias_cita_fkey ON reserva_incidencias` | restricción | F3 | d2_candado_reserva CREATE | d2_candado_reserva |  |
| `reserva_incidencias_clinica_fkey ON reserva_incidencias` | restricción | F3 | d2_candado_reserva CREATE | d2_candado_reserva |  |
| `reserva_incidencias_hmac_check ON reserva_incidencias` | restricción | F3 | d2_candado_reserva CREATE | d2_candado_reserva |  |
| `reserva_incidencias_medico_fkey ON reserva_incidencias` | restricción | F3 | d2_candado_reserva CREATE | d2_candado_reserva |  |
| `reserva_incidencias_pkey ON reserva_incidencias` | restricción | F3 | d2_candado_reserva CREATE | d2_candado_reserva |  |
| `reserva_incidencias_tipo_check ON reserva_incidencias` | restricción | F3 | d2_candado_reserva CREATE | d2_candado_reserva |  |
| `reserva_verificaciones_enlace_fkey ON reserva_verificaciones` | restricción | F3 | d3_reservar CREATE | d3_reservar |  |
| `reserva_verificaciones_estado_check ON reserva_verificaciones` | restricción | F3 | d3_reservar CREATE | d3_reservar |  |
| `reserva_verificaciones_ficha_key ON reserva_verificaciones` | restricción | F3 | d3_reservar CREATE | d3_reservar |  |
| `reserva_verificaciones_hmac_check ON reserva_verificaciones` | restricción | F3 | d3_reservar CREATE | d3_reservar |  |
| `reserva_verificaciones_intentos_check ON reserva_verificaciones` | restricción | F3 | d3_reservar CREATE | d3_reservar |  |
| `reserva_verificaciones_pkey ON reserva_verificaciones` | restricción | F3 | d3_reservar CREATE | d3_reservar |  |
| `idx_appointments_reserva_correo ON appointments` | índice | F3 | d1_enlaces_reserva CREATE | d1_enlaces_reserva | **[main]** |
| `idx_appointments_reserva_enlace ON appointments` | índice | F3 | d1_enlaces_reserva CREATE | d1_enlaces_reserva | **[main]** |
| `idx_appointments_reserva_tel ON appointments` | índice | F3 | d1_enlaces_reserva CREATE | d1_enlaces_reserva | **[main]** |
| `reserva_enlaces_fijo_vigente ON reserva_enlaces` | índice | F3 | d1_enlaces_reserva CREATE | d1_enlaces_reserva |  |
| `reserva_enlaces_por_medico ON reserva_enlaces` | índice | F3 | d1_enlaces_reserva CREATE | d1_enlaces_reserva |  |
| `reserva_incidencias_cita ON reserva_incidencias` | índice | F3 | d2_candado_reserva CREATE | d2_candado_reserva |  |
| `reserva_incidencias_correo ON reserva_incidencias` | índice | F3 | d2_candado_reserva CREATE | d2_candado_reserva |  |
| `reserva_incidencias_tel ON reserva_incidencias` | índice | F3 | d2_candado_reserva CREATE | d2_candado_reserva |  |
| `reserva_verificaciones_busqueda ON reserva_verificaciones` | índice | F3 | d3_reservar CREATE | d3_reservar |  |
| `reserva_avisos` | RLS | F3 | d1_enlaces_reserva ENABLE | d1_enlaces_reserva |  |
| `reserva_contactos` | RLS | F3 | d2_candado_reserva ENABLE | d2_candado_reserva |  |
| `reserva_enlaces` | RLS | F3 | d1_enlaces_reserva ENABLE | d1_enlaces_reserva |  |
| `reserva_incidencias` | RLS | F3 | d2_candado_reserva ENABLE | d2_candado_reserva |  |
| `reserva_verificaciones` | RLS | F3 | d3_reservar ENABLE | d3_reservar |  |
| `reserva_avisos_select ON reserva_avisos` | policy | F3 | d1_enlaces_reserva DROP → d1_enlaces_reserva CREATE | d1_enlaces_reserva |  |
| `reserva_contactos_insert ON reserva_contactos` | policy | F3 | d2_candado_reserva DROP → d2_candado_reserva CREATE | d2_candado_reserva |  |
| `reserva_contactos_select ON reserva_contactos` | policy | F3 | d2_candado_reserva DROP → d2_candado_reserva CREATE | d2_candado_reserva |  |
| `reserva_contactos_update ON reserva_contactos` | policy | F3 | d2_candado_reserva DROP → d2_candado_reserva CREATE | d2_candado_reserva |  |
| `reserva_enlaces_insert ON reserva_enlaces` | policy | F3 | d1_enlaces_reserva DROP → d1_enlaces_reserva CREATE | d1_enlaces_reserva | **SIN EFECTO** Desde seg-emisión el disparador trg_reserva_enlaces_proteger rechaza todo INSERT que no sea de service_role, y service_role no pasa por la RLS: la policy no deja pasar nada. Conservar por defensa en profundidad o quitarla es decisión (no cambia el comportamiento). |
| `reserva_enlaces_select ON reserva_enlaces` | policy | F3 | d1_enlaces_reserva DROP → d1_enlaces_reserva CREATE | d1_enlaces_reserva |  |
| `reserva_enlaces_update ON reserva_enlaces` | policy | F3 | d1_enlaces_reserva DROP → d1_enlaces_reserva CREATE | d1_enlaces_reserva |  |
| `reserva_incidencias_select ON reserva_incidencias` | policy | F3 | d2_candado_reserva DROP → d2_candado_reserva CREATE | d2_candado_reserva |  |
| `proteger_reserva_contactos()` | función | F3 | d2_candado_reserva C/R | d2_candado_reserva |  |
| `proteger_reserva_enlace_unico()` | función | F3 | j2_unico_tope_correo C/R | j2_unico_tope_correo | j2. Correo inmutable; intentos sólo hacia arriba y sólo service_role. |
| `proteger_reserva_enlaces()` | función | F3 | d1_enlaces_reserva C/R → seg_emision_enlaces C/R | seg_emision_enlaces | d1 sin efecto; final seg-emisión (md5 acd4128b, catálogo). La exigen por md5 h2-restablecer, j2 y k3. Regla CLAUDE.md: quien la reemplace parte de este cuerpo. Rechaza todo INSERT que no sea service_role. |
| `rate_limit_espera(text, integer, integer)` | función | F3 | k2_espera_codigo C/R | k2_espera_codigo | k2. Lee ip_rate_limits de main (auth_02). Entra en el caso 3 de p1. |
| `reserva_codigo_emitir(uuid, uuid, text, text)` | función | F3 | d3_reservar C/R → k3_huso_clinica_pausa_enlace C/R | k3_huso_clinica_pausa_enlace | d3, k3; final k3 (d24c01e9). |
| `reserva_codigo_verificar(uuid, uuid, text, text, text)` | función | F3 | d3_reservar C/R → k2_espera_codigo C/R | k2_espera_codigo | d3, k2; final k2 (c3deded3, rama `reemplazado`). |
| `reserva_contacto_estado(uuid, uuid, text, text)` | función | F3 | d2_candado_reserva C/R → seg1_candado_correo C/R | seg1_candado_correo | SQL. d2, seg1; final seg1 (52ca884f). Cuenta por correo_hmac (decisión de Angel). Necesita reserva_contactos, reserva_incidencias y agenda_ajustes.candado_*. |
| `reserva_contacto_marcar(uuid, text)` | función | F3 | d2_candado_reserva C/R | d2_candado_reserva |  |
| `reserva_contactos_bloqueados()` | función | F3 | d2_candado_reserva C/R | d2_candado_reserva | SQL (llama reserva_contacto_estado). |
| `reserva_contexto(text, text, text)` | función | F3 | d3_reservar C/R → g2_duracion_consulta C/R → j2_unico_tope_correo C/R → k3_huso_clinica_pausa_enlace C/R | k3_huso_clinica_pausa_enlace | d3, g2, j2, k3; final k3 (e8be3201). Lee tipos_cita.principal/consultorio_id y consultorios.horario_propio (F1), la puerta S3 (F2). |
| `reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text)` | función | F3 | seg_emision_enlaces C/R → j2_unico_tope_correo C/R | j2_unico_tope_correo | **SIN EFECTO** (tras fundir) Firma de 7 conservada por compatibilidad de despliegue (AG-DT-137); j2 la vuelve a pegar idéntica (md5 dae88a95). src/lib/reserva/gestionServidor.ts sólo cae en ella con PGRST202 de la de 9: si las dos nacen juntas, esa rama nunca corre. Quitarla exige tocar el código (regla de CLAUDE.md «no quites esa tolerancia mientras J2 no esté en producción») y la lista del caso 3. |
| `reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text, text, text)` | función | F3 | j2_unico_tope_correo C/R | j2_unico_tope_correo | j2 (2e616c4b). La usan POST /api/agenda/enlaces y /api/agenda/restablecer (createAdminClient filtrado por clinica_id). |
| `reserva_enlace_regenerar_fijo(uuid, uuid, text)` | función | F3 | d1_enlaces_reserva C/R | d1_enlaces_reserva | **SIN EFECTO** 0 llamadores en src/, scripts/ y e2e/ (sólo pruebas SQL); desde seg-emisión su INSERT con sesión da 42501 y su papel lo hace reserva_enlace_emitir. No recrearla = la lista del caso 3 de p1 baja de 51 a 50 (Protocolo 2: decide Angel). |
| `reserva_espera_reenvio(uuid, uuid, text, integer)` | función | F3 | k2_espera_codigo C/R | k2_espera_codigo | k2 (ed76045d). 30 s POR ENLACE. |
| `reserva_ocupacion(uuid, uuid, timestamptz, timestamptz)` | función | F3 | d3_reservar C/R → seg1_candado_correo C/R → k1_bloqueos C/R → k3_huso_clinica_pausa_enlace C/R | k3_huso_clinica_pausa_enlace | SQL: se valida al crear y nombra agenda_bloqueos ⇒ F5a antes que F3. d3, seg1, k1, k3; final k3 (f1701599). |
| `reserva_registrar_incidencia()` | función | F3 | d2_candado_reserva C/R | d2_candado_reserva |  |
| `reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)` | función | F3 | d3_reservar C/R → seg1_candado_correo C/R → i2_unico_sin_correo C/R → j2_unico_tope_correo C/R → j2_unico_carrera_client_id C/R → k1_bloqueos C/R → k3_huso_clinica_pausa_enlace C/R | k3_huso_clinica_pausa_enlace | 7 cuerpos: d3, seg1, i2, j2, j2b, k1, k3; final k3 (be25c167, catálogo). Debe conservar: el `OR EXISTS … agenda_bloqueos` y `NOT a.all_day` (lo necesita F5), `pausado_en IS NULL`, el BEGIN…EXCEPTION unique_violation de j2b, el candado 1790, la puerta S3 (F2), reserva_contacto_estado y el seudónimo del único sin correo. INVOKER, sólo service_role. reagendar_por_enlace (F4) la llama. |
| `trg_appointments_reserva_incidencia ON appointments` | disparador | F3 | d2_candado_reserva C/R | d2_candado_reserva | **[main]** Disparador en appointments con dueño F3 (su función escribe reserva_incidencias). WHEN usa reserva_canal (columna de F3). F5 lo revisa en el conjunto. |
| `audit_reserva_avisos ON reserva_avisos` | disparador | F3 | d1_enlaces_reserva C/R | d1_enlaces_reserva |  |
| `audit_reserva_contactos ON reserva_contactos` | disparador | F3 | d2_candado_reserva C/R | d2_candado_reserva |  |
| `trg_reserva_contactos_proteger ON reserva_contactos` | disparador | F3 | d2_candado_reserva C/R | d2_candado_reserva |  |
| `audit_reserva_enlaces ON reserva_enlaces` | disparador | F3 | d1_enlaces_reserva C/R | d1_enlaces_reserva |  |
| `trg_reserva_enlaces_proteger ON reserva_enlaces` | disparador | F3 | d1_enlaces_reserva C/R | d1_enlaces_reserva |  |
| `trg_reserva_enlaces_unico ON reserva_enlaces` | disparador | F3 | j2_unico_tope_correo DROP → j2_unico_tope_correo CREATE | j2_unico_tope_correo | DROP+CREATE en la misma migración (idempotencia). |
| `function proteger_reserva_contactos()` | GRANT/REVOKE | F3 | d2_candado_reserva REVOKE → d2_candado_reserva GRANT | d2_candado_reserva |  |
| `function proteger_reserva_enlace_unico()` | GRANT/REVOKE | F3 | j2_unico_tope_correo REVOKE → j2_unico_tope_correo GRANT | j2_unico_tope_correo |  |
| `function proteger_reserva_enlaces()` | GRANT/REVOKE | F3 | d1_enlaces_reserva REVOKE → d1_enlaces_reserva GRANT → seg_emision_enlaces REVOKE → seg_emision_enlaces GRANT | seg_emision_enlaces |  |
| `function rate_limit_espera(text, integer, integer)` | GRANT/REVOKE | F3 | k2_espera_codigo REVOKE → k2_espera_codigo GRANT | k2_espera_codigo |  |
| `function reserva_codigo_emitir(uuid, uuid, text, text)` | GRANT/REVOKE | F3 | d3_reservar REVOKE → d3_reservar GRANT → k3_huso_clinica_pausa_enlace REVOKE → k3_huso_clinica_pausa_enlace GRANT | k3_huso_clinica_pausa_enlace |  |
| `function reserva_codigo_verificar(uuid, uuid, text, text, text)` | GRANT/REVOKE | F3 | d3_reservar REVOKE → d3_reservar GRANT → k2_espera_codigo REVOKE → k2_espera_codigo GRANT | k2_espera_codigo |  |
| `function reserva_contacto_estado(uuid, uuid, text, text)` | GRANT/REVOKE | F3 | d2_candado_reserva REVOKE → d2_candado_reserva GRANT → seg1_candado_correo REVOKE → seg1_candado_correo GRANT | seg1_candado_correo |  |
| `function reserva_contacto_marcar(uuid, text)` | GRANT/REVOKE | F3 | d2_candado_reserva REVOKE → d2_candado_reserva GRANT | d2_candado_reserva |  |
| `function reserva_contactos_bloqueados()` | GRANT/REVOKE | F3 | d2_candado_reserva REVOKE → d2_candado_reserva GRANT | d2_candado_reserva |  |
| `function reserva_contexto(text, text, text)` | GRANT/REVOKE | F3 | d3_reservar REVOKE → d3_reservar GRANT → g2_duracion_consulta REVOKE → g2_duracion_consulta GRANT → j2_unico_tope_correo REVOKE → j2_unico_tope_correo GRANT → k3_huso_clinica_pausa_enlace REVOKE → k3_huso_clinica_pausa_enlace GRANT | k3_huso_clinica_pausa_enlace |  |
| `function reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text)` | GRANT/REVOKE | F3 | seg_emision_enlaces REVOKE → seg_emision_enlaces GRANT → j2_unico_tope_correo REVOKE → j2_unico_tope_correo GRANT | j2_unico_tope_correo |  |
| `function reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text, text, text)` | GRANT/REVOKE | F3 | j2_unico_tope_correo REVOKE → j2_unico_tope_correo GRANT | j2_unico_tope_correo |  |
| `function reserva_enlace_regenerar_fijo(uuid, uuid, text)` | GRANT/REVOKE | F3 | d1_enlaces_reserva REVOKE → d1_enlaces_reserva GRANT | d1_enlaces_reserva |  |
| `function reserva_espera_reenvio(uuid, uuid, text, integer)` | GRANT/REVOKE | F3 | k2_espera_codigo REVOKE → k2_espera_codigo GRANT | k2_espera_codigo |  |
| `function reserva_ocupacion(uuid, uuid, timestamptz, timestamptz)` | GRANT/REVOKE | F3 | d3_reservar REVOKE → d3_reservar GRANT → seg1_candado_correo REVOKE → seg1_candado_correo GRANT → k1_bloqueos REVOKE → k1_bloqueos GRANT → k3_huso_clinica_pausa_enlace REVOKE → k3_huso_clinica_pausa_enlace GRANT | k3_huso_clinica_pausa_enlace |  |
| `function reserva_registrar_incidencia()` | GRANT/REVOKE | F3 | d2_candado_reserva REVOKE → d2_candado_reserva GRANT | d2_candado_reserva |  |
| `function reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)` | GRANT/REVOKE | F3 | d3_reservar REVOKE → d3_reservar GRANT → seg1_candado_correo REVOKE → seg1_candado_correo GRANT → i2_unico_sin_correo REVOKE → i2_unico_sin_correo GRANT → j2_unico_tope_correo REVOKE → j2_unico_tope_correo GRANT → j2_unico_carrera_client_id REVOKE → j2_unico_carrera_client_id GRANT → k1_bloqueos REVOKE → k1_bloqueos GRANT → k3_huso_clinica_pausa_enlace REVOKE → k3_huso_clinica_pausa_enlace GRANT | k3_huso_clinica_pausa_enlace |  |
| `table reserva_avisos` | GRANT/REVOKE | F3 | d1_enlaces_reserva REVOKE → d1_enlaces_reserva GRANT | d1_enlaces_reserva |  |
| `table reserva_contactos` | GRANT/REVOKE | F3 | d2_candado_reserva REVOKE → d2_candado_reserva GRANT | d2_candado_reserva |  |
| `table reserva_enlaces` | GRANT/REVOKE | F3 | d1_enlaces_reserva REVOKE | d1_enlaces_reserva |  |
| `table reserva_incidencias` | GRANT/REVOKE | F3 | d2_candado_reserva REVOKE → d2_candado_reserva GRANT | d2_candado_reserva |  |
| `table reserva_verificaciones` | GRANT/REVOKE | F3 | d3_reservar REVOKE → d3_reservar GRANT | d3_reservar |  |
| `column appointments.reserva_aceptado_en` | COMMENT | F3 | d1_enlaces_reserva COMMENT | d1_enlaces_reserva | **[main]** |
| `column appointments.reserva_aviso_version` | COMMENT | F3 | d1_enlaces_reserva COMMENT | d1_enlaces_reserva | **[main]** |
| `column appointments.reserva_canal` | COMMENT | F3 | d1_enlaces_reserva COMMENT | d1_enlaces_reserva | **[main]** |
| `column appointments.reserva_correo` | COMMENT | F3 | d1_enlaces_reserva COMMENT | d1_enlaces_reserva | **[main]** |
| `column appointments.reserva_correo_hmac` | COMMENT | F3 | d1_enlaces_reserva COMMENT → j2_unico_tope_correo COMMENT | j2_unico_tope_correo | **[main]** |
| `column appointments.reserva_enlace_id` | COMMENT | F3 | d1_enlaces_reserva COMMENT | d1_enlaces_reserva | **[main]** |
| `column appointments.reserva_historial_previo` | COMMENT | F3 | d1_enlaces_reserva COMMENT | d1_enlaces_reserva | **[main]** |
| `column appointments.reserva_nombre` | COMMENT | F3 | d1_enlaces_reserva COMMENT → d4_gcal_por_ligar COMMENT | d4_gcal_por_ligar | **[main]** |
| `column appointments.reserva_reagendados` | COMMENT | F3 | d1_enlaces_reserva COMMENT → e6_reagendar COMMENT | e6_reagendar | **[main]** |
| `column appointments.reserva_tel_hmac` | COMMENT | F3 | d1_enlaces_reserva COMMENT | d1_enlaces_reserva | **[main]** |
| `column appointments.reserva_telefono` | COMMENT | F3 | d1_enlaces_reserva COMMENT | d1_enlaces_reserva | **[main]** |
| `column reserva_enlaces.agotado_en` | COMMENT | F3 | j2_unico_tope_correo COMMENT | j2_unico_tope_correo |  |
| `column reserva_enlaces.correo` | COMMENT | F3 | j2_unico_tope_correo COMMENT | j2_unico_tope_correo |  |
| `column reserva_enlaces.correo_hmac` | COMMENT | F3 | j2_unico_tope_correo COMMENT | j2_unico_tope_correo |  |
| `column reserva_enlaces.intentos` | COMMENT | F3 | j2_unico_tope_correo COMMENT | j2_unico_tope_correo |  |
| `column reserva_enlaces.pausado_en` | COMMENT | F3 | k3_huso_clinica_pausa_enlace COMMENT | k3_huso_clinica_pausa_enlace |  |
| `function proteger_reserva_enlaces()` | COMMENT | F3 | seg_emision_enlaces COMMENT | seg_emision_enlaces |  |
| `function rate_limit_espera(text, integer, integer)` | COMMENT | F3 | k2_espera_codigo COMMENT | k2_espera_codigo |  |
| `function reserva_codigo_verificar(uuid, uuid, text, text, text)` | COMMENT | F3 | k2_espera_codigo COMMENT | k2_espera_codigo |  |
| `function reserva_contacto_estado(uuid, uuid, text, text)` | COMMENT | F3 | seg1_candado_correo COMMENT | seg1_candado_correo |  |
| `function reserva_contexto(text, text, text)` | COMMENT | F3 | g2_duracion_consulta COMMENT → j2_unico_tope_correo COMMENT | j2_unico_tope_correo |  |
| `function reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text)` | COMMENT | F3 | seg_emision_enlaces COMMENT | seg_emision_enlaces |  |
| `function reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text, text, text)` | COMMENT | F3 | j2_unico_tope_correo COMMENT | j2_unico_tope_correo |  |
| `function reserva_espera_reenvio(uuid, uuid, text, integer)` | COMMENT | F3 | k2_espera_codigo COMMENT | k2_espera_codigo |  |
| `function reserva_ocupacion(uuid, uuid, timestamptz, timestamptz)` | COMMENT | F3 | seg1_candado_correo COMMENT → k1_bloqueos COMMENT | k1_bloqueos |  |
| `function reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)` | COMMENT | F3 | d3_reservar COMMENT → seg1_candado_correo COMMENT → i2_unico_sin_correo COMMENT → j2_unico_tope_correo COMMENT → j2_unico_carrera_client_id COMMENT → k1_bloqueos COMMENT | k1_bloqueos |  |
| `table reserva_avisos` | COMMENT | F3 | d1_enlaces_reserva COMMENT | d1_enlaces_reserva |  |
| `table reserva_contactos` | COMMENT | F3 | d2_candado_reserva COMMENT | d2_candado_reserva |  |
| `table reserva_enlaces` | COMMENT | F3 | d1_enlaces_reserva COMMENT | d1_enlaces_reserva |  |
| `table reserva_incidencias` | COMMENT | F3 | d2_candado_reserva COMMENT → seg1_candado_correo COMMENT | seg1_candado_correo |  |
| `avisos_clinica` | tabla | F4 | i5_avisos_clinica CREATE | i5_avisos_clinica | i5. Sólo la escriben los aviso_clinica_de_* (DEFINER). La CHECK de tipos crece en j4 y l5. |
| `cita_confirmaciones` | tabla | F4 | e1_confirmacion_enlace CREATE | e1_confirmacion_enlace |  |
| `cita_correos` | tabla | F4 | e4_correos_cita CREATE | e4_correos_cita |  |
| `cita_reagendos` | tabla | F4 | e6_reagendar CREATE | e6_reagendar |  |
| `avisos_clinica_clinica_id_fkey ON avisos_clinica` | restricción | F4 | i5_avisos_clinica CREATE | i5_avisos_clinica |  |
| `avisos_clinica_pkey ON avisos_clinica` | restricción | F4 | i5_avisos_clinica CREATE | i5_avisos_clinica |  |
| `avisos_clinica_revisado_check ON avisos_clinica` | restricción | F4 | i5_avisos_clinica CREATE | i5_avisos_clinica |  |
| `avisos_clinica_tipo_check ON avisos_clinica` | restricción | F4 | i5_avisos_clinica CREATE → j4_aviso_google_reserva DROP → j4_aviso_google_reserva ADD → l5_aviso_confirmacion_paciente DROP → l5_aviso_confirmacion_paciente ADD | l5_aviso_confirmacion_paciente | i5 (5 tipos) y j4 (6) sin efecto; final l5 (7 tipos, catálogo). El pre-vuelo de j4 aborta con 7 (AG-DT-229): desaparece al fundir. |
| `cita_confirmaciones_cita_fkey ON cita_confirmaciones` | restricción | F4 | e1_confirmacion_enlace CREATE | e1_confirmacion_enlace |  |
| `cita_confirmaciones_clinica_fkey ON cita_confirmaciones` | restricción | F4 | e1_confirmacion_enlace CREATE | e1_confirmacion_enlace |  |
| `cita_confirmaciones_codigo_check ON cita_confirmaciones` | restricción | F4 | e1_confirmacion_enlace CREATE | e1_confirmacion_enlace |  |
| `cita_confirmaciones_codigo_key ON cita_confirmaciones` | restricción | F4 | e1_confirmacion_enlace CREATE | e1_confirmacion_enlace |  |
| `cita_confirmaciones_creado_por_fkey ON cita_confirmaciones` | restricción | F4 | e1_confirmacion_enlace CREATE | e1_confirmacion_enlace |  |
| `cita_confirmaciones_hmac_check ON cita_confirmaciones` | restricción | F4 | e1_confirmacion_enlace CREATE | e1_confirmacion_enlace |  |
| `cita_confirmaciones_pkey ON cita_confirmaciones` | restricción | F4 | e1_confirmacion_enlace CREATE | e1_confirmacion_enlace |  |
| `cita_confirmaciones_respuesta_check ON cita_confirmaciones` | restricción | F4 | e1_confirmacion_enlace CREATE | e1_confirmacion_enlace |  |
| `cita_confirmaciones_vinculo_check ON cita_confirmaciones` | restricción | F4 | e1_confirmacion_enlace CREATE | e1_confirmacion_enlace |  |
| `cita_correos_cita_fkey ON cita_correos` | restricción | F4 | e4_correos_cita CREATE | e4_correos_cita |  |
| `cita_correos_clinica_fkey ON cita_correos` | restricción | F4 | e4_correos_cita CREATE | e4_correos_cita |  |
| `cita_correos_coherencia_check ON cita_correos` | restricción | F4 | e4_correos_cita CREATE | e4_correos_cita |  |
| `cita_correos_estado_check ON cita_correos` | restricción | F4 | e4_correos_cita CREATE | e4_correos_cita |  |
| `cita_correos_intentos_check ON cita_correos` | restricción | F4 | e4_correos_cita CREATE | e4_correos_cita |  |
| `cita_correos_llave_key ON cita_correos` | restricción | F4 | e4_correos_cita CREATE | e4_correos_cita |  |
| `cita_correos_motivo_check ON cita_correos` | restricción | F4 | e4_correos_cita CREATE | e4_correos_cita |  |
| `cita_correos_pkey ON cita_correos` | restricción | F4 | e4_correos_cita CREATE | e4_correos_cita |  |
| `cita_correos_tipo_check ON cita_correos` | restricción | F4 | e4_correos_cita CREATE → g3_correo_confirmacion DROP → g3_correo_confirmacion ADD | g3_correo_confirmacion | Versión de e4 sin efecto; final g3 (añade confirmacion). |
| `cita_reagendos_clinica_fkey ON cita_reagendos` | restricción | F4 | e6_reagendar CREATE | e6_reagendar |  |
| `cita_reagendos_confirmacion_fkey ON cita_reagendos` | restricción | F4 | e6_reagendar CREATE | e6_reagendar |  |
| `cita_reagendos_distintas_check ON cita_reagendos` | restricción | F4 | e6_reagendar CREATE | e6_reagendar |  |
| `cita_reagendos_nueva_fkey ON cita_reagendos` | restricción | F4 | e6_reagendar CREATE | e6_reagendar |  |
| `cita_reagendos_nueva_key ON cita_reagendos` | restricción | F4 | e6_reagendar CREATE | e6_reagendar |  |
| `cita_reagendos_numero_check ON cita_reagendos` | restricción | F4 | e6_reagendar CREATE | e6_reagendar |  |
| `cita_reagendos_origen_fkey ON cita_reagendos` | restricción | F4 | e6_reagendar CREATE | e6_reagendar |  |
| `cita_reagendos_origen_key ON cita_reagendos` | restricción | F4 | e6_reagendar CREATE | e6_reagendar |  |
| `cita_reagendos_pkey ON cita_reagendos` | restricción | F4 | e6_reagendar CREATE | e6_reagendar |  |
| `avisos_clinica_clinica_idx ON avisos_clinica` | índice | F4 | i5_avisos_clinica CREATE | i5_avisos_clinica |  |
| `avisos_clinica_pendiente_key ON avisos_clinica` | índice | F4 | i5_avisos_clinica CREATE | i5_avisos_clinica |  |
| `avisos_clinica_pendientes_idx ON avisos_clinica` | índice | F4 | i5_avisos_clinica CREATE | i5_avisos_clinica |  |
| `cita_confirmaciones_cita ON cita_confirmaciones` | índice | F4 | e1_confirmacion_enlace CREATE | e1_confirmacion_enlace |  |
| `cita_confirmaciones_respuestas ON cita_confirmaciones` | índice | F4 | e1_confirmacion_enlace CREATE | e1_confirmacion_enlace |  |
| `cita_confirmaciones_vigente ON cita_confirmaciones` | índice | F4 | e1_confirmacion_enlace CREATE | e1_confirmacion_enlace |  |
| `cita_correos_clinica ON cita_correos` | índice | F4 | e4_correos_cita CREATE | e4_correos_cita |  |
| `cita_reagendos_confirmacion ON cita_reagendos` | índice | F4 | e6_reagendar CREATE | e6_reagendar |  |
| `avisos_clinica` | RLS | F4 | i5_avisos_clinica ENABLE | i5_avisos_clinica |  |
| `cita_confirmaciones` | RLS | F4 | e1_confirmacion_enlace ENABLE | e1_confirmacion_enlace |  |
| `cita_correos` | RLS | F4 | e4_correos_cita ENABLE | e4_correos_cita |  |
| `cita_reagendos` | RLS | F4 | e6_reagendar ENABLE | e6_reagendar |  |
| `avisos_clinica_select ON avisos_clinica` | policy | F4 | i5_avisos_clinica DROP → i5_avisos_clinica CREATE | i5_avisos_clinica |  |
| `avisos_clinica_update ON avisos_clinica` | policy | F4 | i5_avisos_clinica DROP → i5_avisos_clinica CREATE | i5_avisos_clinica |  |
| `cita_confirmaciones_select ON cita_confirmaciones` | policy | F4 | e1_confirmacion_enlace DROP → e1_confirmacion_enlace CREATE | e1_confirmacion_enlace |  |
| `cita_correos_select ON cita_correos` | policy | F4 | e4_correos_cita DROP → e4_correos_cita CREATE | e4_correos_cita |  |
| `cita_reagendos_select ON cita_reagendos` | policy | F4 | e6_reagendar DROP → e6_reagendar CREATE | e6_reagendar |  |
| `aviso_clinica_de_cita()` | función | F4 | i5_avisos_clinica C/R | i5_avisos_clinica | i5 (148b5b16). Disparador en appointments (AFTER INSERT, DEFINER). |
| `aviso_clinica_de_confirmacion()` | función | F4 | l5_aviso_confirmacion_paciente C/R | l5_aviso_confirmacion_paciente | l5 (2e866033). |
| `aviso_clinica_de_empalme()` | función | F4 | i5_avisos_clinica C/R | i5_avisos_clinica |  |
| `aviso_clinica_de_movimiento_google()` | función | F4 | j4_aviso_google_reserva C/R | j4_aviso_google_reserva | j4 (c1056d28). Asignado a F4 (familia aviso_clinica_de_*) aunque el brief pone «movimientos rechazados y su aviso» en F2: F2 sólo es dueño de la tabla y de cita_movimiento_google_registrar. |
| `aviso_clinica_de_reagendo()` | función | F4 | i5_avisos_clinica C/R | i5_avisos_clinica |  |
| `aviso_clinica_de_respuesta()` | función | F4 | i5_avisos_clinica C/R | i5_avisos_clinica |  |
| `aviso_clinica_revisar()` | función | F4 | i5_avisos_clinica C/R | i5_avisos_clinica |  |
| `cita_confirmacion_coincide(uuid, text, uuid, text)` | función | F4 | e1_confirmacion_enlace C/R | e1_confirmacion_enlace | SQL, helper interno (lo llaman las cita_confirmacion_* y reagendar). |
| `cita_confirmacion_contexto(text)` | función | F4 | e1_confirmacion_enlace C/R | e1_confirmacion_enlace |  |
| `cita_confirmacion_emitir(uuid, uuid, uuid, text, uuid)` | función | F4 | e1_confirmacion_enlace C/R | e1_confirmacion_enlace |  |
| `cita_confirmacion_responder(uuid, text, text)` | función | F4 | e1_confirmacion_enlace C/R | e1_confirmacion_enlace | e1 (7961e24a). Pone spinus.via=enlace_paciente. El disparador de L5 cuelga de su UPDATE. |
| `cita_confirmacion_revocar(uuid, uuid)` | función | F4 | e1_confirmacion_enlace C/R | e1_confirmacion_enlace |  |
| `cita_correo_marcar(uuid, uuid, uuid, text, text)` | función | F4 | e4_correos_cita C/R | e4_correos_cita |  |
| `cita_correo_tomar(uuid, uuid, text, uuid)` | función | F4 | e4_correos_cita C/R → g3_correo_confirmacion C/R | g3_correo_confirmacion | e4 sin efecto; final g3 (5d0ce8db). Tipo confirmacion. |
| `cita_correos_pendientes(integer)` | función | F4 | e4_correos_cita C/R | e4_correos_cita | **SIN EFECTO** Sin llamadores desde h2-recordatorio: src/lib/confirmacion/recordatorios.ts sólo la nombra en un comentario («No vuelvas a llamar…»). La sustituye cita_recordatorios_pendientes. No recrearla: caso 3 de p1 −1. |
| `cita_nombre_saludo(uuid, uuid)` | función | F4 | m_saludo_recordatorio C/R | m_saludo_recordatorio | SQL: necesita appointments.reserva_nombre (F3) al crearse. |
| `cita_reagendar_clinica(uuid, uuid, uuid, uuid, timestamptz, timestamptz, timestamptz)` | función | F4 | i2_candado_eleccion C/R | i2_candado_eleccion | Nace en i2-elección junto al candado de F5. Pone `spinus.reagendar_cita`, que lee cita_proteger_eleccion (F5): el nombre del GUC es contrato F4↔F5. Escribe audit_log. |
| `cita_reagendar_oferta(uuid, text)` | función | F4 | e6_reagendar C/R → k3_huso_clinica_pausa_enlace C/R | k3_huso_clinica_pausa_enlace | e6, k3; final k3 (dbcd8da8). |
| `cita_recordatorios_pendientes(integer)` | función | F4 | h2_recordatorio_interruptor C/R | h2_recordatorio_interruptor | SQL: necesita cita_correos (F4), agenda_ajustes.recordatorio_encendido (F1) y gcal_sync_clinica_habilitada (F2) al crearse. |
| `reagendar_por_enlace(text, uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)` | función | F4 | e6_reagendar C/R → k3_huso_clinica_pausa_enlace C/R | k3_huso_clinica_pausa_enlace | e6, k3; final k3 (54b257ed). Llama reservar_por_enlace (F3). |
| `trg_appointments_aviso_clinica ON appointments` | disparador | F4 | i5_avisos_clinica C/R | i5_avisos_clinica | **[main]** Dueño F4. WHEN usa reserva_enlace_id (F3) y google_asignacion (F2) ⇒ F4 después de F2 y F3. La marca debe coincidir con cambioPuedeAvisar y esPorAsignar (regla de CLAUDE.md). |
| `audit_avisos_clinica ON avisos_clinica` | disparador | F4 | i5_avisos_clinica C/R | i5_avisos_clinica |  |
| `trg_avisos_clinica_revisar ON avisos_clinica` | disparador | F4 | i5_avisos_clinica C/R | i5_avisos_clinica |  |
| `audit_cita_confirmaciones ON cita_confirmaciones` | disparador | F4 | e1_confirmacion_enlace C/R | e1_confirmacion_enlace |  |
| `trg_cita_confirmaciones_aviso_clinica ON cita_confirmaciones` | disparador | F4 | i5_avisos_clinica C/R | i5_avisos_clinica |  |
| `trg_cita_confirmaciones_aviso_confirmacion ON cita_confirmaciones` | disparador | F4 | l5_aviso_confirmacion_paciente C/R | l5_aviso_confirmacion_paciente |  |
| `audit_cita_correos ON cita_correos` | disparador | F4 | e4_correos_cita C/R | e4_correos_cita |  |
| `audit_cita_reagendos ON cita_reagendos` | disparador | F4 | e6_reagendar C/R | e6_reagendar |  |
| `trg_cita_reagendos_aviso_clinica ON cita_reagendos` | disparador | F4 | i5_avisos_clinica C/R | i5_avisos_clinica |  |
| `trg_gcal_movimientos_aviso_clinica ON gcal_movimientos_rechazados` | disparador | F4 | j4_aviso_google_reserva C/R | j4_aviso_google_reserva |  |
| `trg_reserva_empalmes_aviso_clinica ON reserva_empalmes_google` | disparador | F4 | i5_avisos_clinica C/R | i5_avisos_clinica |  |
| `function aviso_clinica_de_cita()` | GRANT/REVOKE | F4 | i5_avisos_clinica REVOKE → i5_avisos_clinica GRANT | i5_avisos_clinica |  |
| `function aviso_clinica_de_confirmacion()` | GRANT/REVOKE | F4 | l5_aviso_confirmacion_paciente REVOKE → l5_aviso_confirmacion_paciente GRANT | l5_aviso_confirmacion_paciente |  |
| `function aviso_clinica_de_empalme()` | GRANT/REVOKE | F4 | i5_avisos_clinica REVOKE → i5_avisos_clinica GRANT | i5_avisos_clinica |  |
| `function aviso_clinica_de_movimiento_google()` | GRANT/REVOKE | F4 | j4_aviso_google_reserva REVOKE → j4_aviso_google_reserva GRANT | j4_aviso_google_reserva |  |
| `function aviso_clinica_de_reagendo()` | GRANT/REVOKE | F4 | i5_avisos_clinica REVOKE → i5_avisos_clinica GRANT | i5_avisos_clinica |  |
| `function aviso_clinica_de_respuesta()` | GRANT/REVOKE | F4 | i5_avisos_clinica REVOKE → i5_avisos_clinica GRANT | i5_avisos_clinica |  |
| `function aviso_clinica_revisar()` | GRANT/REVOKE | F4 | i5_avisos_clinica REVOKE → i5_avisos_clinica GRANT | i5_avisos_clinica |  |
| `function cita_confirmacion_coincide(uuid, text, uuid, text)` | GRANT/REVOKE | F4 | e1_confirmacion_enlace REVOKE → e1_confirmacion_enlace GRANT | e1_confirmacion_enlace |  |
| `function cita_confirmacion_contexto(text)` | GRANT/REVOKE | F4 | e1_confirmacion_enlace REVOKE → e1_confirmacion_enlace GRANT | e1_confirmacion_enlace |  |
| `function cita_confirmacion_emitir(uuid, uuid, uuid, text, uuid)` | GRANT/REVOKE | F4 | e1_confirmacion_enlace REVOKE → e1_confirmacion_enlace GRANT | e1_confirmacion_enlace |  |
| `function cita_confirmacion_responder(uuid, text, text)` | GRANT/REVOKE | F4 | e1_confirmacion_enlace REVOKE → e1_confirmacion_enlace GRANT | e1_confirmacion_enlace |  |
| `function cita_confirmacion_revocar(uuid, uuid)` | GRANT/REVOKE | F4 | e1_confirmacion_enlace REVOKE → e1_confirmacion_enlace GRANT | e1_confirmacion_enlace |  |
| `function cita_correo_marcar(uuid, uuid, uuid, text, text)` | GRANT/REVOKE | F4 | e4_correos_cita REVOKE → e4_correos_cita GRANT | e4_correos_cita |  |
| `function cita_correo_tomar(uuid, uuid, text, uuid)` | GRANT/REVOKE | F4 | e4_correos_cita REVOKE → e4_correos_cita GRANT → g3_correo_confirmacion REVOKE → g3_correo_confirmacion GRANT | g3_correo_confirmacion |  |
| `function cita_correos_pendientes(integer)` | GRANT/REVOKE | F4 | e4_correos_cita REVOKE → e4_correos_cita GRANT | e4_correos_cita |  |
| `function cita_nombre_saludo(uuid, uuid)` | GRANT/REVOKE | F4 | m_saludo_recordatorio REVOKE → m_saludo_recordatorio GRANT | m_saludo_recordatorio |  |
| `function cita_reagendar_clinica(uuid, uuid, uuid, uuid, timestamptz, timestamptz, timestamptz)` | GRANT/REVOKE | F4 | i2_candado_eleccion REVOKE → i2_candado_eleccion GRANT | i2_candado_eleccion |  |
| `function cita_reagendar_oferta(uuid, text)` | GRANT/REVOKE | F4 | e6_reagendar REVOKE → e6_reagendar GRANT → k3_huso_clinica_pausa_enlace REVOKE → k3_huso_clinica_pausa_enlace GRANT | k3_huso_clinica_pausa_enlace |  |
| `function cita_recordatorios_pendientes(integer)` | GRANT/REVOKE | F4 | h2_recordatorio_interruptor REVOKE → h2_recordatorio_interruptor GRANT | h2_recordatorio_interruptor |  |
| `function reagendar_por_enlace(text, uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)` | GRANT/REVOKE | F4 | e6_reagendar REVOKE → e6_reagendar GRANT → k3_huso_clinica_pausa_enlace REVOKE → k3_huso_clinica_pausa_enlace GRANT | k3_huso_clinica_pausa_enlace |  |
| `table avisos_clinica` | GRANT/REVOKE | F4 | i5_avisos_clinica REVOKE → i5_avisos_clinica GRANT | i5_avisos_clinica |  |
| `table cita_confirmaciones` | GRANT/REVOKE | F4 | e1_confirmacion_enlace REVOKE → e1_confirmacion_enlace GRANT | e1_confirmacion_enlace |  |
| `table cita_correos` | GRANT/REVOKE | F4 | e4_correos_cita REVOKE → e4_correos_cita GRANT | e4_correos_cita |  |
| `table cita_reagendos` | GRANT/REVOKE | F4 | e6_reagendar REVOKE → e6_reagendar GRANT | e6_reagendar |  |
| `column cita_confirmaciones.paciente_id` | COMMENT | F4 | e1_confirmacion_enlace COMMENT | e1_confirmacion_enlace |  |
| `column cita_confirmaciones.respuesta` | COMMENT | F4 | e1_confirmacion_enlace COMMENT | e1_confirmacion_enlace |  |
| `column cita_correos.inicio_cita` | COMMENT | F4 | e4_correos_cita COMMENT | e4_correos_cita |  |
| `column cita_correos.testigo` | COMMENT | F4 | e4_correos_cita COMMENT | e4_correos_cita |  |
| `function aviso_clinica_de_confirmacion()` | COMMENT | F4 | l5_aviso_confirmacion_paciente COMMENT | l5_aviso_confirmacion_paciente |  |
| `function cita_nombre_saludo(uuid, uuid)` | COMMENT | F4 | m_saludo_recordatorio COMMENT | m_saludo_recordatorio |  |
| `function cita_reagendar_clinica(uuid, uuid, uuid, uuid, timestamptz, timestamptz, timestamptz)` | COMMENT | F4 | i2_candado_eleccion COMMENT | i2_candado_eleccion |  |
| `function cita_reagendar_oferta(uuid, text)` | COMMENT | F4 | e6_reagendar COMMENT | e6_reagendar |  |
| `function cita_recordatorios_pendientes(integer)` | COMMENT | F4 | h2_recordatorio_interruptor COMMENT | h2_recordatorio_interruptor |  |
| `function reagendar_por_enlace(text, uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)` | COMMENT | F4 | e6_reagendar COMMENT | e6_reagendar |  |
| `table avisos_clinica` | COMMENT | F4 | i5_avisos_clinica COMMENT | i5_avisos_clinica |  |
| `table cita_confirmaciones` | COMMENT | F4 | e1_confirmacion_enlace COMMENT | e1_confirmacion_enlace |  |
| `table cita_correos` | COMMENT | F4 | e4_correos_cita COMMENT → g3_correo_confirmacion COMMENT | g3_correo_confirmacion |  |
| `table cita_reagendos` | COMMENT | F4 | e6_reagendar COMMENT | e6_reagendar |  |
| `avisos_clinica` | datos | F4 | i5_avisos_clinica DML_INSERT | i5_avisos_clinica | **SIN EFECTO** (en la fusión) INSERT de arrastre desde reserva_empalmes_google (30 días) y cita_confirmaciones canceladas (48 h): en producción esas tablas nacen vacías en el mismo conjunto, así que insertaría 0 filas. Se puede omitir. |
| `agenda_bloqueos` | tabla | F5 | k1_bloqueos CREATE | k1_bloqueos | k1. F5a: va ANTES de F3 porque reserva_ocupacion (SQL) la nombra. |
| `appointments.cerrada_en` | columna | F5 | i4_cancelada_cerrada ADD | i4_cancelada_cerrada | **[main]** COMMENT reescrito en l2. La leen src (consultaCitas, tiempo real, buscador), no funciones de otros bloques. |
| `appointments.sustituida_por` | columna | F5 | i4_cancelada_cerrada ADD | i4_cancelada_cerrada | **[main]** |
| `agenda_bloqueos_clinica_id_fkey ON agenda_bloqueos` | restricción | F5 | k1_bloqueos CREATE | k1_bloqueos |  |
| `agenda_bloqueos_gcal_check ON agenda_bloqueos` | restricción | F5 | k1_bloqueos CREATE | k1_bloqueos |  |
| `agenda_bloqueos_medico_id_fkey ON agenda_bloqueos` | restricción | F5 | k1_bloqueos CREATE | k1_bloqueos |  |
| `agenda_bloqueos_minuto_check ON agenda_bloqueos` | restricción | F5 | k1_bloqueos CREATE | k1_bloqueos |  |
| `agenda_bloqueos_motivo_check ON agenda_bloqueos` | restricción | F5 | k1_bloqueos CREATE | k1_bloqueos |  |
| `agenda_bloqueos_pkey ON agenda_bloqueos` | restricción | F5 | k1_bloqueos CREATE | k1_bloqueos |  |
| `agenda_bloqueos_puntas_check ON agenda_bloqueos` | restricción | F5 | k1_bloqueos CREATE | k1_bloqueos |  |
| `agenda_bloqueos_todo_el_dia_check ON agenda_bloqueos` | restricción | F5 | k1_bloqueos CREATE | k1_bloqueos |  |
| `agenda_bloqueos_zona_check ON agenda_bloqueos` | restricción | F5 | k1_bloqueos CREATE | k1_bloqueos |  |
| `appointments_cierre_check ON appointments` | restricción | F5 | i4_cancelada_cerrada ADD → l2_eliminar_cancelada DROP → l2_eliminar_cancelada ADD | l2_eliminar_cancelada | **[main]** Versión de i4-cancelada sin efecto; final l2 (más ancha: cerrada sin sustituta). |
| `appointments_sustituida_por_fkey ON appointments` | restricción | F5 | i4_cancelada_cerrada ADD | i4_cancelada_cerrada | **[main]** |
| `agenda_bloqueos_evento_key ON agenda_bloqueos` | índice | F5 | k1_bloqueos CREATE | k1_bloqueos |  |
| `agenda_bloqueos_medico_fk_idx ON agenda_bloqueos` | índice | F5 | k1_bloqueos CREATE | k1_bloqueos |  |
| `agenda_bloqueos_medico_idx ON agenda_bloqueos` | índice | F5 | k1_bloqueos CREATE | k1_bloqueos |  |
| `idx_appointments_clinica_inicio ON appointments` | índice | F5 | a18_indices_rango CREATE | a18_indices_rango | **[main]** a18. «Índices de rango» → F5. |
| `idx_appointments_clinica_medico_inicio ON appointments` | índice | F5 | a18_indices_rango CREATE | a18_indices_rango | **[main]** a18. «Índices de rango» → F5. |
| `idx_appointments_sustituida_por ON appointments` | índice | F5 | i4_cancelada_cerrada CREATE | i4_cancelada_cerrada | **[main]** |
| `agenda_bloqueos` | RLS | F5 | k1_bloqueos ENABLE | k1_bloqueos |  |
| `agenda_bloqueos_delete ON agenda_bloqueos` | policy | F5 | k1_bloqueos DROP → k1_bloqueos CREATE | k1_bloqueos |  |
| `agenda_bloqueos_insert ON agenda_bloqueos` | policy | F5 | k1_bloqueos DROP → k1_bloqueos CREATE | k1_bloqueos |  |
| `agenda_bloqueos_select ON agenda_bloqueos` | policy | F5 | k1_bloqueos DROP → k1_bloqueos CREATE | k1_bloqueos |  |
| `agenda_bloqueos_update ON agenda_bloqueos` | policy | F5 | k1_bloqueos DROP → k1_bloqueos CREATE | k1_bloqueos |  |
| `agenda_bloqueo_preparar()` | función | F5 | k1_bloqueos C/R | k1_bloqueos | k1 (f1f887ec). Candado 1790 (ver gcal_bloqueo_aplicar). |
| `cita_proteger_atendida()` | función | F5 | h5_atendida_con_nota C/R → i4_atendida_no_se_mueve C/R | i4_atendida_no_se_mueve | h5 sin efecto; final i4-atendida (cfc4fcd7). Llama cita_tiene_nota_ligada. |
| `cita_proteger_bloqueo()` | función | F5 | l1_bloqueo_total C/R | l1_bloqueo_total | l1 (d084da26). Exime Google (spinus.via, F2), el enlace (reserva_canal, F3) y lo que no se mueve. |
| `cita_proteger_borrado()` | función | F5 | seg_borrado_cita C/R | seg_borrado_cita | seg-borrado. 42501 a todo rol salvo postgres/supabase_admin, también service_role, con la v2. La semilla y /quitar dependen de ello. |
| `cita_proteger_cierre()` | función | F5 | i4_cancelada_cerrada C/R → l2_eliminar_cancelada C/R | l2_eliminar_cancelada | i4-cancelada sin efecto; final l2 (e550ee48: no está escrito en l2, sacado del catálogo). |
| `cita_proteger_eleccion()` | función | F5 | i2_candado_eleccion C/R | i2_candado_eleccion | i2. Exime a cita_reagendar_clinica (F4) por spinus.reagendar_cita y a Google por spinus.via. |
| `cita_proteger_reserva()` | función | F5 | seg_columnas_reserva C/R | seg_columnas_reserva | seg-columnas. Lista las columnas reserva_* POR PREFIJO: depende de que F3 no añada una reserva_* con DEFAULT (reserva_reagendados DEFAULT 0 es la excepción conocida). |
| `cita_tiene_nota_ligada(uuid, uuid)` | función | F5 | h5_atendida_con_nota C/R | h5_atendida_con_nota | SQL DEFINER (39f40c71), sólo booleano. No hacerla INVOKER (la RLS de consultas oculta notas a la secretaria). |
| `audit_agenda_bloqueos ON agenda_bloqueos` | disparador | F5 | k1_bloqueos DROP → k1_bloqueos CREATE | k1_bloqueos | DROP+CREATE en la misma migración (idempotencia). |
| `trg_agenda_bloqueos_preparar ON agenda_bloqueos` | disparador | F5 | k1_bloqueos DROP → k1_bloqueos CREATE | k1_bloqueos | DROP+CREATE en la misma migración (idempotencia). |
| `trg_appointments_horario_bloqueado ON appointments` | disparador | F5 | l1_bloqueo_total DROP → l1_bloqueo_total CREATE | l1_bloqueo_total | **[main]** DROP+CREATE en la misma migración (idempotencia). BEFORE INSERT OR UPDATE OF start_time,end_time,medico_id. |
| `trg_appointments_proteger_atendida ON appointments` | disparador | F5 | h5_atendida_con_nota C/R | h5_atendida_con_nota | **[main]** |
| `trg_appointments_proteger_borrado ON appointments` | disparador | F5 | seg_borrado_cita C/R | seg_borrado_cita | **[main]** |
| `trg_appointments_proteger_cierre ON appointments` | disparador | F5 | i4_cancelada_cerrada C/R | i4_cancelada_cerrada | **[main]** |
| `trg_appointments_proteger_eleccion ON appointments` | disparador | F5 | i2_candado_eleccion C/R | i2_candado_eleccion | **[main]** |
| `trg_appointments_proteger_reserva ON appointments` | disparador | F5 | seg_columnas_reserva C/R | seg_columnas_reserva | **[main]** |
| `function agenda_bloqueo_preparar()` | GRANT/REVOKE | F5 | k1_bloqueos REVOKE → k1_bloqueos GRANT | k1_bloqueos |  |
| `function cita_proteger_atendida()` | GRANT/REVOKE | F5 | h5_atendida_con_nota REVOKE → h5_atendida_con_nota GRANT → i4_atendida_no_se_mueve REVOKE → i4_atendida_no_se_mueve GRANT | i4_atendida_no_se_mueve |  |
| `function cita_proteger_bloqueo()` | GRANT/REVOKE | F5 | l1_bloqueo_total REVOKE → l1_bloqueo_total GRANT | l1_bloqueo_total |  |
| `function cita_proteger_borrado()` | GRANT/REVOKE | F5 | seg_borrado_cita REVOKE → seg_borrado_cita GRANT | seg_borrado_cita |  |
| `function cita_proteger_cierre()` | GRANT/REVOKE | F5 | i4_cancelada_cerrada REVOKE → i4_cancelada_cerrada GRANT → l2_eliminar_cancelada REVOKE → l2_eliminar_cancelada GRANT | l2_eliminar_cancelada |  |
| `function cita_proteger_eleccion()` | GRANT/REVOKE | F5 | i2_candado_eleccion REVOKE → i2_candado_eleccion GRANT | i2_candado_eleccion |  |
| `function cita_proteger_reserva()` | GRANT/REVOKE | F5 | seg_columnas_reserva REVOKE → seg_columnas_reserva GRANT | seg_columnas_reserva |  |
| `function cita_tiene_nota_ligada(uuid, uuid)` | GRANT/REVOKE | F5 | h5_atendida_con_nota REVOKE → h5_atendida_con_nota GRANT | h5_atendida_con_nota |  |
| `table agenda_bloqueos` | GRANT/REVOKE | F5 | k1_bloqueos REVOKE → k1_bloqueos GRANT | k1_bloqueos |  |
| `column appointments.cerrada_en` | COMMENT | F5 | i4_cancelada_cerrada COMMENT → l2_eliminar_cancelada COMMENT | l2_eliminar_cancelada | **[main]** |
| `column appointments.sustituida_por` | COMMENT | F5 | i4_cancelada_cerrada COMMENT | i4_cancelada_cerrada | **[main]** |
| `function cita_proteger_atendida()` | COMMENT | F5 | h5_atendida_con_nota COMMENT → i4_atendida_no_se_mueve COMMENT | i4_atendida_no_se_mueve |  |
| `function cita_proteger_bloqueo()` | COMMENT | F5 | l1_bloqueo_total COMMENT | l1_bloqueo_total |  |
| `function cita_proteger_borrado()` | COMMENT | F5 | seg_borrado_cita COMMENT | seg_borrado_cita |  |
| `function cita_proteger_cierre()` | COMMENT | F5 | i4_cancelada_cerrada COMMENT → l2_eliminar_cancelada COMMENT | l2_eliminar_cancelada |  |
| `function cita_proteger_eleccion()` | COMMENT | F5 | i2_candado_eleccion COMMENT | i2_candado_eleccion |  |
| `function cita_proteger_reserva()` | COMMENT | F5 | seg_columnas_reserva COMMENT | seg_columnas_reserva |  |
| `function cita_tiene_nota_ligada(uuid, uuid)` | COMMENT | F5 | h5_atendida_con_nota COMMENT | h5_atendida_con_nota |  |
| `index idx_appointments_clinica_inicio` | COMMENT | F5 | a18_indices_rango COMMENT | a18_indices_rango | **[main]** |
| `index idx_appointments_clinica_medico_inicio` | COMMENT | F5 | a18_indices_rango COMMENT | a18_indices_rango | **[main]** |
| `table agenda_bloqueos` | COMMENT | F5 | k1_bloqueos COMMENT | k1_bloqueos |  |
| `prevent_audit_truncate ON audit_log` | disparador | M49 | audit_log_sin_truncate C/R | audit_log_sin_truncate | **[main]** No es de la agenda (#49). Fuera de los cinco dueños: queda como está. |
| `table audit_log` | GRANT/REVOKE | M49 | audit_log_sin_truncate REVOKE | audit_log_sin_truncate | **[main]** |
