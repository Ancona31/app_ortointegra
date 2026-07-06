# BILLING_FIX_PLAN.md

**Proyecto:** Cierre de fugas de billing Stripe
**Fecha:** 2026-07-06
**Estado:** ✅ APROBADO — ⛔ NO INICIADO

> **Nota operativa crítica.** La BD es **producción**. Cada fase se aplica,
> commitea y prueba de forma **aislada**. El SQL de producción se ejecuta
> **una query a la vez**, validando el resultado de cada una antes de
> continuar. **No se pushea a `main` sin aprobación explícita de Angel.**
> Este archivo es el registro operativo del proyecto y documenta el plan
> aprobado; **no ejecuta ninguna fase**.

---

## Contexto / hallazgo transversal

- El billing **YA funciona en producción**. Este proyecto corrige problemas
  puntuales; **NO es una reingeniería** del subsistema.
- **Hallazgo clave — la barrera RLS de bloqueo NO está muerta.** La premisa
  de `CLAUDE.md §2026-05-04` ("sin barrera RLS") está **OBSOLETA**. El
  refactor **etapa5** (aplicado a producción el 2026-05-30/31) recreó la
  barrera de forma **declarativa** mediante el latch
  `ha_tenido_acceso_premium`.
  - Helper `clinica_tiene_acceso()` en
    `20260522_etapa5c_helpers_rls.sql:142-157`.
  - Aplicado en policies **RESTRICTIVE de INSERT** sobre `documentos`,
    `consultas`, `appointments`, `addendums` y `mediciones`.
- **Consecuencia (por qué esto importa):** los bugs del webhook que escriben
  `'activo'` sin pago **se propagan a la RLS y otorgan acceso real**. No son
  cosméticos: son fugas de acceso efectivas.

---

## Decisiones de diseño ya tomadas (no rediscutir)

1. **`past_due` = gracia.** El corte real ocurre vía `unpaid` / `canceled`
   tras el dunning ya configurado (3 reintentos / 3 días → cancela).
2. **`customer.subscription.*` es el ÚNICO escritor de `suscripcion_estado`.**
3. **`invoice.*` NO escribe estado.**
4. **Contra orden de entrega de eventos:** refetch vía
   `stripe.subscriptions.retrieve()` en los handlers de subscription.
5. **NO introducir el estado `'incompleto'`.** Choca con el `CHECK`
   existente (`free | trial | activo | vencido | cancelado`). En status
   **no productivos**: simplemente **no escribir** estado.

---

## Las 7 fases

Cada fase documenta: **qué corrige** (con IDs de problema P1–P8, A1–A9, C1),
**archivos que toca**, **cambio concreto**, **riesgo introducido**,
**dependencias** y **criterio de terminado** (cómo se valida).

---

### Fase 0 — Observabilidad (logs en webhook)

- **Qué corrige:** C1.
- **Rol:** habilitador. Sirve de base para verificar el resto de fases en
  producción sin adivinar.
- **Archivos que toca:** handler del webhook de Stripe (`route.ts` del
  endpoint webhook).
- **Cambio concreto:** agregar logging estructurado de cada evento recibido:
  `event.type`, `event.id`, `subscription.status` (cuando aplique),
  `clinica_id` resuelta, resultado de la operación de DB (ok / `{ error }`),
  y estado escrito (o "no-write" cuando corresponda). Usar el logger de
  `src/lib/logger.ts`, nunca `console.log`.
- **Riesgo introducido:** ~nulo. Solo lectura y emisión de logs; no cambia
  control de flujo ni escrituras.
- **Dependencias:** ninguna.
- **Criterio de terminado:** al disparar eventos de prueba (o revisar el
  tráfico real), los logs muestran cada evento con su tipo, status y
  resultado de DB de forma legible y correlacionable por `event.id`.

---

### Fase 1 — Verificar `{ error }` de Supabase y responder 500 ante fallo de DB 🔴

- **Qué corrige:** P4.
- **Archivos que toca:** handler del webhook (las 8 operaciones de DB).
- **Cambio concreto:** en las **8 operaciones** de escritura/lectura a
  Supabase del webhook, capturar y verificar el `{ error }` devuelto. Ante
  cualquier fallo de DB, **responder HTTP 500** (para que Stripe reintente
  el evento) en lugar de devolver 200 silenciosamente. Loguear el error
  (apoyándose en Fase 0).
- **Riesgo introducido:** bajo. Un 500 provoca reintentos de Stripe; si se
  combina con escrituras no idempotentes podría duplicar efectos — mitigado
  definitivamente por Fase 4. En el interín, las escrituras son
  mayormente idempotentes (UPDATE del mismo estado).
- **Dependencias:** ninguna funcional. Se apoya en Fase 0 para diagnóstico.
- **Criterio de terminado:** forzar un error de DB (o revisar una operación
  fallida real) confirma que el endpoint responde 500 y Stripe reintenta;
  ninguna de las 8 operaciones ignora ya su `{ error }`.

---

### Fase 2 — Escribir estado SOLO en status productivos 🔴

- **Qué corrige:** P1, P2.
- **Archivos que toca:** handler del webhook (handlers de
  `checkout.session.completed` y `customer.subscription.*`).
- **Cambio concreto:**
  - Escribir `suscripcion_estado` **solo** para status productivos de Stripe;
    **cerrar el fallthrough a `'activo'`** (hoy cualquier status no mapeado
    cae en `'activo'`).
  - **Mapeo explícito** de `subscription.status` → `suscripcion_estado` en
    `subscription.updated`; los status no productivos → **no escribir**.
  - `checkout.session.completed` debe **leer `subscription.status`** (no
    asumir `'activo'` por el hecho de completar checkout).
  - **Refetch** vía `stripe.subscriptions.retrieve()` en
    `subscription.updated` (contra orden de entrega de eventos).
- **Riesgo introducido:** medio. Es el núcleo del cambio de comportamiento;
  un mapeo incompleto podría dejar un status productivo sin escribir. Se
  mitiga con el logging de Fase 0 y validación por status.
- **Dependencias:** ninguna hacia atrás; **habilita** Fase 3 y Fase 5.
- **Criterio de terminado:** para cada status de Stripe se documenta y
  verifica qué se escribe (o que no se escribe); ya **no existe** ninguna
  ruta que escriba `'activo'` sin un status productivo confirmado; checkout
  refleja el status real de la suscripción.

---

### Fase 3 — `invoice.*` deja de escribir `suscripcion_estado`

- **Qué corrige:** P3, A8.
- **Archivos que toca:** handler del webhook (handlers de
  `invoice.payment_failed` e `invoice.payment_succeeded`).
- **Cambio concreto:** `invoice.payment_failed` e
  `invoice.payment_succeeded` **dejan de escribir** `suscripcion_estado`.
  Pueden **loguear** (apoyándose en Fase 0), pero el único escritor de
  estado queda siendo `customer.subscription.*` (decisión de diseño 2 y 3).
- **Riesgo introducido:** bajo. Al quitar escrituras desde invoice se elimina
  el drift; el estado correcto lo garantiza el flujo de subscription de
  Fase 2.
- **Dependencias:** **depende de Fase 2** (subscription debe ser ya el
  escritor confiable antes de retirar invoice como escritor).
- **Criterio de terminado:** un ciclo de pago fallido/exitoso confirma que
  ningún handler de `invoice.*` modifica `suscripcion_estado`; el estado solo
  cambia por eventos de subscription.

---

### Fase 4 — Idempotencia por `event.id`

- **Qué corrige:** P5.
- **Archivos que toca:** handler del webhook + **migración SQL aditiva**
  (tabla nueva `stripe_webhook_events`) que **Angel ejecuta manualmente**.
- **Cambio concreto:** crear tabla `stripe_webhook_events` (registro de
  `event.id` procesados). Al inicio del handler, verificar si el `event.id`
  ya fue procesado; si lo fue, responder 200 sin re-ejecutar efectos. Al
  procesar con éxito, registrar el `event.id`. La migración es **aditiva**
  (no altera tablas existentes) y se aplica **una query a la vez** validando
  el resultado.
- **Riesgo introducido:** bajo. Tabla nueva, sin FKs a pacientes; la lógica
  de idempotencia envuelve al handler sin cambiar el mapeo de estados.
- **Dependencias:** **independiente** (no requiere Fases 2/3/5). Refuerza la
  seguridad de los reintentos introducidos por Fase 1.
- **Criterio de terminado:** reenviar el mismo `event.id` no duplica efectos
  (una sola escritura / un solo registro); la tabla registra los eventos
  procesados y el handler corta en el segundo intento.

---

### Fase 5 — Endurecer `planKey` y cierre de over-blocking del latch

- **Qué corrige:** P6, A1, A2.
- **Archivos que toca:** handler del webhook (resolución de `planKey` y
  `actualizarClinica`).
- **Cambio concreto:**
  - **Endurecer `planKey`:** usar `subscription.metadata.plan` como **fuente
    primaria**; **evitar el fallback a `'individual'`** (que asigna plan
    arbitrario cuando falta metadata).
  - **No escribir `stripe_subscription_id`** en status **no productivos**
    (cierra el over-blocking del latch `ha_tenido_acceso_premium`, que se
    dispara con la presencia de datos de suscripción).
  - **Fusionar el doble UPDATE** de `actualizarClinica` en una sola
    escritura.
- **Riesgo introducido:** medio. El cambio de fuente de `planKey` podría
  afectar la asignación de plan si algún flujo no envía `metadata.plan`
  (ver A9 en fuera de alcance como blindaje opcional). Validar contra los
  planes reales configurados en Stripe.
- **Dependencias:** **depende de Fase 2** (comparte handler de subscription y
  se apoya en el mapeo de status productivos).
- **Criterio de terminado:** una alta con `metadata.plan` asigna el plan
  correcto sin caer en `'individual'`; en status no productivos no se
  escribe `stripe_subscription_id`; `actualizarClinica` ejecuta un único
  UPDATE.

---

### Fase 6 — Alinear predicado UX + gate + documentación con la RLS real

- **Qué corrige:** P8, A3, A4, A5.
- **⚠️ Toca >3 archivos → requiere confirmación previa de Angel antes de
  ejecutar.** Hacer **al final** del proyecto.
- **Archivos que toca:** `src/lib/subscription.ts` (predicado UX), gate de
  `appointments`, `CLAUDE.md` (docs) y comentarios relacionados.
- **Cambio concreto:**
  - Alinear el **predicado UX** de `src/lib/subscription.ts` con la lógica
    **real** de la RLS (`clinica_tiene_acceso()` / `ha_tenido_acceso_premium`).
  - Alinear el **gate de appointments** con la misma barrera real.
  - Actualizar **documentación** (`CLAUDE.md §2026-05-04` marcado como
    obsoleto y corregido, más comentarios) para que refleje que la RLS de
    bloqueo **está viva** vía etapa5.
- **Riesgo introducido:** medio por superficie (varios archivos), pero bajo
  en comportamiento de billing: es alineación UX/gate/docs con la barrera ya
  vigente, no un cambio de la barrera.
- **Dependencias:** conceptualmente después de que el webhook escriba estado
  correcto (Fases 2/3/5), para no alinear la UX contra un estado aún con
  fugas. Se ejecuta al final.
- **Criterio de terminado:** el predicado UX, el gate de appointments y la
  RLS coinciden en su veredicto para los casos representativos (free, trial,
  activo, vencido, cancelado, ex-premium con latch); la documentación ya no
  afirma que la barrera está muerta.

---

## Agrupación en deploys (commits)

- **Deploy 1:** Fase 0 + Fase 1 — base segura, bajo riesgo.
- **Deploy 2:** Fases 2 + 5 + 3 — núcleo del fix del sangrado. Van juntas
  porque comparten handler y existen dependencias entre ellas (5 y 3
  dependen de 2).
- **Deploy 3:** Fase 4 — idempotencia + migración SQL.
- **Deploy 4:** Fase 6 — alineación UX / docs.

---

## Grafo de dependencias

```
Fase 0 ──▶ Fase 1

Fase 2 ──▶ Fase 3
       └─▶ Fase 5

Fase 4  (independiente)
Fase 6  (independiente en dependencias duras; se ejecuta al final por
         orden operativo, tras 2/3/5)
```

- Fase 0 habilita Fase 1.
- Fase 2 habilita Fases 3 y 5.
- Fases 4 y 6 son independientes en dependencias duras.

---

## Tabla resumen de prioridad

| Fase | Corrige | Clase de daño |
|------|---------|---------------|
| Fase 0 | C1 | Habilitador (observabilidad) |
| Fase 1 🔴 | P4 | Fuga real (fallos de DB silenciados) |
| Fase 2 🔴 | P1, P2 | Fuga real (acceso otorgado sin pago vía RLS) |
| Fase 3 | P3, A8 | Drift (estado escrito desde invoice) |
| Fase 4 | P5 | Fuga real / duplicación (sin idempotencia) |
| Fase 5 | P6, A1, A2 | Over-blocking + drift (plan/latch/doble UPDATE) |
| Fase 6 | P8, A3, A4, A5 | Cosmético / alineación (UX/gate/docs vs RLS) |

---

## Problemas fuera de alcance / sin acción

- **P7** — `CHECK` sin `'incompleto'`. Informativo; **coherente** con la
  decisión de diseño 5 (no introducir `'incompleto'`). Sin acción.
- **A6** — falta handler `subscription.created`. Prioridad **baja**. Sin
  acción en este proyecto.
- **A7** — función huérfana documentada. Sin acción.
- **A9** — cast de `metadata.plan` sin validar. **Blindaje opcional** (se
  puede sumar a Fase 5 si se valida contra la lista de planes reales).
- **Deuda del handler super-admin VIP** — no normaliza `suscripcion_estado`
  al activar/revocar acceso VIP. **Proyecto aparte, ya registrado.** Fuera
  de alcance aquí.

---

*Fin de `BILLING_FIX_PLAN.md`.*
