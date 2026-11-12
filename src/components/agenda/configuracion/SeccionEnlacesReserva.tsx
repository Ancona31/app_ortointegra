'use client'

/**
 * Los enlaces de reserva en la pantalla de configuración (bloque D; la parte
 * de D1 que quedó pendiente): el enlace FIJO de cada médico (crear,
 * regenerar, revocar) y los de UN SOLO USO (emitir con la vigencia del
 * ajuste, revocar). El código se vuelve a enseñar mientras el enlace esté
 * vigente (lista A, punto 15), pidiéndolo uno a uno al servidor; no se guarda
 * en el navegador más allá del estado de esta pantalla.
 *
 * Quién ve qué (lista A, punto 16): cada médico, sus enlaces; administrador y
 * secretaria, los de todos los médicos. Lo decide el servidor en cada ruta;
 * aquí sólo se pinta lo que devuelve. La monta `ConfiguracionCalendario` sólo
 * con la agenda v2 encendida.
 */
import { useCallback, useEffect, useState } from 'react'
import ConfirmModal from '@/components/agenda/ConfirmModal'
import BloqueEnlacesMedico from '@/components/agenda/configuracion/BloqueEnlacesMedico'
import { leerMotivoError } from '@/components/agenda/configuracion/leerMotivoError'
import type { EnlaceReserva } from '@/lib/reserva/gestionReserva'
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

/** La lista de `GET /api/agenda/enlaces`. La forma de cada fila la fija `COLUMNAS_ENLACE`. */
const leerLista = (j: unknown): { enlaces: EnlaceReserva[]; secreto: boolean } | null => {
  if (!j || typeof j !== 'object' || !('enlaces' in j) || !Array.isArray(j.enlaces)) return null
  return { enlaces: j.enlaces, secreto: !('secreto' in j) || j.secreto !== false }
}

async function cargarLista(): Promise<{ enlaces: EnlaceReserva[]; secreto: boolean } | 'error'> {
  const r = await pedir('/api/agenda/enlaces', {}, '', leerLista)
  return r.ok ? r.valor : 'error'
}

/** La dirección pública que se comparte (la página de D5). */
const urlDe = (codigo: string) => `${window.location.origin}/reservar/${codigo}`

interface Props {
  medicos: readonly MedicoConfig[]
  usuarioId: string
  /** Administrador o secretaria: gestiona los de todos. */
  gestionaTodos: boolean
  /** Vigencia del ajuste de la clínica, sólo para decirla; la congela el servidor. */
  vigenciaDias: number | null
}

export default function SeccionEnlacesReserva({ medicos, usuarioId, gestionaTodos, vigenciaDias }: Props) {
  const toast = useToast()
  const [lista, setLista] = useState<{ enlaces: EnlaceReserva[]; secreto: boolean } | 'error' | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [ocupado, setOcupado] = useState(false)
  const [pregunta, setPregunta] = useState<{ mensaje: string; seguir: () => void } | null>(null)
  const recargar = useCallback(async (): Promise<void> => { setLista(await cargarLista()) }, [])
  /* La primera carga, con `.then` y no con `recargar()`: el `setState` va en
     el callback de la promesa, no en el cuerpo del efecto. */
  useEffect(() => {
    let vivo = true
    void cargarLista().then(l => { if (vivo) setLista(l) })
    return () => { vivo = false }
  }, [])

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
  const visibles: { id: string; nombre: string | null }[] = gestionaTodos
    ? medicos.map(m => ({ id: m.id, nombre: componerNombreMedicoCompleto(m) }))
    : [{ id: usuarioId, nombre: null }]

  return (
    <section aria-labelledby="config-enlaces" className="rounded-2xl border border-[var(--ag-border-card)] bg-[var(--ag-surface)] p-5 space-y-4">
      <div>
        <h2 id="config-enlaces" className="text-base font-semibold text-[var(--ag-text)]">Enlaces de reserva</h2>
        <p className="text-sm text-[var(--ag-muted)]">Quien tenga un enlace puede agendar en un horario libre. No son públicos: sólo los tiene a quien se los mandes.</p>
      </div>
      {lista === null ? <p className="text-sm text-[var(--ag-muted)]">Cargando…</p>
        : lista === 'error' ? <p className="text-sm text-[var(--ag-muted)]">No se pudieron leer los enlaces. Recarga la página.</p>
        : <>
          {!lista.secreto && <p className="text-sm text-[var(--ag-muted)]">La reserva por enlace no está configurada en este servidor: no se pueden emitir enlaces.</p>}
          {visibles.map(m => (
            <BloqueEnlacesMedico key={m.id} nombre={m.nombre} enlaces={lista.enlaces.filter(e => e.medico_id === m.id)}
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
          onConfirm={() => { const p = pregunta; setPregunta(null); p.seguir() }}
          onCancel={() => setPregunta(null)} />
      )}
    </section>
  )
}
