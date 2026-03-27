-- ════════════════════════════════════════════════════════
-- MIGRACIÓN: RLS multi-clínica + clinica_id en pacientes
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════

-- ─── 1. Agregar clinica_id a pacientes ────────────────
alter table pacientes
  add column if not exists clinica_id uuid references clinicas(id) on delete set null;

create index if not exists idx_pacientes_clinica on pacientes(clinica_id);
create index if not exists idx_pacientes_apellidos on pacientes(apellidos);

-- ─── 2. Poblar clinica_id en pacientes existentes ─────
update pacientes p
set clinica_id = (
  select pr.clinica_id
  from profiles pr
  where pr.role in ('medico', 'admin')
    and pr.clinica_id is not null
  limit 1
)
where p.clinica_id is null;

-- ─── 3. Eliminar políticas permisivas anteriores ──────
drop policy if exists "Allow authenticated all" on pacientes;
drop policy if exists "Allow authenticated all" on consultas;
drop policy if exists "Allow authenticated all" on laboratorios;
drop policy if exists "Allow authenticated all" on documentos;

-- ─── 4. Helper en schema public ───────────────────────
create or replace function public.get_clinica_id()
returns uuid
language sql
stable
security definer
as $$
  select clinica_id from profiles where id = auth.uid()
$$;

-- ─── 5. Nuevas políticas RLS en pacientes ─────────────
create policy "clinica_select" on pacientes
  for select to authenticated
  using (clinica_id = public.get_clinica_id());

create policy "clinica_insert" on pacientes
  for insert to authenticated
  with check (clinica_id = public.get_clinica_id());

create policy "clinica_update" on pacientes
  for update to authenticated
  using (clinica_id = public.get_clinica_id())
  with check (clinica_id = public.get_clinica_id());

create policy "clinica_delete" on pacientes
  for delete to authenticated
  using (clinica_id = public.get_clinica_id());

-- ─── 6. Nuevas políticas RLS en consultas ─────────────
create policy "clinica_select" on consultas
  for select to authenticated
  using (
    exists (
      select 1 from pacientes p
      where p.id = consultas.paciente_id
        and p.clinica_id = public.get_clinica_id()
    )
  );

create policy "clinica_insert" on consultas
  for insert to authenticated
  with check (
    exists (
      select 1 from pacientes p
      where p.id = consultas.paciente_id
        and p.clinica_id = public.get_clinica_id()
    )
  );

create policy "clinica_update" on consultas
  for update to authenticated
  using (
    exists (
      select 1 from pacientes p
      where p.id = consultas.paciente_id
        and p.clinica_id = public.get_clinica_id()
    )
  );

create policy "clinica_delete" on consultas
  for delete to authenticated
  using (
    exists (
      select 1 from pacientes p
      where p.id = consultas.paciente_id
        and p.clinica_id = public.get_clinica_id()
    )
  );

-- ─── 7. Nuevas políticas RLS en laboratorios ──────────
create policy "clinica_select" on laboratorios
  for select to authenticated
  using (
    exists (
      select 1 from pacientes p
      where p.id = laboratorios.paciente_id
        and p.clinica_id = public.get_clinica_id()
    )
  );

create policy "clinica_insert" on laboratorios
  for insert to authenticated
  with check (
    exists (
      select 1 from pacientes p
      where p.id = laboratorios.paciente_id
        and p.clinica_id = public.get_clinica_id()
    )
  );

create policy "clinica_update" on laboratorios
  for update to authenticated
  using (
    exists (
      select 1 from pacientes p
      where p.id = laboratorios.paciente_id
        and p.clinica_id = public.get_clinica_id()
    )
  );

create policy "clinica_delete" on laboratorios
  for delete to authenticated
  using (
    exists (
      select 1 from pacientes p
      where p.id = laboratorios.paciente_id
        and p.clinica_id = public.get_clinica_id()
    )
  );

-- ─── 8. Nuevas políticas RLS en documentos ────────────
create policy "clinica_select" on documentos
  for select to authenticated
  using (
    exists (
      select 1 from pacientes p
      where p.id = documentos.paciente_id
        and p.clinica_id = public.get_clinica_id()
    )
  );

create policy "clinica_insert" on documentos
  for insert to authenticated
  with check (
    exists (
      select 1 from pacientes p
      where p.id = documentos.paciente_id
        and p.clinica_id = public.get_clinica_id()
    )
  );

create policy "clinica_update" on documentos
  for update to authenticated
  using (
    exists (
      select 1 from pacientes p
      where p.id = documentos.paciente_id
        and p.clinica_id = public.get_clinica_id()
    )
  );

create policy "clinica_delete" on documentos
  for delete to authenticated
  using (
    exists (
      select 1 from pacientes p
      where p.id = documentos.paciente_id
        and p.clinica_id = public.get_clinica_id()
    )
  );
