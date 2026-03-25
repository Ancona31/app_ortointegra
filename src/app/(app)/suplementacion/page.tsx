import { Pill } from 'lucide-react'
import Link from 'next/link'

const SUPLEMENTOS = [
  { nombre: 'Vitamina D3 + K2', fn: 'Mineralización ósea y prevención de calcificación de tejidos blandos', lab: 'Vitamina D < 40 ng/mL', prioridad: 'alta' },
  { nombre: 'Omega-3 EPA/DHA', fn: 'Resolución de inflamación crónica y viscosidad sinovial', lab: 'PCR-us > 1.0 mg/L o Triglicéridos > 100 mg/dL', prioridad: 'alta' },
  { nombre: 'Magnesio Glicinato / ZMA', fn: '+ 300 reacciones enzimáticas, relajante muscular, formación ósea', lab: 'Insulina > 8 uIU/mL (resistencia insulina)', prioridad: 'media' },
  { nombre: 'Colágeno Hidrolizado + Vit C', fn: 'Síntesis de matriz extracelular en cartílago y discos', lab: 'HbA1c > 5.3% o diagnóstico articular', prioridad: 'media' },
  { nombre: 'Creatina Monohidratada', fn: 'Hidratación celular y prevención de atrofia en rehabilitación', lab: 'Post-operatorio / rehabilitación activa', prioridad: 'alta' },
  { nombre: 'Ashwagandha KSM-66', fn: 'Reduce cortisol por dolor crónico, mejora tolerancia al esfuerzo', lab: 'Dolor crónico > 3 meses', prioridad: 'baja' },
  { nombre: 'HMB', fn: 'Previene degradación muscular en reposo/inmovilización', lab: 'Inmovilización / reposo prolongado', prioridad: 'alta' },
]

const colors: Record<string, string> = {
  alta: 'bg-red-100 text-red-700',
  media: 'bg-amber-100 text-amber-700',
  baja: 'bg-slate-100 text-slate-600',
}

export default function SuplementacionPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a3a5c] flex items-center gap-2">
          <Pill size={24} /> Protocolo de Suplementación
        </h1>
        <p className="text-slate-500 text-sm mt-1">Stack de suplementación osteomuscular — enfoque en densidad mineral, inflamación y tejidos blandos</p>
      </div>

      <div className="bg-[#e8f4fd] border border-blue-200 rounded-xl p-4 mb-6">
        <p className="text-sm text-[#1a3a5c] font-medium">
          Para el análisis individualizado de un paciente, ve a{' '}
          <Link href="/laboratorios" className="underline">Laboratorios</Link>
          {' '}e ingresa sus valores. El sistema generará las recomendaciones automáticamente.
        </p>
      </div>

      <div className="space-y-3">
        {SUPLEMENTOS.map(s => (
          <div key={s.nombre} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="font-semibold text-slate-800">{s.nombre}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${colors[s.prioridad]}`}>
                {s.prioridad === 'alta' ? 'Alta prioridad' : s.prioridad === 'media' ? 'Media' : 'Complementario'}
              </span>
            </div>
            <p className="text-sm text-slate-600 mb-2">{s.fn}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400">Indicado cuando:</span>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{s.lab}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Notas clínicas */}
      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-5">
        <h3 className="font-semibold text-amber-800 mb-3">Notas clínicas clave</h3>
        <ul className="space-y-2 text-sm text-amber-900">
          <li>• <strong>Albúmina baja</strong>: Riesgo de infección quirúrgica y no-unión ósea — optimizar antes de cualquier procedimiento</li>
          <li>• <strong>TSH fuera del rango óptimo (1.0–2.5)</strong>: Investigar hipotiroidismo subclínico como causa de síntomas osteomusculares</li>
          <li>• <strong>Cistatina C {">"} 0.9</strong>: Función renal comprometida — precaución con AINEs prolongados</li>
          <li>• <strong>Insulina {">"} 8 + HbA1c {">"} 5.3%</strong>: Resistencia a insulina activa — glicación de colágeno comprometida</li>
        </ul>
      </div>
    </div>
  )
}
