# ETAPA 5 — PLAN DE EJECUCIÓN

> **Estado:** 🟡 En ejecución (sub-paso 5.E + DUP-RPC completados)  
> **Fecha de creación:** 2026-05-20  
> **Última actualización:** 2026-05-26 (sub-paso DUP-RPC completado)  
> **Documentos de referencia:** [ROLES_POST_REFACTOR.md](./ROLES_POST_REFACTOR.md), [DUPRPC_PLAN.md](./DUPRPC_PLAN.md)
>
> Este documento contiene el plan operativo detallado para implementar Etapa 5 del refactor de roles de Spinus, así como el plan post-Etapa 5 para resolver fugas económicas de enforcement de planes.
>
> **Naturaleza del documento:**
> - ROLES_POST_REFACTOR.md → referencia única del modelo (qué debe quedar)
> - ETAPA5_PLAN.md → plan operativo (cómo llegar ahí)
>
> Al cerrar Etapa 5, este documento queda como histórico de ejecución.

---

## Índice

1. [Contexto y objetivos](#1-contexto-y-objetivos)
2. [Hallazgos de investigación](#2-hallazgos-de-investigación)
3. [Decisiones arquitectónicas](#3-decisiones-arquitectónicas)
4. [Scope completo de Etapa 5](#4-scope-completo-de-etapa-5)
5. [Plan de ejecución detallado](#5-plan-de-ejecución-detallado)
6. [Plan post-Etapa 5: monetización](#6-plan-post-etapa-5-monetización)
7. [Riesgos y mitigaciones](#7-riesgos-y-mitigaciones)
8. [Bitácora de ejecución](#8-bitácora-de-ejecución)

---

## 1. Contexto y objetivos

### 1.1 Estado del refactor antes de Etapa 5

Al iniciar la planeación de Etapa 5, el refactor de roles se encuentra en este estado:

| Etapa | Estado | Commit | Descripción |
|---|---|---|---|
| Etapa 0 | ✅ Completada | `c348a71` | Limpieza pre-refactor (DROP client_id, DROP get_max_pacientes) |
| Etapa 1 | ✅ Completada | `0dac996` | Schema declarativo (ADD `es_admin_de_clinica`, `ha_tenido_acceso_premium`) |
| Etapa 1.bis | ✅ Completada | `c8615cd` | Backfill `es_admin_de_clinica=true` para 9 admins productivos |
| Etapa 2 | ✅ Completada | `ba26205` | Limpieza de datos productivos |
| Etapa 3 | ✅ Completada | `895b575` | Fix bugs onboarding + formularios + modal de citas + helper `permissions.ts` |
| Etapa 4.A | ✅ Completada | `b1638b6 → f58577a` | Refactor TypeScript completo + migración BD (eliminado rol `'admin'` legacy) |
| **Etapa 5** | 🟡 **En planeación (este documento)** | — | Reescritura de RLS + privacidad bidireccional + funciones fantasma |
| Etapa 4.B | ⏸️ Diferida | — | Features nuevos super-admin (sin scope formal aún) |
| Etapa 6 | ⏳ Pendiente | — | Cleanup `trial_ends_at`, modificar CHECK `suscripcion_estado` |

**Hotfix aplicado el 2026-05-20:** Sub-paso 5.D ejecutado de forma aislada para resolver un bug crítico de producción (soft delete bloqueado para los 9 admins productivos). Ver Bitácora §8.

### 1.2 Por qué Etapa 5

Etapa 5 es la etapa final de fondo del refactor de roles. Resuelve problemas estructurales que no podían atacarse hasta tener el modelo conceptual cerrado (Etapa 3) y la migración del rol legacy completada (Etapa 4.A).

**Razones principales:**

1. **Implementar invariantes 21, 22 y 23** definidos en `ROLES_POST_REFACTOR.md`:
   - Invariante 21: acceso completo del admin de clínica
   - Invariante 22: privacidad bidireccional entre médicos invitados
   - Invariante 23: distinción entre datos del paciente vs datos generados por médicos

2. **Cerrar el bug productivo de soft delete** que afectaba a los 9 admins productivos (resuelto parcialmente con el hotfix 5.D, pendiente de integrar en el modelo definitivo).

3. **Eliminar las brechas de seguridad descubiertas durante la auditoría de hoy:**
   - Bucket `documentos-pdf` con policies permisivas (acceso cross-clínica)
   - Tabla `consultas` sin `medico_id` (imposibilita privacidad bidireccional)
   - Funciones `SECURITY DEFINER` documentadas que no existen en BD

4. **Preparar el terreno para resolver fugas económicas** (Sección §6) descubiertas en la investigación de enforcement de planes: estado `'vencido'` decorativo, endpoints sin gate de suscripción, columna `suspendida` sin uso funcional.

### 1.3 Objetivos concretos de Etapa 5

Al cerrar Etapa 5, el sistema debe cumplir TODOS estos criterios:

#### Funcionales

- ✅ Médico invitado (rol `medico` + flag `false`) solo ve sus propias consultas, documentos, mediciones y calculadora
- ✅ Médico admin (rol `medico` + flag `true`) ve TODO de su clínica (consultas, documentos, mediciones, calculadora, citas de cualquier médico)
- ✅ Secretaria mantiene visibilidad amplia de pacientes y citas, sin acceso a consultas ni documentos
- ✅ super_admin mantiene acceso administrativo, sin operar como rol médico
- ✅ Soft delete funcional para admin de clínica y super_admin

#### Técnicos

- ✅ Todas las policies SELECT/UPDATE/DELETE de las 8 tablas relevantes reescritas con el modelo nuevo
- ✅ 6 funciones `SECURITY DEFINER` (3 que estaban como fantasma + 3 helpers nuevos)
- ✅ Tabla `consultas` con columna `medico_id` agregada y backfilleada
- ✅ Storage policies del bucket `documentos-pdf` reescritas para discriminar por clínica
- ✅ Policies duplicadas en `profiles` consolidadas
- ✅ Función huérfana `get_suscripcion_estado()` evaluada (mantener o eliminar)

#### Validación

- ✅ Los 11 casos definidos en `ROLES_POST_REFACTOR.md §9` validan correctamente con los 4 roles
- ✅ Smoke test funcional en producción sin regresiones
- ✅ Sin recursión RLS (lección Phase 8.1)

### 1.4 Lo que NO está en alcance de Etapa 5

Para mantener disciplina de scope, **se difiere a etapas posteriores**:

- **Etapa 4.B** (features nuevos super-admin): endpoints para crear usuarios desde dashboard super-admin, mover endpoints ARCO a `/api/super-admin/*`, UI de procesamiento ARCO
- **Etapa 6** (cleanup): DROP `trial_ends_at`, modificar CHECK `suscripcion_estado`, eliminar referencias `'trial'` en 7 archivos TS
- **Plan de monetización** (descrito en §6 de este documento): activar `'vencido'` como bloqueador, activar `'suspendida'` funcionalmente, cerrar 6+ endpoints sin gate, idempotencia Stripe, notificación de pago fallido, contador UI `"N de 5"`

### 1.5 Restricciones operativas

Estas reglas no negociables aplican a TODA la ejecución de Etapa 5:

1. **Cero uso de Supabase CLI contra producción.** Todas las migraciones SQL se aplican vía Supabase Dashboard SQL Editor.
2. **DO blocks atómicos** en lugar de `BEGIN/COMMIT` manual (lección Bitácora #100: el SQL Editor de Supabase puede auto-revertir transacciones manuales).
3. **Snapshot lógico SQL** antes de cualquier cambio estructural en BD.
4. **Backups de Supabase Pro** como capa 3 de respaldo (independiente del flujo manual).
5. **Commits LOCALES como checkpoints** durante el refactor; `push` solo al final de cada sub-paso validado.
6. **Una decisión a la vez:** evitar mezclar varias decisiones críticas en un solo prompt.
7. **Separar investigación de acción con Claude Code:** prompts de investigación (lectura pura) son distintos de prompts de ejecución.
8. **Disciplina de scope:** deuda adyacente descubierta durante ejecución se difiere a etapas posteriores, no se mezcla.

---

## 2. Hallazgos de investigación

Esta sección consolida los hallazgos de tres fuentes complementarias:

1. **Auditoría directa de BD productiva** (4 queries SQL ejecutadas el 2026-05-20)
2. **Reporte de investigación RLS** de Claude Code (lectura del repo + análisis cruzado con BD)
3. **Reporte de investigación enforcement de planes** de Claude Code (descubrimiento de fugas económicas)

El cruce de las tres fuentes valida el panorama y elimina puntos ciegos.

### 2.1 Auditoría de BD productiva

Cuatro queries `READ-ONLY` ejecutadas el 2026-05-20 en Supabase Dashboard SQL Editor:

#### Query 1 — Inventario de policies (28 policies)

Resultado consolidado por tabla:

| Tabla | Policies | Estado |
|---|---|---|
| `profiles` | 4 (2 SELECT duplicadas, 2 UPDATE duplicadas) | 🟡 Limpieza menor |
| `clinicas` | 1 (`clinicas_select_own_or_super_admin`) | 🟢 OK |
| `pacientes` | 5 (insert/update/delete/2× select) | 🔴 1 bug + 2 a reescribir |
| `appointments` | 4 (`clinica_*`) | 🔴 Sin discriminar por médico |
| `consultas` | 4 (`clinica_*`) | 🔴 Sin discriminar + tabla sin `medico_id` |
| `documentos` | 4 (`clinica_*`) | 🔴 Sin discriminar por médico |
| `mediciones_analitos` | 4 (`clinica_*`) | 🔴 Sin discriminar por médico |
| `calculadora_resultados` | 4 (`clinica_*`) | 🔴 Sin discriminar por médico |

**Hallazgo crítico:** TODAS las tablas de datos clínicos (excepto `pacientes`) usan el patrón `EXISTS (paciente WHERE clinica_id = get_clinica_id())` sin filtrar por médico tratante. Esto rompe el invariante 22 (privacidad bidireccional).

#### Query 2 — Funciones SECURITY DEFINER (11 funciones)

| Función | Estado | Uso |
|---|---|---|
| `get_clinica_id()` | 🟢 OK | Helper crítico para todas las RLS |
| `get_my_role()` | 🟢 OK | Helper crítico |
| `get_suscripcion_estado()` | 🟡 Huérfana | Sin call-sites en código TS |
| `log_tabla_change()` | 🟢 OK | Trigger de `audit_log` |
| `prevent_audit_modification()` | 🟢 OK | Garantiza inmutabilidad de `audit_log` |
| `enforce_limite_documentos_paciente()` | 🟢 OK | Trigger: hard limit 100 docs/paciente |
| `sync_antropometria_paciente()` | 🟢 OK | Sincroniza peso/talla/IMC paciente |
| `trg_mediciones_antropometria()` | 🟢 OK | Trigger antropometría |
| `sa_heatmap_horarios()` | 🟢 OK | RPC super-admin dashboard |
| `sa_ranking_funciones()` | 🟢 OK | RPC super-admin dashboard |
| `sa_top_medicos()` | 🟢 OK | RPC super-admin dashboard |
| `sa_uso_ia()` | 🟢 OK | RPC super-admin dashboard |

**Verificación adicional:** las funciones `clinica_dentro_de_limite()`, `clinica_no_suspendida()` y `clinica_tiene_acceso()` mencionadas en `ROLES_POST_REFACTOR.md` **NO existen** en producción (confirmado con query específica que retornó 0 filas). Ver §2.4.

#### Query 3 — Schema de tablas relevantes

Hallazgos críticos del schema:

| Tabla | `medico_id` | `clinica_id` | `paciente_id` | Creador | Estado |
|---|---|---|---|---|---|
| `pacientes` | ✅ NULLABLE | ✅ NULLABLE | — | `medico_id` | 🟢 |
| `appointments` | ✅ NULLABLE | ✅ NOT NULL | ✅ NULLABLE | `created_by` | 🟢 |
| `consultas` | ❌ **NO TIENE** | ❌ **NO TIENE** | ✅ NULLABLE | ❌ **NO TIENE** | 🔴 **BLOQUEADOR** |
| `documentos` | ❌ NO TIENE | ❌ NO TIENE | ✅ NULLABLE | `subido_por` (NULLABLE) | 🟡 |
| `mediciones_analitos` | ❌ NO TIENE | ❌ NO TIENE | ✅ NOT NULL | `creado_por` (NOT NULL) | 🟡 |
| `calculadora_resultados` | ✅ NOT NULL | ✅ NOT NULL | ✅ NOT NULL | `medico_id` | 🟢 |

**Bloqueador identificado:** la tabla `consultas` NO tiene ninguna columna que identifique al médico creador. Solo guarda snapshots (`medico_nombre`, `medico_cedula_*`). Sin `medico_id`, es imposible implementar privacidad bidireccional. **Requiere migración de schema (sub-paso 5.B).**

**Inconsistencia de nomenclatura del creador:**

- `pacientes.medico_id` (médico tratante)
- `appointments.medico_id` + `created_by` (médico de la cita + creador)
- `documentos.subido_por` (creador, NULLABLE)
- `mediciones_analitos.creado_por` (creador, NOT NULL)
- `calculadora_resultados.medico_id` (creador)

Decisión pendiente: ¿unificar a `medico_id` o mantener nombres existentes? Ver §3.

#### Query 4 — Storage buckets + policies

**Buckets configurados:**

| Bucket | Público | Policies | Estado |
|---|---|---|---|
| `documentos-pdf` | 🔒 No | 3 `authenticated_*` permisivas | 🔴 **BRECHA** |
| `clinica-logos` | 🌐 Sí | 0 (acceso público intencional) | 🟢 OK |
| `firmas-medicos` | 🔒 No | 0 (sin policies) | 🟡 Investigar acceso |
| `labs-documentos` | 🔒 No | 4 `_propia_clinica` correctas | 🟢 OK |

**Hallazgo crítico:** el bucket `documentos-pdf` tiene tres policies (`authenticated_select`, `authenticated_insert`, `authenticated_delete`) que solo verifican `bucket_id = 'documentos-pdf'`. Cualquier usuario autenticado puede leer, subir y borrar archivos de **cualquier clínica**.

**Implicaciones:**
- Médico de Clínica A puede descargar PDFs/DICOMs/fotos de Clínica B si conoce el path
- Violación directa de NOM-004-SSA3-2012, LFPDPPP y confidencialidad médico-paciente
- Brecha pre-existente (creada con el bucket el 2026-03-25), no es regresión del refactor
- Debe resolverse en sub-paso 5.K

### 2.2 Reporte de investigación RLS (Claude Code)

Investigación de lectura pura del repo, ejecutada el 2026-05-20. El reporte confirma todos los hallazgos de la auditoría de BD y agrega los siguientes puntos:

#### Decisiones pendientes identificadas (D1-D10)

| Código | Decisión | Tipo |
|---|---|---|
| D1 | ¿Migración monolítica o trozos por tabla? | Operativa |
| D2 | ¿Helpers SECURITY DEFINER en migración separada o misma que policies? | Operativa |
| D3 | ¿Usar policies RESTRICTIVE para gates ortogonales? | Arquitectónica |
| D4 | ¿Orden de implementación entre sub-pasos? | Operativa |
| D5 | ¿Configurar `supabase start` local antes de Etapa 5? | Operativa |
| D6 | ¿Estrategia de rollback granular vs global? | Operativa |
| D7 | ¿Agregar `consultas.medico_id` y backfill? | 🔴 Crítica |
| D8 | ¿Cambiar `TO public` → `TO authenticated` en policies de `profiles`? | Cosmética |
| D9 | ¿Limpiar `get_suscripcion_estado()` huérfana o mantener? | Cosmética |
| D10 | ¿`super_admin` como helper dedicado o `OR` explícito en cada policy? | Arquitectónica |

#### Hallazgos críticos (H1-H12)

| Código | Hallazgo | Severidad |
|---|---|---|
| H1 | Contradicción matriz §2.2 (médico invitado NO ve otros pacientes) vs invariante 23 (datos del paciente visibles a cualquier médico que lo atienda) | 🔴 Crítica |
| H2 | Tabla `consultas` sin `medico_id` ni `clinica_id` ni `created_by` (bloqueador estructural) | 🔴 Crítica |
| H3 | 10+ formularios frontend hacen `INSERT` directo en `documentos` sin pasar por `/api/documentos` ni setear `subido_por` | 🔴 Crítica |
| H5 | Endpoint `POST /api/admin/paciente/[id]/anonimizar` tiene el MISMO bug que el soft delete (resuelto con hotfix 5.D para `pacientes_select_inactivos_admin`, pero anonimizar usa la misma policy) | 🟡 Importante |
| H7 | Policy `pacientes_delete_solo_sin_historial` permite a cualquier médico hard-delete pacientes sin historial; debería restringirse a `super_admin` | 🟡 Importante |
| H10 | Backfill de `consultas.medico_id` legacy es problemático (matching por nombre poco confiable) | 🟡 Decisión tomada: `NULL` para legacy |
| H12 | `get_clinica_id()` retorna `NULL` para `super_admin` por diseño (no tiene `clinica_id` en profile) | 🟢 Informativa |

#### Orden de ejecución propuesto por el reporte

| Sub-paso | Objetivo | Riesgo |
|---|---|---|
| 5.A | Resolver decisiones D1-D10, H1 con usuario | — |
| 5.B | DDL: `consultas.medico_id` + backfill (decisión D7-A) | Alto |
| 5.C | Crear 6 helpers SECURITY DEFINER | Bajo |
| 5.D | Fix mínimo bug soft delete (aislable, hotfix) | Bajo |
| 5.E | Reescribir policies `pacientes` + RESTRICTIVE Phase 8.1 v2 | Alto |
| 5.F | Policies `consultas` (requiere 5.B) | Alto |
| 5.G | Policies `documentos` + auditar 10 formularios | Alto |
| 5.H | Policies `appointments` | Medio |
| 5.I | Policies `mediciones` + `calculadora` + `addendums` | Bajo-medio |
| 5.J | Limpieza `invitaciones`, `profiles`, huérfanas | Bajo |
| 5.K | Validación 11 Casos §9 | — |

**Nota:** este orden será refinado en §5 con el sub-paso adicional para Storage (5.K original renombrado a 5.L) y los ajustes derivados de los hallazgos de enforcement (§2.3).

### 2.3 Reporte de investigación enforcement de planes (Claude Code)

Investigación de lectura pura ejecutada el 2026-05-20 tras identificar que las funciones documentadas pero inexistentes (`clinica_dentro_de_limite`, `clinica_no_suspendida`, `clinica_tiene_acceso`) están conceptualmente ligadas al enforcement de planes de suscripción.

#### 2.3.1 Modelo de negocio confirmado

Spinus tiene 4 estados de cuenta/clínica:

| Estado | Comportamiento esperado |
|---|---|
| **FREE** | Plataforma completa funcional, límite 5 pacientes activos, banner "contratar plan" al intentar paciente #6 |
| **VIP / PAGO ACTIVO** | Sin límites, todas las funciones desbloqueadas |
| **SUSPENDIDA (pago vencido / cancelado)** | BLOQUEO TOTAL: docs, recetas, crear pacientes — afecta a TODOS los usuarios (admin, secretaria, médicos invitados) |
| **DEGRADADA (VIP → Free)** | Comportamiento por definir (¿vuelve a límite de 5? ¿qué pasa con pacientes >5?) |

#### 2.3.2 Estado actual del enforcement (columnas BD)

| Columna en `clinicas` | Tipo | Default | Estado real |
|---|---|---|---|
| `plan` | TEXT | `'free'` | ✅ Validado |
| `suscripcion_estado` | TEXT | `'free'` | ⚠️ `'vencido'` no bloquea nada |
| `stripe_customer_id` / `stripe_subscription_id` / `stripe_price_id` | TEXT | — | ✅ Funcional |
| `trial_ends_at` | TIMESTAMPTZ | `now+14d` | ❌ Inerte, solo cosmético |
| `suscripcion_ends_at` | TIMESTAMPTZ | — | ❌ Solo se muestra, no se valida |
| `max_pacientes` | INT | `5` | ✅ Validado |
| `max_medicos` / `max_secretarias` | INT | — | ✅ Validado |
| `suspendida` | BOOL | `false` | ❌ **DECORATIVA — 0 referencias funcionales** |
| `es_vip_grant` | BOOL | `false` | ✅ Funcional |
| `ha_tenido_acceso_premium` | BOOL | `false` | ⚠️ Backfilleada pero inerte (esperando Etapa 5) |

#### 2.3.3 Hallazgos críticos (C.1-C.8)

| Código | Hallazgo | Severidad | Pérdida estimada |
|---|---|---|---|
| **C.2.a** | `'vencido'` (past_due) NO BLOQUEA nada. Webhook Stripe lo setea pero ningún gate lo valida. Tarjeta declinada = barra libre 1-3 semanas. | 🔴 ALTA | ~$2,240 MXN / clínica Pro / ciclo |
| **C.2.b** | `suspendida` es DECORATIVA. `super_admin` puede setearla pero ningún endpoint, RLS, hook ni componente la consulta. Sin mecanismo anti-fraude. | 🔴 ALTA | Anti-fraude bloqueado |
| **C.2.d** | 6+ endpoints CRUD sin gate de suscripción: `/api/labs/mediciones`, `/api/consultas/[id]/addendum`, PUT `/api/pacientes/[id]`, `/api/email/enviar-documento`, `/api/nota-medica`, `/api/consulta-rapida` (IA gratis), 9 formularios frontend con INSERT directo a `documentos` saltándose `/api/documentos`, `GuardarExpedienteBtn.tsx:34` INSERT directo a `calculadora_resultados` | 🔴 ALTA | Servicios gratis ilimitados |
| **C.2.e** | Sin RLS de respaldo (Phase 8.1 v2 fue revertida por recursión). Toda la validación depende de TypeScript. | 🔴 ALTA | Backend-only enforcement |
| **C.4.a** | Stripe sin idempotencia explícita. `event.id` no verificado contra tabla de eventos procesados. Posible doble procesamiento en retries. | 🟡 BAJA | Mitigado por UPDATEs idempotentes |
| **C.4.b** | `invoice.payment_failed` solo cambia estado, no notifica al usuario. Usuario no sabe que su pago falló. | 🟡 MEDIA | UX comercial degradada |
| **C.3** | Conteo de pacientes para el tope incluye soft-deleted. ⚠️ **REVERTIDO (Camino 2, 2026-05-22):** contar el total (activos + soft-deleted) es el comportamiento DESEADO, no un bug — borrar no debe liberar cupo (cierra el bucle de abuso crear/borrar/crear). Ver nota en §6.1. | 🟢 Por diseño | Cierra fuga |
| **C.5** | Sin contador UI "N de 5" pacientes. Usuario se topa con 403 sin aviso previo. | 🟡 UX | Conversión perdida |

#### 2.3.4 Predicado único de bloqueo (estado actual)

Ubicación: `src/lib/subscription.ts:62-136`

```typescript
isBlocked = (
  suscripcion_estado === 'cancelado' 
  AND !es_vip_grant 
  AND count_pacientes_activos > 5
)
```

**Observaciones:**

- Cubre solo `'cancelado'`, NO cubre `'vencido'`
- Solo se invoca en 4 endpoints: `POST /api/pacientes`, `/api/consultas`, `/api/documentos`, `/api/appointments`
- Los demás endpoints CRUD ignoran este predicado
- Sin respaldo en RLS (validación únicamente en TS)

#### 2.3.5 Implicación crítica para Etapa 5

> ⚠️ **Si Etapa 5 se ejecuta tal como está planeada actualmente:**
>
> - ✅ Cierra C.2.b (suspendida), C.2.d (endpoints CRUD), C.2.e (RLS respaldo) — vía `clinica_no_suspendida()` + `clinica_tiene_acceso()` + RLS RESTRICTIVE
> - ❌ **NO cierra C.2.a (vencido)** — el predicado planeado solo cubre `cancelado`
> - ❌ NO cierra C.4.a, C.4.b, C.5 — son problemas ortogonales
> - ✅ C.3 quedó resuelto por diseño en 5.C (Camino 2): `clinica_dentro_de_limite()` cuenta el total a propósito (ver §6.1)
>
> **Acción requerida durante Etapa 5:** añadir `'vencido'` al predicado de `clinica_tiene_acceso()` para que la RLS lo enforce automáticamente, sin esperar a la sección §6 del documento.

### 2.4 Funciones SECURITY DEFINER inexistentes (fantasma)

Tres funciones documentadas en `ROLES_POST_REFACTOR.md` (apéndice) pero **no existen en producción** (verificado en BD el 2026-05-20).

#### 2.4.1 Mapeo función → necesidad real

| Función documentada | Existe en BD | Propósito real (post-investigación) | Necesidad para Etapa 5 |
|---|---|---|---|
| `clinica_dentro_de_limite()` | ❌ No | Verificar si una clínica respeta `max_pacientes`, `max_medicos`, `max_secretarias`. Necesaria para enforce del límite de 5 pacientes free en RLS (no solo en endpoint TS). | ✅ Crear |
| `clinica_no_suspendida()` | ❌ No | Verificar si una clínica NO tiene `suspendida=true` Y `suscripcion_estado` no es bloqueante. Necesaria para enforce del bloqueo total en RLS. | ✅ Crear |
| `clinica_tiene_acceso()` | ❌ No | Phase 8.1 v2: verificar si la clínica tiene acceso completo según historial premium + estado actual. Usar `ha_tenido_acceso_premium` declarativa para evitar la recursión que mató Phase 8.1 v1. | ✅ Crear |

#### 2.4.2 Helpers adicionales propuestos para Etapa 5

Además de las 3 fantasma, el reporte de RLS sugiere 2 helpers nuevos:

| Función nueva | Propósito | Uso en RLS |
|---|---|---|
| `soy_admin_de_clinica()` returns boolean | Centraliza el check `(role='medico' AND es_admin_de_clinica=true)`. Evita duplicar la lógica en ~20-30 policies. | Visibilidad amplia del admin sobre datos generados por otros médicos de su clínica |
| `paciente_pertenece_a_mi_clinica(paciente_id uuid)` returns boolean | Verificar si un paciente pertenece a la clínica del usuario actual. Útil para policies de `consultas`, `documentos`, `mediciones` que validan permiso vía el paciente referenciado. | Validación de permiso para datos clínicos vinculados a un paciente |

#### 2.4.3 Total: 6 funciones SECURITY DEFINER a crear en sub-paso 5.C

```
🆕 clinica_dentro_de_limite()         — enforce de límites (incluye 5 pacientes free)
🆕 clinica_no_suspendida()            — enforce de suspensión
🆕 clinica_tiene_acceso()             — Phase 8.1 v2 con declarativa
🆕 soy_admin_de_clinica()             — helper admin de clínica
🆕 paciente_pertenece_a_mi_clinica()  — helper validación vía paciente
```

**Estrategia:** todas se crean en el mismo sub-paso 5.C (atómico, antes de tocar policies). Sin estas funciones, las RLS nuevas duplicarían lógica y serían propensas a errores.

#### 2.4.4 Lección Phase 8.1 (a aplicar en 5.C)

Phase 8.1 v1 (intento previo de implementar `clinica_tiene_acceso`) fue revertida por **recursión silenciosa**: hacía `SELECT count(*) FROM pacientes` dentro de un policy de `pacientes`, lo que generó loops infinitos detectados 24 horas después.

**Patrones a evitar:**
- Auto-referencia tabla X dentro de policy de X
- `PERMISSIVE` + `OR` que diluye una `RESTRICTIVE`
- Funciones no-DEFINER que tocan tabla restringida

**Patrones a usar:**
- Helpers `SECURITY DEFINER STABLE` sobre tablas distintas a la restringida
- Columnas declarativas en tabla padre (`clinicas.ha_tenido_acceso_premium`)
- `RESTRICTIVE` para gates ortogonales (suspensión, límite)

---

## 3. Decisiones arquitectónicas

Esta sección documenta las decisiones que afectan el diseño técnico de Etapa 5. Las decisiones tomadas se ejecutan tal cual; las pendientes deben resolverse antes del sub-paso 5.B (DDL).

### 3.1 Decisiones tomadas

#### D-T1: Backfill de `consultas.medico_id` para legacy

**Decisión:** las consultas existentes (legacy) quedarán con `medico_id = NULL` después del backfill. NO se intentará inferir el médico creador desde audit_log ni desde `pacientes.medico_id`.

**Razones:**

1. **Simplicidad:** ningún backfill arbitrario es 100% confiable. Audit log no garantiza que el `INSERT` siempre quedó registrado; `pacientes.medico_id` puede haber cambiado desde la consulta original.
2. **Semántica clara:** `medico_id = NULL` significa "consulta huérfana sin propietario identificable". El modelo de policies tratará este caso como "visible solo para admin de clínica" (consistente con invariante 21).
3. **Seguridad por defecto:** los médicos invitados NO podrán ver consultas legacy sin propietario (mejor que asignar incorrectamente y exponer datos).
4. **Reversibilidad:** si en el futuro se decide hacer backfill basado en evidencia, no hay datos corruptos que limpiar.

**Implicación operativa:** las policies de `consultas` deben manejar explícitamente el caso `medico_id IS NULL` (solo admin de clínica y `super_admin` lo ven).

#### D-T2: Bug soft delete resuelto vía hotfix 5.D (aplicado el 2026-05-20)

**Decisión:** el bug productivo de soft delete se resolvió de forma aislada con un `ALTER POLICY` quirúrgico antes de la planeación completa de Etapa 5.

**Razones:**

1. Bug **activo** afectando a los 9 admins productivos.
2. Fix mínimo y aislable (un solo `DROP POLICY` + `CREATE POLICY` en un `DO` block atómico).
3. No requería decisiones arquitectónicas grandes.
4. Permitió desbloquear a los usuarios mientras se planeaba Etapa 5 con calma.

**Estado:** ✅ Aplicado en producción. Smoke test confirmado. Ver Bitácora §8.

**Deuda pendiente:** registrar el cambio como migración en `supabase/migrations/` para que el repo refleje el estado real de la BD.

#### D-T3: Documento separado para plan de ejecución

**Decisión:** crear `ETAPA5_PLAN.md` como documento operativo separado, en lugar de extender `ROLES_POST_REFACTOR.md`.

**Razones:**

1. `ROLES_POST_REFACTOR.md` ya tiene 1119 líneas; mezclar plan operativo lo haría inmanejable.
2. Separación de responsabilidades: el documento de referencia describe **qué debe quedar**; el plan describe **cómo llegar**.
3. Al cerrar Etapa 5, este documento queda como histórico sin contaminar la referencia.
4. Patrón ya validado en proyectos previos (ej. `LABS_REDISEÑO_PLAN.md`).

#### D-T4: Monetización incluida como Sección 6 del mismo documento

**Decisión:** el plan de corrección de fugas económicas (descubierto en §2.3) se incluye como Sección 6 de este documento, NO en archivo separado.

**Razones:**

1. Contexto unificado: quien lea ETAPA5_PLAN.md ve el panorama completo (refactor de roles + monetización pendiente).
2. Continuidad lógica: "después de Etapa 5 → resolver monetización" es secuencia natural.
3. Decisiones cruzadas (ej. añadir `'vencido'` al predicado de `clinica_tiene_acceso()` durante Etapa 5) quedan documentadas en un solo lugar.

#### D-T5: Modelo muchos-a-muchos para la relación paciente ↔ médico

**Decisión:** la visibilidad de pacientes se modela como una relación muchos-a-muchos mediante una tabla de unión nueva, `paciente_medico`. La columna `pacientes.medico_id` se conserva, pero se reinterpreta: pasa de "médico tratante único" a "médico que creó el registro del paciente" (dato de auditoría/origen).

**Contexto:** el modelo conceptual revisado el 2026-05-21 (diagrama de flujo del autor) estableció que un paciente puede ser atendido por varios médicos de la misma clínica. La columna única `pacientes.medico_id` no puede representar esto. Además, la auditoría de 5.A reveló que la visibilidad de pacientes HOY no depende de `medico_id` en absoluto (depende solo de `clinica_id`); la única policy que filtraba por médico fue eliminada el 2026-04-29.

**Modelo resultante:**

- `pacientes.medico_id` → médico que CREÓ el registro (auditoría, sin rol en visibilidad).
- Tabla `paciente_medico` (paciente_id, medico_id) → médicos que ATIENDEN al paciente; es la base de la visibilidad.
- Al crear un paciente, se inserta una fila inicial en `paciente_medico` con el médico asignado. Médicos adicionales se agregan después.

**Visibilidad de pacientes resultante (resuelve H1):**

- Médico invitado → solo pacientes con los que existe pareja en `paciente_medico`.
- Médico admin de clínica → todos los pacientes de su clínica (+ filtro UI opcional).
- Secretaria → todos los pacientes de su clínica (los gestiona, no es médico tratante).
- super_admin → según su lógica administrativa.

**Razones:**

1. Es el único modelo que cumple el diagrama conceptual del autor (paciente compartido entre médicos).
2. La alternativa "visibilidad derivada de consultas/documentos" falla con el paciente recién creado sin datos generados aún (quedaría invisible).
3. Conservar `pacientes.medico_id` como "creador" preserva el dato de origen (útil para NOM-004) sin coste: el backfill copia el valor actual como primera fila de `paciente_medico`.

**Implicación operativa — cambio de comportamiento:** tras Etapa 5, un médico invitado dejará de ver todos los pacientes de la clínica y verá solo los suyos. Es un cambio funcional visible, confirmado conscientemente por el autor.

**Implicación operativa — puntos de integración:**

- `src/app/api/pacientes/route.ts` (creación de pacientes) debe insertar la fila inicial en `paciente_medico`.
- Las métricas de super-admin que atribuyen 1 paciente → 1 médico (`metricas/route.ts`, `dashboard/usuarios/route.ts`) deben ajustarse al modelo M:N.

#### D-T6: Ejecución directa a producción con protocolo de 9 pasos (resuelve D5)

**Decisión:** Etapa 5 se ejecuta directamente sobre la base de datos productiva, sin entorno de pruebas dedicado (ni Supabase local ni branching). Cada sub-paso se aplica bajo un protocolo estricto de 9 pasos.

**Razones:**

1. El flujo de ejecución directa con `DO` blocks atómicos + snapshot lógico + backups Pro ya fue validado en Etapa 4.A sin incidentes.
2. Spinus está en beta con un cohort reducido; el riesgo está acotado.
3. El protocolo de 9 pasos (especialmente la simulación de predicados READ-ONLY) sustituye parcialmente la función de un entorno de pruebas.

**Protocolo de 9 pasos por sub-paso de BD:**

1. Investigación con Claude Code (lectura pura) → diseñar el SQL exacto.
2. Escribir DOS scripts: el UP (migración) y el DOWN (rollback). El rollback se escribe ANTES de aplicar, nunca se improvisa.
3. Para policies: simular el predicado con `SELECT` READ-ONLY, sustituyendo `auth.uid()` por un UUID real de prueba, para validar la lógica antes de crear la policy.
4. Snapshot lógico del estado actual (`pg_policies` / `pg_proc` / schema).
5. Aplicar el UP vía `DO` block atómico con pre-flight + post-flight checks.
6. Verificación SQL post-aplicación.
7. Smoke test funcional en producción con cuentas reales de los 4 roles.
8. Si OK → commit checkpoint. Si falla → rollback (DOWN, capa 1) o backup (capa 3).
9. Solo entonces pasar al siguiente sub-paso.

**Riesgo reconocido:** sin entorno aislado, un error de lógica en una policy podría manifestarse en producción. Mitigación principal: el paso 3 (simulación de predicado) y el paso 2 (rollback pre-escrito). Los sub-pasos de alto riesgo (5.B, 5.E, 5.F, 5.G) reciben smoke test extendido en el paso 7.

### 3.2 Decisiones pendientes

> ✅ **TODAS RESUELTAS el 2026-05-21 (sub-paso 5.A cerrado).**
>
> El detalle de cada decisión (contexto, opciones evaluadas, recomendación) se conserva abajo como registro histórico del razonamiento. La resolución final de cada una está en la tabla siguiente.

**Resumen de resoluciones:**

| Decisión | Resolución | Notas |
|---|---|---|
| D7 | **D7-A** | Agregar `consultas.medico_id uuid REFERENCES profiles(id)`, backfill `NULL` para legacy. Ver D-T1 y §5.B. |
| H1 | **Resuelta vía modelo M:N** | Reemplaza la opción H1-B original. Médico invitado ve pacientes vía tabla `paciente_medico` (no vía `pacientes.medico_id`). Ver D-T5. |
| D5 | **D5-B** | Ejecución directa a producción con protocolo de 9 pasos. Ver D-T6. |
| D1 | **D1-B** | Una migración versionada por sub-paso. |
| D2 | **D2-A** | Sub-paso 5.C dedicado a crear los helpers antes de las policies. |
| D3 | **D3-A** | `RESTRICTIVE` para gates ortogonales (suspensión, límite de plan). |
| D4 | **Confirmado** | Orden del plan: 5.B→5.C→5.E→DUP-RPC→5.F→5.G→5.H→5.I→5.J→5.K→5.L. |
| D6 | **D6-C** | Rollback en 3 capas (snapshot lógico + `DO` block + backup Pro). |
| D8 | **Sí** | `profiles`: cambiar `TO public` → `TO authenticated`. |
| D9 | **Mantener** | `get_suscripcion_estado()` se conserva (útil para monetización §6 / auditoría). |
| D10 | **OR explícito** | `super_admin` se maneja con `OR get_my_role() = 'super_admin'` explícito en cada policy. |
| Nomenclatura | **N-C** | NO se renombran `documentos.subido_por` ni `mediciones_analitos.creado_por`. Solo se agrega `medico_id` a `consultas`. |

> **Nota sobre H1:** la recomendación original era H1-B (`pacientes.medico_id = auth.uid()`). Fue superada por el modelo muchos-a-muchos (D-T5): la auditoría de 5.A reveló que `pacientes.medico_id` no interviene en la visibilidad actual, y el diagrama conceptual del autor estableció que un paciente puede tener varios médicos. La definición final de "médico atiende a paciente" es: **existe una pareja (paciente, médico) en la tabla `paciente_medico`.**

---

#### 🔴 Críticas (bloquean diseño)

##### D7: ¿Agregar `consultas.medico_id` y cómo?

**Contexto:** la tabla `consultas` no tiene ninguna forma de identificar al médico creador (ver §2.1 Query 3). Sin esta columna, es imposible implementar el invariante 22 (privacidad bidireccional).

**Opciones:**

- **D7-A:** Agregar columna `medico_id uuid REFERENCES profiles(id)` y backfill con `NULL` (decisión D-T1 ya tomada). Endpoints futuros deben setear `medico_id = auth.uid()` al crear consultas.
- **D7-B:** Usar otra estrategia (ej. tabla relacional `consulta_medicos`, más compleja).
- **D7-C:** No agregar columna y aceptar que `consultas` queda como visibilidad amplia por clínica.

**Recomendación:** D7-A. Es la opción más simple y alineada con el modelo de las otras tablas.

##### H1: ¿Qué significa "médico atiende a paciente"?

**Contexto:** contradicción detectada entre dos partes del documento:

- **Matriz `ROLES_POST_REFACTOR.md §2.2`:** médico invitado ❌ NO ve otros pacientes (solo los suyos)
- **Invariante 23:** datos del paciente visibles a "cualquier médico que lo atienda"

**Opciones de definición de "atender":**

- **H1-A:** Médico invitado solo ve pacientes donde él aparece en alguna consulta/cita/medición creada por él.
- **H1-B:** Médico invitado solo ve pacientes asignados a él (`pacientes.medico_id = auth.uid()`).
- **H1-C:** Médico invitado ve cualquier paciente de su clínica (rechazado: contradice matriz §2.2).
- **H1-D:** Otra definición.

**Recomendación:** H1-B. Es la lectura más estricta y compatible con el patrón "médico tratante principal" ya implementado en `pacientes.medico_id`.

##### D5: ¿Configurar Supabase local antes de Etapa 5?

**Contexto:** actualmente todas las migraciones van directo a producción. No hay entorno de pruebas para validar policies antes de aplicarlas.

**Opciones:**

- **D5-A:** Configurar `supabase start` local con dump de schema productivo. Testear policies localmente antes de cada sub-paso. Sumar 1-2 horas de setup inicial.
- **D5-B:** Mantener flujo actual (directo a prod). Confiar en `DO` blocks atómicos + backups Pro como red de seguridad. Asumir riesgo más alto.

**Recomendación:** D5-A. Etapa 5 toca seguridad de BD productiva con cambios complejos. El costo de setup es bajo comparado con el riesgo de un bug RLS en producción.

#### 🟡 Operativas (afectan ejecución pero no diseño)

##### D1: ¿Migración monolítica o trozos por tabla?

- **D1-A:** Una migración SQL grande con todas las policies en un solo `DO` block.
- **D1-B:** Una migración por sub-paso (5.B, 5.C, 5.E, 5.F, etc.).

**Recomendación:** D1-B. Cada sub-paso queda como una migración versionada en `supabase/migrations/`, facilitando rollback granular y trazabilidad.

##### D2: ¿Helpers `SECURITY DEFINER` en migración separada o misma que policies?

- **D2-A:** Sub-paso 5.C dedicado solo a crear las 6 funciones, antes de tocar policies.
- **D2-B:** Crear funciones en la misma migración que las policies que las usan.

**Recomendación:** D2-A. Crear todas las funciones antes evita problemas de dependencia y permite testearlas individualmente.

##### D3: ¿Usar policies RESTRICTIVE para gates ortogonales?

**Contexto:** Phase 8.1 v1 falló por usar PERMISSIVE+OR que diluyó la intención. Las policies RESTRICTIVE se combinan con AND y son más estrictas.

- **D3-A:** Usar RESTRICTIVE para gates de suspensión, límite de plan y bloqueo total.
- **D3-B:** Usar solo PERMISSIVE y consolidar lógica en helpers.

**Recomendación:** D3-A. Aplicable específicamente para `clinica_no_suspendida()` y `clinica_tiene_acceso()` como gates universales.

##### D4: ¿Orden exacto de ejecución entre sub-pasos?

El orden propuesto por el reporte de Claude Code es: 5.B → 5.C → 5.E → DUP-RPC → 5.F → 5.G → 5.H → 5.I → 5.J → 5.K (Storage) → 5.L (validación).

**Recomendación:** mantener este orden con ajuste:
1. **5.B antes:** DDL bloquea todo lo demás (consultas necesita medico_id).
2. **5.C después de 5.B:** las funciones helper pueden referenciar el nuevo schema.
3. **5.E primero entre las policies:** `pacientes` es la tabla base que las demás referencian.
4. **5.K (Storage) antes de 5.L:** la validación final debe incluir Storage.

##### D6: ¿Estrategia de rollback?

- **D6-A:** Rollback granular por sub-paso (cada migración tiene su `DOWN` script).
- **D6-B:** Solo rollback global vía backup Supabase Pro.
- **D6-C:** Combinación: rollback granular para BD + backup global como red.

**Recomendación:** D6-C.

#### 🟢 Cosméticas (limpieza menor, no críticas)

##### D8: ¿Cambiar `TO public` → `TO authenticated` en policies de `profiles`?

**Recomendación:** Sí, incluir en sub-paso 5.J (limpieza). Es buena práctica explicitar la audiencia de cada policy.

##### D9: ¿Limpiar `get_suscripcion_estado()` huérfana o mantener?

**Contexto:** función `SECURITY DEFINER` que retorna `suscripcion_estado`, pero sin call-sites en código TS (Query 2 confirmó esto).

**Recomendación:** mantener por ahora. Útil para Etapa 6 (monetización) o para queries de auditoría desde SQL Editor. Incluir nota en sub-paso 5.J.

##### D10: ¿`super_admin` como helper dedicado o `OR` explícito en cada policy?

**Recomendación:** mantener `OR get_my_role() = 'super_admin'` explícito en cada policy. Mayor legibilidad, sin overhead de función adicional.

#### Nomenclatura de columnas de creador (decisión nueva post-investigación)

**Contexto:** la auditoría reveló inconsistencia (§2.1 Query 3):

- `pacientes.medico_id` (médico tratante)
- `appointments.medico_id` + `appointments.created_by`
- `documentos.subido_por` (NULLABLE)
- `mediciones_analitos.creado_por` (NOT NULL)
- `calculadora_resultados.medico_id` (NOT NULL)

**Opciones:**

- **N-A:** Unificar todo a `medico_id`. Requiere `ALTER TABLE ... RENAME COLUMN` en `documentos` y `mediciones_analitos`. Afecta endpoints TS que usan los nombres actuales.
- **N-B:** Mantener nombres existentes. `subido_por` y `creado_por` son semánticamente correctos. Las RLS pueden manejar la diferencia internamente.
- **N-C:** Solo agregar `medico_id` a `consultas` (decisión D7). NO renombrar las demás.

**Recomendación:** N-C. Mínimo cambio, sin afectar código TS existente. La inconsistencia de nomenclatura es deuda menor aceptable.

---

## 4. Scope completo de Etapa 5

Esta sección inventaría TODO lo que Etapa 5 va a tocar. Sirve como checklist maestro: ningún elemento listado aquí queda fuera del alcance.

> **Nota sobre completitud:** algunos inventarios están marcados como "pendiente de auditar en sub-paso X". Esto es deliberado: la investigación de hoy fue exhaustiva en BD productiva y RLS, pero ciertos detalles del código TS requieren un barrido adicional que se hará en el sub-paso correspondiente.

### 4.1 Inventario de tablas afectadas

| Tabla | Tipo de cambio en Etapa 5 | Sub-paso |
|---|---|---|
| `pacientes` | Reescribir 2 policies SELECT + ajustar INSERT/UPDATE/DELETE | 5.E |
| `consultas` | ⚠️ Migración schema (ADD `medico_id`) + reescribir 4 policies | 5.B + 5.F |
| `paciente_medico` | 🆕 CREAR tabla de unión M:N (decisión D-T5) + backfill desde `pacientes.medico_id` | 5.B |
| `documentos` | Reescribir 4 policies + auditar formularios frontend | 5.G |
| `appointments` | Reescribir 4 policies (discriminar por médico) | 5.H |
| `mediciones_analitos` | Reescribir 4 policies | 5.I |
| `calculadora_resultados` | Reescribir 4 policies | 5.I |
| `addendums` | ⚠️ Tabla mencionada en reportes pero NO auditada. Pendiente de auditar schema y policies | 5.A (auditar) → 5.I |
| `profiles` | Consolidar policies duplicadas (2 SELECT, 2 UPDATE) + `TO public`→`TO authenticated` | 5.J |
| `invitaciones` | Agregar gate `soy_admin_de_clinica()` a policies `admin_*` | 5.J |
| `clinicas` | Sin cambios (policy `clinicas_select_own_or_super_admin` 🟢 OK) | — |
| `storage.objects` | Reescribir 3 policies del bucket `documentos-pdf` | 5.K |

**Pendiente de confirmar en 5.A:** la tabla `addendums` aparece en el reporte de RLS pero NO fue incluida en las queries de auditoría del 2026-05-20. Antes del sub-paso 5.I se debe ejecutar una query READ-ONLY para obtener su schema y sus policies actuales.

### 4.2 Inventario de policies a reescribir

Total: **28 policies de tablas** auditadas (Query 1) + **3 policies de Storage** (Query 4) = **31 policies**.

#### Policies que se REESCRIBEN (lógica nueva)

| Tabla | Policy | Cmd | Razón |
|---|---|---|---|
| `pacientes` | `pacientes_select_activos` | SELECT | Agregar discriminación por médico (invariante 22-23) |
| `pacientes` | `pacientes_select_inactivos_admin` | SELECT | Ya parcialmente arreglada por hotfix 5.D; integrar al modelo definitivo |
| `pacientes` | `clinica_insert` | INSERT | Agregar gates de suscripción (límite, suspensión) |
| `pacientes` | `clinica_update` | UPDATE | Agregar discriminación por médico + rol |
| `consultas` | `clinica_select` | SELECT | Reescritura total: privacidad bidireccional (requiere `medico_id`) |
| `consultas` | `clinica_insert` | INSERT | Setear validación de `medico_id` |
| `consultas` | `clinica_update` | UPDATE | Privacidad bidireccional |
| `consultas` | `clinica_delete` | DELETE | Privacidad bidireccional |
| `documentos` | `clinica_select` | SELECT | Privacidad bidireccional (vía `subido_por`) |
| `documentos` | `clinica_insert` | INSERT | Validación de `subido_por` |
| `documentos` | `clinica_update` | UPDATE | Privacidad bidireccional |
| `documentos` | `clinica_delete` | DELETE | Privacidad bidireccional |
| `appointments` | `clinica_select` | SELECT | Médico invitado solo ve sus citas |
| `appointments` | `clinica_insert` | INSERT | Gate de suscripción |
| `appointments` | `clinica_update` | UPDATE | Discriminación por médico |
| `appointments` | `clinica_delete` | DELETE | Discriminación por médico |
| `mediciones_analitos` | `clinica_select` | SELECT | Privacidad bidireccional (vía `creado_por`) |
| `mediciones_analitos` | `clinica_insert` | INSERT | Validación |
| `mediciones_analitos` | `clinica_update` | UPDATE | Privacidad bidireccional |
| `mediciones_analitos` | `clinica_delete` | DELETE | Privacidad bidireccional |
| `calculadora_resultados` | `clinica_select` | SELECT | Privacidad bidireccional (vía `medico_id`) |
| `calculadora_resultados` | `clinica_insert` | INSERT | Validación |
| `calculadora_resultados` | `clinica_update` | UPDATE | Privacidad bidireccional |
| `calculadora_resultados` | `clinica_delete` | DELETE | Privacidad bidireccional |
| `storage.objects` | `authenticated_select` | SELECT | Restringir por clínica (bucket `documentos-pdf`) |
| `storage.objects` | `authenticated_insert` | INSERT | Restringir por clínica |
| `storage.objects` | `authenticated_delete` | DELETE | Restringir por clínica |

#### Policies que se AJUSTAN (cambio menor)

| Tabla | Policy | Cmd | Razón |
|---|---|---|---|
| `pacientes` | `pacientes_delete_solo_sin_historial` | DELETE | Restringir a `super_admin` (hallazgo H7) |
| `profiles` | `Ver perfiles de la misma clinica` + `profiles_select_own` | SELECT | Consolidar duplicadas en una sola |
| `profiles` | `Actualizar propio perfil` + `profiles_update_own` | UPDATE | Consolidar duplicadas en una sola |
| `invitaciones` | `admin_*` | varias | Agregar gate `soy_admin_de_clinica()` |

#### Policies que NO se tocan

| Tabla | Policy | Razón |
|---|---|---|
| `clinicas` | `clinicas_select_own_or_super_admin` | 🟢 Ya correcta |
| `audit_log` | `audit_super_admin_select` | 🟢 Ya correcta |

### 4.3 Inventario de funciones SECURITY DEFINER a crear

Total: **6 funciones nuevas** en sub-paso 5.C.

| Función | Retorna | Propósito | Tablas que toca |
|---|---|---|---|
| `clinica_dentro_de_limite()` | boolean | Verificar `max_pacientes` / `max_medicos` / `max_secretarias` | `clinicas`, conteos |
| `clinica_no_suspendida()` | boolean | Verificar `suspendida=false` y estado no bloqueante | `clinicas` |
| `clinica_tiene_acceso()` | boolean | Phase 8.1 v2: acceso según `ha_tenido_acceso_premium` + estado | `clinicas` |
| `soy_admin_de_clinica()` | boolean | Check `role='medico' AND es_admin_de_clinica=true` | `profiles` |
| `paciente_pertenece_a_mi_clinica(paciente_id uuid)` | boolean | Validar que un paciente pertenece a la clínica del usuario | `pacientes` |
| `soy_medico_tratante(paciente_id uuid)` | boolean | Validar que el usuario actual atiende al paciente (existe pareja en `paciente_medico`). Base de la visibilidad M:N de pacientes (D-T5). Nombre tentativo, se confirma al diseñar 5.C. | `paciente_medico` |

**Restricciones de diseño (lección Phase 8.1):**
- Todas `SECURITY DEFINER` + `STABLE`
- `SET search_path` explícito
- NINGUNA debe hacer `SELECT` sobre la misma tabla que la policy que la usará (evitar recursión)
- `clinica_tiene_acceso()` debe usar la columna declarativa `clinicas.ha_tenido_acceso_premium`, no conteos recursivos
- `paciente_pertenece_a_mi_clinica()` hace `SELECT` sobre `pacientes` → NO puede usarse en policies de `pacientes` (solo en policies de otras tablas: `consultas`, `documentos`, etc.)
- `soy_medico_tratante()` hace `SELECT` sobre `paciente_medico` → se usa en la policy de `pacientes` (tablas distintas, sin recursión), pero NO debe usarse dentro de la policy de la propia tabla `paciente_medico`

### 4.4 Inventario de migraciones de schema

| Migración | Operación | Sub-paso | Riesgo |
|---|---|---|---|
| `consultas.medico_id` | `ALTER TABLE consultas ADD COLUMN medico_id uuid REFERENCES profiles(id)` | 5.B | Alto |
| `paciente_medico` (CREATE) | `CREATE TABLE paciente_medico (paciente_id uuid, medico_id uuid, ...)` — tabla de unión M:N, decisión D-T5 | 5.B | Alto |
| Backfill `paciente_medico` | Insertar una fila por paciente existente, copiando `pacientes.medico_id` actual como primer médico tratante | 5.B | Medio |

**NOTA (Hallazgo #1 de 5.B.1):** se eliminó la tarea «Backfill `consultas` → `UPDATE consultas SET medico_id = NULL`». El `ALTER TABLE ... ADD COLUMN medico_id uuid` sin `DEFAULT` ya deja todas las filas existentes en `NULL` automáticamente; el `UPDATE` explícito es innecesario y además dañino: dispararía el trigger `audit_consultas`, reescribiendo las 77 filas e inundando `audit_log` sin razón.

**Nota sobre nomenclatura:** la decisión N-C (§3.2) implica que NO se renombran `documentos.subido_por` ni `mediciones_analitos.creado_por`. Solo se agrega `medico_id` a `consultas`.

**Nota sobre `paciente_medico`:** tabla de unión nueva que materializa la relación muchos-a-muchos paciente ↔ médico (decisión D-T5). Estructura mínima prevista: `paciente_id` (FK → `pacientes`), `medico_id` (FK → `profiles`), clave primaria compuesta `(paciente_id, medico_id)`, y posibles columnas de auditoría (`created_at`, `asignado_por`). La estructura exacta se define en la fase de diseño del sub-paso 5.B. El backfill toma el `pacientes.medico_id` actual de cada paciente y lo inserta como su primera fila de médico tratante; los pacientes con `medico_id` nulo (si los hubiera) requieren decisión puntual durante 5.B.

### 4.5 Inventario de archivos TS afectados

> ⚠️ **Inventario PARCIAL.** Esta lista se completará en el sub-paso 5.A con un barrido exhaustivo del código. Los elementos confirmados por la investigación del 2026-05-20 son:

#### Confirmados

| Archivo / Endpoint | Cambio necesario | Sub-paso |
|---|---|---|
| `POST /api/consultas` | Setear `medico_id = auth.uid()` al crear consulta (la columna no existía) | 5.F |
| `src/lib/subscription.ts:62-136` | Añadir `'vencido'` al predicado `isBlocked` | §6 (monetización) |
| `POST /api/admin/paciente/[id]/anonimizar` | Verificar que funciona con la policy post-hotfix 5.D (hallazgo H5) | 5.E |
| `GuardarExpedienteBtn.tsx:34` | INSERT directo a `calculadora_resultados` — revisar tras nuevas policies | 5.I |

#### Pendientes de inventariar (sub-paso 5.A)

- **10+ formularios frontend** que hacen `INSERT` directo en `documentos` sin pasar por `/api/documentos` ni setear `subido_por` (hallazgo H3). La lista exacta de archivos NO fue enumerada en la investigación; requiere `grep` exhaustivo.
- **6+ endpoints CRUD sin gate de suscripción** (hallazgo C.2.d): `/api/labs/mediciones`, `/api/consultas/[id]/addendum`, `PUT /api/pacientes/[id]`, `/api/email/enviar-documento`, `/api/nota-medica`, `/api/consulta-rapida`. Estos se tratan en §6 (monetización), no en Etapa 5 propiamente.

### 4.6 Inventario de policies de Storage a reescribir

| Bucket | Estado actual | Cambio en Etapa 5 | Sub-paso |
|---|---|---|---|
| `documentos-pdf` | 3 policies `authenticated_*` permisivas (cualquier autenticado accede a todo) | Reescribir las 3 para discriminar por clínica (patrón de `labs-documentos`) | 5.K |
| `clinica-logos` | Público, sin policies | Sin cambios (acceso público intencional para logos) | — |
| `firmas-medicos` | No público, 0 policies | ⚠️ Investigar cómo se accede actualmente. Si se accede vía service role, evaluar si necesita policies por médico | 5.A (investigar) → 5.K |
| `labs-documentos` | No público, 4 policies `_propia_clinica` | Sin cambios (ya correcto, sirve de patrón de referencia) | — |

**Patrón de referencia (de `labs-documentos`):**

```sql
-- Estructura de carpetas: clinicas/{clinica_uuid}/...
(bucket_id = 'documentos-pdf'
 AND auth.uid() IS NOT NULL
 AND (storage.foldername(name))[1] = 'clinicas'
 AND (storage.foldername(name))[2] = (get_clinica_id())::text)
```

**Pendiente de confirmar en 5.A:** la estructura de carpetas actual del bucket `documentos-pdf`. Si los archivos NO están organizados como `clinicas/{uuid}/...`, la reescritura de policies requerirá también una migración de paths de Storage (mover archivos), lo cual aumentaría significativamente el riesgo y el alcance del sub-paso 5.K.

---

## 5. Plan de ejecución detallado

Esta sección describe el plan de ejecución de Etapa 5 a **nivel operativo**: objetivo, pre-requisitos, entregables, validación, riesgos y rollback de cada sub-paso.

> **Diseño deliberado:** esta sección NO contiene el SQL exacto de las policies ni de las funciones. Razón: el SQL definitivo depende de decisiones que se resuelven en el sub-paso 5.A (especialmente H1 y D7). El SQL de cada sub-paso se diseña en una fase de investigación dedicada **al momento de ejecutar ese sub-paso**, validado contra el modelo ya decidido. Escribir SQL especulativo aquí sería peligroso (riesgo de que se ejecute como definitivo).

> **Metodología por sub-paso:** cada sub-paso de BD sigue el patrón validado en Etapa 4.A: (1) investigación con Claude Code en modo lectura, (2) diseño del SQL exacto, (3) revisión conjunta, (4) ejecución vía `DO` block atómico en SQL Editor con snapshot lógico previo, (5) verificación post-aplicación, (6) smoke test funcional, (7) commit checkpoint.

### Resumen de sub-pasos

| Sub-paso | Objetivo | Riesgo | Estado |
|---|---|---|---|
| 5.A | Resolver decisiones pendientes + cerrar auditorías pendientes | — | ✅ Aplicado 2026-05-21 |
| 5.B | DDL: `consultas.medico_id` + tabla `paciente_medico` (M:N) + trigger latch `ha_tenido_acceso_premium` | Alto | ✅ Aplicado 2026-05-21 |
| 5.C | Crear 6 helpers `SECURITY DEFINER` | Bajo | ✅ Aplicado 2026-05-22 |
| 5.D | Fix bug producción soft delete | Bajo | ✅ Aplicado 2026-05-20 |
| 5.E | Reescribir policies de `pacientes` | Alto | ✅ Aplicado 2026-05-24 |
| DUP-RPC | Mover la detección de duplicados al RPC (M:N-aware) | Medio | ✅ Aplicado 2026-05-26 |
| 5.F | Reescribir policies de `consultas` | Alto | ⏳ Pendiente |
| 5.G | Reescribir policies de `documentos` + auditar formularios | Alto | ⏳ Pendiente |
| 5.H | Reescribir policies de `appointments` | Medio | ⏳ Pendiente |
| 5.I | Reescribir policies de `mediciones` + `calculadora` + `addendums` | Bajo-medio | ⏳ Pendiente |
| 5.J | Limpieza menor (`profiles`, `invitaciones`, huérfanas) | Bajo | ⏳ Pendiente |
| 5.K | Reescribir policies de Storage (bucket `documentos-pdf`) | Medio-alto | ⏳ Pendiente |
| 5.L | Validación final: 11 Casos del §9 | — | ⏳ Pendiente |

---

### 5.A — Resolver decisiones pendientes

> ✅ **COMPLETADO el 2026-05-21.**

**Objetivo:** cerrar todas las decisiones abiertas y los puntos ciegos antes de tocar BD.

**Resultado — decisiones:** las 11 decisiones (D1-D10 + H1 + nomenclatura) quedaron resueltas y registradas en §3.2. Las más relevantes: modelo M:N para pacientes (D-T5), ejecución directa a producción con protocolo de 9 pasos (D-T6). Ver tabla de resoluciones en §3.2.

**Resultado — auditorías cerradas:** cinco investigaciones de lectura cerraron los puntos ciegos. Hallazgos:

#### A.1 — Uso de `pacientes.medico_id` (hallazgo central)

La visibilidad de pacientes HOY **no depende de `medico_id`**: la policy `pacientes_select_activos` filtra solo por `clinica_id`. La única policy que filtraba por médico fue eliminada el 2026-04-29 (migración `20260429_b2_01`).

Consecuencias:
- **Riesgo técnico bajo** para migrar a M:N: ~13 call-sites que listan pacientes dependen 100% de la RLS, no de `medico_id`. Ajustar la policy `pacientes_select_activos` los cubre a todos sin tocar código.
- **Cambio de comportamiento** confirmado: hoy un médico invitado ve todos los pacientes de la clínica; tras Etapa 5 verá solo los suyos.

#### A.2 — Tabla `addendums`

Existe y está congelada desde su creación. Schema: `id`, `consulta_id` (FK → `consultas`, ON DELETE RESTRICT), `contenido`, `medico_id` (creador, NOT NULL, **sin FK**), `medico_nombre`, `created_at`. No tiene `clinica_id` ni `paciente_id`; se aísla vía JOIN `consultas → pacientes.clinica_id`. RLS habilitado, 2 policies (`addendums_select`, `addendums_insert`); **sin UPDATE ni DELETE → inmutable por diseño**. El INSERT actual NO valida `medico_id = auth.uid()` (control delegado al API route).

#### A.3 — Formularios con INSERT directo a `documentos`

Confirmado el hallazgo H3. **8 formularios** hacen INSERT directo client-side SIN setear `subido_por`: `RecetaForm`, `EscritoMedicoForm`, `ConsentimientoInformadoForm`, `SolicitudImagenForm`, `SolicitudLabForm`, `SolicitudInternamientoForm`, `NotaHonorariosForm`, `PlanSuplementacionForm`. También `sync.ts` del Búnker y el endpoint zombie `api/documentos/route.ts`. Único que SÍ setea `subido_por`: `ModalSubirDocumento.tsx` (uploader de labs).

#### A.4 — Bucket `firmas-medicos`

Acceso 100% server-side con service role (`createAdminClient`). El cliente nunca toca el bucket; recibe signed URLs efímeros vía `/api/me/perfil-medico`. Funciona sin policies porque service role bypassa RLS. **No requiere policies** — se documentará como intencional.

#### A.5 — Bucket `documentos-pdf`

Path **plano por paciente**: `{paciente_id}/{filename}`. NO tiene `clinicas/` ni `medico_id` en el path. Consecuencia para 5.K: la policy puede resolver pertenencia por subquery sobre `paciente_id`, **sin necesidad de mover archivos físicamente**. (No confundir con `labs-documentos`, que sí usa path jerárquico por clínica.)

#### Puntos de integración detectados (insumo para sub-pasos siguientes)

- `src/app/api/pacientes/route.ts:124-166` — único lugar que escribe `medico_id` al crear pacientes; debe insertar también la fila inicial en `paciente_medico` (sub-paso 5.B / 5.E).
- `metricas/route.ts` y `dashboard/usuarios/route.ts` — métricas super-admin con atribución 1 paciente → 1 médico; ajustar al modelo M:N (sub-paso 5.E).
- 8 formularios + `sync.ts` — corregir para setear `subido_por` (sub-paso 5.G).
- `QuickPatientModal.tsx` / `pacientes/nuevo/page.tsx` — dropdown de selección única de médico; coherente con "asignar a un médico al crear" (decisión confirmada en 5.A).

**Validación:** ✅ Sin decisiones abiertas ni puntos ciegos. Sub-paso 5.A cerrado.

**Riesgo:** — (no tocó BD ni código; solo decisiones y lectura).

**Rollback:** N/A.

---

### 5.B — DDL: `consultas.medico_id` + tabla `paciente_medico` + backfills

**Objetivo:** preparar el schema para el modelo de visibilidad de Etapa 5. Dos cambios estructurales: (1) agregar `medico_id` a `consultas` para la privacidad bidireccional de consultas (invariante 22); (2) crear la tabla de unión `paciente_medico` para la visibilidad M:N de pacientes (decisión D-T5).

**Pre-requisitos:** 5.A completado (D7-A y D-T5 confirmadas).

**Importancia:** es el sub-paso DDL más crítico de Etapa 5. Es el único que crea estructura nueva, y el backfill de `paciente_medico` es la base de toda la visibilidad de pacientes. Bloquea 5.E (policies de pacientes) y 5.F (policies de consultas). Recibe el protocolo de 9 pasos completo (D-T6) con smoke test extendido.

**Tareas:**

*Parte 1 — `consultas.medico_id`:*

1. Snapshot lógico de `consultas` (conteo de filas, estructura actual).
2. `ALTER TABLE consultas ADD COLUMN medico_id uuid REFERENCES profiles(id)`.
3. Sin `UPDATE` de backfill: el `ADD COLUMN` sin `DEFAULT` ya deja las consultas legacy en `medico_id = NULL` (decisión D-T1). **No** ejecutar `UPDATE consultas SET medico_id = NULL` — dispararía el trigger `audit_consultas` innecesariamente (Hallazgo #1 de 5.B.1).

*Parte 2 — tabla `paciente_medico`:*

4. Snapshot lógico de `pacientes` (conteo de filas, cuántas tienen `medico_id` no nulo).
5. `CREATE TABLE paciente_medico` con: `paciente_id` (FK → `pacientes`), `medico_id` (FK → `profiles`), PK compuesta `(paciente_id, medico_id)`, columnas de auditoría (`created_at`, y opcionalmente `asignado_por`). La estructura exacta se cierra en la fase de diseño SQL del sub-paso.
6. Habilitar RLS en `paciente_medico` (las policies de esta tabla se definen aquí o en 5.E, a decidir durante el diseño).
7. Backfill: por cada paciente con `medico_id` no nulo, insertar una fila `(paciente_id, medico_id)` en `paciente_medico`. Decidir durante el diseño qué hacer con pacientes de `medico_id` nulo (si los hubiera): probablemente se omiten y se reportan para revisión manual.

*Parte 3 — verificación:*

8. Verificación post-migración:
   - `consultas.medico_id` existe, FK válido, filas legacy en NULL.
   - `paciente_medico` existe con RLS habilitado.
   - Conteo: nº de filas en `paciente_medico` == nº de pacientes con `medico_id` no nulo (el backfill no perdió ni duplicó).

**Entregables:**
- Columna `consultas.medico_id` creada.
- Tabla `paciente_medico` creada y backfilleada.
- Una o más migraciones registradas en `supabase/migrations/` (decisión D1-B: troceadas; se puede separar la Parte 1 de la Parte 2 en dos migraciones).

**Validación:** queries de verificación que confirmen ambas estructuras + conteos de backfill correctos. Smoke test extendido: con una cuenta real, verificar que un paciente existente sigue visible para su médico tras el backfill.

**Riesgo:** **Alto.** Dos cambios estructurales sobre tablas productivas con datos clínicos. El backfill de `paciente_medico` es el punto más delicado: si pierde filas, médicos dejan de ver pacientes suyos. Mitigación: snapshot lógico previo de ambas tablas + backup Supabase Pro + `DO` blocks atómicos + verificación de conteos + simulación previa del backfill (contar antes cuántas filas debería generar).

**Rollback:**
- `consultas.medico_id`: `ALTER TABLE consultas DROP COLUMN medico_id` (columna nueva, legacy en NULL, sin pérdida).
- `paciente_medico`: `DROP TABLE paciente_medico` (tabla nueva; mientras ninguna policy de otra tabla la referencie todavía, el DROP es limpio).
- Ambos scripts DOWN se escriben y revisan ANTES de aplicar (protocolo D-T6, paso 2).

**Nota de integración:** tras crear `paciente_medico`, el endpoint `src/app/api/pacientes/route.ts` debe modificarse para insertar la fila inicial en la tabla de unión al crear cada paciente. Este cambio de código TS se coordina en el sub-paso 5.E (cuando se reescriben las policies de `pacientes`), no en 5.B — 5.B es solo DDL + backfill de datos existentes.

#### Sub-pasos de ejecución de 5.B

5.B se ejecutó en **tres migraciones** (decisión D1-B, troceadas). Las dos previstas (Parte 1 = 5.B.1, Parte 2 = 5.B.2) más una tercera descubierta durante la ejecución (5.B.3):

- **5.B.1 — `consultas.medico_id`.** `ALTER TABLE consultas ADD COLUMN medico_id uuid REFERENCES profiles(id) ON DELETE SET NULL` + índice `idx_consultas_medico`. Sin `UPDATE` de backfill (el `ADD COLUMN` deja las 77 filas legacy en `NULL`; ver Hallazgo #1 en §4.4). ✅ Aplicado 2026-05-21, commit `1e7ea9f`.
- **5.B.2 — tabla `paciente_medico` (M:N) + backfill.** `CREATE TABLE paciente_medico` (PK compuesta `(paciente_id, medico_id)`, FKs a `pacientes`/`profiles`, columna `asignado_por`, RLS habilitada sin policies) + backfill desde `pacientes.medico_id`. ✅ Aplicado 2026-05-21, commit `ff4b0d2`.
- **5.B.3 — Trigger latch de `ha_tenido_acceso_premium`** (no previsto; ver detalle abajo). ✅ Aplicado 2026-05-21, commit `cf632c9`.

#### 5.B.3 — Trigger latch de `ha_tenido_acceso_premium`

> Sub-paso **no previsto** en el plan original; se descubrió durante el diseño de 5.C.

**Motivo:** la columna `clinicas.ha_tenido_acceso_premium` se backfilleó una sola vez el 2026-05-18 (Etapa 1) y nunca más se actualizaba — cero escrituras en código, cero triggers; estaba "congelada". Esto bloqueaba el diseño de `clinica_tiene_acceso()` (GATE 2 de 5.C), que depende de esa columna para distinguir una clínica "free virgen" de una "free degradada".

**Solución aplicada:** se creó la función `clinicas_latch_premium()` (`SECURITY INVOKER`) y el trigger `trg_clinicas_latch_premium` (`BEFORE INSERT OR UPDATE` sobre `clinicas`). Latch **one-way**: marca `ha_tenido_acceso_premium = true` cuando `es_vip_grant` es `true` O `stripe_subscription_id` no es `NULL`; nunca regresa a `false`.

**Sin backfill correctivo:** el diagnóstico confirmó 0 clínicas desincronizadas.

**Estado:** ✅ Aplicado a producción y verificado bajo protocolo D-T6. Commit `cf632c9`.

**Rollback:** `DROP TRIGGER trg_clinicas_latch_premium ON clinicas;` + `DROP FUNCTION clinicas_latch_premium();`.

---

### 5.C — Crear helpers `SECURITY DEFINER`

**Objetivo:** crear las 6 funciones helper que las policies de los sub-pasos siguientes van a usar.

**Pre-requisitos:** 5.B aplicado (las funciones pueden referenciar el nuevo schema de `consultas` y la tabla `paciente_medico`).

**Tareas:**

Crear las 6 funciones (ver inventario §4.3):
1. `clinica_dentro_de_limite()`
2. `clinica_no_suspendida()`
3. `clinica_tiene_acceso()`
4. `soy_admin_de_clinica()`
5. `paciente_pertenece_a_mi_clinica(paciente_id uuid)`
6. `soy_medico_tratante(paciente_id uuid)` — base de la visibilidad M:N de pacientes (D-T5); nombre tentativo, se confirma al diseñar el SQL.

**Restricciones de diseño (lección Phase 8.1, ver §7.1):**
- Todas `SECURITY DEFINER` + `STABLE` + `SET search_path` explícito.
- **Mecanismo anti-recursión (corrige el wording previo):** lo que rompe la recursión RLS NO es "no tocar la misma tabla", sino que una función `SECURITY DEFINER` cuyo **dueño es `postgres`** (superusuario, BYPASSRLS) ejecuta su cuerpo **saltándose la RLS** — su `SELECT` interno no re-dispara las policies de la tabla consultada. Evidencia en producción: `get_clinica_id()` y `get_my_role()` ya hacen `SELECT` sobre `profiles` y se usan dentro de policies de `profiles` desde hace meses sin recursión. La recursión de Phase 8.1 ocurrió porque el `count(*)` estaba **inline en el predicado de la policy** (contexto `SECURITY INVOKER`, RLS activa), no dentro de una función `SECURITY DEFINER`.
  - **Consecuencia:** 2 de los 6 helpers DEBEN consultar tablas que también se gatean, y es seguro vía el bypass: `clinica_dentro_de_limite()` (cuenta `pacientes` y se usa en la policy de `pacientes`) y `soy_admin_de_clinica()` (lee `profiles` y se usa en policies de `profiles`).
  - **Condición NO negociable:** las 6 funciones deben crearse en el SQL Editor con **owner = `postgres`** para garantizar el bypass. Si alguna quedara con otro dueño sin BYPASSRLS, su `SELECT` interno sí dispararía RLS → recursión.
  - **Regla conservadora (defensa en profundidad):** se reserva solo para los 2 helpers M:N que sí podrían recursar sobre su propia tabla — `paciente_pertenece_a_mi_clinica()` (no usar en la policy de `pacientes`) y `soy_medico_tratante()` (no usar en la policy de `paciente_medico`).
- `clinica_tiene_acceso()` usa la columna declarativa `clinicas.ha_tenido_acceso_premium`.
- `paciente_pertenece_a_mi_clinica()` hace `SELECT` sobre `pacientes`: usable solo en policies de otras tablas, NUNCA en la policy de `pacientes`.
- `soy_medico_tratante()` hace `SELECT` sobre `paciente_medico`: se usa en la policy de `pacientes` (sin recursión, son tablas distintas), pero NO en la policy de la propia `paciente_medico`.
- **Decisión durante diseño:** el predicado de `clinica_tiene_acceso()` debe incluir `'vencido'` como estado bloqueante (no solo `'cancelado'`), para cerrar el hallazgo C.2.a desde la RLS.

**Pendiente de decidir al diseñar:** las policies de la propia tabla `paciente_medico` (quién puede ver/insertar/eliminar filas de unión). Se resuelven aquí o en 5.E — a confirmar durante el diseño SQL.

**Entregables:**
- 6 funciones creadas en producción.
- Migración registrada.
- Cada función probada individualmente con queries de prueba.

**Validación:** ejecutar cada función con casos conocidos (clínica VIP, clínica free, clínica suspendida) y verificar el boolean retornado.

**Riesgo:** **Bajo.** Crear funciones no afecta datos ni policies existentes. Las funciones no se "activan" hasta que una policy las invoque (sub-pasos 5.E+).

**Rollback:** `DROP FUNCTION` de cada una (no hay dependencias hasta que las policies las usen).

---

### 5.D — Fix bug producción soft delete

> ✅ **Aplicado en producción el 2026-05-20.** Ver Bitácora §8.

**Objetivo:** resolver el bug productivo que bloqueaba el soft delete de pacientes para los 9 admins productivos.

**Contexto:** tras Etapa 4.A.8 (eliminación del rol `'admin'`), la policy `pacientes_select_inactivos_admin` filtraba por `role IN ('admin','super_admin')`. Como los admins migraron a `role='medico' + es_admin_de_clinica=true`, la policy dejó de reconocerlos, bloqueando el `RETURNING` del `UPDATE activo=false`.

**Solución aplicada:** `DROP POLICY` + `CREATE POLICY` con el modelo nuevo, dentro de un `DO` block atómico con 3 pre-flight + 3 post-flight checks. La policy nueva reconoce `super_admin` OR `(role='medico' AND es_admin_de_clinica=true)`.

**Estado:**
- ✅ Aplicado en producción vía Supabase SQL Editor.
- ✅ Smoke test confirmado (soft delete funcional).
- 🟡 **Deuda pendiente:** registrar el cambio como archivo de migración en `supabase/migrations/` con su timestamp. La policy está en BD pero el repo aún no la refleja. Esta deuda se cierra en el sub-paso 5.E (cuando se reescriban definitivamente las policies de `pacientes`, la `pacientes_select_inactivos_admin` se integrará al modelo completo y se registrará la migración correspondiente).

**Nota de integración:** el hotfix 5.D fue una solución mínima. En el sub-paso 5.E, la policy `pacientes_select_inactivos_admin` se revisará e integrará al modelo definitivo de privacidad bidireccional (puede que cambie nuevamente para alinearse con el resto de policies de `pacientes`).

---

### 5.E — Reescribir policies de pacientes + paciente_medico (modelo M:N)

> ✅ **Aplicado en producción el 2026-05-24.** Ver Bitácora §8.

**Objetivo:** implementar la visibilidad de pacientes del modelo M:N (D-T5). Es un sub-paso de 3 frentes coordinados: policies de BD, integración del INSERT, y ajuste de métricas. Los tres deben aplicarse juntos — si las policies M:N se activan pero el INSERT no puebla `paciente_medico`, los pacientes nuevos quedan invisibles para su propio médico.

**Pre-requisitos:** 5.B aplicado (tabla `paciente_medico` creada y backfilleada), 5.C aplicado (los 6 helpers disponibles, en especial `soy_medico_tratante()` y `soy_admin_de_clinica()`).

#### Frente BD-1 — Policies de `pacientes`

1. Investigación con Claude Code: revisar las 5 policies actuales de `pacientes` y el modelo objetivo (`ROLES_POST_REFACTOR.md §2.2`, invariantes 21-23).
2. Diseñar el SQL exacto:
   - **SELECT activos:** médico invitado ve solo pacientes donde `soy_medico_tratante(id)` es true; admin de clínica ve todos los de su clínica (`soy_admin_de_clinica()`); secretaria ve todos los de su clínica; `super_admin` según su lógica.
   - **SELECT inactivos:** integrar el hotfix 5.D al modelo definitivo (la policy `pacientes_select_inactivos_admin` se alinea con el modelo nuevo).
   - **INSERT:** agregar gates de suscripción (`clinica_dentro_de_limite()`, `clinica_no_suspendida()`).
   - **UPDATE:** discriminación por médico tratante + rol.
   - **DELETE** (`pacientes_delete_solo_sin_historial`): restringir a `super_admin` (hallazgo H7).
3. ⚠️ Restricción anti-recursión: la policy de `pacientes` NO puede usar `paciente_pertenece_a_mi_clinica()` (esa función hace `SELECT` sobre `pacientes`). Sí puede usar `soy_medico_tratante()` (consulta `paciente_medico`, tabla distinta) y `soy_admin_de_clinica()` (consulta `profiles`).

> **Nota `super_admin` (insumo del cierre de 5.C, 2026-05-22):** las policies de 5.E NO necesitan una cláusula `OR` para `super_admin`. El `super_admin` accede a los datos clínicos por los endpoints `/api/super-admin/*` usando el `service_role` de Supabase, que tiene `BYPASSRLS` — las policies RLS no se evalúan en ese camino. El helper `soy_admin_de_clinica()` excluye correctamente a `super_admin` (exige `role='medico'`), y eso es lo correcto. Por tanto, donde el punto 2 dice "`super_admin` según su lógica", esa lógica es: no se requiere predicado RLS adicional.

#### Frente BD-2 — Policies de la tabla `paciente_medico`

4. Diseñar y crear las policies RLS de la propia tabla de unión `paciente_medico`:
   - **SELECT:** un médico ve sus propias filas de unión; el admin de clínica ve las de su clínica.
   - **INSERT:** quién puede asignar un médico a un paciente (médico que crea, admin, secretaria — a definir en el diseño).
   - **DELETE:** quién puede desvincular un médico de un paciente.
   - ⚠️ Estas policies NO deben usar `soy_medico_tratante()` (haría recursión sobre `paciente_medico`); se escriben con lógica directa.

#### Frente TS-1 — Integración del INSERT de pacientes

5. Modificar `src/app/api/pacientes/route.ts` (líneas ~124-166): al crear un paciente, además de setear `pacientes.medico_id` (creador), insertar la fila inicial en `paciente_medico` con el médico asignado. Esto es obligatorio: sin ello, ningún paciente nuevo queda vinculado.

#### Frente TS-2 — Ajuste de métricas super-admin

6. Ajustar las métricas que asumen atribución 1 paciente → 1 médico, ahora que un paciente puede tener varios médicos:
   - `src/app/api/super-admin/metricas/route.ts` (líneas ~21, 78).
   - `src/app/api/super-admin/dashboard/usuarios/route.ts` (líneas ~119, 133, 153).
   El criterio exacto de las métricas (¿contar por creador? ¿por cada médico tratante?) se decide al diseñar este frente.

#### Aplicación y validación

7. Aplicar las policies vía `DO` block atómico con snapshot lógico previo. Aplicar los cambios TS como commits coordinados.
8. Verificación post-aplicación + smoke test extendido con los 4 roles.

**Entregables:**
- Policies de `pacientes` reescritas con modelo M:N.
- Policies de `paciente_medico` creadas.
- Hotfix 5.D integrado y registrado como migración (cierra la deuda pendiente de 5.D).
- `api/pacientes/route.ts` poblando `paciente_medico`.
- 2 métricas super-admin ajustadas.
- Migración(es) registrada(s) en `supabase/migrations/` + commits TS.

**Validación:** smoke test exhaustivo —
- Médico invitado A ve solo SUS pacientes; NO ve los de médico invitado B.
- Admin de clínica ve todos los pacientes de la clínica.
- Secretaria ve todos los pacientes de la clínica.
- Crear un paciente nuevo → aparece en `paciente_medico` → visible para su médico.
- Soft delete sigue funcionando (regresión del hotfix 5.D).
- super_admin sin regresiones.
- **Borde GATE 1 (off-by-one):** verificar explícitamente que una clínica free con tope 5 puede tener exactamente 5 pacientes y se bloquea el 6º, sin error off-by-one en `clinica_dentro_de_limite()` (hallazgo R3 de la auditoría de 5.C).

**Riesgo:** **Alto.** `pacientes` es la tabla base y este sub-paso introduce el modelo M:N completo + cambios de código TS. Un error deja pacientes invisibles para sus médicos. Mitigación: es la primera tabla que se reescribe; validación exhaustiva antes de continuar a 5.F; simulación previa del predicado (protocolo D-T6, paso 3).

**Rollback:**
- Policies de `pacientes`: restaurar las 5 originales desde snapshot lógico.
- Policies de `paciente_medico`: `DROP POLICY` de las nuevas (la tabla queda con RLS pero sin policies = acceso denegado, estado seguro).
- Cambios TS: `git revert` de los commits correspondientes.
- Los 3 frentes se revierten de forma coordinada.

---

### DUP-RPC — Detección de duplicados M:N-aware

> ✅ **Pasos 1-3 aplicados en producción el 2026-05-26.** El Paso 4 (DROP de la función vieja) está programado como último paso antes de cerrar la Etapa 5. Ver Bitácora §8.

**Objetivo:** tras el sub-paso 5.E un médico invitado solo ve sus propios pacientes, por lo que la detección de duplicados local en `route.ts` ya no detecta pacientes homónimos registrados por otros médicos de la clínica. DUP-RPC mueve la detección al RPC (`crear_paciente_con_medico_v2`, `SECURITY DEFINER`), que ve toda la clínica.

**Frentes:** el RPC v2 con detección de duplicados; `route.ts` apuntando al RPC v2; el endpoint nuevo `POST /api/pacientes/[id]/vincular`; y 3 componentes de frontend con un modal de 3 acciones (vincular / crear de todos modos / cancelar) y texto variable por rol.

**Plan detallado:** ver `DUPRPC_PLAN.md`.

**Límite conocido:** una secretaria no puede vincular un paciente vía `/vincular` — la RLS de SELECT de `paciente_medico` la rechaza en el `.upsert()`. Workaround: el médico invitado realiza la vinculación desde su propia cuenta. Es un edge case aceptado, no un bloqueante.

---

### 5.F — Reescribir policies de consultas

**Objetivo:** reescribir las 4 policies de `consultas` para implementar privacidad bidireccional (invariante 22).

**Pre-requisitos:** 5.B aplicado (columna `consultas.medico_id` existe), 5.C aplicado (helpers disponibles), 5.E aplicado (`pacientes` ya tiene el modelo nuevo).

**Tareas:**

1. Investigación con Claude Code: revisar las 4 policies actuales (todas usan `EXISTS (paciente WHERE clinica_id)`).
2. Diseñar el SQL exacto:
   - **SELECT:** médico ve consultas con `medico_id = auth.uid()`; admin de clínica ve todas las de su clínica (`soy_admin_de_clinica()`); `medico_id IS NULL` (legacy) visible solo para admin/`super_admin` (decisión D-T1).
   - **INSERT:** validar `medico_id` y la pertenencia del paciente a la clínica vía `paciente_pertenece_a_mi_clinica(paciente_id)`.
   - **UPDATE/DELETE:** solo el creador (`medico_id = auth.uid()`) o el admin de clínica.
3. ⚠️ Nota anti-recursión: las policies de `consultas` SÍ pueden usar `paciente_pertenece_a_mi_clinica()` y `soy_medico_tratante()` — ambas consultan tablas distintas de `consultas` (`pacientes` y `paciente_medico` respectivamente), por lo que no generan recursión.
4. Aplicar vía `DO` block atómico con snapshot lógico previo.
5. Verificación + smoke test.

**Entregables:**
- 4 policies de `consultas` reescritas.
- Migración registrada.

**Validación:** smoke test — médico A crea consulta, médico B (misma clínica) NO la ve, admin SÍ la ve. Consulta legacy (`medico_id NULL`) visible solo para admin.

**Riesgo:** **Alto.** Primera tabla con privacidad bidireccional real. El manejo del caso `medico_id IS NULL` debe ser explícito.

**Rollback:** restaurar las 4 policies originales desde snapshot.

---

### 5.G — Reescribir policies de documentos + auditar formularios

**Objetivo:** reescribir las 4 policies de `documentos` para privacidad bidireccional Y resolver el hallazgo H3 (formularios frontend con INSERT directo sin setear `subido_por`).

**Pre-requisitos:** 5.A completado (lista de formularios ya enumerada, ver A.3), 5.C aplicado, 5.E aplicado.

**Tareas:**

1. Investigación con Claude Code: revisar las 4 policies de `documentos`.
2. Diseñar el SQL exacto:
   - **SELECT:** médico ve documentos con `subido_por = auth.uid()`; admin de clínica ve todos (`soy_admin_de_clinica()`); `subido_por IS NULL` (legacy) visible solo para admin/`super_admin`.
   - **INSERT/UPDATE/DELETE:** privacidad bidireccional vía `subido_por`.
   - ⚠️ Nota anti-recursión: la policy de `documentos` puede usar `paciente_pertenece_a_mi_clinica()` (consulta `pacientes`, tabla distinta) sin recursión.
3. **Corregir los 8 formularios frontend** que hacen INSERT directo en `documentos` sin setear `subido_por` (hallazgo H3, confirmado en auditoría A.3). Lista exacta:
   - `RecetaForm.tsx`
   - `EscritoMedicoForm.tsx`
   - `ConsentimientoInformadoForm.tsx`
   - `SolicitudImagenForm.tsx`
   - `SolicitudLabForm.tsx`
   - `SolicitudInternamientoForm.tsx`
   - `NotaHonorariosForm.tsx`
   - `PlanSuplementacionForm.tsx`
   
   Cada uno debe setear `subido_por` con el `user.id` del usuario actual (obtenible client-side vía `supabase.auth.getUser()`). Además: revisar `sync.ts` del Búnker (INSERT client-side, también sin `subido_por`) y el endpoint zombie `api/documentos/route.ts` (ningún formulario lo invoca; evaluar si se elimina o se reactiva como ruta centralizada).
4. ⚠️ Orden crítico: las correcciones de formularios deben aplicarse ANTES o EN EL MISMO despliegue que las policies. Si las policies filtran por `subido_por` y un formulario aún crea documentos con `subido_por NULL`, el médico no vería su propio documento recién creado.
5. Aplicar policies vía `DO` block atómico. Aplicar correcciones de formularios como commits TS coordinados.
6. Verificación + smoke test.

**Entregables:**
- 4 policies de `documentos` reescritas.
- 8 formularios corregidos para setear `subido_por` + decisión sobre `sync.ts` y el endpoint zombie.
- Migración registrada + commits de cambios TS.

**Validación:** smoke test — crear documento desde cada tipo de formulario y verificar que `subido_por` queda seteado. Médico A no ve documentos de médico B.

**Riesgo:** **Alto.** Doble frente: policies de BD + 10+ archivos TS. El riesgo de los formularios es que alguno quede sin corregir y genere documentos huérfanos.

**Rollback:** restaurar policies desde snapshot + revertir commits TS de formularios.

---

### 5.H — Reescribir policies de appointments

**Objetivo:** reescribir las 4 policies de `appointments` para que el médico invitado vea solo sus citas, mientras admin y secretaria ven todas las de la clínica.

**Pre-requisitos:** 5.C aplicado, 5.E aplicado.

**Tareas:**

1. Investigación con Claude Code: revisar las 4 policies actuales (solo filtran `clinica_id`).
2. Diseñar el SQL exacto:
   - **SELECT:** médico invitado ve citas con `medico_id = auth.uid()`; admin de clínica (`soy_admin_de_clinica()`) y secretaria ven todas las de la clínica.
   - **INSERT:** gate de suscripción + admin/secretaria pueden crear para cualquier médico.
   - **UPDATE/DELETE:** médico invitado solo las suyas; admin/secretaria todas.
3. ⚠️ Nota: `appointments` ya tiene columna `medico_id` (no requiere migración de schema). El caso de la secretaria —ve toda la agenda pero no es médico tratante— se resuelve con un OR de rol explícito en el predicado, no vía `soy_medico_tratante()`.
4. Aplicar vía `DO` block atómico con snapshot previo.
5. Verificación + smoke test.

**Entregables:**
- 4 policies de `appointments` reescritas.
- Migración registrada.

**Validación:** smoke test — médico invitado ve solo sus citas; admin y secretaria ven toda la agenda de la clínica; secretaria puede agendar para cualquier médico.

**Riesgo:** **Medio.** `appointments` ya tiene `medico_id`, no requiere migración de schema. El caso de la secretaria (ve todo pero no es médico) requiere atención.

**Rollback:** restaurar las 4 policies originales desde snapshot.

---

### 5.I — Reescribir policies de mediciones + calculadora + addendums

**Objetivo:** reescribir las policies de `mediciones_analitos`, `calculadora_resultados` y `addendums` para privacidad bidireccional (invariante 22).

**Pre-requisitos:** 5.A completado (schema de `addendums` ya auditado, ver A.2), 5.C aplicado, 5.E aplicado.

**Tareas:**

1. Investigación con Claude Code: revisar las policies de las 3 tablas.
   - `mediciones_analitos`: 4 policies, creador en columna `creado_por` (NOT NULL).
   - `calculadora_resultados`: 4 policies, creador en columna `medico_id` (NOT NULL).
   - `addendums`: 2 policies (`addendums_select`, `addendums_insert`), creador en `medico_id` (NOT NULL, sin FK); tabla inmutable (sin UPDATE ni DELETE por diseño); se aísla vía JOIN `consultas → pacientes.clinica_id`.
2. Diseñar el SQL exacto:
   - **`mediciones_analitos` y `calculadora_resultados`** — SELECT: médico ve solo lo que él creó (`creado_por` / `medico_id` = `auth.uid()`); admin ve todo de su clínica. INSERT/UPDATE/DELETE: privacidad bidireccional.
   - **`addendums`** — modelo distinto: un addendum hereda la visibilidad de su consulta padre. SELECT: ves el addendum si ves la consulta referenciada por `consulta_id` (es decir, si la policy de `consultas` te deja ver esa consulta). NO se agregan UPDATE ni DELETE (se preserva la inmutabilidad por diseño). INSERT: alinear con quién puede escribir en esa consulta.
3. Aplicar vía `DO` block atómico con snapshot previo.
4. Verificación + smoke test.

**Entregables:**
- Policies de `mediciones_analitos` y `calculadora_resultados` reescritas.
- Policy `addendums_select` alineada a "heredar visibilidad de la consulta padre"; inmutabilidad preservada.
- Migración registrada.

**Validación:** smoke test — médico A registra medición/cálculo, médico B no lo ve, admin sí. Para addendums: médico A ve addendums de SUS consultas, no los de consultas de otro médico.

**Riesgo:** **Bajo-medio.** `mediciones_analitos` y `calculadora_resultados` tienen creador NOT NULL (sin caso legacy NULL). `addendums` está bien acotada: inmutable y con scope heredado de `consultas`; su policy SELECT depende de que 5.F (consultas) ya esté aplicado.

**Rollback:** restaurar policies originales desde snapshot.

**Nota:** `calculadora_resultados` tiene `medico_id` + `clinica_id` (la tabla más completa del sistema). `mediciones_analitos` usa `creado_por`. Por decisión de nomenclatura N-C (§3.2), NO se renombran columnas; las policies manejan la diferencia internamente.

---

### 5.J — Limpieza menor (profiles, invitaciones, huérfanas)

**Objetivo:** resolver las deudas cosméticas y de limpieza acumuladas, sin impacto funcional grande.

**Pre-requisitos:** 5.E aplicado (para no interferir con cambios en `profiles`).

**Tareas:**

1. **`profiles` — consolidar policies duplicadas:**
   - SELECT: fusionar `Ver perfiles de la misma clinica` + `profiles_select_own` en una sola.
   - UPDATE: fusionar `Actualizar propio perfil` + `profiles_update_own` en una sola.
   - Cambiar `TO public` → `TO authenticated` (decisión D8).
2. **`invitaciones` — agregar gate:**
   - Agregar `soy_admin_de_clinica()` a las policies `admin_*` (actualmente sin gate de rol).
3. **`get_suscripcion_estado()` — evaluar:**
   - Decisión D9: mantener la función huérfana (útil para Etapa 6 / queries de auditoría). Documentar como "intencionalmente conservada".
4. Aplicar vía `DO` block atómico.
5. Verificación.

**Entregables:**
- `profiles` con 2 policies en lugar de 4.
- `invitaciones` con gate de admin.
- Migración registrada.

**Validación:** verificar que login y edición de perfil siguen funcionando; que solo admins gestionan invitaciones.

**Riesgo:** **Bajo.** Cambios cosméticos y de consolidación. `profiles` es sensible (afecta login), por eso se hace después de 5.E con validación.

**Rollback:** restaurar policies originales desde snapshot.

---

### 5.K — Reescribir policies de Storage (bucket documentos-pdf)

**Objetivo:** cerrar la brecha de seguridad del bucket `documentos-pdf` — sus 3 policies actuales (`authenticated_select/insert/delete`) solo verifican `bucket_id`, permitiendo a cualquier usuario autenticado acceder a archivos de cualquier clínica.

**Pre-requisitos:** 5.A completado (estructura de paths confirmada en A.5, acceso a `firmas-medicos` confirmado en A.4), 5.C aplicado (helper `paciente_pertenece_a_mi_clinica()` disponible).

**Contexto de los hallazgos de 5.A (elimina incógnitas):**

- **A.5 — `documentos-pdf`:** path plano `{paciente_id}/{filename}`. NO requiere mover archivos físicamente: la policy puede extraer el `paciente_id` del primer segmento del path y resolver pertenencia por subquery. La bifurcación de "alto riesgo / migrar archivos" que contemplaba el plan original queda descartada.
- **A.4 — `firmas-medicos`:** acceso 100% server-side vía service role; el cliente nunca toca el bucket. NO requiere policies. Solo se documenta como decisión intencional.

**Tareas:**

1. Investigación con Claude Code: revisar las 3 policies actuales de `documentos-pdf` y el patrón de referencia de `labs-documentos`.
2. Diseñar el SQL exacto de las 3 policies nuevas. Estrategia: extraer `paciente_id` del path con `(storage.foldername(name))[1]` y validar que ese paciente pertenece a la clínica del usuario, vía `paciente_pertenece_a_mi_clinica()`.
   - **SELECT:** solo si el `paciente_id` del path pertenece a la clínica del usuario.
   - **INSERT/DELETE:** mismo criterio.
3. Aplicar las 3 policies vía `DO` block atómico con snapshot lógico previo.
4. Documentar `firmas-medicos` como "sin policies por diseño — acceso exclusivo service role" (no requiere cambios).
5. Verificación + smoke test: usuario de Clínica A intenta acceder a un archivo de Clínica B (debe fallar); usuario de Clínica A accede a los suyos (debe funcionar).

**Entregables:**
- 3 policies de `documentos-pdf` reescritas con restricción por clínica (vía `paciente_id` del path).
- `firmas-medicos` documentado como intencionalmente sin policies.
- Migración registrada.

**Validación:** smoke test — usuario de Clínica A NO accede a archivos de Clínica B; usuario de Clínica A SÍ accede a los de su clínica.

**Riesgo:** **Medio.** Sin migración de archivos (descartada por A.5), el riesgo baja respecto a la estimación original. Es reescritura de 3 policies de Storage con un subquery. Mitigación: snapshot previo + simulación del predicado + smoke test cross-clínica.

**Limitación reconocida (riesgo residual aceptado):** el path `{paciente_id}/{filename}` no incluye `medico_id`, por lo que la policy de Storage discrimina hasta nivel **paciente**, no nivel documento individual. Consecuencia: dos médicos que comparten un mismo paciente (modelo M:N) podrían descargar archivos PDF uno del otro si conocen el path exacto. La tabla de metadatos `documentos` SÍ los oculta de los listados (vía `subido_por`, sub-paso 5.G), pero el archivo físico no queda protegido a nivel médico. Esta brecha residual es **menor y aceptable para Etapa 5**: el riesgo crítico (acceso cross-clínica) sí queda cerrado. Cerrar la brecha residual requeriría incluir `medico_id` en el path o servir los PDFs vía endpoint server-side — se difiere como posible mejora futura.

**Rollback:** restaurar las 3 policies originales desde snapshot lógico. Sin migración de archivos, no hay rollback de Storage físico que gestionar.

---

### 5.L — Validación final: 11 Casos del §9

**Objetivo:** validar que TODO el sistema cumple el modelo esperado, ejecutando los 11 casos de prueba definidos en `ROLES_POST_REFACTOR.md §9`.

**Pre-requisitos:** sub-pasos 5.A a 5.K completados.

**Tareas:**

1. Ejecutar los 11 casos de `ROLES_POST_REFACTOR.md §9` en producción, con cuentas reales de cada rol.
2. Verificar específicamente los invariantes 21, 22, 23:
   - Invariante 21: admin de clínica ve TODO de su clínica.
   - Invariante 22: privacidad bidireccional entre médicos invitados (A no ve lo de B, B no ve lo de A).
   - Invariante 23: datos del paciente visibles a médicos que lo atienden; datos generados privados.
3. **Validar escenarios del modelo M:N (decisión D-T5)** — no cubiertos por los 11 casos originales:
   - **Paciente compartido:** un paciente vinculado a médico A y médico B (dos filas en `paciente_medico`). Ambos lo ven en su lista de pacientes. Pero médico A NO ve las consultas/documentos/mediciones creados por médico B sobre ese paciente, y viceversa (invariante 22 sigue vigente sobre datos generados).
   - **Cambio de comportamiento confirmado:** un médico invitado que antes veía todos los pacientes de la clínica ahora ve SOLO los suyos. Verificar con una cuenta real que la lista se redujo correctamente.
   - **Creación de paciente:** crear un paciente nuevo → confirmar que se generó la fila inicial en `paciente_medico` → confirmar que el paciente aparece en la lista de su médico.
   - **Backfill correcto:** verificar que los pacientes existentes pre-Etapa 5 siguen visibles para su médico creador tras el backfill de `paciente_medico`.
   - **Admin con filtro:** el admin de clínica ve todos los pacientes y puede filtrar por "solo los míos" (filtro UI).
4. Smoke test transversal: login, crear paciente, crear consulta, subir documento, agendar cita, registrar medición, usar calculadora — con los 4 roles.
5. Verificar que NO hay recursión RLS (revisar logs de Supabase, tiempos de respuesta). Atención especial a las policies que usan `soy_medico_tratante()` y `paciente_pertenece_a_mi_clinica()`.
6. Verificar que el soft delete sigue funcionando (regresión del hotfix 5.D).
7. Verificar la limitación residual de Storage documentada en §5.K: confirmar que el acceso cross-clínica a `documentos-pdf` quedó cerrado (lo crítico). La brecha residual entre médicos que comparten paciente es conocida y aceptada — solo se deja constancia, no bloquea el cierre.

**Entregables:**
- Checklist de los 11 casos del §9, cada uno marcado ✅ o 🔴.
- Checklist de los 5 escenarios M:N (tarea 3), cada uno marcado ✅ o 🔴.
- Reporte de validación final en la Bitácora §8.
- Si todo pasa: Etapa 5 se declara CERRADA.

**Validación:** los 11 casos pasan + sin recursión + sin regresiones.

**Riesgo:** — (es validación, no cambia nada). Pero si un caso falla, puede requerir volver a un sub-paso anterior.

**Rollback:** N/A. Si un caso falla, se diagnostica y se corrige el sub-paso correspondiente.

**Criterio de cierre de Etapa 5:**
- ✅ Los 11 casos del §9 pasan.
- ✅ Los 5 escenarios M:N (tarea 3) pasan.
- ✅ Invariantes 21, 22, 23 verificados en producción.
- ✅ Cambio de comportamiento M:N confirmado (médico invitado ve solo sus pacientes).
- ✅ Sin recursión RLS.
- ✅ Sin regresiones (soft delete, login, CRUD básico).
- ✅ Acceso cross-clínica a `documentos-pdf` cerrado.
- ✅ Todas las migraciones registradas en `supabase/migrations/`.
- ✅ `ROLES_POST_REFACTOR.md` actualizado (apéndice de funciones, línea 9 de estado, modelo M:N).
- ✅ Función vieja `crear_paciente_con_medico(jsonb, uuid)` eliminada (Paso 4 de DUP-RPC, ejecutado como último paso de la Etapa 5, después de 5.L y antes de declarar la etapa cerrada).

---

## 6. Plan post-Etapa 5: monetización

Esta sección documenta el plan para resolver las fugas económicas descubiertas en la investigación de enforcement (§2.3). **Se ejecuta DESPUÉS de cerrar Etapa 5**, no antes.

> **Razón del orden:** el sistema de roles es la base. Resolver monetización sobre un sistema de RLS a medio reescribir generaría deuda peor. Además, Etapa 5 cierra parcialmente varias fugas (ver §6.4), reduciendo el alcance de esta sección.

> **Contexto de urgencia:** Spinus está en beta. Los únicos 2 usuarios de pago son conocidos del desarrollador que pagaron para probar que Stripe funciona. NO hay sangrado económico real con usuarios desconocidos. Esto permite planear con calma y ejecutar después de Etapa 5 sin presión.

### 6.1 Hallazgos del reporte de enforcement

Los 8 hallazgos de §2.3, recapitulados:

| Código | Hallazgo | Severidad |
|---|---|---|
| C.2.a | `'vencido'` (past_due) no bloquea nada | 🔴 Alta |
| C.2.b | `suspendida` es decorativa (0 referencias funcionales) | 🔴 Alta |
| C.2.d | 6+ endpoints CRUD sin gate de suscripción | 🔴 Alta |
| C.2.e | Sin RLS de respaldo (todo depende de TypeScript) | 🔴 Alta |
| C.3 | Conteo de pacientes incluye soft-deleted → **revertido por diseño (Camino 2); ya no es hallazgo** | 🟢 Por diseño |
| C.4.a | Stripe sin idempotencia explícita | 🟡 Baja |
| C.4.b | `invoice.payment_failed` no notifica al usuario | 🟡 Media |
| C.5 | Sin contador UI "N de 5" pacientes | 🟡 UX |

> **Reversión C.3 — Camino 2 (2026-05-22).** Durante el diseño de 5.C se revirtió conscientemente la conclusión original de C.3 (que el conteo del tope debía contar SOLO activos). Razón: contar solo activos abre un agujero de abuso — una clínica free podría crear 5 pacientes, hacer soft-delete de uno (baja el conteo), crear otro, borrar, crear… en bucle, usando la plataforma gratis sin límite real. **Decisión:** `clinica_dentro_de_limite()` cuenta el TOTAL de pacientes (activos + soft-deleted), de modo que borrar NO libera cupo y el bucle queda cerrado. **Implicación aceptada:** para una clínica free el tope es "histórico" — 5 = 5 altas totales en la vida de la cuenta free; borrar no devuelve espacio. Es el comportamiento deseado para monetización. Ya implementado y en producción: el helper cuenta sin filtro de `activo` (`20260522_etapa5c_helpers_rls.sql`).

### 6.2 Priorización de fugas económicas

| Prioridad | Hallazgo | Acción | Esfuerzo estimado |
|---|---|---|---|
| 1 | C.2.a — `'vencido'` no bloquea | Añadir `'vencido'` al predicado `isBlocked` de `src/lib/subscription.ts` | Bajo (1 línea + tests) |
| 2 | C.2.d — endpoints sin gate | Replicar `getSubscriptionState` en los 6+ endpoints faltantes | Medio |
| 3 | C.2.b — `suspendida` decorativa | Activar `suspendida` en gates server-side + RLS | Medio |
| 4 | C.2.e — sin RLS de respaldo | Cubierto parcialmente por Etapa 5 (ver §6.4) | — |
| 5 | C.3 — conteo soft-deleted | ❌ **CANCELADA (Camino 2, 2026-05-22):** NO filtrar por `activo`. El conteo del tope incluye soft-deleted a propósito (anti-abuso); ya implementado en `clinica_dentro_de_limite()` (5.C). | N/A |
| 6 | C.4.b — sin notificación pago fallido | Email/notificación en webhook `invoice.payment_failed` | Medio |
| 7 | C.4.a — Stripe sin idempotencia | Tabla `stripe_events_processed` + verificación de `event.id` | Medio |
| 8 | C.5 — sin contador UI | Banner "N de 5" pre-emptive en frontend | Bajo |

### 6.3 Plan operativo de corrección

El plan se organiza en 3 bloques. El detalle de cada bloque (SQL, archivos TS exactos) se diseñará al momento de ejecutar, igual que en Etapa 5.

#### Bloque M1 — Gates de suscripción (prioridades 1-3)

**Objetivo:** cerrar las fugas que permiten uso sin pago.

- Añadir `'vencido'` al predicado de bloqueo en `src/lib/subscription.ts`.
- Identificar y cerrar los 6+ endpoints CRUD sin gate: `/api/labs/mediciones`, `/api/consultas/[id]/addendum`, `PUT /api/pacientes/[id]`, `/api/email/enviar-documento`, `/api/nota-medica`, `/api/consulta-rapida`, `GuardarExpedienteBtn.tsx`.
- Activar `suspendida` como gate funcional server-side.

**Nota de solapamiento:** si Etapa 5 implementó `clinica_no_suspendida()` y `clinica_tiene_acceso()` como gates RLS (sub-paso 5.C), parte de este bloque ya estará cubierto a nivel BD. Este bloque se enfoca en la capa de aplicación TypeScript.

#### Bloque M2 — Robustez de Stripe (prioridades 6-7)

**Objetivo:** hacer el webhook de Stripe robusto y comunicativo.

- Crear tabla `stripe_events_processed` para idempotencia (verificar `event.id` antes de procesar).
- Agregar notificación al usuario en `invoice.payment_failed` (email o notificación in-app).

#### Bloque M3 — UX comercial (prioridades 5, 8)

**Objetivo:** mejorar la experiencia y conversión.

- ❌ ~~Filtrar soft-deleted del conteo de pacientes (`activo IS NOT FALSE`).~~ **CANCELADO (Camino 2, 2026-05-22):** el conteo del tope incluye soft-deleted a propósito (anti-abuso); resuelto en `clinica_dentro_de_limite()` (5.C).
- Agregar contador "N de 5" pre-emptive en la UI, antes de que el usuario choque con el 403.

### 6.4 Solapamiento con Etapa 5

Etapa 5, al ejecutarse, cierra parcialmente varios hallazgos de monetización:

| Hallazgo | ¿Lo cierra Etapa 5? | Detalle |
|---|---|---|
| C.2.a (`vencido`) | ⚠️ Parcial | Si `clinica_tiene_acceso()` incluye `'vencido'` en su predicado (decisión en sub-paso 5.C), queda cubierto a nivel RLS. Falta la capa TS (Bloque M1). |
| C.2.b (`suspendida`) | ✅ Sí (RLS) | `clinica_no_suspendida()` (5.C) la activa como gate RLS. Falta capa TS. |
| C.2.d (endpoints sin gate) | ⚠️ Parcial | Las RLS nuevas (5.E-5.I) son un respaldo a nivel BD. Pero los gates TS explícitos siguen siendo necesarios para UX (mensaje claro vs error genérico). |
| C.2.e (sin RLS de respaldo) | ✅ Sí | Etapa 5 implementa precisamente las RLS de respaldo. |
| C.3 | ✅ Sí (5.C) | Resuelto por diseño: `clinica_dentro_de_limite()` cuenta el total a propósito (Camino 2). Ya NO es acción pendiente de §6. |
| C.4.a, C.4.b, C.5 | ❌ No | Son ortogonales al refactor de roles. Se resuelven íntegramente en esta sección. |

**Conclusión:** tras Etapa 5, esta sección §6 se reduce esencialmente a:
- Bloque M1 enfocado en la capa TypeScript (las RLS ya estarán).
- Bloque M2 completo (no tocado por Etapa 5) y Bloque M3 reducido al contador "N de 5" (C.5); el filtro de soft-delete (C.3) ya quedó resuelto por diseño en 5.C.

---

## 7. Riesgos y mitigaciones

Etapa 5 es la etapa de mayor riesgo del refactor: toca RLS de BD productiva con datos clínicos reales. Esta sección consolida las lecciones, los patrones a evitar y el plan de rollback.

### 7.1 Lecciones de Phase 8.1 (recursión RLS)

**Qué fue Phase 8.1:** un intento previo (mayo 2026) de implementar verificación de acceso premium vía RLS. Fue revertida.

**Qué salió mal:** la implementación hacía `SELECT count(*) FROM pacientes` dentro de una policy `WITH CHECK` de la propia tabla `pacientes`. Esto generó **recursión silenciosa**: cada evaluación de la policy disparaba un conteo que a su vez evaluaba la policy. El problema NO se manifestó inmediatamente; se detectó ~24 horas después por degradación de performance.

**Por qué es peligroso:** la recursión RLS no produce un error claro en el momento. Se manifiesta como lentitud progresiva, lo que hace el diagnóstico difícil y tardío.

**Lecciones aplicables a Etapa 5:**

1. **Nunca auto-referenciar una tabla dentro de su propia policy.** Si la policy de `pacientes` necesita información de `pacientes`, debe obtenerla vía una función `SECURITY DEFINER` que rompa el ciclo de evaluación de RLS.
2. **Las funciones `SECURITY DEFINER` con owner `postgres` (superusuario, BYPASSRLS) ejecutan su cuerpo saltándose la RLS.** Por eso pueden consultar con seguridad **incluso la misma tabla** que la policy que las invoca: su `SELECT` interno no re-dispara las policies de esa tabla. Lo que causó la recursión de Phase 8.1 fue un `count(*)` **inline en el predicado de la policy** (contexto `SECURITY INVOKER`, RLS activa), no una función `SECURITY DEFINER`.
3. **Validar performance después de aplicar policies**, no solo funcionalidad. Revisar tiempos de respuesta y logs de Supabase.
4. **Las columnas declarativas en la tabla padre** (ej. `clinicas.ha_tenido_acceso_premium`) evitan conteos recursivos. En lugar de "contar pacientes para saber si tiene acceso premium", se lee un booleano ya calculado.

### 7.2 Patrones a evitar

| ❌ Patrón peligroso | ✅ Alternativa segura |
|---|---|
| `SELECT`/`count(*)` **inline en el predicado de la policy** (contexto `SECURITY INVOKER`, RLS activa), sobre todo si consulta la propia tabla restringida | Encapsular ese `SELECT` en una función `SECURITY DEFINER` (owner `postgres`, BYPASSRLS) llamada desde la policy: puede consultar incluso la misma tabla sin recursión |
| Conteos dinámicos dentro de policies (`count(*)`) | Columnas declarativas pre-calculadas en tabla padre |
| `PERMISSIVE` + `OR` que diluye una restricción | `RESTRICTIVE` para gates ortogonales (suspensión, límite) |
| Funciones sin `SECURITY DEFINER` que tocan tablas restringidas | Funciones `SECURITY DEFINER` + `STABLE` + `SET search_path` |
| Policies con lógica duplicada copiada en cada tabla | Helpers centralizados (`soy_admin_de_clinica()`, etc.) |
| Aplicar varias policies a la vez sin validar entre cada una | Aplicar sub-paso por sub-paso, validar antes de continuar |
| `BEGIN/COMMIT` manual en Supabase SQL Editor | `DO` block atómico (lección Bitácora #100) |

> **Aclaración (corrige el patrón previo):** el peligro NO es que una función `SECURITY DEFINER` consulte la misma tabla que la policy que la usa — eso es seguro cuando la función tiene owner `postgres` (BYPASSRLS), porque su cuerpo se ejecuta saltándose la RLS. El patrón realmente peligroso es poner el `SELECT`/`count(*)` **inline en el predicado de la policy** (se evalúa como el usuario invocante, con RLS activa), que fue exactamente la causa de la recursión de Phase 8.1.

### 7.3 Plan de rollback general

> **Relación con el protocolo de ejecución (D-T6):** la decisión D-T6 (§3.1) establece un protocolo de 9 pasos por sub-paso de BD. Este plan de rollback es el componente de contención de ese protocolo. El paso 2 del protocolo (escribir el script DOWN antes de aplicar) y el paso 8 (rollback si el smoke test falla) se apoyan directamente en las 3 capas descritas aquí.

Etapa 5 usa una estrategia de rollback en 3 capas (decisión D6-C):

#### Capa 1 — Snapshot lógico por sub-paso

Antes de cada sub-paso que modifica BD, se captura un snapshot lógico (definición textual de las policies/funciones actuales mediante query a `pg_policies` / `pg_proc`). Si el sub-paso falla, las policies originales se re-crean desde este snapshot.

**Cobertura:** rollback granular de un sub-paso individual.

#### Capa 2 — `DO` block atómico

Cada cambio se aplica dentro de un `DO` block con pre-flight y post-flight checks. Si cualquier check falla, el bloque hace `RAISE EXCEPTION` y PostgreSQL revierte automáticamente toda la transacción.

**Cobertura:** atomicidad dentro de un sub-paso (nunca queda a medias).

#### Capa 3 — Backup de Supabase Pro

Backups automáticos de Supabase Pro como red final. Si algo se rompe de forma no prevista por las capas 1-2, se restaura a un backup anterior.

**Cobertura:** desastre total no anticipado.

#### Matriz de decisión de rollback

| Situación | Capa a usar |
|---|---|
| Un sub-paso falla durante su `DO` block | Capa 2 (automático) |
| Un sub-paso se aplicó pero el smoke test falla | Capa 1 (restaurar desde snapshot) |
| Varios sub-pasos aplicados, se detecta problema sistémico | Capa 3 (backup) + re-planeación |
| Recursión RLS detectada horas después | Capa 1 del sub-paso culpable, o Capa 3 si no se identifica |

#### Riesgos residuales reconocidos

- **Backfill de `paciente_medico` (sub-paso 5.B):** es el punto más delicado de Etapa 5. Si el backfill pierde o duplica filas, médicos dejan de ver pacientes suyos (o ven ajenos). El rollback es `DROP TABLE paciente_medico` y re-ejecutar, pero exige detectar el error a tiempo. Mitigación: verificación de conteos (filas insertadas == pacientes con `medico_id` no nulo) y simulación previa del backfill.
- **Cambios en código TS (sub-pasos 5.E y 5.G):** el rollback de código es vía `git revert`, independiente del rollback de BD. En 5.E (integración del INSERT de `paciente_medico` + métricas) y 5.G (8 formularios) los cambios TS y de BD deben revertirse de forma coordinada — revertir solo uno de los dos deja el sistema inconsistente.
- **Brecha residual de Storage (sub-paso 5.K):** el path `{paciente_id}/{filename}` de `documentos-pdf` no permite discriminar por médico, solo por paciente. Dos médicos que comparten un paciente podrían acceder a archivos uno del otro si conocen el path. Es una limitación aceptada conscientemente (ver §5.K), no un fallo de rollback: el acceso cross-clínica sí queda cerrado.
- **Cambio de comportamiento M:N (sub-paso 5.E):** tras 5.E, los médicos invitados dejan de ver todos los pacientes de la clínica. No es un error ni requiere rollback — es el comportamiento buscado (D-T5) — pero es un cambio visible para los usuarios; conviene tenerlo presente al validar.
- **Ventana entre sub-pasos:** entre la aplicación de un sub-paso y el siguiente, el sistema puede quedar en un estado intermedio coherente pero no final. Mitigación: cada sub-paso se diseña para dejar el sistema funcional, no roto.

---

## 8. Bitácora de ejecución

_Esta sección se llena durante la ejecución de Etapa 5._

### Hotfix 5.D — Bug soft delete (aplicado 2026-05-20)

- ✅ Snapshot lógico capturado
- ✅ DO block atómico ejecutado
- ✅ Policy `pacientes_select_inactivos_admin` actualizada
- ✅ Smoke test producción confirmado
- 🟡 Pendiente: registrar migración en `supabase/migrations/` con timestamp

### Sub-paso 5.B — DDL del modelo de visibilidad (aplicado 2026-05-21)

Ejecutado en 3 migraciones bajo protocolo D-T6, todas aplicadas y verificadas en producción:

- ✅ **5.B.1** — `consultas.medico_id` + FK + índice — commit `1e7ea9f`
- ✅ **5.B.2** — tabla `paciente_medico` (M:N) + backfill — commit `ff4b0d2`
- ✅ **5.B.3** — trigger latch `ha_tenido_acceso_premium` — commit `cf632c9`

**Siguiente sub-paso:** 5.C (crear los 6 helpers `SECURITY DEFINER`).

### Sub-paso 5.C — 6 helpers `SECURITY DEFINER` (aplicado 2026-05-22)

Ejecutado en 1 migración (`20260522_etapa5c_helpers_rls.sql`) bajo protocolo D-T6, aplicada y verificada en producción. 6 helpers creados:

- ✅ `soy_medico_tratante(uuid)` — base de la visibilidad M:N de pacientes.
- ✅ `paciente_pertenece_a_mi_clinica(uuid)` — pertenencia de un paciente a la clínica del usuario.
- ✅ `soy_admin_de_clinica()` — centraliza `role='medico' AND es_admin_de_clinica=true`.
- ✅ `clinica_no_suspendida()` — gate de suspensión.
- ✅ `clinica_dentro_de_limite()` — **GATE 1** (tope de pacientes).
- ✅ `clinica_tiene_acceso()` — **GATE 2** (bloqueo solo-lectura de clínicas degradadas).

**Patrón:** `LANGUAGE sql`, `STABLE`, `SECURITY DEFINER`, `SET search_path` explícito, `owner=postgres` (bypass anti-recursión). Todos fail-closed (devuelven `false` ante `auth.uid()` o clínica nula).

**Verificación:** chunks 1-3 verificados; smoke test de los 6 con sesión simulada. Commit `27a5229`.

**Siguiente sub-paso:** 5.E (policies de `pacientes` + `paciente_medico`).

### Sub-paso 5.E — Modelo médico-paciente M:N en `pacientes` (aplicado 2026-05-24)

Ejecutado en 5 pasos (orden D5) bajo protocolo D-T6, todos aplicados y verificados en producción. Activa la visibilidad médico-paciente M:N para la tabla `pacientes`:

- ✅ **Paso 1 — BD-2** — 3 policies RLS de la tabla de unión `paciente_medico` — commit `26cb331`.
- ✅ **Paso 2 — TS-1a** — RPC `crear_paciente_con_medico` (`SECURITY DEFINER`) — commit `ba5b79f`.
- ✅ **Paso 3 — TS-1b** — `route.ts` llama al RPC + 5 componentes + gate soft-delete — commit `88449fd`.
- ✅ **Paso 4 — Backfill** — 6 vínculos M:N de pacientes huérfanos — commit `ba6b714`.
- ✅ **Paso 5 — BD-1** — 5 policies RLS de `pacientes` con visibilidad M:N — commit `c4981b4`.

**Verificación:** post-flight de cada paso + smoke test de los 4 roles (médico invitado ve solo sus pacientes; admin y secretaria ven todos; aislamiento entre clínicas confirmado).

🟡 **Deuda pendiente:** quedan 2 pacientes de prueba en producción ("Refactor Roles" archivado, "Refactor 2" activo) pendientes de hard-delete.

**Siguiente sub-paso:** DUP-RPC (ver entrada siguiente).

### Sub-paso DUP-RPC — Detección de duplicados M:N-aware (aplicado 2026-05-26)

Ejecutado con la estrategia V3 (RPC con nombre nuevo). De 4 pasos, los 3 primeros aplicados y verificados en producción; el Paso 4 está programado como último paso de la Etapa 5.

- ✅ **Paso 1 — RPC v2** — RPC `crear_paciente_con_medico_v2` (`SECURITY DEFINER`) con detección de duplicados clínica-wide, creado en producción — commit `82fe223`.
- ✅ **Paso 2 — Código** — `route.ts` apunta al RPC v2, endpoint nuevo `POST /api/pacientes/[id]/vincular`, 3 componentes con modal de 3 acciones y texto por rol — commit `ab1c587`.
- ✅ **Paso 3 — Verificación en producción** — smoke test del camino médico end-to-end (detección de duplicado, vinculación como médico invitado, modo D-E).
- ⏳ **Paso 4 — DROP de la función vieja** — `DROP FUNCTION crear_paciente_con_medico(jsonb, uuid)`. Programado como último paso antes de cerrar la Etapa 5 (tras 5.L); la función vieja se conserva como red de rollback hasta entonces.

**Verificación:** smoke test en producción — la detección de duplicados clínica-wide funciona; la vinculación M:N es exitosa; el modo D-E (paciente que ya es propio del médico) verificado.

🟡 **Límite conocido:** una secretaria no puede vincular un paciente vía `/vincular` (la RLS de SELECT de `paciente_medico` la rechaza en el `.upsert()`). Workaround: el médico invitado vincula desde su propia cuenta. Edge case aceptado.

**Siguiente sub-paso:** 5.F — reescribir las policies de `consultas`.

---

_Fin del documento (en construcción)._
