-- ════════════════════════════════════════════════════════
-- MIGRACIÓN: Audit log (NOM-024-SSA3 / trazabilidad)
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════

-- ─── 1. Tabla audit_log ───────────────────────────────────
create table if not exists audit_log (
  id          uuid primary key default uuid_generate_v4(),
  user_id     text,            -- auth.uid() o 'system' para triggers de servicio
  accion      text not null,   -- 'INSERT' | 'UPDATE' | 'DELETE' | 'ver_expediente' | 'generar_pdf' | etc.
  tabla       text,            -- nombre de la tabla afectada
  registro_id uuid,            -- id del registro afectado
  ip          text,            -- solo disponible en logs desde la API
  descripcion text,            -- contexto adicional opcional
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_log_user_fecha
  on audit_log(user_id, created_at desc);

create index if not exists idx_audit_log_tabla_registro
  on audit_log(tabla, registro_id);

-- RLS: solo admins pueden leer el audit log; nadie puede modificarlo
alter table audit_log enable row level security;

create policy "audit_admin_select" on audit_log
  for select to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('admin', 'super_admin')
    )
  );

-- Sin policy de insert/update/delete para authenticated —
-- solo el service role (backend) puede escribir

-- ─── 2. Función trigger para mutaciones ──────────────────
create or replace function log_tabla_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- ─── 3. Triggers en tablas clínicas ──────────────────────
-- pacientes
create trigger audit_pacientes
  after insert or update or delete on pacientes
  for each row execute function log_tabla_change();

-- consultas
create trigger audit_consultas
  after insert or update or delete on consultas
  for each row execute function log_tabla_change();

-- documentos
create trigger audit_documentos
  after insert or update or delete on documentos
  for each row execute function log_tabla_change();

-- laboratorios
create trigger audit_laboratorios
  after insert or update or delete on laboratorios
  for each row execute function log_tabla_change();
