# Billing — Análisis de problemas + Plan de mejora

> **Modo:** READ-ONLY. Documento de análisis. No se aplicó ningún cambio de código.
> **Fecha:** 2026-07-06 · **Método:** 4 subagentes expertos en paralelo (Stripe/webhook, PostgreSQL/RLS, arquitectura Next.js, control de acceso) + verificación directa de los archivos núcleo.
> **Alcance:** el billing YA funciona en producción con pagos reales. Esto NO propone reingeniería; corrige los problemas detectados respetando lo que funciona.

---

## 🔑 Hallazgo transversal que recalibra todo (verificado directamente)

**La premisa "las RLS de bloqueo están muertas" (heredada de CLAUDE.md §2026-05-04) está OBSOLETA.**

Lo que se revirtió el 2026-05-04 fue la implementación *recursiva* de Phase 8.1 (`count(pacientes)>5` auto-referencial). Pero el refactor **etapa5** (aplicado a prod 2026-05-30/31) **recreó la barrera RLS de forma declarativa**, usando exactamente el "fix correcto pendiente" que CLAUDE.md describía (la columna latch `ha_tenido_acceso_premium`). Verificado:

- Helper `clinica_tiene_acceso()` (GATE 2) — `supabase/migrations/20260522_etapa5c_helpers_rls.sql:142-157`
- Aplicado en policies RESTRICTIVE de INSERT: `documentos_gates_insert` (`20260530_etapa5g_paso4_policies_documentos.sql:139,146`), + `consultas_gates_insert` (5F), `appointments_gates_insert` (5H), `addendums/mediciones_gates_insert` (5I).

**Predicado RLS real hoy** (fail-CLOSED):
```
acceso = es_vip_grant
       OR (stripe_subscription_id IS NOT NULL AND suscripcion_estado = 'activo')
       OR ha_tenido_acceso_premium IS NOT TRUE
bloqueo_insert = suspendida = true  OR  NOT acceso
```

**Consecuencia crítica para el análisis:** la RLS es **solo tan correcta como `suscripcion_estado` y `stripe_subscription_id`**. Confía en que `estado='activo'` significa "pagó". Por eso los bugs del webhook que escriben `'activo'` incorrectamente (P1, P2, P3) **NO son cosméticos: se propagan a la RLS y otorgan acceso real sin pago**. El webhook es la raíz; la RLS amplifica fielmente su estado (correcto o no).

Esto también significa que la superficie que CLAUDE.md teme "desprotegida" (9 formularios de documentos que insertan directo a Supabase desde el navegador) **SÍ está cubierta** por `documentos_gates_insert`. No hay fuga de acceso cross-usuario por esa vía. **La documentación de CLAUDE.md debe actualizarse** (ver Fase 6).

---

# PARTE 1 — ANÁLISIS PRIORIZADO

Severidad reevaluada bajo el hallazgo transversal. Archivo núcleo del webhook: `src/app/api/stripe/webhook/route.ts` (187 líneas).

## 🔴 TIER 1 — Fuga real de acceso/dinero (estado 'activo' escrito sin pago → la RLS otorga acceso)

### P2 — `customer.subscription.updated`: fallthrough a 'activo' — **CONFIRMADO · ALTA**
`route.ts:95-97`. Solo mapea `past_due/unpaid→vencido` y `canceled→cancelado`; **todo lo demás cae al default `'activo'`** (línea 95).

| Stripe status | Mapea a | Correcto |
|---|---|---|
| `active` | activo | ✅ |
| `past_due` / `unpaid` | vencido | ✅ (gracia, decisión tomada) |
| `canceled` | cancelado | ✅ |
| `trialing` | **activo** (fallthrough) | ⚠️ tolerable (sin trials configurados) |
| `incomplete` | **activo** (fallthrough) | ❌ acceso sin primer pago |
| `incomplete_expired` | **activo** (fallthrough) | ❌❌ sub muerta, primer pago nunca completado → queda activo |
| `paused` | **activo** (fallthrough) | ❌ pausada con acceso |

**Impacto real:** `incomplete_expired` es un evento real — una sub creada (incomplete) cuyo pago no se completa en ~23h transiciona a `incomplete_expired` y dispara `subscription.updated`. Como el checkout inyecta `clinica_id` en `subscription_data.metadata`, cae en este handler → escribe `estado='activo'` + `stripe_subscription_id` → **GATE 2 de la RLS otorga acceso pagado completo a una clínica que nunca pagó**. Fuga de acceso y de dinero.

### P3 — `invoice.*` pisan estado y compiten con `subscription.updated` — **CONFIRMADO · ALTA**
`invoice.payment_failed`→`'vencido'` (`route.ts:158-160`); `invoice.payment_succeeded`→`'activo'` (`route.ts:177-179`). Stripe **no garantiza orden de entrega**.

**Secuencia concreta que produce estado incorrecto:**
1. Cuenta cancelada: `subscription.updated(canceled)` pone `'cancelado'` **pero conserva `stripe_subscription_id`** (a diferencia de `subscription.deleted`, que lo nulifica — `route.ts:124`). Un `invoice.payment_succeeded` **tardío** del último período encuentra la fila por `stripe_subscription_id` y voltea `cancelado→activo` → GATE 2 reabre el acceso a una cuenta cancelada.
2. Cuenta morosa: `invoice.payment_succeeded` del período N entregado tarde (ya en past_due del período N+1) voltea `vencido→activo`.

**Impacto real:** acceso a cuentas canceladas/morosas vía race. La protección solo existe contra `subscription.deleted` (nulifica el id); el agujero es contra `updated(canceled)`, que conserva el id.

### P1 — `checkout.session.completed` escribe 'activo' hardcodeado — **CONFIRMADO · MODERADA**
`route.ts:81` pasa `'activo'` literal; hace `stripe.subscriptions.retrieve` (línea 75) pero **nunca lee `subscription.status`**. Con `payment_method_types:['card']` el cobro es casi síncrono, así que el caso normal llega `active` → **ventana estrecha** (SCA/3DS asíncrono, `payment_status:'unpaid'`). Misma clase que P2 pero menos probable. Viola además la decisión "`subscription.*` = único escritor de estado".

## 🟠 TIER 2 — Drift permanente y silencioso (envenena el estado del que depende la RLS)

### P4 — Ninguna escritura verifica `{ error }`; el webhook siempre responde 200 — **CONFIRMADO · CRÍTICA de confiabilidad**
`route.ts:185` retorna 200 incondicional. El SDK de supabase-js **no lanza** ante fallo (RLS, constraint, timeout): resuelve `{ data:null, error }`. Como nunca se mira `error`, el flujo llega al 200. **8 puntos ciegos** (5 UPDATE + 3 SELECT):

| # | route.ts | Operación |
|---|---|---|
| 1 | 21 | `update({...})` en `actualizarClinica` |
| 2 | 35 | `update({ tipo:'clinica' })` |
| 3 | 113-117 | `select('es_vip_grant')...maybeSingle()` |
| 4 | 139-142 | `update({...camposBase,...camposLimites})` (deleted) |
| 5 | 151-155 | `select('id')...single()` (invoice failed) |
| 6 | 158-160 | `update({ suscripcion_estado:'vencido' })` |
| 7 | 170-174 | `select('id')...single()` (invoice succeeded) |
| 8 | 177-179 | `update({ suscripcion_estado:'activo' })` |

**Por qué 200-tras-fallo es peor que 500:** con 500 Stripe reintenta con backoff **hasta ~3 días** (auto-recuperación); con 200 Stripe **descarta el evento para siempre**. Si el UPDATE falló, Stripe y `clinicas` divergen **permanente y en silencio**. Como el control de acceso deriva de esas columnas, el drift se traduce en acceso mal otorgado o un cliente que pagó atascado en `free`, sin rastro. **Asimetría peligrosa:** los errores de *Stripe* (ej. `retrieve` en línea 75) sí producen 500+reintento; los de *Supabase* producen 200+drift.

### P5 — Sin idempotencia ni protección de orden — **CONFIRMADO · MODERADA-ALTA**
No se usa `event.id` para dedupe (Stripe entrega **at-least-once**; reintentos ~3 días). `subscription.updated` usa `event.data.object` (snapshot del evento), **no refetchea** — un evento viejo entregado tarde sobrescribe estado más nuevo. La decisión "refetch vía retrieve" **solo está aplicada en `checkout.session.completed`**, no en `subscription.updated`. La falta de dedupe por sí sola es tolerable (writes absolutos = idempotentes de facto), pero **amplifica P3**.

### C1 — Silencio total: el logger nunca se usa — **CONFIRMADO · ALTA**
Cero llamadas a `logger.*` ni `console.*` en todo `route.ts`. El `catch` de `constructEvent` (`route.ts:59`) descarta el error. Sin logs, el drift de P4 es **indetectable en operación**. El proyecto exige `src/lib/logger.ts`.

## 🟡 TIER 3 — Over-blocking (fuga inversa: cliente legítimo pierde acceso → queja de soporte)

### P6 — El latch prende por sola presencia de `stripe_subscription_id` — **CONFIRMADO · MEDIA**
Trigger `clinicas_latch_premium` (`20260521_etapa5b3_trigger_latch_premium.sql:42-44`): `es_vip_grant IS TRUE OR stripe_subscription_id IS NOT NULL → ha_tenido_acceso_premium := true`, one-way (nunca vuelve a false). El trigger evalúa bien en UPDATE parcial (Postgres rellena `NEW` con la fila completa).

**El riesgo AHORA sí muerde** porque GATE 2 usa `ha_tenido_acceso_premium`. Secuencia: sub incompleta → P2 escribe `stripe_subscription_id` (aunque el estado sea no-productivo) → latch=true **permanente** → si luego cae a `vencido`/`cancelado`, GATE 2 evalúa `NOT (stripe AND activo)` y `ha_tenido_acceso_premium=true` → **clínica bloqueada de INSERT pese a no haber pagado nunca**. No hay ruta en código que limpie el flag (one-way por diseño). Mitigante: en checkout normal de tarjeta, `completed` implica pago, por eso MEDIA y no ALTA. **La raíz es la misma que P2:** escribir `stripe_subscription_id` en status no productivos.

**Consume `ha_tenido_acceso_premium`:** SQL → `clinica_tiene_acceso()` (GATE 2 de todas las policies de INSERT). TS → `consultas/route.ts:57`, `addendum/route.ts:44`, `labs/mediciones/route.ts:47` (`esFreeDeBuenaFe`).

## 🔵 TIER 4 — Cosmético / UX / deuda documental (no hay fuga)

### P8 — Predicado UX (`getSubscriptionState`) diverge de la RLS real — **CONFIRMADO · SOLO-INCONSISTENCIA**
`src/lib/subscription.ts` usa `cancelado && !es_vip_grant && count>5` (líneas 97, 131). La RLS real **no usa count** y **no usa 'cancelado' como llave** — bloquea cuando falta `(stripe AND estado='activo')` y `ha_tenido_acceso_premium=true`. Divergencias:
- **(a) Umbral:** el UX exige `count>5`; la RLS de features (GATE 2) no usa count en absoluto. Una clínica ex-premium no-VIP no-activa con **≤5 pacientes**: la RLS la bloquea, el UX muestra `isBlocked=false` (sin banner) → el INSERT falla sin aviso previo.
- **(b) 'vencido':** el UX solo considera `'cancelado'` (ignora `'vencido'`); la RLS bloquea cualquier estado ≠`'activo'` con latch=true. Clínica en `'vencido'` ex-premium: bloqueada por RLS, sin banner en UX.
- **(c) "La RLS no existe":** **REFUTADO** — existe (hallazgo transversal).

`FAIL_OPEN` (`subscription.ts:34-41`) **NO es explotable**: alimenta solo UX (banner/modal/redirect). Forzar el fail-open a lo sumo evita el banner; la RLS RESTRICTIVE sigue fail-closed y rechaza la mutación. Defensa en capas correcta por diseño.

### P7 — CHECK constraint sin 'incompleto' — **CONFIRMADO · INFORMATIVO (no es bug)**
`supabase/baseline/02_tables.sql:168-169`: `suscripcion_estado = ANY(ARRAY['free','trial','activo','vencido','cancelado'])`. `'incompleto'` no es válido. Coherente con la decisión de NO introducirlo. El webhook nunca lo intenta escribir. Sin acción.

---

## Cabos sueltos adicionales (no estaban en la lista original)

| ID | Hallazgo | Archivo:línea | Severidad |
|---|---|---|---|
| A1 | **`planKey` fallback silencioso a `'individual'`** cuando `getPlanByPriceId` falla o `priceId=''`. Una clínica premium se recalcula a `max_medicos:1, max_secretarias:0` y `tipo` no se convierte a 'clinica'. El dato confiable ya existe: `subscription.metadata.plan` (lo fija el checkout) — el handler lo ignora. | `route.ts:92-93` | MODERADA-ALTA |
| A2 | **Doble UPDATE no atómico** a `clinicas` en `actualizarClinica`. Sin verificación de error, ventana de update parcial (plan OK, `tipo` falla → inconsistente). Fusionable en un solo UPDATE. | `route.ts:21` y `35` | MEDIA |
| A3 | **Gate TS de appointments desalineado con su propia RLS.** Usa el predicado VIEJO (`cancelado && !vip && count>5`), no el canónico. Una clínica `suspendida`/`vencido` ex-premium/`cancelado` con ≤5 pacientes pasa el gate TS, y el INSERT rebota contra `appointments_gates_insert` devolviendo **500 con error crudo** en vez del 403 limpio que dan consultas/mediciones/addendum. | `src/app/api/appointments/route.ts:86-92` (vs `consultas/route.ts:53-58`) | MEDIA (UX/observabilidad) |
| A4 | **Banner/redirect UI desalineados con el bloqueo real.** `billing/page.tsx` y los layout-guards se basan en el predicado viejo; una clínica bloqueada por la RLS real no es redirigida ni ve modal — descubre el bloqueo al fallar una mutación. | `src/app/(app)/billing/page.tsx`, `documentos/layout.tsx` | BAJA-MEDIA |
| A5 | **Deuda documental de alto riesgo operativo.** CLAUDE.md §2026-05-04 y comentarios en `subscription.ts`/`documentos/layout.tsx` describen "RLS revertida, sin barrera" — estado obsoleto. Un futuro editor podría "restaurar" una RLS que ya existe (duplicándola) o meter parches redundantes. | CLAUDE.md, `subscription.ts:26-41`, `documentos/layout.tsx:8` | MEDIA (invita a regresión) |
| A6 | **Falta handler `customer.subscription.created`.** Hoy lo cubre `completed`+`updated`, pero si `subscription.*` va a ser el único escritor, conviene contemplarlo (reactivación vía billing portal). | `route.ts` (ausente) | BAJA |
| A7 | **`get_suscripcion_estado()` huérfana** — cero call-sites, conservada por decisión explícita (ETAPA5_PLAN.md D9). Código muerto documentado, no es riesgo. | `baseline/05_functions.sql:60-67` | INFORMATIVO |
| A8 | **`.single()` en invoice handlers** no lanza (devuelve `{error}`); si por drift previo no existe fila con ese `stripe_subscription_id`, un `payment_failed` legítimo no marca nada y se pierde. Semánticamente debería ser `.maybeSingle()`. | `route.ts:155`, `173` | BAJA (moot si invoice.* deja de escribir estado — Fase 3) |
| A9 | **Cast `metadata.plan as PlanKey` sin validar** (`route.ts:72`). Si trae un valor no contemplado, `PLAN_LIMITS[plan]` es `undefined` y `limits.max_medicos` lanza → 500 → reintento infinito. Probabilidad baja (metadata la fija tu código). Blindable con `if (!(planKey in PLAN_LIMITS)) break`. | `route.ts:72`, `20` | BAJA |

**Afirmaciones positivas verificadas (no son problemas):** `getSubscriptionIdFromInvoice` es correcta para Stripe v21/dahlia y maneja bien `parent=null`; `current_period_end` se lee en la ubicación correcta (nivel item); el IDOR en checkout está **refutado** (`clinica_id` sale de `profile.clinica_id` server-side, no del body); `runtime='nodejs'` + body raw para verificación de firma están correctos.

---

# PARTE 2 — PLAN DE MEJORA EN FASES ATÓMICAS

Cada fase es **aplicable, commiteable y probable de forma aislada** sobre la BD de producción viva, sin romper las demás. Prioridad por severidad: primero lo que detiene fuga real, luego drift, luego over-blocking, luego cosmético.

**Decisiones respetadas (no rediscutidas):** past_due=gracia (corte vía unpaid/canceled tras dunning ya configurado); `customer.subscription.*` = único escritor de estado; `invoice.*` no escribe estado; refetch vía retrieve contra orden de entrega; NO introducir 'incompleto' — en status no productivos **simplemente no escribir**.

### Grafo de dependencias
```
Fase 0 (observabilidad) ─┬─> Fase 1 (verificar error + 500)
                         │
Fase 2 (estado sólo en status productivos) ──> Fase 3 (invoice.* deja de escribir estado)
                         │                  └─> Fase 5 (planKey + no escribir sub_id en no-productivos)
Fase 4 (idempotencia por event.id) ── independiente
Fase 6 (alinear UX/gates/docs con RLS real) ── independiente (hacer al final)
```

---

### Fase 0 — Observabilidad (habilitador, sin cambio de comportamiento)
- **Qué corrige:** C1. Hace visible todo lo demás. Prerrequisito práctico para validar las fases siguientes en prod.
- **Cambio:** agregar `logger` (`src/lib/logger.ts`) al webhook: log de cada `event.type` recibido + log del `catch` de firma. Sin cambiar códigos de respuesta.
- **Archivos:** `src/app/api/stripe/webhook/route.ts`.
- **Riesgo:** ~nulo (puramente aditivo).

### Fase 1 — Verificar `{ error }` de Supabase y responder 500 ante fallo de DB 🔴
- **Qué corrige:** P4 (drift permanente).
- **Cambio:** destructurar `{ error }` en las 8 operaciones; ante `error` → `logger.error(...)` + `return NextResponse.json({error}, {status:500})` para forzar el reintento de Stripe.
- **Archivos:** `src/app/api/stripe/webhook/route.ts`.
- **Riesgo introducido:** MEDIO. Ahora un fallo de DB dispara reintentos de Stripe. Es el comportamiento deseado (los handlers son idempotentes: writes absolutos), pero un error persistente reintentará ~3 días y alertará — precisamente lo que queremos. Validar tras Fase 0 (necesitas los logs para distinguir un 500 legítimo de uno espurio).
- **Depende de:** Fase 0 (recomendado, no bloqueante).

### Fase 2 — Escribir estado SOLO en status productivos; cerrar el fallthrough 🔴
- **Qué corrige:** P1 + P2 (fuga de acceso).
- **Cambio:**
  - `customer.subscription.updated`: mapear explícitamente `active→activo`, `past_due/unpaid→vencido`, `canceled→cancelado`. Para `incomplete/incomplete_expired/paused/trialing` → **no escribir `suscripcion_estado`** (escribir el resto de campos o hacer `break` según Fase 5). Respeta el CHECK (sin 'incompleto').
  - `checkout.session.completed`: dejar de pasar `'activo'` hardcodeado. Como ya hace `retrieve` (línea 75), leer `subscription.status` y escribir `estado='activo'` **solo si** `status==='active'`; en otro caso escribir plan/límites/sub_id pero no estado (o diferir a `subscription.updated`).
  - Aplicar **refetch vía `retrieve(subscription.id)`** en `subscription.updated` para leer el status autoritativo actual (mitiga P5 de orden de entrega parcialmente).
- **Archivos:** `src/app/api/stripe/webhook/route.ts`.
- **Riesgo introducido:** MEDIO. Si checkout no escribe estado en un caso borde, hay una ventana breve en `free` hasta que llegue `subscription.updated`. Mitigado por el `retrieve` que ya existe. Probar los 8 status con Stripe CLI (`stripe trigger`).

### Fase 3 — `invoice.*` deja de escribir `suscripcion_estado` 🟠
- **Qué corrige:** P3 (race de parpadeo) + A8.
- **Cambio:** eliminar los `update({suscripcion_estado})` de `invoice.payment_failed` y `invoice.payment_succeeded`. Pueden conservarse para logging/notificaciones (dunning), pero sin tocar estado. `subscription.*` queda como único escritor.
- **Archivos:** `src/app/api/stripe/webhook/route.ts`.
- **Riesgo introducido:** BAJO-MEDIO. Se apoya en que `subscription.updated` dispara en las transiciones `active`/`past_due` (Stripe lo garantiza). **Depende de Fase 2:** primero `subscription.updated` debe ser un escritor correcto antes de retirar los escritores de invoice.

### Fase 4 — Idempotencia por `event.id` (+ opcional guardia de orden) 🟠
- **Qué corrige:** P5.
- **Cambio:** tabla `stripe_webhook_events (event_id text PK, type text, created_at timestamptz)`. Al inicio del POST, `INSERT ... ON CONFLICT DO NOTHING`; si ya existía → responder 200 sin reprocesar. Opcional: guardar `event.created` por `subscription_id` y descartar eventos más viejos que el último aplicado (guardia de orden dura).
- **Archivos:** `src/app/api/stripe/webhook/route.ts` + **nuevo archivo de migración SQL** (`supabase_migration_stripe_events.sql`). ⚠️ Por regla del proyecto: genero el SQL, tú lo ejecutas manualmente. RLS: tabla solo-service_role.
- **Riesgo introducido:** BAJO. Tabla aditiva, no toca `clinicas`. Independiente de las demás fases.

### Fase 5 — Endurecer `planKey` y no escribir `stripe_subscription_id` en status no-productivos 🟡
- **Qué corrige:** A1 (downgrade silencioso) + P6 (over-blocking del latch) + A2.
- **Cambio:**
  - Leer `subscription.metadata.plan` como fuente primaria del plan (fallback a `getPlanByPriceId`), evitando el recálculo a `'individual'`.
  - En `subscription.updated`, para status no productivos (Fase 2), **omitir el update completo** (no escribir `stripe_subscription_id`) → el latch no prende por una sub que nunca pagó. Cierra la ruta de over-blocking de P6.
  - Fusionar el doble UPDATE de `actualizarClinica` en uno solo (A2): `tipo:'clinica'` condicional dentro del mismo objeto.
- **Archivos:** `src/app/api/stripe/webhook/route.ts`.
- **Riesgo introducido:** BAJO-MEDIO. **Depende de Fase 2** (edita el mismo handler y usa su clasificación de status productivos).

### Fase 6 — Alinear predicado UX / gate de appointments / documentación con la RLS real 🔵
- **Qué corrige:** P8 + A3 + A4 + A5. Puramente de consistencia UX/observabilidad; sin fuga.
- **Cambio:**
  - `src/lib/subscription.ts`: reemplazar el predicado (`cancelado && !vip && count>5`) por el **canónico de la RLS** (`NOT vip AND NOT(stripe AND activo) AND ha_tenido_acceso_premium`), para que banner/modal/redirect coincidan con el bloqueo real (incluye 'vencido', sin count>5).
  - `src/app/api/appointments/route.ts`: sustituir su gate viejo por el mismo predicado fail-closed de `consultas/route.ts` (403 limpio, no 500 crudo).
  - Actualizar **CLAUDE.md** §2026-05-04 y los comentarios de `subscription.ts`/`documentos/layout.tsx`: la barrera RLS de Phase 8.1 fue **cerrada por etapa5** (5.C/5.F/5.G/5.H/5.I); el trade-off "sin barrera RLS" ya no aplica.
- **Archivos:** `src/lib/subscription.ts`, `src/app/api/appointments/route.ts`, `src/app/(app)/billing/page.tsx` (opcional), CLAUDE.md. ⚠️ **Toca >3 archivos** → mostrar plan detallado y confirmar antes de ejecutar (Protocolo 3).
- **Riesgo introducido:** BAJO funcional (capa UX), pero el predicado debe **espejar la RLS exactamente** para no crear nuevos mismatches "bloqueado sin banner" ni banners falsos. Hacer al final, con las Fases 1-5 estabilizadas.

---

## Resumen ejecutivo de prioridad

| Prioridad | Fase | Corrige | Clase de daño |
|---|---|---|---|
| 1 | Fase 1 | P4 | Drift permanente silencioso (raíz de confiabilidad) |
| 1 | Fase 2 | P1, P2 | **Fuga de acceso/dinero** (estado 'activo' sin pago) |
| 2 | Fase 3 | P3 | Fuga de acceso por race (invoice vs subscription) |
| 2 | Fase 0 | C1 | Observabilidad (habilitador) |
| 3 | Fase 4 | P5 | Duplicados / orden de entrega |
| 3 | Fase 5 | P6, A1, A2 | Over-blocking (queja de cliente) + downgrade silencioso |
| 4 | Fase 6 | P8, A3, A4, A5 | Inconsistencia UX + deuda documental |

**Sin acción:** P7 (CHECK — informativo), A6/A7 (bajos/documentados).

**Nota final:** ninguna fase reescribe el billing. Todas son ediciones quirúrgicas sobre `webhook/route.ts` (Fases 0-3, 5), una migración aditiva (Fase 4) y una alineación de la capa UX (Fase 6). El diseño de fondo — `subscription.*` como único escritor, RLS declarativa vía latch, fail-open en UX / fail-closed en datos — es correcto y se conserva.
