-- F5 · ENSAYO (no es migración): la pieza común de F1 tal como la fija
-- ENCARGO-OLEADA-2 §5, para clones de ref-originales que todavía no la tienen.
-- La versión real la escribe F1 en 20261201120000; esto sólo deja probar F5.
CREATE OR REPLACE FUNCTION public.agenda_v2_encendida(p_clinica_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
  SELECT coalesce((SELECT a.agenda_v2_encendida FROM public.agenda_ajustes a
                    WHERE a.clinica_id = p_clinica_id), false)
$fn$;
REVOKE EXECUTE ON FUNCTION public.agenda_v2_encendida(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_v2_encendida(uuid) TO authenticated, service_role;
