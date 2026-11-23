# Auditoría independiente — conjunto de 9 migraciones «agenda v2 lista para producción» — RONDA 2 · PASADA 1 DE 2

- **Auditor:** el mismo agente independiente de la ronda 1. **Fecha:** 2026-11-22/23.
- **Rama:** `feature/agenda-v2-produccion`, punta `b1e28cc7` (la ronda 1 se hizo sobre `45c5c375`/`e51a64cc`).
- **Banco de pruebas:** clon nuevo `clon-spinus-aud-r2` (127.0.0.1:54392) desde `~/spinus-produccion-foto`, datos sintéticos inventados.
- **Convención:** COMPROBADO = ejecutado en el clon; DEDUCIDO = leído.

## 0. Lista completa de funciones que crean las 9 migraciones (catálogo del clon migrado: 66) y estado de lectura

«R1» = leída entera en la ronda 1 (en el archivo o, el cuerpo, en `pg_proc.prosrc` del clon; sus cuerpos no cambian en `git diff 45c5c375..HEAD` salvo `proteger_reserva_contactos`, releída). «R2» = leída entera en esta ronda, en el archivo de migración.

| Archivo | Función | Estado |
|---|---|---|
| 20261126 | `prohibir_truncate()` | R1 |
| F1 | `proteger_agenda_ajustes()`, `agenda_v2_encendida(uuid)`, `validar_tipo_cita_medico()`, `validar_tipo_cita_consultorio()`, `update_tipos_cita_updated_at()`, `log_cita_change()`, `agenda_restablecer_configuracion(uuid,uuid)` | R1 |
| F5a | `agenda_bloqueo_preparar()` | R1 |
| F3 | `proteger_reserva_enlaces()`, `proteger_reserva_enlace_unico()`, `reserva_registrar_incidencia()`, `reserva_contacto_estado(uuid,uuid,text,text)`, `reserva_contacto_marcar(uuid,text)`, `reserva_contactos_bloqueados()`, `reserva_enlace_emitir(…9)`, `reservar_por_enlace(…14)` | R1 |
| F3 | `proteger_reserva_contactos()` (cambió por A3) | R2 |
| F3 | `reserva_contexto(text,text,text)`, `reserva_ocupacion(uuid,uuid,timestamptz,timestamptz)`, `reserva_codigo_emitir(uuid,uuid,text,text)`, `reserva_codigo_verificar(uuid,uuid,text,text,text)`, `reserva_espera_reenvio(uuid,uuid,text,integer)`, `rate_limit_espera(text,integer,integer)` | **R2** |
| F2 | `cita_asignacion_google()`, `gcal_sync_clinicas_pendientes(integer)`, `gcal_sync_clinica_habilitada(uuid)`, `gcal_aplicar_evento(…15)`, `gcal_importar_evento(…12)` | R1 |
| F2 | `gcal_sync_tomar`, `gcal_sync_avanzar`, `gcal_sync_reiniciar`, `gcal_sync_soltar`, `gcal_sync_frescura`, `gcal_citas_por_evento`, `reserva_empalmes_registrar`, `cita_rsvp_google`, `cita_movimiento_google_registrar`, `gcal_bloqueo_aplicar` | (ver §0-bis al final) |
| F4 | `cita_confirmacion_coincide(…4)`, `cita_confirmacion_responder(uuid,text,text)`, `cita_correo_tomar(…4)`, `cita_recordatorios_pendientes(integer)`, `cita_nombre_saludo(uuid,uuid)`, `aviso_clinica_revisar()`, `aviso_clinica_de_cita()`, `aviso_clinica_de_reagendo()` | R1 |
| F4 | `cita_confirmacion_emitir(…5)`, `cita_confirmacion_revocar(uuid,uuid)`, `cita_confirmacion_contexto(text)`, `cita_reagendar_oferta(uuid,text)`, `reagendar_por_enlace(…15)` | **R2** |
| F4 | `cita_reagendar_clinica(…7)`, `cita_correo_marcar(…5)`, `aviso_clinica_de_respuesta()`, `aviso_clinica_de_confirmacion()`, `aviso_clinica_de_empalme()`, `aviso_clinica_de_movimiento_google()` | (ver §0-bis al final) |
| F5b | `cita_tiene_nota_ligada(uuid,uuid)`, `cita_proteger_bloqueo()`, `_atendida()`, `_borrado()`, `_cierre()`, `_eleccion()`, `_reserva()` | R1 |

## Parte 2 — Fichas de las funciones que atienden a alguien SIN sesión

Común a todas: `SECURITY INVOKER`, dueño `postgres`, `search_path = ''`, EXECUTE **sólo `service_role`** (comprobado en el clon: `anon` y un `authenticated` de otra clínica reciben `42501 permission denied for function`). Las llama el servidor con `createAdminClient()`; el visitante nunca llega a PostgREST con ellas. Flujo completo ejercitado en el clon con `service_role` y datos inventados (v2 encendida en A y B, aviso aprobado, tipo principal, enlace fijo).

**`reserva_contexto(p_codigo_hash, p_aviso_version, p_aviso_sha256) → jsonb`** · F3:795-845 · llama `src/lib/reserva/servidorReserva.ts:68`.
Entradas del visitante: el código (el servidor lo pasa por HMAC → hash). Lee `reserva_enlaces` por `codigo_hash` (única función que entra sin `clinica_id`: la clínica sale del enlace), `agenda_ajustes`, `reserva_avisos`, `profiles`, `clinicas`, `consultorios`, `tipos_cita`. No escribe. Devuelve médico (nombre, especialidad, teléfono de consultorio), clínica, consultorios con su horario, tipos y dos ajustes; `NULL` indistinguible para inexistente / revocado / pausado / apagado / aviso no aprobado / sin acceso. **No** devuelve `correo`, `correo_hmac` ni `codigo_hash` (COMPROBADO sobre las claves del jsonb). Devuelve `estado` usado/caducado/agotado del único al portador del código (previsto). No lanza nada provocable (forma inválida → NULL). Sin candados. **Sin hallazgos.**

**`reserva_ocupacion(p_clinica_id, p_enlace_id, p_desde, p_hasta) → (start_time, end_time)`** · F3:849-878 · `servidorReserva.ts:79`.
Sólo puntas ocupadas del médico del enlace (citas con hora no canceladas ni `no_show`, y bloqueos). Exige enlace de ESA clínica, no revocado ni pausado, v2 encendida, ventana ≤ 15 días. COMPROBADO: con la clínica B y el enlace de A → 0 filas; 16 días → 0 filas. Devuelve inicio y fin exactos de cada cita (no título ni persona): lo que el servidor convierta en turnos. No mira `gcal_sync_clinica_habilitada` ni si el único está usado (la página ya se cerró antes por `reserva_contexto`). **Sin hallazgos.**

**`reserva_codigo_emitir(p_clinica_id, p_enlace_id, p_correo_hmac, p_codigo_hmac) → text`** · F3:882-909 · `servidorReserva.ts:89`.
Entradas del visitante: su correo (llega ya como HMAC). Escribe: agota (`intentos = 5`) los códigos sin verificar de ese enlace+correo e inserta uno nuevo (10 min). Sólo enlace `fijo` vigente de esa clínica, v2 y puerta S3. `22023` sólo por forma (lo arma el servidor). COMPROBADO: clínica B + enlace de A → `enlace_invalido`. **No tiene tope propio**: el freno (30 s por enlace+correo, límites por red) vive en `src/lib/reserva/limitesReserva.ts`; quien llame a la RPC sin pasar por ahí no tiene límite, y `reserva_verificaciones` no tiene ninguna limpieza (ver A14, LEVE).

**`reserva_codigo_verificar(p_clinica_id, p_enlace_id, p_correo_hmac, p_codigo_hmac, p_ficha_hmac) → text`** · F3:911-950 · `servidorReserva.ts:95`.
Toma con `FOR UPDATE` el último código sin verificar. Tope de 5 intentos por código; el contador (`intentos + 1`) va seguido de `RETURN`, nada lanza después (dimensión 27: no se puede deshacer). COMPROBADO: 5 fallos → `agotado`, y el código bueno ya no vale; un código anterior → `reemplazado` sin sumar (sólo delata que ese valor fue un código viejo, ya inútil); tras `ok`, repetir → `agotado`; una ficha que no es la verificada → `correo_sin_verificar` en `reservar_por_enlace`. La ficha vale 30 min y se consume al reservar (comprobado: 2.ª reserva con la misma ficha → `correo_sin_verificar`). **Sin hallazgos.**

**`reserva_espera_reenvio(p_clinica_id, p_enlace_id, p_correo_hmac, p_segundos) → integer`** · F3:954-978 · `limitesReserva.ts:171`. Sólo lee. Por enlace+correo+clínica (COMPROBADO: otra clínica u otro correo → 0). Delata únicamente que ESE correo pidió código en ESE enlace hace menos de N s. **Sin hallazgos.**

**`rate_limit_espera(p_ruta, p_limite, p_ventana_seg) → integer`** · F3:982-1006 · `limitesReserva.ts:136`. Sólo lee `ip_rate_limits` por la llave `ruta` que compone el servidor. **Sin hallazgos** (la llave es del servidor: ver Parte 3).

**`reservar_por_enlace(…)`** · F3:1014-1274 · `servidorReserva.ts:135`. Leída entera en R1; sin cambios de cuerpo. En esta ronda, además: ficha ajena y ficha reutilizada rechazadas (arriba).

**`cita_confirmacion_emitir(p_clinica_id, p_cita_id, p_id, p_codigo_hash, p_creado_por) → (r_id, r_codigo_hash)`** · F4:471-514 · `src/lib/confirmacion/enlaceConfirmacion.ts:130`. La llama el servidor al mandar un correo (personal con sesión, cron, o tras una reserva pública). Candado consultivo 1791 por cita. Sólo cita futura, agendada o confirmada, con paciente o por ligar, **de esa clínica**; devuelve el vigente si sigue casando con la persona, si no lo revoca y emite. `p_creado_por` sólo se guarda si es un perfil de esa clínica. COMPROBADO: 2.ª emisión devuelve la vigente; con la clínica B sobre una cita de A → fila vacía. **Sin hallazgos.**

**`cita_confirmacion_revocar(p_clinica_id, p_cita_id) → integer`** · F4:520-539 · `enlaceConfirmacion.ts:220`. UPDATE filtrado por cita y clínica, mismo candado 1791. **Sin hallazgos.**

**`cita_confirmacion_contexto(p_codigo_hash) → jsonb`** · F4:547-604 · `enlaceConfirmacion.ts:189`. STABLE, sólo lee, entra por el hash. NULL indistinguible (inexistente, revocado, v2 apagada, clínica suspendida, la cita ya no es de esa persona). Devuelve fecha, zona, nombre del médico, consultorio, estado y si puede confirmar/cancelar; COMPROBADO sobre las claves: ni título, ni notas, ni paciente, ni tipo, ni id de la cita. **Sin hallazgos.**

**`cita_confirmacion_responder(p_clinica_id, p_codigo_hash, p_accion)`** · F4:617-683 · `enlaceConfirmacion.ts:205`. Leída entera en R1. En esta ronda, COMPROBADO: con la clínica B → `invalido`; cancelar → `cancelada`, luego confirmar → `ya_cancelada`; deja 1 incidencia y el aviso `cancelacion_paciente`.

**`cita_reagendar_oferta(p_clinica_id, p_codigo_hash) → (r_enlace_id, r_motivo)`** · F4:692-733 · `src/lib/confirmacion/reagendarConfirmacion.ts:37`. STABLE. Sólo ofrece si la respuesta fue `cancelo`, la cita sigue cancelada y es de esa persona, no hay reagendo previo, han pasado menos de 7 días y no se alcanzó `candado_reagendados`. Devuelve el **id** del enlace fijo del médico (no su código). COMPROBADO: antes de cancelar → `no_aplica`; tras cancelar → `ok`; con la clínica B → `no_aplica`. **Sin hallazgos.**

**`reagendar_por_enlace(…15)`** · F4:746-827 · `servidorReserva.ts:145`. Bloquea la confirmación y la cita de origen, exige enlace fijo vigente DEL MISMO médico y clínica, y llama a `reservar_por_enlace` en la misma transacción (con su verificación de correo, candado 1790 y «1 activa»). Tope `candado_reagendados` comprobado ANTES de reservar; el incremento va en la cita nueva y el INSERT de `cita_reagendos` en la misma transacción: si algo falla se deshace TODO, también la cita nueva (no hay contador que sobreviva a medias ni que se pueda esquivar). COMPROBADO: `ok` (cita nueva con `reserva_reagendados = 1`, aviso `reagendado_paciente`); mismo envío → `repetida`; otro envío → `ya_reagendada`. Orden de candados confirmación → cita → enlace → 1790, coherente con `cita_confirmacion_responder` y `reservar_por_enlace`. **Sin hallazgos.**

### Resto de funciones leídas enteras en esta ronda (las llama el servidor por cron o con sesión; ninguna alcanzable por un visitante)

Común: INVOKER, `postgres`, `search_path=''`, EXECUTE sólo `service_role`; todas reciben `p_clinica_id` y TODA lectura o escritura va filtrada por él (leído línea a línea).

| Función (archivo:líneas) | Llamador | Lee / escribe | Notas | Hallazgos |
|---|---|---|---|---|
| `gcal_sync_tomar` (F2:505-558) | `src/lib/gcalSincronizacionBase.ts:135` (cron y `POST /api/google/sync`) | `gcal_sync_estado` de la clínica; exige v2 y LA conexión activa de esa clínica con ese calendario | arrendamiento 10-900 s, espera exponencial por errores (tope 1 h) | ninguno |
| `gcal_sync_avanzar` (F2:562-593), `gcal_sync_reiniciar` (596-612), `gcal_sync_soltar` (616-634) | `…Base.ts:153/161/184` | sólo la fila de la clínica con ESE testigo de candado | `soltar` no exige candado vivo (el testigo es un uuid nuevo por toma) | ninguno |
| `gcal_sync_frescura` (F2:659-669) | `…Base.ts:178` | lee `ultima_ok` y si hay candado, de la clínica | — | ninguno |
| `gcal_citas_por_evento` (F2:742-775) | `…Base.ts:225` | citas de la clínica por evento o id; título sólo sin paciente, notas sólo de Google sin paciente | tope 2500 ids | ninguno |
| `reserva_empalmes_registrar` (F2:919-967) | `…Base.ts:275` | pares solapados reserva/otra de la clínica y mismo médico → `reserva_empalmes_google` + `audit_log` (sólo ids) | `ON CONFLICT DO NOTHING` | ninguno |
| `cita_rsvp_google` (F2:973-1022) | `…Base.ts:301` | sólo `scheduled → confirmed`, cita futura de la clínica cuyo correo de paciente o de reserva está entre los que aceptaron; `FOR UPDATE`, hora real tras el candado | `spinus.via = google_rsvp` | ninguno |
| `cita_movimiento_google_registrar` (F2:1027-1053) | `…Base.ts:286` | inserta un intento rechazado si la cita es de la clínica, por enlace y futura | — | ninguno |
| `gcal_bloqueo_aplicar` (F2:1062-1147) | `…Base.ts:253` | mueve o borra un bloqueo QUE YA EXISTE de la clínica; candado 1790 antes del `FOR UPDATE` | puede lanzar 22023 «puntas inválidas» con datos de Google (> 400 días) | ninguno |
| `cita_reagendar_clinica` (F4:836-914) | `src/lib/agenda/eleccionServidor.ts:58` (sesión del personal) | cita por enlace, futura, de la clínica; vuelve a aplicar la regla de `appointments_update` con `p_actor`; consultorio activo del MISMO médico; GUC `spinus.reagendar_cita` sólo alrededor del UPDATE | no toma el candado 1790 ni mira empalmes (misma clase que A7); el bloqueo lo frena el disparador | ninguno nuevo |
| `cita_correo_marcar` (F4:999-1020) | `src/lib/confirmacion/recordatorios.ts:118` | cierra un envío de la clínica sólo con el testigo que lo tomó | — | ninguno |
| `aviso_clinica_de_respuesta/_confirmacion/_empalme/_movimiento_google` (F4:1135-1227) | disparadores DEFINER | insertan en `avisos_clinica` con la clínica de la fila que los dispara | `ON CONFLICT … DO NOTHING` (o refresca la hora) | ninguno |
| `proteger_reserva_contactos` (F3:513-564, cambiada) | disparador | ver A3 y A13 | | A13 |

**§0-bis.** Con esto, las 66 funciones del catálogo están leídas enteras (R1 o R2). **Pendiente de lectura entera, para la pasada 2: los pre-vuelos y post-vuelos de F3, F2, F4, F5a y T** (no son funciones; ver «Lo que falta»).

## Parte 4 — Matriz de escrituras desde la sesión (COMPROBADA ejecutando)

Sesión simulada como PostgREST (`SET LOCAL ROLE` + `request.jwt.claims`); antes comprobé que `auth.uid()` y `get_clinica_id()` devuelven lo esperado. Filas de muestra de la clínica A (médico A1). Cada celda: lo que devolvió el intento. INSERT = copia de una fila real con `id` nuevo (un `23505` significa que privilegio, RLS y disparadores lo dejaron pasar y chocó con una llave única: cuenta como **permitido**). UPDATE = sin cambiar valores (mide privilegio + RLS). `0` = cero filas (RLS no la ve). `—` = `42501` sin privilegio. medA = médico administrador de A y dueño de las filas; medA2 = otro médico de A, no administrador.

| Tabla | medA ve/I/U/D | secA ve/I/U/D | medA2 ve/I/U/D | medB (otra clínica) ve/I/U/D | anon | ¿Como el diseño? |
|---|---|---|---|---|---|---|
| `agenda_ajustes` | sí / permitido sin interruptor (R1) / **sí** / — | sí / — / 0 / — | sí / — / 0 / — | 0 / — / 0 / — | — | sí (sólo el administrador; interruptor y candado: 42501 del disparador, R1) |
| `tipos_cita` | sí / **sí** / **sí** / — | sí / — / 0 / — | 0 / 23514 / 0 / — | 0 / 23514 / 0 / — | — | sí |
| `agenda_bloqueos` | sí / sí con sus 7 columnas (R1) / **sí** / **sí** | sí / ídem / **sí** / **sí** | 0 / — / 0 / 0 | 0 / — / 0 / 0 | — | sí (INSERT con todas las columnas: 42501 por permiso de columna) |
| `reserva_enlaces` | sí / — (42501 disparador) / **sí** / — | sí / — / **sí** / — | 0 / — / 0 / — | 0 / — / 0 / — | — | sí (UPDATE sólo revoca o pausa: el disparador veta lo demás, R1) |
| `reserva_contactos` | sí / **sí** / **sí** / — | sí / **sí** / **sí** / — | 0 / 23514 / 0 / — | 0 / 23514 / 0 / — | — | sí; el 23514 sustituye al 42501 de la RLS (A3) |
| `reserva_avisos` | lee / — / — / — | igual | igual | igual (tabla global, sin datos de clínica) | — | sí |
| `reserva_incidencias` | lee / — / — / — | lee / — / — / — | 0 / — / — / — | 0 / — / — / — | — | sí |
| `reserva_verificaciones` | — / — / — / — | — | — | — | — | sí (cerrada a la sesión) |
| `reserva_empalmes_google` | lee / — / — / — | lee / — | 0 / — | 0 / — | — | sí |
| `gcal_sync_estado` | — / — / — / — | — | — | — | — | sí |
| `gcal_movimientos_rechazados` | — / — / — / — | — | — | — | — | sí |
| `cita_confirmaciones` | lee (7 columnas, sin `codigo_hash`) / — / — / — | lee / — | 0 / — | 0 / — | — | sí |
| `cita_reagendos` | lee / — / — / — | lee / — | 0 / — | 0 / — | — | sí |
| `cita_correos` | lee / — / — / — | lee / — | 0 / — | 0 / — | — | sí |
| `avisos_clinica` | lee / — / sólo `revisado_*` (R1) / — | igual | 0 / — / — / — | 0 / — / — / — | — | sí |

Columnas nuevas de tablas existentes: `consultorios.horario_propio`/`horario_revisado_en` → el médico en SU consultorio sí (1 fila); en el de otro médico, la secretaria y la otra clínica, 0 filas. `clinicas.timezone` → **0 filas para todos desde la sesión, también para el administrador** (no hay policy de UPDATE de `clinicas` para la sesión; lo escribe `PUT /api/me/horario` con el cliente de servicio: ver Parte 3). `appointments.tipo_cita_*` → el médico en su cita, sí; `reserva_*` → 42501 del disparador (también la secretaria); `cerrada_en`/`sustituida_por` → 42501; `google_asignacion` → 42501 (R1); la otra clínica, 0 filas en lectura y escritura.

`service_role` (referencia): puede borrar la fila de `agenda_ajustes` (apaga, no enciende: coherente con «falla cerrado» y con lo que `CLAUDE.md` pide a la semilla) y tiene DELETE sobre `tipos_cita` (lo frena la FK sólo si el tipo está en uso; «no hay DELETE en `tipos_cita`» vale para la sesión, no para el servidor: NOTA).

**Ninguna celda se aparta de lo que el diseño pretende.**

## Parte 1 — Estado de los hallazgos de la ronda 1 (COMPROBADO en el clon nuevo, salvo donde se dice)

| Id | Estado | Comprobación |
|---|---|---|
| A1, A2, A8 y el guion de A5 | **no se cierran en esta pasada** (son de `aplicar.sh`, en cambio) | — |
| A3 | **Corregido conforme al criterio.** | Secretaria de A con un médico de B y con un UUID inexistente: el MISMO `23514 El médico del contacto no pertenece a la clínica` (antes: entraba / 23503). Un médico no administrador sigue pudiendo bloquear en lo suyo; la secretaria bloquea y desbloquea con `reserva_contacto_marcar`. Efectos de la corrección: (1) el disparador corre antes que la RLS, así que quien antes recibía `42501` de la policy (otra clínica, o un médico no administrador escribiendo para otro médico cuyo perfil no ve) ahora recibe `23514`: quien traduzca errores de esa tabla debe tratar los dos igual; (2) nuevo A13. |
| A4 | **Corregido conforme al criterio.** | Ciclo completo con ediciones intermedias: aplicar → editar el NOMBRE del consultorio A2 y el HORARIO del A → reversa sin confirmar se niega nombrando sólo datos reales («horario editado: 1», más ajustes/tipos/citas con tipo) → confirmada: A2 recupera `previo-A2` (editar otro campo ya no cuenta), A conserva su horario editado → reaplicar (respaldo: primera copia intacta, `horario_antes` = lo que había, `horario_copiado` = el de la clínica) → editar el teléfono de B → reversa **sin confirmar, `rc=0`**: A vuelve a su horario editado, A2 y B a los previos. La F1 nueva aborta en el pre-vuelo si el respaldo existe con la forma vieja (sólo puede pasar en bases locales; en producción no existe, F1.9 de los conteos). Sin hallazgos nuevos. |
| A5 (parte de SQL) | **A medias.** | Cada reversa trae ahora en su cabecera la consulta de guarda de sólo lectura, pero la reversa de F5b **sigue sin negarse** con la v2 encendida: en el clon, con v2 encendida y datos, T y F5b se deshicieron (`rc=0`) y F4 se negó. Que no se quede a medias depende sólo de que el guion (pendiente) corra las guardas de toda la cadena antes de la primera. |
| A6 | **Corregido.** | Repetidas 20261126 y F5a con las 9 aplicadas: `rc=0`, 0 filas `REVISAR`. |
| A7 | **Aceptado como límite; la documentación dice la verdad.** | El `COMMENT` de `reservar_por_enlace`, `cita_proteger_bloqueo` y `agenda_bloqueos` describe exactamente la carrera que reproduje en R1. Daño no dicho antes, misma clase: `cita_reagendar_clinica` (leída entera en esta ronda) tampoco toma el candado 1790 ni mira empalmes, así que «Reagendar» del personal puede cruzarse con una reserva por enlace en la misma ventana de milisegundos. |
| A9 | **Aceptado sin FK; documentado.** | Los cuatro `COMMENT ON COLUMN` dicen el motivo. Una imprecisión: el de `gcal_movimientos_rechazados.cita_id` habla de «la policy no muestra la fila», y esa tabla no tiene policy ni lectura para la sesión (se llega a ella sólo por `avisos_clinica`). Sin daño nuevo: los huérfanos siguen siendo invisibles y permanentes. |
| A10, A11 | Sin cambio (eran NOTAS; no se pidió corrección). | — |
| A12 | **Corregido.** | Cabeceras de 20261125 y 20261126 al día (leído en el diff). |
| R1 «no auditado» nº 7 | **Cerrado.** | Reversas de F4, F2, F3 y F5a: sin confirmar se niegan nombrando las tablas y los recuentos; con `spinus.reversa_con_datos = 'si'` terminan en `rc=0`. |

## Hallazgos nuevos de esta pasada

### A13 · LEVE · Tras A3, `reserva_contacto_marcar` deja de poder bloquear Y DESBLOQUEAR si el médico de la cita ya no tiene `role = 'medico'`
- **Dónde:** `supabase/migrations/20261201140000_agenda_f3_reserva_enlace.sql:525-532` (comprobación nueva en el INSERT de `proteger_reserva_contactos`) y `:677-711` (`reserva_contacto_marcar`, que hace `INSERT … ON CONFLICT DO UPDATE`: el disparador BEFORE INSERT corre también cuando la fila ya existe).
- **Reproducción (COMPROBADO):** con un contacto bloqueado de un médico, cambiar `profiles.role` de ese médico a `super_admin`; como secretaria, `select public.reserva_contacto_marcar('<cita>', 'desbloquear')` → `23514 El médico del contacto no pertenece a la clínica`. El `UPDATE` directo de `perdonado_en` sí pasa (1 fila).
- **Daño:** un paciente bloqueado a mano para un médico que cambió de rol no se puede desbloquear desde la pantalla (`src/app/api/agenda/reservas/contactos/route.ts:61`). Sólo si un médico con reservas por enlace cambia de rol; hoy es raro.
- **Criterio:** la regla «médico de la clínica» se exige al CREAR la fila; desbloquear (o volver a bloquear) un contacto que ya existe no puede depender del rol actual del médico. Con una prueba que lo cubra.

### A14 · LEVE · `reserva_verificaciones` crece sin límite y `reserva_codigo_emitir` no tiene tope propio
- **Dónde:** `20261201140000…sql:882-909`. Cada petición de código inserta una fila; nada las borra ni las caduca (la tabla no tiene DELETE para nadie salvo el dueño). El único freno (30 s por enlace y correo, límites por red) vive en `src/lib/reserva/limitesReserva.ts`.
- **DEDUCIDO** de la lectura; en el clon, 4 peticiones dejaron 4 filas.
- **Daño:** crecimiento lento de una tabla con HMAC de correos de personas que quizá nunca reservaron (minimización de datos: se conservan para siempre). No es un fallo de seguridad.
- **Criterio:** un plazo de conservación escrito y quien lo aplica (limpieza como `postgres`), o el motivo de conservarlas en el `COMMENT` de la tabla.

## Parte 3 — `createAdminClient()` (PARCIAL en esta pasada)

Inventario: 78 archivos de `src/` lo nombran en la rama; 40 en `main`. De los 38 nuevos, **16 sólo lo nombran en un comentario** («CLIENTE DE SESIÓN, NUNCA `createAdminClient()`») y no lo usan: `agenda/configuracion/page.tsx`, `agenda/page.tsx`, `api/agenda/tipos-cita/route.ts`, `api/me/ajustes-agenda/route.ts`, `lib/agenda/{ajustesAgenda,bloqueoTotalServidor,consultaCitas,empalmesServidor,porLigarServidor,tipoCitaServidor,whatsappServidor}.ts`, `lib/avisos/avisosServidor.ts`, `lib/configAppServidor.ts`, `lib/reserva/gestionServidor.ts` (y `middleware.ts`, cambiado).

Revisados uno por uno en esta pasada (DEDUCIDO por lectura; el filtro de las RPC está además COMPROBADO en el clon con la clínica B, Parte 2):

| archivo:línea | Quién llega | Consulta con el cliente de servicio | ¿De dónde sale la clínica? | ¿A → B? | Veredicto |
|---|---|---|---|---|---|
| `src/lib/reserva/servidorReserva.ts:56` (`llamar`) | visitante sin sesión, rutas `/api/reservar/*` | `reserva_contexto` (por hash del código), y `reserva_ocupacion`, `reserva_codigo_emitir`, `reserva_codigo_verificar`, `reservar_por_enlace`, `reagendar_por_enlace` con `p_clinica_id: ctx.clinica_id` | del propio enlace: `ctx` es lo que devolvió `reserva_contexto` para el código presentado; nunca del cuerpo de la petición | no (cada RPC vuelve a casar enlace y clínica: comprobado) | bien |
| `src/lib/reserva/limitesReserva.ts:94,135,171` | ídem | `rate_limit_intento`, `rate_limit_espera` (llave `ruta` compuesta por el servidor con seudónimos), `reserva_espera_reenvio` (con clínica y enlace) | del contexto del enlace | no hay datos de clínica en `ip_rate_limits` | bien |
| `src/lib/audit.ts:281` (`logAudit`, cambiado) | cualquier ruta | sólo INSERT en `audit_log` | no lee nada | no | bien (no es lectura) |
| `src/app/api/me/clinica/route.ts:188,227` (cambiado) | sesión sin clínica todavía | INSERT de la clínica nueva y, si falla el perfil, DELETE de ESA clínica por el id recién creado | del propio INSERT | no | bien (líneas de `main`; el cambio de la rama no toca estas consultas) |
| `src/lib/confirmacion/reagendarConfirmacion.ts:36` | visitante con código de confirmación | `cita_reagendar_oferta(p_clinica_id, p_codigo_hash)` | pendiente de confirmar de dónde sale `p_clinica_id` (pasada 2) | la RPC exige que el código sea de esa clínica (comprobado: con B → `no_aplica`) | bien en la base; llamador por confirmar |

**Pendientes de revisar uno por uno (pasada 2), lista exacta:** `src/app/api/agenda/enlaces/route.ts:124-131` (origen de `args`), `src/app/api/agenda/restablecer/route.ts:61`, `src/app/api/agenda/bloqueos/route.ts:49` y `bloqueos/[id]/route.ts:45`, `src/app/api/appointments/[id]/quitar/route.ts:82`, `src/app/api/appointments/[id]/route.ts:81,186,672,1291,1404`, `src/app/api/appointments/route.ts:303,699`, `src/app/api/google/events/route.ts:226`, `src/app/api/me/horario/route.ts:70`, `src/lib/agenda/asistenciaServidor.ts:79`, `consultoriosAgendaServidor.ts:41`, `eleccionServidor.ts:58`, `notaLigadaServidor.ts:17`, `sustitucionServidor.ts:70,76`, `src/lib/confirmacion/enlaceConfirmacion.ts:83`, `googleConfirmacion.ts:44`, `recordatorios.ts:56`, `src/lib/gcalConexion.ts` (los 12 usos; 4 sobre `google_tokens` sin `clinica_id` en la sentencia: 433, 489, 654, 733), `gcalEscritura.ts:212`, `gcalSincronizacion.ts:160`, `gcalSincronizacionBase.ts:96`, `gcalSincronizacionBloqueos.ts:86`, `src/lib/reserva/correoClinicaReserva.ts:88,95`, `googleReserva.ts:91`, `preparacionServidor.ts:48`, `sincronizarReserva.ts:129`. Un barrido automático encontró `clinica_id` / `p_clinica_id` en la sentencia de todos menos los de `google_tokens`, pero **eso no es una revisión**: falta leer de dónde sale cada valor.

## Lo que TODAVÍA falta (para la pasada 2)

1. **Pre-vuelos y post-vuelos, enteros, de F3, F2, F4, F5a y T** (`20261201140000:94-215` y `1431-1578`; `…150000:111-320` y `1203-1310`; `…160000:87-…` y `1305-1416`; `…130000:45-136` y `271-309`; `…180000:63-222`). No leídos enteros todavía. (Sí comprobado ejecutando: aplican en verde sobre la foto, abortan o repiten limpio en la segunda pasada.)
2. **Parte 3:** los usos de `createAdminClient()` de la lista de arriba.
3. **Funciones: ninguna pendiente.** Las 66 están leídas enteras (R1 o R2).
4. Sin cambio respecto de la ronda 1: `aplicar.sh` de punta a punta, el pooler real, la aplicación en marcha, el replay desde `baseline/`.

## Veredicto de la pasada 1

**¿Hay hallazgos que impidan aplicar a producción? No, con lo auditado hasta aquí:** las correcciones de A3, A4, A6 y A12 son buenas, los dos hallazgos nuevos son LEVES (A13, A14), y la matriz de escrituras desde la sesión coincide celda a celda con el diseño. La ronda **no se cierra**: quedan los pre/post-vuelos de cinco archivos, la mayor parte de `createAdminClient()` y, aparte, A1/A2/A5/A8 en el guion.

---

# PASADA 2 DE 2

## P2-1 — Pre-vuelos y post-vuelos de F3, F2, F4, F5a y T (leídos ENTEROS, línea a línea)

Común a los cinco (DEDUCIDO de la lectura; COMPROBADO en las dos rondas que aplican en verde sobre la foto y que la segunda pasada aborta o repite limpio): toda referencia va calificada (`'public.x'::regclass`, `to_regprocedure('public.…')`); donde se compara texto que depende del `search_path` (`pg_get_constraintdef`, `pg_get_triggerdef`) se quita `public.` antes de comparar o se arma el nombre con su esquema; todas las comprobaciones abortan con `RAISE EXCEPTION` dentro de la transacción, antes del `COMMIT`.

| Archivo | Pre-vuelo: qué comprueba | Post-vuelo: qué comprueba | Qué NO comprueba | Hallazgos |
|---|---|---|---|---|
| **F3** `…140000:94-195` y `1431-1576` | nada suyo existe ya (5 tablas, cualquier columna `reserva_%` de `appointments`, 16 nombres de función, su disparador); 6 tablas de `main`; dueño de `appointments`, `clinicas`, `profiles`; los 3 helpers de las policies existen y son DEFINER; `service_role` con BYPASSRLS; 18 columnas de `appointments`; el índice único `idx_appointments_client_id`; tablas y 14 columnas de F1; `agenda_v2_encendida` INVOKER; `agenda_bloqueos` de F5a | RLS y privilegios de las 5 tablas (nada a `anon`; sin DELETE/TRUNCATE); la lista EXACTA de policies; las 15 funciones sin PUBLIC, `search_path=""`, DEFINER sólo `reserva_registrar_incidencia`; queda sólo la `reserva_enlace_emitir` de 9 argumentos; las 8 RPC públicas sólo de `service_role`; 11 columnas `reserva_*` y sólo una con DEFAULT; md5 de `appointments_reserva_check`; ninguna FK en cascada; la lista exacta de disparadores con su función; md5 exacto de `proteger_reserva_enlaces`; 13 fragmentos y el ORDEN contador → `client_id_en_uso` → candado → INSERT dentro de `reservar_por_enlace`; bloqueo, `NOT a.all_day` y pausa en `reserva_ocupacion`; que el candado automático cuenta sólo por correo | los TIPOS de las columnas de `main` (sólo que existan); las columnas que sus cuerpos plpgsql leen de `profiles` (`titulo`, `telefono_consultorio`…), `clinicas.nombre_display`, `consultorios.telefono` e `ip_rate_limits` (`ruta`, `created_at`): si faltaran no aborta, fallaría la RPC en uso (en la foto existen: las pruebas del proyecto las ejercitan en verde sobre el clon) | ninguno; NOTA: el md5 de la CHECK depende de cómo PostgreSQL 17 reescribe la expresión (en otra versión mayor aborta, ruidoso) |
| **F2** `…150000:111-320` y `1203-1308` | BYPASSRLS; 6 tablas de `main`; dueño de `appointments` y `clinicas`; 7 columnas de `clinica_conexiones_google` y 18 de `appointments` CON su tipo; el índice único parcial `(clinica_id, google_event_id)`; columnas de `pacientes`, `profiles`, `audit_log`; 12 privilegios de `service_role` uno a uno; `get_clinica_id()` DEFINER; las dos puertas son SQL, DEFINER, boolean y nombran `public.get_clinica_id()`; F1 (interruptor), F3 (`reserva_canal`), F5a (`agenda_bloqueos`, 11 columnas y privilegios); si sus 3 tablas ya existen, que tengan EXACTAMENTE sus columnas y sean de quien aplica; `google_asignacion` con su tipo y su CHECK, y si existe sin CHECK cuenta las filas que la violarían; sus 15 funciones, si existen, son INVOKER y suyas; no hay otra `gcal_%` ajena | cada función existe, INVOKER, `search_path=""`, sin PUBLIC, con `service_role` y sin `anon`/`authenticated` (salvo la de disparador); RLS y privilegios exactos de las 3 tablas; 0 policies en dos y 1 en la tercera; las 3 FK a `clinicas` RESTRICT; la CHECK validada; el disparador de asignación con su definición exacta; `spinus.via` en tres cuerpos y el candado 1790 en el cuarto; **ejecuta la puerta S3** con una clínica inexistente y exige `false` (si la forma de las puertas no se pudiera evaluar, aborta aquí) | que `agenda_bloqueos` tenga su disparador `preparar` (F5a ya lo exige) | ninguno |
| **F4** `…160000:87-200` y `1305-1414` | quien aplica es `postgres` exacto; nada suyo existe (4 tablas, 20 nombres, 3 disparadores); 70 columnas CON su tipo de 10 tablas (F1, F2, F3 y `main`); `clinicas.suspendida` y el interruptor NOT NULL; `agenda_ajustes.clinica_id` única; md5 de `clinica_no_suspendida()` con TODO espacio en blanco colapsado (`\s+` → un espacio: acepta diferencias de espacios y fines de línea, no de código; coincide con F4.3 de los conteos); helpers; BYPASSRLS; 9 privilegios de `service_role`; interruptor INVOKER; la puerta S3; `reservar_por_enlace` de 14; `enlace_paciente` en `log_cita_change` | privilegios de tabla EXACTOS por rol y PUBLIC (por `aclexplode`); RLS en las 4; privilegios de columna exactos; las 19 funciones: dueño `postgres`, `search_path`, DEFINER sólo `aviso_clinica_de_*`, sin PUBLIC, quién ejecuta, y que `cita_correos_pendientes` no exista; 11 disparadores con su función; el índice único parcial de avisos; el interruptor en 4 cuerpos y `recordatorio_encendido` en el listado | las policies de sus 4 tablas (ni cuántas ni su texto: si faltara una, la lectura quedaría cerrada, no abierta); la propiedad de `appointments`/`clinicas`/`profiles` para sus FK (la exigen F1 y F3 antes) | ninguno |
| **F5a** `…130000:45-112`, `120-132` y `271-307` | `clinicas`, `profiles`; 6 funciones de `main`; md5 de `clinica_no_suspendida()` y de `clinica_tiene_acceso()` normalizando SÓLO `\r\n` (coinciden con F5a.2 y F5a.3 de los conteos: `a2dcfa8f…`, `2efd7734…`); F1; `authenticated` ejecuta el interruptor; si ya existe: el cuerpo de `agenda_bloqueo_preparar`, las 14 columnas con tipo y las 9 restricciones; candado NOWAIT con 50 reintentos sobre `clinicas` y `profiles` | RLS; las 4 policies permisivas por nombre y comando; privilegios de más y de menos (tabla y columna); sin PUBLIC en la función; los 2 disparadores | la propiedad de `clinicas` y `profiles` (si no fuera el dueño fallaría el `CREATE TABLE` con sus FK, dentro de la transacción: no queda nada a medias) | ninguno; NOTA: aborta por un cambio de un solo espacio en cualquiera de las dos puertas (decisión declarada en la dimensión 28) |
| **T** `…180000:63-140`, `142-160`, `191-220` | `prohibir_truncate()` es la de 20261126 (md5, INVOKER, `search_path`); las 11 tablas con disparador existen y son de quien aplica, cada una con el nombre de la migración que falta; las 5 sin disparador existen; ningún TRUNCATE concedido a PUBLIC, por otro otorgante o en tabla ajena (dimensión 26); un disparador con su nombre es exactamente el suyo | los 11 disparadores (tipo 34, función, sin WHEN, habilitados); CERO TRUNCATE efectivo (`has_table_privilege`) de los tres roles en las 16 tablas, incluido el respaldo | — | ninguno |

**Contra la foto y los conteos:** nada de lo que estos bloques suponen de producción queda desmentido (G.02 `postgres`; G.04 `public` visible; F2.1-F2.8, F3.1-F3.4, F4.1-F4.4, F5a.1-F5a.4, T.1-T.3 en `OK`). **Ninguno deja pasar algo que debiera frenar ni aborta por algo ajeno a lo que crea.** Una observación de conjunto, sin daño: la misma función `clinica_no_suspendida()` se vigila de tres maneras distintas (F5a md5 con `\r\n` normalizado; F2 por forma; F4 md5 con todo el espacio colapsado); cualquier cambio de código la detiene en las tres.

## P2-2 — `createAdminClient()`: tabla completa (leído uso por uso; DEDUCIDO por lectura, y el filtro de cada RPC además COMPROBADO en el clon en la pasada 1)

**Conteo corregido.** `git grep createAdminClient()` en `src/` (sin pruebas ni `lib/supabase`): 78 archivos en la rama, 40 en `main`; 38 nuevos. De esos 38, **14 sólo lo nombran en un comentario** («CLIENTE DE SESIÓN, NUNCA…») y no lo usan (la pasada 1 dijo 16 por error): `agenda/configuracion/page.tsx`, `agenda/page.tsx`, `api/agenda/tipos-cita/route.ts`, `api/me/ajustes-agenda/route.ts`, `lib/agenda/{ajustesAgenda,bloqueoTotalServidor,consultaCitas,empalmesServidor,porLigarServidor,tipoCitaServidor,whatsappServidor}.ts`, `lib/avisos/avisosServidor.ts`, `lib/configAppServidor.ts`, `lib/reserva/gestionServidor.ts`. También `middleware.ts` (cambiado, sólo comentario). Quedan **24 archivos nuevos que lo usan** y 7 de `main` cambiados por la rama.

«Sesión» = la clínica sale del perfil leído con el cliente de sesión (`entradaGestion()` / `getProfileAndClinica()`), nunca del cuerpo de la petición.

| archivo:línea | ¿Nuevo? | Quién llega | Qué hace con el cliente de servicio | De dónde sale la clínica | ¿A → B? | Veredicto |
|---|---|---|---|---|---|---|
| `api/agenda/enlaces/route.ts:124-131` | nuevo | personal con sesión (v2, permiso sobre ese médico) | `reserva_enlace_emitir` | `p_clinica_id` y `p_actor` de la sesión; `p_medico_id` del cuerpo, pero la RPC y el disparador exigen que sea médico de esa clínica (comprobado en R1) | no | bien |
| `api/agenda/restablecer/route.ts:61` | nuevo | administrador con sesión | `agenda_restablecer_configuracion` | sesión; la función vuelve a comprobar al actor | no | bien |
| `api/agenda/bloqueos/route.ts:49`, `bloqueos/[id]/route.ts:45` | nuevo | personal con sesión | pasa el cliente a `conCalendarioSpinus` (tokens de Google de la conexión) | la conexión se resuelve con el cliente de SESIÓN y la clínica de la sesión; el bloqueo se leyó con sesión y `clinica_id` | no | bien |
| `api/appointments/[id]/quitar/route.ts:82` | nuevo | personal con sesión (cita leída antes con sesión) | UPDATE `cerrada_en` | `.eq('id').eq('clinica_id', sesión).eq('status','cancelled')` | no | bien |
| `api/appointments/[id]/route.ts:81,186,1404` | en `main`, cambiado | personal con sesión | UPDATE de columnas `gcal_*` de la cita | `.eq('id').eq('clinica_id', sesión)` | no | bien |
| `api/appointments/[id]/route.ts:672`; `api/appointments/route.ts:303` | en `main` | ídem | lee el consultorio para la instantánea | `.eq('clinica_id', sesión).eq('medico_id').eq('activo')` | no | bien |
| `api/appointments/[id]/route.ts:1291` | en `main` | ídem | lee el correo del paciente saliente | `.eq('id').eq('clinica_id', sesión)` | no | bien |
| `api/appointments/route.ts:699` | en `main`, cambiado | ídem | UPDATE `gcal_*` de la cita recién creada | `.eq('id').eq('clinica_id', sesión)` | no | bien |
| `api/google/events/route.ts:226` | en `main`, cambiado | personal con sesión | cliente para los tokens de la conexión; las citas se leen con sesión y `clinica_id` | sesión | no | bien |
| `api/me/horario/route.ts:70` | en `main`, cambiado (añade `timezone`) | administrador con sesión | UPDATE `clinicas.horario_consulta` y `timezone` | `.eq('id', profile.clinica_id)` | no | bien |
| `api/me/clinica/route.ts:188,227` | en `main` | sesión sin clínica aún | INSERT de la clínica nueva; DELETE de ESA por su id si falla | del propio INSERT | no | bien |
| `lib/audit.ts:281` | en `main`, cambiado | cualquiera | sólo INSERT en `audit_log` | — | no | bien |
| `lib/agenda/asistenciaServidor.ts:79` | nuevo | página de la agenda (sesión) | lee qué citas tienen nota | `.eq('pacientes.clinica_id', sesión)` y los ids vienen de citas leídas con sesión | no | bien (sólo un sí/no, como `cita_tiene_nota_ligada`) |
| `lib/agenda/notaLigadaServidor.ts:17` | nuevo | rutas de citas (sesión) | ídem para una cita | `.eq('pacientes.clinica_id', sesión)` | no | bien |
| `lib/agenda/consultoriosAgendaServidor.ts:41` | nuevo | página de la agenda (sesión) | lee 6 columnas de `consultorios` | `.eq('clinica_id', perfil de la sesión)` y, si no ve a todos, `.eq('medico_id', él)` | no | bien |
| `lib/agenda/eleccionServidor.ts:58` | nuevo | personal con sesión | `cita_reagendar_clinica` | sesión; la función repite la regla de `appointments_update` con el actor | no | bien |
| `lib/agenda/sustitucionServidor.ts:70,76` | nuevo | personal con sesión | lee / cierra la cancelada sustituida | `.eq('id').eq('clinica_id', sesión)` | no | bien |
| `lib/reserva/preparacionServidor.ts:48` | nuevo | personal con sesión | lee 3 columnas de `consultorios` | `.eq('clinica_id', sesión)` y alcance del rol | no | bien |
| `lib/reserva/servidorReserva.ts:56` | nuevo | **visitante sin sesión** | las 6 RPC de la reserva | del enlace: `ctx` devuelto por `reserva_contexto` para el código presentado | no | bien |
| `lib/reserva/limitesReserva.ts:94,135,171` | nuevo | visitante | límites de tasa | llaves compuestas por el servidor; `reserva_espera_reenvio` con clínica y enlace del contexto | no | bien |
| `lib/reserva/correoClinicaReserva.ts:88,95` | nuevo | tras una reserva pública | lee el ajuste y los administradores (ids → correo por Auth) | `.eq('clinica_id', la de la cita recién reservada)` | no | bien |
| `lib/reserva/googleReserva.ts:91`, `sincronizarReserva.ts:129` | nuevo | tras una reserva pública | resuelve LA conexión de Google de la clínica | `resolverConexionClinica(admin, clinicaId)` filtra `.eq('clinica_id')`; además `conexion.clinicaId !== clinicaId → sin_conexion` | no | bien |
| `lib/confirmacion/enlaceConfirmacion.ts:83` | nuevo | **visitante con código de confirmación**; personal al emitir | `cita_confirmacion_contexto` (por hash), `responder`, `emitir`, `revocar` | del propio enlace (`ctx.clinica_id` devuelto por el contexto) o de la sesión al emitir | no | bien |
| `lib/confirmacion/reagendarConfirmacion.ts:36` | nuevo | visitante con código | `cita_reagendar_oferta` | `ctx.clinica_id` del contexto de confirmación; además exige que el enlace fijo abierto sea de esa misma clínica (`:64`) | no | bien |
| `lib/confirmacion/googleConfirmacion.ts:44` | nuevo | tras responder por enlace | conexión de Google de la clínica de la cita | `resolverConexionClinica(admin, c.clinicaId)` | no | bien |
| `lib/confirmacion/recordatorios.ts:56` | nuevo | **cron** (`CRON_SECRET`) | `cita_recordatorios_pendientes` (entre clínicas, a propósito: devuelve sólo pares clínica/cita), `cita_correo_tomar/marcar`, `cita_nombre_saludo` con la clínica de cada par | de la propia base | no (no hay usuario) | bien |
| `lib/gcalSincronizacionBase.ts:96` | nuevo | cron y `POST /api/google/sync` (sesión) | todas las RPC `gcal_*` | `llamar(rpc, clinicaId, …)` pone siempre `p_clinica_id`; la clínica es la de la conexión (del listado del cron, o resuelta con sesión) | no | bien |
| `lib/gcalSincronizacionBloqueos.ts:86` | nuevo | ídem | lee `google_event_id` de bloqueos | `.eq('clinica_id', la de la conexión)` | no | bien |
| `lib/gcalSincronizacion.ts:160`, `lib/gcalEscritura.ts:212` | nuevo | ídem / personal con sesión | cliente para los tokens de la conexión | conexión ya resuelta para esa clínica | no | bien |
| `lib/gcalConexion.ts:776` | **nuevo en un archivo de `main`** | cron | `gcal_sync_clinicas_pendientes` (la única lectura entre clínicas; sin secretos) | — | no hay usuario | bien |
| `lib/gcalConexion.ts:433,489,654,733` (`google_tokens`) | **ya en `main`** (4 y 4; la rama no las toca) | — | espejo de tokens por `user_id` de la conexión | `google_tokens` no tiene `clinica_id`; la llave es el `user_id` de una conexión ya resuelta por clínica | no | bien; fuera del cambio de la rama |
| `lib/gcalConexion.ts:214,386,473,543,621,697,725` | ya en `main` | — | RPC y lecturas de `clinica_conexiones_google` | con `clinica_id` | no | bien; fuera del cambio |

**Resultado: ningún uso nuevo o cambiado toma la clínica de algo que controle quien llama, y ninguno deja a un usuario de A leer o escribir algo de B.** Las dos únicas lecturas entre clínicas son de cron y a propósito.

## P2-3 — A13, con el hecho aclarado por el dueño (verificado)

En la foto, `profiles_role_check` admite exactamente `super_admin`, `medico`, `secretaria` (`02-esquema.sql:2501`); «administrador» es la casilla `es_admin_de_clinica`. Busqué un camino que cambie el `role` de un perfil existente: la sesión no puede (`proteger_columnas_sensibles_profiles()` lo rechaza, foto `:1471`); en `src/` no hay ningún `UPDATE` de `profiles.role` (el rol sólo se fija al crear el perfil: registro e invitación). **No encontré ningún camino en la app ni en la base** por el que un médico con citas cambie de rol; sólo a mano, como `postgres`, o desde fuera del repo (spinus-consola, que no pude ver). **A13 baja de LEVE a NOTA** (latente): el defecto es real y está reproducido, pero hoy no tiene camino; no se retira, porque el día que exista ese camino, desbloquear un contacto fallará con `23514`.

## Cierre de la ronda 2

**Hallazgos nuevos de la pasada 2: ninguno.** Los pre y post-vuelos de los cinco archivos y los `createAdminClient()` restantes no arrojan defectos; sólo las notas anotadas en sus fichas.

| Id | Gravedad final | Estado |
|---|---|---|
| A13 | NOTA (antes LEVE) | abierto, latente; criterio de la pasada 1 |
| A14 | LEVE | abierto (conservación de `reserva_verificaciones`) |
| A5 (parte de SQL) | MEDIO | a medias: depende del guion |
| A1, A2, A5 (guion), A8 | — | sin auditar todavía (`aplicar.sh`), por indicación |
| A3, A4, A6, A12 | — | corregidos y comprobados |
| A7, A9 | — | límites aceptados; documentación veraz (una imprecisión menor en A9) |

**Confirmación explícita.** No queda **ninguna función** de las 9 migraciones sin leer entera (66 de 66), **ningún pre-vuelo ni post-vuelo** sin leer entero (los de 20261125, 20261126, F1 y F5b en la ronda 1; F3, F2, F4, F5a y T en esta) y **ningún `createAdminClient()` nuevo o cambiado** sin revisar (tabla de arriba). Lo que sigue sin poder auditarse, igual que en la ronda 1: `aplicar.sh` (pendiente de su pasada), el pooler real, la aplicación en marcha (sin build ni pruebas) y el replay desde `baseline/`; de `gcalConexion.ts` leí cada sentencia con el cliente de servicio, no el archivo completo.

**Veredicto: no hay hallazgos que impidan aplicar las 9 migraciones a producción; la decisión sobre A1 (ventanas de F3 y F2) y el cierre de A2, A5 y A8 quedan para la pasada del guion.**
