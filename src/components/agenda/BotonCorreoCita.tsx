'use client'

/**
 * src/components/agenda/BotonCorreoCita.tsx — «Enviar confirmación por correo»
 * (G3, puntos 14 y 15 de la tanda de diseño): el correo PROPIO de Spinus, con o
 * sin Google conectado. Lo usan la burbuja tras agendar y el formulario de la
 * cita, sólo con la agenda v2 encendida (quien lo monta lo decide).
 *
 * QUIÉN LO PINTA DECIDE CON `motivoSinCorreo` (`whatsappCita.ts`), la misma
 * regla de la ruta: cita con paciente (o por ligar) con correo, agendada o
 * confirmada, con hora y futura. Si aun así el servidor la rechaza, el motivo
 * se dice en llano.
 *
 * ⚠️ MONTARLO NO ESCRIBE NADA: sólo al pulsar sale `POST /api/agenda/correo`,
 * que emite el enlace de confirmación (E2) y manda el correo. Un segundo envío
 * de la misma hora lo para la base («Ya se envió…»).
 *
 * Icono: un sobre (lucide `Mail`, decorativo). En la capa (rejilla de la
 * burbuja) el texto visible es «Por correo», junto a «Enviar confirmación» del
 * WhatsApp, como en la maqueta; su nombre accesible es el completo.
 * H4 · En la lista «Por confirmar» (`compacto`), «Correo» junto a «WhatsApp»,
 * del tamaño de aquél; el nombre accesible sigue siendo el completo.
 */
import { useEffect, useState, type ReactElement } from 'react'
import { Mail } from 'lucide-react'
import { TEXTO_SIN_CORREO, type MotivoSinCorreo } from '@/lib/agenda/whatsappCita'

type Estado = { tipo: 'inicial' } | { tipo: 'enviando' } | { tipo: 'enviado'; en: string } | { tipo: 'error'; motivo: string }

const MOTIVOS: Record<string, string> = {
  no_disponible: 'El correo no está disponible ahora para esta cita.',
  sin_enlace: 'No se pudo preparar el enlace de confirmación.',
  no_enviado: 'No se pudo enviar el correo. Inténtalo de nuevo.',
  sin_correo: TEXTO_SIN_CORREO.sin_correo,
}

function horaCorta(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
}

/** La respuesta de la ruta, en un estado. Nunca lanza. */
async function enviar(citaId: string): Promise<Estado> {
  try {
    const res = await fetch('/api/agenda/correo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cita_id: citaId }),
    })
    const d: unknown = await res.json().catch(() => null)
    const campo = (k: string): string => (typeof d === 'object' && d !== null && k in d && typeof Reflect.get(d, k) === 'string' ? String(Reflect.get(d, k)) : '')
    if (res.ok) return { tipo: 'enviado', en: campo('enviado') || new Date().toISOString() }
    if (campo('error') === 'ya_enviado') {
      const en = campo('enviado')
      return { tipo: 'error', motivo: en ? `Ya se envió por correo a las ${horaCorta(en)}.` : 'Ya se envió por correo.' }
    }
    const motivo = campo('motivo')
    if (motivo in TEXTO_SIN_CORREO) return { tipo: 'error', motivo: TEXTO_SIN_CORREO[motivo as MotivoSinCorreo] }
    return { tipo: 'error', motivo: MOTIVOS[campo('error')] ?? 'No se pudo enviar el correo.' }
  } catch {
    return { tipo: 'error', motivo: 'No se pudo enviar el correo.' }
  }
}

interface Props {
  citaId: string
  /** La cita ya está confirmada: el correo es un recordatorio. */
  confirmada?: boolean
  /** En la rejilla de una capa: «Por correo» visible, la pinta de `.ag-capa-boton`. */
  enCapa?: boolean
  /** La clase de su celda en la rejilla. */
  claseCelda?: string
  /** Dónde dejar el mensaje (enviado o el motivo de un error) para no dejar nada suelto en la rejilla. */
  alMensaje?: (m: { texto: string; alerta: boolean; breve?: string } | null) => void
  /** H4 · Pequeño, con «Correo» visible. */
  compacto?: boolean
  /** I5 · punto 17: un cuadrado con el sobre (la fila de «Por confirmar»); el nombre accesible es el completo. */
  soloIcono?: boolean
  /** Tanda K, punto 21 · El texto visible en la burbuja («Enviar por correo»); es también su nombre. */
  etiqueta?: string
  /** Tanda K, punto 21 · El foco itinerante de la barra de la burbuja. */
  tabIndex?: number
  onFocus?: () => void
}

export function BotonCorreoCita({ citaId, confirmada = false, enCapa = false, claseCelda, alMensaje, compacto = false, soloIcono = false, etiqueta, tabIndex, onFocus }: Props): ReactElement {
  const [estado, setEstado] = useState<Estado>({ tipo: 'inicial' })
  const nombre = confirmada ? 'Enviar recordatorio por correo' : 'Enviar confirmación por correo'
  const texto = estado.tipo === 'error' ? estado.motivo : estado.tipo === 'enviado' ? `Enviado por correo ${horaCorta(estado.en)}` : null
  const alerta = estado.tipo === 'error'
  const breve = estado.tipo === 'enviado' ? `Correo enviado ${horaCorta(estado.en)}` : undefined
  useEffect(() => { alMensaje?.(texto === null ? null : { texto, alerta, breve }) }, [texto, alerta, breve, alMensaje])
  const clase = soloIcono ? 'ag-boton-icono' : enCapa
    ? 'ag-capa-boton w-full'
    : `${compacto ? 'px-2.5 py-1.5 text-[12px]' : 'w-full px-3 py-2.5 text-sm'} flex items-center justify-center gap-1.5 rounded-xl font-bold border transition-colors hover:bg-[var(--ag-btn-ghost-hover)] disabled:opacity-60`
  const estilo = enCapa || soloIcono ? undefined : { color: 'var(--ag-text)', borderColor: 'var(--ag-input-border)' }
  return (
    <div data-correo-cita={citaId} className={claseCelda ? `ag-lectura-celda ${claseCelda}` : undefined}>
      <button type="button" aria-label={etiqueta ? (estado.tipo === 'enviando' ? etiqueta : undefined) : nombre} className={clase} style={estilo} title={soloIcono ? nombre : undefined}
        tabIndex={tabIndex} onFocus={onFocus}
        disabled={estado.tipo === 'enviando' || estado.tipo === 'enviado'} aria-busy={soloIcono && estado.tipo === 'enviando' ? true : undefined}
        onClick={() => { setEstado({ tipo: 'enviando' }); void enviar(citaId).then(setEstado) }}>
        <Mail size={enCapa || soloIcono ? 18 : 15} aria-hidden="true" className="flex-none" />
        {soloIcono ? null : estado.tipo === 'enviando' ? 'Enviando…' : etiqueta ?? (enCapa ? 'Por correo' : compacto ? 'Correo' : nombre)}
      </button>
      {!alMensaje && texto && (
        <p role={alerta ? 'alert' : undefined} className="text-[12px] mt-1 leading-relaxed" style={{ color: 'var(--ag-muted)' }}>{texto}</p>
      )}
    </div>
  )
}
