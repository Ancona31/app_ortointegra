import { notFound } from 'next/navigation'
import { sesionServidor } from '@/lib/supabase/sesionServidor'
import { analizarPerfilSesion } from '@/lib/perfil/perfilSesion'
import { canManageClinica, canVerAgendaCompleta, isMedico } from '@/lib/permissions'
import {
  AjustesAgendaSchema, CAMPOS_AJUSTES_AGENDA, COLUMNAS_AJUSTES, agendaV2Encendida, leerRecordatorioEncendido, leerCorreoReservaClinica, type AjustesAgenda,
} from '@/lib/agenda/ajustesAgenda'
import { COLUMNAS_TIPO_CITA, type TipoCita } from '@/lib/agenda/tiposCita'
import { logger } from '@/lib/logger'
import ConfiguracionAgenda from '@/components/agenda/configuracion/ConfiguracionAgenda'

/**
 * /agenda/configuracion — la pantalla de configuración del calendario (plan
 * del bloque B, paso B4; decisiones P6 y P7). Detrás del interruptor de la
 * agenda v2: apagado (lo dice la base) o sin la tabla `agenda_ajustes`, `notFound()`.
 *
 * ⚠️ AUTORIDAD: `sesionServidor()`, o sea `getUser()`, compartido con el
 * layout. Esta página NO redirige: sin sesión redirige el layout, como
 * siempre, y quien no puede editar ve en solo lectura (P7) en vez de ser
 * mandado a otra parte («Autoridad de sesión» de `CLAUDE.md`).
 *
 * ⚠️ EL 404 PUEDE LLEGAR CON ESTADO 200. `(app)/loading.tsx` y el de esta
 * carpeta son fronteras de `Suspense`: si el cuerpo ya empezó a salir cuando
 * se llama a `notFound()`, Next pinta la página de no encontrado con
 * `noindex` pero ya no puede cambiar el estado HTTP
 * (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md`,
 * «Status Codes»). Lo que importa aquí —que la pantalla no exista con el
 * interruptor apagado— se cumple en los dos casos.
 *
 * ⚠️ CLIENTE DE SESIÓN y `clinica_id` explícito en todas las lecturas. Nada
 * de `createAdminClient()`.
 *
 * Tanda J (J5, puntos 13 y 14): pinta `ConfiguracionAgenda` —el funnel de
 * primera vez o las cinco pestañas de las maquetas— en vez de
 * `ConfiguracionCalendario` (las ocho pestañas de la tanda H), que se queda en
 * disco. Las lecturas no cambian.
 */

type ClienteSesion = Awaited<ReturnType<typeof sesionServidor>>['supabase']

/**
 * El interruptor y los cuatro ajustes, a la vez. `'apagado'` ante cualquier
 * duda (falla cerrado). Agenda para todos (M3): el interruptor lo contesta la
 * base (`agendaV2Encendida`, la misma regla que el resto de la app), no la
 * fila; los ajustes sí salen de la fila. Encendida pero sin fila o con unos
 * ajustes que no cuadran, `ajustes: null`: la sección lo dice y no deja
 * guardar, en vez de enseñar los de fábrica como si fueran los de la clínica y
 * dejar que alguien los guarde encima.
 */
async function leerAjustes(supabase: ClienteSesion, clinicaId: string): Promise<'apagado' | { ajustes: AjustesAgenda | null }> {
  try {
    const [encendida, { data, error }] = await Promise.all([
      agendaV2Encendida(supabase, clinicaId),
      supabase.from('agenda_ajustes').select(COLUMNAS_AJUSTES).eq('clinica_id', clinicaId).maybeSingle(),
    ])
    if (!encendida || error) return 'apagado'
    if (!data) {
      logger.warn('agenda', 'clínica con la agenda encendida y sin fila de ajustes en la pantalla de configuración')
      return { ajustes: null }
    }
    const r = AjustesAgendaSchema.safeParse(Object.fromEntries(CAMPOS_AJUSTES_AGENDA.map(c => [c, data[c]])))
    if (!r.success) logger.warn('agenda', 'ajustes de la agenda con forma inesperada en la pantalla de configuración')
    return { ajustes: r.success ? r.data : null }
  } catch (err: unknown) {
    logger.warn('agenda', `pantalla de configuración sin interruptor: ${err instanceof Error ? err.message : 'error'}`)
    return 'apagado'
  }
}

/** Los tipos de cita que la RLS deja ver, archivados incluidos. `null` si falla. */
async function leerTipos(supabase: ClienteSesion, clinicaId: string): Promise<TipoCita[] | null> {
  try {
    const { data, error } = await supabase.from('tipos_cita').select(COLUMNAS_TIPO_CITA)
      .eq('clinica_id', clinicaId).order('nombre')
    if (error) {
      logger.warn('agenda', `tipos de cita sin leer en la configuración: ${error.code ?? ''} ${error.message}`)
      return null
    }
    return data ?? []
  } catch (err: unknown) {
    logger.warn('agenda', `tipos de cita sin leer en la configuración: ${err instanceof Error ? err.message : 'error'}`)
    return null
  }
}

/**
 * Los médicos ADMINISTRADORES de la clínica (tanda H, punto 6): sus enlaces se
 * ven abiertos; los de los médicos invitados van plegados. Cliente de sesión
 * (la misma lectura de `profiles` de la clínica que el agregado de
 * configuración). Ante un fallo, lista vacía: todo plegado salvo lo propio.
 */
async function leerAdministradores(supabase: ClienteSesion, clinicaId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase.from('profiles').select('id')
      .eq('clinica_id', clinicaId).eq('role', 'medico').eq('es_admin_de_clinica', true)
    if (error) {
      logger.warn('agenda', `administradores sin leer en la configuración: ${error.code ?? ''}`)
      return []
    }
    return (data ?? []).map(f => String(f.id))
  } catch {
    return []
  }
}

/**
 * K3 (punto 12): el huso «de fábrica» de la clínica (`clinicas.timezone`), o `null` si no tiene, si la
 * columna no existe todavía (42703, código antes que la migración) o si algo falla. Cliente de sesión
 * (`clinicas_select_own_or_super_admin`) y `clinica_id` explícito.
 */
async function leerHusoClinica(supabase: ClienteSesion, clinicaId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.from('clinicas').select('timezone').eq('id', clinicaId).maybeSingle()
    if (error) {
      if (error.code !== '42703') logger.warn('agenda', `huso de la clínica sin leer: ${error.code ?? ''}`)
      return null
    }
    return typeof data?.timezone === 'string' && data.timezone ? data.timezone : null
  } catch {
    return null
  }
}

export default async function ConfiguracionCalendarioPage() {
  const { supabase, profile } = await sesionServidor()
  const perfil = analizarPerfilSesion(profile)
  if (!perfil?.clinica_id) notFound()
  const lectura = await leerAjustes(supabase, perfil.clinica_id)
  if (lectura === 'apagado') notFound()
  const [tipos, recordatorio, correoClinica, administradores, husoClinica] = await Promise.all([
    leerTipos(supabase, perfil.clinica_id),
    leerRecordatorioEncendido(supabase, perfil.clinica_id),
    leerCorreoReservaClinica(supabase, perfil.clinica_id),
    leerAdministradores(supabase, perfil.clinica_id),
    leerHusoClinica(supabase, perfil.clinica_id),
  ])
  return (
    <ConfiguracionAgenda
      ajustes={lectura.ajustes}
      recordatorio={recordatorio}
      correoClinica={correoClinica}
      administradores={administradores}
      husoClinica={husoClinica}
      tipos={tipos}
      puedeAdministrar={canManageClinica(perfil)}
      usuarioId={perfil.id}
      gestionaReservasDeTodos={canVerAgendaCompleta(perfil)}
      esMedico={isMedico(perfil)}
    />
  )
}
