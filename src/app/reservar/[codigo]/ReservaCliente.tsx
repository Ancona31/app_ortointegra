'use client'

import { useState, type ReactElement } from 'react'
import SelectorTurno from './SelectorTurno'
import FormularioDatos, { type Datos } from './FormularioDatos'
import PasoCodigo from './PasoCodigo'
import Comprobante from './Comprobante'
import { mensajeDeError, pedir, type ConsultorioPagina, type TipoPagina, type TurnoPagina } from './clienteReserva'

/** Lo que la página de servidor le pasa: sólo lo que se pinta (ver page.tsx). */
export interface DatosPagina {
  codigo: string
  clase: 'fijo' | 'unico'
  medico: string
  especialidad: string | null
  consultorios: ConsultorioPagina[]
  tipos: TipoPagina[]
  aviso: string
  casilla: string
  /** E6: la cita cancelada que se reagenda (su código de confirmación y su fecha), o null. */
  origen: { codigo: string; cuando: string } | null
}

type Paso = 'turno' | 'datos' | 'codigo' | 'listo'

const SELECT = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base'

/** El cuerpo de POST /api/reservar/[codigo]. */
function cuerpoReserva(c: string, t: string, turno: TurnoPagina, d: Datos, clientId: string, ficha: string | null, origen: string | null) {
  return { consultorio_id: c, tipo_cita_id: t, inicio: turno.inicio, nombre: d.nombre, telefono: d.telefono, correo: d.correo,
    acepta_aviso: true, client_id: clientId, ...(ficha ? { ficha } : {}), ...(origen ? { origen } : {}) }
}

export default function ReservaCliente({ datos }: { datos: DatosPagina }): ReactElement {
  const base = `/api/reservar/${encodeURIComponent(datos.codigo)}`
  const [consultorioId, setConsultorioId] = useState(datos.consultorios[0]?.id ?? '')
  const [tipoId, setTipoId] = useState(datos.tipos.length === 1 ? datos.tipos[0]?.id ?? '' : '')
  const [turno, setTurno] = useState<TurnoPagina | null>(null)
  const [paso, setPaso] = useState<Paso>('turno')
  const [persona, setPersona] = useState<Datos | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [clientId] = useState(() => crypto.randomUUID())
  const consultorio = datos.consultorios.find(c => c.id === consultorioId) ?? datos.consultorios[0]

  async function reservar(d: Datos, ficha: string | null): Promise<void> {
    if (!turno) return
    const r = await pedir(base, 'POST', cuerpoReserva(consultorioId, tipoId, turno, d, clientId, ficha, datos.origen?.codigo ?? null))
    if (r.status === 201 || r.status === 200) { setPaso('listo'); return }
    setError(mensajeDeError(r))
    if (r.cuerpo.error === 'turno_ocupado' || r.cuerpo.error === 'turno_invalido') { setTurno(null); setPaso('turno') }
  }

  async function conEspera(f: () => Promise<void>): Promise<void> {
    setOcupado(true); setError(null)
    try { await f() } finally { setOcupado(false) }
  }

  const pedirCodigo = (d: Datos) => conEspera(async () => {
    const r = await pedir(`${base}/codigo`, 'POST', { correo: d.correo })
    if (r.status === 200) setPaso('codigo'); else setError(mensajeDeError(r))
  })
  const alEnviarDatos = (d: Datos) => { setPersona(d); return datos.clase === 'fijo' ? pedirCodigo(d) : conEspera(() => reservar(d, null)) }
  const alVerificar = (codigo: string) => conEspera(async () => {
    if (!persona) return
    const r = await pedir(`${base}/verificar`, 'POST', { correo: persona.correo, codigo })
    if (r.status === 200 && typeof r.cuerpo.ficha === 'string') await reservar(persona, r.cuerpo.ficha)
    else setError(mensajeDeError(r))
  })

  return (
    <main className="min-h-screen bg-[#f0f4f8] px-4 py-8">
      <div className="mx-auto w-full max-w-lg space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
        <header>
          <h1 className="text-xl font-semibold text-slate-800">Reservar cita con {datos.medico}</h1>
          {datos.especialidad && <p className="text-sm text-slate-500">{datos.especialidad}</p>}
        </header>
        {datos.origen && (
          // PENDIENTE DE REVISIÓN (texto).
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">Estás reagendando tu cita del {datos.origen.cuando}.</p>
        )}
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {paso === 'listo' && turno && consultorio
          ? <Comprobante medico={datos.medico} consultorio={consultorio} inicio={turno.inicio} />
          : null}
        {paso === 'turno' && (
          <>
            {datos.consultorios.length > 1 && (
              <label className="block text-sm text-slate-700">Consultorio
                <select className={SELECT} value={consultorioId} onChange={e => { setConsultorioId(e.target.value); setTurno(null) }}>
                  {datos.consultorios.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.direccion ? ` · ${c.direccion}` : ''}</option>)}
                </select>
              </label>
            )}
            {datos.consultorios.length === 1 && consultorio && (
              <p className="text-sm text-slate-600">{consultorio.nombre}{consultorio.direccion ? ` · ${consultorio.direccion}` : ''}</p>
            )}
            <label className="block text-sm text-slate-700">Tipo de cita
              <select className={SELECT} value={tipoId} onChange={e => { setTipoId(e.target.value); setTurno(null) }}>
                <option value="" disabled>Elige…</option>
                {datos.tipos.map(t => <option key={t.id} value={t.id}>{t.nombre} ({t.duracionMin} min)</option>)}
              </select>
            </label>
            {tipoId && consultorio && (
              <SelectorTurno key={`${consultorioId}:${tipoId}`} codigo={datos.codigo} consultorioId={consultorioId} tipoId={tipoId}
                zona={consultorio.zona} onElegir={t => { setTurno(t); setError(null); setPaso('datos') }} />
            )}
          </>
        )}
        {paso === 'datos' && (
          <>
            <button type="button" className="text-sm text-[#1e5fa8]" onClick={() => setPaso('turno')}>Cambiar horario</button>
            <FormularioDatos aviso={datos.aviso} casilla={datos.casilla} ocupado={ocupado}
              textoBoton={datos.clase === 'fijo' ? 'Enviar código a mi correo' : 'Reservar cita'} onEnviar={alEnviarDatos} />
          </>
        )}
        {paso === 'codigo' && persona && (
          <PasoCodigo correo={persona.correo} ocupado={ocupado} onVerificar={alVerificar} onReenviar={() => pedirCodigo(persona)} />
        )}
      </div>
    </main>
  )
}
