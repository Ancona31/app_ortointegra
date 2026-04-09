import Link from 'next/link'
import LegalLayout from './LegalLayout'
import {
  ShieldCheck,
  ArrowLeft,
  Mail,
  MapPin,
  Calendar,
  Lock,
  Database,
  FileText,
  Users,
  Eye,
  History,
  Shield,
  Cpu,
  Cookie,
  Scale,
  RefreshCw,
  CheckCircle2,
  ListChecks,
  Building2,
  BarChart3,
  KeyRound,
  Filter,
  UserCog,
  Landmark,
} from 'lucide-react'

const AVISO_VERSION = 'v2.0'
const AVISO_FECHA = '9 de abril de 2026'

interface SectionProps {
  id: string
  num: string
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}

function Section({ id, num, title, icon, children }: SectionProps) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-7 h-7 rounded-lg bg-[#1e5fa8]/10 flex items-center justify-center text-[#1e5fa8] flex-shrink-0">
          {icon}
        </div>
        <h2 className="font-semibold text-[#1d1d1f] text-[15px]">
          <span className="text-[#86868b] font-normal mr-2">{num}.</span>
          {title}
        </h2>
      </div>
      <div className="text-sm text-[#3d3d3f] leading-relaxed space-y-2 pl-9">{children}</div>
    </section>
  )
}

const TOC: Array<{ id: string; num: string; title: string }> = [
  { id: 'responsable', num: 'I', title: 'Identidad del responsable' },
  { id: 'datos', num: 'II', title: 'Datos personales que recabamos' },
  { id: 'finalidades', num: 'III', title: 'Finalidades del tratamiento' },
  { id: 'sensibles', num: 'IV', title: 'Datos sensibles y consentimiento expreso' },
  { id: 'seguridad', num: 'V', title: 'Medidas de seguridad implementadas' },
  { id: 'ia', num: 'VI', title: 'Inteligencia artificial y anonimización' },
  { id: 'transferencias', num: 'VII', title: 'Transferencia de datos a terceros' },
  { id: 'fusion', num: 'VIII', title: 'Transferencia por fusión o adquisición' },
  { id: 'cookies', num: 'IX', title: 'Cookies' },
  { id: 'rastreo', num: 'X', title: 'Tecnologías de rastreo y analítica' },
  { id: 'arco', num: 'XI', title: 'Derechos ARCO' },
  { id: 'revocacion', num: 'XII', title: 'Revocación del consentimiento' },
  { id: 'limitacion-uso', num: 'XIII', title: 'Limitación de uso y divulgación de datos' },
  { id: 'retencion', num: 'XIV', title: 'Conservación, retención y cancelación' },
  { id: 'consentimiento-paciente', num: 'XV', title: 'Consentimiento del paciente' },
  { id: 'info-pacientes', num: 'XVI', title: 'Información de pacientes y rol del médico' },
  { id: 'fundamento', num: 'XVII', title: 'Fundamento legal' },
  { id: 'autoridad', num: 'XVIII', title: 'Autoridad competente' },
  { id: 'modificaciones', num: 'XIX', title: 'Modificaciones al aviso' },
  { id: 'contacto', num: 'XX', title: 'Contacto' },
]

const TERCEROS: Array<{ name: string; data: string; protection: string; status?: 'activa' | 'proxima' }> = [
  {
    name: 'Supabase, Inc.',
    data: 'Almacenamiento de la base de datos y autenticación. Recibe todos los datos del expediente clínico.',
    protection: 'Cifrado en reposo, RLS multi-clínica, acceso por roles, auditoría inmutable.',
    status: 'activa',
  },
  {
    name: 'Vercel, Inc.',
    data: 'Hospedaje de la aplicación y entrega de contenido.',
    protection: 'TLS/HTTPS, sin persistencia de datos clínicos en el edge.',
    status: 'activa',
  },
  {
    name: 'Stripe, Inc.',
    data: 'Procesamiento de pagos y suscripciones. Recibe identificadores internos (clínica, usuario, plan) y datos de pago del titular de la suscripción. No recibe datos clínicos ni de pacientes.',
    protection: 'PCI-DSS Level 1. Spinus no almacena números de tarjeta.',
    status: 'activa',
  },
  {
    name: 'Google LLC (Calendar)',
    data: 'Sincronización opcional de citas. Solo recibe iniciales del paciente y horario; nunca el nombre completo, diagnóstico ni datos clínicos.',
    protection: 'OAuth 2.0 con tokens cifrados (AES-256-GCM) en reposo. Anonimización aplicada antes del envío.',
    status: 'activa',
  },
  {
    name: 'Google LLC (Gemini API)',
    data: 'Asistencia de IA para redacción de notas clínicas y consultas rápidas. Solo recibe texto clínico previamente anonimizado.',
    protection: 'Anonimización obligatoria antes del envío: nunca se transmiten nombres, CURP, RFC, teléfonos, correos, direcciones, fechas de nacimiento ni identificadores únicos.',
    status: 'activa',
  },
  {
    name: 'Anthropic, PBC (Claude)',
    data: 'Extracción estructurada de resultados de laboratorio a partir de archivos PDF. Procesa texto clínico anonimizado.',
    protection: 'Anonimización antes del envío. Instrucciones de redacción de PII incluidas en el prompt.',
    status: 'activa',
  },
  {
    name: 'Resend',
    data: 'Envío de documentos médicos por correo electrónico cuando el médico lo solicita expresamente, y notificaciones transaccionales (verificación de cuenta, recuperación de contraseña).',
    protection: 'TLS en tránsito. Contenido enviado a destinatarios definidos por el médico responsable.',
    status: 'activa',
  },
  {
    name: 'Sentry',
    data: 'Monitoreo de errores técnicos y telemetría de rendimiento.',
    protection: 'Filtros automáticos de PII (nombres, CURP, RFC, correos, teléfonos, UUIDs, cookies, cuerpos de petición) antes de cualquier envío. Solo errores en producción.',
    status: 'activa',
  },
  {
    name: 'Meta Platforms, Inc. (WhatsApp Business)',
    data: 'Recordatorios de citas a pacientes mediante plantillas pre-aprobadas. Solo recibirá número telefónico del paciente, hora de la cita e iniciales.',
    protection: 'Plantillas con contenido mínimo, sin diagnósticos ni datos clínicos. Cifrado en tránsito.',
    status: 'proxima',
  },
]

export default function AvisoPrivacidadContent() {
  return (
    <LegalLayout>
      {/* Hero del documento */}
      <div className="bg-gradient-to-br from-[#1a3a5c] to-[#1e5fa8] text-white">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-sm mb-6 transition-colors"
          >
            <ArrowLeft size={14} /> Volver
          </Link>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <ShieldCheck size={20} className="text-white/80" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Aviso de Privacidad Integral</h1>
          </div>
          <p className="text-white/60 text-sm">
            Conforme a la LFPDPPP, NOM-004-SSA3-2012 y NOM-024-SSA3-2012
          </p>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 -mt-4 pb-16">
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/60 shadow-[0_8px_40px_rgba(0,0,0,0.06)] overflow-hidden">
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 px-4 sm:px-8 py-4 border-b border-slate-100 text-[11px] text-[#86868b]">
            <span className="flex items-center gap-1.5">
              <Calendar size={12} /> Última actualización: {AVISO_FECHA}
            </span>
            <span className="flex items-center gap-1.5">
              <FileText size={12} /> Versión: {AVISO_VERSION}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin size={12} /> Mérida, Yucatán, México
            </span>
          </div>

          {/* Índice clickeable */}
          <div className="px-4 sm:px-8 py-6 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2 mb-3">
              <ListChecks size={14} className="text-[#1e5fa8]" />
              <p className="text-xs font-semibold text-[#1e5fa8] uppercase tracking-wider">
                Índice
              </p>
            </div>
            <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px]">
              {TOC.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="text-[#3d3d3f] hover:text-[#1e5fa8] hover:underline transition-colors"
                  >
                    <span className="text-[#86868b] mr-1.5">{item.num}.</span>
                    {item.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>

          {/* Secciones */}
          <div className="px-4 sm:px-8 py-6 sm:py-8 space-y-10">
            {/* I. Responsable */}
            <Section id="responsable" num="I" title="Identidad del responsable" icon={<Shield size={14} />}>
              <p>
                <strong className="text-[#1d1d1f]">Spinus®</strong>, plataforma operada por{' '}
                <strong className="text-[#1d1d1f]">Angel Manuel Ancona Pérez</strong>, con domicilio en
                Mérida, Yucatán, México, es el responsable del tratamiento de los datos personales que
                usted nos proporcione, en términos de la Ley Federal de Protección de Datos Personales
                en Posesión de los Particulares (LFPDPPP) y su Reglamento.
              </p>
              <p>
                Para cualquier asunto relacionado con sus datos personales o el ejercicio de derechos
                ARCO, puede contactarnos en{' '}
                <a
                  href="mailto:privacidad@spinus.com.mx"
                  className="text-[#1e5fa8] font-medium hover:underline"
                >
                  privacidad@spinus.com.mx
                </a>
                .
              </p>
            </Section>

            {/* II. Datos */}
            <Section id="datos" num="II" title="Datos personales que recabamos" icon={<Database size={14} />}>
              <p>
                Para la prestación de servicios médicos y la operación de la plataforma Spinus®
                podemos recabar las siguientes categorías de datos:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-[13px]">
                <li>
                  <strong className="text-[#1d1d1f]">Identificación del usuario médico:</strong>{' '}
                  nombre completo, correo electrónico, teléfono, cédula profesional, cédula de
                  especialidad, especialidad médica, dirección y datos del consultorio.
                </li>
                <li>
                  <strong className="text-[#1d1d1f]">Identificación del paciente:</strong> nombre,
                  fecha de nacimiento, sexo, contacto, identificación oficial cuando se requiera para
                  consentimientos informados.
                </li>
                <li>
                  <strong className="text-[#1d1d1f]">Datos de salud (sensibles):</strong> historial
                  clínico, antecedentes, diagnósticos, tratamientos, recetas médicas, resultados de
                  estudios de laboratorio, estudios de imagen, notas de evolución, consentimientos
                  informados y demás documentación clínica generada en la atención.
                </li>
                <li>
                  <strong className="text-[#1d1d1f]">Datos de uso de la plataforma:</strong> registros
                  de inicio y cierre de sesión, dirección IP, fecha y hora de acceso a expedientes y
                  documentos, y eventos de auditoría requeridos por la normatividad.
                </li>
                <li>
                  <strong className="text-[#1d1d1f]">Datos de facturación:</strong> plan de
                  suscripción, historial de pagos. Los datos de tarjeta son procesados directamente
                  por Stripe, Inc. y nunca son almacenados en nuestros servidores.
                </li>
              </ul>
            </Section>

            {/* III. Finalidades */}
            <Section
              id="finalidades"
              num="III"
              title="Finalidades del tratamiento"
              icon={<CheckCircle2 size={14} />}
            >
              <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100/50">
                <p className="text-xs font-semibold text-[#1e5fa8] uppercase tracking-wider mb-2">
                  Primarias (necesarias para el servicio)
                </p>
                <ul className="list-disc pl-5 space-y-1 text-[13px]">
                  <li>Creación y gestión de expedientes clínicos electrónicos.</li>
                  <li>Generación de recetas médicas verificables mediante código de folio.</li>
                  <li>
                    Generación de documentos médicos: solicitudes de laboratorio e imagen, notas de
                    evolución, consentimientos informados, escritos médicos, planes de
                    suplementación, recibos de honorarios.
                  </li>
                  <li>
                    Asistencia de inteligencia artificial para la redacción de notas clínicas y
                    extracción estructurada de resultados de laboratorio, siempre sobre datos
                    previamente anonimizados.
                  </li>
                  <li>
                    Sincronización opcional de la agenda médica con Google Calendar, transmitiendo
                    únicamente iniciales del paciente y hora de la cita.
                  </li>
                  <li>
                    Envío de documentos médicos al correo del paciente cuando el profesional lo
                    solicita expresamente, a través del proveedor Resend.
                  </li>
                  <li>Procesamiento de pagos y suscripciones a través de Stripe, Inc.</li>
                  <li>
                    Monitoreo de errores técnicos para mantener la estabilidad y seguridad de la
                    plataforma, vía Sentry, con filtros de información personal aplicados antes del
                    envío.
                  </li>
                  <li>
                    Cumplimiento de obligaciones legales en materia de expediente clínico, retención
                    documental y auditoría.
                  </li>
                </ul>
              </div>
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
                <p className="text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-2">
                  Secundarias (opcionales)
                </p>
                <ul className="list-disc pl-5 space-y-1 text-[13px]">
                  <li>Generación de estadísticas internas del médico sobre su práctica.</li>
                  <li>
                    Envío futuro de recordatorios de citas por WhatsApp mediante plantillas
                    aprobadas.
                  </li>
                  <li>Mejora continua de la plataforma.</li>
                </ul>
                <p className="text-[12px] text-[#86868b] mt-3">
                  Usted puede oponerse al tratamiento de sus datos para finalidades secundarias en
                  cualquier momento mediante el procedimiento descrito en la sección IX.
                </p>
              </div>
            </Section>

            {/* IV. Sensibles */}
            <Section
              id="sensibles"
              num="IV"
              title="Datos sensibles y consentimiento expreso"
              icon={<Lock size={14} />}
            >
              <p>
                La plataforma trata datos personales sensibles relativos al estado de salud de los
                pacientes, los cuales son indispensables para la prestación del servicio médico.
                Estos datos se encuentran protegidos con las medidas técnicas, administrativas y
                físicas descritas en la sección V.
              </p>
              <p>
                Al utilizar la plataforma, el titular o quien legalmente lo represente otorga su
                consentimiento expreso para el tratamiento de los datos sensibles para las
                finalidades primarias descritas en este aviso.
              </p>
            </Section>

            {/* V. Seguridad */}
            <Section
              id="seguridad"
              num="V"
              title="Medidas de seguridad implementadas"
              icon={<ShieldCheck size={14} />}
            >
              <p>
                Implementamos medidas administrativas, técnicas y físicas para proteger sus datos
                conforme a los principios de la LFPDPPP:
              </p>

              <div className="space-y-3 mt-2">
                <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs font-semibold text-[#1d1d1f] uppercase tracking-wider mb-2">
                    Cifrado
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-[12.5px]">
                    <li>Cifrado en tránsito mediante HTTPS/TLS en todas las comunicaciones.</li>
                    <li>Cifrado en reposo de la base de datos a nivel de proveedor.</li>
                    <li>
                      Cifrado AES-256-GCM de tokens OAuth de terceros (Google Calendar) almacenados
                      en la base de datos.
                    </li>
                    <li>
                      Cifrado AES-256-GCM con derivación de clave PBKDF2 (100,000 iteraciones,
                      SHA-256) para borradores temporales en el navegador del usuario, con
                      expiración automática a 24 horas.
                    </li>
                  </ul>
                </div>

                <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs font-semibold text-[#1d1d1f] uppercase tracking-wider mb-2">
                    Control de acceso
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-[12.5px]">
                    <li>
                      Control de acceso basado en roles:{' '}
                      <code className="text-[11px] bg-white px-1 py-0.5 rounded border border-slate-200">
                        super_admin
                      </code>
                      ,{' '}
                      <code className="text-[11px] bg-white px-1 py-0.5 rounded border border-slate-200">
                        admin
                      </code>
                      ,{' '}
                      <code className="text-[11px] bg-white px-1 py-0.5 rounded border border-slate-200">
                        medico
                      </code>{' '}
                      y{' '}
                      <code className="text-[11px] bg-white px-1 py-0.5 rounded border border-slate-200">
                        secretaria
                      </code>
                      .
                    </li>
                    <li>
                      Aislamiento de datos por clínica mediante Row Level Security (RLS) en la base
                      de datos. Una clínica jamás puede acceder a información de otra.
                    </li>
                    <li>Validación de autenticación y rol en cada endpoint de la API.</li>
                  </ul>
                </div>

                <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs font-semibold text-[#1d1d1f] uppercase tracking-wider mb-2">
                    Auditoría y registro
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-[12.5px]">
                    <li>
                      Registro de auditoría inmutable de todos los accesos a expedientes,
                      modificaciones, generación de documentos, inicios de sesión, cierres de
                      sesión, intentos fallidos y ejercicio de derechos ARCO.
                    </li>
                    <li>
                      El registro de auditoría no puede ser modificado ni eliminado, ni siquiera por
                      administradores; está protegido por restricciones a nivel de base de datos.
                    </li>
                    <li>Solo el rol super_admin puede consultar el registro de auditoría.</li>
                  </ul>
                </div>

                <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs font-semibold text-[#1d1d1f] uppercase tracking-wider mb-2">
                    Inmutabilidad clínica
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-[12.5px]">
                    <li>
                      Las notas clínicas no pueden modificarse ni eliminarse después de guardarse.
                    </li>
                    <li>
                      Las correcciones o aclaraciones se realizan exclusivamente mediante adendas
                      (addendums) que quedan vinculadas a la nota original sin alterarla.
                    </li>
                  </ul>
                </div>

                <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs font-semibold text-[#1d1d1f] uppercase tracking-wider mb-2">
                    Otras medidas
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-[12.5px]">
                    <li>
                      Sanitización de entradas y neutralización de patrones de inyección antes de
                      cualquier procesamiento por IA.
                    </li>
                    <li>
                      Limitación de tasa (rate limiting) en autenticación y endpoints sensibles para
                      prevenir ataques de fuerza bruta.
                    </li>
                    <li>
                      Filtrado automático de datos personales en reportes de errores antes de su
                      envío al servicio de monitoreo.
                    </li>
                    <li>
                      Foreign keys con restricción ON DELETE RESTRICT para impedir la eliminación
                      accidental de pacientes con historial clínico.
                    </li>
                  </ul>
                </div>
              </div>
            </Section>

            {/* VI. IA */}
            <Section
              id="ia"
              num="VI"
              title="Inteligencia artificial y anonimización"
              icon={<Cpu size={14} />}
            >
              <p>
                La plataforma utiliza servicios de inteligencia artificial de Google (Gemini) y
                Anthropic (Claude) para asistir al profesional de salud en la redacción de notas
                clínicas, consultas rápidas y la extracción estructurada de resultados de
                laboratorio.
              </p>
              <p>
                <strong className="text-[#1d1d1f]">Anonimización obligatoria:</strong> antes de
                enviar cualquier texto a estos servicios, la plataforma elimina automáticamente:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-[13px]">
                <li>Nombres propios completos del paciente y de terceros.</li>
                <li>CURP, RFC y cualquier identificador oficial.</li>
                <li>Números de teléfono.</li>
                <li>Direcciones de correo electrónico.</li>
                <li>Domicilios y direcciones físicas.</li>
                <li>Fechas de nacimiento.</li>
                <li>Identificadores únicos del sistema (UUIDs).</li>
              </ul>
              <p>
                Los servicios de IA reciben únicamente texto clínico despersonalizado (síntomas,
                signos vitales, diagnósticos, tratamientos, valores de laboratorio). Estos
                proveedores tratan los datos conforme a sus propios términos de servicio para uso
                empresarial vía API, los cuales no contemplan el uso de datos transmitidos para el
                entrenamiento de modelos. Spinus no transfiere a estos servicios información que
                permita identificar al paciente.
              </p>
              <p>
                La asistencia de IA es exclusivamente una herramienta de apoyo. El profesional de
                salud debe revisar y aprobar todo contenido generado antes de incorporarlo al
                expediente clínico.
              </p>
            </Section>

            {/* VII. Transferencias */}
            <Section
              id="transferencias"
              num="VII"
              title="Transferencia de datos a terceros"
              icon={<Users size={14} />}
            >
              <p>
                Sus datos personales pueden ser transferidos a los siguientes encargados y terceros,
                exclusivamente para las finalidades descritas:
              </p>
              <div className="space-y-2 mt-2">
                {TERCEROS.map((t) => (
                  <div
                    key={t.name}
                    className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-100"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-[13px] font-semibold text-[#1d1d1f]">{t.name}</p>
                      {t.status === 'proxima' ? (
                        <span className="text-[9.5px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full flex-shrink-0">
                          Próxima integración
                        </span>
                      ) : (
                        <span className="text-[9.5px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex-shrink-0">
                          Activa
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-[#3d3d3f] leading-relaxed">
                      <strong className="text-[#1d1d1f]">Datos que recibe:</strong> {t.data}
                    </p>
                    <p className="text-[12px] text-[#3d3d3f] leading-relaxed mt-1">
                      <strong className="text-[#1d1d1f]">Protección aplicada:</strong> {t.protection}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-[12px] text-[#86868b] mt-3">
                Estas transferencias se realizan con fundamento en los artículos 36 y 37 de la
                LFPDPPP y no requieren consentimiento adicional cuando son necesarias para la
                prestación del servicio o para el cumplimiento de obligaciones derivadas de la
                relación jurídica entre el titular y el responsable.
              </p>
            </Section>

            {/* VIII. NEW — Transferencia por fusión o adquisición */}
            <Section
              id="fusion"
              num="VIII"
              title="Transferencia por fusión o adquisición"
              icon={<Building2 size={14} />}
            >
              <p>
                En el supuesto de que Spinus participe en una operación de fusión, escisión,
                adquisición, venta de activos, reestructuración corporativa o cualquier transacción
                similar, los datos personales tratados a través de la plataforma podrán ser
                transferidos al nuevo responsable como parte de los activos involucrados, siempre y
                cuando dicha transferencia respete las finalidades originales y la normatividad
                vigente en materia de protección de datos personales.
              </p>
              <p>
                En tal supuesto, Spinus notificará a los usuarios con anticipación razonable a
                través de la plataforma o por correo electrónico, informando la identidad del nuevo
                responsable. El nuevo responsable quedará obligado a cumplir con los términos del
                presente aviso de privacidad respecto de los datos transferidos, hasta en tanto no
                se publique un nuevo aviso aceptado por los titulares.
              </p>
              <p className="text-[12px] text-[#86868b]">
                Esta transferencia se realiza con fundamento en el artículo 37, fracción VII, de la
                LFPDPPP.
              </p>
            </Section>

            {/* IX. Cookies */}
            <Section id="cookies" num="IX" title="Cookies" icon={<Cookie size={14} />}>
              <p>
                Utilizamos cookies estrictamente necesarias para mantener la sesión del usuario
                autenticado. No utilizamos cookies de publicidad ni tecnologías de rastreo con fines
                de mercadotecnia o perfilamiento de terceros.
              </p>
            </Section>

            {/* X. NEW — Tecnologías de rastreo y analítica */}
            <Section
              id="rastreo"
              num="X"
              title="Tecnologías de rastreo y analítica"
              icon={<BarChart3 size={14} />}
            >
              <p>
                Spinus <strong className="text-[#1d1d1f]">no utiliza</strong> herramientas de
                analítica web orientadas al perfilamiento publicitario ni redes de rastreo de
                terceros (como píxeles publicitarios, identificadores de marketing o etiquetas de
                remarketing).
              </p>
              <p>
                La única herramienta técnica de telemetría que opera sobre la plataforma es{' '}
                <strong className="text-[#1d1d1f]">Sentry</strong>, utilizada exclusivamente para
                el monitoreo de errores y el rendimiento del servicio. Sentry está configurado con
                filtros de información personal automáticos que redactan datos identificables
                (nombres, CURP, RFC, correos, teléfonos, identificadores únicos, cookies y cuerpos
                de petición) antes de cualquier envío.
              </p>
              <p>
                <strong className="text-[#1d1d1f]">Cómo deshabilitar las cookies:</strong> el
                usuario puede deshabilitar o eliminar las cookies desde la configuración de su
                navegador (Chrome, Firefox, Safari, Edge u otros). Tenga presente que el
                deshabilitar las cookies estrictamente necesarias impedirá el correcto
                funcionamiento de la sesión autenticada y, por tanto, el acceso a la plataforma.
              </p>
              <p className="text-[12px] text-[#86868b]">
                Las instrucciones específicas para gestionar cookies están disponibles en los
                centros de ayuda oficiales de cada navegador.
              </p>
            </Section>

            {/* XI. ARCO */}
            <Section id="arco" num="XI" title="Derechos ARCO" icon={<Eye size={14} />}>
              <p>
                Como titular de los datos personales, usted tiene derecho a:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-[13px]">
                <li>
                  <strong className="text-[#1d1d1f]">Acceso:</strong> conocer qué datos personales
                  tenemos sobre usted y cómo los tratamos.
                </li>
                <li>
                  <strong className="text-[#1d1d1f]">Rectificación:</strong> solicitar la corrección
                  de datos inexactos o incompletos.
                </li>
                <li>
                  <strong className="text-[#1d1d1f]">Cancelación:</strong> solicitar la eliminación
                  o anonimización de sus datos cuando considere que no son necesarios para alguna de
                  las finalidades señaladas o cuando hayan dejado de ser necesarios.
                </li>
                <li>
                  <strong className="text-[#1d1d1f]">Oposición:</strong> oponerse al uso de sus
                  datos para fines específicos, en particular para finalidades secundarias.
                </li>
              </ul>
              <p>Para ejercer cualquiera de estos derechos, envíe un correo a:</p>
              <div className="flex items-center gap-2.5 bg-blue-50/50 rounded-xl px-4 py-3 border border-blue-100/50 mt-1">
                <Mail size={16} className="text-[#1e5fa8] flex-shrink-0" />
                <a
                  href="mailto:privacidad@spinus.com.mx"
                  className="text-sm font-semibold text-[#1e5fa8] hover:underline"
                >
                  privacidad@spinus.com.mx
                </a>
              </div>
              <p className="text-[12.5px]">
                La solicitud deberá indicar: nombre completo del titular, copia de identificación
                oficial, descripción clara y precisa del derecho que desea ejercer y, en su caso,
                los datos sobre los que recae la solicitud. Responderemos en un plazo máximo de{' '}
                <strong className="text-[#1d1d1f]">20 días hábiles</strong> contados a partir de la
                recepción de la solicitud, conforme al artículo 32 de la LFPDPPP.
              </p>
              <p className="text-[12px] text-[#86868b]">
                El ejercicio de los derechos ARCO sobre datos clínicos está sujeto a las
                limitaciones establecidas en la NOM-004-SSA3-2012, particularmente respecto al
                periodo mínimo de conservación del expediente clínico.
              </p>
            </Section>

            {/* XII. NEW — Revocación del consentimiento */}
            <Section
              id="revocacion"
              num="XII"
              title="Revocación del consentimiento"
              icon={<KeyRound size={14} />}
            >
              <p>
                Usted tiene derecho a revocar en cualquier momento el consentimiento que ha
                otorgado para el tratamiento de sus datos personales. Para ello, deberá enviar una
                solicitud al correo:
              </p>
              <div className="flex items-center gap-2.5 bg-blue-50/50 rounded-xl px-4 py-3 border border-blue-100/50 mt-1">
                <Mail size={16} className="text-[#1e5fa8] flex-shrink-0" />
                <a
                  href="mailto:privacidad@spinus.com.mx"
                  className="text-sm font-semibold text-[#1e5fa8] hover:underline"
                >
                  privacidad@spinus.com.mx
                </a>
              </div>
              <p className="text-[12.5px]">
                La solicitud deberá contener el nombre completo del titular, identificación oficial
                y manifestación expresa de la revocación. Spinus dará respuesta en un plazo máximo
                de <strong className="text-[#1d1d1f]">20 días hábiles</strong>.
              </p>
              <p>
                <strong className="text-[#1d1d1f]">Implicaciones de la revocación:</strong> dado
                que el tratamiento de sus datos personales es indispensable para la prestación del
                servicio médico y la operación de la plataforma, la revocación del consentimiento
                puede implicar la imposibilidad de continuar prestando los servicios. Asimismo,
                ciertos datos clínicos deberán conservarse aun después de la revocación, en
                cumplimiento del periodo mínimo de cinco (5) años establecido por la
                NOM-004-SSA3-2012, así como cualquier otra obligación legal que resulte aplicable.
              </p>
            </Section>

            {/* XIII. NEW — Limitación de uso y divulgación */}
            <Section
              id="limitacion-uso"
              num="XIII"
              title="Limitación de uso y divulgación de datos"
              icon={<Filter size={14} />}
            >
              <p>
                Adicionalmente a los derechos ARCO, usted puede solicitar limitar el uso o la
                divulgación de sus datos personales para finalidades secundarias o accesorias,
                tales como el envío de comunicaciones promocionales, recordatorios opcionales o
                estadísticas internas.
              </p>
              <p>
                Para ejercer este derecho, envíe su solicitud al correo:
              </p>
              <div className="flex items-center gap-2.5 bg-blue-50/50 rounded-xl px-4 py-3 border border-blue-100/50 mt-1">
                <Mail size={16} className="text-[#1e5fa8] flex-shrink-0" />
                <a
                  href="mailto:privacidad@spinus.com.mx"
                  className="text-sm font-semibold text-[#1e5fa8] hover:underline"
                >
                  privacidad@spinus.com.mx
                </a>
              </div>
              <p>
                <strong className="text-[#1d1d1f]">Registro Público para Evitar Publicidad
                (REPEP):</strong> si desea evitar de manera general el contacto con fines
                publicitarios o de mercadotecnia, puede inscribir su número telefónico en el REPEP
                administrado por la Procuraduría Federal del Consumidor (PROFECO), disponible en{' '}
                <a
                  href="https://repep.profeco.gob.mx"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1e5fa8] font-medium hover:underline"
                >
                  repep.profeco.gob.mx
                </a>
                . Spinus respeta dicho registro y se abstiene de utilizar datos inscritos en él
                para fines publicitarios.
              </p>
            </Section>

            {/* XIV. Retención */}
            <Section
              id="retencion"
              num="XIV"
              title="Conservación, retención y cancelación"
              icon={<History size={14} />}
            >
              <p>
                <strong className="text-[#1d1d1f]">Retención mínima:</strong> los expedientes
                clínicos se conservan por un periodo mínimo de cinco (5) años contados a partir de
                la última atención médica, conforme a la NOM-004-SSA3-2012.
              </p>
              <p>
                <strong className="text-[#1d1d1f]">No eliminación física:</strong> los expedientes
                clínicos nunca se eliminan físicamente de la base de datos. Cuando un paciente
                solicita la cancelación, sus datos personales identificables se anonimizan mediante
                un proceso de borrado lógico (soft delete), preservando los datos clínicos
                disociados conforme lo exige la normatividad sanitaria.
              </p>
              <p>
                Las foreign keys de la base de datos están configuradas con la restricción ON DELETE
                RESTRICT, lo cual impide técnicamente la eliminación de un paciente con historial
                clínico asociado.
              </p>
              <p>
                Los datos de cuenta del usuario médico se conservan mientras la relación contractual
                esté vigente. Tras la cancelación de la suscripción, los datos clínicos siguen
                sujetos a los plazos de retención sanitaria descritos.
              </p>
            </Section>

            {/* XV. Consentimiento del paciente */}
            <Section
              id="consentimiento-paciente"
              num="XV"
              title="Consentimiento del paciente"
              icon={<FileText size={14} />}
            >
              <p>
                Al dar de alta a un paciente en la plataforma, se registra el consentimiento del
                titular —o de quien legalmente lo represente— para el tratamiento de sus datos
                personales, junto con la versión del aviso de privacidad vigente al momento del
                alta. El profesional de salud es responsable de informar al paciente del contenido
                del presente aviso antes de recabar el consentimiento.
              </p>
              <p>
                Los consentimientos informados específicos para procedimientos médicos se gestionan
                de forma adicional a través del módulo de consentimientos de la plataforma,
                incluyendo firma del paciente, médico tratante, anestesiólogo, testigos y
                representante legal cuando corresponda.
              </p>
            </Section>

            {/* XVI. NEW — Información de pacientes y rol del médico */}
            <Section
              id="info-pacientes"
              num="XVI"
              title="Información de pacientes y rol del médico"
              icon={<UserCog size={14} />}
            >
              <p>
                Es indispensable diferenciar los roles que existen respecto a los datos personales
                de los pacientes registrados en la plataforma:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-[13px]">
                <li>
                  <strong className="text-[#1d1d1f]">El médico usuario es el responsable</strong>{' '}
                  del tratamiento de los datos personales y de los datos de salud de sus pacientes,
                  en términos de la LFPDPPP. Es el médico quien establece las finalidades del
                  tratamiento clínico y quien responde directamente ante el paciente por el uso de
                  su información.
                </li>
                <li>
                  <strong className="text-[#1d1d1f]">Spinus actúa como encargado del
                  tratamiento</strong> en términos del artículo 49 del Reglamento de la LFPDPPP.
                  Spinus trata los datos por cuenta y bajo las instrucciones del médico responsable,
                  proporcionando la infraestructura técnica, las medidas de seguridad descritas en
                  la sección V y las herramientas para el cumplimiento de la normatividad
                  sanitaria.
                </li>
                <li>
                  <strong className="text-[#1d1d1f]">Declaración del médico:</strong> al registrar a
                  un paciente en la plataforma, el médico declara y garantiza que cuenta con el
                  consentimiento informado y la autorización expresa del paciente —o de su
                  representante legal— para recabar, tratar y registrar sus datos personales y de
                  salud en Spinus, así como para que dichos datos sean tratados por Spinus en su
                  carácter de encargado.
                </li>
                <li>
                  El médico es responsable de informar al paciente sobre el contenido del presente
                  aviso de privacidad y de obtener su consentimiento antes de incorporar sus datos
                  a la plataforma.
                </li>
                <li>
                  Spinus no establece relación directa con los pacientes registrados por sus
                  médicos usuarios, salvo cuando un paciente ejerza directamente sus derechos ARCO
                  o de revocación al correo de contacto, en cuyo caso Spinus dará traslado al
                  médico responsable para el cumplimiento conjunto de la solicitud.
                </li>
              </ul>
            </Section>

            {/* XVII. Fundamento legal */}
            <Section id="fundamento" num="XVII" title="Fundamento legal" icon={<Scale size={14} />}>
              <p>El presente aviso se emite con fundamento en:</p>
              <ul className="list-disc pl-5 space-y-1 text-[13px]">
                <li>
                  Ley Federal de Protección de Datos Personales en Posesión de los Particulares
                  (LFPDPPP) y su Reglamento.
                </li>
                <li>
                  NOM-004-SSA3-2012 — Del expediente clínico.
                </li>
                <li>
                  NOM-024-SSA3-2012 — Sistemas de información de registro electrónico para la
                  salud.
                </li>
                <li>Ley General de Salud, artículos 80 y 81.</li>
                <li>
                  Reglamento de la Ley General de Salud en Materia de Prestación de Servicios de
                  Atención Médica.
                </li>
              </ul>
            </Section>

            {/* XVIII. NEW — Autoridad competente */}
            <Section
              id="autoridad"
              num="XVIII"
              title="Autoridad competente"
              icon={<Landmark size={14} />}
            >
              <p>
                La autoridad competente en México para la tutela del derecho a la protección de
                datos personales en posesión de los particulares es la{' '}
                <strong className="text-[#1d1d1f]">
                  Secretaría Anticorrupción y Buen Gobierno
                </strong>{' '}
                del Gobierno Federal, dependencia que asumió las funciones del extinto Instituto
                Nacional de Transparencia, Acceso a la Información y Protección de Datos
                Personales (INAI) tras su reforma estructural.
              </p>
              <p>
                Si usted considera que su derecho a la protección de datos personales ha sido
                vulnerado por alguna conducta u omisión de Spinus, o presume alguna violación a
                las disposiciones de la LFPDPPP, su Reglamento o demás ordenamientos aplicables,
                podrá interponer la denuncia o queja correspondiente ante dicha autoridad. Más
                información en el sitio oficial:
              </p>
              <div className="flex items-center gap-2.5 bg-blue-50/50 rounded-xl px-4 py-3 border border-blue-100/50 mt-1">
                <Landmark size={16} className="text-[#1e5fa8] flex-shrink-0" />
                <a
                  href="https://www.gob.mx/anticorrupcion"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-[#1e5fa8] hover:underline"
                >
                  www.gob.mx/anticorrupcion
                </a>
              </div>
              <p className="text-[12px] text-[#86868b]">
                Spinus recomienda al titular agotar previamente los canales de contacto del
                responsable antes de acudir a la autoridad, con el fin de procurar una solución
                directa y expedita.
              </p>
            </Section>

            {/* XIX. Modificaciones */}
            <Section
              id="modificaciones"
              num="XIX"
              title="Modificaciones al aviso"
              icon={<RefreshCw size={14} />}
            >
              <p>
                Spinus se reserva el derecho de modificar el presente aviso en cualquier momento
                para reflejar cambios legislativos, nuevas funcionalidades o mejoras de seguridad.
                Cualquier modificación será publicada en esta misma página, indicando claramente la
                fecha de actualización y el número de versión. Le recomendamos revisar este aviso
                periódicamente.
              </p>
            </Section>

            {/* XX. Contacto */}
            <Section id="contacto" num="XX" title="Contacto" icon={<Mail size={14} />}>
              <p>
                Para cualquier consulta relacionada con este aviso de privacidad o el tratamiento de
                sus datos personales, puede contactarnos en:
              </p>
              <div className="flex items-center gap-2.5 bg-blue-50/50 rounded-xl px-4 py-3 border border-blue-100/50 mt-1">
                <Mail size={16} className="text-[#1e5fa8] flex-shrink-0" />
                <a
                  href="mailto:privacidad@spinus.com.mx"
                  className="text-sm font-semibold text-[#1e5fa8] hover:underline"
                >
                  privacidad@spinus.com.mx
                </a>
              </div>
            </Section>
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-8 py-5 bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="text-[11px] text-[#86868b]">
              <p className="font-medium text-[#3d3d3f]">
                Spinus®, operada por Angel Manuel Ancona Pérez
              </p>
              <p>Mérida, Yucatán, México</p>
            </div>
            <div className="text-[11px] text-[#86868b]">
              <p>
                Versión {AVISO_VERSION} · {AVISO_FECHA}
              </p>
            </div>
          </div>
        </div>
      </div>
    </LegalLayout>
  )
}
