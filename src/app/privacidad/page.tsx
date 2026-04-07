import Link from 'next/link'
import { ShieldCheck, ArrowLeft, Mail, MapPin, Calendar } from 'lucide-react'

export const metadata = {
  title: 'Aviso de Privacidad — OrthoIntegra',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-semibold text-[#1d1d1f] text-[15px] mb-2">{title}</h2>
      <div className="text-sm text-[#3d3d3f] leading-relaxed space-y-2">{children}</div>
    </section>
  )
}

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-[#f0f4f8]">

      {/* Header */}
      <div className="bg-gradient-to-br from-[#1a3a5c] to-[#1e5fa8] text-white">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <Link href="/" className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft size={14} /> Volver
          </Link>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <ShieldCheck size={20} className="text-white/80" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Aviso de Privacidad</h1>
          </div>
          <p className="text-white/60 text-sm">Integral &middot; Conforme a la LFPDPPP y su Reglamento</p>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 -mt-4 pb-16">
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/60 shadow-[0_8px_40px_rgba(0,0,0,0.06)] overflow-hidden">

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 px-4 sm:px-8 py-4 border-b border-slate-100 text-[11px] text-[#86868b]">
            <span className="flex items-center gap-1.5"><Calendar size={12} /> Actualizado: 4 de abril de 2026</span>
            <span className="flex items-center gap-1.5"><MapPin size={12} /> Merida, Yucatan, Mexico</span>
          </div>

          {/* Secciones */}
          <div className="px-4 sm:px-8 py-6 sm:py-8 space-y-8">

            <Section title="I. Identidad y domicilio del responsable">
              <p>
                <strong className="text-[#1d1d1f]">Angel Manuel Ancona Perez</strong>, con domicilio en Merida, Yucatan, Mexico,
                es el responsable del tratamiento de sus datos personales, en terminos de la
                Ley Federal de Proteccion de Datos Personales en Posesion de los Particulares (LFPDPPP)
                y su Reglamento.
              </p>
            </Section>

            <Section title="II. Datos personales que recabamos">
              <p>Para la prestacion de servicios medicos y la operacion de la plataforma OrthoIntegra, podemos recabar:</p>
              <ul className="list-disc pl-5 space-y-1 text-[13px]">
                <li><strong className="text-[#1d1d1f]">Identificacion:</strong> nombre completo, fecha de nacimiento, sexo, correo electronico, telefono.</li>
                <li><strong className="text-[#1d1d1f]">Salud (sensibles):</strong> diagnosticos, antecedentes medicos, resultados de laboratorio, imagenes medicas, notas clinicas, tratamientos y prescripciones.</li>
                <li><strong className="text-[#1d1d1f]">Profesionales del medico:</strong> cedula profesional, especialidad, direccion del consultorio.</li>
                <li><strong className="text-[#1d1d1f]">Facturacion:</strong> plan de suscripcion contratado. Los datos de pago son procesados directamente por Stripe, Inc. y nunca son almacenados en nuestros servidores.</li>
              </ul>
            </Section>

            <Section title="III. Finalidades del tratamiento">
              <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100/50">
                <p className="text-xs font-semibold text-[#1e5fa8] uppercase tracking-wider mb-2">Primarias (necesarias)</p>
                <ul className="list-disc pl-5 space-y-1 text-[13px]">
                  <li>Creacion y gestion de expedientes clinicos electronicos.</li>
                  <li>Generacion de documentos medicos (recetas, solicitudes de laboratorio e imagen, consentimientos informados).</li>
                  <li>Agendamiento y confirmacion de citas medicas.</li>
                  <li>Procesamiento de pagos y gestion de suscripciones.</li>
                  <li>Comunicacion relacionada con el servicio medico prestado.</li>
                </ul>
              </div>
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
                <p className="text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-2">Secundarias (opcionales)</p>
                <ul className="list-disc pl-5 space-y-1 text-[13px]">
                  <li>Generacion de estadisticas clinicas internas del medico.</li>
                  <li>Envio de recordatorios de citas por WhatsApp o correo electronico.</li>
                  <li>Mejora continua de los servicios de la plataforma.</li>
                </ul>
              </div>
            </Section>

            <Section title="IV. Datos personales sensibles">
              <p>
                La plataforma recaba y trata datos personales sensibles relativos al estado de salud
                de los pacientes, con la finalidad exclusiva de brindar atencion medica. Estos datos
                se encuentran protegidos con cifrado en transito (TLS/HTTPS) y medidas de seguridad
                administrativas, tecnicas y fisicas conforme a la normatividad aplicable.
              </p>
              <p>
                Al utilizar la plataforma, el titular consiente expresamente el tratamiento de sus
                datos sensibles para las finalidades descritas en el presente aviso.
              </p>
            </Section>

            <Section title="V. Transferencia de datos">
              <p>Sus datos personales podran ser transferidos a:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                {[
                  { name: 'Supabase, Inc.', desc: 'Almacenamiento seguro en la nube' },
                  { name: 'Stripe, Inc.', desc: 'Procesamiento de pagos' },
                  { name: 'Google LLC', desc: 'Sincronizacion con Google Calendar' },
                  { name: 'Meta Platforms, Inc.', desc: 'Recordatorios por WhatsApp' },
                  { name: 'Google (Gemini API)', desc: 'Notas medicas con IA' },
                ].map(t => (
                  <div key={t.name} className="flex items-start gap-2 bg-slate-50 rounded-lg px-3 py-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#1e5fa8] mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-[#1d1d1f]">{t.name}</p>
                      <p className="text-[11px] text-[#86868b]">{t.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[12px] text-[#86868b] mt-2">
                Transferencias realizadas con fundamento en el articulo 37 de la LFPDPPP.
              </p>
            </Section>

            <Section title="VI. Derechos ARCO">
              <p>
                Usted tiene derecho a <strong className="text-[#1d1d1f]">Acceder, Rectificar, Cancelar u Oponerse</strong> al tratamiento
                de sus datos personales. Para ejercer estos derechos, envie un correo a:
              </p>
              <div className="flex items-center gap-2.5 bg-blue-50/50 rounded-xl px-4 py-3 border border-blue-100/50 mt-1">
                <Mail size={16} className="text-[#1e5fa8] flex-shrink-0" />
                <span className="text-sm font-semibold text-[#1e5fa8]">privacidad@spinus.com.mx</span>
              </div>
              <p className="text-[12px] text-[#86868b]">
                La solicitud debera contener: nombre completo, descripcion del derecho a ejercer y documento de identidad. Respuesta en un plazo maximo de 20 dias habiles.
              </p>
            </Section>

            <Section title="VII. Medidas de seguridad">
              <p>Implementamos medidas administrativas, tecnicas y fisicas para proteger sus datos:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                {[
                  'Cifrado en transito (HTTPS/TLS)',
                  'Cifrado de tokens (AES-256-GCM)',
                  'Control de acceso por roles (RBAC)',
                  'Seguridad a nivel de fila (RLS)',
                  'Auditoria de accesos y modificaciones',
                  'Sesiones seguras sin persistencia',
                ].map(m => (
                  <div key={m} className="flex items-center gap-2 text-[12px] text-[#3d3d3f]">
                    <ShieldCheck size={12} className="text-emerald-500 flex-shrink-0" />
                    {m}
                  </div>
                ))}
              </div>
            </Section>

            <Section title="VIII. Cookies">
              <p>
                Utilizamos cookies estrictamente necesarias para la sesion de usuario (autenticacion).
                No utilizamos cookies de publicidad ni tecnologias de rastreo con fines de mercadotecnia.
              </p>
            </Section>

            <Section title="IX. Modificaciones">
              <p>
                Cualquier cambio al presente aviso sera publicado en esta misma pagina.
                Le recomendamos revisarla periodicamente.
              </p>
            </Section>

            <Section title="X. Consentimiento">
              <p>
                Al crear una cuenta o utilizar los servicios de OrthoIntegra, usted manifiesta
                su consentimiento expreso para el tratamiento de sus datos personales conforme
                a los terminos del presente aviso de privacidad.
              </p>
            </Section>

          </div>

          {/* Footer */}
          <div className="px-8 py-5 bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="text-[11px] text-[#86868b]">
              <p className="font-medium text-[#3d3d3f]">Angel Manuel Ancona Perez</p>
              <p>Merida, Yucatan, Mexico</p>
            </div>
            <a href="mailto:privacidad@spinus.com.mx" className="text-[11px] text-[#1e5fa8] hover:underline">
              privacidad@spinus.com.mx
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
