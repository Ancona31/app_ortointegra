SET local check_function_bodies = off;

CREATE SCHEMA "private";

CREATE SCHEMA "respaldos";

CREATE EXTENSION "pg_trgm" SCHEMA "public";

CREATE EXTENSION "unaccent" SCHEMA "public";

CREATE TABLE "private"."google_conexiones_secretos" (
  "conexion_id"   uuid   NOT NULL,
  "access_token"  text   NOT NULL,
  "refresh_token" text,
  "expires_at"    bigint,
  CONSTRAINT "google_conexiones_secretos_pkey" PRIMARY KEY (conexion_id)
);

CREATE TABLE "public"."addendums" (
  "id"            uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "consulta_id"   uuid                     NOT NULL,
  "contenido"     text                     NOT NULL,
  "medico_id"     uuid                     NOT NULL,
  "medico_nombre" text                     NOT NULL,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "addendums_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."addendums"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."analitos_catalogo" (
  "id"                   uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "clave"                text                     NOT NULL,
  "nombre"               text                     NOT NULL,
  "nombres_alternativos" text[]                   NOT NULL DEFAULT '{}'::text[],
  "categoria"            text                     NOT NULL,
  "unidad"               text                     NOT NULL,
  "bands_type"           text                     NOT NULL,
  "rango_default"        jsonb,
  "rango_femenino"       jsonb,
  "rango_masculino"      jsonb,
  "precision_decimales"  integer                  NOT NULL DEFAULT 1,
  "activo"               boolean                  NOT NULL DEFAULT true,
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "analitos_catalogo_bands_type_check" CHECK ((bands_type = ANY (ARRAY['high-bad'::text, 'low-bad'::text, 'low-and-high-bad'::text, 'none'::text]))),
  CONSTRAINT "analitos_catalogo_categoria_check"
    CHECK
    ((categoria = ANY (ARRAY['antropometria'::text, 'signos_vitales'::text, 'hematologia'::text, 'quimica'::text, 'hueso'::text, 'endocrino'::text, 'inmunologia'::text,
    'coagulacion'::text, 'cardiaco'::text, 'marcador_tumoral'::text, 'vitaminas_minerales'::text, 'otros'::text]))),
  CONSTRAINT "analitos_catalogo_clave_key" UNIQUE (clave),
  CONSTRAINT "analitos_catalogo_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."analitos_catalogo"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."appointments" (
  "id"                        uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "clinica_id"                uuid                     NOT NULL,
  "paciente_id"               uuid,
  "created_by"                uuid,
  "title"                     text                     NOT NULL,
  "start_time"                timestamp with time zone NOT NULL,
  "end_time"                  timestamp with time zone NOT NULL,
  "status"                    text                     NOT NULL DEFAULT 'scheduled'::text,
  "notes"                     text,
  "google_event_id"           text,
  "whatsapp_sent_at"          timestamp with time zone,
  "whatsapp_reminder_sent_at" timestamp with time zone,
  "created_at"                timestamp with time zone DEFAULT now(),
  "updated_at"                timestamp with time zone DEFAULT now(),
  "gcal_sync_status"          text                     NOT NULL DEFAULT 'synced'::text,
  "medico_id"                 uuid,
  "client_id"                 text,
  "consultorio_id"            uuid,
  "consultorio_nombre"        text,
  "consultorio_nombre_corto"  text,
  "consultorio_direccion"     text,
  "consultorio_telefono"      text,
  "consultorio_timezone"      text,
  "origen"                    text                     NOT NULL DEFAULT 'spinus'::text,
  "gcal_etag"                 text,
  "gcal_calendar_id"          text,
  "icono"                     text,
  "color"                     text,
  "all_day"                   boolean                  NOT NULL DEFAULT false,
  CONSTRAINT "appointments_all_day_medianoche_check" CHECK (((NOT all_day) OR ((consultorio_timezone IS
    NOT NULL) AND (end_time > start_time) AND (((start_time AT TIME ZONE consultorio_timezone))::time without time zone = '00:00:00'::time without time zone) AND
    (((end_time AT TIME ZONE consultorio_timezone))::time without time zone = '00:00:00'::time without time zone)))),
  CONSTRAINT "appointments_color_check"
    CHECK (((color IS NULL) OR (color = ANY (ARRAY['indigo'::text, 'magenta'::text, 'carmin'::text, 'oliva'::text, 'bronce'::text, 'grafito'::text])))),
  CONSTRAINT "appointments_consultorio_snapshot_check" CHECK (((consultorio_id IS NULL) OR (consultorio_nombre IS NOT NULL))),
  CONSTRAINT "appointments_gcal_sync_status_check" CHECK ((gcal_sync_status = ANY (ARRAY['synced'::text, 'pending'::text, 'failed'::text, 'unbound'::text]))),
  CONSTRAINT "appointments_icono_check"
    CHECK
    (((icono IS NULL) OR (icono = ANY (ARRAY['cirugia'::text, 'instrumental'::text, 'urgencias'::text, 'internamiento'::text, 'ronda'::text, 'columna'::text, 'ortopedia'::text,
    'imagen'::text,
    'ultrasonido'::text,
    'rehabilitacion'::text,
    'laboratorio'::text,
    'vacuna'::text, 'junta'::text, 'videollamada'::text, 'docencia'::text, 'congreso'::text, 'viaje'::text, 'comida'::text, 'personal'::text, 'bloqueo'::text])))),
  CONSTRAINT "appointments_origen_check" CHECK ((origen = ANY (ARRAY['spinus'::text, 'google'::text]))),
  CONSTRAINT "appointments_pkey" PRIMARY KEY (id),
  CONSTRAINT "appointments_status_check" CHECK ((status = ANY (ARRAY['scheduled'::text, 'confirmed'::text, 'cancelled'::text, 'no_show'::text, 'attended'::text])))
);

ALTER TABLE "public"."appointments"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."audit_log" (
  "id"          uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "user_id"     text,
  "accion"      text                     NOT NULL,
  "tabla"       text,
  "registro_id" uuid,
  "ip"          text,
  "descripcion" text,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "audit_log_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."audit_log"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."calculadora_resultados" (
  "id"                 uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "paciente_id"        uuid                     NOT NULL,
  "medico_id"          uuid                     NOT NULL,
  "clinica_id"         uuid                     NOT NULL,
  "calculadora_slug"   text                     NOT NULL,
  "calculadora_nombre" text                     NOT NULL,
  "inputs"             jsonb                    NOT NULL,
  "resultado"          jsonb                    NOT NULL,
  "fecha"              timestamp with time zone NOT NULL DEFAULT now(),
  "notas"              text,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "calculadora_resultados_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."calculadora_resultados"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."casos_clinicos_recursos" (
  "id"              uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "caso_id"         uuid                     NOT NULL,
  "clinica_id"      uuid                     NOT NULL,
  "storage_path"    text                     NOT NULL,
  "nombre_original" text,
  "mime_type"       text                     NOT NULL,
  "tamano_bytes"    bigint                   NOT NULL,
  "tipo"            text                     NOT NULL,
  "descripcion"     text,
  "anotaciones"     jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "orden"           integer                  NOT NULL DEFAULT 0,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "casos_clinicos_recursos_mime_type_check" CHECK ((mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text]))),
  CONSTRAINT "casos_clinicos_recursos_pkey" PRIMARY KEY (id),
  CONSTRAINT "casos_clinicos_recursos_tipo_check" CHECK ((tipo = ANY (ARRAY['foto'::text, 'radiografia'::text])))
);

ALTER TABLE "public"."casos_clinicos_recursos"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."casos_clinicos" (
  "id"                       uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "clinica_id"               uuid                     NOT NULL,
  "medico_id"                uuid                     NOT NULL,
  "paciente_id"              uuid,
  "titulo"                   text                     NOT NULL,
  "descripcion"              text,
  "tipo_caso"                text                     NOT NULL,
  "region_anatomica"         text,
  "tags"                     text[]                   NOT NULL DEFAULT '{}'::text[],
  "estado"                   text                     NOT NULL DEFAULT 'borrador'::text,
  "consentimiento_otorgado"  boolean,
  "fecha_consentimiento"     timestamp with time zone,
  "version_aviso_privacidad" text,
  "created_at"               timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"               timestamp with time zone NOT NULL DEFAULT now(),
  "activo"                   boolean                  NOT NULL DEFAULT true,
  "fecha_baja"               timestamp with time zone,
  CONSTRAINT "casos_clinicos_estado_check" CHECK ((estado = ANY (ARRAY['borrador'::text, 'listo'::text]))),
  CONSTRAINT "casos_clinicos_pkey" PRIMARY KEY (id),
  CONSTRAINT "casos_clinicos_tipo_caso_check"
    CHECK ((tipo_caso = ANY (ARRAY['pre_post_operatorio'::text, 'documental'::text, 'evolucion_clinica'::text, 'educativo'::text, 'diagnostico_imagen'::text])))
);

ALTER TABLE "public"."casos_clinicos"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."cat_cie10" (
  "codigo"      text NOT NULL,
  "descripcion" text NOT NULL,
  "capitulo"    text NOT NULL,
  CONSTRAINT "cat_cie10_pkey" PRIMARY KEY (codigo)
);

ALTER TABLE "public"."cat_cie10"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."clinica_conexiones_google" (
  "id"                   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "clinica_id"           uuid                     NOT NULL,
  "user_id"              uuid                     NOT NULL,
  "rol"                  text                     NOT NULL,
  "google_account_sub"   text,
  "google_account_email" text,
  "calendar_id"          text,
  "estado"               text                     NOT NULL DEFAULT 'activa'::text,
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"           timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "clinica_conexiones_google_estado_check" CHECK ((estado = ANY (ARRAY['activa'::text, 'revocada'::text]))),
  CONSTRAINT "clinica_conexiones_google_pkey" PRIMARY KEY (id),
  CONSTRAINT "clinica_conexiones_google_rol_check" CHECK ((rol = ANY (ARRAY['clinica'::text, 'personal'::text])))
);

ALTER TABLE "public"."clinica_conexiones_google"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."clinicas" (
  "id"                       uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "nombre"                   text                     NOT NULL,
  "logo_url"                 text,
  "created_at"               timestamp with time zone DEFAULT now(),
  "max_medicos"              integer                  DEFAULT 1,
  "max_secretarias"          integer                  DEFAULT 2,
  "nombre_display"           text,
  "subtitulo"                text,
  "color_primario"           text                     DEFAULT '#1a3a5c'::text,
  "color_secundario"         text                     DEFAULT '#1e5fa8'::text,
  "tipo"                     text                     NOT NULL DEFAULT 'clinica'::text,
  "stripe_customer_id"       text,
  "stripe_subscription_id"   text,
  "stripe_price_id"          text,
  "plan"                     text                     NOT NULL DEFAULT 'free'::text,
  "suscripcion_estado"       text                     NOT NULL DEFAULT 'free'::text,
  "trial_ends_at"            timestamp with time zone DEFAULT (now() + '14 days'::interval),
  "suscripcion_ends_at"      timestamp with time zone,
  "max_pacientes"            integer                  DEFAULT 5,
  "horario_consulta"         jsonb
    NOT NULL DEFAULT
    '{"lunes": {"fin": "19:00", "activo": true, "inicio": "09:00"}, "jueves": {"fin": "19:00", "activo": true, "inicio": "09:00"}, "martes": {"fin": "19:00", "activo": true, "inicio": "09:00"}, "sabado": {"fin": "14:00", "activo": false, "inicio": "09:00"}, "domingo": {"fin": "14:00", "activo": false, "inicio": "09:00"}, "viernes": {"fin": "19:00", "activo": true, "inicio": "09:00"}, "miercoles": {"fin": "19:00", "activo": true, "inicio": "09:00"}}'::jsonb,
  "suspendida"               boolean                  NOT NULL DEFAULT false,
  "es_vip_grant"             boolean                  NOT NULL DEFAULT false,
  "ha_tenido_acceso_premium" boolean                  NOT NULL DEFAULT false,
  CONSTRAINT "clinicas_pkey" PRIMARY KEY (id),
  CONSTRAINT "clinicas_plan_check" CHECK ((plan = ANY (ARRAY['free'::text, 'individual'::text, 'basica'::text, 'pro'::text, 'premium'::text]))),
  CONSTRAINT "clinicas_stripe_customer_id_key" UNIQUE (stripe_customer_id),
  CONSTRAINT "clinicas_suscripcion_estado_check" CHECK ((suscripcion_estado = ANY (ARRAY['free'::text, 'trial'::text, 'activo'::text, 'vencido'::text, 'cancelado'::text]))),
  CONSTRAINT "clinicas_tipo_check" CHECK ((tipo = ANY (ARRAY['clinica'::text, 'independiente'::text])))
);

ALTER TABLE "public"."clinicas"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."consultas" (
  "id"                         uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "paciente_id"                uuid,
  "fecha"                      timestamp with time zone NOT NULL DEFAULT now(),
  "motivo_consulta"            text                     NOT NULL,
  "exploracion_fisica"         text,
  "diagnosticos"               jsonb                    DEFAULT '[]'::jsonb,
  "plan_tratamiento"           text,
  "notas_evolucion"            text,
  "proxima_cita"               text,
  "created_at"                 timestamp with time zone DEFAULT now(),
  "medico_nombre"              text,
  "medico_especialidad"        text,
  "medico_cedula_profesional"  text,
  "medico_cedula_especialidad" text,
  "medico_logo_url"            text,
  "medicamentos"               jsonb                    DEFAULT '[]'::jsonb,
  "pronostico"                 text,
  "nota_origen"                character varying(10)    NOT NULL DEFAULT 'ia'::character varying,
  "client_id"                  text,
  "medico_id"                  uuid,
  "consultorio_id"             uuid,
  "consultorio_nombre"         text,
  "consultorio_nombre_corto"   text,
  "consultorio_direccion"      text,
  "consultorio_telefono"       text,
  "consultorio_timezone"       text,
  "signos_vitales"             jsonb,
  "appointment_id"             uuid,
  CONSTRAINT "consultas_consultorio_snapshot_check" CHECK (((consultorio_id IS NULL) OR (consultorio_nombre IS NOT NULL))),
  CONSTRAINT "consultas_nota_origen_check" CHECK (((nota_origen)::text = ANY ((ARRAY['ia'::character varying, 'manual'::character varying])::text[]))),
  CONSTRAINT "consultas_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."consultas"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."consultorios" (
  "id"           uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "clinica_id"   uuid                     NOT NULL,
  "medico_id"    uuid                     NOT NULL,
  "nombre"       text                     NOT NULL,
  "nombre_corto" text                     NOT NULL,
  "direccion"    text                     NOT NULL,
  "telefono"     text,
  "timezone"     text                     NOT NULL DEFAULT 'America/Mexico_City'::text,
  "horario"      jsonb
    NOT NULL DEFAULT
    '{"lunes": {"fin": "19:00", "activo": false, "inicio": "09:00"}, "jueves": {"fin": "19:00", "activo": false, "inicio": "09:00"}, "martes": {"fin": "19:00", "activo": false, "inicio": "09:00"}, "sabado": {"fin": "14:00", "activo": false, "inicio": "09:00"}, "domingo": {"fin": "14:00", "activo": false, "inicio": "09:00"}, "viernes": {"fin": "19:00", "activo": false, "inicio": "09:00"}, "miercoles": {"fin": "19:00", "activo": false, "inicio": "09:00"}}'::jsonb,
  "es_default"   boolean                  NOT NULL DEFAULT false,
  "activo"       boolean                  NOT NULL DEFAULT true,
  "fecha_baja"   timestamp with time zone,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "consultorios_nombre_corto_check" CHECK (((char_length(nombre_corto) >= 1) AND (char_length(nombre_corto) <= 12))),
  CONSTRAINT "consultorios_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."consultorios"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."documentos" (
  "id"              uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "paciente_id"     uuid,
  "consulta_id"     uuid,
  "tipo"            text                     NOT NULL,
  "contenido"       jsonb                    DEFAULT '{}'::jsonb,
  "pdf_url"         text,
  "created_at"      timestamp with time zone DEFAULT now(),
  "client_id"       text,
  "storage_bucket"  text,
  "storage_path"    text,
  "mime_type"       text,
  "tamaño_bytes"    bigint,
  "nombre_original" text,
  "subido_por"      uuid,
  "formato_version" integer                  NOT NULL DEFAULT 1,
  "folio"           text,
  "estado"          text                     NOT NULL DEFAULT 'emitido_firma_manual'::text,
  CONSTRAINT "documentos_estado_check" CHECK ((estado = ANY (ARRAY['borrador'::text, 'emitido_firma_manual'::text, 'firmado'::text]))),
  CONSTRAINT "documentos_folio_formato_check" CHECK (((folio IS NULL) OR (folio ~ '^(RX|NOH|COT|CI|LAB|IMG|SUP|INT|DEN)-[0-9]{4}-[0-9]{4,}$'::text))),
  CONSTRAINT "documentos_formato_version_check" CHECK ((formato_version = ANY (ARRAY[1, 2]))),
  CONSTRAINT "documentos_pkey" PRIMARY KEY (id),
  CONSTRAINT "documentos_tiene_origen_check" CHECK (((contenido IS NOT NULL) OR (storage_path IS NOT NULL))),
  CONSTRAINT "documentos_tipo_check"
    CHECK
    ((tipo = ANY (ARRAY['receta'::text, 'solicitud_lab'::text, 'solicitud_imagen'::text, 'informe_clinico'::text, 'plan_suplementacion'::text, 'escrito_medico'::text,
    'solicitud_internamiento'::text,
    'consentimiento_informado'::text, 'denegacion_consentimiento'::text, 'nota_honorarios'::text, 'resultado_laboratorio'::text, 'estudio_imagen'::text])))
);

ALTER TABLE "public"."documentos"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."firmas_documento" (
  "id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "documento_id"        uuid                     NOT NULL,
  "rol"                 text                     NOT NULL,
  "trazo"               text,
  "firmado_en"          timestamp with time zone NOT NULL,
  "firmado_en_servidor" timestamp with time zone NOT NULL DEFAULT now(),
  "dispositivo"         text,
  "huella"              text                     NOT NULL,
  "identificacion_path" text,
  "creado_por"          uuid                     NOT NULL,
  CONSTRAINT "firmas_documento_identificacion_check" CHECK (((identificacion_path IS NULL) OR (btrim(identificacion_path) <> ''::text))),
  CONSTRAINT "firmas_documento_pkey" PRIMARY KEY (id),
  CONSTRAINT "firmas_documento_reloj_check" CHECK (((firmado_en > '2000-01-01 00:00:00+00'::timestamp
    with time zone) AND (firmado_en < (firmado_en_servidor + '1 day'::interval)))),
  CONSTRAINT "firmas_documento_rol_check" CHECK ((rol = ANY (ARRAY['medico'::text, 'paciente'::text, 'familiar'::text, 'testigo_1'::text, 'testigo_2'::text]))),
  CONSTRAINT "firmas_documento_trazo_check"
    CHECK (((rol = 'medico'::text) OR ((trazo ~ '^data:image/(png|jpeg);base64,'::text) AND ((length(trazo) >= 100) AND (length(trazo) <= 300000)))))
);

ALTER TABLE "public"."firmas_documento"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."folios_contador" (
  "clase"  text     NOT NULL,
  "anio"   smallint NOT NULL,
  "ultimo" integer  NOT NULL DEFAULT 0,
  CONSTRAINT "folios_contador_clase_check"
    CHECK ((clase = ANY (ARRAY['rx'::text, 'noh'::text, 'cot'::text, 'ci'::text, 'lab'::text, 'img'::text, 'sup'::text, 'int'::text, 'den'::text]))),
  CONSTRAINT "folios_contador_pkey" PRIMARY KEY (clase, anio),
  CONSTRAINT "folios_contador_ultimo_check" CHECK ((ultimo >= 0))
);

ALTER TABLE "public"."folios_contador"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."google_tokens" (
  "user_id"       uuid   NOT NULL,
  "access_token"  text   NOT NULL,
  "refresh_token" text,
  "expires_at"    bigint,
  "calendar_id"   text,
  CONSTRAINT "google_tokens_pkey" PRIMARY KEY (user_id)
);

ALTER TABLE "public"."google_tokens"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."invitaciones" (
  "id"         uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "clinica_id" uuid                     NOT NULL,
  "email"      text                     NOT NULL,
  "role"       text                     NOT NULL,
  "token"      text                     NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'::text),
  "expires_at" timestamp with time zone NOT NULL DEFAULT (now() + '7 days'::interval),
  "used_at"    timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "invitaciones_pkey" PRIMARY KEY (id),
  CONSTRAINT "invitaciones_role_check" CHECK ((role = ANY (ARRAY['medico'::text, 'secretaria'::text]))),
  CONSTRAINT "invitaciones_token_key" UNIQUE (token)
);

ALTER TABLE "public"."invitaciones"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."ip_rate_limits" (
  "id"         uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "ip"         text                     NOT NULL,
  "ruta"       text                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "ip_rate_limits_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."ip_rate_limits"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."medicamentos" (
  "id"               uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "nombre_comercial" text                     NOT NULL,
  "principio_activo" text                     NOT NULL,
  "presentacion"     text                     NOT NULL,
  "dosis_sugerida"   text                     NOT NULL,
  "created_at"       timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "medicamentos_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."medicamentos"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."mediciones_analitos" (
  "id"               uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "paciente_id"      uuid                     NOT NULL,
  "analito_id"       uuid,
  "nombre_custom"    text,
  "unidad_custom"    text,
  "categoria_custom" text,
  "valor"            numeric                  NOT NULL,
  "medido_en"        timestamp with time zone NOT NULL,
  "notas"            text,
  "creado_por"       uuid                     NOT NULL,
  "created_at"       timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "mediciones_analito_xor_custom_check" CHECK ((((analito_id IS
    NOT NULL) AND (nombre_custom IS NULL) AND (unidad_custom IS NULL) AND (categoria_custom IS NULL)) OR ((analito_id IS NULL) AND (nombre_custom IS NOT NULL) AND (unidad_custom IS
    NOT NULL) AND (categoria_custom IS NOT NULL)))),
  CONSTRAINT "mediciones_analitos_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."mediciones_analitos"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."paciente_medico" (
  "paciente_id"  uuid                     NOT NULL,
  "medico_id"    uuid                     NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "asignado_por" uuid,
  CONSTRAINT "paciente_medico_pkey" PRIMARY KEY (paciente_id, medico_id)
);

ALTER TABLE "public"."paciente_medico"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."pacientes" (
  "id"                       uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "numero_expediente"        text,
  "nombre"                   text                     NOT NULL,
  "apellidos"                text                     NOT NULL,
  "fecha_nacimiento"         date,
  "sexo"                     text,
  "peso_kg"                  numeric(5,2),
  "talla_cm"                 numeric(5,1),
  "imc"                      numeric(4,1),
  "telefono"                 text,
  "email"                    text,
  "direccion"                text,
  "ant_patologicos"          text,
  "ant_quirurgicos"          text,
  "ant_familiares"           text,
  "alergias"                 text,
  "medicamentos_actuales"    text,
  "created_at"               timestamp with time zone DEFAULT now(),
  "updated_at"               timestamp with time zone DEFAULT now(),
  "clinica_id"               uuid,
  "medico_id"                uuid,
  "activo"                   boolean                  DEFAULT true,
  "fecha_baja"               timestamp with time zone,
  "consentimiento_otorgado"  boolean                  NOT NULL DEFAULT true,
  "fecha_consentimiento"     timestamp with time zone DEFAULT now(),
  "version_aviso_privacidad" text                     DEFAULT 'v1.0-2026-04-08'::text,
  "ant_no_patologicos"       text,
  CONSTRAINT "pacientes_pkey" PRIMARY KEY (id),
  CONSTRAINT "pacientes_sexo_check" CHECK ((sexo = ANY (ARRAY['M'::text, 'F'::text, 'Otro'::text])))
);

ALTER TABLE "public"."pacientes"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."pdf_jobs" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"       uuid                     NOT NULL,
  "status"        text                     NOT NULL DEFAULT 'pending'::text,
  "file_path"     text                     NOT NULL DEFAULT ''::text,
  "result"        jsonb,
  "error_message" text,
  "created_at"    timestamp with time zone DEFAULT now(),
  "updated_at"    timestamp with time zone DEFAULT now(),
  CONSTRAINT "pdf_jobs_pkey" PRIMARY KEY (id),
  CONSTRAINT "pdf_jobs_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'error'::text])))
);

ALTER TABLE "public"."pdf_jobs"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."plantillas_documento" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    uuid                     NOT NULL,
  "tipo"       text                     NOT NULL,
  "nombre"     text                     NOT NULL,
  "contenido"  jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "plantillas_documento_nombre_check" CHECK (((btrim(nombre) <> ''::text) AND (length(nombre) <= 60))),
  CONSTRAINT "plantillas_documento_pkey" PRIMARY KEY (id),
  CONSTRAINT "plantillas_documento_tipo_check"
    CHECK
    ((tipo = ANY (ARRAY['receta'::text, 'solicitud_lab'::text, 'solicitud_imagen'::text, 'plan_suplementacion'::text, 'solicitud_internamiento'::text, 'escrito_medico'::text,
    'consentimiento_informado'::text, 'nota_honorarios'::text])))
);

ALTER TABLE "public"."plantillas_documento"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."plantillas_honorarios" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    uuid                     NOT NULL,
  "clinica_id" uuid                     NOT NULL,
  "nombre"     text                     NOT NULL,
  "contenido"  jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "plantillas_honorarios_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."plantillas_honorarios"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."profiles" (
  "id"                    uuid    NOT NULL,
  "role"                  text    NOT NULL DEFAULT 'medico'::text,
  "clinica_id"            uuid,
  "cedula_profesional"    text,
  "cedula_especialidad"   text,
  "especialidad"          text,
  "titulo"                text    DEFAULT 'Dr.'::text,
  "direccion_consultorio" text,
  "telefono_consultorio"  text,
  "firma_url"             text,
  "universidad"           text,
  "es_admin_de_clinica"   boolean NOT NULL DEFAULT false,
  "nombres"               text,
  "apellido_paterno"      text,
  "apellido_materno"      text,
  "nombre_confirmado"     boolean NOT NULL DEFAULT false,
  "usa_documentos_v2"     boolean NOT NULL DEFAULT false,
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id),
  CONSTRAINT "profiles_role_check" CHECK ((role = ANY (ARRAY['super_admin'::text, 'medico'::text, 'secretaria'::text])))
);

ALTER TABLE "public"."profiles"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."rate_limits" (
  "id"         uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "user_id"    uuid                     NOT NULL,
  "ruta"       text                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "rate_limits_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."rate_limits"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."solicitudes_arco" (
  "id"               uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "clinica_id"       uuid                     NOT NULL,
  "paciente_id"      uuid,
  "tipo"             character varying(20)    NOT NULL,
  "estado"           character varying(20)    NOT NULL DEFAULT 'pendiente'::character varying,
  "descripcion"      text,
  "respuesta"        text,
  "fecha_solicitud"  timestamp with time zone NOT NULL DEFAULT now(),
  "fecha_limite"     timestamp with time zone,
  "fecha_resolucion" timestamp with time zone,
  "creado_por"       uuid,
  "creado_en"        timestamp with time zone NOT NULL DEFAULT now(),
  "actualizado_en"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "solicitudes_arco_estado_check"
    CHECK
    (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'en_proceso'::character varying, 'completada'::character varying, 'rechazada'::character varying])::text[]))),
  CONSTRAINT "solicitudes_arco_pkey" PRIMARY KEY (id),
  CONSTRAINT "solicitudes_arco_tipo_check"
    CHECK
    (((tipo)::text = ANY ((ARRAY['acceso'::character varying, 'rectificacion'::character varying, 'cancelacion'::character varying, 'oposicion'::character varying])::text[])))
);

ALTER TABLE "public"."solicitudes_arco"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."stripe_webhook_events" (
  "event_id"     text                     NOT NULL,
  "type"         text                     NOT NULL,
  "processed_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY (event_id)
);

ALTER TABLE "public"."stripe_webhook_events"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "respaldos"."appointments_gcal_20260815" (
  "id"               uuid,
  "clinica_id"       uuid,
  "medico_id"        uuid,
  "google_event_id"  text,
  "gcal_sync_status" text,
  "start_time"       timestamp with time zone,
  "respaldado_en"    timestamp with time zone
);

CREATE OR REPLACE FUNCTION public.alta_conexion_google (
  p_clinica_id           uuid,
  p_user_id              uuid,
  p_rol                  text,
  p_google_account_sub   text,
  p_google_account_email text,
  p_access               text,
  p_refresh              text,
  p_expires              bigint
)
  RETURNS TABLE (
    conexion_id uuid,
    calendar_id text,
    rol         text,
    estado      text
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
-- Los nombres de salida (rol, estado, calendar_id, conexion_id) coinciden con
-- columnas de las tablas. Todo va calificado por alias, y esta directiva es el
-- cinturón: ante la duda, el identificador es la COLUMNA y no la variable.
#variable_conflict use_column
DECLARE
  v_id         uuid;
  v_constraint text;
BEGIN
  -- ── Guardas, ANTES de escribir nada. El orden importa. ────────────────────

  -- 1. Aislamiento entre clínicas en el camino de escritura: sin esto, un par
  --    (clínica, usuario) mal formado crea una conexión de la clínica A a
  --    nombre de un usuario de la B.
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = p_user_id AND p.clinica_id = p_clinica_id
  ) THEN
    RAISE EXCEPTION 'perfil_ajeno_a_clinica'
      USING DETAIL = 'El usuario no tiene perfil en esa clínica; no se puede colgar de ella una conexión de Google.';
  END IF;

  -- 2. El índice único es por user_id y NO es parcial
  --    (clinica_conexiones_google_user_id_uniq). Sin esta guarda, el
  --    ON CONFLICT (user_id) DO UPDATE de abajo actualizaría la fila de la OTRA
  --    clínica y devolvería SU id — y el llamador escribiría los secretos
  --    dentro de la conexión ajena. El traslado exige desconectar primero.
  IF EXISTS (
    SELECT 1 FROM public.clinica_conexiones_google c
     WHERE c.user_id = p_user_id AND c.clinica_id <> p_clinica_id
  ) THEN
    RAISE EXCEPTION 'conexion_de_otra_clinica'
      USING DETAIL = 'Ese usuario ya tiene conexión en otra clínica. Desconéctala antes de darla de alta aquí.';
  END IF;

  -- 3. La comprobación amable. El guardián de verdad es el índice único
  --    parcial clinica_conexiones_google_una_por_clinica, que sigue puesto
  --    para la carrera; el EXCEPTION de abajo reetiqueta su 23505 con este
  --    mismo nombre para que el callback tenga UN SOLO literal que reconocer.
  IF p_rol = 'clinica' AND EXISTS (
    SELECT 1 FROM public.clinica_conexiones_google c
     WHERE c.clinica_id = p_clinica_id
       AND c.rol        = 'clinica'
       AND c.user_id   <> p_user_id
  ) THEN
    RAISE EXCEPTION 'clinica_ya_conectada'
      USING DETAIL = 'Esa clínica ya tiene otra cuenta de Google como conexión de clínica. El relevo es un flujo consciente.';
  END IF;

  -- 4. El `ON CONFLICT … DO UPDATE` de abajo NO toca `rol`, a propósito:
  --    reconectar no promueve ni degrada. Pero entonces pedir un `rol` distinto
  --    del que la fila ya tiene es un NO-OP, y callado es peligroso.
  --
  --    EL CASO ES EL RELEVO DE ADMINISTRADOR, y termina con la clínica muda:
  --    B tiene una conexión 'personal'; se retira la de A; B reconecta pidiendo
  --    'clinica'; la guarda 3 pasa porque ya no hay otra 'clinica'; el upsert
  --    reactiva su fila y la deja en 'personal'. La clínica se queda con CERO
  --    conexiones de clínica, `resolverConexionClinica` devuelve null, las citas
  --    dejan de llegar a Google, y el único aviso sería un «desconectado» que el
  --    médico acaba de contradecir conectando.
  --
  --    Se cubre en las dos direcciones: promover y degradar son igual de no-op.
  IF EXISTS (
    SELECT 1 FROM public.clinica_conexiones_google c
     WHERE c.user_id = p_user_id AND c.rol <> p_rol
  ) THEN
    RAISE EXCEPTION 'rol_no_promovido'
      USING DETAIL = 'Esa conexión ya existe con otro rol, y reconectar no lo cambia. Cambiar el rol es una operación aparte y explícita, no un efecto colateral del botón de conectar.';
  END IF;

  -- 5. La columna es NOT NULL; sin esta guarda el fallo sería un 23502 opaco
  --    llegando desde dentro de after(), donde el error se traga.
  IF p_access IS NULL THEN
    RAISE EXCEPTION 'access_token_nulo'
      USING DETAIL = 'No se da de alta una conexión sin access_token.';
  END IF;

  -- ── Escritura, en la misma transacción ────────────────────────────────────
  BEGIN
    INSERT INTO public.clinica_conexiones_google AS c
      (clinica_id, user_id, rol, google_account_sub, google_account_email, estado)
    VALUES
      (p_clinica_id, p_user_id, p_rol, p_google_account_sub, p_google_account_email, 'activa')
    ON CONFLICT (user_id) DO UPDATE SET
      -- Reconectar reactiva…
      estado               = 'activa',
      -- …y NADA MÁS que pueda destruir. COALESCE por la misma razón que el
      -- refresh_token en 3.2: hoy estos dos llegan NULL porque los scopes
      -- openid/email todavía no se piden, y NULL significa «no lo sé», nunca
      -- «bórralo» (lo dice el propio COMMENT de la columna).
      google_account_sub   = COALESCE(EXCLUDED.google_account_sub,   c.google_account_sub),
      google_account_email = COALESCE(EXCLUDED.google_account_email, c.google_account_email)
      -- NO se toca `calendar_id`: reconectar no debe crear un segundo
      --   calendario ni huerfanar el anterior (la invariante que el callback
      --   ya protege hoy, callback/route.ts:85-95).
      -- NO se toca `rol`: reconectar no promueve ni degrada.
      -- NO se toca `clinica_id`: lo cubre la guarda 2.
    RETURNING c.id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint = 'clinica_conexiones_google_una_por_clinica' THEN
      RAISE EXCEPTION 'clinica_ya_conectada'
        USING DETAIL = 'Carrera contra el índice único parcial: otra cuenta acaba de quedarse con la conexión de clínica.';
    END IF;
    RAISE;
  END;

  INSERT INTO private.google_conexiones_secretos AS s
    (conexion_id, access_token, refresh_token, expires_at)
  VALUES
    (v_id, p_access, p_refresh, p_expires)
  ON CONFLICT (conexion_id) DO UPDATE SET
    access_token  = EXCLUDED.access_token,
    refresh_token = COALESCE(EXCLUDED.refresh_token, s.refresh_token),
    expires_at    = EXCLUDED.expires_at;

  RETURN QUERY
    SELECT c.id, c.calendar_id, c.rol, c.estado
      FROM public.clinica_conexiones_google c
     WHERE c.id = v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.arco_set_fecha_limite()
  RETURNS TRIGGER
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

CREATE OR REPLACE FUNCTION public.asignar_folio_documento()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
DECLARE
  v_clase text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_clase := CASE NEW.tipo
    WHEN 'receta'                    THEN 'rx'
    WHEN 'consentimiento_informado'  THEN 'ci'
    WHEN 'denegacion_consentimiento' THEN 'den'
    WHEN 'solicitud_lab'             THEN 'lab'
    WHEN 'solicitud_imagen'          THEN 'img'
    WHEN 'plan_suplementacion'       THEN 'sup'
    WHEN 'solicitud_internamiento'   THEN 'int'
    WHEN 'nota_honorarios'           THEN
      CASE COALESCE(NEW.contenido->>'tipo_doc', NEW.contenido->>'tipoDoc')
        WHEN 'cotizacion' THEN 'cot'
        ELSE 'noh'
      END
  END;

  IF TG_OP = 'UPDATE' THEN

    IF OLD.estado IS DISTINCT FROM NEW.estado THEN
      IF OLD.estado <> 'borrador' THEN
        RAISE EXCEPTION 'Un documento % ya no cambia de estado', OLD.estado
          USING HINT = 'emitido_firma_manual y firmado son terminales; emite un documento nuevo';
      END IF;
      IF NEW.estado NOT IN ('emitido_firma_manual', 'firmado') THEN
        RAISE EXCEPTION 'Transición de estado no válida: % → %', OLD.estado, NEW.estado;
      END IF;
    END IF;

    IF OLD.estado = 'borrador' AND NEW.estado <> 'borrador' THEN

      IF NEW.folio IS DISTINCT FROM OLD.folio THEN
        RAISE EXCEPTION 'El folio lo asigna la base, no el cliente';
      END IF;

      IF NEW.folio IS NULL AND v_clase IS NOT NULL THEN
        NEW.folio := public.generar_folio(v_clase);
      END IF;

      RETURN NEW;
    END IF;

    IF NEW.folio IS DISTINCT FROM OLD.folio THEN
      RAISE EXCEPTION 'El folio de un documento emitido es inmutable';
    END IF;

    IF NEW.formato_version IS DISTINCT FROM OLD.formato_version THEN
      RAISE EXCEPTION 'La versión de formato de un documento emitido es inmutable'
        USING HINT = 'dice con qué chasis se compuso el papel: cambiarla haría que la reimpresión no coincidiera con el original';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.folio IS NOT NULL THEN
    RAISE EXCEPTION 'El folio lo asigna la base, no el cliente';
  END IF;

  IF NEW.estado = 'borrador' THEN
    RETURN NEW;
  END IF;

  IF v_clase IS NOT NULL THEN
    NEW.folio := public.generar_folio(v_clase);
  END IF;

  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.clinica_dentro_de_limite()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
    SELECT EXISTS (
      SELECT 1 FROM public.clinicas c
      WHERE c.id = public.get_clinica_id()
        AND (
          c.es_vip_grant IS TRUE
          OR (c.stripe_subscription_id IS NOT NULL
              AND c.suscripcion_estado = 'activo')
          OR (
            SELECT count(*) FROM public.pacientes p
            WHERE p.clinica_id = c.id
          ) < COALESCE(c.max_pacientes, 5)
        )
    );
  $function$;

CREATE OR REPLACE FUNCTION public.clinica_no_suspendida()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
    SELECT COALESCE(
      (SELECT NOT c.suspendida
       FROM public.clinicas c
       WHERE c.id = public.get_clinica_id()),
      false
    );
  $function$;

CREATE OR REPLACE FUNCTION public.clinica_tiene_acceso()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
    SELECT EXISTS (
      SELECT 1 FROM public.clinicas c
      WHERE c.id = public.get_clinica_id()
        AND (
          c.es_vip_grant IS TRUE
          OR (c.stripe_subscription_id IS NOT NULL
              AND c.suscripcion_estado = 'activo')
          OR c.ha_tenido_acceso_premium IS NOT TRUE
        )
    );
  $function$;

CREATE OR REPLACE FUNCTION public.clinicas_latch_premium()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public', 'pg_temp'
  AS $function$
  BEGIN
    -- Disparadores del latch: VIP o suscripcion de pago Stripe.
    IF NEW.es_vip_grant IS TRUE
       OR NEW.stripe_subscription_id IS NOT NULL THEN
      NEW.ha_tenido_acceso_premium := true;
    END IF;

    -- Preservar el one-way: si ya era true, nunca vuelve a false.
    IF TG_OP = 'UPDATE' THEN
      IF OLD.ha_tenido_acceso_premium IS TRUE THEN
        NEW.ha_tenido_acceso_premium := true;
      END IF;
    END IF;

    RETURN NEW;
  END;
  $function$;

CREATE OR REPLACE FUNCTION public.crear_paciente_con_medico (
  p_datos     jsonb,
  p_medico_id uuid
)
  RETURNS TABLE (
    id                uuid,
    numero_expediente text
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
DECLARE
  v_uid          uuid := auth.uid();
  v_rol          text;
  v_clinica_id   uuid;
  v_es_admin     boolean;
  v_medico_rol   text;
  v_medico_clin  uuid;
  v_anio         text := to_char(now(), 'YYYY');
  v_correlativo  int;
  v_num_exp      text;
  v_nuevo_id     uuid;
BEGIN
  -- PASO 1 — validar quién llama
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
  END IF;
  SELECT pr.role, pr.clinica_id, pr.es_admin_de_clinica
    INTO v_rol, v_clinica_id, v_es_admin
  FROM public.profiles pr WHERE pr.id = v_uid;
  IF v_clinica_id IS NULL THEN
    RAISE EXCEPTION 'El usuario no tiene clinica asignada.' USING ERRCODE = '42501';
  END IF;
  IF v_rol NOT IN ('medico','secretaria') THEN
    RAISE EXCEPTION 'El rol % no puede crear pacientes.', v_rol USING ERRCODE = '42501';
  END IF;

  -- PASO 2 — validar el médico objetivo
  IF p_medico_id IS NULL THEN
    RAISE EXCEPTION 'Debe especificarse el medico tratante.' USING ERRCODE = '42501';
  END IF;
  SELECT pr.role, pr.clinica_id INTO v_medico_rol, v_medico_clin
  FROM public.profiles pr WHERE pr.id = p_medico_id;
  IF v_medico_rol IS NULL THEN
    RAISE EXCEPTION 'El medico especificado no existe.' USING ERRCODE = '42501';
  END IF;
  IF v_medico_rol <> 'medico' THEN
    RAISE EXCEPTION 'El usuario asignado no es un medico.' USING ERRCODE = '42501';
  END IF;
  IF v_medico_clin IS DISTINCT FROM v_clinica_id THEN
    RAISE EXCEPTION 'El medico no pertenece a la clinica del usuario.' USING ERRCODE = '42501';
  END IF;
  IF v_rol = 'medico' AND v_es_admin IS NOT TRUE AND p_medico_id <> v_uid THEN
    RAISE EXCEPTION 'Un medico invitado solo puede asignarse pacientes a si mismo.'
      USING ERRCODE = '42501';
  END IF;

  -- PASO 3 — gates de suscripción
  IF NOT public.clinica_no_suspendida() THEN
    RAISE EXCEPTION 'La clinica esta suspendida.' USING ERRCODE = 'SP002';
  END IF;
  IF NOT public.clinica_tiene_acceso() THEN
    RAISE EXCEPTION 'La clinica no tiene una suscripcion activa.' USING ERRCODE = 'SP003';
  END IF;
  IF NOT public.clinica_dentro_de_limite() THEN
    RAISE EXCEPTION 'La clinica alcanzo su limite de pacientes.' USING ERRCODE = 'SP001';
  END IF;

  -- PASO 4 — generar numero_expediente
  SELECT COALESCE(MAX(
           NULLIF(regexp_replace(p.numero_expediente, '^EXP-\d{4}-', ''), '')::int
         ), 0) + 1
    INTO v_correlativo
  FROM public.pacientes p
  WHERE p.clinica_id = v_clinica_id
    AND p.numero_expediente ~ ('^EXP-' || v_anio || '-[0-9]+$');
  v_num_exp := 'EXP-' || v_anio || '-' || lpad(v_correlativo::text, 4, '0');

  -- PASO 5 — insert en pacientes
  INSERT INTO public.pacientes (
    nombre, apellidos, fecha_nacimiento, sexo,
    peso_kg, talla_cm, imc,
    telefono, email, direccion,
    ant_patologicos, ant_quirurgicos, ant_familiares,
    alergias, medicamentos_actuales,
    clinica_id, medico_id, numero_expediente,
    consentimiento_otorgado, fecha_consentimiento, version_aviso_privacidad
  ) VALUES (
    p_datos->>'nombre',
    p_datos->>'apellidos',
    NULLIF(p_datos->>'fecha_nacimiento','')::date,
    NULLIF(p_datos->>'sexo', ''),
    NULLIF(p_datos->>'peso_kg', '')::numeric,
    NULLIF(p_datos->>'talla_cm', '')::numeric,
    NULLIF(p_datos->>'imc', '')::numeric,
    NULLIF(p_datos->>'telefono', ''),
    NULLIF(p_datos->>'email', ''),
    NULLIF(p_datos->>'direccion', ''),
    NULLIF(p_datos->>'ant_patologicos', ''),
    NULLIF(p_datos->>'ant_quirurgicos', ''),
    NULLIF(p_datos->>'ant_familiares', ''),
    NULLIF(p_datos->>'alergias', ''),
    NULLIF(p_datos->>'medicamentos_actuales', ''),
    v_clinica_id,
    p_medico_id,
    v_num_exp,
    true,
    now(),
    'v1.0-2026-04-08'
  )
  RETURNING pacientes.id INTO v_nuevo_id;

  -- PASO 6 — insert en paciente_medico
  INSERT INTO public.paciente_medico (paciente_id, medico_id, asignado_por)
  VALUES (v_nuevo_id, p_medico_id, v_uid);

  RETURN QUERY SELECT v_nuevo_id, v_num_exp;
END;
$function$;

CREATE OR REPLACE FUNCTION public.crear_paciente_con_medico_v2 (
  p_datos        jsonb,
  p_medico_id    uuid,
  p_force_create boolean DEFAULT false
)
  RETURNS TABLE (
    resultado         text,
    id                uuid,
    numero_expediente text,
    dup_id            uuid,
    dup_nombre        text,
    dup_apellidos     text,
    dup_numero_exp    text,
    dup_fecha_nac     date,
    dup_es_mio        boolean
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
DECLARE
  v_uid          uuid := auth.uid();
  v_rol          text;
  v_clinica_id   uuid;
  v_es_admin     boolean;
  v_medico_rol   text;
  v_medico_clin  uuid;
  v_anio         text := to_char(now(), 'YYYY');
  v_correlativo  int;
  v_num_exp      text;
  v_nuevo_id     uuid;
  v_nombre       text;
  v_apellidos    text;
  v_fecha_nac    date;
  v_dup_id       uuid;
  v_dup_nombre   text;
  v_dup_apell    text;
  v_dup_num_exp  text;
  v_dup_fnac     date;
  v_dup_es_mio   boolean;
  v_medico_eval  uuid;
BEGIN
  -- PASO 1 — validar quién llama
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
  END IF;
  SELECT pr.role, pr.clinica_id, pr.es_admin_de_clinica
    INTO v_rol, v_clinica_id, v_es_admin
  FROM public.profiles pr WHERE pr.id = v_uid;
  IF v_clinica_id IS NULL THEN
    RAISE EXCEPTION 'El usuario no tiene clinica asignada.' USING ERRCODE = '42501';
  END IF;
  IF v_rol NOT IN ('medico','secretaria') THEN
    RAISE EXCEPTION 'El rol % no puede crear pacientes.', v_rol USING ERRCODE = '42501';
  END IF;

  -- PASO 2 — validar el médico objetivo
  IF p_medico_id IS NULL THEN
    RAISE EXCEPTION 'Debe especificarse el medico tratante.' USING ERRCODE = '42501';
  END IF;
  SELECT pr.role, pr.clinica_id INTO v_medico_rol, v_medico_clin
  FROM public.profiles pr WHERE pr.id = p_medico_id;
  IF v_medico_rol IS NULL THEN
    RAISE EXCEPTION 'El medico especificado no existe.' USING ERRCODE = '42501';
  END IF;
  IF v_medico_rol <> 'medico' THEN
    RAISE EXCEPTION 'El usuario asignado no es un medico.' USING ERRCODE = '42501';
  END IF;
  IF v_medico_clin IS DISTINCT FROM v_clinica_id THEN
    RAISE EXCEPTION 'El medico no pertenece a la clinica del usuario.' USING ERRCODE = '42501';
  END IF;
  IF v_rol = 'medico' AND v_es_admin IS NOT TRUE AND p_medico_id <> v_uid THEN
    RAISE EXCEPTION 'Un medico invitado solo puede asignarse pacientes a si mismo.'
      USING ERRCODE = '42501';
  END IF;

  -- PASO 3 — gates de suscripción
  IF NOT public.clinica_no_suspendida() THEN
    RAISE EXCEPTION 'La clinica esta suspendida.' USING ERRCODE = 'SP002';
  END IF;
  IF NOT public.clinica_tiene_acceso() THEN
    RAISE EXCEPTION 'La clinica no tiene una suscripcion activa.' USING ERRCODE = 'SP003';
  END IF;
  IF NOT public.clinica_dentro_de_limite() THEN
    RAISE EXCEPTION 'La clinica alcanzo su limite de pacientes.' USING ERRCODE = 'SP001';
  END IF;

  -- PASO NUEVO — detección de duplicados (DUP-RPC Fase 1; ver DUPRPC_PLAN.md §4.3)
  IF p_force_create IS NOT TRUE THEN
    v_nombre    := p_datos->>'nombre';
    v_apellidos := p_datos->>'apellidos';
    v_fecha_nac := NULLIF(p_datos->>'fecha_nacimiento','')::date;

    IF v_nombre IS NOT NULL AND btrim(v_nombre) <> ''
       AND v_apellidos IS NOT NULL AND btrim(v_apellidos) <> ''
       AND v_fecha_nac IS NOT NULL
    THEN
      SELECT p.id, p.nombre, p.apellidos, p.numero_expediente, p.fecha_nacimiento
        INTO v_dup_id, v_dup_nombre, v_dup_apell, v_dup_num_exp, v_dup_fnac
      FROM public.pacientes p
      WHERE p.clinica_id = v_clinica_id
        AND (p.activo = true OR p.activo IS NULL)
        AND p.fecha_nacimiento = v_fecha_nac
        AND lower(btrim(p.nombre))    = lower(btrim(v_nombre))
        AND lower(btrim(p.apellidos)) = lower(btrim(v_apellidos))
      ORDER BY p.created_at ASC
      LIMIT 1;

      IF v_dup_id IS NOT NULL THEN
        IF v_rol = 'medico' THEN
          v_medico_eval := v_uid;
        ELSE
          v_medico_eval := p_medico_id;
        END IF;

        v_dup_es_mio := EXISTS (
          SELECT 1 FROM public.paciente_medico pm
          WHERE pm.paciente_id = v_dup_id
            AND pm.medico_id = v_medico_eval
        );

        RETURN QUERY SELECT
          'duplicado'::text,
          NULL::uuid,
          NULL::text,
          v_dup_id,
          v_dup_nombre,
          v_dup_apell,
          v_dup_num_exp,
          v_dup_fnac,
          v_dup_es_mio;
        RETURN;  -- NO inserta nada
      END IF;
    END IF;
  END IF;

  -- PASO 4 — generar numero_expediente
  SELECT COALESCE(MAX(
           NULLIF(regexp_replace(p.numero_expediente, '^EXP-\d{4}-', ''), '')::int
         ), 0) + 1
    INTO v_correlativo
  FROM public.pacientes p
  WHERE p.clinica_id = v_clinica_id
    AND p.numero_expediente ~ ('^EXP-' || v_anio || '-[0-9]+$');
  v_num_exp := 'EXP-' || v_anio || '-' || lpad(v_correlativo::text, 4, '0');

  -- PASO 5 — insert en pacientes
  INSERT INTO public.pacientes (
    nombre, apellidos, fecha_nacimiento, sexo,
    peso_kg, talla_cm, imc,
    telefono, email, direccion,
    ant_no_patologicos, ant_patologicos, ant_quirurgicos, ant_familiares,
    alergias, medicamentos_actuales,
    clinica_id, medico_id, numero_expediente,
    consentimiento_otorgado, fecha_consentimiento, version_aviso_privacidad
  ) VALUES (
    p_datos->>'nombre',
    p_datos->>'apellidos',
    NULLIF(p_datos->>'fecha_nacimiento','')::date,
    NULLIF(p_datos->>'sexo', ''),
    NULLIF(p_datos->>'peso_kg', '')::numeric,
    NULLIF(p_datos->>'talla_cm', '')::numeric,
    NULLIF(p_datos->>'imc', '')::numeric,
    NULLIF(p_datos->>'telefono', ''),
    NULLIF(p_datos->>'email', ''),
    NULLIF(p_datos->>'direccion', ''),
    NULLIF(p_datos->>'ant_no_patologicos', ''),
    NULLIF(p_datos->>'ant_patologicos', ''),
    NULLIF(p_datos->>'ant_quirurgicos', ''),
    NULLIF(p_datos->>'ant_familiares', ''),
    NULLIF(p_datos->>'alergias', ''),
    NULLIF(p_datos->>'medicamentos_actuales', ''),
    v_clinica_id,
    p_medico_id,
    v_num_exp,
    true,
    now(),
    'v1.0-2026-04-08'
  )
  RETURNING pacientes.id INTO v_nuevo_id;

  -- PASO 6 — insert en paciente_medico
  INSERT INTO public.paciente_medico (paciente_id, medico_id, asignado_por)
  VALUES (v_nuevo_id, p_medico_id, v_uid);

  RETURN QUERY SELECT
    'creado'::text,
    v_nuevo_id,
    v_num_exp,
    NULL::uuid,
    NULL::text,
    NULL::text,
    NULL::text,
    NULL::date,
    false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_cap_10_consultorios_activos()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_count integer;
BEGIN
  IF NEW.activo = false THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.activo = true THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.consultorios
  WHERE medico_id = NEW.medico_id
    AND activo = true
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF v_count >= 10 THEN
    RAISE EXCEPTION 'Límite alcanzado: máximo 10 consultorios activos por médico (médico %)', NEW.medico_id
      USING errcode = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_consultorio_default_existencia()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  r_medico record;
  v_activos integer;
  v_defaults integer;
BEGIN
  FOR r_medico IN
    SELECT DISTINCT medico_id FROM old_consultorios
  LOOP
    SELECT
      COUNT(*) FILTER (WHERE activo = true),
      COUNT(*) FILTER (WHERE activo = true AND es_default = true)
    INTO v_activos, v_defaults
    FROM public.consultorios
    WHERE medico_id = r_medico.medico_id;

    IF v_activos >= 1 AND v_defaults = 0 THEN
      RAISE EXCEPTION 'Inconsistencia: el médico % tiene % consultorio(s) activo(s) pero ningún default. Marque uno como default antes de continuar.', r_medico.medico_id, v_activos
        USING errcode = 'check_violation';
    END IF;
  END LOOP;

  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_consultorio_default_insert()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_otros_activos integer;
BEGIN
  SELECT COUNT(*) INTO v_otros_activos
  FROM public.consultorios
  WHERE medico_id = NEW.medico_id
    AND activo = true;

  IF v_otros_activos = 0 THEN
    NEW.es_default = true;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_limite_documentos_paciente()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_count int;
begin
  if NEW.paciente_id is null then
    return NEW;
  end if;

  if NEW.tipo not in ('resultado_laboratorio', 'estudio_imagen') then
    return NEW;
  end if;

  select count(*) into v_count
  from public.documentos
  where paciente_id = NEW.paciente_id
    and tipo in ('resultado_laboratorio', 'estudio_imagen');

  if v_count >= 100 then
    raise exception 'Límite de 100 documentos por paciente alcanzado (paciente_id=%)', NEW.paciente_id
      using errcode = 'check_violation';
  end if;

  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.firmas_documento_guardian()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
DECLARE
  v_estado text;
BEGIN
  NEW.firmado_en_servidor := now();

  SELECT estado INTO v_estado
    FROM public.documentos
   WHERE id = NEW.documento_id
     AND (auth.uid() IS NULL OR subido_por = auth.uid())
     FOR UPDATE;

  IF v_estado IS NULL THEN
    RAISE EXCEPTION 'El documento que se intenta firmar no existe';
  END IF;

  IF v_estado <> 'borrador' THEN
    RAISE EXCEPTION 'Solo se firma un borrador; este documento está %', v_estado
      USING HINT = 'un documento emitido ya no admite firmas: emite uno nuevo';
  END IF;

  IF auth.uid() IS NOT NULL THEN
    IF NOT public.clinica_no_suspendida() THEN
      RAISE EXCEPTION 'La clínica está suspendida: no se firman documentos';
    END IF;

    IF NOT public.clinica_tiene_acceso() THEN
      RAISE EXCEPTION 'La clínica no tiene acceso de escritura: no se firman documentos';
    END IF;
  END IF;

  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.firmas_documento_inmutable()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (SELECT 1 FROM public.documentos WHERE id = OLD.documento_id) THEN
      RETURN OLD;
    END IF;
  END IF;

  RAISE EXCEPTION 'Una firma electrónica no se modifica ni se borra'
    USING HINT = 'si el documento tiene un error, se emite uno nuevo; y si es un borrador, se cancela entero';
END $function$;

CREATE OR REPLACE FUNCTION public.generar_folio (
  p_clase text
)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
DECLARE
  v_prefijo text;
  v_anio    smallint;
  v_n       integer;
BEGIN
  v_prefijo := CASE p_clase
    WHEN 'rx'  THEN 'RX'
    WHEN 'noh' THEN 'NOH'
    WHEN 'cot' THEN 'COT'
    WHEN 'ci'  THEN 'CI'
    WHEN 'lab' THEN 'LAB'
    WHEN 'img' THEN 'IMG'
    WHEN 'sup' THEN 'SUP'
    WHEN 'int' THEN 'INT'
    WHEN 'den' THEN 'DEN'
  END;

  IF v_prefijo IS NULL THEN
    RAISE EXCEPTION 'clase de folio desconocida'
      USING HINT = 'las nueve son rx, noh, cot, ci, lab, img, sup, int, den';
  END IF;

  IF public.get_clinica_id() IS NULL THEN
    RAISE EXCEPTION 'sin clínica activa: no se emite folio';
  END IF;

  IF NOT public.clinica_tiene_acceso() THEN
    RAISE EXCEPTION 'la clínica no tiene acceso de escritura: no se emite folio';
  END IF;

  v_anio := EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Mexico_City'))::smallint;

  INSERT INTO public.folios_contador AS c (clase, anio, ultimo)
  VALUES (p_clase, v_anio, 1)
  ON CONFLICT (clase, anio) DO UPDATE
    SET ultimo = c.ultimo + 1
  RETURNING c.ultimo INTO v_n;

  RETURN v_prefijo || '-' || v_anio::text || '-' ||
         CASE WHEN v_n < 10000 THEN lpad(v_n::text, 4, '0') ELSE v_n::text END;
END $function$;

CREATE OR REPLACE FUNCTION public.get_clinica_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
  select clinica_id from profiles where id = auth.uid()
$function$;

CREATE OR REPLACE FUNCTION public.get_my_role()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
    SELECT role FROM profiles WHERE id = auth.uid()
  $function$;

CREATE OR REPLACE FUNCTION public.get_suscripcion_estado()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
  SELECT suscripcion_estado
  FROM clinicas
  WHERE id = public.get_clinica_id()
$function$;

CREATE OR REPLACE FUNCTION public.guardar_secretos_conexion (
  p_clinica_id  uuid,
  p_conexion_id uuid,
  p_access      text,
  p_refresh     text,
  p_expires     bigint
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
  -- El lado caro del aislamiento: escribir los tokens de la clínica A bajo la
  -- conexión de la B haría que las citas de B se escribieran en el calendario
  -- de Google de A, con el nombre del paciente en el título del evento.
  IF NOT EXISTS (
    SELECT 1 FROM public.clinica_conexiones_google c
     WHERE c.id = p_conexion_id AND c.clinica_id = p_clinica_id
  ) THEN
    RAISE EXCEPTION 'conexion_ajena_o_inexistente'
      USING DETAIL = 'Esa conexión no existe o no es de esa clínica. Un escritor no escribe en el vacío.';
  END IF;

  IF p_access IS NULL THEN
    RAISE EXCEPTION 'access_token_nulo'
      USING DETAIL = 'access_token es NOT NULL; sin esta guarda el fallo sería un 23502 opaco desde dentro de after().';
  END IF;

  INSERT INTO private.google_conexiones_secretos AS s
    (conexion_id, access_token, refresh_token, expires_at)
  VALUES
    (p_conexion_id, p_access, p_refresh, p_expires)
  ON CONFLICT (conexion_id) DO UPDATE SET
    access_token  = EXCLUDED.access_token,
    -- ⚠️ EL COALESCE NO ES OPCIONAL, Y NO SE «SIMPLIFICA» A EXCLUDED A SECAS.
    --
    -- 1. El refresh token no es un dato que el camino de refresco produzca.
    --    Hoy `credentials.refresh_token` viene poblado tras refrescar, pero es
    --    un eco de nuestra propia entrada, no un hecho de Google:
    --    google-auth-library/build/src/auth/oauth2client.js:287-292 hace
    --    literalmente `tokens.refresh_token = this.credentials.refresh_token`
    --    antes de devolver. Un contrato que descansa en que el llamador
    --    reencripte y reenvíe un valor que la librería le devolvió por
    --    cortesía se rompe el día que alguien no lo sabe.
    -- 2. Hay caminos legítimos que no lo tienen: una función de reparación, un
    --    camino que sólo renueva el access token, un refactor que escribe
    --    `credentials.refresh_token ?? null`.
    -- 3. El modo de fallo por defecto sería destructivo e INDISTINGUIBLE de una
    --    revocación real: sin refresh token, el siguiente vencimiento da
    --    invalid_grant, y eso marca la conexión como revocada. La clínica
    --    pierde la sincronización y el sistema diagnostica «el médico revocó el
    --    acceso desde Google».
    --
    -- No hay ningún caso legítimo de poner el refresh token a NULL: el único
    -- borrado legítimo es el de la conexión entera, vía ON DELETE CASCADE.
    refresh_token = COALESCE(EXCLUDED.refresh_token, s.refresh_token),
    -- `expires_at` SÍ se sobrescribe verbatim, incluido a NULL, y es una
    -- decisión distinta a propósito: access_token y expires_at viajan siempre
    -- juntos, así que aquí NULL significa de verdad «no sé cuándo vence».
    -- Preservar el valor viejo convertiría «vencimiento desconocido» en
    -- «vencido» sin decirlo.
    expires_at    = EXCLUDED.expires_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.leer_conexion_google_con_secretos (
  p_clinica_id  uuid,
  p_conexion_id uuid
)
  RETURNS TABLE (
    conexion_id    uuid,
    clinica_id     uuid,
    user_id        uuid,
    rol            text,
    calendar_id    text,
    estado         text,
    tiene_secretos boolean,
    access_token   text,
    refresh_token  text,
    expires_at     bigint
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  SELECT c.id,
         c.clinica_id,
         c.user_id,
         c.rol,
         c.calendar_id,
         c.estado,
         (s.conexion_id IS NOT NULL),
         s.access_token,
         s.refresh_token,
         s.expires_at
    FROM public.clinica_conexiones_google c
    LEFT JOIN private.google_conexiones_secretos s ON s.conexion_id = c.id
   WHERE c.id         = p_conexion_id
     AND c.clinica_id = p_clinica_id;
$function$;

CREATE OR REPLACE FUNCTION public.listar_pacientes_expediente (
  p_busqueda    text                     DEFAULT NULL::text,
  p_medico_id   uuid                     DEFAULT NULL::uuid,
  p_fecha_desde timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_fecha_hasta timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_orden       text                     DEFAULT 'created_at'::text,
  p_direccion   text                     DEFAULT 'desc'::text,
  p_limite      integer                  DEFAULT 25,
  p_offset      integer                  DEFAULT 0
)
  RETURNS TABLE (
    id                uuid,
    numero_expediente text,
    nombre            text,
    apellidos         text,
    fecha_nacimiento  date,
    sexo              text,
    created_at        timestamp with time zone,
    activo            boolean,
    clinica_id        uuid,
    medicos           jsonb
  )
  LANGUAGE sql
  STABLE
  SET search_path TO 'public', 'pg_temp'
  AS $function$
  WITH q AS (
    SELECT nullif(regexp_replace(btrim(p_busqueda), '\s+', ' ', 'g'), '') AS term
  )
  SELECT
    p.id,
    p.numero_expediente,
    p.nombre,
    p.apellidos,
    p.fecha_nacimiento,
    p.sexo,
    p.created_at,
    p.activo,
    p.clinica_id,
    COALESCE(m.medicos, '[]'::jsonb) AS medicos
  FROM public.pacientes p
  CROSS JOIN q
  LEFT JOIN LATERAL (
    SELECT
      jsonb_agg(
        jsonb_build_object(
          'id',               pr.id,
          'titulo',           pr.titulo,
          'nombres',          pr.nombres,
          'apellido_paterno', pr.apellido_paterno,
          'apellido_materno', pr.apellido_materno
        )
        ORDER BY pr.apellido_paterno NULLS LAST, pr.nombres NULLS LAST
      )                          AS medicos,
      min(pr.apellido_paterno)   AS medico_sort
    FROM public.paciente_medico pm
    JOIN public.profiles pr ON pr.id = pm.medico_id
    WHERE pm.paciente_id = p.id
  ) m ON true
  WHERE
    (p.activo = true OR p.activo IS NULL)
    AND (q.term IS NULL
       OR p.nombre    ILIKE '%' || q.term || '%'
       OR p.apellidos ILIKE '%' || q.term || '%')
    AND (p_medico_id IS NULL OR EXISTS (
          SELECT 1 FROM public.paciente_medico pmf
          WHERE pmf.paciente_id = p.id
            AND pmf.medico_id   = p_medico_id
        ))
    AND (p_fecha_desde IS NULL OR p.created_at >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR p.created_at <  p_fecha_hasta)
  ORDER BY
    CASE WHEN p_orden = 'nombre'            AND p_direccion = 'asc'  THEN p.nombre            END ASC  NULLS LAST,
    CASE WHEN p_orden = 'nombre'            AND p_direccion = 'desc' THEN p.nombre            END DESC NULLS LAST,
    CASE WHEN p_orden = 'apellidos'         AND p_direccion = 'asc'  THEN p.apellidos         END ASC  NULLS LAST,
    CASE WHEN p_orden = 'apellidos'         AND p_direccion = 'desc' THEN p.apellidos         END DESC NULLS LAST,
    CASE WHEN p_orden = 'numero_expediente' AND p_direccion = 'asc'  THEN p.numero_expediente END ASC  NULLS LAST,
    CASE WHEN p_orden = 'numero_expediente' AND p_direccion = 'desc' THEN p.numero_expediente END DESC NULLS LAST,
    CASE WHEN p_orden = 'fecha_nacimiento'  AND p_direccion = 'asc'  THEN p.fecha_nacimiento  END ASC  NULLS LAST,
    CASE WHEN p_orden = 'fecha_nacimiento'  AND p_direccion = 'desc' THEN p.fecha_nacimiento  END DESC NULLS LAST,
    CASE WHEN p_orden = 'medico'            AND p_direccion = 'asc'  THEN m.medico_sort        END ASC  NULLS LAST,
    CASE WHEN p_orden = 'medico'            AND p_direccion = 'desc' THEN m.medico_sort        END DESC NULLS LAST,
    CASE WHEN p_orden = 'created_at'         AND p_direccion = 'asc'  THEN p.created_at         END ASC  NULLS LAST,
    p.created_at DESC,
    p.id
  LIMIT  GREATEST(p_limite, 0)
  OFFSET GREATEST(p_offset, 0);
$function$;

CREATE OR REPLACE FUNCTION public.log_tabla_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  insert into audit_log(user_id, accion, tabla, registro_id)
  values (
    coalesce(auth.uid()::text, 'system'),
    TG_OP,
    TG_TABLE_NAME,
    case when TG_OP = 'DELETE' then OLD.id else NEW.id end
  );
  return coalesce(NEW, OLD);
end;
$function$;

CREATE OR REPLACE FUNCTION public.marcar_consultorio_default (
  p_target_id uuid
)
  RETURNS public.consultorios
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_medico_id uuid;
  v_resultado public.consultorios;
BEGIN
  SELECT medico_id INTO v_medico_id
  FROM public.consultorios
  WHERE id = p_target_id
    AND activo = true
    AND medico_id = auth.uid();

  IF v_medico_id IS NULL THEN
    RAISE EXCEPTION 'Consultorio no encontrado, archivado, o no pertenece al usuario'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.consultorios
  SET
    es_default = (id = p_target_id),
    updated_at = now()
  WHERE medico_id = v_medico_id
    AND activo = true;

  SELECT * INTO v_resultado
  FROM public.consultorios
  WHERE id = p_target_id;

  RETURN v_resultado;
END;
$function$;

CREATE OR REPLACE FUNCTION public.paciente_pertenece_a_mi_clinica (
  p_paciente_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
    SELECT EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = p_paciente_id
        AND p.clinica_id = public.get_clinica_id()
    );
  $function$;

CREATE OR REPLACE FUNCTION public.plantillas_documento_tope()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
DECLARE
  v_n integer;
BEGIN
  NEW.nombre := btrim(NEW.nombre, ' ' || chr(9) || chr(10) || chr(13) || chr(160));

  PERFORM pg_advisory_xact_lock(
    hashtextextended(NEW.user_id::text || ':' || NEW.tipo, 0)
  );

  SELECT count(*) INTO v_n
    FROM public.plantillas_documento
   WHERE user_id = NEW.user_id AND tipo = NEW.tipo;

  IF v_n >= 10 THEN
    RAISE EXCEPTION 'Ya tienes 10 plantillas de este documento. Borra una para crear otra.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.plantillas_documento_touch()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public', 'pg_temp'
  AS $function$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'El dueño de una plantilla es inmutable'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.tipo IS DISTINCT FROM OLD.tipo THEN
    RAISE EXCEPTION 'El tipo de documento de una plantilla es inmutable'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'El identificador de una plantilla es inmutable'
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.created_at := OLD.created_at;
  NEW.nombre     := btrim(NEW.nombre, ' ' || chr(9) || chr(10) || chr(13) || chr(160));
  NEW.updated_at := now();
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.prevent_audit_modification()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
BEGIN
  RAISE EXCEPTION 'El audit_log es inmutable. No se permite UPDATE ni DELETE.';
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.proteger_columnas_sensibles_profiles()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'No autorizado: no puede modificar role, clinica_id ni es_admin_de_clinica';
  END IF;
  IF NEW.clinica_id IS DISTINCT FROM OLD.clinica_id THEN
    RAISE EXCEPTION 'No autorizado: no puede modificar role, clinica_id ni es_admin_de_clinica';
  END IF;
  IF NEW.es_admin_de_clinica IS DISTINCT FROM OLD.es_admin_de_clinica THEN
    RAISE EXCEPTION 'No autorizado: no puede modificar role, clinica_id ni es_admin_de_clinica';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rate_limit_intento (
  p_clave       text,
  p_ruta        text,
  p_limite      integer,
  p_ventana_min integer
)
  RETURNS TABLE (
    bloqueado boolean,
    restantes integer
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
DECLARE
  v_total int;
  v_desde timestamptz;
BEGIN
  IF p_clave IS NULL OR p_ruta IS NULL THEN
    RAISE EXCEPTION 'rate_limit_intento: p_clave y p_ruta no pueden ser NULL';
  END IF;
  IF p_limite IS NULL OR p_limite < 1
     OR p_ventana_min IS NULL OR p_ventana_min < 1 THEN
    RAISE EXCEPTION 'rate_limit_intento: p_limite y p_ventana_min deben ser >= 1 (recibido %, %)',
      p_limite, p_ventana_min;
  END IF;

  PERFORM pg_advisory_xact_lock(1789, hashtext(p_ruta));

  v_desde := now() - make_interval(mins => p_ventana_min);

  DELETE FROM public.ip_rate_limits
   WHERE ruta = p_ruta
     AND created_at < v_desde;

  SELECT count(*) INTO v_total
    FROM public.ip_rate_limits
   WHERE ruta = p_ruta
     AND created_at >= v_desde;

  IF v_total >= p_limite THEN
    RETURN QUERY SELECT true, 0;
  ELSE
    INSERT INTO public.ip_rate_limits (ip, ruta) VALUES (p_clave, p_ruta);
    RETURN QUERY SELECT false, (p_limite - v_total - 1);
  END IF;
END
$function$;

CREATE OR REPLACE FUNCTION public.rate_limit_reset (
  p_ruta text
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
DECLARE
  v_borradas int;
BEGIN
  IF p_ruta IS NULL OR p_ruta NOT LIKE 'auth:login_v2:%' THEN
    RAISE EXCEPTION 'rate_limit_reset: ruta no permitida (%). Solo se aceptan rutas auth:login_v2:* (D5).', p_ruta;
  END IF;

  PERFORM pg_advisory_xact_lock(1789, hashtext(p_ruta));

  DELETE FROM public.ip_rate_limits WHERE ruta = p_ruta;
  GET DIAGNOSTICS v_borradas = ROW_COUNT;
  RETURN v_borradas;
END
$function$;

CREATE OR REPLACE FUNCTION public.sa_heatmap_horarios (
  dias_atras integer DEFAULT 90
)
  RETURNS TABLE (
    hora       integer,
    dia_semana integer,
    total      bigint
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
BEGIN
  IF auth.role() <> 'service_role'
     AND coalesce(public.get_my_role(), '') <> 'super_admin' THEN
    RAISE EXCEPTION 'unauthorized: super_admin required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    EXTRACT(hour FROM al.created_at AT TIME ZONE 'America/Mexico_City')::int,
    EXTRACT(dow  FROM al.created_at AT TIME ZONE 'America/Mexico_City')::int,
    count(*)::bigint
  FROM public.audit_log al
  WHERE al.created_at >= now() - make_interval(days => dias_atras)
  GROUP BY 1, 2
  ORDER BY 1, 2;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sa_ranking_funciones (
  limite integer DEFAULT 20
)
  RETURNS TABLE (
    accion text,
    total  bigint
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
BEGIN
  IF auth.role() <> 'service_role'
     AND coalesce(public.get_my_role(), '') <> 'super_admin' THEN
    RAISE EXCEPTION 'unauthorized: super_admin required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    al.accion::text,
    count(*)::bigint
  FROM public.audit_log al
  GROUP BY al.accion
  ORDER BY 2 DESC
  LIMIT limite;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sa_top_medicos (
  dias_atras integer DEFAULT 30,
  limite     integer DEFAULT 10
)
  RETURNS TABLE (
    user_id        text,
    nombre         text,
    clinica_nombre text,
    total          bigint
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
BEGIN
  IF auth.role() <> 'service_role'
     AND coalesce(public.get_my_role(), '') <> 'super_admin' THEN
    RAISE EXCEPTION 'unauthorized: super_admin required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    al.user_id::text,
    COALESCE(
      NULLIF(TRIM(CONCAT_WS(' ',
        NULLIF(p.titulo, ''),
        NULLIF(p.nombres, ''),
        NULLIF(p.apellido_paterno, ''),
        NULLIF(p.apellido_materno, '')
      )), ''),
      '(sin perfil)'
    )::text,
    c.nombre::text,
    count(*)::bigint
  FROM public.audit_log al
  LEFT JOIN public.profiles p ON p.id::text = al.user_id
  LEFT JOIN public.clinicas c ON c.id = p.clinica_id
  WHERE al.created_at >= now() - make_interval(days => dias_atras)
    AND al.user_id IS NOT NULL
    AND al.user_id <> 'anonymous'
  GROUP BY al.user_id, p.titulo, p.nombres, p.apellido_paterno, p.apellido_materno, c.nombre
  ORDER BY 4 DESC
  LIMIT limite;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sa_uso_ia (
  dias_atras integer DEFAULT 30
)
  RETURNS TABLE (
    accion text,
    total  bigint
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
BEGIN
  IF auth.role() <> 'service_role'
     AND coalesce(public.get_my_role(), '') <> 'super_admin' THEN
    RAISE EXCEPTION 'unauthorized: super_admin required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    al.accion::text,
    count(*)::bigint
  FROM public.audit_log al
  WHERE al.created_at >= now() - make_interval(days => dias_atras)
    AND (al.accion LIKE 'ia_%'
         OR al.accion IN ('generar_pdf', 'nota_generada', 'receta_generada', 'enviar_documento'))
  GROUP BY al.accion
  ORDER BY 2 DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.soy_admin_de_clinica()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
    SELECT EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role = 'medico'
        AND pr.es_admin_de_clinica IS TRUE
    );
  $function$;

CREATE OR REPLACE FUNCTION public.soy_medico_tratante (
  p_paciente_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
    SELECT EXISTS (
      SELECT 1 FROM public.paciente_medico pm
      WHERE pm.paciente_id = p_paciente_id
        AND pm.medico_id   = auth.uid()
    );
  $function$;

CREATE OR REPLACE FUNCTION public.sync_antropometria_paciente (
  p_paciente_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_peso_medicion  numeric;
  v_talla_medicion numeric;
  v_peso_paciente  numeric;
  v_talla_paciente numeric;
  v_peso_final     numeric;
  v_talla_final    numeric;
  v_imc            numeric;
begin
  if p_paciente_id is null then
    return;
  end if;

  select m.valor into v_peso_medicion
  from mediciones_analitos m
  join analitos_catalogo a on a.id = m.analito_id
  where m.paciente_id = p_paciente_id
    and a.clave = 'peso'
  order by m.medido_en desc
  limit 1;

  select m.valor into v_talla_medicion
  from mediciones_analitos m
  join analitos_catalogo a on a.id = m.analito_id
  where m.paciente_id = p_paciente_id
    and a.clave = 'talla'
  order by m.medido_en desc
  limit 1;

  select peso_kg, talla_cm into v_peso_paciente, v_talla_paciente
  from pacientes
  where id = p_paciente_id;

  v_peso_final  := coalesce(v_peso_medicion,  v_peso_paciente);
  v_talla_final := coalesce(v_talla_medicion, v_talla_paciente);

  if v_peso_final is not null and v_talla_final is not null
     and v_peso_final > 0 and v_talla_final > 0 then
    v_imc := round(v_peso_final / ((v_talla_final / 100.0) * (v_talla_final / 100.0)), 1);
  end if;

  update pacientes
  set peso_kg    = coalesce(v_peso_medicion,  peso_kg),
      talla_cm   = coalesce(v_talla_medicion, talla_cm),
      imc        = coalesce(v_imc,            imc),
      updated_at = now()
  where id = p_paciente_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.trg_mediciones_antropometria()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_analito_id_efectivo uuid;
  v_clave               text;
begin
  -- Guard: custom analitos (analito_id NULL) nunca son antropometría.
  v_analito_id_efectivo := coalesce(new.analito_id, old.analito_id);
  if v_analito_id_efectivo is null then
    return coalesce(new, old);
  end if;

  -- Solo nos interesa si el analito involucrado es peso o talla.
  select clave into v_clave
  from analitos_catalogo
  where id = v_analito_id_efectivo;

  if v_clave not in ('peso', 'talla') then
    return coalesce(new, old);
  end if;

  -- Recalcula para el paciente afectado (NEW en INSERT/UPDATE, OLD en DELETE).
  if tg_op = 'DELETE' then
    perform public.sync_antropometria_paciente(old.paciente_id);
  else
    perform public.sync_antropometria_paciente(new.paciente_id);
    -- Si UPDATE cambió paciente_id, recalcula también para el paciente anterior.
    if tg_op = 'UPDATE'
       and old.paciente_id is distinct from new.paciente_id then
      perform public.sync_antropometria_paciente(old.paciente_id);
    end if;
  end if;

  return coalesce(new, old);
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_casos_clinicos_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;

CREATE OR REPLACE FUNCTION public.update_casos_recursos_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;

CREATE OR REPLACE FUNCTION public.update_clinica_conexiones_google_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_consultorios_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_pdf_jobs_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_plantillas_honorarios_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

ALTER TABLE "public"."casos_clinicos_recursos"
  ADD CONSTRAINT "casos_clinicos_recursos_caso_id_fkey" FOREIGN KEY (caso_id) REFERENCES public.casos_clinicos(id) ON DELETE CASCADE;

ALTER TABLE "private"."google_conexiones_secretos"
  ADD CONSTRAINT "google_conexiones_secretos_conexion_id_fkey" FOREIGN KEY (conexion_id) REFERENCES public.clinica_conexiones_google(id) ON DELETE CASCADE;

ALTER TABLE "public"."clinica_conexiones_google"
  ADD CONSTRAINT "clinica_conexiones_google_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."appointments"
  ADD CONSTRAINT "appointments_clinica_id_fkey" FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id) ON DELETE CASCADE;

ALTER TABLE "public"."calculadora_resultados"
  ADD CONSTRAINT "calculadora_resultados_clinica_id_fkey" FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id);

ALTER TABLE "public"."casos_clinicos"
  ADD CONSTRAINT "casos_clinicos_clinica_id_fkey" FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id);

ALTER TABLE "public"."casos_clinicos_recursos"
  ADD CONSTRAINT "casos_clinicos_recursos_clinica_id_fkey" FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id);

ALTER TABLE "public"."clinica_conexiones_google"
  ADD CONSTRAINT "clinica_conexiones_google_clinica_id_fkey" FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id) ON DELETE RESTRICT;

ALTER TABLE "public"."consultas"
  ADD CONSTRAINT "consultas_appointment_id_fkey" FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;

ALTER TABLE "public"."addendums"
  ADD CONSTRAINT "addendums_consulta_id_fkey" FOREIGN KEY (consulta_id) REFERENCES public.consultas(id) ON DELETE RESTRICT;

ALTER TABLE "public"."consultorios"
  ADD CONSTRAINT "consultorios_clinica_id_fkey" FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id) ON DELETE RESTRICT;

ALTER TABLE "public"."appointments"
  ADD CONSTRAINT "appointments_consultorio_id_fkey" FOREIGN KEY (consultorio_id) REFERENCES public.consultorios(id) ON DELETE SET NULL;

ALTER TABLE "public"."consultas"
  ADD CONSTRAINT "consultas_consultorio_id_fkey" FOREIGN KEY (consultorio_id) REFERENCES public.consultorios(id) ON DELETE SET NULL;

ALTER TABLE "public"."documentos"
  ADD CONSTRAINT "documentos_consulta_id_fkey" FOREIGN KEY (consulta_id) REFERENCES public.consultas(id) ON DELETE SET NULL;

ALTER TABLE "public"."firmas_documento"
  ADD CONSTRAINT "firmas_documento_documento_fkey" FOREIGN KEY (documento_id) REFERENCES public.documentos(id) ON DELETE CASCADE;

ALTER TABLE "public"."google_tokens"
  ADD CONSTRAINT "google_tokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."invitaciones"
  ADD CONSTRAINT "invitaciones_clinica_id_fkey" FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id) ON DELETE CASCADE;

ALTER TABLE "public"."mediciones_analitos"
  ADD CONSTRAINT "mediciones_analitos_analito_id_fkey" FOREIGN KEY (analito_id) REFERENCES public.analitos_catalogo(id) ON DELETE RESTRICT;

ALTER TABLE "public"."pacientes"
  ADD CONSTRAINT "pacientes_clinica_id_fkey" FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id) ON DELETE SET NULL;

ALTER TABLE "public"."appointments"
  ADD CONSTRAINT "appointments_paciente_id_fkey" FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id) ON DELETE SET NULL;

ALTER TABLE "public"."calculadora_resultados"
  ADD CONSTRAINT "calculadora_resultados_paciente_id_fkey" FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id) ON DELETE RESTRICT;

ALTER TABLE "public"."casos_clinicos"
  ADD CONSTRAINT "casos_clinicos_paciente_id_fkey" FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id) ON DELETE SET NULL;

ALTER TABLE "public"."consultas"
  ADD CONSTRAINT "consultas_paciente_id_fkey" FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id) ON DELETE RESTRICT;

ALTER TABLE "public"."documentos"
  ADD CONSTRAINT "documentos_paciente_id_fkey" FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id) ON DELETE RESTRICT;

ALTER TABLE "public"."mediciones_analitos"
  ADD CONSTRAINT "mediciones_analitos_paciente_id_fkey" FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id) ON DELETE RESTRICT;

ALTER TABLE "public"."paciente_medico"
  ADD CONSTRAINT "paciente_medico_paciente_id_fkey" FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id) ON DELETE RESTRICT;

ALTER TABLE "public"."pdf_jobs"
  ADD CONSTRAINT "pdf_jobs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."plantillas_honorarios"
  ADD CONSTRAINT "plantillas_honorarios_clinica_id_fkey" FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id) ON DELETE CASCADE;

ALTER TABLE "public"."plantillas_honorarios"
  ADD CONSTRAINT "plantillas_honorarios_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_clinica_id_fkey" FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id) ON DELETE SET NULL;

ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."appointments"
  ADD CONSTRAINT "appointments_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."appointments"
  ADD CONSTRAINT "appointments_medico_id_fkey" FOREIGN KEY (medico_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."calculadora_resultados"
  ADD CONSTRAINT "calculadora_resultados_medico_id_fkey" FOREIGN KEY (medico_id) REFERENCES public.profiles(id);

ALTER TABLE "public"."casos_clinicos"
  ADD CONSTRAINT "casos_clinicos_medico_id_fkey" FOREIGN KEY (medico_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE "public"."consultas"
  ADD CONSTRAINT "consultas_medico_id_fkey" FOREIGN KEY (medico_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."consultorios"
  ADD CONSTRAINT "consultorios_medico_id_fkey" FOREIGN KEY (medico_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE "public"."documentos"
  ADD CONSTRAINT "documentos_subido_por_fkey" FOREIGN KEY (subido_por) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE "public"."firmas_documento"
  ADD CONSTRAINT "firmas_documento_creado_por_fkey" FOREIGN KEY (creado_por) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE "public"."mediciones_analitos"
  ADD CONSTRAINT "mediciones_analitos_creado_por_fkey" FOREIGN KEY (creado_por) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE "public"."paciente_medico"
  ADD CONSTRAINT "paciente_medico_asignado_por_fkey" FOREIGN KEY (asignado_por) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."paciente_medico"
  ADD CONSTRAINT "paciente_medico_medico_id_fkey" FOREIGN KEY (medico_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE "public"."pacientes"
  ADD CONSTRAINT "pacientes_medico_id_fkey" FOREIGN KEY (medico_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."plantillas_documento"
  ADD CONSTRAINT "plantillas_documento_user_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE "public"."rate_limits"
  ADD CONSTRAINT "rate_limits_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."solicitudes_arco"
  ADD CONSTRAINT "solicitudes_arco_clinica_id_fkey" FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id) ON DELETE RESTRICT;

ALTER TABLE "public"."solicitudes_arco"
  ADD CONSTRAINT "solicitudes_arco_creado_por_fkey" FOREIGN KEY (creado_por) REFERENCES auth.users(id);

ALTER TABLE "public"."solicitudes_arco"
  ADD CONSTRAINT "solicitudes_arco_paciente_id_fkey" FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX appointments_clinica_google_event_id_uniq ON public.appointments USING btree (clinica_id, google_event_id)
  WHERE (google_event_id IS NOT NULL);

CREATE INDEX appointments_gcal_calendar_id_idx ON public.appointments USING btree (gcal_calendar_id)
  WHERE (gcal_calendar_id IS NOT NULL);

CREATE UNIQUE INDEX clinica_conexiones_google_account_sub_uniq ON public.clinica_conexiones_google USING btree (google_account_sub)
  WHERE (google_account_sub IS NOT NULL);

CREATE INDEX clinica_conexiones_google_clinica_idx ON public.clinica_conexiones_google USING btree (clinica_id);

CREATE UNIQUE INDEX clinica_conexiones_google_una_por_clinica ON public.clinica_conexiones_google USING btree (clinica_id)
  WHERE (rol = 'clinica'::text);

CREATE UNIQUE INDEX clinica_conexiones_google_user_id_uniq ON public.clinica_conexiones_google USING btree (user_id);

CREATE INDEX consultorios_clinica ON public.consultorios USING btree (clinica_id);

CREATE UNIQUE INDEX consultorios_default_unico ON public.consultorios USING btree (medico_id)
  WHERE ((es_default = true) AND (activo = true));

CREATE INDEX consultorios_medico_activo ON public.consultorios USING btree (medico_id)
  WHERE (activo = true);

CREATE INDEX firmas_documento_listado ON public.firmas_documento USING btree (documento_id, firmado_en);

CREATE UNIQUE INDEX firmas_documento_unica ON public.firmas_documento USING btree (documento_id, rol);

CREATE INDEX idx_addendums_consulta ON public.addendums USING btree (consulta_id, created_at);

CREATE INDEX idx_analitos_catalogo_categoria ON public.analitos_catalogo USING btree (categoria)
  WHERE (activo = true);

CREATE INDEX idx_analitos_catalogo_clave ON public.analitos_catalogo USING btree (clave)
  WHERE (activo = true);

CREATE UNIQUE INDEX idx_appointments_client_id ON public.appointments USING btree (client_id)
  WHERE (client_id IS NOT NULL);

CREATE INDEX idx_appointments_clinica ON public.appointments USING btree (clinica_id);

CREATE INDEX idx_appointments_consultorio ON public.appointments USING btree (consultorio_id)
  WHERE (consultorio_id IS NOT NULL);

CREATE INDEX idx_appointments_gcal_sync ON public.appointments USING btree (gcal_sync_status)
  WHERE (gcal_sync_status = 'pending'::text);

CREATE INDEX idx_appointments_medico ON public.appointments USING btree (medico_id);

CREATE INDEX idx_appointments_paciente ON public.appointments USING btree (paciente_id);

CREATE INDEX idx_appointments_start_time ON public.appointments USING btree (start_time);

CREATE INDEX idx_appointments_status ON public.appointments USING btree (status);

CREATE INDEX idx_arco_clinica ON public.solicitudes_arco USING btree (clinica_id);

CREATE INDEX idx_arco_creado_en ON public.solicitudes_arco USING btree (creado_en DESC);

CREATE INDEX idx_arco_estado ON public.solicitudes_arco USING btree (estado);

CREATE INDEX idx_audit_log_tabla_registro ON public.audit_log USING btree (tabla, registro_id);

CREATE INDEX idx_audit_log_user_fecha ON public.audit_log USING btree (user_id, created_at DESC);

CREATE INDEX idx_calc_resultados_clinica ON public.calculadora_resultados USING btree (clinica_id);

CREATE INDEX idx_calc_resultados_paciente ON public.calculadora_resultados USING btree (paciente_id, fecha DESC);

CREATE INDEX idx_calc_resultados_slug ON public.calculadora_resultados USING btree (calculadora_slug);

CREATE INDEX idx_casos_clinicos_clinica_medico ON public.casos_clinicos USING btree (clinica_id, medico_id);

CREATE INDEX idx_casos_clinicos_paciente ON public.casos_clinicos USING btree (paciente_id);

CREATE INDEX idx_casos_clinicos_recursos_caso ON public.casos_clinicos_recursos USING btree (caso_id);

CREATE INDEX idx_casos_clinicos_recursos_clinica ON public.casos_clinicos_recursos USING btree (clinica_id);

CREATE INDEX idx_casos_clinicos_tags ON public.casos_clinicos USING gin (tags);

CREATE INDEX idx_cie10_capitulo ON public.cat_cie10 USING btree (capitulo);

CREATE INDEX idx_cie10_trgm_codigo ON public.cat_cie10 USING gin (codigo public.gin_trgm_ops);

CREATE INDEX idx_cie10_trgm_desc ON public.cat_cie10 USING gin (descripcion public.gin_trgm_ops);

CREATE INDEX idx_clinicas_stripe_customer ON public.clinicas USING btree (stripe_customer_id)
  WHERE (stripe_customer_id IS NOT NULL);

CREATE INDEX idx_clinicas_stripe_subscription ON public.clinicas USING btree (stripe_subscription_id)
  WHERE (stripe_subscription_id IS NOT NULL);

CREATE INDEX idx_clinicas_suspendida ON public.clinicas USING btree (suspendida)
  WHERE (suspendida = true);

CREATE INDEX idx_consultas_appointment_id ON public.consultas USING btree (appointment_id)
  WHERE (appointment_id IS NOT NULL);

CREATE UNIQUE INDEX idx_consultas_client_id ON public.consultas USING btree (client_id)
  WHERE (client_id IS NOT NULL);

CREATE INDEX idx_consultas_consultorio ON public.consultas USING btree (consultorio_id)
  WHERE (consultorio_id IS NOT NULL);

CREATE INDEX idx_consultas_medico ON public.consultas USING btree (medico_id);

CREATE INDEX idx_consultas_paciente_fecha ON public.consultas USING btree (paciente_id, fecha DESC);

CREATE INDEX idx_consultas_paciente ON public.consultas USING btree (paciente_id);

CREATE INDEX idx_documentos_borrador ON public.documentos USING btree (subido_por, created_at DESC)
  WHERE (estado = 'borrador'::text);

CREATE UNIQUE INDEX idx_documentos_client_id ON public.documentos USING btree (client_id)
  WHERE (client_id IS NOT NULL);

CREATE UNIQUE INDEX idx_documentos_folio ON public.documentos USING btree (folio)
  WHERE (folio IS NOT NULL);

CREATE INDEX idx_documentos_paciente_created ON public.documentos USING btree (paciente_id, created_at DESC);

CREATE INDEX idx_documentos_paciente ON public.documentos USING btree (paciente_id);

CREATE INDEX idx_invitaciones_clinica ON public.invitaciones USING btree (clinica_id);

CREATE INDEX idx_invitaciones_email ON public.invitaciones USING btree (email);

CREATE INDEX idx_invitaciones_token ON public.invitaciones USING btree (token);

CREATE INDEX idx_ip_rate_limits_ip_ruta_fecha ON public.ip_rate_limits USING btree (ip, ruta, created_at);

CREATE INDEX idx_ip_rate_limits_ruta_fecha ON public.ip_rate_limits USING btree (ruta, created_at);

CREATE INDEX idx_medicamentos_nombre_comercial ON public.medicamentos USING btree (nombre_comercial);

CREATE INDEX idx_medicamentos_principio_activo ON public.medicamentos USING btree (principio_activo);

CREATE INDEX idx_mediciones_paciente_analito ON public.mediciones_analitos USING btree (paciente_id, analito_id)
  WHERE (analito_id IS NOT NULL);

CREATE INDEX idx_mediciones_paciente_medido_en ON public.mediciones_analitos USING btree (paciente_id, medido_en DESC);

CREATE INDEX idx_paciente_medico_medico ON public.paciente_medico USING btree (medico_id);

CREATE INDEX idx_pacientes_activo ON public.pacientes USING btree (clinica_id, activo);

CREATE INDEX idx_pacientes_apellidos_trgm ON public.pacientes USING gin (apellidos public.gin_trgm_ops);

CREATE INDEX idx_pacientes_apellidos ON public.pacientes USING btree (apellidos);

CREATE INDEX idx_pacientes_clinica_activo_created ON public.pacientes USING btree (clinica_id, activo, created_at DESC);

CREATE INDEX idx_pacientes_clinica ON public.pacientes USING btree (clinica_id);

CREATE INDEX idx_pacientes_created_activo ON public.pacientes USING btree (created_at DESC)
  WHERE ((activo = true) OR (activo IS NULL));

CREATE INDEX idx_pacientes_fecha_baja ON public.pacientes USING btree (clinica_id, fecha_baja)
  WHERE (fecha_baja IS NULL);

CREATE INDEX idx_pacientes_nombre_trgm ON public.pacientes USING gin (nombre public.gin_trgm_ops);

CREATE INDEX idx_pdf_jobs_user_status ON public.pdf_jobs USING btree (user_id, status);

CREATE UNIQUE INDEX idx_plantillas_honorarios_unique_name ON public.plantillas_honorarios USING btree (user_id, lower(TRIM(BOTH FROM nombre)));

CREATE INDEX idx_plantillas_honorarios_user ON public.plantillas_honorarios USING btree (user_id, created_at DESC);

CREATE INDEX idx_rate_limits_user_ruta_fecha ON public.rate_limits USING btree (user_id, ruta, created_at);

CREATE INDEX plantillas_documento_listado ON public.plantillas_documento USING btree (user_id, tipo, updated_at DESC);

CREATE UNIQUE INDEX plantillas_documento_nombre_unico ON public.plantillas_documento
  USING btree (user_id, tipo, lower(btrim(nombre, ((((' '::text || chr(9)) || chr(10)) || chr(13)) || chr(160)))));

CREATE TRIGGER audit_addendums
  AFTER INSERT ON public.addendums
  FOR EACH ROW
  EXECUTE FUNCTION public.log_tabla_change();

CREATE TRIGGER prevent_audit_delete
  BEFORE DELETE ON public.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_modification();

CREATE TRIGGER prevent_audit_update
  BEFORE UPDATE ON public.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_modification();

CREATE TRIGGER audit_casos_clinicos
  AFTER INSERT OR DELETE OR UPDATE ON public.casos_clinicos
  FOR EACH ROW
  EXECUTE FUNCTION public.log_tabla_change();

CREATE TRIGGER trg_casos_clinicos_updated_at
  BEFORE UPDATE ON public.casos_clinicos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_casos_clinicos_updated_at();

CREATE TRIGGER trg_casos_recursos_updated_at
  BEFORE UPDATE ON public.casos_clinicos_recursos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_casos_recursos_updated_at();

CREATE TRIGGER trg_clinica_conexiones_google_updated_at
  BEFORE UPDATE ON public.clinica_conexiones_google
  FOR EACH ROW
  EXECUTE FUNCTION public.update_clinica_conexiones_google_updated_at();

CREATE TRIGGER trg_clinicas_latch_premium
  BEFORE INSERT OR UPDATE ON public.clinicas
  FOR EACH ROW
  EXECUTE FUNCTION public.clinicas_latch_premium();

CREATE TRIGGER audit_consultas
  AFTER INSERT OR DELETE OR UPDATE ON public.consultas
  FOR EACH ROW
  EXECUTE FUNCTION public.log_tabla_change();

CREATE TRIGGER audit_consultorios
  AFTER INSERT OR DELETE OR UPDATE ON public.consultorios
  FOR EACH ROW
  EXECUTE FUNCTION public.log_tabla_change();

CREATE TRIGGER trg_consultorios_cap_10
  BEFORE INSERT OR UPDATE ON public.consultorios
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_cap_10_consultorios_activos();

CREATE TRIGGER trg_consultorios_default_existencia_delete
  AFTER DELETE ON public.consultorios REFERENCING OLD TABLE AS old_consultorios
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.enforce_consultorio_default_existencia();

CREATE TRIGGER trg_consultorios_default_existencia_update
  AFTER UPDATE ON public.consultorios REFERENCING OLD TABLE AS old_consultorios NEW TABLE AS new_consultorios
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.enforce_consultorio_default_existencia();

CREATE TRIGGER trg_consultorios_default_insert
  BEFORE INSERT ON public.consultorios
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_consultorio_default_insert();

CREATE TRIGGER trg_consultorios_updated_at
  BEFORE UPDATE ON public.consultorios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_consultorios_updated_at();

CREATE TRIGGER audit_documentos
  AFTER INSERT OR DELETE OR UPDATE ON public.documentos
  FOR EACH ROW
  EXECUTE FUNCTION public.log_tabla_change();

CREATE TRIGGER trg_asignar_folio_documento
  BEFORE INSERT OR UPDATE ON public.documentos
  FOR EACH ROW
  EXECUTE FUNCTION public.asignar_folio_documento();

CREATE TRIGGER trg_documentos_limite_paciente
  BEFORE INSERT ON public.documentos
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_limite_documentos_paciente();

CREATE TRIGGER trg_firmas_documento_guardian
  BEFORE INSERT ON public.firmas_documento
  FOR EACH ROW
  EXECUTE FUNCTION public.firmas_documento_guardian();

CREATE TRIGGER trg_firmas_documento_inmutable
  BEFORE DELETE OR UPDATE ON public.firmas_documento
  FOR EACH ROW
  EXECUTE FUNCTION public.firmas_documento_inmutable();

CREATE TRIGGER trg_firmas_documento_no_truncate
  BEFORE TRUNCATE ON public.firmas_documento
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.firmas_documento_inmutable();

CREATE TRIGGER audit_mediciones_analitos
  AFTER INSERT OR DELETE OR UPDATE ON public.mediciones_analitos
  FOR EACH ROW
  EXECUTE FUNCTION public.log_tabla_change();

CREATE TRIGGER mediciones_sync_antropometria
  AFTER INSERT OR DELETE OR UPDATE ON public.mediciones_analitos
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_mediciones_antropometria();

CREATE TRIGGER audit_pacientes
  AFTER INSERT OR DELETE OR UPDATE ON public.pacientes
  FOR EACH ROW
  EXECUTE FUNCTION public.log_tabla_change();

CREATE TRIGGER pdf_jobs_updated_at
  BEFORE UPDATE ON public.pdf_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_pdf_jobs_updated_at();

CREATE TRIGGER trg_plantillas_documento_tope
  BEFORE INSERT ON public.plantillas_documento
  FOR EACH ROW
  EXECUTE FUNCTION public.plantillas_documento_tope();

CREATE TRIGGER trg_plantillas_documento_touch
  BEFORE UPDATE ON public.plantillas_documento
  FOR EACH ROW
  EXECUTE FUNCTION public.plantillas_documento_touch();

CREATE TRIGGER trg_plantillas_honorarios_updated_at
  BEFORE UPDATE ON public.plantillas_honorarios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_plantillas_honorarios_updated_at();

CREATE TRIGGER trg_proteger_columnas_sensibles_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.proteger_columnas_sensibles_profiles();

CREATE TRIGGER trg_arco_fecha_limite
  BEFORE INSERT OR UPDATE ON public.solicitudes_arco
  FOR EACH ROW
  EXECUTE FUNCTION public.arco_set_fecha_limite();

CREATE POLICY "addendums_gates_insert" ON "public"."addendums"
  AS RESTRICTIVE
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((public.clinica_no_suspendida() AND public.clinica_tiene_acceso()));

CREATE POLICY "addendums_insert" ON "public"."addendums"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((medico_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (public.consultas c
     JOIN public.pacientes p ON ((p.id = c.paciente_id)))
  WHERE ((c.id = addendums.consulta_id) AND (p.clinica_id = public.get_clinica_id()) AND (c.medico_id = auth.uid()))))));

CREATE POLICY "addendums_select" ON "public"."addendums"
  FOR SELECT
  TO "authenticated"
  USING ((((medico_id = auth.uid()) OR public.soy_admin_de_clinica()) AND (EXISTS ( SELECT 1
   FROM (public.consultas c
     JOIN public.pacientes p ON ((p.id = c.paciente_id)))
  WHERE ((c.id = addendums.consulta_id) AND (p.clinica_id = public.get_clinica_id()))))));

CREATE POLICY "catalogo_select_authenticated" ON "public"."analitos_catalogo"
  FOR SELECT
  TO "authenticated"
  USING ((activo = true));

CREATE POLICY "appointments_delete" ON "public"."appointments"
  FOR DELETE
  TO "authenticated"
  USING ((((medico_id = auth.uid()) OR public.soy_admin_de_clinica() OR (public.get_my_role() = 'secretaria'::text)) AND (clinica_id = public.get_clinica_id())));

CREATE POLICY "appointments_gates_insert" ON "public"."appointments"
  AS RESTRICTIVE
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((public.clinica_no_suspendida() AND public.clinica_tiene_acceso()));

CREATE POLICY "appointments_insert" ON "public"."appointments"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((((medico_id = auth.uid()) OR public.soy_admin_de_clinica() OR (public.get_my_role() = 'secretaria'::text)) AND (clinica_id = public.get_clinica_id())));

CREATE POLICY "appointments_select" ON "public"."appointments"
  FOR SELECT
  TO "authenticated"
  USING ((((medico_id = auth.uid()) OR public.soy_admin_de_clinica() OR (public.get_my_role() = 'secretaria'::text)) AND (clinica_id = public.get_clinica_id())));

CREATE POLICY "appointments_update" ON "public"."appointments"
  FOR UPDATE
  TO "authenticated"
  USING ((((medico_id = auth.uid()) OR public.soy_admin_de_clinica() OR (public.get_my_role() = 'secretaria'::text)) AND (clinica_id = public.get_clinica_id())))
  WITH CHECK ((((medico_id = auth.uid()) OR public.soy_admin_de_clinica() OR (public.get_my_role() = 'secretaria'::text)) AND (clinica_id = public.get_clinica_id())));

CREATE POLICY "audit_super_admin_select" ON "public"."audit_log"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'super_admin'::text)))));

CREATE POLICY "clinica_delete" ON "public"."calculadora_resultados"
  FOR DELETE
  TO "authenticated"
  USING ((clinica_id = public.get_clinica_id()));

CREATE POLICY "clinica_insert" ON "public"."calculadora_resultados"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((clinica_id = public.get_clinica_id()));

CREATE POLICY "clinica_select" ON "public"."calculadora_resultados"
  FOR SELECT
  TO "authenticated"
  USING ((clinica_id = public.get_clinica_id()));

CREATE POLICY "clinica_update" ON "public"."calculadora_resultados"
  FOR UPDATE
  TO "authenticated"
  USING ((clinica_id = public.get_clinica_id()))
  WITH CHECK ((clinica_id = public.get_clinica_id()));

CREATE POLICY "casos_clinicos_insert" ON "public"."casos_clinicos"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((clinica_id = public.get_clinica_id()) AND (medico_id = auth.uid()) AND public.soy_admin_de_clinica()));

CREATE POLICY "casos_clinicos_select" ON "public"."casos_clinicos"
  FOR SELECT
  TO "authenticated"
  USING (((clinica_id = public.get_clinica_id()) AND (medico_id = auth.uid()) AND public.soy_admin_de_clinica()));

CREATE POLICY "casos_clinicos_update" ON "public"."casos_clinicos"
  FOR UPDATE
  TO "authenticated"
  USING (((clinica_id = public.get_clinica_id()) AND (medico_id = auth.uid()) AND public.soy_admin_de_clinica()))
  WITH CHECK (((clinica_id = public.get_clinica_id()) AND (medico_id = auth.uid()) AND public.soy_admin_de_clinica()));

CREATE POLICY "casos_clinicos_recursos_delete" ON "public"."casos_clinicos_recursos"
  FOR DELETE
  TO "authenticated"
  USING (((clinica_id = public.get_clinica_id()) AND public.soy_admin_de_clinica() AND (EXISTS ( SELECT 1
   FROM public.casos_clinicos c
  WHERE ((c.id = casos_clinicos_recursos.caso_id) AND (c.medico_id = auth.uid()))))));

CREATE POLICY "casos_clinicos_recursos_insert" ON "public"."casos_clinicos_recursos"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((clinica_id = public.get_clinica_id()) AND public.soy_admin_de_clinica() AND (EXISTS ( SELECT 1
   FROM public.casos_clinicos c
  WHERE ((c.id = casos_clinicos_recursos.caso_id) AND (c.medico_id = auth.uid()))))));

CREATE POLICY "casos_clinicos_recursos_select" ON "public"."casos_clinicos_recursos"
  FOR SELECT
  TO "authenticated"
  USING (((clinica_id = public.get_clinica_id()) AND public.soy_admin_de_clinica() AND (EXISTS ( SELECT 1
   FROM public.casos_clinicos c
  WHERE ((c.id = casos_clinicos_recursos.caso_id) AND (c.medico_id = auth.uid()))))));

CREATE POLICY "casos_clinicos_recursos_update" ON "public"."casos_clinicos_recursos"
  FOR UPDATE
  TO "authenticated"
  USING (((clinica_id = public.get_clinica_id()) AND public.soy_admin_de_clinica() AND (EXISTS ( SELECT 1
   FROM public.casos_clinicos c
  WHERE ((c.id = casos_clinicos_recursos.caso_id) AND (c.medico_id = auth.uid()))))))
  WITH CHECK (((clinica_id = public.get_clinica_id()) AND public.soy_admin_de_clinica() AND (EXISTS ( SELECT 1
   FROM public.casos_clinicos c
  WHERE ((c.id = casos_clinicos_recursos.caso_id) AND (c.medico_id = auth.uid()))))));

CREATE POLICY "authenticated_read" ON "public"."cat_cie10"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "clinica_conexiones_google_select" ON "public"."clinica_conexiones_google"
  FOR SELECT
  TO "authenticated"
  USING ((clinica_id = public.get_clinica_id()));

CREATE POLICY "clinicas_select_own_or_super_admin" ON "public"."clinicas"
  FOR SELECT
  TO "authenticated"
  USING (((id = public.get_clinica_id()) OR (public.get_my_role() = 'super_admin'::text)));

CREATE POLICY "consultas_gates_insert" ON "public"."consultas"
  AS RESTRICTIVE
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((public.clinica_no_suspendida() AND public.clinica_tiene_acceso()));

CREATE POLICY "consultas_insert" ON "public"."consultas"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((medico_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.pacientes p
  WHERE ((p.id = consultas.paciente_id) AND (p.clinica_id = public.get_clinica_id()))))));

CREATE POLICY "consultas_select" ON "public"."consultas"
  FOR SELECT
  TO "authenticated"
  USING ((((medico_id = auth.uid()) OR public.soy_admin_de_clinica()) AND (EXISTS ( SELECT 1
   FROM public.pacientes p
  WHERE ((p.id = consultas.paciente_id) AND (p.clinica_id = public.get_clinica_id()))))));

CREATE POLICY "consultas_update" ON "public"."consultas"
  FOR UPDATE
  TO "authenticated"
  USING (((medico_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.pacientes p
  WHERE ((p.id = consultas.paciente_id) AND (p.clinica_id = public.get_clinica_id()))))))
  WITH CHECK (((medico_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.pacientes p
  WHERE ((p.id = consultas.paciente_id) AND (p.clinica_id = public.get_clinica_id()))))));

CREATE POLICY "consultorios_gates_insert" ON "public"."consultorios"
  AS RESTRICTIVE
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((public.clinica_no_suspendida() AND public.clinica_tiene_acceso()));

CREATE POLICY "consultorios_insert" ON "public"."consultorios"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((medico_id = auth.uid()) AND (clinica_id = public.get_clinica_id()) AND (public.get_my_role() = 'medico'::text)));

CREATE POLICY "consultorios_select" ON "public"."consultorios"
  FOR SELECT
  TO "authenticated"
  USING (((clinica_id = public.get_clinica_id()) AND ((medico_id = auth.uid()) OR (public.get_my_role() = 'secretaria'::text))));

CREATE POLICY "consultorios_update" ON "public"."consultorios"
  FOR UPDATE
  TO "authenticated"
  USING (((medico_id = auth.uid()) AND (clinica_id = public.get_clinica_id())))
  WITH CHECK (((medico_id = auth.uid()) AND (clinica_id = public.get_clinica_id())));

CREATE POLICY "documentos_delete" ON "public"."documentos"
  FOR DELETE
  TO "authenticated"
  USING (((subido_por = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.pacientes p
  WHERE ((p.id = documentos.paciente_id) AND (p.clinica_id = public.get_clinica_id()))))));

CREATE POLICY "documentos_gates_insert" ON "public"."documentos"
  AS RESTRICTIVE
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((public.clinica_no_suspendida() AND public.clinica_tiene_acceso()));

CREATE POLICY "documentos_insert" ON "public"."documentos"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((subido_por = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.pacientes p
  WHERE ((p.id = documentos.paciente_id) AND (p.clinica_id = public.get_clinica_id()))))));

CREATE POLICY "documentos_select" ON "public"."documentos"
  FOR SELECT
  TO "authenticated"
  USING ((((subido_por = auth.uid()) OR (subido_por IS NULL)) AND (EXISTS ( SELECT 1
   FROM public.pacientes p
  WHERE ((p.id = documentos.paciente_id) AND (p.clinica_id = public.get_clinica_id()))))));

CREATE POLICY "documentos_update" ON "public"."documentos"
  FOR UPDATE
  TO "authenticated"
  USING (((subido_por = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.pacientes p
  WHERE ((p.id = documentos.paciente_id) AND (p.clinica_id = public.get_clinica_id()))))))
  WITH CHECK (((subido_por = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.pacientes p
  WHERE ((p.id = documentos.paciente_id) AND (p.clinica_id = public.get_clinica_id()))))));

CREATE POLICY "firmas_documento_insert" ON "public"."firmas_documento"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((creado_por = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.documentos d
  WHERE ((d.id = firmas_documento.documento_id) AND (d.subido_por = auth.uid()) AND (d.estado = 'borrador'::text))))));

CREATE POLICY "firmas_documento_select" ON "public"."firmas_documento"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.documentos d
  WHERE ((d.id = firmas_documento.documento_id) AND (d.subido_por = auth.uid())))));

CREATE POLICY "tokens_delete_own" ON "public"."google_tokens"
  FOR DELETE
  TO "authenticated"
  USING ((user_id = auth.uid()));

CREATE POLICY "tokens_insert_own" ON "public"."google_tokens"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "tokens_select_own" ON "public"."google_tokens"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = auth.uid()));

CREATE POLICY "tokens_update_own" ON "public"."google_tokens"
  FOR UPDATE
  TO "authenticated"
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "invitaciones_delete" ON "public"."invitaciones"
  FOR DELETE
  TO "authenticated"
  USING (((clinica_id = public.get_clinica_id()) AND public.soy_admin_de_clinica()));

CREATE POLICY "invitaciones_insert" ON "public"."invitaciones"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((clinica_id = public.get_clinica_id()) AND public.soy_admin_de_clinica()));

CREATE POLICY "invitaciones_select" ON "public"."invitaciones"
  FOR SELECT
  TO "authenticated"
  USING (((clinica_id = public.get_clinica_id()) AND public.soy_admin_de_clinica()));

CREATE POLICY "Lectura para usuarios autenticados" ON "public"."medicamentos"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "mediciones_delete" ON "public"."mediciones_analitos"
  FOR DELETE
  TO "authenticated"
  USING (((creado_por = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.pacientes p
  WHERE ((p.id = mediciones_analitos.paciente_id) AND (p.clinica_id = public.get_clinica_id()))))));

CREATE POLICY "mediciones_gates_insert" ON "public"."mediciones_analitos"
  AS RESTRICTIVE
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((public.clinica_no_suspendida() AND public.clinica_tiene_acceso()));

CREATE POLICY "mediciones_insert" ON "public"."mediciones_analitos"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((creado_por = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.pacientes p
  WHERE ((p.id = mediciones_analitos.paciente_id) AND (p.clinica_id = public.get_clinica_id()))))));

CREATE POLICY "mediciones_select" ON "public"."mediciones_analitos"
  FOR SELECT
  TO "authenticated"
  USING ((((creado_por = auth.uid()) OR public.soy_admin_de_clinica()) AND (EXISTS ( SELECT 1
   FROM public.pacientes p
  WHERE ((p.id = mediciones_analitos.paciente_id) AND (p.clinica_id = public.get_clinica_id()))))));

CREATE POLICY "mediciones_update" ON "public"."mediciones_analitos"
  FOR UPDATE
  TO "authenticated"
  USING (((creado_por = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.pacientes p
  WHERE ((p.id = mediciones_analitos.paciente_id) AND (p.clinica_id = public.get_clinica_id()))))))
  WITH CHECK (((creado_por = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.pacientes p
  WHERE ((p.id = mediciones_analitos.paciente_id) AND (p.clinica_id = public.get_clinica_id()))))));

CREATE POLICY "paciente_medico_delete" ON "public"."paciente_medico"
  FOR DELETE
  TO "authenticated"
  USING (((medico_id = auth.uid()) OR (public.soy_admin_de_clinica() AND public.paciente_pertenece_a_mi_clinica(paciente_id))));

CREATE POLICY "paciente_medico_insert" ON "public"."paciente_medico"
  FOR INSERT
  TO "authenticated"
  WITH
    CHECK
    ((public.paciente_pertenece_a_mi_clinica(paciente_id) AND (((public.get_my_role() = 'medico'::text) AND (medico_id = auth.uid())) OR public.soy_admin_de_clinica() OR
    (public.get_my_role() = 'secretaria'::text))));

CREATE POLICY "paciente_medico_select" ON "public"."paciente_medico"
  FOR SELECT
  TO "authenticated"
  USING
    (((medico_id = auth.uid()) OR (public.soy_admin_de_clinica() AND public.paciente_pertenece_a_mi_clinica(paciente_id)) OR ((public.get_my_role() = 'secretaria'::text) AND
    public.paciente_pertenece_a_mi_clinica(paciente_id))));

CREATE POLICY "pacientes_gates_insert" ON "public"."pacientes"
  AS RESTRICTIVE
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((public.clinica_no_suspendida() AND public.clinica_tiene_acceso() AND public.clinica_dentro_de_limite()));

CREATE POLICY "pacientes_insert" ON "public"."pacientes"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((clinica_id = public.get_clinica_id()) AND (public.get_my_role() = ANY (ARRAY['medico'::text, 'secretaria'::text]))));

CREATE POLICY "pacientes_select_activos" ON "public"."pacientes"
  FOR SELECT
  TO "authenticated"
  USING
    (((clinica_id = public.get_clinica_id()) AND ((activo = true) OR (activo IS NULL)) AND (public.soy_admin_de_clinica() OR (public.get_my_role() = 'secretaria'::text) OR
    public.soy_medico_tratante(id))));

CREATE POLICY "pacientes_select_inactivos_admin" ON "public"."pacientes"
  FOR SELECT
  TO "authenticated"
  USING (((clinica_id = public.get_clinica_id()) AND (activo = false) AND public.soy_admin_de_clinica()));

CREATE POLICY "pacientes_update" ON "public"."pacientes"
  FOR UPDATE
  TO "authenticated"
  USING (((clinica_id = public.get_clinica_id()) AND (public.soy_admin_de_clinica() OR (public.get_my_role() = 'secretaria'::text) OR public.soy_medico_tratante(id))))
  WITH CHECK (((clinica_id = public.get_clinica_id()) AND (public.soy_admin_de_clinica() OR (public.get_my_role() = 'secretaria'::text) OR public.soy_medico_tratante(id))));

CREATE POLICY "users_own_pdf_jobs" ON "public"."pdf_jobs"
  FOR ALL
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "plantillas_documento_delete" ON "public"."plantillas_documento"
  FOR DELETE
  TO "authenticated"
  USING ((user_id = auth.uid()));

CREATE POLICY "plantillas_documento_insert" ON "public"."plantillas_documento"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "plantillas_documento_select" ON "public"."plantillas_documento"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = auth.uid()));

CREATE POLICY "plantillas_documento_update" ON "public"."plantillas_documento"
  FOR UPDATE
  TO "authenticated"
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "owner_delete" ON "public"."plantillas_honorarios"
  FOR DELETE
  TO "authenticated"
  USING ((user_id = auth.uid()));

CREATE POLICY "owner_insert" ON "public"."plantillas_honorarios"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "owner_select" ON "public"."plantillas_honorarios"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = auth.uid()));

CREATE POLICY "owner_update" ON "public"."plantillas_honorarios"
  FOR UPDATE
  TO "authenticated"
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "profiles_select" ON "public"."profiles"
  FOR SELECT
  TO "authenticated"
  USING ((((id = auth.uid()) OR public.soy_admin_de_clinica() OR (public.get_my_role() = 'secretaria'::text)) AND ((clinica_id = public.get_clinica_id()) OR (id = auth.uid()))));

CREATE POLICY "profiles_update" ON "public"."profiles"
  FOR UPDATE
  TO "authenticated"
  USING ((((id = auth.uid()) OR public.soy_admin_de_clinica()) AND ((clinica_id = public.get_clinica_id()) OR (id = auth.uid()))))
  WITH CHECK ((((id = auth.uid()) OR public.soy_admin_de_clinica()) AND ((clinica_id = public.get_clinica_id()) OR (id = auth.uid()))));

CREATE POLICY "usuario_own" ON "public"."rate_limits"
  FOR ALL
  TO "authenticated"
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "super_admin full access arco" ON "public"."solicitudes_arco"
  FOR ALL
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'super_admin'::text)))));

CREATE POLICY "casos_clinicos_storage_delete_propia_clinica" ON "storage"."objects"
  FOR DELETE
  TO "authenticated"
  USING (((bucket_id = 'casos-clinicos'::text) AND (auth.uid() IS
    NOT NULL) AND ((storage.foldername(name))[1] = 'clinicas'::text) AND ((storage.foldername(name))[2] = (public.get_clinica_id())::text)));

CREATE POLICY "casos_clinicos_storage_insert_propia_clinica" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((bucket_id = 'casos-clinicos'::text) AND (auth.uid() IS
    NOT NULL) AND ((storage.foldername(name))[1] = 'clinicas'::text) AND ((storage.foldername(name))[2] = (public.get_clinica_id())::text)));

CREATE POLICY "casos_clinicos_storage_select_propia_clinica" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'casos-clinicos'::text) AND (auth.uid() IS
    NOT NULL) AND ((storage.foldername(name))[1] = 'clinicas'::text) AND ((storage.foldername(name))[2] = (public.get_clinica_id())::text)));

CREATE POLICY "casos_clinicos_storage_update_propia_clinica" ON "storage"."objects"
  FOR UPDATE
  TO "authenticated"
  USING (((bucket_id = 'casos-clinicos'::text) AND (auth.uid() IS
    NOT NULL) AND ((storage.foldername(name))[1] = 'clinicas'::text) AND ((storage.foldername(name))[2] = (public.get_clinica_id())::text)));

CREATE POLICY "documentos_pdf_delete_tratante" ON "storage"."objects"
  FOR DELETE
  TO "authenticated"
  USING (((bucket_id = 'documentos-pdf'::text) AND (auth.uid() IS NOT NULL) AND public.soy_medico_tratante(
CASE
    WHEN ((storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text) THEN ((storage.foldername(name))[1])::uuid
    ELSE NULL::uuid
END)));

CREATE POLICY "documentos_pdf_insert_tratante" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((bucket_id = 'documentos-pdf'::text) AND (auth.uid() IS NOT NULL) AND public.soy_medico_tratante(
CASE
    WHEN ((storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text) THEN ((storage.foldername(name))[1])::uuid
    ELSE NULL::uuid
END)));

CREATE POLICY "documentos_pdf_select_tratante" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'documentos-pdf'::text) AND (auth.uid() IS NOT NULL) AND public.soy_medico_tratante(
CASE
    WHEN ((storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text) THEN ((storage.foldername(name))[1])::uuid
    ELSE NULL::uuid
END)));

CREATE POLICY "firmas_medicos_deny_all_users" ON "storage"."objects"
  AS RESTRICTIVE
  FOR ALL
  TO "anon", "authenticated"
  USING ((bucket_id <> 'firmas-medicos'::text))
  WITH CHECK ((bucket_id <> 'firmas-medicos'::text));

CREATE POLICY "identificaciones_deny_all_users" ON "storage"."objects"
  AS RESTRICTIVE
  FOR ALL
  TO "anon", "authenticated"
  USING ((bucket_id <> 'identificaciones'::text))
  WITH CHECK ((bucket_id <> 'identificaciones'::text));

CREATE POLICY "labs_documentos_delete_propia_clinica" ON "storage"."objects"
  FOR DELETE
  TO "authenticated"
  USING (((bucket_id = 'labs-documentos'::text) AND (auth.uid() IS
    NOT NULL) AND ((storage.foldername(name))[1] = 'clinicas'::text) AND ((storage.foldername(name))[2] = (public.get_clinica_id())::text)));

CREATE POLICY "labs_documentos_insert_propia_clinica" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((bucket_id = 'labs-documentos'::text) AND (auth.uid() IS
    NOT NULL) AND ((storage.foldername(name))[1] = 'clinicas'::text) AND ((storage.foldername(name))[2] = (public.get_clinica_id())::text)));

CREATE POLICY "labs_documentos_select_propia_clinica" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'labs-documentos'::text) AND (auth.uid() IS
    NOT NULL) AND ((storage.foldername(name))[1] = 'clinicas'::text) AND ((storage.foldername(name))[2] = (public.get_clinica_id())::text)));

CREATE POLICY "labs_documentos_update_propia_clinica" ON "storage"."objects"
  FOR UPDATE
  TO "authenticated"
  USING (((bucket_id = 'labs-documentos'::text) AND (auth.uid() IS
    NOT NULL) AND ((storage.foldername(name))[1] = 'clinicas'::text) AND ((storage.foldername(name))[2] = (public.get_clinica_id())::text)));

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."appointments";

COMMENT ON COLUMN "public"."appointments"."all_day" IS 'true = la cita ocupa días enteros y se pinta en la banda de todo el día de la agenda, no en la rejilla horaria. CONVENIO DE FECHAS, no romperlo: start_time = medianoche del primer día y end_time = medianoche del día SIGUIENTE al último (fin EXCLUSIVO), en la zona del consultorio de la cita (consultorio_timezone). Un solo día del 19 → 19T00:00 .. 20T00:00. Lo impone appointments_all_day_medianoche_check, que ademas obliga a que la fila lleve su consultorio_timezone: sin ella el dato es ininterpretable. Es el convenio de FullCalendar (computeAlignedDayRange) y el mismo con el que la agenda ya lee los eventos de todo el día de Google (end.date), comprobado el 2026-08-26 contra la respuesta real: un evento de un solo día llega con start.date 2026-08-27 y end.date 2026-08-28. NO es "el ultimo dia a las 23:59". EL CONVENIO DE LECTURA ES PARTE DEL TRATO: una fila con all_day se convierte a FECHA en la zona de SU consultorio —renderEnTZ(start_time, ''yyyy-MM-dd'', consultorio_timezone)— y se entrega como cadena de solo fecha; y al escribir, la medianoche se compone con fechaHoraLocalAInstante(fecha, ''00:00'', consultorio_timezone), nunca con el reloj del navegador. Leerla o escribirla en el huso del dispositivo, que es LA REGLA del resto de la agenda (src/lib/dates.ts), corre el evento un dia entero cuando quien mira no esta en el huso del consultorio. false = cita con hora, que es el caso normal y el de todas las filas anteriores a esta columna.';

COMMENT ON COLUMN "public"."appointments"."client_id" IS 'Identificador de idempotencia del outbox-engine. Permite crear citas offline y evita duplicados al reintentar sync tras timeout.';

COMMENT ON COLUMN "public"."appointments"."color" IS 'Color del evento genérico sin paciente. Lista cerrada de 6 valores por CHECK; el hex vive en globals.css (--ag-evento-*), no aquí. Ningún valor puede colisionar con los colores de ESTADO de cita ni con el morado de Google: por eso se retiraron teal (es el de "atendida") y pizarra (el de "no asistió"). NULL = sin color, y entonces la cita se pinta por su estado.';

COMMENT ON COLUMN "public"."appointments"."gcal_calendar_id" IS 'Id literal del calendario de Google donde vive google_event_id. NULL = no se sabe dónde vive el evento (o no hay evento). No es FK a propósito: sobrevive a que el calendario se recree.';

COMMENT ON COLUMN "public"."appointments"."gcal_etag" IS 'ETag del último evento que Spinus escribió en Google. Sin uso hasta la Rama 2.';

COMMENT ON COLUMN "public"."appointments"."icono" IS 'Icono del evento genérico sin paciente. Lista cerrada de 20 valores por CHECK; el identificador es el nombre del archivo de /public/icons/ sin .svg. NULL = sin icono; no existe un valor "ninguno".';

COMMENT ON COLUMN "public"."appointments"."origen" IS 'De qué lado nació la cita: spinus | google. Hasta la Rama 2 siempre spinus.';

COMMENT ON COLUMN "public"."clinica_conexiones_google"."calendar_id" IS 'Calendario de Spinus de esta conexión (calendar.app.created). NULL = aún no creado.';

COMMENT ON COLUMN "public"."clinica_conexiones_google"."estado" IS 'activa | revocada. `revocada` conserva la fila —y con ella la identidad de la cuenta y el calendario— cuando el token deja de servir.';

COMMENT ON COLUMN "public"."clinica_conexiones_google"."google_account_email" IS 'Email de la cuenta de Google conectada, para que el médico vea a cuál está enganchada su clínica. NULL = identidad desconocida.';

COMMENT ON COLUMN "public"."clinica_conexiones_google"."google_account_sub" IS 'El `sub` del id_token de Google: identificador estable de la cuenta conectada. NULL = identidad desconocida (fila migrada desde google_tokens), NO «sin cuenta».';

COMMENT ON COLUMN "public"."clinica_conexiones_google"."rol" IS 'clinica = LA conexión de la clínica, a cuyo calendario van las citas (máx. 1 por clínica, impuesto por índice único parcial). personal = conexión que existe pero no es la de la clínica.';

COMMENT ON COLUMN "public"."consultas"."appointment_id" IS 'La cita de la que salió esta consulta (plan §12.13). NULL = la consulta no vino de ninguna cita agendada, o la cita se borró después. Se escribe una sola vez, en el INSERT; nada la actualiza. ON DELETE SET NULL a propósito: el dato clínico sobrevive al borrado de la cita, sólo se pierde el vínculo.';

COMMENT ON COLUMN "public"."consultas"."client_id" IS 'Identificador de idempotencia del outbox-engine. NULL en registros anteriores al Sprint 1 de refactor offline.';

COMMENT ON COLUMN "public"."consultas"."nota_origen" IS 'Origen de la nota clínica: ''ia'' = generada con Gemini, ''manual'' = escrita por el médico. NOM-004 trazabilidad.';

COMMENT ON COLUMN "public"."documentos"."client_id" IS 'Identificador de idempotencia generado en el cliente (UUID v4 o folio). Usado por el outbox-engine para deduplicar reintentos. NULL permitido en registros pre-existentes.';

COMMENT ON COLUMN "public"."documentos"."estado" IS 'borrador: pendiente de firmar y sin imprimir, editable, SIN folio. emitido_firma_manual: salió en papel, la firma vive fuera del sistema. firmado: firmado digitalmente y sellado. Los dos últimos son TERMINALES: de ellos no se vuelve a borrador ni se pasa de uno a otro. Si el médico quiere firmas digitales sobre un documento ya impreso, emite uno nuevo.';

COMMENT ON COLUMN "public"."google_tokens"."calendar_id" IS 'Calendario propio de Spinus del médico (calendar.app.created). NULL = aún no creado; lo crea conCalendarioSpinus en la primera operación.';

COMMENT ON EXTENSION "pg_trgm" IS 'text similarity measurement and index searching based on trigrams';

COMMENT ON EXTENSION "unaccent" IS 'text search dictionary that removes accents';

COMMENT ON FUNCTION "public"."alta_conexion_google"(uuid, uuid, text, text, text, text, text, bigint) IS 'Alta o reconexión de una conexión de Google: metadata y secretos en UNA transacción, para que no pueda nacer una conexión sin tokens. Junto con guardar_secretos_conexion y leer_conexion_google_con_secretos, es el ÚNICO camino de la aplicación a private.google_conexiones_secretos: service_role no alcanza ese esquema por ningún otro. Sólo service_role puede ejecutarla. RECONECTAR NO CAMBIA EL ROL: si la conexión ya existe con un rol distinto del pedido, lanza rol_no_promovido en vez de dejarlo como estaba en silencio — callar ahí deja a la clínica sin conexión de clínica tras un relevo de administrador. Los otros errores con nombre son perfil_ajeno_a_clinica, conexion_de_otra_clinica, clinica_ya_conectada y access_token_nulo. 20260818_gcal_puente_secretos.sql.';

COMMENT ON FUNCTION "public"."asignar_folio_documento"() IS 'BEFORE INSERT OR UPDATE en public.documentos. Asigna el folio y admite fijar la versión de formato en el momento en que el documento deja de ser un borrador. Declara las transiciones válidas de estado —solo desde borrador— y la inmutabilidad del folio y de la versión de formato. Exenta a service_role.';

COMMENT ON FUNCTION "public"."clinica_dentro_de_limite"() IS 'GATE 1: true si la clinica puede agregar pacientes. VIP/pago sin tope; free topado al total de pacientes < COALESCE(max_pacientes,5) (5.C).';

COMMENT ON FUNCTION "public"."clinica_no_suspendida"() IS 'True si la clinica del usuario NO esta suspendida. Fail-closed (5.C).';

COMMENT ON FUNCTION "public"."clinica_tiene_acceso"() IS 'GATE 2: true si la clinica puede generar consultas/documentos. VIP/pago/free-virgen tienen acceso; free degradado (premium=true) queda solo-lectura (5.C).';

COMMENT ON FUNCTION "public"."clinicas_latch_premium"() IS 'Latch one-way de ha_tenido_acceso_premium: true cuando es_vip_grant o stripe_subscription_id; nunca vuelve a false (5.B.3).';

COMMENT ON FUNCTION "public"."firmas_documento_guardian"() IS 'BEFORE INSERT en firmas_documento. Impone en la base lo que no puede quedar en manos del cliente: la hora del servidor la pone el servidor, solo se firma un borrador —con FOR UPDATE, que cierra la carrera entre firmar y sellar— y la clínica necesita acceso de escritura.';

COMMENT ON FUNCTION "public"."firmas_documento_inmutable"() IS 'BEFORE UPDATE OR DELETE en firmas_documento. Rechaza siempre, salvo el borrado en cascada desde documentos —que SÍ pasa por aquí, porque PostgreSQL implementa la cascada como un DELETE real sobre la hija—. Esa excepción es lo que permite cancelar un borrador firmado.';

COMMENT ON FUNCTION "public"."generar_folio"(text) IS 'Entrega el siguiente correlativo de una clase de folio (rx/noh/cot/ci/lab/img/sup/int/den) para el año de México. Su único invocador legítimo es el trigger trg_asignar_folio_documento; NO se expone como RPC.';

COMMENT ON FUNCTION "public"."guardar_secretos_conexion"(uuid, uuid, text, text, bigint) IS 'Guarda los tokens de una conexión (refresco y reescritura). NULL en p_refresh significa «no lo toques», nunca «bórralo». Junto con alta_conexion_google y leer_conexion_google_con_secretos, es el ÚNICO camino de la aplicación a private.google_conexiones_secretos. Sólo service_role puede ejecutarla. 20260818_gcal_puente_secretos.sql.';

COMMENT ON FUNCTION "public"."leer_conexion_google_con_secretos"(uuid, uuid) IS 'Devuelve la conexión CON sus tokens. 0 filas = no existe o es de otra clínica; tiene_secretos=false = metadata sin tokens (anomalía, no «desconectado»). Junto con alta_conexion_google y guardar_secretos_conexion, es el ÚNICO camino de la aplicación a private.google_conexiones_secretos. Sólo service_role puede ejecutarla. 20260818_gcal_puente_secretos.sql.';

COMMENT ON FUNCTION "public"."paciente_pertenece_a_mi_clinica"(uuid) IS 'True si el paciente es de la clinica del usuario actual (5.C). NO usar en policy de pacientes.';

COMMENT ON FUNCTION "public"."plantillas_documento_tope"() IS 'BEFORE INSERT. Normaliza el nombre e impone el tope de 10 por médico y tipo. Va en trigger porque un CHECK no puede contar filas, y con lock consultivo porque un count(*) por sí solo no serializa nada. Asume READ COMMITTED.';

COMMENT ON FUNCTION "public"."plantillas_documento_touch"() IS 'BEFORE UPDATE. Declara inmutables el dueño, el tipo y el identificador, conserva la fecha de creación y renueva la de actualización. La inmutabilidad del tipo es parte del tope: sin ella un UPDATE esquivaría el trigger de INSERT.';

COMMENT ON FUNCTION "public"."rate_limit_intento"(text, text, integer, integer) IS 'Etapa A/D4: chequeo+inserción atómicos de un intento de auth, serializados por pg_advisory_xact_lock(1789, hashtext(ruta)). DEVUELVE UNA FILA, NO UN OBJETO: es set-returning, PostgREST la expone como array. Desde supabase-js usar .rpc(...).single(). Sin .single(), data.bloqueado es undefined (falsy) y el limitador no bloquea nunca, en silencio. restantes=0 con bloqueado=false es el ULTIMO intento permitido: ramificar por bloqueado, jamas por restantes. NO invocar las dos llamadas del login (login_ip y login_v2) dentro de una misma transaccion: dos advisory locks en orden variable implica riesgo de deadlock. Solo service_role. No usar para verificar-receta (no-tocar #4).';

COMMENT ON FUNCTION "public"."rate_limit_reset"(text) IS 'Etapa A/D5: vacia el cubo de intentos tras autenticacion exitosa. Rechaza por excepcion cualquier ruta que no sea auth:login_v2:* — R4 imposible por construccion, no por convencion. Devuelve escalar int (filas borradas). Solo service_role.';

COMMENT ON FUNCTION "public"."soy_admin_de_clinica"() IS 'True si el usuario actual es medico con es_admin_de_clinica=true (5.C).';

COMMENT ON FUNCTION "public"."soy_medico_tratante"(uuid) IS 'True si el paciente esta vinculado al usuario actual en paciente_medico (5.C). NO usar en policy de paciente_medico.';

COMMENT ON INDEX "public"."idx_ip_rate_limits_ruta_fecha" IS 'Etapa A: sirve el predicado (ruta, created_at) de rate_limit_intento. NO sustituye a idx_ip_rate_limits_ip_ruta_fecha, que sigue sirviendo a rateLimit.ts (checkAuthRateLimit / checkIpRateLimit + verificar-receta).';

COMMENT ON POLICY "clinicas_select_own_or_super_admin" ON "public"."clinicas" IS 'B1: cierra fuga de datos comerciales cross-clinica. Authenticated solo ve su clinica; super_admin ve todas. Cierre real depende de B2 (eliminar policy laxa "Usuarios ven su clinica").';

COMMENT ON SCHEMA "private" IS 'Datos que ninguna sesión de la aplicación alcanza directamente. El esquema NO tiene grants para NINGÚN rol de la aplicación, tampoco service_role: BYPASSRLS actúa sobre el filtro de filas, DESPUÉS del chequeo de privilegios de esquema y tabla, y no lo suple. Tampoco está expuesto por PostgREST. El único camino desde la aplicación son las tres funciones SECURITY DEFINER de public: alta_conexion_google, guardar_secretos_conexion y leer_conexion_google_con_secretos (20260818_gcal_puente_secretos.sql). Conceder USAGE aquí a service_role no arregla un olvido: deshace una decisión, y R6 de esa migración la afirma a propósito.';

COMMENT ON TABLE "private"."google_conexiones_secretos" IS 'access_token / refresh_token cifrados (AES-256-GCM, src/lib/encrypt.ts) de cada conexión de Google. Sin grants para ningún rol de la aplicación: ni anon, ni authenticated, ni service_role. Se llega sólo por public.leer_conexion_google_con_secretos, public.guardar_secretos_conexion y public.alta_conexion_google. El borrado se hereda del ON DELETE CASCADE desde public.clinica_conexiones_google, que corre como acción de integridad referencial. Escrito por 20260818_gcal_puente_secretos.sql, que CORRIGE al COMMENT anterior (20260817_gcal_conexion_clinica_a_esquema.sql): decía que service_role llegaba, y era falso. Ése fue el bug.';

COMMENT ON TABLE "public"."clinica_conexiones_google" IS 'Metadata de las conexiones de Google de una clínica. Sin secretos: los tokens viven en private.google_conexiones_secretos. Sustituye a public.google_tokens (retirada en el archivo B).';

COMMENT ON TABLE "public"."firmas_documento" IS 'Firmas electrónicas del consentimiento. Una fila por firmante que firmó: quien se omitió no tiene fila. El trazo va en la base, no en un bucket, porque es evidencia y debe viajar con su sello de tiempo en la misma transacción. La huella es la del documento en el momento de firmar. NUNCA se edita ni se borra: una firma es un hecho, no un dato.';

COMMENT ON TABLE "public"."folios_contador" IS 'Correlativo por clase de folio y año. Se escribe SOLO desde public.generar_folio(), que es SECURITY DEFINER y propiedad de postgres. RLS activada con CERO policies: el bypass del PROPIETARIO es lo que deja pasar al generador. NUNCA añadir FORCE ROW LEVEL SECURITY a esta tabla: quita esa exención y rompe la emisión de folios por completo.';

COMMENT ON TABLE "public"."plantillas_documento" IS 'Plantillas de formulario, por médico y por tipo de documento. Máximo 10 por combinación, impuesto por trigger con lock consultivo. El contenido NUNCA incluye datos del paciente. El NOMBRE es una etiqueta privada del médico: no se imprime en ningún documento ni viaja en el payload que reciben los formatos. Sin gate de suscripción, a diferencia de las otras siete tablas con INSERT desde cliente: una plantilla no es dato clínico ni genera documento.';

COMMENT ON TABLE "respaldos"."appointments_gcal_20260815" IS 'Mapeo cita-evento del calendario primary, antes de soltarlo (Rama 1, 2026-08-15). Unica forma de localizar los eventos huerfanos que quedan en el primary del medico.';

REVOKE ALL ON FUNCTION "public"."alta_conexion_google"(uuid, uuid, text, text, text, text, text, bigint) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."alta_conexion_google"(uuid, uuid, text, text, text, text, text, bigint) TO "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."arco_set_fecha_limite"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."asignar_folio_documento"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."clinica_dentro_de_limite"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."clinica_no_suspendida"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."clinica_tiene_acceso"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."clinicas_latch_premium"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."crear_paciente_con_medico"(jsonb, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."crear_paciente_con_medico"(jsonb, uuid) TO "anon", "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."crear_paciente_con_medico_v2"(jsonb, uuid, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."crear_paciente_con_medico_v2"(jsonb, uuid, boolean) TO "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."enforce_cap_10_consultorios_activos"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."enforce_consultorio_default_existencia"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."enforce_consultorio_default_insert"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."enforce_limite_documentos_paciente"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."enforce_limite_documentos_paciente"() TO "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."firmas_documento_guardian"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."firmas_documento_inmutable"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."generar_folio"(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."generar_folio"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_clinica_id"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."get_my_role"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."get_suscripcion_estado"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."guardar_secretos_conexion"(uuid, uuid, text, text, bigint) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."guardar_secretos_conexion"(uuid, uuid, text, text, bigint) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."leer_conexion_google_con_secretos"(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."leer_conexion_google_con_secretos"(uuid, uuid) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."listar_pacientes_expediente"(text, uuid, timestamp WITH time zone, timestamp WITH time zone, text, text, integer, integer) FROM PUBLIC;

GRANT EXECUTE
  ON FUNCTION "public"."listar_pacientes_expediente"(text, uuid, timestamp WITH time zone, timestamp WITH time zone, text, text, integer, integer)
  TO "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."log_tabla_change"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."marcar_consultorio_default"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."marcar_consultorio_default"(uuid) TO "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."paciente_pertenece_a_mi_clinica"(uuid) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."plantillas_documento_tope"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."plantillas_documento_touch"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."prevent_audit_modification"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."proteger_columnas_sensibles_profiles"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."rate_limit_intento"(text, text, integer, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."rate_limit_intento"(text, text, integer, integer) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."rate_limit_reset"(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."rate_limit_reset"(text) TO "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."sa_heatmap_horarios"(integer) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."sa_ranking_funciones"(integer) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."sa_top_medicos"(integer, integer) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."sa_uso_ia"(integer) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."soy_admin_de_clinica"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."soy_medico_tratante"(uuid) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."sync_antropometria_paciente"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."sync_antropometria_paciente"(uuid) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."trg_mediciones_antropometria"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."trg_mediciones_antropometria"() TO "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."update_casos_clinicos_updated_at"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."update_casos_recursos_updated_at"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."update_clinica_conexiones_google_updated_at"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."update_consultorios_updated_at"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."update_pdf_jobs_updated_at"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."update_plantillas_honorarios_updated_at"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT CREATE, USAGE ON SCHEMA "private" TO "postgres";

GRANT CREATE, USAGE ON SCHEMA "respaldos" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."google_conexiones_secretos" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."addendums" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."analitos_catalogo" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."appointments" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."audit_log" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."calculadora_resultados" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."casos_clinicos" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."casos_clinicos_recursos" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."cat_cie10" TO "anon", "authenticated", "postgres", "service_role";

REVOKE ALL ON TABLE "public"."clinica_conexiones_google" FROM "authenticated";

GRANT SELECT ON TABLE "public"."clinica_conexiones_google" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."clinica_conexiones_google" TO "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."clinicas" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."consultas" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."consultorios" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."documentos" TO "anon", "authenticated", "postgres", "service_role";

REVOKE ALL ON TABLE "public"."firmas_documento" FROM "authenticated";

GRANT INSERT, SELECT ON TABLE "public"."firmas_documento" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."firmas_documento" TO "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."folios_contador" TO "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."google_tokens" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."invitaciones" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."ip_rate_limits" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."medicamentos" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."mediciones_analitos" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."paciente_medico" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."pacientes" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."pdf_jobs" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."plantillas_documento" TO "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."plantillas_honorarios" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."rate_limits" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."solicitudes_arco" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."stripe_webhook_events" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "respaldos"."appointments_gcal_20260815" TO "postgres";

