-- Permite guardar documentos (recetas standalone) sin paciente_id
-- El QR de verificación usa admin client (bypassa RLS), así que la lectura funciona igual

drop policy if exists "clinica_insert" on documentos;

create policy "clinica_insert" on documentos for insert to authenticated
  with check (
    paciente_id is null
    or exists (
      select 1 from pacientes p
      where p.id = documentos.paciente_id
        and p.clinica_id = public.get_clinica_id()
    )
  );
