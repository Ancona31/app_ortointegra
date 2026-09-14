'use client'

import { useId } from 'react'
import { Plus, X } from 'lucide-react'
import { ESPECIALIDADES } from '@/lib/especialidades'
import ComboEscribible from '@/components/documentos/ComboEscribible'

/**
 * Dos especialidades como mucho, y NO se capturan igual:
 *
 * · La PRIMERA sigue siendo el desplegable cerrado de `ESPECIALIDADES`. Es la
 *   que el gate exige (`src/lib/perfil/gate.ts`) y la que viaja al encabezado
 *   de los PDF, así que conviene que salga del catálogo.
 * · La SEGUNDA es texto libre con sugerencias (`ComboEscribible`): la
 *   subespecialidad de un médico rara vez está en un catálogo de 40 entradas,
 *   y un desplegable cerrado la obliga a elegir algo que no es lo suyo.
 *
 * ⚠️ `ComboEscribible` VISTE SIEMPRE `sp-input` —lo lleva escrito dentro
 * (`ComboEscribible.tsx:151`) y no es configurable—, así que la segunda fila
 * se ve como el sistema de diseño mande, pase lo que pase por
 * `selectClassName`. Quien quiera las dos filas iguales tiene que pasar
 * `selectClassName="sp-input"`, que es lo que hacen Mi Perfil y el onboarding.
 * Los otros dos consumidores (registro y alta de admin) no lo pasan todavía.
 */

interface Props {
  value: string[]
  onChange: (v: string[]) => void
  /** Clases del select de la primera fila. Por defecto estilo macOS sheet */
  selectClassName?: string
}

export default function EspecialidadSelector({ value, onChange, selectClassName }: Props) {
  const idBase = useId()
  const base = selectClassName ??
    'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/25 focus:border-[#1e5fa8]/50 focus:bg-white transition-all'

  function setEsp(idx: number, val: string) {
    const next = [...value]
    next[idx] = val
    onChange(next)
  }

  function agregar() {
    if (value.length < 2) onChange([...value, ''])
  }

  function quitar(idx: number) {
    onChange(value.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-2">
      {value.map((esp, idx) => (
        <div key={idx} className="flex items-center gap-2">
          {idx === 0 ? (
            <select
              value={esp}
              onChange={e => setEsp(idx, e.target.value)}
              required
              className={base}
            >
              <option value="">Selecciona especialidad</option>
              {ESPECIALIDADES.map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          ) : (
            /* min-w-0: sin él el input del combo no encoge dentro del flex y
               empuja fuera al botón de quitar. */
            <div className="flex-1 min-w-0">
              <ComboEscribible
                id={`${idBase}-esp-${idx}`}
                value={esp}
                onChange={val => setEsp(idx, val)}
                sugerencias={ESPECIALIDADES}
                placeholder="Escribe tu segunda especialidad"
                pie="Escribe la tuya si no está en la lista"
              />
            </div>
          )}
          {idx > 0 && (
            <button
              type="button"
              onClick={() => quitar(idx)}
              className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ))}

      {value.length < 2 && (
        <button
          type="button"
          onClick={agregar}
          className="flex items-center gap-1.5 text-xs font-medium text-[#1e5fa8] hover:text-[#1a3a5c] transition-colors py-0.5"
        >
          <Plus size={13} strokeWidth={2.5} />
          Agregar especialidad
        </button>
      )}
    </div>
  )
}
