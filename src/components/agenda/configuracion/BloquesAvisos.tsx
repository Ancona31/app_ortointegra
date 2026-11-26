'use client'

/**
 * Los tres bloques de «Avisos por correo» (tanda J, J5): el recordatorio al
 * paciente, el aviso a la clínica por cada cita apartada y hasta cuándo pueden
 * apartar. Los pintan el paso 3 del funnel (`variante="funnel"`: tarjetas
 * sueltas, «Recomendado», los plazos plegados con «Cambiar»/«Listo») y la
 * pestaña «Avisos» (`"config"`: dentro del panel, los plazos a la vista).
 * Los textos, los de cada maqueta.
 *
 * Lo que la maqueta no tiene y se conserva (inventario de J5, fila 27):
 *   · la vigencia del enlace de una vez, como tercer campo de los plazos (sólo
 *     en la pestaña).
 * Quien no administra la clínica lo ve deshabilitado, con la razón.
 *
 * EL RECORDATORIO SE ELIGE EN HORAS, LIBRE (decisión de Angel, 2026-11-26: «que cada quien escoja con
 * cuántas horas de antelación se manda»): un campo numérico como los de los plazos (`CampoNumero`), en el
 * rango de la base (`LIMITES_AJUSTES_AGENDA`), en vez de la lista fija de cuatro opciones. Se guarda como
 * ellos (al salir del campo o 700 ms después de la última tecla) y su error sale debajo de él.
 *
 * B13 · AG9/AG10 (rediseño, maquetas `ag-config` y `ag-pv`): filas de ajustes en UNA superficie con separadores
 * (`.agc-lista`): título 15/600 y ayuda 13 a la izquierda, el interruptor a la derecha, alineado con el título.
 * En la pestaña, dos grupos con rótulo («Avisos por correo» y «Hasta cuándo pueden apartar», con los plazos como
 * frases con su número); en el asistente, una sola superficie con los tres, los plazos plegados.
 */
import { useId, useState, type ReactNode } from 'react'
import { CalendarRange, Mail, Star } from 'lucide-react'
import Interruptor from '@/components/agenda/configuracion/Interruptor'
import { AVISO_SOLO_ADMIN, AYUDA, BLOQUE, BOTON_CHICO, CAMPO_NUEVO, ERROR, ETIQUETA, LISTA, PIE, ROTULO, SOLO_ADMIN, TITULO_BLOQUE } from '@/components/agenda/configuracion/estilosConfig'
import type { EstadoAvisos } from '@/components/agenda/configuracion/estadoAvisos'
import { ETIQUETAS_AJUSTES_AGENDA, LIMITES_AJUSTES_AGENDA, type CampoAjusteAgenda } from '@/lib/agenda/ajustesAgenda'

type Variante = 'funnel' | 'config'
interface Props { estado: EstadoAvisos; puedeEditar: boolean; variante: Variante }

const NO_DISPONIBLE = 'No disponible en este servidor.'
/** Una fila de ajuste: rellenos de la lista (16 · 20 en ancho). */
const FILA_AJUSTE = 'flex flex-col gap-[12px] px-[16px] py-[14px] ih:px-[20px] iv:px-[20px] esc:px-[20px]'

/** Título y ayuda a la izquierda; el control (interruptor o botón) a la derecha, alineado con el título. */
function ConControl({ titulo, ayuda, control }: { titulo: ReactNode; ayuda: ReactNode; control: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-[16px]">
      <div className="flex min-w-0 flex-col gap-[3px]">
        {titulo}
        <span className={AYUDA}>{ayuda}</span>
      </div>
      {control}
    </div>
  )
}

/** ¿Es del recordatorio el error de validación? (Los mensajes de `ajustesAgenda.ts` empiezan por el nombre del campo.) */
function esDelRecordatorio(error: string | null): boolean {
  return error !== null && error.startsWith(ETIQUETAS_AJUSTES_AGENDA.recordatorio_horas.nombre)
}

function Recordatorio({ estado, puedeEditar, variante }: Props) {
  const id = useId()
  const titulo = (
    <div className="flex flex-wrap items-center gap-x-[8px] gap-y-[4px]">
      <span id={`${id}-r`} className={TITULO_BLOQUE}>Recordarle su cita al paciente</span>
      {variante === 'funnel' && <span className="k-etq k-etq-ok"><Star aria-hidden="true" />Recomendado</span>}
    </div>
  )
  return (
    <div className={FILA_AJUSTE}>
      <ConControl titulo={titulo}
        ayuda={<>{variante === 'funnel'
          ? 'Le llega un correo antes de su cita para que no se le olvide. Solo a pacientes que tengan correo.'
          : 'Le llega un correo antes de su cita. Solo a pacientes que tengan correo.'}
          {estado.recordatorio === null && ` ${NO_DISPONIBLE}`}</>}
        control={<Interruptor encendido={estado.recordatorio === true} etiquetadoPor={`${id}-r`} alCambiar={() => estado.cambiarInterruptor('recordatorio_encendido')}
          deshabilitado={!puedeEditar || estado.recordatorio === null || estado.ocupado !== null} />} />
      {estado.recordatorio === true && estado.textos && (
        <>
          <CampoNumero estado={estado} campo="recordatorio_horas" antes="Mandarlo" despues="horas antes de la cita" puedeEditar={puedeEditar} />
          {esDelRecordatorio(estado.invalido) && <p role="alert" className={ERROR}>{estado.invalido}</p>}
        </>
      )}
    </div>
  )
}

function AvisoClinica({ estado, puedeEditar }: Props) {
  const id = useId()
  return (
    <div className={FILA_AJUSTE}>
      {/* Lo reciben quienes administran la clínica: a quien no administra, la maqueta («Avisarme», «Te llega») le mentiría. */}
      <ConControl titulo={<span id={`${id}-n`} className={TITULO_BLOQUE}>{puedeEditar ? 'Avisarme cuando alguien aparte cita' : 'Avisar a la clínica cuando alguien aparte cita'}</span>}
        ayuda={<>{puedeEditar ? 'Te llega un correo cada vez que un paciente aparta o cambia su cita con tu enlace.'
          : 'A quien administra la clínica le llega un correo cada vez que un paciente aparta o cambia su cita con un enlace.'}
          {estado.correoClinica === null && ` ${NO_DISPONIBLE}`}</>}
        control={<Interruptor encendido={estado.correoClinica === true} etiquetadoPor={`${id}-n`} alCambiar={() => estado.cambiarInterruptor('correo_reserva_clinica')}
          deshabilitado={!puedeEditar || estado.correoClinica === null || estado.ocupado !== null} />} />
    </div>
  )
}

/** Un plazo como frase con su número («Pueden ver horarios de los próximos [60] días»); si no cabe, el número baja. */
function CampoNumero({ estado, campo, antes, despues, puedeEditar }: { estado: EstadoAvisos; campo: CampoAjusteAgenda; antes: string; despues: string; puedeEditar: boolean }) {
  const l = LIMITES_AJUSTES_AGENDA[campo]
  return (
    <label className={`${ETIQUETA} justify-between gap-x-[12px]`}>
      <span className="flex-[1_1_150px]">{antes}</span>
      <span className="flex items-center gap-[8px] text-tinta2">
        <input type="number" inputMode="numeric" min={l.min} max={l.max} className={`${CAMPO_NUEVO} agc-num w-[76px]`} disabled={!puedeEditar}
          value={estado.textos?.[campo] ?? ''} onChange={e => estado.escribir(campo, e.target.value)} onBlur={estado.soltar} />
        {despues}
      </span>
    </label>
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
      {estado.invalido && !esDelRecordatorio(estado.invalido) && <p role="alert" className={ERROR}>{estado.invalido}</p>}
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
    <div className={FILA_AJUSTE}>
      <ConControl titulo={<span className={TITULO_BLOQUE}>Hasta cuándo pueden apartar</span>}
        ayuda={<>Pueden apartar cita para los próximos <strong className="font-semibold text-tinta">{t?.horizonte_dias ?? '—'} días</strong>. La cita más pronto que pueden
          tomar es dentro de <strong className="font-semibold text-tinta">{t?.anticipacion_min_horas ?? '—'} horas</strong>.</>}
        control={p.puedeEditar && t ? (
          <button type="button" className={BOTON_CHICO} aria-expanded={abierto} onClick={() => { if (abierto) p.estado.soltar(); setAbierto(!abierto) }}>
            {abierto ? 'Listo' : 'Cambiar'}
          </button>
        ) : null} />
      {abierto && (
        <div className="flex flex-col gap-[12px]">
          <Campos {...p} />
          <p className={`m-0 ${AYUDA}`}>Esto cambia para todos los médicos de la clínica.</p>
        </div>
      )}
    </div>
  )
}

/** Pestaña: los plazos a la vista, como frases con su número, en su grupo. */
function PlazosAbiertos(p: Props) {
  return (
    <section className={BLOQUE} aria-label="Hasta cuándo pueden apartar">
      <h3 className={ROTULO}><CalendarRange size={16} strokeWidth={2} aria-hidden="true" className="flex-none" />Hasta cuándo pueden apartar</h3>
      <div className={LISTA}>
        {p.estado.textos
          ? <div className={FILA_AJUSTE}><Campos {...p} /></div>
          : <p className={`${FILA_AJUSTE} ${AYUDA}`}>No se pudieron leer los plazos de la clínica. Recarga la página.</p>}
      </div>
      <p className={PIE}>Esto cambia para todos los médicos de la clínica.</p>
    </section>
  )
}

export default function BloquesAvisos(p: Props) {
  /* Tanda M (punto 15): el aviso, al inicio y no al final, en la pestaña y en el asistente. */
  const soloAdmin = !p.puedeEditar && <p data-solo-admin className={AVISO_SOLO_ADMIN}>{SOLO_ADMIN}</p>
  if (p.variante === 'funnel') {
    return (
      <>
        {soloAdmin}
        <div className={LISTA}>
          <Recordatorio {...p} />
          <AvisoClinica {...p} />
          <PlazosPlegados {...p} />
        </div>
      </>
    )
  }
  return (
    <>
      {soloAdmin}
      <section className={BLOQUE} aria-label="Avisos por correo">
        {/* El nombre del grupo ya es el `h2` de la pestaña («Avisos por correo»): este rótulo es sólo visual. */}
        <p aria-hidden="true" className={ROTULO}><Mail size={16} strokeWidth={2} className="flex-none" />Avisos por correo</p>
        <div className={LISTA}>
          <Recordatorio {...p} />
          <AvisoClinica {...p} />
        </div>
      </section>
      <PlazosAbiertos {...p} />
    </>
  )
}
