@AGENTS.md

# Reglas del proyecto Spinus

> **Lee este documento COMPLETO antes de proponer cualquier cambio. Confirma que lo leíste resumiendo en 3 líneas qué entendiste sobre el estado actual del módulo offline antes de tocar código.**

---

## 📌 PENDIENTES PRIORITARIOS

> **Pendiente prioritario:** auditoría de aislamiento entre clínicas. Cada
> `createAdminClient()` esquiva la RLS; toda consulta ahí debe filtrar por
> `clinica_id`. Detalles y casos ya encontrados en `DEUDA_TECNICA.md`.

Mientras esa línea siga aquí, cualquier código nuevo que use
`createAdminClient()` tiene que filtrar por `clinica_id` explícitamente, aunque
parezca que no hace falta.

> **Ninguna migración se aplica sin pasar antes por
> `supabase/AUDITORIA-MIGRACIONES.md`.**

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

## 🔐 Autoridad de sesión — NO NEGOCIABLE

> Origen: el bucle de recarga de producción. Un médico que cerraba sesión
> entraba en una ráfaga de ~90 peticiones por segundo alternando `/?_rsc=` e
> `/inicio?_rsc=` hasta ahogar la pestaña. La causa no era ninguno de los dos
> guardas por separado: era que **decidían con autoridades distintas** sobre el
> mismo hecho. Tras una revocación el servidor borra la sesión pero el JWT
> sigue siendo criptográficamente válido hasta su `exp`, así que la lectura
> local decía «sí» y el servidor decía «no», y se rebotaban.

**La autoridad se elige por el TIPO de decisión, no por la ruta.**

* **Dejar pasar / no renderizar** (nodo terminal, dentro del área ya
  autenticada): `getClaims()` o presencia de cookie. Barato. La barrera real de
  datos es la RLS, no esto.
* **Redirigir a otra página** (arista): siempre `getUser()`. Sin excepción.
* **Un redirect nunca se decide con una autoridad más débil que la del
  destino.** Si el destino pregunta al servidor, el origen pregunta al
  servidor.

Dónde está aplicado hoy, y por qué cada uno es lo que es:

| Guarda | Decisión | Autoridad |
|---|---|---|
| `src/middleware.ts:177` (`sesionValida`) | dejar pasar | `getClaims()` — local, barata |
| `src/middleware.ts` (`/` → `/inicio`) | redirigir | `getClaims()` — **excepción tolerada, con pasador en el propio archivo**: no cicla sólo porque `/login` es sumidero |
| `src/app/login/layout.tsx` (`/login` → `/inicio`) | redirigir | `getUser()` |
| `src/app/(launcher)/inicio/layout.tsx:16` | redirigir | `getUser()` |
| `src/app/(app)/layout.tsx:26` y los `expediente/*` | redirigir | `getUser()` |

Corolarios que cuestan caro si se olvidan:

1. **Mover un guarda de página al middleware casi siempre degrada su
   autoridad**, porque ahí sólo hay `getClaims()`. Es la tentación obvia
   —ahorra el viaje a Auth— y es la forma de reintroducir el bucle.
2. **Un redirect entre guardas de la misma autoridad no cicla si sus
   condiciones son complementarias y las dos degradan hacia el mismo lado.**
   `/inicio` redirige cuando NO hay usuario y `/login` cuando SÍ lo hay; las
   dos, ante un error de Auth, acaban sirviendo el formulario de `/login`. Ese
   sumidero es la propiedad que hay que conservar.
3. Un guarda de servidor **no sustituye** al blindaje de cliente sin red: sin
   red no hay petición, luego no hay guarda. Conviven.

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

> **Nota del 2026-11-22:** desde el 2026-11-21 el equipo es **Ubuntu 26.04
> nativo, sin WSL ni Windows**, con **Docker Engine 29.1.3** (no Docker
> Desktop), y el repo es un clon normal en `~/proyectos/app_ortointegra-agenda`.
> Lo que sigue sobre WSL, Docker Desktop y las rutas `/home/ancoa/…` describe
> el equipo anterior. Detalle práctico: `GUIA_PRUEBAS_AGENDA_V2.md`, §1.1.

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
| Supabase CLI | 2.117.0 | Lee `supabase/config.toml` (con `[local_smtp]`); usada en todos los reinicios locales de la agenda, del 2026-09-16 al 2026-11-22 |
| WSL Ubuntu | 24.04 LTS | Última LTS soportada |

> **CLI de Supabase: fijada en 2.117.0 (2026-11-22), aquí y en `LOCAL_DEV.md`.**
> Se usa como `npx --yes supabase@2.117.0`. Sustituye a la 2.95.4, que no lee
> `supabase/config.toml`: aborta con `failed to parse config: 'config.config'
> has invalid keys: local_smtp` (comprobado en B5-bis, 2026-09-16). Si cambias
> el número, cámbialo en los dos sitios a la vez.

**Regla de actualización:** NO usar versiones de herramientas con menos de 1
semana en el wild. Regla específica para herramientas que tocan datos médicos
de producción (Supabase CLI, Docker). Ver `LOCAL_DEV.md` para procedimiento de
actualización.

### Docker Desktop

- Instalación con integración WSL 2 ("Use WSL 2 instead of Hyper-V" marcado)
- Debe estar corriendo antes de cualquier comando `supabase start` o `supabase db pull`
- Validación rápida desde WSL: `docker --version` debe responder sin errores

### Estado actual de Supabase local (2026-11-22)

> Sustituye a la lista «Pendiente de configurar» del 2026-05-04, que ya no era
> cierta.

- Existe `supabase/config.toml` y el stack local (Postgres + Auth + Storage en
  Docker) se levanta con la CLI 2.117.0.
- `supabase/migrations/` tiene 50 migraciones; `supabase db reset --local` las
  aplica todas (procedimiento: `GUIA_PRUEBAS_AGENDA_V2.md`, P5).
- No hay `supabase/seed.sql`: los datos de prueba de la agenda los siembra
  `scripts/agenda-semilla.ts`.

**Connection string de producción** (Session pooler, IPv4; sólo para Angel, en
su terminal: ver «🗃️ Base de datos»):
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

### Integración de ramas — no se usan pull requests

Las ramas se integran con `git merge` sobre `main` desde local (fast-forward)
y se empujan con `git push`. **Nada de `gh pr create` ni de flujos de PR:** no
propongas abrir un PR, no lo ofrezcas como paso siguiente y no lo ejecutes.
Cuando una rama esté lista, lo que sigue es el merge local.

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
* Las migraciones SQL van en `supabase/migrations/`, un archivo por migración con la fecha delante (las recientes, `AAAAMMDDhhmmss_nombre.sql`). Los viejos `supabase_migration_*.sql` de la raíz están archivados en `supabase/archivo-migraciones-historicas/raiz/` y no se imitan

---

## 🗃️ Base de datos

* **Cómo llega una migración a producción (flujo vigente desde 2026-11-22;
  sustituye a «genera el archivo SQL y yo lo ejecuto manualmente en
  Supabase», de antes de que Angel usara la CLI):**
  1. se clona con la CLI la **ESTRUCTURA** de producción, sin datos (la
     «foto»);
  2. se aplican sobre ese clon las migraciones nuevas;
  3. se prueba la app sobre ese clon;
  4. se audita;
  5. si todo pasa, se aplica a producción con la CLI.
* **Nada se aplica a producción sin las cuatro cosas:** el ensayo sobre el clon
  de estructura, la auditoría global (`supabase/AUDITORIA-MIGRACIONES.md`), las
  consultas de conteo de sólo lectura corridas por Angel, y la **ORDEN
  EXPLÍCITA** de Angel.
* **Quien aplica a producción es Angel, con la CLI, en su terminal.** Claude
  nunca tiene ni pide la contraseña ni la cadena de conexión con credenciales,
  ni las guarda en archivos ni en registros. Nunca corre por su cuenta
  `supabase link`, `db push` ni nada con `--linked`.
* **En LOCAL sí** se aplican migraciones y se reinicia la base
  (`supabase db reset --local`; siempre `--local`).
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
- **mejora_agendaV2.md** — Agenda v2 (reserva por enlace, Google en los dos sentidos, recordatorios). Leer ANTES de tocar la agenda, sus rutas públicas o sus migraciones. Resumen y reglas en la sección «Agenda v2» de abajo.

---

## 📅 Agenda v2 — estado y reglas (cierre del proyecto, 2026-11-12)

Plan, decisiones y avance: `mejora_agendaV2.md` (§6-bis decisiones, §7 lo que
le toca a Angel, §10 lo que no se probó en local). Auditoría del conjunto de
migraciones: `supabase/AUDITORIA-CONJUNTO-AGENDA-V2.md`. Guía local:
`GUIA_AUDITORIA_AGENDA_V2.md`; pruebas a mano: `GUIA_PRUEBAS_AGENDA_V2.md`.
Deuda abierta: `DEUDA_TECNICA.md`, AG-DT-13 a AG-DT-275.

**Estado:** el código y las migraciones de la agenda están en `feature/agenda-v2`,
probados sólo en local. Las 44 migraciones del proyecto (`20261111120000` a
`20261124160000` y `20261125180000`) se **fundieron el 2026-11-22 en seis**,
`20261201120000` a `20261201170000`, que van en orden de nombre (F1 → F5a →
F3 → F2 → F4 → F5b); las originales siguen en el tag `fusion-originales`
(`mejora_agendaV2.md` §7.1; mapa, notas y diferencias en `supabase/fusion/`).
Hay además dos que **no son de la agenda**,
`20261125170000_audit_log_sin_truncate.sql` y
`20261126120000_public_sin_truncate.sql`: se aplican solas y pueden ir antes que
todas (13 en total con las 5 de `main`). En producción no hay nada
aplicado ni encendido hasta que Angel lo haga (§7).
Y una séptima de la agenda, aparte del conjunto fundido para no tocar su
equivalencia: `20261201180000_agenda_sin_truncate.sql` (disparador contra
TRUNCATE en las 11 tablas de la agenda con datos de personas), que va después
de las seis y de `20261126120000`; el conjunto pasa a 14 con las 5 de `main`.

**Reglas que un editor futuro no debe romper:**

* **Interruptor por clínica** `agenda_ajustes.agenda_v2_encendida`: ~~nace en
  `false`~~ sólo `postgres`/`supabase_admin` lo cambian
  (`trg_agenda_ajustes_proteger`). **Falla cerrado:** un error al leerlo o la
  tabla ausente cuentan como apagado, y apagado la agenda es la de antes. No
  quites esa tolerancia, ni la de las RPC ausentes (PGRST202/42P01).
  **Agenda para todos (M3, `20261206120000`; decisión de Angel, 2026-11-25;
  escrita, sin aplicar en producción):** la v2 está ENCENDIDA de fábrica en
  todas las clínicas; sólo una fila que diga `false` la apaga. Lo que no se
  debe romper:
  * **La app no decide: PREGUNTA a la base** (`rpc('agenda_v2_encendida')`, en
    `agendaV2Encendida` y en `ProximasCitas`). No vuelvas a leer la columna
    para decidir, ni escribas «sin fila = encendida» en la app: la app y los
    disparadores tienen que contestar lo mismo antes y después de M3. Única
    excepción, a propósito: `/agenda/configuracion` sigue leyendo la FILA
    (interruptor y ajustes en UNA consulta, para no añadir un viaje); sin fila
    no abre, y es coherente: sin fila la configuración no puede guardar.
  * **Toda clínica tiene su fila** (`trg_clinicas_agenda_ajustes` en
    `clinicas`). Ocho funciones de la agenda leen la FILA, no la función común:
    sin fila la clínica queda a medias. Para borrar una clínica se borra antes
    su fila (FK RESTRICT; no la cambies a CASCADE).
  * **«Sin fila» ya no es «apagada».** Quien necesite la v2 apagada (la
    semilla, una prueba, la limpieza de citas) escribe `false` como postgres;
    borrar la fila la deja ENCENDIDA.
  * **Orden de despliegue: el código primero, M3 después** (`main` borra citas
    con DELETE y `trg_appointments_proteger_borrado` actuaría en todas).
  * Deshacer M3 = apagar en todas y luego su reversa
    (`docs/spec/agenda-para-todos/ENSAYO.md`, §4).
* **Bloque «agenda para todos» (2026-11-25; cuatro migraciones escritas, sin
  aplicar en producción: MA `20261203130000`, M4 `20261204120000`, M5
  `20261205120000` y M3 `20261206120000`).** Guion único:
  `docs/spec/agenda-para-todos/ENSAYO.md`. MA, M4 y M5 pueden ir antes del
  código nuevo; M3, SIEMPRE después (por eso lleva el sello más alto).
  * **MA · «Marcar todos» no adelanta a una transacción abierta**
    (`aviso_visto_hasta_sellar` + `avisos_transaccion_mas_antigua()`, DEFINER
    porque la sesión no ve `pg_stat_activity` entero). No le quites el recorte:
    un aviso cuya transacción confirma después de la marca quedaría visto sin
    que nadie lo viera. Lo vigila `scripts/avisos-carrera.sh` (dos sesiones).
    `aviso_clinica_de_cambio_medico` espera 200 ms como mucho por los avisos
    de la cita; no le quites el `lock_timeout` ni el `SKIP LOCKED`.
  * **M4 · La purga de la reserva** (`reserva_purgar()`, que llama la tarea
    diaria `/api/cron/purga-reserva`; entrada exacta con `===` en el
    middleware) tiene el plazo de 30 días DENTRO: no lo conviertas en argumento.
    Es SECURITY DEFINER y **de eso depende que pueda vaciar el correo de un
    enlace de un solo uso** sin tocar `proteger_reserva_enlace_unico()`
    (decisión expresa de Angel): sólo NULL, sólo `correo` y `correo_hmac`, sólo
    únicos que dejaron de servir hace más de 30 días. No le añadas ningún otro
    cambio de `reserva_enlaces`. `reserva_codigo_emitir` tiene tope propio (3
    por correo y hora, `'limite'`), los mismos números que
    `LIMITES.codigo.correo`: si cambia uno, cambia el otro.
  * **M5 · Los empalmes de Google van por la cola `gcal_empalmes_pendientes`:**
    la apuntan dos disparadores de `appointments` que sólo se ejecutan con
    `spinus.via = 'google'` (no les quites el `WHEN`: es lo que los hace gratis
    para una escritura normal) y la vacía `reserva_empalmes_pendientes_procesar`.
    El servidor la procesa al empezar la pasada (un fallo ahí tumba la pasada A
    PROPÓSITO: es la señal) y al acabar cada página. Sin FK a `appointments`, a
    propósito. La semilla borra la tabla antes que las clínicas.
* **R1 (`20261207120000`, 2026-11-26; escrita, sin aplicar en producción) · el
  comprobante de la reserva sólo quita el recordatorio si salió YA DENTRO de la
  ventana del recordatorio de esa cita** (`coalesce(enviado_en, tomado_en) >=
  inicio − recordatorio_horas`). La condición está DOS veces, en
  `cita_correo_tomar` y en `cita_recordatorios_pendientes`, y van juntas (como
  la del destinatario). No vuelvas a «si hay comprobante, no hay recordatorio»:
  dejaba sin recordatorio a toda cita reservada por enlace con más antelación
  que la ventana (defecto visto en producción). El recordatorio se elige en
  horas, libre, en la pantalla (`CampoNumero` de `BloquesAvisos.tsx`), dentro
  del rango de la base. Pendiente de decidir Angel: con 1 hora la ventana queda
  vacía (`docs/spec/recordatorio-reserva/ENSAYO.md`, §5).
* **Rutas públicas nuevas en `src/middleware.ts`**, cada una en su línea:
  * `/reservar/` y `/confirmar/` con prefijo y barra final;
  * `/api/reservar/` con prefijo;
  * `/api/confirmar/{22}` con expresión exacta;
  * `/api/cron/google-sync` y `/api/cron/recordatorios` con `===`, **nunca
    dentro de `publicApiPaths`**, que compara con `startsWith`.

  Ninguna sustituye ni toca `startsWith('/r/')` (el QR de las recetas). Su
  puerta es el código del enlace o `CRON_SECRET`, comparado en tiempo
  constante y con respuesta sin datos.
* **`/confirmar/{código}` sólo lee.** El estado de la cita cambia sólo con el
  POST de un botón: ni abrir el enlace ni la vista previa de un correo o de
  WhatsApp cambian nada.
* **Códigos de enlace:** se derivan por HMAC de `RESERVA_SECRETO`, y en la base
  sólo se guarda su sha256. Rotar el secreto invalida todos los enlaces y el
  historial del candado.
* **`log_cita_change()`** (auditoría de citas, siempre encendida):
  * escribe NOMBRES de columna, nunca valores;
  * la lista de columnas técnicas está dos veces (en la función y en el WHEN
    de `audit_appointments_update`) y van juntas;
  * `via` sólo sale de la lista blanca `c_vias` (`google`, `enlace_paciente`,
    `google_rsvp`); un literal nuevo exige migración.
* **Puerta S3** (`gcal_sync_clinica_habilitada`): lee el cuerpo vigente de
  `clinica_tiene_acceso()` y `clinica_no_suspendida()`. Si cambias la FORMA
  de cualquiera de las dos (plpgsql, varias sentencias, `get_clinica_id()` sin
  `public.`), la sincronización con Google se detiene, cerrada (P0001), hasta
  revisar la puerta (F2, `20261201150000`). F4 (`20261201160000`) exige además el md5 de `clinica_no_suspendida()`.
  Ninguna migración de v2 modifica esas dos funciones ni ninguna policy
  existente, y no se añade otra puerta RESTRICTIVE: `tipos_cita` y
  `agenda_ajustes` no la llevan, a propósito.
* **A Google no viaja nada nuevo:** las observaciones escritas en Spinus no
  viajan (S1), y el título de una cita con paciente no se acepta desde Google.
  En correos y en WhatsApp nunca va nada clínico.
* **Con v2 encendida, una cita con paciente o por ligar no se borra: se
  cancela.** Las tablas de v2 apuntan a `appointments` y a `clinicas` con
  RESTRICT, y la API traduce el 23503 a 409. No las cambies a CASCADE. Además
  la **base** lo rechaza aunque se salte la API: el disparador
  `trg_appointments_proteger_borrado` (`cita_proteger_borrado()`,
  `20261201170000`) da 42501 a todo rol salvo `postgres`/`supabase_admin`,
  **también a `service_role`**. Un borrado de citas del servidor con v2
  encendida falla; quien limpie citas (semilla, scripts) ~~borra antes la fila de
  `agenda_ajustes`~~ APAGA antes la v2 (escribe `false` en la fila, como
  `postgres`: desde M3 borrar la fila la deja encendida) o lo hace como
  `postgres`.
* **Las columnas `reserva_*` de `appointments` sólo las escribe el servidor**
  (`trg_appointments_proteger_reserva`, `20261201170000`): para todo rol que no
  sea `service_role`/`postgres`/`supabase_admin`, al crear van todas NULL
  (`reserva_reagendados` 0) y al editar no cambian, salvo vaciar
  `reserva_telefono`/`reserva_correo`. El disparador lista las columnas **por
  el prefijo**, así que una columna nueva `reserva_*` queda cerrada sola; si
  lleva DEFAULT, **rompe el alta de citas con la sesión** (dale otro nombre o
  añade la excepción en la función). Las funciones que las escriben son
  INVOKER y las llama `service_role`; una SECURITY DEFINER de `postgres` se
  saltaría el disparador sin que nadie lo note.
* **El candado automático decide por el correo verificado; el teléfono, sólo
  por el bloqueo manual** (`20261201140000`, decisión de Angel). «Una cita
  activa», cancelaciones, inasistencias y el bloqueo automático cuentan por
  `correo_hmac`; el teléfono no bloquea solo. En el enlace fijo la ficha del
  correo se comprueba antes de leer nada de la persona, para que la respuesta
  no dependa del teléfono. No vuelvas a contar por teléfono (dejaría
  perjudicar a un tercero con su número). El bloqueo manual sí corta por
  teléfono, también en el enlace de un solo uso (AG-DT-28).
* **Los enlaces de reserva sólo los emite `reserva_enlace_emitir`** (sólo
  `service_role`; `proteger_reserva_enlaces()` rechaza cualquier otro INSERT),
  llamada con `createAdminClient()` desde `POST /api/agenda/enlaces` y filtrada
  por la `clinica_id` de la sesión (`p_clinica_id`) y el actor (`p_actor`), tras
  las mismas puertas de sesión, interruptor y permisos. Es una excepción
  anotada a «sólo cliente de sesión» de `gestionServidor.ts`; leer, mostrar y
  revocar siguen con la sesión. La base no conoce `RESERVA_SECRETO`: la única
  garantía de que el hash lo calculó el servidor es que sólo el servidor
  inserte.
* **Quien reemplace `proteger_reserva_enlaces()` parte del cuerpo de
  `20261201140000`** (F3; md5 de `prosrc` `acd4128b…`, el de antes de la fusión,
  que el post-vuelo de F3 exige), no del de D1: el de D1 deja insertar a la
  sesión.
* **Correo:** todo el de la agenda pasa por `src/lib/correo/transporte.ts`
  (`EMAIL_TRANSPORT`; `captura` → Mailpit en local). No llames a Resend directo
  desde código nuevo (AG-DT-16).
* **El Google falso** (`src/lib/gcalFalso.ts`) sólo se abre con
  `GCAL_FALSO_URL`, fuera de `NODE_ENV=production` y con la Supabase local. No
  relajes esa doble guarda.
* **El aviso de privacidad de la reserva** (`src/lib/reserva/avisoReserva.ts`)
  está PENDIENTE DE REVISIÓN LEGAL. Mientras lleve la marca, el enlace no abre
  aunque se apruebe su hash. No quites la marca sin la revisión de Angel.
* **La agenda depende de Fluid Compute en Vercel** (oleada 3, 2026-11-22). Lo
  que sus rutas dejan en `after()` vive dentro del límite de duración de la
  función (`after.md` de Next 16.2.1, «Duration»). **Ninguna declara
  `maxDuration`, a propósito:** heredan los 300 s por omisión que da Fluid
  Compute en Pro (https://vercel.com/docs/functions/configuring-functions/duration,
  «Duration limits», leída el 2026-11-22; Angel confirmó en el panel que está
  activado). Si se desactiva Fluid Compute o se declara un `maxDuration` corto,
  ese trabajo puede cortarse sin error visible. Son `reservar/[codigo]`,
  `reservar/[codigo]/turnos`, `confirmar/[codigo]`, `appointments`,
  `appointments/[id]`, `appointments/[id]/reagendar`, `agenda/bloqueos` y
  `agenda/bloqueos/[id]` (bajo `src/app/api/`). `consultas` tampoco lo declara
  (AG-DT-267).

**Tanda tras las primeras pruebas a mano (2026-11-13, ramas T1-T3; sin
migraciones).** Además de lo de arriba:

* **La búsqueda de pacientes de la agenda** (formulario completo, burbuja,
  buscador, «Convertir en cita») es `buscarPacientes`
  (`src/lib/agenda/buscarCitasPaciente.ts`): UN `.or()` POR PALABRA con
  `imatch` y el patrón sin acentos (`patronSinAcentos`). No vuelvas al `.or()`
  único con el texto entero (era el defecto de «Hugo Interián»), ni metas en el
  patrón nada que no sea `[a-z0-9]` y las clases de vocales (PostgREST y la
  regex lo leerían como sintaxis). Sale sin interruptor: depende de que
  PostgREST admita `imatch` (comprobar en producción, `mejora_agendaV2.md` §7).
* **Si el botón de WhatsApp se pinta o no lo decide `motivoSinWhatsApp`**
  (`whatsappCita.ts`), la MISMA función que usa la ruta. Ninguna condición
  propia en los componentes.
* **Las capas flotantes (burbuja, tarjeta, desplegable de fecha) nunca salen
  de la ventana:** `posicionCapa` devuelve `altoMaximo` y el componente lo pone
  como `max-height`, midiendo el alto NATURAL (`scrollHeight`) y la parte
  VISIBLE (`visualViewport`). `colocar` está copiado en tres archivos
  (AG-DT-38): un arreglo va en las tres copias.
* **`handleSave` devuelve el alta creada (`AltaGuardada`) y acepta
  `{ sinInvitacion }`:** la burbuja ofrece la invitación de Google como botón;
  desde el formulario completo sigue abriéndose sola tras crear.
* **Una sola regla para «¿abre este enlace?»** (`src/lib/reserva/aperturaEnlace.ts`):
  la usan la página pública y la configuración. No escribas a mano la condición
  de «Este enlace ya no está disponible» en un sitio solo.
  `sin_disponibilidad` NO cierra la página, a propósito.
* **`preparacionServidor.ts` es la segunda excepción a «sólo cliente de
  sesión»** de la gestión de enlaces: lee con `createAdminClient()` sólo
  `medico_id, horario, horario_propio` de `consultorios`, filtrado por
  `clinica_id` y con el alcance del rol; del navegador sólo sale el motivo.
* ~~La rejilla y los avisos leen una sola variable `horario`
  (`horarioDeLaRejilla`)~~: **sustituido por la regla de G4, abajo** (la agenda
  se dibuja con los consultorios). Lo que sigue en pie: con la v2 apagada, el
  MISMO objeto `config?.horario ?? HORARIO_DEFAULT` (A1-bis).
* **Convertir en cita (AG-DT-29) es un alta:** con la v2, colgarle un paciente
  a una fila sin paciente que no está por ligar pasa por `vetoDeConversion`
  (`porLigarServidor.ts`): las tres funciones de `appointments_gates_insert`
  ORIGINALES por RPC con la sesión, consultorio obligatorio y paciente de la
  clínica visible para quien convierte. No lo quites creyéndolo redundante con
  la RLS: la de UPDATE no tiene esas puertas. A Google va lo de cualquier cita
  con paciente (título del paciente, descripción fija; nunca las notas).
* **La tarjeta al pasar el ratón no es modal y no toca el foco:** no le pongas
  `aria-modal` ni `useDialogoModal`. Abre por `abrirCita` (nunca el modal) y
  nunca con un botón pulsado.
* **La elevación del hover va en la caja de dentro** (`.ag-tarjeta`,
  `.ag-mes`, `.ag-banda`), nunca en el `.fc-event` (FLIP), y nada con
  movimiento reducido.
* **Las e2e limpian sólo lo que crearon** (`marcaE2e()` en el `beforeAll` y
  `limpiarReservasE2e(desde)`; los tipos de cita que había se aparcan y se
  devuelven). No vuelvas a un `delete` de todo lo de una clínica en una
  prueba. Pero la semilla, y por tanto cada corrida de Playwright, recrea las
  clínicas Semilla A y B enteras (AG-DT-46).

**Tanda de diseño, duración y horarios (2026-11-14, ramas G1-G4; 4 migraciones,
el conjunto pasa a 24 del proyecto).** Además de lo de arriba:

* **Páginas públicas de la agenda (G1):** `/reservar` y `/confirmar` van dentro
  de `MarcoPublico` (`src/components/agendaPublica/`) con `agendaPublica.css`
  (prefijo `rp-`, sólo tokens `--ag-*`). Sin `ScriptTema`. *(El oscuro por
  `prefers-color-scheme` de G1 lo quitó H1: van siempre en claro, ver abajo.)* Fechas con `mayusculaInicial`,
  nunca con la clase `capitalize` («13 De Noviembre»).
* **Todo correo de cita se arma con `src/lib/correo/plantillaCita.ts`**
  (`htmlCorreoCita`/`textoCorreoCita`): tablas y estilos en línea, marca en
  texto, SIN imágenes, botones «a prueba de balas», todo escapado ahí y nada
  clínico. No vuelvas a un `envolver` propio. Los colores son copia de los
  tokens de fábrica (AG-DT-47). **El recordatorio y la confirmación comparten
  cuerpo** (`correoDeCita` en `correosCita.ts`) y cada uno pone SUS palabras
  (`PalabrasCorreo`: asunto y título): la confirmación puede salir días antes y
  no dice «Recordatorio» ni «mañana». No metas palabras de uno en el cuerpo
  común.
* **La duración de la consulta es un tipo de cita** `principal` del médico; la
  de un consultorio, otro principal con `consultorio_id` (`20261201120000`).
  Qué tipos valen en un consultorio lo decide `tiposDelConsultorio`
  (`src/lib/agenda/tiposPorConsultorio.ts`), UNA regla para la página de
  reserva (en el servidor, `tiposPorConsultorio`), `/turnos`, el POST, el modal
  y el ajuste de la agenda. `reservar_por_enlace` NO mira el consultorio del
  tipo: no la llames sin filtrar antes. A la página pública no viajan
  `principal` ni `consultorio_id`.
* **`tipos_cita_insert` y `tipos_cita_update` dejan al médico crear, cambiar y
  archivar SUS tipos** (`20261201120000`; decisión de Angel),
  sin reasignarlos (WITH CHECK = USING); el administrador, como en B6; la
  secretaria, nada. Archivar es UPDATE: no hay DELETE en `tipos_cita` y no debe
  haberlo.
* **Turnos en rejilla fija** (`turnosDeJornada`): desde la apertura con paso
  igual a la duración; un turno tocado en parte no se ofrece. `turnoValido` es
  SÓLO la rejilla; lo libre lo decide la RPC con la misma condición de empalme.
  No vuelvas a contar turnos desde cada hueco ni a validar con la ocupación.
* **El ajuste al turno de la agenda** (`useAjusteTurno`) sólo actúa con la v2 y
  con consultorio y duración claros; nunca toca la hora escrita a mano. Lee los
  MISMOS consultorios que la rejilla (`consultoriosV2` y `seleccion` de
  `AgendaCliente`): en un clic, el único de la selección con un médico a la
  vista. Los tipos los lee la PÁGINA en el servidor (`leerTiposAjuste`,
  sesión y RLS) y llegan como promesa: no los pidas desde el navegador al montar
  (era una validación más contra Auth al abrir). Van a una referencia: si los
  pasas a estado, su llegada vuelve a pintar la rejilla.
* **La agenda v2 se dibuja con los consultorios, no con la clínica (G4;
  sustituye a la regla de T2 de «una sola variable `horario`»)**
  (`src/lib/agenda/horarioRejilla.ts`: `consultoriosDeLaRejilla`,
  `fuenteDeLaRejilla`, `crearAvisosHorario`). Rejilla, «Compactar», hora de
  apertura, Mes y panel de huecos leen `fuente.horario` (en la hora del
  dispositivo, con los consultorios de otra zona convertidos) y el gris
  `fuente.businessHours`; los avisos de fuera de horario del alta, el arrastre,
  la burbuja y el formulario, `avisosHorario`, que compara en la hora del
  consultorio de la cita. No pases a un aviso un horario «convertido». Apagada,
  `config?.horario ?? HORARIO_DEFAULT`, el MISMO objeto, y los avisos de
  siempre (A1-bis). Con la v2 el botón dice «Compactar la rejilla al horario de
  los consultorios» (`etiquetaCompactar(vista, agendaV2)`).
* **`clinicas.horario_consulta` no se borra ni se cambia** (spinus-consola): con
  la v2 sólo lo heredan los consultorios con `horario_propio = false`. La
  migración `20261201120000` (F1) copia una vez el de la clínica a cada consultorio
  sin horario propio, con respaldo en `respaldos.consultorios_horario_20261119`
  (esquema sin privilegios para `anon`, `authenticated` ni `service_role`).
  La configuración con la v2 no tiene «Horario de la clínica»; el engrane
  apagado sigue abriendo `HorarioModal`.
* **Tercera excepción a «sólo cliente de sesión»:**
  `consultoriosAgendaServidor.ts` lee con `createAdminClient()` `id, medico_id,
  timezone, horario, horario_propio, activo` de `consultorios`, filtrado por
  `clinica_id` y por el alcance de `appointments_select` (administrador y
  secretaria: todos; médico: los suyos), sólo con la v2.
* **El correo de confirmación de Spinus** (`POST /api/agenda/correo`,
  `confirmacionCita.ts`) va por `cita_correo_tomar` con `tipo:
  'confirmacion'` (`20261201160000`): el destinatario lo da la base, una por
  hora de inicio, y no quita el recordatorio. Lo manda cualquier rol que vea la
  cita (decisión de Angel). La regla de cuándo se ofrece es `motivoSinCorreo`
  (`whatsappCita.ts`), la misma en la ruta y en los botones.
* **Las acciones de la tarjeta dependen del estado** (`disposicionDeTarjeta`,
  `accionesTarjeta.ts`): no añadas una acción en un componente; y lo que la
  tarjeta no ofrece, el servidor lo rechaza (`vetoPorEstado`, `estadoCita.ts`):
  una atendida no se confirma, ni se cancela, ni se mueve. «Editar» es el
  engrane «Configuración de la cita»; las e2e lo pulsan con
  `editarDesdeTarjeta`.
* **Una cita atendida con nota clínica ligada no cambia de estado ni se borra**
  (`vetoPorNotaLigada`, `notaLigadaServidor.ts`), con o sin v2. Es regla de la
  API y, desde la tanda H, también de la base (ver abajo, H5).
* **«Reagendar cita» (cancelada, no asistió) crea OTRA cita**
  (`altaParaReagendar`): nunca reabras la cancelada o la falta; cuentan para el
  candado y para la agenda.
* **Con la v2, ninguna cita lleva `title`**: su caja lleva `role="group"` y
  `aria-label`. No vuelvas a ponerlo (el aviso negro lo quitó Angel). **El
  interruptor llega a las cajas por `useSinAvisoFlotante`**
  (`MemoizedEventContent.tsx`, lo fija `AgendaCliente`), **nunca como argumento
  de `renderEventContent`**: si `renderEC` depende del interruptor, al leerse
  cambia `eventContent` y FullCalendar repinta todas las citas (+8 ms al volver
  del dashboard, medido). Es un valor de módulo: vale porque sólo hay una
  `AgendaCliente` montada a la vez. La sombra
  del hover no se anima: la transición de la caja de la cita es sólo de
  `transform` (3 px); la tarjeta al pasar abre a los 0,5 s.

**Tanda H (2026-11-15, ramas H1-H5; 3 migraciones, el conjunto pasa a 27 del
proyecto, 32 con las de `main`).** Además de lo de arriba:

* **Las páginas públicas y los correos de la agenda van SIEMPRE en claro (H1):** sin
  `prefers-color-scheme` en `agendaPublica.css` ni en `plantillaCita.ts`. `body:has(.rp)` redeclara en
  claro cada `--ag-*` que usan la hoja y los `.tsx` públicos y que `html.dark` cambia (ganan a una
  `html.dark` colgada); `agendaPublicaTokens.test.ts` lo exige token a token. Si usas un token nuevo
  que el oscuro cambia, cópialo ahí con su valor del `:root`. Las páginas exportan `viewport
  { colorScheme: 'light' }`. (Sustituye a la línea de G1 sobre el oscuro de estas páginas.)
* **La reserva siempre empieza en «Lugar»**, también con un consultorio (ya elegido). **«Volver» es
  `BotonVolver`, en el pie de cada paso después del primero**; lo escrito vive en `useReserva`
  (`borrador`), la casilla del aviso vuelve desmarcada a propósito. No vuelvas a un enlace arriba.
* **El correo es obligatorio en el enlace FIJO** (esquema y `reservar_por_enlace`), que además lo
  verifica con código. **El único lo admite vacío** (tanda I; hoy en `20261201140000`): sin correo no hay
  comprobante ni recordatorio, pero sí el aviso a la clínica. (Sustituye a «obligatorio en los dos».)
* **La configuración va en pestañas** (desde B13, `PestanasConfiguracion.tsx`: pestañas de TEXTO en todos los
  formatos, en `ext`/`tel` en una pista que se desliza; ya no iconos; patrón APG. `MenuConfiguracion.tsx` es el de la página vieja, sin montar): abre en «Primeros pasos» mientras falte
  algo y si no en la primera; todos los paneles montados, sólo uno visible. Un enlace interno a otra sección va con
  `href="#config-…"` y `PESTANA_DE_ANCLA` lo convierte en cambio de pestaña: si añades una sección, añádela ahí. Los
  enlaces de los médicos invitados van plegados (punto 6).
* ~~**Los botones de la configuración llevan borde y fondo en reposo** (`clasesConfig.ts`, tokens `--ag-control-*`,
  borde ≥ 3:1 en claro y oscuro). No vuelvas a un botón sin borde ni a un botón con aspecto de enlace.~~
  **Sustituido en B13 (AG9, maqueta `ag-config`):** los cuatro niveles de botón del kit (`estilosConfig.ts`); todo
  botón se LEE (letra ≥ 4,5:1 contra su relleno o su entorno) y los interruptores ≥ 3:1
  (`agenda-h2-configuracion` 7).
* **El recordatorio automático tiene su interruptor por clínica, APAGADO de fábrica**
  (`agenda_ajustes.recordatorio_encendido`, `20261201120000`). La tarea lista con `cita_recordatorios_pendientes`
  (`20261201160000`; la de E4 + el interruptor); sin la migración no existe y no se manda nada. No vuelvas a crear
  ni a llamar a `cita_correos_pendientes` (la de E4 sin el interruptor; se retiró en la fusión). El comprobante, el código de la reserva y la confirmación manual NO dependen de él.
* **«Restablecer configuración de la agenda»** (`POST /api/agenda/restablecer` → `agenda_restablecer_configuracion`,
  `20261201120000`, sólo service_role, INVOKER): sólo el administrador, con «RESTABLECER» escrito. Respalda el horario
  de cada consultorio en `audit_log` ('agenda_horario_restablecido') antes de dejarlo en el horario de partida de la v2
  (el de la clínica COPIADO y con `horario_propio = true`, la herencia de G4: la única fuente sigue siendo el
  consultorio; integración de la tanda H, decisión pendiente de Angel); archiva tipos (nunca borra) y revoca enlaces vigentes. No toca citas, pacientes, auditoría ni
  contactos bloqueados. No la hagas SECURITY DEFINER (se saltaría los disparadores de ajustes y enlaces).
* **«Primeros pasos», paso 1:** queda pendiente si algún consultorio activo del médico está «como nace» (sin horario
  propio y su `horario` todo cerrado), aunque herede el de la clínica (`pasosDe`). Tras «Restablecer» el paso 1 queda
  hecho (el horario de partida es propio): pide la duración y el enlace.
* **La burbuja traga el segundo clic de un doble clic** al cerrar `QuickPatientModal`
  (`useEscudoTrasRegistro`, 600 ms, 24 px del último punto pulsado): sin eso, el clic cae en la
  rejilla, cierra la burbuja y FullCalendar abre otra vacía. No lo quites creyéndolo un
  `setTimeout` de sobra.
* **`QuickPatientModal` pide teléfono sólo con `conTelefono`** (la agenda v2). Por omisión el
  modal y su petición son los de antes; el teléfono va a `pacientes.telefono` por el mismo
  `POST /api/pacientes`, con la validación de la ficha.
* **Las observaciones de la burbuja son `appointments.notes`**: no viajan a Google (S1), igual
  que las del formulario completo.
* **«Por confirmar» escucha el MISMO canal de la agenda** (`onCambioCita` de
  `useTiempoRealAgenda`, un `ref` en `AgendaCliente` que rellena el panel):
  no abras otro canal ni pases los cambios a estado de la agenda (repintaría
  todo). Qué hace cada cambio lo decide `efectoEnPorConfirmar`
  (`porConfirmarTiempoReal.ts`), la regla de la ruta: si cambias quién entra
  en la lista, cámbialo en las dos.
* **Los medios de una fila de «Por confirmar» son booleanos de
  `motivoSinWhatsApp`/`motivoSinCorreo`** (`con_whatsapp`, `con_correo`): ni
  el teléfono ni el correo viajan a la lista. «Marcar como confirmada» es
  `cambiarEstadoCita` (el PUT de «Confirmar»): no escribas otro camino.
* **Los huecos de Día en turnos** salen de `turnosEnTramo` (la rejilla del
  enlace) con el consultorio y la duración de `useAjusteTurno`
  (`rejillaDelGesto`); sin rejilla clara, el hueco de siempre. La promesa de
  los tipos que llega de la página es de Flight: para encadenar, envuélvela en
  `Promise.resolve` (su `then` no devuelve otra promesa).
* **Una cita atendida con nota clínica ligada no cambia de estado ni se borra
  (siempre) y no se mueve (con la v2) — también en la BASE**
  (`trg_appointments_proteger_atendida` → `cita_proteger_atendida()`,
  `20261201170000`; cierra AG-DT-61 para las citas con nota). 42501 a todo rol salvo
  `postgres`/`supabase_admin`, **también a `service_role`**. Médico, consultorio,
  notas y Google siguen editables. La nota se mira con `cita_tiene_nota_ligada()`
  (DEFINER, sólo booleano, sólo de la clínica de quien llama, sin `anon`), porque la
  RLS de `consultas` oculta las notas a la secretaria: no la hagas INVOKER ni pongas
  DEFINER al disparador (perdería `current_user`). Quien limpie citas atendidas con
  nota lo hace como `postgres` o borra antes la nota.
* **La lista de Semana del teléfono, sin citas de hoy en adelante, abre al FONDO**
  (`desplazarListaAHoy`); sin ninguna cabecera todavía, sigue pendiente. No vuelvas
  a «no mover nada»: el domingo abría en el lunes.
* **Las e2e que miran «hoy» fijan el reloj del navegador, y NUNCA en el futuro**
  (`fijarDia` de `agenda-f-pulido`: el lunes de la semana visible o la semana
  anterior). Un reloj adelantado más que la vida del JWT (1 h) hace que el
  navegador renueve el token de la sesión compartida de `e2e/.auth/` y saca la
  agenda a `/inicio`.
* **Un turno de «Huecos disponibles» propone la DURACIÓN DE LA CONSULTA**
  (`duracionTurno`: `abrirHueco(t, true)` → `seleccionDesdeHueco` →
  `sitioDelGesto` → `GestoAlta` → `duracionDeSeleccion`); un hueco sin turnos y
  el clic en la rejilla siguen en 60 min. **Con la duración conocida, el hueco
  mínimo es esa duración** (`huecosDelPanel` sobre `tramosLibres`, con
  `duracionDelPanel`, la misma rejilla que `turnosDelHueco`); sin ella,
  `HUECO_MINIMO`. `firmaDelResumen` firma `tramosLibres` (AG-DT-93).
* **Toda e2e que dispare `/api/cron/recordatorios` y espere (o niegue) un
  recordatorio enciende antes `recordatorio_encendido` y lo apaga al terminar**:
  apagado no sale ninguno y la prueba pasaría sin probar nada
  (`confirmacion-enlace` «lista A 4») o fallaría (`husos-dos-consultorios`).
* **Al fusionar con `feature/limites-ajustables`, la lista del caso 3 de
  `p1_permisos_funciones.sql` es de 49 funciones** (tras la tanda K: las 47 de J
  más `gcal_bloqueo_aplicar`, `rate_limit_espera` y `reserva_espera_reenvio`;
  y desde la integración M, `cita_nombre_saludo(uuid,uuid)`, sólo `service_role`;
  tras la fusión del 2026-11-22, sin las tres retiradas, `cita_correos_pendientes(integer)`,
  `reserva_enlace_emitir` de 7 argumentos y `reserva_enlace_regenerar_fijo(uuid,uuid,text)`,
  y con `agenda_v2_encendida(uuid)`, sin `anon`;
  `agenda_bloqueo_preparar()`, `cita_proteger_cierre()` y las demás de
  disparador tienen los tres roles y NO entran), escrita entera en
  `supabase/AUDITORIA-CONJUNTO-AGENDA-V2.md` §13.5 (la de antes de la fusión). Las pruebas SQL que llamen
  a una función de `pg_temp` como otro rol le dan GRANT explícito: con P1 nacen
  sin EXECUTE a PUBLIC.
* **Cada migración nueva añade su fila a la tabla de migraciones de
  `mejora_agendaV2.md` §7 («Todas las migraciones, una por una») en el mismo
  commit.** Las de `supabase/archivo-migraciones-historicas/` ya están en
  producción y no entran.

**Tanda I (2026-11-17):**

* **Cada archivo de e2e deja la v2 APAGADA al terminar** (`afterAll` con
  `interruptorAgenda('A', false)`); quien la necesita la enciende en su
  `beforeEach` o en la propia prueba. Encendida, las e2e que la suponen apagada
  (`agenda-secretaria`, `agenda-tipos-cita`) caen en el aviso de empalme
  (integración I, `067972c`).
* El canal de Realtime de la agenda vive en el módulo y **sobrevive 2 min**
  (`VIGENCIA_CITAS_MS`) al desmontaje: es lo que mantiene honesta la caché de
  rangos mientras la agenda no está. No lo cierres al desmontar ni acortes ese
  plazo «para ahorrar»: sin él, lo que cambie fuera de la agenda no invalida la
  caché y al volver se pinta lo viejo. Sigue siendo **un solo canal**
  (`appointments-realtime`).
* Toda escritura de citas hecha FUERA de la agenda en la misma pestaña llama a
  `vaciarCacheCitas()` al responder el servidor (`ligarCita.ts`, nota nueva).
* En un `onClick`, lo que se lea de `e.currentTarget` se lee **fuera** del
  actualizador de `setState`: el actualizador puede correr en el render, con
  `currentTarget` ya en `null` («Algo salió mal» al reabrir «Ir a una fecha»).
* **Una cita reservada por enlace que no ha pasado tiene candado**
  (`cita_proteger_eleccion`, `20261201170000`): médico, consultorio, día y hora
  no se cambian por PUT, arrastre, PostgREST ni Google. Consultorio, día y hora,
  sólo con «Reagendar» (`POST /api/appointments/[id]/reagendar` →
  `cita_reagendar_clinica`), que avisa al paciente. El médico, nunca. No relajes
  el disparador para un caso nuevo: que pase por `cita_reagendar_clinica`.
* **El único sin correo lleva un seudónimo por reserva**
  (`sha256('reserva-sin-correo:'||id)`) en `reserva_correo_hmac`. No es un HMAC
  de nada: no lo uses para buscar a la persona; para eso está el teléfono.
* **Los correos de la agenda al paciente salen a nombre del médico**
  (`cabeceraFrom` en `src/lib/correo/transporte.ts`); el aviso a la clínica sale
  como «Spinus» (`remitente: ''`). El nombre pasa siempre por `nombreRemitente`:
  nunca concatenes un nombre sin sanear en la cabecera `From`.
* **«Por asignar» es `appointments.google_asignacion`** (`20261201150000`):
  `'por_asignar'` lo pone SÓLO `cita_asignacion_google` al importar el sondeo
  (`service_role` + `spinus.via = 'google'`); `'evento'`, la ruta
  `POST /api/appointments/[id]/no-es-cita`; no se vuelve de `'evento'` a
  `'por_asignar'` (el camino es «Convertir en cita»). No lo confundas con «por
  ligar» (`reserva_canal`); las dos son «por ligar» en `esPorLigar`, y
  `esEventoGenerico` excluye las por asignar. Quien separe citas de eventos con
  `paciente_id` a secas las cuenta como eventos (AG-DT-109: `/inicio`,
  `TarjetaHoy`, `HoyEnConsultorio`).
* «¿No es una cita?» se monta con `BotonNoEsCita.tsx`, sólo en filas
  `esPorAsignar`: en el formulario, en «Próximas citas» y en el aviso
  `google_por_asignar` de la campana (al lado del aviso, nunca dentro de su
  botón). El aviso de Google (`trg_appointments_aviso_clinica`) usa la MISMA
  marca (`NEW.google_asignacion = 'por_asignar'`), y `cambioPuedeAvisar`
  también: si cambias quién queda por asignar, cámbialo en los tres.
* El escudo contra el doble clic tras `QuickPatientModal` es
  `useEscudoTrasRegistro`; en los diálogos, `dentroDeDialogos: true`.
* **Una cita ATENDIDA con nota ligada no cambia de estado NI de fecha/hora, con
  la v2 encendida o APAGADA** (`vetoPorNotaLigada` + `cita_proteger_atendida`,
  `20261201170000`). El PUT traduce su 42501 (`HINT_ATENDIDA_CON_NOTA`) a 409
  `nota_ligada`. (Amplía la línea de H5: «no se mueve (con la v2)».)
* `consultorios.horario_revisado_en`: NULL = «por revisar» en «Primeros pasos».
  La pone el PATCH de consultorios con la v2 (confirmar o guardar
  disponibilidad); «Restablecer» la vuelve a NULL. Sin la columna, el PATCH
  reintenta sin ella.
* Pregunta de asistencia: `asistenciaServidor.ts` (servidor, viaja con la
  página; `createAdminClient` sólo para saber qué citas tienen nota, filtrado por
  clínica). Más de 48 h desde el inicio y 30 días como mucho
  (`DIAS_QUE_SE_PREGUNTAN`; decisión de Angel, 2026-11-25: lo anterior no se
  pregunta ni se toca), sin nota. Nada marca `no_show` solo. La
  e2e que siembre una agendada de hace más de 48 h y abra la agenda v2 cierra la
  ventana (`decidirDespues` de `e2e/interaccionesAyudas.ts`).
* **Cancelada cerrada:** `appointments.cerrada_en` + `sustituida_por` (FK
  RESTRICT), sólo `service_role` (`cita_proteger_cierre`, `20261201170000`),
  sólo sobre una cancelada y con una sustituta viva de la misma clínica; no se
  reabre. La agenda (`consultaCitas`), el tiempo real y el buscador no la pintan;
  NO se borra. `POST /api/appointments` con `sustituye_a` (v2) la cierra en la
  misma petición.
* **Avisos de la clínica (`avisos_clinica`, `20261201160000`):** sólo los
  escriben los disparadores `aviso_clinica_de_*` (DEFINER, dueño postgres); el
  personal sólo marca revisado, y un revisado no se reabre. Para mostrarlos en
  otra página: `useAvisosClinica()` sin `datos` + `<ListaAvisos>` sin `alAbrir`
  (cada aviso enlaza a `/agenda?cita=<id>`). En la agenda viajan en
  `GET /api/agenda/por-confirmar`: no añadas otra petición al abrirla.
* **El correo a la clínica por cada reserva** está APAGADO de fábrica
  (`agenda_ajustes.correo_reserva_clinica`) y no lleva nada clínico: no le
  añadas tipo de cita, motivo ni datos de contacto del paciente.
* **Tanda J (2026-11-18).** Lo que sigue es de J1 a J5 y de su integración.
* **La campana y el menú del engrane NO van en el chunk de la página**
  (AG-DT-136, J1). `AgendaCliente` los importa con `import()` SOLO cuando el
  interruptor está encendido, y los guarda ya resueltos en estado en el mismo
  callback que da el interruptor por leído (`leerInterruptorYBarra`). **No los
  pases a `dynamic()`:** su `React.lazy` suspende un fotograma al montar aunque el
  chunk ya esté descargado, y la barra v2 sale sin engrane ni campana (lo cuenta
  `agenda-j1-engrane`). **Tampoco los importes en estático:** vuelven a bajar con
  la v2 apagada. Si el chunk falla, la v2 se queda apagada (falla cerrado).
* **«Pop-up de eventos» (la tarjeta al pasar el ratón) vive en el menú del
  engrane**, no en la configuración. La clave es la misma:
  `spinus.agenda.tarjeta-al-pasar`. En ese menú, lo de dos estados es
  `menuitemcheckbox` con interruptor a la derecha; lo que abre algo es `menuitem`
  sin interruptor. Una opción con más de dos valores no lleva interruptor.
* **Enlace de un solo uso: el correo es el de la clínica, nunca el tecleado**
  (J2). `reservar_por_enlace` ignora `p_correo` y `p_correo_hmac` en el único y
  usa `reserva_enlaces.correo` y `correo_hmac`, que la clínica escribe al emitir
  (`reserva_enlace_emitir` de 9 argumentos; el HMAC lo calcula el servidor). La
  página del único no pide correo. No reintroduzcas el correo tecleado en el
  único (era AG-DT-100). El campo está en «Crear uno» de «Tu enlace» y en las
  fichas de los demás médicos (`emitirEnlace(…, correo)`).
* **Tope del único: 5 intentos en la base** (`reserva_enlaces.intentos` y
  `agotado_en`, bajo el `FOR UPDATE` del enlace). «Bloqueado» lo agota en el
  acto. Agotado = 410 `enlace_no_disponible`, sin la causa. Lo que se compruebe
  DESPUÉS del contador no puede lanzar una excepción provocable por quien
  reserva: desharía el conteo. Por eso `client_id_en_uso` se comprueba antes y
  el INSERT de la cita va en su propio `BEGIN … EXCEPTION WHEN unique_violation`
  (`20261201140000`): no lo «simplifiques» quitando el bloque (el EXISTS no ve
  las transacciones sin confirmar; escenario 5 de `reserva-carrera.sh`).
* **`proteger_reserva_enlace_unico()`** guarda las columnas del único (correo
  inmutable; intentos sólo hacia arriba y sólo por `service_role`).
  `proteger_reserva_enlaces()` sigue intacto (md5 `acd4128b`, lo exige el
  post-vuelo de F3).
* **`reserva_enlace_emitir` tenía dos firmas:** la de 7 argumentos se conservaba
  por compatibilidad durante el despliegue (AG-DT-137) y se retiró en la fusión
  (el conjunto fundido trae siempre la de 9). La ruta usa la de 9 y,
  si falta (PGRST202) y el único va SIN correo, cae en la de 7; con correo, no
  emite. La lista reintenta sin `agotado_en` si la columna no existe (42703).
  No quites esa tolerancia mientras la migración de J2 no esté en producción
  (integración J, `7a1e831`); con el conjunto fundido la caída a la de 7 es rama
  muerta, y quitarla lo decide Angel.
* **«Ligar e iniciar consulta» es UNA ventana** (`VentanaLigarCita.tsx`, J3),
  siempre con `next/dynamic` desde sus tres sitios: la fila de «Próximas citas»
  del dashboard del médico, la acción `ligar` de la tarjeta y el aviso de la
  campana (`avisoSeLiga`). Liga por el PUT de siempre (`ligarCitaAPaciente`). No
  le añadas los campos del formulario (duración, tipo, observaciones): Angel la
  pidió sin ellos. El D7 del modal sigue vivo como segundo camino.
  `ProximasCitas` no conoce rutas clínicas: el botón lo inyecta el dashboard del
  médico por la prop `ligar`; la secretaria no la pasa.
* **El tipo de cita sólo PROPONE la duración.** Todo lo que muestra o calcula la
  duración de una cita existente usa `end_time`
  (`src/lib/tests/duracionRealCita.test.ts`).
* **Restablecer en Google lo que la base rechaza** (C5/I9, J4): un fallo
  PASAJERO de Google (red, 429, 5xx, 403 de cuota) detiene la página
  (`RestablecimientoPendiente`) y la pasada siguiente lo repite; cualquier otro
  fallo NO, o la clínica entera deja de sincronizar.
* **Aviso `google_movimiento_rechazado`:** uno por intento = (cita, `updated` del
  evento). Lo escribe `cita_movimiento_google_registrar` (sólo `service_role`,
  `20261201150000`); pulsarlo abre la tarjeta con «Reagendar» de principal
  (`destacar`). `leerAvisosClinica` pide sólo los tipos conocidos y salta fila a
  fila el que no conoce: así una migración que añade un tipo puede ir antes que
  su código. No vuelvas a validar la lista entera de una vez.
* **Con la v2, lo de Google no es morado:** `--ag-gcal-*` valen los de
  «Agendada» dentro de `.fc`; la «G» de las filas nacidas en Google es
  `.ag-g-origen`, visible sólo con la v2.
* **La configuración de la agenda** (`/agenda/configuracion`, v2, J5) es la de las
  maquetas `docs/spec/Main.dc.html` y `Configuracion.dc.html`: la primera vez
  (`PrimeraVez.tsx`) o cinco pestañas (`PestanasConfiguracion.tsx`), montados por
  `ConfiguracionAgenda.tsx`. La página vieja (`ConfiguracionCalendario.tsx`)
  sigue en disco sin montar (AG-DT-162).
* «Primera vez» se calcula de los datos (`esPrimeraVez`: sin duración propia o con
  TODOS sus consultorios por revisar). No reabras la primera vez por un enlace
  apagado o un consultorio nuevo: eso va en las pestañas.
* Las pestañas se guardan solas con las rutas de siempre; «Guardado» sólo tras la
  respuesta buena. No metas un botón «Guardar» ni guardes sin serializar (un
  `PUT` de ajustes en vuelo). El horario de la clínica se cambia sólo por
  `PUT /api/me/horario` (administrador, `audit_log`). «Empezar de nuevo» es
  `POST /api/agenda/restablecer`, el mismo diálogo de H.
* Los botones con borde de la configuración usan `--ag-control-border`; los que
  la maqueta pinta como texto siguen siendo texto.
* **Nunca arranques un servidor dentro del `flock`** de
  `e2e/resultados/reglas/e2e.lock`: el hijo hereda el descriptor y retiene el
  lock mientras vive (pasó dos veces en la tanda J). Arráncalo fuera del lock, o
  corre con `flock -o` lo que pueda arrancar uno (Playwright con las e2e de
  Google, que levantan `next dev` desde la prueba).
* **La semilla (`scripts/agenda-semilla.ts`) borra toda tabla nueva que cuelgue
  de `clinicas`** antes de borrar las clínicas Semilla. Con la FK RESTRICT (regla
  del proyecto), una fila olvidada aborta «borrar clínicas» y deja la base
  compartida sin datos para todos (pasó con `gcal_movimientos_rechazados`). Quien
  cree una tabla así la añade a la semilla en el mismo commit.

**Tanda K (2026-11-18, ramas K1-K5; 3 migraciones, el conjunto pasa a 45):**

* **El bloqueo de horario (K1) es la tabla `agenda_bloqueos`**, NO una fila de
  `appointments`.
  - En la reserva por enlace ocupa en `reservar_por_enlace` (bloque de solape,
    tras el candado 1790) y en `reserva_ocupacion`, y por ella en los turnos de
    la página. **Un evento de todo el día ya NO cierra el día en el enlace**; los
    de hora sí ocupan.
  - ~~En Spinus no impide agendar: pregunta «Este horario está bloqueado.
    ¿Agendar de todos modos?»~~ **Sustituido por el bloqueo total de L1**
    (abajo): ya no se pregunta en ningún camino.
* **Las funciones de la reserva van en cuerpos completos** (integración K): hoy
  en F3 (`20261201140000`), y `reagendar_por_enlace` y `cita_reagendar_oferta` en
  F4 (`20261201160000`). El orden es fijo, F5a → F3: F3 sin F5a aborta. Quien
  vuelva a pegar `reservar_por_enlace`, `reserva_ocupacion`, `reserva_contexto`,
  `reagendar_por_enlace`, `cita_reagendar_oferta` o `reserva_codigo_emitir`
  parte del cuerpo vigente y conserva el `OR EXISTS … agenda_bloqueos`, el `NOT
  a.all_day` y `pausado_en IS NULL`. Pre-vuelo por md5 de `prosrc`, como ellas.
* **Los bloqueos en el cliente** viajan en `GET /api/appointments` (campo
  `bloqueos`) y en la semilla de la página. Abrir la agenda no hace ninguna
  petición nueva.
  - En la rejilla son eventos `bloqueo:<id>`, con los datos ANIDADOS en
    `extendedProps.bloqueo`. Todo lector que cuente citas los quita con
    `esBloqueo`. **No pongas `medico_id` ni `status` sueltos en ese evento.**
  - En Google van como «Ocupado» con la marca privada `spinus_bloqueo`. La
    sincronización los aparta antes de `decidirEvento` y sólo los mueve o borra
    (`gcal_bloqueo_aplicar`, que nunca crea).
* **Confirmar desde el correo (K2)** lleva `?paso=confirmar`.
  `ConfirmarAlCargar.tsx` manda el MISMO POST del botón, una vez, y
  nunca con `navigator.webdriver`, durante el prerender ni en segundo plano. El
  GET y el HEAD **nunca** escriben. No lo «arregles» moviendo la escritura al
  GET. *(Desde L4 ya no lo manda al cargar: espera un gesto, ver abajo; cierra
  AG-DT-175.)*
* **El código va en el fragmento** (`#codigo=`, nunca en `?`). La página lo lee
  y lo borra con `replaceState`.
* **Los 30 s entre códigos son POR ENLACE** (`reserva_espera_reenvio`,
  `REENVIO_CODIGO_S`). Contarlos con la llave global del correo filtra actividad
  entre clínicas, y el 429 del tope global por correo **no** lleva plazo.
  `reserva_codigo_verificar` devuelve `reemplazado` para un código anterior del
  mismo enlace y correo, sin sumar. La reserva pública guarda en
  `sessionStorage` (`spinus.reserva.<enlace>`, 30 min) sin código; nada va a
  `localStorage`. *(Desde L4 guarda también el nombre y el teléfono ENVIADOS,
  ver abajo.)*
* **`clinicas.timezone` (K3) es sólo el huso «de fábrica»:** lo propone la
  configuración y lo preselecciona el alta de consultorios. NO lo leen la
  rejilla, la reserva ni los correos, que usan `consultorios.timezone`. Es
  columna nueva: contrato con `spinus-consola` intacto.
* **Un fijo pausado** (`reserva_enlaces.pausado_en`) es, hacia fuera, idéntico
  a uno revocado o inexistente. Toda función nueva que abra un enlace para el
  público mira `revocado_en IS NULL AND pausado_en IS NULL` (caso 6 de
  `k3_enlace_pausado.sql`). Apagar «Tu enlace» PAUSA; sólo «Cambiar por uno
  nuevo» y «Empezar de nuevo» revocan.
* **La leyenda de husos** (`leyendaHusos.ts`, K4) se calcula con lo que la
  agenda ya tiene (los consultorios de la página y la zona de `Intl`). Va en
  `AvisosAgenda`, nunca dentro de `<FullCalendar>` ni con petición propia.
  «Huso» = desfase con UTC, no el nombre de la zona. Usa la clase
  `.ag-banda-compacta` con `data-leyenda-husos`: un selector de la banda de
  «Vista compacta» lleva `:not([data-leyenda-husos])`.
* **La salida animada del modal de la cita es de la v2** (integración K): con la
  v2 apagada, `closeModal` lo desmonta al instante, como antes del proyecto
  (e2e `agenda-k-salida-modal`). Lo que mide «guardar» es la tarjeta pintada
  (~31 ms), no la salida del modal (AG-DT-146, cerrada). El pintado optimista
  con la v2 apagada **no es un cambio del proyecto**: `a58419f` ya pintaba la
  tarjeta antes de la respuesta (integración L, AG-DT-198 cerrada con los
  números). Sólo el cambio de título espera al servidor, como siempre.
* **Marcas de procedencia (K5, sólo v2).** «Por ligar» y «Por asignar» son un
  solo icono, el expediente tachado (`esPorLigar`). El eslabón depende de
  `reserva_canal` y es permanente. Las dibuja `MarcasCita.tsx`. Con la v2
  apagada, las píldoras de siempre.
* **La burbuja de la cita (K5) es `BurbujaCita.tsx`**, y sale de
  `burbujaDeTarjeta`, derivada de `disposicionDeTarjeta`. No metas reglas de
  acción en la burbuja: la regla sigue siendo `disposicionDeTarjeta`, la que
  refleja el servidor. «No es una cita» (sin signos) sólo va en el pie de la
  burbuja; el formulario, «Próximas citas» y la campana dicen «¿No es una
  cita?».

**Tanda L (2026-11-19, ramas L1-L5; 3 migraciones, el conjunto pasa a 48):**

* **El bloqueo es TOTAL (L1, `20261201170000`).** Con la v2, nada entra ni se
  mueve a un bloqueo de su médico: ni citas ni eventos sin paciente, tampoco con
  «Reagendar». Lo garantiza la base: el disparador
  `trg_appointments_horario_bloqueado` (`cita_proteger_bloqueo()`, INVOKER),
  BEFORE INSERT OR UPDATE OF `start_time`, `end_time`, `medico_id`; 42501 con
  HINT `agenda_horario_bloqueado`.
  - **Exentos:** lo que no mueve inicio, fin ni médico; Google (`service_role` +
    `spinus.via='google'`, que ponen las `gcal_*`); las altas por enlace
    (`reserva_canal`, que ya miran los bloqueos); `postgres` y `supabase_admin`.
  - **Quien escriba `appointments` con `service_role`** y no sea uno de esos
    caminos choca con el disparador.
  - **No le quites la lista de columnas ni el atajo «no se mueve»:** son lo que
    deja cerrar una cancelada dentro de un bloqueo («Eliminar cita») y editar
    notas o estado de lo que ya estaba dentro (`l_integracion_disparadores.sql`).
* **Las rutas dan 409 `horario_bloqueado` antes de escribir**
  (`bloqueoTotalServidor.ts`: POST y PUT de `/api/appointments` y
  `…/reagendar`), con el cliente de sesión y `clinica_id` explícito, y traducen
  el 42501 por su HINT. **No lo traduzcas sólo por el código:** otro 42501 (la
  RLS) sigue siendo 500.
* **El texto del bloqueo es uno,** `TEXTO_HORARIO_BLOQUEADO`. **No vuelve
  ninguna pregunta «¿… de todos modos?» por un bloqueo**; la del empalme
  («¿Guardar/Reagendar de todos modos?») es otra cosa y se queda.
* **Un bloqueo se crea sólo con el candado junto a la campana** (desde B13, fuera de la computadora, con «Bloquear horario» de «Opciones de la agenda»: el MISMO `abrirBloqueoDesdeBarra`)
  (`BotonBloquearHorario`), y **se edita con cualquier clic en la franja**,
  decidido por el instante del gesto (`bloqueoEnInstante`), no por el DOM. El
  candado viaja en el chunk de la barra v2 (`MenuEngraneAgenda` lo reexporta):
  **no lo importes en estático** desde `AgendaCliente`, bajaría con la v2
  apagada (regla de J1; lo cuenta `agenda-j1-engrane`).
* **Una cancelada se «elimina» CERRÁNDOLA, nunca borrándola** (L2,
  `20261201170000`). `POST /api/appointments/[id]/quitar` pone `cerrada_en` sin
  sustituta, con `createAdminClient()` filtrado por `clinica_id`, y audita
  `cita_quitada_de_agenda`. Cerrada CON sustituta = se reasignó o se le dio otra
  cita; SIN sustituta = «Eliminar cita». Las dos se ocultan igual
  (`consultaCitas`, el tiempo real, el buscador) y ninguna se reabre desde la
  app; sólo `postgres`, en SQL. No uses `DELETE` para esto:
  `cita_proteger_borrado` lo veta con la v2 y debe seguir así.
* **Lo que pregunta antes de hacerse en la burbuja** es `pideConfirmacion`:
  «Cancelar cita», «Eliminar evento», «No asistió» y «Eliminar cita». Una acción
  destructiva nueva va ahí, con su texto en `textoDeConfirmacion`.
* ~~**La leyenda tiene dos puertas en computadora:** el botón (i) de la barra y el
  engrane.~~ **Desde B13 (§28) tiene UNA: «Leyenda de estados» de «Opciones de la
  agenda»** (`CapaLeyenda`), en todos los formatos; el botón de la barra se retiró. No
  dupliques la leyenda.
* ~~**La letra de la burbuja de la cita y de la configuración va en la escala de
  la página de reserva** (`agendaPublica.css`), no en la de las maquetas, y sin
  tokens nuevos.~~ **Sustituido en B13:** la burbuja va en la escala de la maqueta
  `ag-burbuja` y la configuración en la del kit, leída de `sistema.css` (12, 13, 14, 15,
  16, 17, 20, 26, 32); `/reservar` no cambia. Lo que sigue de esta línea es historia: `configuracionEscala.test.ts` falla si un archivo de
  `/agenda/configuracion` usa otro tamaño; `agenda-l2` mide la burbuja (la
  píldora del estado, 600; la ayuda, 13,5 px). Si cambia la escala de la reserva,
  cambian las dos.
* **«Solo el administrador de la clínica puede cambiar estas opciones.»**
  (`SOLO_ADMIN`, `data-solo-admin`) va sólo donde la ruta deja cambiar al
  administrador y a nadie más (`canManageClinica`). No la pongas en los tipos de
  cita ni en el horario de un consultorio: ahí no es cierta. *(Desde M2 el texto
  es «Solo el médico administrador…» y va por rol. A la secretaria, en
  «Cuándo dan consulta» y «Tipos de cita», van textos propios por decisión de
  Angel: AG-DT-235, cerrado. Ver «Tanda M».)*
* **`/confirmar/[codigo]` con «Confirmo mi asistencia» no confirma al cargar**
  (L4): espera un gesto de confianza fuera de un control
  (`esGestoParaConfirmar`: un `click`, o Enter o una tecla que escribe, en lista
  blanca). No lo cambies a `pointerdown` (desplazar confirmaría) ni a una lista
  negra de teclas.
* **La reserva pública guarda en `sessionStorage` el nombre y el teléfono
  ENVIADOS** (30 min, por pestaña, traspaso por `BroadcastChannel`). El código,
  nunca. **Lo restaurado vuelve al formulario, no reserva solo:** el aviso se
  marca en la pestaña que reserva. No lo hagas reservar solo: dejaría colar por
  el canal los datos de otra persona (AG-DT-220).
* **`sentryPiiFilter.redactString` redacta `#codigo=NNNNNN`.** No quites la
  línea: el fragmento de «Continuar mi reserva» lleva el código.
* **Sólo `correoConfirmacion` saluda** («Hola, <nombre>:», escapado). El
  recordatorio y el aviso de cambio comparten cuerpo y no saludan.
* **Aviso `confirmacion_paciente` (L5, `20261201160000`):** lo escribe el
  disparador `trg_cita_confirmaciones_aviso_confirmacion` sobre
  `cita_confirmaciones` (UPDATE OF `respuesta`, `respondido_en`), o sea sólo
  cuando confirma el paciente por su enlace; el personal y Google no escriben
  esa tabla. Emergente SIN nombre; en la lista, con nombre. **NO lo muevas a
  `appointments`:** ahí no se distingue quién confirmó.
* **La campana recarga en vivo cuando una cita pasa a «confirmada» SÓLO si antes
  no lo estaba** (lista de mañana o estado pintado, `pintado` en `CambioCita`).
  Recargar por toda confirmada sería una petición por cada eco de Google.
* **La burbuja de la campana = «Por confirmar · n» + «Avisos · m»** (los números
  de las pestañas), «9+» con más de 9, y el número exacto en el nombre del
  botón. `[data-punto-rojo]` sigue siendo su selector.
* **La lista del caso 3 de `p1_permisos_funciones.sql` sigue en 50:**
  `cita_proteger_bloqueo()` y `aviso_clinica_de_confirmacion()` se conceden a
  los tres roles y NO entran.
* ~~**No vuelvas a correr J4 (`20261122140000`) después de L5:** su pre-vuelo
  admite 5 o 6 tipos de aviso y ahora hay 7 (aborta limpio, AG-DT-229).~~ Sin
  objeto desde la fusión: J4 y L5 están en F4 (`20261201160000`), cuyo CHECK
  nace con los 7 tipos.

**Tanda M (2026-11-19, ramas M1-M5; la integración añade dos migraciones):**

* **`audit_log` no se borra NUNCA, tampoco en local ni en pruebas** (orden de
  Angel, literal: «No vuelvas a borrar filas de audit_log, tampoco en local ni
  de pruebas»). Ni DELETE, ni TRUNCATE, ni `session_replication_role = replica`
  para saltarse `prevent_audit_delete`, en una base viva. *(Aclaración de Angel
  del 2026-11-19, vía el coordinador de M: «`supabase db reset --local` crea
  una base de pruebas nueva; no es borrar auditoría». Durante la tanda el
  sistema de permisos de la sesión lo denegó, pero el reinicio desde cero SÍ
  se hizo en el cierre de M (2026-11-19: el primer intento dio
  `LegacyDbSetupError` y el segundo, con `--debug`, salió bien) y otra vez el
  2026-11-21 en el equipo nuevo, a la primera: 50 migraciones, la última
  `20261125180000`. AG-DT-255; `GUIA_PRUEBAS_AGENDA_V2.md`, P5.)*
  Para contar auditoría, filtra por tus ids o por `created_at >=` una marca
  (`clock_timestamp()` antes de la acción), nunca por una ventana de minutos.
  Lo vigila `src/lib/tests/pruebasSinBorrarAuditoria.test.ts`; su única
  excepción es `m_audit_log_sin_truncate.sql`, que INTENTA el TRUNCATE para
  ver que falla, dentro de subbloques deshechos y con `rollback`.
* **`20261125170000_audit_log_sin_truncate.sql`:** `anon`, `authenticated` y
  `service_role` ya no tienen TRUNCATE sobre `audit_log`, y
  `prevent_audit_truncate` (de sentencia, con `prevent_audit_modification()`)
  para al dueño. No le devuelvas el privilegio. Las otras 30 tablas de `public`
  con TRUNCATE siguen igual a propósito (AG-DT-253).
* **La burbuja de la cita tiene dos tamaños,** según el ancho:
  - computadora (`.ag-capa.ag-burbuja`, desde `ANCHO_MOVIL` = 1024 px):
    ~~las medidas de la tarjeta de J. Son 360 de ancho, letra de 16/15/13/12 y
    acciones de 13 px y 48 de alto~~ desde B13 (AG5), las de la maqueta
    `ag-burbuja` (nombre 20/700, acciones como filas de menú de 48 · 40 en
    `ih`/`esc`), con el icono a la izquierda;
  - teléfono y tableta (`.ag-hoja.ag-burbuja`): la escala de L2, con toques de
    44 px.

  Toda regla nueva de computadora va acotada a `.ag-capa.ag-burbuja`.
  `agenda-m1-burbuja.e2e.ts` mide la de computadora y `agenda-l2` la del
  teléfono.
* **Los tres puntos (desde B13, §29.5, el LÁPIZ; mismo `aria-label`) de la burbuja abren el formulario completo
  (`alAccion('editar')`) y no tienen menú** (M1, punto 4). Lo que quede fuera de
  la burbuja va al formulario: no se crea otro panel. Las observaciones son una
  línea recortada, con el texto en `title`.
* **«No asistió» de la agendada se hace en el formulario y no pregunta.** El de
  la confirmada es casilla y pregunta (`pideConfirmacion`).
* **La configuración de la agenda tiene DOS escalas** ~~teléfono (base) y
  computadora (`sm:`, desde 640). En computadora: h1 18, títulos de sección 16,
  texto 13–14, controles 13 px y 40 de alto, rellenos ≥ 14 × 5/6.~~ **por FORMATO
  desde B13 (AG9):** táctil (`ext`/`tel`/`iv`) 44 y computadora (`ih`/`esc`) 36
  (campos 40), letra de la escala del kit, sin `sm:`/`md:` en tamaños. Todo cambio de
  tamaño ahí va en las dos y lo vigila `src/lib/tests/configuracionEscala.test.ts`.
* **El aviso de quien no administra es `SOLO_ADMIN` + `AVISO_SOLO_ADMIN`** de
  `estilosConfig.ts` («Solo el médico administrador puede cambiar estas
  opciones.»): una vez por pestaña, nunca encima de algo que ese rol sí puede
  hacer (en «Más opciones» la secretaria desbloquea personas). Sustituye a la
  frase de la tanda L. **Excepción, decisión de Angel:** a la secretaria,
  «Cuándo dan consulta» lleva `SOLO_ADMIN_HORARIO` («Cada médico cambia el
  horario de sus consultorios.») y «Tipos de cita», `SOLO_ADMIN_TIPOS` («Cada
  médico cambia sus tipos de cita.»).
* **La barra v2 son dos ítems de rejilla** (`.ag-controles-nav` /
  `.ag-controles-acciones`): una fila desde 1360 px («+» hasta 1439), dos filas
  limpias de 1024 a 1359. El filtro mide el nombre elegido (`.ag-filtro-medida`)
  y no encoge. Una sola fila de 1024 a 1359 no cabe, y Angel decidió dejarlo
  así (AG-DT-242): no la fuerces.
* **«Bloqueo» vuelve como tercera posición de «Nueva cita»** (M3, sólo v2): abre
  el MISMO modal del candado (`abrirAltaBloqueo`) con la hora del formulario. No
  vuelve la pregunta de K1.
* **El rayado de un bloqueo se pinta sólo en horario** (`tramosDelRayado`, la
  misma `businessHours` que el gris), pero la franja de FullCalendar sigue
  cubriéndolo entero (el clic se decide por el instante). Las horas llegan por
  `fijarRayadoBloqueos`, nunca por `eventContent`.
* **«Tu correo ya está verificado» no es un error** (M4, punto 7): viaja por el
  estado `error` de `useReserva`, pero `NotaDelPaso` lo pinta verde
  (`rp-nota--ok`) y con `role="status"`. Si cambias su texto, cámbialo en
  `YA_VERIFICADO`, que es lo que lo distingue. Los errores, en rojo y
  `role="alert"`.
* **«Salir» del comprobante** (M4, punto 8): `olvidar` + `window.close()`; si a
  los 300 ms `window.closed` sigue en falso, «Ya puedes cerrar esta pestaña». No
  lo publiques por el `BroadcastChannel`.
* **Las pruebas de Vitest no dependen de la zona del proceso.** Una fecha que la
  app lee en la hora del dispositivo (los avisos con la v2 apagada, los sellos
  de los PDF) se escribe en la prueba como hora de pared
  (`new Date(a, m, d, h, min)`), no como instante UTC fijo. Antes de dar por
  buena la batería, córrela sin `TZ`, con `TZ=UTC` y con
  `TZ=America/Hermosillo`. El sello del consentimiento en la zona del equipo es
  un defecto de la app, **prioridad alta** (AG-DT-243): «el sello va en la zona
  del consultorio donde se firmó. Se corrige en su propia rama» (Angel). Su
  prueba falla en Tokio y Kiritimati y se queda así.
* **Correos de la agenda (M5):** todos salen de `src/lib/correo/plantillaCita.ts`,
  el esqueleto de las tres maquetas de `docs/spec/correo-*.html`.
  - Tablas, estilos en línea, siempre en claro y todo escapado ahí.
  - Los colores son hex de los tokens de la app, no de la maqueta: el acento es
    `--cs` #1e5fa8 y la cabecera `--ag-navy` #163250. No cambies un hex sin su
    token.
  - Una fila o frase sin su dato desaparece entera.
  - «hora de …» sale de `HORA_DE_ZONA`; cada zona nueva de `ZONAS_MEXICO`
    necesita su frase (lo exige una prueba).
  - El plazo de cancelar de los correos (`PLAZO_CANCELAR`, 1 hora) refleja la
    regla fija de E1: si cambia una, cambia la otra (AG-DT-249; Angel decidió
    dejarlo fijo).
  - Todos saludan con `saludoDe(nombre)`: «Hola, <nombre>:» y «Hola:» sólo sin
    nombre. La confirmación, el recordatorio y el cambio toman el nombre del
    paciente ligado y, si no, `reserva_nombre`; el comprobante, el tecleado. El
    recordatorio lo lee con `cita_nombre_saludo` (RPC sólo `service_role`; la
    tarea nunca usa `.from()`), y si falla sale «Hola:» sin frenar el envío.
  - El pie va en `--ag-ink-600` #52627a (5,47:1 sobre #eef1f5): no lo bajes a
    `--ag-muted`, que da 3,09:1 (lo vigila `plantillaCita.test.ts`).

**B13 — rediseño de la agenda (2026-11-24; sólo presentación, con la v2 ENCENDIDA; apagada, la agenda de
siempre).** Registro: `docs/spec/rediseno/IMPLEMENTACION-REGISTRO.md` («B13 · AG0» a «B13 · cierre») y
`docs/spec/rediseno/b13/`. Lo que un editor futuro no debe romper:

* **Cuatro vistas en todos los formatos** (Mes, Semana, 3 días, Día; `VIEWS_V2`, `vistaDelFormato`): Día y
  «3 días» son SIEMPRE rejilla, también en el teléfono; sólo la Semana del teléfono (`ext`/`tel`) es lista. El
  formato sale de la sonda (`leerFormato`), no de `innerWidth`.
* **La barra por formato (PIEZAS §4):** en computadora, la de M3 (dos ítems de rejilla, reglas de arriba). Fuera
  de ella `BandaMovil` pinta, con la v2, la barra de la maqueta (`[data-barra-v2]`, sin navy ni «Abrir menú»: el
  encabezado de la app vuelve en `tel`/`iv`); un solo DOM repartido por `grid-template-areas` según
  `data-formato` (bloque «B13 · CIERRE · LA BARRA POR FORMATO» de `globals.css`). El periodo es el botón «Ir a
  una fecha» (`SelectorFechaV2 enBanda`). Médico, candado y, en `ext`/`tel`, la lupa son opciones de «Opciones
  de la agenda» (`OpcionesDeBanda` de `MenuEngraneAgenda`); la opción de la lupa pulsa el MISMO botón oculto
  que la tecla `/`. «Huecos disponibles» (`ih`/`iv`, Día, un médico) abre la tarjeta del panel (`CardHuecos`)
  en su capa. «Agendar»: píldora flotante en `ext`/`tel` (lo que se desplaza lleva 72 px de más abajo para que
  nada quede bajo ella), primario arriba a la derecha en `ih`/`iv`. No metas otro control en la barra sin
  pasarlo por la maqueta: lo que no cabe va al menú.
* **Las capas viven en `body`:** sólo leen tokens del kit (`--sup`, `--tinta*`, `--cal-*`…); los `--ag-*`
  re-apuntados de la raíz v2 no llegan. Nada por debajo de 12 px.
* **Toda confirmación de la v2 es la alerta del catálogo con su VERBO** (`ConfirmModal` con `verbo`; §29.3–§29.4):
  «Cancelar cita»/«Volver», «Eliminar…», «Guardar», «Mover», «Agendar», y en la configuración «Apagar» y «Cambiar»
  (`alertaDeEnlace`). «Aceptar» queda sólo con la v2 apagada.
* **Textos unificados (§28):** «Agendada desde Google Calendar», «Reservó por enlace», «Ligar paciente e iniciar
  consulta», «¿No es una cita?». No reintroduzcas las variantes viejas.

**Pruebas de navegador (2026-11-22, equipo nuevo; AG-DT-256):**

* **Ninguna e2e depende del día ni de la hora en que se corre.** Una cita con
  paciente o por ligar, agendada o confirmada, dispara «¿Asistió el paciente?»
  en cuanto su inicio tiene más de 48 h, y la ventana tapa la rejilla a todo lo
  que corre después. En el miércoles de la semana visible eso pasa de viernes a
  domingo.
  - Toda cita con paciente o por ligar que cree una prueba va en la **semana
    siguiente**: `DIA_FUTURO_FIJO` / `DIA_FUTURO_LIBRE`, y la agenda se abre con
    `irAAgendaSiguiente` o `pasarASemanaSiguiente` (`e2e/ayudas.ts`). Los
    eventos sin paciente pueden seguir en la semana visible.
  - Si la prueba necesita una cita pasada, que sea la de ayer (menos de 48 h),
    no una de semanas atrás.
  - **No se pulsa «Decidir después» para quitar la ventana de en medio:** tapa
    el síntoma. Sólo la abren las pruebas que la prueban a propósito.
  - Nada de `now() + N h` ni del día de la semana leído al correr para decidir
    qué semana mirar: la fecha se calcula una vez y con ella se siembra y se
    navega.
* **Lo vigila `e2e/guardaAsistencia.ts`** (reporter de `playwright.config.ts`,
  sólo lee): aplica la regla de la ventana con el reloj en el final del domingo,
  al empezar, durante cada prueba y al terminar cada una; lo que una prueba deje
  pone la corrida en rojo y la nombra. No la quites del config ni le añadas
  excepciones: la única es la anotación `asistencia-a-proposito`, que perdona lo
  que ya no dispara la ventana cuando la prueba termina.
* **Se espera lo que se quiere probar, no «lo primero que salga»:** la petición
  o la respuesta de un rango concreto (`esUnaDeEstasVentanas`), y el diálogo
  abierto antes de pulsar una tecla. Las precargas de las semanas vecinas son
  peticiones legítimas que llegan cuando quieren.
* **No edites archivos del repo mientras corre la batería:** las e2e de Google
  levantan un `next dev` que recompila y puede contestar 500.
* Queda una falla conocida, `agenda-empalme` «redimensionar hasta otra cita
  también avisa» (AG-DT-257): es la prueba, no la app. No se salta ni se
  desactiva.

---

## 🪫 Deuda técnica conocida

Lista de bugs/limitaciones aceptadas conscientemente. No corregir sin plan explícito — cada ítem tiene contexto que justifica dejarlo.

1. ~~**`regenerarYSubirPdf` muta `doc.pdf_url` local sin re-render.**~~ ✅ **Resuelto** (rediseño del expediente, 2026-09-09). El defecto vivía en `ModalDocumentos.tsx:345` (`doc.pdf_url = storagePath`, marcado allí como bug conocido) y **no migró**: se cerró al reescribir ese camino. Su sustituto, `regenerar()` en `src/components/expediente/PanelDocumentos.tsx:163-168`, escribe `pdf_url` en la base y llama a `onRecargarDocumentos()` —cableado a `cargarActividad()` en `expediente/[id]/page.tsx:360`—, así que la url nueva **llega por props desde un refetch** en vez de mutarse por referencia, y el botón de descarga reaparece solo. `ModalDocumentos.tsx` se borró al quedar sin consumidores.
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
- PDF y visor consumen JSON ProseMirror cuando
  `doc.schema === 'tiptap-doc-v1'`. El correo ya no compone el escrito:
  adjunta el PDF (`generarHtmlEmail` se eliminó; ver
  `src/app/api/email/enviar-documento/route.ts`)
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

### QW3 — Restringir endpoint ARCO a super_admin y al médico administrador de la clínica

**Archivo afectado:** `src/app/api/paciente/[id]/exportar/route.ts`

**Problema:** El endpoint `POST /api/paciente/[id]/exportar` devuelve JSON completo con todos los datos del paciente (consultas, mediciones, documentos, addendums, datos personales) para cumplimiento ARCO (derechos ARCO bajo la LFPDPPP vigente de 2025 — el "Art. 28" que citaba esta línea es de la ley abrogada de 2010; verificar el artículo correcto antes de citarlo en cualquier texto de cara al usuario). Actualmente requiere sesión autenticada pero NO valida el role del usuario. Cualquier médico autenticado puede invocarlo vía fetch/curl.

**Origen:** Endpoint creado en sesión anterior como preparación para cumplimiento legal ARCO. Nunca se integró a UI de super-admin.

**Fix planeado:**
1. Agregar validación post-auth: `role = 'super_admin'`, o `role = 'medico'` con `es_admin_de_clinica = true` (médico administrador de la clínica; el rol `admin` no existe: los roles son `super_admin`, `medico` y `secretaria`, `profiles_role_check`)
2. Si role no cumple → responder `403 Forbidden`
3. Registrar intentos denegados en `audit_log` con `accion='arco_intento_denegado'`
4. Mantener el registro de accesos exitosos con `accion='arco_acceso'` (ya existe)

**Cuándo atacar:** Después del rediseño de labs (post sub-fase 8C y 9). Prioridad alta (riesgo de fuga de datos cross-usuario dentro de misma clínica, aunque endpoint esté dormido).

**Alcance estimado:** 1 archivo, ~15 líneas, 20 min.

**Decisiones ya tomadas:**
- Quién puede: `super_admin` + el médico administrador de la clínica (`role = 'medico'` con `es_admin_de_clinica`; puede ejecutar ARCO para pacientes de su clínica; super_admin global puede para cualquier clínica).
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

### SES-01 — vida explícita de 60 días para las cookies de sesión

**Archivos afectados:** los TRES escritores de cookies del proyecto —
`src/lib/supabase/client.ts` (`setAll`), `src/lib/supabase/server.ts:13-19` y
`src/middleware.ts:59-65`.

**⚠️ EL NÚMERO YA ESTÁ DECIDIDO: 60 DÍAS.** Lo eligió Angel el 2026-09-16. No lo
vuelvas a preguntar. Sustituye a los 400 días que hoy vienen del default de
`@supabase/ssr` (`dist/main/utils/constants.js:10`).

> ### ⚠️⚠️ `cookieOptions.maxAge` NO SIRVE. NO EMPIECES POR AHÍ.
>
> Es el sitio evidente y **no funciona en ssr 0.9.0**: el adaptador fusiona tu
> `cookieOptions` sobre sus defaults y ACTO SEGUIDO reescribe `maxAge` con el
> suyo. Las dos ramas, cliente y servidor:
>
> ```js
> const setCookieOptions = {
>   ...DEFAULT_COOKIE_OPTIONS,
>   ...cookieOptions,                      // tu 60 entra aquí…
>   maxAge: DEFAULT_COOKIE_OPTIONS.maxAge, // …y muere aquí
> }
> ```
>
> `cookies.js:168-172` (navegador) y `cookies.js:327-331` (servidor).
> Comprobado ejecutando el adaptador real con `cookieOptions: { maxAge:
> 5184000 }`: lo que llega a `setAll` es `maxAge=34560000`, o sea los 400 días.
> Si alguien «lo arregla» ahí, el número no cambia y parecerá que sí.

**Dónde va entonces:** en el `setAll` de cada uno de los tres escritores,
sobrescribiendo el `maxAge` recibido **sólo cuando es positivo**:

```ts
const VIDA_SESION_SEG = 60 * 60 * 24 * 60  // 60 días
// dentro de setAll, antes de escribir:
const vida = typeof options?.maxAge === 'number' && options.maxAge > 0
  ? { ...options, maxAge: VIDA_SESION_SEG }
  : options
```

> ### ⚠️ LA CONDICIÓN `> 0` ES TODO EL ÍTEM, NO UN DETALLE
>
> `maxAge: 0` es cómo el adaptador de ssr pide BORRAR la cookie
> (`cookies.js:193-210`, y RFC 6265 §5.2.2: un `Max-Age` ≤ 0 caduca la cookie).
> Un `maxAge: VIDA_SESION_SEG` sin condicionar convierte cada borrado en una
> renovación de 60 días y **reintroduce exactamente el defecto de seguridad que
> se cerró el 2026-09-16**: cookies de sesión que no mueren al cerrar sesión, con
> el JWT y el refresh token dentro. Si tocas esto, comprueba el borrado, no sólo
> el alta.

**Por qué 400 no servía:** no era una decisión, era el default de la librería.
Una cookie con el refresh token dentro viviendo 400 días en un equipo compartido
de consultorio es exposición que no compra nada. Y **sólo empezó a aplicarse de
verdad** cuando el adaptador del navegador dejó de descartar las `options`
(2026-09-16): antes el cliente escribía cookies de sesión y el servidor de 400
días, así que la misma cookie cambiaba de naturaleza según quién la hubiera
escrito último.

**Lo que este ítem NO es:** no es la barrera de revocación. La vida de la cookie
no crea sesiones zombis —las crea no borrar y no revocar, ya cerrado— y bajar
este número no acorta la ventana en la que un JWT revocado sigue siendo válido
contra PostgREST. Esa ventana es el TTL del JWT, que se toca en el panel de
Supabase y tiene su propio coste en tráfico a Auth. **No mezcles las dos cosas.**

**Origen:** punto 5 de la auditoría del cierre de sesión del 2026-09-16. Sus
puntos 1 y 2 (borrado real de cookies y limpieza local incondicional) ya están
aplicados; los 3 y 4 siguen pendientes y son independientes de este ítem.

**Alcance estimado:** 3 archivos, ~6 líneas, 20 min. **Verificación:** la columna
`Expires` de `sb-*-auth-token` debe quedar a ~60 días y no a 2027 — y al cerrar
sesión no debe quedar NI UNA cookie `sb-*`, ni vacía.

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