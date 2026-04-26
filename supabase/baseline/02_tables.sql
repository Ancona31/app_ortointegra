-- =============================================================================
-- 02_tables.sql
-- 20 tablas del schema public.
--
-- Sin FKs (van en 04_foreign_keys.sql para evitar problemas de orden).
-- CHECK constraints incluidas inline en CREATE TABLE.
-- Orden alfabético.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- addendums
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.addendums (
  id            uuid        NOT NULL DEFAULT uuid_generate_v4(),
  consulta_id   uuid        NOT NULL,
  contenido     text        NOT NULL,
  medico_id     uuid        NOT NULL,
  medico_nombre text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT addendums_pkey PRIMARY KEY (id)
);


-- -----------------------------------------------------------------------------
-- analitos_catalogo
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analitos_catalogo (
  id                    uuid        NOT NULL DEFAULT uuid_generate_v4(),
  clave                 text        NOT NULL,
  nombre                text        NOT NULL,
  nombres_alternativos  text[]      NOT NULL DEFAULT '{}'::text[],
  categoria             text        NOT NULL,
  unidad                text        NOT NULL,
  bands_type            text        NOT NULL,
  rango_default         jsonb,
  rango_femenino        jsonb,
  rango_masculino       jsonb,
  precision_decimales   integer     NOT NULL DEFAULT 1,
  activo                boolean     NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analitos_catalogo_pkey PRIMARY KEY (id),
  CONSTRAINT analitos_catalogo_clave_key UNIQUE (clave),
  CONSTRAINT analitos_catalogo_bands_type_check CHECK (
    bands_type = ANY (ARRAY['high-bad'::text, 'low-bad'::text, 'low-and-high-bad'::text, 'none'::text])
  ),
  CONSTRAINT analitos_catalogo_categoria_check CHECK (
    categoria = ANY (ARRAY[
      'antropometria'::text, 'signos_vitales'::text, 'hematologia'::text,
      'quimica'::text, 'hueso'::text, 'endocrino'::text, 'inmunologia'::text,
      'coagulacion'::text, 'cardiaco'::text, 'marcador_tumoral'::text,
      'vitaminas_minerales'::text, 'otros'::text
    ])
  )
);


-- -----------------------------------------------------------------------------
-- appointments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.appointments (
  id                         uuid        NOT NULL DEFAULT uuid_generate_v4(),
  clinica_id                 uuid        NOT NULL,
  paciente_id                uuid,
  created_by                 uuid,
  title                      text        NOT NULL,
  start_time                 timestamptz NOT NULL,
  end_time                   timestamptz NOT NULL,
  status                     text        NOT NULL DEFAULT 'scheduled'::text,
  notes                      text,
  google_event_id            text,
  whatsapp_sent_at           timestamptz,
  whatsapp_reminder_sent_at  timestamptz,
  created_at                 timestamptz DEFAULT now(),
  updated_at                 timestamptz DEFAULT now(),
  gcal_sync_status           text        NOT NULL DEFAULT 'synced'::text,
  medico_id                  uuid,
  client_id                  text,
  CONSTRAINT appointments_pkey PRIMARY KEY (id),
  CONSTRAINT appointments_status_check CHECK (
    status = ANY (ARRAY['scheduled'::text, 'confirmed'::text, 'cancelled'::text, 'no_show'::text])
  ),
  CONSTRAINT appointments_gcal_sync_status_check CHECK (
    gcal_sync_status = ANY (ARRAY['synced'::text, 'pending'::text, 'failed'::text])
  )
);


-- -----------------------------------------------------------------------------
-- audit_log
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          uuid        NOT NULL DEFAULT uuid_generate_v4(),
  user_id     text,
  accion      text        NOT NULL,
  tabla       text,
  registro_id uuid,
  ip          text,
  descripcion text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_log_pkey PRIMARY KEY (id)
);


-- -----------------------------------------------------------------------------
-- calculadora_resultados
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calculadora_resultados (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid(),
  paciente_id         uuid        NOT NULL,
  medico_id           uuid        NOT NULL,
  clinica_id          uuid        NOT NULL,
  calculadora_slug    text        NOT NULL,
  calculadora_nombre  text        NOT NULL,
  inputs              jsonb       NOT NULL,
  resultado           jsonb       NOT NULL,
  fecha               timestamptz NOT NULL DEFAULT now(),
  notas               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calculadora_resultados_pkey PRIMARY KEY (id)
);


-- -----------------------------------------------------------------------------
-- cat_cie10
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cat_cie10 (
  codigo      text NOT NULL,
  descripcion text NOT NULL,
  capitulo    text NOT NULL,
  CONSTRAINT cat_cie10_pkey PRIMARY KEY (codigo)
);


-- -----------------------------------------------------------------------------
-- clinicas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinicas (
  id                      uuid        NOT NULL DEFAULT gen_random_uuid(),
  nombre                  text        NOT NULL,
  logo_url                text,
  created_at              timestamptz DEFAULT now(),
  max_medicos             integer     DEFAULT 1,
  max_secretarias         integer     DEFAULT 2,
  nombre_display          text,
  subtitulo               text,
  color_primario          text        DEFAULT '#1a3a5c'::text,
  color_secundario        text        DEFAULT '#1e5fa8'::text,
  tipo                    text        NOT NULL DEFAULT 'clinica'::text,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  stripe_price_id         text,
  plan                    text        NOT NULL DEFAULT 'free'::text,
  suscripcion_estado      text        NOT NULL DEFAULT 'free'::text,
  trial_ends_at           timestamptz DEFAULT (now() + '14 days'::interval),
  suscripcion_ends_at     timestamptz,
  max_pacientes           integer     DEFAULT 15,
  horario_consulta        jsonb       NOT NULL DEFAULT '{"lunes": {"fin": "19:00", "activo": true, "inicio": "09:00"}, "jueves": {"fin": "19:00", "activo": true, "inicio": "09:00"}, "martes": {"fin": "19:00", "activo": true, "inicio": "09:00"}, "sabado": {"fin": "14:00", "activo": false, "inicio": "09:00"}, "domingo": {"fin": "14:00", "activo": false, "inicio": "09:00"}, "viernes": {"fin": "19:00", "activo": true, "inicio": "09:00"}, "miercoles": {"fin": "19:00", "activo": true, "inicio": "09:00"}}'::jsonb,
  suspendida              boolean     NOT NULL DEFAULT false,
  CONSTRAINT clinicas_pkey PRIMARY KEY (id),
  CONSTRAINT clinicas_stripe_customer_id_key UNIQUE (stripe_customer_id),
  CONSTRAINT clinicas_tipo_check CHECK (
    tipo = ANY (ARRAY['clinica'::text, 'independiente'::text])
  ),
  CONSTRAINT clinicas_plan_check CHECK (
    plan = ANY (ARRAY['free'::text, 'individual'::text, 'basica'::text, 'pro'::text, 'premium'::text])
  ),
  CONSTRAINT clinicas_suscripcion_estado_check CHECK (
    suscripcion_estado = ANY (ARRAY['free'::text, 'trial'::text, 'activo'::text, 'vencido'::text, 'cancelado'::text])
  )
);


-- -----------------------------------------------------------------------------
-- consultas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consultas (
  id                          uuid               NOT NULL DEFAULT uuid_generate_v4(),
  paciente_id                 uuid,
  fecha                       timestamptz        NOT NULL DEFAULT now(),
  motivo_consulta             text               NOT NULL,
  exploracion_fisica          text,
  diagnosticos                jsonb              DEFAULT '[]'::jsonb,
  plan_tratamiento            text,
  notas_evolucion             text,
  proxima_cita                text,
  created_at                  timestamptz        DEFAULT now(),
  medico_nombre               text,
  medico_especialidad         text,
  medico_cedula_profesional   text,
  medico_cedula_especialidad  text,
  medico_logo_url             text,
  medicamentos                jsonb              DEFAULT '[]'::jsonb,
  pronostico                  text,
  nota_origen                 character varying(10) NOT NULL DEFAULT 'ia'::character varying,
  client_id                   text,
  CONSTRAINT consultas_pkey PRIMARY KEY (id),
  CONSTRAINT consultas_nota_origen_check CHECK (
    nota_origen::text = ANY (ARRAY['ia'::character varying, 'manual'::character varying]::text[])
  )
);


-- -----------------------------------------------------------------------------
-- documentos
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documentos (
  id              uuid        NOT NULL DEFAULT uuid_generate_v4(),
  paciente_id     uuid,
  consulta_id     uuid,
  tipo            text        NOT NULL,
  contenido       jsonb       DEFAULT '{}'::jsonb,
  pdf_url         text,
  created_at      timestamptz DEFAULT now(),
  client_id       text,
  storage_bucket  text,
  storage_path    text,
  mime_type       text,
  "tamaño_bytes"  bigint,
  nombre_original text,
  subido_por      uuid,
  CONSTRAINT documentos_pkey PRIMARY KEY (id),
  CONSTRAINT documentos_tipo_check CHECK (
    tipo = ANY (ARRAY[
      'receta'::text, 'solicitud_lab'::text, 'solicitud_imagen'::text,
      'informe_clinico'::text, 'plan_suplementacion'::text, 'escrito_medico'::text,
      'solicitud_internamiento'::text, 'consentimiento_informado'::text,
      'nota_honorarios'::text, 'resultado_laboratorio'::text, 'estudio_imagen'::text
    ])
  ),
  CONSTRAINT documentos_tiene_origen_check CHECK (
    contenido IS NOT NULL OR storage_path IS NOT NULL
  )
);


-- -----------------------------------------------------------------------------
-- google_tokens
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.google_tokens (
  user_id       uuid   NOT NULL,
  access_token  text   NOT NULL,
  refresh_token text,
  expires_at    bigint,
  CONSTRAINT google_tokens_pkey PRIMARY KEY (user_id)
);


-- -----------------------------------------------------------------------------
-- invitaciones
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invitaciones (
  id          uuid        NOT NULL DEFAULT uuid_generate_v4(),
  clinica_id  uuid        NOT NULL,
  email       text        NOT NULL,
  role        text        NOT NULL,
  token       text        NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'::text),
  expires_at  timestamptz NOT NULL DEFAULT (now() + '7 days'::interval),
  used_at     timestamptz,
  created_at  timestamptz DEFAULT now(),
  CONSTRAINT invitaciones_pkey PRIMARY KEY (id),
  CONSTRAINT invitaciones_token_key UNIQUE (token),
  CONSTRAINT invitaciones_role_check CHECK (
    role = ANY (ARRAY['medico'::text, 'secretaria'::text])
  )
);


-- -----------------------------------------------------------------------------
-- ip_rate_limits
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ip_rate_limits (
  id         uuid        NOT NULL DEFAULT uuid_generate_v4(),
  ip         text        NOT NULL,
  ruta       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ip_rate_limits_pkey PRIMARY KEY (id)
);


-- -----------------------------------------------------------------------------
-- medicamentos
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medicamentos (
  id                uuid        NOT NULL DEFAULT gen_random_uuid(),
  nombre_comercial  text        NOT NULL,
  principio_activo  text        NOT NULL,
  presentacion      text        NOT NULL,
  dosis_sugerida    text        NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT medicamentos_pkey PRIMARY KEY (id)
);


-- -----------------------------------------------------------------------------
-- mediciones_analitos
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mediciones_analitos (
  id                uuid        NOT NULL DEFAULT uuid_generate_v4(),
  paciente_id       uuid        NOT NULL,
  analito_id        uuid,
  nombre_custom     text,
  unidad_custom     text,
  categoria_custom  text,
  valor             numeric     NOT NULL,
  medido_en         timestamptz NOT NULL,
  notas             text,
  creado_por        uuid        NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mediciones_analitos_pkey PRIMARY KEY (id),
  CONSTRAINT mediciones_analito_xor_custom_check CHECK (
    (analito_id IS NOT NULL AND nombre_custom IS NULL AND unidad_custom IS NULL AND categoria_custom IS NULL)
    OR
    (analito_id IS NULL AND nombre_custom IS NOT NULL AND unidad_custom IS NOT NULL AND categoria_custom IS NOT NULL)
  )
);


-- -----------------------------------------------------------------------------
-- pacientes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pacientes (
  id                        uuid          NOT NULL DEFAULT uuid_generate_v4(),
  numero_expediente         text,
  nombre                    text          NOT NULL,
  apellidos                 text          NOT NULL,
  fecha_nacimiento          date,
  sexo                      text,
  peso_kg                   numeric(5,2),
  talla_cm                  numeric(5,1),
  imc                       numeric(4,1),
  telefono                  text,
  email                     text,
  direccion                 text,
  ant_patologicos           text,
  ant_quirurgicos           text,
  ant_familiares            text,
  alergias                  text,
  medicamentos_actuales     text,
  created_at                timestamptz   DEFAULT now(),
  updated_at                timestamptz   DEFAULT now(),
  clinica_id                uuid,
  medico_id                 uuid,
  activo                    boolean       DEFAULT true,
  fecha_baja                timestamptz,
  consentimiento_otorgado   boolean       NOT NULL DEFAULT true,
  fecha_consentimiento      timestamptz   DEFAULT now(),
  version_aviso_privacidad  text          DEFAULT 'v1.0-2026-04-08'::text,
  client_id                 text,
  CONSTRAINT pacientes_pkey PRIMARY KEY (id),
  CONSTRAINT pacientes_sexo_check CHECK (
    sexo = ANY (ARRAY['M'::text, 'F'::text, 'Otro'::text])
  )
);


-- -----------------------------------------------------------------------------
-- pdf_jobs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pdf_jobs (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL,
  status        text        NOT NULL DEFAULT 'pending'::text,
  file_path     text        NOT NULL DEFAULT ''::text,
  result        jsonb,
  error_message text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  CONSTRAINT pdf_jobs_pkey PRIMARY KEY (id),
  CONSTRAINT pdf_jobs_status_check CHECK (
    status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'error'::text])
  )
);


-- -----------------------------------------------------------------------------
-- plantillas_honorarios
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plantillas_honorarios (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL,
  clinica_id  uuid        NOT NULL,
  nombre      text        NOT NULL,
  contenido   jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plantillas_honorarios_pkey PRIMARY KEY (id)
);


-- -----------------------------------------------------------------------------
-- profiles
--
-- Nota: profiles.id NO tiene DEFAULT. La columna se llena con el ID que
-- viene de auth.users cuando se crea el profile manualmente desde
-- /api/auth/registro.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id                      uuid NOT NULL,
  role                    text NOT NULL DEFAULT 'medico'::text,
  nombre                  text,
  clinica_id              uuid,
  cedula_profesional      text,
  cedula_especialidad     text,
  especialidad            text,
  titulo                  text DEFAULT 'Dr.'::text,
  direccion_consultorio   text,
  telefono_consultorio    text,
  firma_url               text,
  universidad             text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_role_check CHECK (
    role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'medico'::text, 'secretaria'::text])
  )
);


-- -----------------------------------------------------------------------------
-- rate_limits
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id         uuid        NOT NULL DEFAULT uuid_generate_v4(),
  user_id    uuid        NOT NULL,
  ruta       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rate_limits_pkey PRIMARY KEY (id)
);


-- -----------------------------------------------------------------------------
-- solicitudes_arco
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.solicitudes_arco (
  id                uuid                  NOT NULL DEFAULT gen_random_uuid(),
  clinica_id        uuid                  NOT NULL,
  paciente_id       uuid,
  tipo              character varying(20) NOT NULL,
  estado            character varying(20) NOT NULL DEFAULT 'pendiente'::character varying,
  descripcion       text,
  respuesta         text,
  fecha_solicitud   timestamptz           NOT NULL DEFAULT now(),
  fecha_limite      timestamptz,
  fecha_resolucion  timestamptz,
  creado_por        uuid,
  creado_en         timestamptz           NOT NULL DEFAULT now(),
  actualizado_en    timestamptz           NOT NULL DEFAULT now(),
  CONSTRAINT solicitudes_arco_pkey PRIMARY KEY (id),
  CONSTRAINT solicitudes_arco_tipo_check CHECK (
    tipo::text = ANY (ARRAY['acceso'::character varying, 'rectificacion'::character varying, 'cancelacion'::character varying, 'oposicion'::character varying]::text[])
  ),
  CONSTRAINT solicitudes_arco_estado_check CHECK (
    estado::text = ANY (ARRAY['pendiente'::character varying, 'en_proceso'::character varying, 'completada'::character varying, 'rechazada'::character varying]::text[])
  )
);
