'use client'

import { Shield, Scale, LockKeyhole, Wifi } from 'lucide-react'

/* Section: Blindaje y Seguridad */
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
            <span className="text-slate-400">blindada</span>
          </h2>
          <p className="mt-4 text-[16px] text-slate-500 leading-relaxed max-w-xl mx-auto">
            La seguridad no debería ser algo en lo que pienses. En Spinus, está integrada en cada capa del sistema.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {/* Blindaje Legal */}
          <div className="bg-white/30 backdrop-blur-md rounded-2xl border border-white/30 p-8 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-5">
              <Scale className="w-6 h-6 text-[#1e5fa8]" />
            </div>
            <h3 className="text-[16px] font-bold text-slate-900 mb-3">Blindaje Legal</h3>
            <p className="text-[14px] text-slate-500 leading-relaxed">
              Tu práctica cumple automáticamente con la <strong className="text-slate-700">NOM-004</strong> (Expediente Clínico) y la <strong className="text-slate-700">LFPDPPP</strong> (Privacidad de Datos). Sin que tengas que configurar nada.
            </p>
          </div>

          {/* Privacidad Absoluta */}
          <div className="bg-white/30 backdrop-blur-md rounded-2xl border border-white/30 p-8 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
            <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center mb-5">
              <LockKeyhole className="w-6 h-6 text-violet-600" />
            </div>
            <h3 className="text-[16px] font-bold text-slate-900 mb-3">Privacidad Absoluta</h3>
            <p className="text-[14px] text-slate-500 leading-relaxed">
              Información cifrada donde solo tú tienes la llave. <strong className="text-slate-700">Ni siquiera nosotros podemos leer tus notas médicas</strong>. Cada acceso queda registrado en bitácora de auditoría.
            </p>
          </div>

          {/* Siempre Disponible */}
          <div className="bg-white/30 backdrop-blur-md rounded-2xl border border-white/30 p-8 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-5">
              <Wifi className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="text-[16px] font-bold text-slate-900 mb-3">Siempre Disponible</h3>
            <p className="text-[14px] text-slate-500 leading-relaxed">
              Acceso total desde cualquier dispositivo y respaldo automático en la nube. <strong className="text-slate-700">Tu consultorio nunca se detiene</strong> — sincronización total en la nube en tiempo real.
            </p>
          </div>
        </div>

        <p className="text-center mt-12 text-[14px] text-slate-400 italic">
          Diseñado para que te preocupes por tus pacientes, no por la tecnología.
        </p>
      </div>
    </section>
  )
}
