import { notFound } from 'next/navigation'
import { sesionServidor } from '@/lib/supabase/sesionServidor'
import { analizarPerfilSesion } from '@/lib/perfil/perfilSesion'
import { canManageClinica } from '@/lib/permissions'
import { AjustesAgendaSchema, CAMPOS_AJUSTES_AGENDA, COLUMNAS_AJUSTES, type AjustesAgenda } from '@/lib/agenda/ajustesAgenda'
import { COLUMNAS_TIPO_CITA, type TipoCita } from '@/lib/agenda/tiposCita'
import { logger } from '@/lib/logger'
import ConfiguracionCalendario from '@/components/agenda/configuracion/ConfiguracionCalendario'

/**
 * /agenda/configuracion — la pantalla de configuración del calendario (plan
 * del bloque B, paso B4; decisiones P6 y P7). Detrás del interruptor de la
 * agenda v2: apagado, sin fila o sin la tabla `agenda_ajustes`, `notFound()`.
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
 * ⚠️ CLIENTE DE SESIÓN y `clinica_id` explícito en las dos lecturas. Nada de
 * `createAdminClient()`.
 */

type ClienteSesion = Awaited<ReturnType<typeof sesionServidor>>['supabase']

/**
 * El interruptor y los cuatro ajustes, en UNA consulta. `'apagado'` ante
 * cualquier duda (falla cerrado, como `agendaV2Encendida`). Con el interruptor
 * encendido pero unos ajustes que no cuadran, `ajustes: null`: la sección lo
 * dice y no deja guardar, en vez de enseñar los de fábrica como si fueran los
 * de la clínica y dejar que alguien los guarde encima.
 */
async function leerAjustes(supabase: ClienteSesion, clinicaId: string): Promise<'apagado' | { ajustes: AjustesAgenda | null }> {
  try {
    const { data, error } = await supabase.from('agenda_ajustes')
      .select(`agenda_v2_encendida, ${COLUMNAS_AJUSTES}`).eq('clinica_id', clinicaId).maybeSingle()
    if (error || data?.agenda_v2_encendida !== true) return 'apagado'
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

export default async function ConfiguracionCalendarioPage() {
  const { supabase, profile } = await sesionServidor()
  const perfil = analizarPerfilSesion(profile)
  if (!perfil?.clinica_id) notFound()
  const lectura = await leerAjustes(supabase, perfil.clinica_id)
  if (lectura === 'apagado') notFound()
  const tipos = await leerTipos(supabase, perfil.clinica_id)
  return (
    <ConfiguracionCalendario
      ajustes={lectura.ajustes}
      tipos={tipos}
      puedeAdministrar={canManageClinica(perfil)}
      usuarioId={perfil.id}
    />
  )
}
