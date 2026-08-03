import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle, Info, Pill, ShieldCheck } from 'lucide-react'
import {
  FECHA,
  FECHA_EMISION,
  FOLIO,
  MEDICAMENTOS,
  MEDICO,
  PACIENTE_INICIALES,
  PALETAS,
} from '@/components/landing/teaser2/receta-demo'

/* ═══ /demo/receta — LO QUE ABRE EL QR DEL TEASER 2 (§5.7) ═══
   Réplica de `src/app/r/[folio]/page.tsx` (la verificación real) con los datos
   ficticios de la receta del teaser. No consulta la base: no hay folio que
   buscar, no hay Supabase, no hay `notFound()`. Es una hoja estática.

   ⚠️⚠️ APLICA LA MINIMIZACIÓN QUE LA PÁGINA REAL TODAVÍA NO TIENE, y esa
   diferencia es deliberada, no un descuido de la copia:
     · el paciente aparece por INICIALES, no con nombre completo;
     · NO se muestra el diagnóstico ni su clave CIE-10.
   Quien escanea un QR pegado en un papel puede ser cualquiera —la farmacia, un
   familiar, quien lo encontró en el suelo— y lo que necesita comprobar es que
   la receta es auténtica y quién la firmó, no la condición clínica de la
   persona. Un diagnóstico es dato personal SENSIBLE bajo la LFPDPPP vigente, y
   publicarlo tras una URL adivinable sería exactamente lo contrario de lo que
   esta misma landing promete en Seguridad y en la FAQ. La deuda "verificación
   de recetas: noindex + minimización + vigencia" (§11) sigue abierta PARA LA
   PÁGINA REAL; aquí se estrena la política.

   ⚠️ SI ALGUIEN ARREGLA LA PÁGINA REAL, ESTA ES LA REFERENCIA. Y al revés: no
   "alinees" esta con la real copiándole el nombre completo y el diagnóstico —
   sería una regresión de privacidad hecha en nombre de la consistencia.

   ⚠️ SIN `®`: la marca está en trámite ante el IMPI (exp. 3594483) y §7·Global
   lo prohíbe en texto nuevo. La página real todavía lo lleva (`:162`) y eso es
   deuda suya, no un patrón a imitar. */

const PALETA = PALETAS[0]

export const metadata: Metadata = {
  title: 'Receta de demostración — Spinus',
  description:
    'Ejemplo de la página de verificación que abre el QR de una receta emitida con Spinus. Datos ficticios.',
  /* `noindex` por la misma razón que la página real debe llevarlo: una
     verificación de receta no es contenido de búsqueda. Aquí además evita que
     una receta FALSA compita en resultados con la marca. */
  robots: { index: false, follow: false },
}

export default function RecetaDemoPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Aviso de demostración — antes que nada, para que nadie lo confunda
            con la verificación de un documento real. */}
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 flex gap-3">
          <Info size={20} className="flex-shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-bold text-amber-900 text-sm">Esto es una demostración</p>
            <p className="text-sm text-amber-800 mt-1 leading-relaxed">
              La receta no existe y la paciente tampoco: los datos son ficticios. Así se ve la
              página que abre el QR de una receta emitida con Spinus.
            </p>
          </div>
        </div>

        {/* Sello de verificación */}
        <div
          className="rounded-2xl p-5 flex items-center gap-4 text-white shadow-lg"
          style={{ background: `linear-gradient(135deg, ${PALETA.navy}, ${PALETA.acento})` }}
        >
          <ShieldCheck size={40} className="flex-shrink-0 opacity-90" />
          <div>
            <p className="font-bold text-lg leading-tight">Receta Verificada</p>
            <p className="text-sm opacity-80 mt-0.5">
              Emitida el {FECHA_EMISION} · Folio {FOLIO}
            </p>
          </div>
          <CheckCircle size={28} className="ml-auto flex-shrink-0 opacity-80" />
        </div>

        {/* Datos del médico — quién firma es justo lo que hay que poder
            comprobar, así que esto va completo. */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100" style={{ borderLeftWidth: 4, borderLeftColor: PALETA.navy }}>
            <p className="font-bold text-slate-800 text-base">{MEDICO.nombre}</p>
            <p className="text-sm italic mt-0.5" style={{ color: PALETA.acento }}>{MEDICO.especialidad}</p>
          </div>
          <div className="px-5 py-3 flex flex-wrap gap-4 text-xs text-slate-500">
            <span><span className="font-semibold text-slate-600">Cédula Prof.:</span> {MEDICO.cedulaProfesional}</span>
            <span><span className="font-semibold text-slate-600">Cédula Esp.:</span> {MEDICO.cedulaEspecialidad}</span>
          </div>
        </div>

        {/* Paciente — INICIALES y fecha. Sin diagnóstico: ver la nota de arriba. */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Paciente</span>
              <p className="font-medium text-slate-800 mt-0.5">{PACIENTE_INICIALES}</p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Fecha</span>
              <p className="font-medium text-slate-800 mt-0.5">{FECHA}</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3 leading-relaxed">
            Se muestran solo las iniciales del paciente, y el diagnóstico no se publica. Quien
            verifica una receta necesita saber que es auténtica y quién la firmó, no la condición
            clínica de la persona.
          </p>
        </div>

        {/* Medicamentos */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <Pill size={15} style={{ color: PALETA.navy }} />
            <span className="font-semibold text-slate-700 text-sm">Medicamentos prescritos</span>
          </div>
          <div className="divide-y divide-slate-100">
            {MEDICAMENTOS.map((m, i) => (
              <div key={m.nombre} className="px-5 py-4 flex gap-4">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: PALETA.acento }}
                >
                  {i + 1}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-800">
                    {m.nombre}
                    <span className="font-normal text-slate-500 ml-1">{m.presentacion}</span>
                  </p>
                  <p className="text-xs italic text-slate-400 mt-0.5">{m.principio}</p>
                  <span
                    className="inline-block text-xs font-semibold mt-1 px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${PALETA.acento}15`, color: PALETA.acento }}
                  >
                    Vía {m.via}
                  </span>
                  <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{m.indicacion}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center pb-4 space-y-2">
          <Link href="/" className="text-sm font-semibold text-slate-500 hover:text-slate-700 underline underline-offset-4">
            Conoce Spinus
          </Link>
          <p className="text-xs text-slate-300">
            Spinus · Sistema de Gestión Clínica · spinus.com.mx
          </p>
        </div>
      </div>
    </div>
  )
}
