'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { X, Mail, Loader2, CheckCircle } from 'lucide-react'
import Portal from '@/components/ui/Portal'

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

// El visor renderiza múltiples tipos de documento con contenido JSON flexible de la DB.
// El contenido es dinámico y varía por tipo — Record<string, any> es intencional aquí.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface VisorDoc {
  id: string
  tipo: string
  contenido: Record<string, any>
  created_at?: string
}

interface Props {
  doc: VisorDoc
  onClose: () => void
  pacienteEmail?: string | null
}

export default function ModalVisorDocumento({ doc, onClose, pacienteEmail }: Props) {
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [errorEmail, setErrorEmail] = useState('')
  const [confirmarAlterno, setConfirmarAlterno] = useState(false)
  const [emailRegistrado, setEmailRegistrado] = useState('')

  async function enviarAlPaciente(confirmar = false) {
    if (!pacienteEmail || enviando) return
    setEnviando(true)
    setErrorEmail('')
    setConfirmarAlterno(false)
    const res = await fetch('/api/email/enviar-documento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentoId: doc.id,
        pacienteEmail,
        confirmarEmailAlterno: confirmar,
      }),
    })
    const data = await res.json()
    setEnviando(false)
    if (!res.ok) {
      if (data.error === 'email_mismatch') {
        setEmailRegistrado(data.emailRegistrado || '')
        setConfirmarAlterno(true)
        return
      }
      setErrorEmail(data.error || 'Error al enviar')
      return
    }
    setEnviado(true)
  }

  return (
    <Portal>
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 animate-fade-in">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col animate-slide-up">
        {/* Header modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_DOC_COLOR[doc.tipo] || 'bg-slate-100 text-slate-600'}`}>
              {TIPO_DOC_LABEL[doc.tipo] || doc.tipo}
            </span>
            <span className="text-xs text-[#86868b]">
              {doc.created_at ? format(parseISO(doc.created_at), "dd 'de' MMMM 'de' yyyy", { locale: es }) : ''}
            </span>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-[#86868b] transition-colors">
            <X size={14} />
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

            {/* Diálogo de confirmación cuando el email no coincide con el registrado */}
            {confirmarAlterno && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-2">
                <p className="text-xs text-amber-800 font-medium mb-1">Email diferente al registrado</p>
                <p className="text-[11px] text-amber-700 leading-relaxed mb-2">
                  El email del paciente registrado es <strong>{emailRegistrado}</strong> pero
                  se intenta enviar a <strong>{pacienteEmail}</strong>.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => enviarAlPaciente(true)}
                    className="flex-1 text-xs py-1.5 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 transition-colors"
                  >
                    Confirmar envio
                  </button>
                  <button
                    onClick={() => setConfirmarAlterno(false)}
                    className="flex-1 text-xs py-1.5 rounded-lg bg-slate-100 text-slate-600 font-medium hover:bg-slate-200 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {enviado && (
              <p className="text-xs text-slate-400 mb-2 text-center leading-relaxed">
                Si el paciente no lo recibe, pidele que revise su carpeta de <strong>spam o correo no deseado</strong> y lo marque como &quot;No es spam&quot;.
              </p>
            )}
            {!confirmarAlterno && (
              <button
                onClick={() => enviarAlPaciente()}
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
            )}
          </div>
        )}
      </div>
    </div>
    </Portal>
  )
}
