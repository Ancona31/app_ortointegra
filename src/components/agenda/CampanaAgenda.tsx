'use client'

/**
 * src/components/agenda/CampanaAgenda.tsx — la campana de la barra de la
 * agenda v2 (tanda I, puntos 16, 18 y 19 de Angel). Sustituye al botón «Por
 * confirmar», en escritorio y en el teléfono (`enBanda`), y abre un panel con
 * dos pestañas:
 *   · «Por confirmar»: lo de E7/H4, las citas de mañana sin confirmar con su
 *     leyenda (`ListaPorConfirmar`);
 *   · «Avisos»: lo que ocurrió sin que nadie de la clínica lo hiciera
 *     (`ListaAvisos` + `useAvisosClinica`, piezas que no saben de la agenda).
 *     Sin la tabla de avisos (base sin la migración de I5) muestra lo de antes:
 *     las canceladas por el paciente (48 h) y los empalmes con Google.
 *
 * Punto rojo: hay citas por confirmar o avisos sin revisar (sin la tabla, lo
 * que encendía el contador de antes: canceladas y empalmes).
 *
 * Cero peticiones de más: los avisos viajan en la respuesta de «Por
 * confirmar» (`usePorConfirmar`), que ya se pedía en ocioso y al abrir.
 *
 * Pestañas según APG «Tabs» (activación automática): flechas izquierda y
 * derecha, Inicio y Fin; el panel es un diálogo (`useDialogoModal`: foco
 * atrapado, Escape, el foco vuelve a la campana).
 */
import { useCallback, useState, type KeyboardEvent, type ReactElement, type RefObject } from 'react'
import dynamic from 'next/dynamic'
import { Bell, X } from 'lucide-react'
import type { CambiarEstadoCita } from '@/lib/agenda/contratosV2'
import type { CambioCita } from '@/lib/agenda/porConfirmarTiempoReal'
import { destacarDeAviso, type AvisoClinica, type CitaDelAviso, type TipoAviso } from '@/lib/avisos/avisosClinica'
import { esPorLigar } from '@/lib/agenda/tarjetasAgenda'
import { useProfile } from '@/hooks/useProfile'
import { useEscudoTrasRegistro } from '@/hooks/useEscudoTrasRegistro'
import { useDialogoModal } from '@/hooks/useDialogoModal'
import { useAvisosClinica, type EstadoAvisos } from '@/hooks/useAvisosClinica'
import { ListaAvisos } from '@/components/avisos/ListaAvisos'
import { CapaBarra } from '@/components/agenda/CapaBarra'
import {
  ListaPorConfirmar, SeccionCanceladas, SeccionEmpalmes, usePorConfirmar, type ListasPorConfirmar,
} from '@/components/agenda/PanelPorConfirmar'

/**
 * Los que lanzan aviso emergente desde aquí. La cancelación (E8) y el empalme
 * (D11) ya tienen el suyo en la agenda y NO se repiten.
 */
const EMERGENTES: readonly TipoAviso[] = ['reserva_enlace', 'reagendado_paciente', 'google_por_asignar']

type Pestana = 'por-confirmar' | 'avisos'

/* Tanda J (punto 7) · La ventana de «Ligar e iniciar consulta», en su propio
   chunk: sólo se descarga al pulsar un aviso de una cita por ligar. */
const VentanaLigarCita = dynamic(() => import('@/components/agenda/VentanaLigarCita'), { ssr: false })

/** Los avisos de una cita que llegó sin paciente: reserva, reagendado por el paciente y Google por asignar. */
const AVISOS_DE_LIGAR: readonly TipoAviso[] = ['reserva_enlace', 'reagendado_paciente', 'google_por_asignar']

/**
 * Tanda J (punto 7) · ¿Pulsar el aviso abre la ventana de ligar en vez de la
 * cita? Sólo para el médico de la cita, si sigue por ligar y viva. Lo demás
 * (otro rol, otro médico, ya ligada, cancelada, un empalme) abre la cita, como
 * hasta ahora. La ventana vuelve a comprobarlo con la fila fresca.
 */
export function avisoSeLiga(a: AvisoClinica, quien: { esMedico: boolean; perfilId: string | null }): boolean {
  const c = a.cita
  return quien.esMedico && quien.perfilId !== null && c.medico_id === quien.perfilId && AVISOS_DE_LIGAR.includes(a.tipo)
    && (c.status === 'scheduled' || c.status === 'confirmed') && esPorLigar(c)
}

interface Props {
  /** Cambia cuando la agenda se entera de algo por su sondeo (E8, D11). */
  recarga: number
  /** H4 · «Marcar como confirmada»: `cambiarEstadoCita` de la agenda. */
  confirmar?: CambiarEstadoCita
  /** H4 · El oyente del canal único de la agenda. */
  cambiosRef?: RefObject<((c: CambioCita) => void) | null>
  /** Pulsar un aviso: la agenda abre su cita. */
  alAbrirCita: (c: CitaDelAviso, destacar?: 'reagendar') => void
  /** En la banda azul del teléfono y la tableta (44 px, la pinta de la banda). */
  enBanda?: boolean
}

/** Cuántos avisos cuenta la pestaña: los sin revisar o, sin la tabla, lo de antes.
    `estado.disponible` y no el de la respuesta: tras un fallo pasajero, el hook
    conserva la última lista buena y la campana no cambia de vista. */
function cuentaAvisos(listas: ListasPorConfirmar | null, estado: EstadoAvisos): number {
  if (!listas) return 0
  if (estado.disponible) return estado.avisos?.length ?? 0
  return listas.canceladas.length + listas.empalmes.length
}

export function CampanaAgenda({ recarga, confirmar, cambiosRef, alAbrirCita, enBanda = false }: Props): ReactElement {
  const { listas, recargar, quitar } = usePorConfirmar(recarga, cambiosRef)
  const { profile, isDoctor } = useProfile()
  const [ligando, setLigando] = useState<CitaDelAviso | null>(null)
  /* El escudo de siempre: el segundo clic de un doble clic sobre el aviso no cae en la ventana. */
  const escudo = useEscudoTrasRegistro(ligando === null, { dentroDeDialogos: true })
  const avisos = useAvisosClinica({ datos: listas?.avisos ?? null, emergentes: EMERGENTES })
  const [boton, setBoton] = useState<HTMLElement | null>(null)
  const cerrar = useCallback(() => setBoton(null), [])
  const n = listas?.citas.length ?? 0
  const m = cuentaAvisos(listas, avisos)
  const etiqueta = listas ? `Por confirmar (${n}) y avisos (${m})` : 'Por confirmar y avisos'
  const alConfirmar = confirmar ? (id: string): void => {
    quitar(id)
    void confirmar(id, 'confirmed').then((ok) => { if (!ok) recargar() })
  } : undefined
  return (
    <>
      <button type="button" data-campana="" data-por-confirmar=""
        className={enBanda ? 'ag-banda-movil-ctrl ag-banda-movil-ctrl--marco ag-campana' : 'ag-herramienta ag-campana'}
        aria-label={etiqueta} title="Por confirmar y avisos" aria-haspopup="dialog" aria-expanded={boton !== null}
        onClick={(e) => {
          const b = e.currentTarget
          setBoton((a) => (a ? null : b))
          if (!boton) recargar()
        }}>
        <Bell size={enBanda ? 18 : 16} aria-hidden="true" />
        {n + m > 0 && <span className="ag-campana-punto" data-punto-rojo="" aria-hidden="true" />}
      </button>
      {boton && (
        <PanelCampana boton={boton} alCerrar={cerrar} listas={listas} n={n} m={m} avisos={avisos}
          alConfirmar={alConfirmar} alAbrirAviso={(a) => {
            cerrar()
            if (avisoSeLiga(a, { esMedico: isDoctor, perfilId: profile?.id ?? null })) { escudo.activar(); setLigando(a.cita) }
            else alAbrirCita(a.cita, destacarDeAviso(a))
          }} />
      )}
      {ligando && (
        <VentanaLigarCita citaId={ligando.id} alCerrar={() => setLigando(null)} alNoEsCita={recargar}
          alVerCita={() => { setLigando(null); alAbrirCita(ligando) }} />
      )}
    </>
  )
}

interface PropsPanel {
  boton: HTMLElement
  alCerrar: () => void
  listas: ListasPorConfirmar | null
  n: number
  m: number
  avisos: EstadoAvisos
  alConfirmar?: (id: string) => void
  alAbrirAviso: (a: AvisoClinica) => void
}

function PanelCampana({ boton, alCerrar, listas, n, m, avisos, alConfirmar, alAbrirAviso }: PropsPanel): ReactElement {
  const { montarPanel, alPulsarTecla } = useDialogoModal(alCerrar)
  const [pestana, setPestana] = useState<Pestana>('por-confirmar')
  return (
    <CapaBarra boton={boton} rol="dialog" etiqueta="Por confirmar y avisos" clase="ag-capa--campana"
      alCerrar={alCerrar} alMontar={montarPanel} alPulsarTecla={alPulsarTecla} datos={{ 'data-panel-campana': '' }}>
      <div className="ag-campana-cab">
        <Pestanas actual={pestana} alCambiar={setPestana} n={n} m={m} />
        <button type="button" className="ag-capa-cerrar" onClick={alCerrar} aria-label="Cerrar"><X size={16} aria-hidden="true" /></button>
      </div>
      <div role="tabpanel" id="campana-por-confirmar" aria-labelledby="campana-tab-por-confirmar" hidden={pestana !== 'por-confirmar'}
        data-pestana-por-confirmar="">
        {listas === null && <p className="text-[12px]" style={{ color: 'var(--ag-muted)' }}>Cargando…</p>}
        {listas?.citas.length === 0 && <p className="text-[13px]" style={{ color: 'var(--ag-muted)' }}>No hay citas de mañana sin confirmar.</p>}
        <ListaPorConfirmar citas={listas?.citas ?? []} alConfirmar={alConfirmar} />
      </div>
      <div role="tabpanel" id="campana-avisos" aria-labelledby="campana-tab-avisos" hidden={pestana !== 'avisos'} data-pestana-avisos="">
        <ContenidoAvisos listas={listas} avisos={avisos} alAbrirAviso={alAbrirAviso} />
      </div>
    </CapaBarra>
  )
}

function ContenidoAvisos({ listas, avisos, alAbrirAviso }: Pick<PropsPanel, 'listas' | 'avisos' | 'alAbrirAviso'>): ReactElement {
  if (listas === null) return <p className="text-[12px]" style={{ color: 'var(--ag-muted)' }}>Cargando…</p>
  if (!avisos.disponible) {
    const vacio = listas.canceladas.length + listas.empalmes.length === 0
    return (
      <>
        {vacio && <p className="text-[13px]" style={{ color: 'var(--ag-muted)' }} data-avisos-vacio>No hay avisos sin revisar.</p>}
        <SeccionCanceladas canceladas={listas.canceladas} />
        <SeccionEmpalmes empalmes={listas.empalmes} />
      </>
    )
  }
  return (
    <ListaAvisos avisos={avisos.avisos ?? []} revisar={avisos.revisar} revisarTodos={avisos.revisarTodos}
      alAbrir={alAbrirAviso} />
  )
}

const ORDEN: readonly Pestana[] = ['por-confirmar', 'avisos']

function Pestanas({ actual, alCambiar, n, m }: { actual: Pestana; alCambiar: (p: Pestana) => void; n: number; m: number }): ReactElement {
  const alTecla = (e: KeyboardEvent<HTMLDivElement>): void => {
    const i = ORDEN.indexOf(actual)
    const destino = e.key === 'ArrowRight' ? ORDEN[(i + 1) % 2] : e.key === 'ArrowLeft' ? ORDEN[(i + 1) % 2]
      : e.key === 'Home' ? ORDEN[0] : e.key === 'End' ? ORDEN[1] : null
    if (!destino) return
    e.preventDefault()
    alCambiar(destino)
    e.currentTarget.querySelector<HTMLElement>(`#campana-tab-${destino}`)?.focus()
  }
  const pestana = (p: Pestana, texto: string): ReactElement => (
    <button type="button" role="tab" id={`campana-tab-${p}`} aria-controls={`campana-${p}`} aria-selected={actual === p}
      tabIndex={actual === p ? 0 : -1} onClick={() => alCambiar(p)} className="ag-campana-pestana" data-pestana={p}>
      {texto}
    </button>
  )
  return (
    <div role="tablist" aria-label="Por confirmar y avisos" className="ag-campana-pestanas" onKeyDown={alTecla}>
      {pestana('por-confirmar', `Por confirmar · ${n}`)}
      {pestana('avisos', `Avisos · ${m}`)}
    </div>
  )
}
