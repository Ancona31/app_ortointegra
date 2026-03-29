'use client'

import { useState, useEffect } from 'react'
import { Printer, Loader2, RefreshCw } from 'lucide-react'
import { flushSync } from 'react-dom'
import { imprimirOCompartir } from '@/lib/mobileShare'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'

type MedicoInfo = {
  nombre: string
  especialidad: string
  cedula_profesional: string
  cedula_especialidad: string
  logo_url: string | null
  color_primario: string
  color_secundario: string
  direccion_consultorio: string
  telefono_consultorio: string
}

type Presentacion = {
  tipo: string      // 'cápsula' | 'tableta' | 'cucharada' | 'scoop'
  contenido: number // cantidad por unidad, en la misma unidad que `unidad` del suplemento
  nota?: string     // texto adicional en el PDF, ej: "+ 1 tableta Vitamina C 1,000 mg"
}

type Suplemento = {
  nombre: string
  dosis_default: string
  dosis_por_kg: string | null
  min_kg: number | null
  max_kg: number | null
  unidad: string
  presentacion: Presentacion | null  // null = mostrar mg/UI en PDF (sin conversión)
  beneficio_clinico: string          // texto médico — visible en tarjetas de selección (médico)
  beneficio_paciente: string         // lenguaje amigable — aparece en el PDF (paciente)
}

const SUPLEMENTOS: Suplemento[] = [
  {
    nombre: 'Vitamina D3',
    dosis_default: '5,000 UI/día',
    dosis_por_kg: '70–100 UI/kg/día',
    min_kg: 70, max_kg: 100, unidad: 'UI',
    presentacion: null, // sin conversión a cápsulas — se muestra en UI/día
    beneficio_clinico: 'Absorción de calcio y mineralización ósea. Con IMC elevado se requieren dosis de carga para saturar receptores. Clave para unión ósea en cirugía de columna y artroplastia.',
    beneficio_paciente: 'Ayuda a que tus huesos absorban el calcio correctamente y se mantengan fuertes. Es especialmente importante después de una cirugía de columna o articulaciones para que la recuperación sea más rápida y sólida.',
  },
  {
    nombre: 'Vitamina K2 (MK-7)',
    dosis_default: '100 mcg/día',
    dosis_por_kg: '1.5–2 mcg/kg/día',
    min_kg: 1.5, max_kg: 2, unidad: 'mcg',
    presentacion: { tipo: 'cápsula', contenido: 100 },
    beneficio_clinico: 'Activa la osteocalcina y dirige el calcio al hueso. Evita calcificación de ligamentos y arterias. Sinergia indispensable con Vitamina D3.',
    beneficio_paciente: 'Trabaja en equipo con la Vitamina D3 para que el calcio llegue exactamente a donde debe estar: tus huesos. Evita que ese calcio se acumule en lugares donde puede hacer daño, como las arterias o los ligamentos.',
  },
  {
    nombre: 'Omega-3 (EPA/DHA)',
    dosis_default: '2–3 g/día con alimentos',
    dosis_por_kg: '30–40 mg/kg/día',
    min_kg: 30, max_kg: 40, unidad: 'mg',
    presentacion: { tipo: 'cápsula', contenido: 640 }, // Nordic Naturals: 2 caps = 1,280 mg → 640 mg/cap
    beneficio_clinico: 'A >3 g/día modula la cascada del ácido araquidónico. Reduce inflamación en entesis y discos intervertebrales. Alternativa coadyuvante a AINEs en radiculopatía crónica.',
    beneficio_paciente: 'Reduce la inflamación de forma natural en articulaciones, nervios y discos de la columna. A dosis terapéuticas ayuda a controlar el dolor crónico sin irritar el estómago como lo hacen algunos antiinflamatorios convencionales.',
  },
  {
    nombre: 'Colágeno Hidrolizado + Vitamina C',
    dosis_default: '10–15 g + 500 mg en ayunas',
    dosis_por_kg: '0.10–0.15 g/kg/día',
    min_kg: 0.10, max_kg: 0.15, unidad: 'g',
    presentacion: { tipo: 'cucharada', contenido: 5, nota: '+ 1 tableta de Vitamina C 1,000 mg — tomar en ayunas' },
    beneficio_clinico: 'Aporta glicina y prolina para reparación de fascia y anillo fibroso del disco. Tomar en ayunas con vitamina C para máxima biodisponibilidad.',
    beneficio_paciente: 'El colágeno es el material de construcción natural de tus tendones, ligamentos y los discos que amortiguan tu columna. Tomarlo en ayunas con vitamina C ayuda a reparar y fortalecer esos tejidos desde adentro.',
  },
  {
    nombre: 'Creatina Monohidratada',
    dosis_default: '5 g/día',
    dosis_por_kg: '0.07–0.10 g/kg/día',
    min_kg: 0.07, max_kg: 0.10, unidad: 'g',
    presentacion: { tipo: 'scoop', contenido: 5 },
    beneficio_clinico: 'Síntesis de ATP muscular y retención de nitrógeno. Previene sarcopenia y atrofia por desuso. Mejora potencia en rehabilitación incluso con déficit calórico.',
    beneficio_paciente: 'Le da más energía a tus músculos para que trabajen mejor durante la rehabilitación. Evita que el músculo se pierda cuando estás en reposo o en un proceso de recuperación, y mejora tu fuerza de forma progresiva.',
  },
  {
    nombre: 'Magnesio Glicinato',
    dosis_default: '300–400 mg/día',
    dosis_por_kg: '4–6 mg/kg/día',
    min_kg: 4, max_kg: 6, unidad: 'mg',
    presentacion: { tipo: 'cápsula', contenido: 500 },
    beneficio_clinico: 'Relajación de musculatura paravertebral y cofactor en formación de matriz ósea. Alta biodisponibilidad sin efectos laxantes del óxido o citrato.',
    beneficio_paciente: 'Relaja los músculos de la espalda y ayuda a reducir los espasmos y la tensión. También es necesario para formar hueso sano y mejora la calidad del sueño, que es cuando el cuerpo más se repara.',
  },
  {
    nombre: 'Cúrcuma (Curcumina 95%)',
    dosis_default: '500–1,000 mg/día',
    dosis_por_kg: '8–10 mg/kg/día',
    min_kg: 8, max_kg: 10, unidad: 'mg',
    presentacion: { tipo: 'cápsula', contenido: 500 },
    beneficio_clinico: 'Inhibidor natural de NF-kB y COX-2. Reduce dolor articular crónico sin daño gástrico. Efecto comparable a dosis bajas de diclofenaco después de 4 semanas continuas.',
    beneficio_paciente: 'Es un antiinflamatorio natural muy potente extraído de la cúrcuma. Con uso continuo de 4 semanas ayuda a controlar el dolor crónico en articulaciones y espalda, sin los efectos secundarios que tienen los antiinflamatorios de farmacia.',
  },
  {
    nombre: 'HMB (Beta-hidroxi-beta-metilbutirato)',
    dosis_default: '3 g/día (3 tomas)',
    dosis_por_kg: '30–40 mg/kg/día',
    min_kg: 30, max_kg: 40, unidad: 'mg',
    presentacion: { tipo: 'cápsula', contenido: 1000 },
    beneficio_clinico: 'Anticatabólico. Protege masa muscular en déficit calórico y periodos de estrés quirúrgico o posoperatorio.',
    beneficio_paciente: 'Protege tu músculo cuando el cuerpo está bajo estrés, como después de una cirugía o durante una dieta. Evita que el organismo "consuma" el músculo que tanto trabajo cuesta ganar o mantener.',
  },
  {
    nombre: 'Ashwagandha KSM-66',
    dosis_default: '1 cápsula al día',
    dosis_por_kg: null,
    min_kg: null, max_kg: null, unidad: 'mg',
    presentacion: { tipo: 'cápsula', contenido: 600 },
    beneficio_clinico: 'Modulador de cortisol. Reduce gluconeogénesis inducida por estrés, protegiendo masa muscular. Indicado en pacientes con alta carga laboral o entrenamiento de alta intensidad.',
    beneficio_paciente: 'Ayuda a reducir el estrés y equilibrar el cortisol, que es la hormona que el cuerpo libera cuando está bajo presión. Cuando el cortisol está elevado por mucho tiempo, destruye músculo y dificulta la recuperación; esta planta ayuda a controlarlo.',
  },
]

function calcularDosis(sup: Suplemento, pesoKg: number): string {
  if (!sup.min_kg || !sup.max_kg) return sup.dosis_default
  const min = sup.min_kg * pesoKg
  const max = sup.max_kg * pesoKg

  // mg → g when ≥ 1000 mg
  if (sup.unidad === 'mg' && min >= 1000) {
    return `${(min / 1000).toFixed(1)}–${(max / 1000).toFixed(1)} g/día`
  }

  const fmt = (n: number) => {
    if (sup.unidad === 'g') return parseFloat(n.toFixed(1)).toString()
    if (n >= 1000) return Math.round(n).toLocaleString('es-MX')
    if (n >= 10) return Math.round(n).toString()
    return parseFloat(n.toFixed(1)).toString()
  }

  return `${fmt(min)}–${fmt(max)} ${sup.unidad}/día`
}

// Devuelve la dosis en cápsulas/cucharadas para el PDF del paciente (dosis mínima por peso)
function dosisEnCapsulas(sup: Suplemento, pesoKg: number): string | null {
  if (!sup.presentacion) return null

  let n: number
  if (!sup.min_kg) {
    // Dosis fija — 1 unidad como mínimo práctico
    n = 1
  } else {
    const dosis_min = sup.min_kg * pesoKg
    n = Math.max(1, Math.round(dosis_min / sup.presentacion.contenido))
  }

  const t = sup.presentacion.tipo
  const label = n === 1 ? t
    : t === 'cucharada' ? 'cucharadas'
    : t === 'cápsula'   ? 'cápsulas'
    : t === 'tableta'   ? 'tabletas'
    : t + 's'

  const base = `${n} ${label} al día`
  return sup.presentacion.nota ? `${base} — ${sup.presentacion.nota}` : base
}

type SupSelec = { nombre: string; dosis: string; justificacion: string }

interface Props {
  pacienteInicial?: string
  diagnosticoInicial?: string
  pacienteId?: string
}

export default function PlanSuplementacionForm({ pacienteInicial = '', diagnosticoInicial = '', pacienteId }: Props) {
  const [medicoInfo, setMedicoInfo] = useState<MedicoInfo | null>(null)
  const [paciente, setPaciente] = useState(pacienteInicial)
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [diagnostico, setDiagnostico] = useState(diagnosticoInicial)
  const [pesoKg, setPesoKg] = useState('')
  const [seleccionados, setSeleccionados] = useState<SupSelec[]>([])
  const [notas, setNotas] = useState('')
  const [seguimiento, setSeguimiento] = useState('')
  const [imprimiendo, setImprimiendo] = useState(false)

  useEffect(() => {
    fetch('/api/me/perfil-medico').then(r => r.json()).then(({ medico }) => setMedicoInfo(medico))
  }, [])

  function dosisParaForm(sup: Suplemento, peso: number): string {
    if (peso > 0) {
      const caps = dosisEnCapsulas(sup, peso)
      if (caps) return caps
      if (sup.min_kg) return calcularDosis(sup, peso)
    }
    return sup.dosis_default
  }

  function toggleSup(sup: Suplemento) {
    if (seleccionados.find(s => s.nombre === sup.nombre)) {
      setSeleccionados(prev => prev.filter(s => s.nombre !== sup.nombre))
    } else {
      const peso = parseFloat(pesoKg)
      setSeleccionados(prev => [...prev, { nombre: sup.nombre, dosis: dosisParaForm(sup, peso), justificacion: '' }])
    }
  }

  function updateSup(nombre: string, field: keyof SupSelec, val: string) {
    setSeleccionados(prev => prev.map(s => s.nombre === nombre ? { ...s, [field]: val } : s))
  }

  function recalcularTodas() {
    const peso = parseFloat(pesoKg)
    if (!peso) return
    setSeleccionados(prev => prev.map(s => {
      const sup = SUPLEMENTOS.find(x => x.nombre === s.nombre)
      if (!sup) return s
      return { ...s, dosis: dosisParaForm(sup, peso) }
    }))
  }

  async function imprimir() {
    flushSync(() => setImprimiendo(true))
    try {
      if (pacienteId) {
        const supabase = createClient()
        supabase.from('documentos').insert({
          paciente_id: pacienteId,
          tipo: 'suplementacion',
          contenido: { paciente, diagnostico, pesoKg, seleccionados, notas, seguimiento, fecha },
        }).then(() => {})
      }

      const cp = medicoInfo?.color_primario || '#1a3a5c'
      const cs = medicoInfo?.color_secundario || '#1e5fa8'
      const doctorNombre = medicoInfo?.nombre || 'Médico'
      const doctorEspecialidad = medicoInfo?.especialidad || ''
      const cedProf = medicoInfo?.cedula_profesional || ''
      const cedEsp = medicoInfo?.cedula_especialidad || ''
      const direccion = medicoInfo?.direccion_consultorio || ''
      const telefono = medicoInfo?.telefono_consultorio || ''
      const logoUrl = medicoInfo?.logo_url && medicoInfo.logo_url.startsWith('https://')
        ? medicoInfo.logo_url
        : `${window.location.origin}/logo.png`

      const fechaFormat = format(new Date(fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })
      const cols = pesoKg ? '1fr 1fr 1fr' : '1fr 1fr'

      const peso = parseFloat(pesoKg)
      const lista = seleccionados.map((s, i) => {
        const sup = SUPLEMENTOS.find(x => x.nombre === s.nombre)
        const dosisDisplay = (sup && peso > 0)
          ? (dosisEnCapsulas(sup, peso) ?? s.dosis)
          : s.dosis
        return `
        <div class="sup">
          <p class="sup-nombre">${i + 1}. ${s.nombre}</p>
          <p class="sup-dosis">📋 ${dosisDisplay}</p>
          ${sup?.beneficio_paciente ? `<p class="sup-beneficio">${sup.beneficio_paciente}</p>` : ''}
          ${s.justificacion ? `<p class="sup-just">Nota: ${s.justificacion}</p>` : ''}
        </div>`
      }).join('')

      const _html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Plan de Suplementación</title>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  @page { size: letter; margin: 0; }
  body { font-family: 'Roboto', Arial, sans-serif; font-size: 10pt; color: #1a1a1a; position: relative; }
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-25deg); width: 320px; height: 320px; object-fit: contain; opacity: 0.05; pointer-events: none; z-index: 0; }
  .barra-top { background: linear-gradient(135deg, ${cp} 0%, ${cs} 100%); height: 12px; }
  .contenido { padding: 12mm 18mm 10mm; position: relative; z-index: 1; }
  .header { display: flex; align-items: center; gap: 18px; padding-bottom: 12px; margin-bottom: 12px; border-bottom: 2px solid ${cp}; }
  .logo-wrap { width: 70px; height: 70px; border-radius: 50%; border: 3px solid ${cs}; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #f8fafc; }
  .logo { width: 100%; height: 100%; object-fit: contain; }
  .header-info { flex: 1; }
  .doctor-name { font-size: 14pt; font-weight: bold; color: ${cp}; line-height: 1.2; }
  .especialidad { font-size: 9pt; color: ${cs}; margin: 3px 0; font-style: italic; }
  .credenciales { font-size: 8pt; color: #666; }
  .contacto { font-size: 7.5pt; color: #888; margin-top: 3px; }
  .titulo-banner { background: linear-gradient(135deg, ${cp} 0%, ${cs} 100%); color: #fff; text-align: center; font-size: 11pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; padding: 8px 0; border-radius: 4px; margin-bottom: 14px; }
  .datos-box { background: linear-gradient(135deg, ${cp}08, ${cs}08); border-left: 4px solid ${cs}; border-radius: 0 6px 6px 0; padding: 9px 14px; margin-bottom: 14px; }
  .datos-grid { display: grid; grid-template-columns: ${cols}; gap: 5px 20px; }
  .dato { display: flex; gap: 6px; align-items: baseline; font-size: 9pt; }
  .dato-label { font-weight: bold; color: ${cp}; white-space: nowrap; font-size: 8pt; text-transform: uppercase; }
  .dato-valor { flex: 1; border-bottom: 1px solid #d1d5db; padding-bottom: 1px; }
  .seccion-header { display: flex; align-items: center; gap: 8px; margin: 12px 0 7px; }
  .seccion-linea { flex: 1; height: 1px; background: linear-gradient(to right, ${cp}, transparent); }
  .seccion-titulo { font-size: 7.5pt; font-weight: bold; color: ${cp}; text-transform: uppercase; letter-spacing: 1.5px; background: ${cp}12; padding: 3px 10px; border-radius: 20px; white-space: nowrap; }
  .sup { margin-bottom: 10px; padding: 10px 14px; border-left: 4px solid ${cs}; background: ${cp}05; border-radius: 0 6px 6px 0; page-break-inside: avoid; }
  .sup-nombre { font-weight: 700; font-size: 10pt; color: ${cp}; }
  .sup-dosis { font-size: 9.5pt; color: ${cs}; margin-top: 3px; font-weight: 600; }
  .sup-beneficio { font-size: 8.5pt; color: #555; margin-top: 3px; font-style: italic; line-height: 1.4; }
  .sup-just { font-size: 8.5pt; color: #333; margin-top: 3px; }
  .nota { font-size: 9.5pt; color: #333; line-height: 1.6; white-space: pre-line; text-align: justify; }
  .footer-area { margin-top: 24px; display: flex; justify-content: flex-end; }
  .firma { text-align: center; min-width: 210px; border-top: 1.5px solid ${cp}; padding-top: 8px; }
  .firma-nombre { font-weight: bold; font-size: 9.5pt; color: ${cp}; }
  .firma-ced { font-size: 8pt; color: #666; margin-top: 2px; }
  .barra-bottom { background: linear-gradient(135deg, ${cp} 0%, ${cs} 100%); height: 8px; margin-top: 16px; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
<img class="watermark" src="${logoUrl}" onerror="this.style.display='none'" />
<div class="barra-top"></div>
<div class="contenido">
  <div class="header">
    <div class="logo-wrap"><img class="logo" src="${logoUrl}" onerror="this.style.display='none'" /></div>
    <div class="header-info">
      <div class="doctor-name">${doctorNombre}</div>
      ${doctorEspecialidad ? `<div class="especialidad">${doctorEspecialidad}</div>` : ''}
      <div class="credenciales">
        ${cedProf ? `Cédula Prof.: ${cedProf}` : ''}
        ${cedProf && cedEsp ? ' &nbsp;·&nbsp; ' : ''}
        ${cedEsp ? `Cédula Esp.: ${cedEsp}` : ''}
      </div>
      ${direccion || telefono ? `<div class="contacto">${[direccion, telefono ? `Tel: ${telefono}` : ''].filter(Boolean).join(' &nbsp;·&nbsp; ')}</div>` : ''}
    </div>
  </div>

  <div class="titulo-banner">Plan de Suplementación Osteomuscular</div>

  <div class="datos-box">
    <div class="datos-grid">
      <div class="dato"><span class="dato-label">Fecha</span><span class="dato-valor">${fechaFormat}</span></div>
      <div class="dato"><span class="dato-label">Paciente</span><span class="dato-valor">${paciente}</span></div>
      ${pesoKg ? `<div class="dato"><span class="dato-label">Peso</span><span class="dato-valor">${pesoKg} kg</span></div>` : ''}
      ${diagnostico ? `<div class="dato" style="grid-column: 1 / -1;"><span class="dato-label">Diagnóstico</span><span class="dato-valor">${diagnostico}</span></div>` : ''}
    </div>
  </div>

  <div class="seccion-header"><div class="seccion-linea"></div><div class="seccion-titulo">Suplementos indicados</div><div class="seccion-linea"></div></div>
  ${lista}

  ${notas ? `<div class="seccion-header"><div class="seccion-linea"></div><div class="seccion-titulo">Notas adicionales</div><div class="seccion-linea"></div></div><p class="nota">${notas}</p>` : ''}
  ${seguimiento ? `<p style="margin-top:12px;font-size:9.5pt;"><strong style="color:${cp};">Control:</strong> ${seguimiento}</p>` : ''}

  <div class="footer-area">
    <div class="firma">
      <div class="firma-nombre">${doctorNombre}</div>
      ${cedProf ? `<div class="firma-ced">Céd. Prof. ${cedProf}</div>` : ''}
      ${cedEsp ? `<div class="firma-ced">Céd. Esp. ${cedEsp}</div>` : ''}
    </div>
  </div>
</div>
<div class="barra-bottom"></div>
</body></html>`

      await imprimirOCompartir(_html, 'plan-suplementacion.pdf')
    } finally {
      setImprimiendo(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]'

  return (
    <div className="space-y-5">

      {/* Datos del paciente */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-semibold text-slate-700 text-sm mb-4">Datos del paciente</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Paciente <span className="text-red-400">*</span></label>
            <input type="text" value={paciente} onChange={e => setPaciente(e.target.value)} placeholder="Nombre completo" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Diagnóstico</label>
            <input type="text" value={diagnostico} onChange={e => setDiagnostico(e.target.value)} placeholder="Diagnóstico principal" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">
              Peso (kg) <span className="text-slate-400 font-normal">— calcula dosis por peso</span>
            </label>
            <input
              type="number"
              value={pesoKg}
              onChange={e => setPesoKg(e.target.value)}
              placeholder="Ej: 75"
              min="20" max="300" step="0.5"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* Selección de suplementos */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-700 text-sm">Seleccionar suplementos</h2>
          {pesoKg && seleccionados.length > 0 && (
            <button
              onClick={recalcularTodas}
              className="flex items-center gap-1.5 text-xs text-[#1e5fa8] hover:text-[#1a3a5c] font-medium px-3 py-1.5 bg-blue-50 rounded-lg transition-colors"
            >
              <RefreshCw size={12} /> Recalcular dosis ({pesoKg} kg)
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SUPLEMENTOS.map(s => {
            const sel = seleccionados.find(x => x.nombre === s.nombre)
            return (
              <button
                key={s.nombre}
                onClick={() => toggleSup(s)}
                className={`text-left px-4 py-3 rounded-lg border-2 text-sm transition-all ${
                  sel
                    ? 'border-[#1e5fa8] bg-blue-50 text-[#1a3a5c]'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <span className="font-medium">{sel ? '✓ ' : ''}{s.nombre}</span>
                <span className="block text-xs text-slate-400 mt-0.5">
                  {s.dosis_por_kg ?? s.dosis_default}
                </span>
                <span className="block text-xs mt-1.5 leading-relaxed" style={{ color: sel ? '#1e5fa8cc' : '#94a3b8' }}>
                  {s.beneficio_clinico}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Personalizar dosis */}
      {seleccionados.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <h2 className="font-semibold text-slate-700 text-sm">Personalizar dosis y justificación</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {seleccionados.map(s => {
              const sup = SUPLEMENTOS.find(x => x.nombre === s.nombre)
              return (
                <div key={s.nombre} className="p-4 space-y-2">
                  <p className="font-medium text-slate-700 text-sm">{s.nombre}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-400">Dosis</label>
                      <input
                        type="text"
                        value={s.dosis}
                        onChange={e => updateSup(s.nombre, 'dosis', e.target.value)}
                        className="w-full mt-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Nota / Justificación (opcional)</label>
                      <input
                        type="text"
                        value={s.justificacion}
                        onChange={e => updateSup(s.nombre, 'justificacion', e.target.value)}
                        placeholder="Ej: Vitamina D 18 ng/mL en laboratorio"
                        className="w-full mt-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Notas y control */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-semibold text-slate-700 block mb-2">Notas adicionales</label>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            placeholder="Indicaciones generales..."
            rows={3}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30"
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700 block mb-2">Cita de control</label>
          <input
            type="text"
            value={seguimiento}
            onChange={e => setSeguimiento(e.target.value)}
            placeholder="Ej: En 3 meses con nuevos laboratorios"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30"
          />
        </div>
      </div>

      <button
        onClick={imprimir}
        disabled={!paciente || seleccionados.length === 0 || imprimiendo}
        className="w-full flex items-center justify-center gap-2 py-3 bg-[#1a3a5c] text-white rounded-xl font-medium hover:bg-[#0f2540] transition-colors disabled:opacity-50"
      >
        {imprimiendo
          ? <><Loader2 size={18} className="animate-spin" /> Generando PDF...</>
          : <><Printer size={18} /> Imprimir Plan de Suplementación</>
        }
      </button>
    </div>
  )
}
