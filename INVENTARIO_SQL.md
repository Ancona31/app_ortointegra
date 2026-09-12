# INVENTARIO_SQL.md — qué es cada archivo `.sql` del repo

> **Documento de solo lectura.** No mueve, no renombra, no borra y no ejecuta
> nada. La sección 6 propone una reorganización; **no está aplicada**.
>
> Generado el **2026-09-12** sobre la rama `chore/entorno-local`
> (HEAD `ebe09ed`). Universo: **125 archivos `.sql` rastreados por git**
> (`git ls-files '*.sql'`). No hay ningún `.sql` sin rastrear.

---

## Resumen de una pantalla

| Dónde | Cuántos | Qué son |
|---|---|---|
| Raíz del repo (`supabase_migration_*.sql` + `supabase_schema.sql`) | 44 | Historia pre-CLI. **Todas aplicadas a producción antes del 2026-04-26.** |
| `supabase/migrations/` | 69 | Migraciones desde el 2026-04-27. Casi todas aplicadas. |
| `supabase/migrations/descartadas/` | 1 | Migración retirada a propósito. |
| `supabase/baseline/` | 9 | Foto reconstructiva del esquema de prod al 2026-04-26. **No son migraciones.** |
| `scripts/` | 1 | Consultas de diagnóstico READ-ONLY. |
| `supabase/` (suelto) | 1 | Limpieza puntual de datos, no migración. |

Clasificación (detalle en §2):

| Categoría | Archivos |
|---|---|
| **(a) Migración aplicada** | 106 |
| **(b) No aplicada o dudosa** | 3 |
| **(c) Consulta de trabajo** | 1 |
| **(d) Seed / datos** | 2 |
| **(e) Otro** | 13 |

---

## 0 · Cómo se dedujo qué está aplicado

Tres fuentes, en este orden de fuerza:

1. **`supabase/baseline/`** — es un volcado real de `information_schema` /
   `pg_catalog` de producción tomado el **2026-04-26**. Si un objeto sale ahí,
   se aplicó. Esto cierra de golpe **los 44 archivos de la raíz**: las 20 tablas,
   las columnas, los índices, los CHECK y los 4 buckets que crean están todos en
   el baseline, y la tabla `laboratorios` que uno de ellos borra **no** está.
2. **Migraciones posteriores que hablan de las anteriores** — un archivo que
   dice «esto ya está en producción» o que hace `CREATE OR REPLACE` sobre una
   función viva es evidencia de que la anterior corrió.
3. **Código vivo en `src/`** — si una ruta de producción consulta una tabla, la
   migración que la crea se aplicó.

> ### ⚠️ Las cabeceras `-- PENDIENTE DE APLICAR` mienten, y ya está documentado
>
> Doce archivos de `supabase/migrations/` abren con `PENDIENTE DE APLICAR` y en
> la mayoría es falso. **No es un hallazgo nuevo de este inventario**: está
> registrado en `DEUDA_TECNICA.md` (sección de rótulos de migración, tabla de
> «qué consta») y la prevención está en `supabase/AUDITORIA-MIGRACIONES.md` §7.
> La causa: hasta julio el archivo se commiteaba **después** de aplicar y el
> rótulo nacía cierto; desde agosto se commitea **antes** y nadie vuelve a
> mirarlo.
>
> **Consecuencia para quien lea este inventario:** la columna de estado de abajo
> vale más que la primera línea del archivo. Este documento **no** reescribe
> ninguna cabecera — eso es la sesión de reconciliación que `DEUDA_TECNICA.md`
> ya tiene planteada, con la base delante.

---

## 1 · Todos los archivos `.sql` del repo

`Alta` = fecha del commit que lo creó. `Últ.` = fecha del último commit que lo
tocó. Cuando las dos coinciden, el archivo nunca se modificó tras su alta.

### 1.1 · Raíz del repo — 44 archivos

| Archivo | Tam. | Alta | Últ. | Primeras líneas de comentario |
|---|---|---|---|---|
| `supabase_migration_addendums.sql` | 2.1 KB | 2026-04-08 | 2026-04-08 | ══════════════════════════════════════════════════════════════════════════╗ |
| `supabase_migration_appointments.sql` | 2.2 KB | 2026-04-04 | 2026-04-04 | OrthoIntegra — Módulo de Agenda (Appointments) |
| `supabase_migration_appointments_medico.sql` | 0.6 KB | 2026-04-04 | 2026-04-04 | OrthoIntegra — Agenda: médico por cita |
| `supabase_migration_appointments_v2.sql` | 0.7 KB | 2026-04-04 | 2026-04-04 | OrthoIntegra — Agenda v2: gcal_sync_status |
| `supabase_migration_audit_immutable.sql` | 4.4 KB | 2026-04-08 | 2026-04-08 | ══════════════════════════════════════════════════════════════════════════╗ |
| `supabase_migration_audit_log.sql` | 2.9 KB | 2026-04-01 | 2026-04-01 | MIGRACIÓN: Audit log (NOM-024-SSA3 / trazabilidad) |
| `supabase_migration_calculadoras_resultados.sql` | 2.2 KB | 2026-04-19 | 2026-04-19 | MIGRACIÓN: calculadora_resultados |
| `supabase_migration_cat_cie10_seed.sql` | 172.7 KB | 2026-04-17 | 2026-04-17 | CIE-10 Catálogo en español — Seed de categorías principales + subcategorías clínicas |
| `supabase_migration_cat_cie10_tabla.sql` | 1.5 KB | 2026-04-17 | 2026-04-17 | Migración: Catálogo CIE-10 — estructura de tabla |
| `supabase_migration_client_id_idempotency.sql` | 9.7 KB | 2026-04-12 | 2026-04-12 | Migración: client_id para idempotencia del outbox-engine |
| `supabase_migration_clinicas_suspendida.sql` | 0.6 KB | 2026-04-04 | 2026-04-04 | OrthoIntegra — Clínicas: campo suspendida |
| `supabase_migration_consentimiento.sql` | 0.8 KB | 2026-04-01 | 2026-04-01 | MIGRACIÓN: Ampliar constraint tipo en tabla documentos |
| `supabase_migration_consentimiento_privacidad.sql` | 1.5 KB | 2026-04-08 | 2026-04-08 | ══════════════════════════════════════════════════════════════════════════╗ |
| `supabase_migration_escrito_medico.sql` | 0.5 KB | 2026-03-29 | 2026-03-29 | Agregar 'escrito_medico' al constraint de tipo en documentos |
| `supabase_migration_firma_medico.sql` | 0.6 KB | 2026-04-09 | 2026-04-09 | ─── Migración: firma autógrafa del médico ──────────────────────────────── |
| `supabase_migration_horario.sql` | 1.0 KB | 2026-04-04 | 2026-04-04 | OrthoIntegra — Horario de consulta por clínica |
| `supabase_migration_independiente_admin.sql` | 0.5 KB | 2026-04-05 | 2026-04-05 | Migración: convertir usuarios independientes de role='medico' a role='admin' |
| `supabase_migration_internamiento.sql` | 0.4 KB | 2026-03-29 | 2026-03-29 | Agregar 'solicitud_internamiento' al constraint de tipo en documentos |
| `supabase_migration_ip_rate_limits.sql` | 1.0 KB | 2026-04-01 | 2026-04-01 | MIGRACIÓN: Tabla ip_rate_limits para endpoints públicos |
| `supabase_migration_labs_catalogo.sql` | 2.6 KB | 2026-04-21 | 2026-04-21 | MIGRACIÓN: analitos_catalogo (rediseño labs — sub-fase 1A) |
| `supabase_migration_labs_documentos_tipos.sql` | 1.1 KB | 2026-04-21 | 2026-04-21 | MIGRACIÓN: extender CHECK documentos.tipo (labs — sub-fase 1A) |
| `supabase_migration_labs_documentos_upload.sql` | 7.4 KB | 2026-04-22 | 2026-04-22 | Este SQL ya fue ejecutado manualmente en Supabase (2026-04-22) |
| `supabase_migration_labs_drop_legacy.sql` | 4.4 KB | 2026-04-23 | 2026-04-23 | Migración: DROP tabla laboratorios legacy (sub-fase 8C2) |
| `supabase_migration_labs_mediciones.sql` | 4.0 KB | 2026-04-21 | 2026-04-21 | MIGRACIÓN: mediciones_analitos (rediseño labs — sub-fase 1A) |
| `supabase_migration_labs_seed_catalogo.sql` | 47.1 KB | 2026-04-22 | 2026-04-22 | MIGRACIÓN: seed del catálogo de analitos (labs — sub-fase 1B) |
| `supabase_migration_labs_trigger_antropometria.sql` | 7.0 KB | 2026-04-21 | 2026-04-21 | MIGRACIÓN: trigger sincronización antropometría (labs — sub-fase 1A) |
| `supabase_migration_medicamentos.sql` | 37.2 KB | 2026-03-27 | 2026-03-27 | MIGRACIÓN: Tabla de medicamentos |
| `supabase_migration_nota_honorarios.sql` | 0.5 KB | 2026-04-02 | 2026-04-02 | Agregar nota_honorarios al check constraint de documentos.tipo |
| `supabase_migration_nota_origen.sql` | 0.8 KB | 2026-04-09 | 2026-04-09 | Migración: campo nota_origen en tabla consultas |
| `supabase_migration_onboarding.sql` | 0.3 KB | 2026-04-10 | 2026-04-10 | ─── Migración: campo universidad en profiles ──────────────────────────────── |
| `supabase_migration_pagination_indexes.sql` | 1.3 KB | 2026-04-08 | 2026-04-08 | ══════════════════════════════════════════════════════════════════════════╗ |
| `supabase_migration_pdf_jobs.sql` | 2.2 KB | 2026-03-27 | 2026-03-27 | Procesamiento asíncrono de PDFs de laboratorios |
| `supabase_migration_perfil_medico.sql` | 0.3 KB | 2026-03-28 | 2026-03-28 | Agrega campos de contacto del consultorio al perfil del médico |
| `supabase_migration_plantillas_honorarios.sql` | 2.7 KB | 2026-04-16 | 2026-04-16 | Migración: Plantillas de Honorarios / Cotizaciones |
| `supabase_migration_rate_limits.sql` | 1.1 KB | 2026-03-27 | 2026-03-27 | MIGRACIÓN: Tabla rate_limits para control de uso de IA |
| `supabase_migration_retencion_expedientes.sql` | 7.7 KB | 2026-04-08 | 2026-04-08 | ══════════════════════════════════════════════════════════════════════════╗ |
| `supabase_migration_rls.sql` | 5.3 KB | 2026-03-27 | 2026-03-27 | MIGRACIÓN: RLS multi-clínica + clinica_id en pacientes |
| `supabase_migration_rls_profiles_tokens.sql` | 2.0 KB | 2026-04-01 | 2026-04-01 | MIGRACIÓN: RLS para tablas profiles y google_tokens |
| `supabase_migration_soft_delete_pacientes.sql` | 0.3 KB | 2026-04-05 | 2026-04-05 | Soft delete para pacientes — plan free no puede liberar slots borrando pacientes |
| `supabase_migration_solicitudes_arco.sql` | 6.9 KB | 2026-04-09 | 2026-04-09 | Migración: tabla solicitudes_arco + funciones de dashboard |
| `supabase_migration_storage_documentos_pdf.sql` | 1.4 KB | 2026-04-17 | 2026-04-17 | Migración: Policies de Storage para bucket documentos-pdf |
| `supabase_migration_stripe.sql` | 4.4 KB | 2026-04-01 | 2026-04-01 | MIGRACIÓN: Stripe billing + planes de suscripción |
| `supabase_migration_tipo_clinica.sql` | 0.3 KB | 2026-03-27 | 2026-03-27 | Soporte para usuarios independientes (sin clínica) |
| `supabase_schema.sql` | 7.6 KB | 2026-03-24 | 2026-03-27 | OrthoIntegra — Schema de base de datos |

### 1.2 · `supabase/migrations/` — 69 archivos

| Archivo | Tam. | Alta | Últ. | Primeras líneas de comentario |
|---|---|---|---|---|
| `supabase/migrations/20260427_b1_01_clinicas_rls.sql` | 5.2 KB | 2026-04-29 | 2026-04-29 | Cerrar la fuga de datos comerciales cross-clínica añadiendo una policy |
| `supabase/migrations/20260427_b1_02_sa_functions_role_check.sql` | 11.3 KB | 2026-04-29 | 2026-04-29 | Añadir verificación interna de rol al inicio de las 4 funciones |
| `supabase/migrations/20260427_b1_03_security_definer_search_path.sql` | 6.1 KB | 2026-04-29 | 2026-04-29 | Fijar `search_path = public, pg_temp` en las 6 funciones SECURITY |
| `supabase/migrations/20260429_b2_01_drop_legacy_public_policies.sql` | 13.8 KB | 2026-04-30 | 2026-04-30 | Eliminar las policies legacy `TO public` que neutralizan vía OR las |
| `supabase/migrations/20260429_b2_02_consolidate_get_clinica_id.sql` | 10.2 KB | 2026-04-30 | 2026-04-30 | Consolidar las dos funciones helper duplicadas `get_clinica_id()` y |
| `supabase/migrations/20260429_b2_03_clean_audit_log_policies.sql` | 5.0 KB | 2026-04-30 | 2026-04-30 | Eliminar una de las dos policies SELECT duplicadas en `public.audit_log`. |
| `supabase/migrations/20260429_b2_04_clean_google_tokens_policies.sql` | 5.5 KB | 2026-04-30 | 2026-04-30 | Eliminar la policy ALL legacy `"Users manage own tokens"` en |
| `supabase/migrations/20260430_vip_01_es_vip_grant.sql` | 9.6 KB | 2026-04-30 | 2026-04-30 | Introducir el override administrativo VIP como columna explícita en |
| `supabase/migrations/20260503_phase81_block_post_cancellation.sql` | 9.4 KB | 2026-05-03 | 2026-05-03 | Bloquear creación de pacientes, consultas y documentos cuando una |
| `supabase/migrations/20260504_revert_phase81_recursion.sql` | 3.6 KB | 2026-05-05 | 2026-05-05 | Revertir las 3 policies RESTRICTIVE creadas por Phase 8.1 |
| `supabase/migrations/20260518080301_etapa0_limpieza_pre_refactor.sql` | 1.6 KB | 2026-05-18 | 2026-05-18 | Migración: Etapa 0 — Limpieza pre-refactor del sistema de roles |
| `supabase/migrations/20260518083036_etapa1_schema_declarativo.sql` | 2.8 KB | 2026-05-18 | 2026-05-18 | Migración: Etapa 1 — Schema declarativo nuevo para refactor de roles |
| `supabase/migrations/20260518100645_etapa2_limpieza_datos_productivos.sql` | 8.2 KB | 2026-05-18 | 2026-05-18 | Migración: Etapa 2 — Limpieza de datos productivos |
| `supabase/migrations/20260518132155_etapa1bis_backfill_es_admin_de_clinica.sql` | 3.3 KB | 2026-05-19 | 2026-05-19 | Migración: Etapa 1bis — Backfill de es_admin_de_clinica para profiles admin |
| `supabase/migrations/20260519114652_etapa4a8_eliminar_rol_admin_legacy.sql` | 3.1 KB | 2026-05-19 | 2026-05-19 | Sub-paso 4.A.8 — Eliminación del rol 'admin' legacy |
| `supabase/migrations/20260521_etapa5b1_consultas_medico_id.sql` | 2.3 KB | 2026-05-21 | 2026-05-21 | Etapa 5.B.1 — Agregar consultas.medico_id |
| `supabase/migrations/20260521_etapa5b2_paciente_medico.sql` | 4.2 KB | 2026-05-21 | 2026-05-21 | Etapa 5.B.2 — Crear tabla paciente_medico (modelo M:N) + backfill |
| `supabase/migrations/20260521_etapa5b3_trigger_latch_premium.sql` | 3.4 KB | 2026-05-21 | 2026-05-21 | Etapa 5.B.3 — Trigger latch de clinicas.ha_tenido_acceso_premium |
| `supabase/migrations/20260522_etapa5c_helpers_rls.sql` | 8.2 KB | 2026-05-22 | 2026-05-22 | Etapa 5.C — 6 helpers SECURITY DEFINER para policies RLS |
| `supabase/migrations/20260524_duprpc_paso1_rpc_v2.sql` | 10.4 KB | 2026-05-24 | 2026-05-24 | DUP-RPC — Paso 1: RPC crear_paciente_con_medico_v2 |
| `supabase/migrations/20260524_etapa5e_bd1_policies_pacientes.sql` | 4.7 KB | 2026-05-24 | 2026-05-24 | Etapa 5.E — Paso 5 (BD-1): policies RLS de pacientes (visibilidad M:N) |
| `supabase/migrations/20260524_etapa5e_bd2_policies_paciente_medico.sql` | 2.6 KB | 2026-05-24 | 2026-05-24 | Etapa 5.E — Paso 1 (BD-2): policies RLS de paciente_medico |
| `supabase/migrations/20260524_etapa5e_paso4_backfill_paciente_medico.sql` | 2.6 KB | 2026-05-24 | 2026-05-24 | Etapa 5.E — Paso 4: Backfill correctivo set-based |
| `supabase/migrations/20260524_etapa5e_ts1a_rpc_crear_paciente_con_medico.sql` | 6.8 KB | 2026-05-24 | 2026-05-24 | Etapa 5.E — Paso 2 (TS-1a): RPC crear_paciente_con_medico |
| `supabase/migrations/20260530_etapa5f_paso3_policies_consultas.sql` | 8.0 KB | 2026-05-30 | 2026-05-30 | Etapa 5.F — Paso 3: Reescribir policies de consultas |
| `supabase/migrations/20260530_etapa5g_paso4_policies_documentos.sql` | 8.2 KB | 2026-05-30 | 2026-05-30 | Etapa 5.G — Paso 4: Reescribir policies de documentos |
| `supabase/migrations/20260530_etapa5h_paso3_policies_appointments.sql` | 8.2 KB | 2026-05-30 | 2026-05-30 | Etapa 5.H — Paso 3: Reescribir policies de appointments |
| `supabase/migrations/20260531_etapa5i_paso3_policies_addendums_mediciones.sql` | 13.4 KB | 2026-05-31 | 2026-05-31 | Etapa 5.I — Paso 3: Reescribir policies de addendums + mediciones_analitos |
| `supabase/migrations/20260602_casos_etapa2_fundacion.sql` | 8.9 KB | 2026-06-02 | 2026-06-02 | Módulo: Casos Clínicos |
| `supabase/migrations/20260602_etapa5j_paso2_policies_profiles_invitaciones.sql` | 13.1 KB | 2026-06-02 | 2026-06-02 | Etapa 5.J — Paso 2: Limpieza menor profiles + invitaciones |
| `supabase/migrations/20260602_sec_proteger_columnas_sensibles_profiles.sql` | 4.1 KB | 2026-06-02 | 2026-06-02 | SEC — Trigger guardián de columnas sensibles en public.profiles |
| `supabase/migrations/20260603_sec_blindaje_bucket_firmas_medicos.sql` | 5.8 KB | 2026-06-03 | 2026-06-03 | SEC — Blindaje RESTRICTIVE del bucket privado firmas-medicos |
| `supabase/migrations/20260603_sec_documentos_pdf_acceso_tratante.sql` | 6.8 KB | 2026-06-03 | 2026-06-03 | SEC — documentos-pdf: acceso restringido al médico tratante |
| `supabase/migrations/20260615_consultorios_01_table.sql` | 3.6 KB | 2026-06-14 | 2026-06-14 | Migración 2.1: CREATE TABLE consultorios |
| `supabase/migrations/20260615_consultorios_02_triggers.sql` | 8.1 KB | 2026-06-14 | 2026-06-14 | Migración 2.2: Funciones y triggers de consultorios |
| `supabase/migrations/20260615_consultorios_03_rls.sql` | 5.1 KB | 2026-06-14 | 2026-06-14 | Migración 2.3: RLS de consultorios |
| `supabase/migrations/20260615_consultorios_04_snapshot.sql` | 5.5 KB | 2026-06-14 | 2026-06-14 | Migración 2.4: ALTERs a appointments y consultas para snapshot de consultorio |
| `supabase/migrations/20260615_consultorios_05_marcar_default_rpc.sql` | 5.5 KB | 2026-06-14 | 2026-06-14 | Migración 2.2-bis: Función RPC marcar_consultorio_default |
| `supabase/migrations/20260616_consultorios_06_rls_select_owner_only.sql` | 3.4 KB | 2026-06-16 | 2026-06-16 | Migración 2.6: RLS de consultorios — fix SELECT owner-only para médicos |
| `supabase/migrations/20260624_nombres_01_columnas_estructuradas.sql` | 2.0 KB | 2026-06-24 | 2026-06-24 | Fase 1 del proyecto de normalización de nombres de médicos (NOMBRES_PLAN.md). |
| `supabase/migrations/20260624_nombres_02_drop_audit_log_view.sql` | 2.0 KB | 2026-06-24 | 2026-06-24 | Fase 5.D del proyecto de normalización de nombres (NOMBRES_PLAN.md). |
| `supabase/migrations/20260624_nombres_03_sa_top_medicos_estructurado.sql` | 4.1 KB | 2026-06-24 | 2026-06-24 | Fase 5.D del proyecto de normalización de nombres (NOMBRES_PLAN.md). |
| `supabase/migrations/20260624_nombres_04_drop_columna_nombre.sql` | 2.9 KB | 2026-06-24 | 2026-06-24 | Fase 6 (cierre) del proyecto de normalización de nombres (NOMBRES_PLAN.md). |
| `supabase/migrations/20260625_etapa5e_bd2fix_paciente_medico_select_secretaria.sql` | 8.2 KB | 2026-06-26 | 2026-06-26 | Etapa 5.E — BD-2 FIX: agregar rama secretaria a paciente_medico_select |
| `supabase/migrations/20260626_expediente_01_indices_listado.sql` | 7.0 KB | 2026-06-26 | 2026-06-26 | Expediente — Paso 1: índices para la lista "Expediente Clínico" |
| `supabase/migrations/20260626_expediente_02_rpc_listar_pacientes.sql` | 11.7 KB | 2026-06-26 | 2026-06-26 | Expediente — Paso 2: RPC listar_pacientes_expediente |
| `supabase/migrations/20260630_expediente_03_rpc_filtrar_activo.sql` | 7.7 KB | 2026-06-30 | 2026-06-30 | Expediente — Fix: listar_pacientes_expediente debe excluir soft-deleted |
| `supabase/migrations/20260713_billing_01_stripe_webhook_events.sql` | 1.7 KB | 2026-07-18 | 2026-07-18 | Billing — Paso 1: tabla de idempotencia de eventos de Stripe |
| `supabase/migrations/20260720_apnp_ant_no_patologicos.sql` | 7.0 KB | 2026-07-20 | 2026-07-20 | MIGRACIÓN DOCUMENTAL — NO EJECUTAR MANUALMENTE |
| `supabase/migrations/20260721_signos_vitales_consultas.sql` | 1.2 KB | 2026-07-21 | 2026-07-21 | MIGRACIÓN DOCUMENTAL — NO EJECUTAR MANUALMENTE |
| `supabase/migrations/20260804_documentos_formato_version.sql` | 2.3 KB | 2026-08-05 | 2026-08-05 | Sistema de documentos v2 · Paso 0.a (andamiaje inerte). |
| `supabase/migrations/20260804_profiles_flag_documentos_v2.sql` | 1.5 KB | 2026-08-05 | 2026-08-05 | Sistema de documentos v2 · Paso 0.a (andamiaje inerte). |
| `supabase/migrations/20260807_folio_01_esquema_y_generador.sql` | 39.2 KB | 2026-08-07 | 2026-08-07 | Sistema de documentos v2 · sub-paso «generador de folio», commit 1 de 2. |
| `supabase/migrations/20260810_plantillas_documento.sql` | 15.9 KB | 2026-08-10 | 2026-08-10 | Sistema de plantillas de documento · Paso 5.3.a |
| `supabase/migrations/20260811_folio_03_denegacion.sql` | 19.1 KB | 2026-08-10 | 2026-08-10 | Denegación o revocación del consentimiento · tipo nuevo y clase de folio |
| `supabase/migrations/20260812_documentos_estado.sql` | 17.7 KB | 2026-08-11 | 2026-08-11 | Estado del documento · el borrador del consentimiento |
| `supabase/migrations/20260813_firmas_documento.sql` | 27.6 KB | 2026-08-11 | 2026-08-11 | Firmas electrónicas del consentimiento · tabla, bucket y protección |
| `supabase/migrations/20260813_formato_version_inmutable.sql` | 13.4 KB | 2026-08-13 | 2026-08-13 | documentos.formato_version · fijarla al emitir y declararla inmutable |
| `supabase/migrations/20260815_gcal_calendario_propio_a_esquema.sql` | 7.1 KB | 2026-08-15 | 2026-08-15 | Calendario propio de Spinus en Google (Rama 1) — CAMBIOS DE ESQUEMA |
| `supabase/migrations/20260815_gcal_calendario_propio_b_datos.sql` | 8.5 KB | 2026-08-15 | 2026-08-15 | Calendario propio de Spinus en Google (Rama 1) — CORTE DE DATOS |
| `supabase/migrations/20260816_agenda_realtime_appointments.sql` | 13.1 KB | 2026-08-16 | 2026-08-16 | Agenda en tiempo real — alta de `appointments` en la publicación de Realtime |
| `supabase/migrations/20260817_gcal_conexion_clinica_a_esquema.sql` | 41.8 KB | 2026-08-16 | 2026-08-17 | Conexión de Google POR CLÍNICA (Alternativa B, dos tablas) — ESQUEMA + DATOS |
| `supabase/migrations/20260817_gcal_conexion_clinica_b_retiro.sql` | 18.4 KB | 2026-08-16 | 2026-08-16 | Conexión de Google POR CLÍNICA — RETIRO DE public.google_tokens |
| `supabase/migrations/20260818_gcal_puente_secretos.sql` | 66.9 KB | 2026-08-17 | 2026-08-19 | Puente de acceso a `private.google_conexiones_secretos` (3 funciones RPC) |
| `supabase/migrations/20260821_agenda_evento_generico_icono_color.sql` | 26.8 KB | 2026-08-21 | 2026-08-21 | Evento genérico de agenda: columnas `icono` y `color` + 2 CHECK |
| `supabase/migrations/20260821_agenda_status_attended.sql` | 19.4 KB | 2026-08-21 | 2026-08-21 | `appointments.status`: quinto valor `attended` en el CHECK |
| `supabase/migrations/20260821_consultas_appointment_id.sql` | 31.1 KB | 2026-08-21 | 2026-08-21 | `consultas.appointment_id` — de qué cita salió esta consulta (FK SET NULL) |
| `supabase/migrations/20260822_agenda_pinta_definitiva.sql` | 46.1 KB | 2026-08-22 | 2026-08-22 | La pinta definitiva del evento genérico: 20 iconos y 6 colores |
| `supabase/migrations/20260826_agenda_all_day.sql` | 41.1 KB | 2026-08-26 | 2026-08-26 | `appointments.all_day boolean NOT NULL DEFAULT false` + CHECK |

### 1.3 · `supabase/migrations/descartadas/` — 1 archivo

| Archivo | Tam. | Alta | Últ. | Primeras líneas de comentario |
|---|---|---|---|---|
| `supabase/migrations/descartadas/20260808_folio_02_clases_faltantes.sql` | 14.8 KB | 2026-08-10 | 2026-08-10 | Sistema de documentos v2 · folio, commit 2 de 2. |

### 1.4 · `supabase/baseline/` — 9 archivos

| Archivo | Tam. | Alta | Últ. | Primeras líneas de comentario |
|---|---|---|---|---|
| `supabase/baseline/01_extensions.sql` | 0.6 KB | 2026-04-26 | 2026-04-26 | Extensiones requeridas por el schema. Aplicar antes de 02_tables.sql. |
| `supabase/baseline/02_tables.sql` | 19.5 KB | 2026-04-26 | 2026-08-15 | 20 tablas del schema public. |
| `supabase/baseline/03_indexes.sql` | 6.8 KB | 2026-04-26 | 2026-08-15 | Índices secundarios del schema public. |
| `supabase/baseline/04_foreign_keys.sql` | 5.6 KB | 2026-04-26 | 2026-04-26 | 28 foreign keys del schema public. |
| `supabase/baseline/05_functions.sql` | 9.8 KB | 2026-04-26 | 2026-06-24 | 17 funciones custom del schema public. |
| `supabase/baseline/06_triggers.sql` | 3.3 KB | 2026-04-26 | 2026-04-26 | 12 triggers activos sobre tablas de public. |
| `supabase/baseline/07_rls_policies.sql` | 22.0 KB | 2026-04-26 | 2026-04-26 | ENABLE RLS y CREATE POLICY para las 20 tablas del schema public. |
| `supabase/baseline/08_view.sql` | 0.5 KB | 2026-04-26 | 2026-06-24 | Vistas del schema public. |
| `supabase/baseline/09_storage_buckets.sql` | 1.9 KB | 2026-04-26 | 2026-04-26 | 4 storage buckets del proyecto. |

### 1.5 · Sueltos — 2 archivos

| Archivo | Tam. | Alta | Últ. | Primeras líneas de comentario |
|---|---|---|---|---|
| `scripts/schema-dump-queries.sql` | 8.1 KB | 2026-04-26 | 2026-04-26 | Fase A — Recuperación READ-ONLY del schema real de prod. |
| `supabase/plantillas_danadas_limpieza.sql` | 34.5 KB | 2026-09-10 | 2026-09-10 | PLANTILLAS DAÑADAS · identificar y borrar |

---

## 2 · Clasificación

### (a) MIGRACIÓN APLICADA — 106 archivos

#### a.1 · Los 40 de la raíz (evidencia: `supabase/baseline/`)

Los 43 `supabase_migration_*.sql` menos los 2 seeds y menos el de datos puros
(ver (d) y (e)). Todos cambian esquema y **todos sus objetos aparecen en el
volcado de prod del 2026-04-26**, así que se aplicaron entre el 2026-03-24 y esa
fecha. Comprobaciones concretas que lo cierran:

- Las 13 tablas que crean (`addendums`, `analitos_catalogo`, `appointments`,
  `audit_log`, `calculadora_resultados`, `cat_cie10`, `ip_rate_limits`,
  `medicamentos`, `mediciones_analitos`, `pdf_jobs`, `plantillas_honorarios`,
  `rate_limits`, `solicitudes_arco`) son 13 de las 20 de `02_tables.sql`.
- Las columnas que añaden están en el volcado: `gcal_sync_status`,
  `horario_consulta`, `suspendida`, `tipo`, `stripe_customer_id`, `firma_url`,
  `universidad`, `direccion_consultorio`, `nota_origen`, `activo`, `fecha_baja`,
  `consentimiento_otorgado`, `client_id`, `storage_path`.
- `documentos_tipo_check` en el baseline tiene **exactamente** los 11 valores que
  deja el último archivo de la cadena (§4.1).
- `laboratorios` **no existe** en el baseline → `supabase_migration_labs_drop_legacy.sql`
  corrió. Coincide con `CLAUDE.md` (deuda 6, sub-fase 8C2, 2026-04-23).
- `labs-documentos` está en `09_storage_buckets.sql` →
  `supabase_migration_labs_documentos_upload.sql` corrió (su propia cabecera ya
  lo declara: «ya fue ejecutado manualmente en Supabase (2026-04-22)»).

Lista: `addendums`, `appointments`, `appointments_medico`, `appointments_v2`,
`audit_immutable`, `audit_log`, `calculadoras_resultados`, `cat_cie10_tabla`,
`client_id_idempotency`, `clinicas_suspendida`, `consentimiento`,
`consentimiento_privacidad`, `escrito_medico`, `firma_medico`, `horario`,
`internamiento`, `ip_rate_limits`, `labs_catalogo`, `labs_documentos_tipos`,
`labs_documentos_upload`, `labs_drop_legacy`, `labs_mediciones`,
`labs_trigger_antropometria`, `medicamentos`, `nota_honorarios`, `nota_origen`,
`onboarding`, `pagination_indexes`, `pdf_jobs`, `perfil_medico`,
`plantillas_honorarios`, `rate_limits`, `retencion_expedientes`, `rls`,
`rls_profiles_tokens`, `soft_delete_pacientes`, `solicitudes_arco`,
`storage_documentos_pdf`, `stripe`, `tipo_clinica` (todos con prefijo
`supabase_migration_` y sufijo `.sql`).

> **Una reserva dentro de este grupo:** `supabase_migration_storage_documentos_pdf.sql`
> crea policies sobre `storage.objects`, y el baseline dice explícitamente que
> **las policies de storage no se pudieron volcar** (TODO al final de
> `09_storage_buckets.sql`). El bucket existe y la app sube PDFs desde hace
> meses, así que la evidencia es indirecta pero fuerte. **No comprobada contra
> la base.**

#### a.2 · Los 66 de `supabase/migrations/`

Los 69 del directorio menos los 3 de la categoría (b). Por bloques, con la
evidencia de cada uno:

| Bloque | Archivos | Evidencia de aplicación |
|---|---|---|
| B1 seguridad (2026-04-27) | 3 | `supabase/baseline/README.md` los lista como aplicados, con fecha |
| B2 policies (2026-04-29) | 4 | ídem |
| VIP (2026-04-30) | 1 | ídem, con el detalle del cambio de `max_pacientes` |
| Phase 8.1 + revert (2026-05-03/04) | 2 | `CLAUDE.md` § «Incidentes resueltos», con síntoma y rollback |
| Refactor de roles etapas 0–4.A.8 | 5 | `CLAUDE.md` § 2026-07-18; el latch `ha_tenido_acceso_premium` está vivo |
| Etapa 5.B–5.J + DUP-RPC + fix secretaria | 15 | 17 archivos del repo llevan `-- Aplicado a producción: <fecha>` en cabecera; `CLAUDE.md` tabula las 7 policies RESTRICTIVE en prod con fecha |
| Casos clínicos (2026-06-02) | 1 | `CASOS_CLINICOS_PLAN.md:37` — «se aplicaron 8 piezas», etapa 2 ✅ |
| SEC profiles/storage (2026-06-02/03) | 3 | `CLAUDE.md` cita el trigger guardián como defensa en profundidad viva |
| Consultorios 2.1–2.6 | 6 | cabeceras «(aplicada en prod)»; `CLAUDE.md` tabula `consultorios_gates_insert` aplicada el 2026-06-15 |
| Nombres fases 1, 5.D, 6 | 4 | cabeceras «aplicada a mano en producción»; baseline sincronizado en el mismo commit |
| Expediente 01–03 | 3 | `20260630_expediente_03:26` — «el RPC ya está en producción»; `src/app/api/expediente/listar/route.ts:110` lo llama |
| Billing webhook events | 1 | cabecera `Aplicado a producción: 2026-07-13` |
| APNP + signos vitales | 2 | cabecera `Aplicado a producción: 2026-07-20 / 2026-07-21 vía SQL Editor` |
| Documentos v2 (formato_version, folio 01/03, estado, plantillas, firmas) | 6 | ver nota ↓ |
| gcal calendario propio A y B | 2 | `DEUDA_TECNICA.md:2969` — «aplicada el 2026-08-15» las dos |
| Agenda realtime | 1 | ver §2 reservas |
| gcal conexión clínica A | 1 | cabecera corregida: «APLICADA EN PRODUCCIÓN 2026-08-17» |
| gcal puente de secretos | 1 | cabecera: «APLICADA Y VERIFICADA 2026-08-19», con el `SELECT` sobre `pg_proc` que lo prueba |
| Agenda: attended, evento genérico, `appointment_id`, pinta, `all_day` | 5 | las cinco llevan «APLICADA Y VERIFICADA EN PRODUCCIÓN» con fecha y consulta de comprobación |

**Nota sobre documentos v2** — sus cabeceras dicen `PENDIENTE DE APLICAR` y es
falso en cinco de los seis:

- `20260804_documentos_formato_version.sql` → aplicada
  (`20260813_formato_version_inmutable.sql:13`: la columna existe, 1 080 filas).
- `20260807_folio_01_esquema_y_generador.sql` → aplicada (misma cita, «las de folio»).
- `20260811_folio_03_denegacion.sql` → aplicada (misma cita).
- `20260812_documentos_estado.sql` → aplicada (`20260813_firmas_documento.sql:81`).
- `20260810_plantillas_documento.sql` → **aplicada**, y esto lo cierra este
  inventario: `supabase/plantillas_danadas_limpieza.sql` (2026-09-10) hace
  `DELETE FROM public.plantillas_documento` contra producción. La tabla existe.
  *`DEUDA_TECNICA.md` la tenía como «sin verificar».*
- `20260813_firmas_documento.sql` → **aplicada**, mismo razonamiento:
  `src/components/documentos/FirmadoConsentimiento.tsx:59` escribe en
  `firmas_documento.identificacion_path` desde producción, y
  `src/app/api/documentos/[id]/identificacion/route.ts` sirve el bucket.
  *También constaba como «sin verificar».*

### (b) MIGRACIÓN NO APLICADA O DUDOSA — 3 archivos

| Archivo | Estado | Evidencia |
|---|---|---|
| `supabase/migrations/20260817_gcal_conexion_clinica_b_retiro.sql` | **No aplicada, y a propósito** | Va después del deploy y de un periodo de reposo (su runbook, :12-27). El espejo sigue vivo: `src/lib/gcalConexion.ts:433,490,655` escribe y lee `public.google_tokens`, que es justo la tabla que este archivo mueve a `respaldos`. `DEUDA_TECNICA.md` la marca «pendiente de verdad». |
| `supabase/migrations/20260804_profiles_flag_documentos_v2.sql` | **No aplicada, y abandonada** | `src/lib/mobileShare.ts:105-107`: «`profiles.usa_documentos_v2` existe como migración y **se queda sin aplicar y sin usar**» — el encendido de v2 se decidió global, no por médico. El campo sigue en `src/types/index.ts:245` pero nadie lo consulta. *`DEUDA_TECNICA.md` la tenía como «sin verificar»; esto la resuelve.* |
| `supabase/migrations/20260813_formato_version_inmutable.sql` | **Dudosa — no se puede decidir desde el repo** | `DEUDA_TECNICA.md` la lista «sin verificar». No hay migración posterior que hable de ella, y su efecto (un trigger que congela `formato_version` al emitir) **no es observable desde `src/`**: el propio archivo advierte que el cliente todavía no manda la versión en el UPDATE de emisión, así que el código se ve igual esté aplicada o no. Requiere un `SELECT` contra `pg_trigger` / `pg_get_functiondef('asignar_folio_documento')`. |

### (c) CONSULTA DE TRABAJO — 1 archivo

- `scripts/schema-dump-queries.sql` — 11 bloques `SELECT` sobre
  `information_schema` y `pg_catalog` para reconstruir el esquema de prod
  (Fase A). No modifica nada; su salida es lo que produjo `supabase/baseline/`.

### (d) SEED / DATOS — 2 archivos

- `supabase_migration_cat_cie10_seed.sql` (172 KB) — catálogo CIE-10 en español.
  Requiere `cat_cie10_tabla.sql` aplicado antes.
- `supabase_migration_labs_seed_catalogo.sql` (47 KB) — 175 analitos con rangos
  de referencia mexicanos. Requiere `labs_catalogo.sql` antes.

`supabase/baseline/README.md` ya los trata como seeds y dice aplicarlos **aparte**
del baseline al levantar un entorno nuevo.

> `supabase_migration_medicamentos.sql` (37 KB) es mixto: crea la tabla **y** la
> siembra en el mismo archivo. Queda en (a) porque su parte de esquema es la que
> manda, pero al reorganizar conviene saber que arrastra datos.

### (e) OTRO — 13 archivos

| Archivo(s) | Qué es |
|---|---|
| `supabase/baseline/01..09_*.sql` (9) | **No son migraciones.** Foto reconstructiva del esquema de prod al 2026-04-26, con orden de aplicación propio. Su README lo dice en la primera línea. |
| `supabase_schema.sql` | El esquema fundacional del 2026-03-24, de cuando el proyecto empezó. Está **íntegramente absorbido** por `supabase/baseline/02_tables.sql`. Valor histórico, no operativo. |
| `supabase_migration_independiente_admin.sql` | **No cambia esquema**: es un `UPDATE profiles SET role='admin'` sobre datos productivos. Se aplicó, y además quedó obsoleto — el rol `'admin'` legacy lo eliminó `20260519114652_etapa4a8`. Reaplicarlo hoy escribiría un valor que ya no existe. |
| `supabase/plantillas_danadas_limpieza.sql` | Dos consultas sueltas para el SQL Editor (1 `SELECT` de diagnóstico + 1 `DELETE` de filas basura en `plantillas_documento`). Su propia cabecera: «NO ES UNA MIGRACIÓN Y NO SE APLICA SOLA». |
| `supabase/migrations/descartadas/20260808_folio_02_clases_faltantes.sql` | Migración **retirada a propósito**, sustituida por `20260811_folio_03_denegacion.sql`. Ya está aislada en su subcarpeta, que es exactamente lo correcto. |

---

## 3 · Orden cronológico propuesto (categorías a y b)

El orden real de aplicación está **bien determinado hasta el 2026-04-26** (todo
lo de la raíz ya estaba en prod) y **bien determinado a partir de ahí** (las
migraciones llevan fecha en el nombre). Lo que sigue es el orden en que habría
que replayearlas sobre una base limpia.

### 3.1 · Tramo 1 — la raíz (2026-03-24 → 2026-04-23)

Orden deducido de la fecha del commit de alta. Las dependencias reales que
importan son pocas y están todas respetadas por ese orden:

```
1.  supabase_schema.sql                        2026-03-24   (base: pacientes, consultas, documentos, clinicas, profiles)
2.  supabase_migration_medicamentos.sql        2026-03-27
3.  supabase_migration_pdf_jobs.sql            2026-03-27
4.  supabase_migration_rate_limits.sql         2026-03-27
5.  supabase_migration_rls.sql                 2026-03-27   ← añade pacientes.clinica_id; TODO lo multi-clínica depende de esto
6.  supabase_migration_tipo_clinica.sql        2026-03-27
7.  supabase_migration_perfil_medico.sql       2026-03-28
8.  supabase_migration_escrito_medico.sql      2026-03-29   ← cadena documentos_tipo_check, eslabón 1
9.  supabase_migration_internamiento.sql       2026-03-29   ← eslabón 2
10. supabase_migration_audit_log.sql           2026-04-01
11. supabase_migration_consentimiento.sql      2026-04-01   ← eslabón 3
12. supabase_migration_ip_rate_limits.sql      2026-04-01
13. supabase_migration_rls_profiles_tokens.sql 2026-04-01
14. supabase_migration_stripe.sql              2026-04-01
15. supabase_migration_nota_honorarios.sql     2026-04-02   ← eslabón 4
16. supabase_migration_appointments.sql        2026-04-04   ← crea la tabla
17. supabase_migration_appointments_medico.sql 2026-04-04   ← la altera
18. supabase_migration_appointments_v2.sql     2026-04-04   ← la altera
19. supabase_migration_clinicas_suspendida.sql 2026-04-04
20. supabase_migration_horario.sql             2026-04-04
21. supabase_migration_independiente_admin.sql 2026-04-05   ← datos, no esquema (ver §2e)
22. supabase_migration_soft_delete_pacientes.sql 2026-04-05
23. supabase_migration_retencion_expedientes.sql 2026-04-08 ← CASCADE→RESTRICT; va antes de addendums
24. supabase_migration_addendums.sql           2026-04-08
25. supabase_migration_audit_immutable.sql     2026-04-08   ← requiere audit_log (10)
26. supabase_migration_consentimiento_privacidad.sql 2026-04-08
27. supabase_migration_pagination_indexes.sql  2026-04-08   ⚠ indexa `laboratorios` (ver §4.2)
28. supabase_migration_firma_medico.sql        2026-04-09
29. supabase_migration_nota_origen.sql         2026-04-09
30. supabase_migration_solicitudes_arco.sql    2026-04-09
31. supabase_migration_onboarding.sql          2026-04-10
32. supabase_migration_client_id_idempotency.sql 2026-04-12
33. supabase_migration_plantillas_honorarios.sql 2026-04-16
34. supabase_migration_cat_cie10_tabla.sql     2026-04-17
35. supabase_migration_cat_cie10_seed.sql      2026-04-17   ← seed, requiere 34
36. supabase_migration_storage_documentos_pdf.sql 2026-04-17
37. supabase_migration_calculadoras_resultados.sql 2026-04-19
38. supabase_migration_labs_catalogo.sql       2026-04-21   ← crea analitos_catalogo
39. supabase_migration_labs_mediciones.sql     2026-04-21   ← requiere 38
40. supabase_migration_labs_trigger_antropometria.sql 2026-04-21 ← requiere 39
41. supabase_migration_labs_documentos_tipos.sql 2026-04-21  ← eslabón 5 (el último)
42. supabase_migration_labs_seed_catalogo.sql  2026-04-22   ← seed, requiere 38
43. supabase_migration_labs_documentos_upload.sql 2026-04-22
44. supabase_migration_labs_drop_legacy.sql    2026-04-23   ← DROP TABLE laboratorios
```

**Ambigüedades reales de este tramo** (mismo día, sin dependencia que las
desempate — el orden entre ellas da igual):

- 2026-03-27: (2) (3) (4) (6) entre sí. (5) sí tiene que ir antes que todo lo
  que filtre por `clinica_id`.
- 2026-04-01: (10) (12) (13) (14) entre sí; (11) está fijada por la cadena del
  CHECK.
- 2026-04-04: (19) (20) entre sí, y respecto del grupo de `appointments`.
- 2026-04-08: (24) (25) (26) (27) entre sí, una vez puesto (23) delante.
- 2026-04-09: (28) (29) (30) entre sí.
- 2026-04-21: (41) es independiente de (38)(39)(40); el resto está encadenado.

**Ambigüedad que sí importa:** `supabase_schema.sql` (1) contra el resto. No es
una migración incremental, es el esquema fundacional, y no hay forma de saber
desde el repo qué versión exacta de él corrió primero. En un replay real **lo
correcto es no usarlo**: arrancar de `supabase/baseline/`, que es el esquema
verificado contra prod.

### 3.2 · Tramo 2 — `supabase/migrations/` (2026-04-27 → 2026-08-26)

**Orden alfabético de nombre de archivo = orden cronológico = orden de
aplicación.** Aquí no hay ambigüedad: el prefijo de fecha la resuelve, y las
dependencias declaradas en las cabeceras coinciden con ese orden. Dos matices:

- Los 5 archivos con timestamp de 14 dígitos (etapas 0, 1, 2, 1bis, 4.A.8) se
  ordenan bien entre sí y contra los de 8 dígitos, porque `20260518080301` >
  `20260504` y < `20260519`. **Ojo con `20260518132155_etapa1bis`**: por nombre
  cae *después* de `20260518100645_etapa2`, y es correcto — la 1.bis se escribió
  como corrección posterior, no es un salto de orden.
- **Ambiguo dentro del mismo día, sin consecuencia:** los 3 pares/tríos del
  2026-04-27, 2026-04-29, 2026-05-24, 2026-06-15 y 2026-08-21 comparten fecha.
  En todos ellos el sufijo numérico (`_01`, `_02`, `_bd1`, `_paso3`…) declara el
  orden interno, así que el desempate está escrito.

**Excepciones a insertar en el orden, no al final:**

| Archivo | Dónde va de verdad |
|---|---|
| `20260817_gcal_conexion_clinica_b_retiro.sql` (categoría b) | **El último de todos**, después del deploy del código nuevo y de un periodo de reposo. Su nombre lo coloca antes de `20260818_gcal_puente_secretos.sql`, que ya está aplicada. El propio puente documenta esta inversión y por qué se aceptó (`BRIEF-MIGRACION-PUENTE-SECRETOS.md:216`). **En replay por nombre no rompe** — el puente no referencia `google_tokens`. |
| `20260804_profiles_flag_documentos_v2.sql` (categoría b) | En ningún sitio: abandonada. |
| `20260813_formato_version_inmutable.sql` (categoría b) | Donde su nombre dice, si resulta estar aplicada. Depende de `20260812_documentos_estado.sql`: reescribe `asignar_folio_documento()` entera y si la 812 no estuviera puesta **borraría la máquina de estados** (lo advierte su propia cabecera, :49-53). |
| `descartadas/20260808_folio_02_clases_faltantes.sql` | En ningún sitio: retirada. |

---

## 4 · Conflictos y duplicados

### 4.1 · La cadena de `documentos_tipo_check` — cinco archivos, un solo constraint

Cinco archivos de la raíz hacen `DROP CONSTRAINT documentos_tipo_check` +
`ADD CONSTRAINT` con la lista **completa** de valores, no con un delta:

| # | Archivo | Valores que deja |
|---|---|---|
| 1 | `supabase_migration_escrito_medico.sql` | 7 (incluye un `suplementacion` que luego desaparece) |
| 2 | `supabase_migration_internamiento.sql` | 6 |
| 3 | `supabase_migration_consentimiento.sql` | 8 |
| 4 | `supabase_migration_nota_honorarios.sql` | 9 |
| 5 | `supabase_migration_labs_documentos_tipos.sql` | **11 — coincide con el baseline** |

**No se contradicen: se suceden.** Pero el patrón «cada uno reescribe la lista
entera» significa que **aplicarlos fuera de orden deja el CHECK truncado y sin
error**, y filas nuevas de un tipo válido empiezan a rebotar. El eslabón 5 es
el único que refleja producción.

Dos migraciones posteriores vuelven a tocar el mismo constraint:
`supabase/migrations/20260810_plantillas_documento.sql` y
`20260811_folio_03_denegacion.sql`. Son eslabones 6 y 7 de la misma cadena y
mandan sobre los cinco de la raíz.

> **Regla práctica al reorganizar:** los cinco de la raíz son un bloque
> ordenado. Si alguna vez se colapsan en un solo archivo, el contenido correcto
> es el del eslabón 5.

### 4.2 · Archivos que ya no se pueden replayear sobre una base limpia

| Archivo | Por qué rompe |
|---|---|
| `supabase_migration_pagination_indexes.sql` | Crea `idx_laboratorios_paciente_fecha` sobre `public.laboratorios`, tabla que `labs_drop_legacy` borró. En un replay en orden **funciona** (el índice se crea y luego cae con la tabla); en un replay parcial o sobre el baseline **falla**. |
| `supabase_migration_labs_drop_legacy.sql` | `DROP TABLE laboratorios` sobre una base creada desde `supabase/baseline/`, donde esa tabla ya no existe. |
| `supabase_migration_independiente_admin.sql` | Escribe `role='admin'`, valor eliminado del dominio por `20260519114652_etapa4a8`. |
| `supabase_schema.sql` | Es el esquema de marzo; chocaría con el baseline. |
| `supabase/baseline/04_foreign_keys.sql` | Su propio README lo avisa: Postgres no tiene `ADD CONSTRAINT IF NOT EXISTS`, así que re-correrlo falla con `duplicate_object`. |

### 4.3 · Duplicados y solapamientos reales

| Caso | Qué pasa |
|---|---|
| `supabase_schema.sql` **vs** `supabase/baseline/02_tables.sql` | El segundo es superconjunto verificado del primero. **Duplicado real, con una versión ganadora clara.** |
| `supabase_migration_rls.sql` + `rls_profiles_tokens.sql` **vs** `20260429_b2_01..04` | Las policies que crean los primeros son las «legacy `TO public`» que los segundos eliminan por fuga cross-tenant. **No son duplicados: el segundo grupo deroga al primero.** Replayear la raíz sobre prod reabriría la fuga. |
| `20260503_phase81` **vs** `20260504_revert_phase81` | Par migración/revert, forward-only. Ambos se conservan a propósito (`CLAUDE.md`). |
| `20260808_folio_02` (descartadas) **vs** `20260811_folio_03` | La 03 sustituye a la 02 y la retira. Ya está aislada. |
| `20260524_etapa5e_ts1a_rpc_crear_paciente_con_medico` **vs** `20260524_duprpc_paso1_rpc_v2` | Dos RPC con nombres distintos (`..._con_medico` y `..._con_medico_v2`) que hacen casi lo mismo. **Conviven en prod a propósito** (estrategia V3 de `DUPRPC_PLAN.md`); el código llama solo a la `_v2` (`src/app/api/pacientes/route.ts:136`). La v1 quedó huérfana y su `DROP FUNCTION` es el Paso 4 del plan, **sin hacer y sin archivo de migración que lo represente**. No es un conflicto entre archivos: es un objeto de más en la base. |
| `20260817_gcal_conexion_clinica_a` **vs** su propio texto | La cabecera avisa de que el cuerpo del archivo **dice algo falso** sobre el alcance de `private`, y se conserva así porque es lo que se ejecutó. No tocarlo. |

### 4.4 · Lo que NO es conflicto aunque lo parezca

- Los tres `supabase_migration_appointments*.sql` no son versiones rivales:
  uno crea, dos alteran.
- `20260615_consultorios_05_marcar_default_rpc.sql` lleva sufijo `_05` pero su
  cabecera dice «Migración 2.2-bis». El nombre del archivo manda para el orden.
- `20260624_nombres_02_drop_audit_log_view.sql` borra una vista que
  `supabase/baseline/08_view.sql` ya declara inexistente. Coherente: el baseline
  se sincronizó en el mismo commit.

---

## 5 · Lo que ya está en `supabase/migrations/`

**69 archivos** en la raíz del directorio + **1** en `descartadas/` = 70.

### 5.1 · Convención de nombres del CLI

El CLI de Supabase espera `<YYYYMMDDHHmmss>_nombre.sql` — **14 dígitos**, no 8.
Es lo que compara contra la tabla `supabase_migrations.schema_migrations` para
decidir qué falta por aplicar.

| | Archivos |
|---|---|
| ✅ **Cumplen** (14 dígitos) | **5** |
| ❌ **No cumplen** (8 dígitos: `YYYYMMDD_`) | **64** |

Los 5 que cumplen, y son los únicos:

```
20260518080301_etapa0_limpieza_pre_refactor.sql
20260518083036_etapa1_schema_declarativo.sql
20260518100645_etapa2_limpieza_datos_productivos.sql
20260518132155_etapa1bis_backfill_es_admin_de_clinica.sql
20260519114652_etapa4a8_eliminar_rol_admin_legacy.sql
```

No es casualidad que sean cinco seguidos de mayo: son los que se generaron con
`supabase migration new`. Todos los demás se nombraron a mano.

### 5.2 · Qué pasa exactamente con los 64 que no cumplen

**No es cosmético.** Con `supabase db push` / `supabase migration list`, un
nombre de 8 dígitos **no parsea como versión** y el CLI lo trata como archivo
desconocido: o lo ignora, o aborta. Y aunque parseara, el CLI intentaría
**aplicar las 64 a una base que ya las tiene**, porque la tabla de control local
está vacía.

Dicho sin rodeos: **hoy `supabase db push` contra producción es peligroso**, y
lo será hasta que se rellene `schema_migrations` con las versiones ya aplicadas
(`supabase migration repair --status applied <version>`, uno por archivo).
`supabase db pull` y `supabase start` no tienen ese problema.

### 5.3 · Otras desviaciones dentro del directorio

- `descartadas/` es una subcarpeta. El CLI **recorre solo el nivel raíz** de
  `migrations/`, así que el archivo retirado queda fuera de su alcance. Es el
  comportamiento deseado y no hay que cambiarlo.
- Ninguno de los 64 lleva sufijo de hora, así que **varios comparten fecha**:
  2026-04-27 ×3, 2026-04-29 ×4, 2026-05-21 ×3, 2026-05-24 ×5, 2026-05-30 ×3,
  2026-06-02 ×3, 2026-06-03 ×2, 2026-06-15 ×5, 2026-06-24 ×4, 2026-06-26 ×2,
  2026-08-04 ×2, 2026-08-13 ×2, 2026-08-15 ×2, 2026-08-17 ×2, 2026-08-21 ×3.
  (Los 4 del 2026-05-18/19 también comparten día, pero llevan hora y quedan
  ordenados.) El orden entre los empatados lo resuelve hoy el sufijo semántico;
  al renumerar hay que **preservarlo a mano**.
- `supabase/config.toml` existe desde el commit `ebe09ed` (2026-09-12), con
  `[db.migrations] enabled = true` y `schema_paths = []` — es decir, el CLI ya
  está apuntando a `supabase/migrations/`. `[db.seed]` espera `./seed.sql`, que
  **todavía no existe**.

---

## 6 · Recomendación de reorganización — PROPUESTA, NO EJECUTADA

> Ninguna de estas acciones está hecha. Y **ninguna debería hacerse en la misma
> sesión que la reconciliación de cabeceras** que `DEUDA_TECNICA.md` tiene
> pendiente: mover archivos mientras se corrigen sus rótulos mezcla dos diffs
> que conviene poder leer por separado.

### 6.1 · Decisión de fondo, antes de mover un solo archivo

Hay dos maneras de meter este repo en el CLI, y son incompatibles:

**Opción A — Baseline como migración cero (recomendada).**
Los 44 archivos de la raíz **no se convierten en migraciones**. Se archivan como
historia, y el punto de partida del CLI pasa a ser `supabase/baseline/`
convertido en un único `00000000000000_baseline.sql`.

- *A favor:* el baseline es el **único artefacto verificado contra producción**.
  Los 44 de la raíz nunca fueron replayeables en bloque (§4.2) y algunos ya no
  lo son a ningún precio.
- *En contra:* se pierde la granularidad histórica en el CLI. Se conserva en git.

**Opción B — Renumerar los 44 y meterlos en `migrations/`.**

- *A favor:* historia completa reproducible desde cero.
- *En contra:* hay que **arreglar** `pagination_indexes`, `labs_drop_legacy`,
  `independiente_admin` y la cadena del CHECK para que el replay corra, lo que
  significa **editar archivos ya aplicados** — justo lo que
  `AUDITORIA-MIGRACIONES.md` §7 prohíbe salvo por la excepción de blindaje.

**Recomendación: A.** B compra una historia bonita al precio de tocar lo que no
se toca.

### 6.2 · Qué mover, bajo la opción A

**Se quedan donde están (78 archivos):**

- Los 69 de `supabase/migrations/` y el 1 de `descartadas/`. **No se renombran
  por ahora** — ver 6.4.
- Los 9 de `supabase/baseline/`. Siguen siendo la fuente para el paso 6.3.

**Se archivan — mover a `supabase/historico/` (45 archivos):**

| De | A |
|---|---|
| Los 43 `supabase_migration_*.sql` de la raíz | `supabase/historico/` con el **mismo nombre** |
| `supabase_schema.sql` | `supabase/historico/` |
| `scripts/schema-dump-queries.sql` | `supabase/historico/` |

Sin renombrar: el nombre es lo único que hoy los identifica en los `git log` y
en las referencias que hay repartidas por los `.md`. Con un `README.md` en la
carpeta que diga en una línea que **son historia aplicada y no se replayean**.

> **Salvedad de los dos seeds.** `supabase_migration_cat_cie10_seed.sql` y
> `supabase_migration_labs_seed_catalogo.sql` **no son historia**: se siguen
> necesitando para levantar un entorno nuevo con catálogos, y
> `supabase/baseline/README.md` ya los cita para eso. Van a `supabase/seeds/`,
> renombrados por contenido:
>
> | Hoy | Propuesto |
> |---|---|
> | `supabase_migration_cat_cie10_seed.sql` | `supabase/seeds/01_cat_cie10.sql` |
> | `supabase_migration_labs_seed_catalogo.sql` | `supabase/seeds/02_analitos_catalogo.sql` |
>
> `supabase_migration_medicamentos.sql` es mixto (tabla + datos): se queda en
> `historico/`, y si algún día hace falta el catálogo de medicamentos en local,
> se extrae su bloque de `INSERT` a `supabase/seeds/03_medicamentos.sql` en vez
> de mover el archivo.

**Se queda donde está (1 archivo):**

- `supabase/plantillas_danadas_limpieza.sql`. No es migración ni seed. Si
  molesta suelto, `supabase/consultas/plantillas_danadas_limpieza.sql`, pero
  moverlo es puro gusto.

### 6.3 · El archivo nuevo que hay que crear

```
supabase/migrations/00000000000000_baseline.sql
```

Concatenación de los 9 de `supabase/baseline/` **en el orden que su README ya
fija** (01→09), con dos arreglos obligatorios:

1. `04_foreign_keys.sql` necesita envolver cada `ADD CONSTRAINT` en un
   `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$` o equivalente,
   porque hoy no es idempotente y su propio README lo advierte.
2. Las **policies de `storage.objects` no están en el baseline** y hay que
   recuperarlas del dashboard antes de que este archivo sirva para levantar un
   entorno fiel. Mientras falten, un Supabase local tendrá los 4 buckets sin
   protección.

El timestamp `00000000000000` lo ordena antes que todo. Los 9 originales de
`baseline/` **se quedan** como documentación legible.

### 6.4 · El renombrado de los 64 — hacerlo después, y en su propio commit

Convertir `20260427_b1_01_clinicas_rls.sql` en
`20260427000001_b1_01_clinicas_rls.sql` es mecánico, pero **rompe toda
referencia cruzada del repo**, y hay muchas: `CLAUDE.md` cita 8 migraciones con
nombre y línea, `DEUDA_TECNICA.md` cita más, y varias cabeceras se citan entre
sí. Propuesta concreta:

- **Regla de renumerado:** `YYYYMMDD` + `HHmmss` sintético que **preserve el
  orden semántico del sufijo actual** — `000001`, `000002`, … por orden de
  sufijo (`_01`, `_02`, `_bd1`, `_paso3`…) dentro de cada día. El resto del
  nombre, intacto.
- **Un commit que solo renombra** (`git mv`), sin un byte de contenido cambiado,
  para que el diff sea legible y `git log --follow` siga funcionando.
- **Un segundo commit** que actualiza las referencias en los `.md`.
- **Y `supabase migration repair --status applied` para las 66+5 ya aplicadas**,
  antes de que nadie escriba `supabase db push`. Este paso no es opcional: sin
  él el CLI intentará reaplicarlas.

Ejemplo del renombrado para los primeros y los últimos (el patrón se extiende a
los 64):

| Hoy | Propuesto |
|---|---|
| `20260427_b1_01_clinicas_rls.sql` | `20260427000001_b1_01_clinicas_rls.sql` |
| `20260427_b1_02_sa_functions_role_check.sql` | `20260427000002_b1_02_sa_functions_role_check.sql` |
| `20260427_b1_03_security_definer_search_path.sql` | `20260427000003_b1_03_security_definer_search_path.sql` |
| `20260429_b2_01_drop_legacy_public_policies.sql` | `20260429000001_b2_01_drop_legacy_public_policies.sql` |
| … | … |
| `20260821_agenda_status_attended.sql` | `20260821000001_agenda_status_attended.sql` |
| `20260821_agenda_evento_generico_icono_color.sql` | `20260821000002_agenda_evento_generico_icono_color.sql` |
| `20260821_consultas_appointment_id.sql` | `20260821000003_consultas_appointment_id.sql` |
| `20260822_agenda_pinta_definitiva.sql` | `20260822000001_agenda_pinta_definitiva.sql` |
| `20260826_agenda_all_day.sql` | `20260826000001_agenda_all_day.sql` |

> ⚠️ **El orden del 2026-08-21 no es el alfabético.** Las tres pertenecen a una
> serie numerada en sus propias cabeceras: `status_attended` es «la migración 3»
> (`evento_generico:124` la cita por ese número), `evento_generico` es la 4, y
> `consultas_appointment_id` es «la migración 5» (`status_attended:27,39,79`).
> El alfabético pone `evento_generico` **delante** de `status_attended`, que es
> el orden contrario al real. Es exactamente el tipo de caso que el renumerado
> tiene que resolver a mano, leyendo cabeceras, y no con un script.

### 6.5 · Orden sugerido de ejecución (cuando se decida hacerlo)

1. Sesión de reconciliación de cabeceras (`DEUDA_TECNICA.md`), con la base
   delante. **Primero esto.**
2. `git mv` de los 45 a `supabase/historico/` + 2 seeds a `supabase/seeds/`.
3. Crear `00000000000000_baseline.sql` y recuperar las policies de storage.
4. Renombrado de los 64 (commit propio) + actualización de referencias
   (segundo commit).
5. `supabase migration repair --status applied` para todo lo ya aplicado.
6. Recién entonces, `supabase db push` deja de ser peligroso.

---

## Cierre — cuántos se clasificaron con certeza

**125 archivos clasificados. 120 con certeza, 5 con reserva.**

Los 5 con reserva, y qué haría falta para cerrarlos — todos se resuelven con una
consulta al SQL Editor, ninguno leyendo más el repo:

| Archivo | Duda | Consulta que la cierra |
|---|---|---|
| `supabase_migration_storage_documentos_pdf.sql` | Las policies de storage no están en el baseline; la evidencia de que se aplicó es indirecta | `SELECT polname FROM pg_policy WHERE polrelid = 'storage.objects'::regclass;` |
| `supabase/migrations/20260813_formato_version_inmutable.sql` | `DEUDA_TECNICA.md` la da por «sin verificar» y su efecto no es observable desde `src/` | `SELECT pg_get_functiondef('public.asignar_folio_documento'::regproc);` — buscar si congela `formato_version` |
| `supabase/migrations/20260625_etapa5e_bd2fix_paciente_medico_select_secretaria.sql` | Su cabecera dice `Aplicado a producción: (pendiente)` y nada posterior la menciona | `SELECT qual FROM pg_policies WHERE tablename='paciente_medico' AND policyname='paciente_medico_select';` — buscar la rama de secretaria |
| `supabase/migrations/20260626_expediente_01_indices_listado.sql` | Cabecera `(PENDIENTE — auditoría)`; la 02 del mismo par **sí** está confirmada aplicada | `SELECT indexname FROM pg_indexes WHERE tablename='pacientes';` |
| `supabase/migrations/20260816_agenda_realtime_appointments.sql` | **No lleva rótulo de estado de ningún tipo.** La agenda en tiempo real está cableada en `src/app/(app)/agenda/page.tsx:6935`, lo que sugiere que sí | `SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime';` |

**Dos dudas que este inventario sí cerró**, y que `DEUDA_TECNICA.md` tenía
abiertas como «sin verificar»:

- `20260810_plantillas_documento.sql` → **aplicada** (`supabase/plantillas_danadas_limpieza.sql`
  borra filas de `public.plantillas_documento` en prod, con fecha del 2026-09-10).
- `20260813_firmas_documento.sql` → **aplicada** (código de producción escribe
  en `firmas_documento.identificacion_path`).

Y una que cambió de signo: `20260804_profiles_flag_documentos_v2.sql` no está
«sin verificar» — está **deliberadamente sin aplicar y abandonada**, y quien lo
dice es `src/lib/mobileShare.ts:105`.

