'use client'

import Link from 'next/link'
import {
  UserPlus, Stethoscope, CalendarDays, FileText,
  FlaskConical, ScanLine, Pill, ClipboardList,
  BedDouble, PenLine, ShieldCheck, Receipt, BarChart2,
} from 'lucide-react'

type GridMode = 'sin_pacientes' | 'nuevo' | 'activo'

interface AccionItem {
  href: string
  label: string
  desc: string
  icon: React.ElementType
  color: string
  primary?: boolean
}

const ACCIONES_SIN_PACIENTES: AccionItem[] = [
  { href: '/pacientes/nuevo', label: 'Agregar primer paciente', desc: 'Crea el expediente de tu primer paciente', icon: UserPlus, color: 'bg-[#1e5fa8]', primary: true },
  { href: '/agenda', label: 'Configurar agenda', desc: 'Define tus horarios de atención', icon: CalendarDays, color: 'bg-slate-700' },
  { href: '/perfil', label: 'Completar perfil', desc: 'Agrega datos que aparecerán en tus documentos', icon: Stethoscope, color: 'bg-slate-700' },
]

const ACCIONES_NUEVO: AccionItem[] = [
  { href: '/pacientes/nuevo', label: 'Nuevo paciente', desc: 'Registrar expediente', icon: UserPlus, color: 'bg-[#1e5fa8]', primary: true },
  { href: '/agenda', label: 'Agenda', desc: 'Ver citas del día', icon: CalendarDays, color: 'bg-[#1a3a5c]', primary: true },
  { href: '/expediente', label: 'Expedientes', desc: 'Buscar paciente', icon: Stethoscope, color: 'bg-slate-600' },
  { href: '/documentos?tipo=receta', label: 'Receta médica', desc: 'Generar documento', icon: FileText, color: 'bg-slate-600' },
  { href: '/documentos?tipo=lab', label: 'Solicitud laboratorio', desc: 'Generar documento', icon: FlaskConical, color: 'bg-slate-500' },
  { href: '/documentos?tipo=imagen', label: 'Solicitud imagen', desc: 'Generar documento', icon: ScanLine, color: 'bg-slate-500' },
]

const ACCIONES_ACTIVO: AccionItem[] = [
  { href: '/pacientes/nuevo', label: 'Nuevo paciente', desc: 'Registrar expediente', icon: UserPlus, color: 'bg-[#1e5fa8]' },
  { href: '/agenda', label: 'Agenda', desc: 'Ver citas del día', icon: CalendarDays, color: 'bg-[#1a3a5c]' },
  { href: '/expediente', label: 'Expedientes', desc: 'Buscar y consultar', icon: Stethoscope, color: 'bg-slate-700' },
  { href: '/documentos?tipo=receta', label: 'Receta médica', desc: 'Generar documento', icon: Pill, color: 'bg-slate-600' },
  { href: '/documentos?tipo=lab', label: 'Laboratorio', desc: 'Solicitud de estudios', icon: FlaskConical, color: 'bg-slate-600' },
  { href: '/documentos?tipo=imagen', label: 'Imagen', desc: 'Solicitud de imagen', icon: ScanLine, color: 'bg-slate-600' },
  { href: '/documentos?tipo=suplementacion', label: 'Suplementación', desc: 'Plan nutricional', icon: ClipboardList, color: 'bg-slate-500' },
  { href: '/documentos?tipo=internamiento', label: 'Internamiento', desc: 'Solicitud hospitalaria', icon: BedDouble, color: 'bg-slate-500' },
  { href: '/documentos?tipo=escrito', label: 'Escrito médico', desc: 'Documento libre', icon: PenLine, color: 'bg-slate-500' },
  { href: '/documentos?tipo=consentimiento', label: 'Consentimiento', desc: 'Informado', icon: ShieldCheck, color: 'bg-slate-500' },
  { href: '/documentos?tipo=honorarios', label: 'Honorarios', desc: 'Cotización', icon: Receipt, color: 'bg-slate-500' },
  { href: '/estadisticas', label: 'Estadísticas', desc: 'Ver métricas', icon: BarChart2, color: 'bg-slate-400' },
]

function ActionCard({ item }: { item: AccionItem }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className="group flex flex-col gap-2 p-4 bg-white rounded-xl border border-slate-200 hover:border-[#1e5fa8]/40 hover:shadow-md transition-all"
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${item.color} text-white shrink-0`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-800 group-hover:text-[#1a3a5c] leading-tight">{item.label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
      </div>
    </Link>
  )
}

interface Props {
  mode: GridMode
}

export default function AccionesGrid({ mode }: Props) {
  const acciones =
    mode === 'sin_pacientes' ? ACCIONES_SIN_PACIENTES :
    mode === 'nuevo' ? ACCIONES_NUEVO :
    ACCIONES_ACTIVO

  const titulo =
    mode === 'sin_pacientes' ? 'Comenzar' :
    mode === 'nuevo' ? 'Acciones rápidas' :
    'Acciones'

  const cols =
    mode === 'sin_pacientes' ? 'grid-cols-1 sm:grid-cols-3' :
    mode === 'nuevo' ? 'grid-cols-2 sm:grid-cols-3' :
    'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'

  return (
    <section>
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">{titulo}</h2>
      <div className={`grid ${cols} gap-3`}>
        {acciones.map(a => <ActionCard key={a.href} item={a} />)}
      </div>
    </section>
  )
}
