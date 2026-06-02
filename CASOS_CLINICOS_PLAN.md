# Plan Maestro — Módulo Casos Clínicos

> Documento vivo. Cada etapa cerrada se marca con commit y fecha.
> Última actualización: 2026-06-02

## Regla de oro
EL DISEÑO SE ADAPTA A LA ESTRUCTURA DE DATOS Y CÓDIGO DE SPINUS, NUNCA AL REVÉS.
El handoff en design/casos-clinicos/ es solo referencia visual y de UX. No se
implementa literal. Cero modificaciones a la app para acomodar el handoff.

## Decisiones de arquitectura (congeladas)
- Acceso: SOLO admin de clínica (medico + es_admin_de_clinica). Médico invitado y secretaria NO.
- Aislamiento: ruta lazy + Error Boundary local + feature flag (columna en clinicas).
- Anotador: Konva.js (MIT), móvil-first, coordenadas fraccionales, serialización JSON.
- Ángulo de Cobb: herramienta custom sobre Konva (ninguna librería lo trae nativo).
- PDF: @react-pdf/renderer, reusa PdfHeader/marca del médico. Plantilla única.
- Redes sociales: lo ÚLTIMO que se construye. Web Share API + fallback descarga. Sin Meta API.
- Monetización (tier limits): fuera del MVP. Patrón RESTRICTIVE ya identificado (pacientes_gates_*).
- Ownership: medico_id = auth.uid(). Caso nunca huérfano (clinica_id + medico_id NOT NULL).

## Protocolo de trabajo
- DB primero; cada pantalla nace conectada a datos reales (no mocks).
- BD producción: protocolo D-T6 — SQL atómico, una query a la vez, validar resultado
  antes de la siguiente, snapshot antes, smoke test después, NUNCA Supabase CLI.
- Sub-fases atómicas con commit standalone (no squash). Validación visual en localhost antes de commit.
- Claude Code: investigación READ-ONLY previa, scope con archivos permitidos/prohibidos, diff review, no auto-commit.

## Etapas

### Etapa 1 — Diseño de base de datos ✅ (2026-06-02)
Modelo de datos, RLS, bucket y policies diseñados y VALIDADOS contra producción vía
queries directas. Esquema congelado (ver sección Esquema abajo).

### Etapa 2 — Migración / fundación de datos ✅ (2026-06-02)
SQL aplicado a producción pieza por pieza vía SQL Editor bajo Protocolo D-T6
(snapshot antes, una query a la vez, smoke test después → todo verde). Se
aplicaron 8 piezas: tabla casos_clinicos → tabla casos_clinicos_recursos →
triggers updated_at (per-tabla) → trigger audit casos_clinicos (reusa
log_tabla_change(), NOM-024) → RLS (11 policies: 7 tabla + 4 storage, todas
TO authenticated) → bucket casos-clinicos → storage policies → índices.
Auditoría READ-ONLY previa detectó y corrigió 4 desviaciones de convención
(TO authenticated faltante, bucket sin ::text[]/ON CONFLICT, sin trigger
updated_at, sin trigger audit). Registro versionado en
`supabase/migrations/20260602_casos_etapa2_fundacion.sql`.
Commit: PENDIENTE (lo hace el usuario).

### Etapa 3 — Andamiaje del módulo (aislamiento)  [PENDIENTE]
Ruta lazy-loaded, error.tsx local, feature flag (columna en clinicas), ítem sidebar
gateado a admin. Sin funcionalidad. Validación: ruta carga, resto de app intacto.

### Etapa 4 — Lista de casos (primer CRUD real)  [PENDIENTE]
Lista + crear/borrar caso conectado a tabla real. Prueba RLS end-to-end con las 3
cuentas. Vincular paciente opcional, tags, tipo de caso.

### Etapa 5 — Editor del caso (sin anotador)  [PENDIENTE]
Detalle/edición: título, descripción, metadata, subir imágenes al bucket (reusa
upload-utils), compresión cliente, reordenar recursos, descripción por imagen.

### Etapa 6 — Anotador parte 1: herramientas base (Konva, móvil-first)  [PENDIENTE]
Flecha, círculo, texto, trazo libre, blur. Coords fraccionales. Serialización JSON.
Modo navegar/anotar separado. Zonas de toque amplias. Re-edición.

### Etapa 7 — Anotador parte 2: ángulo de Cobb + pulido táctil  [PENDIENTE] 🔴 alto riesgo
Cobb: dos líneas arrastrables, cálculo en vivo, etiqueta de grados, lupa/offset.
Undo/redo completo. Validación en celular real.

### Etapa 8 — Exportación PDF  [PENDIENTE]
Renderizador @react-pdf/renderer reusando PdfHeader/marca. Header + título/descripción
+ imágenes con descripciones. Toggle "conservar anotaciones" (toDataURL con/sin marcas).

### Etapa 9 — Exportación a redes (lo último)  [PENDIENTE] 🔴 alto riesgo + legal
Encuadre feed 1:1 / historia 9:16 / carrusel, horneado a PNG, Web Share API + fallback.
Activa columnas de consentimiento: checkbox bloqueante, disclaimer, blur obligatorio.
Requiere validación legal del disclaimer (abogado LFPDPPP/NOM-024) antes de lanzar.

### Etapa 10 — Telemetría y cierre de MVP  [PENDIENTE]
Telemetría storage y casos por cuenta (sin PII). Limpieza de deuda menor. Revisión final.

## Fuera de alcance del MVP (documentado, no se construye ahora)
- Lógica de planes/tier limits (RESTRICTIVE gates — patrón pacientes_gates_*).
- Thumbnails dedicados (se usa imagen comprimida como portada).
- CDN / storage tiered (Fase 2).
- Branding personal por médico (espera multiconsultorio Fase C).
- Audit log de export a redes.

## Esquema de datos congelado (validado contra producción 2026-06-02)

### Tabla casos_clinicos
- id                       uuid PK DEFAULT uuid_generate_v4()
- clinica_id               uuid NOT NULL → clinicas(id)
- medico_id                uuid NOT NULL → profiles(id) ON DELETE RESTRICT  (= auth.uid())
- paciente_id              uuid NULL → pacientes(id) ON DELETE SET NULL  (vínculo interno, no se imprime)
- titulo                   text NOT NULL
- descripcion              text NULL  (texto plano)
- tipo_caso                text NOT NULL CHECK IN ('pre_post_operatorio','documental','evolucion_clinica','educativo','diagnostico_imagen')
- region_anatomica         text NULL  (texto libre; UI solo en pre/post-op)
- tags                     text[] NOT NULL DEFAULT '{}'
- estado                   text NOT NULL DEFAULT 'borrador' CHECK IN ('borrador','listo')
- consentimiento_otorgado  boolean NULL  (evidencia redes, fase 9)
- fecha_consentimiento     timestamptz NULL
- version_aviso_privacidad text NULL
- created_at               timestamptz NOT NULL DEFAULT now()
- updated_at               timestamptz NOT NULL DEFAULT now()
- activo                   boolean NOT NULL DEFAULT true  (soft-delete)
- fecha_baja               timestamptz NULL

### Tabla casos_clinicos_recursos
- id              uuid PK DEFAULT uuid_generate_v4()
- caso_id         uuid NOT NULL → casos_clinicos(id) ON DELETE CASCADE
- clinica_id      uuid NOT NULL → clinicas(id)  (repetido, RLS directa)
- storage_path    text NOT NULL  (clinicas/{clinica_id}/casos/{caso_id}/{archivo}; bucket implícito)
- nombre_original text NULL
- mime_type       text NOT NULL CHECK IN ('image/jpeg','image/png')
- tamano_bytes    bigint NOT NULL
- tipo            text NOT NULL CHECK IN ('foto','radiografia')
- descripcion     text NULL  (pie de la imagen)
- anotaciones     jsonb NOT NULL DEFAULT '[]'  (figuras Konva, coords fraccionales)
- orden           int NOT NULL DEFAULT 0
- created_at      timestamptz NOT NULL DEFAULT now()
- updated_at      timestamptz NOT NULL DEFAULT now()

### RLS (helpers confirmados: get_clinica_id(), soy_admin_de_clinica(), auth.uid())
casos_clinicos (select/insert/update):
  clinica_id = get_clinica_id() AND medico_id = auth.uid() AND soy_admin_de_clinica()
  (sin DELETE de usuario; borrado = UPDATE activo=false)
casos_clinicos_recursos (select/insert/update/delete):
  clinica_id = get_clinica_id() AND soy_admin_de_clinica()
  AND EXISTS (SELECT 1 FROM casos_clinicos c WHERE c.id = caso_id AND c.medico_id = auth.uid())

### Bucket casos-clinicos (patrón labs_documentos_*)
- privado, file_size_limit 15728640 (15 MB), MIME ['image/jpeg','image/png']
- path: clinicas/{clinica_id}/casos/{caso_id}/{archivo}
- 4 policies (select/insert/update/delete):
  bucket_id='casos-clinicos' AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1]='clinicas'
  AND (storage.foldername(name))[2]=get_clinica_id()::text

### Índices
- casos_clinicos: (clinica_id, medico_id), (paciente_id), GIN(tags)
- casos_clinicos_recursos: (caso_id), (clinica_id)

## Hallazgos de la validación contra producción (correcciones al diseño inicial)
- PK usa uuid_generate_v4(), NO gen_random_uuid().
- Ownership es medico_id (= auth.uid() directo), NO created_by.
- Consentimiento: nombres reales fecha_consentimiento y version_aviso_privacidad.
- Path storage: clinicas/{clinica_id}/casos/... (literal 'clinicas' en segmento [1], clinica_id en [2]).
- Storage policies existen en BD (no solo dashboard); se versionan copiando patrón labs_documentos_*.
- clinica_id/medico_id NOT NULL en tablas nuevas (pacientes es nullable por legacy; no se replica el defecto).
