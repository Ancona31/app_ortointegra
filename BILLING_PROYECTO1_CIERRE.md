# BILLING — Proyecto 1: Cierre de fugas Stripe en el webhook

**Fecha de cierre:** 2026-07-18
**Estado:** ✅ **COMPLETO** — 4 deploys en producción + reconciliación de datos ejecutada.
**Plan de origen:** `BILLING_FIX_PLAN.md` (Fases 0–6) · Diagnóstico: `BILLING_ANALISIS_MEJORA.md`

---

## 1. Resumen ejecutivo

El webhook de Stripe (`/api/stripe/webhook`) procesaba eventos con lógica
defectuosa en cinco frentes simultáneos:

1. **Fallthrough a `'activo'`** — cualquier `status` no contemplado terminaba
   escribiendo `suscripcion_estado = 'activo'`.
2. **Errores de DB silenciados** — las operaciones de Supabase no verificaban
   `{ error }` y el handler respondía `200 OK` igualmente. Stripe daba el evento
   por entregado y no reintentaba: el drift quedaba permanente.
3. **`invoice.*` pisando el estado** — dos familias de eventos escribían la
   misma columna, sin un escritor único.
4. **Sin idempotencia** — Stripe entrega *at-least-once*; un evento reentregado
   se procesaba dos veces.
5. **Sin protección de orden de entrega** — eventos fuera de orden podían dejar
   el estado en un valor viejo.

Se corrigió en **4 deploys atómicos** más una **reconciliación del drift
histórico**.

**Magnitud real (sin inflar ni minimizar):** el drift efectivamente medido en
producción fue **acotado** — **4 clínicas con dato cosmético** (`suscripcion_estado`
colgado en `'activo'` sin vínculo Stripe), **sin fuga de capital** y **sin acceso
indebido**, porque la barrera RLS de suscripción (recreada en etapa 5, viva en
producción) sostenía el bloqueo real independientemente del valor cosmético.
No fue una hemorragia. Era un **goteo** — pequeño al volumen actual, con
potencial claro de crecer a mayor volumen de clínicas de pago.

---

## 2. Hallazgos del diagnóstico (Paso 0)

### 2.a Configuración de Stripe

- **Endpoint del webhook:** correcto. El endpoint viejo apuntando al dominio
  `ortointegra.com` fue eliminado (ya no existe duplicidad de destino).
- **Dunning (reintentos de cobro):** configurado a **3 reintentos en 3 días** y,
  al agotarse, **cancelar la suscripción**. Consecuencia de diseño: el período
  de gracia efectivo del sistema es de **3 días**.

### 2.b Drift medido (5 SELECTs sobre producción)

- **11 clínicas** en total.
- Estados presentes: `activo` / `free` / `cancelado`. **Sin valores basura**.
- **Sin `customer` huérfanos** y **sin duplicados** de `stripe_customer_id`.
- **Drift cosmético en 4 clínicas** — `suscripcion_estado = 'activo'` sin
  vínculo Stripe correspondiente:
  - **Star Médica** — ex-VIP cuyo grant fue revocado.
  - **Playamed**, **Urrea**, **Arámbula** — grupo VIP.
- **Causa raíz del drift:** el handler super-admin de activación/revocación de
  VIP **no normaliza `suscripcion_estado`**. Al activar VIP marcaba el estado
  como `'activo'`; al revocar no lo revertía. No es una fuga del webhook.

### 2.c Verificación de cuentas VIP

- **OrtoIntegra** — `stripe_customer_id` en `null`, que es lo **correcto**: el
  pago asociado se hizo en **modo TEST**, no en live.
- **Dr. Ancona TYO** — pago **live** correcto.
- **Jorge Juárez** — tiene `customer` creado por un **checkout abandonado**;
  nunca completó un pago.

---

## 3. Los 4 deploys

Referencias `P#` / `A#` / `C1` corresponden a los IDs de problema de
`BILLING_ANALISIS_MEJORA.md` y a la tabla de prioridad de `BILLING_FIX_PLAN.md`.

### Deploy 1 — Fases 0 + 1 · *logging y manejo de errores* — ✅ en producción

- Logging estructurado en el webhook (observabilidad: sin esto no se podía
  diagnosticar nada en Vercel).
- Verificación del `{ error }` devuelto por las **8 operaciones de Supabase**
  del handler.
- **Responder `500` ante fallo de DB** — antes respondía `200` silencioso, con
  lo que Stripe daba el evento por bueno y no reintentaba nunca: el drift se
  volvía permanente. Con el `500`, Stripe reintenta.
- **Corrige:** `P4`, `C1`.

### Deploy 2 — Fases 2 + 5 + 3 · *lógica de estado* — ✅ en producción

Núcleo del fix. Van juntas porque comparten handler y tienen dependencias entre sí.

- **Cierre del fallthrough a `'activo'`**: `mapStatusToEstado` explícito, sin
  rama por defecto permisiva.
- `checkout.session.completed` **lee el `status` real** de la suscripción en vez
  de asumir que completar el checkout implica estado activo.
- **Los `status` no productivos ya no escriben estado.**
- `resolvePlanKey` **validado** — evita el fallback silencioso a `'individual'`.
- **No se escribe `subscription_id` en status no productivos** — protege el
  latch `ha_tenido_acceso_premium` de dispararse por un estado no pagado
  (cierre del over-blocking).
- **`invoice.*` deja de escribir `suscripcion_estado`** — se establece
  `customer.subscription.*` como **escritor único** del estado.
- **Corrige:** `P1`, `P2`, `P3`, `P6`, `A1`, `A2`.

### Deploy 3 — Fase 4 ampliada · *idempotencia y orden* — ✅ en producción

- **Idempotencia por `event.id`**: tabla `public.stripe_webhook_events`
  (migración `20260713_billing_01`, **aplicada a producción**). Patrón
  **SELECT-first / INSERT-last** con `ON CONFLICT` como red de seguridad ante
  carreras.
- **Refetch vía `subscriptions.retrieve`** en `checkout.session.completed` y en
  `customer.subscription.updated` — se consulta el estado **actual** en Stripe
  en vez de confiar en el payload del evento. Esto **cierra el problema de
  entrega fuera de orden**: un evento viejo que llega tarde ya no puede
  retroceder el estado.
- **`try/catch` alrededor del `retrieve`**: `404` → responder `200` como no-op
  (la suscripción ya no existe, reintentar no ayuda); error transitorio → `500`
  para que Stripe reintente.
- **Corrige:** `P5` + entrega fuera de orden.

### Deploy 4 — Fase 6 reducida · *documentación* — ✅ en producción

- Corrección de documentación obsoleta en `CLAUDE.md` y en comentarios del
  código: la RLS de bloqueo por suscripción figuraba como **muerta** (nota del
  2026-05-04). La realidad es que **etapa 5 la recreó** vía el latch declarativo
  `clinicas.ha_tenido_acceso_premium` y las 7 policies `*_gates_insert`, y está
  **activa en producción**.
- **Solo documentación. Cero cambios de lógica.**
- **Corrige:** `A5`.

> **NOTA — alcance reducido deliberadamente.** La Fase 6 original también
> contemplaba (a) alinear el predicado UX de `src/lib/subscription.ts` con la
> RLS real y (b) alinear el gate de `appointments`. **Ninguna de las dos se
> hizo**, y no por falta de tiempo: al inspeccionarlas se descubrió que
> (a) el banner `SuscripcionBanner` **ya avisa** al usuario, por lo que la
> divergencia del predicado no deja al usuario sin información, y
> (b) `appointments` **ya está protegido** por una RLS idéntica a la de
> `consultas` (`appointments_gates_insert`). Ambas quedan como **higiene
> opcional de código**, registradas en `DEUDA_TECNICA.md`.

---

## 4. Reconciliación de datos (Paso 3) — ejecutada 2026-07-18

Las 4 clínicas con drift cosmético (**Star Médica, Playamed, Urrea, Arámbula**)
se corrigieron con un `UPDATE` de `suscripcion_estado`: `'activo'` → `'free'`.

**Verificación previa (antes de tocar nada):** se evaluó el predicado de acceso
**en vivo** sobre las 4 clínicas, comparando `tiene_acceso_hoy` contra
`tiene_acceso_si_free`. Coincidieron en las 4 → el cambio **no altera el acceso
de nadie**; corrige únicamente el dato cosmético.

**Censo final:** `free = 9` · `cancelado = 3` · `activo = 0`.

**Acceso preservado:**
- Las clínicas VIP conservan su acceso por `es_vip_grant`, que es independiente
  de `suscripcion_estado`.
- **Star Médica sigue bloqueada** por el latch `ha_tenido_acceso_premium`
  (es free degradada, no free virgen).

**No se tocó:** `plan`, `es_vip_grant`, ni `ha_tenido_acceso_premium`.

---

## 5. Decisiones de diseño clave

1. **`past_due` → `'activo'`** — se mantiene el acceso durante el dunning. El
   período de gracia efectivo son los **3 días** configurados en Stripe.
2. **`customer.subscription.*` es el escritor único** de `suscripcion_estado`.
3. **`invoice.*` no escribe estado** — solo registra el hecho del cobro. Elimina
   la condición de carrera entre dos escritores sobre la misma columna.
4. **NO se introdujo el estado `'incompleto'`** — choca con el `CHECK` de la
   columna. Coherente con la decisión de diseño 5 del plan; los status no
   productivos simplemente no escriben.
5. **Refetch en vez de versionado** para resolver la entrega fuera de orden —
   consultar el estado real a Stripe es más simple y más robusto que llevar un
   contador de versión local.

---

## 6. Configuración de Stripe aplicada (fuera del repo)

Cambios hechos en el Dashboard de Stripe, no versionados en git:

- **Dunning:** 3 reintentos en 3 días → cancelar la suscripción.
- **Correo de "pago fallido":** activado.
- **Enlace de actualización de método de pago:** apunta a la página alojada por
  Stripe.
- **Nombre comercial:** cambiado a **SPINUS**. (El nombre legal del titular se
  mantiene por requisito fiscal.)

---

## 7. Lectura honesta — severidad real vs. mejora obtenida

**Qué tan grave era, en realidad:**
Un goteo acotado, no una hemorragia. La **RLS aguantaba**: el bloqueo real de
acceso nunca dependió del valor de `suscripcion_estado` que el webhook escribía
mal, sino del latch `ha_tenido_acceso_premium` y de `es_vip_grant`. Además, la
mayoría de las clínicas del censo son **VIP** o **free virgen**, es decir,
fuera del camino donde el defecto podía causar daño económico. El drift medido
fue de 4 filas cosméticas y **cero pesos de fuga**.

**Qué tan robusto quedó el webhook:**
- **Single-writer** de estado (`customer.subscription.*`).
- **Idempotente** por `event.id`.
- **Refetch** contra Stripe → inmune a entrega fuera de orden.
- **Errores de DB propagados** como `500` → Stripe reintenta en vez de dar por
  bueno un fallo.
- **Observabilidad** vía logging estructurado.

La diferencia importante no es cuánto dinero se recuperó (ninguno: no se había
perdido). Es que el sistema pasó de "funciona porque otra capa lo tapaba" a
"funciona por sí mismo", justo antes de escalar el volumen de clínicas de pago.

---

## 8. Lo que NO se validó

**No hubo tráfico real de pagos en producción durante el proyecto.** El último
evento real de Stripe es del **13 de junio**; los 4 deploys son de **julio**.

Consecuencia: **el camino completo con un `clinica_id` real NO se ejercitó
end-to-end en producción.** Los smoke tests locales cortaban antes de llegar a
la escritura, porque los eventos sintéticos no traían la metadata necesaria.

**Pendiente explícito:** revisar los logs de Vercel cuando ocurra el primer
evento real de pago, y confirmar que el flujo completo (verificación de firma →
idempotencia → refetch → escritura de estado) se ejecuta como se diseñó.

---

## 9. Deuda derivada

**Toda la deuda derivada de este proyecto está registrada en
`DEUDA_TECNICA.md`** (secciones *Billing — Cierre de fugas Stripe* y
*Dependencias / Entorno*). No se duplica aquí. Entradas relevantes:

- **BILL-DT-1** — Limpieza programada de `stripe_webhook_events` (idempotencia).
- **BILL-DT-2** — Handler super-admin de VIP no normaliza `suscripcion_estado`.
- **BILL-DT-3** — Traducir rechazo RLS (`42501`) a `403` limpio en rutas de INSERT.
- **BILL-DT-4** — Alinear el predicado UX de `subscription.ts` con la RLS real.
- **BILL-DT-5** — Verificar la suscripción a los eventos `invoice.payment_failed`
  / `invoice.payment_succeeded` en el Dashboard de Stripe.
- **DEP-DT-1** — Vulnerabilidades de dependencias npm (`npm audit`).

---

*Fin de `BILLING_PROYECTO1_CIERRE.md`.*
