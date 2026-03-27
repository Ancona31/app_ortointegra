'use client'

import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { X } from 'lucide-react'

const TIPO_DOC_LABEL: Record<string, string> = {
  receta: 'Receta',
  solicitud_lab: 'Solicitud de Laboratorio',
  solicitud_imagen: 'Solicitud de Imagen',
  plan_suplementacion: 'Plan de Suplementación',
  informe_clinico: 'Informe Clínico',
}
const TIPO_DOC_COLOR: Record<string, string> = {
  receta: 'bg-blue-100 text-blue-700',
  solicitud_lab: 'bg-emerald-100 text-emerald-700',
  solicitud_imagen: 'bg-violet-100 text-violet-700',
  plan_suplementacion: 'bg-amber-100 text-amber-700',
  informe_clinico: 'bg-slate-100 text-slate-600',
}

interface Props {
  doc: any
  onClose: () => void
}

export default function ModalVisorDocumento({ doc, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_DOC_COLOR[doc.tipo] || 'bg-slate-100 text-slate-600'}`}>
              {TIPO_DOC_LABEL[doc.tipo] || doc.tipo}
            </span>
            <span className="text-xs text-slate-400">
              {format(parseISO(doc.created_at), "dd 'de' MMMM 'de' yyyy", { locale: es })}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {/* Contenido */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4 text-sm text-slate-700">
          {/* Datos comunes */}
          {doc.contenido?.paciente && (
            <div className="flex gap-2">
              <span className="font-medium text-slate-500 min-w-[90px]">Paciente:</span>
              <span>{doc.contenido.paciente}</span>
            </div>
          )}
          {doc.contenido?.diagnostico && (
            <div className="flex gap-2">
              <span className="font-medium text-slate-500 min-w-[90px]">Diagnóstico:</span>
              <span>{doc.contenido.diagnostico}</span>
            </div>
          )}
          {doc.contenido?.fecha && (
            <div className="flex gap-2">
              <span className="font-medium text-slate-500 min-w-[90px]">Fecha doc.:</span>
              <span>{doc.contenido.fecha}</span>
            </div>
          )}

          <div className="border-t border-slate-100 pt-3" />

          {/* RECETA */}
          {doc.tipo === 'receta' && doc.contenido?.medicamentos?.length > 0 && (
            <div>
              <p className="font-semibold text-slate-700 mb-2">Medicamentos</p>
              <div className="space-y-3">
                {doc.contenido.medicamentos.filter((m: any) => m.nombre_comercial).map((m: any, i: number) => (
                  <div key={i} className="bg-slate-50 rounded-lg p-3">
                    <p className="font-medium text-[#1a3a5c]">
                      {i + 1}. {m.nombre_comercial.toUpperCase()}
                      {m.presentacion && ` ${m.presentacion}`}
                      {m.principio_activo && <span className="font-normal text-slate-500 text-xs"> ({m.principio_activo})</span>}
                    </p>
                    {m.indicacion && <p className="text-xs text-slate-600 mt-1 ml-3">{m.indicacion}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {doc.tipo === 'receta' && doc.contenido?.recomendaciones && (
            <div>
              <p className="font-semibold text-slate-700 mb-1">Recomendaciones</p>
              <p className="text-sm text-slate-600 whitespace-pre-line">{doc.contenido.recomendaciones}</p>
            </div>
          )}

          {/* SOLICITUD LAB */}
          {(doc.tipo === 'lab' || doc.tipo === 'solicitud_lab') && doc.contenido?.estudios?.length > 0 && (
            <div>
              <p className="font-semibold text-slate-700 mb-2">Estudios solicitados</p>
              <ul className="space-y-1">
                {doc.contenido.estudios.map((e: string, i: number) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-emerald-600 font-bold">✓</span> {e}
                  </li>
                ))}
              </ul>
              {doc.contenido.notas && (
                <div className="mt-3">
                  <p className="font-semibold text-slate-700 mb-1">Indicaciones</p>
                  <p className="text-sm text-slate-600">{doc.contenido.notas}</p>
                </div>
              )}
            </div>
          )}

          {/* SOLICITUD IMAGEN */}
          {(doc.tipo === 'imagen' || doc.tipo === 'solicitud_imagen') && doc.contenido?.estudios?.length > 0 && (
            <div>
              {doc.contenido.urgente && (
                <p className="text-xs font-bold text-red-600 mb-2">⚠ URGENTE</p>
              )}
              <p className="font-semibold text-slate-700 mb-2">Estudios de imagen</p>
              <div className="space-y-2">
                {doc.contenido.estudios.map((e: any, i: number) => (
                  <div key={i} className="bg-slate-50 rounded-lg p-3 border-l-4 border-violet-400">
                    <p className="font-medium text-[#1a3a5c]">
                      {e.tipo} de {e.region}
                      {e.proyecciones && <span className="font-normal text-slate-500"> ({e.proyecciones})</span>}
                    </p>
                    {e.indicacion && <p className="text-xs text-slate-600 mt-1">{e.indicacion}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PLAN SUPLEMENTACIÓN */}
          {doc.tipo === 'plan_suplementacion' && doc.contenido?.suplementos?.length > 0 && (
            <div>
              <p className="font-semibold text-slate-700 mb-2">Suplementos</p>
              <div className="space-y-2">
                {doc.contenido.suplementos.map((s: any, i: number) => (
                  <div key={i} className="bg-amber-50 rounded-lg p-3">
                    <p className="font-medium text-amber-900">{i + 1}. {s.nombre}</p>
                    {s.dosis && <p className="text-xs text-amber-700 mt-0.5">Dosis: {s.dosis}</p>}
                    {s.justificacion && <p className="text-xs text-slate-600 mt-0.5">{s.justificacion}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
