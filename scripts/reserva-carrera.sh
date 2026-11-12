#!/usr/bin/env bash
# Carrera de reservar_por_enlace (agenda D3) con DOS sesiones de psql a la vez,
# contra la base LOCAL de Docker. Nunca toca producción.
#
# Lo que demuestra:
#   1. Dos reservas simultáneas al mismo turno, por DOS enlaces únicos del mismo
#      médico (no comparten fila de enlace: sólo los separa el candado consultivo
#      1790): la primera reserva y la segunda espera al candado y sale «ocupado».
#      Queda UNA cita.
#   2. Control: la misma carrera con una copia de la función SIN la línea del
#      candado (en pg_temp de la sesión B, que termina en ROLLBACK) reserva las
#      dos. Es el candado lo que lo impide.
#   3. Dos reservas a la vez con el MISMO enlace único (turnos distintos): la
#      segunda espera a la fila del enlace y sale «enlace_usado».
#   4. En REPEATABLE READ la función se niega (25001) en vez de duplicar.
#
# Orden: B arranca cuando A ya tiene el candado 1790 (se mira en pg_locks; nadie
# más usa esa clave), no tras una espera fija.
#
# Limpieza: los datos son de una clínica de prueba con ids fijos. Al final (y si
# algo falla, por trap) se borran como postgres con session_replication_role =
# replica, que apaga los disparadores en ESA transacción: así se borran también
# las filas de audit_log que esta prueba generó (registro_id de sus objetos), que
# de otro modo protege prevent_audit_modification. Sólo filas de esta prueba.
# Como replica también apaga las FK, al final se cuenta lo que quede en TODAS
# las tablas que la prueba toca, y se avisa si algo sobra.
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

C=00000000-0000-4000-8000-0000ca7e0c01   # clínica
U=00000000-0000-4000-8000-0000ca7e0b01   # médico
K=00000000-0000-4000-8000-0000ca7e0dd1   # consultorio
T=00000000-0000-4000-8000-0000ca7e0a01   # tipo de cita (30 min)
J=00000000-0000-4000-8000-0000ca7e0aa1   # agenda_ajustes.id
AV=carrera-d3                             # versión del aviso
E1=00000000-0000-4000-8000-0000ca7e0f01; E2=00000000-0000-4000-8000-0000ca7e0f02
E3=00000000-0000-4000-8000-0000ca7e0f03; E4=00000000-0000-4000-8000-0000ca7e0f04
E5=00000000-0000-4000-8000-0000ca7e0f05
FIRMA="public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)"

limpiar() {
  sql <<SQL || echo "AVISO: la limpieza falló; revisar la clínica $C a mano." >&2
begin;
set local session_replication_role = replica;
create temp table _ids on commit drop as
  select id from public.appointments where clinica_id = '$C'
  union all select id from public.reserva_enlaces where clinica_id = '$C'
  union all select id from public.reserva_avisos where version = '$AV'
  union all select unnest(array['$C', '$U', '$K', '$T', '$J']::uuid[]);
delete from public.audit_log where registro_id in (select id from _ids) or descripcion like '%$C%';
delete from public.reserva_incidencias where clinica_id = '$C';
delete from public.reserva_verificaciones where clinica_id = '$C';
delete from public.reserva_contactos where clinica_id = '$C';
update public.reserva_enlaces set usado_en = null, usado_cita_id = null where clinica_id = '$C';
delete from public.appointments where clinica_id = '$C';
delete from public.reserva_enlaces where clinica_id = '$C';
delete from public.reserva_avisos where version = '$AV';
delete from public.tipos_cita where clinica_id = '$C';
delete from public.consultorios where clinica_id = '$C';
delete from public.agenda_ajustes where clinica_id = '$C';
delete from public.profiles where id = '$U';
delete from auth.users where id = '$U';
delete from public.clinicas where id = '$C';
commit;
SQL
  local resto
  resto="$(sql -c "select (select count(*) from public.audit_log where descripcion like '%$C%'
                             or registro_id in ('$C', '$U', '$K', '$T', '$J', '$E1', '$E2', '$E3', '$E4', '$E5'))
                    + (select count(*) from public.appointments where clinica_id = '$C')
                    + (select count(*) from public.reserva_enlaces where clinica_id = '$C')
                    + (select count(*) from public.reserva_incidencias where clinica_id = '$C')
                    + (select count(*) from public.reserva_verificaciones where clinica_id = '$C')
                    + (select count(*) from public.reserva_contactos where clinica_id = '$C')
                    + (select count(*) from public.tipos_cita where clinica_id = '$C')
                    + (select count(*) from public.consultorios where clinica_id = '$C')
                    + (select count(*) from public.agenda_ajustes where clinica_id = '$C')
                    + (select count(*) from public.profiles where id = '$U' or clinica_id = '$C')
                    + (select count(*) from auth.users where id = '$U')
                    + (select count(*) from public.clinicas where id = '$C')
                    + (select count(*) from public.reserva_avisos where version = '$AV')" 2>/dev/null || echo '?')"
  [ "$resto" = 0 ] || echo "AVISO: tras limpiar quedan $resto fila(s) de la prueba." >&2
  rm -rf "$tmp"
}
trap limpiar EXIT

# ── Datos (confirmados: la otra sesión tiene que verlos) ────────────────
limpiar >/dev/null 2>&1 || true
tmp="$(mktemp -d)"
sql <<SQL
insert into public.clinicas (id, nombre, es_vip_grant) values ('$C', 'Carrera D3', true);
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values ('$U', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carrera-d3@prueba.local', now(), now());
update public.profiles set clinica_id = '$C', es_admin_de_clinica = true where id = '$U';
insert into public.agenda_ajustes (id, clinica_id, agenda_v2_encendida) values ('$J', '$C', true);
insert into public.consultorios (id, clinica_id, medico_id, nombre, nombre_corto, direccion) values ('$K', '$C', '$U', 'C', 'C', 'Calle');
insert into public.tipos_cita (id, clinica_id, nombre, duracion_min) values ('$T', '$C', 'Consulta', 30);
insert into public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en)
values ('$AV', encode(sha256('aviso'), 'hex'), true, now());
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash, vigencia_dias, caduca_en)
select e, '$C', '$U', 'unico', encode(sha256(convert_to(e::text, 'UTF8')), 'hex'), 7, now() + interval '7 days'
  from unnest(array['$E1', '$E2', '$E3', '$E4', '$E5']::uuid[]) e;
SQL

cronometro() { date +%s%N; }
falla() { echo "FALLÓ: $*" >&2; exit 1; }
turno() { sql -c "select date_trunc('hour', now()) + interval '3 days' + interval '$1 hours'"; }
llamada() {  # $1 = función, $2 = enlace, $3 = inicio, $4 = teléfono
  echo "select r_resultado from $1('$C', encode(sha256(convert_to('$2', 'UTF8')), 'hex'), '$K', '$T', '$3'::timestamptz,
    'Persona Carrera', '$4', 'p$4@prueba.local', encode(sha256(convert_to('t$4', 'UTF8')), 'hex'),
    encode(sha256(convert_to('c$4', 'UTF8')), 'hex'), null, '$AV', encode(sha256('aviso'), 'hex'), gen_random_uuid());"
}
sesion_a() {  # reserva, retiene 2 s y confirma (en segundo plano); espera a que tenga el candado
  { echo "begin;"; echo "set local role service_role;"; llamada public.reservar_por_enlace "$1" "$2" "$3"
    echo "select pg_sleep(2);"; echo "commit;"; } | sql > "$tmp/a.out" &
  pid_a=$!
  local i
  for i in $(seq 1 100); do  # hasta 10 s: A dentro de la sección (candado 1790 concedido)
    [ "$(sql -c "select count(*) from pg_locks where locktype = 'advisory' and classid = 1790 and granted")" = 1 ] && return 0
    sleep 0.1
  done
  falla "la sesión A no tomó el candado en 10 s"
}
esperar_a() {  # espera a A, falla si A falló, y deja su resultado en $a
  wait "$pid_a" || falla "la sesión A terminó con error: $(cat "$tmp/a.out")"
  a="$(grep -v '^$' "$tmp/a.out" | head -1 || true)"
}

# ── 1 · Dos enlaces, mismo médico, mismo turno ──────────────────────────
X="$(turno 10)"
sesion_a "$E1" "$X" 5500000001
t0="$(cronometro)"
b="$( { echo "set role service_role;"; llamada public.reservar_por_enlace "$E2" "$X" 5500000002; } | sql || echo error)"
t1="$(cronometro)"
esperar_a
espera_ms=$(( (t1 - t0) / 1000000 ))
n="$(sql -c "select count(*) from public.appointments where clinica_id = '$C' and start_time = '$X'")"
echo "1 · con candado: A=$a  B=$b  (B esperó ${espera_ms} ms)  citas en el turno=$n"
[ "$a" = ok ] && [ "$b" = ocupado ] && [ "$n" = 1 ] || falla "escenario 1"
[ "$espera_ms" -ge 1000 ] || falla "B no esperó al candado (${espera_ms} ms)"

# ── 2 · Control: sin la línea del candado, las dos reservan ─────────────
def="$(sql -c "select pg_get_functiondef('$FIRMA'::regprocedure)")"
sin="$(printf '%s\n' "$def" | sed -e 's/FUNCTION public\.reservar_por_enlace(/FUNCTION pg_temp.reservar_sin_candado(/' \
                                  -e '/pg_advisory_xact_lock(1790/d')"
printf '%s\n' "$sin" | grep -q 'pg_temp.reservar_sin_candado' || falla "no se pudo copiar la función"
if printf '%s\n' "$sin" | grep -q 'pg_advisory_xact_lock'; then falla "la copia conserva el candado"; fi
Y="$(turno 12)"
sesion_a "$E3" "$Y" 5500000003
t0="$(cronometro)"
b="$( { echo "begin;"; printf '%s;\n' "$sin"; llamada pg_temp.reservar_sin_candado "$E4" "$Y" 5500000004; echo "rollback;"; } | sql || echo error)"
t1="$(cronometro)"
esperar_a
echo "2 · control sin candado: A=$a  B=$b (B, en ROLLBACK, tardó $(( (t1 - t0) / 1000000 )) ms)"
[ "$a" = ok ] && [ "$b" = ok ] || falla "escenario 2: sin el candado la segunda debió reservar"

# ── 3 · Mismo enlace único, turnos distintos ────────────────────────────
Z1="$(turno 14)"; Z2="$(turno 16)"
sesion_a "$E5" "$Z1" 5500000005
b="$( { echo "set role service_role;"; llamada public.reservar_por_enlace "$E5" "$Z2" 5500000006; } | sql || echo error)"
esperar_a
echo "3 · mismo enlace único: A=$a  B=$b"
[ "$a" = ok ] && [ "$b" = enlace_usado ] || falla "escenario 3"

# ── 4 · REPEATABLE READ: se niega ───────────────────────────────────────
r="$( { echo "begin isolation level repeatable read;"; echo "set local role service_role;"
        llamada public.reservar_por_enlace "$E2" "$(turno 18)" 5500000007; echo "rollback;"; } \
      | docker exec -i "$contenedor" psql -U postgres -d postgres -At -q -v ON_ERROR_STOP=1 2>&1 || true)"
echo "4 · repeatable read: $(printf '%s' "$r" | grep -o 'requiere READ COMMITTED[^)]*)' || echo "$r")"
printf '%s' "$r" | grep -q 'requiere READ COMMITTED' || falla "escenario 4"

total="$(sql -c "select count(*) from public.appointments where clinica_id = '$C'")"
echo "Citas que quedaron: $total (esperadas 3: escenarios 1, 2-A y 3-A)"
[ "$total" = 3 ] || falla "quedaron $total citas"
echo "Carrera en verde. Limpiando…"
