import Link from 'next/link'
import ReactMarkdown, { type Components } from 'react-markdown'
import { ShieldCheck, ArrowLeft, Calendar, FileText, MapPin } from 'lucide-react'
import LegalLayout from './LegalLayout'
import { AVISO_SPINUS_FECHA, AVISO_SPINUS_PLANTILLA, AVISO_SPINUS_VERSION } from './textoAvisoSpinus'

/* ═══ /privacidad — AVISO DE PRIVACIDAD DE SPINUS PARA SUS USUARIOS ═══
   Versión 3.0 (privacidad 2026-12, documento 1). Sustituye entero al aviso
   v2.0, que mezclaba a los usuarios de la plataforma con los pacientes.

   ⚠️ EL TEXTO NO ESTÁ AQUÍ: es `AVISO_SPINUS_PLANTILLA` (`textoAvisoSpinus.ts`),
   copia literal del documento aprobado. Este archivo sólo lo pinta. Cambiar
   una palabra del aviso es cambiar aquel archivo, con versión y fecha nuevas
   y revisión legal; aquí no se redacta nada.

   Las dos primeras líneas del documento (el título y «Versión… · Última
   actualización…») van en la cabecera; el resto, tal cual, en la tarjeta.

   Este aviso NO es el de los pacientes: de sus datos responde el consultorio,
   y su aviso es el de `/reservar/{código}/privacidad`. */

const [TITULO_MD = '', , , ...RESTO] = AVISO_SPINUS_PLANTILLA.split('\n')
const TITULO = TITULO_MD.replace(/^#\s+/, '')
const CUERPO = RESTO.join('\n')

/** La ropa de cada elemento del Markdown: la misma de las demás páginas legales. */
const ROPA: Components = {
  h2: ({ children }) => <h2 className="font-semibold text-[#1d1d1f] text-[15px] mt-8 first:mt-0 mb-3">{children}</h2>,
  p: ({ children }) => <p className="mb-3">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 mb-3">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 mb-3">{children}</ol>,
  strong: ({ children }) => <strong className="text-[#1d1d1f]">{children}</strong>,
}

export default function AvisoPrivacidadContent() {
  return (
    <LegalLayout>
      <div className="bg-gradient-to-br from-[#1a3a5c] to-[#1e5fa8] text-white">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <Link href="/" className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft size={14} /> Volver
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={20} className="text-white/80" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{TITULO}</h1>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 -mt-4 pb-16">
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/60 shadow-[0_8px_40px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="flex flex-wrap items-center gap-4 px-4 sm:px-8 py-4 border-b border-slate-100 text-[12px] text-[#6e6e73]">
            <span className="flex items-center gap-1.5"><FileText size={12} /> Versión {AVISO_SPINUS_VERSION}</span>
            <span className="flex items-center gap-1.5"><Calendar size={12} /> Última actualización: {AVISO_SPINUS_FECHA}</span>
            <span className="flex items-center gap-1.5"><MapPin size={12} /> Mérida, Yucatán, México</span>
          </div>
          <div className="px-4 sm:px-8 py-6 sm:py-8 text-sm text-[#3d3d3f] leading-relaxed" data-aviso-spinus>
            <ReactMarkdown components={ROPA} disallowedElements={['a', 'img']} unwrapDisallowed>{CUERPO}</ReactMarkdown>
          </div>
        </div>
      </div>
    </LegalLayout>
  )
}
