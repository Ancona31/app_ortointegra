'use client'

import Image from 'next/image'
import { Calendar, FileText, Clock, Search, Users, Activity } from 'lucide-react'

/* Mini representation of the app UI for the macOS window mockup */
function AppMockup() {
  return (
    <div className="flex h-full bg-[#f8fafc] text-left">
      {/* Sidebar */}
      <div className="w-[180px] bg-white/90 border-r border-slate-200/60 p-4 flex-shrink-0 hidden sm:block">
        <div className="flex items-center gap-2 mb-6">
          <Image src="/logo-spinus.png" alt="Spinus" width={800} height={777} className="object-contain h-6 w-auto" />
          <span className="text-[11px] font-bold text-slate-800">Spinus®</span>
        </div>
        <div className="space-y-1">
          {[
            { icon: <Activity className="w-3 h-3" />, label: 'Dashboard' },
            { icon: <Users className="w-3 h-3" />, label: 'Pacientes', active: false },
            { icon: <Calendar className="w-3 h-3" />, label: 'Agenda', active: true },
            { icon: <FileText className="w-3 h-3" />, label: 'Documentos' },
          ].map((item) => (
            <div
              key={item.label}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] font-medium ${
                item.active
                  ? 'bg-[#1e5fa8]/10 text-[#1e5fa8]'
                  : 'text-slate-500'
              }`}
            >
              {item.icon}
              {item.label}
            </div>
          ))}
        </div>
      </div>

      {/* Main content — agenda preview */}
      <div className="flex-1 p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[12px] font-bold text-slate-800">Agenda</h3>
            <p className="text-[9px] text-slate-400">Lunes 7 de abril, 2026</p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
              <Search className="w-2.5 h-2.5 text-slate-400" />
              <span className="text-[9px] text-slate-400">Ctrl+K</span>
            </div>
          </div>
        </div>

        {/* Time grid */}
        <div className="space-y-0.5">
          {[
            { time: '09:00', patient: 'Carlos Méndez', type: 'Valoración columna', color: 'bg-blue-500' },
            { time: '09:30', patient: '', type: '', color: '' },
            { time: '10:00', patient: 'María López', type: 'Seguimiento post-qx', color: 'bg-emerald-500' },
            { time: '10:30', patient: 'Roberto Díaz', type: 'Lectura de estudios', color: 'bg-violet-500' },
            { time: '11:00', patient: '', type: '', color: '' },
            { time: '11:30', patient: 'Ana Cervantes', type: 'Primera consulta', color: 'bg-amber-500' },
          ].map((slot) => (
            <div key={slot.time} className="flex items-stretch gap-2 min-h-[28px]">
              <span className="text-[9px] text-slate-400 w-8 pt-1 flex-shrink-0 text-right">{slot.time}</span>
              <div className="flex-1 border-t border-slate-100 relative">
                {slot.patient && (
                  <div className={`absolute inset-x-0 top-0 ${slot.color} rounded-md px-2 py-1 shadow-sm`}>
                    <p className="text-[9px] font-semibold text-white leading-tight">{slot.patient}</p>
                    <p className="text-[8px] text-white/80 leading-tight">{slot.type}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — patient card */}
      <div className="w-[160px] bg-white/90 border-l border-slate-200/60 p-3 flex-shrink-0 hidden lg:block">
        <div className="mb-3">
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Próximo paciente</p>
          <div className="bg-blue-50 rounded-xl p-2.5">
            <p className="text-[11px] font-bold text-slate-800">Carlos Méndez</p>
            <p className="text-[9px] text-slate-500 mt-0.5">Valoración columna</p>
            <div className="flex items-center gap-1 mt-1.5">
              <Clock className="w-2.5 h-2.5 text-[#1e5fa8]" />
              <span className="text-[9px] font-semibold text-[#1e5fa8]">09:00 AM</span>
            </div>
          </div>
        </div>
        <div>
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Hoy</p>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="bg-slate-50 rounded-lg p-2 text-center">
              <p className="text-[14px] font-bold text-slate-800">4</p>
              <p className="text-[8px] text-slate-500">Citas</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2 text-center">
              <p className="text-[14px] font-bold text-emerald-600">3</p>
              <p className="text-[8px] text-slate-500">Confirmadas</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* App mockup — macOS window */
export default function SeccionMockup() {
  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-8 pb-20 sm:pb-28">
      <div className="rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(30,95,168,0.15),0_0_0_1px_rgba(0,0,0,0.05)]">
        {/* macOS title bar */}
        <div className="bg-[#f6f6f6] border-b border-slate-200/80 px-4 py-2.5 flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="bg-white/80 border border-slate-200/60 rounded-md px-3 py-0.5 text-[10px] text-slate-400 font-medium">
              spinus.com.mx/agenda
            </div>
          </div>
          <div className="w-[52px]" /> {/* spacer to center address bar */}
        </div>

        {/* App content */}
        <div className="h-[280px] sm:h-[360px] lg:h-[400px]">
          <AppMockup />
        </div>
      </div>
    </section>
  )
}
