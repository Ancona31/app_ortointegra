'use client'

import type { ReactNode } from 'react'
import { Shield, Scale, Database, DatabaseBackup } from 'lucide-react'

interface Tarjeta {
  icon: ReactNode
  /** Fondo del contenedor del icono. Los semánticos (violeta, esmeralda) aquí
   *  decoran en vez de representar datos reales del producto — deuda de §3.1
   *  que barre F1.3 en toda la landing, no esta sección sola. */
  iconBg: string
  title: string
  desc: ReactNode
}

/* ⚠️ Cada claim de esta sección está verificado contra el producto. Antes de
   añadir o endurecer uno, releer §7·10. Lo que se eliminó y POR QUÉ:

   · "Ni siquiera nosotros podemos leer tus notas médicas" — FALSO: existe
     service_role y la IA corre server-side. Riesgo legal, y de gremio: Angel
     es competidor de su propio cliente.
   · "Información cifrada donde solo tú tienes la llave" — implica cifrado
     extremo a extremo con custodia exclusiva del médico. No es el caso.
   · "cumple automáticamente con la NOM-004" — el obligado por la norma es el
     médico, no el software. Spinus da la estructura; no absuelve a nadie.
   · "sincronización total en la nube en tiempo real" — el bug de sync de
     Google Calendar sigue abierto (§11). Mismo motivo por el que §7·9 lo
     prohíbe en Portabilidad.
   · "Tu consultorio nunca se detiene" / "Acceso total" / "Privacidad
     Absoluta" / "blindada" — absolutos sin respaldo. Había 12 en 65 líneas.
   · La bitácora NO se menciona: la verificación de §10 sobre qué accesos
     cubre hoy sigue abierta. Cuando se cierre, su lugar es la tarjeta 2. */
const tarjetas: Tarjeta[] = [
  {
    icon: <Scale className="w-6 h-6 text-[#1e5fa8]" />,
    iconBg: 'bg-blue-50',
    title: 'Conforme a la norma',
    desc: (
      <>
        La estructura del expediente y los formatos siguen la{' '}
        <strong className="text-slate-700">NOM-004</strong>, y el tratamiento de datos se rige por la{' '}
        <strong className="text-slate-700">LFPDPPP</strong> vigente.
      </>
    ),
  },
  {
    icon: <Database className="w-6 h-6 text-violet-600" />,
    iconBg: 'bg-violet-50',
    title: 'Tu información, separada',
    desc: 'Cada médico solo accede a sus pacientes, a nivel de base de datos.',
  },
  {
    icon: <DatabaseBackup className="w-6 h-6 text-emerald-600" />,
    iconBg: 'bg-emerald-50',
    title: 'Respaldo automático',
    desc: 'Tus expedientes se respaldan solos, todos los días. Si algo falla, la información sigue ahí.',
  },
]

/* §3.4·10 pide las 3 tarjetas EN ESCALERA, no en fila, y §5.10 fija los
   offsets en 0/24/48px ESTÁTICOS — es layout, no movimiento: por eso vive
   aquí y no en F2.a. Las clases van literales para que el escáner de
   Tailwind las encuentre; derivarlas con plantilla las borraría del build.
   El escalón arranca en sm: en móvil las tarjetas se apilan planas. */
const ESCALERA = ['sm:mt-0', 'sm:mt-6', 'sm:mt-12'] as const

/* Section: Seguridad
   El array no es adorno: F2.a necesita una lista iterable para el Stagger,
   porque §4.4 prohíbe envolver los hijos en wrappers extra (rompen el span
   del grid) y obliga a variantes padre→hijo sobre este map. */
export default function SeccionSeguridad() {
  return (
    <section className="bg-slate-100/40 backdrop-blur-md border-y border-white/30">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-20 sm:py-28">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-blue-50 rounded-full px-3.5 py-1 mb-6">
            <Shield className="w-3.5 h-3.5 text-[#1e5fa8]" />
            <span className="text-[11px] font-semibold text-[#1e5fa8] uppercase tracking-wider">Seguridad clínica</span>
          </div>
          <h2 className="text-[28px] sm:text-[38px] font-bold text-slate-900 tracking-tight leading-[1.15]">
            Tu práctica,{' '}
            <span className="text-slate-400">protegida</span>
          </h2>
        </div>

        {/* items-start es lo que hace visible la escalera: sin él las tarjetas
            se estiran a la altura de la fila y el mt no desplaza nada. */}
        <div className="grid sm:grid-cols-3 gap-6 items-start">
          {tarjetas.map((t, i) => (
            <div
              key={t.title}
              className={`bg-white/30 backdrop-blur-md rounded-2xl border border-white/30 p-8 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 ${ESCALERA[i]}`}
            >
              <div className={`w-12 h-12 rounded-xl ${t.iconBg} flex items-center justify-center mb-5`}>
                {t.icon}
              </div>
              <h3 className="text-[16px] font-bold text-slate-900 mb-3">{t.title}</h3>
              <p className="text-[14px] text-slate-500 leading-relaxed">{t.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
