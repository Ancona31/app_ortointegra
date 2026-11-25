-- E0 · semilla MÍNIMA e inventada para correr m_saludo_recordatorio.sql fuera del stack local (que
-- espera la semilla de scripts/agenda-semilla.ts: Clínica Semilla A y B, admin.a@semilla.spinus.test
-- con consultorio y una cita con paciente en A). Sólo para los contenedores desechables de E0.
begin;
insert into public.clinicas (id, nombre, es_vip_grant) values
  ('00000000-0000-4000-8000-00000005ec01', 'Clínica Semilla A', true),
  ('00000000-0000-4000-8000-00000005ec02', 'Clínica Semilla B', true);
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-4000-8000-00000005eb01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin.a@semilla.spinus.test', now(), now());
update public.profiles set clinica_id = '00000000-0000-4000-8000-00000005ec01', es_admin_de_clinica = true,
       nombres = 'Admin', apellido_paterno = 'A', especialidad = 'Ortopedia', cedula_profesional = '1111111'
 where id = '00000000-0000-4000-8000-00000005eb01';
insert into public.consultorios (id, clinica_id, medico_id, nombre, nombre_corto, direccion, activo) values
  ('00000000-0000-4000-8000-00000005ed01', '00000000-0000-4000-8000-00000005ec01', '00000000-0000-4000-8000-00000005eb01', 'Semilla', 'S', 'Calle', true);
insert into public.pacientes (id, clinica_id, nombre, apellidos) values
  ('00000000-0000-4000-8000-00000005ef01', '00000000-0000-4000-8000-00000005ec01', 'Beto', 'Semilla');
insert into public.appointments (id, clinica_id, paciente_id, medico_id, consultorio_id, consultorio_nombre, title, start_time, end_time) values
  ('00000000-0000-4000-8000-00000005ee01', '00000000-0000-4000-8000-00000005ec01', '00000000-0000-4000-8000-00000005ef01',
   '00000000-0000-4000-8000-00000005eb01', '00000000-0000-4000-8000-00000005ed01', 'Semilla', 'Beto Semilla', now() + interval '5 days', now() + interval '5 days 30 minutes');
commit;
