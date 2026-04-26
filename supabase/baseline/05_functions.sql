-- =============================================================================
-- 05_functions.sql
-- 17 funciones custom del schema public.
--
-- Cuerpos exactos según dump de Q9 (pg_get_functiondef), formateados con
-- indentación natural plpgsql/sql.
--
-- Orden de declaración: primero funciones sin dependencias, luego las que
-- dependen de otras, y al final los reportes super-admin (sa_*).
--
-- Nota: el prompt original menciona "12 funciones" pero el dump real lista
-- 17. La discrepancia se documenta en el reporte final.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Funciones helper de identidad (sin dependencias)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_clinica_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $function$
  SELECT clinica_id FROM profiles WHERE id = auth.uid()
$function$;


CREATE OR REPLACE FUNCTION public.get_my_clinica_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $function$
  SELECT clinica_id FROM profiles WHERE id = auth.uid()
$function$;


CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $function$
  SELECT role FROM profiles WHERE id = auth.uid()
$function$;


CREATE OR REPLACE FUNCTION public.get_max_pacientes()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $function$
  SELECT max_pacientes FROM clinicas WHERE id = public.get_clinica_id()
$function$;


CREATE OR REPLACE FUNCTION public.get_suscripcion_estado()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $function$
  SELECT suscripcion_estado FROM clinicas WHERE id = public.get_clinica_id()
$function$;


-- -----------------------------------------------------------------------------
-- Triggers genéricos (sin dependencias entre sí)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prevent_audit_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RAISE EXCEPTION 'El audit_log es inmutable. No se permite UPDATE ni DELETE.';
  RETURN NULL;
END;
$function$;


CREATE OR REPLACE FUNCTION public.arco_set_fecha_limite()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.fecha_limite IS NULL THEN
    NEW.fecha_limite := NEW.fecha_solicitud + INTERVAL '28 days';
  END IF;
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$function$;


CREATE OR REPLACE FUNCTION public.log_tabla_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO audit_log(user_id, accion, tabla, registro_id)
  VALUES (
    coalesce(auth.uid()::text, 'system'),
    TG_OP,
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END
  );
  RETURN coalesce(NEW, OLD);
END;
$function$;


CREATE OR REPLACE FUNCTION public.enforce_limite_documentos_paciente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count int;
BEGIN
  IF NEW.paciente_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.tipo NOT IN ('resultado_laboratorio', 'estudio_imagen') THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.documentos
  WHERE paciente_id = NEW.paciente_id
    AND tipo IN ('resultado_laboratorio', 'estudio_imagen');

  IF v_count >= 100 THEN
    RAISE EXCEPTION 'Límite de 100 documentos por paciente alcanzado (paciente_id=%)', NEW.paciente_id
      USING errcode = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;


CREATE OR REPLACE FUNCTION public.sync_antropometria_paciente(p_paciente_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_peso_medicion  numeric;
  v_talla_medicion numeric;
  v_peso_paciente  numeric;
  v_talla_paciente numeric;
  v_peso_final     numeric;
  v_talla_final    numeric;
  v_imc            numeric;
BEGIN
  IF p_paciente_id IS NULL THEN
    RETURN;
  END IF;

  SELECT m.valor INTO v_peso_medicion
  FROM mediciones_analitos m
  JOIN analitos_catalogo a ON a.id = m.analito_id
  WHERE m.paciente_id = p_paciente_id
    AND a.clave = 'peso'
  ORDER BY m.medido_en DESC
  LIMIT 1;

  SELECT m.valor INTO v_talla_medicion
  FROM mediciones_analitos m
  JOIN analitos_catalogo a ON a.id = m.analito_id
  WHERE m.paciente_id = p_paciente_id
    AND a.clave = 'talla'
  ORDER BY m.medido_en DESC
  LIMIT 1;

  SELECT peso_kg, talla_cm
    INTO v_peso_paciente, v_talla_paciente
  FROM pacientes
  WHERE id = p_paciente_id;

  v_peso_final  := coalesce(v_peso_medicion, v_peso_paciente);
  v_talla_final := coalesce(v_talla_medicion, v_talla_paciente);

  IF v_peso_final IS NOT NULL AND v_talla_final IS NOT NULL
     AND v_peso_final > 0 AND v_talla_final > 0 THEN
    v_imc := round(v_peso_final / ((v_talla_final / 100.0) * (v_talla_final / 100.0)), 1);
  END IF;

  UPDATE pacientes
     SET peso_kg    = coalesce(v_peso_medicion, peso_kg),
         talla_cm   = coalesce(v_talla_medicion, talla_cm),
         imc        = coalesce(v_imc, imc),
         updated_at = now()
   WHERE id = p_paciente_id;
END;
$function$;


CREATE OR REPLACE FUNCTION public.update_pdf_jobs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;


CREATE OR REPLACE FUNCTION public.update_plantillas_honorarios_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;


-- -----------------------------------------------------------------------------
-- Triggers con dependencia (deben declararse después de sync_antropometria_paciente)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_mediciones_antropometria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_analito_id_efectivo uuid;
  v_clave               text;
BEGIN
  v_analito_id_efectivo := coalesce(new.analito_id, old.analito_id);

  IF v_analito_id_efectivo IS NULL THEN
    RETURN coalesce(new, old);
  END IF;

  SELECT clave INTO v_clave
  FROM analitos_catalogo
  WHERE id = v_analito_id_efectivo;

  IF v_clave NOT IN ('peso', 'talla') THEN
    RETURN coalesce(new, old);
  END IF;

  IF tg_op = 'DELETE' THEN
    PERFORM public.sync_antropometria_paciente(old.paciente_id);
  ELSE
    PERFORM public.sync_antropometria_paciente(new.paciente_id);
    IF tg_op = 'UPDATE' AND old.paciente_id IS DISTINCT FROM new.paciente_id THEN
      PERFORM public.sync_antropometria_paciente(old.paciente_id);
    END IF;
  END IF;

  RETURN coalesce(new, old);
END;
$function$;


-- -----------------------------------------------------------------------------
-- Reportes super-admin (sa_*)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sa_heatmap_horarios(dias_atras integer DEFAULT 90)
RETURNS TABLE(hora integer, dia_semana integer, total bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    EXTRACT(hour FROM created_at AT TIME ZONE 'America/Mexico_City')::int AS hora,
    EXTRACT(dow  FROM created_at AT TIME ZONE 'America/Mexico_City')::int AS dia_semana,
    count(*)::bigint AS total
  FROM public.audit_log
  WHERE created_at >= now() - make_interval(days => dias_atras)
  GROUP BY hora, dia_semana
  ORDER BY hora, dia_semana
$function$;


CREATE OR REPLACE FUNCTION public.sa_ranking_funciones(limite integer DEFAULT 20)
RETURNS TABLE(accion text, total bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    al.accion::text,
    count(*)::bigint AS total
  FROM public.audit_log al
  GROUP BY al.accion
  ORDER BY total DESC
  LIMIT limite
$function$;


CREATE OR REPLACE FUNCTION public.sa_top_medicos(dias_atras integer DEFAULT 30, limite integer DEFAULT 10)
RETURNS TABLE(user_id text, nombre text, clinica_nombre text, total bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    al.user_id::text,
    COALESCE(p.nombre, '(sin perfil)')::text AS nombre,
    c.nombre::text AS clinica_nombre,
    count(*)::bigint AS total
  FROM public.audit_log al
  LEFT JOIN public.profiles p ON p.id::text = al.user_id
  LEFT JOIN public.clinicas c ON c.id = p.clinica_id
  WHERE al.created_at >= now() - make_interval(days => dias_atras)
    AND al.user_id IS NOT NULL
    AND al.user_id <> 'anonymous'
  GROUP BY al.user_id, p.nombre, c.nombre
  ORDER BY total DESC
  LIMIT limite
$function$;


CREATE OR REPLACE FUNCTION public.sa_uso_ia(dias_atras integer DEFAULT 30)
RETURNS TABLE(accion text, total bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    al.accion::text,
    count(*)::bigint AS total
  FROM public.audit_log al
  WHERE al.created_at >= now() - make_interval(days => dias_atras)
    AND (al.accion LIKE 'ia_%'
         OR al.accion IN ('generar_pdf', 'nota_generada', 'receta_generada', 'enviar_documento'))
  GROUP BY al.accion
  ORDER BY total DESC
$function$;
