'use client'

/**
 * src/components/agenda/VentanaLigarCita.tsx — «Ligar e iniciar consulta»
 * (tanda J, puntos 6 y 7 de Angel). UNA ventana pequeña, la misma desde tres
 * sitios: la fila de «Próximas citas» (dashboard del médico), la tarjeta de la
 * cita en la agenda y el aviso de la campana. Siempre con carga diferida
 * (`next/dynamic`): no suma JavaScript al abrir `/agenda` ni el dashboard.
 *
 * Dos pasos, nada del formulario de edición (ni duración, ni tipo, ni
 * observaciones):
 *   1. lo que dio quien reservó, o lo que trajo Google (nombre, teléfono,
 *      correo, día, hora, consultorio) y «Ligar e iniciar consulta». En un
 *      evento de Google «por asignar», también «¿No es una cita?»
 *      (`BotonNoEsCita`) y, si el médico tiene más de un consultorio, cuál
 *      (la cita no trae ninguno y el servidor lo exige, `vetoDeConversion`);
 *   2. el buscador de pacientes de siempre (`PanelLigarCita` + `buscarPacientes`)
 *      ya relleno con ese nombre, y «Registrar paciente nuevo» con los datos
 *      puestos: el alta de siempre (`QuickPatientModal`), que exige el
 *      consentimiento de privacidad antes de crear.
 * Elegido o registrado el paciente, liga por el camino de siempre
 * (`ligarCitaAPaciente`: el PUT con sus puertas y su auditoría `cita_ligada`) y
 * abre la nota con `?cita=`, sin más pasos.
 *
 * La cita se lee al abrir, con la SESIÓN (la RLS de `appointments`: los datos
 * de quien reservó sólo los ve la clínica, como hoy) y fresca (`updated_at`
 * vigente para el PUT). Las condiciones son las del modal (`showLigarYConsultar`):
 * médico de la cita, con su consultorio en su lista, y la cita por ligar.
 */
import { Fragment, useEffect, useId, useState, type ReactElement } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import Portal from '@/components/ui/Portal'
import QuickPatientModal from '@/components/ui/QuickPatientModal'
import PanelLigarCita from '@/components/agenda/PanelLigarCita'
import BotonNoEsCita from '@/components/agenda/BotonNoEsCita'
import { useDialogoModal } from '@/hooks/useDialogoModal'
import { useEscudoTrasRegistro } from '@/hooks/useEscudoTrasRegistro'
import { useConsultorios } from '@/hooks/useConsultorios'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'
import { useProfile } from '@/hooks/useProfile'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { buscarPacientes } from '@/lib/agenda/buscarCitasPaciente'
import { ligarCitaAPaciente, type PacienteParaLigar } from '@/lib/agenda/ligarCita'
import { esPorAsignar, esPorLigar } from '@/lib/agenda/tarjetasAgenda'
import { cuandoDeTarjeta } from '@/lib/agenda/accionesTarjeta'
import type { Consultorio } from '@/types'
import type { PacienteBusqueda } from '@/components/agenda/AppointmentModal'

/** Lo que la ventana lee de la cita (sólo esto: nada clínico). */
export interface CitaParaLigar {
  id: string
  title: string
  start_time: string
  end_time: string
  medico_id: string | null
  consultorio_id: string | null
  consultorio_nombre: string | null
  consultorio_timezone: string | null
  paciente_id: string | null
  status: string | null
  updated_at: string | null
  reserva_canal: string | null
  reserva_nombre: string | null
  reserva_telefono: string | null
  reserva_correo: string | null
  google_asignacion: string | null
}

const COLUMNAS = 'id, title, start_time, end_time, medico_id, consultorio_id, consultorio_nombre, consultorio_timezone, '
  + 'paciente_id, status, updated_at, reserva_canal, reserva_nombre, reserva_telefono, reserva_correo, google_asignacion'

function texto(o: object, k: string): string | null {
  const v: unknown = Reflect.get(o, k)
  return typeof v === 'string' ? v : null
}

/** Valida la fila llegada de PostgREST, sin `as`. `null` si no tiene la forma. */
export function leerCitaParaLigar(x: unknown): CitaParaLigar | null {
  if (typeof x !== 'object' || x === null) return null
  const id = texto(x, 'id'), inicio = texto(x, 'start_time'), fin = texto(x, 'end_time')
  if (!id || !inicio || !fin) return null
  return {
    id, title: texto(x, 'title') ?? '', start_time: inicio, end_time: fin,
    medico_id: texto(x, 'medico_id'), consultorio_id: texto(x, 'consultorio_id'),
    consultorio_nombre: texto(x, 'consultorio_nombre'), consultorio_timezone: texto(x, 'consultorio_timezone'),
    paciente_id: texto(x, 'paciente_id'), status: texto(x, 'status'), updated_at: texto(x, 'updated_at'),
    reserva_canal: texto(x, 'reserva_canal'), reserva_nombre: texto(x, 'reserva_nombre'),
    reserva_telefono: texto(x, 'reserva_telefono'), reserva_correo: texto(x, 'reserva_correo'),
    google_asignacion: texto(x, 'google_asignacion'),
  }
}

/** Por qué no se puede ligar desde aquí, o `null` si se puede (las condiciones del modal). */
export function motivoSinLigar(
  cita: CitaParaLigar, quien: { esMedico: boolean; perfilId: string | null }, consultorios: readonly Pick<Consultorio, 'id'>[],
): string | null {
  if (!esPorLigar(cita)) return 'Esta cita ya no está por ligar.'
  if (cita.status !== 'scheduled' && cita.status !== 'confirmed') return 'Esta cita ya no está vigente.'
  if (!quien.esMedico || !quien.perfilId || cita.medico_id !== quien.perfilId) {
    return 'Sólo el médico de la cita puede ligarla e iniciar la consulta.'
  }
  const conConsultorio = esPorAsignar(cita) ? consultorios.length > 0 : consultorios.some(c => c.id === cita.consultorio_id)
  return conConsultorio ? null : 'El consultorio de esta cita no está entre los tuyos.'
}

type Lectura = { estado: 'cargando' } | { estado: 'error' } | { estado: 'lista'; cita: CitaParaLigar }

/**
 * Lee la cita al abrir y cada vez que cambia `vuelta` (tras un error al ligar:
 * otro la tocó y el `updated_at` ya no vale). Al releer no vuelve a «Cargando…»:
 * la lectura anterior se queda hasta que llega la nueva.
 */
function useCitaParaLigar(citaId: string, vuelta: number): Lectura {
  const [lectura, setLectura] = useState<{ para: string; l: Lectura }>({ para: '', l: { estado: 'cargando' } })
  useEffect(() => {
    let vigente = true
    async function leer(): Promise<void> {
      let cita: CitaParaLigar | null = null
      try {
        const { data, error } = await createClient().from('appointments').select(COLUMNAS).eq('id', citaId).maybeSingle()
        cita = error ? null : leerCitaParaLigar(data)
      } catch (e) {
        logger.warn('VentanaLigarCita', `no se pudo leer la cita: ${e instanceof Error ? e.message : String(e)}`)
        cita = null
      }
      if (vigente) setLectura({ para: citaId, l: cita ? { estado: 'lista', cita } : { estado: 'error' } })
    }
    void leer()
    return () => { vigente = false }
  }, [citaId, vuelta])
  return lectura.para === citaId ? lectura.l : { estado: 'cargando' }
}

/** La búsqueda de siempre (`buscarPacientes`), con la misma espera de 300 ms que el modal. */
function useBusqueda(q: string): { resultados: PacienteBusqueda[]; buscando: boolean } {
  const [r, setR] = useState<{ para: string; lista: PacienteBusqueda[] }>({ para: '', lista: [] })
  const listo = q.trim().length < 2 || r.para === q
  useEffect(() => {
    if (q.trim().length < 2) return
    let vigente = true
    const t = setTimeout(() => {
      buscarPacientes(q).then(lista => { if (vigente) setR({ para: q, lista }) }, () => { if (vigente) setR({ para: q, lista: [] }) })
    }, 300)
    return () => { vigente = false; clearTimeout(t) }
  }, [q])
  return { resultados: listo && q.trim().length >= 2 ? r.lista : [], buscando: !listo }
}

/** El consultorio de partida de una por asignar: el activo si es suyo, si no el predeterminado, si no el primero. */
function consultorioInicial(lista: readonly Consultorio[], activoId: string | null): string {
  if (activoId && lista.some(c => c.id === activoId)) return activoId
  return lista.find(c => c.es_default)?.id ?? lista[0]?.id ?? ''
}

interface PropsDatos {
  cita: CitaParaLigar
  consultorios: readonly Consultorio[]
  consultorioId: string
  alConsultorio: (id: string) => void
  alSeguir: () => void
  alCerrar: () => void
  alNoEsCita: () => void
}

/** Paso 1: lo que dio quien reservó (o trajo Google), sin nada que editar. */
function PasoDatos({ cita, consultorios, consultorioId, alConsultorio, alSeguir, alCerrar, alNoEsCita }: PropsDatos): ReactElement {
  const porAsignar = esPorAsignar(cita)
  const zona = cita.consultorio_timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const propio = consultorios.find(c => c.id === cita.consultorio_id)
  const filas: [string, string][] = [[porAsignar ? 'Evento' : 'Nombre', (porAsignar ? cita.title : cita.reserva_nombre ?? cita.title) || '—']]
  if (cita.reserva_telefono) filas.push(['Teléfono', cita.reserva_telefono])
  if (cita.reserva_correo) filas.push(['Correo', cita.reserva_correo])
  filas.push(['Día y hora', cuandoDeTarjeta(cita, zona).fechaHora])
  if (!porAsignar) filas.push(['Consultorio', propio?.nombre ?? cita.consultorio_nombre ?? '—'])
  return (
    <>
      <dl className="ag-lectura-datos" data-paso-ligar="datos">
        {filas.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}
      </dl>
      {porAsignar && consultorios.length > 1 && (
        <label className="ag-capa-campo">
          Consultorio
          <select value={consultorioId} onChange={e => alConsultorio(e.target.value)}>
            {consultorios.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
      )}
      <div className="ag-capa-acciones">
        <button type="button" className="ag-capa-boton ag-capa-boton--principal" onClick={alSeguir}>Ligar e iniciar consulta</button>
        {porAsignar && <BotonNoEsCita citaId={cita.id} alHecho={alNoEsCita} className="ag-capa-boton" />}
        <button type="button" className="ag-capa-boton" onClick={alCerrar}>Cancelar</button>
      </div>
    </>
  )
}

/**
 * Liga y abre la nota (lo que hacía `ligarYConsultar` del modal, D7): el PUT de
 * siempre y, con 200, el consultorio de la cita como activo y la nota con `?cita=`.
 */
function useLigar(cita: CitaParaLigar | null, consultorio: Consultorio | undefined, alCerrar: () => void, releer: () => void): {
  enviando: boolean; error: string | null; ligar: (p: PacienteParaLigar, recienCreado?: boolean) => void
} {
  const router = useRouter()
  const { cambiarActivo } = useConsultorioActivo()
  const [estado, setEstado] = useState<{ enviando: boolean; error: string | null }>({ enviando: false, error: null })
  async function ligar(p: PacienteParaLigar, recienCreado: boolean): Promise<void> {
    if (!cita || estado.enviando) return
    if (!consultorio) { setEstado({ enviando: false, error: 'Elige el consultorio antes de iniciar la consulta.' }); return }
    setEstado({ enviando: true, error: null })
    const r = await ligarCitaAPaciente({
      citaId: cita.id, updatedAt: cita.updated_at ?? undefined, paciente: p,
      ...(esPorAsignar(cita) ? { consultorioId: consultorio.id } : {}),
    })
    if (!r.ok) {
      /* Se relee la cita: si el error fue porque otro la tocó, el siguiente intento lleva el `updated_at` nuevo. */
      setEstado({ enviando: false, error: recienCreado ? `${r.motivo} El paciente ya quedó registrado: búscalo por su nombre.` : r.motivo })
      releer()
      return
    }
    cambiarActivo(consultorio)
    alCerrar()
    router.push(`/expediente/${p.id}/nueva-nota?cita=${cita.id}`)
  }
  return { ...estado, ligar: (p, recienCreado = false) => void ligar(p, recienCreado) }
}

/** El consultorio con el que se liga (el de la cita; en una por asignar, el elegido) y el ligado. */
function useConsultorioYLigar(cita: CitaParaLigar | null, alCerrar: () => void, releer: () => void): {
  consultorios: Consultorio[]; listos: boolean; consultorioId: string; setElegido: (id: string) => void; ligado: ReturnType<typeof useLigar>
} {
  const { consultorios, isLoading } = useConsultorios()
  const { consultorioActivo } = useConsultorioActivo()
  const [elegido, setElegido] = useState<string | null>(null)
  const consultorioId = cita && !esPorAsignar(cita) ? cita.consultorio_id ?? '' : elegido ?? consultorioInicial(consultorios, consultorioActivo?.id ?? null)
  const ligado = useLigar(cita, consultorios.find(c => c.id === consultorioId), alCerrar, releer)
  return { consultorios, listos: !isLoading, consultorioId, setElegido, ligado }
}

const CARGANDO = 'cargando'

/** Por qué no se liga desde aquí (`motivoSinLigar`); `CARGANDO` mientras falten el perfil o los consultorios. */
function useMotivo(cita: CitaParaLigar | null, consultorios: readonly Consultorio[], listos: boolean): string | null {
  const { profile, isDoctor, loading } = useProfile()
  if (!cita) return null
  if (loading || !listos) return CARGANDO
  return motivoSinLigar(cita, { esMedico: isDoctor, perfilId: profile?.id ?? null }, consultorios)
}

/** Lo que se pinta cuando no hay pasos: cargando, error de lectura o el motivo (con «Ver la cita» si quien abre sabe abrirla). */
function EstadoVentana({ lectura, motivo, alVerCita }: { lectura: Lectura; motivo: string | null; alVerCita?: () => void }): ReactElement | null {
  if (lectura.estado === 'cargando' || motivo === CARGANDO) return <p className="ag-lectura-mensaje">Cargando…</p>
  if (lectura.estado === 'error') return <p role="alert" className="ag-capa-error">No se pudo leer la cita. Vuelve a intentarlo.</p>
  if (!motivo) return null
  return (
    <>
      <p role="alert" className="ag-capa-error">{motivo}</p>
      {alVerCita && <div className="ag-capa-acciones"><button type="button" className="ag-capa-boton" onClick={alVerCita}>Ver la cita</button></div>}
    </>
  )
}

function CabVentana({ idTitulo, alCerrar }: { idTitulo: string; alCerrar: () => void }): ReactElement {
  return (
    <div className="ag-capa-cab">
      <h2 id={idTitulo} className="ag-capa-titulo">Ligar e iniciar consulta</h2>
      <button type="button" className="ag-capa-cerrar" aria-label="Cerrar" onClick={alCerrar}><X size={16} aria-hidden="true" /></button>
    </div>
  )
}

interface Props {
  citaId: string
  alCerrar: () => void
  /** Tras «¿No es una cita?» (una por asignar): quien la monta quita la fila o repinta. */
  alNoEsCita?: () => void
  /** Si no se puede ligar desde aquí, «Ver la cita» (la campana: lo que hacía su aviso antes). */
  alVerCita?: () => void
}

export default function VentanaLigarCita({ citaId, alCerrar, alNoEsCita, alVerCita }: Props): ReactElement {
  const [vuelta, setVuelta] = useState(0)
  const lectura = useCitaParaLigar(citaId, vuelta)
  const cita = lectura.estado === 'lista' ? lectura.cita : null
  const { consultorios, listos, consultorioId, setElegido, ligado } = useConsultorioYLigar(cita, alCerrar, () => setVuelta(v => v + 1))
  const motivo = useMotivo(cita, consultorios, listos)
  const [paso, setPaso] = useState<'datos' | 'buscar'>('datos')
  const [busqueda, setBusqueda] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState(false)
  const nombre = cita ? (cita.reserva_nombre ?? cita.title).trim() : ''
  const q = busqueda ?? nombre
  const { resultados, buscando } = useBusqueda(paso === 'buscar' ? q : '')
  /* El escudo de siempre (H3/I3) en los dos sitios donde lo de debajo cambia
     entre los dos clics de un doble clic: al pasar del paso 1 al buscador (el
     segundo clic caería en un paciente de la lista) y al cerrar el alta. */
  const escudoPaso = useEscudoTrasRegistro(paso === 'datos', { dentroDeDialogos: true })
  const escudoAlta = useEscudoTrasRegistro(nuevo, { dentroDeDialogos: true })
  /* Con el PUT en vuelo no se cierra: si no, al volver navegaría a la nota tras haberla cerrado. */
  const cerrar = (): void => { if (!ligado.enviando) alCerrar() }
  const { montarPanel, alPulsarTecla } = useDialogoModal(cerrar)
  const idTitulo = useId()
  const seguir = (): void => { escudoPaso.activar(); setPaso('buscar') }
  const noEsCita = (): void => { alNoEsCita?.(); alCerrar() }
  return (
    <Portal>
      <div className="ag-capa-velo" aria-hidden="true" />
      <div ref={montarPanel} role="dialog" aria-modal="true" aria-labelledby={idTitulo} tabIndex={-1}
        onKeyDown={alPulsarTecla} className="ag-capa ag-capa--centro" data-estado="abierta" data-ventana-ligar="">
        <CabVentana idTitulo={idTitulo} alCerrar={cerrar} />
        {(!cita || motivo) ? <EstadoVentana lectura={lectura} motivo={motivo} alVerCita={alVerCita} />
          : paso === 'datos' ? (
            <PasoDatos cita={cita} consultorios={consultorios} consultorioId={consultorioId} alConsultorio={setElegido}
              alSeguir={seguir} alCerrar={cerrar} alNoEsCita={noEsCita} />
          ) : (
            <PanelLigarCita nombreReserva={nombre} telefono={cita.reserva_telefono} correo={cita.reserva_correo}
              search={q} onSearch={setBusqueda} resultados={resultados} buscando={buscando}
              enviando={ligado.enviando} error={ligado.error} onElegir={p => ligado.ligar(p)}
              onNuevo={() => setNuevo(true)} onVolver={() => setPaso('datos')} />
          )}
      </div>
      {nuevo && cita && (
        <QuickPatientModal nombreInicial={nombre} emailInicial={cita.reserva_correo ?? ''} telefonoInicial={cita.reserva_telefono ?? ''} conTelefono
          onClose={() => { setNuevo(false); escudoAlta.activar() }}
          onCreated={p => { setNuevo(false); escudoAlta.activar(); ligado.ligar(p, true) }} />
      )}
    </Portal>
  )
}
