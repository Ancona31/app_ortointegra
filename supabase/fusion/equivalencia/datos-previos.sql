-- E0 · datos INVENTADOS que imitan lo que producción ya tiene ANTES de la agenda v2 (sólo tablas de
-- main), para ver que las 44 originales y las 6 fundidas dejan los MISMOS datos (backfill del horario,
-- columnas nuevas con su DEFAULT, filas de respaldo y de audit_log). Se aplica a dos clones nuevos de
-- base-main (spinus-e0-c / spinus-e0-d), que se tiran al terminar; aquí SÍ se confirma (COMMIT).
begin;
insert into public.clinicas (id, nombre, es_vip_grant, horario_consulta) values
  ('00000000-0000-4000-8000-0000000d0c01', 'Previa uno', true,
   '{"lunes":{"fin":"18:00","activo":true,"inicio":"08:00"},"martes":{"fin":"18:00","activo":true,"inicio":"08:00"},"miercoles":{"fin":"18:00","activo":false,"inicio":"08:00"},"jueves":{"fin":"18:00","activo":true,"inicio":"08:00"},"viernes":{"fin":"15:00","activo":true,"inicio":"08:00"},"sabado":{"fin":"13:00","activo":true,"inicio":"09:00"},"domingo":{"fin":"14:00","activo":false,"inicio":"09:00"}}'),
  ('00000000-0000-4000-8000-0000000d0c02', 'Previa dos', false, default);
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-0000000d0b01'::uuid, 'previa-m1@prueba.local'),
               ('00000000-0000-4000-8000-0000000d0b02'::uuid, 'previa-m2@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000d0c01', es_admin_de_clinica = true,
       nombres = 'Médico', apellido_paterno = 'Previo', especialidad = 'Ortopedia', cedula_profesional = '7654321'
 where id = '00000000-0000-4000-8000-0000000d0b01';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000d0c02', es_admin_de_clinica = true,
       nombres = 'Médica', apellido_paterno = 'Previa', especialidad = 'Ortopedia', cedula_profesional = '7654322'
 where id = '00000000-0000-4000-8000-0000000d0b02';
-- k1: sin horario propio (lo hereda); k2: con un horario distinto en su columna (antes no se usaba);
-- k9: de la otra clínica (horario por omisión de la clínica).
insert into public.consultorios (id, clinica_id, medico_id, nombre, nombre_corto, direccion, activo, horario, timezone) values
  ('00000000-0000-4000-8000-0000000d0d01', '00000000-0000-4000-8000-0000000d0c01', '00000000-0000-4000-8000-0000000d0b01', 'Uno', 'U', 'Calle 1', true, default, 'America/Mexico_City'),
  ('00000000-0000-4000-8000-0000000d0d02', '00000000-0000-4000-8000-0000000d0c01', '00000000-0000-4000-8000-0000000d0b01', 'Dos', 'D', 'Calle 2', true,
   '{"lunes":{"fin":"12:00","activo":true,"inicio":"10:00"},"martes":{"fin":"19:00","activo":false,"inicio":"09:00"},"miercoles":{"fin":"19:00","activo":false,"inicio":"09:00"},"jueves":{"fin":"19:00","activo":false,"inicio":"09:00"},"viernes":{"fin":"19:00","activo":false,"inicio":"09:00"},"sabado":{"fin":"14:00","activo":false,"inicio":"09:00"},"domingo":{"fin":"14:00","activo":false,"inicio":"09:00"}}', 'America/Cancun'),
  ('00000000-0000-4000-8000-0000000d0d09', '00000000-0000-4000-8000-0000000d0c02', '00000000-0000-4000-8000-0000000d0b02', 'Nueve', 'N', 'Calle 9', true, default, 'America/Tijuana');
insert into public.pacientes (id, clinica_id, nombre, apellidos) values
  ('00000000-0000-4000-8000-0000000d0f01', '00000000-0000-4000-8000-0000000d0c01', 'Paciente', 'Previo');
insert into public.appointments (id, clinica_id, paciente_id, medico_id, consultorio_id, consultorio_nombre, title, start_time, end_time, status, notes, origen, google_event_id) values
  ('00000000-0000-4000-8000-0000000d0e01', '00000000-0000-4000-8000-0000000d0c01', '00000000-0000-4000-8000-0000000d0f01', '00000000-0000-4000-8000-0000000d0b01',
   '00000000-0000-4000-8000-0000000d0d01', 'Uno', 'Paciente Previo', '2026-10-01 16:00+00', '2026-10-01 16:30+00', 'attended', 'antigua', 'spinus', null),
  ('00000000-0000-4000-8000-0000000d0e02', '00000000-0000-4000-8000-0000000d0c01', '00000000-0000-4000-8000-0000000d0f01', '00000000-0000-4000-8000-0000000d0b01',
   '00000000-0000-4000-8000-0000000d0d02', 'Dos', 'Paciente Previo', '2027-01-10 16:00+00', '2027-01-10 16:30+00', 'scheduled', null, 'spinus', 'gev-1'),
  ('00000000-0000-4000-8000-0000000d0e03', '00000000-0000-4000-8000-0000000d0c01', null, '00000000-0000-4000-8000-0000000d0b01',
   null, null, 'Junta', '2027-01-11 16:00+00', '2027-01-11 17:00+00', 'scheduled', null, 'google', 'gev-2'),
  ('00000000-0000-4000-8000-0000000d0e04', '00000000-0000-4000-8000-0000000d0c02', null, '00000000-0000-4000-8000-0000000d0b02',
   null, null, 'Cancelada', '2027-01-12 16:00+00', '2027-01-12 17:00+00', 'cancelled', null, 'spinus', null);
commit;
