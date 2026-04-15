# RESUMEN ARQUITECTURA — CHECKPOINT 2026-04-15

## Estado Pre-Migración

---

### PILAR 1 — Auth (CRÍTICO)

**Estado actual:** Acoplado al SDK de Supabase
- `SessionGuard.tsx`依赖 `supabase.auth.getSession()` — intenta refresh silencioso al expirar
- Fallback actual: `hasRawSupabaseToken` — búsqueda manual de tokens `sb-*` en localStorage
- `MirrorInitializer.tsx` suscribe a `onAuthStateChange(SIGNED_OUT)` — solo llama `stopMirrorEngine()`, NO `clearMirror()`
- `client.ts`: `offlineAwareFetch` rechaza temprano cuando `navigator.onLine === false`

**Riesgo identificado:** getSession() retorna `{ session: null }` offline tras ~1h, expirando el access_token y forzando logout fantasma

---

### PILAR 2 — Service Worker (MEDIO)

**Estado actual:** Modelo de prefijos + glob parcial
- `CRITICAL_CHUNK_PREFIXES`: 21 prefijos hardcodeados (rutas específicas)
- `readCriticalChunks()`: escanea recursivamente `.next/static/chunks/` y `.next/static/css/`
- `PRECACHE_HTML`: 17 rutas fijas incluyendo `/offline` y templates `/expediente/_/*`
- Synthetic stub: retorna JS que lanza `CustomEvent('spinus:chunk-missing')` + `throw Error`
- Guard `res.redirected`: rechazaba redirects en install (aplicado a TODO, demasiado agresivo post-fix)

**Riesgo identificado:** Shared chunks numerados de webpack pueden no estar en prefijos. Manifest.json no en precache.

---

### PILAR 3 — Read Mirror (SÓLIDO en diseño, FRÁGIL en lifecycle)

**Estado actual:**
- DB: `spinus_readmirror` v2 con 6 stores: `pacientes`, `consultas`, `documentos`, `appointments`, `laboratorios`, `_meta`
- Sync: `syncStoreInternal()` con fallback fields por store (`updated_at` → `start_time` → `fecha_toma`)
- Lifecycle: `startMirrorEngine(userId)` valida `mirrorUserId` en `_meta` antes de sync
- `clearMirror()`: borra los 5 stores de datos, preserva `_meta.version`
- LRU + daily sweep + storage pressure check (85% quota → caps reducidos a la mitad)
- Warmup: pacientes con cita próxima en ventana 48h — exentos de evict

**Riesgo identificado:** Dependencia de señales de auth (mirrorUserId) que pueden ser falsas offline.

---

### PILAR 4 — Data Fetching (MIGRACIÓN PARCIAL)

**Migrado a useHybridQuery:**
- `/pacientes` ✅
- `/expediente/[id]` ✅ (paciente, consultas, documentos, labs)

**NO migrado (23+ ubicaciones con supabase.from() directo):**
- `SecretariaDashboard`, `AsistenteDashboard`
- `/expediente/[id]/nueva-nota`
- `/expediente/[id]/editar`
- `/expediente/[id]/documentos`
- `/expediente/[id]/laboratorios/nuevo`
- `/expediente/[id]/laboratorios/[labId]`
- `/expediente/[id]/consulta/[consultaId]`
- `/billing`
- Formularios de documentos (RecetaForm, SolicitudLabForm, etc.)

**Riesgo identificado:** Cada ruta no migrada es landmine offline.

---

### PILAR 5 — Outbox (ZONA VERDE — FUNCIONAL)

**Estado: SÓLIDO. No modificar sin justificación explícita.**

- `outbox-engine.ts` (907 líneas): motor unificado con clientId UUID v4 para idempotencia
- Actions: INSERT, UPDATE, DELETE
- Resources: patient, note, document, appointment, audit_event
- Clasificación HTTP: 4xx → DLQ, 5xx → backoff exponencial (1s→60s, max 5 retries)
- Remapping tempId→realId post-sync de pacientes offline
- Migración automática idempotente desde queues legacy
- Priorización: patients → updateRefs → notes+documents (paralelo)
- Dependencias: `secureStorage`, `fetchWithRetry`, `connectionMonitor`

**Cualquier cambio a este pilar requiere justificación explícita antes de ejecución.**

---

### PILAR 6 — Navegación / App Shell (MEDIO)

**Estado actual:**
- `proxy.ts`: middleware route handler, autentica requests, excluye `/sw.js`, `/manifest.json`
- `(app)/layout.tsx`: Server Component anidando SessionGuard, OfflineSync, MirrorInitializer, ChunkMissingListener
- `resolveTemplateUrl()`: mapea rutas dinámicas a templates hardcodeados

**Riesgo identificado:** Server Component requiere server round-trip. Offline todo hidrata en client.

---

### PILAR 7 — Manejo de Errores (MEDIO)

**Estado actual:**
- SW fallback chain: network → cache → template → `/offline`
- Synthetic JS stub: lanza CustomEvent + throw — NO capturable por ErrorBoundary
- `ChunkMissingListener`: escucha evento post-fallo — llega tarde si falla en layout inicial
- `offlineAwareFetch`: rechaza fetches que SDK esperaba — puede causar SIGNED_OUT incorrecto

**Riesgo identificado:** Synthetic stub rompe runtime de webpack irremediablemente para esa página.

---

## 4 GRIETAS ARQUITECTÓNICAS IDENTIFICADAS

### GRIETA 1 — "Confianza Ciega" en Auth
- **Problema:** Validar JWT por `exp` no detecta revocación server-side
- **Solución:** Protocolo Grace Period con estados FRESH → RED_VERIFIED → GRACE_EXPIRED → RED_INVALID
- **Grace period:** 15 minutos sin red antes de forzar re-check

### GRIETA 2 — "Efecto Engorde" del SW
- **Problema:** Precachar TODO `.next/static/` satura conexiones lentas
- **Solución:** TIER1 (crítico, inmediata) → TIER2 (importante, background post-install) → TIER3 (bajo demanda)

### GRIETA 3 — Invarianza en Migración
- **Problema:** Schema mismatch entre datos locales (IndexedDB) y remotos (Supabase) rompe UI
- **Solución:** Framework de verificación por ruta: schema compare → value snapshot → render smoke test
- **Compromiso:** Ninguna ruta migrada se considera finalizada sin pasar test de invarianza

### GRIETA 4 — Cuota de Almacenamiento
- **Problema:** iOS/Android borran caché silenciosamente si almacenamiento global lleno
- **Solución:** `navigator.storage.persist()` + estimate monitor + alerta 80%/95% + graceful degradation

---

## PLAN DE IMPLEMENTACIÓN

### SEMANA 1 — Auth Robusto + Persistencia
1. AuthContext con JWT validation local + Grace Period
2. Persistence request + Storage estimate monitor
3. Mutex Auth/Mirror (coordinator)
4. Storage warning UI

### SEMANA 2 — Migración TIER 1
5. Dashboard + invariance test
6. Expediente page + invariance test
7. Pacientes page + invariance test

### SEMANA 3 — Migración TIER 2 + SW
8. Expediente sub-rutas + invariance
9. TIER1/2/3 precache strategy
10. Billing + invariance

### SEMANA 4 — TIER 3 + UX + Testing
11. TIER 3 bajo demanda
12. SyncStatusBar (outbox pending count)
13. /offline page mejorada
14. Testeo offline completo por ruta

---

## REFERENCIAS DE CÓDIGO

| Archivo | Líneas | Relevancia |
|---------|--------|------------|
| `src/lib/read-mirror.ts` | 1197 | Pilar 3 — Mirror |
| `src/lib/outbox-engine.ts` | 907 | Pilar 5 — Outbox |
| `src/lib/supabase/client.ts` | 67 | Pilar 1 — Auth SDK |
| `src/components/SessionGuard.tsx` | 149 | Pilar 1 — Auth client |
| `src/components/MirrorInitializer.tsx` | 93 | Pilar 1/3 — Lifecycle |
| `src/hooks/useHybridQuery.ts` | 313 | Pilar 4 — Hybrid fetch |
| `src/app/sw.js/route.ts` | 422 | Pilar 2 — Service Worker |
| `src/lib/connectionMonitor.ts` | 158 | Pilar 6/7 — Network |

---

*Checkpoint generado: 2026-04-15*
*Auditoría base: 2026-04-12*
