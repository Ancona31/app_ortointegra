import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { soloEscritorio, sqlLocal } from './ayudas'

/**
 * Punto 10 de Angel · el backfill de la herencia de horario (sección 8 de
 * `20261201120000_agenda_f1_ajustes_tipos_horarios.sql`, que funde la original
 * `20261119130000_agenda_g4_herencia_horario_consultorios.sql`) contra datos
 * propios, DOS pasadas seguidas y todo en una transacción que se deshace (no
 * deja nada en la base). Corre el TEXTO REAL de esa sección del archivo (del
 * CREATE TABLE del respaldo al UPDATE), no una copia: una mutación del archivo
 * se ve aquí. El resto del archivo no: su pre-vuelo aborta con F1 ya aplicado.
 *
 *   · el consultorio SIN horario propio hereda el de su clínica (también el
 *     archivado), con su fila de respaldo y su fila UPDATE en audit_log;
 *   · el que YA tenía horario propio no se toca;
 *   · la segunda pasada no cambia nada (ni respaldo, ni audit_log);
 *   · clinicas.horario_consulta no cambia.
 */
soloEscritorio()

const MIGRACION = path.resolve(process.cwd(), 'supabase/migrations/20261201120000_agenda_f1_ajustes_tipos_horarios.sql')

function cuerpo(): string {
  const s = readFileSync(MIGRACION, 'utf8')
  const i = s.indexOf('\nCREATE TABLE IF NOT EXISTS respaldos.consultorios_horario_20261119 (')
  const j = s.indexOf('\n-- 9 · ', i)
  if (i < 0 || j < i) throw new Error('la migración no tiene su sección 8 (backfill) seguida de la 9')
  return s.slice(i + 1, j)
}

const CL = '00000000-0000-4000-8000-0000000064c1'
const MED = '00000000-0000-4000-8000-0000000064a1'
const A = '00000000-0000-4000-8000-0000000064e1'
const B = '00000000-0000-4000-8000-0000000064e2'
const C = '00000000-0000-4000-8000-0000000064e3'
const CLINICA = '{"lunes":{"activo":true,"inicio":"07:00","fin":"15:00"},"martes":{"activo":true,"inicio":"07:00","fin":"15:00"},"miercoles":{"activo":false,"inicio":"09:00","fin":"14:00"},"jueves":{"activo":true,"inicio":"07:00","fin":"15:00"},"viernes":{"activo":true,"inicio":"07:00","fin":"15:00"},"sabado":{"activo":false,"inicio":"09:00","fin":"14:00"},"domingo":{"activo":false,"inicio":"09:00","fin":"14:00"}}'
const INERTE = '{"lunes":{"activo":true,"inicio":"20:00","fin":"22:00"}}'
const PROPIO = '{"lunes":{"activo":true,"inicio":"10:00","fin":"12:00"}}'

const FIXTURES = `
  insert into public.clinicas (id, nombre, horario_consulta) values ('${CL}', 'G4 herencia (prueba)', '${CLINICA}'::jsonb);
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values ('${MED}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'g4-herencia@prueba.local', now(), now());
  update public.profiles set clinica_id = '${CL}', es_admin_de_clinica = true where id = '${MED}';
  insert into public.consultorios (id, clinica_id, medico_id, nombre, nombre_corto, direccion, horario, horario_propio, es_default, activo) values
    ('${A}', '${CL}', '${MED}', 'G4 sin propio', 'G4 A', 'Calle 1', '${INERTE}'::jsonb, false, true, true),
    ('${B}', '${CL}', '${MED}', 'G4 con propio', 'G4 B', 'Calle 2', '${PROPIO}'::jsonb, true, false, true),
    ('${C}', '${CL}', '${MED}', 'G4 archivado', 'G4 C', 'Calle 3', '${INERTE}'::jsonb, false, false, false);
`

/** Falla (RAISE) si algo no es lo esperado tras una pasada. */
const COMPROBAR = (pasada: number) => `
do $$
declare v record;
begin
  select horario, horario_propio into v from public.consultorios where id = '${A}';
  if v.horario <> '${CLINICA}'::jsonb or not v.horario_propio then raise exception 'pasada ${pasada}: A no heredó el horario de su clínica'; end if;
  select horario, horario_propio into v from public.consultorios where id = '${C}';
  if v.horario <> '${CLINICA}'::jsonb or not v.horario_propio then raise exception 'pasada ${pasada}: C (archivado) no heredó'; end if;
  select horario, horario_propio into v from public.consultorios where id = '${B}';
  if v.horario <> '${PROPIO}'::jsonb or not v.horario_propio then raise exception 'pasada ${pasada}: B tenía horario propio y se tocó'; end if;
  if (select count(*) from respaldos.consultorios_horario_20261119 where id in ('${A}', '${C}')
       and horario = '${INERTE}'::jsonb and not horario_propio) <> 2 then
    raise exception 'pasada ${pasada}: falta el respaldo de A o C con su valor previo';
  end if;
  if exists (select 1 from respaldos.consultorios_horario_20261119 where id = '${B}') then
    raise exception 'pasada ${pasada}: B no se tocaba y está en el respaldo';
  end if;
  if (select count(*) from public.audit_log where tabla = 'consultorios' and accion = 'UPDATE'
       and registro_id in ('${A}', '${C}') and user_id = 'system') <> 2 then
    raise exception 'pasada ${pasada}: audit_log no tiene exactamente una fila UPDATE por cada heredado';
  end if;
  if exists (select 1 from public.audit_log where tabla = 'consultorios' and accion = 'UPDATE' and registro_id = '${B}') then
    raise exception 'pasada ${pasada}: B tiene fila UPDATE en audit_log';
  end if;
  if (select horario_consulta from public.clinicas where id = '${CL}') <> '${CLINICA}'::jsonb then
    raise exception 'pasada ${pasada}: clinicas.horario_consulta cambió';
  end if;
end $$;
select 'pasada ${pasada} OK';
`

test('la migración de herencia copia una vez, respalda, audita y no pisa un horario propio', () => {
  const salida = sqlLocal(`begin;\n${FIXTURES}\n${cuerpo()}\n${COMPROBAR(1)}\n${cuerpo()}\n${COMPROBAR(2)}\nrollback;`)
  expect(salida).toContain('pasada 1 OK')
  expect(salida).toContain('pasada 2 OK')
  // No dejó nada.
  expect(sqlLocal(`select count(*) from public.clinicas where id = '${CL}'`)).toBe('0')
})
