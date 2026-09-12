-- ════════════════════════════════════════════════════════════════════
-- Billing — Paso 1: tabla de idempotencia de eventos de Stripe
-- Propuesto: 2026-07-13  ·  Aplicado a producción: 2026-07-13
-- ════════════════════════════════════════════════════════════════════
--
-- QUÉ CREA
--   1. Tabla public.stripe_webhook_events: registro de event.id de Stripe
--      ya recibidos y ackeados con éxito (HTTP 200), para dedup
--      (idempotencia at-least-once).
--   2. RLS habilitado SIN policies (deny-all a anon/authenticated;
--      el webhook usa service-role que bypassa RLS). Patrón igual a
--      ip_rate_limits.
--
-- POR QUÉ
--   Stripe entrega eventos at-least-once y puede reenviar el mismo
--   event.id. El webhook registra aquí cada event.id que ackea con 200
--   (INSERT-last, tras salir del switch sin error); un SELECT previo
--   evita reprocesar duplicados ya ackeados. Los caminos que responden
--   500 NO registran, para que Stripe reintente.

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id     text        NOT NULL,
  type         text        NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stripe_webhook_events_pkey PRIMARY KEY (event_id)
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Sin policies: RLS activo sin policy = deny-all para anon/authenticated.
-- El service-role (webhook) bypassa RLS y tiene acceso total.
