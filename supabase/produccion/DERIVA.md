# Deriva entre producción y el repo (bloque 2.3, agente DV, 2026-11-22)

Fuente de producción: la foto de ESTRUCTURA de `~/spinus-produccion-foto/`
(PostgreSQL 17.6, aarch64; historial con 5 filas, las 5 de `main`). No se
copió nada de ella al repo; aquí sólo van nombres de objetos y md5.

## 0. Resumen

**Sí hay deriva que afecta al conjunto, y es una sola: fines de línea.**
32 funciones de `public` tienen en producción el cuerpo con `\r\n`; el repo (el
volcado `20260912190416_remote_schema.sql`, 0 retornos de carro, frente a 591
líneas con `\r` en el volcado de producción) las tiene con `\n`. Normalizando
`\r\n` → `\n`, las 32 son idénticas byte a byte a las del repo; ninguna difiere
de verdad. Consecuencia, **comprobada aplicando las 8 al clon de la foto real**:

| Migración | Resultado sobre la foto real tal como están los archivos |
|---|---|
| `20261125170000` audit_log sin TRUNCATE | **ABORTA en el pre-vuelo** (md5 de `prevent_audit_modification()` = `7f0318cb…`, espera `f1fe023a…`). Aborto limpio: transacción entera revertida. |
| `20261126120000` public sin TRUNCATE | pasa |
| `20261201120000` F1 | pasa |
| `20261201130000` F5a | **ABORTA en el pre-vuelo** (md5 de `clinica_no_suspendida()` = `bff6c203…`, espera `a2dcfa8f…`; luego abortaría igual por `clinica_tiene_acceso()`). Limpio. |
| `20261201140000` F3 | pasa |
| `20261201150000` F2 | pasa; su rejilla, fila 8 (informativa), sale `REVISAR` por los mismos dos md5 |
| `20261201160000` F4 | pasa (su huella de `clinica_no_suspendida()` normaliza espacios con `\s+`, que incluye `\r`) |
| `20261201170000` F5b | pasa |

Cómo se llegó a «pasa» para las de después de cada aborto: en el mismo clon se
aplicaron copias (en el scratchpad, no en el repo) de 20261125 y F5a cuyas
comparaciones de md5 usan `md5(replace(prosrc, E'\r\n', E'\n'))`; con eso las 8
entraron y todas sus rejillas salieron OK salvo la fila 8 de F2. El aborto de
F5a se reprodujo además en un clon limpio con 20261125 corregida, 20261126 y F1
originales.

**Lo que hay que decidir (Angel; este documento no toca ninguna migración):**
o bien los tres pre-vuelos exactos (20261125 sobre `prevent_audit_modification`,
F5a sobre las dos puertas) aceptan también el md5 de producción o comparan el
cuerpo normalizado, o bien se normalizan los fines de línea en producción antes
(eso reescribe 32 funciones de `main`, entre ellas las dos puertas que «ninguna
migración de v2 modifica»; no parece la opción buena). La primera vía se probó
en el clon y funciona; la segunda no se probó. Las conteos de sólo lectura de Q
(M1.2, F5a.2, F5a.3) darán `false`/ALTO en producción por esta misma causa; ya
lo anticipaba `conteos/LEEME.md`, punto 2.

**Fuera de eso no hay deriva que afecte**: todo lo demás que difiere es (a) el
efecto de 20261125/20261126 (que la foto de referencia local sí lleva), (b)
privilegios que el replay del repo da DE MÁS respecto de producción, (c)
deparseo de tres CHECK, o (d) versión de la plataforma Supabase (auth, storage,
realtime…), que el conjunto no toca. Detalle abajo.

**`20260919230000`:** cuadra punto por punto (§2). Cabecera corregida.

## 1. Método

- **Producción ↔ repo:** `comparar-estructura.sh` entre `05-catalogo.jsonl` de
  la foto y el de `~/spinus-fusion/base-main/` (replay local de las 5 de `main`
  + `20261125170000` + `20261126120000`). No se levantó un Postgres con sólo las
  5: los objetos de esas dos migraciones de más son identificables uno a uno
  (TRUNCATE de tablas y default privileges, 12 disparadores `*_truncate`,
  `prohibir_truncate()` con sus GRANT y su comentario) y se descontaron a mano.
  676 filas de diferencia en total; clasificadas en §4 y §5.
- **Huellas y aplicación:** clon de la foto real con `clonar-desde-foto.sh`
  (contenedor `clon-spinus-dv-prod`, 127.0.0.1:54361; ya borrado). El clon
  conserva los `\r` (32 funciones con `\r` en `prosrc`, las mismas 32). Los md5
  se calcularon con `md5(prosrc)` sobre `pg_proc` del clon, y coinciden con el
  `md5_cuerpo` de `05-catalogo.jsonl` (que es `md5(coalesce(prosrc,''))`).
  Las 8 migraciones se aplicaron con `psql -U postgres -v ON_ERROR_STOP=1`
  (postgres sin superusuario, como en producción).

## 2. `20260919230000_auth_02_reasentar_grants_rate_limit` — cuadra

| Lo que deja la migración | En la foto de producción |
|---|---|
| Está en el historial | `04-migraciones.tsv`: `20260919230000 auth_02_reasentar_grants_rate_limit` |
| Firmas `rate_limit_intento(text,text,integer,integer)` y `rate_limit_reset(text)`, las dos únicas con esos nombres en `public` | sí, exactamente esas dos |
| SECURITY DEFINER, dueño `postgres` | sí (las dos), `search_path=public, pg_temp` |
| `proacl` = `{postgres=X/postgres,service_role=X/postgres}` | sí, en el catálogo y en `pg_proc` del clon |
| `anon` y `authenticated` sin EXECUTE; PUBLIC sin EXECUTE | `has_function_privilege`: anon f, authenticated f, service_role t (las dos) |
| `NOTIFY pgrst` | efímero; no deja estructura (no comprobable) |

Matiz honesto: en producción la migración es un no-op, así que la estructura
confirma el **estado**, no que se ejecutara; que se registró lo dice el
historial. Corregidos (sólo texto):
`supabase/migrations/20260919230000_auth_02_reasentar_grants_rate_limit.sql`
(la línea «ESTADO · PRODUCCIÓN», ni una línea de SQL), `mejora_agendaV2.md`
(dos menciones), `supabase/AUDITORIA-CONJUNTO-AGENDA-V2.md` (L5),
`supabase/produccion/conteos/LEEME.md` (G.09) y la etiqueta de G.09 en
`supabase/produccion/conteos/conteos.sql`. Se deja como está la entrada del
diario de `mejora_agendaV2.md` del 2026-11-18 («la cabecera PENDIENTE de
auth_02»): es historia de ese día.

## 3. Huellas exigidas sobre objetos que ya existen (o no) en producción

«Prod» = `md5(prosrc)` en `pg_proc` del clon de la foto. «Prod LF» =
`md5(replace(prosrc, E'\r\n', E'\n'))`.

| Migración (dónde) | Objeto | Huella exigida | Prod | Prod LF | Veredicto |
|---|---|---|---|---|---|
| 20261125 pre-vuelo y rejilla 4 | `prevent_audit_modification()` | md5 `f1fe023a49dae586103b5e80b52841ea` | `7f0318cb142b6710cfec33ec3d8249eb` | `f1fe023a…` | **sólo fines de línea → aborta** |
| 20261126 pre-vuelo (replay) y rejilla 4 | `prohibir_truncate()` | md5 `e1b07ec4…` | no existe en prod | — | la crea la migración; pasa (comprobado) |
| F5a pre-vuelo | `clinica_no_suspendida()` | md5 `a2dcfa8f2cfda91bc9c7a7ff7b642e1e` | `bff6c20339c0046954e2591bbb732613` | `a2dcfa8f…` | **sólo fines de línea → aborta** (comprobado) |
| F5a pre-vuelo | `clinica_tiene_acceso()` | md5 `2efd7734772dd4c7bea262e43a3779b5` | `038f41ee17b76273028c1a7070c07e12` | `2efd7734…` | **sólo fines de línea → abortaría** (deducido: va después de la anterior) |
| F5a pre-vuelo y rejilla 5 | `agenda_bloqueo_preparar()` | md5 `f1f887ec…` | no existe | — | la crea F5a; pasa (comprobado) |
| F2 rejilla 8 (informativa) | las dos puertas | `a2dcfa8f… / 2efd7734…` | `bff6c203… / 038f41ee…` | coinciden | sale `REVISAR`, no aborta (comprobado) |
| F2 pre-vuelo | las dos puertas | `strpos(prosrc,'public.get_clinica_id()') > 0`, SQL, DEFINER, boolean | cumple | — | pasa (comprobado) |
| F2 `gcal_sync_clinica_habilitada` (en uso, no pre-vuelo) | las dos puertas | `btrim(…, E' \t\r\n;')`, `^select\s` | cumple | — | evalúa bien con `\r\n`: clínica ficticia normal → `t`, suspendida → `f`, inexistente → `f`, sin P0001 (comprobado en una transacción deshecha) |
| F3 post-vuelo | `proteger_reserva_enlaces()` | md5 `acd4128b…` | no existe antes; tras F3, `acd4128b…` | — | pasa (comprobado) |
| F3 post-vuelo | `appointments_reserva_check` | md5 de `pg_get_constraintdef` `12f5eb0a…` | no existe antes | — | la crea F3; pasa (comprobado) |
| F4 pre-vuelo | `clinica_no_suspendida()` | `md5(regexp_replace(prosrc,'\s+',' ','g'))` = `588de29d…` | `588de29d551f6d474eb24346748e1148` | — | **coincide** (`\s` incluye `\r`) |
| F1 pre-vuelos sobre `log_cita_change()` | — | regex sobre `prosrc` | no existe en prod (la crea F1) | — | pasa (comprobado) |
| F5b pre-vuelos | `appointments_status_check`, defaults | texto deparseado | existen | — | pasan (comprobado) |

Las demás huellas de texto (policies, WHEN, `pg_get_triggerdef`) de las 8
pasaron todas en el clon: ninguna otra aborta.

## 4. Deriva en los esquemas de la app (`public`, `private`, `respaldos`)

| Clase | Objeto(s) | Producción | Repo (replay) | ¿Afecta al conjunto? |
|---|---|---|---|---|
| Cuerpo de función | 32: `arco_set_fecha_limite`, `clinica_dentro_de_limite`, `clinica_no_suspendida`, `clinica_tiene_acceso`, `clinicas_latch_premium`, `crear_paciente_con_medico`, `enforce_cap_10_consultorios_activos`, `enforce_consultorio_default_existencia`, `enforce_consultorio_default_insert`, `enforce_limite_documentos_paciente`, `get_clinica_id`, `get_my_role`, `get_suscripcion_estado`, `listar_pacientes_expediente`, `log_tabla_change`, `marcar_consultorio_default`, `paciente_pertenece_a_mi_clinica`, `prevent_audit_modification`, `proteger_columnas_sensibles_profiles`, `sa_heatmap_horarios`, `sa_ranking_funciones`, `sa_top_medicos`, `sa_uso_ia`, `soy_admin_de_clinica`, `soy_medico_tratante`, `sync_antropometria_paciente`, `trg_mediciones_antropometria`, `update_casos_clinicos_updated_at`, `update_casos_recursos_updated_at`, `update_consultorios_updated_at`, `update_pdf_jobs_updated_at`, `update_plantillas_honorarios_updated_at` | `\r\n` | `\n`; idénticas tras normalizar (0 con diferencia real; 15 funciones más, idénticas sin normalizar) | **Sí**: 20261125 y F5a (§0, §3). El resto, no |
| Firma, lenguaje, DEFINER, `search_path`, volatilidad, dueño | las 47 funciones | iguales | iguales | no |
| Privilegio de función | EXECUTE de `anon` y `authenticated` en `alta_conexion_google`, `guardar_secretos_conexion`, `leer_conexion_google_con_secretos`, `enforce_limite_documentos_paciente`, `sync_antropometria_paciente`, `trg_mediciones_antropometria`, `generar_folio` (y de `service_role` en `generar_folio`) | NO los tienen (sólo `postgres` y `service_role`; `generar_folio` sólo `postgres`) | los tienen | no (ninguna de las 8 los usa ni los comprueba). Es la misma clase de defecto que auth_02: el replay reaplica los default privileges. Producción es la estricta |
| Privilegio de tabla | `anon` en `clinica_conexiones_google`, `firmas_documento`, `folios_contador`, `plantillas_documento`; `authenticated` en `folios_contador` | sin privilegios | todos salvo TRUNCATE | no (F2 sólo exige `service_role` sobre `clinica_conexiones_google`, que lo tiene). Misma causa |
| TRUNCATE de tablas y default privileges (80 + 3 filas) | casi todas las de `public` | con TRUNCATE para `anon`, `authenticated`, `service_role` | sin él | no es deriva: es lo que quitan 20261125/20261126 (la referencia local ya las lleva) |
| Disparadores `*_sin_truncate` (11) y `prevent_audit_truncate`; `prohibir_truncate()` | — | no existen | existen | no es deriva: los crean 20261125/20261126 |
| CHECK | `consultas_nota_origen_check`, `solicitudes_arco_estado_check`, `solicitudes_arco_tipo_check` | `= ANY ((ARRAY[…])::text[])` | `= ANY (ARRAY[(…)::text, …])` | no: mismo significado, distinto deparseo; ninguna de las 8 los lee |
| Tablas, columnas, defaults, identidad, índices, RLS activado/forzado, policies, disparadores de la app, comentarios, secuencias | todas | iguales | iguales | no |
| Índices inválidos | — | 0 en toda la foto | — | no (F5b exige 0 en `appointments`) |
| Esquemas `private` (`google_conexiones_secretos`) y `respaldos` (`appointments_gcal_20260815`) | — | existen, dueño `postgres`, sólo `postgres` con USAGE/CREATE | iguales | no (F1 crea su respaldo ahí y pasa) |
| Dueño | 31 relaciones y 47 funciones de `public` | `postgres` | `postgres` | no (el pre-vuelo de 20261125 exige ser dueño de `audit_log`: pasa como `postgres`) |
| Realtime | `supabase_realtime` | `public.appointments` sola, sin lista de columnas | igual | no |
| Storage: policies de `storage.objects` (13), disparador `on_auth_user_created` | — | iguales | iguales | no |

## 5. Plataforma y clúster (no son del repo)

| Objeto | Producción | Referencia local | ¿Afecta? |
|---|---|---|---|
| Extensiones | `plpgsql 1.0`, `pg_stat_statements 1.11`, `uuid-ossp 1.1`, `pgcrypto 1.3`, `supabase_vault 0.3.1`, `pg_trgm 1.6` y `unaccent 1.1` (en `public`), `btree_gist 1.7`, **`pg_cron 1.6.4`** | las mismas versiones, sin `pg_cron` | no: ninguna de las 8 usa cron; los recordatorios van por `/api/cron/*`. La foto no dice si hay trabajos programados (no trae datos) |
| Roles | `postgres`: sin superusuario, CREATEROLE, CREATEDB, BYPASSRLS, `search_path` `"\$user", public, extensions`; `supabase_admin` superusuario; `service_role` BYPASSRLS; existe `cli_login_postgres` (LOGIN, miembro de `postgres`, el de la CLI) | sin `cli_login_postgres`; con `supabase_functions_admin` (y `postgres` miembro de él) | no: el clon con estos atributos aplicó las 8 |
| Ajustes | `authenticator` `session_preload_libraries=safeupdate`; base `postgres` con `app.settings.jwt_exp` (sin `jwt_secret`) | `supautils, safeupdate`; con `jwt_secret` | no |
| Publicaciones | además `supabase_realtime_messages_publication` (de Realtime) | no | no |
| Esquemas `auth`, `storage`, `realtime`, `extensions`, `graphql`, `pgbouncer`, `cron`; `_realtime` y `supabase_functions` sólo en local | ~560 filas de diferencia: otras versiones de GoTrue, Storage y Realtime (tablas `auth.scim_*`, ciclo de vida de buckets, particiones diarias de `realtime.messages`…) | — | no: de esos esquemas las 8 sólo llaman a `auth.uid()`, que existe |
| Buckets (`06-buckets.tsv`) | 6: `casos-clinicos`, `clinica-logos` (público), `documentos-pdf`, `firmas-medicos`, `identificaciones`, `labs-documentos` | 0 en la foto local | no: las 8 no tocan Storage |

## 6. Para quien aplica

- La única parada esperable con los archivos de hoy es la de §0: 20261125 se
  para en su pre-vuelo, sin dejar nada. Si se corrige esa sola, se para F5a.
  Ninguna otra de las 8 se para por la foto.
- El historial es el que el plan supone: 5 filas, ninguna de las 8.
- `postgres` es dueño de todo lo de `public` y no es superusuario: es el rol con
  el que se ensayó en el clon.
- `PLAN-DE-APLICACION.md` (Paso 4, tabla de rejillas, fila de F2) da por
  esperado el md5 del repo en la fila 8 de F2; en producción saldrá el de
  `\r\n` (`bff6c203… / 038f41ee…`) aunque la lógica sea la misma. Su §10,
  punto 3, preveía exactamente este caso («si producción difiere, abortan
  limpio: se ve en el ensayo sobre el clon»): es lo que ha pasado.

## 7. `clonar-desde-foto.sh` y `esperadas-clon.tsv` con la foto real

`clonar-desde-foto.sh` funciona con la foto real sin cambios: 0 errores de
restauración, historial cargado (5 filas). Con la lista vieja salían 5
diferencias inesperadas; se añadieron a `scripts/produccion/esperadas-clon.tsv`,
cada una con su razón: el `session_preload_libraries` de `authenticator` y el
`search_path` de `supabase_admin` (vienen de la imagen local, que ya trae esos
roles) y los tres CHECK de §4 (deparseo). Con la lista nueva: 14 diferencias,
14 esperadas, 0 inesperadas, salida 0. Las líneas de `tipos_cita` y de
«rol * en (todas)» no aparecen con la foto real, pero se quedan para las fotos
locales (anotado en la cabecera del archivo). Detalle: `CREATE DATABASE …
TEMPLATE postgres` no sirve para guardar una copia del clon (el lanzador de
`pg_cron` mantiene sesiones abiertas); no afecta al script.

## 8. Lo que no se comprobó

- Que la causa de los `\r\n` sea la captura del 2026-09-12 hecha desde Windows o
  una normalización del editor/git: deducido (el volcado de producción tiene 591
  líneas con `\r`; el del repo, 0; no hay `.gitattributes`).
- El comportamiento de la app (no sólo de las migraciones) contra producción: el
  clon es sólo Postgres, sin GoTrue/Storage/PostgREST.
- Si hay trabajos de `pg_cron` en producción.
- No se comparó el clon «producción + 8» con la base local completa.
