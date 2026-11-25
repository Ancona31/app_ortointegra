'use client'

/**
 * src/components/avisos/ListaAvisos.tsx — la lista de «Avisos» de la clínica
 * (tanda I, punto 19 de Angel): lo que pasó en la agenda y alguien debe saber,
 * conservado hasta que QUIEN LO LEE lo revisa (por usuario, desde M1).
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
import { useState, type CSSProperties } from 'react'
import BotonNoEsCita from '@/components/agenda/BotonNoEsCita'
import { esPorAsignar } from '@/lib/agenda/tarjetasAgenda'
import {
  cuandoDeLaCita, enlaceDeAviso, haceCuanto, TEXTO_MAS_ANTIGUOS, textoAviso, type AvisoClinica,
} from '@/lib/avisos/avisosClinica'

/* El botón de siempre de esta lista («Marcar todos como revisados»), también para «¿No es una cita?». */
const CLASE_BOTON = 'px-2.5 py-1.5 text-[12px] rounded-xl font-bold border transition-colors hover:bg-[var(--ag-btn-ghost-hover)]'
const ESTILO_BOTON: CSSProperties = { color: 'var(--ag-text)', borderColor: 'var(--ag-input-border)' }

interface Props {
  avisos: AvisoClinica[]
  revisar: (ids: string[]) => void
  revisarTodos: () => void
  /** Sin él, cada aviso es un enlace a la agenda. */
  alAbrir?: (a: AvisoClinica) => void
  /** Hay avisos que la lista ya no trae (tope o más de 60 días): se dice, no se ocultan en silencio. */
  masAntiguos?: boolean
}

/** La nota de «hay más atrás». Con la letra de la ayuda de esta lista. */
function NotaMasAntiguos() {
  return <p className="mt-3 text-[12px]" style={{ color: 'var(--ag-muted)' }} data-avisos-mas-antiguos>{TEXTO_MAS_ANTIGUOS}</p>
}

function Contenido({ a, ahora }: { a: AvisoClinica; ahora: number }) {
  return (
    <>
      <span className="ag-aviso-punto" aria-hidden="true" />
      <span className="min-w-0 flex flex-col">
        <span className="text-[13px] font-semibold" style={{ color: 'var(--ag-text)' }}>{textoAviso(a)}</span>
        <span className="text-[12px]" style={{ color: 'var(--ag-muted)' }}>
          {a.cita ? `Cita: ${cuandoDeLaCita(a.cita)} · ` : ''}{haceCuanto(a.creado_en, ahora)}
        </span>
      </span>
    </>
  )
}

function FilaAviso({ a, ahora, revisar, alAbrir }: { a: AvisoClinica; ahora: number } & Pick<Props, 'revisar' | 'alAbrir'>) {
  const comun = {
    className: 'ag-aviso-fila',
    'data-aviso': a.id, 'data-aviso-tipo': a.tipo, 'data-aviso-cita': a.cita?.id ?? '',
  }
  /* Un aviso SIN cita no tiene cita que abrir: siempre es un enlace (a la agenda o a su configuración). */
  if (alAbrir && a.cita) {
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

export function ListaAvisos({ avisos, revisar, revisarTodos, alAbrir, masAntiguos = false }: Props) {
  // «hace N min» se fija al pintar la lista; no hace falta un reloj vivo.
  const [ahora] = useState(() => Date.now())
  if (avisos.length === 0) {
    return (
      <>
        <p className="text-[13px]" style={{ color: 'var(--ag-muted)' }} data-avisos-vacio>No hay avisos sin revisar.</p>
        {masAntiguos && <NotaMasAntiguos />}
      </>
    )
  }
  return (
    <div data-lista-avisos>
      <ul className="flex flex-col">
        {avisos.map(a => (
          <li key={a.id}>
            <FilaAviso a={a} ahora={ahora} revisar={revisar} alAbrir={alAbrir} />
            {/* I3 + I5 (integración): en un aviso de Google que SIGUE por asignar,
                «¿No es una cita?» AL LADO de la fila, no dentro (un botón no va
                dentro de otro). Decidir que no es una cita también revisa el aviso. */}
            {a.tipo === 'google_por_asignar' && a.cita && esPorAsignar(a.cita) && (
              <span className="flex justify-end pb-2" data-aviso-no-es-cita={a.cita.id}>
                <BotonNoEsCita citaId={a.cita.id} alHecho={() => revisar([a.id])} className={CLASE_BOTON} style={ESTILO_BOTON} />
              </span>
            )}
          </li>
        ))}
      </ul>
      <button type="button" data-revisar-todos onClick={revisarTodos} className={`mt-3 ${CLASE_BOTON}`} style={ESTILO_BOTON}>
        Marcar todos como revisados
      </button>
      {masAntiguos && <NotaMasAntiguos />}
    </div>
  )
}
