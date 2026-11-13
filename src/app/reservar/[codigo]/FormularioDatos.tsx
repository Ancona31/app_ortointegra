'use client'

import { useState, type FormEvent, type ReactElement } from 'react'

export interface Datos { nombre: string; telefono: string; correo: string }

interface Props {
  aviso: string
  casilla: string
  ocupado: boolean
  textoBoton: string
  onEnviar: (d: Datos) => void
}

const CAMPO = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-[#1e5fa8] focus:outline-none'

/** Nombre, teléfono y correo, y el aviso con su casilla (nace desmarcada). */
export default function FormularioDatos({ aviso, casilla, ocupado, textoBoton, onEnviar }: Props): ReactElement {
  const [d, setD] = useState<Datos>({ nombre: '', telefono: '', correo: '' })
  const [acepta, setAcepta] = useState(false)
  const enviar = (e: FormEvent) => { e.preventDefault(); if (acepta) onEnviar(d) }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <label className="block text-sm text-slate-700">Nombre completo
        {/* 80: el tope de NOMBRE_MAX (esquemasReserva.ts, seg1); el servidor lo vuelve a exigir. */}
        <input className={CAMPO} required maxLength={80} autoComplete="name" value={d.nombre}
          onChange={e => setD({ ...d, nombre: e.target.value })} />
      </label>
      <label className="block text-sm text-slate-700">Teléfono (10 dígitos)
        <input className={CAMPO} required inputMode="tel" autoComplete="tel" maxLength={20} value={d.telefono}
          onChange={e => setD({ ...d, telefono: e.target.value })} />
      </label>
      <label className="block text-sm text-slate-700">Correo electrónico
        <input className={CAMPO} required type="email" autoComplete="email" maxLength={254} value={d.correo}
          onChange={e => setD({ ...d, correo: e.target.value })} />
      </label>
      <details className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <summary className="cursor-pointer text-sm text-slate-700">Aviso de privacidad</summary>
        <div className="mt-2 whitespace-pre-line">{aviso}</div>
      </details>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" className="mt-1" checked={acepta} onChange={e => setAcepta(e.target.checked)} />
        <span>{casilla}</span>
      </label>
      <button type="submit" disabled={!acepta || ocupado}
        className="w-full rounded-xl bg-[#1e5fa8] px-4 py-2.5 text-sm font-semibold text-white disabled:bg-slate-300">
        {ocupado ? 'Un momento…' : textoBoton}
      </button>
    </form>
  )
}
