#!/usr/bin/env bash
# Carrera de cita_confirmacion_responder (agenda E1) con DOS sesiones de psql a
# la vez, contra la base LOCAL de Docker. Nunca toca producción.
#
# Lo que demuestra:
#   1. El personal mueve una cita de +2 h a +30 min y retiene la transacción 2 s;
#      a la vez, el paciente cancela por el enlace. B espera a la fila de la cita
#      (FOR UPDATE), lee la hora NUEVA y sale «fuera_de_plazo»: la cita sigue
#      agendada, a +30 min.
#   2. Control: la misma carrera con una copia de la función SIN el FOR UPDATE de
#      la cita (en pg_temp de la sesión B, que termina en ROLLBACK) cancela la
#      cita ya movida. Es el candado lo que lo impide.
#   3. Confirmar y cancelar a la vez por el MISMO enlace se serializan por el
#      FOR UPDATE del enlace: queda la segunda (cancelada) y dos filas de
#      auditoría coherentes (scheduled→confirmed, confirmed→cancelled).
#
# Orden: B arranca cuando A ya está en su pg_sleep (se mira en pg_stat_activity),
# no tras una espera fija.
#
# Limpieza: datos de una clínica de prueba con ids fijos. Al final (y si algo
# falla, por trap) se borran como postgres con session_replication_role =
# replica, que apaga los disparadores en ESA transacción: así se borran también
# las filas de audit_log de esta prueba, que de otro modo protege
# prevent_audit_modification. Sólo filas de esta prueba.
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

C=00000000-0000-4000-8000-0000ca7e1c01   # clínica
U=00000000-0000-4000-8000-0000ca7e1b01   # médico (administrador)
P=00000000-0000-4000-8000-0000ca7e1f01   # paciente
X=00000000-0000-4000-8000-0000ca7e1a01; Y=00000000-0000-4000-8000-0000ca7e1a02; Z=00000000-0000-4000-8000-0000ca7e1a03
LX=00000000-0000-4000-8000-0000ca7e1e01; LY=00000000-0000-4000-8000-0000ca7e1e02; LZ=00000000-0000-4000-8000-0000ca7e1e03
FIRMA="public.cita_confirmacion_responder(uuid, text, text)"
hash() { echo "encode(sha256(convert_to('$1', 'UTF8')), 'hex')"; }

limpiar() {
  sql <<SQL || echo "AVISO: la limpieza falló; revisar la clínica $C a mano." >&2
begin;
set local session_replication_role = replica;
delete from public.audit_log where registro_id in ('$C', '$U', '$P', '$X', '$Y', '$Z', '$LX', '$LY', '$LZ')
    or descripcion like '%$C%';
delete from public.cita_confirmaciones where clinica_id = '$C';
delete from public.appointments where clinica_id = '$C';
delete from public.pacientes where clinica_id = '$C';
delete from public.agenda_ajustes where clinica_id = '$C';
delete from public.profiles where id = '$U';
delete from auth.users where id = '$U';
delete from public.clinicas where id = '$C';
commit;
SQL
  local resto
  resto="$(sql -c "select (select count(*) from public.audit_log where descripcion like '%$C%'
                             or registro_id in ('$C', '$U', '$P', '$X', '$Y', '$Z', '$LX', '$LY', '$LZ'))
                    + (select count(*) from public.cita_confirmaciones where clinica_id = '$C')
                    + (select count(*) from public.appointments where clinica_id = '$C')
                    + (select count(*) from public.pacientes where clinica_id = '$C')
                    + (select count(*) from public.agenda_ajustes where clinica_id = '$C')
                    + (select count(*) from public.profiles where id = '$U' or clinica_id = '$C')
                    + (select count(*) from auth.users where id = '$U')
                    + (select count(*) from public.clinicas where id = '$C')" 2>/dev/null || echo '?')"
  [ "$resto" = 0 ] || echo "AVISO: tras limpiar quedan $resto fila(s) de la prueba." >&2
  rm -rf "$tmp"
}
trap limpiar EXIT

# ── Datos (confirmados: la otra sesión tiene que verlos) ────────────────
limpiar >/dev/null 2>&1 || true
tmp="$(mktemp -d)"
sql <<SQL
insert into public.clinicas (id, nombre, es_vip_grant) values ('$C', 'Carrera E1', true);
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values ('$U', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carrera-e1@prueba.local', now(), now());
update public.profiles set clinica_id = '$C', es_admin_de_clinica = true where id = '$U';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values ('$C', true);
insert into public.pacientes (id, clinica_id, nombre, apellidos) values ('$P', '$C', 'Paciente', 'Carrera');
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status)
select c, '$C', '$P', '$U', 'Carrera', now() + interval '2 hours', now() + interval '150 min', 'scheduled'
  from unnest(array['$X', '$Y', '$Z']::uuid[]) c;
insert into public.cita_confirmaciones (id, clinica_id, appointment_id, codigo_hash, paciente_id) values
  ('$LX', '$C', '$X', $(hash LX), '$P'),
  ('$LY', '$C', '$Y', $(hash LY), '$P'),
  ('$LZ', '$C', '$Z', $(hash LZ), '$P');
SQL

cronometro() { date +%s%N; }
falla() { echo "FALLÓ: $*" >&2; exit 1; }
responder() {  # $1 = función, $2 = enlace, $3 = acción
  echo "select r_resultado from $1('$C', $(hash "$2"), '$3');"
}
en_sleep() {  # espera hasta 10 s a que A esté dentro de su pg_sleep
  local i
  for i in $(seq 1 100); do
    [ "$(sql -c "select count(*) from pg_stat_activity where state = 'active' and query like '%pg_sleep(2)%'
                   and query not like '%pg_stat_activity%'")" = 1 ] && return 0
    sleep 0.1
  done
  falla "la sesión A no llegó a su pg_sleep en 10 s"
}
mover_en_a() {  # $1 = cita. El personal (authenticated) la mueve a +30 min y retiene 2 s.
  { echo "begin;"
    echo "select set_config('request.jwt.claims', json_build_object('sub', '$U', 'role', 'authenticated')::text, true);"
    echo "set local role authenticated;"
    echo "update public.appointments set start_time = now() + interval '30 min', end_time = now() + interval '60 min' where id = '$1';"
    echo "select pg_sleep(2);"; echo "commit;"; } | sql > "$tmp/a.out" &
  pid_a=$!
  en_sleep
}
esperar_a() {
  wait "$pid_a" || falla "la sesión A terminó con error: $(cat "$tmp/a.out")"
  a="$(grep -v '^$' "$tmp/a.out" | head -1 || true)"
}

# ── 1 · El personal mueve la cita mientras el paciente cancela ─────────
mover_en_a "$X"
t0="$(cronometro)"
b="$( { echo "set role service_role;"; responder public.cita_confirmacion_responder LX cancelar; } | sql || echo error)"
t1="$(cronometro)"
esperar_a
espera_ms=$(( (t1 - t0) / 1000000 ))
estado="$(sql -c "select status || ' ' || (start_time < now() + interval '1 hour')::text from public.appointments where id = '$X'")"
echo "1 · con candado: B=$b (esperó ${espera_ms} ms); la cita: $estado"
[ "$b" = fuera_de_plazo ] && [ "$estado" = "scheduled true" ] || falla "escenario 1"
[ "$espera_ms" -ge 1000 ] || falla "B no esperó a la fila de la cita (${espera_ms} ms)"

# ── 2 · Control: sin el FOR UPDATE de la cita, cancela la cita ya movida ──
def="$(sql -c "select pg_get_functiondef('$FIRMA'::regprocedure)")"
sin="$(printf '%s\n' "$def" | sed -e 's/FUNCTION public\.cita_confirmacion_responder(/FUNCTION pg_temp.responder_sin_candado(/' \
       | perl -0pe 's/(a\.clinica_id = p_clinica_id)\n\s+FOR UPDATE;/$1;/')"
printf '%s\n' "$sin" | grep -q 'pg_temp.responder_sin_candado' || falla "no se pudo copiar la función"
[ "$(printf '%s\n' "$sin" | grep -c 'FOR UPDATE')" = 1 ] || falla "la copia debe conservar sólo el FOR UPDATE del enlace"
mover_en_a "$Y"
b="$( { echo "begin;"; printf '%s;\n' "$sin"; responder pg_temp.responder_sin_candado LY cancelar
        echo "select status from public.appointments where id = '$Y';"; echo "rollback;"; } | sql | tr '\n' ' ' || echo error)"
esperar_a
echo "2 · control sin candado (en ROLLBACK): B=$b"
[ "$b" = "cancelada cancelled " ] || falla "escenario 2: sin el candado debió cancelar la cita movida"

# ── 3 · Confirmar y cancelar a la vez por el mismo enlace ──────────────
{ echo "begin;"; echo "set local role service_role;"; responder public.cita_confirmacion_responder LZ confirmar
  echo "select pg_sleep(2);"; echo "commit;"; } | sql > "$tmp/a.out" &
pid_a=$!
en_sleep
b="$( { echo "set role service_role;"; responder public.cita_confirmacion_responder LZ cancelar; } | sql || echo error)"
esperar_a
final="$(sql -c "select a.status || ' ' || c.respuesta from public.appointments a join public.cita_confirmaciones c
                   on c.appointment_id = a.id where a.id = '$Z'")"
audit="$(sql -c "select string_agg(accion || ':' || (descripcion::jsonb ->> 'via') || ':'
                                   || (descripcion::jsonb -> 'estado' ->> 'de') || '>' || (descripcion::jsonb -> 'estado' ->> 'a'),
                                   ' ' order by accion desc)
                   from public.audit_log where registro_id = '$Z' and tabla = 'appointments' and accion <> 'cita_alta'")"
echo "3 · a la vez: A=$a  B=$b  final=$final  auditoría=$audit"
[ "$a" = confirmada ] && [ "$b" = cancelada ] && [ "$final" = "cancelled cancelo" ] || falla "escenario 3"
[ "$audit" = "cita_editada:enlace_paciente:scheduled>confirmed cita_cancelada:enlace_paciente:confirmed>cancelled" ] \
  || falla "escenario 3: auditoría inesperada"
echo "Carrera en verde. Limpiando…"
