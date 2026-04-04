-- ════════════════════════════════════════════════════════
-- OrthoIntegra — Horario de consulta por clínica
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════

alter table clinicas
  add column if not exists horario_consulta jsonb not null default '{
    "lunes":     {"activo": true,  "inicio": "09:00", "fin": "19:00"},
    "martes":    {"activo": true,  "inicio": "09:00", "fin": "19:00"},
    "miercoles": {"activo": true,  "inicio": "09:00", "fin": "19:00"},
    "jueves":    {"activo": true,  "inicio": "09:00", "fin": "19:00"},
    "viernes":   {"activo": true,  "inicio": "09:00", "fin": "19:00"},
    "sabado":    {"activo": false, "inicio": "09:00", "fin": "14:00"},
    "domingo":   {"activo": false, "inicio": "09:00", "fin": "14:00"}
  }'::jsonb;
