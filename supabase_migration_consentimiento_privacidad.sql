-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  MIGRACIÓN: Consentimiento de aviso de privacidad — LFPDPPP Art. 9    ║
-- ║  Fecha: 2026-04-08                                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- La LFPDPPP exige consentimiento expreso antes de tratar datos sensibles
-- de salud. Se registra: si se otorgó, cuándo, y qué versión del aviso.
--
-- Para pacientes existentes se establece consentimiento como otorgado
-- retroactivamente para no bloquear expedientes en producción.

ALTER TABLE pacientes
  ADD COLUMN IF NOT EXISTS consentimiento_otorgado boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS fecha_consentimiento timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS version_aviso_privacidad text DEFAULT 'v1.0-2026-04-08';

-- Asegurar que pacientes existentes tengan los valores
UPDATE pacientes
  SET consentimiento_otorgado = true,
      fecha_consentimiento = COALESCE(fecha_consentimiento, now()),
      version_aviso_privacidad = COALESCE(version_aviso_privacidad, 'v1.0-2026-04-08')
  WHERE consentimiento_otorgado IS NULL
     OR fecha_consentimiento IS NULL;
