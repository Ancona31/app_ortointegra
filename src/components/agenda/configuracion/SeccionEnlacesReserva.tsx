'use client'

/**
 * Los enlaces de reserva en la pantalla de configuración (bloque D; la parte
 * de D1 que quedó pendiente): el enlace FIJO de cada médico (crear,
 * regenerar, revocar) y los de UN SOLO USO (emitir con la vigencia del
 * ajuste, revocar). El código se vuelve a enseñar mientras el enlace esté
 * vigente (lista A, punto 15), pidiéndolo uno a uno al servidor; no se guarda
 * en el navegador más allá del estado de esta pantalla.
 *
 * Quién ve qué (lista A, punto 16; revisado en la tanda T2, punto 9): cada
 * médico, dueño o invitado, gestiona SU enlace, que aquí es su ficha; el
 * administrador y la secretaria ven y editan la de cada médico. Lo decide el
 * servidor en cada ruta y la RLS; aquí sólo se pinta lo que devuelve. La monta
 * `ConfiguracionCalendario` sólo con la agenda v2 encendida.
 *
 * Tanda T2, punto 8: la lista la pide `ConfiguracionCalendario` (la comparte
 * con «Para empezar»). Cada enlace que no abrirá lleva su aviso, y cada médico
 * al que le falta algo, la caja que lo pide ahí mismo (`FaltaParaEnlace`).
 */
import { useState } from 'react'
import ConfirmModal from '@/components/agenda/ConfirmModal'
import BloqueEnlacesMedico from '@/components/agenda/configuracion/BloqueEnlacesMedico'
import TarjetaSeccion from '@/components/agenda/configuracion/TarjetaSeccion'
import { leerMotivoError } from '@/components/agenda/configuracion/leerMotivoError'
import { CAJA_AVISO, TEXTO_SUAVE } from '@/components/agenda/configuracion/clasesConfig'
import type { EstadoLista } from '@/components/agenda/configuracion/listaEnlaces'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import { useToast } from '@/components/ui/Toast'
import type { MedicoConfig } from '@/lib/configApp'

const JSON_CAB = { 'Content-Type': 'application/json' }
const MSJ_REVOCAR = 'El enlace dejará de funcionar para siempre, también para quien ya lo tenga. Las citas que ya se reservaron con él no cambian. ¿Revocarlo?'
const MSJ_REGENERAR = 'Se emite un enlace fijo nuevo y el anterior deja de funcionar: quien lo tenga guardado ya no podrá reservar con él. ¿Regenerarlo?'

type Resultado<T> = { ok: true; valor: T } | { ok: false; motivo: string }

async function pedir<T>(url: string, init: RequestInit, porDefecto: string, leer: (j: unknown) => T | null): Promise<Resultado<T>> {
  try {
    const res = await fetch(url, { cache: 'no-store', ...init })
    if (!res.ok) return { ok: false, motivo: await leerMotivoError(res, porDefecto) }
    const valor = leer(await res.json().catch(() => null))
    return valor === null ? { ok: false, motivo: porDefecto } : { ok: true, valor }
  } catch {
    return { ok: false, motivo: porDefecto }
  }
}

const conCodigo = (j: unknown): { codigo: string; id: string | null } | null => {
  if (!j || typeof j !== 'object' || !('codigo' in j) || typeof j.codigo !== 'string') return null
  const id = 'enlace' in j && j.enlace && typeof j.enlace === 'object' && 'id' in j.enlace && typeof j.enlace.id === 'string' ? j.enlace.id : null
  return { codigo: j.codigo, id }
}

/** La dirección pública que se comparte (la página de D5). */
const urlDe = (codigo: string) => `${window.location.origin}/reservar/${codigo}`

interface Props {
  /** La lista que pidió `ConfiguracionCalendario`; `null` mientras llega. */
  lista: EstadoLista
  recargar: () => Promise<void>
  medicos: readonly MedicoConfig[]
  usuarioId: string
  /** Administrador o secretaria: gestiona los de todos. */
  gestionaTodos: boolean
  /** Vigencia del ajuste de la clínica, sólo para decirla; la congela el servidor. */
  vigenciaDias: number | null
  /** Quien administra la clínica: puede crear el tipo por defecto. */
  puedeCrearTipos: boolean
  /** Tras crear el tipo por defecto: releer los tipos (servidor) y la lista. */
  alCrearTipo: () => void
}

/** Las fichas: el propio médico primero («Tu enlace»), después los demás por nombre. */
function fichas(medicos: readonly MedicoConfig[], usuarioId: string, gestionaTodos: boolean): { id: string; nombre: string | null }[] {
  if (!gestionaTodos) return [{ id: usuarioId, nombre: null }]
  const todas = medicos.map(m => ({ id: m.id, nombre: componerNombreMedicoCompleto(m) }))
  return [...todas.filter(m => m.id === usuarioId).map(m => ({ ...m, nombre: `${m.nombre} (tú)` })), ...todas.filter(m => m.id !== usuarioId)]
}

export default function SeccionEnlacesReserva(p: Props) {
  const { lista, recargar, medicos, usuarioId, gestionaTodos, vigenciaDias } = p
  const toast = useToast()
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [ocupado, setOcupado] = useState(false)
  const [pregunta, setPregunta] = useState<{ mensaje: string; seguir: () => void } | null>(null)

  /** Toda escritura: bloquea los botones, avisa, guarda la dirección si llega y relee. */
  async function escribir(url: string, init: RequestInit, hecho: string, conDireccion: boolean): Promise<void> {
    setOcupado(true)
    const r = await pedir(url, { headers: JSON_CAB, ...init }, 'No se pudo guardar el enlace', j => (conDireccion ? conCodigo(j) : { codigo: '', id: null }))
    setOcupado(false)
    if (!r.ok) toast.error(r.motivo)
    else {
      toast.success(hecho)
      const { id, codigo } = r.valor
      if (id && codigo) setUrls(u => ({ ...u, [id]: urlDe(codigo) }))
    }
    await recargar()
  }
  const emitir = (medicoId: string, cuerpo: object, hecho: string) =>
    escribir('/api/agenda/enlaces', { method: 'POST', body: JSON.stringify({ ...cuerpo, medico_id: medicoId }) }, hecho, true)
  async function mostrar(id: string): Promise<void> {
    setOcupado(true)
    const r = await pedir(`/api/agenda/enlaces/${id}`, {}, 'No se pudo mostrar el enlace', conCodigo)
    setOcupado(false)
    if (r.ok) setUrls(u => ({ ...u, [id]: urlDe(r.valor.codigo) }))
    else { toast.error(r.motivo); await recargar() }
  }
  const ayuda = gestionaTodos
    ? 'Cada médico tiene los suyos. Quien tenga un enlace puede agendar en un horario libre; sólo lo tiene a quien se lo mandes.'
    : 'Quien tenga tu enlace puede agendar contigo en un horario libre; sólo lo tiene a quien se lo mandes.'

  return (
    <TarjetaSeccion id="config-enlaces" titulo="Enlaces de reserva" ayuda={ayuda}>
      {lista === null ? <p className={TEXTO_SUAVE}>Cargando…</p>
        : lista === 'error' ? <p className={TEXTO_SUAVE}>No se pudieron leer los enlaces. Recarga la página.</p>
        : <>
          {!lista.secreto && <p className={CAJA_AVISO}>La reserva por enlace no está configurada en este servidor: no se pueden emitir enlaces.</p>}
          {lista.secreto && !lista.aviso && (
            <p className={CAJA_AVISO}>Ningún enlace abre todavía: el aviso de privacidad de la reserva está pendiente de revisión.</p>
          )}
          {fichas(medicos, usuarioId, gestionaTodos).map(m => (
            <BloqueEnlacesMedico key={m.id} nombre={m.nombre} enlaces={lista.enlaces.filter(e => e.medico_id === m.id)}
              motivos={lista.preparacion?.[m.id] ?? null} esPropio={m.id === usuarioId} puedeCrearTipos={p.puedeCrearTipos}
              alCrearTipo={p.alCrearTipo}
              urls={urls} ocupado={ocupado} puedeEmitir={lista.secreto} vigenciaDias={vigenciaDias}
              onCrearFijo={() => void emitir(m.id, { clase: 'fijo' }, 'Enlace fijo creado')}
              onRegenerar={() => setPregunta({ mensaje: MSJ_REGENERAR, seguir: () => void emitir(m.id, { clase: 'fijo' }, 'Enlace fijo regenerado') })}
              onEmitirUnico={et => emitir(m.id, { clase: 'unico', etiqueta: et }, 'Enlace de un solo uso emitido')}
              onMostrar={id => void mostrar(id)}
              onRevocar={e => setPregunta({ mensaje: MSJ_REVOCAR, seguir: () => void escribir(`/api/agenda/enlaces/${e.id}`,
                { method: 'PATCH', body: JSON.stringify({ accion: 'revocar' }) }, 'Enlace revocado', false) })} />
          ))}
        </>}
      {pregunta && (
        <ConfirmModal message={pregunta.mensaje}
          onConfirm={() => { const q = pregunta; setPregunta(null); q.seguir() }}
          onCancel={() => setPregunta(null)} />
      )}
    </TarjetaSeccion>
  )
}
