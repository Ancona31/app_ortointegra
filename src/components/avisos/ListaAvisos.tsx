'use client'

/**
 * src/components/avisos/ListaAvisos.tsx — la lista de «Avisos» de la clínica
 * (tanda I, punto 19 de Angel): lo que pasó sin que nadie de la clínica lo
 * hiciera, conservado hasta que alguien lo revisa.
 *
 * ⚠️ PIEZA PENSADA PARA MOVERSE A TODA LA APP: sólo recibe datos y
 * manejadores (`useAvisosClinica` le da los dos). Con `alAbrir`, pulsar un
 * aviso lo entrega a quien la monta (la agenda abre la cita en su sitio);
 * sin él, cada aviso es un enlace a `/agenda?cita=<id>`. Pulsarlo lo marca
 * revisado en los dos casos.
 *
 * Se pinta con lo que ya hay (tokens `--ag-*`, mismas letras que las filas de
 * «Por confirmar»): nada de estética nueva.
 */
import { useState } from 'react'
import {
  cuandoDeLaCita, enlaceDeAviso, haceCuanto, textoAviso, type AvisoClinica,
} from '@/lib/avisos/avisosClinica'

interface Props {
  avisos: AvisoClinica[]
  revisar: (ids: string[]) => void
  revisarTodos: () => void
  /** Sin él, cada aviso es un enlace a la agenda. */
  alAbrir?: (a: AvisoClinica) => void
}

function Contenido({ a, ahora }: { a: AvisoClinica; ahora: number }) {
  return (
    <>
      <span className="ag-aviso-punto" aria-hidden="true" />
      <span className="min-w-0 flex flex-col">
        <span className="text-[13px] font-semibold" style={{ color: 'var(--ag-text)' }}>{textoAviso(a)}</span>
        <span className="text-[12px]" style={{ color: 'var(--ag-muted)' }}>
          Cita: {cuandoDeLaCita(a.cita)} · {haceCuanto(a.creado_en, ahora)}
        </span>
      </span>
    </>
  )
}

/* ⚠️ PARA QUIEN INTEGRE I3: en un aviso `google_por_asignar`, «¿No es una
   cita?» (`BotonNoEsCita`, contrato en `notas_i3.md`) va AL LADO de la fila,
   no dentro (un botón no puede ir dentro de otro), con
   `alHecho={() => revisar([a.id])}`: decidir que no es una cita también
   revisa el aviso. Esta rama sale de `0349221`, sin I3, y no lo monta. */
function FilaAviso({ a, ahora, revisar, alAbrir }: { a: AvisoClinica; ahora: number } & Pick<Props, 'revisar' | 'alAbrir'>) {
  const comun = {
    className: 'ag-aviso-fila',
    'data-aviso': a.id, 'data-aviso-tipo': a.tipo, 'data-aviso-cita': a.cita.id,
  }
  if (alAbrir) {
    return (
      <button type="button" {...comun} onClick={() => { revisar([a.id]); alAbrir(a) }}>
        <Contenido a={a} ahora={ahora} />
      </button>
    )
  }
  return (
    <a href={enlaceDeAviso(a)} {...comun} onClick={() => revisar([a.id])}>
      <Contenido a={a} ahora={ahora} />
    </a>
  )
}

export function ListaAvisos({ avisos, revisar, revisarTodos, alAbrir }: Props) {
  // «hace N min» se fija al pintar la lista; no hace falta un reloj vivo.
  const [ahora] = useState(() => Date.now())
  if (avisos.length === 0) {
    return <p className="text-[13px]" style={{ color: 'var(--ag-muted)' }} data-avisos-vacio>No hay avisos sin revisar.</p>
  }
  return (
    <div data-lista-avisos>
      <ul className="flex flex-col">
        {avisos.map(a => (
          <li key={a.id}><FilaAviso a={a} ahora={ahora} revisar={revisar} alAbrir={alAbrir} /></li>
        ))}
      </ul>
      <button type="button" data-revisar-todos onClick={revisarTodos}
        className="mt-3 px-2.5 py-1.5 text-[12px] rounded-xl font-bold border transition-colors hover:bg-[var(--ag-btn-ghost-hover)]"
        style={{ color: 'var(--ag-text)', borderColor: 'var(--ag-input-border)' }}>
        Marcar todos como revisados
      </button>
    </div>
  )
}
