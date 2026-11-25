import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

const SUPLEMENTOS = [
  { nombre: 'Vitamina D3 + K2', fn: 'Mineralización ósea y prevención de calcificación de tejidos blandos', lab: 'Vitamina D < 40 ng/mL', prioridad: 'alta' },
  { nombre: 'Omega-3 EPA/DHA', fn: 'Resolución de inflamación crónica y viscosidad sinovial', lab: 'PCR-us > 1.0 mg/L o Triglicéridos > 100 mg/dL', prioridad: 'alta' },
  { nombre: 'Magnesio Glicinato / ZMA', fn: '+ 300 reacciones enzimáticas, relajante muscular, formación ósea', lab: 'Insulina > 8 uIU/mL (resistencia insulina)', prioridad: 'media' },
  { nombre: 'Colágeno Hidrolizado + Vit C', fn: 'Síntesis de matriz extracelular en cartílago y discos', lab: 'HbA1c > 5.3% o diagnóstico articular', prioridad: 'media' },
  { nombre: 'Creatina Monohidratada', fn: 'Hidratación celular y prevención de atrofia en rehabilitación', lab: 'Post-operatorio / rehabilitación activa', prioridad: 'alta' },
  { nombre: 'Ashwagandha KSM-66', fn: 'Reduce cortisol por dolor crónico, mejora tolerancia al esfuerzo', lab: 'Dolor crónico > 3 meses', prioridad: 'baja' },
  { nombre: 'HMB', fn: 'Previene degradación muscular en reposo/inmovilización', lab: 'Inmovilización / reposo prolongado', prioridad: 'alta' },
]

/* Etiqueta de prioridad (CALMA §11, `.k-etq`): punto + texto en el tono de la
   prioridad. Los textos son los de siempre. */
const colors: Record<string, string> = {
  alta: 'k-etq-mal',
  media: 'k-etq-aviso',
  baja: 'k-etq-tonal',
}

/* «Indicado cuando:» con dos criterios alternativos se dibuja como dos píldoras
   unidas por «o» (maqueta `lectura`, vista 3). Es el mismo texto partido por su
   « o »: se lee igual. */
function Criterios({ lab }: { lab: string }) {
  const partes = lab.split(' o ')
  return (
    <ul className="flex flex-wrap items-center gap-1.5">
      {partes.map((p, i) => (
        <li key={p} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-[12px] leading-4 text-tinta2">o</span>}
          <span className="k-num rounded-[10px] bg-fondo px-2.5 py-1 text-[12px] leading-4 font-semibold text-tinta">{p}</span>
        </li>
      ))}
    </ul>
  )
}

export default function SuplementacionPage() {
  return (
    <div className="mx-auto w-full max-w-[1000px]">
      <div className="mb-5">
        {/* «‹ Expediente» como sus pantallas hermanas (CALMA §6, §20): se llega
            desde el enlace «Suplementación» de la cabecera de `/expediente`. */}
        <Link href="/expediente" prefetch={false} className="k-b k-b-texto -ml-1 h-[var(--k-toque)] text-[13px]">
          <ChevronLeft size={16} aria-hidden="true" />
          Expediente
        </Link>
        <h1 className="k-t-pantalla mt-1">Protocolo de Suplementación</h1>
        <p className="k-t-sec mt-0.5">Stack de suplementación osteomuscular — enfoque en densidad mineral, inflamación y tejidos blandos</p>
      </div>

      <div className="grid grid-cols-1 gap-3 ih:grid-cols-2 ih:gap-3.5 iv:grid-cols-2 iv:gap-3.5 esc:grid-cols-2 esc:gap-4">
        {SUPLEMENTOS.map(s => (
          <section key={s.nombre} className="k-tarjeta flex min-w-0 flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <h2 className="k-t-tarjeta min-w-0 flex-1">{s.nombre}</h2>
              <span className={`k-etq ${colors[s.prioridad]}`}>
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
                {s.prioridad === 'alta' ? 'Alta prioridad' : s.prioridad === 'media' ? 'Media' : 'Complementario'}
              </span>
            </div>
            <p className="text-[15px] leading-[22px] text-tinta esc:text-[14px] esc:leading-5">{s.fn}</p>
            <div className="mt-auto flex flex-col gap-1.5 pt-1">
              <span className="text-[13px] leading-[18px] font-semibold text-tinta2">Indicado cuando:</span>
              <Criterios lab={s.lab} />
            </div>
          </section>
        ))}

        {/* Notas clínicas */}
        <section className="k-tarjeta flex min-w-0 flex-col gap-2.5 self-start bg-aviso-fondo">
          <h2 className="k-t-tarjeta text-aviso-tinta">Notas clínicas clave</h2>
          <ul className="flex flex-col gap-2.5 text-tinta">
            <li className="flex flex-col border-l-[3px] border-aviso-punto pl-3 text-[14px] leading-5"><strong className="text-[15px] font-semibold">Albúmina baja:</strong> Riesgo de infección quirúrgica y no-unión ósea — optimizar antes de cualquier procedimiento</li>
            <li className="flex flex-col border-l-[3px] border-aviso-punto pl-3 text-[14px] leading-5"><strong className="text-[15px] font-semibold">TSH fuera del rango óptimo (1.0–2.5):</strong> Investigar hipotiroidismo subclínico como causa de síntomas osteomusculares</li>
            <li className="flex flex-col border-l-[3px] border-aviso-punto pl-3 text-[14px] leading-5"><strong className="text-[15px] font-semibold">Cistatina C {">"} 0.9:</strong> Función renal comprometida — precaución con AINEs prolongados</li>
            <li className="flex flex-col border-l-[3px] border-aviso-punto pl-3 text-[14px] leading-5"><strong className="text-[15px] font-semibold">Insulina {">"} 8 + HbA1c {">"} 5.3%:</strong> Resistencia a insulina activa — glicación de colágeno comprometida</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
