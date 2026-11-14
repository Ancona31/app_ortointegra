import { createHash, randomUUID } from 'node:crypto'
import type { Locator } from '@playwright/test'
import { sqlLocal } from './ayudas'

/**
 * Ayudas de las e2e del lado INTERNO de la reserva por enlace (bloque D:
 * gestión de enlaces y contactos, D6 y D7). Las usan
 * `agenda-enlaces-reserva.e2e.ts`, `agenda-por-ligar.e2e.ts` y
 * `agenda-ligar-consulta.e2e.ts`.
 *
 * ⚠️ PREPARAN LA BASE COMO `postgres` y no por la reserva pública (D5, de
 * otro agente): lo que se prueba aquí es lo que la clínica hace con una cita
 * que YA llegó por enlace, no cómo llega. `postgres` se salta las
 * protecciones de `reserva_enlaces` (deciden con `current_user`) y la RLS.
 *
 * ⚠️⚠️ HAY QUE LIMPIAR AL TERMINAR (`limpiarReservasE2e`). Las FKs de
 * `reserva_enlaces`, `reserva_incidencias` y `reserva_contactos` a
 * `appointments`, `clinicas` y `profiles` son RESTRICT y `service_role` no
 * tiene DELETE en `reserva_enlaces`: una fila que quede aquí rompe la
 * siguiente siembra de `scripts/agenda-semilla.ts`, que no conoce estas
 * tablas. La limpieza va como `postgres` con `session_replication_role =
 * replica` (sin disparadores: ni la protección de `audit_log` ni la de las
 * citas), y se lleva también las filas de `audit_log` de esos objetos.
 */

export const AVISO_E2E = 'e2e-interno-d6'
const hex = () => createHash('sha256').update(randomUUID()).digest('hex')

export interface CitaPorLigar { citaId: string; enlaceId: string; medicoId: string; telHmac: string; correoHmac: string }

/**
 * Una cita POR LIGAR (reserva por enlace, sin paciente) del médico `correo`,
 * en su primer consultorio activo, a `inicio` (ISO) con `minutos` de duración.
 * `canal` 'unico' además deja el enlace GASTADO por esta cita (el caso de la
 * FK que impedía borrarla).
 */
export function crearCitaPorLigar(o: {
  correo: string; inicio: string; minutos: number; nombre: string; canal: 'fijo' | 'unico'; historial?: number
}): CitaPorLigar {
  const citaId = randomUUID(), enlaceId = randomUUID(), telHmac = hex(), correoHmac = hex()
  const fin = new Date(new Date(o.inicio).getTime() + o.minutos * 60_000).toISOString()
  const salida = sqlLocal(`
    insert into public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en)
    values (:'aviso', repeat('a', 64), true, now()) on conflict (version) do nothing;
    with m as (
      select p.id, p.clinica_id, co.id as consultorio, co.nombre, co.timezone
        from auth.users u join public.profiles p on p.id = u.id
        join public.consultorios co on co.medico_id = p.id and co.activo
       where u.email = :'correo' order by co.created_at limit 1
    ), e as (
      insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash, vigencia_dias, caduca_en)
      select :'enlace'::uuid, m.clinica_id, m.id, :'canal', :'hash',
             case when :'canal' = 'unico' then 7 end, case when :'canal' = 'unico' then now() + interval '7 days' end
        from m returning id
    )
    insert into public.appointments (id, clinica_id, medico_id, consultorio_id, consultorio_nombre, consultorio_timezone,
      title, start_time, end_time, status, origen, gcal_sync_status, reserva_enlace_id, reserva_canal, reserva_nombre,
      reserva_telefono, reserva_correo, reserva_tel_hmac, reserva_correo_hmac, reserva_aviso_version,
      reserva_aceptado_en, reserva_historial_previo)
    select :'cita'::uuid, m.clinica_id, m.id, m.consultorio, m.nombre, m.timezone, :'nombre', :'inicio'::timestamptz,
           :'fin'::timestamptz, 'scheduled', 'spinus', 'pending', (select id from e), :'canal', :'nombre',
           '5512345678', 'persona.e2e@ejemplo.test', :'tel', :'cor', :'aviso', now(), :'hist'::smallint
      from m returning medico_id;`, {
    aviso: AVISO_E2E, correo: o.correo, enlace: enlaceId, canal: o.canal, hash: hex(), cita: citaId, nombre: o.nombre,
    inicio: o.inicio, fin, tel: telHmac, cor: correoHmac, hist: String(o.historial ?? 0),
  })
  const medicoId = salida.split('\n').filter(Boolean).pop() ?? ''
  if (!medicoId) throw new Error(`crearCitaPorLigar: no se encontró el médico ${o.correo} con consultorio`)
  if (o.canal === 'unico') {
    sqlLocal(`update public.reserva_enlaces set usado_en = now(), usado_cita_id = :'cita'::uuid where id = :'enlace'::uuid`,
      { cita: citaId, enlace: enlaceId })
  }
  return { citaId, enlaceId, medicoId, telHmac, correoHmac }
}

/** Bloquea a mano el contacto de esa cita (como lo haría `reserva_contacto_marcar`). */
export function bloquearContactoE2e(c: CitaPorLigar): void {
  sqlLocal(`
    insert into public.reserva_contactos (clinica_id, medico_id, clave_hmac, clase, bloqueado_en)
    select a.clinica_id, a.medico_id, x.clave, x.clase, now()
      from public.appointments a
      cross join lateral (values (a.reserva_tel_hmac, 'telefono'), (a.reserva_correo_hmac, 'correo')) x(clave, clase)
     where a.id = :'cita'::uuid
    on conflict (clinica_id, medico_id, clave_hmac) do update set bloqueado_en = now();`, { cita: c.citaId })
}

/**
 * El instante (reloj de la BASE) en que empieza un archivo de pruebas: lo que
 * se cree desde entonces en las tablas de reserva es de las pruebas. Se pide en
 * el `beforeAll` y se pasa a `limpiarReservasE2e`.
 */
export function marcaE2e(): string {
  return sqlLocal(`select clock_timestamp()::text`)
}

/**
 * Aparca (revoca) los enlaces VIGENTES de las clínicas de la semilla, para que
 * una prueba que necesita empezar sin enlace fijo no choque con uno hecho a
 * mano, y devuelve sus ids para `devolverEnlaces`. Se llama ANTES de
 * `marcaE2e()`: así `limpiarReservasE2e` no los «des-revoca» por su cuenta.
 */
export function aparcarEnlacesVigentes(): string[] {
  return sqlLocal(`
    update public.reserva_enlaces set revocado_en = now()
     where revocado_en is null
       and clinica_id in (select id from public.clinicas where nombre in ('Clínica Semilla A', 'Clínica Semilla B'))
    returning id;`).split('\n').filter(Boolean)
}

/** Vuelve a dejar vigentes los enlaces aparcados por `aparcarEnlacesVigentes`. */
export function devolverEnlaces(ids: readonly string[]): void {
  if (ids.length === 0) return
  sqlLocal(`update public.reserva_enlaces set revocado_en = null where id = any (string_to_array(:'ids', ',')::uuid[])`,
    { ids: ids.join(',') })
}

/**
 * Borra lo de reserva que se CREÓ DESDE `desde` (`marcaE2e()` del archivo) en
 * las dos clínicas de la semilla: citas por enlace, incidencias, contactos,
 * enlaces y los enlaces de confirmación y reagendados del bloque E, con sus
 * filas de `audit_log`, y el aviso de las e2e. Los enlaces de ANTES que una
 * prueba revocó (emitir un fijo revoca el vigente del médico) vuelven a quedar
 * vigentes. Ver la nota de la cabecera.
 *
 * ⚠️ HASTA EL 2026-11-13 BORRABA TODO LO DE RESERVA DE ESAS CLÍNICAS, también
 * lo hecho a mano (se llevó un enlace fijo de Angel). Lo de antes de `desde` no
 * se toca; lo que se cree A MANO mientras corre el archivo, sí se borra: no se
 * prueba a mano a la vez (`GUIA_PRUEBAS_AGENDA_V2.md`, §1). Y la semilla, que
 * corre `global-setup.ts` al empezar cada corrida, recrea las dos clínicas
 * enteras (AG-DT-46).
 */
export function limpiarReservasE2e(desde: string): void {
  /* Sin marca (el `beforeAll` falló antes de `marcaE2e`) el archivo no creó nada. */
  if (!desde) return
  sqlLocal(`
    begin;
    set local session_replication_role = replica;
    -- Para el bloque DO, donde psql no sustituye :'desde'.
    select set_config('e2e.desde', :'desde', true);
    create temp table _cl on commit drop as
      select id from public.clinicas where nombre in ('Clínica Semilla A', 'Clínica Semilla B');
    create temp table _citas on commit drop as
      select id from public.appointments
       where clinica_id in (select id from _cl) and reserva_canal is not null and created_at >= :'desde'::timestamptz;
    create temp table _obj on commit drop as
      select id from _citas
      union all select id from public.reserva_enlaces where clinica_id in (select id from _cl) and created_at >= :'desde'::timestamptz
      union all select id from public.reserva_contactos where clinica_id in (select id from _cl) and created_at >= :'desde'::timestamptz
      union all select id from public.reserva_incidencias where clinica_id in (select id from _cl) and created_at >= :'desde'::timestamptz;
    delete from public.audit_log where registro_id in (select id from _obj);
    -- Bloque E (E1 y E6): FK RESTRICT a la cita; con replica no saltarían y quedarían huérfanos.
    do $e$ begin
      if to_regclass('public.cita_reagendos') is not null then
        create temp table _reag on commit drop as
          select id from public.cita_reagendos where clinica_id in (select id from _cl)
             and (created_at >= current_setting('e2e.desde')::timestamptz
                  or cita_origen_id in (select id from _citas) or cita_nueva_id in (select id from _citas));
        delete from public.audit_log where registro_id in (select id from _reag);
        delete from public.cita_reagendos where id in (select id from _reag);
      end if;
      if to_regclass('public.cita_correos') is not null then
        delete from public.cita_correos where appointment_id in (select id from _citas);
      end if;
      if to_regclass('public.cita_confirmaciones') is not null then
        delete from public.audit_log where registro_id in (select id from public.cita_confirmaciones
          where clinica_id in (select id from _cl) and (created_at >= current_setting('e2e.desde')::timestamptz or appointment_id in (select id from _citas)));
        delete from public.cita_confirmaciones where clinica_id in (select id from _cl)
          and (created_at >= current_setting('e2e.desde')::timestamptz or appointment_id in (select id from _citas));
      end if;
    end $e$;
    delete from public.reserva_incidencias where id in (select id from _obj) or appointment_id in (select id from _citas);
    delete from public.reserva_contactos where id in (select id from _obj);
    update public.reserva_enlaces set usado_en = null, usado_cita_id = null where usado_cita_id in (select id from _citas);
    delete from public.appointments where id in (select id from _citas);
    delete from public.reserva_verificaciones where enlace_id in (select id from _obj);
    delete from public.reserva_enlaces where id in (select id from _obj);
    -- Defensivo: con aparcarEnlacesVigentes() antes de la marca no hay ninguno; sin
    -- aparcar (un archivo que no lo haga), el fijo de antes que una prueba revocó.
    update public.reserva_enlaces set revocado_en = null
     where clinica_id in (select id from _cl) and created_at < :'desde'::timestamptz and revocado_en >= :'desde'::timestamptz;
    delete from public.audit_log where tabla = 'reserva_avisos' and registro_id in (select id from public.reserva_avisos where version = '${AVISO_E2E}');
    delete from public.reserva_avisos where version = '${AVISO_E2E}';
    commit;`, { desde })
}

/**
 * Clic en la tarjeta de la rejilla por su esquina superior IZQUIERDA, no por
 * su centro (el clic por omisión de Playwright).
 *
 * ⚠️ NO ES UN `force`: Playwright sigue comprobando que el punto sea de la
 * tarjeta. Es que el centro puede no serlo. Con dos citas del mismo médico a
 * la misma hora, FullCalendar (`slotEventOverlap`) pinta la primera a todo el
 * ancho de la columna y monta la siguiente ENCIMA, desplazada a la derecha
 * (`.fc-timegrid-event-harness-inset`); el orden lo decide el título. Medido el
 * 2026-11-12 con la semilla («Paciente Prueba 02» a las 17:00 del jueves): la
 * tarjeta «Ligada…» quedaba debajo, 143.7 px de ancho, con el centro tapado
 * por el arnés de la vecina (`elementFromPoint` devolvía el arnés), mientras
 * que «Reserva…» quedaba encima. La tarjeta era estable: 0 mutaciones, 0
 * reemplazos y un solo rectángulo en 241 cuadros. La esquina izquierda es
 * siempre de la tarjeta, esté debajo o encima, que es donde haría clic una
 * persona.
 */
export async function clicEnTarjeta(tarjeta: Locator): Promise<void> {
  await tarjeta.click({ position: { x: 8, y: 8 } })
}
