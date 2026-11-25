# Inventario de las migraciones de la agenda v2 (bloque 4.1)

> Fase «dejar la agenda v2 lista para producción», agente I. Escrito el
> 2026-11-22 sobre `feature/agenda-v2-produccion` (`384f59c8`). Documento de
> trabajo para la fusión; no cambia ninguna migración.

## 1. Alcance, fuentes y cómo leerlo

- **Qué entra:** las migraciones de la agenda (`20261111120000` a
  `20261124160000` y `20261125180000`) y, aparte, la #49
  (`20261125170000_audit_log_sin_truncate`), que no es de la agenda. **Son 44
  de la agenda, no 43** (comprobado con `ls`): 43 de a18 a l5 (las que cuenta
  `CLAUDE.md`) más la de la integración M, `20261125180000`. Con la #49 son 45,
  y con las 5 de `main`, las 50 de `supabase/migrations/`. Los números `#` son
  los de `mejora_agendaV2.md` §7.1 (las cinco de `main` son #1–#5; estas, #6 a
  #50).
- **Fuentes, por orden de autoridad:**
  1. el SQL de los archivos, recorrido con un analizador propio que separa
     sentencias respetando comentarios, literales y cuerpos `$…$`, y que mira
     también el DDL que va dentro de bloques `DO` (las FK y CHECK que se
     añaden condicionalmente);
  2. el catálogo de la base local (`supabase_db_app_ortointegra`, con las 50
     migraciones en `schema_migrations`, sólo SELECT): `pg_proc` (md5 de
     `prosrc`, DEFINER/INVOKER, lenguaje, ACL), `pg_trigger`, `pg_constraint`,
     `pg_policies`, `pg_publication_tables`, `pg_default_acl`;
  3. las cabeceras de los archivos, §7.1 de `mejora_agendaV2.md` y
     `supabase/AUDITORIA-CONJUNTO-AGENDA-V2.md`, sólo para el porqué.
- **Llamadores:** se buscó cada función de la agenda en `src/`, `scripts/`,
  `e2e/` y `supabase/pruebas-sql/`, y dentro de los cuerpos de las demás
  funciones (`public.<f>(`) y como función de disparador.
- **Marcas:** «comprobado» = visto en el SQL o en el catálogo; «deducido» =
  razonamiento sobre lo comprobado, sin ejecutar nada.

**Comprobado en el catálogo:** el cuerpo final de cada función reescrita
coincide con el md5 que su última migración declara como «el suyo»
(`reservar_por_enlace` be25c167, `reserva_ocupacion` f1701599,
`reserva_contexto` e8be3201, `log_cita_change` 80c3556c, `proteger_reserva_enlaces`
acd4128b, `cita_correo_tomar` 5d0ce8db, `agenda_restablecer_configuracion`
1c390644, `cita_proteger_atendida` cfc4fcd7, `reserva_codigo_verificar`
c3deded3, `reserva_codigo_emitir` d24c01e9, `reagendar_por_enlace` 54b257ed,
`cita_reagendar_oferta` dbcd8da8, `gcal_aplicar_evento` 5ac551e4,
`gcal_citas_por_evento` 66feb69a…). La base local es, por tanto, una
referencia fiel de la «versión final» que debe reproducir el conjunto
fundido.

**Comprobado:** ninguna migración de la agenda crea, reemplaza ni cambia
permisos de una FUNCIÓN de `main` (los 65 nombres de función de la agenda y
los 47 de `main` no se cruzan), ni crea tipos, secuencias, esquemas,
extensiones ni entradas de publicación de Realtime (`appointments` está en
`supabase_realtime` desde el volcado de `main`, línea 3275; la agenda no
añade ninguna tabla).


## 2. Cifras

Sobre las 45 migraciones que no son de `main` (44 de la agenda + la #49):

| Medida | Número | Cuáles |
|---|---|---|
| Crean al menos un objeto nuevo | 37 | todas salvo #16 d4_gcal_por_ligar, #25 seg1_candado_correo, #27 g2_tipos_cita_update, #29 g3_correo_confirmacion, #33 i2_unico_sin_correo, #36 i4_atendida_no_se_mueve, #41 j2_unico_carrera_client_id, #47 l2_eliminar_cancelada |
| Sólo reescriben (no crean nada) | 8 | #16, #25, #27, #29, #33, #36, #41, #47 |
| Reescriben algo de una anterior (objeto o COMMENT) | 22 | #12, #13, #16, #17, #18, #24, #25, #26, #27, #28, #29, #33, #36, #37, #40, #41, #42, #43, #44, #45, #47, #48 |
| Dejan algo SIN EFECTO en el conjunto | 23 | #7, #9, #10, #12, #13, #14, #15, #18, #19, #24, #25, #26, #30, #31, #32, #33, #35, #38, #39, #40, #41, #42, #43 |
| Tocan objetos de `main` (columna, restricción, índice, disparador o datos en tabla de `main`) | 18 | #6, #7, #9, #10, #13, #14, #22, #23, #28, #32, #34, #35, #37, #38, #39, #45, #46, #49 |

Objetos distintos que tocan esas 45 migraciones (comprobado, analizador +
catálogo): **512** filas del mapa — 16 tablas, 28 columnas añadidas, 124
restricciones con nombre, 30 índices, 16 activaciones de RLS, 24 policies, 66
funciones (65 nombres; `reserva_enlace_emitir` tiene dos firmas), 36
disparadores, 83 juegos de GRANT/REVOKE, 86 COMMENT y 3 escrituras de datos.

**Funciones reescritas varias veces (comprobado):**

| Función | Cuerpos, en orden | Final (md5 en catálogo) |
|---|---|---|
| `reservar_por_enlace` | d3 → seg1 → i2 → j2 → j2b → k1 → k3 (7) | k3 · be25c167 |
| `reserva_ocupacion` | d3 → seg1 → k1 → k3 (4) | k3 · f1701599 |
| `reserva_contexto` | d3 → g2 → j2 → k3 (4) | k3 · e8be3201 |
| `log_cita_change` | b0 → c2 → e1 (3) | e1 · 80c3556c |
| `gcal_citas_por_evento`, `gcal_aplicar_evento` | c2 → d4 | d4 · 66feb69a / 5ac551e4 |
| `proteger_reserva_enlaces` | d1 → seg-emisión | seg · acd4128b |
| `reserva_contacto_estado` | d2 → seg1 | seg1 · 52ca884f |
| `reserva_codigo_emitir` | d3 → k3 | k3 · d24c01e9 |
| `reserva_codigo_verificar` | d3 → k2 | k2 · c3deded3 |
| `cita_reagendar_oferta`, `reagendar_por_enlace` | e6 → k3 | k3 · dbcd8da8 / 54b257ed |
| `cita_correo_tomar` | e4 → g3 | g3 · 5d0ce8db |
| `agenda_restablecer_configuracion` | h2 → i4-horario | i4 · 1c390644 |
| `cita_proteger_atendida` | h5 → i4-atendida | i4 · cfc4fcd7 |
| `cita_proteger_cierre` | i4-cancelada → l2 | l2 · e550ee48 (sólo en catálogo; l2 no lo escribe) |
| `reserva_enlace_emitir(7)` | seg-emisión → j2 (idéntica) | dae88a95 |

Otros objetos reescritos: `tipos_cita_insert` (b6 → g2), `tipos_cita_update`
(b6 → g2-update), `tipos_cita_nombre_activo_unico` (b6 → g2),
`cita_correos_tipo_check` (e4 → g3), `avisos_clinica_tipo_check` (i5 → j4 →
l5), `appointments_cierre_check` (i4 → l2); columnas añadidas a tablas de otra
migración de la agenda: `agenda_ajustes` (+2: h2, i5), `tipos_cita` (+2: g2),
`reserva_enlaces` (+5: j2, k3).

**Qué queda SIN EFECTO en el conjunto** (detalle en §4):
- **26 cuerpos de función superados** (las versiones intermedias de la tabla
  de arriba).
- **3 funciones enteras sin uso real:**
  - `reserva_enlace_regenerar_fijo` (sin llamadores; inservible desde
    seg-emisión);
  - `cita_correos_pendientes` (sin llamadores desde h2);
  - `reserva_enlace_emitir` de 7 argumentos (sólo la caída de compatibilidad
    del código, que en un despliegue único nunca corre).
- **1 policy muerta,** `reserva_enlaces_insert`.
- **7 definiciones intermedias de policy, índice o CHECK** (las dos
  policies de b6, el índice de b6, la CHECK de e4, las dos de `avisos_clinica`
  de i5 y j4, la de cierre de i4).
- **1 escritura de datos** que en producción insertaría 0 filas (el
  arrastre de i5).
- **Todas las ramas de re-ejecución y las cadenas de md5 de los pre-vuelos,**
  que la fusión vuelve innecesarias.


## 3. Migración por migración

Leyenda: «crea» = objeto que aparece por primera vez en esa migración; «reescribe» = objeto que ya tocó una anterior (CREATE OR REPLACE, DROP+CREATE, DROP+ADD, ADD COLUMN sobre tabla de otra, policy recreada); «COMMENT» = comentario rehecho sobre un objeto de otra; «GRANT/REVOKE» = número de objetos cuyos privilegios fija (en las que recrean funciones, vuelven a fijar los mismos). Las listas salen del SQL de los archivos (analizador propio: sentencias de nivel superior y DDL dentro de bloques DO); los md5 finales se contrastaron con `md5(prosrc)` del catálogo local.

### #6 · `20261111120000_agenda_a18_indices_rango`

- **Crea (2):** índice `idx_appointments_clinica_inicio ON appointments`; índice `idx_appointments_clinica_medico_inicio ON appointments`
- **GRANT/REVOKE:** 0 objeto(s).
- **Sin efecto en el conjunto:** —
- **Toca `main`:** índice `idx_appointments_clinica_inicio ON appointments`; índice `idx_appointments_clinica_medico_inicio ON appointments`
- **Pre-vuelo / huellas:** Sin md5. Definición de índices homónimos si ya existen.

### #7 · `20261112120000_agenda_b0_auditoria_citas`

- **Crea (3):** función `log_cita_change()`; disparador `audit_appointments ON appointments`; disparador `audit_appointments_update ON appointments`
- **GRANT/REVOKE:** 1 objeto(s).
- **Sin efecto en el conjunto:** El cuerpo de `log_cita_change()` (lo sustituyen c2 y e1). Los dos disparadores siguen vivos tal cual.
- **Toca `main`:** disparador `audit_appointments ON appointments`; disparador `audit_appointments_update ON appointments`
- **Pre-vuelo / huellas:** Sin md5. Aborta si `log_tabla_change()` ya audita appointments.

### #8 · `20261112130000_agenda_b1_ajustes_interruptor`

- **Crea (16):** tabla `agenda_ajustes`; restricción `agenda_ajustes_pkey ON agenda_ajustes`; restricción `agenda_ajustes_clinica_key ON agenda_ajustes`; restricción `agenda_ajustes_clinica_id_fkey ON agenda_ajustes`; restricción `agenda_ajustes_recordatorio_rango ON agenda_ajustes`; restricción `agenda_ajustes_anticipacion_rango ON agenda_ajustes`; restricción `agenda_ajustes_horizonte_rango ON agenda_ajustes`; restricción `agenda_ajustes_vigencia_rango ON agenda_ajustes`; restricción `agenda_ajustes_candado_rango ON agenda_ajustes`; RLS `agenda_ajustes`; policy `agenda_ajustes_select ON agenda_ajustes`; policy `agenda_ajustes_insert ON agenda_ajustes`; policy `agenda_ajustes_update ON agenda_ajustes`; función `proteger_agenda_ajustes()`; disparador `trg_agenda_ajustes_proteger ON agenda_ajustes`; disparador `audit_agenda_ajustes ON agenda_ajustes`
- **GRANT/REVOKE:** 2 objeto(s).
- **Sin efecto en el conjunto:** — (el pre-vuelo «13 columnas exactas» ya no se cumple tras h2 e i5: rama que en la fusión desaparece).
- **Pre-vuelo / huellas:** Sin md5. Si la tabla existe: exactamente 13 columnas (rompe re-ejecución tras h2 e i5). Exige DEFINER en `get_clinica_id()`/`soy_admin_de_clinica()`.

### #9 · `20261112140000_agenda_b5_horario_propio`

- **Crea (1):** columna `consultorios.horario_propio`
- **GRANT/REVOKE:** 0 objeto(s).
- **Sin efecto en el conjunto:** El COMMENT de `consultorios.horario_propio` (lo reescribe g4).
- **Toca `main`:** columna `consultorios.horario_propio`
- **Pre-vuelo / huellas:** Sin md5 (forma de la columna si existe).

### #10 · `20261112150000_agenda_b6_tipos_cita`

- **Crea (24):** tabla `tipos_cita`; restricción `tipos_cita_pkey ON tipos_cita`; restricción `tipos_cita_id_clinica_key ON tipos_cita`; restricción `tipos_cita_clinica_id_fkey ON tipos_cita`; restricción `tipos_cita_medico_id_fkey ON tipos_cita`; restricción `tipos_cita_nombre_check ON tipos_cita`; restricción `tipos_cita_duracion_check ON tipos_cita`; restricción `tipos_cita_color_check ON tipos_cita`; índice `tipos_cita_nombre_activo_unico ON tipos_cita`; índice `tipos_cita_medico ON tipos_cita`; RLS `tipos_cita`; policy `tipos_cita_select ON tipos_cita`; policy `tipos_cita_insert ON tipos_cita`; policy `tipos_cita_update ON tipos_cita`; función `validar_tipo_cita_medico()`; función `update_tipos_cita_updated_at()`; disparador `trg_tipos_cita_medico ON tipos_cita`; disparador `trg_tipos_cita_updated_at ON tipos_cita`; disparador `audit_tipos_cita ON tipos_cita`; columna `appointments.tipo_cita_id`; columna `appointments.tipo_cita_nombre`; restricción `appointments_tipo_cita_fkey ON appointments`; restricción `appointments_tipo_cita_snapshot_check ON appointments`; índice `idx_appointments_tipo_cita ON appointments`
- **GRANT/REVOKE:** 3 objeto(s).
- **Sin efecto en el conjunto:** Las policies `tipos_cita_insert` y `tipos_cita_update` (las rehacen g2 y g2-update) y el índice `tipos_cita_nombre_activo_unico` (lo rehace g2).
- **Toca `main`:** columna `appointments.tipo_cita_id`; columna `appointments.tipo_cita_nombre`; restricción `appointments_tipo_cita_fkey ON appointments`; restricción `appointments_tipo_cita_snapshot_check ON appointments`; índice `idx_appointments_tipo_cita ON appointments`
- **Pre-vuelo / huellas:** Sin md5. Exige DEFINER en helpers de main.

### #11 · `20261113120000_agenda_c1_gcal_sync_estado`

- **Crea (16):** tabla `gcal_sync_estado`; restricción `gcal_sync_estado_pkey ON gcal_sync_estado`; restricción `gcal_sync_estado_clinica_key ON gcal_sync_estado`; restricción `gcal_sync_estado_clinica_id_fkey ON gcal_sync_estado`; restricción `gcal_sync_estado_fase_check ON gcal_sync_estado`; restricción `gcal_sync_estado_incremental_con_token ON gcal_sync_estado`; restricción `gcal_sync_estado_candado_par ON gcal_sync_estado`; restricción `gcal_sync_estado_error_corto ON gcal_sync_estado`; restricción `gcal_sync_estado_contadores ON gcal_sync_estado`; RLS `gcal_sync_estado`; función `gcal_sync_tomar(uuid, uuid, text, integer, integer)`; función `gcal_sync_avanzar(uuid, uuid, text, text, timestamptz, integer)`; función `gcal_sync_reiniciar(uuid, uuid)`; función `gcal_sync_soltar(uuid, uuid, text)`; función `gcal_sync_clinicas_pendientes(integer)`; función `gcal_sync_clinica_habilitada(uuid)`
- **GRANT/REVOKE:** 7 objeto(s).
- **Sin efecto en el conjunto:** —
- **Pre-vuelo / huellas:** Sin md5: FORMA de `clinica_no_suspendida()`/`clinica_tiene_acceso()` (LANGUAGE sql, un SELECT con `public.get_clinica_id()`), y post-vuelo que ejecuta la puerta.

### #12 · `20261113130000_agenda_c2_gcal_aplicar`

- **Crea (3):** función `gcal_citas_por_evento(uuid, text[], uuid[])`; función `gcal_aplicar_evento(uuid, uuid, timestamptz, text, text, timestamptz, text, boolean, timestamptz, timestamptz, boolean, text, boolean, text, boolean)`; función `gcal_importar_evento(uuid, text, text, text, timestamptz, text, timestamptz, timestamptz, boolean, text, text, uuid)`
- **Reescribe:** función `log_cita_change()` (antes: b0_auditoria_citas; aquí: CREATE_OR_REPLACE)
- **COMMENT sobre objetos de otra:** `log_cita_change() (de b0_auditoria_citas)`
- **GRANT/REVOKE:** 4 objeto(s).
- **Sin efecto en el conjunto:** Los cuerpos de `log_cita_change()` (→ e1), `gcal_citas_por_evento` y `gcal_aplicar_evento` (→ d4). `gcal_importar_evento` sigue siendo la de c2.
- **Pre-vuelo / huellas:** Sin md5: texto deparseado del WHEN de `audit_appointments_update` (de b0).

### #13 · `20261114120000_agenda_d1_enlaces_reserva`

- **Crea (52):** tabla `reserva_avisos`; restricción `reserva_avisos_pkey ON reserva_avisos`; restricción `reserva_avisos_id_key ON reserva_avisos`; restricción `reserva_avisos_version_check ON reserva_avisos`; restricción `reserva_avisos_sha_check ON reserva_avisos`; restricción `reserva_avisos_aprobado_check ON reserva_avisos`; RLS `reserva_avisos`; policy `reserva_avisos_select ON reserva_avisos`; tabla `reserva_enlaces`; restricción `reserva_enlaces_pkey ON reserva_enlaces`; restricción `reserva_enlaces_id_clinica_key ON reserva_enlaces`; restricción `reserva_enlaces_codigo_key ON reserva_enlaces`; restricción `reserva_enlaces_clinica_id_fkey ON reserva_enlaces`; restricción `reserva_enlaces_medico_id_fkey ON reserva_enlaces`; restricción `reserva_enlaces_created_by_fkey ON reserva_enlaces`; restricción `reserva_enlaces_revocado_por_fkey ON reserva_enlaces`; restricción `reserva_enlaces_clase_check ON reserva_enlaces`; restricción `reserva_enlaces_codigo_check ON reserva_enlaces`; restricción `reserva_enlaces_etiqueta_check ON reserva_enlaces`; restricción `reserva_enlaces_vigencia_check ON reserva_enlaces`; restricción `reserva_enlaces_uso_check ON reserva_enlaces`; restricción `reserva_enlaces_revocado_check ON reserva_enlaces`; índice `reserva_enlaces_fijo_vigente ON reserva_enlaces`; índice `reserva_enlaces_por_medico ON reserva_enlaces`; RLS `reserva_enlaces`; policy `reserva_enlaces_select ON reserva_enlaces`; policy `reserva_enlaces_insert ON reserva_enlaces`; policy `reserva_enlaces_update ON reserva_enlaces`; función `proteger_reserva_enlaces()`; función `reserva_enlace_regenerar_fijo(uuid, uuid, text)`; disparador `trg_reserva_enlaces_proteger ON reserva_enlaces`; disparador `audit_reserva_enlaces ON reserva_enlaces`; disparador `audit_reserva_avisos ON reserva_avisos`; columna `appointments.reserva_enlace_id`; columna `appointments.reserva_canal`; columna `appointments.reserva_nombre`; columna `appointments.reserva_telefono`; columna `appointments.reserva_correo`; columna `appointments.reserva_tel_hmac`; columna `appointments.reserva_correo_hmac`; columna `appointments.reserva_aviso_version`; columna `appointments.reserva_aceptado_en`; columna `appointments.reserva_historial_previo`; columna `appointments.reserva_reagendados`; restricción `appointments_reserva_enlace_fkey ON appointments`; restricción `appointments_reserva_aviso_fkey ON appointments`; restricción `appointments_reserva_check ON appointments`; restricción `appointments_reserva_reagendados_check ON appointments`; restricción `reserva_enlaces_usado_cita_fkey ON reserva_enlaces`; índice `idx_appointments_reserva_enlace ON appointments`; índice `idx_appointments_reserva_tel ON appointments`; índice `idx_appointments_reserva_correo ON appointments`
- **COMMENT sobre objetos de otra:** `appointments.tipo_cita_id (de b6_tipos_cita)`
- **GRANT/REVOKE:** 4 objeto(s).
- **Sin efecto en el conjunto:** Cuerpo de `proteger_reserva_enlaces()` (→ seg-emisión). `reserva_enlace_regenerar_fijo` entera (sin llamadores; inservible desde seg-emisión). Policy `reserva_enlaces_insert` (desde seg-emisión el disparador rechaza todo INSERT que no sea service_role). COMMENTs de `appointments.reserva_nombre` (→ d4) y `reserva_reagendados` (→ e6); el de `appointments.tipo_cita_id` repite el de b6.
- **Toca `main`:** columna `appointments.reserva_enlace_id`; columna `appointments.reserva_canal`; columna `appointments.reserva_nombre`; columna `appointments.reserva_telefono`; columna `appointments.reserva_correo`; columna `appointments.reserva_tel_hmac`; columna `appointments.reserva_correo_hmac`; columna `appointments.reserva_aviso_version`; columna `appointments.reserva_aceptado_en`; columna `appointments.reserva_historial_previo`; columna `appointments.reserva_reagendados`; restricción `appointments_reserva_enlace_fkey ON appointments`; restricción `appointments_reserva_aviso_fkey ON appointments`; restricción `appointments_reserva_check ON appointments`; restricción `appointments_reserva_reagendados_check ON appointments`; índice `idx_appointments_reserva_enlace ON appointments`; índice `idx_appointments_reserva_tel ON appointments`; índice `idx_appointments_reserva_correo ON appointments`
- **Pre-vuelo / huellas:** Post-vuelo: md5 de la fórmula de `appointments_reserva_check` = 12f5eb0a (sin «public.»).

### #14 · `20261114130000_agenda_d2_candado_reserva`

- **Crea (33):** tabla `reserva_incidencias`; restricción `reserva_incidencias_pkey ON reserva_incidencias`; restricción `reserva_incidencias_clinica_fkey ON reserva_incidencias`; restricción `reserva_incidencias_medico_fkey ON reserva_incidencias`; restricción `reserva_incidencias_cita_fkey ON reserva_incidencias`; restricción `reserva_incidencias_tipo_check ON reserva_incidencias`; restricción `reserva_incidencias_hmac_check ON reserva_incidencias`; índice `reserva_incidencias_tel ON reserva_incidencias`; índice `reserva_incidencias_correo ON reserva_incidencias`; índice `reserva_incidencias_cita ON reserva_incidencias`; tabla `reserva_contactos`; restricción `reserva_contactos_pkey ON reserva_contactos`; restricción `reserva_contactos_clave_key ON reserva_contactos`; restricción `reserva_contactos_clinica_fkey ON reserva_contactos`; restricción `reserva_contactos_medico_fkey ON reserva_contactos`; restricción `reserva_contactos_bloqueado_por_fkey ON reserva_contactos`; restricción `reserva_contactos_perdonado_por_fkey ON reserva_contactos`; restricción `reserva_contactos_clase_check ON reserva_contactos`; restricción `reserva_contactos_hmac_check ON reserva_contactos`; RLS `reserva_incidencias`; RLS `reserva_contactos`; policy `reserva_incidencias_select ON reserva_incidencias`; policy `reserva_contactos_select ON reserva_contactos`; policy `reserva_contactos_insert ON reserva_contactos`; policy `reserva_contactos_update ON reserva_contactos`; función `reserva_registrar_incidencia()`; función `proteger_reserva_contactos()`; función `reserva_contacto_estado(uuid, uuid, text, text)`; función `reserva_contacto_marcar(uuid, text)`; función `reserva_contactos_bloqueados()`; disparador `trg_reserva_contactos_proteger ON reserva_contactos`; disparador `audit_reserva_contactos ON reserva_contactos`; disparador `trg_appointments_reserva_incidencia ON appointments`
- **GRANT/REVOKE:** 7 objeto(s).
- **Sin efecto en el conjunto:** Cuerpo de `reserva_contacto_estado` (→ seg1).
- **Toca `main`:** disparador `trg_appointments_reserva_incidencia ON appointments`
- **Pre-vuelo / huellas:** Sin md5.

### #15 · `20261114140000_agenda_d3_reservar`

- **Crea (14):** tabla `reserva_verificaciones`; restricción `reserva_verificaciones_pkey ON reserva_verificaciones`; restricción `reserva_verificaciones_ficha_key ON reserva_verificaciones`; restricción `reserva_verificaciones_enlace_fkey ON reserva_verificaciones`; restricción `reserva_verificaciones_intentos_check ON reserva_verificaciones`; restricción `reserva_verificaciones_hmac_check ON reserva_verificaciones`; restricción `reserva_verificaciones_estado_check ON reserva_verificaciones`; índice `reserva_verificaciones_busqueda ON reserva_verificaciones`; RLS `reserva_verificaciones`; función `reserva_contexto(text, text, text)`; función `reserva_ocupacion(uuid, uuid, timestamptz, timestamptz)`; función `reserva_codigo_emitir(uuid, uuid, text, text)`; función `reserva_codigo_verificar(uuid, uuid, text, text, text)`; función `reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)`
- **GRANT/REVOKE:** 6 objeto(s).
- **Sin efecto en el conjunto:** Los cinco cuerpos: `reserva_contexto` (→ g2 → j2 → k3), `reserva_ocupacion` (→ seg1 → k1 → k3), `reserva_codigo_emitir` (→ k3), `reserva_codigo_verificar` (→ k2), `reservar_por_enlace` (→ seg1 → i2 → j2 → j2b → k1 → k3).
- **Pre-vuelo / huellas:** Sin md5 (existencia de d1/d2/c1).

### #16 · `20261114150000_agenda_d4_gcal_por_ligar`

- **Crea:** nada.
- **Reescribe:** función `gcal_citas_por_evento(uuid, text[], uuid[])` (antes: c2_gcal_aplicar; aquí: CREATE_OR_REPLACE); función `gcal_aplicar_evento(uuid, uuid, timestamptz, text, text, timestamptz, text, boolean, timestamptz, timestamptz, boolean, text, boolean, text, boolean)` (antes: c2_gcal_aplicar; aquí: CREATE_OR_REPLACE)
- **COMMENT sobre objetos de otra:** `appointments.reserva_nombre (de d1_enlaces_reserva)`
- **GRANT/REVOKE:** 2 objeto(s).
- **Sin efecto en el conjunto:** — (sus dos cuerpos son los finales).
- **Pre-vuelo / huellas:** `gcal_aplicar_evento` = f5da38cc (c2) o 5ac551e4 (suya); `gcal_citas_por_evento` = a1a53c1d (c2) o 66feb69a (suya).

### #17 · `20261115120000_agenda_e1_confirmacion_enlace`

- **Crea (21):** tabla `cita_confirmaciones`; restricción `cita_confirmaciones_pkey ON cita_confirmaciones`; restricción `cita_confirmaciones_codigo_key ON cita_confirmaciones`; restricción `cita_confirmaciones_clinica_fkey ON cita_confirmaciones`; restricción `cita_confirmaciones_cita_fkey ON cita_confirmaciones`; restricción `cita_confirmaciones_creado_por_fkey ON cita_confirmaciones`; restricción `cita_confirmaciones_codigo_check ON cita_confirmaciones`; restricción `cita_confirmaciones_vinculo_check ON cita_confirmaciones`; restricción `cita_confirmaciones_hmac_check ON cita_confirmaciones`; restricción `cita_confirmaciones_respuesta_check ON cita_confirmaciones`; índice `cita_confirmaciones_vigente ON cita_confirmaciones`; índice `cita_confirmaciones_cita ON cita_confirmaciones`; índice `cita_confirmaciones_respuestas ON cita_confirmaciones`; RLS `cita_confirmaciones`; policy `cita_confirmaciones_select ON cita_confirmaciones`; disparador `audit_cita_confirmaciones ON cita_confirmaciones`; función `cita_confirmacion_coincide(uuid, text, uuid, text)`; función `cita_confirmacion_emitir(uuid, uuid, uuid, text, uuid)`; función `cita_confirmacion_revocar(uuid, uuid)`; función `cita_confirmacion_contexto(text)`; función `cita_confirmacion_responder(uuid, text, text)`
- **Reescribe:** función `log_cita_change()` (antes: b0_auditoria_citas, c2_gcal_aplicar; aquí: CREATE_OR_REPLACE)
- **COMMENT sobre objetos de otra:** `log_cita_change() (de b0_auditoria_citas)`
- **GRANT/REVOKE:** 7 objeto(s).
- **Sin efecto en el conjunto:** — (su `log_cita_change` es la final).
- **Pre-vuelo / huellas:** `log_cita_change` = e57358a1 (c2) o 80c3556c (suya); `clinica_no_suspendida()` md5 normalizado 588de29d (main); huella de FK 223dd96f; post: contexto 2fca66ff, responder 7961e24a. Más el WHEN exacto de b0.

### #18 · `20261115130000_agenda_e6_reagendar`

- **Crea (16):** tabla `cita_reagendos`; restricción `cita_reagendos_pkey ON cita_reagendos`; restricción `cita_reagendos_origen_key ON cita_reagendos`; restricción `cita_reagendos_nueva_key ON cita_reagendos`; restricción `cita_reagendos_clinica_fkey ON cita_reagendos`; restricción `cita_reagendos_origen_fkey ON cita_reagendos`; restricción `cita_reagendos_nueva_fkey ON cita_reagendos`; restricción `cita_reagendos_confirmacion_fkey ON cita_reagendos`; restricción `cita_reagendos_numero_check ON cita_reagendos`; restricción `cita_reagendos_distintas_check ON cita_reagendos`; índice `cita_reagendos_confirmacion ON cita_reagendos`; RLS `cita_reagendos`; policy `cita_reagendos_select ON cita_reagendos`; disparador `audit_cita_reagendos ON cita_reagendos`; función `cita_reagendar_oferta(uuid, text)`; función `reagendar_por_enlace(text, uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)`
- **COMMENT sobre objetos de otra:** `appointments.reserva_reagendados (de d1_enlaces_reserva)`
- **GRANT/REVOKE:** 3 objeto(s).
- **Sin efecto en el conjunto:** Cuerpos de `cita_reagendar_oferta` y `reagendar_por_enlace` (→ k3).
- **Pre-vuelo / huellas:** `log_cita_change` = 80c3556c (e1); `clinica_no_suspendida()` 588de29d; huella de FK 6d6680fe; post: oferta 4bcf4c7e, reagendar a05266ad. `reservar_por_enlace` sólo por firma, sin md5.

### #19 · `20261115140000_agenda_e4_correos_cita`

- **Crea (17):** tabla `cita_correos`; restricción `cita_correos_pkey ON cita_correos`; restricción `cita_correos_llave_key ON cita_correos`; restricción `cita_correos_clinica_fkey ON cita_correos`; restricción `cita_correos_cita_fkey ON cita_correos`; restricción `cita_correos_tipo_check ON cita_correos`; restricción `cita_correos_estado_check ON cita_correos`; restricción `cita_correos_intentos_check ON cita_correos`; restricción `cita_correos_motivo_check ON cita_correos`; restricción `cita_correos_coherencia_check ON cita_correos`; índice `cita_correos_clinica ON cita_correos`; RLS `cita_correos`; policy `cita_correos_select ON cita_correos`; disparador `audit_cita_correos ON cita_correos`; función `cita_correos_pendientes(integer)`; función `cita_correo_tomar(uuid, uuid, text, uuid)`; función `cita_correo_marcar(uuid, uuid, uuid, text, text)`
- **GRANT/REVOKE:** 4 objeto(s).
- **Sin efecto en el conjunto:** `cita_correos_pendientes(integer)` entera (sin llamadores desde h2). Cuerpo de `cita_correo_tomar` (→ g3). `cita_correos_tipo_check` (→ g3).
- **Pre-vuelo / huellas:** Huella de FK 93981fdf.

### #20 · `20261115160000_agenda_e9_rsvp_google`

- **Crea (1):** función `cita_rsvp_google(uuid, uuid, text, text, text[])`
- **GRANT/REVOKE:** 1 objeto(s).
- **Sin efecto en el conjunto:** —
- **Pre-vuelo / huellas:** Sin md5: `position('google_rsvp' in prosrc)` de `log_cita_change`.

### #21 · `20261116120000_agenda_d11_sync_antes_de_reservar`

- **Crea (10):** tabla `reserva_empalmes_google`; restricción `reserva_empalmes_google_pkey ON reserva_empalmes_google`; restricción `reserva_empalmes_google_par_key ON reserva_empalmes_google`; restricción `reserva_empalmes_google_clinica_id_fkey ON reserva_empalmes_google`; restricción `reserva_empalmes_google_distintas ON reserva_empalmes_google`; índice `reserva_empalmes_google_clinica_idx ON reserva_empalmes_google`; RLS `reserva_empalmes_google`; policy `reserva_empalmes_google_select ON reserva_empalmes_google`; función `gcal_sync_frescura(uuid)`; función `reserva_empalmes_registrar(uuid, uuid[])`
- **GRANT/REVOKE:** 3 objeto(s).
- **Sin efecto en el conjunto:** —
- **Pre-vuelo / huellas:** Sin md5.

### #22 · `20261117120000_agenda_seg_borrado_cita`

- **Crea (2):** función `cita_proteger_borrado()`; disparador `trg_appointments_proteger_borrado ON appointments`
- **GRANT/REVOKE:** 1 objeto(s).
- **Sin efecto en el conjunto:** —
- **Toca `main`:** disparador `trg_appointments_proteger_borrado ON appointments`
- **Pre-vuelo / huellas:** Sin md5.

### #23 · `20261117121000_agenda_seg_columnas_reserva`

- **Crea (2):** función `cita_proteger_reserva()`; disparador `trg_appointments_proteger_reserva ON appointments`
- **GRANT/REVOKE:** 1 objeto(s).
- **Sin efecto en el conjunto:** —
- **Toca `main`:** disparador `trg_appointments_proteger_reserva ON appointments`
- **Pre-vuelo / huellas:** Sin md5: DEFAULT de las `reserva_*` (sólo `reserva_reagendados` con DEFAULT 0).

### #24 · `20261117122000_agenda_seg_emision_enlaces`

- **Crea (1):** función `reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text)`
- **Reescribe:** función `proteger_reserva_enlaces()` (antes: d1_enlaces_reserva; aquí: CREATE_OR_REPLACE)
- **GRANT/REVOKE:** 2 objeto(s).
- **Sin efecto en el conjunto:** `reserva_enlace_emitir` de 7 argumentos: en la fusión nace junto a la de 9 y la caída del código (PGRST202) nunca corre; queda por compatibilidad (AG-DT-137).
- **Pre-vuelo / huellas:** `proteger_reserva_enlaces` = 181cee85 (d1) o acd4128b (suya).

### #25 · `20261117130000_agenda_seg1_candado_correo`

- **Crea:** nada.
- **Reescribe:** función `reserva_contacto_estado(uuid, uuid, text, text)` (antes: d2_candado_reserva; aquí: CREATE_OR_REPLACE); función `reserva_ocupacion(uuid, uuid, timestamptz, timestamptz)` (antes: d3_reservar; aquí: CREATE_OR_REPLACE); función `reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)` (antes: d3_reservar; aquí: CREATE_OR_REPLACE)
- **COMMENT sobre objetos de otra:** `reserva_incidencias (de d2_candado_reserva)`; `reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) (de d3_reservar)`
- **GRANT/REVOKE:** 3 objeto(s).
- **Sin efecto en el conjunto:** Cuerpos de `reserva_ocupacion` (→ k1 → k3) y `reservar_por_enlace` (→ i2…). `reserva_contacto_estado` es la final.
- **Pre-vuelo / huellas:** `reserva_contacto_estado` d694184d (d2) / 52ca884f; `reserva_ocupacion` 648672c0 (d3) / 50a89d85; `reservar_por_enlace` 52ee7af1 (d3) / d3ddd46b.

### #26 · `20261119120000_agenda_g2_duracion_consulta`

- **Crea (9):** columna `tipos_cita.consultorio_id`; columna `tipos_cita.principal`; restricción `tipos_cita_consultorio_id_fkey ON tipos_cita`; restricción `tipos_cita_principal_check ON tipos_cita`; restricción `tipos_cita_consultorio_check ON tipos_cita`; índice `tipos_cita_principal_unico ON tipos_cita`; índice `tipos_cita_consultorio ON tipos_cita`; función `validar_tipo_cita_consultorio()`; disparador `trg_tipos_cita_consultorio ON tipos_cita`
- **Reescribe:** índice `tipos_cita_nombre_activo_unico ON tipos_cita` (antes: b6_tipos_cita; aquí: CREATE/DROP); policy `tipos_cita_insert ON tipos_cita` (antes: b6_tipos_cita; aquí: DROP/CREATE); función `reserva_contexto(text, text, text)` (antes: d3_reservar; aquí: CREATE_OR_REPLACE)
- **GRANT/REVOKE:** 2 objeto(s).
- **Sin efecto en el conjunto:** Cuerpo de `reserva_contexto` (→ j2 → k3). DROP+ADD de sus propios CHECK (idempotencia).
- **Pre-vuelo / huellas:** `reserva_contexto` = 3c2c9c91 (d3) o 8d81bc66 (suya). Texto exacto de las policies de b6 en `pg_get_expr`.

### #27 · `20261119121000_agenda_g2_tipos_cita_update`

- **Crea:** nada.
- **Reescribe:** policy `tipos_cita_update ON tipos_cita` (antes: b6_tipos_cita; aquí: DROP/CREATE)
- **GRANT/REVOKE:** 0 objeto(s).
- **Sin efecto en el conjunto:** —
- **Pre-vuelo / huellas:** Sin md5: texto de `tipos_cita_insert` (g2) y `tipos_cita_update` (b6); ninguna policy de DELETE/ALL.

### #28 · `20261119130000_agenda_g4_herencia_horario_consultorios`

- **Crea (4):** tabla `respaldos.consultorios_horario_20261119`; RLS `respaldos.consultorios_horario_20261119`; datos `respaldos.consultorios_horario_20261119`; datos `consultorios`
- **COMMENT sobre objetos de otra:** `consultorios.horario_propio (de b5_horario_propio)`
- **GRANT/REVOKE:** 1 objeto(s).
- **Sin efecto en el conjunto:** — (el backfill sigue haciendo falta en producción).
- **Toca `main`:** datos `consultorios`
- **Pre-vuelo / huellas:** Sin md5. Pre-vuelo 1.4 sobre datos (predeterminados activos).

### #29 · `20261119140000_agenda_g3_correo_confirmacion`

- **Crea:** nada.
- **Reescribe:** restricción `cita_correos_tipo_check ON cita_correos` (antes: e4_correos_cita; aquí: DROP/ADD); función `cita_correo_tomar(uuid, uuid, text, uuid)` (antes: e4_correos_cita; aquí: CREATE_OR_REPLACE)
- **COMMENT sobre objetos de otra:** `cita_correos (de e4_correos_cita)`
- **GRANT/REVOKE:** 1 objeto(s).
- **Sin efecto en el conjunto:** —
- **Pre-vuelo / huellas:** `cita_correo_tomar` = d7c18c8e (e4) o 5d0ce8db (suya).

### #30 · `20261120120000_agenda_h2_recordatorio_interruptor`

- **Crea (2):** columna `agenda_ajustes.recordatorio_encendido`; función `cita_recordatorios_pendientes(integer)`
- **GRANT/REVOKE:** 1 objeto(s).
- **Sin efecto en el conjunto:** Deja sin llamadores a `cita_correos_pendientes` (e4), que «no se toca ni se borra».
- **Pre-vuelo / huellas:** `cita_correos_pendientes` = a8b08c15 (e4); post: la suya be18fa77.

### #31 · `20261120121000_agenda_h2_restablecer_configuracion`

- **Crea (1):** función `agenda_restablecer_configuracion(uuid, uuid)`
- **GRANT/REVOKE:** 1 objeto(s).
- **Sin efecto en el conjunto:** Su cuerpo (→ i4-horario; además se editó tras su auditoría).
- **Pre-vuelo / huellas:** `proteger_reserva_enlaces` LIKE acd4128b% (seg-emisión); post: la suya 6c99e553.

### #32 · `20261120130000_agenda_h5_atendida_con_nota`

- **Crea (3):** función `cita_tiene_nota_ligada(uuid, uuid)`; función `cita_proteger_atendida()`; disparador `trg_appointments_proteger_atendida ON appointments`
- **GRANT/REVOKE:** 2 objeto(s).
- **Sin efecto en el conjunto:** Cuerpo de `cita_proteger_atendida()` (→ i4-atendida).
- **Toca `main`:** disparador `trg_appointments_proteger_atendida ON appointments`
- **Pre-vuelo / huellas:** Sin md5 (BYPASSRLS de quien aplica).

### #33 · `20261121120000_agenda_i2_unico_sin_correo`

- **Crea:** nada.
- **Reescribe:** función `reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)` (antes: d3_reservar, seg1_candado_correo; aquí: CREATE_OR_REPLACE)
- **COMMENT sobre objetos de otra:** `reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) (de d3_reservar)`
- **GRANT/REVOKE:** 1 objeto(s).
- **Sin efecto en el conjunto:** Cuerpo de `reservar_por_enlace` (→ j2).
- **Pre-vuelo / huellas:** `reservar_por_enlace` = d3ddd46b (seg1) o 600fc445 (suya).

### #34 · `20261121121000_agenda_i2_candado_eleccion`

- **Crea (3):** función `cita_proteger_eleccion()`; disparador `trg_appointments_proteger_eleccion ON appointments`; función `cita_reagendar_clinica(uuid, uuid, uuid, uuid, timestamptz, timestamptz, timestamptz)`
- **GRANT/REVOKE:** 2 objeto(s).
- **Sin efecto en el conjunto:** —
- **Toca `main`:** disparador `trg_appointments_proteger_eleccion ON appointments`
- **Pre-vuelo / huellas:** Sin md5: texto de la policy `appointments_update` sin «public.» (depende del search_path).

### #35 · `20261121130000_agenda_i3_por_asignar_google`

- **Crea (4):** columna `appointments.google_asignacion`; restricción `appointments_google_asignacion_check ON appointments`; función `cita_asignacion_google()`; disparador `trg_appointments_asignacion_google ON appointments`
- **GRANT/REVOKE:** 1 objeto(s).
- **Sin efecto en el conjunto:** NOT VALID + VALIDATE en la misma transacción (no gana nada).
- **Toca `main`:** columna `appointments.google_asignacion`; restricción `appointments_google_asignacion_check ON appointments`; disparador `trg_appointments_asignacion_google ON appointments`
- **Pre-vuelo / huellas:** Sin md5: regex sobre el prosrc de `gcal_importar_evento`.

### #36 · `20261121140000_agenda_i4_atendida_no_se_mueve`

- **Crea:** nada.
- **Reescribe:** función `cita_proteger_atendida()` (antes: h5_atendida_con_nota; aquí: CREATE_OR_REPLACE)
- **COMMENT sobre objetos de otra:** `cita_proteger_atendida() (de h5_atendida_con_nota)`
- **GRANT/REVOKE:** 1 objeto(s).
- **Sin efecto en el conjunto:** —
- **Pre-vuelo / huellas:** `cita_proteger_atendida` = 74dde456 (h5) o cfc4fcd7 (suya); post: `cita_tiene_nota_ligada` 39f40c71.

### #37 · `20261121141000_agenda_i4_horario_revisado`

- **Crea (1):** columna `consultorios.horario_revisado_en`
- **Reescribe:** función `agenda_restablecer_configuracion(uuid, uuid)` (antes: h2_restablecer_configuracion; aquí: CREATE_OR_REPLACE)
- **COMMENT sobre objetos de otra:** `agenda_restablecer_configuracion(uuid, uuid) (de h2_restablecer_configuracion)`
- **GRANT/REVOKE:** 1 objeto(s).
- **Sin efecto en el conjunto:** —
- **Toca `main`:** columna `consultorios.horario_revisado_en`
- **Pre-vuelo / huellas:** `agenda_restablecer_configuracion` = 6c99e553 (h2) o 1c390644 (suya).

### #38 · `20261121142000_agenda_i4_cancelada_cerrada`

- **Crea (7):** columna `appointments.cerrada_en`; columna `appointments.sustituida_por`; restricción `appointments_sustituida_por_fkey ON appointments`; restricción `appointments_cierre_check ON appointments`; índice `idx_appointments_sustituida_por ON appointments`; función `cita_proteger_cierre()`; disparador `trg_appointments_proteger_cierre ON appointments`
- **GRANT/REVOKE:** 1 objeto(s).
- **Sin efecto en el conjunto:** Cuerpo de `cita_proteger_cierre()`, `appointments_cierre_check` y el COMMENT de `cerrada_en` (→ l2).
- **Toca `main`:** columna `appointments.cerrada_en`; columna `appointments.sustituida_por`; restricción `appointments_sustituida_por_fkey ON appointments`; restricción `appointments_cierre_check ON appointments`; índice `idx_appointments_sustituida_por ON appointments`; disparador `trg_appointments_proteger_cierre ON appointments`
- **Pre-vuelo / huellas:** Sin md5.

### #39 · `20261121150000_agenda_i5_avisos_clinica`

- **Crea (24):** columna `agenda_ajustes.correo_reserva_clinica`; tabla `avisos_clinica`; restricción `avisos_clinica_pkey ON avisos_clinica`; restricción `avisos_clinica_clinica_id_fkey ON avisos_clinica`; restricción `avisos_clinica_tipo_check ON avisos_clinica`; restricción `avisos_clinica_revisado_check ON avisos_clinica`; índice `avisos_clinica_pendiente_key ON avisos_clinica`; índice `avisos_clinica_pendientes_idx ON avisos_clinica`; índice `avisos_clinica_clinica_idx ON avisos_clinica`; RLS `avisos_clinica`; policy `avisos_clinica_select ON avisos_clinica`; policy `avisos_clinica_update ON avisos_clinica`; función `aviso_clinica_revisar()`; función `aviso_clinica_de_cita()`; función `aviso_clinica_de_respuesta()`; función `aviso_clinica_de_reagendo()`; función `aviso_clinica_de_empalme()`; disparador `trg_avisos_clinica_revisar ON avisos_clinica`; disparador `audit_avisos_clinica ON avisos_clinica`; disparador `trg_appointments_aviso_clinica ON appointments`; disparador `trg_cita_confirmaciones_aviso_clinica ON cita_confirmaciones`; disparador `trg_cita_reagendos_aviso_clinica ON cita_reagendos`; disparador `trg_reserva_empalmes_aviso_clinica ON reserva_empalmes_google`; datos `avisos_clinica`
- **GRANT/REVOKE:** 6 objeto(s).
- **Sin efecto en el conjunto:** `avisos_clinica_tipo_check` de 5 tipos (→ j4 → l5). En la fusión, el INSERT de arrastre (0 filas: sus tablas de origen nacen vacías en el mismo conjunto).
- **Toca `main`:** disparador `trg_appointments_aviso_clinica ON appointments`
- **Pre-vuelo / huellas:** Re-ejecución: los cinco aviso_clinica_* con su md5 (32733e60, 148b5b16, 93989cb5, e62021c4, 498a7a6a). Exige `google_asignacion` (i3) antes.

### #40 · `20261122120000_agenda_j2_unico_tope_correo`

- **Crea (9):** columna `reserva_enlaces.correo`; columna `reserva_enlaces.correo_hmac`; columna `reserva_enlaces.intentos`; columna `reserva_enlaces.agotado_en`; restricción `reserva_enlaces_correo_check ON reserva_enlaces`; restricción `reserva_enlaces_intentos_check ON reserva_enlaces`; función `proteger_reserva_enlace_unico()`; disparador `trg_reserva_enlaces_unico ON reserva_enlaces`; función `reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text, text, text)`
- **Reescribe:** función `reserva_contexto(text, text, text)` (antes: d3_reservar, g2_duracion_consulta; aquí: CREATE_OR_REPLACE); función `reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)` (antes: d3_reservar, seg1_candado_correo, i2_unico_sin_correo; aquí: CREATE_OR_REPLACE); función `reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text)` (antes: seg_emision_enlaces; aquí: CREATE_OR_REPLACE)
- **COMMENT sobre objetos de otra:** `appointments.reserva_correo_hmac (de d1_enlaces_reserva)`; `reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) (de d3_reservar)`; `reserva_contexto(text, text, text) (de g2_duracion_consulta)`
- **GRANT/REVOKE:** 5 objeto(s).
- **Sin efecto en el conjunto:** Cuerpos de `reservar_por_enlace` (→ j2b) y `reserva_contexto` (→ k3). La de 7 de `reserva_enlace_emitir` se vuelve a pegar idéntica (md5 dae88a95: sin cambio). DROP+CREATE/ADD de sus propios objetos (idempotencia).
- **Pre-vuelo / huellas:** `reservar_por_enlace` 600fc445 (i2) / 5d8c6c55; `reserva_contexto` 8d81bc66 (g2) / a39a4dad; `reserva_enlace_emitir`(7) dae88a95; `proteger_reserva_enlaces` acd4128b (sin tocar).

### #41 · `20261122120100_agenda_j2_unico_carrera_client_id`

- **Crea:** nada.
- **Reescribe:** función `reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)` (antes: d3_reservar, seg1_candado_correo, i2_unico_sin_correo, j2_unico_tope_correo; aquí: CREATE_OR_REPLACE)
- **COMMENT sobre objetos de otra:** `reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) (de d3_reservar)`
- **GRANT/REVOKE:** 1 objeto(s).
- **Sin efecto en el conjunto:** Cuerpo de `reservar_por_enlace` (→ k1).
- **Pre-vuelo / huellas:** `reservar_por_enlace` = 5d8c6c55 (j2) o 1a448df0 (suya); índice `idx_appointments_client_id` por nombre.

### #42 · `20261122140000_agenda_j4_aviso_google_reserva`

- **Crea (9):** tabla `gcal_movimientos_rechazados`; restricción `gcal_movimientos_rechazados_pkey ON gcal_movimientos_rechazados`; restricción `gcal_movimientos_rechazados_clinica_id_fkey ON gcal_movimientos_rechazados`; restricción `gcal_movimientos_rechazados_intento_key ON gcal_movimientos_rechazados`; índice `gcal_movimientos_rechazados_clinica_idx ON gcal_movimientos_rechazados`; RLS `gcal_movimientos_rechazados`; función `cita_movimiento_google_registrar(uuid, uuid, timestamptz)`; función `aviso_clinica_de_movimiento_google()`; disparador `trg_gcal_movimientos_aviso_clinica ON gcal_movimientos_rechazados`
- **Reescribe:** restricción `avisos_clinica_tipo_check ON avisos_clinica` (antes: i5_avisos_clinica; aquí: DROP/ADD)
- **GRANT/REVOKE:** 3 objeto(s).
- **Sin efecto en el conjunto:** `avisos_clinica_tipo_check` de 6 tipos (→ l5).
- **Pre-vuelo / huellas:** Sin md5: texto de la CHECK de i5 (5 o 6 tipos) — aborta con 7 (AG-DT-229).

### #43 · `20261123120000_agenda_k1_bloqueos`

- **Crea (22):** tabla `agenda_bloqueos`; restricción `agenda_bloqueos_pkey ON agenda_bloqueos`; restricción `agenda_bloqueos_clinica_id_fkey ON agenda_bloqueos`; restricción `agenda_bloqueos_medico_id_fkey ON agenda_bloqueos`; restricción `agenda_bloqueos_puntas_check ON agenda_bloqueos`; restricción `agenda_bloqueos_minuto_check ON agenda_bloqueos`; restricción `agenda_bloqueos_zona_check ON agenda_bloqueos`; restricción `agenda_bloqueos_todo_el_dia_check ON agenda_bloqueos`; restricción `agenda_bloqueos_motivo_check ON agenda_bloqueos`; restricción `agenda_bloqueos_gcal_check ON agenda_bloqueos`; índice `agenda_bloqueos_evento_key ON agenda_bloqueos`; índice `agenda_bloqueos_medico_idx ON agenda_bloqueos`; índice `agenda_bloqueos_medico_fk_idx ON agenda_bloqueos`; RLS `agenda_bloqueos`; policy `agenda_bloqueos_select ON agenda_bloqueos`; policy `agenda_bloqueos_delete ON agenda_bloqueos`; policy `agenda_bloqueos_insert ON agenda_bloqueos`; policy `agenda_bloqueos_update ON agenda_bloqueos`; función `agenda_bloqueo_preparar()`; disparador `trg_agenda_bloqueos_preparar ON agenda_bloqueos`; disparador `audit_agenda_bloqueos ON agenda_bloqueos`; función `gcal_bloqueo_aplicar(uuid, text, text, uuid, text, timestamptz, boolean, timestamptz, timestamptz, date, date)`
- **Reescribe:** función `reserva_ocupacion(uuid, uuid, timestamptz, timestamptz)` (antes: d3_reservar, seg1_candado_correo; aquí: CREATE_OR_REPLACE); función `reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)` (antes: d3_reservar, seg1_candado_correo, i2_unico_sin_correo, j2_unico_tope_correo, j2_unico_carrera_client_id; aquí: CREATE_OR_REPLACE)
- **COMMENT sobre objetos de otra:** `reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) (de d3_reservar)`; `reserva_ocupacion(uuid, uuid, timestamptz, timestamptz) (de seg1_candado_correo)`
- **GRANT/REVOKE:** 5 objeto(s).
- **Sin efecto en el conjunto:** Cuerpos de `reserva_ocupacion` y `reservar_por_enlace` (→ k3). DROP+CREATE de sus propios disparadores.
- **Pre-vuelo / huellas:** `reserva_ocupacion` 50a89d85 (seg1) / e7cf1c34 (suya), aborta con f1701599/89059ef9 (k3); `reservar_por_enlace` 1a448df0 (j2b) / eb5ec46c, aborta con be25c167 (k3); re-ejecución `agenda_bloqueo_preparar` f1f887ec y `gcal_bloqueo_aplicar` 3e426d39. Post: `clinica_no_suspendida` a2dcfa8f y `clinica_tiene_acceso` 2efd7734 (main, exactos).

### #44 · `20261123130000_agenda_k2_espera_codigo`

- **Crea (2):** función `rate_limit_espera(text, integer, integer)`; función `reserva_espera_reenvio(uuid, uuid, text, integer)`
- **Reescribe:** función `reserva_codigo_verificar(uuid, uuid, text, text, text)` (antes: d3_reservar; aquí: CREATE_OR_REPLACE)
- **GRANT/REVOKE:** 3 objeto(s).
- **Sin efecto en el conjunto:** —
- **Pre-vuelo / huellas:** `reserva_codigo_verificar` 321e36cc (d3) / c3deded3; observa `rate_limit_intento` f931c333 y `reserva_codigo_emitir` 31171bf5/d24c01e9; post: `rate_limit_espera` 621e753f, `reserva_espera_reenvio` ed76045d.

### #45 · `20261123140000_agenda_k3_huso_clinica_pausa_enlace`

- **Crea (3):** columna `clinicas.timezone`; columna `reserva_enlaces.pausado_en`; restricción `reserva_enlaces_pausado_check ON reserva_enlaces`
- **Reescribe:** función `reserva_contexto(text, text, text)` (antes: d3_reservar, g2_duracion_consulta, j2_unico_tope_correo; aquí: CREATE_OR_REPLACE); función `reserva_ocupacion(uuid, uuid, timestamptz, timestamptz)` (antes: d3_reservar, seg1_candado_correo, k1_bloqueos; aquí: CREATE_OR_REPLACE); función `reserva_codigo_emitir(uuid, uuid, text, text)` (antes: d3_reservar; aquí: CREATE_OR_REPLACE); función `reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)` (antes: d3_reservar, seg1_candado_correo, i2_unico_sin_correo, j2_unico_tope_correo, j2_unico_carrera_client_id, k1_bloqueos; aquí: CREATE_OR_REPLACE); función `cita_reagendar_oferta(uuid, text)` (antes: e6_reagendar; aquí: CREATE_OR_REPLACE); función `reagendar_por_enlace(text, uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)` (antes: e6_reagendar; aquí: CREATE_OR_REPLACE)
- **GRANT/REVOKE:** 6 objeto(s).
- **Sin efecto en el conjunto:** — (sus seis cuerpos son los finales).
- **Toca `main`:** columna `clinicas.timezone`
- **Pre-vuelo / huellas:** Seis pares antes/después: `reserva_contexto` a39a4dad→e8be3201, `reservar_por_enlace` eb5ec46c→be25c167, `reagendar_por_enlace` a05266ad→54b257ed, `cita_reagendar_oferta` 4bcf4c7e→dbcd8da8, `reserva_ocupacion` e7cf1c34→f1701599, `reserva_codigo_emitir` 31171bf5→d24c01e9; `proteger_reserva_enlaces` = acd4128b.

### #46 · `20261124120000_agenda_l1_bloqueo_total`

- **Crea (2):** función `cita_proteger_bloqueo()`; disparador `trg_appointments_horario_bloqueado ON appointments`
- **GRANT/REVOKE:** 1 objeto(s).
- **Sin efecto en el conjunto:** — (DROP+CREATE de su propio disparador).
- **Toca `main`:** disparador `trg_appointments_horario_bloqueado ON appointments`
- **Pre-vuelo / huellas:** Re-ejecución: la suya d084da26.

### #47 · `20261124130000_agenda_l2_eliminar_cancelada`

- **Crea:** nada.
- **Reescribe:** restricción `appointments_cierre_check ON appointments` (antes: i4_cancelada_cerrada; aquí: DROP/ADD); función `cita_proteger_cierre()` (antes: i4_cancelada_cerrada; aquí: CREATE_OR_REPLACE)
- **COMMENT sobre objetos de otra:** `appointments.cerrada_en (de i4_cancelada_cerrada)`; `cita_proteger_cierre() (de i4_cancelada_cerrada)`
- **GRANT/REVOKE:** 1 objeto(s).
- **Sin efecto en el conjunto:** —
- **Pre-vuelo / huellas:** Sin md5 (existencia de i4-cancelada).

### #48 · `20261124160000_agenda_l5_aviso_confirmacion_paciente`

- **Crea (2):** función `aviso_clinica_de_confirmacion()`; disparador `trg_cita_confirmaciones_aviso_confirmacion ON cita_confirmaciones`
- **Reescribe:** restricción `avisos_clinica_tipo_check ON avisos_clinica` (antes: i5_avisos_clinica, j4_aviso_google_reserva; aquí: DROP/ADD)
- **GRANT/REVOKE:** 1 objeto(s).
- **Sin efecto en el conjunto:** —
- **Pre-vuelo / huellas:** Índice `avisos_clinica_pendiente_key` por su texto; re-ejecución: la suya 2e866033.

### #49 · `20261125170000_audit_log_sin_truncate`

- **Crea (1):** disparador `prevent_audit_truncate ON audit_log`
- **GRANT/REVOKE:** 1 objeto(s).
- **Sin efecto en el conjunto:** —
- **Toca `main`:** disparador `prevent_audit_truncate ON audit_log`
- **Pre-vuelo / huellas:** `prevent_audit_modification()` = f1fe023a (main).

### #50 · `20261125180000_agenda_m_saludo_recordatorio`

- **Crea (1):** función `cita_nombre_saludo(uuid, uuid)`
- **GRANT/REVOKE:** 1 objeto(s).
- **Sin efecto en el conjunto:** —
- **Pre-vuelo / huellas:** Re-ejecución: la suya 1b8ede6c.


## 4. Lo que queda sin efecto, consolidado

| Objeto | Por qué no tiene efecto | Qué hacer al fundir | Base |
|---|---|---|---|
| 26 cuerpos intermedios (tabla de §2) | los sustituye una migración posterior | escribir sólo el cuerpo final; partir del catálogo local o del archivo final | comprobado (md5 en catálogo) |
| `reserva_enlace_regenerar_fijo(uuid,uuid,text)` | 0 llamadores en `src/`, `scripts/`, `e2e/`; desde seg-emisión su INSERT con sesión da 42501 (cabecera de seg, l. 59-60: «se queda (Protocolo 2)») | no recrearla **si Angel lo aprueba**; sale de la lista del caso 3 de `p1` | comprobado (grep + cabecera) |
| `cita_correos_pendientes(integer)` | la sustituye `cita_recordatorios_pendientes` (h2); el código sólo la nombra en un comentario de `recordatorios.ts:19` | no recrearla si Angel lo aprueba; caso 3 −1; borrar su prueba SQL | comprobado |
| `reserva_enlace_emitir` de 7 argumentos | compatibilidad de despliegue (AG-DT-137): el código cae en ella sólo si la de 9 da PGRST202 | si las dos nacen en el mismo despliegue, la caída nunca corre. Quitarla exige tocar `gestionServidor.ts` y la regla de `CLAUDE.md` (J2). Mientras tanto se puede recrear tal cual | comprobado (código) + deducido (despliegue único) |
| policy `reserva_enlaces_insert` | `trg_reserva_enlaces_proteger` (seg) rechaza todo INSERT que no sea service_role, que no pasa por RLS | decisión: conservar (defensa en profundidad) o quitar; no cambia el comportamiento | comprobado (cuerpo de `proteger_reserva_enlaces`) |
| policies `tipos_cita_insert/update` de b6, índice `tipos_cita_nombre_activo_unico` de b6, CHECK de e4, i5, j4 e i4 | rehechos por g2, g2-update, g3, j4/l5 y l2 | crear sólo la versión final | comprobado |
| INSERT de arrastre de i5 en `avisos_clinica` | lee `reserva_empalmes_google` y `cita_confirmaciones`, que en producción nacen vacías en el mismo conjunto | omitirlo (0 filas) | deducido |
| NOT VALID + VALIDATE de `appointments_google_asignacion_check` (i3) | en la misma transacción no ahorra el candado (lo dice su cabecera) | CHECK normal | comprobado (cabecera) |
| DROP+CREATE / DROP+ADD de los propios objetos (j2, k1, l1, g2) | sólo sirven a la re-ejecución | crear una vez | comprobado |
| Ramas «re-ejecución» de los pre-vuelos (aceptan «el md5 suyo») y las comparaciones por md5 o texto con la migración anterior | la anterior ya no existe | ver §6 | comprobado |
| COMMENT intermedios (`consultorios.horario_propio` de b5, `appointments.reserva_nombre`, `reserva_reagendados`, `tipo_cita_id` de d1, `cerrada_en` de i4) | los reescribe una posterior | sólo el final | comprobado |

**NO quedan sin efecto, aunque lo parezcan:**

- **El backfill de G4** (respaldo + UPDATE de `consultorios`): en producción
  hay consultorios que nacerán con `horario_propio = false` y hay que
  copiarles el horario de la clínica.
- **`consultorios.horario_revisado_en`:** nace NULL en todos, «por
  revisar», a propósito.
- **Las tolerancias del CÓDIGO a migraciones ausentes** (PGRST202, 42P01,
  42703): no son SQL. Su retirada es otra decisión, y `CLAUDE.md` pide
  conservarlas.
- **El seudónimo del único sin correo** (i2): el único todavía puede
  emitirse sin correo (J2 cae a la de 7 «si el único va SIN correo»).

## 5. Lo que toca objetos de `main`

Comprobado: la agenda no reemplaza ninguna función de `main`. Sí cambia
tablas de `main`.

| Tabla de `main` | Qué le hace la agenda | Migraciones |
|---|---|---|
| `appointments` | 16 columnas nuevas | b6 (2), d1 (11), i3 (1), i4-cancelada (2) |
| `appointments` | 9 restricciones nuevas (`_cierre_check` reescrita en l2) | `appointments_tipo_cita_fkey`, `_tipo_cita_snapshot_check`, `_reserva_enlace_fkey`, `_reserva_aviso_fkey`, `_reserva_check`, `_reserva_reagendados_check`, `_google_asignacion_check`, `_sustituida_por_fkey`, `_cierre_check` |
| `appointments` | 7 índices nuevos | a18 (2), b6 (1), d1 (3), i4-cancelada (1) |
| `appointments` | sus 11 disparadores (antes no tenía ninguno; ver MAPA §5) | — |
| `appointments` | COMMENT de columna | — |
| `appointments` | la publicación `supabase_realtime` | **no cambia** |
| `consultorios` | 2 columnas | b5 `horario_propio`, i4 `horario_revisado_en` |
| `consultorios` | backfill de datos con respaldo en `respaldos.consultorios_horario_20261119` | g4 |
| `consultorios` | sus disparadores de `main` (`audit_consultorios`, `enforce_consultorio_default_*`) intervienen en el backfill | g4 |
| `clinicas` | 1 columna, `timezone` | k3 |
| `clinicas` | `horario_consulta` se LEE, nunca se escribe (contrato con spinus-consola) | g4, h2, i4 |
| `audit_log` | se escribe desde `log_cita_change` y otras DEFINER/INVOKER | — |
| `audit_log` | #49: REVOKE TRUNCATE y disparador `prevent_audit_truncate` | #49 |
| `consultas` | `cita_tiene_nota_ligada` lee `appointment_id` | — |
| `profiles` | se lee el rol y `es_admin_de_clinica` | — |
| `clinica_conexiones_google` | se lee | — |
| `ip_rate_limits` | se lee (`rate_limit_espera`) | — |
| `pacientes` | se lee | — |

**Funciones de `main` de las que depende la agenda** (las llama o las
exige en un pre-vuelo):

- `get_clinica_id()`, `soy_admin_de_clinica()` y `get_my_role()`, que tienen
  que ser DEFINER;
- `log_tabla_change()`;
- `perfil_completo()`;
- `clinica_no_suspendida()` y `clinica_tiene_acceso()`: se exige su FORMA en
  c1 y su md5 en e1/e6 (normalizado, 588de29d) y en k1 (exacto, a2dcfa8f /
  2efd7734);
- `prevent_audit_modification()` (#49, f1fe023a);
- `rate_limit_intento` (k2 sólo la observa).

`log_cita_change` NO es de `main`: la crea b0 (comprobado, 0 apariciones en
el volcado). Antes de b0, `appointments` no tenía auditoría.

## 6. Cadenas de pre-vuelo y qué cambia al fundir

Cada eslabón exige el cuerpo exacto que dejó el anterior (o el suyo, para
re-ejecutarse):

- **`log_cita_change`:** c2 (texto del WHEN) → e1 (e57358a1 | 80c3556c) → e6
  (80c3556c); e9 (`position('google_rsvp')`).
- **`gcal_*`:** d4 (f5da38cc, a1a53c1d | 5ac551e4, 66feb69a).
- **`proteger_reserva_enlaces`:**
  - seg-emisión (181cee85 | acd4128b);
  - h2-restablecer (`acd4128b%`);
  - j2 (acd4128b);
  - k3 (acd4128b).
- **`reservar_por_enlace`:**
  - seg1 (52ee7af1 | d3ddd46b);
  - i2 (d3ddd46b | 600fc445);
  - j2 (600fc445 | 5d8c6c55);
  - j2b (5d8c6c55 | 1a448df0);
  - k1 (1a448df0 | eb5ec46c, y aborta con el de k3);
  - k3 (eb5ec46c | be25c167).
- **`reserva_ocupacion`:** seg1 (648672c0 | 50a89d85) → k1 (50a89d85 |
  e7cf1c34) → k3 (e7cf1c34 | f1701599).
- **`reserva_contexto`:** g2 (3c2c9c91 | 8d81bc66) → j2 (8d81bc66 | a39a4dad)
  → k3 (a39a4dad | e8be3201).
- **Una sola sustitución:**
  - `reserva_contacto_estado`: seg1 (d694184d | 52ca884f);
  - `cita_correo_tomar`: g3 (d7c18c8e | 5d0ce8db);
  - `cita_correos_pendientes`: h2 (a8b08c15);
  - `agenda_restablecer_configuracion`: i4-horario (6c99e553 | 1c390644);
  - `cita_proteger_atendida`: i4-atendida (74dde456 | cfc4fcd7);
  - `reserva_codigo_verificar`: k2 (321e36cc | c3deded3);
  - `reserva_enlace_emitir(7)`: j2 (dae88a95);
  - `reagendar_por_enlace`, `cita_reagendar_oferta`, `reserva_codigo_emitir`:
    k3 (a05266ad, 4bcf4c7e, 31171bf5).
- **Texto deparseado en lugar de md5:**
  - el WHEN de `audit_appointments_update` (c2, e1);
  - las policies de `tipos_cita` (g2, g2-update);
  - `appointments_update` sin «public.» (i2-elección, sensible al
    `search_path`);
  - la forma de las puertas (c1);
  - la regex de `gcal_importar_evento` (i3);
  - la CHECK de `avisos_clinica` (j4, que aborta con 7 tipos);
  - el índice `avisos_clinica_pendiente_key` (l5).
- **Huellas de FK:** e1 223dd96f, e6 6d6680fe, e4 93981fdf; y la fórmula de
  `appointments_reserva_check` (d1 12f5eb0a).

**Al fundir (deducido):**

- **Todas las cadenas internas desaparecen.** Ningún archivo fundido puede
  exigir el md5 de un cuerpo que ya no existe en el repo.
- **Lo único que tiene sentido conservar** es la comprobación de los objetos
  de `main` de los que se depende:
  - la forma, el md5 normalizado o el exacto de `clinica_no_suspendida()` y
    `clinica_tiene_acceso()` (k1 y c1 usan criterios distintos: unificarlos);
  - el md5 de `prevent_audit_modification()`;
  - que los helpers sean DEFINER;
  - la existencia de las columnas de `main`.
- **Entre bloques fundidos,** existencia (`to_regclass` / `to_regprocedure`)
  y, si se quiere, el md5 del cuerpo final que deja el bloque anterior,
  calculado una vez escritos los archivos fundidos.
- **Los md5 «suyos» cambian si cambia un solo byte** del cuerpo (comentarios
  dentro del `$$` incluidos). Quien funda una función debe recalcular el md5
  del post-vuelo y de las pruebas que lo citan. Lo citan, al menos:
  - la rejilla de la propia migración;
  - `supabase/pruebas-sql/*`, si alguna compara md5;
  - `CLAUDE.md` («md5 de prosrc `acd4128b…`» de
    `proteger_reserva_enlaces`, «md5 `d084da26`»), que habría que
    actualizar.

## 7. La #49, aparte

- **Qué hace:** `REVOKE TRUNCATE ON audit_log FROM anon, authenticated,
  service_role` y el disparador de sentencia `prevent_audit_truncate`, que
  llama a `prevent_audit_modification()` de `main`.
- **Pre-vuelo:** el md5 f1fe023a de esa función de `main` y que quien la
  aplica sea el dueño de la tabla.
- **Independiente:** no depende de ninguna de la agenda ni la toca ninguna
  (comprobado: ninguna otra migración del conjunto nombra `audit_log` en
  DDL). Puede ir antes o después del conjunto fundido.
- **No se funde.** Sigue siendo una migración propia, como la nueva de
  TRUNCATE que escribe otro agente.
