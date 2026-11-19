'use client'

/**
 * Pestaña «Tu enlace» de la configuración (tanda J, J5, punto 14; maqueta
 * `Configuracion.dc.html`). Con las rutas de siempre (`/api/agenda/enlaces`):
 *   · el interruptor PRENDE o APAGA el enlace fijo. K3 (punto 14 de Angel):
 *     apagarlo lo PAUSA, no lo revoca (`pausarEnlace`), así que no pide
 *     confirmación y al prenderlo vuelve la MISMA dirección; sólo «Cambiar por
 *     uno nuevo» deja el de antes sin servir. Sin fijo, prender lo emite;
 *   · la dirección es la real, `/reservar/{código}` (punto 17), con «Copiar
 *     enlace» y «Mandar por WhatsApp»;
 *   · «Enlaces de una vez»: crear (con su etiqueta), copiar y apagar;
 *   · «Cambiar por uno nuevo» = regenerar el fijo, con confirmación;
 *   · los de los demás médicos, plegados (`EnlacesDeOtros`).
 * Lo que la maqueta no dibuja y se conserva: los avisos de que la reserva no
 * está configurada, de que el aviso de privacidad está pendiente y de que el
 * enlace no abrirá (`avisoDeEnlace`).
 *
 * La secretaria no tiene enlace propio: ve sólo los de los médicos.
 */
import { useEffect, useId, useState } from 'react'
import { Copy, MessageCircle } from 'lucide-react'
import ConfirmModal from '@/components/agenda/ConfirmModal'
import BotonCopiar from '@/components/agenda/configuracion/BotonCopiar'
import CrearEnlaceUnaVez from '@/components/agenda/configuracion/CrearEnlaceUnaVez'
import EnlacesDeOtros, { MSJ_REGENERAR, MSJ_REVOCAR } from '@/components/agenda/configuracion/EnlacesDeOtros'
import Interruptor from '@/components/agenda/configuracion/Interruptor'
import { emitirEnlace, leerCodigo, pausarEnlace, revocarEnlace, urlReserva, urlWhatsApp, type Resultado } from '@/components/agenda/configuracion/accionesConfig'
import type { EstadoLista, ListaEnlaces } from '@/components/agenda/configuracion/listaEnlaces'
import type { Avisar } from '@/components/agenda/configuracion/estadoAvisos'
import {
  AYUDA, BLOQUE, BOTON_AZUL, BOTON_BLANCO, BOTON_CHICO, BOTON_TEXTO, BOTON_TEXTO_ROJO, DIRECCION, FILA_GRIS, PANEL, SUB_PANEL, TITULO_BLOQUE, TITULO_PANEL,
} from '@/components/agenda/configuracion/estilosConfig'
import { avisoDeEnlace } from '@/lib/reserva/aperturaEnlace'
import type { EnlaceReserva } from '@/lib/reserva/gestionReserva'
import type { MedicoConfig } from '@/lib/configApp'

interface Props {
  lista: EstadoLista
  recargar: () => Promise<void>
  medicos: readonly MedicoConfig[]
  usuarioId: string
  esMedico: boolean
  gestionaTodos: boolean
  administradores: readonly string[]
  /** Quien administra la clínica: contesta la duración de otro médico desde «Completar» (L3, punto 17). */
  puedeAdministrar: boolean
  vigenciaDias: number | null
  avisar: Avisar
  alCrearTipo: () => void
}

type Pregunta = { mensaje: string; seguir: () => void } | null
const CAJA = 'm-0 rounded-[10px] border border-[var(--ag-aviso-border)] bg-[var(--ag-aviso-bg)] px-[14px] py-[10px] text-[14px] text-[var(--ag-aviso-text)]'
const FECHA = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' })

/** La dirección del enlace fijo prendido: se pide su código cada vez que cambia de id. */
function useDireccion(fijo: EnlaceReserva | null): string | null {
  const [url, setUrl] = useState<{ id: string; url: string } | null>(null)
  useEffect(() => {
    if (!fijo) return
    let vivo = true
    void leerCodigo(fijo.id).then(r => { if (vivo && r.ok) setUrl({ id: fijo.id, url: urlReserva(r.valor) }) })
    return () => { vivo = false }
  }, [fijo])
  return fijo && url?.id === fijo.id ? url.url : null
}

/** `prendido`: el fijo vigente sin pausar (K3, punto 14); el pausado sigue siendo `fijo`, con su dirección guardada. */
function EnlaceFijo({ prendido, ocupado, alPrender, alApagar }: { prendido: EnlaceReserva | null; ocupado: boolean; alPrender: () => void; alApagar: () => void }) {
  const id = useId()
  const url = useDireccion(prendido)
  return (
    <>
      <div className="flex items-center justify-between gap-[16px] rounded-[12px] bg-[var(--ag-surface-sunken)] px-[18px] py-[14px]">
        <span id={`${id}-l`} className="text-[15px] font-semibold text-[var(--ag-ink)]">
          {prendido ? 'Prendido: tus pacientes pueden apartar con él' : 'Apagado: nadie puede apartar con él'}
        </span>
        <Interruptor encendido={prendido !== null} etiquetadoPor={`${id}-l`} deshabilitado={ocupado} alCambiar={prendido ? alApagar : alPrender} />
      </div>
      {prendido && (
        <div className="flex flex-col gap-[12px]">
          <div className={DIRECCION} data-enlace-fijo>{url ?? 'Cargando la dirección…'}</div>
          {url && (
            <div className="flex flex-wrap gap-[10px]">
              <BotonCopiar texto={url} etiqueta="Copiar enlace" className={BOTON_AZUL} icono={<Copy size={18} aria-hidden="true" />} />
              <a href={urlWhatsApp(url)} target="_blank" rel="noopener noreferrer" className={BOTON_BLANCO}>
                <MessageCircle size={18} aria-hidden="true" /> Mandar por WhatsApp
              </a>
            </div>
          )}
        </div>
      )}
    </>
  )
}

function FilaUnaVez({ e, ocupado, alApagar }: { e: EnlaceReserva; ocupado: boolean; alApagar: () => void }) {
  const nombre = e.etiqueta ?? 'Sin nombre'
  const copiar = async () => { const r = await leerCodigo(e.id); return r.ok ? urlReserva(r.valor) : null }
  return (
    <div className={FILA_GRIS} role="group" aria-label={nombre}>
      <div className="flex flex-col gap-[2px]">
        <span className="text-[15px] font-semibold text-[var(--ag-ink)]">{nombre}</span>
        <span className="text-[13.5px] text-[var(--ag-ink-600)]">Sin usar{e.caduca_en ? ` · deja de servir el ${FECHA.format(new Date(e.caduca_en))}` : ''}</span>
      </div>
      <div className="flex gap-[4px]">
        <BotonCopiar texto={copiar} className={BOTON_TEXTO} ariaLabel={`Copiar el enlace de ${nombre}`} />
        <button type="button" className={BOTON_TEXTO_ROJO} disabled={ocupado} onClick={alApagar} aria-label={`Apagar el enlace de ${nombre}`}>Apagar</button>
      </div>
    </div>
  )
}

function UnaVez({ p, unicos, ocupado, preguntar }: { p: Props; unicos: EnlaceReserva[]; ocupado: boolean; preguntar: (q: Pregunta) => void }) {
  const [creando, setCreando] = useState(false)
  /* Otro «Crear uno» tras crear uno: un formulario nuevo (la clave lo vuelve a montar vacío). */
  const [vez, setVez] = useState(0)
  const dias = p.vigenciaDias ?? 7
  return (
    <div className={BLOQUE}>
      <div className="flex flex-wrap items-start justify-between gap-[12px]">
        <div className="flex flex-col gap-[4px]">
          <span className={TITULO_BLOQUE}>Enlaces de una vez</span>
          <span className={AYUDA}>Para un solo paciente. Sirve para una cita y deja de funcionar en {dias} {dias === 1 ? 'día' : 'días'}.</span>
        </div>
        <button type="button" className={BOTON_CHICO} disabled={!(p.lista && p.lista !== 'error' && p.lista.secreto)}
          onClick={() => { setCreando(true); setVez(v => v + 1) }}>{creando ? 'Crear otro' : 'Crear uno'}</button>
      </div>
      {creando && <CrearEnlaceUnaVez key={vez} medicoId={p.usuarioId} alCancelar={() => setCreando(false)} alCrear={() => { p.avisar({ ok: true }); void p.recargar() }} />}
      {unicos.map(e => (
        <FilaUnaVez key={e.id} e={e} ocupado={ocupado} alApagar={() => preguntar({ mensaje: MSJ_REVOCAR, seguir: () => void hacerYAvisar(p, () => revocarEnlace(e.id)) })} />
      ))}
    </div>
  )
}

async function hacerYAvisar<T>(p: Props, accion: () => Promise<Resultado<T>>): Promise<void> {
  const r = await accion()
  p.avisar(r.ok ? { ok: true } : r)
  await p.recargar()
}

function Avisos({ lista, motivos }: { lista: ListaEnlaces; motivos: string | null }) {
  return (
    <>
      {!lista.secreto && <p className={CAJA}>La reserva por enlace no está configurada en este servidor: no se pueden crear enlaces.</p>}
      {lista.secreto && !lista.aviso && <p className={CAJA}>Ningún enlace abre todavía: el aviso de privacidad de la reserva está pendiente de revisión.</p>}
      {motivos && <p className={CAJA}>{motivos}</p>}
    </>
  )
}

function Propio({ p, lista }: { p: Props; lista: ListaEnlaces }) {
  const [ocupado, setOcupado] = useState(false)
  const [pregunta, setPregunta] = useState<Pregunta>(null)
  const mios = lista.enlaces.filter(e => e.medico_id === p.usuarioId)
  const fijo = mios.find(e => e.clase === 'fijo') ?? null
  const prendido = fijo && !fijo.pausado_en ? fijo : null
  const hacer = async <T,>(accion: () => Promise<Resultado<T>>) => { setOcupado(true); await hacerYAvisar(p, accion); setOcupado(false) }
  /* Pausado: prender lo reanuda (la misma dirección). Sin fijo: lo emite. */
  const prender = () => void hacer(() => fijo ? pausarEnlace(fijo.id, false) : emitirEnlace(p.usuarioId, 'fijo'))
  const regenerar = () => setPregunta({ mensaje: MSJ_REGENERAR, seguir: () => void hacer(() => emitirEnlace(p.usuarioId, 'fijo')) })
  return (
    <>
      <Avisos lista={lista} motivos={avisoDeEnlace(lista.preparacion?.[p.usuarioId] ?? [])} />
      <EnlaceFijo prendido={prendido} ocupado={ocupado || !lista.secreto && !fijo} alPrender={prender}
        alApagar={() => prendido && void hacer(() => pausarEnlace(prendido.id, true))} />
      {fijo && !prendido && <p className={AYUDA} data-enlace-pausado>Al prenderlo vuelve a servir la misma dirección que ya compartiste.</p>}
      <UnaVez p={p} unicos={mios.filter(e => e.clase === 'unico')} ocupado={ocupado} preguntar={setPregunta} />
      {fijo && (
        <div className={`${BLOQUE} sm:flex-row sm:items-center sm:justify-between`}>
          <div className="flex flex-col gap-[4px]">
            <span className={TITULO_BLOQUE}>¿Tu enlace llegó a quien no debía?</span>
            <span className={AYUDA}>Cámbialo por uno nuevo. El de antes deja de servir y tendrás que volver a compartirlo.</span>
          </div>
          <button type="button" className={`${BOTON_CHICO} self-start sm:self-center`} disabled={ocupado} onClick={regenerar}>Cambiar por uno nuevo</button>
        </div>
      )}
      {pregunta && (
        <ConfirmModal message={pregunta.mensaje} onCancel={() => setPregunta(null)}
          onConfirm={() => { const q = pregunta; setPregunta(null); q.seguir() }} />
      )}
    </>
  )
}

export default function PestanaEnlace(p: Props) {
  const { lista } = p
  return (
    <div className={PANEL}>
      <div className="flex flex-col gap-[6px]">
        <h2 className={TITULO_PANEL}>{p.esMedico ? 'Tu enlace' : 'Enlaces de los médicos'}</h2>
        <p className={SUB_PANEL}>
          {p.esMedico ? 'Quien lo abra puede apartar cita en tus horas libres. Es el mismo para todos.' : 'Cada médico tiene el suyo. Quien lo abra puede apartar cita en sus horas libres.'}
        </p>
      </div>
      {lista === null && <p className={AYUDA}>Cargando…</p>}
      {lista === 'error' && <p className={AYUDA}>No se pudieron leer los enlaces. Recarga la página.</p>}
      {lista && lista !== 'error' && (
        <>
          {p.esMedico ? <Propio p={p} lista={lista} /> : <Avisos lista={lista} motivos={null} />}
          {p.gestionaTodos && (
            <EnlacesDeOtros lista={lista} recargar={p.recargar} medicos={p.medicos} usuarioId={p.usuarioId} administradores={p.administradores}
              puedeAdministrar={p.puedeAdministrar} vigenciaDias={p.vigenciaDias} avisar={p.avisar} alCrearTipo={p.alCrearTipo} />
          )}
        </>
      )}
    </div>
  )
}
