-- ═══════════════════════════════════════════════════════════════
-- ⚠️  ADVERTENCIA: NO EJECUTAR EN PRODUCCIÓN
-- Este SQL ya fue ejecutado manualmente en Supabase (2026-04-22)
-- con validación paso a paso. Este archivo existe SOLO para:
--   1. Trazabilidad en git del schema cambiado
--   2. Poder recrear el schema en un ambiente nuevo (staging, dev)
-- Si necesitas re-ejecutar en un ambiente nuevo, revisa cada sección
-- y valida que las tablas/buckets existan primero.
-- ═══════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════
-- MIGRACIÓN: uploads de documentos clínicos en /laboratorios
-- (rediseño labs — sub-fase 6A)
-- Amplía la tabla documentos con metadata de Storage, relaja el
-- NOT NULL de contenido, agrega CHECK de origen, impone límite de
-- 100 docs clínicos por paciente y crea las policies del bucket
-- privado labs-documentos (scope estricto por clínica).
-- Requiere:
--   - public.profiles(id) existente
--   - public.get_clinica_id() existente
--   - bucket 'labs-documentos' creado en Supabase Storage
--   - CHECK documentos_tipo_check ya extendido con los valores
--     'resultado_laboratorio' y 'estudio_imagen' (sub-fase 1A,
--     supabase_migration_labs_documentos_tipos.sql)
-- ════════════════════════════════════════════════════════

-- ─── 1. Columnas nuevas en documentos ────────────────────
-- Todas nullable para no romper los 494 registros existentes.
alter table public.documentos
  add column if not exists storage_bucket  text,
  add column if not exists storage_path    text,
  add column if not exists mime_type       text,
  add column if not exists tamaño_bytes    bigint,
  add column if not exists nombre_original text,
  add column if not exists subido_por      uuid references public.profiles(id) on delete restrict;

-- ─── 2. Relajar contenido NOT NULL + CHECK de origen ─────
-- Los uploads no usan `contenido` (jsonb del formulario). El CHECK
-- fuerza que cada documento tenga al menos un origen válido:
--   - contenido  → documento generado por la app (recetas, etc.)
--   - storage_path → documento subido por el usuario
alter table public.documentos
  alter column contenido drop not null;

alter table public.documentos
  drop constraint if exists documentos_tiene_origen_check;

alter table public.documentos
  add constraint documentos_tiene_origen_check check (
    contenido is not null
    or storage_path is not null
  );

-- ─── 3. Trigger de límite 100 docs clínicos por paciente ─
-- Enforcement server-side del límite duro. Solo aplica a documentos
-- subidos desde /laboratorios (tipos 'resultado_laboratorio' y
-- 'estudio_imagen'). Los documentos generados por la app (recetas,
-- informes, solicitudes, etc.) NO cuentan contra este cupo.
--
-- SECURITY DEFINER + search_path fijo porque el count necesita
-- bypass de RLS para ser correcto (la policy del usuario podría
-- ocultar docs y falsear el conteo).
create or replace function public.enforce_limite_documentos_paciente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  -- Solo aplica a documentos clínicos de /laboratorios.
  if NEW.tipo not in ('resultado_laboratorio', 'estudio_imagen') then
    return NEW;
  end if;

  -- Documentos sin paciente (raros) no cuentan.
  if NEW.paciente_id is null then
    return NEW;
  end if;

  select count(*) into v_count
  from public.documentos
  where paciente_id = NEW.paciente_id
    and tipo in ('resultado_laboratorio', 'estudio_imagen');

  if v_count >= 100 then
    raise exception 'Límite de 100 documentos clínicos por paciente alcanzado (paciente_id=%)', NEW.paciente_id
      using errcode = 'check_violation';
  end if;

  return NEW;
end;
$$;

revoke execute on function public.enforce_limite_documentos_paciente() from public, authenticated, anon;

drop trigger if exists trg_documentos_limite_paciente on public.documentos;
create trigger trg_documentos_limite_paciente
  before insert on public.documentos
  for each row
  execute function public.enforce_limite_documentos_paciente();

-- ─── 4. Policies RLS del bucket labs-documentos ──────────
-- Estructura de path esperada:
--   clinicas/{clinica_id}/pacientes/{paciente_id}/{uuid}.{ext}
-- El scope se valida con storage.foldername(name):
--   [1] = 'clinicas'
--   [2] = clinica_id del usuario (vía public.get_clinica_id())
-- La protección por paciente queda delegada a la RLS de
-- public.documentos (el INSERT en documentos ya valida clínica).
drop policy if exists "labs_documentos_select_propia_clinica" on storage.objects;
create policy "labs_documentos_select_propia_clinica"
on storage.objects for select
to authenticated
using (
  bucket_id = 'labs-documentos'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = 'clinicas'
  and (storage.foldername(name))[2] = public.get_clinica_id()::text
);

drop policy if exists "labs_documentos_insert_propia_clinica" on storage.objects;
create policy "labs_documentos_insert_propia_clinica"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'labs-documentos'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = 'clinicas'
  and (storage.foldername(name))[2] = public.get_clinica_id()::text
);

drop policy if exists "labs_documentos_update_propia_clinica" on storage.objects;
create policy "labs_documentos_update_propia_clinica"
on storage.objects for update
to authenticated
using (
  bucket_id = 'labs-documentos'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = 'clinicas'
  and (storage.foldername(name))[2] = public.get_clinica_id()::text
);

drop policy if exists "labs_documentos_delete_propia_clinica" on storage.objects;
create policy "labs_documentos_delete_propia_clinica"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'labs-documentos'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = 'clinicas'
  and (storage.foldername(name))[2] = public.get_clinica_id()::text
);

-- ─── 5. Post-ejecución / notas ──────────────────────────
-- 1. Regenerar types TS:
--      npx supabase gen types typescript --project-id <id> \
--        > src/types/database.types.ts
--    Las 6 columnas nuevas son nullable; mientras se regenera, los
--    tipos manuales en src/types/index.ts (Documento, TipoDocumento)
--    cubren la diferencia.
-- 2. En Supabase Dashboard → Storage → labs-documentos → Policies
--    deben aparecer las 4 policies listadas arriba.
-- 3. Smoke test: intentar insertar 101 documentos con
--    tipo='resultado_laboratorio' para el mismo paciente_id debe
--    fallar con
--    'Límite de 100 documentos clínicos por paciente alcanzado'.
-- 4. Verificar que insertar recetas/informes/etc. para un paciente
--    con ya 100 labs-docs sigue funcionando (no bloqueado por el
--    trigger gracias al filtro por tipo).

-- FIN DE MIGRACIÓN
