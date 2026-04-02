'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { X, Mail, Loader2, CheckCircle } from 'lucide-react'

const TIPO_DOC_LABEL: Record<string, string> = {
  receta: 'Receta',
  solicitud_lab: 'Solicitud de Laboratorio',
  solicitud_imagen: 'Solicitud de Imagen',
  plan_suplementacion: 'Plan de Suplementación',
  informe_clinico: 'Informe Clínico',
  escrito_medico: 'Escrito Médico',
  solicitud_internamiento: 'Solicitud de Internamiento',
  consentimiento_informado: 'Consentimiento Informado',
  nota_honorarios: 'Nota de Honorarios',
}
const TIPO_DOC_COLOR: Record<string, string> = {
  receta: 'bg-blue-100 text-blue-700',
  solicitud_lab: 'bg-emerald-100 text-emerald-700',
  solicitud_imagen: 'bg-violet-100 text-violet-700',
  plan_suplementacion: 'bg-amber-100 text-amber-700',
  informe_clinico: 'bg-slate-100 text-slate-600',
  escrito_medico: 'bg-teal-100 text-teal-700',
  solicitud_internamiento: 'bg-rose-100 text-rose-700',
  consentimiento_informado: 'bg-indigo-100 text-indigo-700',
  nota_honorarios: 'bg-orange-100 text-orange-700',
}

interface Props {
  doc: any
  onClose: () => void
  pacienteEmail?: string | null
}

export default function ModalVisorDocumento({ doc, onClose, pacienteEmail }: Props) {
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [errorEmail, setErrorEmail] = useState('')

  async function enviarAlPaciente() {
    if (!pacienteEmail || enviando) return
    setEnviando(true)
    setErrorEmail('')
    const res = await fetch('/api/email/enviar-documento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentoId: doc.id, pacienteEmail }),
    })
    const data = await res.json()
    setEnviando(false)
    if (!res.ok) { setErrorEmail(data.error || 'Error al enviar'); return }
    setEnviado(true)
  }

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

          {/* ESCRITO MÉDICO */}
          {doc.tipo === 'escrito_medico' && (
            <div className="space-y-3">
              {doc.contenido?.asunto && (
                <div className="flex gap-2">
                  <span className="font-medium text-slate-500 min-w-[90px]">Asunto:</span>
                  <span className="font-medium text-[#1a3a5c]">{doc.contenido.asunto}</span>
                </div>
              )}
              {doc.contenido?.cuerpo && (
                <div
                  className="text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3"
                  style={{ fontFamily: 'Georgia, serif' }}
                  dangerouslySetInnerHTML={{ __html: doc.contenido.cuerpo }}
                />
              )}
            </div>
          )}

          {/* NOTA DE HONORARIOS */}
          {doc.tipo === 'nota_honorarios' && (
            <div className="space-y-3">
              {doc.contenido?.folio && (
                <div className="flex gap-2">
                  <span className="font-medium text-slate-500 min-w-[90px]">Folio:</span>
                  <span className="font-mono text-sm">{doc.contenido.folio}</span>
                </div>
              )}
              {doc.contenido?.lineas?.length > 0 && (
                <div>
                  <p className="font-semibold text-slate-700 mb-2">Conceptos</p>
                  <div className="space-y-1">
                    {doc.contenido.lineas.map((l: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm bg-slate-50 rounded px-3 py-1.5">
                        <span>{l.concepto}</span>
                        <span className="font-mono text-slate-600">
                          {Number(l.precio).toLocaleString(
                            doc.contenido.divisa === 'USD' ? 'en-US' : 'es-MX',
                            { style: 'currency', currency: doc.contenido.divisa || 'MXN' }
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {doc.contenido?.monto != null && (
                <div className="flex justify-between items-center bg-[#1a3a5c] text-white rounded-lg px-4 py-2.5">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-lg">
                    {Number(doc.contenido.monto).toLocaleString(
                      doc.contenido.divisa === 'USD' ? 'en-US' : 'es-MX',
                      { style: 'currency', currency: doc.contenido.divisa || 'MXN' }
                    )}
                    {doc.contenido.divisa && <span className="text-xs ml-1 opacity-75">{doc.contenido.divisa}</span>}
                  </span>
                </div>
              )}
              {doc.contenido?.forma_pago && (
                <div className="flex gap-2">
                  <span className="font-medium text-slate-500 min-w-[90px]">Forma pago:</span>
                  <span>{doc.contenido.forma_pago}</span>
                </div>
              )}
              {doc.contenido?.rfc_medico && (
                <div className="flex gap-2">
                  <span className="font-medium text-slate-500 min-w-[90px]">RFC médico:</span>
                  <span className="font-mono">{doc.contenido.rfc_medico}</span>
                </div>
              )}
              {doc.contenido?.rfc_paciente && (
                <div className="flex gap-2">
                  <span className="font-medium text-slate-500 min-w-[90px]">RFC paciente:</span>
                  <span className="font-mono">{doc.contenido.rfc_paciente}</span>
                </div>
              )}
            </div>
          )}

          {/* CONSENTIMIENTO INFORMADO */}
          {doc.tipo === 'consentimiento_informado' && (
            <div className="space-y-3">
              {doc.contenido?.procedimiento && (
                <div className="flex gap-2">
                  <span className="font-medium text-slate-500 min-w-[90px]">Procedimiento:</span>
                  <span>{doc.contenido.procedimiento}</span>
                </div>
              )}
              {doc.contenido?.familiar && (
                <div className="flex gap-2">
                  <span className="font-medium text-slate-500 min-w-[90px]">Familiar:</span>
                  <span>{doc.contenido.familiar}</span>
                </div>
              )}
              {doc.contenido?.anestesiologo && (
                <div className="flex gap-2">
                  <span className="font-medium text-slate-500 min-w-[90px]">Anestesiólogo:</span>
                  <span>{doc.contenido.anestesiologo}</span>
                </div>
              )}
            </div>
          )}

          {/* PLAN SUPLEMENTACIÓN */}
          {doc.tipo === 'plan_suplementacion' && doc.contenido?.seleccionados?.length > 0 && (
            <div>
              <p className="font-semibold text-slate-700 mb-2">Suplementos</p>
              <div className="space-y-2">
                {doc.contenido.seleccionados.map((s: any, i: number) => (
                  <div key={i} className="bg-amber-50 rounded-lg p-3">
                    <p className="font-medium text-amber-900">{i + 1}. {s.nombre}</p>
                    {s.dosis && <p className="text-xs text-amber-700 mt-0.5">Dosis: {s.dosis}</p>}
                    {s.justificacion && <p className="text-xs text-slate-600 mt-0.5">{s.justificacion}</p>}
                  </div>
                ))}
              </div>
              {doc.contenido?.notas && (
                <div className="mt-3">
                  <p className="font-semibold text-slate-700 mb-1">Notas</p>
                  <p className="text-sm text-slate-600">{doc.contenido.notas}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer con botón de email */}
        {pacienteEmail && (
          <div className="px-5 py-3 border-t border-slate-100">
            {errorEmail && <p className="text-xs text-red-500 mb-2">{errorEmail}</p>}
            {enviado && (
              <p className="text-xs text-slate-400 mb-2 text-center leading-relaxed">
                💡 Si el paciente no lo recibe, pídele que revise su carpeta de <strong>spam o correo no deseado</strong> y lo marque como &quot;No es spam&quot;.
              </p>
            )}
            <button
              onClick={enviarAlPaciente}
              disabled={enviando || enviado}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors
                disabled:opacity-60
                bg-[#1e5fa8] text-white hover:bg-[#1a3a5c]"
            >
              {enviando ? (
                <><Loader2 size={14} className="animate-spin" /> Enviando...</>
              ) : enviado ? (
                <><CheckCircle size={14} /> Enviado a {pacienteEmail}</>
              ) : (
                <><Mail size={14} /> Enviar al paciente</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
