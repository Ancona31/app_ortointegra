'use client'

import { useState, type FormEvent, type ReactElement } from 'react'

interface Props {
  correo: string
  ocupado: boolean
  onVerificar: (codigo: string) => void
  onReenviar: () => void
}

/** El código de 6 dígitos que llegó al correo (sólo el enlace fijo). */
export default function PasoCodigo({ correo, ocupado, onVerificar, onReenviar }: Props): ReactElement {
  const [codigo, setCodigo] = useState('')
  const enviar = (e: FormEvent) => { e.preventDefault(); if (/^[0-9]{6}$/.test(codigo)) onVerificar(codigo) }
  return (
    <form onSubmit={enviar} className="space-y-4">
      <p className="text-sm text-slate-600">Te enviamos un código de 6 dígitos a <strong>{correo}</strong>. Vence en 10 minutos.</p>
      <label className="block text-sm text-slate-700">Código
        <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-lg tracking-widest" required
          inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo}
          onChange={e => setCodigo(e.target.value.replace(/\D/g, ''))} />
      </label>
      <button type="submit" disabled={ocupado || codigo.length !== 6}
        className="w-full rounded-xl bg-[#1e5fa8] px-4 py-2.5 text-sm font-semibold text-white disabled:bg-slate-300">
        {ocupado ? 'Un momento…' : 'Verificar y reservar'}
      </button>
      <button type="button" disabled={ocupado} onClick={onReenviar} className="w-full text-sm text-[#1e5fa8]">Enviar otro código</button>
    </form>
  )
}
