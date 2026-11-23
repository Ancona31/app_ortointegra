-- E0 · extrae, normalizados, los datos que las migraciones pudieron tocar (para diff A ↔ B).
-- Sólo lee. Los uuid generados y los instantes con fracción de segundo se enmascaran.
\pset format unaligned
\pset tuples_only on
with filas as (
  select 'consultorios' t, (to_jsonb(k) - 'created_at' - 'updated_at')::text f from public.consultorios k
  union all select 'clinicas', jsonb_build_object('id', c.id, 'timezone', c.timezone, 'horario', c.horario_consulta)::text from public.clinicas c
  union all select 'appointments', (to_jsonb(a) - 'created_at' - 'updated_at')::text from public.appointments a
  union all select 'respaldo', to_jsonb(r)::text from respaldos.consultorios_horario_20261119 r
  union all select 'audit_log', jsonb_build_object('accion', l.accion, 'tabla', l.tabla, 'registro', l.registro_id, 'user', l.user_id, 'desc', l.descripcion)::text
    from public.audit_log l
  union all select 'agenda_ajustes', count(*)::text from public.agenda_ajustes
  union all select 'tipos_cita', count(*)::text from public.tipos_cita
  union all select 'avisos_clinica', count(*)::text from public.avisos_clinica
  union all select 'reserva_avisos', count(*)::text from public.reserva_avisos
)
select t || E'\t' || regexp_replace(regexp_replace(f,
         '[0-9a-f]{8}-(?!0000-4000-8000-)[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '<uuid>', 'g'),
         '\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d\.\d+([+-]\d\d(:\d\d)?)?', '<ahora>', 'g')
  from filas order by 1;
