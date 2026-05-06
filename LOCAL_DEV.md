# LOCAL_DEV.md — Configuración de Entorno y Estrategia de Trabajo

> Este documento describe cómo está configurado el entorno de desarrollo
> de Spinus, qué estrategia se sigue para aplicar cambios a producción,
> y las lecciones aprendidas de incidentes pasados. Lectura obligatoria
> para cualquier persona (humano o agente AI) que vaya a tocar este
> proyecto.

---

## 1. Plataforma actual

### Setup oficial (a partir del 2026-05-04)

- **Host:** Windows 11
- **Subsistema:** WSL 2 con Ubuntu 24.04 LTS
- **Usuario Linux:** `ancoa`
- **Filesystem del proyecto:** `/home/ancoa/proyectos/app_ortointegra/`
- **Editor:** VS Code con extensión `ms-vscode-remote.remote-wsl`
- **Acceso a archivos Linux desde Windows:** Explorador → Linux → Ubuntu → home → ancoa

### Por qué se migró de Windows nativo

El proyecto vivía en `C:\\Users\\Ancona\\desktop\\app_ortointegra\\`
hasta el 2026-05-04. Se migró a WSL 2 por estas razones:

1. **Compatibilidad nativa con Supabase CLI:** Supabase CLI tiene
   problemas conocidos en Windows con paths, line-endings y Docker.
2. **Eliminación de problemas crónicos de line-endings CRLF/LF:**
   Vercel y la app de producción corren en Linux. Editar en Windows
   generaba diffs fantasma en cada commit.
3. **Alineación con el entorno de producción:** Vercel deploya en
   Linux. Desarrollar en el mismo SO que producción reduce sorpresas.
4. **Mejor performance** de Node.js, npm y Docker en filesystem
   nativo de Linux.

### Backup en Windows

La copia anterior en Windows queda como **respaldo congelado**:

- **Ruta:** `C:\\Users\\Ancona\\desktop\\app_ortointegra\\`
- **Reglas:**
  - ❌ NO editar
  - ❌ NO hacer commits
  - ❌ NO hacer pulls
  - ❌ NO ejecutar `npm install` ni `npm run dev`
  - ✅ SÍ se puede consultar como referencia
  - ✅ SÍ se puede recuperar archivos olvidados

---

## 2. Versiones pinned

Estas versiones están elegidas conscientemente. **NO actualizar sin
discusión explícita.**

| Herramienta     | Versión        | Razón del pin                                   |
|-----------------|----------------|-------------------------------------------------|
| Node.js         | 24.x           | Alineado con `engines` de Vercel runtime        |
| npm             | 11.x           | Bundled con Node 24                             |
| Docker Desktop  | 29.4.1         | Última estable al momento del setup             |
| Supabase CLI    | 2.95.4         | Estable con varias semanas en el wild           |
| WSL Ubuntu      | 24.04 LTS      | Última LTS soportada                            |

### Regla de actualización

**NO usar versiones de herramientas con menos de 1 semana en el wild.**

Esta regla aplica específicamente para herramientas que tocan datos
médicos de producción (Supabase CLI, Docker, librerías de PDF, etc.).
Versiones recién publicadas pueden tener bugs no detectados que en un
proyecto médico son inaceptables.

### Procedimiento para actualizar una herramienta

1. Verificar que la nueva versión tiene >2 semanas en el wild
2. Leer changelog completo, identificar breaking changes
3. Hacer pruebas en local (NO en producción)
4. Actualizar este documento con la nueva versión y razón
5. Si la actualización corrige un bug crítico, escalar prioridad

---

## 3. Estrategia de trabajo con base de datos

### Decisión maestra: trabajo directo en producción

**Spinus NO usa entornos paralelos para desarrollo de base de datos.**
Las migraciones se aplican directamente en producción usando el SQL
Editor del Dashboard de Supabase, con smoke test inmediato y plan de
rollback explícito.

### Por qué NO se usa Supabase local (Docker)

Se intentó configurar entorno local de Supabase con Docker entre el
4 y 5 de mayo de 2026. **Falló por incompatibilidades de schema:**

- `supabase db pull` desde producción dejaba el schema local
  desincronizado con `supabase_migrations.schema_migrations`
- Las migraciones del repo (B1, B2, VIP, Phase 8.1) entraban en
  conflicto con el schema pulleado
- El CLI proponía soluciones como `migration repair --status applied`
  que escribirían en metadata de PRODUCCIÓN

**Lección:** el flujo "pull from prod → modify locally → push to prod"
no funciona limpiamente cuando el repo ya tiene migraciones aplicadas
históricas. Habría requerido reconstruir todo el flujo de migraciones
desde cero, riesgo desproporcionado al beneficio.

### Por qué NO se usa Supabase Branching

Se intentó usar Supabase Branching el 5 de mayo de 2026 como
alternativa "más segura" que el trabajo directo en producción.
**Falló por dos razones:**

1. **El branch NO replica fielmente producción:** Auth providers,
   redirect URLs, edge functions, storage policies, configuración
   de auth schema, y triggers de `auth.users` NO se clonan al branch.
   Resultado: la app no funcionaba igual en el branch que en prod.
2. **Validar refactor en branch da falsos positivos:** si el branch
   está roto por algo distinto al refactor, no se puede distinguir
   si el refactor está bien o si solo "pasa" porque el branch ya
   estaba roto.

**Lección:** branching es útil para experimentación de schema aislada
del resto del sistema, pero no para validar refactors que dependen del
comportamiento real de la app. Spinus depende fuertemente de auth y
RLS que no se replican fielmente.

### El método actual (Camino B)

Cada migración a producción sigue este flujo, **sin excepciones:**

1. **Diseño:** La migración SQL se escribe como archivo en
   `supabase/migrations/` con timestamp y nombre descriptivo.
2. **Revisión:** Se revisa la migración leyéndola completa antes de
   ejecutar. Si hay duda sobre un statement, se investiga.
3. **Plan de rollback:** Antes de aplicar, se redacta el rollback
   explícito (queries `DROP`, `ALTER`, etc. que revierten el cambio).
4. **Aplicación:** Se ejecuta la migración en SQL Editor del
   Dashboard de Supabase, **una migración a la vez**.
5. **Verificación post-aplicación:** Se ejecutan las queries `VERIFY`
   incluidas al final del archivo de migración.
6. **Smoke test funcional:** Se prueba en producción con un usuario
   real (idealmente Angel) que la funcionalidad afectada sigue
   trabajando como debería.
7. **Si algo falla:** Se ejecuta el rollback inmediatamente, sin
   demora. Se documenta el incidente en `CLAUDE.md` sección
   "Incidentes resueltos".

### Por qué este método funciona

- **Atomicidad:** una migración a la vez = blast radius mínimo
- **Smoke test inmediato:** detecta problemas en minutos, no en horas
- **Mitigación in-context:** rollback ejecutado con sesión activa
- **Sin contaminación de metadata:** no se usan `migration up`,
  `db push`, ni CLI tocando producción
- **Cero falsos positivos:** lo que pruebes está pasando en producción
  real, no en clon teóricamente igual
- **Track record probado:** B1, B2, VIP, Phase 8.1 (con su revert)
  se aplicaron exitosamente con este método

---

## 4. Cómo aplicar migraciones a producción

### Reglas hard NO negociables

1. **JAMÁS ejecutar contra producción los siguientes comandos del CLI:**
   - `supabase db pull`
   - `supabase db push`
   - `supabase migration up`
   - `supabase migration repair`
   - Cualquier comando que modifique `supabase_migrations.schema_migrations`

2. **Modificar la tabla `supabase_migrations.schema_migrations`
   requiere aprobación EXPLÍCITA de Angel** mediante mensaje del
   tipo "sí, modifica metadata de prod".

3. **Las migraciones se aplican vía SQL Editor del Dashboard,**
   nunca vía CLI ni psql directo.

4. **Una migración a la vez.** No se aplican migraciones en lote.

5. **Smoke test después de CADA migración,** no al final del lote.

6. **Si algo falla, rollback inmediato.** No se "deja para investigar
   después", se rollbackea con la sesión activa.

### Estructura de archivo de migración

Cada archivo en `supabase/migrations/` debe tener:
-- =============================================================================
-- TIMESTAMP_NOMBRE_DESCRIPTIVO.sql
-- Propósito: [descripción clara]
-- Hallazgos previos que motivan: [contexto]
-- Decisiones de producto: [qué se decidió y por qué]
-- Riesgo estimado: BAJO / MEDIO / ALTO
-- =============================================================================
-- UP
[statements de aplicación]
-- DOWN (comentado para evitar ejecución accidental)
-- [statements de rollback]
-- Verificación post-aplicación
-- [queries VERIFY comentadas]

### Convención de nombres

`YYYYMMDD_<bucket>_<numero>_<descripcion>.sql`

Ejemplos reales:
- `20260427_b1_01_clinicas_rls.sql`
- `20260430_vip_01_es_vip_grant.sql`
- `20260503_phase81_block_post_cancellation.sql`

### Convención de mensajes de commit

Formato: **Conventional Commits**

- `feat(<scope>):` para nuevas features
- `fix(<scope>):` para correcciones de bugs
- `docs(<scope>):` para cambios solo de documentación
- `revert(<scope>):` para reversos de commits previos

Body del commit debe explicar qué hace, por qué, y declarar
explícitamente si hay cambios de schema/code o no.

---

## 5. Estructura de archivos importantes

### Archivos de configuración

| Archivo                          | Propósito                                |
|----------------------------------|------------------------------------------|
| `.env.local`                     | Credenciales de PRODUCCIÓN (no git)      |
| `.env.example`                   | Plantilla pública (sí git)               |
| `CLAUDE.md`                      | Reglas para Claude Code                  |
| `LOCAL_DEV.md`                   | Este archivo                             |

### Carpeta `supabase/`

| Subcarpeta              | Propósito                                       |
|-------------------------|-------------------------------------------------|
| `supabase/baseline/`    | Snapshot histórica del schema al 2026-04-26     |
| `supabase/migrations/`  | Migraciones aplicadas a producción              |

**IMPORTANTE:** `supabase/` NO contiene `config.toml`, `.gitignore`
ni `.temp/`. Estos archivos los crea `supabase init` para uso del
CLI local, pero como NO usamos Supabase local, fueron eliminados
deliberadamente el 2026-05-06.

### Por qué `supabase/baseline/` no se actualiza

El baseline es **snapshot inmutable** del schema al 2026-04-26.
Las migraciones posteriores documentan la evolución. Para entender
el estado actual de producción:

`baseline + todas las migraciones en orden cronológico = estado actual`

Ver `supabase/baseline/README.md` sección "Evolución posterior al
baseline" para detalle de cada migración aplicada.

---

## 6. Comandos útiles del día a día

### Levantar app local apuntando a producción

```bash
cd ~/proyectos/app_ortointegra
npm install                    # solo si node_modules está desactualizado
npm run dev
```

La app va a leer `.env.local` (credenciales de prod). Acceder en
`http://localhost:3000`.

### Verificar estado del repo

```bash
git status                     # cambios pendientes
git log --oneline -10          # últimos 10 commits
git diff <archivo>             # ver cambios sin commit
```

### Conectarse a Supabase para queries ad-hoc

**Vía Dashboard (preferido):**
- https://supabase.com/dashboard
- Proyecto: orthointegra
- SQL Editor en panel izquierdo
- Verificar que dice `main / PRODUCTION` en el header antes de ejecutar

**Vía connection string (Session Pooler IPv4):**
- Host: `aws-0-us-west-2.pooler.supabase.com`
- Port: 5432
- User: `postgres.qpnegmmpneseirfyplbf`
- Password: en `.env.local`

### Verificar metadata de migraciones (read-only)

```sql
SELECT count(*) FROM supabase_migrations.schema_migrations;
-- Esperado: 0 (vacío, porque no se usa el CLI contra prod)
```

Si esa query devuelve >0, hay residuo del CLI que debe limpiarse.

---

## 7. Lecciones aprendidas (incidentes resueltos)

### Incidente 1 — Phase 8.1: recursión infinita en RLS (2026-05-04)

**Síntoma:** después de aplicar `20260503_phase81_block_post_cancellation.sql`,
la creación de pacientes en producción empezó a fallar con error
"infinite recursion detected in policy for relation pacientes".

**Causa raíz:** la policy hacía `SELECT count(*) FROM pacientes`
dentro del `WITH CHECK` de su propia policy en la tabla `pacientes`.
PostgreSQL detectó la recursión y abortó.

**Fix:** rollback completo de las 3 policies vía DROP POLICY. Documentado
en `supabase/migrations/20260504_revert_phase81_recursion.sql`.

**Lección crítica:** Las RLS policies sobre tabla X NO deben hacer
subqueries que lean de tabla X. Usar contadores externos o flags
declarativos. Esta lección VALIDA la decisión posterior de usar
`ha_tenido_acceso_premium` (declarativo) en lugar de `count(pacientes) > 5`
(inferencial recursivo).

### Incidente 2 — Filas fantasma en schema_migrations (2026-05-05 a 2026-05-06)

**Síntoma:** durante intentos de configurar Supabase local con Docker,
otro chat de Claude propuso ejecutar `supabase migration repair --status applied`
contra producción, insertando 5 filas en `supabase_migrations.schema_migrations`
de PROD. Después se ejecutó `supabase db pull` que insertó otra fila
fantasma con todo el schema serializado.

**Detección:** Angel pausó el chat al detectar que se estaban tocando
metadata de prod sin aprobación explícita.

**Limpieza:** ejecutado en 2 etapas:
- DELETE inicial de las 5 filas insertadas por `migration repair`
- DELETE específico de la fila `20260505140828` de `db pull` el 2026-05-06

**Verificación final:** `SELECT count(*) FROM supabase_migrations.schema_migrations`
devuelve 0.

**Lección crítica:** El CLI de Supabase puede modificar metadata de
producción con comandos aparentemente inocuos. **Nunca apuntar el CLI
a producción.** Trabajar siempre desde el Dashboard.

### Incidente 3 — Branch staging que no funcionaba como producción (2026-05-05)

**Síntoma:** se creó branch `roles-refactor` en Supabase Pro como
"ambiente seguro" para validar el refactor de roles. Después de
clonar schema y crear seed sintético (8 usuarios + 4 clínicas + 12 pacientes),
la app no funcionaba normalmente al apuntar a ese branch.

**Causa raíz:** Supabase Branching no replica al 100% el ambiente de
producción. Faltan: configuración de auth providers, redirect URLs,
edge functions, storage policies, triggers de `auth.users`, secrets
de Stripe webhook.

**Decisión:** se eliminó el branch el 2026-05-06 y se adoptó la
estrategia de trabajo directo en producción (descrita en sección 3).

**Lección crítica:** branching es útil para schema experimental
aislado, no para validar refactors que dependen de la integración
completa del sistema.

### Incidente 4 — Docker local con problemas de compatibilidad (2026-05-04)

**Síntoma:** intento de usar `supabase start` con Docker Desktop
para tener Postgres + Auth + Storage local. Falló porque las
migraciones del repo entraban en conflicto con el schema pulleado
de producción.

**Decisión:** se descartó el flujo de Docker local. Se mantienen
WSL + Docker Desktop instalados pero no se usan para Supabase.

**Lección crítica:** Docker local es útil para nuevos proyectos sin
historial. Para proyectos con historial de migraciones aplicadas
manualmente, reconstruir el flujo desde cero es trabajo
desproporcionado.

---

## 8. Pendientes y deuda técnica

### Refactor de roles (en planeación)

**Etapas planeadas (NO iniciadas todavía):**

1. **Etapa 1:** Schema declarativo
   - Agregar `clinicas.ha_tenido_acceso_premium boolean NOT NULL DEFAULT false`
   - Agregar `profiles.es_admin_de_clinica boolean`
   - Migrar datos históricos

2. **Etapa 2:** Nuevas RLS sin recursión
   - Reemplazar predicado `count(pacientes) > 5` por
     `ha_tenido_acceso_premium = true`
   - Reaplicar bloqueo post-cancelación (Phase 8.1 v2) usando
     el nuevo flag

3. **Etapa 3:** Refactor TypeScript
   - Actualizar `lib/subscription.ts` con nueva lógica
   - Auditar 4 endpoints API (pacientes, consultas, appointments, documentos)
   - Helpers de estados derivados

4. **Etapa 4:** Eliminar valor `admin` del enum role
   - Migrar admins existentes a `es_admin_de_clinica = true`
   - Cambiar enum check constraint
   - Refactor TypeScript correspondiente

5. **Etapa 5:** UI/UX
   - Banner "suscríbete" para free virgen
   - Banner "modo solo lectura" para free degradada
   - Banner "contacta a tu admin" para médicos invitados
   - Modo solo lectura visual para secretarias

### Deuda técnica reconocida

- `get_max_pacientes()` existe pero ninguna RLS la usa.
  Eliminar en fase futura.
- Endpoint `POST /api/documentos` es código zombie: el frontend
  inserta directo a Supabase via RPC para 9 tipos de documento.
  La barrera real es la RLS, no el endpoint.
- 25+ archivos `supabase_migration_*.sql` viejos en raíz del repo,
  pendientes de organización en `supabase/migrations/` con
  convención de nombres estándar.
- `package.json` no declara `engines: { "node": "24.x" }` aún.

### Mejoras de UX pendientes (post-refactor de roles)

Ver `CLAUDE.md` sección "Mejoras post-rediseño de labs" para detalle
de mejoras al exportar expediente PDF (B1-B6).

---

## 9. Quién mantiene este documento

Angel Ancona (ancoa) actualiza `LOCAL_DEV.md` cuando:

- Cambia la estrategia de trabajo
- Se agregan herramientas al stack de desarrollo
- Se actualizan versiones pinned
- Ocurre un incidente que requiere lección documentada
- Se descubre nueva deuda técnica relevante

Última actualización: **2026-05-06**
