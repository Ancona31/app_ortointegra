-- Migración: convertir usuarios independientes de role='medico' a role='admin'
-- Los independientes son dueños de su clínica de una persona y necesitan acceso
-- completo a billing, personalización y gestión de cuenta.
--
-- Solo afecta a profiles cuyo clinica_id apunta a una clínica tipo='independiente'
-- y tienen role='medico'. No toca clínicas multi-usuario.

UPDATE profiles
SET role = 'admin'
WHERE role = 'medico'
  AND clinica_id IN (
    SELECT id FROM clinicas WHERE tipo = 'independiente'
  );
