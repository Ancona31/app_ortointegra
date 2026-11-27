#!/usr/bin/env bash
# Carreras de los avisos (MA, 20261203130000_avisos_globales_cierre_auditoria.sql)
# con DOS sesiones de psql a la vez, contra la base LOCAL de Docker. Nunca toca
# producción.
#
# Lo que demuestra:
#   1. «Marcar todos» NO se traga un aviso cuya transacción no había confirmado
#      (hallazgo 2 de la tercera auditoría de M1). A abre una transacción, escribe
#      un aviso y la retiene 2 s; mientras, la secretaria pulsa «Marcar todos».
#      Cuando A confirma, el aviso SIGUE pendiente para ella. Y lo que ella sí
#      veía al pulsar (un aviso confirmado DESPUÉS de que A empezara) queda visto:
#      el gesto vacía su lista aunque la marca de agua no pudo avanzar.
#   2. Control: con el cuerpo de M1 (su reversa), la misma carrera se traga el
#      aviso. Es el recorte de la marca lo que lo impide. Se vuelve a aplicar MA.
#   3. Reasignar una cita no espera por sus avisos (hallazgo 4). A retiene 3 s la
#      fila del aviso de una cita; B le cambia el médico a la cita con el
#      statement_timeout de la app (8 s): termina en menos de 2 s, con el médico
#      cambiado. El aviso tomado conserva la copia vieja; el UPDATE de reparación
#      (cabecera de la migración) la corrige.
#   4. (BASE-2 · B3, hallazgo MA 1) La función que mira la transacción abierta más
#      antigua lee fresco TAMBIÉN en su segunda llamada dentro de una misma
#      transacción. A la llama, espera 2 s y la vuelve a llamar; entre medias B
#      abre una transacción. La segunda lectura la VE. Control: con el cuerpo de
#      MA (reversa de B3) la segunda lectura sigue diciendo «ninguna» (Postgres
#      congela pg_stat_activity en la primera lectura). Se vuelve a aplicar B3.
#
# Orden: B arranca cuando A ya está en su pg_sleep (se mira en pg_stat_activity),
# no tras una espera fija.
#
# Limpieza: datos de una clínica de prueba con ids fijos; al final (y si algo
# falla, por trap) se borran como postgres, sólo las filas de esta prueba. Las
# filas de audit_log NO se borran (orden de Angel, tanda M).
set -euo pipefail

raiz="$(cd "$(dirname "$0")/.." && pwd)"
proyecto="$(sed -nE 's/^project_id[[:space:]]*=[[:space:]]*"([^"]+)".*/\1/p' "$raiz/supabase/config.toml")"
contenedor="supabase_db_${proyecto}"
if [ -z "$proyecto" ] || [ "$(docker inspect -f '{{.State.Running}}' "$contenedor" 2>/dev/null)" != "true" ]; then
  echo "La base local no está corriendo (contenedor ${contenedor})." >&2
  exit 1
fi

sql() { docker exec -i "$contenedor" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -At -q "$@"; }
tmp="$(mktemp -d)"

C=00000000-0000-4000-8000-0000a5ca0c01    # clínica
U1=00000000-0000-4000-8000-0000a5ca0b01   # médico administrador
U2=00000000-0000-4000-8000-0000a5ca0b02   # médico invitado
S=00000000-0000-4000-8000-0000a5ca0b03    # secretaria
P=00000000-0000-4000-8000-0000a5ca0f01    # paciente
X0=00000000-0000-4000-8000-0000a5ca0a00; X1=00000000-0000-4000-8000-0000a5ca0a01; X2=00000000-0000-4000-8000-0000a5ca0a02
TIPOS="array['reserva_enlace','cancelacion_paciente','confirmacion_paciente']"
MIGRACION="$raiz/supabase/migrations/20261203130000_avisos_globales_cierre_auditoria.sql"
REVERSA="$raiz/supabase/reversas/20261203130000_avisos_globales_cierre_auditoria_reversa.sql"
# BASE-2 · B3 va encima de MA: deshacer MA la deshace también, así que tras el control del paso 2 se vuelve a aplicar.
MIGRACION_B3="$raiz/supabase/migrations/20261208140000_avisos_y_correos_cierre_bajos.sql"
REVERSA_B3="$raiz/supabase/reversas/20261208140000_avisos_y_correos_cierre_bajos_reversa.sql"
b3_aplicada() { sql -c "select exists (select 1 from pg_proc where oid = to_regprocedure('public.avisos_transaccion_mas_antigua()') and position('pg_stat_clear_snapshot' in prosrc) > 0)"; }

limpiar() {
  sql <<SQL || echo "AVISO: la limpieza falló; revisar la clínica $C a mano." >&2
begin;
delete from public.avisos_vistos where clinica_id = '$C';
delete from public.avisos_vistos_hasta where clinica_id = '$C';
delete from public.avisos_clinica where clinica_id = '$C';
update public.agenda_ajustes set agenda_v2_encendida = false where clinica_id = '$C';
delete from public.appointments where clinica_id = '$C';
delete from public.pacientes where clinica_id = '$C';
delete from public.consultorios where clinica_id = '$C';
update public.profiles set clinica_id = null, es_admin_de_clinica = false where id in ('$U1', '$U2', '$S');
delete from auth.users where id in ('$U1', '$U2', '$S');
delete from public.agenda_ajustes where clinica_id = '$C';
delete from public.clinicas where id = '$C';
commit;
SQL
  rm -rf "$tmp"
}
trap limpiar EXIT

sembrar() {
  sql <<SQL
begin;
insert into public.clinicas (id, nombre, es_vip_grant, suscripcion_estado) values ('$C', 'Carrera de avisos', true, 'free');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('$U1'::uuid, 'a5-admin@prueba.local'), ('$U2'::uuid, 'a5-invitado@prueba.local'), ('$S'::uuid, 'a5-secre@prueba.local')) u(id, email);
update public.profiles set clinica_id = '$C', role = 'medico', es_admin_de_clinica = (id = '$U1'),
       nombres = 'Médico', especialidad = 'Ortopedia', cedula_profesional = '1234567' where id in ('$U1', '$U2');
update public.profiles set clinica_id = '$C', role = 'secretaria', es_admin_de_clinica = false where id = '$S';
insert into public.consultorios (clinica_id, medico_id, nombre, nombre_corto, direccion, activo, timezone)
select '$C', m, 'Consultorio', 'C', 'Calle falsa 1', true, 'America/Merida' from unnest(array['$U1', '$U2']::uuid[]) m;
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values ('$C', true)
  on conflict (clinica_id) do update set agenda_v2_encendida = excluded.agenda_v2_encendida;
insert into public.pacientes (id, clinica_id, nombre, apellidos) values ('$P', '$C', 'Paciente', 'Carrera');
insert into public.appointments (id, clinica_id, medico_id, paciente_id, title, start_time, end_time)
select x.id, '$C', '$U1', '$P', 'Carrera', now() + x.d, now() + x.d + interval '30 minutes'
  from (values ('$X0'::uuid, interval '1 day'), ('$X1'::uuid, interval '2 days'), ('$X2'::uuid, interval '3 days')) x(id, d);
commit;
SQL
}

# Espera a que una sesión esté en su pg_sleep con la marca dada en application_name.
esperar_dormida() {
  local i
  for i in $(seq 1 100); do
    [ "$(sql -c "select count(*) from pg_stat_activity where application_name = '$1' and query like '%pg_sleep%' and state = 'active'")" = "1" ] && return 0
    sleep 0.1
  done
  echo "La sesión $1 no llegó a su pg_sleep." >&2; return 1
}

# Lo que la secretaria tiene pendiente (las citas de sus avisos, ordenadas).
pendientes() {
  sql <<SQL
begin;
select set_config('request.jwt.claims', json_build_object('sub', '$S', 'role', 'authenticated')::text, true);
set local role authenticated;
select coalesce(string_agg(right(cita_id::text, 2), ',' order by cita_id), 'ninguno') from public.avisos_pendientes($TIPOS, 50);
commit;
SQL
}

# «Marcar todos» de la secretaria, con lo más nuevo que tiene a la vista (como hace la app).
marcar_todos() {
  sql <<SQL
begin;
select set_config('request.jwt.claims', json_build_object('sub', '$S', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.avisos_revisar_todos((select max(creado_en) from public.avisos_pendientes($TIPOS, 50)));
commit;
SQL
}

# A abre una transacción, escribe el aviso de X1 y la retiene; a media retención otro confirma el
# aviso de X0 (que la secretaria SÍ ve) y ella pulsa «Marcar todos». Imprime lo pendiente al final.
carrera_marcar() {
  sql -c "delete from public.avisos_vistos where clinica_id = '$C'; delete from public.avisos_vistos_hasta where clinica_id = '$C'; delete from public.avisos_clinica where clinica_id = '$C'" >/dev/null
  PGAPPNAME=avisos-carrera-a docker exec -e PGAPPNAME=avisos-carrera-a -i "$contenedor" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -At -q >/dev/null <<SQL &
begin;
insert into public.avisos_clinica (clinica_id, tipo, cita_id) values ('$C', 'reserva_enlace', '$X1');
select pg_sleep(2);
commit;
SQL
  local a=$!
  esperar_dormida avisos-carrera-a
  sql -c "insert into public.avisos_clinica (clinica_id, tipo, cita_id) values ('$C', 'cancelacion_paciente', '$X0')" >/dev/null
  echo "antes de pulsar: $(pendientes | tail -1)"
  marcar_todos >/dev/null
  echo "tras pulsar, con A abierta: $(pendientes | tail -1)"
  wait "$a"
  echo "con A confirmada: $(pendientes | tail -1)"
}

# A (postgres: ningún rol de la app puede llamarla) lee, espera 2 s y vuelve a leer en la MISMA transacción;
# mientras duerme, B abre una transacción y la retiene. Imprime «ve» o «no ve» para la segunda lectura.
# La vuelta sólo vale si la PRIMERA lectura dijo «ninguna» (los servicios locales de Supabase abren
# transacciones breves de vez en cuando, y una foto congelada con una de ésas no demuestra nada): si no,
# se repite, hasta 8 veces.
carrera_lectura() {
  local i a b
  for i in $(seq 1 8); do
    docker exec -e PGAPPNAME=avisos-carrera-l -i "$contenedor" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -At -q > "$tmp/lectura" <<SQL &
begin;
select 'a1:' || (public.avisos_transaccion_mas_antigua() is not null)::text;
select pg_sleep(2);
select 'a2:' || (public.avisos_transaccion_mas_antigua() is not null)::text;
commit;
SQL
    a=$!
    esperar_dormida avisos-carrera-l
    sql -c "begin; select pg_sleep(3); commit;" >/dev/null &
    b=$!
    wait "$a"; wait "$b"
    grep -q '^a1:false$' "$tmp/lectura" || continue
    if grep -q '^a2:true$' "$tmp/lectura"; then echo "ve"; else echo "no ve"; fi
    return 0
  done
  echo "sin medir: la primera lectura nunca salió limpia"
}

exigir() {  # $1 = qué; $2 = obtenido; $3 = esperado
  if [ "$2" != "$3" ]; then echo "FALLO · $1: salió «$2», esperaba «$3»" >&2; exit 1; fi
  echo "ok · $1"
}

sembrar

echo "── 1 · «Marcar todos» con una transacción abierta que escribe un aviso"
salida="$(carrera_marcar)"; echo "$salida" | sed 's/^/   /'
exigir "la secretaria veía el aviso de X0 y no el de X1 (sin confirmar)" "$(echo "$salida" | sed -n 1p)" "antes de pulsar: 00"
exigir "el gesto vacía su lista" "$(echo "$salida" | sed -n 2p)" "tras pulsar, con A abierta: ninguno"
exigir "el aviso que confirmó después SIGUE pendiente" "$(echo "$salida" | sed -n 3p)" "con A confirmada: 01"

echo "── 2 · control: la misma carrera con el cuerpo de M1 (reversa de MA) se lo traga"
sql -o /dev/null -f - < "$REVERSA"
salida="$(carrera_marcar)"; echo "$salida" | sed 's/^/   /'
sql -o /dev/null -f - < "$MIGRACION" 2>/dev/null
exigir "MA vuelve a estar aplicada" "$(sql -c "select to_regprocedure('public.avisos_transaccion_mas_antigua()') is not null")" "t"
if [ -f "$MIGRACION_B3" ]; then
  sql -o /dev/null -f - < "$MIGRACION_B3" 2>/dev/null
  exigir "B3 vuelve a estar aplicada (deshacer MA la deshizo)" "$(b3_aplicada)" "t"
fi
exigir "con M1, el aviso que confirmó después NO sale (el defecto)" "$(echo "$salida" | sed -n 3p)" "con A confirmada: ninguno"

echo "── 3 · reasignar una cita con la fila de su aviso tomada por otra sesión"
sql -c "delete from public.avisos_clinica where clinica_id = '$C'; insert into public.avisos_clinica (clinica_id, tipo, cita_id) values ('$C', 'reserva_enlace', '$X2')" >/dev/null
exigir "el aviso nace con la copia del médico de la cita" "$(sql -c "select medico_id from public.avisos_clinica where cita_id = '$X2'")" "$U1"
docker exec -e PGAPPNAME=avisos-carrera-a -i "$contenedor" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -At -q >/dev/null <<SQL &
begin;
select id from public.avisos_clinica where cita_id = '$X2' for update;
select pg_sleep(3);
commit;
SQL
a=$!
esperar_dormida avisos-carrera-a
t0=$(date +%s%N)
sql 2> "$tmp/reasignar.err" <<SQL
set statement_timeout = '8s';
update public.appointments set medico_id = '$U2' where id = '$X2';
SQL
ms=$(( ($(date +%s%N) - t0) / 1000000 ))
echo "   la reasignación tardó ${ms} ms"
[ "$ms" -lt 2000 ] || { echo "FALLO · la reasignación esperó por el aviso (${ms} ms)" >&2; exit 1; }
echo "ok · la reasignación no esperó a la otra sesión"
exigir "la cita cambió de médico" "$(sql -c "select medico_id from public.appointments where id = '$X2'")" "$U2"
grep -q "algún aviso de la cita estaba tomado" "$tmp/reasignar.err" || { echo "FALLO · no salió el WARNING del aviso tomado" >&2; cat "$tmp/reasignar.err" >&2; exit 1; }
echo "ok · dejó el WARNING del aviso tomado"
wait "$a"
exigir "el aviso tomado conserva la copia vieja" "$(sql -c "select medico_id from public.avisos_clinica where cita_id = '$X2'")" "$U1"
sql -c "update public.avisos_clinica a set medico_id = ap.medico_id from public.appointments ap where a.cita_id = ap.id and a.clinica_id = ap.clinica_id and a.medico_id is distinct from ap.medico_id and a.clinica_id = '$C'" >/dev/null
exigir "el UPDATE de reparación la corrige" "$(sql -c "select medico_id from public.avisos_clinica where cita_id = '$X2'")" "$U2"

echo "── 4 · la segunda lectura de una transacción ve lo que se abrió después (BASE-2 · B3)"
exigir "B3 está aplicada" "$(b3_aplicada)" "t"
exigir "con B3, la segunda lectura VE la transacción que abrió B" "$(carrera_lectura)" "ve"
sql -o /dev/null -f - < "$REVERSA_B3"
salida="$(carrera_lectura)"
sql -o /dev/null -f - < "$MIGRACION_B3" 2>/dev/null
exigir "B3 vuelve a estar aplicada" "$(b3_aplicada)" "t"
exigir "control: con el cuerpo de MA, la segunda lectura NO la ve (el defecto)" "$salida" "no ve"

echo "Carreras de avisos: en verde."
