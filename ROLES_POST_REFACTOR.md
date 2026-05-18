# Esquema completo del sistema de roles post-refactor

> **Documento de referencia funcional del sistema de roles de Spinus después del refactor.**
>
> Integra todas las decisiones D1-D10, los hallazgos del scouting (83 entradas de bitácora), la corrección del modelo del super_admin como rol puramente administrativo de plataforma, y la clarificación del modelo de tipos de cuenta (independiente vs clinica) con sus invariantes asociados.
>
> **Propósito:** servir como referencia única del comportamiento esperado del sistema. Cada cambio en el refactor debe alinearse con este modelo.
>
> **Última actualización:** durante Etapa 2 del refactor, clarificación del modelo de tipos de cuenta.

---

## Tabla de contenidos

1. [Modelo conceptual de roles](#1-modelo-conceptual-de-roles)
2. [Matriz de permisos completa](#2-matriz-de-permisos-completa)
3. [Modelo del super_admin (administrativo)](#3-modelo-del-super_admin-administrativo)
4. [Estados de clínica y bloqueos](#4-estados-de-clinica-y-bloqueos)
5. [Flujos operativos](#5-flujos-operativos)
6. [UI y experiencia diferenciada](#6-ui-y-experiencia-diferenciada)
7. [Resumen visual del modelo](#7-resumen-visual-del-modelo)
8. [Invariantes del sistema](#8-invariantes-del-sistema)
9. [Casos de prueba post-refactor](#9-casos-de-prueba-post-refactor)

---

## 1. Modelo conceptual de roles

### 1.1 Estructura de roles (3 roles funcionales + 1 capacidad ortogonal)

```
profiles.role               → enum {super_admin, medico, secretaria}
profiles.es_admin_de_clinica → boolean (solo aplicable cuando role=medico)
```

### 1.2 Combinaciones válidas

| role | es_admin_de_clinica | clinica_id |
|---|---|---|
| `super_admin` | false | NULL |
| `medico` | false | requerido |
| `medico` | true (admin de clínica) | requerido |
| `secretaria` | false | requerido |

### 1.3 Combinaciones inválidas (rechazadas)

- `secretaria + es_admin_de_clinica=true` → imposible
- `super_admin + es_admin_de_clinica=true` → redundante
- `medico` sin `clinica_id` → obligatorio tener clínica
- `super_admin` con `clinica_id` no NULL → super_admin nunca pertenece a clínica

### 1.4 Identidad y propiedad

| Rol | Identidad | Pertenencia | Universo de datos |
|---|---|---|---|
| `super_admin` | Solo Angel (1 cuenta) | NO pertenece a clínica | Plataforma Spinus (administrativo, sin acceso a app médica) |
| `medico` | Médico operativo | Pertenece a 1 clínica | Solo SUS pacientes + datos clínicos propios |
| `medico + es_admin_de_clinica` | Médico que administra | Pertenece a 1 clínica | Sus pacientes + privilegios admin sobre clínica |
| `secretaria` | Personal administrativo | Pertenece a 1 clínica | TODOS los pacientes de su clínica (sin datos clínicos sensibles) |

### 1.5 Cardinalidad esperada

```
super_admin   → 1 (Angel, único)
medico        → 1+ por clínica (al menos 1 dueño)
admin_clinica → 1 por clínica (típicamente, mínimo)
                1-3 por clínica multi-usuario VIP
secretaria    → 0-N por clínica (depende del plan/VIP)
```

### 1.6 Mapeo plan → tipo de cuenta

**Regla fundamental:** el `tipo` de la clínica refleja su composición real de personal, NO es etiqueta arbitraria. Los planes definen capacidad comercial; la presencia/ausencia de secretaria define el tipo.

| Plan | Tipo esperado | max_medicos | max_secretarias | Comentario |
|---|---|---|---|---|
| `free` | `independiente` | 1 | 0 | Plan gratuito, médico solo |
| `individual` | `independiente` | 1 | 0 | Plan pagado para médico solo (Dr. Ancona TYO, Dra. Ilse) |
| `basica` | `clinica` | 2-3 (TBD) | 1+ (TBD) | Plan multi-usuario nivel entrada |
| `pro` | `clinica` | 5+ (TBD) | 2+ (TBD) | Plan multi-usuario intermedio |
| `premium` | `clinica` | 10+ (TBD) | 3+ (TBD) | Plan multi-usuario superior |

**Reglas:**

- Plan `individual` y `free`: cuentas individuales con UN solo médico. **NO permiten invitar secretarias ni médicos extras** sin pasar por VIP o upgrade comercial.
- Plan `basica`/`pro`/`premium`: cuentas multi-usuario que requieren al menos UNA secretaria para considerarse "clínica" en el sentido del producto.
- Los valores específicos de `max_medicos`/`max_secretarias` para los planes comerciales son TBD (a definir cuando se comercialicen).

### 1.7 Regla crítica: invariante de secretaria para tipo='clinica'

**Una cuenta SOLO puede ser `tipo='clinica'` si tiene al menos 1 secretaria activa.**

Razón funcional: una cuenta con múltiples médicos sin secretaria es solo "múltiples consultorios individuales agrupados en una cuenta", lo cual rompe la lógica del modelo de producto. La secretaria es la **piedra angular** que define la "clínica" como unidad operativa.

**Implicaciones:**

- Cuenta sin secretaria → **NO puede tener tipo='clinica'**
- Cuenta sin secretaria → **NO puede tener más de 1 médico**
- Upgrade a multi-usuario (vía plan comercial o VIP) **DEBE incluir invitación de secretaria como primer paso**
- Si super_admin otorga VIP con `max_medicos > 1`, también debe asegurar `max_secretarias >= 1`

Ver **Sección 8: Invariantes 17 y 18** para enforcement formal.

---

## 2. Matriz de permisos completa

### 2.1 Convenciones

- ✅ **Permitido sin condición**
- ✅ propios → Solo sobre recursos propios (`medico_id = auth.uid()`)
- ✅ todos clínica → Sobre todos los recursos de la clínica del usuario
- ❌ **Bloqueado por RLS**
- 🚫 **Bloqueado por validación de aplicación**
- ⛔ **Bloqueado adicionalmente por estado de clínica** (excedida, cancelada, suspendida)
- 🔧 **Vía endpoint específico de super_admin** (no por RLS general)

### 2.2 Pacientes (tabla `pacientes`)

| Acción | super_admin | medico | medico+admin_clinica | secretaria |
|---|---|---|---|---|
| Ver pacientes de la clínica (lista admin) | 🔧 datos no sensibles | ❌ otros médicos | ❌ otros médicos | ✅ todos |
| Ver propios pacientes | N/A | ✅ | ✅ | N/A |
| Ver pacientes inactivos | 🔧 lista admin | ❌ | ✅ todos clínica | ❌ |
| Crear paciente | ❌ | ✅ asignado a sí mismo ⛔ | ✅ asignado a sí mismo ⛔ | ✅ con dropdown obligatorio ⛔ |
| Modificar datos administrativos | ❌ | ✅ propios ⛔ | ✅ propios ⛔ | ✅ todos clínica ⛔ |
| Modificar datos clínicos | ❌ | ✅ propios ⛔ | ✅ propios ⛔ | 🚫 bloqueado por trigger |
| Eliminar paciente (soft delete) | ❌ excepto LFPDPPP | ✅ propios ⛔ | ✅ propios ⛔ | ❌ |
| Hard DELETE paciente | ⚠️ solo emergencias formales | ❌ | ❌ | ❌ |
| Restaurar paciente (activo=true) | ❌ excepto LFPDPPP | ✅ propios ⛔ | ✅ todos clínica ⛔ | ❌ |
| Rectificar datos (LFPDPPP) | 🔧 vía solicitud ARCO formal | ❌ | ❌ | ❌ |
| Anonimizar paciente (LFPDPPP) | 🔧 vía solicitud ARCO formal | ❌ | ❌ | ❌ |

**Notas:**
- "Datos administrativos" = nombre, apellidos, teléfono, email, dirección, fecha_nacimiento, sexo, número_expediente
- "Datos clínicos" = peso_kg, talla_cm, imc, ant_patologicos, ant_quirurgicos, ant_familiares, alergias, medicamentos_actuales
- Trigger `BEFORE UPDATE` bloquea modificación de campos clínicos por secretarias

### 2.3 Consultas (tabla `consultas`)

| Acción | super_admin | medico | medico+admin_clinica | secretaria |
|---|---|---|---|---|
| Ver/leer consultas | ❌ | ✅ de sus pacientes | ✅ de sus pacientes | ❌ |
| Crear consulta | ❌ | ✅ de sus pacientes ⛔ | ✅ de sus pacientes ⛔ | ❌ |
| Modificar consulta | ❌ | ✅ de sus pacientes ⛔ | ✅ de sus pacientes ⛔ | ❌ |
| Eliminar consulta | ❌ | ✅ de sus pacientes ⛔ | ✅ de sus pacientes ⛔ | ❌ |
| Ver conteos agregados | 🔧 dashboard | ❌ | ❌ | ❌ |

**Decisión Q3:** secretaria sin acceso TOTAL a consultas (ni lectura).

### 2.4 Documentos (tabla `documentos`)

| Acción | super_admin | medico | medico+admin_clinica | secretaria |
|---|---|---|---|---|
| Ver documentos (todos los tipos) | ❌ | ✅ de sus pacientes | ✅ de sus pacientes | ❌ |
| Crear documento | ❌ | ✅ de sus pacientes ⛔ | ✅ de sus pacientes ⛔ | ❌ |
| Modificar documento | ❌ | ✅ de sus pacientes ⛔ | ✅ de sus pacientes ⛔ | ❌ |
| Eliminar documento | ❌ | ✅ de sus pacientes ⛔ | ✅ de sus pacientes ⛔ | ❌ |
| Ver conteos agregados | 🔧 dashboard | ❌ | ❌ | ❌ |

**Decisión Q3:** secretaria sin acceso a documentos, INCLUYENDO notas de honorarios. Privacidad clínica máxima.

### 2.5 Citas / Agenda (tabla `appointments`)

| Acción | super_admin | medico | medico+admin_clinica | secretaria |
|---|---|---|---|---|
| Ver citas | ❌ | ✅ propias | ✅ todas clínica | ✅ todas clínica |
| Crear citas propias | ❌ | ✅ ⛔ | ✅ ⛔ | N/A |
| Crear citas (de cualquier médico) | ❌ | ❌ | ❌ | ✅ ⛔ |
| Modificar citas propias | ❌ | ✅ ⛔ | ✅ ⛔ | ✅ todas ⛔ |
| Modificar citas de otros médicos | ❌ | ❌ | ❌ | ✅ ⛔ |
| Eliminar citas | ❌ | ✅ propias ⛔ | ✅ propias ⛔ | ✅ todas clínica ⛔ |
| Ver conteos agregados | 🔧 dashboard | ❌ | ✅ propias | ❌ |

**Nota:** Médico admin de clínica VE todas pero solo MODIFICA las suyas (limitación de propiedad).

### 2.6 Mediciones de analitos (tabla `mediciones_analitos`)

| Acción | super_admin | medico | medico+admin_clinica | secretaria |
|---|---|---|---|---|
| Ver mediciones | ❌ | ✅ de sus pacientes | ✅ de sus pacientes | ❌ |
| Crear/modificar/eliminar | ❌ | ✅ de sus pacientes ⛔ | ✅ de sus pacientes ⛔ | ❌ |

### 2.7 Calculadora resultados (tabla `calculadora_resultados`)

| Acción | super_admin | medico | medico+admin_clinica | secretaria |
|---|---|---|---|---|
| Ver / crear / modificar / eliminar | ❌ | ✅ de sus pacientes ⛔ | ✅ de sus pacientes ⛔ | ❌ |

### 2.8 Profiles (la propia tabla)

| Acción | super_admin | medico | medico+admin_clinica | secretaria |
|---|---|---|---|---|
| Ver profile propio | ✅ | ✅ | ✅ | ✅ |
| Ver profiles de la misma clínica | 🔧 lista admin | ✅ | ✅ | ✅ |
| Ver profiles de otra clínica | 🔧 lista admin | ❌ | ❌ | ❌ |
| Modificar profile propio | ✅ | ✅ | ✅ | ✅ |
| Modificar profile de otro | 🔧 vía endpoint | ❌ | ❌ | ❌ |
| Crear profile (signup) | N/A (es flujo público) | N/A | N/A | N/A |
| Crear profile (invitación) | 🔧 vía endpoint | ❌ | ✅ ⛔ | ❌ |
| Eliminar profile | 🔧 vía endpoint | ❌ | ❌ | ❌ |
| Marcar `es_admin_de_clinica` | 🔧 vía endpoint | ❌ | ❌ | ❌ |

### 2.9 Clínica (tabla `clinicas`)

| Acción | super_admin | medico | medico+admin_clinica | secretaria |
|---|---|---|---|---|
| Ver clínica propia | 🔧 todas | ✅ la propia | ✅ la propia | ✅ la propia |
| Modificar nombre/branding (logo, colores) | 🔧 | ❌ | ✅ | ❌ |
| Modificar horario de atención | 🔧 | ❌ | ✅ | ❌ |
| Modificar plan/suscripción | 🔧 | ❌ | ✅ vía Stripe | ❌ |
| Modificar `es_vip_grant` | 🔧 | ❌ | ❌ | ❌ |
| Modificar `suspendida` | 🔧 | ❌ | ❌ | ❌ |
| Modificar `max_medicos`/`max_secretarias` | 🔧 | ❌ | ❌ | ❌ |
| Eliminar clínica | 🔧 | ❌ | ❌ | ❌ |

### 2.10 Stripe (Billing)

| Acción | super_admin | medico | medico+admin_clinica | secretaria |
|---|---|---|---|---|
| Acceder a Customer Portal | ❌ | ❌ | ✅ | ❌ |
| Iniciar checkout (cambiar plan) | ❌ | ❌ | ✅ | ❌ |
| Cancelar suscripción | ❌ | ❌ | ✅ | ❌ |
| Ver invoices/historia | 🔧 datos agregados | ❌ | ✅ propios | ❌ |

### 2.11 Gestión de equipo

| Acción | super_admin | medico | medico+admin_clinica | secretaria |
|---|---|---|---|---|
| Listar usuarios de la clínica | 🔧 | ❌ | ✅ | ❌ |
| Invitar usuario nuevo (médico/secretaria) | 🔧 | ❌ | ✅ ⛔ | ❌ |
| Eliminar usuario de la clínica | 🔧 | ❌ | ✅ | ❌ |
| Cambiar rol de usuario | 🔧 | ❌ | ❌ | ❌ |

**Notas:**
- ⛔ Invitar bloqueado si clínica excedida o sin VIP
- Cambiar rol (medico ↔ secretaria) solo super_admin (cambio crítico)

### 2.12 Métricas y reportes

| Acción | super_admin | medico | medico+admin_clinica | secretaria |
|---|---|---|---|---|
| Ver métricas globales (toda la BD) | ✅ | ❌ | ❌ | ❌ |
| Ver métricas de su clínica | 🔧 | ✅ propias | ✅ todas clínica | ❌ |
| Funciones `sa_*` (audit, heatmap, ranking) | ✅ | ❌ | ❌ | ❌ |
| Dashboard super_admin | ✅ | ❌ | ❌ | ❌ |

### 2.13 LFPDPPP (Cumplimiento normativo)

| Acción | super_admin | medico | medico+admin_clinica | secretaria |
|---|---|---|---|---|
| Rectificar datos paciente (derecho ARCO) | 🔧 vía solicitud formal | ❌ | ❌ | ❌ |
| Anonimizar paciente (derecho ARCO) | 🔧 vía solicitud formal | ❌ | ❌ | ❌ |
| Crear solicitud ARCO | 🔧 | ❌ | ❌ | ❌ |
| Procesar solicitud ARCO | 🔧 | ❌ | ❌ | ❌ |

---

## 3. Modelo del super_admin (administrativo)

### 3.1 Principio fundamental

**super_admin es un rol PURAMENTE ADMINISTRATIVO de la plataforma Spinus.** No es un médico, no es personal clínico, no opera dentro de la app médica.

```
SUPER_ADMIN = "Plataforma de administración" (Spinus operations)
              ↓ separado de ↓
PERSONAL CLÍNICO (medico/secretaria) = "Aplicación médica"
```

Son **dos universos separados** que se comunican vía métricas agregadas y gestión de cuentas, pero NO comparten acceso a datos clínicos.

### 3.2 Lo que SÍ puede hacer el super_admin

#### Métricas y reportes
- Dashboard global de Spinus
- Conteos agregados: clínicas, médicos, secretarias, pacientes (totales)
- Ranking de uso
- Heatmaps de actividad
- Funciones `sa_*` para audit log y métricas
- Análisis financiero (revenue Stripe agregado)

#### Gestión administrativa de clínicas
- Crear/editar/borrar clínicas
- Otorgar/retirar VIP (`es_vip_grant`)
- Modificar `max_medicos`, `max_secretarias`, `max_pacientes`
- Suspender/reactivar (`suspendida`)
- Cambiar `tipo` de clínica
- Ver lista de profiles de cualquier clínica (datos administrativos)

#### Visibilidad de pacientes (campos administrativos no sensibles)
Lista de pacientes de cualquier clínica, mostrando ÚNICAMENTE:
- ✅ Nombre y apellidos
- ✅ Médico tratante asignado
- ✅ Fecha de creación del expediente
- ✅ Estado (activo/inactivo)
- ✅ Conteo de consultas/documentos (sin contenido)
- ✅ Última actividad (timestamp)

#### Gestión de usuarios
- Listar profiles de cualquier clínica (nombres, roles, fechas)
- Cambiar role de un profile (intervención excepcional)
- Resetear contraseñas (vía Supabase Auth)
- Eliminar profiles si necesario

#### LFPDPPP (responsabilidad legal)
- Procesar solicitudes ARCO formales
- Rectificar datos cuando hay solicitud formal
- Anonimizar pacientes cuando se requiere por ley
- Pasa por flujo formal de solicitudes, no acceso libre

#### Configuración global
- Modificar `version_aviso_privacidad`
- Configurar parámetros globales

### 3.3 Lo que NO puede hacer el super_admin

#### Acceso a expedientes médicos
- ❌ Datos clínicos de pacientes (peso, alergias, antecedentes, medicamentos)
- ❌ Lectura de consultas
- ❌ Lectura de documentos (recetas, lab, imagen, honorarios)
- ❌ Acceso al expediente clínico de ningún paciente

#### Acceso a PII sensible de pacientes
- ❌ Direcciones
- ❌ Fechas de nacimiento exactas (solo edad/década si es necesario)
- ❌ Teléfonos personales
- ❌ Emails de pacientes

#### Operación clínica directa
- ❌ Crear pacientes
- ❌ Crear consultas ni documentos
- ❌ Modificar datos médicos
- ❌ Acceso a la app médica (páginas `/pacientes/`, `/agenda/`, `/expediente/`)

#### No es médico
- No tiene cédula profesional
- No firma documentos médicos
- No es responsable clínico de nadie

### 3.4 Implementación técnica

**Las RLS NO incluyen rama para super_admin** (excepto en gestión de clínicas/profiles donde sea necesario).

**Acceso del super_admin pasa SIEMPRE por:**

1. Endpoints `/api/super-admin/*` que usan `service_role` (bypass RLS)
2. Validación de rol al inicio de cada endpoint:
   ```typescript
   if (profile.role !== 'super_admin') return Response.json({ error: 'forbidden' }, { status: 403 })
   ```
3. Cada endpoint decide qué columnas devolver (filtra PII sensible explícitamente)

**Patrón ejemplo:**

```typescript
// /api/super-admin/dashboard/pacientes/route.ts
export async function GET(req: Request) {
  const profile = await getProfile()
  if (profile.role !== 'super_admin') return Response.json({ error: 'forbidden' }, { status: 403 })

  const supabase = createServiceRoleClient()  // bypass RLS
  const { data } = await supabase
    .from('pacientes')
    .select(`
      id, nombre, apellidos, created_at, activo, medico_id,
      profiles:medico_id(nombre)
    `)  // ← solo columnas administrativas, NO clínicas
    .eq('clinica_id', clinica_id_param)

  return Response.json(data)
}
```

### 3.5 Acceso especial vía flujos formales

El super_admin SOLO puede acceder a datos sensibles vía:

- 🔓 **Solicitud ARCO formal** (con registro en tabla `solicitudes_arco`)
- 🔓 **Operaciones de borrado/anonimización** (con audit log)
- 🔓 **Funciones SECURITY DEFINER específicas** (no RLS general)

---

## 4. Estados de clínica y bloqueos

### 4.1 Ejes independientes que coexisten

Una clínica puede estar en cualquier combinación de:

| Eje | Valores | Significado |
|---|---|---|
| **Suscripción** | free / activo / cancelado | Estado actual de pago |
| **Acceso premium histórico** | `ha_tenido_acceso_premium` boolean | Si alguna vez tuvo acceso premium (one-way false→true) |
| **Override admin** | `es_vip_grant` boolean | Si tiene VIP otorgado por super_admin |
| **Capacidad equipo** | `max_medicos`, `max_secretarias` | Límites numéricos de invitaciones |
| **Suspensión** | `suspendida` boolean | Si super_admin la ha suspendido |
| **Tipo** | independiente / clinica | Refleja composición real: independiente=1 médico+0 secretarias; clinica=N médicos+1+ secretarias |

### 4.2 Categorías derivadas

```sql
-- Función conceptual
get_estado_funcional_clinica(clinica) =
  IF suspendida = true:
    RETURN 'suspendida'
  IF total_medicos > max_medicos OR total_secretarias > max_secretarias:
    RETURN 'limite_excedido'
  IF es_vip_grant = true:
    RETURN 'vip_activa'
  IF suscripcion_estado = 'activo' AND stripe_subscription_id IS NOT NULL:
    RETURN 'pago_activo'
  IF suscripcion_estado = 'cancelado' AND ha_tenido_acceso_premium = true:
    RETURN 'cancelada_con_historia'
  IF plan = 'free' AND suscripcion_estado = 'free':
    RETURN 'free_virgen'
  IF ha_tenido_acceso_premium = true AND suscripcion_estado = 'cancelado':
    RETURN 'free_degradada'
```

### 4.3 Tabla de bloqueos efectivos

| Estado funcional | Lectura | Crear/modificar/eliminar | Banner UI |
|---|---|---|---|
| `vip_activa` | ✅ | ✅ | Ninguno |
| `pago_activo` | ✅ | ✅ | Ninguno |
| `free_virgen` | ✅ | ✅ | Informativo: "Suscríbete para desbloquear..." |
| `cancelada_con_historia` | ✅ | ❌ Phase 8.1 v2 | "Tu suscripción terminó. Reactiva..." |
| `free_degradada` | ✅ | ❌ Phase 8.1 v2 | "Reactiva tu suscripción" |
| `limite_excedido` | ✅ | ❌ Bloqueo por límite | "Tu clínica excedió los límites del plan..." |
| `suspendida` | ✅ | ❌ Bloqueo por suspensión | "Tu clínica está suspendida temporalmente" |

### 4.4 Tres patrones de bloqueo coexistiendo

#### Patrón 1: Bloqueo por suscripción (Phase 8.1 v2)

```
SI ha_tenido_acceso_premium = true
   AND suscripcion_estado = 'cancelado'
   AND es_vip_grant = false
THEN bloquear creación/modificación
```

Implementación: 3 policies RESTRICTIVE en pacientes, consultas, documentos.

#### Patrón 2: Bloqueo por límite excedido

```
SI count(medicos en clinica) > max_medicos
   OR count(secretarias en clinica) > max_secretarias
THEN bloquear creación/modificación PARA TODOS los usuarios de la clínica
```

Implementación: función `clinica_dentro_de_limite()` SECURITY DEFINER.

#### Patrón 3: Bloqueo por suspensión administrativa

```
SI suspendida = true
THEN bloquear creación/modificación PARA TODOS los usuarios de la clínica
```

Implementación: función `clinica_no_suspendida()` SECURITY DEFINER.

### 4.5 Composición final de policy de creación

```sql
-- Ejemplo conceptual para pacientes_insert
CREATE POLICY pacientes_insert ON pacientes
  FOR INSERT TO authenticated
  WITH CHECK (
    clinica_id = get_clinica_id()
    AND clinica_dentro_de_limite()
    AND clinica_no_suspendida()
    AND clinica_tiene_acceso()  -- Phase 8.1 v2
    AND (
      (get_my_role() = 'medico' AND medico_id = auth.uid())
      OR (get_my_role() = 'secretaria' AND medico_id IS NOT NULL)
    )
  );
-- super_admin NO aparece aquí porque no debe crear pacientes vía app médica
```

---

## 5. Flujos operativos

### 5.1 Onboarding de nueva clínica (signup)

```
1. Usuario completa formulario de registro
2. Se crea row en auth.users (Supabase Auth)
3. Endpoint /api/auth/registro crea:
   - profile con:
     role: 'medico'                 ← NO 'admin' (post-refactor)
     es_admin_de_clinica: true      ← es dueño de su propia clínica
     clinica_id: [nueva clínica]
   - clinica con:
     plan: 'free'
     suscripcion_estado: 'free'     ← NO 'activo' (corrección de bug)
     tipo: 'independiente'
     max_medicos: 1
     max_secretarias: 0
     es_vip_grant: false
     ha_tenido_acceso_premium: false
4. Usuario aterriza en dashboard como dueño de su consultorio
```

### 5.2 Invitación de médico nuevo a clínica multi-usuario

**Pre-requisitos:**
- La clínica tiene `max_medicos > total_medicos_actuales` (vía VIP o Stripe).
- **Si será el 2do médico (o posterior): la clínica DEBE tener al menos 1 secretaria activa** (invariante de Sección 1.7).
- Si no hay secretaria todavía, el admin debe invitarla PRIMERO antes de poder invitar médicos adicionales.

```
1. Admin de clínica abre /admin/usuarios
2. Click "Invitar médico"
3. Validación previa al sistema:
   - Si total_medicos_actuales = 1 AND total_secretarias = 0:
     → RECHAZAR con mensaje "Para agregar más médicos, primero invita a una secretaria"
   - Si total_medicos_actuales >= 1 AND total_secretarias >= 1:
     → Permitir continuar
4. Llena email + nombre
5. Sistema valida:
   - clinica_dentro_de_limite() = true
   - clinica_no_suspendida() = true
   - clinica_tiene_acceso() = true
6. Envía email de invitación (vía tabla invitaciones)
7. Médico invitado completa registro
8. Se crea profile con:
   role: 'medico'
   es_admin_de_clinica: false   ← NO es admin, solo médico invitado
   clinica_id: [clínica del invitador]
9. Médico nuevo puede hacer login y ver su área de trabajo
10. tipo de clínica se actualiza a 'clinica' (si era 'independiente' antes)
```

### 5.3 Invitación de secretaria

**Pre-requisitos:**
- La clínica tiene `max_secretarias > 0` (vía VIP o plan comercial).
- Es la **primera acción de upgrade** hacia tipo='clinica' multi-usuario. Las secretarias son la piedra angular del modelo.

```
1. Admin de clínica abre /admin/usuarios
2. Click "Invitar secretaria"
3. Llena email + nombre
4. Sistema valida límites
5. Envía invitación
6. Secretaria completa registro
7. Profile creado con:
   role: 'secretaria'
   es_admin_de_clinica: false
   clinica_id: [clínica]
8. Secretaria entra al sistema y ve dashboard de agenda
9. tipo de clínica se actualiza a 'clinica' si era 'independiente'
   (la presencia de secretaria define el tipo)
```

**Importante:** una clínica `independiente` que invita a su primera secretaria se convierte en `clinica`. Es transición unidireccional natural (no requiere acción manual del admin).

### 5.4 Creación de paciente

#### Flujo A: Médico crea paciente desde formulario completo

```
1. Médico abre /pacientes/nuevo
2. Llena datos
3. Submit (medico_id NO se envía, lo asigna backend)
4. Backend recibe request:
   - profile.role === 'medico' → asigna medico_id = auth.uid()
   - Verifica clinica_dentro_de_limite, clinica_no_suspendida, clinica_tiene_acceso
5. Si todo válido → INSERT con medico_id = profile.id
6. Si bloqueado → 403 Forbidden con mensaje específico
```

#### Flujo B: Secretaria crea paciente

```
1. Secretaria abre /pacientes/nuevo
2. Llena datos + selecciona médico del dropdown (REQUIRED)
3. Submit (medico_id se envía con el seleccionado)
4. Backend:
   - profile.role === 'secretaria'
   - body.medico_id presente y válido → procede
   - Si body.medico_id ausente → 400 Bad Request "Selecciona un médico"
5. Verifica límites/suspensión/acceso
6. INSERT con medico_id = body.medico_id
```

#### Flujo C: Quick modals (bloqueados para secretaria)

```
QuickPatientModal y ConsultaRapidaModal:
- Si profile.role === 'secretaria': mostrar mensaje "Usa el formulario completo"
- Si profile.role === 'medico' o 'super_admin': funcionar normal
```

### 5.5 Soft delete de paciente

```
1. Médico (dueño del paciente) click "Eliminar paciente"
2. UI muestra confirmación
3. Frontend ejecuta UPDATE pacientes SET activo=false, fecha_baja=now() WHERE id = X
4. RLS valida:
   - profile.role === 'medico' AND medico_id = auth.uid() → permitido
   - clinica_dentro_de_limite, etc.
5. Paciente desaparece de listas activas
6. Aparece en lista "Inactivos" para médico admin de clínica
7. Datos clínicos (consultas, documentos) se preservan
```

### 5.6 Restauración de paciente

```
1. Médico admin de clínica entra a /pacientes/inactivos
2. Ve listado de pacientes con activo=false de su clínica
3. Click "Restaurar"
4. UPDATE pacientes SET activo=true, fecha_baja=null WHERE id = X
5. RLS valida ownership o admin_clinica
6. Paciente vuelve a listas activas
```

### 5.7 Otorgamiento de VIP (super_admin)

**Pre-validación obligatoria:** si se quiere otorgar `max_medicos > 1`, debe garantizarse `max_secretarias >= 1` (ver Sección 1.7: invariante de secretaria).

```
1. Angel (super_admin) entra a /super-admin/clinicas
2. Selecciona clínica X
3. Click "Otorgar VIP"
4. Llena: max_medicos, max_secretarias, max_pacientes (números > defaults)
5. Validación:
   - Si max_medicos > 1 AND max_secretarias < 1 → RECHAZAR (rompe invariante)
   - Si max_medicos = 1 AND max_secretarias = 0 → válido (independiente con VIP)
   - Si max_medicos > 1 AND max_secretarias >= 1 → válido (clinica con VIP)
6. Endpoint /api/super-admin/clinicas/[id]:
   UPDATE clinicas SET
     es_vip_grant = true,
     ha_tenido_acceso_premium = true,
     max_medicos = X,
     max_secretarias = Y,
     max_pacientes = Z
   WHERE id = clinica_id
7. Audit log: 'sa_otorgar_vip' con detalles
8. Clínica desbloquea capacidad de invitar usuarios
```

**Recordatorio:** otorgar VIP solo cambia los LÍMITES. NO crea automáticamente la secretaria. El admin de la clínica debe invitar a la secretaria como primer paso si quiere escalar a tipo='clinica'.

### 5.8 Retiro de VIP (super_admin)

```
1. Angel revoca VIP de clínica X
2. UPDATE clinicas SET
     es_vip_grant = false,
     max_medicos = 1,        ← reset a default
     max_secretarias = 0     ← reset a default
   WHERE id = clinica_id
3. ha_tenido_acceso_premium se mantiene true (one-way)
4. Clínica entra en estado:
   - Si stripe_subscription_id activo → "pago_activo" con nuevos límites
   - Si NO Stripe → "cancelada_con_historia" → bloqueada por Phase 8.1 v2
5. Si tiene usuarios extras: límite excedido → todos bloqueados
6. Banner global aparece para todos los usuarios de la clínica
```

### 5.9 Suspensión administrativa (super_admin)

```
1. Angel detecta clínica con problema (TOS, fraude, etc.)
2. UPDATE clinicas SET suspendida = true WHERE id = X
3. Audit log: 'sa_suspender_clinica'
4. clinica_no_suspendida() devuelve false
5. Todos los usuarios de la clínica entran en estado bloqueado
6. Banner: "Tu clínica está suspendida temporalmente"
7. Reactivación: UPDATE suspendida = false → todo vuelve normal
```

### 5.10 Cancelación de suscripción Stripe (vía webhook)

```
1. Webhook de Stripe recibe evento subscription.updated o cancelled
2. Endpoint /api/stripe/webhook actualiza:
   UPDATE clinicas SET
     suscripcion_estado = 'cancelado',
     suscripcion_ends_at = stripe.current_period_end
   WHERE stripe_customer_id = X
3. ha_tenido_acceso_premium ya estaba true → bloqueo activado
4. Si es VIP (es_vip_grant=true): NO se bloquea
5. Si NO es VIP: Phase 8.1 v2 entra en acción
6. Banner aparece: "Reactiva tu suscripción"
```

---

## 6. UI y experiencia diferenciada

### 6.1 Dashboards diferenciados por rol

| Rol | Dashboard principal |
|---|---|
| `super_admin` | `/super-admin/dashboard` (métricas globales, gestión de clínicas, audit log) |
| `medico` | `/dashboard` (vista médica: agenda, pacientes propios, accesos rápidos) |
| `medico+admin_clinica` | `/dashboard` (igual que médico + sección "Mi clínica") |
| `secretaria` | `/dashboard` (vista administrativa: agenda completa, pacientes de la clínica) |

### 6.2 Banners de bloqueo (texto sugerido)

**Cancelación con historia premium:**
> ⚠️ Tu suscripción ha terminado. Tu cuenta está en modo solo lectura. **Reactiva tu suscripción** para crear nuevos registros y restaurar acceso completo.

**Free degradada:**
> ⚠️ Has excedido el límite del plan gratuito. **Suscríbete a un plan** para continuar usando todas las funciones.

**Free virgen (informativo, no bloquea):**
> 💎 Estás usando el plan gratuito. **Suscríbete** para desbloquear todas las funciones de Spinus.

**Límite de equipo excedido:**
> ⚠️ Tu clínica ha excedido los límites del plan. Contacta a tu administrador para regularizar la situación.

**Suspensión administrativa:**
> 🔒 Tu clínica ha sido suspendida temporalmente. Por favor contacta al soporte de Spinus.

**Para usuario invitado en clínica con problemas:**
> ℹ️ Tu acceso está limitado debido al estado de la cuenta. Contacta al administrador de tu clínica.

### 6.3 Diferencias visuales por rol

| Elemento UI | super_admin | medico | medico+admin_clinica | secretaria |
|---|---|---|---|---|
| Menú principal | Solo super-admin | Estándar | Estándar + "Mi clínica" | Limitado a Agenda+Pacientes |
| App médica (`/dashboard` etc.) | ❌ no accede | ✅ | ✅ | ✅ |
| "Mi clínica" (settings) | ❌ | ❌ | ✅ | ❌ |
| Botón "Invitar usuario" | 🔧 dashboard | ❌ | ✅ | ❌ |
| Vista "Pacientes inactivos" | 🔧 dashboard (admin) | ❌ | ✅ | ❌ |
| Stripe Portal link | ❌ | ❌ | ✅ | ❌ |
| Métricas de clínica | 🔧 dashboard global | ❌ | ✅ | ❌ |
| Badge "Admin" en navbar | N/A | ❌ | ✅ | ❌ |
| Acceso a `/expediente/*` | ❌ | ✅ propios | ✅ propios | ❌ |
| Acceso a `/agenda` | ❌ | ✅ propia | ✅ todas clínica | ✅ todas clínica |

---

## 7. Resumen visual del modelo

```
┌──────────────────────────────────────────────────────────────────┐
│                    SPINUS - SISTEMA DE ROLES                     │
└──────────────────────────────────────────────────────────────────┘

SUPER_ADMIN (Angel) — PLATAFORMA
│
├─ Universo: dashboard administrativo de Spinus
├─ NO accede a app médica
├─ Visibilidad: clínicas, usuarios, pacientes (datos no sensibles)
├─ Acciones: VIP, suspensión, métricas, gestión de cuentas
└─ LFPDPPP: vía solicitudes ARCO formales (no acceso directo)


CLÍNICA INDEPENDIENTE (planes 'free' o 'individual', 1 médico solo)
│
└─ MÉDICO (rol=medico, es_admin_de_clinica=true)
   │
   ├─ Datos: SOLO sus pacientes
   ├─ Citas: SOLO suyas
   ├─ Privilegios admin: branding, Stripe, configuración
   └─ NO puede invitar usuarios (max_medicos=1, max_secretarias=0)


CLÍNICA MULTI-USUARIO (planes 'basica'/'pro'/'premium' o VIP)
REQUIERE al menos 1 secretaria (invariante 17)
│
├─ MÉDICO ADMIN (rol=medico, es_admin_de_clinica=true)
│  │
│  ├─ Sus pacientes (privacidad médica)
│  ├─ Ve TODAS las citas de la clínica
│  ├─ Privilegios admin: branding, Stripe, invitar, métricas
│  └─ PERO: solo modifica SUS citas
│
├─ MÉDICO INVITADO (rol=medico, es_admin_de_clinica=false)
│  │
│  ├─ Sus pacientes (privacidad médica)
│  ├─ Solo SUS citas
│  └─ Sin capacidades admin
│
└─ SECRETARIA (rol=secretaria)
   │
   ├─ Ve TODOS los pacientes de la clínica (admin + clínicos en tabla)
   ├─ Modifica solo datos administrativos del paciente
   ├─ Gestiona TODAS las citas de la clínica
   ├─ NO accede a consultas ni documentos
   └─ NO crea ni modifica datos clínicos


BLOQUEOS (3 patrones que coexisten)
│
├─ ⛔ Por suscripción cancelada con historia premium (Phase 8.1 v2)
├─ ⛔ Por límite de equipo excedido (todos los miembros de la clínica)
└─ ⛔ Por suspensión administrativa de super_admin

Todos: ✅ Lectura permitida, ❌ Creación/modificación/eliminación bloqueada
Excepción: super_admin opera fuera de RLS de app médica (vía endpoints admin)
```

---

## 8. Invariantes del sistema

Verdades que SIEMPRE deben cumplirse:

1. Solo existe **1 super_admin** (Angel)
2. super_admin tiene `clinica_id = NULL`
3. Todos los demás roles tienen `clinica_id NOT NULL`
4. Solo medicos pueden tener `es_admin_de_clinica = true`
5. Toda clínica tiene al menos 1 medico con `es_admin_de_clinica = true`
6. Todo paciente tiene `clinica_id` (NOT NULL post-limpieza)
7. Todo paciente activo tiene `medico_id` (asignado a alguien)
8. Las consultas y documentos heredan `clinica_id` de su paciente
9. `ha_tenido_acceso_premium` es ONE-WAY (false → true, nunca al revés)
10. La eliminación de pacientes es siempre soft delete (`activo=false`)
11. Datos clínicos solo los modifica personal médico (NUNCA secretaria)
12. LFPDPPP solo lo ejecuta super_admin vía solicitud ARCO formal
13. Cualquier creación/modificación pasa los 3 chequeos: `dentro_de_limite + no_suspendida + tiene_acceso`
14. Las RLS no contienen referencias circulares (lección Phase 8.1)
15. super_admin NO accede a datos clínicos vía RLS general (solo vía endpoints específicos)
16. super_admin NO accede a PII sensible de pacientes (direcciones, teléfonos, emails, fechas exactas)
17. **Toda clínica con `tipo='clinica'` debe tener al menos 1 secretaria activa.** Una cuenta sin secretaria es solo "múltiples consultorios solos en la misma cuenta", lo cual rompe la lógica del modelo de producto.
18. **Toda clínica con `tipo='independiente'` debe tener exactamente 1 médico y 0 secretarias.** Si supera estos límites, automáticamente pasa a `tipo='clinica'` (cuando hay al menos 1 secretaria) o entra en estado de límite excedido.
19. **System override del super_admin debe respetar el invariante 17:** si `max_medicos > 1`, entonces `max_secretarias >= 1` obligatorio. NO se puede otorgar capacidad multi-médico sin habilitar también secretarias.
20. Mapeo plan → tipo (referencia Sección 1.6):
    - `free`, `individual` → tipo='independiente' (1 médico, 0 secretarias)
    - `basica`, `pro`, `premium` → tipo='clinica' (multi-usuario con secretaria obligatoria)

---

## 9. Casos de prueba post-refactor

Antes de declarar el refactor completo, validar:

### Caso 1: Médico solo (consultorio independiente)
- ✅ Login normal
- ✅ Crea pacientes asignados a sí mismo
- ✅ Ve sus pacientes, NO de otros
- ✅ Modifica branding de su consultorio
- ❌ NO puede invitar usuarios (max_medicos=1, max_secretarias=0)
- ✅ Plan='free' o 'individual', tipo='independiente'

### Caso 2: Médico admin en clínica multi-usuario (OrtoIntegra)
- ✅ Login normal
- ✅ Sus pacientes (no los de otros médicos)
- ✅ Ve agenda de toda la clínica
- ✅ Modifica solo sus citas
- ✅ Invita médico/secretaria (si VIP)

### Caso 3: Médico invitado (Dr. Prueba en OrtoIntegra)
- ✅ Login normal
- ✅ Sus pacientes (no los de Angel)
- ❌ NO ve "Mi clínica" en menú
- ❌ NO accede a Stripe Portal

### Caso 4: Secretaria
- ✅ Login normal
- ✅ Ve todos los pacientes de la clínica
- ✅ Crea pacientes con dropdown OBLIGATORIO de médico
- ❌ NO modifica peso/alergias/antecedentes
- ❌ NO accede a `/expediente/[id]/consultas`
- ❌ NO ve recetas ni notas de honorarios
- ✅ Gestiona toda la agenda

### Caso 5: super_admin (Angel)
- ✅ Login a `/super-admin/dashboard`
- ✅ Ve métricas globales
- ✅ Ve lista de clínicas con conteos
- ✅ Ve lista de pacientes (campos no sensibles) de cualquier clínica
- ❌ NO accede a `/dashboard`, `/pacientes`, `/agenda`, `/expediente`
- ❌ NO ve datos clínicos (peso, alergias, etc.)
- ❌ NO ve direcciones, teléfonos, emails de pacientes
- ✅ Otorga/retira VIP, suspende clínicas

### Caso 6: Bloqueo Phase 8.1 v2 (cancelada con historia)
- ✅ Login normal
- ✅ Ve datos existentes
- ❌ Intenta crear paciente → 403 + banner

### Caso 7: Bloqueo por límite (todos bloqueados)
- ✅ Login normal de admin y de invitado
- ✅ Ven datos
- ❌ Ambos no pueden crear nada

### Caso 8: Suspensión
- ✅ Login normal
- ✅ Ven datos
- ❌ Bloqueo total de creación

### Caso 9: Caso edge OrtoIntegra (VIP cancelado)
- ✅ Funciona normal (`es_vip_grant` overridea cancelado)
- ✅ Crea pacientes sin problema
- ✅ Solo Angel puede modificar `es_vip_grant`

### Caso 10: Upgrade independiente → clinica (invariante 17)
- Clínica con plan='individual' + tipo='independiente' + 1 médico + 0 secretarias
- Admin intenta invitar a 2do médico → ❌ rechazo: "Primero invita a una secretaria"
- Admin invita a secretaria → ✅ aceptado, tipo cambia a 'clinica'
- Admin invita a 2do médico → ✅ aceptado (ya hay secretaria)

### Caso 11: System override de VIP por super_admin (invariante 19)
- Super_admin otorga VIP con max_medicos=3 y max_secretarias=0 → ❌ rechazo
  Mensaje: "Si max_medicos > 1, max_secretarias debe ser >= 1"
- Super_admin otorga VIP con max_medicos=3 y max_secretarias=1 → ✅ aceptado
- Super_admin otorga VIP con max_medicos=1 y max_secretarias=0 → ✅ aceptado (independiente con VIP)

---

## Apéndice: glosario de funciones SECURITY DEFINER

| Función | Propósito | Devuelve |
|---|---|---|
| `get_clinica_id()` | Obtener `clinica_id` del usuario actual | uuid |
| `get_my_role()` | Obtener `role` del usuario actual | text |
| `clinica_dentro_de_limite()` | Verificar si la clínica respeta `max_medicos` y `max_secretarias` | boolean |
| `clinica_no_suspendida()` | Verificar si la clínica NO está suspendida | boolean |
| `clinica_tiene_acceso()` | Verificar Phase 8.1 v2 (no cancelada con historia premium sin VIP) | boolean |

**Notas sobre invariantes nuevos (17-20):**

Los invariantes de tipo de cuenta (Sección 8, invariantes 17-19) se enforcearán principalmente vía **validación en aplicación TypeScript** (endpoints de invitación + system override). Opcionalmente puede agregarse un trigger BD para defensa en profundidad. Decisión final en Etapa 4/5.

---

## Apéndice: matriz consolidada de archivos a modificar en el refactor

### Migraciones SQL (por etapa)

| Etapa | Archivos SQL | Operación |
|---|---|---|
| 0 | 1 migración | DROP COLUMN `pacientes.client_id`, DROP FUNCTION `get_max_pacientes` |
| 1 | 1 migración | ADD COLUMN `es_admin_de_clinica`, `ha_tenido_acceso_premium` |
| 2 | 1 migración | Limpieza de datos productivos |
| 4 | 1 migración | Migrar admins → medicos, modificar CHECK constraint |
| 5 | 1 migración (compleja) | Reescritura completa de RLS |
| 6 | 1 migración | DROP `trial_ends_at`, modificar CHECK suscripcion_estado |

### Archivos TypeScript

| Categoría | Archivos a modificar |
|---|---|
| Endpoints signup que asignan `role='admin'` | 2 |
| Endpoint upgrade (cambia role manualmente) | 1 |
| Patrón `['admin', 'super_admin']` | 16 |
| Patrón `['medico', 'admin']` | 5 |
| Patrón `['medico', 'admin', 'super_admin']` | 4 |
| Validadores que aceptan `'admin'` | 3 |
| Dashboard UI condicional | 1 |
| Eliminar referencias a `'trial'` y `trial_ends_at` | 7 |
| Fix bug de `medico_id` en formularios de pacientes | 4 |
| Fix bug de `suscripcion_estado='activo'` en onboarding | 1 |
| Crear `src/lib/permissions.ts` con helpers | 1 (nuevo) |

**Total estimado: ~30 archivos TypeScript modificados + 6 migraciones SQL**

---

**Fin del documento.**
