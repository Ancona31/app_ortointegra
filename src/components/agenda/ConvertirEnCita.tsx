'use client'

/**
 * src/components/agenda/ConvertirEnCita.tsx
 *
 * T3 · CONVERTIR EN CITA un evento nacido en Google (§2 del plan: los eventos
 * creados en Google entran a Spinus «convertibles en cita ligándolos a un
 * paciente»; AG-DT-29). Detrás del interruptor: sólo lo abre la tarjeta de
 * lectura (`InteraccionesV2`, chunk de la v2), con «Convertir en cita».
 *
 * Pide lo que una cita necesita y un evento no tiene: el PACIENTE (el buscador
 * de la burbuja, o «Registrar paciente nuevo» con `QuickPatientModal`, que
 * exige el consentimiento de privacidad), el CONSULTORIO del médico del evento
 * y, opcional, el TIPO de cita. No escribe nada por su cuenta: entrega la
 * elección a `alConvertir`, que guarda por `handleSave` de la agenda (el PUT de
 * siempre, con sus puertas: ver `vetoDeConversion` en el servidor).
 *
 * Qué pasa con Google (lo dice el aviso del diálogo): el evento conserva su
 * vínculo (`google_event_id`, `etag`), pasa a «Cita médica: <paciente>» con la
 * descripción fija y deja de sincronizar su descripción (S1); el título ya no
 * se acepta desde Google (C-d). Las notas que trajo se quedan en Spinus.
 */
import { useEffect, useId, useState, type ReactElement } from 'react'
import { X } from 'lucide-react'
import Portal from '@/components/ui/Portal'
import QuickPatientModal from '@/components/ui/QuickPatientModal'
import { CampoPaciente } from '@/components/agenda/BurbujaAlta'
import type { PacienteBusqueda } from '@/components/agenda/AppointmentModal'
import { useDialogoModal } from '@/hooks/useDialogoModal'
import { useConsultorios } from '@/hooks/useConsultorios'
import { useConsultoriosDeMedico } from '@/hooks/useConsultoriosDeMedico'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'
import type { Appointment } from '@/lib/agenda/tiposAgenda'
import type { TipoCita } from '@/lib/agenda/tiposCita'
import { horarioDeTarjeta } from '@/lib/agenda/accionesTarjeta'

export interface EleccionConversion { paciente: PacienteBusqueda; consultorioId: string; tipoCitaId: string | null }

interface Props {
  cita: Appointment
  /** Quien mira: si es el médico del evento, sus consultorios salen de su configuración. */
  perfilId: string | null
  zonaVisor: string
  alConvertir: (e: EleccionConversion) => void
  alCerrar: () => void
}

/** Los consultorios del médico del evento: los suyos si es quien mira; si no, los del modo operativo. */
function useConsultoriosDelEvento(medicoId: string, esSuyo: boolean): { id: string; nombre: string; es_default: boolean }[] {
  const propios = useConsultorios()
  const ajenos = useConsultoriosDeMedico(esSuyo ? null : medicoId)
  return esSuyo ? propios.consultorios : ajenos.consultorios
}

/** Los tipos de cita del médico (como el modal). Vacío si fallan: el tipo es opcional. */
function useTiposDelMedico(medicoId: string): TipoCita[] {
  const [tipos, setTipos] = useState<TipoCita[]>([])
  useEffect(() => {
    const control = new AbortController()
    fetch(`/api/agenda/tipos-cita?medico_id=${encodeURIComponent(medicoId)}`, { signal: control.signal })
      .then(r => (r.ok ? r.json() : { tipos: [] }))
      .then((j: { tipos?: TipoCita[] }) => setTipos((j.tipos ?? []).filter(t => t.activo)))
      .catch(() => undefined)
    return () => control.abort()
  }, [medicoId])
  return tipos
}

interface PropsCampos {
  consultorios: { id: string; nombre: string }[]
  consultorioId: string
  alConsultorio: (id: string) => void
  tipos: TipoCita[]
  tipoId: string
  alTipo: (id: string) => void
}

function CamposCita({ consultorios, consultorioId, alConsultorio, tipos, tipoId, alTipo }: PropsCampos): ReactElement {
  return (
    <>
      <label className="ag-capa-campo">
        Consultorio
        <select value={consultorioId} onChange={e => alConsultorio(e.target.value)} disabled={consultorios.length === 0}>
          <option value="">{consultorios.length === 0 ? 'Sin consultorios disponibles' : 'Elige el consultorio…'}</option>
          {consultorios.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </label>
      {tipos.length > 0 && (
        <label className="ag-capa-campo">
          Tipo de cita
          <select value={tipoId} onChange={e => alTipo(e.target.value)}>
            <option value="">Sin tipo</option>
            {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </label>
      )}
    </>
  )
}

/** El consultorio de partida: el activo si es del médico, si no el predeterminado, si no el único. */
function consultorioInicial(lista: { id: string; es_default: boolean }[], activoId: string | null): string {
  if (activoId && lista.some(c => c.id === activoId)) return activoId
  return lista.find(c => c.es_default)?.id ?? (lista.length === 1 ? lista[0].id : '')
}

export default function ConvertirEnCita({ cita, perfilId, zonaVisor, alConvertir, alCerrar }: Props): ReactElement {
  const medicoId = cita.medico_id ?? ''
  const consultorios = useConsultoriosDelEvento(medicoId, perfilId === medicoId)
  const tipos = useTiposDelMedico(medicoId)
  const { consultorioActivo } = useConsultorioActivo()
  const [paciente, setPaciente] = useState<PacienteBusqueda | null>(null)
  const [elegido, setElegido] = useState<string | null>(null)
  const [tipoId, setTipoId] = useState('')
  const [nuevo, setNuevo] = useState(false)
  const { montarPanel, alPulsarTecla } = useDialogoModal(alCerrar)
  const idTitulo = useId()
  const consultorioId = elegido ?? consultorioInicial(consultorios, consultorioActivo?.id ?? null)
  const horario = horarioDeTarjeta(cita, zonaVisor)
  const listo = paciente !== null && consultorioId !== ''
  const convertir = (): void => { if (paciente && consultorioId) alConvertir({ paciente, consultorioId, tipoCitaId: tipoId || null }) }

  return (
    <Portal>
      <div className="ag-capa-velo" aria-hidden="true" />
      <div ref={montarPanel} role="dialog" aria-modal="true" aria-labelledby={idTitulo} tabIndex={-1}
        onKeyDown={alPulsarTecla} className="ag-capa ag-capa--centro" data-estado="abierta">
        <div className="ag-capa-cab">
          <h2 id={idTitulo} className="ag-capa-titulo">Convertir en cita</h2>
          <button type="button" className="ag-capa-cerrar" aria-label="Cerrar" onClick={alCerrar}><X size={16} aria-hidden="true" /></button>
        </div>
        <p className="ag-lectura-hora">«{cita.title}» · {horario.tramo}</p>
        <CampoPaciente paciente={paciente} alElegir={setPaciente} />
        <button type="button" className="ag-capa-boton" onClick={() => setNuevo(true)}>Registrar paciente nuevo</button>
        <CamposCita consultorios={consultorios} consultorioId={consultorioId} alConsultorio={setElegido}
          tipos={tipos} tipoId={tipoId} alTipo={setTipoId} />
        <p className="ag-lectura-nota">
          En Google se verá con el nombre del paciente y su descripción dejará de sincronizarse; las notas del evento se quedan en Spinus.
        </p>
        <div className="ag-capa-acciones">
          <button type="button" className="ag-capa-boton ag-capa-boton--principal" disabled={!listo} onClick={convertir}>Convertir en cita</button>
          <button type="button" className="ag-capa-boton" onClick={alCerrar}>Cancelar</button>
        </div>
      </div>
      {nuevo && (
        <QuickPatientModal nombreInicial="" onClose={() => setNuevo(false)}
          onCreated={p => { setNuevo(false); setPaciente(p) }} />
      )}
    </Portal>
  )
}
