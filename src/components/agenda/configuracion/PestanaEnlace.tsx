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
 *
 * B13 · AG9 (rediseño, maqueta `ag-config`): avisos ámbar arriba; grupos «Tu enlace» y «Enlaces de una vez» con
 * su rótulo, filas de lista y acciones de texto. LA acción de la pantalla es copiar el enlace: «Copiar enlace» es
 * el único botón relleno; «Mandar por WhatsApp», tonal. La dirección, en letra de máquina sin caja.
 */
import { useEffect, useId, useState } from 'react'
import { AlertTriangle, Copy, Link2, Plus, Ticket } from 'lucide-react'
import { LogoWhatsApp } from '@/components/agenda/BotonWhatsAppCita'
import ConfirmModal from '@/components/agenda/ConfirmModal'
import BotonCopiar from '@/components/agenda/configuracion/BotonCopiar'
import CrearEnlaceUnaVez from '@/components/agenda/configuracion/CrearEnlaceUnaVez'
import EnlacesDeOtros, { MSJ_REGENERAR, MSJ_REVOCAR, alertaDeEnlace } from '@/components/agenda/configuracion/EnlacesDeOtros'
import Interruptor from '@/components/agenda/configuracion/Interruptor'
import { emitirEnlace, leerCodigo, pausarEnlace, revocarEnlace, urlReserva, urlWhatsApp, type Resultado } from '@/components/agenda/configuracion/accionesConfig'
import type { EstadoLista, ListaEnlaces } from '@/components/agenda/configuracion/listaEnlaces'
import type { Avisar } from '@/components/agenda/configuracion/estadoAvisos'
import {
  AYUDA, BLOQUE, BOTON_AZUL, BOTON_CHICO, BOTON_TEXTO, BOTON_TEXTO_ROJO, CAJA_AVISO, DIRECCION, FILA, FILA_ACCION, FILA_GRIS, LISTA, PANEL, PIE, ROTULO,
  SUB_PANEL, TARJETA, TITULO_BLOQUE, TITULO_PANEL,
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
const TRIANGULO = <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" className="mt-[1px] flex-none" />

/** El rótulo de un grupo, con su icono, fuera de la superficie. */
function Rotulo({ icono: Icono, titulo }: { icono: typeof Link2; titulo: string }) {
  return <h3 className={ROTULO}><Icono size={16} strokeWidth={2} aria-hidden="true" className="flex-none" />{titulo}</h3>
}
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
function EnlaceFijo({ prendido, ocupado, pausado, alPrender, alApagar }: {
  prendido: EnlaceReserva | null; ocupado: boolean; pausado: boolean; alPrender: () => void; alApagar: () => void
}) {
  const id = useId()
  const url = useDireccion(prendido)
  return (
    <section className={BLOQUE} aria-label="Tu enlace fijo">
      <Rotulo icono={Link2} titulo="Tu enlace" />
      <div className={LISTA}>
        <div className={`${FILA} items-start py-[14px]`}>
          <span id={`${id}-l`} className="text-[15px] font-semibold leading-[20px] text-tinta">
            {prendido ? 'Prendido: tus pacientes pueden apartar con él' : 'Apagado: nadie puede apartar con él'}
          </span>
          <Interruptor encendido={prendido !== null} etiquetadoPor={`${id}-l`} deshabilitado={ocupado} alCambiar={prendido ? alApagar : alPrender} />
        </div>
        {prendido && (
          <div className={`${FILA} flex-col items-stretch gap-[12px] py-[14px]`}>
            <p className={DIRECCION} data-enlace-fijo>{url ?? 'Cargando la dirección…'}</p>
            {url && (
              <div className="flex flex-wrap gap-[8px]">
                <BotonCopiar texto={url} etiqueta="Copiar enlace" className={BOTON_AZUL} icono={<Copy size={18} aria-hidden="true" />} />
                <a href={urlWhatsApp(url)} target="_blank" rel="noopener noreferrer" className={BOTON_CHICO}>
                  <LogoWhatsApp size={18} /> Mandar por WhatsApp
                </a>
              </div>
            )}
          </div>
        )}
      </div>
      {pausado && <p className={PIE} data-enlace-pausado>Al prenderlo vuelve a servir la misma dirección que ya compartiste.</p>}
    </section>
  )
}

function FilaUnaVez({ e, ocupado, alApagar }: { e: EnlaceReserva; ocupado: boolean; alApagar: () => void }) {
  const nombre = e.etiqueta ?? 'Sin nombre'
  const copiar = async () => { const r = await leerCodigo(e.id); return r.ok ? urlReserva(r.valor) : null }
  return (
    <div className={FILA_GRIS} role="group" aria-label={nombre}>
      <div className="flex min-w-0 flex-[1_1_160px] flex-col gap-[2px]">
        <span className="text-[15px] font-semibold leading-[20px] text-tinta [overflow-wrap:anywhere]">{nombre}</span>
        <span className="text-[13px] leading-[18px] text-tinta2">Sin usar{e.caduca_en ? ` · deja de servir el ${FECHA.format(new Date(e.caduca_en))}` : ''}</span>
      </div>
      <div className="flex flex-none">
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
    <section className={BLOQUE} aria-label="Enlaces de una vez">
      <Rotulo icono={Ticket} titulo="Enlaces de una vez" />
      <div className={LISTA}>
        {unicos.map(e => (
          <FilaUnaVez key={e.id} e={e} ocupado={ocupado} alApagar={() => preguntar({ mensaje: MSJ_REVOCAR, seguir: () => void hacerYAvisar(p, () => revocarEnlace(e.id)) })} />
        ))}
        {creando && (
          <div className={`${FILA} block py-[14px]`}>
            <CrearEnlaceUnaVez key={vez} medicoId={p.usuarioId} alCancelar={() => setCreando(false)} alCrear={() => { p.avisar({ ok: true }); void p.recargar() }} />
          </div>
        )}
        <button type="button" className={FILA_ACCION} disabled={!(p.lista && p.lista !== 'error' && p.lista.secreto)}
          onClick={() => { setCreando(true); setVez(v => v + 1) }}>
          <Plus size={18} strokeWidth={2.2} aria-hidden="true" />{creando ? 'Crear otro' : 'Crear uno'}
        </button>
      </div>
      <p className={PIE}>Para un solo paciente. Sirve para una cita y deja de funcionar en {dias} {dias === 1 ? 'día' : 'días'}.</p>
    </section>
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
      {!lista.secreto && <p className={CAJA_AVISO}>{TRIANGULO}<span>La reserva por enlace no está configurada en este servidor: no se pueden crear enlaces.</span></p>}
      {lista.secreto && !lista.aviso && <p className={CAJA_AVISO}>{TRIANGULO}<span>Ningún enlace abre todavía: el aviso de privacidad de la reserva está pendiente de revisión.</span></p>}
      {motivos && <p className={CAJA_AVISO}>{TRIANGULO}<span>{motivos}</span></p>}
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
      <EnlaceFijo prendido={prendido} pausado={fijo !== null && !prendido} ocupado={ocupado || !lista.secreto && !fijo} alPrender={prender}
        alApagar={() => prendido && void hacer(() => pausarEnlace(prendido.id, true))} />
      <UnaVez p={p} unicos={mios.filter(e => e.clase === 'unico')} ocupado={ocupado} preguntar={setPregunta} />
      {fijo && (
        <div className={`${TARJETA} gap-[4px] pb-[4px] ih:pb-[4px] iv:pb-[4px] esc:pb-[4px]`}>
          <span className={TITULO_BLOQUE}>¿Tu enlace llegó a quien no debía?</span>
          <span className={AYUDA}>Cámbialo por uno nuevo. El de antes deja de servir y tendrás que volver a compartirlo.</span>
          <button type="button" className={`${FILA_ACCION} -mx-[16px] mt-[4px] w-auto text-mal-tinta ih:-mx-[20px] iv:-mx-[20px] esc:-mx-[20px]`} disabled={ocupado} onClick={regenerar}>
            Cambiar por uno nuevo
          </button>
        </div>
      )}
      {pregunta && (
        <ConfirmModal message={pregunta.mensaje} {...alertaDeEnlace(pregunta.mensaje)} onCancel={() => setPregunta(null)}
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
      {lista === null && <p className={`m-0 ${AYUDA}`}>Cargando…</p>}
      {lista === 'error' && <p className={`m-0 ${AYUDA}`}>No se pudieron leer los enlaces. Recarga la página.</p>}
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
