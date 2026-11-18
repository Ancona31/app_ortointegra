'use client'

/**
 * Los enlaces de los médicos que NO son quien mira (tanda J, J5; maqueta
 * `Configuracion.dc.html`, «Enlaces de los demás médicos (N)»). Lo ven quien
 * administra la clínica y la secretaria, que los gestionan como hoy
 * (lista A, punto 16): cada ficha es `BloqueEnlacesMedico`, la de la
 * configuración vieja, con crear, mostrar, regenerar y revocar.
 *
 * La maqueta sólo dibuja «Dra. … · enlace prendido · Copiar»; la gestión
 * completa no tenía sitio y se queda dentro del plegado (inventario de J5,
 * fila 21). Plegado de inicio; la secretaria ve abiertas las fichas de los
 * administradores, como en la tanda H (`fichas`).
 */
import { useId, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import ConfirmModal from '@/components/agenda/ConfirmModal'
import BloqueEnlacesMedico from '@/components/agenda/configuracion/BloqueEnlacesMedico'
import { fichas } from '@/components/agenda/configuracion/SeccionEnlacesReserva'
import { emitirEnlace, leerCodigo, revocarEnlace, urlReserva, type Resultado } from '@/components/agenda/configuracion/accionesConfig'
import type { ListaEnlaces } from '@/components/agenda/configuracion/listaEnlaces'
import type { Avisar } from '@/components/agenda/configuracion/estadoAvisos'
import { BOTON_TEXTO } from '@/components/agenda/configuracion/estilosConfig'
import type { MedicoConfig } from '@/lib/configApp'

export const MSJ_REVOCAR = 'El enlace dejará de funcionar para siempre, también para quien ya lo tenga. Las citas que ya se reservaron con él no cambian. ¿Apagarlo?'
export const MSJ_REGENERAR = 'Se crea un enlace nuevo y el anterior deja de funcionar: quien lo tenga guardado ya no podrá apartar con él. ¿Cambiarlo?'

interface Props {
  lista: ListaEnlaces
  recargar: () => Promise<void>
  medicos: readonly MedicoConfig[]
  usuarioId: string
  administradores: readonly string[]
  vigenciaDias: number | null
  avisar: Avisar
  alCrearTipo: () => void
}

type Ficha = { id: string; nombre: string | null }

/** Crear, mostrar, regenerar y revocar, con su confirmación y su aviso. */
function useGestion(p: Props) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [ocupado, setOcupado] = useState(false)
  const [pregunta, setPregunta] = useState<{ mensaje: string; seguir: () => void } | null>(null)
  async function hacer<T>(accion: () => Promise<Resultado<T>>, alTerminar?: (v: T) => void): Promise<void> {
    setOcupado(true)
    const r = await accion()
    setOcupado(false)
    if (r.ok) alTerminar?.(r.valor)
    p.avisar(r.ok ? { ok: true } : r)
    await p.recargar()
  }
  const conUrl = (v: { id: string | null; codigo: string | null }) => {
    const { id, codigo } = v
    if (id && codigo) setUrls(u => ({ ...u, [id]: urlReserva(codigo) }))
  }
  const emitir = (medicoId: string, clase: 'fijo' | 'unico', etiqueta: string | null = null, correo: string | null = null) =>
    hacer(() => emitirEnlace(medicoId, clase, etiqueta, correo), conUrl)
  async function mostrar(id: string): Promise<void> {
    const r = await leerCodigo(id)
    if (r.ok) setUrls(u => ({ ...u, [id]: urlReserva(r.valor) }))
    else p.avisar(r)
  }
  return { urls, ocupado, pregunta, setPregunta, emitir, mostrar, revocar: (id: string) => hacer(() => revocarEnlace(id)) }
}

export default function EnlacesDeOtros(p: Props) {
  const id = useId()
  const [abierto, setAbierto] = useState(false)
  const g = useGestion(p)
  const reparto = fichas(p.medicos, p.usuarioId, true, p.administradores)
  const ajenas = (f: Ficha) => f.id !== p.usuarioId
  const vistas = reparto.vistas.filter(ajenas)
  const plegadas = reparto.plegadas.filter(ajenas)
  const bloque = (m: Ficha) => (
    <BloqueEnlacesMedico key={m.id} medicoId={m.id} nombre={m.nombre} enlaces={p.lista.enlaces.filter(e => e.medico_id === m.id)}
      motivos={p.lista.preparacion?.[m.id] ?? null} esPropio={false} puedeCrearTipos alCrearTipo={p.alCrearTipo}
      urls={g.urls} ocupado={g.ocupado} puedeEmitir={p.lista.secreto} vigenciaDias={p.vigenciaDias}
      onCrearFijo={() => void g.emitir(m.id, 'fijo')}
      onRegenerar={() => g.setPregunta({ mensaje: MSJ_REGENERAR, seguir: () => void g.emitir(m.id, 'fijo') })}
      onEmitirUnico={(et, correo) => g.emitir(m.id, 'unico', et, correo)}
      onMostrar={x => void g.mostrar(x)}
      onRevocar={e => g.setPregunta({ mensaje: MSJ_REVOCAR, seguir: () => void g.revocar(e.id) })} />
  )
  if (vistas.length + plegadas.length === 0) return null
  return (
    <div className="flex flex-col gap-[12px]">
      {vistas.map(bloque)}
      {plegadas.length > 0 && (
        <>
          <button type="button" aria-expanded={abierto} aria-controls={id} onClick={() => setAbierto(a => !a)} className={`${BOTON_TEXTO} self-start px-0`}>
            <ChevronRight size={16} aria-hidden="true" className={`transition-transform duration-[var(--ag-dur-micro)] motion-reduce:transition-none ${abierto ? 'rotate-90' : ''}`} />
            Enlaces de los demás médicos ({plegadas.length})
          </button>
          <div id={id} hidden={!abierto} className="flex flex-col gap-[12px]">{plegadas.map(bloque)}</div>
        </>
      )}
      {g.pregunta && (
        <ConfirmModal message={g.pregunta.mensaje}
          onConfirm={() => { const q = g.pregunta; g.setPregunta(null); q?.seguir() }}
          onCancel={() => g.setPregunta(null)} />
      )}
    </div>
  )
}
