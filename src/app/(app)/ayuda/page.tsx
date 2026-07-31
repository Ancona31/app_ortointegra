'use client'

import { useState } from 'react'
import {
  HelpCircle, ChevronDown, Keyboard, BookOpen, Shield, Calendar,
  FileText, Brain, Search, Mail, Pill, Users, MonitorCheck,
  MousePointerClick, ArrowRight, ExternalLink,
} from 'lucide-react'

/* ── FAQ ── */
const faqs = [
  {
    q: '¿Mis datos están seguros?',
    a: 'Sí. Toda la información se cifra con AES-256-GCM en tránsito y en reposo. La base de datos tiene Row Level Security (RLS) para que cada médico solo vea sus datos. Cumplimos con la NOM-004-SSA3 y la LFPDPPP.',
  },
  {
    q: '¿Cómo conecto Google Calendar?',
    a: 'Ve a Agenda y haz clic en el botón "Conectar Google Calendar". Se abrirá una ventana de Google donde autorizas el acceso. Una vez conectado, tus citas se sincronizan bidireccional — lo que creas en la app aparece en tu calendario y viceversa.',
  },
  {
    q: '¿Puedo usar Spinus® desde mi celular?',
    a: 'Sí. La app es 100% responsive y funciona en cualquier navegador. No necesitas instalar nada — solo abre spinus.com.mx desde tu celular o tablet.',
  },
  {
    q: '¿Cómo cambio de plan?',
    a: 'Ve a Mi perfil → Facturación → "Gestionar suscripción". Desde ahí puedes subir o bajar de plan, actualizar tu método de pago o cancelar.',
  },
  {
    q: '¿Qué pasa si cancelo mi suscripción?',
    a: 'Tu cuenta pasa al plan gratuito al final del periodo pagado. No pierdes tus datos — siguen ahí, pero algunas funciones premium se desactivan.',
  },
  {
    q: '¿La IA reemplaza mi criterio médico?',
    a: 'No. La inteligencia artificial es una herramienta de apoyo. Genera borradores de notas y analiza laboratorios, pero tú siempre validas, editas y firmas. El juicio clínico final es tuyo.',
  },
  {
    q: '¿Cómo verifico una receta con QR?',
    a: 'Cada receta generada incluye un código QR único. Al escanearlo, se abre una página pública que muestra los datos de la receta para que la farmacia o el paciente puedan verificar su autenticidad.',
  },
  {
    // El rótulo público del rol es "asistente médico" (LP-DT-23). El valor del
    // enum en BD sigue siendo `secretaria` y no se toca: es interno.
    q: '¿Puedo agregar asistentes médicos a mi cuenta?',
    a: 'Sí. Desde Administración → Usuarios puedes crear cuentas con rol "Asistente Médico/a". Tienen acceso limitado — pueden ver pacientes y agendar citas, pero no generan documentos médicos ni acceden a notas clínicas.',
  },
]

/* ── Guías rápidas ── */
const guides = [
  {
    icon: <Users className="w-5 h-5 text-[#1e5fa8]" />,
    title: 'Registrar un paciente',
    steps: ['Ve a Pacientes → Nuevo paciente', 'Llena nombre, teléfono y datos básicos', 'Haz clic en "Guardar" — el expediente se crea automáticamente'],
  },
  {
    icon: <FileText className="w-5 h-5 text-violet-600" />,
    title: 'Crear una nota médica con IA',
    steps: ['Abre el expediente del paciente → "Nueva nota"', 'Llena motivo de consulta y exploración física', 'Haz clic en "Generar con IA" — revisa, edita y guarda', 'Se desbloquean los documentos: receta, laboratorio, imagen, etc.'],
  },
  {
    icon: <Pill className="w-5 h-5 text-rose-600" />,
    title: 'Generar una receta',
    steps: ['Desde la nota médica guardada, haz clic en el icono de Receta', 'Agrega medicamentos con el buscador inteligente', 'Haz clic en "Imprimir Receta" — se genera el PDF con QR'],
  },
  {
    icon: <Calendar className="w-5 h-5 text-emerald-600" />,
    title: 'Agendar una cita',
    steps: ['Ve a Agenda → haz clic en el horario deseado', 'Selecciona el paciente y tipo de consulta', 'Guarda — la cita aparece en tu Google Calendar automáticamente'],
  },
  {
    icon: <MonitorCheck className="w-5 h-5 text-sky-600" />,
    title: 'Ver estudios DICOM',
    steps: ['Abre el expediente del paciente → pestaña "Imagen"', 'Arrastra tu archivo DICOM o haz clic para subirlo', 'El visor se abre directamente en el navegador — sin software externo'],
  },
  {
    icon: <Mail className="w-5 h-5 text-amber-600" />,
    title: 'Enviar documentos por email',
    steps: ['Genera cualquier documento (receta, solicitud, nota)', 'En la vista del documento, haz clic en "Enviar por email"', 'El paciente recibe el PDF adjunto en su correo'],
  },
]

/* ── Atajos de teclado ── */
const shortcuts = [
  { keys: ['Ctrl', 'K'], desc: 'Búsqueda global de pacientes' },
  { keys: ['Esc'], desc: 'Cerrar modal, menú o panel abierto' },
  { keys: ['↑', '↓'], desc: 'Navegar resultados de búsqueda' },
  { keys: ['Enter'], desc: 'Abrir paciente seleccionado o confirmar acción' },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="text-sm font-semibold text-slate-800 pr-4">{q}</span>
        <ChevronDown size={16} className={`text-slate-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div
        className="overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ maxHeight: open ? '300px' : '0px', opacity: open ? 1 : 0 }}
      >
        <p className="px-5 pb-4 text-sm text-slate-500 leading-relaxed">{a}</p>
      </div>
    </div>
  )
}

export default function AyudaPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-16">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1a3a5c] to-[#1e5fa8] flex items-center justify-center">
            <HelpCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Centro de ayuda</h1>
            <p className="text-sm text-slate-500">Todo lo que necesitas para sacarle el máximo a Spinus®</p>
          </div>
        </div>
      </div>

      {/* Guías rápidas */}
      <section>
        <div className="flex items-center gap-2 mb-5">
          <BookOpen size={16} className="text-[#1e5fa8]" />
          <h2 className="text-base font-bold text-slate-800">Guías rápidas</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {guides.map((g) => (
            <div key={g.title} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-[0_4px_20px_rgba(30,95,168,0.08)] hover:border-[#1e5fa8]/15 transition-all duration-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
                  {g.icon}
                </div>
                <h3 className="text-sm font-semibold text-slate-800">{g.title}</h3>
              </div>
              <ol className="space-y-2">
                {g.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-md bg-gradient-to-br from-[#1a3a5c] to-[#1e5fa8] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-white">{i + 1}</span>
                    </span>
                    <span className="text-[13px] text-slate-600 leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      {/* Reiniciar onboarding */}
      <button
        onClick={() => {
          localStorage.removeItem('spinus_onboarding')
          window.location.reload()
        }}
        className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-[#1a3a5c] to-[#1e5fa8] text-white rounded-xl text-sm font-semibold shadow-[0_4px_24px_rgba(30,95,168,0.3)] hover:shadow-[0_8px_32px_rgba(30,95,168,0.4)] hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200"
      >
        <ArrowRight size={15} className="rotate-180" />
        Volver a ver el tutorial paso a paso
      </button>

      {/* Atajos de teclado */}
      <section>
        <div className="flex items-center gap-2 mb-5">
          <Keyboard size={16} className="text-[#1e5fa8]" />
          <h2 className="text-base font-bold text-slate-800">Atajos de teclado</h2>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {shortcuts.map((s, i) => (
            <div key={s.desc} className={`flex items-center justify-between px-5 py-3.5 ${i > 0 ? 'border-t border-slate-100' : ''}`}>
              <span className="text-sm text-slate-600">{s.desc}</span>
              <div className="flex items-center gap-1.5">
                {s.keys.map((k) => (
                  <kbd key={k} className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600 shadow-sm">
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section>
        <div className="flex items-center gap-2 mb-5">
          <MousePointerClick size={16} className="text-[#1e5fa8]" />
          <h2 className="text-base font-bold text-slate-800">Preguntas frecuentes</h2>
        </div>
        <div className="space-y-2">
          {faqs.map((f) => (
            <FaqItem key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </section>

      {/* Seguridad */}
      <section>
        <div className="flex items-center gap-2 mb-5">
          <Shield size={16} className="text-[#1e5fa8]" />
          <h2 className="text-base font-bold text-slate-800">Seguridad y privacidad</h2>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { label: 'Cifrado AES-256-GCM', desc: 'Datos cifrados en tránsito y en reposo' },
              { label: 'NOM-004-SSA3', desc: 'Expediente clínico conforme a normativa' },
              { label: 'LFPDPPP', desc: 'Protección de datos personales' },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <div className="text-sm font-bold text-[#1e5fa8]">{item.label}</div>
                <p className="mt-1 text-[12px] text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-5 border-t border-slate-100 text-center">
            <p className="text-[13px] text-slate-500">
              Para más detalles, consulta nuestro{' '}
              <a href="/privacy" target="_blank" className="text-[#1e5fa8] font-medium hover:underline">
                Aviso de Privacidad
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* Contacto */}
      <section>
        <div className="bg-gradient-to-r from-[#1a3a5c] to-[#1e5fa8] rounded-2xl p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
          <h2 className="relative text-lg font-bold text-white">¿No encontraste lo que buscabas?</h2>
          <p className="relative mt-2 text-sm text-white/70">
            Escríbenos y te responderemos lo antes posible.
          </p>
          <a
            href="mailto:soporte@spinus.com.mx?subject=Soporte Spinus"
            className="relative inline-flex items-center gap-2 mt-5 bg-white text-[#1a3a5c] px-6 py-2.5 rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200"
          >
            <Mail size={16} />
            Contactar soporte
          </a>
        </div>
      </section>
    </div>
  )
}
