import { Users, FlaskConical, FileText, Stethoscope } from 'lucide-react'
import Link from 'next/link'

const accesos = [
  {
    href: '/pacientes',
    icon: Users,
    label: 'Pacientes',
    desc: 'Registrar y gestionar expedientes de pacientes',
    color: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
    iconColor: 'text-blue-700',
  },
  {
    href: '/laboratorios',
    icon: FlaskConical,
    label: 'Laboratorios',
    desc: 'Subir PDF y analizar resultados con IA',
    color: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
    iconColor: 'text-emerald-700',
  },
  {
    href: '/expediente',
    icon: Stethoscope,
    label: 'Expediente Clínico',
    desc: 'Registrar consultas, diagnósticos y evolución',
    color: 'bg-violet-50 border-violet-200 hover:bg-violet-100',
    iconColor: 'text-violet-700',
  },
  {
    href: '/documentos',
    icon: FileText,
    label: 'Documentos',
    desc: 'Recetas, solicitudes de lab e imagen',
    color: 'bg-amber-50 border-amber-200 hover:bg-amber-100',
    iconColor: 'text-amber-700',
  },
]

export default function DashboardPage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Encabezado */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1a3a5c]">
          Bienvenido, Dr. Ancona
        </h1>
        <p className="text-slate-500 mt-1">
          Sistema de gestión clínica — Cirugía de Columna · Traumatología y Ortopedia
        </p>
      </div>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {accesos.map(({ href, icon: Icon, label, desc, color, iconColor }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-start gap-4 p-5 rounded-xl border-2 transition-all ${color}`}
          >
            <div className={`mt-0.5 ${iconColor}`}>
              <Icon size={28} />
            </div>
            <div>
              <p className="font-semibold text-slate-800">{label}</p>
              <p className="text-sm text-slate-500 mt-0.5">{desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Info del doctor */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Información del consultorio</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-600">
          <p><span className="font-medium">Médico:</span> Dr. Angel M. Ancona Pérez</p>
          <p><span className="font-medium">Especialidad:</span> Cirugía de Columna · T&O</p>
          <p><span className="font-medium">Céd. Prof.:</span> 12085805</p>
          <p><span className="font-medium">CMOT:</span> 26/5567/25</p>
          <p><span className="font-medium">Horarios:</span> Lun–Vie 9:00am–2pm / 3–8pm</p>
        </div>
      </div>
    </div>
  )
}
