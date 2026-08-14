@AGENTS.md

# Reglas del proyecto Spinus®

> **Lee este documento COMPLETO antes de proponer cualquier cambio. Confirma que lo leíste resumiendo en 3 líneas qué entendiste sobre el estado actual del módulo offline antes de tocar código.**

---

## 🔴 PROTOCOLOS DE INTERACCIÓN — LEER PRIMERO, NO NEGOCIABLES

Estos protocolos existen porque el proyecto ha sufrido regresiones severas por código inyectado fuera de scope, eliminaciones sin verificar dependencias, y "soluciones mágicas" complejas que aumentaron la fragilidad. Su violación causa retrabajo de días.

### Protocolo 1 — SCOPE EXPLÍCITO

* SOLO modifica los archivos que el usuario te indicó explícitamente en su mensaje
* Si crees que necesitas tocar otro archivo, **DETENTE** y pregunta antes de hacerlo
* Antes de empezar a editar, lista los archivos que vas a tocar y espera confirmación si son más de 2
* NUNCA "aprovecha" para arreglar otra cosa que viste de paso

### Protocolo 2 — PROTOCOLO DE ELIMINACIÓN

* Antes de eliminar cualquier archivo, ejecuta `grep -rn "nombre-del-archivo" src` y reporta los resultados
* Si encuentras imports activos, **NO ELIMINES**. Reporta el bloqueo
* Antes de eliminar bloques grandes de código (>50 líneas), pregunta si es seguro
* Si el usuario dice "elimina X", **verifica primero qué está vivo y reporta antes de borrar**

### Protocolo 3 — TAMAÑO DE CAMBIOS

* Ninguna función nueva debe exceder 50 líneas. Si necesitas más, divide
* Si tu solución requiere más de 200 líneas nuevas, **primero propón una alternativa de menos de 50 líneas**, aunque sea más limitada
* Si un cambio toca más de 3 archivos, **DETENTE** y muestra el plan antes de ejecutar
* Prefiere ediciones quirúrgicas sobre reescrituras

### Protocolo 4 — ANTI-ABSTRACCIÓN PREMATURA

* NUNCA crees factories, providers, contextos genéricos, custom hooks reutilizables, o capas de abstracción nuevas sin OK explícito del usuario
* La duplicación de código es preferible a una abstracción especulativa
* Si propones una abstracción, justifica con al menos 3 casos de uso reales en el proyecto actual
* Las abstracciones se introducen cuando el dolor de duplicar supera el costo de abstraer, no antes

### Protocolo 5 — HONESTIDAD SOBRE INCERTIDUMBRE

* Si no sabes por qué algo falla, **dilo**. No inventes diagnósticos
* Si no estás seguro de cómo funciona una API o librería, **verifica en la documentación oficial** antes de proponer
* Si propones algo basado en suposiciones, márcalo explícitamente: "ASUMIENDO QUE..."
* Antes de aplicar un workaround "creativo", explica primero la causa raíz del problema. Si no puedes explicar la causa raíz, **el workaround está prohibido**
* Es mejor decir "necesito investigar más" que entregar código que no entiendes

### Protocolo 6 — SERVICE WORKERS Y MÓDULO OFFLINE

* NUNCA crees un Service Worker nuevo si ya existe uno. Reporta el conflicto
* NUNCA registres un Service Worker desde código que se ejecuta en todas las páginas (ej. `layout.tsx` raíz)
* El Service Worker del búnker offline DEBE tener `scope: '/bunker/'` o equivalente, NUNCA el scope raíz `/`
* NUNCA agregues código que desregistre Service Workers indiscriminadamente (ej. `getRegistrations().forEach(unregister)`). Si necesitas desregistrar uno específico, hazlo por nombre/scope
* La página `/offline-mode` o cualquier ruta del búnker NO debe ser una ruta de Next.js, debe ser HTML estático servido desde `/public/bunker/`
* Cualquier propuesta de pre-cachear chunks de Next.js con hashes hardcodeados está PROHIBIDA — los hashes cambian en cada deploy

### Protocolo 7 — VERIFICACIÓN POST-CAMBIO

* Después de CUALQUIER cambio, corre `npm run build` y reporta el resultado
* Si el build falla, **NO continúes con más cambios**. Repórtalo y espera instrucciones
* Si el cambio toca tipos, corre `npm run lint` también
* Sugiere un `git commit` con mensaje descriptivo cuando algo funciona

### Protocolo 8 — REPORTE DE FIN DE TAREA

Al terminar cualquier cambio, escribe en máximo 5 líneas:
1. Qué hiciste
2. Qué archivos tocaste (lista exacta)
3. Qué NO funcionó si algo no funcionó
4. Qué decisiones tomaste sin pedir permiso (si las hubo)
5. Qué seguiría lógicamente (sin ejecutarlo)

---

## 📦 ESTADO ACTUAL DEL MÓDULO OFFLINE — CRÍTICO

> Esta sección debe leerse antes de proponer cualquier cosa relacionada con offline, Service Workers, IndexedDB, o sincronización.

### Lo que ESTÁ MUERTO y NO debe revivirse sin discusión explícita

Los siguientes archivos fueron eliminados intencionalmente en abril 2026 tras una regresión severa. **El documento `RESUMEN_ARQUITECTURA.md` describe este sistema viejo y ya no aplica**:

* `src/lib/read-mirror.ts` — sistema de espejo de lectura en IndexedDB
* `src/lib/outbox-engine.ts` — cola de escrituras offline
* `src/lib/connectionMonitor.ts` — monitor de red
* `src/hooks/useHybridQuery.ts` — hook híbrido online/offline
* `src/components/MirrorInitializer.tsx`
* `src/components/OfflineSync.tsx`
* `src/components/ChunkMissingListener.tsx`
* `src/app/sw.js/route.ts` — Service Worker custom de la app online

**No los recrees. No propongas reactivarlos. Si encuentras referencias en documentación vieja, ignóralas.**

### Lo que ESTÁ VIVO actualmente

* `src/components/SessionGuard.tsx` (34 líneas, simplificado)
* `src/lib/supabase/client.ts` (67 líneas, sin lógica offline)
* `public/spinus-bunker-sw.js` — Service Worker del búnker (en desarrollo)
* `src/app/(offline)/offline-setup/page.tsx` — página de setup
* `src/app/(offline)/offline-mode/page.tsx` — página del búnker (a migrar a HTML estático)

### Estrategia offline actual (Sidecar Bunker)

* La app online **NO** debe tener capacidades offline
* Existe un módulo offline **aislado** llamado "Búnker" que vive en `/public/bunker/` (en construcción)
* El Búnker es una mini-app independiente, NO comparte código con la app online
* El Búnker se usa para emergencias: ver paciente, escribir nota, generar PDF, sincronizar al volver online
* El Service Worker del Búnker tiene scope restringido a `/bunker/`

---

## 🛡️ Reglas de seguridad — NO NEGOCIABLES

* NUNCA modifiques `src/lib/anonimizar.ts` ni quites las llamadas de anonimización en las rutas de IA
* NUNCA cambies `ON DELETE RESTRICT` a `CASCADE` en ninguna foreign key
* NUNCA quites las validaciones de roles o autenticación en endpoints de API
* NUNCA guardes datos de pacientes en localStorage sin usar `secureStorage`
* NUNCA envíes datos identificables de pacientes a APIs externas (Gemini, Anthropic, Google Calendar, Sentry)
* NUNCA permitas editar o eliminar notas clínicas ya guardadas — son inmutables
* NUNCA quites los filtros PII de Sentry
* NUNCA quites el audit log de ninguna acción
* NUNCA pases HTML sin sanitizar a Puppeteer
* Si necesitas modificar alguno de estos archivos, explícame qué vas a cambiar y por qué ANTES de hacerlo

---

## 🧬 Stack y versiones (bleeding edge — verifica antes de proponer)

* **Next.js 16.2.1** (App Router, Webpack explícito, no Turbopack)
* **React 19.2.4**
* **Tailwind 4** (con `@tailwindcss/postcss`)
* **TypeScript 5**
* **Supabase** (`@supabase/ssr` 0.9, `@supabase/supabase-js` 2.100)
* **Sentry** (`@sentry/nextjs` 10.47)
* **Cornerstone.js 4.20** (DICOM viewer)
* **@react-pdf/renderer 4.4** (generación de PDFs)
* **Vitest 4** (testing)

**Importante:** Estas son versiones recientes. Si tu propuesta usa APIs deprecadas de Next.js 13/14, React 18, o Tailwind 3, **márcalo explícitamente y verifica en la documentación oficial actual**.

---

## 💻 Entorno de desarrollo

### Plataforma actual: Linux vía WSL 2

**Cambio realizado el 2026-05-04:** El proyecto migró de desarrollo nativo
en Windows a desarrollo en Linux vía WSL 2. Razones:

- Compatibilidad nativa con Supabase CLI (que usa Docker para containers de Postgres/Auth/Storage)
- Eliminación de problemas crónicos de line-endings CRLF/LF entre Windows y Vercel (Linux)
- Alineación con el entorno real de producción (Vercel deploya en Linux)
- Mejor performance de Node.js y Docker en filesystem nativo de Linux

**Setup oficial:**
- Windows 11 host
- WSL 2 con Ubuntu 24.04 LTS
- Filesystem del proyecto: `/home/ancoa/proyectos/app_ortointegra/` (NO en `/mnt/c/...`)
- VS Code con extensión "WSL" (`ms-vscode-remote.remote-wsl`)
- Trabajo activo SOLO desde WSL. La copia en Windows (`C:\\Users\\Ancona\\desktop\\app_ortointegra\\`)
  queda como respaldo congelado (read-only, sin commits, sin npm install)

### Versiones pinned

Estas versiones están elegidas conscientemente. NO actualizar sin discusión:

| Herramienta | Versión | Razón del pin |
|---|---|---|
| Node.js | 24.x | Alineado con `engines` de Vercel runtime |
| npm | 11.x | Bundled con Node 24 |
| Docker Desktop | 29.4.1 | Última estable al momento del setup |
| Supabase CLI | 2.95.4 | Estable con varias semanas en el wild |
| WSL Ubuntu | 24.04 LTS | Última LTS soportada |

**Regla de actualización:** NO usar versiones de herramientas con menos de 1
semana en el wild. Regla específica para herramientas que tocan datos médicos
de producción (Supabase CLI, Docker). Ver `LOCAL_DEV.md` (pendiente de crear)
para procedimiento de actualización.

### Docker Desktop

- Instalación con integración WSL 2 ("Use WSL 2 instead of Hyper-V" marcado)
- Debe estar corriendo antes de cualquier comando `supabase start` o `supabase db pull`
- Validación rápida desde WSL: `docker --version` debe responder sin errores

### Estado actual de Supabase local (2026-05-04)

**Pendiente de configurar:**
- `supabase init` — crear `config.toml` y `seed.sql` (cuidando NO sobrescribir `baseline/` ni `migrations/`)
- `supabase start` — levantar Postgres + Auth + Storage local en Docker
- `supabase db pull` — replicar schema de prod a local (Session pooler IPv4)
- `seed.sql` — crear cuentas representativas de cada caso (free virgen, free degradada, individual, premium VIP, premium cancelado, etc.)

**Connection string para `db pull`** (Session pooler, IPv4):
- Host: `aws-0-us-west-2.pooler.supabase.com`
- Port: 5432
- User: `postgres.qpnegmmpneseirfyplbf`

### Notas para Claude Code

- Los comandos asumen ejecución desde `~/proyectos/app_ortointegra/` en Ubuntu (NO desde `/mnt/c/...`)
- Si Claude Code detecta paths de Windows (`C:\\` o `/mnt/c/`), reporta el problema antes de ejecutar
- El `.env.local` está en `/home/ancoa/proyectos/app_ortointegra/.env.local` con permisos 600

---

## ✏️ Buenas prácticas de TypeScript

* NUNCA uses `any`. Usa tipos explícitos, generics, `unknown` o `Record<string, unknown>` según corresponda
* Siempre define interfaces o types para props de componentes, respuestas de API y datos de la DB
* Usa tipos estrictos de Supabase generados con `supabase gen types` para las queries
* Prefiere `as const` sobre enums cuando sea posible
* Usa discriminated unions para manejar estados (loading, error, success)
* Toda función pública debe tener tipos de retorno explícitos
* Usa Zod para validación de inputs en API routes y formularios
* Nunca uses type assertions (`as`) para silenciar errores — corrige el tipo real
* Usa Optional chaining (`?.`) y nullish coalescing (`??`) en lugar de checks manuales
* Prefiere `satisfies` sobre `as` para validar tipos sin perder inferencia

---

## 🎨 Estilo de código

* Componentes React: functional components con hooks, nunca class components
* Nombra archivos de componentes en PascalCase, utilidades en camelCase
* **NUNCA dos archivos cuyos nombres solo se distingan por la mayúscula**, ni
  siquiera con extensión distinta. `ParserBloques.tsx` + `parserBloques.ts` es
  válido en Linux y **no compila en macOS ni en Windows**, donde el filesystem no
  distingue mayúsculas: el bundler prueba `.ts` antes que `.tsx` y el componente
  entra como `undefined`, sin error propio. Ojo con la regla de arriba: aplicar
  PascalCase al componente y camelCase a su utilidad hermana produce exactamente
  ese par. Dale al segundo un nombre distinto, no solo otra caja
  (`analizadorBloques.ts`). Ocurrió el 2026-08-07 — `DEUDA_TECNICA.md` DEP-DT-2
* Un componente por archivo
* Extrae lógica compleja a custom hooks en `src/hooks/` **solo cuando se use en >1 lugar**
* Extrae utilidades reutilizables a `src/lib/` **solo cuando se use en >1 lugar**
* Server actions y API routes validan inputs en el servidor, nunca confíes solo en el frontend
* Maneja errores con try/catch en toda llamada async, nunca dejes promesas sin catch
* Usa el logger de `src/lib/logger.ts` en lugar de `console.log`
* Imports absolutos con `@/` en lugar de rutas relativas largas

### Nombres de rama

Toda rama nueva lleva el prefijo `feature/` seguido de un nombre descriptivo
en kebab-case, sin excepción por tipo de trabajo: también las de arreglo,
refactor o documentación. Ejemplos vigentes: `feature/fase1-navegacion`,
`feature/documentos-v2`, `feature/rediseno-landing`.

Quedan en el repo unas pocas ramas anteriores a esta regla que no la siguen
(`fix/perfil-telefono-huerfano`, `respaldo-main-mac`, y en remoto
`dicom-viewer` y `multiconsultorio`). Son historia, no precedente: no se
renombran, pero tampoco se imitan.

---

## 🖥️ Landing pública — reglas permanentes

Aplican a `src/app/page.tsx` (landing pública) y a todo componente que
viva dentro de ella. Fuera de scope: `(launcher)/inicio/page.tsx` (home
del médico logueado). Origen: sección 1 de `PLAN_LANDING_SPINUS.md`.

1. **Tokens de movimiento:** ningún componente de la landing usa un valor de
   duración, easing o distancia que no salga de `--sp-dur-*`, `--sp-ease-*`
   o de la extensión `--lp-*`. Sin excepciones.
2. **Solo se anima `transform` y `opacity`.** Nunca `width`, `height`, `top`
   ni `left`: provocan relayout y ahí nace el jank.
3. **`useReducedMotion` se implementa junto a cada animación**, nunca como
   parche final. `globals.css:822` ya tiene el bloque
   `prefers-reduced-motion`; se extiende, no se crea otro.

> ### ⚠️ REGLA 4 — TRAMPA DE NOMBRES (la que más se equivoca)
>
> **`--cp` (#1a3a5c) es el navy oscuro y `--cs` (#1e5fa8) es el azul
> brillante. `--sp-primary` apunta a `--cs`, no a `--cp`.**
>
> **Está invertido respecto a lo intuitivo.** Verifica el token antes de
> usarlo; no deduzcas por el nombre.

5. **La firma del Teaser 2 nunca toca la red.** Sin `fetch`, sin
   `toDataURL` fuera del componente, sin Supabase. Comentario obligatorio
   en el archivo para que ningún refactor futuro lo "mejore".
6. **Capturas:** cuenta demo, cero PII, jamás producción ni con datos
   difuminados.
7. **Sin dependencias nuevas más allá de `motion`.** Nada de Three.js,
   GSAP, Lenis, librerías de QR ni smooth-scroll.

---

## 📁 Estructura del proyecto

* `src/app/` — páginas y API routes (App Router)
* `src/app/(app)/` — rutas autenticadas de la app online
* `src/app/(offline)/` — rutas del módulo offline (en migración a HTML estático)
* `src/app/(launcher)/` — páginas públicas iniciales
* `src/components/` — componentes React reutilizables
* `src/hooks/` — custom hooks
* `src/lib/` — utilidades, tipos, configuraciones
* `src/lib/dicom/` — visor DICOM y utilidades
* `src/lib/pdf/` — generación de PDFs
* `src/lib/supabase/` — cliente Supabase
* `public/` — assets estáticos
* `public/bunker/` — (futuro) app estática del búnker offline
* Las migraciones SQL van en archivos separados con prefijo `supabase_migration_`

---

## 🗃️ Base de datos

* NUNCA ejecutes migraciones SQL directamente. Genera el archivo SQL y yo lo ejecuto manualmente en Supabase
* NUNCA hagas DELETE de datos en producción
* Toda tabla nueva con datos de pacientes DEBE tener RLS activado
* Toda foreign key a pacientes DEBE ser `ON DELETE RESTRICT`
* Todo cambio en datos sensibles DEBE registrarse en `audit_log`

---

## ⚖️ Cumplimiento normativo mexicano

> ### ⚠️ EL MARCO LEGAL DE DATOS PERSONALES CAMBIÓ EN 2025 — VERIFICA ANTES DE ESCRIBIR TEXTO LEGAL
>
> La LFPDPPP de 2010 fue **abrogada el 21/03/2025**. La ley vigente es la
> **nueva LFPDPPP** (DOF 20/03/2025, en vigor desde el 21/03/2025, reformada
> el 14/11/2025). **Su reglamento sigue pendiente a julio de 2026**;
> supletoriamente aplica el reglamento de 2011 en lo que no contradiga la
> nueva ley.
>
> **Consecuencia operativa:** cualquier aviso de privacidad, consentimiento,
> cláusula o texto legal que generes **debe verificarse contra el texto
> vigente antes de publicarse**. No cites artículos ni nombres de autoridad
> de memoria, y no reutilices redacción anterior a marzo de 2025 sin
> revisarla — el articulado y la autoridad cambiaron.

* Esta app maneja datos de salud regulados por la NOM-004-SSA3-2012 y NOM-024-SSA3-2012
* Los datos de salud son datos personales sensibles bajo la LFPDPPP vigente (DOF 20/03/2025, reformada 14/11/2025)
* **La autoridad es la Secretaría Anticorrupción y Buen Gobierno (SABG).** El INAI fue disuelto: ninguna referencia al INAI es válida en texto nuevo
* **Las multas se duplican tratándose de datos personales sensibles**, y un expediente clínico lo es. Toda sanción por incumplimiento aplica aquí en su versión duplicada
* Las notas clínicas son inmutables — correcciones se hacen vía addendum
* Los expedientes nunca se borran — se usa soft delete con retención mínima de 5 años
* Todo acceso a expedientes debe quedar registrado en `audit_log`
* El consentimiento de privacidad es obligatorio antes de crear un paciente

---

## 🚦 Antes de cada sesión

Cuando inicies una sesión nueva contigo, espera que el usuario te diga el objetivo específico de la sesión. **Una sesión = un objetivo atómico.** No abras varios frentes a la vez.

Tu primer mensaje en cada sesión debe ser:
1. Confirmar que leíste este `CLAUDE.md` completo
2. Resumir en 3 líneas qué entendiste sobre el estado actual del módulo offline
3. Esperar el objetivo del usuario antes de proponer cualquier cosa

## Documentos de referencia para fases en progreso

- **CALCULADORAS_ROADMAP.md** — Sistema de 200 calculadoras clínicas. Leer ANTES de trabajar en calculadoras.
- **RESUMEN_DASHBOARD.md** — Dashboard del paciente en /expediente/[id]/estado. Leer ANTES de trabajar en esa página.
- **DOCUMENTOS_RANURAS_MUERTAS.md** — ✅ **Cerrado.** Las siete ranuras de v2 sin productor se retiraron de los formatos, así que ya no hay nada que vigilar al cablear ni al encender `usa_documentos_v2`. Lo que queda vivo dentro es su **§2**: tres decisiones que parecen huecos y no lo son —el folio de Internamiento, el tipo y número del anexo, y las tres celdas de riel pendientes de cable—. Leerlo solo si algo de eso parece un defecto que arreglar. También registra un defecto de chasis abierto (§3): react-pdf comprime las filas de una hoja que se pasa por poco.

---

## 🪫 Deuda técnica conocida

Lista de bugs/limitaciones aceptadas conscientemente. No corregir sin plan explícito — cada ítem tiene contexto que justifica dejarlo.

1. **`regenerarYSubirPdf` muta `doc.pdf_url` local sin re-render.** En `src/components/expediente/ModalDocumentos.tsx` (migrado desde el antiguo `TabDocumentos` en Fase 6). Al regenerar un PDF, el botón de descarga no aparece hasta refetch manual. Arreglar con `setState` inmutable que reemplace el documento en la lista, no mutando el objeto por referencia.
2. **`ModalShell` sin focus trap.** Deuda de accesibilidad. El Tab puede escapar del modal. Agregar trap cuando tengamos auditoría a11y formal.
3. **Modales de Consultas y Documentos sin paginación.** Límite hard de 50 registros heredado de `QUERY_LIMIT` en `page.tsx`. Si un paciente tiene >50 consultas/documentos, los restantes no se ven en el modal. Agregar scroll virtual o buscador interno en fase futura.
4. ~~**`TabGraficas.tsx` vive temporalmente en disco como archivo utilitario.**~~ ✅ Resuelto (sub-fase 0 del rediseño de labs, 2026-04-21). Archivo eliminado; `normalizarKey` y `ParamGrafica` inlined en `src/hooks/useLaboratoriosNormalizados.ts`.
5. ~~**`useLaboratoriosNormalizados.ts` — borrar al final del rediseño de labs (sub-fase 8).**~~ ✅ Resuelto (sub-fase 8C1, 2026-04-23). Hook + todo el código legacy eliminado (`src/lib/analisis.ts`, `/api/laboratorios`, `/api/labs-extract`, páginas `/laboratorios/nuevo` y `/laboratorios/[labId]`, ruta standalone `/laboratorios`, tipos `Laboratorio`/`ResultadoLab`/`ValoresLab`/`AnalisisIA`/`VALORES_REFERENCIA`/`ParametroLab`/`Alerta`).
6. ~~**Tabla `laboratorios` legacy — pendiente `DROP TABLE` manual (sub-fase 8C2).**~~ ✅ Resuelto (sub-fase 8C2, 2026-04-23). Tabla `laboratorios` y todas sus dependencias eliminadas en sub-fase 8C2. Policy `pacientes_delete_solo_sin_historial` recreada sin referencia a la tabla. Bucket `laboratorios-pdf` ya se había eliminado en sesiones anteriores.

---

## 📋 Incidentes resueltos

Registro corto de incidentes en producción y su resolución. Útil para contexto histórico cuando se retoman áreas afectadas. Forward-only: los archivos de migración originales se conservan; los reverts son migraciones explícitas con timestamp posterior.

### 2026-05-04 — Recursión RLS en pacientes (Phase 8.1)

**Síntoma:** usuarios no podían crear pacientes nuevos. Error en producción: `infinite recursion detected in policy for relation "pacientes"`. Reportado por betatester ~24 horas después de aplicar la migración.

**Causa raíz:** la migración `20260503_phase81_block_post_cancellation.sql` creó una policy RLS RESTRICTIVE en `public.pacientes` cuyo `WITH CHECK` contenía un `SELECT count(*) FROM public.pacientes` — self-reference que dispara recursión infinita al evaluar cualquier INSERT. Postgres no valida policies semánticamente en `CREATE POLICY`, solo a runtime, por eso pasó silencioso hasta el primer intento de crear paciente. Las policies de `consultas` y `documentos` no eran auto-recursivas (referenciaban `pacientes`, no a sí mismas) pero compartían el predicado defectuoso.

**Fix aplicado:** rollback de las 3 policies vía Supabase SQL Editor el 2026-05-04. Formalizado en repo como `20260504_revert_phase81_recursion.sql`.

**Alcance exacto del rollback:** se revirtió la **implementación recursiva** de Phase 8.1 (el predicado auto-referencial `count(pacientes) > 5`), NO el concepto de barrera RLS de suscripción. La distinción importa: el rollback dejó un hueco temporal, no una decisión de arquitectura.

**Trade-off que estuvo vigente entre 2026-05-04 y 2026-05-24/31:** sin las 3 policies, el bloqueo a clínicas sin acceso quedó solo en gates server-side de los 4 endpoints API. El frontend que inserta directo a Supabase (9 formularios de documentos) quedó sin barrera RLS durante esa ventana. **Este párrafo describe una situación pasada, ya resuelta — ver la actualización de abajo.**

**Fix correcto (que estaba pendiente): APLICADO.** Ver actualización 2026-07-18.

**Lección:** policies RLS sobre tabla X que consultan a X dentro de su propio predicado son recursión infinita garantizada en runtime. Cualquier policy que necesite condiciones derivadas de la misma tabla debe usar columnas declarativas en otra tabla (típicamente la tabla "padre" del tenant — `clinicas` en nuestro caso) en lugar de agregaciones sobre la tabla restringida.

---

### 2026-07-18 — Actualización: la barrera RLS de suscripción está ACTIVA (corrige la nota de 2026-05-04)

> ⚠️ **LEER ANTES DE TOCAR CUALQUIER COSA RELACIONADA CON BLOQUEO POR SUSCRIPCIÓN.**
> La nota de 2026-05-04 arriba afirmaba que no había barrera RLS. **Esa afirmación es OBSOLETA
> desde el 2026-05-30/31.** La barrera fue recreada y está en producción.

**Qué pasó:** el refactor de roles (etapa 5) implementó exactamente el "fix correcto pendiente" que la nota vieja describía: reemplazar el predicado agregado y auto-referencial por una **columna latch declarativa** `clinicas.ha_tenido_acceso_premium boolean` (one-way, false→true al primer pago/VIP, vía trigger en `20260521_etapa5b3_trigger_latch_premium.sql`). Sin self-reference sobre la tabla restringida, sin recursión posible.

**Helper que implementa el gate** — `public.clinica_tiene_acceso()` (GATE 2), creado en `20260522_etapa5c_helpers_rls.sql:142`, `SECURITY DEFINER`, consulta `public.clinicas` (tabla padre) y nunca la tabla restringida:

```sql
SELECT EXISTS (
  SELECT 1 FROM public.clinicas c
  WHERE c.id = public.get_clinica_id()
    AND (
      c.es_vip_grant IS TRUE
      OR (c.stripe_subscription_id IS NOT NULL
          AND c.suscripcion_estado = 'activo')
      OR c.ha_tenido_acceso_premium IS NOT TRUE
    )
);
```

Es decir: VIP, o suscripción Stripe activa, o clínica free-virgen (que nunca tuvo premium) → tienen acceso. **Free degradada** (tuvo premium y lo perdió) → queda en solo-lectura. El bloqueo es la negación de ese predicado.

**Policies RESTRICTIVE de INSERT en producción.** Las 7 usan el mismo predicado `public.clinica_no_suspendida() AND public.clinica_tiene_acceso()` (nótese: el helper es `clinica_no_suspendida()`, en forma **positiva** — no existe ningún `clinica_esta_suspendida()`):

| Tabla | Policy | Migración | Aplicado a prod |
|---|---|---|---|
| `pacientes` | `pacientes_gates_insert` | `20260524_etapa5e_bd1_policies_pacientes.sql:96` | 2026-05-24 |
| `consultas` | `consultas_gates_insert` | `20260530_etapa5f_paso3_policies_consultas.sql:130` | 2026-05-30 |
| `documentos` | `documentos_gates_insert` | `20260530_etapa5g_paso4_policies_documentos.sql:139` | 2026-05-30 |
| `appointments` | `appointments_gates_insert` | `20260530_etapa5h_paso3_policies_appointments.sql:145` | 2026-05-30 |
| `addendums` | `addendums_gates_insert` | `20260531_etapa5i_paso3_policies_addendums_mediciones.sql:158` | 2026-05-31 |
| `mediciones_analitos` | `mediciones_gates_insert` | `20260531_etapa5i_paso3_policies_addendums_mediciones.sql:239` | 2026-05-31 |
| `consultorios` | `consultorios_gates_insert` | `20260615_consultorios_03_rls.sql:81` | 2026-06-15 |

El helper también está cableado dentro del RPC de creación de pacientes (`20260524_etapa5e_ts1a_rpc_crear_paciente_con_medico.sql:88`).

Nota: las **recetas no son una tabla** — son filas de `documentos`, ya cubiertas por `documentos_gates_insert`. No existe tabla `archivos_paciente`.

**⚠️ ADVERTENCIA PARA FUTUROS EDITORES:**

1. **NO "restaures" ni dupliques esta RLS creyéndola muerta.** Ya existe y funciona. Crear una segunda policy de gate sobre las mismas tablas es cómo se reintroducen bugs de recursión.
2. **NO quites estas policies creyéndolas redundantes** con los gates server-side. Son defense-in-depth deliberado: el frontend inserta directo a Supabase en varios formularios, sin pasar por ningún endpoint API.
3. **El gate RLS y el gate server-side NO comparten predicado.** RLS usa `clinica_tiene_acceso()` (basado en el latch `ha_tenido_acceso_premium`); `src/lib/subscription.ts` usa `suscripcion_estado='cancelado' && !es_vip_grant && count_pacientes > 5`. Coexisten y responden a criterios distintos. **No los "unifiques" sin un plan explícito** — cambiar uno para que coincida con el otro altera quién queda bloqueado en producción.

---
## ✅ Rediseño de laboratorios — cerrado

El rediseño del módulo de laboratorios se cerró el **2026-04-24** tras
completar 10 sub-fases (0-7, 8A, 8B, 8C1, 8C2, 9) sin bugs funcionales
detectados durante el QA end-to-end. Detalle por sub-fase y decisiones
de implementación en `LABS_REDISEÑO_NOTES.md`. Mejoras UX identificadas
durante el QA están listadas más abajo en "Mejoras post-rediseño de
labs (retomar en sesión nueva)".

---

## ✅ Refactor del editor de Escrito Médico — cerrado (Phase 4 y 5 canceladas)

**Phase 2 + Phase 3 cerradas y en producción** (2026-05-08):

- Editor TipTap WYSIWYG con persistencia dual-write `doc` + `cuerpo` en
  `documentos.contenido`
- PDF / visor / email consumen JSON ProseMirror cuando
  `doc.schema === 'tiptap-doc-v1'`
- Roboto-BoldItalic registrada en `@react-pdf/renderer` para italic+bold
  combinado
- Hotfix `src/lib/documentos/editorExtensions.ts` — módulo neutro (sin
  `'use client'`) compartido entre editor cliente, visor cliente y
  handler server-side de email (evita arrastrar el árbol de cliente al
  server al renderizar HTML del JSON)

**Phase 4 (migración batch HTML → JSON) CANCELADA conscientemente.**
**Phase 5 (eliminación de código legacy) CANCELADA conscientemente.**

Razón: pocos escritos legacy en producción, no importantes para
operación. El parser regex de fallback maneja escritos legacy con
limitaciones aceptadas (italic gris #555, listas como `"• item"` en
texto plano, alineaciones nuevas ignoradas, H1 demoteado a H2). El
costo de migrar batch + eliminar legacy supera el beneficio dado el
volumen residual de documentos afectados.

**Lo que sigue VIVO por compatibilidad legacy** (NO eliminar sin
discusión explícita y nuevo plan):

- Campo `cuerpo` en `documentos.contenido` (HTML string)
- `parseHtmlToElements` en `src/lib/pdf/EscritoMedicoPdf.tsx`
- `postProcesarParaParserLegacy` en
  `src/components/documentos/EscritoMedicoForm.tsx`

**Importante para futuros editores:** los comentarios que dicen
"TEMPORAL — Phase 5" o "TEMPORAL — se elimina en Phase 5" en el código
deben **IGNORARSE**. Esa fase no se ejecutará. Es deuda técnica
controlada, documentada y aceptada.

---

## 🔓 Pendientes de seguridad

Hardening conocido pero no aplicado todavía. Cada ítem tiene fix planeado y momento previsto. No reordenar prioridades sin discusión.

### QW3 — Restringir endpoint ARCO a super_admin y admin

**Archivo afectado:** `src/app/api/paciente/[id]/exportar/route.ts`

**Problema:** El endpoint `POST /api/paciente/[id]/exportar` devuelve JSON completo con todos los datos del paciente (consultas, mediciones, documentos, addendums, datos personales) para cumplimiento ARCO (derechos ARCO bajo la LFPDPPP vigente de 2025 — el "Art. 28" que citaba esta línea es de la ley abrogada de 2010; verificar el artículo correcto antes de citarlo en cualquier texto de cara al usuario). Actualmente requiere sesión autenticada pero NO valida el role del usuario. Cualquier médico autenticado puede invocarlo vía fetch/curl.

**Origen:** Endpoint creado en sesión anterior como preparación para cumplimiento legal ARCO. Nunca se integró a UI de super-admin.

**Fix planeado:**
1. Agregar validación post-auth: `role IN ('super_admin', 'admin')`
2. Si role no cumple → responder `403 Forbidden`
3. Registrar intentos denegados en `audit_log` con `accion='arco_intento_denegado'`
4. Mantener el registro de accesos exitosos con `accion='arco_acceso'` (ya existe)

**Cuándo atacar:** Después del rediseño de labs (post sub-fase 8C y 9). Prioridad alta (riesgo de fuga de datos cross-usuario dentro de misma clínica, aunque endpoint esté dormido).

**Alcance estimado:** 1 archivo, ~15 líneas, 20 min.

**Decisiones ya tomadas:**
- Roles permitidos: `super_admin` + `admin` (admin de clínica puede ejecutar ARCO para pacientes de su clínica; super_admin global puede para cualquier clínica).
- Respuesta denegada: `403 Forbidden` con JSON `{ error: "forbidden" }`.
- Audit log: sí registrar intentos denegados.

---

### QR-01 — ✅ Cerrado: `/api/r/[folio]` eliminado

`src/app/api/r/[folio]/route.ts` se borró entero. Devolvía el `contenido` COMPLETO de la receta —nombre del paciente, diagnóstico y medicamentos con su posología— en JSON, con `createAdminClient()`, así que la RLS no aplicaba: cualquier médico autenticado, de cualquier clínica, leía la receta de cualquier otro con `curl` y el folio. No lo llamaba nadie; era el resto de cuando `/r/[folio]` era un visor de la receta.

**⚠️ NO CONFUNDIR CON `pathname.startsWith('/r/')` DE `src/middleware.ts:61`, QUE SE QUEDA.** Esa línea mantiene pública la **página** `/r/[folio]`, que es el destino del QR impreso; no cubría a la ruta API, porque `/api/r/…` no empieza por `/r/`. Retirarla creyéndola resto de esto rompería la verificación entera.

Comprobado al borrar: cero consumidores en el código (el QR de la receta apunta a `/r/{folio}`, la página, en `RecetaForm.tsx:432`), y ninguna otra ruta sirve contenido de documentos con cliente de servicio — las cuatro que leen `documentos` (`/api/documentos/[id]`, `/api/me/estadisticas`, `/api/me/stats`, `/api/paciente/[id]/exportar`) usan el cliente de sesión, así que la RLS filtra. `/api/documentos/[id]/identificacion` sí usa cliente de servicio, pero comprueba `subido_por = user.id` antes y valida el prefijo de la ruta.

---

### QR-02 — `/demo/receta` enseña medicamentos que la página real ya no enseña

**Archivo afectado:** `src/app/demo/receta/page.tsx`.

**Problema:** la demo se escribió como la referencia de política —fue la primera en aplicar la minimización— y hoy va por detrás: compone la lista de medicamentos prescritos, que `/r/[folio]` retiró. Su cabecera todavía dice que la minimización sigue abierta «PARA LA PÁGINA REAL», y es al revés.

Los datos son ficticios, así que **no hay fuga**: es una promesa de producto que ya no corresponde a lo que el producto hace. Quien escanee el QR de una receta de verdad verá menos que en la demostración.

Al arreglarlo, la demo hereda además lo que la real estrenó y ella no tiene: el enlace al registro de cédulas con sus botones de copiar.

**Cuándo atacar:** después de fusionar `feature/documentos-v2`.

---

## Mejoras post-rediseño de labs (retomar en sesión nueva)

Identificadas durante QA de sub-fase 9. Son mejoras UX, no bugs
funcionales. Cada una es una sub-fase independiente.

### Mejora A — Vista lista + eliminación múltiple de documentos

**Módulo afectado:** `/expediente/[id]/laboratorios`, sección de
documentos en la card "Mediciones y Documentos".

**Problema:** eliminar múltiples documentos uno por uno es demasiado
lento para el médico. Durante una consulta el médico puede necesitar
limpiar varios estudios obsoletos y el flujo actual requiere un click +
confirmación por cada uno.

**Cambios requeridos:**
- Toggle "Vista tarjetas (actual) / Vista lista" en el encabezado de
  la sección de documentos. La vista lista muestra una fila por
  documento con nombre, tipo, fecha, tamaño, acciones.
- Modo eliminación múltiple: botón "Eliminar varios" activa checkboxes
  en cada documento (aplica a ambas vistas).
- Barra de acción flotante inferior con contador "Eliminar N
  seleccionados" + botón cancelar.
- Confirmación ÚNICA con lista de archivos antes de borrado definitivo.
- Preservar el audit_log: una entrada por cada documento eliminado,
  NO una entrada agregada.

**Archivos probablemente afectados (por verificar al inicio de la
sub-fase):**
- `src/components/labs/DocumentosCard.tsx` o similar
- `src/hooks/useDocumentosLabs.ts`
- Posiblemente un nuevo componente `DocumentosListView.tsx`

**Scope estimado:** sub-fase independiente, ~2-3 horas de trabajo.

---

### Mejora B — Optimización de PDF del exportar expediente

**Módulo afectado:** botón "Exportar expediente" en el Hero del
expediente (`HeroExpediente.tsx` o `ExportarExpedienteButton.tsx`).

**Observaciones del PDF actual** (exportado el 2026-04-24 sobre el
paciente de prueba "Prueba Prueba" con 20 consultas, generó 24 páginas):

#### B1. Densidad y saltos de página
**Problema:** 20 consultas → 24 páginas. Saltos de página agresivos
entre consultas. Muchas consultas cortas (ej. nota "lumbago breve" del
25/marzo) desperdician una página casi entera.

**Fix propuesto:**
- Permitir que consultas fluyan naturalmente en la página siguiente
  sin forzar salto
- Usar `page-break-inside: avoid` SOLO dentro de secciones internas
  (`[SUBJETIVO]`, `[OBJETIVO]`, etc.) para evitar partir una sección
  a la mitad — NO entre consultas enteras
- Reducir márgenes top/bottom del documento (actualmente se ven
  excesivos)

#### B2. Portada ineficiente
**Problema:** Header del médico (nombre, especialidad, cédulas) + datos
del paciente + antecedentes ocupan la página 1 completa. El encabezado
"CONSULTAS (20)" queda huérfano al final de la página 1 sin ninguna
consulta debajo.

**Fix propuesto:**
- Compactar header del médico a ~1/3 de página (no ocupar la altura
  completa)
- Iniciar la primera consulta en la página 1 inmediatamente después
  de antecedentes si cabe
- El encabezado "CONSULTAS (N)" debe ir acompañado al menos de la
  primera consulta

#### B3. Falta firma médica al final de cada consulta
**Problema:** el PDF no incluye firma del médico al final de cada nota,
rompiendo consistencia con EscritoMedico y recetas que SÍ incluyen
firma. Pérdida de valor legal/profesional del documento exportado.

**Fix propuesto:**
- Agregar bloque de firma al final de CADA consulta con:
  - Línea horizontal separadora
  - Nombre completo del médico: "Dr. Angel M. Ancona Pérez"
  - Cédulas: "Cédula Prof.: 9552456 · Ced. Esp.: 12085805"
  - Fecha de la consulta
  - Opcional futuro: imagen de firma/sello escaneado si el sistema
    lo soporta en alguna sub-fase posterior

**Referencia:** replicar el patrón que ya usa
`src/lib/pdf/EscritoMedicoPdf.tsx` en el bloque de firma al final del
documento.

#### B4. Header completo repetido en cada página
**Problema:** el bloque del médico (foto/icono + nombre + especialidad
+ cédulas) aparece en las 24 páginas, consumiendo espacio innecesario
en páginas internas.

**Fix propuesto:**
- Página 1: header completo (como actualmente)
- Páginas 2+: header mínimo tipo "Expediente — [Nombre paciente] ·
  continúa" en texto pequeño en la esquina superior, SIN el bloque
  completo del médico

#### B5. Duplicados visibles en el PDF
**Problema:** en el PDF de prueba aparecen consultas duplicadas
(ejemplos: "Gonalgia postraumática 17/abr" aparece 2 veces, "Contusión
rodilla 2/abr" aparece 2 veces, notas de prueba "hug/asdf/sedge 11/abr"
repetidas).

**Por verificar al inicio de la sub-fase:**
- Query SQL a `consultas` del paciente para confirmar si hay 20
  consultas reales con duplicados de betatesting, o si el render
  está imprimiendo cada consulta 2 veces
- Si son duplicados reales en DB: considerar ofrecer filtro de fecha
  en el botón "Exportar expediente" (ej. "Últimos 30 días", "Último
  año", "Todo")
- Si es bug de render: corregir el loop que itera consultas

#### B6. Generación vía print del navegador (limitante)
**Problema:** el footer muestra `about:blank` delatando que el PDF se
genera vía print dialog del navegador, no vía librería PDF nativa.
Esto limita el control fino de layout, pagebreaks inteligentes, y la
consistencia con otros PDFs del sistema (EscritoMedico, recetas,
consentimientos usan `@react-pdf/renderer`).

**Fix propuesto (scope mayor):**
- Migrar la generación del exportar expediente a `@react-pdf/renderer`
- Esto desbloquea B1-B4 de forma limpia
- Costo: sub-fase grande, probablemente 4-6 horas de trabajo
- Beneficio adicional: consistencia visual con resto de PDFs del
  sistema

**Alternativa lite:** si no se quiere migrar, atacar B1-B5 via CSS
`@media print` y ajustes de estructura HTML. Menos limpio pero más
rápido.

**Archivos probablemente afectados (por verificar al inicio de la
sub-fase):**
- `src/components/expediente/ExportarExpedienteButton.tsx`
- Posiblemente una page/route de `/expediente/[id]/exportar` que
  renderiza la vista imprimible
- Si migración a @react-pdf/renderer: nuevo archivo
  `src/lib/pdf/ExpedientePdf.tsx`

**Scope estimado:**
- Versión lite (CSS + ajustes estructurales para B1-B5 sin migrar):
  ~2-3 horas
- Versión completa (migrar a @react-pdf/renderer y resolver B1-B6):
  ~4-6 horas

---

**Fin de sección "Mejoras post-rediseño de labs".**