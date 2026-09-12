-- ============================================================================
-- MIGRACIÓN DOCUMENTAL — NO EJECUTAR MANUALMENTE
-- ============================================================================
-- Aplicado a producción: 2026-07-21 vía SQL Editor (protocolo D-T6).
-- Este archivo refleja cambios YA vigentes en prod; existe solo para historial.
-- El ALTER TABLE usa IF NOT EXISTS, por lo que re-ejecutarlo no rompe, pero
-- NO debe correrse a ciegas.
-- Rediseño de nota de expediente (Fase 2): columna signos_vitales por consulta.
-- ============================================================================

ALTER TABLE public.consultas
  ADD COLUMN IF NOT EXISTS signos_vitales jsonb;

-- Shape esperado del jsonb (todos los campos numéricos y OPCIONALES; NULL = no capturado):
--   {
--     ta_sistolica?,   -- presión arterial sistólica (mmHg)
--     ta_diastolica?,  -- presión arterial diastólica (mmHg)
--     fc?,             -- frecuencia cardiaca (lpm)
--     fr?,             -- frecuencia respiratoria (rpm)
--     temp?,           -- temperatura (°C)
--     spo2?,           -- saturación de oxígeno (%)
--     peso_kg?,        -- peso (kg)
--     talla_cm?        -- talla (cm)
--   }

NOTIFY pgrst, 'reload schema';
