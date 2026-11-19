'use client'

/**
 * Los tres bloques de «Avisos por correo» (tanda J, J5): el recordatorio al
 * paciente, el aviso a la clínica por cada cita apartada y hasta cuándo pueden
 * apartar. Los pintan el paso 3 del funnel (`variante="funnel"`: tarjetas
 * sueltas, «Recomendado», los plazos plegados con «Cambiar»/«Listo») y la
 * pestaña «Avisos» (`"config"`: dentro del panel, los plazos a la vista).
 * Los textos, los de cada maqueta.
 *
 * Lo que la maqueta no tiene y se conserva (inventario de J5, filas 24 y 27):
 *   · un recordatorio que la clínica ya tenía en otro valor sale como opción
 *     más del selector (`opcionesRecordatorio`), y no se pisa;
 *   · la vigencia del enlace de una vez, como tercer campo de los plazos (sólo
 *     en la pestaña).
 * Quien no administra la clínica lo ve deshabilitado, con la razón.
 */
import { useId, useState } from 'react'
import Interruptor from '@/components/agenda/configuracion/Interruptor'
import { AYUDA, BLOQUE, BOTON_CHICO, CAMPO_NUEVO, ERROR, ETIQUETA, TARJETA, TITULO_BLOQUE } from '@/components/agenda/configuracion/estilosConfig'
import type { EstadoAvisos } from '@/components/agenda/configuracion/estadoAvisos'
import { opcionesRecordatorio } from '@/lib/agenda/primeraVez'
import { LIMITES_AJUSTES_AGENDA, type CampoAjusteAgenda } from '@/lib/agenda/ajustesAgenda'

type Variante = 'funnel' | 'config'
interface Props { estado: EstadoAvisos; puedeEditar: boolean; variante: Variante }

const NO_DISPONIBLE = 'No disponible en este servidor.'

function Recordatorio({ estado, puedeEditar, variante }: Props) {
  const id = useId()
  const horas = estado.textos ? Number(estado.textos.recordatorio_horas) : null
  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-start justify-between gap-[20px]">
        <div className="flex flex-col gap-[6px]">
          <div className="flex flex-wrap items-center gap-[10px]">
            <span id={`${id}-r`} className={TITULO_BLOQUE}>Recordarle su cita al paciente</span>
            {variante === 'funnel' && (
              <span className="rounded-full bg-[var(--ag-success-bg)] px-[10px] py-[3px] text-[13px] font-semibold text-[var(--ag-success-text)]">Recomendado</span>
            )}
          </div>
          <span className={AYUDA}>
            {variante === 'funnel'
              ? 'Le llega un correo antes de su cita para que no se le olvide. Solo a pacientes que tengan correo.'
              : 'Le llega un correo antes de su cita. Solo a pacientes que tengan correo.'}
            {estado.recordatorio === null && ` ${NO_DISPONIBLE}`}
          </span>
        </div>
        <Interruptor encendido={estado.recordatorio === true} etiquetadoPor={`${id}-r`} alCambiar={() => estado.cambiarInterruptor('recordatorio_encendido')}
          deshabilitado={!puedeEditar || estado.recordatorio === null || estado.ocupado !== null} />
      </div>
      {estado.recordatorio === true && estado.textos && (
        <label className={ETIQUETA}>Mandarlo
          <select className={CAMPO_NUEVO} value={String(horas)} disabled={!puedeEditar}
            onChange={e => estado.escribir('recordatorio_horas', e.target.value, true)}>
            {opcionesRecordatorio(horas).map(o => <option key={o.horas} value={String(o.horas)}>{o.texto}</option>)}
          </select>
          antes de la cita</label>
      )}
    </div>
  )
}

function AvisoClinica({ estado, puedeEditar }: Props) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-[20px]">
      <div className="flex flex-col gap-[6px]">
        {/* Lo reciben quienes administran la clínica: a quien no administra, la maqueta («Avisarme», «Te llega») le mentiría. */}
        <span id={`${id}-n`} className={TITULO_BLOQUE}>{puedeEditar ? 'Avisarme cuando alguien aparte cita' : 'Avisar a la clínica cuando alguien aparte cita'}</span>
        <span className={AYUDA}>
          {puedeEditar ? 'Te llega un correo cada vez que un paciente aparta o cambia su cita con tu enlace.'
            : 'A quien administra la clínica le llega un correo cada vez que un paciente aparta o cambia su cita con un enlace.'}
          {estado.correoClinica === null && ` ${NO_DISPONIBLE}`}
        </span>
      </div>
      <Interruptor encendido={estado.correoClinica === true} etiquetadoPor={`${id}-n`} alCambiar={() => estado.cambiarInterruptor('correo_reserva_clinica')}
        deshabilitado={!puedeEditar || estado.correoClinica === null || estado.ocupado !== null} />
    </div>
  )
}

function CampoNumero({ estado, campo, antes, despues, puedeEditar }: { estado: EstadoAvisos; campo: CampoAjusteAgenda; antes: string; despues: string; puedeEditar: boolean }) {
  const l = LIMITES_AJUSTES_AGENDA[campo]
  return (
    <label className={ETIQUETA}>{antes}
      <input type="number" inputMode="numeric" min={l.min} max={l.max} className={`${CAMPO_NUEVO} w-[88px]`} disabled={!puedeEditar}
        value={estado.textos?.[campo] ?? ''} onChange={e => estado.escribir(campo, e.target.value)} onBlur={estado.soltar} />
      {despues}</label>
  )
}

function Campos({ estado, puedeEditar, variante }: Props) {
  return (
    <>
      <CampoNumero estado={estado} campo="horizonte_dias" antes="Pueden ver horarios de los próximos" despues="días" puedeEditar={puedeEditar} />
      <CampoNumero estado={estado} campo="anticipacion_min_horas" antes="No pueden apartar si faltan menos de" despues="horas" puedeEditar={puedeEditar} />
      {variante === 'config' && (
        <CampoNumero estado={estado} campo="vigencia_enlace_unico_dias" antes="Un enlace de una vez deja de servir a los" despues="días" puedeEditar={puedeEditar} />
      )}
      {estado.invalido && <p role="alert" className={ERROR}>{estado.invalido}</p>}
    </>
  )
}

/** Funnel: la frase con los dos números y, al pulsar «Cambiar», los campos. */
function PlazosPlegados(p: Props) {
  const [pedido, setAbierto] = useState(false)
  /* Con un plazo inválido no se pliega: si no, «Terminar» quedaba apagado sin que se viera por qué. */
  const abierto = pedido || p.estado.invalido !== null
  const t = p.estado.textos
  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-start justify-between gap-[20px]">
        <div className="flex flex-col gap-[6px]">
          <span className={TITULO_BLOQUE}>Hasta cuándo pueden apartar</span>
          <span className={AYUDA}>
            Pueden apartar cita para los próximos <strong className="text-[var(--ag-ink)]">{t?.horizonte_dias ?? '—'} días</strong>. La cita más pronto que pueden
            tomar es dentro de <strong className="text-[var(--ag-ink)]">{t?.anticipacion_min_horas ?? '—'} horas</strong>.
          </span>
        </div>
        {p.puedeEditar && t && (
          <button type="button" className={BOTON_CHICO} aria-expanded={abierto} onClick={() => { if (abierto) p.estado.soltar(); setAbierto(!abierto) }}>
            {abierto ? 'Listo' : 'Cambiar'}
          </button>
        )}
      </div>
      {abierto && (
        <div className="flex flex-col gap-[12px] rounded-[12px] bg-[var(--ag-surface-sunken)] p-[16px]">
          <Campos {...p} />
          <p className="m-0 text-[13.5px] text-[var(--ag-ink-600)]">Esto cambia para todos los médicos de la clínica.</p>
        </div>
      )}
    </div>
  )
}

function PlazosAbiertos(p: Props) {
  return (
    <div className="flex flex-col gap-[12px]">
      <div className="flex flex-col gap-[4px]">
        <span className={TITULO_BLOQUE}>Hasta cuándo pueden apartar</span>
        <span className={AYUDA}>Esto cambia para todos los médicos de la clínica.</span>
      </div>
      {p.estado.textos ? <Campos {...p} /> : <p className={AYUDA}>No se pudieron leer los plazos de la clínica. Recarga la página.</p>}
    </div>
  )
}

const SOLO_ADMIN = 'Estos avisos los cambia quien administra la clínica.'

export default function BloquesAvisos(p: Props) {
  if (p.variante === 'funnel') {
    return (
      <>
        <div className={`${TARJETA} gap-[14px] px-[24px] py-[22px]`}><Recordatorio {...p} /></div>
        <div className={`${TARJETA} px-[24px] py-[22px]`}><AvisoClinica {...p} /></div>
        <div className={`${TARJETA} gap-[14px] px-[24px] py-[22px]`}><PlazosPlegados {...p} /></div>
        {!p.puedeEditar && <p className={AYUDA}>{SOLO_ADMIN}</p>}
      </>
    )
  }
  return (
    <>
      {!p.puedeEditar && <p className={AYUDA}>{SOLO_ADMIN}</p>}
      <div className={BLOQUE}><Recordatorio {...p} /></div>
      <div className={BLOQUE}><AvisoClinica {...p} /></div>
      <div className={BLOQUE}><PlazosAbiertos {...p} /></div>
    </>
  )
}
