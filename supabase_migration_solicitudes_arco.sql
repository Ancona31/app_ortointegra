-- ============================================================
-- Migración: tabla solicitudes_arco + funciones de dashboard
-- NOM-024-SSA3-2012 / LFPDPPP — Derechos ARCO
-- Ejecutar en Supabase SQL Editor (service role)
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. Tabla solicitudes_arco
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.solicitudes_arco (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id          uuid        NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  -- paciente_id es nullable: la solicitud puede venir del titular antes de tener expediente
  paciente_id         uuid        REFERENCES public.pacientes(id) ON DELETE RESTRICT,
  tipo                varchar(20) NOT NULL
                        CHECK (tipo IN ('acceso', 'rectificacion', 'cancelacion', 'oposicion')),
  estado              varchar(20) NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente', 'en_proceso', 'completada', 'rechazada')),
  descripcion         text,
  respuesta           text,
  -- El plazo legal LFPDPPP es 20 días hábiles (~28 días naturales).
  -- fecha_limite se calcula al insertar: fecha_solicitud + INTERVAL '28 days'.
  fecha_solicitud     timestamptz NOT NULL DEFAULT now(),
  fecha_limite        timestamptz,
  fecha_resolucion    timestamptz,
  creado_por          uuid        REFERENCES auth.users(id),
  creado_en           timestamptz NOT NULL DEFAULT now(),
  actualizado_en      timestamptz NOT NULL DEFAULT now()
);

-- Calcular fecha_limite automáticamente al insertar
CREATE OR REPLACE FUNCTION public.arco_set_fecha_limite()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.fecha_limite IS NULL THEN
    NEW.fecha_limite := NEW.fecha_solicitud + INTERVAL '28 days';
  END IF;
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_arco_fecha_limite
  BEFORE INSERT OR UPDATE ON public.solicitudes_arco
  FOR EACH ROW EXECUTE FUNCTION public.arco_set_fecha_limite();

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_arco_clinica   ON public.solicitudes_arco (clinica_id);
CREATE INDEX IF NOT EXISTS idx_arco_estado    ON public.solicitudes_arco (estado);
CREATE INDEX IF NOT EXISTS idx_arco_creado_en ON public.solicitudes_arco (creado_en DESC);

-- RLS
ALTER TABLE public.solicitudes_arco ENABLE ROW LEVEL SECURITY;

-- Solo super_admin puede leer y escribir (vía service role en las API routes)
CREATE POLICY "super_admin full access arco"
  ON public.solicitudes_arco
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ──────────────────────────────────────────────────────────────
-- 2. Funciones helper para el dashboard §4 (Uso de plataforma)
--    Llamadas vía .rpc() con service role — sin RLS.
-- ──────────────────────────────────────────────────────────────

-- 2a. Ranking de funciones: top N acciones en el audit_log
CREATE OR REPLACE FUNCTION public.sa_ranking_funciones(limite int DEFAULT 20)
RETURNS TABLE(accion text, total bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    al.accion::text,
    count(*)::bigint AS total
  FROM public.audit_log al
  GROUP BY al.accion
  ORDER BY total DESC
  LIMIT limite;
$$;

-- 2b. Heatmap horario 24×7 (últimos N días, hora local Ciudad de México)
CREATE OR REPLACE FUNCTION public.sa_heatmap_horarios(dias_atras int DEFAULT 90)
RETURNS TABLE(hora int, dia_semana int, total bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(hour  FROM created_at AT TIME ZONE 'America/Mexico_City')::int AS hora,
    EXTRACT(dow   FROM created_at AT TIME ZONE 'America/Mexico_City')::int AS dia_semana,
    count(*)::bigint                                                         AS total
  FROM public.audit_log
  WHERE created_at >= now() - make_interval(days => dias_atras)
  GROUP BY hora, dia_semana
  ORDER BY hora, dia_semana;
$$;

-- 2c. Top médicos por actividad (últimos N días)
CREATE OR REPLACE FUNCTION public.sa_top_medicos(
  dias_atras int DEFAULT 30,
  limite     int DEFAULT 10
)
RETURNS TABLE(user_id uuid, nombre text, clinica_nombre text, total bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    al.user_id,
    COALESCE(p.nombre, '(sin perfil)')::text  AS nombre,
    c.nombre::text                             AS clinica_nombre,
    count(*)::bigint                           AS total
  FROM public.audit_log al
  LEFT JOIN public.profiles p ON p.id = al.user_id
  LEFT JOIN public.clinicas  c ON c.id = p.clinica_id
  WHERE al.created_at >= now() - make_interval(days => dias_atras)
    AND al.user_id IS NOT NULL
    AND al.user_id::text <> 'anonymous'
  GROUP BY al.user_id, p.nombre, c.nombre
  ORDER BY total DESC
  LIMIT limite;
$$;

-- 2d. Uso de IA: acciones con prefijo ia_ u otras conocidas (últimos N días)
CREATE OR REPLACE FUNCTION public.sa_uso_ia(dias_atras int DEFAULT 30)
RETURNS TABLE(accion text, total bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    al.accion::text,
    count(*)::bigint AS total
  FROM public.audit_log al
  WHERE al.created_at >= now() - make_interval(days => dias_atras)
    AND (
      al.accion LIKE 'ia_%'
      OR al.accion IN ('generar_pdf', 'nota_generada', 'receta_generada', 'enviar_documento')
    )
  GROUP BY al.accion
  ORDER BY total DESC;
$$;

-- ──────────────────────────────────────────────────────────────
-- 3. Grant para el service role (usado por createAdminClient)
-- ──────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.sa_ranking_funciones(int)           TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_heatmap_horarios(int)            TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_top_medicos(int, int)            TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_uso_ia(int)                      TO service_role;
GRANT ALL ON TABLE public.solicitudes_arco                           TO service_role;
