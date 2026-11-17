/**
 * correoClinicaReserva.ts — el correo A LA CLÍNICA por cada reserva nueva por
 * enlace (tanda I, punto 20 de Angel). SÓLO SERVIDOR; corre en el `after()`
 * de POST /api/reservar/[codigo], detrás del comprobante, fuera de la
 * transacción de la reserva: la cita ya existe y nada de esto la cambia.
 *
 * Es una OPCIÓN de la configuración de la agenda,
 * `agenda_ajustes.correo_reserva_clinica`, APAGADA de fábrica (migración
 * `20261121150000`). Sin la columna (base sin la migración) o sin fila, no
 * se manda nada: lo de hoy.
 *
 * A quién: a los administradores de la clínica (`es_admin_de_clinica`), hasta
 * tres; la clínica no tiene columna de correo propia. El correo sale por Auth
 * (`getUserById`, como `medicoCorreo.ts`), nunca de la petición.
 *
 * Qué lleva: SÓLO quién reservó (el nombre que escribió), fecha, hora, médico
 * y consultorio. Nada clínico: ni tipo de cita, ni motivo, ni teléfono, ni
 * correo de la persona. Un reagendado por el paciente sale con su asunto.
 *
 * Registro: `audit_log` (`correo_reserva_clinica`, sin el correo ni el
 * nombre). NO va a `cita_correos`: ese registro es de correos AL PACIENTE y lo
 * lee la tarea de recordatorios.
 *
 * ⚠️ CLIENTE DE SERVICIO: cada lectura filtra por `clinica_id` (pendiente
 * prioritario de CLAUDE.md). Nunca lanza; al logger sólo etiquetas.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import { enviarCorreo } from '@/lib/correo/transporte'
import { fechaDeCorreo, htmlCorreoCita, textoCorreoCita, type PartesCorreo } from '@/lib/correo/plantillaCita'
import { fechaHoraEnZona, type CorreoListo } from '@/lib/reserva/correosReserva'

const TAG = 'reserva'
const ETIQUETA = 'reserva_aviso_clinica'
/** Tope de destinatarios: una clínica tiene uno o dos administradores. */
const MAX_DESTINATARIOS = 3

export interface ReservaParaClinica {
  clinicaId: string
  citaId: string
  /** El nombre que escribió quien reservó. */
  nombre: string
  medico: string
  consultorio: string
  inicio: string
  zona: string
  /** Un reagendado por el paciente (la cita nueva de un cambio). */
  reagendada: boolean
}

/** Puro: el correo, sin nada clínico. */
export function correoReservaClinica(r: Omit<ReservaParaClinica, 'clinicaId' | 'citaId'>): CorreoListo {
  const cuando = fechaHoraEnZona(r.inicio, r.zona)
  const quien = r.nombre.trim() || 'Un paciente'
  const titulo = r.reagendada ? 'Cita reagendada por el paciente' : 'Reserva nueva por enlace'
  const frase = r.reagendada ? `${quien} reagendó su cita para el ${cuando}.` : `${quien} reservó una cita para el ${cuando}.`
  const partes: PartesCorreo = {
    preencabezado: frase,
    titulo,
    fecha: fechaDeCorreo(r.inicio, r.zona),
    parrafos: [frase],
    datos: [{ etiqueta: 'Nombre', valor: quien }, { etiqueta: 'Médico', valor: r.medico }, { etiqueta: 'Consultorio', valor: r.consultorio }],
    pie: ['Recibes este correo porque la opción «Avisar por correo de cada reserva» está encendida en la configuración de la agenda.'],
  }
  return {
    asunto: r.reagendada ? `Cita reagendada: ${quien}, ${cuando}` : `Reserva nueva: ${quien}, ${cuando}`,
    texto: textoCorreoCita(partes, [frase, `Médico: ${r.medico}.\nConsultorio: ${r.consultorio}.`]),
    html: htmlCorreoCita(partes),
  }
}

type Admin = ReturnType<typeof createAdminClient>

/** ¿La clínica encendió la opción? Sin columna, sin fila o con error: no. */
async function opcionEncendida(admin: Admin, clinicaId: string): Promise<boolean> {
  const { data, error } = await admin.from('agenda_ajustes').select('correo_reserva_clinica')
    .eq('clinica_id', clinicaId).maybeSingle<{ correo_reserva_clinica: boolean | null }>()
  return !error && data?.correo_reserva_clinica === true
}

/** Los correos de los administradores de ESA clínica (perfil filtrado por `clinica_id` antes de ir a Auth). */
async function correosDeAdministradores(admin: Admin, clinicaId: string): Promise<string[]> {
  const { data, error } = await admin.from('profiles').select('id')
    .eq('clinica_id', clinicaId).eq('es_admin_de_clinica', true).order('id').limit(MAX_DESTINATARIOS)
  if (error || !data) return []
  const correos = await Promise.all(data.map(async (p: { id: string }) => {
    const { data: u, error: e } = await admin.auth.admin.getUserById(p.id)
    return e ? '' : u?.user?.email?.trim().toLowerCase() ?? ''
  }))
  return [...new Set(correos.filter(c => c !== ''))]
}

/** Manda el aviso a la clínica si la opción está encendida. Nunca lanza. */
export async function avisarReservaAClinica(r: ReservaParaClinica): Promise<void> {
  try {
    const admin = createAdminClient()
    if (!(await opcionEncendida(admin, r.clinicaId))) return
    const para = await correosDeAdministradores(admin, r.clinicaId)
    if (para.length === 0) return
    const correo = correoReservaClinica(r)
    const enviados = await Promise.all(para.map(p => enviarCorreo({ para: p, ...correo, etiqueta: ETIQUETA })))
    await logAudit({
      userId: null, accion: 'correo_reserva_clinica', tabla: 'appointments', registroId: r.citaId,
      descripcion: `clinica=${r.clinicaId} destinatarios=${para.length} enviados=${enviados.filter(e => e.ok).length}${r.reagendada ? ' reagendada' : ''}`,
    })
  } catch (err) {
    logger.error(TAG, `aviso a la clínica no enviado: ${err instanceof Error ? err.name : 'desconocido'}`)
  }
}
